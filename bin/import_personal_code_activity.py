#!/usr/bin/env python3
"""Publish validated personal daily code activity.

The importer accepts one exact schema-3 profile snapshot. It publishes only
completed UTC days from the verified five-year personal window and never
replaces a previously valid personal snapshot when validation fails.
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
METRICS = ("commits", "additions", "deletions")

PROFILE_KEYS = {"schema", "generatedAt", "weeks", "daily"}
WEEK_KEYS = {"week", "commits", "additions", "deletions"}
DAILY_KEYS = {
    "timezone",
    "starts_on",
    "complete_through",
    "coverage",
    "points",
}
POINT_KEYS = {"date", "commits", "additions", "deletions"}

PUBLIC_KEYS = {
    "schema",
    "updated_on",
    "timezone",
    "scope",
    "coverage",
    "points",
}
PUBLIC_COVERAGE_KEYS = {"starts_on", "complete_through", "status"}


class ActivityError(ValueError):
    """Raised when personal activity cannot be safely published."""


def _five_year_start(window_end: date) -> date:
    """Return the inclusive start for a five-calendar-year UTC window."""

    try:
        return window_end.replace(year=window_end.year - 5)
    except ValueError:
        # A Feb. 29 end boundary maps to Feb. 28 five years earlier.
        return window_end.replace(
            year=window_end.year - 5,
            day=28,
        )


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
    if (
        type(value) is not int
        or value < 0
        or value > JAVASCRIPT_SAFE_INTEGER
    ):
        raise ActivityError(f"{label} must be a safe nonnegative integer")
    return value


def _validate_weeks(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not value:
        raise ActivityError("personal profile weeks must be a non-empty array")

    normalized: list[dict[str, Any]] = []
    previous: date | None = None
    for index, raw_row in enumerate(value):
        row = _exact_dict(
            raw_row,
            WEEK_KEYS,
            f"personal profile weeks[{index}]",
        )
        observed = _iso_date(
            row["week"],
            f"personal profile weeks[{index}].week",
        )
        if observed.weekday() != 6:
            raise ActivityError("personal profile week dates must be Sundays")
        if previous is not None and observed != previous + timedelta(days=7):
            raise ActivityError(
                "personal profile week dates must be contiguous"
            )
        normalized.append(
            {
                "week": observed.isoformat(),
                **{
                    metric: _count(
                        row[metric],
                        f"personal profile weeks[{index}].{metric}",
                    )
                    for metric in METRICS
                },
            }
        )
        previous = observed
    return normalized


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
        point = _exact_dict(
            raw_point,
            POINT_KEYS,
            f"{label}[{index}]",
        )
        observed = _iso_date(point["date"], f"{label}[{index}].date")
        if observed != expected:
            raise ActivityError(
                f"{label} dates must be contiguous and increasing"
            )
        if observed >= today:
            raise ActivityError(
                f"{label} must contain completed UTC dates only"
            )
        normalized.append(
            {
                "date": observed.isoformat(),
                **{
                    metric: _count(
                        point[metric],
                        f"{label}[{index}].{metric}",
                    )
                    for metric in METRICS
                },
            }
        )
        expected += timedelta(days=1)
    return normalized


def validate_profile_snapshot(
    value: Any,
    *,
    today: date | None = None,
) -> dict[str, Any]:
    """Validate the exact schema-3 personal source contract."""

    checked_today = today or datetime.now(timezone.utc).date()
    source = _exact_dict(value, PROFILE_KEYS, "personal profile")
    if type(source["schema"]) is not int or source["schema"] != 3:
        raise ActivityError("personal profile schema must be integer 3")

    generated_at = _timestamp(
        source["generatedAt"],
        "personal profile generatedAt",
    )
    if generated_at.astimezone(timezone.utc).date() > checked_today:
        raise ActivityError("personal profile generatedAt cannot be future")
    weeks = _validate_weeks(source["weeks"])

    daily = _exact_dict(
        source["daily"],
        DAILY_KEYS,
        "personal profile daily",
    )
    if daily["timezone"] != "UTC":
        raise ActivityError("personal profile daily timezone must be UTC")
    if daily["coverage"] != "complete":
        raise ActivityError(
            "personal profile daily coverage must be complete"
        )
    starts_on = _iso_date(
        daily["starts_on"],
        "personal profile daily starts_on",
    )
    complete_through = _iso_date(
        daily["complete_through"],
        "personal profile daily complete_through",
    )
    expected_start = _five_year_start(
        generated_at.astimezone(timezone.utc).date()
    )
    if starts_on != expected_start:
        raise ActivityError(
            "personal profile must cover exactly five calendar years"
        )
    expected_complete_through = (
        generated_at.astimezone(timezone.utc).date() - timedelta(days=1)
    )
    if complete_through != expected_complete_through:
        raise ActivityError(
            "personal profile must end on the latest completed UTC date"
        )
    if complete_through < starts_on:
        raise ActivityError("personal profile daily coverage is reversed")

    points = _validate_points(
        daily["points"],
        starts_on=starts_on,
        complete_through=complete_through,
        today=checked_today,
        label="personal profile daily points",
    )
    return {
        "schema": 3,
        "generatedAt": source["generatedAt"],
        "weeks": weeks,
        "daily": {
            "timezone": "UTC",
            "starts_on": starts_on.isoformat(),
            "complete_through": complete_through.isoformat(),
            "coverage": "complete",
            "points": points,
        },
    }


def validate_public_snapshot(
    value: Any,
    *,
    today: date | None = None,
) -> dict[str, Any]:
    """Validate a previously published personal snapshot."""

    checked_today = today or datetime.now(timezone.utc).date()
    source = _exact_dict(value, PUBLIC_KEYS, "personal public snapshot")
    if type(source["schema"]) is not int or source["schema"] != 3:
        raise ActivityError("personal public snapshot schema must be 3")
    if source["timezone"] != "UTC":
        raise ActivityError(
            "personal public snapshot timezone must be UTC"
        )
    if source["scope"] != "personal_code_activity":
        raise ActivityError("personal public snapshot scope is invalid")

    coverage = _exact_dict(
        source["coverage"],
        PUBLIC_COVERAGE_KEYS,
        "personal public snapshot coverage",
    )
    if coverage["status"] != "complete":
        raise ActivityError(
            "personal public snapshot coverage must be complete"
        )
    starts_on = _iso_date(
        coverage["starts_on"],
        "personal public snapshot starts_on",
    )
    complete_through = _iso_date(
        coverage["complete_through"],
        "personal public snapshot complete_through",
    )
    expected_start = _five_year_start(
        complete_through + timedelta(days=1)
    )
    if starts_on != expected_start:
        raise ActivityError(
            "personal public snapshot must cover exactly five calendar years"
        )
    if source["updated_on"] != complete_through.isoformat():
        raise ActivityError(
            "personal public snapshot updated_on must match coverage"
        )
    points = _validate_points(
        source["points"],
        starts_on=starts_on,
        complete_through=complete_through,
        today=checked_today,
        label="personal public snapshot points",
    )
    return {
        "schema": 3,
        "updated_on": complete_through.isoformat(),
        "timezone": "UTC",
        "scope": "personal_code_activity",
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
    previous: Any = None,
    today: date | None = None,
) -> tuple[dict[str, Any], bool]:
    """Project one validated profile into the personal public contract."""

    checked = validate_profile_snapshot(profile, today=today)
    daily = checked["daily"]
    payload = validate_public_snapshot(
        {
            "schema": 3,
            "updated_on": daily["complete_through"],
            "timezone": "UTC",
            "scope": "personal_code_activity",
            "coverage": {
                "starts_on": daily["starts_on"],
                "complete_through": daily["complete_through"],
                "status": "complete",
            },
            "points": daily["points"],
        },
        today=today,
    )
    if previous is None:
        return payload, True

    checked_previous = validate_public_snapshot(previous, today=today)
    if (
        date.fromisoformat(payload["coverage"]["complete_through"])
        < date.fromisoformat(
            checked_previous["coverage"]["complete_through"]
        )
    ):
        raise ActivityError(
            "personal daily coverage cannot move backward"
        )
    return payload, payload != checked_previous


def publish_atomically(path: Path, payload: dict[str, Any]) -> bool:
    """Replace one JSON file only after the complete payload validates."""

    serialized = (
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    ).encode("utf-8")
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
        help="validate the next personal snapshot without writing",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output = (
        args.repo_root.resolve()
        / "_data"
        / "personal_code_activity.json"
    )
    try:
        profile = json.loads(
            (
                args.personal_repo
                / "docs"
                / "github-activity.json"
            ).read_text(encoding="utf-8")
        )
        previous = (
            json.loads(output.read_text(encoding="utf-8"))
            if output.exists()
            else None
        )
        payload, changed = build_public_snapshot(
            profile,
            previous=previous,
        )
        if changed and not args.check:
            publish_atomically(output, payload)
    except (OSError, json.JSONDecodeError, ActivityError) as error:
        print(
            f"personal code activity rejected: {error}",
            file=__import__("sys").stderr,
        )
        return 1

    print(
        "personal code activity updated"
        if changed
        else "personal code activity valid"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
