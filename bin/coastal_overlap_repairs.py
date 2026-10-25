"""Bounded native repairs for the overlap audit's ranked offenders (October 24 house pass).

Native Blender metres, +Y to the Pacific, +Z up, final housing frame (after the 8 m retreat).
Each repair names the measured defect it removes and edits only the islands that carry it:

* ``lower_flush_caps``: retreat floors and treads laid a stone base whose top was flush with
  the oak boards or tread cap on it, so stone and oak z-fought across whole floors and every
  tread. The stone island keeps its bottom and plan; its upper half drops by the oak's own
  thickness, so the oak top is the only visible face and the stone carries it underneath.
* ``relocate_plant``: the west landward olive pot stood inside the streamed glass wine fridge
  placed at the kitchen anchor. The complete plant (pot, soil, stems, leaves) moves as one.
* ``trim_slab``: a slab that runs on under another room's finished floor at the same height
  (the arrival foyer slab under the guest bath tiles) is cut back to that room's wall.
* ``raise_pavers``: garden pavers sunk into the clifftop terrain or mulch, where the ground
  surface crossed their tops, are lifted rigidly until their tops clear it.

``bin/coastal_retreat.py`` carries the same flush-cap correction for a rebuild from the
pristine baseline. Every function returns a JSON-ready report with before/after numbers.
"""
import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import coastal_shell as shell

VERSION = 1

FLUSH_CAP_MODULES = ("library", "gallery", "arrival", "clifftop", "house_stair")


def _island_vertices(bm):
    return [[v.index for v in island] for island in shell._islands(bm)]


def _world(obj, bm):
    m = np.array(obj.matrix_world)
    co = np.array([v.co for v in bm.verts]) if bm.verts else np.zeros((0, 3))
    return co @ m[:3, :3].T + m[:3, 3]


def lower_flush_caps(scene, modules=FLUSH_CAP_MODULES, tolerance=0.001, pairs=None):
    """Shorten each stone island from above where an oak (or tile) island's top is flush with it.

    ``pairs`` names explicit (base mesh, cap mesh) pairs instead of retreat modules; a wider
    ``tolerance`` catches caps that sit a millimetre proud natively but collapse onto the base
    once Draco quantizes each mesh separately."""
    report = []
    jobs = pairs or [(f"core_retreat_{m}__warm cut stone", f"core_retreat_{m}__pale oak") for m in modules]
    for stone_name, oak_name in jobs:
        module = stone_name
        stone = bpy.data.objects.get(stone_name)
        oak = bpy.data.objects.get(oak_name)
        if stone is None or oak is None:
            report.append({"module": module, "skipped": "missing stone or oak batch"})
            continue
        obm = bmesh.new()
        obm.from_mesh(oak.data)
        oco = _world(oak, obm)
        oak_islands = []
        for ids in _island_vertices(obm):
            p = oco[ids]
            oak_islands.append((p.min(0), p.max(0)))
        obm.free()
        sbm = bmesh.new()
        sbm.from_mesh(stone.data)
        sbm.verts.ensure_lookup_table()
        sco = _world(stone, sbm)
        inv = stone.matrix_world.inverted().to_3x3()
        lowered = []
        for ids in _island_vertices(sbm):
            p = sco[ids]
            lo, hi = p.min(0), p.max(0)
            caps = [(a, b) for a, b in oak_islands
                    if abs(b[2] - hi[2]) <= tolerance and a[0] < hi[0] and b[0] > lo[0] and a[1] < hi[1] and b[1] > lo[1]]
            # A cap standing proud of the base by up to ``tolerance`` drops the base under the cap's
            # own bottom, so the cap is the only visible top once delivered.
            proud = max((b[2] - hi[2] for a, b in caps), default=0.0)
            if not caps:
                continue
            thickness = min(b[2] - a[2] for a, b in caps) - max(0.0, proud)
            height = hi[2] - lo[2]
            if thickness <= 0 or thickness >= height * 0.5:
                lowered.append({"stoneTop": round(float(hi[2]), 4), "skipped": "cap thicker than half the base", "caps": len(caps)})
                continue
            middle = (lo[2] + hi[2]) / 2
            delta = inv @ Vector((0, 0, -thickness))
            moved = 0
            for i in ids:
                if sco[i][2] > middle:
                    sbm.verts[i].co += delta
                    moved += 1
            lowered.append({"stoneTopBefore": round(float(hi[2]), 4), "stoneTopAfter": round(float(hi[2] - thickness), 4),
                            "capThickness": round(float(thickness), 4), "caps": len(caps), "movedVertices": moved,
                            "plan": [[round(float(lo[0]), 3), round(float(lo[1]), 3)], [round(float(hi[0]), 3), round(float(hi[1]), 3)]]})
        sbm.to_mesh(stone.data)
        sbm.free()
        stone.data.update()
        report.append({"module": module.replace("core_retreat_", "").replace("__warm cut stone", ""), "stone": stone.name, "oak": oak.name,
                       "lowered": [q for q in lowered if "skipped" not in q], "skipped": [q for q in lowered if "skipped" in q]})
    return report


