"""Build the original La Jolla footer miniature in Blender 4.5.

Run blender --background --python bin/build_la_jolla.py
Coordinates are Blender Z-up. Exported web coordinates are (x, z, -y).
The coast is an authored place collage, not a geographic reconstruction.
"""

from pathlib import Path
import json
import math
import random
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'bin'))
OUT = ROOT / "assets/models/la-jolla"
SOURCE = ROOT / "artwork/la-jolla"
for directory in (OUT, SOURCE):
    directory.mkdir(parents=True, exist_ok=True)
if "--render-only" in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE / "la-jolla.blend"))
    scene = bpy.context.scene
    scene.camera.location = (5, -38, 18)
    scene.camera.rotation_euler = (
        (Vector((0, 0, 2)) - scene.camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    bpy.context.preferences.filepaths.save_version = 0
    scene.camera.data.ortho_scale = 40.5
    scene.render.resolution_x, scene.render.resolution_y = 2000, 720
    for name in ('Geisel','Salk'):
        o = bpy.data.objects.get(name)
        if o:
            for child in [o,*o.children_recursive]: child.hide_render = True
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "la-jolla.blend"))
    scene.render.filepath = str(SOURCE / "la-jolla-day.png")
    bpy.ops.render.render(write_still=True)
    sys.exit(0)
random.seed(29)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, rgb, rough=0.7, metal=0, glow=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*rgb, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if glow:
        p.inputs["Emission Color"].default_value = (*rgb, 1)
        p.inputs["Emission Strength"].default_value = glow
    return m


plaster = material("Chalk plaster", (0.83, 0.77, 0.65))
white = material("Limestone trim", (0.95, 0.9, 0.76))
rose = material("Dusty rose stucco", (0.69, 0.40, 0.29))
peach = material("Apricot stucco", (0.85, 0.60, 0.40))
sage = material("Sage shutters", (0.24, 0.38, 0.29))
roof = material("Terracotta", (0.59, 0.235, 0.13))
tile_alt = material("Sunlit clay", (0.76, 0.35, 0.19))
wood = material("Warm oak", (0.35, 0.20, 0.11))
dark = material("Charcoal anodized fins", (0.11, 0.155, 0.16), 0.5, 0.18)
glass = material("Pacific blue glazing", (0.18, 0.36, 0.40), 0.24, 0.38)
glass2 = material("Sky in glass", (0.31, 0.49, 0.50), 0.23, 0.3)
window = material("Village glazing", (0.14, 0.25, 0.25), 0.28, 0.2)
concrete = material("Board formed concrete", (0.54, 0.56, 0.53))
rockmats = [
    material("Sandstone stratum " + str(i), c)
    for i, c in enumerate(
        [(0.57, 0.43, 0.30), (0.65, 0.52, 0.36), (0.76, 0.63, 0.45), (0.83, 0.71, 0.53)]
    )
]
sand = material("Fine dry sand", (0.85, 0.76, 0.59))
wet = material("Tidal sand", (0.58, 0.60, 0.46))
grass = material("Coastal groundcover", (0.42, 0.49, 0.27))
leaf = material("Palm frond", (0.20, 0.34, 0.17))
leaf2 = material("New palm frond", (0.35, 0.46, 0.22))
ocean = material("Pacific water", (0.20, 0.48, 0.52), 0.24, 0.18)
foam = material("Sea foam", (0.82, 0.94, 0.86), 0.48)
courtmat = material("Tennis green", (0.26, 0.45, 0.35))
courtblue = material("Tennis blue", (0.20, 0.38, 0.41))
warm = material("Village lamplight", (1.0, 0.63, 0.25), 0.5, glow=0.8)
office = material("Third floor studio light", (1.0, 0.65, 0.28), 0.4, glow=1.8)
skin = material("Beachgoer skin", (0.72, 0.45, 0.28))
swim = material("Surf wetsuit", (0.06, 0.12, 0.13))
blue = material("Blue board", (0.17, 0.43, 0.66))


def group(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj


terrain = group("Coast")
village = group("Village")
campus = group("DIB")
sports = group("Courts")
garden = group("Palms")
waves = group("Surf")


def finish(obj, name, mat, owner):
    obj.name = name
    obj.parent = owner
    obj.data.materials.append(mat)
    return obj


def mesh(name, verts, faces, mat, owner):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat, owner)


