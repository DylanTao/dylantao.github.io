"""Plant the actual clifftop at the new stair. Run in Blender with --save-as=FILE."""

import math
from pathlib import Path
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import coastal_decor as decor
from coastal_bath_roji import blade
from coastal_garden_refuge import blob

PREFIX = "core_entry_landscape_"
PALETTE = {
    "sandstone": ((0.57, 0.47, 0.345), 0.91),
    "stone_seat": ((0.54, 0.444, 0.338), 0.73),
    "bark": ((0.22, 0.166, 0.126), 0.88),
    "leaf": ((0.142, 0.220, 0.116), 0.76),
    "leaf_light": ((0.241, 0.289, 0.145), 0.81),
    "grass": ((0.24, 0.32, 0.313), 0.87),
    "grass_light": ((0.39, 0.404, 0.305), 0.85),
    "seedheads": ((0.42, 0.215, 0.097), 0.92),
    "berries": ((0.52, 0.107, 0.048), 0.67),
}


def rock_surface(scene):
    owner = scene.objects["core__golden coastal sandstone"]
    points = [owner.matrix_world @ v.co for v in owner.data.vertices]
    tree = BVHTree.FromPolygons(points, [p.vertices[:] for p in owner.data.polygons])

    def ground(x, y):
        p, _, _, _ = tree.ray_cast(Vector((x, y, 16)), Vector((0, 0, -1)), 18)
        if p is None:
            raise ValueError(f"Entrance garden ends at the actual cliff at {(x,y)}")
        return p.z

    return ground


def branch(bm, a, b, base, tip):
    delta = b - a
    frame = (
        Matrix.Translation((a + b) * 0.5)
        @ delta.to_track_quat("Z", "Y").to_matrix().to_4x4()
    )
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=7,
        radius1=base,
        radius2=tip,
        depth=delta.length,
        matrix=frame,
    )


def toyon(mesh, ground, rng):
    # A spreading asymmetric crown leans away from the 2.2 m descent.
    # Below head height all three stems stay in the uphill bed.
    foot = Vector((-2.68, -30.61, ground(-2.68, -30.61) - 0.028))
    trunks = [(-0.67, 0.35, 2.7), (0.23, -0.27, 3.18), (-0.18, -0.55, 2.38)]
    for j, xyz in enumerate(trunks):
        end = foot + Vector(xyz)
        elbow = foot + Vector((xyz[0] * 0.37 + 0.13 * j, xyz[1] * 0.13, xyz[2] * 0.39))
        branch(
            mesh["bark"],
            foot + Vector((0.055 * j, 0, 0)),
            elbow,
            0.092 - 0.011 * j,
            0.067 - 0.009 * j,
        )
        branch(mesh["bark"], elbow, end, 0.067 - 0.009 * j, 0.030)
        for k in range(5):
            ang = k * math.tau / 5 + j * 1.81
            a = elbow.lerp(end, 0.33 + 0.12 * k)
            b = a + Vector(
                (
                    math.cos(ang) * 0.53 - 0.12,
                    math.sin(ang) * 0.64,
                    0.59 + rng.random() * 0.27,
                )
            )
            branch(mesh["bark"], a, b, 0.031, 0.011)
            for n in range(4):
                angle = ang + (n - 1.6) * 0.58
                twig = b + Vector(
                    (
                        0.52 * math.cos(angle) - 0.06,
                        0.49 * math.sin(angle),
                        rng.uniform(0.09, 0.38),
                    )
                )
                branch(mesh["bark"], b, twig, 0.012, 0.0035)
                for s in range(11):
                    pos = b.lerp(twig, 0.14 + 0.074 * s)
                    direction = angle + (-1 if s % 2 else 1) * rng.uniform(0.57, 1.18)
                    tip = pos + Vector(
                        (
                            0.189 * math.cos(direction),
                            0.189 * math.sin(direction),
                            rng.uniform(-0.045, 0.065),
                        )
                    )
                    blade(
                        mesh["leaf_light" if (j + k + s) % 5 == 0 else "leaf"],
                        pos,
                        tip,
                        0.052,
                    )
                # Sun falls through the gaps between sprays. These terminal
                # rosettes give the crown a leaf silhouette at arrival distance.
                for leaf_index in range(5):
                    a = angle + (leaf_index - 2) * 0.63
                    tip = twig + Vector(
                        (
                            0.174 * math.cos(a),
                            0.174 * math.sin(a),
                            0.115 - 0.037 * abs(leaf_index - 2),
                        )
                    )
                    blade(
                        mesh["leaf_light" if leaf_index == 2 else "leaf"],
                        twig,
                        tip,
                        0.044,
                    )
                if (n + k) % 3 == 0:
                    for g in range(4):
                        at = twig + Vector(
                            (
                                rng.uniform(-0.035, 0.035),
                                rng.uniform(-0.038, 0.038),
                                rng.uniform(-0.047, 0.0),
                            )
                        )
                        blob(
                            mesh["berries"],
                            at,
                            (0.012, 0.014, 0.014),
                            rng,
                            0.03,
                            subdivisions=1,
                        )


