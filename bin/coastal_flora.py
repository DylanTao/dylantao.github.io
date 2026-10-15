"""The clifftop's planting, rebuilt for close inspection (Sirui, 2026-10-14).

The first clifftop shrubs were four ellipsoid crowns on sticks over flat green discs; from a
walking distance they read as toy trees. This replaces them with:
  coastal sage scrub, low mounds of narrow grey-green and dark green leaves on woody stems, with
  rusty buckwheat flower heads on some;
  four Torrey pines (Pinus torreyana, the tree of La Jolla's cliffs): leaning, twisting trunks
  that fork into a few limbs, with long needles in bottle-brush tufts at the limb ends;
  dry grass tufts in the open ground between, kept off the rabbits' paths.
Every leaf, needle and blade carries a sway weight in its UV x (0 at the plant's base, 1 at its
top), which the browser uses to bend it in the sea breeze. Nothing is placed over the house or
near the light well, where the cutaway lifts the roof. Coordinates are Blender's (+X north, +Y
west toward the sea, Z up).
"""

import math
import random
import bmesh
from mathutils import Matrix, Vector, noise

from coastal_decor import from_bmesh
from coastal_landscape import shoreline

HOUSE = {"x": 6.3, "y": -6.0}  # skip |x| < 6.3 and y > -6.0: the roof the cutaway lifts
SHRUB_CENTRES = [(-10, -3), (9, -2), (-2, -9), (15, 2), (24, 4), (-18, 2), (4, -9)]
ICEPLANT = [(-10, -3, 4.2, 2.1), (9, -3, 3.8, 1.9), (-2, -9, 5, 2.2), (20, 2, 5.3, 2.2), (-18, 1, 3.7, 2.3)]  # the old groundcover patches
PINES = [(-13.2, 4.0, 5.6, 0.2), (-7.6, 4.5, 4.6, -0.3), (11.6, 4.0, 5.2, 0.5), (19.2, 5.0, 6.0, 0.1)]  # x, metres inland of the edge, height, lean bias


class Sway:
    """Collects geometry for one material with a per-vertex sway weight."""

    def __init__(self):
        self.bm = bmesh.new()
        self.weight = self.bm.verts.layers.float.new("sway")

    def vert(self, co, w):
        v = self.bm.verts.new(co)
        v[self.weight] = max(0.0, min(1.0, w))
        return v

    def face(self, verts):
        return self.bm.faces.new(verts)

    def finish(self, name, mat):
        uv = self.bm.loops.layers.uv.new("UVMap")
        for f in self.bm.faces:
            for loop in f.loops:
                loop[uv].uv = (loop.vert[self.weight], 0.5)
        return from_bmesh(name, self.bm, mat)


def tube(target, points, radii, base, height, segments=6, weights=None):
    """A tapered tube through points; each ring's sway follows its height above the plant base,
    or weights[i] when given (a palm frond's spine sways from its base out to its tip)."""
    rings = []
    for i, (p, r) in enumerate(zip(points, radii)):
        a = Vector(points[max(0, i - 1)])
        b = Vector(points[min(len(points) - 1, i + 1)])
        axis = (b - a).normalized()
        side = axis.cross(Vector((0, 0, 1)))
        side = (side if side.length > 1e-4 else Vector((1, 0, 0))).normalized()
        up = side.cross(axis).normalized()
        w = weights[i] if weights else (Vector(p).z - base) / height
        rings.append([target.vert(Vector(p) + (side * math.cos(t) + up * math.sin(t)) * r, w) for t in (k * math.tau / segments for k in range(segments))])
    for lower, upper in zip(rings, rings[1:]):
        for k in range(segments):
            target.face((lower[k], lower[(k + 1) % segments], upper[(k + 1) % segments], upper[k]))
    target.face(list(reversed(rings[0])))
    target.face(rings[-1])


def blade(target, root, direction, length, width, base, height, bend=0.25, weights=None):
    """A leaf, needle or grass blade: a tapered strip of two quads with a slight droop. Its sway
    weight follows height above the plant's base, or runs from weights[0] at the root to
    weights[1] at the tip (a palm leaflet sways with its frond, not with its height)."""
    d = Vector(direction).normalized()
    side = d.cross(Vector((0, 0, 1)))
    side = (side if side.length > 1e-4 else Vector((1, 0, 0))).normalized()
    mid = root + d * length * 0.5 + Vector((0, 0, -bend * length * 0.15))
    tip = root + d * length + Vector((0, 0, -bend * length * 0.45))
    if weights:
        w0, w1 = weights
        w = lambda p: w0 + (w1 - w0) * min(1.0, (p - root).length / length)
    else:
        w = lambda p: (p.z - base) / height
    a, b = target.vert(root - side * width * 0.3, w(root)), target.vert(root + side * width * 0.3, w(root))
    c, e = target.vert(mid + side * width * 0.5, w(mid)), target.vert(mid - side * width * 0.5, w(mid))
    t = target.vert(tip, w(tip))
    target.face((a, b, c, e))
    target.face((e, c, t))


