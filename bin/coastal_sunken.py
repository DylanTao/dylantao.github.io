"""Sunken floors on the ground storey (Sirui, 2026-10-20: "could you make the first place has sunked-in
area so teh sofa could be more cozy and same for breakfast nook").

A sunken area is a plan rectangle dropped `depth` below the ground floor (z 0). The ground slab and the
coast block it rests on (the cliff under the house tops out at z -0.26) are cut with exact Booleans, the
oak boards are relaid around the opening, and the opening becomes a lined box: a stone slab, oak boards
at the lower level, plastered sides with an oak nosing at the floor edge, and steps where it is open.
The supports the walking feet use (manifest terrain.supportSurfaces) are returned for each level.

House coordinates are Blender's: metres, Z up, +Y toward the sea (west), +X north.
"""

import bmesh
import bpy
from mathutils import Matrix, Vector

import coastal_shell as shell
from coastal_office import box


BOARD_X0, BOARD_X1, BOARD_COLUMNS = -4.6, 4.6, 36  # the ground floor's board columns (coastal_shell.build_floors)


def seam(x):
    """The board seam nearest x, so an opening's x edges cut no board lengthwise."""
    width = (BOARD_X1 - BOARD_X0) / BOARD_COLUMNS
    return round(BOARD_X0 + round((x - BOARD_X0) / width) * width, 4)


def _cutter(name, lo, hi):
    bm = bmesh.new()
    center = (Vector(lo) + Vector(hi)) / 2
    size = Vector(hi) - Vector(lo)
    bmesh.ops.create_cube(bm, size=1, matrix=Matrix.Translation(center) @ Matrix.Diagonal((*size, 1)))
    data = bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return obj


def cut_ground(scene, regions, bottom=-0.62):
    """Cut every region (x0, x1, y0, y1) out of the ground slab and the coast block, once per region:
    the scene remembers what it has cut (sunkenCuts), so a refresh never digs twice."""
    done = set(scene.get("sunkenCuts", []))
    report = []
    for (x0, x1, y0, y1) in regions:
        key = f"{x0:.3f},{x1:.3f},{y0:.3f},{y1:.3f},{bottom:.2f}"
        if key in done:
            continue
        cutter = _cutter("sunken cutter", (x0, y0, bottom), (x1, y1, 0.02))
        for name in ("core_reno_slab_ground", "coast_shared_golden coastal sandstone"):
            target = bpy.data.objects.get(name)
            if target is None:
                continue
            before = len(target.data.polygons)
            shell.boolean(target, cutter, "DIFFERENCE")
            report.append({"target": name, "region": key, "faces": [before, len(target.data.polygons)]})
        bpy.data.objects.remove(cutter, do_unlink=True)
        done.add(key)
    scene["sunkenCuts"] = sorted(done)
    return report


def relay_boards(scene, holes):
    """Lay the ground floor's oak boards again (same seed and bond as coastal_shell.build_floors), leaving
    out every hole (x0, x1, y0, y1); boards are trimmed at a hole's edges rather than skipped whole."""
    for obj in [o for o in scene.objects if o.name == "core_reno_floorboards_lower"]:
        bpy.data.objects.remove(obj, do_unlink=True)

    # Board columns are 0.2556 m wide from x -4.6; a hole's x edges sit on column seams, so a column
    # is either wholly inside the hole's span or wholly outside it.
    def skip(x, ya, yb):
        pieces = [(ya, yb)]
        hit = False
        for (x0, x1, y0, y1) in holes:
            if not (x0 < x < x1):
                continue
            hit = True
            next_pieces = []
            for a, b in pieces:
                if b <= y0 or a >= y1:
                    next_pieces.append((a, b))
                    continue
                if a < y0:
                    next_pieces.append((a, y0 - 0.002))
                if b > y1:
                    next_pieces.append((y1 + 0.002, b))
            pieces = next_pieces
        if not hit:
            return None
        return pieces if pieces else True

    bm = bmesh.new()
    count = shell.lay_floor(bm, -4.6, 4.6, shell.LOWER_BACK + 0.12, 4.45, 0.0025, skip=skip, seed=23)
    obj = shell.from_bmesh("core_reno_floorboards_lower", bm, bpy.data.materials["pale oak"])
    return obj, count