def relocate_plant(scene, names, lo, hi, target):
    """Move the plant made of every island of ``names`` inside the world box lo..hi so its plan
    centre lands on ``target`` (x, y); heights are unchanged, so the pot keeps its floor contact."""
    lo, hi = Vector(lo), Vector(hi)

    def inside(a, b):
        return all(a[k] >= lo[k] and b[k] <= hi[k] for k in range(3))

    bounds = []
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        co = _world(obj, bm)
        for ids in _island_vertices(bm):
            p = co[ids]
            if inside(Vector(p.min(0)), Vector(p.max(0))):
                bounds.append((p.min(0), p.max(0)))
        bm.free()
    if not bounds:
        raise RuntimeError("No plant islands inside the relocation region")
    plo = np.min([q[0] for q in bounds], axis=0)
    phi = np.max([q[1] for q in bounds], axis=0)
    centre = (plo + phi) / 2
    delta = Vector((target[0] - centre[0], target[1] - centre[1], 0.0))
    report = []
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        moved, _ = shell.edit_islands(obj, lambda a, b: delta if inside(a, b) else None)
        report.append({"mesh": name, "movedIslands": moved})
    return {"region": [list(lo), list(hi)], "plantBefore": [[round(float(v), 3) for v in plo], [round(float(v), 3) for v in phi]],
            "delta": [round(v, 4) for v in delta], "meshes": report}


def move_islands(scene, names, lo, hi, delta):
    """Translate every island of ``names`` lying wholly inside the world box lo..hi by ``delta``."""
    lo, hi = Vector(lo), Vector(hi)
    report = []
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        moved, _ = shell.edit_islands(obj, lambda a, b: delta if all(a[k] >= lo[k] and b[k] <= hi[k] for k in range(3)) else None)
        report.append({"mesh": name, "movedIslands": moved})
    if not any(q["movedIslands"] for q in report):
        raise RuntimeError(f"No islands inside {list(lo)}..{list(hi)}")
    return {"region": [list(lo), list(hi)], "delta": list(delta), "meshes": report}


def shift_vertices(scene, name, lo, hi, select, delta):
    """Within islands of ``name`` lying wholly inside lo..hi, move the vertices for which
    ``select(world_point, island_lo, island_hi)`` is true by the world ``delta``."""
    obj = bpy.data.objects[name]
    lo, hi = np.array(lo), np.array(hi)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    co = _world(obj, bm)
    local = obj.matrix_world.inverted().to_3x3() @ Vector(delta)
    islands = moved = 0
    for ids in _island_vertices(bm):
        p = co[ids]
        a, b = p.min(0), p.max(0)
        if not (np.all(a >= lo) and np.all(b <= hi)):
            continue
        islands += 1
        for i in ids:
            if select(co[i], a, b):
                bm.verts[i].co += local
                moved += 1
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    if not moved:
        raise RuntimeError(f"{name}: no vertices selected inside {lo.tolist()}..{hi.tolist()}")
    return {"mesh": name, "region": [lo.tolist(), hi.tolist()], "delta": list(delta), "islands": islands, "movedVertices": moved}


def scale_islands_y(scene, names, lo, hi, pivot_y, factor):
    """Scale every island of ``names`` lying wholly inside lo..hi along world Y about ``pivot_y``
    (a cabinet narrowed toward its fixed face, with its fronts and handles following)."""
    lo, hi = np.array(lo), np.array(hi)
    report = []
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.verts.ensure_lookup_table()
        co = _world(obj, bm)
        to_local = obj.matrix_world.inverted()
        islands = 0
        for ids in _island_vertices(bm):
            p = co[ids]
            if not (np.all(p.min(0) >= lo) and np.all(p.max(0) <= hi)):
                continue
            islands += 1
            for i in ids:
                w = Vector(co[i])
                w.y = pivot_y + (w.y - pivot_y) * factor
                bm.verts[i].co = to_local @ w
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
        report.append({"mesh": name, "scaledIslands": islands})
    if not any(q["scaledIslands"] for q in report):
        raise RuntimeError("No islands to scale")
    return {"region": [lo.tolist(), hi.tolist()], "pivotY": pivot_y, "factor": factor, "meshes": report}


