"""Geometry for the hinterland's planting, lookout, gliderport and gliders (numpy only).

Every builder appends triangles to a Batch: positions in Blender coordinates (+X north, +Y west
toward the sea, Z up), a material key per triangle and a colour per vertex (a tint the bake
multiplies its occlusion into). bin/build_coastal_hinterland.py turns each batch into objects.
The planting is deliberately low-poly: from the outside camera (24 m and further) a shrub is a
lumpy mound and a Torrey pine a leaning trunk under a few broad, flat crown masses, which is how
the reserve's scrub reads from the beach. Detail falls off with distance from the house.
"""

import math

import numpy as np


class Batch:
    def __init__(self):
        self.verts, self.tris, self.mats, self.cols = [], [], [], []
        self.count = 0

    def add(self, verts, tris, mat, color=(1.0, 1.0, 1.0)):
        verts = np.asarray(verts, float)
        tris = np.asarray(tris, int)
        self.verts.append(verts)
        self.tris.append(tris + self.count)
        self.mats.append(np.full(len(tris), mat, dtype=object))
        col = np.asarray(color, float)
        self.cols.append(np.repeat(col[None, :], len(verts), 0) if col.ndim == 1 else col)
        self.count += len(verts)

    def arrays(self):
        if not self.verts:
            return np.zeros((0, 3)), np.zeros((0, 3), int), np.zeros(0, dtype=object), np.zeros((0, 3))
        return np.concatenate(self.verts), np.concatenate(self.tris), np.concatenate(self.mats), np.concatenate(self.cols)


def _ring_tris(rings, segments, closed_top=True, closed_bottom=False):
    """Triangles of a stack of `rings` rings of `segments` vertices (ring-major), with optional
    centre vertices appended after the rings (top first)."""
    tris = []
    for r in range(rings - 1):
        for k in range(segments):
            a, b = r * segments + k, r * segments + (k + 1) % segments
            c, d = a + segments, b + segments
            tris += [(a, b, d), (a, d, c)]
    extra = rings * segments
    if closed_top:
        top = extra
        last = (rings - 1) * segments
        for k in range(segments):
            tris.append((last + k, last + (k + 1) % segments, top))
        extra += 1
    if closed_bottom:
        for k in range(segments):
            tris.append(((k + 1) % segments, k, extra))
    return tris


def mound(batch, mat, centre, radius, height, ground, rng, segments=7, rings=3, color=(1, 1, 1), lump=0.22):
    """A lumpy shrub mound: a squashed dome whose rim sits just below the ground beneath it."""
    cx, cy = centre
    seed = rng.uniform(0, 100)
    verts = []
    for r in range(rings):
        phi = (r / rings) * (math.pi / 2) * 0.96
        for k in range(segments):
            theta = (k + 0.37 * r) / segments * math.tau
            wobble = 1 + lump * math.sin(theta * 3 + seed) * math.cos(phi * 2 + seed * 0.7) + 0.5 * lump * math.sin(theta * 5 - seed)
            rr = radius * math.cos(phi) * wobble
            x, y = cx + rr * math.cos(theta), cy + rr * 0.88 * math.sin(theta)
            if r == 0:
                z = ground(x, y) - 0.12
            else:
                z = ground(cx, cy) + height * math.sin(phi) * (1 + 0.5 * lump * math.sin(theta * 2 + seed))
            verts.append((x, y, z))
    verts.append((cx + rng.uniform(-0.1, 0.1) * radius, cy, ground(cx, cy) + height * (1 + rng.uniform(-0.08, 0.1))))
    base = ground(cx, cy)
    shade = np.array([[0.62 + 0.38 * min(1.0, max(0.0, (v[2] - base) / max(height, 0.1)))] for v in verts])
    batch.add(verts, _ring_tris(rings, segments), mat, np.asarray(color, float)[None, :] * shade)


