"""The living room (Sirui, 2026-10-16): "nice cloudy sofa that is white and cozy, in a u shape with one
end longer near the window side facing a big tv, they should not block the view".

The middle and north bays of the ground floor become one living room. A white boucle cloud
sectional (RH Cloud proportions: plush 72 cm seats, about 80 cm overall, boucle slipcover) makes a
U whose two arms run parallel to the glass: the arm by the window is a long backless chaise, so it
never stands between the room and the Pacific, and the U opens north toward an 85-inch TV on a
plaster media wall that runs inland from the glass rather than across it. The kitchen's walk
along x = -1.56 stays clear behind the sofa; the gym passage and the reading nook (the old ocean
lounge, refitted) sit beyond the media wall. A travertine drum table, a low knitted pouf, indigo,
ochre and terracotta cushions and an oatmeal wool rug keep the palette to boucle, oak, stone and a
few colour pops. The records move to the media credenza with their own turntable.

The evening "Watching the Pacific" moves onto the sofa's inland arm, facing the sea: the drink and
lounge clips sit on a 51.5 cm seat with the feet on a 22 cm rest, so the plush cushion stands a
little proud of that (Sirui sinks into it), a lumbar pillow fills the deep seat behind him, and the
knitted pouf takes his feet. House coordinates: metres, Z up, +Y toward the sea, +X north.
"""

import math
import bmesh
import bpy
from mathutils import Matrix, Vector

from coastal_office import Parts, box, cylinder, lathe, _mat

# The U: the base runs along y on the south side; the inland arm and the window chaise run north.
BASE = {"x": (-1.0, 0.05), "y": (-0.05, 3.3)}
INLAND = {"x": (0.05, 1.25), "y": (-0.05, 0.95)}
CHAISE = {"x": (0.05, 1.8), "y": (2.25, 3.3)}
SEAT_TOP = 0.53
BACK_TOP = 0.84
ACTOR = (0.55, 0.55)  # on the inland arm, facing the sea (+Y)
POUF = (0.55, 1.2, 0.24)  # x, y, radius; its top is the clips' 22 cm footrest
TABLE = (1.3, 1.75, 0.36)
FIN = {"x": (2.6, 2.78), "y": (0.3, 2.9), "top": 2.2}
CREDENZA = {"x": (2.15, 2.6), "y": (0.45, 2.75), "top": 0.48}
TV = {"size": (1.885, 1.065), "center_y": 1.6, "center_z": 1.3, "face_x": 2.565}
LAMP = (-1.2, 3.55)
NOOK_CHAIR = (3.7, 2.35)
OLIVE = (4.35, 3.4)


def living_materials():
    get = bpy.data.materials.get
    return {
        "boucle": _mat("cloud boucle textile", (0.86, 0.845, 0.81), 0.95),
        "linen": get("linen"),
        "indigo": get("indigo textile"),
        "ochre": get("ochre textile"),
        "terra": get("terracotta"),
        "sage": get("sage textile"),
        "wool": _mat("oatmeal wool textile", (0.66, 0.6, 0.5), 0.96),
        "knit": _mat("ochre knit textile", (0.6, 0.38, 0.11), 0.95),
        "travertine": _mat("honed travertine", (0.78, 0.69, 0.56), 0.62),
        "plaster": get("chalk limestone"),
        "oak": get("pale oak"),
        "smoked": get("honey ash"),
        "nickel": get("polished nickel"),
        "brass": get("brushed brass"),
        "black": get("matte black device"),
        "tv": _mat("tv black glass", (0.006, 0.007, 0.009), 0.12),
        "paper": _mat("washi lantern paper", (0.92, 0.88, 0.78), 0.85, 0.0, (1.0, 0.8, 0.55), 0.6),
        "leaf": get("olive leaf"),
        "bark": get("olive bark wood") or _mat("olive bark wood", (0.3, 0.27, 0.22), 0.85),
        "sleeve": get("record sleeve card"),
        "ink": get("charcoal"),
        "celadon": get("celadon glaze"),
        "jute": get("woven jute"),
    }


def cushion(bm, lo, hi, radius):
    """A plush cushion: a box with every edge rounded deep, so it reads soft from any side."""
    size = tuple(hi[k] - lo[k] for k in range(3))
    center = tuple((hi[k] + lo[k]) / 2 for k in range(3))
    box(bm, center, size, radius, segments=4)


