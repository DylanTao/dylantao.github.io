"""The kitchen and dining room, renovated (Sirui, 2026-10-16): "the dining room should have nice
artistic dining table, and also nice hanging dining room light for soft ambient light and some
lighting embedded in ceiling for more normally need light ... also redec and improve the kitchen".

Kitchen. One run of light-oak cabinetry along the south wall, under a milky veined marble worktop
and splashback (the same marble as the office desk). The front of the run, by the island, is a
coffee bar: a polished-nickel espresso machine and its grinder exactly where the breakfast
choreography reaches for them (manifest equipment.coffee), the sink with a nickel swan tap, and
light-oak open shelves of glazed pots with a light line under the lower shelf. Behind the capybara
print's wall the run parts around the plaster fin that carries the gallery's edge, and beyond it
becomes a working kitchen under the gallery: a cooking bay framed by the fin and a tall
oak-panelled refrigerator, with the induction hob centred under a softly tapered plaster hood and
the oven below it, lit by two downlights recessed in the gallery's soffit. The island keeps its
footprint, now travertine with fluted oak sides and a bowl of lemons.

Dining. The refrigerator's old corner by the glass is the dining room's: a round honed-travertine
table on a fluted light-oak column, with a polished-nickel footrest ring at 22 cm (the seated
clips rest their feet there), four oak wishbone chairs with woven seats, and a 74 cm washi
lantern (Noguchi Akari 75D size) hung 80 cm over the table for the soft ambient light. A brass
picture light washes the capybara print. House coordinates: metres, Z up, +Y toward the sea.
"""

import math
import bmesh
import bpy
from mathutils import Matrix, Vector

from coastal_office import Parts, box, cylinder, lathe, rooted_leaf, _mat

WORKTOP = 0.915  # the coffee machine, grinder and tamper stand on it (equipment.coffee)
RUN = {"x": (-4.72, -4.04), "y": (-3.3, 2.2)}
# The plastered fin that carries the gallery's front edge at the south wall (core shell, mirrored by
# the living room's at the north wall): a crescent from the wall at y -1.44 out to its tip at
# (-4.15, -0.62). The run parts around it, ending 1 cm clear of its plaster on either side.
GALLERY_FIN = {"y": (-1.452, -0.598)}
PRINT_WALL = {"x": (-3.92, -2.0), "y": -0.32, "thickness": 0.16, "top": 2.15}
FRIDGE = (-3.3, -2.62)  # y range of the tall refrigerator column
HOB_Y = (FRIDGE[1] + GALLERY_FIN["y"][0]) / 2  # centred in the cooking bay between the refrigerator and the fin
ISLAND = {"x": (-2.85, -2.06), "y": (0.44, 2.08), "top": 0.975}
TABLE = {"center": (-3.6, 3.25), "radius": 0.625, "top": 0.825}
SEAT = (-3.6, 2.54)  # Sirui's chair: facing the sea, 9 cm behind the table's edge
PENDANT = (-3.6, 3.25, 1.93)  # the lantern's centre, its bottom 80 cm above the table
SOFFIT = 2.36  # underside of the gallery floor, back to the plaster arch along its edge (y -1.50)
# Over the cook's side of the run, clear of the arch: the refrigerator's doors and the hob.
DOWNLIGHTS = ((-3.86, -2.96), (-3.86, HOB_Y))
SHELF_LIGHT = {"y": (-0.15, 2.05), "x": -4.47, "z": 1.725}
PICTURE_LIGHT = (-3.15, -0.2, 1.92)


def kitchen_materials():
    get = bpy.data.materials.get
    return {
        "oak": get("pale oak"),
        "smoked": get("honey ash"),
        "marble": get("milky veined marble"),
        "travertine": get("honed travertine") or _mat("honed travertine", (0.78, 0.69, 0.56), 0.62),
        "plaster": get("chalk limestone"),
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
        "cord": get("woven jute"),
        "leaf": get("olive leaf"),
        "lemon": _mat("meyer lemon", (0.82, 0.62, 0.08), 0.45),
        "glass": _mat("induction black glass", (0.01, 0.011, 0.012), 0.08),
        "lantern": _mat("dining lantern paper", (0.93, 0.89, 0.8), 0.85, 0.0, (1.0, 0.78, 0.5), 1.0),
        "downlight": _mat("downlight diffuser", (0.9, 0.88, 0.84), 0.4, 0.0, (1.0, 0.86, 0.7), 1.0),
        "ink": get("charcoal"),
    }


