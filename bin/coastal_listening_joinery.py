"""The horn cabinet, island and acoustic lining in the cliff listening room.

All dimensions are native metres. The cabinet faces +X toward the banquette.
Each loudspeaker has a flared throat and a separate paper bass driver.
"""

import math
import random
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

import coastal_decor as decor

WALNUT = "listening room quarter-cut walnut"
HORN = "listening room honey ash"
HORN_EDGE = "listening room amber end grain"
SOAPSTONE = "listening room green soapstone"
CUT_ROCK = "listening room sedimentary stone"
COPPER = "listening room brushed copper"
FELT = "speaker charcoal felt"
OXBLOOD = "listening room cordovan leather"
PARCHMENT = "listening room gold parchment"
BRASS = "brushed brass"
DARK = "dark bronze"


def image_finish(name, low, high, blend, roughness):
    surface = decor.material(name, tuple(low), roughness)
    if any(node.type == "TEX_IMAGE" for node in surface.node_tree.nodes):
        return
    size = blend.shape[0]
    rgba = np.ones((size, size, 4), dtype=np.float32)
    rgba[:, :, :3] = np.array(low) + (np.array(high) - low) * np.clip(blend[:, :, None], 0, 1)
    pattern = bpy.data.images.new(name, width=size, height=size, alpha=False)
    pattern.pixels.foreach_set(rgba.ravel())
    pattern.pack()
    tree = surface.node_tree
    texture = tree.nodes.new("ShaderNodeTexImage")
    texture.image = pattern
    tree.links.new(texture.outputs["Color"], tree.nodes["Principled BSDF"].inputs["Base Color"])


def finishes():
    size = 128
    v, u = np.indices((size, size)) * math.tau / size
    waves = u + 0.15 * np.sin(v) + 0.045 * np.sin(3 * v + 2 * u)
    fibres = 0.5 + 0.11 * np.cos(9 * waves) + 0.067 * np.sin(24 * waves) + 0.033 * np.sin(43 * waves + v)
    image_finish(WALNUT, (0.205, 0.126, 0.086), (0.412, 0.293, 0.202), fibres, 0.51)
    image_finish(HORN, (0.455, 0.290, 0.167), (0.686, 0.506, 0.329), fibres, 0.43)
    image_finish(HORN_EDGE, (0.507, 0.341, 0.207), (0.758, 0.567, 0.367), fibres, 0.41)
    seam = np.abs(np.sin(2 * u + v + 0.92 * np.sin(v) + 0.32 * np.sin(3 * u - 2 * v)))
    calcite = np.exp(-np.square(seam / 0.048))
    mottling = 0.14 + 0.12 * np.sin(u + v) * np.sin(2 * u - v) + 0.10 * np.cos(3 * u + 2 * v)
    image_finish(SOAPSTONE, (0.172, 0.236, 0.198), (0.535, 0.571, 0.472), mottling + 0.75 * calcite, 0.33)
    rock = decor.material(CUT_ROCK, (0.59, 0.47, 0.32), 0.91)
    if not any(node.type == "TEX_IMAGE" for node in rock.node_tree.nodes):
        folder = Path(__file__).resolve().parents[1] / "artwork/coastal-home/materials"
        tree = rock.node_tree
        bsdf = tree.nodes["Principled BSDF"]
        for filename, channel in (
            ("listening-sandstone.jpg", "Base Color"),
            ("listening-sandstone-normal.jpg", "Normal"),
        ):
            tex = tree.nodes.new("ShaderNodeTexImage")
            tex.image = bpy.data.images.load(str(folder / filename), check_existing=True)
            tex.extension = "MIRROR"
            if channel == "Normal":
                tex.image.colorspace_settings.name = "Non-Color"
                bump = tree.nodes.new("ShaderNodeNormalMap")
                bump.inputs["Strength"].default_value = 0.66
                tree.links.new(tex.outputs["Color"], bump.inputs["Color"])
                tree.links.new(bump.outputs["Normal"], bsdf.inputs[channel])
            else:
                tree.links.new(tex.outputs["Color"], bsdf.inputs[channel])
            tex.image.pack()
    decor.material(FELT, (0.065, 0.056, 0.048), 0.96)
    decor.material(OXBLOOD, (0.334, 0.159, 0.089), 0.51)
    copper = decor.material(COPPER, (0.549, 0.318, 0.193), 0.38)
    copper.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.62
    glow = decor.material(PARCHMENT, (0.96, 0.76, 0.44), 0.79)
    bsdf = glow.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Emission Color"].default_value = (1, 0.58, 0.265, 1)
    bsdf.inputs["Emission Strength"].default_value = 0.42


