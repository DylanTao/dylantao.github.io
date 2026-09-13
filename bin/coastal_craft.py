"""Small-scale architectural craft, authored as editable Blender meshes."""

import math
import random
import bpy
from coastal_sculpt import surface


def potted_plant(group, x, y, z, scale, mats, h):
    """Thin curved leaves, visible stems, soil and a lipped ceramic vessel."""
    pot = h["cylinder"](
        group + "_pot",
        (x, y, z + 0.14 * scale),
        0.16 * scale,
        0.28 * scale,
        mats["terra"],
    )
    for v in pot.data.vertices:
        f = 0.80 + 0.20 * (v.co.z / (0.28 * scale) + 0.5)
        v.co.x *= f
        v.co.y *= f
    h["cylinder"](
        group + "_soil",
        (x, y, z + 0.276 * scale),
        0.143 * scale,
        0.014 * scale,
        mats["ink"],
    )
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.15 * scale,
        minor_radius=0.012 * scale,
        major_segments=24,
        minor_segments=6,
        location=(x, y, z + 0.275 * scale),
    )
    h["finish"](bpy.context.object, group + "_ceramic_lip", mats["terra"])
    for i in range(11):
        a = i * 2.399
        length = (0.25 + 0.025 * (i % 4)) * scale
        height = z + (0.38 + i * 0.034) * scale
        tip = (
            x + math.cos(a) * length,
            y + math.sin(a) * length,
            height + 0.08 * scale,
        )
        h["tube"](
            group + "_stem",
            [
                (x, y, z + 0.27 * scale),
                (
                    x + math.cos(a) * length * 0.35,
                    y + math.sin(a) * length * 0.35,
                    height,
                ),
                tip,
            ],
            0.008 * scale,
            mats["wood"],
            resolution=3,
        )
        verts, faces = [], []
        for j in range(9):
            t = j / 8
            for side in (-1, 0, 1):
                width = math.sin(math.pi * t) ** 0.8 * 0.074 * scale * side
                verts.append(
                    (
                        x
                        + math.cos(a) * length * (0.30 + t * 0.95)
                        - math.sin(a) * width,
                        y
                        + math.sin(a) * length * (0.30 + t * 0.95)
                        + math.cos(a) * width,
                        height
                        + 0.14 * math.sin(t * math.pi * 0.85) * scale
                        - abs(side) * 0.022 * scale,
                    )
                )
        for j in range(8):
            for k in range(2):
                p = j * 3 + k
                faces.append((p, p + 1, p + 4, p + 3))
        leaf = surface(group + "_curved_leaf", verts, faces, mats["leaf"])
        mod = leaf.modifiers.new("leaf thickness", "SOLIDIFY")
        mod.thickness = 0.002 * scale
        bpy.context.view_layer.objects.active = leaf
        bpy.ops.object.modifier_apply(modifier=mod.name)


