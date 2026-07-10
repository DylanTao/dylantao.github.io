from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "bin" / "audit_agentic_usage.py"
SPEC = importlib.util.spec_from_file_location("audit_agentic_usage", MODULE_PATH)
assert SPEC and SPEC.loader
audit = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = audit
SPEC.loader.exec_module(audit)


def iso(timestamp: datetime) -> str:
    return timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def usage(total: int, *, cached: int = 0, output: int = 0) -> dict[str, int]:
    return {
        "input_tokens": max(0, total - output),
        "cached_input_tokens": cached,
        "output_tokens": output,
        "reasoning_output_tokens": 0,
        "total_tokens": total,
    }


def session_meta(
    timestamp: datetime,
    session_id: str,
    cwd: str = r"D:\dev\dylantao.github.io",
    *,
    forked_from_id: str | None = None,
    parent_thread_id: str | None = None,
) -> dict:
    payload = {"id": session_id, "cwd": cwd}
    if forked_from_id:
        payload["forked_from_id"] = forked_from_id
    if parent_thread_id:
        payload["source"] = {
            "subagent": {"thread_spawn": {"parent_thread_id": parent_thread_id}}
        }
    return {
        "timestamp": iso(timestamp),
        "type": "session_meta",
        "payload": payload,
    }


def turn_context(
    timestamp: datetime,
    turn_id: str,
    model: str = "gpt-5.5",
    effort: str = "xhigh",
) -> dict:
    return {
        "timestamp": iso(timestamp),
        "type": "turn_context",
        "payload": {"turn_id": turn_id, "model": model, "effort": effort},
    }


def token_event(
    timestamp: datetime,
    total: dict[str, int],
    last: dict[str, int] | None,
) -> dict:
    info = {"total_token_usage": total}
    if last is not None:
        info["last_token_usage"] = last
    return {
        "timestamp": iso(timestamp),
        "type": "event_msg",
        "payload": {"type": "token_count", "info": info},
    }


def write_log(path: Path, events: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(event) for event in events) + "\n", encoding="utf-8")


