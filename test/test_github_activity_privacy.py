from __future__ import annotations

import json
import re
import unittest
from datetime import date, datetime, timedelta
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
TIER_PATH = REPO_ROOT / "_data" / "github_ai_tiers.yml"
ACTIVITY_PATHS = (
    TIER_PATH,
    REPO_ROOT / "_pages" / "github-activity.md",
    REPO_ROOT / "assets" / "js" / "github-activity.js",
    REPO_ROOT / "assets" / "data" / "codex-profile-usage.json",
    REPO_ROOT / "assets" / "data" / "build-rhythm-token-rhythm.json.liquid",
    REPO_ROOT / "assets" / "data" / "build-rhythm-all-work-token-rhythm.json.liquid",
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
        self.assertEqual(public, site_copy)
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
        observed_on = date.fromisoformat(public["observed_on"])
        self.assertIsInstance(public["automated_refresh"], bool)
        if public["automated_refresh"]:
            self.assertEqual(
                public["method"],
                "rounded_sum_of_verified_account_lifetime_readings",
            )
            self.assertEqual(public["confidence"], "high")
            self.assertIsInstance(public["updated_at"], str)
            refreshed_at = datetime.fromisoformat(
                public["updated_at"].replace("Z", "+00:00")
            )
            self.assertIsNotNone(refreshed_at.tzinfo)
            self.assertEqual(refreshed_at.utcoffset(), timedelta(0))
            self.assertEqual(refreshed_at.date(), observed_on)
        else:
            self.assertEqual(
                public["method"],
                "user_reported_rounded_lifetime_checkpoint",
            )
            self.assertEqual(public["confidence"], "user reported")
            self.assertIsNone(public["updated_at"])
        serialized = json.dumps(public).lower()
        for fragment in (
            "email",
            "account_id",
            "plan_type",
            "reset",
            "daily",
            "history",
            "api_cost",
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


if __name__ == "__main__":
    unittest.main()
