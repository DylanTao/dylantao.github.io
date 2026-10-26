"""Geometry for the table settings: materials, painted builds, food primitives and tableware.

Used by bin/build_coastal_table_setting.py (the build) and bin/coastal_table_dishes.py (the plated
dishes). Blender frame throughout: metres, +z up, the diner at +y. A utensil's working end sits at
the origin with its handle along +y (three.js -z) and its face up; a vessel stands on its base at
the origin. Food carries its colour per corner (sRGB designs converted to linear here) and the
piece it belongs to in its UV's u: 0 stays on the plate, 1.. are eaten in that order.
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import build_coastal_furniture as fb  # noqa: E402  (geometry helpers; its build runs only as __main__)

TAU = math.tau
LODS = (0, 1)
# Lathe segments, blob resolution and strand sides per level.
Q = {
    0: dict(lathe=48, blob=(18, 12), sides=10, strand=8, leaf=5, ring=24, bowl=56),
    1: dict(lathe=26, blob=(10, 7), sides=6, strand=4, leaf=3, ring=12, bowl=30),
}


def srgb(c):
    """A design colour (sRGB, 0-255 or 0-1 per tuple) to linear."""
    scale = 255.0 if max(c[:3]) > 1.0 else 1.0
    out = []
    for v in c[:3]:
        v = v / scale
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return tuple(out)


# ── Materials ────────────────────────────────────────────────────────────────────────────────────
# Linear colour, roughness, metallic. `painted` surfaces take their colour from vertices (white base);
# `clear` ones are not baked (glass). Names avoid realism.mjs's procedural keywords unless they mean
# to share that shading (linen, walnut).
MATERIALS = {
    "table porcelain": dict(color=(0.86, 0.85, 0.81), roughness=0.2),
    "table warm glaze": dict(color=(0.47, 0.39, 0.31), roughness=0.36),
    "table celadon": dict(color=(0.55, 0.67, 0.6), roughness=0.24),
    "table dark glaze": dict(color=(0.045, 0.045, 0.05), roughness=0.3),
    "table cast iron": dict(color=(0.03, 0.03, 0.03), roughness=0.58, metallic=0.4),
    "furniture polished nickel": dict(color=(0.61, 0.65, 0.64), roughness=0.21, metallic=0.95),
    "table glass": dict(color=(0.84, 0.9, 0.89), roughness=0.04, alpha=0.2, clear=True),
    # The lip of a glass: where its thickness shows, so a glass still reads as one in a dark room.
    "table glass rim": dict(color=(0.9, 0.94, 0.93), roughness=0.04, alpha=0.55, clear=True),
    "oatmeal linen": dict(color=(0.7, 0.64, 0.54), roughness=0.9),
    "steamer bamboo": dict(color=(0.7, 0.53, 0.3), roughness=0.78),
    "chopstick walnut": dict(color=(0.2, 0.11, 0.06), roughness=0.42),
    "food": dict(color=(1, 1, 1), roughness=0.64, painted=True),
    "food glaze": dict(color=(1, 1, 1), roughness=0.24, painted=True),
}
_materials = {}


def material(name):
    if name in _materials:
        return _materials[name]
    spec = MATERIALS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*spec["color"], 1)
    bsdf.inputs["Roughness"].default_value = spec["roughness"]
    bsdf.inputs["Metallic"].default_value = spec.get("metallic", 0.0)
    if "alpha" in spec:
        bsdf.inputs["Alpha"].default_value = spec["alpha"]
        mat.surface_render_method = "DITHERED"
    mat.diffuse_color = (*spec["color"], 1)
    mat.use_backface_culling = not spec.get("clear")
    if spec.get("painted"):
        # Cycles review renders read the vertex colour the browser multiplies in.
        attr = mat.node_tree.nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "Baked colour"
        mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    _materials[name] = mat
    return mat


# ── An item under construction: bmeshes per material, painted as they are built ──────────────────


class Build:
    def __init__(self, name, lod):
        self.name, self.lod, self.q = name, lod, Q[lod]
        self.groups = {}
        self.nodes = []  # (name, Build) children: separately placed items in one GLB
        self.meta = {}

    def bm(self, mat):
        if mat not in self.groups:
            bm = bmesh.new()
            bm.loops.layers.uv.verify()
            bm.loops.layers.float_color.new("albedo")
            self.groups[mat] = bm
        return self.groups[mat]

    def add(self, mat, make, color=(1, 1, 1), piece=0, smooth=True):
        """Run make(bm) and paint the faces it creates: `color` is sRGB or fn(position, normal)."""
        bm = self.bm(mat)
        bm.faces.ensure_lookup_table()
        start = len(bm.faces)
        make(bm)
        bm.faces.ensure_lookup_table()
        # Orient each new solid outward before colour reads its normals (seared tops, cut faces).
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[start:])
        bm.normal_update()
        uv = bm.loops.layers.uv.active
        col = bm.loops.layers.float_color["albedo"]
        fixed = None if callable(color) else (*srgb(color), 1.0)
        for f in bm.faces[start:]:
            f.smooth = smooth
            for loop in f.loops:
                loop[uv].uv = (float(piece), 0.0)
                # Half the face's own normal keeps seared tops and cut faces crisp at hard edges.
                normal = (f.normal + loop.vert.normal).normalized() if not fixed else None
                loop[col] = fixed if fixed else (*srgb(color(loop.vert.co, normal)), 1.0)
        return bm.faces[start:]


# ── Geometry ─────────────────────────────────────────────────────────────────────────────────────


def hash01(*v):
    h = 0
    for x in v:
        h = (h * 1000003) ^ int(x * 9973 + 0.5)
        h &= 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0x5BD1E995) & 0xFFFFFFFF
    h ^= h >> 15
    return (h & 0xFFFF) / 65535.0


def speckle(base, dots, density, scale=900.0, seed=0.0):
    """A colour function: `base` with `dots` (sRGB) where the hashed noise passes `density`."""

    def f(p, n):
        if noise.noise(Vector((p.x * scale + seed, p.y * scale, p.z * scale))) > 1 - 2 * density:
            return dots
        return base

    return f


def by_height(stops):
    """A colour function by height: stops [(z, sRGB)] ascending."""

    def f(p, n):
        z = p.z
        if z <= stops[0][0]:
            return stops[0][1]
        for (z0, c0), (z1, c1) in zip(stops, stops[1:]):
            if z <= z1:
                t = (z - z0) / max(1e-6, z1 - z0)
                return tuple(a + (b - a) * t for a, b in zip(c0, c1))
        return stops[-1][1]

    return f


def by_normal(top, side, bottom=None, sharp=0.55):
    """Seared tops and paler sides: a colour function by the surface normal's z."""

    def f(p, n):
        if bottom is not None and n.z < -0.3:
            return bottom
        t = max(0.0, min(1.0, (n.z - sharp + 0.25) / 0.5))
        return tuple(s + (a - s) * t for a, s in zip(top, side))

    return f


