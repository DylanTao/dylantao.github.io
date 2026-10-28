"""Retained-source architectural finish, in final native metres (+Y sea, +Z up).

This module never rebuilds the house from an older whole-house recipe. Complete
retained furniture/plant islands survive unless a named physical change owns them.
The refresh entry point writes a candidate first and binds its native receipts.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

from coastal_office import Parts, box, cylinder
import coastal_estate_architecture as library
import coastal_shell as shell

VERSION = 1


def native(point):
    return Vector((point[0], -point[2], point[1]))


def world(point):
    return [point[0], point[2], -point[1]]


def bounds(vertices):
    return (Vector([min(v[k] for v in vertices) for k in range(3)]),
            Vector([max(v[k] for v in vertices) for k in range(3)]))


def components(bm):
    pending = set(bm.verts)
    result = []
    while pending:
        seed = pending.pop()
        group, stack = {seed}, [seed]
        while stack:
            vertex = stack.pop()
            for edge in vertex.link_edges:
                neighbor = edge.other_vert(vertex)
                if neighbor in pending:
                    pending.remove(neighbor)
                    group.add(neighbor)
                    stack.append(neighbor)
        result.append(list(group))
    return result


def edit_islands(obj, select, transform=None):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    inverse = obj.matrix_world.inverted()
    selected, receipts = [], []
    for island in components(bm):
        lo, hi = bounds([obj.matrix_world @ v.co for v in island])
        if not select(lo, hi):
            continue
        receipts.append({"lo": list(lo), "hi": list(hi), "vertices": len(island)})
        if transform:
            for vertex in island:
                vertex.co = inverse @ transform(obj.matrix_world @ vertex.co)
        else:
            selected += island
    if selected:
        bmesh.ops.delete(bm, geom=selected, context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return receipts


def inside(lo, hi, a, b, epsilon=.002):
    return all(lo[k] >= a[k] - epsilon and hi[k] <= b[k] + epsilon for k in range(3))


def remove_prefixes(scene, prefixes):
    removed = []
    for obj in list(scene.objects):
        if obj.name.startswith(prefixes):
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    return removed


def add_box(name, material, lo, hi, radius=.01, **tags):
    p = Parts(name)
    lo, hi = Vector(lo), Vector(hi)
    box(p.bm(material), (lo + hi) / 2, hi - lo, radius, segments=4)
    objects = p.finish()
    for obj in objects:
        for key, value in tags.items():
            obj[key] = value
    return objects


def cut(scene, name, lo, hi, targets, material, radius=0):
    tool = add_box(name, material, lo, hi, radius)[0]
    result = []
    for obj in targets:
        if obj.name == "core__golden coastal sandstone" or obj.get("closedSolid"):
            # The legacy helper's 50um whole-object weld can join remote close
            # cliff edges (v1 retained a four-face edge at x=7.502, 16m away).
            # An Exact Boolean already returns the cut topology; limit any
            # identical-position weld to the tool neighborhood, at 1um.
            shell.boolean(obj, tool, "DIFFERENCE")
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            candidates = [v for v in bm.verts if all(lo[k] - .02 <= (obj.matrix_world @ v.co)[k] <= hi[k] + .02 for k in range(3))]
            bmesh.ops.remove_doubles(bm, verts=candidates, dist=1e-6)
            nonmanifold = sum(not edge.is_manifold for edge in bm.edges)
            bm.to_mesh(obj.data)
            bm.free()
            receipt = {"skippedDisjoint": False, "localWeldVertices": len(candidates), "cutNonManifold": nonmanifold}
            if nonmanifold:
                raise RuntimeError(f"Local aperture made {obj.name} nonmanifold: {nonmanifold} edges")
        else:
            receipt = shell.boolean_preserving_islands(obj, tool)
        if not receipt.get("skippedDisjoint"):
            result.append({"mesh": obj.name, **receipt})
    bpy.data.objects.remove(tool, do_unlink=True)
    return result


def clear_cross_shelf(scene, config):
    """Remove only the old desk-width shelf islands; the desk remains untouched."""
    receipts = []
    for obj in scene.objects:
        if not obj.name.startswith("study_") or obj.type != "MESH":
            continue
        removed = edit_islands(obj, lambda lo, hi: inside(lo, hi, (-11.84, -7.12, -.05), (-9.36, -6.65, 2.18)))
        if removed:
            receipts.append({"mesh": obj.name, "islands": removed})
    # Four record sleeves remain functional, on a real fitted display ledge in
    # the west book wall's 2.2m band. The turntable and research papers stay on the L.
    oak = bpy.data.materials["honey ash"]
    add_box("study_wall_record_ledge", oak, (-12.15, -6.91, 1.945), (-11.83, -5.30, 1.975), .006)
    wall_record_backrail()
    desk = next(r for r in config["rooms"] if r["id"] == "study")["desk"]
    old_records = desk["records"]
    desk["records"] = [[-11.90, 2.15, 5.52 + .38 * k] for k in range(4)]
    desk["recordYaw"] = math.pi / 2 + .05
    return {"removed": receipts, "recordDisplayBefore": old_records, "recordDisplayAfter": desk["records"],
            "preserved": "L desk, monitors, PC, turntable, papers, task lamp and seated work station"}


def wall_record_backrail():
    p=Parts("study_wall_record_backrail")
    wood=p.bm(bpy.data.materials["honey ash"])
    for y in (-5.42,-6.11,-6.80):
        box(wood,(-11.94,y,2.061),(.022,.022,.20),.005)
    box(wood,(-11.94,-6.11,2.151),(.020,1.40,.020),.006)
    return [obj.name for obj in p.finish()]


def fit_record_backrail(scene,config):
    obj=scene.objects["study__honey ash"]
    retired=edit_islands(obj,lambda lo,hi:inside(lo,hi,(-11.85,-7.12,1.95),(-9.35,-6.65,2.17)))
    if len(retired)!=4:raise RuntimeError(f"Expected the exact three posts plus old top backrail; found{len(retired)}")
    return {"retiredWholeParts":retired,"newRail":wall_record_backrail(),
            "supportTopNativeZ":1.975,"postBottomNativeZ":1.961,"designedEmbedM":.014,
            "reason":"Four record-rail parts extended above the old shelf selection and remained floating at the retired shelf footprint"}


def book_dividers(scene, config):
    """Retire complete books crossing the retained book-wall centre dividers."""
    paper = next(o for o in scene.objects if o.name == "library__library warm paper edges")
    bm = bmesh.new()
    bm.from_mesh(paper.data)
    bands = []
    for island in components(bm):
        lo, hi = bounds([paper.matrix_world @ v.co for v in island])
        for centre in (-7.7, -2.3):
            if lo.y < centre + .0275 and hi.y > centre - .0275:
                bands.append((Vector((lo.x - .015, lo.y - .006, lo.z - .007)),
                              Vector((hi.x + .015, hi.y + .006, hi.z + .007))))
    bm.free()
    result = []
    for obj in scene.objects:
        if obj.type != "MESH" or not obj.name.startswith("library__library "):
            continue
        removed = edit_islands(obj, lambda lo, hi: any(inside(lo, hi, a, b, .003) for a, b in bands))
        if removed:
            result.append({"mesh": obj.name, "removed": removed})
    return {"removedCompleteBookBands": [{"lo": list(a), "hi": list(b)} for a, b in bands],
            "parts": result, "builder": "_books now reserves a 55mm gap around each 35mm centre divider"}


def floor_layer_overlaps(scene, config):
    """Separate measured duplicate solid layers without changing a walking top."""
    import coastal_bathrooms as bathrooms
    result = {"bathroomStacks": [], "gymThreshold": []}
    for prefix, floor, slab_name, bottom in (("bath-living", 0., "core_bathwing_lower_slab__warm cut stone", -.26),
                                            ("bath-bedroom", 2.6, "core_bathwing_upper_slab__warm cut stone", 2.43)):
        slab = scene.objects[slab_name]
        vertices = [slab.matrix_world @ v.co for v in slab.data.vertices]
        old_lo, old_hi = bounds(vertices)
        inverse = slab.matrix_world.inverted()
        for vertex in slab.data.vertices:
            point = slab.matrix_world @ vertex.co
            point.z = bottom + (point.z - old_lo.z) / (old_hi.z - old_lo.z) * (floor - .043 - bottom)
            vertex.co = inverse @ point
        # The door's old threshold overlaid a 30cm strip of the tile carpet.
        threshold = scene.objects[prefix + "__honed travertine"]
        shortened = edit_islands(threshold,
            lambda lo, hi: inside(lo, hi, (-5.151, -13.751, floor - .037), (-4.209, -12.549, floor + .001)),
            lambda q: Vector((-4.85 + (q.x + 5.15) * (.64 / .94), q.y, q.z)))
        rectangles = []
        for obj in scene.objects:
            if obj.type != "MESH" or not obj.name.startswith(prefix + "__"):
                continue
            if not any(word in obj.name for word in ("travertine", "warm cut stone")):
                continue
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            for island in components(bm):
                lo, hi = bounds([obj.matrix_world @ v.co for v in island])
                if floor - .037 <= lo.z and hi.z <= floor + .001 and hi.z - lo.z > .025:
                    if hi.x > -8.25 and lo.x < -4.85 and hi.y > -14.1 and lo.y < -9.85:
                        rectangles.append((lo.x, hi.x, lo.y, hi.y))
            bm.free()
        grout = scene.objects[prefix + "__bathroom warm mineral grout"]
        bm = bmesh.new()
        bathrooms.grout_heightfield(bm, (-8.25, -4.85, -14.10, -9.85), rectangles, floor)
        topology = {"boundaryEdges": sum(e.is_boundary for e in bm.edges),
                    "nonmanifoldEdges": sum(not e.is_manifold for e in bm.edges)}
        if topology["nonmanifoldEdges"]:
            raise RuntimeError(f"The physical grout bed is not closed: {topology}")
        bm.transform(grout.matrix_world.inverted())
        bm.to_mesh(grout.data)
        bm.free()
        result["bathroomStacks"].append({"room": prefix, "slabBefore": [old_lo.z, old_hi.z],
            "slabAfter": [bottom, floor - .043], "mortarBed": [floor - .043, floor - .036],
            "stoneTiles": [floor - .036, floor], "recessedJointTop": floor - .003,
            "thresholdParts": shortened, "tileRectangles": len(rectangles), "groutTopology": topology})
    threshold = scene.objects.get("core_retreat_gym_threshold__warm cut stone")
    if threshold:
        for name in ("core_gym_floor", "core_gym_passage_floor"):
            original = scene.objects.get(name)
            if original:
                before = len(threshold.data.polygons)
                shell.boolean(threshold, original, "DIFFERENCE")
                result["gymThreshold"].append({"support": name, "facesBefore": before,
                                               "facesAfter": len(threshold.data.polygons)})
    return result


def patio_door(scene, config):
    m = library.materials()
    # The original lower east bay occupies the new doorway. The upper bank is
    # above the 2.35m lintel and keeps the tall room's full wall-book character.
    retired = []
    for obj in scene.objects:
        if obj.type == "MESH" and obj.name.startswith("library__"):
            removed = edit_islands(obj, lambda lo, hi: inside(lo, hi, (-9.11, -3.49, -.05), (-8.35, -1.10, 2.31)))
            if removed:
                retired.append({"mesh": obj.name, "islands": removed})
    shortened = Parts("library_patio_book_bay")
    library._books(shortened, m, -8.73, -1.27, 0., 1, 271, length=.62)
    shortened.finish()
    # The retained library and courtyard rock voids already overlap here:
    # library to x=-8.35, courtyard from x=-8.43, both above floor. Only this
    # actual plaster liner closes the patio; do not Boolean a distant rock mass
    # whose AABB overlaps but whose solid does not occupy the doorway.
    targets = [o for o in scene.objects if o.name == "core_retreat_library__chalk limestone"]
    opening = cut(scene, "library patio real aperture", (-8.78, -3.34, 0), (-8.30, -1.76, 2.35), targets, m["plaster"])
    guard_opening = patio_guard_opening(scene, config)
    x, z0, z1 = -8.49, 1.80, 3.30
    p = Parts("library_patio_frame")
    bronze = p.bm(m["bronze"])
    for z in (z0 - .025, z1 + .025):
        box(bronze, (x, -z, 1.17), (.085, .05, 2.34), .009)
    box(bronze, (x, -(z0 + z1) / 2, 2.34), (.085, z1 - z0 + .10, .065), .009)
    p.finish()
    # Estate leaves are registered from the always-loaded shell by the runtime.
    leaf = Parts("core_library_patio_door")
    glass, bronze = leaf.bm(m["glass"]), leaf.bm(m["bronze"])
    box(glass, (x, -(z0 + z1) / 2, 1.155), (.018, z1 - z0 - .08, 2.24), .004)
    for z in (z0 + .02, z1 - .02):
        box(bronze, (x, -z, 1.155), (.042, .035, 2.28), .006)
    for h in (.035, 2.275):
        box(bronze, (x, -(z0 + z1) / 2, h), (.042, z1 - z0, .035), .006)
    cylinder(bronze, (x - .055, -(z0 + .13), .94), (x - .055, -(z0 + .13), 1.17), .012, 12)
    made = leaf.finish()
    for obj in made:
        obj["estateDoor"] = "library-patio"
        obj["installationGroup"] = "library"
    add_box("library_patio_threshold", m["travertine"], (-8.78, -3.35, -.015), (-8.27, -1.75, .005), .004)
    config["estateDoors"] = [d for d in config["estateDoors"] if d["id"] != "library-patio"] + [
        {"id": "library-patio", "nodes": [o.name for o in made],
         "pivot": {"x": x, "z": z1, "angle": -math.pi / 2},
         "center": [x, 1.155, (z0 + z1) / 2],
         "opening": {"min": [-8.78, 0, z0], "max": [-8.27, 2.31, z1]},
         "activationDistance": 1.85, "floor": 0,
         "material": "clear low-iron glass in a slim bronze outward-pivot frame"}]
    config["terrain"]["supportSurfaces"].append({"id": "library-patio-threshold", "height": 0,
        "polygon": [[-8.78, z0 - .05], [-8.27, z0 - .05], [-8.27, z1 + .05], [-8.78, z1 + .05]]})
    config["estateLibrary"]["patioDoor"] = {"id": "library-patio", "route": [[-9.41, 0, 2.55], [-8.5, 0, 2.55], [-7.95, 0, 2.55]],
                                                "seaEnd": True, "width": z1 - z0, "clearHeight": 2.31}
    return {"retiredLowerBay": retired, "opening": opening, "guardOpening": guard_opening, "door": config["estateDoors"][-1],
            "route": config["estateLibrary"]["patioDoor"]["route"]}


def patio_leaf_export_ownership(scene, config):
    """Put the existing real leaf in the runtime's shell-owned door registry."""
    moved = []
    for obj in list(scene.objects):
        if obj.get("estateDoor") == "library-patio" and obj.name.startswith("library_patio_door__"):
            before = obj.name
            obj.name = "core_" + before
            moved.append({"before": before, "after": obj.name})
    if len(moved) != 2:
        raise RuntimeError(f"Expected the exact existing glass and bronze leaf parts, got{len(moved)}")
    door = next(d for d in config["estateDoors"] if d["id"] == "library-patio")
    door["nodes"] = [row["after"] for row in moved]
    return {"parts": moved, "scope": "Export ownership only; original vertices, pivot, glass, hardware and sensors remain fixed"}


