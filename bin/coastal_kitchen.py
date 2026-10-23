"""The kitchen, breakfast nook and dining room (Sirui, 2026-10-16, then 2026-10-20: "a more properly
siightly large dinning table. the currrent small area could be designed to be a breakfast nook ...
sunked-in ... where is fancy transparent glass fridge in my kitchen. also why is my kitken weirdly
sepertate by a wall. also give me better stovetap with a water tap thing that you can rotate to fill
pot and really fancy italian setup that match house vibe").

One open kitchen. The freestanding wall that carried the capybara print is gone, so the island, the
coffee bar and the cooking bay read as one room from the living floor. The run along the south wall
keeps its light oak and milky marble: at the front the coffee bar, exactly where the breakfast
choreography reaches for the machine, grinder, tamper and cup (manifest equipment.coffee), the sink
and the glazed pots on open shelves. Past the plaster fin that carries the gallery, the cooking bay
under the gallery holds the Italian range (scene-furniture's italian-range, its range-hood above and
its pot-filler on a honed travertine backsplash), a marble landing, the glass refrigerator column
(glass-fridge, lit from inside, facing the living floor across the dining room) and a tall oak pantry.
The island is longer, travertine on fluted oak.

The breakfast nook. The round-table corner by the glass is sunk 42 cm: an L of built-in banquette in a
rust boucle against the cave wall and along its inland side, around the round travertine table (its
nickel foot ring now at the seated feet, 16.5 cm above the nook floor), under the same 74 cm washi
lantern. Two oak treads lead down from the kitchen floor along the open corner. The capybara print
hangs on the cave wall above the banquette, washed by its brass picture light (the manifest's wallArt
and the "kitchen" warm practical). Sirui takes every meal here, facing the sea.

The dining room. Under the gallery behind the kitchen, a table for six (scene-furniture's dining-table
and six dining-chair anchors, three a side) on an oatmeal wool rug, under two saucer pendants hung
from the gallery soffit, its own light.

Every designed piece is an anchor with a plain placeholder (coastal_anchors.py). House coordinates:
metres, Z up, +Y toward the sea, +X north.
"""

import math
import bmesh
import bpy
from mathutils import Matrix, Vector

import coastal_anchors as anchors
import coastal_sunken as sunken
from coastal_office import Parts, box, cylinder, lathe, rooted_leaf, _mat

WORKTOP = 0.915  # the coffee machine, grinder and tamper stand on it (equipment.coffee)
RUN = {"x": (-4.72, -4.04), "y": (-4.62, 2.2)}
WALL_X = -4.72  # the run's back, where the wall panels and backsplashes stand
# The plastered fin that carries the gallery's front edge at the south wall (core shell, mirrored by
# the living room's at the north wall): a crescent from the wall at y -1.44 out to its tip at
# (-4.15, -0.62). The run parts around it, ending 1 cm clear of its plaster on either side.
GALLERY_FIN = {"y": (-1.452, -0.598)}
SOFFIT = 2.36  # underside of the gallery floor, back to the plaster arch along its edge (y -1.50)

# The cooking bay, wall to fin: pantry, glass refrigerator, marble landing, Italian range.
RANGE = {"center": (-4.37, -2.06), "size": (1.2, 0.70, 0.92)}  # width along y, depth along x
HOOD_BOTTOM = RANGE["size"][2] + 0.75  # 75 cm over the cooktop
POT_FILLER = {"wall": (WALL_X + 0.02, RANGE["center"][1]), "height": 1.45}
LANDING = (-3.26, -2.66)  # y range of the marble landing between the refrigerator and the range
FRIDGE = {"center": (-4.37, -3.64), "size": (0.76, 0.70, 2.13)}
PANTRY = (-4.62, -4.02)  # y range of the tall oak pantry

ISLAND = {"x": (-2.95, -1.95), "y": (-0.40, 1.90), "top": 0.975}

# The breakfast nook: sunk NOOK_DEPTH below the kitchen floor in the corner by the glass.
NOOK = {"x": (-4.95, sunken.seam(-2.80)), "y": (2.42, 4.36)}  # the north edge on a board seam
NOOK_DEPTH = 0.42
NOOK_FLOOR = -NOOK_DEPTH
BANQUETTE_SEAT = 0.46  # above the nook floor
SOUTH_BANQUETTE = {"x": (-4.95, -4.33), "y": (2.42, 3.95)}
INLAND_BANQUETTE = {"x": (-4.95, -3.60), "y": (2.42, 3.04)}
TABLE = {"center": (-3.92, 3.50), "radius": 0.5, "top": NOOK_FLOOR + 0.74}
# Sirui's place: the inland banquette facing the sea. The seated clips sit 51.5 cm over the actor and
# rest the feet 22 cm over it, so the actor stands 5.5 cm below the seat's 46 cm and the feet land on
# the table's foot ring.
SEAT = (-3.95, 2.74)
SEAT_ACTOR_Z = NOOK_FLOOR + BANQUETTE_SEAT - 0.515
FOOT_RING_Z = SEAT_ACTOR_Z + 0.22
PENDANT = (TABLE["center"][0], TABLE["center"][1], TABLE["top"] + 0.80 + 0.30)  # lantern centre
# The capybara print on the cave wall above the south banquette, and its picture light.
# The cave wall there stands at x -5.19 (plumb to within 1 cm over the print's height); the manifest
# places the print on the wall surface at PRINT["center"], facing +x.
PRINT = {"wall_x": -5.19, "center": (-5.185, 3.10, 1.42), "size": 0.88}
PICTURE_LIGHT = (-5.05, 3.10, 1.98)
# Treads into the nook: along its open north edge and along the open part of its inland side.
NOOK_TREADS = {"north": (sunken.seam(-3.07), sunken.seam(-2.80), 2.42, 4.36), "inland": (-3.54, sunken.seam(-3.07), 2.42, 2.72)}
COFFEE_WAY = (-3.15, 2.30)  # the top of the treads, where the coffee walk leaves the nook
EGRESS = (-3.45, 1.40)

