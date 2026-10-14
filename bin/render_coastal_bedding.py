"""Render the sleep room's bedding with each sleeping avatar for review (not shipped).

Run with Blender 4.5 LTS after refresh_coastal_bedding.py:
  blender -b --python-exit-code 1 --python bin/render_coastal_bedding.py -- [--out=DIR] [--avatars=a,b]
Writes <avatar>-room.png (the browser's sleep camera) and <avatar>-close.png per avatar.
"""

import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_bedding import AVATARS, sleepers

SOURCE = ROOT / "artwork/coastal-home"
args = {a.split("=", 1)[0][2:]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
out = Path(args.get("out", ROOT / ".jekyll-cache/visual-qa/bedding"))
out.mkdir(parents=True, exist_ok=True)
chosen = args.get("avatars", ",".join(("empty",) + AVATARS)).split(",")
bodies = sleepers(SOURCE, frames=(25,)) if any(a != "empty" for a in chosen) else []
bpy.ops.wm.open_mainfile(filepath=str(SOURCE / "coastal-home.blend"))
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "CUDA"
prefs.get_devices()
for device in prefs.devices:
    device.use = device.type == "CUDA"
scene.cycles.device = "GPU"
scene.render.resolution_x, scene.render.resolution_y = 960, 760
scene.world = scene.world or bpy.data.worlds.new("Review sky")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.75, 0.82, 0.9, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
# Interiors only: lift the roof away as the browser does.
for obj in scene.objects:
    if obj.get("caveRoof"):
        obj.hide_render = True
bpy.ops.object.light_add(type="SUN", location=(0, 0, 20))
sun = bpy.context.object
sun.data.energy = 3.2
sun.rotation_euler = (math.radians(38), math.radians(-12), math.radians(-35))
skin = bpy.data.materials.new("review skin")
skin.use_nodes = True
skin.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.75, 0.55, 0.42, 1)


def look(camera, eye, target, lens_fov=38):
    camera.location = eye
    camera.rotation_euler = (Vector(target) - Vector(eye)).to_track_quat("-Z", "Y").to_euler()
    camera.data.sensor_fit = "VERTICAL"
    camera.data.angle = math.radians(lens_fov)


def orbit(target, radius, yaw, pitch):
    # The browser camera (three.js, Y up) mapped to Blender (Z up, Y = -three Z).
    tx, ty, tz = target
    x = tx + math.sin(yaw) * math.cos(pitch) * radius
    up = ty + math.sin(pitch) * radius
    z = tz + math.cos(yaw) * math.cos(pitch) * radius
    return (x, -z, up), (tx, -tz, ty)


bpy.ops.object.camera_add()
camera = bpy.context.object
scene.camera = camera
views = {"room": orbit((-3.1, 3.32, 3.3), 4.4, 2.6, 0.38), "close": ((-0.9, -2.2, 4.6), (-3.1, -3.2, 3.15))}
for avatar in chosen:
    for obj in scene.objects:
        if obj.get("bedding"):
            obj.hide_render = obj["bedding"] != avatar
    temporary = []
    for k, body in enumerate(b for b in bodies if b["avatar"] == avatar):
        data = bpy.data.meshes.new(f"review sleeper {k}")
        data.from_pydata([tuple(p) for p in body["points"]], [], body["triangles"])
        data.update()
        for face in data.polygons:
            face.use_smooth = True
        data.materials.append(skin)
        obj = bpy.data.objects.new(f"review sleeper {k}", data)
        scene.collection.objects.link(obj)
        temporary.append(obj)
    for label, (eye, target) in views.items():
        look(camera, eye, target)
        scene.render.filepath = str(out / f"{avatar}-{label}.png")
        bpy.ops.render.render(write_still=True)
    for obj in temporary:
        bpy.data.objects.remove(obj, do_unlink=True)
print("rendered", chosen, "to", out, flush=True)
