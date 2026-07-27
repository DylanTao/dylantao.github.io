from __future__ import annotations

import json
import re
import unittest
from datetime import date, datetime, timedelta
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
TIER_PATH = REPO_ROOT / "_data" / "github_ai_tiers.yml"
COMBINED_ACTIVITY_PATH = REPO_ROOT / "_data" / "combined_code_activity.json"
ACTIVITY_PATHS = (
    TIER_PATH,
    COMBINED_ACTIVITY_PATH,
    REPO_ROOT / "_pages" / "github-activity.md",
    REPO_ROOT / "assets" / "js" / "github-activity.js",
    REPO_ROOT / "assets" / "data" / "codex-profile-usage.json",
    REPO_ROOT / "_data" / "direct_usage_tracker.json",
    REPO_ROOT / "_data" / "github_activity.json",
)
FORBIDDEN = (
    "invoice.stripe.com",
    "acct_",
    "live_",
    "ghp_",
    "github_pat_",
    "access_token",
    "refresh_token",
    "account_id",
    "autodesk",
)


class GithubActivityPrivacyTests(unittest.TestCase):
    def test_public_activity_sources_reject_invoice_and_credential_fragments(
        self,
    ) -> None:
        combined = "\n".join(
            path.read_text(encoding="utf-8") for path in ACTIVITY_PATHS
        ).lower()
        for fragment in FORBIDDEN:
            self.assertNotIn(fragment.lower(), combined)

    def test_tier_file_is_normalized_and_contains_no_raw_invoice_fields(self) -> None:
        text = TIER_PATH.read_text(encoding="utf-8")
        self.assertRegex(text, r"(?m)^schema:\s*1\s*$")
        self.assertRegex(text, r"(?m)^assignment:\s*week_midpoint_wednesday\s*$")
        phase_blocks = re.findall(r"(?ms)^  - key:.*?(?=^  - key:|\Z)", text)
        phases: list[tuple[str, str | None, int]] = []
        for block in phase_blocks:
            start = re.search(r'(?m)^    start:\s*"(\d{4}-\d{2}-\d{2})"\s*$', block)
            end = re.search(r'(?m)^    end:\s*(?:"(\d{4}-\d{2}-\d{2})")?\s*$', block)
            tier = re.search(r"(?m)^    tier_usd:\s*(\d+)\s*$", block)
            self.assertIsNotNone(start)
            self.assertIsNotNone(end)
            self.assertIsNotNone(tier)
            phases.append((start.group(1), end.group(1), int(tier.group(1))))
        self.assertEqual(
            phases,
            [
                ("2023-05-10", "2026-03-04", 20),
                ("2026-03-05", "2026-05-04", 200),
                ("2026-05-05", "2026-06-05", 100),
                ("2026-06-06", None, 200),
            ],
        )
        self.assertNotRegex(text.lower(), r"(?m)^\s*(?:account|url):")

    def test_public_codex_profile_contract_is_rounded_anonymous_and_separate(
        self,
    ) -> None:
        public = json.loads(
            (REPO_ROOT / "assets" / "data" / "codex-profile-usage.json").read_text()
        )
        site_copy = json.loads(
            (REPO_ROOT / "_data" / "direct_usage_tracker.json").read_text()
        )
        required_keys = {
            "schema",
            "combined_lifetime",
            "combined_lifetime_history",
            "method",
            "confidence",
            "observed_on",
            "updated_at",
            "automated_refresh",
        }
        self.assertEqual(site_copy["schema"], 4)
        self.assertEqual(set(site_copy), required_keys)
        self.assertEqual(public["schema"], 5)
        self.assertEqual(set(public), required_keys | {"cost"})
        for key in required_keys - {"schema"}:
            self.assertEqual(public[key], site_copy[key])
        lifetime = site_copy["combined_lifetime"]
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
        token_count = lifetime["token_count"]
        self.assertIsInstance(token_count, int)
        self.assertNotIsInstance(token_count, bool)
        self.assertGreater(token_count, 0)
        self.assertLessEqual(token_count, 9_007_199_254_740_991)
        self.assertEqual(token_count % 100_000_000, 0)
        billions, remainder = divmod(token_count, 1_000_000_000)
        self.assertEqual(
            lifetime["tokens_label"],
            f"{billions}.{remainder // 100_000_000}B",
        )
        self.assertEqual(lifetime["units"], "tokens")
        self.assertEqual(lifetime["source_count"], 2)
        self.assertEqual(lifetime["aggregation"], "sum_of_sources")
        self.assertEqual(lifetime["rounding"], "nearest_0.1B")
        observed_on = date.fromisoformat(site_copy["observed_on"])
        self.assertIsInstance(site_copy["automated_refresh"], bool)
        if site_copy["automated_refresh"]:
            self.assertEqual(
                site_copy["method"],
                "rounded_sum_of_verified_account_lifetime_readings",
            )
            self.assertEqual(site_copy["confidence"], "high")
            self.assertIsInstance(site_copy["updated_at"], str)
            refreshed_at = datetime.fromisoformat(
                site_copy["updated_at"].replace("Z", "+00:00")
            )
            self.assertIsNotNone(refreshed_at.tzinfo)
            self.assertEqual(refreshed_at.utcoffset(), timedelta(0))
            self.assertEqual(refreshed_at.date(), observed_on)
        else:
            self.assertEqual(
                site_copy["method"],
                "user_reported_rounded_lifetime_checkpoint",
            )
            self.assertEqual(site_copy["confidence"], "user reported")
            self.assertIsNone(site_copy["updated_at"])
        history = site_copy["combined_lifetime_history"]
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
        self.assertGreater(len(history["points"]), 0)
        previous_date: date | None = None
        previous_count = -1
        for point in history["points"]:
            self.assertEqual(
                set(point),
                {"date", "token_count", "tokens_label", "observation"},
            )
            point_date = date.fromisoformat(point["date"])
            self.assertIsInstance(point["token_count"], int)
            self.assertNotIsInstance(point["token_count"], bool)
            self.assertGreater(point["token_count"], 0)
            self.assertEqual(point["token_count"] % 100_000_000, 0)
            point_billions, point_remainder = divmod(
                point["token_count"], 1_000_000_000
            )
            self.assertEqual(
                point["tokens_label"],
                f"{point_billions}.{point_remainder // 100_000_000}B",
            )
            self.assertIn(point["observation"], {"user_reported", "automated"})
            if previous_date is not None:
                self.assertGreater(point_date, previous_date)
            self.assertGreaterEqual(point["token_count"], previous_count)
            previous_date = point_date
            previous_count = point["token_count"]
        self.assertEqual(history["points"][0]["date"], "2026-07-16")
        self.assertEqual(history["points"][-1]["date"], site_copy["observed_on"])
        self.assertEqual(
            history["points"][-1]["token_count"],
            lifetime["token_count"],
        )
        replay = public["cost"]
        self.assertEqual(
            set(replay),
            {
                "method",
                "reference_scope",
                "usd_per_million_tokens",
                "pricing_as_of",
                "usd_midpoint",
                "usd_label",
            },
        )
        self.assertEqual(replay["method"], "flat_reference_rate_replay")
        self.assertEqual(
            replay["reference_scope"],
            "current_site_build_blended_public_api_rate",
        )
        self.assertIsInstance(replay["usd_per_million_tokens"], (int, float))
        self.assertGreater(replay["usd_per_million_tokens"], 0)
        self.assertIsInstance(replay["usd_midpoint"], int)
        self.assertGreater(replay["usd_midpoint"], 0)
        self.assertRegex(
            replay["usd_label"], r"^~\$\d+\.\dK API-rate replay$"
        )
        date.fromisoformat(replay["pricing_as_of"])
        expected = int(
            lifetime["token_count"]
            / 1_000_000
            * replay["usd_per_million_tokens"]
            + 0.5
        )
        self.assertEqual(replay["usd_midpoint"], expected)
        serialized = json.dumps((site_copy, public)).lower()
        for fragment in (
            "email",
            "account_id",
            "plan_type",
            "reset",
            "healthyaccount",
            "quota",
            "per_account",
        ):
            self.assertNotIn(fragment, serialized)

    def test_public_ledger_omits_machine_paths_and_retired_account_exactness(self) -> None:
        text = (REPO_ROOT / "docs" / "agentic-usage-ledger.md").read_text(
            encoding="utf-8"
        )
        self.assertNotRegex(text, r"(?i)\b[A-Z]:[\\/](?:Users|dev)[\\/]")
        for fragment in (
            "24,113,293,841",
            "2,158,343,669",
            "16.98B tokens in the account-owned",
            "45.24B tokens",
            "scaling the account total",
        ):
            self.assertNotIn(fragment, text)

    def test_checked_in_github_fallback_has_exact_privacy_contract(self) -> None:
        activity = json.loads(
            (REPO_ROOT / "_data" / "github_activity.json").read_text()
        )
        self.assertEqual(set(activity), {"schema", "generatedAt", "weeks"})
        self.assertEqual(activity["schema"], 2)
        generated_at = datetime.fromisoformat(
            activity["generatedAt"].replace("Z", "+00:00")
        )
        self.assertIsNotNone(generated_at.tzinfo)
        self.assertEqual(len(activity["weeks"]), 300)

        previous: date | None = None
        for row in activity["weeks"]:
            self.assertEqual(
                set(row),
                {"week", "additions", "deletions", "commits"},
            )
            observed = date.fromisoformat(row["week"])
            self.assertEqual(observed.weekday(), 6)
            if previous is not None:
                self.assertEqual(observed, previous + timedelta(days=7))
            for field in ("additions", "deletions", "commits"):
                self.assertIsInstance(row[field], int)
                self.assertNotIsInstance(row[field], bool)
                self.assertGreaterEqual(row[field], 0)
            previous = observed

    def test_combined_daily_snapshots_are_cumulative_and_identity_free(self) -> None:
        activity = json.loads(COMBINED_ACTIVITY_PATH.read_text(encoding="utf-8"))
        self.assertEqual(
            set(activity),
            {
                "schema",
                "timezone",
                "scope",
                "aggregation",
                "updated_on",
                "points",
            },
        )
        self.assertEqual(activity["schema"], 1)
        self.assertEqual(activity["timezone"], "America/Los_Angeles")
        self.assertEqual(activity["scope"], "combined_code_activity")
        self.assertEqual(
            activity["aggregation"],
            "cumulative_daily_snapshots",
        )
        self.assertGreaterEqual(len(activity["points"]), 1)

        previous_date: date | None = None
        previous_counts: dict[str, int] | None = None
        for point in activity["points"]:
            self.assertEqual(
                set(point),
                {"date", "commits", "additions", "deletions"},
            )
            observed = date.fromisoformat(point["date"])
            self.assertLessEqual(observed, date.today())
            if previous_date is not None:
                self.assertGreater(observed, previous_date)
            counts = {}
            for field in ("commits", "additions", "deletions"):
                self.assertIsInstance(point[field], int)
                self.assertNotIsInstance(point[field], bool)
                self.assertGreaterEqual(point[field], 0)
                counts[field] = point[field]
            if previous_counts is not None:
                for field in ("commits", "additions", "deletions"):
                    self.assertGreaterEqual(counts[field], previous_counts[field])
            previous_date = observed
            previous_counts = counts

        self.assertEqual(activity["updated_on"], activity["points"][-1]["date"])
        serialized = json.dumps(activity).lower()
        for fragment in (
            "account",
            "employer",
            "repository",
            "email",
            "host",
            "sha",
            "message",
            "timestamp",
        ):
            self.assertNotIn(fragment, serialized)


if __name__ == "__main__":
    unittest.main()