def drifts(mesh, ground, rng):
    # Broad planted masses flank the portal. Seedheads sit only at the
    # ends of a drift, leaving a quiet gap in front of the waiting seat.
    beds = (
        (-3.35, -29.75, 1.26, 1.46, 21),
        (-2.10, -27.0, 0.60, 1.35, 15),
        (3.23, -30.65, 0.97, 0.90, 19),
    )
    for n, (cx, cy, rx, ry, count) in enumerate(beds):
        for i in range(count):
            a = i * 2.39996323
            d = math.sqrt((i + 0.5) / count)
            x, y = cx + rx * d * math.cos(a), cy + ry * d * math.sin(a)
            origin = Vector((x, y, ground(x, y) - 0.012))
            h = rng.uniform(0.28, 0.50)
            for k in range(18):
                angle = k * 2.39996323 + rng.uniform(-0.23, 0.23)
                along = Vector((math.cos(angle), math.sin(angle), 0))
                root = origin + along * rng.uniform(0.012, 0.082)
                knee = root + along * h * 0.29 + Vector((0, 0, h * 0.64))
                end = (
                    root
                    + along * h * rng.uniform(0.57, 0.89)
                    + Vector((0, 0, h * rng.uniform(0.65, 1.08)))
                )
                target = mesh["grass_light" if k % 5 == 0 else "grass"]
                # Continuous paired planes produce a taper that catches light.
                side = Vector((-along.y, along.x, 0)) * 0.010
                pts = [
                    target.verts.new(p)
                    for p in (
                        root - side,
                        root + side,
                        knee + side * 0.71,
                        knee - side * 0.71,
                        end,
                    )
                ]
                target.faces.new((pts[0], pts[1], pts[2], pts[3]))
                target.faces.new((pts[3], pts[2], pts[4]))
            if i % 3 == 0 and (n == 1 or x > cx or y > cy):
                for k in range(5):
                    at = origin + Vector(
                        (
                            rng.uniform(-0.10, 0.10),
                            rng.uniform(-0.11, 0.11),
                            rng.uniform(0.38, 0.55),
                        )
                    )
                    decor.cylinder(mesh["seedheads"], origin, at, 0.0034, 4)
                    blob(
                        mesh["seedheads"],
                        at,
                        (0.031, 0.028, 0.017),
                        rng,
                        0.14,
                        subdivisions=1,
                    )