def lathe(profile, center=(0, 0, 0), segments=24, a0=0.0, a1=TAU, caps=True):
    """Revolve (r, z) pairs about the vertical axis through `center`.

    A full turn is a surface of revolution, its end rings capped where they leave the axis. A
    sector a0..a1 is closed at both cut faces by the profile polygon itself, so every wedge a
    diner takes is a solid of its own. Points on the axis merge into poles when the mesh is made.
    """

    def make(bm):
        full = abs((a1 - a0) - TAU) < 1e-9
        cx, cy, cz = center
        count = segments if full else max(2, int(round(segments * (a1 - a0) / TAU)) + 1)
        angles = [a0 + (a1 - a0) * k / (count if full else count - 1) for k in range(count)]
        rows = [[Vector((cx + r * math.cos(a), cy + r * math.sin(a), cz + z)) for a in angles] for r, z in profile]
        verts = fb.grid(bm, rows, close=full)
        if full:
            if caps:
                for ring, end in ((verts[0], profile[0]), (verts[-1], profile[-1])):
                    if end[0] > 1e-6 and len(ring) > 2:
                        try:
                            bm.faces.new(ring)
                        except ValueError:
                            pass
            return
        for k in (0, count - 1):
            column = [row[k] for row in verts]
            # Points on the axis would repeat a vertex position; keep the polygon simple.
            polygon = [v for i, v in enumerate(column) if i == 0 or (v.co - column[i - 1].co).length > 1e-7]
            if len(polygon) > 2:
                try:
                    bm.faces.new(polygon)
                except ValueError:
                    pass

    return make


