"""A glass front, a terrace and two alcove screens for the cave house (Sirui, 2026-10-14).

The cave mouth gets a glazed front set back inside the rock lip: a dark bronze frame scribed to
the arch, a door head at 3.2 m, fixed low-iron glass, and two lift-and-slide doors placed where
the kitchen and lounge views look in. By day the browser slides those doors into the rock jambs,
so the two views look through open doorways; at night they close (light-installations.mjs).
Above the door head the arch is one fixed lunette that lifts away with the vault in cut-away
views. A cut-stone pier fills the eroded north foot of the jamb and houses the lounge door.

Outside, a terrace is carved from the cliff as a corbelled sandstone ledge: deepest (3.1 m) on
the south, where the rock that continues the jamb shelters it, and narrowing to a walk at the
north end. Travertine paving, a sandstone parapet with travertine coping and a glass balustrade,
a built-in bench against the rock beside a fire bowl, two loungers, a bistro table, planters
and a festoon of bulbs strung on posts around the edge.

Inside, full-height cedar slat screens make the bedroom and the onsen alcoves beside the study.
The plan then runs from the open terrace through the double-height living floor and the study
loft to the two most enclosed rooms at the back: an intimacy gradient, with prospect at the
mouth and refuge in the rock. House coordinates: +X north, +Y west (the sea), Z up.
"""

import math
import random
import bmesh
import bpy
from mathutils import Matrix, Vector, noise

from coastal_decor import box, cylinder, from_bmesh, lathe, material
from coastal_landscape import cliff_surface

FACADE_Y = 4.48
OUTER_TRACK = 4.52  # fixed panes
INNER_TRACK = 4.44  # sliding doors
FRAME = (0.07, 0.12)  # bronze sub-frame scribed to the rock: face width, depth
DOOR_HEAD, HEAD_TOP = 3.19, 3.29
MULLIONS = (-3.4, -0.85, 2.0, 4.0)
# Door openings line up with the kitchen and lounge views; each slides toward its jamb.
DOORS = {"kitchen": (-3.4, -0.85, -1), "lounge": (2.0, 4.0, 1)}
PIER = {"min": (5.13, 3.62, -0.32), "max": (6.05, 4.7, 1.12)}
TERRACE = {"back": 4.58, "south": -5.35, "north": 5.2, "depth": 3.1, "power": 2.3, "top": 0.0, "paver": 0.026}
PARAPET = {"width": 0.3, "height": 0.45, "coping": 0.04, "glassTop": 1.08, "rail": 1.1}
# Festoon: eye bolts in the rock at both ends, posts on the parapet at these x positions.
FESTOON = {"south": (-5.12, 6.95, 2.62), "north": (5.15, 4.66, 2.62), "posts": (-2.6, 0.45, 2.95), "height": 2.5, "sag": 0.32}
SCREENS = {"west": (-1.78, -3.55, -2.75), "east": (1.87, -5.1, -2.45)}
UPPER_FLOOR, SCREEN_TOP, EAST_WALL_TOP, EAST_WALL_END = 2.6, 4.85, 3.8, -3.52


def arch_x(z):
    """Half-width of the excavated arch (coastal_section.coast) at height z."""
    if z <= 0.04:
        return 5.2
    s = min(1.0, ((z - 0.04) / 5.95) ** (1 / 0.44))
    return 5.2 * math.sqrt(max(0.0, 1 - s * s))


def arch_z(x):
    """Height of the arch above the floor at |x| (inverse of arch_x)."""
    c = min(1.0, abs(x) / 5.2)
    return 0.04 + 5.95 * math.sqrt(1 - c * c) ** 0.44


def arch_polyline(samples=96):
    """The rock line of the arch from the south foot over the crown to the north foot."""
    points = [(-5.2, 0.0)]
    for k in range(samples + 1):
        a = math.pi * (1 - k / samples)
        points.append((5.2 * math.cos(a), 0.04 + 5.95 * math.sin(a) ** 0.44))
    points.append((5.2, 0.0))
    return points


ARCH_REVEAL = 0.005


