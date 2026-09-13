"""Fitted cave architecture and a usable miniature strength-training room."""

import math
import bpy
from coastal_sculpt import surface


def curved_wall(name, path, mat, thickness=0.20):
    """A solid carved ribbon; path samples are x, y, bottom, top."""
    vertices, faces = [], []
    for i, (x, y, bottom, top) in enumerate(path):
        before, after = path[max(0, i - 1)], path[min(len(path) - 1, i + 1)]
        dx, dy = after[0] - before[0], after[1] - before[1]
        length = max(0.001, math.hypot(dx, dy))
        nx, ny = -dy / length * thickness / 2, dx / length * thickness / 2
        vertices += [
            (x + nx, y + ny, bottom),
            (x - nx, y - ny, bottom),
            (x - nx, y - ny, top),
            (x + nx, y + ny, top),
        ]
    for i in range(len(path) - 1):
        for j in range(4):
            a, b = 4 * i + j, 4 * i + (j + 1) % 4
            faces.append((a, b, b + 4, a + 4))
    faces += [(3, 2, 1, 0), tuple(range(len(vertices) - 4, len(vertices)))]
    obj = surface(name, vertices, faces, mat)
    bpy.context.view_layer.objects.active = obj
    bevel = obj.modifiers.new("rounded carved edges", "BEVEL")
    bevel.width, bevel.segments = 0.06, 3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return obj


def architecture(mats, h):
    # A shallow scalloped wall replaces the freestanding flat partition.
    path = []
    for i in range(121):
        x = -4.62 + 9.24 * i / 120
        y = -3.15 - 0.23 * (0.5 + 0.5 * math.cos(x * math.tau / 3.15))
        top = 2.52 + 0.29 * math.cos(x * math.pi / 9.5)
        path.append((x, y, -0.05, top))
    curved_wall("core_scalloped_mountain_wall", path, mats["plaster"], 0.36)
    # Low, gently bowed fins leave the shared central circulation open.
    for side in (-1, 1):
        path = []
        for i in range(41):
            t = i / 40
            x = side * (1.67 + 0.09 * math.sin(t * math.pi))
            y = 0.14 + t * 3.05
            top = 0.51 + 0.40 * t + 0.12 * math.sin(t * math.pi)
            path.append((x, y, -0.015, top))
        curved_wall("core_flowing_room_division", path, mats["plaster"], 0.23)
    # Rounded plaster returns tie the back-wall recesses into the cave sides.
    for side in (-1, 1):
        path = []
        for i in range(25):
            t = i / 24
            a = t * math.pi / 2
            path.append(
                (
                    side * (3.91 + 0.57 * math.cos(a)),
                    -2.58 - 0.61 * math.sin(a),
                    -0.02,
                    2.47 + t * 0.09,
                )
            )
        curved_wall("core_rounded_alcove_return", path, mats["plaster"], 0.20)
    # A thin continuous timber sill meets the room partitions at the ocean opening.
    h["box"]("core_windowseat", (0, 3.32, 0.10), (8.9, 0.45, 0.22), mats["edge"], 0.10)
    # A carved recess around the kitchen print and little resting shelf.
    # It is framed by a shallow arch, with open air between the arch and print.
    for x in (-3.77, -2.53):
        h["box"](
            "kitchen_print_niche_jamb",
            (x, -3.08, 1.43),
            (0.095, 0.12, 1.04),
            mats["edge"],
            0.04,
        )
    h["tube"](
        "kitchen_print_niche_arch",
        [
            (-3.77, -3.08, 1.93),
            (-3.60, -3.08, 2.22),
            (-3.15, -3.08, 2.31),
            (-2.70, -3.08, 2.22),
            (-2.53, -3.08, 1.93),
        ],
        0.052,
        mats["edge"],
    )
    h["box"](
        "kitchen_print_shelf",
        (-3.15, -3.04, 0.99),
        (1.38, 0.33, 0.075),
        mats["oak"],
        0.032,
    )
    # Narrow oak lining gives the strength-training alcove a different scale.
    for i in range(25):
        x = -1.43 + i * 0.119
        y = -3.15 - 0.23 * (0.5 + 0.5 * math.cos(x * math.tau / 3.15)) + 0.18
        h["box"](
            "gym_acoustic_oak_batten",
            (x, y, 1.26),
            (0.045, 0.036, 2.31),
            mats["wood"],
            0.008,
        )


