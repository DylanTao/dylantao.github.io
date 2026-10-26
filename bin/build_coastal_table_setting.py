"""Plated meals, desserts, drinks and the table settings they come with (Sirui, 2026-10-24).

Sirui: "i don't even see food, you should prep differnt gormetn food and drink and deserts for
differnt day". Every dish, glass and piece of cutlery is original code-authored geometry
(bin/coastal_table_geometry.py, bin/coastal_table_dishes.py), retained in
artwork/coastal-home/table-setting.blend and exported per level of detail to
assets/models/home/table-setting/: <name>-lod1.glb is the default, <name>-lod0.glb the close and
full-screen level. index.json describes them for assets/js/home-scene/dining.mjs.

- tableware-lod*.glb: cutlery, chopsticks, the napkin, a saucer, eight glasses, a tea cup and the
  drinks' garnishes, one node per item (extras `diningItem`).
- dish-<id>-lod*.glb: one plated dish, its vessel and its food. Food carries its colour in
  vertices, multiplied by a Cycles contact-light bake as the rest of the house is, and the piece
  each vertex belongs to in TEXCOORD_0.x (0 stays, 1.. in eating order); index.json lists each
  piece's top centre so the fork can reach it.

The settings' layouts (in the seated actor's frame), each avatar's mouth and palm, and the coffee
bar's own cup are runtime data written beside the geometry; see SETTINGS, AVATARS and CUP below for
their sources. No downloaded model, scan or texture is used.

Run from the repository root with Blender 4.5 LTS:
  blender -b --factory-startup --python-exit-code 1 --python bin/build_coastal_table_setting.py
  ... -- --item=salmon,tableware   only these (index.json keeps the others)
  ... -- --no-bake                  skip the contact-light bake (quick geometry checks)
  ... -- --review                   Cycles stills to .jekyll-cache/visual-qa/life-2026-10-24/table-setting/
"""

import hashlib
import json
import math
import sys
import time
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_table_geometry import DRINKS, LODS, MATERIALS, TABLEWARE, Build, material, srgb  # noqa: E402
from coastal_table_dishes import DISHES  # noqa: E402

OUT = ROOT / "assets" / "models" / "home" / "table-setting"
SOURCE = ROOT / "artwork" / "coastal-home" / "table-setting.blend"
REVIEW_DIR = ROOT / ".jekyll-cache" / "visual-qa" / "life-2026-10-24" / "table-setting"
ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def option(name, default=None):
    for a in ARGS:
        if a == f"--{name}":
            return True
        if a.startswith(f"--{name}="):
            return a.split("=", 1)[1]
    return default


ONLY = set(option("item").split(",")) if option("item") else None
BAKE = not option("no-bake")
REVIEW = bool(option("review"))

# ── Runtime data ─────────────────────────────────────────────────────────────────────────────────
# Seat frames are the rooms' actor anchors (manifest rooms[].actor/facing): three.js metres, +x the
# HandR side, +y up, +z forward. The nook's table top is 0.795 above the kitchen anchor (its
# 0.74 m table on the 0.42 m sunken floor, bin/coastal_kitchen.py); the runtime measures it from the
# room's triangles at `probe`. While the room still carries its own plate at `charger.at`, the dish
# stacks on it; otherwise it sits at `plate`, and the other pieces keep their places around it.
SETTINGS = {
    "kitchen": {
        "surface": 0.795,
        "probe": [0.22, 0.86],
        "charger": {"at": [-0.01, 0.55]},
        "plate": [-0.01, 0.43],
        "around": {
            "fork": [0.19, -0.02],
            "napkin": [0.19, -0.015],
            "knife": [-0.175, -0.01],
            "glass": [-0.2, 0.2],
            "saucer": [0.24, 0.14],
            "dessert": [-0.06, 0.38],
            "aside": [0.27, 0.31],
        },
        "napkinHeight": 0.009,
        "cupHold": [0.06, 0.16, 0.25],
    },
    # The sofa has no table: the evening glass rests in the hand on the thigh.
    "lounge": {"knee": [0.12, 0.62, 0.3]},
}
# Mouths in each avatar's Head-bone frame (+y up the bone, +z forward), measured from the retained
# sources' mouth surfaces (centre height, front lip); palms are the hand surfaces' half-thickness.
AVATARS = {
    # nookLift: the Lizard sits 1.2 cm into the nook's banquette cushion in its own seated clips.
    "lizard": {"mouth": [0.0, 0.163, 0.275], "palm": 0.036, "nookLift": 0.012},
    "south-park": {"mouth": [0.0, 0.008, 0.19], "palm": 0.033},
    "simpsons": {"mouth": [0.0, 0.143, 0.15], "palm": 0.03},
    "ghibli": {"mouth": [0.0, 0.094, 0.088], "palm": 0.03},
    "rick-and-morty": {"mouth": [0.0, 0.137, 0.13], "palm": 0.03},
    "default": {"mouth": [0.0, 0.12, 0.15], "palm": 0.03},
}
# The coffee bar's authored cup (room-kitchen.glb kitchen_espresso_cup, measured in the browser):
# 9.7 cm tall, its group origin 4.7 cm above its base, the handle 7.4 cm off its axis toward -z.
CUP = {"rim": 0.097, "rimRadius": 0.052, "originHeight": 0.047, "gripRadius": 0.064, "gripHeight": 0.045, "handle": True, "saucerLift": 0.012, "cremaDrop": 0.05}


