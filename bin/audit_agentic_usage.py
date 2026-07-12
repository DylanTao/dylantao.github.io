#!/usr/bin/env python
"""Audit Codex/agentic usage counters for this customized site.

The default mode is read-only. Modern Codex logs are counted from additive
``last_token_usage`` records after copied fork ancestry is globally deduped.
Older retained logs fall back to conservative cumulative deltas.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable

try:
    import yaml
except ImportError:  # pragma: no cover - handled in compare output.
    yaml = None


REPO_NEEDLE = "dylantao.github.io"
MAX_IDLE_GAP_SECONDS = 45 * 60
ONE_SHOT_SESSION_HOURS = 0.05

REVAMP_CUTOFF_UTC = datetime(2026, 5, 23, 1, 5, tzinfo=timezone.utc)
DESK_CUTOFF_UTC = datetime(2026, 6, 17, 3, 0, tzinfo=timezone.utc)
LOCAL_LIFETIME_CUTOFF_UTC = datetime(2026, 6, 19, 7, 0, tzinfo=timezone.utc)
GPT_5_6_CUTOVER_UTC = datetime(2026, 7, 9, 21, 28, 23, 394000, tzinfo=timezone.utc)
REVAMP_GIT_SINCE = "2026-05-22T18:05:00-07:00"
DESK_GIT_SINCE = "2026-06-16T20:00:00-07:00"
GPT_5_6_GIT_SINCE = "2026-07-09T14:28:23.394-07:00"
DESK_PATHS = [
    "assets/js/home.js",
    "_sass/_home.scss",
    "_includes/home/hero.liquid",
    "docs/homepage-desk-scene-brief.md",
    "assets/img/home",
]

INTENDED_MODEL = "gpt-5.6-sol"
INTENDED_EFFORT = "ultra"

WH_PER_TOKEN_MIDPOINT = 0.0006
WH_PER_TOKEN_LOW = 0.0002
WH_PER_TOKEN_HIGH = 0.002
KG_CO2E_PER_KWH = 0.373
TREE_YEAR_METRIC_TONS_CO2E = 0.060
CUT_TREE_CO2E_KG = 600
TOKEN_USAGE_FIELDS = (
    "input_tokens",
    "cached_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "total_tokens",
)
PUBLIC_CHECK_FIELDS = (
    ("commits",),
    ("token_count",),
    ("tokens_label",),
    ("hours_count",),
    ("hours_label",),
    ("energy_equivalence", "kwh_midpoint"),
    ("energy_equivalence", "kg_co2e_midpoint"),
    ("energy_equivalence", "tree_years_midpoint"),
    ("energy_equivalence", "tree_years_range"),
    ("energy_equivalence", "cut_tree_midpoint"),
    ("energy_equivalence", "cut_tree_range"),
    ("energy_equivalence", "public_note"),
    ("api_cost_equivalence", "usd_midpoint"),
    ("api_cost_equivalence", "usd_label"),
    ("api_cost_equivalence", "public_note"),
    ("legacy_api_cost_equivalence", "usd_midpoint"),
    ("legacy_api_cost_equivalence", "usd_label"),
    ("codexbar_cost_estimate", "token_count"),
    ("codexbar_cost_estimate", "usd_midpoint"),
    ("codexbar_cost_estimate", "usd_label"),
    ("codexbar_cost_estimate", "public_note"),
)
MODEL_TRACKING_CHECK_FIELDS = (
    ("intended_model",),
    ("intended_effort",),
    ("cutover_at",),
    ("status",),
    ("post_cutover_deviation_count",),
    ("public_note",),
)
LOCAL_LIFETIME_CHECK_FIELDS = (
    ("sessions",),
    ("token_count",),
    ("tokens_label",),
    ("api_cost_equivalence", "usd_midpoint"),
    ("api_cost_equivalence", "usd_label"),
    ("api_cost_equivalence", "unpriced_token_usage", "total_tokens"),
)

PRICE_SOURCE_URL = "https://developers.openai.com/api/docs/pricing"
MODEL_PRICE_AS_OF = "2026-07-09"
MODEL_STANDARD_RATES: dict[str, dict[str, float | None]] = {
    "gpt-5.5": {
        "input_usd_per_million": 5.00,
        "cached_input_usd_per_million": 0.50,
        "output_usd_per_million": 30.00,
        "cache_write_input_usd_per_million": None,
    },
    "gpt-5.6-sol": {
        "input_usd_per_million": 5.00,
        "cached_input_usd_per_million": 0.50,
        "output_usd_per_million": 30.00,
        "cache_write_input_usd_per_million": 6.25,
    },
}
API_COST_CAVEAT = (
    "API list-price equivalence from logged short-context model rates only; "
    "cache-write tokens, long-context thresholds, and actual Codex billing are not exposed."
)
LEGACY_PRICE_MODEL = "gpt-5.3-codex"
LEGACY_PRICE_AS_OF = "2026-06-19"
LEGACY_INPUT_USD_PER_MILLION = 1.75
LEGACY_CACHED_INPUT_USD_PER_MILLION = 0.175
LEGACY_OUTPUT_USD_PER_MILLION = 14.00
LEGACY_API_COST_CAVEAT = (
    "Legacy gpt-5.3-codex API list-price lens retained for continuity; "
    "it is not the logged-model estimate or an actual Codex bill."
)
CODEXBAR_COST_SOURCE = "CodexBar local dashboard screenshot"
CODEXBAR_COST_SOURCE_AS_OF = "2026-06-19"
CODEXBAR_REFERENCE_USD = 2616.40
CODEXBAR_REFERENCE_TOKENS = 3_000_000_000
CODEXBAR_COST_CAVEAT = "CodexBar-ratio estimate only; actual Codex product or subscription cost may differ."
LEDGER_HEADER = """# Estimated Codex/agentic work ledger for the customized Sirui/Dylan site.
# Update this with docs/agentic-usage-ledger.md after substantial site work.
"""


def empty_usage() -> dict[str, int]:
    return {field_name: 0 for field_name in TOKEN_USAGE_FIELDS}


def normalized_usage(value: Any) -> dict[str, int]:
    mapping = value if isinstance(value, dict) else {}
    result: dict[str, int] = {}
    for field_name in TOKEN_USAGE_FIELDS:
        try:
            result[field_name] = max(0, int(mapping.get(field_name) or 0))
        except (TypeError, ValueError):
            result[field_name] = 0
    return result


def usage_signature(usage: dict[str, int]) -> tuple[int, ...]:
    return tuple(usage.get(field_name, 0) for field_name in TOKEN_USAGE_FIELDS)


def add_usage(target: dict[str, int], addition: dict[str, int]) -> None:
    for field_name in TOKEN_USAGE_FIELDS:
        target[field_name] = target.get(field_name, 0) + addition.get(field_name, 0)


def positive_usage_delta(current: dict[str, int], previous: dict[str, int]) -> dict[str, int]:
    return {
        field_name: max(0, current.get(field_name, 0) - previous.get(field_name, 0))
        for field_name in TOKEN_USAGE_FIELDS
    }


@dataclass(frozen=True)
class TurnContextRecord:
    timestamp: datetime
    leaf_session_id: str
    turn_id: str
    model: str
    effort: str
    path: Path
    ordinal: int


@dataclass(frozen=True)
class TokenEvent:
    timestamp: datetime
    leaf_session_id: str
    turn_id: str | None
    model: str
    effort: str
    total_usage: dict[str, int]
    last_usage: dict[str, int] | None
    path: Path
    ordinal: int


@dataclass(frozen=True)
class CountedUsageEvent:
    timestamp: datetime
    leaf_session_id: str
    turn_id: str | None
    model: str
    effort: str
    usage: dict[str, int]
    total_usage: dict[str, int]
    source: str
    path: Path
    ordinal: int


@dataclass
class SessionRecord:
    session_id: str
    cwd: str
    started_at: datetime | None = None
    paths: set[Path] = field(default_factory=set)
    contexts: list[TurnContextRecord] = field(default_factory=list)
    token_events: list[TokenEvent] = field(default_factory=list)
    fork_preamble_events_skipped: int = 0


@dataclass
class UsageDataset:
    sessions: dict[str, SessionRecord]
    usage_events: list[CountedUsageEvent]
    contexts_by_turn: dict[str, TurnContextRecord]
    source_counts: dict[str, int]


def parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if timestamp.tzinfo is None:
        return timestamp.replace(tzinfo=timezone.utc)
    return timestamp.astimezone(timezone.utc)


def format_timestamp_utc(timestamp: datetime) -> str:
    timespec = "milliseconds" if timestamp.microsecond else "seconds"
    return timestamp.astimezone(timezone.utc).isoformat(timespec=timespec).replace("+00:00", "Z")


def sessions_root_from_args(value: str | None) -> Path:
    if value:
        return Path(value).expanduser()

    codex_home = os.environ.get("CODEX_HOME")
    if codex_home:
        return Path(codex_home).expanduser() / "sessions"

    return Path.home() / ".codex" / "sessions"


def scan_sessions(root: Path, repo_needle: str | None) -> dict[str, SessionRecord]:
    """Read every retained year and keep the first session_meta as leaf identity."""

    sessions: dict[str, SessionRecord] = {}
    if not root.exists():
        return sessions

    for path in sorted(root.rglob("*.jsonl")):
        leaf_id: str | None = None
        leaf_cwd = ""
        leaf_started_at: datetime | None = None
        leaf_forked_from_id: str | None = None
        seen_turn_context = False
        fork_preamble_events_skipped = 0
        contexts: list[TurnContextRecord] = []
        token_events: list[TokenEvent] = []
        current_turn_id: str | None = None
        current_model = "unknown"
        current_effort = "unknown"

        try:
            with path.open("r", encoding="utf-8") as handle:
                for ordinal, line in enumerate(handle):
                    line = line.strip()
                    if not line:
                        continue
                    # JSONL response items can contain entire prompts and tool
                    # outputs. The top-level type appears near the beginning,
                    # so avoid decoding large irrelevant records.
                    prefix = line[:256]
                    # Most JSONL lines are messages or tool payloads and can be
                    # very large. Parse only the three record shapes used by
                    # this audit; looking for the generic event_msg wrapper
                    # made the publish hook needlessly reparse every message.
                    if not any(
                        marker in prefix
                        for marker in (
                            '"type":"session_meta"',
                            '"type": "session_meta"',
                            '"type":"turn_context"',
                            '"type": "turn_context"',
                            '"type":"token_count"',
                            '"type": "token_count"',
                        )
                    ):
                        continue
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    timestamp = parse_timestamp(event.get("timestamp"))
                    event_type = event.get("type")
                    payload = event.get("payload") or {}

                    if event_type == "session_meta" and leaf_id is None:
                        candidate_id = payload.get("id")
                        leaf_id = str(candidate_id) if candidate_id else str(path)
                        leaf_cwd = str(payload.get("cwd") or "")
                        leaf_started_at = timestamp
                        forked_from_id = payload.get("forked_from_id")
                        source = payload.get("source")
                        source_parent_id = None
                        if isinstance(source, dict):
                            subagent = source.get("subagent")
                            if isinstance(subagent, dict):
                                thread_spawn = subagent.get("thread_spawn")
                                if isinstance(thread_spawn, dict):
                                    source_parent_id = thread_spawn.get("parent_thread_id")
                        parent_id = forked_from_id or source_parent_id
                        leaf_forked_from_id = str(parent_id) if parent_id else None
                        continue

                    if leaf_id is None or timestamp is None:
                        continue

                    if event_type == "turn_context":
                        turn_id = str(payload.get("turn_id") or "").strip()
                        if not turn_id:
                            continue
                        current_turn_id = turn_id
                        current_model = str(payload.get("model") or "unknown")
                        current_effort = str(payload.get("effort") or "unknown")
                        seen_turn_context = True
                        contexts.append(
                            TurnContextRecord(
                                timestamp=timestamp,
                                leaf_session_id=leaf_id,
                                turn_id=turn_id,
                                model=current_model,
                                effort=current_effort,
                                path=path,
                                ordinal=ordinal,
                            )
                        )
                        continue

                    if event_type != "event_msg" or payload.get("type") != "token_count":
                        continue
                    info = payload.get("info") or {}
                    total_usage = normalized_usage(info.get("total_token_usage"))
                    if total_usage["total_tokens"] <= 0:
                        continue
                    # Some explicit forks replay cumulative parent token events
                    # immediately after leaf metadata but omit the copied parent
                    # turn_context. Those events are ancestry, not unknown child
                    # usage. The first leaf context marks the end of the replay.
                    if leaf_forked_from_id and not seen_turn_context:
                        fork_preamble_events_skipped += 1
                        continue
                    raw_last_usage = info.get("last_token_usage")
                    last_usage = normalized_usage(raw_last_usage) if isinstance(raw_last_usage, dict) else None
                    if last_usage is not None and last_usage["total_tokens"] <= 0:
                        last_usage = None
                    token_events.append(
                        TokenEvent(
                            timestamp=timestamp,
                            leaf_session_id=leaf_id,
                            turn_id=current_turn_id,
                            model=current_model,
                            effort=current_effort,
                            total_usage=total_usage,
                            last_usage=last_usage,
                            path=path,
                            ordinal=ordinal,
                        )
                    )
        except OSError as error:
            print(f"warning: could not read {path}: {error}", file=sys.stderr)
            continue

        if leaf_id is None or (repo_needle and repo_needle.lower() not in leaf_cwd.lower()):
            continue

        record = sessions.setdefault(leaf_id, SessionRecord(session_id=leaf_id, cwd=leaf_cwd))
        record.paths.add(path)
        if leaf_started_at and (record.started_at is None or leaf_started_at < record.started_at):
            record.started_at = leaf_started_at
        record.contexts.extend(contexts)
        record.token_events.extend(token_events)
        record.fork_preamble_events_skipped += fork_preamble_events_skipped

    return sessions


def sessions_matching_repo(sessions: dict[str, SessionRecord], repo_needle: str) -> dict[str, SessionRecord]:
    """Return retained leaf sessions whose first cwd names the requested repo."""

    needle = repo_needle.lower()
    return {
        session_id: record
        for session_id, record in sessions.items()
        if needle in record.cwd.lower()
    }


def earliest_contexts(sessions: dict[str, SessionRecord]) -> dict[str, TurnContextRecord]:
    contexts: dict[str, TurnContextRecord] = {}
    all_contexts = [context for record in sessions.values() for context in record.contexts]
    for context in sorted(all_contexts, key=lambda item: (item.timestamp, str(item.path), item.ordinal)):
        contexts.setdefault(context.turn_id, context)
    return contexts


def prepare_usage_dataset(sessions: dict[str, SessionRecord]) -> UsageDataset:
    """Deduplicate copied ancestry, then retain additive usage events."""

    candidates: list[CountedUsageEvent] = []
    for record in sessions.values():
        events_by_path: dict[Path, list[TokenEvent]] = defaultdict(list)
        for event in record.token_events:
            events_by_path[event.path].append(event)

        for path, path_events in events_by_path.items():
            previous = empty_usage()
            for event in sorted(path_events, key=lambda item: (item.timestamp, item.ordinal)):
                if event.last_usage is not None:
                    usage = event.last_usage
                    source = "last_token_usage"
                else:
                    usage = positive_usage_delta(event.total_usage, previous)
                    source = "legacy_cumulative_delta"
                previous = event.total_usage
                if usage["total_tokens"] <= 0:
                    continue
                candidates.append(
                    CountedUsageEvent(
                        timestamp=event.timestamp,
                        leaf_session_id=event.leaf_session_id,
                        turn_id=event.turn_id,
                        model=event.model,
                        effort=event.effort,
                        usage=usage,
                        total_usage=event.total_usage,
                        source=source,
                        path=path,
                        ordinal=event.ordinal,
                    )
                )

    seen_snapshots: set[tuple[str, tuple[int, ...]]] = set()
    usage_events: list[CountedUsageEvent] = []
    source_counts: dict[str, int] = defaultdict(int)
    source_counts["fork_preamble_events_skipped"] = sum(
        record.fork_preamble_events_skipped for record in sessions.values()
    )
    ordered = sorted(candidates, key=lambda item: (item.timestamp, str(item.path), item.ordinal))
    for event in ordered:
        # Modern fork copies share turn_id and the complete cumulative snapshot.
        # Legacy logs have no turn identity, so the full five-field snapshot is
        # the conservative fallback key. Exact independent collisions are
        # possible but much safer than summing copied cumulative ancestry.
        identity = event.turn_id or "__legacy_without_turn_id__"
        dedupe_key = (identity, usage_signature(event.total_usage))
        if dedupe_key in seen_snapshots:
            source_counts["copied_or_repeated_snapshots_skipped"] += 1
            continue
        seen_snapshots.add(dedupe_key)
        usage_events.append(event)
        source_counts[event.source] += 1

    return UsageDataset(
        sessions=sessions,
        usage_events=usage_events,
        contexts_by_turn=earliest_contexts(sessions),
        source_counts=dict(source_counts),
    )


def git_commit_count(repo_root: Path, since: str, paths: list[str]) -> int:
    command = ["git", "rev-list", "--count", f"--since={since}", "HEAD", "--", *paths]
    result = subprocess.run(command, cwd=repo_root, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git command failed: {' '.join(command)}")
    return int(result.stdout.strip())


def is_shallow_repository(repo_root: Path) -> bool:
    result = subprocess.run(
        ["git", "rev-parse", "--is-shallow-repository"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "could not determine whether the repository is shallow")
    return result.stdout.strip().lower() == "true"


def require_complete_git_history(repo_root: Path) -> None:
    if is_shallow_repository(repo_root):
        raise RuntimeError(
            "Agentic usage audit requires complete git history; this checkout is shallow. "
            "Run `git fetch --unshallow origin` before checking or writing the ledger."
        )


def has_pending_changes(repo_root: Path, paths: list[str]) -> bool:
    diff_commands = [
        ["git", "diff", "--quiet", "--", *paths],
        ["git", "diff", "--cached", "--quiet", "--", *paths],
    ]
    for command in diff_commands:
        result = subprocess.run(command, cwd=repo_root, capture_output=True, text=True, check=False)
        if result.returncode == 1:
            return True
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or f"git command failed: {' '.join(command)}")

    untracked_command = ["git", "ls-files", "--others", "--exclude-standard", "--", *paths]
    result = subprocess.run(untracked_command, cwd=repo_root, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git command failed: {' '.join(untracked_command)}")
    return bool(result.stdout.strip())


def normalize_repo_path(path: str) -> str:
    normalized = path.replace("\\", "/").lstrip("./")
    return normalized.rstrip("/")


def path_matches_scope(path: str, scope: str) -> bool:
    normalized_path = normalize_repo_path(path)
    normalized_scope = normalize_repo_path(scope)
    return normalized_path == normalized_scope or normalized_path.startswith(f"{normalized_scope}/")


def paths_matching_scope(paths: list[str], scopes: list[str]) -> list[str]:
    return [
        path
        for path in paths
        if any(path_matches_scope(path, scope) or path_matches_scope(scope, path) for scope in scopes)
    ]


def rounded_token_count(raw_tokens: int) -> int:
    step = 10_000_000 if raw_tokens >= 100_000_000 else 1_000_000
    return int(((raw_tokens + step // 2) // step) * step)


def token_label(tokens: int) -> str:
    if tokens >= 1_000_000_000:
        label = f"{tokens / 1_000_000_000:.2f}".rstrip("0").rstrip(".")
        return f"{label}B"
    if tokens >= 1_000_000:
        return f"{round(tokens / 1_000_000):.0f}M"
    if tokens >= 1_000:
        return f"{round(tokens / 1_000):.0f}K"
    return str(tokens)


def compact_decimal(value: float, small_threshold: float = 0.3) -> float:
    if abs(value) < small_threshold:
        return round(value, 2)
    return round(value, 1)


def range_label(low: float, high: float, small_threshold: float = 0.3) -> str:
    low_value = compact_decimal(low, small_threshold)
    high_value = compact_decimal(high, small_threshold)
    return f"{low_value:g}-{high_value:g}"


def energy_equivalence(tokens: int) -> dict[str, Any]:
    kwh_midpoint = tokens * WH_PER_TOKEN_MIDPOINT / 1000
    kg_midpoint = kwh_midpoint * KG_CO2E_PER_KWH
    kg_low = tokens * WH_PER_TOKEN_LOW / 1000 * KG_CO2E_PER_KWH
    kg_high = tokens * WH_PER_TOKEN_HIGH / 1000 * KG_CO2E_PER_KWH

    return {
        "wh_per_token_midpoint": WH_PER_TOKEN_MIDPOINT,
        "wh_per_token_range": "0.0002-0.002",
        "kg_co2e_per_kwh": KG_CO2E_PER_KWH,
        "tree_year_metric_tons_co2e": TREE_YEAR_METRIC_TONS_CO2E,
        "kwh_midpoint": round(kwh_midpoint),
        "kg_co2e_midpoint": round(kg_midpoint),
        "tree_years_midpoint": round(kg_midpoint / 60, 1),
        "tree_years_range": range_label(kg_low / 60, kg_high / 60, small_threshold=0),
        "cut_tree_co2e_kg": CUT_TREE_CO2E_KG,
        "cut_tree_midpoint": compact_decimal(kg_midpoint / CUT_TREE_CO2E_KG),
        "cut_tree_range": range_label(kg_low / CUT_TREE_CO2E_KG, kg_high / CUT_TREE_CO2E_KG),
    }


def rounded_money(value: float) -> int:
    if value >= 1000:
        step = 100
    elif value >= 50:
        step = 10
    elif value >= 10:
        step = 5
    else:
        step = 1
    return int(round(value / step) * step)


def money_amount_label(value: float) -> str:
    rounded = rounded_money(value)
    if rounded >= 1000:
        return f"~${rounded / 1000:.1f}K"
    return f"~${rounded}"


def money_label(value: float) -> str:
    return f"{money_amount_label(value)} API cosplay"


def money_range_label(low: float, high: float) -> str:
    low_label = money_amount_label(low).removeprefix("~")
    high_label = money_amount_label(high).removeprefix("~")
    return f"{low_label}-{high_label}"


def codexbar_cost_estimate(token_count: int) -> dict[str, Any]:
    usd_per_million = CODEXBAR_REFERENCE_USD / (CODEXBAR_REFERENCE_TOKENS / 1_000_000)
    usd_midpoint = token_count * usd_per_million / 1_000_000
    usd_label = money_amount_label(usd_midpoint)
    return {
        "label": "CodexBar cost lens",
        "source": CODEXBAR_COST_SOURCE,
        "source_as_of": CODEXBAR_COST_SOURCE_AS_OF,
        "source_note": "$2,616.40 / 3B tokens from the local CodexBar dashboard screenshot.",
        "reference_usd": CODEXBAR_REFERENCE_USD,
        "reference_tokens": CODEXBAR_REFERENCE_TOKENS,
        "usd_per_million_tokens": round(usd_per_million, 3),
        "token_count": token_count,
        "usd_midpoint": rounded_money(usd_midpoint),
        "usd_label": usd_label,
        "caveat": CODEXBAR_COST_CAVEAT,
        "public_note": f"Sam's money waste so far: {usd_label}",
    }


def api_cost_equivalence(model_breakdown: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Price model-attributed tokens at logged-model Standard short rates."""

    usd_estimate = 0.0
    priced_usage = empty_usage()
    unpriced_usage = empty_usage()
    price_breakdown: dict[str, dict[str, Any]] = {}

    for key, bucket in sorted(model_breakdown.items()):
        usage = normalized_usage(bucket.get("token_usage"))
        model = str(bucket.get("model") or "unknown")
        effort = str(bucket.get("effort") or "unknown")
        rates = MODEL_STANDARD_RATES.get(model)
        if rates is None:
            add_usage(unpriced_usage, usage)
            continue

        uncached_input = max(0, usage["input_tokens"] - usage["cached_input_tokens"])
        bucket_cost = (
            uncached_input * float(rates["input_usd_per_million"] or 0)
            + usage["cached_input_tokens"] * float(rates["cached_input_usd_per_million"] or 0)
            + usage["output_tokens"] * float(rates["output_usd_per_million"] or 0)
        ) / 1_000_000
        usd_estimate += bucket_cost
        add_usage(priced_usage, usage)
        price_breakdown[key] = {
            "model": model,
            "effort": effort,
            "token_usage": usage,
            "uncached_input_tokens": uncached_input,
            "usd_estimate": round(bucket_cost, 2),
        }

    usd_label = money_label(usd_estimate)
    return {
        "label": "Logged-model API cost lens",
        "pricing_tier": "Standard, short context",
        "pricing_as_of": MODEL_PRICE_AS_OF,
        "source_url": PRICE_SOURCE_URL,
        "model_rates": copy.deepcopy(MODEL_STANDARD_RATES),
        "cache_write_tokens": None,
        "cache_write_note": (
            "gpt-5.6-sol cache writes are listed at $6.25 / 1M input tokens, "
            "but retained logs do not expose cache-write tokens, so that rate is not applied."
        ),
        "priced_token_usage": priced_usage,
        "unpriced_token_usage": unpriced_usage,
        "model_effort_price_breakdown": price_breakdown,
        "usd_estimate": round(usd_estimate, 2),
        "usd_midpoint": rounded_money(usd_estimate),
        "usd_label": usd_label,
        "caveat": API_COST_CAVEAT,
        "public_note": f"{usd_label}. {API_COST_CAVEAT}",
    }


