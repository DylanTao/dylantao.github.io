"""A larger house (Sirui, 2026-10-16: "make the overall house larger and office larger").

The cave is dug 2.4 m further into the cliff. Both storeys gain that depth at the back: the stair
moves back with the landward wall, the cupboards and rounded corners go with it, and the upper
floor is now deep enough for a proper office between the bedroom and the onsen, with the walk
between the rooms behind it. The vault over the new depth lifts away with the rest of the ceiling in
the cut-away views. Floors are relaid in wide oak boards over the whole plan.

Everything here is data the rest of the house reads: the stair and aisle coordinates go to the
manifest's navigation and terrain, the room actors and walks are rewritten by the refresh script.
House coordinates are Blender's: metres, Z up, +Y toward the sea (west), +X north.
"""

import math
import random
import bmesh
import bpy
from mathutils import Matrix, Vector

DEPTH = 2.4
OLD_BACK = -5.48  # the original back wall of the excavation
NEW_BACK = OLD_BACK - DEPTH
RISE = 2.6
# The stair's landward line (y of its centre) before and after, and its top landing.
STAIR_Y = -4.65 - DEPTH
NOTCH = {"x": (-2.08, 1.92), "y": (-5.3 - DEPTH, -4.08 - DEPTH)}
UPPER_AISLE_Y = -6.1  # the walk between the upper rooms, clear of the stair void
UPPER_BACK = -5.3 - DEPTH
LOWER_BACK = -5.35 - DEPTH
GALLERY_EDGE = -1.30
SCREENS = {"west": (-1.78, -3.6, -2.75), "east": (1.87, -5.6, -2.45)}


def arch_points():
    """The excavation's cross-section (x, z): the profile coastal_section.coast() carved."""
    arch = [(-4.94, -0.40), (4.94, -0.40)]
    arch += [(5.20 * math.cos(a * math.pi / 64), 0.04 + 5.95 * math.sin(a * math.pi / 64) ** 0.44) for a in range(65)]
    return arch


def _prism(name, profile, axis, start, end, mat):
    """A closed prism: an (u, z) outline swept along X or Y."""
    bm = bmesh.new()
    rings = []
    for along in (start, end):
        rings.append([bm.verts.new((along, u, z) if axis == "x" else (u, along, z)) for u, z in profile])
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[1])
    n = len(profile)
    for k in range(n):
        bm.faces.new((rings[0][k], rings[0][(k + 1) % n], rings[1][(k + 1) % n], rings[1][k]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    if bm.calc_volume(signed=True) < 0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    data = bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    data.materials.append(mat)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return obj


def _box_object(name, lo, hi, mat):
    bm = bmesh.new()
    center = (Vector(lo) + Vector(hi)) / 2
    size = Vector(hi) - Vector(lo)
    bmesh.ops.create_cube(bm, size=1, matrix=Matrix.Translation(center) @ Matrix.Diagonal((*size, 1)))
    data = bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    data.materials.append(mat)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return obj


def boolean(target, tool, operation):
    bpy.context.view_layer.objects.active = target
    modifier = target.modifiers.new("renovation " + operation.lower(), "BOOLEAN")
    modifier.operation, modifier.solver, modifier.object = operation, "EXACT", tool
    modifier.material_mode = "TRANSFER"
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def boolean_preserving_islands(target, tool, operation="DIFFERENCE"):
    """Cut only native connected components whose bounds overlap the cutter.

    A material batch can contain many mutually overlapping but disconnected coastal rocks.
    Feeding that whole batch to an Exact Boolean can union or discard remote islands, even
    when the cutter misses them. Retain those components outside the Boolean and its cleanup.
    A completely disjoint object is left byte-for-byte untouched.
    """
    if operation != "DIFFERENCE":
        raise ValueError("island-preserving Boolean supports DIFFERENCE only")
    corners = [tool.matrix_world @ Vector(p) for p in tool.bound_box]
    cut_lo = Vector([min(p[k] for p in corners) for k in range(3)])
    cut_hi = Vector([max(p[k] for p in corners) for k in range(3)])
    bm = bmesh.new()
    bm.from_mesh(target.data)
    islands = _islands(bm)
    protected, affected = [], []
    for island in islands:
        points = [target.matrix_world @ v.co for v in island]
        lo = Vector([min(p[k] for p in points) for k in range(3)])
        hi = Vector([max(p[k] for p in points) for k in range(3)])
        overlap = all(lo[k] <= cut_hi[k] + 1e-5 and hi[k] >= cut_lo[k] - 1e-5 for k in range(3))
        (affected if overlap else protected).extend(v.index for v in island)
    if not affected:
        bm.free()
        return {"skippedDisjoint": True, "preservedVertices": len(protected), "affectedVertices": 0}
    saved = None
    if protected:
        frozen = bm.copy()
        frozen.verts.ensure_lookup_table()
        bmesh.ops.delete(frozen, geom=[frozen.verts[i] for i in affected], context="VERTS")
        saved = bpy.data.meshes.new("unaffected Boolean islands")
        frozen.to_mesh(saved)
        frozen.free()
        bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.verts[i] for i in protected], context="VERTS")
        bm.to_mesh(target.data)
    bm.free()
    original_materials = list(target.data.materials)
    boolean(target, tool, operation)
    open_edges = clean_solid(target)
    # Blender may remove unused slots while only the affected subset is present. Reinstate the
    # original indices before appending protected polygons, including their bedding material.
    result_materials = list(target.data.materials)
    complete_materials = original_materials + [m for m in result_materials if m not in original_materials]
    indices = [complete_materials.index(result_materials[p.material_index])
               if p.material_index < len(result_materials) else 0 for p in target.data.polygons]
    target.data.materials.clear()
    for material in complete_materials:
        target.data.materials.append(material)
    for polygon, index in zip(target.data.polygons, indices):
        polygon.material_index = index
    if saved:
        combined = bmesh.new()
        combined.from_mesh(target.data)
        combined.from_mesh(saved)
        combined.to_mesh(target.data)
        combined.free()
        bpy.data.meshes.remove(saved)
    return {"skippedDisjoint": False, "preservedVertices": len(protected),
            "affectedVertices": len(affected), "cutNonManifold": open_edges}


