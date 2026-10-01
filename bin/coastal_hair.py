"""Long swept-back hair authored as a continuous scalp and layered nape.

The high forehead, exposed ears and quiet part follow Sirui's portrait. Fine
flattened flow ribbons sit on the surface; no fringe lobes or tube curtains.
"""

import math
import bpy
from coastal_sculpt import surface


def hair_sculpt(head_z, head_scale, hair, h, natural=False):
    hx, hy, hz = head_scale
    result = []

    def sheet(name, verts, faces, thickness=0.004):
        obj = surface(name, verts, faces, hair)
        bpy.context.view_layer.objects.active = obj
        solid = obj.modifiers.new("Fine hair volume", "SOLIDIFY")
        solid.thickness = thickness
        bpy.ops.object.modifier_apply(modifier=solid.name)
        result.append((obj, "Head"))
        return obj

    def scalp(a, p, lift=0):
        # The side part flows behind the crown rather than falling onto the eye.
        sweep = a + 0.08 * math.sin(p) * math.sin(a + 0.4)
        ripple = 0.0011 * math.sin(a * 35 + p * 8) * math.sin(p)
        crest = 0.05 * max(0, math.cos(a)) * math.exp(-((p - 0.65) / 0.42) ** 2)
        radial = (1.075 if natural else 1.065) + lift + crest
        contour = math.sin(p) ** (0.82 if natural else 0.70)
        return (
            (hx * radial + ripple) * contour * math.sin(sweep),
            (-0.015 if natural else 0.012) - (hy * radial + ripple) * contour * math.cos(sweep),
            head_z + hz * (radial * math.cos(p) + 0.013 * math.sin(a)),
        )

    def hairline(a):
        front = max(0, math.cos(a))
        if natural:
            # Keep the swept forehead clear across the full lens width. The
            # recession turns behind the temple before dropping around the ear.
            return 1.90 - front**0.70 * 1.02 - 0.47 * abs(math.sin(a))**10
        return 1.90 - front**2 * (0.83 + 0.12 * math.sin(a)) - 0.48 * abs(math.sin(a))**8

    verts, faces, columns, rows = [], [], 80, 22
    for row in range(rows + 1):
        t = row / rows
        for j in range(columns):
            a = j * math.tau / columns
            # A slightly asymmetric M hairline leaves the adult forehead open.
            end = hairline(a)
            p = 0.012 + t * end
            verts.append(scalp(a, p))
    for row in range(rows):
        for j in range(columns):
            a, b = row * columns + j, row * columns + (j + 1) % columns
            faces.append((a, a + columns, b + columns, b))
    sheet("swept back continuous scalp", verts, faces)

    # Fine broad ribbons describe the comb direction without a second hair cap.
    # Each begins at the visible hairline and turns continuously toward the back.
    for strand in range(24):
        side = -1 if strand < 14 else 1
        offset = (strand if side < 0 else strand - 14) / (13 if side < 0 else 9)
        verts, faces, rows = [], [], 20
        for i in range(rows + 1):
            t = i / rows
            a = side * (0.10 + offset * 0.95 + t * 1.40)
            p = 0.93 - t * 0.48 + t * t * 1.09
            if natural:
                p = min(p, hairline(a) - 0.025)
            width = 0.018 * math.sin(math.pi * (0.08 + 0.89 * t))
            for j in range(3):
                aa = a + (j - 1) * width
                lift = 0.006 * math.sin(math.pi * t) * (1 - abs(j - 1) * 0.5)
                verts.append(scalp(aa, p, lift))
        for i in range(rows):
            for j in range(2):
                k = i * 3 + j
                faces.append((k, k + 3, k + 4, k + 1))
        sheet("flattened backward flow", verts, faces, 0.0015)

    # Long hair lies behind the ear, tapers toward the neck, then opens softly
    # over the collar. A continuous sheet avoids a cylindrical or pigtail side.
    for layer in range(2):
        verts, faces, columns, rows = [], [], 48, 22
        for row in range(rows + 1):
            t = row / rows
            for j in range(columns + 1):
                a = math.pi / 2 + j / columns * math.pi
                spread = 1.0 - (0.20 if natural else 0.15) * math.sin(t * math.pi * 0.8)
                spread += 0.14 * max(0, (t - 0.75) / 0.25) ** 2
                edge_taper = math.sin((a - math.pi / 2)) ** 0.5
                ripple = 0.0018 * math.sin(a * 31 - t * 5)
                tuck = 1 - 0.12 * (1 - edge_taper) * math.sin(t * math.pi)
                x = math.sin(a) * (hx * spread * tuck + ripple + layer * 0.003)
                y = 0.02 - math.cos(a) * (hy * spread + ripple)
                y += 0.044 * math.sin(t * math.pi) + 0.023 * t + layer * 0.004
                y += 0.045 * (1 - edge_taper) * (1 - t) ** 2
                z = head_z + hz * (0.22 + 0.16 * (1 - edge_taper) * (1 - t) ** 2
                                  - t * (1.74 - layer * 0.14))
                # Ends are unequal and pointed, without repeated curling lobes.
                z += hz * (0.025 * math.sin(a * 13) + 0.075 * (1 - edge_taper)) * t**6
                verts.append((x, y, z))
        for row in range(rows):
            for j in range(columns):
                p = row * (columns + 1) + j
                faces.append((p, p + columns + 1, p + columns + 2, p + 1))
        sheet("ear tucked collar length hair", verts, faces, 0.006)
    return result
