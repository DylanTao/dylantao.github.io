"""One stair hall in the rock behind a big pivot door (Sirui's October 24 feedback on the entrance).

The living's big, empty, textured back wall now holds the main entrance: a 1.5 m x 3 m pivot door
clad in the wall's own sandstone. Behind it a stair hall cut into the cliff carries the house's only
stair. Three straight flights wind around a top-lit well: from a small stone pavilion on the
clifftop, past the upper floor's landing door, down to the vestibule behind the pivot door. The
floating stair in front of the wall, the private onsen spiral and the open arrival trench are
retired, and the trench, the old portal and the spiral's clifftop hole are closed at grade.

Native Blender metres in the final (post-retreat) frame: +Y to the Pacific, +Z up. Plans read more
easily in the three.js frame, so positions here are written (x, zw, h) with zw = -y (landward
positive) and h = z. ``build(scene, config, m)`` edits the scene; the refresh script saves a
candidate and writes the manifest. Applying twice is a checked no-op (``arrivalHallVersion``).
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

import coastal_shell as shell
from coastal_office import Parts, box, cylinder

VERSION = 1

# --- Plan (three.js x, zw landward, h up) -------------------------------------------------------
BACK_FACE = 15.62  # the living side of the new back wall
BACK_DEPTH = 0.10
ROCK_FACE = 15.95  # the old carved rock face behind it
HALL = {"x": (-3.40, 3.30), "zw": (16.40, 23.00)}  # interior faces; the floor is at 0
CEILING = {"high": 7.60, "low": 6.00, "step": 0.0}  # high west of the step (over B's top, LB, C)
LINING = 0.08
DOOR = {"x": (-0.75, 0.75), "h": 3.00, "pivotX": -0.40}  # pivot 0.35 m in from the west jamb
UPPER_DOOR = {"x": (2.15, 3.25), "h": (2.60, 4.80)}
GOING = 0.28
TOP = 8.30  # the clifftop landing and forecourt
RISE_A = 2.60 / 15  # vestibule to the upper landing
RISE_BC = (TOP - 2.60) / 32  # upper landing to the clifftop
LA = {"x": (2.00, 3.30), "zw": (16.40, 17.60), "h": 2.60}
LB = {"x": (-3.40, -2.20), "zw": (16.40, 17.60), "h": 2.60 + 16 * RISE_BC}
A_FOOT = LA["zw"][1] + 14 * GOING  # 21.52
PORTAL = {"x": LB["x"], "zw": (LB["zw"][1] + 15 * GOING, 23.00), "h": TOP}
# Three round oculi light the well, like the onsen's light well: discs of sun on the stair hall floor.
OCULI = {"centers": ((-1.40, 18.60), (-0.50, 19.70), (0.40, 20.80)), "radius": 0.45}  # a diagonal down the well
PAVILION = {"x": (-3.58, -2.00), "zw": (17.44, 23.18), "inner": LB["x"], "roof": TOP + 2.30}
FORECOURT = {"x": (-3.90, -1.70), "zw": (23.00, 24.40), "h": TOP}
PATCH = {"x": (1.35, 4.75), "zw": (16.37, 24.30)}  # its seaward edge inside the hall's lining  # the old trench and portal, closed at grade
# The old private stair's channel, which still ran down from the clifftop and opened over the upper
# passage between the onsen and the hall's upper door: closed at grade, its soffit the passage's ceiling.
SHAFT = {"x": (2.62, 4.38), "zw": (12.62, PATCH["zw"][0]), "soffit": 5.55}
SPIRAL = {"center": (6.10, 15.00), "radius": 1.62}
SLOT = {"x": (-2.04, 2.04), "edge": 14.50, "back": 15.60}  # the guard stands on the slab edge, clear of the aisle
ARCH_OUT = 0.05  # the back wall's top follows the vault, embedded this far into the roof


def native(x, zw, h):
    return (x, -zw, h)


def wbox(bm, x0, x1, z0, z1, h0, h1, radius=0.0, segments=2):
    """An axis-aligned box from three.js-style ranges (x, zw, h)."""
    box(bm, ((x0 + x1) / 2, -(z0 + z1) / 2, (h0 + h1) / 2), (x1 - x0, z1 - z0, h1 - h0), radius, segments=segments)


def wcylinder(bm, a, b, radius, segments=12):
    cylinder(bm, native(*a), native(*b), radius, segments)


def _extrude(bm, profile, axis, a0, a1):
    """A closed prism of a 2D profile. axis 'x': profile is (zw, h) swept over x a0..a1;
    axis 'zw': profile is (x, h) swept over zw a0..a1."""
    rings = []
    for along in (a0, a1):
        rings.append([bm.verts.new(native(along, u, h) if axis == "x" else native(u, along, h)) for u, h in profile])
    made = [bm.faces.new(list(reversed(rings[0]))), bm.faces.new(rings[1])]
    n = len(profile)
    for k in range(n):
        made.append(bm.faces.new((rings[0][k], rings[0][(k + 1) % n], rings[1][(k + 1) % n], rings[1][k])))
    bmesh.ops.recalc_face_normals(bm, faces=made)


def _append(bm, other):
    temp = bpy.data.meshes.new("tmp")
    other.to_mesh(temp)
    other.free()
    bm.from_mesh(temp)
    bpy.data.meshes.remove(temp)


def _ring(bm, x, zw, r_in, r_out, h0, h1, segments=40):
    """A closed round tube (an annulus swept from h0 to h1) about the vertical through (x, zw)."""
    temp = bmesh.new()
    rings = []
    for r, h in ((r_in, h0), (r_out, h0), (r_out, h1), (r_in, h1)):
        rings.append([temp.verts.new(native(x + r * math.cos(2 * math.pi * k / segments), zw + r * math.sin(2 * math.pi * k / segments), h))
                      for k in range(segments)])
    for a, b in zip(rings, rings[1:] + rings[:1]):
        for k in range(segments):
            j = (k + 1) % segments
            temp.faces.new((a[k], a[j], b[j], b[k]))
    bmesh.ops.recalc_face_normals(temp, faces=list(temp.faces))
    _append(bm, temp)


def _slab_with_holes(bm, x0, x1, z0, z1, h0, h1, centers, radius):
    """A ceiling slab with round openings (an Exact Boolean on this small slab only)."""
    slab = _cutter("arrival ceiling slab", x0, x1, z0, z1, h0, h1, bpy.data.materials[0])
    for x, z in centers:
        temp = bmesh.new()
        bmesh.ops.create_cone(temp, cap_ends=True, segments=40, radius1=radius, radius2=radius, depth=(h1 - h0) + 0.2,
                              matrix=Matrix.Translation(Vector((x, -z, (h0 + h1) / 2))))
        data = bpy.data.meshes.new("arrival oculus hole")
        temp.to_mesh(data)
        temp.free()
        hole = bpy.data.objects.new(data.name, data)
        bpy.context.collection.objects.link(hole)
        shell.boolean(slab, hole, "DIFFERENCE")
        bpy.data.objects.remove(hole, do_unlink=True)
        bpy.data.meshes.remove(data)
    bm.from_mesh(slab.data)
    mesh = slab.data
    bpy.data.objects.remove(slab, do_unlink=True)
    bpy.data.meshes.remove(mesh)


def _geology(scene):
    return [o for o in scene.objects if o.type == "MESH" and (o.name == "core__golden coastal sandstone" or o.get("closedSolid"))]


def _garden_solids(scene):
    return [o for o in scene.objects if o.type == "MESH" and o.name.startswith("core_estate_garden") and not o.get("flora")]


def _cutter(name, x0, x1, z0, z1, h0, h1, material):
    return shell._box_object(name, (x0, -z1, h0), (x1, -z0, h1), material)


def _volume(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    volume = abs(bm.calc_volume(signed=True))
    bm.free()
    return volume


def _apply(cutter, targets):
    """Boolean the cutter out of each target. An Exact Boolean that misreads a large mesh can delete
    far more than the cutter holds; a closed target losing more than the cutter's volume fails loudly."""
    name = cutter.name
    limit = _volume(cutter) * 1.02 + 0.05
    reports = []
    for obj in targets:
        if obj == cutter:
            continue
        closed = obj.get("closedSolid") or obj.name == "core__golden coastal sandstone"
        before = _volume(obj) if closed else None
        result = shell.boolean_preserving_islands(obj, cutter)
        if not result.get("skippedDisjoint"):
            if closed:
                lost = before - _volume(obj)
                result["removedM3"] = round(lost, 3)
                if lost > limit or lost < -0.05:
                    raise RuntimeError(f"{name} removed {lost:.2f} m3 from {obj.name} (cutter holds {limit:.2f} m3)")
            reports.append({"mesh": obj.name, **result})
    bpy.data.objects.remove(cutter, do_unlink=True)
    return {"cutter": name, "meshes": reports}


