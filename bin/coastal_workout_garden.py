"""Open the built gym onto its lawn and cut the ocean baths into the north bluff.

Run in Blender 4.5 on the November 19 indoor gym master (1ee67deeb).
Use --save-as=PATH for the native copy, then bake its new and moved surfaces
with bake_coastal_light.py. On the baked copy, --restore-rock-from=PATH
restores distant rock colours from the pre-bake garden. Export home-shell with
optimize_coastal_exports.py --active-geology-ao --draco-level=10.
Coordinates are in metres, +Y towards the sea. The pocket-door leaves stack at
the south jamb of the existing arch. The perimeter guard follows the new edge.
"""

import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import coastal_decor as decor
from coastal_garden_refuge import blob, box, leaf
from coastal_facade import leaf_quad
from coastal_gym import arch_profile, extrusion, slab, vault_height
from coastal_shell import boolean
from coastal_onsen_noren import install_onsen_noren
from coastal_study_loggia import relocate_pavilion

PREFIX = "core_workout_garden_"
LIME = "honed travertine"
ASH = "pale oak"
BRONZE = "dark bronze"
GLASS = "facade low-iron glass"
BASALT = "garden flamed basalt"
CEDAR = "spa oiled cedar wood"
LAWN = "coastal bentgrass turf"
PAPER = "spa opal lamp"
HOT = "spring bath water"
SEDGE = "coastal sedge leaf"
SAGE = "salt meadow leaf"
RNG = random.Random(191126)


class Finishes:
    """Batch static details by use and finish. A water surface gets its own collider."""

    def __init__(self):
        self.parts = {}

    def mesh(self, piece, finish):
        if (piece, finish) not in self.parts:
            self.parts[piece, finish] = bmesh.new()
        return self.parts[piece, finish]

    def box(self, piece, finish, lo, hi, bevel=0):
        box(self.mesh(piece, finish), lo, hi, bevel, segments=1)

    def finish(self):
        for (piece, finish), bm in self.parts.items():
            obj = decor.from_bmesh(PREFIX + piece + "__" + finish, bm, bpy.data.materials[finish], smooth=False)
            light_receiver(obj, piece)
            if piece in ("sedge", "river_stones", "olive_crown", "fall_sheet", "mat"):
                obj["walk"] = "through"
            if piece in ("river_stones", "olive_boughs", "sedge"):
                for polygon in obj.data.polygons:
                    polygon.use_smooth = True
            if piece == "soaking_surface":
                obj["walk"] = "water"
            if finish == LAWN:
                uv = obj.data.uv_layers.new(name="Turf grain")
                for corner in obj.data.loops:
                    p = obj.data.vertices[corner.vertex_index].co
                    uv.data[corner.index].uv = (p.x / 0.70, p.y / 0.70)


def light_receiver(obj, piece):
    obj["installationGroup"] = "ocean-baths" if piece.startswith(("bath_", "cold_", "ofuro", "filler", "soaking_")) else "exterior"
    if piece == "bath_lights":
        obj["installationGlow"] = "ocean-bath-lamps"