def blob(batch, mat, centre, radii, rng, segments=6, rings=3, color=(1, 1, 1), lump=0.18):
    """A closed lumpy ellipsoid: a mass of pine needles or a canopy cluster."""
    cx, cy, cz = centre
    rx, ry, rz = radii
    seed = rng.uniform(0, 100)
    verts = [(cx, cy, cz - rz * 0.85)]
    for r in range(1, rings + 1):
        phi = -math.pi / 2 + r / (rings + 1) * math.pi
        for k in range(segments):
            theta = (k + 0.5 * r) / segments * math.tau
            w = 1 + lump * math.sin(theta * 3 + seed + r) + 0.6 * lump * math.cos(theta * 2 - seed)
            verts.append((cx + rx * math.cos(phi) * math.cos(theta) * w, cy + ry * math.cos(phi) * math.sin(theta) * w, cz + rz * math.sin(phi) * (1 + 0.4 * lump * math.sin(theta + seed))))
    verts.append((cx, cy, cz + rz * (0.9 + 0.2 * rng.random())))
    tris = []
    for k in range(segments):
        tris.append((0, 1 + (k + 1) % segments, 1 + k))
    for r in range(rings - 1):
        for k in range(segments):
            a, b = 1 + r * segments + k, 1 + r * segments + (k + 1) % segments
            tris += [(a, b, b + segments), (a, b + segments, a + segments)]
    top = 1 + rings * segments
    last = 1 + (rings - 1) * segments
    for k in range(segments):
        tris.append((last + k, last + (k + 1) % segments, top))
    batch.add(verts, tris, mat, color)


def tube(batch, mat, points, radii, segments=5, color=(1, 1, 1), cap=True):
    """A tapered tube through 3D points."""
    points = np.asarray(points, float)
    verts = []
    for i, (p, r) in enumerate(zip(points, radii)):
        a = points[max(0, i - 1)]
        b = points[min(len(points) - 1, i + 1)]
        axis = b - a
        axis /= max(np.linalg.norm(axis), 1e-9)
        side = np.cross(axis, (0, 0, 1))
        if np.linalg.norm(side) < 1e-4:
            side = np.array([1.0, 0, 0])
        side /= np.linalg.norm(side)
        up = np.cross(side, axis)
        for k in range(segments):
            t = k / segments * math.tau
            verts.append(p + (side * math.cos(t) + up * math.sin(t)) * r)
    tris = _ring_tris(len(points), segments, closed_top=False)
    if cap:
        verts.append(points[-1])
        last = (len(points) - 1) * segments
        tris += [(last + k, last + (k + 1) % segments, len(verts) - 1) for k in range(segments)]
    batch.add(verts, tris, mat, color)


def box(batch, mat, centre, size, yaw=0.0, color=(1, 1, 1), pitch=0.0):
    """An oriented box (size along local x, y, z), yawed about Z and pitched about local X."""
    hx, hy, hz = np.asarray(size, float) / 2
    corners = np.array([[sx * hx, sy * hy, sz * hz] for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)])
    cp, sp = math.cos(pitch), math.sin(pitch)
    corners = corners @ np.array([[1, 0, 0], [0, cp, sp], [0, -sp, cp]])
    c, s = math.cos(yaw), math.sin(yaw)
    corners = corners @ np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]]) + np.asarray(centre, float)
    tris = [(0, 2, 1), (1, 2, 3), (4, 5, 6), (5, 7, 6), (0, 1, 4), (1, 5, 4), (2, 6, 3), (3, 6, 7), (0, 4, 2), (2, 4, 6), (1, 3, 5), (3, 7, 5)]
    batch.add(corners, tris, mat, color)


# ---------------------------------------------------------------------------------------------
# Plants.


# Linear albedos of the planting (October): grey-green sage, dark chaparral, buckwheat gone rust,
# the brighter willows and mulefat of the washes, and the Torrey pines' dark needles.
CANOPY = {"sage": (0.37, 0.355, 0.22), "chaparral": (0.15, 0.175, 0.095), "buckwheat": (0.42, 0.25, 0.14), "riparian": (0.22, 0.29, 0.12),
          "pine": (0.11, 0.16, 0.095)}


def canopy_color(kind, rng):
    tone = rng.uniform(0.82, 1.12)
    base = np.asarray(CANOPY[kind]) * tone
    return np.clip(base * np.array([1.0, rng.uniform(0.95, 1.04), rng.uniform(0.9, 1.05)]), 0, 1)