def blob(center, radii, rings=None, segments=None, flat=0.0, wobble=0.0, seed=0.0, q=None, turn=0.0, tilt=(0.0, 0.0)):
    """An ellipsoid, flattened below `flat` (0-1 of its lower half) so it sits; noise for life."""
    seg, rin = segments or q["blob"][0], rings or q["blob"][1]

    def make(bm):
        cx, cy, cz = center
        rx, ry, rz = radii
        rot = Matrix.Rotation(turn, 3, "Z") @ Matrix.Rotation(tilt[0], 3, "X") @ Matrix.Rotation(tilt[1], 3, "Y")
        rows = []
        for i in range(1, rin):
            v = math.pi * i / rin
            z = -math.cos(v)
            r = math.sin(v)
            row = []
            for k in range(seg):
                a = TAU * k / seg
                p = Vector((r * math.cos(a), r * math.sin(a), z))
                if z < 0:
                    p.z = z * (1 - flat)
                n = 1 + wobble * noise.noise(Vector((p.x * 2.1 + seed, p.y * 2.1, p.z * 2.1)))
                q3 = rot @ Vector((p.x * rx * n, p.y * ry * n, p.z * rz * n))
                row.append(Vector((cx, cy, cz)) + q3)
            rows.append(row)
        verts = fb.grid(bm, rows, close=True)
        bottom = rot @ Vector((0, 0, -rz * (1 - flat)))
        top = rot @ Vector((0, 0, rz))
        cb = bm.verts.new(Vector((cx, cy, cz)) + bottom)
        ct = bm.verts.new(Vector((cx, cy, cz)) + top)
        for k in range(seg):
            k1 = (k + 1) % seg
            bm.faces.new((cb, verts[0][k1], verts[0][k]))
            bm.faces.new((ct, verts[-1][k], verts[-1][k1]))

    return make


def tube(points, radius, sides=6, taper=None, caps=True, samples=None):
    """A swept circle along a Catmull-Rom curve; `taper(t)` scales the radius."""

    def make(bm):
        pts = fb.catmull(points, samples or max(4, len(points) * 4))
        section = fb.circle(radius, sides)
        fb.sweep(bm, pts, section, caps=caps, scale=(lambda i, t: (taper(t), taper(t))) if taper else None)

    return make


def slab(x0, x1, width, height, radius, center=(0, 0, 0), turn=0.0, taper=None, cut=(True, True), per_corner=2):
    """A rounded bar from x0 to x1 (a fillet or toast slice), its section width x height."""

    def make(bm):
        cx, cy, cz = center
        rot = Matrix.Rotation(turn, 3, "Z")
        steps = 6
        rows = []
        for i in range(steps + 1):
            x = x0 + (x1 - x0) * i / steps
            s = taper(x) if taper else (1.0, 1.0)
            sec = fb.rounded_rect(width * s[0], height * s[1], min(radius, width * s[0] * 0.45, height * s[1] * 0.45), per_corner)
            rows.append([Vector((cx, cy, cz)) + rot @ Vector((x, u, v + height * s[1] / 2)) for u, v in sec])
        verts = fb.grid(bm, rows, close=True)
        for ring, flip in ((verts[0], True), (verts[-1], False)):
            try:
                bm.faces.new(list(reversed(ring)) if flip else ring)
            except ValueError:
                pass

    return make


def smear(center, radius, thickness, wobble=0.18, seed=0.0, segments=32, stretch=(1.0, 1.0), turn=0.0):
    """A sauce pool or puree swoosh: a closed flat disc with an irregular outline and a soft edge."""

    def make(bm):
        cx, cy, cz = center
        rot = Matrix.Rotation(turn, 3, "Z")
        rings = [(0.55, thickness), (0.88, thickness * 0.82), (1.0, thickness * 0.35), (1.02, 0.0002)]
        rows = []
        for f, z in rings:
            row = []
            for k in range(segments):
                a = TAU * k / segments
                r = radius * f * (1 + wobble * noise.noise(Vector((math.cos(a) * 1.3 + seed, math.sin(a) * 1.3, seed))))
                row.append(Vector((cx, cy, cz)) + rot @ Vector((r * math.cos(a) * stretch[0], r * math.sin(a) * stretch[1], z)))
            rows.append(row)
        verts = fb.grid(bm, rows, close=True)
        top = bm.verts.new(Vector((cx, cy, cz + thickness)))
        bottom = bm.verts.new(Vector((cx, cy, cz + 0.0002)))
        for k in range(segments):
            k1 = (k + 1) % segments
            bm.faces.new((top, verts[0][k], verts[0][k1]))
            bm.faces.new((bottom, verts[-1][k1], verts[-1][k]))

    return make


