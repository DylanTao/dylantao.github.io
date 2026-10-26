from __future__ import annotations

import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = REPO_ROOT / "assets" / "js" / "liquid-glass.js"
NAVBAR = REPO_ROOT / "_sass" / "_navbar.scss"
SCRIPTS_INCLUDE = REPO_ROOT / "_includes" / "scripts.liquid"


class LiquidGlassTests(unittest.TestCase):
    """The blog lens remains optional; the header preserves an undistorted reading edge."""

    def test_script_loads_on_every_page(self) -> None:
        self.assertIn("/assets/js/liquid-glass.js", SCRIPTS_INCLUDE.read_text(encoding="utf-8"))

    def test_only_engines_that_draw_it_get_it(self) -> None:
        source = SCRIPT.read_text(encoding="utf-8")
        # Firefox and Safari parse backdrop-filter: url(...) but draw nothing.
        self.assertIn('entry.brand === "Chromium"', source)
        for query in ("prefers-reduced-transparency: reduce", "prefers-contrast: more", "forced-colors: active"):
            with self.subTest(query=query):
                self.assertIn(query, source)
        # PurgeCSS keeps the attribute selector only when its literal name appears in a script.
        self.assertIn('setAttribute("data-liquid-glass", "")', source)

    def test_header_keeps_frosted_glass_without_a_refracting_reading_edge(self) -> None:
        styles = NAVBAR.read_text(encoding="utf-8")
        self.assertIn("backdrop-filter: blur(var(--md-lite-glass-blur))", styles)
        self.assertIn(".liquid-glass-defs", styles)
        self.assertNotIn("liquid-glass-lip", styles)
        self.assertNotIn("feDisplacementMap", SCRIPT.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