def stone_uv(u, v):
    return (u + 0.056 * math.sin(v * 1.14)) / 1.81, (v + 0.052 * math.sin(u * 1.47)) / 1.67


def map_finish(obj):
    surface = obj.data.materials[0].name
    if surface not in (WALNUT, HORN, HORN_EDGE, SOAPSTONE, CUT_ROCK):
        return
    data = obj.data
    if (
        obj.name.startswith(("core_speakeasy_horn_bell", "core_speakeasy_horn_lip", "core_speakeasy_horn_shell"))
        and data.uv_layers.active
    ):
        return
    uv = data.uv_layers.active or data.uv_layers.new(name="Material scale")
    for face in data.polygons:
        axis = max(range(3), key=lambda i: abs(face.normal[i]))
        for loop in face.loop_indices:
            x, y, z = data.vertices[data.loops[loop].vertex_index].co
            if surface == CUT_ROCK and obj.name.startswith("core_speakeasy_cut_vault"):
                u, v = y, x
            elif axis == 2:
                u, v = x, y
            elif axis == 0:
                u, v = y, z
            else:
                u, v = x, z
            if surface == CUT_ROCK:
                uv.data[loop].uv = stone_uv(u, v)
            elif surface == SOAPSTONE:
                uv.data[loop].uv = (u / 1.41, v / 1.23)
            else:
                uv.data[loop].uv = (u / 0.48, v / 1.28)


def contours(j, piece, finish, profiles, caps=True, smooth=True, radial_uv=False):
    """Skin matching closed polygonal rings, optionally closing the ends."""
    bm = j.mesh(piece, finish)
    rings = [[bm.verts.new(point) for point in section] for section in profiles]
    uv = bm.loops.layers.uv.verify() if radial_uv else None
    for row, (left, right) in enumerate(zip(rings, rings[1:])):
        for k in range(len(left)):
            following = (k + 1) % len(left)
            face = bm.faces.new((left[k], left[following], right[following], right[k]))
            face.smooth = smooth
            if radial_uv:
                for loop, (ui, vi) in zip(face.loops, ((k, row), (k + 1, row), (k + 1, row + 1), (k, row + 1))):
                    angle = math.tau * ui / len(left)
                    distance = vi / (len(rings) - 1)
                    loop[uv].uv = (
                        0.56 * distance + 0.20 * math.cos(angle - 0.6) + 0.055 * math.sin(2 * angle + distance),
                        ui / len(left),
                    )
    if caps:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])


