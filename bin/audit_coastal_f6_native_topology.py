"""Read-only F6 native closure, explicit-edge and winding qualification.

Two incident faces alone do not establish an oriented closed surface. This
gate also checks directed adjacency, original edge records, and each connected
native component. It does not repair, weld, prune or normalize the input.
Run using the pinned Blender 4.5.9 Python.
"""

import argparse
import hashlib
import json
import sys
from collections import defaultdict, deque
from pathlib import Path

import bmesh
import bpy


OWNERS = (
    "core__golden coastal sandstone",
    "core_bathwing_liftaway_roof",
    "core_estate_library_liftaway_roof",
    "core_retreat_liftaway_roof",
    "core_liftaway_cave_ceiling",
)


def qualify(mesh):
    """Inspect actual native edge charts; keep coincident charts independent."""
    incidents = defaultdict(list)
    endpoint_failures = []
    for face in mesh.polygons:
        loops = list(face.loop_indices)
        for a, b in zip(loops, loops[1:] + loops[:1]):
            first, second = mesh.loops[a].vertex_index, mesh.loops[b].vertex_index
            edge = mesh.loops[a].edge_index
            if set(mesh.edges[edge].vertices) != {first, second}:
                endpoint_failures.append({"face": face.index, "loop": a, "edge": edge})
            incidents[edge].append((face.index, first, second))
    incidence_failures = [edge for edge in range(len(mesh.edges)) if len(incidents[edge]) != 2]
    winding_failures = []
    graph = defaultdict(set)
    for edge, faces in incidents.items():
        if len(faces) != 2:
            continue
        a, b = faces
        if (a[1], a[2]) != (b[2], b[1]):
            winding_failures.append({"edge": edge, "faces": [a[0], b[0]]})
        graph[a[0]].add(b[0])
        graph[b[0]].add(a[0])
    # Avoid handing corrupt RNA corner/edge endpoints to a fresh BMesh.
    if endpoint_failures:
        return {"passed": False, "endpointFailures": endpoint_failures,
                "incidenceFailures": incidence_failures, "windingFailures": winding_failures}
    bm = bmesh.new()
    bm.from_mesh(mesh)
    radial_count = sum(len(edge.link_faces) for edge in bm.edges)
    bad_vertices = sum(not vertex.is_manifold for vertex in bm.verts)
    bm.free()
    mesh.calc_loop_triangles()
    face_volume = defaultdict(float)
    zero_triangles = 0
    for triangle in mesh.loop_triangles:
        a, b, c = (tuple(mesh.vertices[i].co) for i in triangle.vertices)
        cross = (b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0])
        face_volume[triangle.polygon_index] += sum(a[k] * cross[k] for k in range(3)) / 6.0
        u, v = tuple(b[k] - a[k] for k in range(3)), tuple(c[k] - a[k] for k in range(3))
        zero_triangles += (u[1] * v[2] - u[2] * v[1] == 0.0 and
                           u[2] * v[0] - u[0] * v[2] == 0.0 and
                           u[0] * v[1] - u[1] * v[0] == 0.0)
    pending = set(range(len(mesh.polygons)))
    components = []
    while pending:
        start = pending.pop()
        queue = deque([start])
        faces = []
        while queue:
            at = queue.popleft()
            faces.append(at)
            for other in graph[at]:
                if other in pending:
                    pending.remove(other)
                    queue.append(other)
        components.append({"faces": len(faces), "signedVolumeM3": sum(face_volume[i] for i in faces)})
    passed = not (incidence_failures or winding_failures or bad_vertices)
    passed = passed and all(row["signedVolumeM3"] > 0 for row in components)
    return {
        "passed": passed, "endpointFailures": endpoint_failures,
        "incidenceFailures": incidence_failures, "windingFailures": winding_failures,
        "nonmanifoldVertices": bad_vertices, "freshRadialIncidences": radial_count,
        "components": components, "exactZeroNativeTrianglesRecordedNotPruned": zero_triangles,
    }


def self_test():
    # A flipped face leaves every edge with two incident faces. It must fail.
    vertices = [(0, 0, 0), (1, 0, 0), (0, 1, 0), (0, 0, 1)]
    faces = [(0, 2, 1), (0, 1, 3), (0, 3, 2), (1, 2, 3)]
    rows = {}
    for name, triangles in (("closed", faces), ("flipped", [faces[0][::-1]] + faces[1:]), ("open", faces[1:])):
        mesh = bpy.data.meshes.new("F6 topology regression " + name)
        mesh.from_pydata(vertices, [], triangles)
        mesh.update()
        rows[name] = qualify(mesh)
        bpy.data.meshes.remove(mesh)
    assert rows["closed"]["passed"]
    assert not rows["flipped"]["passed"] and not rows["flipped"]["incidenceFailures"]
    assert len(rows["flipped"]["windingFailures"]) == 3
    assert not rows["open"]["passed"] and len(rows["open"]["incidenceFailures"]) == 3
    return {"closedPass": True, "incidenceOnlyFalsePositiveRejected": True, "openRejected": True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("Requires exact Blender4.5.9")
    result = {"method": __doc__, "regression": self_test()}
    if args.source:
        result["sourceSha256"] = hashlib.sha256(args.source.read_bytes()).hexdigest()
        bpy.ops.wm.open_mainfile(filepath=str(args.source))
        result["owners"] = {name: qualify(bpy.data.objects[name].data) for name in OWNERS}
        result["passed"] = all(row["passed"] for row in result["owners"].values())
    else:
        if not args.self_test:
            parser.error("Specify --source or --self-test")
        result["passed"] = True
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")
    print("F6_NATIVE_ORIENTED_CLOSURE", result["passed"], flush=True)
    if not result["passed"]:
        raise RuntimeError("Native oriented closure failed; inspect retained report")


if __name__ == "__main__":
    main()