def box(name, pos, size, mat, owner, bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Hand finished edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, mat, owner)


def ball(name, pos, scale, mat, owner, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions, radius=1, location=pos
    )
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, name, mat, owner)


def rod(name, a, b, r, mat, owner, vertices=8, r2=None):
    d = Vector(b) - Vector(a)
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=r,
        radius2=r if r2 is None else r2,
        depth=d.length,
        location=(Vector(a) + Vector(b)) / 2,
    )
    obj = bpy.context.object
    obj.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return finish(obj, name, mat, owner)


def line(name, points, r, mat, owner):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 1
    data.bevel_depth = r
    data.bevel_resolution = 1
    spline = data.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    finish(obj, name, mat, owner)
    return obj


def shoreline(x):
    return -2.1 + 0.7 * math.sin(x * 0.23) + 0.25 * math.sin(x * 0.68)


def plateau(x):
    return 0.80 + 2.5 * math.exp(-(((x + 10.3) / 3.25) ** 4))


# One continuous coast, with shallow coves and a raised sandstone headland.
verts, faces = [], []
nx, ny = 260, 28
for i in range(nx + 1):
    x = -38 + 76 * i / nx
    for j in range(ny + 1):
        t = j / ny
        y = shoreline(x) + 1.9 + t * (5.0 - shoreline(x) - 1.9)
        height = plateau(x) * min(1, (t / 0.18) ** 0.5)
        z = 0.12 + height + 0.018 * math.sin(x * 7 + t * 20)
        verts.append((x, y, z))
        if i < nx and j < ny:
            a = i * (ny + 1) + j
            faces.append((a, a + ny + 1, a + ny + 2, a + 1))
land = mesh("Continuous mainland sandstone", verts, faces, rockmats[0], terrain)
for m in rockmats[1:] + [grass]:
    land.data.materials.append(m)
for p in land.data.polygons:
    p.material_index = 4 if p.center.y > 1.1 else 2
