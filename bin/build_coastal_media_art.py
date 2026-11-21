"""Pack the five original coastal panoramas for the style and volume controls."""
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "artwork/concepts/coastal-home/2026-11-20/five-coastal-panoramas.png"
ATLAS = ROOT / "assets/img/media-controls/coastal-panoramas.webp"


def build():
    width, height = 900, 120
    # Preserve the drawn cuts between the five panels. Discard one edge pixel
    # so the glass never picks up the seam of the adjacent panorama.
    edges = (0, 204, 410, 615, 820, 1024)
    with Image.open(SOURCE) as source:
        rows = [
            source.crop((0, top + 1, source.width, bottom - 1)).convert("RGB").resize((width, height), Image.Resampling.LANCZOS)
            for top, bottom in zip(edges, edges[1:])
        ]
    styles = rows[0].copy()
    for index, row in enumerate(rows[1:], start=1):
        join = round(width * (index - 0.5) / (len(rows) - 1))
        mask = Image.new("L", styles.size)
        ink = ImageDraw.Draw(mask)
        ink.rectangle((join + 14, 0, width, height), fill=255)
        for column in range(28):
            x = join - 14 + column
            ink.line((x, 0, x, height), fill=round(255 * column / 27))
        styles.paste(row, (0, 0), mask)
    atlas = Image.new("RGB", (width, height * 6))
    for index, row in enumerate([styles, *rows]):
        atlas.paste(row, (0, index * height))
    atlas.save(ATLAS, "WEBP", quality=80, method=6)


if __name__ == "__main__":
    build()
