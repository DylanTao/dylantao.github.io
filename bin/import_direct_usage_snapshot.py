#!/usr/bin/env python3
"""Publish a sanitized, non-additive Codex tracker snapshot.

The input is the identity-free projection produced by the direct two-account
collector. This module intentionally has no knowledge of Codex credentials,
account identities, token histories, reset times, or billing equivalents.
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


EXPECTED_ACCOUNT_COUNT = 2
EXPECTED_METHOD = "codex_app_server_rate_limits_non_additive_no_model_turns"
EXPECTED_UNITS = {
    "accounts": "count",
    "health": "count",
    "freshness": "utc_timestamp",
}
TOP_LEVEL_KEYS = {
    "schemaVersion",
    "accountCount",
    "health",
    "units",
    "method",
    "coverage",
    "confidence",
    "updated_at",
}
BASELINE = {
    "token_count": 20_900_000_000,
    "tokens_label": "20.9B",
    "units": "tokens",
    "method": "manual_rounded_profile_baseline",
    "coverage": "1 of 2 accounts",
    "aggregation": "non_additive",
    "captured_at": "2026-07-12T18:40:36.572451Z",
}
SAFE_CONFIDENCE_LABELS = {
    "high",
    "medium",
    "low",
    "direct",
    "complete",
    "direct complete observation",
}


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


def build_public_snapshot(
    source: Any,
    *,
    now: datetime | None = None,
    max_age: timedelta = timedelta(minutes=20),
) -> dict[str, Any]:
    """Validate a collector projection and return the public schema-2 snapshot."""

    source = _exact_keys(source, TOP_LEVEL_KEYS, "snapshot")
    if source["schemaVersion"] != 1:
        raise SnapshotError("snapshot.schemaVersion must be 1")
    account_count = _count(source["accountCount"], "snapshot.accountCount")
    if account_count != EXPECTED_ACCOUNT_COUNT:
        raise SnapshotError(f"snapshot.accountCount must be {EXPECTED_ACCOUNT_COUNT}")

    health = _exact_keys(
        source["health"],
        {"healthyAccountCount", "unavailableAccountCount"},
        "snapshot.health",
    )
    healthy = _count(health["healthyAccountCount"], "snapshot.health.healthyAccountCount")
    unavailable = _count(
        health["unavailableAccountCount"],
        "snapshot.health.unavailableAccountCount",
    )
    if healthy + unavailable != account_count:
        raise SnapshotError("snapshot.health counts must cover both accounts")

    if source["units"] != EXPECTED_UNITS:
        raise SnapshotError("snapshot.units does not match the public collector contract")
    if source["method"] != EXPECTED_METHOD:
        raise SnapshotError("snapshot.method does not match the direct non-additive method")

    coverage = _exact_keys(
        source["coverage"],
        {"complete", "requiredAccountCount", "healthyAccountCount"},
        "snapshot.coverage",
    )
    if coverage["complete"] is not True:
        raise SnapshotError("snapshot.coverage.complete must be true")
    required = _count(
        coverage["requiredAccountCount"],
        "snapshot.coverage.requiredAccountCount",
    )
    covered_healthy = _count(
        coverage["healthyAccountCount"],
        "snapshot.coverage.healthyAccountCount",
    )
    if required != account_count or covered_healthy != healthy or healthy != account_count:
        raise SnapshotError("snapshot.coverage must be a complete healthy 2-of-2 observation")

    confidence = source["confidence"]
    if confidence not in SAFE_CONFIDENCE_LABELS:
        raise SnapshotError("snapshot.confidence is not a safe public label")

    observed_at = _parse_utc_timestamp(source["updated_at"], "snapshot.updated_at")
    checked_at = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    age = checked_at - observed_at
    if age < -timedelta(minutes=5):
        raise SnapshotError("snapshot.updated_at is too far in the future")
    if age > max_age:
        raise SnapshotError("snapshot.updated_at is stale")

    return {
        "schema": 2,
        "accountCount": account_count,
        "healthyAccountCount": healthy,
        "freshAccountCount": account_count,
        "accountsWithQuotaData": healthy,
        "accountsAtLimit": None,
        "units": dict(EXPECTED_UNITS),
        "method": EXPECTED_METHOD,
        "coverage": {
            "complete": True,
            "requiredAccountCount": required,
            "healthyAccountCount": covered_healthy,
        },
        "confidence": confidence,
        "updated_at": source["updated_at"],
        "personalRoundedLifetimeBaseline": dict(BASELINE),
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
