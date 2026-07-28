#!/usr/bin/env python3
"""Publish identity-free combined lifetime and exact daily code activity.

The preferred inputs are a dense five-year personal UTC day series and a
protected UTC work-day series. The public projection contains only dates and
aggregate counts. Legacy cumulative bridge/profile snapshots remain readable
until both producers have completed their v2/v3 migrations.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


TIMEZONE_NAME = "America/Los_Angeles"
UTC_TIMEZONE_NAME = "UTC"
PERSONAL_DAILY_HISTORY_START = date(2021, 7, 28)
# The last published legacy cumulative snapshot is the immutable migration
# anchor. Historical daily rows remain inspectable before this date, while only
# exact UTC days after it are allowed to advance or correct the lifetime tally.
LIFETIME_MIGRATION_BASELINE_DATE = date(2026, 7, 26)
try:
    TIMEZONE = ZoneInfo(TIMEZONE_NAME)
except ZoneInfoNotFoundError:
    # Fresh Windows Python installs may omit the IANA timezone database. This
    # fallback applies the US Pacific rules used throughout the 2020-present
    # source history without adding a runtime dependency.
    TIMEZONE = None

JAVASCRIPT_SAFE_INTEGER = 9_007_199_254_740_991
PROFILE_CLOSURE_HOUR_LIMIT = 4
BRIDGE_KEYS = {"schema", "date", "commits", "additions", "deletions"}
BRIDGE_V2_KEYS = {"schema", "through", "totals", "daily"}
BRIDGE_V2_TOTAL_KEYS = {"commits", "additions", "deletions"}
BRIDGE_V2_DAILY_KEYS = {"date", "commits", "additions", "deletions"}
PROFILE_KEYS = {"schema", "generatedAt", "weeks"}
PROFILE_ROW_KEYS = {"week", "commits", "additions", "deletions"}
PROFILE_V3_KEYS = {"schema", "generatedAt", "weeks", "daily"}
PROFILE_V3_DAILY_KEYS = {
    "timezone",
    "starts_on",
    "complete_through",
    "coverage",
    "points",
}
PROFILE_V3_DAILY_POINT_KEYS = {
    "date",
    "commits",
    "additions",
    "deletions",
}
PUBLIC_KEYS = {
    "schema",
    "timezone",
    "scope",
    "aggregation",
    "updated_on",
    "points",
}
PUBLIC_POINT_KEYS = {"date", "commits", "additions", "deletions"}
PUBLIC_V2_KEYS = {"schema", "updated_on", "timezone", "lifetime", "daily"}
PUBLIC_V2_LIFETIME_KEYS = {"through", "commits", "additions", "deletions"}
PUBLIC_V2_DAILY_KEYS = {"starts_on", "complete_through", "points"}
PUBLIC_V2_POINT_KEYS = {"date", "commits", "additions", "deletions"}
METRICS = ("commits", "additions", "deletions")
ZERO_COUNTS = {metric: 0 for metric in METRICS}

ProfileRows = dict[date, dict[str, int]]
ProfileHistory = list[tuple[datetime, ProfileRows]]


class ActivityError(ValueError):
    """Raised when an input cannot be safely published."""


def _nth_sunday(year: int, month: int, occurrence: int) -> date:
    first = date(year, month, 1)
    day = 1 + ((6 - first.weekday()) % 7) + (7 * (occurrence - 1))
    return date(year, month, day)


def _pacific_datetime(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ActivityError("timestamp must include an offset")
    if TIMEZONE is not None:
        return value.astimezone(TIMEZONE)

    observed_utc = value.astimezone(timezone.utc)
    year = observed_utc.year
    daylight_start = datetime.combine(
        _nth_sunday(year, 3, 2),
        datetime.min.time(),
        tzinfo=timezone.utc,
    ) + timedelta(hours=10)
    daylight_end = datetime.combine(
        _nth_sunday(year, 11, 1),
        datetime.min.time(),
        tzinfo=timezone.utc,
    ) + timedelta(hours=9)
    offset = -7 if daylight_start <= observed_utc < daylight_end else -8
    return observed_utc.astimezone(timezone(timedelta(hours=offset)))


def _today() -> date:
    return _pacific_datetime(datetime.now(timezone.utc)).date()


def _exact_keys(
    value: Any,
    expected: set[str],
    label: str,
    *,
    disclose_keys: bool = True,
) -> dict[str, Any]:
    if not isinstance(value, dict) or isinstance(value, bool):
        raise ActivityError(f"{label} must be an object")
    actual = set(value)
    if actual != expected:
        if not disclose_keys:
            raise ActivityError(f"{label} has an invalid structure")
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        raise ActivityError(
            f"{label} has invalid keys (missing={missing}, extra={extra})"
        )
    return value


def _count(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ActivityError(f"{label} must be a non-negative integer")
    if value > JAVASCRIPT_SAFE_INTEGER:
        raise ActivityError(f"{label} must be a JavaScript-safe integer")
    return value


def _iso_date(value: Any, label: str) -> date:
    if not isinstance(value, str):
        raise ActivityError(f"{label} must use YYYY-MM-DD")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise ActivityError(f"{label} must use YYYY-MM-DD") from error
    if parsed.isoformat() != value:
        raise ActivityError(f"{label} must use YYYY-MM-DD")
    return parsed


def _timestamp(value: Any, label: str) -> datetime:
    if not isinstance(value, str) or not value:
        raise ActivityError(f"{label} must be an ISO timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ActivityError(f"{label} must be an ISO timestamp") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ActivityError(f"{label} must include an offset")
    return parsed


def _add_counts(*counts: dict[str, int]) -> dict[str, int]:
    totals = dict(ZERO_COUNTS)
    for group in counts:
        for metric in METRICS:
            totals[metric] = _count(
                totals[metric] + _count(group[metric], metric),
                f"combined {metric}",
            )
    return totals


def validate_bridge(source: Any, *, today: date | None = None) -> dict[str, Any]:
    source = _exact_keys(
        source,
        BRIDGE_KEYS,
        "protected bridge snapshot",
        disclose_keys=False,
    )
    if (
        not isinstance(source["schema"], int)
        or isinstance(source["schema"], bool)
        or source["schema"] != 1
    ):
        raise ActivityError("protected bridge snapshot schema is invalid")
    observed = _iso_date(source["date"], "protected bridge snapshot date")
    if observed > (today or _today()):
        raise ActivityError("protected bridge snapshot date cannot be in the future")
    return {
        "schema": 1,
        "date": observed.isoformat(),
        **{
            metric: _count(
                source[metric],
                f"protected bridge snapshot {metric}",
            )
            for metric in METRICS
        },
    }


def validate_profile_snapshot(source: Any) -> tuple[datetime, ProfileRows]:
    source = _exact_keys(source, PROFILE_KEYS, "personal snapshot")
    if (
        not isinstance(source["schema"], int)
        or isinstance(source["schema"], bool)
        or source["schema"] != 2
    ):
        raise ActivityError("personal snapshot.schema must be integer 2")
    generated_at = _timestamp(
        source["generatedAt"],
        "personal snapshot.generatedAt",
    )
    weeks = source["weeks"]
    if not isinstance(weeks, list) or not weeks:
        raise ActivityError("personal snapshot.weeks must be a non-empty array")

    rows: ProfileRows = {}
    previous_week: date | None = None
    for index, raw_row in enumerate(weeks):
        row = _exact_keys(
            raw_row,
            PROFILE_ROW_KEYS,
            f"personal snapshot.weeks[{index}]",
        )
        week = _iso_date(row["week"], f"personal snapshot.weeks[{index}].week")
        if week.weekday() != 6:
            raise ActivityError("personal snapshot week dates must be Sundays")
        if previous_week is not None and (week - previous_week).days != 7:
            raise ActivityError("personal snapshot week dates must be contiguous")
        rows[week] = {
            metric: _count(
                row[metric],
                f"personal snapshot.weeks[{index}].{metric}",
            )
            for metric in METRICS
        }
        previous_week = week
    return generated_at, rows


def _validate_dense_daily_points(
    points: Any,
    *,
    label: str,
    point_keys: set[str],
    starts_on: date | None = None,
    complete_through: date | None = None,
    today: date | None = None,
) -> list[dict[str, Any]]:
    """Validate a sorted, contiguous, identity-free UTC day series."""

    if not isinstance(points, list) or not points:
        raise ActivityError(f"{label} must be a non-empty array")
    checked_today = today or datetime.now(timezone.utc).date()
    normalized: list[dict[str, Any]] = []
    previous: date | None = None
    for index, raw_point in enumerate(points):
        point = _exact_keys(
            raw_point,
            point_keys,
            f"{label}[{index}]",
            disclose_keys=False,
        )
        observed = _iso_date(point["date"], f"{label}[{index}].date")
        if observed >= checked_today:
            raise ActivityError(f"{label} must contain completed UTC dates only")
        if previous is not None and observed != previous + timedelta(days=1):
            raise ActivityError(f"{label} dates must be contiguous and increasing")
        counts = {
            metric: _count(point[metric], f"{label}[{index}].{metric}")
            for metric in METRICS
        }
        normalized.append({"date": observed.isoformat(), **counts})
        previous = observed

    first = date.fromisoformat(normalized[0]["date"])
    last = date.fromisoformat(normalized[-1]["date"])
    if starts_on is not None and first != starts_on:
        raise ActivityError(f"{label} must begin at starts_on")
    if complete_through is not None and last != complete_through:
        raise ActivityError(f"{label} must end at complete_through")
    return normalized


def validate_bridge_v2(
    source: Any,
    *,
    today: date | None = None,
) -> dict[str, Any]:
    """Validate the protected date-only work bridge without echoing its keys."""

    source = _exact_keys(
        source,
        BRIDGE_V2_KEYS,
        "protected bridge daily series",
        disclose_keys=False,
    )
    if type(source["schema"]) is not int or source["schema"] != 2:
        raise ActivityError("protected bridge daily series schema is invalid")
    through = _iso_date(source["through"], "protected bridge daily through")
    totals_source = _exact_keys(
        source["totals"],
        BRIDGE_V2_TOTAL_KEYS,
        "protected bridge daily totals",
        disclose_keys=False,
    )
    totals = {
        metric: _count(
            totals_source[metric],
            f"protected bridge daily totals {metric}",
        )
        for metric in METRICS
    }
    points = _validate_dense_daily_points(
        source["daily"],
        label="protected bridge daily points",
        point_keys=BRIDGE_V2_DAILY_KEYS,
        complete_through=through,
        today=today,
    )
    summed = {
        metric: sum(point[metric] for point in points)
        for metric in METRICS
    }
    if summed != totals:
        raise ActivityError("protected bridge daily totals do not reconcile")
    return {
        "schema": 2,
        "timezone": UTC_TIMEZONE_NAME,
        "through": through.isoformat(),
        "totals": totals,
        "daily": points,
    }


def validate_profile_daily_source(
    source: Any,
    *,
    today: date | None = None,
) -> dict[str, Any]:
    """Validate the public personal day series while retaining weekly data."""

    source = _exact_keys(source, PROFILE_V3_KEYS, "personal daily snapshot")
    if type(source["schema"]) is not int or source["schema"] != 3:
        raise ActivityError("personal daily snapshot.schema must be integer 3")

    # Reuse the established weekly validator so schema 3 cannot weaken it.
    generated_at, weeks = validate_profile_snapshot(
        {
            "schema": 2,
            "generatedAt": source["generatedAt"],
            "weeks": source["weeks"],
        }
    )
    daily = _exact_keys(
        source["daily"],
        PROFILE_V3_DAILY_KEYS,
        "personal daily snapshot.daily",
    )
    if daily["timezone"] != UTC_TIMEZONE_NAME:
        raise ActivityError("personal daily snapshot timezone is invalid")
    if daily["coverage"] != "complete":
        raise ActivityError("personal daily snapshot coverage must be complete")
    starts_on = _iso_date(
        daily["starts_on"],
        "personal daily snapshot starts_on",
    )
    complete_through = _iso_date(
        daily["complete_through"],
        "personal daily snapshot complete_through",
    )
    if complete_through < starts_on:
        raise ActivityError("personal daily snapshot coverage is reversed")
    if starts_on != PERSONAL_DAILY_HISTORY_START:
        raise ActivityError(
            "personal daily snapshot must preserve the verified five-year start"
        )
    expected_complete_through = (
        generated_at.astimezone(timezone.utc).date() - timedelta(days=1)
    )
    if complete_through != expected_complete_through:
        raise ActivityError(
            "personal daily snapshot must end on the latest completed UTC date"
        )
    points = _validate_dense_daily_points(
        daily["points"],
        label="personal daily snapshot points",
        point_keys=PROFILE_V3_DAILY_POINT_KEYS,
        starts_on=starts_on,
        complete_through=complete_through,
        today=today,
    )
    return {
        "schema": 3,
        "generatedAt": source["generatedAt"],
        "generated_at": generated_at,
        "weeks": weeks,
        "daily": {
            "timezone": UTC_TIMEZONE_NAME,
            "starts_on": starts_on.isoformat(),
            "complete_through": complete_through.isoformat(),
            "coverage": "complete",
            "points": points,
        },
    }


def _git(repo: Path, *arguments: str, label: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *arguments],
        check=False,
        capture_output=True,
        encoding="utf-8",
        errors="strict",
        text=True,
    )
    if result.returncode != 0:
        raise ActivityError(f"{label} history is unavailable")
    return result.stdout


def load_profile_history(
    repo: Path,
    *,
    data_path: str = "docs/github-activity.json",
) -> ProfileHistory:
    repo = repo.resolve()
    if not (repo / ".git").exists():
        raise ActivityError("personal snapshot repository is unavailable")
    revisions = [
        revision.strip()
        for revision in _git(
            repo,
            "log",
            "--format=%H",
            "--",
            data_path,
            label="personal snapshot",
        ).splitlines()
        if revision.strip()
    ]
    if not revisions:
        raise ActivityError("personal snapshot history is empty")

    history: ProfileHistory = []
    for revision in revisions:
        raw = _git(
            repo,
            "show",
            f"{revision}:{data_path}",
            label="personal snapshot",
        )
        try:
            candidate = json.loads(raw)
        except json.JSONDecodeError as error:
            raise ActivityError(
                "personal snapshot history contains malformed JSON"
            ) from error
        if not isinstance(candidate, dict) or candidate.get("schema") != 2:
            continue
        generated_at, rows = validate_profile_snapshot(candidate)
        history.append((_pacific_datetime(generated_at), rows))
    if not history:
        raise ActivityError("personal snapshot history has no supported snapshots")
    return history


def _profile_closure(history: ProfileHistory, target: date) -> ProfileRows:
    closure_date = target + timedelta(days=1)
    candidates = [
        (generated_at, rows)
        for generated_at, rows in history
        if generated_at.date() == closure_date
        and generated_at.hour < PROFILE_CLOSURE_HOUR_LIMIT
    ]
    if not candidates:
        raise ActivityError(
            "no just-after-midnight personal snapshot closes the target date"
        )
    # Retries inside the bounded closure window may include late API results.
    # Seal the latest such snapshot, while excluding partial manual runs later
    # in the calendar day.
    return max(candidates, key=lambda candidate: candidate[0])[1]


def _week_start(target: date) -> date:
    return target - timedelta(days=(target.weekday() + 1) % 7)


def personal_baseline_for_date(
    history: ProfileHistory,
    target: date,
) -> dict[str, int]:
    rows = _profile_closure(history, target)
    return _add_counts(*rows.values())


def personal_daily_for_date(
    history: ProfileHistory,
    target: date,
) -> dict[str, int]:
    current_rows = _profile_closure(history, target)
    previous_rows = _profile_closure(history, target - timedelta(days=1))
    week = _week_start(target)
    if week not in current_rows:
        raise ActivityError("personal snapshot is missing the target week")
    if week not in previous_rows and target.weekday() != 6:
        raise ActivityError("personal snapshot is missing the preceding week state")

    current = current_rows[week]
    previous = previous_rows.get(week, ZERO_COUNTS)
    daily: dict[str, int] = {}
    for metric in METRICS:
        if current[metric] < previous[metric]:
            raise ActivityError("personal daily activity cannot be derived safely")
        daily[metric] = current[metric] - previous[metric]
    return daily


def personal_interval_totals(
    history: ProfileHistory,
    after: date,
    through: date,
) -> dict[str, int]:
    if through <= after:
        raise ActivityError("personal activity interval must advance")
    totals = dict(ZERO_COUNTS)
    cursor = after + timedelta(days=1)
    while cursor <= through:
        totals = _add_counts(totals, personal_daily_for_date(history, cursor))
        cursor += timedelta(days=1)
    return totals


def load_bridge_history(
    repo: Path,
    *,
    data_path: str = "activity.json",
    today: date | None = None,
) -> list[dict[str, Any]]:
    repo = repo.resolve()
    if not (repo / ".git").exists():
        raise ActivityError("protected bridge repository is unavailable")
    revisions = [
        revision.strip()
        for revision in _git(
            repo,
            "log",
            "--format=%H",
            "--",
            data_path,
            label="protected bridge",
        ).splitlines()
        if revision.strip()
    ]
    if not revisions:
        raise ActivityError("protected bridge history is empty")

    history: list[dict[str, Any]] = []
    for revision in revisions:
        raw = _git(
            repo,
            "show",
            f"{revision}:{data_path}",
            label="protected bridge",
        )
        try:
            candidate = json.loads(raw)
        except json.JSONDecodeError as error:
            raise ActivityError(
                "protected bridge history contains malformed JSON"
            ) from error
        history.append(validate_bridge(candidate, today=today))
    return history


def bridge_totals_for_date(
    history: list[dict[str, Any]],
    target: date,
) -> dict[str, Any]:
    target_label = target.isoformat()
    for snapshot in history:
        if snapshot["date"] == target_label:
            return snapshot
    raise ActivityError("protected bridge history is missing a required date")


def validate_public_snapshot(
    source: Any,
    *,
    today: date | None = None,
) -> dict[str, Any]:
    source = _exact_keys(source, PUBLIC_KEYS, "public snapshot series")
    if (
        not isinstance(source["schema"], int)
        or isinstance(source["schema"], bool)
        or source["schema"] != 1
    ):
        raise ActivityError("public snapshot series.schema must be integer 1")
    if source["timezone"] != TIMEZONE_NAME:
        raise ActivityError("public snapshot series.timezone is invalid")
    if source["scope"] != "combined_code_activity":
        raise ActivityError("public snapshot series.scope is invalid")
    if source["aggregation"] != "cumulative_daily_snapshots":
        raise ActivityError("public snapshot series.aggregation is invalid")

    points = source["points"]
    if not isinstance(points, list) or not points:
        raise ActivityError("public snapshot series.points must be non-empty")
    checked_today = today or _today()
    previous_date: date | None = None
    previous_counts: dict[str, int] | None = None
    normalized_points: list[dict[str, Any]] = []
    for index, raw_point in enumerate(points):
        point = _exact_keys(
            raw_point,
            PUBLIC_POINT_KEYS,
            f"public snapshot series.points[{index}]",
        )
        observed = _iso_date(
            point["date"],
            f"public snapshot series.points[{index}].date",
        )
        if observed > checked_today:
            raise ActivityError("public snapshot series contains a future date")
        if previous_date is not None and observed <= previous_date:
            raise ActivityError("public snapshot dates must be strictly increasing")
        counts = {
            metric: _count(
                point[metric],
                f"public snapshot series.points[{index}].{metric}",
            )
            for metric in METRICS
        }
        if previous_counts is not None and any(
            counts[metric] < previous_counts[metric] for metric in METRICS
        ):
            raise ActivityError("public cumulative counts cannot decrease")
        normalized_points.append({"date": observed.isoformat(), **counts})
        previous_date = observed
        previous_counts = counts

    updated_on = _iso_date(
        source["updated_on"],
        "public snapshot series.updated_on",
    )
    if updated_on != previous_date:
        raise ActivityError(
            "public snapshot series.updated_on must match its last point"
        )
    return {
        "schema": 1,
        "timezone": TIMEZONE_NAME,
        "scope": "combined_code_activity",
        "aggregation": "cumulative_daily_snapshots",
        "updated_on": updated_on.isoformat(),
        "points": normalized_points,
    }


def validate_public_v2(
    source: Any,
    *,
    today: date | None = None,
) -> dict[str, Any]:
    """Validate the public combined lifetime plus exact UTC day contract."""

    source = _exact_keys(source, PUBLIC_V2_KEYS, "public combined activity")
    if type(source["schema"]) is not int or source["schema"] != 2:
        raise ActivityError("public combined activity.schema must be integer 2")
    if source["timezone"] != UTC_TIMEZONE_NAME:
        raise ActivityError("public combined activity.timezone is invalid")

    lifetime_source = _exact_keys(
        source["lifetime"],
        PUBLIC_V2_LIFETIME_KEYS,
        "public combined activity.lifetime",
    )
    lifetime_through = _iso_date(
        lifetime_source["through"],
        "public combined activity lifetime through",
    )
    lifetime = {
        "through": lifetime_through.isoformat(),
        **{
            metric: _count(
                lifetime_source[metric],
                f"public combined activity lifetime {metric}",
            )
            for metric in METRICS
        },
    }

    daily_source = _exact_keys(
        source["daily"],
        PUBLIC_V2_DAILY_KEYS,
        "public combined activity.daily",
    )
    starts_on = _iso_date(
        daily_source["starts_on"],
        "public combined activity daily starts_on",
    )
    complete_through = _iso_date(
        daily_source["complete_through"],
        "public combined activity daily complete_through",
    )
    points = _validate_dense_daily_points(
        daily_source["points"],
        label="public combined activity daily points",
        point_keys=PUBLIC_V2_POINT_KEYS,
        starts_on=starts_on,
        complete_through=complete_through,
        today=today,
    )
    if lifetime_through != complete_through:
        raise ActivityError(
            "public combined lifetime and daily coverage must share a through date"
        )
    updated_on = _iso_date(
        source["updated_on"],
        "public combined activity.updated_on",
    )
    if updated_on != complete_through:
        raise ActivityError(
            "public combined activity.updated_on must match complete_through"
        )
    return {
        "schema": 2,
        "updated_on": updated_on.isoformat(),
        "timezone": UTC_TIMEZONE_NAME,
        "lifetime": lifetime,
        "daily": {
            "starts_on": starts_on.isoformat(),
            "complete_through": complete_through.isoformat(),
            "points": points,
        },
    }


def _daily_map(points: list[dict[str, Any]]) -> dict[date, dict[str, int]]:
    return {
        date.fromisoformat(point["date"]): {
            metric: point[metric]
            for metric in METRICS
        }
        for point in points
    }


def _combined_dense_days(
    personal: dict[str, Any],
    bridge: dict[str, Any],
) -> tuple[date, date, list[dict[str, Any]]]:
    personal_daily = personal["daily"]
    personal_start = date.fromisoformat(personal_daily["starts_on"])
    bridge_start = date.fromisoformat(bridge["daily"][0]["date"])
    # A zero is publishable only where both validated producers explicitly
    # cover the date. Never extend the shorter source with guessed zeroes.
    starts_on = max(personal_start, bridge_start)
    complete_through = min(
        date.fromisoformat(personal_daily["complete_through"]),
        date.fromisoformat(bridge["through"]),
    )
    if complete_through < starts_on:
        raise ActivityError("daily source coverage does not overlap")

    personal_rows = _daily_map(personal_daily["points"])
    bridge_rows = _daily_map(bridge["daily"])
    points: list[dict[str, Any]] = []
    cursor = starts_on
    while cursor <= complete_through:
        points.append(
            {
                "date": cursor.isoformat(),
                **_add_counts(
                    personal_rows[cursor],
                    bridge_rows[cursor],
                ),
            }
        )
        cursor += timedelta(days=1)
    return starts_on, complete_through, points


def _migration_lifetime(
    previous: dict[str, Any] | None,
    points: list[dict[str, Any]],
    complete_through: date,
    *,
    today: date | None = None,
) -> dict[str, Any]:
    """Preserve the frozen legacy anchor and replay exact post-anchor days."""

    if previous is None:
        raise ActivityError(
            "public lifetime baseline is required for schema 2 migration"
        )
    if previous.get("schema") == 1:
        checked_legacy = validate_public_snapshot(previous, today=today)
        baseline = checked_legacy["points"][-1]
        baseline_date = date.fromisoformat(baseline["date"])
        if baseline_date != LIFETIME_MIGRATION_BASELINE_DATE:
            raise ActivityError(
                "legacy lifetime baseline does not match the migration anchor"
            )
        totals = {
            metric: baseline[metric]
            for metric in METRICS
        }
        old_points: list[dict[str, Any]] = []
    elif previous.get("schema") == 2:
        checked_v2 = validate_public_v2(previous, today=today)
        baseline = checked_v2["lifetime"]
        baseline_date = LIFETIME_MIGRATION_BASELINE_DATE
        totals = {
            metric: baseline[metric]
            for metric in METRICS
        }
        old_points = checked_v2["daily"]["points"]
        if (
            checked_v2["daily"]["starts_on"]
            != points[0]["date"]
        ):
            raise ActivityError(
                "combined daily coverage start cannot change after migration"
            )
        previous_through = date.fromisoformat(
            checked_v2["lifetime"]["through"]
        )
        if complete_through < previous_through:
            raise ActivityError(
                "combined daily coverage cannot move backward"
            )
        if old_points[-1]["date"] != previous_through.isoformat():
            raise ActivityError(
                "combined lifetime cutoff must match the previous daily series"
            )
        # Recover the immutable legacy totals by removing every exact day that
        # the prior v2 publication had already applied after the anchor.
        for metric in METRICS:
            totals[metric] -= sum(
                point[metric]
                for point in old_points
                if date.fromisoformat(point["date"]) > baseline_date
            )
            if totals[metric] < 0:
                raise ActivityError(
                    "combined lifetime cannot fall below its migration anchor"
                )
    else:
        raise ActivityError("unsupported public lifetime baseline schema")

    if complete_through < baseline_date:
        raise ActivityError("combined daily coverage cannot regress")
    if date.fromisoformat(points[0]["date"]) > baseline_date:
        raise ActivityError(
            "combined daily coverage must include the migration anchor"
        )
    for metric in METRICS:
        totals[metric] += sum(
            point[metric]
            for point in points
            if date.fromisoformat(point["date"]) > baseline_date
        )
        totals[metric] = _count(
            totals[metric],
            f"combined lifetime {metric}",
        )
    return {
        "through": complete_through.isoformat(),
        **totals,
    }


def build_public_v2(
    personal_source: Any,
    bridge_source: Any,
    *,
    previous: Any,
    today: date | None = None,
) -> tuple[dict[str, Any], bool]:
    """Merge validated personal/work UTC days into the public v2 contract."""

    personal = validate_profile_daily_source(personal_source, today=today)
    bridge = validate_bridge_v2(bridge_source, today=today)
    starts_on, complete_through, points = _combined_dense_days(
        personal,
        bridge,
    )
    lifetime = _migration_lifetime(
        previous,
        points,
        complete_through,
        today=today,
    )
    payload = validate_public_v2(
        {
            "schema": 2,
            "updated_on": complete_through.isoformat(),
            "timezone": UTC_TIMEZONE_NAME,
            "lifetime": lifetime,
            "daily": {
                "starts_on": starts_on.isoformat(),
                "complete_through": complete_through.isoformat(),
                "points": points,
            },
        },
        today=today,
    )
    if previous is not None and previous.get("schema") == 2:
        return payload, payload != validate_public_v2(previous, today=today)
    return payload, True


def preserve_last_good_during_source_migration(
    personal_source: Any,
    bridge_source: Any,
    *,
    previous: Any,
    today: date | None = None,
) -> tuple[dict[str, Any], bool]:
    """Validate a one-producer migration and keep the legacy public snapshot."""

    if previous is None:
        raise ActivityError(
            "public lifetime baseline is required during source migration"
        )
    if isinstance(previous, dict) and previous.get("schema") == 1:
        checked_previous = validate_public_snapshot(previous, today=today)
    elif isinstance(previous, dict) and previous.get("schema") == 2:
        checked_previous = validate_public_v2(previous, today=today)
    else:
        raise ActivityError("unsupported public lifetime baseline schema")
    personal_schema = (
        personal_source.get("schema")
        if isinstance(personal_source, dict)
        else None
    )
    bridge_schema = (
        bridge_source.get("schema")
        if isinstance(bridge_source, dict)
        else None
    )
    if personal_schema == 2 and bridge_schema == 2:
        validate_profile_snapshot(personal_source)
        validate_bridge_v2(bridge_source, today=today)
    elif personal_schema == 3 and bridge_schema == 1:
        validate_profile_daily_source(personal_source, today=today)
        validate_bridge(bridge_source, today=today)
    else:
        raise ActivityError(
            "personal and protected bridge schemas must migrate together"
        )
    return checked_previous, False


def _base_point_for_target(
    previous: dict[str, Any] | None,
    target: date,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if previous is None:
        return None, None
    last = previous["points"][-1]
    last_date = date.fromisoformat(last["date"])
    if target < last_date:
        raise ActivityError("combined snapshot date regression is not allowed")
    if target > last_date:
        return last, None
    if len(previous["points"]) == 1:
        return None, last
    return previous["points"][-2], last


def build_public_snapshot(
    personal_counts: dict[str, int],
    bridge: dict[str, Any],
    *,
    previous: Any | None = None,
    bridge_base: dict[str, Any] | None = None,
    today: date | None = None,
) -> tuple[dict[str, Any], bool]:
    bridge = validate_bridge(bridge, today=today)
    current = (
        validate_public_snapshot(previous, today=today)
        if previous is not None
        else None
    )
    target = date.fromisoformat(bridge["date"])
    base, replaced = _base_point_for_target(current, target)

    if base is None:
        point_counts = _add_counts(personal_counts, bridge)
        prefix: list[dict[str, Any]] = []
    else:
        if bridge_base is None:
            raise ActivityError("protected bridge baseline is unavailable")
        bridge_base = validate_bridge(bridge_base, today=today)
        if bridge_base["date"] != base["date"]:
            raise ActivityError("protected bridge baseline date does not match")
        bridge_delta: dict[str, int] = {}
        for metric in METRICS:
            if bridge[metric] < bridge_base[metric]:
                raise ActivityError("protected cumulative counts cannot decrease")
            bridge_delta[metric] = bridge[metric] - bridge_base[metric]
        point_counts = _add_counts(base, personal_counts, bridge_delta)
        prefix = [
            point
            for point in current["points"]
            if point["date"] <= base["date"]
        ]

    point = {"date": bridge["date"], **point_counts}
    if replaced is not None:
        if any(point[metric] < replaced[metric] for metric in METRICS):
            raise ActivityError("same-day combined counts cannot decrease")
        if point == replaced:
            return current, False

    payload = {
        "schema": 1,
        "timezone": TIMEZONE_NAME,
        "scope": "combined_code_activity",
        "aggregation": "cumulative_daily_snapshots",
        "updated_on": point["date"],
        "points": [*prefix, point],
    }
    return validate_public_snapshot(payload, today=today), True


def _serialized(payload: dict[str, Any]) -> bytes:
    return (
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    ).encode("utf-8")


def render_combined_svg(payload: Any) -> str:
    """Render the same public v2 contract as a GitHub-profile-safe SVG."""

    source = validate_public_v2(payload)
    points = source["daily"]["points"]
    width = 960
    height = 520
    left = 72
    right = 24
    chart_width = width - left - right
    commit_top = 214
    commit_bottom = 298
    line_top = 356
    line_bottom = 450
    line_baseline = (line_top + line_bottom) / 2
    maximum_commits = max(point["commits"] for point in points) or 1
    maximum_lines = max(
        max(point["additions"], point["deletions"])
        for point in points
    ) or 1
    commit_scale = math.log1p(maximum_commits)
    line_scale = math.log1p(maximum_lines)

    def x(index: int) -> float:
        if len(points) == 1:
            return left + chart_width / 2
        return left + (index / (len(points) - 1)) * chart_width

    def commit_y(value: int) -> float:
        return commit_bottom - (
            math.log1p(value) / commit_scale
        ) * (commit_bottom - commit_top)

    def line_y(value: int) -> float:
        direction = 1 if value >= 0 else -1
        ratio = math.log1p(abs(value)) / line_scale
        half = (line_bottom - line_top) / 2
        return line_baseline - direction * ratio * half

    def path(values: list[tuple[float, float]]) -> str:
        return " ".join(
            f"{'M' if index == 0 else 'L'} {xx:.2f} {yy:.2f}"
            for index, (xx, yy) in enumerate(values)
        )

    commit_path = path(
        [
            (x(index), commit_y(point["commits"]))
            for index, point in enumerate(points)
        ]
    )
    added_path = path(
        [
            (x(index), line_y(point["additions"]))
            for index, point in enumerate(points)
        ]
    )
    removed_path = path(
        [
            (x(index), line_y(-point["deletions"]))
            for index, point in enumerate(points)
        ]
    )
    lifetime = source["lifetime"]
    first_label = date.fromisoformat(
        source["daily"]["starts_on"]
    ).strftime("%b %Y")
    last_label = date.fromisoformat(
        source["daily"]["complete_through"]
    ).strftime("%b %Y")
    through_format = "%b %#d, %Y" if os.name == "nt" else "%b %-d, %Y"
    through_label = date.fromisoformat(
        lifetime["through"]
    ).strftime(through_format)

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
  <title id="title">Combined daily code activity</title>
  <desc id="desc">Combined lifetime commits, additions, and deletions followed by exact identity-free daily code activity through {through_label}.</desc>
  <style>
    :root{{--bg:#fffefd;--fg:#211a16;--muted:#6d6a62;--grid:rgba(90,88,72,.16);--commit:#a65318;--add:#357f9e;--remove:#387768}}
    @media(prefers-color-scheme:dark){{:root{{--bg:#12181b;--fg:#f7f1ea;--muted:#c8d0cc;--grid:rgba(154,196,205,.16);--commit:#ffb15f;--add:#b8e2f0;--remove:#b4e4d0}}}}
    text{{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:var(--fg)}} .mono{{font-family:"Source Code Pro","SFMono-Regular",Consolas,monospace;font-variant-numeric:tabular-nums}} .muted{{fill:var(--muted)}} .eyebrow{{font-size:11px;font-weight:700;letter-spacing:1.2px}} .title{{font-size:27px;font-weight:700}} .metric{{font-size:27px;font-weight:700}} .label{{font-size:11px;font-weight:650;letter-spacing:.5px;fill:var(--muted)}} .axis{{font-size:10px;fill:var(--muted)}} .grid{{stroke:var(--grid);stroke-width:1}} .commit{{fill:none;stroke:var(--commit);stroke-width:1.7}} .add{{fill:none;stroke:var(--add);stroke-width:1.7}} .remove{{fill:none;stroke:var(--remove);stroke-width:1.7;stroke-dasharray:4 2}}
  </style>
  <rect width="{width}" height="{height}" rx="18" fill="var(--bg)"/>
  <text class="eyebrow mono muted" x="32" y="34">COMBINED CODE ACTIVITY</text>
  <text class="title" x="32" y="70">Daily code history</text>
  <text class="muted" x="32" y="94">Identity-free date totals across connected personal and work accounts · through {through_label}</text>
  <g aria-label="Combined lifetime code activity">
    <text class="metric mono" x="32" y="144">{lifetime['commits']:,}</text><text class="label mono" x="32" y="164">COMMITS</text>
    <text class="metric mono" x="338" y="144">+{lifetime['additions']:,}</text><text class="label mono" x="338" y="164">LINES ADDED</text>
    <text class="metric mono" x="650" y="144">−{lifetime['deletions']:,}</text><text class="label mono" x="650" y="164">LINES REMOVED</text>
  </g>
  <line class="grid" x1="{left}" y1="{commit_bottom}" x2="{width-right}" y2="{commit_bottom}"/>
  <line class="grid" x1="{left}" y1="{line_baseline:.2f}" x2="{width-right}" y2="{line_baseline:.2f}"/>
  <text class="label mono" x="{left}" y="198">COMMITS / DAY · READABLE LOG1P</text>
  <path class="commit" d="{commit_path}"/>
  <text class="label mono" x="{left}" y="338">LINES CHANGED / DAY · READABLE SYMLOG</text>
  <text class="label mono" x="{width-right}" y="338" text-anchor="end"><tspan fill="var(--add)">+ ADDED</tspan><tspan>   </tspan><tspan fill="var(--remove)">− REMOVED</tspan></text>
  <path class="add" d="{added_path}"/>
  <path class="remove" d="{removed_path}"/>
  <text class="axis mono" x="{left}" y="472">{first_label}</text>
  <text class="axis mono" x="{width-right}" y="472" text-anchor="end">{last_label}</text>
  <text class="muted" x="32" y="500">Some totals include other internship or work accounts; only dates and aggregate counts are published.</text>
</svg>
"""


