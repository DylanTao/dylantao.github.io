"""Read-only, bidirectional controls for the lossless planar export copy.

Compare the actual prepared export mesh with the native authoring mesh after
the independently reproduced, existing emitted-color quantization. Every
triangle contributes its corners, edge midpoints and centroid; unchanged
triangles use exact corner-field identity. No region is excluded.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit_coastal_architecture_finish import triangle_distance


ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
TOLERANCE = 3e-6


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot(path, name, quantize=False):
    bpy.ops.wm.open_mainfile(filepath=str(path.resolve()))
    obj = bpy.context.scene.objects[name]
    mesh = obj.data
    color = mesh.color_attributes.active_color
    if quantize:
        if color.domain != "CORNER":
            raise RuntimeError("Expected retained native CORNER bake field")
        sums, counts = [0.] * len(mesh.vertices), [0] * len(mesh.vertices)
        for loop, value in zip(mesh.loops, color.data):
            sums[loop.vertex_index] += sum(value.color[:3]) / 3
            counts[loop.vertex_index] += 1
        for attribute in list(mesh.color_attributes):
            mesh.color_attributes.remove(attribute)
        color = mesh.color_attributes.new(name="Baked bounce", type="BYTE_COLOR", domain="POINT")
        for i, value in enumerate(color.data):
            v = round(sums[i] / max(1, counts[i]) * 32) / 32
            value.color = (v, v, v, 1)
        mesh.color_attributes.active_color = color
    if color.domain != "POINT" or mesh.color_attributes.active_color != color:
        raise RuntimeError("Prepared export must emit its active POINT bake field")
    points = [tuple(obj.matrix_world @ vertex.co) for vertex in mesh.vertices]
    exact_normals = mesh.attributes.get("Export exact split normal")
    normals = [tuple(value.vector) for value in (exact_normals.data if exact_normals else mesh.corner_normals)]
    colors = [tuple(value.color) for value in color.data]
    mesh.calc_loop_triangles()
    triangles = [{"p": [points[i] for i in face.vertices],
                  "n": [normals[i] for i in face.loops],
                  "c": [colors[i] for i in face.vertices],
                  "m": mesh.materials[face.material_index].name}
                 for face in mesh.loop_triangles]
    bm = bmesh.new()
    bm.from_mesh(mesh)
    nonmanifold = sum(not edge.is_manifold for edge in bm.edges)
    bm.free()
    return {"points": points, "triangles": triangles,
            "bounds": [[min(p[k] for p in points) for k in range(3)], [max(p[k] for p in points) for k in range(3)]],
            "nonmanifoldEdges": nonmanifold, "activeColor": color.name}


def key(face):
    return tuple(sorted(face["p"]))


def field(face, weights, kind):
    return tuple(sum(weights[i] * face[kind][i][k] for i in range(3)) for k in range(len(face[kind][0])))


def weights(point, triangle):
    a, b, c = [tuple(v) for v in triangle]
    ab, ac, ap = [[x-y for x, y in zip(v, a)] for v in (b, c, point)]
    dot = lambda v, w: sum(x*y for x, y in zip(v, w))
    d00, d01, d11, d20, d21 = dot(ab, ab), dot(ab, ac), dot(ac, ac), dot(ap, ab), dot(ap, ac)
    denominator = d00*d11-d01*d01
    if abs(denominator) < 1e-24:
        nearest = min(range(3), key=lambda i: math.dist(point, triangle[i]))
        return tuple(float(i == nearest) for i in range(3))
    v, w = (d11*d20-d01*d21)/denominator, (d00*d21-d01*d20)/denominator
    # At a quantized edge the accepted closest point can lie a few microns
    # beyond a very slender triangle. Evaluate its boundary field instead of
    # extrapolating tiny corner-normal differences with enormous weights.
    values = [max(0., min(1., x)) for x in (1-v-w, v, w)]
    total = sum(values)
    return tuple(x/total for x in values)


def compare(source, target):
    exact = {}
    for face in target["triangles"]:
        # Closed retained islands can have coincident internal faces with
        # different orientations. Keep every optical field at those positions.
        exact.setdefault(key(face), []).append(face)
    vertices = [p for face in target["triangles"] for p in face["p"]]
    coordinates = np.asarray([face["p"] for face in target["triangles"]], dtype=np.float64)
    lower, upper = coordinates.min(axis=1), coordinates.max(axis=1)
    tree = BVHTree.FromPolygons(vertices, [tuple(range(i, i+3)) for i in range(0, len(vertices), 3)], all_triangles=True)
    probes = [(1., 0., 0.), (0., 1., 0.), (0., 0., 1.), (.5, .5, 0.), (0., .5, .5), (.5, 0., .5), (1/3, 1/3, 1/3)]
    result = {"triangles": len(source["triangles"]), "samples": 0, "exactTriangles": 0,
              "maximumSurfaceDistanceM": 0., "maximumSplitNormalError": 0., "maximumColorError": 0., "failures": []}
    for index, face in enumerate(source["triangles"]):
        exact_match = False
        for matched in exact.get(key(face), []):
            if matched["m"] != face["m"]:
                continue
            mapping = [matched["p"].index(p) for p in face["p"]]
            normal_error = max(math.dist(face["n"][i], matched["n"][mapping[i]]) for i in range(3))
            color_error = max(max(abs(a-b) for a, b in zip(face["c"][i], matched["c"][mapping[i]])) for i in range(3))
            if normal_error <= 1e-6 and color_error <= 1e-7:
                result["exactTriangles"] += 1
                result["samples"] += 7
                result["maximumSplitNormalError"] = max(result["maximumSplitNormalError"], normal_error)
                result["maximumColorError"] = max(result["maximumColorError"], color_error)
                exact_match = True
                break
        if exact_match:
            continue
        for barycentric in probes:
            point = tuple(sum(barycentric[i] * face["p"][i][k] for i in range(3)) for k in range(3))
            nearest = tree.find_nearest(Vector(point))
            candidates = {nearest[2]} if nearest[0] is not None else set()
            candidates.update(hit[2] for hit in tree.find_nearest_range(Vector(point), TOLERANCE * 2))
            # The retained80m mesh reproduces float32 nearest-kernel errors
            # even on bit-identical slender triangles. The bound query is
            # exhaustive in float64 and leaves the3um physical bound intact.
            if nearest[0] is None or triangle_distance(point, target["triangles"][nearest[2]]["p"]) > TOLERANCE:
                query = np.asarray(point, dtype=np.float64)
                candidates.update(int(i) for i in np.flatnonzero(np.all(lower <= query + TOLERANCE, axis=1) & np.all(upper >= query - TOLERANCE, axis=1)))
            def choose(indices, best=None):
                for candidate in indices:
                    other = target["triangles"][candidate]
                    distance = triangle_distance(point, other["p"])
                    if distance > TOLERANCE or other["m"] != face["m"]:
                        continue
                    w = weights(point, other["p"])
                    ne = math.dist(field(face, barycentric, "n"), field(other, w, "n"))
                    ce = max(abs(a-b) for a, b in zip(field(face, barycentric, "c"), field(other, w, "c")))
                    score = max(distance/TOLERANCE, ne/1e-6, ce/1e-7)
                    if best is None or score < best[0]:
                        best = (score, distance, ne, ce)
                return best
            best = choose(candidates)
            if best is None or best[0] > 1.:
                query = np.asarray(point, dtype=np.float64)
                exhaustive = np.flatnonzero(np.all(lower <= query + TOLERANCE, axis=1) & np.all(upper >= query - TOLERANCE, axis=1))
                best = choose((int(i) for i in exhaustive), best)
            result["samples"] += 1
            if best is None:
                error = triangle_distance(point, target["triangles"][nearest[2]]["p"]) if nearest[0] is not None else math.inf
                result["maximumSurfaceDistanceM"] = max(result["maximumSurfaceDistanceM"], error)
                result["failures"].append({"triangle": index, "point": point, "nearestDistanceM": error})
                continue
            for label, value in zip(("maximumSurfaceDistanceM", "maximumSplitNormalError", "maximumColorError"), best[1:]):
                result[label] = max(result[label], value)
            if best[0] > 1.:
                result["failures"].append({"triangle": index, "point": point, "distanceM": best[1], "normalError": best[2], "colorError": best[3]})
    result["failureCount"] = len(result["failures"])
    result["failures"] = result["failures"][:30]
    return result


def main():
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("Use exact Blender 4.5.9")
    source, prepared, output = [Path(ARGS[k]) for k in ("source", "prepared", "out")]
    name = ARGS.get("mesh", "core__golden coastal sandstone")
    original, compacted = snapshot(source, name, True), snapshot(prepared, name)
    forward, reverse = compare(original, compacted), compare(compacted, original)
    bounds_equal = original["bounds"] == compacted["bounds"]
    retained_vertices = set(compacted["points"]).issubset(set(original["points"]))
    report = {"sourceSha256": digest(source), "preparedSha256": digest(prepared), "mesh": name,
              "scope": "Every triangle in both directions, no excluded regions; exact triangle fields or seven whole-surface probes per triangle",
              "surfaceToleranceM": TOLERANCE, "splitNormalTolerance": 1e-6, "colorTolerance": 1e-7,
              "bounds": original["bounds"], "exactBounds": bounds_equal, "allExportVerticesFromSource": retained_vertices,
              "nonmanifoldEdges": [original["nonmanifoldEdges"], compacted["nonmanifoldEdges"]],
              "sourceToExport": forward, "exportToSource": reverse}
    report["passed"] = bounds_equal and retained_vertices and not any(report["nonmanifoldEdges"]) and not forward["failureCount"] and not reverse["failureCount"]
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"passed": report["passed"], "output": str(output), "counts": [forward["failureCount"], reverse["failureCount"]]}), flush=True)
    if not report["passed"]:
        raise RuntimeError("Lossless export controls failed")


if __name__ == "__main__":
    main()
