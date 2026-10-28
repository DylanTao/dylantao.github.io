"""The site mark is one orange sun in the navbar, the browser tab and on the home screen."""

import re
import struct
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
IMG = REPO_ROOT / "assets" / "img"


class BrandMarkTest(unittest.TestCase):
    def test_navbar_mark_is_the_same_orange_sun_on_every_visit(self) -> None:
        mark = (REPO_ROOT / "_includes" / "brand-orange.liquid").read_text(encoding="utf-8")
        self.assertIn("data-brand-orange", mark)
        self.assertIn('<svg class="brand-orange-svg"', mark)
        self.assertNotIn("data-orange-specimen", mark)

        # Only the 404 specimen is grown per visit. Navbar discovery changes motion, not geometry.
        script = (REPO_ROOT / "assets" / "js" / "brand-orange.js").read_text(encoding="utf-8")
        self.assertIn('querySelectorAll("[data-orange-specimen]")', script)
        self.assertNotIn('querySelectorAll("[data-brand-orange]")', script)
        specimen = (REPO_ROOT / "_includes" / "orange-specimen.liquid").read_text(encoding="utf-8")
        self.assertIn("data-orange-specimen", specimen)
        self.assertIn("{% include orange-specimen.liquid %}", (REPO_ROOT / "_pages" / "404.md").read_text(encoding="utf-8"))

    def test_icons_draw_the_same_mark_on_a_pixel_grid(self) -> None:
        head = (REPO_ROOT / "_includes" / "head.liquid").read_text(encoding="utf-8")
        for link in ("'/assets/img/favicon.svg'", 'type="image/svg+xml"', 'rel="apple-touch-icon"', 'sizes="32x32"'):
            self.assertIn(link, head)

        svg = (IMG / "favicon.svg").read_text(encoding="utf-8")
        self.assertIn('viewBox="0 0 32 32"', svg)
        # The navbar and tiny icon share geometry, rather than drifting into different marks.
        mark = (REPO_ROOT / "_includes" / "brand-orange.liquid").read_text(encoding="utf-8")
        for geometry in re.findall(r'\b(?:d|cx|cy|r|transform)="([^"]+)"', svg):
            self.assertIn(f'="{geometry}"', mark)

        ico = (IMG / "favicon.ico").read_bytes()
        reserved, kind, count = struct.unpack_from("<HHH", ico, 0)
        self.assertEqual((reserved, kind), (0, 1))
        sizes = []
        for index in range(count):
            width, height = ico[6 + 16 * index], ico[7 + 16 * index]
            length, offset = struct.unpack_from("<II", ico, 6 + 16 * index + 8)
            png = ico[offset : offset + length]
            self.assertEqual(png[:8], b"\x89PNG\r\n\x1a\n")
            self.assertEqual(struct.unpack(">II", png[16:24]), (width, height))
            sizes.append(width)
        self.assertEqual(sizes, [16, 32, 48])

        touch = (IMG / "apple-touch-icon.png").read_bytes()
        self.assertEqual(struct.unpack(">II", touch[16:24]), (180, 180))


if __name__ == "__main__":
    unittest.main()
