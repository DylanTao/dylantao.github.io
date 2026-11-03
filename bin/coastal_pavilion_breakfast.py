"""Bounded, additive pavilion foot support; all coordinates are world metres.

The two pads straddle the existing table leg. The opening is intentional; a
rectangular stool here would intersect that leg. The coordinator owns native
composition, AO, export, the complete-scene budget and rendered admission.
"""

from __future__ import annotations

import hashlib
import json
import math
import struct

VERSION = 2
FLOOR = 0.001
TOP = 0.236
BOTTOM = 0.206
PLAN = (
    (6.10, -1.49), (6.84, -1.49), (6.84, -1.90), (6.60, -1.90),
    (6.60, -1.74), (6.34, -1.74), (6.34, -1.90), (6.10, -1.90),
)
SUPPORTS = ((6.12, 6.18, -1.87, -1.52), (6.76, 6.82, -1.87, -1.52))
NAMES = tuple(f"core_estate_pavilion_breakfast_footrest_{part}__pale oak" for part in ("top", "west", "east")) + ("core_estate_pavilion_breakfast_seatpad__linen",)
MATERIAL_OWNER = "core_estate_pavilion__pale oak"
PAD_OWNER = "core_estate_pavilion__linen"
PAD_TOP = 0.575
PAD_BOTTOM = 0.533
PAD_PLAN = ((6.415, -1.00), (6.785, -1.00), (6.81, -1.025), (6.81, -1.375),
            (6.785, -1.40), (6.415, -1.40), (6.39, -1.375), (6.39, -1.025))


def native(point):
    x, y, z = point
    return (x, -z, y)


def _cross(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _inside_triangle(p, a, b, c):
    return max(_cross(a, b, p), _cross(b, c, p), _cross(c, a, p)) <= 1e-12


def triangulate_clockwise(plan):
    """Ear-clip this exact simple clockwise plan without filling its U opening."""
    area2 = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(plan, plan[1:] + plan[:1]))
    if len(plan) < 3 or area2 >= 0:
        raise ValueError("Expected a clockwise nondegenerate plan")
    remaining, triangles = list(range(len(plan))), []
    while len(remaining) > 3:
        for at, middle in enumerate(remaining):
            before, after = remaining[at - 1], remaining[(at + 1) % len(remaining)]
            if _cross(plan[before], plan[middle], plan[after]) >= -1e-12:
                continue
            if any(_inside_triangle(plan[i], plan[before], plan[middle], plan[after])
                   for i in remaining if i not in (before, middle, after)):
                continue
            triangles.append((before, middle, after))
            remaining.pop(at)
            break
        else:
            raise ValueError("No valid ear; do not silently fill an invalid plan")
    triangles.append(tuple(remaining))
    return triangles


def extrusion(plan, bottom, top):
    if not (math.isfinite(bottom) and math.isfinite(top) and bottom < top):
        raise ValueError("Invalid extrusion heights")
    count = len(plan)
    points = [native((x, y, z)) for y in (bottom, top) for x, z in plan]
    caps = triangulate_clockwise(plan)
    faces = [(c, b, a) for a, b, c in caps] + [tuple(i + count for i in face) for face in caps]
    for a in range(count):
        b = (a + 1) % count
        faces.extend(((a, b, b + count), (a, b + count, a + count)))
    return {"points": points, "triangles": faces}


def topology(part):
    points, faces = part["points"], part["triangles"]
    edges, volume6, minimum_area2 = {}, 0.0, math.inf
    for a, b, c in faces:
        p, q, r = (points[i] for i in (a, b, c))
        u, v = [q[k] - p[k] for k in range(3)], [r[k] - p[k] for k in range(3)]
        cross = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
        minimum_area2 = min(minimum_area2, math.hypot(*cross))
        volume6 += sum(p[k] * (q[(k + 1) % 3] * r[(k + 2) % 3] - q[(k + 2) % 3] * r[(k + 1) % 3]) for k in range(3))
        for start, end in ((a, b), (b, c), (c, a)):
            edges.setdefault(tuple(sorted((start, end))), []).append((start, end))
    bad = [key for key, uses in edges.items() if len(uses) != 2 or uses[0] != tuple(reversed(uses[1]))]
    return {"triangles": len(faces), "vertices": len(points), "badDirectedEdges": len(bad),
            "minimumDoubleArea": minimum_area2, "signedVolume": volume6 / 6}


def parts():
    result = [extrusion(PLAN, BOTTOM, TOP)]
    for xmin, xmax, zmin, zmax in SUPPORTS:
        plan = ((xmin, zmax), (xmax, zmax), (xmax, zmin), (xmin, zmin))
        result.append(extrusion(plan, FLOOR - 0.004, BOTTOM + 0.006))
    result.append(extrusion(PAD_PLAN, PAD_BOTTOM, PAD_TOP))
    for name, part in zip(NAMES, result):
        part.update(name=name, topology=topology(part), material="linen" if name == NAMES[-1] else "pale oak")
        if part["topology"]["badDirectedEdges"] or part["topology"]["minimumDoubleArea"] <= 0 or part["topology"]["signedVolume"] <= 0:
            raise RuntimeError("Footrest construction is not positive and directed closed")
    if sum(len(part["triangles"]) for part in result) != 80:
        raise RuntimeError("The exact additive lease is 52 footrest +28 seatpad triangles")
    return result


