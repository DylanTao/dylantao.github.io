from __future__ import annotations

import copy
import importlib.util
import json
import os
import sys
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone
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
    timestamp: datetime | None = None,
) -> object:
    return audit.CountedUsageEvent(
        timestamp=timestamp or datetime(2026, 7, 12, tzinfo=timezone.utc),
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
        self.assertEqual(audit.MODEL_DEVIATION_ACKNOWLEDGMENT_POLICY_VERSION, 31)
        self.assertEqual(len(audit.MODEL_DEVIATION_ACKNOWLEDGMENTS), 265)
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
            "019f6aa1-0d01-7630-9fef-bf549e7fd7f1",
            "019f6aa2-acbf-72c1-b413-78170ed853fa",
            "019f6aa4-de12-7203-ab31-e2d77b99c441",
            "019f6ab3-70b8-7523-a871-9c5801e7ee36",
            "019f6ac3-093a-7763-ac61-b1749d1e7b31",
            "019f6ac3-f40b-7283-a602-c23a523fab09",
            "019f6ac5-1dad-7621-89d1-8ad8b20be6f2",
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
        self.assertEqual(tracking["post_cutover_deviation_count"], 12)
        self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 12)
        self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 0)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["gpt-5.6-sol/low"], 1)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["codex-auto-review/low"], 11)
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

    def test_checkpoint_three_reviews_are_acknowledged_by_exact_signature(self) -> None:
        turn_ids = (
            "019f6d36-54ff-7612-bf76-e978e153a37d",
            "019f6d3e-86cc-7391-a831-3922ab08d480",
            "019f6d42-ecca-7c92-962c-dbaf3388f239",
            "019f6d47-0e25-7701-b27b-cea82e2a0709",
            "019f6d49-58dd-7c23-8a77-b6e2ad81baa5",
            "019f6d4a-6eab-7463-bcd2-ccfd4a383330",
            "019f6d4b-4715-7082-af2d-a3a41b380309",
            "019f6d4c-29c2-7f33-b6a2-42a6561e0559",
            "019f6d57-9d11-7062-8d03-cbe2ef47b513",
            "019f6d5b-2d47-7490-9750-1efd37849d7f",
            "019f6d5c-567b-7283-b026-b3016ccdeb28",
            "019f6d5c-cf07-74c0-8aeb-1f1ba4ff42b2",
            "019f6d5c-fab4-7e71-bb37-aaa6e1a0be8c",
            "019f6d5e-d9a5-7371-b0a5-db0bb6f524b5",
            "019f6d61-6024-74d1-8d9f-cfaa376aedc2",
            "019f6d61-ee3d-7f80-a18b-6b85a085fc3b",
            "019f6d68-8f06-7841-b54a-e1e3257a7fe5",
            "019f6d69-a13c-70a2-b309-780689683648",
            "019f6d6a-2ce8-7c10-beb4-a6f09bfce8dc",
            "019f6d6e-ee03-7e93-80ad-ba5307ff669b",
            "019f6d7a-1581-7bb1-bad5-60edadcaf402",
            "019f6d94-a390-7221-9a2a-b78bf84c9f72",
            "019f6d95-05d1-7713-b52f-026eb3499130",
            "019f6d97-5a2a-7940-afb8-b4451f93fdf5",
            "019f6d98-6d9e-7353-8f12-5c4b1bce502d",
            "019f6d98-ef1d-7500-bd60-6022ac88b67b",
            "019f6d99-a101-7aa0-be84-e96fad887897",
            "019f6d99-d18f-7c40-bb21-20766db501c7",
        )
        contexts = {}
        for ordinal, turn_id in enumerate(turn_ids, start=1):
            policy = audit.MODEL_DEVIATION_ACKNOWLEDGMENTS[turn_id]
            timestamp = audit.parse_timestamp(policy["timestamp"])
            assert timestamp is not None
            contexts[turn_id] = audit.TurnContextRecord(
                timestamp=timestamp,
                leaf_session_id=f"checkpoint-three-review-{ordinal}",
                turn_id=turn_id,
                model=policy["model"],
                effort=policy["effort"],
                path=Path(f"checkpoint-three-review-{ordinal}.jsonl"),
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
        self.assertEqual(tracking["post_cutover_deviation_count"], 28)
        self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 28)
        self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 0)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["codex-auto-review/low"], 28)
        self.assertEqual(audit.model_tracking_check_messages(tracking), [])
        rendered = tracking["post_cutover_deviations"]
        self.assertEqual({item["turn_id"] for item in rendered}, set(turn_ids))
        self.assertTrue(all(item["acknowledgment"]["signature_matches"] for item in rendered))

    def test_checkpoint_four_reviews_are_acknowledged_by_exact_signature(self) -> None:
        turn_ids = (
            "019f6da5-a128-74b0-b83e-100b4039a088",
            "019f6da5-f9dd-7c32-a7a2-95c1dfd55f18",
            "019f6da6-9b17-78c2-8bb7-6e5a6372180b",
            "019f6daa-7fc9-7b92-869d-256018d9c3f3",
            "019f6daa-a98e-7f21-84d0-e91b12cbaff9",
            "019f6daa-ce23-7570-a441-5aa1e260baa8",
            "019f6daa-f2cc-7db0-8480-6d059d648ea3",
            "019f6dab-1544-7183-920d-b722792252ed",
            "019f6dab-3f28-7a71-8ac9-eee60a7e9ee4",
            "019f6dab-655c-7b63-bc35-3c588a2beeba",
            "019f6dad-71c6-7110-a4a8-e21dcdbd5b30",
            "019f6dad-a6ff-7b22-b476-ea80afa56658",
            "019f6db0-9f8a-7ec2-9d4d-cb69cb75bb05",
            "019f6db0-c734-71b1-8241-ebb30d463cba",
            "019f6db3-bd37-7ba0-bde8-731c1770971b",
            "019f6db9-573b-71f2-bbc1-13c77e0948ce",
            "019f6dba-4d15-7cb1-a611-c246f07852cc",
            "019f6dc2-a9ac-7b61-bc43-eebd57212f9d",
            "019f6dc4-1887-78d1-8ded-9faa68c4de70",
            "019f6dc4-c2ca-7d71-bc96-48452e63c76b",
            "019f6dc5-2a81-7063-b155-5ec711714fa6",
            "019f6dc5-856b-75e3-807f-a970980a6e75",
            "019f6dc6-fb62-7811-bed6-89f2ea186125",
            "019f6dc7-e17b-72b1-9c62-3b8feabac4cf",
            "019f6dd0-eba6-7f22-b128-af3bfc02a84a",
            "019f6dd1-98d3-7d72-95b6-870d2e2df137",
            "019f6dd4-6a5c-7741-ac80-cd54cfdc8de2",
            "019f6dd4-f6e1-7c32-96cd-aa6b95dbbc47",
            "019f6dd5-bcf7-74b3-9aad-670b05af18fd",
            "019f6dd7-6da7-7d91-a779-985f9cdc95e9",
            "019f6dd8-24b9-7bd2-bd84-a6d906c1714f",
            "019f6dd7-db90-7211-9ad4-785ab6e457e7",
            "019f6dd8-7e0d-7643-935b-000edf4afe3e",
            "019f6dd8-7f1e-7732-bc18-6bd7a460a919",
            "019f6dda-c552-7ff0-a910-5e712496c892",
            "019f6ddb-0536-7762-8003-e637b7bcdfb3",
            "019f6dea-0a81-7002-9858-6fd81fe22fd1",
            "019f6dea-7005-7933-b628-569122dbbaf2",
            "019f6dea-e2d8-75b2-aef3-d3791f7db31c",
            "019f6deb-4d5a-7f20-81e3-440ae59c8c0d",
            "019f6deb-9d22-74a2-9522-e62a6e42eaea",
            "019f6dee-ddfb-7e50-ab70-e3f8df55b118",
            "019f6df0-5d51-7651-8f8c-a52ae5da0d77",
            "019f6df1-955a-7371-818c-62eb66d3da48",
            "019f6df6-45b7-79a0-a432-45460669cc8d",
            "019f6df6-8fa7-74f2-aaa7-130693f44c88",
            "019f6df6-c662-7c42-a0a0-d7dc52abbf49",
            "019f6df8-3916-7073-a31a-f53ccd4c5dbe",
            "019f6df8-6a62-7260-b2a9-24fc48342300",
            "019f6df9-6f50-7922-8f19-263d100e9e83",
            "019f6df9-f51e-7d51-bcc2-15fdbf3dc5a1",
            "019f6dfc-5e0f-7b43-8382-d2814daf9906",
            "019f6e01-eba1-77f3-9ba2-46b47a8bcf4c",
            "019f6e04-eda3-7102-8b59-216a89c76d6b",
            "019f6e05-348c-7f63-b0ec-f1ce1980c261",
        )
        contexts = {}
        for ordinal, turn_id in enumerate(turn_ids, start=1):
            policy = audit.MODEL_DEVIATION_ACKNOWLEDGMENTS[turn_id]
            timestamp = audit.parse_timestamp(policy["timestamp"])
            assert timestamp is not None
            contexts[turn_id] = audit.TurnContextRecord(
                timestamp=timestamp,
                leaf_session_id=f"checkpoint-four-review-{ordinal}",
                turn_id=turn_id,
                model=policy["model"],
                effort=policy["effort"],
                path=Path(f"checkpoint-four-review-{ordinal}.jsonl"),
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
        self.assertEqual(tracking["post_cutover_deviation_count"], 55)
        self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 55)
        self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 0)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["codex-auto-review/low"], 54)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["gpt-5.6-sol/max"], 1)
        self.assertEqual(audit.model_tracking_check_messages(tracking), [])
        rendered = tracking["post_cutover_deviations"]
        self.assertEqual({item["turn_id"] for item in rendered}, set(turn_ids))
        self.assertTrue(all(item["acknowledgment"]["signature_matches"] for item in rendered))

    def test_post_checkpoint_four_canaries_are_acknowledged_by_exact_signature(self) -> None:
        turn_ids = (
            "019f6e0f-212c-70c2-8ceb-4b6607f3481c",
            "019f6e10-f63b-7ab1-b94b-1d7656e05a9b",
            "019f6e11-1bd4-7033-8d18-58b03fafff3b",
        )
        contexts = {}
        for ordinal, turn_id in enumerate(turn_ids, start=1):
            policy = audit.MODEL_DEVIATION_ACKNOWLEDGMENTS[turn_id]
            timestamp = audit.parse_timestamp(policy["timestamp"])
            assert timestamp is not None
            contexts[turn_id] = audit.TurnContextRecord(
                timestamp=timestamp,
                leaf_session_id=f"post-checkpoint-four-canary-{ordinal}",
                turn_id=turn_id,
                model=policy["model"],
                effort=policy["effort"],
                path=Path(f"post-checkpoint-four-canary-{ordinal}.jsonl"),
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
        self.assertEqual(tracking["post_cutover_deviation_count"], 3)
        self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 3)
        self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 0)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["codex-auto-review/low"], 2)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["gpt-5.6-sol/max"], 1)
        self.assertEqual(audit.model_tracking_check_messages(tracking), [])
        rendered = tracking["post_cutover_deviations"]
        self.assertEqual({item["turn_id"] for item in rendered}, set(turn_ids))
        self.assertTrue(all(item["acknowledgment"]["signature_matches"] for item in rendered))

    def test_checkpoint_four_publish_reviews_are_acknowledged_by_exact_signature(self) -> None:
        turn_ids = (
            "019f6e1c-f573-7a50-8462-598ff5921474",
            "019f6e1e-dc0a-73b3-a55f-952ff1b03749",
            "019f6e1f-0b4f-7b20-b91c-36b8eb56cccc",
            "019f6e2b-4052-70c1-ac45-8173d77c1e9e",
        )
        contexts = {}
        for ordinal, turn_id in enumerate(turn_ids, start=1):
            policy = audit.MODEL_DEVIATION_ACKNOWLEDGMENTS[turn_id]
            timestamp = audit.parse_timestamp(policy["timestamp"])
            assert timestamp is not None
            contexts[turn_id] = audit.TurnContextRecord(
                timestamp=timestamp,
                leaf_session_id=f"checkpoint-four-publish-review-{ordinal}",
                turn_id=turn_id,
                model=policy["model"],
                effort=policy["effort"],
                path=Path(f"checkpoint-four-publish-review-{ordinal}.jsonl"),
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
        rendered = tracking["post_cutover_deviations"]
        self.assertEqual({item["turn_id"] for item in rendered}, set(turn_ids))
        self.assertTrue(all(item["acknowledgment"]["signature_matches"] for item in rendered))

    def test_late_semantic_cache_cleanup_is_acknowledged_by_exact_signature(self) -> None:
        turn_id = "019f6e24-79fa-7951-a8c9-fc6d1a6aac64"
        policy = audit.MODEL_DEVIATION_ACKNOWLEDGMENTS[turn_id]
        timestamp = audit.parse_timestamp(policy["timestamp"])
        assert timestamp is not None
        context = audit.TurnContextRecord(
            timestamp=timestamp,
            leaf_session_id="late-semantic-cache-cleanup",
            turn_id=turn_id,
            model=policy["model"],
            effort=policy["effort"],
            path=Path("late-semantic-cache-cleanup.jsonl"),
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
        self.assertEqual(rendered["turn_id"], turn_id)
        self.assertTrue(rendered["acknowledgment"]["signature_matches"])

    def test_post_checkpoint_four_reviews_are_acknowledged_by_exact_signature(self) -> None:
        turn_ids = (
            "019f6e36-5727-7652-b74f-5f704c25d5a4",
            "019f6e37-dfff-78d1-bf2b-14bcf95d4aea",
            "019f6e38-b8ad-7c91-85a8-ad7c75581ae5",
            "019f6e39-006f-77d1-848c-80ca56176ec1",
            "019f6e39-59e6-7d40-a19f-c34c80191e78",
            "019f6e39-e2ab-7d92-91f7-773d7b422b40",
            "019f6e3a-02c0-7292-8eb6-656c8542396e",
            "019f6e3a-f32b-7731-9702-9d9d00a17624",
            "019f6e3b-35ac-7df0-9519-71fc2059ae2e",
            "019f6e3b-f22b-7d71-b35d-4afd8213bf76",
            "019f6e3c-dd0e-7fa2-b52a-44388c0d90e6",
            "019f6e3d-aeff-7343-9eb8-c9ef49663757",
            "019f6e3d-bae8-7f63-92e7-4b35d6521173",
            "019f6e3e-b132-71b0-be95-97a47f66af1d",
            "019f6e3f-9961-7aa2-8b82-ede898dc6e93",
            "019f6e40-2f29-7941-808a-362d9605e932",
            "019f6e40-c904-7202-b4c0-543972150fa9",
            "019f6e40-f6ad-78c2-8f3f-e5072169c1d5",
            "019f6e41-e3a9-77a2-a2bb-8dd52a7f9d2f",
            "019f6e43-0795-7202-a08a-e18d79451a60",
            "019f6e43-e28d-7fc1-8337-d97592cf9b59",
            "019f6e44-334a-7d62-b6f1-fc07dedb732f",
            "019f6e45-4468-7570-8fef-a1295d68da4f",
            "019f6e46-7fbc-7601-9054-663826efea12",
            "019f6e47-b46e-77a0-bd98-a8bda2c2a1d7",
            "019f6e48-caf0-7451-934a-2b2e83819e8e",
            "019f6e49-457c-7030-8d21-c7aea43e7e9c",
            "019f6e4a-12ad-7bd0-bc42-2376d9e11f75",
            "019f6e4b-2d8f-7030-b5a8-bb48c227801b",
            "019f6e4b-5696-73a0-a71f-828c02572ba4",
            "019f6e4c-5475-7793-a72f-eb96d140a0f1",
            "019f6e4d-33d1-7000-b9ab-5a9c7812876c",
            "019f6e4d-6a96-74d1-ace5-23bfbd9d9828",
            "019f6e4e-8145-7cc0-8b1b-c36bd0b6632c",
            "019f6e52-9316-79a1-8f10-bbee1dfe763e",
            "019f6e52-e4b1-7c12-bab5-44d26ff0bf2d",
            "019f6e76-fc20-7610-9dad-1d9575c02124",
            "019f6e77-4fe6-7e03-8549-adf3fe7667ee",
            "019f6e77-bbcc-7302-ab73-5714950f29cc",
            "019f6e78-2e72-7061-9536-889f19632c46",
            "019f6e78-64d2-7f00-9c6f-277d4af18f91",
            "019f6e78-9d3a-7341-b06b-0e96d9d6f449",
            "019f6e78-d4eb-7832-b613-4351986648d4",
            "019f6e7d-0da5-7501-9443-aaafe70ee46a",
            "019f6e7e-d3a0-7fd0-89fc-b12ac5f67216",
            "019f6e7f-3ea0-7320-80e4-45d31563269c",
            "019f6e81-10a9-70e2-911b-a3e6c67abc86",
            "019f6e81-5298-74b2-8c01-9852aabac068",
            "019f6e9c-6481-76a3-951c-c86ee4709d8c",
        )
        contexts = {}
        for ordinal, turn_id in enumerate(turn_ids, start=1):
            policy = audit.MODEL_DEVIATION_ACKNOWLEDGMENTS[turn_id]
            timestamp = audit.parse_timestamp(policy["timestamp"])
            assert timestamp is not None
            contexts[turn_id] = audit.TurnContextRecord(
                timestamp=timestamp,
                leaf_session_id=f"post-checkpoint-four-review-{ordinal}",
                turn_id=turn_id,
                model=policy["model"],
                effort=policy["effort"],
                path=Path(f"post-checkpoint-four-review-{ordinal}.jsonl"),
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
        self.assertEqual(tracking["post_cutover_deviation_count"], 49)
        self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 49)
        self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 0)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["codex-auto-review/low"], 49)
        self.assertEqual(audit.model_tracking_check_messages(tracking), [])
        rendered = tracking["post_cutover_deviations"]
        self.assertEqual({item["turn_id"] for item in rendered}, set(turn_ids))
        self.assertTrue(all(item["acknowledgment"]["signature_matches"] for item in rendered))

    def test_usage_checkpoint_reviews_are_acknowledged_by_exact_signature(self) -> None:
        turn_ids = (
            "019f6ec5-6af5-7523-b406-82d37c95a2dd",
            "019f6ec6-001e-7250-8f85-c3322869c64c",
            "019f6ec6-a940-7790-9fd5-f41ffdca03de",
            "019f6ec6-e1d2-73c3-ba92-21f1c6779c27",
            "019f6ec7-25ee-79f0-9ec3-7d315f14f740",
            "019f6ec7-5f2f-7533-a84e-51752a6922f8",
            "019f6ec8-08a8-7dc2-9e17-365b58c3a448",
            "019f6ec9-daf5-7152-8650-47deb5765af2",
            "019f6eca-552e-7733-8735-edc91c3d1ce8",
            "019f6eca-e3de-7fb2-b689-6deeb8669784",
            "019f6eca-fabc-7112-b494-2662e584e050",
            "019f6ecb-3995-7891-ba24-46bddb3617f0",
            "019f6ecb-8923-7012-869e-9c183609d250",
            "019f6ecc-2e82-7080-82fa-6d75f718035a",
            "019f6ecc-6534-7453-98ca-a049c3a75608",
            "019f6ecd-3c49-7dd3-afea-8597274a9bd9",
            "019f6ecd-9946-7253-a8c1-360d401c5acf",
            "019f6ecd-d85e-7e40-8d9e-b828d2572c1f",
            "019f6ece-0fc5-70c0-94c7-2a03ab842cd8",
            "019f6ece-801d-7823-8f5e-a893e2a1d40f",
            "019f6ecf-1286-7441-a23a-1f37b82eb3df",
            "019f6ed0-56aa-7ce0-938c-0194a891d008",
            "019f6ed1-31a1-7290-b6b5-b1a41f04067d",
            "019f6ed1-bc0c-7f13-b388-7d17d628b3aa",
            "019f6ed1-fd5a-7592-870d-9029b5d735a8",
            "019f6ed2-417c-7d93-ba80-fd204fe2995c",
            "019f6ed2-8494-7653-a8e5-cab170cd3333",
            "019f6ed2-b5b0-7622-b665-5c6e20c1033d",
            "019f6ed2-fe3a-7c73-86ef-1dc07df5422e",
            "019f6ed4-39d4-7c73-9c5c-b4c15f9200c5",
            "019f6ed4-f4ee-7d01-b37f-19c82404c9d1",
            "019f6ed5-441a-79e2-94f2-c2440465fe74",
            "019f6ed5-9b4b-7ba3-9fcb-ae79c41d0a42",
            "019f6ed5-eb9f-7343-9c13-12744a65a608",
            "019f6ed6-b517-7c62-bf68-e9c3d7433923",
            "019f6ed8-73fb-7820-ad3d-6a601bf54d0c",
            "019f6edb-ea18-75e0-b92d-370966c6d40d",
            "019f6eea-c7b2-78f0-901b-eb2a47a3d85f",
            "019f6ef0-81f2-7950-90d4-898782853b00",
            "019f6ef1-e61b-7d53-983a-bad9ba5a709f",
        )
        contexts = {}
        for ordinal, turn_id in enumerate(turn_ids, start=1):
            policy = audit.MODEL_DEVIATION_ACKNOWLEDGMENTS[turn_id]
            timestamp = audit.parse_timestamp(policy["timestamp"])
            assert timestamp is not None
            contexts[turn_id] = audit.TurnContextRecord(
                timestamp=timestamp,
                leaf_session_id=f"usage-checkpoint-review-{ordinal}",
                turn_id=turn_id,
                model=policy["model"],
                effort=policy["effort"],
                path=Path(f"usage-checkpoint-review-{ordinal}.jsonl"),
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
        self.assertEqual(tracking["post_cutover_deviation_count"], 40)
        self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 40)
        self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 0)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["codex-auto-review/low"], 40)
        self.assertEqual(audit.model_tracking_check_messages(tracking), [])
        rendered = tracking["post_cutover_deviations"]
        self.assertEqual({item["turn_id"] for item in rendered}, set(turn_ids))
        self.assertTrue(all(item["acknowledgment"]["signature_matches"] for item in rendered))

    def test_policy_tail_reviews_are_acknowledged_by_exact_signature(self) -> None:
        turn_ids = (
            "019f6eff-464d-7743-8451-3b4a8d047425",
            "019f6f01-c5f8-7b82-aab4-cd502670c4f2",
            "019f6f02-3cc4-7b71-a774-7ea7c58485ad",
            "019f6f02-9e4e-73c3-b0ef-6219dbf01fba",
            "019f6f02-e1d0-71d0-98d3-f63bd90702cd",
            "019f6f03-6e08-7c72-8839-ad7ad1436d32",
            "019f6f04-172d-7030-9a2a-e7652c1f54e3",
            "019f6f04-16e7-7eb1-ba5f-b49b2891d77c",
            "019f6f04-f2ff-75b1-b8cd-8d55049ef030",
        )
        contexts = {}
        for ordinal, turn_id in enumerate(turn_ids, start=1):
            policy = audit.MODEL_DEVIATION_ACKNOWLEDGMENTS[turn_id]
            timestamp = audit.parse_timestamp(policy["timestamp"])
            assert timestamp is not None
            contexts[turn_id] = audit.TurnContextRecord(
                timestamp=timestamp,
                leaf_session_id=f"policy-tail-review-{ordinal}",
                turn_id=turn_id,
                model=policy["model"],
                effort=policy["effort"],
                path=Path(f"policy-tail-review-{ordinal}.jsonl"),
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
        self.assertEqual(tracking["post_cutover_deviation_count"], 9)
        self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 9)
        self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 0)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["codex-auto-review/low"], 9)
        self.assertEqual(audit.model_tracking_check_messages(tracking), [])
        rendered = tracking["post_cutover_deviations"]
        self.assertEqual({item["turn_id"] for item in rendered}, set(turn_ids))
        self.assertTrue(all(item["acknowledgment"]["signature_matches"] for item in rendered))

    def test_final_policy_tail_is_acknowledged_by_exact_signature(self) -> None:
        turn_ids = (
            "019f6efa-35ec-7a93-a9e8-d8e06003d84f",
            "019f6efd-29ae-75b0-8ba0-1e3097e867b4",
            "019f6efd-9cb1-7b93-9411-d815d528a14b",
            "019f6f05-aaee-7df1-a766-1c014a00ee60",
            "019f6f06-3c3c-7763-bcd2-214e3c756711",
            "019f6f06-de17-7523-9f0f-64f853d060be",
        )
        contexts = {}
        for ordinal, turn_id in enumerate(turn_ids, start=1):
            policy = audit.MODEL_DEVIATION_ACKNOWLEDGMENTS[turn_id]
            timestamp = audit.parse_timestamp(policy["timestamp"])
            assert timestamp is not None
            contexts[turn_id] = audit.TurnContextRecord(
                timestamp=timestamp,
                leaf_session_id=f"final-policy-tail-{ordinal}",
                turn_id=turn_id,
                model=policy["model"],
                effort=policy["effort"],
                path=Path(f"final-policy-tail-{ordinal}.jsonl"),
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
        self.assertEqual(tracking["post_cutover_deviation_count"], 6)
        self.assertEqual(tracking["post_cutover_acknowledged_deviation_count"], 6)
        self.assertEqual(tracking["post_cutover_unacknowledged_deviation_count"], 0)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["codex-auto-review/low"], 4)
        self.assertEqual(tracking["post_cutover_observed_breakdown"]["gpt-5.6-sol/max"], 2)
        self.assertEqual(audit.model_tracking_check_messages(tracking), [])
        rendered = tracking["post_cutover_deviations"]
        self.assertEqual({item["turn_id"] for item in rendered}, set(turn_ids))
        self.assertTrue(all(item["acknowledgment"]["signature_matches"] for item in rendered))

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


