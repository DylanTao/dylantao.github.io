#!/usr/bin/env python
"""Write a still first-frame poster next to each animated publication preview.

Publication previews appear on the homepage, the publications page, and project
references. The two Physion GIFs are 2.2 MB and 6.8 MB, so `_layouts/bib.liquid`
shows a lossless PNG poster of the first frame and opens the untouched GIF only when
a visitor zooms or presses "Play the animation". CI's ImageMagick step then
generates the poster's WebP variants.

Usage: python bin/make_gif_posters.py [--check]
  --check   exit 1 if any poster is missing or stale instead of writing it.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
BIBLIOGRAPHY = REPO_ROOT / "_bibliography" / "papers.bib"
PREVIEW_DIR = REPO_ROOT / "assets" / "img" / "publication_preview"


def gif_previews() -> list[Path]:
    text = BIBLIOGRAPHY.read_text(encoding="utf-8")
    names = re.findall(r"preview\s*=\s*\{([^}]+\.gif)\}", text)
    return [PREVIEW_DIR / name.strip() for name in names]


def poster_path(gif: Path) -> Path:
    return gif.with_name(f"{gif.stem}-poster.png")


def first_frame(gif: Path) -> Image.Image:
    with Image.open(gif) as image:
        image.seek(0)
        return image.convert("RGBA")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    problems = []
    for gif in gif_previews():
        if not gif.is_file():
            problems.append(f"missing GIF preview {gif.relative_to(REPO_ROOT)}")
            continue
        poster = poster_path(gif)
        frame = first_frame(gif)
        if args.check:
            if not poster.is_file():
                problems.append(f"missing poster {poster.relative_to(REPO_ROOT)}")
                continue
            with Image.open(poster) as existing:
                if existing.size != frame.size or existing.convert("RGBA").tobytes() != frame.tobytes():
                    problems.append(f"stale poster {poster.relative_to(REPO_ROOT)}")
            continue
        frame.save(poster, format="PNG", optimize=True)
        print(f"wrote {poster.relative_to(REPO_ROOT)} ({frame.width}x{frame.height}, {poster.stat().st_size // 1024} KB)")

    for problem in problems:
        print(problem, file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
