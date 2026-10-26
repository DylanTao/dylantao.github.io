"""Keep the hinterland's planting and talus clear of the house's built arrival (2026-10-25).

The hinterland's transition planting and talus were laid on the clifftop before the arrival hall's
pavilion, forecourt, paths and oculi stood there, so shrubs grew inside the pavilion's portal. Run
after the house refresh, from the repository root:

    blender -b --python-exit-code 1 --python bin/coastal_hinterland_clearings.py

It opens artwork/coastal-home/hinterland.blend, reads the arrival's built surfaces at grade from the
house source (read-only), and removes every whole flora or talus part whose centre stands within
CLEARANCE of them, or any of whose vertices comes within TOUCH: the transition planting's own rule
(build_coastal_hinterland.py keeps 2.2 m from occupied vertices), applied after the fact. It then
re-exports assets/models/home/hinterland.glb exactly as coastal_water_garden.py last did, saves the source and
writes its report beside the house review. A file already cleared at this version is left alone.
"""
import json
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_shell as shell  # noqa: E402

VERSION = 2
SOURCE = ROOT / "artwork/coastal-home/coastal-home.blend"
TARGET = ROOT / "artwork/coastal-home/hinterland.blend"
EXPORT = ROOT / "assets/models/home/hinterland.glb"
REPORT = ROOT / "artwork/coastal-home/reviews/house-2026-10-24/hinterland-clearings.json"
BUILT = ("core_arrival_court", "core_arrival_paths")  # the pavilion, forecourt, oculi rims and paths
CLEARED = ("hinterland_flora", "hinterland_talus")
CLEARANCE = 2.2
TOUCH = 1.0

bpy.ops.wm.open_mainfile(filepath=str(TARGET))
scene = bpy.context.scene
if scene.get("arrivalClearingsVersion") == VERSION:
    print(json.dumps({"retained": True, "version": VERSION}), flush=True)
    sys.exit(0)

with bpy.data.libraries.load(str(SOURCE), link=False) as (src, dst):
    dst.objects = [name for name in src.objects if name.startswith(BUILT)]
points = []
for obj in dst.objects:
    points.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
built = {obj.name: len(obj.data.vertices) for obj in dst.objects}
for obj in dst.objects:
    mesh = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if mesh.users == 0:
        bpy.data.meshes.remove(mesh)
if not points:
    raise RuntimeError("the house source has no built arrival to keep clear of")
tree = KDTree(len(points))
for k, p in enumerate(points):
    tree.insert(p, k)
tree.balance()

removed = {}
for obj in [o for o in scene.objects if o.type == "MESH" and o.name.startswith(CLEARED)]:
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    doomed, parts = [], 0
    for island in shell._islands(bm):
        world = [obj.matrix_world @ v.co for v in island]
        centre = sum(world, Vector()) / len(world)
        if tree.find(centre)[2] < CLEARANCE or any(tree.find(p)[2] < TOUCH for p in world[::4]):
            doomed.extend(island)
            parts += 1
    if doomed:
        bmesh.ops.delete(bm, geom=doomed, context="VERTS")
        bm.to_mesh(obj.data)
        obj.data.update()
        removed[obj.name] = parts
    bm.free()

scene["arrivalClearingsVersion"] = VERSION
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=str(EXPORT), export_format="GLB", use_selection=True, export_extras=True, export_cameras=False, export_lights=False,
    export_animations=False, export_texcoords=False, export_normals=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
    export_image_format="NONE", export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7, export_draco_position_quantization=16, export_draco_normal_quantization=10,
    export_draco_color_quantization=8,
)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET), compress=True)
report = {"version": VERSION, "builtVertices": built, "clearance": CLEARANCE, "touch": TOUCH, "removedParts": removed,
          "export": {"bytes": EXPORT.stat().st_size}}
REPORT.write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8", newline="\n")
print(json.dumps(report), flush=True)