def legacy_api_cost_equivalence(token_usage: dict[str, int]) -> dict[str, Any]:
    input_tokens = token_usage.get("input_tokens", 0)
    cached_input_tokens = token_usage.get("cached_input_tokens", 0)
    output_tokens = token_usage.get("output_tokens", 0)
    uncached_input_tokens = max(0, input_tokens - cached_input_tokens)
    usd_estimate = (
        uncached_input_tokens * LEGACY_INPUT_USD_PER_MILLION
        + cached_input_tokens * LEGACY_CACHED_INPUT_USD_PER_MILLION
        + output_tokens * LEGACY_OUTPUT_USD_PER_MILLION
    ) / 1_000_000
    all_cached_usd = (
        input_tokens * LEGACY_CACHED_INPUT_USD_PER_MILLION
        + output_tokens * LEGACY_OUTPUT_USD_PER_MILLION
    ) / 1_000_000
    all_uncached_usd = (
        input_tokens * LEGACY_INPUT_USD_PER_MILLION
        + output_tokens * LEGACY_OUTPUT_USD_PER_MILLION
    ) / 1_000_000

    return {
        "label": "Legacy Codex API cost lens",
        "model": LEGACY_PRICE_MODEL,
        "pricing_as_of": LEGACY_PRICE_AS_OF,
        "source_url": PRICE_SOURCE_URL,
        "input_usd_per_million": LEGACY_INPUT_USD_PER_MILLION,
        "cached_input_usd_per_million": LEGACY_CACHED_INPUT_USD_PER_MILLION,
        "output_usd_per_million": LEGACY_OUTPUT_USD_PER_MILLION,
        "input_tokens": input_tokens,
        "cached_input_tokens": cached_input_tokens,
        "uncached_input_tokens": uncached_input_tokens,
        "output_tokens": output_tokens,
        "reasoning_output_tokens": token_usage.get("reasoning_output_tokens", 0),
        "total_tokens": token_usage.get("total_tokens", 0),
        "usd_estimate": round(usd_estimate, 2),
        "usd_midpoint": rounded_money(usd_estimate),
        "usd_label": money_label(usd_estimate),
        "usd_range_label": money_range_label(all_cached_usd, all_uncached_usd),
        "caveat": LEGACY_API_COST_CAVEAT,
        "public_note": f"{money_label(usd_estimate)}. {LEGACY_API_COST_CAVEAT}",
    }


