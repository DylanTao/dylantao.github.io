"""Glaze the cave mouth, carve the terrace and screen the alcoves (Sirui, 2026-10-14); see coastal_facade.py.

Run with Blender 4.5 LTS from the repository root:
  blender -b --python-exit-code 1 --python bin/refresh_coastal_facade.py [-- --preview=DIR]
then bin/bake_coastal_light.py and bin/optimize_coastal_exports.py -- --interiors-only.
With --preview the house is built and rendered from the room cameras into DIR without saving.
Re-running replaces the previous front, terrace and screens.
"""

import json
import math
import sys
from pathlib import Path
import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_decor as decor
import coastal_facade as facade

SOURCE = ROOT / "artwork/coastal-home/coastal-home.blend"
MANIFEST = ROOT / "assets/models/home/manifest.json"
preview = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--preview=")), None)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
for obj in [o for o in bpy.data.objects if o.get("facade")]:
    bpy.data.objects.remove(obj, do_unlink=True)


def components(obj):
    """Connected vertex islands of a mesh, as lists of vertex indices."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    seen, islands = set(), []
    for start in bm.verts:
        if start.index in seen:
            continue
        stack, island = [start], []
        seen.add(start.index)
        while stack:
            v = stack.pop()
            island.append(v.index)
            for e in v.link_edges:
                w = e.other_vert(v)
                if w.index not in seen:
                    seen.add(w.index)
                    stack.append(w)
        islands.append(island)
    bm.free()
    return islands


def move_group(prefix, lo, hi, delta):
    """Move every island of a room's meshes that lies inside a world box (one potted plant)."""
    moved = []
    for obj in [o for o in scene.objects if o.type == "MESH" and o.name.startswith(prefix)]:
        world = obj.matrix_world
        local = world.inverted().to_3x3() @ Vector(delta)
        for island in components(obj):
            points = [world @ obj.data.vertices[i].co for i in island]
            if all(lo[k] <= min(p[k] for p in points) and max(p[k] for p in points) <= hi[k] for k in range(3)):
                for i in island:
                    obj.data.vertices[i].co += local
                moved.append({"mesh": obj.name, "vertices": len(island), "maxY": round(max(p.y for p in points) + delta[1], 3)})
        obj.data.update()
    return moved


report = {"plants": scene.get("facadePlantsMoved")}
if not scene.get("facadePlantsMoved"):
    # Two potted plants stood where the door tracks now run; each moves back as one piece.
    report["plants"] = {
        "kitchen": move_group("kitchen_", (-4.7, 3.9, -0.02), (-4.0, 4.5, 1.0), (0, -0.2, 0)),
        "lounge": move_group("lounge_", (3.55, 3.7, -0.02), (4.8, 4.75, 1.5), (0, -0.46, 0)),
    }
    scene["facadePlantsMoved"] = True

mats = bpy.data.materials
stone, rock, cedar = mats["warm cut stone"], mats["golden coastal sandstone"], mats["cedar wood"]
bronze = decor.material("dark bronze", (0.075, 0.058, 0.042), 0.38, 0.9)
glass = decor.material("facade low-iron glass", (0.78, 0.86, 0.85), 0.04)
pieces = facade.front(bronze, glass, stone)
travertine = decor.material("travertine paving stone", (0.79, 0.71, 0.59), 0.8)
terrace_mats = {
    "teak": decor.material("weathered teak wood", (0.47, 0.37, 0.27), 0.7),
    "canvas": decor.material("outdoor canvas cotton", (0.84, 0.8, 0.71), 0.92),
    "rock": rock,
    "copper": decor.material("aged copper", (0.42, 0.24, 0.15), 0.42, 0.85),
    "charred": decor.material("charred oak wood", (0.06, 0.05, 0.045), 0.9),
    "bronze": bronze,
    "travertine": travertine,
    "terracotta": mats["terracotta"],
    "leaf": mats["olive leaf"],
    "bark": decor.material("olive bark wood", (0.3, 0.27, 0.22), 0.85),
    "rosemary": decor.material("rosemary leaf", (0.24, 0.32, 0.24), 0.75),
    "embers": decor.material("fire bowl embers", (0.09, 0.05, 0.035), 0.95),
}
pieces.append(facade.ledge(rock))
paving, tiles = facade.paving(travertine)
pieces.append(paving)
pieces += facade.parapet(rock, travertine, glass, bronze)
festoon, bulbs = facade.festoon(bronze, decor.material("festoon cable", (0.03, 0.03, 0.03), 0.6), decor.material("festoon bulb glass", (0.95, 0.84, 0.62), 0.2))
pieces += festoon
pieces += facade.furniture(terrace_mats)
pieces.append(facade.screens(cedar))