def clean_solid(obj):
    """Weld, close coplanar boundary loops left on cut planes, orient outward; return open edges."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00005)
    boundary = [e for e in bm.edges if e.is_boundary]
    if boundary:
        bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    open_edges = sum(1 for e in bm.edges if not e.is_manifold)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return open_edges


def deepen_cave(scene):
    """Carve the excavation DEPTH further inland, once, and lift the new vault with the roof."""
    if scene.get("caveDeepened"):
        return None
    mainland = bpy.data.objects["core__golden coastal sandstone"]
    plaster = bpy.data.materials["chalk limestone"]
    rock = bpy.data.materials["golden coastal sandstone"]
    cutter = _prism("cave deepening tool", arch_points(), "y", NEW_BACK, OLD_BACK + 0.08, plaster)
    boolean(mainland, cutter, "DIFFERENCE")
    bpy.data.objects.remove(cutter, do_unlink=True)
    open_edges = clean_solid(mainland)
    assert open_edges == 0, f"the deepened mainland has {open_edges} open edges"
    hit, location, _, _ = mainland.ray_cast(Vector((0.0, 0.0, 1.5)), Vector((0, -1, 0)))
    assert hit and abs(location.y - NEW_BACK) < 0.05, f"the new back wall is not at {NEW_BACK}: {location}"
    # The vault over the new depth becomes a second lift-away solid, cut on the same planes as the
    # first (z 3.9, x +-5.65) and stopping 13 cm short of the back wall, as the first does.
    box = _box_object("rear ceiling partition", (-5.65, NEW_BACK + 0.13, 3.9), (5.65, -5.35, 30.0), rock)
    rear = mainland.copy()
    rear.data = mainland.data.copy()
    scene.collection.objects.link(rear)
    boolean(rear, box, "INTERSECT")
    boolean(mainland, box, "DIFFERENCE")
    bpy.data.objects.remove(box, do_unlink=True)
    report = {"mainlandOpenEdges": clean_solid(mainland), "rearCeilingOpenEdges": clean_solid(rear)}
    assert report["mainlandOpenEdges"] == 0 and report["rearCeilingOpenEdges"] == 0, report
    for key in list(rear.keys()):
        del rear[key]
    rear.name = rear.data.name = "core_liftaway_cave_ceiling_rear"
    rear["closedSolid"] = True
    rear["caveRoof"] = True
    rear["cutawaySection"] = "inhabited-roof"
    scene["caveDeepened"] = DEPTH
    report.update(backWall=round(location.y, 3), rearCeilingVertices=len(rear.data.vertices), mainlandVertices=len(mainland.data.vertices))
    return report


# Islands: the batched house meshes hold many separate pieces, moved or removed one at a time.

def _islands(bm):
    bm.verts.ensure_lookup_table()
    seen, out = set(), []
    for start in bm.verts:
        if start.index in seen:
            continue
        stack, island = [start], []
        seen.add(start.index)
        while stack:
            v = stack.pop()
            island.append(v)
            for e in v.link_edges:
                w = e.other_vert(v)
                if w.index not in seen:
                    seen.add(w.index)
                    stack.append(w)
        out.append(island)
    return out


def edit_islands(obj, keep):
    """Visit every island as (verts, world bounds lo, hi); `keep` returns a world-space delta to
    move it, False to delete it, or None to leave it. Returns (moved, deleted)."""
    to_world = obj.matrix_world
    to_local = to_world.inverted().to_3x3()
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    moved = deleted = 0
    doomed = []
    for island in _islands(bm):
        points = [to_world @ v.co for v in island]
        lo = Vector([min(p[k] for p in points) for k in range(3)])
        hi = Vector([max(p[k] for p in points) for k in range(3)])
        verdict = keep(lo, hi)
        if verdict is False:
            doomed.extend(island)
            deleted += 1
        elif verdict is not None:
            delta = to_local @ Vector(verdict)
            for v in island:
                v.co += delta
            moved += 1
    if doomed:
        bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return moved, deleted


def inside(lo, hi, box_lo, box_hi):
    return all(box_lo[k] <= lo[k] and hi[k] <= box_hi[k] for k in range(3))


def is_floorboard(lo, hi):
    size = hi - lo
    middle = (lo.z + hi.z) / 2
    return abs(size.z - 0.023) < 0.004 and abs(size.x - 0.294) < 0.012 and size.y > 0.03 and (abs(middle + 0.009) < 0.006 or abs(middle - (RISE - 0.009)) < 0.006)


def move_back(scene):
    """Move the stair, the cupboards, the rounded corners and the back-wall art inland with the
    wall; remove the old floors, upper slab and alcove returns that the new plan replaces. Once."""
    if scene.get("houseFittingsMoved"):
        return None
    back = (0.0, -DEPTH, 0.0)
    report = {"floorboardsRemoved": 0, "stairPieces": 0, "cupboardPieces": 0, "cornerReturns": 0, "alcoveReturnsRemoved": 0}
    core = [o for o in scene.objects if o.type == "MESH" and o.name.startswith("core__")]
    oak = bpy.data.objects["core__pale oak"]
    report["floorboardsRemoved"] = edit_islands(oak, lambda lo, hi: False if is_floorboard(lo, hi) else None)[1]
    stair_box = ((-2.25, -5.3, -0.05), (2.5, -4.0, 3.65))
    cupboards = (((-4.85, -5.3, -0.01), (-2.15, -4.69, 1.95)), ((2.2, -5.3, -0.01), (4.85, -4.69, 1.95)))
    corners = (((-4.95, -5.3, 2.5), (-4.3, -4.2, 4.9)), ((4.3, -5.3, 2.5), (4.95, -4.2, 4.9)))
    for obj in core:
        def verdict(lo, hi):
            if inside(lo, hi, *stair_box):
                report["stairPieces"] += 1
                return back
            if any(inside(lo, hi, *b) for b in cupboards):
                report["cupboardPieces"] += 1
                return back
            if obj.name == "core__chalk limestone" and any(inside(lo, hi, *b) for b in corners):
                report["cornerReturns"] += 1
                return back
            return None
        edit_islands(obj, verdict)
    plaster = bpy.data.objects["core__chalk limestone"]
    returns = (((-1.95, -5.25, 2.55), (-1.55, -3.4, 3.85)), ((1.7, -5.25, 2.55), (2.1, -3.4, 3.85)))

    def plaster_verdict(lo, hi):
        size = hi - lo
        if any(inside(lo, hi, *b) for b in returns):
            report["alcoveReturnsRemoved"] += 1
            return False
        # The old upper floor slab.
        if size.x > 9.0 and abs(lo.y + 5.3) < 0.05 and abs(hi.y - GALLERY_EDGE) < 0.05 and lo.z > 2.3 and hi.z < 2.6:
            report["upperSlabRemoved"] = True
            return False
        return None

    edit_islands(plaster, plaster_verdict)
    stone = bpy.data.objects["core__warm cut stone"]

    def ground_verdict(lo, hi):
        size = hi - lo
        if size.x > 9.4 and size.y > 9.9 and hi.z < 0.0 and lo.z > -0.3:
            report["groundSlabRemoved"] = True
            return False
        return None

    edit_islands(stone, ground_verdict)
    # Art hung on the old back wall: the bedroom's seascape and the onsen's slat panel.
    for obj in [o for o in scene.objects if o.type == "MESH" and o.name.startswith("sleep_decor")]:
        edit_islands(obj, lambda lo, hi: back if hi.y < -5.3 else None)
    panel = bpy.data.objects.get("onsen_decor cedar wood")
    if panel:
        report["onsenPanelPieces"] = edit_islands(panel, lambda lo, hi: back if hi.y < -5.3 else None)[0]
    old_screens = bpy.data.objects.get("core_facade__cedar_wood")
    if old_screens:
        bpy.data.objects.remove(old_screens, do_unlink=True)
        report["oldScreensRemoved"] = True
    assert report.get("upperSlabRemoved") and report.get("groundSlabRemoved"), report
    assert report["stairPieces"] >= 30, report
    scene["houseFittingsMoved"] = True
    return report


# New shell pieces (rebuilt on every run) ------------------------------------------------------

def from_bmesh(name, bm, mat, smooth=True):
    data = bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = smooth
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj["renovationShell"] = True
    return obj


def rounded_slab(bm_target, outline, z0, z1, radius, segments=3):
    """A flat slab from a plan outline with every edge rounded."""
    bm = bmesh.new()
    bottom = [bm.verts.new((x, y, z0)) for x, y in outline]
    top = [bm.verts.new((x, y, z1)) for x, y in outline]
    bm.faces.new(list(reversed(bottom)))
    bm.faces.new(top)
    n = len(outline)
    for k in range(n):
        bm.faces.new((bottom[k], bottom[(k + 1) % n], top[(k + 1) % n], top[k]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    if radius:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=radius, offset_type="OFFSET", segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True)
    data = bpy.data.meshes.new("tmp")
    bm.to_mesh(data)
    bm.free()
    bm_target.from_mesh(data)
    bpy.data.meshes.remove(data)


def board(bm, x0, x1, y0, y1, z_top, thickness=0.022, chamfer=0.003):
    """One floorboard with eased top edges, so the seams read as soft shadow lines."""
    temp = bmesh.new()
    center = ((x0 + x1) / 2, (y0 + y1) / 2, z_top - thickness / 2)
    bmesh.ops.create_cube(temp, size=1, matrix=Matrix.Translation(center) @ Matrix.Diagonal((x1 - x0, y1 - y0, thickness, 1)))
    top_edges = [e for e in temp.edges if all(v.co.z > z_top - 0.001 for v in e.verts)]
    bmesh.ops.bevel(temp, geom=top_edges, offset=chamfer, offset_type="OFFSET", segments=2, profile=0.5, affect="EDGES", clamp_overlap=True)
    data = bpy.data.meshes.new("tmp")
    temp.to_mesh(data)
    temp.free()
    bm.from_mesh(data)
    bpy.data.meshes.remove(data)


def lay_floor(bm, x0, x1, y0, y1, z_top, skip=None, width=0.26, seed=23):
    """Wide oak boards in running bond along Y; `skip(x, ya, yb)` leaves out an opening."""
    rng = random.Random(seed)
    columns = int(round((x1 - x0) / width))
    width = (x1 - x0) / columns
    count = 0
    for col in range(columns):
        xa, xb = x0 + col * width + 0.0008, x0 + (col + 1) * width - 0.0008
        y = y0 - rng.uniform(0.0, 1.6)
        while y < y1:
            length = rng.uniform(1.5, 2.6)
            ya, yb = max(y, y0), min(y + length, y1)
            y += length
            if yb - ya < 0.12:
                continue
            if skip and skip((xa + xb) / 2, ya, yb):
                pieces = skip((xa + xb) / 2, ya, yb)
                if pieces is True:
                    continue
                for pa, pb in pieces:
                    if pb - pa >= 0.12:
                        board(bm, xa, xb, pa + 0.0008, pb - 0.0008, z_top)
                        count += 1
                continue
            board(bm, xa, xb, ya + 0.0008, yb - 0.0008, z_top)
            count += 1
    return count


def build_floors(scene):
    """Slabs and boards for both storeys over the deepened plan."""
    for obj in [o for o in scene.objects if o.name.startswith("core_reno_floor") or o.name.startswith("core_reno_slab")]:
        bpy.data.objects.remove(obj, do_unlink=True)
    stone = bpy.data.materials["warm cut stone"]
    plaster = bpy.data.materials["chalk limestone"]
    oak = bpy.data.materials["pale oak"]
    out = []
    bm = bmesh.new()
    rounded_slab(bm, [(-4.8, LOWER_BACK), (4.8, LOWER_BACK), (4.8, 3.7), (4.3, 4.8), (-3.95, 4.8), (-4.8, 4.0)], -0.28, -0.022, 0.12, 3)
    out.append(from_bmesh("core_reno_slab_ground", bm, stone))
    (nx0, nx1), (ny0, ny1) = NOTCH["x"], NOTCH["y"]
    bm = bmesh.new()
    rounded_slab(bm, [(-4.7, UPPER_BACK), (nx0, UPPER_BACK), (nx0, ny1), (nx1, ny1), (nx1, UPPER_BACK), (4.7, UPPER_BACK), (4.7, GALLERY_EDGE), (-4.7, GALLERY_EDGE)], RISE - 0.24, RISE - 0.022, 0.12, 4)
    out.append(from_bmesh("core_reno_slab_upper", bm, plaster))
    # The ground floor's boards stop at the glass front; the upper floor's leave the stair open.
    bm = bmesh.new()
    lower = lay_floor(bm, -4.6, 4.6, LOWER_BACK + 0.12, 4.45, 0.0025, seed=23)
    out.append(from_bmesh("core_reno_floorboards_lower", bm, oak))

    def notch(x, ya, yb):
        if not (nx0 - 0.02 < x < nx1 + 0.02):
            return None
        if yb <= ny1 + 0.002:
            return True
        if ya < ny1 + 0.002:
            return [(ny1 + 0.002, yb)]
        return None

    bm = bmesh.new()
    upper = lay_floor(bm, -4.6, 4.6, UPPER_BACK + 0.12, GALLERY_EDGE - 0.01, RISE + 0.0025, skip=notch, seed=31)
    out.append(from_bmesh("core_reno_floorboards_upper", bm, oak))
    return out, {"lowerBoards": lower, "upperBoards": upper}


def build_screens(scene, rail_height=0.92):
    """Cedar slat screens between the study and the two alcoves, and a slim guard along the stair
    opening's front edge where the upper walk passes it."""
    for obj in [o for o in scene.objects if o.name.startswith("core_reno_screens") or o.name.startswith("core_reno_stair_guard")]:
        bpy.data.objects.remove(obj, do_unlink=True)
    cedar = bpy.data.materials["cedar wood"]
    smoked = bpy.data.materials["honey ash"]
    brass = bpy.data.materials["brushed brass"]
    bm = bmesh.new()
    slat, gap, depth, top = 0.045, 0.024, 0.032, 4.85
    for x, y0, y1 in SCREENS.values():
        lo, hi = min(y0, y1), max(y0, y1)
        for z in (RISE + 0.05, top - 0.04):
            _rounded_box(bm, (x, (lo + hi) / 2, z), (depth + 0.012, hi - lo, 0.05), 0.008)
        y = lo
        while y + slat <= hi + 1e-6:
            _rounded_box(bm, (x, y + slat / 2, (RISE + top) / 2), (depth, slat, top - RISE), 0.01)
            y += slat + gap
    out = [from_bmesh("core_reno_screens", bm, cedar)]
    # The guard: smoked oak posts and handrail, brass rods between them.
    (nx0, nx1), (_, ny1) = NOTCH["x"], NOTCH["y"]
    y = ny1 + 0.03
    rail, rods = bmesh.new(), bmesh.new()
    _rounded_box(rail, ((nx0 + nx1) / 2, y, RISE + rail_height), (nx1 - nx0 + 0.06, 0.05, 0.04), 0.012)
    for x in (nx0 + 0.02, nx1 - 0.02):
        _rounded_box(rail, (x, y, RISE + rail_height / 2), (0.045, 0.045, rail_height), 0.01)
    k = 0
    x = nx0 + 0.14
    while x < nx1 - 0.08:
        _cylinder(rods, (x, y, RISE + 0.02), (x, y, RISE + rail_height - 0.02), 0.008, 10)
        x += 0.12
        k += 1
    out.append(from_bmesh("core_reno_stair_guard", rail, smoked))
    out.append(from_bmesh("core_reno_stair_guard_rods", rods, brass))
    return out