def shrub(batch, kind, x, y, ground, rng, lod):
    """A scrub clump: grey sage mounds, dark chaparral domes, rusty buckwheat cushions or the brighter
    riparian shrubs of the canyon washes, all in the one canopy material."""
    color = canopy_color(kind, rng)
    segments, rings = (9, 3) if lod == 0 else (5, 2)
    if kind == "chaparral":
        r = rng.uniform(1.0, 2.1) * (1.35 if lod == 2 else 1.0)
        mound(batch, "canopy", (x, y), r, r * rng.uniform(0.6, 0.85), ground, rng, segments, rings, color, lump=0.3)
        for _ in range(1 if lod == 0 else 0):
            # Near the house a clump is several overlapping domes, as chaparral grows.
            a = rng.uniform(0, math.tau)
            k = rng.uniform(0.5, 0.75)
            mound(batch, "canopy", (x + math.cos(a) * r * 0.75, y + math.sin(a) * r * 0.75), r * k, r * k * 0.8, ground, rng, segments - 2, 2, color * rng.uniform(0.88, 1.05), lump=0.32)
    elif kind == "sage":
        r = rng.uniform(0.6, 1.25) * (1.4 if lod == 2 else 1.0)
        mound(batch, "canopy", (x, y), r, r * rng.uniform(0.55, 0.8), ground, rng, segments, rings, color, lump=0.36)
        if lod == 0 and rng.random() < 0.35:
            a = rng.uniform(0, math.tau)
            mound(batch, "canopy", (x + math.cos(a) * r * 0.7, y + math.sin(a) * r * 0.7), r * 0.6, r * 0.45, ground, rng, segments - 3, 2, color * 1.05, lump=0.35)
    elif kind == "buckwheat":
        r = rng.uniform(0.45, 0.8)
        mound(batch, "canopy", (x, y), r, r * 0.6, ground, rng, max(5, segments - 2), 2, color, lump=0.2)
    elif kind == "riparian":
        r = rng.uniform(1.0, 1.8)
        mound(batch, "canopy", (x, y), r, r * rng.uniform(0.9, 1.3), ground, rng, segments, rings, color, lump=0.28)


def torrey_pine(batch, x, y, ground, height, rng, lod, lean=(0.0, -0.25)):
    """A Torrey pine as the reserve's grow: a leaning, twisting trunk forking into a few limbs, each
    ending in a broad, flat mass of needles, so the crown is wide, irregular and flat-topped."""
    z0 = ground(x, y) - 0.25
    direction = np.array([lean[0] + rng.uniform(-0.12, 0.12), lean[1] + rng.uniform(-0.12, 0.12), 1.0])
    direction /= np.linalg.norm(direction)
    trunk_h = height * rng.uniform(0.5, 0.62)
    steps = 3 if lod == 0 else 2
    points = [np.array([x, y, z0])]
    for k in range(steps):
        twist = np.array([0.25 * math.sin(k * 1.9 + x), 0.2 * math.cos(k * 1.3 + y), 0.0])
        points.append(points[-1] + (direction + twist) / np.linalg.norm(direction + twist) * trunk_h / steps)
    base_r = height * 0.028
    tube(batch, "pine_trunk", points, [base_r * (1 - 0.55 * k / steps) for k in range(steps + 1)], segments=6 if lod == 0 else 4)
    fork = points[-1]
    limbs = rng.integers(3, 6) if lod == 0 else 3
    spread = height * rng.uniform(0.32, 0.42)
    for limb in range(limbs):
        a = limb / limbs * math.tau + rng.uniform(-0.4, 0.4)
        reach = spread * rng.uniform(0.6, 1.0)
        end = fork + np.array([math.cos(a) * reach, math.sin(a) * reach + lean[1] * reach * 0.6, height * rng.uniform(0.18, 0.32)])
        if lod == 0:
            tube(batch, "pine_trunk", [fork, (fork + end) / 2 + np.array([0, 0, 0.3]), end], [base_r * 0.45, base_r * 0.3, base_r * 0.18], segments=4, cap=False)
        crown = height * rng.uniform(0.17, 0.24)
        blob(batch, "canopy", end + np.array([0, 0, crown * 0.25]), (crown * 1.35, crown * 1.2, crown * 0.55), rng,
             segments=7 if lod == 0 else 5, rings=3 if lod == 0 else 2, color=canopy_color("pine", rng))
    top = height * rng.uniform(0.2, 0.26)
    blob(batch, "canopy", fork + np.array([0, 0, height * 0.3]), (top * 1.4, top * 1.3, top * 0.6), rng, segments=7 if lod == 0 else 5,
         rings=3 if lod == 0 else 2, color=canopy_color("pine", rng))


