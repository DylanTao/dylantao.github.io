"""Restore the unchanged native talus batch lost by a disjoint entrance Boolean.

The baseline is extracted from the exact retained Git source. No rocks are synthesized and
the new entrance excavation, room geometry and anchors remain unchanged. Subsequent runs
verify the same native geometry and preserve the source's bytes instead of resaving it.
"""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_shell as shell
from build_coastal_perch_support import ROOSTS

BASE = "8c1e16c318dd22d700d2b363244bb85fccb82f17"
BASE_HASH = "342dd722b1946a25c7aca67be1081cae143fd40f2ff50266678cd3c3e993865b"
NAME = "coast_shared_golden coastal sandstone"
source = ROOT / "artwork/coastal-home/coastal-home.blend"
receipt = ROOT / "artwork/coastal-home/reviews/arrival-living/talus-repair.json"
baseline = ROOT / ".jekyll-cache/arrival-talus-baseline.blend"
baseline.parent.mkdir(parents=True, exist_ok=True)
data = subprocess.check_output(["git", "show", f"{BASE}:artwork/coastal-home/coastal-home.blend"], cwd=ROOT)
assert hashlib.sha256(data).hexdigest() == BASE_HASH
baseline.write_bytes(data)
before_hash = hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
target = bpy.data.objects[NAME]


