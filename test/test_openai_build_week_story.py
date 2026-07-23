from __future__ import annotations

import re
import unittest
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
PROJECT = REPO_ROOT / "_projects" / "openai-build-week.md"
README = REPO_ROOT / "README.md"
SCRIPT = REPO_ROOT / "assets" / "js" / "openai-build-week.js"
STYLES = REPO_ROOT / "_sass" / "_openai-build-week.scss"
DEMO_URL = "https://youtu.be/9js8vU6cth4"


class OpenAIBuildWeekStoryTests(unittest.TestCase):
    def test_story_draws_a_truthful_eligibility_boundary(self) -> None:
        source = PROJECT.read_text(encoding="utf-8")

        for phrase in (
            "July 13 · 9:00 AM PT",
            "Everything gray was already here",
            "asks judges to evaluate only the extension",
            "The original workbench began on July 11",
            "Six interactions predated Build Week; Paper Constellation was new",
            "it did not create the reciprocal room",
            "An inspectable method is not a measured learning outcome",
            "0 runtime AI calls",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, source)

        cutoff = source.index("July 13 · 9:00 AM PT")
        extension = source.index('id="build-week-extension"')
        self.assertLess(cutoff, extension)

    def test_story_has_six_semantic_chapters_and_seven_receipts(self) -> None:
        source = PROJECT.read_text(encoding="utf-8")
        self.assertEqual(source.count('data-build-week-step="'), 6)
        self.assertEqual(source.count('class="build-week-story-step"'), 6)
        self.assertEqual(source.count('class="build-week-plot-chapter'), 5)

        receipts_match = re.search(
            r'<ul class="build-week-receipts".*?</ul>', source, flags=re.DOTALL
        )
        self.assertIsNotNone(receipts_match)
        self.assertEqual(receipts_match.group(0).count("<li>"), 7)
        self.assertIn("six pre-existing interactions gained project pages alongside the new Paper Constellation", source)

        for chapter in (
            "boundary",
            "machine",
            "rhythm",
            "constellation",
            "artifacts",
            "evidence",
        ):
            with self.subTest(chapter=chapter):
                self.assertEqual(source.count(f'data-build-week-step="{chapter}"'), 1)

    def test_codex_provenance_does_not_replace_human_judgment(self) -> None:
        source = PROJECT.read_text(encoding="utf-8")
        for phrase in (
            "Codex + GPT-5.6 accelerated",
            "Human critique decided",
            "Codex accelerated bounded implementation passes",
            "GPT-5.6 did not discover the research lineage",
            "The model label records provenance, not isolated causality",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "This page documents a workflow, not a learning study",
            "they do not promise ranking or model inclusion",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, source)

        for overclaim in (
            "model fine-tuning",
            "measured student-learning gains",
            "GPT-5.6 discovered the research lineage",
            "commits prove quality",
        ):
            with self.subTest(overclaim=overclaim):
                self.assertNotIn(overclaim, source.lower())

    def test_progressive_enhancement_and_reduced_motion_keep_the_story_readable(self) -> None:
        script = SCRIPT.read_text(encoding="utf-8")
        styles = STYLES.read_text(encoding="utf-8")

        for phrase in (
            'root.dataset.state = "ready"',
            'root.dataset.activeChapter = "all"',
            '"IntersectionObserver" in window',
            'new URLSearchParams(window.location.search).get("demo") === "1"',
            'openai-build-week-demo-complete',
        ):
            with self.subTest(script_phrase=phrase):
                self.assertIn(phrase, script)

        self.assertIn("@media (prefers-reduced-motion: reduce)", styles)
        self.assertIn("@media (max-width: 620px)", styles)
        self.assertIn("position: sticky", styles)
        self.assertNotIn("preventDefault", script)

    def test_project_card_and_teaser_metadata_are_complete(self) -> None:
        cards = yaml.safe_load((REPO_ROOT / "_data" / "project_cards.yml").read_text(encoding="utf-8"))
        card = cards["openai-build-week"]
        self.assertEqual(card["icon"], "archive")
        self.assertGreater(len(card["origin_line"]), 30)
        self.assertGreater(len(card["evolution_line"]), 30)

        teaser = REPO_ROOT / "assets" / "img" / "project_pics" / "openai-build-week" / "openai-build-week-extension.svg"
        self.assertTrue(teaser.is_file())
        teaser_source = teaser.read_text(encoding="utf-8")
        self.assertIn('width="1200"', teaser_source)
        self.assertIn('height="800"', teaser_source)
        self.assertNotIn("OpenAI logo", teaser_source)

    def test_public_demo_and_submission_readme_are_linked(self) -> None:
        project = PROJECT.read_text(encoding="utf-8")
        readme = README.read_text(encoding="utf-8")

        self.assertIn(DEMO_URL, project)
        self.assertIn("Watch the 2:45 demo", project)
        self.assertIn(DEMO_URL, readme)
        self.assertIn("OpenAI Build Week 2026: Scaffolding for Taste", readme)
        self.assertIn("How Codex and GPT-5.6 were used", readme)
        self.assertIn("Eligibility boundary", readme)


if __name__ == "__main__":
    unittest.main()
