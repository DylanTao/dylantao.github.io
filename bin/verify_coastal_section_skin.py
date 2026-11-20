"""Verify complete remote cliff lineage and the retessellated plateau in the arrival envelope.

Pass the original native, the sectioned native and a fresh JSON output after Blender's -- separator.
"""

from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

import bpy
import numpy as np

here = Path(__file__).resolve().parent
sys.path.insert(0, str(here))
from coastal_section_bays import BAYS, CLIFF, ARRIVAL, intersects


def data(prop, key, width, kind):
    out = np.empty(len(prop) * width, dtype=kind)
    prop.foreach_get(key, out)
    return out.reshape((len(prop), width))


def snapshot(filename):
    bpy.ops.wm.open_mainfile(filepath=str(filename.resolve()))
    obj = bpy.context.scene.objects[CLIFF]
    mesh = obj.data
    co = data(mesh.vertices, "co", 3, "<f4")
    normals = data(mesh.corner_normals, "vector", 3, "<f4")
    edges = data(mesh.loops, "vertex_index", 1, "<i4")[:, 0]
    uv = data(mesh.uv_layers["UVMap"].data, "uv", 2, "<f4")
    color = data(mesh.color_attributes["Baked contact and bounce"].data, "color", 4, "<f4")
    all_fields = np.concatenate((uv, color, normals), axis=1)
    position_signatures, region_count = {}, Counter()
    world = [obj.matrix_world @ v.co for v in mesh.vertices]
    for f in mesh.polygons:
        corners = list(f.loop_indices)
        points = [world[i] for i in f.vertices]
        far = not any(intersects(points, (lo, hi), 0.365) for bay, lo, hi, _ in BAYS if bay != "dressing")
        arrival = intersects(points, ARRIVAL, 0)
        if not (far or arrival):
            continue
        natural = [tuple(q + 0.0 for q in co[edges[i]]) for i in corners]
        first = min(range(len(natural)), key=lambda i: natural[i:] + natural[:i])
        stable = corners[first:] + corners[:first]
        key = struct.pack("<I", len(stable)) + co[edges[stable]].tobytes()
        identity = (mesh.materials[f.material_index].name, f.use_smooth)
        item = {
            "arrival": arrival,
            "far": far,
            "surface": identity,
            "attrs": all_fields[stable].copy(),
            "point": [round(c, 5) for c in f.center],
        }
        if key in position_signatures:
            raise ValueError(f"Duplicate directed faces in restricted native cliff: {item}")
        position_signatures[key] = item
    return position_signatures


def compare(ref, result, region):
    expected = {k: v for k, v in ref.items() if v[region]}
    observed = {k: v for k, v in result.items() if v[region]}
    common = expected.keys() & observed.keys()
    lost = expected.keys() - common
    added = observed.keys() - common
    out = {
        "facesBefore": len(expected),
        "facesAfter": len(observed),
        "sameFaceGeometry": len(common),
        "changedMaterialOrSmooth": 0,
        "changedUV": 0,
        "changedBounce": 0,
        "maxUV": 0.0,
        "maxBounce": 0.0,
        "angleChanged": 0,
        "maxNormalDegrees": 0.0,
        "maxNormalVectorChange": 0.0,
        "maximumExamples": {},
    }
    hashers = {"before": hashlib.sha256(), "after": hashlib.sha256()}
    for key in sorted(common):
        a, b = expected[key], observed[key]
        for which, record in (("before", a), ("after", b)):
            hashers[which].update(key)
            hashers[which].update(record["attrs"][:, :6].tobytes())
        u, v = a["attrs"], b["attrs"]
        amount = np.abs(u - v)
        uv = np.max(amount[:, :2])
        rgb = np.max(amount[:, 2:6])
        delta = np.max(np.linalg.norm(u[:, 6:] - v[:, 6:], axis=1))
        out["changedMaterialOrSmooth"] += a["surface"] != b["surface"]
        out["changedUV"] += bool(uv > 0)
        out["changedBounce"] += bool(rgb > 0)
        out["angleChanged"] += bool(delta > 1e-6)
        for key, value in (("maxUV", uv), ("maxBounce", rgb), ("maxNormalVectorChange", delta)):
            if value > out[key]:
                out[key] = float(value)
                out["maximumExamples"][key] = a["point"]
    out["maxNormalDegrees"] = math.degrees(2 * math.asin(min(1, out["maxNormalVectorChange"] / 2)))
    out["unmatched"] = {
        "lost": len(lost),
        "added": len(added),
        "examplesLost": [expected[key]["point"] for key in sorted(lost)[:10]],
        "examplesAdded": [observed[key]["point"] for key in sorted(added)[:10]],
    }
    out["lineage"] = {k: h.hexdigest() for k, h in hashers.items()}
    return out


