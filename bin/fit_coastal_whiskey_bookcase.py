
"""Fit the whiskey seating to the bookcase approach in Blender 4.5.

Run in Blender with explicit --source, --manifest, --output, --manifest-output
and --report paths. Or call fit_whiskey_bookcase(scene, config) in a native build.
The three furniture anchors and their three physical placeholders move rigidly.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import sys
from pathlib import Path

VERSION = 1
TAG = "whiskeyBookcaseFitVersion"
ROOM = "library"
LOUNGE = "study-whiskey-lounge"
BASE = {
    LOUNGE: ("whiskey-loveseat", (-10.50, 0.0, 2.55)),
    "study-whiskey-ottoman": ("whiskey-ottoman", (-10.78, 0.0, 1.69)),
    "study-whiskey-side-table": ("whiskey-side-table", (-11.45, 0.0, 2.50)),
}
BASE_YAW = 3.1416
ANGLE = math.radians(37)
SHIFT = (-0.10, 0.16)


def after_point(point):
    x, y, z = point
    center_x, _, center_z = BASE[LOUNGE][1]
    x -= center_x
    z -= center_z
    c, s = math.cos(ANGLE), math.sin(ANGLE)
    return (
        center_x + SHIFT[0] + c * x + s * z,
        y,
        center_z + SHIFT[1] - s * x + c * z,
    )


def approve_manifest(config):
    anchors = {}
    states = set()
    for key, (item, original) in BASE.items():
        found = [anchor for anchor in config["furniture"] if anchor["id"] == key]
        if len(found) != 1 or found[0].get("room") != ROOM or found[0].get("item") != item:
            raise ValueError(f"Expected one {ROOM} furniture anchor {key}")
        anchor = found[0]
        actual = tuple(anchor["position"]), round(anchor["yaw"], 4)
        target = tuple(round(v, 4) for v in after_point(original)), round(BASE_YAW + ANGLE, 4)
        if actual == (original, BASE_YAW):
            states.add("old")
        elif actual == target:
            states.add("fitted")
        else:
            raise ValueError(f"{key} uses a different furniture position: {actual}")
        anchors[key] = anchor, target
    if len(states) != 1:
        raise ValueError("The whiskey furniture anchors contain a partial fit")
    return anchors


def fit_whiskey_bookcase(scene, config):
    """Update the known seating arrangement without changing its internal offsets."""
    import bpy
    from mathutils import Matrix, Vector

    anchors = approve_manifest(config)
    marker = scene.get(TAG)
    if marker not in (None, VERSION):
        raise ValueError(f"Unexpected {TAG} {marker}")
    placeholders = {}
    for key, (item, original) in BASE.items():
        matches = [obj for obj in scene.objects if obj.get("furniturePlaceholder") == key]
        if len(matches) != 1 or matches[0].type != "MESH" or matches[0].children:
            raise ValueError(f"Expected one independent mesh placeholder for {key}")
        obj = matches[0]
        points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
        center = [
            (min(p.x for p in points) + max(p.x for p in points)) / 2,
            min(p.z for p in points),
            -(min(p.y for p in points) + max(p.y for p in points)) / 2,
        ]
        expected = after_point(original) if marker else original
        if math.dist(center, expected) > 0.001:
            raise ValueError(f"Unexpected {key} placeholder center {center}, expected {expected}")
        placeholders[key] = obj

    current = Vector((-10.50, -2.55, 0))
    fitted = current + Vector((SHIFT[0], -SHIFT[1], 0))
    transform = Matrix.Translation(fitted) @ Matrix.Rotation(ANGLE, 4, "Z") @ Matrix.Translation(-current)
    if not marker:
        for obj in placeholders.values():
            obj.matrix_world = transform @ obj.matrix_world
        scene[TAG] = VERSION
        bpy.context.view_layer.update()

    for anchor, (point, yaw) in anchors.values():
        anchor["position"] = list(point)
        anchor["yaw"] = yaw
    return {
        "version": VERSION,
        "nativeChanges": not bool(marker),
        "room": ROOM,
        "yawDegrees": 37,
        "worldTranslation": [SHIFT[0], 0, SHIFT[1]],
        "nativeTranslation": [SHIFT[0], -SHIFT[1], 0],
        "anchors": [
            {
                "id": key,
                "mesh": placeholders[key].name,
                "before": list(BASE[key][1]),
                "after": list(anchors[key][1][0]),
                "yaw": anchors[key][1][1],
            }
            for key in BASE
        ],
    }


def main():
    import bpy

    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("source", "manifest", "output", "manifest-output", "report"):
        parser.add_argument(f"--{name}", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    for target in (args.output, args.manifest_output, args.report):
        target.parent.mkdir(parents=True, exist_ok=True)
    config = json.loads(args.manifest.read_text(encoding="utf-8-sig"))
    source_digest = hashlib.sha256(args.source.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(args.source.resolve()))
    report = fit_whiskey_bookcase(bpy.context.scene, config)
    if report["nativeChanges"]:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()), compress=True)
    elif args.source.resolve() != args.output.resolve():
        shutil.copyfile(args.source, args.output)
    args.manifest_output.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8", newline="\n")
    report["inputSha256"] = source_digest
    report["outputSha256"] = hashlib.sha256(args.output.read_bytes()).hexdigest()
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
