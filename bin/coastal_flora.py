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


def tube(target, points, radii, base, height, segments=6):
    """A tapered tube through points; each ring's sway follows its height above the plant base."""
    rings = []
    for i, (p, r) in enumerate(zip(points, radii)):
        a = Vector(points[max(0, i - 1)])
        b = Vector(points[min(len(points) - 1, i + 1)])
        axis = (b - a).normalized()
        side = axis.cross(Vector((0, 0, 1)))
        side = (side if side.length > 1e-4 else Vector((1, 0, 0))).normalized()
        up = side.cross(axis).normalized()
        w = (Vector(p).z - base) / height
        rings.append([target.vert(Vector(p) + (side * math.cos(t) + up * math.sin(t)) * r, w) for t in (k * math.tau / segments for k in range(segments))])
    for lower, upper in zip(rings, rings[1:]):
        for k in range(segments):
            target.face((lower[k], lower[(k + 1) % segments], upper[(k + 1) % segments], upper[k]))
    target.face(list(reversed(rings[0])))
    target.face(rings[-1])


def blade(target, root, direction, length, width, base, height, bend=0.25):
    """A leaf, needle or grass blade: a tapered strip of two quads with a slight droop."""
    d = Vector(direction).normalized()
    side = d.cross(Vector((0, 0, 1)))
    side = (side if side.length > 1e-4 else Vector((1, 0, 0))).normalized()
    mid = root + d * length * 0.5 + Vector((0, 0, -bend * length * 0.15))
    tip = root + d * length + Vector((0, 0, -bend * length * 0.45))
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


def iceplant(leaves, flowers, cx, cy, rx, ry, ground_at, rng, avoid, paths):
    """A mat of sea fig (iceplant), the succulent that carpets La Jolla's bluffs: fleshy finger
    leaves lying low and curling up at the tips, with magenta flowers here and there."""
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
            if ground is None or not allowed(x, y, avoid):
                row.append(None)
                continue
            lift = 0.012 + 0.05 * (1 - (ring / rings) ** 3) * (0.6 + 0.4 * noise.noise(Vector((x * 1.7, y * 1.7, 0.4))))
            row.append(leaves.vert(Vector((x, y, ground + lift)), 0.0))
        grid.append(row)
    for ring in range(rings):
        for j in range(steps):
            quad = (grid[ring][j], grid[ring][(j + 1) % steps], grid[ring + 1][(j + 1) % steps], grid[ring + 1][j])
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
        if ground is None:
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


def planting(mats, ground_at, paths, avoid, seed=414):
    """Build the clifftop flora; returns {material key: object}."""
    rng = random.Random(seed)
    parts = {k: Sway() for k in ("sage", "darkSage", "stems", "flowers", "pine", "needles", "grass", "iceplant", "iceFlowers")}
    counts = {"shrubs": 0, "pines": 0, "grassTufts": 0, "iceplantLeaves": 0}
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
        counts["shrubs"] += 1
    for x, inland, height, bias in PINES:
        y = shoreline(x) - inland
        ground = ground_at(x, y)
        if ground is None or not allowed(x, y, avoid):
            continue
        torrey_pine(parts["pine"], parts["needles"], x, y, ground, height, bias, rng)
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
    }
    objects = {}
    for key, collector in parts.items():
        if len(collector.bm.faces):
            objects[key] = collector.finish(*names[key])
        else:
            collector.bm.free()
    return objects, counts