def spiral_wardrobe_termination(scene, config):
    """Cap the overrun against the actual cabinet, retaining its guard interval.

    A difference against the real beveled wardrobe makes an abutting wood end,
    rather than burying the rail or hiding it under a decorative escutcheon.
    The tall closed cabinet fills the interval between the remaining rail ends.
    """
    rail=scene.objects["core_finish_bedroom_spiral__honey ash"]
    cabinet=scene.objects["sleep_reno_wardrobe__pale oak"]
    def key(face,mesh,obj):
        return tuple(sorted(tuple(obj.matrix_world@mesh.vertices[i].co) for i in face.vertices))
    original={key(face,rail.data,rail) for face in rail.data.polygons}
    before={"vertices":len(rail.data.vertices),"polygons":len(rail.data.polygons)}
    shell.boolean(rail,cabinet,"DIFFERENCE")
    bm=bmesh.new();bm.from_mesh(rail.data)
    nonmanifold=sum(not edge.is_manifold for edge in bm.edges);bm.free()
    if nonmanifold:raise RuntimeError("The real wardrobe termination did not leave a closed handrail")
    cabinet.data.calc_loop_triangles()
    host=BVHTree.FromPolygons([cabinet.matrix_world@vertex.co for vertex in cabinet.data.vertices],
        [list(face.vertices) for face in cabinet.data.loop_triangles],all_triangles=True)
    contacts=[]
    for face in rail.data.polygons:
        if key(face,rail.data,rail) in original:continue
        points=[rail.matrix_world@rail.data.vertices[i].co for i in face.vertices]
        center=sum(points,Vector())/len(points)
        probes=points+[(a+b)/2 for a,b in zip(points,points[1:]+points[:1])]+[center]
        witnesses=[host.find_nearest(point) for point in probes]
        if not all(hit[0] is not None and hit[3]<3e-5 for hit in witnesses):continue
        if face.area<1e-8:continue
        contacts.append({"nativePolygon":face.index,"nativeCenter":list(center),"areaM2":face.area,
            "maximumHostDistanceM":max(hit[3] for hit in witnesses),
            "nativeVertices":[list(p) for p in points],"opposingFaceNormalDot":min(face.normal.dot(hit[1]) for hit in witnesses)})
    if not contacts or sum(face["areaM2"] for face in contacts)<.001:
        raise RuntimeError("No actual capped rail bearing was found on the wardrobe")
    rail["closedSolid"]=True
    rail["wardrobeTermination"]="Capped flush to the actual beveled wardrobe; no rail remains inside its solid"
    receipt={"rail":rail.name,"host":cabinet.name,"before":before,
        "after":{"vertices":len(rail.data.vertices),"polygons":len(rail.data.polygons)},
        "method":"Exact difference against the actual beveled cabinet, leaving real abutting closed end caps",
        "contacts":contacts,"nonmanifoldEdges":nonmanifold,
        "preserved":"All cabinet geometry, stair treads, posts, walk radii and routes remain unchanged; the1.77m-high cabinet fills the guarded interval"}
    config["estateLibrary"]["adjacentBedchamber"]["wardrobeRailTermination"]={
        "rail":rail.name,"host":cabinet.name,"method":receipt["method"],
        "nativeCapCenters":[row["nativeCenter"] for row in contacts],
        "cabinetTopNativeZ":3.35,"railTopNativeZ":2.486,"bodyRoutesUnchanged":True}
    return receipt


def bath_roof_reveal(scene, config):
    """Separate two actual down-facing roofs at the new bedroom threshold."""
    roof=scene.objects["core_bathwing_liftaway_roof"]
    before=[vertex.co.copy() for vertex in roof.data.vertices]
    moved=[]
    inverse=roof.matrix_world.inverted()
    for vertex in roof.data.vertices:
        point=roof.matrix_world@vertex.co
        if abs(point.z-5.17)<1e-5:
            point.z=5.178
            vertex.co=inverse@point
            moved.append(vertex.index)
    if not moved:raise RuntimeError("The retained lower roof reveal plane was not found")
    roof.data.update()
    bm=bmesh.new();bm.from_mesh(roof.data)
    nonmanifold=sum(not edge.is_manifold for edge in bm.edges);bm.free()
    if nonmanifold:raise RuntimeError("The physical roof reveal opened its solid")
    unchanged=sum(vertex.co==point for vertex,point in zip(roof.data.vertices,before))
    config["estateLibrary"]["adjacentBedchamber"]["roofReveal"]={
        "mesh":roof.name,"lowerPlaneBeforeNativeZ":5.17,"lowerPlaneNativeZ":5.178,"gapM":.008,
        "scope":"Only the separate bathwing roof underside; all roof tops, treads, floors, core and coast remain fixed"}
    return {**config["estateLibrary"]["adjacentBedchamber"]["roofReveal"],
        "movedVertices":moved,"unchangedVertices":unchanged,"nonmanifoldEdges":nonmanifold}


def patio_guard_opening(scene, config):
    """Open the redundant terrace guard at the real library-patio door.

    Both sides here are the same supported courtyard floor. Retain the glass
    and handrail elsewhere, including the actual sea-side drop protection.
    """
    targets = [obj for obj in scene.objects if obj.type == "MESH" and
               obj.name in ("core_estate_guard__facade low-iron glass", "core_estate_terrace__brushed brass")]
    return cut(scene, "library patio guard aperture", (-8.57, -3.34, -.03), (-8.20, -1.76, 1.20),
               targets, library.materials()["plaster"])


def cloud_station(scene, config):
    room = next(r for r in config["rooms"] if r["id"] == "lounge")
    before = list(room["actor"])
    delta=.10-room["actor"][0]
    room["actor"][0] = .10
    if room.get("exitPath"):
        room["exitPath"][0][0] += delta
    contact = config["terrain"]["contacts"]["lounge"]
    contact["actor"] = list(room["actor"])
    if room.get("exitPath"):
        contact["exitPath"] = [list(q) for q in room["exitPath"]]
    anchor = scene.objects.get("anchor_lounge")
    if anchor:
        anchor.location.x += delta
    return {"before": before, "after": room["actor"], "inwardMetres": delta,
            "intent": "Move the actor into the sofa's broad padded bay; preserve the authored sofa and furniture anchor"}


def rounded_profile(cx, h0, h1, width, radius, segments=8):
    points = []
    for x, h, start in ((cx + width / 2 - radius, h0 + radius, -math.pi / 2),
                        (cx + width / 2 - radius, h1 - radius, 0),
                        (cx - width / 2 + radius, h1 - radius, math.pi / 2),
                        (cx - width / 2 + radius, h0 + radius, math.pi)):
        for k in range(segments + 1):
            a = start + math.pi / 2 * k / segments
            points.append((x + radius * math.cos(a), h + radius * math.sin(a)))
    return points


