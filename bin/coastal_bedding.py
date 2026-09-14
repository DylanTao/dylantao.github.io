"""A cloth cover that contacts the mattress instead of hovering above it."""
import math
import bpy
from coastal_sculpt import surface


def duvet(name, mat, offset=(0, 0, 0)):
    nx, ny = 32, 36
    vertices, faces = [], []
    for j in range(ny + 1):
        v = j / ny
        for i in range(nx + 1):
            u = i / nx
            # The hem drapes below the mattress top (0.54 m). Broad central
            # fullness leaves room for the reclining body; small folds settle
            # toward the edges rather than forming a second rigid mattress.
            across = max(0, math.sin(math.pi * u)) ** 0.6
            along = max(0, math.sin(math.pi * v)) ** 0.4
            z = 0.48 + 0.31 * across * along
            z += 0.008 * math.sin(u * 42 + v * 13) * across * along
            vertices.append((-3.10 + (u - 0.5) * 1.59 + offset[0],
                             1.52 + (v - 0.5) * 1.61 + offset[1], z + offset[2]))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    obj = surface(name, vertices, faces, mat)
    bpy.context.view_layer.objects.active = obj
    solid = obj.modifiers.new("Soft folded hem", "SOLIDIFY")
    solid.thickness = 0.028
    solid.offset = -1
    bpy.ops.object.modifier_apply(modifier=solid.name)
    return obj
