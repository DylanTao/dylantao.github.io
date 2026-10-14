from __future__ import annotations

import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CONTROL = REPO_ROOT / "_includes" / "theme_mode_control.liquid"
THEME = REPO_ROOT / "assets" / "js" / "theme.js"
SUN_ARC = REPO_ROOT / "assets" / "js" / "sun-arc.mjs"
SCRIPTS = REPO_ROOT / "_includes" / "scripts.liquid"
STYLES = REPO_ROOT / "_sass" / "_sun-arc.scss"
HOME = REPO_ROOT / "assets" / "js" / "home.js"
FOOTER = REPO_ROOT / "assets" / "js" / "footer-coast" / "scene.mjs"
PALETTE = REPO_ROOT / "_includes" / "search_data.liquid.js"


class SunArcTests(unittest.TestCase):
    """The sun-arc time-of-day control and sitewide Pause motion (2026-10-13)."""

    def test_panel_keeps_the_four_stops_beside_the_slider(self) -> None:
        markup = CONTROL.read_text(encoding="utf-8")
        self.assertIn('role="slider"', markup)
        self.assertIn('aria-valuemax="1439"', markup)
        for mode in ("morning", "noon", "afternoon", "evening"):
            with self.subTest(mode=mode):
                self.assertIn(f'data-theme-mode-option="{mode}"', markup)
        self.assertIn('role="listbox"', markup)
        self.assertIn("data-sun-now", markup)
        self.assertIn('role="switch"', markup)
        self.assertIn("data-motion-toggle", markup)

    def test_pause_motion_installs_before_anything_asks(self) -> None:
        source = THEME.read_text(encoding="utf-8")
        shim = source.index("window.matchMedia = (media) =>")
        self.assertLess(shim, source.index("const themeModes"))
        self.assertIn("prefers-reduced-motion", source[:shim])
        self.assertIn('setAttribute("data-motion", "paused")', source)
        self.assertIn("siteMotionChange", source)
        self.assertIn("window.siteMotion = api", source)

    def test_only_the_arc_sets_a_preview_hour(self) -> None:
        source = SUN_ARC.read_text(encoding="utf-8")
        self.assertIn('"siteTimeChange"', source)
        # A theme chosen elsewhere moves the sun but is not a preview hour for the 3D home.
        handler = source[source.index('window.addEventListener("siteThemeChange"') :]
        self.assertNotIn("setPreview(", handler[: handler.index("});")])
        self.assertIn("/assets/js/sun-arc.mjs", SCRIPTS.read_text(encoding="utf-8"))

    def test_scene_coast_and_palette_listen(self) -> None:
        home = HOME.read_text(encoding="utf-8")
        self.assertIn("siteTimeChange", home)
        self.assertIn("controller.setTimePreview(", home)
        self.assertIn("controller.returnToNow()", home)
        footer = FOOTER.read_text(encoding="utf-8")
        self.assertIn("themeAtMinute(preview)", footer)
        self.assertIn('window.removeEventListener("siteTimeChange", syncTheme)', footer)
        self.assertIn('id: "do-motion"', PALETTE.read_text(encoding="utf-8"))

    def test_sky_glow_and_css_pause(self) -> None:
        styles = STYLES.read_text(encoding="utf-8")
        self.assertRegex(styles, r"radial-gradient\(circle at var\(--site-sun-x\)")
        self.assertIn("var(--global-page-wash)", styles)
        self.assertIn('html[data-motion="paused"]', styles)
        self.assertIn("animation-play-state: paused", styles)
        self.assertIsNotNone(re.search(r"@media \(forced-colors: active\)", styles))


if __name__ == "__main__":
    unittest.main()
