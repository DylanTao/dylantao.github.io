"""Reference-led hair, brows and expressions for the four human Sirui studies.

October 15, 2026. Sirui's 2D portraits (assets/img/sirui_pic_ghbili.png, _south_park,
_simpsons and _rick_and_morty) are the ground truth: shoulder-length black hair (very dark
brown in the Ghibli study) with real volume, parted at the crown, framing the face past the
jaw with the ends flicking outward; thick dark brows; and each style's open expression. The
previous hair was a tight cap with thin collar sheets.

This pass replaces head features only. It removes the old hair and brows, rebuilds the face
skin with the exact recipe of coastal_characters.adult_face, cuts the style's new mouth into
it, and adds teeth and a tongue where the portrait shows them. Every new vertex is weighted
fully to Head, so it follows the head through all fourteen clips. Eyes, irises, eyelids and
their Blink morphs, glasses, neck, body, hands, feet, all other skin weights, bones and every
authored key are untouched. The rearmost hair point stays where the old hair's was, so the
sleep clip still lays the head where its pillow was fitted.
"""

import math
from collections import defaultdict
import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from coastal_characters import adult_face, face_profile, skull_loft
from coastal_sculpt import swept_lock

STYLES = ("south-park", "simpsons", "ghibli", "rick-and-morty")
# head_z, head_scale and the adult head factor of build_coastal_home.character().
AUTHORING = {
    "south-park": (1.29, (0.36, 0.24, 0.35), 0.90),
    "simpsons": (1.43, (0.20, 0.18, 0.31), 0.83),
    "rick-and-morty": (1.43, (0.205, 0.16, 0.32), 0.83),
    "ghibli": (1.39, (0.184, 0.163, 0.222), 0.58),
}
PIVOT = Vector((0, 0, 1.12))  # head scale pivot in character()
LIFT = 0.24  # coastal_anatomy lifts Head-weighted skin by this much
# The Rick and Morty portrait has a broad, round lower face, and the Ghibli one a softer jaw.
# Cheeks, jaw and chin widen from nothing just below the lower lids (above them sit the eyes
# and the glasses arms) to the full amount further down; the ears move out with the skull.
WIDEN = {"rick-and-morty": (0.22, -0.16, -0.55), "ghibli": (0.08, 0.0, -0.60)}
# The neck follows the spine, not the head: the curtain's inner surface keeps this clearance
# from it so the deepest authored forward head pitch (reading, 0.22 rad) cannot press hair in.
NECK_CLEARANCE = 0.022
# Rearmost Head point of the retained September/October sources (rest pose). The sleep clip's
# head lift was solved from it, so the new hair keeps its back inside this plane.
SLEEP_BACK_Y = {"south-park": 0.2701, "simpsons": 0.1968, "rick-and-morty": 0.1807, "ghibli": 0.1244}

# Hair, in final meters and radians. Azimuth a runs from the face (-Y) toward +X, which is
# screen right in a front view; the polar angle p runs down from the crown.
HAIR = {
    "south-park": dict(
        crown=0.105, side=0.068, part=0.20, part_p=0.40, sweep=(0.75, 0.65), fore=(0.30, 0.55),
        tip=1.285, flare=0.30, hug=0.0, locks=13, groove=0.012, points=0.055,
        flick=0.20, flick_up=0.034, lean=0.12,
    ),
    "simpsons": dict(
        crown=0.058, side=0.052, part=0.22, part_p=0.36, sweep=(0.75, 0.60), fore=(0.30, 0.55),
        tip=1.375, flare=0.30, hug=0.0, locks=12, groove=0.008, points=0.050,
        flick=0.24, flick_up=0.030, lean=0.18,
    ),
    "rick-and-morty": dict(
        crown=0.054, side=0.050, part=0.20, part_p=0.36, sweep=(0.75, 0.62), fore=(0.30, 0.55),
        tip=1.365, flare=0.30, hug=0.0, locks=12, groove=0.008, points=0.050,
        flick=0.22, flick_up=0.030, lean=0.15,
    ),
    "ghibli": dict(
        crown=0.046, side=0.040, part=0.08, part_p=0.36, sweep=(0.72, 0.70), fore=(0.25, 0.45),
        tip=1.362, flare=0.30, hug=-0.05, locks=17, groove=0.006, points=0.032,
        flick=0.26, flick_up=0.016, color=(0.019, 0.0115, 0.0075), fringe=(0.10, 11),
    ),
}
GRID = dict(columns=176, cap_rows=30, curtain_rows=24)

