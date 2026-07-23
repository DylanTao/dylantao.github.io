#!/usr/bin/env python3
"""Publish a sanitized, rounded Codex lifetime-usage snapshot.

The input is the identity-free projection produced by the protected collector.
This module intentionally has no knowledge of Codex credentials, account
identities, per-source readings, token histories, or reset times. A rough cost
comparison is derived separately from the site's already-public blended API
rate; it is not supplied by the collector and is not an actual bill.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import tempfile
from datetime import datetime, timedelta, timezone
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
TOP_LEVEL_KEYS = {
    "schemaVersion",
    "combinedLifetime",
    "method",
    "confidence",
    "updated_at",
}
EXPECTED_CONFIDENCE = "high"
COST_METHOD = "flat_reference_rate_replay"
COST_REFERENCE_SCOPE = "current_site_build_blended_public_api_rate"


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


def build_site_snapshot(
    source: Any,
    *,
    now: datetime | None = None,
    max_age: timedelta = timedelta(minutes=20),
) -> dict[str, Any]:
    """Validate the collector projection and return the schema-3 site snapshot."""

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


def build_public_snapshot(
    source: Any,
    *,
    agentic_usage: Any,
    now: datetime | None = None,
    max_age: timedelta = timedelta(minutes=20),
) -> dict[str, Any]:
    """Project the validated site snapshot as the cost-bearing public schema 4."""

    site = build_site_snapshot(source, now=now, max_age=max_age)
    return {
        **site,
        "schema": 4,
        "cost": _cost_equivalence(site["combined_lifetime"]["token_count"], agentic_usage),
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


def publish_atomically(
    repo_root: Path,
    site_payload: dict[str, Any],
    profile_payload: dict[str, Any],
) -> None:
    """Replace the schema-3 site and schema-4 profile snapshots atomically."""

    targets = {
        repo_root / "_data" / "direct_usage_tracker.json": _serialized(site_payload),
        repo_root / "assets" / "data" / "codex-profile-usage.json": _serialized(profile_payload),
    }
    originals = {path: path.read_bytes() if path.exists() else None for path in targets}
    staged = {path: _staged_file(path, content) for path, content in targets.items()}
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
        agentic_usage = yaml.safe_load(
            (args.repo_root.resolve() / "_data" / "agentic_usage.yml").read_text(
                encoding="utf-8"
            )
        )
        site_payload = build_site_snapshot(
            source,
            max_age=timedelta(minutes=args.max_age_minutes),
        )
        profile_payload = build_public_snapshot(
            source,
            agentic_usage=agentic_usage,
            max_age=timedelta(minutes=args.max_age_minutes),
        )
        if not args.check:
            publish_atomically(args.repo_root.resolve(), site_payload, profile_payload)
    except (OSError, json.JSONDecodeError, SnapshotError) as error:
        print(f"direct usage snapshot rejected: {error}", file=__import__("sys").stderr)
        return 1
    print(json.dumps(profile_payload, separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
