"""Verify native B stair support and the open and closed foyer sightlines."""

import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


def points(obj):
    return [obj.matrix_world @ v.co for v in obj.data.vertices]


def mesh_bounds(obj):
    corners = [obj.matrix_world @ Vector(p) for p in obj.bound_box]
    return [[fn(p[a] for p in corners) for a in range(3)] for fn in (min, max)]


def sight_bvh(scene, additionally=()):
    vertices, polygons, names = [], [], []
    objects = list(scene.objects) + list(additionally)
    for obj in objects:
        if obj.type != "MESH" or obj.hide_render or obj.get("shadowOnly") or obj.get("massingDiagram"):
            continue
        if obj.get("water") or obj.get("renderStyle") not in (None, "realistic"):
            continue
        materials = obj.data.materials
        first = len(vertices)
        appended = False
        for face in obj.data.polygons:
            material = materials[face.material_index] if face.material_index < len(materials) else None
            if material and any(key in material.name.lower() for key in ("glass", "glazing", "water", "diffuser")):
                continue
            if not appended:
                vertices.extend(points(obj))
                appended = True
            polygons.append(tuple(first + v for v in face.vertices))
            names.append(obj.name)
    return BVHTree.FromPolygons(vertices, polygons), names


def geometric_view(tree, eye, bearing=(0, 1), width=160, height=90, horizontal=60, masks=False):
    origin = Vector(eye)
    forward = Vector((bearing[0], bearing[1], 0)).normalized()
    right = Vector((forward.y, -forward.x, 0))
    horizontal_extent = math.tan(math.radians(horizontal) / 2)
    vertical_extent = horizontal_extent * height / width
    sky = sea = 0
    middle = [0] * width
    mask = []
    for j in range(height):
        y = vertical_extent * (1 - 2 * (j + 0.5) / height)
        line = []
        for i in range(width):
            x = horizontal_extent * (2 * (i + 0.5) / width - 1)
            direction = forward + right * x + Vector((0, 0, y))
            hit, _, _, _ = tree.ray_cast(origin, direction.normalized(), 280)
            cell = 0
            if hit is None and direction.y > 0:
                if y < 0:
                    sea += 1
                    cell = 1
                else:
                    sky += 1
                    cell = 2
            if masks:
                line.append(cell)
            if cell and j in (height // 2 - 1, height // 2):
                middle[i] += 1
        if masks:
            mask.append(line)
    count = width * height
    result = {
        "pixels": count,
        "seaPercent": 100 * sea / count,
        "skyPercent": 100 * sky / count,
        "visiblePercent": 100 * (sea + sky) / count,
        "horizonAcrossPercent": 100 * sum(v == 2 for v in middle) / width,
        "horizonVerticalPercent": 50 if any(v == 2 for v in middle) else None,
    }
    if masks:
        result["mask"] = mask
    return result


def route_geometry(door_nodes, section_skin=None):
    """Fingerprint the solids that carry the stair, shell, rock cut and pocket door."""
    digest = hashlib.sha256()
    for obj in sorted(bpy.context.scene.objects, key=lambda item: item.name):
        if obj.type != "MESH" or not (
            obj.name.startswith("core_arrival_")
            or obj.name in door_nodes
            or obj.name in ("core__golden coastal sandstone", "coast_shared_golden coastal sandstone")
        ):
            continue
        if section_skin and obj.name == "core__golden coastal sandstone":
            # The two freed roof bays legitimately reorder polygon indices.
            # The dedicated proof checks directed faces outside both cuts and
            # reconciles the retessellated plateau inside this exact stair.
            digest.update(section_skin["lineage"]["far"]["lineage"]["before"].encode("ascii"))
            digest.update(section_skin["lineage"]["arrival"]["lineage"]["before"].encode("ascii"))
            continue
        digest.update(obj.name.encode("utf-8"))
        digest.update(np.asarray(obj.matrix_world, dtype="<f4").tobytes())
        mesh = obj.data
        for data, prop, size, dtype in (
            (mesh.vertices, "co", 3, "<f4"),
            (mesh.loops, "vertex_index", 1, "<i4"),
            (mesh.polygons, "loop_total", 1, "<i4"),
            (mesh.polygons, "material_index", 1, "<i4"),
        ):
            values = np.empty(len(data) * size, dtype=dtype)
            data.foreach_get(prop, values)
            digest.update(values.tobytes())
    return digest.hexdigest()


parser = argparse.ArgumentParser()
parser.add_argument("--candidate", type=Path, required=True)
parser.add_argument("--build-receipt", type=Path, required=True)
parser.add_argument(
    "--route-source", type=Path, help="Hash-pinned builder output when verifying a later house revision"
)
parser.add_argument("--section-skin", type=Path, help="Verified retained cliff and plateau for a roof-section change")
parser.add_argument("--out", type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
d = json.loads(args.build_receipt.read_text())
assert len(d["routeProbes"]) == 61
candidate_sha = hashlib.sha256(args.candidate.read_bytes()).hexdigest()
retained_geometry = None
skin = json.loads(args.section_skin.read_bytes()) if args.section_skin else None
if skin and not (
    skin["passed"] and skin["candidateSha256"] == candidate_sha and skin["sourceSha256"] == d["outputSha256"]
):
    parser.error("The section skin proof must bind both full native files")
if d["outputSha256"] != candidate_sha:
    if args.route_source is None or hashlib.sha256(args.route_source.read_bytes()).hexdigest() != d["outputSha256"]:
        parser.error("The route recipe must identify the candidate or its original native stair")
    bpy.ops.wm.open_mainfile(filepath=str(args.route_source.resolve()))
    retained_geometry = route_geometry(d["door"]["nodes"], skin)
bpy.ops.wm.open_mainfile(filepath=str(args.candidate.resolve()))
if retained_geometry and route_geometry(d["door"]["nodes"], skin) != retained_geometry:
    raise ValueError("The candidate changed the protected native stair geometry")
scene = bpy.context.scene
closed_tree, _ = sight_bvh(scene)
hinge = d["door"]["pivot"]
pivot = Vector((hinge["x"], -hinge["z"], 0))
turn = Matrix.Translation(pivot) @ Matrix.Rotation(hinge["angle"], 4, "Z") @ Matrix.Translation(-pivot)
for name in d["door"]["nodes"]:
    leaf = scene.objects[name]
    assert leaf.get("estateDoor") == d["door"]["id"], name
    leaf.matrix_world = turn @ leaf.matrix_world
bpy.context.view_layer.update()
tree, names = sight_bvh(scene)
rows = []
for index, (x, z, yw) in enumerate(d["routeProbes"]):
    y = -yw
    offsets = (0, 0.19, -0.19)
    support = []
    clearance = []
    obstruction = []
    for side in offsets:
        down, _, face, _ = tree.ray_cast(Vector((x + side, y, z + 0.09)), Vector((0, 0, -1)), 0.35)
        sideSupport = {"dy": None if down is None else down.z - z, "owner": None if down is None else names[face]}
        support.append(sideSupport)
        hit, _, face, _ = tree.ray_cast(Vector((x + side, y, z + 0.058)), Vector((0, 0, 1)), 5)
        clearance.append(
            {"headroom": None if hit is None else hit.z - z, "owner": None if hit is None else names[face]}
        )
    for h in (0.65, 1.18, 1.75):
        for direction in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0)):
            hit, normal, face, gap = tree.ray_cast(Vector((x, y, z + h)), Vector(direction), 0.24)
            if hit is not None:
                obstruction.append({"atHeight": h, "direction": direction, "distance": gap, "owner": names[face]})
    rows.append(
        {"index": index, "foot": (x, y, z), "floor": support, "ceiling": clearance, "bodyProbeHits": obstruction}
    )

