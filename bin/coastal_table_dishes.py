"""The plated dishes and desserts of Sirui's daily menu (dining-menu.mjs), as painted solids.

Each builder takes a Build (coastal_table_geometry.Build) at a level of detail and returns the
number of pieces it serves; every piece is a closed solid tagged with its place in the eating
order (1 first). Blender frame: metres from the table, +z up, the diner at +y, so the near side is
generally eaten first. Colours are sRGB designs; food takes them through vertex colour.
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

from coastal_table_geometry import (
    TAU,
    blob,
    bumpy,
    egg_colour,
    egg_half,
    bowl_profile,
    by_height,
    by_normal,
    cylinder,
    fb,
    fb_box,
    inner_profile,
    lathe,
    leaf,
    plate_profile,
    slab,
    smear,
    speckle,
    torus,
    transformed,
    tube,
)

PLATE_FLOOR = 0.010  # the dinner plate's well floor (plate_profile(0.135, 0.085))
RICE = speckle((248, 248, 242), (228, 228, 218), 0.35, 2200)


def dinner_plate(b, radius=0.135, well=0.085, mat="table porcelain"):
    b.add(mat, lathe(plate_profile(radius, well), segments=b.q["bowl"]))
    b.meta.update(vessel="plate", radius=radius)
    return PLATE_FLOOR


def coupe_plate(b, radius=0.1, mat="table porcelain"):
    b.add(mat, lathe(plate_profile(radius, radius * 0.62, 0.018, 0.008, 0.005), segments=b.q["bowl"]))
    b.meta.update(vessel="plate", radius=radius)
    return 0.018 - 0.008


def shallow_bowl(b, mat="table porcelain"):
    prof = [(0.0, 0.002), (0.05, 0.002), (0.054, 0.0), (0.058, 0.006), (0.075, 0.012), (0.1, 0.022), (0.124, 0.032), (0.13, 0.034), (0.129, 0.037), (0.122, 0.035), (0.098, 0.027), (0.07, 0.017), (0.04, 0.012), (0.0, 0.011)]
    b.add(mat, lathe(prof, segments=b.q["bowl"]))
    b.meta.update(vessel="bowl", radius=0.13)
    return 0.011


def deep_bowl(b, radius=0.095, height=0.075, mat="table porcelain"):
    b.add(mat, lathe(bowl_profile(radius, height, 0.005), segments=b.q["bowl"]))
    b.meta.update(vessel="bowl", radius=radius)
    return 0.013


def sectors(b, mat, profile, count, colour, ids, offset=(0.0, 0.0), start=0.0, gap=0.004):
    """A solid of revolution cut in `count` wedges: risotto lobes, cake slices, a burrata."""
    for k in range(count):
        a0 = start + k * TAU / count + gap
        a1 = start + (k + 1) * TAU / count - gap
        make = lathe(profile, (offset[0], offset[1], 0.0), b.q["lathe"], a0, a1)
        b.add(mat, make, colour, piece=ids[k])


def dish_salmon(b):
    floor = dinner_plate(b)
    q = b.q
    # Beurre blanc under the fish, chives scattered through it.
    b.add("food glaze", smear((0.0, 0.005, floor), 0.072, 0.0025, 0.12, 1.3, q["ring"] * 2), (247, 232, 178))
    for k in range(9):
        a = k * 2.4
        x, y = 0.05 * math.cos(a), 0.05 * math.sin(a)
        b.add("food", tube([(x, y, floor + 0.003), (x + 0.012, y + 0.004, floor + 0.0035)], 0.0012, sides=4), (62, 128, 44))

    # The fillet in six slices: a crisp golden sear on top, coral flesh with pale diagonal fat lines.
    def flesh(p, n):
        if n.z > 0.55:
            char = noise.noise(Vector((p.x * 260, p.y * 260, 1.0)))
            return (122, 62, 28) if char > 0.45 else (196, 116, 54)
        return (250, 206, 182) if math.sin((p.x * 0.8 + p.z * 1.6) * 520) > 0.8 else (240, 128, 92)

    L, gap = 0.13, 0.0016
    xs = [-L / 2 + L * k / 6 for k in range(7)]
    taper = lambda x: (1.0 - 0.35 * (abs(x) / (L / 2)) ** 2.2, 1.0 - 0.3 * (abs(x) / (L / 2)) ** 2.4)
    order = [("asp", 0), ("fish", 0), ("fish", 1), ("asp", 1), ("fish", 2), ("fish", 3), ("asp", 2), ("fish", 4), ("fish", 5), ("asp", 3)]
    ids = {key: n for n, key in enumerate(order, start=1)}
    for k in range(6):
        b.add("food", slab(xs[k] + gap / 2, xs[k + 1] - gap / 2, 0.058, 0.026, 0.009, (0, -0.012, floor + 0.002), taper=taper, per_corner=3), flesh, piece=ids[("fish", k)])
    for k in range(4):
        y = 0.04 + k * 0.012
        ax, bx = -0.055 + k * 0.004, 0.055 + k * 0.006
        tip = lambda p, n, bx=bx: (64, 96, 34) if p.x > bx - 0.016 else (106, 150, 60) if math.sin(p.x * 900) > -0.7 else (86, 126, 48)
        b.add("food", tube([(ax, y, floor + 0.006), ((ax + bx) / 2, y + 0.004, floor + 0.0066), (bx, y + 0.008, floor + 0.006)], 0.0052, sides=q["sides"], taper=lambda t: 1.0 - 0.35 * max(0.0, t - 0.82) / 0.18), tip, piece=ids[("asp", k)])
    # A charred lemon half, its cut face up.
    lemon = lathe([(0.0, 0.0), (0.012, 0.001), (0.019, 0.006), (0.021, 0.012), (0.02, 0.016), (0.0, 0.016)], (0.07, -0.05, floor), q["lathe"])

    def lemon_colour(p, n):
        if n.z > 0.8:
            return (120, 84, 30) if noise.noise(Vector((p.x * 400, p.y * 400, 3.0))) > 0.35 else (250, 232, 140)
        return (238, 200, 52)

    b.add("food glaze", lemon, lemon_colour)
    return len(order)


def dish_ribeye(b):
    floor = dinner_plate(b, mat="table warm glaze")
    q = b.q
    b.add("food glaze", smear((0.02, -0.015, floor), 0.064, 0.002, 0.2, 2.1, q["ring"] * 2, (1.3, 0.8), 0.3), (96, 42, 22))

    # Six slices of ribeye fanned and leaning on each other, so their rosy cut faces show; a dark
    # crust on the outer edges.
    def steak(p, n, axis):
        across = abs(n.dot(axis))
        if across < 0.55:
            return (92, 48, 28) if noise.noise(Vector((p.x * 300, p.y * 300, p.z * 300))) > 0.2 else (122, 66, 38)
        return (198, 84, 84)

    steak_ids = [2, 4, 6, 8, 10, 11]
    for k in range(6):
        lean = Matrix.Rotation(-0.95, 4, "X")
        place = Matrix.Translation((-0.055 + k * 0.02, -0.022 + k * 0.004, floor + 0.0165)) @ Matrix.Rotation(math.pi / 2 + 0.12 + k * 0.03, 4, "Z") @ lean
        face = (place.to_3x3() @ Vector((0, 1, 0))).normalized()
        slice_ = slab(-0.032, 0.032, 0.012, 0.036, 0.003, (0, 0, -0.018), turn=0.0, taper=lambda x: (1.0, 1.0 - 0.2 * (abs(x) / 0.032) ** 2), per_corner=2)
        b.add("food", transformed(slice_, place), lambda p, n, f=face: steak(p, n, f), piece=steak_ids[k])
    # Herb butter melting on the slices.
    b.add("food glaze", blob((-0.02, -0.022, floor + 0.034), (0.012, 0.011, 0.006), q=q, flat=0.6), speckle((246, 226, 150), (70, 120, 40), 0.22, 1300), piece=2)
    # Crisp potatoes halved and roasted cut side down: deep gold, darker where the pan crisped them.
    crisp = lambda p, n: (150, 86, 30) if noise.noise(Vector((p.x * 380, p.y * 380, p.z * 380))) > 0.3 else (214, 150, 60) if n.z > -0.2 else (184, 116, 42)
    for k, (x, y) in enumerate(((0.045, 0.045), (0.07, 0.02), (0.02, 0.064), (0.072, 0.056), (0.045, 0.08))):
        b.add("food", bumpy(blob((x, y, floor + 0.008), (0.017, 0.014, 0.013), q=q, flat=0.55, wobble=0.15, seed=k * 3.1, turn=k), 0.0012, 260.0, k), crisp, piece=[1, 3, 5, 7, 9][k])
    for k in range(4):
        b.add("food", leaf((0.005 + k * 0.008, 0.04 + k * 0.003, floor + 0.022), (0.02 + k * 0.008, 0.052 + k * 0.003, floor + 0.024), 0.0022, 0.1, q["leaf"]), (52, 84, 46))
    for k in range(5):
        b.add("food", leaf((-0.075 + k * 0.004, 0.012 + k * 0.006, floor + 0.004), (-0.055 + k * 0.004, 0.032 + k * 0.006, floor + 0.006), 0.0025, segments=q["leaf"]), (52, 84, 46))
    return 11


def dish_risotto(b):
    floor = shallow_bowl(b)
    q = b.q
    # A soft mound in eight lobes, eaten from the near side round: creamy, glossy, its grains just
    # showing; sliced mushrooms, parmesan curls and thyme over it.
    order = [3, 2, 4, 1, 5, 8, 6, 7]
    prof = [(0.0, floor), (0.07, floor + 0.001), (0.08, floor + 0.008), (0.074, floor + 0.016), (0.055, floor + 0.023), (0.03, floor + 0.027), (0.0, floor + 0.028)]
    creamy = speckle((238, 214, 156), (250, 238, 200), 0.3, 900)
    for k in range(8):
        a0, a1 = k * TAU / 8 + 0.0015, (k + 1) * TAU / 8 - 0.0015
        b.add("food glaze", bumpy(lathe(prof, (0, 0, 0), q["lathe"], a0, a1), 0.0011, 420.0, k, up_only=True), creamy, piece=order[k])
    gill = lambda p, n: (96, 60, 34) if n.z > 0.5 else (150, 112, 74)
    for k in range(8):
        am = (k + 0.5) * TAU / 8
        x, y = 0.045 * math.cos(am), 0.045 * math.sin(am)
        # A mushroom slice in profile: cap and stem, lying flat.
        cap = lathe([(0.0, 0.0), (0.011, 0.0), (0.012, 0.002), (0.0, 0.0032)], (0, 0, 0), q["lathe"], 0.0, math.pi)
        stem = slab(-0.0035, 0.0035, 0.008, 0.003, 0.001, (0, -0.006, 0))
        for part in (cap, stem):
            b.add("food", transformed(part, Matrix.Translation((x, y, floor + 0.027)) @ Matrix.Rotation(am + 1.2, 4, "Z")), gill, piece=order[k])
    for k in range(7):
        a = k * 0.9 + 0.2
        r = 0.015 + 0.004 * (k % 3)
        b.add("food", leaf((r * math.cos(a), r * math.sin(a), floor + 0.029), (r * math.cos(a) + 0.014, r * math.sin(a) + 0.006, floor + 0.031), 0.006, 0.55, q["leaf"]), (248, 236, 198), piece=order[k % 8])
    for k in range(10):
        a = k * 1.7
        b.add("food", leaf((0.03 * math.cos(a), 0.03 * math.sin(a), floor + 0.029), (0.036 * math.cos(a + 0.3), 0.036 * math.sin(a + 0.3), floor + 0.03), 0.002, 0.1, q["leaf"]), (82, 112, 50), piece=order[k % 8])
    return 8


def dish_cacio(b):
    floor = shallow_bowl(b, "table warm glaze")
    q = b.q
    # One tall twirled nest of tonnarelli in a glossy pecorino sauce. Each strand belongs to the
    # wedge its twirl starts in, so the fork takes the nest away one twirl at a time.
    pasta = speckle((240, 212, 140), (40, 36, 30), 0.1, 1500)
    wedges = 7
    order = [4, 3, 5, 2, 6, 1, 7]
    strands = 16 if b.lod else 28
    for s in range(strands):
        a0 = TAU * s / strands
        wedge = int(a0 / TAU * wedges) % wedges
        pts = []
        for i in range(14):
            t = i / 13
            a = a0 + t * TAU * 1.15
            r = 0.05 * (1 - 0.55 * t) * (0.9 + 0.1 * math.sin(s * 1.7))
            pts.append((r * math.cos(a), r * math.sin(a), floor + 0.004 + 0.034 * t ** 0.85 + 0.003 * math.sin(a * 3 + s)))
        b.add("food glaze", tube(pts, 0.0028, sides=q["strand"], samples=18 if b.lod else 30), pasta, piece=order[wedge])
    # Pecorino over the top, a little sauce pooled around the base.
    b.add("food glaze", smear((0.0, 0.0, floor), 0.06, 0.003, 0.15, 5.0, q["ring"] * 2), (238, 220, 168))
    b.add("food", bumpy(blob((0.0, 0.0, floor + 0.037), (0.016, 0.016, 0.005), q=q, flat=0.6), 0.0012, 400.0), speckle((250, 246, 230), (40, 36, 30), 0.08, 1800), piece=order[0])
    return wedges


def dish_black_cod(b):
    floor = dinner_plate(b, mat="table dark glaze")
    q = b.q

    # Miso-glazed cod in five pieces: a deep amber lacquer, charred at its edges, over pearly flesh
    # with its flakes showing.
    def cod(p, n):
        if n.z > 0.6:
            v = noise.noise(Vector((p.x * 260, p.y * 260, 0.0)))
            return (70, 32, 12) if v > 0.4 else (150, 78, 24) if v > 0.0 else (194, 112, 36)
        return (236, 230, 214) if math.sin(p.x * 900 + p.z * 400) > 0.7 else (250, 246, 236)

    xs = [-0.05 + k * 0.02 for k in range(6)]
    for k in range(5):
        b.add("food glaze", slab(xs[k] + 0.0009, xs[k + 1] - 0.0009, 0.05, 0.028, 0.007, (0, -0.015, floor + 0.001), taper=lambda x: (1.0 - 0.2 * abs(x) / 0.05, 1.0), per_corner=3), cod, piece=[2, 4, 6, 8, 10][k])
    # Baby bok choy halves: a pale fanned stem under deep green leaves.
    for k, (x, y, t) in enumerate(((0.04, 0.055, 0.5), (0.068, 0.028, 0.95))):
        place = Matrix.Translation((x, y, floor + 0.001)) @ Matrix.Rotation(t, 4, "Z")
        b.add("food", transformed(blob((-0.012, 0.0, 0.006), (0.016, 0.009, 0.006), q=q, flat=0.6), place), (230, 238, 208), piece=[3, 7][k])
        for j in range(3):
            b.add("food", transformed(leaf((-0.002, (j - 1) * 0.004, 0.009), (0.03, (j - 1) * 0.01, 0.007 + 0.002 * j), 0.011, 0.35, q["leaf"] + 1), place), (60, 124, 46) if j != 1 else (72, 140, 54), piece=[3, 7][k])
    # A dome of rice in four spoonfuls.
    prof = [(0.0, floor), (0.034, floor + 0.001), (0.036, floor + 0.01), (0.026, floor + 0.024), (0.0, floor + 0.03)]
    for k in range(4):
        a0, a1 = k * TAU / 4 + 0.6 + 0.003, (k + 1) * TAU / 4 + 0.6 - 0.003
        b.add("food", bumpy(lathe(prof, (-0.055, 0.05, 0.0), q["lathe"], a0, a1), 0.001, 520.0, k, up_only=True), RICE, piece=[1, 5, 9, 11][k])
    for k in range(3):
        b.add("food", leaf((0.06, -0.06 + k * 0.004, floor + 0.004), (0.08, -0.05 + k * 0.004, floor + 0.008), 0.008, 0.3, segments=q["leaf"]), (240, 168, 160))
    return 11


def dish_scallops(b):
    floor = dinner_plate(b)
    q = b.q
    # Pea puree in three swooshes, five scallops with a deep golden sear, each eaten in two halves
    # with a crisp curl of pancetta; pea shoots.
    for k in range(3):
        b.add("food glaze", smear((-0.035 + k * 0.035, 0.012 - k * 0.012, floor), 0.034, 0.0035, 0.2, k * 2.2, q["ring"] * 2, (1.5, 0.55), 0.45), (122, 176, 58))
    seared = lambda p, n: ((168, 96, 36) if noise.noise(Vector((p.x * 420, p.y * 420, 2.0))) > 0.0 else (196, 128, 52)) if n.z > 0.7 else (250, 240, 220)
    prof = [(0.0, 0.0), (0.0185, 0.0), (0.02, 0.003), (0.02, 0.015), (0.0185, 0.018), (0.0, 0.0185)]
    piece = 1
    for k, (x, y) in enumerate(((-0.048, 0.032), (-0.012, 0.042), (0.028, 0.026), (0.046, -0.016), (-0.026, -0.022))):
        for a0, a1 in ((0.0, math.pi), (math.pi, TAU)):
            make = transformed(lathe(prof, (0, 0, 0), q["lathe"], a0 + 0.012, a1 - 0.012), Matrix.Translation((x, y, floor + 0.003)) @ Matrix.Rotation(0.3 * k, 4, "Z"))
            b.add("food", make, seared, piece=piece)
            piece += 1
        curl = [(x - 0.008, y + 0.002, floor + 0.0225), (x, y + 0.006, floor + 0.026), (x + 0.008, y + 0.001, floor + 0.0235)]
        b.add("food", tube(curl, 0.0026, sides=q["sides"]), lambda p, n: (150, 54, 46) if math.sin(p.x * 1200) > -0.3 else (238, 196, 180), piece=piece - 2)
    for k in range(7):
        a = k * 0.95
        b.add("food", leaf((0.062 * math.cos(a), 0.062 * math.sin(a), floor + 0.004), (0.074 * math.cos(a + 0.2), 0.074 * math.sin(a + 0.2), floor + 0.013), 0.0045, 0.3, q["leaf"]), (104, 164, 62))
    return piece - 1


def dish_xiaolongbao(b):
    q = b.q
    # A bamboo steamer, a cabbage-leaf liner, six pleated soup dumplings; black vinegar and ginger.
    R, H = 0.092, 0.05
    weave = lambda p, n: (196, 150, 86) if math.sin(math.atan2(p.y, p.x) * 60) > 0.2 else (170, 124, 66)
    b.add("steamer bamboo", lathe([(0.0, 0.0), (R - 0.004, 0.0), (R, 0.004), (R, H - 0.004), (R - 0.004, H), (R - 0.008, H), (R - 0.008, 0.012), (0.0, 0.012)], segments=q["bowl"]), weave)
    b.add("food", smear((0, 0, 0.012), 0.078, 0.002, 0.08, 4.0, q["ring"] * 2), (206, 222, 156))
    for k, (x, y) in enumerate(((0.0, 0.046), (-0.04, 0.022), (0.04, 0.022), (-0.04, -0.024), (0.04, -0.024), (0.0, -0.046))):
        r = 0.021

        def dumpling(bm, x=x, y=y):
            seg, rings = q["blob"][0] + 6, q["blob"][1]
            rows = []
            for i in range(1, rings):
                v = math.pi * i / rings
                z = -math.cos(v)
                rr = math.sin(v)
                row = []
                for s in range(seg):
                    a = TAU * s / seg
                    pleat = 1 + 0.07 * math.sin(a * 14) * max(0.0, z) ** 0.7
                    pinch = 1 - 0.35 * max(0.0, z)
                    height = 0.0135 + 0.012 * (z * (0.62 if z < 0 else 1.0) + 0.62 + (0.25 * z * z if z > 0 else 0.0))
                    row.append(Vector((x + r * rr * math.cos(a) * pleat * pinch, y + r * rr * math.sin(a) * pleat * pinch, height)))
                rows.append(row)
            verts = fb.grid(bm, rows, close=True)
            bottom = bm.verts.new(Vector((x, y, 0.0135)))
            top = bm.verts.new(Vector((x, y, 0.0135 + 0.012 * 1.87 + 0.004)))
            for s in range(seg):
                s1 = (s + 1) % seg
                bm.faces.new((bottom, verts[0][s1], verts[0][s]))
                bm.faces.new((top, verts[-1][s], verts[-1][s1]))

        # The pleats read as faint lines gathering to the knot; the skin is a touch translucent.
        skin = lambda p, n, x=x, y=y: (226, 214, 192) if (p.z > 0.028 and math.sin(math.atan2(p.y - y, p.x - x) * 14) > 0.75) else (248, 240, 224)
        b.add("food glaze", dumpling, skin, piece=k + 1)
    b.add("table porcelain", lathe(bowl_profile(0.034, 0.02, 0.003, 0.016, 0.004), (0.13, 0.04, 0), q["lathe"]))
    b.add("food glaze", lathe([(0.0, 0.0115), (0.026, 0.0115), (0.027, 0.0125), (0.0, 0.0127)], (0.13, 0.04, 0), q["lathe"]), (42, 22, 12))
    for k in range(7):
        b.add("food", tube([(0.118 + k * 0.004, 0.034 + 0.002 * (k % 2), 0.0135), (0.132 + k * 0.003, 0.049, 0.0142)], 0.0009, sides=4), (244, 214, 140))
    b.meta.update(vessel="steamer", radius=R)
    return 6


def dish_poke(b):
    floor = deep_bowl(b, 0.09, 0.07, "table dark glaze")
    q = b.q
    # Sushi rice in three spoonfuls, toppings in sections over it: ahi tossed in sesame, a fan of
    # avocado, cucumber half-moons, edamame, nori, scallion.
    prof = [(0.0, floor), (0.07, floor + 0.012), (0.074, floor + 0.026), (0.05, floor + 0.034), (0.0, floor + 0.036)]
    rice = speckle((244, 240, 228), (210, 204, 190), 0.3, 1800)
    # The spoonfuls meet without a gap and share one grain noise, so the rice reads as one surface
    # (a gap or a per-spoonful noise drew thin dark seams across it at the table).
    for k in range(3):
        a0, a1 = k * TAU / 3, (k + 1) * TAU / 3
        b.add("food", bumpy(lathe(prof, (0, 0, 0), q["lathe"], a0, a1), 0.0012, 500.0, 0, up_only=True, vertical=True), rice, piece=[10, 11, 12][k])
    # A layer of rice that stays under the spoonfuls: a spoonful eaten shows rice rather than the
    # dark glaze of the bowl.
    b.add("food", lathe([(0.0, floor + 0.0005), (0.068, floor + 0.004), (0.07, floor + 0.01), (0.0, floor + 0.01)], (0, 0, 0), q["lathe"]), rice)
    top = floor + 0.034
    tuna = speckle((196, 40, 62), (250, 246, 236), 0.07, 1500)
    spots = [(-0.042, 0.022, 0.3), (-0.028, 0.033, 1.1), (-0.03, 0.012, 0.7), (-0.016, 0.026, 2.0), (-0.044, 0.004, 1.6), (-0.018, 0.008, 0.2)]
    for k, (x, y, r) in enumerate(spots):
        b.add("food glaze", transformed(fb_box((0, 0, 0.0065), (0.013, 0.012, 0.012), 0.0032), Matrix.Translation((x, y, top - 0.002)) @ Matrix.Rotation(r, 4, "Z") @ Matrix.Rotation(0.2 * (k % 3), 4, "X")), tuna, piece=[1, 2, 4, 5, 7, 8][k])
    for k in range(4):
        slice_ = lathe([(0.0, 0.0), (0.028, 0.0), (0.028, 0.006), (0.0, 0.0068)], (0, 0, 0), q["lathe"], 0.0, 0.85)
        b.add("food", transformed(slice_, Matrix.Translation((0.018, -0.02 + k * 0.008, top + 0.001 * k)) @ Matrix.Rotation(0.2 + k * 0.16, 4, "Z")), lambda p, n: (176, 200, 86) if n.z > -0.2 else (58, 88, 38), piece=[3, 6, 9, 9][k])
    for k in range(9):
        a = k * 0.7
        b.add("food", blob((0.03 + 0.012 * math.cos(a), 0.03 + 0.01 * math.sin(a), top + 0.004), (0.0055, 0.0038, 0.0038), q=q, flat=0.3, turn=a), (118, 172, 64))
    for k in range(4):
        half = lathe([(0.0, 0.0), (0.0085, 0.0), (0.0085, 0.0025), (0.0, 0.0025)], (0, 0, 0), q["ring"], 0.0, math.pi)
        b.add("food", transformed(half, Matrix.Translation((-0.005 + k * 0.01, -0.045 + 0.003 * (k % 2), top)) @ Matrix.Rotation(0.4 * k, 4, "Z")), lambda p, n: (210, 234, 172) if n.z > 0.5 else (52, 100, 42))
    for k in range(2):
        b.add("food", transformed(fb_box((0, 0, 0.013), (0.022, 0.0016, 0.026), 0.0006), Matrix.Translation((0.05 - k * 0.012, -0.03 + k * 0.012, top)) @ Matrix.Rotation(0.9, 4, "Z") @ Matrix.Rotation(0.25, 4, "X")), (24, 34, 28))
    for k in range(10):
        a = k * 0.83
        b.add("food", torus((0.012 * math.cos(a) + 0.01, 0.012 * math.sin(a), top + 0.006), 0.0028, 0.001, 10, 5), (110, 176, 64))
    return 12


def dish_burrata(b):
    floor = dinner_plate(b, mat="table warm glaze")
    q = b.q
    b.add("food glaze", smear((0.0, 0.0, floor), 0.058, 0.0008, 0.3, 6.0, q["ring"] * 2), (190, 170, 72))
    # The burrata in three creamy pieces, its top torn open; heirloom tomatoes round it, basil, a
    # few drops of balsamic.
    prof = [(0.0, floor), (0.034, floor + 0.004), (0.04, floor + 0.018), (0.034, floor + 0.032), (0.018, floor + 0.04), (0.0, floor + 0.041)]
    for k in range(3):
        a0, a1 = k * TAU / 3 + 0.5 + 0.012, (k + 1) * TAU / 3 + 0.5 - 0.012
        b.add("food glaze", bumpy(lathe(prof, (0, 0, 0), q["lathe"], a0, a1), 0.0012, 300.0, k, up_only=True), lambda p, n: (244, 238, 214) if p.z > floor + 0.036 else (252, 250, 244), piece=[2, 6, 10][k])
    colours = [(214, 44, 36), (240, 178, 36), (120, 166, 58), (214, 44, 36), (232, 104, 38), (240, 178, 36), (214, 44, 36), (120, 166, 58)]
    ids = [1, 3, 4, 5, 7, 8, 9, 11]
    for k in range(8):
        a = k * TAU / 8 + 0.2
        wedge = lathe([(0.0, 0.0), (0.022, 0.002), (0.024, 0.012), (0.016, 0.02), (0.0, 0.021)], (0, 0, 0), q["lathe"], 0.0, 1.4)
        c = colours[k]
        flesh = tuple(min(255, int(v * 1.12 + 18)) for v in c)
        b.add("food glaze", transformed(wedge, Matrix.Translation((0.07 * math.cos(a), 0.07 * math.sin(a), floor)) @ Matrix.Rotation(a + 2.4, 4, "Z")), lambda p, n, c=c, flesh=flesh: flesh if abs(n.z) < 0.35 and abs(n.x * n.y) < 0.2 else c, piece=ids[k])
    for k in range(5):
        a = k * 1.3
        b.add("food", leaf((0.03 * math.cos(a), 0.03 * math.sin(a), floor + 0.04), (0.048 * math.cos(a + 0.3), 0.048 * math.sin(a + 0.3), floor + 0.046), 0.01, 0.2, q["leaf"]), (46, 108, 40), piece=[2, 6, 10][k] if k < 3 else 0)
    for k in range(6):
        a = k * 1.05 + 0.4
        b.add("food glaze", blob((0.052 * math.cos(a), 0.052 * math.sin(a), floor + 0.0008), (0.0032, 0.0032, 0.0012), q=q, flat=0.6), (52, 22, 14))
    return 11


def dish_ramen(b):
    floor = deep_bowl(b, 0.098, 0.08, "table dark glaze")
    q = b.q
    broth = floor + 0.045
    # A rich, glossy broth with a few drops of chili oil; a loose mound of noodles in six pulls;
    # two rolled chashu slices, a jammy egg, nori, scallion and menma.
    def broth_colour(p, n):
        return (196, 120, 50) if n.z > 0.9 and noise.noise(Vector((p.x * 160, p.y * 160, 7.0))) > 0.55 else (224, 186, 132)

    b.add("food glaze", lathe([(0.0, broth - 0.03), (0.081, broth - 0.03), (0.084, broth), (0.0, broth)], (0, 0, 0), q["bowl"]), broth_colour)
    for k in range(6):
        for s in range(3 if b.lod else 5):
            a0 = (k * 0.55 + s * 0.21) - 1.2
            pts = []
            for i in range(9):
                t = i / 8
                r = 0.012 + 0.03 * t
                pts.append((-0.02 + r * math.cos(a0 + t * 1.8 + s), -0.012 + r * math.sin(a0 + t * 1.8 + s) * 0.8, broth - 0.003 + 0.006 * math.sin(t * math.pi * 2 + s) + 0.004 * (1 - t)))
            b.add("food glaze", tube(pts, 0.0019, sides=q["strand"], samples=12 if b.lod else 20), (240, 212, 136), piece=k + 1)
    for k in range(2):
        def chashu(p, n, c=(0.03 + k * 0.006, 0.02 - k * 0.032)):
            d = Vector((p.x - c[0], p.y - c[1])).length
            if abs(n.z) > 0.5:
                return (238, 222, 210) if math.sin(d * 600) > 0.6 else (214, 140, 116) if d < 0.021 else (132, 74, 44)
            return (132, 74, 44)

        b.add("food", transformed(cylinder((0, 0, 0), 0.025, 0.007, q["ring"]), Matrix.Translation((0.03 + k * 0.006, 0.02 - k * 0.032, broth - 0.001)) @ Matrix.Rotation(0.12 - k * 0.2, 4, "Y")), chashu, piece=[7, 9][k])
    for k in range(2):
        c = (-0.032 + k * 0.03, 0.045, broth - 0.004)
        b.add("food glaze", egg_half(c, 0.015, 0.012, 0.4 + k * 0.5, q["lathe"]), egg_colour(c, 0.0085), piece=[8, 10][k])
    for k in range(2):
        b.add("food", fb_box((0.062 - k * 0.012, -0.04 + k * 0.022, broth + 0.02), (0.002, 0.034, 0.048), 0.0008), (22, 32, 26))
    for k in range(12):
        a = k * 0.83
        c = (0.012 * math.cos(a) - 0.01, 0.012 * math.sin(a) + 0.006, broth + 0.0005)
        b.add("food", torus(c, 0.0035, 0.0012, 10, 5), (110, 176, 64) if k % 3 else (196, 228, 150))
    for k in range(4):
        b.add("food", fb_box((-0.05 + k * 0.007, 0.0, broth + 0.002), (0.004, 0.022, 0.003), 0.001), (206, 172, 96))
    return 10


def dish_nicoise(b):
    floor = dinner_plate(b)
    q = b.q
    for k in range(5):
        a = k * TAU / 5
        b.add("food", leaf((0.0, 0.0, floor + 0.002), (0.075 * math.cos(a), 0.075 * math.sin(a), floor + 0.012), 0.03, 0.25, q["leaf"] + 1), (150, 192, 82))
    # Seared tuna, rare inside under a sesame crust; halved eggs, olives, beans, potatoes, tomatoes.
    for k in range(4):
        b.add("food glaze", slab(-0.022, 0.022, 0.014, 0.014, 0.003, (-0.02 + k * 0.016, -0.028 + k * 0.004, floor + 0.012), turn=math.pi / 2 + 0.55), lambda p, n: speckle((170, 136, 96), (246, 240, 226), 0.3, 1600)(p, n) if n.z > 0.6 or n.z < -0.5 else (206, 70, 86), piece=[2, 5, 8, 10][k])
    for k, (x, y) in enumerate(((0.048, 0.03), (0.052, 0.0))):
        c = (x, y, floor + 0.014)
        b.add("food glaze", egg_half(c, 0.015, 0.012, 0.6 + k, q["lathe"]), egg_colour(c, 0.0085), piece=[3, 7][k])
    for k, (x, y) in enumerate(((-0.055, 0.045), (-0.03, 0.058), (-0.06, 0.02))):
        b.add("food", bumpy(blob((x, y, floor + 0.014), (0.013, 0.011, 0.01), q=q, flat=0.5, wobble=0.1, seed=k), 0.0006, 300.0, k), by_normal((232, 200, 128), (244, 226, 172)), piece=[1, 4, 9][k])
    for k, (x, y) in enumerate(((0.062, -0.035), (0.04, -0.05))):
        b.add("food glaze", blob((x, y, floor + 0.016), (0.011, 0.011, 0.011), q=q, flat=0.3), (214, 46, 36), piece=[6, 11][k])
    for k, (x, y) in enumerate(((-0.02, -0.06), (0.0, 0.065), (0.07, 0.035), (-0.07, -0.02), (0.02, -0.07), (-0.045, -0.045))):
        b.add("food glaze", blob((x, y, floor + 0.014), (0.0062, 0.005, 0.005), q=q, flat=0.3, turn=k), (56, 36, 48))
    for k in range(5):
        a = 2.4 + k * 0.08
        b.add("food", tube([(0.0, -0.045 + k * 0.004, floor + 0.016), (0.04 * math.cos(a) + 0.02, -0.06 + k * 0.004, floor + 0.017)], 0.0028, sides=q["sides"]), (84, 136, 50))
    return 11


def dish_shrimp_bowl(b):
    floor = shallow_bowl(b, "table warm glaze")
    q = b.q
    # Quinoa in three spoonfuls under grilled shrimp, roasted squash and a little kale.
    prof = [(0.0, floor), (0.08, floor + 0.004), (0.084, floor + 0.012), (0.06, floor + 0.02), (0.0, floor + 0.022)]
    quinoa = speckle((222, 204, 162), (150, 108, 70), 0.22, 1700)
    for k in range(3):
        a0, a1 = k * TAU / 3 + 1.0, (k + 1) * TAU / 3 + 1.0
        b.add("food", bumpy(lathe(prof, (0, 0, 0), q["lathe"], a0, a1), 0.0012, 600.0, 0, up_only=True, vertical=True), quinoa, piece=[8, 9, 10][k])
    # The quinoa that stays under the spoonfuls, as under the poke bowl's rice.
    b.add("food", lathe([(0.0, floor + 0.0005), (0.078, floor + 0.003), (0.08, floor + 0.007), (0.0, floor + 0.007)], (0, 0, 0), q["lathe"]), quinoa)
    top = floor + 0.02
    shrimp = lambda p, n: (232, 120, 78) if math.sin(math.atan2(p.y, p.x) * 40) > 0.55 else (244, 152, 106)
    for k in range(6):
        a = k * TAU / 6
        x, y = 0.042 * math.cos(a), 0.042 * math.sin(a)
        pts = [(x + 0.014 * math.cos(a + t * 3.4), y + 0.014 * math.sin(a + t * 3.4), top + 0.006 + 0.002 * math.sin(t * 3)) for t in [i / 5 for i in range(6)]]
        b.add("food glaze", tube(pts, 0.0062, sides=q["sides"], taper=lambda t: 1.0 - 0.55 * t), shrimp, piece=k + 1)
    for k, (x, y) in enumerate(((-0.012, -0.012), (0.012, 0.004), (-0.004, 0.018), (0.016, -0.016))):
        b.add("food", fb_box((x, y, top + 0.006), (0.012, 0.012, 0.011), 0.0028), by_normal((214, 116, 36), (240, 150, 52)), piece=7 if k == 0 else 0)
    for k in range(7):
        a = k * 0.9
        b.add("food", leaf((0.02 * math.cos(a), 0.02 * math.sin(a), top + 0.003), (0.032 * math.cos(a + 0.4), 0.032 * math.sin(a + 0.4), top + 0.008), 0.0055, 0.45, q["leaf"]), (44, 94, 52))
    return 10


def dish_avocado_toast(b):
    floor = dinner_plate(b, mat="table warm glaze")
    q = b.q
    # Two slices of sourdough, golden at the crust and open in the crumb, each cut in three; smashed
    # avocado with chili flakes and flaky salt; a jammy egg halved on top; microgreens.
    crust = lambda p, n: (150, 92, 38) if n.z < 0.5 else (226, 188, 124) if noise.noise(Vector((p.x * 500, p.y * 500, 2.0))) > -0.25 else (196, 150, 90)
    avocado = lambda p, n: (200, 40, 24) if noise.noise(Vector((p.x * 900, p.y * 900, 5.0))) > 0.72 else (250, 248, 240) if noise.noise(Vector((p.x * 900, p.y * 900, 9.0))) > 0.78 else (150, 182, 70) if noise.noise(Vector((p.x * 300, p.y * 300, 1.0))) > 0 else (122, 160, 56)
    ids = [1, 3, 5, 2, 4, 6]
    for t, (cx, cy, turn) in enumerate(((-0.036, 0.004, 0.22), (0.036, -0.006, -0.18))):
        rot = Matrix.Translation((cx, cy, floor)) @ Matrix.Rotation(turn, 4, "Z")
        for k in range(3):
            x0, x1 = -0.045 + k * 0.03 + 0.0007, -0.045 + (k + 1) * 0.03 - 0.0007
            shape = lambda x: (1.0 - 0.18 * (abs(x) / 0.045) ** 3, 1.0)
            b.add("food", transformed(slab(x0, x1, 0.078, 0.017, 0.005, (0, 0, 0.0), taper=shape, per_corner=3), rot), crust, piece=ids[t * 3 + k])
            b.add("food", transformed(bumpy(slab(x0 + 0.0015, x1 - 0.0015, 0.066, 0.009, 0.0045, (0, 0, 0.016), taper=shape, per_corner=3), 0.0016, 300.0, t * 7 + k, up_only=True), rot), avocado, piece=ids[t * 3 + k])
    for k in range(2):
        c = (-0.05 + k * 0.034, 0.012 - k * 0.004, floor + 0.026 + k * 0.0015)
        b.add("food glaze", egg_half(c, 0.016, 0.012, 1.4 + k * 0.3, q["lathe"]), egg_colour(c, 0.009), piece=[1, 3][k])
    for k in range(8):
        a = k * 0.8
        b.add("food", leaf((0.03 + 0.008 * math.cos(a), 0.0 + 0.008 * math.sin(a), floor + 0.027), (0.03 + 0.02 * math.cos(a), 0.02 * math.sin(a), floor + 0.034), 0.0035, 0.3, q["leaf"]), (104, 172, 70), piece=[2, 4, 6][k % 3])
    return 6


def dish_pancakes(b):
    floor = dinner_plate(b)
    q = b.q
    # Three pancakes as one stack in eight wedges; berries and maple running down.
    prof = [(0.0, floor)]
    for layer in range(3):
        z = floor + layer * 0.014
        prof += [(0.058, z + 0.001), (0.062, z + 0.005), (0.062, z + 0.009), (0.058, z + 0.013)]
    prof += [(0.0, floor + 0.042)]

    def cake(p, n):
        z = (p.z - floor) % 0.014
        return (196, 128, 56) if (n.z > 0.6 or z < 0.0018 or z > 0.0122) else (242, 212, 150)

    sectors(b, "food", prof, 8, cake, [4, 3, 5, 2, 6, 1, 7, 8])
    b.add("food glaze", smear((0.0, 0.0, floor + 0.042), 0.045, 0.002, 0.25, 9.0, q["ring"] * 2), (150, 80, 20))
    b.add("food glaze", fb_box((0.0, 0.0, floor + 0.047), (0.022, 0.016, 0.008), 0.003), (252, 232, 164), piece=1)
    for k in range(8):
        a = k * 0.8
        r = 0.075 if k % 2 else 0.03
        col = (60, 64, 120) if k % 3 else (204, 40, 72)
        b.add("food glaze", blob((r * math.cos(a), r * math.sin(a), floor + (0.006 if r > 0.06 else 0.049)), (0.007, 0.007, 0.007), q=q, flat=0.25), col, piece=0 if r > 0.06 else (k % 8) + 1)
    return 8


def dish_congee(b):
    floor = deep_bowl(b, 0.085, 0.07, "table celadon")
    q = b.q
    # Six layers eaten from the top down, so the level falls spoon by spoon. Shredded chicken,
    # ginger, scallion, fried shallots and sesame oil sit in the middle and go with the first two.
    prof = inner_profile(0.085, 0.07)
    radius = lambda y: next((r for (yy, r) in prof if yy >= y), prof[-1][1]) - 0.0012
    top = floor + 0.042
    layers = 6
    oil = lambda p, n: (214, 168, 70) if n.z > 0.9 and noise.noise(Vector((p.x * 200, p.y * 200, 4.0))) > 0.6 else (246, 244, 236)
    for k in range(layers):
        z1 = top - k * (top - floor - 0.004) / layers
        z0 = top - (k + 1) * (top - floor - 0.004) / layers
        b.add("food glaze", lathe([(0.0, z0), (radius(z0), z0), (radius(z1), z1), (0.0, z1)], (0, 0, 0), q["bowl"]), oil if k == 0 else (246, 244, 236), piece=k + 1)
    for k in range(10):
        a = k * 0.63
        r = 0.006 + 0.0018 * k
        pts = [(r * math.cos(a), r * math.sin(a), top + 0.0012), (r * math.cos(a + 0.4) + 0.004, r * math.sin(a + 0.4), top + 0.0022)]
        b.add("food", tube(pts, 0.0016, sides=4), (238, 226, 204), piece=1)
    for k in range(9):
        a = k * 0.7 + 0.3
        b.add("food", tube([(0.004 * math.cos(a), 0.004 * math.sin(a), top + 0.0028), (0.016 * math.cos(a), 0.016 * math.sin(a), top + 0.0032)], 0.0008, sides=4), (240, 210, 130), piece=1)
    for k in range(14):
        a = k * 2.4
        r = 0.016 + 0.002 * (k % 5)
        b.add("food", torus((r * math.cos(a), r * math.sin(a), top + 0.001), 0.0032, 0.0011, 10, 5), (110, 176, 64) if k % 3 else (206, 232, 160), piece=1 + k % 2)
    for k in range(10):
        a = k * 1.9
        b.add("food glaze", blob((0.011 * math.cos(a), 0.011 * math.sin(a), top + 0.003), (0.0028, 0.002, 0.0012), q=q, turn=a), (150, 84, 36), piece=2)
    # Youtiao on a small plate beside the bowl: puffed, golden, joined in pairs.
    b.add("table porcelain", lathe(plate_profile(0.06, 0.035, 0.012, 0.006, 0.004), (0.11, 0.05, 0), q["lathe"]))
    puff = speckle((222, 160, 70), (180, 112, 44), 0.25, 700)
    for k in range(2):
        for seg in range(3):
            y0 = -0.045 + seg * 0.031
            b.add("food", transformed(bumpy(blob((0.0, 0.0, 0.0), (0.0095, 0.0145, 0.0085), q=q, flat=0.3, wobble=0.12, seed=seg + k * 3), 0.0008, 300.0, k), Matrix.Translation((0.11 + (k - 0.5) * 0.016, 0.05 + y0 + 0.0155, 0.013)) @ Matrix.Rotation(0.1, 4, "Z")), puff)
    return layers


def dish_shakshuka(b):
    q = b.q
    # A small cast-iron pan of tomato and pepper sauce, two eggs and feta, herbs; grilled bread
    # leaning against the pan.
    b.add("table cast iron", lathe([(0.0, 0.0), (0.075, 0.0), (0.085, 0.004), (0.09, 0.035), (0.086, 0.036), (0.081, 0.008), (0.0, 0.006)], segments=q["bowl"]))
    b.add("table cast iron", tube([(-0.09, 0, 0.025), (-0.15, 0, 0.032)], 0.007, sides=q["sides"]))
    prof = [(0.0, 0.006), (0.08, 0.008), (0.08, 0.022), (0.0, 0.024)]
    sauce = speckle((194, 52, 26), (228, 124, 44), 0.16, 600)
    for k in range(4):
        a0, a1 = k * TAU / 4 + 0.2 + 0.003, (k + 1) * TAU / 4 + 0.2 - 0.003
        b.add("food glaze", bumpy(lathe(prof, (0, 0, 0), q["lathe"], a0, a1), 0.0016, 260.0, k, up_only=True), sauce, piece=[2, 4, 5, 6][k])
    for k, (x, y) in enumerate(((-0.025, 0.02), (0.028, -0.012))):
        b.add("food glaze", smear((x, y, 0.023), 0.024, 0.004, 0.2, k * 3.0, q["ring"]), (250, 248, 240), piece=[1, 3][k])
        b.add("food glaze", blob((x, y, 0.028), (0.0105, 0.0105, 0.006), q=q, flat=0.5), (240, 146, 28), piece=[1, 3][k])
    for k in range(9):
        a = k * 0.8
        b.add("food", fb_box((0.052 * math.cos(a), 0.052 * math.sin(a), 0.026), (0.007, 0.007, 0.005), 0.0015), (250, 250, 244), piece=[2, 4, 5, 6][k % 4])
    for k in range(12):
        a = k * 1.3
        b.add("food", leaf((0.04 * math.cos(a), 0.04 * math.sin(a), 0.027), (0.04 * math.cos(a) + 0.006, 0.04 * math.sin(a) + 0.004, 0.028), 0.003, 0.2, q["leaf"]), (56, 120, 40))
    grill = lambda p, n: (104, 60, 28) if (n.z > 0.6 and math.sin(p.x * 260 + p.y * 260) > 0.65) else (214, 164, 98) if n.z > 0.6 else (176, 122, 64)
    # The bread is torn and dipped by hand, so it stays beside the pan.
    for k in range(2):
        b.add("food", slab(-0.045, 0.045, 0.046, 0.012, 0.005, (0.115 + k * 0.062, -0.06 + k * 0.012, 0.0), turn=math.pi / 2 + 0.25, per_corner=3), grill)
    b.meta.update(vessel="pan", radius=0.09)
    return 6


def dish_french_toast(b):
    floor = dinner_plate(b)
    q = b.q
    sugar = speckle((192, 120, 50), (252, 252, 250), 0.18, 1500)
    ids = [1, 3, 5, 2, 4, 6]
    for t, (cx, cy, turn) in enumerate(((-0.024, 0.016, 0.3), (0.036, -0.014, -0.25))):
        rot = Matrix.Translation((cx, cy, floor + t * 0.006)) @ Matrix.Rotation(turn, 4, "Z") @ Matrix.Rotation(t * 0.1, 4, "Y")
        for k in range(3):
            x0, x1 = -0.042 + k * 0.028 + 0.001, -0.042 + (k + 1) * 0.028 - 0.001
            b.add("food", transformed(slab(x0, x1, 0.07, 0.024, 0.006), rot), lambda p, n: sugar(p, n) if n.z > 0.7 else (240, 210, 150), piece=ids[t * 3 + k])
    for k in range(9):
        a = k * 0.7
        b.add("food glaze", blob((0.07 * math.cos(a), 0.07 * math.sin(a), floor + 0.006), (0.0065, 0.0065, 0.0065), q=q, flat=0.25), (60, 64, 120) if k % 2 else (204, 40, 72))
    b.add("food glaze", smear((0.0, 0.0, floor), 0.06, 0.0015, 0.3, 12.0, q["ring"] * 2), (150, 80, 20))
    return 6


# Desserts on a small coupe plate or in a ramekin.
def dessert_tiramisu(b):
    floor = coupe_plate(b)
    q = b.q
    # A square of tiramisu: espresso-soaked ladyfingers and mascarpone in clear layers under a
    # deep cocoa dusting, spooned from the near edge. The cuts are nearly closed, so it reads whole.
    soaked, cream = (128, 82, 44), (246, 236, 214)
    layers = by_height([(floor, soaked), (floor + 0.011, soaked), (floor + 0.0125, cream), (floor + 0.024, cream), (floor + 0.0255, soaked), (floor + 0.036, soaked), (floor + 0.0375, cream), (floor + 0.05, cream)])
    cocoa = speckle((92, 54, 32), (64, 36, 20), 0.35, 1100)
    for k in range(5):
        x0, x1 = -0.036 + k * 0.0144 + 0.0003, -0.036 + (k + 1) * 0.0144 - 0.0003
        b.add("food", transformed(slab(x0, x1, 0.072, 0.052, 0.0012, (0, 0, floor)), Matrix.Rotation(math.pi / 2, 4, "Z")), lambda p, n: cocoa(p, n) if n.z > 0.6 else layers(p, n), piece=k + 1)
    for k in range(18):
        a = k * 2.2
        r = 0.03 + 0.03 * ((k * 37) % 10) / 10
        b.add("food", fb_box((r * math.cos(a), r * math.sin(a), floor + 0.0004), (0.0028, 0.0028, 0.0008), 0.0003), (92, 54, 32))
    b.add("food glaze", blob((0.012, -0.012, floor + 0.0545), (0.0055, 0.004, 0.0028), q=q, turn=0.5), (52, 30, 18), piece=5)
    return 5


def dessert_creme_brulee(b):
    q = b.q
    R, H = 0.052, 0.036
    b.add("table porcelain", lathe([(0.0, 0.0), (R, 0.0), (R + 0.002, 0.003), (R + 0.002, H), (R - 0.004, H + 0.001), (R - 0.004, 0.007), (0.0, 0.007)], segments=q["bowl"]))

    # A glassy burnt-sugar top, torched dark in places; pale vanilla custard where a spoon has been.
    def brulee(p, n):
        if n.z > 0.7:
            v = noise.noise(Vector((p.x * 150, p.y * 150, 0.0))) + 0.4 * noise.noise(Vector((p.x * 600, p.y * 600, 1.0)))
            return (96, 46, 14) if v > 0.45 else (176, 104, 30) if v > 0.0 else (214, 150, 58)
        return (250, 232, 172)

    for k in range(6):
        a0, a1 = k * TAU / 6 + 0.0012, (k + 1) * TAU / 6 - 0.0012
        b.add("food glaze", lathe([(0.0, 0.007), (R - 0.005, 0.007), (R - 0.005, H - 0.002), (0.0, H - 0.002)], (0, 0, 0), q["lathe"], a0, a1), brulee, piece=[1, 2, 6, 3, 5, 4][k])
    for k, (x, y) in enumerate(((-0.014, 0.008), (-0.004, -0.012), (0.01, 0.002))):
        b.add("food glaze", blob((x, y, H + 0.005), (0.0075, 0.0075, 0.0085), q=q, flat=0.2), speckle((204, 36, 64), (232, 90, 110), 0.3, 2400), piece=k + 1)
    b.add("food", leaf((-0.002, 0.004, H + 0.008), (0.016, 0.012, H + 0.012), 0.007, 0.2, q["leaf"]), (60, 140, 70), piece=1)
    b.meta.update(vessel="ramekin", radius=R)
    return 6


def dessert_fondant(b):
    floor = coupe_plate(b)
    q = b.q
    # A chocolate fondant in five spoonfuls, sugar-dusted, its molten middle running out in front;
    # vanilla ice cream in a quenelle; raspberries.
    prof = [(0.0, floor), (0.034, floor), (0.035, floor + 0.008), (0.034, floor + 0.032), (0.03, floor + 0.038), (0.0, floor + 0.039)]
    cake = speckle((58, 32, 22), (236, 232, 226), 0.05, 1600)
    for k in range(5):
        a0, a1 = k * TAU / 5 + 0.0012, (k + 1) * TAU / 5 - 0.0012
        b.add("food", bumpy(lathe(prof, (-0.015, 0.0, 0.0), q["lathe"], a0, a1), 0.0007, 300.0, k, up_only=True), cake, piece=k + 1)
    b.add("food glaze", smear((-0.015, 0.04, floor), 0.02, 0.0035, 0.3, 2.0, q["ring"], (0.8, 1.2)), (48, 24, 14), piece=1)
    b.add("food glaze", blob((0.04, -0.012, floor + 0.011), (0.022, 0.014, 0.011), q=q, flat=0.4, wobble=0.08, turn=0.6), (250, 244, 228), piece=6)
    b.add("food glaze", blob((0.04, -0.012, floor + 0.02), (0.016, 0.01, 0.0075), q=q, flat=0.4, wobble=0.08, turn=0.6), (250, 244, 228), piece=7)
    for k, (x, y) in enumerate(((0.035, 0.03), (0.05, 0.018), (0.024, 0.045))):
        b.add("food glaze", blob((x, y, floor + 0.007), (0.0075, 0.0075, 0.0085), q=q, flat=0.2), speckle((204, 36, 64), (232, 90, 110), 0.3, 2400))
    return 7


def dessert_panna_cotta(b):
    floor = coupe_plate(b)
    q = b.q
    b.add("food glaze", smear((0.0, 0.0, floor), 0.058, 0.002, 0.15, 3.0, q["ring"] * 2), (156, 20, 42))
    prof = [(0.0, floor + 0.002), (0.034, floor + 0.002), (0.034, floor + 0.008), (0.03, floor + 0.034), (0.024, floor + 0.04), (0.0, floor + 0.041)]
    sectors(b, "food glaze", prof, 5, (250, 246, 236), [1, 2, 3, 4, 5], gap=0.003)
    for k in range(4):
        a = k * 1.4
        b.add("food glaze", blob((0.048 * math.cos(a), 0.048 * math.sin(a), floor + 0.006), (0.0065, 0.0065, 0.0065), q=q, flat=0.25), (60, 64, 120) if k % 2 else (204, 40, 72))
    b.add("food", leaf((0.0, 0.0, floor + 0.041), (0.016, 0.008, floor + 0.046), 0.007, 0.25, q["leaf"]), (60, 140, 70), piece=1)
    return 5


def dessert_matcha(b):
    floor = coupe_plate(b)
    q = b.q
    # A wedge of matcha cheesecake: green top, cream body, toasted crumb base, eaten from the tip.
    colour = by_height([(floor, (182, 132, 72)), (floor + 0.008, (182, 132, 72)), (floor + 0.0095, (250, 244, 226)), (floor + 0.034, (250, 244, 226)), (floor + 0.0355, (140, 174, 80)), (floor + 0.04, (140, 174, 80))])
    place = Matrix.Translation((-0.04, 0.01, 0)) @ Matrix.Rotation(-1.9, 4, "Z")
    for k in range(5):
        r0, r1 = 0.012 + k * 0.016 + 0.0004, 0.012 + (k + 1) * 0.016 - 0.0004
        ring = lathe([(r0, floor), (r1, floor), (r1, floor + 0.04), (r0, floor + 0.04)], (0, 0, 0), q["lathe"], 0.0, 0.62)
        b.add("food", transformed(ring, place), colour, piece=k + 1)
    b.add("food glaze", bumpy(blob((0.035, -0.02, floor + 0.009), (0.014, 0.012, 0.009), q=q, flat=0.4), 0.0008, 300.0), (250, 250, 244))
    b.add("food glaze", blob((0.04, 0.025, floor + 0.007), (0.0075, 0.0075, 0.0085), q=q, flat=0.2), speckle((204, 36, 64), (232, 90, 110), 0.3, 2400))
    b.add("food", leaf((0.04, 0.025, floor + 0.014), (0.05, 0.03, floor + 0.016), 0.005, 0.2, q["leaf"]), (60, 140, 70))
    return 5


DISHES = {
    "salmon": dish_salmon,
    "ribeye": dish_ribeye,
    "risotto": dish_risotto,
    "cacio-e-pepe": dish_cacio,
    "black-cod": dish_black_cod,
    "scallops": dish_scallops,
    "xiaolongbao": dish_xiaolongbao,
    "poke-bowl": dish_poke,
    "burrata": dish_burrata,
    "ramen": dish_ramen,
    "nicoise": dish_nicoise,
    "shrimp-bowl": dish_shrimp_bowl,
    "avocado-toast": dish_avocado_toast,
    "ricotta-pancakes": dish_pancakes,
    "congee": dish_congee,
    "shakshuka": dish_shakshuka,
    "french-toast": dish_french_toast,
    "tiramisu": dessert_tiramisu,
    "creme-brulee": dessert_creme_brulee,
    "chocolate-fondant": dessert_fondant,
    "panna-cotta": dessert_panna_cotta,
    "matcha-cheesecake": dessert_matcha,
}