# Join plain pieces that share a material; doors, the lunette and the lit parts stay separate.
keep = {o.name for o in pieces if o.get("facadeDoor") or o.get("caveRoof")} | {"core_terrace_fire_embers", "core_terrace_festoon_bulbs"}
by_material = {}
for obj in pieces:
    if obj.name in keep:
        continue
    by_material.setdefault(obj.data.materials[0].name, []).append(obj)
joined = [o for o in pieces if o.name in keep]
for name, group in by_material.items():
    slug = name.replace(" ", "_")
    joined.append(decor.join(group, f"core_facade__{slug}"))
for obj in joined:
    obj["facade"] = True

# Measurements: the glass plane must clear every room mesh, in both door positions.
def clearance(obj, others, offset=0.0):
    from mathutils.bvhtree import BVHTree
    graph = bpy.context.evaluated_depsgraph_get()
    mesh = obj.evaluated_get(graph).to_mesh()
    tree = BVHTree.FromPolygons([obj.matrix_world @ v.co + Vector((offset, 0, 0)) for v in mesh.vertices], [tuple(p.vertices) for p in mesh.polygons])
    obj.evaluated_get(graph).to_mesh_clear()
    hits = []
    for other in others:
        m = other.evaluated_get(graph).to_mesh()
        t = BVHTree.FromPolygons([other.matrix_world @ v.co for v in m.vertices], [tuple(p.vertices) for p in m.polygons])
        other.evaluated_get(graph).to_mesh_clear()
        if tree.overlap(t):
            hits.append(other.name)
    return hits


rooms = [o for o in scene.objects if o.type == "MESH" and o.name.startswith(("kitchen_", "lounge_", "gym_"))]
doors = {o["facadeDoor"]: o for o in joined if o.get("facadeDoor")}
report["doors"] = {
    name: {"slideX": obj["slideX"], "closedHits": clearance(obj, rooms), "openHits": clearance(obj, rooms, obj["slideX"])}
    for name, obj in doors.items()
}
fixed = [o for o in joined if o.name == "core_facade__facade_low-iron_glass"]
report["glassHits"] = clearance(fixed[0], rooms) if fixed else None
outline = facade.outline()
report["terrace"] = {
    "areaSquareMeters": round(abs(facade.area(outline)), 2),
    "deepestMeters": facade.TERRACE["depth"],
    "pavers": tiles,
    "festoonBulbs": len(bulbs),
    "parapetMeters": round(sum(math.dist(a, b) for a, b in zip(facade.parapet_path(), facade.parapet_path()[1:])), 2),
}
report["objects"] = sorted(o.name for o in joined)

