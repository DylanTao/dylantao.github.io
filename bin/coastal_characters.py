"""Reference-led adult human silhouettes on the shared Sirui animation rig.

The likeness is authored geometry: shaped jaws, inset eyes, side-parted locks,
relaxed sleeves and sewn shoes. Coordinates match the existing contact rig.
"""

import math
import bpy
from coastal_sculpt import surface, loft, swept_lock, weld_sculpt


def refine_human(pieces, style, width, head_z, head_scale, h):
    for obj, _ in pieces:
        bpy.data.objects.remove(obj, do_unlink=True)
    pieces = []
    mats = {m.name: m for m in bpy.data.materials}
    skin, hair, shirt = mats["skin"], mats["long black hair"], mats["Sirui shirt"]
    pants, white, ink = mats["olive trousers"], mats["warm white"], mats["ink details"]
    short, yellow, lanky, natural = (
        style == x for x in ("south-park", "simpsons", "rick-and-morty", "ghibli")
    )
    sphere, tube, box = h["sphere"], h["tube"], h["box"]
    hx, hy, hz = head_scale

    def part(obj, bone="Head"):
        pieces.append((obj, bone))
        return obj

    def smooth(obj, levels=1):
        bpy.context.view_layer.objects.active = obj
        sub = obj.modifiers.new("relaxed surface", "SUBSURF")
        sub.levels = levels
        bpy.ops.object.modifier_apply(modifier=sub.name)
        return obj

    hair.diffuse_color = (0.012, 0.014, 0.017, 1)
    hair.node_tree.nodes["Principled BSDF"].inputs[
        "Base Color"
    ].default_value = hair.diffuse_color
    hair.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.56
    strand = h["material"]("soft hair ridges", (0.022, 0.024, 0.028), 0.56)
    iris = h["material"]("warm brown iris", (0.10, 0.053, 0.025), 0.50)
    lip = h["material"]("quiet lip crease", (0.23, 0.10, 0.064), 0.82)
    sole = h["material"]("canvas sneaker sole", (0.65, 0.62, 0.54), 0.85)

    # A square-soft chin and tapered temples keep the natural face adult.
    profile = [
        (-1.0, 0.28, 0.27),
        (-0.88, 0.56, 0.56),
        (-0.69, 0.83, 0.76),
        (-0.39, 0.98, 0.92),
        (-0.04, 1.0, 1.0),
        (0.30, 0.98, 0.97),
        (0.62, 0.91, 0.84),
        (0.85, 0.70, 0.62),
        (1.0, 0.25, 0.24),
        (1.025, 0.035, 0.04),
    ]
    if short:
        profile = [
            (-0.97, 0.23, 0.20),
            (-0.85, 0.60, 0.54),
            (-0.57, 0.88, 0.78),
            (-0.2, 1.0, 0.95),
            (0.2, 1.0, 1.0),
            (0.55, 0.87, 0.91),
            (0.83, 0.57, 0.66),
            (1.0, 0.08, 0.09),
        ]
    if yellow:
        profile = [
            (-1.0, 0.43, 0.45),
            (-0.86, 0.73, 0.79),
            (-0.5, 0.93, 0.98),
            (0, 0.98, 1.0),
            (0.5, 0.99, 0.98),
            (0.83, 0.80, 0.76),
            (1.02, 0.12, 0.14),
        ]
    face = smooth(
        loft(
            "shaped adult face",
            [(head_z + l * hz, 0, -0.015, hx * wx, hy * wy) for l, wx, wy in profile],
            skin,
            48,
        ),
        2,
    )
    face_parts = [face]
    for side in (-1, 1):
        ear = sphere(
            "ear helix",
            (side * hx * 0.98, -0.003, head_z - 0.015),
            (0.034 if natural else 0.043, 0.031, 0.058),
            skin,
            segments=24,
        )
        face_parts.append(ear)
    eye_x = 0.14 if short else 0.112 if yellow or lanky else 0.076
    eye_y = -0.232 if short else -0.174 if yellow or lanky else -0.158
    eye_z = head_z + 0.042
    eye_r = 0.11 if short else 0.09 if yellow or lanky else 0.045
    # A continuous nose bridge; the Simpsons study keeps its distinctive long tip.
    if natural:
        nose = loft(
            "nose bridge",
            [
                (head_z - 0.067, 0, eye_y - 0.014, 0.023, 0.018),
                (head_z - 0.035, 0, eye_y - 0.032, 0.027, 0.033),
                (head_z + 0.01, 0, eye_y - 0.009, 0.016, 0.026),
                (head_z + 0.072, 0, eye_y + 0.005, 0.013, 0.014),
            ],
            skin,
            24,
        )
    else:
        nose = sphere(
            "cartoon nose",
            (0, eye_y - (0.035 if yellow else 0.012), head_z - 0.015),
            (
                (0.050, 0.11, 0.048)
                if yellow
                else (0.021, 0.051, 0.062) if lanky else (0.024, 0.027, 0.029)
            ),
            skin,
            segments=28,
        )
    face_parts.append(nose)
    face = part(
        weld_sculpt(
            face_parts, "sculpted adult Sirui face", 0.0038 if natural else 0.005
        )
    )
    part(
        smooth(
            loft(
                "natural neck",
                [
                    (1.065, 0, 0.015, 0.079, 0.075),
                    (1.13, 0, 0.018, 0.071, 0.072),
                    (max(1.14, head_z - hz * 0.71), 0, 0.015, 0.074, 0.066),
                ],
                skin,
                28,
            )
        ),
        "Spine",
    )

    for side, name in ((-1, "L"), (1, "R")):
        x = side * eye_x
        depth = 0.013 if natural else 0.046
        vertical = eye_r * (0.59 if natural else 0.98)
        part(
            sphere(
                "inset eye " + name,
                (x, eye_y, eye_z),
                (eye_r, depth, vertical),
                white,
                segments=28,
            ),
            "Eye." + name,
        )
        pupil_y = eye_y - depth * 0.95
        if natural:
            part(
                sphere(
                    "iris " + name,
                    (x + 0.001, pupil_y - 0.002, eye_z),
                    (0.018, 0.005, 0.020),
                    iris,
                    segments=24,
                ),
                "Eye." + name,
            )
        pupil_r = 0.011 if natural else 0.013 if short else 0.015
        part(
            sphere(
                "pupil " + name,
                (x + 0.003, pupil_y - 0.006, eye_z),
                (pupil_r, 0.004, pupil_r * 1.10),
                ink,
                segments=20,
            ),
            "Eye." + name,
        )
        part(
            sphere(
                "eye light " + name,
                (x - 0.002, pupil_y - 0.010, eye_z + 0.007),
                (0.0035, 0.002, 0.004),
                white,
                segments=12,
            ),
            "Eye." + name,
        )
        if natural:
            for sign in (-1, 1):
                pts = [
                    (
                        x + eye_r * math.cos(a * math.pi / 16),
                        eye_y - 0.005 - depth * math.sin(a * math.pi / 16),
                        eye_z + sign * vertical * math.sin(a * math.pi / 16),
                    )
                    for a in range(17)
                ]
                part(
                    tube("soft eyelid", pts, 0.0036 if sign > 0 else 0.0024, skin),
                    "Eye." + name,
                )
        r = eye_r + (0.018 if natural else 0.011)
        glasses_y = eye_y - (0.036 if natural else 0.056)
        pts = [
            (
                x + r * math.cos(a * math.tau / 48),
                glasses_y,
                eye_z + r * math.sin(a * math.tau / 48),
            )
            for a in range(49)
        ]
        part(
            tube(
                "round wire glasses",
                pts,
                0.0032 if natural else 0.0042,
                mats["wire spectacles"],
            )
        )
        part(
            tube(
                "glasses arm",
                [
                    (x + side * r, glasses_y, eye_z),
                    (side * (hx + 0.007), -0.015, eye_z),
                    (side * hx, 0.019, eye_z - 0.012),
                ],
                0.0035,
                mats["wire spectacles"],
            )
        )
        # Brows sit on the forehead, above the lens, with a calm uneven arch.
        bz = eye_z + r + (0.024 if natural else 0.018)
        part(
            swept_lock(
                "tapered eyebrow",
                [
                    (x - 0.047, eye_y + 0.020, bz),
                    (x - 0.016, eye_y + 0.007, bz + 0.011),
                    (x + 0.018, eye_y + 0.009, bz + 0.009),
                    (x + 0.050, eye_y + 0.023, bz - 0.003),
                ],
                [0.002, 0.006, 0.006, 0.0015],
                hair,
                width=1.2,
                sides=8,
            )
        )
    r = eye_r + (0.018 if natural else 0.011)
    part(
        tube(
            "spectacle bridge",
            [
                (-eye_x + r, glasses_y, eye_z + 0.004),
                (0, glasses_y - 0.005, eye_z + 0.014),
                (eye_x - r, glasses_y, eye_z + 0.004),
            ],
            0.0035,
            mats["wire spectacles"],
        )
    )
    # Recess the smile into the face, avoiding the old dark lip pasted on top.
    mouth_z = head_z - (0.109 if natural else 0.142)
    mouth_y = -0.015 - hy * (0.87 if natural else 0.90 if not short else 0.82)
    if natural:
        part(
            tube(
                "quiet asymmetric smile",
                [
                    (-0.049, mouth_y + 0.004, mouth_z + 0.007),
                    (-0.019, mouth_y - 0.006, mouth_z - 0.001),
                    (0.015, mouth_y - 0.007, mouth_z),
                    (0.048, mouth_y + 0.002, mouth_z + 0.008),
                ],
                0.0025,
                lip,
            )
        )
    else:
        mw, mh = (0.09, 0.035) if short else (0.087, 0.055) if lanky else (0.076, 0.03)
        cutter = sphere(
            "smile cavity tool",
            (0, mouth_y - 0.014, mouth_z),
            (mw, 0.075, mh),
            None,
            segments=32,
        )
        for vertex in cutter.data.vertices:
            vertex.co.z += 0.025 * (vertex.co.x / mw) ** 2
        bpy.context.view_layer.objects.active = face
        cut = face.modifiers.new("smile cavity", "BOOLEAN")
        cut.operation, cut.object = "DIFFERENCE", cutter
        bpy.ops.object.modifier_apply(modifier=cut.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
        part(
            sphere(
                "smile interior",
                (0, mouth_y + 0.035, mouth_z),
                (mw * 0.91, 0.057, mh * 0.91),
                mats["mouth"],
                segments=24,
            )
        )
        for i in range(4 if short else 5):
            x = (i - (1.5 if short else 2)) * mw * 0.29
            part(
                box(
                    "small upper tooth",
                    (x, mouth_y - 0.023, mouth_z + mh * 0.36 + 0.025 * (x / mw) ** 2),
                    (mw * 0.275, 0.010, mh * 0.49),
                    white,
                    0.004,
                )
            )

    # A rounded scalp cap with an exposed forehead and a true off-centre sweep.
    verts, faces, rows, cols = [], [], 18, 72
    for row in range(rows + 1):
        for j in range(cols):
            a = j * math.tau / cols
            front = max(0, math.cos(a))
            end = 1.85 - 0.83 * front**1.5 + 0.06 * math.sin(a)
            polar = 0.025 + row / rows * end
            wave = 0.002 * math.sin(a * 8 + polar * 3)
            verts.append(
                (
                    hx * 1.065 * math.sin(polar) * math.sin(a),
                    0.017 - (hy * 1.08 + wave) * math.sin(polar) * math.cos(a),
                    head_z + hz * 1.05 * math.cos(polar) + 0.004 * math.sin(a * 2),
                )
            )
    for row in range(rows):
        for j in range(cols):
            a, b = row * cols + j, row * cols + (j + 1) % cols
            faces.append((a, a + cols, b + cols, b))
    cap = part(surface("rounded swept scalp", verts, faces, hair))
    bpy.context.view_layer.objects.active = cap
    solid = cap.modifiers.new("scalp volume", "SOLIDIFY")
    solid.thickness = 0.012
    bpy.ops.object.modifier_apply(modifier=solid.name)
    # Broad overlapping S-curves break up the silhouette; no remeshed wig cylinder.
    for i in range(17):
        a = 1.22 + i * (math.tau - 2.42) / 16
        points = []
        for k, (level, spread) in enumerate(
            [
                (0.83, 0.63),
                (0.45, 0.99),
                (-0.05, 1.075),
                (-0.49, 1.11),
                (-0.88, 1.15),
                (-1.11, 1.29),
                (-1.15, 1.40),
            ]
        ):
            sweep = a + 0.12 * math.sin(k * 1.17 + i * 0.43)
            points.append(
                (
                    math.sin(sweep) * hx * spread,
                    0.036
                    - math.cos(sweep) * (hy * spread + 0.014)
                    + max(0, -level) * 0.025,
                    head_z + hz * level + 0.019 * math.sin(i * 1.7 + k * 0.83),
                )
            )
        radii = [0.009, 0.021, 0.025, 0.026, 0.024, 0.012, 0.0008]
        part(
            swept_lock(
                "tapered shoulder wave", points, radii, hair, width=1.7, sides=12
            )
        )
        if i % 2 == 0:
            shifted = [(x * 1.028, y * 1.028, z + 0.003) for x, y, z in points]
            part(
                swept_lock(
                    "quiet strand ridge",
                    shifted,
                    [0.0004, 0.001, 0.0012, 0.001, 0.001, 0.0005, 0.0001],
                    strand,
                    width=1.5,
                    sides=6,
                )
            )
    # The longer fringe travels from the right part across the crown to the left temple.
    for i in range(7):
        t = i / 6
        points = [
            (
                hx * (0.38 + t * 0.17),
                -hy * (0.12 + t * 0.15),
                head_z + hz * (0.98 - t * 0.075),
            ),
            (hx * -0.16, -hy * (0.47 + t * 0.14), head_z + hz * (0.98 - t * 0.085)),
            (-hx * 0.74, -hy * (0.50 + t * 0.12), head_z + hz * (0.72 - t * 0.15)),
            (-hx * 1.02, -hy * (0.35 + t * 0.23), head_z + hz * (0.34 - t * 0.18)),
            (-hx * 1.06, -hy * (0.18 + t * 0.19), head_z - hz * (0.02 + t * 0.22)),
        ]
        part(
            swept_lock(
                "side parted fringe",
                points,
                [0.010, 0.023, 0.025, 0.016, 0.0005],
                hair,
                width=1.3,
                sides=12,
            )
        )
    # Relaxed cotton: sloping shoulders, open short sleeves and a subtle waist.
    torso = loft(
        "relaxed cotton torso",
        [
            (0.686, 0, 0.007, width * 0.89, 0.12),
            (0.73, 0, 0.010, width * 0.92, 0.131),
            (0.82, 0, 0.003, width * 0.85, 0.124),
            (0.93, 0, 0, width * 0.95, 0.133),
            (1.014, 0, 0, width, 0.13),
            (1.055, 0, 0, width * 0.81, 0.114),
            (1.083, 0, 0, 0.086, 0.078),
        ],
        shirt,
        40,
    )
    shirts = [torso]
    for side, name in ((-1, "L"), (1, "R")):
        shoulder, wrist = side * (width + 0.022), side * (width + 0.070)
        sleeve = loft(
            "sloping cotton sleeve",
            [
                (0.92, shoulder + side * 0.03, 0, 0.06, 0.074),
                (0.945, shoulder + side * 0.019, 0, 0.066, 0.079),
                (1.006, shoulder - side * 0.014, 0, 0.066, 0.087),
                (1.046, shoulder - side * 0.045, 0, 0.051, 0.071),
            ],
            shirt,
            28,
        )
        shirts.append(sleeve)
        ar = 0.043 if lanky else 0.058 if short else 0.049
        arm = loft(
            "tapered forearm and upper arm",
            [
                (0.553, wrist, -0.027, ar * 0.66, ar * 0.72),
                (0.64, wrist, -0.021, ar * 0.76, ar * 0.82),
                (0.715, wrist, -0.010, ar, ar),
                (0.82, side * (width + 0.065), 0, ar * 0.87, ar * 0.88),
                (0.89, shoulder + side * 0.024, 0, ar * 1.05, ar),
                (0.965, shoulder, 0, ar * 1.10, ar * 1.04),
            ],
            skin,
            28,
        )
        hand_parts = [
            smooth(arm),
            sphere("palm", (wrist, -0.030, 0.555), (0.042, 0.03, 0.066), skin),
        ]
        fingers = 3 if short else 4
        for j in range(fingers):
            x = wrist + (j - (fingers - 1) / 2) * 0.017
            hand_parts.append(
                swept_lock(
                    "resting finger",
                    [
                        (x, -0.034, 0.535),
                        (x, -0.05, 0.507 - 0.005 * (j % 2)),
                        (x, -0.057, 0.489),
                        (x, -0.047, 0.484),
                    ],
                    [0.010, 0.011, 0.009, 0.006],
                    skin,
                    sides=8,
                )
            )
        hand_parts.append(
            swept_lock(
                "relaxed thumb",
                [
                    (wrist - side * 0.031, -0.032, 0.578),
                    (wrist - side * 0.052, -0.040, 0.554),
                    (wrist - side * 0.046, -0.050, 0.53),
                ],
                [0.016, 0.014, 0.008],
                skin,
                sides=10,
            )
        )
        arm = weld_sculpt(hand_parts, "continuous relaxed arm", 0.0045)
        arm["blendArm"] = name
        part(arm, "Forearm." + name)
        hip, leg_w = side * 0.11, 0.057 if lanky else 0.098 if short else 0.079
        leg = smooth(
            loft(
                "tapered olive trousers",
                [
                    (0.113, hip, 0.008, leg_w * 0.86, 0.070),
                    (0.145, hip, 0.01, leg_w * 0.98, 0.081),
                    (0.20, hip, 0, leg_w * 0.88, 0.077),
                    (0.37, hip, 0, leg_w, 0.086),
                    (0.52, hip, 0, leg_w * 1.12, 0.101),
                    (0.675, hip, 0.01, leg_w * 1.18, 0.115),
                ],
                pants,
                28,
            )
        )
        leg["blendLeg"] = name
        part(leg, "Thigh." + name)
        shoe_w = 0.074 if not short else 0.086
        # Lofted canvas uppers with a separate rounded sole and actual laces.
        part(
            smooth(
                loft(
                    "rounded sneaker sole",
                    [
                        (0.007, hip, -0.064, shoe_w * 0.78, 0.14),
                        (0.020, hip, -0.064, shoe_w, 0.15),
                        (0.047, hip, -0.06, shoe_w, 0.15),
                        (0.055, hip, -0.055, shoe_w * 0.94, 0.14),
                    ],
                    sole,
                    36,
                )
            ),
            "Foot." + name,
        )
        part(
            smooth(
                loft(
                    "canvas shoe upper",
                    [
                        (0.04, hip, -0.052, shoe_w * 0.94, 0.144),
                        (0.075, hip, -0.039, shoe_w * 0.91, 0.127),
                        (0.11, hip, -0.009, shoe_w * 0.75, 0.074),
                        (0.128, hip, 0.003, shoe_w * 0.68, 0.059),
                    ],
                    white,
                    36,
                )
            ),
            "Foot." + name,
        )
        for j in range(4):
            y = -0.106 + j * 0.019
            z = 0.090 + j * 0.006
            part(
                tube(
                    "cotton shoelace",
                    [
                        (hip - 0.032, y, z),
                        (hip, y + 0.009, z + 0.008),
                        (hip + 0.032, y + 0.003, z),
                    ],
                    0.0032,
                    sole,
                ),
                "Foot." + name,
            )
    cotton = weld_sculpt(shirts, "relaxed sewn shirt", 0.005)
    cotton["blendShirt"] = width
    part(cotton, "Spine")
    part(
        tube(
            "ribbed crew neck",
            [
                (
                    0.083 * math.cos(a * math.tau / 36),
                    0.075 * math.sin(a * math.tau / 36),
                    1.083,
                )
                for a in range(37)
            ],
            0.006,
            shirt,
        ),
        "Spine",
    )
    return pieces