# The dining room under the gallery: a table for six along x, three chairs a side.
DINING = {"center": (-1.85, -3.05), "table": (2.2, 1.0, 0.74)}
DINING_CHAIR_X = (-2.60, -1.85, -1.10)
DINING_CHAIR_Y = {"inland": -3.87, "sea": -2.23}
DINING_PENDANTS = ((-2.40, -3.05), (-1.30, -3.05))
DINING_LIGHT = (-1.85, -3.05, 1.55)

# Soffit downlights over the cooking bay: the range and the landing beside the refrigerator.
DOWNLIGHTS = ((-3.86, RANGE["center"][1]), (-3.86, (LANDING[0] + LANDING[1]) / 2))
SHELF_LIGHT = {"y": (-0.15, 2.05), "x": -4.47, "z": 1.725}


def kitchen_materials():
    get = bpy.data.materials.get
    return {
        "oak": get("pale oak"),
        "smoked": get("honey ash"),
        "marble": get("milky veined marble"),
        "travertine": get("honed travertine") or _mat("honed travertine", (0.78, 0.69, 0.56), 0.62),
        "plaster": get("chalk limestone"),
        "stone": get("warm cut stone"),
        "nickel": get("polished nickel"),
        "brass": get("brushed brass"),
        "black": get("matte black device"),
        "enamel": get("espresso enamel"),
        "steel": get("satin appliance stainless"),
        "hopper": get("coffee hopper glass"),
        "beans": get("roasted coffee beans"),
        "porcelain": get("warm glazed porcelain"),
        "celadon": get("celadon glaze") or get("hand glazed celadon"),
        "tenmoku": get("tenmoku glaze"),
        "oatmeal": get("oatmeal glaze"),
        "terra": get("terracotta"),
        "indigo": get("indigo textile"),
        "linen": get("linen"),
        "wool": get("oatmeal wool textile") or _mat("oatmeal wool textile", (0.66, 0.6, 0.5), 0.96),
        "cord": get("woven jute"),
        "leaf": get("olive leaf"),
        "lemon": _mat("meyer lemon", (0.82, 0.62, 0.08), 0.45),
        "glass": _mat("induction black glass", (0.01, 0.011, 0.012), 0.08),
        "lantern": _mat("dining lantern paper", (0.93, 0.89, 0.8), 0.85, 0.0, (1.0, 0.78, 0.5), 1.0),
        "downlight": _mat("downlight diffuser", (0.9, 0.88, 0.84), 0.4, 0.0, (1.0, 0.86, 0.7), 1.0),
        "ink": get("charcoal"),
        # The banquette: a rust boucle, the house's terracotta pop in cloth (realism.mjs weaves it).
        "boucle": _mat("rust boucle textile", (0.42, 0.16, 0.075), 0.95),
        # Placeholder finishes for the designed pieces (the furniture runtime replaces them).
        "range enamel": _mat("range placeholder enamel", (0.78, 0.74, 0.66), 0.32),
        "fridge glass": _mat("fridge placeholder glass", (0.05, 0.06, 0.065), 0.08),
        "walnut": _mat("dining walnut wood", (0.16, 0.085, 0.045), 0.5),
    }


# The run ---------------------------------------------------------------------------------------

