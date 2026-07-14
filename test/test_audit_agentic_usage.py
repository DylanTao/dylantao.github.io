from __future__ import annotations

import copy
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


def counted_event(
    token_usage: dict[str, int],
    *,
    model: str = "gpt-5.5",
    effort: str = "xhigh",
    ordinal: int = 1,
) -> object:
    return audit.CountedUsageEvent(
        timestamp=datetime(2026, 7, 12, tzinfo=timezone.utc),
        leaf_session_id="session",
        turn_id=f"turn-{ordinal}",
        model=model,
        effort=effort,
        usage=token_usage,
        total_usage=token_usage,
        source="last_token_usage",
        path=Path(f"session-{ordinal}.jsonl"),
        ordinal=ordinal,
    )


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
        self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 0)
        self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 1)
        self.assertEqual(tracking["status"], "deviation_detected")
        self.assertEqual(len(audit.model_deviation_messages(tracking)), 1)

    def test_exact_known_deviation_is_acknowledged_without_hiding_observed_values(self) -> None:
        turn_id = "019f4f8c-36c0-7dd1-9bab-e8b3b935ef3f"
        policy = audit.MODEL_DEVIATION_ACKNOWLEDGMENTS[turn_id]
        timestamp = audit.parse_timestamp(policy["timestamp"])
        assert timestamp is not None
        context = audit.TurnContextRecord(
            timestamp=timestamp,
            leaf_session_id="known-deviation",
            turn_id=turn_id,
            model=policy["model"],
            effort=policy["effort"],
            path=Path("known-deviation.jsonl"),
            ordinal=1,
        )
        tracking = audit.build_model_tracking(
            audit.UsageDataset(
                sessions={},
                usage_events=[],
                contexts_by_turn={turn_id: context},
                source_counts={},
            )
        )

        self.assertEqual(tracking["status"], "acknowledged_deviations")
        self.assertEqual(tracking["post_cutover_deviation_count"], 1)
        self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 1)
        self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 0)
        self.assertEqual(audit.model_tracking_check_messages(tracking), [])
        rendered = tracking["post_cutover_deviations"][0]
        self.assertEqual(rendered["model"], "gpt-5.4-mini")
        self.assertEqual(rendered["effort"], "ultra")
        self.assertTrue(rendered["acknowledged"])
        self.assertTrue(rendered["acknowledgment"]["signature_matches"])
        self.assertTrue(rendered["acknowledgment"]["reason"])
        self.assertTrue(rendered["acknowledgment"]["provenance"])

    def test_acknowledgment_policy_has_complete_versioned_turn_entries(self) -> None:
        self.assertEqual(audit.MODEL_DEVIATION_ACKNOWLEDGMENT_POLICY_VERSION, 1)
        self.assertEqual(len(audit.MODEL_DEVIATION_ACKNOWLEDGMENTS), 5)
        required_fields = {
            "timestamp",
            "model",
            "effort",
            "acknowledged_at",
            "reason",
            "provenance",
        }
        for turn_id, policy in audit.MODEL_DEVIATION_ACKNOWLEDGMENTS.items():
            with self.subTest(turn_id=turn_id):
                self.assertTrue(required_fields.issubset(policy))
                self.assertTrue(all(policy[field_name].strip() for field_name in required_fields))
                self.assertIsNotNone(audit.parse_timestamp(policy["timestamp"]))
                self.assertEqual(
                    datetime.strptime(policy["acknowledged_at"], "%Y-%m-%d").strftime("%Y-%m-%d"),
                    policy["acknowledged_at"],
                )

    def test_known_deviation_with_changed_signature_fails_closed(self) -> None:
        turn_id = "019f4f8c-36c0-7dd1-9bab-e8b3b935ef3f"
        policy = audit.MODEL_DEVIATION_ACKNOWLEDGMENTS[turn_id]
        timestamp = audit.parse_timestamp(policy["timestamp"])
        assert timestamp is not None

        mutations = {
            "timestamp": timestamp + timedelta(seconds=1),
            "model": "gpt-5.5",
            "effort": "high",
        }
        for field_name, replacement in mutations.items():
            with self.subTest(field_name=field_name):
                fields = {
                    "timestamp": timestamp,
                    "model": policy["model"],
                    "effort": policy["effort"],
                }
                fields[field_name] = replacement
                context = audit.TurnContextRecord(
                    timestamp=fields["timestamp"],
                    leaf_session_id=f"mutated-{field_name}",
                    turn_id=turn_id,
                    model=fields["model"],
                    effort=fields["effort"],
                    path=Path(f"mutated-{field_name}.jsonl"),
                    ordinal=1,
                )
                tracking = audit.build_model_tracking(
                    audit.UsageDataset(
                        sessions={},
                        usage_events=[],
                        contexts_by_turn={turn_id: context},
                        source_counts={},
                    )
                )

                self.assertEqual(tracking["status"], "deviation_detected")
                self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 0)
                self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 1)
                rendered = tracking["post_cutover_deviations"][0]
                self.assertFalse(rendered["acknowledged"])
                self.assertFalse(rendered["acknowledgment"]["signature_matches"])
                self.assertEqual(len(audit.model_tracking_check_messages(tracking)), 1)

    def test_new_unknown_deviation_fails_closed(self) -> None:
        turn_id = "new-provider-managed-worker"
        context = audit.TurnContextRecord(
            timestamp=audit.GPT_5_6_CUTOVER_UTC + timedelta(minutes=1),
            leaf_session_id="unknown-deviation",
            turn_id=turn_id,
            model="gpt-5.6-sol",
            effort="medium",
            path=Path("unknown-deviation.jsonl"),
            ordinal=1,
        )
        tracking = audit.build_model_tracking(
            audit.UsageDataset(
                sessions={},
                usage_events=[],
                contexts_by_turn={turn_id: context},
                source_counts={},
            )
        )

        self.assertEqual(tracking["status"], "deviation_detected")
        self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 0)
        self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 1)
        issues = audit.model_tracking_check_messages(tracking)
        self.assertEqual(len(issues), 1)
        self.assertIn(turn_id, issues[0])
        self.assertIn("not acknowledged", issues[0])

    def test_default_sessions_root_scans_all_year_directories(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            codex_home = Path(temporary_directory) / ".codex"
            (codex_home / "sessions" / "2025").mkdir(parents=True)
            (codex_home / "sessions" / "2026").mkdir(parents=True)
            with mock.patch.dict(os.environ, {"CODEX_HOME": str(codex_home)}):
                root = audit.sessions_root_from_args(None)
            self.assertEqual(root, codex_home / "sessions")
            self.assertEqual({path.name for path in root.iterdir()}, {"2025", "2026"})

    def test_local_history_scan_keeps_all_cwds_while_repo_scope_stays_filtered(self) -> None:
        base = datetime(2026, 6, 20, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            write_log(
                root / "site.jsonl",
                [
                    session_meta(base, "site"),
                    turn_context(base + timedelta(seconds=1), "site-turn"),
                    token_event(base + timedelta(seconds=2), usage(10), usage(10)),
                ],
            )
            write_log(
                root / "other.jsonl",
                [
                    session_meta(base, "other", cwd=r"D:\dev\another-project"),
                    turn_context(base + timedelta(seconds=1), "other-turn"),
                    token_event(base + timedelta(seconds=2), usage(20), usage(20)),
                ],
            )
            all_sessions = audit.scan_sessions(root, None)
            site_sessions = audit.sessions_matching_repo(all_sessions, audit.REPO_NEEDLE)

        self.assertEqual(set(all_sessions), {"site", "other"})
        self.assertEqual(set(site_sessions), {"site"})
        local = audit.audit_scope(
            audit.prepare_usage_dataset(all_sessions),
            base - timedelta(seconds=1),
            commit_count=0,
        )
        self.assertEqual(local["raw_token_count"], 30)
        self.assertEqual(local["sessions"], 2)

    def test_model_tracking_uses_all_local_contexts_when_repo_scope_is_empty(self) -> None:
        base = audit.GPT_5_6_CUTOVER_UTC + timedelta(minutes=1)
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            write_log(
                root / "other.jsonl",
                [
                    session_meta(base, "other", cwd=r"D:\dev\another-project"),
                    turn_context(base + timedelta(seconds=1), "other-turn", "gpt-5.6-sol", "ultra"),
                    token_event(base + timedelta(seconds=2), usage(20), usage(20)),
                ],
            )
            all_sessions = audit.scan_sessions(root, None)
            repo_sessions = audit.sessions_matching_repo(all_sessions, audit.REPO_NEEDLE)
            local_tracking = audit.build_model_tracking(audit.prepare_usage_dataset(all_sessions))

        self.assertEqual(repo_sessions, {})
        self.assertEqual(local_tracking["status"], "aligned")
        self.assertEqual(local_tracking["post_cutover_turns_observed"], 1)
        self.assertEqual(local_tracking["post_cutover_deviation_count"], 0)

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

    def test_shallow_history_fails_closed_before_ledger_math(self) -> None:
        shallow = mock.Mock(returncode=0, stdout="true\n", stderr="")
        with mock.patch.object(audit.subprocess, "run", return_value=shallow):
            with self.assertRaisesRegex(RuntimeError, "complete git history"):
                audit.require_complete_git_history(REPO_ROOT)

    def test_missing_repo_usage_preserves_previous_audited_totals(self) -> None:
        empty_dataset = audit.UsageDataset(
            sessions={},
            usage_events=[],
            contexts_by_turn={},
            source_counts={},
        )
        result = audit.audit_scope(empty_dataset, audit.REVAMP_CUTOFF_UTC, commit_count=42)
        previous = {
            "commits": 41,
            "token_count": 3_120_000_000,
            "tokens_label": "3.12B",
            "hours_count": 259,
            "hours_label": "259",
        }
        merged = audit.merge_scope_data(previous, result)
        self.assertEqual(merged["commits"], 42)
        self.assertEqual(merged["token_count"], 3_120_000_000)
        self.assertEqual(merged["tokens_label"], "3.12B")

    def test_missing_local_usage_preserves_previous_retained_snapshot(self) -> None:
        empty_dataset = audit.UsageDataset(
            sessions={},
            usage_events=[],
            contexts_by_turn={},
            source_counts={},
        )
        result = audit.audit_scope(empty_dataset, audit.LOCAL_LIFETIME_CUTOFF_UTC, commit_count=0)
        previous = {
            "sessions": 305,
            "turns": 1_100,
            "usage_events": 48_000,
            "raw_token_count": 7_020_000_000,
            "token_count": 7_020_000_000,
            "tokens_label": "7.02B",
            "hours_count": 347,
            "hours_label": "347",
        }
        merged = audit.merge_local_lifetime_data(previous, result)
        self.assertEqual(merged, previous)

    def test_partial_lower_local_scan_preserves_previous_retained_snapshot(self) -> None:
        previous = {
            "sessions": 305,
            "usage_events": 48_000,
            "raw_token_count": 7_020_000_000,
            "token_count": 7_020_000_000,
            "tokens_label": "7.02B",
        }
        partial_result = {
            "usage_events": 100,
            "raw_token_count": 6_500_000_000,
            "token_count": 6_500_000_000,
        }
        self.assertEqual(audit.merge_local_lifetime_data(previous, partial_result), previous)

    def test_genuinely_higher_local_scan_refreshes_retained_snapshot(self) -> None:
        base = audit.LOCAL_LIFETIME_CUTOFF_UTC + timedelta(days=1)
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            write_log(
                root / "fresh.jsonl",
                [
                    session_meta(base, "fresh", cwd=r"D:\dev\another-project"),
                    turn_context(base + timedelta(seconds=1), "fresh-turn", "gpt-5.5", "xhigh"),
                    token_event(base + timedelta(seconds=2), usage(8_100_000_000), usage(8_100_000_000)),
                ],
            )
            result = audit.audit_scope(
                audit.prepare_usage_dataset(audit.scan_sessions(root, None)),
                audit.LOCAL_LIFETIME_CUTOFF_UTC,
                commit_count=0,
            )

        previous = {
            "raw_token_count": 7_020_000_000,
            "token_count": 7_020_000_000,
            "tokens_label": "7.02B",
        }
        merged = audit.merge_local_lifetime_data(previous, result)
        self.assertEqual(merged["raw_token_count"], 8_100_000_000)
        self.assertEqual(merged["token_count"], 8_100_000_000)
        self.assertEqual(merged["usage_events"], 1)

    def test_fresh_global_model_tracking_replaces_stale_value_without_repo_usage(self) -> None:
        empty_dataset = audit.UsageDataset(
            sessions={},
            usage_events=[],
            contexts_by_turn={},
            source_counts={},
        )
        empty_result = audit.audit_scope(empty_dataset, audit.REVAMP_CUTOFF_UTC, commit_count=0)
        fresh_tracking = {
            "status": "aligned",
            "post_cutover_turns_observed": 9,
            "post_cutover_deviation_count": 0,
        }
        proposed = audit.build_ledger_data(
            {"model_tracking": {"status": "unobserved", "post_cutover_turns_observed": 0}},
            empty_result,
            empty_result,
            empty_result,
            empty_result,
            fresh_tracking,
        )
        self.assertEqual(proposed["model_tracking"], fresh_tracking)


class PriceLensTests(unittest.TestCase):
    @staticmethod
    def account_snapshot(source_as_of: str = "2026-07-12T18:40:36Z") -> dict[str, object]:
        observed_at = datetime.fromisoformat(source_as_of.replace("Z", "+00:00"))
        start = observed_at - timedelta(days=29)
        daily = [
            {
                "date": (start + timedelta(days=index)).date().isoformat(),
                "tokens": (index + 1) * 100,
            }
            for index in range(30)
        ]
        return audit.refresh_account_lifetime_data(
            {
                "source_as_of": source_as_of,
                "token_count": 20_860_271_364,
                "tokens_label": "20.9B",
                "tasks": 797,
                "peak_daily_tokens": 1_748_633_377,
                "peak_daily_date": "2026-07-01",
                "recent_activity": {"partial_last_day": True, "daily": daily},
            },
            {
                "api_cost_equivalence": {
                    "priced_token_usage": {"total_tokens": 10_000_000},
                    "usd_estimate": 8.4,
                }
            },
        )

    def test_public_money_rounding_does_not_churn_on_single_dollar_drift(self) -> None:
        self.assertEqual(audit.rounded_money(71.1), 70)
        self.assertEqual(audit.rounded_money(72.4), 70)
        self.assertEqual(audit.rounded_money(27.4), 25)
        self.assertEqual(audit.rounded_money(8.6), 9)

    def test_logged_model_request_aware_rates_and_legacy_lens_are_separate(self) -> None:
        current = audit.api_cost_equivalence(
            [
                counted_event(usage(1_100_000, cached=400_000, output=100_000)),
                counted_event(
                    usage(2_200_000, cached=1_000_000, output=200_000),
                    model="gpt-5.6-sol",
                    effort="ultra",
                    ordinal=2,
                ),
            ]
        )
        legacy = audit.legacy_api_cost_equivalence(
            usage(1_100_000, cached=400_000, output=100_000)
        )

        self.assertAlmostEqual(current["usd_estimate"], 30.90)
        self.assertEqual(current["long_context_request_count"], 2)
        self.assertEqual(current["long_context_token_usage"]["total_tokens"], 3_300_000)
        self.assertEqual(current["long_context_threshold_input_tokens"], 272_000)
        self.assertEqual(current["model_rates"]["gpt-5.6-sol"]["cache_write_input_usd_per_million"], 6.25)
        self.assertEqual(current["model_rates"]["gpt-5.6-sol"]["long_context_cache_write_input_usd_per_million"], 12.5)
        self.assertIsNone(current["cache_write_tokens"])
        self.assertIn("cache writes", current["caveat"])
        self.assertAlmostEqual(legacy["usd_estimate"], 2.52)
        self.assertEqual(legacy["model"], "gpt-5.3-codex")

    def test_short_context_request_keeps_short_rates(self) -> None:
        current = audit.api_cost_equivalence(
            [counted_event(usage(200_000, cached=100_000, output=20_000))]
        )
        self.assertAlmostEqual(current["usd_estimate"], 1.05)
        self.assertEqual(current["long_context_request_count"], 0)

    def test_unlogged_model_tokens_remain_visible_and_unpriced(self) -> None:
        current = audit.api_cost_equivalence(
            [counted_event(usage(1234), model="unknown", effort="unknown")]
        )
        self.assertEqual(current["usd_estimate"], 0)
        self.assertEqual(current["unpriced_token_usage"]["total_tokens"], 1234)

    def test_account_snapshot_scales_from_local_request_mix_and_builds_weekly_activity(self) -> None:
        local = {
            "api_cost_equivalence": {
                "priced_token_usage": {"total_tokens": 10_000_000},
                "usd_estimate": 8.4,
            }
        }
        current = {
            "source_as_of": "2026-07-12T18:40:36Z",
            "token_count": 20_860_271_364,
            "tokens_label": "20.9B",
            "recent_activity": {
                "daily": [
                    {"date": "2026-07-10", "tokens": 100},
                    {"date": "2026-07-11", "tokens": 200},
                    {"date": "2026-07-12", "tokens": 50},
                ]
            },
        }
        account = audit.refresh_account_lifetime_data(current, local)
        self.assertEqual(account["tokens_label"], "20.9B")
        self.assertEqual(
            account["api_cost_equivalence"]["account_source_as_of"],
            current["source_as_of"],
        )
        self.assertEqual(account["api_cost_equivalence"]["observed_usd_per_million_tokens"], 0.84)
        self.assertEqual(account["api_cost_equivalence"]["usd_midpoint"], 17_500)
        self.assertEqual(account["recent_activity"]["peak_date"], "2026-07-11")
        self.assertEqual(account["recent_activity"]["end_label"], "Jul 12")
        self.assertEqual(len(account["recent_activity"]["sparkline_points"].split()), 3)
        self.assertEqual(
            account["recent_activity"]["weekly"],
            [
                {
                    "week": "2026-07-05",
                    "observed_start": "2026-07-10",
                    "observed_end": "2026-07-11",
                    "observed_days": 2,
                    "tokens": 300,
                    "partial": True,
                    "partial_reason": "range-start",
                    "api_equivalent_usd": 0.0,
                },
                {
                    "week": "2026-07-12",
                    "observed_start": "2026-07-12",
                    "observed_end": "2026-07-12",
                    "observed_days": 1,
                    "tokens": 50,
                    "partial": True,
                    "partial_reason": "range-end",
                    "api_equivalent_usd": 0.0,
                },
            ],
        )

        changed_local = {
            "api_cost_equivalence": {
                "priced_token_usage": {"total_tokens": 10_000_000},
                "usd_estimate": 12.0,
            }
        }
        unchanged_snapshot = audit.refresh_account_lifetime_data(account, changed_local)
        self.assertEqual(
            unchanged_snapshot["api_cost_equivalence"],
            account["api_cost_equivalence"],
        )

        next_snapshot = copy.deepcopy(account)
        next_snapshot["source_as_of"] = "2026-07-13T18:40:36Z"
        repriced = audit.refresh_account_lifetime_data(next_snapshot, changed_local)
        self.assertEqual(
            repriced["api_cost_equivalence"]["account_source_as_of"],
            next_snapshot["source_as_of"],
        )
        self.assertEqual(repriced["api_cost_equivalence"]["observed_usd_per_million_tokens"], 1.2)

    def test_weekly_account_activity_uses_sunday_buckets_and_exact_lifetime_ratio(self) -> None:
        daily = [
            {"date": "2026-06-13", "tokens": 6_055_884},
            *[
                {"date": f"2026-06-{day:02d}", "tokens": 100_000_000}
                for day in range(14, 21)
            ],
            {"date": "2026-06-21", "tokens": 200_000_000},
        ]
        weekly = audit.weekly_account_activity(
            daily,
            lifetime_tokens=20_860_271_364,
            lifetime_usd_estimate=17_513.64,
            partial_last_day=True,
        )
        self.assertEqual([row["week"] for row in weekly], ["2026-06-07", "2026-06-14", "2026-06-21"])
        self.assertEqual([row["observed_days"] for row in weekly], [1, 7, 1])
        self.assertEqual([row["partial_reason"] for row in weekly], ["range-start", None, "range-end"])
        self.assertEqual(sum(row["tokens"] for row in weekly), sum(row["tokens"] for row in daily))
        self.assertEqual(weekly[1]["api_equivalent_usd"], 587.7)

    def test_public_profile_usage_contract_is_sanitized_and_exact(self) -> None:
        account = self.account_snapshot()
        history = audit.merge_account_history(
            {"schema": 1, "grain": "calendar-day snapshots", "snapshots": []},
            account,
        )
        public = audit.public_profile_usage_data(account, history)
        self.assertEqual(
            set(public),
            {"schema", "source", "sourceAsOf", "lifetime", "recent", "history"},
        )
        self.assertEqual(
            set(public["lifetime"]),
            {"tokens", "tokensLabel", "apiEquivalent"},
        )
        self.assertEqual(
            set(public["recent"]),
            {"label", "start", "end", "partialLastDay", "peak", "daily", "weekly"},
        )
        serialized = json.dumps(public).lower()
        self.assertNotIn("local_lifetime", serialized)
        self.assertNotIn("codexbar", serialized)
        self.assertNotIn("observed_local", serialized)
        self.assertEqual(
            public["history"],
            {
                "grain": "calendar-day snapshots",
                "snapshotCount": 1,
                "firstSourceAsOf": account["source_as_of"],
                "latestSourceAsOf": account["source_as_of"],
            },
        )
        self.assertNotIn("snapshots", public["history"])
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            audit.write_public_profile_usage(root, account, history)
            self.assertEqual(
                json.loads((root / "assets" / "data" / "codex-profile-usage.json").read_text()),
                public,
            )
            self.assertEqual(audit.public_profile_usage_check_messages(root, account, history), [])

    def test_account_history_appends_snapshots_and_rejects_conflicting_rewrites(self) -> None:
        first = self.account_snapshot("2026-07-12T18:40:36Z")
        second = self.account_snapshot("2026-07-13T18:40:36Z")
        history = {"schema": 1, "grain": "calendar-day snapshots", "snapshots": []}
        history = audit.merge_account_history(history, first)
        history = audit.merge_account_history(history, second)
        history = audit.merge_account_history(history, second)
        self.assertEqual(len(history["snapshots"]), 2)
        self.assertEqual(audit.account_history_check_messages(history, second), [])
        self.assertEqual(
            [row["sourceAsOf"] for row in history["snapshots"]],
            ["2026-07-12T18:40:36Z", "2026-07-13T18:40:36Z"],
        )
        conflicting = json.loads(json.dumps(second))
        conflicting["recent_activity"]["daily"][-1]["tokens"] += 1
        with self.assertRaisesRegex(RuntimeError, "different snapshot"):
            audit.merge_account_history(history, conflicting)

        rewritten = json.loads(json.dumps(history))
        rewritten["snapshots"][0]["daily"][0]["tokens"] += 1
        rewrite_issues = audit.account_history_check_messages(
            rewritten,
            second,
            history,
        )
        self.assertTrue(any("rewrites committed" in issue for issue in rewrite_issues))

        deleted = json.loads(json.dumps(history))
        deleted["snapshots"].pop(0)
        deletion_issues = audit.account_history_check_messages(
            deleted,
            second,
            history,
        )
        self.assertTrue(any("deletes committed" in issue for issue in deletion_issues))

        malformed = json.loads(json.dumps(history))
        malformed["snapshots"][0]["daily"][4]["date"] = "not-a-date"
        self.assertTrue(
            any(
                "daily[4].date" in issue
                for issue in audit.account_history_check_messages(malformed, second)
            )
        )

    def test_account_snapshot_validation_accepts_fresh_complete_series(self) -> None:
        account = self.account_snapshot()
        issues = audit.account_snapshot_check_messages(
            account,
            now=datetime(2026, 7, 12, 19, 0, tzinfo=timezone.utc),
        )
        self.assertEqual(issues, [])

    def test_account_snapshot_validation_preserves_source_calendar_date(self) -> None:
        account = self.account_snapshot("2026-07-12T21:40:56-07:00")
        issues = audit.account_snapshot_check_messages(
            account,
            now=datetime(2026, 7, 13, 4, 41, tzinfo=timezone.utc),
        )
        self.assertEqual(issues, [])

    def test_account_snapshot_validation_rejects_stale_source(self) -> None:
        account = self.account_snapshot("2026-07-10T06:00:00Z")
        issues = audit.account_snapshot_check_messages(
            account,
            now=datetime(2026, 7, 12, 19, 0, tzinfo=timezone.utc),
        )
        self.assertTrue(any("stale" in issue for issue in issues))

    def test_account_snapshot_validation_rejects_malformed_daily_series(self) -> None:
        account = self.account_snapshot()
        account["recent_activity"]["daily"][4]["date"] = "not-a-date"
        account["recent_activity"]["daily"].pop()
        account["recent_activity"]["partial_last_day"] = "yes"
        issues = audit.account_snapshot_check_messages(
            account,
            now=datetime(2026, 7, 12, 19, 0, tzinfo=timezone.utc),
        )
        self.assertTrue(any("exactly 30 rows" in issue for issue in issues))
        self.assertTrue(any("must be an ISO date" in issue for issue in issues))
        self.assertTrue(any("partial_last_day must be a boolean" in issue for issue in issues))
        self.assertTrue(any("sparkline_points" in issue for issue in issues))
        self.assertTrue(any("weekly" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
