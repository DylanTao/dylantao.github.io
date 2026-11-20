"""Fit the walnut ceiling, cut-stone loggia and sewn cushions to the listening room.

Run in Blender 4.5 on a copy of the fitted loggia. Coordinates are metres in
the native house. The original threshold, glass, heaters and cab remain usable.
"""

import argparse
import math
from pathlib import Path
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import coastal_decor as decor
from coastal_listening_bar import Joinery
from coastal_listening_joinery import CUT_ROCK, OXBLOOD, SOAPSTONE, WALNUT, contours, image_finish, map_finish
from coastal_listening_loggia import FIRE, LAVA, PREFIX, STONE, outline

WEAVE = "listening room undyed basket linen"
TERRACOTTA = "listening room madder cushion"
STRIPE = "listening room tobacco ticking"
WELT = "Loggia · flax welt"
IRON = "Loggia · seasoned cast iron"
ASH = "Loggia · charcoal and ash"
TEAK = "listening room oiled coastal teak"
LIGHT = "Loggia · shielded straw light"
CX, CY = -9.58, 11.12


def paving_material():
    """The embedded albedo represents 95 cm of honed fossil limestone."""
    surface = decor.material("Loggia · sawn fossil limestone", (0.56, 0.52, 0.45), 0.88)
    tree = surface.node_tree
    texture = next((node for node in tree.nodes if node.type == "TEX_IMAGE"), None) or tree.nodes.new("ShaderNodeTexImage")
    path = Path(__file__).resolve().parents[1] / "artwork/coastal-home/materials/loggia-limestone.jpg"
    texture.image = bpy.data.images.load(str(path), check_existing=True)
    texture.image.pack()
    tree.links.new(texture.outputs["Color"], tree.nodes["Principled BSDF"].inputs["Base Color"])
    return surface.name


def map_paving(obj):
    uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name="Sawn metre")
    for face in obj.data.polygons:
        for loop in face.loop_indices:
            x, y, z = obj.data.vertices[obj.data.loops[loop].vertex_index].co
            uv.data[loop].uv = ((x + 0.716 * y) / 1.168, (y - 0.716 * x + z) / 1.168)


def dress_loggia_floor():
    """Lay sawn limestone in four staggered courses, cut to the curved nose."""
    deck = next(ob for ob in bpy.context.scene.objects if ob.name.startswith(PREFIX + "deck__"))
    cove = next(ob for ob in bpy.context.scene.objects if ob.name.startswith(PREFIX + "cove_lamp__"))
    cove["listeningCoveWorld"] = [-12.445, 2.173, -6.400, -9.663, 2.173, -6.400]
    stone = paving_material()
    if deck.get("sawnLimestoneCourses"):
        paving = next(ob for ob in bpy.context.scene.objects if ob.name.startswith(PREFIX + "paving__"))
        map_paving(paving)
        return
    # The original structural slab is the mortar bed. Only its upper ring
    # moves. The fitted flags restore the original walking elevation at +1 mm.
    for vertex in deck.data.vertices:
        if vertex.co.z > -0.001:
            vertex.co.z = -0.019
    j = Joinery(PREFIX, "speakeasy")
    def clip(points, axis, edge, sign):
        result = []
        for a, b in zip(points, points[1:] + points[:1]):
            da, db = sign * (a[axis] - edge), sign * (b[axis] - edge)
            if da >= 0:
                result.append(a)
            if (da > 0 and db < 0) or (da < 0 and db > 0):
                result.append(tuple(a[i] + (b[i] - a[i]) * da / (da - db) for i in range(2)))
        return result

    rows = (10.157, 10.671, 11.208, 11.751, 12.253)
    joints = ((-10.85, -9.58), (-11.37, -10.23, -9.10), (-10.71, -9.46), (-11.25, -10.04, -8.96))
    for (near, far), cuts in zip(zip(rows, rows[1:]), joints):
        bounds = (-11.944, *cuts, -8.416)
        for left, right in zip(bounds, bounds[1:]):
            points = outline()
            for axis, edge, sign in (
                (0, left + 0.002, 1),
                (0, right - 0.002, -1),
                (1, near + 0.002, 1),
                (1, far - 0.002, -1),
            ):
                points = clip(points, axis, edge, sign)
            if len(points) < 3:
                continue
            contours(j, "paving", stone, [[(x, y, z) for x, y in points] for z in (-0.019, 0.001)], smooth=False)
    for _, ob in j.finish():
        map_paving(ob)
        ob["walk"] = "solid"
    deck["sawnLimestoneCourses"] = True