def model_effort_key(model: str, effort: str) -> str:
    return f"{model or 'unknown'}/{effort or 'unknown'}"


def active_hours_after_cutoff(
    dataset: UsageDataset,
    cutoff: datetime,
    scoped_events: list[CountedUsageEvent],
) -> tuple[float, dict[str, float]]:
    """Count activity from globally unique events, grouped by leaf session."""

    relevant_leaves = {event.leaf_session_id for event in scoped_events}
    scoped_by_leaf: dict[str, list[CountedUsageEvent]] = defaultdict(list)
    for event in scoped_events:
        scoped_by_leaf[event.leaf_session_id].append(event)

    points_by_leaf: dict[str, list[tuple[datetime, str, str, str]]] = defaultdict(list)
    for leaf_id in relevant_leaves:
        record = dataset.sessions.get(leaf_id)
        if record and record.started_at:
            points_by_leaf[leaf_id].append((record.started_at, "unknown", "unknown", "session_start"))

    for context in dataset.contexts_by_turn.values():
        if context.leaf_session_id in relevant_leaves:
            points_by_leaf[context.leaf_session_id].append(
                (context.timestamp, context.model, context.effort, f"context:{context.turn_id}")
            )

    for event in dataset.usage_events:
        if event.leaf_session_id in relevant_leaves:
            points_by_leaf[event.leaf_session_id].append(
                (
                    event.timestamp,
                    event.model,
                    event.effort,
                    f"usage:{event.turn_id or 'legacy'}:{usage_signature(event.total_usage)}",
                )
            )

    hours_by_key: dict[str, float] = defaultdict(float)
    total_hours = 0.0
    for leaf_id in sorted(relevant_leaves):
        points = sorted(set(points_by_leaf.get(leaf_id, [])), key=lambda item: (item[0], item[3]))
        leaf_hours = 0.0
        leaf_hours_by_key: dict[str, float] = defaultdict(float)
        active_model = "unknown"
        active_effort = "unknown"

        for start, end in zip(points, points[1:]):
            start_time, start_model, start_effort, _ = start
            end_time, end_model, end_effort, _ = end
            if start_model != "unknown":
                active_model, active_effort = start_model, start_effort
            if end_time <= cutoff:
                if end_model != "unknown":
                    active_model, active_effort = end_model, end_effort
                continue
            clipped_start = max(start_time, cutoff)
            gap_seconds = (end_time - clipped_start).total_seconds()
            if gap_seconds > 0:
                seconds = min(gap_seconds, MAX_IDLE_GAP_SECONDS)
                # Attribute elapsed work to the context active at the start of
                # the interval. Only the session-start -> first-context gap has
                # no active model and therefore uses the arriving context.
                model = active_model if active_model != "unknown" else end_model
                effort = active_effort if active_model != "unknown" else end_effort
                key = model_effort_key(model, effort)
                hours = seconds / 3600
                leaf_hours += hours
                leaf_hours_by_key[key] += hours
            if end_model != "unknown":
                active_model, active_effort = end_model, end_effort

        if scoped_by_leaf[leaf_id] and leaf_hours < ONE_SHOT_SESSION_HOURS:
            dominant = max(
                scoped_by_leaf[leaf_id],
                key=lambda event: event.usage.get("total_tokens", 0),
            )
            key = model_effort_key(dominant.model, dominant.effort)
            floor_delta = ONE_SHOT_SESSION_HOURS - leaf_hours
            leaf_hours += floor_delta
            leaf_hours_by_key[key] += floor_delta

        total_hours += leaf_hours
        for key, hours in leaf_hours_by_key.items():
            hours_by_key[key] += hours

    return total_hours, dict(hours_by_key)