def islands(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    records = []
    for vertices in shell._islands(bm):
        chosen = set(vertices)
        points = [obj.matrix_world @ v.co for v in vertices]
        native_faces = [f for f in bm.faces if f.verts[0] in chosen]
        faces = sorted(tuple(sorted(tuple(round(c, 7) for c in obj.matrix_world @ v.co) for v in f.verts)) for f in native_faces)
        material_counts = {}
        for face in native_faces:
            material = obj.data.materials[face.material_index].name if face.material_index < len(obj.data.materials) else "missing-slot"
            material = re.sub(r"\.\d{3}$", "", material)
            material_counts[material] = material_counts.get(material, 0)+1
        records.append({"vertices": len(vertices), "faces": len(faces),
                        "min": [min(p[k] for p in points) for k in range(3)],
                        "max": [max(p[k] for p in points) for k in range(3)],
                        "geometrySha256": hashlib.sha256(json.dumps(faces, separators=(",", ":")).encode()).hexdigest(),
                        "materialBindings": material_counts})
    bm.free()
    return sorted(records, key=lambda item: item["geometrySha256"])


def roosts(obj):
    tree = BVHTree.FromPolygons([obj.matrix_world @ v.co for v in obj.data.vertices],
                               [tuple(p.vertices) for p in obj.data.polygons])
    rows = []
    for name, (x, h, z) in ROOSTS:
        point, _, _, _ = tree.ray_cast(Vector((x, -z, h+.2)), Vector((0, 0, -1)), .5)
        rows.append({"id": name, "expected": h, "height": None if point is None else point.z})
    return rows


def bindings(obj):
    result = {}
    for face in obj.data.polygons:
        name = obj.data.materials[face.material_index].name if face.material_index < len(obj.data.materials) else "missing-slot"
        name = re.sub(r"\.\d{3}$", "", name)
        result[name] = result.get(name, 0) + 1
    return result


original = islands(target)
original_roosts = roosts(target)
already_restored = scene.get("arrivalTalusRestoredVersion", 0) >= 2
materials_before = set(bpy.data.materials)
with bpy.data.libraries.load(str(baseline), link=False) as (available, loaded):
    assert NAME in available.objects
    loaded.objects = [NAME]
donor = loaded.objects[0]
expected = islands(donor)
expected_bindings = bindings(donor)
assert len(expected) == 96

# Verify the robust authoring guard on the real batch, rather than relying on its hash.
# The actual entrance cutters miss every component (coast top -.26m, cutters start -.20m).
probe = target.copy()
probe.data = donor.data.copy()
scene.collection.objects.link(probe)
actual_tool = shell._box_object("talus disjoint-cut regression", (-3.68, -9.58, -.20), (2.51, -7.10, 5.30), target.data.materials[0])
probe_before = islands(probe)
disjoint = shell.boolean_preserving_islands(probe, actual_tool)
assert disjoint["skippedDisjoint"] and islands(probe) == probe_before
bpy.data.objects.remove(actual_tool, do_unlink=True)
probe_data = probe.data
bpy.data.objects.remove(probe, do_unlink=True)
bpy.data.meshes.remove(probe_data)

# Exercise the less trivial case too: a tool intersects the big native terrain component,
# while all 95 disconnected rocks must retain their exact polygons and positions.
probe = target.copy()
probe.data = donor.data.copy()
scene.collection.objects.link(probe)
partial_tool = shell._box_object("talus partial-cut regression", (-.6, -20.6, -9), (.6, -19.4, -.30), target.data.materials[0])
before_partial = islands(probe)
protected = [item for item in before_partial if any(item["min"][k] > (.6, -19.4, -.30)[k]+1e-5
             or item["max"][k] < (-.6, -20.6, -9)[k]-1e-5 for k in range(3))]
partial = shell.boolean_preserving_islands(probe, partial_tool)
after_partial = {item["geometrySha256"]: item for item in islands(probe)}
assert not partial["skippedDisjoint"] and len(protected) == 95
assert all(after_partial.get(item["geometrySha256"]) == item for item in protected)
bpy.data.objects.remove(partial_tool, do_unlink=True)
probe_data = probe.data
bpy.data.objects.remove(probe, do_unlink=True)
bpy.data.meshes.remove(probe_data)

if not already_restored:
    slots = [bpy.data.materials.get(re.sub(r"\.\d{3}$", "", mat.name)) or mat for mat in donor.data.materials]
    old = target.data
    restored = donor.data.copy()
    # Rebind slots in place: clearing a Blender material list also resets polygon indices.
    for index, mat in enumerate(slots):
        restored.materials[index] = mat
    target.data = restored
    if old.users == 0:
        bpy.data.meshes.remove(old)
    scene["arrivalTalusRestoredFrom"] = BASE_HASH
    scene["arrivalTalusRestoredVersion"] = 2
assert islands(target) == expected, "all 96 native component bounds and polygons match retained source"
assert bindings(target) == expected_bindings, "preserve native sandstone bedding material assignments"
final_roosts = roosts(target)
assert all(row["height"] is not None and abs(row["height"]-row["expected"]) < .001 for row in final_roosts)
donor_data = donor.data
native_data_name = re.sub(r"\.\d{3}$", "", donor_data.name)
bpy.data.objects.remove(donor, do_unlink=True)
if donor_data.users == 0:
    bpy.data.meshes.remove(donor_data)
if not already_restored:
    target.data.name = native_data_name
for mat in set(bpy.data.materials)-materials_before:
    if mat.users == 0:
        bpy.data.materials.remove(mat)
if not already_restored:
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
after_hash = hashlib.sha256(source.read_bytes()).hexdigest()
if already_restored:
    assert after_hash == before_hash, "repeat verification must not alter source bytes"
report = json.loads(receipt.read_text()) if receipt.exists() else {
    "baselineCommit": BASE, "baselineSourceSha256": BASE_HASH,
    "sourceSha256BeforeRepair": before_hash, "originalComponentCount": len(original),
    "originalRoosts": original_roosts}
report.update(sourceSha256AfterRepair=after_hash, restoredComponentCount=len(expected),
              restoredComponents=expected, restoredRoosts=final_roosts,
              nativeMaterialBindings=expected_bindings,
              disjointGuard=disjoint, partialGuard=partial, exactProtectedComponents=95,
              repeatedRunPreservesSourceBytes=already_restored)
receipt.write_text(json.dumps(report, indent=2)+"\n")
print("TALUS_REPAIR", json.dumps({k:v for k,v in report.items() if k != "restoredComponents"}), flush=True)