def build_run(p, m):
    """The south wall's cabinetry, worktop, splashback, hood, shelves and appliances."""
    (x0, x1), (y0, y1) = RUN["x"], RUN["y"]
    oak, smoked, marble, nickel = p.bm(m["oak"]), p.bm(m["smoked"]), p.bm(m["marble"]), p.bm(m["nickel"])
    fy0, fy1 = FRIDGE
    top = WORKTOP
    # Two lengths of base cabinets either side of the gallery's fin: the cooking bay from the fridge
    # column to the fin, and the coffee and sink run from the fin to the run's sea-side end.
    (gy0, gy1) = GALLERY_FIN["y"]
    for a, b in ((fy1, gy0), (gy1, y1)):
        mid, length = (a + b) / 2, b - a
        box(smoked, ((x0 + x1) / 2 + 0.03, mid, 0.05), (x1 - x0 - 0.06, length, 0.1), 0.008)
        box(oak, ((x0 + x1) / 2 - 0.01, mid, 0.1 + (top - 0.04 - 0.1) / 2), (x1 - x0 - 0.04, length, top - 0.14), 0.01)
        # Marble worktop and a splashback up to the lower shelf.
        box(marble, ((x0 + x1) / 2 - 0.02, mid, top - 0.02), (x1 - x0 + 0.04, length, 0.04), 0.008)
        box(marble, (x0 + 0.015, mid, top + (1.62 - top) / 2), (0.03, length, 1.62 - top), 0.006)
    # Slab fronts with vertical grain, each with a finger-pull reveal along its top edge: in the bay, a
    # pull-out either side of the oven; beyond the fin, 60 cm doors.
    fronts = [(fy1 + 0.02, HOB_Y - 0.3), (HOB_Y - 0.3, HOB_Y + 0.3), (HOB_Y + 0.3, gy0 - 0.02)]
    edges = [gy1 + 0.02]
    while edges[-1] < y1 - 0.3:
        edges.append(min(edges[-1] + 0.6, y1 - 0.02))
    fronts += list(zip(edges, edges[1:]))
    for a, b in fronts:
        box(oak, (x1 + 0.009, (a + b) / 2, 0.11 + (top - 0.23) / 2), (0.018, b - a - 0.006, top - 0.23), 0.004)
        box(smoked, (x1 + 0.004, (a + b) / 2, top - 0.075), (0.01, b - a - 0.01, 0.02), 0.003)
    # The refrigerator column: oak-panelled doors to the soffit, a nickel bar pull.
    box(oak, ((x0 + x1) / 2, (fy0 + fy1) / 2, SOFFIT / 2 - 0.005), (x1 - x0, fy1 - fy0, SOFFIT - 0.01), 0.01)
    for a, b in ((fy0, (fy0 + fy1) / 2), ((fy0 + fy1) / 2, fy1)):
        box(oak, (x1 + 0.01, (a + b) / 2, 1.18), (0.02, b - a - 0.008, 2.2), 0.005)
    for y in ((fy0 + fy1) / 2 - 0.05, (fy0 + fy1) / 2 + 0.05):
        cylinder(nickel, (x1 + 0.05, y, 0.75), (x1 + 0.05, y, 1.65), 0.011, 12)
    # Induction hob, the oven under it, and the plaster hood that rises to the gallery soffit.
    box(p.bm(m["glass"]), ((x0 + x1) / 2 - 0.02, HOB_Y, top + 0.004), (0.52, 0.58, 0.008), 0.004)
    for dy in (-0.15, 0.15):
        for dx in (-0.12, 0.12):
            cylinder(p.bm(m["ink"]), ((x0 + x1) / 2 - 0.02 + dx, HOB_Y + dy, top + 0.0085), ((x0 + x1) / 2 - 0.02 + dx, HOB_Y + dy, top + 0.009), 0.085, 32)
    box(p.bm(m["glass"]), (x1 + 0.02, HOB_Y, 0.48), (0.012, 0.56, 0.5), 0.004)
    cylinder(nickel, (x1 + 0.05, HOB_Y - 0.22, 0.76), (x1 + 0.05, HOB_Y + 0.22, 0.76), 0.01, 12)
    hood = bmesh.new()
    rings = []
    for z, w, d in ((1.6, 0.92, 0.62), (1.66, 0.9, 0.6), (2.0, 0.6, 0.46), (SOFFIT, 0.5, 0.42)):
        rings.append([hood.verts.new((x0 + 0.04 + dx * d, HOB_Y + dy * w / 2, z)) for dx, dy in ((0, -1), (1, -1), (1, 1), (0, 1))])
    for a, b in zip(rings, rings[1:]):
        for k in range(4):
            hood.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    hood.faces.new(list(reversed(rings[0])))
    hood.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(hood, faces=list(hood.faces))
    bmesh.ops.bevel(hood, geom=[e for e in hood.edges if e.calc_face_angle(0) > 0.5], offset=0.03, segments=4, profile=0.5, affect="EDGES", clamp_overlap=True)
    data = bpy.data.meshes.new("tmp")
    hood.to_mesh(data)
    hood.free()
    p.bm(m["plaster"]).from_mesh(data)
    bpy.data.meshes.remove(data)
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
    # A polished-nickel E61-style machine: a box body, a domed group, two steam/water knobs.
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
    # Grinder: black body, nickel collar and spout, glass hopper of beans.
    box(black, (-4.24, 1.03, top + 0.165), (0.3, 0.3, 0.33), 0.05)
    cylinder(nickel, (-4.24, 1.03, top + 0.33), (-4.24, 1.03, top + 0.36), 0.12, 32)
    cylinder(p.bm(m["hopper"]), (-4.24, 1.03, top + 0.36), (-4.24, 1.03, top + 0.6), 0.14, 32, radius2=0.12)
    cylinder(p.bm(m["beans"]), (-4.24, 1.03, top + 0.37), (-4.24, 1.03, top + 0.5), 0.125, 32)
    box(nickel, (-4.03, 1.03, 1.12), (0.16, 0.08, 0.05), 0.015)
    # Tamper and knock box.
    cylinder(nickel, (-4.12, 0.72, top), (-4.12, 0.72, top + 0.03), 0.04, 24)
    lathe(p.bm(m["smoked"]), [(0.0, 0.0), (0.02, 0.0), (0.024, 0.05), (0.018, 0.08), (0.0, 0.09)], (-4.12, 0.72, top + 0.03), 16)
    box(black, (-4.3, 0.72, top + 0.06), (0.14, 0.14, 0.12), 0.02)


