"""Detail and decoration for the inhabited rooms (Sirui, 2026-10-14).

River stones replace the onsen's faceted rim slabs, and the onsen gains a bamboo spout, a wooden
bucket and stool and a cedar slat panel. The bedroom gets a framed seascape, the study a pinboard
of sketches and the lounge a coiled-rope sun and a shelf of Sirui's kind of pottery. Every piece
is original code-authored mesh. Pieces are joined per room and material, so the browser draws a
handful of new meshes rather than dozens. House coordinates: +X north, +Y west (the sea), Z up.
"""

import math
import random
import bmesh
import bpy
from mathutils import Matrix, Vector, noise

POOL = {"center": Vector((3.17, -3.18)), "water": 3.0, "inner": 0.845, "outer": 1.085, "foundationTop": 2.88}
BACK_WALL_Y = -5.48


def material(name, color, roughness=0.6, metallic=0.0, refresh=False):
    existing = bpy.data.materials.get(name)
    if existing and not refresh:
        return existing
    m = existing or bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*color, 1)
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return m


def from_bmesh(name, bm, mat, smooth=True):
    data = bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = smooth
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return obj


def join(objects, name):
    """Join meshes that share one material into a single object."""
    objects = [o for o in objects if o]
    if not objects:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = joined.data.name = name
    return joined


def box(bm, center, size, rotation=None):
    m = Matrix.Translation(center) @ (rotation or Matrix.Identity(4)) @ Matrix.Diagonal((*size, 1))
    bmesh.ops.create_cube(bm, size=1, matrix=m)


def cylinder(bm, start, end, radius, segments=12, caps=True):
    axis = Vector(end) - Vector(start)
    rotation = axis.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
    m = Matrix.Translation((Vector(start) + Vector(end)) / 2) @ rotation
    bmesh.ops.create_cone(bm, cap_ends=caps, segments=segments, radius1=radius, radius2=radius, depth=axis.length, matrix=m)


def lathe(bm, profile, center, segments=32):
    """Revolve (radius, z) pairs about a vertical axis; the profile runs bottom to top."""
    rings = []
    for r, z in profile:
        rings.append([bm.verts.new((center[0] + r * math.cos(a), center[1] + r * math.sin(a), center[2] + z))
                      for a in (k * math.tau / segments for k in range(segments))])
    for lower, upper in zip(rings, rings[1:]):
        for k in range(segments):
            bm.faces.new((lower[k], lower[(k + 1) % segments], upper[(k + 1) % segments], upper[k]))
    bm.faces.new(list(reversed(rings[0])))


# Onsen ----------------------------------------------------------------------------------------

def remove_rim_slabs(stone_object):
    """Delete the 22 carved slab islands from the batched onsen stone, keeping the foundation."""
    to_world = stone_object.matrix_world.copy()
    bm = bmesh.new()
    bm.from_mesh(stone_object.data)
    bm.verts.ensure_lookup_table()
    seen, doomed = set(), []
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
        middle = sum((to_world @ v.co for v in island), Vector()) / len(island)
        if 0.75 < (middle.xy - POOL["center"]).length < 1.25 and middle.z > POOL["foundationTop"] - 0.05:
            doomed.extend(island)
    count = len({v.index for v in doomed})
    bmesh.ops.delete(bm, geom=list(set(doomed)), context="VERTS")
    bm.to_mesh(stone_object.data)
    bm.free()
    stone_object.data.update()
    return count