def inset_path(path, distance, inside=(0.0, 2.2)):
    """Offset an xz polyline toward the inside point by ``distance`` along its local normals."""
    out = []
    for i, (x, z) in enumerate(path):
        a, b = path[max(0, i - 1)], path[min(len(path) - 1, i + 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]
        length = math.hypot(tx, tz) or 1.0
        nx, nz = -tz / length, tx / length
        if nx * (inside[0] - x) + nz * (inside[1] - z) < 0:
            nx, nz = -nx, -nz
        out.append((x + nx * distance, z + nz * distance))
    return out


def sweep(bm, path, width, depth, y, inside=(0.0, 2.2)):
    """A rectangular bar along an xz polyline: `width` toward the inside point, `depth` along y."""
    rings = []
    for i, (x, z) in enumerate(path):
        a, b = path[max(0, i - 1)], path[min(len(path) - 1, i + 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]
        length = math.hypot(tx, tz) or 1.0
        nx, nz = -tz / length, tx / length
        if nx * (inside[0] - x) + nz * (inside[1] - z) < 0:
            nx, nz = -nx, -nz
        ring = []
        for dy in (-depth / 2, depth / 2):
            ring.append(bm.verts.new((x, y + dy, z)))
            ring.append(bm.verts.new((x + nx * width, y + dy, z + nz * width)))
        rings.append([ring[0], ring[1], ring[3], ring[2]])
    for lower, upper in zip(rings, rings[1:]):
        for k in range(4):
            bm.faces.new((lower[k], lower[(k + 1) % 4], upper[(k + 1) % 4], upper[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])


def slab(bm, outline, y0, y1):
    """Extrude a convex xz outline between two y planes (a glass pane or a flat plate)."""
    front = [bm.verts.new((x, y0, z)) for x, z in outline]
    back = [bm.verts.new((x, y1, z)) for x, z in outline]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    n = len(outline)
    for k in range(n):
        bm.faces.new((front[k], back[k], back[(k + 1) % n], front[(k + 1) % n]))


def plate(bm, outline, z0, z1):
    """Extrude a convex xy outline between two heights."""
    bottom = [bm.verts.new((x, y, z0)) for x, y in outline]
    top = [bm.verts.new((x, y, z1)) for x, y in outline]
    bm.faces.new(list(reversed(bottom)))
    bm.faces.new(top)
    n = len(outline)
    for k in range(n):
        bm.faces.new((bottom[k], bottom[(k + 1) % n], top[(k + 1) % n], top[k]))


def inner_arch(width=FRAME[0]):
    """The frame's inside edge: the arch polyline offset toward the opening."""
    path = arch_polyline()
    inner = []
    for i, (x, z) in enumerate(path):
        a, b = path[max(0, i - 1)], path[min(len(path) - 1, i + 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]
        length = math.hypot(tx, tz) or 1.0
        nx, nz = -tz / length, tx / length
        if nx * -x + nz * (2.2 - z) < 0:
            nx, nz = -nx, -nz
        inner.append((x + nx * width, z + nz * width))
    return inner


def inner_height(x, inner):
    """Height of the frame's inside edge above x (upper branch)."""
    best = None
    for (x0, z0), (x1, z1) in zip(inner, inner[1:]):
        if min(x0, x1) <= x <= max(x0, x1) and x1 != x0 and max(z0, z1) > 1.0:
            z = z0 + (z1 - z0) * (x - x0) / (x1 - x0)
            best = z if best is None else max(best, z)
    return best if best is not None else 0.0


def jamb_x(z, side, inner):
    """x of the frame's inside edge on one jamb at height z."""
    candidates = []
    for (x0, z0), (x1, z1) in zip(inner, inner[1:]):
        if min(z0, z1) <= z <= max(z0, z1) and (x0 * side > 2.5):
            t = 0.0 if z1 == z0 else (z - z0) / (z1 - z0)
            candidates.append(x0 + (x1 - x0) * t)
    return min(candidates, key=abs) if candidates else side * (arch_x(z) - FRAME[0])


# Front -------------------------------------------------------------------------------------------

def front(bronze, glass, stone):
    inner = inner_arch()
    frame, lunette_frame, panes, lunette = bmesh.new(), bmesh.new(), bmesh.new(), bmesh.new()
    path = arch_polyline()
    lower = [p for p in path if p[1] <= HEAD_TOP + 0.02]
    south = [p for p in lower if p[0] < 0]
    north = [p for p in lower if p[0] > 0]
    for side in (south, north):
        side = sorted(side, key=lambda p: p[1])
        sweep(frame, [(side[0][0], 0.0)] + side[1:] + [(side[-1][0], HEAD_TOP)], FRAME[0], FRAME[1], FACADE_Y)
    upper = [p for p in path if p[1] >= HEAD_TOP - 0.02]
    # A 5 mm shadow reveal below the rock arch: the frame's outer face and the rock's double-sided
    # underside must not share one surface, or their depth tie flips as draws regroup.
    sweep(lunette_frame, inset_path(upper, ARCH_REVEAL), FRAME[0], FRAME[1], FACADE_Y)
    # The door head: a deeper beam from jamb to jamb.
    span = arch_x(HEAD_TOP) - 0.02
    box(frame, Vector((0, FACADE_Y, (DOOR_HEAD + HEAD_TOP) / 2)), (2 * span, 0.16, HEAD_TOP - DOOR_HEAD))
    # Lower posts double as the door jambs; a flush bronze threshold carries both tracks.
    for x in MULLIONS:
        box(frame, Vector((x, FACADE_Y, (0.004 + DOOR_HEAD) / 2)), (0.06, 0.14, DOOR_HEAD - 0.004))
    box(frame, Vector((-0.06, (TERRACE["back"] + 4.37) / 2, 0.0035)), (10.28, TERRACE["back"] - 4.37, 0.007))
    for x in MULLIONS:
        top = arch_z(x) - ARCH_REVEAL
        box(lunette_frame, Vector((x, FACADE_Y, (HEAD_TOP + top) / 2)), (0.05, 0.12, top - HEAD_TOP))
    # Fixed lower panes on the outer track: south of the kitchen door, the gym bay, north of the lounge door.
    heights = [0.012 + k * (DOOR_HEAD - 0.012) / 8 for k in range(9)]
    south_pane = [(-3.425, 0.012), (-3.425, DOOR_HEAD)] + [(jamb_x(z, -1, inner), z) for z in reversed(heights)]
    north_pane = [(4.025, DOOR_HEAD), (4.025, 0.012)] + [(min(jamb_x(z, 1, inner), PIER["min"][0] - 0.01), z) for z in heights]
    for outline in (south_pane, [(-0.82, 0.012), (1.97, 0.012), (1.97, DOOR_HEAD), (-0.82, DOOR_HEAD)], north_pane):
        slab(panes, outline, OUTER_TRACK - 0.006, OUTER_TRACK + 0.006)
    # The lunette: five fixed strips between the mullion lines and under the arch.
    edges = [-6.0, *MULLIONS, 6.0]
    for x0, x1 in zip(edges, edges[1:]):
        left = max(x0 + 0.025, jamb_x(HEAD_TOP + 0.02, -1, inner))
        right = min(x1 - 0.025, jamb_x(HEAD_TOP + 0.02, 1, inner))
        xs = [left + (right - left) * k / 10 for k in range(11)]
        top = [(x, inner_height(x, inner)) for x in reversed(xs)]
        outline = [(left, HEAD_TOP + 0.01), (right, HEAD_TOP + 0.01)] + top
        slab(lunette, outline, FACADE_Y - 0.006, FACADE_Y + 0.006)
    pier = bmesh.new()
    lo, hi = Vector(PIER["min"]), Vector(PIER["max"])
    box(pier, (lo + hi) / 2, tuple(hi - lo))
    bmesh.ops.bevel(pier, geom=[e for e in pier.edges], offset=0.06, segments=4, affect="EDGES")
    objects = [
        from_bmesh("core_facade_frame", frame, bronze, smooth=False),
        from_bmesh("core_facade_glass", panes, glass, smooth=False),
        from_bmesh("core_facade_lunette_frame", lunette_frame, bronze, smooth=False),
        from_bmesh("core_facade_lunette_glass", lunette, glass, smooth=False),
        from_bmesh("core_facade_north_pier", pier, stone, smooth=False),
    ]
    for obj in objects[2:4]:
        obj["caveRoof"] = True
    return objects + [door(name, *span, bronze, glass) for name, span in DOORS.items()]


def door(name, x0, x1, direction, bronze, glass):
    """A lift-and-slide panel: bronze stiles and rails, one low-iron pane, pulls on both faces."""
    a, b, z0, z1 = x0 + 0.03, x1 - 0.03, 0.012, DOOR_HEAD - 0.02
    frame, pane = bmesh.new(), bmesh.new()
    y, d, stile = INNER_TRACK, 0.06, 0.055
    for x in (a + stile / 2, b - stile / 2):
        box(frame, Vector((x, y, (z0 + z1) / 2)), (stile, d, z1 - z0))
    box(frame, Vector(((a + b) / 2, y, z1 - 0.03)), (b - a, d, 0.06))
    box(frame, Vector(((a + b) / 2, y, z0 + 0.05)), (b - a, d, 0.1))
    slab(pane, [(a + stile - 0.01, z0 + 0.09), (b - stile + 0.01, z0 + 0.09), (b - stile + 0.01, z1 - 0.05), (a + stile - 0.01, z1 - 0.05)], y - 0.006, y + 0.006)
    # The pull sits by the edge that closes against its post.
    px = b - 0.13 if direction < 0 else a + 0.13
    for side in (-1, 1):
        face = y + side * d / 2
        cylinder(frame, (px, face + side * 0.045, 0.92), (px, face + side * 0.045, 1.76), 0.014, segments=10)
        for z in (1.0, 1.68):
            cylinder(frame, (px, face, z), (px, face + side * 0.045, z), 0.009, segments=8)
    obj = from_bmesh(f"core_facade_door_{name}", frame, bronze, smooth=False)
    pane_obj = from_bmesh(f"core_facade_door_{name}_pane", pane, glass, smooth=False)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    pane_obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = obj.data.name = f"core_facade_door_{name}"
    # Three.js shares Blender's X axis; opening slides the panel its own width toward the jamb.
    obj["facadeDoor"] = name
    obj["slideX"] = round(direction * (x1 - x0), 3)
    return obj


# Terrace -----------------------------------------------------------------------------------------

def front_curve(samples=56):
    """Superellipse front edge from the south rock (deepest) to the north end at the facade."""
    t = TERRACE
    a = t["north"] - t["south"]
    points = []
    for k in range(samples + 1):
        theta = (k / samples) * math.pi / 2
        dx = a * math.sin(theta) ** (2 / t["power"])
        dy = t["depth"] * math.cos(theta) ** (2 / t["power"])
        points.append((t["south"] + dx, t["back"] + dy))
    return points


def outline():
    return [(TERRACE["south"], TERRACE["back"])] + front_curve()


def clip(polygon, edges):
    """Sutherland-Hodgman clip of a polygon to a convex counter-clockwise outline."""
    out = polygon
    for (ax, ay), (bx, by) in zip(edges, edges[1:] + edges[:1]):
        inside = lambda p: (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax) >= 0
        source, out = out, []
        for k, p in enumerate(source):
            q = source[k - 1]
            if inside(p):
                if not inside(q):
                    out.append(cross(q, p, (ax, ay), (bx, by)))
                out.append(p)
            elif inside(q):
                out.append(cross(q, p, (ax, ay), (bx, by)))
        if not out:
            break
    return out


def cross(p, q, a, b):
    x1, y1, x2, y2 = *p, *q
    x3, y3, x4, y4 = *a, *b
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
    return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))


def area(polygon):
    return 0.5 * sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(polygon, polygon[1:] + polygon[:1]))


def ledge(rock):
    """The corbelled ledge: a 0.45 m lip, then an underside that curves back into the cliff."""
    curve = front_curve(110)
    back = [(x, 0.0) for x in [TERRACE["north"] - k * (TERRACE["north"] - TERRACE["south"]) / 12 for k in range(13)]]
    top, lip = -TERRACE["paver"], -0.32
    layers = 16
    bm = bmesh.new()
    rings = []
    for layer in range(layers + 1):
        s = layer / layers
        ring = []
        for x, y in curve:
            over = y - (cliff_surface(x, -0.5) - 0.0)
            depth = max(0.45, min(2.4, 1.1 * over))
            if layer == 0:
                z, yy = top, y
            else:
                phi = (layer - 1) / (layers - 1) * math.pi / 2
                z = lip - depth * math.sin(phi) ** 1.25
                anchor = min(y, cliff_surface(x, z) - 0.45)
                yy = anchor + (y - anchor) * math.cos(phi) ** 0.8
                if layer > 1:
                    # Natural rock under the carved lip: recessed sandstone beds every 0.42 m and
                    # three octaves of noise, fading out where the underside meets the lip and cliff.
                    bed = 0.5 + 0.5 * math.cos(math.tau * (z + 0.05 * x) / 0.42)
                    p = Vector((x, z, 3.7))
                    rough = 0.6 * noise.noise(p * 0.9) + 0.3 * noise.noise(p * 2.3) + 0.1 * noise.noise(p * 5.5)
                    yy -= (0.07 * bed + 0.2 * rough) * math.sin(phi * 2) ** 0.5
            ring.append(Vector((x, yy, z)))
        for x, _ in back:
            z = top if layer == 0 else lip - 2.4 * math.sin((layer - 1) / (layers - 1) * math.pi / 2) ** 1.25
            ring.append(Vector((x, min(4.3, cliff_surface(x, min(z, -0.3)) - 0.45), z)))
        rings.append([bm.verts.new(p) for p in ring])
    n = len(rings[0])
    for upper, lower in zip(rings, rings[1:]):
        for k in range(n):
            bm.faces.new((upper[k], upper[(k + 1) % n], lower[(k + 1) % n], lower[k]))
    bm.faces.new(rings[0])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    obj = from_bmesh("core_terrace_ledge", bm, rock)
    return obj


def paving(stone, size=0.6, joint=0.006):
    edges = outline()
    if area(edges) < 0:
        edges.reverse()
    bm = bmesh.new()
    count = 0
    for i in range(-10, 10):
        for j in range(0, 6):
            x0, y0 = i * size + joint / 2, TERRACE["back"] + j * size + joint / 2
            tile = [(x0, y0), (x0 + size - joint, y0), (x0 + size - joint, y0 + size - joint), (x0, y0 + size - joint)]
            piece = clip(tile, edges)
            if len(piece) >= 3 and abs(area(piece)) > 0.004:
                if area(piece) < 0:
                    piece.reverse()
                plate(bm, piece, -TERRACE["paver"], TERRACE["top"])
                count += 1
    return from_bmesh("core_terrace_paving", bm, stone, smooth=False), count


def parapet_path():
    """Centre line of the parapet: up the rock face on the south, then along the front edge."""
    curve = front_curve(64)
    inset = PARAPET["width"] / 2 + 0.01
    path = [(TERRACE["south"] + inset, 6.7)]
    for i, (x, y) in enumerate(curve):
        a, b = curve[max(0, i - 1)], curve[min(len(curve) - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        length = math.hypot(tx, ty) or 1.0
        nx, ny = ty / length, -tx / length  # the curve runs south to north, so this points inward
        path.append((x + nx * inset, y + ny * inset))
    # The north end runs into the pier, which closes the narrow tip.
    path = [p for p in path if p[0] < PIER["min"][0] - 0.05 and p[1] > TERRACE["back"] + 0.2]
    return path + [(PIER["min"][0] + 0.12, TERRACE["back"] + 0.2)]


def offset_path(path, distance):
    out = []
    for i, (x, y) in enumerate(path):
        a, b = path[max(0, i - 1)], path[min(len(path) - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        length = math.hypot(tx, ty) or 1.0
        out.append((x + ty / length * distance, y - tx / length * distance))
    return out


def wall(bm, path, half, z0, z1, round_top=0.06):
    """A wall along a plan polyline with a rounded top (a swept section)."""
    left, right = offset_path(path, -half), offset_path(path, half)
    section = []
    for k in range(5):
        a = k / 4 * math.pi / 2
        section.append((-half + round_top * (1 - math.cos(a)), z1 - round_top * (1 - math.sin(a))))
    section = [(-half, z0)] + section + [(-p, z) for p, z in reversed(section)] + [(half, z0)]
    rings = []
    for i in range(len(path)):
        (lx, ly), (rx, ry) = left[i], right[i]
        ring = []
        for u, z in section:
            t = (u + half) / (2 * half)
            ring.append(bm.verts.new((lx + (rx - lx) * t, ly + (ry - ly) * t, z)))
        rings.append(ring)
    n = len(section)
    for a, b in zip(rings, rings[1:]):
        for k in range(n - 1):
            bm.faces.new((a[k], a[k + 1], b[k + 1], b[k]))
        bm.faces.new((a[-1], a[0], b[0], b[-1]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])


def tube_path(bm, points, radius, segments=8, joints=True):
    for a, b in zip(points, points[1:]):
        cylinder(bm, a, b, radius, segments=segments, caps=not joints)
    # Round joints only where a bend would show a notch; a thin cable bends too little to see it.
    if joints:
        for p in points:
            bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=4, radius=radius, matrix=Matrix.Translation(p))


def resample(path, step):
    out = [path[0]]
    carry = 0.0
    for a, b in zip(path, path[1:]):
        length = math.dist(a, b)
        t = step - carry
        while t <= length:
            out.append((a[0] + (b[0] - a[0]) * t / length, a[1] + (b[1] - a[1]) * t / length))
            t += step
        carry = (carry + length) % step
    if math.dist(out[-1], path[-1]) > 0.05:
        out.append(path[-1])
    return out


def parapet(rock, coping_stone, glass, bronze):
    path = parapet_path()
    body, coping, panes, rail = bmesh.new(), bmesh.new(), bmesh.new(), bmesh.new()
    wall(body, path, PARAPET["width"] / 2, -0.03, PARAPET["height"], round_top=0.02)
    wall(coping, path, PARAPET["width"] / 2 + 0.025, PARAPET["height"], PARAPET["height"] + PARAPET["coping"], round_top=0.012)
    glass_bottom = PARAPET["height"] + PARAPET["coping"] - 0.03
    # Glass runs in panels between the festoon posts, stopping short of each post.
    cuts = sorted(min(range(len(path)), key=lambda i: math.dist(path[i], post)) for post in post_points(path))
    for start, end in zip([0, *cuts], [*cuts, len(path) - 1]):
        section = path[start : end + 1]
        if len(section) < 2:
            continue
        chords = resample(section, 1.15)
        for k, (a, b) in enumerate(zip(chords, chords[1:])):
            length = math.dist(a, b)
            ux, uy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
            trim_a = 0.05 if k == 0 and start in cuts else 0.006
            trim_b = 0.05 if k == len(chords) - 2 and end in cuts else 0.006
            if length < trim_a + trim_b + 0.1:
                continue
            a2 = (a[0] + ux * trim_a, a[1] + uy * trim_a)
            b2 = (b[0] - ux * trim_b, b[1] - uy * trim_b)
            nx, ny = -uy * 0.0075, ux * 0.0075
            quad = [(a2[0] + nx, a2[1] + ny), (b2[0] + nx, b2[1] + ny), (b2[0] - nx, b2[1] - ny), (a2[0] - nx, a2[1] - ny)]
            if area(quad) < 0:
                quad.reverse()
            plate(panes, quad, glass_bottom, PARAPET["glassTop"])
    tube_path(rail, [(x, y, PARAPET["rail"]) for x, y in resample(path, 0.45)], 0.021)
    return [
        from_bmesh("core_terrace_parapet", body, rock),
        from_bmesh("core_terrace_coping", coping, coping_stone),
        from_bmesh("core_terrace_balustrade_glass", panes, glass, smooth=False),
        from_bmesh("core_terrace_cap_rail", rail, bronze),
    ]


def post_points(path=None):
    """Festoon posts stand on the parapet's centre line at the chosen x positions."""
    path = path or parapet_path()
    points = []
    for x in FESTOON["posts"]:
        nearest = min(path, key=lambda p: abs(p[0] - x) + (0 if p[1] > TERRACE["back"] + 0.6 else 9))
        points.append(nearest)
    return points


def festoon_points():
    posts = [(x, y, FESTOON["height"]) for x, y in post_points()]
    return [FESTOON["south"], *posts, FESTOON["north"]]


def catenary(a, b, sag, steps):
    return [Vector(a).lerp(Vector(b), t) - Vector((0, 0, 4 * sag * t * (1 - t))) for t in (k / steps for k in range(steps + 1))]


def festoon(bronze, cable_mat, bulb_glass):
    """Posts on the parapet and a string of bulbs from the south rock to the north jamb."""
    posts, cable, bulbs = bmesh.new(), bmesh.new(), bmesh.new()
    points = festoon_points()
    for x, y, z in points[1:-1]:
        cylinder(posts, (x, y, PARAPET["height"] + PARAPET["coping"]), (x, y, z + 0.06), 0.028, segments=12)
        bmesh.ops.create_uvsphere(posts, u_segments=12, v_segments=6, radius=0.036, matrix=Matrix.Translation((x, y, z + 0.07)))
    for x, y, z in (points[0], points[-1]):
        # Eye bolts set into the rock.
        side = 1 if x < 0 else -1
        cylinder(posts, (x - side * 0.08, y, z), (x, y, z), 0.012, segments=8)
    bulb_positions = []
    for a, b in zip(points, points[1:]):
        span = (Vector(b) - Vector(a)).length
        line = catenary(a, b, FESTOON["sag"] * span / 3.0, 24)
        tube_path(cable, [tuple(p) for p in line], 0.0045, segments=5, joints=False)
        count = max(3, round(span / 0.48))
        for k in range(1, count):
            t = k / count
            p = Vector(a).lerp(Vector(b), t) - Vector((0, 0, 4 * FESTOON["sag"] * span / 3.0 * t * (1 - t)))
            cylinder(cable, tuple(p), tuple(p - Vector((0, 0, 0.05))), 0.007, segments=6)
            bmesh.ops.create_uvsphere(bulbs, u_segments=10, v_segments=6, radius=0.032, matrix=Matrix.Translation(p - Vector((0, 0, 0.085))))
            bulb_positions.append([round(c, 4) for c in (p - Vector((0, 0, 0.085)))])
    return [
        from_bmesh("core_terrace_festoon_posts", posts, bronze),
        from_bmesh("core_terrace_festoon_cable", cable, cable_mat),
        from_bmesh("core_terrace_festoon_bulbs", bulbs, bulb_glass),
    ], bulb_positions


def furniture(mats):
    """Bench and fire bowl in the sheltered south corner, loungers mid-terrace, a bistro table by
    the kitchen door, and planters."""
    teak, canvas, rock, copper, charred, bronze, travertine, terracotta, leaf, bark, rosemary = (
        mats[k] for k in ("teak", "canvas", "rock", "copper", "charred", "bronze", "travertine", "terracotta", "leaf", "bark", "rosemary")
    )
    out = {k: bmesh.new() for k in mats}
    # Built-in bench against the rock that continues the south jamb, facing along the terrace.
    bx0, bx1, by0, by1 = -5.2, -4.7, 5.0, 6.85
    box(out["rock"], Vector(((bx0 + bx1) / 2, (by0 + by1) / 2, 0.19)), (bx1 - bx0, by1 - by0, 0.38))
    box(out["teak"], Vector(((bx0 + bx1) / 2 + 0.02, (by0 + by1) / 2, 0.4)), (bx1 - bx0 + 0.04, by1 - by0, 0.04))
    box(out["canvas"], Vector(((bx0 + bx1) / 2 + 0.03, (by0 + by1) / 2, 0.47)), (0.44, by1 - by0 - 0.06, 0.1))
    for k, y in enumerate((5.32, 5.92, 6.52)):
        tilt = Matrix.Rotation(-0.26, 4, "Y") @ Matrix.Rotation(0.05 * (k - 1), 4, "X")
        box(out["canvas"], Vector((-5.07, y, 0.74)), (0.14, 0.52, 0.46), rotation=tilt)
    # Fire bowl on a travertine drum.
    fx, fy = -3.95, 6.1
    lathe(out["travertine"], [(0.3, 0.0), (0.31, 0.02), (0.31, 0.3), (0.01, 0.3)], (fx, fy, 0.0), segments=32)
    lathe(out["copper"], [(0.16, 0.3), (0.3, 0.33), (0.4, 0.4), (0.43, 0.43), (0.42, 0.44), (0.38, 0.41), (0.22, 0.36), (0.01, 0.35)], (fx, fy, 0.0), segments=40)
    rng = random.Random(7)
    for k in range(4):
        a = k * math.pi / 2 + rng.uniform(-0.3, 0.3)
        p0 = Vector((fx + 0.17 * math.cos(a), fy + 0.17 * math.sin(a), 0.385))
        p1 = Vector((fx - 0.08 * math.cos(a), fy - 0.08 * math.sin(a), 0.43))
        cylinder(out["charred"], tuple(p0), tuple(p1), 0.034, segments=8)
    embers = bmesh.new()
    bmesh.ops.create_circle(embers, cap_ends=True, segments=24, radius=0.27, matrix=Matrix.Translation((fx, fy, 0.372)))
    # Two loungers facing the sea, a little table between them.
    for cx in (-0.1, 1.0):
        y0, y1 = 4.82, 6.62
        for dx in (-0.31, 0.31):
            box(out["teak"], Vector((cx + dx, (y0 + y1) / 2, 0.27)), (0.05, y1 - y0, 0.07))
            for y in (y0 + 0.08, y1 - 0.08):
                box(out["teak"], Vector((cx + dx, y, 0.12)), (0.05, 0.05, 0.24))
        for k in range(9):
            y = y0 + 0.62 + k * (y1 - y0 - 0.66) / 8
            box(out["teak"], Vector((cx, y, 0.3)), (0.62, 0.07, 0.025))
        rest = Matrix.Rotation(-0.62, 4, "X")
        pivot = Vector((cx, y0 + 0.62, 0.31))
        box(out["teak"], pivot + rest.to_3x3() @ Vector((0, -0.34, 0.0)), (0.62, 0.7, 0.03), rotation=rest)
        box(out["canvas"], Vector((cx, (y0 + 0.62 + y1) / 2, 0.345)), (0.58, y1 - y0 - 0.66, 0.06))
        box(out["canvas"], pivot + rest.to_3x3() @ Vector((0, -0.33, 0.045)), (0.58, 0.66, 0.06), rotation=rest)
    lathe(out["teak"], [(0.05, 0.0), (0.05, 0.38), (0.19, 0.38), (0.19, 0.41), (0.01, 0.41)], (0.45, 5.2, 0.0), segments=28)
    # Bistro table and two chairs outside the kitchen door.
    tx, ty = -2.35, 5.55
    lathe(out["bronze"], [(0.2, 0.0), (0.2, 0.02), (0.03, 0.04), (0.03, 0.71), (0.12, 0.72), (0.01, 0.72)], (tx, ty, 0.0), segments=24)
    lathe(out["travertine"], [(0.34, 0.72), (0.34, 0.75), (0.01, 0.75)], (tx, ty, 0.0), segments=36)
    for side in (-1, 1):
        cx = tx + side * 0.6
        for dx in (-0.2, 0.2):
            for dy in (-0.2, 0.2):
                cylinder(out["bronze"], (cx + dx, ty + dy, 0.0), (cx + dx * 0.9, ty + dy * 0.9, 0.44), 0.012, segments=8)
        box(out["teak"], Vector((cx, ty, 0.455)), (0.42, 0.42, 0.03))
        bx = cx + side * 0.21
        for dy in (-0.19, 0.19):
            cylinder(out["bronze"], (bx, ty + dy, 0.44), (bx + side * 0.04, ty + dy, 0.86), 0.012, segments=8)
        box(out["teak"], Vector((bx + side * 0.035, ty, 0.74)), (0.025, 0.42, 0.2), rotation=Matrix.Rotation(-side * 0.1, 4, "Y"))
    # Planters: an olive tree at the north end, rosemary by the bench.
    olive(out, (4.3, 5.06), rng)
    for px, py in ((-4.45, 7.0), (-3.2, 6.98)):
        lathe(out["terracotta"], [(0.17, 0.0), (0.2, 0.02), (0.24, 0.34), (0.26, 0.36), (0.25, 0.37), (0.22, 0.34), (0.01, 0.3)], (px, py, 0.0), segments=28)
        shrub(out["rosemary"], (px, py, 0.32), rng, 0.3)
    objects = []
    for key, bm in out.items():
        if len(bm.verts):
            objects.append(from_bmesh(f"core_terrace_{key}", bm, mats[key], smooth=key in ("canvas", "copper", "terracotta", "travertine", "bark")))
        else:
            bm.free()
    objects.append(from_bmesh("core_terrace_fire_embers", embers, mats["embers"], smooth=True))
    return objects


def olive(out, at, rng):
    """A potted olive: one leaning, twisting trunk that forks into six branches under a rounded
    crown, kept clear of the glass behind it."""
    x, y = at
    lathe(out["terracotta"], [(0.24, 0.0), (0.28, 0.03), (0.34, 0.5), (0.37, 0.53), (0.36, 0.55), (0.32, 0.52), (0.01, 0.46)], (x, y, 0.0), segments=32)
    base = Vector((x, y, 0.46))
    knee = base + Vector((0.07, 0.03, 0.42))
    fork = knee + Vector((-0.06, 0.04, 0.4))
    cylinder(out["bark"], tuple(base), tuple(knee), 0.052, segments=10)
    cylinder(out["bark"], tuple(knee), tuple(fork), 0.044, segments=10)
    bmesh.ops.create_uvsphere(out["bark"], u_segments=10, v_segments=6, radius=0.05, matrix=Matrix.Translation(knee))
    for k in range(6):
        a = k * math.tau / 6 + rng.uniform(-0.3, 0.3)
        reach = 0.26 if math.sin(a) < 0 else 0.34  # shorter toward the glass (-Y)
        tip = fork + Vector((reach * math.cos(a), reach * math.sin(a), rng.uniform(0.18, 0.42)))
        cylinder(out["bark"], tuple(fork), tuple(tip), 0.018, segments=8)
        # Twigs fan out from each branch tip and carry the leaves in tufts at both ends, so every
        # leaf is rooted on wood: the browser's sea breeze bends leaves about their stems.
        for t in range(9):
            heading = rng.uniform(0, math.tau)
            end = tip + Vector((0.17 * math.cos(heading), 0.17 * math.sin(heading), rng.uniform(-0.05, 0.12)))
            end.y = max(end.y, y - 0.38)
            cylinder(out["bark"], tuple(tip), tuple(end), 0.005, segments=5)
            for anchor, count in ((end, 4), (tip.lerp(end, 0.08), 2)):
                for _ in range(count):
                    leaf_quad(out["leaf"], anchor, rng, 0.08, 0.016, base=True)


def shrub(bm, at, rng, size):
    x, y, z = at
    for _ in range(46):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(0, size * 0.5)
        stem = Vector((x + r * math.cos(a), y + r * math.sin(a), z))
        top = stem + Vector((rng.gauss(0, 0.04), rng.gauss(0, 0.04), rng.uniform(0.18, 0.36)))
        for t in (0.35, 0.6, 0.85):
            leaf_quad(bm, stem.lerp(top, t), rng, 0.05, 0.01)


def leaf_quad(bm, center, rng, length, width, base=False):
    """A narrow lanceolate leaf as a bent diamond (two triangles), any orientation. With base=True
    the leaf's stalk end sits at `center` (on a twig) and the blade points away from it."""
    d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.4, 1))).normalized()
    side = d.cross(Vector((0, 0, 1)))
    side = (side if side.length > 1e-3 else Vector((1, 0, 0))).normalized()
    up = side.cross(d).normalized()
    if base:
        center = center + d * length / 2
    a = bm.verts.new(center - d * length / 2)
    b = bm.verts.new(center + side * width + up * width * 0.4)
    c = bm.verts.new(center + d * length / 2)
    e = bm.verts.new(center - side * width + up * width * 0.4)
    bm.faces.new((a, b, c))
    bm.faces.new((a, c, e))


# Alcove screens ----------------------------------------------------------------------------------

def screens(cedar):
    """Full-height cedar slats beside the study: they close the bedroom and onsen into alcoves
    while still letting light and glimpses through (a half-open wall)."""
    bm = bmesh.new()
    slat, gap, depth = 0.045, 0.024, 0.03
    for key, (x, y0, y1) in SCREENS.items():
        lo, hi = min(y0, y1), max(y0, y1)
        for z0, z1, a, b in ((UPPER_FLOOR, SCREEN_TOP, max(lo, EAST_WALL_END) if key == "east" else lo, hi),
                             (EAST_WALL_TOP, SCREEN_TOP, lo, EAST_WALL_END) if key == "east" else (0, 0, 0, 0)):
            if z1 <= z0:
                continue
            for z in (z0 + 0.05, z1 - 0.04):
                box(bm, Vector((x, (a + b) / 2, z)), (depth + 0.012, b - a, 0.05))
            yy = a
            while yy + slat <= b + 1e-6:
                box(bm, Vector((x, yy + slat / 2, (z0 + z1) / 2)), (depth, slat, z1 - z0))
                yy += slat + gap
    return from_bmesh("core_alcove_screens", bm, cedar, smooth=False)