def build_print_wall(p, m):
    """The capybara print's wall, now stopping at the worktop's front so the run passes behind it,
    and a brass picture light over the print (the print itself is drawn by the browser)."""
    (x0, x1), y, t, top = PRINT_WALL["x"], PRINT_WALL["y"], PRINT_WALL["thickness"], PRINT_WALL["top"]
    box(p.bm(m["plaster"]), ((x0 + x1) / 2, y, top / 2), (x1 - x0, t, top), 0.06, segments=4)
    px, py, pz = PICTURE_LIGHT
    brass = p.bm(m["brass"])
    box(brass, (px, y + t / 2 + 0.012, pz - 0.05), (0.08, 0.024, 0.05), 0.008)
    cylinder(brass, (px, y + t / 2 + 0.02, pz - 0.04), (px, y + t / 2 + 0.11, pz), 0.008, 10)
    cylinder(brass, (px - 0.24, y + t / 2 + 0.11, pz), (px + 0.24, y + t / 2 + 0.11, pz), 0.022, 20)


def build_island(p, m):
    (x0, x1), (y0, y1), top = ISLAND["x"], ISLAND["y"], ISLAND["top"]
    trav, oak, smoked = p.bm(m["travertine"]), p.bm(m["oak"]), p.bm(m["smoked"])
    box(smoked, ((x0 + x1) / 2, (y0 + y1) / 2, 0.05), (x1 - x0 - 0.1, y1 - y0 - 0.08, 0.1), 0.008)
    box(oak, ((x0 + x1) / 2, (y0 + y1) / 2, 0.1 + (top - 0.15) / 2), (x1 - x0 - 0.04, y1 - y0 - 0.1, top - 0.15), 0.01)
    # Travertine top and waterfall ends.
    box(trav, ((x0 + x1) / 2, (y0 + y1) / 2, top - 0.025), (x1 - x0 + 0.17, y1 - y0 + 0.21, 0.05), 0.01)
    for y in (y0 - 0.08, y1 + 0.08):
        box(trav, ((x0 + x1) / 2, y, (top - 0.05) / 2), (x1 - x0 + 0.17, 0.05, top - 0.05), 0.01)
    # Fluted light oak along both long faces.
    for side, x in ((1, x1 + 0.03), (-1, x0 - 0.03)):
        n = 26
        for k in range(n):
            y = y0 + 0.02 + k * (y1 - y0 - 0.04) / (n - 1)
            box(oak, (x, y, 0.1 + (top - 0.16) / 2), (0.03, 0.042, top - 0.16), 0.012)
    # A board, a bowl of lemons.
    box(smoked, ((x0 + x1) / 2, (y0 + y1) / 2 - 0.2, top + 0.017), (0.38, 0.5, 0.034), 0.012)
    bx, by = (x0 + x1) / 2, (y0 + y1) / 2 + 0.42
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


