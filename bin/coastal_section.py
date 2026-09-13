"""Two inhabited storeys carved into one continuous mainland cliff.

Blender is Z-up, the Pacific is +Y. Floor heights and room translations are
also recorded in the web manifest. The shore is a continuous section along X,
not an island or a separate mountain behind a pedestal.
"""

import math
import random
import bpy
import bmesh
from mathutils import Vector
from coastal_sculpt import surface
from coastal_interiors import curved_wall


import json
from pathlib import Path

CONFIG = json.loads(
    (
        Path(__file__).resolve().parents[1] / "assets/models/home/manifest.json"
    ).read_text()
)
RISE = max(r["floor"] for r in CONFIG["rooms"])
OFFSETS = {
    r["id"]: (r["offset"][0], -r["offset"][2], r["offset"][1]) for r in CONFIG["rooms"]
}


def shoreline(x):
    return (
        5.7
        + 1.2 * math.sin(x * 0.12)
        + 7.5 * math.exp(-(((x - 24) / 10) ** 2))
        + 3.3 * math.exp(-(((x + 22) / 7) ** 2))
    )


def cliff_surface(x, z):
    t = max(0, min(1, (z + 8.4) / 18))
    relief = (
        0.54 * math.sin(x * 1.7 + z * 0.24)
        + 0.24 * math.sin(x * 4.4 - z * 0.71)
        + 0.13 * math.sin(x * 9 + z * 1.7)
    ) * math.sin(math.pi * t) ** 0.6
    return shoreline(x) + relief


def cliff_normals(obj):
    normals = []
    for face in obj.data.polygons:
        front = all(
            abs(v.co.y - cliff_surface(v.co.x, v.co.z)) < 0.12
            for v in (obj.data.vertices[i] for i in face.vertices)
        )
        face.use_smooth = front
        for index in face.loop_indices:
            v = obj.data.vertices[obj.data.loops[index].vertex_index].co
            if front:
                dx = (
                    cliff_surface(v.x + 0.005, v.z) - cliff_surface(v.x - 0.005, v.z)
                ) / 0.01
                dz = (
                    cliff_surface(v.x, v.z + 0.005) - cliff_surface(v.x, v.z - 0.005)
                ) / 0.01
                normals.append(tuple(Vector((-dx, 1, -dz)).normalized()))
            else:
                normals.append((0, 0, 0))
    obj.data.normals_split_custom_set(normals)


def beach_width(x):
    shore = CONFIG.get("beach", {"width": 14, "bulge": 6, "ripple": 1.2})
    return (
        shore["width"]
        + shore["bulge"] * math.exp(-(((x - 9) / 11) ** 2))
        + shore["ripple"] * math.sin(x * 0.19)
    )