# ---------------------------------------------------------------------------------------------
# The lookout over the sea caves, after Goldfish Point's timber viewing deck, with a bench and a
# coin-operated binocular viewer of the kind along La Jolla's coast.


def bench(batch, centre, yaw, ground_z, backed=True):
    c, s = math.cos(yaw), math.sin(yaw)

    def at(lx, ly, lz):
        return (centre[0] + lx * c - ly * s, centre[1] + lx * s + ly * c, ground_z + lz)

    for k in range(3):
        box(batch, "bench_wood", at(0, -0.17 + k * 0.14, 0.45), (1.7, 0.11, 0.035), yaw)
    if backed:
        for k in range(2):
            box(batch, "bench_wood", at(0, 0.27, 0.62 + k * 0.15), (1.7, 0.035, 0.11), yaw, pitch=-0.2)
    for lx in (-0.7, 0.7):
        box(batch, "bench_steel", at(lx, 0.0, 0.22), (0.06, 0.48, 0.44), yaw)
        if backed:
            box(batch, "bench_steel", at(lx, 0.26, 0.6), (0.05, 0.05, 0.42), yaw, pitch=-0.2)


def coin_viewer(batch, base, facing_yaw, ground_z):
    """A pedestal binocular viewer: a steel post on a footplate, the coin box and a head with two
    eyepieces, tilted a little down toward the sea."""
    x, y = base
    box(batch, "viewer_steel", (x, y, ground_z + 0.03), (0.42, 0.42, 0.06), facing_yaw)
    tube(batch, "viewer_steel", [(x, y, ground_z), (x, y, ground_z + 1.08)], [0.065, 0.055], segments=8)
    c, s = math.cos(facing_yaw), math.sin(facing_yaw)
    head = np.array([x, y, ground_z + 1.25])
    box(batch, "viewer_enamel", tuple(head), (0.34, 0.42, 0.26), facing_yaw, pitch=0.12)
    box(batch, "viewer_enamel", tuple(head + np.array([0, 0, -0.2])), (0.2, 0.2, 0.16), facing_yaw)
    # The objective hood looks along local +Y (toward the view) and the eyepieces back along -Y.
    forward = np.array([-s, c, 0.0])
    across = np.array([c, s, 0.0])
    for side in (-1, 1):
        eye = head + across * side * 0.085 - forward * 0.21 + np.array([0, 0, 0.04])
        tube(batch, "viewer_steel", [eye, eye - forward * 0.07], [0.028, 0.03], segments=6)
    lens = head + forward * 0.22
    tube(batch, "viewer_steel", [lens, lens + forward * 0.06 - np.array([0, 0, 0.012])], [0.1, 0.11], segments=8)


