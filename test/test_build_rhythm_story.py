from __future__ import annotations

import re
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
TOKEN_ENDPOINT_PATH = REPO_ROOT / "assets" / "data" / "build-rhythm-token-rhythm.json.liquid"
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
        cls.token_endpoint = TOKEN_ENDPOINT_PATH.read_text(encoding="utf-8")
        cls.package = PACKAGE_PATH.read_text(encoding="utf-8")
        cls.public_visual_config = PUBLIC_VISUAL_CONFIG_PATH.read_text(encoding="utf-8")
        cls.public_routes = PUBLIC_ROUTES_PATH.read_text(encoding="utf-8")

    def test_story_chapters_are_server_rendered_in_order(self) -> None:
        steps = re.findall(r'data-build-rhythm-step="([a-z-]+)"', self.page)
        self.assertEqual(
            steps,
            ["cadence", "magnitude", "bursts", "tokens", "lifetime", "explore"],
        )
        self.assertIn('class="build-rhythm-story-stage-wrap" aria-hidden="true"', self.page)
        self.assertLess(
            self.page.index('data-build-rhythm-story'),
            self.page.index('class="github-activity-workbench"'),
        )
        self.assertLess(
            self.page.index('class="github-activity-workbench"'),
            self.page.index('data-codex-usage'),
        )
        self.assertLess(
            self.page.index('class="github-activity-workbench"'),
            self.page.index('class="github-activity-token-rhythm"'),
        )
        self.assertLess(
            self.page.index('class="github-activity-token-rhythm"'),
            self.page.index('class="github-activity-method"'),
        )

    def test_story_credit_and_origin_route_are_explicit(self) -> None:
        self.assertIn("https://rhythm-of-food.net/", self.page)
        self.assertIn("Google News Lab", self.page)
        self.assertIn("Truth &amp; Beauty", self.page)
        self.assertIn("https://jrthomp.com/", self.page)
        self.assertIn("John Thompson", self.page)
        self.assertIn('href="/projects/build-rhythm/"', self.page)
        self.assertIn('label="Read how Build Rhythm began"', self.page)
        self.assertNotIn("autodesk", self.page.lower())

    def test_story_uses_native_scroll_and_bounded_progressive_enhancement(self) -> None:
        self.assertIn("IntersectionObserver", self.script)
        self.assertIn('window.matchMedia("(prefers-reduced-motion: reduce)")', self.script)
        self.assertIn('window.matchMedia("(max-width: 820px)")', self.script)
        self.assertIn("requestAnimationFrame(tick)", self.script)
        self.assertIn('stage.dataset.transitioning = "false"', self.script)
        self.assertIn('storyRoot.dataset.storyVisible = String(storyVisible)', self.script)
        self.assertNotRegex(self.script, r'addEventListener\(\s*["\']wheel["\']')
        self.assertNotIn("scrollTo(", self.script)
        self.assertNotIn("scrollIntoView(", self.script)

    def test_token_rhythm_uses_the_public_repo_estimate_without_account_history(self) -> None:
        self.assertIn('id="build-rhythm-token-data"', self.page)
        self.assertIn("site.data.agentic_usage.total.token_rhythm", self.page)
        self.assertIn('data-build-rhythm-step="tokens"', self.page)
        self.assertIn("Then I follow the site build day by day.", self.page)
        self.assertIn('id="github-activity-token-table-body"', self.page)
        self.assertIn('id="github-activity-token-rhythm-chart"', self.page)
        self.assertIn('id="github-activity-token-table-scroll-hint"', self.page)
        self.assertIn('class="github-activity-token-evidence" data-token-rhythm-details', self.page)
        self.assertIn('data-token-rhythm', self.page)
        self.assertIn("Site-build token rhythm", self.page)
        self.assertIn("Rounded increase", self.page)
        self.assertIn('<summary id="github-activity-token-table-title">Exact daily values</summary>', self.page)
        self.assertIn("The same rounded series, row by row.", self.page)
        self.assertNotIn('<details class="github-activity-token-evidence" data-token-rhythm-details open>', self.page)
        self.assertIn("biggest adjacent jump was", self.page)
        self.assertIn('candidate.method !== "deduplicated_repo_retained_logs"', self.script)
        self.assertIn('candidate.units !== "estimated tokens"', self.script)
        self.assertIn("Number.isSafeInteger(point.token_count)", self.script)
        self.assertIn('root.dataset.tokenState = tokenSource ? "ready" : "error"', self.script)
        self.assertIn("Biggest adjacent jump", self.script)
        self.assertNotIn("account_lifetime", self.page)

    def test_story_voice_is_personal_concrete_and_not_repeatedly_defensive(self) -> None:
        for phrase in (
            "I wanted the logs to show where the work bunches up.",
            "First, I look for the bursts.",
            "Commit count tells me when. Line changes tell me how much.",
            "One giant week was flattening everything else.",
            "Finally, I zoom out to lifetime use.",
            "Now poke at the weeks yourself.",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.page)

        public_story = "\n".join((self.page, self.script))
        for retired in (
            "The same week can carry a different amount of change.",
            "Additions rise above the baseline",
            "Token accumulation is a trace, not a score.",
            "Cadence is not a productivity score.",
            "Tokens trace retained work, not quality.",
            "The story chooses a few views.",
        ):
            with self.subTest(retired=retired):
                self.assertNotIn(retired, public_story)

    def test_public_token_rhythm_endpoint_is_a_direct_ledger_projection(self) -> None:
        self.assertIn("layout: null", self.token_endpoint)
        self.assertIn("permalink: /assets/data/build-rhythm-token-rhythm.json", self.token_endpoint)
        self.assertIn("{{ site.data.agentic_usage.total.token_rhythm | jsonify }}", self.token_endpoint)
        self.assertNotIn("direct_usage_tracker", self.token_endpoint)
        self.assertNotIn("account", self.token_endpoint.lower())

    def test_persistent_token_chart_reuses_validated_data_and_resizes(self) -> None:
        self.assertIn('const drawTokenRhythm = (group, tokenRows, width, height, colors)', self.script)
        self.assertIn('className: "github-activity-token-cumulative-line"', self.script)
        self.assertIn('className: "github-activity-token-delta-line"', self.script)
        self.assertIn('name: "token-cumulative"', self.script)
        self.assertIn('name: "token-daily-increase"', self.script)
        self.assertIn("new ResizeObserver(scheduleRender).observe(chart)", self.script)
        self.assertIn('rhythmRoot.dataset.state = "ready"', self.script)
        self.assertIn('rhythmRoot.dataset.state = "error"', self.script)

    def test_story_charts_have_visible_scale_anchors(self) -> None:
        self.assertIn('const drawYAxis = (group, { name, ticks, y, left, right, colors', self.script)
        self.assertIn('const spacedLogTicks = (domainMaximum, yForValue, minimumGap = 18)', self.script)
        for axis_name in (
            "story-cadence",
            "story-magnitude",
            "story-complete-commits",
            "story-complete-lines",
            "story-complete-tokens",
        ):
            with self.subTest(axis_name=axis_name):
                self.assertIn(f'"{axis_name}"', self.script)
        self.assertIn('name: `story-bursts-${panel.mode === "log" ? "readable" : "literal"}`', self.script)
        self.assertIn('className: "github-activity-line-tick is-zero"', self.script)

    def test_static_and_reduced_motion_styles_remain_complete(self) -> None:
        self.assertIn('@media (max-width: 820px)', self.style)
        self.assertIn('@media (min-width: 821px) and (max-height: 720px)', self.style)
        self.assertIn('@media (prefers-reduced-motion: reduce)', self.style)
        self.assertIn('.build-rhythm-story-chart', self.style)
        self.assertIn('grid-template-columns: minmax(0, 1.55fr) minmax(20rem, 0.65fr);', self.style)
        self.assertIn('height: clamp(23rem, 35vw, 28rem);', self.style)
        self.assertIn('min-height: calc(100vh - 5.75rem);', self.style)
        self.assertIn('.github-activity-token-evidence .github-activity-table', self.style)
        self.assertIn('.github-activity-token-evidence summary:focus-visible', self.style)
        self.assertIn('min-width: 38rem;', self.style)
        self.assertIn('opacity: 1 !important;', self.style)

    def test_authoritative_explorer_contract_stays_present(self) -> None:
        frozen_page_selectors = (
            'data-github-activity',
            'data-codex-usage',
            'data-codex-lifetime',
            'id="github-activity-chart"',
            'id="github-activity-selected-commits"',
            'id="github-activity-selected-additions"',
            'id="github-activity-selected-deletions"',
            'id="github-activity-table-scroll-hint"',
            'id="github-activity-table-body"',
            'id="github-activity-data"',
            'id="build-rhythm-token-data"',
        )
        for selector in frozen_page_selectors:
            with self.subTest(selector=selector):
                self.assertIn(selector, self.page)
        self.assertIn('class: "github-activity-commit-line"', self.script)
        self.assertIn('class: "github-activity-add-line"', self.script)
        self.assertIn('class: "github-activity-remove-line"', self.script)

    def test_lifetime_snapshot_is_one_separate_line_inside_the_explorer(self) -> None:
        self.assertEqual(self.page.count("data-codex-usage"), 1)
        self.assertNotIn("github-activity-codex-trend", self.page)
        self.assertNotIn("Combined lifetime Codex tokens", self.page)
        self.assertNotIn("One public checkpoint", self.page)
        self.assertLess(
            self.page.index('class="github-activity-readout"'),
            self.page.index('class="github-activity-lifetime-inline"'),
        )
        self.assertLess(
            self.page.index('class="github-activity-lifetime-inline"'),
            self.page.index('data-jump-latest'),
        )
        self.assertIn('aria-label="Separate lifetime Codex snapshot"', self.page)
        self.assertIn('aria-describedby="github-activity-lifetime-status"', self.page)
        self.assertIn('data-codex-lifetime data-format="readable"', self.page)
        self.assertIn("initCodexUsageSnapshot(() => scale)", self.script)
        self.assertIn("renderCodexUsageScale(readScale());", self.script)
        self.assertIn("renderCodexUsageScale(scale);", self.script)
        self.assertIn('lifetime.dataset.format = literal ? "literal" : "readable";', self.script)
        self.assertIn('`${number.format(source.combined_lifetime.token_count)} tokens`', self.script)

    def test_lifetime_cost_replay_is_schema4_sanitized_and_caveated(self) -> None:
        self.assertIn('class="github-activity-lifetime-cost" data-codex-cost hidden', self.page)
        self.assertIn(
            "rough API-rate replay at this site's current blended rate; not an actual bill.",
            self.page,
        )
        self.assertIn('data-codex-cost-value', self.page)
        self.assertIn('candidate?.schema === 3 && exactKeys(candidate, requiredKeys)', self.script)
        self.assertIn('candidate?.schema === 4 && exactKeys(candidate, [...requiredKeys, "cost"])', self.script)
        self.assertIn('candidate.method !== "flat_reference_rate_replay"', self.script)
        self.assertIn(
            'candidate.reference_scope !== "current_site_build_blended_public_api_rate"',
            self.script,
        )
        self.assertIn("candidate.usd_midpoint !== roundedReplay", self.script)
        self.assertIn("cost.hidden = true;", self.script)
        self.assertNotIn("site.data.agentic_usage.total.api_cost_equivalence", self.page)

    def test_case_study_and_reproduction_match_all_three_sources(self) -> None:
        for phrase in (
            "rounded lifetime Codex snapshot",
            "Lifetime checkpoint",
            "7e224db12",
            "Three signals, never one score",
            "Deduplicated retained logs attributed to this repo",
            "Differences between adjacent points are rounded increases",
            "6edea07f4",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.case_study)

        for phrase in (
            "rounded lifetime total",
            "Never add it to the repo-scoped retained-session estimate",
            "rounded, anonymous, and separate from the repo estimate",
            "missing observation must never render as a false zero",
            "The exact point keys are `date`, `token_count`, and `tokens_label`",
            "three separate clocks",
            "server-rendered daily token summary and table",
            "Differences between adjacent rounded points are rounded increases, not exact daily usage.",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.reproduction)

        self.assertIn("A dated lifetime total is one snapshot, not a trend", self.heuristics)
        self.assertIn("name both the rate basis and that it is not an actual bill", self.heuristics)
        self.assertIn("`total.token_rhythm` reprojects those same deduplicated repo events", self.ledger_doc)
        self.assertIn("each point contains only `date`, `token_count`, and `tokens_label`", self.ledger_doc)

        for stale_phrase in (
            "dated 30-day Codex snapshot",
            "shorter clock of recent Codex use",
            "Keep tool-use tokens on their own truthful horizon",
            "two-measure data boundary",
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
        for retired in ("per-account", "gmail", "ucsd email"):
            with self.subTest(retired=retired):
                self.assertNotIn(retired, self.page.lower())
        self.assertIn("LIFETIME CODEX SNAPSHOT", self.page)
        self.assertIn("Observed", self.page)
        self.assertNotIn("automatic refresh pending", self.page)

    def test_automated_lifetime_snapshot_accepts_only_the_canonical_confidence(self) -> None:
        self.assertIn('candidate.confidence === "high"', self.script)
        self.assertNotIn(
            '["high", "direct", "complete", "direct complete observation"]',
            self.script,
        )

    def test_build_rhythm_visual_contract_runs_in_the_public_site_matrix(self) -> None:
        spec = "build-rhythm-story.spec.js"
        self.assertIn(spec, self.package)
        self.assertIn(spec, self.public_visual_config)
        self.assertIn('id: "project-build-rhythm"', self.public_routes)
        self.assertIn('path: "/projects/build-rhythm/"', self.public_routes)


if __name__ == "__main__":
    unittest.main()
