"""The living room (Sirui, 2026-10-16, then 2026-10-20: "could you make the first place has sunked-in area
so teh sofa could be more cozy ... have a really high ufo design styler flaoting fireplace with chuney
oogin into out of cliff with rock top as disguish to blend into enviroment").

The middle of the ground floor is one open room now: the plaster media fin that split it from the old
reading nook is gone. A conversation pit is sunk 42 cm into the oak floor: built-in seating in the same
white cloud boucle along its inland side and both ends, open toward the sea, with an oak tread down
from the walk along the glass, a wool rug and two floor cushions where the seated feet rest. The
floating fireplace (scene-furniture's floating-fireplace, a suspended bowl and hood) hangs in the pit,
and its slim blackened-steel flue rises through the double height into the vault and on through the
rock; on the clifftop it ends in a cap disguised as a cluster of sandstone boulders in the scrub.

Sirui watches the Pacific from the inland seat, facing the sea past the fire. The TV hangs on the north
wall over a floating oak credenza, beside the passage to the gym. The Eames lounge chair and ottoman
(scene-furniture's eames-lounge) take the north corner by the glass, facing the ocean, with a brass
reading lamp, clear of the walk from the gym to the terrace door.

House coordinates: metres, Z up, +Y toward the sea, +X north.
"""

import math
import random
import bmesh
import bpy
from mathutils import Matrix, Vector

import coastal_anchors as anchors
import coastal_sunken as sunken
from coastal_living_plants import ensure_living_plants
from coastal_office import Parts, box, cylinder, lathe, rooted_leaf, _mat

# The pit: its x edges on the floor's board seams.
PIT = {"x": (sunken.seam(-1.02), sunken.seam(2.81)), "y": (-0.95, 2.65)}
PIT_DEPTH = 0.42
PIT_FLOOR = -PIT_DEPTH
SEAT_HEIGHT = 0.44  # above the pit floor; the seat top is 2 cm over the main floor
SEAT_TOP = PIT_FLOOR + SEAT_HEIGHT
BACK_TOP = SEAT_TOP + 0.44
UPSTAND, BACK_CUSHION, SEAT_DEPTH = 0.08, 0.14, 0.42
RUN = UPSTAND + BACK_CUSHION + SEAT_DEPTH  # 0.64 from the pit's edge to the seat front
RUN_END = 2.0  # the end runs stop here, short of the tread along the sea side
TREAD = (2.35, PIT["y"][1])  # one oak tread across the open sea side
# Sirui's place on the inland run: hips 12 cm in front of the back cushion, facing the sea. The seated
# clips sit 51.5 cm over the actor and rest the feet 22 cm over it.
SEAT = (-0.15, PIT["y"][0] + UPSTAND + BACK_CUSHION + 0.12)
SEAT_ACTOR_Z = SEAT_TOP - 0.515
FEET_Z = SEAT_ACTOR_Z + 0.22
FLOOR_CUSHIONS = ((-0.15, 0.02), (0.15, 1.95))
FIREPLACE = (0.95, 1.15)  # on the pit floor; the bowl's centre 0.75 m above it
FLUE_START = PIT_FLOOR + 1.9
FLUE_ITEM = 0.3  # scene-furniture's fireplace includes this much of the flue
FLUE_RADIUS = 0.1
LANTERN = (-0.72, 2.18)  # the paper floor lantern, on the pit floor at the south run's end
# The north wall: the TV over a floating credenza, between the gallery's fin and the gym passage.
TV = {"size": (1.44, 0.81), "center_y": 0.22, "center_z": 1.32, "face_x": 5.115}
CREDENZA = {"x": (4.66, 5.12), "y": (-0.55, 1.0), "z": (0.16, 0.56)}
# The Eames lounge corner: the item's footprint (0.84 x 1.55, ottoman toward the sea) centred here.
EAMES = (4.15, 3.0)
READING_LAMP = (4.52, 2.08)


