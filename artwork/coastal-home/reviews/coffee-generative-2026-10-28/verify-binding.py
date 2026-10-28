"""Bind the frozen source, complete compiled site, actual HTTP bytes and saved renders."""

import argparse
import gzip
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen

from PIL import Image


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--base", default="http://127.0.0.1:4132/al-folio")
    args = parser.parse_args()
    review = Path(__file__).resolve().parent
    repo = review.parents[3]
    site = args.site.resolve()
    frozen = json.loads((review / "frozen-inputs.json").read_text(encoding="utf8"))
    inputs = {}
    for name, expected in frozen["files"].items():
        raw = (repo / name).read_bytes()
        normalized = raw.replace(b"\r\n", b"\n")
        assert sha(normalized) == expected["sha256Lf"], name
        inputs[name] = {"sha256Lf": sha(normalized), "workingBytes": len(raw)}
    source = (repo / "assets/js/home-coffee-stain.js").read_bytes()
    compiled = (site / "assets/js/home-coffee-stain.js").read_bytes()
    html = (site / "index.html").read_text(encoding="utf8")
    version = re.search(r'home-coffee-stain\.js\?v=([^" ]+)', html).group(1)
    assert version == hashlib.md5(source).hexdigest()
    captures = []
    for record in sorted((review / "captures").glob("candidate-*.json")):
        data = json.loads(record.read_text(encoding="utf8"))
        assert data["rasterOverride"] is None and data["scriptOverride"] is None and not data["errors"]
        assert data["detail"]["source"] == "procedural"
        assert data["detail"]["filter"] == "none" and data["detail"]["animation"] == "none"
        assert data["detail"]["wetContent"] == "none"
        responses = []
        for response in data["bindings"]:
            assert response["status"] == 200
            name = urlsplit(response["url"]).path.removeprefix("/al-folio/")
            built = (site / name).read_bytes()
            with urlopen(args.base.rstrip("/") + "/" + name) as request:
                served = request.read()
            assert served == built
            normalized = built.removeprefix(b"\xef\xbb\xbf") if name.endswith(".css") else built
            assert response["sha256"] == sha(normalized) and response["bytes"] == len(normalized)
            responses.append({
                "path": name, "rawHTTPBytes": len(served), "rawHTTPSha256": sha(served),
                "browserBytes": response["bytes"], "browserSha256": response["sha256"],
                "normalization": "CSS UTF-8 BOM removed by browser response API" if normalized != built else None,
            })
        assert len(responses) == 2, "ordinary generation must not request the retained pigment image"
        native = record.with_name(record.stem + "-native.png")
        rgba = native.read_bytes()
        assert sha(rgba) == data["detail"]["pngSha256"]
        image = Image.open(native).convert("RGBA")
        w, h = image.size
        assert w == h == data["detail"]["generation"]["size"] and w in (1024, 1536)
        alpha = image.getchannel("A")
        center = [alpha.getpixel((x, y)) for y in range(h) for x in range(w) if (x - w / 2) ** 2 + (y - h / 2) ** 2 < (w * 0.22) ** 2]
        clear = sum(value < 8 for value in center) / len(center)
        assert clear > 0.98
        captures.append({
            "capture": record.name, "seed": data["seed"], "width": data["width"], "dpr": data["dpr"],
            "theme": data["theme"], "nativeSize": [w, h], "nativeBytes": len(rgba), "nativeSha256": sha(rgba),
            "centerClearFractionAlphaBelow8": clear,
            "renderFiles": {suffix: sha(record.with_name(record.stem + suffix).read_bytes()) for suffix in ("-detail.png", "-hero.png", "-native.png")},
            "responses": responses, "errors": [],
        })
    assert len(captures) == 7
    same_placement = [row for row in captures if row["width"] == 1440 and row["theme"] == "noon"]
    assert len(same_placement) == 4 and len({row["nativeSha256"] for row in same_placement}) == 4
    module_receipt = (site / "assets/js/module-build.json").read_bytes()
    report = {
        "scope": "Complete own compiled base e91430e5d; no source overlays or route/image omissions. Functional shared-load evidence; no isolated device performance or final taste acceptance claim.",
        "base": args.base, "inputs": inputs,
        "sourceScript": {"rawBytes": len(source), "rawSha256": sha(source), "htmlVersionMD5": version},
        "compiledScript": {"bytes": len(compiled), "sha256": sha(compiled), "computedGzipBytes": len(gzip.compress(compiled, mtime=0)), "previewServesUncompressed": True},
        "moduleReceipt": {"sha256": sha(module_receipt), "modules": len(json.loads(module_receipt)["modules"])},
        "captures": captures,
    }
    (review / "source-binding.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"captures": len(captures), "compiledScript": report["compiledScript"], "minimumCenterClear": min(row["centerClearFractionAlphaBelow8"] for row in captures), "modules": report["moduleReceipt"]["modules"]}, indent=2))


if __name__ == "__main__":
    main()