def paving(mesh, ground):
    # A side path reaches the stone seat. The centre of the first landing
    # belongs to the visitor route and stays at the architect's elevation.
    stones = [
        (1.72, -31.63, 0.35, 0.25),
        (2.31, -31.53, 0.36, 0.25),
        (2.91, -31.39, 0.36, 0.24),
    ]
    for x, y, rx, ry in stones:
        corners = [
            (x + u * rx, y + v * ry)
            for u, v in (
                (-0.91, -0.58),
                (-0.34, -1),
                (0.70, -0.83),
                (1, 0.12),
                (0.70, 0.83),
                (-0.53, 0.92),
                (-1, 0.29),
            )
        ]
        z = max(ground(x1, y1) for x1, y1 in corners) + 0.024
        prism(mesh["sandstone"], corners, z - 0.12, z)
    # A curved cheek rises to sitting height on the inland return. Tapered
    # end blocks and a dry seam between pieces describe the actual joinery.
    for i in range(6):

        def edge(t, r):
            a = math.radians(12 + 99 * t)
            return (2.15 + math.cos(a) * r, -30.52 - math.sin(a) * r)

        t0, t1 = (i + 0.016) / 6, (i + 0.984) / 6
        pts = [edge(t0, 0.89), edge(t1, 0.89), edge(t1, 1.32), edge(t0, 1.32)]
        z = min(ground(x, y) for x, y in pts)
        prism(mesh["stone_seat"], pts, z - 0.028, max(8.70, z + 0.43))

    # The cut at the stair head reads from the garden as a retaining wall.
    # Its two cheeks turn into the beds, with the high end against the portal
    # and a low end where the planting and the sea can come into view.
    for side, inner in ((-1, -1.73), (1, 1.47)):
        for i in range(5):
            t0, t1 = (i + 0.018) / 5, (i + 0.982) / 5

            def p(t, s):
                return (
                    inner + side * (2.1 * t + 0.15 * s),
                    -31.77 + 1.47 * t * t + 0.34 * s,
                )

            pts = [p(t0, 0), p(t1, 0), p(t1, 1), p(t0, 1)]
            ground_z = min(ground(x, y) for x, y in pts)
            h = (1 - (t0 + t1) * 0.5) ** 1.6
            prism(
                mesh["sandstone"],
                pts,
                ground_z - 0.025,
                max(ground_z + 0.16, 8.52 + 1.41 * h),
            )


def prism(bm, points, bottom, top):
    rings = [[bm.verts.new((x, y, z)) for x, y in points] for z in (bottom, top)]
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(rings[1])
    for i in range(len(points)):
        j = (i + 1) % len(points)
        bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i]))


def build(scene):
    if not scene.objects.get("core_arrival_B_portal_plinth"):
        raise ValueError("The portal and its clear approach establish this garden")
    for obj in tuple(scene.objects):
        if obj.name.startswith(PREFIX):
            bpy.data.objects.remove(obj, do_unlink=True)
    ground = rock_surface(scene)
    mesh = {key: bmesh.new() for key in PALETTE}
    rng = random.Random(20261119)
    toyon(mesh, ground, rng)
    drifts(mesh, ground, rng)
    paving(mesh, ground)
    for x, y, a, b, h in [
        (-3.68, -31.26, 0.50, 0.36, 0.22),
        (-2.84, -31.44, 0.37, 0.26, 0.16),
        (3.55, -30.40, 0.28, 0.23, 0.15),
    ]:
        blob(
            mesh["sandstone"],
            (x, y, ground(x, y) + 0.02),
            (a, b, h),
            rng,
            0.12,
            subdivisions=2,
        )
    for role, bm in mesh.items():
        color, rough = PALETTE[role]
        obj = decor.from_bmesh(
            PREFIX + role,
            bm,
            decor.material("Entry garden · " + role.replace("_", " "), color, rough),
            smooth=role not in ("stone_seat", "sandstone"),
        )
        obj["installationGroup"] = "exterior"
        if role in (
            "leaf",
            "leaf_light",
            "berries",
            "grass",
            "grass_light",
            "seedheads",
        ):
            obj["walk"] = "through"
        # Protect the whole width of arrival at standing height, including
        # the part of the tree that leans closest to the stair.
        for v in obj.data.vertices:
            if (
                -0.92 < v.co.x < 1.31
                and -31.99 < v.co.y < -27
                and 8.15 < v.co.z < 10.10
            ):
                raise ValueError(f"{obj.name} enters the arrival clearance")
    bpy.context.view_layer.update()


if __name__ == "__main__":
    build(bpy.context.scene)
    destination = next(
        arg.split("=", 1)[1] for arg in sys.argv if arg.startswith("--save-as=")
    )
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(
        filepath=str(Path(destination).resolve()), compress=True
    )
