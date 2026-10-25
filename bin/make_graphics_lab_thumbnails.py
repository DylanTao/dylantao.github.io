#!/usr/bin/env python
"""Scale the Graphics Lab stills into the page's thumbnails and its project-card teaser.

bin/capture_graphics_lab_stills.cjs writes 4:3 frames of the live scene to
.jekyll-cache/visual-qa/graphics-lab-stills/ with a stills.json ledger (hour, date, room, camera).
This script picks one frame per experiment, scales it to 480 x 360 WebP in
assets/img/project_pics/graphics-lab/, and lays four of them out as the card teaser (teaser.png).
The light-paths thumbnail comes from that lab's own teaser, a frame of its renderer.

Frames are scaled, never retouched: no colour, contrast or content changes.

Usage: python bin/make_graphics_lab_thumbnails.py [name ...] [teaser]
With names, only those thumbnails (and the teaser, if named) are rebuilt; the others keep their committed
frames, so a pass can recapture a few rows without the rest of the raw frames.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STILLS = ROOT / ".jekyll-cache" / "visual-qa" / "graphics-lab-stills"
OUT = ROOT / "assets" / "img" / "project_pics" / "graphics-lab"
SIZE = (480, 360)

# Thumbnail name: source frame. Each frame's hour, date and camera are in stills.json.
FRAMES = {
    "light-paths": ROOT / "assets" / "img" / "project_pics" / "light-paths" / "teaser.png",
    "light-well": STILLS / "light-well.png",
    "light-field": STILLS / "light-field.png",
    "contact-light": STILLS / "contact-light.png",
    "ocean": STILLS / "ocean-golden.png",
    "onsen-water": STILLS / "onsen-water.png",
    "steam": STILLS / "steam.png",
    "coast-wind": STILLS / "wind-b.png",
    "sun-sky": STILLS / "sunset-b.png",
    "curtains": STILLS / "laundry-b.png",
    "bedding": STILLS / "bedding.png",
    "skin": STILLS / "skin-b.png",
    "hair": STILLS / "hair-b.png",
    "gym-lifts": STILLS / "gym-b.png",
    "wildlife": STILLS / "wildlife-cormorants-b.png",
    "loading-sketch": STILLS / "loading-sketch-bedroom-drawn.png",
    "camera-field": STILLS / "camera-field-golden.png",
    "hinterland": STILLS / "hinterland-golden.png",
    "gliders": STILLS / "gliders-golden.png",
    "lime-plaster": STILLS / "plaster-a.png",
    "coastal-haze": STILLS / "haze-north.png",
    "light-in-the-air": STILLS / "fog-coast.png",
}

# The card teaser: four experiments, two across, on a dark contact-sheet ground, so the sheet stays 4:3. A tile
# uses its row's frame unless a frame is named here; the card's alt text (_data/project_cards.yml) describes these.
TEASER = ["light-paths", "light-well", "wildlife", "loading-sketch"]
TEASER_FRAMES = {"wildlife": STILLS / "wildlife-golden.png"}
TILE = (480, 360)
GUTTER = 12
GROUND = (32, 33, 36)


def fit_4x3(image: Image.Image) -> Image.Image:
    """Centre-crop to 4:3 only if a frame is not already 4:3, then scale."""
    width, height = image.size
    target = 4 / 3
    if abs(width / height - target) > 0.01:
        if width / height > target:
            new_width = round(height * target)
            left = (width - new_width) // 2
            image = image.crop((left, 0, left + new_width, height))
        else:
            new_height = round(width / target)
            top = (height - new_height) // 2
            image = image.crop((0, top, width, top + new_height))
    return image


def main(wanted: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    unknown = [name for name in wanted if name not in FRAMES and name != "teaser"]
    if unknown:
        raise SystemExit(f"Unknown thumbnails {unknown}; known: {', '.join(FRAMES)} and teaser.")
    rebuild = [name for name in FRAMES if not wanted or name in wanted]
    for name in rebuild:
        source = FRAMES[name]
        if not source.is_file():
            raise SystemExit(f"Missing frame for {name}: {source}. Run bin/capture_graphics_lab_stills.cjs first.")
        thumbnail = fit_4x3(Image.open(source).convert("RGB")).resize(SIZE, Image.Resampling.LANCZOS)
        thumbnail.save(OUT / f"{name}.webp", "WEBP", quality=82, method=6)
        print(f"{name}.webp from {source.relative_to(ROOT)}")
    if wanted and "teaser" not in wanted:
        return

    columns, rows = 2, 2
    width = columns * TILE[0] + (columns + 1) * GUTTER
    height = rows * TILE[1] + (rows + 1) * GUTTER
    teaser = Image.new("RGB", (width, height), GROUND)
    for index, name in enumerate(TEASER):
        source = TEASER_FRAMES.get(name) or FRAMES[name]
        if not source.is_file():
            # The committed thumbnail is the same frame already scaled to the tile's size.
            source = OUT / f"{name}.webp"
            print(f"teaser tile {name} from its committed thumbnail")
        tile = fit_4x3(Image.open(source).convert("RGB")).resize(TILE, Image.Resampling.LANCZOS)
        x = GUTTER + (index % columns) * (TILE[0] + GUTTER)
        y = GUTTER + (index // columns) * (TILE[1] + GUTTER)
        teaser.paste(tile, (x, y))
    teaser.save(OUT / "teaser.png", "PNG", optimize=True)
    print(f"teaser.png {width} x {height}")


if __name__ == "__main__":
    main(sys.argv[1:])