def survey(filename):
    bpy.ops.wm.open_mainfile(filepath=str(filename.resolve()))
    obj = bpy.context.scene.objects[CLIFF]
    mesh = obj.data
    xyz = [obj.matrix_world @ v.co for v in mesh.vertices]
    uv, baked = mesh.uv_layers["UVMap"].data, mesh.color_attributes["Baked contact and bounce"].data
    normals = mesh.corner_normals
    selected = {}
    for f in mesh.polygons:
        vertices = [xyz[i] for i in f.vertices]
        if not intersects(vertices, ARRIVAL, 0):
            continue
        corners = [tuple(p) for p in vertices]
        identity = min(tuple(corners[i:] + corners[:i]) for i in range(len(corners)))
        selected[f.index] = identity
    mesh.calc_loop_triangles()
    records = {identity: [] for identity in selected.values()}
    for tri in mesh.loop_triangles:
        if tri.polygon_index not in selected:
            continue
        f = mesh.polygons[tri.polygon_index]
        coords = np.array([xyz[mesh.loops[i].vertex_index] for i in tri.loops], dtype=np.float64)
        fields = np.array([(*uv[i].uv, *baked[i].color, *normals[i].vector) for i in tri.loops], dtype=np.float64)
        props = {"material": mesh.materials[f.material_index].name, "smooth": bool(f.use_smooth)}
        records[selected[f.index]].append((coords, fields, props))
    return records


def signed(points):
    if len(points) < 3:
        return 0.0
    return 0.5 * sum(np.cross(a, b) for a, b in zip(points, points[1:] + points[:1]))


def ccw(points):
    return points if signed(points) >= 0 else list(reversed(points))


def clip(subject, bound):
    polygon = subject
    for a, b in zip(bound, bound[1:] + bound[:1]):
        if not polygon:
            break
        old = polygon
        polygon = []
        base = old[-1]
        d0 = np.cross(b - a, base - a)
        for point in old:
            d1 = np.cross(b - a, point - a)
            if (d0 < 0) != (d1 < 0):
                polygon.append(base + (point - base) * d0 / (d0 - d1))
            if d1 >= 0:
                polygon.append(point)
            base, d0 = point, d1
    return polygon


def attributes_at(points, attrs, place):
    coefs = np.linalg.solve(np.column_stack((points, np.ones(3))).T, [*place, 1])
    return coefs @ attrs


