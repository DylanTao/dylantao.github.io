"""Read-only native BVH audit of actual sampled companion movement.

Usage: blender -b --python-exit-code 1 --python bin/audit_coastal_companion_flights.py --
  --source artwork/coastal-home/coastal-home.blend --flights .jekyll-cache/companion-flights.jsonl
  --output .jekyll-cache/companion-native-audit.json
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

parser = argparse.ArgumentParser()
parser.add_argument("--source", required=True, type=Path)
parser.add_argument("--flights", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
bpy.ops.wm.open_mainfile(filepath=str(args.source.resolve()))
vertices, polygons, names = [], [], []
excluded = []
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    # These are the same explicit native traversal exclusions as the human
    # route audit: opened proximity door leaves, shadow shells, soft foliage.
    reason = None
    if obj.get("shadowOnly") or obj.get("facadeDoor") or obj.get("estateDoor"):
        reason = "opened-door-or-shadow-shell"
    elif obj.get("flora") and not any(
        material and any(word in material.name.lower() for word in ("bark", "trunk"))
        for material in obj.data.materials
    ):
        reason = "soft-foliage"
    if reason:
        excluded.append({"mesh": obj.name, "reason": reason})
        continue
    base = len(vertices)
    for vertex in obj.data.vertices:
        point = obj.matrix_world @ vertex.co
        vertices.append((point.x, point.z, -point.y))
    for polygon in obj.data.polygons:
        polygons.append(tuple(base + index for index in polygon.vertices))
        names.append(obj.name)
tree = BVHTree.FromPolygons(vertices, polygons)
report = {
    "sourceSha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
    "radius": 0.42,
    "scope": "Actual runtime rounding, hover and settle lift; every authored perch pair and complete beach return. Opened native door leaves excluded, human paths unchanged.",
    "vertices": len(vertices), "polygons": len(polygons), "excluded": excluded,
    "maximumCenterSpeedBound": 1.75,
    "routes": [], "passed": True, "samples": 0,
}
with args.flights.open(encoding="utf-8") as stream:
    for line in stream:
        flight = json.loads(line)
        if flight["type"] == "context":
            report.update({key: value for key, value in flight.items() if key != "type"})
            continue
        minimum, max_stride, previous, witness = float("inf"), 0.0, None, None
        for index, coordinates in enumerate(flight["centers"]):
            center = Vector(coordinates)
            surface, normal, polygon, distance = tree.find_nearest(center)
            if distance < minimum:
                minimum = distance
                witness = {"sample": index, "center": coordinates, "clearance": distance,
                           "mesh": names[polygon], "surface": list(surface)}
            if previous is not None:
                max_stride = max(max_stride, (center - previous).length)
            previous = center
        # Translation is bounded at 1.6m/s. Vertical quintic hover peaks at
        # 1.5625m/s; the <=18mm settle beat adds <.148m/s. A 1.75m/s bound
        # therefore covers arc length between samples, including a corner.
        # Nearest-surface distance is 1-Lipschitz, so subtract half that stride.
        unobserved = max(max_stride / 2, report["maximumCenterSpeedBound"] * report["timeStride"] / 2)
        conservative = minimum - unobserved
        passed = conservative >= report["radius"]
        report["routes"].append({"id": flight["id"], "samples": len(flight["centers"]),
                                 "minimum": minimum, "maxSpatialStride": max_stride,
                                 "conservativeClearance": conservative,
                                 "passed": passed, "minimumWitness": witness})
        report["samples"] += len(flight["centers"])
        report["passed"] = report["passed"] and passed
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"passed": report["passed"], "routes": len(report["routes"]),
                  "samples": report["samples"], "output": str(args.output)}), flush=True)
if not report["passed"]:
    sys.exit(1)