def living_materials():
    get = bpy.data.materials.get
    return {
        "boucle": get("cloud boucle textile") or _mat("cloud boucle textile", (0.86, 0.845, 0.81), 0.95),
        "linen": get("linen"),
        "indigo": get("indigo textile"),
        "ochre": get("ochre textile"),
        "terra": get("terracotta"),
        "sage": get("sage textile"),
        "wool": get("oatmeal wool textile") or _mat("oatmeal wool textile", (0.66, 0.6, 0.5), 0.96),
        "knit": get("ochre knit textile") or _mat("ochre knit textile", (0.6, 0.38, 0.11), 0.95),
        "travertine": get("honed travertine") or _mat("honed travertine", (0.78, 0.69, 0.56), 0.62),
        "plaster": get("chalk limestone"),
        "stone": get("warm cut stone"),
        "oak": get("pale oak"),
        "smoked": get("honey ash"),
        "nickel": get("polished nickel"),
        "brass": get("brushed brass"),
        "black": get("matte black device"),
        "tv": get("tv black glass") or _mat("tv black glass", (0.006, 0.007, 0.009), 0.12),
        "paper": get("washi lantern paper") or _mat("washi lantern paper", (0.92, 0.88, 0.78), 0.85, 0.0, (1.0, 0.8, 0.55), 0.6),
        "leaf": get("olive leaf"),
        "bark": get("olive bark wood") or _mat("olive bark wood", (0.3, 0.27, 0.22), 0.85),
        "sleeve": get("record sleeve card"),
        "ink": get("charcoal"),
        "celadon": get("celadon glaze"),
        "jute": get("woven jute"),
        "steel": _mat("blackened steel flue", (0.025, 0.024, 0.023), 0.42, 0.85),
        "bronze": get("dark bronze") or _mat("dark bronze", (0.09, 0.07, 0.05), 0.35, 0.9),
        "leather": _mat("cognac saddle leather", (0.32, 0.14, 0.06), 0.55),
    }


def cushion(bm, lo, hi, radius):
    """A plush cushion: a box with every edge rounded deep, so it reads soft from any side."""
    size = tuple(hi[k] - lo[k] for k in range(3))
    center = tuple((hi[k] + lo[k]) / 2 for k in range(3))
    box(bm, center, size, radius, segments=4)