def build_model_effort_breakdown(
    dataset: UsageDataset,
    cutoff: datetime,
    scoped_events: list[CountedUsageEvent],
    hours_by_key: dict[str, float],
) -> dict[str, dict[str, Any]]:
    buckets: dict[str, dict[str, Any]] = {}
    turn_sets: dict[str, set[str]] = defaultdict(set)
    session_sets: dict[str, set[str]] = defaultdict(set)

    for event in scoped_events:
        key = model_effort_key(event.model, event.effort)
        bucket = buckets.setdefault(
            key,
            {
                "model": event.model,
                "effort": event.effort,
                "turns": 0,
                "sessions": 0,
                "token_usage": empty_usage(),
                "raw_hours": 0.0,
            },
        )
        add_usage(bucket["token_usage"], event.usage)
        if event.turn_id:
            turn_sets[key].add(event.turn_id)
        session_sets[key].add(event.leaf_session_id)

    # Turn counts describe retained ordered contexts, including a context whose
    # final token event is absent from a truncated log. Copied contexts have
    # already been reduced to their globally earliest turn_id occurrence.
    for context in dataset.contexts_by_turn.values():
        if context.timestamp < cutoff:
            continue
        key = model_effort_key(context.model, context.effort)
        buckets.setdefault(
            key,
            {
                "model": context.model,
                "effort": context.effort,
                "turns": 0,
                "sessions": 0,
                "token_usage": empty_usage(),
                "raw_hours": 0.0,
            },
        )
        turn_sets[key].add(context.turn_id)
        session_sets[key].add(context.leaf_session_id)

    for key, hours in hours_by_key.items():
        bucket = buckets.setdefault(
            key,
            {
                "model": key.rsplit("/", 1)[0],
                "effort": key.rsplit("/", 1)[-1],
                "turns": 0,
                "sessions": 0,
                "token_usage": empty_usage(),
                "raw_hours": 0.0,
            },
        )
        bucket["raw_hours"] = round(hours, 4)

    for key, bucket in buckets.items():
        bucket["turns"] = len(turn_sets[key])
        bucket["sessions"] = len(session_sets[key])

    return dict(sorted(buckets.items()))