def _cut(scene, name, x0, x1, z0, z1, h0, h1, material, targets):
    return _apply(_cutter(name, x0, x1, z0, z1, h0, h1, material), targets)


def _tree(objects):
    vertices, faces = [], []
    for o in objects:
        offset = len(vertices)
        vertices.extend(o.matrix_world @ v.co for v in o.data.vertices)
        faces.extend([[offset + i for i in f.vertices] for f in o.data.polygons])
    return BVHTree.FromPolygons(vertices, faces)


def _ground(tree, x, zw, start=30.0):
    hit = tree.ray_cast(Vector((x, -zw, start)), Vector((0, 0, -1)), 40)[0]
    return hit.z if hit is not None else None


def _remove_islands(obj, inside):
    """Delete whole connected parts whose world bounds satisfy inside(lo, hi) (native Vectors)."""
    _, count = shell.edit_islands(obj, lambda lo, hi: False if inside(lo, hi) else None)
    return count


def _in_plan(lo, hi, x0, x1, z0, z1):
    """A native island's plan bounds overlap a three.js-style plan rectangle."""
    return lo.x < x1 and hi.x > x0 and -hi.y < z1 and -lo.y > z0


# --- Retire ----------------------------------------------------------------------------------------
RETIRED = ("core_retreat_house_stair", "core_retreat_arrival", "core_retreat_door_main", "core_retreat_private_arrival")


def retire(scene):
    report = {"objects": []}
    for obj in list(scene.objects):
        if obj.name.startswith(RETIRED):
            report["objects"].append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    rails = bpy.data.objects.get("core__honey ash")  # the floating stair's two handrails
    if rails:
        report["stairRails"] = _remove_islands(rails, lambda lo, hi: shell.inside(lo, hi, (-2.2, -15.7, 0.8), (2.4, -14.4, 3.6)))
    cedar = bpy.data.objects.get("onsen_decor cedar wood")  # trims of the retired private threshold
    if cedar:
        report["thresholdCedar"] = _remove_islands(cedar, lambda lo, hi: shell.inside(lo, hi, (2.3, -15.9, 2.55), (2.5, -15.75, 3.8)))
    return report


CLEAR = [  # (x0, x1, zw0, zw1): planting, lanterns, benches and paving retired here
    *[(x - 0.8, x + 0.8, z - 0.8, z + 0.8) for x, z in OCULI["centers"]],
    (PAVILION["x"][0] - 0.1, PAVILION["x"][1] + 0.1, PAVILION["zw"][0] - 0.1, FORECOURT["zw"][1] + 0.1),
    (FORECOURT["x"][0] - 0.1, FORECOURT["x"][1] + 0.1, FORECOURT["zw"][0] - 0.1, FORECOURT["zw"][1] + 0.1),
    (PATCH["x"][0] - 0.1, PATCH["x"][1] + 0.1, PATCH["zw"][0] - 0.1, PATCH["zw"][1] + 0.1),
    (SHAFT["x"][0] - 0.1, SHAFT["x"][1] + 0.1, SHAFT["zw"][0] - 0.1, SHAFT["zw"][1] + 0.1),
    (SPIRAL["center"][0] - 1.9, SPIRAL["center"][0] + 1.9, SPIRAL["center"][1] - 1.9, SPIRAL["center"][1] + 1.9),
]


def clear_garden(scene):
    removed = {}
    for obj in [o for o in scene.objects if o.type == "MESH" and o.name.startswith("core_estate_garden")]:
        if obj.name == "core_estate_garden__garden mineral mulch":
            continue  # the meadow beds are cut by the skylight, not deleted
        if obj.name == "core_estate_garden__travertine paving stone":
            # The clifftop path ran over the new hall: it is re-laid around the skylight.
            removed[obj.name] = _remove_islands(obj, lambda lo, hi: hi.z > 6.5 and lo.y > -24 and hi.y < -12.5)
            continue
        count = _remove_islands(obj, lambda lo, hi: hi.z > 6.0 and any(_in_plan(lo, hi, *z) for z in CLEAR))
        if count:
            removed[obj.name] = count
    return removed


# --- Build -----------------------------------------------------------------------------------------
def _arch(offset=0.0, steps=64):
    """The vault's cross-section (x, h) grown outward by `offset` (as coastal_shell.arch_points)."""
    pts = []
    for a in range(steps + 1):
        t = a * math.pi / steps
        pts.append(((5.20 + offset) * math.cos(t), 0.04 + (5.95 + offset) * math.sin(t) ** 0.44))
    return pts


def back_wall(m):
    """The living's back wall as one sandstone plane across the whole vault, with both door openings."""
    profile = [(-5.20 - ARCH_OUT, -0.30), (5.20 + ARCH_OUT, -0.30)] + _arch(ARCH_OUT)[1:-1]
    bm = bmesh.new()
    _extrude(bm, profile, "zw", BACK_FACE, BACK_FACE + BACK_DEPTH)
    data = bpy.data.meshes.new("core_arrival_wall__golden coastal sandstone")
    bm.to_mesh(data)
    bm.free()
    data.materials.append(m["rock"])
    wall = bpy.data.objects.new(data.name, data)
    bpy.context.collection.objects.link(wall)
    for (x0, x1), (h0, h1) in ((DOOR["x"], (-0.40, DOOR["h"])), (UPPER_DOOR["x"], (UPPER_DOOR["h"][0] - 0.03, UPPER_DOOR["h"][1]))):
        cutter = shell._box_object("arrival wall opening", (x0 - 0.01, -(BACK_FACE + 0.3), h0), (x1 + 0.01, -(BACK_FACE - 0.2), h1 + 0.01), m["rock"])
        shell.boolean(wall, cutter, "DIFFERENCE")
        bpy.data.objects.remove(cutter, do_unlink=True)
    wall["installationGroup"] = "architecture"
    return wall


def _flight(stone, oak, axis, start, sign, lane, count, rise, base, soffit=None, nosing=0.02, cap=0.028):
    """Stone treads with oak caps. axis 'zw' climbs along zw across an x lane; axis 'x' climbs along x
    across a zw lane. The first riser is at `start` and the flight climbs in direction `sign`; tread k
    (1..count) tops out at base + k * rise. soffit=None gives a solid stair to the floor."""
    top = lambda k: base + k * rise
    edge = lambda k: start + sign * k * GOING
    pts = [(edge(0), 0.0 if soffit is None else base - soffit)]
    for k in range(1, count + 1):
        pts += [(edge(k - 1), top(k) - cap), (edge(k), top(k) - cap)]
    pts.append((edge(count), 0.0 if soffit is None else top(count + 1) - soffit))
    _extrude(stone, pts, "x" if axis == "zw" else "zw", lane[0] + 0.02, lane[1] - 0.02)
    caps = []
    for k in range(1, count + 1):
        a, b = sorted((edge(k - 1) - sign * nosing, edge(k)))
        if axis == "zw":
            wbox(oak, lane[0] + 0.02, lane[1] - 0.02, a, b, top(k) - cap, top(k), 0.004, 1)
        else:
            wbox(oak, a, b, lane[0] + 0.02, lane[1] - 0.02, top(k) - cap, top(k), 0.004, 1)
        caps.append((k, a, b, round(top(k), 5)))
    return caps