# ── Realize, bake, export ────────────────────────────────────────────────────────────────────────


def to_mesh(name, bm, mat):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material(mat))
    me.set_sharp_from_angle(angle=math.radians(50))
    return me


def realize(build, collection, parent=None, extras=None):
    root = bpy.data.objects.new(f"{build.name}.lod{build.lod}", None)
    root.empty_display_size = 0.05
    collection.objects.link(root)
    if parent:
        root.parent = parent
    for k, v in (extras or {}).items():
        root[k] = v
    objects = []
    for mat, bm in build.groups.items():
        label = f"{build.name}.lod{build.lod}__{mat}"
        obj = bpy.data.objects.new(label, to_mesh(label, bm, mat))
        collection.objects.link(obj)
        obj.parent = root
        objects.append(obj)
    return root, objects


def finish_colours(objects, ao_by_object):
    """COLOR_0: painted albedo or white, times the contact light; glass keeps no colour at all."""
    for o in objects:
        me = o.data
        spec = MATERIALS[me.materials[0].name]
        if spec.get("clear"):
            for a in list(me.color_attributes):
                me.color_attributes.remove(a)
        else:
            ao = ao_by_object.get(o.name)
            # A new attribute can reallocate the others: look the albedo up after creating it.
            me.color_attributes.new(name="Baked colour", type="BYTE_COLOR", domain="CORNER")
            out = me.color_attributes["Baked colour"]
            albedo = me.color_attributes.get("albedo")
            colours = [tuple(d.color) for d in albedo.data] if (albedo and spec.get("painted")) else None
            out = me.color_attributes["Baked colour"]
            for i in range(len(me.loops)):
                base = colours[i] if colours else (1.0, 1.0, 1.0, 1.0)
                # Food and tableware are small: a gentler contact light than the rooms' 0.70-1.0
                # keeps cut seams from reading as dark lines.
                light = 0.82 + 0.18 * (ao[i] if ao is not None else 1.0)
                light = round(light * 32) / 32
                out.data[i].color = (base[0] * light, base[1] * light, base[2] * light, 1.0)
            for name in ("albedo", "ao"):
                if me.color_attributes.get(name):
                    me.color_attributes.remove(me.color_attributes[name])
            me.color_attributes.active_color = me.color_attributes["Baked colour"]
            me.color_attributes.render_color_index = me.color_attributes.find("Baked colour")
        # Only food keeps its piece numbers; other meshes drop the unused UV map.
        uv = me.uv_layers.active
        if uv is not None and not any(abs(d.uv.x) > 0.5 for d in uv.data):
            me.uv_layers.remove(uv)