def finishes():
    size = 128
    v, u = np.indices((size, size)) * math.tau / size
    warp = np.sin(17 * u + 0.28 * np.sin(3 * v))
    weft = np.cos(21 * v + 0.21 * np.sin(2 * u))
    weave = 0.49 + 0.07 * warp + 0.06 * weft + 0.04 * warp * weft + 0.055 * np.sin(3 * v + u)
    image_finish(WEAVE, (0.65, 0.57, 0.46), (0.89, 0.83, 0.70), weave, 0.96)
    image_finish(TERRACOTTA, (0.40, 0.205, 0.118), (0.66, 0.369, 0.224), weave, 0.96)
    band = np.minimum(1, np.abs(np.sin(2 * u)) * 5)
    image_finish(STRIPE, (0.38, 0.29, 0.219), (0.77, 0.66, 0.50), 0.55 * band + 0.45 * weave, 0.94)
    grain = u + 0.09 * np.sin(2 * v) + 0.022 * np.cos(5 * v - u)
    image_finish(
        TEAK,
        (0.29, 0.168, 0.09),
        (0.59, 0.393, 0.246),
        0.45 + 0.14 * np.cos(9 * grain) + 0.07 * np.sin(31 * grain),
        0.60,
    )
    decor.material(WELT, (0.48, 0.366, 0.242), 0.95)
    decor.material(IRON, (0.090, 0.079, 0.064), 0.64, 0.32)
    decor.material(ASH, (0.026, 0.023, 0.020), 0.995, refresh=True)
    lamp = decor.material(LIGHT, (0.54, 0.254, 0.093), 0.9)
    shader = lamp.node_tree.nodes["Principled BSDF"]
    shader.inputs["Emission Color"].default_value = (1.0, 0.49, 0.17, 1)
    shader.inputs["Emission Strength"].default_value = 0.64
    pore = 0.045 * np.cos(31 * u + np.sin(9 * v)) * np.sin(37 * v + np.sin(11 * u))
    image_finish(OXBLOOD, (0.33, 0.175, 0.105), (0.535, 0.297, 0.17), 0.49 + pore + 0.085 * np.cos(3 * u - v), 0.58)


def refinish_record_wall():
    # The same figured veneer runs along the ceiling slats and into each
    # acoustic horn. Follow the flare on the horn and the long edge on a slat.
    materials = Path(__file__).resolve().parents[1] / "artwork/coastal-home/materials"
    bell = decor.material("listening room turned walnut", (0.39, 0.214, 0.107), 0.39)
    for surface, name in (
        (bell, "walnut"),
        (bpy.data.materials[WALNUT], "walnut"),
        (bpy.data.materials[SOAPSTONE], "soapstone"),
    ):
        tree = surface.node_tree
        bsdf = tree.nodes["Principled BSDF"]
        texture = next((n for n in tree.nodes if n.type == "TEX_IMAGE"), None) or tree.nodes.new("ShaderNodeTexImage")
        texture.image = bpy.data.images.load(str(materials / ("listening-" + name + ".jpg")), check_existing=True)
        texture.extension = "MIRROR"
        texture.image.pack()
        tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Coat Weight"].default_value = 0.12
        bsdf.inputs["Coat Roughness"].default_value = 0.35
    for ob in bpy.context.scene.objects:
        if not ob.name.startswith(("core_speakeasy_horn_bell__", "core_speakeasy_horn_lip__")):
            continue
        ob.data.materials[0] = bell
        if ob.data.get("radialVeneer"):
            continue
        for item in ob.data.uv_layers.active.data:
            depth, angle = item.uv
            item.uv = (angle, depth)
        ob.data["radialVeneer"] = True


