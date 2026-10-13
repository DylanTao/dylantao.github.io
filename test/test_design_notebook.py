from __future__ import annotations

import unittest
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK_PAGE = REPO_ROOT / "_pages" / "design-lab.md"
NOTEBOOK_INCLUDE = REPO_ROOT / "_includes" / "design" / "previews.liquid"


def front_matter(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    _, block, _ = text.split("---", 2)
    return yaml.safe_load(block)


class DesignNotebookTests(unittest.TestCase):
    """The notebook owns its selected work and conversation photograph.

    Commit b022eb4aa removed both from the homepage front matter, which left the notebook's
    "Questions made tangible." section and margin photograph rendering empty.
    """

    def test_notebook_page_declares_its_selected_work(self) -> None:
        work = front_matter(NOTEBOOK_PAGE).get("featured_work") or []
        self.assertGreaterEqual(len(work), 1)
        for item in work:
            with self.subTest(title=item.get("title")):
                for key in ("title", "url", "image", "alt", "image_width", "image_height", "venue", "description"):
                    self.assertTrue(item.get(key), f"featured_work entry is missing {key}")
                self.assertTrue((REPO_ROOT / item["image"].lstrip("/")).is_file(), item["image"])

    def test_notebook_page_declares_its_conversation_photograph(self) -> None:
        photo = front_matter(NOTEBOOK_PAGE).get("origin_photo") or {}
        for key in ("image", "alt", "width", "height", "caption", "date_label"):
            self.assertTrue(photo.get(key), f"origin_photo is missing {key}")
        self.assertTrue((REPO_ROOT / photo["image"].lstrip("/")).is_file(), photo["image"])

    def test_notebook_include_reads_page_data_not_the_homepage(self) -> None:
        source = NOTEBOOK_INCLUDE.read_text(encoding="utf-8")
        self.assertIn("{% for work in page.featured_work %}", source)
        self.assertIn("{% assign origin_photo = page.origin_photo %}", source)
        self.assertNotIn("home.featured_work", source)
        self.assertNotIn("home.thesis.origin.photo", source)


if __name__ == "__main__":
    unittest.main()