def clear_of(paths, x, y, distance):
    for path in paths:
        for (ax, ay), (bx, by) in zip(path, path[1:]):
            dx, dy = bx - ax, by - ay
            t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / max(dx * dx + dy * dy, 1e-9)))
            if math.hypot(x - ax - t * dx, y - ay - t * dy) < distance:
                return False
    return True


def allowed(x, y, avoid):
    if abs(x) < HOUSE["x"] and y > HOUSE["y"]:
        return False
    return all(math.hypot(x - ax, y - ay) > r for ax, ay, r in avoid)


def shrub(leaves, stems, flowers, x, y, ground, size, rng, flowering):
    """A sage-scrub mound: woody stems fanning from the base to a dome of narrow leaves."""
    base = ground
    radius, height = size * 0.62, size * (0.75 + rng.uniform(-0.12, 0.12))
    tips = []
    for k in range(5):
        a = k * 2.39996 + rng.uniform(0, 0.4)
        r = radius * rng.uniform(0.35, 0.85)
        tip = Vector((x + r * math.cos(a), y + r * math.sin(a), base + height * rng.uniform(0.55, 0.9)))
        knee = Vector((x, y, base)).lerp(tip, 0.45) + Vector((0, 0, height * 0.08))
        tube(stems, [(x, y, base - 0.02), tuple(knee), tuple(tip)], [0.012, 0.008, 0.004], base, height, segments=4)
        tips.append(tip)
    for _ in range(int(95 * size / 0.6)):
        # Sprigs on the upper half of an ellipsoid shell, a little inside it: each card stands for a
        # spray of the plant's narrow leaves, so the mound reads as one soft, dense mass.
        a = rng.uniform(0, math.tau)
        u = rng.uniform(0.05, 1.0)
        shell = rng.uniform(0.72, 1.0)
        p = Vector((x + radius * shell * math.sqrt(1 - u * u) * math.cos(a), y + radius * shell * math.sqrt(1 - u * u) * math.sin(a), base + height * shell * u))
        p.z += 0.05 * noise.noise(p * 3.0)
        outward = (p - Vector((x, y, base))).normalized()
        direction = (outward + Vector((rng.gauss(0, 0.5), rng.gauss(0, 0.5), rng.gauss(0.3, 0.4)))).normalized()
        blade(leaves, p - direction * 0.04, direction, rng.uniform(0.12, 0.2), 0.05, base, height, bend=0.2)
    if flowering:
        for tip in tips[:4]:
            for k in range(5):
                head = tip + Vector((rng.gauss(0, 0.03), rng.gauss(0, 0.03), 0.04 + rng.uniform(0, 0.04)))
                for turn in (0.0, math.pi / 2):
                    d = Vector((math.cos(turn + k), math.sin(turn + k), 0.15))
                    blade(flowers, head - d * 0.018, d, 0.036, 0.03, base, height, bend=0.0)


def torrey_pine(bark, needles, x, y, ground, height, lean_bias, rng):
    """A Torrey pine shaped by the onshore wind: a trunk leaning inland and twisting, forking into
    limbs that end in tufts of long needles; the crown is broad and flat-topped."""
    lean = Vector((rng.uniform(-0.12, 0.12) + lean_bias * 0.2, -0.22, 1.0)).normalized()  # leans away from the sea (-Y)
    points, radii = [], []
    p = Vector((x, y, ground - 0.15))
    for k in range(7):
        t = k / 6
        points.append(tuple(p))
        radii.append(0.2 * (1 - 0.6 * t) + 0.02)
        twist = Vector((0.18 * math.sin(k * 1.7 + x), 0.12 * math.cos(k * 1.3 + y), 0))
        p = p + (lean + twist).normalized() * (height * 0.62 / 6)
    tube(bark, points, radii, ground, height, segments=9)
    fork = Vector(points[-1])
    for limb in range(7):
        # Limbs leave the trunk from 45 % of its height upward and spread wide: a broad,
        # irregular, flat-topped crown rather than an umbrella on a pole.
        start = Vector(points[3 + limb % 4])
        a = limb * 2.39996 + rng.uniform(-0.3, 0.3)
        reach = height * rng.uniform(0.3, 0.44)
        end = start + Vector((reach * math.cos(a), reach * math.sin(a) - 0.2 * reach, height * rng.uniform(0.12, 0.28)))
        knee = start.lerp(end, 0.5) + Vector((0, 0, height * 0.05))
        tube(bark, [tuple(start), tuple(knee), tuple(end)], [0.08, 0.05, 0.025], ground, height, segments=6)
        for twig in range(6):
            b = rng.uniform(0, math.tau)
            root = knee.lerp(end, rng.uniform(0.2, 1.0))
            tuft = root + Vector((0.5 * math.cos(b), 0.5 * math.sin(b), rng.uniform(-0.1, 0.2)))
            tube(bark, [tuple(root), tuple(tuft)], [0.02, 0.009], ground, height, segments=4)
            for tuft_point in (tuft, root.lerp(tuft, 0.66), root.lerp(tuft, 0.33)):
                # A bottle-brush of long needles, splayed up and out; wide enough cards that the
                # crown reads as dark foliage from the beach, not as bare sticks.
                for n in range(32):
                    d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.uniform(0.0, 1.2))).normalized()
                    blade(needles, tuft_point + d * 0.03, d, rng.uniform(0.18, 0.28), 0.024, ground, height, bend=0.35)


