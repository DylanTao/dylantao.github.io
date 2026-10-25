"""Compact the full overlap audit into the committed, CI-checked report and a short summary.

    python bin/summarize_coastal_overlaps.py --audit=.jekyll-cache/overlap-audit/final.json \
        [--before=.jekyll-cache/overlap-audit/before.json] \
        [--delivered=.jekyll-cache/overlap-audit/delivered.json] \
        [--verdicts=artwork/coastal-home/reviews/house-2026-10-24/overlap-verdicts.json] \
        [--out=artwork/coastal-home/reviews/house-2026-10-24/overlap-audit.json]

The full Blender report (tens of MB) stays in the ignored cache. The compact report keeps
every visible z-fighting pair, every grazing (patchy) crossing and the ranked deep crossings
aggregated per mesh pair, each matched to a reviewed verdict when one exists, plus the
z-fighting of the decoded delivery (an ``--delivered=1`` audit of the same source). It binds the
audited source, the delivered GLBs and the audit tool by SHA-256 and records the streamed
furniture, so ``test/test_coastal_overlap_audit.py`` fails when house geometry or the tool
changes without a re-audit.
"""
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
REVIEW = ROOT / "artwork/coastal-home/reviews/house-2026-10-24"
TOP_PAIRS = 80


def path(key, default):
    p = Path(ARGS.get(key, default))
    return p if p.is_absolute() else ROOT / p


