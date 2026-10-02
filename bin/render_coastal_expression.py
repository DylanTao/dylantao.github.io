"""Actual matched Blender eyelid studies; not generated concept artwork."""

import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
output = ROOT / ".jekyll-cache/visual-qa/human-performance/native"
output.mkdir(parents=True, exist_ok=True)
reports = json.loads((ROOT / "artwork/coastal-home/reviews/character-expression.json").read_text())
baseline = next((Path(a.split("=", 1)[1]) for a in sys.argv if a.startswith("--baseline=")), None)

for report in reports:
    style = report["avatar"]
    studies = [("after-open", ROOT / "artwork/coastal-home" / ("sirui-" + style + ".blend"), 0),
               ("after-closed", ROOT / "artwork/coastal-home" / ("sirui-" + style + ".blend"), 1)]
    if style == "ghibli" and baseline:
        studies.insert(0, ("before-open", baseline, 0))
    for label, source, blink in studies:
        bpy.ops.wm.open_mainfile(filepath=str(source))
        scene = bpy.context.scene
        arm = next(o for o in scene.objects if o.type == "ARMATURE")
        for track in arm.animation_data.nla_tracks:
            track.mute = track.name != "idle"
        scene.frame_set(1)
        lids = next((o for o in arm.children if o.get("characterLids")), None)
        if lids:
            for side in ("L", "R"):
                lids.data.shape_keys.key_blocks["Blink" + side].value = blink
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 24
        scene.cycles.use_denoising = True
        scene.cycles.device = "CPU"
        try:
            preferences = bpy.context.preferences.addons["cycles"].preferences
            preferences.compute_device_type = "CUDA"
            preferences.get_devices()
            for device in preferences.devices:
                device.use = device.type == "CUDA"
            if any(d.use for d in preferences.devices):
                scene.cycles.device = "GPU"
        except (RuntimeError, TypeError):
            pass
        scene.render.resolution_x = scene.render.resolution_y = 720
        scene.render.resolution_percentage = 100
        scene.world = bpy.data.worlds.new("Neutral character study")
        scene.world.use_nodes = True
        scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.57, .60, .63, 1)
        scene.world.node_tree.nodes["Background"].inputs[1].default_value = .45
        z = report["eyes"][0]["center"][2]
        target = Vector((0, -.05, z - .025))
        for location, energy, size in (((-3, -4, 5), 420, 3), ((3, 1, 4), 220, 2)):
            bpy.ops.object.light_add(type="AREA", location=location)
            light = bpy.context.object
            light.data.energy, light.data.size = energy, size
            light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()
        bpy.ops.object.camera_add(location=(.85, -4, z + .18))
        camera = bpy.context.object
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = .57 if style == "ghibli" else .84
        camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
        scene.camera = camera
        scene.view_settings.view_transform = "AgX"
        scene.render.filepath = str(output / (style + "-" + label + ".png"))
        bpy.ops.render.render(write_still=True)
        if style == "ghibli" and label == "after-closed":
            camera.location = (3.2, -2.5, z + .12)
            camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
            scene.render.filepath = str(output / "ghibli-after-closed-profile.png")
            bpy.ops.render.render(write_still=True)