def iceplant(leaves, flowers, cx, cy, rx, ry, ground_at, rng, avoid, paths, max_drop=None):
    """A mat of sea fig (iceplant), the succulent that carpets La Jolla's bluffs: fleshy finger
    leaves lying low and curling up at the tips, with magenta flowers here and there. With
    max_drop, ground more than that far below the mat's centre is left bare, so a mat near the
    rim never stretches over a drop."""
    centre = ground_at(cx, cy) if max_drop is not None else None
    too_low = lambda ground: centre is not None and ground < centre - max_drop
    # The carpet: a low, lumpy mat with a ragged edge, so the patch reads as green from the beach;
    # the leaf cards on top give it texture up close.
    rings, steps = 9, 48
    grid = []
    for ring in range(rings + 1):
        row = []
        for j in range(steps):
            a = j / steps * math.tau
            edge = 1 + 0.18 * math.sin(a * 5 + cx) + 0.09 * math.cos(a * 9 + cy)
            r = ring / rings * edge
            x, y = cx + rx * r * math.cos(a), cy + ry * r * math.sin(a)
            ground = ground_at(x, y)
            if ground is None or not allowed(x, y, avoid) or too_low(ground):
                row.append(None)
                continue
            lift = 0.012 + 0.05 * (1 - (ring / rings) ** 3) * (0.6 + 0.4 * noise.noise(Vector((x * 1.7, y * 1.7, 0.4))))
            row.append(leaves.vert(Vector((x, y, ground + lift)), 0.0))
        grid.append(row)
    for ring in range(rings):
        for j in range(steps):
            # Counter-clockwise from above, so the mat's normals face the sky: shadow offsets
            # and contact shading read the stored normal, and a downward one darkened every mat.
            quad = (grid[ring][j], grid[ring + 1][j], grid[ring + 1][(j + 1) % steps], grid[ring][(j + 1) % steps])
            if all(quad) and len(set(quad)) == 4:
                leaves.face(quad)
    count = 0
    for _ in range(int(math.pi * rx * ry * 26)):
        a, r = rng.uniform(0, math.tau), math.sqrt(rng.random())
        edge = 1 + 0.18 * math.sin(a * 5 + cx) + 0.09 * math.cos(a * 9 + cy)
        x, y = cx + rx * r * edge * math.cos(a), cy + ry * r * edge * math.sin(a)
        if not allowed(x, y, avoid):
            continue
        ground = ground_at(x, y)
        if ground is None or too_low(ground):
            continue
        heading = rng.uniform(0, math.tau)
        d = Vector((math.cos(heading), math.sin(heading), rng.uniform(0.1, 0.55))).normalized()
        blade(leaves, Vector((x, y, ground + 0.01)), d, rng.uniform(0.07, 0.11), 0.026, ground, 0.12, bend=-0.6)
        count += 1
        if rng.random() < 0.035:
            head = Vector((x, y, ground + 0.06))
            for k in range(4):
                t = k * math.pi / 4
                blade(flowers, head - Vector((math.cos(t), math.sin(t), 0)) * 0.025, Vector((math.cos(t), math.sin(t), 0.25)), 0.05, 0.022, ground, 0.12, bend=0.0)
    return count


def grass(blades, x, y, ground, rng):
    for _ in range(rng.randint(4, 7)):
        a = rng.uniform(0, math.tau)
        d = Vector((0.35 * math.cos(a), 0.35 * math.sin(a), 1.0)).normalized()
        root = Vector((x + rng.gauss(0, 0.03), y + rng.gauss(0, 0.03), ground - 0.01))
        blade(blades, root, d, rng.uniform(0.14, 0.34), 0.012, ground, 0.34, bend=0.5)