def _guard(rail, rods, points, height=0.92, post_every=1.25, ceiling=None):
    """A guard along a polyline of (x, zw, foot height): honey ash posts and cap rail, brass rods.
    Under a `ceiling` (the soffit of a wall above the opening) it stops just below it, so where the
    gap closes the guard becomes a screen of rods under the wall rather than running into it."""
    tall = lambda h: height if ceiling is None else min(height, ceiling - 0.05 - h)
    if ceiling is not None:  # break each run where the guard starts to shorten, so its rail follows the posts
        kinked = [points[0]]
        for a, b in zip(points, points[1:]):
            limit = ceiling - 0.05 - height
            if (a[2] - limit) * (b[2] - limit) < 0:
                t = (limit - a[2]) / (b[2] - a[2])
                kinked.append(tuple(a[j] + (b[j] - a[j]) * t for j in range(3)))
            kinked.append(b)
        points = kinked
    for a, b in zip(points, points[1:]):
        length = math.dist(a[:2], b[:2])
        posts = max(1, math.ceil(length / post_every))
        for k in range(posts + 1):
            x, z, h = (a[j] + (b[j] - a[j]) * k / posts for j in range(3))
            wbox(rail, x - 0.022, x + 0.022, z - 0.022, z + 0.022, h, h + tall(h), 0.008, 1)
        wcylinder(rail, (a[0], a[1], a[2] + tall(a[2]) + 0.01), (b[0], b[1], b[2] + tall(b[2]) + 0.01), 0.026, 12)
        count = max(1, int(length / 0.12))
        for k in range(1, count):
            x, z, h = (a[j] + (b[j] - a[j]) * k / count for j in range(3))
            if tall(h) > 0.06:
                wcylinder(rods, (x, z, h + 0.02), (x, z, h + tall(h) - 0.02), 0.008, 8)


def _wall_rail(rail, bronze, points, offset, height=0.92, bracket_every=1.2):
    """A round honey ash handrail on brass brackets, `offset` (dx, dz) out from the wall line."""
    dx, dz = offset
    pts = [(x + dx, z + dz, h + height) for x, z, h in points]
    for a, b in zip(pts, pts[1:]):
        wcylinder(rail, a, b, 0.022, 12)
        n = max(1, math.ceil(math.dist(a, b) / bracket_every))
        for k in range(n + 1):
            p = [a[j] + (b[j] - a[j]) * k / n for j in range(3)]
            wcylinder(bronze, (p[0], p[1], p[2] - 0.03), (p[0] - dx * 0.8, p[1] - dz * 0.8, p[2] - 0.03), 0.008, 8)


def hall(m):
    """Lining, floor, three flights and two landings, guards, wall rails and step lights."""
    p = Parts("core_arrival_hall")
    stone, rock, oak, smoked, bronze, light = (p.bm(m[k]) for k in ("stone", "rock", "oak", "smoked", "bronze", "light"))
    (x0, x1), (z0, z1) = HALL["x"], HALL["zw"]
    hi, lo, step = CEILING["high"], CEILING["low"], CEILING["step"]
    L = LINING
    ceiling = lambda xa, xb: hi if xb <= step + 1e-6 else lo  # a span lies wholly on one side of the step
    # Walls: sandstone lining, so the hall reads as cut from the cliff. Every rock cut face is inside one.
    wbox(rock, x0 - L, x0, z0 - L, z1 + L, -0.25, hi + L)
    wbox(rock, x1, x1 + L, z0 - L, z1 + L, -0.25, lo + L)
    px0, px1 = PAVILION["inner"]
    wbox(rock, x0, px1, z1, z1 + L, -0.25, PORTAL["h"] - 0.30)  # up to the portal landing's soffit
    wbox(rock, px1, x1, z1, z1 + L, -0.25, lo + L)
    dx0, dx1 = DOOR["x"]
    ux0, ux1 = UPPER_DOOR["x"]
    uh0, uh1 = UPPER_DOOR["h"]
    sea = [(x0, dx0 - 0.10, -0.25, hi), (dx0 - 0.10, step, DOOR["h"] + 0.10, hi), (step, dx1 + 0.10, DOOR["h"] + 0.10, lo),
           (dx1 + 0.10, ux0 - 0.10, -0.25, lo), (ux0 - 0.10, x1, -0.25, uh0 - 0.25), (ux0 - 0.10, x1, uh1 + 0.10, lo)]
    for a, b, h0, h1 in sea:
        wbox(rock, a, b, z0 - L, z0, h0, h1)
    # Ceiling: high over the mid landing and the top of flight B, open over flight C (the pavilion),
    # low everywhere else, with the three oculi through the well's ceiling.
    sz0 = LA["zw"][1]  # the seaward strip's landward edge
    wbox(rock, x0 - L, step, z0 - L, sz0, hi, hi + L)
    wbox(rock, step, x1 + L, z0 - L, sz0, lo, lo + L)
    _slab_with_holes(rock, px1, x1 + L, sz0, z1 + L, lo, lo + L, OCULI["centers"], OCULI["radius"] + 0.04)  # hidden in the tubes' walls
    wbox(rock, step, step + L, z0 - L, sz0, lo, hi + L)  # downstands where the ceiling steps
    wbox(rock, px1, step, sz0, sz0 + L, lo, hi + L)
    wbox(rock, px1, px1 + L, sz0 + L, z1 + L, lo, hi)
    wbox(stone, x0, x1, z0, z1, -0.25, 0.0, 0.004, 1)
    # Both doors' reveals through the rock, lined in stone; oak threshold to the upper floor.
    for x in (dx0 - 0.10, dx1):
        wbox(stone, x, x + 0.10, BACK_FACE + BACK_DEPTH - 0.02, z0 + 0.01, -0.02, DOOR["h"] + 0.10)
    wbox(stone, dx0 - 0.10, dx1 + 0.10, BACK_FACE + BACK_DEPTH - 0.02, z0 + 0.01, DOOR["h"], DOOR["h"] + 0.10)
    wbox(stone, dx0, dx1, BACK_FACE - 0.01, z0, -0.25, 0.0, 0.003, 1)
    for x in (ux0 - 0.10, ux1):
        wbox(stone, x, x + 0.10, BACK_FACE + BACK_DEPTH - 0.02, z0 + 0.01, uh0 - 0.25, uh1 + 0.10)
    wbox(stone, ux0 - 0.10, ux1 + 0.10, BACK_FACE + BACK_DEPTH - 0.02, z0 + 0.01, uh1, uh1 + 0.10)
    wbox(stone, ux0, ux1, BACK_FACE + BACK_DEPTH - 0.02, z0, uh0 - 0.25, uh0 - 0.028)  # on the lining, not into it
    wbox(oak, ux0, ux1, 15.582, z0, uh0 - 0.028, uh0 + 0.002, 0.003, 1)
    # Flight A (solid): from the hall floor up the east side to the upper landing.
    caps = {"A": _flight(stone, oak, "zw", A_FOOT, -1, LA["x"], 14, RISE_A, 0.0)}
    wbox(stone, LA["x"][0] + 0.02, LA["x"][1] - 0.02, LA["zw"][0] + 0.02, LA["zw"][1], 0.0, LA["h"] - 0.028)
    wbox(oak, LA["x"][0] + 0.02, LA["x"][1] - 0.02, LA["zw"][0] + 0.02, LA["zw"][1] + 0.02, LA["h"] - 0.028, LA["h"], 0.004, 1)
    # Flight B: a stone slab along the seaward wall, climbing west over the vestibule and the door.
    caps["B"] = _flight(stone, oak, "x", LA["x"][0], -1, LA["zw"], 15, RISE_BC, LA["h"], soffit=0.30)
    wbox(stone, LB["x"][0] + 0.02, LB["x"][1], LB["zw"][0] + 0.02, LB["zw"][1], LB["h"] - 0.34, LB["h"] - 0.028)
    wbox(oak, LB["x"][0] + 0.02, LB["x"][1] + 0.02, LB["zw"][0] + 0.02, LB["zw"][1] + 0.02, LB["h"] - 0.028, LB["h"], 0.004, 1)
    # Flight C: a stone slab along the west wall, up into the pavilion.
    caps["C"] = _flight(stone, oak, "zw", LB["zw"][1], 1, LB["x"], 15, RISE_BC, LB["h"], soffit=0.30)
    # Guards on the well side of each flight and of the portal landing.
    rods = p.bm(m["bronze"])
    _guard(smoked, rods, [(LA["x"][0] - 0.04, A_FOOT, 0.0), (LA["x"][0] - 0.04, LA["zw"][1] + 0.04, LA["h"])])
    # Flight B's well side runs under the seaward downstand (6.0 m); flight C's is open only below it,
    # until its treads reach the downstand and then the pavilion's wall, which enclose the rest.
    _guard(smoked, rods, [(LA["x"][0] - 0.04, LA["zw"][1] + 0.04, LA["h"]), (LB["x"][1] + 0.04, LA["zw"][1] + 0.04, LB["h"])], ceiling=lo)
    closes = (lo - 0.10 - LB["h"]) / RISE_BC * GOING  # where flight C's treads rise to within 10 cm of it
    _guard(smoked, rods, [(LB["x"][1] + 0.04, LB["zw"][1] + 0.04, LB["h"]),
                          (LB["x"][1] + 0.04, LB["zw"][1] + closes, lo - 0.10)], ceiling=lo)
    # Wall handrails: east (A), seaward (B), west (C).
    _wall_rail(smoked, bronze, [(x1, A_FOOT, 0.0), (x1, LA["zw"][1], LA["h"])], (-0.07, 0.0))
    _wall_rail(smoked, bronze, [(LA["x"][0], z0, LA["h"]), (LB["x"][1], z0, LB["h"])], (0.0, 0.07))
    _wall_rail(smoked, bronze, [(x0, LB["zw"][1], LB["h"]), (x0, PORTAL["zw"][0], PORTAL["h"])], (0.07, 0.0))
    # Step lights low in the walls beside every third tread.
    for key, wall_x, wall_z in (("A", x1 - 0.002, None), ("B", None, z0 + 0.002), ("C", x0 + 0.002, None)):
        for k, a, b, h in caps[key][2::3]:
            mid = (a + b) / 2
            if wall_x is not None:
                wbox(light, wall_x - 0.006, wall_x + 0.006, mid - 0.07, mid + 0.07, h + 0.22, h + 0.25, 0.002, 1)
            else:
                wbox(light, mid - 0.07, mid + 0.07, wall_z - 0.006, wall_z + 0.006, h + 0.22, h + 0.25, 0.002, 1)
    objects = p.finish()
    for obj in objects:
        obj["installationGroup"] = "arrival"
        if obj.name.endswith("estate warm opal diffuser"):
            obj["installationGlow"] = "outdoor-portal"
    return objects, caps