class TokenRhythmTests(unittest.TestCase):
    @staticmethod
    def dataset_with_events(events: list[object]) -> object:
        return audit.UsageDataset(
            sessions={},
            usage_events=events,
            contexts_by_turn={},
            source_counts={"last_token_usage": len(events)},
        )

    def test_daily_points_fill_the_pacific_calendar_and_carry_quiet_days(self) -> None:
        dataset = self.dataset_with_events(
            [
                counted_event(
                    usage(1_400_000),
                    ordinal=1,
                    timestamp=datetime(2026, 5, 23, 6, 30, tzinfo=timezone.utc),
                ),
                counted_event(
                    usage(2_600_000),
                    ordinal=2,
                    timestamp=datetime(2026, 5, 25, 8, 0, tzinfo=timezone.utc),
                ),
            ]
        )

        rhythm = audit.build_token_rhythm(
            dataset,
            audit.REVAMP_CUTOFF_UTC,
            updated_at=date(2026, 5, 26),
        )

        self.assertIsNotNone(rhythm)
        assert rhythm is not None
        self.assertEqual(
            [point["date"] for point in rhythm["points"]],
            ["2026-05-22", "2026-05-23", "2026-05-24", "2026-05-25", "2026-05-26"],
        )
        self.assertEqual(
            [point["token_count"] for point in rhythm["points"]],
            [1_000_000, 1_000_000, 1_000_000, 4_000_000, 4_000_000],
        )

    def test_cumulative_rounding_stays_monotonic_across_rounding_steps(self) -> None:
        base = audit.REVAMP_CUTOFF_UTC + timedelta(hours=1)
        dataset = self.dataset_with_events(
            [
                counted_event(usage(99_600_000), ordinal=1, timestamp=base),
                counted_event(usage(600_000), ordinal=2, timestamp=base + timedelta(days=1)),
                counted_event(usage(4_800_000), ordinal=3, timestamp=base + timedelta(days=2)),
            ]
        )

        rhythm = audit.build_token_rhythm(
            dataset,
            audit.REVAMP_CUTOFF_UTC,
            updated_at=date(2026, 5, 24),
        )

        assert rhythm is not None
        counts = [point["token_count"] for point in rhythm["points"]]
        self.assertEqual(counts, [100_000_000, 100_000_000, 110_000_000])
        self.assertEqual(counts, sorted(counts))

    def test_latest_point_matches_the_public_total(self) -> None:
        base = audit.REVAMP_CUTOFF_UTC + timedelta(hours=1)
        dataset = self.dataset_with_events(
            [
                counted_event(usage(2_400_000), ordinal=1, timestamp=base),
                counted_event(usage(3_200_000), ordinal=2, timestamp=base + timedelta(days=2)),
            ]
        )
        total = audit.audit_scope(dataset, audit.REVAMP_CUTOFF_UTC, commit_count=0)
        rhythm = audit.build_token_rhythm(
            dataset,
            audit.REVAMP_CUTOFF_UTC,
            updated_at=date(2026, 5, 25),
        )

        assert rhythm is not None
        self.assertEqual(rhythm["points"][-1]["token_count"], total["token_count"])
        self.assertEqual(rhythm["points"][-1]["tokens_label"], total["tokens_label"])

    def test_public_schema_is_exact_private_and_total_only(self) -> None:
        dataset = self.dataset_with_events(
            [
                counted_event(
                    usage(2_400_000),
                    timestamp=audit.REVAMP_CUTOFF_UTC + timedelta(hours=1),
                )
            ]
        )
        rhythm = audit.build_token_rhythm(
            dataset,
            audit.REVAMP_CUTOFF_UTC,
            updated_at=date(2026, 5, 22),
        )

        assert rhythm is not None
        self.assertEqual(
            set(rhythm),
            {
                "schema",
                "label",
                "units",
                "grain",
                "aggregation",
                "method",
                "since",
                "updated_at",
                "confidence",
                "privacy_note",
                "points",
            },
        )
        self.assertEqual(
            {key for key, value in rhythm.items() if isinstance(value, list)},
            {"points"},
        )
        self.assertEqual(set(rhythm["points"][0]), {"date", "token_count", "tokens_label"})
        self.assertEqual(rhythm["label"], "Site revamp retained-session estimate")
        self.assertEqual(rhythm["method"], "deduplicated_repo_retained_logs")
        self.assertEqual(rhythm["since"], "2026-05-22")
        self.assertEqual(rhythm["updated_at"], "2026-05-22")
        self.assertEqual(rhythm["confidence"], "estimate")

        public_keys = set(rhythm)
        public_keys.update(key for point in rhythm["points"] for key in point)
        for private_key in (
            "session_id",
            "account",
            "quota",
            "model",
            "raw_event",
            "raw_token_count",
            "cost",
            "turn_id",
            "path",
        ):
            self.assertNotIn(private_key, public_keys)

        total = audit.audit_scope(dataset, audit.REVAMP_CUTOFF_UTC, commit_count=1)
        total["token_rhythm"] = rhythm
        other_scope = audit.audit_scope(dataset, audit.REVAMP_CUTOFF_UTC, commit_count=0)
        proposed = audit.build_ledger_data(
            {},
            total,
            other_scope,
            other_scope,
            other_scope,
            {"status": "aligned"},
        )
        self.assertEqual(proposed["total"]["token_rhythm"], rhythm)
        for scope_name in ("desk_scene", "since_gpt_5_6", "local_lifetime"):
            self.assertNotIn("token_rhythm", proposed[scope_name])

    def test_zero_repo_evidence_preserves_published_history(self) -> None:
        previous_rhythm = {
            "schema": 1,
            "label": "Site revamp retained-session estimate",
            "units": "estimated tokens",
            "grain": "day",
            "aggregation": "cumulative",
            "method": "deduplicated_repo_retained_logs",
            "since": "2026-05-22",
            "updated_at": "2026-07-15",
            "confidence": "estimate",
            "privacy_note": "Rounded daily cumulative estimates only.",
            "points": [
                {"date": "2026-07-15", "token_count": 5_600_000_000, "tokens_label": "5.6B"}
            ],
        }
        previous = {
            "commits": 100,
            "token_count": 5_600_000_000,
            "tokens_label": "5.6B",
            "token_rhythm": previous_rhythm,
        }
        empty_dataset = self.dataset_with_events([])
        result = audit.audit_scope(empty_dataset, audit.REVAMP_CUTOFF_UTC, commit_count=101)

        self.assertIsNone(
            audit.build_token_rhythm(
                empty_dataset,
                audit.REVAMP_CUTOFF_UTC,
                updated_at=date(2026, 7, 16),
            )
        )
        merged = audit.merge_scope_data(previous, result)
        self.assertEqual(merged["commits"], 101)
        self.assertEqual(merged["token_rhythm"], previous_rhythm)

    def test_freshness_reports_any_token_rhythm_mismatch(self) -> None:
        rhythm = {
            "schema": 1,
            "label": "Site revamp retained-session estimate",
            "units": "estimated tokens",
            "grain": "day",
            "aggregation": "cumulative",
            "method": "deduplicated_repo_retained_logs",
            "since": "2026-05-22",
            "updated_at": "2026-07-16",
            "confidence": "estimate",
            "privacy_note": "Rounded daily cumulative estimates only.",
            "points": [
                {"date": "2026-07-16", "token_count": 5_600_000_000, "tokens_label": "5.6B"}
            ],
        }
        current = {"total": {"token_rhythm": rhythm}}
        proposed = copy.deepcopy(current)
        proposed["total"]["token_rhythm"]["points"][0]["token_count"] = 5_610_000_000

        mismatches = audit.check_public_freshness(current, proposed)

        self.assertEqual(len(mismatches), 1)
        self.assertTrue(mismatches[0].startswith("total.token_rhythm:"))


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