# The second planting (Sirui, 2026-10-15: "one type feels boring"), drawn from photographs of the
# real bluffs: Torrey Pines State Natural Reserve's bluff tops, and the Coast Walk and Goldfish
# Point above La Jolla's sea caves (artwork/coastal-home/PROVENANCE.md lists them). In October the
# bluffs are a silver-grey matrix of California sagebrush and golden grass, broken by dark, dense
# lemonade berry, prickly pear and yucca on the rim, iceplant turning red at the edge, drifts of
# small white daisies along the walks, and the odd Canary Island palm planted by a house.
ENTRY = (-0.5, -10.1, 1.9)  # the clifftop doorway's stone box, and the stepping stones inland
STEPS = [(-0.5, -10.6), (-0.4, -12.0), (0.1, -13.6), (0.5, -15.3), (0.6, -17.0), (0.4, -18.7), (0.0, -20.5), (-0.2, -21.5)]
RED_ICEPLANT = [(-25.0, 2.4, 3.2, 1.6), (13.5, 2.0, 3.0, 1.5), (28.0, 2.6, 3.6, 1.8)]  # x, metres inland of the edge, radii
DAISIES = [(-3.0, -10.7, 1.4, 0.8), (1.9, -9.5, 1.0, 0.6), (-1.7, -15.6, 0.8, 1.6), (2.0, -17.6, 0.8, 1.4), (-7.2, -2.3, 1.1, 0.6), (8.6, -7.0, 1.2, 0.7)]
PALM = (2.9, -12.7, 5.4)  # beside the stepping stones, east of the doorway; trunk height


def lens(target, centre, u, v, half_u, half_v, thickness, w, segments=10):
    """A flattened ellipsoid in the plane (u, v): a prickly pear pad, thick in the middle and thin
    at the rim."""
    n = u.cross(v).normalized()
    ring = lambda scale, lift: [target.vert(centre + u * (half_u * scale * math.cos(t)) + v * (half_v * scale * math.sin(t)) + n * lift, w) for t in (k * math.tau / segments for k in range(segments))]
    rim, front, back = ring(1.0, 0.0), ring(0.62, thickness * 0.8), ring(0.62, -thickness * 0.8)
    tips = target.vert(centre + n * thickness, w), target.vert(centre - n * thickness, w)
    for k in range(segments):
        j = (k + 1) % segments
        target.face((rim[k], rim[j], front[j], front[k]))
        target.face((rim[j], rim[k], back[k], back[j]))
        target.face((front[k], front[j], tips[0]))
        target.face((back[j], back[k], tips[1]))


def ellipsoid(target, centre, radius, length, axis, w, segments=6, rings=4):
    """A small closed ellipsoid along axis: a fruit."""
    axis = Vector(axis).normalized()
    side = axis.cross(Vector((0, 0, 1)))
    side = (side if side.length > 1e-4 else Vector((1, 0, 0))).normalized()
    up = side.cross(axis).normalized()
    bottom, top = target.vert(centre - axis * length, w), target.vert(centre + axis * length, w)
    rows = []
    for r in range(1, rings):
        phi = math.pi * r / rings
        rows.append([target.vert(centre - axis * length * math.cos(phi) + (side * math.cos(t) + up * math.sin(t)) * radius * math.sin(phi), w) for t in (k * math.tau / segments for k in range(segments))])
    for k in range(segments):
        j = (k + 1) % segments
        target.face((bottom, rows[0][j], rows[0][k]))
        target.face((top, rows[-1][k], rows[-1][j]))
        for lower, upper in zip(rows, rows[1:]):
            target.face((lower[k], lower[j], upper[j], upper[k]))


def sagebrush(leaves, stems, x, y, ground, size, rng):
    """California sagebrush (Artemisia californica), the silver-grey matrix of the bluffs: a loose,
    airy shrub of many slender stems with thread-fine leaves along their upper halves."""
    height, spread = size * rng.uniform(0.85, 1.1), size * 0.55
    for _ in range(rng.randint(9, 13)):
        a, r = rng.uniform(0, math.tau), spread * rng.uniform(0.2, 1.0)
        tip = Vector((x + r * math.cos(a), y + r * math.sin(a), ground + height * rng.uniform(0.6, 1.0)))
        mid = Vector((x, y, ground)).lerp(tip, 0.5) + Vector((rng.gauss(0, 0.04), rng.gauss(0, 0.04), 0))
        tube(stems, [(x + rng.gauss(0, 0.03), y + rng.gauss(0, 0.03), ground - 0.02), tuple(mid), tuple(tip)], [0.008, 0.005, 0.002], ground, height, segments=3)
        rise = (tip - mid).normalized()
        for _ in range(11):
            d = rise * 0.6 + Vector((rng.gauss(0, 0.5), rng.gauss(0, 0.5), rng.gauss(0.2, 0.3)))
            blade(leaves, mid.lerp(tip, rng.random()), d.normalized(), rng.uniform(0.08, 0.15), 0.022, ground, height, bend=0.3)


