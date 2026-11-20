"""Carve the approved X-negative listening-bar lift and its dry shore gallery."""

from collections import Counter
import hashlib
import json
from pathlib import Path
import statistics
import struct
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from coastal_geology_export_custody import qualify_static_ports
from coastal_office import Parts, box
from coastal_shell import boolean

ROCK = ("core__golden coastal sandstone", "coast_shared_golden coastal sandstone")
SAND = "coast_shared_dry beach sand"
MATERIAL = "golden coastal sandstone"
UV = "UVMap"
BOUNCE = "Baked contact and bounce"
MARK = "embeddedLiftNativeExcavation"
SOURCE_FACE = "embedded_lift_source_face"
SOURCE_VERT = "embedded_lift_source_vertex"
SHAFT = ((-14.37, 8.29, -6.72), (-12.65, 10.34, 2.43))
UPPER = ((-12.76, 8.72, -0.08), (-12.42, 9.92, 2.23))
GALLERY = ((-14.16, 10.23, -6.73), (-12.86, 13.59, -4.14))
TURN = ((-14.16, 12.31, -6.75), (-11.28, 13.61, -4.13))
SLIT = ((-14.51, 10.20, -5.13), (-13.17, 16.83, 1.96))
CUTS = (SHAFT, UPPER, GALLERY, TURN, SLIT)
WALK = (
    ((-12.67, 8.74, -0.078), (-12.40, 9.90, 0.001)),
    ((-14.13, 10.30, -6.71), (-12.89, 12.36, -6.45)),
    ((-14.13, 12.36, -6.71), (-12.20, 13.56, -6.45)),
    ((-12.20, 12.36, -6.73), (-11.80, 13.56, -6.57)),
    ((-11.80, 12.36, -6.745), (-11.34, 13.56, -6.69)),
)
LOWER_ROUTE = (
    (-13.51, 10.86, -6.45),
    (-13.51, 12.96, -6.45),
    (-12.35, 12.96, -6.45),
    (-12.02, 12.96, -6.57),
    (-11.60, 12.96, -6.69),
    (-11.15, 12.96, -6.70),
)


def sculpt_mesh(name, mesh, material):
    bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
    data = bpy.data.meshes.new(name)
    mesh.to_mesh(data)
    mesh.free()
    data.materials.append(material)
    tool = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(tool)
    return tool


def box_tool(name, corners, material):
    lo, hi = (Vector(point) for point in corners)
    mesh = bmesh.new()
    box(mesh, (lo + hi) / 2, hi - lo, 0)
    return sculpt_mesh(name, mesh, material)


def slit_tool(material):
    """The X-positive mouth edge stays put. The thicker X-negative stone takes the flare."""
    mesh = bmesh.new()
    profiles = (
        (-5.13, 0.0),
        (-4.98, 0.55),
        (-4.85, 1.0),
        (-4.68, 0.41),
        (-4.48, 0.0),
        (-1.96, 0.0),
        (-1.80, 0.47),
        (-1.625, 1.0),
        (-1.47, 0.62),
        (-1.25, 0.0),
        (1.25, 0.0),
        (1.45, 0.54),
        (1.6, 1.0),
        (1.78, 0.40),
        (1.96, 0.0),
    )
    rings = [
        [
            mesh.verts.new((a, b, z))
            for a, b in (
                (-13.835 - 0.050 * widen, 10.20),
                (-13.185, 10.20),
                (-13.34, 16.83),
                (-14.27 - 0.22 * widen, 16.83),
            )
        ]
        for z, widen in profiles
    ]
    for a, b in zip(rings, rings[1:]):
        for i in range(4):
            j = (i + 1) % 4
            mesh.faces.new((a[i], a[j], b[j]))
            mesh.faces.new((a[i], b[j], b[i]))
    mesh.faces.new(list(reversed(rings[0])))
    mesh.faces.new(rings[-1])
    return sculpt_mesh("embedded lift ocean reveal tool", mesh, material)


def discard(obj):
    data = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if data.users == 0:
        bpy.data.meshes.remove(data)