# Brows relative to each glasses ring: radius R about the eye center. x runs outward from the
# nose, z up; thick is the vertical thickness, depth the protrusion as a share of it.
BROWS = {
    "south-park": dict(inner=-0.62, outer=0.70, lift=1.30, arch=0.08, tilt=0.06, thick=0.34, depth=0.42),
    "simpsons": dict(inner=-0.66, outer=0.62, lift=1.33, arch=0.07, tilt=0.03, thick=0.36, depth=0.45),
    "rick-and-morty": dict(inner=-0.62, outer=0.66, lift=1.36, arch=0.12, tilt=0.0, thick=0.34, depth=0.45),
    "ghibli": dict(inner=-0.86, outer=0.80, lift=1.30, arch=0.18, tilt=0.06, thick=0.42, depth=0.50),
}
RING = {"south-park": 0.121, "simpsons": 0.101, "rick-and-morty": 0.101, "ghibli": 0.053}

# Mouths in authoring coordinates (before the head factor): center height below head_z, half
# width, height, corner lift and the shape of the opening.
MOUTH = {
    "south-park": dict(shape="d", drop=0.180, width=0.106, height=0.080, lift=0.010, teeth=4,
                       teeth_span=0.62, teeth_drop=0.30, color=(0.022, 0.009, 0.008)),
    "simpsons": dict(shape="grin", drop=0.150, width=0.104, height=0.042, lift=0.028, asym=0.35,
                     teeth=5, teeth_span=0.80, teeth_drop=0.84, color=(0.05, 0.014, 0.011)),
    "rick-and-morty": dict(shape="d", drop=0.160, width=0.124, height=0.086, lift=0.016, teeth=7,
                           teeth_span=0.86, teeth_drop=0.24, scallop=True, tongue=(0.72, 0.30, 0.30),
                           color=(0.085, 0.020, 0.012)),
    "ghibli": dict(shape="d", drop=0.115, width=0.058, height=0.040, lift=0.006, teeth=0,
                   tongue=(0.70, 0.24, 0.18), color=(0.30, 0.055, 0.04)),
}


def to_final(co, factor):
    """Authoring coordinates to the retained rig: head scale, then the adult lift."""
    return PIVOT + (Vector(co) - PIVOT) * factor + Vector((0, 0, LIFT))


def smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def reshaped(style):
    """The face profile for this pass and how far the ears move out with it (authoring m)."""
    if style not in WIDEN:
        return None, 0.0
    amount, start, full = WIDEN[style]
    profile = [(l, wx * (1 + amount * smoothstep(start, full, l)), wy) for l, wx, wy in face_profile(style)]
    head_z, (hx, hy, hz), _ = AUTHORING[style]
    return profile, hx * amount * smoothstep(start, full, -0.015 / hz)


def material(name, color, rough=0.65):
    found = bpy.data.materials.get(name)
    if found:
        return found
    m = bpy.data.materials.new(name)
    recolor(m, color, rough)
    return m


def recolor(m, color, rough=None):
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    if rough is not None:
        bsdf.inputs["Roughness"].default_value = rough


def sphere(name, loc, scale, mat, segments=20):
    """build_coastal_home.sphere: a smooth UV sphere with twelve rings."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=12, location=loc)
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for p in o.data.polygons:
        p.use_smooth = True
    o.name = name
    if mat:
        o.data.materials.append(mat)
    return o


def mesh_object(name, verts, faces, mat, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.validate()
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    if mat:
        data.materials.append(mat)
    for p in data.polygons:
        p.use_smooth = smooth
    return obj


def discard(obj):
    data = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if data and not data.users:
        bpy.data.meshes.remove(data)


def transform(obj, factor):
    """Bake the object's own placement, then move its mesh onto the retained rig."""
    world = obj.matrix_world.copy()
    for v in obj.data.vertices:
        v.co = to_final(world @ v.co, factor)
    obj.matrix_world = Matrix.Identity(4)
    obj.data.update()


def tree_of(obj):
    return BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())


def components(me, polygons):
    adjacent = defaultdict(set)
    for p in polygons:
        vs = list(p.vertices)
        for i in vs:
            adjacent[i].update(vs)
    remaining, found = set(adjacent), []
    while remaining:
        start = remaining.pop()
        part, pending = {start}, [start]
        while pending:
            i = pending.pop()
            for j in adjacent[i]:
                if j in remaining:
                    remaining.discard(j)
                    part.add(j)
                    pending.append(j)
        found.append(part)
    return found


