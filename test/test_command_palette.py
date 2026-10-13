from __future__ import annotations

import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_INCLUDE = REPO_ROOT / "_includes" / "scripts.liquid"
PALETTE_DATA = REPO_ROOT / "_includes" / "search_data.liquid.js"


class CommandPaletteTests(unittest.TestCase):
    """The command palette renders the site's curated data (2026-10-12).

    After the v1 migration the curated _scripts/search.liquid.js was never built and the palette
    silently showed al_search's generic data, including themes the site does not have.
    """

    def test_scripts_include_renders_the_curated_data(self) -> None:
        source = SCRIPTS_INCLUDE.read_text(encoding="utf-8")
        self.assertIn("{% include search_data.liquid.js %}", source)
        self.assertNotIn("al_search_data_script", source)
        self.assertFalse((REPO_ROOT / "_scripts" / "search.liquid.js").exists())

    def test_palette_keeps_start_here_routes_and_time_of_day_actions(self) -> None:
        source = PALETTE_DATA.read_text(encoding="utf-8")
        self.assertIn('section: "Start here"', source)
        self.assertIn('section: "Do"', source)
        list_match = re.search(r'assign theme_actions = "([^"]+)" \| split: ";"', source)
        self.assertIsNotNone(list_match)
        modes = [item.split("|")[0] for item in list_match.group(1).split(";")]
        self.assertEqual(modes, ["morning", "noon", "afternoon", "evening"])
        for action in ("do-desk-3d", "do-ai-format", "do-duh-recall", "do-duh-sleep", "do-build-rhythm"):
            with self.subTest(action=action):
                self.assertIn(f'id: "{action}"', source)

    def test_palette_offers_only_the_preferred_contact(self) -> None:
        source = PALETTE_DATA.read_text(encoding="utf-8")
        # The palette renders on every page, including the AI profile, whose output validator
        # requires the preferred address and forbids the older one in socials.yml.
        self.assertIn("site.profile_contact_email", source)
        self.assertNotIn("site.data.socials.email", source)


if __name__ == "__main__":
    unittest.main()