def tool_for_cut(material):
    target = box_tool("embedded lift shaft tool", SHAFT, material)
    pieces = [box_tool("embedded lift room tool", bounds, material) for bounds in CUTS[1:4]]
    pieces.append(slit_tool(material))
    try:
        for piece in pieces:
            bpy.context.view_layer.update()
            boolean(target, piece, "UNION")
    finally:
        for piece in pieces:
            discard(piece)
    bm = bmesh.new()
    bm.from_mesh(target.data)
    count = sum(not e.is_manifold for e in bm.edges)
    bm.free()
    if count:
        discard(target)
        raise ValueError("Excavation tool has %d nonmanifold edges" % count)
    return target


def face_gap(points):
    low = [min(point[i] for point in points) for i in range(3)]
    high = [max(point[i] for point in points) for i in range(3)]
    return min(
        max(0, *(low[i] - stop[i] for i in range(3)), *(start[i] - high[i] for i in range(3))) for start, stop in CUTS
    )


def in_zone(points, margin):
    low = [min(point[i] for point in points) for i in range(3)]
    high = [max(point[i] for point in points) for i in range(3)]
    return any(
        all(low[i] <= stop[i] + margin and high[i] >= start[i] - margin for i in range(3)) for start, stop in CUTS
    )


def far_faces(obj, margin=0.35):
    """Fingerprint positions, corner UV and baked colour with directed loop order."""
    mesh, world = obj.data, obj.matrix_world
    world_points = [world @ v.co for v in mesh.vertices]
    points = [tuple(v.co) for v in mesh.vertices]
    uv_layer = mesh.uv_layers.get(UV)
    colour_layer = mesh.color_attributes.get(BOUNCE)
    if uv_layer is None or colour_layer is None or colour_layer.domain != "CORNER":
        raise ValueError("Missing retained loop fields in " + obj.name)
    uv = uv_layer.data
    colour = colour_layer.data
    ledger = Counter()
    for face in mesh.polygons:
        if in_zone([world_points[i] for i in face.vertices], margin):
            continue
        corners = tuple(
            struct.pack("<9f", *points[mesh.loops[i].vertex_index], *uv[i].uv, *colour[i].color)
            for i in face.loop_indices
        )
        loops = min(corners[i:] + corners[:i] for i in range(len(corners)))
        ledger[
            bytes((int(face.use_smooth),))
            + mesh.materials[face.material_index].name.encode("utf-8")
            + b"\x00"
            + b"".join(loops)
        ] += 1
    checksum = hashlib.sha256()
    for key, count in sorted(ledger.items()):
        checksum.update(key)
        checksum.update(struct.pack("<I", count))
    return sum(ledger.values()), checksum.hexdigest()


def paint_new_face(face, uv, ao, rgba, world):
    normal = world.to_3x3() @ face.normal
    dominant = max(range(3), key=lambda i: abs(normal[i]))
    a, b = [i for i in range(3) if i != dominant]
    for loop in face.loops:
        point = world @ loop.vert.co
        loop[uv].uv = (point[a] * 0.42, point[b] * 0.42)
        loop[ao] = rgba