minimum = min(entry["headroom"] for row in rows for entry in row["ceiling"] if entry["headroom"] is not None)
bad_floor = [row for row in rows if any(v["dy"] is None or abs(v["dy"]) > 0.045 for v in row["floor"])]
low = [row for row in rows if any(v["headroom"] is not None and v["headroom"] < 1.90 for v in row["ceiling"])]
body = [row for row in rows if row["bodyProbeHits"]]
terminal = tuple(d["nativeTerminal"])
sight = geometric_view(tree, (terminal[0], terminal[1], terminal[2] + 1.6), width=160, height=90)
closed_samples = []
for index, (x, z, yw) in enumerate(d["routeProbes"][:-1]):
    eye = (x, -yw, z + 1.6)
    value = geometric_view(closed_tree, eye, width=80, height=45)
    closed_samples.append({"index": index, "eye": eye, **value})
closed_max = max(closed_samples, key=lambda row: row["visiblePercent"])
closed_landing = closed_samples[-1]
optics = {
    "closedApproachMaximum": closed_max,
    "closedLanding": closed_landing,
    "openTerminal": sight,
    "deltaPoints": sight["visiblePercent"] - closed_max["visiblePercent"],
    "passed": closed_max["visiblePercent"] < 2
    and sight["visiblePercent"] > 100 / 3
    and sight["horizonVerticalPercent"] is not None,
}

out = {
    "outputSha256": candidate_sha,
    "routeSourceSha256": d["outputSha256"],
    "rows": rows,
    "badFloor": bad_floor,
    "lowHeadroom": low,
    "bodyProbeHits": body,
    "minimumHeadroom": minimum,
    "afterOpen": sight,
    "optics": optics,
    "closedViewSamples": closed_samples,
    "passed": not (bad_floor or low or body),
    "scope": "Actual native Blender triangles with no cut masks. Glass and water are skipped for the ray test, so delivered walking remains necessary.",
}
if retained_geometry:
    out["retainedRouteGeometrySha256"] = retained_geometry
if skin:
    out["sectionSkin"] = {
        "proofSha256": hashlib.sha256(args.section_skin.read_bytes()).hexdigest(),
        "protectedFaces": skin["protectedPlateau"]["originalFaces"],
        "retainedDistantFaces": skin["lineage"]["far"]["sameFaceGeometry"],
        "plateauDifferenceSquareMetres": skin["protectedPlateau"]["clippedSymmetricDifference"],
    }
args.out.parent.mkdir(parents=True, exist_ok=True)
args.out.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8", newline="\n")
print(
    json.dumps(
        {
            "passed": out["passed"],
            "rows": len(rows),
            "minimum": minimum,
            "badFloor": [r["index"] for r in bad_floor],
            "lowHeadroom": [r["index"] for r in low],
            "bodyProbe": [r["index"] for r in body],
            "optics": optics,
        }
    )
)