def river_stones(mat, count=24, seed=14):
    """Rounded, water-worn stones bedded edge to edge around the pool: flattened tops to sit on,
    each a little different in length, width, height and lean, overlapping so the waterline
    never shows a gap."""
    rng = random.Random(seed)
    bm = bmesh.new()
    ring = (POOL["inner"] + POOL["outer"]) / 2
    for i in range(count):
        theta = (i + rng.uniform(-0.12, 0.12)) * math.tau / count
        length = math.tau * ring / count * rng.uniform(1.3, 1.5)
        width = rng.uniform(0.25, 0.3)
        height = rng.uniform(0.26, 0.33)
        top = POOL["water"] + rng.uniform(0.055, 0.11)
        offset = Vector((rng.uniform(-50, 50), rng.uniform(-50, 50), rng.uniform(-50, 50)))
        made = bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
        lean = Matrix.Rotation(rng.uniform(-0.12, 0.12), 3, "X") @ Matrix.Rotation(rng.uniform(-0.1, 0.1), 3, "Y")
        turn = Matrix.Rotation(theta + math.pi / 2, 3, "Z")
        middle = Vector((POOL["center"].x + ring * math.cos(theta), POOL["center"].y + ring * math.sin(theta), 0))
        for v in made["verts"]:
            p = v.co.copy()
            # Two octaves of noise make a boulder rather than an egg.
            p *= 1 + 0.13 * noise.noise(p * 1.1 + offset) + 0.04 * noise.noise(p * 3.3 + offset)
            p = Vector((p.x * length / 2, p.y * width / 2, p.z * height / 2))
            shoulder = 0.3 * height / 2
            if p.z > shoulder:
                p.z = shoulder + (p.z - shoulder) * 0.42
            p = turn @ (lean @ p)
            v.co = middle + p
        crest = max(v.co.z for v in made["verts"])
        for v in made["verts"]:
            v.co.z += top - crest
    return from_bmesh("onsen_river_stones", bm, mat)


def slat_panel(mat, x0, x1, z0, z1, slat=0.045, gap=0.022, depth=0.028):
    """Vertical cedar slats on two rails, standing just off the back wall."""
    bm = bmesh.new()
    y = BACK_WALL_Y + 0.025
    for z in (z0 + 0.18, z1 - 0.18):
        box(bm, Vector(((x0 + x1) / 2, y + 0.01, z)), (x1 - x0 - 0.06, 0.02, 0.05))
    x = x0
    while x + slat <= x1 + 1e-6:
        box(bm, Vector((x + slat / 2, y + 0.02 + depth / 2, (z0 + z1) / 2)), (slat, depth, z1 - z0))
        x += slat + gap
    return from_bmesh("onsen_cedar_panel", bm, mat, smooth=False)


def bucket_and_stool(wood, brass, at=(4.58, -2.98), stool_at=(4.55, -2.62)):
    """A wooden washing bucket (oke) with two brass hoops, and a low bath stool."""
    floor = 2.6
    wood_bm, brass_bm = bmesh.new(), bmesh.new()
    cx, cy = at
    outside = [(0.115, 0.0), (0.12, 0.012), (0.13, 0.19), (0.13, 0.2)]
    inside = [(0.118, 0.2), (0.118, 0.19), (0.11, 0.03)]
    lathe(wood_bm, outside + inside, (cx, cy, floor), segments=28)
    for z in (0.05, 0.16):
        bmesh.ops.create_cone(brass_bm, cap_ends=False, segments=28, radius1=0.124 + z * 0.045, radius2=0.124 + z * 0.045 + 0.001,
                              depth=0.014, matrix=Matrix.Translation((cx, cy, floor + z)))
    sx, sy = stool_at
    box(wood_bm, Vector((sx, sy, floor + 0.205)), (0.34, 0.2, 0.03))
    for dx in (-0.13, 0.13):
        box(wood_bm, Vector((sx + dx, sy, floor + 0.095)), (0.03, 0.18, 0.19))
    return [from_bmesh("onsen_bucket_stool", wood_bm, wood), from_bmesh("onsen_bucket_hoops", brass_bm, brass)]