def splice_cut(rock, cutter):
    """Use Blender Exact on a duplicate. Preserve the released polygons outside the excavation."""
    before = qualify_static_ports(rock)
    # The lower foundation has larger triangles where its outer faces meet the new portal.
    margin = 0.065
    world = rock.matrix_world
    points = [world @ v.co for v in rock.data.vertices]
    local = {f.index for f in rock.data.polygons if in_zone([points[i] for i in f.vertices], margin)}
    if not local:
        raise ValueError("Excavation misses " + rock.name)
    bounce = rock.data.color_attributes[BOUNCE].data
    source_colors = [tuple(bounce[k].color) for i in sorted(local) for k in rock.data.polygons[i].loop_indices]
    rgba = tuple(statistics.median(color[channel] for color in source_colors) for channel in range(4))

    trial = rock.copy()
    trial.data = rock.data.copy()
    bpy.context.collection.objects.link(trial)
    source = bmesh.new()
    result = bmesh.new()
    try:
        field = trial.data.attributes.new(SOURCE_FACE, "INT", "FACE")
        field.data.foreach_set("value", np.arange(1, len(field.data) + 1, dtype=np.int32))
        vertex_field = trial.data.attributes.new(SOURCE_VERT, "INT", "POINT")
        vertex_field.data.foreach_set("value", np.arange(1, len(vertex_field.data) + 1, dtype=np.int32))
        bpy.context.view_layer.update()
        boolean(trial, cutter, "DIFFERENCE")
        source.from_mesh(rock.data)
        source.faces.ensure_lookup_table()
        originals = list(source.verts)
        result.from_mesh(trial.data)
        sid = result.faces.layers.int.get(SOURCE_FACE)
        vid = result.verts.layers.int.get(SOURCE_VERT)
        if sid is None or vid is None:
            raise RuntimeError("Exact Boolean did not retain the original face and vertex ids")

        def key(v):
            return tuple(round(x, 6) for x in v.co)

        def signature(face):
            points = tuple(key(vertex) for vertex in face.verts)
            return min(points[i:] + points[:i] for i in range(len(points)))

        mapped = {}
        cut_faces = []
        for face in result.faces:
            source_index = face[sid] - 1
            if source_index >= 0:
                mapped.setdefault(source_index, []).append(face)
            elif in_zone([world @ v.co for v in face.verts], 0.11):
                cut_faces.append(face)

        # Exact re-resolves overlapping remote boulders. Keep only the full connected
        # changed component whose original surface actually reaches this cutter.
        altered = {
            face
            for face in source.faces
            if len(mapped.get(face.index, ())) != 1 or signature(mapped[face.index][0]) != signature(face)
        }
        changed_faces = [source.faces[i] for i in sorted(local) if source.faces[i] in altered]
        reached = set(changed_faces)
        for face in changed_faces:
            for edge in face.edges:
                for neighbor in edge.link_faces:
                    if neighbor in altered and neighbor not in reached:
                        reached.add(neighbor)
                        changed_faces.append(neighbor)
        changed = sorted(face.index for face in changed_faces)
        ignored = len(altered) - len(reached)
        if not cut_faces or not changed:
            raise RuntimeError("No new excavation on " + rock.name)
        local_faces = [source.faces[i] for i in changed]
        affected = {v for face in local_faces for v in face.verts}
        by_position = {}
        for vertex in affected:
            by_position.setdefault(key(vertex), []).append(vertex)

        keep = [face for i in changed for face in mapped.get(i, ())] + cut_faces
        source_seam = max(face_gap([world @ v.co for v in f.verts]) for f in local_faces)
        result_seam = max(face_gap([world @ v.co for v in f.verts]) for f in keep)
        seam = max(source_seam, result_seam)
        if seam > 0.95:
            raise RuntimeError(
                "Excavation edits geometry more than 950 mm from the cutter on " + rock.name + " " + repr(seam)
            )
        # The connected native seam sometimes includes a coarse triangle outside a
        # fixed offset. Measure it and verify every face beyond that bounded reach.
        far_margin = max(0.365, seam + 0.005)
        far = far_faces(rock, far_margin)
        bmesh.ops.delete(source, geom=local_faces, context="FACES_ONLY")
        uv = source.loops.layers.uv.get(UV)
        ao = source.loops.layers.float_color.get(BOUNCE) or source.loops.layers.color.get(BOUNCE)
        if uv is None or ao is None:
            raise RuntimeError("Missing cut loop fields")
        new_faces = []
        replacements = {}
        for audited in keep:
            vertices = []
            for v in audited.verts:
                if v not in replacements:
                    at = key(v)
                    index = v[vid] - 1
                    if 0 <= index < len(originals) and key(originals[index]) == at:
                        replacements[v] = originals[index]
                    else:
                        candidates = by_position.get(at, ())
                        replacements[v] = candidates[0] if len(candidates) == 1 else source.verts.new(v.co)
                vertices.append(replacements[v])
            if len(set(vertices)) != len(vertices) or source.faces.get(vertices):
                continue
            result_face = source.faces.new(vertices)
            material = trial.data.materials[audited.material_index]
            material_index = rock.data.materials.find(material.name)
            if material_index < 0:
                raise RuntimeError("Excavation changed the geology's material slots")
            result_face.material_index = material_index
            result_face.smooth = audited.smooth
            for dest, origin in zip(result_face.loops, audited.loops):
                dest.copy_from(origin)
            if audited[sid] == 0:
                new_faces.append(result_face)

        dead = [v for v in affected.union(replacements.values()) if v.is_valid and not v.link_faces]
        bmesh.ops.delete(source, geom=dead, context="VERTS")
        for edge in list(source.edges):
            if not edge.link_faces:
                source.edges.remove(edge)
        source.normal_update()
        for face in new_faces:
            paint_new_face(face, uv, ao, rgba, world)
        bad = [edge for edge in source.edges if not edge.is_manifold or not edge.is_contiguous]
        if bad:
            witnesses = [[list(v.co) for v in e.verts] for e in bad[:8]]
            raise RuntimeError("%s has %d non-directed ports after the cut %s" % (rock.name, len(bad), witnesses))
        source.to_mesh(rock.data)
        rock.data.update()
    finally:
        source.free()
        result.free()
        discard(trial)

    after = qualify_static_ports(rock)
    retained = far_faces(rock, far_margin)
    if retained != far:
        raise RuntimeError("Distant face tuples changed on " + rock.name + " " + repr((far, retained)))
    return {
        "before": before,
        "after": after,
        "editedFaceRegion": len(local),
        "changedSourceFaces": len(changed),
        "newCutFaces": len(new_faces),
        "remoteBooleanChangesIgnored": ignored,
        "farFaces": far[0],
        "farSha256": far[1],
        "localMargin": margin,
        "farMargin": far_margin,
        "newFaceMedianBounce": list(rgba),
        "sourceSeamReach": source_seam,
        "resultSeamReach": result_seam,
    }