def build_table(p, m):
    """A round honed-travertine top on a fluted oak column with a nickel footrest ring."""
    (cx, cy), r, top = TABLE["center"], TABLE["radius"], TABLE["top"]
    trav, oak, nickel = p.bm(m["travertine"]), p.bm(m["oak"]), p.bm(m["nickel"])
    lathe(trav, [(0.0, top - 0.05), (r - 0.02, top - 0.05), (r, top - 0.03), (r, top - 0.012), (r - 0.012, top), (0.0, top)], (cx, cy, 0.0), 72)
    # Column: a flared foot, a fluted shaft and a cap under the top.
    lathe(oak, [(0.0, 0.0), (0.36, 0.0), (0.36, 0.02), (0.3, 0.05), (0.16, 0.1), (0.0, 0.1)], (cx, cy, 0.0), 56)
    flutes = 20
    for k in range(flutes):
        a = k * math.tau / flutes
        x, y = cx + 0.13 * math.cos(a), cy + 0.13 * math.sin(a)
        cylinder(oak, (x, y, 0.09), (x, y, top - 0.08), 0.026, 10)
    cylinder(oak, (cx, cy, 0.09), (cx, cy, top - 0.08), 0.12, 32)
    lathe(oak, [(0.0, 0.0), (0.15, 0.0), (0.28, 0.03), (0.28, 0.04), (0.0, 0.04)], (cx, cy, top - 0.09), 48)
    # Footrest ring at 22 cm on three spokes.
    ring_r = 0.25
    ring = bmesh.new()
    segs = 48
    tube = 0.012
    verts = []
    for k in range(segs):
        a = k * math.tau / segs
        center = Vector((cx + ring_r * math.cos(a), cy + ring_r * math.sin(a), 0.22 - tube))
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
        cylinder(nickel, (cx + 0.13 * math.cos(a), cy + 0.13 * math.sin(a), 0.208), (cx + ring_r * math.cos(a), cy + ring_r * math.sin(a), 0.208), 0.008, 10)


def wishbone_chair(p, m, at, facing):
    """An oak chair after Wegner's wishbone: a steam-bent top rail, a Y splat, a woven seat at 51.5
    cm (the seated clips' cushion height)."""
    x, y = at
    f = Vector((math.cos(facing), math.sin(facing), 0))
    s = Vector((-f.y, f.x, 0))
    c = Vector((x, y, 0))
    oak, cord = p.bm(m["oak"]), p.bm(m["cord"])
    seat_top = 0.515
    for df, ds in ((0.2, 0.21), (0.2, -0.21)):
        foot = c + f * df + s * ds
        cylinder(oak, tuple(foot), tuple(foot + Vector((0, 0, seat_top - 0.03))), 0.018, 10, radius2=0.021)
    for ds in (0.2, -0.2):
        foot = c - f * 0.2 + s * ds
        top = c - f * 0.27 + s * ds * 1.08 + Vector((0, 0, 0.83))
        cylinder(oak, tuple(foot), tuple(top), 0.02, 10, radius2=0.016)
    # The bent top rail: an arc through the two rear legs' tops.
    rail = [c - f * (0.27 - 0.05 * math.sin(t * math.pi)) + s * (0.24 * math.cos(t * math.pi)) + Vector((0, 0, 0.83 + 0.02 * math.sin(t * math.pi))) for t in (k / 10 for k in range(11))]
    for a, b in zip(rail, rail[1:]):
        cylinder(oak, tuple(a), tuple(b), 0.018, 10)
    splat_top = c - f * 0.27 + Vector((0, 0, 0.82))
    fork = c - f * 0.24 + Vector((0, 0, 0.66))
    cylinder(oak, tuple(fork), tuple(splat_top), 0.012, 8)
    for ds in (0.13, -0.13):
        cylinder(oak, tuple(c - f * 0.2 + s * ds + Vector((0, 0, seat_top - 0.02))), tuple(fork), 0.01, 8)
    # The woven seat in a thin oak frame, stretchers below.
    yaw = math.atan2(f.y, f.x)
    box(oak, (x, y, seat_top - 0.022), (0.44, 0.46, 0.03), 0.01, yaw)
    box(cord, (x, y, seat_top - 0.006), (0.4, 0.42, 0.012), 0.005, yaw)
    for ds in (0.21, -0.21):
        a = c + f * 0.2 + s * ds + Vector((0, 0, 0.16))
        b = c - f * 0.2 + s * ds * 1.0 + Vector((0, 0, 0.16))
        cylinder(oak, tuple(a), tuple(b), 0.01, 8)