def bamboo_spout(bamboo, post=(4.62, -4.42), end=(3.72, -3.62)):
    """A kakei: a bamboo pipe resting in a forked bamboo post, its open end over the water."""
    floor = 2.6
    bm = bmesh.new()
    px, py = post
    cylinder(bm, (px, py, floor), (px, py, floor + 0.7), 0.028, segments=12)
    for side in (-1, 1):
        cylinder(bm, (px, py, floor + 0.68), (px + side * 0.05, py - side * 0.05, floor + 0.8), 0.014, segments=8)
    start = Vector((px + 0.16, py - 0.16, floor + 0.74))
    tip = Vector((end[0], end[1], floor + 0.68))
    cylinder(bm, start, tip, 0.024, segments=14)
    span = tip - start
    # Nodes: the bamboo's rings every 30 cm.
    for k in range(1, int(span.length / 0.3) + 1):
        point = start + span * (k * 0.3 / span.length)
        cylinder(bm, point - span.normalized() * 0.008, point + span.normalized() * 0.008, 0.027, segments=14)
    for k in (1, 2):
        point = Vector((px, py, floor + k * 0.24))
        cylinder(bm, point - Vector((0, 0, 0.008)), point + Vector((0, 0, 0.008)), 0.031, segments=12)
    return from_bmesh("onsen_bamboo_spout", bm, bamboo)


# Walls ----------------------------------------------------------------------------------------

def framed_seascape(prefix, center, size, frame_mat, paints):
    """A small painting of the coast seen from the house: sky, a band of sea, the beach and the
    sun low over the water, in an oak frame on the back wall."""
    cx, cz = center
    w, h = size
    y = BACK_WALL_Y + 0.012
    frame = bmesh.new()
    t, d = 0.045, 0.035
    for dx, dz, sw, sh in ((0, h / 2 - t / 2, w, t), (0, -h / 2 + t / 2, w, t), (-w / 2 + t / 2, 0, t, h), (w / 2 - t / 2, 0, t, h)):
        box(frame, Vector((cx + dx, y + d / 2, cz + dz)), (sw, d, sh))
    pieces = [from_bmesh(prefix + "_frame", frame, frame_mat, smooth=False)]
    inner_w, inner_h = w - 2 * t, h - 2 * t
    bands = (("sky", 0.52, 1.0), ("sea", 0.24, 0.52), ("sand", 0.0, 0.24))
    for key, lo, hi in bands:
        bm = bmesh.new()
        box(bm, Vector((cx, y + 0.012, cz - inner_h / 2 + inner_h * (lo + hi) / 2)), (inner_w, 0.008, inner_h * (hi - lo)))
        pieces.append(from_bmesh(f"{prefix}_{key}", bm, paints[key], smooth=False))
    sun = bmesh.new()
    sun_center = (cx + inner_w * 0.18, cz - inner_h / 2 + inner_h * 0.66)
    bmesh.ops.create_circle(sun, cap_ends=True, segments=32, radius=inner_h * 0.1,
                            matrix=Matrix.Translation((sun_center[0], y + 0.0175, sun_center[1])) @ Matrix.Rotation(math.pi / 2, 4, "X"))
    pieces.append(from_bmesh(prefix + "_sun", sun, paints["sun"], smooth=False))
    return pieces


def pinboard(prefix, center, size, cork, frame_mat, paper, pin_mat, seed=5):
    """A cork board of pinned sketches and notes above the desk."""
    rng = random.Random(seed)
    cx, cz = center
    w, h = size
    y = BACK_WALL_Y + 0.01
    board, frame, cards, pins = bmesh.new(), bmesh.new(), bmesh.new(), bmesh.new()
    box(board, Vector((cx, y + 0.01, cz)), (w, 0.02, h))
    t = 0.03
    for dx, dz, sw, sh in ((0, h / 2, w + t, t), (0, -h / 2, w + t, t), (-w / 2, 0, t, h), (w / 2, 0, t, h)):
        box(frame, Vector((cx + dx, y + 0.017, cz + dz)), (sw, 0.034, sh))
    slots = [(-0.33, 0.14, 0.2, 0.15), (-0.08, 0.16, 0.16, 0.2), (0.17, 0.13, 0.22, 0.16), (0.34, -0.1, 0.14, 0.18),
             (-0.3, -0.12, 0.18, 0.13), (-0.05, -0.1, 0.22, 0.16), (0.16, -0.12, 0.12, 0.12)]
    for dx, dz, cw, ch in slots:
        tilt = Matrix.Rotation(rng.uniform(-0.09, 0.09), 4, "Y")
        position = Vector((cx + dx * w, y + 0.0215, cz + dz * h * 1.4))
        box(cards, position, (cw, 0.003, ch), rotation=tilt)
        bmesh.ops.create_uvsphere(pins, u_segments=8, v_segments=5, radius=0.009,
                                  matrix=Matrix.Translation(position + Vector((0, 0.005, ch / 2 - 0.02))))
    return [from_bmesh(prefix + "_board", board, cork, smooth=False), from_bmesh(prefix + "_board_frame", frame, frame_mat, smooth=False),
            from_bmesh(prefix + "_cards", cards, paper, smooth=False), from_bmesh(prefix + "_pins", pins, pin_mat)]


