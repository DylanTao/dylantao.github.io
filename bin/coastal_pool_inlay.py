"""Make a fired-glass inlay across the existing basin, its benches and risers.

One packed colour map replaces flat green tile. Tile size is set in metres.
The long wall has its own current winding through a darker band of ceramic.
"""

import bpy
import math
import numpy as np


def inlay(scene):
    tile = scene.objects["core_estate_pool__sea glass pool mosaic"]
    surface = tile.data.materials[0].copy()
    surface.name = "Basin · tidal glass tesserae"
    tile.data.materials[0] = surface
    # The lower 2/3 of this atlas is a plan of the water floor; the upper
    # third is the infinity wall elevation. Sampling a tessera at its centre
    # gives the ripples stepped edges from pieces of glass set by hand.
    w, h = 1024, 384
    yy, xx = np.mgrid[0:h, 0:w]
    u = (xx + 0.5) / w
    v = (yy + 0.5) / h
    wall = v >= 2 / 3
    meters_x = u * 10.8
    meters_y = np.where(wall, (v - 2 / 3) * 4.065, v * 7.125)
    size = 0.098
    row = np.floor(meters_y / size)
    col = np.floor(meters_x / size + (row % 2) * 0.5)
    gx = (col + 0.5 - (row % 2) * 0.5) * size
    gy = (row + 0.5) * size
    noise = np.mod(np.sin(19.751 * col + 78.233 * row) * 43758.545, 1)
    # Two long, unequal ribbons trace the Pacific current across the basin.
    floor_line = 2.65 + 0.55 * np.sin(gx * 0.63 - 0.8) + 0.18 * np.sin(gx * 1.52)
    wall_line = 0.65 + 0.22 * np.sin(gx * 0.87) + 0.065 * np.sin(gx * 2)
    dist = gy - np.where(wall, wall_line, floor_line)
    band = np.abs(dist) < np.where(wall, 0.13, 0.24)
    edge = np.abs(dist - np.where(wall, 0.14, 0.26)) < 0.056
    deep = np.clip(0.11 + 0.18 * gy / 4.75 + 0.05 * np.cos(gx * 0.85), 0, 0.5)
    light = np.array([0.53, 0.70, 0.67])
    dark = np.array([0.24, 0.45, 0.48])
    color = light + (dark - light) * deep[:, :, None]
    color[band] = [0.34, 0.56, 0.58]
    color[edge] = [0.71, 0.75, 0.63]
    color += (noise[:, :, None] - 0.5) * 0.096
    mortar = (np.mod(meters_y, size) < 0.007) | (
        np.mod(meters_x + (row % 2) * size * 0.5, size) < 0.006
    )
    color[mortar] *= 0.75
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:, :, :3] = color.clip(0, 1)
    image = bpy.data.images.new("Pacific current · glass inlay", width=w, height=h)
    image.pixels.foreach_set(rgba.ravel())
    image.file_format = "PNG"
    image.pack()
    tex = surface.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.interpolation = "Linear"
    tex.extension = "EXTEND"
    bsdf = surface.node_tree.nodes.get("Principled BSDF")
    surface.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.34
    uv = tile.data.uv_layers.active or tile.data.uv_layers.new(
        name="Basin stone setting"
    )
    world = tile.matrix_world
    for face in tile.data.polygons:
        norm = world.to_3x3() @ face.normal
        for li in face.loop_indices:
            x, y, z = world @ tile.data.vertices[tile.data.loops[li].vertex_index].co
            if abs(norm.z) > 0.65:
                tx = (x + 7.8) / 10.8
                ty = (y + 1.1) / 7.125
            else:
                tx = ((x + 7.8) if abs(norm.y) > 0.65 else (y + 2.1)) / 10.8
                ty = 2 / 3 + (z + 1.44) / 4.065
            uv.data[li].uv = (max(0.001, min(0.999, tx)), max(0.001, min(0.999, ty)))
    tile.data.update()