def finishes():
    decor.material(BASALT, (0.118, 0.133, 0.127), 0.87)
    decor.material(CEDAR, (0.40, 0.222, 0.109), 0.58)
    decor.material(SEDGE, (0.205, 0.286, 0.105), 0.82)
    decor.material(SAGE, (0.126, 0.218, 0.154), 0.75)
    decor.material(HOT, (0.16, 0.39, 0.32), 0.15)
    collecting = decor.material("garden collecting water", (0.092, 0.139, 0.129), 0.16)
    collecting.node_tree.nodes["Principled BSDF"].inputs["Transmission Weight"].default_value = 0.76
    fall = decor.material("garden falling water", (0.175, 0.285, 0.262), 0.09)
    fall_bsdf = fall.node_tree.nodes.get("Principled BSDF")
    fall_bsdf.inputs["Transmission Weight"].default_value = 0.71
    fall_bsdf.inputs["Alpha"].default_value = 0.69
    fall.surface_render_method = "DITHERED"
    decor.material("garden river gravel", (0.31, 0.314, 0.257), 0.93)
    decor.material("garden cork", (0.46, 0.285, 0.144), 0.94)
    decor.material("garden cork selvedge", (0.248, 0.207, 0.142), 0.88)
    decor.material("garden bath basalt", (0.11, 0.204, 0.18), 0.72)
    decor.material("chalk limestone", (0.72, 0.68, 0.57))
    lamp = decor.material(PAPER, (0.85, 0.72, 0.47), 0.62)
    bsdf = lamp.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Emission Color"].default_value = (0.94, 0.62, 0.32, 1)
    bsdf.inputs["Emission Strength"].default_value = 0.52
    turf = decor.material(LAWN, (0.28, 0.39, 0.18), 0.97)
    nodes = turf.node_tree.nodes
    if any(node.type == "TEX_IMAGE" for node in nodes):
        return
    # A small tile of clipped blades and low-frequency variation. Absolute lawn
    # UVs retain the same scale on both the flat turf and its curved edge.
    size = 56
    rng = np.random.default_rng(1947)
    yy, xx = np.mgrid[:size, :size]
    t = 2 * np.pi / size
    grain = (
        0.92
        + 0.012 * np.sin((2 * xx + yy) * t)
        + 0.010 * np.sin((xx - 3 * yy) * t)
        + rng.normal(0, 0.035, (size, size))
    )
    for _ in range(size * size // 20):
        x, y = rng.integers(0, size, 2)
        direction = int(rng.integers(-1, 2))
        value = rng.uniform(0.83, 1.065)
        for i in range(int(rng.integers(2, 6))):
            grain[(y + i) % size, (x + round(0.5 * direction * i)) % size] = value
    pixels = np.ones((size, size, 4), dtype=np.float32)
    pixels[:, :, :3] = grain[:, :, None] * np.array([0.395, 0.49, 0.287])
    image = bpy.data.images.new("Clipped coastal turf", width=size, height=size, alpha=False)
    image.colorspace_settings.name = "sRGB"
    image.pixels.foreach_set(pixels.ravel())
    image.pack()
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    turf.node_tree.links.new(tex.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])


def remove_islands(obj, condition):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    remaining = set(bm.verts)
    remove = []
    while remaining:
        seed = remaining.pop()
        group, stack = [seed], [seed]
        while stack:
            v = stack.pop()
            for edge in v.link_edges:
                other = edge.other_vert(v)
                if other in remaining:
                    remaining.remove(other)
                    stack.append(other)
                    group.append(other)
        points = [obj.matrix_world @ vertex.co for vertex in group]
        lo = [min(p[i] for p in points) for i in range(3)]
        hi = [max(p[i] for p in points) for i in range(3)]
        if condition(lo, hi):
            remove.extend(group)
    if remove:
        bmesh.ops.delete(bm, geom=remove, context="VERTS")
        bm.to_mesh(obj.data)
        obj.data.update()
    bm.free()
    return len(remove)


