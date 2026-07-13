from __future__ import annotations

import json
import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
TIER_PATH = REPO_ROOT / "_data" / "github_ai_tiers.yml"
ACTIVITY_PATHS = (
    TIER_PATH,
    REPO_ROOT / "_pages" / "github-activity.md",
    REPO_ROOT / "assets" / "js" / "github-activity.js",
    REPO_ROOT / "assets" / "data" / "codex-profile-usage.json",
    REPO_ROOT / "_data" / "codex_account_history.json",
)
FORBIDDEN = (
    "invoice.stripe.com",
    "acct_",
    "live_",
    "ghp_",
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

    def test_public_codex_profile_contract_is_sanitized_and_history_backed(
        self,
    ) -> None:
        public = json.loads(
            (REPO_ROOT / "assets" / "data" / "codex-profile-usage.json").read_text()
        )
        history = json.loads(
            (REPO_ROOT / "_data" / "codex_account_history.json").read_text()
        )
        self.assertEqual(
            set(public),
            {"schema", "source", "sourceAsOf", "lifetime", "recent", "history"},
        )
        self.assertEqual(
            public["history"],
            {
                "grain": "calendar-day snapshots",
                "snapshotCount": len(history["snapshots"]),
                "firstSourceAsOf": history["snapshots"][0]["sourceAsOf"],
                "latestSourceAsOf": history["snapshots"][-1]["sourceAsOf"],
            },
        )
        self.assertNotIn("snapshots", public["history"])
        self.assertEqual(len(public["recent"]["daily"]), 30)
        self.assertIn(len(public["recent"]["weekly"]), {5, 6})
        first_week = public["recent"]["weekly"][0]
        self.assertEqual(first_week["partial"], first_week["observedDays"] < 7)
        self.assertTrue(public["recent"]["weekly"][-1]["partial"])
        serialized = json.dumps(public).lower()
        for fragment in (
            "local_lifetime",
            "observed_local",
            "codexbar",
            "model_effort",
        ):
            self.assertNotIn(fragment, serialized)


if __name__ == "__main__":
    unittest.main()