def doors(m):
    """The pivot leaf (sandstone both faces, as the wall) and the upper landing's oak pocket leaf."""
    main = Parts("core_arrival_door_main")
    dx0, dx1 = DOOR["x"]
    wbox(main.bm(m["rock"]), dx0 + 0.006, dx1 - 0.006, BACK_FACE, BACK_FACE + 0.10, 0.008, DOOR["h"] - 0.006, 0.004, 1)
    pull = main.bm(m["bronze"])  # a slim bronze pull on the hall side only
    wcylinder(pull, (dx1 - 0.16, BACK_FACE + 0.15, 0.80), (dx1 - 0.16, BACK_FACE + 0.15, 1.70), 0.012, 12)
    for h in (0.80, 1.70):
        wcylinder(pull, (dx1 - 0.16, BACK_FACE + 0.10, h), (dx1 - 0.16, BACK_FACE + 0.15, h), 0.007, 8)
    upper = Parts("core_arrival_door_upper")
    ux0, ux1 = UPPER_DOOR["x"]
    uh0, uh1 = UPPER_DOOR["h"]
    wbox(upper.bm(m["oak"]), ux0 + 0.005, ux1 - 0.005, 15.98, 16.025, uh0 + 0.006, uh1 - 0.006, 0.006, 1)
    wbox(upper.bm(m["bronze"]), ux0 + 0.10, ux0 + 0.12, 16.025, 16.04, uh0 + 0.85, uh0 + 1.25)
    leaves = {"main": main.finish(), "upper": upper.finish()}
    for key, objs in leaves.items():
        for obj in objs:
            obj["estateDoor"] = key
            obj["walk"] = "dynamic-door"
            obj["installationGroup"] = "arrival"
    return leaves


def _heightfield(bm, x0, x1, z0, z1, height, thickness, cell=0.3, skip=None, soffit=None):
    """A closed grade slab whose top follows height(x, zw), `thickness` deep or down to a level soffit;
    cells for which skip(x, zw) is true are left out."""
    nx, nz = max(1, round((x1 - x0) / cell)), max(1, round((z1 - z0) / cell))
    xs = [x0 + (x1 - x0) * i / nx for i in range(nx + 1)]
    zs = [z0 + (z1 - z0) * j / nz for j in range(nz + 1)]
    temp = bmesh.new()
    top = {(i, j): temp.verts.new(native(xs[i], zs[j], height(xs[i], zs[j]))) for i in range(nx + 1) for j in range(nz + 1)}
    under = (lambda x, z: soffit) if soffit is not None else (lambda x, z: height(x, z) - thickness)
    bottom = {(i, j): temp.verts.new(native(xs[i], zs[j], under(xs[i], zs[j]))) for i in range(nx + 1) for j in range(nz + 1)}
    for i in range(nx):
        for j in range(nz):
            temp.faces.new((top[i, j], top[i + 1, j], top[i + 1, j + 1], top[i, j + 1]))
            temp.faces.new((bottom[i, j + 1], bottom[i + 1, j + 1], bottom[i + 1, j], bottom[i, j]))
    for i in range(nx):
        for j, (a, b) in ((0, (i, i + 1)), (nz, (i + 1, i))):
            temp.faces.new((top[a, j], top[b, j], bottom[b, j], bottom[a, j]))
    for j in range(nz):
        for i, (a, b) in ((nx, (j, j + 1)), (0, (j + 1, j))):
            temp.faces.new((top[i, a], top[i, b], bottom[i, b], bottom[i, a]))
    bmesh.ops.recalc_face_normals(temp, faces=list(temp.faces))
    _append(bm, temp)


def grade_samples(tree, roof_tree=None):
    """Ground heights along the trench patch's edges and around the spiral's hole, taken before any cut
    (`roof_tree` adds the rooms' lift-away roofs, which are the clifftop over the upper floor)."""
    px0, px1 = PATCH["x"]
    pz0, pz1 = PATCH["zw"]
    west = {z: _ground(tree, px0 - 0.65, z) for z in [pz0 + (pz1 - pz0) * j / 10 for j in range(11)]}
    east = {z: _ground(tree, px1 + 0.30, z) for z in west}
    sea = {x: _ground(tree, x, pz0 - 0.25) for x in [px0 + (px1 - px0) * i / 6 for i in range(7)]}
    land = {x: _ground(tree, x, pz1 + 0.30) for x in sea}
    # A sample can land on the old arrival's treads or the trench floor: keep only true ground.
    for table in (west, east, sea, land):
        for key, value in list(table.items()):
            if value is not None and value < 6.0:
                table[key] = None
    west, east, sea, land = (_fill_gaps(t) for t in (west, east, sea, land))
    # The old private stair's channel runs out under the patch's seaward edge: there the edge takes the
    # ground on either side, so the closed trench and the closed channel meet at grade.
    clifftop = lambda table: _fill_gaps({k: (v if v is not None and v >= 7.0 else None) for k, v in table.items()})
    sea_grade = clifftop(sea)
    roof_tree = roof_tree or tree
    (sx0, sx1), (sz0, sz1) = SHAFT["x"], SHAFT["zw"]
    shaft_z = [sz0 + (sz1 - sz0) * j / 8 for j in range(9)]
    shaft_x = [sx0 + (sx1 - sx0) * i / 4 for i in range(5)]
    shaft = {"west": clifftop({z: _ground(roof_tree, sx0 - 0.17, z) for z in shaft_z}),
             "east": clifftop({z: _ground(roof_tree, sx1 + 0.17, z) for z in shaft_z}),
             "sea": clifftop({x: _ground(roof_tree, x, sz0 - 0.17) for x in shaft_x}),
             "land": {x: _lerp_table(sea_grade, x) for x in shaft_x}}
    cx, cz = SPIRAL["center"]
    R = SPIRAL["radius"]
    rim = [_ground(tree, cx + (R + 0.04) * math.cos(2 * math.pi * k / 32), cz + (R + 0.04) * math.sin(2 * math.pi * k / 32)) for k in range(32)]
    known = [g for g in rim if g is not None]
    mean = sum(known) / len(known)
    rim = [g if g is not None else mean for g in rim]
    pad = _ground(tree, 7.46 + 0.75, 13.98) or 7.6
    true_ground = lambda table: _fill_gaps({k: (v if v is not None and v > 6.0 else None) for k, v in table.items()})
    fx = [FORECOURT["x"][0] + (FORECOURT["x"][1] - FORECOURT["x"][0]) * i / 5 for i in range(6)]
    fz = [HALL["zw"][1] + 0.10 + (FORECOURT["zw"][1] - HALL["zw"][1] - 0.10) * j / 5 for j in range(6)]
    forecourt_land = true_ground({x: _ground(tree, x, FORECOURT["zw"][1] + 0.25) for x in fx})
    # Along the sides the seaward ends meet the portal's level; the ground takes over inland.
    forecourt_west = true_ground({z: _ground(tree, FORECOURT["x"][0] - 0.25, z) for z in fz})
    forecourt_east = true_ground({z: _ground(tree, FORECOURT["x"][1] + 0.25, z) for z in fz})
    for table in (forecourt_west, forecourt_east):
        table[fz[0]] = TOP
    oculi = []
    for x, z in OCULI["centers"]:
        ring = [_ground(tree, x + 0.75 * math.cos(a), z + 0.75 * math.sin(a)) for a in (k * math.pi / 4 for k in range(8))]
        ring = [g for g in ring if g is not None]
        oculi.append(sum(ring) / len(ring))
    return {"west": west, "east": east, "sea": sea, "land": land, "rim": rim, "mean": mean, "pad": pad, "oculi": oculi,
            "forecourtLand": forecourt_land, "forecourtWest": forecourt_west, "forecourtEast": forecourt_east,
            "seaGrade": sea_grade, "shaft": shaft}