def audit_scope(dataset: UsageDataset, cutoff: datetime, commit_count: int) -> dict[str, Any]:
    scoped_events = [event for event in dataset.usage_events if event.timestamp >= cutoff]
    raw_usage = empty_usage()
    for event in scoped_events:
        add_usage(raw_usage, event.usage)

    active_hours, hours_by_key = active_hours_after_cutoff(dataset, cutoff, scoped_events)
    model_breakdown = build_model_effort_breakdown(dataset, cutoff, scoped_events, hours_by_key)
    raw_tokens = raw_usage["total_tokens"]
    rounded_tokens = rounded_token_count(raw_tokens)
    hours_count = round(active_hours)
    energy = energy_equivalence(rounded_tokens)

    return {
        "commits": commit_count,
        "sessions": len({event.leaf_session_id for event in scoped_events}),
        "turns": len({event.turn_id for event in scoped_events if event.turn_id}),
        "usage_events": len(scoped_events),
        "raw_token_count": raw_tokens,
        "token_usage": raw_usage,
        "token_count": rounded_tokens,
        "tokens_label": token_label(rounded_tokens),
        "raw_hours": active_hours,
        "hours_count": hours_count,
        "hours_label": str(hours_count),
        "model_effort_breakdown": model_breakdown,
        "energy_equivalence": energy,
        "api_cost_equivalence": api_cost_equivalence(model_breakdown),
        "legacy_api_cost_equivalence": legacy_api_cost_equivalence(raw_usage),
        "codexbar_cost_estimate": codexbar_cost_estimate(rounded_tokens),
    }