def lemonade_berry(leaves, shade, stems, fruit, x, y, ground, size, rng):
    """Lemonade berry (Rhus integrifolia): a dense, rounded evergreen of leathery oval leaves, far
    darker and larger than the sage around it, with a few clusters of flat red berries in autumn.
    A solid inner dome in a deeper shade keeps the gaps between leaf cards dark rather than
    see-through, and lets the lighter leaves read as texture."""
    radius, height = size * rng.uniform(0.7, 0.85), size * rng.uniform(0.55, 0.75)
    for k in range(7):
        a = k * 2.39996 + rng.uniform(0, 0.5)
        tip = Vector((x + radius * 0.5 * math.cos(a), y + radius * 0.5 * math.sin(a), ground + height * rng.uniform(0.4, 0.6)))
        knee = Vector((x, y, ground)).lerp(tip, 0.5) + Vector((0, 0, height * 0.1))
        tube(stems, [(x, y, ground - 0.03), tuple(knee), tuple(tip)], [0.03, 0.02, 0.008], ground, height, segments=5)
    centre = Vector((x, y, ground - height * 0.05))
    seed = Vector((x * 0.37, y * 0.29, size * 3.1))

    def lump(offset):
        # Real shrubs are lumpy and lopsided, not domes: push each direction in or out.
        return centre + offset * (1.0 + 0.24 * noise.noise(offset.normalized() * 1.7 + seed))

    rows = []
    for r in range(5):
        u = r / 4
        rows.append([shade.vert(lump(Vector((radius * 0.72 * math.sqrt(1 - u * u) * math.cos(t), radius * 0.72 * math.sqrt(1 - u * u) * math.sin(t), height * 0.78 * u))), 0.0) for t in (k * math.tau / 14 for k in range(14))])
    for lower, upper in zip(rows, rows[1:]):
        for k in range(14):
            shade.face((lower[k], lower[(k + 1) % 14], upper[(k + 1) % 14], upper[k]))
    for _ in range(int(210 * size * size)):
        a, u, shell = rng.uniform(0, math.tau), rng.uniform(0.0, 1.0), rng.uniform(0.84, 1.06)
        p = lump(Vector((radius * shell * math.sqrt(1 - u * u) * math.cos(a), radius * shell * math.sqrt(1 - u * u) * math.sin(a), height * shell * u + height * 0.05)))
        outward = (p - Vector((x, y, ground + height * 0.2))).normalized()
        d = (outward + Vector((rng.gauss(0, 0.6), rng.gauss(0, 0.6), rng.gauss(0.2, 0.4)))).normalized()
        blade(leaves, p - d * 0.025, d, rng.uniform(0.09, 0.12), 0.06, ground, height, bend=0.1)
    for _ in range(rng.randint(2, 5)):
        a, u = rng.uniform(0, math.tau), rng.uniform(0.3, 0.9)
        cluster = Vector((x + radius * math.sqrt(1 - u * u) * math.cos(a), y + radius * math.sqrt(1 - u * u) * math.sin(a), ground + height * u + 0.03))
        for _ in range(5):
            ellipsoid(fruit, cluster + Vector((rng.gauss(0, 0.025), rng.gauss(0, 0.025), rng.gauss(0, 0.015))), 0.012, 0.009, (0, 0, 1), 0.0, segments=5, rings=3)


def prickly_pear(pads, fruit, x, y, ground, rng):
    """Coast prickly pear (Opuntia littoralis): a clump of flat oval pads, the oldest standing on
    the ground and younger ones rising from their rims, with red-purple fruit on top in autumn."""
    queue = []
    for _ in range(rng.randint(3, 5)):
        a = rng.uniform(0, math.tau)
        queue.append((Vector((x + 0.22 * math.cos(a), y + 0.22 * math.sin(a), ground - 0.04)), a, 0))
    count = 0
    while queue and count < 15:
        root, heading, depth = queue.pop(0)
        half_v = rng.uniform(0.13, 0.19) * (1 - 0.12 * depth)
        half_u = half_v * rng.uniform(0.6, 0.78)
        tilt = rng.uniform(-0.5, 0.5)
        up = Vector((math.cos(heading) * math.sin(tilt), math.sin(heading) * math.sin(tilt), math.cos(tilt))).normalized()
        u = Vector((-math.sin(heading), math.cos(heading), 0))
        centre = root + up * half_v
        lens(pads, centre, u, up, half_u, half_v, 0.028, 0.0)
        count += 1
        if depth < 2:
            for _ in range(rng.choice((0, 1, 1, 2))):
                t = rng.uniform(-0.9, 0.9)
                rim = centre + up * half_v * math.cos(t) + u * half_u * math.sin(t)
                queue.append((rim - up * 0.02, heading + rng.uniform(-0.7, 0.7), depth + 1))
        if rng.random() < 0.35:
            for _ in range(rng.randint(1, 3)):
                t = rng.uniform(-0.8, 0.8)
                tip = centre + up * half_v * math.cos(t) + u * half_u * math.sin(t)
                ellipsoid(fruit, tip + up * 0.025, 0.02, 0.03, up, 0.0)


