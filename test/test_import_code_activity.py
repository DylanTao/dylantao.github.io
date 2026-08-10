from __future__ import annotations

import importlib.util
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "bin" / "import_code_activity.py"

_spec = importlib.util.spec_from_file_location("import_code_activity", MODULE_PATH)
importer = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(importer)


LIFETIME_START = date(2017, 8, 31)
NOW = datetime(2026, 8, 7, 16, 0, tzinfo=timezone.utc)
TODAY = date(2026, 8, 7)
COMPLETE_THROUGH = TODAY - timedelta(days=1)


def counts(commits=0, authored=0, additions=0, deletions=0):
    return {
        "commits": commits,
        "authored_commits": authored,
        "additions": additions,
        "deletions": deletions,
    }


def daily_points(starts_on, complete_through, overrides=None):
    overrides = overrides or {}
    points = []
    cursor = starts_on
    while cursor <= complete_through:
        key = cursor.isoformat()
        points.append({"date": key, **overrides.get(key, counts())})
        cursor += timedelta(days=1)
    return points


def weekly_rows(starts_on, complete_through):
    first = starts_on - timedelta(days=(starts_on.weekday() + 1) % 7)
    last = complete_through - timedelta(days=(complete_through.weekday() + 1) % 7)
    rows = []
    cursor = first
    while cursor <= last:
        rows.append({"week": cursor.isoformat(), **counts()})
        cursor += timedelta(days=7)
    return rows


def profile_snapshot(overrides=None):
    return {
        "schema": 5,
        "generatedAt": NOW.isoformat().replace("+00:00", "Z"),
        "source": {
            "id": "personal",
            "label": "Personal",
            "basis": "github_contribution_parity",
        },
        "weeks": weekly_rows(LIFETIME_START, COMPLETE_THROUGH),
        "daily": {
            "date_basis": "github_profile_author_date",
            "completion_timezone": "America/Los_Angeles",
            "starts_on": LIFETIME_START.isoformat(),
            "complete_through": COMPLETE_THROUGH.isoformat(),
            "coverage": "complete",
            "points": daily_points(LIFETIME_START, COMPLETE_THROUGH, overrides),
        },
    }


def contributed_snapshot(starts_on, complete_through, overrides=None, **fields):
    payload = {
        "schema": 1,
        "id": "intern",
        "label": "Intern work",
        "basis": "reported_daily_summary",
        "timezone": "UTC",
        "coverage": {
            "starts_on": starts_on.isoformat(),
            "complete_through": complete_through.isoformat(),
            "status": "complete",
        },
        "points": daily_points(starts_on, complete_through, overrides),
    }
    payload.update(fields)
    return payload


def legacy_public_snapshot(payload):
    legacy = json.loads(json.dumps(payload))
    legacy["schema"] = 4
    legacy["timezone"] = "UTC"
    del legacy["date_basis"]
    for descriptor in legacy["sources"]:
        del descriptor["date_basis"]
        del descriptor["completion_timezone"]
    return legacy


