"""Prove the garden approach to the retained native stair head.

blender -b artwork/coastal-home/coastal-home.blend --python-exit-code 1 \
  --python bin/audit_coastal_garden_approach.py -- --report <output.json>
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


BEARING = "core_garden_threshold_apron_bearing"
PLINTH = "core_arrival_B_portal_plinth"
BODY_RADIUS = .24
BODY_HEIGHT = 1.75
STATIONS = 321
STRUCTURE = (
    "core_arrival_", "core_garden_threshold_", "core__golden",
    "coast_shared_golden", "core_entry_landscape_sandstone", "core_retreat",
)


def native(value):
    x, y, z = value
    return Vector((x, -z, y))


def web(value):
    x, y, z = value
    return [x, z, -y]


def make_structure(scene, start, end):
    coordinates, triangles, owners = [], [], []
    for obj in scene.objects:
        if obj.type != "MESH" or not obj.name.startswith(STRUCTURE) or obj.get("walk") == "through" or obj.get("shadowOnly"):
            continue
        matrix = obj.matrix_world
        corners = [matrix @ Vector(corner) for corner in obj.bound_box]
        if any(
            max(point[axis] for point in corners) < min(start[axis], end[axis]) - 1.0
            or min(point[axis] for point in corners) > max(start[axis], end[axis]) + 1.0
            for axis in (0, 1)
        ):
            continue
        mesh = obj.data
        mesh.calc_loop_triangles()
        ignored = {
            index for index, material in enumerate(mesh.materials) if material and
            any(tag in material.name.lower() for tag in ("glazing", "low-iron glass", "water", "foam", "ocean"))
        }
        offset = len(coordinates)
        coordinates.extend(matrix @ vertex.co for vertex in mesh.vertices)
        for triangle in mesh.loop_triangles:
            if triangle.material_index in ignored:
                continue
            triangles.append(tuple(offset + index for index in triangle.vertices))
            owners.append(obj.name)
    if not triangles:
        raise ValueError("No solid entrance triangles in the opened native file")
    return BVHTree.FromPolygons(coordinates, triangles, all_triangles=True), owners


def approach(scene, manifest):
    entry = manifest["walk"]["places"]["entrance"]
    start, end = native(entry["position"]), native(manifest["walk"]["start"]["position"])
    structure, owners = make_structure(scene, start, end)
    down = Vector((0, 0, -1))
    up = -down

    def floor(x, y):
        origin = Vector((x, y, max(start.z, end.z) + 8))
        for _ in range(30):
            point, normal, face, _ = structure.ray_cast(origin, down, 12)
            if point is None or point.z < min(start.z, end.z) - .72:
                break
            if point.z < max(start.z, end.z) + 1.4 and normal.z >= .68:
                return point, owners[face]
            origin = point + down * .003
        raise ValueError(f"No walkable native floor at {x:.4f}, {-y:.4f}")

    ring = [(BODY_RADIUS * math.cos(i * math.tau / 8), BODY_RADIUS * math.sin(i * math.tau / 8)) for i in range(8)]
    directions = [Vector((math.cos(i * math.tau / 16), math.sin(i * math.tau / 16), 0)) for i in range(16)]
    center_height_changes, rim_height_changes, roof_clearances, wall_clearances = [], [], [], []
    supports = []
    heights = []
    for i in range(STATIONS):
        station = start.lerp(end, i / (STATIONS - 1))
        point, owner = floor(station.x, station.y)
        supports.append(owner)
        heights.append(point.z)
        if i:
            center_height_changes.append(abs(heights[-1] - heights[-2]))
        for dx, dy in ring:
            floor_at_rim, _ = floor(point.x + dx, point.y + dy)
            rim_height_changes.append(abs(floor_at_rim.z - point.z))
        hit, _, _, distance = structure.ray_cast(point + up * .035, up, 10)
        if hit is not None:
            roof_clearances.append(distance + .035)
        for height in (.36, 1.1, 1.65):
            for direction in directions:
                hit, _, _, distance = structure.ray_cast(point + up * height, direction, .95)
                if hit is not None:
                    wall_clearances.append(distance)

    min_roof = min(roof_clearances, default=10)
    min_wall = min(wall_clearances, default=.95)
    if supports[0] != BEARING or supports[-1] != PLINTH or set(supports) != {BEARING, PLINTH}:
        raise ValueError(f"Garden approach uses unexpected supports: {sorted(set(supports))}")
    if max(rim_height_changes) > .30 or min_roof < BODY_HEIGHT or min_wall < BODY_RADIUS + .02:
        raise ValueError("The native capsule cannot clear the approved garden approach")
    residual = [abs(heights[0] - start.z), abs(heights[-1] - end.z)]
    if max(residual) > .002:
        raise ValueError("Native floor differs from a manifested support height by more than 2 mm")
    return {
        "walkPlace": entry,
        "eyeHeightM": 1.60,
        "retainedStairHead": web(end),
        "stations": STATIONS,
        "spacingM": math.hypot(end.x - start.x, end.y - start.y) / (STATIONS - 1),
        "minHeadroomM": min_roof,
        "minCenterToSolidM": min_wall,
        "maxFootprintHeightChangeM": max(rim_height_changes),
        "maxStationHeightChangeM": max(center_height_changes),
        "startAndFinishSupportErrorM": residual,
        "supportedBy": sorted(set(supports)),
    }


def bounded_overlap(scene, root):
    # Reuse the full audit's collision, classification and coplanarity criteria.
    sys.path.insert(0, str(root / "bin"))
    import audit_coastal_overlaps as audit

    meshes, _ = audit.collect(scene)
    subject = next(mesh for mesh in meshes if mesh["name"] == BEARING)
    lo, hi = subject["lo"] - .012, subject["hi"] + .012
    nearby = [mesh for mesh in meshes if np.all(mesh["hi"] >= lo) and np.all(mesh["lo"] <= hi)]
    trees = audit.build_trees(nearby)
    sites, _, _, _ = audit.interpenetration(nearby, trees)
    coplanar, _ = audit.coplanar_overlaps(nearby, trees)
    bearing_sites = [site for site in sites if BEARING in {site["a"], site["b"]}]
    for site in bearing_sites:
        audit.classify(site)
    offenders = [site for site in bearing_sites if site["severity"] > 0]
    zfighting = [row for row in coplanar if BEARING in {row["a"], row["b"]} and row["verdict"] == "z-fighting"]
    if offenders or zfighting:
        raise ValueError(f"Fitted bearing adds {len(offenders)} overlap offenders and {len(zfighting)} z-fighting pairs")
    return {
        "scannedMeshes": [mesh["name"] for mesh in nearby],
        "bearingSites": len(bearing_sites),
        "offenders": len(offenders),
        "zFightingPairs": len(zfighting),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    root = args.repo.resolve()
    manifest_path = args.manifest or root / "assets/models/home/manifest.json"
    manifest_text = manifest_path.read_bytes()
    scene = bpy.context.scene
    source = Path(bpy.data.filepath).resolve()
    if not source.is_file():
        raise ValueError("Open the retained native master before running the approach audit")
    bpy.context.view_layer.update()
    result = {
        "source": source.relative_to(root).as_posix() if source.is_relative_to(root) else source.name,
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "manifestSha256": hashlib.sha256(manifest_text).hexdigest(),
        "route": approach(scene, json.loads(manifest_text)),
        "overlap": bounded_overlap(scene, root),
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
