"""Workbench renders of the three speakeasy massings (docs/house/speakeasy-massing.md), without saving the house.

Run with Blender 4.5 LTS from the repository root:
  blender -b --python-exit-code 1 --python bin/render_speakeasy_massings.py -- --out=DIR

Each option is drawn as plain volumes in the sandstone headland south of the cave study (Sirui's ring on
docs/images/sirui-2026-11-16-house-at-night-speakeasy-and-lift.webp): the bar in amber, the study's extension in
oak, glazing in pale yellow, the lift shaft in blue. Two views each: from the sea at eye height above the water,
and a plan from above with the roofs lifted away and the sea at the bottom. The house is rendered solid and each
option's volumes alone on a transparent film, then laid over it at 85 percent, so they read through the rock.
Blender coordinates: Z up, +Y toward the sea, +X north. Measured on November 17, 2026: the study floor is
z 0 behind glazing at y -0.8 (x -12.3 to -8.7); the headland rises to about z 11 south of x -12.5, its sea face
near y 13 to 14; the beach is near z -7.5 beyond y 16. The volumes are massings, not designs: sizes are round.
"""

import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
args = {a.split("=", 1)[0][2:]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
out = Path(args.get("out", ".jekyll-cache/visual-qa/speakeasy-massings"))
out = out if out.is_absolute() else ROOT / out
out.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=str(ROOT / "artwork/coastal-home/coastal-home.blend"))
scene = bpy.context.scene

# Roofs that lift away in the browser are lifted here too, so the plan sees into the rooms.
for obj in scene.objects:
    if obj.get("caveRoof") or obj.get("shadowOnly") or "liftaway_roof" in obj.name:
        obj.hide_render = True

COLOURS = {
    "bar": (0.93, 0.55, 0.16, 1),
    "study": (0.78, 0.62, 0.42, 1),
    "glass": (1.0, 0.93, 0.55, 1),
    "lift": (0.25, 0.55, 0.95, 1),
    "terrace": (0.85, 0.82, 0.76, 1),
}
materials = {}
for key, rgba in COLOURS.items():
    mat = bpy.data.materials.new(f"massing {key}")
    mat.diffuse_color = rgba
    materials[key] = mat


def block(name, kind, lo, hi):
    """An axis-aligned box from corner lo to corner hi (Blender coordinates)."""
    lo, hi = Vector(lo), Vector(hi)
    mesh = bpy.data.meshes.new(name)
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    verts = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(materials[kind])
    obj = bpy.data.objects.new(name, mesh)
    obj["massing"] = True
    return obj


# The study's own extension and the bookcase door are shared: a few metres south into the rock.
SHARED = [
    block("study extension", "study", (-14.6, -6.4, 0.0), (-12.3, -1.6, 3.2)),
]
OPTIONS = {
    "a-behind-the-bookcase": [
        # A deep, narrow room through the rock toward the sea, lit only by a slot at its end.
        block("bar", "bar", (-17.6, -4.0, 0.0), (-14.6, 12.6, 3.0)),
        block("slot window", "glass", (-16.4, 12.6, 0.6), (-15.8, 13.6, 2.6)),
        block("lift shaft", "lift", (-15.2, 12.9, -7.6), (-13.4, 14.6, 3.0)),
    ],
    "b-along-the-cliff-face": [
        # A long, low room behind the headland's sea face, one horizontal window over the sea.
        block("passage", "study", (-15.6, -1.6, 0.0), (-14.0, 9.6, 2.8)),
        block("bar", "bar", (-21.0, 9.6, 0.0), (-13.0, 12.8, 3.0)),
        block("window band", "glass", (-20.4, 12.8, 1.0), (-13.6, 13.8, 2.4)),
        block("lift shaft", "lift", (-23.0, 11.4, -7.6), (-21.0, 13.6, 3.0)),
    ],
    "c-half-a-level-down": [
        # A bar half a level below the study, opening onto a terrace cut into the cliff, the lift at its edge.
        block("stair", "study", (-14.4, -1.4, -1.6), (-12.6, 1.2, 0.0)),
        block("bar", "bar", (-17.0, 1.2, -1.6), (-12.6, 8.8, 1.2)),
        block("terrace", "terrace", (-17.4, 8.8, -1.9), (-12.4, 13.4, -1.6)),
        block("glass wall", "glass", (-17.0, 8.6, -1.6), (-12.6, 8.8, 1.2)),
        block("lift shaft", "lift", (-15.6, 13.4, -7.6), (-13.8, 15.2, -1.6)),
    ],
}

scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x, scene.render.resolution_y = 1600, 900
scene.render.resolution_percentage = 100
shading = scene.display.shading
shading.light = "STUDIO"
shading.color_type = "MATERIAL"
shading.show_xray = False
if hasattr(scene.display, "render_aa"):
    scene.display.render_aa = "16"
scene.view_settings.view_transform = "Standard"

camera_data = bpy.data.cameras.new("massing camera")
camera = bpy.data.objects.new("massing camera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.sensor_fit = "VERTICAL"
camera_data.clip_start = 0.1
camera_data.clip_end = 600

VIEWS = {
    # From the sea, about seven metres above the water, looking at the study and the headland.
    "sea": {"eye": (-12.0, 40.0, -1.0), "target": (-15.5, 5.0, 1.0), "fov": 36, "ortho": None},
    # Plan from above, roofs lifted away; image up is landward (-Y), so the sea is at the bottom.
    "plan": {"eye": (-15.5, 3.0, 60.0), "target": None, "fov": None, "ortho": 40.0},
}


def aim(spec):
    camera.location = spec["eye"]
    if spec["target"] is None:
        camera.rotation_euler = (0.0, 0.0, math.pi)
    else:
        camera.rotation_euler = (Vector(spec["target"]) - Vector(spec["eye"])).to_track_quat("-Z", "Y").to_euler()
    if spec["ortho"]:
        camera_data.type = "ORTHO"
        camera_data.ortho_scale = spec["ortho"]
    else:
        camera_data.type = "PERSP"
        camera_data.angle_y = math.radians(spec["fov"])


def shoot(path):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(str(path), check_existing=False)
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(image.size[1], image.size[0], 4)
    bpy.data.images.remove(image)
    return pixels


def save(pixels, path):
    h, w = pixels.shape[:2]
    image = bpy.data.images.new(path.stem, width=w, height=h, alpha=True)
    image.pixels[:] = pixels.ravel()
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


# 1. The house alone, solid, with shadows and cavity.
scene.render.film_transparent = False
shading.show_shadows = True
shading.show_cavity = True
shading.cavity_type = "WORLD"
bases = {}
for view, spec in VIEWS.items():
    aim(spec)
    bases[view] = shoot(out / f"house-{view}.png")

# 2. Each option's volumes alone on a transparent film, laid over the house.
others = [obj for obj in scene.objects if not obj.get("massing") and obj.type != "CAMERA" and not obj.hide_render]
for obj in others:
    obj.hide_render = True
scene.render.film_transparent = True
shading.show_shadows = False
for obj in SHARED:
    scene.collection.objects.link(obj)
linked = []
written = []
for option, objects in OPTIONS.items():
    for obj in linked:
        scene.collection.objects.unlink(obj)
    linked = list(objects)
    for obj in linked:
        scene.collection.objects.link(obj)
    for view, spec in VIEWS.items():
        aim(spec)
        volumes = shoot(out / f"{option}-{view}-volumes.png")
        a = volumes[..., 3:4] * 0.85
        composite = bases[view].copy()
        composite[..., :3] = composite[..., :3] * (1 - a) + volumes[..., :3] * a
        composite[..., 3] = 1.0
        path = out / f"{option}-{view}.png"
        save(composite, path)
        written.append(str(path))
print("RENDERED", *written, sep=chr(10), flush=True)