def gesture_loop(name, material, cx, cy, base):
    bm = bmesh.new()
    rings = []
    for k in range(48):
        a = math.tau * k / 48
        # A single continuous, slightly asymmetric loop; no borrowed silhouette.
        rx = .145 * (1 + .10 * math.sin(a))
        centre = Vector((cx + rx * math.cos(a), cy, base + .245 + .215 * math.sin(a)))
        normal = Vector((math.cos(a), 0, math.sin(a)))
        rings.append([bm.verts.new(centre + normal * (.030 * math.cos(b)) + Vector((0, .030 * math.sin(b), 0)))
                      for b in (math.tau * j / 10 for j in range(10))])
    for k in range(len(rings)):
        for j in range(10):
            bm.faces.new((rings[k][j], rings[k][(j + 1) % 10], rings[(k + 1) % 48][(j + 1) % 10], rings[(k + 1) % 48][j]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def gesture_lean(name, material, cx, cy, base):
    bm = bmesh.new()
    rings = []
    for k in range(13):
        t = k / 12
        x = cx + .095 * math.sin(t * math.pi / 2)
        radius = .057 + .018 * math.sin(t * math.pi)
        rings.append([bm.verts.new((x + radius * math.cos(a), cy + radius * math.sin(a), base + .50 * t))
                      for a in (math.tau * j / 20 for j in range(20))])
    for low, high in zip(rings, rings[1:]):
        for k in range(20):
            bm.faces.new((low[k], low[(k + 1) % 20], high[(k + 1) % 20], high[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def corridor_niches(scene, config):
    m = library.materials()
    # A real20cm liner with a2cm back closes each18cm recess. The original
    # bathroom wall remains intact behind it. Its seaward
    # face leaves the existing 0.56m actor capsule clear, not a hole in bath privacy.
    front, back = 9.52, 9.72
    wall = add_box("core_finish_corridor_niche_wall", m["plaster"], (-8.25, -back, .02), (-4.80, -front, 2.34), .025)[0]
    centres = [-7.66, -6.51, -5.36]
    receipts = []
    for i, x in enumerate(centres):
        tool = shell._prism(f"rounded niche tool {i}", rounded_profile(x, .84, 2.12, .76, .20), "y", -9.70, -9.45, m["plaster"])
        shell.boolean(wall, tool, "DIFFERENCE")
        bpy.data.objects.remove(tool, do_unlink=True)
        # Plinth and sculpture meet without embedding complete objects in one another.
        add_box(f"core_finish_niche_plinth_{i}", m["travertine"], (x - .15, -9.695, .84), (x + .15, -9.535, .96), .018)
        if i == 0:
            sculpture = gesture_loop(f"core_finish_niche_loop_{i}", m["stone"], x, -9.615, .96)
            gesture = "one continuous loop"
        elif i == 1:
            sculpture = gesture_lean(f"core_finish_niche_lean_{i}", m["bronze"], x - .04, -9.615, .96)
            gesture = "one gently leaning column"
        else:
            profile = [(x - .135, .96), (x + .135, .96), (x + .16, 1.17), (x + .04, 1.48), (x - .08, 1.43), (x - .17, 1.15)]
            sculpture = shell._prism(f"core_finish_niche_counterpoise_{i}", profile, "y", -9.665, -9.565, m["stone"])
            bevel = sculpture.modifiers.new("soft sculpture arris", "BEVEL")
            bevel.width = .035
            bevel.segments = 4
            bpy.context.view_layer.objects.active = sculpture
            bpy.ops.object.modifier_apply(modifier=bevel.name)
            gesture = "one offset taper"
        sculpture["originalSculpture"] = True
        sculpture["designPrinciple"] = "Susan Kare: one clear gesture and a readable silhouette"
        light = add_box(f"core_finish_niche_light_{i}", m["light"], (x - .20, -9.69, 2.02), (x + .20, -9.665, 2.04), .005)
        for obj in light:
            obj["installationGlow"] = "corridor-niche"
        region = {"min": [x - .58, .01, 8.60], "max": [x + .58, 2.35, 9.80]}
        config["installationLines"].append({"id": f"corridor-niche-{i}", "a": [x - .20, 2.03, 9.665],
            "b": [x + .20, 2.03, 9.665], "intensity": .18, "schedule": "steps",
            "transport": True, "glowTag": "corridor-niche", "region": region})
        receipts.append({"centre": [x, 1.48, 9.61], "width": .76, "height": 1.28,
                         "depth": .18, "backThickness": .02, "gesture": gesture, "mesh": sculpture.name})
    if shell.clean_solid(wall):
        raise RuntimeError("Niche wall is not a closed solid")
    for obj in scene.objects:
        if obj.name.startswith("core_finish_niche") or obj == wall:
            obj["installationGroup"] = "gallery"
    return {"niches": receipts, "credit": "Original procedural sculptures. The clarity of each single gesture follows Susan Kare's design lessons; no sculpture is attributed to her and no named artwork is copied.",
            "frontWorldZ": front, "backWorldZ": back, "actorRouteCentreWorldZ": 9.05}


def fit_niches(scene, config):
    retired = remove_prefixes(scene, ("core_finish_corridor_niche_wall", "core_finish_niche_"))
    config["installationLines"] = [line for line in config["installationLines"] if not line["id"].startswith("corridor-niche-")]
    return {"retired": retired, "replacement": corridor_niches(scene, config),
            "rangeClearanceM": .035, "intent": "The same three original gestures fit the available wall, clear of the actual delivered range and hood"}


def hall_light(scene, config):
    m = library.materials()
    made = []
    fixtures = []
    # Two small real opal lenses under the low ceiling light the central well
    # during daytime too (the existing 'entrance' schedule has a 60% day floor).
    # Their receiver stops at the hall threshold, keeping the living light cap.
    for i, zw in enumerate((18.65, 20.75)):
        p = Parts(f"core_finish_hall_daylight_{i}")
        cylinder(p.bm(m["bronze"]), (.15, -zw, 5.96), (.15, -zw, 5.995), .085, 24)
        cylinder(p.bm(m["light"]), (.15, -zw, 5.945), (.15, -zw, 5.963), .064, 24)
        objects = p.finish()
        for obj in objects:
            obj["installationGroup"] = "arrival"
            if obj.name.endswith(m["light"].name):
                obj["installationGlow"] = "entrance"
        made += objects
        point = {"id": f"arrival-daylight-{i}", "position": [.15, 5.935, zw], "intensity": 1.7,
                 "color": [1., .84, .63], "schedule": "entrance", "transport": True,
                 "emitterRadius": .064, "glowTag": "entrance",
                 "region": {"min": [-3.45, -.1, 16.14], "max": [3.35, 7.3, 23.2]}}
        config["installationPoints"].append(point)
        fixtures.append(point)
    return {"fixtures": fixtures, "objects": [o.name for o in made],
            "intent": "A visible, softly lit stair well in daytime and at night; no alteration to the stair or its oculi"}


def bedside_accessories(scene, config):
    """Move complete lamp/book islands with the mirrored real bedside table."""
    room = next(room for room in config["rooms"] if room["id"] == "sleep")
    x, floor, zw = room["actor"]
    moved = []
    for obj in scene.objects:
        if obj.type != "MESH" or not obj.name.startswith("sleep_") or obj.get("bedding") or obj.name == "sleep__pale oak":
            continue
        count = edit_islands(obj, lambda lo, hi: inside(lo, hi,
            (x - 1.35, -zw + .66, floor + .01), (x - .70, -zw + 1.38, floor + 1.15)),
            lambda point: point + Vector((2.06, 0, 0)))
        if count:
            moved.append({"mesh": obj.name, "completeIslands": count, "translationNativeM": [2.06, 0, 0]})
    if not moved:
        raise RuntimeError("The old bedside lamp/book assembly was not found; refusing an empty correction")
    return {"moved": moved, "intent": "The whole table assembly occupies the east side, keeping the stair and real bedside transfer clear"}


def bedroom_plant_stems(scene, config):
    room = next(room for room in config["rooms"] if room["id"] == "sleep")
    x, h, z = room["actor"]
    old = Vector((x+1.05,-z+1.26,h))
    target = native([-5.65,h,4.80])
    delta = target-old
    obj = scene.objects["sleep__honey ash"]
    moved = edit_islands(obj,lambda lo,hi: inside(lo,hi,old+Vector((-.60,-.60,.15)),old+Vector((.60,.60,.90))),lambda point:point+delta)
    if len(moved)!=11:
        raise RuntimeError(f"Expected eleven retained whole plant stems, got{len(moved)}")
    return {"mesh":obj.name,"completeStems":moved,"translationNativeM":list(delta),
            "preserved":"All original stem/leaf/vessel geometry; the wooden stems now accompany the moved soil and leaves"}


def transformed_point(point, origin, destination, yaw):
    q = native(point) - native(origin)
    return world(Matrix.Rotation(yaw, 3, "Z") @ q + native(destination))


def fit_desk_to_stair(scene, config):
    """Keep the work contact fixed; free a real capsule-width route at its return."""
    import coastal_office as office
    pc = []
    for obj in scene.objects:
        if obj.type == "MESH" and obj.name.startswith("study_"):
            moved = edit_islands(obj, lambda lo, hi: inside(lo, hi, (-9.88, -6.16, .878), (-9.40, -5.91, 1.40)),
                                lambda q: q + Vector((-1.06, -.865, -.88)))
            if moved:
                pc.append({"mesh": obj.name, "movedCompleteParts": moved})
    old = remove_prefixes(scene, ("study__milky veined marble",))
    desk = Parts("study")
    office.build_desk(desk, office.office_materials())
    for key in list(desk.groups):
        if key != "milky veined marble":
            desk.groups.pop(key)[1].free()
    objects = desk.finish()
    for obj in objects:
        obj.location = (-10.4, -1.3, -2.6)
    study = next(r for r in config["rooms"] if r["id"] == "study")
    study["desk"]["turntable"][0] -= .30
    study["desk"]["papers"][0][0] -= .20
    study["desk"]["papers"][1][0] -= .18
    study["exitPath"] = [[-10.10, 0, 4.85], [-9.927, 0, 5.509], [-9.70, 0, 7.10], [-9., 0, 7.10],
                          [-9., 0, 9.05], [-3.65, 0, 9.05], [-3.65, 0, 13.6], [-2.8, 0, 13.6]]
    study["library"]["route"] = list(reversed(study["exitPath"]))
    study["walkActor"] = list(study["exitPath"][0])
    config["terrain"]["contacts"]["study"]["exitPath"] = study["exitPath"]
    config["terrain"]["contacts"]["study"]["walkActor"] = study["walkActor"]
    return {"retiredDeskMarble": old, "newReturnEndWorldX": -10.25, "PCPartsMoved": pc,
            "turntable": study["desk"]["turntable"], "papers": study["desk"]["papers"],
            "studyActorUnchanged": study["actor"], "exitPath": study["exitPath"]}


def rock_objects(scene):
    names = {"core__golden coastal sandstone", "coast_shared_golden coastal sandstone", "core_liftaway_cave_ceiling",
             "core_liftaway_cave_ceiling_rear", "core_retreat_liftaway_roof", "core_estate_library_liftaway_roof", "core_bathwing_liftaway_roof"}
    return [o for o in scene.objects if o.type == "MESH" and o.name in names]


def sofa_lining(scene, config):
    """End the hard east lining before the delivered sofa's rounded soft arm."""
    changed=[]
    for name in ("lounge__chalk limestone","lounge__pale oak"):
        obj=scene.objects[name]
        rear=-8.31 if "chalk" in name else -8.87
        receipts=edit_islands(obj,
            lambda lo,hi: lo.x>2.70 and hi.x<2.84 and lo.y<-8.2 and abs(hi.y+6)<.002 and hi.z>.3,
            lambda p:Vector((p.x,p.y-.24*max(0.,min(1.,(p.y-rear)/(-6-rear))),p.z)))
        if len(receipts)!=1:raise RuntimeError(f"Expected one exact east sofa lining/cap in {name}, got {len(receipts)}")
        changed.append({"mesh":name,"retainedWholeIsland":receipts[0]})
    return {"changed":changed,"tipBeforeNativeY":-6.,"tipAfterNativeY":-6.24,
            "preserved":"Delivered upholstered sofa, supports, seat/feet anchors and all circulation"}


def arrival_lid_seams(scene, config):
    """Fit only physically joined lid edges; its west edge remains an exposed soffit."""
    lid = scene.objects["core_arrival_lid__golden coastal sandstone"]
    if not lid.get("architectureLidDenseBoundary"):
        bm=bmesh.new();bm.from_mesh(lid.data);bm.normal_update()
        top=[face for face in bm.faces if face.normal.z>.2 and all(v.co.z>5.551 for v in face.verts)]
        edges=list({edge for face in top for edge in face.edges})
        bmesh.ops.subdivide_edges(bm,edges=edges,cuts=3,use_grid_fill=True)
        bm.to_mesh(lid.data);bm.free();lid.data.update()
        lid["architectureLidDenseBoundary"]=True
    supports = rock_objects(scene) + [scene.objects["core_arrival_court__golden coastal sandstone"]]
    trees = [(obj, BVHTree.FromPolygons([obj.matrix_world @ v.co for v in obj.data.vertices],
              [list(p.vertices) for p in obj.data.polygons])) for obj in supports]
    x0, x1, y0, y1 = 2.62, 4.38, -16.37, -12.62
    before = [lid.matrix_world @ v.co for v in lid.data.vertices]
    def adjacent(x, y, axis, sign):
        position = Vector((x, y, 30))
        position[axis] += sign * .003
        hits = []
        for obj, tree in trees:
            p, n, _, _ = tree.ray_cast(position, Vector((0, 0, -1)), 40)
            if p is not None and n.z > .2:
                height = p.z - (n.x * (x - p.x) + n.y * (y - p.y)) / n.z
                hits.append((height, n, obj.name))
        if not hits:
            raise RuntimeError(f"No actual adjoining lid support at {x},{y}")
        return max(hits, key=lambda r: r[0])
    old_tree = BVHTree.FromPolygons(before, [list(p.vertices) for p in lid.data.polygons])
    inverse = lid.matrix_world.inverted()
    changed, maximum, exposed = 0, 0., []
    for vertex, old in zip(lid.data.vertices, before):
        if old.z <= 5.551:
            continue
        candidates = []
        for axis, value, sign in ((0, x1, 1), (1, y0, -1), (1, y1, 1)):
            distance = abs(old[axis] - value)
            if distance > .46:
                continue
            edge = old.copy(); edge[axis] = value
            target, _, _ = adjacent(edge.x, edge.y, axis, sign)
            original, old_normal, _, _ = old_tree.ray_cast(Vector((min(x1-1e-5,max(x0+1e-5,edge.x)), min(y1-1e-5,max(y0+1e-5,edge.y)), 30)), Vector((0, 0, -1)), 40)
            if original is None:
                raise RuntimeError(f"No original lid surface at {list(edge)}")
            original_height=original.z-(old_normal.x*(edge.x-original.x)+old_normal.y*(edge.y-original.y))/old_normal.z
            if abs(target - original_height) > .25:
                exposed.append({"edge":list(edge),"lidHeight":original_height,"otherHeight":target})
                continue
            weight = (1 - min(1., distance / .46)) ** 2
            candidates.append((distance, weight, target - original_height))
        if candidates:
            boundary = [record for record in candidates if record[0] < 1e-5]
            delta = sum(r[2] for r in boundary) / len(boundary) if boundary else sum(w*d for _,w,d in candidates) / max(1.,sum(w for _,w,_ in candidates))
            vertex.co = inverse @ Vector((old.x, old.y, old.z + delta))
            maximum = max(maximum, abs(delta)); changed += 1
    lid.data.update()
    bm = bmesh.new(); bm.from_mesh(lid.data)
    nonmanifold = sum(not e.is_manifold for e in bm.edges); bm.free()
    if nonmanifold:
        raise RuntimeError("Fitting lid grade opened its solid")
    # At a joined boundary, use the adjoining actual triangle's normal on the
    # top only. Side/soffit loops keep their own normals, without a shading bevel.
    normals = []
    for face in lid.data.polygons:
        top = face.normal.z > .2
        face.use_smooth = top
        for index in face.vertices:
            p = lid.matrix_world @ lid.data.vertices[index].co
            nearby = [(abs(p.x-x1), 0, 1), (abs(p.y-y0), 1, -1), (abs(p.y-y1), 1, 1)]
            distance, axis, sign = min(nearby)
            normal = face.normal
            if top and distance < 1e-5:
                height, other_normal, _ = adjacent(p.x, p.y, axis, sign)
                if abs(height-p.z)<.25:normal=other_normal
            normals.append(tuple(normal))
    lid.data.normals_split_custom_set(normals)
    return {"changedTopVertices": changed, "maximumCorrectionM": maximum,
            "nonmanifoldEdges": nonmanifold, "joinedEdges": ["east", "sea", "land"], "exposedEdgeSamples":exposed,
            "preserved": "5.55m soffit and exposed west edge; no floor-height proxy"}


def forecourt_corners(scene, config):
    """Round the four real paving corners while retaining the graded portal join."""
    obj = scene.objects["core_arrival_court__travertine paving stone"]
    before = [obj.matrix_world @ v.co for v in obj.data.vertices]
    tree = BVHTree.FromPolygons(before, [list(p.vertices) for p in obj.data.polygons])
    x0, x1, y0, y1, radius = -3.90, -1.70, -24.40, -23.10, .30
    inverse = obj.matrix_world.inverted(); changed = []
    def top(x,y):
        point,normal,_,_=tree.ray_cast(Vector((min(x1-1e-5,max(x0+1e-5,x)),min(y1-1e-5,max(y0+1e-5,y)),30)),Vector((0,0,-1)),40)
        if point is None:raise RuntimeError(f"No original forecourt top at {x},{y}")
        return point.z-(normal.x*(x-point.x)+normal.y*(y-point.y))/normal.z
    for vertex, p in zip(obj.data.vertices, before):
        if not (x0-.001 <= p.x <= x1+.001 and y0-.001 <= p.y <= y1+.001):
            continue
        cx = min(x1-radius, max(x0+radius, p.x)); cy = min(y1-radius, max(y0+radius, p.y))
        delta = Vector((p.x-cx, p.y-cy, 0))
        if delta.length <= radius + 1e-6:
            continue
        q = Vector((cx, cy, p.z)) + delta.normalized() * radius
        q.z = p.z + top(q.x,q.y) - top(p.x,p.y)
        vertex.co = inverse @ q
        changed.append((p-q).length)
    obj.data.update()
    bm=bmesh.new();bm.from_mesh(obj.data)
    nonmanifold=sum(not e.is_manifold for e in bm.edges);bm.free()
    if nonmanifold:raise RuntimeError("Rounded forecourt opened a paving solid")
    return {"radiusM":radius,"verticesChanged":len(changed),"maximumPlanDisplacementM":max(changed,default=0),
            "nonmanifoldEdges":nonmanifold,"preserved":"Portal grade, both path joins and full middle-edge width"}


def ground_wildlife(scene, config):
    """Re-sample unchanged animal plans on the final real clifftop, not metadata."""
    from rabbit_habitats import RABBIT_HABITAT_LOOPS, sample_loop
    trees=[(o,BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],
              [list(p.vertices) for p in o.data.polygons])) for o in rock_objects(scene)]
    def support(x,y):
        hits=[]
        for obj,tree in trees:
            p,n,_,_=tree.ray_cast(Vector((x,y,25)),Vector((0,0,-1)),40)
            if p is not None and n.z>.2:hits.append((p.z,obj.name,list(n)))
        if not hits:raise RuntimeError(f"Missing actual rock support for wildlife {x},{y}")
        return max(hits,key=lambda r:r[0])
    perches=[]
    for k,old in enumerate(config["terrain"]["perches"]):
        height,name,normal=support(old[0],-old[2])
        point=[old[0],height+.05,old[2]]
        config["terrain"]["perches"][k]=point
        perches.append({"before":old,"after":point,"nativeSupport":name,"normal":normal})
    habitats=[]
    for name,plan in RABBIT_HABITAT_LOOPS.items():
        previous=config["terrain"]["habitats"][name]["path"]
        path=sample_loop(plan,lambda x,y:support(x,y)[0])
        config["terrain"]["habitats"][name]["path"]=path
        habitats.append({"name":name,"points":len(path),"maximumHeightCorrectionM":max(abs(a[1]-b[1]) for a,b in zip(previous,path))})
    for obj in scene.objects:
        if obj.name.startswith("core_finish_pavilion_planted_roof__pavilion native succulent leaf"):
            obj["flora"]=True
        if obj.name.startswith(("core_finish_pavilion_roof__", "core_finish_pavilion_rock_shoulder__")):
            obj["cameraSupport"]=True
    from coastal_camera import create_camera_height, sample_camera_elevations
    config["cameraCollision"]["elevations"] = sample_camera_elevations(config["cameraCollision"],create_camera_height(list(scene.objects)))
    return {"perches":perches,"habitats":habitats,"preserved":"Animal count, mainland raccoon loop, coastal roosts and XZ rabbit plans"}


def tool_difference(target, tool):
    # Skip truly disjoint surfaces, not just nonoverlapping object bounds. Many
    # cliff batches enclose a large AABB around already-excavated air.
    tree = BVHTree.FromPolygons([target.matrix_world @ v.co for v in target.data.vertices],
                                [list(f.vertices) for f in target.data.polygons])
    cut_tree = BVHTree.FromPolygons([tool.matrix_world @ v.co for v in tool.data.vertices],
                                    [list(f.vertices) for f in tool.data.polygons])
    lo, hi = bounds([tool.matrix_world @ v.co for v in tool.data.vertices])
    sample = (lo + hi) / 2
    from audit_coastal_overlaps import is_inside
    occupied = bool(tree.overlap(cut_tree)) or is_inside(tree, sample)
    if not occupied:
        return {"mesh": target.name, "skippedEmpty": True}
    if (target in rock_objects(bpy.context.scene) and target.name!="coast_shared_golden coastal sandstone") or target.name=="core_retreat_library__chalk limestone":
        from coastal_cliff_finish import local_solid_boolean
        result=local_solid_boolean(target,tool,"DIFFERENCE")
        return {"mesh":target.name,"cutNonManifold":result["boundedPatch"]["nonmanifoldEdges"],
                "boundedPatch":result["boundedPatch"],"localSolidDifference":result}
    original_mesh=target.data.copy() if target.name.startswith("coast_") else None
    from coastal_cliff_finish import triangulate_actual_render_faces
    bm=bmesh.new();bm.from_mesh(target.data)
    triangulate_actual_render_faces(bm,original_mesh or target.data,lo-Vector((.02,.02,.02)),hi+Vector((.02,.02,.02)),all_quads=True)
    bm.to_mesh(target.data);bm.free()
    shell.boolean(target, tool, "DIFFERENCE")
    bm = bmesh.new()
    bm.from_mesh(target.data)
    # Exact CSG may emit duplicate points on the cut. Keep a 0.1um weld,
    # not the old 50um weld which collapses separate remote rock edges.
    candidates=[v for v in bm.verts if all(lo[k]-.03<=(target.matrix_world@v.co)[k]<=hi[k]+.03 for k in range(3))]
    bmesh.ops.remove_doubles(bm, verts=candidates, dist=1e-7)
    candidates=set(candidates)
    bmesh.ops.dissolve_degenerate(bm, edges=[edge for edge in bm.edges if all(v in candidates for v in edge.verts)], dist=1e-7)
    restored = []
    boundary = set() if original_mesh else set(e for e in bm.edges if e.is_boundary)
    while boundary:
        seed = boundary.pop()
        loop, queue = {seed}, [seed]
        while queue:
            for vertex in queue.pop().verts:
                for edge in vertex.link_edges:
                    if edge in boundary:
                        boundary.remove(edge)
                        loop.add(edge)
                        queue.append(edge)
        vertices = {v for edge in loop for v in edge.verts}
        points = [target.matrix_world @ v.co for v in vertices]
        remote = all(not all(lo[k] - .1 <= point[k] <= hi[k] + .1 for k in range(3)) for point in points)
        if not remote or len(vertices) > 6 or max((a - b).length for a in points for b in points) > .4:
            raise RuntimeError(f"Unverified Boolean boundary at {target.name}; refusing to fill the new cut")
        new_faces = bmesh.ops.holes_fill(bm, edges=list(loop), sides=6)["faces"]
        if sum(face.calc_area() for face in new_faces) > .001:
            raise RuntimeError("Remote Boolean repair exceeds 10 square centimetres")
        # Exact CSG sometimes drops a near-collinear triangle on a distant
        # retained cut plane. Restore it only if its centre and all edge mids
        # lie on the *original* loaded surface within three micrometres.
        checked = []
        for face in new_faces:
            samples = [target.matrix_world @ face.calc_center_median()]
            samples += [target.matrix_world @ ((edge.verts[0].co + edge.verts[1].co) / 2) for edge in face.edges]
            for point in samples:
                nearest = tree.find_nearest(point)
                if nearest[0] is None or nearest[3] > 3e-6:
                    raise RuntimeError("Remote CSG patch differs from the original retained surface")
                checked.append(nearest[3])
        restored.append({"vertices": [list(p) for p in points], "areaM2": sum(f.calc_area() for f in new_faces),
                         "maxOriginalSurfaceDistanceM": max(checked)})
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    nonmanifold = sum(not e.is_manifold for e in bm.edges)
    bm.to_mesh(target.data)
    bm.free()
    result = {"cutNonManifold": nonmanifold,"temporarySolverNonmanifoldEdges":nonmanifold, "weldToleranceM": 1e-7, "restoredRemoteSurfaceLoops": restored}
    if original_mesh:
        from coastal_cliff_finish import restore_original_outside
        result["boundedPatch"]=restore_original_outside(target,original_mesh,lo-Vector((.02,.02,.02)),hi+Vector((.02,.02,.02)))
        result["cutNonManifold"]=result["boundedPatch"]["nonmanifoldEdges"]
        bpy.data.meshes.remove(original_mesh)
    if result.get("cutNonManifold"):
        # Keep the failure in the candidate entry point; never admit an open
        # mass to hide a difficult Boolean.
        raise RuntimeError(f"{target.name}: {result['cutNonManifold']} nonmanifold edges after {tool.name}")
    return {"mesh": target.name, **result}


def adjacent_bedchamber(scene, config):
    m = library.materials()
    cx, cz, ri, ro, walk_radius = -9.25, 6.00, .15, 1.12, .72
    floor, count, sweep, start = 1.50, 10, math.radians(150), math.radians(225)
    room_bounds = (-8.43, -5.25, 3.40, 8.50)
    desk_fit = fit_desk_to_stair(scene, config)
    old_origin = list(next(r for r in config["rooms"] if r["id"] == "sleep")["actor"])
    destination = [-6.80, floor, 6.97]
    yaw = 0.
    transform = lambda point: native(transformed_point(world(point), old_origin, destination, yaw))
    retired = remove_prefixes(scene, ("core_retreat_spiral",))
    bridge = []
    for obj in scene.objects:
        if obj.type == "MESH" and obj.name.startswith("core_retreat_gallery__"):
            removed = edit_islands(obj, lambda lo, hi: lo.z > 2.30 and hi.z < 3.80)
            if removed:
                bridge.append({"mesh": obj.name, "removed": removed})
    moved = []
    for obj in scene.objects:
        if obj.type != "MESH" or not obj.name.startswith("sleep_"):
            continue
        if obj.name.startswith("sleep_decor"):
            mat = Matrix.Translation(native([-5.275, floor, 7.0])) @ Matrix.Rotation(math.pi, 4, "Z") @ Matrix.Translation(-native([-4.685, 2.6, 11.30]))
        elif obj.name.startswith("sleep_reno_wardrobe"):
            wardrobe_origin = [-4.11, 2.6, 14.625]
            wardrobe_destination = [-8.10, floor, 4.60]
            mat = Matrix.Translation(native(wardrobe_destination)) @ Matrix.Translation(-native(wardrobe_origin))
        else:
            mat = Matrix.Translation(native(destination)) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Translation(-native(old_origin))
        obj.matrix_world = mat @ obj.matrix_world
        # The original artwork belongs to a wall, not the bed frame. Its entire
        # assembly faces the chamber from its new solid inland wall.
        if obj.name=="sleep__pale oak":
            # The complete bedside table goes on the opposite side, clear of
            # the actual stair opening, not embedded in its upper guard.
            matrix=obj.matrix_world.copy();matrix.translation+=Vector((2.06,0,0));obj.matrix_world=matrix
        moved.append(obj.name)
    bpy.context.view_layer.update()
    pot=scene.objects["sleep__terracotta"]
    lo,hi=bounds([pot.matrix_world@v.co for v in pot.data.vertices])
    delta=native([-5.65,floor,4.80])-Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    for name in ("sleep__terracotta","sleep__charcoal","sleep__olive leaf"):
        obj=scene.objects[name];matrix=obj.matrix_world.copy();matrix.translation+=delta;obj.matrix_world=matrix
    anchor = scene.objects.get("anchor_sleep")
    if anchor:
        anchor.location = native(destination)
    # Carve a rounded room in the retained fin; outer skin and gardens stay in place.
    x0, x1, z0, z1 = room_bounds
    centre = (x0 + x1) / 2
    # The east liner gets its own 100mm pocket; do not bury a whole wall
    # inside retained rock or let a Boolean silently delete the enclosure.
    profile = [(x0, floor - .16), (x1+.10, floor - .16), (x1+.10, 4.38)]
    profile += [(centre + (x1 - x0) / 2 * math.cos(a), 4.38 + .72 * math.sin(a))
                for a in (math.pi * k / 32 for k in range(33))]
    outer_profile=[(x0,floor-.16),(x1+.10,floor-.16),(x1+.10,5.169),(x0,5.169)]
    tool = shell._prism("adjacent fin bedchamber excavation", outer_profile, "y", -z1 - .04, -z0, m["plaster"])
    excavations = [tool_difference(obj, tool) for obj in rock_objects(scene) if not obj.name.startswith("coast_")]
    bpy.data.objects.remove(tool, do_unlink=True)
    # The circular opening belongs to both the lower library and upper room.
    shaft = Parts("bedchamber spiral cutter")
    cylinder(shaft.bm(m["plaster"]), (cx, -cz, -.16), (cx, -cz, 5.24), ro + .075, 96)
    tool = shaft.finish()[0]
    excavations += [tool_difference(obj, tool) for obj in rock_objects(scene) if not obj.name.startswith("coast_")]
    wall = scene.objects["core_retreat_library__chalk limestone"]
    excavations.append(tool_difference(wall, tool))
    bpy.data.objects.remove(tool, do_unlink=True)
    # Continue the real lower floor into the carved shaft. Only the part east
    # of the retained library boards is new, so no doubled horizontal floor.
    from coastal_estate_outdoors import _prism
    base = Parts("core_finish_bedroom_spiral_base")
    cut_x = -8.551
    angle = math.acos((cut_x - cx) / (ro + .075))
    base_polygon = [(cx + (ro + .075) * math.cos(a), -cz - (ro + .075) * math.sin(a))
                    for a in (-angle + 2 * angle * k / 48 for k in range(49))]
    _prism(base.bm(m["stone"]), list(reversed(base_polygon)), -.16, -.022)
    _prism(base.bm(m["oak"]), list(reversed(base_polygon)), -.022, 0.)
    base.finish()
    # A rounded, rock-rooted east fin carries the front of the chamber. Fill
    # only the old void, not a duplicate volume inside the retained mainland.
    from coastal_arrival_hall import _extrude
    pier = Parts("core_finish_bedchamber_rock_fin")
    _extrude(pier.bm(bpy.data.materials.get("La Jolla bluff sandstone") or m["rock"]),
             rounded_profile(6.00, -.20, floor-.16, 5.20, .25), "x", -5.45, -5.25)
    pier_objects = pier.finish()
    for obj in pier_objects:
        for retained in rock_objects(scene):
            shell.boolean(obj, retained, "DIFFERENCE")
        obj["closedSolid"] = True
    # Real structural bed slab and oak boards, with the exact same shaft opening.
    slab = add_box("core_finish_bedchamber_slab", m["stone"], (x0, -z1, floor - .16), (x1+.10, -z0, floor - .022), .008)
    boards = Parts("core_finish_bedchamber_floor")
    library._floor(boards, m["oak"], (x0, x1, -z1, -z0), floor)
    boards = boards.finish()
    shaft = Parts("bedchamber floor opening")
    cylinder(shaft.bm(m["plaster"]), (cx, -cz, floor - .20), (cx, -cz, floor + .1), ro + .075, 96)
    tool = shaft.finish()[0]
    for obj in slab + boards:
        shell.boolean(obj, tool, "DIFFERENCE")
    bpy.data.objects.remove(tool, do_unlink=True)
    # Slim fitted walls close the existing front void; only empty space is filled
    # where a retained rock face already supplies the room enclosure.
    walls = []
    for name, a, b in (("west", (x0 - .10, -z1, floor-.022), (x0, -8.24, 4.38)),
                       ("east", (x1, -z1, floor-.022), (x1 + .10, -z0, 4.38))):
        obj = add_box("core_finish_bedchamber_wall_" + name, m["plaster"], a, b, .015)[0]
        walls.append(obj)
    back=Parts("core_finish_bedchamber_wall_inland")
    _extrude(back.bm(m["plaster"]),profile,"zw",z1,z1+.10)
    walls+=back.finish()
    vault=Parts("core_finish_bedchamber_vault")
    vault_profile=[(x0,5.169),(x1+.10,5.169),(x1+.10,4.38)]
    vault_profile += [(centre+(x1-x0)/2*math.cos(a),4.38+.72*math.sin(a))
                      for a in (math.pi*k/32 for k in range(33))]
    # The full arch owns its thickness, including the old short-link void at
    # the inland end. The retained fin begins immediately above its outer cap.
    _extrude(vault.bm(m["plaster"]),vault_profile,"zw",z0,z1)
    vault_objects=vault.finish()
    for obj in vault_objects:
        obj["caveRoof"]=True
        obj["roomCeilingFor"]="sleep"
    shaft = Parts("bedchamber wall opening")
    cylinder(shaft.bm(m["plaster"]), (cx, -cz, -.16), (cx, -cz, 5.24), ro + .075, 96)
    tool = shaft.finish()[0]
    for obj in walls+vault_objects:
        shell.boolean(obj, tool, "DIFFERENCE")
    bpy.data.objects.remove(tool, do_unlink=True)
    # The chamber is sea-facing, set behind the retained fin's roof. Clear glass
    # and a timber frame enclose it without another exposed bridge.
    facade = Parts("sleep_fin_window")
    bronze, glass = facade.bm(m["bronze"]), facade.bm(m["glass"])
    def ceiling(x):return 4.38+.72*math.sqrt(max(0.,1-((x-centre)/((x1-x0)/2))**2))
    for x in (x0 + .07, centre, x1 - .07):
        h=ceiling(x)-.035
        box(bronze, (x, -z0 - .025, (floor + h) / 2), (.035, .045, h - floor), .006)
    box(bronze, (centre, -z0 - .025, floor+.025), (x1 - x0 - .10, .045, .035), .006)
    for k in range(32):
        a=x0+.07+(x1-x0-.14)*k/32;b=x0+.07+(x1-x0-.14)*(k+1)/32
        cylinder(bronze,(a,-z0-.025,ceiling(a)-.035),(b,-z0-.025,ceiling(b)-.035),.018,10)
    glass_profile=[(x0+.08,floor+.045),(x1-.08,floor+.045)]
    glass_profile += [(x,ceiling(x)-.055) for x in (x1-.08-(x1-x0-.16)*k/32 for k in range(33))]
    _extrude(glass,glass_profile,"zw",z0+.016,z0+.034)
    facade.finish()
    # Full-width treads. Native walk line/guards derive from these same angles.
    p = Parts("core_finish_bedroom_spiral")
    cylinder(p.bm(m["bronze"]), (cx, -cz, .0), (cx, -cz, floor + 1.06), .095, 24)
    treads, supports = [], []
    for k in range(count):
        a, b = start + sweep * k / count, start + sweep * (k + 1) / count
        h = floor * (k + 1) / count
        polygon = [(cx + radius * math.cos(angle), -cz - radius * math.sin(angle))
                   for radius, sequence in ((ro, range(7)), (ri, range(6, -1, -1)))
                   for angle in (a + (b - a) * j / 6 for j in sequence)]
        _prism(p.bm(m["oak"]), list(reversed(polygon)), h - .060, h)
        supports.append({"id": f"bedchamber-spiral-tread-{k + 1}", "height": h,
                         "polygon": [[x, -y] for x, y in reversed(polygon)]})
        mid = (a + b) / 2
        treads.append([cx + walk_radius * math.cos(mid), h, cz + walk_radius * math.sin(mid)])
        if 2 <= k < count - 2:
            qa = (cx + ro * math.cos(a), -cz - ro * math.sin(a), h + .94)
            qb = (cx + ro * math.cos(b), -cz - ro * math.sin(b), h + floor / count + .94)
            cylinder(p.bm(m["smoked"]), qa, qb, .026, 12)
            cylinder(p.bm(m["bronze"]), (qa[0], qa[1], h), qa, .010, 10)
    # The landing continues AFTER the last occupied sector, never above the
    # preceding risers. Its outer edge meets the exact circular floor opening.
    landing_start=math.degrees(start+sweep)%360
    landing_end=landing_start+30
    landing = [(cx + radius * math.cos(a), -cz - radius * math.sin(a))
               for radius, sequence in ((ro + .075, range(13)), (ri, range(12, -1, -1)))
               for a in (math.radians(landing_start + 30 * j / 12) for j in sequence)]
    _prism(p.bm(m["oak"]), list(reversed(landing)), floor - .060, floor)
    supports.append({"id": "bedchamber-spiral-landing", "height": floor,
                     "polygon": [[x, -y] for x, y in reversed(landing)]})
    # The upper room exists on the east side of the hole. Two short guards
    # protect that actual floor edge, leaving a human-width radial arrival.
    guard_limit=math.degrees(math.acos((x0-cx)/(ro+.10)))
    for low, high in ((-guard_limit, -10), (landing_end, guard_limit)):
        if high<=low:continue
        stations = max(2, math.ceil((high - low) / 15))
        for k in range(stations):
            a, b = math.radians(low + (high - low) * k / stations), math.radians(low + (high - low) * (k + 1) / stations)
            qa = (cx + (ro + .10) * math.cos(a), -cz - (ro + .10) * math.sin(a), floor + .96)
            qb = (cx + (ro + .10) * math.cos(b), -cz - (ro + .10) * math.sin(b), floor + .96)
            cylinder(p.bm(m["smoked"]), qa, qb, .026, 12)
            cylinder(p.bm(m["bronze"]), (qa[0], qa[1], floor), qa, .010, 10)
        cylinder(p.bm(m["bronze"]), (qb[0], qb[1], floor), qb, .010, 10)
    p.finish()
    walk_actor = [-8.03, floor, destination[2]]
    first_angle=start+sweep*.5/count
    lower = [cx+1.30*math.cos(first_angle),0,cz+1.30*math.sin(first_angle)]
    study = next(r for r in config["rooms"] if r["id"] == "study")
    private = [*reversed(treads), lower, [-10.10, 0, 4.85]]
    approach = [walk_actor, [cx+.99*math.cos(math.radians(22)),floor,cz+.99*math.sin(math.radians(22))]]
    lib = config["estateLibrary"]
    lib["privateConnection"] = private
    lib["bedroomApproach"] = approach
    lib["stairRoute"] = treads
    lib["stairApproach"] = {"bottom": lower, "top": approach[-1]}
    lib["bedsideStation"] = walk_actor
    lib["bridgeRemoved"] = True
    lib["adjacentBedchamber"] = {"floor": floor, "bounds": {"min": [x0, floor, z0], "max": [x1, 5.17, z1]},
        "clearTreadWidth": ro - ri, "walkRadius": walk_radius, "riserCount": count,
        "rise": floor / count, "going": walk_radius * sweep / count, "sweepDegrees": math.degrees(sweep),
        "helixLength": math.hypot(walk_radius * sweep, floor),
        "lyingActor": destination, "standingStation": walk_actor,"center":[cx,floor,cz],
        "startDegrees":math.degrees(start),"endDegrees":math.degrees(start+sweep),"innerRadius":ri,"outerRadius":ro}
    config["retreat"]["spiralRoute"] = treads
    supports = [s for s in config["terrain"]["supportSurfaces"] if not s["id"].startswith(("retreat-spiral", "retreat-library-bridge-2.6", "retreat-bedroom-bridge"))] + supports
    opening_radius = ro + .075
    angle_top = math.acos((x0 - cx) / opening_radius)
    angle_front = -angle_top if z0 < cz-opening_radius else math.asin((z0 - cz) / opening_radius)
    floor_polygon = [[x0 if z0 < cz-opening_radius else cx + opening_radius * math.cos(angle_front), z0],
                     [x1, z0], [x1, z1], [x0, z1], [x0, cz + opening_radius * math.sin(angle_top)]]
    floor_polygon += [[cx + opening_radius * math.cos(a), cz + opening_radius * math.sin(a)]
                      for a in (angle_top + (angle_front - angle_top) * k / 36 for k in range(1, 37))]
    config["terrain"]["supportSurfaces"] = supports + [{"id": "adjacent-bedchamber-floor", "height": floor,
        "polygon": floor_polygon}]
    room = next(r for r in config["rooms"] if r["id"] == "sleep")
    room.update({"actor": destination, "walkActor": walk_actor, "floor": floor, "facing": yaw,
                 "target": [destination[0], floor + .85, destination[2]], "offset": [0, 0, 0],
                 "egress": study["egress"],
                 "exitPath": [*approach, *private, *study["exitPath"]]})
    room["camera"] = {"radius": 4.6, "yaw": 2.92, "pitch": .30, "fov": 50,
                      "envelope": {"yaw": [2.65, 3.60], "pitch": [.12, .62], "radius": [2.6, 5.0]}}
    config["terrain"]["contacts"]["sleep"] = {k: room[k] for k in ("actor", "walkActor", "floor", "egress", "exitPath")}
    config["companion"]["perches"]["sleep"] = [[-6.8, floor, 4.6], [-6.6, floor, 4.6]]
    config["companion"]["perches"]["study"] = [[-9.95, 0, 3.90], [-9.90, 0, 3.80]]
    reading = next(r for r in config["rooms"] if r["id"] == "library")
    reading["exitPath"] = [[-9.41, 0, 3.42], [-10.10, 0, 3.42], *study["exitPath"]]
    reading["library"]["route"] = list(reversed(reading["exitPath"]))
    config["terrain"]["contacts"]["library"]["exitPath"] = reading["exitPath"]
    config["companion"]["privateLibraryConnection"] = [*approach, *private]
    config["companion"]["roomExits"]["sleep"] = {"egress": study["egress"], "exitPath": room["exitPath"]}
    config["weatherShelters"].append({"min": [x0, floor, z0], "max": [x1, 5.17, z1]})
    region = {"min": [x0 - .10, floor - .05, z0 - .10], "max": [x1 + .10, 5.25, z1 + .12]}
    config["installationReceivers"]["groups"]["bedchamber"] = region
    config["installationReceivers"]["order"].insert(0, "bedchamber")
    cove=Parts("core_finish_bedchamber_cove")
    box(cove.bm(m["bronze"]),(-6.79,-z1+.03,4.285),(2.65,.09,.05),.006)
    box(cove.bm(m["light"]),(-6.79,-z1+.065,4.25),(2.58,.025,.015),.003)
    for obj in cove.finish():
        obj["installationGroup"]="bedchamber"
        if obj.name.endswith(m["light"].name):obj["installationGlow"]="bedchamber-cove"
    config["installationLines"].append({"id": "bedchamber-warm-cove", "a": [-8.08, 4.25, z1-.065], "b": [-5.5, 4.25, z1-.065],
        "intensity": .35, "schedule": "soffit", "transport": True, "region": region, "glowTag": "bedchamber-cove"})
    transfer=bed_transfer_contacts(scene,config)
    return {"retiredSpiral": retired, "retiredUpperBridge": bridge, "movedCompleteSleepAssemblies": moved, "deskFit": desk_fit,
            "excavations": excavations, "layout": lib["adjacentBedchamber"], "room": room,
            "privateRouteMetres": sum((Vector(b) - Vector(a)).length for a, b in zip([walk_actor, *approach, *private, study["actor"]], [*approach, *private, study["actor"]])),
            "bedTransfer":transfer,
            "runtimeRequirement": "Use the measured bedTransfer for roll/sit/stand, then walkActor; actor remains the calibrated lying clip root and all six bedding variants move rigidly with it"}


def bed_transfer_contacts(scene,config,final=False):
    """Actual mattress-edge/floor witnesses for a measured sit/stand transfer."""
    bpy.context.view_layer.update()
    room=next(r for r in config["rooms"] if r["id"]=="sleep")
    study=next(r for r in config["rooms"] if r["id"]=="study")
    retained_feet=room.get("bedTransfer",{}).get("feetByAvatar",{})
    x,h,z=room["actor"]
    seat_x=x-.735
    mattress=scene.objects["sleep__linen"]
    floor_objects=[o for o in scene.objects if o.name.startswith("core_finish_bedchamber_floor__")]
    def tree(obj):return BVHTree.FromPolygons([obj.matrix_world@v.co for v in obj.data.vertices],[list(p.vertices) for p in obj.data.polygons])
    mattress_tree=tree(mattress)
    seat_point,normal,index,_=mattress_tree.ray_cast(native([seat_x,h+.95,z]),Vector((0,0,-1)),.8)
    if seat_point is None or normal.z<=0:raise RuntimeError("The curved bed-edge fit reference lost its real mattress triangle")
    seat={"position":world(seat_point),"nativeSupport":mattress.name,"nativePolygon":index,
          "normal":[normal.x,normal.z,-normal.y],"facing":-math.pi/2,"clip":"lounge"}
    mattress_reference = dict(seat)
    if final:
        cover = scene.objects.get("sleep_duvet_empty")
        if cover is None:
            raise RuntimeError("Final bed transfer requires the actual made-bed duvet")
        cover.data.calc_loop_triangles()
        cover_tree = BVHTree.FromPolygons([cover.matrix_world@vertex.co for vertex in cover.data.vertices],
            [list(face.vertices) for face in cover.data.loop_triangles],all_triangles=True)
        point,n,triangle,_ = cover_tree.ray_cast(native([seat_x,h+.95,z]),Vector((0,0,-1)),.8)
        if point is not None and point.z > seat_point.z:
            if n.z<=0:
                raise RuntimeError("The shown curved duvet fit reference is not an upward native triangle")
            seat = {"position":world(point),"nativeSupport":cover.name,"nativeTriangle":triangle,
                    "normal":[n.x,n.z,-n.y],"facing":-math.pi/2,"clip":"lounge",
                    "fitReference":"Curved edge reference, not a planar seat. Fit the highest actual decoded cloth under every measured hip bearing witness with zero hidden compression; full skin and leg reach are separate gates."}
            patch = [[world(cover.matrix_world@cover.data.vertices[i].co) for i in face.vertices]
                for face in cover.data.loop_triangles
                if all(x-.90 <= (cover.matrix_world@cover.data.vertices[i].co).x <= x-.28 and
                       z-.40 <= -(cover.matrix_world@cover.data.vertices[i].co).y <= z+.40 for i in face.vertices)]
            import hashlib, json, os
            from pathlib import Path
            patch_path = Path(os.environ["COASTAL_ARCHITECTURE_ATTEMPT"]) / "bed-seat-source-patch.json"
            patch_path.write_text(json.dumps({"nativeSupport": cover.name, "triangles": patch}, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
            seat["nativeContactTriangle"] = [world(cover.matrix_world@cover.data.vertices[i].co) for i in cover.data.loop_triangles[triangle].vertices]
            seat["nativeSurfacePatch"] = {"minimum": [x-.90,h,z-.40], "maximum": [x-.28,h+.95,z+.40],
                "triangles": len(patch), "sha256": hashlib.sha256(patch_path.read_bytes()).hexdigest(),
                "runtimeSource": "Actual decoded sleep_duvet_empty mesh; native patch receipt is separate from delivered metadata"}
    feet={};surfaces=[]
    for side,dz in (("L",-.14),("R",.14)):
        wanted=[x-.98,h,z+dz];hits=[]
        for obj in floor_objects:
            point,n,face,distance=tree(obj).ray_cast(native([wanted[0],h+.08,wanted[2]]),Vector((0,0,-1)),.16)
            if point is not None and n.z>.95:hits.append((distance,obj,point,n,face))
        if not hits:raise RuntimeError(f"No actual bedside floor for {side}")
        _,obj,point,n,face=min(hits,key=lambda row:row[0])
        feet[side]={"position":world(point),"nativeSupport":obj.name,"nativePolygon":face,"normal":[n.x,n.z,-n.y]}
    # Full real plank polygons, conservatively clipped to the clear bedside
    # foot patch. No support plane is added over the circular stair opening.
    def clip(poly,axis,value,greater):
        result=[]
        for a,b in zip(poly,poly[1:]+poly[:1]):
            ia=(a[axis]>=value) if greater else (a[axis]<=value)
            ib=(b[axis]>=value) if greater else (b[axis]<=value)
            if ia:result.append(a)
            if ia!=ib:
                t=(value-a[axis])/(b[axis]-a[axis]);result.append([a[k]+t*(b[k]-a[k]) for k in range(2)])
        return result
    for obj in floor_objects:
        obj.data.calc_loop_triangles()
        for face in obj.data.loop_triangles:
            n=obj.matrix_world.to_3x3().inverted().transposed()@face.normal
            points=[obj.matrix_world@obj.data.vertices[i].co for i in face.vertices]
            if n.z<.99 or any(abs(point.z-h)>2e-5 for point in points):continue
            polygon=[[point.x,-point.y] for point in points]
            for axis,value,greater in ((0,room["walkActor"][0]-.18,True),(0,x-.82,False),
                                       (1,z-.45,True),(1,z+.45,False)):
                if polygon:polygon=clip(polygon,axis,value,greater)
            if len(polygon)<3:continue
            area=abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(polygon,polygon[1:]+polygon[:1])))/2
            if area>1e-8:surfaces.append({"id":f"bedside-floor-{face.polygon_index}-{face.index}","height":h,"polygon":polygon,
                "nativeSupport":obj.name,"nativePolygon":face.polygon_index,"nativeTriangle":face.index})
    if not surfaces:raise RuntimeError("The bedside foot patch has no real native plank tops")
    nominal_root=[seat["position"][0],seat["position"][1]-.515,seat["position"][2]]
    route=[room["actor"],nominal_root,room["walkActor"],*config["estateLibrary"]["bedroomApproach"][1:],
           *config["estateLibrary"]["privateConnection"],study["actor"]]
    length=sum(math.dist(a,b) for a,b in zip(route,route[1:]))
    result={"lyingActor":room["actor"],"seat":seat,"mattressReference":mattress_reference,
            "seatStatus":"final shown made-bed surface" if final else "provisional until fresh bedding is fitted",
            "feet":feet,"standingActor":room["walkActor"],
            "supportSurfaces":surfaces,"nominalSeatedRoot":nominal_root,"nominalRootRoute":route,
            "nominalRootRouteMetres":length,"referenceSeatOffset":.515,
            "footPlacementScope":"Separate actual floor witnesses0.98m west of the lying root. Both feet fit the delivered five-rig common reach interval with2cm extension margin; standing walkActor remains separate. Full sole/frame sweep remains a runtime acceptance gate.",
            "referenceScope":"The0.515m authored lounge seat offset is a reference; each delivered skin must be fit to this actual curved mattress/duvet and floor. A center ray or plane is insufficient. Full pose-root journey, actual hip bearing witnesses, body/mattress intersections and decoded triangles remain verification gates."}
    if retained_feet:
        result["feetByAvatar"]=retained_feet
    room["bedTransfer"]=result
    if "adjacentBedchamber" in config["estateLibrary"]:
        config["estateLibrary"]["adjacentBedchamber"]["bedTransfer"]=result
    if not final:
        return result
    from coastal_bed_transfer import measured_feet
    import hashlib, json, os
    from pathlib import Path
    proof = measured_feet(scene, room, result)
    report = Path(os.environ["COASTAL_ARCHITECTURE_ATTEMPT"]) / "bed-foot-controls.json"
    report.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8", newline="\n")
    result["nativeFootControlSummary"] = {
        "receiptSha256": hashlib.sha256(report.read_bytes()).hexdigest(),
        "fullFootVertices": sum(row["fullFootVertices"] for row in proof["checks"]),
        "soleWitnessCount": sum(row["soleWitnessCount"] for row in proof["checks"]),
        "minimumNativeObstacleDistanceM": min(row["minimumNativeObstacleDistanceM"] for row in proof["checks"]),
        "maximumSoleSurfaceDistanceM": max(point.get("modeledBoardJointDistanceM", point.get("soleSurfaceDistanceM", 0.))
            for row in proof["checks"] for point in row["soleContacts"]),
        "scope": result["footSourceEvidence"]["scope"],
    }
    return result


def circulation_fit(scene, config):
    """Resolve decoded full-capsule failures with real landing/guard geometry."""
    lib = config["estateLibrary"]
    adjacent = lib["adjacentBedchamber"]
    cx, floor, cz = adjacent["center"]
    ri, ro = adjacent["innerRadius"], adjacent["outerRadius"]
    start = adjacent["endDegrees"] % 360
    retired = []
    for obj in scene.objects:
        if obj.type == "MESH" and obj.name.startswith("core_finish_bedroom_spiral__"):
            removed = edit_islands(obj, lambda lo, hi: inside(lo, hi,
                (-8.76, -6.86, floor-.061), (-8.08, -6.17, floor+.001)))
            if removed:
                retired.append({"mesh":obj.name,"islands":removed})
    if sum(len(row["islands"]) for row in retired) != 1:
        raise RuntimeError("The bounded full-width landing repair must replace exactly one old landing")
    polygon = [(cx + radius * math.cos(a), -cz - radius * math.sin(a))
               for radius, sequence in ((ro+.075, range(13)), (ri, range(12,-1,-1)))
               for a in (math.radians(start + 30*j/12) for j in sequence)]
    p = Parts("core_finish_bedroom_spiral_landing")
    from coastal_estate_outdoors import _prism
    _prism(p.bm(library.materials()["oak"]),list(reversed(polygon)),floor-.060,floor)
    p.finish()
    support = {"id":"bedchamber-spiral-landing","height":floor,"polygon":[[x,-y] for x,y in reversed(polygon)]}
    config["terrain"]["supportSurfaces"] = [s for s in config["terrain"]["supportSurfaces"]
        if s["id"] != support["id"]] + [support]
    return {"landingRetired":retired,"landing":support,"guardOpening":patio_guard_opening(scene,config),
            "reason":"Actual decoded BODY capsule crossed unsupported inner landing columns and a retained terrace glass/rail at the new door"}


def pool_activity_contacts(scene, config):
    """Actual wet-entry contacts; intentionally never added to public Walk support."""
    m = library.materials()
    # Extend the coping toward the dry deck, so its full flat 394mm depth
    # supports an adult foot. Replace the old top locally instead of doubling
    # coplanar stone. The water-side edge and all seven treads stay fixed.
    tool = add_box("pool entry coping top recess", m["plaster"], (-1.91,-1.51,.0005),(-.37,-1.09,.10),0)[0]
    recess = []
    for obj in scene.objects:
        if obj.name.startswith("core_estate_pool__warm cut stone"):
            result = shell.boolean_preserving_islands(obj, tool)
            if result.get("cutNonManifold"):
                raise RuntimeError("The local pool coping recess is not closed")
            recess.append({"mesh":obj.name,**result})
    bpy.data.objects.remove(tool,do_unlink=True)
    add_box("core_finish_pool_entry_coping",m["travertine"],(-1.89,-1.50,.0005),(-.39,-1.10,.020),.003)
    supports = []
    for obj in scene.objects:
        if obj.type != "MESH" or obj.get("shadowOnly") or not obj.name.startswith(("core_estate_pool__", "core_estate_terrace__", "core_finish_pool_entry_coping")):
            continue
        if not any(term in obj.name.lower() for term in ("stone", "mosaic", "travertine")):
            continue
        supports.append((obj, BVHTree.FromPolygons([obj.matrix_world @ v.co for v in obj.data.vertices],
                                                  [list(p.vertices) for p in obj.data.polygons])))
    points = [("dry-recovery", [-1.14, .001, 1.65]), ("coping", [-1.14, .02, 1.30])]
    points += [(f"entry-tread-{k + 1}", [-1.14, -.18 * (k + 1), .94 - .31 * k]) for k in range(7)]
    points.append(("basin-floor", [-1.14, -1.44, -1.50]))
    contacts = []
    for name, point in points:
        hits = []
        for obj, tree in supports:
            hit, normal, index, distance = tree.ray_cast(native([point[0], point[1] + .06, point[2]]), Vector((0, 0, -1)), .14)
            if hit is not None and normal.z > .85:
                hits.append((distance, obj, hit, normal, index))
        if not hits:
            raise RuntimeError(f"No actual pool support for {name}: {point}")
        _, obj, hit, normal, index = min(hits, key=lambda r: r[0])
        actual = world(hit)
        if abs(actual[1] - point[1]) > .006:
            raise RuntimeError(f"Pool {name} expected top {point[1]}, native is {actual[1]}")
        contacts.append({"id": name, "position": actual, "expectedHeight": point[1],
                         "nativeSupport": obj.name, "nativePolygon": index, "normal": [normal.x, normal.z, -normal.y]})
    def clip(polygon, axis, value, keep_greater):
        result=[]
        for a,b in zip(polygon,polygon[1:]+polygon[:1]):
            a_in=(a[axis]>=value) if keep_greater else (a[axis]<=value)
            b_in=(b[axis]>=value) if keep_greater else (b[axis]<=value)
            if a_in:result.append(a)
            if a_in != b_in:
                t=(value-a[axis])/(b[axis]-a[axis])
                result.append([a[k]+(b[k]-a[k])*t for k in range(2)])
        return result
    def subtract_rectangle(polygon,rect):
        remaining, pieces=polygon,[]
        for axis,value,greater in ((0,rect[0],True),(0,rect[1],False),(1,rect[2],True),(1,rect[3],False)):
            if not remaining:break
            outside=clip(remaining,axis,value,not greater)
            if len(outside)>=3:pieces.append(outside)
            remaining=clip(remaining,axis,value,greater)
        return pieces
    surfaces=[]
    opaque_bounds=[]
    for support,_ in supports:
        bm=bmesh.new();bm.from_mesh(support.data)
        for island in components(bm):
            lo,hi=bounds([support.matrix_world@v.co for v in island])
            opaque_bounds.append((lo,hi))
        bm.free()
    for contact in contacts:
        obj=scene.objects[contact["nativeSupport"]]
        candidates=[]
        # Coping and treads use their full real top face. Basin-floor contact
        # includes every same-height floor face, clipped by opaque tread boxes.
        objects=[o for o,_ in supports if "mosaic" in o.name] if contact["id"]=="basin-floor" else [obj]
        for support in objects:
            for face in support.data.polygons:
                if contact["id"]!="basin-floor" and face.index!=contact["nativePolygon"]:continue
                normal=(support.matrix_world.to_3x3().inverted().transposed()@face.normal).normalized()
                vertices=[support.matrix_world@support.data.vertices[i].co for i in face.vertices]
                if normal.z<.999 or any(abs(v.z-contact["position"][1])>2e-5 for v in vertices):continue
                polygons=[[[v.x,-v.y] for v in vertices]]
                for lo,hi in opaque_bounds:
                    if hi.z<=contact["position"][1]+2e-5 or lo.z>contact["position"][1]+.02:continue
                    rect=(lo.x,hi.x,-hi.y,-lo.y)
                    polygons=[piece for poly in polygons for piece in subtract_rectangle(poly,rect)]
                for polygon in polygons:
                    area=abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(polygon,polygon[1:]+polygon[:1])))/2
                    if area<1e-8:continue
                    candidates.append({"id":contact["id"]+f"-surface-{len(candidates)}","height":contact["position"][1],
                        "polygon":polygon,"nativeSupport":support.name,"nativePolygon":face.index,
                        "source": "Actual native upward face, conservatively clipped by higher opaque native component footprints"})
        if not candidates:raise RuntimeError(f"No traversable support polygon for {contact['id']}")
        surfaces+=candidates
    def contains(polygon,point):
        x,z=point[0],point[2]
        crossings=False
        for a,b in zip(polygon,polygon[1:]+polygon[:1]):
            if (a[1]>z)!=(b[1]>z) and x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]:crossings=not crossings
        return crossings
    for contact in contacts:
        surface=next((s for s in surfaces if s["nativeSupport"]==contact["nativeSupport"] and
                      s["nativePolygon"]==contact["nativePolygon"] and contains(s["polygon"],contact["position"])),None)
        if surface is None:raise RuntimeError(f"The {contact['id']} path point is outside its actual support polygon")
        contact["supportId"]=surface["id"]
    config["activities"]["pool"]={"room":"terrace","clip":"idle","sequence":"pool","label":"Pool break","previewOnly":True}
    config["infinityPool"]["activity"] = {
        "coordinateSystem": "THREE world metres [x,up,z]", "waterline": config["infinityPool"]["waterline"],
        "path": contacts,"entry":contacts[0]["position"],"recovery":contacts[0]["position"],
        "exit": list(reversed(contacts)), "dryRecovery": contacts[0]["position"],
        "supportSurfaces":surfaces,"copingRecess":recess,
        "pause":{"position":contacts[-1]["position"],"supportId":contacts[-1]["supportId"],"facing":0,
                 "kind":"Standing calm-water pause on the actual basin floor"},
        "scope": "Authored activity only. Water remains excluded from first-person Walk. Entry/exit contact heights are actual source triangles; decoded verification is a separate receipt."}
    return config["infinityPool"]["activity"]