def viewing_deck(batch, centre, yaw, ground, rng):
    """A timber deck on posts at the rim: boards across joists, a post-and-rail balustrade on three
    sides and an open landward side where the trail arrives."""
    c, s = math.cos(yaw), math.sin(yaw)
    width, depth = 4.6, 3.4
    deck_z = max(ground(*_loc(centre, c, s, lx, ly)) for lx in (-width / 2, 0, width / 2) for ly in (-depth / 2, 0, depth / 2)) + 0.32

    def at(lx, ly, lz=0.0):
        p = _loc(centre, c, s, lx, ly)
        return (p[0], p[1], deck_z + lz)

    for lx in (-width / 2 + 0.15, 0, width / 2 - 0.15):
        for ly in (-depth / 2 + 0.15, depth / 2 - 0.15):
            px, py, _ = at(lx, ly)
            g = ground(px, py)
            tube(batch, "deck_wood", [(px, py, g - 0.6), (px, py, deck_z - 0.05)], [0.09, 0.09], segments=4)
    for k in range(int(depth / 0.15)):
        ly = -depth / 2 + 0.075 + k * 0.15
        box(batch, "deck_wood", at(0, ly, -0.02), (width, 0.135, 0.04), yaw, color=(rng.uniform(0.86, 1.0),) * 3)
    for ly in (-depth / 2 + 0.2, 0.0, depth / 2 - 0.2):
        box(batch, "deck_wood", at(0, ly, -0.14), (width, 0.06, 0.18), yaw)
    rail_h = 1.05
    sides = [((-width / 2, depth / 2), (width / 2, depth / 2)), ((-width / 2, -depth / 2), (-width / 2, depth / 2)), ((width / 2, -depth / 2), (width / 2, depth / 2))]
    for (ax, ay), (bx, by) in sides:
        n = max(2, int(math.hypot(bx - ax, by - ay) / 1.15) + 1)
        for k in range(n):
            t = k / (n - 1)
            px, py, pz = at(ax + (bx - ax) * t, ay + (by - ay) * t)
            box(batch, "deck_wood", (px, py, pz + rail_h / 2), (0.09, 0.09, rail_h), yaw)
        for h in (rail_h, rail_h * 0.55):
            p0, p1 = at(ax, ay, h), at(bx, by, h)
            mid = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, p0[2])
            length = math.hypot(bx - ax, by - ay)
            seg_yaw = yaw + math.atan2(by - ay, bx - ax)
            box(batch, "deck_wood", mid, (length + 0.09, 0.07, 0.07 if h < rail_h else 0.09), seg_yaw)
    return deck_z, at


def _loc(centre, c, s, lx, ly):
    return (centre[0] + lx * c - ly * s, centre[1] + lx * s + ly * c)


def chain_fence(batch, points, ground, spacing=2.4, post_h=0.95):
    """The gliderport's post-and-chain edge fence: squat timber posts and a sagging chain."""
    points = np.asarray(points, float)
    seg = np.linalg.norm(np.diff(points, axis=0), axis=1)
    total = float(seg.sum())
    n = max(2, int(total / spacing) + 1)
    s = np.concatenate([[0.0], np.cumsum(seg)])
    posts = np.stack([np.interp(np.linspace(0, total, n), s, points[:, 0]), np.interp(np.linspace(0, total, n), s, points[:, 1])], 1)
    tops = []
    for k, (x, y) in enumerate(posts):
        g = ground(x, y)
        box(batch, "fence_post", (x, y, g + post_h / 2 - 0.15), (0.16, 0.16, post_h + 0.3), yaw=0.3 * math.sin(k * 1.7))
        tops.append(np.array([x, y, g + post_h - 0.12]))
    for a, b in zip(tops[:-1], tops[1:]):
        sag = [a + (b - a) * t - np.array([0, 0, 0.16 * 4 * t * (1 - t)]) for t in np.linspace(0, 1, 5)]
        tube(batch, "fence_chain", sag, [0.018] * 5, segments=4, cap=False)


# ---------------------------------------------------------------------------------------------
# The wind sock and the gliders. These are separate objects with their own pivots.

WINDSOCK_LENGTH = 3.2


def windsock_mast(batch, base_z, height=6.4):
    """The mast at the origin (the build places the object): a tapered steel pole and a cap."""
    tube(batch, "mast_steel", [(0, 0, base_z - 0.4), (0, 0, base_z + height * 0.5), (0, 0, base_z + height)], [0.075, 0.06, 0.045], segments=8)
    box(batch, "mast_steel", (0, 0, base_z - 0.3), (0.5, 0.5, 0.25))
    tube(batch, "mast_steel", [(0, 0, base_z + height), (0, 0, base_z + height + 0.22)], [0.035, 0.03], segments=6)


