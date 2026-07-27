from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path


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
        self.today = date(2026, 7, 26)

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
            {**bridge_snapshot("2026-07-27")},
        ):
            with self.subTest(mutation=mutation):
                with self.assertRaises(MODULE.ActivityError) as raised:
                    MODULE.validate_bridge(mutation, today=self.today)
                self.assertNotIn("repository", str(raised.exception))
                self.assertNotIn("private", str(raised.exception))

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


if __name__ == "__main__":
    unittest.main()