def open_arch(parts):
    # Sweep a continuous reveal. The previous head assembled 48 individually
    # bevelled blocks with concealed end caps where each pair met.
    frame = bpy.data.objects["core_gym_front_frame"]
    old = bpy.data.objects.get("core_gym_front_glass")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    start = Vector((6, -5.2, 0))
    end = Vector((11, -1.50, 0))
    along = (end - start).normalized()
    normal = Vector((-along.y, along.x, 0))
    theta = math.atan2(along.y, along.x)
    head = bmesh.new()
    sections = []
    for k in range(49):
        point = start.lerp(end, k / 48)
        z = vault_height(point.x) - 0.040
        sections.append(
            [
                head.verts.new(frame.matrix_world.inverted() @ (point + normal * d + Vector((0, 0, z + h))))
                for d, h in [
                    (-0.045, -0.021),
                    (-0.037, -0.030),
                    (0.037, -0.030),
                    (0.045, -0.021),
                    (0.045, 0.030),
                    (-0.045, 0.030),
                ]
            ]
        )
    for a, b in zip(sections, sections[1:]):
        for i in range(len(a)):
            j = (i + 1) % len(a)
            head.faces.new((a[i], a[j], b[j], b[i]))
    head.faces.new(list(reversed(sections[0])))
    head.faces.new(sections[-1])
    bmesh.ops.recalc_face_normals(head, faces=list(head.faces))
    head.to_mesh(frame.data)
    head.free()
    frame.data.update()

    def rail(center, size):
        decor.box(parts.mesh("retracting_frames", BRONZE), center, size, Matrix.Rotation(theta, 4, "Z"))

    for offset in (-0.045, 0.045):
        rail((start + end) / 2 + normal * offset + Vector((0, 0, 0.001)), ((end - start).length, 0.012, 0.012))
    # Four glass leaves fold perpendicular to the facade under the south return.
    for k in range(4):
        foot = start + along * (0.09 + k * 0.067) + normal * 0.02
        tip = foot + Vector((0.10, 1.04, 0))
        bottom, top = 0.029, 2.51 - k * 0.007
        bm = parts.mesh("parked_glazing", GLASS)
        corners = [
            foot + Vector((0, 0, bottom)),
            tip + Vector((0, 0, bottom)),
            tip + Vector((0, 0, top)),
            foot + Vector((0, 0, top)),
        ]
        bm.faces.new([bm.verts.new(v) for v in corners])
        for a, b in zip(corners, corners[1:] + corners[:1]):
            decor.cylinder(parts.mesh("retracting_frames", BRONZE), a, b, 0.013, 6)


def near_cut(points):
    lo, hi = (10.40, 2.06, -0.185), (14.90, 11, 2.90)
    return all(
        max(p[i] for p in points) >= lo[i] - 0.001 and min(p[i] for p in points) <= hi[i] + 0.001 for i in range(3)
    )


def carve_north_room():
    """Splice the local Boolean faces back into the original rock.

    Blender Exact can retriangulate coplanar ports on the far side of the
    headland. Source face IDs keep every polygon outside the cut on its
    original vertices, with its UV, material and baked corner data.
    """
    scene = bpy.context.scene
    if scene.get("workoutGardenBathCut"):
        return
    rock = bpy.data.objects["core__golden coastal sandstone"]
    trial = rock.copy()
    trial.data = rock.data.copy()
    bpy.context.collection.objects.link(trial)
    ids = trial.data.attributes.new("garden_source_face", "INT", "FACE")
    ids.data.foreach_set("value", np.arange(1, len(ids.data) + 1, dtype=np.int32))
    source = bmesh.new()
    source.from_mesh(rock.data)
    source.faces.ensure_lookup_table()
    positions = [rock.matrix_world @ v.co for v in rock.data.vertices]
    local = {f.index for f in rock.data.polygons if near_cut([positions[i] for i in f.vertices])}
    cutter = extrusion(
        "ocean bath excavation",
        arch_profile(10.40, 14.90, -0.185, 2.28, 2.90, 12),
        "y",
        2.06,
        11,
        bpy.data.materials["golden coastal sandstone"],
    )
    boolean(trial, cutter, "DIFFERENCE")
    bpy.data.objects.remove(cutter, do_unlink=True)
    evaluated = bmesh.new()
    evaluated.from_mesh(trial.data)
    source_id = evaluated.faces.layers.int["garden_source_face"]
    keep = [
        f
        for f in evaluated.faces
        if f[source_id] - 1 in local
        or (f[source_id] == 0 and near_cut([trial.matrix_world @ v.co for v in f.verts]))
    ]
    if not any(f[source_id] == 0 for f in keep):
        raise RuntimeError("Excavation produced no new stone reveals")
    local_faces = [source.faces[i] for i in local]
    verts = {v for f in local_faces for v in f.verts}

    def key(v):
        return tuple(round(a, 6) for a in v.co)

    points = {key(v): v for v in verts}
    bmesh.ops.delete(source, geom=local_faces, context="FACES_ONLY")
    for f in keep:
        loop = []
        for v in f.verts:
            pos = key(v)
            if pos not in points:
                points[pos] = source.verts.new(v.co)
            loop.append(points[pos])
        if len(set(loop)) != len(loop) or source.faces.get(loop):
            continue
        face = source.faces.new(loop)
        face.material_index = rock.data.materials.find(trial.data.materials[f.material_index].name)
        face.smooth = f.smooth
        for a, b in zip(face.loops, f.loops):
            a.copy_from(b)
    dead = [v for v in points.values() if v.is_valid and not v.link_faces]
    bmesh.ops.delete(source, geom=dead, context="VERTS")
    for edge in list(source.edges):
        if not edge.link_faces:
            source.edges.remove(edge)
    source.to_mesh(rock.data)
    source.free()
    evaluated.free()
    scratch = trial.data
    bpy.data.objects.remove(trial, do_unlink=True)
    bpy.data.meshes.remove(scratch)
    rock.data.update()
    scene["workoutGardenBathCut"] = True