def publish_atomically(path: Path, payload: dict[str, Any]) -> bool:
    content = _serialized(payload)
    if path.exists() and path.read_bytes() == content:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    return True


def _staged_file(path: Path, content: bytes) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
    except Exception:
        Path(temporary_name).unlink(missing_ok=True)
        raise
    return Path(temporary_name)


def publish_outputs_atomically(
    repo_root: Path,
    payload: dict[str, Any],
) -> bool:
    """Publish Jekyll data plus public JSON/SVG as one recoverable set."""

    serialized = _serialized(payload)
    svg = render_combined_svg(payload).encode("utf-8")
    targets = {
        repo_root / "_data" / "combined_code_activity.json": serialized,
        repo_root / "assets" / "data" / "combined-code-activity.json": serialized,
        repo_root / "assets" / "data" / "combined-code-activity.svg": svg,
    }
    if all(
        path.exists() and path.read_bytes() == content
        for path, content in targets.items()
    ):
        return False
    originals = {
        path: path.read_bytes() if path.exists() else None
        for path in targets
    }
    staged: dict[Path, Path] = {}
    try:
        for path, content in targets.items():
            staged[path] = _staged_file(path, content)
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
    return True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--personal-repo",
        type=Path,
        required=True,
        help="full-history checkout of the public personal metrics repository",
    )
    parser.add_argument(
        "--bridge-repo",
        type=Path,
        required=True,
        help="full-history checkout of the protected aggregate bridge",
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="validate and build the next snapshot without writing",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    output = repo_root / "_data" / "combined_code_activity.json"
    try:
        bridge_source = json.loads(
            (args.bridge_repo / "activity.json").read_text(
                encoding="utf-8"
            )
        )
        profile_source = json.loads(
            (
                args.personal_repo / "docs" / "github-activity.json"
            ).read_text(encoding="utf-8")
        )
        previous = (
            json.loads(output.read_text(encoding="utf-8"))
            if output.exists()
            else None
        )

        if (
            isinstance(bridge_source, dict)
            and bridge_source.get("schema") == 2
            and isinstance(profile_source, dict)
            and profile_source.get("schema") == 3
        ):
            payload, changed = build_public_v2(
                profile_source,
                bridge_source,
                previous=previous,
            )
        elif (
            isinstance(bridge_source, dict)
            and bridge_source.get("schema") == 1
            and isinstance(profile_source, dict)
            and profile_source.get("schema") == 2
        ):
            bridge_history = load_bridge_history(args.bridge_repo)
            bridge = validate_bridge(bridge_source)
            if bridge != bridge_history[0]:
                raise ActivityError(
                    "protected bridge checkout is not at its latest state"
                )
            profile_history = load_profile_history(args.personal_repo)
            checked_previous = (
                validate_public_snapshot(previous)
                if previous is not None
                else None
            )
            target = date.fromisoformat(bridge["date"])
            base, _ = _base_point_for_target(
                checked_previous,
                target,
            )
            if base is None:
                personal_counts = personal_baseline_for_date(
                    profile_history,
                    target,
                )
                bridge_base = None
            else:
                base_date = date.fromisoformat(base["date"])
                personal_counts = personal_interval_totals(
                    profile_history,
                    base_date,
                    target,
                )
                bridge_base = bridge_totals_for_date(
                    bridge_history,
                    base_date,
                )
            payload, changed = build_public_snapshot(
                personal_counts,
                bridge,
                previous=checked_previous,
                bridge_base=bridge_base,
            )
        elif (
            isinstance(bridge_source, dict)
            and isinstance(profile_source, dict)
            and (
                profile_source.get("schema"),
                bridge_source.get("schema"),
            )
            in {(2, 2), (3, 1)}
        ):
            payload, changed = preserve_last_good_during_source_migration(
                profile_source,
                bridge_source,
                previous=previous,
            )
        else:
            raise ActivityError(
                "personal and protected bridge schemas must migrate together"
            )
        if not args.check:
            if payload["schema"] == 2:
                changed = publish_outputs_atomically(repo_root, payload) or changed
            elif changed:
                publish_atomically(output, payload)
    except (OSError, json.JSONDecodeError, ActivityError) as error:
        print(
            f"combined code activity rejected: {error}",
            file=__import__("sys").stderr,
        )
        return 1
    print(
        "combined code activity valid"
        if not changed
        else "combined code activity updated"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