def court(scene, m, samples):
    """Pavilion, skylight, forecourt and the grade patches that close the trench and the spiral."""
    p = Parts("core_arrival_court")
    stone, rock, glass, light, smoked, paving = (p.bm(m[k]) for k in ("stone", "rock", "glass", "light", "smoked", "paving"))
    hi, lo = CEILING["high"], CEILING["low"]
    # The oculi: a stone tube through the rock from the well's ceiling, a low stone rim at the ground and
    # a glass disc, so the clifftop reads as ground with three small round lights, not a roof.
    r = OCULI["radius"]
    for (x, z), g in zip(OCULI["centers"], samples["oculi"]):
        _ring(stone, x, z, r, r + 0.08, lo - 0.02, g - 0.20, 40)
        _ring(stone, x, z, r, r + 0.22, g - 0.22, g + 0.04, 48)
        wcylinder(glass, (x, z, g + 0.012), (x, z, g + 0.03), r + 0.01, 40)
    # Pavilion: sandstone walls rising out of the ground like an outcrop, a closed seaward end and a
    # thin stone roof with an oak soffit over the top of flight C.
    (ox0, ox1), (oz0, oz1), (ix0, ix1) = PAVILION["x"], PAVILION["zw"], PAVILION["inner"]
    roof = PAVILION["roof"]
    z1 = HALL["zw"][1]
    wbox(rock, ox0, ix0, oz0, z1 + 0.10, hi - 0.04, roof, 0.012, 2)
    wbox(rock, ix1, ox1, oz0, z1 + 0.10, hi - 0.04, roof, 0.012, 2)
    wbox(rock, ix0, ix1, oz0, oz0 + 0.18, hi - 0.04, roof, 0.012, 2)
    wbox(stone, ox0 - 0.06, ox1 + 0.06, oz0 - 0.06, oz1 + 0.12, roof, roof + 0.20, 0.02, 2)
    for k in range(17):
        z = oz0 + 0.30 + k * (oz1 - oz0 - 0.42) / 16
        wbox(smoked, ix0, ix1, z - 0.03, z + 0.03, roof - 0.07, roof, 0.006, 1)
    wbox(light, ix0 + 0.05, ix1 - 0.05, z1 - 0.04, z1 - 0.02, roof - 0.10, roof - 0.08, 0.002, 1)
    # The portal landing at the top of flight C and the forecourt it opens onto.
    wbox(stone, PORTAL["x"][0], PORTAL["x"][1], PORTAL["zw"][0], z1 + 0.10, PORTAL["h"] - 0.30, PORTAL["h"], 0.006, 1)
    # The forecourt: travertine paving that eases from the portal's level up to the ground around it,
    # so the arrival walks straight in with no curb or step.
    fx0, fx1 = FORECOURT["x"]
    fz0, fz1 = FORECOURT["zw"]
    _heightfield(paving, fx0, fx1, z1 + 0.10, fz1, lambda x, z: forecourt_height(samples, x, z), 0.25, cell=0.22)
    # Grade patches: the trench and old portal beside the hall, sloping as the ground around them.
    px0, px1 = PATCH["x"]
    pz0, pz1 = PATCH["zw"]
    interp = lambda table, v: _lerp_table(table, v)
    # Its edges take the ground as the cut left it, just inside the patch and outside the cut, densely,
    # so they meet the surrounding grade without a lip. Where that is no true ground (the old channel
    # under the seaward edge), the edge keeps the grade sampled before the cut.
    after = _tree(_geology(scene) + _garden_solids(scene))

    def boundary(pre, points):
        table = {}
        for key, (x, z) in points.items():
            g = _ground(after, x, z)
            table[key] = g if g is not None and g >= 7.0 else interp(pre, key)
        return table

    zs = [pz0 + (pz1 - pz0) * j / 40 for j in range(41)]
    xs = [px0 + (px1 - px0) * i / 20 for i in range(21)]
    west = boundary(samples["west"], {z: (px0 + 0.01, z) for z in zs})
    east = boundary(samples["east"], {z: (px1 - 0.01, z) for z in zs})
    sea = boundary(samples["seaGrade"], {x: (x, pz0 + 0.01) for x in xs})
    land = boundary(samples["land"], {x: (x, pz1 - 0.01) for x in xs})

    def grade(x, z):
        # Coons-style blend of the four sampled edges: exact on the boundary, smooth inside.
        u = (x - px0) / (px1 - px0)
        w = (z - pz0) / (pz1 - pz0)
        edge_x = (1 - u) * interp(west, z) + u * interp(east, z)
        edge_z = (1 - w) * interp(sea, x) + w * interp(land, x)
        corners = ((1 - u) * (1 - w) * interp(west, pz0) + u * (1 - w) * interp(east, pz0)
                   + (1 - u) * w * interp(west, pz1) + u * w * interp(east, pz1))
        return edge_x + edge_z - corners + 0.012

    _heightfield(rock, px0, px1, pz0, pz1, grade, 0.25)
    # The private spiral's clifftop hole: a domed patch meeting the ground just outside its rim.
    cx, cz = SPIRAL["center"]
    R = SPIRAL["radius"]
    rim, mean = samples["rim"], samples["mean"]
    # The ground around the hole slopes: fit a plane to the rim and ease from it to the rim itself,
    # so the patch reads as the same slope rather than a dome.
    angles = [2 * math.pi * k / 32 for k in range(32)]
    sx = sum(math.cos(a) * (g - mean) for a, g in zip(angles, rim)) / sum(math.cos(a) ** 2 for a in angles)
    sz = sum(math.sin(a) * (g - mean) for a, g in zip(angles, rim)) / sum(math.sin(a) ** 2 for a in angles)
    plane = lambda f, a: mean + f * (sx * math.cos(a) + sz * math.sin(a))
    lid = bmesh.new()
    rings = []
    for fraction, blend in ((1.0, 1.0), (0.66, 0.35), (0.33, 0.1)):
        rings.append([lid.verts.new(native(cx + R * fraction * math.cos(a), cz + R * fraction * math.sin(a),
                                           plane(fraction, a) + (rim[k] - plane(1.0, a)) * blend + 0.012)) for k, a in enumerate(angles)])
    centre = lid.verts.new(native(cx, cz, mean + 0.012))
    bottom = [lid.verts.new(native(cx + R * math.cos(2 * math.pi * k / 32), cz + R * math.sin(2 * math.pi * k / 32), min(rim) - 0.6)) for k in range(32)]
    for k in range(32):
        j = (k + 1) % 32
        for a, b in zip(rings, rings[1:]):
            lid.faces.new((a[k], a[j], b[j], b[k]))
        lid.faces.new((rings[-1][k], rings[-1][j], centre))
        lid.faces.new((rings[0][j], rings[0][k], bottom[k], bottom[j]))
    lid.faces.new(list(reversed(bottom)))
    bmesh.ops.recalc_face_normals(lid, faces=list(lid.faces))
    _append(rock, lid)
    # The spiral's old garden landing pad left a shallow hole beside it.
    pad_x, pad_z = 7.46, 13.98
    g = samples["pad"]
    wbox(rock, pad_x - 0.47, pad_x + 0.47, pad_z - 0.51, pad_z + 0.51, g - 0.40, g + 0.01, 0.02, 2)
    objects = p.finish()
    for obj in objects:
        obj["installationGroup"] = "garden"
        obj["estateOutdoors"] = True
        if obj.name.endswith("estate warm opal diffuser"):
            obj["installationGlow"] = "outdoor-portal"
    # The old private stair's channel: ground at grade over a level soffit that continues the upper
    # passage's ceiling. It is part of the clifftop over the rooms, so it lifts away with their roof.
    lid = Parts("core_arrival_lid")
    edges = dict(samples["shaft"], land={x: interp(sea, x) for x in samples["shaft"]["land"]})
    (sx0, sx1), (sz0, sz1) = SHAFT["x"], SHAFT["zw"]

    def shaft_top(x, z):
        u = (x - sx0) / (sx1 - sx0)
        w = (z - sz0) / (sz1 - sz0)
        edge_x = (1 - u) * interp(edges["west"], z) + u * interp(edges["east"], z)
        edge_z = (1 - w) * interp(edges["sea"], x) + w * interp(edges["land"], x)
        corners = ((1 - u) * (1 - w) * interp(edges["west"], sz0) + u * (1 - w) * interp(edges["east"], sz0)
                   + (1 - u) * w * interp(edges["west"], sz1) + u * w * interp(edges["east"], sz1))
        return edge_x + edge_z - corners + 0.012

    _heightfield(lid.bm(m["rock"]), sx0, sx1, sz0, sz1, shaft_top, None, cell=0.22, soffit=SHAFT["soffit"])
    for obj in lid.finish():
        obj["caveRoof"] = True
        obj["installationGroup"] = "upper"
        objects.append(obj)
    return objects, {"spiralRim": [round(v, 3) for v in rim], "spiralMean": round(mean, 3),
                     "patchEdges": {"west": west, "east": east, "sea": sea, "land": land}}