def build_sofa(p, m):
    boucle = p.bm(m["boucle"])
    (bx0, bx1), (by0, by1) = BASE["x"], BASE["y"]
    (ix0, ix1), (iy0, iy1) = INLAND["x"], INLAND["y"]
    (cx0, cx1), (cy0, cy1) = CHAISE["x"], CHAISE["y"]
    plinth_top = SEAT_TOP - 0.2
    # Upholstered plinths, set back 3 cm from the cushions' faces at the floor.
    for (x0, x1), (y0, y1) in ((BASE["x"], BASE["y"]), ((ix0, ix1), (iy0, iy1)), ((cx0, cx1), (cy0, cy1))):
        cushion(boucle, (x0 + 0.03, y0 + 0.03, 0.02), (x1 - 0.03, y1 - 0.03, plinth_top), 0.06)
    # Back cushions: along the base's south side and along the inland arm; the window chaise has none.
    back = 0.28
    for y0, y1 in ((by0, 1.05), (1.05, 2.2), (2.2, by1)):
        cushion(boucle, (bx0, y0 + 0.01, plinth_top - 0.02), (bx0 + back, y1 - 0.01, BACK_TOP), 0.11)
    for x0, x1 in ((bx0 + back - 0.04, 0.2), (0.2, ix1 - 0.2)):
        cushion(boucle, (x0 + 0.01, iy0, plinth_top - 0.02), (x1 - 0.01, iy0 + back, BACK_TOP), 0.11)
    # Seat cushions, puffed a little above the seat line.
    seats = (
        ((bx0 + back, iy0 + back), (bx1, 1.05)),
        ((bx0 + back, 1.05), (bx1, cy0)),
        ((bx0 + back, cy0), (bx1, cy1)),
        ((ix0, iy0 + back), (ix1 - 0.2, iy1)),
        ((cx0, cy0), (cx0 + 0.87, cy1)),
        ((cx0 + 0.87, cy0), (cx1, cy1)),
    )
    for (x0, y0), (x1, y1) in seats:
        cushion(boucle, (x0 + 0.008, y0 + 0.008, plinth_top - 0.01), (x1 - 0.008, y1 - 0.008, SEAT_TOP), 0.09)
    # A low, wide arm closing the inland arm's free end.
    cushion(boucle, (ix1 - 0.2, iy0, 0.02), (ix1, iy1, 0.64), 0.1)
    # Cushions: indigo and ochre against the base, terracotta on the chaise, and a linen lumbar
    # pillow filling the deep seat behind Sirui's back.
    for mat, (x, y), turn in (("indigo", (bx0 + back + 0.1, 0.5), 0.2), ("ochre", (bx0 + back + 0.1, 1.95), -0.15), ("indigo", (bx0 + back + 0.1, 2.75), 0.1)):
        box(p.bm(m[mat]), (x, y, SEAT_TOP + 0.21), (0.16, 0.46, 0.44), 0.07, turn, segments=3, pitch=0.0)
    box(p.bm(m["terra"]), (cx1 - 0.25, cy0 + 0.55, SEAT_TOP + 0.08), (0.42, 0.42, 0.16), 0.07, 0.5, segments=3)
    ax, ay = ACTOR
    box(p.bm(m["linen"]), (ax, iy0 + back + 0.08, SEAT_TOP + 0.2), (0.5, 0.16, 0.34), 0.07, 0.0, segments=3)
    # A chunky knitted throw folded over the chaise's end.
    knit = p.bm(m["knit"])
    box(knit, (cx1 - 0.18, (cy0 + cy1) / 2, SEAT_TOP + 0.02), (0.32, cy1 - cy0 - 0.06, 0.05), 0.02)
    box(knit, (cx1 + 0.012, (cy0 + cy1) / 2, SEAT_TOP - 0.16), (0.04, cy1 - cy0 - 0.08, 0.34), 0.018)


