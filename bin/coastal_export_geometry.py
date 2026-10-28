"""Lossless removal of constant planar export tessellation.

The high-resolution authoring mesh stays intact. A removable interior vertex
must lie in a complete coplanar star with one material, one emitted color and
one split normal. Curves, color gradients, normal gradients and creases remain.
"""
import hashlib
import json

import bmesh


EXACT_NORMAL_ATTRIBUTE = "Export exact split normal"


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
    attribute = mesh.color_attributes.active_color
    if attribute is None or attribute.domain != "POINT":
        raise RuntimeError("Planar export compaction requires the emitted POINT color field")
    mesh.calc_loop_triangles()
    before = {"vertices": len(mesh.vertices), "triangles": len(mesh.loop_triangles)}
    positions = [vertex.co.copy() for vertex in mesh.vertices]
    source_faces = [list(face.vertices) for face in mesh.polygons]
    source_loops = [list(face.loop_indices) for face in mesh.polygons]
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
    ids = sorted(vertex.index for vertex in candidates)
    original_vertex = bm.verts.layers.int.new("Export original vertex")
    original_face = bm.faces.layers.int.new("Export original face")
    for vertex in bm.verts:
        vertex[original_vertex] = vertex.index
    for face in bm.faces:
        face[original_face] = face.index
    bmesh.ops.dissolve_verts(bm, verts=[bm.verts[i] for i in ids], use_face_split=False, use_boundary_tear=False)
    open_edges = sum(not edge.is_manifold for edge in bm.edges)
    # A BMesh round trip rotates unrelated n-gon loops and reinterprets packed
    # split normals against a changed fan. Keep every unaffected polygon's
    # original order, smoothing, and absolute corner normal instead. New faces
    # belong only to the already-proved constant optical planar patches.
    survivors = sorted(vertex[original_vertex] for vertex in bm.verts)
    output_index = {old: new for new, old in enumerate(survivors)}
    polygons, materials, smoothing, absolute_normals = [], [], [], []
    removed = set(ids)
    for face in bm.faces:
        old = face[original_face]
        vertex_ids = [vertex[original_vertex] for vertex in face.verts]
        unchanged = not removed.intersection(source_faces[old]) and set(vertex_ids) == set(source_faces[old])
        if unchanged:
            vertex_ids = source_faces[old]
            loops = source_loops[old]
            normal_values = [normals[i] for i in loops]
        else:
            if old not in good:
                raise RuntimeError("A dissolve touched a nonconstant optical patch")
            normal_values = [good[old][1]] * len(vertex_ids)
        polygons.append([output_index[i] for i in vertex_ids])
        materials.append(source_materials[old])
        smoothing.append(source_smooth[old])
        absolute_normals.extend(normal_values)
    bm.free()
    if open_edges:
        raise RuntimeError(f"Constant planar export compaction opened the solid: {open_edges} edges")
    mesh.clear_geometry()
    mesh.from_pydata([positions[i] for i in survivors], [], polygons)
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
    return {
        "method": "Interior constant-color, constant-split-normal, single-material coplanar stars only",
        "before": before,
        "after": {"vertices": len(mesh.vertices), "triangles": len(mesh.loop_triangles)},
        "removedVertices": len(ids),
        "removedVertexIdsSha256": hashlib.sha256(json.dumps(ids, separators=(",", ":")).encode("ascii")).hexdigest(),
        "starPlanarityBoundM": 1e-6,
        "splitNormalBound": 1e-7,
        "emittedSplitNormalField": EXACT_NORMAL_ATTRIBUTE,
        "nonmanifoldEdges": open_edges,
        "contract": "No quantization or LOD change. Independent whole-surface3um and decoded/rendered controls remain required.",
    }
