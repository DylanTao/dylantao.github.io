"""Reproduce the bounded v44 bed-foot reach check from measured decoded geometry.

These are kinematic intervals, not floor/bed-frame clearance or a continuous pose proof.
Run from the repository root after generating the seat and neutral-leg receipts.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]


def rotate(point, facing):
    x, y, z = point
    c, s = math.cos(facing), math.sin(facing)
    return [c*x+s*z, y, -s*x+c*z]


def add(a, b):
    return [x+y for x, y in zip(a, b)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path(__file__).with_name("bed-reach-control.json"))
    args = parser.parse_args()
    folder = Path(__file__).parent
    contacts = json.loads((ROOT / "assets/models/home/character-contacts.json").read_text())
    legs = json.loads((folder / "decoded-neutral-legs.json").read_text())
    fixture = json.loads((folder / "bed-targets-v44.json").read_text())
    seat = fixture["bedTransfer"]["seat"]["position"]
    facing = fixture["bedTransfer"]["seat"]["facing"]
    result = {"scope": "Actual decoded neutral foot orientation. Sole centers use complete <=1mm lower-envelope witness extents. Kinematic reach only; house must survey whole-foot floor and bed-frame clearance. No rig/geometry/IK is changed.", "sourceBedManifestSha256": fixture["sourceManifestSha256"], "seat": seat, "facing": facing, "extensionMargin": .02, "avatars": {}}
    for style, row in contacts["avatars"].items():
        contact = row["lounge"]
        assert contact["sourceGlbSha256"] == legs["avatars"][style]["sourceGlbSha256"]
        model = ROOT / f"assets/models/home/sirui-{style}.glb"
        assert hashlib.sha256(model.read_bytes()).hexdigest() == contact["sourceGlbSha256"]
        center = rotate([contact["contactCenterXZ"][0], 0, contact["contactCenterXZ"][1]], facing)
        root = [seat[0]-center[0], seat[1]-contact["seatOffsetY"], seat[2]-center[2]]
        entry = {"sourceGlbSha256": contact["sourceGlbSha256"], "root": root, "sides": {}}
        for side, leg in legs["avatars"][style]["sides"].items():
            floor = fixture["bedTransfer"]["feet"][side]["position"]
            hip, knee, ankle = [add(root, rotate(leg[key], facing)) for key in ("hip", "knee", "ankle")]
            sole = [(min(p[i] for p in leg["soleWitnesses"])+max(p[i] for p in leg["soleWitnesses"]))/2 for i in range(3)]
            offset = rotate([sole[i]-leg["ankle"][i] for i in range(3)], facing)
            target = [floor[i]-offset[i] for i in range(3)]
            length = leg["upperLength"]+leg["lowerLength"]
            dy, dz = target[1]-hip[1], target[2]-hip[2]
            radius2 = (length-.02)**2-dy*dy-dz*dz
            interval = None if radius2 < 0 else [hip[0]-math.sqrt(radius2)+offset[0], hip[0]+math.sqrt(radius2)+offset[0]]
            native_sole_x = root[0]+rotate(sole, facing)[0]
            preferred = None if interval is None else max(interval[0], min(interval[1], native_sole_x))
            preferred_target = None if preferred is None else [preferred-offset[0], target[1], target[2]]
            entry["sides"][side] = {"hipWorld": hip, "neutralKneeWorld": knee, "neutralAnkleWorld": ankle, "soleToAnkleWorld": [-v for v in offset], "requestedSoleCenter": floor, "requestedAnkleTarget": target, "upperLength": leg["upperLength"], "lowerLength": leg["lowerLength"], "maximumLength": length, "requestedDistance": math.dist(hip, target), "requestedReachSlack": length-math.dist(hip, target), "soleCenterXIntervalWith2cmExtensionMargin": interval, "preferredSoleCenterX": preferred, "preferredScope": "Authored neutral horizontal sole projection, clamped to kinematic interval; not an approved floor point", "preferredReachSlack": None if preferred_target is None else length-math.dist(hip, preferred_target)}
        result["avatars"][style] = entry
        print(style, [(side, [round(x, 6) for x in data["soleCenterXIntervalWith2cmExtensionMargin"]], round(data["preferredSoleCenterX"], 6)) for side, data in entry["sides"].items()])
    args.out.write_text(json.dumps(result, indent=2)+"\n", encoding="utf8")


if __name__ == "__main__":
    main()