def build_tables(p, m):
    px, py, pr = POUF
    # The knitted pouf: its top at 22 cm, where the lounging feet rest.
    lathe(p.bm(m["knit"]), [(0.0, 0.0), (pr - 0.03, 0.0), (pr, 0.03), (pr + 0.01, 0.11), (pr, 0.19), (pr - 0.04, 0.22), (0.0, 0.22)], (px, py, 0.0), 40)
    tx, ty, tr = TABLE
    trav = p.bm(m["travertine"])
    lathe(trav, [(0.0, 0.0), (tr - 0.06, 0.0), (tr - 0.06, 0.02), (tr - 0.02, 0.05), (tr - 0.02, 0.32), (tr, 0.335), (tr, 0.36), (0.0, 0.36)], (tx, ty, 0.0), 56)
    # Books, a celadon bowl and a stem in a small vase.
    for k, mat in enumerate(("linen", "sage", "terra")):
        box(p.bm(m[mat]), (tx - 0.1, ty + 0.06, 0.36 + 0.016 + k * 0.03), (0.24 - k * 0.02, 0.18 - k * 0.01, 0.028), 0.004, 0.3 + k * 0.08)
    lathe(p.bm(m["celadon"]), [(0.0, 0.0), (0.05, 0.0), (0.1, 0.03), (0.12, 0.065), (0.115, 0.07), (0.085, 0.036), (0.0, 0.03)], (tx + 0.14, ty - 0.08, 0.36), 32)
    lathe(p.bm(m["ink"]), [(0.0, 0.0), (0.03, 0.0), (0.035, 0.07), (0.015, 0.1), (0.017, 0.12), (0.0, 0.12)], (tx + 0.12, ty + 0.17, 0.36), 20)
    cylinder(p.bm(m["smoked"]), (tx + 0.12, ty + 0.17, 0.47), (tx + 0.1, ty + 0.2, 0.68), 0.003, 6)
    leaves = p.bm(m["leaf"])
    for k in range(7):
        root = Vector((tx + 0.1 + 0.004 * k, ty + 0.2 - 0.003 * k, 0.5 + k * 0.025))
        tip = root + Vector((0.05 * math.cos(k * 2.4), 0.05 * math.sin(k * 2.4), 0.02))
        side = (tip - root).cross(Vector((0, 0, 1))).normalized() * 0.012
        mid = root.lerp(tip, 0.5)
        leaves.faces.new([leaves.verts.new(v) for v in (root, mid + side, tip, mid - side)])
    # The rug under the whole U, oatmeal wool with an inset border.
    box(p.bm(m["wool"]), (0.55, 1.65, 0.006), (3.55, 4.0, 0.012), 0.004)
    for (x, y, sx, sy) in ((0.55, -0.27, 3.45, 0.05), (0.55, 3.57, 3.45, 0.05), (-1.14, 1.65, 0.05, 3.84), (2.24, 1.65, 0.05, 3.84)):
        box(p.bm(m["linen"]), (x, y, 0.0125), (sx, sy, 0.002), 0.0)