def curve(a, b, c, d, steps=7):
    result = []
    for i in range(1, steps + 1):
        t = i / steps
        result.append(
            tuple(
                (1 - t) ** 3 * a[k] + 3 * (1 - t) ** 2 * t * b[k] + 3 * (1 - t) * t * t * c[k] + t**3 * d[k]
                for k in range(2)
            )
        )
    return result


def pave(parts):
    # The furnished pool court ended at x8. The new level apron continues from
    # its dry side into the bluff, landing on the surveyed rock at z=-.26.
    slab(
        parts.mesh("rock_apron", LIME),
        [
            (7.95, -2.90),
            (10.80, -1.19),
            (11.04, 0.70),
            (11.04, 2.16),
            (14.80, 2.16),
            (14.80, 7.30),
            (12.34, 7.30),
            (10.18, 5.62),
            (8.03, 4.79),
            (7.95, 4.78),
        ],
        -0.285,
        0.012,
    )
    # Scribe the narrow gap between the gym ledge and the old terrace.
    slab(
        parts.mesh("threshold", LIME),
        [(6.15, -5.01), (10.91, -1.48), (10.89, -0.46), (8.00, -1.40), (7.95, -2.80), (6.15, -3.12)],
        -0.20,
        0.006,
    )
    # The soft corners leave a paved strip to the pool ladder and the cliff guard.
    outline = [(3.69, -0.90), (3.69, 3.84)]
    outline += curve(outline[-1], (3.69, 4.24), (3.72, 4.38), (4.14, 4.38))
    outline += [(7.53, 4.38)]
    outline += curve(outline[-1], (8.60, 4.38), (9.93, 4.48), (9.93, 3.18))
    outline += [(9.93, 1.03)]
    outline += curve(outline[-1], (9.93, -0.64), (9.31, -1.58), (8.31, -1.82))
    outline += curve(outline[-1], (6.95, -2.09), (5.75, -1.18), (4.04, -1.18))
    outline += curve(outline[-1], (3.83, -1.18), (3.69, -1.08), (3.69, -0.90))[:-1]
    slab(parts.mesh("lawn", LAWN), list(reversed(outline)), 0.0005, 0.043)
    x, y = 5.15, 1.55
    bands = [
        (0, 0.074, "garden cork"),
        (0.074, 0.087, "garden cork selvedge"),
        (0.087, 1.73, "garden cork"),
        (1.73, 1.743, "garden cork selvedge"),
        (1.743, 1.82, "garden cork"),
    ]
    for front, back, finish in bands:
        parts.box("mat", finish, (x, y + front, 0.044), (x + 0.67, y + back, 0.052), 0.001)
    decor.cylinder(parts.mesh("mat", "garden cork"), (x, y + 1.84, 0.105), (x + 0.67, y + 1.84, 0.105), 0.056, 14)


