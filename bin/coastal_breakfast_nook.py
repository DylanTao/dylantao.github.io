"""Bounded private breakfast alcove beneath the delivered bedchamber.

World metres are [x, up, landward]. Construction calls an explicitly supplied,
qualified physical-cutter-local operation; this module never runs global CSG.
The coordinator composes this delta after F6/arrival and requalifies exports.
"""
import copy

VERSION = 8
FLOOR = -1.02
SIDE_NATIVE_Y = (-5.2690815925598145, -3.9715962409973145)
# Two source-bound grounded returns retained from the ORIGINAL rock, not added
# masks. Only the physical room tool for CORE/coast is reduced by these boxes.
FRONT_NATIVE_RETURNS = (
    ((-7.84999942779541, -3.440000057220459, -1.1799999475479126),
     (-7.0, -3.4199981689453125, -.1899999976158142)),
    ((-5.900000095367432, -3.440000057220459, -1.1799999475479126),
     (-5.449999809265137, -3.4199981689453125, -.1899999976158142)),
)
LIGHT_REGION = {"id": "breakfast", "replaces": "study", "min": [-8.15, -1.12, 3.05], "max": [-5.10, 1.45, 6.70]}
BOXES = {
    "room": ([-7.85, -1.18, 3.40], [-5.45, 1.34, 6.60]),
    "stairs": ([-5.20, -1.18, -SIDE_NATIVE_Y[1]], [-2.77, 0.03, -SIDE_NATIVE_Y[0]]),
    "portal": ([-5.50, -1.18, -SIDE_NATIVE_Y[1]], [-5.10, 1.12, -SIDE_NATIVE_Y[0]]),
    "foot-south": ([-8.11, -1.24, 3.44], [-7.79, -1.14, 3.76]),
    "foot-north": ([-8.11, -1.24, 6.24], [-7.79, -1.14, 6.56]),
}
OWNER_BOXES = {
    "core__golden coastal sandstone": tuple(BOXES),
    "coast_shared_golden coastal sandstone": tuple(BOXES),
    "core_reno_slab_ground": ("stairs",),
    "core_reno_floorboards_lower": ("stairs",),
    "core_finish_bedchamber_rock_fin__La Jolla bluff sandstone": ("portal",),
}
TABLE_DELTA = (-3.24, -0.60, 0.45)
OLIVE_DELTA = (-2.44, -0.60, 2.49)
BENCH_DELTA = (-3.06, -0.60, 0.45)
PICTURE_DELTA = (-2.61, -1.04, 0.95)
RETIRED_VIEW_BENCH = {
    "core_facade__golden_coastal_sandstone": "d5ea66db214f7d8ad1b075403d22b494f1be3d382b80d45730e92a0932e01a61",
    "core_facade__weathered_teak_wood": "eff0b2b6773962a422b989ebf04549935c951813ffddd72d308d0204f33337dc",
    "core_facade__outdoor_canvas_cotton": "3fbc855fa607a4a1698cbaeddc7277bd8a1fab9d73902099ac6079a951aff758",
}


def native(point):
    return point[0], -point[2], point[1]


def placement():
    """Only owning placement/support metadata, in final world coordinates."""
    supports = [{"id": "breakfast-floor", "height": FLOOR,
                 "polygon": [[-7.85, 3.40], [-5.45, 3.40], [-5.45, 6.60], [-7.85, 6.60]]},
                {"id": "breakfast-landing", "height": FLOOR,
                 "polygon": [[-5.45, 3.98], [-4.83, 3.98], [-4.83, 5.26], [-5.45, 5.26]]},
                {"id": "breakfast-top-landing", "height": 0,
                 "polygon": [[-3.43, 3.98], [-2.13, 3.98], [-2.13, 5.26], [-3.43, 5.26]]}]
    for k in range(5):
        a, b = -3.43 - (k + 1) * 0.28, -3.43 - k * 0.28
        supports.append({"id": "breakfast-tread-" + str(k + 1), "height": -(k + 1) * 0.17,
                         "polygon": [[a, 3.98], [b, 3.98], [b, 5.26], [a, 5.26]]})
    for suffix,z0,z1 in (("south",3.62,3.97),("north",5.27,5.60)):
        supports.append({"id":"breakfast-reclaimed-"+suffix,"height":0,
                         "polygon":[[-4.97,z0],[-2.79,z0],[-2.79,z1],[-4.97,z1]]})
    route = [[-6.055, FLOOR, 5.71], [-6.055, FLOOR, 4.62], [-4.83, FLOOR, 4.62]]
    route += [[-3.43 - (k + 0.5) * 0.28, -(k + 1) * 0.17, 4.62] for k in reversed(range(5))]
    route += [[-3.35, 0, 4.62], [-3.35, 0, 6.60]]
    return {"version": VERSION, "floor": FLOOR, "actor": [-7.19, -1.075, 5.71],
            "seatY": -0.56, "tableY": -0.28, "exitPath": route,
            "lightRegion": copy.deepcopy(LIGHT_REGION), "supportSurfaces": supports,
            "picture": [-7.795, 0.38, 5.85], "pictureLight": [-7.66, 0.94, 5.85],
            "practicalSource": {"position": [-7.66, 0.94, 5.85], "emitterRadius": 0.03},
            "clearances": {"aisle": 1.21, "stair": 1.28, "portal": SIDE_NATIVE_Y[1] - SIDE_NATIVE_Y[0], "landing": 1.30, "head": 2.14,
                           "existingCookingAisleNominal": 1.07}}


def _subset(mesh, face_ids, name):
    """Retain complete original faces and every original numeric mesh field."""
    import bpy
    import numpy as np
    face_ids = sorted(face_ids)
    vi = sorted({v for i in face_ids for v in mesh.polygons[i].vertices})
    remap = {v: i for i, v in enumerate(vi)}
    li = [j for i in face_ids for j in mesh.polygons[i].loop_indices]
    out = bpy.data.meshes.new(name)
    out.from_pydata([tuple(mesh.vertices[i].co) for i in vi], [],
                    [[remap[v] for v in mesh.polygons[i].vertices] for i in face_ids])
    for m in mesh.materials:
        out.materials.append(m)
    for dst, i in zip(out.polygons, face_ids):
        dst.material_index = mesh.polygons[i].material_index
        dst.use_smooth = mesh.polygons[i].use_smooth
    old_edges = {tuple(sorted(e.vertices)): e.index for e in mesh.edges}
    ei = [old_edges[tuple(sorted(vi[v] for v in e.vertices))] for e in out.edges]
    domains = {"POINT": vi, "CORNER": li, "FACE": face_ids, "EDGE": ei}
    for attr in mesh.attributes:
        if attr.name.startswith(".") or attr.name in ("position", "material_index", "custom_normal"):
            continue
        if attr.domain not in domains:
            raise RuntimeError("Unmapped original attribute " + attr.name)
        target = out.attributes.get(attr.name) or out.attributes.new(attr.name, attr.data_type, attr.domain)
        for prop in attr.data[0].bl_rna.properties if len(attr.data) else []:
            if prop.identifier == "rna_type" or prop.type not in ("INT", "FLOAT", "BOOLEAN"):
                continue
            # color_srgb is a derived conversion for FLOAT_COLOR. Writing both
            # views round-trips and changes retained linear data. BYTE_COLOR's
            # storage is sRGB, so copy that representation only in that case.
            if attr.data_type in ("FLOAT_COLOR", "BYTE_COLOR") and prop.identifier != ("color" if attr.data_type == "FLOAT_COLOR" else "color_srgb"):
                continue
            width = prop.array_length if getattr(prop, "is_array", False) else 1
            dtype = np.float32 if prop.type == "FLOAT" else np.int32 if prop.type == "INT" else np.bool_
            values = np.empty(len(attr.data) * width, dtype=dtype)
            attr.data.foreach_get(prop.identifier, values)
            values = values.reshape((-1, width))[domains[attr.domain]].reshape(-1)
            target.data.foreach_set(prop.identifier, values)
    if mesh.has_custom_normals:
        source = mesh.attributes.get("custom_normal")
        if source.data_type == "INT16_2D":
            out.normals_split_custom_set([tuple(mesh.corner_normals[i].vector) for i in li])
            values = np.empty(len(source.data) * 2, dtype=np.int32)
            source.data.foreach_get("value", values)
            out.attributes["custom_normal"].data.foreach_set("value", values.reshape((-1, 2))[li].reshape(-1))
        elif source.data_type == "FLOAT_VECTOR":
            target = out.attributes.new("custom_normal", "FLOAT_VECTOR", "CORNER")
            target.data.foreach_set("vector", np.asarray([tuple(mesh.corner_normals[i].vector) for i in li], dtype=np.float32).reshape(-1))
        else:
            raise RuntimeError("Unmapped original custom normal " + source.data_type)
    if mesh.color_attributes.active_color:
        out.color_attributes.active_color = out.color_attributes[mesh.color_attributes.active_color.name]
        out.color_attributes.render_color_index = mesh.color_attributes.render_color_index
    out.update()
    return out