def build_media_wall(p, m):
    """A plaster wall running inland from the glass with an 85-inch TV on a smoked-oak panel, and a
    floating credenza under it holding the turntable and records."""
    (fx0, fx1), (fy0, fy1), top = FIN["x"], FIN["y"], FIN["top"]
    box(p.bm(m["plaster"]), ((fx0 + fx1) / 2, (fy0 + fy1) / 2, top / 2), (fx1 - fx0, fy1 - fy0, top), 0.07, segments=4)
    (w, h), cy, cz, face = TV["size"], TV["center_y"], TV["center_z"], TV["face_x"]
    smoked = p.bm(m["smoked"])
    box(smoked, (fx0 - 0.01, cy, cz + 0.05), (0.02, w + 0.34, h + 0.62), 0.006)
    for k in range(13):
        y = cy - (w + 0.34) / 2 + 0.05 + k * (w + 0.24) / 12
        box(smoked, (fx0 - 0.023, y, cz + 0.05), (0.008, 0.022, h + 0.58), 0.003)
    black, tv = p.bm(m["black"]), p.bm(m["tv"])
    box(black, (face + 0.012, cy, cz), (0.026, w + 0.01, h + 0.01), 0.004)
    box(tv, (face - 0.0015, cy, cz), (0.002, w - 0.004, h - 0.004), 0.0)
    # Credenza: smoked oak on a recessed plinth, two fluted doors and a drawer run.
    (kx0, kx1), (ky0, ky1), ktop = CREDENZA["x"], CREDENZA["y"], CREDENZA["top"]
    box(p.bm(m["ink"]), ((kx0 + kx1) / 2 + 0.03, (ky0 + ky1) / 2, 0.05), (kx1 - kx0 - 0.06, ky1 - ky0 - 0.1, 0.1), 0.01)
    box(smoked, ((kx0 + kx1) / 2, (ky0 + ky1) / 2, 0.1 + (ktop - 0.1) / 2), (kx1 - kx0, ky1 - ky0, ktop - 0.1), 0.012)
    for k in range(34):
        y = ky0 + 0.04 + k * (ky1 - ky0 - 0.08) / 33
        box(smoked, (kx0 - 0.004, y, 0.12 + (ktop - 0.16) / 2), (0.012, 0.03, ktop - 0.2), 0.004)
    box(p.bm(m["oak"]), ((kx0 + kx1) / 2, (ky0 + ky1) / 2, ktop + 0.012), (kx1 - kx0 + 0.02, ky1 - ky0 + 0.02, 0.024), 0.008)
    top_z = ktop + 0.024
    # The living room's own record player: a light-oak plinth, platter and arm, and sleeves leaning.
    rx, ry = (kx0 + kx1) / 2, ky0 + 0.38
    box(p.bm(m["oak"]), (rx, ry, top_z + 0.04), (0.33, 0.43, 0.08), 0.01)
    cylinder(p.bm(m["ink"]), (rx, ry - 0.02, top_z + 0.08), (rx, ry - 0.02, top_z + 0.095), 0.15, 40)
    cylinder(p.bm(m["terra"]), (rx, ry - 0.02, top_z + 0.095), (rx, ry - 0.02, top_z + 0.098), 0.05, 24)
    cylinder(p.bm(m["nickel"]), (rx - 0.12, ry + 0.16, top_z + 0.11), (rx - 0.04, ry + 0.02, top_z + 0.11), 0.004, 8)
    for k, mat in enumerate(("sleeve", "indigo", "sleeve", "ochre", "terra", "sleeve")):
        y = ky1 - 0.5 + k * 0.022
        box(p.bm(m[mat]), (rx, y, top_z + 0.155), (0.31, 0.006, 0.31), 0.0, 0.0, pitch=-0.12)
    # Small brass-capped speakers either side of the TV.
    for y in (cy - w / 2 - 0.2, cy + w / 2 + 0.2):
        box(p.bm(m["oak"]), (rx, y, top_z + 0.17), (0.16, 0.14, 0.34), 0.02)
        cylinder(p.bm(m["brass"]), (rx - 0.081, y, top_z + 0.24), (rx - 0.083, y, top_z + 0.24), 0.04, 20)


def build_lamp(p, m):
    """A tall paper lantern on a slim smoked-oak stand at the sofa's sea-side corner."""
    lx, ly = LAMP
    box(p.bm(m["smoked"]), (lx, ly, 0.015), (0.26, 0.26, 0.03), 0.008)
    cylinder(p.bm(m["smoked"]), (lx, ly, 0.03), (lx, ly, 1.36), 0.012, 10)
    lathe(p.bm(m["paper"]), [(0.0, 0.0), (0.12, 0.0), (0.2, 0.07), (0.23, 0.18), (0.21, 0.3), (0.13, 0.38), (0.0, 0.39)], (lx, ly, 1.22), 40)
    for k in range(5):
        z = 1.22 + 0.06 + k * 0.065
        r = (0.2, 0.225, 0.228, 0.215, 0.18)[k]
        cylinder(p.bm(m["smoked"]), (lx, ly, z), (lx, ly, z + 0.002), r + 0.003, 40)
    return (lx, ly, 1.42)


