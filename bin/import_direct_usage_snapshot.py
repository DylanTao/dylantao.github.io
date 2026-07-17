#!/usr/bin/env python3
"""Publish a sanitized, rounded Codex lifetime-usage snapshot.

The input is the identity-free projection produced by the protected collector.
This module intentionally has no knowledge of Codex credentials, account
identities, per-source readings, token histories, reset times, or billing
equivalents.
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


EXPECTED_SOURCE_COUNT = 2
ROUNDING_QUANTUM = 100_000_000
JAVASCRIPT_SAFE_INTEGER = 9_007_199_254_740_991
EXPECTED_METHOD = "rounded_sum_of_verified_account_lifetime_readings"
EXPECTED_LIFETIME = {
    "units": "tokens",
    "aggregation": "sum_of_sources",
    "rounding": "nearest_0.1B",
}
TOP_LEVEL_KEYS = {
    "schemaVersion",
    "combinedLifetime",
    "method",
    "confidence",
    "updated_at",
}
EXPECTED_CONFIDENCE = "high"


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


def build_public_snapshot(
    source: Any,
    *,
    now: datetime | None = None,
    max_age: timedelta = timedelta(minutes=20),
) -> dict[str, Any]:
    """Validate a collector projection and return the public schema-3 snapshot."""

    source = _exact_keys(source, TOP_LEVEL_KEYS, "snapshot")
    schema_version = source["schemaVersion"]
    if not isinstance(schema_version, int) or isinstance(schema_version, bool) or schema_version != 3:
        raise SnapshotError("snapshot.schemaVersion must be 3")

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

    return {
        "schema": 3,
        "combined_lifetime": {
            "token_count": token_count,
            "tokens_label": _tokens_label(token_count),
            "units": EXPECTED_LIFETIME["units"],
            "aggregation": EXPECTED_LIFETIME["aggregation"],
            "rounding": EXPECTED_LIFETIME["rounding"],
            "source_count": source_count,
        },
        "method": EXPECTED_METHOD,
        "confidence": confidence,
        "observed_on": observed_at.date().isoformat(),
        "updated_at": source["updated_at"],
        "automated_refresh": True,
    }


def _serialized(payload: dict[str, Any]) -> bytes:
    return (json.dumps(payload, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


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


def publish_atomically(repo_root: Path, payload: dict[str, Any]) -> None:
    """Replace both public copies as one rollback-capable publication."""

    targets = (
        repo_root / "_data" / "direct_usage_tracker.json",
        repo_root / "assets" / "data" / "codex-profile-usage.json",
    )
    content = _serialized(payload)
    originals = {path: path.read_bytes() if path.exists() else None for path in targets}
    staged = {path: _staged_file(path, content) for path in targets}
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
        payload = build_public_snapshot(
            source,
            max_age=timedelta(minutes=args.max_age_minutes),
        )
        if not args.check:
            publish_atomically(args.repo_root.resolve(), payload)
    except (OSError, json.JSONDecodeError, SnapshotError) as error:
        print(f"direct usage snapshot rejected: {error}", file=__import__("sys").stderr)
        return 1
    print(json.dumps(payload, separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