def build_model_tracking(dataset: UsageDataset) -> dict[str, Any]:
    contexts = [
        context
        for context in dataset.contexts_by_turn.values()
        if context.timestamp >= GPT_5_6_CUTOVER_UTC
    ]
    contexts.sort(key=lambda item: (item.timestamp, item.turn_id))
    observed: dict[str, int] = defaultdict(int)
    deviations: list[dict[str, str]] = []
    for context in contexts:
        observed[model_effort_key(context.model, context.effort)] += 1
        if context.model != INTENDED_MODEL or context.effort != INTENDED_EFFORT:
            deviations.append(
                {
                    "turn_id": context.turn_id,
                    "timestamp": format_timestamp_utc(context.timestamp),
                    "model": context.model,
                    "effort": context.effort,
                }
            )

    if not contexts:
        status = "unobserved"
    elif deviations:
        status = "deviation_detected"
    else:
        status = "aligned"
    return {
        "intended_model": INTENDED_MODEL,
        "intended_effort": INTENDED_EFFORT,
        "cutover_at": format_timestamp_utc(GPT_5_6_CUTOVER_UTC),
        "cutover_label": "Jul 9, 2026 at 2:28 PM PDT",
        "post_cutover_turns_observed": len(contexts),
        "post_cutover_observed_breakdown": dict(sorted(observed.items())),
        "post_cutover_deviation_count": len(deviations),
        "post_cutover_deviations": deviations,
        "status": status,
        "public_note": f"Dev work now: {INTENDED_MODEL} · {INTENDED_EFFORT}.",
        "caveat": (
            "Checks all deduplicated retained-local turn_context records; missing or deleted local logs "
            "cannot be reconstructed."
        ),
    }


def load_current_ledger(repo_root: Path) -> dict[str, Any]:
    if yaml is None:
        return {}
    ledger_path = repo_root / "_data" / "agentic_usage.yml"
    if not ledger_path.exists():
        return {}
    with ledger_path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


class IndentedSafeDumper(yaml.SafeDumper if yaml else object):
    def increase_indent(self, flow=False, indentless=False):  # type: ignore[override]
        return super().increase_indent(flow, False)


def public_energy_note(energy: dict[str, Any]) -> str:
    return (
        f"Tree lens: about {energy['kwh_midpoint']} kWh, or ~{energy['cut_tree_midpoint']} "
        f"ten-year urban trees' stored carbon. Range: {energy['cut_tree_range']}."
    )


def public_desk_note(energy: dict[str, Any]) -> str:
    return f"roughly {energy['cut_tree_midpoint']} trees cut"


def merge_scope_data(current: dict[str, Any], result: dict[str, Any], *, desk: bool = False) -> dict[str, Any]:
    next_scope = copy.deepcopy(current)
    next_scope["commits"] = result["commits"]
    # A checkout can have complete git history while retained session logs live
    # on another machine or were started from a parent workspace. Keep the
    # previously audited usage snapshot in that case instead of publishing a
    # destructive zero. Commit counts remain independently refreshable.
    if result.get("usage_events", 0) == 0 and int(current.get("token_count") or 0) > 0:
        return next_scope
    for field_name in (
        "token_count",
        "tokens_label",
        "hours_count",
        "hours_label",
        "token_usage",
        "model_effort_breakdown",
    ):
        next_scope[field_name] = result[field_name]

    energy = copy.deepcopy(next_scope.get("energy_equivalence") or {})
    energy.update(result["energy_equivalence"])
    energy.setdefault("label", "Energy lens")
    energy.setdefault(
        "cut_tree_basis",
        "EPA urban tree annual sequestration over 10 years; stored-carbon basis if removed and eventually released.",
    )
    energy["public_note"] = public_desk_note(energy) if desk else public_energy_note(energy)
    next_scope["energy_equivalence"] = energy
    next_scope["api_cost_equivalence"] = result["api_cost_equivalence"]
    next_scope["legacy_api_cost_equivalence"] = result["legacy_api_cost_equivalence"]
    next_scope["codexbar_cost_estimate"] = result["codexbar_cost_estimate"]
    return next_scope