def lined_box(p, mats, region, depth, open_sides=(), nosing=True):
    """The visible box of one sunken area into a Parts collector `p` (room-prefixed batching): the lower
    floor's slab and boards, plastered sides (closed sides only) and an oak nosing along every edge."""
    x0, x1, y0, y1 = region
    z = -depth
    stone, plaster, oak, smoked = mats["stone"], mats["plaster"], mats["oak"], mats["smoked"]
    # The stone slab under the boards fills the cut to its bottom, so no cliff shows through a seam.
    box(p.bm(stone), ((x0 + x1) / 2, (y0 + y1) / 2, z - 0.15), (x1 - x0 + 0.04, y1 - y0 + 0.04, 0.3), 0.0)
    boards = bmesh.new()
    shell.lay_floor(boards, x0 + 0.004, x1 - 0.004, y0 + 0.004, y1 - 0.004, z + 0.0025, width=0.2, seed=int(abs(x0 * 97 + y0 * 31)) % 1000)
    data = bpy.data.meshes.new("tmp")
    boards.to_mesh(data)
    boards.free()
    p.bm(oak).from_mesh(data)
    bpy.data.meshes.remove(data)
    sides = {"south": ((x0, y0, x0 + 0.04, y1), "x"), "north": ((x1 - 0.04, y0, x1, y1), "x"), "inland": ((x0, y0, x1, y0 + 0.04), "y"), "sea": ((x0, y1 - 0.04, x1, y1), "y")}
    for side, ((a0, b0, a1, b1), axis) in sides.items():
        if side in open_sides:
            continue
        box(p.bm(plaster), ((a0 + a1) / 2, (b0 + b1) / 2, z / 2), (a1 - a0, b1 - b0, depth - 0.004), 0.004)
        if nosing:
            # The floor edge: a rounded smoked-oak nosing 3 cm proud of the plaster.
            if axis == "x":
                cx = a0 - 0.012 if side == "south" else a1 + 0.012
                box(p.bm(smoked), (cx, (b0 + b1) / 2, -0.015), (0.06, b1 - b0 + 0.06, 0.03), 0.012)
            else:
                cy = b0 - 0.012 if side == "inland" else b1 + 0.012
                box(p.bm(smoked), ((a0 + a1) / 2, cy, -0.015), (a1 - a0 + 0.06, 0.06, 0.03), 0.012)


def steps(p, mats, x0, x1, y0, y1, top, bottom, count, descend):
    """`count` equal risers from `top` down to `bottom`; the rectangle holds the `count - 1` treads
    between them, descending toward `descend` ("+x", "-x", "+y" or "-y"), and the last riser lands on
    the sunken floor. Solid plaster risers under oak treads with smoked-oak nosings, and the upper
    riser with an oak nosing at the floor edge. Returns each tread's (rectangle, height)."""
    oak, plaster, smoked = mats["oak"], mats["plaster"], mats["smoked"]
    axis = 0 if descend[1] == "x" else 1
    sign = 1 if descend[0] == "+" else -1
    lo, hi = (x0, x1) if axis == 0 else (y0, y1)
    n = count - 1
    run = (hi - lo) / n
    rise = (top - bottom) / count

    def place(a, b, z0, z1):
        """A block spanning [a, b] along the stepping axis and the full width across it."""
        if axis == 0:
            return ((a + b) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (b - a, y1 - y0, z1 - z0)
        return ((x0 + x1) / 2, (a + b) / 2, (z0 + z1) / 2), (x1 - x0, b - a, z1 - z0)

    treads = []
    for k in range(n):
        z = top - (k + 1) * rise
        a, b = (lo + k * run, lo + (k + 1) * run) if sign > 0 else (hi - (k + 1) * run, hi - k * run)
        center, size = place(a, b, bottom, z - 0.024)
        box(p.bm(plaster), center, size, 0.004)
        center, size = place(a, b, z - 0.024, z)
        box(p.bm(oak), center, size, 0.005)
        edge = b if sign > 0 else a
        center, size = place(edge - 0.015, edge + 0.015, z - 0.03, z + 0.002)
        box(p.bm(smoked), center, size, 0.01)
        treads.append(((a, b, y0, y1) if axis == 0 else (x0, x1, a, b), round(z, 4)))
    # The upper riser at the floor edge, from the first tread up to the floor, under an oak nosing.
    edge = lo if sign > 0 else hi
    z = top - rise
    center, size = place(edge - 0.02, edge + 0.02, z, top - 0.025)
    box(p.bm(plaster), center, size, 0.004)
    center, size = place(edge - 0.03, edge + 0.03, top - 0.03, top + 0.002)
    box(p.bm(smoked), center, size, 0.01)
    return treads


def support(id, rect, height):
    """A manifest terrain support: a plan rectangle as three.js [x, z] corners at `height`."""
    x0, x1, y0, y1 = rect
    return {"id": id, "height": round(height, 4), "polygon": [[round(x0, 4), round(-y1, 4)], [round(x1, 4), round(-y1, 4)], [round(x1, 4), round(-y0, 4)], [round(x0, 4), round(-y0, 4)]]}
