from __future__ import annotations

import json
import sys
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "bin"))
import import_code_activity as activity_importer  # noqa: E402


CODE_ACTIVITY_PATH = REPO_ROOT / "_data" / "code_activity.json"
CODE_ACTIVITY_SOURCES_PATH = REPO_ROOT / "_data" / "code_activity_sources"
ACTIVITY_PATHS = (
    CODE_ACTIVITY_PATH,
    REPO_ROOT / "_pages" / "github-activity.md",
    REPO_ROOT / "assets" / "js" / "github-activity.js",
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