def forecourt_height(samples, x, z):
    """The forecourt's paving: the portal's level along its seaward edge, the ground along the others."""
    fx0, fx1 = FORECOURT["x"]
    z0, z1 = HALL["zw"][1] + 0.10, FORECOURT["zw"][1]
    u = max(0.0, min(1.0, (x - fx0) / (fx1 - fx0)))
    w = max(0.0, min(1.0, (z - z0) / (z1 - z0)))
    west, east, land = samples["forecourtWest"], samples["forecourtEast"], samples["forecourtLand"]
    sea = lambda _x: TOP
    edge_x = (1 - u) * _lerp_table(west, z) + u * _lerp_table(east, z)
    edge_z = (1 - w) * sea(x) + w * _lerp_table(land, x)
    corners = ((1 - u) * (1 - w) * _lerp_table(west, z0) + u * (1 - w) * _lerp_table(east, z0)
               + (1 - u) * w * _lerp_table(west, z1) + u * w * _lerp_table(east, z1))
    return edge_x + edge_z - corners - 0.004


def _fill_gaps(table):
    """Replace missing samples by interpolating between the nearest known ones along the edge."""
    keys = sorted(table)
    known = [k for k in keys if table[k] is not None]
    if not known:
        raise ValueError("No ground along a patch edge")
    out = {}
    for k in keys:
        if table[k] is not None:
            out[k] = table[k]
            continue
        below = [q for q in known if q < k]
        above = [q for q in known if q > k]
        if below and above:
            a, b = below[-1], above[0]
            out[k] = table[a] + (table[b] - table[a]) * (k - a) / (b - a)
        else:
            out[k] = table[(below or above)[-1 if below else 0]]
    return out


def _lerp_table(table, v):
    keys = sorted(table)
    if v <= keys[0]:
        return table[keys[0]]
    for a, b in zip(keys, keys[1:]):
        if v <= b:
            t = (v - a) / (b - a)
            return table[a] * (1 - t) + table[b] * t
    return table[keys[-1]]


PATHS = {  # (x, zw) stations; the clifftop path re-laid around the skylight from the forecourt
    # West of the pavilion by a metre and more, so the ribbon climbs the gentle ground there, not its walls.
    "west": [(-4.30, 23.90), (-5.20, 23.30), (-5.45, 21.5), (-5.25, 18.8), (-4.95, 16.0), (-4.55, 13.5)],
    "east": [(-1.70, 23.75), (0.6, 23.55), (2.9, 23.30), (4.6, 21.8), (5.15, 19.0), (5.3, 16.4), (5.6, 13.7)],
}


def paths(scene, m, objects):
    """Re-lay the clifftop's mineral path as two ribbons from the forecourt, draped on the new grade.
    Where a ribbon lies on a room's lift-away roof, that stretch is its own object owned by the roof,
    so it lifts away with it instead of floating over the open room."""
    from coastal_estate_outdoors import _resample
    ground = _geology(scene) + [o for o in objects if o.name.startswith("core_arrival_court")] +         [o for o in _garden_solids(scene) if "paving" not in o.name]
    tree = _tree(ground)
    roofs = [(o, _tree([o])) for o in ground if o.get("caveRoof")]

    def support(x, y):
        """The lift-away roof the ground here belongs to, if any."""
        hit = tree.ray_cast(Vector((x, y, 30)), Vector((0, 0, -1)), 40)[0]
        for roof, roof_tree in roofs:
            top = roof_tree.ray_cast(Vector((x, y, 30)), Vector((0, 0, -1)), 40)[0]
            if hit is not None and top is not None and abs(top.z - hit.z) < 1e-4:
                return roof.name
        return None

    parts = {None: Parts("core_arrival_paths")}

    def ribbon(bm, rows):
        verts = [[bm.verts.new(v) for v in row] + [bm.verts.new((v[0], v[1], v[2] - 0.14)) for v in row] for row in rows]
        for a, b in zip(verts, verts[1:]):
            for i in (0, 1):
                bm.faces.new((a[i], b[i], b[i + 1], a[i + 1]))
                bm.faces.new((a[3 + i], a[4 + i], b[4 + i], b[3 + i]))
            bm.faces.new((a[0], a[3], b[3], b[0]))
            bm.faces.new((a[2], b[2], b[5], a[5]))
        first, last = verts[0], verts[-1]
        bm.faces.new((first[0], first[3], first[4], first[5], first[2], first[1]))
        bm.faces.new((last[0], last[1], last[2], last[5], last[4], last[3]))

    for stations in PATHS.values():
        points = _resample([(x, -z) for x, z in stations], 0.3)
        rows, owners = [], []
        for i, q in enumerate(points):
            a, b = Vector(points[max(0, i - 1)]), Vector(points[min(len(points) - 1, i + 1)])
            tangent = (b - a).normalized()
            normal = Vector((-tangent.y, tangent.x))
            row = []
            for offset in (-0.69, 0.0, 0.69):  # a centre line too, so the ground cannot rise through the middle
                v = Vector(q) + normal * offset
                hit = tree.ray_cast(Vector((v.x, v.y, 30)), Vector((0, 0, -1)), 40)[0]
                row.append((v.x, v.y, (hit.z if hit is not None else 8.0) + 0.025))
            rows.append(row)
            owners.append(support(*q))
        # Contiguous stretches on one support; neighbouring stretches share their boundary row.
        k = 0
        while k < len(rows):
            j = k
            while j + 1 < len(rows) and owners[j + 1] == owners[k]:
                j += 1
            owner = owners[k]
            if owner not in parts:
                parts[owner] = Parts("core_arrival_paths_roof")
            ribbon(parts[owner].bm(m["paving"]), rows[k:j + 2] if j + 1 < len(rows) else rows[k:j + 1])
            k = j + 1
    made = []
    for owner, part in parts.items():
        for obj in part.finish():
            obj["installationGroup"] = "garden"
            obj["estateOutdoors"] = True
            if owner:
                obj["cutawayVegetationSupport"] = owner
            made.append(obj)
    return made, [o.name for o in ground]