def leaf(base, tip, width, curl=0.25, segments=4, thickness=0.0012):
    """A thin closed leaf from base to tip, its edges curling up: herbs, greens, shavings."""

    def make(bm):
        b, t = Vector(base), Vector(tip)
        axis = t - b
        side = axis.cross(Vector((0, 0, 1)))
        if side.length < 1e-6:
            side = Vector((1, 0, 0))
        side.normalize()
        up = side.cross(axis).normalized()
        if up.z < 0:
            up = -up
        # One closed tube: the section is a thin lens across the leaf's width.
        points, scales = [], []
        for i in range(segments + 1):
            s = i / segments
            w = width * max(0.08, math.sin(math.pi * min(0.97, s * 0.94 + 0.03))) * (1 - 0.25 * s)
            points.append(b + axis * s + up * (0.15 * width * math.sin(math.pi * s)))
            scales.append(w)
        section = []
        for j in range(8):
            a = TAU * j / 8
            u = math.cos(a)
            section.append((u, thickness * 0.5 * math.sin(a)))
        rows = []
        for p, w in zip(points, scales):
            rows.append([p + side * (u * w) + up * (v + curl * w * u * u) for u, v in section])
        verts = fb.grid(bm, rows, close=True)
        for ring, flip in ((verts[0], True), (verts[-1], False)):
            try:
                bm.faces.new(list(reversed(ring)) if flip else ring)
            except ValueError:
                pass

    return make


def cylinder(center, radius, height, segments=24, bevel=0.0, turn=(0.0, 0.0)):
    r, h = radius, height
    profile = [(r - bevel, 0.0), (r, bevel), (r, h - bevel), (r - bevel, h)] if bevel else [(r, 0.0), (r, h)]

    def make(bm):
        lathe(profile, (0, 0, 0), segments)(bm)

    if turn == (0.0, 0.0):
        return lathe(profile, center, segments)

    def rotated(bm):
        temp = bmesh.new()
        make(temp)
        bmesh.ops.transform(temp, verts=temp.verts, matrix=Matrix.Translation(center) @ Matrix.Rotation(turn[0], 4, "X") @ Matrix.Rotation(turn[1], 4, "Z"))
        data = bpy.data.meshes.new("tmp")
        temp.to_mesh(data)
        temp.free()
        bm.from_mesh(data)
        bpy.data.meshes.remove(data)

    return rotated


def bumpy(make, amount, scale=180.0, seed=0.0, up_only=False, vertical=False):
    """Run `make`, then push its vertices along their normals by noise: crumb, mash, cream, rice.
    `vertical` pushes straight up instead, so wedges cut from one mound stay joined at their seams."""

    def run(bm):
        temp = bmesh.new()
        temp.loops.layers.uv.verify()
        make(temp)
        bmesh.ops.recalc_face_normals(temp, faces=temp.faces)
        temp.normal_update()
        for v in temp.verts:
            if up_only and v.normal.z < 0.2:
                continue
            d = noise.noise(Vector((v.co.x * scale + seed, v.co.y * scale, v.co.z * scale)))
            v.co += (Vector((0.0, 0.0, 1.0)) if vertical else v.normal) * (amount * d)
        data = bpy.data.meshes.new("tmp")
        temp.to_mesh(data)
        temp.free()
        bm.from_mesh(data)
        bpy.data.meshes.remove(data)

    return run


def egg_half(center, radius=0.016, height=0.013, turn=0.0, segments=24):
    """A soft-boiled egg halved lengthwise: a white dome below, the flat cut face up."""
    prof = [(0.0, 0.0), (radius * 0.55, 0.0015), (radius * 0.9, height * 0.35), (radius, height * 0.75), (radius * 0.98, height), (0.0, height)]

    def make(bm):
        temp = bmesh.new()
        temp.loops.layers.uv.verify()
        lathe(prof, (0, 0, 0), segments)(temp)
        bmesh.ops.transform(temp, verts=temp.verts, matrix=Matrix.Translation(center) @ Matrix.Rotation(turn, 4, "Z") @ Matrix.Diagonal((1.0, 1.32, 1.0, 1.0)))
        data = bpy.data.meshes.new("tmp")
        temp.to_mesh(data)
        temp.free()
        bm.from_mesh(data)
        bpy.data.meshes.remove(data)

    return make


def egg_colour(center, yolk=0.0095, jammy=(236, 132, 22), white=(250, 248, 240)):
    def f(p, n):
        d = Vector((p.x - center[0], p.y - center[1])).length
        if n.z > 0.85 and d < yolk:
            return tuple(a * (1 - 0.18 * (d / yolk) ** 2) for a in jammy)
        return white

    return f


def transformed(make, matrix):
    """Run `make` in a scratch bmesh and add the result transformed by `matrix`."""

    def run(bm):
        temp = bmesh.new()
        temp.loops.layers.uv.verify()
        make(temp)
        bmesh.ops.transform(temp, verts=temp.verts, matrix=matrix)
        data = bpy.data.meshes.new("tmp")
        temp.to_mesh(data)
        temp.free()
        bm.from_mesh(data)
        bpy.data.meshes.remove(data)

    return run


