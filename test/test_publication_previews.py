from __future__ import annotations

import re
import subprocess
import sys
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
BIBLIOGRAPHY = REPO_ROOT / "_bibliography" / "papers.bib"
BIB_LAYOUT = REPO_ROOT / "_layouts" / "bib.liquid"
PREVIEW_DIR = REPO_ROOT / "assets" / "img" / "publication_preview"


def preview_names() -> list[str]:
    text = BIBLIOGRAPHY.read_text(encoding="utf-8")
    return [name.strip() for name in re.findall(r"preview\s*=\s*\{([^}]+)\}", text)]


class PublicationPreviewTests(unittest.TestCase):
    """Publication previews stay light on listing pages (2026-10-12).

    Static previews use CI's responsive WebP variants instead of the full-size original, and the
    animated Physion previews show a committed first-frame poster until a visitor asks for motion.
    """

    def test_previews_use_responsive_variants_and_describe_the_figure(self) -> None:
        source = BIB_LAYOUT.read_text(encoding="utf-8")
        self.assertNotIn("avoid_scaling", source)
        self.assertNotIn("alt=entry.preview", source)
        self.assertIn("Preview figure for", source)
        self.assertGreaterEqual(source.count("zoom_src=entry_path"), 2)

    def test_animated_previews_offer_an_explicit_play_link(self) -> None:
        source = BIB_LAYOUT.read_text(encoding="utf-8")
        self.assertIn("replace: '.gif', '-poster.png'", source)
        self.assertIn('class="preview-animation-link"', source)
        self.assertIn("Play the animation", source)

    def test_every_animated_preview_has_a_committed_poster(self) -> None:
        gifs = [name for name in preview_names() if name.lower().endswith(".gif")]
        self.assertTrue(gifs)
        for name in gifs:
            gif = PREVIEW_DIR / name
            poster = gif.with_name(f"{gif.stem}-poster.png")
            self.assertTrue(gif.is_file(), name)
            self.assertTrue(poster.is_file(), f"run python bin/make_gif_posters.py for {name}")
            self.assertLess(poster.stat().st_size, gif.stat().st_size)

    def test_posters_match_the_first_gif_frame(self) -> None:
        try:
            import PIL  # noqa: F401
        except ImportError:
            self.skipTest("Pillow is not installed; the CI policy job installs only PyYAML")
        result = subprocess.run(
            [sys.executable, str(REPO_ROOT / "bin" / "make_gif_posters.py"), "--check"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
