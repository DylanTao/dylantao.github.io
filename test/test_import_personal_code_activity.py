from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "bin" / "import_personal_code_activity.py"
SPEC = importlib.util.spec_from_file_location(
    "import_personal_code_activity",
    MODULE_PATH,
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def profile_snapshot(
    *,
    generated_at: datetime = datetime(
        2026,
        7,
        28,
        8,
        tzinfo=timezone.utc,
    ),
    starts_on: date = date(2021, 7, 28),
) -> dict:
    complete_through = generated_at.date() - timedelta(days=1)
    points = []
    cursor = starts_on
    while cursor <= complete_through:
        offset = (cursor - starts_on).days
        active = offset % 11 == 0
        points.append(
            {
                "date": cursor.isoformat(),
                "commits": 1 if active else 0,
                "additions": offset + 10 if active else 0,
                "deletions": offset + 2 if active else 0,
            }
        )
        cursor += timedelta(days=1)

    weeks = []
    week = date(2021, 8, 1)
    while week <= complete_through:
        weeks.append(
            {
                "week": week.isoformat(),
                "commits": 1,
                "additions": 10,
                "deletions": 2,
            }
        )
        week += timedelta(days=7)
    return {
        "schema": 3,
        "generatedAt": generated_at.isoformat().replace("+00:00", "Z"),
        "weeks": weeks,
        "daily": {
            "timezone": "UTC",
            "starts_on": starts_on.isoformat(),
            "complete_through": complete_through.isoformat(),
            "coverage": "complete",
            "points": points,
        },
    }


class PersonalCodeActivityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.today = date(2026, 7, 28)

    def test_accepts_only_exact_schema3_complete_utc_history(self) -> None:
        source = profile_snapshot()
        checked = MODULE.validate_profile_snapshot(
            source,
            today=self.today,
        )
        self.assertEqual(checked["schema"], 3)
        self.assertEqual(checked["daily"]["timezone"], "UTC")
        self.assertEqual(checked["daily"]["coverage"], "complete")
        self.assertEqual(
            checked["daily"]["starts_on"],
            "2021-07-28",
        )
        self.assertEqual(
            checked["daily"]["complete_through"],
            "2026-07-27",
        )
        self.assertEqual(
            len(checked["daily"]["points"]),
            (self.today - date(2021, 7, 28)).days,
        )

        for mutation in (
            lambda value: value.update(schema=2),
            lambda value: value.update(extra="not allowed"),
            lambda value: value["daily"].update(timezone="America/Los_Angeles"),
            lambda value: value["daily"].update(coverage="partial"),
            lambda value: value["daily"].update(starts_on="2021-07-29"),
            lambda value: value["daily"].update(
                complete_through="2026-07-26"
            ),
        ):
            candidate = json.loads(json.dumps(source))
            mutation(candidate)
            with self.subTest(candidate=candidate):
                with self.assertRaises(MODULE.ActivityError):
                    MODULE.validate_profile_snapshot(
                        candidate,
                        today=self.today,
                    )

    def test_rejects_gaps_today_rows_unknown_fields_and_unsafe_counts(
        self,
    ) -> None:
        source = profile_snapshot()
        candidates = []

        gap = json.loads(json.dumps(source))
        del gap["daily"]["points"][20]
        candidates.append(gap)

        today_row = json.loads(json.dumps(source))
        today_row["daily"]["points"].append(
            {
                "date": "2026-07-28",
                "commits": 0,
                "additions": 0,
                "deletions": 0,
            }
        )
        today_row["daily"]["complete_through"] = "2026-07-28"
        candidates.append(today_row)

        extra = json.loads(json.dumps(source))
        extra["daily"]["points"][0]["repository"] = "private"
        candidates.append(extra)

        unsafe = json.loads(json.dumps(source))
        unsafe["daily"]["points"][0]["commits"] = (
            MODULE.JAVASCRIPT_SAFE_INTEGER + 1
        )
        candidates.append(unsafe)

        for candidate in candidates:
            with self.subTest(candidate=candidate):
                with self.assertRaises(MODULE.ActivityError):
                    MODULE.validate_profile_snapshot(
                        candidate,
                        today=self.today,
                    )

    def test_builds_personal_schema3_projection_without_lifetime_totals(
        self,
    ) -> None:
        payload, changed = MODULE.build_public_snapshot(
            profile_snapshot(),
            today=self.today,
        )
        self.assertTrue(changed)
        self.assertEqual(
            set(payload),
            {
                "schema",
                "updated_on",
                "timezone",
                "scope",
                "coverage",
                "points",
            },
        )
        self.assertEqual(payload["schema"], 3)
        self.assertEqual(payload["scope"], "personal_code_activity")
        self.assertEqual(payload["timezone"], "UTC")
        self.assertEqual(
            payload["coverage"],
            {
                "starts_on": "2021-07-28",
                "complete_through": "2026-07-27",
                "status": "complete",
            },
        )
        self.assertNotIn("lifetime", payload)
        self.assertNotIn("aggregation", payload)

    def test_five_year_window_rolls_with_the_utc_boundary(self) -> None:
        generated_at = datetime(
            2026,
            7,
            29,
            8,
            tzinfo=timezone.utc,
        )
        source = profile_snapshot(
            generated_at=generated_at,
            starts_on=date(2021, 7, 29),
        )
        checked = MODULE.validate_profile_snapshot(
            source,
            today=generated_at.date(),
        )
        self.assertEqual(
            checked["daily"]["starts_on"],
            "2021-07-29",
        )
        self.assertEqual(
            checked["daily"]["complete_through"],
            "2026-07-28",
        )

    def test_invalid_refresh_preserves_last_valid_personal_snapshot(
        self,
    ) -> None:
        payload, _ = MODULE.build_public_snapshot(
            profile_snapshot(),
            today=self.today,
        )
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "personal.json"
            MODULE.publish_atomically(output, payload)
            before = output.read_bytes()

            invalid = profile_snapshot()
            del invalid["daily"]["points"][50]
            with self.assertRaises(MODULE.ActivityError):
                MODULE.build_public_snapshot(
                    invalid,
                    previous=payload,
                    today=self.today,
                )
            self.assertEqual(output.read_bytes(), before)

    def test_rejects_nonpersonal_previous_shapes_and_regression(
        self,
    ) -> None:
        source = profile_snapshot()
        with self.assertRaises(MODULE.ActivityError):
            MODULE.build_public_snapshot(
                source,
                previous={
                    "schema": 1,
                    "timezone": "America/Los_Angeles",
                    "scope": "combined_code_activity",
                    "aggregation": "cumulative_daily_snapshots",
                    "updated_on": "2026-07-26",
                    "points": [],
                },
                today=self.today,
            )

        later = profile_snapshot(
            generated_at=datetime(
                2026,
                7,
                29,
                8,
                tzinfo=timezone.utc,
            ),
            starts_on=date(2021, 7, 29),
        )
        previous, _ = MODULE.build_public_snapshot(
            later,
            today=date(2026, 7, 29),
        )
        with self.assertRaises(MODULE.ActivityError):
            MODULE.build_public_snapshot(
                source,
                previous=previous,
                today=date(2026, 7, 29),
            )

    def test_atomic_writer_skips_identical_output(self) -> None:
        payload, _ = MODULE.build_public_snapshot(
            profile_snapshot(),
            today=self.today,
        )
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "personal.json"
            self.assertTrue(MODULE.publish_atomically(output, payload))
            before = output.stat().st_mtime_ns
            self.assertFalse(MODULE.publish_atomically(output, payload))
            self.assertEqual(output.stat().st_mtime_ns, before)

    def test_cli_publishes_only_the_personal_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            profile = root / "profile"
            site = root / "site"
            source_path = profile / "docs" / "github-activity.json"
            source_path.parent.mkdir(parents=True)
            source_path.write_text(
                json.dumps(profile_snapshot()),
                encoding="utf-8",
            )

            result = subprocess.run(
                [
                    sys.executable,
                    str(MODULE_PATH),
                    "--personal-repo",
                    str(profile),
                    "--repo-root",
                    str(site),
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            output = site / "_data" / "personal_code_activity.json"
            self.assertTrue(output.exists())
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(payload["scope"], "personal_code_activity")
            self.assertEqual(
                list((site / "_data").iterdir()),
                [output],
            )

    def test_workflow_is_manual_personal_only_and_does_not_dispatch(
        self,
    ) -> None:
        workflow = (
            REPO_ROOT / ".github" / "workflows" / "update-code-activity.yml"
        ).read_text(encoding="utf-8")
        self.assertIn("import_personal_code_activity.py", workflow)
        self.assertIn("--personal-repo profile", workflow)
        self.assertIn("_data/personal_code_activity.json", workflow)
        self.assertIn("workflow_dispatch:", workflow)
        self.assertNotIn("cron:", workflow)
        self.assertNotIn("gh workflow run", workflow)
        self.assertNotIn("actions: write", workflow)


if __name__ == "__main__":
    unittest.main()