def _mesh_digest(obj):
    """Read-only custody of old mesh fields; no temporary matrix assignments."""
    from array import array
    digest = hashlib.sha256()
    mesh = obj.data
    metadata = {"object": obj.name, "mesh": mesh.name, "matrix": [list(row) for row in obj.matrix_world],
                "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
                "objectProperties": dict(obj.items()), "meshProperties": dict(mesh.items()),
                "activeColor": mesh.color_attributes.active_color_name, "renderColor": mesh.color_attributes.render_color_index}
    digest.update(json.dumps(metadata, sort_keys=True, default=str, separators=(",", ":")).encode())
    def field(collection, name, width, code):
        values = array(code, [0]) * (len(collection) * width)
        collection.foreach_get(name, values)
        digest.update(name.encode() + struct.pack("<II", len(collection), width) + values.tobytes())
    field(mesh.vertices, "co", 3, "f")
    field(mesh.edges, "vertices", 2, "i")
    for name in ("vertex_index", "edge_index"):
        field(mesh.loops, name, 1, "i")
    for name in ("loop_start", "loop_total", "material_index"):
        field(mesh.polygons, name, 1, "i")
    field(mesh.polygons, "use_smooth", 1, "b")
    field(mesh.corner_normals, "vector", 3, "f")
    formats = {"FLOAT": ("value", 1, "f"), "INT": ("value", 1, "i"), "BOOLEAN": ("value", 1, "b"),
               "FLOAT_VECTOR": ("vector", 3, "f"), "FLOAT2": ("vector", 2, "f"),
               "FLOAT_COLOR": ("color", 4, "f"), "BYTE_COLOR": ("color", 4, "f"),
               "INT8": ("value", 1, "i"), "INT16_2D": ("value", 2, "i"),
               "INT32_2D": ("value", 2, "i"), "QUATERNION": ("value", 4, "f")}
    for attribute in mesh.attributes:
        if attribute.data_type not in formats:
            raise RuntimeError(f"Unrecognized old field {attribute.name}: {attribute.data_type}")
        digest.update(json.dumps([attribute.name, attribute.domain, attribute.data_type]).encode())
        field(attribute.data, *formats[attribute.data_type])
    return digest.hexdigest()


def build(scene):
    import bpy
    bpy.context.view_layer.update()
    if any(bpy.data.objects.get(name) for name in NAMES):
        raise RuntimeError("Footrest already present; additive replay must run once")
    materials = {}
    for label, owner_name in (("pale oak", MATERIAL_OWNER), ("linen", PAD_OWNER)):
        owner = bpy.data.objects.get(owner_name)
        if not owner or owner.type != "MESH":
            raise RuntimeError("Source-bound pavilion material owner is absent")
        choices = [material for material in owner.data.materials if material and material.name == label]
        if len(choices) != 1:
            raise RuntimeError(f"Expected the exact existing {label} material")
        materials[label] = choices[0]
    originals = {obj.name: _mesh_digest(obj) for obj in scene.objects if obj.type == "MESH"}
    created = []
    for part in parts():
        mesh = bpy.data.meshes.new(part["name"])
        mesh.from_pydata(part["points"], [], part["triangles"])
        mesh.materials.append(materials[part["material"]])
        color = mesh.color_attributes.new(name="COLOR_0", type="FLOAT_COLOR", domain="CORNER")
        for item in color.data:
            item.color = (1, 1, 1, 1)
        obj = bpy.data.objects.new(part["name"], mesh)
        obj["component"] = "pavilion-breakfast-support-v2"
        obj["role"] = "breakfast-seat-support" if part["material"] == "linen" else "breakfast-foot-support"
        scene.collection.objects.link(obj)
        mesh.update()
        created.append(obj.name)
    bpy.context.view_layer.update()
    changed = [name for name, digest in originals.items() if _mesh_digest(bpy.data.objects[name]) != digest]
    if changed:
        raise RuntimeError(f"Additive builder changed old mesh fields: {changed}")
    return {"version": VERSION, "created": created, "oldMeshesExact": len(originals), "oldMeshDigests": originals, "triangles": 80,
            "worldTop": TOP, "worldFloor": FLOOR, "plan": PLAN, "supports": SUPPORTS,
            "bearing": {"floorEmbed": 0.004, "topEmbed": 0.006},
            "seatpad": {"worldTop": PAD_TOP, "worldBottom": PAD_BOTTOM, "plan": PAD_PLAN, "oldCushionTopNominal": 0.535, "nominalEmbed": 0.002},
            "parts": [{key: value for key, value in part.items() if key != "points" and key != "triangles"} for part in parts()],
            "scope": "Additive private geometry only. Actual source support, decoded fields/body/feet, AO, cap, cache and complete-product appearance still gate admission."}