def build_run(p, m):
    """The south wall's cabinetry: the coffee and sink run at the front, the cooking bay behind the fin."""
    (x0, x1) = RUN["x"]
    oak, smoked, marble, nickel = p.bm(m["oak"]), p.bm(m["smoked"]), p.bm(m["marble"]), p.bm(m["nickel"])
    top = WORKTOP
    (gy0, gy1) = GALLERY_FIN["y"]
    y1 = RUN["y"][1]
    # Base cabinets: the landing between the refrigerator and the range, and the coffee and sink run.
    for a, b in (LANDING, (gy1, y1)):
        mid, length = (a + b) / 2, b - a
        box(smoked, ((x0 + x1) / 2 + 0.03, mid, 0.05), (x1 - x0 - 0.06, length, 0.1), 0.008)
        box(oak, ((x0 + x1) / 2 - 0.01, mid, 0.1 + (top - 0.04 - 0.1) / 2), (x1 - x0 - 0.04, length, top - 0.14), 0.01)
        box(marble, ((x0 + x1) / 2 - 0.02, mid, top - 0.02), (x1 - x0 + 0.04, length, 0.04), 0.008)
    # The front run's splashback up to the lower shelf; the landing's marble runs to the soffit.
    box(marble, (x0 + 0.015, (gy1 + y1) / 2, top + (1.62 - top) / 2), (0.03, y1 - gy1, 1.62 - top), 0.006)
    box(marble, (x0 + 0.015, (LANDING[0] + LANDING[1]) / 2, top + (SOFFIT - top) / 2), (0.03, LANDING[1] - LANDING[0], SOFFIT - top - 0.01), 0.006)
    # Slab fronts with vertical grain and finger-pull reveals: 60 cm doors along the front run, a pair
    # of deep drawers under the landing.
    edges = [gy1 + 0.02]
    while edges[-1] < y1 - 0.3:
        edges.append(min(edges[-1] + 0.6, y1 - 0.02))
    fronts = list(zip(edges, edges[1:])) + [(LANDING[0] + 0.01, LANDING[1] - 0.01)]
    for a, b in fronts:
        box(oak, (x1 + 0.009, (a + b) / 2, 0.11 + (top - 0.23) / 2), (0.018, b - a - 0.006, top - 0.23), 0.004)
        box(smoked, (x1 + 0.004, (a + b) / 2, top - 0.075), (0.01, b - a - 0.01, 0.02), 0.003)
    for z in (0.33, 0.62):
        box(smoked, (x1 + 0.004, (LANDING[0] + LANDING[1]) / 2, z), (0.01, LANDING[1] - LANDING[0] - 0.02, 0.012), 0.003)
    # The pantry: tall light-oak doors to the soffit, a nickel bar pull on each, a smoked plinth.
    pa, pb = PANTRY
    box(smoked, ((x0 + x1) / 2 + 0.03, (pa + pb) / 2, 0.05), (x1 - x0 - 0.06, pb - pa, 0.1), 0.008)
    box(oak, ((x0 + x1) / 2, (pa + pb) / 2, 0.1 + (SOFFIT - 0.11) / 2), (x1 - x0, pb - pa, SOFFIT - 0.11), 0.01)
    for a, b in ((pa, (pa + pb) / 2), ((pa + pb) / 2, pb)):
        box(oak, (x1 + 0.01, (a + b) / 2, 0.1 + (SOFFIT - 0.12) / 2), (0.02, b - a - 0.008, SOFFIT - 0.13), 0.005)
    for y in ((pa + pb) / 2 - 0.05, (pa + pb) / 2 + 0.05):
        cylinder(nickel, (x1 + 0.05, y, 0.85), (x1 + 0.05, y, 1.75), 0.011, 12)
    # Over the glass refrigerator, a light-oak cabinet to the soffit.
    (fx, fy), (fw, fd, fh) = FRIDGE["center"], FRIDGE["size"]
    box(oak, ((x0 + x1) / 2, fy, fh + 0.01 + (SOFFIT - fh - 0.02) / 2), (x1 - x0, fw, SOFFIT - fh - 0.02), 0.008)
    # The range's backsplash: one honed travertine slab from the worktop line to the soffit, with a
    # brushed-brass rail for the ladles, and the plaster fin's return beside it.
    (rx, ry), (rw, rd, rh) = RANGE["center"], RANGE["size"]
    box(p.bm(m["travertine"]), (x0 + 0.012, ry, 0.6 + (SOFFIT - 0.6) / 2), (0.024, rw + 0.16, SOFFIT - 0.61), 0.004)
    brass = p.bm(m["brass"])
    cylinder(brass, (x0 + 0.06, ry - rw / 2 + 0.08, 1.30), (x0 + 0.06, ry + rw / 2 - 0.08, 1.30), 0.007, 12)
    for y in (ry - rw / 2 + 0.08, ry + rw / 2 - 0.08):
        cylinder(brass, (x0 + 0.024, y, 1.30), (x0 + 0.066, y, 1.30), 0.006, 10)
    for k in range(5):
        y = ry - 0.32 + k * 0.16
        cylinder(brass, (x0 + 0.06, y, 1.29), (x0 + 0.06, y, 1.18), 0.003, 6)
        lathe(p.bm(m["nickel"]), [(0.0, 0.0), (0.035, 0.0), (0.03, 0.03), (0.0, 0.03)], (x0 + 0.06, y, 1.12), 16)
    # Sink: an undermount basin read as a dark well, and a polished-nickel swan tap.
    sy = 1.85
    box(p.bm(m["steel"]), ((x0 + x1) / 2 - 0.02, sy, top - 0.005), (0.4, 0.44, 0.012), 0.02)
    box(p.bm(m["ink"]), ((x0 + x1) / 2 - 0.02, sy, top - 0.0005), (0.36, 0.4, 0.002), 0.01)
    tap = [Vector((x0 + 0.1, sy, top)), Vector((x0 + 0.1, sy, top + 0.34)), Vector((x0 + 0.2, sy, top + 0.42)), Vector((x0 + 0.33, sy, top + 0.36)), Vector((x0 + 0.33, sy, top + 0.29))]
    for a, b in zip(tap, tap[1:]):
        cylinder(nickel, tuple(a), tuple(b), 0.014, 14)
    cylinder(nickel, (x0 + 0.1, sy + 0.1, top), (x0 + 0.1, sy + 0.1, top + 0.09), 0.012, 12)
    # Open light-oak shelves of glazed stoneware over the coffee bar and the sink.
    (sy0, sy1), sx = SHELF_LIGHT["y"], SHELF_LIGHT["x"]
    glazes = ("celadon", "oatmeal", "tenmoku", "terra", "celadon", "indigo", "oatmeal")
    for k, z in enumerate((1.75, 2.06)):
        box(oak, (sx, (sy0 + sy1) / 2, z), (0.5, sy1 - sy0, 0.04), 0.01)
        for j in range(7):
            y = sy0 + 0.18 + j * (sy1 - sy0 - 0.36) / 6
            mat = m[glazes[(j + 3 * k) % len(glazes)]]
            if (j + k) % 3 == 0:
                lathe(p.bm(mat), [(0.0, 0.0), (0.06, 0.0), (0.075, 0.08), (0.06, 0.15), (0.035, 0.18), (0.0, 0.18)], (sx + 0.04, y, z + 0.02), 24)
            elif (j + k) % 3 == 1:
                for n in range(3):
                    lathe(p.bm(mat), [(0.0, 0.0), (0.04, 0.0), (0.09, 0.035), (0.088, 0.04), (0.0, 0.03)], (sx + 0.03, y, z + 0.02 + n * 0.035), 24)
            else:
                lathe(p.bm(mat), [(0.0, 0.0), (0.045, 0.0), (0.05, 0.1), (0.047, 0.104), (0.0, 0.02)], (sx + 0.05, y, z + 0.02), 24)
    # The light line under the lower shelf (light-installations.mjs "shelf").
    box(p.bm(m["downlight"]), (sx + 0.15, (sy0 + sy1) / 2, SHELF_LIGHT["z"]), (0.02, sy1 - sy0 - 0.1, 0.006), 0.0)


