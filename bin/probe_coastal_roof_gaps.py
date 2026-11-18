"""Slits of open air between the top of the house and the rock above it (Blender background).

Sirui, November 18, 2026: "make sure there are not weird gap between top of house and rock". Walks straight up
from the floor over a grid of points and reports where a house surface's top meets open air and then rock from
below less than 1.5 m higher: a slit a visitor sees as a line of sky or a dark seam. Zones are the gym's front
and the passage in front of the study; add zones as the house grows. Run from the repository root:
  blender -b --python-exit-code 1 --python bin/probe_coastal_roof_gaps.py
Found on November 18: none in the study passage; at the gym's front frame (core_gym_front_frame) slits of
0.19 to 1.05 m below the sandstone, and 1.25 to 1.35 m over the dining pavilion's pergola (to be removed).
"""
import bpy
from mathutils import Vector

bpy.ops.wm.open_mainfile(filepath="c:/dev/dylantao.github.io/artwork/coastal-home/coastal-home.blend")
scene = bpy.context.scene
deps = bpy.context.evaluated_depsgraph_get()


def rock(name):
    n = name.lower()
    return "sandstone" in n or "rock" in n or "cliff" in n or "coast_shared" in n or n.startswith("core__")


def column(x, y):
    hits, z = [], 0.3
    for _ in range(12):
        hit, loc, normal, i, obj, m = scene.ray_cast(deps, Vector((x, y, z)), Vector((0, 0, 1)), distance=30)
        if not hit:
            break
        hits.append((round(loc.z, 2), obj.name, normal.z > 0))
        z = loc.z + 0.005
    return hits


zones = {"gym front": [(x * 0.5, y * 0.5) for x in range(6, 24) for y in range(-14, 12)], "study passage": [(-12.5 + x * 0.5, y * 0.5) for x in range(0, 10) for y in range(-2, 26)]}
for zone, points in zones.items():
    slits = []
    for x, y in points:
        hits = column(x, y)
        for (z0, n0, up0), (z1, n1, up1) in zip(hits, hits[1:]):
            # leaving a house surface upward (its top, normal up) into air, then meeting rock from below
            if not rock(n0) and up0 and rock(n1) and not up1 and 0.01 < z1 - z0 < 1.5:
                slits.append((x, y, z0, round(z1 - z0, 2), n0, n1))
    print("ZONE", zone, "points", len(points), "slits", len(slits))
    for s in slits[:25]:
        print("  SLIT", s)
