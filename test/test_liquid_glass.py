from __future__ import annotations

import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = REPO_ROOT / "assets" / "js" / "liquid-glass.js"
NAVBAR = REPO_ROOT / "_sass" / "_navbar.scss"
TRANSITIONS = REPO_ROOT / "_sass" / "_transitions.scss"
SCRIPTS_INCLUDE = REPO_ROOT / "_includes" / "scripts.liquid"


class LiquidGlassTests(unittest.TestCase):
    """The navbar's glass lip (2026-10-13) is a Chromium-only enhancement over the frosted bar."""

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

    def test_lip_sits_outside_the_backdrop_root(self) -> None:
        # The bar keeps a view-transition-name, which makes it a backdrop root: a refracting child
        # would only see the bar. The lip therefore belongs to the header and anchors to the bar.
        self.assertRegex(TRANSITIONS.read_text(encoding="utf-8"), r"view-transition-name:\s*site-navbar")
        styles = NAVBAR.read_text(encoding="utf-8")
        block = styles[styles.index("@supports (anchor-name: --site-navbar)") :]
        self.assertIn("header#top::after", block)
        self.assertIn('backdrop-filter: url("#liquid-glass-lip")', block)
        self.assertIn("pointer-events: none", block)
        self.assertNotRegex(styles, r"\.navbar\s*\{[^}]*backdrop-filter:\s*none")
        self.assertIsNone(re.search(r"\.navbar::(before|after)", styles))


if __name__ == "__main__":
    unittest.main()