def gym(mats, h):
    box, tube, cylinder = h["box"], h["tube"], h["cylinder"]
    steel = h["material"]("powder coated gym steel", (0.045, 0.064, 0.063), 0.44, 0.52)
    rubber = h["material"]("gym rubber", (0.026, 0.030, 0.028), 0.91)
    padding = h["material"]("saddle bench upholstery", (0.21, 0.095, 0.046), 0.72)
    chrome = h["material"]("barbell brushed steel", (0.42, 0.46, 0.46), 0.26, 0.86)
    # Rubber tiles follow the alcove, leaving the main aisle at y > -0.35 free.
    for col in range(3):
        for row in range(3):
            box(
                "gym_rubber_tile",
                (-0.93 + col * 0.93, -2.57 + row * 0.88, 0.024),
                (0.924, 0.874, 0.048),
                rubber,
                0.007,
            )
    # Full rack: front and rear columns, pull-up bar, safeties and J-cups.
    for x in (-0.81, 0.81):
        for y in (-2.94, -2.13):
            box("gym_rack_upright", (x, y, 1.08), (0.085, 0.085, 2.08), steel, 0.01)
            box("gym_rack_foot", (x, y, 0.065), (0.25, 0.24, 0.036), steel, 0.01)
            for dx in (-0.075, 0.075):
                cylinder(
                    "gym_rack_anchor_bolt",
                    (x + dx, y, 0.09),
                    0.013,
                    0.018,
                    chrome,
                    vertices=6,
                )
            for z in [0.37 + j * 0.095 for j in range(17)]:
                pin = cylinder(
                    "gym_adjustment_socket",
                    (x, y + 0.044, z),
                    0.012,
                    0.005,
                    rubber,
                    vertices=12,
                )
                pin.rotation_euler.x = math.pi / 2
        box(
            "gym_rack_depth_brace", (x, -2.535, 2.08), (0.082, 0.90, 0.082), steel, 0.01
        )
        box("gym_safety_arm", (x, -2.47, 0.80), (0.082, 1.01, 0.065), steel, 0.01)
        box("gym_j_cup", (x, -2.04, 1.35), (0.095, 0.17, 0.036), steel, 0.009)
        box("gym_j_cup_lip", (x, -1.973, 1.38), (0.095, 0.029, 0.080), steel, 0.008)
    tube("gym_pullup_bar", [(-0.81, -2.13, 2.11), (0.81, -2.13, 2.11)], 0.024, chrome)
    box("gym_rear_crossmember", (0, -2.94, 0.30), (1.7, 0.07, 0.085), steel, 0.01)

    # Actual weight disks with separate hubs, sleeves and safety collars.
    def barbell(name, center, length, plate_r, axis="X", plates=2):
        x, y, z = center

        def axial(part, offset, r, depth, mat):
            loc = (x + offset, y, z) if axis == "X" else (x, y + offset, z)
            obj = cylinder(name + part, loc, r, depth, mat, vertices=32)
            if axis == "X":
                obj.rotation_euler.y = math.pi / 2
            else:
                obj.rotation_euler.x = math.pi / 2

        axial("_shaft", 0, 0.017 if length > 1 else 0.014, length, chrome)
        for side in (-1, 1):
            offset = length * (0.405 if length > 1 else 0.36)
            axial("_sleeve", side * offset, 0.03, length * 0.18, chrome)
            for j in range(plates):
                at = side * (offset - j * 0.06)
                axial("_plate", at, plate_r * (1 - j * 0.13), 0.052, rubber)
                axial("_plate_hub", at + side * 0.028, plate_r * 0.29, 0.008, chrome)
                axial(
                    "_plate_label",
                    at + side * 0.034,
                    plate_r * 0.19,
                    0.004,
                    mats["sage"],
                )
            axial("_collar", side * (offset + 0.05), 0.042, 0.026, steel)

    barbell("gym_racked_barbell", (0, -2.025, 1.405), 2.27, 0.205)
    # Adjustable bench aligned beneath the racked bar, with a clear workout bay.
    for y in (-2.77, -1.81):
        box("gym_bench_base", (0, y, 0.08), (0.60, 0.085, 0.065), steel, 0.018)
        for x in (-0.27, 0.27):
            box(
                "gym_bench_rubber_foot",
                (x, y, 0.065),
                (0.09, 0.11, 0.07),
                rubber,
                0.012,
            )
    box("gym_bench_spine", (0, -2.29, 0.18), (0.065, 1.1, 0.08), steel, 0.014)
    for y in (-2.58, -1.90):
        box("gym_bench_support", (0, y, 0.29), (0.07, 0.07, 0.29), steel, 0.008)
    box("gym_bench_backrest", (0, -2.48, 0.47), (0.41, 0.78, 0.115), padding, 0.04)
    box("gym_bench_seat", (0, -1.91, 0.45), (0.39, 0.30, 0.11), padding, 0.038)
    tube(
        "gym_bench_stitch",
        [
            (-0.173, -2.8, 0.529),
            (-0.173, -2.16, 0.529),
            (0.173, -2.16, 0.529),
            (0.173, -2.8, 0.529),
            (-0.173, -2.8, 0.529),
        ],
        0.0015,
        mats["cream"],
    )
    # A two-tier dumbbell stand at the side of the free exercise space.
    for y in (-1.50, -0.54):
        box(
            "gym_dumbbell_stand_leg",
            (1.14, y, 0.37),
            (0.055, 0.055, 0.66),
            steel,
            0.012,
        )
        box(
            "gym_dumbbell_stand_foot",
            (1.14, y, 0.07),
            (0.40, 0.12, 0.06),
            rubber,
            0.012,
        )
    for level in (0.31, 0.63):
        for x in (0.98, 1.29):
            box("gym_dumbbell_tray", (x, -1.02, level), (0.09, 1.1, 0.04), steel, 0.008)
        for i in range(3):
            barbell(
                "gym_stored_dumbbell",
                (1.14, -1.38 + i * 0.35, level + 0.093),
                0.42,
                0.08 + i * 0.011,
                plates=1,
            )
    h["empty"]("anchor_gym", (0, -1.10, 0.048))