def finish_activity_routes(scene, config):
    """Native activity journeys and camera metadata; no synthetic outdoor room."""
    import copy
    rooms={room["id"]:room for room in config["rooms"]}
    # The 1.5m-high landing is not headroom for a standing person below it.
    # Keep the original inland gallery and move only its local approach turn
    # onto the existing lower floor, away from the landing's actual underside.
    for point in rooms["study"]["exitPath"]:
        if abs(point[2]-6.65)<1e-6 and -9.71 <= point[0] <= -8.99:
            point[2]=7.10
    rooms["study"]["library"]["route"]=list(reversed(copy.deepcopy(rooms["study"]["exitPath"])))
    rooms["library"]["exitPath"]=[[-9.41,0,3.42],[-10.10,0,3.42],*copy.deepcopy(rooms["study"]["exitPath"])]
    rooms["library"]["library"]["route"]=list(reversed(copy.deepcopy(rooms["library"]["exitPath"])))
    rooms["sleep"]["exitPath"]=[*copy.deepcopy(config["estateLibrary"]["bedroomApproach"]),
        *copy.deepcopy(config["estateLibrary"]["privateConnection"]),*copy.deepcopy(rooms["study"]["exitPath"])]
    for room_id in ("study","library","sleep"):
        config["terrain"]["contacts"][room_id]["exitPath"]=copy.deepcopy(rooms[room_id]["exitPath"])
    rooms["sleep"]["camera"] = {"radius":4.6,"yaw":2.92,"pitch":.30,"fov":50,
        "envelope":{"yaw":[2.65,3.60],"pitch":[.12,.62],"radius":[2.6,5.0]}}
    pool=config["infinityPool"]["activity"]
    pool["camera"]={"target":[-1.14,-.5,-.15],"radius":6.,"yaw":1.,"pitch":.62,"fov":52}
    pool["egress"]=list(rooms["lounge"]["egress"])
    pool["entranceRoute"]=[*copy.deepcopy(config["retreat"]["poolEdgeRoute"]),list(pool["entry"])]
    pool["recoveryRoute"]=list(reversed(copy.deepcopy(pool["entranceRoute"])))
    for line in config["installationLines"]:
        if line["id"].startswith("arrival-rail"):
            line["intensity"] = 2.0
    companion=config["companion"]
    floor=rooms["sleep"]["floor"]
    companion["perches"]["sleep"]=[[-6.8,floor,4.6],[-6.6,floor,4.6]]
    # The retained gallery is adequate for BODY but the kitchen counter and
    # bedroom wall leave less than P's840mm sphere at cruise height. The new
    # real patio door gives it a continuous, surveyed alternative. These are
    # floor/base points; the flight adds its own1.65m cruise exactly once.
    air=[[-9.95,0.,3.90],[-9.41,0.,2.55],[-8.,0.,2.55],
         [3.27,0.,2.55],[3.27,0.,9.20]]
    companion["roomExits"]["study"]={"egress":air[-1],"exitPath":air}
    companion["roomExits"]["library"]={"egress":air[-1],"exitPath":[
        list(companion["perches"]["library"][0]),[-9.95,0.,3.60],*copy.deepcopy(air)]}
    cx,_,cz=config["estateLibrary"]["adjacentBedchamber"]["center"]
    high=floor+1.0
    # Cross the library opening on its centreline before turning north into
    # the free shaft sector. The diagonal clipped the actual limestone jamb.
    private=[[-6.8,high,4.6],[-6.8,high,cz+.20],[cx,high,cz+.20],[cx,high,cz+.72],
             [cx,0.,cz+.72],[cx-.62,0.,cz+.72],[cx-.85,0.,cz],
             [*config["estateLibrary"]["stairApproach"]["bottom"]],[-9.95,0.,4.85],[-9.95,0,3.9]]
    private[-3][1]=0.
    companion["privateLibraryConnection"]=private
    companion["roomExits"]["sleep"]={"egress":air[-1],"exitPath":[*copy.deepcopy(private),*copy.deepcopy(air)]}
    return {"poolCamera":pool["camera"],"poolEntrance":pool["entranceRoute"],
            "poolPublicWalk":"Water remains excluded; activity uses its local support polygons",
            "companion":"Vertical flight through the unoccupied north shaft sector with a720mm pole offset. Base points exclude the runtime's1.65m cruise;420actual runtime flights require a separate native BVH clearance receipt"}
