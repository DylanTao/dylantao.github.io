"""Matched original Cycles grip studies; actual source, not a concept image.

Run in Blender with --baseline=<pre-change Ghibli .blend>. Both sources see
identical finite cylinders matching the retained gym's dimensions and offsets.
"""

import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_sculpt import render_portrait

baseline = next((Path(arg.split("=", 1)[1]) for arg in sys.argv if arg.startswith("--baseline=")), None)
assert baseline and baseline.is_file(), "Supply --baseline="
output = ROOT / "artwork/coastal-home/reviews/grips"
output.mkdir(exist_ok=True)


def load(path, clip):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    arm = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    for track in arm.animation_data.nla_tracks:
        track.mute = track.name != clip
    bpy.context.scene.frame_set(28)
    return arm


def study(path, label, clip, close):
    load(path, clip)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.cycles.device = "CPU"
    try:
        preferences = bpy.context.preferences.addons["cycles"].preferences
        preferences.compute_device_type = "CUDA"
        preferences.get_devices()
        for device in preferences.devices:
            device.use = device.type == "CUDA"
        if any(device.use for device in preferences.devices):
            scene.cycles.device = "GPU"
    except (TypeError, RuntimeError):
        # CUDA is optional; use the same Cycles study on other platforms.
        pass
    scene.render.resolution_x = scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new("Neutral grip study")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.60, 0.62, 0.64, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    x, z, radius, y, length = ((0.30, 2.322, 0.026, -0.13, 0.34) if clip == "pullup"
                              else (0.43, 1.192, 0.034, 0.07, 0.30))
    target = Vector((-x, -0.01, z) if close else (0, -0.03, 1.45 if clip == "pullup" else 0.93))
    bpy.ops.object.light_add(type="AREA", location=(-3, -4, 6))
    light = bpy.context.object
    light.data.energy, light.data.size = 450, 4
    light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()
    rubber = bpy.data.materials.new("Authored matte rubber handle")
    rubber.diffuse_color = (0.045, 0.052, 0.053, 1)
    for side in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=length,
                                           location=(side * x, y, z), rotation=(math.pi / 2, 0, 0))
        handle = bpy.context.object
        handle.data.materials.append(rubber)
        for polygon in handle.data.polygons:
            polygon.use_smooth = True
    location = (target.x - 0.28, target.y - 0.60, target.z + 0.24) if close else (3.2, -5.2, 2.8)
    bpy.ops.object.camera_add(location=location)
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 0.42 if close else 2.8
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    scene.view_settings.view_transform = "AgX"
    scene.render.filepath = str(output / f"{label}-{clip}{'-hand' if close else ''}.png")
    bpy.ops.render.render(write_still=True)


for clip in ("pullup", "dip"):
    for label, path in (("before", baseline), ("after", ROOT / "artwork/coastal-home/sirui-ghibli.blend")):
        study(path, label, clip, True)
        study(path, label, clip, False)
if "--portraits" in sys.argv:
    load(ROOT / "artwork/coastal-home/sirui-ghibli.blend", "idle")
    bpy.context.scene.frame_set(1)
    render_portrait(next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"), "ghibli", ROOT / "artwork/coastal-home")