def build_coffee_bar(p, m):
    """The espresso machine, grinder and tamper where equipment.coffee reaches for them: the group
    at (-3.96, 0.22, 1.21), the cup on the drip tray at (-3.91, 0.22, 1.065), the grinder's spout
    at (-4.01, 1.03, 1.12) and the tamper at (-4.12, 0.72, 1.02)."""
    nickel, black, steel = p.bm(m["nickel"]), p.bm(m["enamel"]), p.bm(m["steel"])
    top = WORKTOP
    box(nickel, (-4.25, 0.22, top + 0.24), (0.46, 0.56, 0.47), 0.03)
    box(black, (-4.25, 0.22, top + 0.48), (0.42, 0.52, 0.012), 0.004)
    for y in (0.0, 0.44):
        box(black, (-4.25, y, top + 0.505), (0.14, 0.06, 0.03), 0.008)
    cylinder(nickel, (-4.02, 0.22, 1.21), (-3.94, 0.22, 1.21), 0.055, 32)
    cylinder(steel, (-3.965, 0.22, 1.17), (-3.965, 0.22, 1.13), 0.045, 28)
    box(p.bm(m["smoked"]), (-3.85, 0.22, 1.145), (0.2, 0.032, 0.03), 0.012)
    for y in (0.0, 0.44):
        cylinder(black, (-4.02, y, 1.2), (-3.98, y, 1.2), 0.025, 18)
    cylinder(nickel, (-4.0, 0.43, 1.26), (-3.89, 0.47, 1.12), 0.008, 10)
    box(steel, (-3.94, 0.22, 0.967), (0.21, 0.5, 0.06), 0.012)
    for k in range(11):
        box(black, (-3.925, 0.0 + k * 0.044, 1.0), (0.15, 0.008, 0.003), 0.0)
    cylinder(p.bm(m["porcelain"]), (-3.91, 0.22, 1.0), (-3.91, 0.22, 1.019), 0.07, 28)
    box(black, (-4.24, 1.03, top + 0.165), (0.3, 0.3, 0.33), 0.05)
    cylinder(nickel, (-4.24, 1.03, top + 0.33), (-4.24, 1.03, top + 0.36), 0.12, 32)
    cylinder(p.bm(m["hopper"]), (-4.24, 1.03, top + 0.36), (-4.24, 1.03, top + 0.6), 0.14, 32, radius2=0.12)
    cylinder(p.bm(m["beans"]), (-4.24, 1.03, top + 0.37), (-4.24, 1.03, top + 0.5), 0.125, 32)
    box(nickel, (-4.03, 1.03, 1.12), (0.16, 0.08, 0.05), 0.015)
    cylinder(nickel, (-4.12, 0.72, top), (-4.12, 0.72, top + 0.03), 0.04, 24)
    lathe(p.bm(m["smoked"]), [(0.0, 0.0), (0.02, 0.0), (0.024, 0.05), (0.018, 0.08), (0.0, 0.09)], (-4.12, 0.72, top + 0.03), 16)
    box(black, (-4.3, 0.72, top + 0.06), (0.14, 0.14, 0.12), 0.02)


def build_island(p, m):
    (x0, x1), (y0, y1), top = ISLAND["x"], ISLAND["y"], ISLAND["top"]
    trav, oak, smoked = p.bm(m["travertine"]), p.bm(m["oak"]), p.bm(m["smoked"])
    box(smoked, ((x0 + x1) / 2, (y0 + y1) / 2, 0.05), (x1 - x0 - 0.1, y1 - y0 - 0.08, 0.1), 0.008)
    box(oak, ((x0 + x1) / 2, (y0 + y1) / 2, 0.1 + (top - 0.15) / 2), (x1 - x0 - 0.04, y1 - y0 - 0.1, top - 0.15), 0.01)
    box(trav, ((x0 + x1) / 2, (y0 + y1) / 2, top - 0.025), (x1 - x0 + 0.17, y1 - y0 + 0.21, 0.05), 0.01)
    for y in (y0 - 0.08, y1 + 0.08):
        box(trav, ((x0 + x1) / 2, y, (top - 0.05) / 2), (x1 - x0 + 0.17, 0.05, top - 0.05), 0.01)
    for side, x in ((1, x1 + 0.03), (-1, x0 - 0.03)):
        n = 36
        for k in range(n):
            y = y0 + 0.02 + k * (y1 - y0 - 0.04) / (n - 1)
            box(oak, (x, y, 0.1 + (top - 0.16) / 2), (0.03, 0.042, top - 0.16), 0.012)
    box(smoked, ((x0 + x1) / 2, (y0 + y1) / 2 - 0.35, top + 0.017), (0.38, 0.5, 0.034), 0.012)
    bx, by = (x0 + x1) / 2, (y0 + y1) / 2 + 0.45
    lathe(p.bm(m["oatmeal"]), [(0.0, 0.0), (0.07, 0.0), (0.16, 0.05), (0.19, 0.1), (0.185, 0.105), (0.15, 0.06), (0.0, 0.05)], (bx, by, top), 40)
    lemon = p.bm(m["lemon"])
    for k, (dx, dy, dz) in enumerate(((-0.06, 0.0, 0.0), (0.06, 0.03, 0.0), (0.0, -0.06, 0.0), (0.01, 0.0, 0.05))):
        sphere = bmesh.new()
        bmesh.ops.create_uvsphere(sphere, u_segments=16, v_segments=10, radius=0.042)
        for v in sphere.verts:
            v.co = Vector((v.co.x * 1.25, v.co.y, v.co.z))
        bmesh.ops.rotate(sphere, verts=list(sphere.verts), cent=(0, 0, 0), matrix=Matrix.Rotation(k * 1.1, 3, "Z"))
        bmesh.ops.translate(sphere, verts=list(sphere.verts), vec=(bx + dx, by + dy, top + 0.09 + dz))
        data = bpy.data.meshes.new("tmp")
        sphere.to_mesh(data)
        sphere.free()
        lemon.from_mesh(data)
        bpy.data.meshes.remove(data)


def build_downlights(p, m):
    """Downlights recessed in the gallery soffit over the cooking bay, in front of the run so the cook
    never stands in their own shadow."""
    for x, y in DOWNLIGHTS:
        cylinder(p.bm(m["nickel"]), (x, y, SOFFIT - 0.004), (x, y, SOFFIT + 0.002), 0.055, 32)
        cylinder(p.bm(m["downlight"]), (x, y, SOFFIT - 0.006), (x, y, SOFFIT - 0.004), 0.042, 32)


# The breakfast nook -------------------------------------------------------------------------------

def _cushion(bm, lo, hi, radius):
    size = tuple(hi[k] - lo[k] for k in range(3))
    center = tuple((hi[k] + lo[k]) / 2 for k in range(3))
    box(bm, center, size, radius, segments=4)