def plant(parts):
    # Three uneven groups leave long views through to the horizon.
    beds = [((6.22, -2.45), (0.98, 0.35)), ((9.91, -0.82), (0.41, 0.72)), ((9.65, 4.48), (0.78, 0.27))]
    for (x, y), (rx, ry) in beds:
        ring = [(x + rx * math.cos(math.tau * i / 16), y + ry * math.sin(math.tau * i / 16)) for i in range(16)]
        slab(parts.mesh("gravel_beds", "garden river gravel"), ring, 0.012, 0.048)
        for i in range(6):
            a = RNG.uniform(0, math.tau)
            length = RNG.uniform(0.14, 0.33)
            width = length * RNG.uniform(0.48, 0.79)
            height = length * RNG.uniform(0.26, 0.53)
            blob(
                parts.mesh("river_stones", BASALT),
                (x + rx * 0.73 * math.cos(a), y + ry * 0.65 * math.sin(a), 0.044 + height * 0.81),
                (length, width, height),
                RNG,
                subdivisions=1,
            )
        for j in range(7):
            a = RNG.random() * math.tau
            root = (x + rx * 0.70 * math.cos(a), y + ry * 0.58 * math.sin(a), 0.05)
            for k in range(6):
                leaf(
                    parts.mesh("sedge", SAGE if (j + k) % 4 == 0 else SEDGE),
                    root,
                    a + k * math.tau / 6,
                    RNG.uniform(0.23, 0.51),
                    RNG.uniform(0.013, 0.028),
                    RNG.uniform(45, 81),
                    RNG.uniform(55, 96),
                    stations=3,
                )
    # One windswept olive grows in the pool-side corner. The long, open
    # centre of the lawn can take two mats laid parallel to the ocean.
    x, y = 4.05, -1.53
    island = [(x + 0.64 * math.cos(i * math.tau / 16), y + 0.37 * math.sin(i * math.tau / 16)) for i in range(16)]
    slab(parts.mesh("gravel_beds", "garden river gravel"), island, 0.005, 0.036)
    bark = parts.mesh("olive_boughs", decor.material("olive bark", (0.25, 0.204, 0.154), 0.87).name)
    leaves = parts.mesh("olive_crown", "olive leaf")
    trunk = [
        (x, y, 0.039),
        (x - 0.025, y + 0.012, 0.34),
        (x + 0.082, y - 0.048, 0.79),
        (x + 0.052, y - 0.012, 1.02),
    ]
    for i, (a, b) in enumerate(zip(trunk, trunk[1:])):
        decor.cylinder(bark, a, b, 0.044 - i * 0.006, 8)
    for j in range(7):
        a = RNG.uniform(0, math.tau)
        root = Vector(trunk[2 if j < 3 else 3])
        elbow = root + Vector((0.26 * math.cos(a), 0.20 * math.sin(a), RNG.uniform(0.16, 0.31)))
        tip = elbow + Vector((0.26 * math.cos(a) - 0.10, 0.30 * math.sin(a), RNG.uniform(0.02, 0.31)))
        decor.cylinder(bark, root, elbow, 0.024, 7)
        decor.cylinder(bark, elbow, tip, 0.014, 6)
        for k in range(8):
            twig = tip + Vector((RNG.uniform(-0.22, 0.22), RNG.uniform(-0.17, 0.17), RNG.uniform(-0.06, 0.20)))
            decor.cylinder(bark, tip, twig, 0.0034, 4)
            for n in range(6):
                start = tip.lerp(twig, 0.24 + 0.152 * n)
                leaf_quad(leaves, start, RNG, 0.111, 0.018, base=True)


def cascade(parts):
    x, y = 10.66, -0.34
    # A low, wall-fed sheet spills sideways into an elongated basalt trough.
    # Its top is lower than the eye of either seated athlete.
    parts.box("rill", BASALT, (x, y - 0.79, 0.02), (x + 0.28, y + 0.90, 0.38), 0.032)
    parts.box("rill", BASALT, (x + 0.019, y - 0.66, 0.379), (x + 0.30, y + 0.70, 0.64), 0.028)
    parts.box("rill", BASALT, (x + 0.033, y - 0.39, 0.638), (x + 0.31, y + 0.61, 0.75), 0.020)
    parts.box("rill", BASALT, (x - 0.41, y - 0.88, 0.018), (x + 0.22, y + 0.94, 0.105), 0.018)
    parts.box("rill", "garden collecting water", (x - 0.37, y - 0.82, 0.107), (x + 0.03, y + 0.88, 0.112))
    parts.box("spout", BRONZE, (x - 0.13, y - 0.32, 0.604), (x + 0.04, y + 0.35, 0.632), 0.006)
    bm = parts.mesh("fall_sheet", "garden falling water")
    rows = []
    for i in range(23):
        f = i / 22
        yp = y - 0.306 + f * 0.646
        flutter = 0.008 * math.sin(f * math.tau * 6) + 0.004 * math.sin(f * math.tau * 11)
        rows.append(
            [
                bm.verts.new((x + xx + flutter * d, yp, z))
                for xx, z, d in [
                    (-0.116, 0.618, 0),
                    (-0.139, 0.600, 0.2),
                    (-0.161, 0.514, 0.6),
                    (-0.174, 0.304, 1),
                    (-0.19, 0.115, 1.3),
                ]
            ]
        )
    for a, b in zip(rows, rows[1:]):
        for i in range(4):
            bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))


