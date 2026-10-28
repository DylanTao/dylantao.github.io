"""Read-only actual-surface controls for the capped spiral rail and hidden roof join."""
import hashlib
import json
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit_coastal_overlaps import is_inside

ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}


def geometry(obj):
    obj.data.calc_loop_triangles()
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    faces = [list(f.vertices) for f in obj.data.loop_triangles]
    return points, faces, BVHTree.FromPolygons(points, faces, all_triangles=True)


def manifold(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    count = sum(not e.is_manifold for e in bm.edges)
    bm.free()
    return count


def clip(subject, boundary):
    polygon = list(subject)
    area = sum(a[0]*b[1]-a[1]*b[0] for a, b in zip(boundary, boundary[1:]+boundary[:1]))
    if area < 0:
        boundary = boundary[::-1]
    for a, b in zip(boundary, boundary[1:]+boundary[:1]):
        result = []
        for p, q in zip(polygon, polygon[1:]+polygon[:1]):
            side = lambda r: (b[0]-a[0])*(r[1]-a[1])-(b[1]-a[1])*(r[0]-a[0])
            sp, sq = side(p), side(q)
            if sp >= 0:
                result.append(p)
            if (sp >= 0) != (sq >= 0):
                t = sp/(sp-sq)
                result.append((p[0]+t*(q[0]-p[0]), p[1]+t*(q[1]-p[1])))
        polygon = result
        if not polygon:
            break
    return polygon


def planar_roof_triangles(obj):
    points, faces, _ = geometry(obj)
    return [[tuple(points[i][:2]) for i in face] for face in faces
            if all(abs(points[i].z-5.17) < .001 for i in face)
            and (points[face[1]]-points[face[0]]).cross(points[face[2]]-points[face[0]]).z < -1e-10]


def main():
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("Use exact Blender4.5.9")
    source, manifest, output = [Path(ARGS[k]) for k in ("source", "manifest", "out")]
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()))
    scene = bpy.context.scene
    config = json.loads(manifest.read_text(encoding="utf-8"))
    rail = scene.objects["core_finish_bedroom_spiral__honey ash"]
    cabinet = scene.objects["sleep_reno_wardrobe__pale oak"]
    points, faces, rail_tree = geometry(rail)
    host_points, _, host = geometry(cabinet)
    probes = list(points)
    for face in faces:
        triangle = [points[i] for i in face]
        probes.extend([(a+b)/2 for a, b in zip(triangle, triangle[1:]+triangle[:1])])
        probes.append(sum(triangle, Vector())/3)
    failures, maximum_inside = [], 0.
    for point in probes:
        hit = host.find_nearest(point)
        if hit[3] > 3e-5 and is_inside(host, point):
            maximum_inside = max(maximum_inside, hit[3])
            failures.append({"native": list(point), "insideDepthM": hit[3]})
    caps = []
    definition = config["estateLibrary"]["adjacentBedchamber"]["wardrobeRailTermination"]
    for center in definition["nativeCapCenters"]:
        point = Vector(center)
        host_hit, rail_hit = host.find_nearest(point), rail_tree.find_nearest(point)
        row = {"native": center, "hostDistanceM": host_hit[3], "railDistanceM": rail_hit[3],
               "opposingFaceNormalDot": host_hit[1].dot(rail_hit[1])}
        caps.append(row)
        if max(host_hit[3], rail_hit[3]) > 3e-5 or row["opposingFaceNormalDot"] > -.999:
            failures.append({"cap": row})
    cabinet_top = max(p.z for p in host_points)
    rail_top = max(p.z for p in points)
    closed = {obj.name: manifold(obj) for obj in (rail, cabinet)}
    # The generic overlap audit tests open air only1.5mm beyond a face. This
    # patch has a separate real vault30mm below it, so prove concealment with
    # the complete actual overlap polygons and the actual vault triangles.
    roof = scene.objects["core_bathwing_liftaway_roof"]
    vault = scene.objects["core_finish_bedchamber_vault__chalk limestone"]
    _, _, vault_tree = geometry(vault)
    a = planar_roof_triangles(scene.objects["core__golden coastal sandstone"])
    b = planar_roof_triangles(roof)
    roof_samples, area, maximum_gap, roof_failures = 0, 0., 0., []
    for first in a:
        for second in b:
            polygon = clip(first, second)
            if len(polygon) < 3:
                continue
            patch_area = abs(sum(p[0]*q[1]-p[1]*q[0] for p, q in zip(polygon, polygon[1:]+polygon[:1])))/2
            if patch_area < 1e-8:
                continue
            area += patch_area
            center = tuple(sum(p[k] for p in polygon)/len(polygon) for k in (0, 1))
            samples = polygon + [tuple((p[k]+q[k])/2 for k in (0, 1)) for p, q in zip(polygon, polygon[1:]+polygon[:1])] + [center]
            for x, y in samples:
                hit = vault_tree.ray_cast(Vector((x, y, 5.169)), Vector((0, 0, -1)), .15)
                roof_samples += 1
                if hit[0] is None:
                    roof_failures.append([x, y, 5.169])
                else:
                    maximum_gap = max(maximum_gap, 5.17-hit[0].z)
    shared_cutaway = bool(roof.get("caveRoof") and vault.get("caveRoof"))
    reveal = None
    if config["estateLibrary"]["adjacentBedchamber"].get("roofReveal"):
        before_path = Path(ARGS["before"])
        with bpy.data.libraries.load(str(before_path.resolve()), link=False) as (_, loaded):
            loaded.objects = ["core_bathwing_liftaway_roof"]
        old = loaded.objects[0]
        old_points = [old.matrix_world@v.co for v in old.data.vertices]
        current_points = [roof.matrix_world@v.co for v in roof.data.vertices]
        expected = [Vector((p.x,p.y,5.178 if abs(p.z-5.17)<1e-5 else p.z)) for p in old_points]
        before_area = 0.
        for first in a:
            for second in planar_roof_triangles(old):
                polygon = clip(first,second)
                if len(polygon)>=3:
                    before_area += abs(sum(p[0]*q[1]-p[1]*q[0] for p,q in zip(polygon,polygon[1:]+polygon[:1])))/2
        reveal = {"beforeSourceSha256":hashlib.sha256(before_path.read_bytes()).hexdigest(),
            "beforeOverlapAreaM2":before_area,"afterOverlapAreaM2":area,
            "topologyIdentical": [list(f.vertices) for f in old.data.polygons]==[list(f.vertices) for f in roof.data.polygons],
            "maximumExpectedPositionErrorM":max((p-q).length for p,q in zip(expected,current_points)),
            "movedVertices":sum(p!=q for p,q in zip(old_points,current_points)),
            "physicalGapM":.008,"scope":"Every native vertex and polygon compared with the retained pre-reveal roof; only the5.17m underside rises8mm"}
    report = {"sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
              "manifestSha256": hashlib.sha256(manifest.read_bytes()).hexdigest(),
              "rail": {"surfaceProbes": len(probes), "maximumInsideDepthM": maximum_inside, "caps": caps,
                       "nonmanifoldEdges": closed, "cabinetTopNativeZ": cabinet_top, "railTopNativeZ": rail_top,
                       "guardInterval": "Actual closed wardrobe fills the contact interval and rises above the highest retained handrail"},
              "roofJoin": {"overlapAreaM2": area, "actualIntersectionPolygonProbes": roof_samples,
                          "maximumVaultGapM": maximum_gap, "cover": vault.name, "failures": roof_failures,
                          "bothRoofAndCoverUseCaveRoofCutaway": shared_cutaway,
                          "physicalReveal":reveal,
                          "scope": "Actual coplanar triangle intersections; a separate8mm physical reveal removes the double down-facing surface" if reveal else
                              "Diagnostic: complete actual overlap polygons against the separate vault; uncovered edges remain failures"},
              "failures": failures}
    roof_pass = (area < 1e-8 and reveal["beforeOverlapAreaM2"]>.35 and reveal["topologyIdentical"] and reveal["maximumExpectedPositionErrorM"]<1e-6) if reveal else (area>.35 and roof_samples>20)
    report["passed"] = not failures and not roof_failures and not any(closed.values()) and len(caps) == 4 and cabinet_top > rail_top and roof_pass and shared_cutaway
    output.write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps({"passed": report["passed"], "caps": len(caps), "roofAreaM2": area, "roofProbes": roof_samples, "failures": len(failures)+len(roof_failures)}), flush=True)
    if not report["passed"]:
        raise RuntimeError("Native rail/roof surface controls failed")


if __name__ == "__main__":
    main()