def build_nook(p, m):
    """The sunken corner: lined box, treads, banquette, round table, lantern, picture light, plant."""
    mats = {"stone": m["stone"], "plaster": m["plaster"], "oak": m["oak"], "smoked": m["smoked"]}
    region = (NOOK["x"][0], NOOK["x"][1], NOOK["y"][0], NOOK["y"][1])
    # The banquette's upstands line the south and inland sides and the treads carry their own risers,
    # so only the side under the glass is plastered.
    sunken.lined_box(p, mats, region, NOOK_DEPTH, open_sides=("north", "south", "inland"), nosing=False)
    treads = []
    for name, (x0, x1, y0, y1) in NOOK_TREADS.items():
        descend = "-x" if name == "north" else "+y"
        treads += sunken.steps(p, mats, x0, x1, y0, y1, 0.0, NOOK_FLOOR, 2, descend)
    # The banquette: a smoked-oak plinth with a toe recess, a seat cushion and a back cushion of rust
    # boucle against an oak-capped plaster upstand, which along the inland side is also the low wall
    # between the kitchen floor and the nook.
    boucle, oak, smoked, plaster = p.bm(m["boucle"]), p.bm(m["oak"]), p.bm(m["smoked"]), p.bm(m["plaster"])
    seat_top = NOOK_FLOOR + BANQUETTE_SEAT
    back_top = seat_top + 0.42
    for run, axis in ((SOUTH_BANQUETTE, "x"), (INLAND_BANQUETTE, "y")):
        (x0, x1), (y0, y1) = run["x"], run["y"]
        if axis == "x":  # against the cave wall, seat facing +x
            up, cushion, seat = (x0, x0 + 0.08), (x0 + 0.08, x0 + 0.2), (x0 + 0.2, x1)
            box(plaster, ((up[0] + up[1]) / 2, (y0 + y1) / 2, (NOOK_FLOOR + back_top + 0.04) / 2), (up[1] - up[0], y1 - y0, back_top + 0.04 - NOOK_FLOOR), 0.01)
            box(oak, ((up[0] + up[1]) / 2 - 0.08, (y0 + y1) / 2, back_top + 0.05), (0.26, y1 - y0 + 0.02, 0.028), 0.008)
            box(smoked, ((seat[0] + seat[1]) / 2 + 0.03, (y0 + y1) / 2, (NOOK_FLOOR + seat_top - 0.12) / 2), (seat[1] - seat[0] - 0.06, y1 - y0 - 0.04, seat_top - 0.12 - NOOK_FLOOR), 0.01)
            _cushion(boucle, (seat[0], y0 + 0.01, seat_top - 0.12), (seat[1], y1 - 0.01, seat_top), 0.05)
            _cushion(boucle, (cushion[0], y0 + 0.02, seat_top - 0.02), (cushion[1], y1 - 0.02, back_top), 0.06)
        else:  # along the inland side, seat facing +y (the sea)
            up, cushion, seat = (y0, y0 + 0.08), (y0 + 0.08, y0 + 0.2), (y0 + 0.2, y1)
            box(plaster, ((x0 + x1) / 2, (up[0] + up[1]) / 2, (NOOK_FLOOR + back_top + 0.04) / 2), (x1 - x0, up[1] - up[0], back_top + 0.04 - NOOK_FLOOR), 0.01)
            box(oak, ((x0 + x1) / 2, (up[0] + up[1]) / 2, back_top + 0.05), (x1 - x0 + 0.02, 0.12, 0.028), 0.008)
            box(smoked, ((x0 + x1) / 2, (seat[0] + seat[1]) / 2 + 0.03, (NOOK_FLOOR + seat_top - 0.12) / 2), (x1 - x0 - 0.04, seat[1] - seat[0] - 0.06, seat_top - 0.12 - NOOK_FLOOR), 0.01)
            # The inland run's seat starts past the south run's seat, so the corner reads as one L.
            sx0 = SOUTH_BANQUETTE["x"][0] + 0.2
            _cushion(boucle, (sx0 + 0.01, seat[0], seat_top - 0.12), (x1 - 0.01, seat[1], seat_top), 0.05)
            _cushion(boucle, (sx0 + 0.02, cushion[0], seat_top - 0.02), (x1 - 0.02, cushion[1], back_top), 0.06)
    # The end of the inland run: a light-oak return, the corner of the treads.
    x1 = INLAND_BANQUETTE["x"][1]
    (iy0, iy1) = INLAND_BANQUETTE["y"]
    box(oak, (x1 + 0.03, (iy0 + iy1) / 2, (NOOK_FLOOR + back_top + 0.04) / 2), (0.06, iy1 - iy0, back_top + 0.04 - NOOK_FLOOR), 0.02)
    # Toward the kitchen the inland upstand is joinery, not a wall: fluted light oak like the island's
    # sides, from the kitchen floor to the oak cap.
    ix0 = INLAND_BANQUETTE["x"][0]
    n = int((x1 - ix0) / 0.046)
    for k in range(n):
        x = ix0 + 0.03 + k * (x1 - ix0 - 0.04) / (n - 1)
        box(oak, (x, iy0 - 0.012, (back_top + 0.03) / 2), (0.042, 0.03, back_top + 0.03), 0.012)
    # Above the south banquette, a plaster ledge fills the gap to the curved cave wall: a window seat
    # sill for a book and a small pot.
    (sx0, sx1), (sy0, sy1) = SOUTH_BANQUETTE["x"], SOUTH_BANQUETTE["y"]
    box(oak, ((sx0 - 0.24 + sx0 + 0.08) / 2, (sy0 + sy1) / 2, back_top + 0.05), (0.32, sy1 - sy0, 0.03), 0.008)
    box(plaster, (sx0 - 0.12, (sy0 + sy1) / 2, (NOOK_FLOOR + back_top + 0.035) / 2), (0.24, sy1 - sy0, back_top + 0.035 - NOOK_FLOOR), 0.01)
    lathe(p.bm(m["celadon"]), [(0.0, 0.0), (0.05, 0.0), (0.06, 0.07), (0.045, 0.1), (0.0, 0.1)], (sx0 - 0.1, sy1 - 0.25, back_top + 0.065), 24)
    for k, mat in enumerate(("linen", "terra")):
        box(p.bm(m[mat]), (sx0 - 0.1, sy0 + 0.35, back_top + 0.075 + k * 0.026), (0.16, 0.22, 0.024), 0.003, 0.1 * k)
    # Lumbar cushions: indigo and ochre-terracotta against the rust.
    for mat, (x, y), turn, axis in (("indigo", (sx0 + 0.27, 3.55), 0.0, "x"), ("terra", (-4.25, INLAND_BANQUETTE["y"][0] + 0.27), 0.0, "y")):
        size = (0.14, 0.42, 0.32) if axis == "x" else (0.42, 0.14, 0.32)
        box(p.bm(m[mat]), (x, y, seat_top + 0.17), size, 0.06, turn, segments=3)
    build_table(p, m)
    # The lantern, the same 74 cm washi globe, hung 80 cm over the table from the vault.
    px, py, pz = PENDANT
    lathe(p.bm(m["lantern"]), [(0.0, -0.3), (0.12, -0.295), (0.3, -0.2), (0.37, 0.0), (0.3, 0.2), (0.12, 0.29), (0.0, 0.3)], (px, py, pz), 48)
    for k in range(9):
        z = pz - 0.24 + k * 0.06
        rr = math.sqrt(max(0.0, 0.37 ** 2 - (z - pz) ** 2 * 1.5)) + 0.003
        cylinder(p.bm(m["smoked"]), (px, py, z), (px, py, z + 0.0025), rr, 48)
    cylinder(p.bm(m["ink"]), (px, py, pz + 0.3), (px, py, 5.0), 0.0025, 6)
    cylinder(p.bm(m["brass"]), (px, py, pz + 0.3), (px, py, pz + 0.34), 0.02, 16)
    # The brass picture light over the capybara print (the runtime hangs the print at PRINT).
    lx, ly, lz = PICTURE_LIGHT
    brass = p.bm(m["brass"])
    box(brass, (PRINT["wall_x"] + 0.012, ly, lz - 0.05), (0.024, 0.08, 0.05), 0.008)
    cylinder(brass, (PRINT["wall_x"] + 0.02, ly, lz - 0.04), (lx, ly, lz), 0.008, 10)
    cylinder(brass, (lx, ly - 0.26, lz), (lx, ly + 0.26, lz), 0.022, 20)
    # An olive in a terracotta pot on the nook floor, in the corner by the glass.
    ox, oy, oz = -4.72, 4.14, NOOK_FLOOR
    lathe(p.bm(m["terra"]), [(0.0, 0.0), (0.15, 0.0), (0.19, 0.34), (0.2, 0.38), (0.0, 0.36)], (ox, oy, oz), 32)
    stem, leaves = p.bm(m["smoked"]), p.bm(m["leaf"])
    foot, crown = Vector((ox, oy, oz + 0.36)), Vector((ox + 0.04, oy - 0.03, oz + 1.5))
    cylinder(stem, tuple(foot), tuple(crown), 0.016, 8)
    for k in range(40):
        z = oz + 0.95 + (k % 13) * 0.04
        a = k * 2.39996
        axis_point = foot.lerp(crown, (z - foot.z) / (crown.z - foot.z))
        root = axis_point + Vector((math.cos(a), math.sin(a), 0.0)) * 0.02
        tip = root + Vector((0.16 * math.cos(a), 0.16 * math.sin(a), 0.05 + 0.03 * math.sin(k)))
        rooted_leaf(stem, leaves, axis_point, root, tip, 0.021)
    return treads


