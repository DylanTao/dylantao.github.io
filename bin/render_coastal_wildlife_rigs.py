"""Workbench review renders of the skinned coastal animal rigs, at rest and in test poses.

Usage: blender -b --python-exit-code 1 --python bin/render_coastal_wildlife_rigs.py -- <source.blend> <out-dir> [pose-json]
The pose JSON maps rig name -> {pose name -> {bone: [rx, ry, rz, (sx, sy, sz)]}} in degrees, applied
in the bone's own (axis-aligned) frame. Nothing is saved; this is an authoring check only.
"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Euler, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
source, out = Path(argv[0]), Path(argv[1])
poses = json.loads(Path(argv[2]).read_text()) if len(argv) > 2 else {}
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'VERTEX'
scene.display.shading.show_shadows = True
scene.render.resolution_x, scene.render.resolution_y = 640, 480
scene.render.film_transparent = False
world = scene.world or bpy.data.worlds.new('Review')
scene.world = world
camera = bpy.data.objects.new('Review camera', bpy.data.cameras.new('Review camera'))
scene.collection.objects.link(camera)
scene.camera = camera
rigs = [o for o in scene.objects if o.type == 'ARMATURE']
for rig in rigs:
    rig.hide_render = True
    for child in rig.children:
        child.hide_render = True


def frame(rig, azimuth, elevation, distance):
    body = rig.children[0]
    corners = [body.matrix_world @ Vector(c) for c in body.bound_box]
    center = sum(corners, Vector()) / 8
    radius = max((c - center).length for c in corners)
    d = radius * distance
    a, e = math.radians(azimuth), math.radians(elevation)
    camera.location = center + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * d
    direction = center - camera.location
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    camera.data.lens = 50


for rig in rigs:
    rig.hide_render = False
    for child in rig.children:
        child.hide_render = False
    variants = {'rest': {}} | poses.get(rig.name, {})
    for name, pose in variants.items():
        for bone in rig.pose.bones:
            bone.rotation_mode = 'XYZ'
            bone.rotation_euler = Euler((0, 0, 0))
            bone.location = Vector()
            bone.scale = Vector((1, 1, 1))
        for bone, values in pose.items():
            pb = rig.pose.bones[bone]
            # Bone frame: x across, y along Blender +Z (up), z along Blender -Y (forward).
            pb.rotation_euler = Euler([math.radians(v) for v in values[:3]])
            if len(values) >= 6:
                pb.scale = Vector(values[3:6])
            if len(values) >= 9:
                pb.location = Vector(values[6:9])
        bpy.context.view_layer.update()
        for view, (azimuth, elevation) in {'side': (90, 10), 'front': (0, 12), 'three': (40, 25)}.items():
            frame(rig, azimuth, elevation, 2.6)
            scene.render.filepath = str(out / f'{rig.name}-{name}-{view}.png')
            bpy.ops.render.render(write_still=True)
    rig.hide_render = True
    for child in rig.children:
        child.hide_render = True
print('RENDERED', len(rigs), 'rigs to', out)