def guard(parts):
    for name in ("core_estate_terrace__brushed brass", "core_estate_guard__facade low-iron glass"):
        obj = bpy.data.objects.get(name)
        if obj:
            remove_islands(obj, lambda lo, hi: lo[0] > 7.74 and hi[0] < 8.02 and lo[1] < 4.62)
    points = [
        (7.91, 4.69),
        (9.03, 5.13),
        (10.14, 5.57),
        (11.14, 6.36),
        (12.34, 7.24),
        (13.58, 7.24),
        (14.82, 7.24),
    ]
    for a, b in zip(points, points[1:]):
        mid = Vector(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0))
        along = (Vector(b) - Vector(a)).normalized()
        length = (Vector(b) - Vector(a)).length
        e = Vector((along.x, along.y, 0)) * (length / 2 - 0.012)
        bm = parts.mesh("sea_parapet", GLASS)
        bm.faces.new(
            [
                bm.verts.new(mid + e * s + Vector((0, 0, z)))
                for s, z in [(-1, 0.047), (1, 0.047), (1, 1.087), (-1, 1.087)]
            ]
        )
        decor.cylinder(parts.mesh("cap_rail", BRONZE), (*a, 1.105), (*b, 1.105), 0.014, 8)
        for t in (0.21, 0.79):
            p = mid + e * (t * 2 - 1)
            parts.box("rail_shoes", BRONZE, (p.x - 0.041, p.y - 0.026, 0.013), (p.x + 0.041, p.y + 0.026, 0.113))


def ellipse(parts, piece, finish, x, y, rings, segments=40):
    """A continuous turned profile (rx, ry, height) with an open centre."""
    bm = parts.mesh(piece, finish)
    bands = [
        [
            bm.verts.new(
                (x + rx * math.cos(k * math.tau / segments), y + ry * math.sin(k * math.tau / segments), z)
            )
            for k in range(segments)
        ]
        for rx, ry, z in rings
    ]
    for a, b in zip(bands, bands[1:]):
        for k in range(segments):
            n = (k + 1) % segments
            bm.faces.new((a[k], a[n], b[n], b[k]))


