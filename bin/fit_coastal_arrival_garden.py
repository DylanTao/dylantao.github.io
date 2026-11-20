"""Fit the clifftop garden apron and oak-lined stair mouth to the retained B arrival.

blender -b coastal-home.blend --python-exit-code 1 --python fit_coastal_arrival_garden.py -- \
  --save-as <new.blend> --report <fit.json> [--manifest <manifest.json> --manifest-out <new.json>]

Geometry stays in the first-load core. The artwork, lower door and route remain where authored.
Coordinates written in the fit report are Web (native X, native Z, negative native Y).
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

PREFIX = "core_garden_threshold_"
PLINTH = "core_arrival_B_portal_plinth"
PORTAL_EDGE = 31.85
PLINTH_TOP = 8.30
STAIR_HEAD = (0.195, 8.30, 31.36)
WALK_SOLE = (1.06, 8.17489362, 34.3)
LOOK_AT = (0.25, 9.58, 31.78)
FOV = 70
BEDROCK_JOINT = "rock-clearance-4mm-v1"

# Clockwise in plan. The seaward edge mates exactly to the old 2.23 m plinth.
OUTLINE = [
    (-0.92, 31.85), (-1.11, 32.78), (-1.27, 33.57), (-1.30, 34.27),
    (-1.13, 34.79), (-0.55, 35.00), (0.52, 35.05), (1.40, 35.02),
    (1.67, 34.71), (1.66, 33.52), (1.52, 32.67), (1.31, 31.85),
]
# Offset seams across the width, varied as large pieces of split flagstone.
FLAGS = [
    (-0.70, 32.08), (0.07, 32.14), (0.96, 32.03),
    (-0.90, 32.71), (-0.36, 32.67), (0.52, 32.80), (1.33, 32.62),
    (-0.98, 33.46), (-0.23, 33.50), (0.56, 33.38), (1.26, 33.58),
    (-0.88, 34.22), (-0.27, 34.34), (0.31, 34.22), (1.07, 34.37),
    (-0.53, 34.93), (0.28, 34.94), (1.25, 34.92),
]


def grade(depth):
    return PLINTH_TOP - (depth - PORTAL_EDGE) * (0.12 / (34.20 - PORTAL_EDGE))


def native(point):
    x, height, depth = point
    return x, -depth, height


def bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return [[round(fn(v[axis] for v in corners), 5) for axis in range(3)] for fn in (min, max)]


def tighten(polygon, width):
    center = sum((Vector(p) for p in polygon), Vector((0, 0))) / len(polygon)
    result = []
    for point in polygon:
        corner = Vector(point)
        delta = center - corner
        result.append(tuple(corner + delta.normalized() * width))
    return result


def cut_cell(polygon, origin, other):
    nx, ny = other[0] - origin[0], other[1] - origin[1]
    limit = nx * (origin[0] + other[0]) / 2 + ny * (origin[1] + other[1]) / 2
    result = []
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        dist_a = nx * a[0] + ny * a[1] - limit
        dist_b = nx * b[0] + ny * b[1] - limit
        if dist_a <= 0:
            result.append(a)
        if (dist_a <= 0) != (dist_b <= 0):
            fraction = dist_a / (dist_a - dist_b)
            result.append(tuple(axis_a + (axis_b - axis_a) * fraction for axis_a, axis_b in zip(a, b)))
    return result


def ring_mesh(rings, vertices, faces, *, closed=True):
    """Rings lie bottom to top and their Web plan order is clockwise."""
    first = len(vertices)
    count = len(rings[0])
    for ring in rings:
        vertices.extend(native(v) for v in ring)
    if closed:
        faces.append(tuple(first + i for i in reversed(range(count))))
    for lower in range(first, first + (len(rings) - 1) * count, count):
        for i in range(count):
            j = (i + 1) % count
            faces.append((lower + i, lower + j, lower + j + count, lower + i + count))
    last = first + (len(rings) - 1) * count
    faces.append(tuple(last + i for i in range(count)))


def rectangular_face(left, right, near, far):
    return ((left, near), (left, far), (right, far), (right, near))


def timber_piece(vertices, faces, left, right, near, far, bottom, top, bevel=0.005):
    """A short chamfer prevents the dark frame joints looking like painted lines."""
    profile = rectangular_face(left, right, near, far)
    edges = rectangular_face(left + bevel, right - bevel, near + bevel, far - bevel)
    levels = ((bottom, edges), (bottom + bevel, profile), (top - bevel, profile), (top, edges))
    rings = [[(x, height, depth) for x, depth in ring] for height, ring in levels]
    ring_mesh(rings, vertices, faces)


def handrail(vertices, faces, x):
    # A rounded rail over the real, unchanged upper flight and its landing.
    centers = [(31.53, 9.265), (30.49, 9.265), (30.36, 9.247), (27.74, 7.628)]
    count = 8
    start = len(vertices)
    for i, (depth, height) in enumerate(centers):
        prev, following = centers[max(0, i - 1)], centers[min(len(centers) - 1, i + 1)]
        cross = Vector((following[1] - prev[1], prev[0] - following[0])).normalized()
        for k in range(count):
            angle = math.tau * k / count
            lateral, radial = .031 * math.cos(angle), .025 * math.sin(angle)
            vertices.append(native((x + lateral, height + radial * cross.y, depth + radial * cross.x)))
    faces.append(tuple(start + k for k in range(count)))
    for i in range(len(centers) - 1):
        ring = start + i * count
        for k in range(count):
            j = (k + 1) % count
            faces.append((ring + k, ring + count + k, ring + count + j, ring + j))
    faces.append(tuple(start + (len(centers) - 1) * count + k for k in reversed(range(count))))


def tread_surface(depth):
    index = max(0, math.floor((30.66 - depth) / .28))
    return PLINTH_TOP - index * (8.30 / 48)


def make_mesh(collection, name, vertices, faces, material, *, texture_scale, wood=False):
    geometry = bpy.data.meshes.new(name)
    geometry.from_pydata(vertices, [], faces)
    if geometry.validate():
        raise ValueError(f"Invalid native geometry in {name}")
    geometry.update()
    geometry.materials.append(material)
    uv = geometry.uv_layers.new(name="UVMap")
    for polygon in geometry.polygons:
        for loop_index in polygon.loop_indices:
            x, y, z = geometry.vertices[geometry.loops[loop_index].vertex_index].co
            normal = polygon.normal
            if abs(normal.z) > 0.5:
                u, v = x, -y
            elif abs(normal.x) > abs(normal.y):
                u, v = -y, z
            else:
                u, v = x, z
            if wood and abs(normal.z) < 0.5:
                u, v = v, u
            uv.data[loop_index].uv = (u / texture_scale, v / texture_scale)
    obj = bpy.data.objects.new(name, geometry)
    obj["walk"] = "solid"
    collection.objects.link(obj)
    return obj


def cap_vertices(obj):
    return {
        tuple(round(float(axis), 6) for axis in vertex.co)
        for vertex in obj.data.vertices
        if abs(vertex.co.z - grade(-vertex.co.y)) < 1e-6
    }


def check_solid(mesh):
    bm = bmesh.new()
    try:
        bm.from_mesh(mesh)
        if any(not edge.is_manifold or not edge.is_contiguous for edge in bm.edges):
            raise ValueError("The fitted bearing is not closed and consistently oriented")
        volume = bm.calc_volume(signed=True)
        if volume <= 0:
            raise ValueError("The fitted bearing has no positive volume")
        return volume
    finally:
        bm.free()


def fit_bearing_to_bedrock(scene, bearing):
    """Scribe the bearing to the local rock edge while preserving its exact cap."""
    if bearing.data.get("bedrockJoint") == BEDROCK_JOINT:
        return {"version": BEDROCK_JOINT, "alreadyFitted": True, "volumeM3": check_solid(bearing.data)}

    rock = scene.objects["core__golden coastal sandstone"]
    original = bearing.data
    original_volume = check_solid(original)
    old_cap = cap_vertices(bearing)
    shared = rock.copy()
    scene.collection.objects.link(shared)
    # Small vertical and inland offsets keep the fitted joint out of the existing
    # terrain and avoid coincident triangles along its vertical inland end.
    shared.matrix_world = Matrix.Translation(Vector((0, -.004, .004))) @ rock.matrix_world
    modifier = bearing.modifiers.new("Scribed contact against retained sandstone", "BOOLEAN")
    modifier.object = shared
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    try:
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        fitted = bpy.data.meshes.new_from_object(
            bearing.evaluated_get(depsgraph), preserve_all_data_layers=True, depsgraph=depsgraph
        )
    finally:
        bearing.modifiers.remove(modifier)
        bpy.data.objects.remove(shared, do_unlink=True)

    bearing.data = fitted
    volume = check_solid(fitted)
    if cap_vertices(bearing) != old_cap or not (0.08 < original_volume - volume < 0.25):
        bearing.data = original
        bpy.data.meshes.remove(fitted)
        raise ValueError("Substrate fit must preserve the full approach cap and trim only the inland joint")
    fitted["bedrockJoint"] = BEDROCK_JOINT
    if original.users == 0:
        original_name = original.name
        bpy.data.meshes.remove(original)
        fitted.name = original_name
    return {
        "version": BEDROCK_JOINT, "alreadyFitted": False, "capVertices": len(old_cap),
        "volumeM3": volume, "trimmedVolumeM3": original_volume - volume,
    }


def fit_garden_threshold(scene):
    """Re-use native materials and leave retained mesh vertices and anchors untouched."""
    plinth = scene.objects[PLINTH]
    if bounds(plinth) != [[-0.92, -31.85, 7.74], [1.31, -30.656, 8.30]]:
        raise ValueError("The surveyed B arrival plinth changed")
    if any(obj.name.startswith(PREFIX) for obj in scene.objects):
        raise ValueError("The B garden threshold already exists")
    collection = plinth.users_collection[0]
    existing_materials = bpy.data.materials
    stone = existing_materials["travertine paving stone"]
    edge = existing_materials["warm cut stone"]
    oak = existing_materials["pale oak"]

    # An embedded battered base, tapering to meet the native plinth's full edge.
    # The capped plane is the collision support. The shallow flags sit just above it.
    base_vertices, base_faces = [], []
    base_rings = []
    for widen, lift in ((0.080, None), (0.036, -0.19), (0.0, 0.0)):
        ring = []
        for x, depth in OUTLINE:
            share = min(1, (depth - PORTAL_EDGE) / 0.85)
            bottom = 7.46 if lift is None else grade(depth) + lift
            side = -1 if x < 0.20 else 1
            ring.append((x + widen * side * share, bottom, depth))
        base_rings.append(ring)
    ring_mesh(base_rings, base_vertices, base_faces)
    base = make_mesh(collection, PREFIX + "apron_bearing", base_vertices, base_faces, edge, texture_scale=.95)

    flags_vertices, flags_faces = [], []
    for i, origin in enumerate(FLAGS):
        cell = list(OUTLINE)
        for j, other in enumerate(FLAGS):
            if i != j:
                cell = cut_cell(cell, origin, other)
        if len(cell) < 3:
            raise ValueError(f"Empty garden paving piece {i}")
        border = tighten(cell, 0.004 + (i % 3) * 0.002)
        face = tighten(border, 0.007)
        rings = [
            [(x, grade(depth), depth) for x, depth in border],
            [(x, grade(depth) + min(.004, (depth-PORTAL_EDGE) * .04), depth) for x, depth in border],
            [(x, grade(depth) + min(.009, (depth-PORTAL_EDGE) * .06), depth) for x, depth in face],
        ]
        ring_mesh(rings, flags_vertices, flags_faces, closed=False)
    flags = make_mesh(collection, PREFIX + "apron_flags", flags_vertices, flags_faces, stone, texture_scale=.95)

    flags["walk"] = "through"

    # Jambs sit against the original side liners, outside the seaward clear way.
    # One deep oak return prefaces the west liner and leaves the descent visible.
    timber_vertices, timber_faces = [], []
    timber_piece(timber_vertices, timber_faces, -1.590, -1.422, 31.63, 31.875, 8.31, 10.444)
    timber_piece(timber_vertices, timber_faces, 1.165, 1.344, 31.65, 31.875, 8.31, 10.444)
    timber_piece(timber_vertices, timber_faces, -1.588, 1.342, 31.63, 31.888, 10.448, 10.558)
    for index in range(7):
        start = 31.15 + index * .068
        timber_piece(timber_vertices, timber_faces, -1.583, -1.533, start, start + .058, 8.39, 10.393, .003)
    # The deep, open ceiling reveal lets the interrupted daylight read as depth.
    # Its thin boards stay below the soffit and above the full 2.14 m headway.
    for index in range(12):
        left = -1.408 + index * .211
        timber_piece(timber_vertices, timber_faces, left, left + .199,
                     30.783, 31.627, 10.448, 10.502, .004)
    # The approach-side rail sits back on the wall. The inner rail follows the
    # dry stair edge beside the rill so the change of level reads from outside.
    handrail(timber_vertices, timber_faces, 1.264)
    handrail(timber_vertices, timber_faces, -.854)
    for depth, height in ((31.40, 9.265), (30.55, 9.265), (29.60, 8.777), (28.60, 8.160), (27.82, 7.678)):
        timber_piece(timber_vertices, timber_faces, 1.278, 1.347,
                     depth - .019, depth + .019, height - .016, height + .014, .002)
        timber_piece(timber_vertices, timber_faces, -.871, -.837,
                     depth - .017, depth + .017, tread_surface(depth), height - .012, .002)
    timber = make_mesh(collection, PREFIX + "oak_portal", timber_vertices, timber_faces, oak, texture_scale=1.15, wood=True)
    return (base, flags, timber)


def report(scene, source, objects):
    eye = Vector((WALK_SOLE[0], WALK_SOLE[1] + 1.60, WALK_SOLE[2]))
    sight = (Vector(LOOK_AT) - eye).normalized()
    return {
        "source": str(source),
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "walkPlace": {
            "label": "Main entrance", "room": "outside", "position": list(WALK_SOLE),
            "yaw": math.atan2(sight.x, sight.z), "pitch": math.asin(sight.y), "fov": FOV,
        },
        "eye": list(eye),
        "lookAt": list(LOOK_AT),
        "retainedStairHead": list(STAIR_HEAD),
        "apron": {
            "grade": (WALK_SOLE[1] - PLINTH_TOP) / (WALK_SOLE[2] - PORTAL_EDGE),
            "flagstones": len(FLAGS), "plan": OUTLINE, "bearingElevation": 7.46,
            "oldPlinthWebEdge": PORTAL_EDGE, "oldPlinthElevation": PLINTH_TOP,
        },
        "retainedLowerDoor": bounds(scene.objects["core_arrival_B_reveal_panel"]),
        "objects": {obj.name: {"nativeBounds": bounds(obj), "polygons": len(obj.data.polygons)}
                    for obj in objects},
    }


def bind_garden_approach(manifest, fit):
    manifest["walk"]["places"]["entrance"] = fit["walkPlace"]
    # A recessed line under the oak head lights the paving in front of it at dusk.
    patch = {"min": [-0.73, 8.26, 31.965], "max": [0.53, 8.311, 32.43]}
    line = {
        "id": "entry-b-apron-wash", "schedule": "steps",
        "a": [-0.39, 10.429, 31.861], "b": [0.18, 10.429, 31.861],
        "intensity": 1.7, "color": [1, .73, .5], "region": patch,
        "transport": False, "emitterRadius": .026,
    }
    receivers = manifest["installationReceivers"]["groups"]["architecture"]
    if patch not in receivers:
        receivers.insert(0, patch)
    manifest["installationLines"] = [line] + [old for old in manifest["installationLines"] if old["id"] != line["id"]]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--save-as", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--fit-existing", action="store_true", help="scribe only the bearing in an already assembled threshold")
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--manifest-out", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    if bool(args.manifest) != bool(args.manifest_out):
        parser.error("--manifest and --manifest-out must be supplied together")
    source = Path(bpy.data.filepath).resolve()
    output = args.save_as.resolve()
    if not source.is_file() or output == source or output.exists():
        raise ValueError("Open the surveyed source and supply a new output file")
    scene = bpy.context.scene
    if args.fit_existing:
        objects = tuple(scene.objects[PREFIX + part] for part in ("apron_bearing", "apron_flags", "oak_portal"))
    else:
        objects = fit_garden_threshold(scene)
    bedrock_joint = fit_bearing_to_bedrock(scene, objects[0])
    bpy.context.view_layer.update()
    receipt = report(scene, source, objects)
    receipt["bedrockJoint"] = bedrock_joint
    output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    args.report.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    if args.manifest:
        manifest = json.loads(args.manifest.read_bytes())
        bind_garden_approach(manifest, receipt)
        args.manifest_out.parent.mkdir(parents=True, exist_ok=True)
        args.manifest_out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(receipt["walkPlace"], separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