# ── Tableware ────────────────────────────────────────────────────────────────────────────────────
# Blender frame: +z up, the diner at +y. A utensil's working end is at the origin and its handle
# runs along +y (three.js -z), face up; a vessel stands at the origin.


def plate_profile(radius, well, rim_height=0.022, well_depth=0.012, foot=0.006):
    r, w = radius, well
    return [
        (0.0, foot * 0.2),
        (w * 0.85, foot * 0.2),
        (w, foot * 0.1),
        (w * 1.04, 0.0),
        (w * 1.08, foot * 0.4),
        (w * 1.12, foot),
        (r * 0.97, rim_height - 0.004),
        (r, rim_height - 0.001),
        (r * 0.995, rim_height + 0.0015),
        (r * 0.96, rim_height),
        (w * 1.06, rim_height - well_depth + 0.004),
        (w * 0.9, rim_height - well_depth + 0.001),
        (0.0, rim_height - well_depth),
    ]


def bowl_profile(radius, height, wall=0.005, foot_radius=None, foot=0.008):
    fr = foot_radius or radius * 0.45
    pts = [(0.0, 0.002), (fr * 0.9, 0.002), (fr, 0.0), (fr * 1.03, foot), (fr * 1.1, foot)]
    for k in range(1, 9):
        t = k / 8
        pts.append((fr * 1.1 + (radius - fr * 1.1) * math.sin(t * math.pi / 2), foot + (height - foot) * (1 - math.cos(t * math.pi / 2)) ** 0.9))
    pts.append((radius - wall * 0.5, height + wall * 0.4))
    inner = []
    for k in range(8, 0, -1):
        t = k / 8
        inner.append((max(0.0, (radius - wall) * math.sin(t * math.pi / 2) ** 1.15), foot + wall + (height - foot - wall) * (1 - math.cos(t * math.pi / 2)) ** 0.9))
    pts += inner + [(0.0, foot + wall)]
    return pts


def inner_profile(radius, height, foot=0.008, wall=0.005):
    """The bowl's inside as (y, r) pairs for the runtime's liquids and layered fillings."""
    out = []
    for k in range(0, 9):
        t = k / 8
        out.append((round(foot + wall + (height - foot - wall) * (1 - math.cos(t * math.pi / 2)) ** 0.9, 4), round((radius - wall) * math.sin(max(t, 0.05) * math.pi / 2) ** 1.15, 4)))
    return out


def fork(b, length=0.19, scale=1.0, dessert=False):
    """A dinner fork: four tines curving up, a neck, a flat handle widening to its end."""
    L = length * scale
    nickel = "furniture polished nickel"
    tine_l = 0.04 * scale
    for k in range(4):
        x = (k - 1.5) * 0.0062 * scale
        pts = [(x * 1.02, -0.0, 0.006), (x, tine_l * 0.5, 0.0035), (x * 0.9, tine_l, 0.0012)]
        b.add(nickel, tube([(p[0], p[1], p[2]) for p in pts], 0.0011 * scale, sides=4 if b.lod else 6, taper=lambda t: 0.75 + 0.25 * t))
    b.add(nickel, slab(tine_l, tine_l + 0.014 * scale, 0.026 * scale, 0.0024 * scale, 0.001, (0, 0, 0.0002), turn=math.pi / 2, taper=lambda x: (1 - 0.55 * (x - tine_l) / (0.014 * scale), 1)))
    neck = tine_l + 0.014 * scale
    b.add(
        nickel,
        slab(neck, L, 0.012 * scale, 0.0032 * scale, 0.0012, (0, 0, -0.0004), turn=math.pi / 2, taper=lambda x: (0.55 + 0.75 * ((x - neck) / (L - neck)) ** 1.4, 1.0)),
    )
    b.meta.update(grip=round(0.12 * scale, 4), length=round(L, 4), carry=[0, 0.006, -0.012])


def spoon(b, length=0.18, bowl=(0.024, 0.04), scale=1.0):
    """A spoon: a thin, dished oval bowl at the origin end and a tapering handle."""
    nickel = "furniture polished nickel"
    bw, bl = bowl[0] * scale, bowl[1] * scale
    depth = 0.006 * scale

    def make(bm):
        temp = bmesh.new()
        blob((0, bl / 2, 0.0), (bw / 2, bl / 2, 0.0008), q=b.q)(temp)
        for v in temp.verts:
            u, w = v.co.x / (bw / 2), (v.co.y - bl / 2) / (bl / 2)
            v.co.z += 0.0065 * scale - depth * max(0.0, 1 - u * u - w * w)
        data = bpy.data.meshes.new("tmp")
        temp.to_mesh(data)
        temp.free()
        bm.from_mesh(data)
        bpy.data.meshes.remove(data)

    b.add(nickel, make)
    b.add(nickel, slab(bl * 0.92, length * scale, 0.011 * scale, 0.003 * scale, 0.0012, (0, 0, 0.005 * scale), turn=math.pi / 2, taper=lambda x: (0.5 + 0.8 * max(0.0, (x - bl) / (length * scale - bl)) ** 1.3, 1.0)))
    b.meta.update(grip=round(0.11 * scale, 4), length=round(length * scale, 4), carry=[0, 0.002, -0.018 * scale])


