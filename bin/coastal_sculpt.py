"""Editable sculpt surfaces for Sirui's cave and character library.

Blender-only authoring helpers. The web runtime receives baked mesh geometry.
"""

import math
import random
import bpy
from mathutils import Vector


def surface(name, vertices, faces, mat, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    if mat:
        data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = smooth
    return obj


def loft(name, rings, mat, count=32):
    """An explicitly shaped continuous surface, capped at both ends."""
    vertices = []
    for z, x, y, rx, ry in rings:
        for j in range(count):
            a = j * math.tau / count
            vertices.append((x + rx * math.cos(a), y + ry * math.sin(a), z))
    faces = [tuple(reversed(range(count)))]
    for i in range(len(rings) - 1):
        for j in range(count):
            a = i * count + j
            b = i * count + (j + 1) % count
            faces.append((a, b, b + count, a + count))
    faces.append(tuple(range((len(rings) - 1) * count, len(rings) * count)))
    return surface(name, vertices, faces, mat)


def swept_lock(name, points, radii, mat, width=1, sides=10):
    # Interpolate the entire lock, including its taper, before building the
    # surface. Straight segments made the previous hair resemble rigid strips.
    knots = [Vector(p) for p in points]
    curve_points, curve_radii = [], []
    for i in range(len(knots) - 1):
        p0, p1, p2, p3 = (
            knots[max(0, i - 1)],
            knots[i],
            knots[i + 1],
            knots[min(len(knots) - 1, i + 2)],
        )
        for j in range(5):
            t = j / 5
            curve_points.append(
                0.5
                * (
                    (2 * p1)
                    + (-p0 + p2) * t
                    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                    + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
                )
            )
            curve_radii.append(radii[i] * (1 - t) + radii[i + 1] * t)
    points, radii = curve_points + [knots[-1]], curve_radii + [radii[-1]]
    vertices, faces = [], []
    for i, point in enumerate(points):
        tangent = Vector(points[min(i + 1, len(points) - 1)]) - Vector(
            points[max(0, i - 1)]
        )
        tangent.normalize()
        u = tangent.cross(Vector((0, 1, 0))).normalized()
        if u.length < 0.1:
            u = tangent.cross(Vector((1, 0, 0))).normalized()
        v = tangent.cross(u).normalized()
        for j in range(sides):
            a = j * math.tau / sides
            vertices.append(
                Vector(point) + radii[i] * (math.cos(a) * u * width + math.sin(a) * v)
            )
    for i in range(len(points) - 1):
        for j in range(sides):
            n = i * sides + j
            k = i * sides + (j + 1) % sides
            faces.append((n, k, k + sides, n + sides))
    faces += [
        tuple(reversed(range(sides))),
        tuple(range((len(points) - 1) * sides, len(points) * sides)),
    ]
    return surface(name, vertices, faces, mat)


def weld_sculpt(objects, name, voxel=0.012):
    """Union overlapping sculpt masses, then smooth their shared skin."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    mod = obj.modifiers.new("continuous sculpt skin", "REMESH")
    mod.mode = "VOXEL"
    mod.voxel_size = voxel
    mod.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new("web sculpt reduction", "DECIMATE")
    mod.ratio = 0.28
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new("relaxed sculpt surface", "SMOOTH")
    mod.factor = 0.85
    mod.iterations = 4
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)
    return obj


def refine_character(pieces, style, width, head_z, head_scale, h):
    """Replace primitive silhouettes with sewn clothing, sculpt skin and locks."""
    if style != "lizard":
        from coastal_characters import refine_human

        return refine_human(pieces, style, width, head_z, head_scale, h)
    sphere, tube = h["sphere"], h["tube"]
    mats = {m.name: m for m in bpy.data.materials}
    shirt, skin, hair = mats["Sirui shirt"], mats["skin"], mats["long black hair"]
    glint = mats["hair glints"]
    lizard, short = style == "lizard", style == "south-park"
    hair.diffuse_color = (0.006, 0.0065, 0.007, 1)
    hair.node_tree.nodes["Principled BSDF"].inputs[
        "Base Color"
    ].default_value = hair.diffuse_color
    hair.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.66

    def discard(names):
        for obj, bone in list(pieces):
            if any(obj.name.startswith(name) for name in names):
                pieces.remove((obj, bone))
                bpy.data.objects.remove(obj, do_unlink=True)

    discard(("male torso", "shirt hem", "side parted long hair", "swept hair strand"))
    # A shirt has a hem, a chest and a shoulder seam, not a spherical belly.
    torso = loft(
        "tailored cotton shirt",
        [
            (0.685, 0, 0.015, width * 0.83, 0.128),
            (0.715, 0, 0.013, width * 0.90, 0.143),
            (0.79, 0, 0.008, width * 0.85, 0.135),
            (0.89, 0, 0.005, width * 0.91, 0.145),
            (0.99, 0, 0, width, 0.149),
            (1.045, 0, 0, width * 0.92, 0.13),
            (1.075, 0, 0, width * 0.72, 0.10),
            (1.10, 0, 0, 0.092, 0.079),
        ],
        shirt,
    )
    pieces.append((torso, "Spine"))
    hem = tube(
        "cotton hem seam",
        [
            (
                width * 0.84 * math.cos(a * math.tau / 32),
                0.014 + 0.137 * math.sin(a * math.tau / 32),
                0.72,
            )
            for a in range(33)
        ],
        0.004,
        glint,
    )
    pieces.append((hem, "Spine"))
    neck_rim = tube(
        "crew neck rib",
        [
            (
                0.095 * math.cos(a * math.tau / 32),
                0.080 * math.sin(a * math.tau / 32),
                1.10,
            )
            for a in range(33)
        ],
        0.009,
        shirt,
    )
    pieces.append((neck_rim, "Spine"))
    # Weld the face, ears and reptile muzzle into one skin with a continuous jaw.
    face_parts = [
        (o, b)
        for o, b in pieces
        if o.name.startswith(
            ("Sirui face", "ear", "broad lizard muzzle", "defined lower jaw", "nose")
        )
    ]
    for item in face_parts:
        pieces.remove(item)
    face = weld_sculpt(
        [o for o, _ in face_parts], "sculpted Sirui face", 0.006 if not short else 0.008
    )
    pieces.append((face, "Head"))
    if lizard:
        discard(("relaxed lizard smile",))
        cutter = sphere(
            "mouth sculpt tool",
            (0, -0.285, head_z - 0.135),
            (0.129, 0.16, 0.063),
            None,
            segments=32,
        )
        bpy.context.view_layer.objects.active = face
        cut = face.modifiers.new("open expressive mouth", "BOOLEAN")
        cut.operation = "DIFFERENCE"
        cut.object = cutter
        bpy.ops.object.modifier_apply(modifier=cut.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
        pieces.append(
            (
                sphere(
                    "inside smile",
                    (0, -0.219, head_z - 0.137),
                    (0.119, 0.085, 0.052),
                    mats["mouth"],
                    segments=32,
                ),
                "Head",
            )
        )
        pieces.append(
            (
                sphere(
                    "small tongue",
                    (0, -0.291, head_z - 0.17),
                    (0.049, 0.025, 0.019),
                    mats["tongue"],
                ),
                "Head",
            )
        )
    elif style == "ghibli":
        discard(("smile",))
        mouth_z = head_z - 0.118
        face_y = -0.015 - head_scale[1] * math.sqrt(1 - (0.118 / head_scale[2]) ** 2)
        points = [
            (-0.057, face_y + 0.004, mouth_z + 0.006),
            (-0.028, face_y - 0.004, mouth_z - 0.002),
            (0, face_y - 0.009, mouth_z - 0.004),
            (0.029, face_y - 0.004, mouth_z),
            (0.057, face_y + 0.004, mouth_z + 0.009),
        ]
        pieces.append(
            (tube("gentle closed smile", points, 0.003, mats["mouth"]), "Head")
        )
    else:
        # Teeth belong inside a recessed mouth. The old dark oval was in front
        # of the teeth, producing an unintended glossy, painted-on lip.
        discard(("smile",))
        mouth_z = head_z - 0.135
        face_y = -0.015 - head_scale[1] * math.sqrt(1 - (0.135 / head_scale[2]) ** 2)
        mouth_w = 0.093 if short or style == "rick-and-morty" else 0.073
        mouth_h = 0.045 if style == "rick-and-morty" else 0.031
        cutter = sphere(
            "mouth sculpt tool",
            (0, face_y - 0.014, mouth_z),
            (mouth_w, 0.08, mouth_h),
            None,
            segments=32,
        )
        for v in cutter.data.vertices:
            v.co.z += 0.025 * (v.co.x / mouth_w) ** 2
        bpy.context.view_layer.objects.active = face
        cut = face.modifiers.new("recessed smile", "BOOLEAN")
        cut.operation, cut.object = "DIFFERENCE", cutter
        bpy.ops.object.modifier_apply(modifier=cut.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
        pieces.append(
            (
                sphere(
                    "smile interior",
                    (0, face_y + 0.04, mouth_z),
                    (mouth_w * 0.93, 0.06, mouth_h * 0.88),
                    mats["mouth"],
                    segments=24,
                ),
                "Head",
            )
        )
        teeth = h["box"](
            "upper teeth",
            (0, face_y - 0.025, mouth_z + mouth_h * 0.37),
            (mouth_w * 1.40, 0.012, mouth_h * 0.48),
            mats["warm white"],
            0.006,
        )
        pieces.append((teeth, "Head"))
        for v in teeth.data.vertices:
            v.co.z += 0.025 * (v.co.x / mouth_w) ** 2
    # The side-parted crown flows continuously into uneven, tapered locks.
    hx, hy, hz = head_scale
    rings = [
        (1.07, 0.10, 0),
        (0.98, 0.41, 0),
        (0.88, 0.64, 0),
        (0.75, 0.81, 0),
        (0.62, 0.93, 0),
        (0.50, 1.04, 0.85),
        (0.20, 1.08, 1.38),
        (-0.12, 1.08, 1.42),
        (-0.46, 1.05, 1.48),
        (-0.78, 1.04, 1.55),
        (-1.04, 1.12, 1.60),
        (-1.18, 1.08, 1.66),
    ]
    verts, faces, segments = [], [], 52
    for level, spread, gap in rings:
        for j in range(segments + 1):
            a = gap + (math.tau - gap * 2) * j / segments + 0.30
            wave = 0.009 * math.sin(a * 7 + level * 3) + 0.005 * math.sin(
                a * 13 - level * 2
            )
            verts.append(
                (
                    math.sin(a) * (hx * spread + wave),
                    0.025 - math.cos(a) * (hy * spread + 0.022 + wave),
                    head_z + level * hz + 0.018 * math.sin(a * 2),
                )
            )
    for i in range(len(rings) - 1):
        for j in range(segments):
            n = i * (segments + 1) + j
            faces.append((n, n + 1, n + segments + 2, n + segments + 1))
    faces.append(tuple(reversed(range(segments + 1))))
    crown = surface("sculpted side-part crown", verts, faces, hair)
    bpy.context.view_layer.objects.active = crown
    mod = crown.modifiers.new("soft crown sculpt", "SUBSURF")
    mod.levels = 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = crown.modifiers.new("hair thickness", "SOLIDIFY")
    mod.thickness = 0.018
    bpy.ops.object.modifier_apply(modifier=mod.name)
    pieces.append((crown, "Head"))
    for i in range(20):
        a = 1.15 + i * (math.tau - 2.3) / 19
        curl = 0.018 + (i % 4) * 0.007
        points = []
        for level, spread in [
            (0.84, 0.78),
            (0.50, 1.04),
            (0.06, 1.12),
            (-0.46, 1.11),
            (-0.88, 1.16),
            (-1.18 - (i % 3) * 0.06, 1.26),
            (-1.21 - (i % 3) * 0.05, 1.41),
        ]:
            sweep = a + 0.12 * math.sin(level * 2 + i * 0.32)
            points.append(
                (
                    math.sin(sweep) * hx * spread,
                    0.027 - math.cos(sweep) * (hy * spread + 0.024),
                    head_z + hz * level + curl * math.sin(level * 4),
                )
            )
        obj = swept_lock(
            "layered flowing hair",
            points,
            [0.01, 0.028, 0.032, 0.032, 0.029, 0.018, 0.001],
            hair,
            width=1.25,
        )
        pieces.append((obj, "Head"))
        if i % 2 == 0:
            shifted = [(x * 1.008, y * 1.008, z + 0.009) for x, y, z in points]
            pieces.append(
                (
                    swept_lock(
                        "subtle hair highlight",
                        shifted,
                        [0.001, 0.002, 0.0022, 0.0018, 0.002, 0.001, 0.0002],
                        glint,
                        width=1.1,
                        sides=5,
                    ),
                    "Head",
                )
            )
    hair_parts = [
        (o, b)
        for o, b in pieces
        if o.name.startswith(("sculpted side-part crown", "layered flowing hair"))
    ]
    for item in hair_parts:
        pieces.remove(item)
    pieces.append(
        (
            weld_sculpt(
                [o for o, _ in hair_parts], "wavy continuous hair sculpt", 0.006
            ),
            "Head",
        )
    )
    # Small individual fingers make the grasp legible at close range.
    for s, side in ((-1, "L"), (1, "R")):
        wrist = s * (width + 0.070)
        for finger in range(3 if lizard or short else 4):
            x = wrist + (finger - (1 if lizard or short else 1.5)) * 0.020
            points = [
                (x, -0.025, 0.555),
                (x, -0.057, 0.515 - (finger % 2) * 0.010),
                (x, -0.067, 0.495),
                (x, -0.058, 0.486),
            ]
            pieces.append(
                (
                    swept_lock(
                        "curled finger",
                        points,
                        [0.014, 0.014, 0.012, 0.008],
                        skin,
                        sides=8,
                    ),
                    "Hand." + side,
                )
            )
        # Trouser sections have cylindrical cloth volume and cuffs, not beads.
        hip = s * 0.11
        matching = [
            (o, b)
            for o, b in pieces
            if b == "Thigh." + side or (b == "Shin." + side and not lizard)
        ]
        pant_mat = matching[0][0].data.materials[0]
        for obj, bone in matching:
            pieces.remove((obj, bone))
            bpy.data.objects.remove(obj, do_unlink=True)
        leg = loft(
            "shaped trouser leg",
            [
                (0.35 if lizard else 0.10, hip, 0.006, 0.077, 0.075),
                (0.38, hip, 0, 0.086, 0.09),
                (0.54, hip, 0, 0.10, 0.125),
                (0.69, hip, 0, 0.105, 0.12),
            ],
            pant_mat,
            count=24,
        )
        # Smooth skinning across the knee is assigned by the main rig builder.
        leg["blendLeg"] = side
        pieces.append((leg, "Thigh." + side))
        skin_parts = [
            (o, b)
            for o, b in pieces
            if b in ("Arm." + side, "Forearm." + side, "Hand." + side)
            and o.data.materials[0] == skin
        ]
        for item in skin_parts:
            pieces.remove(item)
        arm_skin = weld_sculpt(
            [o for o, _ in skin_parts], "continuous arm and fingers", 0.006
        )
        arm_skin["blendArm"] = side
        pieces.append((arm_skin, "Forearm." + side))
    discard(("t shirt sleeve",))
    for s, side in ((-1, "L"), (1, "R")):
        shoulder = s * (width + 0.022)
        sleeve = loft(
            "t shirt sleeve",
            [
                (0.925, shoulder + s * 0.025, 0, 0.078, 0.082),
                (0.955, shoulder + s * 0.018, 0, 0.088, 0.089),
                (1.015, shoulder, 0, 0.092, 0.102),
                (1.058, shoulder - s * 0.015, 0, 0.067, 0.077),
            ],
            shirt,
            count=24,
        )
        pieces.append((sleeve, "Arm." + side))
    shirt_parts = [
        (o, b)
        for o, b in pieces
        if o.name.startswith(("tailored cotton shirt", "t shirt sleeve"))
    ]
    for item in shirt_parts:
        pieces.remove(item)
    cotton = weld_sculpt([o for o, _ in shirt_parts], "sewn cotton shoulders", 0.008)
    cotton["blendShirt"] = width
    pieces.append((cotton, "Spine"))
    return pieces


def build_cave(mats, h):
    """Connected sandstone shell: a vaulted cave cut into the bluff's crown."""
    # Front-to-back vault; the opening is one irregular carved span, not piers.
    vertices, faces = [], []
    n, depths = 96, [3.42 - i * 6.87 / 24 for i in range(25)]
    for layer in (0, 1):
        for y in depths:
            for j in range(n + 1):
                a = j * math.pi / n
                if layer == 0:
                    x = 4.78 * math.cos(a)
                    z = 0.15 + 3.05 * math.sin(a) ** 0.48
                else:
                    x = (5.45 + (3.42 - y) * 0.085) * math.cos(a)
                    z = 0.05 + (3.62 + (3.42 - y) * 0.12) * math.sin(a) ** 0.53
                wave = 0.06 * math.sin(a * 7 + y * 0.47) + 0.03 * math.sin(a * 15 - y)
                relief = (
                    wave
                    if layer == 0
                    else wave * 1.8 + 0.09 * math.sin(a * 19 + y * 2.7)
                )
                vertices.append(
                    (x + relief, y, z + relief * (0.5 if layer == 0 else 1.3))
                )
    block = len(depths) * (n + 1)
    for layer in (0, 1):
        for i in range(len(depths) - 1):
            for j in range(n):
                p = layer * block + i * (n + 1) + j
                face = (p, p + 1, p + n + 2, p + n + 1)
                faces.append(face if layer else tuple(reversed(face)))
    for row in (0, len(depths) - 1):
        for j in range(n):
            p = row * (n + 1) + j
            faces.append((p, p + block, p + 1 + block, p + 1))
    roof = surface("core_carved_vault", vertices, faces, mats["plaster"])
    outer_stone = h["material"]("cave exterior sandstone", (0.43, 0.34, 0.235), 0.91)
    roof.data.materials.append(outer_stone)
    for i, face in enumerate(roof.data.polygons):
        face.material_index = (
            1 if (len(depths) - 1) * n <= i < 2 * (len(depths) - 1) * n else 0
        )
    roof["caveRoof"] = True
    from coastal_interiors import architecture

    architecture(mats, h)
    return roof


def build_bluff(mats, h):
    rng = random.Random(371)
    rock = h["material"]("eroded coastal sandstone", (0.43, 0.34, 0.235), 0.91)
    strata = h["material"]("fine warm sediment", (0.455, 0.363, 0.263), 0.94)
    sand = h["material"]("dry beach sand", (0.73, 0.59, 0.39), 0.98)
    wet = h["material"]("wet tideline sand", (0.41, 0.35, 0.25), 0.35)
    scrub = h["material"]("bluff coastal sage", (0.22, 0.28, 0.13), 0.95)
    objects = []

    def bluff(name, cx, cy, rx, ry, base, top):
        count, rows = 112, 40
        verts, faces = [], []
        for i in range(rows + 1):
            t = i / rows
            for j in range(count):
                a = j * math.tau / count
                # Fluted erosion, fractures, and shallow ledges in one continuous
                # surface. The old regular bands made the cliff a striped block.
                wave = (
                    0.065 * math.sin(a * 5 + 0.15 * math.sin(t * 9))
                    + 0.043 * math.sin(a * 13 + t * 0.4)
                    + 0.018 * math.sin(a * 31 - t * 0.7)
                    + 0.014 * math.sin(a * 63 + t * 4)
                    + 0.019 * math.sin(t * 27 + math.sin(a * 7))
                )
                flute = 0.115 * abs(math.sin(a * 9.0 + 0.7 * math.sin(a * 3.0))) ** 10
                radius = (
                    1.16
                    - t * 0.16
                    + (wave * 1.45 - flute) * math.sin(math.pi * t * 0.91)
                )
                c, s = math.cos(a), math.sin(a)
                power = 0.52 if name == "coast_home_bluff" else 0.85
                x = cx + rx * math.copysign(abs(c) ** power, c) * radius
                y = cy + ry * math.copysign(abs(s) ** power, s) * radius
                if name == "coast_home_bluff" and s < 0:
                    y -= abs(s) * 15
                z = base + (top - base) * t
                # Asymmetric rounded caps on the distant landforms; the inhabited
                # shelf stays level so the floor never separates from its cliff.
                cap = (
                    0
                    if name == "coast_home_bluff"
                    else (0.5 * math.sin(a * 3) + 0.27 * math.sin(a * 7)) * t * t
                )
                verts.append(
                    (
                        x,
                        y,
                        z
                        + cap
                        + 0.06 * math.sin(a * 8 + t * 4) * math.sin(math.pi * t),
                    )
                )
        for i in range(rows):
            for j in range(count):
                p, k = i * count + j, i * count + (j + 1) % count
                faces.append((p, k, k + count, p + count))
        faces += [
            tuple(reversed(range(count))),
            tuple(range(rows * count, (rows + 1) * count)),
        ]
        obj = surface(name, verts, faces, rock)
        obj.data.materials.append(strata)
        for i, face in enumerate(obj.data.polygons):
            face.material_index = 1 if (i // count) % 13 == 5 else 0
        objects.append(obj)
        return obj

    bluff("coast_home_bluff", 0, -1.35, 5.45, 5.45, -7.65, -0.24)
    # A continuous inland terrain meets the vault at its back edge. This is
    # one sloping landform, not a set of spheres perched behind the building.
    verts, faces, nx, ny = [], [], 72, 64
    for j in range(ny + 1):
        y = -3.45 - j / ny * 25
        for i in range(nx + 1):
            x = -14 + i / nx * 31
            edge = max(0, 1 - (x / 6.034) ** 2) ** 0.265 * 4.45
            t = min(1, (-y - 3.45) / 4)
            rise = (
                3.1
                + 2.5 * math.exp(-(((x - 4) / 6) ** 2))
                + 0.9 * math.sin(y * 0.28 + x * 0.16)
            )
            noise = 0.23 * math.sin(x * 1.13 + y * 0.83) + 0.12 * math.sin(
                x * 2.7 - y * 1.7
            )
            z = edge * (1 - t) + (rise + noise) * t
            verts.append((x, y, z))
    for j in range(ny):
        for i in range(nx):
            p = j * (nx + 1) + i
            faces.append((p, p + nx + 1, p + nx + 2, p + 1))
    terrain = surface("coast_continuous_inland_terrain", verts, faces, rock)
    objects.append(terrain)
    bluff("coast_mainland", 25, -16, 18, 15, -7.65, 2.4)
    # Two headlands recede along the same shoreline, below the real horizon.
    for x, y, rx, ry, top in [(32, 12, 8, 12, 1.9), (60, 22, 12, 16, 4.2)]:
        bluff("coast_distant_headland", x, y, rx, ry, -7.7, top)
    # Authored, variable-width contour strokes describe erosion in the print.
    contour = h["material"]("coast ink contour", (0.055, 0.075, 0.13), 1)
    for j in range(18):
        a = 0.10 + j / 17 * (math.pi - 0.20)
        points = []
        for i in range(17):
            t = 0.05 + i / 16 * 0.88
            radius = (
                1.125
                - t * 0.14
                + 0.045 * math.sin(a * 11 + t * 0.7)
                + 0.032 * math.sin(a * 19 - t * 0.9)
                + 0.007 * math.sin(t * 17 + a * 23)
            )
            points.append(
                (
                    5.45
                    * math.copysign(abs(math.cos(a)) ** 0.52, math.cos(a))
                    * radius,
                    -1.35 + 5.45 * math.sin(a) ** 0.52 * radius,
                    -7.65 + t * 7.41,
                )
            )
        stroke = h["tube"](
            "coast_erosion_ink", points, 0.012 + (j % 3) * 0.006, contour, resolution=2
        )
        stroke["renderStyle"] = "illustrated"
        objects.append(stroke)
    # The beach is a sloping crescent at the foot of the cliff, not a flat floor at home level.
    count = 64
    verts, faces = [], []
    for strip in range(4):
        t = strip / 3
        for j in range(count + 1):
            a = -0.17 + j / count * (math.pi + 0.34)
            radius = 1 + t * (0.50 + 0.18 * math.sin(a) ** 2)
            verts.append(
                (
                    6.05
                    * math.copysign(abs(math.cos(a)) ** 0.52, math.cos(a))
                    * radius,
                    -1.1
                    + 6.05
                    * math.copysign(abs(math.sin(a)) ** 0.52, math.sin(a))
                    * radius,
                    -6.94 - t * 0.69,
                )
            )
    for strip in range(3):
        for j in range(count):
            p = strip * (count + 1) + j
            faces.append((p, p + 1, p + count + 2, p + count + 1))
    beach = surface("coast_crescent_beach", verts, faces, sand)
    beach.data.materials.append(wet)
    for i, face in enumerate(beach.data.polygons):
        face.material_index = 1 if i >= count * 2 else 0
    objects.append(beach)
    surf_mat = h["material"]("beach wash", (0.83, 0.89, 0.83), 0.7)
    points = []
    for j in range(65):
        a = j / 64 * math.pi
        radius = 1 + 0.60 * (0.50 + 0.18 * math.sin(a) ** 2)
        points.append(
            (
                6.05 * math.copysign(abs(math.cos(a)) ** 0.52, math.cos(a)) * radius,
                -1.1 + 6.05 * math.sin(a) ** 0.52 * radius,
                -7.32,
            )
        )
    objects.append(
        h["tube"]("coast_breaking_shoreline", points, 0.022, surf_mat, resolution=3)
    )
    for i in range(38):
        a = rng.uniform(-0.08, math.pi + 0.08)
        x, y = math.cos(a) * rng.uniform(6.1, 6.7), -1.1 + math.sin(a) * rng.uniform(
            6.1, 6.7
        )
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=2, radius=1, location=(x, y, -7.15)
        )
        obj = bpy.context.object
        obj.scale = (
            rng.uniform(0.17, 0.43),
            rng.uniform(0.2, 0.5),
            rng.uniform(0.15, 0.45),
        )
        h["finish"](obj, "coast_beach_talus", rock)
        objects.append(obj)
    for i in range(32):
        x = rng.uniform(-4.3, 4.3)
        y = rng.uniform(-2.9, 2.8)
        a = math.acos(max(-0.99, min(0.99, x / (5.45 + (3.42 - y) * 0.085))))
        z = 0.05 + (3.62 + (3.42 - y) * 0.12) * math.sin(a) ** 0.53
        for j in range(3):
            plant = h["sphere"](
                "coast_roof_sage",
                (
                    x + math.cos(j * 2.3) * 0.09,
                    y + math.sin(j * 2.3) * 0.09,
                    z + 0.12,
                ),
                (0.16, 0.15, 0.13),
                scrub,
                segments=12,
            )
            plant["caveRoof"] = True
            objects.append(plant)
    return objects


def render_portrait(arm, style, out):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    try:
        preferences = bpy.context.preferences.addons["cycles"].preferences
        preferences.compute_device_type = "CUDA"
        preferences.get_devices()
        for device in preferences.devices:
            device.use = device.type == "CUDA"
        if any(d.type == "CUDA" for d in preferences.devices):
            scene.cycles.device = "GPU"
    except (TypeError, RuntimeError):
        pass
    scene.render.resolution_x, scene.render.resolution_y = 384, 480
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("portrait paper")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (
        0.72,
        0.66,
        0.55,
        1,
    )
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.65
    bpy.ops.object.camera_add(location=(1.8, -5.0, 2.12))
    camera = bpy.context.object
    camera.name = "Portrait camera"
    target = Vector((0, -0.01, 1.30))
    camera.rotation_euler = (
        (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 1.24
    scene.camera = camera
    for name, location, energy, size in [
        ("soft key", (-3, -4, 5), 400, 4),
        ("warm rim", (3, 2, 4), 500, 3),
    ]:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy, light.data.shape, light.data.size = energy, "DISK", size
        light.rotation_euler = (
            (target - light.location).to_track_quat("-Z", "Y").to_euler()
        )
    scene.view_settings.view_transform = "AgX"
    (out / "portraits").mkdir(exist_ok=True)
    scene.render.filepath = str(out / "portraits" / (style + ".png"))
    bpy.ops.render.render(write_still=True)
    # Model review includes front, profile, and full-body views. A flattering
    # single bust angle is not evidence for a usable three-dimensional likeness.
    for label, location, center, scale in [
        ("front", (0, -5, 1.36), (0, 0, 1.24), 1.12),
        ("profile", (5, -0.4, 1.5), (0, 0, 1.24), 1.14),
        ("body", (2, -6, 2.2), (0, 0, 0.81), 2.12),
    ]:
        camera.location = location
        camera.rotation_euler = (
            (Vector(center) - camera.location).to_track_quat("-Z", "Y").to_euler()
        )
        camera.data.ortho_scale = scale
        scene.render.filepath = str(out / "portraits" / (style + "-" + label + ".png"))
        bpy.ops.render.render(write_still=True)
