"""Physical object sections and wave-worn sandstone, authored in Blender.

Vessels have inside walls and a rounded rim; their material and contact origins
remain compatible with the room's existing tagged prop transfers.
"""

import math
import random
import bpy
from coastal_sculpt import surface


def turned_vessel(name, location, profile, material, segments=48):
    vertices, rings, faces = [], [], []
    for radius, height in profile:
        if radius == 0:
            rings.append([len(vertices)])
            vertices.append((0, 0, height))
        else:
            ring = []
            for j in range(segments):
                a = j * math.tau / segments
                ring.append(len(vertices))
                vertices.append((radius * math.cos(a), radius * math.sin(a), height))
            rings.append(ring)
    for first, second in zip(rings, rings[1:]):
        for j in range(segments):
            nxt = (j + 1) % segments
            if len(first) == 1:
                faces.append((first[0], second[nxt], second[j]))
            elif len(second) == 1:
                faces.append((first[j], first[nxt], second[0]))
            else:
                faces.append((first[j], first[nxt], second[nxt], second[j]))
    obj = surface(name, vertices, faces, material)
    obj.location = location
    obj["authoredSection"] = "Closed wall, inside surface and rounded rim"
    return obj


def wave_worn_rock(name, location, scale, material, seed):
    rng = random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    yaw = rng.random() * math.tau
    for vertex in obj.data.vertices:
        x, y, z = vertex.co
        chip = 1 + 0.065 * math.sin(x * 11 + seed) * math.cos(y * 7 - z * 5)
        # Broad fracture planes with a quietly rounded outline; a flat worn
        # crown and embedded base keep the rock from reading as a floating egg.
        vertex.co.x = math.copysign(abs(x) ** 0.77, x) * scale[0] * chip
        vertex.co.y = math.copysign(abs(y) ** 0.83, y) * scale[1] * chip
        vertex.co.z = min(0.81, max(-0.69, z * chip)) * scale[2]
    obj.rotation_euler.z = yaw
    for face in obj.data.polygons:
        face.use_smooth = True
    obj.data.update()
    obj["geology"] = "Authored wave-worn sandstone fracture, not a surveyed rock"
    return obj


def sandstone_bedding(obj, material, cliff_surface):
    """Low-contrast inclined sediment bands on the real outside surface."""
    slot = len(obj.data.materials)
    obj.data.materials.append(material)
    for face in obj.data.polygons:
        if face.material_index != 0:
            continue
        front = all(abs(obj.data.vertices[i].co.y - cliff_surface(
            obj.data.vertices[i].co.x, obj.data.vertices[i].co.z)) < 0.13
            for i in face.vertices)
        x, _, z = face.center
        bedding = z + 0.055 * x + 0.08 * math.sin(x * 0.33)
        if front and math.sin(bedding * 3.1) > 0.92:
            face.material_index = slot


def fitted_footrests(config, mats, h):
    """Open oak frames fitted to the adult seated soles, at the same 22 cm top."""
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(("study_footrest", "kitchen_footrest")):
            bpy.data.objects.remove(obj, do_unlink=True)
    for room in config["rooms"]:
        if room["id"] not in ("study", "kitchen"):
            continue
        x, z, yy = room["actor"]
        y = -yy - math.cos(room["facing"]) * .49
        group = room["id"]
        h["box"](group + "_footrest", (x, y, z + .204),
                 (.49, .40, .032), mats["wood"], .012)
        for dx in (-.195, .195):
            h["box"](group + "_footrest_support", (x + dx, y, z + .095),
                     (.044, .355, .19), mats["oak"], .01)
        h["box"](group + "_footrest_stretcher", (x, y, z + .061),
                 (.42, .034, .035), mats["wood"], .009)