class ProfileContractTests(unittest.TestCase):
    def test_valid_profile_projects_to_the_personal_source(self) -> None:
        projected = importer.validate_profile_snapshot(profile_snapshot(), now=NOW)
        self.assertEqual(projected["id"], "personal")
        self.assertEqual(projected["label"], "Personal")
        self.assertEqual(projected["basis"], "github_contribution_parity")
        self.assertEqual(projected["date_basis"], "github_profile_author_date")
        self.assertEqual(
            projected["completion_timezone"], "America/Los_Angeles"
        )
        self.assertEqual(projected["starts_on"], LIFETIME_START.isoformat())
        self.assertEqual(
            projected["complete_through"], COMPLETE_THROUGH.isoformat()
        )
        self.assertEqual(
            len(projected["points"]),
            (COMPLETE_THROUGH - LIFETIME_START).days + 1,
        )

    def test_profile_snapshot_rejects_an_arbitrarily_stale_generation(self) -> None:
        stale = profile_snapshot()
        stale["generatedAt"] = (
            NOW - importer.PERSONAL_PROFILE_MAX_AGE - timedelta(seconds=1)
        ).isoformat().replace("+00:00", "Z")

        with self.assertRaisesRegex(importer.ActivityError, "generatedAt is stale"):
            importer.validate_profile_snapshot(stale, now=NOW)

    def test_truncated_history_is_rejected(self) -> None:
        # A rolling window used to shorten published history on every refresh.
        # A snapshot that no longer reaches the anchor must now fail closed.
        snapshot = profile_snapshot()
        later_start = LIFETIME_START + timedelta(days=365)
        snapshot["daily"]["starts_on"] = later_start.isoformat()
        snapshot["daily"]["points"] = daily_points(later_start, COMPLETE_THROUGH)
        with self.assertRaises(importer.ActivityError):
            importer.validate_profile_snapshot(snapshot, now=NOW)

    def test_profile_public_label_is_fixed(self) -> None:
        snapshot = profile_snapshot()
        snapshot["source"]["label"] = "Dylan personal repositories"
        with self.assertRaises(importer.ActivityError):
            importer.validate_profile_snapshot(snapshot, now=NOW)

    def test_authored_commits_cannot_exceed_counted_commits(self) -> None:
        key = COMPLETE_THROUGH.isoformat()
        snapshot = profile_snapshot({key: counts(commits=2, authored=3)})
        with self.assertRaises(importer.ActivityError):
            importer.validate_profile_snapshot(snapshot, now=NOW)

    def test_lines_without_an_authored_commit_are_rejected(self) -> None:
        # Merge and deploy commits count but carry no lines, so a day with lines
        # and no authored commit is malformed rather than merely unusual.
        key = COMPLETE_THROUGH.isoformat()
        snapshot = profile_snapshot(
            {key: counts(commits=4, authored=0, additions=12)}
        )
        with self.assertRaises(importer.ActivityError):
            importer.validate_profile_snapshot(snapshot, now=NOW)

    def test_incomplete_day_is_rejected(self) -> None:
        snapshot = profile_snapshot()
        snapshot["daily"]["complete_through"] = TODAY.isoformat()
        snapshot["daily"]["points"] = daily_points(LIFETIME_START, TODAY)
        with self.assertRaises(importer.ActivityError):
            importer.validate_profile_snapshot(snapshot, now=NOW)

    def test_profile_uses_local_completion_date_across_the_utc_boundary(self) -> None:
        generated = datetime(2026, 8, 9, 1, 0, tzinfo=timezone.utc)
        snapshot = profile_snapshot()
        snapshot["generatedAt"] = generated.isoformat().replace("+00:00", "Z")
        snapshot["daily"]["complete_through"] = "2026-08-07"
        snapshot["daily"]["points"] = daily_points(
            LIFETIME_START, date(2026, 8, 7)
        )
        validated = importer.validate_profile_snapshot(
            snapshot, now=generated + timedelta(minutes=1)
        )
        self.assertEqual(validated["complete_through"], "2026-08-07")

    def test_profile_calendar_contract_is_exact(self) -> None:
        invalid_fields = {
            "date_basis": "utc_calendar_date",
            "completion_timezone": "UTC",
        }
        for field, value in invalid_fields.items():
            snapshot = profile_snapshot()
            snapshot["daily"][field] = value
            with self.subTest(field=field):
                with self.assertRaises(importer.ActivityError):
                    importer.validate_profile_snapshot(snapshot, now=NOW)

    def test_impossible_calendar_date_is_rejected(self) -> None:
        snapshot = profile_snapshot()
        point = next(
            entry
            for entry in snapshot["daily"]["points"]
            if entry["date"] == "2025-03-01"
        )
        point["date"] = "2025-02-29"
        with self.assertRaises(importer.ActivityError):
            importer.validate_profile_snapshot(snapshot, now=NOW)


