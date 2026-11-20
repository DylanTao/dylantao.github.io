"""Open a splayed ocean window through the existing embedded coastal lift."""

import json
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from coastal_embedded_lift_cut import ROCK, MATERIAL, discard, sculpt_mesh, splice_cut
from coastal_listening_bar import BRASS, GLASS, Joinery

# The existing cabin and both moving gates stay in their native sockets.
# The rock takes the flare outside the car. Its beach door is a storey below.
SECTIONS = ((10.24, -14.28, -12.74), (13.52, -15.02, -11.87), (16.94, -15.59, -11.18))
BOTTOM, TOP = -5.27, 2.09
BOUNDS = ((-15.59, 10.24, BOTTOM), (-11.18, 16.94, TOP))
MARK = "splayedOceanWindow"


def distance(points):
    return max(
        0,
        *(
            max(
                BOUNDS[0][i] - max(p[i] for p in points),
                min(p[i] for p in points) - BOUNDS[1][i],
            )
            for i in range(3)
        ),
    )


def solid_rock(scene):
    return [
        BVHTree.FromPolygons(
            [
                scene.objects[name].matrix_world @ v.co
                for v in scene.objects[name].data.vertices
            ],
            [f.vertices[:] for f in scene.objects[name].data.polygons],
        )
        for name in ROCK
    ]


def field_of_view(scene):
    rocks = solid_rock(scene)
    views = {}
    for height in (1.60, 0.31, -0.98, -2.27, -3.56, -4.85):
        eyes = Vector((-13.51, 9.32, height))
        open_rays = []
        for degree in range(-42, 43):
            a = math.radians(degree)
            ray = Vector((math.sin(a), math.cos(a), 0))
            if all(tree.ray_cast(eyes, ray, 32)[0] is None for tree in rocks):
                open_rays.append(degree)
        # Only the continuous horizon through the window counts.
        lo = hi = 0
        if 0 in open_rays:
            while lo - 1 in open_rays:
                lo -= 1
            while hi + 1 in open_rays:
                hi += 1
        views[height] = [lo, hi]
    return views


def build(scene):
    if not scene.get("embeddedLiftNativeExcavation") or scene.get(MARK):
        raise ValueError(
            "Use the native embedded lift before its ocean window is widened"
        )
    before = field_of_view(scene)
    bm = bmesh.new()
    rings = [
        [
            bm.verts.new((x, y, z))
            for x, z in ((lo, BOTTOM), (hi, BOTTOM), (hi, TOP), (lo, TOP))
        ]
        for y, lo, hi in SECTIONS
    ]
    bm.faces.new(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(4):
            n = (i + 1) % 4
            bm.faces.new((a[i], b[i], b[n], a[n]))
    bm.faces.new(tuple(reversed(rings[-1])))
    cutter = sculpt_mesh("ocean window embrasure", bm, bpy.data.materials[MATERIAL])
    try:
        ledger = {
            name: splice_cut(
                scene.objects[name],
                cutter,
                touches_cut=lambda points, margin: distance(points) <= margin,
                cut_distance=distance,
            )
            for name in ROCK
        }
    finally:
        discard(cutter)
    # A faceted low-iron bow serves as the window of the shaft. The lower
    # edge clears the entire beach gate. The car passes on its inland side.
    join = Joinery("core_cliff_lift_ocean_window_", "cliff-lift")
    profile = [
        (-14.23, 10.57),
        (-13.91, 10.70),
        (-13.51, 10.74),
        (-13.11, 10.70),
        (-12.79, 10.57),
    ]
    bottom, top = -4.245, 2.052
    glass = join.mesh("glass", GLASS)
    for a, b in zip(profile, profile[1:]):
        corners = [
            glass.verts.new((x, y, z))
            for x, y, z in ((*a, bottom), (*b, bottom), (*b, top), (*a, top))
        ]
        glass.faces.new(corners)
        for z in (bottom, top):
            join.span("bronze_edge", BRASS, (*a, z), (*b, z), 0.012, 10)
    for x, y in (profile[0], profile[-1]):
        join.span("bronze_edge", BRASS, (x, y, bottom), (x, y, top), 0.012, 10)
    for _, obj in join.finish():
        obj["walk"] = "through"
    bpy.context.view_layer.update()
    after = field_of_view(scene)
    for z, (lo, hi) in after.items():
        if hi - lo < 24 or hi - lo <= before[z][1] - before[z][0]:
            raise ValueError(
                f"Inadequate ocean window at {z}: {before[z]} to {[lo,hi]}"
            )
    scene[MARK] = 1
    return {
        "eyeXZ": [-13.51, -9.32],
        "beforeDegrees": before,
        "afterDegrees": after,
        "cutBounds": BOUNDS,
        "solids": ledger,
    }


if __name__ == "__main__":
    args = dict(
        k[2:].split("=", 1) for k in sys.argv if k.startswith("--") and "=" in k
    )
    report = build(bpy.context.scene)
    Path(args["report"]).write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(
        filepath=str(Path(args["save-as"]).resolve()), compress=True
    )
