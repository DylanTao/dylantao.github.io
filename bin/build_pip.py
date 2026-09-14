"""Author Pip's articulated model with Blender 4.5's Python API.

Run: blender --background --python bin/build_pip.py
Original geometry; Reachy Mini and Pixar's EVE are design references only.
The web portrait mirrors this silhouette with analytic surfaces at icon size.
"""

from pathlib import Path
import math

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "artwork" / "pip"
OUTPUT = ROOT / "assets" / "models" / "pip"
SOURCE.mkdir(parents=True, exist_ok=True)
OUTPUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, roughness, metallic=0, glow=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Coat Weight"].default_value = 0.6
    bsdf.inputs["Coat Roughness"].default_value = 0.18
    if glow:
        bsdf.inputs["Emission Color"].default_value = (*color, 1)
        bsdf.inputs["Emission Strength"].default_value = glow
    return mat


ceramic = material("Pip porcelain", (0.91, 0.94, 0.92), 0.3)
glass = material("Pip optical glass", (0.008, 0.018, 0.026), 0.11, 0.25)
graphite = material("Pip graphite", (0.025, 0.032, 0.035), 0.33, 0.3)
metal = material("Pip lens bevel", (0.22, 0.28, 0.3), 0.22, 0.7)
light = material("Pip iris", (0.18, 0.73, 0.72), 0.25, glow=1.1)
orange = material("Pip orange pip", (0.95, 0.34, 0.065), 0.34)


def xyz(v):
    """Author in the same Y-up / +Z-face convention as the browser rig."""
    return (v[0], -v[2], v[1])


def parent(name, location=(0, 0, 0), owner=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = owner
    obj.location = xyz(location)
    return obj


def finish(obj, name, mat, owner, location):
    obj.name = name
    obj.parent = owner
    obj.location = xyz(location)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def ellipsoid(name, loc, scale, mat, owner, taper=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24)
    obj = bpy.context.object
    for vertex in obj.data.vertices:
        x, y, z = vertex.co
        width = 1 + z * scale[1] * taper
        vertex.co = (x * scale[0] * width, y * scale[2] * width, z * scale[1])
    return finish(obj, name, mat, owner, loc)


def rounded(name, loc, size, radius, mat, owner):
    bpy.ops.mesh.primitive_cube_add()
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new("Crafted shell radius", "BEVEL")
    bevel.width = radius
    bevel.segments = 8
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    normal = obj.modifiers.new("Weighted shell normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=normal.name)
    return finish(obj, name, mat, owner, loc)


def rod(name, a, b, radius, mat, owner):
    delta = Vector(xyz(b)) - Vector(xyz(a))
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=delta.length)
    obj = bpy.context.object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    return finish(obj, name, mat, owner, tuple((a[i] + b[i]) / 2 for i in range(3)))


def torus(name, loc, radius, tube, mat, owner):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=48, minor_segments=10, major_radius=radius, minor_radius=tube
    )
    obj = bpy.context.object
    obj.rotation_euler.x = math.pi / 2
    return finish(obj, name, mat, owner, loc)