def yucca(leaves, skirt, x, y, ground, rng):
    """Mojave yucca (Yucca schidigera), as on the Torrey Pines bluffs: one to three short trunks
    in a skirt of dead leaves, each topped by a dense rosette of stiff, dagger-like blades."""
    for _ in range(rng.choice((1, 1, 2, 3))):
        height = rng.uniform(0.35, 1.25)
        lean = Vector((rng.gauss(0, 0.15), rng.gauss(0, 0.15), 1.0)).normalized()
        foot = Vector((x + rng.gauss(0, 0.2), y + rng.gauss(0, 0.2), ground - 0.05))
        top = foot + lean * height
        tube(skirt, [tuple(foot), tuple(foot.lerp(top, 0.5)), tuple(top)], [0.12, 0.11, 0.1], ground, height + 0.6, segments=7)
        for _ in range(14):
            a = rng.uniform(0, math.tau)
            root = foot.lerp(top, rng.uniform(0.4, 0.95)) + Vector((0.1 * math.cos(a), 0.1 * math.sin(a), 0))
            blade(skirt, root, Vector((0.35 * math.cos(a), 0.35 * math.sin(a), -1.0)), rng.uniform(0.25, 0.4), 0.03, ground, height + 0.6, bend=0.0)
        for k in range(46):
            a = k * 2.39996 + rng.uniform(-0.2, 0.2)
            d = Vector((math.cos(a), math.sin(a), rng.uniform(0.15, 1.6))).normalized()
            blade(leaves, top + d * 0.04, d, rng.uniform(0.45, 0.7), 0.04, ground, height + 0.6, bend=0.05)


def wild_oats(blades, x, y, ground, rng):
    """A tussock of wild oats gone to seed: many golden stalks, each bending under a drooping
    spikelet near its tip."""
    for _ in range(rng.randint(9, 13)):
        a = rng.uniform(0, math.tau)
        d = Vector((0.3 * math.cos(a), 0.3 * math.sin(a), 1.0)).normalized()
        root = Vector((x + rng.gauss(0, 0.04), y + rng.gauss(0, 0.04), ground - 0.01))
        length = rng.uniform(0.3, 0.55)
        blade(blades, root, d, length, 0.016, ground, 0.6, bend=0.4)
        node = root + d * length * 0.85 + Vector((0, 0, -0.1 * length))
        b = a + rng.uniform(-0.8, 0.8)
        blade(blades, node, Vector((0.7 * math.cos(b), 0.7 * math.sin(b), -1.0)), 0.04, 0.018, ground, 0.6, bend=0.0)


def daisy_drift(leaves, flowers, cx, cy, rx, ry, ground_at, rng, avoid, paths):
    """A drift of Santa Barbara daisies (Erigeron karvinskianus), naturalised along La Jolla's
    Coast Walk and over the caves at Goldfish Point: a low mound of fine leaves dotted white."""
    for _ in range(int(math.pi * rx * ry * 22)):
        a, r = rng.uniform(0, math.tau), math.sqrt(rng.random())
        x, y = cx + rx * r * math.cos(a), cy + ry * r * math.sin(a)
        if not allowed(x, y, avoid) or not clear_of(paths, x, y, 0.3):
            continue
        ground = ground_at(x, y)
        if ground is None:
            continue
        height = 0.2 * (1 - r * r) + 0.05
        for _ in range(3):
            d = Vector((rng.gauss(0, 0.6), rng.gauss(0, 0.6), 1.0)).normalized()
            blade(leaves, Vector((x, y, ground)), d, height * rng.uniform(0.6, 1.1), 0.03, ground, 0.25, bend=0.3)
        if rng.random() < 0.9:
            head = Vector((x + rng.gauss(0, 0.02), y + rng.gauss(0, 0.02), ground + height + 0.01))
            for k in range(5):
                t = k * math.tau / 5 + rng.uniform(0, 0.3)
                blade(flowers, head, Vector((math.cos(t), math.sin(t), 0.35)), 0.034, 0.02, ground, 0.25, bend=0.0)


def canary_palm(trunk, fronds, x, y, ground, height, rng):
    """A Canary Island date palm, as planted along the Coast Walk and above the caves: a thick,
    straight trunk ringed by old leaf bases, and a dense round crown of long, arching feather
    fronds, trimmed of dead ones as La Jolla's are. Each frond sways from its base to its tip."""
    rings = 26
    points = [(x, y, ground - 0.2 + (height + 0.2) * k / (rings - 1)) for k in range(rings)]
    radii = [(0.4 - 0.06 * k / rings + (0.04 if k % 2 else 0.0)) * (1.25 if k == rings - 1 else 1.0) for k in range(rings)]
    tube(trunk, points, radii, ground, height, segments=12)
    crown = Vector((x, y, ground + height))
    for k in range(64):
        a = k * 2.39996 + rng.uniform(-0.1, 0.1)
        tier = k / 64
        elevation = 1.05 - 1.25 * tier + rng.uniform(-0.12, 0.12)
        length = rng.uniform(2.5, 3.2) * (0.85 if tier < 0.15 else 1.0)
        collector, droop = fronds, 0.55
        start = crown + Vector((0.32 * math.cos(a), 0.32 * math.sin(a), 0.12 - 0.25 * tier))
        out = Vector((math.cos(a), math.sin(a), 0))
        steps = 9
        fractions = [j / steps for j in range(steps + 1)]
        spine = [start + out * (length * t * math.cos(elevation)) + Vector((0, 0, length * t * math.sin(elevation) - droop * length * t * t * 0.45)) for t in fractions]
        tube(collector, [tuple(p) for p in spine], [0.035 * (1 - 0.8 * t) + 0.005 for t in fractions], 0, 1, segments=3, weights=fractions)
        lift = 0.35
        for j in range(2, 38):
            t = j / 38
            i = min(steps - 1, int(t * steps))
            p = spine[i].lerp(spine[i + 1], t * steps - i)
            along = (spine[i + 1] - spine[i]).normalized()
            side = along.cross(Vector((0, 0, 1)))
            side = (side if side.length > 1e-4 else Vector((1, 0, 0))).normalized()
            leaflet = (0.52 - 0.34 * t) * (0.6 if j < 7 else 1.0)
            for s in (-1, 1):
                d = (side * s + along * 0.45 + Vector((0, 0, lift))).normalized()
                blade(collector, p, d, leaflet, 0.045, 0, 1, bend=0.25, weights=(t, min(1.0, t + 0.08)))


