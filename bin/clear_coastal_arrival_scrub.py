"""Clear complete native shrub islands that intrude into Arrival B's walkable shaft."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy
import sys

import bpy

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--repo", type=Path, required=True)
parser.add_argument("--source", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
root, source, output = (value.resolve() for value in (args.repo, args.source, args.output))
if output.exists():
    raise ValueError("Choose an unused output directory for the native clearing and its evidence")
sys.path.insert(0, str(root / "bin"))
from coastal_breakfast_nook import _islands, _subset

EXPECTED_SOURCE = "0dc3ee23166d6622a5a1315176b59cd2398c2cef45f09e479073728e2864ea2a"
OWNER = "hinterland_flora_10_09"
CANOPY = "hinterland scrub canopy"
AXIS = .195
WEST = AXIS - 1.90 + .11
EAST = AXIS + 1.26 - .11
FOOT = 14.42
GOING = .28
RISE = 8.3 / 48
LANDING = 1.4
TOP = 30.66
PORTAL_END = 31.85

def sha(file):
    with file.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()

def shaft_cells():
    # The delivery has 48 .28 m treads and two 1.4 m landings. Compute
    # the exact walking floor and the continuous sloping soffit as in Arrival B.
    shelves, grade = [], [(FOOT, 0)]
    run, level = FOOT, 0.
    for flight, count in enumerate((15, 16, 17)):
        for index in range(count):
            level += RISE
            shelves.append((run, run + GOING, level))
            run += GOING
        if flight < 2:
            shelves.append((run, run + LANDING, level))
            grade.extend(((run, level), (run + LANDING, level)))
            run += LANDING
    assert abs(run - TOP) < 1e-8 and abs(level - 8.3) < 1e-8
    grade.append((TOP,8.3))
    cells = []
    for (roof_start, floor_low), (roof_end, floor_high) in zip(grade, grade[1:]):
        slope = (floor_high - floor_low) / (roof_end - roof_start)
        ceiling_intercept = floor_low + 2.20 - slope * roof_start
        for tread_start, tread_end, tread_level in shelves:
            start, end = max(tread_start, roof_start), min(tread_end, roof_end)
            if end - start > 1e-8:
                cells.append((WEST, EAST, start, end, tread_level, slope, ceiling_intercept))
    cells.append((AXIS-1.115, AXIS+1.115, TOP, PORTAL_END, 8.30, 0., 10.50))
    return cells

def clipped(triangle, cell):
    x0, x1, z0, z1, floor, slope, ceiling = cell
    eps = 1e-8
    planes = (
        lambda p: p[0] - x0,
        lambda p: x1 - p[0],
        lambda p: p[2] - z0,
        lambda p: z1 - p[2],
        lambda p: p[1] - floor,
        lambda p: ceiling + slope * p[2] - p[1],
    )
    polygon = triangle
    for height in planes:
        if not polygon:
            return False
        incoming, polygon = polygon, []
        previous = incoming[-1]
        previous_value = height(previous)
        for current in incoming:
            value = height(current)
            if (value >= -eps) is not (previous_value >= -eps):
                fraction = previous_value / (previous_value - value)
                polygon.append(tuple(a + (b - a) * fraction for a, b in zip(previous, current)))
            if value >= -eps:
                polygon.append(current)
            previous, previous_value = current, value
    return len(polygon) >= 3

def inspect(scene):
    cells = shaft_cells()
    matches = []
    for obj in sorted(scene.objects, key=lambda o: o.name):
        if obj.type != "MESH" or not obj.name.startswith(("hinterland_flora", "hinterland_talus")):
            continue
        world = [obj.matrix_world @ v.co for v in obj.data.vertices]
        web = [(v.x, v.z, -v.y) for v in world]
        blob_min = tuple(min(col) for col in zip(*web))
        blob_max = tuple(max(col) for col in zip(*web))
        if blob_min[0] > EAST or blob_max[0] < WEST or blob_max[2] < FOOT or blob_min[2] > PORTAL_END:
            continue
        obj.data.calc_loop_triangles()
        triangles = {}
        for tri in obj.data.loop_triangles:
            triangles.setdefault(tri.polygon_index, []).append(tuple(web[v] for v in tri.vertices))
        for part in _islands(obj):
            sample = [web[v] for v in part["vertices"]]
            lo = tuple(min(col) for col in zip(*sample))
            hi = tuple(max(col) for col in zip(*sample))
            if hi[0] < WEST or lo[0] > EAST or hi[2] < FOOT or lo[2] > PORTAL_END:
                continue
            possible = [c for c in cells if hi[0] >= c[0] and lo[0] <= c[1] and hi[2] >= c[2] and lo[2] <= c[3] and hi[1] >= c[4]]
            if not possible:
                continue
            hits = sorted(
                idx for idx in part["faces"]
                if any(clipped(tri, cell) for tri in triangles[idx] for cell in possible)
            )
            if hits:
                faces = sorted(part["faces"])
                matches.append({
                    "owner": obj.name, "materials": sorted({obj.data.materials[obj.data.polygons[i].material_index].name for i in faces}),
                    "webBounds": [lo, hi], "vertices": sorted(part["vertices"]), "faces": faces, "intersectingFaces": hits,
                })
    return matches

if bpy.app.version != (4, 5, 9) or sha(source) != EXPECTED_SOURCE:
    raise RuntimeError("The expected Blender 4.5.9 exact hinterland source is required")
bpy.ops.wm.open_mainfile(filepath=str(source))
verification = runpy.run_path(str(root / "artwork/coastal-home/reviews/bedroom-ambience-2026-11-01/replay_lighting.py"))
before = verification["native_state"]()
materials = verification["materials"]()

output.mkdir(parents=True)
matches = inspect(bpy.context.scene)
(output / "NATIVE-MATCHES.json").write_text(json.dumps(matches, indent=2) + "\n", encoding="utf-8")
print(json.dumps([(m["owner"], m["materials"], m["webBounds"], len(m["faces"]), len(m["intersectingFaces"])) for m in matches]), flush=True)
if not matches or any(m["owner"] != OWNER or m["materials"] != [CANOPY] for m in matches):
    raise RuntimeError("Clearance intersects an unexpected mesh/material")
owner = bpy.data.objects[OWNER]
original = owner.data
remove = set(face for match in matches for face in match["faces"])
keep = sorted(set(range(len(original.polygons))) - remove)
subset = _subset(original, set(keep), OWNER + " Arrival B clear")
old_fields = [original.polygons[i].material_index for i in keep]
assert [p.material_index for p in subset.polygons] == old_fields
assert list(original.materials) == list(subset.materials)
owner.data = subset
assert not inspect(bpy.context.scene), "A native flora/talus triangle remains inside the walking shaft"
after = verification["native_state"]()
assert materials == verification["materials"]()
assert all(digest == after[name] for name, digest in before.items() if name != OWNER)
bpy.context.preferences.filepaths.save_version = 0
candidate = output / "hinterland.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(candidate), compress=True)
bpy.ops.wm.open_mainfile(filepath=str(candidate))
assert verification["native_state"]() == after
assert verification["materials"]() == materials
assert sha(source) == EXPECTED_SOURCE

# Export just the owner. The companion splice retains every other original
# compressed primitive and its vertex buffers, materials, and transforms.
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = bpy.data.objects[OWNER]
bpy.context.view_layer.objects.active.select_set(True)
asset = output / "flora-owner.glb"
bpy.ops.export_scene.gltf(
    filepath=str(asset), export_format="GLB", use_selection=True, export_extras=True,
    export_cameras=False, export_lights=False, export_animations=False, export_texcoords=False,
    export_normals=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_image_format="NONE",
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=16, export_draco_normal_quantization=10, export_draco_color_quantization=8,
)
receipt = {
    "sourceSha256": EXPECTED_SOURCE, "candidateSha256": sha(candidate), "matchedOwner": OWNER,
    "nativeMeshCount": len(before), "identicalOtherMeshes": len(before) - 1, "retiredIslands": len(matches),
    "retiredFaces": len(remove), "retainedFaces": len(keep), "ownerExportSha256": sha(asset),
    "emptyNativeShaftAfter": True,
}
(output / "NATIVE-VERIFICATION.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
print(json.dumps(receipt), flush=True)
