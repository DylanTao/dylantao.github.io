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
        self.assertEqual(audit.MODEL_DEVIATION_ACKNOWLEDGMENT_POLICY_VERSION, 6)
        self.assertEqual(len(audit.MODEL_DEVIATION_ACKNOWLEDGMENTS), 16)
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

    def test_direct_lane_deviations_are_acknowledged_by_exact_signature(self) -> None:
        turn_ids = (
            "019f648d-aeb5-7f50-97ac-4c8761cba158",
            "019f64a1-6822-7ef1-87b9-2bb6c7224a5e",
        )
        contexts = {}
        for ordinal, turn_id in enumerate(turn_ids, start=1):
            policy = audit.MODEL_DEVIATION_ACKNOWLEDGMENTS[turn_id]
            timestamp = audit.parse_timestamp(policy["timestamp"])
            assert timestamp is not None
            contexts[turn_id] = audit.TurnContextRecord(
                timestamp=timestamp,
                leaf_session_id=f"direct-lane-{ordinal}",
                turn_id=turn_id,
                model=policy["model"],
                effort=policy["effort"],
                path=Path(f"direct-lane-{ordinal}.jsonl"),
                ordinal=ordinal,
            )

        tracking = audit.build_model_tracking(
            audit.UsageDataset(
                sessions={},
                usage_events=[],
                contexts_by_turn=contexts,
                source_counts={},
            )
        )

        self.assertEqual(tracking["status"], "acknowledged_deviations")
        self.assertEqual(tracking["post_cutover_deviation_count"], 2)
        self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 2)
        self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 0)
        self.assertEqual(audit.model_tracking_check_messages(tracking), [])
        self.assertTrue(all(item["acknowledged"] for item in tracking["post_cutover_deviations"]))

    def test_provider_managed_non_site_turns_are_acknowledged_by_exact_signature(self) -> None:
        turn_ids = (
            "019f693b-c505-72b2-9b99-a7c1a6ce7a90",
            "019f69a3-ad73-7fa3-8461-3f1bbe3f7fad",
            "019f69a6-0518-7960-acb7-f4400305fdd8",
            "019f69bd-d860-7e60-b4b2-b78a26fada2d",
            "019f6a0d-b77c-70e1-8de2-e30efc43c880",
        )
        contexts = {}
        for ordinal, turn_id in enumerate(turn_ids, start=1):
            policy = audit.MODEL_DEVIATION_ACKNOWLEDGMENTS[turn_id]
            timestamp = audit.parse_timestamp(policy["timestamp"])
            assert timestamp is not None
            contexts[turn_id] = audit.TurnContextRecord(
                timestamp=timestamp,
                leaf_session_id=f"provider-managed-{ordinal}",
                turn_id=turn_id,
                model=policy["model"],
                effort=policy["effort"],
                path=Path(f"provider-managed-{ordinal}.jsonl"),
                ordinal=ordinal,
            )

        tracking = audit.build_model_tracking(
            audit.UsageDataset(
                sessions={},
                usage_events=[],
                contexts_by_turn=contexts,
                source_counts={},
            )
        )

        self.assertEqual(tracking["status"], "acknowledged_deviations")
        self.assertEqual(tracking["post_cutover_deviation_count"], 5)
        self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 5)
        self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 0)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["gpt-5.6-sol/low"], 1)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["codex-auto-review/low"], 4)
        self.assertEqual(audit.model_tracking_check_messages(tracking), [])
        self.assertTrue(all(item["acknowledged"] for item in tracking["post_cutover_deviations"]))

    def test_variationweaver_local_server_reviews_are_acknowledged_by_exact_signature(self) -> None:
        turn_ids = (
            "019f6a05-b982-7fa3-af7f-e912da833d7e",
            "019f6a07-76dd-7612-a6a3-9f7d83d4e557",
            "019f6a07-f9dd-79a3-ab62-1babf3823a37",
            "019f6a16-6582-7d42-b41d-36e74ef95324",
        )
        contexts = {}
        for ordinal, turn_id in enumerate(turn_ids, start=1):
            policy = audit.MODEL_DEVIATION_ACKNOWLEDGMENTS[turn_id]
            timestamp = audit.parse_timestamp(policy["timestamp"])
            assert timestamp is not None
            contexts[turn_id] = audit.TurnContextRecord(
                timestamp=timestamp,
                leaf_session_id=f"variationweaver-server-review-{ordinal}",
                turn_id=turn_id,
                model=policy["model"],
                effort=policy["effort"],
                path=Path(f"variationweaver-server-review-{ordinal}.jsonl"),
                ordinal=ordinal,
            )

        tracking = audit.build_model_tracking(
            audit.UsageDataset(
                sessions={},
                usage_events=[],
                contexts_by_turn=contexts,
                source_counts={},
            )
        )

        self.assertEqual(tracking["status"], "acknowledged_deviations")
        self.assertEqual(tracking["post_cutover_deviation_count"], 4)
        self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 4)
        self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 0)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["codex-auto-review/low"], 4)
        self.assertEqual(audit.model_tracking_check_messages(tracking), [])
        self.assertTrue(all(item["acknowledged"] for item in tracking["post_cutover_deviations"]))

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

if __name__ == "__main__":
    unittest.main()