class ContributedContractTests(unittest.TestCase):
    def test_valid_contributed_source_keeps_its_own_window(self) -> None:
        starts_on = date(2026, 6, 15)
        projected = importer.validate_contributed_snapshot(
            contributed_snapshot(starts_on, COMPLETE_THROUGH), now=NOW
        )
        self.assertEqual(projected["id"], "intern")
        self.assertEqual(projected["label"], "Intern work")
        self.assertEqual(projected["date_basis"], "utc_calendar_date")
        self.assertEqual(projected["completion_timezone"], "UTC")
        self.assertEqual(projected["starts_on"], starts_on.isoformat())

    def test_contributed_source_cannot_reuse_the_personal_id(self) -> None:
        snapshot = contributed_snapshot(
            date(2026, 6, 15), COMPLETE_THROUGH, id="personal"
        )
        with self.assertRaises(importer.ActivityError):
            importer.validate_contributed_snapshot(snapshot, now=NOW)

    def test_contributed_source_id_must_be_a_slug(self) -> None:
        snapshot = contributed_snapshot(
            date(2026, 6, 15), COMPLETE_THROUGH, id="Intern Work"
        )
        with self.assertRaises(importer.ActivityError):
            importer.validate_contributed_snapshot(snapshot, now=NOW)

    def test_unapproved_contributed_source_id_is_rejected(self) -> None:
        snapshot = contributed_snapshot(
            date(2026, 6, 15), COMPLETE_THROUGH, id="client"
        )
        with self.assertRaises(importer.ActivityError):
            importer.validate_contributed_snapshot(snapshot, now=NOW)

    def test_contributed_source_public_label_is_fixed(self) -> None:
        snapshot = contributed_snapshot(
            date(2026, 6, 15), COMPLETE_THROUGH, label="Acme internship"
        )
        with self.assertRaises(importer.ActivityError):
            importer.validate_contributed_snapshot(snapshot, now=NOW)

    def test_contributed_source_basis_is_fixed(self) -> None:
        snapshot = contributed_snapshot(
            date(2026, 6, 15), COMPLETE_THROUGH, basis="private_repository_scan"
        )
        with self.assertRaises(importer.ActivityError):
            importer.validate_contributed_snapshot(snapshot, now=NOW)

    def test_extra_fields_are_rejected(self) -> None:
        # The contributed contract carries counts and dates only, so a stray
        # field such as a repository name cannot ride along into the public file.
        snapshot = contributed_snapshot(
            date(2026, 6, 15), COMPLETE_THROUGH, repository="acme/private"
        )
        with self.assertRaises(importer.ActivityError):
            importer.validate_contributed_snapshot(snapshot, now=NOW)