def saddle_backs(j):
    for i in range(3):
        cy = 7.19 + 0.86 * i
        cx = -10.526 - 0.138 * math.sin(math.pi * i / 2) ** 2
        profiles = []
        for k in range(25):
            a = -1.51 + 3.02 * k / 24
            c, s = math.cos(a), math.sin(a)
            z = 0.677 + 0.034 + 0.152 * c * c + 0.055 * s * s
            height = 0.018 + 0.064 * max(0, c) ** 0.78
            points = []
            for r, h in (
                (0.91, -0.014),
                (1, -0.023),
                (1.075, 0.041),
                (1.088, height - 0.013),
                (1.060, height),
                (0.999, height - 0.009),
                (0.951, 0.038),
            ):
                x = cx + 0.225 * r * c
                y = cy + 0.221 * r * s
                points.append((-10.245 - 0.69 * (y - 6.858), 7.21 + 0.92 * (x + 11.331), z + h))
            profiles.append(points)
        contours(j, "saddle_backs", OXBLOOD, profiles)


def surface_uv(obj):
    mesh = obj.data
    uv = mesh.uv_layers.active or mesh.uv_layers.new(name="Finish in metres")
    textile = obj.data.materials[0].name in (WEAVE, TERRACOTTA, STRIPE)
    scale = 0.18 if textile else 0.64
    for face in mesh.polygons:
        axis = max(range(3), key=lambda i: abs(face.normal[i]))
        for loop in face.loop_indices:
            x, y, z = mesh.vertices[mesh.loops[loop].vertex_index].co
            a, b = ((y, z), (x, z), (x, y))[axis]
            uv.data[loop].uv = (a / scale, b / scale)


def ceiling(j):
    # Rays are restricted to the carved soffit. A different rail or a ceiling
    # fixture cannot accidentally drag an entire cutter down into the room.
    vault = next(o for o in bpy.context.scene.objects if o.name.startswith("core_speakeasy_cut_vault__"))
    inverse = vault.matrix_world.inverted()
    for i in range(19):
        spread = i / 18
        rings = []
        for k in range(31):
            t = k / 30
            x = -12.435 + 3.73 * t
            y = 6.44 + 2.15 * spread + (0.12 + 0.96 * spread) * t + 0.10 * math.sin(math.pi * t)
            ok, point, _, _ = vault.ray_cast(inverse @ Vector((x, y, 2.0)), Vector((0, 0, 1)), distance=1)
            if not ok:
                raise ValueError(f"Walnut slat misses vault at {x, y}")
            crown = (vault.matrix_world @ point).z
            depth = 0.055 + 0.022 * t
            z = crown - depth - 0.019
            if z < 2.12:
                raise ValueError(f"Slat too low at {x, y, z}")
            # A narrow sawn arris catches the concealed light. The wider
            # spacing above the listening seat lets the strata show through.
            w = 0.018 + 0.019 * t
            rings.append(
                [
                    (x, y - w, z + 0.007),
                    (x, y - w + 0.005, z),
                    (x, y + w - 0.005, z),
                    (x, y + w, z + 0.007),
                    (x, y + w, crown + 0.008),
                    (x, y - w, crown + 0.008),
                ]
            )
        contours(j, "ceiling_fan", WALNUT, rings, smooth=False)

    # The end-wall course wraps the corner behind the counter into the vault.
    # Its underside follows the existing lintel. The entry to the east stays clear.
    profiles = []
    for i in range(32):
        t = i / 31
        x = -12.456 + 2.80 * t
        profile = []
        ok, hit, _, _ = vault.ray_cast(inverse @ Vector((x, 6.369, 2.0)), Vector((0, 0, 1)), distance=1.0)
        if not ok:
            raise ValueError(f"Stone course misses soffit at {x}")
        top = (vault.matrix_world @ hit).z - 0.011
        for k in range(13):
            z = 0.010 + k * (top - 0.010) / 12
            strata = 0.021 * math.tanh(2.1 * math.sin(z * 13 + 0.33 * math.sin(x * 1.7)))
            profile.append((x, 6.379 + strata + 0.009 * math.sin(z * 5.1 + x * 2), z))
        profiles.append([(x, 6.323, 0.010), *profile, (x, 6.323, top)])
    contours(j, "wall_course", CUT_ROCK, profiles, smooth=False)
    j.block("cove_lamp", LIGHT, (-12.445, 6.378, 2.166), (-9.663, 6.397, 2.173), 0.002)


