from __future__ import annotations

import json
import unittest
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
TIER_PATH = REPO_ROOT / "_data" / "github_ai_tiers.yml"
ACTIVITY_PATHS = (
    TIER_PATH,
    REPO_ROOT / "_pages" / "github-activity.md",
    REPO_ROOT / "assets" / "js" / "github-activity.js",
)
FORBIDDEN = (
    "invoice.stripe.com",
    "acct_",
    "live_",
    "ghp_",
)


class GithubActivityPrivacyTests(unittest.TestCase):
    def test_public_activity_sources_reject_invoice_and_credential_fragments(self) -> None:
        combined = "\n".join(path.read_text(encoding="utf-8") for path in ACTIVITY_PATHS).lower()
        for fragment in FORBIDDEN:
            self.assertNotIn(fragment.lower(), combined)

    def test_tier_file_is_normalized_and_contains_no_raw_invoice_fields(self) -> None:
        data = yaml.safe_load(TIER_PATH.read_text(encoding="utf-8"))
        self.assertEqual(data["schema"], 1)
        self.assertEqual(data["assignment"], "week_midpoint_wednesday")
        self.assertEqual(
            [(phase["start"], phase.get("end"), phase["tier_usd"]) for phase in data["phases"]],
            [
                ("2023-05-10", "2026-03-04", 20),
                ("2026-03-05", "2026-05-04", 200),
                ("2026-05-05", "2026-06-05", 100),
                ("2026-06-06", None, 200),
            ],
        )
        serialized = json.dumps(data).lower()
        self.assertNotIn("account", serialized)
        self.assertNotIn("url", serialized)


if __name__ == "__main__":
    unittest.main()
