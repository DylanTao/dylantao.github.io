#!/usr/bin/env python3
"""Publish validated daily code activity as one multi-source public series.

The importer accepts the schema-4 personal GitHub profile snapshot plus any
number of contributed source snapshots, and projects them into a single public
file whose points are keyed by named source. It publishes only completed UTC
days and never replaces a previously valid snapshot when validation fails.

Adding a source is a data change, not a code change: drop a validated snapshot
into `_data/code_activity_sources/<id>.json` and it joins the published series
under its own label.
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any


JAVASCRIPT_SAFE_INTEGER = 9_007_199_254_740_991

# `commits` is every commit GitHub credits, so a published total reconciles with
# the profile graph. `authored_commits` is the non-merge, non-deploy subset that
# owns the line counts. Counting a merge's or a deploy's lines would report
# restated branch content and generated site output as written work.
METRICS = ("commits", "authored_commits", "additions", "deletions")

PERSONAL_SOURCE_ID = "personal"
PERSONAL_SOURCE_LABEL = "Personal"
PERSONAL_SOURCE_BASIS = "github_contribution_parity"

# The lifetime anchor is pinned in the collector; the importer only checks that
# the snapshot it is handed still starts there, so a truncated scan is rejected
# instead of silently shortening published history.
PERSONAL_HISTORY_START = date(2017, 8, 31)

PROFILE_KEYS = {"schema", "generatedAt", "source", "weeks", "daily"}
PROFILE_SOURCE_KEYS = {"id", "label", "basis"}
WEEK_KEYS = {"week", *METRICS}
DAILY_KEYS = {"timezone", "starts_on", "complete_through", "coverage", "points"}
POINT_KEYS = {"date", *METRICS}

CONTRIBUTED_KEYS = {
    "schema",
    "id",
    "label",
    "basis",
    "timezone",
    "coverage",
    "points",
}
COVERAGE_KEYS = {"starts_on", "complete_through", "status"}

PUBLIC_KEYS = {
    "schema",
    "updated_on",
    "timezone",
    "scope",
    "sources",
    "coverage",
    "points",
}
PUBLIC_SOURCE_KEYS = {"id", "label", "basis", "starts_on", "complete_through"}

# Source ids are used as object keys in the published points and as CSS-facing
# identifiers in the chart, so they stay short, lowercase and unambiguous.
SOURCE_ID_CHARACTERS = set("abcdefghijklmnopqrstuvwxyz0123456789-")


class ActivityError(ValueError):
    """Raised when code activity cannot be safely published."""


def _exact_dict(value: Any, keys: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != keys:
        raise ActivityError(f"{label} must contain only the documented fields")
    return value


def _iso_date(value: Any, label: str) -> date:
    if not isinstance(value, str):
        raise ActivityError(f"{label} must be an ISO date")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise ActivityError(f"{label} must be an ISO date") from error
    if parsed.isoformat() != value:
        raise ActivityError(f"{label} must use YYYY-MM-DD")
    return parsed


def _timestamp(value: Any, label: str) -> datetime:
    if not isinstance(value, str):
        raise ActivityError(f"{label} must be an ISO timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ActivityError(f"{label} must be an ISO timestamp") from error
    if parsed.tzinfo is None:
        raise ActivityError(f"{label} must include a timezone")
    return parsed


def _count(value: Any, label: str) -> int:
    if type(value) is not int or value < 0 or value > JAVASCRIPT_SAFE_INTEGER:
        raise ActivityError(f"{label} must be a safe nonnegative integer")
    return value


def _text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ActivityError(f"{label} must be trimmed, non-empty text")
    return value


def _source_id(value: Any, label: str) -> str:
    identifier = _text(value, label)
    if len(identifier) > 24 or set(identifier) - SOURCE_ID_CHARACTERS:
        raise ActivityError(f"{label} must be a short lowercase slug")
    return identifier


def _metrics(row: Any, label: str) -> dict[str, int]:
    counts = {metric: _count(row[metric], f"{label}.{metric}") for metric in METRICS}
    if counts["authored_commits"] > counts["commits"]:
        raise ActivityError(f"{label} authored commits exceed counted commits")
    if not counts["authored_commits"] and (counts["additions"] or counts["deletions"]):
        raise ActivityError(f"{label} reports lines without an authored commit")
    return counts


def _validate_points(
    value: Any,
    *,
    starts_on: date,
    complete_through: date,
    today: date,
    label: str,
) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not value:
        raise ActivityError(f"{label} must be a non-empty array")

    expected_length = (complete_through - starts_on).days + 1
    if len(value) != expected_length:
        raise ActivityError(f"{label} must cover every UTC date")

    normalized: list[dict[str, Any]] = []
    expected = starts_on
    for index, raw_point in enumerate(value):
        point = _exact_dict(raw_point, POINT_KEYS, f"{label}[{index}]")
        observed = _iso_date(point["date"], f"{label}[{index}].date")
        if observed != expected:
            raise ActivityError(f"{label} dates must be contiguous and increasing")
        if observed >= today:
            raise ActivityError(f"{label} must contain completed UTC dates only")
        normalized.append(
            {"date": observed.isoformat(), **_metrics(point, f"{label}[{index}]")}
        )
        expected += timedelta(days=1)
    return normalized


def _validate_coverage(value: Any, label: str) -> tuple[date, date]:
    coverage = _exact_dict(value, COVERAGE_KEYS, label)
    if coverage["status"] != "complete":
        raise ActivityError(f"{label} status must be complete")
    starts_on = _iso_date(coverage["starts_on"], f"{label}.starts_on")
    complete_through = _iso_date(
        coverage["complete_through"], f"{label}.complete_through"
    )
    if complete_through < starts_on:
        raise ActivityError(f"{label} is reversed")
    return starts_on, complete_through


def _validate_weeks(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not value:
        raise ActivityError("personal profile weeks must be a non-empty array")

    previous: date | None = None
    for index, raw_row in enumerate(value):
        row = _exact_dict(raw_row, WEEK_KEYS, f"personal profile weeks[{index}]")
        observed = _iso_date(row["week"], f"personal profile weeks[{index}].week")
        if observed.weekday() != 6:
            raise ActivityError("personal profile week dates must be Sundays")
        if previous is not None and observed != previous + timedelta(days=7):
            raise ActivityError("personal profile week dates must be contiguous")
        _metrics(row, f"personal profile weeks[{index}]")
        previous = observed
    return value


def validate_profile_snapshot(
    value: Any,
    *,
    today: date | None = None,
) -> dict[str, Any]:
    """Validate the exact schema-4 personal GitHub source contract."""

    checked_today = today or datetime.now(timezone.utc).date()
    source = _exact_dict(value, PROFILE_KEYS, "personal profile")
    if type(source["schema"]) is not int or source["schema"] != 4:
        raise ActivityError("personal profile schema must be integer 4")

    descriptor = _exact_dict(
        source["source"], PROFILE_SOURCE_KEYS, "personal profile source"
    )
    if descriptor["id"] != PERSONAL_SOURCE_ID:
        raise ActivityError("personal profile source id is unexpected")
    if descriptor["basis"] != PERSONAL_SOURCE_BASIS:
        raise ActivityError("personal profile source basis is unexpected")
    _text(descriptor["label"], "personal profile source label")

    generated_at = _timestamp(source["generatedAt"], "personal profile generatedAt")
    if generated_at.astimezone(timezone.utc).date() > checked_today:
        raise ActivityError("personal profile generatedAt cannot be future")
    _validate_weeks(source["weeks"])

    daily = _exact_dict(source["daily"], DAILY_KEYS, "personal profile daily")
    if daily["timezone"] != "UTC":
        raise ActivityError("personal profile daily timezone must be UTC")
    if daily["coverage"] != "complete":
        raise ActivityError("personal profile daily coverage must be complete")
    starts_on = _iso_date(daily["starts_on"], "personal profile daily starts_on")
    complete_through = _iso_date(
        daily["complete_through"], "personal profile daily complete_through"
    )
    if starts_on != PERSONAL_HISTORY_START:
        raise ActivityError("personal profile must start at the lifetime anchor")
    expected_complete_through = (
        generated_at.astimezone(timezone.utc).date() - timedelta(days=1)
    )
    if complete_through != expected_complete_through:
        raise ActivityError(
            "personal profile must end on the latest completed UTC date"
        )

    points = _validate_points(
        daily["points"],
        starts_on=starts_on,
        complete_through=complete_through,
        today=checked_today,
        label="personal profile daily points",
    )
    return {
        "id": PERSONAL_SOURCE_ID,
        "label": descriptor["label"],
        "basis": PERSONAL_SOURCE_BASIS,
        "starts_on": starts_on.isoformat(),
        "complete_through": complete_through.isoformat(),
        "points": points,
    }


def validate_contributed_snapshot(
    value: Any,
    *,
    today: date | None = None,
) -> dict[str, Any]:
    """Validate one contributed daily source, such as an anonymized work feed.

    A contributed snapshot carries counts and dates only. It never carries a
    repository, employer, account or commit identifier, so it can be published
    beside personal history without disclosing where the work happened.
    """

    checked_today = today or datetime.now(timezone.utc).date()
    source = _exact_dict(value, CONTRIBUTED_KEYS, "contributed source")
    if type(source["schema"]) is not int or source["schema"] != 1:
        raise ActivityError("contributed source schema must be integer 1")
    if source["timezone"] != "UTC":
        raise ActivityError("contributed source timezone must be UTC")

    identifier = _source_id(source["id"], "contributed source id")
    if identifier == PERSONAL_SOURCE_ID:
        raise ActivityError("contributed source cannot reuse the personal id")
    label = _text(source["label"], "contributed source label")
    basis = _text(source["basis"], "contributed source basis")

    starts_on, complete_through = _validate_coverage(
        source["coverage"], "contributed source coverage"
    )
    points = _validate_points(
        source["points"],
        starts_on=starts_on,
        complete_through=complete_through,
        today=checked_today,
        label="contributed source points",
    )
    return {
        "id": identifier,
        "label": label,
        "basis": basis,
        "starts_on": starts_on.isoformat(),
        "complete_through": complete_through.isoformat(),
        "points": points,
    }


def merge_sources(sources: list[dict[str, Any]]) -> dict[str, Any]:
    """Project validated sources into the published multi-source contract.

    Points are dense across the union of every source's coverage. A point
    carries one entry per source whose own coverage contains that date, so a
    source that starts late is absent rather than padded with misleading zeroes.
    """

    if not sources:
        raise ActivityError("at least one code activity source is required")
    identifiers = [source["id"] for source in sources]
    if len(set(identifiers)) != len(identifiers):
        raise ActivityError("code activity source ids must be unique")

    starts_on = min(date.fromisoformat(source["starts_on"]) for source in sources)
    complete_through = max(
        date.fromisoformat(source["complete_through"]) for source in sources
    )

    indexed = {
        source["id"]: {point["date"]: point for point in source["points"]}
        for source in sources
    }

    points: list[dict[str, Any]] = []
    cursor = starts_on
    while cursor <= complete_through:
        key = cursor.isoformat()
        row: dict[str, Any] = {"date": key}
        for source in sources:
            point = indexed[source["id"]].get(key)
            if point is not None:
                row[source["id"]] = {metric: point[metric] for metric in METRICS}
        points.append(row)
        cursor += timedelta(days=1)

    return {
        "schema": 4,
        "updated_on": complete_through.isoformat(),
        "timezone": "UTC",
        "scope": "code_activity",
        "sources": [
            {key: source[key] for key in PUBLIC_SOURCE_KEYS} for source in sources
        ],
        "coverage": {
            "starts_on": starts_on.isoformat(),
            "complete_through": complete_through.isoformat(),
            "status": "complete",
        },
        "points": points,
    }


def validate_public_snapshot(
    value: Any,
    *,
    today: date | None = None,
) -> dict[str, Any]:
    """Validate a published multi-source snapshot."""

    checked_today = today or datetime.now(timezone.utc).date()
    source = _exact_dict(value, PUBLIC_KEYS, "public snapshot")
    if type(source["schema"]) is not int or source["schema"] != 4:
        raise ActivityError("public snapshot schema must be 4")
    if source["timezone"] != "UTC":
        raise ActivityError("public snapshot timezone must be UTC")
    if source["scope"] != "code_activity":
        raise ActivityError("public snapshot scope is invalid")

    raw_sources = source["sources"]
    if not isinstance(raw_sources, list) or not raw_sources:
        raise ActivityError("public snapshot must declare at least one source")

    windows: dict[str, tuple[date, date]] = {}
    for index, raw_source in enumerate(raw_sources):
        descriptor = _exact_dict(
            raw_source, PUBLIC_SOURCE_KEYS, f"public snapshot sources[{index}]"
        )
        identifier = _source_id(
            descriptor["id"], f"public snapshot sources[{index}].id"
        )
        if identifier in windows:
            raise ActivityError("public snapshot source ids must be unique")
        _text(descriptor["label"], f"public snapshot sources[{index}].label")
        _text(descriptor["basis"], f"public snapshot sources[{index}].basis")
        source_start = _iso_date(
            descriptor["starts_on"], f"public snapshot sources[{index}].starts_on"
        )
        source_end = _iso_date(
            descriptor["complete_through"],
            f"public snapshot sources[{index}].complete_through",
        )
        if source_end < source_start:
            raise ActivityError(f"public snapshot sources[{index}] is reversed")
        windows[identifier] = (source_start, source_end)

    starts_on, complete_through = _validate_coverage(
        source["coverage"], "public snapshot coverage"
    )
    if starts_on != min(window[0] for window in windows.values()):
        raise ActivityError("public snapshot coverage must start with its sources")
    if complete_through != max(window[1] for window in windows.values()):
        raise ActivityError("public snapshot coverage must end with its sources")
    if source["updated_on"] != complete_through.isoformat():
        raise ActivityError("public snapshot updated_on must match coverage")

    raw_points = source["points"]
    if not isinstance(raw_points, list) or not raw_points:
        raise ActivityError("public snapshot points must be a non-empty array")
    if len(raw_points) != (complete_through - starts_on).days + 1:
        raise ActivityError("public snapshot points must cover every UTC date")

    points: list[dict[str, Any]] = []
    expected = starts_on
    for index, raw_point in enumerate(raw_points):
        label = f"public snapshot points[{index}]"
        if not isinstance(raw_point, dict) or "date" not in raw_point:
            raise ActivityError(f"{label} must be a dated object")
        observed = _iso_date(raw_point["date"], f"{label}.date")
        if observed != expected:
            raise ActivityError("public snapshot dates must be contiguous")
        if observed >= checked_today:
            raise ActivityError("public snapshot must contain completed days only")
        expected_ids = {
            identifier
            for identifier, (start, end) in windows.items()
            if start <= observed <= end
        }
        if set(raw_point) != {"date", *expected_ids}:
            raise ActivityError(f"{label} must carry exactly its covered sources")
        row: dict[str, Any] = {"date": observed.isoformat()}
        for identifier in sorted(expected_ids):
            row[identifier] = _metrics(
                _exact_dict(
                    raw_point[identifier], set(METRICS), f"{label}.{identifier}"
                ),
                f"{label}.{identifier}",
            )
        points.append(row)
        expected += timedelta(days=1)

    return {
        "schema": 4,
        "updated_on": complete_through.isoformat(),
        "timezone": "UTC",
        "scope": "code_activity",
        "sources": [
            {key: descriptor[key] for key in PUBLIC_SOURCE_KEYS}
            for descriptor in raw_sources
        ],
        "coverage": {
            "starts_on": starts_on.isoformat(),
            "complete_through": complete_through.isoformat(),
            "status": "complete",
        },
        "points": points,
    }


def build_public_snapshot(
    profile: Any,
    *,
    contributed: list[Any] | None = None,
    previous: Any = None,
    today: date | None = None,
) -> tuple[dict[str, Any], bool]:
    """Project every validated source into the public contract."""

    sources = [validate_profile_snapshot(profile, today=today)]
    for candidate in contributed or []:
        sources.append(validate_contributed_snapshot(candidate, today=today))
    payload = validate_public_snapshot(merge_sources(sources), today=today)
    if previous is None:
        return payload, True

    checked_previous = validate_public_snapshot(previous, today=today)
    if date.fromisoformat(payload["coverage"]["complete_through"]) < date.fromisoformat(
        checked_previous["coverage"]["complete_through"]
    ):
        raise ActivityError("code activity coverage cannot move backward")
    if date.fromisoformat(payload["coverage"]["starts_on"]) > date.fromisoformat(
        checked_previous["coverage"]["starts_on"]
    ):
        raise ActivityError("code activity coverage cannot lose earlier history")
    return payload, payload != checked_previous


def publish_atomically(path: Path, payload: dict[str, Any]) -> bool:
    """Replace one JSON file only after the complete payload validates."""

    serialized = (json.dumps(payload, indent=2, ensure_ascii=False) + "\n").encode(
        "utf-8"
    )
    if path.exists() and path.read_bytes() == serialized:
        return False

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            handle.write(serialized)
            handle.flush()
            os.fsync(handle.fileno())
            temporary_path = Path(handle.name)
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()
    return True


def load_contributed_sources(directory: Path) -> list[Any]:
    """Read every contributed snapshot, in stable id order."""

    if not directory.is_dir():
        return []
    return [
        json.loads(path.read_text(encoding="utf-8"))
        for path in sorted(directory.glob("*.json"))
    ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--personal-repo",
        type=Path,
        required=True,
        help="checkout of the public personal metrics repository",
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="validate the next snapshot without writing",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    output = repo_root / "_data" / "code_activity.json"
    try:
        profile = json.loads(
            (args.personal_repo / "docs" / "github-activity.json").read_text(
                encoding="utf-8"
            )
        )
        contributed = load_contributed_sources(
            repo_root / "_data" / "code_activity_sources"
        )
        previous = (
            json.loads(output.read_text(encoding="utf-8")) if output.exists() else None
        )
        payload, changed = build_public_snapshot(
            profile,
            contributed=contributed,
            previous=previous,
        )
        if changed and not args.check:
            publish_atomically(output, payload)
    except (OSError, json.JSONDecodeError, ActivityError) as error:
        print(f"code activity rejected: {error}", file=__import__("sys").stderr)
        return 1

    print("code activity updated" if changed else "code activity valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