def baths(parts):
    cx, cy = 11.72, 5.59
    # A continuous rolled cedar lip, a submerged stone seat and two bronze hoops.
    ellipse(
        parts,
        "ofuro",
        CEDAR,
        cx,
        cy,
        [(0.92, 1.07, 0.57), (0.915, 1.065, 0.597), (0.846, 0.996, 0.600), (0.827, 0.977, 0.574)],
    )
    stave = parts.mesh("ofuro_staves", CEDAR)
    for i in range(40):
        a, b = math.tau * (i + 0.008) / 40, math.tau * (i + 0.992) / 40
        corners = [
            (cx + rx * math.cos(t), cy + ry * math.sin(t), z)
            for rx, ry, z, t in [
                (0.86, 1.0, 0.017, a),
                (0.86, 1.0, 0.017, b),
                (0.92, 1.07, 0.57, b),
                (0.92, 1.07, 0.57, a),
            ]
        ]
        stave.faces.new([stave.verts.new(p) for p in corners])
    ellipse(
        parts,
        "ofuro_inner",
        "garden bath basalt",
        cx,
        cy,
        [(0.827, 0.977, 0.576), (0.80, 0.95, 0.27), (0.66, 0.80, 0.26), (0.61, 0.75, 0.13), (0.015, 0.015, 0.13)],
    )
    for z in (0.16, 0.46):
        rx = 0.86 + 0.06 * (z - 0.017) / 0.553
        ry = 1 + 0.07 * (z - 0.017) / 0.553
        ellipse(
            parts,
            "ofuro_hoops",
            BRONZE,
            cx,
            cy,
            [
                (rx + 0.003, ry + 0.003, z),
                (rx + 0.007, ry + 0.007, z + 0.004),
                (rx + 0.008, ry + 0.008, z + 0.024),
                (rx + 0.004, ry + 0.004, z + 0.028),
            ],
        )
    rings = [
        (cx + 0.823 * math.cos(i * math.tau / 40), cy + 0.975 * math.sin(i * math.tau / 40)) for i in range(40)
    ]
    bm = parts.mesh("soaking_surface", HOT)
    bm.faces.new([bm.verts.new((x, y, 0.51)) for x, y in rings])
    parts.box("ofuro_step", CEDAR, (11.17, 4.22, 0.015), (12.25, 4.57, 0.192), 0.022)
    parts.box("filler", BRONZE, (12.60, 5.76, 0.013), (12.655, 5.82, 0.76), 0.008)
    parts.box("filler", BRONZE, (12.47, 5.76, 0.72), (12.655, 5.82, 0.76), 0.008)
    # The glazed cold room fits inside the cut. Its offset entrance faces the
    # rear aisle. A clear fixed light frames the ocean from the slatted bench.
    parts.box("cold_room", LIME, (12.97, 3.67, 0.015), (13.10, 7.02, 0.49), 0.012)
    parts.box("cold_room", CEDAR, (12.97, 3.67, 2.14), (13.10, 7.02, 2.28), 0.012)
    parts.box("cold_window", GLASS, (13.028, 3.70, 0.49), (13.039, 7.00, 2.15))
    for i in range(12):
        y = 3.72 + i * 0.119
        parts.box("bath_screen", CEDAR, (12.968, y, 0.483), (13.006, y + 0.039, 2.145), 0.003)
    for y in (5.23, 6.99):
        parts.box("cold_frame", BRONZE, (13.012, y, 0.485), (13.047, y + 0.022, 2.145))
    parts.box("cold_room", LIME, (13.08, 3.67, 0.016), (13.77, 3.81, 2.28), 0.012)
    parts.box("cold_room", LIME, (13.08, 3.75, 2.23), (14.80, 7.02, 2.29), 0.009)
    parts.box("cold_sill", CEDAR, (13.10, 6.96, 0.018), (14.83, 7.04, 0.113), 0.009)
    for x in (13.12, 14.79):
        parts.box("cold_frame", BRONZE, (x, 6.98, 0.10), (x + 0.025, 7.02, 2.24))
    parts.box("cold_window", GLASS, (13.144, 6.992, 0.105), (14.788, 7.003, 2.23))
    for i in range(4):
        x = 13.12 + i * 0.165
        parts.box("cold_back", CEDAR, (x, 3.812, 0.30), (x + 0.154, 3.842, 2.17), 0.005)
    for i in range(6):
        y = 4.09 + i * 0.084
        parts.box("cold_bench", CEDAR, (13.22, y, 0.445), (14.01, y + 0.064, 0.494), 0.008)
    for x in (13.30, 13.82):
        parts.box("cold_bench", BASALT, (x, 4.12, 0.012), (x + 0.12, 4.55, 0.446), 0.008)
    # A slim hinoki deck for bare feet makes the two baths one room.
    for k in range(15):
        x = 10.91 + k * 0.248
        parts.box("bath_deck", CEDAR, (x, 3.53, 0.008), (x + 0.240, 6.85, 0.037))
    # Stone-framed sheet of bronze mesh marks the sliding leaf parked behind its jamb.
    parts.box("cold_leaf", GLASS, (13.14, 3.624, 0.055), (13.77, 3.643, 2.20))
    parts.box("cold_pull", BRONZE, (13.68, 3.590, 0.90), (13.70, 3.624, 1.14), 0.004)
    for x, y, z in [(12.85, 4.03, 0.55), (13.16, 4.66, 0.34)]:
        parts.box("bath_lights", PAPER, (x, y, z), (x + 0.028, y + 0.28, z + 0.045), 0.007)


