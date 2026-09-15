"""Author Sirui's coastal miniature and skinned character library in Blender.

Run with Blender 4.5 LTS: blender -b --python bin/build_coastal_home.py
Geometry and animations are original work for this site. Coordinates in this
source are Blender Z-up; glTF exports Y-up. No downloaded model is required.
"""

import bpy
import math
import json
import sys
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_sculpt import build_cave, build_bluff, refine_character, render_portrait
from coastal_craft import potted_plant, furnish
from coastal_interiors import gym
from coastal_bedding import duvet

OUT = ROOT / "assets/models/home"
SOURCE = ROOT / "artwork/coastal-home"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 24
    bpy.context.preferences.filepaths.save_version = 0


def material(name, color, rough=0.65, metallic=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*color, 1)
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Metallic"].default_value = metallic
    return m


def finish(o, name, mat, parent=None):
    o.name = name
    if mat:
        o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def box(name, loc, size, mat, bevel=0.04, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new("crafted edges", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = o.modifiers.new("weighted normals", "WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o, name, mat, parent)


def sphere(name, loc, scale, mat, parent=None, segments=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=12, location=loc)
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for p in o.data.polygons:
        p.use_smooth = True
    return finish(o, name, mat, parent)


def cylinder(name, loc, radius, depth, mat, parent=None, vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=loc
    )
    o = bpy.context.object
    mod = o.modifiers.new("edge", "BEVEL")
    mod.width = min(0.012, depth * 0.1)
    mod.segments = 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o, name, mat, parent)


def tube(name, points, radius, mat, parent=None, resolution=8):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = resolution
    curve.bevel_depth = radius
    curve.bevel_resolution = 1 if resolution < 4 else 2
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for p, co in zip(spline.bezier_points, points):
        p.co = co
        p.handle_left_type = "AUTO"
        p.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o.select_set(False)
    return finish(o, name, mat, parent)


def empty(name, loc=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.location = loc
    return o


def polygon_slab(name, points, bottom, top, mat, segments=4):
    n = len(points)
    verts = [(x, y, z) for z in (bottom, top) for x, y in points]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    mod = o.modifiers.new("soft carved perimeter", "BEVEL")
    mod.width = 0.14
    mod.segments = segments
    bpy.ops.object.modifier_apply(modifier=mod.name)
    o.select_set(False)
    return o


def join_static(group):
    """Batch static meshes by material, retaining semantic room collections."""
    buckets = {}
    for o in list(bpy.context.scene.objects):
        if (
            o.type == "MESH"
            and o.name.startswith(group + "_")
            and not o.name.startswith(group + "_water")
            and not o.get("caveRoof")
            and not o.get("activityProp")
        ):
            buckets.setdefault(o.data.materials[0].name, []).append(o)
    for key, objects in buckets.items():
        bpy.ops.object.select_all(action="DESELECT")
        for o in objects:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        bpy.context.object.name = f"{group}__{key}"


def export(name, selection=None, animations=False):
    bpy.ops.object.select_all(action="DESELECT")
    for o in selection or list(bpy.context.scene.objects):
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / f"{name}.glb"),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_animations=animations,
        export_animation_mode="NLA_TRACKS",
        export_force_sampling=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )


def home():
    reset()
    mats = {
        "plaster": material("chalk limestone", (0.79, 0.72, 0.58)),
        "edge": material("warm cut stone", (0.57, 0.47, 0.32)),
        "wood": material("honey ash", (0.24, 0.12, 0.047)),
        "oak": material("pale oak", (0.44, 0.29, 0.145)),
        "cream": material("linen", (0.88, 0.83, 0.71)),
        "sage": material("sage textile", (0.29, 0.39, 0.24)),
        "leaf": material("olive leaf", (0.19, 0.30, 0.12)),
        "ink": material("charcoal", (0.035, 0.043, 0.039)),
        "brass": material("brushed brass", (0.53, 0.36, 0.12), 0.32, 0.65),
        "terra": material("terracotta", (0.61, 0.25, 0.12)),
        "water": material("onsen turquoise", (0.20, 0.49, 0.45), 0.22),
        "glass": material("window sea glass", (0.53, 0.72, 0.69), 0.1),
    }
    floor = [
        (-4.6, -2.7),
        (-2.6, -3.05),
        (2.8, -3.05),
        (4.6, -2.05),
        (4.6, 2.8),
        (3.8, 3.45),
        (-3.8, 3.45),
        (-4.6, 2.5),
    ]
    polygon_slab("core_floor", floor, -0.28, -0.015, mats["oak"])
    for i in range(24):
        x = -4.35 + i * 0.38
        box("core_floorboard", (x, 0.25, -0.003), (0.011, 5.35, 0.005), mats["wood"], 0)
    # The connected, two-storey excavation is authored after room furniture.

    def plant(group, x, y, z=0, scale=1):
        potted_plant(group, x, y, z, scale, mats, globals())

    def chair(group, x, y, lounge=False):
        width = 0.95 if lounge else 0.56
        for dx in (-width * 0.4, width * 0.4):
            for dy in (-0.24, 0.24):
                box(
                    group + "_leg",
                    (x + dx, y + dy, 0.22),
                    (0.055, 0.055, 0.44),
                    mats["wood"],
                    0.025,
                )
        box(
            group + "_seat",
            (x, y, 0.45),
            (width, 0.64, 0.13),
            mats["cream"] if lounge else mats["sage"],
            0.06,
        )
        back_sign = -1  # Every seated workspace opens toward the Pacific.
        back = box(
            group + "_chairback",
            (x, y + back_sign * 0.28, 0.81),
            (width, 0.15, 0.68),
            mats["cream"] if lounge else mats["oak"],
            0.07,
        )
        back.rotation_euler.x = -0.13 * back_sign
        if not lounge:
            box(
                group + "_footrest",
                (x, y + 0.37, 0.11),
                (0.49, 0.28, 0.22),
                mats["wood"],
                0.04,
            )
        if lounge:
            for dx in (-0.51, 0.51):
                box(
                    group + "_armrest",
                    (x + dx, y, 0.70),
                    (0.12, 0.65, 0.1),
                    mats["wood"],
                    0.045,
                )

    # Study: clear space for the real album deck, paper links, and seated Sirui.
    box("study_desktop", (0.15, 2.22, 0.80), (2.46, 0.72, 0.13), mats["oak"], 0.045)
    for x in (-0.92, 1.19):
        box("study_trestle", (x, 2.22, 0.39), (0.13, 0.58, 0.78), mats["wood"], 0.045)
    chair("study", 0.08, 1.64)
    box("study_laptopbase", (0.10, 2.04, 0.88), (0.57, 0.34, 0.035), mats["ink"], 0.012)
    lid = box(
        "study_laptop", (0.10, 2.24, 1.055), (0.57, 0.035, 0.36), mats["ink"], 0.012
    )
    lid.rotation_euler.x = -0.18
    screen = box(
        "study_screen", (0.10, 2.217, 1.055), (0.51, 0.009, 0.30), mats["glass"], 0.005
    )
    screen.rotation_euler.x = -0.18
    for i in range(5):
        box(
            "study_codeline",
            (-0.01 + (i % 2) * 0.04, 2.189, 1.14 - i * 0.043),
            (0.24 + (i % 3) * 0.035, 0.007, 0.012),
            mats["sage"],
            0,
        )
    cylinder("study_lampbase", (-0.86, 2.42, 0.90), 0.12, 0.03, mats["brass"])
    tube(
        "study_lampstem",
        [(-0.86, 2.42, 0.9), (-0.86, 2.42, 1.43), (-0.66, 2.36, 1.52)],
        0.016,
        mats["brass"],
    )
    sphere("study_lampshade", (-0.64, 2.36, 1.46), (0.20, 0.16, 0.10), mats["cream"])
    plant("study", 1.17, 2.50, 0.87, 0.7)
    box("study_albumrack", (-1.32, 1.68, 1.45), (0.15, 1.15, 0.1), mats["wood"], 0.03)
    empty("anchor_study", (0.08, 1.62, 0))
    empty("anchor_records", (-1.27, 1.7, 1.54))

    # Bedroom; the blanket leaves room for the sleeping character's face.
    box("sleep_bedframe", (-3.10, 1.85, 0.20), (1.54, 2.25, 0.32), mats["wood"], 0.12)
    box("sleep_mattress", (-3.10, 1.82, 0.43), (1.49, 2.18, 0.22), mats["cream"], 0.105)
    duvet("sleep_duvet", mats["sage"])
    box("sleep_pillow", (-3.10, 2.65, 0.61), (0.82, 0.40, 0.20), mats["cream"], 0.09)
    cylinder("sleep_bedside", (-4.13, 2.53, 0.34), 0.23, 0.68, mats["oak"])
    sphere("sleep_lamp", (-4.13, 2.53, 0.83), (0.14, 0.14, 0.19), mats["cream"])
    plant("sleep", -2.05, 2.77, 0, 0.85)
    empty("anchor_sleep", (-3.10, 1.13, 0))

    # Kitchen and a late-breakfast table.
    box("kitchen_cabinet", (-3.28, -0.38, 0.39), (2.05, 0.61, 0.78), mats["sage"], 0.04)
    box(
        "kitchen_counter",
        (-3.28, -0.38, 0.83),
        (2.13, 0.66, 0.08),
        mats["cream"],
        0.035,
    )
    for x in (-3.95, -3.30, -2.63):
        box(
            "kitchen_handle",
            (x, -0.706, 0.62),
            (0.19, 0.025, 0.025),
            mats["brass"],
            0.01,
        )
    cylinder("kitchen_sink", (-3.80, -0.38, 0.88), 0.22, 0.015, mats["ink"])
    tube(
        "kitchen_tap",
        [(-3.80, -0.12, 0.89), (-3.80, -0.12, 1.15), (-3.80, -0.28, 1.12)],
        0.018,
        mats["brass"],
    )
    box(
        "kitchen_coffeemaker",
        (-2.69, -0.33, 1.02),
        (0.27, 0.28, 0.31),
        mats["ink"],
        0.04,
    )
    cylinder("kitchen_table", (-3.02, -1.81, 0.78), 0.63, 0.10, mats["oak"])
    cylinder("kitchen_tableleg", (-3.02, -1.81, 0.36), 0.12, 0.72, mats["wood"])
    chair("kitchen", -3.02, -2.49)
    cylinder("kitchen_plate", (-3.02, -1.98, 0.845), 0.19, 0.015, mats["cream"])
    sphere("kitchen_bread", (-3.02, -1.98, 0.9), (0.15, 0.085, 0.045), mats["terra"])
    plant("kitchen", -4.18, -1.06, 0, 1.15)
    empty("anchor_kitchen", (-3.02, -2.50, 0))

    gym(mats, globals())

    # Rounded carved onsen rim, separate animated water surface.
    cylinder("onsen_base", (3.02, 1.82, 0.17), 1.10, 0.34, mats["edge"], vertices=64)
    bpy.ops.mesh.primitive_torus_add(
        major_segments=64,
        minor_segments=12,
        location=(3.02, 1.82, 0.43),
        major_radius=0.91,
        minor_radius=0.17,
    )
    finish(bpy.context.object, "onsen_rim", mats["plaster"])
    cylinder("onsen_water", (3.02, 1.82, 0.40), 0.86, 0.015, mats["water"], vertices=64)
    box("onsen_towel", (4.15, 1.42, 0.30), (0.43, 0.30, 0.09), mats["cream"], 0.04)
    box("onsen_ledge", (3.10, 2.80, 0.56), (1.3, 0.28, 0.12), mats["wood"], 0.04)
    plant("onsen", 4.05, 2.76, 0, 1.2)
    empty("anchor_onsen", (3.02, 1.92, -0.48))

    chair("lounge", 3.23, -0.83, True)
    box("lounge_ottoman", (3.23, 0.04, 0.30), (0.75, 0.53, 0.20), mats["cream"], 0.09)
    cylinder("lounge_table", (2.14, -1.42, 0.46), 0.36, 0.07, mats["oak"])
    cylinder("lounge_tableleg", (2.14, -1.42, 0.21), 0.09, 0.42, mats["wood"])
    for i in range(3):
        book = box(
            "lounge_book",
            (2.14, -1.42, 0.51 + i * 0.035),
            (0.33, 0.23, 0.03),
            mats["terra"] if i % 2 else mats["cream"],
            0.01,
        )
        book.rotation_euler.z = i * 0.1
    plant("lounge", 4.06, -0.65, 0, 1.1)
    for x in (1.76, 3.05, 4.15):
        cylinder("lounge_baluster", (x, -2.64, 0.45), 0.022, 0.9, mats["brass"])
    tube(
        "lounge_railing",
        [(1.75, -2.64, 0.88), (3.05, -2.64, 0.88), (4.13, -2.31, 0.88)],
        0.032,
        mats["wood"],
    )
    empty("anchor_lounge", (3.23, -0.83, 0))
    empty("anchor_outside", (0, 6, -0.8))
    furnish(mats, globals())
    bpy.ops.wm.save_as_mainfile(
        filepath=str(ROOT / ".jekyll-cache/coastal-rooms.blend"), compress=True
    )
    finish_home(mats)


def CONFIG_ROOMS():
    return json.loads((OUT / "manifest.json").read_text())["rooms"]


def finish_home(mats, furnished=False):
    from coastal_section import rehouse, coast, CONFIG
    from coastal_garden import garden
    from coastal_furnishing import furnish_final

    bpy.context.preferences.filepaths.save_version = 0
    if not furnished:
        rehouse(mats, globals())
        bpy.ops.wm.save_as_mainfile(
            filepath=str(ROOT / ".jekyll-cache/coastal-section.blend"), compress=True
        )
    # A clear passage around the closed stair and between the kitchen/gym.
    # This finishing step also applies when replaying the cached room section.
    for o in list(bpy.context.scene.objects):
        if o.name.startswith(
            (
                "study_pot",
                "study_soil",
                "study_ceramic_lip",
                "study_stem",
                "study_curved_leaf",
            )
        ):
            # A small desk plant at the outside corner keeps the face readable
            # from the occupied-study camera. Apply before static batching.
            offset = next(r["offset"] for r in CONFIG_ROOMS() if r["id"] == "study")
            origin = Vector((1.17 + offset[0], 2.50 - offset[2], 0.87 + offset[1]))
            corner = origin + Vector((0.10, 0.04, 0))
            o.matrix_world = (
                Matrix.Translation(corner)
                @ Matrix.Scale(0.52, 4)
                @ Matrix.Translation(-origin)
                @ o.matrix_world
            )
        if o.name.startswith("gym_oak_backing"):
            o.location.x *= 0.84
        if o.name == "kitchen_print_wall":
            for v in o.data.vertices:
                if v.co.x > -2.4:
                    v.co.x = -2.4 + (v.co.x + 2.4) * 0.60
    for room in CONFIG_ROOMS():
        o = bpy.data.objects.get("anchor_" + room["id"])
        if o:
            x, y, z = room["actor"]
            o.location = (x, -z, y)
    # Cached room studies can predate the draped cover; always author the current
    # bedding before batching, so a section rebuild cannot restore the old block.
    for o in list(bpy.context.scene.objects):
        if o.name.startswith('sleep_duvet'):bpy.data.objects.remove(o,do_unlink=True)
    offset=next(r['offset'] for r in CONFIG['rooms'] if r['id']=='sleep')
    duvet('sleep_duvet',mats['sage'],(offset[0],-offset[2],offset[1]))
    furnish_final(mats, globals(), CONFIG)
    garden(mats, globals())
    coast_objects = coast(mats, globals())
    for room in CONFIG['rooms']:
        anchor=bpy.data.objects.get('anchor_'+room['id']) or empty('anchor_'+room['id'])
        x,y,z=room['actor'];anchor.location=(x,-z,y)
    buckets = {}
    for o in coast_objects:
        buckets.setdefault(
            (
                o.data.materials[0].name,
                o.get("renderStyle", "shared"),
                bool(o.get("caveRoof")),
            ),
            [],
        ).append(o)
    coast_objects = []
    for (name, style, cave_roof), objects in buckets.items():
        bpy.ops.object.select_all(action="DESELECT")
        for o in objects:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        o = bpy.context.object
        o.name = f"coast_{style}_{name}"
        if style != "shared":
            o["renderStyle"] = style
        if cave_roof:
            o["caveRoof"] = True
        coast_objects.append(o)
    for group in ("core", "study", "sleep", "kitchen", "gym", "onsen", "lounge"):
        join_static(group)
    bpy.ops.wm.save_as_mainfile(
        filepath=str(SOURCE / "coastal-home.blend"), compress=True
    )
    export(
        "home-shell",
        [
            o
            for o in bpy.context.scene.objects
            if o.name.startswith("core_") or o.type == "EMPTY"
        ],
    )
    for group in ("study", "sleep", "kitchen", "gym", "onsen", "lounge"):
        export(
            "room-" + group,
            [o for o in bpy.context.scene.objects if o.name.startswith(group + "_")],
        )
    export("coast", coast_objects)


def character(style):
    reset()
    lizard = style == "lizard"
    short = style == "south-park"
    yellow = style == "simpsons"
    angular = style == "rick-and-morty"
    natural = style == "ghibli"
    skin = material(
        "skin",
        (
            (0.34, 0.56, 0.22)
            if lizard
            else (0.95, 0.67, 0.055) if yellow else (0.72, 0.48, 0.31)
        ),
        0.72,
    )
    ink = material("ink details", (0.024, 0.03, 0.029))
    shirt = material("Sirui shirt", (0.024, 0.03, 0.029))
    hair = material("long black hair", (0.019, 0.018, 0.016), 0.53)
    strand = material("hair glints", (0.067, 0.049, 0.033), 0.60)
    pants = material(
        "charcoal shorts" if lizard else "olive trousers",
        (0.07, 0.08, 0.075) if lizard else (0.21, 0.24, 0.17),
    )
    white = material("warm white", (0.9, 0.87, 0.76))
    mouth = material("mouth", (0.13, 0.032, 0.024))
    rose = material("tongue", (0.57, 0.17, 0.22))
    metal = material("wire spectacles", (0.045, 0.054, 0.051), 0.3, 0.5)
    pieces = []

    def part(o, bone):
        pieces.append((o, bone))
        return o

    # Character is deliberately adult: broad relaxed shoulders, natural brow and
    # jaw, clean-shaven face; long hair is an identity feature in all variants.
    width = 0.25 if short else 0.16 if angular else 0.255 if lizard else 0.235
    head_z = 1.29 if short else 1.39 if natural else 1.43
    head_scale = (
        (0.36, 0.24, 0.35)
        if short
        else (0.235, 0.20, 0.285) if lizard else (0.20, 0.18, 0.265)
    )
    if angular:
        head_scale = (0.205, 0.16, 0.32)
    if yellow:
        head_scale = (0.20, 0.18, 0.31)
    if natural:
        head_scale = (0.200, 0.163, 0.222)
    part(sphere("male torso", (0, 0.01, 0.92), (width, 0.15, 0.26), shirt), "Spine")
    part(
        sphere("shirt hem", (0, 0.01, 0.73), (width * 0.88, 0.15, 0.10), shirt), "Hips"
    )
    part(
        sphere("neck", (0, 0, 1.13), (0.105 if lizard else 0.085, 0.085, 0.14), skin),
        "Spine",
    )
    part(
        sphere("Sirui face", (0, -0.015, head_z), head_scale, skin, segments=28), "Head"
    )
    for s in (-1, 1):
        part(
            sphere(
                "ear",
                (s * head_scale[0] * 0.94, -0.005, head_z - 0.01),
                (0.046, 0.032, 0.071),
                skin,
            ),
            "Head",
        )
    # A continuous swept-back hair shell, open around the face. The prior
    # paired spherical locks read as pigtails and concealed Sirui's jaw.
    rings = [
        (1.09, 0.18, 0.0),
        (0.94, 0.65, 0.0),
        (0.65, 0.89, 0.75),
        (0.35, 1.03, 1.14),
        (0.12, 1.08, 1.37),
        (-0.55, 1.08, 1.53),
        (-1.14, 1.08, 1.60),
        (-1.34, 1.19, 1.62),
    ]
    verts, faces, segments = [], [], 36
    for level, spread, gap in rings:
        for j in range(segments + 1):
            # Offset the sweep to expose the forehead and ears as in Sirui's
            # portrait, without a central fringe or two front-facing locks.
            a = gap + (math.tau - gap * 2) * j / segments + 0.18
            wave = math.sin(a * 5 + level * 2) * 0.008
            verts.append(
                (
                    math.sin(a) * (head_scale[0] * spread + wave),
                    0.025 - math.cos(a) * (head_scale[1] * spread + 0.018),
                    head_z + level * head_scale[2] + 0.014 * math.sin(a * 3),
                )
            )
    for i in range(len(rings) - 1):
        for j in range(segments):
            n = i * (segments + 1) + j
            faces.append((n, n + 1, n + segments + 2, n + segments + 1))
    faces.append(tuple(range(segments + 1)))
    data = bpy.data.meshes.new("swept shoulder length hair")
    data.from_pydata(verts, [], faces)
    data.update()
    shell = bpy.data.objects.new("side parted long hair", data)
    bpy.context.collection.objects.link(shell)
    shell.data.materials.append(hair)
    for face in data.polygons:
        face.use_smooth = True
    bpy.context.view_layer.objects.active = shell
    solid = shell.modifiers.new("hair volume", "SOLIDIFY")
    solid.thickness = 0.018
    bpy.ops.object.modifier_apply(modifier=solid.name)
    part(shell, "Head")
    for i in range(13):
        a = 1.30 + i * (math.tau - 2.60) / 12
        points = []
        for level, spread in ((0.94, 0.75), (0.45, 1.09), (-0.55, 1.13), (-1.26, 1.14)):
            points.append(
                (
                    math.sin(a) * head_scale[0] * spread,
                    0.025 - math.cos(a) * (head_scale[1] * spread + 0.028),
                    head_z + level * head_scale[2],
                )
            )
        part(tube("swept hair strand", points, 0.0024, strand), "Head")
    eye_x = 0.14 if short else 0.112 if lizard or angular or yellow else 0.076
    eye_r = (
        0.095 if lizard else 0.11 if short else 0.090 if angular or yellow else 0.045
    )
    eye_y = -0.205 if lizard else -0.232 if short else -0.158 if natural else -0.174
    eye_z = head_z + 0.042
    for s, side in ((-1, "L"), (1, "R")):
        part(
            sphere(
                "eye " + side,
                (s * eye_x, eye_y, eye_z),
                (
                    eye_r,
                    0.014 if natural else 0.053 if lizard else 0.058,
                    eye_r * (0.64 if natural else 0.88 if lizard else 1.04),
                ),
                white,
            ),
            "Eye." + side,
        )
        part(
            sphere(
                "pupil " + side,
                (s * eye_x + 0.008, eye_y - (0.017 if natural else 0.054), eye_z),
                (0.022 if lizard else 0.015, 0.010, 0.026 if lizard else 0.02),
                ink,
            ),
            "Eye." + side,
        )
        part(
            sphere(
                "catchlight " + side,
                (
                    s * eye_x + 0.001,
                    eye_y - (0.028 if natural else 0.066),
                    eye_z + 0.01,
                ),
                (0.005, 0.003, 0.005),
                white,
            ),
            "Eye." + side,
        )
        r = eye_r + 0.010
        points = [
            (
                s * eye_x + r * math.cos(a * math.tau / 32),
                eye_y - (0.037 if natural else 0.061),
                eye_z + r * math.sin(a * math.tau / 32),
            )
            for a in range(33)
        ]
        part(tube("round glasses", points, 0.004, metal), "Head")
        part(
            tube(
                "spectacle temple",
                [
                    (s * (eye_x + r), eye_y - (0.036 if natural else 0.06), eye_z),
                    (s * (head_scale[0] + 0.011), 0.015, eye_z + 0.006),
                ],
                0.005,
                metal,
            ),
            "Head",
        )
        part(
            tube(
                "brow",
                [
                    (s * eye_x - 0.056, eye_y + 0.022, eye_z + eye_r + 0.034),
                    (s * eye_x, eye_y + 0.007, eye_z + eye_r + 0.043),
                    (s * eye_x + 0.05, eye_y + 0.022, eye_z + eye_r + 0.028),
                ],
                0.009,
                hair,
            ),
            "Head",
        )
    part(
        tube(
            "glasses bridge",
            [
                (-eye_x + eye_r, eye_y - (0.036 if natural else 0.060), eye_z + 0.015),
                (0, eye_y - (0.041 if natural else 0.065), eye_z + 0.02),
                (eye_x - eye_r, eye_y - (0.036 if natural else 0.060), eye_z + 0.015),
            ],
            0.005,
            metal,
        ),
        "Head",
    )
    nose_size = (
        (0.055, 0.15, 0.055)
        if yellow
        else (0.025, 0.056, 0.065) if angular else (0.033, 0.050, 0.048)
    )
    if lizard:
        part(
            sphere(
                "broad lizard muzzle",
                (0, -0.225, head_z - 0.080),
                (0.161, 0.103, 0.073),
                skin,
            ),
            "Head",
        )
        part(
            sphere(
                "defined lower jaw",
                (0, -0.205, head_z - 0.157),
                (0.147, 0.089, 0.062),
                skin,
            ),
            "Head",
        )
        for x in (-0.037, 0.037):
            part(
                sphere(
                    "nostril", (x, -0.322, head_z - 0.060), (0.010, 0.005, 0.007), ink
                ),
                "Head",
            )
    else:
        part(
            sphere("nose", (0, eye_y - 0.021, head_z - 0.012), nose_size, skin), "Head"
        )
    mouth_z = head_z - 0.135
    if lizard:
        part(
            tube(
                "relaxed lizard smile",
                [
                    (-0.13, -0.266, mouth_z + 0.012),
                    (-0.074, -0.305, mouth_z - 0.003),
                    (0, -0.315, mouth_z - 0.008),
                    (0.079, -0.303, mouth_z + 0.001),
                    (0.132, -0.264, mouth_z + 0.025),
                ],
                0.006,
                mouth,
            ),
            "Head",
        )
    else:
        part(
            sphere(
                "smile",
                (0, -head_scale[1] * 0.89, mouth_z),
                (0.085, 0.035, 0.052 if angular else 0.027),
                mouth,
            ),
            "Head",
        )
        part(
            box(
                "smile teeth",
                (0, -head_scale[1] * 0.89 - 0.021, mouth_z + 0.007),
                (0.107, 0.01, 0.016),
                white,
                0.006,
            ),
            "Head",
        )

    bones = {
        "Root": ((0, 0, 0), (0, 0, 0.20), None),
        "Hips": ((0, 0, 0.68), (0, 0, 0.81), "Root"),
        "Spine": ((0, 0, 0.81), (0, 0, 1.12), "Hips"),
        "Head": ((0, 0, 1.12), (0, 0, 1.49), "Spine"),
    }
    for s, side in ((-1, "L"), (1, "R")):
        bones["Eye." + side] = (
            (s * eye_x, eye_y, eye_z),
            (s * eye_x, eye_y, eye_z + 0.05),
            "Head",
        )
        shoulder = s * (width + 0.022)
        elbow = s * (width + 0.065)
        wrist = s * (width + 0.070)
        bones["Arm." + side] = ((shoulder, 0, 1.045), (elbow, 0, 0.82), "Spine")
        bones["Forearm." + side] = (
            (elbow, 0, 0.82),
            (wrist, -0.025, 0.61),
            "Arm." + side,
        )
        bones["Hand." + side] = (
            (wrist, -0.025, 0.61),
            (wrist, -0.035, 0.52),
            "Forearm." + side,
        )
        part(
            sphere(
                "t shirt sleeve", (shoulder, 0, 1.015), (0.099, 0.115, 0.123), shirt
            ),
            "Arm." + side,
        )
        part(
            sphere(
                "upper arm",
                ((shoulder + elbow) / 2, 0, 0.905),
                (0.069, 0.069, 0.15),
                skin,
            ),
            "Arm." + side,
        )
        part(
            sphere("forearm", (wrist, -0.01, 0.717), (0.060, 0.061, 0.136), skin),
            "Forearm." + side,
        )
        part(
            sphere("hand", (wrist, -0.03, 0.557), (0.061, 0.044, 0.075), skin),
            "Hand." + side,
        )
        part(
            sphere(
                "thumb", (wrist - s * 0.045, -0.045, 0.578), (0.026, 0.028, 0.044), skin
            ),
            "Hand." + side,
        )
        hip = s * 0.11
        bones["Thigh." + side] = ((hip, 0, 0.68), (hip, 0, 0.365), "Hips")
        bones["Shin." + side] = ((hip, 0, 0.365), (hip, 0, 0.075), "Thigh." + side)
        bones["Foot." + side] = ((hip, 0, 0.075), (hip, -0.14, 0.06), "Shin." + side)
        part(
            sphere("trouser thigh", (hip, 0, 0.525), (0.098, 0.13, 0.205), pants),
            "Thigh." + side,
        )
        part(
            sphere(
                "lower leg",
                (hip, 0, 0.215),
                (0.081, 0.085, 0.174),
                skin if lizard else pants,
            ),
            "Shin." + side,
        )
        part(
            sphere(
                "foot",
                (hip, -0.08, 0.065),
                (0.09, 0.165, 0.061),
                skin if lizard else white,
            ),
            "Foot." + side,
        )
    if lizard:
        bones["Tail"] = ((0, 0.10, 0.69), (0, 0.44, 0.44), "Hips")
        bones["TailTip"] = ((0, 0.44, 0.44), (0.15, 0.76, 0.49), "Tail")
        part(
            tube(
                "curved tail",
                [(0, 0.10, 0.69), (0.03, 0.32, 0.48), (0.09, 0.50, 0.39)],
                0.066,
                skin,
            ),
            "Tail",
        )
        part(
            tube(
                "tail tip",
                [(0.09, 0.49, 0.39), (0.28, 0.68, 0.44), (0.37, 0.78, 0.71)],
                0.040,
                skin,
            ),
            "TailTip",
        )
    pieces = refine_character(pieces, style, width, head_z, head_scale, globals())
    from coastal_hair import hair_sculpt

    if lizard:
        keep = []
        for obj, bone in pieces:
            if any(
                m and m.name in ("long black hair", "hair glints")
                for m in obj.data.materials
            ):
                bpy.data.objects.remove(obj, do_unlink=True)
            else:
                keep.append((obj, bone))
        pieces = keep + hair_sculpt(head_z, head_scale, hair, globals())
        from coastal_clothing import cotton_shirt

        # Rebuild the lizard garment as one sewn surface, and replace the blunt
        # tube tail and oval feet with tapered anatomy and individual toes.
        keep = []
        for obj, bone in pieces:
            if (
                any(m and m.name == "Sirui shirt" for m in obj.data.materials)
                or bone.startswith("Tail")
                or obj.name.startswith("foot")
            ):
                bpy.data.objects.remove(obj, do_unlink=True)
            else:
                keep.append((obj, bone))
        pieces = keep + [(cotton_shirt(width, shirt), "Spine")]
        from coastal_sculpt import swept_lock, weld_sculpt

        for obj, bone in list(pieces):
            if bone.startswith(("Arm.", "Forearm.", "Hand.")):
                pieces.remove((obj, bone))
                bpy.data.objects.remove(obj, do_unlink=True)
        from coastal_sculpt import loft

        for side, label in ((-1, "L"), (1, "R")):
            x = side * (width + 0.070)
            arm_piece = loft(
                "continuous lizard arm",
                [
                    (0.59, x, -0.02, 0.043, 0.043),
                    (0.68, x, -0.01, 0.062, 0.06),
                    (0.80, side * (width + 0.065), 0, 0.051, 0.051),
                    (0.91, side * (width + 0.04), 0, 0.054, 0.054),
                    (0.915, side * (width + 0.030), 0, 0.025, 0.030),
                ],
                skin,
                28,
            )
            arm_piece["blendArm"] = label
            pieces.append((arm_piece, "Forearm." + label))
            fingers = [
                sphere("lizard palm", (x, -0.03, 0.558), (0.056, 0.038, 0.065), skin)
            ]
            for j in range(3):
                fingers.append(
                    swept_lock(
                        "rounded finger",
                        [
                            (x + (j - 1) * 0.032, -0.037, 0.548),
                            (x + (j - 1) * 0.039, -0.054, 0.499),
                            (x + (j - 1) * 0.034, -0.042, 0.485),
                        ],
                        [0.019, 0.017, 0.008],
                        skin,
                        sides=10,
                    )
                )
            fingers.append(
                sphere(
                    "opposed thumb",
                    (x - side * 0.052, -0.04, 0.559),
                    (0.023, 0.028, 0.044),
                    skin,
                )
            )
            pieces.append(
                (weld_sculpt(fingers, "three finger hand", 0.005), "Hand." + label)
            )
        for side, label in ((-1, "L"), (1, "R")):
            hip = side * 0.11
            toes = [
                sphere(
                    "lizard instep", (hip, -0.045, 0.077), (0.087, 0.103, 0.072), skin
                )
            ]
            for j in range(3):
                toes.append(
                    sphere(
                        "rounded toe",
                        (
                            hip + (j - 1) * 0.048,
                            -0.133 - (0.024 if j == 1 else 0),
                            0.035,
                        ),
                        (0.031, 0.074, 0.032),
                        skin,
                    )
                )
            pieces.append(
                (weld_sculpt(toes, "three toed foot", 0.005), "Foot." + label)
            )
        tail = swept_lock(
            "continuous tapered tail",
            [
                (0, 0.105, 0.69),
                (0.02, 0.28, 0.54),
                (0.08, 0.48, 0.43),
                (0.21, 0.67, 0.45),
                (0.34, 0.79, 0.59),
                (0.38, 0.81, 0.73),
            ],
            [0.105, 0.081, 0.060, 0.041, 0.021, 0.0015],
            skin,
            sides=16,
        )
        tail["blendTail"] = True
        pieces.append((tail, "Tail"))
        from coastal_sculpt import loft

        pieces.append(
            (
                loft(
                    "shorts waistband and seat",
                    [
                        (0.57, 0, 0.013, 0.161, 0.103),
                        (0.63, 0, 0.013, 0.195, 0.127),
                        (0.718, 0, 0.013, 0.195, 0.123),
                    ],
                    pants,
                    32,
                ),
                "Hips",
            )
        )
    # The natural interpretation has adult head-to-shoulder proportions. Apply
    # the same transform to eyes and their bones, leaving the contact rig intact.
    head_factor = (
        0.76 if natural else 0.89 if angular or yellow else 0.94 if lizard else 1.0
    )
    pivot = Vector((0, 0, 1.12))
    for obj, bone in pieces:
        if bone == "Head" or bone.startswith("Eye."):
            world = obj.matrix_world.copy()
            inv = world.inverted()
            for v in obj.data.vertices:
                v.co = inv @ (pivot + (world @ v.co - pivot) * head_factor)
    for name, (head, tail, parent) in list(bones.items()):
        if name.startswith("Eye."):
            bones[name] = (
                pivot + (Vector(head) - pivot) * head_factor,
                pivot + (Vector(tail) - pivot) * head_factor,
                parent,
            )
    eye_y *= head_factor
    head_z = 1.12 + (head_z - 1.12) * head_factor
    arm_data = bpy.data.armatures.new("Sirui skeleton")
    arm = bpy.data.objects.new("Sirui", arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (head, tail, parent) in bones.items():
        bone = arm_data.edit_bones.new(name)
        bone.head, bone.tail = head, tail
        if parent:
            bone.parent = arm_data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for o, bone in pieces:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        if (
            o.get("blendLeg")
            or o.get("blendPants")
            or o.get("blendArm")
            or o.get("blendShirt")
            or o.get("blendTail")
        ):

            def weight(name, index, value):
                if value > 0.001:
                    vg = o.vertex_groups.get(name) or o.vertex_groups.new(name=name)
                    vg.add([index], value, "REPLACE")

            def clamp(value):
                return min(1, max(0, value))

            for v in o.data.vertices:
                co = o.matrix_world @ v.co
                if o.get("blendPants"):
                    side = "L" if co.x < 0 else "R"
                    hip = clamp((co.z - 0.61) / 0.09)
                    thigh = clamp((co.z - 0.32) / 0.10)
                    weight("Hips", v.index, hip)
                    weight("Thigh." + side, v.index, (1 - hip) * thigh)
                    weight("Shin." + side, v.index, (1 - hip) * (1 - thigh))
                elif o.get("blendTail"):
                    t = clamp((co.y - 0.35) / 0.24)
                    weight("TailTip", v.index, t)
                    weight("Tail", v.index, 1 - t)
                elif o.get("blendLeg"):
                    side = o["blendLeg"]
                    t = clamp((co.z - 0.32) / 0.10)
                    weight("Thigh." + side, v.index, t)
                    weight("Shin." + side, v.index, 1 - t)
                elif o.get("blendArm"):
                    side = o["blendArm"]
                    hand = 1 - clamp((co.z - 0.575) / 0.09)
                    upper = clamp((co.z - 0.77) / 0.10)
                    weight("Hand." + side, v.index, hand)
                    weight("Arm." + side, v.index, upper * (1 - hand))
                    weight("Forearm." + side, v.index, (1 - upper) * (1 - hand))
                else:
                    w = o["blendShirt"]
                    t = clamp((abs(co.x) - w * 0.55) / (w * 0.5)) * clamp(
                        (co.z - 0.76) / 0.10
                    )
                    # The cuff follows the elbow instead of remaining a rigid
                    # shoulder shell when Sirui reaches above the rack.
                    side="L" if co.x<0 else "R"
                    elbow=clamp((.91-co.z)/.10)*.42
                    weight("Arm." + side, v.index, t*(1-elbow))
                    weight("Forearm." + side, v.index, t*elbow)
                    weight("Spine", v.index, 1 - t)
        else:
            vg = o.vertex_groups.new(name=bone)
            vg.add(list(range(len(o.data.vertices))), 1, "REPLACE")
        o.parent = arm
        mod = o.modifiers.new("character skin", "ARMATURE")
        mod.object = arm
        o.select_set(False)
    # One skinned mesh with a small set of primitives/materials, not a draw per hair.
    bpy.ops.object.select_all(action="DESELECT")
    for o, _ in pieces:
        o.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0][0]
    bpy.ops.object.join()
    bpy.context.object.name = "SiruiMesh"
    arm.animation_data_create()
    # Solve the authored hand contacts in Blender, then bake the resulting
    # bone rotations into the exported clips. The browser needs no IK runtime.
    grip_targets, grip_constraints = {}, {}
    for side in ("L", "R"):
        target = empty("contact_grip_" + side)
        constraint = arm.pose.bones["Forearm." + side].constraints.new("IK")
        constraint.target = target
        constraint.chain_count = 2
        constraint.influence = 0
        grip_targets[side], grip_constraints[side] = target, constraint

    def solve_grip(side, goal, influence=1):
        pb = arm.pose.bones
        bpy.context.view_layer.update()
        grip_targets[side].location = goal
        constraint = grip_constraints[side]
        constraint.influence = influence
        bpy.context.view_layer.update()
        names = ("Arm." + side, "Forearm." + side)
        matrices = {name: pb[name].matrix.copy() for name in names}
        constraint.influence = 0
        bpy.context.view_layer.update()
        for name in names:
            pb[name].matrix = matrices[name]
            bpy.context.view_layer.update()

    def solve_fixed_grip(side, goal):
        # A stable elbow plane avoids the IK branch flipping during a pull-up.
        # These are authored armature-space contacts, baked before GLB export.
        pb=arm.pose.bones
        upper,lower,hand=(pb[n+'.'+side] for n in ('Arm','Forearm','Hand'))
        bpy.context.view_layer.update()
        a,b,c=(bone.head.copy() for bone in (upper,lower,hand))
        target=Vector(goal);direction=target-a
        l1=(b-a).length;l2=(c-b).length
        distance=min(direction.length,l1+l2-.00001);direction.normalize()
        along=(l1*l1-l2*l2+distance*distance)/(2*max(distance,.00001))
        bend=Vector((-.7 if side=='L' else .7,-.45,-.4))
        bend-=direction*bend.dot(direction);bend.normalize()
        elbow=a+direction*along+bend*math.sqrt(max(0,l1*l1-along*along))
        for bone,child,destination in ((upper,lower,elbow),(lower,hand,target)):
            pivot=bone.head.copy()
            before=(child.head-pivot).normalized();after=(destination-pivot).normalized()
            turn=before.rotation_difference(after).to_matrix().to_4x4()
            bone.matrix=Matrix.Translation(pivot)@turn@Matrix.Translation(-pivot)@bone.matrix
            bpy.context.view_layer.update()

    clips = (
        "idle",
        "walk",
        "typing",
        "reading",
        "eat",
        "drink",
        "workout",
        "pullup",
        "dip",
        "coffee-prep",
        "carry",
        "soak",
        "lounge",
        "sleep",
    )
    for clip in clips:
        action = bpy.data.actions.new(clip)
        arm.animation_data.action = action
        prior_angles={}
        fixed_contact=clip in ('pullup','dip')
        for frame in range(1, 98, 4 if fixed_contact else 8):
            bpy.context.scene.frame_set(frame)
            phase = (frame - 1) / 96 * math.tau
            for p in arm.pose.bones:
                p.rotation_mode = "XYZ"
                p.rotation_euler = (0, 0, 0)
                p.location = (0, 0, 0)
                p.scale = (1, 1, 1)
            pb = arm.pose.bones
            seated = clip in ("typing", "reading", "eat", "drink", "soak", "lounge")
            if seated:
                # Root's local Y is Blender world Z. Keep hips on the cushion;
                # miniature footrests support the deliberately cartoon proportions.
                pb["Root"].location.y = -0.08
                for side in ("L", "R"):
                    pb["Thigh." + side].rotation_euler.x = -1.48
                    pb["Shin." + side].rotation_euler.x = 1.46
                    pb["Arm." + side].rotation_euler.x = -0.25
                    pb["Forearm." + side].rotation_euler.x = -1.05
            if clip == "typing":
                pb["Head"].rotation_euler.x = 0.12
                pb["Head"].rotation_euler.y = -0.48 + math.sin(phase) * 0.10
                for i, side in enumerate(("L", "R")):
                    pb["Arm." + side].rotation_euler.x = -0.35
                    pb["Forearm." + side].rotation_euler.x = (
                        -1.82 + math.sin(phase * 4 + i * math.pi) * 0.035
                    )
                    pb["Hand." + side].rotation_euler.x = math.sin(phase * 4 + i) * 0.12
            elif clip == "reading":
                pb["Head"].rotation_euler.x = 0.22
                pb["Forearm.R"].rotation_euler.x -= 0.20 * (1 + math.sin(phase))
            elif clip in ("eat", "drink"):
                gesture = (1 - math.cos(phase)) / 2
                pb["Arm.R"].rotation_euler.x = -0.45 - gesture * 1.00
                pb["Forearm.R"].rotation_euler.x = -0.85 - gesture * 0.77
                pb["Hand.R"].rotation_euler.x = -gesture * 0.20
            elif clip == "workout":
                for i, side in enumerate(("L", "R")):
                    pb["Forearm." + side].rotation_euler.x = (
                        -0.15 - (1 - math.cos(phase + i * math.pi)) * 0.90
                    )
            elif clip in ('pullup','dip'):
                effort=(1-math.cos(phase))/2
                pb['Root'].location.y=(.91+.31*effort) if clip=='pullup' else (.24-.19*effort)
                pb['Spine'].rotation_euler.x=.06 if clip=='pullup' else .14
                for side in ('L','R'):
                    pb['Thigh.'+side].rotation_euler.x=-.38
                    pb['Shin.'+side].rotation_euler.x=1.10
                pb['Head'].rotation_euler.x=-.07 if clip=='pullup' else .08
            elif clip in ('coffee-prep','carry'):
                pb['Head'].rotation_euler.x=.17
                pb['Head'].rotation_euler.z=.013*math.sin(phase)
                pb['Arm.R'].rotation_euler.x=-.75
                pb['Forearm.R'].rotation_euler.x=-.80
            elif clip == "walk":
                for i, side in enumerate(("L", "R")):
                    w = math.sin(phase * 2 + i * math.pi)
                    pb["Thigh." + side].rotation_euler.x = w * 0.32
                    pb["Shin." + side].rotation_euler.x = max(0, -w) * 0.50
                    pb["Arm." + side].rotation_euler.x = -w * 0.22
            elif clip in ("soak", "lounge"):
                pb["Spine"].rotation_euler.x = -0.16
                pb["Head"].rotation_euler.z = math.sin(phase) * 0.075
            elif clip == "sleep":
                pb["Root"].rotation_euler.x = -math.pi / 2
                pb["Root"].location.y = 0.67
                pb["Spine"].rotation_euler.x = math.sin(phase) * 0.012
                for side in ("L", "R"):
                    pb["Eye." + side].scale.y = 0.06
            else:
                pb["Head"].rotation_euler.z = math.sin(phase) * 0.07
            if lizard:
                pb["Tail"].rotation_euler.z = math.sin(phase) * 0.13
                pb["TailTip"].rotation_euler.z = math.sin(phase + 0.4) * 0.18
            if clip == "typing":
                for i,side in enumerate(('L','R')):
                    tap=.006*math.sin(phase*4+i*math.pi)
                    solve_grip(side,(-.13 if side=='L' else .13,-.345,.925+tap))
                    hand=pb['Hand.'+side]
                    # Resting fingers point down in the master. In the typing
                    # clip the hand extends along the keyboard, not up at Sirui.
                    yaxis=Vector((0,-1,-.14)).normalized();xaxis=Vector((-1,0,0));zaxis=xaxis.cross(yaxis)
                    basis=Matrix((xaxis,yaxis,zaxis)).transposed().to_4x4()
                    hand.matrix=Matrix.Translation(hand.matrix.translation) @ basis
                    bpy.context.view_layer.update()
            elif clip in ("eat", "drink"):
                solve_grip("R", (0.075, eye_y - 0.11, head_z - 0.28), gesture)
            elif clip == "reading":
                for side, x in (("L", -0.16), ("R", 0.16)):
                    solve_grip(side, (x, -0.36, 1.0))
            elif clip in ('pullup','dip'):
                for side,sign in (('L',-1),('R',1)):
                    solve_fixed_grip(side,(sign*(.30 if clip=='pullup' else .43),-.01,2.37-.048 if clip=='pullup' else 1.24-.048))
            elif clip=='coffee-prep':
                solve_grip('R',(.13,-.49,1.06+.035*math.sin(phase)))
            elif clip=='carry':
                solve_grip('R',(.16,-.30,.91))
            for p in pb:
                if fixed_contact:
                    if p.name in prior_angles:p.rotation_euler.make_compatible(prior_angles[p.name])
                    prior_angles[p.name]=p.rotation_euler.copy()
                p.keyframe_insert(data_path="rotation_euler", frame=frame, group=p.name)
                p.keyframe_insert(data_path="location", frame=frame, group=p.name)
                p.keyframe_insert(data_path="scale", frame=frame, group=p.name)
        track = arm.animation_data.nla_tracks.new()
        track.name = clip
        track.strips.new(clip, 1, action)
        track.mute = True
        arm.animation_data.action = None
    for track in arm.animation_data.nla_tracks:
        track.mute = False
    for side, constraint in grip_constraints.items():
        arm.pose.bones["Forearm." + side].constraints.remove(constraint)
    for target in grip_targets.values():
        bpy.data.objects.remove(target, do_unlink=True)
    arm["identity"] = "Sirui Tao, adult man; long black hair, glasses, clean-shaven"
    arm["avatar"] = style
    bpy.context.scene.frame_set(1)
    export("sirui-" + style, animations=True)
    for track in arm.animation_data.nla_tracks:
        track.mute = track.name != "idle"
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(
        filepath=str(SOURCE / ("sirui-" + style + ".blend")), compress=True
    )
    render_portrait(arm, style, SOURCE)


if "--section-only" in sys.argv or "--coast-only" in sys.argv:
    bpy.ops.wm.open_mainfile(
        filepath=str(
            ROOT
            / (
                ".jekyll-cache/coastal-section.blend"
                if "--coast-only" in sys.argv
                else ".jekyll-cache/coastal-rooms.blend"
            )
        )
    )
    names = {
        "plaster": "chalk limestone",
        "edge": "warm cut stone",
        "wood": "honey ash",
        "oak": "pale oak",
        "cream": "linen",
        "sage": "sage textile",
        "leaf": "olive leaf",
        "ink": "charcoal",
        "brass": "brushed brass",
        "terra": "terracotta",
        "water": "onsen turquoise",
        "glass": "window sea glass",
    }
    finish_home(
        {key: bpy.data.materials[name] for key, name in names.items()},
        "--coast-only" in sys.argv,
    )
elif "--export-only" in sys.argv:
    # Re-export editable sources without repeating mesh authoring or portrait renders.
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE / "coastal-home.blend"))
    for name, prefix in (
        [("home-shell", "core_")]
        + [
            ("room-" + r, r + "_")
            for r in ("study", "sleep", "kitchen", "gym", "onsen", "lounge")
        ]
        + [("coast", "coast_")]
    ):
        export(
            name, [o for o in bpy.context.scene.objects if o.name.startswith(prefix)]
        )
    for avatar in ("lizard", "south-park", "simpsons", "ghibli", "rick-and-morty"):
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE / ("sirui-" + avatar + ".blend")))
        for obj in bpy.context.scene.objects:
            if obj.type == "ARMATURE" and obj.animation_data:
                for track in obj.animation_data.nla_tracks:
                    track.mute = False
        export("sirui-" + avatar, animations=True)
elif (
    "--characters-only" not in sys.argv
    and "--lizard-only" not in sys.argv
    and not any(a.startswith("--avatar=") for a in sys.argv)
):
    home()
if (
    "--house-only" not in sys.argv
    and "--export-only" not in sys.argv
    and "--section-only" not in sys.argv
    and "--coast-only" not in sys.argv
):
    requested_avatar = next(
        (a.split("=", 1)[1] for a in sys.argv if a.startswith("--avatar=")), None
    )
    variants = ("lizard", "south-park", "simpsons", "ghibli", "rick-and-morty")
    if requested_avatar and requested_avatar not in variants:
        raise ValueError("Unknown avatar: " + requested_avatar)
    for avatar in (
        (requested_avatar,)
        if requested_avatar
        else ("lizard",) if "--lizard-only" in sys.argv else variants
    ):
        character(avatar)
print(
    json.dumps(
        {"assets": {p.name: p.stat().st_size for p in OUT.glob("*.glb")}}, indent=2
    )
)