def eyebrow(j):
    # A shallow cantilever takes bearing on the existing stone head and east
    # cheek. The scalloped seaward edge shelters the doorway, then draws back
    # above the bench, leaving the sky open over its middle and the brazier.
    rings = []
    for i in range(33):
        t = i / 32
        x = -11.89 + 3.44 * t
        reach = 0.43 + 0.59 * (1 - t) ** 3 + 0.46 * t**4 + 0.045 * math.sin(13 * t)
        nose = 10.16 + reach
        z = 2.205 + 0.198 * math.sin(t * math.pi) + 0.035 * math.sin(7 * t)
        rings.append(
            [
                (x, 10.105, 2.190),
                (x, 10.31, z),
                (x, nose - 0.12, z + 0.052),
                (x, nose, z + 0.13),
                (x, nose - 0.035, z + 0.212),
                (x, nose - 0.12, z + 0.303),
                (x, 10.105, 2.785),
            ]
        )
    contours(j, "quarry_eyebrow", CUT_ROCK, rings, smooth=False)


def polar(r, a, z):
    return (CX + r * math.cos(a), CY + r * math.sin(a), z)


def cushion(j, index, start, end):
    # Separate shaped foam pads follow the arc, each with a tiny end seam,
    # a raised crown and a stitched front welt. No flat cap spans the gaps.
    sections = []
    seam = []
    for k in range(17):
        t = k / 16
        a = start + (end - start) * t
        bulge = math.sin(math.pi * t) ** 0.52
        r = 0.631 + 0.024 * (1 - bulge)
        top = 0.468 + 0.027 * bulge + 0.003 * math.sin(index + a * 9)
        sections.append(
            [
                polar(rad, a, z)
                for rad, z in (
                    (r + 0.025, 0.356),
                    (1.042, 0.364),
                    (1.067, 0.391),
                    (1.049, top - 0.028),
                    (0.994, top - 0.010),
                    (0.829, top),
                    (0.697, top - 0.007),
                    (r + 0.004, top - 0.026),
                    (r, 0.405),
                )
            ]
        )
        seam.append(polar(r + 0.002, a, top - 0.029))
    contours(j, "bench_seat", WEAVE, sections)
    for a, b in zip(seam, seam[1:]):
        j.span("bench_welt", WELT, a, b, 0.0026, 6)


def back_pillow(j, piece, finish, angle, radius, width, height, tilt, seed):
    tangent = Vector((-math.sin(angle), math.cos(angle), 0))
    radial = Vector((math.cos(angle), math.sin(angle), 0))
    middle = Vector(polar(radius, angle, 0.470 + height * 0.496))
    depth = 0.075

    def point(u, v, w):
        # Corner pinches and a little slouch catch oblique daylight on fabric.
        absolute = middle + u * width * 0.5 * tangent + radial * (v * depth + w * height * 0.5 * tilt)
        absolute.z += height * 0.5 * w + u * seed * 0.034 - 0.027 * (1 - u * u) * max(0, w)
        return absolute

    def signed(v, power):
        return math.copysign(abs(v) ** power, v)

    rings = []
    for i in range(17):
        latitude = -math.pi * 0.499 + i * math.pi * 0.998 / 16
        row = []
        for k in range(32):
            lon = k * math.tau / 32
            u = signed(math.cos(lon), 0.63) * signed(math.cos(latitude), 0.46)
            w = signed(math.sin(lon), 0.63) * signed(math.cos(latitude), 0.46)
            v = signed(math.sin(latitude), 0.65)
            crease = 0.12 * math.sin(u * 10 + seed + w * 4) * abs(u * w) ** 2
            row.append(point(u, v * (1 - crease), w))
        rings.append(row)
    contours(j, piece, finish, rings)
    for a, b in zip(rings[8], rings[8][1:] + rings[8][:1]):
        j.span("bench_welt", WELT, a, b, 0.0028, 5)


