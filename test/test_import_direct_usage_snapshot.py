from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
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
            "schemaVersion": 3,
            "combinedLifetime": {
                "tokenCount": 32_800_000_000,
                "sourceCount": 2,
                "units": "tokens",
                "aggregation": "sum_of_sources",
                "rounding": "nearest_0.1B",
            },
            "method": "rounded_sum_of_verified_account_lifetime_readings",
            "confidence": "high",
            "updated_at": "2026-07-16T18:55:00Z",
        }

    def test_builds_only_rounded_anonymous_public_fields(self) -> None:
        public = tracker.build_public_snapshot(self.source(), now=self.NOW)
        self.assertEqual(
            set(public),
            {
                "schema",
                "combined_lifetime",
                "method",
                "confidence",
                "observed_on",
                "updated_at",
                "automated_refresh",
            },
        )
        self.assertEqual(public["schema"], 3)
        lifetime = public["combined_lifetime"]
        self.assertEqual(
            set(lifetime),
            {
                "token_count",
                "tokens_label",
                "units",
                "aggregation",
                "rounding",
                "source_count",
            },
        )
        self.assertEqual(lifetime["token_count"], 32_800_000_000)
        self.assertEqual(lifetime["tokens_label"], "32.8B")
        self.assertEqual(lifetime["source_count"], 2)
        self.assertEqual(lifetime["aggregation"], "sum_of_sources")
        self.assertEqual(public["observed_on"], "2026-07-16")
        self.assertTrue(public["automated_refresh"])
        serialized = json.dumps(public).lower()
        for forbidden in (
            "email",
            "account_id",
            "plan_type",
            "reset",
            "daily",
            "history",
            "api_cost",
            "healthyaccount",
            "quota",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_rejects_extra_identity_or_history_fields(self) -> None:
        for key, value in (
            ("email", "someone@example.com"),
            ("daily", []),
            ("resetAt", "2026-07-17T00:00:00Z"),
            ("perAccount", [26_600_000_000, 6_200_000_000]),
        ):
            with self.subTest(key=key):
                source = self.source()
                source[key] = value
                with self.assertRaisesRegex(tracker.SnapshotError, "invalid keys"):
                    tracker.build_public_snapshot(source, now=self.NOW)

    def test_rejects_wrong_source_count_or_unrounded_total(self) -> None:
        wrong_count = self.source()
        wrong_count["combinedLifetime"]["sourceCount"] = 1
        with self.assertRaisesRegex(tracker.SnapshotError, "sourceCount must be 2"):
            tracker.build_public_snapshot(wrong_count, now=self.NOW)

        unrounded = self.source()
        unrounded["combinedLifetime"]["tokenCount"] = 32_812_345_678
        with self.assertRaisesRegex(tracker.SnapshotError, "nearest-0.1B rounded"):
            tracker.build_public_snapshot(unrounded, now=self.NOW)

        unsafe = self.source()
        unsafe["combinedLifetime"]["tokenCount"] = 9_100_000_000_000_000
        with self.assertRaisesRegex(tracker.SnapshotError, "JavaScript-safe integer"):
            tracker.build_public_snapshot(unsafe, now=self.NOW)

    def test_rejects_stale_or_future_input(self) -> None:
        stale = self.source()
        stale["updated_at"] = "2026-07-16T18:00:00Z"
        with self.assertRaisesRegex(tracker.SnapshotError, "stale"):
            tracker.build_public_snapshot(stale, now=self.NOW)

        future = self.source()
        future["updated_at"] = "2026-07-16T19:06:00Z"
        with self.assertRaisesRegex(tracker.SnapshotError, "future"):
            tracker.build_public_snapshot(future, now=self.NOW)

    def test_rejects_legacy_quota_health_projection(self) -> None:
        legacy = {
            "schemaVersion": 1,
            "accountCount": 2,
            "health": {"healthyAccountCount": 2, "unavailableAccountCount": 0},
        }
        with self.assertRaisesRegex(tracker.SnapshotError, "invalid keys"):
            tracker.build_public_snapshot(legacy, now=self.NOW)

    def test_rejects_non_integer_schema_version_and_legacy_confidence_aliases(self) -> None:
        for schema_version in (3.0, True):
            with self.subTest(schema_version=schema_version):
                source = self.source()
                source["schemaVersion"] = schema_version
                with self.assertRaisesRegex(tracker.SnapshotError, "schemaVersion must be 3"):
                    tracker.build_public_snapshot(source, now=self.NOW)

        for confidence in ("direct", "complete", "direct complete observation"):
            with self.subTest(confidence=confidence):
                source = self.source()
                source["confidence"] = confidence
                with self.assertRaisesRegex(tracker.SnapshotError, "confidence must be 'high'"):
                    tracker.build_public_snapshot(source, now=self.NOW)

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
