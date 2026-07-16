from __future__ import annotations

import re
import unittest
from datetime import datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PROJECTS_PAGE = REPO_ROOT / "_pages" / "projects.md"
PROJECTS_DIR = REPO_ROOT / "_projects"
GUIDES_DIR = REPO_ROOT / "assets" / "downloads" / "site-experiments"

EXPECTED_CHRONOLOGY = [
    ("paper-constellation", "Paper Constellation"),
    ("build-rhythm", "Build Rhythm"),
    ("homepage-desk-scene", "The Desk That Learned Depth"),
    ("hci-spooder-man", "HCI Spooder-Man"),
    ("scholar-lens", "Scholar Lens"),
    ("wall-of-rejection", "Wall of Rejection"),
    ("ikea-project-cards", "The IKEA Card Experiment"),
    ("website-revamp", "Vibe-Coding a Research Portfolio"),
    ("dogtor-portal", "Dogtor's Hidden Portal"),
]

REPRODUCTION_GUIDES = [
    "paper-constellation-reproduction.md",
    "build-rhythm-reproduction.md",
    "homepage-desk-scene-reproduction.md",
    "dogtor-portal-reproduction.md",
    "scholar-lens-reproduction.md",
    "wall-of-rejection-reproduction.md",
    "ikea-project-cards-reproduction.md",
]


def frontmatter(path: Path) -> dict[str, str]:
    source = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\s*\n(.*?)\n---", source, flags=re.DOTALL)
    if not match:
        raise AssertionError(f"{path} has no frontmatter")
    values: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line or line.startswith((" ", "\t")):
            continue
        key, value = line.split(":", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


class SiteExperimentsTests(unittest.TestCase):
    def test_site_experiments_have_truthful_chronological_metadata(self) -> None:
        records = []
        for slug, expected_title in EXPECTED_CHRONOLOGY:
            values = frontmatter(PROJECTS_DIR / f"{slug}.md")
            self.assertEqual(values.get("title"), expected_title)
            self.assertEqual(values.get("category"), "fun")
            self.assertEqual(values.get("site_experiment"), "true")
            teaser = values.get("img")
            self.assertTrue(teaser, f"{slug} is missing a project-card teaser")
            self.assertTrue((REPO_ROOT / teaser).is_file(), f"{slug} teaser does not exist: {teaser}")
            debut = datetime.fromisoformat(values["debut_date"])
            records.append((debut, expected_title))

        actual = [title for _, title in sorted(records, reverse=True)]
        self.assertEqual(actual, [title for _, title in EXPECTED_CHRONOLOGY])

    def test_projects_index_groups_experiments_once_and_sorts_by_debut(self) -> None:
        source = PROJECTS_PAGE.read_text(encoding="utf-8")
        rationale = (
            "I keep these site experiments on record so newer models can re-review the last best pass—and I keep only changes that survive "
            "screenshots, accessibility checks, and my own judgment."
        )
        self.assertEqual(source.count(rationale), 1)
        self.assertIn('where: "site_experiment", true | sort: "debut_date" | reverse', source)
        self.assertIn("data-site-experiment-grid", source)
        self.assertIn("Other playful builds", source)
        self.assertEqual(source.count("{% include projects.liquid heading_level=4 %}"), 2)

        card_include = (REPO_ROOT / "_includes" / "projects.liquid").read_text(encoding="utf-8")
        self.assertIn("{% if include.heading_level == 4 %}", card_include)
        self.assertIn('<h4 class="card-title">{{ project.title }}</h4>', card_include)

    def test_reproduction_guides_and_case_study_routes_exist(self) -> None:
        for filename in REPRODUCTION_GUIDES:
            with self.subTest(filename=filename):
                guide = GUIDES_DIR / filename
                self.assertTrue(guide.is_file(), f"missing {guide}")
                self.assertGreater(len(guide.read_text(encoding="utf-8")), 500)

    def test_build_rhythm_credit_preserves_the_source_session(self) -> None:
        source = (PROJECTS_DIR / "build-rhythm.md").read_text(encoding="utf-8")
        for phrase in (
            "John Thompson",
            "Autodesk HCI internship Wednesday design session",
            "Balancing Performance, Interactivity and Effort: SVG, Canvas, and WebGL",
            "Google News Lab",
            "Truth & Beauty",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, source)

    def test_truthful_teasers_are_tracked_for_newest_visual_experiments(self) -> None:
        for relative_path in (
            "assets/img/project_pics/paper-constellation/paper-constellation-teaser.png",
            "assets/img/project_pics/site-experiments/build-rhythm-stage.png",
            "assets/img/project_pics/site-experiments/homepage-desk-depth.png",
            "assets/img/project_pics/site-experiments/scholar-lens.png",
            "assets/img/project_pics/site-experiments/wall-of-rejection.png",
            "assets/img/project_pics/site-experiments/ikea-card-expanded.png",
        ):
            with self.subTest(relative_path=relative_path):
                path = REPO_ROOT / relative_path
                self.assertTrue(path.is_file(), f"missing {relative_path}")
                self.assertGreater(path.stat().st_size, 20_000)

    def test_widget_origin_routes_are_explicit_and_contextual(self) -> None:
        expectations = {
            "_pages/github-activity.md": "/projects/build-rhythm/",
            "_pages/projects.md": "/projects/ikea-project-cards/",
            "_includes/home/hero.liquid": "/projects/homepage-desk-scene/",
            "_pages/blog.md": "/projects/dogtor-portal/",
            "_includes/publications/paper_constellation.liquid": "/projects/paper-constellation/",
            "_includes/publications/scholar_lens.liquid": "/projects/scholar-lens/",
            "_includes/publications/wall_of_rejection.liquid": "/projects/wall-of-rejection/",
        }
        for relative_path, route in expectations.items():
            with self.subTest(relative_path=relative_path):
                source = (REPO_ROOT / relative_path).read_text(encoding="utf-8")
                self.assertIn(route, source)

        dog_script = (REPO_ROOT / "assets" / "js" / "blog-secret.js").read_text(encoding="utf-8")
        self.assertIn("hasDiscoveredPortal", dog_script)
        self.assertIn("revealOrigin", dog_script)


if __name__ == "__main__":
    unittest.main()
