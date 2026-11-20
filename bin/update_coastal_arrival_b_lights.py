"""Bind the authored Arrival B fixture sockets to their two receiving zones."""

import argparse
from copy import deepcopy
import json
from pathlib import Path

GROUP = "entry-garden"


def apply(manifest, fit):
    result = deepcopy(manifest)
    receivers = result["installationReceivers"]
    groups = receivers["groups"]
    if GROUP in groups or any(p["id"].startswith("entry-b-") for p in result["installationPoints"]):
        raise ValueError("Arrival B lamps are already bound")
    groups[GROUP] = fit["gardenBounds"]
    original = groups["arrival"]
    groups["arrival"] = [*(original if isinstance(original, list) else [original]), fit["arrivalExtension"]]
    order = receivers["order"]
    order.insert(order.index("exterior"), GROUP)
    result["installationPoints"].extend(deepcopy(fit["points"]))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--fit", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.out.resolve() in (args.manifest.resolve(), args.fit.resolve()) or args.out.exists():
        parser.error("Choose a new output")
    manifest = json.loads(args.manifest.read_bytes())
    fit = json.loads(args.fit.read_bytes())
    result = apply(manifest, fit)
    args.out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(f"Bound {len(fit['points'])} fitted fixtures to the arrival and entry garden.")


if __name__ == "__main__":
    main()
