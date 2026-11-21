"""Fit the retained distant Torrey pine crowns without rebuilding the hinterland.

Run with Blender 4.5.9. Save the new source and optional visitor export to separate
paths so the existing terrain, planting and baked colour fields can be compared.
"""

import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from coastal_hinterland_props import Batch, distant_pine_branches  # noqa: E402

FLORA = "hinterland_flora_"
SUPPORT = "hinterland_pine_support_"
TRUNK_MATERIAL = "hinterland pine trunk"
CROWN_MATERIAL = "hinterland scrub canopy"
BOUNCE = "Baked bounce"


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--blend", required=True, type=Path)
    parser.add_argument("--glb", type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    paths = [p.resolve() for p in (args.source, args.blend, args.glb, args.report) if p is not None]
    if len(set(paths)) != len(paths):
        parser.error("source, native output, export and report must have different paths")
    return args


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def mesh_state(objects):
    """Seal the positions, topology, transforms and delivered vertex colors of original objects."""
    rows = {}
    for obj in objects:
        if obj.type != "MESH":
            continue
        data = obj.data
        state = hashlib.sha256()
        for items, key, size, dtype in [
            (data.vertices, "co", 3, np.float32),
            (data.loops, "vertex_index", 1, np.int32),
            (data.polygons, "loop_start", 1, np.int32),
            (data.polygons, "loop_total", 1, np.int32),
            (data.polygons, "material_index", 1, np.int32),
            (data.polygons, "use_smooth", 1, np.bool_),
            (data.corner_normals, "vector", 3, np.float32),
        ]:
            values = np.empty(len(items) * size, dtype=dtype)
            items.foreach_get(key, values)
            state.update(values.tobytes())
        for attr in data.color_attributes:
            values = np.empty(4 * len(attr.data), dtype=np.float32)
            attr.data.foreach_get("color", values)
            state.update(attr.name.encode())
            state.update(values.tobytes())
        for layer in data.uv_layers:
            values = np.empty(2 * len(layer.uv), dtype=np.float32)
            layer.uv.foreach_get("vector", values)
            state.update(layer.name.encode())
            state.update(values.tobytes())
        rows[obj.name] = {
            "mesh": state.hexdigest(),
            "materials": [mat.name if mat is not None else None for mat in data.materials],
            "transform": [list(row) for row in obj.matrix_world],
        }
    return rows


def plant_islands(mesh):
    adjacency = defaultdict(set)
    for p in mesh.polygons:
        for i in p.vertices:
            adjacency[i].update(p.vertices)
    seen = set()
    owner = {}
    records = []
    for seed in range(len(mesh.vertices)):
        if seed in seen:
            continue
        indices = []
        pending = [seed]
        seen.add(seed)
        while pending:
            i = pending.pop()
            indices.append(i)
            for other in adjacency[i] - seen:
                seen.add(other)
                pending.append(other)
        row = {"vertices": sorted(indices), "faces": [], "materials": set()}
        for i in indices:
            owner[i] = row
        records.append(row)
    for p in mesh.polygons:
        row = owner[p.vertices[0]]
        row["faces"].append(p.index)
        row["materials"].add(mesh.materials[p.material_index].name)
    return records


def shape(row):
    return row["materials"], len(row["vertices"]), len(row["faces"])


def island_bvh(mesh, row, coords):
    ids = row["vertices"]
    slots = {vertex: slot for slot, vertex in enumerate(ids)}
    faces = [tuple(slots[index] for index in mesh.polygons[i].vertices) for i in row["faces"]]
    return BVHTree.FromPolygons([Vector(coords[index]) for index in ids], faces)


def cell_from_flora(obj):
    mesh = obj.data
    islands = plant_islands(mesh)
    color_data = mesh.color_attributes.get(BOUNCE)
    coords = np.asarray([tuple(obj.matrix_world @ vertex.co) for vertex in mesh.vertices], dtype=np.float64)
    batch = Batch()
    info = []
    for index, trunk in enumerate(islands):
        if shape(trunk) != ({TRUNK_MATERIAL}, 13, 20):
            continue
        crowns = islands[index + 1 : index + 5]
        source_ids = trunk["vertices"]
        ids = source_ids + [v for crown in crowns for v in crown["vertices"]]
        if (
            len(crowns) != 4
            or any(shape(crown) != ({CROWN_MATERIAL}, 12, 20) for crown in crowns)
            or ids != list(range(ids[0], ids[0] + 61))
        ):
            raise ValueError(f"{obj.name}: distant pine at vertex {ids[0]} lacks four ordered closed crowns")
        if not color_data or color_data.domain != "CORNER":
            raise ValueError(f"{obj.name}: original trunk is missing its corner bake")
        points = coords[source_ids]
        upper = points[4:8].mean(axis=0)
        fork = points[12]
        ring = points[8:12]
        fork_radius = float(np.linalg.norm(ring - fork, axis=1).mean())
        if np.linalg.norm(ring.mean(axis=0) - fork) > 0.00012:
            raise ValueError(f"{obj.name}: mismatched fork cap near vertex {ids[0]}")
        top_indices = set(source_ids[4:])
        loops = [
            j
            for face in trunk["faces"]
            for j in mesh.polygons[face].loop_indices
            if mesh.loops[j].vertex_index in top_indices
        ]
        color = np.asarray([tuple(color_data.data[j].color)[:3] for j in loops]).mean(axis=0)
        targets = [coords[crown["vertices"]] for crown in crowns]
        contacts = distant_pine_branches(batch, [upper, fork], fork_radius, targets, color=color)
        # Each end is a second real mesh overlap, not a nearby vertex or a screen-space join.
        trunk_tree = island_bvh(mesh, trunk, coords)
        probe = Vector((1, 0.31, 0.16)).normalized()
        for (start, end), crown in zip(contacts, crowns, strict=True):
            crown_tree = island_bvh(mesh, crown, coords)
            for index_point, (tree, endpoint) in enumerate(((trunk_tree, start), (crown_tree, end))):
                if any(tree.ray_cast(Vector(endpoint), sign * probe, 8)[0] is None for sign in (-1, 1)):
                    raise ValueError(
                        f"{obj.name}: {'fork' if index_point == 0 else 'crown'} contact failed at {ids[0]}"
                    )
        info.append(
            {
                "sourceVertex": ids[0],
                "fork": list(fork),
                "barkRadius": fork_radius,
                "joints": [{"stem": list(start), "crown": list(end)} for start, end in contacts],
            }
        )
    return batch, info


def fit():
    owners = sorted(
        (obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.name.startswith(FLORA)),
        key=lambda o: o.name,
    )
    existing = {obj.name for obj in bpy.context.scene.objects if obj.name.startswith(SUPPORT)}
    original = [obj for obj in bpy.context.scene.objects if obj.name not in existing]
    before = mesh_state(original)
    support_names = set()
    rows = []
    for owner in owners:
        batch, info = cell_from_flora(owner)
        if not info:
            continue
        name = SUPPORT + owner.name.removeprefix(FLORA)
        vertices, triangles, _, baked = batch.arrays()
        support_names.add(name)
        obj = bpy.data.objects.get(name)
        if obj is None:
            mesh = bpy.data.meshes.new(name)
            mesh.from_pydata(vertices, [], triangles)
            mesh.update()
            mesh.polygons.foreach_set("use_smooth", np.ones(len(triangles), dtype=np.bool_))
            mesh.materials.append(bpy.data.materials[TRUNK_MATERIAL])
            attr = mesh.color_attributes.new(BOUNCE, "BYTE_COLOR", "CORNER")
            indices = np.empty(len(mesh.loops), dtype=np.int32)
            mesh.loops.foreach_get("vertex_index", indices)
            rgba = np.column_stack([baked, np.ones(len(baked))]).astype(np.float32)
            attr.data.foreach_set("color", rgba[indices].ravel())
            mesh.color_attributes.active_color = attr
            obj = bpy.data.objects.new(name, mesh)
            owner.users_collection[0].objects.link(obj)
        else:
            # A freshly rebuilt file already owns the branch objects. The fitted structure is symmetric.
            actual = np.empty(len(obj.data.vertices) * 3, dtype=np.float32)
            obj.data.vertices.foreach_get("co", actual)
            if len(actual) != vertices.size or not np.allclose(actual.reshape(-1, 3), vertices, rtol=0, atol=0.00012):
                raise ValueError(f"{name} already has different support geometry")
            if [tuple(face.vertices) for face in obj.data.polygons] != [tuple(face) for face in triangles]:
                raise ValueError(f"{name} already has different support topology")
        rows.append(
            {"owner": owner.name, "support": name, "triangles": len(triangles), "trees": len(info), "fits": info}
        )
    if not rows or existing - support_names:
        raise ValueError("missing or unexpected pine support cells")
    bpy.context.view_layer.update()
    assert mesh_state(original) == before
    return before, rows


def main():
    args = parse_args()
    input_hash = digest(args.source)
    bpy.ops.wm.open_mainfile(filepath=str(args.source.resolve()))
    before, cells = fit()
    args.blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()), compress=True)
    bpy.ops.wm.open_mainfile(filepath=str(args.blend.resolve()))
    assert mesh_state(bpy.data.objects[name] for name in before) == before
    assert digest(args.source) == input_hash
    receipt = {
        "blender": bpy.app.version_string,
        "sourceSha256": input_hash,
        "blendSha256": digest(args.blend),
        "unchangedNativeMeshes": len(before),
        "supports": cells,
        "branches": 4 * sum(item["trees"] for item in cells),
        "triangles": sum(item["triangles"] for item in cells),
    }
    if args.glb:
        args.glb.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.object.select_all(action="DESELECT")
        for cell in cells:
            bpy.data.objects[cell["support"]].select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=str(args.glb.resolve()),
            export_format="GLB",
            use_selection=True,
            export_extras=True,
            export_cameras=False,
            export_lights=False,
            export_animations=False,
            export_texcoords=False,
            export_normals=True,
            export_vertex_color="ACTIVE",
            export_all_vertex_colors=False,
            export_image_format="NONE",
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=7,
            export_draco_position_quantization=16,
            export_draco_normal_quantization=10,
            export_draco_color_quantization=8,
        )
        receipt["supportsGLB"] = {"sha256": digest(args.glb), "bytes": args.glb.stat().st_size}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: receipt[k] for k in ("branches", "triangles", "unchangedNativeMeshes")}))


if __name__ == "__main__":
    main()