def bake_ao(objects, collection, distance=0.12, samples=24):
    """Cycles ambient occlusion per corner, as bin/build_coastal_furniture.py bakes the furniture."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.world = scene.world or bpy.data.worlds.new("Setting bake")
    scene.world.light_settings.distance = distance
    for col in bpy.data.collections:
        for o in col.objects:
            o.hide_render = col is not collection
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, -0.0005))
    floor = bpy.context.object
    targets = [o for o in objects if not MATERIALS[o.data.materials[0].name].get("clear")]
    for o in objects:
        if o not in targets:
            o.hide_render = True
    result = {}
    if targets:
        bpy.ops.object.select_all(action="DESELECT")
        for o in targets:
            attr = o.data.color_attributes.new(name="ao", type="FLOAT_COLOR", domain="CORNER")
            o.data.color_attributes.active_color = attr
            o.select_set(True)
        bpy.context.view_layer.objects.active = targets[0]
        scene.render.bake.target = "VERTEX_COLORS"
        bpy.ops.object.bake(type="AO", use_clear=True)
        for o in targets:
            data = o.data.color_attributes["ao"].data
            result[o.name] = [max(0.0, min(1.0, d.color[0])) for d in data]
    bpy.data.objects.remove(floor, do_unlink=True)
    for col in bpy.data.collections:
        for o in col.objects:
            o.hide_render = False
    return result


def export(root, path):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=8,
    )


def triangles(objects):
    total = 0
    for o in objects:
        o.data.calc_loop_triangles()
        total += len(o.data.loop_triangles)
    return total


def to_three(p):
    return [round(p[0], 4), round(p[2], 4), round(-p[1], 4)]


def piece_tops(objects, count):
    """Each piece's top centre (three.js frame): where the fork comes down on it."""
    found = {}
    for o in objects:
        me = o.data
        uv = me.uv_layers.active
        if uv is None:
            continue
        for poly in me.polygons:
            piece = int(round(uv.data[poly.loop_indices[0]].uv.x))
            if piece <= 0:
                continue
            e = found.setdefault(piece, {"sum": Vector(), "n": 0, "top": -1.0})
            for vi in poly.vertices:
                co = o.matrix_world @ me.vertices[vi].co
                e["sum"] += co
                e["n"] += 1
                e["top"] = max(e["top"], co.z)
    out = []
    for piece in range(1, count + 1):
        e = found.get(piece)
        if not e:
            raise RuntimeError(f"piece {piece} of {count} has no geometry")
        c = e["sum"] / e["n"]
        out.append(to_three((c.x, c.y, e["top"])))
    return out


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def review(collection, objects, path, direction=(0.0, 0.9, 1.1), size=None):
    scene = bpy.context.scene
    for col in bpy.data.collections:
        for o in col.objects:
            o.hide_render = col is not collection
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in objects:
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            lo, hi = Vector(map(min, lo, p)), Vector(map(max, hi, p))
    centre = (lo + hi) / 2
    extent = size or (hi - lo).length
    cam_data = bpy.data.cameras.new("review camera")
    cam_data.lens = 70
    cam = bpy.data.objects.new("review camera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = centre + Vector(direction).normalized() * extent * 2.1
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    sun_data = bpy.data.lights.new("review sun", "SUN")
    sun_data.energy = 3.0
    sun_data.angle = math.radians(8)
    sun = bpy.data.objects.new("review sun", sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(40), 0, math.radians(-30))
    world = scene.world or bpy.data.worlds.new("review world")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.8, 0.76, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
    bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, -0.0005))
    floor = bpy.context.object
    floor_mat = bpy.data.materials.get("review travertine") or bpy.data.materials.new("review travertine")
    floor_mat.use_nodes = True
    floor_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*srgb((214, 196, 166)), 1)
    floor.data.materials.append(floor_mat)
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 40
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 900, 700
    scene.view_settings.view_transform = "AgX"
    scene.render.filepath = str(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    for thing in (cam, sun, floor):
        bpy.data.objects.remove(thing, do_unlink=True)
    for col in bpy.data.collections:
        for o in col.objects:
            o.hide_render = False


def build_tableware(lod, scene):
    collection = bpy.data.collections.new(f"tableware LOD{lod}")
    scene.collection.children.link(collection)
    root = bpy.data.objects.new(f"tableware.lod{lod}", None)
    collection.objects.link(root)
    items, objects_all = {}, []
    for name, builder in TABLEWARE.items():
        b = Build(name, lod)
        builder(b)
        # Each item is baked on its own (they all stand at the origin) in a scratch collection.
        scratch = bpy.data.collections.new(f"{name} LOD{lod}")
        scene.collection.children.link(scratch)
        item_root, objects = realize(b, scratch, extras={"diningItem": name})
        ao = bake_ao(objects, scratch) if BAKE else {}
        finish_colours(objects, ao)
        for o in [item_root, *objects]:
            scratch.objects.unlink(o)
            collection.objects.link(o)
        bpy.data.collections.remove(scratch)
        item_root.parent = root
        objects_all += objects
        meta = dict(b.meta)
        meta["triangles"] = triangles(objects)
        items[name] = meta
    path = OUT / f"tableware-lod{lod}.glb"
    export(root, path)
    return items, {"file": path.name, "triangles": triangles(objects_all), "bytes": path.stat().st_size, "sha256": sha256(path)}


def build_dish(name, lod, scene):
    collection = bpy.data.collections.new(f"dish {name} LOD{lod}")
    scene.collection.children.link(collection)
    b = Build(name, lod)
    count = DISHES[name](b)
    root, objects = realize(b, collection, extras={"diningDish": name})
    ao = bake_ao(objects, collection) if BAKE else {}
    finish_colours(objects, ao)
    tops = piece_tops(objects, count)
    path = OUT / f"dish-{name}-lod{lod}.glb"
    export(root, path)
    if REVIEW and lod == 0:
        review(collection, objects, REVIEW_DIR / f"dish-{name}.png")
    return b.meta, tops, {"file": path.name, "triangles": triangles(objects), "bytes": path.stat().st_size, "sha256": sha256(path)}


def main():
    started = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    index_path = OUT / "index.json"
    previous = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}
    index = {
        "version": 1,
        "axes": "glTF/three.js metres, +y up. A dish stands with its vessel's base centred at the origin and the diner toward -z; a utensil's working end is at its origin with its handle along -z and its face up +y; a vessel stands on its base at the origin.",
        "tableware": previous.get("tableware", {}),
        "dishes": previous.get("dishes", {}),
        "drinks": {k: {**v, "color": list(v["color"]), **({"top": list(v["top"])} if "top" in v else {})} for k, v in DRINKS.items()},
        "settings": SETTINGS,
        "avatars": AVATARS,
    }
    if not ONLY or "tableware" in ONLY:
        levels = {}
        items = {}
        for lod in LODS:
            meta, level = build_tableware(lod, scene)
            levels[lod] = level
            if lod == 0:
                items = meta
            print(f"TABLEWARE lod{lod}: {level['triangles']} triangles, {level['bytes']} bytes", flush=True)
        items["cup"] = CUP
        index["tableware"] = {
            "lods": [{**levels[1]}, {**levels[0], "near": 1.9, "fullscreen": True}],
            "items": items,
        }
    for name in DISHES:
        if ONLY and name not in ONLY:
            continue
        levels, meta, tops = {}, None, None
        for lod in LODS:
            m, t, level = build_dish(name, lod, scene)
            levels[lod] = level
            if lod == 0:
                meta, tops = m, t
            print(f"DISH {name} lod{lod}: {level['triangles']} triangles, {level['bytes']} bytes, {len(t)} pieces", flush=True)
        index["dishes"][name] = {
            "lods": [{**levels[1]}, {**levels[0], "near": 1.9, "fullscreen": True}],
            "bites": tops,
            **{k: v for k, v in meta.items() if k in ("vessel", "radius", "inner")},
        }
    index["dishes"] = dict(sorted(index["dishes"].items()))
    OUT.mkdir(parents=True, exist_ok=True)
    index_path.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8", newline="\n")
    if not ONLY or option("save"):
        bpy.context.preferences.filepaths.save_version = 0
        SOURCE.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
    print(f"TABLE SETTING done in {time.time() - started:.1f} s", flush=True)


if __name__ == "__main__":
    main()
