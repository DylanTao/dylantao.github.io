"""A gravel garden and a stand of bamboo for the ocean-facing cedar bath.

Install on the November 19 garden master, in native metres (+Y oceanward).
The limestone approach and the hinoki boards retain a continuous bare-foot aisle.
"""

import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import coastal_decor as decor
from coastal_garden_refuge import blob, leaf

PREFIX = "core_bath_roji_"
GRAVEL = "bath river pea gravel"
STONE = "wet greenstone"
CANE = "olive bamboo culm"
FOLIAGE = "living bamboo blade"
FERN = "coastal wood fern"
MAPLE_BARK = "bath maple grey bark"
MAPLE_LEAF = "bath maple tea-green leaf"
MAPLE_TIP = "bath maple copper leaf"


def packed_map(material, name, rgb, normal=False):
    image = bpy.data.images.new(name, width=rgb.shape[1], height=rgb.shape[0], alpha=False)
    image.colorspace_settings.name = "Non-Color" if normal else "sRGB"
    rgba = np.ones((*rgb.shape[:2], 4), dtype=np.float32)
    rgba[:, :, :3] = rgb
    image.pixels.foreach_set(rgba.ravel())
    image.pack()
    tree = material.node_tree
    texture = tree.nodes.new("ShaderNodeTexImage")
    texture.image = image
    shader = tree.nodes["Principled BSDF"]
    if normal:
        bump = tree.nodes.new("ShaderNodeNormalMap")
        bump.inputs["Strength"].default_value = 0.65
        tree.links.new(texture.outputs["Color"], bump.inputs["Color"])
        tree.links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    else:
        tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])


def gravel_material():
    """One 36 cm tile carries real pebble shoulders and four rake ripples.

    Toroidal nearest-neighbour cells keep both colour and tangent normals
    continuous at the join. The native bed UVs turn the ripples around stone.
    """
    mat = decor.material(GRAVEL, (0.51, 0.49, 0.44), 0.90)
    if any(n.type == "TEX_IMAGE" for n in mat.node_tree.nodes):
        return mat
    size, count = 128, 17
    rng = np.random.default_rng(40719)
    y, x = (np.indices((size, size)) + 0.5) / size
    nearest = np.full_like(x, np.inf)
    second = nearest.copy()
    shade = np.zeros_like(x)
    for j in range(count):
        for i in range(count):
            cx, cy = (np.array([i, j]) + rng.uniform(0.10, 0.90, 2)) / count
            dx = (x - cx + 0.5) % 1 - 0.5
            dy = (y - cy + 0.5) % 1 - 0.5
            dist = dx * dx + 1.14 * dy * dy
            closer = dist < nearest
            second = np.where(closer, nearest, np.minimum(second, dist))
            shade = np.where(closer, rng.uniform(0.94, 1.045), shade)
            nearest = np.minimum(nearest, dist)
    shoulder = np.clip((np.sqrt(second) - np.sqrt(nearest)) * count * 2.8, 0, 1)
    ridge = 0.5 + 0.5 * np.cos(y * 4 * math.tau)
    height = 0.0011 * shoulder + 0.0060 * ridge
    nx = (np.roll(height, 1, 1) - np.roll(height, -1, 1)) * size / 0.72
    ny = (np.roll(height, 1, 0) - np.roll(height, -1, 0)) * size / 0.72
    normal = np.stack((nx, ny, np.ones_like(nx)), axis=2)
    normal /= np.linalg.norm(normal, axis=2)[:, :, None]
    value = shade * (0.94 + 0.06 * shoulder) * (0.81 + 0.19 * ridge)
    packed_map(mat, "Silver pea gravel", value[:, :, None] * np.array([0.63, 0.62, 0.575]))
    packed_map(mat, "Raked pea gravel relief", normal * 0.5 + 0.5, normal=True)
    return mat


