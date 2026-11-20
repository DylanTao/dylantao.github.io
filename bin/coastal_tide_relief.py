"""Fit an original folded ceramic relief to the exposed face of the pool girder.

Run in Blender against the November coastal master, with --save-as=FILE.
The open channels between tiles follow the existing concrete construction joints.
"""

import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import coastal_decor as decor

PREFIX = "core_pool_tide_relief_"
MATERIALS = (
    ("limestone slip", (0.52, 0.435, 0.335), 0.56),
    ("smoke blue ceramic", (0.16, 0.195, 0.238), 0.54),
    ("iron oxide clay", (0.355, 0.211, 0.151), 0.72),
)


def exposed_supports(scene):
    surfaces = []
    for name in (
        "core_finish_pool_front_box_girder",
        "coast_shared_golden coastal sandstone",
    ):
        obj = scene.objects[name]
        surfaces.append(
            (
                name,
                BVHTree.FromPolygons(
                    [obj.matrix_world @ v.co for v in obj.data.vertices],
                    [p.vertices[:] for p in obj.data.polygons],
                ),
            )
        )
    # This basalt shelf is dry at the base of the house. A finished wave reads
    # across the different depths of its bearing and girder from a visitor eye.
    foot = Vector((-6.0, 11.0, -4.4))
    ok, point, _, _, owner, _ = scene.ray_cast(
        bpy.context.evaluated_depsgraph_get(), foot, Vector((0, 0, -1)), distance=3.0
    )
    if not ok or "sandstone" not in owner.name:
        raise ValueError("The relief's sightline must start on the retained shore rock")
    eye = point + Vector((0, 0, 1.61))

    def mount(x, z):
        target = Vector((x, 3.88, z))
        direction = (target - eye).normalized()
        hits = []
        for name, surface in surfaces:
            at, _, _, distance = surface.ray_cast(
                eye, direction, (target - eye).length + 0.05
            )
            if at is not None:
                hits.append((distance, name, at))
        if not hits:
            raise ValueError(f"Missing relief bearing at {x,z}")
        _, name, at = min(hits, key=lambda h: h[0])
        return at, -direction, name

    return mount


def ceramic(bm, mount, x, z0, z1, width, depth, lean):
    # The folded nose has one broad face to catch low sun, and a narrower
    # return. Angling it from foot to crown makes an oblique cast shadow.
    profile = [(-0.5, 0), (0.5, 0), (0.42, 0.49), (0.04, 1), (-0.46, 0.52)]
    rings = []
    for t in (0, 0.24, 0.49, 0.74, 1):
        ring = []
        for u, d in profile:
            at, toward_sea, _ = mount(
                x + u * width + lean * (t - 0.5), z0 + (z1 - z0) * t
            )
            ring.append(bm.verts.new(at + toward_sea * (d * depth + 0.008)))
        rings.append(ring)
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(rings[-1])
    for a, b in zip(rings, rings[1:]):
        for i in range(len(a)):
            n = (i + 1) % len(a)
            bm.faces.new((a[i], a[n], b[n], b[i]))


def build(scene):
    if not scene.objects.get("core_finish_pool_front_box_girder"):
        raise ValueError("The receiving box girder must be in the native house")
    for obj in tuple(scene.objects):
        if obj.name.startswith(PREFIX):
            bpy.data.objects.remove(obj, do_unlink=True)
    materials = [
        decor.material("Pool relief · " + name, colour, rough)
        for name, colour, rough in MATERIALS
    ]
    meshes = [bmesh.new() for _ in materials]
    mount = exposed_supports(scene)
    # The art occupies three 3.4 m bays of the 10.8 m girder. Both ends
    # recede before its corners; a finger-width joint separates neighbours.
    count = 0
    for bay, (lo, hi) in enumerate(((-7.60, -4.29), (-4.16, -0.82), (-0.69, 2.79))):
        for i in range(33):
            t = (i + 0.5) / 33
            x = lo + t * (hi - lo)
            across = (x + 7.6) / 10.39
            crest = 0.132 * math.sin(
                math.tau * (across * 1.42 - 0.14)
            ) + 0.061 * math.sin(math.tau * (2.65 * across + 0.07))
            mid = -0.89 + crest
            swell = 0.105 + 0.200 * math.sin(math.pi * t) ** 0.72
            tilt = 0.045 * math.sin(math.tau * (across * 1.23 + 0.28))
            # A narrow pale register moves above the longer, darker return.
            # A continuous air joint between them catches actual shadow.
            ceramic(
                meshes[1 if bay != 1 or i % 7 else 2],
                mount,
                x,
                mid - swell,
                mid - 0.022,
                0.068,
                0.069 + swell * 0.075,
                tilt,
            )
            ceramic(
                meshes[0 if (i + 4 * bay) % 12 != 3 else 2],
                mount,
                x + tilt * 0.40,
                mid + 0.020,
                mid + 0.48 * swell,
                0.062,
                0.050,
                tilt * 0.53,
            )
            count += 2
    made = []
    for i, (bm, mat) in enumerate(zip(meshes, materials)):
        obj = decor.from_bmesh(
            PREFIX + ("pale", "slate", "oxide")[i], bm, mat, smooth=False
        )
        obj["installationGroup"] = "exterior"
        obj["walk"] = "through"
        made.append(obj)
    bpy.context.view_layer.update()
    owners = {mount(-7.55 + i * 0.10, -0.89)[2] for i in range(103)}
    if len(owners) != 2:
        raise ValueError("The optical wave must cross concrete and solid shore rock")
    print("Tide relief:", count, "fired folds mounted across", sorted(owners))
    return made


if __name__ == "__main__":
    build(bpy.context.scene)
    destination = next(
        arg.split("=", 1)[1] for arg in sys.argv if arg.startswith("--save-as=")
    )
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(
        filepath=str(Path(destination).resolve()), compress=True
    )