def likeness_vertices(mesh, eye_z):
    """The head features this pass owns, found the same way on any retained or refreshed source.

    Hair and brows (the hair material), the welded face skin (the largest Head-only skin
    component; the four soft eyelid tubes are separate pieces), the mouth, tongue and Ghibli's
    lip crease, and the Head-only white pieces below the eyes (teeth).
    """
    me = mesh.data
    head = mesh.vertex_groups["Head"].index
    names = [m.name if m else "" for m in me.materials]
    by_material = defaultdict(list)
    for p in me.polygons:
        by_material[names[p.material_index]].append(p)

    def head_only(i):
        groups = me.vertices[i].groups
        return len(groups) == 1 and groups[0].group == head and groups[0].weight > 0.999

    owned = {"hair": set(), "face": set(), "mouth": set(), "teeth": set()}
    for p in by_material.get("long black hair", []):
        owned["hair"].update(p.vertices)
    for name in ("mouth", "tongue", "quiet lip crease"):
        for p in by_material.get(name, []):
            owned["mouth"].update(p.vertices)
    skin = [c for c in components(me, by_material["skin"]) if head_only(next(iter(c)))]
    owned["face"] = max(skin, key=len)
    for part in components(me, by_material.get("warm white", [])):
        if head_only(next(iter(part))) and max(me.vertices[i].co.z for i in part) < eye_z - 0.04:
            owned["teeth"].update(part)
    return owned


def remove_vertices(mesh, indices):
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in sorted(indices)], context="VERTS")
    bm.to_mesh(mesh.data)
    bm.free()
    mesh.data.update()


class HeadFrame:
    """Final-coordinate head measurements shared by the hair, brows and mouth."""

    def __init__(self, style, mesh, arm):
        head_z, head_scale, factor = AUTHORING[style]
        self.style, self.factor = style, factor
        self.authoring = (head_z, head_scale)
        hx, hy, hz = head_scale
        self.center = to_final((0, -0.015, head_z), factor)
        self.scale = Vector(head_scale) * factor
        natural = style == "ghibli"
        self.profile, self.ear_out = reshaped(style)
        ear_radius = Vector((0.030, 0.028, 0.055) if natural else (0.043, 0.031, 0.058)) * factor
        self.ears = {side: (to_final((sign * (hx * 0.98 + self.ear_out), -0.003, head_z - 0.015), factor),
                            ear_radius) for side, sign in (("L", -1), ("R", 1))}
        me = mesh.data
        names = [m.name if m else "" for m in me.materials]
        white = components(me, [p for p in me.polygons if names[p.material_index] == "warm white"])
        self.eyes = {}
        for side in ("L", "R"):
            pivot = arm.matrix_world @ arm.data.bones["Eye." + side].head_local
            part = min(white, key=lambda c: (sum((me.vertices[i].co for i in c), Vector()) / len(c) - pivot).length)
            coords = [me.vertices[i].co for i in part]
            lo = Vector([min(c[k] for c in coords) for k in range(3)])
            hi = Vector([max(c[k] for c in coords) for k in range(3)])
            self.eyes[side] = ((lo + hi) / 2, (hi - lo) / 2)
        self.eye_z = self.eyes["R"][0].z
        glass = [me.vertices[i].co for p in me.polygons if names[p.material_index] == "wire spectacles"
                 for i in p.vertices]
        front = min(c.y for c in glass)
        # The arms run back from the rims to the ears; the hair must clear them over each ear.
        self.arm_top = max(c.z for c in glass if c.y > front + 0.06)
        spine = mesh.vertex_groups["Spine"].index
        neck = set()
        for part in components(me, [p for p in me.polygons if names[p.material_index] == "skin"]):
            groups = me.vertices[next(iter(part))].groups
            if len(groups) == 1 and groups[0].group == spine:
                neck |= part
        self.neck_top = max(me.vertices[i].co.z for i in neck)
        self.neck = BVHTree.FromPolygons([v.co.copy() for v in me.vertices],
                                         [list(p.vertices) for p in me.polygons if all(i in neck for i in p.vertices)])
        # Outer radius of each glasses ring (eye radius plus the rim offset of refine_human).
        self.ring = RING[style] * factor