class MergeTests(unittest.TestCase):
    def test_single_source_publishes_one_keyed_entry_per_day(self) -> None:
        payload, changed = importer.build_public_snapshot(profile_snapshot(), now=NOW)
        self.assertTrue(changed)
        self.assertEqual(payload["schema"], 5)
        self.assertEqual(payload["date_basis"], "source_reported_calendar")
        self.assertEqual(payload["scope"], "code_activity")
        self.assertEqual([entry["id"] for entry in payload["sources"]], ["personal"])
        self.assertEqual(
            payload["sources"][0],
            {
                "id": "personal",
                "label": "Personal",
                "basis": "github_contribution_parity",
                "date_basis": "github_profile_author_date",
                "completion_timezone": "America/Los_Angeles",
                "starts_on": LIFETIME_START.isoformat(),
                "complete_through": COMPLETE_THROUGH.isoformat(),
            },
        )
        self.assertEqual(payload["coverage"]["starts_on"], LIFETIME_START.isoformat())
        self.assertEqual(set(payload["points"][0]), {"date", "personal"})

    def test_late_starting_source_is_absent_before_its_coverage(self) -> None:
        intern_start = date(2026, 6, 15)
        payload, _ = importer.build_public_snapshot(
            profile_snapshot(),
            contributed=[contributed_snapshot(intern_start, COMPLETE_THROUGH)],
            now=NOW,
        )
        self.assertEqual(
            [entry["id"] for entry in payload["sources"]], ["personal", "intern"]
        )
        by_date = {point["date"]: point for point in payload["points"]}
        before = by_date[(intern_start - timedelta(days=1)).isoformat()]
        self.assertEqual(set(before), {"date", "personal"})
        during = by_date[intern_start.isoformat()]
        self.assertEqual(set(during), {"date", "personal", "intern"})

    def test_contributed_source_cannot_precede_the_lifetime_anchor(self) -> None:
        before_anchor = LIFETIME_START - timedelta(days=1)
        with self.assertRaises(importer.ActivityError):
            importer.build_public_snapshot(
                profile_snapshot(),
                contributed=[contributed_snapshot(before_anchor, before_anchor)],
                now=NOW,
            )

    def test_coverage_cannot_move_backward(self) -> None:
        payload, _ = importer.build_public_snapshot(profile_snapshot(), now=NOW)
        ahead = json.loads(json.dumps(payload))
        later = COMPLETE_THROUGH + timedelta(days=1)
        ahead["updated_on"] = later.isoformat()
        ahead["coverage"]["complete_through"] = later.isoformat()
        ahead["sources"][0]["complete_through"] = later.isoformat()
        ahead["points"].append({"date": later.isoformat(), "personal": counts()})
        # The previous publication already reached a later day, so an earlier
        # snapshot must not be allowed to roll the record back.
        with self.assertRaises(importer.ActivityError):
            importer.build_public_snapshot(
                profile_snapshot(), previous=ahead, now=NOW + timedelta(days=2)
            )

    def test_coverage_cannot_lose_earlier_history(self) -> None:
        payload, _ = importer.build_public_snapshot(profile_snapshot(), now=NOW)
        earlier = json.loads(json.dumps(payload))
        earlier_start = LIFETIME_START - timedelta(days=1)
        earlier["coverage"]["starts_on"] = earlier_start.isoformat()
        earlier["sources"][0]["starts_on"] = earlier_start.isoformat()
        earlier["points"].insert(
            0, {"date": earlier_start.isoformat(), "personal": counts()}
        )
        with self.assertRaises(importer.ActivityError):
            importer.build_public_snapshot(
                profile_snapshot(), previous=earlier, now=NOW
            )

    def test_public_source_contract_cannot_be_relabeled(self) -> None:
        payload, _ = importer.build_public_snapshot(profile_snapshot(), now=NOW)
        payload["sources"][0]["label"] = "Private account"
        with self.assertRaises(importer.ActivityError):
            importer.validate_public_snapshot(payload, now=NOW)

    def test_public_snapshot_requires_the_personal_anchor(self) -> None:
        payload, _ = importer.build_public_snapshot(profile_snapshot(), now=NOW)
        payload["sources"][0]["starts_on"] = (
            LIFETIME_START + timedelta(days=1)
        ).isoformat()
        with self.assertRaises(importer.ActivityError):
            importer.validate_public_snapshot(payload, now=NOW)

    def test_public_source_calendar_contract_is_exact(self) -> None:
        invalid_fields = {
            "date_basis": "utc_calendar_date",
            "completion_timezone": "UTC",
        }
        for field, value in invalid_fields.items():
            payload, _ = importer.build_public_snapshot(profile_snapshot(), now=NOW)
            payload["sources"][0][field] = value
            with self.subTest(field=field):
                with self.assertRaises(importer.ActivityError):
                    importer.validate_public_snapshot(payload, now=NOW)

    def test_schema4_previous_migrates_once_but_is_not_currently_valid(self) -> None:
        payload, _ = importer.build_public_snapshot(profile_snapshot(), now=NOW)
        legacy = legacy_public_snapshot(payload)
        later = COMPLETE_THROUGH + timedelta(days=1)
        legacy["updated_on"] = later.isoformat()
        legacy["coverage"]["complete_through"] = later.isoformat()
        legacy["sources"][0]["complete_through"] = later.isoformat()
        legacy["points"].append({"date": later.isoformat(), "personal": counts()})

        with self.assertRaises(importer.ActivityError):
            importer.validate_public_snapshot(legacy, now=NOW + timedelta(days=2))

        migrated, changed = importer.build_public_snapshot(
            profile_snapshot(), previous=legacy, now=NOW + timedelta(days=2)
        )
        self.assertTrue(changed)
        self.assertEqual(migrated["schema"], 5)
        self.assertEqual(migrated["coverage"]["complete_through"], COMPLETE_THROUGH.isoformat())

    def test_schema4_migration_allows_only_one_day_of_calendar_relabeling(self) -> None:
        payload, _ = importer.build_public_snapshot(profile_snapshot(), now=NOW)
        legacy = legacy_public_snapshot(payload)
        for offset in (1, 2):
            later = COMPLETE_THROUGH + timedelta(days=offset)
            legacy["points"].append({"date": later.isoformat(), "personal": counts()})
        legacy["updated_on"] = later.isoformat()
        legacy["coverage"]["complete_through"] = later.isoformat()
        legacy["sources"][0]["complete_through"] = later.isoformat()

        with self.assertRaisesRegex(importer.ActivityError, "cannot move backward"):
            importer.build_public_snapshot(
                profile_snapshot(), previous=legacy, now=NOW + timedelta(days=3)
            )

    def test_malformed_schema4_previous_is_rejected(self) -> None:
        payload, _ = importer.build_public_snapshot(profile_snapshot(), now=NOW)
        legacy = legacy_public_snapshot(payload)
        legacy["timezone"] = "America/Los_Angeles"
        with self.assertRaises(importer.ActivityError):
            importer.build_public_snapshot(
                profile_snapshot(), previous=legacy, now=NOW
            )

    def test_schema4_migration_still_guards_contributed_utc_coverage(self) -> None:
        intern_start = date(2026, 6, 15)
        payload, _ = importer.build_public_snapshot(
            profile_snapshot(),
            contributed=[contributed_snapshot(intern_start, COMPLETE_THROUGH)],
            now=NOW,
        )
        legacy = legacy_public_snapshot(payload)
        narrowed = contributed_snapshot(
            intern_start + timedelta(days=1), COMPLETE_THROUGH
        )
        with self.assertRaises(importer.ActivityError):
            importer.build_public_snapshot(
                profile_snapshot(),
                contributed=[narrowed],
                previous=legacy,
                now=NOW,
            )

    def test_published_contributed_source_cannot_disappear(self) -> None:
        intern_start = date(2026, 6, 15)
        previous, _ = importer.build_public_snapshot(
            profile_snapshot(),
            contributed=[contributed_snapshot(intern_start, COMPLETE_THROUGH)],
            now=NOW,
        )
        with self.assertRaises(importer.ActivityError):
            importer.build_public_snapshot(
                profile_snapshot(), previous=previous, now=NOW
            )

    def test_published_contributed_window_cannot_narrow(self) -> None:
        intern_start = date(2026, 6, 15)
        previous, _ = importer.build_public_snapshot(
            profile_snapshot(),
            contributed=[contributed_snapshot(intern_start, COMPLETE_THROUGH)],
            now=NOW,
        )
        narrowed_sources = (
            contributed_snapshot(intern_start + timedelta(days=1), COMPLETE_THROUGH),
            contributed_snapshot(intern_start, COMPLETE_THROUGH - timedelta(days=1)),
        )
        for narrowed in narrowed_sources:
            with self.subTest(coverage=narrowed["coverage"]):
                with self.assertRaises(importer.ActivityError):
                    importer.build_public_snapshot(
                        profile_snapshot(),
                        contributed=[narrowed],
                        previous=previous,
                        now=NOW,
                    )

    def test_republishing_identical_content_reports_no_change(self) -> None:
        payload, _ = importer.build_public_snapshot(profile_snapshot(), now=NOW)
        repeat, changed = importer.build_public_snapshot(
            profile_snapshot(), previous=payload, now=NOW
        )
        self.assertFalse(changed)
        self.assertEqual(repeat, payload)