def understory(parts, ground_at, paths, avoid, occupied, rng):
    """The second planting: each species by its distance from the cliff edge, clear of the doorway,
    the stepping stones, the rabbits' paths, the perches and every plant already standing."""
    counts = {"palms": 0, "lemonadeBerries": 0, "yuccas": 0, "pricklyPears": 0, "redIceplantLeaves": 0, "sagebrush": 0, "daisyDrifts": 0, "oatTufts": 0}
    walks = paths + [STEPS]
    keep = avoid + [ENTRY]

    def open_ground(x, y, radius, path_gap):
        if not allowed(x, y, keep) or not clear_of(walks, x, y, path_gap):
            return None
        if any(math.hypot(x - ox, y - oy) < radius + r for ox, oy, r in occupied):
            return None
        return ground_at(x, y)

    def spot(inland, radius, path_gap, tries=60):
        for _ in range(tries):
            x = rng.uniform(-28, 32)
            y = shoreline(x) - rng.uniform(*inland)
            ground = open_ground(x, y, radius, path_gap)
            if ground is not None:
                return x, y, ground
        return None

    x, y, height = PALM
    ground = open_ground(x, y, 0.5, 0.6)
    if ground is not None:
        canary_palm(parts["palmTrunk"], parts["palm"], x, y, ground, height, rng)
        occupied.append((x, y, 0.9))
        counts["palms"] += 1
    for _ in range(13):
        size = rng.uniform(1.1, 2.0)
        found = spot((2.5, 16), 0.8 * size, 0.5 + 0.8 * size)
        if found:
            lemonade_berry(parts["berry"], parts["berryShade"], parts["stems"], parts["berryFruit"], *found, size, rng)
            occupied.append((found[0], found[1], 0.8 * size))
            counts["lemonadeBerries"] += 1
    for _ in range(4):
        found = spot((1.8, 9), 0.8, 0.9)
        if found:
            yucca(parts["yucca"], parts["yuccaSkirt"], *found, rng)
            occupied.append((found[0], found[1], 0.8))
            counts["yuccas"] += 1
    for _ in range(9):
        found = spot((1.4, 7), 0.6, 0.8)
        if found:
            prickly_pear(parts["pear"], parts["pearFruit"], *found, rng)
            occupied.append((found[0], found[1], 0.6))
            counts["pricklyPears"] += 1
    for x, inland, rx, ry in RED_ICEPLANT:
        counts["redIceplantLeaves"] += iceplant(parts["redIceplant"], parts["iceFlowers"], x, shoreline(x) - inland, rx, ry, ground_at, rng, keep, walks, max_drop=1.2)
    for _ in range(170):
        x = rng.uniform(-28, 32)
        y = shoreline(x) - rng.uniform(2.0, 22.0)
        size = rng.uniform(0.55, 1.15)
        if noise.noise(Vector((x * 0.21, y * 0.21, 4.2))) < -0.15:
            continue
        ground = open_ground(x, y, 0.45 * size, 0.45)
        if ground is None:
            continue
        sagebrush(parts["silverSage"], parts["stems"], x, y, ground, size, rng)
        occupied.append((x, y, 0.35 * size))
        counts["sagebrush"] += 1
    for cx, cy, rx, ry in DAISIES:
        daisy_drift(parts["daisyLeaves"], parts["daisyFlowers"], cx, cy, rx, ry, ground_at, rng, keep, walks)
        counts["daisyDrifts"] += 1
    for _ in range(520):
        x = rng.uniform(-28, 32)
        y = shoreline(x) - rng.uniform(1.3, 24.0)
        if noise.noise(Vector((x * 0.27, y * 0.27, 7.1))) < -0.1:
            continue
        ground = open_ground(x, y, 0.08, 0.3)
        if ground is None:
            continue
        wild_oats(parts["oats"], x, y, ground, rng)
        counts["oatTufts"] += 1
    return counts


