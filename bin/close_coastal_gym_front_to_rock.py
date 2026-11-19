"""Close the gym's glazed front up to the rock above it (Blender background).

Sirui, November 18, 2026: "make sure there are not weird gap between top of house and rock". The probe
(bin/probe_coastal_roof_gaps.py) found slits of 0.19 to 1.05 m between the top of `core_gym_front_frame` and
the sandstone over it. bin/refresh_coastal_gym.py is stale (its glass line predates the house's later moves),
so this works from the house file as it is: it reads the frame's top edge in world space, casts upward from
points along it, and builds `core_gym_front_header`, a sandstone header from just under the edge to 5 cm into
whatever is above. Without --save it builds in memory, checks every point again and saves nothing.

Run from the repository root:
  blender -b --python-exit-code 1 --python bin/close_coastal_gym_front_to_rock.py [-- --save]
After --save: export the shell, bake the header's light (bin/bake_coastal_light.py with
--prefixes=core_gym_front_header), re-bake the static light cache, rebuild the loading sketch, and run the probe.
"""

import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SAVE = "--save" in sys.argv
bpy.ops.wm.open_mainfile(filepath=str(ROOT / "artwork/coastal-home/coastal-home.blend"))
scene = bpy.context.scene
if "core_gym_front_header" in bpy.data.objects:
    bpy.data.objects.remove(bpy.data.objects["core_gym_front_header"], do_unlink=True)
frame = bpy.data.objects["core_gym_front_frame"]
points = [frame.matrix_world @ v.co for v in frame.data.vertices]

# The frame's run in plan: its two farthest-apart points; the top edge is the highest vertex in each slice.
a = max(points, key=lambda p: (p - points[0]).xy.length)
b = max(points, key=lambda p: (p - a).xy.length)
run = (b - a).xy
length = run.length
along = Vector((run.x, run.y, 0)) / length
across = Vector((-along.y, along.x, 0)) * 0.06
SLICES = 48
tops = [None] * (SLICES + 1)
for p in points:
    k = round(((p - a).xy.dot(run) / length / length) * SLICES)
    if 0 <= k <= SLICES and (tops[k] is None or p.z > tops[k].z):
        tops[k] = p.copy()
for k in range(SLICES + 1):
    if tops[k] is None:
        tops[k] = tops[k - 1] if k else tops[k + 1]

deps = bpy.context.evaluated_depsgraph_get()


def above(p):
    hit, loc, _n, _i, obj, _m = scene.ray_cast(deps, p + Vector((0, 0, 0.03)), Vector((0, 0, 1)), distance=3.0)
    return (loc.z, obj.name) if hit else (None, None)


header = bmesh.new()
built = 0
for p0, p1 in zip(tops, tops[1:]):
    r0, r1 = above(p0)[0], above(p1)[0]
    if r0 is None or r1 is None or max(r0 - p0.z, r1 - p1.z) < 0.03:
        continue
    corners = []
    for p, r in ((p0, r0), (p1, r1)):
        for side in (-1, 1):
            o = p + across * side
            corners += [header.verts.new((o.x, o.y, p.z - 0.02)), header.verts.new((o.x, o.y, r + 0.05))]
    a0, a1, b0, b1, c0, c1, d0, d1 = corners
    for quad in ((a0, b0, d0, c0), (a1, c1, d1, b1), (a0, a1, b1, b0), (c0, d0, d1, c1), (a0, c0, c1, a1), (b0, b1, d1, d0)):
        header.faces.new(quad)
    built += 1
mesh = bpy.data.meshes.new("core_gym_front_header")
header.to_mesh(mesh)
header.free()
mesh.materials.append(bpy.data.materials["golden coastal sandstone"])
obj = bpy.data.objects.new("core_gym_front_header", mesh)
for collection in frame.users_collection:
    collection.objects.link(obj)
obj["gymRoom"] = True

# What it fills: the gap from each edge point to whatever is above it, before the header. (A ray cast from inside
# the header meets the rock's underside first, since the header runs 5 cm into it, so check the gaps, not hits.)
gaps = [r - p.z for p in tops for r in [above(p)[0]] if r is not None]
print(f"GYM HEADER: run {length:.2f} m from {tuple(round(c, 2) for c in a)} to {tuple(round(c, 2) for c in b)}; {built} of {SLICES} steps built, filling gaps of {min(gaps):.2f} to {max(gaps):.2f} m", flush=True)
if SAVE:
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_mainfile()
    print("SAVED", bpy.data.filepath, flush=True)