def patch(bm, edge_a, edge_b, center, base):
    """Across a swept bed each row carries the rake continuously around its bend."""
    uv = bm.loops.layers.uv.verify()
    rows = []
    for a, b in zip(edge_a, edge_b):
        rows.append([bm.verts.new(Vector(a).lerp(Vector(b), i / 6)) for i in range(7)])
    for a, b in zip(rows, rows[1:]):
        for i in range(6):
            f = bm.faces.new((a[i], b[i], b[i + 1], a[i + 1]))
            f.normal_update()
            if f.normal.z < 0:
                f.normal_flip()
            for loop in f.loops:
                x, y, _ = loop.vert.co
                dy = y - center[1]
                # Give the rake a local bow yet retain a nonzero UV derivative
                # over the entire bed. Polar distance alone pinches the stones
                # into long lines where it runs parallel to the other UV axis.
                bow = 0.12 * math.exp(-(((x - center[0]) / 0.53) ** 2) - (dy / 0.60) ** 2)
                loop[uv].uv = (x / 0.36, (y + bow) / 0.36)
    edge = (
        rows[0]
        + [row[-1] for row in rows[1:]]
        + list(reversed(rows[-1][:-1]))
        + [row[0] for row in reversed(rows[1:-1])]
    )
    foot = [bm.verts.new((p.co.x, p.co.y, base)) for p in edge]
    for i in range(len(edge)):
        j = (i + 1) % len(edge)
        f = bm.faces.new((edge[i], edge[j], foot[j], foot[i]))
        for loop in f.loops:
            x, y, z = loop.vert.co
            loop[uv].uv = ((x + y) / 0.36, z / 0.36)


def reed(bm, origin, height, radius, lean):
    """One continuous culm, its slightly raised nodes built into the same skin."""
    origin, lean = Vector(origin), Vector(lean)

    def center(t):
        return origin + Vector((lean.x * t**1.65, lean.y * t**1.65, height * t))

    profile = [(0, 1)]
    sections = max(5, round(height / 0.26))
    for i in range(1, sections):
        f = i / sections
        profile.extend(((f - 0.008, 1), (f, 1.18), (f + 0.009, 1)))
    profile.append((1, 0.65))
    rings = []
    for f, k in profile:
        p = center(f)
        r = radius * (1 - 0.35 * f) * k
        rings.append(
            [
                bm.verts.new(p + Vector((r * math.cos(i * math.tau / 7), r * math.sin(i * math.tau / 7), 0)))
                for i in range(7)
            ]
        )
    for low, high in zip(rings, rings[1:]):
        for i in range(7):
            j = (i + 1) % 7
            bm.faces.new((low[i], low[j], high[j], high[i])).smooth = True
    bm.faces.new(rings[-1])
    return center


def blade(bm, base, tip, width):
    direction = tip - base
    cross = Vector((-direction.y, direction.x, 0)).normalized() * width
    mid = base.lerp(tip, 0.44)
    ridge = mid + Vector((0, 0, width * 0.28))
    v = [bm.verts.new(p) for p in (base, mid - cross, ridge, mid + cross, tip)]
    for a, b, c in ((0, 1, 2), (0, 2, 3), (1, 4, 2), (2, 4, 3)):
        bm.faces.new((v[a], v[b], v[c])).smooth = True


def grove(canes, leaves, rng):
    # Vary the internodes and the leaning silhouettes. The low stems keep the
    # open left edge of the bath, and their shadows fall across the cedar deck.
    stems = [
        (12.72, 6.48, 1.88, -0.20, -0.15),
        (12.52, 6.65, 1.36, -0.24, -0.01),
        (12.81, 6.69, 2.05, -0.18, 0.04),
        (12.72, 6.80, 1.57, -0.36, 0.01),
        (12.86, 6.37, 1.46, -0.10, -0.13),
        (12.58, 6.77, 1.73, -0.35, -0.12),
    ]
    for n, (x, y, h, dx, dy) in enumerate(stems):
        center = reed(canes, (x, y, 0.053), h, 0.015 + 0.003 * (n % 3), (dx, dy))
        for j in range(6):
            root = center(0.47 + 0.102 * j)
            # Sprays turn back from the glazing at x=13.03.
            angle = (1.57 + rng.random() * math.pi) if x > 12.65 else rng.uniform(0, math.tau)
            d = Vector((math.cos(angle), math.sin(angle), rng.uniform(0.15, 0.46)))
            spread = (0.50 - j * 0.042) * rng.uniform(0.83, 1.22)
            elbow = root + d * spread * 0.57 + Vector((0, 0, 0.065))
            tip = root + d * spread
            decor.cylinder(canes, root, elbow, 0.0055, 4, caps=False)
            decor.cylinder(canes, elbow, tip, 0.0035, 4, caps=False)
            for k in range(7):
                point = elbow.lerp(tip, k / 7)
                a = angle + (1 if k % 2 else -1) * rng.uniform(0.37, 1.11)
                vector = Vector((math.cos(a), math.sin(a), rng.uniform(-0.71, 0.08))) * rng.uniform(0.16, 0.26)
                blade(leaves, point, point + vector, rng.uniform(0.017, 0.026))