def build_pit(p, m):
    """The sunken box, the tread, the built-in seating and its cushions, the rug and the floor cushions;
    returns the tread supports."""
    mats = {"stone": m["stone"], "plaster": m["plaster"], "oak": m["oak"], "smoked": m["smoked"]}
    (x0, x1), (y0, y1) = PIT["x"], PIT["y"]
    # The runs' upstands line the inland side and both ends; the open sea side gets the tread.
    sunken.lined_box(p, mats, (x0, x1, y0, y1), PIT_DEPTH, open_sides=("sea",), nosing=True)
    treads = sunken.steps(p, mats, x0, x1, TREAD[0], TREAD[1], 0.0, PIT_FLOOR, 2, "-y")
    boucle, oak, smoked, plaster = p.bm(m["boucle"]), p.bm(m["oak"]), p.bm(m["smoked"]), p.bm(m["plaster"])
    # Plinths (smoked oak, recessed toe kick), seat and back cushions of boucle, plaster upstands capped
    # in oak at the main floor's edge so the backs rise 46 cm above the room.
    runs = (
        ("inland", (x0, x1), (y0, y0 + RUN)),
        ("south", (x0, x0 + RUN), (y0 + RUN, RUN_END)),
        ("north", (x1 - RUN, x1), (y0 + RUN, RUN_END)),
    )
    for side, (ax0, ax1), (ay0, ay1) in runs:
        if side == "inland":
            seat = ((ax0, ay0 + UPSTAND + BACK_CUSHION), (ax1, ay1))
            back = ((ax0, ay0 + UPSTAND), (ax1, ay0 + UPSTAND + BACK_CUSHION))
            up = ((ax0, ay0), (ax1, ay0 + UPSTAND))
        elif side == "south":
            seat = ((ax0 + UPSTAND + BACK_CUSHION, ay0), (ax1, ay1))
            back = ((ax0 + UPSTAND, ay0), (ax0 + UPSTAND + BACK_CUSHION, ay1))
            up = ((ax0, ay0), (ax0 + UPSTAND, ay1))
        else:
            seat = ((ax0, ay0), (ax1 - UPSTAND - BACK_CUSHION, ay1))
            back = ((ax1 - UPSTAND - BACK_CUSHION, ay0), (ax1 - UPSTAND, ay1))
            up = ((ax1 - UPSTAND, ay0), (ax1, ay1))
        (ux0, uy0), (ux1, uy1) = up
        box(plaster, ((ux0 + ux1) / 2, (uy0 + uy1) / 2, (PIT_FLOOR + BACK_TOP) / 2), (ux1 - ux0, uy1 - uy0, BACK_TOP - PIT_FLOOR), 0.01)
        (sx0, sy0), (sx1, sy1) = seat
        box(smoked, ((sx0 + sx1) / 2, (sy0 + sy1) / 2, (PIT_FLOOR + SEAT_TOP - 0.13) / 2), (sx1 - sx0 - 0.05, sy1 - sy0 - 0.05, SEAT_TOP - 0.13 - PIT_FLOOR), 0.01)
        # Seat cushions in about 85 cm lengths, so the run reads as upholstery, not a slab.
        along = 0 if side == "inland" else 1
        lo, hi = (sx0, sx1) if along == 0 else (sy0, sy1)
        pieces = max(1, round((hi - lo) / 0.85))
        for k in range(pieces):
            a, b = lo + (hi - lo) * k / pieces, lo + (hi - lo) * (k + 1) / pieces
            if along == 0:
                cushion(boucle, (a + 0.006, sy0, SEAT_TOP - 0.15), (b - 0.006, sy1, SEAT_TOP), 0.08)
            else:
                cushion(boucle, (sx0, a + 0.006, SEAT_TOP - 0.15), (sx1, b - 0.006, SEAT_TOP), 0.08)
        (bx0, by0), (bx1, by1) = back
        lo, hi = (bx0, bx1) if along == 0 else (by0, by1)
        for k in range(pieces):
            a, b = lo + (hi - lo) * k / pieces, lo + (hi - lo) * (k + 1) / pieces
            if along == 0:
                cushion(boucle, (a + 0.01, by0, SEAT_TOP - 0.03), (b - 0.01, by1 + 0.03, BACK_TOP - 0.02), 0.1)
            else:
                cushion(boucle, (bx0 - 0.03 if side == "north" else bx0, a + 0.01, SEAT_TOP - 0.03), (bx1 + 0.03 if side == "south" else bx1, b - 0.01, BACK_TOP - 0.02), 0.1)
        # The end runs finish in a low rounded arm toward the sea.
        if side != "inland":
            cushion(boucle, (ax0 + 0.02, ay1 - 0.16, PIT_FLOOR + 0.02), (ax1 - 0.02, ay1, SEAT_TOP + 0.12), 0.08)
    # Oak caps along the upstands' tops, flush with the floor's nosing.
    box(oak, ((x0 + x1) / 2, y0 + UPSTAND / 2, BACK_TOP + 0.014), (x1 - x0, UPSTAND + 0.03, 0.028), 0.008)
    for ux in (x0 + UPSTAND / 2, x1 - UPSTAND / 2):
        box(oak, (ux, (y0 + UPSTAND + RUN_END) / 2, BACK_TOP + 0.014), (UPSTAND + 0.03, RUN_END - y0 - UPSTAND, 0.028), 0.008)
    # Throw pillows: indigo and ochre against the white, a terracotta one at Sirui's elbow.
    for mat, (x, y), axis in (
        ("indigo", (x0 + RUN - 0.2, 0.75), "y"),
        ("ochre", (x0 + RUN - 0.2, 1.55), "y"),
        ("indigo", (x1 - RUN + 0.2, 1.2), "y"),
        ("terra", (SEAT[0] + 0.55, y0 + UPSTAND + BACK_CUSHION + 0.1), "x"),
        ("ochre", (1.6, y0 + UPSTAND + BACK_CUSHION + 0.1), "x"),
    ):
        size = (0.44, 0.15, 0.4) if axis == "x" else (0.15, 0.44, 0.4)
        box(p.bm(m[mat]), (x, y, SEAT_TOP + 0.19), size, 0.07, segments=3)
    # The rug: oatmeal wool with an inset linen border, over the pit floor between the seats.
    rx0, rx1, ry0, ry1 = x0 + RUN + 0.05, x1 - RUN - 0.05, y0 + RUN + 0.05, TREAD[0] - 0.05
    box(p.bm(m["wool"]), ((rx0 + rx1) / 2, (ry0 + ry1) / 2, PIT_FLOOR + 0.006), (rx1 - rx0, ry1 - ry0, 0.012), 0.004)
    for (cx, cy, sx, sy) in (((rx0 + rx1) / 2, ry0 + 0.1, rx1 - rx0 - 0.1, 0.04), ((rx0 + rx1) / 2, ry1 - 0.1, rx1 - rx0 - 0.1, 0.04), (rx0 + 0.1, (ry0 + ry1) / 2, 0.04, ry1 - ry0 - 0.1), (rx1 - 0.1, (ry0 + ry1) / 2, 0.04, ry1 - ry0 - 0.1)):
        box(p.bm(m["linen"]), (cx, cy, PIT_FLOOR + 0.0125), (sx, sy, 0.002), 0.0)
    # Floor cushions of ochre knit: the first under Sirui's feet, its top at the seated feet.
    for k, (cx, cy) in enumerate(FLOOR_CUSHIONS):
        top = FEET_Z - PIT_FLOOR if k == 0 else 0.16
        r = 0.27
        lathe(p.bm(m["knit"]), [(0.0, 0.0), (r - 0.03, 0.0), (r, 0.03), (r + 0.01, top * 0.5), (r, top - 0.03), (r - 0.04, top), (0.0, top)], (cx, cy, PIT_FLOOR + 0.012), 40)
    return treads


