"""One source-bound pavilion chair back; no room, seat or other chair rebuild."""

from __future__ import annotations

from array import array
import hashlib
import json
import math

from coastal_pavilion_breakfast import _mesh_digest, native, topology

VERSION = 3
OWNER = "core_estate_pavilion__pale oak"
NAMES = tuple(f"core_estate_pavilion_breakfast_lumbar_{side}__pale oak" for side in ("west", "east"))
POST_NAME = "core_estate_pavilion_breakfast_lumbar_post_west__honey ash"
POST_OWNER = "core_estate_pavilion__honey ash"
POST_SHA256 = "a8e507f00417110816b9c253b8894cbebffc6d2c7ab68bb872d72250f8f96f4c"
PANEL_SHA256 = "d93857749d4273d9208e0ea083be6fb37250455ac06c3721a714123704c78ee7"
FORMATS = {"FLOAT": ("value", 1, "f"), "INT": ("value", 1, "i"), "BOOLEAN": ("value", 1, "b"),
           "FLOAT_VECTOR": ("vector", 3, "f"), "FLOAT2": ("vector", 2, "f"),
           "FLOAT_COLOR": ("color", 4, "f"), "BYTE_COLOR": ("color", 4, "f"),
           "INT8": ("value", 1, "i"), "INT16_2D": ("value", 2, "i"),
           "INT32_2D": ("value", 2, "i"), "QUATERNION": ("value", 4, "f")}
GEOMETRY_FIELDS = {"position", ".position", ".edge_verts", ".corner_vert", ".corner_edge"}


def values(attribute, ids):
    field, width, code = FORMATS[attribute.data_type]
    data = array(code, [0]) * (len(attribute.data) * width)
    attribute.data.foreach_get(field, data)
    return array(code, (data[i * width + k] for i in ids for k in range(width)))