class PublishTests(unittest.TestCase):
    def test_check_mode_reports_that_a_change_would_update_without_writing(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            profile = root / "profile"
            site = root / "site"
            (profile / "docs").mkdir(parents=True)
            (profile / "docs" / "github-activity.json").write_text(
                "{}", encoding="utf-8"
            )
            output = io.StringIO()
            arguments = SimpleNamespace(
                personal_repo=profile,
                repo_root=site,
                check=True,
            )
            with (
                patch.object(importer, "parse_args", return_value=arguments),
                patch.object(
                    importer,
                    "build_public_snapshot",
                    return_value=({"schema": 5}, True),
                ),
                patch.object(importer, "publish_atomically") as publish,
                redirect_stdout(output),
            ):
                self.assertEqual(importer.main(), 0)

            publish.assert_not_called()
            self.assertEqual(output.getvalue().strip(), "code activity valid (would update)")

    def test_publish_is_atomic_and_idempotent(self) -> None:
        payload, _ = importer.build_public_snapshot(profile_snapshot(), now=NOW)
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "code_activity.json"
            self.assertTrue(importer.publish_atomically(target, payload))
            self.assertFalse(importer.publish_atomically(target, payload))
            self.assertEqual(json.loads(target.read_text(encoding="utf-8")), payload)
            self.assertEqual(list(target.parent.glob(".*tmp")), [])

    def test_contributed_sources_are_read_in_stable_order(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "b.json").write_text('{"id": "b"}', encoding="utf-8")
            (root / "a.json").write_text('{"id": "a"}', encoding="utf-8")
            self.assertEqual(
                [entry["id"] for entry in importer.load_contributed_sources(root)],
                ["a", "b"],
            )

    def test_missing_contributed_directory_is_not_an_error(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(
                importer.load_contributed_sources(Path(directory) / "absent"), []
            )


if __name__ == "__main__":
    unittest.main()
