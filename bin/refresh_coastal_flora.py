"""Replant the clifftop and smooth its ground (Sirui, 2026-10-14); see coastal_flora.py.

Run with Blender 4.5 LTS from the repository root:
  blender -b --python-exit-code 1 --python bin/refresh_coastal_flora.py
then bin/bake_coastal_light.py and bin/optimize_coastal_exports.py -- --interiors-only.
The old sphere-crowned shrubs, groundcover discs and flower balls are cleared once; re-running
replaces only the new flora.
"""

import json
import math
import sys
from pathlib import Path
import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_decor as decor
import coastal_flora as flora

SOURCE = ROOT / "artwork/coastal-home/coastal-home.blend"
MANIFEST = ROOT / "assets/models/home/manifest.json"
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
for obj in [o for o in bpy.data.objects if o.get("flora")]:
    bpy.data.objects.remove(obj, do_unlink=True)
report = {}


def drop_islands(obj, keep):
    """Delete connected islands of a batched mesh for which keep(world points) is False."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    world = obj.matrix_world
    seen, doomed, islands = set(), [], 0
    for start in bm.verts:
        if start.index in seen:
            continue
        stack, island = [start], []
        seen.add(start.index)
        while stack:
            v = stack.pop()
            island.append(v)
            for e in v.link_edges:
                w = e.other_vert(v)
                if w.index not in seen:
                    seen.add(w.index)
                    stack.append(w)
        if not keep([world @ v.co for v in island]):
            doomed.extend(island)
            islands += 1
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return islands


if not scene.get("floraCleared"):
    # The old clifftop planting is every island above 5.5 m in the scrub and flower meshes, and the
    # small ones (shrub sticks) up there in the shared honey ash mesh.
    def old_planting(points, small_only):
        lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
        hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
        return lo.z > 5.5 and (not small_only or (hi - lo).length < 1.6)
    report["clearedIslands"] = {}
    for name in ("core__coastal sage scrub", "core__honey ash", "core__coastal wildflower ochre"):
        if name in bpy.data.objects:
            small_only = name == "core__honey ash"
            report["clearedIslands"][name] = drop_islands(bpy.data.objects[name], lambda points: not old_planting(points, small_only))
    scene["floraCleared"] = True
# A batched mesh the clearing emptied has nothing left to bake or export.
for name in ("core__coastal sage scrub", "core__coastal wildflower ochre"):
    obj = bpy.data.objects.get(name)
    if obj and not obj.data.polygons:
        bpy.data.objects.remove(obj, do_unlink=True)
        report.setdefault("removedEmpty", []).append(name)

# The ground is the retained mainland's actual surface, roof included.
graph = bpy.context.evaluated_depsgraph_get()
verts, polys = [], []
for name in ("core__golden coastal sandstone", "core_liftaway_cave_ceiling"):
    obj = bpy.data.objects[name]
    mesh = obj.evaluated_get(graph).to_mesh()
    base = len(verts)
    verts += [obj.matrix_world @ v.co for v in mesh.vertices]
    polys += [tuple(base + i for i in p.vertices) for p in mesh.polygons]
    obj.evaluated_get(graph).to_mesh_clear()
ground_tree = BVHTree.FromPolygons(verts, polys)


def ground_at(x, y):
    hit = ground_tree.ray_cast(Vector((x, y, 40)), Vector((0, 0, -1)), 60)
    return hit[0].z if hit[0] is not None and hit[0].z > 4.0 else None


config = json.loads(MANIFEST.read_text(encoding="utf-8"))
paths = [[(p[0], -p[2]) for p in h["path"]] for h in config["terrain"]["habitats"].values() if h["kind"] == "clifftop"]
well = config.get("lightWell", {}).get("top")
avoid = [(well[0], -well[2], 1.6)] if well else []
# The gulls' clifftop perches stay clear ground.
avoid += [(p[0], -p[2], 0.7) for p in config["terrain"]["perches"]]
for obj in scene.objects:
    if obj.type == "MESH" and "entry" in obj.name.lower():
        corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        cx, cy = sum(c.x for c in corners) / 8, sum(c.y for c in corners) / 8
        avoid.append((cx, cy, max(c - d for c, d in ((max(p.x for p in corners), cx), (max(p.y for p in corners), cy))) + 0.8))

mats = {
    "sage": decor.material("coastal sage leaf", (0.47, 0.52, 0.42), 0.82),
    "darkSage": decor.material("dark sage leaf", (0.23, 0.32, 0.21), 0.7),
    "stems": decor.material("sage stem wood", (0.32, 0.27, 0.22), 0.9),
    "flowers": bpy.data.materials["coastal wildflower ochre"],
    "pine": decor.material("torrey pine bark wood", (0.2, 0.13, 0.085), 0.9, refresh=True),
    "needles": decor.material("torrey pine needle leaf", (0.17, 0.27, 0.16), 0.62),
    "grass": decor.material("dry coastal grass leaf", (0.5, 0.4, 0.18), 0.9, refresh=True),
    "iceplant": decor.material("iceplant leaf", (0.21, 0.29, 0.05), 0.55, refresh=True),
    "iceFlowers": decor.material("iceplant flower", (0.72, 0.1, 0.42), 0.6),
}
objects, counts = flora.planting(mats, ground_at, paths, avoid)
for obj in objects.values():
    obj["flora"] = True
report["counts"] = counts
report["objects"] = {obj.name: {"vertices": len(obj.data.vertices), "faces": len(obj.data.polygons)} for obj in objects.values()}
report["avoid"] = [[round(a, 2) for a in item] for item in avoid]

# The clifftop was flat-shaded, so its 2 m triangles showed as facets: shade the up-facing faces
# smooth and keep the rim against the cliff face sharp.
smoothed = {}
for name in ("core__golden coastal sandstone", "core_liftaway_cave_ceiling"):
    obj = bpy.data.objects[name]
    normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
    count = 0
    for face in obj.data.polygons:
        if (normal_matrix @ face.normal).normalized().z > 0.35 and not face.use_smooth:
            face.use_smooth = True
            count += 1
    obj.data.set_sharp_from_angle(angle=math.radians(38))
    smoothed[name] = count
report["smoothedFaces"] = smoothed

# The planting ships as its own file, which the browser streams after the first frame.
config["flora"] = "flora.glb"
MANIFEST.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
(ROOT / "artwork/coastal-home/reviews/flora.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2), flush=True)