def living_side(m):
    """On the living side: the alcove's closed side, the vault patch, the slot guard, skirting, light."""
    p = Parts("core_arrival_living")
    plaster, rock, stone, smoked, bronze, light = (p.bm(m[k]) for k in ("plaster", "rock", "stone", "smoked", "bronze", "light"))
    # The old rear aisle stays a niche of the living; its side to the old foyer is closed.
    wbox(plaster, -4.77, -4.69, 14.20, BACK_FACE + 0.02, -0.02, 2.40, 0.01, 1)
    # The retired onsen threshold opened the vault's curved east side behind the onsen. Close it
    # with a shell on the vault surface, from the old cut's seaward edge to the new back wall.
    arc = [(x, h) for x, h in _arch(0.0, 64) if x > 0 and 2.30 <= h <= 5.40]
    inner, out = [], []
    for i, (x, h) in enumerate(arc):
        a, b = arc[max(0, i - 1)], arc[min(len(arc) - 1, i + 1)]
        tx, th = b[0] - a[0], b[1] - a[1]
        n = math.hypot(tx, th)
        nx, nh = th / n, -tx / n
        if nx * x + nh * (h - 2.5) < 0:
            nx, nh = -nx, -nh
        inner.append((x + nx * 0.003, h + nh * 0.003))  # just behind the surviving vault surface
        out.append((x + nx * 0.12, h + nh * 0.12))
    _extrude(rock, inner + list(reversed(out)), "zw", 14.60, BACK_FACE + 0.02)
    wbox(stone, 4.60, 5.25, 14.60, BACK_FACE + 0.02, 2.30, 2.598, 0.004, 1)  # the floor edge the threshold left open
    # A guard around the slot the floating stair leaves in the upper floor.
    x0, x1 = SLOT["x"]
    _guard(smoked, bronze, [(x0, SLOT["back"], 2.60), (x0, SLOT["edge"], 2.60), (x1, SLOT["edge"], 2.60), (x1, SLOT["back"], 2.60)])
    # A slim skirting where the upper boards stop just short of the new wall.
    for a, b in ((-4.60, x0 - 0.02), (UPPER_DOOR["x"][1] + 0.10, 4.75)):
        wbox(smoked, a, b, 15.575, BACK_FACE + 0.005, 2.60, 2.68, 0.004, 1)
    # A hidden linear light at the top of the slot grazes the textured wall at night.
    wbox(smoked, -1.95, 1.95, 15.42, 15.60, 5.50, 5.58, 0.01, 1)
    wbox(light, -1.92, 1.92, 15.47, 15.55, 5.485, 5.50, 0.002, 1)
    objects = p.finish()
    for obj in objects:
        obj["installationGroup"] = "architecture"
        if obj.name.endswith("estate warm opal diffuser"):
            obj["installationGlow"] = "back-wall-graze"
    return objects


ONSEN_SCREEN = {"x": (1.76, 4.95), "zw": (9.31, 9.49), "curb": 2.90, "top": 3.82, "pitch": 0.042}


def _gallery_guard():
    """The screen stands on the gallery's edge and is its guard in front of the onsen: the brass
    posts there go, and the honey ash handrail now ends at the screen's first post."""
    x0 = ONSEN_SCREEN["x"][0]
    report = {}
    brass = bpy.data.objects.get("core__brushed brass")
    if brass:
        report["posts"] = _remove_islands(brass, lambda lo, hi: shell.inside(lo, hi, (x0, -9.36, 2.55), (4.70, -9.26, 3.50)))
    rail = bpy.data.objects.get("core__honey ash")
    if rail:
        to_world, to_local = rail.matrix_world, rail.matrix_world.inverted()
        bm = bmesh.new()
        bm.from_mesh(rail.data)
        trimmed = 0
        for island in shell._islands(bm):
            points = [to_world @ v.co for v in island]
            lo = Vector([min(p[k] for p in points) for k in range(3)])
            hi = Vector([max(p[k] for p in points) for k in range(3)])
            if not (lo.y > -9.36 and hi.y < -9.26 and abs(lo.z - 3.40) < 0.02 and abs(hi.z - 3.46) < 0.02 and lo.x < x0 < hi.x):
                continue
            # The rail is a profile swept through stations: those past the screen fold onto the new
            # end, where the old end cap closes it, and the collapsed segments merge away.
            end = x0 - 0.005
            for v, p in zip(island, points):
                if p.x > end:
                    v.co = to_local @ Vector((end, p.y, p.z))
            bmesh.ops.remove_doubles(bm, verts=island, dist=1e-4)
            trimmed += 1
            break
        bm.to_mesh(rail.data)
        bm.free()
        rail.data.update()
        report["railTrimmed"] = trimmed
    return report


def onsen_screen(m):
    """Privacy for the onsen (Sirui: the onsen must not look into the living space).

    Deep, closely spaced horizontal cedar blades on the edge of the upper floor in front of the
    onsen, which also serve as the gallery's guard there. A horizontal ray passes between them, so a
    bather in the sunken tub keeps the sea and the horizon; any ray tilted more than about 10 degrees
    is stopped, which is every line between the living below and the tub, and every downward look
    from the onsen into the room. The screen stays below the onsen's authored camera, which looks
    down over it, and leaves the companion's onsen perch its full clearance."""
    _gallery_guard()
    p = Parts("onsen_privacy")
    cedar, stone = p.bm(m["cedar"]), p.bm(m["stone"])
    (x0, x1), (z0, z1) = ONSEN_SCREEN["x"], ONSEN_SCREEN["zw"]
    curb, top, pitch = ONSEN_SCREEN["curb"], ONSEN_SCREEN["top"], ONSEN_SCREEN["pitch"]
    wbox(stone, x0, x1, z0 - 0.02, z1, 2.57, curb, 0.006, 1)  # 1 cm proud of the slab's edge and the boards' ends
    posts = max(2, math.ceil((x1 - x0) / 1.1) + 1)
    for k in range(posts):
        x = x0 + 0.025 + (x1 - x0 - 0.05) * k / (posts - 1)
        wbox(cedar, x - 0.025, x + 0.025, z0, z1, curb, top + 0.05, 0.004, 1)
    h = curb + pitch / 2
    while h < top - 0.01:
        wbox(cedar, x0, x1, z0, z1, h - 0.006, h + 0.006, 0.002, 1)
        h += pitch
    wbox(cedar, x0 - 0.02, x1, z0 - 0.01, z1 + 0.01, top, top + 0.05, 0.006, 1)
    objects = p.finish()
    for obj in objects:
        obj["installationGroup"] = "upper"
    return objects