def speaker(j, y, toe):
    # The circular mouth flares toward the listener. Its turned lip catches
    # the light from the cornice while the graphite driver stays in shadow.
    depth = Vector((math.cos(toe), math.sin(toe), 0))
    across = Vector((-math.sin(toe), math.cos(toe), 0))
    origin = Vector((-12.399, y, 1.603))

    def section(d, width, height, exponent=1.0, z=0):
        ring = []
        for i in range(40):
            a = math.tau * i / 40
            ca, sa = math.cos(a), math.sin(a)
            u = math.copysign(abs(ca) ** exponent, ca) * width / 0.66
            v = math.copysign(abs(sa) ** exponent, sa) * height
            ring.append(origin + depth * d + across * u + Vector((0, 0, z + v)))
        return ring

    # The inner surface opens toward +X. Order flared mouth to throat so
    # normals on this visible inner face point back into the waveguide.
    shape = []
    for t in np.linspace(1.0, 0.0, 15):
        r = 0.066 + 0.352 * t**1.90
        shape.append(section(0.068 + 0.391 * t, r, r * 0.972))
    contours(j, "horn_bell", HORN, shape, False, radial_uv=True)
    contours(
        j,
        "horn_lip",
        HORN_EDGE,
        [
            section(0.459, 0.418, 0.406),
            section(0.468, 0.427, 0.415),
            section(0.465, 0.436, 0.424),
            section(0.446, 0.442, 0.430),
            section(0.419, 0.431, 0.419),
        ],
        False,
        radial_uv=True,
    )
    contours(
        j,
        "horn_shell",
        WALNUT,
        [
            section(0.071, 0.072, 0.070),
            section(0.151, 0.105, 0.102),
            section(0.281, 0.204, 0.198),
            section(0.419, 0.431, 0.419),
        ],
        False,
        radial_uv=True,
    )
    contours(
        j,
        "compression_driver",
        FELT,
        [
            section(0.037, 0.008, 0.008),
            section(0.044, 0.043, 0.042),
            section(0.068, 0.066, 0.064),
            section(0.073, 0.071, 0.069),
        ],
        True,
    )
    # The bass driver is behind acoustically transparent fabric in the low cabinet.


def vault(j):
    """Carved soffit. Shallow beds break the grazing light and meet both jambs."""
    bm = j.mesh("cut_vault", CUT_ROCK)
    nx, ny = 26, 25
    rows = []
    for ix in range(nx + 1):
        # Meet the inward jamb and window faces. Their outer sides and the
        # two end gables have their own stone and plaster closure.
        x = -12.48 + ix * 3.86 / nx
        t = (x + 12.68) / 4.28
        blend = min(1.0, min(ix, nx - ix) * 3.86 / (nx * 0.23))
        eave = blend * blend * (3 - 2 * blend)
        row = []
        for iy in range(ny + 1):
            y = 6.319 + iy * 3.602 / ny
            strata = y + 0.24 * math.sin(x * 1.54) + 0.065 * math.sin(3.61 * x)
            shelf = 0.048 * math.tanh(2.65 * math.sin(5.8 * strata)) + 0.017 * math.sin(15.43 * strata + 0.27 * x)
            roll = 0.020 * math.sin(4.63 * x + 2.49 * y) + 0.010 * math.sin(8.13 * x - 5.88 * y)
            z = 2.211 + 0.448 * (1 - (2 * t - 1) ** 2) + shelf + roll
            # Gently level the last course under the inward jamb face.
            z = 2.29 + (z - 2.29) * eave
            if iy in (0, ny):
                z = min(z, 2.277 + 0.47 * (1 - (2 * t - 1) ** 2))
            row.append(bm.verts.new((x, y, z)))
        rows.append(row)
    for a, b in zip(rows, rows[1:]):
        for iy in range(ny):
            floor = bm.faces.new((a[iy], a[iy + 1], b[iy + 1], b[iy]))
            floor.smooth = True
    edge = (
        rows[0]
        + [row[-1] for row in rows[1:]]
        + list(reversed(rows[-1][:-1]))
        + [row[0] for row in reversed(rows[1:-1])]
    )
    top = [bm.verts.new((v.co.x, v.co.y, 2.948)) for v in edge]
    for i in range(len(edge)):
        n = (i + 1) % len(edge)
        bm.faces.new((edge[n], edge[i], top[i], top[n]))
    bm.faces.new(list(reversed(top)))