# The browser reads the doors, the terrace lights and the glass plane from the manifest.
three = lambda v: [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]
config = json.loads(MANIFEST.read_text(encoding="utf-8"))
config["facade"] = {
    "glass": "facade low-iron glass",
    "planeZ": -facade.FACADE_Y,
    "xRange": [-5.2, 5.2],
    "doors": [{"id": name, "node": obj.name, "slideX": obj["slideX"], "opening": [round(facade.DOORS[name][0], 3), round(facade.DOORS[name][1], 3)]} for name, obj in doors.items()],
}
points = facade.festoon_points()
config["terrace"] = {
    "festoon": {"points": [three(p) for p in points], "sag": facade.FESTOON["sag"], "bulbs": [three(p) for p in bulbs]},
    "fire": three((-3.95, 6.1, 0.38)),
    "region": {"min": [-5.4, -0.6, -7.8], "max": [5.4, 3.4, -4.4]},
}
for room in config["rooms"]:
    room["camera"]["envelope"].pop("facade", None)
# Zooming into the kitchen or lounge walks the camera in through the doorway; it only keeps a
# hand's width off the glass so its near plane never slices a pane.
config["cameraCollision"]["facade"] = {"planeZ": -facade.FACADE_Y, "xRange": [-5.25, 5.25], "top": 6.1, "clearance": 0.12}
if not preview:
    MANIFEST.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")


def render_views(directory):
    out = Path(directory)
    out.mkdir(parents=True, exist_ok=True)
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light, shading.color_type = "STUDIO", "MATERIAL"
    shading.show_shadows, shading.show_cavity = True, True
    scene.render.resolution_x, scene.render.resolution_y = 1300, 1000
    camera_data = bpy.data.cameras.new("facade preview")
    camera = bpy.data.objects.new("facade preview", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    roof = [o for o in scene.objects if o.get("caveRoof") or o.get("shadowOnly")]
    # The browser's glass is nearly clear; Workbench honours the viewport colour's alpha.
    glass.diffuse_color = (0.8, 0.9, 0.9, 0.12)
    def web(v):
        return Vector((v[0], -v[2], v[1]))
    views = {
        "plan": None,
        "overview": (Vector((-2.65, 16.41, 9.36)), Vector((0, -0.2, 1.65)), True),
        "outside": (Vector((-11.9, 48.2, 17.2)), Vector((3, 6, -0.2)), False),
        "terrace": (Vector((-6.2, 11.5, 3.6)), Vector((0.5, 4.8, 0.6)), False),
        "terrace-north": (Vector((6.5, 9.0, 2.4)), Vector((-1.5, 5.4, 0.7)), False),
    }
    for room in config["rooms"]:
        c = room["camera"]
        t = room["target"]
        p = [t[0] + math.sin(c["yaw"]) * math.cos(c["pitch"]) * c["radius"], t[1] + math.sin(c["pitch"]) * c["radius"], t[2] + math.cos(c["yaw"]) * math.cos(c["pitch"]) * c["radius"]]
        views[room["id"]] = (web(p), web(t), True)
        if room["id"] in ("kitchen", "lounge"):
            views[room["id"] + "-night"] = (web(p), web(t), True)
    for name, view in views.items():
        # Daytime doors stand open in the jambs; the -night views show them closed.
        for door_obj in doors.values():
            door_obj.location.x = 0 if name.endswith("-night") else door_obj["slideX"]
        if view is None:
            camera_data.type, camera_data.ortho_scale = "ORTHO", 13.5
            camera.location, camera.rotation_euler = (0, 5.2, 20), (0, 0, math.pi)
            hide = True
        else:
            eye, target, hide = view
            camera_data.type, camera_data.sensor_fit, camera_data.angle_y = "PERSP", "VERTICAL", math.radians(38)
            camera.location = eye
            camera.rotation_euler = (target - eye).to_track_quat("-Z", "Y").to_euler()
        for o in roof:
            o.hide_render = hide
        scene.render.filepath = str(out / f"{name}.png")
        bpy.ops.render.render(write_still=True)
    for o in roof:
        o.hide_render = False
    bpy.data.objects.remove(camera, do_unlink=True)


if preview:
    render_views(preview)
    (Path(preview) / "facade.json").write_text(json.dumps(report, indent=2) + "\n")
else:
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
    (ROOT / "artwork/coastal-home/reviews/facade.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2), flush=True)