def build_table(p, m):
    """The round honed-travertine table on a fluted oak column, with its nickel foot ring at the seated
    feet (FOOT_RING_Z) on three spokes."""
    (cx, cy), r, top = TABLE["center"], TABLE["radius"], TABLE["top"]
    floor = NOOK_FLOOR
    trav, oak, nickel = p.bm(m["travertine"]), p.bm(m["oak"]), p.bm(m["nickel"])
    lathe(trav, [(0.0, top - 0.05), (r - 0.02, top - 0.05), (r, top - 0.03), (r, top - 0.012), (r - 0.012, top), (0.0, top)], (cx, cy, 0.0), 72)
    lathe(oak, [(0.0, 0.0), (0.32, 0.0), (0.32, 0.02), (0.27, 0.05), (0.15, 0.1), (0.0, 0.1)], (cx, cy, floor), 56)
    flutes = 18
    for k in range(flutes):
        a = k * math.tau / flutes
        x, y = cx + 0.12 * math.cos(a), cy + 0.12 * math.sin(a)
        cylinder(oak, (x, y, floor + 0.09), (x, y, top - 0.08), 0.024, 10)
    cylinder(oak, (cx, cy, floor + 0.09), (cx, cy, top - 0.08), 0.11, 32)
    lathe(oak, [(0.0, 0.0), (0.14, 0.0), (0.26, 0.03), (0.26, 0.04), (0.0, 0.04)], (cx, cy, top - 0.09), 48)
    ring_r, tube, segs = 0.25, 0.012, 48
    ring = bmesh.new()
    verts = []
    for k in range(segs):
        a = k * math.tau / segs
        center = Vector((cx + ring_r * math.cos(a), cy + ring_r * math.sin(a), FOOT_RING_Z - tube))
        out = Vector((math.cos(a), math.sin(a), 0))
        verts.append([ring.verts.new(center + (out * math.cos(b) + Vector((0, 0, 1)) * math.sin(b)) * tube) for b in (j * math.tau / 10 for j in range(10))])
    for k in range(segs):
        for j in range(10):
            ring.faces.new((verts[k][j], verts[(k + 1) % segs][j], verts[(k + 1) % segs][(j + 1) % 10], verts[k][(j + 1) % 10]))
    data = bpy.data.meshes.new("tmp")
    ring.to_mesh(data)
    ring.free()
    nickel.from_mesh(data)
    bpy.data.meshes.remove(data)
    for k in range(3):
        a = k * math.tau / 3 + 0.4
        cylinder(nickel, (cx + 0.12 * math.cos(a), cy + 0.12 * math.sin(a), FOOT_RING_Z - 0.012), (cx + ring_r * math.cos(a), cy + ring_r * math.sin(a), FOOT_RING_Z - 0.012), 0.008, 10)
    # Breakfast for one: a plate and a celadon carafe.
    lathe(p.bm(m["porcelain"]), [(0.0, 0.0), (0.1, 0.0), (0.14, 0.006), (0.15, 0.014), (0.145, 0.016), (0.0, 0.006)], (cx - 0.02, SEAT[1] + 0.55, top), 48)
    lathe(p.bm(m["celadon"]), [(0.0, 0.0), (0.06, 0.0), (0.07, 0.1), (0.035, 0.19), (0.04, 0.24), (0.0, 0.24)], (cx + 0.25, cy + 0.18, top), 28)