def _islands(obj):
    import bmesh
    import coastal_shell
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    rows = []
    for group in coastal_shell._islands(bm):
        points = [obj.matrix_world @ v.co for v in group]
        lo = [min(p[k] for p in points) for k in range(3)]
        hi = [max(p[k] for p in points) for k in range(3)]
        rows.append({"vertices": [v.index for v in group], "faces": {f.index for v in group for f in v.link_faces},
                     "lo": [lo[0], lo[2], -hi[1]], "hi": [hi[0], hi[2], -lo[1]]})
    bm.free()
    return rows


def _inside(row, lo, hi, tolerance=0.00001):
    return all(row["lo"][k] >= lo[k] - tolerance and row["hi"][k] <= hi[k] + tolerance for k in range(3))


def view_bench_fingerprint(obj):
    """Bind the measured complete furniture objects, including corner fields."""
    import hashlib
    import json
    mesh = obj.data
    fields = {"matrix": [list(row) for row in obj.matrix_world],
              "vertices": [list(vertex.co) for vertex in mesh.vertices],
              "polygons": [list(face.vertices) for face in mesh.polygons],
              "materials": [material.name for material in mesh.materials], "attributes": []}
    for attribute in mesh.attributes:
        values = {}
        for prop in attribute.data[0].bl_rna.properties if len(attribute.data) else []:
            if prop.identifier == "rna_type" or prop.type not in ("INT", "FLOAT", "BOOLEAN"):
                continue
            if attribute.data_type in ("FLOAT_COLOR", "BYTE_COLOR") and prop.identifier != ("color" if attribute.data_type == "FLOAT_COLOR" else "color_srgb"):
                continue
            values[prop.identifier] = [list(getattr(item, prop.identifier)) if prop.is_array else getattr(item, prop.identifier) for item in attribute.data]
        fields["attributes"].append({"name": attribute.name, "type": attribute.data_type, "domain": attribute.domain, "values": values})
    return hashlib.sha256(json.dumps(fields, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def retire_view_bench(scene):
    """Retire only the three guarded bench objects blocking the seated view."""
    import bpy
    objects = []
    for name, expected in RETIRED_VIEW_BENCH.items():
        obj = scene.objects.get(name)
        if not obj or obj.type != "MESH" or obj.data.users != 1 or view_bench_fingerprint(obj) != expected:
            raise RuntimeError("External view bench custody changed: " + name)
        objects.append(obj)
    records = []
    for obj in objects:
        obj.data.calc_loop_triangles()
        records.append({"object": obj.name, "fieldSha256": RETIRED_VIEW_BENCH[obj.name],
                        "vertices": len(obj.data.vertices), "polygons": len(obj.data.polygons),
                        "triangles": len(obj.data.loop_triangles), "action": "retire-whole-view-bench"})
        bpy.data.objects.remove(obj, do_unlink=True)
    return records


def move_furnishings(scene):
    """Move exact table/fixture/plant islands; retire only the measured old nook."""
    import bpy
    from mathutils import Matrix, Vector
    actions = []
    split_names = {
        "kitchen__honey ash": "kitchen_nook_olive_stem__honey ash",
        "kitchen__terracotta": "kitchen_nook_olive_pot__terracotta",
    }
    for obj in list(scene.objects):
        if obj.type != "MESH" or not obj.name.startswith("kitchen") or obj.get("activityProp"):
            continue
        original = obj.data
        retired = set()
        split_olive = set()
        matrix_olive = set()
        for row in _islands(obj):
            action, delta = None, None
            lo, hi = row["lo"], row["hi"]
            # Source-bound original placeholder: keep the inland seat/back/lumbar.
            if obj.name == "kitchen_placeholder_nook-banquette":
                if _inside(row, [-4.75, -0.081, 4.95], [-3.60, 0.47, 5.51]) and len(row["vertices"]) in (152, 96):
                    mesh = _subset(original, row["faces"], "breakfast retained cushion")
                    cushion = bpy.data.objects.new("kitchen_breakfast_cushion", mesh)
                    scene.collection.objects.link(cushion)
                    cushion.matrix_world = obj.matrix_world.copy()
                    cushion.location += Vector(native(BENCH_DELTA))
                    # Keep the full backrest; a small pale pillow rests at the right end,
                    # leaving the principal seat clear instead of filling its centre.
                    if len(row["vertices"]) == 96:
                        cushion.location.x += 0.42
                    material = bpy.data.materials["rust boucle textile"] if len(row["vertices"]) == 152 else bpy.data.materials["linen"]
                    mesh.materials.clear(); mesh.materials.append(material)
                    for face in mesh.polygons: face.material_index = 0
                    cushion["breakfastNook"] = True
                    action = "reuse-inland-cushion"
                else:
                    action = "retire-old-L-part"
                retired.update(row["faces"])
            elif obj.name == "kitchen__olive leaf" or obj.name.startswith("kitchen_nook_olive") or (
                obj.name == "kitchen__honey ash" and _inside(row, [-4.95, -0.1, 3.60], [-4.40, 1.20, 4.15])) or (
                obj.name == "kitchen__terracotta" and _inside(row, [-4.93, -0.43, 3.65], [-4.51, -0.03, 4.07])):
                action, delta = "whole-olive", OLIVE_DELTA
                if obj.name in split_names:
                    action = "split-whole-olive"
                    split_olive.update(row["faces"])
                    retired.update(row["faces"])
                else:
                    matrix_olive.update(row["faces"])
            elif _inside(row, [-4.43, -0.43, 3.99], [-3.41, 0.33, 5.01]) and obj.name in (
                "kitchen__pale oak", "kitchen__polished nickel", "kitchen__honed travertine", "kitchen__warm glazed porcelain", "kitchen__celadon glaze"):
                action, delta = "table-contact-assembly", TABLE_DELTA
            elif obj.name == "kitchen__dining lantern paper" and _inside(row, [-4.30, 1.11, 4.12], [-3.54, 1.73, 4.88]):
                action, delta = "table-lantern", TABLE_DELTA
            elif obj.name == "kitchen__honey ash" and _inside(row, [-4.30, 1.17, 4.12], [-3.54, 1.67, 4.88]):
                action, delta = "table-lantern-rib", TABLE_DELTA
            elif obj.name == "kitchen__brushed brass" and _inside(row, [-3.95, 1.71, 4.47], [-3.89, 1.77, 4.53]):
                action, delta = "table-lantern-cap", TABLE_DELTA
            elif obj.name == "kitchen__charcoal" and _inside(row, [-3.93, 1.71, 4.49], [-3.91, 5.01, 4.51]):
                action = "shorten-owned-lantern-cord"
                retired.update(row["faces"])
            elif obj.name == "kitchen__brushed brass" and _inside(row, [-5.18, 1.93, 4.63], [-5.02, 2.01, 5.17]):
                action, delta = "picture-light", PICTURE_DELTA
            elif _inside(row, [-5.20, -0.73, 3.61], [-2.78, 0.63, 5.62]) and obj.name in (
                "kitchen__pale oak", "kitchen__honey ash", "kitchen__warm cut stone", "kitchen__chalk limestone",
                "kitchen__linen", "kitchen__terracotta", "kitchen__celadon glaze"):
                action = "retire-old-nook-enclosure"
                retired.update(row["faces"])
            if delta and action not in ("whole-olive", "split-whole-olive"):
                transform = obj.matrix_world.inverted().to_3x3() @ Vector(native(delta))
                for index in row["vertices"]:
                    original.vertices[index].co += transform
            if action:
                actions.append({"object": obj.name, "action": action, "vertices": len(row["vertices"]),
                                "faces": sorted(row["faces"]), "beforeWorld": [lo, hi], "delta": delta})
                if action in ("whole-olive", "split-whole-olive"):
                    actions[-1].update(rigidMode="object-matrix", deliveryObject=split_names.get(obj.name, obj.name),
                                       retiredFromSource=action == "split-whole-olive")
        # Keep the plant's local geometry and packed-normal basis unchanged.
        # Vertex translation rounded thin branch/leaf positions, changing their
        # resolved split normals. Whole dedicated objects need only a rigid node
        # matrix; the two shared material batches release exact owned islands.
        if matrix_olive:
            if matrix_olive != set(range(len(original.polygons))) or retired:
                raise RuntimeError("Whole olive object no longer has exclusive ownership: " + obj.name)
            obj.matrix_world = Matrix.Translation(Vector(native(OLIVE_DELTA))) @ obj.matrix_world
        if split_olive:
            name = split_names[obj.name]
            if name in bpy.data.objects:
                raise RuntimeError("Rigid olive destination already exists: " + name)
            plant = obj.copy()
            plant.name = name
            plant.data = _subset(original, split_olive, name + " mesh")
            scene.collection.objects.link(plant)
            plant.matrix_world = Matrix.Translation(Vector(native(OLIVE_DELTA))) @ obj.matrix_world
            plant["breakfastNook"] = True
        if retired:
            keep = set(range(len(original.polygons))) - retired
            if not keep:
                bpy.data.objects.remove(obj, do_unlink=True)
            else:
                replacement = _subset(original, keep, original.name + " retained")
                old_name = original.name
                obj.data = replacement
                bpy.data.meshes.remove(original)
                replacement.name = old_name
    if sum(a["action"] == "table-contact-assembly" for a in actions) != 26:
        raise RuntimeError("Original table assembly inventory changed")
    if sum(a["action"] == "reuse-inland-cushion" for a in actions) != 3:
        raise RuntimeError("Original inland cushion inventory changed")
    return actions


def cutter_geometry(tool, label):
    """Record the actual temporary closed tool; no nominal-plane inference."""
    tool.data.calc_loop_triangles()
    vertices = [tuple(tool.matrix_world @ vertex.co) for vertex in tool.data.vertices]
    return {"label": label, "nativeVertices": vertices,
            "nativeTriangles": [tuple(face.vertices) for face in tool.data.loop_triangles],
            "nativeBounds": [[min(point[k] for point in vertices) for k in range(3)],
                             [max(point[k] for point in vertices) for k in range(3)]]}


def author_cutter(tool, label):
    """Only NEW tools use a common world frame and approved Float32 planes."""
    from mathutils import Matrix
    before = cutter_geometry(tool, label)
    points = before["nativeVertices"]
    middle = (before["nativeBounds"][0][1] + before["nativeBounds"][1][1]) / 2
    tool.matrix_world = Matrix.Identity(4)
    for vertex, point in zip(tool.data.vertices, points):
        vertex.co = point
        if label in ("stairs", "portal"):
            vertex.co.y = SIDE_NATIVE_Y[0 if point[1] < middle else 1]
        if label == "stairs" and point[0] > -3.5:
            vertex.co.x = -2.77
    tool.data.update()
    after = cutter_geometry(tool, label)
    if label in ("stairs", "portal"):
        if (after["nativeBounds"][0][1], after["nativeBounds"][1][1]) != SIDE_NATIVE_Y:
            raise RuntimeError("Actual temporary side planes differ from approved Float32 values")
    return {"beforeWorldFrame": before, "authored": after,
            "existingModelObjectsChanged": False}


def retain_grounded_front_returns(tool):
    """Reduce only the NEW room cutter by the two approved original-rock keys."""
    import bpy
    import bmesh
    from coastal_office import Parts
    material = bpy.data.materials["golden coastal sandstone"]
    rows = []
    for index, (lo, hi) in enumerate(FRONT_NATIVE_RETURNS):
        parts = Parts("breakfast temporary ORIGINAL return " + str(index))
        bm = parts.bm(material)
        for vertex in bmesh.ops.create_cube(bm, size=1)["verts"]:
            vertex.co = tuple(lo[k] if vertex.co[k] < 0 else hi[k] for k in range(3))
        box = parts.finish()[0]
        realized = cutter_geometry(box, "retained original return " + str(index))
        if realized["nativeBounds"] != [list(lo), list(hi)]:
            raise RuntimeError("Grounded-return tool lost an exact authored Float32 plane")
        modifier = tool.modifiers.new("NEW room tool retains ORIGINAL front return", "BOOLEAN")
        modifier.operation = "DIFFERENCE"; modifier.solver = "MANIFOLD"; modifier.object = box
        bpy.context.view_layer.objects.active = tool
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        rows.append(realized)
        mesh = box.data
        bpy.data.objects.remove(box, do_unlink=True)
        bpy.data.meshes.remove(mesh)
    check = bmesh.new(); check.from_mesh(tool.data)
    invalid = sum(not edge.is_manifold or not edge.is_contiguous for edge in check.edges)
    volume = abs(check.calc_volume(signed=True)); check.free()
    if invalid or volume <= 0:
        raise RuntimeError("Reduced NEW room tool is not positive directed-closed")
    return {"scope": "Only two source-bound ORIGINAL rock returns; no additive masks or old-object edits",
            "retainedNativeBoxes": rows, "actualReducedRoom": cutter_geometry(tool, "actual reduced room"),
            "invalidDirectedEdges": invalid, "closedToolVolumeM3": volume}


def triangulate_temporary_tool(tool):
    """Construction-only control: same exact vertices and physical closed tool."""
    import bmesh
    before = cutter_geometry(tool, "before NEW-tool triangulation")
    bm = bmesh.new(); bm.from_mesh(tool.data)
    volume_before = bm.calc_volume(signed=True)
    bmesh.ops.triangulate(bm, faces=list(bm.faces), quad_method="BEAUTY", ngon_method="BEAUTY")
    invalid = sum(not edge.is_manifold or not edge.is_contiguous for edge in bm.edges)
    volume_after = bm.calc_volume(signed=True)
    bm.to_mesh(tool.data); bm.free(); tool.data.update()
    after = cutter_geometry(tool, "actual triangulated NEW tool")
    if after["nativeVertices"] != before["nativeVertices"] or invalid:
        raise RuntimeError("NEW-tool triangulation changed coordinates or directed closure")
    return {"before": before, "after": after, "signedVolumeBefore": volume_before,
            "signedVolumeAfter": volume_after, "invalidDirectedEdges": invalid,
            "scope": "Only NEW temporary tool topology; physical union requires independent exact verification"}


def exact_axis_tool_classifier(tool, output, owner):
    """R6-only inclusive membership of the ACTUAL closed rectilinear tool.

    Exact rational ray crossings decompose the realized mesh into axis cells.
    The exact cell volume must equal its oriented triangle volume. Source point
    tests compare the original binary coordinates directly: no surface epsilon.
    """
    import hashlib
    import json
    from fractions import Fraction as F
    if owner not in OWNER_BOXES:
        raise RuntimeError("Exact R6 membership used outside the declared five-owner lease")
    geometry = cutter_geometry(tool, "actual R6 membership tool")
    points = [tuple(map(F, point)) for point in geometry["nativeVertices"]]
    triangles = [tuple(points[i] for i in face) for face in geometry["nativeTriangles"]]
    grids = [sorted({point[k] for point in points}) for k in range(3)]
    def cross(a, b):
        return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
    x_faces = []; mesh_volume = F(0)
    for triangle in triangles:
        a, b, c = triangle
        normal = cross(tuple(b[k]-a[k] for k in range(3)), tuple(c[k]-a[k] for k in range(3)))
        axes = [k for k in range(3) if normal[k] != 0]
        if len(axes) != 1:
            raise RuntimeError("Exact R6 membership requires genuine rectilinear tool triangles")
        mesh_volume += sum(a[k]*cross(b, c)[k] for k in range(3))/6
        if axes[0] == 0:
            if not a[0] == b[0] == c[0]:
                raise RuntimeError("Realized R6 triangle left its axis plane")
            x_faces.append((a[0], tuple((p[1], p[2]) for p in triangle), 1 if normal[0] > 0 else -1))
    def area(a, b, p):
        return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
    cells = []; volume = F(0)
    for yi, (yl, yh) in enumerate(zip(grids[1], grids[1][1:])):
        for zi, (zl, zh) in enumerate(zip(grids[2], grids[2][1:])):
            center = ((yl+yh)/2, (zl+zh)/2)
            events = {}
            for x, triangle, sign in x_faces:
                scores = [area(triangle[j], triangle[(j+1)%3], center) for j in range(3)]
                if all(v >= 0 for v in scores) or all(v <= 0 for v in scores):
                    events.setdefault(x, set()).add(sign)
            if any(len(signs) != 1 for signs in events.values()):
                raise RuntimeError("R6 exact ray encountered opposed coincident surface events")
            for xl, xh in zip(grids[0], grids[0][1:]):
                winding = sum(next(iter(signs)) for x, signs in events.items() if x > (xl+xh)/2)
                if winding not in (0, 1):
                    raise RuntimeError("Realized R6 tool does not have unit closed-cell winding")
                if winding:
                    cells.append(((xl, yl, zl), (xh, yh, zh)))
                    volume += (xh-xl)*(yh-yl)*(zh-zl)
    if volume <= 0 or volume != mesh_volume:
        raise RuntimeError("Exact R6 cell and actual oriented tool volumes differ")
    binary_cells = [[tuple(map(float, lo)), tuple(map(float, hi))] for lo, hi in cells]
    def contains(point):
        return any(all(lo[k] <= point[k] <= hi[k] for k in range(3)) for lo, hi in binary_cells)
    if not all(contains(point) for point in geometry["nativeVertices"]):
        raise RuntimeError("Actual R6 tool boundary failed inclusive membership")
    report = {"scope": "Exact ACTUAL R6 tool only. Inclusive closed boundaries; no nearest-surface or optical/geometry tolerance.",
              "owner": owner, "toolGeometry": geometry, "axisCells": binary_cells,
              "exactCellVolume": str(volume), "exactOrientedTriangleVolume": str(mesh_volume),
              "actualToolVerticesInclusive": len(points), "allActualToolVerticesInside": True,
              "toolGeometrySha256": hashlib.sha256(json.dumps(geometry, sort_keys=True).encode()).hexdigest()}
    (output / ("exact-r6-tool-membership-" + owner.replace(" ", "_") + ".json")).write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    return contains


def project_created_slab_caps(obj, tool, source_fields, apply=True):
    """Repair only born SLAB cap coordinates to the actual declared tool plane.

    The tool, original exact corners, indices and every other owner are fixed.
    Original-chart field restoration follows this construction step as usual.
    """
    if obj.name != "core_reno_slab_ground":
        return {"applicable": False, "owner": obj.name}
    import math
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    mesh = obj.data
    own = mesh.attributes["Breakfast source triangle"]
    original = {tuple(point) for row in source_fields["triangles"].values() for point in row["p"]}
    tool.data.calc_loop_triangles()
    tool_points = [tool.matrix_world @ vertex.co for vertex in tool.data.vertices]
    tool_triangles = [tuple(face.vertices) for face in tool.data.loop_triangles]
    planes = [set() for _ in range(3)]
    for triangle in tool_triangles:
        points = [tool_points[i] for i in triangle]
        axes = [k for k in range(3) if all(point[k] == points[0][k] for point in points)]
        if len(axes) != 1:
            raise RuntimeError("SLAB cap requires a genuine axis-plane tool triangle")
        planes[axes[0]].add(points[0][axes[0]])
    tree = BVHTree.FromPolygons(tool_points, tool_triangles, all_triangles=True)
    normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
    world = [tuple(obj.matrix_world @ vertex.co) for vertex in mesh.vertices]
    constraints = {}; cap_faces = []
    for face in mesh.polygons:
        if own.data[face.index].value != 0:
            continue
        normal = (normal_matrix @ face.normal).normalized()
        axis = max(range(3), key=lambda k: abs(normal[k]))
        if abs(normal[axis]) < 1 - 1e-6:
            raise RuntimeError("Born SLAB cap is not on an actual tool axis plane")
        values = {value for value in planes[axis] if all(abs(world[i][axis] - value) <= 3e-6 for i in face.vertices)}
        if len(values) != 1:
            raise RuntimeError("Born SLAB cap has no unique declared tool plane")
        value = next(iter(values))
        cap_faces.append({"face": face.index, "axis": axis, "plane": value, "vertices": list(face.vertices)})
        for index in face.vertices:
            existing = constraints.setdefault(index, {})
            if axis in existing and existing[axis] != value:
                raise RuntimeError("Conflicting born SLAB cap plane constraints")
            existing[axis] = value
    incident = {index: set() for index in constraints}
    for face in mesh.polygons:
        sid = own.data[face.index].value
        if sid > 0:
            for index in face.vertices:
                if index in incident:
                    incident[index].add(sid)
    moves = []
    for index, axes in constraints.items():
        before = world[index]
        desired = tuple(axes.get(k, before[k]) for k in range(3))
        local = obj.matrix_world.inverted() @ Vector(desired)
        after = tuple(obj.matrix_world @ local)
        if any(after[k] != value for k, value in axes.items()):
            # Actual source SLAB has matrixY=-8: this exact world plane lies
            # halfway between local Float32 values. Keep the cutter fixed and
            # choose ONLY the coordinator-approved inward representable value.
            expected_matrix = ((1., 0., 0., 0.), (0., 1., 0., -8.), (0., 0., 1., 0.), (0., 0., 0., 1.))
            if (tuple(tuple(row) for row in obj.matrix_world) != expected_matrix
                    or axes.get(1) != -3.97029709815979
                    or any(after[k] != value for k, value in axes.items() if k != 1)):
                raise RuntimeError("Unapproved cap plane is not exactly representable in the original SLAB frame")
            local.y = 4.029702663421631
            after = tuple(obj.matrix_world @ local)
            if after[1] != -3.970297336578369 or after[1] > axes[1]:
                raise RuntimeError("Conservative SLAB cap missed its approved inside halfspace")
        if after == before:
            continue
        if before in original:
            raise RuntimeError("Born SLAB projection would move an exact original source corner")
        distance = math.dist(before, after)
        nearest = tree.find_nearest(Vector(before))
        if distance > 3e-6 or nearest[0] is None or nearest[3] > 3e-6:
            raise RuntimeError("Born SLAB cap movement exceeds its declared construction bound")
        row = {"vertex": index, "beforeWorld": before, "declaredPlaneWorld": desired, "afterWorld": after,
               "distanceM": distance, "planes": axes, "incidentInheritedSourceTriangles": sorted(incident[index]),
               "storedPlaneResidualM": {k: after[k] - value for k, value in axes.items()},
               "wasExactOriginalCorner": False}
        moves.append(row)
        if apply:
            mesh.vertices[index].co = local
            actual = tuple(obj.matrix_world @ mesh.vertices[index].co)
            if actual != after:
                raise RuntimeError("Stored SLAB cap failed its bound inside-coordinate readback")
    if apply:
        mesh.update()
    return {"applicable": True, "owner": obj.name, "apply": apply,
            "scope": "Source0 faces and born nonoriginal vertices only; original exact positions/edge identities fixed. Tool unchanged. Only the approved SLABmaxY plane may store0.238419um inside; other declared planes exact.",
            "capFaces": cap_faces, "moves": moves, "maxMovementM": max((row["distanceM"] for row in moves), default=0),
            "originalCornerCount": len(original), "physicalGatesRequired": True}


def build_upper_landing(scene, target, material, plane):
    """Fit only NEW stone against the unchanged original slab and rounded board."""
    import bpy
    import bmesh
    from coastal_office import Parts
    board = bpy.data.objects["core_reno_floorboards_lower"]
    board_before = view_bench_fingerprint(board)

    def piece(name, lo, hi):
        parts = Parts(name)
        bm = parts.bm(material)
        low = (lo[0], -hi[2], lo[1])
        high = (hi[0], -lo[2], hi[1])
        vertices = bmesh.ops.create_cube(bm, size=1)["verts"]
        for vertex in vertices:
            vertex.co = tuple(low[k] if vertex.co[k] < 0 else high[k] for k in range(3))
        return parts.finish()[0]

    block = piece("breakfast temporary keyed landing", [-3.43, -1.18, 3.98], [plane, 0, 5.26])
    key = piece("breakfast temporary landing finish key", [plane-.005, -.032, 3.98], [-2.752, 0, 5.26])

    def boolean(operation, cutter):
        modifier = block.modifiers.new("NEW landing only " + operation, "BOOLEAN")
        modifier.operation = operation
        modifier.solver = "MANIFOLD"
        modifier.object = cutter
        if hasattr(modifier, "material_mode"):
            modifier.material_mode = "INDEX"
        bpy.context.view_layer.objects.active = block
        bpy.ops.object.modifier_apply(modifier=modifier.name)

    boolean("UNION", key)
    key_mesh = key.data
    bpy.data.objects.remove(key, do_unlink=True)
    bpy.data.meshes.remove(key_mesh)
    before_board_cut = sum(polygon.area for polygon in block.data.polygons)
    boolean("DIFFERENCE", board)
    if view_bench_fingerprint(board) != board_before:
        raise RuntimeError("Original floorboards changed during NEW landing fit")
    # Boolean adds the read-only tool's slot even when every result face keeps
    # INDEX0. Remove only unused slots on this NEW stone; never edit the board.
    result_slots = [slot.name if slot else None for slot in block.data.materials]
    if not result_slots or result_slots[0] != material.name or any(face.material_index != 0 for face in block.data.polygons):
        raise RuntimeError("NEW landing cut assigned an unowned material")
    block.data.materials.clear()
    block.data.materials.append(material)
    check = bmesh.new(); check.from_mesh(block.data)
    invalid = sum(not edge.is_manifold or not edge.is_contiguous for edge in check.edges)
    volume = abs(check.calc_volume(signed=True)); check.free()
    if invalid or volume <= 0:
        raise RuntimeError("NEW keyed landing is not a positive closed solid")
    block.data.calc_loop_triangles()
    report = {"actualStructuralEndX": plane, "originalSlabInterval": [-.2800000011920929, -.02199999988079071],
              "originalBoardInterval": [-.019500000402331352, .002499999478459358],
              "finishKeyBounds": [[plane-.005, -.032, 3.98], [-2.752, 0, 5.26]],
              "boardFit": "Difference modifies only NEW stone; original rounded board is the exact read-only tool",
              "originalBoardFingerprintExact": True, "beforeBoardCutSurfaceArea": before_board_cut,
              "booleanMaterialSlotsBeforeUnusedRemoval": result_slots, "everyNewFaceMaterialIndex": 0,
              "closedVolumeM3": volume, "triangles": len(block.data.loop_triangles), "invalidDirectedEdges": invalid}
    target.from_mesh(block.data)
    mesh = block.data
    bpy.data.objects.remove(block, do_unlink=True)
    bpy.data.meshes.remove(mesh)
    return report


def build_structure(scene, upper_landing_plane=-2.7699999809265137):
    """Few closed physical pieces, with measured floor/soffit attachment."""
    import bpy
    from coastal_office import Parts, box, cylinder
    parts = Parts("core_breakfast_nook")
    mats = {key: bpy.data.materials[name] for key, name in {
        "stone": "warm cut stone", "wall": "chalk limestone", "oak": "pale oak", "wood": "honey ash", "bronze": "brushed brass", "cord": "charcoal"}.items()}
    def wbox(material, lo, hi):
        center = [(lo[k] + hi[k]) / 2 for k in range(3)]
        size = [hi[k] - lo[k] for k in range(3)]
        box(parts.bm(mats[material]), native(center), (size[0], size[2], size[1]), 0)
    # Floor bases bear on the actual tool-bottom rock, not a floating finish.
    wbox("stone", [-7.85, -1.18, 3.40], [-5.45, FLOOR, 6.60])
    wbox("stone", [-5.45, -1.18, 3.98], [-4.83, FLOOR, 5.26])
    upper_landing = build_upper_landing(scene, parts.bm(mats["stone"]), mats["stone"], upper_landing_plane)
    for k in range(5):
        wbox("stone", [-3.43 - (k + 1) * .28, -1.18, 3.98], [-3.43 - k * .28, -(k + 1) * .17, 5.26])
    # Reclaim only the retired 42cm nook's thin strips beside the new descent.
    wbox("stone", [-4.97, -.72, 3.62], [-2.79, 0, 3.97])
    wbox("stone", [-4.97, -.72, 5.27], [-2.79, 0, 5.60])
    # Supported west frame; the original east fin/header is retained, not duplicated.
    wbox("wall", [-8.05, 1.12, 3.43], [-7.85, 1.34, 6.57])
    for z in (3.60, 6.40):
        wbox("stone", [-8.11, -1.24, z-.16], [-7.79, -1.14, z+.16])
        wbox("wall", [-8.05, -1.14, z-.10], [-7.85, 1.12, z+.10])
    wbox("wall", [-7.85, FLOOR, 3.40], [-7.80, 1.12, 6.60])
    wbox("wall", [-7.80, FLOOR, 6.55], [-5.45, 1.34, 6.60])
    # Exact original cushions reused above this compact grounded plinth.
    wbox("wood", [-7.79, FLOOR, 5.43], [-6.68, -.68, 6.03])
    wbox("oak", [-7.79, -.68, 5.95], [-6.68, -.10, 6.03])
    # A shortened cord ends at the actual bedroom-slab soffit.
    cylinder(parts.bm(mats["cord"]), native([-7.16, 1.12, 4.95]), native([-7.16, 1.34, 4.95]), .0025, 6)
    # Handrails stay outside the1.28m walking rectangle and follow the stair.
    for z in (3.96, 5.28):
        top = -3.43 if z < 5 else -3.65
        top_floor = (top + 3.43) * 1.02 / 1.40
        cylinder(parts.bm(mats["bronze"]), native([top, top_floor + .90, z]), native([-4.83, -.12, z]), .018, 10)
        for x,y in ((top,top_floor),(-4.83,FLOOR)):
            cylinder(parts.bm(mats["bronze"]),native([x,y,z]),native([x,y+.90,z]),.012,8)
    # Three low planted cups stay west of the full standing aisle and below the seated eye.
    import math
    from mathutils import Vector
    from coastal_kitchen import nook_olive_leaf_points, nook_olive_leaf_triangles
    terra = parts.bm(bpy.data.materials["terracotta"])
    soil = parts.bm(bpy.data.materials["honey ash"])
    foliage = parts.bm(bpy.data.materials["olive leaf"])
    for pot, x in enumerate((-7.55, -7.18, -6.85)):
        center = native([x, FLOOR + .45, 3.65])
        profile = ((.10, 0), (.11, .02), (.13, .17), (.13, .19), (.115, .19), (.113, .03))
        rings = [[terra.verts.new((center[0]+radius*math.cos(j*math.tau/16), center[1]+radius*math.sin(j*math.tau/16), center[2]+height)) for j in range(16)] for radius,height in profile]
        for a,b in zip(rings,rings[1:]+rings[:1]):
            for j in range(16): terra.faces.new((a[j],a[(j+1)%16],b[(j+1)%16],b[j]))
        cylinder(soil,(center[0],center[1],center[2]+.168),(center[0],center[1],center[2]+.172),.113,16)
        for j in range(9):
            angle=j*2.39996+pot*.7
            start=Vector((center[0]+.035*math.cos(angle),center[1]+.035*math.sin(angle),center[2]+.172))
            tip=Vector((center[0]+.13*math.cos(angle),center[1]+.13*math.sin(angle),center[2]+.33+.035*math.sin(j*1.7)))
            leaf={"root":start,"tip":tip,"twist":.18*math.sin(j),"camber":.006,"width":.019}
            vertices=[foliage.verts.new(point)for point in nook_olive_leaf_points(leaf)]
            for indices in nook_olive_leaf_triangles(): foliage.faces.new([vertices[index]for index in indices])
    import bmesh
    bmesh.ops.recalc_face_normals(terra,faces=list(terra.faces))
    bmesh.ops.recalc_face_normals(foliage,faces=list(foliage.faces))
    objects = parts.finish()
    objects += build_window_detail(scene)
    for obj in objects:
        obj["breakfastNook"] = True
    return {"newObjects": [o.name for o in objects], "rawAddedTriangles": sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in objects),
            "upperLanding": upper_landing}


def apply_placement(config):
    """Guarded metadata delta: existing cooking and all unrelated rooms stay put."""
    plan = placement()
    room = next(room for room in config["rooms"] if room["id"] == "kitchen")
    if room.get("breakfastNook"):
        raise RuntimeError("Breakfast delta is already authored")
    if room["actor"] != [-3.95, -0.475, 5.26] or room["floor"] != 0:
        raise RuntimeError("Original breakfast/cooking placement changed")
    if config["interiorLights"]["pendant"] != [-3.92, 1.42, 4.5]:
        raise RuntimeError("Original breakfast pendant changed")
    old_anchors = [anchor for anchor in config["furniture"] if anchor["id"] == "nook-banquette"]
    if len(old_anchors) != 1:
        raise RuntimeError("Original L-banquette anchor inventory changed")
    if any(region.get("replaces") or region["id"] in ("study", "breakfast") for region in config.get("lightTransportRegions", [])):
        raise RuntimeError("Inherited Study sampler slot already owned")
    # This physical library cage already encloses the old Study in X/Z and its top.
    library = next(room for room in config["rooms"] if room["id"] == "library")
    bounds = library["lightRegion"]
    translation = config["retreat"]["workstationNativeTranslation"]
    setback = config["retreat"]["setbackMetres"]
    study_min = [-1.65 + translation[0], 2.55 + translation[2], 2.25 + setback - translation[1]]
    study_max = [1.30 + translation[0], 4.70 + translation[2], 4.55 + setback - translation[1]]
    if not all(bounds["min"][axis] <= study_min[axis] and bounds["max"][axis] >= study_max[axis] for axis in (0, 2)) or bounds["max"][1] < study_max[1]:
        raise RuntimeError("Former Study no longer fits the physical library cage")
    bounds["min"][1] = min(bounds["min"][1], study_min[1])
    room["actor"] = plan["actor"]
    room["target"] = [-6.42, 0.30, 4.15]
    room["camera"].update(radius=2.108, yaw=0.308, pitch=0.240)
    room["exitPath"] = plan["exitPath"]
    room["egress"] = plan["exitPath"][-1]
    contact = config["terrain"]["contacts"]["kitchen"]
    if contact["actor"] != [-3.95, -0.475, 5.26] or contact["egress"] != [-3.45, 0, 6.60]:
        raise RuntimeError("Original breakfast route contact changed")
    contact.update(actor=copy.deepcopy(plan["actor"]), egress=copy.deepcopy(room["egress"]),
                   exitPath=copy.deepcopy(plan["exitPath"]))
    coffee = config["equipment"]["coffee"]
    if coffee["seat"] != [-3.95, -0.475, 5.26]:
        raise RuntimeError("Original coffee seat changed")
    coffee["seat"] = copy.deepcopy(plan["actor"])
    coffee["approach"] = [copy.deepcopy(room["egress"]), [-3.35, 0, 6.77], copy.deepcopy(coffee["actor"])]
    grinder = [coffee["actor"][0] - 0.34, coffee["actor"][1], coffee["grinder"][2] - 0.20]
    coffee["walkPath"] = [copy.deepcopy(plan["actor"]), *copy.deepcopy(plan["exitPath"][:-1]),
                          [-3.35, 0, grinder[2]], grinder]
    room["breakfastNook"] = {**plan, "replacedStudy": {"min": study_min, "max": study_max}}
    room["practicalSource"] = plan["practicalSource"]
    config["furniture"] = [anchor for anchor in config["furniture"] if anchor["id"] != "nook-banquette"]
    config["wallArt"]["position"] = plan["picture"]
    config["wallArt"]["light"] = plan["pictureLight"]
    config["interiorLights"]["pendant"] = [-7.16, 0.82, 4.95]
    config["interiorLights"]["pendantRegion"] = {key: copy.deepcopy(LIGHT_REGION[key]) for key in ("min", "max")}
    config["terrain"]["supportSurfaces"] = [support for support in config["terrain"]["supportSurfaces"] if not support["id"].startswith("nook-")] + plan["supportSurfaces"]
    config.setdefault("lightTransportRegions", []).append(copy.deepcopy(LIGHT_REGION))
    return plan


def validate_replay_paths(repo, source, source_sha256, manifest, output):
    """Fail before output creation on an unbound source or unsafe destination."""
    from pathlib import Path
    import hashlib
    repo, source, manifest, output = (Path(value).resolve() for value in (repo, source, manifest, output))
    qa = repo / ".jekyll-cache" / "visual-qa"
    if not output.is_relative_to(qa) or output == qa or output.exists() or source.is_relative_to(output) or manifest.is_relative_to(output):
        raise ValueError("Output must be a new private QA directory outside all inputs")
    if not source.is_file() or not manifest.is_file() or hashlib.sha256(source.read_bytes()).hexdigest() != source_sha256:
        raise ValueError("Explicit source SHA/input custody mismatch")
    return repo, source, manifest, output


def build_window_detail(scene):
    """Thin attached glazing and a grounded low ledge, inside the measured alcove."""
    import bpy
    from coastal_office import Parts, box
    parts = Parts("core_breakfast_window")
    def piece(material, lo, hi):
        centre = [(lo[k]+hi[k])/2 for k in range(3)]
        size = [hi[k]-lo[k] for k in range(3)]
        box(parts.bm(bpy.data.materials[material]), native(centre), (size[0],size[2],size[1]), 0)
    for a,b in ((-7.60,-7.575),(-5.575,-5.55)):
        piece("brushed brass",[a,FLOOR,3.40],[b,1.34,3.425])
    for a,b in ((-.465,-.435),(1.105,1.13)):
        piece("brushed brass",[-7.60,a,3.40],[-5.55,b,3.425])
    piece("facade low-iron glass",[-7.575,FLOOR,3.408],[-5.575,1.34,3.416])
    piece("warm cut stone",[-7.70,FLOOR,3.47],[-6.67,-.57,3.82])
    objects = parts.finish()
    for obj in objects: obj["breakfastNook"] = True
    return objects


def restore_partial_zero_fans(target, source_mesh, source_matrix):
    """Restore only the two source-edge-bound clipped rational-zero native fans."""
    import bpy, bmesh, numpy as np
    from fractions import Fraction as F
    if target.name != 'core__golden coastal sandstone':
        raise RuntimeError('Two-chart fan repair used outside its exact owner')
    CLIP=(-5.900000095367432,-3.419999122619629,-.21499985456466675)
    def numeric_attributes(mesh):
        result={}
        for attr in mesh.attributes:
            if attr.name in ('position','material_index','.edge_verts','.corner_vert','.corner_edge'):
                continue
            props={}
            for prop in attr.data[0].bl_rna.properties if len(attr.data) else []:
                if prop.identifier=='rna_type' or prop.type not in ('INT','FLOAT','BOOLEAN'):
                    continue
                if attr.data_type in ('FLOAT_COLOR','BYTE_COLOR') and prop.identifier!=('color'if attr.data_type=='FLOAT_COLOR'else'color_srgb'):
                    continue
                width=prop.array_length if getattr(prop,'is_array',False)else 1
                dtype=np.float32 if prop.type=='FLOAT'else np.int32 if prop.type=='INT'else np.bool_
                values=np.empty(len(attr.data)*width,dtype=dtype)
                attr.data.foreach_get(prop.identifier,values)
                props[prop.identifier]=values.reshape((-1,width))
            if not props:raise RuntimeError('Unmapped native attribute '+attr.name+' '+attr.data_type)
            result[attr.name]={'domain':attr.domain,'type':attr.data_type,'props':props}
        return result

    def weighted(values, weights):
        out=[]
        for k in range(values.shape[1]):
            if values.dtype.kind in ('i','u','b'):
                selected={values[i,k].item()for i,w in weights if w}
                if len(selected)!=1:raise RuntimeError('Categorical source field differs across a new port')
                out.append(next(iter(selected)))
            else:
                out.append(float(sum(F(float(values[i,k]))*w for i,w in weights)))
        return np.asarray(out,dtype=values.dtype)
    obj=target;mesh=source_mesh
    original_matrix=np.asarray(source_matrix);original_attrs=numeric_attributes(mesh)
    original_N=np.asarray([tuple(v.vector)for v in mesh.corner_normals],dtype=np.float32)
    original_P=np.asarray([tuple(v.co)for v in mesh.vertices],dtype=np.float32)
    source={}
    for sid in (362,365):
        t=mesh.loop_triangles[sid-1];face=mesh.polygons[t.polygon_index]
        assert list(t.vertices)==list(face.vertices) and len(t.vertices)==3
        source[sid]={'face':face.index,'vertices':list(t.vertices),'loops':list(t.loops),
                     'edges':[mesh.loops[i].edge_index for i in t.loops],
                     'material':face.material_index,'smooth':face.use_smooth}
    assert source[362]['vertices']==[32518,32639,32513]
    assert source[365]['vertices']==[32518,32513,32639]
    assert source[362]['edges']==[63879,63783,165192]
    assert source[365]['edges']==[165193,63783,63879]
    world_P=[tuple(source_matrix@v.co)for v in mesh.vertices]
    A,B,C=[world_P[i]for i in source[362]['vertices']]
    assert all(p[1:]==CLIP[1:]for p in (A,B,C)) and A[0]<CLIP[0]<B[0]<C[0]
    ab=(F(CLIP[0])-F(A[0]))/(F(B[0])-F(A[0]));ac=(F(CLIP[0])-F(A[0]))/(F(C[0])-F(A[0]))
    assert ab==F(716368,862931) and ac==F(716368,1725861)
    zero_corner_weights={362:[[(source[362]['loops'][0],1-ab),(source[362]['loops'][1],ab)],[(source[362]['loops'][1],F(1))],[(source[362]['loops'][2],F(1))],[(source[362]['loops'][0],1-ac),(source[362]['loops'][2],ac)]],
                         365:[[(source[365]['loops'][0],1-ac),(source[365]['loops'][1],ac)],[(source[365]['loops'][1],F(1))],[(source[365]['loops'][2],F(1))],[(source[365]['loops'][0],1-ab),(source[365]['loops'][2],ab)]]}


    obj=target;mesh=target.data
    assert mesh.users==1 and mesh.shape_keys is None and np.array_equal(original_matrix,np.asarray(obj.matrix_world))
    old_attrs=numeric_attributes(mesh);old_N=np.asarray([tuple(v.vector)for v in mesh.corner_normals],dtype=np.float32)
    points=[tuple(v.co)for v in mesh.vertices];world=[tuple(obj.matrix_world@v.co)for v in mesh.vertices]
    ports=[i for i,p in enumerate(world)if p==CLIP];assert len(ports)==1
    p1=ports[0];cv=[i for i,p in enumerate(world)if p==C];assert len(cv)==1
    c=cv[0];assert not any(p==B for p in world)
    ids=mesh.attributes['Breakfast source triangle']
    assert not any(v.value in (362,365)for v in ids.data)
    face363=[f for f in mesh.polygons if ids.data[f.index].value==363 and p1 in f.vertices]
    face364=[f for f in mesh.polygons if ids.data[f.index].value==364 and p1 in f.vertices]
    caps=[f for f in mesh.polygons if ids.data[f.index].value==0 and p1 in f.vertices]
    assert len(face363)==len(face364)==len(caps)==1
    f363,f364,cap=face363[0],face364[0],caps[0]
    assert c in f363.vertices and c in f364.vertices
    faces=[list(f.vertices)for f in mesh.polygons]
    face_edges=[[mesh.loops[li].edge_index for li in f.loop_indices]for f in mesh.polygons]
    old_loops=[list(f.loop_indices)for f in mesh.polygons]
    edges=[tuple(e.vertices)for e in mesh.edges]
    old_counts={'POINT':len(points),'EDGE':len(edges),'FACE':len(faces),'CORNER':len(mesh.loops)}
    longs=[ei for f in (f363,f364)for ei in face_edges[f.index]if set(edges[ei])=={p1,c}]
    assert len(longs)==2 and longs[0]==longs[1];long1=longs[0]
    cap_i=faces[cap.index].index(p1);prev=faces[cap.index][cap_i-1];following=faces[cap.index][(cap_i+1)%len(faces[cap.index])]
    assert prev in f364.vertices and following in f363.vertices
    cap_up=face_edges[cap.index][(cap_i-1)%len(faces[cap.index])]
    assert set(edges[cap_up])=={prev,p1}
    cap_down=face_edges[cap.index][cap_i]
    assert set(edges[cap_down])=={p1,following}
    p2=len(points);ps=p2+1;b=p2+2
    points += [points[p1],points[p1],tuple(original_P[32639])]
    edges[cap_up]=tuple(p2 if i==p1 else i for i in edges[cap_up])
    long2=len(edges);edges.append((p2,c))
    short=len(edges);edges.append((ps,b))
    bc=len(edges);edges.append((b,c))
    cut2=len(edges);edges.append((p2,ps))
    cut1=len(edges);edges.append((ps,p1))
    faces[f364.index]=[p2 if i==p1 else i for i in faces[f364.index]]
    face_edges[f364.index]=[long2 if i==long1 else i for i in face_edges[f364.index]]
    face_corners=[list(row)for row in old_loops]
    faces[cap.index]=faces[cap.index][:cap_i]+[p2,ps,p1]+faces[cap.index][cap_i+1:]
    face_corners[cap.index]=old_loops[cap.index][:cap_i]+[old_loops[cap.index][cap_i]]*3+old_loops[cap.index][cap_i+1:]
    face_edges[cap.index]=face_edges[cap.index][:cap_i]+[cut2,cut1,cap_down]+face_edges[cap.index][cap_i+1:]
    new_face_ids={362:len(faces),365:len(faces)+1}
    faces += [[ps,b,c,p1],[p2,c,b,ps]]
    face_edges += [[short,bc,long1,cut1],[long2,bc,short,cut2]]
    face_corners += [[('source',362,i)for i in range(4)],[('source',365,i)for i in range(4)]]
    assert len(faces)==len(face_edges)==len(face_corners)
    for vs,es in zip(faces,face_edges):
     assert len(vs)==len(es)
     for i,ei in enumerate(es):assert set(edges[ei])=={vs[i],vs[(i+1)%len(vs)]},(vs,es,i,edges[ei])

    output=mesh.copy();output.clear_geometry()
    output.vertices.add(len(points));output.edges.add(len(edges));output.loops.add(sum(map(len,faces)));output.polygons.add(len(faces))
    output.vertices.foreach_set('co',np.asarray(points,dtype=np.float32).reshape(-1))
    output.edges.foreach_set('vertices',np.asarray(edges,dtype=np.int32).reshape(-1))
    output.loops.foreach_set('vertex_index',np.asarray([i for face in faces for i in face],dtype=np.int32))
    output.loops.foreach_set('edge_index',np.asarray([i for face in face_edges for i in face],dtype=np.int32))
    output.polygons.foreach_set('loop_start',np.cumsum([0]+[len(vs)for vs in faces[:-1]],dtype=np.int32))
    output.polygons.foreach_set('loop_total',np.asarray(list(map(len,faces)),dtype=np.int32))
    output.polygons.foreach_set('material_index',[f.material_index for f in mesh.polygons]+[source[362]['material'],source[365]['material']])
    output.polygons.foreach_set('use_smooth',[f.use_smooth for f in mesh.polygons]+[source[362]['smooth'],source[365]['smooth']])
    output.update(calc_edges=False)
    old_loop_map=[i for row in face_corners for i in row]
    source_edge_map=[165193,63879,63783,None,None]
    point_weights=[[(32518,1-ac),(32513,ac)],[(32518,1-ab),(32639,ab)],[(32639,F(1))]]
    checks={}
    for name,old in old_attrs.items():
        attr=output.attributes.get(name)or output.attributes.new(name,old['type'],old['domain'])
        assert(attr.data_type,attr.domain)==(old['type'],old['domain'])
        for prop,values in old['props'].items():
            if old['domain']=='CORNER':
                rows=[]
                for item in old_loop_map:
                    if isinstance(item,int):rows.append(values[item])
                    else:
                        _,sid,corner=item
                        if name=='custom_normal':original=original_N
                        else:
                            source_attr=original_attrs[name]
                            assert source_attr['domain']=='CORNER'and source_attr['type']==old['type']
                            original=source_attr['props'][prop]
                        rows.append(weighted(original,zero_corner_weights[sid][corner]))
                result=np.asarray(rows,dtype=values.dtype)
            elif old['domain']=='POINT':
                original=original_attrs.get(name,{}).get('props',{}).get(prop)
                if original is None and not name.startswith('Breakfast '):raise RuntimeError('Unknown new POINT ancestry field '+name)
                # Two born ports keep the existing born-port provenance sentinel0;
                # restored B receives its exact original native-point metadata.
                result=np.concatenate([values,np.asarray([values[p1],values[p1],original[32639]if original is not None else np.zeros(values.shape[1],dtype=values.dtype)])])
            elif old['domain']=='EDGE':
                original=original_attrs.get(name,{}).get('props',{}).get(prop)
                if original is None and not name.startswith('Breakfast '):raise RuntimeError('Unknown new EDGE ancestry field '+name)
                result=np.concatenate([values,np.asarray([original[i]if i is not None and original is not None else np.zeros(values.shape[1],dtype=values.dtype)for i in source_edge_map])])
            elif old['domain']=='FACE':
                if name=='Breakfast source triangle':new=np.asarray([[362],[365]],dtype=values.dtype)
                else:
                    original=original_attrs[name]['props'][prop];new=original[[source[362]['face'],source[365]['face']]]
                result=np.concatenate([values,new])
            else:raise RuntimeError('Unmapped native domain '+old['domain'])
            attr.data.foreach_set(prop,result.reshape(-1))
            checks[name+':'+prop]=int(values.size)
    output.update(calc_edges=False)
    obj.data=output
    old_f364_index=f364.index;old_cap_index=cap.index
    name=mesh.name;bpy.data.meshes.remove(mesh);output.name=name
    bm=bmesh.new();bm.from_mesh(output)
    bad=[e.index for e in bm.edges if not e.is_manifold or not e.is_contiguous]
    bm.free()
    if bad:raise RuntimeError('Exact restored native fan is not directedclosed: '+str(bad))
    assert len(output.vertices)==old_counts['POINT']+3 and len(output.edges)==old_counts['EDGE']+5
    output.calc_loop_triangles()
    roles={'Plong1':p1,'Plong2':p2,'Pshort':ps,'B':b,'C':c}
    proof={'scope':'PRIVATE exact directed source-fan insertion only; same physical tool and no positive-area source/cap geometry change. Independent full area/continuous1D/injectivefan/body gates still required.',
           'sourceMatrixExact':True,'originalSourceIds':[362,365],
           'source':source,'port':CLIP,'fractions':{'AB':str(ab),'AC':str(ac)},'roles':roles,'faces':new_face_ids,
           'changedExistingSourceFace':old_f364_index,'changedExistingCap':old_cap_index,'changedExistingBornCapEdge':cap_up,
           'originalLongEdgeIds':[165192,165193],'newParallelLongEdgeIds':[long1,long2],
           'newCounts':{'vertices':3,'edges':5,'polygons':2,'loops':10},'existingNumericFieldsCopied':checks,
           'insertedZeroCharts':[{'source':sid,'polygon':i,'vertices':list(output.polygons[i].vertices),'edges':[output.loops[li].edge_index for li in output.polygons[i].loop_indices],
                                 'nativeP':[tuple(obj.matrix_world@output.vertices[v].co)for v in output.polygons[i].vertices],
                                 'N':[tuple(output.corner_normals[li].vector)for li in output.polygons[i].loop_indices]}for sid,i in new_face_ids.items()],
           'directedBadEdges':bad}

    return proof
