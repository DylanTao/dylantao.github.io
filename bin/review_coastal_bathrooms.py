"""Source-native bathroom floor, clear-width, enclosure and fixture survey.

The independent Draco/capsule test proves locomotion; this records the retained
editable triangles rather than testing metadata against itself.
"""
import json
import math
import gzip
import hashlib
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT / "artwork/coastal-home/coastal-home.blend"))
config = json.loads((ROOT / "assets/models/home/manifest.json").read_text())
trees = []
for obj in bpy.context.scene.objects:
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
for room in config["rooms"]:
    if not room.get("bathroom"):
        continue
    bath = room["bathroom"]
    floor_rows = []
    for key in ("route", "wcApproachRoute", "showerRoute"):
        for i, point in enumerate(bath[key]):
            p = native(point)
            floor = hit(p + Vector((0, 0, .30)), Vector((0, 0, -1)), .65)
            assert floor, (room["id"], key, i, "missing native floor")
            delta = floor[2].z-p.z
            assert abs(delta) < .04, (room["id"], key, i, "native floor mismatch", floor[1], delta)
            ceiling = hit(floor[2]+Vector((0, 0, .035)), Vector((0, 0, 1)), 8)
            headroom = None if not ceiling else ceiling[2].z-floor[2].z
            assert headroom is None or headroom > 2.20, (room["id"], key, i, "headroom", headroom, ceiling[1])
            floor_rows.append({"branch": key, "index": i, "point": point, "floor": floor[1],
                               "floorDelta": round(delta, 5), "headroom": round(headroom, 4) if headroom else None})
    center = native(bath["entry"])+Vector((-.34, 0, 1.1))
    a, b = hit(center, Vector((0, 1, 0)), 2), hit(center, Vector((0, -1, 0)), 2)
    assert a and b
    width = a[0]+b[0]
    assert width >= 1.05, (room["id"], "native door width", width, a, b)
    privacy = []
    target = native(bath["privacy"]["target"])
    for point in bath["privacy"]["observers"]:
        origin = native(point)
        delta = target-origin
        block = hit(origin, delta.normalized(), delta.length)
        assert block and block[0] < delta.length-.55, (room["id"], "WC visible from hall", point)
        privacy.append({"observer": point, "blocker": block[1], "clearanceBeforeWC": round(delta.length-block[0], 4)})
    camera = room["camera"]
    t = Vector(room["target"])
    eye = t+Vector((math.sin(camera["yaw"])*math.cos(camera["pitch"])*camera["radius"],
                    math.sin(camera["pitch"])*camera["radius"],
                    math.cos(camera["yaw"])*math.cos(camera["pitch"])*camera["radius"]))
    rows.append({"room": room["id"], "doorMeasuredClearWidth": round(width, 4),
                 "minimumRouteHeadroom": min(r["headroom"] for r in floor_rows if r["headroom"]),
                 "maximumFloorDelta": max(abs(r["floorDelta"]) for r in floor_rows),
                 "cameraEye": list(eye), "route": floor_rows, "hallPrivacy": privacy})
def asset(path):
    data = (ROOT / path).read_bytes()
    return {"file": path, "bytes": len(data), "gzipBytes": len(gzip.compress(data, mtime=0)),
            "sha256": hashlib.sha256(data).hexdigest()}


report = {"method": "BVH raycasts against retained native Blender triangles", "rooms": rows,
          "source": asset("artwork/coastal-home/coastal-home.blend"),
          "assets": [asset("assets/models/home/"+name) for name in
                     ("home-shell.glb", "room-sleep.glb", "room-bath-living.glb", "room-bath-bedroom.glb")],
          "newBathroomTriangles": sum(sum(len(p.vertices)-2 for p in o.data.polygons)
                                       for o in bpy.context.scene.objects if o.type == "MESH" and
                                       o.name.startswith(("bath-living_", "bath-bedroom_")))}
geometry_file = ROOT / "artwork/coastal-home/reviews/bathrooms/geometry.json"
if geometry_file.exists():
    geometry = json.loads(geometry_file.read_text())
    geometry["cuts"] = json.loads(bpy.context.scene.get("bathroomWingCutReport", "[]"))
    geometry_file.write_text(json.dumps(geometry, indent=2)+"\n")
out = ROOT / "artwork/coastal-home/reviews/bathrooms/native-survey.json"
out.write_text(json.dumps(report, indent=2)+"\n")
print(json.dumps(report), flush=True)
