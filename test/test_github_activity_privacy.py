from __future__ import annotations

import json
import re
import sys
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "bin"))
import import_code_activity as activity_importer  # noqa: E402


TIER_PATH = REPO_ROOT / "_data" / "github_ai_tiers.yml"
CODE_ACTIVITY_PATH = REPO_ROOT / "_data" / "code_activity.json"
CODE_ACTIVITY_SOURCES_PATH = REPO_ROOT / "_data" / "code_activity_sources"
ACTIVITY_PATHS = (
    TIER_PATH,
    CODE_ACTIVITY_PATH,
    REPO_ROOT / "_pages" / "github-activity.md",
    REPO_ROOT / "assets" / "js" / "github-activity.js",
    REPO_ROOT / "assets" / "data" / "codex-profile-usage.json",
    REPO_ROOT / "_data" / "direct_usage_tracker.json",
    *sorted(path for path in CODE_ACTIVITY_SOURCES_PATH.rglob("*") if path.is_file()),
)
# Pinned to the account creation day. The published window starts here and
# only ever grows forward.
LIFETIME_START = "2017-08-31"
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
    def test_checked_in_code_activity_uses_approved_source_contracts(self) -> None:
        now = datetime.now(timezone.utc)
        public = json.loads(CODE_ACTIVITY_PATH.read_text(encoding="utf-8"))
        self.assertEqual(
            activity_importer.validate_public_snapshot(public, now=now),
            public,
        )
        for path in sorted(CODE_ACTIVITY_SOURCES_PATH.glob("*.json")):
            with self.subTest(source=path.name):
                validated = activity_importer.validate_contributed_snapshot(
                    json.loads(path.read_text(encoding="utf-8")),
                    now=now,
                )
                self.assertEqual(validated["id"], path.stem)

    def test_public_activity_sources_reject_invoice_and_credential_fragments(
        self,
    ) -> None:
        combined = "\n".join(
            path.read_text(encoding="utf-8") for path in ACTIVITY_PATHS
        ).lower()
        for fragment in FORBIDDEN:
            self.assertNotIn(fragment.lower(), combined)

    def test_retired_weekly_fallback_cannot_drift_from_lifetime_daily_data(
        self,
    ) -> None:
        self.assertFalse((REPO_ROOT / "_data" / "github_activity.json").exists())

    def test_contributed_feed_contract_lives_beside_the_drop_location(self) -> None:
        contract = (
            REPO_ROOT / "_data" / "code_activity_sources" / "README.md"
        ).read_text(encoding="utf-8")
        for fragment in (
            '"id": "intern"',
            '"label": "Intern work"',
            '"basis": "reported_daily_summary"',
            "every UTC date",
            "cannot exceed",
            "Do not include repository",
            "--check",
        ):
            self.assertIn(fragment, contract)

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
            "method",
            "confidence",
            "observed_on",
            "updated_at",
            "automated_refresh",
        }
        # The checked-in pair is the current three-source family-safe publication.
        # Isolated importer tests retain collector-4/site-5/profile-6 support.
        self.assertEqual(site_copy["schema"], 6)
        self.assertEqual(public["schema"], 7)
        history_key = "combined_daily_usage"
        self.assertEqual(set(site_copy), required_keys | {history_key})
        self.assertEqual(set(public), required_keys | {history_key, "cost"})
        for key in (required_keys | {history_key}) - {"schema"}:
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
        source_contracts = {
            2: {
                "label": "Combined daily Codex usage",
                "method": "rounded_sum_of_verified_account_lifetime_readings",
                "confidence": "high",
            },
            3: {
                "label": "Combined daily agent usage",
                "method": "rounded_sum_of_observed_agent_usage_sources",
                "confidence": "mixed",
            },
        }
        source_count = lifetime["source_count"]
        self.assertIn(source_count, source_contracts)
        self.assertEqual(source_count, 3)
        self.assertEqual(lifetime["aggregation"], "sum_of_sources")
        self.assertEqual(lifetime["rounding"], "nearest_0.1B")
        observed_on = date.fromisoformat(site_copy["observed_on"])
        self.assertIsInstance(site_copy["automated_refresh"], bool)
        if site_copy["automated_refresh"]:
            self.assertEqual(
                site_copy["method"],
                source_contracts[source_count]["method"],
            )
            self.assertEqual(
                site_copy["confidence"],
                source_contracts[source_count]["confidence"],
            )
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
        history = site_copy[history_key]
        self.assertEqual(
            set(history),
            {
                "schema",
                "label",
                "units",
                "grain",
                "aggregation",
                "agent_families",
                "coverage",
                "points",
            },
        )
        self.assertEqual(history["schema"], 2)
        self.assertEqual(history["label"], source_contracts[source_count]["label"])
        self.assertEqual(history["units"], "tokens")
        self.assertEqual(history["grain"], "day")
        self.assertEqual(history["aggregation"], "sum_of_sources")
        self.assertEqual(history["agent_families"], ["codex", "claude"])
        coverage = history["coverage"]
        self.assertEqual(
            set(coverage),
            {
                "starts_on",
                "complete_through",
                "before_start",
                "completeness",
                "prior_unallocated_tokens",
                "prior_unallocated_by_agent",
            },
        )
        self.assertEqual(coverage["starts_on"], "2026-04-30")
        self.assertEqual(coverage["completeness"], "rolling_window_partial")
        self.assertEqual(coverage["before_start"], "unobserved")
        self.assertGreater(coverage["prior_unallocated_tokens"], 0)
        self.assertEqual(
            set(coverage["prior_unallocated_by_agent"]),
            {"codex", "claude"},
        )
        self.assertEqual(coverage["prior_unallocated_by_agent"]["claude"], 0)
        self.assertEqual(
            sum(coverage["prior_unallocated_by_agent"].values()),
            coverage["prior_unallocated_tokens"],
        )
        self.assertGreater(len(history["points"]), 0)
        pre_claude_points = [
            point for point in history["points"] if point["date"] < "2026-07-29"
        ]
        self.assertGreater(len(pre_claude_points), 0)
        self.assertTrue(
            all(point["agent_tokens"]["claude"] == 0 for point in pre_claude_points)
        )
        self.assertEqual(
            next(
                point["date"]
                for point in history["points"]
                if point["agent_tokens"]["claude"] > 0
            ),
            "2026-07-29",
        )
        previous_date: date | None = None
        exact_total = coverage["prior_unallocated_tokens"]
        family_totals = dict(coverage["prior_unallocated_by_agent"])
        for point in history["points"]:
            self.assertEqual(set(point), {"date", "tokens", "agent_tokens"})
            self.assertEqual(set(point["agent_tokens"]), {"codex", "claude"})
            point_date = date.fromisoformat(point["date"])
            if previous_date is not None:
                self.assertEqual(point_date, previous_date + timedelta(days=1))
            self.assertIsInstance(point["tokens"], int)
            self.assertNotIsInstance(point["tokens"], bool)
            self.assertGreaterEqual(point["tokens"], 0)
            for family, family_tokens in point["agent_tokens"].items():
                self.assertIsInstance(family_tokens, int)
                self.assertNotIsInstance(family_tokens, bool)
                self.assertGreaterEqual(family_tokens, 0)
                family_totals[family] += family_tokens
            self.assertEqual(sum(point["agent_tokens"].values()), point["tokens"])
            exact_total += point["tokens"]
            previous_date = point_date
        self.assertEqual(history["points"][0]["date"], coverage["starts_on"])
        self.assertEqual(
            history["points"][-1]["date"],
            coverage["complete_through"],
        )
        self.assertLess(
            date.fromisoformat(coverage["complete_through"]),
            date.fromisoformat(site_copy["observed_on"]),
        )
        self.assertEqual(sum(family_totals.values()), exact_total)
        self.assertGreater(family_totals["claude"], 0)
        rounded_total = ((exact_total + 50_000_000) // 100_000_000) * 100_000_000
        self.assertEqual(rounded_total, lifetime["token_count"])
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

    def test_code_activity_is_exact_schema5_or_compactly_unavailable(
        self,
    ) -> None:
        page = (REPO_ROOT / "_pages" / "github-activity.md").read_text(
            encoding="utf-8"
        )
        if not CODE_ACTIVITY_PATH.exists():
            self.assertEqual(page.count("Code history is being rebuilt."), 1)
            return

        activity = json.loads(CODE_ACTIVITY_PATH.read_text(encoding="utf-8"))
        self.assertEqual(activity["schema"], 5)
        self.assertEqual(
            set(activity),
            {
                "schema",
                "updated_on",
                "date_basis",
                "scope",
                "sources",
                "coverage",
                "points",
            },
        )
        self.assertEqual(activity["date_basis"], "source_reported_calendar")
        self.assertEqual(activity["scope"], "code_activity")

        # The lifetime anchor is fixed, so a refresh may extend coverage forward
        # but can never shorten it.
        self.assertEqual(activity["coverage"]["starts_on"], LIFETIME_START)
        self.assertEqual(
            activity["coverage"],
            {
                "starts_on": LIFETIME_START,
                "complete_through": activity["updated_on"],
                "status": "complete",
            },
        )

        windows: dict[str, tuple[date, date]] = {}
        source_calendars: dict[str, tuple[str, str]] = {}
        self.assertGreaterEqual(len(activity["sources"]), 1)
        for descriptor in activity["sources"]:
            self.assertEqual(
                set(descriptor),
                {
                    "id",
                    "label",
                    "basis",
                    "date_basis",
                    "completion_timezone",
                    "starts_on",
                    "complete_through",
                },
            )
            self.assertRegex(descriptor["id"], r"^[a-z0-9-]{1,24}$")
            self.assertNotIn(descriptor["id"], windows)
            self.assertTrue(descriptor["label"].strip())
            self.assertTrue(descriptor["basis"].strip())
            windows[descriptor["id"]] = (
                date.fromisoformat(descriptor["starts_on"]),
                date.fromisoformat(descriptor["complete_through"]),
            )
            source_calendars[descriptor["id"]] = (
                descriptor["date_basis"],
                descriptor["completion_timezone"],
            )
        self.assertIn("personal", windows)
        self.assertEqual(
            source_calendars["personal"],
            ("github_profile_author_date", "America/Los_Angeles"),
        )

        points = activity["points"]
        self.assertGreaterEqual(len(points), 1)
        previous_date: date | None = None
        for point in points:
            observed = date.fromisoformat(point["date"])
            if previous_date is not None:
                self.assertEqual(observed, previous_date + timedelta(days=1))
            # A source absent from a day is outside its own coverage rather than
            # a quiet day, so the key set must track coverage exactly.
            covered = {
                identifier
                for identifier, (start, end) in windows.items()
                if start <= observed <= end
            }
            self.assertEqual(set(point), {"date", *covered})
            for identifier in covered:
                completion_timezone = source_calendars[identifier][1]
                self.assertLess(
                    observed,
                    datetime.now(timezone.utc)
                    .astimezone(ZoneInfo(completion_timezone))
                    .date(),
                )
                entry = point[identifier]
                self.assertEqual(
                    set(entry),
                    {"commits", "authored_commits", "additions", "deletions"},
                )
                for field in entry:
                    self.assertIsInstance(entry[field], int)
                    self.assertNotIsInstance(entry[field], bool)
                    self.assertGreaterEqual(entry[field], 0)
                self.assertLessEqual(entry["authored_commits"], entry["commits"])
                if not entry["authored_commits"]:
                    self.assertEqual(entry["additions"], 0)
                    self.assertEqual(entry["deletions"], 0)
            previous_date = observed
        self.assertEqual(activity["coverage"]["starts_on"], points[0]["date"])
        self.assertEqual(
            activity["coverage"]["complete_through"],
            points[-1]["date"],
        )

        # Identity fragments are checked as JSON keys so the `authored_commits`
        # count is never mistaken for commit-author identity.
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
            self.assertNotIn(f'"{fragment}"', serialized)
        self.assertNotIn('"author"', serialized)


if __name__ == "__main__":
    unittest.main()