def windsock(batch, segments=12, bands=5, rings_per_band=2):
    """The sock in its own frame: the hoop at the origin and the sock along -Y (glTF +Z), tapering
    from 0.32 m to 0.14 m over WINDSOCK_LENGTH, in alternating orange and white bands, as on
    airfield and gliderport socks. A short arm ties the hoop to the swivel."""
    rings = bands * rings_per_band + 1
    verts, tris, mats = [], [], []
    for r in range(rings):
        t = r / (rings - 1)
        radius = 0.32 + (0.14 - 0.32) * t
        yy = -WINDSOCK_LENGTH * t
        for k in range(segments):
            a = k / segments * math.tau
            verts.append((radius * math.cos(a), yy, radius * math.sin(a)))
    for r in range(rings - 1):
        band = r // rings_per_band
        for k in range(segments):
            a, b = r * segments + k, r * segments + (k + 1) % segments
            tris += [(a, b, b + segments), (a, b + segments, a + segments)]
            mats += ["sock_orange" if band % 2 == 0 else "sock_white"] * 2
    verts = np.asarray(verts)
    # The cloth's materials are double-sided, so the inside of the sock shows through the mouth.
    batch.add(verts, tris, "sock_orange")
    batch.mats[-1] = np.asarray(mats, dtype=object)
    hoop = []
    for k in range(segments + 1):
        a = k / segments * math.tau
        hoop.append((0.33 * math.cos(a), 0.0, 0.33 * math.sin(a)))
    tube(batch, "mast_steel", hoop, [0.012] * len(hoop), segments=4, cap=False)
    tube(batch, "mast_steel", [(0, 0.05, 0.33), (0, 0.18, 0.33), (0, 0.22, 0.0)], [0.015] * 3, segments=4, cap=False)


