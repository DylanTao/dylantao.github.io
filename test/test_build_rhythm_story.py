from __future__ import annotations

import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PAGE_PATH = REPO_ROOT / "_pages" / "github-activity.md"
CASE_STUDY_PATH = REPO_ROOT / "_projects" / "build-rhythm.md"
REPRODUCTION_PATH = REPO_ROOT / "assets" / "downloads" / "site-experiments" / "build-rhythm-reproduction.md"
HEURISTICS_PATH = REPO_ROOT / "WEBSITE_DESIGN_HEURISTICS.md"
LEDGER_DOC_PATH = REPO_ROOT / "docs" / "agentic-usage-ledger.md"
SCRIPT_PATH = REPO_ROOT / "assets" / "js" / "github-activity.js"
STYLE_PATH = REPO_ROOT / "_sass" / "_github-activity.scss"
SITE_ENDPOINT_PATH = REPO_ROOT / "assets" / "data" / "build-rhythm-token-rhythm.json.liquid"
ALL_WORK_ENDPOINT_PATH = REPO_ROOT / "assets" / "data" / "build-rhythm-all-work-token-rhythm.json.liquid"
PACKAGE_PATH = REPO_ROOT / "package.json"
PUBLIC_VISUAL_CONFIG_PATH = REPO_ROOT / "test" / "visual" / "public.config.js"
PUBLIC_ROUTES_PATH = REPO_ROOT / "test" / "visual" / "public-routes.js"


class BuildRhythmStoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.page = PAGE_PATH.read_text(encoding="utf-8")
        cls.case_study = CASE_STUDY_PATH.read_text(encoding="utf-8")
        cls.reproduction = REPRODUCTION_PATH.read_text(encoding="utf-8")
        cls.heuristics = HEURISTICS_PATH.read_text(encoding="utf-8")
        cls.ledger_doc = LEDGER_DOC_PATH.read_text(encoding="utf-8")
        cls.script = SCRIPT_PATH.read_text(encoding="utf-8")
        cls.style = STYLE_PATH.read_text(encoding="utf-8")
        cls.site_endpoint = SITE_ENDPOINT_PATH.read_text(encoding="utf-8")
        cls.all_work_endpoint = ALL_WORK_ENDPOINT_PATH.read_text(encoding="utf-8")
        cls.package = PACKAGE_PATH.read_text(encoding="utf-8")
        cls.public_visual_config = PUBLIC_VISUAL_CONFIG_PATH.read_text(encoding="utf-8")
        cls.public_routes = PUBLIC_ROUTES_PATH.read_text(encoding="utf-8")

    def test_concise_scope_guide_replaces_the_redundant_scroll_story(self) -> None:
        self.assertEqual(self.page.count('class="build-rhythm-guide-grid"'), 1)
        self.assertEqual(self.page.count('class="build-rhythm-guide-grid"') + self.page.count("THREE SCOPE GUIDE"), 2)
        for label in ("01 · LIFETIME SNAPSHOT", "02 · WEEKLY GITHUB", "03 · DAILY TOKENS"):
            self.assertIn(label, self.page)
        self.assertLess(self.page.index('class="build-rhythm-guide"'), self.page.index("data-codex-usage"))
        self.assertLess(self.page.index("data-codex-usage"), self.page.index('class="github-activity-workbench"'))
        self.assertLess(self.page.index('class="github-activity-workbench"'), self.page.index("data-token-rhythm"))
        removed = (
            "data-build-rhythm-story",
            "data-build-rhythm-step",
            "build-rhythm-story-stage",
            "build-rhythm-story-layout",
            "initBuildRhythmStory",
            "drawTokenRhythm",
            "drawSeries",
        )
        public_implementation = "\n".join((self.page, self.script, self.style))
        for selector in removed:
            with self.subTest(selector=selector):
                self.assertNotIn(selector, public_implementation)

    def test_credit_and_origin_route_remain_explicit(self) -> None:
        for phrase in ("https://rhythm-of-food.net/", "Google News Lab", "Truth &amp; Beauty", "https://jrthomp.com/", "John Thompson"):
            self.assertIn(phrase, self.page)
        self.assertIn('href="/projects/build-rhythm/"', self.page)
        self.assertIn('label="Read how Build Rhythm began"', self.page)

    def test_two_public_token_endpoints_are_direct_separate_ledger_projections(self) -> None:
        self.assertIn("permalink: /assets/data/build-rhythm-token-rhythm.json", self.site_endpoint)
        self.assertIn("{{ site.data.agentic_usage.total.token_rhythm | jsonify }}", self.site_endpoint)
        self.assertIn("permalink: /assets/data/build-rhythm-all-work-token-rhythm.json", self.all_work_endpoint)
        self.assertIn("{{ site.data.agentic_usage.local_lifetime.token_rhythm | jsonify }}", self.all_work_endpoint)
        for endpoint in (self.site_endpoint, self.all_work_endpoint):
            self.assertIn("layout: null", endpoint)
            self.assertNotIn("direct_usage_tracker", endpoint)
            self.assertNotIn("account", endpoint.lower())

    def test_dual_daily_chart_has_strict_sources_and_one_authoritative_figure(self) -> None:
        self.assertIn('id="build-rhythm-token-data"', self.page)
        self.assertIn('id="build-rhythm-all-work-token-data"', self.page)
        self.assertIn("site.data.agentic_usage.total.token_rhythm", self.page)
        self.assertIn("site.data.agentic_usage.local_lifetime.token_rhythm", self.page)
        self.assertIn('id="github-activity-token-rhythm-chart"', self.page)
        self.assertEqual(self.page.count('id="github-activity-token-rhythm-chart"'), 1)
        self.assertIn('label: "Site revamp retained-session estimate"', self.script)
        self.assertIn('method: "deduplicated_repo_retained_logs"', self.script)
        self.assertIn('label: "All retained Codex work estimate"', self.script)
        self.assertIn('method: "deduplicated_all_retained_logs"', self.script)
        self.assertIn("Number.isSafeInteger(point.token_count)", self.script)
        self.assertIn('class: "github-activity-token-all-work-line"', self.script)
        self.assertIn('class: "github-activity-token-site-line"', self.script)
        self.assertNotIn("github-activity-token-cumulative-line", self.script)
        self.assertNotIn("github-activity-token-delta-line", self.script)

    def test_every_chart_keeps_y_axis_units_and_transform_in_compact_copy(self) -> None:
        for phrase in (
            "Y-AXIS: DAILY TOKENS · LOG1P",
            "Y-AXIS: ROUNDED DAILY ESTIMATED TOKENS · READABLE LOG1P",
            "Y-AXIS: COMMITS/WK",
            "Y-AXIS: LINES/WK",
            "READABLE SYMLOG",
            "LITERAL LINEAR",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.page + self.script)

    def test_daily_inspector_supports_pointer_keyboard_focus_and_quiet_announcements(self) -> None:
        for phrase in (
            'chart.tabIndex = 0',
            'chart.setAttribute("role", "slider")',
            'event.key === "ArrowLeft"',
            'event.key === "ArrowRight"',
            'event.key === "Home"',
            'event.key === "End"',
            'event.key === "Escape"',
            'showIndex(nearestIndex(event), { pin: true, announce: true })',
            'if (announce) announcement.textContent = readout.textContent',
            'new ResizeObserver(scheduleRender).observe(chart)',
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.script)
        self.assertIn(".github-activity-token-rhythm-chart.is-keyboard-focused", self.style)
        self.assertIn("touch-action: pan-y", self.style)
        self.assertNotIn('data-token-rhythm-readout aria-live="polite"', self.page)
        self.assertIn('data-token-rhythm-announcement aria-live="polite"', self.page)

    def test_daily_rows_are_collapsed_but_keep_a_native_no_js_path(self) -> None:
        self.assertIn('<details class="github-activity-token-evidence">', self.page)
        self.assertNotIn('<details class="github-activity-token-evidence" open>', self.page)
        self.assertIn("Daily values for accessible and no-JavaScript reading", self.page)
        self.assertIn('id="github-activity-token-table-body"', self.page)
        self.assertIn('aria-label="No prior all-work point for this date"', self.page)
        self.assertIn('aria-label="No prior website point for this date"', self.page)
        self.assertIn("min-width: 56rem", self.style)

    def test_daily_deltas_require_an_adjacent_published_point(self) -> None:
        self.assertIn("delta: index === 0 ? null", self.script)
        self.assertIn("siteWithDeltas.slice(1)", self.script)
        self.assertIn("Math.max(siteRows[1].date.getTime(), allWorkRows[1].date.getTime())", self.script)
        self.assertNotIn("rows[index - 1]?.tokenCount || 0", self.script)
        self.assertIn("Each series' first cumulative point is only a baseline with no daily delta", self.reproduction)
        self.assertIn("each series' first point is a baseline with no daily value", self.ledger_doc)

    def test_lifetime_replay_is_hypothetical_source_pinned_and_outside_direct_schema(self) -> None:
        for phrase in (
            "data-hypothetical-mix-matched-api-rate-replay",
            "model, cache, request-length, and input/output mix",
            "local_replay.source_url",
            "local_replay.pricing_as_of",
            "local_replay.priced_token_usage.total_tokens",
            "divided_by: local_replay_priced_tokens",
            "unsupported-model tokens and unavailable cache-write tokens are excluded",
            "Not an actual bill",
        ):
            self.assertIn(phrase, self.page)
        self.assertNotIn("site.data.agentic_usage.local_lifetime.raw_token_count", self.page)
        self.assertIn("priced dollars-per-priced-token", self.ledger_doc)
        self.assertIn("hypothetical_mix_matched_api_rate_replay", self.ledger_doc)
        self.assertIn("hypothetical_mix_matched_api_rate_replay", self.reproduction)
        self.assertNotIn("api_cost", (REPO_ROOT / "_data" / "direct_usage_tracker.json").read_text(encoding="utf-8"))

    def test_case_study_and_reproduction_match_the_refined_story(self) -> None:
        for phrase in (
            "concise scope guide",
            "all retained Codex work",
            "one dual daily-delta chart",
            "labels its Y-axis as LOG1P",
            "when a teaching figure repeats the explorer below",
        ):
            self.assertIn(phrase, self.case_study)
        for phrase in (
            "two retained-token sources separate strict endpoints",
            "Prefix every chart heading or badge with `Y-AXIS:`",
            "Ordinary hover may update visible copy",
            "collapsed native disclosure",
            "not an actual bill",
        ):
            self.assertIn(phrase, self.reproduction)
        self.assertIn("Use one authoritative daily-delta figure", self.heuristics)
        self.assertIn("local_lifetime.token_rhythm", self.ledger_doc)

    def test_retired_quota_health_and_source_identity_copy_are_absent(self) -> None:
        surfaces = "\n".join((self.page, self.case_study, self.reproduction, self.script)).lower()
        for retired in ("2-account quota health", "two-account quota health", "quota-health", "data-codex-quota", "gmail", "ucsd email"):
            self.assertNotIn(retired, surfaces)

    def test_visual_contract_runs_in_the_public_site_matrix(self) -> None:
        spec = "build-rhythm-story.spec.js"
        self.assertIn(spec, self.package)
        self.assertIn(spec, self.public_visual_config)
        self.assertIn('id: "project-build-rhythm"', self.public_routes)
        self.assertIn('path: "/projects/build-rhythm/"', self.public_routes)


if __name__ == "__main__":
    unittest.main()
