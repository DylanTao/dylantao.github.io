"""Source-guarded west-side island reduction; no room or activity rebuild.

The living-side edge stays fixed. The board, bowl and four lemons move rigidly
with the new centre. The coordinator owns AO, export, cache and admission.
"""

from __future__ import annotations

import hashlib
import json

VERSION = 1
REDUCTION = 0.15
PROP_SHIFT = REDUCTION / 2
CENTRE_X = -2.45
SOURCE_SHA256 = "1e10b25d5cf0eec87d7001acbf9d938d65ba33af6076380d5a8e5d45cf3d23e7"
EXPECTED = {
    "kitchen__honed travertine": (3, 564, "8adf4f21341344d878fe25570969b69e2249bf9cff26fc8d48c388197bc2df85"),
    "kitchen__honey ash": (2, 376, "64f8cc4fb7e92d256f3b74e9974683647e082c088cb361e274ac30d52732032a"),
    "kitchen__meyer lemon": (4, 1152, "41b101fa9b0fd1af6bab4ec6ab4e194149019e4c33dedcb16475255b6ce0154c"),
    "kitchen__oatmeal glaze": (1, 556, "1f8205f8c86502ef5fb847ab74464b53fe1eb479d96b66ba6008c268852a69d5"),
    "kitchen__pale oak": (73, 13724, "56b474683c3a05fbf810a93d73eac1344480934003c1ab3d54cfb4402b50f373"),
}
PROP_NAMES = {
    "kitchen__honey ash": "kitchen_island_chopping_board__honey ash",
    "kitchen__oatmeal glaze": "kitchen_island_fruit_bowl__oatmeal glaze",
}


def owned_bounds(low, high):
    """Original source domain, independent of the new default kitchen builder."""
    return (low[0] > -3.1 and high[0] < -1.8 and low[1] >= -0.001
            and high[1] < 1.2 and low[2] > 5.9 and high[2] < 8.6)


def displacement(owner, low, high, point):
    if owner in ("kitchen__meyer lemon", "kitchen__oatmeal glaze") or owner == "kitchen__honey ash" and low[1] > 0.97:
        return PROP_SHIFT
    if high[0] - low[0] < 0.1:
        return REDUCTION if (low[0] + high[0]) / 2 < CENTRE_X else 0.0
    return REDUCTION if point[0] < CENTRE_X else 0.0


def components(obj):
    mesh = obj.data
    adjacent = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        adjacent[a].append(b)
        adjacent[b].append(a)
    seen, rows = set(), []
    for first in range(len(mesh.vertices)):
        if first in seen:
            continue
        stack, ids = [first], []
        seen.add(first)
        while stack:
            i = stack.pop()
            ids.append(i)
            for j in adjacent[i]:
                if j not in seen:
                    seen.add(j)
                    stack.append(j)
        native = [obj.matrix_world @ mesh.vertices[i].co for i in ids]
        points = [(p.x, p.z, -p.y) for p in native]
        low = [min(p[k] for p in points) for k in range(3)]
        high = [max(p[k] for p in points) for k in range(3)]
        rows.append({"id": len(rows), "vertices": sorted(ids), "bounds": [low, high]})
    return rows


def selection(mesh, ids):
    points = set(ids)
    faces = [p.index for p in mesh.polygons if all(i in points for i in p.vertices)]
    return {"POINT": sorted(points), "EDGE": [e.index for e in mesh.edges if all(i in points for i in e.vertices)],
            "FACE": faces, "CORNER": [i for face in faces for i in mesh.polygons[face].loop_indices]}


def _outside(mesh, inside):
    selected = {domain: set(ids) for domain, ids in inside.items()}
    return {domain: [i for i in range(len(collection)) if i not in selected[domain]]
            for domain, collection in (("POINT", mesh.vertices), ("EDGE", mesh.edges),
                                       ("FACE", mesh.polygons), ("CORNER", mesh.loops))}


