"""Beach life on the wide footer coast: the props people use and where they are.

Pure Python, importable without Blender, so build_la_jolla.py, the runtime
figure manifest and test_coastal_life.py share one placement source.
Coordinates are Blender Z-up (x along the coast, y inland, z up).

Blender authors the props (courts, benches, the fire circle, parasols, the
lifeguard tower). People are posed and animated in the browser by
assets/js/footer-coast/people.mjs from the anchors exported here, so a
figure's seat, path or court always comes from the same numbers as the prop.
"""
import math

from coastal_terrain import ground_height, path_height, profile, shoreline

ALL_DAY = ("morning", "noon", "afternoon")
MIDDAY = ("noon", "afternoon")
NIGHT = ("evening",)


def beach_height(x, y):
    """Top of the sheltered beach ribbon (coastal_terrain.author_terrain)."""
    return .085 + max(0.0, y - shoreline(x)) * .027


def beach_back(x):
    """Inland edge of the dry beach, where the bluff ground begins."""
    return shoreline(x) + (1.9 if -19 <= x <= 19 else profile(x)[1])


def surface_height(x, y):
    """Highest authored ground at (x, y): beach sand or the bluff terrain."""
    sand = beach_height(x, y) if y <= beach_back(x) + .06 else -1.0
    land = ground_height(x, y) if y >= beach_back(x) else -1.0
    return max(sand, land)


def bluff_walk_y(x):
    """Centre line of 'Campus bluff walk' (coastal_terrain.landscape_paths)."""
    return shoreline(x) + profile(x)[1] + 1.9


# ---------------------------------------------------------------- structures
# Beach-level structures that people use or walk past. Footprints are axis
# aligned unless they carry an angle; test_coastal_life.py checks overlaps.
TENNIS = dict(x=-17.0, y=.4, z=1.05, w=4.4, d=2.4, net=.41)
# The volleyball court sits on the straight stretch of beach below the
# cottages, where an axis-aligned court fits between surf and bluff.
VOLLEYBALL = dict(x=-3.4, y=-1.68, z=.18, w=3.1, d=1.1, margin=.15, net=.72)
FIRE = dict(x=1.0, y=-1.0, ring=.38)
# Driftwood logs on the landward half of the circle; sitters face the fire
# and the sea, with the seaward side left open.
LOG_ANGLES = (25.0, 90.0, 155.0)
LOG_RADIUS, LOG_LENGTH, LOG_THICKNESS = .85, .5, .075
PARKED_BOARDS = [(-1.0, -.68), (-.77, -.68), (-.54, -.68)]
# The first parasol stands behind its towel, so from the sea its pole never crosses the sunbather.
PARASOLS = [(3.0, -.15), (13.8, -.8), (17.0, -.9)]
PARASOL_RADIUS = .44
# x, y, rotation: the sunbather's towel lies along the shore so she reads in profile.
TOWELS = [(3.2, -.45, math.pi / 2), (14.22, -1.0, 0.0), (16.55, -1.3, 0.0)]
TOWEL_SIZE = (.3, .67)
LIFEGUARD = dict(x=18.2, y=-1.8, deck=(.9, .8), height=.55, ramp=.8)
DIB_TERRACE = dict(x0=3.6, x1=11.4, y0=-.5, y1=4.9, top=.93)
# A side flight runs down along the terrace front to the sand, instead of a
# stair straight into the surf.
DIB_STAIR = dict(x_top=9.05, run=.3, steps=8, y0=-1.04, y1=-.52)
PIER = dict(x=12.5, width=.92, y0=-7.65, y1=.05, deck=.79)
PIER_LANDING = dict(y1=1.0)
SURFERS = [
    # x, y, heading, wake length; Surfer0 waits nose-out, Surfer2 paddles.
    dict(x=-6.2, y=-4.1, angle=-1.32, wake=0.0),
    dict(x=4.0, y=-5.1, angle=.15, wake=1.6),
    dict(x=15.0, y=-4.0, angle=-.12, wake=.45),
]
# Ocean-facing overlook benches sit beside the paths, never on them.
BENCHES = [(-34.0, 1.35, -.22), (-23.2, 3.2, .2), (34.8, 1.3, -.25), (40.8, -1.15, .15)]
DIB_BENCHES = [(4.8, .18), (10.0, .18)]
BENCH = dict(length=.9, depth=.22, seat=.18, thick=.06, foot=.34)


