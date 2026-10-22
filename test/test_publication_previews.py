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
PREVIEW_SCRIPT = REPO_ROOT / "assets" / "js" / "preview-motion.mjs"


def preview_names() -> list[str]:
    text = BIBLIOGRAPHY.read_text(encoding="utf-8")
    return [name.strip() for name in re.findall(r"preview\s*=\s*\{([^}]+)\}", text)]


def top_level_atoms(path: Path) -> list[str]:
    data = path.read_bytes()
    atoms, offset = [], 0
    while offset + 8 <= len(data):
        size = int.from_bytes(data[offset : offset + 4], "big")
        atoms.append(data[offset + 4 : offset + 8].decode("latin-1"))
        if size == 1:
            size = int.from_bytes(data[offset + 8 : offset + 16], "big")
        if size < 8:
            break
        offset += size
    return atoms


class PublicationPreviewTests(unittest.TestCase):
    """Publication previews stay light on listing pages (2026-10-12) and play by themselves (2026-10-19).

    Static previews use CI's responsive WebP variants instead of the full-size original. The animated
    Physion previews are small muted looping videos that start while they are on screen, with a pause
    control, over a committed first-frame poster that reduced-motion, Save-Data and no-script
    visitors keep.
    """

    def test_previews_use_responsive_variants_and_describe_the_figure(self) -> None:
        source = BIB_LAYOUT.read_text(encoding="utf-8")
        self.assertNotIn("avoid_scaling", source)
        self.assertNotIn("alt=entry.preview", source)
        self.assertIn("Preview figure for", source)
        self.assertGreaterEqual(source.count("zoom_src=entry_path"), 2)

    def test_animated_previews_play_as_muted_looping_videos(self) -> None:
        source = BIB_LAYOUT.read_text(encoding="utf-8")
        self.assertIn("replace: '.gif', '-poster.png'", source)
        self.assertIn("replace: '.gif', '.mp4'", source)
        video = re.search(r"<video\b(.*?)>", source, flags=re.DOTALL)
        self.assertIsNotNone(video)
        for attribute in ("muted", "loop", "playsinline", 'preload="none"', 'aria-hidden="true"', "hidden"):
            self.assertIn(attribute, video.group(1))
        self.assertIn("<noscript>", source)
        self.assertNotIn("Play the animation", source)
        self.assertNotIn("preview-animation-link", source)
        script = PREVIEW_SCRIPT.read_text(encoding="utf-8")
        # WCAG 2.2.2: motion that starts by itself and lasts more than five seconds can be paused.
        self.assertIn("Pause the animation", script)
        self.assertIn("prefers-reduced-motion", script)
        self.assertIn("saveData", script)
        self.assertIn("IntersectionObserver", script)

    def test_every_animated_preview_has_a_committed_poster_and_video(self) -> None:
        gifs = [name for name in preview_names() if name.lower().endswith(".gif")]
        self.assertTrue(gifs)
        for name in gifs:
            gif = PREVIEW_DIR / name
            poster = gif.with_name(f"{gif.stem}-poster.png")
            video = gif.with_suffix(".mp4")
            self.assertTrue(gif.is_file(), name)
            self.assertTrue(poster.is_file(), f"run python bin/make_preview_media.py for {name}")
            self.assertTrue(video.is_file(), f"run python bin/make_preview_media.py for {name}")
            self.assertLess(poster.stat().st_size, gif.stat().st_size)
            # Each video is a few percent of its GIF; a tenth is the ceiling.
            self.assertLess(video.stat().st_size, gif.stat().st_size / 10)
            atoms = top_level_atoms(video)
            self.assertIn("moov", atoms)
            self.assertLess(atoms.index("moov"), atoms.index("mdat"), f"{video.name} needs +faststart")
            self.assertIn(b"avc1", video.read_bytes()[:200_000], f"{video.name} must be H.264")

    def test_posters_and_videos_match_the_script(self) -> None:
        try:
            import PIL  # noqa: F401
        except ImportError:
            self.skipTest("Pillow is not installed; the CI policy job installs only PyYAML")
        result = subprocess.run(
            [sys.executable, str(REPO_ROOT / "bin" / "make_preview_media.py"), "--check"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