def knife(b, length=0.215):
    """A table knife: a thin blade with a rounded tip and a straight spine, a rounded handle."""
    nickel = "furniture polished nickel"
    blade = 0.1
    height = lambda x: 0.016 * (0.35 + 0.65 * math.sin(math.pi * min(1.0, 0.15 + (x / blade) * 0.85) * 0.5))
    b.add(nickel, slab(0.0, blade, 0.0018, 0.016, 0.0007, (0, 0, 0.002), turn=math.pi / 2, taper=lambda x: (1.0, height(x) / 0.016)))
    b.add(nickel, slab(blade, length, 0.0125, 0.007, 0.003, (0, 0, 0.0005), turn=math.pi / 2, taper=lambda x: (0.75 + 0.35 * ((x - blade) / (length - blade)), 1.0)))
    b.meta.update(grip=0.13, length=length)


def chopsticks(b, length=0.235):
    for side in (-1, 1):
        x = side * 0.004
        b.add("chopstick walnut", tube([(x, 0.0, 0.003), (x + side * 0.004, length * 0.5, 0.004), (x + side * 0.008, length, 0.005)], 0.0034, sides=6 if b.lod else 8, taper=lambda t: 0.45 + 0.55 * t))
    b.meta.update(grip=0.15, length=length, carry=[0, 0.006, -0.008])


def napkin(b):
    # A folded linen napkin: two soft layers, a rolled fold along one side.
    w, l, h = 0.11, 0.165, 0.004
    for k in range(2):
        b.add("oatmeal linen", fb_box((0, 0, h * 0.5 + k * h * 0.9), (w - k * 0.006, l - k * 0.004, h), 0.0018), (232, 222, 203))
    b.add("oatmeal linen", tube([(-w / 2 + 0.003, -l / 2, h * 1.4), (-w / 2 + 0.003, l / 2, h * 1.4)], h * 1.2, sides=8), (226, 214, 194))


def fb_box(center, size, radius):
    def make(bm):
        fb.box(bm, center, size, radius, segments=2)

    return make


def saucer(b):
    b.add("table porcelain", lathe(plate_profile(0.075, 0.034, 0.012, 0.006, 0.004), segments=b.q["lathe"]))


GLASSES = {
    # Outer profile (r, z) and inner liquid profile (y, r), rim height. Proportions from common
    # bar glassware.
    "wine": dict(outer=[(0.038, 0.0), (0.038, 0.0025), (0.006, 0.006), (0.0035, 0.02), (0.0035, 0.07), (0.012, 0.08), (0.032, 0.095), (0.043, 0.125), (0.041, 0.165), (0.034, 0.2), (0.033, 0.205)], wall=0.0016, floor=0.082, rim=0.205, gripHeight=0.045, gripRadius=0.006),
    "tumbler": dict(outer=[(0.033, 0.0), (0.035, 0.008), (0.039, 0.1), (0.0395, 0.103)], wall=0.0022, floor=0.009, rim=0.103, gripHeight=0.045, gripRadius=0.038),
    "juice": dict(outer=[(0.028, 0.0), (0.03, 0.007), (0.034, 0.092), (0.0345, 0.095)], wall=0.002, floor=0.008, rim=0.095, gripHeight=0.042, gripRadius=0.033),
    "rocks": dict(outer=[(0.043, 0.0), (0.044, 0.014), (0.046, 0.084), (0.0465, 0.087)], wall=0.0026, floor=0.015, rim=0.087, gripHeight=0.04, gripRadius=0.045),
    "highball": dict(outer=[(0.03, 0.0), (0.031, 0.01), (0.033, 0.148), (0.0335, 0.151)], wall=0.002, floor=0.011, rim=0.151, gripHeight=0.06, gripRadius=0.032),
    "coupe": dict(outer=[(0.036, 0.0), (0.036, 0.0025), (0.005, 0.006), (0.0035, 0.02), (0.0035, 0.1), (0.015, 0.11), (0.043, 0.126), (0.057, 0.146), (0.059, 0.15)], wall=0.0016, floor=0.112, rim=0.15, gripHeight=0.06, gripRadius=0.006),
    "tulip": dict(outer=[(0.032, 0.0), (0.032, 0.003), (0.006, 0.008), (0.006, 0.03), (0.02, 0.04), (0.038, 0.075), (0.04, 0.12), (0.034, 0.165), (0.0335, 0.17)], wall=0.002, floor=0.042, rim=0.17, gripHeight=0.09, gripRadius=0.04),
    "gibraltar": dict(outer=[(0.03, 0.0), (0.032, 0.012), (0.037, 0.088), (0.0375, 0.091)], wall=0.0022, floor=0.013, rim=0.091, gripHeight=0.04, gripRadius=0.036),
}