def rope_sun(prefix, center, radius, jute, accent, wall_x=5.2):
    """A coiled-rope wall hanging: a corrugated disc of jute with a terracotta centre, facing the
    room from the north cave wall."""
    cy, cz = center
    rings, segments = 26, 72
    jute_bm, accent_bm = bmesh.new(), bmesh.new()
    inner_radius = radius * 0.3
    def ring_vertex(bm, r, a, bump):
        return bm.verts.new((wall_x - 0.03 - bump, cy + r * math.cos(a), cz + r * math.sin(a)))
    for bm, r0, r1, count in ((accent_bm, 0.0, inner_radius, 6), (jute_bm, inner_radius, radius, rings)):
        previous = None
        for k in range(count + 1):
            r = r0 + (r1 - r0) * k / count
            bump = 0.012 * abs(math.sin(math.pi * k * 0.5)) + 0.004
            row = [ring_vertex(bm, max(r, 1e-4), j * math.tau / segments, bump) for j in range(segments)]
            if previous:
                for j in range(segments):
                    bm.faces.new((previous[j], previous[(j + 1) % segments], row[(j + 1) % segments], row[j]))
            previous = row
    return [from_bmesh(prefix + "_rope", jute_bm, jute), from_bmesh(prefix + "_centre", accent_bm, accent)]


def pottery_shelf(prefix, center, shelf_mat, glazes, wall_x=5.2):
    """A slim oak shelf on the north wall with three thrown pots: a tall bottle, a wide bowl-vase
    and a small jar, each a lathe profile with a real opening."""
    cy, cz = center
    shelf = bmesh.new()
    box(shelf, Vector((wall_x - 0.11, cy, cz)), (0.2, 0.78, 0.03))
    for dy in (-0.3, 0.3):
        box(shelf, Vector((wall_x - 0.03, cy + dy, cz - 0.06)), (0.04, 0.03, 0.1))
    pieces = [from_bmesh(prefix + "_shelf", shelf, shelf_mat, smooth=False)]
    profiles = (
        [(0.045, 0), (0.07, 0.04), (0.075, 0.12), (0.05, 0.2), (0.022, 0.25), (0.024, 0.29), (0.018, 0.29), (0.016, 0.24), (0.04, 0.19), (0.06, 0.06)],
        [(0.05, 0), (0.1, 0.05), (0.11, 0.1), (0.085, 0.15), (0.08, 0.16), (0.072, 0.155), (0.095, 0.1), (0.075, 0.04)],
        [(0.035, 0), (0.055, 0.03), (0.058, 0.08), (0.04, 0.11), (0.042, 0.12), (0.034, 0.12), (0.032, 0.1), (0.045, 0.05)],
    )
    for (dy, glaze), profile in zip(((-0.24, glazes[0]), (0.02, glazes[1]), (0.25, glazes[2])), profiles):
        bm = bmesh.new()
        lathe(bm, profile, (wall_x - 0.11, cy + dy, cz + 0.015), segments=28)
        pieces.append(from_bmesh(f"{prefix}_pot{len(pieces)}", bm, glaze))
    return pieces