def _rounded_box(bm, center, size, radius):
    temp = bmesh.new()
    bmesh.ops.create_cube(temp, size=1, matrix=Matrix.Translation(center) @ Matrix.Diagonal((*size, 1)))
    if radius > 0:
        bmesh.ops.bevel(temp, geom=list(temp.edges), offset=min(radius, min(size) * 0.45), offset_type="OFFSET", segments=3, profile=0.5, affect="EDGES", clamp_overlap=True)
    data = bpy.data.meshes.new("tmp")
    temp.to_mesh(data)
    temp.free()
    bm.from_mesh(data)
    bpy.data.meshes.remove(data)


def _cylinder(bm, start, end, radius, segments=12):
    axis = Vector(end) - Vector(start)
    rotation = axis.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
    m = Matrix.Translation((Vector(start) + Vector(end)) / 2) @ rotation
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=axis.length, matrix=m)


def bedroom_back(scene):
    """The bedroom's new depth: a light-oak wardrobe along the south wall behind the bed, kept inside
    the vault's curve (the rock leans in to x = 4.49 at the wardrobe's top)."""
    for obj in [o for o in scene.objects if o.name.startswith("sleep_reno_")]:
        bpy.data.objects.remove(obj, do_unlink=True)
    oak = bpy.data.materials["pale oak"]
    smoked = bpy.data.materials["honey ash"]
    nickel = bpy.data.materials["polished nickel"]
    body, plinth, pulls = bmesh.new(), bmesh.new(), bmesh.new()
    x0, x1, y0, y1, h = -4.4, -3.85, -7.4, -5.1, 1.85
    _rounded_box(plinth, ((x0 + x1) / 2 + 0.02, (y0 + y1) / 2, RISE + 0.04), (x1 - x0 - 0.04, y1 - y0 - 0.04, 0.08), 0.01)
    _rounded_box(body, ((x0 + x1) / 2, (y0 + y1) / 2, RISE + 0.08 + (h - 0.08) / 2), (x1 - x0, y1 - y0, h - 0.08), 0.012)
    doors = 4
    for k in range(doors):
        ya = y0 + (y1 - y0) * k / doors
        yb = y0 + (y1 - y0) * (k + 1) / doors
        _rounded_box(body, (x1 + 0.008, (ya + yb) / 2, RISE + 0.08 + (h - 0.08) / 2), (0.02, yb - ya - 0.01, h - 0.12), 0.006)
        py = yb - 0.06 if k % 2 == 0 else ya + 0.06
        _cylinder(pulls, (x1 + 0.035, py, RISE + 0.85), (x1 + 0.035, py, RISE + 1.2), 0.008, 10)
    return [from_bmesh("sleep_reno_wardrobe", body, oak), from_bmesh("sleep_reno_wardrobe_plinth", plinth, smoked), from_bmesh("sleep_reno_wardrobe_pulls", pulls, nickel)]