def rehouse(mats, h):
    """Move fitted room contents as groups before batching, then build floors."""
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith("core_") or obj.name == "anchor_outside":
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        group = obj.name.split("_")[0]
        if obj.name.startswith("anchor_"):
            group = obj.name.split("_")[1]
        if group == "records":
            group = "study"
        if group in OFFSETS:
            dx, dy, dz = OFFSETS[group]
            obj.location.x += dx
            obj.location.y += dy
            obj.location.z += dz

    for room in CONFIG["rooms"]:
        anchor = bpy.data.objects.get("anchor_" + room["id"])
        if anchor:
            x, y, z = room["actor"]
            anchor.location = (x, -z, y)
    box, tube, slab = h["box"], h["tube"], h["polygon_slab"]
    oak, stone, plaster = mats["oak"], mats["edge"], mats["plaster"]
    lower = [
        (-4.8, -5.35),
        (4.8, -5.35),
        (4.8, 3.7),
        (4.3, 4.8),
        (-3.95, 4.8),
        (-4.8, 4.0),
    ]
    slab("core_ground_floor", lower, -0.28, -0.022, stone)
    # The front notch is the stair opening; the rear landing is continuous.
    upper = [
        (-4.7, -5.3),
        (4.7, -5.3),
        (4.7, -1.30),
        (2.16, -1.30),
        (2.16, -2.7),
        (1.07, -2.7),
        (1.07, -1.30),
        (-4.7, -1.30),
    ]
    slab("core_upper_floor", upper, RISE - 0.24, RISE - 0.022, plaster)
    rng = random.Random(19)
    # Separate fitted boards make the two elevations unambiguous in close-up.
    for upper_floor, y0, y1, height in (
        (False, -5.2, 4.45, 0),
        (True, -5.15, -1.3, RISE),
    ):
        for col in range(31):
            x = -4.5 + col * 0.30
            y = y0
            while y < y1:
                length = min(y1 - y, rng.uniform(1.2, 2.3))
                if upper_floor and 1.07 < x < 2.16 and y + length > -2.7:
                    length = max(0, -2.7 - y)
                if length > 0.04:
                    box(
                        "core_fitted_floorboard",
                        (x, y + length / 2, height - 0.009),
                        (0.294, length - 0.007, 0.023),
                        oak,
                        0.003,
                    )
                y += max(length, 0.5)

    # A real 15-riser stair, 1.02 m clear width, with closed risers and continuous
    # stringers. Its centerline is the only route between floors in the runtime.
    n, start, end, sx = 15, 1.20, -2.70, 1.615
    depth = (start - end) / n
    for i in range(n):
        z = (i + 1) * RISE / n
        y = start - (i + 0.5) * depth
        box(
            "core_stair_closed_riser",
            (sx, y, z / 2),
            (1.04, depth + 0.008, z),
            plaster,
            0.012,
        )
        box(
            "core_stair_oak_tread",
            (sx, y + 0.008, z - 0.014),
            (1.085, depth + 0.025, 0.028),
            oak,
            0.006,
        )
    for x in (1.06, 2.17):
        tube(
            "core_stair_handrail",
            [
                (x, start + 0.1, 0.88),
                (x, end, RISE + 0.88),
                (x, end - 0.45, RISE + 0.88),
            ],
            0.027,
            mats["wood"],
        )
        for i in range(0, n, 3):
            y = start - (i + 0.5) * depth
            z = (i + 1) * RISE / n
            box(
                "core_stair_baluster",
                (x, y, z + 0.43),
                (0.023, 0.023, 0.86),
                mats["brass"],
                0.006,
            )
    # Upper balcony rail follows the floor edge and leaves the stair open.
    for xa, xb in ((-4.6, 1.04), (2.19, 4.55)):
        tube(
            "core_gallery_rail",
            [(xa, -1.31, RISE + 0.83), (xb, -1.31, RISE + 0.83)],
            0.032,
            mats["wood"],
        )
        for i in range(round((xb - xa) / 0.65) + 1):
            x = xa + i * (xb - xa) / max(1, round((xb - xa) / 0.65))
            box(
                "core_gallery_spindle",
                (x, -1.31, RISE + 0.42),
                (0.023, 0.023, 0.82),
                mats["brass"],
                0.006,
            )

    # The rooms are alcoves, with rounded returns and long views through the
    # atrium. Lower storage belongs under the gallery, not an empty void.
    for x in (-1.78, 1.87):
        path = [
            (x + 0.06 * math.sin(i / 12 * math.pi), -5.12 + i / 12 * 1.6)
            for i in range(13)
        ]
        curved_wall(
            "core_upper_alcove_return",
            [(x, y, RISE, RISE + 1.18) for x, y in path],
            plaster,
            0.12,
        )
    for x in (-4.72, 4.72):
        path = [(x, -5.2), (x * 0.995, -4.7), (x * 0.97, -4.3)]
        curved_wall(
            "core_rounded_back_return",
            [(x, y, RISE, RISE + 2.12) for x, y in path],
            plaster,
            0.16,
        )
    # Shallow cupboards line the sheltered part of the lower storey.
    for i in range(10):
        x = -4.17 + i * 0.80
        box(
            "core_lower_storage",
            (x, -4.97, 0.92),
            (0.77, 0.42, 1.80),
            mats["sage"],
            0.035,
        )
        box(
            "core_cupboard_pull",
            (x + 0.25, -4.743, 1.0),
            (0.018, 0.025, 0.18),
            mats["brass"],
            0.007,
        )
    # A pale kitchen wall provides a casual home for the shared capybara print.
    curved_wall(
        "kitchen_print_wall",
        [
            (x, y, 0, 2.15)
            for x, y in [(-4.45, -0.17), (-3.9, -0.32), (-2.4, -0.32), (-1.75, -0.12)]
        ],
        plaster,
        0.16,
    )
    # Gym battens behind the power rack, underneath the upper gallery.
    for i in range(25):
        box(
            "gym_oak_backing",
            (-1.43 + i * 0.119, -0.14, 1.15),
            (0.046, 0.04, 2.22),
            mats["wood"],
            0.008,
        )
    for x in (-4.1, 3.9):
        h["potted_plant"]("core", x, -3.25, 0, 1.1, mats, h)