def banquette(j):
    cx, cy = -9.468, 8.57
    angles = np.linspace(-1.38, 1.38, 33)

    def sweep(piece, finish, section, sweep_angles=angles):
        profiles = []
        for a in sweep_angles:
            profiles.append([(cx + r * math.cos(a), cy + r * math.sin(a), z + h * math.cos(a)) for r, z, h in section])
        contours(j, piece, finish, profiles, True)

    sweep("sofa_plinth", WALNUT, [(0.380, 0.015, 0), (0.784, 0.015, 0), (0.789, 0.337, 0), (0.38, 0.337, 0)])
    sweep(
        "sofa_seat",
        "bar moss mohair",
        [
            (0.376, 0.337, 0),
            (0.768, 0.337, 0),
            (0.797, 0.356, 0),
            (0.793, 0.447, 0),
            (0.755, 0.476, 0),
            (0.409, 0.476, 0),
            (0.365, 0.450, 0),
            (0.357, 0.368, 0),
        ],
    )
    sweep(
        "sofa_back",
        "bar moss mohair",
        [
            (0.689, 0.445, 0),
            (0.822, 0.445, 0),
            (0.827, 0.776, 0.120),
            (0.810, 0.818, 0.118),
            (0.733, 0.830, 0.118),
            (0.680, 0.799, 0.118),
            (0.658, 0.554, 0.028),
        ],
        np.linspace(-1.362, 1.362, len(angles)),
    )
    for index in range(1, 16):
        a = -1.38 + index * 2.76 / 16
        links = [
            (cx + r * math.cos(a), cy + r * math.sin(a), z + h * math.cos(a))
            for r, z, h in ((0.674, 0.493, 0), (0.657, 0.574, 0.030), (0.675, 0.747, 0.092), (0.689, 0.79, 0.110))
        ]
        for first, last in zip(links, links[1:]):
            j.span("sofa_channels", "bar moss mohair", first, last, 0.0055, 6)
    # A hand-sized welt and a loose sienna cushion soften the built-in bench.
    rings = []
    for t in np.linspace(-math.pi / 2 + 0.015, math.pi / 2 - 0.015, 13):
        points = []
        for a in np.linspace(0, math.tau, 26, endpoint=False):
            c = math.cos(t)
            power = lambda n: math.copysign(abs(n) ** 0.67, n)
            u = 0.163 * power(math.cos(a)) * power(c)
            v = 0.089 * power(math.sin(a)) * power(c)
            w = 0.159 * power(math.sin(t))
            points.append((cx + 0.633 + 0.58 * u - 0.81 * v + 0.12 * w, cy - 0.356 + 0.81 * u + 0.58 * v, 0.632 + w))
        rings.append(points)
    contours(j, "loose_cushion", OXBLOOD, rings, True)


