#!/usr/bin/env python3
"""Make the build diary's WebP images from a review capture.

The build diary on /projects/homepage-desk-scene/ (data in _data/home_world_diary.yml) shows each
change as a before/after pair. Review folders keep full PNG captures; the page serves WebP at a few
widths instead. jekyll-imagemagick only converts JPEG/PNG and is not installed everywhere, so this
script writes every variant the page asks for, and the variants are committed:

    <name>.webp        the capture itself, at most 1440 px wide
    <name>-960.webp    when the capture is wider than 960 px
    <name>-480.webp    when the capture is wider than 480 px

Both halves of a pair must come out the same size, so crop them with the same box.

    python bin/build_diary_images.py retreat-overview-before \
        artwork/coastal-home/reviews/retreat-integration-2026-10-24/before/overview-clear.png

    # One half of a side-by-side comparison sheet:
    python bin/build_diary_images.py face-before docs/evidence/coastal-section/character-ghibli.webp \
        --crop 0,0,384,480

    # A section that got shorter: extend the after view with its page colour to the before's height.
    python bin/build_diary_images.py connect-after after.png --pad-to 582 --background "#111c22"

The script prints the width and height to copy into the diary entry. Record the capture's path in
the entry's `source` field, so the original stays traceable.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = REPO_ROOT / "assets" / "img" / "project_pics" / "homepage-desk-scene" / "diary"
MAX_WIDTH = 1440
VARIANT_WIDTHS = (960, 480)
QUALITY = 82


def flatten(image: Image.Image, background: str) -> Image.Image:
    """Return an RGB image; transparent pixels sit on the given background colour."""
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        base = Image.new("RGBA", rgba.size, background)
        return Image.alpha_composite(base, rgba).convert("RGB")
    return image.convert("RGB")


def scaled(image: Image.Image, width: int) -> Image.Image:
    if image.width <= width:
        return image
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def write(image: Image.Image, path: Path) -> None:
    image.save(path, "WEBP", quality=QUALITY, method=6)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("name", help="output base name, for example retreat-overview-before")
    parser.add_argument("source", help="the capture to convert")
    parser.add_argument("--crop", help="left,top,right,bottom in source pixels")
    parser.add_argument("--background", default="white", help="colour behind transparent pixels and padding")
    parser.add_argument("--pad-to", type=int, help="extend the image downward to this height with the background")
    parser.add_argument("--max-width", type=int, default=MAX_WIDTH)
    args = parser.parse_args(argv)

    source = Path(args.source)
    if not source.is_absolute():
        source = (Path.cwd() / source).resolve()
    image = Image.open(source)
    if args.crop:
        box = tuple(int(value) for value in args.crop.split(","))
        if len(box) != 4:
            parser.error("--crop needs four numbers: left,top,right,bottom")
        image = image.crop(box)
    image = flatten(image, args.background)
    if args.pad_to and args.pad_to > image.height:
        canvas = Image.new("RGB", (image.width, args.pad_to), args.background)
        canvas.paste(image, (0, 0))
        image = canvas
    image = scaled(image, args.max_width)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    written = [OUTPUT_DIR / f"{args.name}.webp"]
    write(image, written[0])
    for width in VARIANT_WIDTHS:
        if image.width > width:
            path = OUTPUT_DIR / f"{args.name}-{width}.webp"
            write(scaled(image, width), path)
            written.append(path)

    for path in written:
        print(f"{path.relative_to(REPO_ROOT).as_posix()}  {path.stat().st_size // 1024} KB")
    print(f"width: {image.width}\nheight: {image.height}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