def furnish(mats, h):
    rng = random.Random(20260912)
    box, cylinder, tube = h["box"], h["cylinder"], h["tube"]
    wood, oak, cream = mats["wood"], mats["oak"], mats["cream"]
    # The planks have bevelled edges and staggered end joints, not painted lines.
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith("core_floorboard"):
            bpy.data.objects.remove(obj, do_unlink=True)
    for col in range(30):
        x = -4.35 + col * 0.30
        y = -2.55
        while y < 3.12:
            length = min(3.12 - y, rng.uniform(1.1, 2.2))
            if length > 0.05:
                box(
                    "core_oak_plank",
                    (x, y + length / 2, -0.006),
                    (0.295, length - 0.009, 0.024),
                    oak,
                    0.004,
                )
            y += length
    # Built-in shelves occupy the study's low dividing wall; the ocean stays open.
    for y in (0.25, 1.4):
        box(
            "study_bookcase_upright", (-1.51, y, 1.05), (0.27, 0.055, 1.82), wood, 0.014
        )
    colors = [cream, mats["terra"], mats["sage"], mats["ink"], oak]
    for level in range(4):
        height = 0.30 + level * 0.44
        box(
            "study_bookcase_shelf",
            (-1.50, 0.82, height),
            (0.34, 1.26, 0.045),
            wood,
            0.012,
        )
        for j in range(11):
            book_h = rng.uniform(0.21, 0.35)
            book = box(
                "study_book_spine",
                (-1.44, 0.33 + j * 0.089, height + 0.025 + book_h / 2),
                (0.19, 0.067, book_h),
                colors[(j + level) % 5],
                0.004,
            )
            if j == 9:
                book.rotation_euler.x = 0.14
            box(
                "study_book_title",
                (-1.341, 0.33 + j * 0.089, height + book_h * 0.76),
                (0.003, 0.039, 0.009),
                cream,
                0,
            )
    # Keyboard, stitched desk mat, a ceramic cup, and fine joinery read in close-up.
    for row in range(4):
        for col in range(11):
            box(
                "study_keycap",
                (-0.14 + col * 0.043, 1.98 + row * 0.043, 0.901),
                (0.034, 0.030, 0.008),
                mats["cream"],
                0.003,
            )
    box(
        "study_trackpad",
        (0.1, 1.919, 0.902),
        (0.15, 0.049, 0.003),
        mats["glass"],
        0.003,
    )
    cylinder("study_cup", (0.61, 2.17, 0.961), 0.069, 0.15, cream, vertices=32)
    coffee = h["material"]("coffee", (0.027, 0.011, 0.004), 0.18)
    cylinder("study_coffee", (0.61, 2.17, 1.037), 0.055, 0.002, coffee)
    tube(
        "study_cup_handle",
        [
            (0.673, 2.17, 1.015),
            (0.721, 2.17, 1.013),
            (0.72, 2.17, 0.94),
            (0.675, 2.17, 0.935),
        ],
        0.013,
        cream,
    )
    for y in (1.962, 2.474):
        box("study_desktop_lip", (0.15, y, 0.776), (2.36, 0.025, 0.035), wood, 0.01)
    # Keep the mug clear of the record deck and the interactive research papers.
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(("study_cup", "study_coffee")):
            obj.location.x -= 1.60
    # Material seams give the kitchen a believable cabinet scale.
    for x in (-3.96, -3.29, -2.62):
        box(
            "kitchen_shaker_door",
            (x, -0.697, 0.4),
            (0.635, 0.035, 0.67),
            mats["sage"],
            0.01,
        )
        box(
            "kitchen_inset_panel",
            (x, -0.721, 0.4),
            (0.52, 0.014, 0.53),
            mats["sage"],
            0.006,
        )
    # Warm practical fixtures are modeled here and lit by the runtime.
    lamp = h["material"]("warm paper lantern", (0.95, 0.66, 0.34), 0.8)
    bs = lamp.node_tree.nodes["Principled BSDF"]
    bs.inputs["Emission Color"].default_value = (1, 0.53, 0.19, 1)
    bs.inputs["Emission Strength"].default_value = 0.45
    for group, loc in [
        ("kitchen", (-3.3, -2.96, 1.90)),
        ("lounge", (2.14, -1.42, 0.79)),
    ]:
        cylinder(group + "_lantern", loc, 0.11, 0.27, lamp)
        for i in range(10):
            a = i * math.tau / 10
            tube(
                group + "_lantern_rib",
                [
                    (
                        loc[0] + math.cos(a) * 0.111,
                        loc[1] + math.sin(a) * 0.111,
                        loc[2] - 0.13,
                    ),
                    (
                        loc[0] + math.cos(a) * 0.111,
                        loc[1] + math.sin(a) * 0.111,
                        loc[2] + 0.13,
                    ),
                ],
                0.0025,
                oak,
                resolution=2,
            )
    # A jute rug settles the lounge furniture on the floor.
    rug = h["material"]("woven jute", (0.34, 0.25, 0.145), 0.96)
    cylinder("lounge_woven_rug", (3.05, -0.91, 0.015), 1.09, 0.017, rug, vertices=80)
    for i in range(48):
        r = 0.12 + i * 0.02
        tube(
            "lounge_rug_braid",
            [
                (
                    3.05 + r * math.cos(j * math.tau / 80),
                    -0.91 + r * math.sin(j * math.tau / 80),
                    0.026,
                )
                for j in range(81)
            ],
            0.004,
            rug,
            resolution=1,
        )
    # An irregular stone rim replaces the smooth plastic torus.
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(("onsen_rim", "onsen_base")):
            bpy.data.objects.remove(obj, do_unlink=True)
    cylinder(
        "onsen_foundation", (3.02, 1.82, 0.14), 1.065, 0.28, mats["edge"], vertices=72
    )
    for i in range(22):
        a0 = i * math.tau / 22 + 0.008
        a1 = (i + 1) * math.tau / 22 - 0.008
        outer = 1.08 + rng.uniform(-0.04, 0.045)
        inner = 0.845 + rng.uniform(-0.007, 0.007)
        top = 0.49 + rng.uniform(-0.025, 0.025)
        points = [
            (3.02 + inner * math.cos(a0), 1.82 + inner * math.sin(a0)),
            (3.02 + outer * math.cos(a0), 1.82 + outer * math.sin(a0)),
            (3.02 + outer * math.cos(a1), 1.82 + outer * math.sin(a1)),
            (3.02 + inner * math.cos(a1), 1.82 + inner * math.sin(a1)),
        ]
        h["polygon_slab"](
            "onsen_carved_stone", points, 0.15, top, mats["edge"], segments=2
        )
    # A folded cloth has a draping surface and rolled hem rather than a solid brick.
    verts, faces = [], []
    for j in range(13):
        for i in range(19):
            u, v = i / 18, j / 12
            verts.append(
                (
                    3.9 + u * 0.43,
                    1.21 + v * 0.31,
                    0.352
                    + 0.014 * math.sin(u * math.pi * 7) * math.sin(v * math.pi)
                    + 0.012 * math.sin(v * math.pi),
                )
            )
    for j in range(12):
        for i in range(18):
            p = j * 19 + i
            faces.append((p, p + 1, p + 20, p + 19))
    surface("onsen_folded_linen", verts, faces, cream)
