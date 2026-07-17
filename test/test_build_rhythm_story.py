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
            self.page.index('data-codex-usage'),
        )
        self.assertLess(
            self.page.index('data-build-rhythm-story'),
            self.page.index('class="github-activity-workbench"'),
        )

    def test_story_credit_and_origin_route_are_explicit(self) -> None:
        self.assertIn("https://rhythm-of-food.net/", self.page)
        self.assertIn("Google News Lab", self.page)
        self.assertIn("Truth &amp; Beauty", self.page)
        self.assertIn("https://jrthomp.com/", self.page)
        self.assertIn("John Thompson", self.page)
        self.assertIn('href="/projects/build-rhythm/"', self.page)
        self.assertIn('label="Want to learn this widget\'s origin?"', self.page)
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
        self.assertIn("Token accumulation is a trace, not a score.", self.page)
        self.assertIn('id="github-activity-token-table-body"', self.page)
        self.assertIn("These server-rendered points remain available without JavaScript.", self.page)
        self.assertIn("largest rounded adjacent-point increase", self.page)
        self.assertIn('candidate.method !== "deduplicated_repo_retained_logs"', self.script)
        self.assertIn('candidate.units !== "estimated tokens"', self.script)
        self.assertIn("Number.isSafeInteger(point.token_count)", self.script)
        self.assertIn('root.dataset.tokenState = tokenSource ? "ready" : "error"', self.script)
        self.assertIn("Tokens trace retained work, not quality.", self.script)
        self.assertNotIn("account_lifetime", self.page)

    def test_static_and_reduced_motion_styles_remain_complete(self) -> None:
        self.assertIn('@media (max-width: 820px)', self.style)
        self.assertIn('@media (prefers-reduced-motion: reduce)', self.style)
        self.assertIn('.build-rhythm-story-chart', self.style)
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

    def test_case_study_and_reproduction_match_all_three_sources(self) -> None:
        for phrase in (
            "rounded lifetime Codex checkpoint",
            "Lifetime checkpoint",
            "7e224db12",
            "Three signals, never one score",
            "deduplicated retained logs attributed to this repo",
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

        self.assertIn("change provenance, not the privacy boundary", self.heuristics)
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
        self.assertIn("Combined lifetime Codex tokens", self.page)
        self.assertIn("automatic refresh pending", self.page)
        self.assertIn("never\nadded to the repo-scoped retained-session estimate", self.page)

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
