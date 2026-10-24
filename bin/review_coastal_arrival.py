"""Native Blender floor/headroom survey of the complete clifftop-to-living route.

This checks retained mesh triangles, not just the exported support metadata. The browser's
capsule-field journey remains the end-to-end acceptance check for actual visitor movement.
"""
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT / "artwork/coastal-home/coastal-home.blend"))
config = json.loads((ROOT / "assets/models/home/manifest.json").read_text())
scene = bpy.context.scene
trees = []
for obj in scene.objects:
    if obj.type != "MESH" or obj.get("shadowOnly") or obj.get("water"):
        continue
    if any(m and ("glass" in m.name or "diffuser" in m.name) for m in obj.data.materials):
        continue
    vertices = [obj.matrix_world @ v.co for v in obj.data.vertices]
    polygons = [tuple(p.vertices) for p in obj.data.polygons]
    trees.append((obj.name, BVHTree.FromPolygons(vertices, polygons)))


def native(point):
    return Vector((point[0], -point[2], point[1]))


def hit(origin, direction, distance):
    best = None
    for name, tree in trees:
        location, normal, _, length = tree.ray_cast(origin, direction, distance)
        if location is not None and (best is None or length < best[0]):
            best = (length, name, location, normal)
    return best


rows = []
route = config["walk"]["mainEntryRoute"]
for index, point in enumerate(route):
    expected = native(point)
    floor = hit(expected + Vector((0, 0, .35)), Vector((0, 0, -1)), .75)
    assert floor, ("missing actual floor", index, point)
    delta = floor[2].z - expected.z
    assert abs(delta) < .04, ("floor mismatch", index, point, floor[1], delta)
    ceiling = hit(floor[2]+Vector((0, 0, .035)), Vector((0, 0, 1)), 8)
    headroom = None if not ceiling else ceiling[2].z-floor[2].z
    assert headroom is None or headroom > 1.90, ("low headroom", index, point, ceiling[1], headroom)
    rows.append({"index": index, "point": point, "floor": floor[1], "floorDelta": round(delta, 5),
                 "headroom": None if headroom is None else round(headroom, 4), "ceiling": None if ceiling is None else ceiling[1]})
report = {"routePoints": len(route), "minimumMeasuredHeadroom": min(r["headroom"] for r in rows if r["headroom"] is not None),
          "maximumFloorDelta": max(abs(r["floorDelta"]) for r in rows), "nativeRoute": rows,
          "meshCount": len(trees), "entrySupportCount": sum(s["id"].startswith("arrival-") for s in config["terrain"]["supportSurfaces"])}
out = ROOT / "artwork/coastal-home/reviews/arrival-living/native-route.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(report, indent=2)+"\n")
print(json.dumps(report), flush=True)
