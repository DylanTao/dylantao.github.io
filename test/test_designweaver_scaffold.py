from __future__ import annotations

import unittest
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA = REPO_ROOT / "_data" / "designweaver_scaffold.yml"
PAGE = REPO_ROOT / "_projects" / "designweaver.md"
SCRIPT = REPO_ROOT / "assets" / "js" / "designweaver-scaffold.mjs"


class DesignWeaverScaffoldTests(unittest.TestCase):
    """The case page's "Try it" palette (2026-10-13) stays faithful to the study session it shows."""

    def setUp(self) -> None:
        self.data = yaml.safe_load(DATA.read_text(encoding="utf-8"))

    def test_session_palette_matches_the_talk(self) -> None:
        # Slide 11 of the CHI 2025 talk: four dimensions, seven selected tags, and the system's prompt.
        dimensions = {d["name"]: d["tags"] for d in self.data["dimensions"]}
        self.assertEqual(list(dimensions), ["Aesthetic", "Sustainability", "Functionality", "Color"])
        selected = [t["label"] for tags in dimensions.values() for t in tags if t.get("selected")]
        self.assertEqual(selected, ["Neutral", "Clean Lines", "Minimalist Scandinavian", "Durable", "Ergonomic", "Lightweight", "Soft Lavender"])
        self.assertTrue(self.data["session_prompt"].startswith("This design features a neutral aesthetic with clean lines"))
        for tags in dimensions.values():
            for tag in tags:
                with self.subTest(tag=tag["label"]):
                    self.assertIn(tag["form"], {"before", "with", "in"})
                    self.assertTrue(tag["phrase"])

    def test_page_says_what_is_real_and_what_is_a_sketch(self) -> None:
        page = PAGE.read_text(encoding="utf-8")
        self.assertIn("data-dw-scaffold", page)
        self.assertIn("{{ scaffold.session_prompt }}", page)
        self.assertIn("writes each prompt with a language model", page)
        self.assertIn("generates no images", page)
        # Without the script the palette shows the session's selection but cannot be changed.
        self.assertIn("disabled", page[page.index("data-dw-tag") : page.index("</button>")])

    def test_script_stays_local(self) -> None:
        source = SCRIPT.read_text(encoding="utf-8")
        for call in ("fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "innerHTML"):
            with self.subTest(call=call):
                self.assertNotIn(call, source)
        self.assertIn('setAttribute("aria-pressed"', source)


if __name__ == "__main__":
    unittest.main()