def log_seats():
    seats = []
    for angle in LOG_ANGLES:
        a = math.radians(angle)
        x = FIRE["x"] + math.cos(a) * LOG_RADIUS
        y = FIRE["y"] + math.sin(a) * LOG_RADIUS
        seats.append(dict(x=x, y=y, angle=a, z=beach_height(x, y)))
    return seats


def dib_stair_steps():
    """(x centre, tread top) for each step, top step first."""
    s = DIB_STAIR
    bottom = beach_height(s["x_top"] - s["run"] * s["steps"], (s["y0"] + s["y1"]) / 2) + .03
    rise = (DIB_TERRACE["top"] - bottom) / s["steps"]
    return [(s["x_top"] - s["run"] * (i + .5), DIB_TERRACE["top"] - rise * (i + 1)) for i in range(s["steps"])]


def bench_frame(x, y, angle):
    """Bench centre, axis and ocean-facing normal (unit vectors in the plane)."""
    axis = (math.cos(angle), math.sin(angle))
    front = (math.sin(angle), -math.cos(angle))
    return axis, front


def bench_seat_top(x, y, angle):
    """A level seat at sitting height above the ground where a visitor's feet rest.

    On sloping lawns the bench feet differ in length; the seat never sits lower
    than a short foot allows, and never so high that a sitter's feet dangle.
    """
    axis, front = bench_frame(x, y, angle)
    feet = [surface_height(x + axis[0] * s * BENCH["foot"], y + axis[1] * s * BENCH["foot"]) for s in (-1, 1)]
    rest = surface_height(x + front[0] * .2, y + front[1] * .2)
    return max(max(feet) + .12, rest + BENCH["seat"])


# ------------------------------------------------------------------ footprints
def _rect(name, x0, x1, y0, y1, z0, z1, group):
    return dict(name=name, kind="rect", x0=x0, x1=x1, y0=y0, y1=y1, z0=z0, z1=z1, group=group)


def _circle(name, x, y, r, z0, z1, group):
    return dict(name=name, kind="circle", x=x, y=y, r=r, z0=z0, z1=z1, group=group)


def _oriented(name, x, y, length, depth, angle, z0, z1, group):
    c, s = math.cos(angle), math.sin(angle)
    corners = [(x + c * a - s * b, y + s * a + c * b) for a, b in ((-length / 2, -depth / 2), (length / 2, -depth / 2), (length / 2, depth / 2), (-length / 2, depth / 2))]
    return dict(name=name, kind="poly", points=corners, z0=z0, z1=z1, group=group)