def banquette(j):
    angles = [math.radians(d) for d in (-37, -3, 32, 68, 102)]
    contours(
        j,
        "bench_support",
        STONE,
        [
            [
                polar(r, a, z)
                for r, z in ((1.043, 0.369), (1.102, 0.369), (1.102, 0.772), (1.075, 0.783), (1.029, 0.751))
            ]
            for a in np.linspace(angles[0], angles[-1], 40)
        ],
    )
    for i, (a, b) in enumerate(zip(angles, angles[1:])):
        cushion(j, i, a + 0.008, b - 0.008)
    # A single upholstered sweep carries the sitter's shoulder right around
    # the bend. Only the two loose pillows interrupt its long shadow line.
    sweep = []
    for a in np.linspace(angles[0] + 0.009, angles[-1] - 0.009, 49):
        t = (a - angles[0]) / (angles[-1] - angles[0])
        ease = math.sin(math.pi * t) ** 0.48
        crown = 0.773 + 0.026 * ease
        sweep.append(
            [
                polar(r, a, z)
                for r, z in (
                    (1.051, 0.456),
                    (1.077, 0.495),
                    (1.090, crown - 0.030),
                    (1.069, crown),
                    (1.023, crown + 0.006),
                    (0.986, crown - 0.018),
                    (0.950, 0.685),
                    (0.929, 0.564),
                    (0.943, 0.498),
                    (0.978, 0.464),
                )
            ]
        )
    contours(j, "bench_back", WEAVE, sweep)
    back_pillow(j, "scatter_cushions", TERRACOTTA, math.radians(77), 0.884, 0.40, 0.318, 0.44, 0.9)
    back_pillow(j, "scatter_cushions", STRIPE, math.radians(-20), 0.874, 0.342, 0.266, 0.44, -0.8)
    # Slats have a real joint and a narrow shadow line beneath the upholstery.
    for i in range(51):
        a = angles[0] + (angles[-1] - angles[0]) * (i + 0.5) / 51
        for low, high in ((0.027, 0.200), (0.299, 0.351)):

            def side(t):
                return [polar(r, t, z) for r, z in ((0.906, low), (0.914, low), (0.914, high), (0.906, high))]

            contours(j, "bench_apron", TEAK, [side(a - 0.017), side(a + 0.017)], smooth=False)