def plateau(original, section):
    reference, candidate = survey(original), survey(section)
    old = {k: reference[k] for k in reference if k not in candidate}
    new = {k: candidate[k] for k in candidate if k not in reference}
    if not old and not new:
        return {
            "exactPortFaces": len(reference),
            "originalFaces": len(reference),
            "clippedSymmetricDifference": 0,
            "clippedAreaBefore": 0,
            "maxUVDelta": 0,
            "maxBakedRGBA": 0,
            "maxNormalComponentDelta": 0,
        }
    limit = [
        np.array(p)
        for p in (
            (ARRIVAL[0][0], ARRIVAL[0][1]),
            (ARRIVAL[1][0], ARRIVAL[0][1]),
            (ARRIVAL[1][0], ARRIVAL[1][1]),
            (ARRIVAL[0][0], ARRIVAL[1][1]),
        )
    ]
    crop = lambda fragments: [
        (coords, attr, props, clip(ccw(list(coords[:, :2])), limit))
        for group in fragments.values()
        for coords, attr, props in group
    ]
    a, b = crop(old), crop(new)
    area_before = sum(abs(signed(poly)) for _, _, _, poly in a)
    area_after = sum(abs(signed(poly)) for _, _, _, poly in b)
    height = [float(v[2]) for pieces in (a, b) for coords, _, _, _ in pieces for v in coords]
    matched, total = 0.0, 0
    ranges = np.zeros(9)
    for c0, field0, style0, p0 in a:
        for c1, field1, style1, p1 in b:
            if not p0 or not p1:
                continue
            match = clip(p0, p1)
            area = abs(signed(match))
            if area < 1e-11:
                continue
            if style0 != style1:
                raise RuntimeError("Changed material or smoothing in protected seat " + str((style0, style1)))
            matched += area
            total += len(match)
            for point in match:
                left = attributes_at(c0[:, :2], field0, point)
                right = attributes_at(c1[:, :2], field1, point)
                ranges = np.maximum(ranges, np.abs(left - right))
    receipt = {
        "bounds": ARRIVAL,
        "exactPortFaces": len(reference.keys() & candidate.keys()),
        "originalFaces": len(reference),
        "changedBaselineFaces": [[list(v) for v in shape] for shape in old],
        "changedSectionFaces": [[list(v) for v in shape] for shape in new],
        "clippedAreaBefore": area_before,
        "clippedAreaAfter": area_after,
        "clippedAreaInCommon": matched,
        "clippedSymmetricDifference": abs(area_before + area_after - 2 * matched),
        "plateauHeight": [min(height), max(height)],
        "attributeVerticesCompared": total,
        "maxUVDelta": float(max(ranges[:2])),
        "maxBakedRGBA": float(max(ranges[2:6])),
        "maxNormalComponentDelta": float(max(ranges[6:])),
    }

    if (
        not height
        or min(height) != max(height)
        or receipt["clippedSymmetricDifference"] > 1e-8
        or receipt["maxUVDelta"] > 1e-6
        or receipt["maxBakedRGBA"] > 1e-6
        or receipt["maxNormalComponentDelta"] > 1e-5
    ):
        raise ValueError("The protected arrival's plateau or corner fields changed")
    return receipt


def main():
    baseline, candidate, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])
    ref, result = snapshot(baseline), snapshot(candidate)
    lineage = {k: compare(ref, result, k) for k in ("arrival", "far")}
    far = lineage["far"]
    if far["sameFaceGeometry"] != far["facesBefore"] or far["sameFaceGeometry"] != far["facesAfter"]:
        raise ValueError("Section cuts changed retained triangulation outside the two surveyed roof bays")
    for region in lineage.values():
        if (
            region["lineage"]["before"] != region["lineage"]["after"]
            or region["changedMaterialOrSmooth"]
            or region["maxNormalVectorChange"] > 1e-5
        ):
            raise ValueError("Section cuts changed the protected cliff finish")
    measured = plateau(baseline, candidate)
    receipt = {
        "sourceSha256": hashlib.sha256(baseline.read_bytes()).hexdigest(),
        "candidateSha256": hashlib.sha256(candidate.read_bytes()).hexdigest(),
        "lineage": lineage,
        "protectedPlateau": measured,
        "passed": True,
    }
    output.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf8", newline="\n")
    print(
        f"{far['sameFaceGeometry']:,} distant faces, {measured['originalFaces']:,} protected arrival faces", flush=True
    )


if __name__ == "__main__":
    main()