def footprints():
    """Plan footprints of beach-level props, each with a vertical extent."""
    items = []
    t, v = TENNIS, VOLLEYBALL
    items.append(_rect("tennis court", t["x"] - t["w"] / 2 - .3, t["x"] + t["w"] / 2 + .3, t["y"] - t["d"] / 2 - .3, t["y"] + t["d"] / 2 + .3, 0, t["z"] + .75, "tennis"))
    m = v["margin"]
    items.append(_rect("volleyball court", v["x"] - v["w"] / 2 - m, v["x"] + v["w"] / 2 + m, v["y"] - v["d"] / 2 - m, v["y"] + v["d"] / 2 + m, .08, v["z"] + v["net"], "volleyball"))
    items.append(_circle("fire ring", FIRE["x"], FIRE["y"], FIRE["ring"] + .13, .08, .5, "fire"))
    for i, seat in enumerate(log_seats()):
        items.append(_oriented(f"log seat {i}", seat["x"], seat["y"], LOG_LENGTH, LOG_THICKNESS * 2, seat["angle"] + math.pi / 2, seat["z"] - .02, seat["z"] + .14, "fire"))
    for i, (x, y) in enumerate(PARKED_BOARDS):
        items.append(_rect(f"parked board {i}", x - .12, x + .12, y - .06, y + .06, 0, 1.4, "boards"))
    for i, (x, y) in enumerate(PARASOLS):
        items.append(_circle(f"parasol pole {i}", x, y, .03, 0, .95, f"parasol {i}"))
        items.append(_circle(f"parasol canopy {i}", x, y, PARASOL_RADIUS, beach_height(x, y) + .74, beach_height(x, y) + .93, f"parasol {i}"))
    for i, (x, y, angle) in enumerate(TOWELS):
        w, d = TOWEL_SIZE
        items.append(_oriented(f"towel {i}", x, y, w, d, angle, 0, .2, f"parasol {i}"))
    g = LIFEGUARD
    dw, dd = g["deck"]
    items.append(_rect("lifeguard tower", g["x"] - dw / 2, g["x"] + dw / 2, g["y"] - dd / 2, g["y"] + dd / 2, 0, 2.0, "lifeguard"))
    # The ramp climbs from the deck to the bluff path behind the beach.
    items.append(_rect("lifeguard ramp", g["x"] - .16, g["x"] + .16, g["y"] + dd / 2, g["y"] + dd / 2 + g["ramp"], 0, 1.0, "lifeguard"))
    d = DIB_TERRACE
    items.append(_rect("DIB terrace", d["x0"], d["x1"], d["y0"], d["y1"], 0, d["top"], "dib"))
    steps = dib_stair_steps()
    s = DIB_STAIR
    items.append(_rect("DIB beach stair", steps[-1][0] - s["run"] / 2, steps[0][0] + s["run"] / 2, s["y0"], s["y1"], 0, DIB_TERRACE["top"] + .4, "dib"))
    p = PIER
    items.append(_rect("pier", p["x"] - p["width"] / 2, p["x"] + p["width"] / 2, p["y0"], PIER_LANDING["y1"], -1, p["deck"] + .4, "pier"))
    for i, (x, y, angle) in enumerate(BENCHES):
        top = bench_seat_top(x, y, angle)
        items.append(_oriented(f"overlook bench {i}", x, y, BENCH["length"], BENCH["depth"], angle, top - BENCH["seat"] - .05, top, "bench"))
    return items


# --------------------------------------------------------------------- figures
def _path(points):
    return [(x, y, surface_height(x, y)) for x, y in points]


def shore_walk():
    """Wet sand just above the waterline, from the courts to the pier."""
    xs = [-1.3 + i * .4 for i in range(33)]
    return _path([(x, shoreline(x) + .06) for x in xs if x <= 11.5])


def bluff_walk():
    xs = [-33.3 + i * .4 for i in range(35)]
    points = []
    for x in xs:
        if x > -19.7:
            break
        y = bluff_walk_y(x)
        # Walkers tread the ribbon's surface (coastal_terrain.landscape_paths).
        points.append((x, y, path_height(x, y)))
    return points


def swim_lane():
    return [(-3.2, -3.45, 0.0), (.8, -3.05, 0.0)]