def build_lantern(p, m):
    """The tall paper floor lantern at the south run's sea end (warm-practicals.mjs "lounge")."""
    lx, ly = LANTERN
    z0 = PIT_FLOOR
    box(p.bm(m["smoked"]), (lx, ly, z0 + 0.015), (0.26, 0.26, 0.03), 0.008)
    cylinder(p.bm(m["smoked"]), (lx, ly, z0 + 0.03), (lx, ly, z0 + 1.36), 0.012, 10)
    lathe(p.bm(m["paper"]), [(0.0, 0.0), (0.12, 0.0), (0.2, 0.07), (0.23, 0.18), (0.21, 0.3), (0.13, 0.38), (0.0, 0.39)], (lx, ly, z0 + 1.22), 40)
    for k in range(5):
        z = z0 + 1.22 + 0.06 + k * 0.065
        r = (0.2, 0.225, 0.228, 0.215, 0.18)[k]
        cylinder(p.bm(m["smoked"]), (lx, ly, z), (lx, ly, z + 0.002), r + 0.003, 40)
    return (lx, ly, z0 + 1.42)


def build_tv_wall(p, m):
    """The TV on the north wall over a floating smoked-oak credenza with fluted doors, the records'
    turntable and two brass-capped speakers."""
    (w, h), cy, cz, face = TV["size"], TV["center_y"], TV["center_z"], TV["face_x"]
    black, tv, smoked, oak = p.bm(m["black"]), p.bm(m["tv"]), p.bm(m["smoked"]), p.bm(m["oak"])
    box(black, (face + 0.014, cy, cz), (0.028, w + 0.01, h + 0.01), 0.004)
    box(tv, (face - 0.0015, cy, cz), (0.002, w - 0.004, h - 0.004), 0.0)
    (kx0, kx1), (ky0, ky1), (kz0, kz1) = CREDENZA["x"], CREDENZA["y"], CREDENZA["z"]
    box(smoked, ((kx0 + kx1) / 2, (ky0 + ky1) / 2, (kz0 + kz1) / 2), (kx1 - kx0, ky1 - ky0, kz1 - kz0), 0.012)
    n = 30
    for k in range(n):
        y = ky0 + 0.04 + k * (ky1 - ky0 - 0.08) / (n - 1)
        box(smoked, (kx0 - 0.004, y, (kz0 + kz1) / 2), (0.012, 0.028, kz1 - kz0 - 0.06), 0.004)
    box(oak, ((kx0 + kx1) / 2, (ky0 + ky1) / 2, kz1 + 0.012), (kx1 - kx0 + 0.02, ky1 - ky0 + 0.02, 0.024), 0.008)
    top = kz1 + 0.024
    rx, ry = (kx0 + kx1) / 2, ky1 - 0.3
    box(oak, (rx, ry, top + 0.04), (0.33, 0.43, 0.08), 0.01)
    cylinder(p.bm(m["ink"]), (rx, ry - 0.02, top + 0.08), (rx, ry - 0.02, top + 0.095), 0.15, 40)
    cylinder(p.bm(m["terra"]), (rx, ry - 0.02, top + 0.095), (rx, ry - 0.02, top + 0.098), 0.05, 24)
    cylinder(p.bm(m["nickel"]), (rx - 0.12, ry + 0.16, top + 0.11), (rx - 0.04, ry + 0.02, top + 0.11), 0.004, 8)
    for k, mat in enumerate(("sleeve", "indigo", "sleeve", "ochre", "terra")):
        box(p.bm(m[mat]), (rx + 0.02, ky0 + 0.12 + k * 0.022, top + 0.155), (0.31, 0.006, 0.31), 0.0, 0.0, pitch=-0.12)
    for y in (ky0 + 0.45, ky1 - 0.62):
        box(oak, (rx, y, top + 0.17), (0.16, 0.14, 0.34), 0.02)
        cylinder(p.bm(m["brass"]), (rx - 0.081, y, top + 0.24), (rx - 0.083, y, top + 0.24), 0.04, 20)