def build_nook(p, m):
    """The reading nook beyond the media wall: an oak lounge chair and ottoman facing the sea, a side
    table and an olive tree, on a jute rug."""
    cx, cy = NOOK_CHAIR
    oak, smoked = p.bm(m["oak"]), p.bm(m["smoked"])
    box(p.bm(m["jute"]), (cx + 0.1, cy + 0.2, 0.006), (1.7, 2.0, 0.012), 0.004)
    # Frame: two sled sides, a low seat and a raked back, linen cushions with an indigo throw.
    for side in (-1, 1):
        x = cx + side * 0.37
        box(oak, (x, cy, 0.24), (0.05, 0.78, 0.05), 0.015)
        box(oak, (x, cy - 0.36, 0.12), (0.05, 0.05, 0.24), 0.015)
        box(oak, (x, cy + 0.33, 0.12), (0.05, 0.05, 0.24), 0.015)
        box(oak, (x, cy, 0.58), (0.06, 0.66, 0.04), 0.015)
    box(p.bm(m["linen"]), (cx, cy + 0.04, 0.33), (0.68, 0.66, 0.14), 0.05)
    box(p.bm(m["linen"]), (cx, cy - 0.3, 0.62), (0.66, 0.16, 0.56), 0.06, 0.0, pitch=0.25)
    box(p.bm(m["indigo"]), (cx + 0.18, cy - 0.12, 0.43), (0.36, 0.6, 0.03), 0.012, 0.15)
    box(p.bm(m["linen"]), (cx, cy + 0.72, 0.2), (0.56, 0.42, 0.14), 0.05)
    for dx in (-0.22, 0.22):
        for dy in (-0.15, 0.15):
            cylinder(smoked, (cx + dx, cy + 0.72 + dy, 0.0), (cx + dx, cy + 0.72 + dy, 0.13), 0.016, 10)
    # Side table with a book and a cup.
    sx, sy = cx - 0.62, cy - 0.05
    lathe(smoked, [(0.0, 0.0), (0.17, 0.0), (0.17, 0.02), (0.05, 0.03), (0.04, 0.48), (0.22, 0.49), (0.22, 0.52), (0.0, 0.52)], (sx, sy, 0.0), 40)
    box(p.bm(m["terra"]), (sx, sy, 0.535), (0.2, 0.14, 0.03), 0.004, 0.4)
    lathe(p.bm(m["celadon"]), [(0.0, 0.0), (0.035, 0.0), (0.04, 0.08), (0.036, 0.085), (0.0, 0.01)], (sx + 0.08, sy - 0.05, 0.52), 24)
    # An olive tree in a large stoneware pot.
    ox, oy = OLIVE
    lathe(p.bm(m["linen"]), [(0.0, 0.0), (0.22, 0.0), (0.27, 0.1), (0.28, 0.52), (0.25, 0.55), (0.0, 0.53)], (ox, oy, 0.0), 40)
    bark, leaves = p.bm(m["bark"]), p.bm(m["leaf"])
    trunk = [Vector((ox, oy, 0.5)), Vector((ox + 0.05, oy - 0.03, 1.1)), Vector((ox - 0.04, oy + 0.02, 1.55))]
    for a, b in zip(trunk, trunk[1:]):
        cylinder(bark, tuple(a), tuple(b), 0.035, 10)
    import random
    rng = random.Random(9)
    for k in range(8):
        base_point = trunk[1].lerp(trunk[2], rng.uniform(0.1, 1.0))
        direction = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0.3, 1.0))).normalized()
        end = base_point + direction * rng.uniform(0.35, 0.55)
        cylinder(bark, tuple(base_point), tuple(end), 0.012, 6)
        for j in range(22):
            root = base_point.lerp(end, 0.25 + 0.75 * j / 22) + Vector((rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1), rng.uniform(-0.06, 0.08)))
            a = rng.uniform(0, math.tau)
            tip = root + Vector((0.07 * math.cos(a), 0.07 * math.sin(a), rng.uniform(-0.03, 0.02)))
            side = (tip - root).cross(Vector((0, 0, 1))).normalized() * 0.011
            mid = root.lerp(tip, 0.5)
            leaves.faces.new([leaves.verts.new(v) for v in (root, mid + side, tip, mid - side)])


def build_living(scene):
    """Replace the old living and lounge furniture with the living room; returns objects and data."""
    removed = 0
    for obj in [o for o in scene.objects if o.name.startswith(("lounge_living", "lounge__", "lounge_ottoman"))]:
        bpy.data.objects.remove(obj, do_unlink=True)
        removed += 1
    m = living_materials()
    p = Parts("lounge")
    build_sofa(p, m)
    build_tables(p, m)
    build_media_wall(p, m)
    bulb = build_lamp(p, m)
    build_nook(p, m)
    return p.finish(), {"removed": removed, "lampBulb": bulb}
