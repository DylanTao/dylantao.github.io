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

    def source(
        self,
        *,
        token_count: int = 32_800_000_000,
        updated_at: str = "2026-07-16T18:55:00Z",
    ) -> dict:
        return {
            "schemaVersion": 3,
            "combinedLifetime": {
                "tokenCount": token_count,
                "sourceCount": 2,
                "units": "tokens",
                "aggregation": "sum_of_sources",
                "rounding": "nearest_0.1B",
            },
            "method": "rounded_sum_of_verified_account_lifetime_readings",
            "confidence": "high",
            "updated_at": updated_at,
        }

    def daily_source(
        self,
        *,
        token_count: int = 32_800_000_000,
        updated_at: str = "2026-07-16T18:55:00Z",
        completeness: str = "whole_lifetime",
    ) -> dict:
        prior = 0 if completeness == "whole_lifetime" else 32_100_000_000
        before_start = "zero" if completeness == "whole_lifetime" else "unobserved"
        daily_total = token_count if completeness == "whole_lifetime" else 700_000_000
        return {
            "schemaVersion": 4,
            "combinedLifetime": {
                "tokenCount": token_count,
                "sourceCount": 2,
                "units": "tokens",
                "aggregation": "sum_of_sources",
                "rounding": "nearest_0.1B",
            },
            "combinedDailyUsage": {
                "schema": 1,
                "label": "Combined daily Codex usage",
                "units": "tokens",
                "grain": "day",
                "aggregation": "sum_of_sources",
                "coverage": {
                    "starts_on": "2026-07-14",
                    "complete_through": "2026-07-15",
                    "before_start": before_start,
                    "completeness": completeness,
                    "prior_unallocated_tokens": prior,
                },
                "points": [
                    {"date": "2026-07-14", "tokens": daily_total - 200_000_000},
                    {"date": "2026-07-15", "tokens": 200_000_000},
                ],
            },
            "method": "rounded_sum_of_verified_account_lifetime_readings",
            "confidence": "high",
            "updated_at": updated_at,
        }

    def legacy_site_snapshot(self) -> dict:
        return {
            "schema": 3,
            "combined_lifetime": {
                "token_count": 32_800_000_000,
                "tokens_label": "32.8B",
                "units": "tokens",
                "aggregation": "sum_of_sources",
                "rounding": "nearest_0.1B",
                "source_count": 2,
            },
            "method": "user_reported_rounded_lifetime_checkpoint",
            "confidence": "user reported",
            "observed_on": "2026-07-16",
            "updated_at": None,
            "automated_refresh": False,
        }

    def automated_legacy_site_snapshot(self) -> dict:
        return {
            "schema": 3,
            "combined_lifetime": {
                "token_count": 52_800_000_000,
                "tokens_label": "52.8B",
                "units": "tokens",
                "aggregation": "sum_of_sources",
                "rounding": "nearest_0.1B",
                "source_count": 2,
            },
            "method": "rounded_sum_of_verified_account_lifetime_readings",
            "confidence": "high",
            "observed_on": "2026-07-27",
            "updated_at": "2026-07-27T00:31:42.242208Z",
            "automated_refresh": True,
        }

    def agentic_usage(self) -> dict:
        return {
            "total": {
                "api_cost_equivalence": {
                    "pricing_as_of": "2026-07-12",
                    "usd_estimate": 7709.48,
                    "priced_token_usage": {"total_tokens": 9_646_321_131},
                }
            }
        }

    def test_builds_only_rounded_anonymous_public_fields(self) -> None:
        public = tracker.build_site_snapshot(self.source(), now=self.NOW)
        expected_base = {
            "schema",
            "combined_lifetime",
            "combined_lifetime_history",
            "method",
            "confidence",
            "observed_on",
            "updated_at",
            "automated_refresh",
        }
        self.assertEqual(set(public), expected_base)
        self.assertEqual(public["schema"], 4)
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
        history = public["combined_lifetime_history"]
        self.assertEqual(
            set(history),
            {
                "schema",
                "label",
                "units",
                "grain",
                "aggregation",
                "rounding",
                "coverage",
                "points",
            },
        )
        self.assertEqual(history["schema"], 1)
        self.assertEqual(history["label"], "Combined lifetime tokens")
        self.assertEqual(history["units"], "tokens")
        self.assertEqual(history["grain"], "daily_last_observation")
        self.assertEqual(history["aggregation"], "sum_of_sources")
        self.assertEqual(history["rounding"], "nearest_0.1B")
        self.assertEqual(
            history["coverage"],
            {"starts_on": "2026-07-16", "before_start": "unobserved"},
        )
        self.assertEqual(
            history["points"],
            [
                {
                    "date": "2026-07-16",
                    "token_count": 32_800_000_000,
                    "tokens_label": "32.8B",
                    "observation": "automated",
                }
            ],
        )
        serialized = json.dumps(public).lower()
        for forbidden in (
            "email",
            "account_id",
            "plan_type",
            "reset",
            "api_cost",
            "healthyaccount",
            "quota",
            "per_account",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_public_profile_adds_only_the_flat_reference_cost(self) -> None:
        public = tracker.build_public_snapshot(
            self.source(), agentic_usage=self.agentic_usage(), now=self.NOW
        )
        self.assertEqual(public["schema"], 5)
        self.assertEqual(
            set(public),
            {
                "schema",
                "combined_lifetime",
                "combined_lifetime_history",
                "method",
                "confidence",
                "observed_on",
                "updated_at",
                "automated_refresh",
                "cost",
            },
        )
        self.assertEqual(
            public["cost"],
            {
                "method": "flat_reference_rate_replay",
                "reference_scope": "current_site_build_blended_public_api_rate",
                "usd_per_million_tokens": 0.799215,
                "pricing_as_of": "2026-07-12",
                "usd_midpoint": 26214,
                "usd_label": "~$26.2K API-rate replay",
            },
        )

    def test_schema4_collector_publishes_exact_completed_days_as_schema5_and_6(
        self,
    ) -> None:
        site = tracker.build_site_snapshot(self.daily_source(), now=self.NOW)
        profile = tracker.build_public_snapshot(
            self.daily_source(),
            agentic_usage=self.agentic_usage(),
            now=self.NOW,
        )
        self.assertEqual(site["schema"], 5)
        self.assertEqual(profile["schema"], 6)
        self.assertEqual(
            set(site),
            {
                "schema",
                "combined_lifetime",
                "combined_daily_usage",
                "method",
                "confidence",
                "observed_on",
                "updated_at",
                "automated_refresh",
            },
        )
        self.assertEqual(
            set(profile),
            set(site) | {"cost"},
        )
        for key in set(site) - {"schema"}:
            self.assertEqual(profile[key], site[key])
        usage = site["combined_daily_usage"]
        self.assertEqual(
            usage,
            {
                "schema": 1,
                "label": "Combined daily Codex usage",
                "units": "tokens",
                "grain": "day",
                "aggregation": "sum_of_sources",
                "coverage": {
                    "starts_on": "2026-07-14",
                    "complete_through": "2026-07-15",
                    "before_start": "zero",
                    "completeness": "whole_lifetime",
                    "prior_unallocated_tokens": 0,
                },
                "points": [
                    {"date": "2026-07-14", "tokens": 32_600_000_000},
                    {"date": "2026-07-15", "tokens": 200_000_000},
                ],
            },
        )
        self.assertNotIn("combined_lifetime_history", site)
        serialized = json.dumps((site, profile)).lower()
        for forbidden in (
            "email",
            "account_id",
            "plan_type",
            "reset",
            "healthyaccount",
            "quota",
            "per_account",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_partial_daily_window_requires_and_reconciles_unallocated_prehistory(
        self,
    ) -> None:
        site = tracker.build_site_snapshot(
            self.daily_source(completeness="rolling_window_partial"),
            now=self.NOW,
        )
        coverage = site["combined_daily_usage"]["coverage"]
        self.assertEqual(coverage["before_start"], "unobserved")
        self.assertEqual(coverage["prior_unallocated_tokens"], 32_100_000_000)
        self.assertEqual(coverage["completeness"], "rolling_window_partial")

    def test_daily_contract_rejects_missing_malformed_or_privacy_expanding_data(
        self,
    ) -> None:
        invalid_cases = []

        missing = self.daily_source()
        missing["combinedDailyUsage"] = None
        invalid_cases.append((missing, "must be an object"))

        extra = self.daily_source()
        extra["combinedDailyUsage"]["points"][0]["account_id"] = "private"
        invalid_cases.append((extra, "invalid keys"))

        duplicate = self.daily_source()
        duplicate["combinedDailyUsage"]["points"][1]["date"] = "2026-07-14"
        invalid_cases.append((duplicate, "sorted and unique"))

        gap = self.daily_source()
        gap["combinedDailyUsage"]["coverage"]["complete_through"] = "2026-07-16"
        gap["combinedDailyUsage"]["points"][1]["date"] = "2026-07-16"
        gap["updated_at"] = "2026-07-17T00:05:00Z"
        invalid_cases.append((gap, "include every UTC date"))

        negative = self.daily_source()
        negative["combinedDailyUsage"]["points"][0]["tokens"] = -1
        invalid_cases.append((negative, "non-negative integer"))

        null_tokens = self.daily_source()
        null_tokens["combinedDailyUsage"]["points"][0]["tokens"] = None
        invalid_cases.append((null_tokens, "non-negative integer"))

        today = self.daily_source()
        today["combinedDailyUsage"]["coverage"]["complete_through"] = "2026-07-16"
        today["combinedDailyUsage"]["points"][1]["date"] = "2026-07-16"
        invalid_cases.append((today, "latest completed UTC date"))

        unreconciled = self.daily_source()
        unreconciled["combinedDailyUsage"]["points"][0]["tokens"] -= 100_000_000
        invalid_cases.append((unreconciled, "does not reconcile"))

        invalid_whole = self.daily_source()
        invalid_whole["combinedDailyUsage"]["coverage"][
            "prior_unallocated_tokens"
        ] = 1
        invalid_cases.append((invalid_whole, "whole-lifetime coverage"))

        invalid_partial = self.daily_source(completeness="rolling_window_partial")
        invalid_partial["combinedDailyUsage"]["coverage"][
            "prior_unallocated_tokens"
        ] = 0
        invalid_cases.append((invalid_partial, "rolling-window coverage"))

        invalid_coverage_type = self.daily_source()
        invalid_coverage_type["combinedDailyUsage"]["coverage"]["before_start"] = []
        invalid_cases.append((invalid_coverage_type, "before_start is invalid"))

        for source, message in invalid_cases:
            with self.subTest(message=message):
                observed = datetime.fromisoformat(
                    source["updated_at"].replace("Z", "+00:00")
                )
                with self.assertRaisesRegex(tracker.SnapshotError, message):
                    tracker.build_site_snapshot(source, now=observed)

    def test_daily_progression_is_monotonic_and_allows_partial_to_whole_upgrade(
        self,
    ) -> None:
        previous = tracker.build_site_snapshot(
            self.daily_source(completeness="rolling_window_partial"),
            now=self.NOW,
        )
        whole = self.daily_source(
            token_count=33_000_000_000,
            updated_at="2026-07-17T00:05:00Z",
        )
        whole["combinedDailyUsage"]["coverage"]["starts_on"] = "2026-07-13"
        whole["combinedDailyUsage"]["coverage"]["complete_through"] = "2026-07-16"
        whole["combinedDailyUsage"]["points"] = [
            {"date": "2026-07-13", "tokens": 32_100_000_000},
            {"date": "2026-07-14", "tokens": 500_000_000},
            {"date": "2026-07-15", "tokens": 200_000_000},
            {"date": "2026-07-16", "tokens": 200_000_000},
        ]
        upgraded = tracker.build_site_snapshot(
            whole,
            previous_site=previous,
            now=datetime(2026, 7, 17, 0, 10, tzinfo=timezone.utc),
        )
        self.assertEqual(
            upgraded["combined_daily_usage"]["coverage"]["completeness"],
            "whole_lifetime",
        )

        revised = json.loads(json.dumps(whole))
        revised["combinedDailyUsage"]["points"][1]["tokens"] += 1
        revised["combinedDailyUsage"]["points"][2]["tokens"] -= 1
        with self.assertRaisesRegex(tracker.SnapshotError, "previously completed"):
            tracker.build_site_snapshot(
                revised,
                previous_site=upgraded,
                now=datetime(2026, 7, 17, 0, 10, tzinfo=timezone.utc),
            )

        regressed = json.loads(json.dumps(whole))
        regressed["combinedDailyUsage"]["coverage"][
            "completeness"
        ] = "rolling_window_partial"
        regressed["combinedDailyUsage"]["coverage"]["before_start"] = "unobserved"
        regressed["combinedDailyUsage"]["coverage"][
            "prior_unallocated_tokens"
        ] = 100_000_000
        regressed["combinedDailyUsage"]["points"][0]["tokens"] -= 100_000_000
        with self.assertRaisesRegex(tracker.SnapshotError, "cannot become partial"):
            tracker.build_site_snapshot(
                regressed,
                previous_site=upgraded,
                now=datetime(2026, 7, 17, 0, 10, tzinfo=timezone.utc),
            )

    def test_legacy_collector_cannot_downgrade_an_exact_daily_pair(self) -> None:
        previous = tracker.build_site_snapshot(self.daily_source(), now=self.NOW)
        with self.assertRaisesRegex(tracker.SnapshotError, "legacy collector"):
            tracker.build_site_snapshot(
                self.source(),
                previous_site=previous,
                now=self.NOW,
            )

    def test_public_profile_rejects_invalid_cost_basis(self) -> None:
        invalid_cases = (
            (float("nan"), "numeric"),
            (float("inf"), "numeric"),
            (0, "positive"),
        )
        for usd_estimate, message in invalid_cases:
            with self.subTest(usd_estimate=usd_estimate):
                usage = self.agentic_usage()
                usage["total"]["api_cost_equivalence"]["usd_estimate"] = usd_estimate
                with self.assertRaisesRegex(tracker.SnapshotError, message):
                    tracker.build_public_snapshot(
                        self.source(), agentic_usage=usage, now=self.NOW
                    )

        usage = self.agentic_usage()
        usage["total"]["api_cost_equivalence"]["pricing_as_of"] = (
            "2026-07-12T00:00:00"
        )
        with self.assertRaisesRegex(tracker.SnapshotError, "ISO date"):
            tracker.build_public_snapshot(
                self.source(), agentic_usage=usage, now=self.NOW
            )

    def test_migrates_schema3_snapshot_to_verified_daily_history(self) -> None:
        observed_at = datetime(2026, 7, 27, 0, 35, tzinfo=timezone.utc)
        source = self.source(
            token_count=52_800_000_000,
            updated_at="2026-07-27T00:31:42.242208Z",
        )
        public = tracker.build_site_snapshot(
            source,
            previous_site=self.legacy_site_snapshot(),
            now=observed_at,
        )
        points = public["combined_lifetime_history"]["points"]
        self.assertEqual(
            [(point["date"], point["token_count"]) for point in points],
            [
                ("2026-07-16", 32_800_000_000),
                ("2026-07-19", 42_300_000_000),
                ("2026-07-20", 43_200_000_000),
                ("2026-07-21", 45_000_000_000),
                ("2026-07-22", 48_800_000_000),
                ("2026-07-23", 52_000_000_000),
                ("2026-07-24", 52_100_000_000),
                ("2026-07-25", 52_100_000_000),
                ("2026-07-26", 52_800_000_000),
                ("2026-07-27", 52_800_000_000),
            ],
        )
        self.assertEqual(points[0]["observation"], "user_reported")
        self.assertTrue(
            all(point["observation"] == "automated" for point in points[1:])
        )
        self.assertNotIn("2026-07-12", {point["date"] for point in points})
        self.assertNotIn("2026-07-17", {point["date"] for point in points})
        self.assertNotIn("2026-07-18", {point["date"] for point in points})
        self.assertEqual(
            points[-1]["token_count"],
            public["combined_lifetime"]["token_count"],
        )

    def test_migrates_the_actual_automated_schema3_cutover_pair(self) -> None:
        observed_at = datetime(2026, 7, 27, 0, 35, tzinfo=timezone.utc)
        source = self.source(
            token_count=52_800_000_000,
            updated_at="2026-07-27T00:31:42.242208Z",
        )
        public = tracker.build_site_snapshot(
            source,
            previous_site=self.automated_legacy_site_snapshot(),
            now=observed_at,
        )
        self.assertEqual(public["schema"], 4)
        self.assertEqual(public["observed_on"], "2026-07-27")
        self.assertEqual(
            public["combined_lifetime_history"]["points"],
            json.loads(
                (REPO_ROOT / "_data" / "direct_usage_tracker.json").read_text(
                    encoding="utf-8"
                )
            )["combined_lifetime_history"]["points"],
        )

    def test_appends_a_new_utc_day_without_filling_unobserved_days(self) -> None:
        previous = tracker.build_site_snapshot(self.source(), now=self.NOW)
        source = self.source(
            token_count=33_000_000_000,
            updated_at="2026-07-18T00:05:00Z",
        )
        public = tracker.build_site_snapshot(
            source,
            previous_site=previous,
            now=datetime(2026, 7, 18, 0, 10, tzinfo=timezone.utc),
        )
        self.assertEqual(
            public["combined_lifetime_history"]["points"],
            [
                {
                    "date": "2026-07-16",
                    "token_count": 32_800_000_000,
                    "tokens_label": "32.8B",
                    "observation": "automated",
                },
                {
                    "date": "2026-07-18",
                    "token_count": 33_000_000_000,
                    "tokens_label": "33.0B",
                    "observation": "automated",
                },
            ],
        )

    def test_later_same_day_observation_replaces_instead_of_appending(self) -> None:
        previous = tracker.build_site_snapshot(self.source(), now=self.NOW)
        source = self.source(
            token_count=32_900_000_000,
            updated_at="2026-07-16T18:59:00Z",
        )
        public = tracker.build_site_snapshot(
            source,
            previous_site=previous,
            now=self.NOW,
        )
        self.assertEqual(
            public["combined_lifetime_history"]["points"],
            [
                {
                    "date": "2026-07-16",
                    "token_count": 32_900_000_000,
                    "tokens_label": "32.9B",
                    "observation": "automated",
                }
            ],
        )

    def test_rejects_same_day_time_or_lifetime_regression(self) -> None:
        previous = tracker.build_site_snapshot(self.source(), now=self.NOW)
        invalid_cases = (
            (
                self.source(
                    token_count=32_900_000_000,
                    updated_at="2026-07-16T18:55:00Z",
                ),
                "later observation timestamp",
            ),
            (
                self.source(
                    token_count=32_900_000_000,
                    updated_at="2026-07-16T18:54:00Z",
                ),
                "cannot precede",
            ),
            (
                self.source(
                    token_count=32_700_000_000,
                    updated_at="2026-07-16T18:59:00Z",
                ),
                "cannot decrease",
            ),
        )
        for source, message in invalid_cases:
            with self.subTest(message=message):
                with self.assertRaisesRegex(tracker.SnapshotError, message):
                    tracker.build_site_snapshot(
                        source,
                        previous_site=previous,
                        now=self.NOW,
                    )

    def test_rejects_malformed_or_privacy_expanding_prior_history(self) -> None:
        valid = tracker.build_site_snapshot(self.source(), now=self.NOW)
        invalid_cases = []

        extra = json.loads(json.dumps(valid))
        extra["combined_lifetime_history"]["points"][0]["account_id"] = "private"
        invalid_cases.append((extra, "invalid keys"))

        duplicate = json.loads(json.dumps(valid))
        duplicate["combined_lifetime_history"]["points"].append(
            dict(duplicate["combined_lifetime_history"]["points"][0])
        )
        invalid_cases.append((duplicate, "strictly increasing"))

        decreasing = json.loads(json.dumps(valid))
        decreasing["combined_lifetime_history"]["points"].insert(
            0,
            {
                "date": "2026-07-16",
                "token_count": 32_900_000_000,
                "tokens_label": "32.9B",
                "observation": "user_reported",
            },
        )
        decreasing["combined_lifetime_history"]["points"][1]["date"] = "2026-07-17"
        invalid_cases.append((decreasing, "nondecreasing"))

        mismatched_final = json.loads(json.dumps(valid))
        mismatched_final["combined_lifetime_history"]["points"][0][
            "token_count"
        ] = 32_900_000_000
        mismatched_final["combined_lifetime_history"]["points"][0][
            "tokens_label"
        ] = "32.9B"
        invalid_cases.append((mismatched_final, "final point"))

        invalid_observation = json.loads(json.dumps(valid))
        invalid_observation["combined_lifetime_history"]["points"][0][
            "observation"
        ] = "per_account"
        invalid_cases.append((invalid_observation, "observation is invalid"))

        invalid_observation_type = json.loads(json.dumps(valid))
        invalid_observation_type["combined_lifetime_history"]["points"][0][
            "observation"
        ] = []
        invalid_cases.append((invalid_observation_type, "observation is invalid"))

        next_source = self.source(
            token_count=33_000_000_000,
            updated_at="2026-07-18T00:05:00Z",
        )
        for previous, message in invalid_cases:
            with self.subTest(message=message):
                with self.assertRaisesRegex(tracker.SnapshotError, message):
                    tracker.build_site_snapshot(
                        next_source,
                        previous_site=previous,
                        now=datetime(2026, 7, 18, 0, 10, tzinfo=timezone.utc),
                    )

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
                    tracker.build_site_snapshot(source, now=self.NOW)

    def test_rejects_wrong_source_count_or_unrounded_total(self) -> None:
        wrong_count = self.source()
        wrong_count["combinedLifetime"]["sourceCount"] = 1
        with self.assertRaisesRegex(tracker.SnapshotError, "sourceCount must be 2"):
            tracker.build_site_snapshot(wrong_count, now=self.NOW)

        unrounded = self.source()
        unrounded["combinedLifetime"]["tokenCount"] = 32_812_345_678
        with self.assertRaisesRegex(tracker.SnapshotError, "nearest-0.1B rounded"):
            tracker.build_site_snapshot(unrounded, now=self.NOW)

        unsafe = self.source()
        unsafe["combinedLifetime"]["tokenCount"] = 9_100_000_000_000_000
        with self.assertRaisesRegex(tracker.SnapshotError, "JavaScript-safe integer"):
            tracker.build_site_snapshot(unsafe, now=self.NOW)

    def test_rejects_stale_or_future_input(self) -> None:
        stale = self.source()
        stale["updated_at"] = "2026-07-16T18:00:00Z"
        with self.assertRaisesRegex(tracker.SnapshotError, "stale"):
            tracker.build_site_snapshot(stale, now=self.NOW)

        future = self.source()
        future["updated_at"] = "2026-07-16T19:06:00Z"
        with self.assertRaisesRegex(tracker.SnapshotError, "future"):
            tracker.build_site_snapshot(future, now=self.NOW)

    def test_rejects_legacy_quota_health_projection(self) -> None:
        legacy = {
            "schemaVersion": 1,
            "accountCount": 2,
            "health": {"healthyAccountCount": 2, "unavailableAccountCount": 0},
        }
        with self.assertRaisesRegex(tracker.SnapshotError, "invalid keys"):
            tracker.build_site_snapshot(legacy, now=self.NOW)

    def test_rejects_non_integer_schema_version_and_legacy_confidence_aliases(self) -> None:
        for schema_version in (3.0, True):
            with self.subTest(schema_version=schema_version):
                source = self.source()
                source["schemaVersion"] = schema_version
                with self.assertRaisesRegex(tracker.SnapshotError, "schemaVersion must be 3"):
                    tracker.build_site_snapshot(source, now=self.NOW)

        for confidence in ("direct", "complete", "direct complete observation"):
            with self.subTest(confidence=confidence):
                source = self.source()
                source["confidence"] = confidence
                with self.assertRaisesRegex(tracker.SnapshotError, "confidence must be 'high'"):
                    tracker.build_site_snapshot(source, now=self.NOW)

    def test_loads_a_matching_legacy_pair_and_rejects_privacy_expansion(self) -> None:
        site_payload = self.legacy_site_snapshot()
        profile_payload = {
            **site_payload,
            "schema": 4,
            "cost": tracker._cost_equivalence(
                site_payload["combined_lifetime"]["token_count"],
                self.agentic_usage(),
            ),
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            site_path = root / "_data" / "direct_usage_tracker.json"
            profile_path = root / "assets" / "data" / "codex-profile-usage.json"
            site_path.parent.mkdir(parents=True, exist_ok=True)
            profile_path.parent.mkdir(parents=True, exist_ok=True)
            site_path.write_text(json.dumps(site_payload), encoding="utf-8")
            profile_path.write_text(json.dumps(profile_payload), encoding="utf-8")
            self.assertEqual(tracker._load_previous_site(root), site_payload)

            profile_payload["per_account"] = []
            profile_path.write_text(json.dumps(profile_payload), encoding="utf-8")
            with self.assertRaisesRegex(tracker.SnapshotError, "invalid keys"):
                tracker._load_previous_site(root)

    def test_previous_pair_must_both_exist(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            site_path = root / "_data" / "direct_usage_tracker.json"
            site_path.parent.mkdir(parents=True, exist_ok=True)
            site_path.write_text(
                json.dumps(self.legacy_site_snapshot()),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(tracker.SnapshotError, "both exist"):
                tracker._load_previous_site(root)

    def test_publishes_schema4_site_and_schema5_profile_atomically(self) -> None:
        site_payload = tracker.build_site_snapshot(self.source(), now=self.NOW)
        profile_payload = tracker.build_public_snapshot(
            self.source(), agentic_usage=self.agentic_usage(), now=self.NOW
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            tracker.publish_atomically(root, site_payload, profile_payload)
            site = (root / "_data" / "direct_usage_tracker.json").read_bytes()
            profile = (root / "assets" / "data" / "codex-profile-usage.json").read_bytes()
            self.assertNotEqual(site, profile)
            self.assertEqual(json.loads(site), site_payload)
            self.assertEqual(json.loads(profile), profile_payload)
            self.assertEqual(json.loads(site)["schema"], 4)
            self.assertEqual(json.loads(profile)["schema"], 5)
            self.assertEqual(
                json.loads(site)["combined_lifetime_history"],
                json.loads(profile)["combined_lifetime_history"],
            )

    def test_publishes_and_reloads_schema5_site_and_schema6_profile_atomically(
        self,
    ) -> None:
        site_payload = tracker.build_site_snapshot(
            self.daily_source(),
            now=self.NOW,
        )
        profile_payload = tracker.build_public_snapshot(
            self.daily_source(),
            agentic_usage=self.agentic_usage(),
            now=self.NOW,
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            tracker.publish_atomically(root, site_payload, profile_payload)
            site = json.loads(
                (root / "_data" / "direct_usage_tracker.json").read_text(
                    encoding="utf-8"
                )
            )
            profile = json.loads(
                (
                    root / "assets" / "data" / "codex-profile-usage.json"
                ).read_text(encoding="utf-8")
            )
            self.assertEqual(site["schema"], 5)
            self.assertEqual(profile["schema"], 6)
            self.assertEqual(
                site["combined_daily_usage"],
                profile["combined_daily_usage"],
            )
            self.assertEqual(tracker._load_previous_site(root), site_payload)

    def test_rejected_input_preserves_the_last_valid_pair(self) -> None:
        site_payload = tracker.build_site_snapshot(self.daily_source(), now=self.NOW)
        profile_payload = tracker.build_public_snapshot(
            self.daily_source(), agentic_usage=self.agentic_usage(), now=self.NOW
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            tracker.publish_atomically(root, site_payload, profile_payload)
            site_path = root / "_data" / "direct_usage_tracker.json"
            profile_path = root / "assets" / "data" / "codex-profile-usage.json"
            original_site = site_path.read_bytes()
            original_profile = profile_path.read_bytes()
            (root / "_data" / "agentic_usage.yml").write_text(
                json.dumps(self.agentic_usage()),
                encoding="utf-8",
            )
            invalid_source = self.daily_source()
            invalid_source["combinedDailyUsage"] = None
            input_path = root / "collector.json"
            input_path.write_text(json.dumps(invalid_source), encoding="utf-8")

            with (
                mock.patch.object(
                    sys,
                    "argv",
                    [
                        "import_direct_usage_snapshot.py",
                        str(input_path),
                        "--repo-root",
                        str(root),
                    ],
                ),
                mock.patch("builtins.print"),
            ):
                self.assertEqual(tracker.main(), 1)
            self.assertEqual(site_path.read_bytes(), original_site)
            self.assertEqual(profile_path.read_bytes(), original_profile)

    def test_second_replace_failure_restores_both_previous_outputs(self) -> None:
        site_payload = tracker.build_site_snapshot(self.source(), now=self.NOW)
        profile_payload = tracker.build_public_snapshot(
            self.source(), agentic_usage=self.agentic_usage(), now=self.NOW
        )
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
                    tracker.publish_atomically(root, site_payload, profile_payload)
            for path in targets:
                self.assertEqual(path.read_text(encoding="utf-8"), '{"old":true}\n')

    def test_second_stage_failure_leaves_no_output_or_temp_file(self) -> None:
        site_payload = tracker.build_site_snapshot(self.source(), now=self.NOW)
        profile_payload = tracker.build_public_snapshot(
            self.source(), agentic_usage=self.agentic_usage(), now=self.NOW
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            real_staged_file = tracker._staged_file
            calls = 0

            def fail_second(path: Path, content: bytes) -> Path:
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError("synthetic second staging failure")
                return real_staged_file(path, content)

            with mock.patch.object(
                tracker,
                "_staged_file",
                side_effect=fail_second,
            ):
                with self.assertRaisesRegex(OSError, "synthetic"):
                    tracker.publish_atomically(root, site_payload, profile_payload)

            self.assertFalse(
                (root / "_data" / "direct_usage_tracker.json").exists()
            )
            self.assertFalse(
                (root / "assets" / "data" / "codex-profile-usage.json").exists()
            )
            self.assertEqual(list(root.rglob("*.tmp")), [])


if __name__ == "__main__":
    unittest.main()