def build_reading_corner(p, m):
    """Around the Eames: a jute rug under chair and ottoman, and a brass arc reading lamp behind it."""
    ex, ey = EAMES
    box(p.bm(m["jute"]), (ex, ey, 0.006), (1.25, 1.95, 0.012), 0.004)
    lx, ly = READING_LAMP
    brass = p.bm(m["brass"])
    lathe(p.bm(m["travertine"]), [(0.0, 0.0), (0.16, 0.0), (0.16, 0.035), (0.13, 0.05), (0.0, 0.05)], (lx, ly, 0.0), 32)
    arc = [Vector((lx, ly, 0.05))] + [Vector((lx - 0.42 * math.sin(t * math.pi / 2), ly + 0.55 * math.sin(t * math.pi / 2), 0.05 + 1.62 * math.sin(t * math.pi * 0.62) + 0.1 * t)) for t in (k / 10 for k in range(1, 11))]
    for a, b in zip(arc, arc[1:]):
        cylinder(brass, tuple(a), tuple(b), 0.011, 10)
    head = arc[-1]
    lathe(brass, [(0.0, 0.0), (0.03, 0.0), (0.11, -0.12), (0.105, -0.122), (0.025, -0.006), (0.0, 0.0)], (head.x, head.y, head.z), 32)
    lathe(p.bm(m["paper"]), [(0.0, -0.11), (0.09, -0.11), (0.0, -0.1)], (head.x, head.y, head.z), 24)
    return (head.x, head.y, head.z - 0.12)


def flue_heights(scene, x, y):
    """The vault's underside and the clifftop above (x, y): ray casts against the lift-away ceiling."""
    roof = bpy.data.objects["core_liftaway_cave_ceiling"]
    inv = roof.matrix_world.inverted()
    origin = inv @ Vector((x, y, 2.4))
    direction = (inv.to_3x3() @ Vector((0, 0, 1))).normalized()
    hit, inside, _, _ = roof.ray_cast(origin, direction)
    assert hit, "no vault over the fireplace"
    vault = (roof.matrix_world @ inside).z
    exit_hit, outside, _, _ = roof.ray_cast(inside + direction * 0.01, direction)
    assert exit_hit, "no clifftop over the fireplace"
    top = (roof.matrix_world @ outside).z
    # The clifftop is the highest ground at the flue: probe a little around it for the cap's base.
    return vault, top


def build_flue(p, m, vault):
    """The flue in the room, from the top of the fireplace's own length into the vault, with a bronze
    collar where it meets the plaster."""
    fx, fy = FIREPLACE
    start = FLUE_START + FLUE_ITEM
    steel = p.bm(m["steel"])
    cylinder(steel, (fx, fy, start), (fx, fy, vault + 0.06), FLUE_RADIUS, 32)
    # Two slim joint bands, and the ceiling collar.
    for z in (start + (vault - start) * 0.34, start + (vault - start) * 0.68):
        cylinder(p.bm(m["bronze"]), (fx, fy, z - 0.008), (fx, fy, z + 0.008), FLUE_RADIUS + 0.004, 32)
    cylinder(p.bm(m["bronze"]), (fx, fy, vault - 0.03), (fx, fy, vault + 0.01), FLUE_RADIUS + 0.06, 40)


