"""Prepare missing responsive variants in the owned QA cache, never mutate another build.

The production build must independently generate its responsive assets before release. This
source-intercept fixture supplies complete images for candidate scene inspection on Windows.
"""
import re
import sys
from pathlib import Path
from PIL import Image, ImageOps

build = Path(sys.argv[1])
html = (build / "index.html").read_text(encoding="utf-8")
for uri in sorted(set(re.findall(r"(/(?:al-folio/)?assets/[^\s\"',|]+-\d+\.webp)", html))):
    uri = uri.replace("/al-folio", "")
    relative = Path(uri.lstrip("/"))
    if (build / relative).exists():
        continue
    target = Path(".jekyll-cache/responsive-assets") / relative
    if target.exists():
        continue
    width = int(re.search(r"-(\d+)\.webp$", uri).group(1))
    stem = re.sub(r"-\d+\.webp$", "", str(relative))
    for base in (Path("."), build):
        candidates = [base / (stem + extension) for extension in (".png", ".jpg", ".jpeg", ".webp")]
        source = next((candidate for candidate in candidates if candidate.exists()), None)
        if source:
            image = ImageOps.exif_transpose(Image.open(source))
            image.thumbnail((width, 100000), Image.Resampling.LANCZOS)
            target.parent.mkdir(parents=True, exist_ok=True)
            image.save(target, format="WEBP", quality=85, method=6)
            break
