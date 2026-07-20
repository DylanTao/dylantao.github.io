from __future__ import annotations

import colorsys
import re
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
THEMES_PATH = REPO_ROOT / "_sass" / "_themes.scss"
BRAND_ORANGE_PATH = REPO_ROOT / "_sass" / "_brand-orange.scss"
NAVBAR_PATH = REPO_ROOT / "_sass" / "_navbar.scss"
MATERIAL_PATH = REPO_ROOT / "_sass" / "_material-lite.scss"
BLOG_PATH = REPO_ROOT / "_sass" / "_blog.scss"
PUBLICATIONS_PATH = REPO_ROOT / "_sass" / "_publications.scss"
HOME_SCRIPT_PATH = REPO_ROOT / "assets" / "js" / "home.js"
HOME_STYLE_PATH = REPO_ROOT / "_sass" / "_home.scss"
LAYOUT_PATH = REPO_ROOT / "_sass" / "_layout.scss"
PROJECT_CARDS_PATH = REPO_ROOT / "_data" / "project_cards.yml"


EXPECTED_ANCHORS = {
    "morning": {
        "bg": "#fffaf7",
        "text": "#26282b",
        "primary": "#9c4859",
        "hover": "#74333f",
        "fill": "#dfa0ac",
        "fill_hover": "#e9b3bd",
        "container": "#f7e7e9",
    },
    "noon": {
        "bg": "#fffefa",
        "text": "#23282a",
        "primary": "#3b6a98",
        "hover": "#2c5074",
        "fill": "#9bbde1",
        "fill_hover": "#86acd4",
        "container": "#e7eff8",
    },
    "afternoon": {
        "bg": "#fbfaf7",
        "text": "#283234",
        "primary": "#3d6f73",
        "hover": "#2d5559",
        "fill": "#8ab8b2",
        "fill_hover": "#76aaa3",
        "container": "#f4e8e0",
    },
    "evening": {
        "bg": "#111c22",
        "text": "#f8f3ec",
        "primary": "#b7b2e3",
        "hover": "#d2cef2",
        "fill": "#8d88c7",
        "fill_hover": "#a29dd8",
        "container": "#2b2942",
    },
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


def hue_degrees(hex_color: str) -> float:
    red, green, blue = (int(hex_color[index : index + 2], 16) / 255 for index in (1, 3, 5))
    return colorsys.rgb_to_hsv(red, green, blue)[0] * 360


def circular_hue_distance(first: float, second: float) -> float:
    difference = abs(first - second)
    return min(difference, 360 - difference)


def rgb_distance(first: str, second: str) -> float:
    channels = []
    for index in (1, 3, 5):
        channels.append((int(first[index : index + 2], 16) - int(second[index : index + 2], 16)) / 255)
    return sum(channel**2 for channel in channels) ** 0.5


def composite_page_wash(wash: str, background: str) -> str:
    """Conservatively composite every declared wash stop at full overlap."""
    stops = re.findall(r"rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)", wash)
    composited = background
    # CSS paints the first gradient on top, so composite from the last layer.
    for red, green, blue, alpha in reversed(stops):
        foreground = f"#{int(red):02x}{int(green):02x}{int(blue):02x}"
        composited = mix_hex(foreground, composited, float(alpha))
    return composited


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
                self.assertEqual(self.token(declarations, "global-primary-hover-color"), expected["hover"])
                self.assertEqual(self.token(declarations, "global-primary-fill-color"), expected["fill"])
                self.assertEqual(self.token(declarations, "global-primary-fill-hover-color"), expected["fill_hover"])
                self.assertEqual(self.token(declarations, "global-primary-container-color"), expected["container"])
                self.assertIn("--global-nav-bg-color:", declarations)
                self.assertIn("--global-shadow-rgb:", declarations)
                self.assertIn("--global-on-primary-fill-color:", declarations)
                self.assertIn("--global-on-primary-container-color:", declarations)
                self.assertIn("--global-mint-strong:", declarations)
                self.assertIn("--global-sky-strong:", declarations)
                self.assertIn("--global-footer-bg-color:", declarations)

    def test_root_palette_is_the_noon_palette(self) -> None:
        root_start = self.themes.index(":root {") + len(":root {")
        root_end = self.themes.index("\n  .only-light", root_start)
        root = self.themes[root_start:root_end]
        noon = self.mode_declarations("noon")
        for token in (
            "global-bg-color",
            "global-primary-color",
            "global-primary-hover-color",
            "global-primary-fill-color",
            "global-primary-fill-hover-color",
            "global-primary-container-color",
            "global-accent-rgb",
            "global-page-wash",
        ):
            with self.subTest(token=token):
                self.assertEqual(self.token(root, token), self.token(noon, token))

    def test_time_modes_have_distinct_non_orange_primary_hues(self) -> None:
        hues = {mode: hue_degrees(anchors["primary"]) for mode, anchors in EXPECTED_ANCHORS.items()}
        for mode, hue in hues.items():
            with self.subTest(mode=mode):
                self.assertFalse(15 <= hue <= 55)
        for index, (first_mode, first_hue) in enumerate(hues.items()):
            for second_mode, second_hue in list(hues.items())[index + 1 :]:
                with self.subTest(first=first_mode, second=second_mode):
                    self.assertGreaterEqual(circular_hue_distance(first_hue, second_hue), 24)

    def test_theme_text_actions_and_secondary_ink_clear_contrast_thresholds(self) -> None:
        for mode, anchors in EXPECTED_ANCHORS.items():
            declarations = self.mode_declarations(mode)
            muted = self.token(declarations, "global-text-color-light")
            hover = self.token(declarations, "global-primary-hover-color")
            on_primary = self.token(declarations, "global-on-primary-color")
            primary_fill = self.token(declarations, "global-primary-fill-color")
            primary_fill_hover = self.token(declarations, "global-primary-fill-hover-color")
            on_primary_fill = self.token(declarations, "global-on-primary-fill-color")
            primary_container = self.token(declarations, "global-primary-container-color")
            on_primary_container = self.token(declarations, "global-on-primary-container-color")
            surface_container = self.token(declarations, "global-surface-container-color")
            mint = self.token(declarations, "global-mint-strong")
            sky = self.token(declarations, "global-sky-strong")
            footer_bg = self.token(declarations, "global-footer-bg-color")
            footer_text = self.token(declarations, "global-footer-text-color")
            footer_link = self.token(declarations, "global-footer-link-color")
            worst_case_wash = composite_page_wash(self.token(declarations, "global-page-wash"), anchors["bg"])
            focus = mix_hex(anchors["primary"], anchors["text"], 0.78)
            with self.subTest(mode=mode):
                self.assertGreaterEqual(contrast_ratio(anchors["text"], anchors["bg"]), 7.0)
                self.assertGreaterEqual(contrast_ratio(muted, anchors["bg"]), 4.5)
                self.assertGreaterEqual(contrast_ratio(anchors["primary"], anchors["bg"]), 4.5)
                self.assertGreaterEqual(contrast_ratio(hover, anchors["bg"]), 4.5)
                self.assertGreaterEqual(contrast_ratio(on_primary, anchors["primary"]), 4.5)
                self.assertGreaterEqual(contrast_ratio(on_primary_fill, primary_fill), 4.5)
                self.assertGreaterEqual(contrast_ratio(on_primary_fill, primary_fill_hover), 4.5)
                self.assertGreaterEqual(contrast_ratio(on_primary_container, primary_container), 4.5)
                self.assertGreaterEqual(contrast_ratio(anchors["text"], surface_container), 7.0)
                self.assertGreaterEqual(contrast_ratio(mint, anchors["bg"]), 4.5)
                self.assertGreaterEqual(contrast_ratio(sky, anchors["bg"]), 4.5)
                self.assertGreaterEqual(contrast_ratio(footer_text, footer_bg), 4.5)
                self.assertGreaterEqual(contrast_ratio(footer_link, footer_bg), 4.5)
                self.assertGreaterEqual(contrast_ratio(focus, anchors["bg"]), 3.0)
                self.assertGreaterEqual(contrast_ratio(anchors["primary"], worst_case_wash), 4.5)
                self.assertGreaterEqual(contrast_ratio(muted, worst_case_wash), 4.5)
                if mode != "evening":
                    self.assertGreaterEqual(contrast_ratio(mint, self.token(declarations, "global-mint-soft")), 4.0)
                    self.assertGreaterEqual(contrast_ratio(sky, self.token(declarations, "global-sky-soft")), 4.0)

    def test_light_modes_have_distinct_coastal_surface_hierarchies(self) -> None:
        signatures: set[tuple[str, ...]] = set()
        for mode in ("morning", "noon", "afternoon"):
            declarations = self.mode_declarations(mode)
            signature = tuple(
                self.token(declarations, token)
                for token in (
                    "global-bg-color",
                    "global-surface-container-low-color",
                    "global-surface-container-color",
                    "global-surface-container-high-color",
                    "global-outline-color",
                    "global-shadow-rgb",
                    "global-footer-bg-color",
                    "global-page-wash",
                )
            )
            signatures.add(signature)
            self.assertNotEqual(self.token(declarations, "global-primary-fill-color"), self.token(declarations, "global-primary-color"))

        self.assertEqual(len(signatures), 3)
        morning = self.mode_declarations("morning")
        self.assertNotIn("#342925", morning)
        self.assertNotIn("92, 54, 34", morning)
        self.assertIn("rgba(223, 160, 172, 0.1)", morning)
        self.assertIn("rgba(155, 189, 225, 0.05)", morning)
        afternoon = self.mode_declarations("afternoon")
        self.assertIn("rgba(92, 151, 162, 0.07)", afternoon)
        self.assertIn("rgba(218, 146, 112, 0.015)", afternoon)
        self.assertNotIn("#9a4a30", afternoon)
        self.assertNotIn("#e18462", afternoon)
        self.assertNotIn("#fff0e2", afternoon)
        self.assertNotIn("#ffe8d8", afternoon)

    def test_reading_surfaces_remain_near_the_neutral_page_field(self) -> None:
        surface_tokens = (
            "global-surface-color",
            "global-surface-container-low-color",
            "global-surface-container-color",
            "global-surface-container-high-color",
            "global-card-bg-color",
        )
        for mode, anchors in EXPECTED_ANCHORS.items():
            declarations = self.mode_declarations(mode)
            for token in surface_tokens:
                surface = self.token(declarations, token)
                with self.subTest(mode=mode, token=token):
                    self.assertLessEqual(rgb_distance(surface, anchors["bg"]), 0.2)
                    self.assertNotEqual(surface, anchors["container"])

    def test_brand_orange_is_constant_and_not_derived_from_mode_accent(self) -> None:
        root_start = self.themes.index(":root {") + len(":root {")
        root_end = self.themes.index("\n  .only-light", root_start)
        root = self.themes[root_start:root_end]
        self.assertEqual(self.token(root, "global-brand-orange-color"), "#f07a38")
        self.assertEqual(self.token(root, "global-brand-orange-rgb"), "240, 122, 56")
        for mode in EXPECTED_ANCHORS:
            declarations = self.mode_declarations(mode)
            with self.subTest(mode=mode):
                self.assertNotIn("--global-brand-orange-color", declarations)
                self.assertNotIn("--global-brand-orange-rgb", declarations)

        brand = BRAND_ORANGE_PATH.read_text(encoding="utf-8")
        self.assertIn("--brand-orange-rind: var(--global-brand-orange-color);", brand)
        self.assertGreaterEqual(brand.count("rgba(var(--global-brand-orange-rgb)"), 3)
        self.assertNotIn("rgba(var(--global-accent-rgb)", brand)
        self.assertNotIn('[data-theme-mode="', brand)

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

        layout = LAYOUT_PATH.read_text(encoding="utf-8")
        home = HOME_STYLE_PATH.read_text(encoding="utf-8")
        self.assertIn("background-image: var(--global-page-wash);", layout)
        self.assertIn("--home-paper-edge: var(--global-paper-edge-color);", home)
        self.assertNotIn("--home-paper-edge: rgba(117, 88, 58, 0.14);", home)
        for token in ("--global-primary-fill-color", "--global-primary-fill-hover-color", "--global-on-primary-fill-color"):
            self.assertIn(token, home)

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
        for signature in (
            "morning:f5dfd2:fff0e7:ffdfcf:b7d9e7",
            "noon:eaf1ec:fffffa:f0fffb:8fd8ef",
            "afternoon:ece8df:fbf9f4:f3faf7:9bcbd7",
            "evening:f0d4ad:e7d8c5:cbd9d9:ffa466",
        ):
            mode, floor, wall, ambient, side = signature.split(":")
            mode_start = palette_source.index(f"        {mode}: {{")
            next_mode = re.search(r"\n        [a-z]+: \{", palette_source[mode_start + 1 :])
            mode_end = mode_start + 1 + next_mode.start() if next_mode else palette_source.index("\n      };", mode_start)
            mode_source = palette_source[mode_start:mode_end]
            with self.subTest(mode=mode):
                self.assertIn(f"floor: 0x{floor}", mode_source)
                self.assertIn(f"wall: 0x{wall}", mode_source)
                self.assertIn(f"ambientColor: 0x{ambient}", mode_source)
                self.assertIn(f"sideColor: 0x{side}", mode_source)
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

    def test_afternoon_project_accents_do_not_return_to_an_orange_monoculture(self) -> None:
        cards = PROJECT_CARDS_PATH.read_text(encoding="utf-8")
        afternoon_accents = re.findall(r'(?m)^    afternoon: "(#[0-9a-f]{6})"$', cards)
        orange_forward = []
        for accent in afternoon_accents:
            red, green, blue = (int(accent[index : index + 2], 16) / 255 for index in (1, 3, 5))
            hue, saturation, _ = colorsys.rgb_to_hsv(red, green, blue)
            if 20 <= hue * 360 <= 50 and saturation >= 0.25:
                orange_forward.append(accent)

        self.assertGreaterEqual(len(set(afternoon_accents)), 10)
        self.assertLessEqual(len(orange_forward), 3)


if __name__ == "__main__":
    unittest.main()