def gallery_floor(material):
    build = Parts("core_embedded_lift_walk")
    for low, high in WALK:
        a, b = Vector(low), Vector(high)
        box(build.bm(material), (a + b) / 2, b - a, 0.002, segments=1)
    objects = build.finish()
    for item in objects:
        item["walk"] = "solid"
        item["installationGroup"] = "cliff-lift"
        item["embeddedLiftThreshold"] = True
    return objects


def witnesses(scene, floors):
    owner_names = {*ROCK, SAND, *(item.name for item in floors)}
    objects = [scene.objects[name] for name in sorted(owner_names)]
    from mathutils.bvhtree import BVHTree

    trees = {}
    for item in objects:
        world = item.matrix_world
        trees[item.name] = BVHTree.FromPolygons(
            [world @ v.co for v in item.data.vertices], [tuple(p.vertices) for p in item.data.polygons]
        )

    def nearest(origin, direction, limit=12):
        hits = []
        for name, tree in trees.items():
            point, normal, _, distance = tree.ray_cast(Vector(origin), Vector(direction), limit)
            if point is not None:
                hits.append((distance, name, tuple(point), tuple(normal)))
        return min(hits) if hits else None

    supports = []
    route = LOWER_ROUTE
    for a, b in zip(route, route[1:]):
        delta = Vector(b) - Vector(a)
        across = Vector((-delta.y, delta.x, 0)).normalized()
        steps = max(1, round(delta.length / 0.10))
        for i in range(steps + 1):
            center = Vector(a).lerp(Vector(b), i / steps)
            for offset in (-0.215, 0, 0.215):
                target = center + across * offset
                x, y, _ = target
                floor = nearest((x, y, -5.96), (0, 0, -1), 1.25)
                if floor is None or floor[2][2] < -6.93 or floor[3][2] < 0.65:
                    raise ValueError("No suitable dry lower support at " + repr(tuple(target)) + " " + repr(floor))
                z = floor[2][2]
                ceiling = nearest((x, y, z + 0.04), (0, 0, 1), 2.3)
                if ceiling is not None and ceiling[2][2] - z < 1.94:
                    raise ValueError("Lower passage is too low at " + repr((x, y, z, ceiling)))
                supports.append({"point": [round(x, 4), round(y, 4), round(z, 4)], "floor": floor[1]})

    for where, direction in (
        ((-12.67, 9.32, 1.10), (-1, 0, 0)),
        ((-13.51, 10.31, -5.30), (0, 1, 0)),
    ):
        hit = nearest(where, direction, 0.28)
        if hit is not None:
            raise ValueError("Native threshold obstructed " + repr(hit))
    return {
        "lowerSupportedSamples": supports,
        "lowerMinimumFoot": min(s["point"][2] for s in supports),
        "gateCenterWorld": {"top": [-12.67, 0.001, -9.32], "beach": [-13.51, -6.45, -10.30]},
        "carCenterWorldXZ": [-13.51, -9.32],
        "galleryWaypoints": LOWER_ROUTE,
    }