def maple(bark, green, copper, rng):
    """A low spreading lace of palmate leaves casts shade across the approach."""
    foot = Vector((11.91, 2.63, 0.035))
    fork = foot + Vector((0.105, 0.08, 0.64))
    decor.cylinder(bark, foot, fork, 0.048, 8)
    for n, (x, y, h) in enumerate([(-0.74, 0.41, 1.76), (0.42, 0.27, 2.16), (0.11, -0.31, 1.64), (-0.35, 0.04, 2.03)]):
        elbow = fork + Vector((x * 0.27, y * 0.35, h * 0.33))
        top = foot + Vector((x, y, h))
        decor.cylinder(bark, fork, elbow, 0.028 - 0.002 * n, 7, caps=False)
        decor.cylinder(bark, elbow, top, 0.018, 6, caps=False)
        for j in range(6):
            a = (j / 6 + rng.uniform(-0.06, 0.06)) * math.tau
            run = rng.uniform(0.22, 0.47)
            mid = elbow.lerp(top, 0.59 + 0.075 * j)
            tip = mid + Vector((math.cos(a) * run, math.sin(a) * run, rng.uniform(0.08, 0.26)))
            decor.cylinder(bark, mid, tip, 0.006, 5, caps=False)
            for k in range(9):
                root = mid.lerp(tip, 0.18 + 0.095 * k)
                angle = a + (1 if k % 2 else -1) * rng.uniform(0.71, 1.46)
                axis = Vector((math.cos(angle), math.sin(angle), rng.uniform(-0.38, 0.04))).normalized()
                side = Vector((-axis.y, axis.x, 0.18 * math.sin(angle))).normalized()
                size = rng.uniform(0.065, 0.106)
                base = root + axis * 0.041
                decor.cylinder(bark, root, base, 0.002, 3, caps=False)
                bm = copper if (j + k + n) % 7 == 0 else green
                ridge = bm.verts.new(base + axis * size * 0.30 + Vector((0, 0, 0.004)))
                outline = [
                    (0, 0),
                    (-0.49, 0.18),
                    (-0.22, 0.29),
                    (-0.71, 0.64),
                    (-0.26, 0.43),
                    (-0.36, 0.90),
                    (-0.13, 0.57),
                    (0, 1.05),
                    (0.13, 0.57),
                    (0.36, 0.90),
                    (0.26, 0.43),
                    (0.71, 0.64),
                    (0.22, 0.29),
                    (0.49, 0.18),
                ]
                ring = [bm.verts.new(base + size * (axis * z + side * w)) for w, z in outline]
                for i, v in enumerate(ring):
                    bm.faces.new((v, ring[(i + 1) % len(ring)], ridge)).smooth = True


