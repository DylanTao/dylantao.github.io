"""Eevee review renders of the house from the web manifest's room cameras (Blender background).

Shared by the refresh scripts' --preview modes and by bin/render_coastal_rooms.py. Nothing here
saves the house: callers open the .blend, change it in memory, then render.

Coordinates are Blender's (Z up, +Y toward the sea, +X north); manifest points are three.js
(x, z, -y), as in coastal_landscape.web().
"""

import math
from pathlib import Path
import bpy
from mathutils import Vector


def blender(point):
    x, y, z = point
    return Vector((x, -z, y))


def room_eye(room, camera=None):
    """The runtime camera position for a room view: target + spherical(yaw, pitch, radius)."""
    camera = camera or room["camera"]
    tx, ty, tz = room["target"]
    yaw, pitch, radius = camera["yaw"], camera["pitch"], camera["radius"]
    eye = (tx + math.sin(yaw) * math.cos(pitch) * radius, ty + math.sin(pitch) * radius, tz + math.cos(yaw) * math.cos(pitch) * radius)
    return blender(eye), blender(room["target"]), camera.get("fov", 38)


def manifest_views(config, rooms=None, orbit=True):
    """The arrival view of each room, plus the two ends of its yaw envelope and its nearest zoom."""
    views = {}
    for room in config["rooms"]:
        if rooms and room["id"] not in rooms:
            continue
        cam = room["camera"]
        views[room["id"]] = room_eye(room)
        if not orbit:
            continue
        env = cam.get("envelope", {})
        for k, yaw in enumerate(env.get("yaw") or []):
            views[f"{room['id']}-yaw{k}"] = room_eye(room, {**cam, "yaw": yaw})
        if env.get("radius"):
            views[f"{room['id']}-near"] = room_eye(room, {**cam, "radius": env["radius"][0], "pitch": env["pitch"][0]})
            views[f"{room['id']}-high"] = room_eye(room, {**cam, "radius": env["radius"][1], "pitch": env["pitch"][1]})
    return views


def setup(scene, resolution=(1200, 800), sun_elevation=34, sun_azimuth=-105, samples=32, cutaway=True):
    """Eevee with an afternoon sun from the sea, a pale sky, and the lift-away roof hidden."""
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    eevee = scene.eevee
    eevee.taa_render_samples = samples
    for attr, value in (("use_shadows", True), ("use_raytracing", True), ("shadow_ray_count", 2), ("shadow_step_count", 8)):
        if hasattr(eevee, attr):
            setattr(eevee, attr, value)
    if hasattr(eevee, "ray_tracing_options"):
        eevee.ray_tracing_options.resolution_scale = "2"
    scene.world = bpy.data.worlds.get("preview sky") or bpy.data.worlds.new("preview sky")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes["Background"]
    background.inputs[0].default_value = (0.62, 0.72, 0.84, 1)
    background.inputs[1].default_value = 0.9
    for obj in scene.objects:
        if obj.get("caveRoof") or obj.get("shadowOnly"):
            obj.hide_render = cutaway or bool(obj.get("shadowOnly"))
    # The browser draws the facade's glass anti-reflective and nearly clear (glazing.mjs); a preview
    # that rendered it as a pale opaque pane would hide every room behind it.
    for mat in bpy.data.materials:
        if "glass" in mat.name and mat.use_nodes and mat.node_tree.nodes.get("Principled BSDF"):
            mat.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = 0.06
            mat.surface_render_method = "BLENDED"
    sun_data = bpy.data.lights.get("preview sun") or bpy.data.lights.new("preview sun", "SUN")
    sun_data.energy = 3.2
    sun_data.angle = math.radians(1.2)
    sun_data.color = (1.0, 0.95, 0.88)
    sun = bpy.data.objects.get("preview sun") or bpy.data.objects.new("preview sun", sun_data)
    if sun.name not in scene.collection.objects:
        scene.collection.objects.link(sun)
    el, az = math.radians(sun_elevation), math.radians(sun_azimuth)
    # Azimuth measured from +X (north) toward +Y (the sea): -105 is a WSW afternoon sun.
    toward = Vector((math.cos(el) * math.cos(az), -math.cos(el) * math.sin(az), math.sin(el)))
    sun.rotation_euler = (-toward).to_track_quat("-Z", "Y").to_euler()
    camera_data = bpy.data.cameras.get("preview camera") or bpy.data.cameras.new("preview camera")
    camera = bpy.data.objects.get("preview camera") or bpy.data.objects.new("preview camera", camera_data)
    if camera.name not in scene.collection.objects:
        scene.collection.objects.link(camera)
    camera_data.sensor_fit = "VERTICAL"
    camera_data.clip_start = 0.05
    camera_data.clip_end = 400
    scene.camera = camera
    return camera


def add_fill(scene, name, location, energy=60, size=2.0, color=(1.0, 0.86, 0.68), kind="AREA", target=None):
    """A soft practical-light stand-in for previews (the runtime lights its lamps analytically)."""
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    if kind == "AREA":
        data.size = size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    if target is not None:
        obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    return obj


def render(scene, camera, views, directory, prefix=""):
    out = Path(directory)
    out.mkdir(parents=True, exist_ok=True)
    written = []
    for name, (eye, target, fov) in views.items():
        camera.location = eye
        camera.rotation_euler = (Vector(target) - Vector(eye)).to_track_quat("-Z", "Y").to_euler()
        camera.data.angle_y = math.radians(fov)
        path = out / f"{prefix}{name}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        written.append(str(path))
    return written