def build_cap(m, vault, top):
    """The flue through the rock and its clifftop cap: a cluster of sandstone boulders around the
    outlet under a split capstone, with scrub at its feet. Lifted away with the roof in cut-away
    views (caveRoof)."""
    fx, fy = FIREPLACE
    sandstone = bpy.data.materials.get("golden coastal sandstone")
    p = Parts("core_fireplace_cap")
    cylinder(p.bm(m["steel"]), (fx, fy, vault + 0.06), (fx, fy, top + 0.35), FLUE_RADIUS, 24)
    rng = random.Random(7)

    def boulder(center, radii, seed):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
        r2 = random.Random(seed)
        lumps = [(Vector((r2.uniform(-1, 1), r2.uniform(-1, 1), r2.uniform(-1, 1))).normalized(), r2.uniform(0.05, 0.14)) for _ in range(9)]
        for v in bm.verts:
            n = v.co.normalized()
            bump = sum(a * max(0.0, n.dot(d)) ** 3 for d, a in lumps)
            v.co = Vector((n.x * radii[0], n.y * radii[1], max(n.z, -0.35) * radii[2])) * (1 + bump)
        bmesh.ops.translate(bm, verts=list(bm.verts), vec=center)
        data = bpy.data.meshes.new("tmp")
        bm.to_mesh(data)
        bm.free()
        p.bm(sandstone).from_mesh(data)
        bpy.data.meshes.remove(data)

    # Four boulders lean in around the outlet; a flat capstone rests on them 22 cm over the flue's
    # end, so the smoke leaves sideways through the gaps between stones, never as a visible pipe.
    for k in range(4):
        a = k * math.pi / 2 + 0.4 + rng.uniform(-0.2, 0.2)
        d = 0.36 + rng.uniform(-0.04, 0.05)
        boulder((fx + d * math.cos(a), fy + d * math.sin(a), top + 0.08), (0.3 + rng.uniform(0, 0.08), 0.26 + rng.uniform(0, 0.06), 0.36 + rng.uniform(0, 0.08)), 11 + k)
    boulder((fx + 0.05, fy - 0.03, top + 0.62), (0.52, 0.44, 0.13), 31)
    # Two low stones half buried in the ground nearby, as the bluff's talus lies.
    for k, (dx, dy, s) in enumerate(((0.9, 0.35, 0.22), (-0.75, -0.6, 0.17))):
        boulder((fx + dx, fy + dy, top - 0.04), (s * 1.3, s, s * 0.6), 41 + k)
    objects = p.finish()
    for obj in objects:
        obj["caveRoof"] = True
    return objects, top + 0.35


def placeholder_fireplace(m):
    """A suspended bowl and hood with the first 30 cm of flue, in plain blackened steel."""
    ph = anchors.Placeholder("lounge", "living-fireplace")
    fx, fy = FIREPLACE
    steel = ph.bm(m["steel"])
    bowl_z = PIT_FLOOR + 0.75
    lathe(steel, [(0.0, -0.2), (0.25, -0.18), (0.4, -0.08), (0.45, 0.06), (0.43, 0.08), (0.36, -0.02), (0.0, -0.05)], (fx, fy, bowl_z), 48)
    lathe(steel, [(0.0, 0.0), (0.3, 0.0), (0.34, 0.06), (0.22, 0.24), (FLUE_RADIUS, 0.4), (FLUE_RADIUS, 0.42), (0.0, 0.42)], (fx, fy, FLUE_START - 0.42), 48)
    cylinder(steel, (fx, fy, FLUE_START), (fx, fy, FLUE_START + FLUE_ITEM), FLUE_RADIUS, 32)
    # The bowl hangs from three slim rods to the hood.
    for k in range(3):
        a = k * math.tau / 3
        cylinder(steel, (fx + 0.3 * math.cos(a), fy + 0.3 * math.sin(a), bowl_z + 0.06), (fx + 0.2 * math.cos(a), fy + 0.2 * math.sin(a), FLUE_START - 0.4), 0.006, 8)
    return ph.finish()