def carve_embedded_lift(scene=None):
    scene = scene or bpy.context.scene
    if scene.get(MARK):
        raise ValueError("Embedded lift cut has already been applied")
    material = bpy.data.materials[MATERIAL]
    cutting = tool_for_cut(material)
    try:
        data = {name: splice_cut(scene.objects[name], cutting) for name in ROCK}
    finally:
        discard(cutting)
    print("Embedded geology closure and tuple custody", json.dumps(data), flush=True)
    floors = gallery_floor(material)
    bpy.context.view_layer.update()
    checks = witnesses(scene, floors)
    scene[MARK] = 1
    return {"solids": data, "walkMeshes": [ob.name for ob in floors], "checks": checks}


def retain_distant_light(before_bake, cut_report):
    """Bring the original corner light back outside each measured excavation."""
    with bpy.data.libraries.load(str(Path(before_bake).resolve()), link=False) as (_, requested):
        requested.objects = list(ROCK)
    result = {}
    for name, prior in zip(ROCK, requested.objects):
        rock = bpy.context.scene.objects[name]
        target, source = rock.data, prior.data
        if len(target.loops) != len(source.loops) or len(target.polygons) != len(source.polygons):
            raise ValueError("The light bake changed the native cliff topology at " + name)
        now = target.color_attributes[BOUNCE]
        old = source.color_attributes[BOUNCE]
        if now.domain != "CORNER" or old.domain != "CORNER":
            raise ValueError("Missing per-corner lighting on " + name)
        pixels = np.empty((len(target.loops), 4), dtype=np.float32)
        restored = np.empty_like(pixels)
        now.data.foreach_get("color", pixels.ravel())
        old.data.foreach_get("color", restored.ravel())
        cut = cut_report["solids"][name]
        world = [rock.matrix_world @ v.co for v in target.vertices]
        nearby = 0
        for face in target.polygons:
            if in_zone([world[i] for i in face.vertices], cut["farMargin"]):
                corners = slice(face.loop_start, face.loop_start + face.loop_total)
                restored[corners] = pixels[corners]
                nearby += 1
        now.data.foreach_set("color", restored.ravel())
        bpy.data.objects.remove(prior, do_unlink=True)
        if not source.users:
            bpy.data.meshes.remove(source)
        count, digest = far_faces(rock, cut["farMargin"])
        if (count, digest) != (cut["farFaces"], cut["farSha256"]):
            raise ValueError("Distant rock changed after the light bake at " + name)
        result[name] = {"localFaces": nearby, "retainedFaces": count, "retainedSha256": digest}
    return result


if __name__ == "__main__":
    arguments = dict(arg[2:].split("=", 1) for arg in sys.argv if arg.startswith("--") and "=" in arg)
    bpy.ops.wm.open_mainfile(filepath=arguments["source"])
    if "restore-bounce" in arguments:
        cut = json.loads(Path(arguments["cut-report"]).read_text(encoding="utf-8"))
        result = retain_distant_light(arguments["restore-bounce"], cut)
    else:
        result = carve_embedded_lift()
    Path(arguments["report"]).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    if "save-as" in arguments:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=arguments["save-as"], compress=True)
