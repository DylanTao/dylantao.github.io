"""Source-bound native floor/bed-frame controls for actual decoded foot shapes.

Neutral Foot-dominant vertices are positioned with the delivered neutral foot
orientation. Actual two-leg-IK skin and the full sit/stand sweep are independent
runtime gates, not inferred from these source controls.
"""
import hashlib
import json
import math
import os
from pathlib import Path

from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]


def measured_feet(scene, room, transfer):
    footprints_path = Path(os.environ.get("COASTAL_BED_FOOTPRINTS", str(ROOT / ".jekyll-cache/visual-qa/finish-house-2026-10-26/decoded-bed-feet.json")))
    reach_path = Path(os.environ.get("COASTAL_BED_REACH", str(ROOT / "artwork/coastal-home/reviews/character-finish-2026-10-26/seat-patch/bed-reach-control.json")))
    footprints = json.loads(footprints_path.read_text(encoding="utf-8"))
    reach = json.loads(reach_path.read_text(encoding="utf-8"))
    floor = room["floor"]
    floors = []
    obstacles = []
    for obj in scene.objects:
        if obj.type != "MESH" or obj.get("shadowOnly") or obj.get("bedding") not in (None, "empty"):
            continue
        points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
        if not points:
            continue
        lo, hi = (Vector([fn(point[k] for point in points) for k in range(3)]) for fn in (min, max))
        if obj.name.startswith("core_finish_bedchamber_floor__"):
            obj.data.calc_loop_triangles()
            floors.append((obj, BVHTree.FromPolygons(points, [list(face.vertices) for face in obj.data.loop_triangles], all_triangles=True)))
        elif lo.z < floor + .4 and hi.z > floor and lo.x < -7.5 and hi.x > -8.3 and lo.y < -6.5 and hi.y > -7.4:
            if any(material and ("glass" in material.name or material.diffuse_color[3] < .99) for material in obj.data.materials):
                continue
            obstacles.append((obj, lo, hi, BVHTree.FromPolygons(points, [list(face.vertices) for face in obj.data.polygons])))
    result, checks = {}, []
    from audit_coastal_overlaps import is_inside
    for avatar, data in footprints["avatars"].items():
        measured = reach["avatars"][avatar]
        if data["sourceGlbSha256"] != measured["sourceGlbSha256"]:
            raise RuntimeError(f"{avatar}: foot and reach evidence bind different delivered assets")
        sides = {}
        for side, dz in (("L", -.14), ("R", .14)):
            foot = data["sides"][side]
            leg = measured["sides"][side]
            seat_adjustment = [transfer["seat"]["position"][k] - reach["seat"][k] for k in range(3)]
            height_adjustment = seat_adjustment[1]
            hip = [leg["hipWorld"][k] + seat_adjustment[k] for k in range(3)]
            wanted_z = room["actor"][2] + dz
            offset = leg["soleToAnkleWorld"]
            dy, dz_ankle = hip[1] - floor - offset[1], hip[2] - wanted_z - offset[2]
            maximum = leg["upperLength"] + leg["lowerLength"] - .02
            if dy*dy + dz_ankle*dz_ankle >= maximum*maximum:
                raise RuntimeError(f"{avatar} {side}: shown duvet is too high for a real2cm-margin floor contact")
            extent = math.sqrt(maximum*maximum - dy*dy - dz_ankle*dz_ankle)
            interval = [hip[0] - offset[0] - extent, hip[0] - offset[0] + extent]
            preferred = transfer.get("feetByAvatar", {}).get(avatar, {}).get(side, {}).get("position", [leg["preferredSoleCenterX"]])[0]
            selected = min(interval[1] - .002, max(interval[0] + .002, preferred))
            wanted = [selected, floor, wanted_z]
            center = foot["center"]
            def placed(point):
                return Vector((wanted[0] - (point[2] - center[2]), -(wanted[2] + point[0] - center[0]), floor + point[1] - center[1]))
            samples = [placed(point) for point in foot["sole"]]
            contacts = []
            for point in samples:
                hits = []
                for obj, tree in floors:
                    hit, normal, polygon, distance = tree.ray_cast(point + Vector((0, 0, .05)), Vector((0, 0, -1)), .10)
                    if hit is not None:
                        hits.append((distance, obj, hit, normal, polygon))
                if not hits:
                    # The modeled boards have2mm joints and2mm bevels. A
                    # rigid sole bridges those real grooves; require an actual
                    # nearby source triangle within the unchanged3mm sole
                    # bound, not an invented plane across a stair opening.
                    nearby = [(tree.find_nearest(point), obj) for obj, tree in floors]
                    near, obj = min(nearby, key=lambda pair: pair[0][3] if pair[0][0] is not None else float("inf"))
                    if near[0] is None or near[3] > .003:
                        raise RuntimeError(f"{avatar} {side}: actual sole support gap at {list(point)}; nearest distance{near[3]}")
                    contacts.append({"position": [near[0].x, near[0].z, -near[0].y], "nativeSupport": obj.name,
                                     "nativeTriangle": near[2], "modeledBoardJointDistanceM": near[3]})
                    continue
                distance, obj, hit, normal, polygon = min(hits, key=lambda value: value[0])
                if (hit - point).length > .003 or normal.z < .5:
                    raise RuntimeError(f"{avatar} {side}: actual sole is more than3mm from its plank/bevel: {(hit-point).length}")
                contacts.append({"position": [hit.x, hit.z, -hit.y], "nativeSupport": obj.name, "nativeTriangle": polygon,
                                 "soleSurfaceDistanceM": (hit - point).length})
            point_cloud = [placed(point) for point in foot["points"]]
            tested, nearest = [], float("inf")
            for obj, lo, hi, tree in obstacles:
                # Exact separated bounds prove clearance to the entire real
                # bed/frame volume; overlapping bounds require native queries.
                for point in point_cloud:
                    hit = tree.find_nearest(point)
                    if hit[0] is not None:
                        nearest = min(nearest, hit[3])
                    if all(lo[k] + 1e-6 < point[k] < hi[k] - 1e-6 for k in range(3)) and is_inside(tree, point):
                        raise RuntimeError(f"{avatar} {side}: neutral decoded foot intersects {obj.name} at {list(point)}")
                tested.append(obj.name)
            native_point = Vector((wanted[0], -wanted[2], floor))
            central = min(((tree.ray_cast(native_point + Vector((0, 0, .05)), Vector((0, 0, -1)), .10), obj) for obj, tree in floors), key=lambda pair: pair[0][3] if pair[0][0] is not None else float("inf"))
            hit, obj = central
            if hit[0] is None:
                raise RuntimeError("The measured foot center lost native support")
            sides[side] = {"position": [hit[0].x, hit[0].z, -hit[0].y], "nativeSupport": obj.name,
                           "nativeTriangle": hit[2], "normal": [hit[1].x, hit[1].z, -hit[1].y]}
            checks.append({"avatar": avatar, "side": side, "sourceGlbSha256": data["sourceGlbSha256"],
                           "actualShownSeatY": transfer["seat"]["position"][1], "seatHeightChangeM": height_adjustment,
                           "seatTranslationFromMeasuredReferenceM": seat_adjustment,
                           "reachableSoleXIntervalWith2cmMargin": interval, "neutralPreferredX": preferred,
                           "selectedSoleX": selected,
                           "legReachSlackM": leg["upperLength"] + leg["lowerLength"] - math.dist(hip, [wanted[k] + offset[k] for k in range(3)]),
                           "fullFootVertices": len(point_cloud), "soleWitnessCount": len(contacts),
                           "soleContacts": contacts, "obstaclesTested": tested,
                           "minimumNativeObstacleDistanceM": nearest, "passed": True})
        result[avatar] = sides
    transfer["feetByAvatar"] = result
    transfer["footSourceGlbSha256"] = {avatar: data["sourceGlbSha256"] for avatar, data in footprints["avatars"].items()}
    transfer["footSourceEvidence"] = {"decodedFootprintsSha256": hashlib.sha256(footprints_path.read_bytes()).hexdigest(),
                                      "reachControlSha256": hashlib.sha256(reach_path.read_bytes()).hexdigest(),
                                      "scope": "Actual decoded neutral Foot-dominant points and all <=1mm sole witnesses against native planks and nearby real solids; final IK skin/whole transfer remains separate"}
    return {"source": transfer["footSourceEvidence"], "checks": checks}