# Polygon centers need update after mesh creation, assign elevation bands directly.
for i, p in enumerate(land.data.polygons):
    j = i % ny
    p.material_index = 4 if j >= 7 else min(3, j // 2)

for name, start, end, mat in [
    ("Long sandy beach", 0, 1.96, sand),
    ("Wet tide edge", -0.27, 0.22, wet),
]:
    vv, ff = [], []
    for i in range(181):
        x = -38 + i * 76 / 180
        for t in (start, end):
            vv.append((x, shoreline(x) + t, 0.085 + t * 0.027))
        if i < 180:
            ff.append((2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1))
    mesh(name, vv, ff, mat, terrain)

# The water edge fades in the browser; the surface itself is modeled geometry.
vv, ff = [], []
for i in range(181):
    x = -21 + i * 42 / 180
    for j in range(31):
        t = j / 30
        y = shoreline(x) - t * 6.0
        vv.append((x, y, 0.025))
        if i < 180 and j < 30:
            a = i * 31 + j
            ff.append((a, a + 31, a + 32, a + 1))
mesh("Pacific", vv, ff, ocean, waves)

# Eroded rocks at the foot of the headland, with visible beach between them.
for i in range(44):
    x = random.uniform(-14.5, -6.5)
    y = shoreline(x) + random.uniform(0.3, 1.6)
    r = random.uniform(0.15, 0.42)
    ball(
        "Tumbled sandstone",
        (x, y, 0.12),
        (r, r * 0.7, r * 0.55),
        random.choice(rockmats),
        terrain,
    )
for i in range(6):
    x = -14 + i * 1.2
    z = plateau(x) + 0.11
    ball("Coastal sage", (x, 1.8 + (i % 2) * 0.4, z), (0.36, 0.3, 0.26), grass, garden)


def roof_tiles(x, y, z, w, d, owner):
    mesh(
        "Pitched clay roof",
        [
            (x - w / 2, y - d / 2, z),
            (x + w / 2, y - d / 2, z),
            (x - w / 2, y, z + 0.53),
            (x + w / 2, y, z + 0.53),
            (x - w / 2, y + d / 2, z),
            (x + w / 2, y + d / 2, z),
        ],
        [(0, 1, 3, 2), (2, 3, 5, 4)],
        roof,
        owner,
    )
    for i in range(int(w / 0.13) + 1):
        xx = x - w / 2 + i * w / int(w / 0.13)
        for s in (-1, 1):
            rod(
                "Individual barrel tile",
                (xx, y, z + 0.54),
                (xx, y + s * d / 2, z + 0.018),
                0.042,
                tile_alt if i % 4 == 0 else roof,
                owner,
                6,
            )
    rod(
        "Clay ridge cap",
        (x - w / 2 - 0.05, y, z + 0.56),
        (x + w / 2 + 0.05, y, z + 0.56),
        0.075,
        tile_alt,
        owner,
    )


def house(x, y, base, w, h, d, mat, name):
    owner = group(name)
    owner.parent = village
    box("Stucco house", (x, y, base + h / 2), (w, d, h), mat, owner, 0.04)
    roof_tiles(x, y, base + h, w + 0.24, d + 0.22, owner)
    box(
        "Chimney",
        (x + w * 0.28, y + 0.16, base + h + 0.58),
        (0.26, 0.28, 0.65),
        mat,
        owner,
    )
    box(
        "Chimney cap",
        (x + w * 0.28, y + 0.16, base + h + 0.92),
        (0.34, 0.35, 0.07),
        white,
        owner,
    )
    fy = y - d / 2 - 0.025
    for floor in range(max(1, round(h / 0.95))):
        for col in (-1, 1):
            xx = x + col * w * 0.25
            zz = base + 0.58 + floor * 0.91
            box(
                "Recessed window",
                (xx, fy, zz),
                (0.39, 0.045, 0.53),
                window,
                owner,
                0.012,
            )
            box(
                "Window sill",
                (xx, fy - 0.055, zz - 0.3),
                (0.51, 0.14, 0.06),
                white,
                owner,
            )
            for side in (-1, 1):
                box(
                    "Painted shutter",
                    (xx + side * 0.255, fy - 0.02, zz),
                    (0.10, 0.06, 0.56),
                    sage,
                    owner,
                    0.008,
                )
            rod(
                "Window mullion",
                (xx, fy - 0.04, zz - 0.24),
                (xx, fy - 0.04, zz + 0.24),
                0.012,
                white,
                owner,
            )
            if (floor + col) % 3 == 0:
                box(
                    "Windowlight",
                    (xx - 0.085, fy - 0.025, zz),
                    (0.13, 0.015, 0.42),
                    warm,
                    owner,
                    0,
                )
    box(
        "Recessed oak door",
        (x, fy - 0.01, base + 0.43),
        (0.34, 0.07, 0.86),
        wood,
        owner,
    )
    for i in range(3):
        box(
            "Entry tread",
            (x, fy - 0.18 - i * 0.12, base - 0.035 - i * 0.04),
            (0.70, 0.23, 0.09),
            plaster,
            owner,
        )
    return owner


# Terraced Spanish cottages and a cliff villa with arcaded ocean loggia.
for args in [
    (-5.1, 2.7, 0.93, 1.55, 2.2, 1.5, peach, "CasitaApricot"),
    (-2.7, 2.9, 0.93, 1.85, 2.8, 1.8, plaster, "CasitaCream"),
    (-0.3, 2.8, 0.93, 1.45, 1.8, 1.55, rose, "CasitaRose"),
    (16.0, 2.4, 0.93, 2.2, 2.35, 1.85, plaster, "CasitaEast"),
]:
    house(*args)
villa = house(-10.4, 2.65, 3.43, 3.3, 2.15, 1.9, white, "CliffVilla")
box("Villa sea terrace", (-10.4, 0.95, 3.38), (4.3, 1.8, 0.23), plaster, villa)
box("Loggia shade roof", (-10.4, 1.28, 5.12), (3.65, 1.30, 0.16), white, villa)
for x in (-11.96, -10.92, -9.88, -8.84):
    box("Arcade pier", (x, 0.76, 4.18), (0.15, 0.16, 1.62), white, villa)
for x in (-11.44, -10.40, -9.36):
    points = [
        (x + 0.45 * math.cos(a), 0.755, 4.61 + 0.40 * math.sin(a))
        for a in [math.pi * i / 18 for i in range(19)]
    ]
    line("Ocean loggia arch", points, 0.10, white, villa)
for x in (-12.4, -11.7, -11, -10.3, -9.6, -8.9, -8.3):
    rod("Villa baluster", (x, 0.13, 3.55), (x, 0.13, 4.00), 0.035, white, villa)
rod("Villa handrail", (-12.45, 0.13, 4.02), (-8.25, 0.13, 4.02), 0.055, white, villa)
# Readable descending stair connects the high villa to the village terrace.
for i in range(17):
    box(
        "Cliff stair",
        (-7.7, 0.95 + i * 0.17, 0.93 + (17 - i) * 0.14),
        (0.72, 0.24, 0.17),
        plaster,
        villa,
        0.016,
    )

# Five folded bays, with the user's studio in the middle bay. The concrete
# ground floor, glass gallery, clad ends and stair are read from their photos.
dx, dy, bz = 7.5, 2.7, 0.93
box("DIB plinth", (dx, dy, bz + 0.08), (7.45, 3.5, 0.16), concrete, campus)
box("DIB core", (dx, dy + 0.22, bz + 2.18), (6.8, 2.45, 4.26), concrete, campus)
for fl in range(4):
    z = bz + 0.55 + fl * 1.06
    box(
        "Lower curtain wall" if fl < 2 else "Rear glazing",
        (dx, dy - 1.05, z),
        (6.65, 0.05, 0.85),
        glass,
        campus,
        0,
    )
    box(
        "Floor slab edge",
        (dx, dy - 1.12, bz + fl * 1.06),
        (6.9, 0.22, 0.12),
        concrete,
        campus,
    )
    for i in range(19):
        xx = dx - 3.25 + i * 0.36
        rod(
            "Lower window mullion",
            (xx, dy - 1.09, z - 0.41),
            (xx, dy - 1.09, z + 0.41),
            0.017,
            dark,
            campus,
        )
    # Horizontal glazing along the right return is visible from the camera.
    box(
        "DIB east return glazing",
        (dx + 3.41, dy + 0.1, z),
        (0.045, 2.18, 0.66),
        glass2,
        campus,
        0,
    )
    for j in range(7):
        rod(
            "Return mullion",
            (dx + 3.45, dy - 0.9 + j * 0.31, z - 0.35),
            (dx + 3.45, dy - 0.9 + j * 0.31, z + 0.35),
            0.016,
            dark,
            campus,
        )
for bay in range(5):
    x0 = dx - 3.43 + bay * 1.04
    x1 = x0 + 1.01
    ya, yb = dy - 1.45, dy - 2.13
    lo, hi = bz + 2.05, bz + 4.48
    mesh(
        "Folded bay charcoal cheek",
        [(x1, yb, lo), (x1, dy - 0.80, lo), (x1, dy - 0.80, hi), (x1, yb, hi)],
        [(0, 1, 2, 3)],
        dark,
        campus,
    )
    mesh(
        "Projecting bay soffit",
        [(x0, ya, lo), (x1, yb, lo), (x1, dy - 0.8, lo), (x0, dy - 0.8, lo)],
        [(0, 1, 2, 3)],
        plaster,
        campus,
    )
    mesh(
        "Sawtooth roof cap",
        [(x0, ya, hi), (x1, yb, hi), (x1, dy - 0.8, hi), (x0, dy - 0.8, hi)],
        [(0, 1, 2, 3)],
        dark,
        campus,
    )
    for col in range(3):
        a, b = col / 3, (col + 1) / 3
        xa, xb = x0 + (x1 - x0) * a, x0 + (x1 - x0) * b
        y0 = ya + (yb - ya) * a
        y1 = ya + (yb - ya) * b
        for row in range(4):
            z0, z1 = lo + row * 0.60, lo + (row + 1) * 0.60
            is_office = bay == 2 and col == 1 and row == 0
            pane = mesh(
                "OfficeWindow" if is_office else "Glazed bay pane",
                [(xa, y0, z0), (xb, y1, z0), (xb, y1, z1), (xa, y0, z1)],
                [(0, 1, 2, 3)],
                (
                    office
                    if is_office
                    else (glass2 if (col + bay + row) % 3 == 0 else glass)
                ),
                campus,
            )
            if is_office:
                # The third-floor window is anchored by the user's marked photos.
                office_anchor = ((xa + xb) / 2, (y0 + y1) / 2 - 0.03, (z0 + z1) / 2)
        rod(
            "Tall black mullion",
            (xa, y0 - 0.015, lo),
            (xa, y0 - 0.015, hi),
            0.018,
            dark,
            campus,
        )
    rod("Bay edge", (x1, yb, lo), (x1, yb, hi), 0.025, dark, campus)
    for row in range(5):
        z = lo + row * 0.60
        rod("Transom", (x0, ya - 0.015, z), (x1, yb - 0.015, z), 0.018, dark, campus)
    for i in range(9):
        yy = yb + 0.08 + i * 0.13
        rod(
            "Vertical folded metal rib",
            (x1 + 0.016, yy, lo),
            (x1 + 0.016, yy, hi),
            0.009,
            concrete,
            campus,
        )
# Dark solid end volume is smaller than the repeated glazed bays.
box(
    "DIB solid end volume",
    (dx + 2.55, dy - 0.40, bz + 3.20),
    (1.62, 1.5, 2.58),
    dark,
    campus,
)
for fl in (2, 3):
    box(
        "End ribbon window",
        (dx + 2.6, dy - 1.166, bz + fl * 1.06 + 0.57),
        (1.26, 0.024, 0.56),
        glass2,
        campus,
        0,
    )
box(
    "Entrance canopy", (dx + 0.5, dy - 1.55, bz + 0.98), (1.7, 1.2, 0.10), white, campus
)
# A substantial terrace follows the full frontage, including benches and steps.
box("DIB concrete terrace", (dx, dy - .50, .50), (7.8, 5.4, .86), concrete, campus, .07)
for i in range(8):
    box("DIB promenade stair", (dx+.5,dy-3.32-i*.22,.84-i*.11), (2.4,.29,.16), concrete,campus,.016)
for i in range(12):
    yy = dy - 1.95 + i * .27
    zz = bz + .11 + i * .087
    box("DIB external stair", (dx + 3.93, yy, zz), (.64, .32, .17), concrete, campus, .012)
    if i % 3 == 0:
        rod("DIB stair baluster", (dx + 4.20, yy, zz), (dx + 4.20, yy, zz + .55), .016, dark, campus)
rod("DIB stair handrail", (dx+4.20,dy-1.95,bz+.66), (dx+4.20,dy+1.02,bz+1.617), .022, dark, campus)
# Landward facade: dark study volumes over a long glazed gallery.
for i in range(5):
    xx = dx - 2.78 + i * 1.29
    box("DIB landward metal panel", (xx, dy+1.47, bz+3.13), (1.22,.14,2.40), dark, campus)
    box("DIB landward ribbon window", (xx,dy+1.552,bz+3.23), (.96,.02,.56), glass2,campus, .008)
    for j in range(7):
        rod("Cladding seam", (xx-.55+j*.16,dy+1.55,bz+2.0), (xx-.55+j*.16,dy+1.55,bz+2.80), .004, concrete,campus)
for i in range(3):
    box(
        "DIB broad entry step",
        (dx + 0.5, dy - 2.08 - i * 0.24, bz - 0.015 - i * 0.045),
        (2.5, 0.42, 0.12),
        concrete,
        campus,
    )
for x in (dx - 2.7, dx + 2.5):
    box("Campus bench seat", (x, dy - 2.52, bz + 0.36), (1.0, 0.3, 0.09), wood, campus)
    for s in (-0.35, 0.35):
        box(
            "Bench legs",
            (x + s, dy - 2.52, bz + 0.16),
            (0.07, 0.23, 0.34),
            dark,
            campus,
        )


def palm(x, y, z, height=3.3, lean=0.4):
    owner = group("Palm")
    owner.parent = garden
    points = [
        (x + lean * t * t, y + 0.10 * math.sin(t * 2), z + height * t)
        for t in [i / 9 for i in range(10)]
    ]
    for i in range(9):
        rod(
            "Curving palm trunk",
            points[i],
            points[i + 1],
            0.085 - i * 0.003,
            wood,
            owner,
            8,
            r2=0.080 - i * 0.003,
        )
        ball(
            "Trunk collar",
            points[i],
            (0.096 - i * 0.003, 0.096 - i * 0.003, 0.035),
            plaster,
            owner,
            1,
        )
    tip = points[-1]
    crown = group("Crown")
    crown.parent = owner
    for n in range(9):
        ang = n * math.tau / 9 + random.uniform(-0.15, 0.15)
        length = random.uniform(1.1, 1.65)
        vv, ff = [], []
        for j in range(10):
            t = j / 9
            cx = tip[0] + math.cos(ang) * length * t
            cy = tip[1] + math.sin(ang) * length * t
            zz = tip[2] + 0.38 * math.sin(t * math.pi) - 0.42 * t * t
            width = 0.15 * math.sin(math.pi * t) ** 0.65
            for s in (-1, 0, 1):
                vv.append(
                    (
                        cx + s * math.sin(ang) * width,
                        cy - s * math.cos(ang) * width,
                        zz - (0.04 if s else 0),
                    )
                )
            if j < 9:
                a = j * 3
                ff.extend([(a, a + 3, a + 4, a + 1), (a + 1, a + 4, a + 5, a + 2)])
        mesh("Feather palm leaf", vv, ff, leaf if n % 2 else leaf2, crown)
        # Split tips and leaflet edges carry a readable silhouette at footer scale.
        for j in range(2, 8):
            t = j / 9
            center = (
                tip[0] + math.cos(ang) * length * t,
                tip[1] + math.sin(ang) * length * t,
                tip[2] + 0.38 * math.sin(t * math.pi) - 0.42 * t * t,
            )
            for s in (-1, 1):
                end = (
                    center[0] + math.cos(ang) * 0.16 + s * math.sin(ang) * 0.20,
                    center[1] + math.sin(ang) * 0.16 - s * math.cos(ang) * 0.20,
                    center[2] - 0.09,
                )
                rod("Palm leaflet", center, end, 0.013, leaf, crown, 4, r2=0.002)
    crown.location = tip
    for child in crown.children:
        child.location -= Vector(tip)
    return owner


for x, y, z, h, l in [
    (-17, 2.5, 0.94, 3.6, 0.5),
    (-14.4, 2.9, 1.05, 4.3, -0.3),
    (-6.5, 1.9, 0.99, 3.8, 0.5),
    (1.45, 2.6, 0.94, 3.55, -0.25),
    (12.55, 2.7, 0.94, 4.8, 0.4),
    (18.2, 1.3, 0.94, 3.4, -0.45),
    (14.0, -0.1, 0.31, 2.8, 0.6),
]:
    palm(x, y, z, h, l)


def court(x, y, z, w, d, tennis):
    owner = group("Tennis" if tennis else "BeachVolleyball")
    owner.parent = sports
    if tennis:
        # A retaining platform reaches the beach; no thin suspended court slab.
        box("Tennis retaining foundation", (x,y,(z-.1)/2), (w+.6,d+.6,z-.1), rockmats[2], owner, .10)
        for i in range(6):
            box("Court access step", (x+w/2+.48,y-.60+i*.27,z*(i+1)/6-.08), (.48,.32,.16), concrete,owner,.015)
    box(
        "Court foundation",
        (x, y, z - 0.05),
        (w + 0.4, d + 0.4, 0.1),
        courtmat if tennis else sand,
        owner,
        0.06,
    )
    box(
        "Playing surface",
        (x, y, z + 0.01),
        (w, d, 0.025),
        courtblue if tennis else sand,
        owner,
        0,
    )
    line(
        "Court boundary",
        [
            (x - w / 2, y - d / 2, z + 0.03),
            (x + w / 2, y - d / 2, z + 0.03),
            (x + w / 2, y + d / 2, z + 0.03),
            (x - w / 2, y + d / 2, z + 0.03),
            (x - w / 2, y - d / 2, z + 0.03),
        ],
        0.015,
        white,
        owner,
    )
    for s in (-1, 1):
        rod(
            "Net post",
            (x, y + s * (d / 2 + 0.12), z),
            (x, y + s * (d / 2 + 0.12), z + (0.43 if tennis else 0.75)),
            0.022,
            dark,
            owner,
        )
    nh = 0.41 if tennis else 0.72
    rod(
        "Net top tape",
        (x, y - d / 2, z + nh),
        (x, y + d / 2, z + nh),
        0.018,
        white,
        owner,
    )
    for j in range(24):
        yy = y - d / 2 + j * d / 23
        rod(
            "Net thread", (x, yy, z + nh - 0.31), (x, yy, z + nh), 0.004, dark, owner, 4
        )
    for j in range(5):
        zz = z + nh - j * 0.075
        rod("Net weave", (x, y - d / 2, zz), (x, y + d / 2, zz), 0.004, dark, owner, 4)
    if tennis:
        for s in (-1, 1):
            line(
                "Service box",
                [
                    (x + s * w * 0.25, y - d / 2 + 0.26, z + 0.04),
                    (x + s * w * 0.25, y + d / 2 - 0.26, z + 0.04),
                ],
                0.012,
                white,
                owner,
            )
            line(
                "Doubles alley",
                [
                    (x - w / 2, y + s * (d / 2 - 0.26), z + 0.04),
                    (x + w / 2, y + s * (d / 2 - 0.26), z + 0.04),
                ],
                0.012,
                white,
                owner,
            )
        rod(
            "Center service line",
            (x - w * 0.25, y, z + 0.04),
            (x + w * 0.25, y, z + 0.04),
            0.012,
            white,
            owner,
        )
        # An open-air low perimeter fence, deliberately without a roof.
        for xx in (-w / 2 - 0.16, w / 2 + 0.16):
            for j in range(6):
                yy = y - d / 2 + j * d / 5
                rod(
                    "Court fence post",
                    (x + xx, yy, z),
                    (x + xx, yy, z + 0.7),
                    0.015,
                    sage,
                    owner,
                )
            for k in (0.2, 0.45, 0.7):
                rod(
                    "Court fence wire",
                    (x + xx, y - d / 2, z + k),
                    (x + xx, y + d / 2, z + k),
                    0.006,
                    sage,
                    owner,
                )
    return owner


court(-17.0, 0.4, 0.94, 4.4, 2.4, True)
court(0.0, -1.35, 0.18, 3.7, 1.8, False)


def person(x, y, z, owner, mat=swim, surf=False):
    ball("Head", (x, y, z + 0.60), (0.075, 0.073, 0.085), skin, owner)
    rod("Torso", (x, y, z + 0.29), (x + 0.02, y, z + 0.52), 0.070, mat, owner, r2=0.085)
    for s in (-1, 1):
        rod(
            "Lower leg",
            (x + s * 0.14, y, z + 0.04),
            (x + s * 0.09, y - 0.04, z + 0.20),
            0.028,
            skin if not surf else mat,
            owner,
        )
        rod(
            "Upper leg",
            (x + s * 0.09, y - 0.04, z + 0.20),
            (x, y, z + 0.31),
            0.042,
            mat,
            owner,
        )
        rod(
            "Arm",
            (x + s * 0.05, y, z + 0.48),
            (x + s * 0.20, y - 0.06, z + (0.46 if surf else 0.36)),
            0.025,
            skin,
            owner,
        )


for x, y in [(-1.2, -1.1), (1.25, -1.6)]:
    person(x, y, 0.19, sports, rose if x < 0 else blue)
for x, y in [(-18.25, 0.4), (-15.65, 0.4)]:
    person(x, y, 0.95, sports, white)
for n, (x, y, ang) in enumerate(
    [(-6.2, -4.1, -0.25), (4.0, -5.1, 0.15), (13.5, -3.7, -0.12)]
):
    surfer = group("Surfer" + str(n))
    surfer.parent = waves
    surfer.location = (x, y, 0.12)
    surfer.rotation_euler.z = ang
    ball(
        "Longboard",
        (0, 0, 0),
        (0.72, 0.17, 0.043),
        white if n == 0 else (peach if n == 1 else blue),
        surfer,
        3,
    )
    person(0, 0, 0.035, surfer, surf=True)
    for k in range(2):
        line(
            "Board wake",
            [
                (-0.8 - t * 0.8, (k * 2 - 1) * (0.1 + t * 0.16), 0.01)
                for t in [j / 9 for j in range(10)]
            ],
            0.014,
            foam,
            surfer,
        )

# Parasols, towels and a lifeguard station establish beach scale.
for x, y in [(3, -1.0), (13.8, -0.8), (17, -0.9), (-4, -1.8)]:
    rod("Parasol pole", (x, y, 0.13), (x, y, 0.94), 0.018, wood, terrain)
    vv = [(x, y, 1.03)] + [
        (
            x + 0.44 * math.cos(i * math.tau / 12),
            y + 0.44 * math.sin(i * math.tau / 12),
            0.86,
        )
        for i in range(12)
    ]
    mesh(
        "Canvas beach umbrella",
        vv,
        [(0, i + 1, (i + 1) % 12 + 1) for i in range(12)],
        white,
        terrain,
    )
    box(
        "Striped beach towel",
        (x + 0.42, y - 0.20, 0.14),
        (0.30, 0.67, 0.018),
        rose,
        terrain,
        0,
    )
hut = house(18.5, -0.1, 0.50, 0.75, 0.75, 0.7, white, "Lifeguard")
for s in (-0.3, 0.3):
    rod(
        "Lifeguard stilt",
        (18.5 + s, -0.1, 0.13),
        (18.5 + s, -0.1, 0.62),
        0.04,
        wood,
        hut,
    )

from coastal_landmarks import landmarks
landmark_groups = landmarks(globals())

# Material batches keep hundreds of authored details cheap to draw.
# Preserve water, surfers, palm crowns, and the office as independent objects.
for obj in list(bpy.data.objects):
    if obj.type == "CURVE":
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target="MESH")