def build():
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(PREFIX):
            bpy.data.objects.remove(obj, do_unlink=True)
    rng = random.Random(44719)
    mats = [
        gravel_material(),
        decor.material(STONE, (0.12, 0.154, 0.148), 0.56),
        decor.material(CANE, (0.26, 0.315, 0.135), 0.67),
        decor.material(FOLIAGE, (0.14, 0.245, 0.112), 0.71),
        decor.material(FERN, (0.19, 0.31, 0.16), 0.76),
        decor.material(MAPLE_BARK, (0.165, 0.148, 0.132), 0.89),
        decor.material(MAPLE_LEAF, (0.157, 0.264, 0.082), 0.78),
        decor.material(MAPLE_TIP, (0.38, 0.233, 0.10), 0.75),
    ]
    gravel, stones, culms, leaves, ferns, bark, maple_green, maple_copper = [bmesh.new() for _ in mats]
    # A low crescent follows the rear quarter of the cedar tub. It stops short
    # of the ocean guard and leaves the front step and the cold-room door dry.
    inside, outside = [], []
    for i in range(19):
        a = (12 + 70 * i / 18) * math.pi / 180
        vx, vy = 0.955 * math.cos(a), 1.10 * math.sin(a)
        limit = min((12.944 - 11.72) / vx, (7.00 - 5.59) / vy)
        if vy - 0.733 * vx > 0:
            limit = min(limit, (6.36 + 0.733 * (11.72 - 11.14) - 5.59 - 0.09) / (vy - 0.733 * vx))
        width = (limit - 1) * min(1, 0.23 + 0.50 * min(i, 18 - i))
        inside.append((11.72 + vx, 5.59 + vy, 0.054))
        outside.append((11.72 + (1 + width) * vx, 5.59 + (1 + width) * vy, 0.054))
    patch(gravel, inside, outside, (12.46, 6.67), 0.012)
    # A quiet drift between the exercise room and the bath. Softly curved
    # edges leave room for a visitor to pause and turn back to the lawn.
    inner, outer = [], []
    for i in range(25):
        t = i / 24
        x = 10.85 + 3.34 * t
        y = 2.105 + 0.04 * t
        width = 0.125 + 0.99 * math.sin(math.pi * t) ** 0.64
        inner.append((x, y, 0.032))
        outer.append((x, y + width, 0.032))
    patch(gravel, inner, outer, (12.39, 2.70), 0.012)
    # A shallow run of the same aggregate comes out beside the cedar step. The
    # bare-foot path passes its broad lozenge of rock before reaching the tub.
    left, right = [], []
    for i in range(17):
        t = i / 16
        y = 3.56 + 1.86 * t
        x = 10.64 + 0.11 * t + 0.065 * math.cos(math.pi * t)
        width = 0.045 + 0.47 * math.sin(math.pi * t) ** 0.70
        left.append((x - width, y, 0.034))
        right.append((x + 0.12 * width, y, 0.034))
    patch(gravel, left, right, (10.44, 4.51), 0.012)
    for x, y, z, rx, ry, rz in [
        (10.45, 4.51, 0.058, 0.135, 0.24, 0.105),
        (10.48, 4.78, 0.04, 0.085, 0.11, 0.052),
        (12.39, 2.70, 0.06, 0.30, 0.125, 0.115),
        (12.04, 2.62, 0.051, 0.11, 0.085, 0.062),
        (12.68, 2.75, 0.059, 0.15, 0.091, 0.066),
        (12.43, 6.66, 0.075, 0.18, 0.105, 0.11),
        (12.65, 6.49, 0.066, 0.111, 0.085, 0.064),
        (12.18, 6.79, 0.062, 0.095, 0.07, 0.057),
    ]:
        blob(stones, (x, y, z), (rx, ry, rz), rng, subdivisions=2)
    for j in range(3):
        x, y, reach = [(11.38, 2.54, 0.46), (11.63, 2.58, 0.34), (13.53, 2.70, 0.31)][j]
        for k in range(7):
            leaf(
                ferns,
                (x, y, 0.033),
                rng.uniform(-0.23, 0.23) + k * math.tau / 7,
                reach * rng.uniform(0.75, 1.1),
                0.065,
                rng.uniform(47, 73),
                rng.uniform(52, 85),
                stations=4,
            )
    grove(culms, leaves, rng)
    maple(bark, maple_green, maple_copper, rng)
    labels = ("gravel", "stone", "culms", "leaves", "groundcover", "maple_limb", "maple_crown", "maple_tips")
    for label, bm, mat in zip(labels, (gravel, stones, culms, leaves, ferns, bark, maple_green, maple_copper), mats):
        ob = decor.from_bmesh(PREFIX + label, bm, mat, smooth=label != "gravel")
        ob["installationGroup"] = "ocean-baths"
        if label in ("gravel", "leaves", "groundcover", "maple_crown", "maple_tips"):
            ob["walk"] = "through"
    bpy.context.view_layer.update()


if __name__ == "__main__":
    build()
    dest = next(a.split("=", 1)[1] for a in sys.argv if a.startswith("--save-as="))
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(dest).resolve()), compress=True)