def _local_data_digest(mesh, custody):
    """No temporary object/matrix assignment, including for the rigid lemons."""
    from array import array
    digest = hashlib.sha256()
    digest.update(json.dumps([dict(mesh.items()), mesh.color_attributes.active_color_name,
                              mesh.color_attributes.render_color_index,
                              [m.name if m else None for m in mesh.materials]],
                             sort_keys=True, default=str).encode())
    digest.update(array("f", (v for n in mesh.corner_normals for v in n.vector)).tobytes())
    for attribute in mesh.attributes:
        digest.update(json.dumps([attribute.name, attribute.domain, attribute.data_type]).encode())
        digest.update(custody.values(attribute, range(len(attribute.data))).tobytes())
    return digest.hexdigest()


def _guard(obj, rows, custody):
    chosen = [r for r in rows if owned_bounds(*r["bounds"])]
    ids = [i for r in chosen for i in r["vertices"]]
    selected = selection(obj.data, ids)
    bounds = [[min(r["bounds"][0][k] for r in chosen) for k in range(3)],
              [max(r["bounds"][1][k] for r in chosen) for k in range(3)]]
    digest, record = custody.selection_fingerprint(obj, selected, bounds)
    count, triangles, expected = EXPECTED[obj.name]
    actual_triangles = sum(obj.data.polygons[i].loop_total - 2 for i in selected["FACE"])
    if len(chosen) != count or actual_triangles != triangles or digest != expected:
        raise RuntimeError(f"Original island guard differs for {obj.name}: {len(chosen)}/{actual_triangles}/{digest}")
    return chosen, selected, {"sha256": digest, "record": record, "parts": chosen, "triangles": triangles}


def _split_prop(scene, obj, component, custody):
    import bpy
    old = obj.data
    selected = selection(old, component["vertices"])
    keep = _outside(old, selected)
    prop_mesh, prop_fields = custody._subset_mesh(old, selected)
    retained_mesh, retained_fields = custody._subset_mesh(old, keep)
    name = PROP_NAMES[obj.name]
    prop_mesh.name = name
    prop = bpy.data.objects.new(name, prop_mesh)
    # Keep all authored role/light/export metadata, then declare this exact part.
    for key, value in obj.items():
        prop[key] = value
    prop["component"] = "kitchen-island-west-reduction-v1"
    prop["role"] = "kitchen-island-prop"
    prop.matrix_world = obj.matrix_world.copy()
    prop.matrix_world.translation.x += PROP_SHIFT
    scene.collection.objects.link(prop)
    obj.data = retained_mesh
    return {"created": name, "worldTranslation": [PROP_SHIFT, 0, 0], "source": obj.name,
            "sourceSelection": selected, "retainedMapping": keep, "propFieldsExact": prop_fields,
            "retainedFieldsExact": retained_fields}