def skull_tree(frame):
    """BVH of the lofted skull alone, so ears and nose never push the hair outward."""
    head_z, head_scale = frame.authoring
    skull = skull_loft(frame.style, head_z, head_scale, None, frame.profile)
    transform(skull, frame.factor)
    tree = tree_of(skull)
    discard(skull)
    return tree


def framing_hair(frame, hair):
    """A parted, voluminous shell that frames the face and falls to the jaw.

    The cap follows the skull from the crown, thickest on top, and leaves an arched forehead
    below the side part. Over each ear it stops just above the ear and the glasses arm; behind
    the ear a curtain falls straight, hugs in a little past the cheek, then flares into pointed
    locks that flick outward. The inner surface lies just inside the skull, so the shell reads
    as a mass of hair, not a cap. Returns one closed mesh object and its measurements.
    """
    k = HAIR[frame.style]
    C, (hx, hy, hz) = frame.center, frame.scale
    tree = skull_tree(frame)
    tau = math.tau
    target_back = SLEEP_BACK_Y[frame.style]

    def skull(a, p):
        e = Vector((hx * math.sin(p) * math.sin(a), -hy * math.sin(p) * math.cos(a), hz * math.cos(p)))
        n = e.normalized()
        hit = tree.ray_cast(C, n, 2.0)
        return n, ((hit[0] - C).length if hit[0] is not None else e.length)

    ear_top = max(c.z + r.z for c, r in frame.ears.values())
    temple_z = max(ear_top, frame.arm_top) + 0.010
    ear_c, ear_r = frame.ears["R"]
    ear_back = ear_c.y + ear_r.y + 0.010
    a_front = math.pi / 2
    while C.y - hy * math.cos(a_front) < ear_back and a_front < 2.4:
        a_front += 0.005
    # The curtain leaves the cap at the skull's equator, where its wall is vertical.
    p_eq = math.pi / 2
    # The forehead stays open above the brows; the hair drops only at the face's edges.
    b = BROWS[frame.style]
    brow_top = frame.eye_z + (b["lift"] + b["arch"]) * frame.ring + 0.5 * b["thick"] * frame.ring
    brow_x = frame.eyes["R"][0].x + b["outer"] * frame.ring
    brow_a = math.atan2(brow_x, hy)
    fore = {-1: brow_top + k["fore"][0] * frame.ring, 1: brow_top + k["fore"][1] * frame.ring}

    def wrap(a):
        return (a + math.pi) % tau - math.pi

    # The back of the head may only be as thick as the retained sleep contact allows.
    n_back, d_back = skull(math.pi, p_eq)
    back_room = target_back - 0.001 - (C + n_back * d_back).y
    back_thick = max(0.004, min(k["side"], back_room))

    def thickness(a, p):
        top = math.cos(min(p, math.pi / 2)) ** 1.5
        rear = max(0.0, -math.cos(a)) ** 2 * smoothstep(0.7, 1.45, p)
        side = k["side"] + (back_thick - k["side"]) * rear
        base = side + (k["crown"] - side) * top
        delta = wrap(a - k["part"])
        # More hair is swept toward the screen-left side of the part, as in the portraits.
        base *= 1 + k.get("lean", 0.0) * (max(0.0, -math.sin(a)) - 0.35 * max(0.0, math.sin(a)))
        # The part is a narrow seam; the hair rises into a soft roll either side of it.
        seam = math.exp(-(delta / 0.05) ** 2) * math.exp(-((p - 0.2) / 0.55) ** 2)
        roll = smoothstep(0.03, 0.45, abs(delta)) * math.exp(-((p - k["part_p"] - 0.25) / 0.45) ** 2)
        return base * (1 - 0.38 * seam) + 0.06 * k["crown"] * roll * (1 - abs(math.sin(a)) ** 3)

    def polar_at(a, z):
        lo, hi = 0.05, p_eq
        for _ in range(26):
            mid = (lo + hi) / 2
            n, d = skull(a, mid)
            if (C + n * (d + k["side"])).z > z:
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2

    # The edge sweeps down from the forehead corner and rests on the ear only where the ear is.
    ear_front = math.atan2(ear_c.x, -(ear_c.y - ear_r.y - C.y))

    def temple_weight(a):
        """0 along the forehead hairline, 1 over the ears."""
        return smoothstep(brow_a + 0.06, max(brow_a + 0.42, ear_front), abs(a))

    def cap_end(a):
        """Polar angle where a cap column ends: forehead arch, the face's edge, the temple."""
        if abs(a) >= a_front:
            return p_eq
        delta = wrap(a - k["part"])
        side = -1 if delta < 0 else 1
        width = k["sweep"][0] if side < 0 else k["sweep"][1]
        arch = k["part_p"] + (polar_at(a, fore[side]) - k["part_p"]) * smoothstep(0.0, 1.0, abs(delta) / width) ** 0.8
        if k.get("fringe"):
            # A few pointed locks fall a little past the hairline, away from the part.
            amount, count = k["fringe"]
            f = (count * (warp(a) + math.pi) / tau) % 1.0
            arch += amount * (1 - abs(2 * f - 1)) ** 2.2 * smoothstep(0.04, 0.3, abs(delta))
        edge = temple_weight(a)
        return arch + (polar_at(a, temple_z) - arch) * edge

    # Locks: uneven widths around the head, each ending in a pointed tip.
    def warp(a):
        return a + 0.11 * math.sin(3 * a + 1.0) + 0.05 * math.sin(7 * a + 2.0)

    def lock_phase(a):
        x = k["locks"] * (warp(a) + math.pi) / tau
        return x - math.floor(x), math.floor(x)

    def lock(a):
        """0 in the groove between two locks, 1 along a lock's middle."""
        f, _ = lock_phase(a)
        return (1 - abs(2 * f - 1)) ** 0.5

    def pointy(a):
        f, i = lock_phase(a)
        length = 0.55 + 0.45 * (0.5 + 0.5 * math.sin(i * 12.9898 + 4.1414))
        return (1 - abs(2 * f - 1)) ** 1.7 * length

    columns, cap_rows, curtain_rows = GRID["columns"], GRID["cap_rows"], GRID["curtain_rows"]
    azimuths = [-math.pi + tau * (j + 0.5) / columns for j in range(columns)]
    curtain = [abs(a) >= a_front for a in azimuths]
    back_top = (C + n_back * (d_back + thickness(math.pi, p_eq))).y
    # The back falls nearly straight onto the shoulders, inside the retained sleep contact.
    room = (target_back - 0.001 - C.y) / max(1e-4, back_top - C.y)
    flare_back = max(0.0, min(0.07, room - 1))
    outer, inner, rows_of = {}, {}, {}
    for j, a in enumerate(azimuths):
        end = cap_end(a)
        edge = smoothstep(a_front, a_front + 0.14, abs(a)) if curtain[j] else 1
        # Strands describe the comb direction down the sides and back.
        comb = k["groove"] * (lock(a) - 1) * abs(math.sin(a / 2)) ** 0.5
        # The forehead hairline thins to the skin; over the ears the edge stays a rounded roll.
        temple = temple_weight(a) if not curtain[j] else 1
        reach, floor = 0.40 - 0.22 * temple, 0.12 + 0.20 * temple
        for i in range(1, cap_rows + 1):
            p = end * (1 - (1 - i / cap_rows) ** 1.35)
            n, d = skull(a, p)
            if curtain[j]:
                fade = 1 - (1 - edge) * smoothstep(p_eq - 0.3, p_eq, p)
                tk = thickness(a, p) * (0.38 + 0.62 * fade)
            else:
                fade = smoothstep(0.0, reach, (end - p) / max(end, 1e-3)) ** 1.3
                tk = thickness(a, p) * (floor + (1 - floor) * fade)
            outer[j, i] = C + n * (d + tk + comb * smoothstep(0.6, 1.3, p))
            inner[j, i] = C + n * (d - 0.004)
            base = C + n * (d + tk)
        rows_of[j] = cap_rows
        if not curtain[j]:
            continue
        top_o, top_i = outer[j, cap_rows], inner[j, cap_rows]
        h = Vector((base.x, base.y - C.y, 0))
        back = max(0.0, -math.cos(a)) ** 1.5
        flare = k["flare"] * (1 - back) + flare_back * back
        tipness = pointy(a) * (1 - 0.6 * back)
        tip = k["tip"] - k["points"] * tipness + 0.3 * k["points"] * back
        for i in range(1, curtain_rows + 1):
            u = i / curtain_rows
            z = top_o.z + (tip - top_o.z) * u
            # Leaves the cap vertically, eases in past the cheek, then flares and flicks out.
            kk = (1 - k["hug"] * (1 - back) * math.sin(math.pi * min(1, u / 0.8)) ** 2
                  + flare * smoothstep(0.35, 1.0, u) ** 1.6
                  + k["flick"] * (1 - back) * smoothstep(0.75, 1.0, u) ** 2 * (0.35 + 0.65 * tipness))
            kk += (comb + k["groove"] * (lock(a) - 1) * 0.8 * u) / max(h.length, 1e-3)
            z += k["flick_up"] * smoothstep(0.82, 1.0, u) ** 2 * tipness * (1 - back)
            o = Vector((h.x * kk, C.y + h.y * kk, z))
            # Thin, pointed ends: the shell tapers from the cap's thickness to a quarter.
            w = o - (top_o - top_i) * (1 - 0.75 * u ** 1.4)
            # Never deeper in the jaw below than the cap sits in the skull above.
            out = Vector((h.x, h.y, 0)).normalized()
            axis = Vector((0, C.y, z))
            hit = tree.ray_cast(axis, out, 1.0)
            if hit[0] is not None:
                clear = (hit[0] - axis).length - 0.004 - Vector((w.x, w.y - C.y, 0)).length
                if clear > 0:
                    o, w = o + out * clear, w + out * clear
            # Clear of the neck, easing in over the top of the neck; only the inner surface moves,
            # so the back stays inside the sleep contact and simply thins.
            ease = smoothstep(frame.neck_top + 0.04, frame.neck_top - 0.01, z)
            if ease > 0:
                probe = Vector((0, C.y, min(z, frame.neck_top - 0.005)))
                found = frame.neck.ray_cast(probe, out, 1.0)
                if found[0] is not None:
                    need = ((found[0] - probe).length + NECK_CLEARANCE) * ease
                    have = Vector((w.x, w.y - C.y, 0)).length
                    room = Vector((o.x, o.y - C.y, 0)).length - 0.004 - have
                    if need > have:
                        w = w + out * min(need - have, max(0.0, room))
            outer[j, cap_rows + i] = o
            inner[j, cap_rows + i] = w
        rows_of[j] = cap_rows + curtain_rows

    verts, index = [], {}

    def vid(key, co):
        if key not in index:
            index[key] = len(verts)
            verts.append(Vector(co))
        return index[key]

    crown_n, crown_d = skull(0, 0.0)
    ring = sum(((outer[j, 1] - C).length for j in range(columns))) / columns
    po = vid(("o", "pole"), C + crown_n * ring)
    pi = vid(("i", "pole"), C + crown_n * (crown_d - 0.004))
    outer_faces, inner_faces = [], []
    for j in range(columns):
        jn = (j + 1) % columns
        outer_faces.append((po, vid(("o", j, 1), outer[j, 1]), vid(("o", jn, 1), outer[jn, 1])))
        inner_faces.append((pi, vid(("i", jn, 1), inner[jn, 1]), vid(("i", j, 1), inner[j, 1])))
        for i in range(1, min(rows_of[j], rows_of[jn])):
            q = [("o", j, i), ("o", j, i + 1), ("o", jn, i + 1), ("o", jn, i)]
            outer_faces.append(tuple(vid(key, outer[key[1:]]) for key in q))
            q = [("i", j, i), ("i", jn, i), ("i", jn, i + 1), ("i", j, i + 1)]
            inner_faces.append(tuple(vid(key, inner[key[1:]]) for key in q))
    keys = {v: key for key, v in index.items()}
    directed = {(x, y) for f in outer_faces for x, y in zip(f, f[1:] + f[:1])}
    boundary = [(x, y) for x, y in directed if (y, x) not in directed]
    neighbours = defaultdict(set)
    for f in outer_faces:
        for x, y in zip(f, f[1:] + f[:1]):
            neighbours[x].add(y)
            neighbours[y].add(x)
    on_edge = {v for edge in boundary for v in edge}
    rim_faces, middle = [], {}
    for x, y in boundary:
        for v in (x, y):
            if v in middle:
                continue
            o = verts[v]
            i_ = verts[index[("i",) + keys[v][1:]]]
            inside = [verts[w] for w in neighbours[v] if w not in on_edge]
            away = (o - sum(inside, Vector()) / len(inside)) if inside else Vector()
            away -= (o - i_).normalized() * away.dot((o - i_).normalized())
            bulge = away.normalized() * (o - i_).length * 0.32 if away.length > 1e-9 else Vector()
            middle[v] = vid(("m",) + keys[v][1:], (o + i_) / 2 + bulge)
        ix, iy = index[("i",) + keys[x][1:]], index[("i",) + keys[y][1:]]
        rim_faces.append((y, x, middle[x], middle[y]))
        rim_faces.append((middle[y], middle[x], ix, iy))
    obj = mesh_object("reference framing hair", [tuple(v) for v in verts],
                      outer_faces + inner_faces + rim_faces, hair)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    back = max(v.co.y for v in obj.data.vertices)
    return obj, {"curtainFrontAzimuth": round(a_front, 4), "templeZ": round(temple_z, 4),
                 "backFlare": round(flare_back, 4), "rearmostY": round(back, 4),
                 "sleepBackY": target_back}


