"""The land around the coastal home (Sirui, 2026-10-15: "left, right and backside of the mountain
is done in a lazy way").

The mainland block that holds the house (coastal_section.py) stops at flat walls: its back at
y = -32 and its ends at x = -36 and x = 76. This module designs what continues from those walls,
after photographs of the real coast (artwork/coastal-home/PROVENANCE.md, October 15):

  inland, a coastal mesa of sage scrub and chaparral, rising slowly toward a long hill, cut by two
  eroded sandstone canyons whose fluted badland walls carry a red cap, as at Torrey Pines;
  north, the bluffs climb past a canyon mouth to tall Torrey sandstone cliffs over a long beach,
  with the gliderport's grassy launch on the mesa above;
  south, a cove with a wide beach at a canyon mouth, then a headland whose north face holds sea
  caves under a timber viewing deck, as at Goldfish Point, and a distant point beyond.

Everything here is numpy and pure geometry; bin/build_coastal_hinterland.py turns it into meshes.
The first metres of each surface reproduce the mainland's own functions (coastal_landscape.py),
so the new ground, cliff faces and beaches continue the retained ones without a step.

Blender coordinates: +X north, +Y west toward the sea, Z up. Mean sea level is -7.35 m.
"""

import math

import numpy as np

SEA = -7.35
FOOT = -8.4  # the mainland's cliff faces start here, below the sand and the water
MAIN_X0, MAIN_X1, MAIN_BACK = -36.0, 76.0, -32.0
EXTENT = {"x0": -660.0, "x1": 720.0, "y0": -660.0}
# The shore shader clamps its waterline to the mainland's end values (environment.mjs reads the
# manifest's beach samples, which span only the mainland). Past each end the new waterline must not
# fall inland of these, or a band of surf would float offshore.
CLAMPED_WATERLINE = {"south": 11.0251, "north": 12.8927}


# ---------------------------------------------------------------------------------------------
# The mainland's own functions, vectorised (coastal_landscape.py holds the scalar originals).


def bell(x, center, width):
    return np.exp(-(((np.asarray(x, float) - center) / width) ** 2))