def build(scene):
    import bpy
    import coastal_pavilion_chair as custody
    from coastal_pavilion_breakfast import _mesh_digest
    bpy.context.view_layer.update()
    if any(bpy.data.objects.get(name) for name in PROP_NAMES.values()):
        raise RuntimeError("Island reduction already present; never replay twice")
    owners = {name: bpy.data.objects.get(name) for name in EXPECTED}
    if any(o is None or o.type != "MESH" or o.data.users != 1 for o in owners.values()):
        raise RuntimeError("Expected exact unshared island material owners")
    # Validate every original component before making even one change.
    planned = {name: _guard(obj, components(obj), custody) for name, obj in owners.items()}
    originals = {obj.name: _mesh_digest(obj) for obj in scene.objects if obj.type == "MESH" and obj.name not in EXPECTED}
    original_materials = {m.name: m.as_pointer() for m in bpy.data.materials}
    properties = {name: (dict(o.items()), dict(o.data.items()), [m.name if m else None for m in o.data.materials]) for name, o in owners.items()}
    split = []
    for name in PROP_NAMES:
        obj = owners[name]
        chosen = [r for r in planned[name][0] if name == "kitchen__oatmeal glaze" or r["bounds"][0][1] > 0.97]
        if len(chosen) != 1:
            raise RuntimeError("Expected one whole source prop")
        split.append(_split_prop(scene, obj, chosen[0], custody))
    lemon = owners["kitchen__meyer lemon"]
    selected = planned[lemon.name][1]
    if len(selected["POINT"]) != len(lemon.data.vertices) or len(selected["FACE"]) != len(lemon.data.polygons):
        raise RuntimeError("Lemon batch unexpectedly contains unowned fields")
    lemon_before = _local_data_digest(lemon.data, custody)
    lemon.matrix_world.translation.x += PROP_SHIFT
    changes, outside, bake_corners = [], {}, {}
    for name in ("kitchen__pale oak", "kitchen__honed travertine", "kitchen__honey ash"):
        obj = owners[name]
        rows = [r for r in components(obj) if owned_bounds(*r["bounds"])
                and any(displacement(name, *r["bounds"],
                                     ((obj.matrix_world @ obj.data.vertices[i].co).x, 0, 0))
                        for i in r["vertices"])]
        selected = selection(obj.data, [i for r in rows for i in r["vertices"]])
        unowned = _outside(obj.data, selected)
        prior, prior_record = custody.selection_fingerprint(obj, unowned, [])
        inverse = obj.matrix_world.inverted()
        for row in rows:
            for i in row["vertices"]:
                vertex = obj.data.vertices[i]
                point = obj.matrix_world @ vertex.co
                amount = displacement(name, *row["bounds"], (point.x, point.z, -point.y))
                if amount:
                    old = list(vertex.co)
                    point.x += amount
                    vertex.co = inverse @ point
                    changes.append({"owner": name, "vertex": i, "before": old, "after": list(vertex.co), "worldDeltaX": amount})
        obj.data.update()
        after, _ = custody.selection_fingerprint(obj, unowned, [])
        if prior != after:
            raise RuntimeError(f"Width edit changed unowned fields: {name}")
        outside[name] = {"sha256": after, "selection": unowned, "record": prior_record}
        bake_corners[name] = selected["CORNER"]
    bpy.context.view_layer.update()
    changed = [name for name, digest in originals.items() if _mesh_digest(bpy.data.objects[name]) != digest]
    if changed or original_materials != {m.name: m.as_pointer() for m in bpy.data.materials}:
        raise RuntimeError(f"Unowned scene/material roster changed: {changed}")
    for name, obj in owners.items():
        if properties[name] != (dict(obj.items()), dict(obj.data.items()), [m.name if m else None for m in obj.data.materials]):
            raise RuntimeError(f"Original role/material/custom properties changed: {name}")
    # Matrix-only lemon movement leaves every local mesh field untouched.
    if _local_data_digest(lemon.data, custody) != lemon_before:
        raise RuntimeError("Lemon local data changed")
    for name in (*PROP_NAMES.values(), lemon.name):
        bake_corners[name] = list(range(len(bpy.data.objects[name].data.loops)))
    expected_saved = {obj.name: _mesh_digest(obj) for obj in scene.objects if obj.type == "MESH"}
    return {"version": VERSION, "originalGuards": {name: item[2] for name, item in planned.items()},
            "unownedMeshesExact": originals, "outsideOwnerFieldsExact": outside, "propSplits": split,
            "lemonWorldTranslation": [PROP_SHIFT, 0, 0], "changedVertices": changes, "netTriangles": 0,
            "newNodes": list(PROP_NAMES.values()), "expectedAdditionalDraws": 2,
            "ownedBakeCorners": bake_corners,
            "nominalTop": {"widthBefore": 1.17, "widthAfter": 1.02, "length": 2.51},
            "expectedSavedMeshDigests": expected_saved,
            "scope": "Private native geometry only; canonical manifest untouched. No AO/export/cache, current all-body/cup/Walk or renderer admission follows from construction."}