def supports(caps):
    rows = []

    def s(id, x0, x1, z0, z1, h):
        rows.append({"id": id, "height": round(h, 4), "polygon": [[round(x0, 4), round(z0, 4)], [round(x1, 4), round(z0, 4)],
                                                                   [round(x1, 4), round(z1, 4)], [round(x0, 4), round(z1, 4)]]})

    (x0, x1), (z0, z1) = HALL["x"], HALL["zw"]
    s("arrival-hall-floor", LB["x"][1], LA["x"][0], z0, z1, 0.0)
    s("arrival-hall-floor-landward", LA["x"][0], x1, A_FOOT, z1, 0.0)
    s("arrival-hall-floor-west", x0, LB["x"][1], z0, z1, 0.0)
    s("arrival-hall-door", DOOR["x"][0], DOOR["x"][1], BACK_FACE - 0.1, z0 + 0.05, 0.0)
    s("arrival-hall-upper-door", UPPER_DOOR["x"][0], UPPER_DOOR["x"][1], 15.50, z0 + 0.05, 2.6)
    for key, lane in (("A", LA["x"]), ("B", LA["zw"]), ("C", LB["x"])):
        for k, a, b, h in caps[key]:
            if key == "B":
                s(f"arrival-hall-tread-{key}{k}", a, b, lane[0], lane[1], h)
            else:
                s(f"arrival-hall-tread-{key}{k}", lane[0], lane[1], a, b, h)
    s("arrival-hall-upper-landing", LA["x"][0], LA["x"][1], LA["zw"][0], LA["zw"][1], LA["h"])
    s("arrival-hall-mid-landing", LB["x"][0], LB["x"][1], LB["zw"][0], LB["zw"][1], LB["h"])
    s("arrival-hall-portal", PORTAL["x"][0], PORTAL["x"][1], PORTAL["zw"][0], z1 + 0.1, PORTAL["h"])
    # The forecourt's paving is graded to the clifftop, so it has no single support height.
    return rows


def routes(caps, samples):
    """Walking lines (three.js [x, h, zw]): the arrival down to the living, and the house stair
    from the living's lower aisle through the pivot door and up flight A to the upper aisle."""
    w = lambda x, z, h: [round(x, 4), round(h, 4), round(z, 4)]
    ax = (LA["x"][0] + LA["x"][1]) / 2
    bz = (LA["zw"][0] + LA["zw"][1]) / 2
    cx = (LB["x"][0] + LB["x"][1]) / 2
    door_x = round((DOOR["pivotX"] + DOOR["x"][1]) / 2 + 0.02, 3)
    floor_path = [w(ax, 22.10, 0.0), w(0.9, 22.10, 0.0), w(door_x, 18.2, 0.0), w(door_x, 16.6, 0.0)]
    # Walk arrives just inside the pavilion's portal, on the landing at the head of the stair.
    # Keep the whole body on the flat landing, clear of the rising forecourt beyond its edge.
    down = [w(cx, (PORTAL["zw"][0] + HALL["zw"][1]) / 2, TOP), w(cx, PORTAL["zw"][0] + 0.15, TOP)]
    down += [w(cx, (a + b) / 2, h) for k, a, b, h in reversed(caps["C"])]
    down += [w(cx, bz, LB["h"])]
    down += [w((a + b) / 2, bz, h) for k, a, b, h in reversed(caps["B"])]
    down += [w(ax, bz, LA["h"]), w(ax, LA["zw"][1] - 0.30, LA["h"])]
    down += [w(ax, (a + b) / 2, h) for k, a, b, h in reversed(caps["A"])]
    down += floor_path + [w(door_x, BACK_FACE - 0.30, 0.0), w(door_x, 14.6, 0.0)]
    stairs = list(reversed(floor_path))
    stairs += [w(ax, (a + b) / 2, h) for k, a, b, h in caps["A"]]
    stairs += [w(ax, LA["zw"][1] - 0.30, LA["h"]), w(ax, 16.10, LA["h"]), w(ax, 15.30, 2.6), w(ax, 14.1, 2.6)]
    approach = [w(door_x, 13.6, 0.0), w(door_x, 15.2, 0.0), w(door_x, 16.6, 0.0)]
    return down, stairs, approach


def _cutters(m, samples):
    """Every rock cut as one closed solid (the union of boxes and the spiral lid's clearance)."""
    (x0, x1), (z0, z1) = HALL["x"], HALL["zw"]
    hi, lo, step = CEILING["high"], CEILING["low"], CEILING["step"]
    px0, px1 = PAVILION["inner"]
    sz0 = LA["zw"][1]
    patch_bottom = min(v for k in ("west", "east", "sea", "land") for v in samples[k].values()) - 0.26
    # Planes never coincide (an Exact Boolean misreads coplanar overlaps).
    boxes = {
        "upper door reveal": (UPPER_DOOR["x"][0] - 0.04, UPPER_DOOR["x"][1] + 0.01, ROCK_FACE - 0.095, z0 + 0.03,
                              UPPER_DOOR["h"][0] - 0.24, UPPER_DOOR["h"][1] + 0.04),
        "pivot door reveal": (DOOR["x"][0] - 0.04, DOOR["x"][1] + 0.04, ROCK_FACE - 0.10, z0 + 0.025, -0.215, DOOR["h"] + 0.04),
        "hall": (x0 - 0.04, x1 + 0.04, z0 - 0.04, z1 + 0.04, -0.205, lo + 0.04),
        "hall high seaward": (x0 - 0.045, step + 0.04, z0 - 0.045, sz0 + 0.04, lo - 0.10, hi + 0.04),
        "hall high west": (x0 - 0.05, px1 + 0.04, sz0 - 0.05, z1 + 0.045, lo - 0.05, hi + 0.045),
        "pavilion": (px0 - 0.02, px1 + 0.02, PAVILION["zw"][0] + 0.135, z1 + 0.02, hi - 0.035, 14.02),
        "forecourt": (FORECOURT["x"][0] + 0.03, FORECOURT["x"][1] - 0.03, z1 + 0.13, FORECOURT["zw"][1] - 0.03, TOP - 0.23, 14.03),
        "trench patch": (PATCH["x"][0] + 0.05, PATCH["x"][1] - 0.05, PATCH["zw"][0] + 0.05, PATCH["zw"][1] - 0.05,
                         max(patch_bottom, lo + 0.12), 14.04),
    }
    combined = None
    for name, b in boxes.items():
        cutter = _cutter("arrival " + name, *b, m["rock"])
        if combined is None:
            combined = cutter
            continue
        shell.boolean(combined, cutter, "UNION")
        bpy.data.objects.remove(cutter, do_unlink=True)
    cx, cz = SPIRAL["center"]
    cylinders = [(cx, cz, SPIRAL["radius"] - 0.04, min(samples["rim"]) - 0.3, min(samples["rim"]) + 5.7, 48)]
    cylinders += [(x, z, OCULI["radius"] + 0.02, lo - 0.03, 14.05 + 0.01 * k, 40) for k, (x, z) in enumerate(OCULI["centers"])]
    for x, z, radius, h0, h1, segments in cylinders:
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=h1 - h0,
                              matrix=Matrix.Translation(Vector((x, -z, (h0 + h1) / 2))))
        data = bpy.data.meshes.new("arrival round clearance")
        bm.to_mesh(data)
        bm.free()
        data.materials.append(m["rock"])
        tool = bpy.data.objects.new(data.name, data)
        bpy.context.collection.objects.link(tool)
        shell.boolean(combined, tool, "UNION")
        bpy.data.objects.remove(tool, do_unlink=True)
    combined.name = "arrival rock cuts"
    return combined, {"boxes": boxes, "patchBottom": patch_bottom}


def build(scene, m):
    if scene.get("arrivalHallVersion") == VERSION:
        return [], {"retained": True, "version": VERSION}
    report = {"version": VERSION, "retired": retire(scene), "garden": clear_garden(scene)}
    geology = _geology(scene)
    garden = _garden_solids(scene)
    roofs = [o for o in scene.objects if o.type == "MESH" and o.get("caveRoof") and "liftaway" in o.name]
    samples = grade_samples(_tree(geology + garden), _tree(geology + garden + roofs))  # the ground before any cut
    # All rock cuts in one Exact Boolean: chained cuts made the solver drop the whole mainland.
    cutter, cut_report = _cutters(m, samples)
    report["cutters"] = cut_report
    report["cuts"] = _apply(cutter, geology + garden)
    wall = back_wall(m)
    hall_objects, caps = hall(m)
    leaves = doors(m)
    court_objects, court_report = court(scene, m, samples)
    path_objects, path_ground = paths(scene, m, court_objects)
    living = living_side(m)
    screen = onsen_screen(m)
    objects = [wall] + hall_objects + leaves["main"] + leaves["upper"] + court_objects + path_objects + living + screen
    report["court"] = court_report
    report["pathGround"] = path_ground
    scene["arrivalHallVersion"] = VERSION
    return objects, {"report": report, "caps": caps, "samples": samples, "leaves": {k: [o.name for o in v] for k, v in leaves.items()}}