def lf_sha(p):
    return hashlib.sha256(p.read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def canonical_sha(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def pair_key(a, b):
    return " | ".join(sorted((a, b)))


def totals(report):
    off = [r for r in report["interpenetration"] if r["severity"] > 0]
    gz = [r for r in off if r.get("grazing")]
    deep = [r for r in off if not r.get("grazing")]
    zf = [r for r in report["coplanar"] if r["verdict"] == "z-fighting"]
    return {
        "zFightingPairs": len(zf),
        "zFightingVisibleAreaM2": round(sum(r["visibleAreaM2"] for r in zf), 4),
        "grazingSites": len(gz),
        "grazingSeamM": round(sum(r["grazingSeamM"] for r in gz), 3),
        "deepSites": len(deep),
        "deepSitesOver5cm": sum(1 for r in deep if r["depth"] > 0.05),
        "deepSeverity": round(sum(r["severity"] for r in deep), 1),
        "maxDeepSeverity": round(max((r["severity"] for r in deep), default=0.0), 1),
    }


def main():
    audit = json.loads(path("audit", ".jekyll-cache/overlap-audit/final.json").read_text(encoding="utf-8"))
    delivered_path = path("delivered", ".jekyll-cache/overlap-audit/delivered.json")
    delivered = json.loads(delivered_path.read_text(encoding="utf-8")) if delivered_path.exists() else None
    if delivered and (not delivered.get("delivered") or delivered["sourceSha256"] != audit["sourceSha256"]):
        raise SystemExit(f"{delivered_path} is not a delivered audit of the same source; re-run it with --delivered=1")
    before_path = path("before", ".jekyll-cache/overlap-audit/before.json")
    before = json.loads(before_path.read_text(encoding="utf-8")) if before_path.exists() else None
    verdict_path = path("verdicts", str(REVIEW / "overlap-verdicts.json"))
    verdicts = json.loads(verdict_path.read_text(encoding="utf-8"))["pairs"] if verdict_path.exists() else {}
    manifest = json.loads((ROOT / "assets/models/home/manifest.json").read_text(encoding="utf-8"))
    off = [r for r in audit["interpenetration"] if r["severity"] > 0]
    deep = defaultdict(lambda: {"sites": 0, "seamM": 0.0, "maxDepth": 0.0, "severity": 0.0, "maxSeverity": 0.0, "center": None, "categories": None})
    for r in off:
        if r.get("grazing"):
            continue
        q = deep[pair_key(r["a"], r["b"])]
        q["sites"] += 1
        q["seamM"] += r["seamM"]
        q["maxDepth"] = max(q["maxDepth"], r["depth"])
        q["severity"] += r["severity"]
        if r["severity"] > q["maxSeverity"]:
            q["maxSeverity"], q["center"] = r["severity"], r["center"]
        q["categories"] = sorted({r["categoryA"], r["categoryB"]})
    ranked = sorted(deep.items(), key=lambda kv: -kv[1]["severity"])
    pairs = []
    for key, q in ranked[:TOP_PAIRS]:
        v = verdicts.get(key)
        pairs.append({"pair": key, "sites": q["sites"], "seamM": round(q["seamM"], 3), "maxDepthM": round(q["maxDepth"], 4),
                      "severity": round(q["severity"], 1), "worstSite": q["center"], "categories": q["categories"],
                      "verdict": v["verdict"] if v else None})
    zf = [{"pair": pair_key(r["a"], r["b"]), "materials": [r["materialA"], r["materialB"]], "visibleAreaM2": r["visibleAreaM2"],
           "areaM2": r["areaM2"], "at": r["at"], "normal": r["normal"],
           "verdict": (verdicts.get(pair_key(r["a"], r["b"])) or {}).get("verdict")}
          for r in audit["coplanar"] if r["verdict"] == "z-fighting"]
    gz = [{"pair": pair_key(r["a"], r["b"]), "grazingSeamM": r["grazingSeamM"], "depthM": r["depth"], "center": r["center"],
           "verdict": (verdicts.get(pair_key(r["a"], r["b"])) or {}).get("verdict")}
          for r in off if r.get("grazing")]
    exports = {}
    for name in audit["exportsSha256"]:
        exports[name] = audit["exportsSha256"][name]
    compact = {
        "tool": audit["tool"],
        # The tool that produced the audit, so a later tool change requires a re-audit.
        "toolSha256": audit.get("toolSha256") or lf_sha(ROOT / "bin/audit_coastal_overlaps.py"),
        "source": audit["source"],
        "sourceSha256": audit["sourceSha256"],
        "exportsSha256": exports,
        "furniture": [{k: f[k] for k in ("anchor", "item", "file", "sha256")} for f in audit["furniture"]],
        "furnitureAnchorsSha256": canonical_sha(manifest.get("furniture", [])),
        "scope": "Native source triangles (shell, rooms, fixtures, planting, coast) plus the streamed furniture "
                 "items placed exactly as furniture.mjs places them. Delivered Draco geometry of the repaired "
                 "families is checked separately in test/coastal-overlap-delivered.test.mjs; browser poses of "
                 "people and animals are separate captured evidence.",
        "tolerances": audit["tolerances"],
        "contactRules": audit["contactRules"],
        "exclusions": audit["exclusions"],
        "skipped": {k: sum(1 for s in audit["skipped"] if s["exclusion"] == k) for k in sorted({s["exclusion"] for s in audit["skipped"]})},
        "counts": audit["counts"],
        "ruleCounts": audit["ruleCounts"],
        "foliageOverlap": audit.get("foliageOverlap"),
        "totals": totals(audit),
        "before": ({"sourceSha256": before["sourceSha256"], "totals": totals(before)} if before else None),
        # The decoded Draco GLBs, audited the same way: quantization can collapse a few-millimetre
        # native gap into a delivered depth tie, so delivery has its own z-fighting ratchet.
        "delivered": ({"exportsSha256": {f["file"]: f["sha256"] for f in delivered.get("deliveredFiles", [])},
                       "totals": totals(delivered),
                       "zFighting": [{"pair": pair_key(r["a"], r["b"]), "visibleAreaM2": r["visibleAreaM2"], "at": r["at"], "normal": r["normal"]}
                                     for r in delivered["coplanar"] if r["verdict"] == "z-fighting"]}
                      if delivered else None),
        "zFighting": zf,
        "grazing": gz,
        "deepOffenderPairs": pairs,
    }
    out = path("out", str(REVIEW / "overlap-audit.json"))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(compact, indent=1) + "\n", encoding="utf-8", newline="\n")
    t, b = compact["totals"], (compact["before"] or {}).get("totals", {})
    print(json.dumps({"out": str(out), "totals": t, "before": b, "unreviewedTopPairs": [p["pair"] for p in pairs if not p["verdict"]][:20]}, indent=1))


if __name__ == "__main__":
    main()