def cabinet(j):
    # The two loudspeakers and the middle case form a single item of joinery.
    # Deep dark recesses behind the LPs give individual sleeves a readable edge.
    j.block("cabinet_plinth", WALNUT, (-12.477, 6.47, 0.005), (-12.052, 9.71, 0.126), 0.024)
    for y in (6.55, 7.45, 8.62, 9.55):
        j.block("cabinet_dividers", WALNUT, (-12.463, y, 0.123), (-12.075, y + 0.036, 0.726), 0.007)
    j.block("cabinet_back", FELT, (-12.466, 6.56, 0.127), (-12.438, 9.60, 2.012))
    for y, toe in ((7.035, 0.095), (9.135, -0.095)):
        j.block("speaker_baffle", FELT, (-12.435, y - 0.532, 0.743), (-12.255, y + 0.532, 1.192), 0.016)
        speaker(j, y, toe)
    for z in (0.123, 0.525, 0.720):
        j.block("lp_shelves", WALNUT, (-12.45, 6.54, z), (-12.025, 9.60, z + 0.032), 0.006)
    rng = random.Random(5347)
    palette = ("bar uncoated paper", "bar moss mohair", OXBLOOD, "celadon glaze", FELT, HORN_EDGE)
    for y0, y1 in ((6.614, 7.40), (7.56, 8.53), (8.72, 9.49)):
        y = y0
        while y < y1 - 0.035:
            width = rng.uniform(0.013, 0.028)
            h = rng.uniform(0.283, 0.312)
            j.block(
                "records",
                rng.choice(palette),
                (-12.325, y, 0.157),
                (-12.056 + rng.uniform(-0.012, 0.011), y + width, 0.157 + h),
            )
            y += width + 0.004
    j.block("listener_console", WALNUT, (-12.438, 7.51, 0.727), (-12.011, 8.61, 0.926), 0.010)
    j.block("listener_console", COPPER, (-12.011, 7.568, 0.772), (-12.002, 8.556, 0.872), 0.004)
    for y in (7.69, 7.77, 8.36, 8.43):
        j.span("amplifier_knobs", DARK, (-12.001, y, 0.816), (-11.976, y, 0.816), 0.025, 16)
    for y in (7.91, 8.14):
        j.block("vu_windows", PARCHMENT, (-12.002, y, 0.793), (-11.999, y + 0.156, 0.849), 0.002)
        j.span("vu_needles", DARK, (-11.997, y + 0.067, 0.800), (-11.997, y + 0.096, 0.836), 0.002, 5)

    # A cross-section framed by one slim lamp connects the turntable and the
    # quarry. The original sediment and its relief continue across the face.
    def disk(depth, radius):
        return [
            (depth, 8.085 + radius / 0.66 * math.cos(t), 1.556 + radius * math.sin(t))
            for t in np.linspace(0, math.tau, 72, endpoint=False)
        ]

    contours(j, "stone_halo", PARCHMENT, [disk(-12.391, 0.287), disk(-12.373, 0.296), disk(-12.363, 0.291)], True)
    contours(j, "stone_medallion", CUT_ROCK, [disk(-12.378, 0.282), disk(-12.350, 0.280), disk(-12.347, 0.275)], True)
    for i, (y, h, r, level) in enumerate(
        (
            (6.80, 0.168, 0.031, 0.755),
            (7.23, 0.193, 0.030, 0.755),
            (8.96, 0.158, 0.035, 0.755),
            (9.29, 0.188, 0.030, 0.755),
        )
    ):
        mat = "bar amber bottle" if i in (1, 2, 4) else "bar olive bottle"
        shape = [
            (r * 0.73, 0),
            (r, 0.009),
            (r, 0.60 * h),
            (r * 0.77, 0.72 * h),
            (r * 0.39, 0.78 * h),
            (r * 0.36, 0.96 * h),
            (r * 0.43, h),
        ]
        j.turned("bottles", mat, (-12.225, y, level), shape, 15)
        j.turned("stoppers", COPPER, (-12.225, y, level + h), [(r * 0.46, 0), (r * 0.42, 0.016)], 12)
    # Low relief behind the horns: a narrow strip of grazing light crosses
    # actual cut strata. The relief continues up into the ceiling cove.
    j.block("strata", CUT_ROCK, (-12.474, 6.36, 1.943), (-12.420, 9.86, 2.291), 0.006)
    j.block("cabinet_crown", WALNUT, (-12.452, 6.49, 1.991), (-12.317, 9.62, 2.041), 0.010)


def counter_outline(inset):
    # A continuous coved island, with a large semicircular return beside the
    # window. The middle eases in so a guest faces the records and the host.
    centre = -11.331
    points = []
    for i in range(12):
        t = i / 11
        points.append((centre + 0.357 - inset - 0.138 * math.sin(math.pi * t) ** 2, 7.215 + t * 1.812))
    r = 0.357 - inset
    for i in range(1, 19):
        a = i * math.pi / 18
        points.append((centre + r * math.cos(a), 9.027 + r * math.sin(a)))
    for i in range(1, 12):
        t = i / 11
        points.append((centre - r - 0.035 * math.sin(math.pi * t), 9.027 - 1.812 * t))
    for i in range(1, 18):
        a = math.pi + i * math.pi / 18
        points.append((centre + r * math.cos(a), 7.215 + r * math.sin(a)))
    return points


