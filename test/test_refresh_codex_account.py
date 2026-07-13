from __future__ import annotations

import copy
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
import urllib.error
from datetime import date, timedelta
from pathlib import Path
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "bin"))

import audit_agentic_usage as audit  # noqa: E402
import refresh_codex_account as refresh  # noqa: E402


class AccountRefreshTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if audit.yaml is None:
            raise unittest.SkipTest("PyYAML is required")
        cls.current_ledger = audit.load_current_ledger(REPO_ROOT)
        cls.current_account = cls.current_ledger["account_lifetime"]

    def raw_fixture(
        self,
        *,
        source_as_of: str | None = None,
        token_delta: int = 0,
        task_delta: int = 0,
        forced_zero_index: int | None = None,
    ) -> dict[str, object]:
        account = self.current_account
        source_as_of = source_as_of or str(account["source_as_of"])
        source_date = audit.timestamp_calendar_date(source_as_of)
        assert source_date is not None
        recent = copy.deepcopy(account["recent_activity"]["daily"])
        current_end = date.fromisoformat(recent[-1]["date"])
        shift = source_date - current_end
        for row in recent:
            row["date"] = (date.fromisoformat(row["date"]) + shift).isoformat()
        if forced_zero_index is not None:
            recent[forced_zero_index]["tokens"] = 0
        recent[-1]["tokens"] += token_delta
        recent_total = sum(row["tokens"] for row in recent)
        lifetime = account["token_count"] + token_delta
        older_total = lifetime - recent_total
        older_dates = [
            date.fromisoformat(recent[0]["date"]) - timedelta(days=offset)
            for offset in (3, 2, 1)
        ]
        older_base, older_remainder = divmod(older_total, len(older_dates))
        daily = [
            {
                "start_date": observed.isoformat(),
                "tokens": older_base + (1 if index < older_remainder else 0),
            }
            for index, observed in enumerate(older_dates)
        ]
        daily.extend(
            {"start_date": row["date"], "tokens": row["tokens"]}
            for row in recent
            if row["tokens"]
        )
        cumulative: list[dict[str, object]] = []
        running = 0
        for row in daily:
            running += int(row["tokens"])
            cumulative.append({"start_date": row["start_date"], "tokens": running})
        peak = max(daily, key=lambda row: int(row["tokens"]))
        return {
            "metadata": {
                "generated_at": source_as_of,
                "stats_as_of": refresh.parse_aware_timestamp(
                    source_as_of,
                    "fixture source",
                )
                .date()
                .isoformat(),
                "stats_error": None,
            },
            "profile": {"private": "ignored"},
            "stats": {
                "daily_usage_buckets": daily,
                "cumulative_daily_usage_buckets": cumulative,
                "weekly_usage_buckets": [{"start_date": "2026-07-06", "tokens": 1}],
                "lifetime_tokens": lifetime,
                "total_threads": account["tasks"] + task_delta,
                "peak_daily_tokens": peak["tokens"],
                "private_field": "ignored",
            },
        }

    def validate(self, raw: dict[str, object]) -> dict[str, object]:
        observed_at = refresh.parse_aware_timestamp(
            raw["metadata"]["generated_at"],
            "fixture generated_at",
        )
        return refresh.validate_raw_account(
            raw,
            self.current_account,
            now=observed_at + timedelta(minutes=5),
        )

    def make_repo(self, root: Path) -> None:
        for relative in (
            "_data/agentic_usage.yml",
            "_data/codex_account_history.json",
            "_data/github_activity.json",
            "assets/data/codex-profile-usage.json",
        ):
            destination = root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(REPO_ROOT / relative, destination)
        subprocess.run(["git", "init", "-q"], cwd=root, check=True)
        subprocess.run(["git", "config", "user.name", "Fixture"], cwd=root, check=True)
        subprocess.run(
            ["git", "config", "user.email", "fixture@example.invalid"],
            cwd=root,
            check=True,
        )
        subprocess.run(["git", "add", "."], cwd=root, check=True)
        subprocess.run(["git", "commit", "-qm", "fixture"], cwd=root, check=True)

    def test_valid_response_derives_exact_sunday_buckets_and_zero_days(self) -> None:
        validated = self.validate(self.raw_fixture(forced_zero_index=1))
        candidate = refresh.build_account_snapshot(self.current_account, validated)
        self.assertEqual(len(candidate["recent_activity"]["daily"]), 30)
        self.assertIn(len(candidate["recent_activity"]["weekly"]), {5, 6})
        first_date = date.fromisoformat(
            candidate["recent_activity"]["daily"][0]["date"]
        )
        last_date = date.fromisoformat(
            candidate["recent_activity"]["daily"][-1]["date"]
        )
        self.assertEqual(
            candidate["recent_activity"]["weekly"][0]["week"],
            audit.sunday_week_start(first_date).isoformat(),
        )
        self.assertEqual(
            candidate["recent_activity"]["weekly"][-1]["week"],
            audit.sunday_week_start(last_date).isoformat(),
        )
        self.assertEqual(candidate["recent_activity"]["daily"][1]["tokens"], 0)
        self.assertTrue(candidate["recent_activity"]["partial_last_day"])

    def test_midnight_rollover_restores_an_omitted_zero_partial_day(self) -> None:
        raw = self.raw_fixture(
            source_as_of="2026-07-13T07:20:00Z",
            forced_zero_index=29,
        )
        daily = raw["stats"]["daily_usage_buckets"]
        peak_index = max(range(len(daily)), key=lambda index: daily[index]["tokens"])
        bump = (
            self.current_account["peak_daily_tokens"] + 1 - daily[peak_index]["tokens"]
        )
        if bump > 0:
            daily[peak_index]["tokens"] += bump
            for row in raw["stats"]["cumulative_daily_usage_buckets"][peak_index:]:
                row["tokens"] += bump
            raw["stats"]["lifetime_tokens"] += bump
            raw["stats"]["peak_daily_tokens"] += bump
        validated = self.validate(raw)
        self.assertEqual(validated["daily"][-1]["date"], "2026-07-13")
        self.assertEqual(validated["daily"][-1]["tokens"], 0)

    def test_valid_unchanged_response_writes_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.make_repo(root)
            before = {
                path: path.read_bytes()
                for path in root.rglob("*")
                if path.is_file() and ".git" not in path.parts
            }
            status = refresh.refresh(
                root,
                self.raw_fixture(),
                write=True,
                now=refresh.parse_aware_timestamp(
                    self.current_account["source_as_of"],
                    "current source",
                )
                + timedelta(minutes=5),
            )
            after = {
                path: path.read_bytes()
                for path in root.rglob("*")
                if path.is_file() and ".git" not in path.parts
            }
            self.assertFalse(status.changed)
            self.assertEqual(status.reason, "unchanged")
            self.assertEqual(before, after)

    def test_newer_response_appends_history_and_updates_sanitized_projection(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.make_repo(root)
            status = refresh.refresh(
                root,
                self.raw_fixture(
                    source_as_of=(
                        refresh.parse_aware_timestamp(
                            self.current_account["source_as_of"],
                            "current source",
                        )
                        + timedelta(minutes=1)
                    )
                    .isoformat()
                    .replace("+00:00", "Z"),
                    token_delta=123,
                    task_delta=1,
                ),
                write=True,
                now=refresh.parse_aware_timestamp(
                    self.current_account["source_as_of"],
                    "current source",
                )
                + timedelta(minutes=5),
            )
            self.assertTrue(status.account_changed)
            history = json.loads(
                (root / "_data" / "codex_account_history.json").read_text()
            )
            self.assertEqual(len(history["snapshots"]), 3)
            public = json.loads(
                (root / "assets" / "data" / "codex-profile-usage.json").read_text()
            )
            self.assertEqual(
                set(public),
                {"schema", "source", "sourceAsOf", "lifetime", "recent", "history"},
            )
            serialized = json.dumps(public).lower()
            for forbidden in (
                "profile",
                "plugin",
                "streak",
                "reasoning",
                "access_token",
                "account_id",
            ):
                self.assertNotIn(forbidden, serialized)

    def test_heartbeat_publishes_unchanged_totals_after_eighteen_hours(self) -> None:
        current = copy.deepcopy(self.current_account)
        candidate = copy.deepcopy(current)
        current["source_as_of"] = "2026-07-12T07:00:00Z"
        candidate["source_as_of"] = "2026-07-13T01:00:00Z"
        self.assertEqual(
            refresh.account_publication_reason(current, candidate), "heartbeat"
        )

    def test_stale_response_is_rejected(self) -> None:
        current_source = refresh.parse_aware_timestamp(
            self.current_account["source_as_of"],
            "current source",
        )
        raw = self.raw_fixture(
            source_as_of=(current_source - timedelta(days=1))
            .isoformat()
            .replace("+00:00", "Z")
        )
        with self.assertRaises(refresh.StaleError):
            refresh.validate_raw_account(
                raw,
                self.current_account,
                now=current_source + timedelta(minutes=5),
            )

    def test_non_monotonic_totals_are_rejected(self) -> None:
        raw = self.raw_fixture()
        raw["stats"]["total_threads"] = self.current_account["tasks"] - 1
        with self.assertRaises(refresh.StaleError):
            self.validate(raw)

    def test_malformed_cumulative_parity_is_rejected(self) -> None:
        raw = self.raw_fixture()
        raw["stats"]["cumulative_daily_usage_buckets"][-1]["tokens"] += 1
        with self.assertRaises(refresh.ContractError):
            self.validate(raw)

    def test_missing_recent_coverage_is_rejected(self) -> None:
        raw = self.raw_fixture()
        raw["stats"]["daily_usage_buckets"] = raw["stats"]["daily_usage_buckets"][-10:]
        running = 0
        cumulative = []
        for row in raw["stats"]["daily_usage_buckets"]:
            running += row["tokens"]
            cumulative.append({"start_date": row["start_date"], "tokens": running})
        raw["stats"]["cumulative_daily_usage_buckets"] = cumulative
        raw["stats"]["lifetime_tokens"] = running
        with self.assertRaises(refresh.ContractError):
            self.validate(raw)

    def test_daily_bucket_cannot_be_later_than_pacific_source_date(self) -> None:
        raw = self.raw_fixture()
        source = refresh.parse_aware_timestamp(
            raw["metadata"]["generated_at"], "fixture"
        )
        source_date = audit.timestamp_calendar_date(raw["metadata"]["generated_at"])
        assert source_date is not None
        future_date = (source_date + timedelta(days=1)).isoformat()
        raw["stats"]["daily_usage_buckets"][-1]["start_date"] = future_date
        raw["stats"]["cumulative_daily_usage_buckets"][-1]["start_date"] = future_date
        with self.assertRaises(refresh.ContractError):
            refresh.validate_raw_account(
                raw,
                self.current_account,
                now=source + timedelta(minutes=5),
            )

    def test_expired_auth_is_classified_without_response_body(self) -> None:
        error = urllib.error.HTTPError(
            refresh.ACCOUNT_ENDPOINT,
            401,
            "unauthorized",
            hdrs=None,
            fp=None,
        )
        try:
            with mock.patch("urllib.request.urlopen", side_effect=error):
                with self.assertRaises(refresh.AuthError):
                    refresh.fetch_json(
                        refresh.ACCOUNT_ENDPOINT,
                        headers={
                            "Authorization": "Bearer secret",
                            "ChatGPT-Account-Id": "private",
                        },
                        authentication_required=True,
                    )
        finally:
            error.close()

    def test_github_fallback_rejects_repository_identity_fields(self) -> None:
        activity = json.loads(
            (REPO_ROOT / "_data" / "github_activity.json").read_text()
        )
        activity["weeks"][0]["repository"] = "private-name"
        with self.assertRaises(refresh.ContractError):
            refresh.validate_github_activity(activity)

    def test_metrics_bot_commits_do_not_inflate_site_counts(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            tracked = root / "tracked.txt"
            tracked.write_text("human\n", encoding="utf-8")
            subprocess.run(["git", "add", "."], cwd=root, check=True)
            subprocess.run(
                [
                    "git",
                    "-c",
                    "user.name=Human",
                    "-c",
                    "user.email=human@example.com",
                    "commit",
                    "-qm",
                    "human",
                ],
                cwd=root,
                check=True,
            )
            tracked.write_text("human\nbot\n", encoding="utf-8")
            subprocess.run(["git", "add", "."], cwd=root, check=True)
            subprocess.run(
                [
                    "git",
                    "-c",
                    "user.name=Dylan Metrics Bot",
                    "-c",
                    "user.email=metrics-bot@users.noreply.github.com",
                    "commit",
                    "-qm",
                    "automated refresh",
                ],
                cwd=root,
                check=True,
            )
            self.assertEqual(audit.git_commit_count(root, "2000-01-01", ["."]), 1)


if __name__ == "__main__":
    unittest.main()
