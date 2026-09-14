"""Sirui's side-parted, ear-tucked hair, built from broad tapered surfaces.

The back reaches the collar. Exposed ears, forehead and jaw are intentional;
long hair must not become two cylindrical side curtains or a helmet.
"""

import math
import bpy
from coastal_sculpt import surface, swept_lock


def hair_sculpt(head_z, head_scale, hair, h):
    hx, hy, hz = head_scale
    result = []

    def sheet(name, verts, faces, thickness=0.007):
        obj = surface(name, verts, faces, hair)
        bpy.context.view_layer.objects.active = obj
        solid = obj.modifiers.new("tapered hair volume", "SOLIDIFY")
        solid.thickness = thickness
        bpy.ops.object.modifier_apply(modifier=solid.name)
        result.append((obj, "Head"))
        return obj

    # A continuous scalp, with the part on Sirui's left and the heavier sweep
    # over the opposite temple. The high forehead follows his portrait.
    verts, faces, n, rows = [], [], 96, 24
    for row in range(rows + 1):
        t = row / rows
        for j in range(n):
            a = j * math.tau / n
            front = max(0, math.cos(a))
            end = 1.91 - front**2 * (1.03 + 0.10 * math.sin(a))
            p = 0.012 + t * end
            sweep = a + 0.14 * (1 - t) * math.sin(a)
            ridge = (0.0013 * math.cos(a * 31 + p * 6) + .006*math.sin(a*3+p*2)+.003*math.sin(a*7-p*4)) * math.sin(p)
            verts.append(
                (
                    (hx * 1.075 + ridge) * math.sin(p) ** 0.66 * math.sin(sweep),
                    0.018 - (hy * 1.075 + ridge) * math.sin(p) ** 0.66 * math.cos(sweep),
                    head_z + hz * (1.065 * math.cos(p) + 0.018 * math.sin(a)),
                )
            )
    for row in range(rows):
        for j in range(n):
            a, b = row * n + j, row * n + (j + 1) % n
            faces.append((a, a + n, b + n, b))
    sheet("side parted scalp", verts, faces)

    # Layered back hair: flat, fine-edged locks, behind the ears. The bottom
    # turns outward at the nape instead of forming a straight bob at the jaw.
    for layer in range(2):
        verts, faces, cols, rows = [], [], 72, 20
        for i in range(rows + 1):
            t = i / rows
            for j in range(cols + 1):
                a = 1.57 + j / cols * math.pi
                ripple = 0.0045 * math.sin(a * 21 + t * 2.3)
                spread = 1.025 - 0.12 * t + 0.25 * max(0, (t - 0.77) / 0.23) ** 2
                z = head_z + hz * (0.28 - t * (1.72 - layer * 0.24))
                z += hz * 0.055 * math.cos(a * 5) * t**5
                # Ear tuck and a backward flow leave the cheek silhouette open.
                x = math.sin(a) * (hx * spread + ripple + layer * 0.005)
                y = 0.028 - math.cos(a) * (hy * spread + ripple) + t * 0.05
                y += 0.045 * math.sin(t * math.pi) + layer * 0.008
                verts.append((x, y, z))
        for i in range(rows):
            for j in range(cols):
                p = i * (cols + 1) + j
                faces.append((p, p + cols + 1, p + cols + 2, p + 1))
        sheet("layered collar length hair", verts, faces, 0.009)

    # Broad ribbon fringe sweeps across the forehead and behind one ear.
    # Narrow ridges lie on its surface; none of these strands is a round tube.
    for layer in range(6):
        verts, faces, rows, cols = [], [], 28, 6
        for i in range(rows + 1):
            t = i / rows
            a = 0.35 + layer*.028 - t * (2.18+layer*.035)
            p = 0.29 + t * (1.11 + layer * 0.017)
            for j in range(cols + 1):
                w = (j / cols - 0.5) * 0.19 * math.sin(math.pi * (0.08 + t * 0.90))
                cap_end = 1.91 - max(0, math.cos(a)) ** 2 * (1.03 + 0.10 * math.sin(a))
                # Follow the scalp continuously. Clamping a strip against the
                # hairline collapsed whole rows into a sharp folded triangle.
                polar = (p + layer * 0.036 + w) * .87
                radius = 1.095 + 0.016 * math.sin(j / cols * math.pi)
                verts.append(
                    (
                        hx * radius * math.sin(polar) ** 0.66 * math.sin(a),
                        0.010 - hy * radius * math.sin(polar) ** 0.66 * math.cos(a),
                        head_z + hz * radius * math.cos(polar),
                    )
                )
        for i in range(rows):
            for j in range(cols):
                p = i * (cols + 1) + j
                faces.append((p, p + cols + 1, p + cols + 2, p + 1))
        sheet("swept flat fringe", verts, faces, 0.005)
    # Broad asymmetrical locks lift away from the scalp and sweep to the ear.
    # Their flattened cross-section creates a readable flow at widget scale.
    for i in range(11):
        t=i/10
        points=[(.25*hx,-hy*.40,head_z+hz*(1.03-.07*t)),
                (-.25*hx,-hy*(.72+.12*t),head_z+hz*(1.00-.21*t)),
                (-.79*hx,-hy*(.76+.13*t),head_z+hz*(.75-.32*t)),
                (-1.04*hx,-hy*.35,head_z+hz*(.27-.32*t)),
                (-1.02*hx,hy*.13,head_z-hz*(.15+.16*t))]
        o=swept_lock('swept temple lock',points,[.010,.025,.023,.016,.0018],hair,width=1.8,sides=12)
        result.append((o,'Head'))
    for side in (-1,1):
        for i in range(6):
            t=i/5
            o=swept_lock('tapered nape lock',[(side*hx*.92,hy*(.1+.6*t),head_z-.2*hz),
                (side*hx*(.90-.1*t),hy*(.22+.62*t),head_z-.8*hz),
                (side*hx*(1.00-.18*t),hy*(.31+.61*t),head_z-1.3*hz),
                (side*hx*(1.23-.27*t),hy*(.36+.59*t),head_z-1.42*hz)],
                [.013,.019,.016,.0015],hair,width=1.7,sides=10)
            result.append((o,'Head'))
    return result