def thick_brows(frame, face_tree, hair):
    """Thick, dark, slightly arched brows on the forehead above each glasses ring."""
    k = BROWS[frame.style]
    R = frame.ring
    pieces = []
    for side, sign in (("L", -1), ("R", 1)):
        center = frame.eyes[side][0]
        depth = k["thick"] * k["depth"] * R
        knots, radii = [], []
        # Full through the inner two thirds, tapering to a rounded tail.
        for t, fullness in ((0.0, 0.62), (0.18, 0.98), (0.42, 1.0), (0.7, 0.86), (1.0, 0.42)):
            xr = k["inner"] + (k["outer"] - k["inner"]) * t
            zr = k["lift"] + k["arch"] * math.sin(math.pi * t) - k["tilt"] * (t - 0.5)
            x = center.x + sign * xr * R
            z = center.z + zr * R
            hit = face_tree.ray_cast(Vector((x, center.y - 1.0, z)), Vector((0, 1, 0)), 2.0)
            y = hit[0].y if hit[0] is not None else center.y
            knots.append((x, y + 0.18 * depth, z))
            radii.append(depth / 2 * fullness)
        if sign < 0:
            knots.reverse()
            radii.reverse()
        # swept_lock scales the vertical half-axis by width; depth is the other axis.
        pieces.append(swept_lock("thick dark brow " + side, knots, radii, hair,
                                 width=1 / k["depth"], sides=12))
    return pieces