def planting(mats, ground_at, paths, avoid, keep_clear=(), seed=414):
    """Build the clifftop flora; returns {material key: object}. keep_clear lists (x, y, radius)
    footprints of plants that are not flora (the landscape's agaves) for the second planting."""
    rng = random.Random(seed)
    parts = {
        k: Sway()
        for k in (
            "sage", "darkSage", "stems", "flowers", "pine", "needles", "grass", "iceplant", "iceFlowers",
            "silverSage", "berry", "berryShade", "berryFruit", "pear", "pearFruit", "yucca", "yuccaSkirt", "oats",
            "daisyLeaves", "daisyFlowers", "redIceplant", "palmTrunk", "palm",
        )
    }
    counts = {"shrubs": 0, "pines": 0, "grassTufts": 0, "iceplantLeaves": 0}
    occupied = list(keep_clear)
    for cx, cy, rx, ry in ICEPLANT:
        counts["iceplantLeaves"] += iceplant(parts["iceplant"], parts["iceFlowers"], cx, cy, rx, ry, ground_at, rng, avoid, paths)
    for i in range(125):
        cx, cy = SHRUB_CENTRES[i % 7]
        x, y = cx + rng.gauss(0, 2.0), cy + rng.gauss(0, 1.25)
        y = min(y, shoreline(x) - 1.7)
        if not allowed(x, y, avoid) or not clear_of(paths, x, y, 0.45):
            continue
        ground = ground_at(x, y)
        if ground is None:
            continue
        size = rng.uniform(0.38, 0.9)
        leaves = parts["sage"] if i % 3 else parts["darkSage"]
        shrub(leaves, parts["stems"], parts["flowers"], x, y, ground, size, rng, flowering=i % 4 == 1)
        occupied.append((x, y, size * 0.62))
        counts["shrubs"] += 1
    for x, inland, height, bias in PINES:
        y = shoreline(x) - inland
        ground = ground_at(x, y)
        if ground is None or not allowed(x, y, avoid):
            continue
        torrey_pine(parts["pine"], parts["needles"], x, y, ground, height, bias, rng)
        occupied.append((x, y, 1.0))
        counts["pines"] += 1
    for i in range(1400):
        cx, cy = SHRUB_CENTRES[i % 7]
        x, y = cx + rng.gauss(0, 3.4), cy + rng.gauss(0, 2.4)
        y = min(y, shoreline(x) - 1.2)
        if noise.noise(Vector((x * 0.35, y * 0.35, 1.7))) < -0.05:
            continue
        if not allowed(x, y, avoid) or not clear_of(paths, x, y, 0.3):
            continue
        ground = ground_at(x, y)
        if ground is None:
            continue
        grass(parts["grass"], x, y, ground, rng)
        counts["grassTufts"] += 1
    # Its own random stream, so the first planting above stays exactly where it was.
    counts.update(understory(parts, ground_at, paths, avoid, occupied, random.Random(seed + 1015)))
    names = {
        "sage": ("core_flora_sage", mats["sage"]),
        "darkSage": ("core_flora_dark_sage", mats["darkSage"]),
        "stems": ("core_flora_stems", mats["stems"]),
        "flowers": ("core_flora_buckwheat", mats["flowers"]),
        "pine": ("core_flora_torrey_bark", mats["pine"]),
        "needles": ("core_flora_torrey_needles", mats["needles"]),
        "grass": ("core_flora_dry_grass", mats["grass"]),
        "iceplant": ("core_flora_iceplant", mats["iceplant"]),
        "iceFlowers": ("core_flora_iceplant_flowers", mats["iceFlowers"]),
        "silverSage": ("core_flora_sagebrush", mats["silverSage"]),
        "berry": ("core_flora_lemonade_berry", mats["berry"]),
        "berryShade": ("core_flora_lemonade_berry_shade", mats["berryShade"]),
        "berryFruit": ("core_flora_lemonade_berry_fruit", mats["berryFruit"]),
        "pear": ("core_flora_prickly_pear", mats["pear"]),
        "pearFruit": ("core_flora_prickly_pear_fruit", mats["pearFruit"]),
        "yucca": ("core_flora_yucca", mats["yucca"]),
        "yuccaSkirt": ("core_flora_yucca_skirt", mats["yuccaSkirt"]),
        "oats": ("core_flora_wild_oats", mats["oats"]),
        "daisyLeaves": ("core_flora_daisy_leaves", mats["daisyLeaves"]),
        "daisyFlowers": ("core_flora_daisy_flowers", mats["daisyFlowers"]),
        "redIceplant": ("core_flora_red_iceplant", mats["redIceplant"]),
        "palmTrunk": ("core_flora_palm_trunk", mats["palmTrunk"]),
        "palm": ("core_flora_palm_fronds", mats["palm"]),
    }
    objects = {}
    for key, collector in parts.items():
        if len(collector.bm.faces):
            objects[key] = collector.finish(*names[key])
        else:
            collector.bm.free()
    return objects, counts