def merge_local_lifetime_data(current: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    next_scope = copy.deepcopy(current)
    # Retained sessions can be unavailable on another machine or when the
    # configured sessions root is missing or partial. This is cumulative
    # retained-local evidence, so fail closed on a zero or lower scan instead
    # of letting cross-machine/deleted-log gaps shrink the public lifetime.
    current_raw = int(current.get("raw_token_count") or current.get("token_count") or 0)
    current_rounded = int(current.get("token_count") or 0)
    result_raw = int(result.get("raw_token_count") or 0)
    result_rounded = int(result.get("token_count") or 0)
    if current_rounded > 0 and (
        result.get("usage_events", 0) == 0 or result_raw < current_raw or result_rounded < current_rounded
    ):
        return next_scope
    for field_name in (
        "sessions",
        "turns",
        "usage_events",
        "raw_token_count",
        "token_count",
        "tokens_label",
        "hours_count",
        "hours_label",
        "token_usage",
        "model_effort_breakdown",
    ):
        next_scope[field_name] = result[field_name]
    next_scope["api_cost_equivalence"] = result["api_cost_equivalence"]
    next_scope.update(
        {
            "label": "Retained local Codex history",
            "since": "2026-06-19 00:00 PDT",
            "since_label": "Jun 19, 2026",
            "confidence": "retained-local-history estimate",
            "note": (
                "Deduplicated retained local Codex sessions since Jun 19, 2026. "
                "This is not account lifetime usage or an actual bill; ChatGPT exposes usage limits, "
                "not a lifetime token counter."
            ),
        }
    )
    return next_scope


def build_ledger_data(
    current: dict[str, Any],
    total: dict[str, Any],
    desk: dict[str, Any],
    since_gpt_5_6: dict[str, Any],
    local_lifetime: dict[str, Any],
    model_tracking: dict[str, Any],
) -> dict[str, Any]:
    next_data = copy.deepcopy(current)
    next_data["updated_at"] = date.today().isoformat()
    next_data["source_note"] = (
        "Estimated from retained local Codex turn/token logs plus git history; "
        "audit with python bin/audit_agentic_usage.py before publish."
    )
    next_data["model_tracking"] = copy.deepcopy(model_tracking)
    next_data["total"] = merge_scope_data(next_data.get("total", {}), total)
    next_data["desk_scene"] = merge_scope_data(next_data.get("desk_scene", {}), desk, desk=True)
    next_data["desk_scene"]["note"] = (
        "Desk commits are path-scoped; tokens and hours are an all-repo retained-session "
        "time-window estimate since the desk cutoff, not desk-only attribution."
    )

    next_data["since_gpt_5_6"] = merge_scope_data(
        next_data.get("since_gpt_5_6", {}),
        since_gpt_5_6,
    )
    next_data["since_gpt_5_6"].update(
        {
            "label": "Since gpt-5.6-sol cutover",
            "since": "2026-07-09 14:28 PDT",
            "since_label": "Jul 9, 2026",
            "confidence": "retained-log estimate",
            "note": (
                "All-repo retained-session usage after the model cutover; commits are repo-wide "
                "and usage is attributed from ordered turn_context records."
            ),
        }
    )
    next_data["local_lifetime"] = merge_local_lifetime_data(
        next_data.get("local_lifetime", {}),
        local_lifetime,
    )
    return next_data


def nested_value(data: dict[str, Any], path: tuple[str, ...]) -> Any:
    current: Any = data
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def check_public_freshness(current: dict[str, Any], proposed: dict[str, Any]) -> list[str]:
    mismatches: list[str] = []
    for scope_name in ("total", "desk_scene", "since_gpt_5_6"):
        current_scope = current.get(scope_name, {}) if isinstance(current, dict) else {}
        proposed_scope = proposed.get(scope_name, {}) if isinstance(proposed, dict) else {}
        for field_path in PUBLIC_CHECK_FIELDS:
            current_value = nested_value(current_scope, field_path)
            proposed_value = nested_value(proposed_scope, field_path)
            if current_value != proposed_value:
                label = ".".join((scope_name, *field_path))
                mismatches.append(f"{label}: current={current_value!r}, expected={proposed_value!r}")

    current_lifetime = current.get("local_lifetime", {}) if isinstance(current, dict) else {}
    proposed_lifetime = proposed.get("local_lifetime", {}) if isinstance(proposed, dict) else {}
    for field_path in LOCAL_LIFETIME_CHECK_FIELDS:
        current_value = nested_value(current_lifetime, field_path)
        proposed_value = nested_value(proposed_lifetime, field_path)
        if current_value != proposed_value:
            label = ".".join(("local_lifetime", *field_path))
            mismatches.append(f"{label}: current={current_value!r}, expected={proposed_value!r}")

    for field_path in MODEL_TRACKING_CHECK_FIELDS:
        current_value = nested_value(current.get("model_tracking", {}), field_path)
        proposed_value = nested_value(proposed.get("model_tracking", {}), field_path)
        if current_value != proposed_value:
            label = ".".join(("model_tracking", *field_path))
            mismatches.append(f"{label}: current={current_value!r}, expected={proposed_value!r}")
    return mismatches


def write_ledger(repo_root: Path, data: dict[str, Any], dry_run: bool = False) -> None:
    if yaml is None:
        raise RuntimeError("PyYAML is required for --write.")
    text = LEDGER_HEADER + "\n" + yaml.dump(
        data,
        Dumper=IndentedSafeDumper,
        width=1000,
        sort_keys=False,
        allow_unicode=True,
    )
    ledger_path = repo_root / "_data" / "agentic_usage.yml"
    if dry_run:
        print("\n--- proposed _data/agentic_usage.yml ---")
        print(text.rstrip())
        return
    ledger_path.write_text(text, encoding="utf-8")
    print(f"\nUpdated {ledger_path}")


def delta_text(current: Any, proposed: Any) -> str:
    if isinstance(current, int) and isinstance(proposed, int):
        delta = proposed - current
        if delta == 0:
            return "no change"
        sign = "+" if delta > 0 else ""
        return f"{sign}{delta}"
    if current == proposed:
        return "no change"
    return f"was {current!r}"


def print_scope(
    name: str,
    result: dict[str, Any],
    current: dict[str, Any],
    *,
    include_commits: bool = True,
) -> None:
    current_scope = current.get(name, {}) if isinstance(current, dict) else {}
    energy = result["energy_equivalence"]
    cost = result["api_cost_equivalence"]
    legacy_cost = result["legacy_api_cost_equivalence"]
    codexbar_cost = result["codexbar_cost_estimate"]
    print(f"\n[{name}]")
    keys = ("commits", "token_count", "tokens_label", "hours_count", "hours_label") if include_commits else (
        "token_count",
        "tokens_label",
        "hours_count",
        "hours_label",
    )
    for key in keys:
        proposed = result[key]
        current_value = current_scope.get(key)
        print(f"{key}: {proposed} ({delta_text(current_value, proposed)})")
    print(f"raw_token_count: {result['raw_token_count']:,}")
    usage = result["token_usage"]
    print(
        "token_usage: "
        f"input={usage['input_tokens']:,}, "
        f"cached_input={usage['cached_input_tokens']:,}, "
        f"output={usage['output_tokens']:,}, "
        f"reasoning_output={usage['reasoning_output_tokens']:,}"
    )
    print(f"raw_hours: {result['raw_hours']:.2f}")
    print(f"sessions_counted: {result['sessions']}")
    print(f"turns_counted: {result['turns']}")
    print(f"usage_events_counted: {result['usage_events']}")
    print("model_effort_breakdown:")
    for key, bucket in result["model_effort_breakdown"].items():
        print(
            f"  {key}: turns={bucket['turns']}, "
            f"tokens={bucket['token_usage']['total_tokens']:,}, hours={bucket['raw_hours']:.2f}"
        )
    print(f"kwh_midpoint: {energy['kwh_midpoint']}")
    print(f"kg_co2e_midpoint: {energy['kg_co2e_midpoint']}")
    print(f"cut_tree_midpoint: {energy['cut_tree_midpoint']}")
    print(f"cut_tree_range: {energy['cut_tree_range']}")
    print(f"api_cost_equivalence: {cost['usd_label']} (logged-model Standard short rates)")
    print(f"legacy_api_cost_equivalence: {legacy_cost['usd_label']} ({LEGACY_PRICE_MODEL})")
    print(
        f"codexbar_cost_estimate: {codexbar_cost['usd_label']} "
        f"({codexbar_cost['usd_per_million_tokens']} USD / 1M tokens)"
    )


def build_json_output(
    root: Path,
    dataset: UsageDataset,
    total: dict[str, Any],
    desk: dict[str, Any],
    since_gpt_5_6: dict[str, Any],
    local_lifetime: dict[str, Any],
    model_tracking: dict[str, Any],
) -> dict[str, Any]:
    return {
        "sessions_root": str(root),
        "repo_sessions": len(dataset.sessions),
        "usage_event_sources": dataset.source_counts,
        "model_tracking": model_tracking,
        "total": total,
        "desk_scene": desk,
        "since_gpt_5_6": since_gpt_5_6,
        "local_lifetime": local_lifetime,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit the site agentic usage ledger without modifying files.")
    parser.add_argument(
        "--sessions-root",
        help="Codex sessions root to scan recursively. Defaults to CODEX_HOME/sessions or ~/.codex/sessions.",
    )
    parser.add_argument("--repo-root", default=".", help="Repository root. Defaults to the current directory.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero if public ledger fields are stale or post-cutover model/effort deviations exist.",
    )
    parser.add_argument("--write", action="store_true", help="Update _data/agentic_usage.yml with the proposed values.")
    parser.add_argument("--dry-run", action="store_true", help="Show the proposed write output without changing files.")
    parser.add_argument(
        "--include-pending-commit",
        action="store_true",
        help="Add one commit to scopes with pending worktree changes so a final uncommitted batch can be estimated before commit.",
    )
    parser.add_argument(
        "--pending-path",
        action="append",
        default=[],
        help="Restrict --include-pending-commit checks to this path. Can be repeated.",
    )
    return parser.parse_args()


def model_deviation_messages(model_tracking: dict[str, Any]) -> list[str]:
    return [
        (
            f"{item['timestamp']} turn {item['turn_id']} used "
            f"{item['model']}/{item['effort']} instead of {INTENDED_MODEL}/{INTENDED_EFFORT}"
        )
        for item in model_tracking.get("post_cutover_deviations", [])
    ]


def model_tracking_check_messages(model_tracking: dict[str, Any]) -> list[str]:
    if model_tracking.get("status") == "unobserved":
        return [
            "No retained post-cutover turn_context records were found; "
            f"cannot verify {INTENDED_MODEL}/{INTENDED_EFFORT}."
        ]
    return model_deviation_messages(model_tracking)


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    sessions_root = sessions_root_from_args(args.sessions_root)

    try:
        require_complete_git_history(repo_root)
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 2

    all_sessions = scan_sessions(sessions_root, None)
    sessions = sessions_matching_repo(all_sessions, REPO_NEEDLE)
    dataset = prepare_usage_dataset(sessions)
    local_dataset = prepare_usage_dataset(all_sessions)
    total_commits = git_commit_count(repo_root, REVAMP_GIT_SINCE, ["."])
    desk_commits = git_commit_count(repo_root, DESK_GIT_SINCE, DESK_PATHS)
    since_gpt_5_6_commits = git_commit_count(repo_root, GPT_5_6_GIT_SINCE, ["."])
    if args.include_pending_commit:
        pending_paths = args.pending_path or ["."]
        if has_pending_changes(repo_root, pending_paths):
            total_commits += 1
            since_gpt_5_6_commits += 1
        desk_pending_paths = paths_matching_scope(pending_paths, DESK_PATHS) if args.pending_path else DESK_PATHS
        if desk_pending_paths and has_pending_changes(repo_root, desk_pending_paths):
            desk_commits += 1

    total = audit_scope(dataset, REVAMP_CUTOFF_UTC, total_commits)
    desk = audit_scope(dataset, DESK_CUTOFF_UTC, desk_commits)
    since_gpt_5_6 = audit_scope(dataset, GPT_5_6_CUTOVER_UTC, since_gpt_5_6_commits)
    local_lifetime = audit_scope(local_dataset, LOCAL_LIFETIME_CUTOFF_UTC, commit_count=0)
    # The declared model/effort default applies to all retained local Codex
    # development work, not only sessions whose first cwd matches this repo.
    # Site usage scopes remain repo-filtered; policy tracking uses the complete
    # deduplicated retained-local context inventory.
    model_tracking = build_model_tracking(local_dataset)

    if args.check:
        if yaml is None:
            print("PyYAML is required for --check.", file=sys.stderr)
            return 2
        current = load_current_ledger(repo_root)
        proposed = build_ledger_data(current, total, desk, since_gpt_5_6, local_lifetime, model_tracking)
        mismatches = check_public_freshness(current, proposed)
        model_issues = model_tracking_check_messages(model_tracking)
        if mismatches or model_issues:
            if mismatches:
                print("Agentic usage ledger public fields are stale:")
                for mismatch in mismatches:
                    print(f"- {mismatch}")
            if model_issues:
                print("Post-cutover model/effort check is not aligned:")
                for issue in model_issues:
                    print(f"- {issue}")
            return 1
        print("Agentic usage ledger public fields are fresh; post-cutover model/effort check is aligned.")
        return 0

    if args.json:
        print(
            json.dumps(
                build_json_output(
                    sessions_root,
                    dataset,
                    total,
                    desk,
                    since_gpt_5_6,
                    local_lifetime,
                    model_tracking,
                ),
                indent=2,
                sort_keys=True,
            )
        )
        return 0

    print("Agentic usage audit")
    print(f"sessions_root: {sessions_root}")
    print(f"local_sessions: {len(all_sessions)}")
    print(f"repo_sessions: {len(sessions)}")
    print(f"usage_event_sources: {json.dumps(dataset.source_counts, sort_keys=True)}")
    print(
        "model_tracking: "
        f"{model_tracking['status']} "
        f"({model_tracking['post_cutover_turns_observed']} retained turns, "
        f"{model_tracking['post_cutover_deviation_count']} deviations)"
    )
    current = load_current_ledger(repo_root)
    if yaml is None:
        print("warning: PyYAML is not installed; skipping comparison with _data/agentic_usage.yml")

    print_scope("total", total, current)
    print_scope("desk_scene", desk, current)
    print_scope("since_gpt_5_6", since_gpt_5_6, current)
    print_scope("local_lifetime", local_lifetime, current, include_commits=False)
    if args.write or args.dry_run:
        next_data = build_ledger_data(current, total, desk, since_gpt_5_6, local_lifetime, model_tracking)
        write_ledger(repo_root, next_data, dry_run=args.dry_run)
    else:
        print("\nThis was a read-only audit. Use --write after reviewing the deltas to update _data/agentic_usage.yml.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