def figures():
    """Every person on the footer coast, with the prop they belong to."""
    seats = log_seats()
    cast = [
        dict(id="tennis", kind="tennis", when=ALL_DAY, host="Tennis", court=TENNIS),
        dict(id="volleyball", kind="volleyball", when=MIDDAY, host="BeachVolleyball", court=VOLLEYBALL),
        dict(
            id="fire",
            kind="fire",
            when=NIGHT,
            center=(FIRE["x"], FIRE["y"], beach_height(FIRE["x"], FIRE["y"])),
            seats=[dict(x=s["x"], y=s["y"], z=s["z"] + LOG_THICKNESS * 2 - .01, action=a, look=l) for s, a, l in zip(seats, ("warm", "roast", "warm"), (7, 8, 9))],
        ),
        dict(id="shore-walk", kind="walker", when=ALL_DAY, path=shore_walk(), speed=.26, pause=3.2, dog=True, look=4, start=.42),
        dict(id="shore-couple", kind="walker", when=NIGHT, path=shore_walk(), speed=.2, pause=4.0, pair=True, look=5, start=.3),
        dict(id="bluff-walk", kind="walker", when=MIDDAY, path=bluff_walk(), speed=.24, pause=2.6, look=6, start=.62),
        dict(id="bluff-jog", kind="walker", when=("morning",), path=bluff_walk(), speed=.62, pause=1.2, gait="run", look=10, start=.25),
        dict(id="surf-wait", kind="surfer", when=MIDDAY, parent="Surfer0", stance="wait", look=11),
        dict(id="surf-ride", kind="surfer", when=MIDDAY, parent="Surfer1", stance="ride", look=12),
        dict(id="surf-paddle", kind="surfer", when=MIDDAY, parent="Surfer2", stance="paddle", look=13),
        dict(id="swimmer", kind="swimmer", when=MIDDAY, path=swim_lane(), speed=.16, look=14),
    ]
    tx, ty, tangle = TOWELS[0]
    # Lying along the towel, head toward the DIB terrace.
    cast.append(dict(id="sunbather", kind="sunbather", when=MIDDAY, x=tx, y=ty, z=beach_height(tx, ty) + .018, angle=tangle - math.pi / 2, look=15))
    bench_cast = [("rest", ALL_DAY, 16), ("read", ALL_DAY, 17), ("lean", ALL_DAY + NIGHT, 18), ("elbows", MIDDAY, 19)]
    for i, ((x, y, angle), (action, when, look)) in enumerate(zip(BENCHES, bench_cast)):
        axis, front = bench_frame(x, y, angle)
        top = bench_seat_top(x, y, angle)
        fx, fy = x + front[0] * .2, y + front[1] * .2
        cast.append(dict(id=f"bench-{i}", kind="sitter", when=when, action=action, look=look, x=x, y=y, seat=top, feet=surface_height(fx, fy), facing=math.atan2(front[1], front[0])))
    x, y = DIB_BENCHES[0]
    cast.append(dict(id="dib-laptop", kind="sitter", when=ALL_DAY, action="laptop", look=20, host="DIB", x=x, y=y, seat=DIB_TERRACE["top"] + BENCH["seat"], feet=DIB_TERRACE["top"], facing=-math.pi / 2))
    return cast


# ------------------------------------------------------------------- manifest
def _web(point):
    x, y, z = point
    return [round(x, 4), round(z, 4), round(-y, 4)]


def _yaw(facing):
    """Rotation about web Y that turns a figure's local +Z toward a Blender plan direction."""
    return round(math.atan2(math.cos(facing), -math.sin(facing)), 5)


def manifest_figures():
    """The runtime's figure list in web (Y-up) coordinates."""
    out = []
    for f in figures():
        entry = dict(id=f["id"], kind=f["kind"], when=list(f["when"]))
        for key in ("host", "parent", "stance", "action", "look", "speed", "pause", "dog", "pair", "gait", "start"):
            if key in f:
                entry[key] = f[key]
        if "path" in f:
            entry["path"] = [_web(p) for p in f["path"]]
        if "court" in f:
            c = f["court"]
            entry["court"] = dict(center=_web((c["x"], c["y"], c["z"] + .0225)), length=c["w"], width=c["d"], net=round(c["net"] - .0225, 4))
        if f["kind"] == "fire":
            entry["center"] = _web(f["center"])
            entry["seats"] = [dict(at=_web((s["x"], s["y"], s["z"])), yaw=_yaw(math.atan2(f["center"][1] - s["y"], f["center"][0] - s["x"])), action=s["action"], look=s["look"]) for s in f["seats"]]
        if f["kind"] == "sitter":
            entry["at"] = _web((f["x"], f["y"], f["seat"]))
            entry["feet"] = round(f["feet"], 4)
            entry["yaw"] = _yaw(f["facing"])
        if f["kind"] == "sunbather":
            entry["at"] = _web((f["x"], f["y"], f["z"]))
            entry["yaw"] = _yaw(f["angle"])
        out.append(entry)
    return out


if __name__ == "__main__":
    import json

    print(json.dumps(manifest_figures(), indent=1))
