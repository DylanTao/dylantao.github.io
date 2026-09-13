"""Render the editable home itself for geometry review (Blender background)."""

from pathlib import Path
import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root / "artwork/coastal-home/coastal-home.blend"))
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
preferences = bpy.context.preferences.addons["cycles"].preferences
preferences.compute_device_type = "CUDA"
preferences.get_devices()
for device in preferences.devices:
    device.use = device.type == "CUDA"
scene.cycles.device = "GPU"
scene.world = bpy.data.worlds.new("review daylight")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (
    0.63,
    0.73,
    0.84,
    1,
)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.45
bpy.ops.object.light_add(type="SUN", location=(-14, 25, 30))
sun = bpy.context.object
sun.data.energy = 2.2
sun.data.angle = 0.10
sun.rotation_euler = (
    (Vector((0, 0, 0)) - sun.location).to_track_quat("-Z", "Y").to_euler()
)
bpy.ops.object.camera_add()
camera = bpy.context.object
camera.data.type = "ORTHO"
scene.camera = camera
scene.render.resolution_x = 800
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "AgX"
out = root / "artwork/coastal-home/reviews"
out.mkdir(exist_ok=True)
for name, location, target, size, roof in [
    ("exterior", (-16, 32, 7), (1, 0, -1), 23, True),
    ("section", (12, 19, 14), (0, -0.3, 1.8), 14.5, False),
]:
    for obj in scene.objects:
        if obj.get("caveRoof"):
            obj.hide_render = not roof
    camera.location = location
    camera.rotation_euler = (
        (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    camera.data.ortho_scale = size
    scene.render.filepath = str(out / (name + ".png"))
    bpy.ops.render.render(write_still=True)
