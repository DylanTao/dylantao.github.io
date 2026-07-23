from __future__ import annotations

import re
import unittest
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
PROJECTS_DIR = REPO_ROOT / "_projects"

PROJECT_OPENINGS = {
    "openai-build-week.md": "A polished homepage can hide the bad passes and judgment behind it.",
    "build-rhythm.md": "Build Rhythm is where I go to see when the work bunches up.",
    "paper-constellation.md": "Paper Constellation is a second way to browse my publications.",
    "homepage-desk-scene.md": "The homepage desk is one set of objects in two views.",
    "scholar-lens.md": "Scholar Lens adds filters and linked highlights to my publications page.",
    "wall-of-rejection.md": "Wall of Rejection began as the Steam-style badge meme",
    "ikea-project-cards.md": "Click a project card and it opens right where it was.",
    "website-revamp.md": "My old site listed projects and papers, but it did not tell visitors what I was actually studying.",
    "dogtor-portal.md": "There is a small dog next to the blog title.",
    "not-a-good-driver.md": "I built a small VRChat world around three ways into one joke",
}


class FunProjectVoiceCoreRewriteTests(unittest.TestCase):
    def project_source(self, filename: str) -> str:
        return (PROJECTS_DIR / filename).read_text(encoding="utf-8")

    def test_openings_name_the_artifact_before_the_process(self) -> None:
        for filename, opening in PROJECT_OPENINGS.items():
            with self.subTest(filename=filename):
                source = self.project_source(filename)
                lede_match = re.search(
                    r'<p class="project-case-lede">\s*(.*?)\s*</p>',
                    source,
                    flags=re.DOTALL,
                )
                self.assertIsNotNone(lede_match)
                lede = re.sub(r"<[^>]+>", "", lede_match.group(1))
                self.assertIn(opening, lede)
                self.assertLessEqual(len(lede.split()), 70)
                self.assertLess(source.index('class="project-case-lede"'), source.index('class="project-case-summary"'))

    def test_summary_answers_why_and_what_before_the_long_story(self) -> None:
        for filename in PROJECT_OPENINGS:
            with self.subTest(filename=filename):
                source = self.project_source(filename)
                summary_start = source.index('class="project-case-summary"')
                story_start = source.index('class="project-story-', summary_start)
                summary = source[summary_start:story_start]
                self.assertIn("<span>Why</span>", summary)
                self.assertIn("<span>What</span>", summary)

    def test_data_backed_spooder_lede_names_the_rejection_and_remix_actions(self) -> None:
        data = yaml.safe_load((REPO_ROOT / "_data" / "spooder_man.yml").read_text(encoding="utf-8"))
        lede = data["hero"]["lede"]
        for phrase in (
            "same paper was rejected twice",
            "Steam-style",
            "browse the art",
            "download the prompt and files",
            "remix their own academic setback",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, lede)

    def test_visible_turning_points_use_project_specific_labels(self) -> None:
        ceremonial_label = re.compile(r'<p class="project-case-kicker">(?:Spark|Turn|Now)</p>')
        for filename in PROJECT_OPENINGS:
            with self.subTest(filename=filename):
                source = self.project_source(filename)
                self.assertIsNone(ceremonial_label.search(source))

        self.assertIn("First version", self.project_source("build-rhythm.md"))
        self.assertIn("First mobile attempt", self.project_source("paper-constellation.md"))
        self.assertIn("Interaction change", self.project_source("scholar-lens.md"))
        self.assertIn("Counting rule", self.project_source("wall-of-rejection.md"))

    def test_retired_meta_phrasing_does_not_return(self) -> None:
        combined = "\n".join(self.project_source(filename) for filename in PROJECT_OPENINGS)
        for phrase in (
            "evidence-backed record",
            "This optional map",
            "contextual emphasis",
            "the emotional unit stayed small",
            "one logical desk in two representations",
            "muddied the scopes",
        ):
            with self.subTest(phrase=phrase):
                self.assertNotIn(phrase, combined)


if __name__ == "__main__":
    unittest.main()