def paraglider(batch, canopy, accent, helmet):
    """A paraglider in its own frame, facing -Y with its left wing toward +X: an arched elliptical
    canopy of cells in two colours, line cascades to the risers and a seated pilot in a pod
    harness 7 m below the canopy. The origin is the system's centre of mass, near the pilot."""
    span, arc = 11.0, math.radians(108)
    radius = span / 2 / math.sin(arc / 2)
    stations = 25
    profile = [(0.0, 0.0), (0.03, 0.055), (0.12, 0.085), (0.3, 0.095), (0.55, 0.075), (0.8, 0.04), (1.0, 0.0), (0.8, -0.01), (0.55, -0.015), (0.3, -0.02), (0.12, -0.03), (0.03, -0.035)]
    ring = len(profile)
    verts = []
    centre_z = 7.3
    for i in range(stations):
        s = -1 + 2 * i / (stations - 1)
        alpha = s * arc / 2
        chord = 2.75 * math.sqrt(max(0.05, 1 - (s * 0.97) ** 2)) + 0.25
        thickness = chord * 1.0
        # Radial direction from the arc's centre; the canopy's leading edge points along -Y.
        rx, rz = math.sin(alpha), math.cos(alpha)
        ox, oz = radius * rx, centre_z + radius * (rz - 1)
        sweep = 0.35 * s * s
        for (px, pz) in profile:
            yy = -chord * 0.4 + px * chord + sweep
            off = pz * thickness
            verts.append((ox + rx * off, yy, oz + rz * off))
    tris_canopy, tris_accent = [], []
    for i in range(stations - 1):
        cell = (i // 2) % 3
        for k in range(ring):
            a, b = i * ring + k, i * ring + (k + 1) % ring
            c, d = a + ring, b + ring
            target = tris_accent if cell == 1 else tris_canopy
            target += [(a, b, d), (a, d, c)]
    # Close the tips.
    tip0 = [k for k in range(ring)]
    tip1 = [(stations - 1) * ring + k for k in range(ring)]
    tris_canopy += [(tip0[0], tip0[k + 1], tip0[k]) for k in range(1, ring - 1)]
    tris_canopy += [(tip1[0], tip1[k], tip1[k + 1]) for k in range(1, ring - 1)]
    verts = np.asarray(verts)
    batch.add(verts, tris_canopy + tris_accent, canopy)
    batch.mats[-1] = np.asarray([canopy] * len(tris_canopy) + [accent] * len(tris_accent), dtype=object)
    # Pilot: pod harness, torso and helmet, with the risers above the shoulders.
    pilot = np.array([0.0, 0.1, 0.0])
    blob(batch, "harness", tuple(pilot + np.array([0, 0.2, -0.15])), (0.32, 0.75, 0.3), np.random.default_rng(7), segments=8, rings=3, lump=0.05)
    blob(batch, "harness", tuple(pilot + np.array([0, -0.15, 0.35])), (0.26, 0.22, 0.38), np.random.default_rng(8), segments=7, rings=3, lump=0.04)
    blob(batch, helmet, tuple(pilot + np.array([0, -0.2, 0.86])), (0.15, 0.17, 0.15), np.random.default_rng(9), segments=8, rings=3, lump=0.0)
    for side in (-1, 1):
        riser = pilot + np.array([side * 0.24, -0.1, 0.62])
        for frac in (0.25, 0.55, 0.85):
            i = int(round((0.5 + side * frac * 0.5) * (stations - 1)))
            anchor = verts[i * ring + 8]  # under the canopy, mid-chord on the lower surface
            tube(batch, "lines", [riser, anchor], [0.012, 0.01], segments=3, cap=False)


def hang_glider(batch):
    """A hang glider in its own frame, facing -Y: a cambered delta sail with a coloured leading
    edge, keel and crossbar, the triangular control frame, and the pilot prone in a cocoon
    harness under the keel. The origin is the hang point."""
    span, root_chord, nose_angle = 10.0, 2.9, math.radians(125)
    half = span / 2
    sweep = half / math.tan(nose_angle / 2)
    nose = np.array([0.0, -root_chord * 0.55, 0.45])
    tip_l = np.array([half, nose[1] + sweep, 0.55])
    tip_r = np.array([-half, nose[1] + sweep, 0.55])
    keel_end = np.array([0.0, nose[1] + root_chord, 0.4])
    verts, tris, mats = [], [], []
    rows = 8
    for side, tip in ((1, tip_l), (-1, tip_r)):
        base = len(verts)
        for r in range(rows + 1):
            t = r / rows
            lead = nose + (tip - nose) * t
            trail = keel_end + (tip + np.array([0, 0.35, 0]) - keel_end) * t
            for k in range(4):
                u = k / 3
                p = lead + (trail - lead) * u
                p = p + np.array([0, 0, 0.32 * math.sin(math.pi * u) * (1 - t * 0.6)])  # billow
                verts.append(p)
        for r in range(rows):
            for k in range(3):
                a = base + r * 4 + k
                quad = [(a, a + 1, a + 5), (a, a + 5, a + 4)] if side > 0 else [(a, a + 5, a + 1), (a, a + 4, a + 5)]
                tris += quad
                mats += ["sail_trim" if k == 0 else "sail"] * 2
    batch.add(verts, tris, "sail")  # a double-sided material shows the sail from below
    batch.mats[-1] = np.asarray(mats, dtype=object)
    tube(batch, "frame", [nose, keel_end + np.array([0, 0.25, 0])], [0.03, 0.03], segments=5)
    tube(batch, "frame", [tip_l * np.array([0.55, 1, 1]) + np.array([0, -0.4, -0.05]), tip_r * np.array([0.55, 1, 1]) + np.array([0, -0.4, -0.05])], [0.025, 0.025], segments=4)
    hang = np.array([0.0, 0.05, 0.4])
    bar_l, bar_r = np.array([0.75, -0.5, -1.25]), np.array([-0.75, -0.5, -1.25])
    for a, b in ((hang, bar_l), (hang, bar_r), (bar_l, bar_r)):
        tube(batch, "frame", [a, b], [0.02, 0.02], segments=4, cap=False)
    blob(batch, "harness", (0.0, 0.25, -0.75), (0.28, 1.0, 0.25), np.random.default_rng(11), segments=8, rings=3, lump=0.04)
    blob(batch, "helmet_white", (0.0, -0.78, -0.62), (0.15, 0.17, 0.15), np.random.default_rng(12), segments=8, rings=3, lump=0.0)
