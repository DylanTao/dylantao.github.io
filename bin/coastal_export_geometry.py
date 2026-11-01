"""Lossless removal of constant planar export tessellation.

The high-resolution authoring mesh stays intact. A removable interior vertex
must lie in a complete coplanar star with one material, one emitted color and
one split normal. Curves, color gradients, normal gradients and creases remain.
"""
import hashlib
import json
import math
from collections import Counter, defaultdict


EXACT_NORMAL_ATTRIBUTE = "Export exact split normal"


def planar_patch_coverage(positions, triangles, boundary_edges, normal):
    """Conservatively certify one embedded, consistently oriented planar disk.

    Dissolving a whole annulus can turn its two boundary loops into a single
    n-gon. Blender's polygon triangulator then fills the hole. A valid patch
    has one simple boundary, positive render triangles and matching signed
    projected area. These conditions certify both projected surface coverages;
    the caller separately retains its plane, normal, color and material bounds.
    This helper is independent of Blender so the topology controls are tested.
    """
    axis = max(range(3), key=lambda k: abs(normal[k]))
    axes = ((1, 2), (2, 0), (0, 1))[axis]
    sign = 1 if normal[axis] >= 0 else -1
    used = {i for triangle in triangles for i in triangle} | {i for edge in boundary_edges for i in edge}
    xy = {i: (positions[i][axes[0]], positions[i][axes[1]]) for i in used}
    origin3 = positions[next(iter(used))] if used else (0., 0., 0.)
    plane_error = max((abs(sum((positions[i][k] - origin3[k]) * normal[k] for k in range(3))) for i in used), default=0.)
    if plane_error > 1e-6:
        return {"passed": False, "reason": "component exceeds the original plane bound", "maximumPlaneErrorM": plane_error}
    adjacency = defaultdict(list)
    for a, b in boundary_edges:
        adjacency[a].append(b)
        adjacency[b].append(a)
    if not adjacency or any(len(neighbors) != 2 for neighbors in adjacency.values()):
        return {"passed": False, "reason": "boundary is not disjoint simple cycles"}
    remaining = set(adjacency)
    rings = []
    while remaining:
        start = min(remaining)
        ring, previous, current = [], None, start
        while current not in ring:
            ring.append(current)
            remaining.discard(current)
            neighbors = adjacency[current]
            previous, current = current, neighbors[0] if neighbors[0] != previous else neighbors[1]
        if current != start:
            return {"passed": False, "reason": "boundary traversal did not close"}
        rings.append(ring)
    if len(rings) != 1:
        return {"passed": False, "reason": "multiple boundary loops", "boundaryLoops": len(rings)}
    ring = rings[0]

    def orient(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    def on_segment(a, b, p):
        return min(a[0], b[0]) <= p[0] <= max(a[0], b[0]) and min(a[1], b[1]) <= p[1] <= max(a[1], b[1])

    for i in range(len(ring)):
        a, b = xy[ring[i]], xy[ring[(i + 1) % len(ring)]]
        if a == b:
            return {"passed": False, "reason": "zero-length boundary edge"}
        for j in range(i + 1, len(ring)):
            if j == i + 1 or (i == 0 and j == len(ring) - 1):
                continue
            c, d = xy[ring[j]], xy[ring[(j + 1) % len(ring)]]
            ab_c, ab_d, cd_a, cd_b = orient(a, b, c), orient(a, b, d), orient(c, d, a), orient(c, d, b)
            if (ab_c * ab_d < 0 and cd_a * cd_b < 0) or any(
                value == 0 and on_segment(start, end, point)
                for value, start, end, point in ((ab_c, a, b, c), (ab_d, a, b, d), (cd_a, c, d, a), (cd_b, c, d, b))
            ):
                return {"passed": False, "reason": "self-intersecting or touching projected boundary"}
    origin = xy[ring[0]]
    boundary_area2 = abs(math.fsum(orient(origin, xy[a], xy[b]) for a, b in zip(ring, ring[1:] + ring[:1])))
    areas = [sign * orient(*(xy[i] for i in triangle)) for triangle in triangles]
    if any(area <= 0 for area in areas):
        return {"passed": False, "reason": "nonpositive projected render triangle"}
    triangle_area2 = math.fsum(areas)
    if abs(triangle_area2 - boundary_area2) > 1e-12 * max(1., boundary_area2, triangle_area2):
        return {"passed": False, "reason": "render triangles do not cover the exact boundary", "boundaryArea2": boundary_area2, "triangleArea2": triangle_area2}
    return {"passed": True, "boundaryLoops": 1, "boundaryArea2": boundary_area2, "triangles": len(triangles), "maximumPlaneErrorM": plane_error}


def install_exact_export_normals():
    """Feed retained float corner normals to the pinned Blender exporter.

    Blender's custom_normal is a relative short2 encoding. Rebuilding even an
    untouched face can change that basis, so it cannot hold the original field
    exactly. This export-only float attribute bypasses that re-encoding while
    retaining the exporter's usual rounding, normalization and axis conversion.
    All other meshes use Blender's unmodified normal extraction.
    """
    import bpy
    import numpy as np
    from io_scene_gltf2.blender.exp.primitive_extract import PrimitiveCreator
    from io_scene_gltf2.io.com.constants import ROUNDING_DIGIT
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("The exact-normal adapter is pinned to Blender4.5.9")
    original = PrimitiveCreator._PrimitiveCreator__get_normals
    if getattr(original, "coastal_exact_normals", False):
        return

    def exact(self):
        attribute = self.blender_mesh.attributes.get(EXACT_NORMAL_ATTRIBUTE)
        if attribute is None:
            return original(self)
        if (self.use_morph_normals and self.key_blocks) or self.armature or attribute.domain != "CORNER" or attribute.data_type != "FLOAT_VECTOR":
            raise RuntimeError("Exact export normals are confined to static corner fields")
        values = np.empty(len(self.blender_mesh.loops) * 3, dtype=np.float32)
        attribute.data.foreach_get("vector", values)
        self.normals = np.round(values.reshape(-1, 3), ROUNDING_DIGIT)
        PrimitiveCreator.normalize_vecs(self.normals)
        self.normals[~self.normals.any(axis=1), 2] = 1
        self.morph_normals = []
        if self.export_settings["gltf_yup"]:
            PrimitiveCreator.zup2yup(self.normals)

    exact.coastal_exact_normals = True
    PrimitiveCreator._PrimitiveCreator__get_normals = exact


def compact_constant_planar(mesh):
    import bmesh
    import bpy

    attribute = mesh.color_attributes.active_color
    if attribute is None or attribute.domain != "POINT":
        raise RuntimeError("Planar export compaction requires the emitted POINT color field")
    mesh.calc_loop_triangles()
    before = {"vertices": len(mesh.vertices), "triangles": len(mesh.loop_triangles)}
    positions = [vertex.co.copy() for vertex in mesh.vertices]
    source_faces = [list(face.vertices) for face in mesh.polygons]
    source_loops = [list(face.loop_indices) for face in mesh.polygons]
    source_edges = [tuple(edge.vertices) for edge in mesh.edges]
    source_corner_edges = [[mesh.loops[i].edge_index for i in face.loop_indices] for face in mesh.polygons]
    source_smooth = [face.use_smooth for face in mesh.polygons]
    source_materials = [face.material_index for face in mesh.polygons]
    sharp_edges = {tuple(sorted(edge.vertices)) for edge in mesh.edges if edge.use_edge_sharp}
    colors = [tuple(entry.color) for entry in attribute.data]
    normals = [entry.vector.copy() for entry in mesh.corner_normals]
    good = {}
    for face in mesh.polygons:
        ids = list(face.vertices)
        color = colors[ids[0]]
        normal = normals[face.loop_start]
        origin = mesh.vertices[ids[0]].co
        if any(colors[i] != color for i in ids) or normal.length < .9:
            continue
        if any((normals[i] - normal).length > 1e-7 for i in face.loop_indices):
            continue
        if any(abs((mesh.vertices[i].co - origin).dot(face.normal)) > 1e-6 for i in ids):
            continue
        good[face.index] = (color, normal, face.normal.copy(), origin.copy(), face.material_index)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    candidates = []
    for vertex in bm.verts:
        faces = list(vertex.link_faces)
        if len(faces) < 3 or any(not edge.is_manifold for edge in vertex.link_edges):
            continue
        if any(face.index not in good for face in faces):
            continue
        reference = good[faces[0].index]
        if any(
            (data := good[face.index])[0] != reference[0]
            or data[4] != reference[4]
            or (data[1] - reference[1]).length > 1e-7
            or (data[2] - reference[2]).length > 1e-6
            or any(abs((v.co - reference[3]).dot(reference[2])) > 1e-6 for v in face.verts)
            for face in faces
        ):
            continue
        candidates.append(vertex)
    # Candidate stars that share a source face must be qualified together.
    # Rejecting only a vertex at a hole can still allow neighboring dissolves
    # to erase the same inner boundary, so fallback is per complete component.
    def components_for(candidate_ids):
        parents = {i: i for i in candidate_ids}

        def find(i):
            while parents[i] != i:
                parents[i] = parents[parents[i]]
                i = parents[i]
            return i

        for face in bm.faces:
            members = [vertex.index for vertex in face.verts if vertex.index in parents]
            for i in members[1:]:
                parents[find(i)] = find(members[0])
        result = defaultdict(lambda: {"vertices": set(), "faces": set()})
        for i in candidate_ids:
            component = result[find(i)]
            component["vertices"].add(i)
            component["faces"].update(face.index for face in bm.verts[i].link_faces)
        return result

    def boundary_of(face_ids):
        return [edge for edge in {edge for i in face_ids for edge in bm.faces[i].edges}
                if sum(face.index in face_ids for face in edge.link_faces) == 1]

    source_triangles = defaultdict(list)
    for triangle in mesh.loop_triangles:
        source_triangles[triangle.polygon_index].append(tuple(triangle.vertices))
    # Keep actual original face corridors through holes and at boundary pinches.
    # They remain in the source; no new bridge is drawn across empty geometry.
    # The neighboring candidate stars are then separate planar disk components.
    remaining_candidates = {vertex.index for vertex in candidates}
    bridge_receipts = []
    while True:
        components = components_for(remaining_candidates)
        freeze = set()
        for component_id, component in sorted(components.items()):
            face_ids = component["faces"]
            boundary_edges = boundary_of(face_ids)
            adjacency = defaultdict(list)
            for edge in boundary_edges:
                a, b = (vertex.index for vertex in edge.verts)
                adjacency[a].append(b)
                adjacency[b].append(a)
            pinches = {i for i, neighbors in adjacency.items() if len(neighbors) != 2}
            constrained_faces = {face.index for i in pinches for face in bm.verts[i].link_faces if face.index in face_ids}
            reason = "original faces at boundary pinches"
            if not pinches and adjacency:
                unused, rings = set(adjacency), []
                while unused:
                    start = min(unused)
                    ring, previous, current = [], None, start
                    while current not in ring:
                        ring.append(current)
                        unused.discard(current)
                        neighbors = adjacency[current]
                        previous, current = current, neighbors[0] if neighbors[0] != previous else neighbors[1]
                    rings.append(set(ring))
                if len(rings) > 1:
                    # A shortest source-face path joins two actual boundary
                    # loops. Freeze every candidate in those original faces,
                    # so their full strip survives the export unchanged.
                    first, second = rings[0], set.union(*rings[1:])
                    starts = {face.index for edge in boundary_edges if all(v.index in first for v in edge.verts)
                              for face in edge.link_faces if face.index in face_ids}
                    ends = {face.index for edge in boundary_edges if all(v.index in second for v in edge.verts)
                            for face in edge.link_faces if face.index in face_ids}
                    parent = {i: None for i in starts}
                    queue, found = list(sorted(starts)), None
                    for current in queue:
                        if current in ends:
                            found = current
                            break
                        for edge in bm.faces[current].edges:
                            for face in edge.link_faces:
                                if face.index in face_ids and face.index not in parent:
                                    parent[face.index] = current
                                    queue.append(face.index)
                    if found is not None:
                        while found is not None:
                            constrained_faces.add(found)
                            found = parent[found]
                    reason = "original face corridor between boundary loops"
            # A zero or reversed render triangle cannot be certified as a
            # positive planar disk. Retain that face and all touching stars.
            normal = good[min(face_ids)][2]
            axis = max(range(3), key=lambda k: abs(normal[k]))
            axes = ((1, 2), (2, 0), (0, 1))[axis]
            sign = 1 if normal[axis] >= 0 else -1
            bad_faces = set()
            for i in face_ids:
                for a, b, c in source_triangles[i]:
                    u, v, w = positions[a], positions[b], positions[c]
                    area = (v[axes[0]] - u[axes[0]]) * (w[axes[1]] - u[axes[1]]) - (v[axes[1]] - u[axes[1]]) * (w[axes[0]] - u[axes[0]])
                    if sign * area <= 0:
                        bad_faces.add(i)
            constrained_faces.update(bad_faces)
            frozen = {vertex.index for i in constrained_faces for vertex in bm.faces[i].verts if vertex.index in remaining_candidates}
            if frozen:
                freeze.update(frozen)
                bridge_receipts.append({"component": component_id, "reason": reason, "originalFaceIds": sorted(constrained_faces),
                                        "retainedCandidateVertexIds": sorted(frozen), "nonpositiveRenderFaceIds": sorted(bad_faces)})
        if not freeze:
            break
        remaining_candidates.difference_update(freeze)
    component_for_face, certificates, accepted = {}, [], set()
    position_map = dict(enumerate(positions))
    for component_id, component in sorted(components.items()):
        face_ids = component["faces"]
        boundary = [tuple(vertex.index for vertex in edge.verts) for edge in boundary_of(face_ids)]
        triangle_ids = [triangle for i in face_ids for triangle in source_triangles[i]]
        reference = good[min(face_ids)]
        # The existing 1e-7 local star eligibility is unchanged. Across a
        # complete patch, bound every possible retained-to-output normal pair
        # by the independent 1e-6 field gate (twice a reference-radius bound).
        normal_radius = max((good[i][1] - reference[1]).length for i in face_ids)
        optical_exact = all(good[i][0] == reference[0] and good[i][4] == reference[4] for i in face_ids) and 2 * normal_radius <= 1e-6
        certificate = planar_patch_coverage(position_map, triangle_ids, boundary, reference[2]) if optical_exact else {
            "passed": False, "reason": "component exceeds the original constant field bounds"}
        certificate.update({"component": component_id, "candidateVertices": len(component["vertices"]), "sourceFaces": len(face_ids)})
        certificate["constantNormalDiameterUpperBound"] = 2 * normal_radius
        if not certificate["passed"]:
            certificate["retainedOriginalFaceIds"] = sorted(face_ids)
        certificates.append(certificate)
        component["boundary"] = Counter(tuple(sorted(edge)) for edge in boundary)
        component["certificate"] = certificate
        for i in face_ids:
            component_for_face[i] = component_id
        if certificate["passed"]:
            accepted.update(component["vertices"])
    ids = sorted(accepted)
    original_vertex = bm.verts.layers.int.new("Export original vertex")
    original_face = bm.faces.layers.int.new("Export original face")
    original_edge = bm.edges.layers.int.new("Export original edge")
    for vertex in bm.verts:
        vertex[original_vertex] = vertex.index
    for face in bm.faces:
        face[original_face] = face.index
    for edge in bm.edges:
        incident_ids = set()
        endpoints = {vertex.index for vertex in edge.verts}
        for face in edge.link_faces:
            vertices = source_faces[face.index]
            for k, a in enumerate(vertices):
                if {a, vertices[(k + 1) % len(vertices)]} == endpoints:
                    incident_ids.add(source_corner_edges[face.index][k])
        if len(incident_ids) != 1:
            raise RuntimeError("Ambiguous original native export edge chart")
        edge[original_edge] = next(iter(incident_ids)) + 1
    bmesh.ops.dissolve_verts(bm, verts=[bm.verts[i] for i in ids], use_face_split=False, use_boundary_tear=False)
    open_edges = sum(not edge.is_manifold for edge in bm.edges)
    # A BMesh round trip rotates unrelated n-gon loops and reinterprets packed
    # split normals against a changed fan. Keep every unaffected polygon's
    # original order, smoothing, and absolute corner normal instead. New faces
    # belong only to the already-proved constant optical planar patches.
    # Check the actual proposed render triangulation before changing the mesh.
    # A rejected output component falls back to all of its original polygons.
    proposed = defaultdict(list)
    for face in bm.faces:
        old = face[original_face]
        component_id = component_for_face.get(old)
        if component_id is not None and components[component_id]["certificate"]["passed"]:
            proposed[component_id].append([vertex[original_vertex] for vertex in face.verts])
    rejected_output = set()
    for component_id, polygons in proposed.items():
        used = sorted({i for face in polygons for i in face})
        local = {old: new for new, old in enumerate(used)}
        temporary = bpy.data.meshes.new("Planar coverage control")
        try:
            temporary.from_pydata([positions[i] for i in used], [], [[local[i] for i in face] for face in polygons])
            temporary.calc_loop_triangles()
            triangles = [tuple(used[i] for i in triangle.vertices) for triangle in temporary.loop_triangles]
            edge_counts = Counter(tuple(sorted((a, b))) for face in polygons for a, b in zip(face, face[1:] + face[:1]))
            boundary = [edge for edge, count in edge_counts.items() if count == 1]
            certificate = planar_patch_coverage(position_map, triangles, boundary, good[min(components[component_id]["faces"])][2])
            if Counter(boundary) != components[component_id]["boundary"]:
                certificate = {"passed": False, "reason": "proposed component changed its original boundary"}
            components[component_id]["certificate"]["proposedCoverage"] = certificate
            if not certificate["passed"]:
                rejected_output.add(component_id)
                components[component_id]["certificate"]["retainedOriginalFaceIds"] = sorted(components[component_id]["faces"])
        finally:
            bpy.data.meshes.remove(temporary)
    fallback_faces = {i for component_id in rejected_output for i in components[component_id]["faces"]}
    ids = sorted(accepted - {i for component_id in rejected_output for i in components[component_id]["vertices"]})
    bm.edges.index_update()
    edge_vertices = {}

    def edge_key(edge):
        vertices = tuple(vertex[original_vertex] for vertex in edge.verts)
        old = edge[original_edge] - 1
        key = ("old", old) if old >= 0 and set(vertices) == set(source_edges[old]) else ("new", edge.index)
        if key in edge_vertices and set(edge_vertices[key]) != set(vertices):
            raise RuntimeError("Native export edge provenance changed endpoints")
        edge_vertices[key] = vertices
        return key

    output_faces = [(face[original_face], [vertex[original_vertex] for vertex in face.verts],
                     [edge_key(loop.edge) for loop in face.loops]) for face in bm.faces if face[original_face] not in fallback_faces]
    output_faces.extend((i, source_faces[i], [("old", edge) for edge in source_corner_edges[i]]) for i in sorted(fallback_faces))
    survivors = sorted({i for _, face, _ in output_faces for i in face})
    output_index = {old: new for new, old in enumerate(survivors)}
    polygons, corner_edges, materials, smoothing, absolute_normals = [], [], [], [], []
    removed = set(ids)
    for old, vertex_ids, edge_keys in output_faces:
        unchanged = not removed.intersection(source_faces[old]) and set(vertex_ids) == set(source_faces[old])
        if unchanged:
            vertex_ids = source_faces[old]
            loops = source_loops[old]
            normal_values = [normals[i] for i in loops]
            edge_keys = [("old", edge) for edge in source_corner_edges[old]]
            for edge in source_corner_edges[old]:
                edge_vertices.setdefault(("old", edge), source_edges[edge])
        else:
            if old not in good:
                raise RuntimeError("A dissolve touched a nonconstant optical patch")
            normal_values = [good[old][1]] * len(vertex_ids)
        polygons.append([output_index[i] for i in vertex_ids])
        corner_edges.extend(edge_keys)
        materials.append(source_materials[old])
        smoothing.append(source_smooth[old])
        absolute_normals.extend(normal_values)
    bm.free()
    if open_edges:
        raise RuntimeError(f"Constant planar export compaction opened the solid: {open_edges} edges")
    used_edges = sorted(set(corner_edges))
    edge_index = {key: i for i, key in enumerate(used_edges)}
    mesh.clear_geometry()
    # from_pydata would merge distinct coincident edge charts. Preserve the
    # actual per-face edge identities, including untouched native diagonals.
    mesh.vertices.add(len(survivors))
    mesh.edges.add(len(used_edges))
    mesh.loops.add(sum(map(len, polygons)))
    mesh.polygons.add(len(polygons))
    mesh.vertices.foreach_set("co", [component for i in survivors for component in positions[i]])
    mesh.edges.foreach_set("vertices", [output_index[i] for key in used_edges for i in edge_vertices[key]])
    mesh.loops.foreach_set("vertex_index", [i for face in polygons for i in face])
    mesh.loops.foreach_set("edge_index", [edge_index[key] for key in corner_edges])
    starts, offset = [], 0
    for face in polygons:
        starts.append(offset)
        offset += len(face)
    mesh.polygons.foreach_set("loop_start", starts)
    mesh.polygons.foreach_set("loop_total", list(map(len, polygons)))
    mesh.update(calc_edges=False)
    for face, material, smooth in zip(mesh.polygons, materials, smoothing):
        face.material_index = material
        face.use_smooth = smooth
    for edge in mesh.edges:
        edge.use_edge_sharp = tuple(sorted(survivors[i] for i in edge.vertices)) in sharp_edges
    for old_attribute in list(mesh.color_attributes):
        mesh.color_attributes.remove(old_attribute)
    attribute = mesh.color_attributes.new(name="Baked bounce", type="BYTE_COLOR", domain="POINT")
    for value, old in zip(attribute.data, survivors):
        value.color = colors[old]
    mesh.color_attributes.active_color = attribute
    mesh.normals_split_custom_set([tuple(value) for value in absolute_normals])
    retained = mesh.attributes.new(EXACT_NORMAL_ATTRIBUTE, "FLOAT_VECTOR", "CORNER")
    for value, normal in zip(retained.data, absolute_normals):
        value.vector = normal
    mesh.update()
    mesh.calc_loop_triangles()
    final_check = bmesh.new()
    final_check.from_mesh(mesh)
    final_open_edges = sum(not edge.is_manifold for edge in final_check.edges)
    final_check.free()
    if final_open_edges:
        raise RuntimeError(f"Planar coverage fallback opened the export mesh: {final_open_edges} edges")
    return {
        "method": "Interior constant-color, constant-split-normal, single-material coplanar stars only",
        "before": before,
        "after": {"vertices": len(mesh.vertices), "triangles": len(mesh.loop_triangles)},
        "removedVertices": len(ids),
        "removedVertexIdsSha256": hashlib.sha256(json.dumps(ids, separators=(",", ":")).encode("ascii")).hexdigest(),
        "coverageComponents": certificates,
        "retainedOriginalCoverageCorridors": bridge_receipts,
        "retainedInvalidCoverageComponents": sum(not row["passed"] or not row.get("proposedCoverage", {"passed": True})["passed"] for row in certificates),
        "starPlanarityBoundM": 1e-6,
        "splitNormalBound": 1e-7,
        "emittedSplitNormalField": EXACT_NORMAL_ATTRIBUTE,
        "nonmanifoldEdges": final_open_edges,
        "contract": "No quantization or LOD change. Independent whole-surface3um and decoded/rendered controls remain required.",
    }
