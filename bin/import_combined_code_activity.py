#!/usr/bin/env python3
"""Publish identity-free cumulative code-activity snapshots.

The protected bridge contributes one cumulative snapshot through a completed
calendar date. The first public point combines that work total with the
personal five-year snapshot closed just after midnight. Later public points
advance only by observed personal daily increments and protected cumulative
deltas, so the rolling personal window cannot make the public tally decrease.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


TIMEZONE_NAME = "America/Los_Angeles"
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
PROFILE_KEYS = {"schema", "generatedAt", "weeks"}
PROFILE_ROW_KEYS = {"week", "commits", "additions", "deletions"}
PUBLIC_KEYS = {
    "schema",
    "timezone",
    "scope",
    "aggregation",
    "updated_on",
    "points",
}
PUBLIC_POINT_KEYS = {"date", "commits", "additions", "deletions"}
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
    output = args.repo_root.resolve() / "_data" / "combined_code_activity.json"
    try:
        bridge_history = load_bridge_history(args.bridge_repo)
        bridge = validate_bridge(
            json.loads(
                (args.bridge_repo / "activity.json").read_text(
                    encoding="utf-8"
                )
            )
        )
        if bridge != bridge_history[0]:
            raise ActivityError("protected bridge checkout is not at its latest state")

        profile_history = load_profile_history(args.personal_repo)
        previous = (
            json.loads(output.read_text(encoding="utf-8"))
            if output.exists()
            else None
        )
        checked_previous = (
            validate_public_snapshot(previous)
            if previous is not None
            else None
        )
        target = date.fromisoformat(bridge["date"])
        base, _ = _base_point_for_target(checked_previous, target)
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
        if not args.check and changed:
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