def build_dining(p, m):
    (cx, cy), r = TABLE["center"], TABLE["radius"]
    build_table(p, m)
    # Sirui's chair on the inland side facing the sea, and three around the table.
    for (dx, dy) in ((0.0, -1.0), (0.0, 1.0), (1.0, 0.0), (-1.0, 0.0)):
        at = (cx + dx * (r + 0.085), cy + dy * (r + 0.085))
        wishbone_chair(p, m, at, math.atan2(-dy, -dx))
    # A plate and a carafe on the table.
    lathe(p.bm(m["porcelain"]), [(0.0, 0.0), (0.1, 0.0), (0.14, 0.006), (0.15, 0.014), (0.145, 0.016), (0.0, 0.006)], (cx, SEAT[1] + 0.56, TABLE["top"]), 48)
    lathe(p.bm(m["celadon"]), [(0.0, 0.0), (0.06, 0.0), (0.07, 0.1), (0.035, 0.19), (0.04, 0.24), (0.0, 0.24)], (cx + 0.32, cy + 0.12, TABLE["top"]), 28)
    # The lantern: a 74 cm washi globe on a 3 mm cord to the vault.
    px, py, pz = PENDANT
    lathe(p.bm(m["lantern"]), [(0.0, -0.3), (0.12, -0.295), (0.3, -0.2), (0.37, 0.0), (0.3, 0.2), (0.12, 0.29), (0.0, 0.3)], (px, py, pz), 48)
    for k in range(9):
        z = pz - 0.24 + k * 0.06
        rr = math.sqrt(max(0.0, 0.37 ** 2 - (z - pz) ** 2 * 1.5)) + 0.003
        cylinder(p.bm(m["smoked"]), (px, py, z), (px, py, z + 0.0025), rr, 48)
    cylinder(p.bm(m["ink"]), (px, py, pz + 0.3), (px, py, 5.2), 0.0025, 6)
    cylinder(p.bm(m["brass"]), (px, py, pz + 0.3), (px, py, pz + 0.34), 0.02, 16)


def build_downlights(p, m):
    """Two downlights recessed in the gallery soffit over the working kitchen, in front of the run so
    the cook never stands in their own shadow."""
    for x, y in DOWNLIGHTS:
        cylinder(p.bm(m["nickel"]), (x, y, SOFFIT - 0.004), (x, y, SOFFIT + 0.002), 0.055, 32)
        cylinder(p.bm(m["downlight"]), (x, y, SOFFIT - 0.006), (x, y, SOFFIT - 0.004), 0.042, 32)


def build_plant(p, m):
    """An olive in a terracotta pot by the glass, beside the dining table."""
    ox, oy = -4.35, 4.05
    lathe(p.bm(m["terra"]), [(0.0, 0.0), (0.16, 0.0), (0.2, 0.36), (0.21, 0.4), (0.0, 0.38)], (ox, oy, 0.0), 32)
    stem, leaves = p.bm(m["smoked"]), p.bm(m["leaf"])
    foot, crown = Vector((ox, oy, 0.38)), Vector((ox + 0.02, oy - 0.02, 1.36))
    cylinder(stem, tuple(foot), tuple(crown), 0.016, 8)
    for k in range(40):
        z = 0.85 + (k % 13) * 0.04
        a = k * 2.39996
        axis = foot.lerp(crown, (z - foot.z) / (crown.z - foot.z))
        root = axis + Vector((math.cos(a), math.sin(a), 0.0)) * 0.02
        tip = root + Vector((0.17 * math.cos(a), 0.17 * math.sin(a), 0.05 + 0.03 * math.sin(k)))
        rooted_leaf(stem, leaves, axis, root, tip, 0.022)


def build_kitchen(scene):
    """Replace the kitchen's furniture (keeping the coffee cup props the routine carries)."""
    removed = 0
    for obj in [o for o in scene.objects if o.name.startswith("kitchen_") and not o.get("activityProp")]:
        bpy.data.objects.remove(obj, do_unlink=True)
        removed += 1
    m = kitchen_materials()
    p = Parts("kitchen")
    build_run(p, m)
    build_coffee_bar(p, m)
    build_print_wall(p, m)
    build_island(p, m)
    build_dining(p, m)
    build_downlights(p, m)
    build_plant(p, m)
    return p.finish(), {"removed": removed}
