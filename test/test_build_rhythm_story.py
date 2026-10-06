from __future__ import annotations

import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PAGE_PATH = REPO_ROOT / "_pages" / "github-activity.md"
HOME_PATH = REPO_ROOT / "_layouts" / "home.liquid"
CASE_STUDY_PATH = REPO_ROOT / "_projects" / "build-rhythm.md"
REPRODUCTION_PATH = REPO_ROOT / "assets" / "downloads" / "site-experiments" / "build-rhythm-reproduction.md"
HEURISTICS_PATH = REPO_ROOT / "WEBSITE_DESIGN_HEURISTICS.md"
SCRIPT_PATH = REPO_ROOT / "assets" / "js" / "github-activity.js"
STYLE_PATH = REPO_ROOT / "_sass" / "_github-activity.scss"
CODE_ACTIVITY_IMPORTER_PATH = REPO_ROOT / "bin" / "import_code_activity.py"
PACKAGE_PATH = REPO_ROOT / "package.json"
PUBLIC_VISUAL_CONFIG_PATH = REPO_ROOT / "test" / "visual" / "public.config.js"
PUBLIC_ROUTES_PATH = REPO_ROOT / "test" / "visual" / "public-routes.js"


class BuildRhythmStoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.page = PAGE_PATH.read_text(encoding="utf-8")
        cls.home = HOME_PATH.read_text(encoding="utf-8")
        cls.case_study = CASE_STUDY_PATH.read_text(encoding="utf-8")
        cls.reproduction = REPRODUCTION_PATH.read_text(encoding="utf-8")
        cls.heuristics = HEURISTICS_PATH.read_text(encoding="utf-8")
        cls.script = SCRIPT_PATH.read_text(encoding="utf-8")
        cls.style = STYLE_PATH.read_text(encoding="utf-8")
        cls.code_activity_importer = CODE_ACTIVITY_IMPORTER_PATH.read_text(encoding="utf-8")
        cls.package = PACKAGE_PATH.read_text(encoding="utf-8")
        cls.public_visual_config = PUBLIC_VISUAL_CONFIG_PATH.read_text(encoding="utf-8")
        cls.public_routes = PUBLIC_ROUTES_PATH.read_text(encoding="utf-8")

    def test_persistent_history_and_one_detail_slot_with_native_data_disclosure(self) -> None:
        self.assertEqual(self.page.count('<svg '), 2)
        self.assertIn('data-rhythm-chart', self.page)
        self.assertIn('data-rhythm-detail-chart', self.page)
        self.assertIn('data-rhythm-year', self.page)
        self.assertEqual(re.findall(r'data-rhythm-view="([a-z]+)"', self.page), ['daily', 'weekly'])
        self.assertIn('About the data', self.page)
        self.assertIn('data-rhythm-table-body', self.page)
        self.assertNotIn('data-build-rhythm-story', self.page)
        self.assertNotIn('data-rhythm-explorer', self.page)


    def test_code_activity_supported_schema_gate_replaces_the_retired_lifetime_strip(self) -> None:
        for contract in (
            "site.data.code_activity",
            'id="code-activity-data"',
            'code_activity.schema == 5',
            'code_activity.schema == 6',
            'code_schema_supported and code_activity.date_basis',
            'code_activity.date_basis == "source_reported_calendar"',
            'code_activity.scope == "code_activity"',
            'code_activity.coverage.status == "complete"',
            'code_activity.sources and code_activity.sources.size > 0',
            "Code history is being rebuilt.",
            "data-personal-daily-copy",
            "data-personal-code-unavailable",
        ):
            with self.subTest(contract=contract):
                self.assertIn(contract, self.page)
        for retired in (
            "Combined lifetime code activity",
            "DAILY HISTORY AWAITING REFRESH",
            "DAILY HISTORY · AWAITING",
        ):
            with self.subTest(retired=retired):
                self.assertNotIn(retired, self.page)
        self.assertEqual(
            self.page.count("Code history is being rebuilt."),
            1,
        )
        self.assertIn('document.getElementById("code-activity-data")', self.script)
        # The five-year rolling window is gone: the anchor is fixed, so a
        # refresh can only extend history forward.
        self.assertNotIn("fiveCalendarYearsBefore", self.script)
        self.assertIn("const validCodeActivitySource = (candidate) =>", self.script)
        self.assertIn('basis: "github_contribution_parity"', self.script)
        self.assertIn('dateBasis: "github_profile_author_date"', self.script)
        self.assertIn('completionTimeZone: "America/Los_Angeles"', self.script)
        self.assertIn('basis: "reported_daily_summary"', self.script)
        self.assertIn('dateBasis: "utc_calendar_date"', self.script)
        self.assertIn("parsed.toISOString().slice(0, 10) === value", self.script)
        self.assertIn("candidate.coverage.starts_on !== codeActivitySourceContracts.personal.startsOn", self.script)
        self.assertIn("startsOn.getTime() !== Math.min(...sourceStarts)", self.script)
        self.assertIn("completeThrough.getTime() !== Math.max(...sourceEnds)", self.script)
        self.assertIn('candidate.date_basis !== "source_reported_calendar"', self.script)
        self.assertIn("calendarLabelFor(new Date(), descriptor.completion_timezone)", self.script)
        self.assertIn("entry.authored_commits <= entry.commits", self.script)
        self.assertNotIn('fetch(remoteSource', self.script)
        self.assertIn("validate_profile_snapshot", self.code_activity_importer)
        self.assertIn("validate_contributed_snapshot", self.code_activity_importer)
        self.assertIn("scope\": \"code_activity", self.code_activity_importer)
        self.assertIn(
            'href="{{ \'/github-activity/\' | relative_url }}"',
            self.home,
        )
        self.assertIn('class="home-connect-note"', self.home)
        self.assertIn("{{ '/projects/website-revamp/' | relative_url }}", self.home)
        self.assertNotIn("home-agentic-tally", self.home)
        self.assertNotIn("home-build-rhythm-route", self.home)
        self.assertNotIn("site.data.agentic_usage", self.home)
        self.assertNotIn("site.data.code_activity", self.home)
        self.assertNotIn("home-agentic-heartbeat", self.home)
        self.assertNotIn("{% assign direct_tracker", self.home)

    def test_missing_personal_history_has_one_compact_unavailable_state(
        self,
    ) -> None:
        for contract in (
            'data-state="{% if personal_daily_ready %}loading{% else %}unavailable{% endif %}"',
            "data-personal-daily-copy",
            "data-personal-code-unavailable",
        ):
            with self.subTest(contract=contract):
                self.assertIn(contract, self.page)

        self.assertNotIn("PERSONAL · REBUILDING", self.page)
        self.assertIn(
            '.github-activity-page[data-state="unavailable"]',
            self.style,
        )
        self.assertIn('root.dataset.state = "unavailable";', self.script)
        self.assertNotIn("validLegacyActivitySource", self.script)



    def test_story_credit_and_origin_route_are_explicit(self) -> None:
        self.assertIn("https://rhythm-of-food.net/", self.page)
        self.assertIn("Google News Lab", self.page)
        self.assertIn("Truth &amp; Beauty", self.page)
        self.assertIn("https://jrthomp.com/", self.page)
        self.assertIn("John Thompson", self.page)
        self.assertIn('href="/projects/build-rhythm/"', self.page)
        self.assertIn('label="Read how Build Rhythm began"', self.page)
        self.assertNotIn("autodesk", self.page.lower())


    def test_chart_copy_preserves_personal_voice_and_source_limits(self) -> None:
        for phrase in ('I wanted the logs to show where the work bunches up.',
                       'Intern work is a separate source and is not added to this chart.',
                       'Dates are not rebinned into the visitor',
                       'Only verified dates contribute;',
                       'stops at the last verified date in the range.',
                       'rebased from zero; earlier work is excluded',
                       'changes independently of the upper history',
                       'Daily and Weekly replace the same lower slot'):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.page)
        for retired in ('PERSONAL AGENT TOKENS', 'Recent agent history is unavailable.',
                        'Additions rise above the baseline', 'personal agent history'):
            self.assertNotIn(retired, self.page + self.script)




    def test_exact_records_have_a_native_alternative_reading_path(self) -> None:
        for contract in ('data-rhythm-records', 'role="region"', 'tabindex="0"',
                         '<th scope="col">Date label</th>', '<th scope="col">Total commits</th>',
                         '<th scope="col">Authored commits</th>', 'id="code-activity-data"'):
            with self.subTest(contract=contract):
                self.assertIn(contract, self.page)
        self.assertIn('authored subset excludes merges and deploys', self.page)
        self.assertIn('contribution calendar also counts pull requests, issues, and reviews', self.page)


    def test_case_study_and_reproduction_describe_one_code_clock(self) -> None:
        for phrase in (
            "7e224db12",
            "6edea07f4",
            "One rhythm, never a score",
            "Two questions, one clock",
            "Receipts: how the clocks came and went",
            "An earlier version put GitHub activity and source-linked token history in one workbench",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.case_study)

        for phrase in (
            "code cadence",
            "each code source on its declared calendar",
            "daily commits",
            "same selected source-calendar label",
            "exact source-calendar contract",
            "Code history is being rebuilt.",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.reproduction)

        self.assertIn("Code history appears only after an exact source-calendar contract", self.heuristics)
        self.assertIn("Matching `YYYY-MM-DD` labels", self.heuristics)
        self.assertIn("one compact `Code history is being rebuilt.` state", self.heuristics)
        self.assertIn("each source's `commits` is its reported total", self.heuristics)
        self.assertIn("do not extend that claim to other sources or a combined total", self.heuristics)
        self.assertIn("`authored_commits` is the non-merge, non-deploy subset", self.heuristics)

        for stale_phrase in (
            "dated 30-day Codex snapshot",
            "shorter clock of recent Codex use",
            "Keep tool-use tokens on their own truthful horizon",
            "two-measure data boundary",
            "one weekly calendar",
            "weekly commits",
            "same selected week",
            "Site-token rhythm",
            "Personal agent days",
            "three clocks",
            "token_rhythm",
            "completed personal agent usage",
            "repo-scoped retained-session estimate",
        ):
            with self.subTest(stale_phrase=stale_phrase):
                self.assertNotIn(stale_phrase, self.case_study)
                self.assertNotIn(stale_phrase, self.reproduction)

    def test_retired_quota_health_ui_and_copy_are_absent(self) -> None:
        public_surfaces = "\n".join((self.page, self.case_study, self.reproduction, self.script)).lower()
        for retired in (
            "2-account quota health",
            "two-account quota health",
            "quota-health",
            "data-codex-healthy",
            "data-codex-fresh",
            "data-codex-quota",
            "personalroundedlifetimebaseline",
        ):
            with self.subTest(retired=retired):
                self.assertNotIn(retired, public_surfaces)
        for retired in ("gmail", "ucsd email"):
            with self.subTest(retired=retired):
                self.assertNotIn(retired, self.page.lower())
        self.assertNotIn("sanitized personal agent series", self.page)
        self.assertNotIn("account identities and per-account readings", self.page)
        self.assertNotIn("data-codex-observed", self.page)
        for retired in ("unallocated baseline", "two accounts combined", "this laptop"):
            self.assertNotIn(retired, self.page.lower())
            self.assertNotIn(retired, self.script.lower())
        self.assertNotIn("automatic refresh pending", self.page)

    def test_build_rhythm_visual_contract_runs_in_the_public_site_matrix(self) -> None:
        spec = "build-rhythm-story.spec.js"
        self.assertIn(spec, self.package)
        self.assertIn(spec, self.public_visual_config)
        self.assertIn('id: "project-build-rhythm"', self.public_routes)
        self.assertIn('path: "/projects/build-rhythm/"', self.public_routes)


if __name__ == "__main__":
    unittest.main()