# The dining room ----------------------------------------------------------------------------------

def build_dining(p, m):
    """The room around the table for six: the rug and two saucer pendants (the table and chairs are
    anchors). Returns the pendant positions."""
    (cx, cy), (tl, tw, th) = DINING["center"], DINING["table"]
    box(p.bm(m["wool"]), (cx, cy, 0.006), (3.3, 2.75, 0.012), 0.004)
    for (x, y, sx, sy) in ((cx, cy - 1.32, 3.2, 0.04), (cx, cy + 1.32, 3.2, 0.04), (cx - 1.6, cy, 0.04, 2.65), (cx + 1.6, cy, 0.04, 2.65)):
        box(p.bm(m["linen"]), (x, y, 0.0125), (sx, sy, 0.002), 0.0)
    for (x, y) in DINING_PENDANTS:
        # A saucer pendant: a lens of warm washi on a light-oak rim, 48 cm across, 75 cm over the
        # table, on a nickel stem from a canopy in the soffit.
        z = th + 0.75 + 0.11
        lathe(p.bm(m["lantern"]), [(0.0, -0.11), (0.1, -0.105), (0.2, -0.07), (0.24, -0.01), (0.235, 0.02), (0.17, 0.07), (0.08, 0.1), (0.0, 0.105)], (x, y, z), 48)
        cylinder(p.bm(m["oak"]), (x, y, z - 0.012), (x, y, z + 0.012), 0.243, 48)
        cylinder(p.bm(m["nickel"]), (x, y, z + 0.1), (x, y, SOFFIT - 0.02), 0.006, 8)
        cylinder(p.bm(m["nickel"]), (x, y, SOFFIT - 0.02), (x, y, SOFFIT), 0.05, 24)
    return [(x, y, th + 0.75) for x, y in DINING_PENDANTS]


# Placeholders for the designed pieces ------------------------------------------------------------

def placeholder_range(m):
    ph = anchors.Placeholder("kitchen", "kitchen-range")
    (rx, ry), (rw, rd, rh) = RANGE["center"], RANGE["size"]
    front = rx + rd / 2
    box(ph.bm(m["range enamel"]), (rx, ry, 0.06 + (rh - 0.06) / 2), (rd, rw, rh - 0.06), 0.012)
    box(ph.bm(m["smoked"]), (rx + 0.03, ry, 0.03), (rd - 0.06, rw - 0.04, 0.06), 0.006)
    box(ph.bm(m["glass"]), (rx, ry, rh - 0.01), (rd - 0.02, rw - 0.02, 0.02), 0.004)
    for dx in (-0.16, 0.16):
        for dy in (-0.38, 0.0, 0.38):
            cylinder(ph.bm(m["ink"]), (rx + dx, ry + dy, rh), (rx + dx, ry + dy, rh + 0.012), 0.08, 24)
    for a, b in ((ry - rw / 2 + 0.04, ry - 0.01), (ry + 0.01, ry + rw / 2 - 0.04)):
        box(ph.bm(m["range enamel"]), (front + 0.012, (a + b) / 2, 0.42), (0.024, b - a, 0.56), 0.01)
        cylinder(ph.bm(m["brass"]), (front + 0.05, a + 0.06, 0.66), (front + 0.05, b - 0.06, 0.66), 0.009, 12)
    for k in range(7):
        cylinder(ph.bm(m["brass"]), (front, ry - 0.45 + k * 0.15, 0.82), (front + 0.035, ry - 0.45 + k * 0.15, 0.82), 0.02, 16)
    return ph.finish()


def placeholder_hood(m):
    ph = anchors.Placeholder("kitchen", "kitchen-range-hood")
    (rx, ry), (rw, rd, _) = RANGE["center"], RANGE["size"]
    hood = bmesh.new()
    rings = []
    x0 = WALL_X + 0.03
    for z, w, d in ((HOOD_BOTTOM, rw + 0.06, rd - 0.1), (HOOD_BOTTOM + 0.08, rw + 0.04, rd - 0.12), (SOFFIT - 0.02, rw * 0.62, 0.36)):
        rings.append([hood.verts.new((x0 + dx * d, ry + dy * w / 2, z)) for dx, dy in ((0, -1), (1, -1), (1, 1), (0, 1))])
    for a, b in zip(rings, rings[1:]):
        for k in range(4):
            hood.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    hood.faces.new(list(reversed(rings[0])))
    hood.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(hood, faces=list(hood.faces))
    bmesh.ops.bevel(hood, geom=[e for e in hood.edges if e.calc_face_angle(0) > 0.5], offset=0.025, segments=3, profile=0.5, affect="EDGES", clamp_overlap=True)
    data = bpy.data.meshes.new("tmp")
    hood.to_mesh(data)
    hood.free()
    ph.bm(m["plaster"]).from_mesh(data)
    bpy.data.meshes.remove(data)
    box(ph.bm(m["brass"]), (x0 + (rd - 0.1) / 2, ry, HOOD_BOTTOM + 0.04), (rd - 0.08, rw + 0.08, 0.05), 0.008)
    return ph.finish()


def placeholder_pot_filler(m):
    ph = anchors.Placeholder("kitchen", "kitchen-pot-filler")
    (wx, wy), z = POT_FILLER["wall"], POT_FILLER["height"]
    nickel = ph.bm(m["nickel"])
    cylinder(nickel, (wx, wy, z), (wx + 0.04, wy, z), 0.03, 20)
    cylinder(nickel, (wx + 0.04, wy, z), (wx + 0.04, wy + 0.24, z), 0.01, 12)
    cylinder(nickel, (wx + 0.04, wy + 0.24, z), (wx + 0.3, wy + 0.24, z), 0.009, 12)
    cylinder(nickel, (wx + 0.3, wy + 0.24, z), (wx + 0.3, wy + 0.24, z - 0.07), 0.008, 12)
    return ph.finish()