def brazier(j):
    def oval(r, z, count=60):
        return [
            (
                FIRE[0] + 0.601 * r * math.cos(i * math.tau / count),
                FIRE[1] + 0.372 * r * math.sin(i * math.tau / count),
                z,
            )
            for i in range(count)
        ]

    contours(
        j,
        "fire_plinth",
        LAVA,
        [
            oval(r, z)
            for r, z in (
                (0.78, 0.005),
                (0.85, 0.030),
                (0.90, 0.236),
                (0.93, 0.276),
                (0.795, 0.269),
                (0.743, 0.229),
                (0.55, 0.192),
                (0.012, 0.182),
            )
        ],
        smooth=False,
    )
    # Separate the basalt seating stone from the narrow iron edge. Its centre
    # slopes down to a bed of broken fuel, with clear space for the live logs.
    contours(
        j,
        "fire_rim",
        IRON,
        [
            oval(r, z)
            for r, z in (
                (0.927, 0.272),
                (0.951, 0.288),
                (0.946, 0.303),
                (0.915, 0.311),
                (0.815, 0.312),
                (0.793, 0.302),
                (0.784, 0.268),
            )
        ],
        caps=False,
    )
    contours(
        j,
        "fire_bed",
        ASH,
        [oval(r, z) for r, z in ((0.785, 0.270), (0.743, 0.241), (0.559, 0.218), (0.29, 0.209), (0.006, 0.207))],
        caps=False,
    )
    rng = np.random.default_rng(612)
    for _ in range(64):
        theta = rng.uniform(0, math.tau)
        dist = math.sqrt(rng.uniform(0.02, 0.99)) * 0.70
        x = FIRE[0] + 0.601 * dist * math.cos(theta)
        y = FIRE[1] + 0.372 * dist * math.sin(theta)
        radius = rng.uniform(0.016, 0.035)
        z = float(np.interp(dist, [0, 0.29, 0.559, 0.743], [0.207, 0.209, 0.218, 0.241])) - 0.002
        rings = []
        widths = rng.uniform(0.77, 1.13, 7)
        for h, r in ((0, 0.64), (0.011, 1), (0.021, 0.76), (0.025, 0.29)):
            rings.append(
                [
                    (
                        x + radius * r * w * math.cos(k * math.tau / 7 + theta),
                        y + radius * r * w * 0.8 * math.sin(k * math.tau / 7 + theta),
                        z + h,
                    )
                    for k, w in enumerate(widths)
                ]
            )
        contours(j, "fire_coals", ASH, rings, smooth=False)


def build():
    scene = bpy.context.scene
    if not any(o.name.startswith(PREFIX + "wind_guard__") for o in scene.objects):
        raise ValueError("This fit requires the existing cliff loggia")
    parts = {
        "ceiling_fan",
        "bench_seat",
        "bench_back",
        "fire_plinth",
        "fire_bed",
        "fire_rim",
        "bench_welt",
        "bench_support",
        "bench_apron",
        "scatter_cushions",
        "fire_coals",
        "quarry_eyebrow",
        "wall_course",
        "cove_lamp",
        "saddle_backs",
    }
    for o in tuple(scene.objects):
        if o.name.startswith(PREFIX) and o.name[len(PREFIX) :].split("__")[0] in parts:
            bpy.data.objects.remove(o, do_unlink=True)
    finishes()
    refinish_record_wall()
    builder = Joinery(PREFIX, "speakeasy")
    ceiling(builder)
    saddle_backs(builder)
    eyebrow(builder)
    banquette(builder)
    brazier(builder)
    for (part, _), mesh in builder.meshes.items():
        if part not in ("fire_rim", "fire_bed"):
            bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
    for part, obj in builder.finish():
        map_finish(obj)
        if obj.data.materials[0].name in (TEAK, WEAVE, TERRACOTTA, STRIPE, OXBLOOD):
            surface_uv(obj)
        if part == "ceiling_fan":
            uv = obj.data.uv_layers.active
            for loop in obj.data.loops:
                x, y, z = obj.data.vertices[loop.vertex_index].co
                uv.data[loop.index].uv = (y / 0.56 + z * 0.13, x / 1.15)
        if part == "fire_bed":
            obj["terraceFireWorld"] = [FIRE[0], 0.214, -FIRE[1]]
        if part in ("ceiling_fan", "bench_welt", "bench_apron", "cove_lamp", "fire_coals"):
            obj["walk"] = "through"
    scene["coastalListeningSewnLoggia"] = 1
    dress_loggia_floor()
    for obj in scene.objects:
        if obj.name.startswith("core_speakeasy_saddle_seats__"):
            surface_uv(obj)
    bpy.context.view_layer.update()
    print(
        "[listening] 19 ceiling slats, continuous back, 4 separate seats, 2 loose cushions, cast iron hearth, 64 fuel fragments",
        flush=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    if Path(bpy.data.filepath).resolve() == args.out.resolve():
        parser.error("Use a separate native output")
    build()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(args.out.resolve()), compress=True)