body = parent("PipBody")
ellipsoid(
    "Continuous tapered shell",
    (0, -0.21, 0),
    (0.28, 0.38, 0.23),
    ceramic,
    body,
    taper=0.43,
)
ellipsoid("Neck gimbal", (0, 0.158, 0), (0.09, 0.07, 0.085), metal, body)
ellipsoid("Hover outlet", (0, -0.558, 0), (0.095, 0.022, 0.079), graphite, body)
ellipsoid("Hover glow", (0, -0.573, 0.004), (0.067, 0.009, 0.055), light, body)
ellipsoid(
    "Orange identity dot", (0.087, -0.05, 0.225), (0.022, 0.022, 0.008), orange, body
)
head = parent("PipHead", (0, 0.432, 0), body)
rounded("Pebble head shell", (0, 0, 0), (0.926, 0.53, 0.506), 0.178, ceramic, head)
rounded("Lens bridge", (0, 0.016, 0.275), (0.22, 0.04, 0.028), 0.009, graphite, head)
for side, suffix, radius in [(-1, "L", 0.151), (1, "R", 0.126)]:
    center = (side * 0.201, 0.017, 0.279)
    ellipsoid(
        "Lens housing " + suffix,
        center,
        (radius * 1.1, radius * 1.1, 0.044),
        graphite,
        head,
    )
    torus(
        "Lens bevel " + suffix,
        (center[0], center[1], 0.314),
        radius,
        0.012,
        metal,
        head,
    )
    ellipsoid(
        "Convex optical lens " + suffix,
        (center[0], center[1], 0.320),
        (radius * 0.94, radius * 0.94, 0.043),
        glass,
        head,
    )
    pupil = parent("PipEye" + suffix, (center[0], center[1], 0.361), head)
    torus("Iris light " + suffix, (0, 0, 0), radius * 0.46, 0.0075, light, pupil)
    ellipsoid(
        "Pupil " + suffix,
        (0, 0, 0),
        (radius * 0.405, radius * 0.405, 0.009),
        glass,
        pupil,
    )
    antenna = parent("PipAntenna" + suffix, (side * 0.322, 0.239, -0.055), head)
    rod(
        "Antenna hinge " + suffix,
        (0, 0, 0),
        (side * 0.015, 0.046, 0),
        0.016,
        graphite,
        antenna,
    )
    rod(
        "Antenna stalk " + suffix,
        (side * 0.012, 0.039, 0),
        (side * 0.12, 0.34, 0),
        0.008,
        graphite,
        antenna,
    )
    ellipsoid(
        "Antenna tip " + suffix,
        (side * 0.12, 0.34, 0),
        (0.016,) * 3,
        ceramic if side < 0 else orange,
        antenna,
    )
    arm = parent("PipArm" + suffix, (side * 0.344, -0.13, 0), body)
    arm.rotation_euler.y = -side * 0.16
    ellipsoid(
        "Floating flipper " + suffix, (0, -0.04, 0), (0.062, 0.205, 0.09), ceramic, arm
    )

bpy.context.scene.render.engine = "CYCLES"
bpy.context.scene.cycles.samples = 48
bpy.context.scene.world.color = (0.35, 0.35, 0.35)
for name, position, power, size in [
    ("Softbox", (-3, 4, 4), 450, 4),
    ("Rim", (3, 2, -2), 320, 3),
    ("Fill", (-2, 0, 3), 70, 3),
]:
    bpy.ops.object.light_add(type="AREA", location=xyz(position))
    obj = bpy.context.object
    obj.name = name
    obj.data.energy = power
    obj.data.shape = "DISK"
    obj.data.size = size
    obj.rotation_euler = (
        (Vector(xyz((0, 0.2, 0))) - obj.location).to_track_quat("-Z", "Y").to_euler()
    )
bpy.ops.object.camera_add(location=xyz((1.45, 0.9, 4.7)))
camera = bpy.context.object
camera.rotation_euler = (
    (Vector(xyz((0, 0.2, 0))) - camera.location).to_track_quat("-Z", "Y").to_euler()
)
camera.data.type = "ORTHO"
camera.data.ortho_scale = 2.3
bpy.context.scene.camera = camera
bpy.context.scene.render.resolution_x = 800
bpy.context.scene.render.resolution_y = 900
bpy.context.scene.render.resolution_percentage = 100
bpy.context.scene.render.film_transparent = True
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "pip.blend"))
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
for obj in body.children_recursive:
    obj.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT / "pip.glb"),
    export_format="GLB",
    use_selection=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
)
bpy.context.scene.render.filepath = str(SOURCE / "pip-model.png")
bpy.ops.render.render(write_still=True)
print("Pip model:", OUTPUT / "pip.glb")
