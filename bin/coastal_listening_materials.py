"""Pack the original sandstone study into scaled glTF colour and normal maps."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = ROOT / "artwork/concepts/coastal-home/2026-11-19/sandstone-01.png"
MATERIALS = ROOT / "artwork/coastal-home/materials"


def prepare():
    MATERIALS.mkdir(exist_ok=True)
    with Image.open(ORIGINAL) as source:
        colour = source.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
    colour.save(MATERIALS / "listening-sandstone.jpg", quality=86, optimize=True)
    value = colour.convert("L").resize((320, 320), Image.Resampling.LANCZOS)
    fine = np.asarray(value, dtype=float) / 255
    beds = np.asarray(value.filter(ImageFilter.GaussianBlur(1.5)), dtype=float) / 255
    height = 0.021 * beds + 0.007 * (fine - beds)
    down, right = np.gradient(height, 1.8 / value.width)
    normal = np.stack((-right, down, np.ones_like(right)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    target = Image.fromarray(np.round(127.5 * (normal + 1)).astype("uint8"))
    target.save(MATERIALS / "listening-sandstone-normal.jpg", quality=84, subsampling=0, optimize=True)


if __name__ == "__main__":
    prepare()