def smoothstep(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def shoreline(x):
    x = np.asarray(x, float)
    return 5.4 + 8.5 * bell(x, -15, 7) + 12 * bell(x, 24, 9) + 6 * bell(x, 53, 13) - 2.6 * bell(x, 8, 5) + 0.5 * np.sin(x * 0.19)


def weathering(x, z):
    x, z = np.asarray(x, float), np.asarray(z, float)
    ix, iz = np.floor(x), np.floor(z)
    fx, fz = x - ix, z - iz
    fx, fz = fx * fx * (3 - 2 * fx), fz * fz * (3 - 2 * fz)

    def corner(a, b):
        value = np.sin(a * 127.1 + b * 311.7 + 93.4) * 43758.5453
        return (value - np.floor(value)) * 2 - 1

    return ((1 - fx) * corner(ix, iz) + fx * corner(ix + 1, iz)) * (1 - fz) + ((1 - fx) * corner(ix, iz + 1) + fx * corner(ix + 1, iz + 1)) * fz


BLOCKS = [(-17, -2.7, 3.5, 3.6, 1.8), (-11, 2.4, 2.8, 3.1, 1.25), (-6.6, -3.3, 1.9, 2.2, 1.8), (-2.5, -5.7, 2.7, 1.5, 0.9),
          (7.5, 1.9, 2.2, 2.1, 1.3), (12.5, -3.2, 3.0, 2.7, 2.1), (18, 4.7, 4, 3.0, 1.2), (26, -1, 3.2, 5.4, 1.9), (32, 2.4, 3.0, 2.9, 1.2)]


def mainland_relief(x, z):
    """cliff_surface(x, z) - shoreline(x): how far the retained cliff face stands seaward of its
    shoreline at each height."""
    x, z = np.asarray(x, float), np.asarray(z, float)
    foot = 1.55 * bell(z, -6.0, 1.8)
    buttresses = 1.4 * bell(x, -7.3, 1.65) + 2.3 * bell(x, 10.8, 2.1) + 2.0 * bell(x, 20, 2.8) + 1.6 * bell(x, -19, 2.2)
    shelf = 0.30 * np.tanh((z + 3.6 + 0.12 * x) * 2.5) + 0.24 * np.tanh((z - 2.0 + 0.045 * x) * 3)
    scallop = 0.36 * np.sin(x * 0.79 + z * 0.24) + 0.18 * np.sin(x * 1.7 - z * 0.48)
    scallop = scallop - 0.52 * bell(x + 0.19 * z, -4.6, 0.36) - 0.67 * bell(x - 0.13 * z, 13.1, 0.48) - 0.40 * bell(x + 0.07 * z, -11.4, 0.31)
    blocks = sum(a * bell(x, cx, wx) * bell(z, cz, wz) for cx, cz, wx, wz, a in BLOCKS)
    weathered = 0.45 * weathering(x * 0.62 + z * 0.12, z * 0.72) + 0.13 * weathering(x * 1.45, z * 1.8)
    return foot + buttresses * (0.7 + 0.3 * np.cos(z * 0.24)) + shelf + scallop + blocks + weathered


def cliff_surface(x, z):
    return shoreline(x) + mainland_relief(x, z)


def top_height(x, y):
    x, y = np.asarray(x, float), np.asarray(y, float)
    inland = np.clip((shoreline(x) - y) / 32, 0, 1)
    return (6.75 + 4.0 * bell(x, -15, 8) + 5.8 * bell(x, 25, 11) + 2.1 * bell(x, 53, 14) + 1.2 * inland
            + 0.43 * np.sin(x * 0.34 + y * 0.21) + 0.18 * np.sin(x * 0.9 - y * 0.37))


def ridge(x):
    """Height where the retained top surface meets its cliff face (coastal_section.py)."""
    z = top_height(x, shoreline(x))
    for _ in range(5):
        z = top_height(x, cliff_surface(x, z))
    return z


def beach_width(x):
    x = np.asarray(x, float)
    return 13.5 + 8.5 * bell(x, 5, 10) + 5 * bell(x, 39, 9) - 4 * bell(x, 23, 6)


def beach_profile(x, t):
    """The retained beach's height across its width (t = 0 at the cliff foot, 1 under the sea)."""
    x, t = np.asarray(x, float), np.asarray(t, float)
    return -6.88 - 1.22 * t + 0.28 * bell(t, 0.18, 0.16) + 0.10 * np.sin(x * 0.41 + t * 2) * (1 - t) + 0.10 * bell(x, -6, 4) * bell(t, 0.45, 0.3)


# ---------------------------------------------------------------------------------------------
# Noise for the new ground (same hash family as the mainland's weathering).


def _hash(ix, iy, seed):
    value = np.sin(ix * 127.1 + iy * 311.7 + seed * 74.7 + 13.1) * 43758.5453
    return value - np.floor(value)


def value_noise(x, y, seed=0.0):
    x, y = np.asarray(x, float), np.asarray(y, float)
    ix, iy = np.floor(x), np.floor(y)
    fx, fy = x - ix, y - iy
    ux, uy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = _hash(ix, iy, seed), _hash(ix + 1, iy, seed)
    c, d = _hash(ix, iy + 1, seed), _hash(ix + 1, iy + 1, seed)
    return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy


def fbm(x, y, octaves=4, seed=0.0):
    """Fractal value noise in [0, 1]; each octave is rotated so the grid never lines up."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    total, amplitude, norm = 0.0, 0.5, 0.0
    c, s = math.cos(0.61), math.sin(0.61)
    for octave in range(octaves):
        total = total + amplitude * value_noise(x, y, seed + octave * 17.0)
        norm += amplitude
        x, y = (c * x - s * y) * 2.03 + 31.7, (s * x + c * y) * 2.03 - 11.3
        amplitude *= 0.5
    return total / norm


# ---------------------------------------------------------------------------------------------
# Polylines.


def resample(points, spacing):
    """Even resampling of an open polyline (n x 2) at roughly `spacing` metres."""
    points = np.asarray(points, float)
    seg = np.linalg.norm(np.diff(points, axis=0), axis=1)
    s = np.concatenate([[0.0], np.cumsum(seg)])
    n = max(2, int(math.ceil(s[-1] / spacing)) + 1)
    t = np.linspace(0.0, s[-1], n)
    return np.stack([np.interp(t, s, points[:, 0]), np.interp(t, s, points[:, 1])], axis=1)


def catmull_rom(points, samples_per_segment=12):
    """Centripetal Catmull-Rom through an open polyline (n x 2 or n x 3), ends clamped."""
    p = np.asarray(points, float)
    padded = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]])
    out = []
    for i in range(1, len(padded) - 2):
        p0, p1, p2, p3 = padded[i - 1], padded[i], padded[i + 1], padded[i + 2]
        t0 = 0.0
        t1 = t0 + max(np.linalg.norm(p1 - p0), 1e-6) ** 0.5
        t2 = t1 + max(np.linalg.norm(p2 - p1), 1e-6) ** 0.5
        t3 = t2 + max(np.linalg.norm(p3 - p2), 1e-6) ** 0.5
        for k in range(samples_per_segment):
            t = t1 + (t2 - t1) * k / samples_per_segment
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            out.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
    out.append(p[-1])
    return np.asarray(out)


def polyline_frame(points, x, y):
    """Distance from each (x, y) to an open polyline, the arc length of the nearest point and the
    side (+1 left of travel, -1 right)."""
    p = np.asarray(points, float)
    x, y = np.asarray(x, float), np.asarray(y, float)
    best = np.full(x.shape, np.inf)
    arc = np.zeros(x.shape)
    side = np.ones(x.shape)
    s0 = 0.0
    for a, b in zip(p[:-1], p[1:]):
        d = b - a
        length2 = max(float(d @ d), 1e-12)
        t = np.clip(((x - a[0]) * d[0] + (y - a[1]) * d[1]) / length2, 0.0, 1.0)
        px, py = a[0] + t * d[0], a[1] + t * d[1]
        dist = np.hypot(x - px, y - py)
        closer = dist < best
        best = np.where(closer, dist, best)
        arc = np.where(closer, s0 + t * math.sqrt(length2), arc)
        cross = d[0] * (y - a[1]) - d[1] * (x - a[0])
        side = np.where(closer, np.where(cross >= 0, 1.0, -1.0), side)
        s0 += math.sqrt(length2)
    return best, arc, side


# ---------------------------------------------------------------------------------------------
# Canyons. Each has a centreline from its mouth inland, a floor that climbs from the beach, and
# fluted badland walls: ribs and gullies running down the walls, a red cap at the rim.

CANYONS = {
    # The north canyon reaches the beach past the mainland's north end, as Torrey Pines' canyons
    # reach Black's Beach.
    "north": {"mouth_floor": -6.5, "head_floor": 6.8, "floor": 4.0, "slope": 0.42,
              "points": [(118.0, 14.0), (117.5, 4.0), (114.5, -10.0), (108.0, -27.0), (98.0, -47.0), (86.0, -70.0), (76.0, -94.0),
                         (70.0, -116.0), (68.0, -134.0)]},
    # The south canyon opens onto the cove's beach.
    "south": {"mouth_floor": -6.5, "head_floor": 5.6, "floor": 4.5, "slope": 0.48,
              "points": [(-74.0, 12.0), (-73.5, 0.0), (-70.0, -12.0), (-64.0, -27.0), (-57.0, -48.0), (-50.0, -74.0), (-45.0, -100.0),
                         (-43.0, -122.0)]},
    # Gullies: two feeding the south canyon from the mesa, and ravines notching the tall north
    # bluffs, each with a floor that starts at its parent's (or the beach) and dies out inland.
    "south-gully-a": {"join": ("south", 74.0), "head_depth": 1.2, "floor": 1.6, "slope": 0.55,
                      "points": [(-56.0, -52.0), (-44.0, -64.0), (-30.0, -72.0), (-16.0, -86.0)]},
    "south-gully-b": {"join": ("south", 118.0), "head_depth": 1.0, "floor": 1.4, "slope": 0.6,
                      "points": [(-47.0, -94.0), (-62.0, -108.0), (-80.0, -116.0), (-96.0, -130.0)]},
    "north-ravine-a": {"mouth_floor": -6.2, "head_depth": 2.0, "floor": 1.8, "slope": 0.5,
                       "points": [(140.0, 14.0), (140.5, 2.0), (142.0, -12.0), (143.0, -28.0)]},
    "north-ravine-b": {"mouth_floor": -5.6, "head_depth": 2.5, "floor": 1.6, "slope": 0.48,
                       "points": [(226.0, 14.0), (226.5, 2.0), (229.0, -14.0), (234.0, -34.0), (240.0, -52.0)]},
    "north-ravine-c": {"mouth_floor": -5.0, "head_depth": 3.0, "floor": 2.4, "slope": 0.46,
                       "points": [(296.0, 14.0), (296.0, 0.0), (292.0, -18.0), (286.0, -42.0), (284.0, -70.0), (290.0, -96.0)]},
    "north-ravine-d": {"mouth_floor": -5.4, "head_depth": 2.0, "floor": 1.5, "slope": 0.5,
                       "points": [(372.0, 14.0), (373.0, 0.0), (377.0, -18.0), (384.0, -36.0)]},
}


def canyon_length(name):
    pts = np.asarray(CANYONS[name]["points"], float)
    return float(np.sum(np.linalg.norm(np.diff(pts, axis=0), axis=1)))


def canyon_floor(name, arc, ground):
    """Floor height along a canyon: from its mouth (the beach, or the parent canyon's floor where
    it joins) up to its head, where it reaches the mesa's own level less `head_depth`."""
    canyon = CANYONS[name]
    length = canyon_length(name)
    t = np.clip(np.asarray(arc, float) / length, 0, 1)
    if "join" in canyon:
        parent, at = canyon["join"]
        start = float(canyon_floor(parent, at, None)) + 0.6
    else:
        start = canyon["mouth_floor"]
    if "head_floor" in canyon:
        return start + (canyon["head_floor"] - start) * t ** 0.85
    end = np.asarray(ground, float) - canyon["head_depth"]
    return start + (end - start) * t ** 1.4


def canyon_surface(name, x, y, ground):
    """The canyon's carved surface (np.inf outside it), wall weight, depth below the mesa and rib
    crest weight. The floor climbs from the beach to the head, where the canyon dies out; the walls
    are fluted, ribs standing forward of rounded gullies every six or seven metres."""
    canyon = CANYONS[name]
    pts = np.asarray(canyon["points"], float)
    dist, arc, side = polyline_frame(pts, x, y)
    length = canyon_length(name)
    t = np.clip(arc / length, 0, 1)
    floor = canyon_floor(name, arc, ground)
    # A floor that widens toward the mouth, with a shallow wash down its middle.
    half = canyon["floor"] * (1.0 - 0.45 * t) + 1.0
    floor = floor - 0.35 * np.exp(-((dist / np.maximum(1.0, half * 0.5)) ** 2))
    warp = 2.2 * fbm(x * 0.05, y * 0.05, 2, seed=11.0)
    phase = arc * (2 * math.pi / 6.6) + warp * 2.4 + side * 1.3
    rib = np.abs(np.sin(phase * 0.5)) ** 1.6
    run = np.maximum(0.0, dist - half)
    # Finer flutes than the ribs would alias on the ground's 1.5-2 m triangles; the sandstone shader
    # draws that scale.
    wall_run = np.maximum(0.0, run - (1.0 - rib) * 3.2 * smoothstep(0.5, 5.0, run))
    surface = floor + wall_run / canyon["slope"]
    depth = ground - floor
    head = smoothstep(length * 0.93, length * 1.06, arc)
    surface = surface + head * np.maximum(0, depth)
    inside = dist < half + np.maximum(depth, 0) * canyon["slope"] + 8.0
    surface = np.where(inside, surface, np.inf)
    wall = smoothstep(half, half + 2.5, dist) * (1 - head)
    return surface, wall, depth, rib


# ---------------------------------------------------------------------------------------------
# The regional ground, before the canyons.


def mainland_distance(x, y):
    """Horizontal distance to the retained mainland's footprint (zero on it)."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    dx = np.maximum(np.maximum(MAIN_X0 - x, x - MAIN_X1), 0.0)
    dy = np.maximum(MAIN_BACK - y, 0.0)
    return np.hypot(dx, dy)


def base_height(x, y):
    """The coastal mesa: a terrace near 10 m that climbs inland, the higher Torrey Pines mesa to the
    north, a low cove backshore to the south, a headland crown and a long hill far inland."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    inland = np.maximum(0.0, 6.0 - y)
    h = 9.6 + 1.6 * (1 - np.exp(-inland / 70.0)) + 0.006 * np.maximum(0.0, inland - 90.0)
    # Stepped marine terraces: old shorelines inland, each a scarp of six or seven metres.
    scarp1 = -205.0 + 26.0 * np.sin(x / 140.0 + 0.6) + 10.0 * np.sin(x / 47.0)
    scarp2 = -385.0 + 30.0 * np.sin(x / 170.0 + 2.1) + 12.0 * np.sin(x / 61.0)
    h = h + 6.5 * smoothstep(scarp1 + 14.0, scarp1 - 14.0, y) + 7.5 * smoothstep(scarp2 + 16.0, scarp2 - 16.0, y)
    # North: the bluffs climb past the canyon to the gliderport mesa.
    north = smoothstep(96.0, 215.0, x)
    h = h + 14.5 * north * (1.0 - 0.3 * smoothstep(-200.0, -520.0, y))
    # South: the cove's low backshore and the headland's crown.
    h = h - 3.6 * bell(x, -80.0, 26.0) * bell(y, -4.0, 40.0)
    h = h + 5.5 * bell(x, -126.0, 34.0) * bell(y, 26.0, 26.0)
    h = h + 3.0 * bell(x, -332.0, 40.0) * bell(y, 52.0, 40.0)
    # The long hill inland (after Mount Soledad, not to scale), lying northeast to southwest.
    c, s = math.cos(math.radians(32)), math.sin(math.radians(32))
    u, v = c * (x + 210.0) + s * (y + 445.0), -s * (x + 210.0) + c * (y + 445.0)
    h = h + 66.0 * np.exp(-((u / 240.0) ** 2) - (v / 105.0) ** 2) * (0.85 + 0.3 * fbm(x / 60.0, y / 60.0, 3, seed=4.0))
    h = h + 24.0 * np.exp(-(((x + 20.0) / 160.0) ** 2) - ((y + 570.0) / 80.0) ** 2)
    # Broad, low swells: a terrace is nearly flat, its relief in the drainages.
    h = h + 1.8 * (fbm(x / 130.0, y / 130.0, 4, seed=1.0) - 0.5)
    h = h + 0.5 * (fbm(x / 26.0, y / 26.0, 3, seed=2.0) - 0.5)
    # Rills: shallow branching channels where rain runs off the terrace.
    rill = 1 - np.abs(2 * fbm(x / 34.0, y / 22.0, 3, seed=3.0) - 1)
    h = h - 0.9 * rill**6 * smoothstep(40.0, 90.0, mainland_distance(x, y))
    h = h + 0.7 * (fbm(x / 7.5, y / 7.5, 3, seed=31.0) - 0.5) * smoothstep(6.0, 20.0, mainland_distance(x, y))
    return h


def ground_height(x, y, with_canyons=True):
    """The finished top surface: the mainland's own top_height at its walls, eased into the mesa
    over 25 m (equal value and slope at the seam), then the canyons."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    d = mainland_distance(x, y)
    w = smoothstep(0.0, 25.0, d)
    h = top_height(x, y) * (1 - w) + base_height(x, y) * w
    if not with_canyons:
        return h
    for name in CANYONS:
        surface, _, _, _ = canyon_surface(name, x, y, h)
        # A soft minimum rounds the rim instead of leaving a crease.
        k = 1.2
        soft = -k * np.logaddexp(-h / k, -np.where(np.isfinite(surface), surface, 1e6) / k)
        h = np.where(np.isfinite(surface), np.minimum(h, soft), h)
    return h


def canyon_masks(x, y):
    """Wall weight (0..1), cap weight and rib crest for colouring and planting."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    h = ground_height(x, y, with_canyons=False)
    wall = np.zeros(x.shape)
    rib = np.zeros(x.shape)
    floor = np.zeros(x.shape)
    for name in CANYONS:
        surface, wall_w, depth, rib_w = canyon_surface(name, x, y, h)
        carved = np.isfinite(surface) & (surface < h - 0.4)
        wall = np.maximum(wall, np.where(carved, wall_w, 0.0))
        rib = np.where(carved & (wall_w > 0.2), np.maximum(rib, rib_w), rib)
        floor = np.maximum(floor, np.where(carved & (wall_w < 0.25), 1.0, 0.0))
    return wall, rib, floor


# ---------------------------------------------------------------------------------------------
# Coastlines. Each starts with dense samples of the mainland's own shoreline, so the first metres
# repeat the retained cliff, then bends to the designed outline.

SOUTH_OUTLINE = [(-58.0, 4.4), (-66.0, 2.4), (-72.0, 1.1), (-78.0, 1.5), (-86.0, 3.6), (-92.5, 7.2),
                 # the headland's north face, where the caves are
                 (-96.5, 12.5), (-99.5, 20.0), (-102.0, 28.5), (-104.5, 36.0), (-108.5, 43.0),
                 (-116.0, 47.5), (-126.0, 49.5), (-136.0, 47.5), (-145.5, 42.5), (-152.5, 35.0), (-157.0, 26.0),
                 (-160.5, 17.5), (-166.0, 11.0), (-176.0, 8.0), (-196.0, 7.0), (-228.0, 8.0), (-260.0, 10.0),
                 # a distant point, after Point La Jolla
                 (-288.0, 18.0), (-302.0, 38.0), (-316.0, 60.0), (-330.0, 74.0), (-346.0, 79.0), (-361.0, 71.0),
                 (-373.0, 52.0), (-386.0, 30.0), (-402.0, 16.0), (-432.0, 10.0), (-485.0, 9.0), (-565.0, 10.0), (-660.0, 11.0)]
NORTH_OUTLINE = [(98.0, 6.3), (106.0, 6.8), (113.0, 7.6), (118.5, 8.6), (124.0, 8.9), (134.0, 8.5), (150.0, 7.9),
                 (175.0, 8.1), (200.0, 8.9), (232.0, 9.7), (266.0, 9.3), (302.0, 8.6), (342.0, 9.0), (392.0, 10.3),
                 (452.0, 11.0), (522.0, 11.4), (602.0, 12.0), (720.0, 12.6)]
SEAM_RUN = 15.0  # metres of the mainland's own shoreline before the designed outline
CAVES = [  # metres along the south coast from the seam, half width, crown height, depth
    (74.0, 2.3, -3.4, 7.0), (83.5, 3.1, -2.4, 9.5), (92.5, 1.9, -4.2, 5.5),
]


def coast_path(side):
    """Dense control path of the cliff-foot baseline for one side, from the mainland's end."""
    x0, sign = (MAIN_X0, -1.0) if side == "south" else (MAIN_X1, 1.0)
    seam = [(x0 + sign * 0.5 * k, float(shoreline(x0 + sign * 0.5 * k))) for k in range(int(SEAM_RUN / 0.5) + 1)]
    outline = SOUTH_OUTLINE if side == "south" else NORTH_OUTLINE
    dense = catmull_rom(seam[-4:] + outline, 16)
    return np.vstack([np.asarray(seam[:-4], float), dense])


def coast_spacing(side, u):
    """Column spacing along a coast: the mainland's 0.5 m at the seam, coarser with distance,
    fine again where the sea caves are."""
    s = np.interp(u, [0, 14, 40, 110, 220, 420, 900], [0.5, 0.5, 1.0, 2.0, 4.0, 8.0, 14.0])
    if side == "south":
        for at, half, _, _ in CAVES:
            s = np.where(np.abs(u - at) < half + 3.0, np.minimum(s, 0.45), s)
    return s


def coast_samples(side):
    """Columns along one coast: arc length u, baseline P, tangent, seaward normal N, the direction
    the relief displaces along (exactly +Y at the seam, easing to N) and the relief's x argument."""
    path = coast_path(side)
    seg = np.linalg.norm(np.diff(path, axis=0), axis=1)
    s = np.concatenate([[0.0], np.cumsum(seg)])
    us = [0.0]
    while us[-1] < s[-1]:
        us.append(us[-1] + float(coast_spacing(side, us[-1])))
    us[-1] = min(us[-1], s[-1])
    u = np.asarray(us)
    px, py = np.interp(u, s, path[:, 0]), np.interp(u, s, path[:, 1])
    # Smooth tangents from a wider stencil.
    ahead = np.stack([np.interp(np.minimum(u + 1.5, s[-1]), s, path[:, 0]), np.interp(np.minimum(u + 1.5, s[-1]), s, path[:, 1])], 1)
    behind = np.stack([np.interp(np.maximum(u - 1.5, 0), s, path[:, 0]), np.interp(np.maximum(u - 1.5, 0), s, path[:, 1])], 1)
    tangent = ahead - behind
    tangent /= np.linalg.norm(tangent, axis=1, keepdims=True)
    if side == "south":
        normal = np.stack([tangent[:, 1], -tangent[:, 0]], 1)
    else:
        normal = np.stack([-tangent[:, 1], tangent[:, 0]], 1)
    blend = smoothstep(0.0, 22.0, u)[:, None]
    direction = (1 - blend) * np.array([0.0, 1.0]) + blend * normal
    direction /= np.linalg.norm(direction, axis=1, keepdims=True)
    x0, sign = (MAIN_X0, -1.0) if side == "south" else (MAIN_X1, 1.0)
    # The relief's x argument is the baseline's own x over the seam run, then arc length.
    xs = np.where(u <= SEAM_RUN, px, x0 + sign * (SEAM_RUN + (u - SEAM_RUN)))
    xs[0] = x0
    px[0], py[0] = x0, float(shoreline(x0))
    return {"side": side, "u": u, "P": np.stack([px, py], 1), "T": tangent, "N": normal, "D": direction, "xr": xs}


def bluff_relief(side, u, xr, z, top):
    """The new coast's relief beyond the seam: a protruding foot above the sand, sandstone ledges,
    scallops, weathering, and on the tall north bluffs deep badland gullies that bite into the
    upper face and fan out into talus at its base."""
    u, xr, z = np.asarray(u, float), np.asarray(xr, float), np.asarray(z, float)
    foot = 1.4 * bell(z, -6.0, 1.9)
    ledges = 0.35 * np.tanh((z - 1.5 - 0.06 * np.sin(u * 0.05) * 10) * 2.2) + 0.28 * np.tanh((z + 3.0) * 2.6)
    scallop = 0.4 * np.sin(u * 0.61 + z * 0.27) + 0.22 * np.sin(u * 1.37 - z * 0.41)
    weathered = 0.5 * weathering(u * 0.55 + z * 0.1, z * 0.66) + 0.16 * weathering(u * 1.4, z * 1.7)
    relief = foot + ledges + scallop + weathered
    height = np.maximum(np.asarray(top, float) - FOOT, 1.0)
    frac = np.clip((z - FOOT) / height, 0.0, 1.0)
    if side == "north":
        tall = smoothstep(30.0, 90.0, u)
        warp = 9.0 * fbm(u * 0.012, 3.3, 2, seed=5.0)
        gully = np.abs(np.sin((u + warp) * (2 * math.pi / 11.0) * 0.5)) ** 0.7  # 1 on ribs, 0 in gullies
        flute = np.abs(np.sin((u + 0.4 * warp) * 1.9)) ** 1.5  # small flutes down the face
        bite = (1 - gully) * 3.0 * smoothstep(0.04, 0.3, frac) + (1 - flute) * 0.45 * smoothstep(0.1, 0.4, frac)
        buttress = 1.8 * fbm(u * 0.035, 7.1, 3, seed=6.0)
        lean = -2.4 * frac ** 1.5  # the tall face leans back
        talus = 2.6 * (1 - smoothstep(0.0, 0.25, frac)) * (0.5 + 0.5 * gully)
        relief = relief + tall * (-bite + buttress + lean + talus)
    return relief


def caves_relief(side, u, z):
    """Sea caves pushed into the south headland's north face at the waterline."""
    out = np.zeros(np.broadcast(u, z).shape)
    if side != "south":
        return out
    u, z = np.asarray(u, float), np.asarray(z, float)
    for at, half, crown, depth in CAVES:
        # A rounded, slightly lopsided arch: a half-ellipse springing from below the water, its
        # outline wavering with the rock, the cave deepest at its middle.
        base = SEA - 1.2
        height = crown - base
        wobble = 1 + 0.12 * np.sin(z * 2.1 + at) + 0.08 * np.sin((u - at) * 1.7 + at)
        lean = 0.18 * (z - base) / height * half
        r2 = ((u - at - lean) / (half * wobble)) ** 2 + ((z - base) / height) ** 2
        shape = np.sqrt(np.clip(1 - r2, 0, 1))
        out = out - depth * shape * smoothstep(FOOT - 0.5, FOOT + 1.2, z)
    return out


def face_relief(side, u, xr, z, top):
    """How far the cliff face stands seaward of the baseline: the mainland's own relief at the seam,
    blended into the new bluffs over the first 60 m."""
    u = np.asarray(u, float)
    keep = 1 - smoothstep(12.0, 60.0, u)
    return keep * mainland_relief(xr, z) + (1 - keep) * bluff_relief(side, u, xr, z, top) + caves_relief(side, u, z)


def edge_heights(samples, iterations=6):
    """Top edge of each column: where the ground meets the face (solved like ridge())."""
    P, D, u, xr = samples["P"], samples["D"], samples["u"], samples["xr"]
    side = samples["side"]
    z = ground_height(P[:, 0], P[:, 1])
    for _ in range(iterations):
        r = face_relief(side, u, xr, z, z)
        edge = P + D * r[:, None]
        z = ground_height(edge[:, 0], edge[:, 1])
    r = face_relief(side, u, xr, z, z)
    edge = P + D * r[:, None]
    # The first column is the mainland's own ridge point.
    x0 = MAIN_X0 if side == "south" else MAIN_X1
    z[0] = float(ridge(x0))
    edge[0] = (x0, float(cliff_surface(x0, z[0])))
    return edge, z


def beach_design(samples):
    """Beach width per column: the mainland's widths at the seam, a wide cove beach at the south
    canyon's mouth, none under the headlands, a long beach under the north bluffs. Each width is
    raised where needed so the waterline never sits inland of the shore shader's clamped one."""
    side, u, P = samples["side"], samples["u"], samples["P"]
    x0 = MAIN_X0 if side == "south" else MAIN_X1
    width = beach_width(samples["xr"])
    if side == "south":
        design = 13.5 + 7.0 * bell(P[:, 0], -74.0, 13.0)
        headland = smoothstep(-90.0, -97.0, P[:, 0]) * (1 - smoothstep(-163.0, -170.0, P[:, 0]))
        point = smoothstep(-283.0, -292.0, P[:, 0]) * (1 - smoothstep(-398.0, -406.0, P[:, 0]))
        design = design * (1 - np.maximum(headland, point))
    else:
        design = 14.0 + 2.5 * smoothstep(120.0, 220.0, P[:, 0])
    blend = smoothstep(4.0, 24.0, u)
    return width * (1 - blend) + design * blend


# ---------------------------------------------------------------------------------------------
# Trails, the gliderport and the lookout. Positions are Blender X/Y; heights come from the ground.

TRAILS = {
    # The bluff trail behind the house: from an overlook on the south canyon's rim along the mesa,
    # inland along the north canyon's rim and round its head, then out to the gliderport.
    "mesa": [(-46.0, -36.0), (-40.0, -43.0), (-28.0, -46.0), (-12.0, -44.5), (2.0, -46.5), (18.0, -45.0), (34.0, -47.5),
             (50.0, -46.0), (62.0, -50.0), (64.0, -62.0), (57.0, -84.0), (51.0, -106.0), (53.0, -128.0), (60.0, -146.0),
             (74.0, -150.0), (84.0, -136.0), (89.0, -120.0), (96.0, -100.0), (105.0, -79.0), (116.0, -58.0), (132.0, -46.0),
             (150.0, -34.0), (163.0, -24.0), (172.0, -16.0)],
    # The Coast Walk on the south headland, from the cove's rim to the viewing deck over the caves.
    "coast-walk": [(-88.0, -12.0), (-93.0, -4.0), (-98.0, 4.0), (-103.0, 12.0), (-107.0, 20.0), (-109.5, 26.5)],
}
TRAIL_WIDTH = 1.3
GLIDERPORT = {"x": (158.0, 197.0), "back": -40.0, "edge_margin": 3.0, "windsock": (184.0, -1.0)}
LOOKOUT_U = 83.0  # the viewing deck stands on the headland's rim over the middle cave


# ---------------------------------------------------------------------------------------------
# Colour. Linear albedos after the October photographs; the browser multiplies them into the
# white-based ground material, and into the sandstone materials as tints.

SOIL = np.array([0.47, 0.37, 0.25])  # dusty sandy soil between the scrub
GRASS = np.array([0.55, 0.45, 0.26])  # dry golden grass
SAGE = np.array([0.33, 0.33, 0.24])  # silver-grey sagebrush and buckwheat, seen as one matrix
CHAPARRAL = np.array([0.16, 0.18, 0.11])  # dark lemonade berry, laurel sumac and scrub oak
BADLAND = np.array([0.74, 0.57, 0.38])  # the fluted sandstone's orange-tan
CAP = np.array([0.52, 0.29, 0.17])  # the iron-red cap under the mesa soil
WASH = np.array([0.70, 0.60, 0.45])  # sand in the canyon floors
SEAM_LOOK = np.array([0.46, 0.34, 0.20])  # what the retained clifftop's shading averages to
PALE = np.array([0.86, 0.77, 0.62])  # "pale torrey sandstone"
GOLDEN = np.array([0.62, 0.43, 0.265])  # "golden coastal sandstone"


def _mix(a, b, t):
    t = np.asarray(t, float)[..., None]
    return a * (1 - t) + b * t


def vegetation_cover(x, y, nz, wall, floor):
    """0..1 scrub cover: patchy and dense on the mesa, thin on steep ground, denser in the washes."""
    patches = fbm(x / 36.0, y / 36.0, 4, seed=21.0)
    cover = smoothstep(0.22, 0.54, patches) * smoothstep(0.55, 0.86, nz) * (1 - 0.85 * wall)
    wash = floor * smoothstep(0.35, 0.65, fbm(x / 8.0, y / 8.0, 2, seed=23.0))
    return np.clip(cover + 0.6 * wash, 0.0, 1.0)


def chaparral_share(x, y):
    """How much of the cover is dark chaparral rather than grey sage: more in swales and inland."""
    return smoothstep(0.42, 0.78, fbm(x / 70.0 + 3.1, y / 70.0, 3, seed=27.0)) * 0.85 + 0.1


def ground_albedo(x, y, z, nz, d, wall, rib, floor, cap):
    """Albedo of the white-based ground per vertex."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    cover = vegetation_cover(x, y, nz, wall, floor)
    grassy = fbm(x / 14.0, y / 14.0, 3, seed=29.0)
    bare = _mix(SOIL, GRASS, smoothstep(0.35, 0.7, grassy))
    green = _mix(SAGE, CHAPARRAL, chaparral_share(x, y))
    albedo = _mix(bare, green, cover * 0.92)
    steep = smoothstep(0.82, 0.5, nz)
    rock = _mix(BADLAND * (0.93 + 0.12 * rib[..., None]), CAP, cap)
    albedo = _mix(albedo, rock, np.maximum(steep, wall * 0.9))
    albedo = _mix(albedo, WASH, floor * (1 - cover) * 0.8)
    # Near the mainland the ground matches its soil-over-sandstone look.
    return _mix(SEAM_LOOK[None, :] * np.ones_like(albedo), albedo, smoothstep(45.0, 95.0, d))


def sandstone_tint(base, z, top, wall, rib, cap):
    """Multiplier on a sandstone material: a red cap under the rim, lighter ribs, a greyer foot."""
    target = _mix(np.ones(3) * np.ones((np.size(z), 1)), CAP / base, cap)
    target = target * (0.92 + 0.08 * np.asarray(rib, float))[..., None]
    return np.clip(target, 0.0, 1.0)


def bluff_albedo(z, top, u, kind):
    """The north bluffs (pale Torrey sandstone): an iron-red cap, pale buff body streaked by the
    gullies, a greyer mudstone foot; returned as albedo (kind 'albedo') or as a tint on PALE."""
    z, top, u = np.asarray(z, float), np.asarray(top, float), np.asarray(u, float)
    below = top - z
    cap = smoothstep(3.2, 1.0, below) * smoothstep(-6.0, 6.0, top)
    streak = 0.9 + 0.1 * np.sin(u * 0.9 + 1.7 * np.sin(u * 0.13))
    foot = smoothstep(-3.0, -6.0, z)
    albedo = PALE[None, :] * streak[:, None]
    albedo = _mix(albedo, np.array([0.60, 0.58, 0.50]), foot * 0.7)
    albedo = _mix(albedo, CAP * 1.1, cap)
    if kind == "albedo":
        return albedo
    return np.clip(albedo / PALE, 0.0, 1.0)