def placeholder_eames(m):
    """A chair and ottoman in walnut and cognac leather within the item's footprint, facing the sea."""
    ph = anchors.Placeholder("lounge", "living-eames-lounge")
    ex, ey = EAMES
    leather, walnut, black = ph.bm(m["leather"]), ph.bm(bpy.data.materials.get("dining walnut wood") or m["smoked"]), ph.bm(m["black"])
    cy = ey - 1.55 / 2 + 0.42
    box(walnut, (ex, cy, 0.3), (0.72, 0.62, 0.1), 0.04)
    box(leather, (ex, cy + 0.02, 0.4), (0.66, 0.56, 0.12), 0.05)
    box(walnut, (ex, cy - 0.3, 0.6), (0.7, 0.12, 0.5), 0.05, 0.0, pitch=-0.35)
    box(leather, (ex, cy - 0.24, 0.62), (0.62, 0.1, 0.44), 0.05, 0.0, pitch=-0.35)
    for side in (-1, 1):
        box(leather, (ex + side * 0.36, cy + 0.02, 0.5), (0.12, 0.44, 0.1), 0.04)
    cylinder(black, (ex, cy, 0.0), (ex, cy, 0.25), 0.03, 12)
    oy = ey + 1.55 / 2 - 0.28
    box(walnut, (ex, oy, 0.32), (0.62, 0.5, 0.08), 0.03)
    box(leather, (ex, oy, 0.39), (0.58, 0.46, 0.1), 0.04)
    cylinder(black, (ex, oy, 0.0), (ex, oy, 0.28), 0.025, 12)
    for k in range(5):
        a = k * math.tau / 5
        cylinder(black, (ex, cy, 0.04), (ex + 0.32 * math.cos(a), cy + 0.32 * math.sin(a), 0.02), 0.012, 8)
    for k in range(4):
        a = k * math.tau / 4 + math.pi / 4
        cylinder(black, (ex, oy, 0.04), (ex + 0.24 * math.cos(a), oy + 0.24 * math.sin(a), 0.02), 0.011, 8)
    return ph.finish()


def furniture_anchors():
    fx, fy = FIREPLACE
    return [
        anchors.anchor_entry("living-fireplace", "floating-fireplace", "lounge", (fx, fy, PIT_FLOOR), facing_blender=(0, 1)),
        anchors.anchor_entry("living-eames-lounge", "eames-lounge", "lounge", (EAMES[0], EAMES[1], 0.0), facing_blender=(0, 1)),
    ]


def build_living(scene):
    """Replace the living room's furniture with the pit, the TV wall and the reading corner, and build the
    fireplace's flue and clifftop cap. Returns objects, placeholders, supports and a report."""
    # The former lounge__ batches also owned the original leaves and their pots. Retain those
    # site-owned plants independently before removing the old furniture/material batches.
    ensure_living_plants(scene)
    removed = 0
    for obj in [o for o in scene.objects if o.name.startswith(("lounge_living", "lounge__", "lounge_ottoman", "lounge_placeholder_", "core_fireplace_cap"))]:
        bpy.data.objects.remove(obj, do_unlink=True)
        removed += 1
    m = living_materials()
    p = Parts("lounge")
    treads = build_pit(p, m)
    lantern = build_lantern(p, m)
    build_tv_wall(p, m)
    lamp = build_reading_corner(p, m)
    vault, top = flue_heights(scene, *FIREPLACE)
    build_flue(p, m, vault)
    objects = p.finish()
    cap, flue_top = build_cap(m, vault, top)
    placeholders = [placeholder_fireplace(m), placeholder_eames(m)]
    supports = [sunken.support("pit-floor", (PIT["x"][0], PIT["x"][1], PIT["y"][0], PIT["y"][1]), PIT_FLOOR)]
    supports += [sunken.support(f"pit-tread-{k + 1}", rect, z) for k, (rect, z) in enumerate(treads)]
    return objects + cap, placeholders, supports, {"removed": removed, "lantern": lantern, "readingLamp": lamp, "vault": vault, "clifftop": top, "flueTop": flue_top}
