#!/usr/bin/env python
"""Audit Codex/agentic usage counters for this customized site.

The default mode is read-only. Use `--write` only after reviewing the proposed
values and `--include-pending-commit` when estimating the final uncommitted
publish batch.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover - handled in compare output.
    yaml = None


REPO_NEEDLE = "dylantao.github.io"
MAX_IDLE_GAP_SECONDS = 45 * 60
ONE_SHOT_SESSION_HOURS = 0.05

REVAMP_CUTOFF_UTC = datetime(2026, 5, 23, 1, 5, tzinfo=timezone.utc)
DESK_CUTOFF_UTC = datetime(2026, 6, 17, 3, 0, tzinfo=timezone.utc)
REVAMP_GIT_SINCE = "2026-05-22T18:05:00-07:00"
DESK_GIT_SINCE = "2026-06-16T20:00:00-07:00"
DESK_PATHS = [
    "assets/js/home.js",
    "_sass/_home.scss",
    "_includes/home/hero.liquid",
    "docs/homepage-desk-scene-brief.md",
    "assets/img/home",
]

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

CODEX_PRICE_MODEL = "gpt-5.3-codex"
CODEX_PRICE_SOURCE_URL = "https://developers.openai.com/api/docs/pricing"
CODEX_PRICE_AS_OF = "2026-06-19"
CODEX_INPUT_USD_PER_MILLION = 1.75
CODEX_CACHED_INPUT_USD_PER_MILLION = 0.175
CODEX_OUTPUT_USD_PER_MILLION = 14.00
API_COST_CAVEAT = "API list-price equivalence only; actual Codex product or subscription cost is not exposed."
LEDGER_HEADER = """# Estimated Codex/agentic work ledger for the customized Sirui/Dylan site.
# Update this with docs/agentic-usage-ledger.md after substantial site work.
"""


@dataclass
class SessionRecord:
    session_id: str
    paths: set[Path] = field(default_factory=set)
    events: list[datetime] = field(default_factory=list)
    token_events: list[tuple[datetime, dict[str, int]]] = field(default_factory=list)


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


def sessions_root_from_args(value: str | None) -> Path:
    if value:
        return Path(value).expanduser()

    codex_home = os.environ.get("CODEX_HOME")
    if codex_home:
        return Path(codex_home).expanduser() / "sessions" / "2026"

    return Path.home() / ".codex" / "sessions" / "2026"


def scan_sessions(root: Path, repo_needle: str) -> dict[str, SessionRecord]:
    sessions: dict[str, SessionRecord] = {}
    if not root.exists():
        return sessions

    for path in sorted(root.rglob("*.jsonl")):
        session_id = None
        cwd_matches = False
        events: list[datetime] = []
        token_events: list[tuple[datetime, dict[str, int]]] = []

        try:
            with path.open("r", encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    timestamp = parse_timestamp(event.get("timestamp"))
                    if timestamp:
                        events.append(timestamp)

                    if event.get("type") == "session_meta":
                        payload = event.get("payload") or {}
                        session_id = payload.get("id") or session_id
                        cwd = str(payload.get("cwd") or "")
                        if repo_needle.lower() in cwd.lower():
                            cwd_matches = True

                    if event.get("type") != "event_msg" or not timestamp:
                        continue
                    payload = event.get("payload") or {}
                    if payload.get("type") != "token_count":
                        continue
                    usage = ((payload.get("info") or {}).get("total_token_usage") or {})
                    token_snapshot = {
                        field_name: int(usage.get(field_name) or 0)
                        for field_name in TOKEN_USAGE_FIELDS
                    }
                    if token_snapshot["total_tokens"] > 0:
                        token_events.append((timestamp, token_snapshot))
        except OSError as error:
            print(f"warning: could not read {path}: {error}", file=sys.stderr)
            continue

        if not cwd_matches:
            continue

        record_id = session_id or str(path)
        record = sessions.setdefault(record_id, SessionRecord(session_id=record_id))
        record.paths.add(path)
        record.events.extend(events)
        record.token_events.extend(token_events)

    return sessions


def sorted_token_events(record: SessionRecord, field_name: str) -> list[tuple[datetime, int]]:
    events = [
        (timestamp, snapshot.get(field_name, 0))
        for timestamp, snapshot in record.token_events
    ]
    return sorted(events, key=lambda item: item[0])


def interpolate_token_count(record: SessionRecord, cutoff: datetime, field_name: str) -> int:
    token_events = sorted_token_events(record, field_name)
    if not token_events:
        return 0

    before = [(timestamp, value) for timestamp, value in token_events if timestamp <= cutoff]
    after = [(timestamp, value) for timestamp, value in token_events if timestamp > cutoff]

    if before and after:
        before_timestamp, before_value = before[-1]
        after_timestamp, after_value = after[0]
        elapsed = (after_timestamp - before_timestamp).total_seconds()
        if elapsed <= 0:
            return before_value
        progress = (cutoff - before_timestamp).total_seconds() / elapsed
        progress = max(0, min(1, progress))
        return round(before_value + max(0, after_value - before_value) * progress)

    if before:
        return max(value for _, value in before)

    first_after_timestamp, first_after_value = after[0]
    first_event_timestamp = min(record.events) if record.events else first_after_timestamp
    if first_event_timestamp >= cutoff:
        return 0

    elapsed = (first_after_timestamp - first_event_timestamp).total_seconds()
    if elapsed <= 0:
        return 0

    progress = (cutoff - first_event_timestamp).total_seconds() / elapsed
    progress = max(0, min(1, progress))
    return round(first_after_value * progress)


def tokens_after_cutoff(record: SessionRecord, cutoff: datetime, field_name: str = "total_tokens") -> int:
    token_events = sorted_token_events(record, field_name)
    if not token_events or token_events[-1][0] <= cutoff:
        return 0

    final_value = max(value for timestamp, value in token_events if timestamp > cutoff)
    baseline = interpolate_token_count(record, cutoff, field_name)
    return max(0, final_value - baseline)


def token_usage_after_cutoff(record: SessionRecord, cutoff: datetime) -> dict[str, int]:
    return {
        field_name: tokens_after_cutoff(record, cutoff, field_name)
        for field_name in TOKEN_USAGE_FIELDS
    }


def active_hours_after_cutoff(record: SessionRecord, cutoff: datetime, counted_tokens: int) -> float:
    events = sorted(set(record.events))
    if not events or events[-1] < cutoff:
        return 0.0

    active_seconds = 0.0
    for start, end in zip(events, events[1:]):
        if end <= cutoff:
            continue
        clipped_start = max(start, cutoff)
        gap_seconds = (end - clipped_start).total_seconds()
        if gap_seconds > 0:
            active_seconds += min(gap_seconds, MAX_IDLE_GAP_SECONDS)

    active_hours = active_seconds / 3600
    has_post_cutoff_event = any(timestamp >= cutoff for timestamp in events)
    if has_post_cutoff_event and (counted_tokens > 0 or len(events) == 1) and active_hours < ONE_SHOT_SESSION_HOURS:
        return ONE_SHOT_SESSION_HOURS
    return active_hours


def git_commit_count(repo_root: Path, since: str, paths: list[str]) -> int:
    command = ["git", "rev-list", "--count", f"--since={since}", "HEAD", "--", *paths]
    result = subprocess.run(command, cwd=repo_root, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git command failed: {' '.join(command)}")
    return int(result.stdout.strip())


def has_pending_changes(repo_root: Path, paths: list[str]) -> bool:
    command = ["git", "status", "--porcelain=v1", "--untracked-files=all", "--", *paths]
    result = subprocess.run(command, cwd=repo_root, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git command failed: {' '.join(command)}")
    return bool(result.stdout.strip())


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
    elif value >= 100:
        step = 10
    else:
        step = 1
    return int(round(value / step) * step)


def money_label(value: float) -> str:
    rounded = rounded_money(value)
    if rounded >= 1000:
        return f"~${rounded / 1000:.1f}K API cosplay"
    return f"~${rounded} API cosplay"


def money_range_label(low: float, high: float) -> str:
    low_label = money_label(low).removeprefix("~").removesuffix(" API cosplay")
    high_label = money_label(high).removeprefix("~").removesuffix(" API cosplay")
    return f"{low_label}-{high_label}"


def api_cost_equivalence(token_usage: dict[str, int]) -> dict[str, Any]:
    input_tokens = token_usage.get("input_tokens", 0)
    cached_input_tokens = token_usage.get("cached_input_tokens", 0)
    output_tokens = token_usage.get("output_tokens", 0)
    uncached_input_tokens = max(0, input_tokens - cached_input_tokens)
    usd_midpoint = (
        uncached_input_tokens * CODEX_INPUT_USD_PER_MILLION
        + cached_input_tokens * CODEX_CACHED_INPUT_USD_PER_MILLION
        + output_tokens * CODEX_OUTPUT_USD_PER_MILLION
    ) / 1_000_000
    all_cached_usd = (
        input_tokens * CODEX_CACHED_INPUT_USD_PER_MILLION
        + output_tokens * CODEX_OUTPUT_USD_PER_MILLION
    ) / 1_000_000
    all_uncached_usd = (
        input_tokens * CODEX_INPUT_USD_PER_MILLION
        + output_tokens * CODEX_OUTPUT_USD_PER_MILLION
    ) / 1_000_000

    return {
        "label": "Codex API cost lens",
        "model": CODEX_PRICE_MODEL,
        "pricing_as_of": CODEX_PRICE_AS_OF,
        "source_url": CODEX_PRICE_SOURCE_URL,
        "input_usd_per_million": CODEX_INPUT_USD_PER_MILLION,
        "cached_input_usd_per_million": CODEX_CACHED_INPUT_USD_PER_MILLION,
        "output_usd_per_million": CODEX_OUTPUT_USD_PER_MILLION,
        "input_tokens": input_tokens,
        "cached_input_tokens": cached_input_tokens,
        "uncached_input_tokens": uncached_input_tokens,
        "output_tokens": output_tokens,
        "reasoning_output_tokens": token_usage.get("reasoning_output_tokens", 0),
        "total_tokens": token_usage.get("total_tokens", 0),
        "usd_midpoint": rounded_money(usd_midpoint),
        "usd_label": money_label(usd_midpoint),
        "usd_range_label": money_range_label(all_cached_usd, all_uncached_usd),
        "caveat": API_COST_CAVEAT,
        "public_note": f"{money_label(usd_midpoint)}. {API_COST_CAVEAT}",
    }


def audit_scope(
    sessions: dict[str, SessionRecord],
    cutoff: datetime,
    commit_count: int,
) -> dict[str, Any]:
    raw_usage = {field_name: 0 for field_name in TOKEN_USAGE_FIELDS}
    active_hours = 0.0
    counted_sessions = 0

    for record in sessions.values():
        token_usage = token_usage_after_cutoff(record, cutoff)
        hours = active_hours_after_cutoff(record, cutoff, token_usage["total_tokens"])
        if token_usage["total_tokens"] or hours:
            counted_sessions += 1
        for field_name, value in token_usage.items():
            raw_usage[field_name] += value
        active_hours += hours

    raw_tokens = raw_usage["total_tokens"]
    rounded_tokens = rounded_token_count(raw_tokens)
    hours_count = round(active_hours)
    energy = energy_equivalence(rounded_tokens)
    cost = api_cost_equivalence(raw_usage)

    return {
        "commits": commit_count,
        "sessions": counted_sessions,
        "raw_token_count": raw_tokens,
        "token_usage": raw_usage,
        "token_count": rounded_tokens,
        "tokens_label": token_label(rounded_tokens),
        "raw_hours": active_hours,
        "hours_count": hours_count,
        "hours_label": str(hours_count),
        "energy_equivalence": energy,
        "api_cost_equivalence": cost,
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
    next_scope["token_count"] = result["token_count"]
    next_scope["tokens_label"] = result["tokens_label"]
    next_scope["hours_count"] = result["hours_count"]
    next_scope["hours_label"] = result["hours_label"]
    next_scope["token_usage"] = result["token_usage"]

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
    return next_scope


def build_ledger_data(current: dict[str, Any], total: dict[str, Any], desk: dict[str, Any]) -> dict[str, Any]:
    next_data = copy.deepcopy(current)
    next_data["updated_at"] = date.today().isoformat()
    next_data["source_note"] = "Estimated from local Codex logs plus git history; audit with python bin/audit_agentic_usage.py before publish."
    next_data["total"] = merge_scope_data(next_data.get("total", {}), total)
    next_data["desk_scene"] = merge_scope_data(next_data.get("desk_scene", {}), desk, desk=True)
    return next_data


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


def print_scope(name: str, result: dict[str, Any], current: dict[str, Any]) -> None:
    current_scope = current.get(name, {}) if isinstance(current, dict) else {}
    energy = result["energy_equivalence"]
    cost = result["api_cost_equivalence"]
    print(f"\n[{name}]")
    for key in ("commits", "token_count", "tokens_label", "hours_count", "hours_label"):
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
    print(f"kwh_midpoint: {energy['kwh_midpoint']}")
    print(f"kg_co2e_midpoint: {energy['kg_co2e_midpoint']}")
    print(f"cut_tree_midpoint: {energy['cut_tree_midpoint']}")
    print(f"cut_tree_range: {energy['cut_tree_range']}")
    print(f"api_cost_equivalence: {cost['usd_label']} ({cost['usd_range_label']} all-cached/all-uncached range)")


def build_json_output(root: Path, total: dict[str, Any], desk: dict[str, Any]) -> dict[str, Any]:
    return {
        "sessions_root": str(root),
        "total": total,
        "desk_scene": desk,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit the site agentic usage ledger without modifying files.")
    parser.add_argument(
        "--sessions-root",
        help="Codex sessions root to scan. Defaults to CODEX_HOME/sessions/2026 or ~/.codex/sessions/2026.",
    )
    parser.add_argument("--repo-root", default=".", help="Repository root. Defaults to the current directory.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    parser.add_argument("--write", action="store_true", help="Update _data/agentic_usage.yml with the proposed values.")
    parser.add_argument("--dry-run", action="store_true", help="Show the proposed write output without changing files.")
    parser.add_argument(
        "--include-pending-commit",
        action="store_true",
        help="Add one commit to scopes with pending worktree changes so a final uncommitted batch can be estimated before commit.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    sessions_root = sessions_root_from_args(args.sessions_root)

    sessions = scan_sessions(sessions_root, REPO_NEEDLE)
    total_commits = git_commit_count(repo_root, REVAMP_GIT_SINCE, ["."])
    desk_commits = git_commit_count(repo_root, DESK_GIT_SINCE, DESK_PATHS)
    if args.include_pending_commit:
        if has_pending_changes(repo_root, ["."]):
            total_commits += 1
        if has_pending_changes(repo_root, DESK_PATHS):
            desk_commits += 1

    total = audit_scope(sessions, REVAMP_CUTOFF_UTC, total_commits)
    desk = audit_scope(sessions, DESK_CUTOFF_UTC, desk_commits)

    if args.json:
        print(json.dumps(build_json_output(sessions_root, total, desk), indent=2, sort_keys=True))
        return 0

    print("Agentic usage audit")
    print(f"sessions_root: {sessions_root}")
    print(f"repo_sessions: {len(sessions)}")
    current = load_current_ledger(repo_root)
    if yaml is None:
        print("warning: PyYAML is not installed; skipping comparison with _data/agentic_usage.yml")

    print_scope("total", total, current)
    print_scope("desk_scene", desk, current)
    if args.write or args.dry_run:
        next_data = build_ledger_data(current, total, desk)
        write_ledger(repo_root, next_data, dry_run=args.dry_run)
    else:
        print("\nThis was a read-only audit. Use --write after reviewing the deltas to update _data/agentic_usage.yml.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