def batch(owner):
    buckets = {}
    for obj in list(owner.children):
        if obj.type == "EMPTY":
            batch(obj)
        elif obj.type == "MESH" and obj.name not in ("Pacific", "OfficeWindow"):
            key = tuple(m.name for m in obj.data.materials)
            buckets.setdefault(key, []).append(obj)
    for key, objects in buckets.items():
        if len(objects) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = owner.name + " · " + key[0]


for root in (terrain, village, campus, sports, garden, waves, *landmark_groups):
    batch(root)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 40
scene.cycles.use_denoising = True
scene.world.color = (0.45, 0.45, 0.45)
for name, pos, power, size in [
    ("Large coastal softbox", (-10, -8, 20), 4300, 11),
    ("Sky fill", (9, 6, 16), 2700, 12),
    ("Ocean bounce", (0, -12, 8), 1100, 14),
]:
    bpy.ops.object.light_add(type="AREA", location=pos)
    lamp = bpy.context.object
    lamp.name = name
    lamp.data.energy = power
    lamp.data.shape = "DISK"
    lamp.data.size = size
    lamp.rotation_euler = (
        (Vector((0, 0, 0)) - lamp.location).to_track_quat("-Z", "Y").to_euler()
    )
bpy.ops.object.camera_add(location=(5, -38, 18))
cam = bpy.context.object
cam.rotation_euler = (
    (Vector((0, 0, 2)) - cam.location).to_track_quat("-Z", "Y").to_euler()
)
cam.data.type = "ORTHO"
cam.data.ortho_scale = 40.5
scene.camera = cam
scene.render.resolution_x = 2000
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.view_settings.view_transform = "AgX"
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "la-jolla.blend"))
bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.data.objects:
    # Geisel and Salk are source landmarks for the campus atlas, not repeated
    # in the seaside footer. Keep them editable in the shared authoring file.
    ancestor, campus_only = obj, False
    while ancestor:
        campus_only |= ancestor.name in ("Geisel", "Salk")
        ancestor = ancestor.parent
    if campus_only:
        obj.hide_render = True
    if obj.type not in ("LIGHT", "CAMERA") and not campus_only:
        obj.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(OUT / "la-jolla.glb"),
    export_format="GLB",
    use_selection=True,
    export_cameras=False,
    export_lights=False,
    export_animations=False,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
)
manifest = {
    "version": 3,
    "model": "la-jolla.glb",
    "coordinates": "Y-up",
    "office": [office_anchor[0], office_anchor[2], -office_anchor[1]],
    "camera": {"position": [5, 18, 38], "target": [0, 2, 0], "width": 40.5},
    "triangleCount": sum(
        len(o.data.loop_triangles) for o in bpy.data.objects if o.type == "MESH"
    ),
    "source": "bin/build_la_jolla.py",
    "geography": "Authored collage, not a map",
    "landmarks": ["DIB", "CliffVilla", "Village", "Tennis", "ScrippsPier"],
    "dib": {"foldedBays": 5, "officeBay": 3, "officeFloor": 3},
    "terrainBounds": [-38, 38, 5],
}
(OUT / "manifest.json").write_text(
    json.dumps(manifest, indent=2) + "\n", encoding="utf8"
)
if "--skip-render" not in sys.argv:
    scene.render.filepath = str(SOURCE / "la-jolla-day.png")
    bpy.ops.render.render(write_still=True)
print("La Jolla assets exported", OUT)
