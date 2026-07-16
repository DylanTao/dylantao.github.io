from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "bin" / "import_direct_usage_snapshot.py"
SPEC = importlib.util.spec_from_file_location("import_direct_usage_snapshot", MODULE_PATH)
assert SPEC and SPEC.loader
tracker = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = tracker
SPEC.loader.exec_module(tracker)


class DirectUsageImportTests(unittest.TestCase):
    NOW = datetime(2026, 7, 16, 19, 0, tzinfo=timezone.utc)

    def source(self) -> dict:
        return {
            "schemaVersion": 1,
            "accountCount": 2,
            "health": {"healthyAccountCount": 2, "unavailableAccountCount": 0},
            "units": {
                "accounts": "count",
                "health": "count",
                "freshness": "utc_timestamp",
            },
            "method": "codex_app_server_rate_limits_non_additive_no_model_turns",
            "coverage": {
                "complete": True,
                "requiredAccountCount": 2,
                "healthyAccountCount": 2,
            },
            "confidence": "direct complete observation",
            "updated_at": "2026-07-16T18:55:00Z",
        }

    def test_builds_only_non_additive_anonymous_public_fields(self) -> None:
        public = tracker.build_public_snapshot(self.source(), now=self.NOW)
        self.assertEqual(
            set(public),
            {
                "schema",
                "accountCount",
                "healthyAccountCount",
                "freshAccountCount",
                "accountsWithQuotaData",
                "accountsAtLimit",
                "units",
                "method",
                "coverage",
                "confidence",
                "updated_at",
                "personalRoundedLifetimeBaseline",
            },
        )
        self.assertEqual(public["healthyAccountCount"], 2)
        self.assertEqual(public["freshAccountCount"], 2)
        self.assertEqual(public["accountsWithQuotaData"], 2)
        self.assertIsNone(public["accountsAtLimit"])
        self.assertEqual(public["personalRoundedLifetimeBaseline"]["tokens_label"], "20.9B")
        self.assertEqual(public["personalRoundedLifetimeBaseline"]["coverage"], "1 of 2 accounts")
        self.assertEqual(public["personalRoundedLifetimeBaseline"]["aggregation"], "non_additive")
        serialized = json.dumps(public).lower()
        for forbidden in (
            "email",
            "account_id",
            "plan_type",
            "reset",
            "daily",
            "api_cost",
            "combined_lifetime",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_rejects_extra_identity_or_history_fields(self) -> None:
        for key, value in (
            ("email", "someone@example.com"),
            ("daily", []),
            ("resetAt", "2026-07-17T00:00:00Z"),
        ):
            with self.subTest(key=key):
                source = self.source()
                source[key] = value
                with self.assertRaisesRegex(tracker.SnapshotError, "invalid keys"):
                    tracker.build_public_snapshot(source, now=self.NOW)

    def test_rejects_incomplete_stale_or_future_input(self) -> None:
        incomplete = self.source()
        incomplete["coverage"]["complete"] = False
        with self.assertRaisesRegex(tracker.SnapshotError, "complete must be true"):
            tracker.build_public_snapshot(incomplete, now=self.NOW)

        stale = self.source()
        stale["updated_at"] = "2026-07-16T18:00:00Z"
        with self.assertRaisesRegex(tracker.SnapshotError, "stale"):
            tracker.build_public_snapshot(stale, now=self.NOW)

        future = self.source()
        future["updated_at"] = "2026-07-16T19:06:00Z"
        with self.assertRaisesRegex(tracker.SnapshotError, "future"):
            tracker.build_public_snapshot(future, now=self.NOW)

    def test_publishes_identical_site_and_profile_copies(self) -> None:
        public = tracker.build_public_snapshot(self.source(), now=self.NOW)
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            tracker.publish_atomically(root, public)
            site = (root / "_data" / "direct_usage_tracker.json").read_bytes()
            profile = (root / "assets" / "data" / "codex-profile-usage.json").read_bytes()
            self.assertEqual(site, profile)
            self.assertEqual(json.loads(site), public)

    def test_second_replace_failure_restores_both_previous_outputs(self) -> None:
        public = tracker.build_public_snapshot(self.source(), now=self.NOW)
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            targets = (
                root / "_data" / "direct_usage_tracker.json",
                root / "assets" / "data" / "codex-profile-usage.json",
            )
            for path in targets:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('{"old":true}\n', encoding="utf-8")

            real_replace = tracker.os.replace
            calls = 0

            def fail_second(source: Path, destination: Path) -> None:
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError("synthetic second replacement failure")
                real_replace(source, destination)

            with mock.patch.object(tracker.os, "replace", side_effect=fail_second):
                with self.assertRaisesRegex(OSError, "synthetic"):
                    tracker.publish_atomically(root, public)
            for path in targets:
                self.assertEqual(path.read_text(encoding="utf-8"), '{"old":true}\n')


if __name__ == "__main__":
    unittest.main()