def glass_build(b, kind):
    g = GLASSES[kind]
    outer = g["outer"]
    wall = g["wall"]
    # Inner surface: the outer profile pulled in by the wall, down to the glass's floor.
    inner = [(max(0.0, r - wall), z) for r, z in reversed(outer) if z >= g["floor"]]
    profile = outer + [(inner[0][0], outer[-1][1])] + inner[1:] + [(0.0, g["floor"])]
    b.add("table glass", lathe(profile, segments=b.q["lathe"]), (220, 232, 230))
    # A rounded lip, a shade more opaque than the bowl: the line a drawn glass would have. A
    # stemmed glass's thin foot gets the same edge, or it vanishes in a dark room.
    sides = 4 if b.lod else 6
    b.add("table glass rim", torus((0, 0, outer[-1][1] - wall * 0.4), outer[-1][0] - wall * 0.5, wall * 0.75, b.q["lathe"], sides), (230, 240, 238))
    if outer[2][0] < outer[1][0] * 0.5:
        b.add("table glass rim", torus((0, 0, outer[1][1] * 0.5), outer[1][0] - 0.0008, 0.0013, b.q["lathe"], sides), (230, 240, 238))
    # The liquid's profile (three.js y, r) along the inside, from the floor up.
    pts = sorted(((round(z, 4), round(max(0.0, r - wall - 0.0004), 4)) for r, z in outer if z >= g["floor"]), key=lambda p: p[0])
    if not pts or pts[0][0] > g["floor"]:
        pts.insert(0, (g["floor"], round(max(0.0, (pts[0][1] if pts else 0.02) * 0.8), 4)))
    b.meta.update(profile=[list(p) for p in pts], rim=g["rim"], gripHeight=g["gripHeight"], gripRadius=g["gripRadius"])


def tea_cup(b):
    # A small porcelain jasmine-tea cup, no handle.
    b.add("table porcelain", lathe(bowl_profile(0.034, 0.046, 0.003, 0.016, 0.006), segments=b.q["lathe"]))
    b.meta.update(profile=[list(p) for p in inner_profile(0.034, 0.046, 0.006, 0.003)], rim=0.046, gripHeight=0.025, gripRadius=0.034)


def garnish_lime_wheel(b):
    b.add("food", cylinder((0, 0, -0.0025), 0.022, 0.005, b.q["ring"]), lambda p, n: (163, 196, 60) if abs(n.z) > 0.6 and Vector((p.x, p.y)).length < 0.019 else (64, 120, 32))
    b.meta.update(rim=True, stand=True, offset=[0.0, 0.0, 0.0])


def garnish_orange_peel(b):
    b.add("food glaze", tube([(-0.018, 0, 0.0), (0, 0.006, 0.004), (0.018, 0, 0.0)], 0.004, sides=b.q["sides"]), (228, 120, 26))
    b.meta.update(offset=[0.008, 0.002, 0.004])


def garnish_ice(b, large=False):
    s = 0.05 if large else 0.024
    b.add("table glass", fb_box((0, 0, s / 2), (s, s, s), s * 0.12), (230, 240, 242))
    # It floats with most of it under the surface.
    b.meta.update(offset=[0.0, -s * 0.72, 0.0], turn=0.35)


def garnish_ice_pair(b):
    for x, y, z, t in ((-0.011, 0.004, 0.012, 0.3), (0.012, -0.006, 0.01, -0.5)):
        b.add("table glass", transformed(fb_box((0, 0, 0), (0.022, 0.022, 0.022), 0.003), Matrix.Translation((x, y, z)) @ Matrix.Rotation(t, 4, "Z")), (230, 240, 242))
    b.meta.update(offset=[0.0, -0.017, 0.0])