def placeholder_fridge(m):
    ph = anchors.Placeholder("kitchen", "kitchen-glass-fridge")
    (fx, fy), (fw, fd, fh) = FRIDGE["center"], FRIDGE["size"]
    steel = ph.bm(m["steel"])
    front = fx + fd / 2
    box(steel, (fx, fy, fh / 2), (fd, fw, fh), 0.01)
    box(ph.bm(m["fridge glass"]), (front + 0.006, fy, 0.12 + (fh - 0.18) / 2), (0.012, fw - 0.06, fh - 0.18), 0.004)
    cylinder(ph.bm(m["nickel"]), (front + 0.05, fy + fw / 2 - 0.06, 0.6), (front + 0.05, fy + fw / 2 - 0.06, 1.75), 0.011, 12)
    for k in range(5):
        box(ph.bm(m["downlight"]), (front - 0.02, fy, 0.35 + k * 0.36), (0.02, fw - 0.1, 0.008), 0.0)
    return ph.finish()


def placeholder_dining(m):
    """The table for six and its chairs, as plain walnut and oak shapes."""
    objects = []
    (cx, cy), (tl, tw, th) = DINING["center"], DINING["table"]
    ph = anchors.Placeholder("kitchen", "dining-table")
    box(ph.bm(m["walnut"]), (cx, cy, th - 0.02), (tl, tw, 0.04), 0.012)
    for x in (cx - tl / 2 + 0.25, cx + tl / 2 - 0.25):
        box(ph.bm(m["walnut"]), (x, cy, (th - 0.04) / 2), (0.06, tw - 0.2, th - 0.04), 0.01)
        box(ph.bm(m["walnut"]), (x, cy, 0.02), (0.12, tw - 0.1, 0.04), 0.01)
    box(ph.bm(m["walnut"]), (cx, cy, 0.16), (tl - 0.5, 0.05, 0.04), 0.01)
    objects.append(ph.finish())
    k = 1
    for side, y in DINING_CHAIR_Y.items():
        facing = 1 if side == "inland" else -1  # +y toward the sea
        for x in DINING_CHAIR_X:
            ph = anchors.Placeholder("kitchen", f"dining-chair-{k}")
            seat_y = y
            box(ph.bm(m["oak"]), (x, seat_y, 0.44), (0.46, 0.44, 0.03), 0.01)
            for dx in (-0.2, 0.2):
                for dy in (-0.18, 0.18):
                    cylinder(ph.bm(m["oak"]), (x + dx, seat_y + dy, 0.0), (x + dx, seat_y + dy, 0.43), 0.016, 10)
            back_y = seat_y - facing * 0.2
            for dx in (-0.2, 0.2):
                cylinder(ph.bm(m["oak"]), (x + dx, back_y, 0.43), (x + dx, back_y - facing * 0.03, 0.8), 0.015, 10)
            box(ph.bm(m["oak"]), (x, back_y - facing * 0.03, 0.74), (0.44, 0.03, 0.12), 0.012)
            objects.append(ph.finish())
            k += 1
    return objects


def furniture_anchors():
    """The kitchen's and dining room's anchors for the manifest."""
    (rx, ry) = RANGE["center"]
    (fx, fy) = FRIDGE["center"]
    (cx, cy) = DINING["center"]
    entries = [
        anchors.anchor_entry("kitchen-range", "italian-range", "kitchen", (rx, ry, 0.0), facing_blender=(1, 0)),
        anchors.anchor_entry("kitchen-range-hood", "range-hood", "kitchen", (rx, ry, 0.0), facing_blender=(1, 0)),
        anchors.anchor_entry("kitchen-pot-filler", "pot-filler", "kitchen", (POT_FILLER["wall"][0], POT_FILLER["wall"][1], 0.0), facing_blender=(1, 0)),
        anchors.anchor_entry("kitchen-glass-fridge", "glass-fridge", "kitchen", (fx, fy, 0.0), facing_blender=(1, 0)),
        # The table's length runs along its local x, here the house's x (yaw 0).
        anchors.anchor_entry("dining-table", "dining-table", "kitchen", (cx, cy, 0.0), yaw=0.0),
    ]
    k = 1
    for side, y in DINING_CHAIR_Y.items():
        facing = (0, 1) if side == "inland" else (0, -1)
        for x in DINING_CHAIR_X:
            entries.append(anchors.anchor_entry(f"dining-chair-{k}", "dining-chair", "kitchen", (x, y, 0.0), facing_blender=facing))
            k += 1
    return entries


def build_kitchen(scene):
    """Replace the kitchen's furniture (keeping the coffee cup props the routine carries), sink the
    breakfast nook and furnish the dining room. Returns objects, the walking supports and a report."""
    removed = 0
    for obj in [o for o in scene.objects if o.name.startswith("kitchen_") and not o.get("activityProp")]:
        bpy.data.objects.remove(obj, do_unlink=True)
        removed += 1
    m = kitchen_materials()
    p = Parts("kitchen")
    build_run(p, m)
    build_coffee_bar(p, m)
    build_island(p, m)
    build_downlights(p, m)
    treads = build_nook(p, m)
    pendants = build_dining(p, m)
    objects = p.finish()
    placeholders = [placeholder_range(m), placeholder_hood(m), placeholder_pot_filler(m), placeholder_fridge(m)] + placeholder_dining(m)
    supports = [sunken.support("nook-floor", (NOOK["x"][0], NOOK["x"][1], NOOK["y"][0], NOOK["y"][1]), NOOK_FLOOR)]
    supports += [sunken.support(f"nook-tread-{k + 1}", rect, z) for k, (rect, z) in enumerate(treads)]
    return objects, placeholders, supports, {"removed": removed, "pendants": pendants, "treads": len(treads)}
