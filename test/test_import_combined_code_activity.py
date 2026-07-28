from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "bin" / "import_combined_code_activity.py"
SPEC = importlib.util.spec_from_file_location(
    "import_combined_code_activity",
    MODULE_PATH,
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def profile_snapshot(
    generated_at: str,
    *,
    current_commits: int,
) -> dict[str, object]:
    return {
        "schema": 2,
        "generatedAt": generated_at,
        "weeks": [
            {
                "week": "2026-07-12",
                "commits": 2,
                "additions": 20,
                "deletions": 8,
            },
            {
                "week": "2026-07-19",
                "commits": current_commits,
                "additions": current_commits * 10,
                "deletions": current_commits * 4,
            },
        ],
    }


def bridge_snapshot(
    observed: str = "2026-07-24",
    *,
    commits: int = 7,
    additions: int = 70,
    deletions: int = 28,
) -> dict[str, object]:
    return {
        "schema": 1,
        "date": observed,
        "commits": commits,
        "additions": additions,
        "deletions": deletions,
    }


def dense_points(
    start: date,
    values: list[tuple[int, int, int]],
) -> list[dict[str, object]]:
    return [
        {
            "date": (start + MODULE.timedelta(days=index)).isoformat(),
            "commits": commits,
            "additions": additions,
            "deletions": deletions,
        }
        for index, (commits, additions, deletions) in enumerate(values)
    ]


def point_on(snapshot: dict[str, object], observed: str) -> dict[str, object]:
    return next(
        point
        for point in snapshot["daily"]["points"]
        if point["date"] == observed
    )


def profile_daily_snapshot() -> dict[str, object]:
    daily_values = {
        date(2026, 7, 20): (1, 10, 4),
        date(2026, 7, 21): (0, 0, 0),
        date(2026, 7, 22): (2, 20, 8),
        date(2026, 7, 23): (1, 10, 4),
        date(2026, 7, 24): (3, 30, 12),
        date(2026, 7, 25): (0, 0, 0),
        date(2026, 7, 26): (0, 0, 0),
        date(2026, 7, 27): (5, 50, 20),
    }
    cursor = MODULE.PERSONAL_DAILY_HISTORY_START
    values: list[tuple[int, int, int]] = []
    while cursor <= date(2026, 7, 27):
        values.append(daily_values.get(cursor, (0, 0, 0)))
        cursor += MODULE.timedelta(days=1)
    return {
        "schema": 3,
        "generatedAt": "2026-07-28T07:02:04+00:00",
        "weeks": profile_snapshot(
            "2026-07-28T07:02:04+00:00",
            current_commits=7,
        )["weeks"],
        "daily": {
            "timezone": "UTC",
            "starts_on": MODULE.PERSONAL_DAILY_HISTORY_START.isoformat(),
            "complete_through": "2026-07-27",
            "coverage": "complete",
            "points": dense_points(
                MODULE.PERSONAL_DAILY_HISTORY_START,
                values,
            ),
        },
    }


def bridge_daily_snapshot() -> dict[str, object]:
    points = dense_points(
        date(2026, 7, 22),
        [
            (1, 100, 40),
            (2, 200, 80),
            (4, 400, 160),
            (0, 0, 0),
            (0, 0, 0),
            (2, 200, 80),
        ],
    )
    return {
        "schema": 2,
        "through": "2026-07-27",
        "totals": {
            metric: sum(int(point[metric]) for point in points)
            for metric in MODULE.METRICS
        },
        "daily": points,
    }


def legacy_public_baseline() -> dict[str, object]:
    return {
        "schema": 1,
        "timezone": "America/Los_Angeles",
        "scope": "combined_code_activity",
        "aggregation": "cumulative_daily_snapshots",
        "updated_on": "2026-07-26",
        "points": [
            {
                "date": "2026-07-26",
                "commits": 100,
                "additions": 1000,
                "deletions": 400,
            }
        ],
    }


def initialize_repo(path: Path) -> None:
    subprocess.run(["git", "init", "-q", path], check=True)
    subprocess.run(
        ["git", "-C", path, "config", "user.name", "Fixture Bot"],
        check=True,
    )
    subprocess.run(
        [
            "git",
            "-C",
            path,
            "config",
            "user.email",
            "fixture@example.invalid",
        ],
        check=True,
    )


def commit_json(repo: Path, relative: str, payload: dict[str, object]) -> None:
    target = repo / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload), encoding="utf-8")
    subprocess.run(["git", "-C", repo, "add", relative], check=True)
    subprocess.run(
        ["git", "-C", repo, "commit", "-q", "-m", "fixture"],
        check=True,
    )


class ImportCombinedCodeActivityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.today = date(2026, 7, 30)

    def test_bridge_contract_is_exact_and_does_not_echo_unknown_keys(
        self,
    ) -> None:
        valid = MODULE.validate_bridge(
            bridge_snapshot(),
            today=self.today,
        )
        self.assertEqual(
            set(valid),
            {"schema", "date", "commits", "additions", "deletions"},
        )
        for mutation in (
            {**bridge_snapshot(), "repository": "private"},
            {**bridge_snapshot(), "commits": -1},
            {**bridge_snapshot(), "commits": True},
            {**bridge_snapshot("2026-07-31")},
        ):
            with self.subTest(mutation=mutation):
                with self.assertRaises(MODULE.ActivityError) as raised:
                    MODULE.validate_bridge(mutation, today=self.today)
                self.assertNotIn("repository", str(raised.exception))
                self.assertNotIn("private", str(raised.exception))

    def test_bridge_v2_is_dense_utc_completed_and_reconciled(self) -> None:
        valid = MODULE.validate_bridge_v2(
            bridge_daily_snapshot(),
            today=self.today,
        )
        self.assertEqual(valid["through"], "2026-07-27")
        self.assertEqual(len(valid["daily"]), 6)
        self.assertEqual(
            valid["totals"],
            {"commits": 9, "additions": 900, "deletions": 360},
        )

        malformed = bridge_daily_snapshot()
        malformed["totals"]["commits"] = 8
        with self.assertRaises(MODULE.ActivityError):
            MODULE.validate_bridge_v2(malformed, today=self.today)

        gapped = bridge_daily_snapshot()
        gapped["daily"].pop(1)
        gapped["totals"] = {
            metric: sum(int(point[metric]) for point in gapped["daily"])
            for metric in MODULE.METRICS
        }
        with self.assertRaises(MODULE.ActivityError):
            MODULE.validate_bridge_v2(gapped, today=self.today)

    def test_profile_v3_daily_source_fails_closed_on_gaps(self) -> None:
        valid = MODULE.validate_profile_daily_source(
            profile_daily_snapshot(),
            today=self.today,
        )
        self.assertEqual(valid["daily"]["timezone"], "UTC")
        self.assertEqual(
            len(valid["daily"]["points"]),
            (
                date(2026, 7, 27)
                - MODULE.PERSONAL_DAILY_HISTORY_START
            ).days
            + 1,
        )

        gapped = profile_daily_snapshot()
        gapped["daily"]["points"].pop(1)
        with self.assertRaises(MODULE.ActivityError):
            MODULE.validate_profile_daily_source(
                gapped,
                today=self.today,
            )
        shifted = profile_daily_snapshot()
        shifted["daily"]["starts_on"] = "2021-07-29"
        shifted["daily"]["points"].pop(0)
        with self.assertRaisesRegex(MODULE.ActivityError, "five-year start"):
            MODULE.validate_profile_daily_source(
                shifted,
                today=self.today,
            )
        stale = profile_daily_snapshot()
        stale["daily"]["complete_through"] = "2026-07-26"
        stale["daily"]["points"].pop()
        with self.assertRaisesRegex(MODULE.ActivityError, "latest completed"):
            MODULE.validate_profile_daily_source(
                stale,
                today=self.today,
            )

    def test_v2_merges_only_verified_overlap_and_anchors_existing_lifetime(
        self,
    ) -> None:
        payload, changed = MODULE.build_public_v2(
            profile_daily_snapshot(),
            bridge_daily_snapshot(),
            previous=legacy_public_baseline(),
            today=self.today,
        )
        self.assertTrue(changed)
        self.assertEqual(
            set(payload),
            {"schema", "updated_on", "timezone", "lifetime", "daily"},
        )
        self.assertEqual(payload["timezone"], "UTC")
        self.assertEqual(payload["daily"]["starts_on"], "2026-07-22")
        self.assertEqual(len(payload["daily"]["points"]), 6)
        self.assertEqual(
            payload["daily"]["points"][-1],
            {
                "date": "2026-07-27",
                "commits": 7,
                "additions": 250,
                "deletions": 100,
            },
        )
        self.assertEqual(
            payload["lifetime"],
            {
                "through": "2026-07-27",
                "commits": 107,
                "additions": 1250,
                "deletions": 500,
            },
        )

    def test_mixed_source_migration_preserves_the_valid_legacy_snapshot(
        self,
    ) -> None:
        previous = legacy_public_baseline()
        held, changed = MODULE.preserve_last_good_during_source_migration(
            profile_snapshot(
                "2026-07-28T07:02:04+00:00",
                current_commits=7,
            ),
            bridge_daily_snapshot(),
            previous=previous,
            today=self.today,
        )
        self.assertFalse(changed)
        self.assertEqual(held, previous)

        reverse_held, changed = (
            MODULE.preserve_last_good_during_source_migration(
                profile_daily_snapshot(),
                bridge_snapshot("2026-07-27"),
                previous=previous,
                today=self.today,
            )
        )
        self.assertFalse(changed)
        self.assertEqual(reverse_held, previous)

        exact_previous, _ = MODULE.build_public_v2(
            profile_daily_snapshot(),
            bridge_daily_snapshot(),
            previous=previous,
            today=self.today,
        )
        for personal_source, bridge_source in (
            (
                profile_snapshot(
                    "2026-07-28T07:02:04+00:00",
                    current_commits=7,
                ),
                bridge_daily_snapshot(),
            ),
            (
                profile_daily_snapshot(),
                bridge_snapshot("2026-07-27"),
            ),
        ):
            with self.subTest(
                personal_schema=personal_source["schema"],
                bridge_schema=bridge_source["schema"],
            ):
                held, changed = (
                    MODULE.preserve_last_good_during_source_migration(
                        personal_source,
                        bridge_source,
                        previous=exact_previous,
                        today=self.today,
                    )
                )
                self.assertFalse(changed)
                self.assertEqual(held, exact_previous)

        malformed_bridge = bridge_daily_snapshot()
        malformed_bridge["totals"]["commits"] += 1
        with self.assertRaisesRegex(MODULE.ActivityError, "do not reconcile"):
            MODULE.preserve_last_good_during_source_migration(
                profile_snapshot(
                    "2026-07-28T07:02:04+00:00",
                    current_commits=7,
                ),
                malformed_bridge,
                previous=previous,
                today=self.today,
            )

    def test_v2_rejects_complete_through_regression(self) -> None:
        previous, _ = MODULE.build_public_v2(
            profile_daily_snapshot(),
            bridge_daily_snapshot(),
            previous=legacy_public_baseline(),
            today=self.today,
        )

        stale_profile = json.loads(json.dumps(profile_daily_snapshot()))
        stale_profile["generatedAt"] = "2026-07-27T07:02:04+00:00"
        stale_profile["daily"]["complete_through"] = "2026-07-26"
        stale_profile["daily"]["points"].pop()

        stale_bridge = json.loads(json.dumps(bridge_daily_snapshot()))
        stale_bridge["through"] = "2026-07-26"
        stale_bridge["daily"].pop()
        stale_bridge["totals"] = {
            metric: sum(
                int(point[metric])
                for point in stale_bridge["daily"]
            )
            for metric in MODULE.METRICS
        }

        with self.assertRaisesRegex(
            MODULE.ActivityError,
            "cannot move backward",
        ):
            MODULE.build_public_v2(
                stale_profile,
                stale_bridge,
                previous=previous,
                today=self.today,
            )

    def test_v2_history_corrects_days_without_moving_the_lifetime_anchor(
        self,
    ) -> None:
        payload, _ = MODULE.build_public_v2(
            profile_daily_snapshot(),
            bridge_daily_snapshot(),
            previous=legacy_public_baseline(),
            today=self.today,
        )
        same, changed = MODULE.build_public_v2(
            profile_daily_snapshot(),
            bridge_daily_snapshot(),
            previous=payload,
            today=self.today,
        )
        self.assertFalse(changed)
        self.assertEqual(same, payload)

        revised_profile = profile_daily_snapshot()
        point_on(revised_profile, "2026-07-22")["commits"] = 9
        corrected, changed = MODULE.build_public_v2(
            revised_profile,
            bridge_daily_snapshot(),
            previous=payload,
            today=self.today,
        )
        self.assertTrue(changed)
        self.assertEqual(corrected["daily"]["points"][0]["commits"], 10)
        self.assertEqual(corrected["lifetime"], payload["lifetime"])

        regressed_profile = profile_daily_snapshot()
        point_on(regressed_profile, "2026-07-22")["commits"] = 0
        corrected_down, changed = MODULE.build_public_v2(
            regressed_profile,
            bridge_daily_snapshot(),
            previous=payload,
            today=self.today,
        )
        self.assertTrue(changed)
        self.assertEqual(corrected_down["daily"]["points"][0]["commits"], 1)
        self.assertEqual(corrected_down["lifetime"], payload["lifetime"])

        post_anchor_revision = profile_daily_snapshot()
        point_on(post_anchor_revision, "2026-07-27")["commits"] = 6
        corrected_post_anchor, changed = MODULE.build_public_v2(
            post_anchor_revision,
            bridge_daily_snapshot(),
            previous=payload,
            today=self.today,
        )
        self.assertTrue(changed)
        self.assertEqual(
            corrected_post_anchor["daily"]["points"][-1]["commits"],
            8,
        )
        self.assertEqual(
            corrected_post_anchor["lifetime"],
            {
                "through": "2026-07-27",
                "commits": 108,
                "additions": 1250,
                "deletions": 500,
            },
        )

        extended_profile = json.loads(json.dumps(post_anchor_revision))
        extended_profile["generatedAt"] = "2026-07-29T07:02:04+00:00"
        extended_profile["daily"]["complete_through"] = "2026-07-28"
        extended_profile["daily"]["points"].append(
            {
                "date": "2026-07-28",
                "commits": 5,
                "additions": 50,
                "deletions": 20,
            }
        )
        extended_bridge = bridge_daily_snapshot()
        extended_bridge["through"] = "2026-07-28"
        extended_bridge["daily"].append(
            {
                "date": "2026-07-28",
                "commits": 2,
                "additions": 200,
                "deletions": 80,
            }
        )
        extended_bridge["totals"] = {
            metric: sum(
                int(point[metric])
                for point in extended_bridge["daily"]
            )
            for metric in MODULE.METRICS
        }
        advanced, changed = MODULE.build_public_v2(
            extended_profile,
            extended_bridge,
            previous=corrected_post_anchor,
            today=self.today,
        )
        self.assertTrue(changed)
        self.assertEqual(
            advanced["lifetime"],
            {
                "through": "2026-07-28",
                "commits": 115,
                "additions": 1500,
                "deletions": 600,
            },
        )
        replayed, changed = MODULE.build_public_v2(
            extended_profile,
            extended_bridge,
            previous=advanced,
            today=self.today,
        )
        self.assertFalse(changed)
        self.assertEqual(replayed, advanced)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertTrue(
                MODULE.publish_outputs_atomically(root, payload)
            )
            self.assertFalse(
                MODULE.publish_outputs_atomically(root, payload)
            )
            self.assertEqual(
                json.loads(
                    (
                        root
                        / "assets"
                        / "data"
                        / "combined-code-activity.json"
                    ).read_text(encoding="utf-8")
                ),
                payload,
            )
            svg = (
                root / "assets" / "data" / "combined-code-activity.svg"
            ).read_text(encoding="utf-8")
            self.assertIn("Combined daily code activity", svg)
            self.assertIn("COMMITS / DAY", svg)

    def test_three_file_publication_preserves_last_good_on_stage_failure(
        self,
    ) -> None:
        payload, _ = MODULE.build_public_v2(
            profile_daily_snapshot(),
            bridge_daily_snapshot(),
            previous=legacy_public_baseline(),
            today=self.today,
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            MODULE.publish_outputs_atomically(root, payload)
            originals = {
                path: path.read_bytes()
                for path in (
                    root / "_data" / "combined_code_activity.json",
                    root / "assets" / "data" / "combined-code-activity.json",
                    root / "assets" / "data" / "combined-code-activity.svg",
                )
            }
            updated = json.loads(json.dumps(payload))
            updated["lifetime"]["commits"] += 1
            real_stage = MODULE._staged_file
            calls = 0

            def fail_second_stage(path: Path, content: bytes) -> Path:
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError("fixture stage failure")
                return real_stage(path, content)

            with mock.patch.object(
                MODULE,
                "_staged_file",
                side_effect=fail_second_stage,
            ):
                with self.assertRaises(OSError):
                    MODULE.publish_outputs_atomically(root, updated)
            for path, content in originals.items():
                self.assertEqual(path.read_bytes(), content)

    def test_three_file_publication_rolls_back_replacement_failure(
        self,
    ) -> None:
        payload, _ = MODULE.build_public_v2(
            profile_daily_snapshot(),
            bridge_daily_snapshot(),
            previous=legacy_public_baseline(),
            today=self.today,
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            MODULE.publish_outputs_atomically(root, payload)
            targets = (
                root / "_data" / "combined_code_activity.json",
                root / "assets" / "data" / "combined-code-activity.json",
                root / "assets" / "data" / "combined-code-activity.svg",
            )
            originals = {path: path.read_bytes() for path in targets}
            updated = json.loads(json.dumps(payload))
            updated["lifetime"]["commits"] += 1
            real_replace = MODULE.os.replace
            calls = 0

            def fail_second_replace(source: Path, target: Path) -> None:
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError("fixture replacement failure")
                real_replace(source, target)

            with mock.patch.object(
                MODULE.os,
                "replace",
                side_effect=fail_second_replace,
            ):
                with self.assertRaises(OSError):
                    MODULE.publish_outputs_atomically(root, updated)
            for path, content in originals.items():
                self.assertEqual(path.read_bytes(), content)

    def test_profile_snapshot_remains_weekly_source_data(self) -> None:
        generated_at, rows = MODULE.validate_profile_snapshot(
            profile_snapshot(
                "2026-07-25T07:02:04+00:00",
                current_commits=3,
            )
        )
        self.assertEqual(
            MODULE._pacific_datetime(generated_at).date(),
            date(2026, 7, 25),
        )
        self.assertEqual(
            rows[date(2026, 7, 19)],
            {"commits": 3, "additions": 30, "deletions": 12},
        )

    def test_personal_daily_increment_uses_consecutive_midnight_closures(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            repo = Path(temporary)
            initialize_repo(repo)
            for generated_at, commits in (
                ("2026-07-24T07:02:04+00:00", 2),
                ("2026-07-25T07:02:04+00:00", 5),
                # A bounded retry is the sealed closure because it may contain
                # contributor statistics that arrived a few minutes late.
                ("2026-07-25T07:10:04+00:00", 6),
                # A later manual run on the same local date must not inflate
                # the completed-day closure selected above.
                ("2026-07-26T03:00:00+00:00", 99),
            ):
                commit_json(
                    repo,
                    "docs/github-activity.json",
                    profile_snapshot(
                        generated_at,
                        current_commits=commits,
                    ),
                )
            history = MODULE.load_profile_history(repo)
            daily = MODULE.personal_daily_for_date(
                history,
                date(2026, 7, 24),
            )
            baseline = MODULE.personal_baseline_for_date(
                history,
                date(2026, 7, 24),
            )
        self.assertEqual(
            daily,
            {"commits": 4, "additions": 40, "deletions": 16},
        )
        self.assertEqual(
            baseline,
            {"commits": 8, "additions": 80, "deletions": 32},
        )

    def test_personal_daily_increment_ignores_rolling_window_eviction(
        self,
    ) -> None:
        previous_rows = {
            date(2026, 7, 12): {
                "commits": 999,
                "additions": 9990,
                "deletions": 3996,
            },
            date(2026, 7, 19): {
                "commits": 8,
                "additions": 80,
                "deletions": 32,
            },
            date(2026, 7, 26): {
                "commits": 0,
                "additions": 0,
                "deletions": 0,
            },
        }
        current_rows = {
            date(2026, 7, 19): {
                "commits": 8,
                "additions": 80,
                "deletions": 32,
            },
            date(2026, 7, 26): {
                "commits": 3,
                "additions": 30,
                "deletions": 12,
            },
        }
        history = [
            (
                MODULE._pacific_datetime(
                    datetime.fromisoformat("2026-07-27T07:02:00+00:00")
                ),
                current_rows,
            ),
            (
                MODULE._pacific_datetime(
                    datetime.fromisoformat("2026-07-26T07:02:00+00:00")
                ),
                previous_rows,
            ),
        ]
        self.assertEqual(
            MODULE.personal_daily_for_date(
                history,
                date(2026, 7, 26),
            ),
            {"commits": 3, "additions": 30, "deletions": 12},
        )

    def test_bridge_history_selects_latest_same_date_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            repo = Path(temporary)
            initialize_repo(repo)
            for payload in (
                bridge_snapshot("2026-07-23", commits=5),
                bridge_snapshot("2026-07-24", commits=7),
                bridge_snapshot("2026-07-24", commits=8),
            ):
                commit_json(repo, "activity.json", payload)
            history = MODULE.load_bridge_history(
                repo,
                today=self.today,
            )
            selected = MODULE.bridge_totals_for_date(
                history,
                date(2026, 7, 24),
            )
        self.assertEqual(selected["commits"], 8)

    def test_build_advances_baseline_by_daily_personal_and_bridge_deltas(
        self,
    ) -> None:
        first, changed = MODULE.build_public_snapshot(
            {"commits": 5, "additions": 50, "deletions": 20},
            bridge_snapshot(),
            today=self.today,
        )
        self.assertTrue(changed)
        self.assertEqual(
            first["points"],
            [
                {
                    "date": "2026-07-24",
                    "commits": 12,
                    "additions": 120,
                    "deletions": 48,
                }
            ],
        )

        second, changed = MODULE.build_public_snapshot(
            {"commits": 3, "additions": 30, "deletions": 12},
            bridge_snapshot(
                "2026-07-25",
                commits=9,
                additions=90,
                deletions=36,
            ),
            previous=first,
            bridge_base=bridge_snapshot(),
            today=self.today,
        )
        self.assertTrue(changed)
        self.assertEqual(
            second["points"][-1],
            {
                "date": "2026-07-25",
                "commits": 17,
                "additions": 170,
                "deletions": 68,
            },
        )

    def test_same_day_no_change_is_a_noop(self) -> None:
        payload, _ = MODULE.build_public_snapshot(
            {"commits": 5, "additions": 50, "deletions": 20},
            bridge_snapshot(),
            today=self.today,
        )
        replay, changed = MODULE.build_public_snapshot(
            {"commits": 5, "additions": 50, "deletions": 20},
            bridge_snapshot(),
            previous=payload,
            today=self.today,
        )
        self.assertFalse(changed)
        self.assertEqual(replay, payload)

    def test_same_day_update_rebuilds_from_previous_date(self) -> None:
        first, _ = MODULE.build_public_snapshot(
            {"commits": 5, "additions": 50, "deletions": 20},
            bridge_snapshot("2026-07-23", commits=6, additions=60, deletions=24),
            today=self.today,
        )
        second, _ = MODULE.build_public_snapshot(
            {"commits": 3, "additions": 30, "deletions": 12},
            bridge_snapshot(),
            previous=first,
            bridge_base=bridge_snapshot(
                "2026-07-23",
                commits=6,
                additions=60,
                deletions=24,
            ),
            today=self.today,
        )
        updated, changed = MODULE.build_public_snapshot(
            {"commits": 3, "additions": 30, "deletions": 12},
            bridge_snapshot(
                commits=8,
                additions=80,
                deletions=32,
            ),
            previous=second,
            bridge_base=bridge_snapshot(
                "2026-07-23",
                commits=6,
                additions=60,
                deletions=24,
            ),
            today=self.today,
        )
        self.assertTrue(changed)
        self.assertEqual(updated["points"][0], first["points"][0])
        self.assertEqual(
            updated["points"][-1],
            {
                "date": "2026-07-24",
                "commits": 16,
                "additions": 160,
                "deletions": 64,
            },
        )

    def test_zero_activity_day_can_append_an_unchanged_cumulative_tally(
        self,
    ) -> None:
        first, _ = MODULE.build_public_snapshot(
            {"commits": 5, "additions": 50, "deletions": 20},
            bridge_snapshot(),
            today=self.today,
        )
        second, changed = MODULE.build_public_snapshot(
            {"commits": 0, "additions": 0, "deletions": 0},
            bridge_snapshot("2026-07-25"),
            previous=first,
            bridge_base=bridge_snapshot(),
            today=self.today,
        )
        self.assertTrue(changed)
        self.assertEqual(
            {
                metric: second["points"][-1][metric]
                for metric in MODULE.METRICS
            },
            {
                metric: first["points"][-1][metric]
                for metric in MODULE.METRICS
            },
        )

    def test_regression_and_decreasing_bridge_preserve_last_good(self) -> None:
        previous, _ = MODULE.build_public_snapshot(
            {"commits": 5, "additions": 50, "deletions": 20},
            bridge_snapshot(),
            today=self.today,
        )
        with self.assertRaises(MODULE.ActivityError):
            MODULE.build_public_snapshot(
                {"commits": 0, "additions": 0, "deletions": 0},
                bridge_snapshot("2026-07-23"),
                previous=previous,
                today=self.today,
            )
        with self.assertRaises(MODULE.ActivityError):
            MODULE.build_public_snapshot(
                {"commits": 1, "additions": 1, "deletions": 1},
                bridge_snapshot(
                    "2026-07-25",
                    commits=6,
                    additions=60,
                    deletions=24,
                ),
                previous=previous,
                bridge_base=bridge_snapshot(),
                today=self.today,
            )
        self.assertEqual(previous["updated_on"], "2026-07-24")
        self.assertEqual(len(previous["points"]), 1)

    def test_atomic_writer_does_not_replace_identical_output(self) -> None:
        payload, _ = MODULE.build_public_snapshot(
            {"commits": 5, "additions": 50, "deletions": 20},
            bridge_snapshot(),
            today=self.today,
        )
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "combined.json"
            self.assertTrue(MODULE.publish_atomically(target, payload))
            before = target.stat().st_mtime_ns
            self.assertFalse(MODULE.publish_atomically(target, payload))
            self.assertEqual(target.stat().st_mtime_ns, before)

    def test_workflow_fetches_bridge_history_and_scans_untracked_output(
        self,
    ) -> None:
        workflow = (
            REPO_ROOT / ".github" / "workflows" / "update-code-activity.yml"
        ).read_text(encoding="utf-8")
        self.assertIn("--bridge-repo bridge", workflow)
        bridge_step = workflow.split(
            "- name: Checkout protected aggregate bridge",
            maxsplit=1,
        )[1].split("- name: Setup Python", maxsplit=1)[0]
        self.assertIn("fetch-depth: 0", bridge_step)
        scan_step = workflow.split(
            "- name: Scan the public projection",
            maxsplit=1,
        )[1].split("- name: Detect public change", maxsplit=1)[0]
        self.assertIn("grep -nEi", scan_step)
        self.assertNotIn("git grep", scan_step)
        self.assertIn(
            "assets/data/combined-code-activity.json",
            workflow,
        )
        self.assertIn(
            "assets/data/combined-code-activity.svg",
            workflow,
        )
        self.assertIn(
            'python -m unittest discover -s test -p "$test_file"',
            workflow,
        )
        self.assertNotIn("test.test_import_combined_code_activity", workflow)
        self.assertIn("actions: write", workflow)
        deploy_step = workflow.split(
            "- name: Deploy refreshed snapshot",
            maxsplit=1,
        )[1]
        self.assertIn(
            "if: steps.change.outputs.changed == 'true'",
            deploy_step,
        )
        self.assertIn("GH_TOKEN: ${{ github.token }}", deploy_step)
        self.assertIn("gh workflow run deploy.yml --ref main", deploy_step)

    def test_cli_publishes_the_first_real_shape_atomically(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            profile = root / "profile"
            bridge = root / "bridge"
            site = root / "site"
            initialize_repo(profile)
            initialize_repo(bridge)
            commit_json(
                profile,
                "docs/github-activity.json",
                profile_snapshot(
                    "2026-07-25T07:02:04+00:00",
                    current_commits=5,
                ),
            )
            commit_json(bridge, "activity.json", bridge_snapshot())
            result = subprocess.run(
                [
                    sys.executable,
                    str(MODULE_PATH),
                    "--personal-repo",
                    str(profile),
                    "--bridge-repo",
                    str(bridge),
                    "--repo-root",
                    str(site),
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            output = site / "_data" / "combined_code_activity.json"
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(payload["updated_on"], "2026-07-24")
            self.assertEqual(
                payload["points"][-1],
                {
                    "date": "2026-07-24",
                    "commits": 14,
                    "additions": 140,
                    "deletions": 56,
                },
            )

    def test_cli_migrates_v2_and_publishes_json_and_svg_endpoints(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            profile = root / "profile"
            bridge = root / "bridge"
            site = root / "site"
            initialize_repo(profile)
            initialize_repo(bridge)
            commit_json(
                profile,
                "docs/github-activity.json",
                profile_daily_snapshot(),
            )
            commit_json(
                bridge,
                "activity.json",
                bridge_daily_snapshot(),
            )
            legacy_path = (
                site / "_data" / "combined_code_activity.json"
            )
            legacy_path.parent.mkdir(parents=True)
            legacy_path.write_text(
                json.dumps(legacy_public_baseline()),
                encoding="utf-8",
            )
            result = subprocess.run(
                [
                    sys.executable,
                    str(MODULE_PATH),
                    "--personal-repo",
                    str(profile),
                    "--bridge-repo",
                    str(bridge),
                    "--repo-root",
                    str(site),
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            public_json = (
                site / "assets" / "data"
                / "combined-code-activity.json"
            )
            public_svg = (
                site / "assets" / "data"
                / "combined-code-activity.svg"
            )
            self.assertTrue(public_json.exists())
            self.assertTrue(public_svg.exists())
            payload = json.loads(
                public_json.read_text(encoding="utf-8")
            )
            self.assertEqual(payload["schema"], 2)
            self.assertEqual(payload["lifetime"]["commits"], 107)


if __name__ == "__main__":
    unittest.main()