def garnish_beans(b):
    for k in range(3):
        a = k * TAU / 3
        b.add("food glaze", blob((0.009 * math.cos(a), 0.009 * math.sin(a), 0.002), (0.0045, 0.0032, 0.0025), q=b.q, flat=0.2, turn=a), (52, 30, 18))
    b.meta.update(offset=[0.0, 0.0, 0.0])


def garnish_lemon_wheel(b):
    b.add("food", cylinder((0, 0, -0.0025), 0.02, 0.005, b.q["ring"]), lambda p, n: (244, 226, 120) if abs(n.z) > 0.6 and Vector((p.x, p.y)).length < 0.017 else (230, 196, 40))
    b.meta.update(rim=True, stand=True, offset=[0.0, 0.0, 0.0])


def torus(center, radius, tube_radius, segments=24, sides=6):
    def make(bm):
        cx, cy, cz = center
        pts = [Vector((cx + radius * math.cos(a), cy + radius * math.sin(a), cz)) for a in (TAU * k / segments for k in range(segments))]
        fb.sweep(bm, pts, fb.circle(tube_radius, sides), closed=True)

    return make


def garnish_salt_rim(b):
    b.add("food", torus((0, 0, 0), 0.0592, 0.0022, b.q["lathe"], 6), speckle((246, 244, 238), (214, 212, 204), 0.3, 1400))
    b.meta.update(rim=True, offset=[0, -0.0015, 0])


TABLEWARE = {
    "fork": lambda b: fork(b),
    "dessert-fork": lambda b: fork(b, 0.16, 0.85),
    "spoon": lambda b: spoon(b),
    "dessert-spoon": lambda b: spoon(b, 0.15, (0.019, 0.032), 0.9),
    "knife": knife,
    "chopsticks": chopsticks,
    "napkin": napkin,
    "saucer": saucer,
    "tea": tea_cup,
    **{name: (lambda k: (lambda b: glass_build(b, k)))(name) for name in GLASSES},
    "lime-wheel": garnish_lime_wheel,
    "lemon-wheel": garnish_lemon_wheel,
    "orange-peel": garnish_orange_peel,
    "ice-cube": lambda b: garnish_ice(b, True),
    "ice-cubes": garnish_ice_pair,
    "coffee-beans": garnish_beans,
    "salt-rim": garnish_salt_rim,
}

# Drinks: body and surface colours (sRGB 0-1), fill fraction of the vessel's inside, garnish nodes.
DRINKS = {
    "white-wine": dict(color=(0.93, 0.84, 0.52), fill=0.42, roughness=0.08),
    "red-wine": dict(color=(0.36, 0.04, 0.08), top=(0.42, 0.06, 0.1), fill=0.42, roughness=0.08),
    "jasmine-tea": dict(color=(0.86, 0.72, 0.36), fill=0.7, roughness=0.06),
    "iced-tea": dict(color=(0.7, 0.42, 0.16), fill=0.78, roughness=0.06, garnish=["ice-cubes", "lemon-wheel"]),
    "sparkling": dict(color=(0.86, 0.93, 0.94), fill=0.8, roughness=0.04, garnish=["ice-cubes", "lemon-wheel"]),
    "orange": dict(color=(0.98, 0.6, 0.12), fill=0.82, roughness=0.3),
    "whisky-rocks": dict(color=(0.78, 0.45, 0.13), fill=0.5, roughness=0.06, garnish=["ice-cube"]),
    "highball": dict(color=(0.92, 0.78, 0.48), fill=0.8, roughness=0.06, garnish=["ice-cubes", "lemon-wheel"]),
    "negroni": dict(color=(0.74, 0.12, 0.08), fill=0.6, roughness=0.08, garnish=["ice-cube", "orange-peel"]),
    "margarita": dict(color=(0.9, 0.9, 0.62), fill=0.72, roughness=0.1, garnish=["salt-rim", "lime-wheel"]),
    "espresso-martini": dict(color=(0.16, 0.08, 0.04), top=(0.72, 0.56, 0.38), fill=0.75, roughness=0.3, garnish=["coffee-beans"]),
    "old-fashioned": dict(color=(0.7, 0.34, 0.1), fill=0.5, roughness=0.06, garnish=["ice-cube", "orange-peel"]),
    "hazy-ipa": dict(color=(0.96, 0.7, 0.3), top=(0.98, 0.95, 0.88), fill=0.88, roughness=0.3),
    "pilsner": dict(color=(0.95, 0.78, 0.25), top=(0.98, 0.96, 0.9), fill=0.86, roughness=0.12),
    "evening-cortado": dict(color=(0.55, 0.34, 0.2), top=(0.84, 0.7, 0.52), fill=0.75, roughness=0.35),
}
