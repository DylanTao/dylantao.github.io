from __future__ import annotations

import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PAGE_PATH = REPO_ROOT / "_pages" / "github-activity.md"
SCRIPT_PATH = REPO_ROOT / "assets" / "js" / "github-activity.js"
STYLE_PATH = REPO_ROOT / "_sass" / "_github-activity.scss"


class BuildRhythmStoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.page = PAGE_PATH.read_text(encoding="utf-8")
        cls.script = SCRIPT_PATH.read_text(encoding="utf-8")
        cls.style = STYLE_PATH.read_text(encoding="utf-8")

    def test_story_chapters_are_server_rendered_in_order(self) -> None:
        steps = re.findall(r'data-build-rhythm-step="([a-z-]+)"', self.page)
        self.assertEqual(
            steps,
            ["cadence", "magnitude", "bursts", "codex", "explore"],
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

    def test_static_and_reduced_motion_styles_remain_complete(self) -> None:
        self.assertIn('@media (max-width: 820px)', self.style)
        self.assertIn('@media (prefers-reduced-motion: reduce)', self.style)
        self.assertIn('.build-rhythm-story-chart', self.style)
        self.assertIn('opacity: 1 !important;', self.style)

    def test_authoritative_explorer_contract_stays_present(self) -> None:
        frozen_page_selectors = (
            'data-github-activity',
            'data-codex-usage',
            'id="github-activity-codex-chart"',
            'id="github-activity-chart"',
            'id="github-activity-selected-commits"',
            'id="github-activity-selected-additions"',
            'id="github-activity-selected-deletions"',
            'id="github-activity-table-scroll-hint"',
            'id="github-activity-table-body"',
            'id="github-activity-data"',
        )
        for selector in frozen_page_selectors:
            with self.subTest(selector=selector):
                self.assertIn(selector, self.page)
        self.assertIn('class: "github-activity-commit-line"', self.script)
        self.assertIn('class: "github-activity-add-line"', self.script)
        self.assertIn('class: "github-activity-remove-line"', self.script)


if __name__ == "__main__":
    unittest.main()