def mouth_outline(k, center_z, samples=40):
    """The opening as a closed (x, z) outline seen from the front."""
    w, h, lift = k["width"], k["height"], k["lift"]
    asym = k.get("asym", 0.0)
    top, bottom = [], []
    for i in range(samples + 1):
        x = -w + 2 * w * i / samples
        r = x / w
        zt = center_z + h * 0.5 + lift * r * r * (1 + asym * r)
        depth = (1 - r * r) ** (0.55 if k["shape"] == "d" else 0.8)
        top.append((x, zt))
        bottom.append((x, zt - h * depth))
    return top, bottom


def mouth(frame, face, mats):
    """Cut the style's open mouth into the rebuilt face, with teeth and a tongue inside.

    Runs in authoring coordinates, like refine_human's original cavity. The cavity walls take
    the dark interior material from the cutter, so the opening reads as a clean shape.
    """
    k = MOUTH[frame.style]
    head_z, (hx, hy, hz) = frame.authoring
    center_z = head_z - k["drop"]
    tree = tree_of(face)

    def front(x, z):
        hit = tree.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)), 2.0)
        return (hit[0].y, hit[1]) if hit[0] is not None else (-hy, Vector((0, -1, 0)))

    top, bottom = mouth_outline(k, center_z)
    outline = top + list(reversed(bottom[1:-1]))
    y0 = min(front(x, z)[0] for x, z in outline) - 0.03
    depth = 0.075 if frame.style != "ghibli" else 0.05
    # A bowl: straight through the skin, narrowing toward the back of the cavity.
    rings = [[(x * scale, y0 + t * (depth + 0.03), center_z + (z - center_z) * scale) for x, z in outline]
             for t, scale in ((0.0, 1.0), (0.45, 1.0), (0.75, 0.82), (1.0, 0.55))]
    count = len(outline)
    verts = [v for ring in rings for v in ring]
    faces = [tuple(reversed(range(count)))]
    for r in range(len(rings) - 1):
        for i in range(count):
            a, b = r * count + i, r * count + (i + 1) % count
            faces.append((a, b, b + count, a + count))
    faces.append(tuple(range((len(rings) - 1) * count, len(rings) * count)))
    interior = mats["mouth"]
    cutter = mesh_object("expression cavity tool", verts, faces, interior, smooth=False)
    bm = bmesh.new()
    bm.from_mesh(cutter.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(cutter.data)
    bm.free()
    bpy.context.view_layer.objects.active = face
    cut = face.modifiers.new("open expression", "BOOLEAN")
    cut.operation, cut.object, cut.solver = "DIFFERENCE", cutter, "EXACT"
    cut.material_mode = "TRANSFER"
    bpy.ops.object.modifier_apply(modifier=cut.name)
    discard(cutter)
    pieces = []
    w, h = k["width"], k["height"]
    if k.get("teeth"):
        n = k["teeth"]
        span = 2 * w * k["teeth_span"]
        tooth_w = span / n
        for i in range(n):
            x = -span / 2 + tooth_w * (i + 0.5)
            r = x / w
            zt = center_z + h * 0.5 + k["lift"] * r * r * (1 + k.get("asym", 0.0) * r)
            th = h * k["teeth_drop"] * (1 - 0.25 * r * r)
            y_face, normal = front(x, zt - th * 0.5)
            bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
            tooth = bpy.context.object
            tooth.name = "open smile tooth"
            tooth.scale = (tooth_w * 0.9, 0.012, th)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            bevel = tooth.modifiers.new("rounded tooth", "BEVEL")
            bevel.width = min(tooth_w * 0.9, th) * (0.42 if k.get("scallop") else 0.22)
            bevel.segments = 3
            bpy.ops.object.modifier_apply(modifier=bevel.name)
            turn = math.atan2(normal.x, -normal.y) if normal.length > 0 else 0
            tooth.data.transform(Matrix.Translation((x, y_face + 0.010, zt - th * 0.5 + 0.004))
                                 @ Matrix.Rotation(turn, 4, "Z"))
            tooth.data.materials.append(mats["warm white"])
            for p in tooth.data.polygons:
                p.use_smooth = False
            pieces.append(tooth)
    if k.get("tongue"):
        zb = center_z + h * 0.5 - h
        y_face, _ = front(0, zb + h * 0.3)
        pieces.append(sphere("open smile tongue", (0, y_face + 0.022, zb + h * 0.30),
                             (w * 0.62, 0.030, h * 0.36), mats["tongue"], segments=28))
    return pieces


def install_likeness(arm, style):
    """Replace hair, brows, face skin and mouth on a retained source; returns measurements."""
    mesh = next(o for o in arm.children if o.type == "MESH" and o.name == "SiruiMesh")
    frame = HeadFrame(style, mesh, arm)
    owned = likeness_vertices(mesh, frame.eye_z)
    removed = {key: len(v) for key, v in owned.items()}
    remove_vertices(mesh, set().union(*owned.values()))
    mats = {m.name: m for m in bpy.data.materials}
    hair = mats["long black hair"]
    if HAIR[style].get("color"):
        recolor(hair, HAIR[style]["color"])
    mats["mouth"] = material("mouth", MOUTH[style]["color"], 0.6)
    recolor(mats["mouth"], MOUTH[style]["color"], 0.6)
    if MOUTH[style].get("tongue"):
        mats["tongue"] = material("tongue", MOUTH[style]["tongue"], 0.5)
        recolor(mats["tongue"], MOUTH[style]["tongue"], 0.5)
    head_z, head_scale = frame.authoring
    face = adult_face(style, head_z, head_scale, sphere, mats["skin"], frame.profile, frame.ear_out)
    inside = mouth(frame, face, mats)
    for obj in [face] + inside:
        transform(obj, frame.factor)
    face_tree = tree_of(face)
    brows = thick_brows(frame, face_tree, hair)
    shell, hair_report = framing_hair(frame, hair)
    # The sleep clip's head lift was solved from the old rearmost Head point; stay inside it.
    assert hair_report["rearmostY"] <= SLEEP_BACK_Y[style] + 0.0005, hair_report
    added = [face] + inside + brows + [shell]
    for obj in added:
        group = obj.vertex_groups.new(name="Head")
        group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    counts = {"face": len(face.data.vertices), "mouth": sum(len(o.data.vertices) for o in inside),
              "brows": sum(len(o.data.vertices) for o in brows), "hair": len(shell.data.vertices)}
    bpy.ops.object.select_all(action="DESELECT")
    for obj in added:
        obj.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.join()
    arm["likeness"] = "October 15 reference hair, brows and open expression"
    return {"avatar": style, "removedVertices": removed, "addedVertices": counts,
            "hair": hair_report, "meshVertices": len(mesh.data.vertices)}
