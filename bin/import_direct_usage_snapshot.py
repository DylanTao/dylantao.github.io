#!/usr/bin/env python3
"""Publish sanitized, combined Codex lifetime and completed-day usage.

The input is the identity-free projection produced by the protected collector.
This module intentionally has no knowledge of Codex credentials, account
identities, per-source readings, or reset times. Collector schema 4 can publish
exact combined completed-day totals; legacy schema 3 continues to publish only
the existing rounded observation history until the protected collector
migrates. A rough cost comparison is derived separately from the site's
already-public blended API rate; it is not supplied by the collector and is not
an actual bill.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import yaml


EXPECTED_SOURCE_COUNT = 2
ROUNDING_QUANTUM = 100_000_000
JAVASCRIPT_SAFE_INTEGER = 9_007_199_254_740_991
EXPECTED_METHOD = "rounded_sum_of_verified_account_lifetime_readings"
EXPECTED_LIFETIME = {
    "units": "tokens",
    "aggregation": "sum_of_sources",
    "rounding": "nearest_0.1B",
}
LEGACY_TOP_LEVEL_KEYS = {
    "schemaVersion",
    "combinedLifetime",
    "method",
    "confidence",
    "updated_at",
}
DAILY_TOP_LEVEL_KEYS = LEGACY_TOP_LEVEL_KEYS | {"combinedDailyUsage"}
EXPECTED_CONFIDENCE = "high"
COST_METHOD = "flat_reference_rate_replay"
COST_REFERENCE_SCOPE = "current_site_build_blended_public_api_rate"
LEGACY_COLLECTOR_SCHEMA = 3
DAILY_COLLECTOR_SCHEMA = 4
LEGACY_SITE_SCHEMA = 4
SITE_SCHEMA = 5
LEGACY_PROFILE_SCHEMA = 5
PROFILE_SCHEMA = 6
HISTORY_SCHEMA = 1
HISTORY_LABEL = "Combined lifetime tokens"
HISTORY_GRAIN = "daily_last_observation"
HISTORY_COVERAGE_START = "2026-07-16"
HISTORY_BEFORE_START = "unobserved"
HISTORY_OBSERVATIONS = {"user_reported", "automated"}
PUBLISHED_LIFETIME_KEYS = {
    "token_count",
    "tokens_label",
    "units",
    "aggregation",
    "rounding",
    "source_count",
}
PUBLISHED_BASE_KEYS = {
    "schema",
    "combined_lifetime",
    "method",
    "confidence",
    "observed_on",
    "updated_at",
    "automated_refresh",
}
HISTORY_KEYS = {
    "schema",
    "label",
    "units",
    "grain",
    "aggregation",
    "rounding",
    "coverage",
    "points",
}
HISTORY_POINT_KEYS = {
    "date",
    "token_count",
    "tokens_label",
    "observation",
}
HISTORY_COVERAGE_KEYS = {"starts_on", "before_start"}
DAILY_USAGE_SCHEMA = 1
DAILY_USAGE_LABEL = "Combined daily Codex usage"
DAILY_USAGE_GRAIN = "day"
DAILY_USAGE_KEYS = {
    "schema",
    "label",
    "units",
    "grain",
    "aggregation",
    "coverage",
    "points",
}
DAILY_USAGE_COVERAGE_KEYS = {
    "starts_on",
    "complete_through",
    "before_start",
    "completeness",
    "prior_unallocated_tokens",
}
DAILY_USAGE_POINT_KEYS = {"date", "tokens"}
DAILY_USAGE_BEFORE_START = {"zero", "unobserved"}
DAILY_USAGE_COMPLETENESS = {"whole_lifetime", "rolling_window_partial"}
COST_KEYS = {
    "method",
    "reference_scope",
    "usd_per_million_tokens",
    "pricing_as_of",
    "usd_midpoint",
    "usd_label",
}

# These are the last verified anonymous combined observations for each UTC day
# in the repository history. The July 12 single-account checkpoint is
# intentionally absent. Cutoff timestamps are used only to avoid seeding a
# daily-last point ahead of a historical input from earlier on that same day;
# they are never published.
SEEDED_DAILY_HISTORY = (
    ("2026-07-16", 32_800_000_000, "user_reported", "2026-07-16T00:00:00Z"),
    ("2026-07-19", 42_300_000_000, "automated", "2026-07-19T23:57:28.389802Z"),
    ("2026-07-20", 43_200_000_000, "automated", "2026-07-20T19:58:19.261683Z"),
    ("2026-07-21", 45_000_000_000, "automated", "2026-07-21T23:35:15.840832Z"),
    ("2026-07-22", 48_800_000_000, "automated", "2026-07-22T14:02:30.599337Z"),
    ("2026-07-23", 52_000_000_000, "automated", "2026-07-23T22:26:22.446201Z"),
    ("2026-07-24", 52_100_000_000, "automated", "2026-07-24T00:26:35.233805Z"),
    ("2026-07-25", 52_100_000_000, "automated", "2026-07-25T00:26:11.939013Z"),
    ("2026-07-26", 52_800_000_000, "automated", "2026-07-26T09:51:20.081394Z"),
    ("2026-07-27", 52_800_000_000, "automated", "2026-07-27T00:31:42.242208Z"),
)


class SnapshotError(ValueError):
    """Raised when an input cannot be safely published."""


def _exact_keys(value: Any, expected: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or isinstance(value, bool):
        raise SnapshotError(f"{label} must be an object")
    actual = set(value)
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        raise SnapshotError(f"{label} has invalid keys (missing={missing}, extra={extra})")
    return value


def _count(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise SnapshotError(f"{label} must be a non-negative integer")
    return value


def _parse_utc_timestamp(value: Any, label: str) -> datetime:
    if not isinstance(value, str) or not value:
        raise SnapshotError(f"{label} must be an ISO UTC timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise SnapshotError(f"{label} must be an ISO UTC timestamp") from error
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise SnapshotError(f"{label} must include a UTC offset")
    return parsed.astimezone(timezone.utc)


def _tokens_label(token_count: int) -> str:
    billions, remainder = divmod(token_count, 1_000_000_000)
    return f"{billions}.{remainder // ROUNDING_QUANTUM}B"


def _parse_iso_date(value: Any, label: str) -> date:
    if not isinstance(value, str) or not value:
        raise SnapshotError(f"{label} must be an ISO date")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise SnapshotError(f"{label} must be an ISO date") from error
    if parsed.isoformat() != value:
        raise SnapshotError(f"{label} must be an ISO date")
    return parsed


def _round_token_count(token_count: int) -> int:
    return (
        (token_count + ROUNDING_QUANTUM // 2) // ROUNDING_QUANTUM
    ) * ROUNDING_QUANTUM


def _validate_daily_usage(
    value: Any,
    *,
    rounded_lifetime_token_count: int,
    observed_at: datetime,
    checked_at: datetime,
    label: str = "combined_daily_usage",
) -> dict[str, Any]:
    usage = _exact_keys(value, DAILY_USAGE_KEYS, label)
    schema = usage["schema"]
    if (
        not isinstance(schema, int)
        or isinstance(schema, bool)
        or schema != DAILY_USAGE_SCHEMA
    ):
        raise SnapshotError(f"{label}.schema must be {DAILY_USAGE_SCHEMA}")

    expected_metadata = {
        "label": DAILY_USAGE_LABEL,
        "units": EXPECTED_LIFETIME["units"],
        "grain": DAILY_USAGE_GRAIN,
        "aggregation": EXPECTED_LIFETIME["aggregation"],
    }
    for field, expected in expected_metadata.items():
        if usage[field] != expected:
            raise SnapshotError(f"{label}.{field} does not match the public contract")

    coverage = _exact_keys(
        usage["coverage"],
        DAILY_USAGE_COVERAGE_KEYS,
        f"{label}.coverage",
    )
    starts_on = _parse_iso_date(
        coverage["starts_on"],
        f"{label}.coverage.starts_on",
    )
    complete_through = _parse_iso_date(
        coverage["complete_through"],
        f"{label}.coverage.complete_through",
    )
    if complete_through < starts_on:
        raise SnapshotError(
            f"{label}.coverage.complete_through cannot precede starts_on"
        )
    if complete_through != observed_at.date() - timedelta(days=1):
        raise SnapshotError(
            f"{label}.coverage.complete_through must be the latest completed UTC date"
        )
    if complete_through >= observed_at.date():
        raise SnapshotError(f"{label} may contain completed UTC dates only")
    if complete_through >= checked_at.date():
        raise SnapshotError(
            f"{label}.coverage.complete_through cannot be today or future"
        )

    before_start = coverage["before_start"]
    completeness = coverage["completeness"]
    if (
        not isinstance(before_start, str)
        or before_start not in DAILY_USAGE_BEFORE_START
    ):
        raise SnapshotError(f"{label}.coverage.before_start is invalid")
    if (
        not isinstance(completeness, str)
        or completeness not in DAILY_USAGE_COMPLETENESS
    ):
        raise SnapshotError(f"{label}.coverage.completeness is invalid")
    prior_unallocated_tokens = _count(
        coverage["prior_unallocated_tokens"],
        f"{label}.coverage.prior_unallocated_tokens",
    )
    if prior_unallocated_tokens > JAVASCRIPT_SAFE_INTEGER:
        raise SnapshotError(
            f"{label}.coverage.prior_unallocated_tokens "
            "must be a JavaScript-safe integer"
        )
    if completeness == "whole_lifetime":
        if before_start != "zero" or prior_unallocated_tokens != 0:
            raise SnapshotError(
                f"{label} whole-lifetime coverage requires zero prehistory "
                "and no prior unallocated tokens"
            )
    elif before_start != "unobserved" or prior_unallocated_tokens == 0:
        raise SnapshotError(
            f"{label} rolling-window coverage requires unobserved prehistory "
            "and a positive prior unallocated total"
        )

    points = usage["points"]
    if not isinstance(points, list) or isinstance(points, bool) or not points:
        raise SnapshotError(f"{label}.points must be a non-empty array")
    previous_date: date | None = None
    exact_total = prior_unallocated_tokens
    for index, raw_point in enumerate(points):
        point_label = f"{label}.points[{index}]"
        point = _exact_keys(raw_point, DAILY_USAGE_POINT_KEYS, point_label)
        point_date = _parse_iso_date(point["date"], f"{point_label}.date")
        tokens = _count(point["tokens"], f"{point_label}.tokens")
        if tokens > JAVASCRIPT_SAFE_INTEGER:
            raise SnapshotError(
                f"{point_label}.tokens must be a JavaScript-safe integer"
            )
        if point_date > complete_through:
            raise SnapshotError(f"{point_label}.date exceeds complete_through")
        if previous_date is not None:
            if point_date <= previous_date:
                raise SnapshotError(
                    f"{label} point dates must be sorted and unique"
                )
            if point_date != previous_date + timedelta(days=1):
                raise SnapshotError(
                    f"{label} must include every UTC date in its coverage window"
                )
        previous_date = point_date
        exact_total += tokens
        if exact_total > JAVASCRIPT_SAFE_INTEGER:
            raise SnapshotError(
                f"{label} exact total must be a JavaScript-safe integer"
            )

    if points[0]["date"] != starts_on.isoformat():
        raise SnapshotError(f"{label} first point must match coverage.starts_on")
    if points[-1]["date"] != complete_through.isoformat():
        raise SnapshotError(
            f"{label} final point must match coverage.complete_through"
        )
    if _round_token_count(exact_total) != rounded_lifetime_token_count:
        raise SnapshotError(
            f"{label} exact total does not reconcile with the rounded lifetime total"
        )
    return usage


def _validate_daily_progression(
    previous: dict[str, Any],
    current: dict[str, Any],
) -> None:
    previous_coverage = previous["coverage"]
    current_coverage = current["coverage"]
    previous_completeness = previous_coverage["completeness"]
    current_completeness = current_coverage["completeness"]
    if (
        previous_completeness == "whole_lifetime"
        and current_completeness != "whole_lifetime"
    ):
        raise SnapshotError("combined daily usage coverage cannot become partial")
    if current_coverage["complete_through"] < previous_coverage["complete_through"]:
        raise SnapshotError(
            "combined daily usage complete_through cannot move backward"
        )

    if previous_completeness == current_completeness:
        for field in (
            "starts_on",
            "before_start",
            "completeness",
            "prior_unallocated_tokens",
        ):
            if current_coverage[field] != previous_coverage[field]:
                raise SnapshotError(
                    f"combined daily usage coverage.{field} cannot change"
                )

    current_by_date = {point["date"]: point["tokens"] for point in current["points"]}
    for point in previous["points"]:
        if point["date"] not in current_by_date:
            raise SnapshotError(
                "combined daily usage cannot drop a previously completed date"
            )
        if current_by_date[point["date"]] != point["tokens"]:
            raise SnapshotError(
                "combined daily usage cannot revise a previously completed date"
            )


def _validate_published_lifetime(value: Any, label: str) -> dict[str, Any]:
    lifetime = _exact_keys(value, PUBLISHED_LIFETIME_KEYS, label)
    token_count = _count(lifetime["token_count"], f"{label}.token_count")
    if token_count > JAVASCRIPT_SAFE_INTEGER:
        raise SnapshotError(f"{label}.token_count must be a JavaScript-safe integer")
    if token_count == 0 or token_count % ROUNDING_QUANTUM != 0:
        raise SnapshotError(
            f"{label}.token_count must be a positive nearest-0.1B rounded total"
        )
    if lifetime["tokens_label"] != _tokens_label(token_count):
        raise SnapshotError(f"{label}.tokens_label does not match token_count")
    for field, expected in EXPECTED_LIFETIME.items():
        if lifetime[field] != expected:
            raise SnapshotError(f"{label}.{field} does not match the public contract")
    source_count = _count(lifetime["source_count"], f"{label}.source_count")
    if source_count != EXPECTED_SOURCE_COUNT:
        raise SnapshotError(f"{label}.source_count must be {EXPECTED_SOURCE_COUNT}")
    return lifetime


def _history_point(
    observed_on: str,
    token_count: int,
    observation: str,
) -> dict[str, Any]:
    return {
        "date": observed_on,
        "token_count": token_count,
        "tokens_label": _tokens_label(token_count),
        "observation": observation,
    }


def _history_payload(points: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "schema": HISTORY_SCHEMA,
        "label": HISTORY_LABEL,
        "units": EXPECTED_LIFETIME["units"],
        "grain": HISTORY_GRAIN,
        "aggregation": EXPECTED_LIFETIME["aggregation"],
        "rounding": EXPECTED_LIFETIME["rounding"],
        "coverage": {
            "starts_on": HISTORY_COVERAGE_START,
            "before_start": HISTORY_BEFORE_START,
        },
        "points": points,
    }


def _seeded_history_through(observed_at: datetime) -> dict[str, Any]:
    points = []
    for observed_on, token_count, observation, cutoff in SEEDED_DAILY_HISTORY:
        if _parse_utc_timestamp(cutoff, "seeded history cutoff") <= observed_at:
            points.append(_history_point(observed_on, token_count, observation))
    return _history_payload(points)


def _seeded_cutoff_for(observed_on: str) -> datetime | None:
    for point_date, _, _, cutoff in SEEDED_DAILY_HISTORY:
        if point_date == observed_on:
            return _parse_utc_timestamp(cutoff, "seeded history cutoff")
    return None


def _validate_history(
    value: Any,
    *,
    current_token_count: int | None = None,
    current_observed_on: str | None = None,
) -> dict[str, Any]:
    history = _exact_keys(value, HISTORY_KEYS, "combined_lifetime_history")
    if (
        not isinstance(history["schema"], int)
        or isinstance(history["schema"], bool)
        or history["schema"] != HISTORY_SCHEMA
    ):
        raise SnapshotError(
            f"combined_lifetime_history.schema must be {HISTORY_SCHEMA}"
        )
    expected_metadata = {
        "label": HISTORY_LABEL,
        "units": EXPECTED_LIFETIME["units"],
        "grain": HISTORY_GRAIN,
        "aggregation": EXPECTED_LIFETIME["aggregation"],
        "rounding": EXPECTED_LIFETIME["rounding"],
    }
    for field, expected in expected_metadata.items():
        if history[field] != expected:
            raise SnapshotError(
                f"combined_lifetime_history.{field} does not match the public contract"
            )

    coverage = _exact_keys(
        history["coverage"],
        HISTORY_COVERAGE_KEYS,
        "combined_lifetime_history.coverage",
    )
    if coverage["starts_on"] != HISTORY_COVERAGE_START:
        raise SnapshotError(
            "combined_lifetime_history.coverage.starts_on does not match the public contract"
        )
    if coverage["before_start"] != HISTORY_BEFORE_START:
        raise SnapshotError(
            "combined_lifetime_history.coverage.before_start does not match the public contract"
        )

    points = history["points"]
    if not isinstance(points, list) or isinstance(points, bool) or not points:
        raise SnapshotError("combined_lifetime_history.points must be a non-empty array")
    previous_date: date | None = None
    previous_count: int | None = None
    for index, raw_point in enumerate(points):
        point = _exact_keys(
            raw_point,
            HISTORY_POINT_KEYS,
            f"combined_lifetime_history.points[{index}]",
        )
        point_date = _parse_iso_date(
            point["date"],
            f"combined_lifetime_history.points[{index}].date",
        )
        token_count = _count(
            point["token_count"],
            f"combined_lifetime_history.points[{index}].token_count",
        )
        if token_count > JAVASCRIPT_SAFE_INTEGER:
            raise SnapshotError(
                f"combined_lifetime_history.points[{index}].token_count "
                "must be a JavaScript-safe integer"
            )
        if token_count == 0 or token_count % ROUNDING_QUANTUM != 0:
            raise SnapshotError(
                f"combined_lifetime_history.points[{index}].token_count "
                "must be a positive nearest-0.1B rounded total"
            )
        if point["tokens_label"] != _tokens_label(token_count):
            raise SnapshotError(
                f"combined_lifetime_history.points[{index}].tokens_label "
                "does not match token_count"
            )
        if (
            not isinstance(point["observation"], str)
            or point["observation"] not in HISTORY_OBSERVATIONS
        ):
            raise SnapshotError(
                f"combined_lifetime_history.points[{index}].observation is invalid"
            )
        if previous_date is not None and point_date <= previous_date:
            raise SnapshotError(
                "combined_lifetime_history point dates must be strictly increasing"
            )
        if previous_count is not None and token_count < previous_count:
            raise SnapshotError(
                "combined_lifetime_history token counts must be nondecreasing"
            )
        previous_date = point_date
        previous_count = token_count

    if points[0]["date"] != HISTORY_COVERAGE_START:
        raise SnapshotError(
            "combined_lifetime_history first point must match coverage.starts_on"
        )
    if current_token_count is not None and points[-1]["token_count"] != current_token_count:
        raise SnapshotError(
            "combined_lifetime_history final point must equal the current lifetime total"
        )
    if current_observed_on is not None and points[-1]["date"] != current_observed_on:
        raise SnapshotError(
            "combined_lifetime_history final point must match the current observation date"
        )
    return history


def _validate_previous_site(value: Any) -> tuple[dict[str, Any], datetime | None]:
    if not isinstance(value, dict) or isinstance(value, bool):
        raise SnapshotError("previous site snapshot must be an object")
    schema = value.get("schema")
    if (
        not isinstance(schema, int)
        or isinstance(schema, bool)
        or schema not in (3, LEGACY_SITE_SCHEMA, SITE_SCHEMA)
    ):
        raise SnapshotError(
            f"previous site snapshot schema must be 3, {LEGACY_SITE_SCHEMA}, or {SITE_SCHEMA}"
        )
    expected_keys = set(PUBLISHED_BASE_KEYS)
    if schema == LEGACY_SITE_SCHEMA:
        expected_keys.add("combined_lifetime_history")
    elif schema == SITE_SCHEMA:
        expected_keys.add("combined_daily_usage")
    snapshot = _exact_keys(value, expected_keys, "previous site snapshot")
    lifetime = _validate_published_lifetime(
        snapshot["combined_lifetime"],
        "previous site snapshot.combined_lifetime",
    )
    observed_on = _parse_iso_date(
        snapshot["observed_on"],
        "previous site snapshot.observed_on",
    )
    if not isinstance(snapshot["automated_refresh"], bool):
        raise SnapshotError("previous site snapshot.automated_refresh must be boolean")

    updated_at: datetime | None
    if snapshot["automated_refresh"]:
        if snapshot["method"] != EXPECTED_METHOD:
            raise SnapshotError("previous site snapshot method is invalid")
        if snapshot["confidence"] != EXPECTED_CONFIDENCE:
            raise SnapshotError("previous site snapshot confidence is invalid")
        updated_at = _parse_utc_timestamp(
            snapshot["updated_at"],
            "previous site snapshot.updated_at",
        )
        if updated_at.date() != observed_on:
            raise SnapshotError(
                "previous site snapshot.updated_at must match observed_on"
            )
    else:
        if snapshot["method"] != "user_reported_rounded_lifetime_checkpoint":
            raise SnapshotError("previous site snapshot method is invalid")
        if snapshot["confidence"] != "user reported":
            raise SnapshotError("previous site snapshot confidence is invalid")
        if snapshot["updated_at"] is not None:
            raise SnapshotError(
                "previous site snapshot.updated_at must be null when user reported"
            )
        updated_at = None

    if schema == LEGACY_SITE_SCHEMA:
        _validate_history(
            snapshot["combined_lifetime_history"],
            current_token_count=lifetime["token_count"],
            current_observed_on=observed_on.isoformat(),
        )
    elif schema == SITE_SCHEMA:
        if updated_at is None:
            raise SnapshotError(
                "previous schema-5 site snapshot must be an automated refresh"
            )
        _validate_daily_usage(
            snapshot["combined_daily_usage"],
            rounded_lifetime_token_count=lifetime["token_count"],
            observed_at=updated_at,
            checked_at=max(updated_at, datetime.now(timezone.utc)),
        )
    return snapshot, updated_at


def _merge_history(
    previous_site: Any | None,
    *,
    observed_at: datetime,
    token_count: int,
) -> dict[str, Any]:
    observed_on = observed_at.date().isoformat()
    if observed_on < HISTORY_COVERAGE_START:
        raise SnapshotError(
            f"snapshot.updated_at must be on or after {HISTORY_COVERAGE_START}"
        )

    previous_updated_at: datetime | None = None
    replacement_after: datetime | None = None
    if previous_site is None:
        history = _seeded_history_through(observed_at)
        if history["points"] and history["points"][-1]["date"] == observed_on:
            replacement_after = _seeded_cutoff_for(observed_on)
    else:
        previous, previous_updated_at = _validate_previous_site(previous_site)
        if previous["schema"] == SITE_SCHEMA:
            raise SnapshotError(
                "legacy collector input cannot replace exact combined daily usage"
            )
        previous_lifetime = previous["combined_lifetime"]
        previous_observed_on = previous["observed_on"]
        if observed_on < previous_observed_on:
            raise SnapshotError("snapshot observation date cannot move backward")
        if token_count < previous_lifetime["token_count"]:
            raise SnapshotError("snapshot lifetime total cannot decrease")
        if (
            observed_on == previous_observed_on
            and previous_updated_at is not None
            and observed_at < previous_updated_at
        ):
            raise SnapshotError(
                "snapshot.updated_at cannot precede the prior same-day observation"
            )
        if (
            observed_on == previous_observed_on
            and previous_updated_at is not None
            and observed_at == previous_updated_at
            and token_count != previous_lifetime["token_count"]
        ):
            raise SnapshotError(
                "a changed same-day total requires a later observation timestamp"
            )
        history = (
            previous["combined_lifetime_history"]
            if previous["schema"] == LEGACY_SITE_SCHEMA
            else _seeded_history_through(observed_at)
        )
        if history["points"] and history["points"][-1]["date"] == observed_on:
            replacement_after = _seeded_cutoff_for(observed_on)
        if observed_on == previous_observed_on and previous_updated_at is not None:
            replacement_after = max(
                timestamp
                for timestamp in (replacement_after, previous_updated_at)
                if timestamp is not None
            )

    points = [dict(point) for point in history["points"]]
    if not points:
        points.append(_history_point(observed_on, token_count, "automated"))
    else:
        final = points[-1]
        if observed_on < final["date"]:
            raise SnapshotError("snapshot observation date cannot move backward")
        if token_count < final["token_count"]:
            raise SnapshotError("snapshot lifetime total cannot decrease")
        current = _history_point(observed_on, token_count, "automated")
        if observed_on == final["date"]:
            if replacement_after is not None and observed_at == replacement_after:
                if token_count != final["token_count"]:
                    raise SnapshotError(
                        "a changed same-day total requires a later observation timestamp"
                    )
            else:
                points[-1] = current
        else:
            points.append(current)

    merged = _history_payload(points)
    _validate_history(
        merged,
        current_token_count=token_count,
        current_observed_on=observed_on,
    )
    return merged


def _cost_label(usd_midpoint: int) -> str:
    thousands = usd_midpoint / 1_000
    return f"~${thousands:.1f}K API-rate replay"


def _cost_equivalence(token_count: int, agentic_usage: Any) -> dict[str, Any]:
    if not isinstance(agentic_usage, dict):
        raise SnapshotError("agentic usage cost basis must be an object")
    try:
        cost = agentic_usage["total"]["api_cost_equivalence"]
        reference_tokens = cost["priced_token_usage"]["total_tokens"]
        reference_usd = cost["usd_estimate"]
        pricing_as_of = cost["pricing_as_of"]
    except (KeyError, TypeError) as error:
        raise SnapshotError("agentic usage cost basis is incomplete") from error
    reference_tokens = _count(reference_tokens, "agentic usage priced tokens")
    if (
        not isinstance(reference_usd, (int, float))
        or isinstance(reference_usd, bool)
        or not math.isfinite(reference_usd)
    ):
        raise SnapshotError("agentic usage API replay dollars must be numeric")
    if reference_tokens == 0 or reference_usd <= 0:
        raise SnapshotError("agentic usage cost basis must be positive")
    if not isinstance(pricing_as_of, str):
        raise SnapshotError("agentic usage pricing_as_of must be an ISO date")
    try:
        parsed_pricing_date = datetime.strptime(pricing_as_of, "%Y-%m-%d")
    except ValueError as error:
        raise SnapshotError("agentic usage pricing_as_of must be an ISO date") from error
    if parsed_pricing_date.date().isoformat() != pricing_as_of:
        raise SnapshotError("agentic usage pricing_as_of must be an ISO date")

    usd_per_million_tokens = round(reference_usd / reference_tokens * 1_000_000, 6)
    replay = token_count / 1_000_000 * usd_per_million_tokens
    usd_midpoint = int(replay + 0.5)
    return {
        "method": COST_METHOD,
        "reference_scope": COST_REFERENCE_SCOPE,
        "usd_per_million_tokens": usd_per_million_tokens,
        "pricing_as_of": pricing_as_of,
        "usd_midpoint": usd_midpoint,
        "usd_label": _cost_label(usd_midpoint),
    }


def _collector_context(
    source: Any,
    *,
    now: datetime | None = None,
    max_age: timedelta = timedelta(minutes=20),
) -> tuple[dict[str, Any], int, int, str, datetime, datetime]:
    if not isinstance(source, dict) or isinstance(source, bool):
        raise SnapshotError("snapshot must be an object")
    schema_version = source.get("schemaVersion")
    if (
        not isinstance(schema_version, int)
        or isinstance(schema_version, bool)
        or schema_version not in (LEGACY_COLLECTOR_SCHEMA, DAILY_COLLECTOR_SCHEMA)
    ):
        _exact_keys(source, LEGACY_TOP_LEVEL_KEYS, "snapshot")
        raise SnapshotError(
            "snapshot.schemaVersion must be "
            f"{LEGACY_COLLECTOR_SCHEMA} or {DAILY_COLLECTOR_SCHEMA}"
        )
    expected_keys = (
        LEGACY_TOP_LEVEL_KEYS
        if schema_version == LEGACY_COLLECTOR_SCHEMA
        else DAILY_TOP_LEVEL_KEYS
    )
    source = _exact_keys(source, expected_keys, "snapshot")

    lifetime = _exact_keys(
        source["combinedLifetime"],
        {"tokenCount", "sourceCount", "units", "aggregation", "rounding"},
        "snapshot.combinedLifetime",
    )
    token_count = _count(
        lifetime["tokenCount"],
        "snapshot.combinedLifetime.tokenCount",
    )
    if token_count > JAVASCRIPT_SAFE_INTEGER:
        raise SnapshotError(
            "snapshot.combinedLifetime.tokenCount must be a JavaScript-safe integer"
        )
    if token_count == 0 or token_count % ROUNDING_QUANTUM != 0:
        raise SnapshotError(
            "snapshot.combinedLifetime.tokenCount must be a positive nearest-0.1B rounded total"
        )
    source_count = _count(
        lifetime["sourceCount"],
        "snapshot.combinedLifetime.sourceCount",
    )
    if source_count != EXPECTED_SOURCE_COUNT:
        raise SnapshotError(
            f"snapshot.combinedLifetime.sourceCount must be {EXPECTED_SOURCE_COUNT}"
        )
    for field, expected in EXPECTED_LIFETIME.items():
        if lifetime[field] != expected:
            raise SnapshotError(
                f"snapshot.combinedLifetime.{field} does not match the public collector contract"
            )

    if source["method"] != EXPECTED_METHOD:
        raise SnapshotError("snapshot.method does not match the rounded lifetime method")
    confidence = source["confidence"]
    if confidence != EXPECTED_CONFIDENCE:
        raise SnapshotError(f"snapshot.confidence must be {EXPECTED_CONFIDENCE!r}")

    observed_at = _parse_utc_timestamp(source["updated_at"], "snapshot.updated_at")
    checked_at = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    age = checked_at - observed_at
    if age < -timedelta(minutes=5):
        raise SnapshotError("snapshot.updated_at is too far in the future")
    if age > max_age:
        raise SnapshotError("snapshot.updated_at is stale")

    return source, schema_version, token_count, confidence, observed_at, checked_at


def _validate_new_snapshot_progression(
    previous_site: Any | None,
    *,
    observed_at: datetime,
    token_count: int,
    daily_usage: dict[str, Any],
) -> None:
    if previous_site is None:
        return
    previous, previous_updated_at = _validate_previous_site(previous_site)
    observed_on = observed_at.date().isoformat()
    if observed_on < previous["observed_on"]:
        raise SnapshotError("snapshot observation date cannot move backward")
    if token_count < previous["combined_lifetime"]["token_count"]:
        raise SnapshotError("snapshot lifetime total cannot decrease")
    if previous_updated_at is not None and observed_at < previous_updated_at:
        raise SnapshotError("snapshot.updated_at cannot precede the prior observation")
    if (
        previous_updated_at is not None
        and observed_at == previous_updated_at
        and token_count != previous["combined_lifetime"]["token_count"]
    ):
        raise SnapshotError(
            "a changed lifetime total requires a later observation timestamp"
        )
    if previous["schema"] == SITE_SCHEMA:
        _validate_daily_progression(
            previous["combined_daily_usage"],
            daily_usage,
        )


def build_site_snapshot(
    source: Any,
    *,
    previous_site: Any | None = None,
    now: datetime | None = None,
    max_age: timedelta = timedelta(minutes=20),
) -> dict[str, Any]:
    """Validate a protected collector projection and build its site payload."""

    (
        source,
        schema_version,
        token_count,
        confidence,
        observed_at,
        checked_at,
    ) = _collector_context(source, now=now, max_age=max_age)
    source_count = source["combinedLifetime"]["sourceCount"]
    lifetime_payload = {
        "token_count": token_count,
        "tokens_label": _tokens_label(token_count),
        "units": EXPECTED_LIFETIME["units"],
        "aggregation": EXPECTED_LIFETIME["aggregation"],
        "rounding": EXPECTED_LIFETIME["rounding"],
        "source_count": source_count,
    }
    base_payload = {
        "combined_lifetime": lifetime_payload,
        "method": EXPECTED_METHOD,
        "confidence": confidence,
        "observed_on": observed_at.date().isoformat(),
        "updated_at": source["updated_at"],
        "automated_refresh": True,
    }
    if schema_version == LEGACY_COLLECTOR_SCHEMA:
        return {
            "schema": LEGACY_SITE_SCHEMA,
            **base_payload,
            "combined_lifetime_history": _merge_history(
                previous_site,
                observed_at=observed_at,
                token_count=token_count,
            ),
        }

    daily_usage = _validate_daily_usage(
        source["combinedDailyUsage"],
        rounded_lifetime_token_count=token_count,
        observed_at=observed_at,
        checked_at=checked_at,
        label="snapshot.combinedDailyUsage",
    )
    _validate_new_snapshot_progression(
        previous_site,
        observed_at=observed_at,
        token_count=token_count,
        daily_usage=daily_usage,
    )
    return {
        "schema": SITE_SCHEMA,
        **base_payload,
        "combined_daily_usage": daily_usage,
    }


def build_public_snapshot(
    source: Any,
    *,
    agentic_usage: Any,
    previous_site: Any | None = None,
    now: datetime | None = None,
    max_age: timedelta = timedelta(minutes=20),
) -> dict[str, Any]:
    """Project the site payload with the bounded flat-rate cost comparison."""

    site = build_site_snapshot(
        source,
        previous_site=previous_site,
        now=now,
        max_age=max_age,
    )
    profile_schema = (
        PROFILE_SCHEMA if site["schema"] == SITE_SCHEMA else LEGACY_PROFILE_SCHEMA
    )
    return {
        **site,
        "schema": profile_schema,
        "cost": _cost_equivalence(site["combined_lifetime"]["token_count"], agentic_usage),
    }


def _serialized(payload: dict[str, Any]) -> bytes:
    return (json.dumps(payload, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def _load_previous_site(repo_root: Path) -> dict[str, Any] | None:
    site_path = repo_root / "_data" / "direct_usage_tracker.json"
    profile_path = repo_root / "assets" / "data" / "codex-profile-usage.json"
    if not site_path.exists() and not profile_path.exists():
        return None
    if site_path.exists() != profile_path.exists():
        raise SnapshotError(
            "previous site and profile snapshots must either both exist or both be absent"
        )

    site = json.loads(site_path.read_text(encoding="utf-8"))
    profile = json.loads(profile_path.read_text(encoding="utf-8"))
    site, _ = _validate_previous_site(site)
    expected_profile_keys = set(site) | {"cost"}
    profile = _exact_keys(profile, expected_profile_keys, "previous profile snapshot")
    expected_profile_schema = site["schema"] + 1
    if (
        not isinstance(profile["schema"], int)
        or isinstance(profile["schema"], bool)
        or profile["schema"] != expected_profile_schema
    ):
        raise SnapshotError(
            f"previous profile snapshot schema must be {expected_profile_schema}"
        )
    for field in set(site) - {"schema"}:
        if profile[field] != site[field]:
            raise SnapshotError(
                f"previous profile snapshot.{field} must match the site snapshot"
            )

    cost = _exact_keys(profile["cost"], COST_KEYS, "previous profile snapshot.cost")
    if cost["method"] != COST_METHOD or cost["reference_scope"] != COST_REFERENCE_SCOPE:
        raise SnapshotError("previous profile snapshot cost method is invalid")
    rate = cost["usd_per_million_tokens"]
    if (
        not isinstance(rate, (int, float))
        or isinstance(rate, bool)
        or not math.isfinite(rate)
        or rate <= 0
    ):
        raise SnapshotError(
            "previous profile snapshot cost rate must be a positive number"
        )
    midpoint = _count(cost["usd_midpoint"], "previous profile snapshot.cost.usd_midpoint")
    if midpoint == 0 or cost["usd_label"] != _cost_label(midpoint):
        raise SnapshotError("previous profile snapshot cost label is invalid")
    _parse_iso_date(
        cost["pricing_as_of"],
        "previous profile snapshot.cost.pricing_as_of",
    )
    return site


def _staged_file(path: Path, content: bytes) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
    except Exception:
        Path(temporary).unlink(missing_ok=True)
        raise
    return Path(temporary)


def publish_atomically(
    repo_root: Path,
    site_payload: dict[str, Any],
    profile_payload: dict[str, Any],
) -> None:
    """Stage both outputs and restore the prior pair if replacement fails."""

    targets = {
        repo_root / "_data" / "direct_usage_tracker.json": _serialized(site_payload),
        repo_root / "assets" / "data" / "codex-profile-usage.json": _serialized(profile_payload),
    }
    originals = {path: path.read_bytes() if path.exists() else None for path in targets}
    staged: dict[Path, Path] = {}
    try:
        for path, content in targets.items():
            staged[path] = _staged_file(path, content)
    except Exception:
        for temporary in staged.values():
            temporary.unlink(missing_ok=True)
        raise
    replaced: list[Path] = []
    try:
        for path in targets:
            os.replace(staged[path], path)
            replaced.append(path)
    except Exception:
        for path in reversed(replaced):
            original = originals[path]
            if original is None:
                path.unlink(missing_ok=True)
            else:
                rollback = _staged_file(path, original)
                os.replace(rollback, path)
        raise
    finally:
        for temporary in staged.values():
            temporary.unlink(missing_ok=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="sanitized collector projection JSON")
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--max-age-minutes", type=float, default=20.0)
    parser.add_argument("--check", action="store_true", help="validate without writing")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        source = json.loads(args.input.read_text(encoding="utf-8"))
        repo_root = args.repo_root.resolve()
        previous_site = _load_previous_site(repo_root)
        agentic_usage = yaml.safe_load(
            (repo_root / "_data" / "agentic_usage.yml").read_text(
                encoding="utf-8"
            )
        )
        site_payload = build_site_snapshot(
            source,
            previous_site=previous_site,
            max_age=timedelta(minutes=args.max_age_minutes),
        )
        profile_payload = build_public_snapshot(
            source,
            agentic_usage=agentic_usage,
            previous_site=previous_site,
            max_age=timedelta(minutes=args.max_age_minutes),
        )
        if not args.check:
            publish_atomically(repo_root, site_payload, profile_payload)
    except (OSError, json.JSONDecodeError, SnapshotError) as error:
        print(f"direct usage snapshot rejected: {error}", file=__import__("sys").stderr)
        return 1
    print(json.dumps(profile_payload, separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
