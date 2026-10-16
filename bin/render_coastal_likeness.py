"""Matched Cycles studies of the October 15 likeness pass: before and after, same cameras.

Renders the baseline avatar sources (from git) and the current sources with identical
orthographic cameras: a front bust framed like Sirui's 2D portraits, three-quarter, profile,
back and full body. These are actual renders of the authored meshes, for review only; they
are written to .jekyll-cache/visual-qa/character-likeness/ and never ship.

  blender -b --python-exit-code 1 --python bin/render_coastal_likeness.py -- --baseline-ref=f403dfead
Options: --avatar=<style> (repeatable), --after-only, --apply (preview the pass in memory on
the current source without saving it), --samples=N.
"""

import subprocess
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_characters import face_profile
from coastal_likeness import AUTHORING, STYLES, install_likeness, to_final

OUT = ROOT / ".jekyll-cache/visual-qa/character-likeness"
OUT.mkdir(parents=True, exist_ok=True)
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
reference = next((a.split("=", 1)[1] for a in args if a.startswith("--baseline-ref=")), "f403dfead")
requested = [a.split("=", 1)[1] for a in args if a.startswith("--avatar=")] or list(STYLES)
samples = int(next((a.split("=", 1)[1] for a in args if a.startswith("--samples=")), "32"))
VIEWS = {
    "front": (0, -1, 0.0),
    "three": (0.62, -0.8, 0.05),
    "profile": (1, -0.03, 0.02),
    "back": (0, 1, 0.1),
}


def framing(style):
    """A fixed bust frame per style, from the authored head, shared by before and after."""
    head_z, (hx, hy, hz), factor = AUTHORING[style]
    rings = face_profile(style)
    chin = to_final((0, 0, head_z + rings[0][0] * hz), factor).z
    top = to_final((0, 0, head_z + rings[-1][0] * hz), factor).z
    height = top - chin
    lo, hi = chin - 0.45 * height, top + 0.22 * height
    return Vector((0, 0, (lo + hi) / 2)), hi - lo


def studio(scene, target):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.device = "CPU"
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("portrait paper")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes["Background"]
    background.inputs[0].default_value = (0.72, 0.66, 0.55, 1)
    background.inputs[1].default_value = 0.65
    for name, location, energy, size in (("soft key", (-3, -4, 5), 400, 4), ("warm rim", (3, 2, 4), 500, 3)):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy, light.data.shape, light.data.size = energy, "DISK", size
        light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    scene.camera = camera
    scene.view_settings.view_transform = "AgX"
    return camera


def render(style, label, source, apply=False):
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    arm = next(o for o in scene.objects if o.type == "ARMATURE")
    if apply:
        install_likeness(arm, style)
    for track in arm.animation_data.nla_tracks:
        track.mute = track.name != "idle"
    scene.frame_set(1)
    center, size = framing(style)
    camera = studio(scene, center)
    scene.render.resolution_x = scene.render.resolution_y = 640
    camera.data.ortho_scale = size
    for view, direction in VIEWS.items():
        d = Vector(direction).normalized()
        camera.location = center + d * 6
        camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(OUT / f"{style}-{label}-{view}.png")
        bpy.ops.render.render(write_still=True)
    # Full body, framed on the standing figure from the feet to above the hair.
    scene.render.resolution_x, scene.render.resolution_y = 480, 600
    body = Vector((0, 0, 1.0))
    camera.data.ortho_scale = 2.5
    camera.location = body + Vector((0.35, -1, 0.12)).normalized() * 8
    camera.rotation_euler = (body - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(OUT / f"{style}-{label}-body.png")
    bpy.ops.render.render(write_still=True)


for style in requested:
    current = ROOT / "artwork/coastal-home" / f"sirui-{style}.blend"
    if "--after-only" not in args:
        baseline = OUT / f"{style}-before.blend"
        baseline.write_bytes(subprocess.check_output(
            ["git", "show", f"{reference}:artwork/coastal-home/sirui-{style}.blend"], cwd=ROOT))
        render(style, "before", baseline)
    render(style, "after", current, apply="--apply" in args)
    print("rendered", style, flush=True)
