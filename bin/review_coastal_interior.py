"""Measured native contacts and the connected arrival route, run after export preparation."""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT / "artwork/coastal-home/coastal-home.blend"))
scene = bpy.context.scene
config = json.loads((ROOT / "assets/models/home/manifest.json").read_text())


def tree(objects):
    verts, faces = [], []
    for obj in objects:
        if obj.type != "MESH":
            continue
        start = len(verts)
        verts.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        faces.extend(tuple(start + i for i in p.vertices) for p in obj.data.polygons)
    return BVHTree.FromPolygons(verts, faces)


solid = tree([o for o in scene.objects if not o.get("shadowOnly") and not o.get("water") and not o.name.startswith("core_flora_")])
report = {"sunkenCuts": list(scene.get("sunkenCuts", [])), "nativeFloorProbes": [], "arrival": [], "anchors": []}
for label, x, y, expected in (("nook", -3.4, 3.8, -0.42), ("pit", 1.3, 1.85, -0.42)):
    hit = solid.ray_cast(Vector((x, y, 0.0)), Vector((0, 0, -1)), 2)[0]
    value = None if hit is None else hit.z
    assert value is not None and abs(value - expected) < 0.05, (label, value, expected)
    report["nativeFloorProbes"].append({"id": label, "height": value, "expected": expected})
if config.get("entrance"):
    for point in config["entrance"]["route"][-32:]:
        x, z, my = point
        p = Vector((x, -my, z))
        # From just above the authored tread, its actual top must agree within the nosing radius.
        floor = solid.ray_cast(p + Vector((0, 0, 0.10)), Vector((0, 0, -1)), 0.22)[0]
        assert floor is not None and abs(floor.z - z) < 0.025, ("arrival floor", point, floor)
        ceiling = solid.ray_cast(p + Vector((0, 0, 0.1)), Vector((0, 0, 1)), 4)[0]
        clearance = 4 if ceiling is None else ceiling.z - z
        assert clearance > 2.10, ("arrival headroom", point, clearance)
        # A capsule-width horizontal ray in both directions catches solid rock in the route.
        for dx in (-0.26, 0.26):
            hit = solid.ray_cast(p + Vector((0, 0, 1)), Vector((dx, 0, 0)).normalized(), abs(dx))[0]
            assert hit is None, ("arrival width", point, dx, hit)
        report["arrival"].append({"point": point, "floor": round(floor.z, 4), "headroom": round(clearance, 4)})
for a in config.get("furniture", []):
    matches = [o.name for o in scene.objects if o.get("furniturePlaceholder") == a["id"]]
    assert matches, ("placeholder", a["id"])
    report["anchors"].append({"id": a["id"], "placeholder": matches})
out = ROOT / "artwork/coastal-home/reviews/interior-contacts.json"
out.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"floorProbes": len(report["nativeFloorProbes"]), "arrivalTreads": len(report["arrival"]), "anchors": len(report["anchors"])}))