def trim_islands_x(scene, name, lo, hi, x_min):
    """Cut a batch of axis-aligned boards back to ``x >= x_min``: islands wholly west of it are
    deleted, islands straddling it keep their east part (west vertices clamp to x_min)."""
    obj = bpy.data.objects[name]
    lo, hi = np.array(lo), np.array(hi)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    co = _world(obj, bm)
    to_local = obj.matrix_world.inverted()
    doomed, clamped, kept = [], 0, 0
    for ids in _island_vertices(bm):
        p = co[ids]
        a, b = p.min(0), p.max(0)
        if not (np.all(a >= lo) and np.all(b <= hi)):
            continue
        if b[0] <= x_min + 1e-4:
            doomed.extend(bm.verts[i] for i in ids)
            continue
        if a[0] < x_min:
            for i in ids:
                if co[i][0] < x_min:
                    w = Vector(co[i])
                    w.x = x_min
                    bm.verts[i].co = to_local @ w
            clamped += 1
        else:
            kept += 1
    deleted = len({id(v) for v in doomed})
    if doomed:
        bmesh.ops.delete(bm, geom=list({v.index: v for v in doomed}.values()), context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return {"mesh": name, "region": [lo.tolist(), hi.tolist()], "xMin": x_min, "deletedVertices": deleted, "clampedIslands": clamped, "untouchedIslands": kept}


def trim_slab(scene, name, lo, hi, material_from=None):
    """Cut ``name`` back with a box (island-preserving Boolean difference)."""
    obj = bpy.data.objects[name]
    cutter = shell._box_object(f"overlap repair trim {name}", lo, hi, obj.data.materials[0] if obj.data.materials else None)
    result = shell.boolean_preserving_islands(obj, cutter)
    bpy.data.objects.remove(cutter, do_unlink=True)
    return {"mesh": name, "box": [list(lo), list(hi)], **{k: v for k, v in result.items() if k != "openEdges" or v is not None}}


def _ground_tree(scene, names):
    verts, faces = [], []
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        offset = len(verts)
        verts.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        faces.extend([offset + i for i in f.vertices] for f in obj.data.polygons)
    return BVHTree.FromPolygons(verts, faces)


def conform_path(scene, path_name, ground_names, clearance=0.012, radius=0.18, max_lift=0.08):
    """Lift each up-facing vertex of a draped path ribbon until it clears the highest ground
    within ``radius`` of it by ``clearance``; the buried underside stays where it is."""
    obj = bpy.data.objects[path_name]
    tree = _ground_tree(scene, ground_names)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    co = _world(obj, bm)
    inv = obj.matrix_world.inverted().to_3x3()
    up = set()
    for f in bm.faces:
        n = obj.matrix_world.to_3x3() @ f.normal
        if n.length > 0 and n.normalized().z > 0.6:
            up.update(v.index for v in f.verts)
    lifts, capped = [], 0
    ring = [(0, 0)] + [(r * np.cos(t), r * np.sin(t)) for r in (radius / 2, radius) for t in np.linspace(0, 2 * np.pi, 12, endpoint=False)]
    for i in sorted(up):
        x, y, z = co[i]
        ground = -1e9
        for dx, dy in ring:
            hit = tree.ray_cast(Vector((x + dx, y + dy, z + 2.0)), Vector((0, 0, -1)), 4.0)[0]
            if hit is not None:
                ground = max(ground, hit.z)
        need = ground + clearance - z
        if need <= 0:
            continue
        if need > max_lift:
            need = max_lift
            capped += 1
        bm.verts[i].co += inv @ Vector((0, 0, need))
        lifts.append(need)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return {"mesh": path_name, "ground": list(ground_names), "clearance": clearance, "radius": radius,
            "upVertices": len(up), "lifted": len(lifts), "maxLift": round(max(lifts, default=0.0), 4),
            "meanLift": round(float(np.mean(lifts)) if lifts else 0.0, 4), "capped": capped}


def clear_under(scene, cover_name, path_name, margin=0.04):
    """Delete ground-cover faces whose centre lies under the path's up-facing plan footprint."""
    path = bpy.data.objects[path_name]
    tris = []
    pw = path.matrix_world
    for f in path.data.polygons:
        n = (pw.to_3x3() @ f.normal)
        if n.length == 0 or n.normalized().z <= 0.6:
            continue
        pts = [pw @ path.data.vertices[i].co for i in f.vertices]
        for k in range(1, len(pts) - 1):
            tris.append((pts[0], pts[k], pts[k + 1]))
    tops = BVHTree.FromPolygons([q for t in tris for q in t], [(3 * k, 3 * k + 1, 3 * k + 2) for k in range(len(tris))])
    cover = bpy.data.objects[cover_name]
    bm = bmesh.new()
    bm.from_mesh(cover.data)
    doomed = []
    cw = cover.matrix_world
    for f in bm.faces:
        c = cw @ f.calc_center_median()
        if tops.ray_cast(Vector((c.x, c.y, c.z + 2.0)), Vector((0, 0, -1)), 4.0)[0] is not None:
            doomed.append(f)
            continue
        # Faces straddling the path edge: any corner under the footprint.
        if any(tops.ray_cast(Vector(((cw @ v.co).x, (cw @ v.co).y, (cw @ v.co).z + 2.0)), Vector((0, 0, -1)), 4.0)[0] is not None
               for v in f.verts):
            doomed.append(f)
    before = len(bm.faces)
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.to_mesh(cover.data)
    bm.free()
    cover.data.update()
    return {"mesh": cover_name, "under": path_name, "facesBefore": before, "removedFaces": len(doomed)}


def inset_arch_extrados(scene, name, centre=(0.0, 2.2), inset=0.005, tolerance=0.002, ground=("core_liftaway_cave_ceiling", "core__golden coastal sandstone")):
    """Pull a facade arch frame's outer edge in from the rock arch it was swept along: vertices
    within ``tolerance`` of the rock move ``inset`` toward the arch centre (x, z), leaving a
    shadow reveal instead of two double-sided faces in the same place."""
    obj = bpy.data.objects[name]
    trees = []
    for g in ground:
        o = bpy.data.objects.get(g)
        if o is not None:
            trees.append(BVHTree.FromPolygons([o.matrix_world @ v.co for v in o.data.vertices], [list(f.vertices) for f in o.data.polygons]))
    to_local = obj.matrix_world.inverted()
    moved = 0
    for v in obj.data.vertices:
        w = obj.matrix_world @ v.co
        near = min((t.find_nearest(w)[3] or 1e9) for t in trees) if trees else 1e9
        if near > tolerance:
            continue
        d = Vector((centre[0] - w.x, 0.0, centre[1] - w.z))
        if d.length < 1e-6:
            continue
        v.co = to_local @ (w + d.normalized() * inset)
        moved += 1
    obj.data.update()
    if not moved:
        raise RuntimeError(f"{name}: no extrados vertices against the rock")
    return {"mesh": name, "inset": inset, "movedVertices": moved, "rock": list(ground)}


def raise_pavers(scene, paver_name, ground_names, clearance=0.006, max_lift=0.08, grid=5):
    """Lift each paver island until the ground under its top face stays ``clearance`` below it."""
    obj = bpy.data.objects[paver_name]
    tree = _ground_tree(scene, ground_names)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    co = _world(obj, bm)
    inv = obj.matrix_world.inverted().to_3x3()
    lifted, skipped = [], []
    bm.faces.ensure_lookup_table()
    for ids in _island_vertices(bm):
        p = co[ids]
        lo, hi = p.min(0), p.max(0)
        top = hi[2]
        # The paver's own top surface, sampled where the ground is: a paver laid on a slope is
        # tilted, so its highest corner says nothing about its uphill edge.
        idset = set(ids)
        faces = [[v.index for v in f.verts] for f in bm.faces if f.verts[0].index in idset]
        own = BVHTree.FromPolygons([Vector(q) for q in co], faces)
        worst = -1.0
        for u in np.linspace(0.06, 0.94, grid):
            for v in np.linspace(0.06, 0.94, grid):
                x = lo[0] + (hi[0] - lo[0]) * u
                y = lo[1] + (hi[1] - lo[1]) * v
                face = own.ray_cast(Vector((x, y, top + 2.0)), Vector((0, 0, -1)), 4.0)[0]
                if face is None:
                    continue
                hit = tree.ray_cast(Vector((x, y, top + 2.0)), Vector((0, 0, -1)), 4.0)[0]
                if hit is not None:
                    worst = max(worst, hit.z - face.z)
        need = worst + clearance
        if need <= 0:
            continue
        if need > max_lift:
            skipped.append({"plan": [round(float(lo[0]), 3), round(float(lo[1]), 3)], "top": round(float(top), 3), "requiredLift": round(float(need), 4)})
            continue
        delta = inv @ Vector((0, 0, need))
        for i in ids:
            bm.verts[i].co += delta
        lifted.append({"plan": [round(float(lo[0]), 3), round(float(lo[1]), 3)], "top": round(float(top), 4), "lift": round(float(need), 4)})
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return {"mesh": paver_name, "ground": list(ground_names), "clearance": clearance, "maxLift": max_lift,
            "lifted": lifted, "skipped": skipped}