def join_aprons():
    """Scribe the new structural slabs to the full outlines of the old decks."""
    apron = bpy.data.objects[PREFIX + "rock_apron__" + LIME]
    threshold = bpy.data.objects[PREFIX + "threshold__" + LIME]
    for existing, targets in [
        (apron, (threshold,)),
        (bpy.data.objects["core_gym_ledge"], (apron, threshold)),
        (bpy.data.objects["core_estate_terrace__warm cut stone"], (apron, threshold)),
    ]:
        cutter = existing.copy()
        cutter.data = existing.data.copy()
        bpy.context.collection.objects.link(cutter)
        verts = cutter.data.vertices
        low, high = min(v.co.z for v in verts), max(v.co.z for v in verts)
        inverse = cutter.matrix_world.inverted()
        for v in verts:
            p = cutter.matrix_world @ v.co
            p.z = -0.55 + 0.71 * (v.co.z - low) / (high - low)
            v.co = inverse @ p
        cutter.data.update()
        bpy.context.view_layer.update()
        for target in targets:
            boolean(target, cutter, "DIFFERENCE")
        data = cutter.data
        bpy.data.objects.remove(cutter, do_unlink=True)
        bpy.data.meshes.remove(data)


def build():
    for obj in list(bpy.data.objects):
        if obj.name.startswith(PREFIX):
            bpy.data.objects.remove(obj, do_unlink=True)
    RNG.seed(191126)
    if not bpy.context.scene.get("studyLoggiaRelocationVersion"):
        relocate_pavilion(bpy.context.scene)
    install_onsen_noren(bpy.context.scene)
    finishes()
    carve_north_room()
    parts = Finishes()
    open_arch(parts)
    pave(parts)
    plant(parts)
    cascade(parts)
    guard(parts)
    baths(parts)
    parts.finish()
    join_aprons()
    bpy.context.view_layer.update()
    return [o for o in bpy.data.objects if o.name.startswith(PREFIX)]


def restore_distant_bounce(before_bake):
    """Keep the approved rock bake everywhere outside the new excavation."""
    name = "core__golden coastal sandstone"
    rock = bpy.data.objects[name]
    with bpy.data.libraries.load(str(Path(before_bake).resolve()), link=False) as (_, requested):
        requested.objects = [name]
    previous = requested.objects[0]
    mesh = rock.data
    if len(mesh.loops) != len(previous.data.loops):
        raise ValueError("The local bounce restore needs the same topology before and after baking")
    colours = mesh.color_attributes.active_color
    old = previous.data.color_attributes.active_color
    if colours.domain != "CORNER" or old.domain != "CORNER":
        raise ValueError("Expected a native corner bake on the sandstone")
    n = len(mesh.loops)
    baked = np.empty((n, 4), dtype=np.float32)
    original = np.empty_like(baked)
    colours.data.foreach_get("color", baked.ravel())
    old.data.foreach_get("color", original.ravel())
    positions = [rock.matrix_world @ v.co for v in mesh.vertices]
    for face in mesh.polygons:
        if near_cut([positions[i] for i in face.vertices]):
            start = face.loop_start
            original[start : start + face.loop_total] = baked[start : start + face.loop_total]
    colours.data.foreach_set("color", original.ravel())
    old_mesh = previous.data
    bpy.data.objects.remove(previous, do_unlink=True)
    bpy.data.meshes.remove(old_mesh)


if __name__ == "__main__":
    previous = next((s.split("=", 1)[1] for s in sys.argv if s.startswith("--restore-rock-from=")), None)
    if previous:
        restore_distant_bounce(previous)
    else:
        objs = build()
        print(
            "WORKOUT GARDEN",
            len(objs),
            "batches",
            sum(sum(len(f.vertices) - 2 for f in o.data.polygons) for o in objs),
            "triangles",
            flush=True,
        )
    output = next((s.split("=", 1)[1] for s in sys.argv if s.startswith("--save-as=")), None)
    if output:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(Path(output).resolve()), compress=True)
