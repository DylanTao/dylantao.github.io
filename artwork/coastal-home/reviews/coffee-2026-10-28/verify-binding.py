"""Compare retained captures, HTTP responses and a complete production build."""

import argparse
import gzip
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen

from PIL import Image


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--base", default="http://127.0.0.1:4115/al-folio")
    args = parser.parse_args()
    repo = Path.cwd()
    review = Path(__file__).resolve().parent
    site = args.site.resolve()
    source = (repo / "assets/js/home-coffee-stain.js").read_bytes()
    compiled = (site / "assets/js/home-coffee-stain.js").read_bytes()
    html = (site / "index.html").read_text(encoding="utf8")
    version = re.search(r'home-coffee-stain\.js\?v=([^" ]+)', html).group(1)
    assert version == hashlib.md5(source).hexdigest()
    captures = []
    for record in sorted(review.glob("preferred-*.json")):
        if "preview" in record.name:
            continue
        data = json.loads(record.read_text(encoding="utf8"))
        assert data["rasterOverride"] is None and not data["errors"]
        assert data["detail"]["source"] == "raster"
        responses = []
        for response in data["bindings"]:
            assert response["status"] == 200
            path = urlsplit(response["url"]).path.removeprefix("/al-folio/")
            built = (site / path).read_bytes()
            with urlopen(args.base.rstrip("/") + "/" + path) as request:
                served = request.read()
            assert served == built
            # Playwright/Chromium decodes CSS responses and strips this UTF-8 BOM.
            normalized = built.removeprefix(b"\xef\xbb\xbf") if path.endswith(".css") else built
            assert response["sha256"] == digest(normalized)
            assert response["bytes"] == len(normalized)
            responses.append(
                {
                    "path": path,
                    "rawHTTPBytes": len(served),
                    "rawHTTPSha256": digest(served),
                    "browserBytes": response["bytes"],
                    "browserSha256": response["sha256"],
                    "normalization": "CSS UTF-8 BOM removed by browser response API" if normalized != built else None,
                }
            )
        assert len(responses) == 3
        native = record.with_name(record.stem + "-native.png")
        pixels = native.read_bytes()
        assert digest(pixels) == data["detail"]["pngSha256"]
        image = Image.open(native).convert("RGBA")
        w, h = image.size
        assert w == h and w <= 512
        alpha = image.getchannel("A")
        center = [alpha.getpixel((x, y)) for y in range(h) for x in range(w) if (x - w / 2) ** 2 + (y - h / 2) ** 2 < (w * 0.22) ** 2]
        clear = sum(a < 8 for a in center) / len(center)
        assert clear > 0.98
        captures.append(
            {
                "capture": record.name,
                "width": data["width"],
                "dpr": data["dpr"],
                "theme": data["theme"],
                "source": "raster",
                "nativeSize": [w, h],
                "nativeBytes": len(pixels),
                "centerClearFractionAlphaBelow8": clear,
                "responses": responses,
                "errors": [],
            }
        )
    assert len(captures) == 7
    report = {
        "base": args.base,
        "productionBaseurl": "/al-folio",
        "completeProductionBuild": True,
        "imageOrRouteOmissions": False,
        "sourceScript": {"bytes": len(source), "sha256": digest(source), "htmlVersionMD5": version},
        "compiledScript": {"bytes": len(compiled), "sha256": digest(compiled), "computedGzipBytes": len(gzip.compress(compiled, mtime=0)), "previewServesUncompressed": True},
        "captures": captures,
        "scope": "Artifact and source binding, transparency and functional renders; no exclusive hardware timing or physical-phone measurements.",
    }
    (review / "preferred-source-binding.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"captures": len(captures), "sourceBytes": len(source), "compiledBytes": len(compiled), "computedGzipBytes": report["compiledScript"]["computedGzipBytes"], "nativeBytes": [min(c["nativeBytes"] for c in captures), max(c["nativeBytes"] for c in captures)], "minimumCenterClear": min(c["centerClearFractionAlphaBelow8"] for c in captures)}, indent=2))


if __name__ == "__main__":
    main()