def island(j):
    def at(inset, z):
        return [(x, y, z) for x, y in counter_outline(inset)]

    contours(j, "island_base", WALNUT, [at(0.091, 0.008), at(0.084, 0.138), at(0.077, 0.919), at(0.038, 0.977)], True)
    contours(j, "island_apron", COPPER, [at(0.038, 0.967), at(0.028, 0.987)], True)
    contours(j, "bar_top", SOAPSTONE, [at(0.015, 0.981), at(0.000, 1.001), at(0.000, 1.063), at(0.013, 1.078)], True)
    for i in range(46):
        y = 7.226 + i * 1.79 / 45
        t = (y - 7.215) / 1.812
        x = -11.331 + 0.357 - 0.083 - 0.138 * math.sin(math.pi * t) ** 2
        j.span("island_staves", WALNUT, (x, y, 0.154), (x + 0.005, y, 0.899), 0.016, 7)
    for y in (7.29, 8.08, 8.92):
        x = -10.908 - 0.088 * math.sin((y - 7.21) / 1.81 * math.pi) ** 2
        j.span("footrail", COPPER, (x - 0.173, y, 0.145), (x, y, 0.216), 0.012, 10)
    points = [(-10.908 - 0.088 * math.sin(math.pi * i / 15) ** 2, 7.22 + 1.80 * i / 15, 0.216) for i in range(16)]
    for a, b in zip(points, points[1:]):
        j.span("footrail", COPPER, a, b, 0.016, 10)
    for i in range(3):
        y = 7.19 + 0.86 * i
        x = -10.526 - 0.138 * math.sin(math.pi * i / 2) ** 2
        for side in (-1, 1):
            for end in (-1, 1):
                j.span(
                    "stool_legs",
                    WALNUT,
                    (x + side * 0.145, y + end * 0.131, 0.007),
                    (x + side * 0.100, y + end * 0.091, 0.654),
                    0.021,
                    8,
                    tip=0.029,
                )
            j.span(
                "stool_stretchers",
                COPPER,
                (x + side * 0.127, y - 0.113, 0.252),
                (x + side * 0.127, y + 0.113, 0.252),
                0.008,
                8,
            )

        def leather(r, offset):
            points = []
            for a in np.linspace(0, math.tau, 32, endpoint=False):
                c, s = math.cos(a), math.sin(a)
                height = 0.677 + (0.034 + 0.152 * max(c, 0) ** 2 + 0.055 * s * s) * r**2
                points.append((x + 0.225 * r * c, y + 0.221 * r * s, height + offset))
            return points

        sections = [
            leather(0.04, -0.032),
            leather(0.69, -0.034),
            leather(0.97, -0.029),
            leather(1, -0.011),
            leather(0.985, 0),
            leather(0.92, 0.005),
            leather(0.73, 0),
            leather(0.41, -0.003),
            leather(0.04, 0),
        ]
        contours(j, "saddle_seats", OXBLOOD, sections, True)
    # A smoked-glass coupe and a low celadon cup sit on a genuine coaster.
    for y in (7.28, 8.83):
        j.turned("coasters", WALNUT, (-11.27, y, 1.079), [(0.049, 0), (0.049, 0.004)], 18)
    j.turned(
        "glassware",
        "bar amber bottle",
        (-11.27, 7.28, 1.083),
        [
            (0.040, 0),
            (0.040, 0.004),
            (0.006, 0.010),
            (0.005, 0.075),
            (0.019, 0.079),
            (0.051, 0.107),
            (0.056, 0.121),
            (0.053, 0.123),
            (0.047, 0.111),
            (0.014, 0.084),
        ],
        20,
    )
    j.turned(
        "glassware",
        "celadon glaze",
        (-11.27, 8.83, 1.083),
        [(0.026, 0), (0.038, 0.009), (0.041, 0.061), (0.037, 0.064), (0.032, 0.016)],
        15,
    )