def selected_panel(obj):
    mesh = obj.data
    adjacent = [set() for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        adjacent[a].add(b)
        adjacent[b].add(a)
    seen, candidates = set(), []
    for start in range(len(mesh.vertices)):
        if start in seen:
            continue
        todo, ids = [start], set()
        seen.add(start)
        while todo:
            vertex = todo.pop()
            ids.add(vertex)
            for other in adjacent[vertex]:
                if other not in seen:
                    seen.add(other)
                    todo.append(other)
        points = [obj.matrix_world @ mesh.vertices[i].co for i in ids]
        world = [(p.x, p.z, -p.y) for p in points]
        low = [min(p[k] for p in world) for k in range(3)]
        high = [max(p[k] for p in world) for k in range(3)]
        if (abs(low[0] - 6.345) < 0.002 and abs(high[0] - 6.855) < 0.002
                and 0.63 < low[1] < 0.66 and 0.88 < high[1] < 0.91 and -0.98 < low[2] < -0.96):
            candidates.append((ids, [low, high]))
    if len(candidates) != 1:
        raise RuntimeError("Expected one exact disjoint original lumbar panel")
    ids, bounds = candidates[0]
    faces = [p.index for p in mesh.polygons if all(i in ids for i in p.vertices)]
    loops = [i for face in faces for i in mesh.polygons[face].loop_indices]
    edges = [e.index for e in mesh.edges if all(i in ids for i in e.vertices)]
    if len(ids) != 96 or len(faces) != 98 or sum(mesh.polygons[i].loop_total - 2 for i in faces) != 188:
        raise RuntimeError("Original panel topology changed")
    return {"POINT": sorted(ids), "EDGE": edges, "FACE": faces, "CORNER": loops}, bounds


def selection_fingerprint(obj, selected, bounds):
    mesh = obj.data
    digest = hashlib.sha256()
    record = {"owner": obj.name, "matrix": [list(row) for row in obj.matrix_world], "bounds": bounds,
              "selection": selected, "materials": [m.name if m else None for m in mesh.materials]}
    digest.update(json.dumps(record, sort_keys=True, separators=(",", ":")).encode())
    digest.update(array("f", (v for i in selected["POINT"] for v in mesh.vertices[i].co)).tobytes())
    digest.update(array("f", (v for i in selected["CORNER"] for v in mesh.corner_normals[i].vector)).tobytes())
    attributes = []
    for attribute in mesh.attributes:
        if attribute.data_type not in FORMATS or attribute.domain not in selected:
            raise RuntimeError(f"Unknown source field {attribute.name}")
        data = values(attribute, selected[attribute.domain])
        metadata = [attribute.name, attribute.domain, attribute.data_type]
        digest.update(json.dumps(metadata).encode() + data.tobytes())
        attributes.append({"name": attribute.name, "domain": attribute.domain, "type": attribute.data_type,
                           "sha256": hashlib.sha256(data).hexdigest()})
    return digest.hexdigest(), {**record, "attributes": attributes}


def parts():
    """Two closed rounded timber lobes; the central channel stays open above."""
    result = []
    for name, (x0, x1) in zip(NAMES, ((6.345, 6.44), (6.75, 6.855))):
        count = 8
        points = []
        for z, inset in ((-0.975, 0.004), (-0.94, 0), (-0.905, 0.004)):
            left, right, bottom, top, radius = x0 + inset, x1 - inset, 0.645 + inset, 0.895 - inset, 0.008 - inset
            outline = ((left + radius, bottom), (right - radius, bottom), (right, bottom + radius),
                       (right, top - radius), (right - radius, top), (left + radius, top),
                       (left, top - radius), (left, bottom + radius))
            points.extend(native((x, y, z)) for x, y in outline)
        triangles = []
        for ring in range(2):
            for i in range(count):
                j = (i + 1) % count
                a, b, c, d = ring * count + i, ring * count + j, (ring + 1) * count + j, (ring + 1) * count + i
                triangles.extend(((a, b, c), (a, c, d)))
        triangles.extend((0, i + 1, i) for i in range(1, count - 1))
        triangles.extend((2 * count, 2 * count + i, 2 * count + i + 1) for i in range(1, count - 1))
        part = {"name": name, "points": points, "triangles": triangles, "material": "pale oak"}
        if topology(part)["signedVolume"] < 0:
            part["triangles"] = [tuple(reversed(face)) for face in triangles]
        proof = topology(part)
        if proof["badDirectedEdges"] or proof["signedVolume"] <= 0 or proof["minimumDoubleArea"] <= 0:
            raise RuntimeError("Lumbar lobe is not positive directed closed")
        result.append(part)
    return result


def panel_fingerprint(obj):
    return selection_fingerprint(obj, *selected_panel(obj))


def upper_post(obj):
    mesh = obj.data
    adjacent = [set() for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        adjacent[a].add(b)
        adjacent[b].add(a)
    seen, matches = set(), []
    for start in range(len(mesh.vertices)):
        if start in seen:
            continue
        todo, ids = [start], set()
        seen.add(start)
        while todo:
            i = todo.pop()
            ids.add(i)
            for other in adjacent[i]:
                if other not in seen:
                    seen.add(other)
                    todo.append(other)
        points = [obj.matrix_world @ mesh.vertices[i].co for i in ids]
        world = [(p.x, p.z, -p.y) for p in points]
        low = [min(p[k] for p in world) for k in range(3)]
        high = [max(p[k] for p in world) for k in range(3)]
        if (abs(low[0] - 6.799077) < 0.00001 and abs(high[0] - 6.840923) < 0.00001
                and abs(low[1] - 0.437459) < 0.00001 and abs(high[1] - 0.872541) < 0.00001
                and abs(low[2] + 1.001852) < 0.00001 and abs(high[2] + 0.908148) < 0.00001):
            matches.append((ids, [low, high]))
    if len(matches) != 1:
        raise RuntimeError("Expected exact east upper-post donor")
    ids, bounds = matches[0]
    faces = [p.index for p in mesh.polygons if all(i in ids for i in p.vertices)]
    loops = [i for face in faces for i in mesh.polygons[face].loop_indices]
    edges = [e.index for e in mesh.edges if all(i in ids for i in e.vertices)]
    if len(ids) != 20 or sum(mesh.polygons[i].loop_total - 2 for i in faces) != 36:
        raise RuntimeError("Donor post topology changed")
    return {"POINT": sorted(ids), "EDGE": edges, "FACE": faces, "CORNER": loops}, bounds


def _subset_mesh(old, keep):
    vertex_map = {old_id: new_id for new_id, old_id in enumerate(keep["POINT"])}
    edge_map = {old_id: new_id for new_id, old_id in enumerate(keep["EDGE"])}
    new = old.copy()
    new.clear_geometry()
    new.from_pydata([old.vertices[i].co[:] for i in keep["POINT"]],
                    [tuple(vertex_map[v] for v in old.edges[i].vertices) for i in keep["EDGE"]],
                    [tuple(vertex_map[v] for v in old.polygons[i].vertices) for i in keep["FACE"]])
    if len(new.edges) != len(keep["EDGE"]) or len(new.loops) != len(keep["CORNER"]):
        raise RuntimeError("from_pydata changed retained edge/corner roster")
    # from_pydata's edge lookup can select a different parallel native edge.
    # Restore the exact source occurrence tables; no coordinate seam welding.
    new.attributes[".edge_verts"].data.foreach_set("value", array("i", (vertex_map[v] for i in keep["EDGE"] for v in old.edges[i].vertices)))
    new.attributes[".corner_edge"].data.foreach_set("value", array("i", (edge_map[old.loops[i].edge_index] for i in keep["CORNER"])))
    new.materials.clear()
    for material in old.materials:
        new.materials.append(material)
    for new_id, old_id in enumerate(keep["FACE"]):
        new.polygons[new_id].material_index = old.polygons[old_id].material_index
        new.polygons[new_id].use_smooth = old.polygons[old_id].use_smooth
    for attribute in old.attributes:
        if attribute.name in GEOMETRY_FIELDS:
            continue
        target = new.attributes.get(attribute.name) or new.attributes.new(attribute.name, attribute.data_type, attribute.domain)
        target.data.foreach_set(FORMATS[attribute.data_type][0], values(attribute, keep[attribute.domain]))
    new.color_attributes.active_color_name = old.color_attributes.active_color_name
    if old.color_attributes.render_color_index >= 0:
        new.color_attributes.render_color_index = old.color_attributes.render_color_index
    new.update()
    # Topology/index remapping is explicit. All retained numeric field values
    # and effective split normals are compared, including packed custom normals.
    for new_id, old_id in enumerate(keep["POINT"]):
        if tuple(new.vertices[new_id].co) != tuple(old.vertices[old_id].co):
            raise RuntimeError("Retained point changed")
    for new_id, old_id in enumerate(keep["CORNER"]):
        if (new.loops[new_id].vertex_index != vertex_map[old.loops[old_id].vertex_index]
                or new.loops[new_id].edge_index != edge_map[old.loops[old_id].edge_index]
                or tuple(new.corner_normals[new_id].vector) != tuple(old.corner_normals[old_id].vector)):
            raise RuntimeError(f"Retained corner/normal changed: {old_id}; V={new.loops[new_id].vertex_index}/{vertex_map[old.loops[old_id].vertex_index]} E={new.loops[new_id].edge_index}/{edge_map[old.loops[old_id].edge_index]} N={tuple(new.corner_normals[new_id].vector)}/{tuple(old.corner_normals[old_id].vector)}")
    fields = []
    for attribute in old.attributes:
        if attribute.name in GEOMETRY_FIELDS:
            continue
        target = new.attributes.get(attribute.name)
        before = values(attribute, keep[attribute.domain])
        after = values(target, range(len(target.data))) if target else None
        if after != before:
            raise RuntimeError(f"Retained field changed: {attribute.name}")
        fields.append({"name": attribute.name, "domain": attribute.domain, "type": attribute.data_type,
                       "sha256": hashlib.sha256(before).hexdigest()})
    return new, fields


def _retire_panel(obj):
    old = obj.data
    removed, bounds = selected_panel(obj)
    keep = {domain: [i for i in range(len(collection)) if i not in set(removed[domain])]
            for domain, collection in (("POINT", old.vertices), ("EDGE", old.edges), ("FACE", old.polygons), ("CORNER", old.loops))}
    new, fields = _subset_mesh(old, keep)
    obj.data = new
    return {"retired": removed, "bounds": bounds, "retainedIds": keep, "retainedFields": fields,
            "retainedSplitNormalsExact": len(keep["CORNER"]), "retiredTriangles": 188}



def build(scene):
    import bpy
    bpy.context.view_layer.update()
    if any(bpy.data.objects.get(name) for name in (*NAMES, POST_NAME)):
        raise RuntimeError("Lumbar design already present")
    owner = bpy.data.objects.get(OWNER)
    if owner is None or owner.type != "MESH" or owner.data.users != 1:
        raise RuntimeError("Expected an unshared exact pavilion mesh")
    fingerprint, panel = panel_fingerprint(owner)
    if fingerprint != PANEL_SHA256:
        raise RuntimeError(f"Original panel guard differs: {fingerprint}")
    donor = bpy.data.objects.get(POST_OWNER)
    if donor is None or donor.type != "MESH":
        raise RuntimeError("Original donor owner missing")
    selected, donor_bounds = upper_post(donor)
    donor_sha, donor_record = selection_fingerprint(donor, selected, donor_bounds)
    if donor_sha != POST_SHA256:
        raise RuntimeError(f"Donor post guard differs: {donor_sha}")
    originals = {obj.name: _mesh_digest(obj) for obj in scene.objects if obj.type == "MESH" and obj != owner}
    material = next((m for m in owner.data.materials if m and m.name == "pale oak"), None)
    if not material:
        raise RuntimeError("Existing pale oak material missing")
    retired = _retire_panel(owner)
    for part in parts():
        mesh = bpy.data.meshes.new(part["name"])
        mesh.from_pydata(part["points"], [], part["triangles"])
        mesh.materials.append(material)
        color = mesh.color_attributes.new(name="COLOR_0", type="FLOAT_COLOR", domain="CORNER")
        for item in color.data:
            item.color = (1, 1, 1, 1)
        for face in mesh.polygons:
            face.use_smooth = face.index < 32
        obj = bpy.data.objects.new(part["name"], mesh)
        obj["component"] = "pavilion-breakfast-lumbar-v3"
        obj["role"] = "breakfast-back-support"
        scene.collection.objects.link(obj)
        mesh.update()
    post_mesh, post_fields = _subset_mesh(donor.data, selected)
    post_mesh.name = POST_NAME
    post = bpy.data.objects.new(POST_NAME, post_mesh)
    post.matrix_world = donor.matrix_world.copy()
    post.matrix_world.translation.x -= 0.44
    post["component"] = "pavilion-breakfast-lumbar-v3"
    post["role"] = "breakfast-back-support"
    scene.collection.objects.link(post)
    bpy.context.view_layer.update()
    changed = [name for name, digest in originals.items() if _mesh_digest(bpy.data.objects[name]) != digest]
    if changed:
        raise RuntimeError(f"Unowned meshes changed: {changed}")
    return {"version": VERSION, "panel": panel, "panelSHA256": fingerprint, "retirement": retired,
            "created": [*NAMES, POST_NAME], "donor": donor_record, "donorSHA256": donor_sha, "postFieldsExact": post_fields,
            "postWorldTranslation": [-0.44, 0, 0], "newTriangles": 124, "netTriangles": -64, "oldMeshesExact": originals,
            "channelWorldX": [6.44, 6.75], "openTop": True,
            "scope": "Private one-chair design. Metal-post bearings, decoded field/skin/entry/meal contacts, AO and actual appearance remain admission gates."}
