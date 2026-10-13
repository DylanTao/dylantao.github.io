from __future__ import annotations

import re
import unittest
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
BIBLIOGRAPHY = REPO_ROOT / "_bibliography" / "papers.bib"
HOMEPAGE = REPO_ROOT / "_pages" / "about.md"
HOME_PUBLICATIONS = REPO_ROOT / "_includes" / "home" / "news_publications.liquid"
PROJECTS_DIR = REPO_ROOT / "_projects"


def front_matter(path: Path) -> dict:
    _, block, _ = path.read_text(encoding="utf-8").split("---", 2)
    return yaml.safe_load(block)


def selected_bibliography_keys() -> set[str]:
    text = BIBLIOGRAPHY.read_text(encoding="utf-8")
    keys = set()
    for match in re.finditer(r"@\w+\{([^,]+),(.*?)\n\}", text, flags=re.S):
        if re.search(r"selected\s*=\s*\{true\}", match.group(2)):
            keys.add(match.group(1).strip())
    return keys


class SelectedPaperOrderTests(unittest.TestCase):
    """DesignWeaver leads the homepage papers and the research projects (Sirui, 2026-10-12).

    The homepage lists selected papers in an explicit order instead of bibliography-file order,
    and the order must stay in sync with the bibliography's selected flags.
    """

    def test_homepage_order_matches_the_selected_bibliography_entries(self) -> None:
        order = front_matter(HOMEPAGE).get("selected_paper_order") or []
        self.assertEqual(len(order), len(set(order)), "selected_paper_order repeats a key")
        self.assertEqual(set(order), selected_bibliography_keys())
        self.assertEqual(order[0], "tao2024designweaver")

    def test_homepage_renders_selected_papers_in_the_declared_order(self) -> None:
        source = HOME_PUBLICATIONS.read_text(encoding="utf-8")
        self.assertRegex(source, r"\{%-?\s*for key in page\.selected_paper_order\s*-?%\}\s*\{%-?\s*nocite key\s*-?%\}\s*\{%-?\s*endfor\s*-?%\}")
        self.assertIn("{% bibliography --group_by none --cited_in_order %}", source)

    def test_designweaver_leads_the_research_projects(self) -> None:
        research = {}
        for path in PROJECTS_DIR.glob("*.md"):
            data = front_matter(path)
            if data.get("category") == "research":
                research[path.stem] = data.get("importance")
        self.assertIn("designweaver", research)
        self.assertEqual(min(research, key=lambda slug: research[slug]), "designweaver")


if __name__ == "__main__":
    unittest.main()