def coast(mats, h):
    """A shared shoreline section closes foundation, roof, land and beach."""
    rock = h["material"]("eroded coastal sandstone", (0.43, 0.34, 0.235), 0.91)
    sand = h["material"]("dry beach sand", (0.76, 0.64, 0.45), 0.98)
    wet = h["material"]("wet tideline sand", (0.43, 0.37, 0.27), 0.38)
    scrub = h["material"]("coastal sage scrub", (0.22, 0.29, 0.13), 0.95)
    nx, ny = 192, 32
    xmin, xmax = -36, 76
    xs = [xmin + (xmax - xmin) * i / nx for i in range(nx + 1)]
    objects = []

    def mass(name, bottom, top, upper):
        verts, faces = [], []
        # Two matched terrain grids make a closed manifold before carving.
        for layer in (0, 1):
            for j in range(ny + 1):
                t = j / ny
                for x in xs:
                    y = -32 + (shoreline(x) + 32) * t
                    z = bottom
                    if layer:
                        z = top
                        if upper:
                            inland = 1 - t
                            z += (
                                1.3 * inland
                                + 0.45 * math.sin(x * 0.28 + y * 0.19)
                                + 0.15 * math.sin(x * 1.7 - y * 0.9)
                            )
                            z += 1.6 * math.exp(-(((x - 24) / 14) ** 2))
                    y += (cliff_surface(x, z) - shoreline(x)) * t**8
                    verts.append((x, y, z))
        block = (nx + 1) * (ny + 1)
        for layer in (0, 1):
            for j in range(ny):
                for i in range(nx):
                    p = layer * block + j * (nx + 1) + i
                    face = (p, p + 1, p + nx + 2, p + nx + 1)
                    faces.append(face if layer else tuple(reversed(face)))
        for j in (0, ny):
            if j == ny:
                front = []
                for row in range(33):
                    t = row / 32
                    line = []
                    for x in xs:
                        ztop = top
                        if upper:
                            ztop += (
                                0.45 * math.sin(x * 0.28 + shoreline(x) * 0.19)
                                + 0.15 * math.sin(x * 1.7 - shoreline(x) * 0.9)
                                + 1.6 * math.exp(-(((x - 24) / 14) ** 2))
                            )
                        z = bottom + (ztop - bottom) * t
                        line.append(len(verts))
                        verts.append((x, cliff_surface(x, z), z))
                    front.append(line)
                for row in range(32):
                    for i in range(nx):
                        faces.append(
                            (
                                front[row][i + 1],
                                front[row][i],
                                front[row + 1][i],
                                front[row + 1][i + 1],
                            )
                        )
                continue
            for i in range(nx):
                p = j * (nx + 1) + i
                face = (p, p + 1, p + 1 + block, p + block)
                faces.append(face if j == 0 else tuple(reversed(face)))
        for i in (0, nx):
            for j in range(ny):
                p = j * (nx + 1) + i
                face = (p, p + nx + 1, p + nx + 1 + block, p + block)
                faces.append(tuple(reversed(face)) if i == 0 else face)
        obj = surface(name, verts, faces, rock, smooth=False)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.0001)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        if bm.calc_volume(signed=True) < 0:
            bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        return obj

    base = mass("coast_continuous_cliff_foundation", -8.4, -0.26, False)
    cliff_normals(base)
    objects.append(base)
    roof = mass("core_carved_mainland", -0.26, 6.25, True)
    roof.data.materials.append(mats["plaster"])
    # Carve a full-depth arched dwelling into that same mass. Roof, jambs and
    # foundation share coordinates; there is no gap or separate scenic arch.
    arch = [(-4.94, -0.40), (4.94, -0.40)]
    arch += [
        (
            5.08 * math.cos(a * math.pi / 64),
            0.04 + 5.67 * math.sin(a * math.pi / 64) ** 0.36,
        )
        for a in range(65)
    ]
    verts = [(x, y, z) for y in (-5.48, 25) for x, z in arch]
    n = len(arch)
    faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    cutter = surface("dwelling excavation tool", verts, faces, mats["plaster"])
    for obj in (roof, cutter):
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.0001)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        if bm.calc_volume(signed=True) < 0:
            bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
    bpy.context.view_layer.objects.active = roof
    boolean = roof.modifiers.new("carved two storey home", "BOOLEAN")
    boolean.operation, boolean.solver, boolean.object = "DIFFERENCE", "EXACT", cutter
    bpy.ops.object.modifier_apply(modifier=boolean.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    bpy.context.view_layer.update()
    hit, location, _, _ = roof.ray_cast(Vector((0, 20, 2)), Vector((0, -1, 0)))
    assert hit and location.y < -5.3, f"Excavation is not open: {location}"
    print("Cave excavation verified", tuple(location), flush=True)
    # Only lift the local ceiling for an interior cutaway. Keep the actual
    # mainland, back wall and side jambs visible; hiding the whole landmass
    # exposed an enormous flat foundation behind the rooms.
    ceiling_faces = []
    shell_faces = []
    coordinates = [tuple(v.co) for v in roof.data.vertices]
    for face in roof.data.polygons:
        c = face.center
        bucket = (
            ceiling_faces
            if abs(c.x) < 5.8 and c.y > -5.47 and c.z > 3.8
            else shell_faces
        )
        bucket.append((tuple(face.vertices), face.material_index))

    def piece(name, selected):
        obj = surface(name, coordinates, [f for f, _ in selected], rock, smooth=False)
        obj.data.materials.append(mats["plaster"])
        for face, (_, material_index) in zip(obj.data.polygons, selected):
            face.material_index = material_index
        cliff_normals(obj)
        return obj

    top = piece("core_liftaway_cave_ceiling", ceiling_faces)
    top["caveRoof"] = True
    piece("core_continuous_mainland_and_cave_walls", shell_faces)
    bpy.data.objects.remove(roof, do_unlink=True)
    # Beach is one long sloping shore. It joins the foot of the very same cliff
    # and disappears below the water instead of ending as a polygonal ring.
    verts, faces, rows = [], [], 20
    for j in range(rows + 1):
        t = j / rows
        for x in xs:
            y = shoreline(x) - 0.35 + t * beach_width(x)
            z = -6.82 - 1.13 * t + 0.04 * math.sin(x * 0.6 + t * 2)
            verts.append((x, y, z))
    for j in range(rows):
        for i in range(nx):
            p = j * (nx + 1) + i
            faces.append((p, p + 1, p + nx + 2, p + nx + 1))
    beach = surface("coast_long_sloping_beach", verts, faces, sand)
    beach.data.materials.append(wet)
    for face in beach.data.polygons:
        face.material_index = int(face.center.z < -7.13)
    objects.append(beach)
    rng = random.Random(93)
    for i in range(65):
        x = rng.uniform(-18, 40)
        y = shoreline(x) + rng.uniform(0.5, 3.4)
        obj = h["sphere"](
            "coast_talus",
            (x, y, -6.95),
            (
                0.18 + rng.random() * 0.4,
                0.15 + rng.random() * 0.3,
                0.12 + rng.random() * 0.3,
            ),
            rock,
            segments=12,
        )
        objects.append(obj)
    for i in range(95):
        x = rng.uniform(-15, 38)
        y = rng.uniform(-12, -6.4)
        t = (y + 32) / (shoreline(x) + 32)
        z = (
            6.25
            + 1.3 * (1 - t)
            + 0.45 * math.sin(x * 0.28 + y * 0.19)
            + 0.15 * math.sin(x * 1.7 - y * 0.9)
            + 1.6 * math.exp(-(((x - 24) / 14) ** 2))
        )
        obj = h["sphere"](
            "core_clifftop_sage",
            (x, y, z + 0.12),
            (0.24, 0.22, 0.18),
            scrub,
            segments=12,
        )
    return objects