class SessionAccountingTests(unittest.TestCase):
    def test_parent_and_two_forks_keep_leaf_identity_and_add_parallel_deltas(self) -> None:
        base = datetime(2026, 5, 24, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            parent_total_1 = usage(100)
            parent_total_2 = usage(150)

            write_log(
                root / "2025" / "12" / "31" / "parent.jsonl",
                [
                    session_meta(base, "parent"),
                    turn_context(base + timedelta(seconds=1), "turn-parent"),
                    token_event(base + timedelta(minutes=5), parent_total_1, usage(100)),
                    token_event(base + timedelta(minutes=10), parent_total_2, usage(50)),
                ],
            )
            write_log(
                root / "2026" / "01" / "01" / "child-a.jsonl",
                [
                    session_meta(base + timedelta(minutes=20), "child-a"),
                    session_meta(base + timedelta(minutes=20), "parent"),
                    turn_context(base + timedelta(minutes=20), "turn-parent"),
                    token_event(base + timedelta(minutes=20), parent_total_1, usage(100)),
                    token_event(base + timedelta(minutes=20), parent_total_2, usage(50)),
                    turn_context(base + timedelta(minutes=20, seconds=1), "turn-a"),
                    token_event(base + timedelta(minutes=25), usage(180), usage(30)),
                ],
            )
            write_log(
                root / "2026" / "01" / "01" / "child-b.jsonl",
                [
                    session_meta(base + timedelta(minutes=30), "child-b"),
                    session_meta(base + timedelta(minutes=30), "parent"),
                    turn_context(base + timedelta(minutes=30), "turn-parent"),
                    token_event(base + timedelta(minutes=30), parent_total_1, usage(100)),
                    token_event(base + timedelta(minutes=30), parent_total_2, usage(50)),
                    turn_context(base + timedelta(minutes=30, seconds=1), "turn-b"),
                    token_event(base + timedelta(minutes=35), usage(190), usage(40)),
                ],
            )

            sessions = audit.scan_sessions(root, audit.REPO_NEEDLE)
            self.assertEqual(set(sessions), {"parent", "child-a", "child-b"})
            dataset = audit.prepare_usage_dataset(sessions)
            result = audit.audit_scope(dataset, base - timedelta(seconds=1), commit_count=0)

        self.assertEqual(result["raw_token_count"], 220)
        self.assertEqual(result["turns"], 3)
        self.assertEqual(result["model_effort_breakdown"]["gpt-5.5/xhigh"]["turns"], 3)
        self.assertEqual(dataset.source_counts["copied_or_repeated_snapshots_skipped"], 4)
        self.assertLess(result["raw_hours"], 0.5)

    def test_legacy_cumulative_fallback_keeps_branch_delta_without_copy(self) -> None:
        base = datetime(2026, 5, 24, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            write_log(
                root / "2026" / "parent.jsonl",
                [
                    session_meta(base, "legacy-parent"),
                    token_event(base + timedelta(minutes=5), usage(100), None),
                ],
            )
            write_log(
                root / "2026" / "child.jsonl",
                [
                    session_meta(base + timedelta(minutes=10), "legacy-child"),
                    session_meta(base + timedelta(minutes=10), "legacy-parent"),
                    token_event(base + timedelta(minutes=10, seconds=1), usage(100), None),
                    token_event(base + timedelta(minutes=15), usage(130), None),
                ],
            )
            dataset = audit.prepare_usage_dataset(audit.scan_sessions(root, audit.REPO_NEEDLE))
            result = audit.audit_scope(dataset, base - timedelta(seconds=1), commit_count=0)

        self.assertEqual(result["raw_token_count"], 130)
        self.assertEqual(dataset.source_counts["legacy_cumulative_delta"], 2)
        self.assertEqual(dataset.source_counts["copied_or_repeated_snapshots_skipped"], 1)

    def test_explicit_fork_skips_contextless_copied_token_preamble(self) -> None:
        base = datetime(2026, 7, 9, 21, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            write_log(
                root / "2026" / "parent.jsonl",
                [
                    session_meta(base, "parent"),
                    turn_context(base + timedelta(seconds=1), "parent-turn"),
                    token_event(base + timedelta(minutes=1), usage(100), usage(100)),
                ],
            )
            write_log(
                root / "2026" / "fork.jsonl",
                [
                    session_meta(
                        base + timedelta(minutes=2),
                        "fork",
                        forked_from_id="parent",
                    ),
                    # Real fork shape: copied parent tokens arrive before any
                    # copied or child turn_context, so they must not become
                    # unknown/unknown additive usage.
                    token_event(base + timedelta(minutes=2, seconds=1), usage(100), usage(100)),
                    turn_context(
                        base + timedelta(minutes=2, seconds=2),
                        "fork-turn",
                        "gpt-5.6-sol",
                        "ultra",
                    ),
                    token_event(base + timedelta(minutes=3), usage(130), usage(30)),
                ],
            )
            dataset = audit.prepare_usage_dataset(audit.scan_sessions(root, audit.REPO_NEEDLE))
            result = audit.audit_scope(dataset, base - timedelta(seconds=1), commit_count=0)

        self.assertEqual(result["raw_token_count"], 130)
        self.assertNotIn("unknown/unknown", result["model_effort_breakdown"])
        self.assertEqual(dataset.source_counts["fork_preamble_events_skipped"], 1)

    def test_subagent_parent_source_is_unambiguous_fork_fallback(self) -> None:
        base = datetime(2026, 7, 9, 21, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            write_log(
                root / "2026" / "fork.jsonl",
                [
                    session_meta(base, "fork", parent_thread_id="parent"),
                    token_event(base + timedelta(seconds=1), usage(100), usage(100)),
                    turn_context(base + timedelta(seconds=2), "fork-turn"),
                    token_event(base + timedelta(seconds=3), usage(125), usage(25)),
                ],
            )
            dataset = audit.prepare_usage_dataset(audit.scan_sessions(root, audit.REPO_NEEDLE))

        self.assertEqual(sum(event.usage["total_tokens"] for event in dataset.usage_events), 25)
        self.assertEqual(dataset.source_counts["fork_preamble_events_skipped"], 1)

    def test_context_attribution_model_switch_and_cutover_deviation(self) -> None:
        cutover = audit.GPT_5_6_CUTOVER_UTC
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            write_log(
                root / "2026" / "switch.jsonl",
                [
                    session_meta(cutover - timedelta(minutes=10), "switch"),
                    turn_context(cutover - timedelta(minutes=9), "old", "gpt-5.5", "medium"),
                    token_event(cutover - timedelta(minutes=8), usage(100), usage(100)),
                    turn_context(cutover + timedelta(seconds=1), "new", "gpt-5.6-sol", "ultra"),
                    token_event(cutover + timedelta(minutes=1), usage(150), usage(50)),
                    turn_context(cutover + timedelta(minutes=2), "deviation", "gpt-5.5", "xhigh"),
                    token_event(cutover + timedelta(minutes=3), usage(180), usage(30)),
                ],
            )
            dataset = audit.prepare_usage_dataset(audit.scan_sessions(root, audit.REPO_NEEDLE))
            result = audit.audit_scope(dataset, cutover, commit_count=0)
            tracking = audit.build_model_tracking(dataset)

        self.assertEqual(result["raw_token_count"], 80)
        self.assertEqual(result["model_effort_breakdown"]["gpt-5.6-sol/ultra"]["token_usage"]["total_tokens"], 50)
        self.assertEqual(result["model_effort_breakdown"]["gpt-5.5/xhigh"]["token_usage"]["total_tokens"], 30)
        self.assertGreater(result["model_effort_breakdown"]["gpt-5.5/medium"]["raw_hours"], 0)
        self.assertEqual(tracking["post_cutover_turns_observed"], 2)
        self.assertEqual(tracking["post_cutover_deviation_count"], 1)
        self.assertEqual(tracking["status"], "deviation_detected")
        self.assertEqual(len(audit.model_deviation_messages(tracking)), 1)

    def test_default_sessions_root_scans_all_year_directories(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            codex_home = Path(temporary_directory) / ".codex"
            (codex_home / "sessions" / "2025").mkdir(parents=True)
            (codex_home / "sessions" / "2026").mkdir(parents=True)
            with mock.patch.dict(os.environ, {"CODEX_HOME": str(codex_home)}):
                root = audit.sessions_root_from_args(None)
            self.assertEqual(root, codex_home / "sessions")
            self.assertEqual({path.name for path in root.iterdir()}, {"2025", "2026"})

    def test_missing_post_cutover_context_is_unobserved_not_aligned(self) -> None:
        dataset = audit.UsageDataset(
            sessions={},
            usage_events=[],
            contexts_by_turn={},
            source_counts={},
        )
        tracking = audit.build_model_tracking(dataset)
        self.assertEqual(tracking["status"], "unobserved")
        self.assertEqual(tracking["post_cutover_turns_observed"], 0)
        self.assertEqual(len(audit.model_tracking_check_messages(tracking)), 1)


class PendingChangesTests(unittest.TestCase):
    def test_ignores_status_only_noise_but_detects_unstaged_staged_and_untracked_changes(self) -> None:
        clean = mock.Mock(returncode=0, stdout="", stderr="")
        dirty = mock.Mock(returncode=1, stdout="", stderr="")
        untracked = mock.Mock(returncode=0, stdout="new.txt\n", stderr="")

        with mock.patch.object(audit.subprocess, "run", side_effect=[clean, clean, clean]) as run:
            self.assertFalse(audit.has_pending_changes(REPO_ROOT, ["tracked.txt"]))
            self.assertEqual(run.call_args_list[0].args[0][:3], ["git", "diff", "--quiet"])
            self.assertEqual(run.call_args_list[1].args[0][:4], ["git", "diff", "--cached", "--quiet"])
            self.assertEqual(run.call_args_list[2].args[0][:4], ["git", "ls-files", "--others", "--exclude-standard"])

        with mock.patch.object(audit.subprocess, "run", side_effect=[dirty]):
            self.assertTrue(audit.has_pending_changes(REPO_ROOT, ["tracked.txt"]))
        with mock.patch.object(audit.subprocess, "run", side_effect=[clean, dirty]):
            self.assertTrue(audit.has_pending_changes(REPO_ROOT, ["tracked.txt"]))
        with mock.patch.object(audit.subprocess, "run", side_effect=[clean, clean, untracked]):
            self.assertTrue(audit.has_pending_changes(REPO_ROOT, ["tracked.txt"]))


class PriceLensTests(unittest.TestCase):
    def test_public_money_rounding_does_not_churn_on_single_dollar_drift(self) -> None:
        self.assertEqual(audit.rounded_money(71.1), 70)
        self.assertEqual(audit.rounded_money(72.4), 70)
        self.assertEqual(audit.rounded_money(27.4), 25)
        self.assertEqual(audit.rounded_money(8.6), 9)

    def test_logged_model_short_standard_rates_and_legacy_lens_are_separate(self) -> None:
        breakdown = {
            "gpt-5.5/xhigh": {
                "model": "gpt-5.5",
                "effort": "xhigh",
                "token_usage": usage(1_100_000, cached=400_000, output=100_000),
            },
            "gpt-5.6-sol/ultra": {
                "model": "gpt-5.6-sol",
                "effort": "ultra",
                "token_usage": usage(2_200_000, cached=1_000_000, output=200_000),
            },
        }
        current = audit.api_cost_equivalence(breakdown)
        legacy = audit.legacy_api_cost_equivalence(
            usage(1_100_000, cached=400_000, output=100_000)
        )

        self.assertAlmostEqual(current["usd_estimate"], 17.70)
        self.assertEqual(current["model_rates"]["gpt-5.6-sol"]["cache_write_input_usd_per_million"], 6.25)
        self.assertIsNone(current["cache_write_tokens"])
        self.assertIn("long-context thresholds", current["caveat"])
        self.assertAlmostEqual(legacy["usd_estimate"], 2.52)
        self.assertEqual(legacy["model"], "gpt-5.3-codex")

    def test_unlogged_model_tokens_remain_visible_and_unpriced(self) -> None:
        current = audit.api_cost_equivalence(
            {
                "unknown/unknown": {
                    "model": "unknown",
                    "effort": "unknown",
                    "token_usage": usage(1234),
                }
            }
        )
        self.assertEqual(current["usd_estimate"], 0)
        self.assertEqual(current["unpriced_token_usage"]["total_tokens"], 1234)


if __name__ == "__main__":
    unittest.main()
