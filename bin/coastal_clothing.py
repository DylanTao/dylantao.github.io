"""Continuous shirt topology with sleeves extruded from torso openings."""

import math
import bpy
from coastal_sculpt import surface


def cotton_shirt(width, material):
    # One connected garment; separate shoulder caps read as armour in the old
    # models. The cuffs and neckline are real open boundaries with cloth depth.
    rings = [
        (0.686, 0.89, 0.123),
        (0.708, 0.92, 0.130),
        (0.78, 0.88, 0.132),
        (0.85, 0.91, 0.134),
        (0.92, 0.97, 0.137),
        (1.00, 1.04, 0.134),
        (1.035, 0.99, 0.122),
        (1.067, 0.63, 0.094),
        (1.089, 0, 0.077),
    ]
    count = 32
    verts = []
    for z, ratio, depth in rings:
        rx = width * ratio if ratio else 0.083
        for j in range(count):
            a = j * math.tau / count
            fold = .003 * math.sin(a * 5 + z * 19) * max(0, 1 - abs(z - .76) * 5)
            verts.append(((rx + fold) * math.cos(a), (depth + fold) * math.sin(a), z))
    faces = []
    for i in range(len(rings) - 1):
        for j in range(count):
            if i in (4, 5) and j in (30, 31, 0, 1, 14, 15, 16, 17):
                continue
            a = i * count + j
            b = i * count + (j + 1) % count
            faces.append((a, b, b + count, a + count))
    for side, start in ((1, 30), (-1, 14)):
        js = [(start + j) % count for j in range(5)]
        edge = [4 * count + j for j in js] + [5 * count + js[-1], 6 * count + js[-1]]
        edge += [6 * count + j for j in js[-2::-1]] + [5 * count + js[0]]
        original = list(edge)
        for ring in range(1, 9):
            t = ring / 8
            following = []
            for index in original:
                x, y, z = verts[index]
                theta = math.atan2((z - 0.9775) / 0.0575, y / 0.065)
                end = (
                    side * (width + 0.063 + 0.063 * .982 * math.sin(theta)),
                    0.067 * math.cos(theta),
                    0.835 + 0.063 * .188 * math.sin(theta),
                )
                following.append(len(verts))
                point = [v * (1 - t) + end[k] * t for k, v in enumerate((x, y, z))]
                # Round the shoulder into a longer, closer cuff. The former
                # straight, wide taper made a triangular rigid sleeve in idle.
                fullness = math.sin(math.pi * t)
                point[0] += side * .010 * fullness
                point[1] += .004 * math.cos(theta * 3) * fullness
                verts.append(tuple(point))
            for j in range(len(edge)):
                k = (j + 1) % len(edge)
                face = (edge[j], edge[k], following[k], following[j])
                faces.append(tuple(reversed(face)) if side > 0 else face)
            edge = following
    obj = surface("continuous cotton shirt", verts, faces, material)
    bpy.context.view_layer.objects.active = obj
    # Consistent outward normals also keep the cloth readable in web lighting.
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    sub = obj.modifiers.new("soft sewn garment", "SUBSURF")
    sub.levels = 2
    bpy.ops.object.modifier_apply(modifier=sub.name)
    solid = obj.modifiers.new("cotton thickness", "SOLIDIFY")
    solid.thickness = 0.007
    bpy.ops.object.modifier_apply(modifier=solid.name)
    obj["blendShirt"] = width
    return obj
