from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "bin" / "import_code_activity.py"

_spec = importlib.util.spec_from_file_location("import_code_activity", MODULE_PATH)
importer = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(importer)


LIFETIME_START = date(2017, 8, 31)
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
        "schema": 4,
        "generatedAt": f"{TODAY.isoformat()}T05:00:00Z",
        "source": {
            "id": "personal",
            "label": "Personal",
            "basis": "github_contribution_parity",
        },
        "weeks": weekly_rows(LIFETIME_START, COMPLETE_THROUGH),
        "daily": {
            "timezone": "UTC",
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


class ProfileContractTests(unittest.TestCase):
    def test_valid_profile_projects_to_the_personal_source(self) -> None:
        projected = importer.validate_profile_snapshot(
            profile_snapshot(), today=TODAY
        )
        self.assertEqual(projected["id"], "personal")
        self.assertEqual(projected["label"], "Personal")
        self.assertEqual(projected["basis"], "github_contribution_parity")
        self.assertEqual(projected["starts_on"], LIFETIME_START.isoformat())
        self.assertEqual(
            projected["complete_through"], COMPLETE_THROUGH.isoformat()
        )
        self.assertEqual(
            len(projected["points"]),
            (COMPLETE_THROUGH - LIFETIME_START).days + 1,
        )

    def test_truncated_history_is_rejected(self) -> None:
        # A rolling window used to shorten published history on every refresh.
        # A snapshot that no longer reaches the anchor must now fail closed.
        snapshot = profile_snapshot()
        later_start = LIFETIME_START + timedelta(days=365)
        snapshot["daily"]["starts_on"] = later_start.isoformat()
        snapshot["daily"]["points"] = daily_points(later_start, COMPLETE_THROUGH)
        with self.assertRaises(importer.ActivityError):
            importer.validate_profile_snapshot(snapshot, today=TODAY)

    def test_authored_commits_cannot_exceed_counted_commits(self) -> None:
        key = COMPLETE_THROUGH.isoformat()
        snapshot = profile_snapshot({key: counts(commits=2, authored=3)})
        with self.assertRaises(importer.ActivityError):
            importer.validate_profile_snapshot(snapshot, today=TODAY)

    def test_lines_without_an_authored_commit_are_rejected(self) -> None:
        # Merge and deploy commits count but carry no lines, so a day with lines
        # and no authored commit is malformed rather than merely unusual.
        key = COMPLETE_THROUGH.isoformat()
        snapshot = profile_snapshot(
            {key: counts(commits=4, authored=0, additions=12)}
        )
        with self.assertRaises(importer.ActivityError):
            importer.validate_profile_snapshot(snapshot, today=TODAY)

    def test_incomplete_day_is_rejected(self) -> None:
        snapshot = profile_snapshot()
        snapshot["generatedAt"] = f"{TODAY.isoformat()}T05:00:00Z"
        snapshot["daily"]["complete_through"] = TODAY.isoformat()
        snapshot["daily"]["points"] = daily_points(LIFETIME_START, TODAY)
        with self.assertRaises(importer.ActivityError):
            importer.validate_profile_snapshot(snapshot, today=TODAY)


class ContributedContractTests(unittest.TestCase):
    def test_valid_contributed_source_keeps_its_own_window(self) -> None:
        starts_on = date(2026, 6, 15)
        projected = importer.validate_contributed_snapshot(
            contributed_snapshot(starts_on, COMPLETE_THROUGH), today=TODAY
        )
        self.assertEqual(projected["id"], "intern")
        self.assertEqual(projected["label"], "Intern work")
        self.assertEqual(projected["starts_on"], starts_on.isoformat())

    def test_contributed_source_cannot_reuse_the_personal_id(self) -> None:
        snapshot = contributed_snapshot(
            date(2026, 6, 15), COMPLETE_THROUGH, id="personal"
        )
        with self.assertRaises(importer.ActivityError):
            importer.validate_contributed_snapshot(snapshot, today=TODAY)

    def test_contributed_source_id_must_be_a_slug(self) -> None:
        snapshot = contributed_snapshot(
            date(2026, 6, 15), COMPLETE_THROUGH, id="Intern Work"
        )
        with self.assertRaises(importer.ActivityError):
            importer.validate_contributed_snapshot(snapshot, today=TODAY)

    def test_extra_fields_are_rejected(self) -> None:
        # The contributed contract carries counts and dates only, so a stray
        # field such as a repository name cannot ride along into the public file.
        snapshot = contributed_snapshot(
            date(2026, 6, 15), COMPLETE_THROUGH, repository="acme/private"
        )
        with self.assertRaises(importer.ActivityError):
            importer.validate_contributed_snapshot(snapshot, today=TODAY)


class MergeTests(unittest.TestCase):
    def test_single_source_publishes_one_keyed_entry_per_day(self) -> None:
        payload, changed = importer.build_public_snapshot(
            profile_snapshot(), today=TODAY
        )
        self.assertTrue(changed)
        self.assertEqual(payload["schema"], 4)
        self.assertEqual(payload["scope"], "code_activity")
        self.assertEqual([entry["id"] for entry in payload["sources"]], ["personal"])
        self.assertEqual(payload["coverage"]["starts_on"], LIFETIME_START.isoformat())
        self.assertEqual(set(payload["points"][0]), {"date", "personal"})

    def test_late_starting_source_is_absent_before_its_coverage(self) -> None:
        intern_start = date(2026, 6, 15)
        payload, _ = importer.build_public_snapshot(
            profile_snapshot(),
            contributed=[contributed_snapshot(intern_start, COMPLETE_THROUGH)],
            today=TODAY,
        )
        self.assertEqual(
            [entry["id"] for entry in payload["sources"]], ["personal", "intern"]
        )
        by_date = {point["date"]: point for point in payload["points"]}
        before = by_date[(intern_start - timedelta(days=1)).isoformat()]
        self.assertEqual(set(before), {"date", "personal"})
        during = by_date[intern_start.isoformat()]
        self.assertEqual(set(during), {"date", "personal", "intern"})

    def test_coverage_cannot_move_backward(self) -> None:
        payload, _ = importer.build_public_snapshot(profile_snapshot(), today=TODAY)
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
                profile_snapshot(), previous=ahead, today=later + timedelta(days=1)
            )

    def test_coverage_cannot_lose_earlier_history(self) -> None:
        payload, _ = importer.build_public_snapshot(profile_snapshot(), today=TODAY)
        earlier = json.loads(json.dumps(payload))
        earlier_start = LIFETIME_START - timedelta(days=1)
        earlier["coverage"]["starts_on"] = earlier_start.isoformat()
        earlier["sources"][0]["starts_on"] = earlier_start.isoformat()
        earlier["points"].insert(
            0, {"date": earlier_start.isoformat(), "personal": counts()}
        )
        with self.assertRaises(importer.ActivityError):
            importer.build_public_snapshot(
                profile_snapshot(), previous=earlier, today=TODAY
            )

    def test_republishing_identical_content_reports_no_change(self) -> None:
        payload, _ = importer.build_public_snapshot(profile_snapshot(), today=TODAY)
        repeat, changed = importer.build_public_snapshot(
            profile_snapshot(), previous=payload, today=TODAY
        )
        self.assertFalse(changed)
        self.assertEqual(repeat, payload)


class PublishTests(unittest.TestCase):
    def test_publish_is_atomic_and_idempotent(self) -> None:
        payload, _ = importer.build_public_snapshot(profile_snapshot(), today=TODAY)
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
