from __future__ import annotations

import re
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
THEMES_PATH = REPO_ROOT / "_sass" / "_themes.scss"
NAVBAR_PATH = REPO_ROOT / "_sass" / "_navbar.scss"
MATERIAL_PATH = REPO_ROOT / "_sass" / "_material-lite.scss"
BLOG_PATH = REPO_ROOT / "_sass" / "_blog.scss"
PUBLICATIONS_PATH = REPO_ROOT / "_sass" / "_publications.scss"
HOME_SCRIPT_PATH = REPO_ROOT / "assets" / "js" / "home.js"
PROJECT_CARDS_PATH = REPO_ROOT / "_data" / "project_cards.yml"


EXPECTED_ANCHORS = {
    "morning": {"bg": "#fff9f4", "text": "#29221f", "primary": "#c24614"},
    "noon": {"bg": "#fffefa", "text": "#252321", "primary": "#bf470f"},
    "afternoon": {"bg": "#fffaf6", "text": "#292522", "primary": "#c64b0d"},
    "evening": {"bg": "#111c22", "text": "#f8f3ec", "primary": "#ff9a3d"},
}


def relative_luminance(hex_color: str) -> float:
    channels = [int(hex_color[index : index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast_ratio(first: str, second: str) -> float:
    lighter, darker = sorted((relative_luminance(first), relative_luminance(second)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def mix_hex(foreground: str, background: str, foreground_weight: float) -> str:
    foreground_channels = [int(foreground[index : index + 2], 16) for index in (1, 3, 5)]
    background_channels = [int(background[index : index + 2], 16) for index in (1, 3, 5)]
    channels = [round(front * foreground_weight + back * (1 - foreground_weight)) for front, back in zip(foreground_channels, background_channels)]
    return "#" + "".join(f"{channel:02x}" for channel in channels)


class CoastalThemePaletteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.themes = THEMES_PATH.read_text(encoding="utf-8")

    def mode_declarations(self, mode: str) -> str:
        if mode == "evening":
            start_marker = 'html[data-theme="dark"],\nhtml[data-theme-mode="evening"] {'
            end_marker = "\n  .only-light"
        else:
            start_marker = f'html[data-theme-mode="{mode}"] {{'
            end_marker = "\n}"
        start = self.themes.index(start_marker) + len(start_marker)
        end = self.themes.index(end_marker, start)
        return self.themes[start:end]

    @staticmethod
    def token(declarations: str, name: str) -> str:
        match = re.search(rf"--{re.escape(name)}:\s*([^;]+);", declarations)
        if not match:
            raise AssertionError(f"Missing --{name}")
        return match.group(1).strip().lower()

    def test_four_modes_keep_the_exact_coastal_anchor_palette(self) -> None:
        for mode, expected in EXPECTED_ANCHORS.items():
            declarations = self.mode_declarations(mode)
            with self.subTest(mode=mode):
                self.assertEqual(self.token(declarations, "global-bg-color"), expected["bg"])
                self.assertEqual(self.token(declarations, "global-text-color"), expected["text"])
                self.assertEqual(self.token(declarations, "global-primary-color"), expected["primary"])
                self.assertIn("--global-nav-bg-color:", declarations)
                self.assertIn("--global-shadow-rgb:", declarations)
                self.assertIn("--global-primary-hover-color:", declarations)
                self.assertIn("--global-primary-container-color:", declarations)
                self.assertIn("--global-on-primary-container-color:", declarations)
                self.assertIn("--global-mint-strong:", declarations)
                self.assertIn("--global-sky-strong:", declarations)
                self.assertIn("--global-footer-bg-color:", declarations)

    def test_theme_text_actions_and_secondary_ink_clear_contrast_thresholds(self) -> None:
        for mode, anchors in EXPECTED_ANCHORS.items():
            declarations = self.mode_declarations(mode)
            muted = self.token(declarations, "global-text-color-light")
            hover = self.token(declarations, "global-primary-hover-color")
            on_primary = self.token(declarations, "global-on-primary-color")
            primary_container = self.token(declarations, "global-primary-container-color")
            on_primary_container = self.token(declarations, "global-on-primary-container-color")
            surface_container = self.token(declarations, "global-surface-container-color")
            mint = self.token(declarations, "global-mint-strong")
            sky = self.token(declarations, "global-sky-strong")
            footer_bg = self.token(declarations, "global-footer-bg-color")
            footer_text = self.token(declarations, "global-footer-text-color")
            footer_link = self.token(declarations, "global-footer-link-color")
            focus = mix_hex(anchors["primary"], anchors["text"], 0.78)
            with self.subTest(mode=mode):
                self.assertGreaterEqual(contrast_ratio(anchors["text"], anchors["bg"]), 7.0)
                self.assertGreaterEqual(contrast_ratio(muted, anchors["bg"]), 4.5)
                self.assertGreaterEqual(contrast_ratio(anchors["primary"], anchors["bg"]), 4.5)
                self.assertGreaterEqual(contrast_ratio(hover, anchors["bg"]), 4.5)
                self.assertGreaterEqual(contrast_ratio(on_primary, anchors["primary"]), 4.5)
                self.assertGreaterEqual(contrast_ratio(on_primary_container, primary_container), 4.5)
                self.assertGreaterEqual(contrast_ratio(anchors["text"], surface_container), 7.0)
                self.assertGreaterEqual(contrast_ratio(mint, anchors["bg"]), 4.5)
                self.assertGreaterEqual(contrast_ratio(sky, anchors["bg"]), 4.5)
                self.assertGreaterEqual(contrast_ratio(footer_text, footer_bg), 4.5)
                self.assertGreaterEqual(contrast_ratio(footer_link, footer_bg), 4.5)
                self.assertGreaterEqual(contrast_ratio(focus, anchors["bg"]), 3.0)
                if mode != "evening":
                    self.assertGreaterEqual(contrast_ratio(mint, self.token(declarations, "global-mint-soft")), 4.0)
                    self.assertGreaterEqual(contrast_ratio(sky, self.token(declarations, "global-sky-soft")), 4.0)

    def test_global_chrome_uses_theme_owned_nav_shadow_and_focus_roles(self) -> None:
        navbar = NAVBAR_PATH.read_text(encoding="utf-8")
        material = MATERIAL_PATH.read_text(encoding="utf-8")
        self.assertIn("background-color: var(--global-nav-bg-color);", navbar)
        self.assertNotIn("background-color: rgba(255, 250, 246, 0.82);", navbar)
        self.assertIn("rgba(var(--global-shadow-rgb)", material)
        self.assertIn("--md-lite-focus-color: color-mix(in srgb, var(--global-primary-color) 78%, var(--global-text-color));", material)
        self.assertIn("--md-lite-focus-ring: 2px solid var(--md-lite-focus-color);", material)

        blog = BLOG_PATH.read_text(encoding="utf-8")
        self.assertIn("box-shadow: 0 0.45rem 1.25rem var(--global-shadow-color);", blog)
        self.assertIn("box-shadow: 0 0.65rem 1.6rem var(--global-shadow-color);", blog)
        self.assertNotIn("box-shadow: 0 0.45rem 1.25rem rgba(0, 0, 0, 0.08);", blog)
        self.assertNotIn("box-shadow: 0 0.65rem 1.6rem rgba(32, 25, 22, 0.08);", blog)

    def test_desk_palette_has_four_static_modes_without_scene_geometry_changes(self) -> None:
        home_script = HOME_SCRIPT_PATH.read_text(encoding="utf-8")
        palette_start = home_script.index("    const readDeskPalette = () => {")
        palette_end = home_script.index("\n    const projectObjectBounds", palette_start)
        palette_source = home_script[palette_start:palette_end]
        for mode in EXPECTED_ANCHORS:
            self.assertIn(f"        {mode}: {{", palette_source)
        self.assertIn('new Set(["morning", "noon", "afternoon", "evening"])', palette_source)
        self.assertIn("floor: 0xf5dfd2", palette_source)
        self.assertIn("floor: 0xeaf1ec", palette_source)
        self.assertIn("const deskPaletteSignature", palette_source)
        self.assertIn("container.dataset.scenePaletteSettled = palette.mode", palette_source)
        self.assertIn("container.dataset.scenePaletteSignature = deskPaletteSignature(palette)", palette_source)
        for geometry_or_state_term in (
            "defaultCamera",
            "orbitTarget",
            "roomBlueprint",
            "camera.position",
            "rootGroup.position",
            "setSceneView",
            "activeView =",
            "focusedEntry =",
        ):
            self.assertNotIn(geometry_or_state_term, palette_source)

        apply_start = home_script.index("    const applyDeskPalette = () => {")
        apply_end = home_script.index("\n    const resize = () => {", apply_start)
        apply_source = home_script[apply_start:apply_end]
        self.assertLess(apply_source.index("markDeskPalettePending(palette)"), apply_source.index("themeMaterials.floor"))
        self.assertLess(apply_source.rindex("render();"), apply_source.index("markDeskPaletteSettled(palette)"))

    def test_constellation_information_strokes_clear_three_to_one_after_compositing(self) -> None:
        publications = PUBLICATIONS_PATH.read_text(encoding="utf-8")
        self.assertIn("--constellation-information-stroke: var(--global-text-color-light);", publications)
        self.assertIn("--constellation-information-opacity: 0.9;", publications)
        self.assertIn("stroke: var(--constellation-information-stroke);", publications)
        self.assertNotIn("stroke: color-mix(in srgb, var(--global-text-color-light) 35%, transparent);", publications)
        self.assertNotIn("stroke: color-mix(in srgb, var(--global-text-color-light) 48%, transparent);", publications)

        for mode, anchors in EXPECTED_ANCHORS.items():
            declarations = self.mode_declarations(mode)
            card = self.token(declarations, "global-card-bg-color")
            information_colors = {
                "design": anchors["primary"],
                "evaluate": self.token(declarations, "global-sky-strong"),
                "situate": self.token(declarations, "global-mint-strong"),
                "edge-membership": self.token(declarations, "global-text-color-light"),
            }
            for role, color in information_colors.items():
                for surface in (anchors["bg"], card):
                    composited = mix_hex(color, surface, 0.9)
                    with self.subTest(mode=mode, role=role, surface=surface):
                        self.assertGreaterEqual(contrast_ratio(composited, surface), 3.0)

    def test_named_project_identity_accents_remain_intact(self) -> None:
        cards = PROJECT_CARDS_PATH.read_text(encoding="utf-8")
        for slug, expected_accents in {
            "hotspot": {"morning": "#efbca7", "noon": "#b5b7e3", "afternoon": "#9181b0", "evening": "#cecfea"},
            "designweaver": {"morning": "#e7837d", "noon": "#2765d6", "afternoon": "#f5b0ab", "evening": "#cce8ef"},
            "hci-spooder-man": {"morning": "#d7675b", "noon": "#2f75a8", "afternoon": "#d9a15f", "evening": "#d7e3ed"},
        }.items():
            start = cards.index(f"{slug}:")
            next_entry = re.search(r"\n(?=[a-z0-9-]+:\n)", cards[start + 1 :])
            end = start + 1 + next_entry.start() if next_entry else len(cards)
            block = cards[start:end]
            for mode, accent in expected_accents.items():
                self.assertIn(f'    {mode}: "{accent}"', block)

        accent_blocks = re.findall(r"(?m)^  accents:\n((?:    (?:morning|noon|afternoon|evening): \"#[0-9a-f]{6}\"\n){4})", cards)
        self.assertGreaterEqual(len(accent_blocks), 10)
        for block in accent_blocks:
            self.assertEqual(set(re.findall(r"(?m)^    (morning|noon|afternoon|evening):", block)), set(EXPECTED_ANCHORS))


if __name__ == "__main__":
    unittest.main()
