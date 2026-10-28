"""Read-only geometric controls for the bounded retained-coast reconstruction.

Native coordinates are [x,-worldZ,up]. This checks actual triangles, including
protected remote coast and solid closure. Decoded checks remain independent.
"""
import hashlib
import json
import math
import numpy as np
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
PATCH_BOUNDS=None
BEARING_BOUNDS=None


def path(key, default):
    result = Path(ARGS.get(key, default))
    return result if result.is_absolute() else ROOT / result


def triangles(obj):
    obj.data.calc_loop_triangles()
    return [[obj.matrix_world @ obj.data.vertices[i].co for i in face.vertices] for face in obj.data.loop_triangles]


def in_changed_region(p):
    # Three explicit authored operations own these volumes. Surface controls
    # outside them must still lie on the old physical coast within 3 microns.
    reconstructed = -8.40 <= p[0] <= -4.89 and 4.57 <= p[1] <= 12.94 and -1.96 <= p[2] <= 3.16
    undercroft = -8.57 <= p[0] <= 8.09 and 2.04 <= p[1] <= 5.01 and -2.60 <= p[2] <= -.21
    upper_mass = p[2] >= 5.89 and p[1] >= -5.51
    operand=PATCH_BOUNDS and all(PATCH_BOUNDS[0][k]-1e-6<=p[k]<=PATCH_BOUNDS[1][k]+1e-6 for k in range(3))
    bearing=BEARING_BOUNDS and all(BEARING_BOUNDS[0][k]-1e-6<=p[k]<=BEARING_BOUNDS[1][k]+1e-6 for k in range(3))
    return reconstructed or undercroft or upper_mass or operand or bearing


def exact_triangle_key(points):
    return tuple(sorted(tuple(p) for p in points))


def triangle_distance(point, triangle):
    # Double-precision closest-point calculation after BVH candidate selection.
    # mathutils uses float32; at the coast's 80m extent its nearest point can
    # incur an 8um ULP even when the input surface is bit-identical.
    def sub(a,b):return tuple(x-y for x,y in zip(a,b))
    def dot(a,b):return sum(x*y for x,y in zip(a,b))
    def finish(at):return math.sqrt(sum((x-y)**2 for x,y in zip(point,at)))
    a,b,c=[tuple(v) for v in triangle];p=tuple(point)
    ab,ac,ap=sub(b,a),sub(c,a),sub(p,a);d1,d2=dot(ab,ap),dot(ac,ap)
    if d1<=0 and d2<=0:return finish(a)
    bp=sub(p,b);d3,d4=dot(ab,bp),dot(ac,bp)
    if d3>=0 and d4<=d3:return finish(b)
    vc=d1*d4-d3*d2
    if vc<=0 and d1>=0 and d3<=0:
        v=d1/(d1-d3);return finish(tuple(x+v*y for x,y in zip(a,ab)))
    cp=sub(p,c);d5,d6=dot(ab,cp),dot(ac,cp)
    if d6>=0 and d5<=d6:return finish(c)
    vb=d5*d2-d1*d6
    if vb<=0 and d2>=0 and d6<=0:
        w=d2/(d2-d6);return finish(tuple(x+w*y for x,y in zip(a,ac)))
    va=d3*d6-d5*d4
    if va<=0 and d4-d3>=0 and d5-d6>=0:
        w=(d4-d3)/((d4-d3)+(d5-d6));return finish(tuple(x+w*y for x,y in zip(b,sub(c,b))))
    denominator=va+vb+vc
    if abs(denominator)<1e-24:return min(finish(a),finish(b),finish(c))
    v,w=vb/denominator,vc/denominator
    return finish(tuple(x+v*y+w*z for x,y,z in zip(a,ab,ac)))


def main():
    global PATCH_BOUNDS, BEARING_BOUNDS
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("Use exact Blender 4.5.9")
    baseline = path("baseline", "artwork/coastal-home/coastal-home.blend")
    source = path("source", ".jekyll-cache/visual-qa/finish-house-2026-10-26/attempts/v18/candidate.blend")
    output = path("out", ".jekyll-cache/visual-qa/finish-house-2026-10-26/architecture-controls.json")
    # This archived input is saved BEFORE the local union, not inferred from
    # final deviations. It still contains the exact historically clipped input.
    operand_source=path("operand",str(source.parent/"coast-local-operand.blend"))
    bpy.ops.wm.open_mainfile(filepath=str(operand_source))
    addition=next(o for o in bpy.context.scene.objects if o.name.startswith("coast_finish_recontoured_terrace_notch__"))
    points=[addition.matrix_world@v.co for v in addition.data.vertices]
    addition_bounds=([min(p[k] for p in points) for k in range(3)],[max(p[k] for p in points) for k in range(3)])
    PATCH_BOUNDS=([v-.12 for v in addition_bounds[0]],[v+.12 for v in addition_bounds[1]])
    assert all(addition_bounds[0][k]>=(-8.491,4.479,-2.051)[k] for k in range(3))
    assert all(addition_bounds[1][k]<=(-4.799,13.031,3.151)[k] for k in range(3))
    bearing_source=path("bearing",str(source.parent/"bearing-recess-input.json"))
    if bearing_source.exists():
        construction=json.loads(bearing_source.read_text(encoding="utf-8"))
        assert construction["beforeSourceOperation"] is True
        assert construction["existingBearingNativeZ"] == -1.72
        lo,hi=construction["nativeBounds"]["min"],construction["nativeBounds"]["max"]
        assert all(lo[k]>=(-8.07,-1.37,-1.721)[k] for k in range(3))
        assert all(hi[k]<=(3.27,3.92,.061)[k] for k in range(3))
        BEARING_BOUNDS=([v-.02 for v in lo],[v+.02 for v in hi])
    bpy.ops.wm.open_mainfile(filepath=str(baseline))
    name = ARGS.get("mesh", "coast_shared_golden coastal sandstone")
    original = triangles(bpy.context.scene.objects[name])
    bpy.ops.wm.open_mainfile(filepath=str(source))
    obj = bpy.context.scene.objects[name]
    current = triangles(obj)
    def mesh_bounds(faces):
        return [[fn(point[k] for face in faces for point in face) for k in range(3)] for fn in (min, max)]
    baseline_bounds, source_bounds = mesh_bounds(original), mesh_bounds(current)
    identical = {exact_triangle_key(points) for points in current}
    coordinates=np.asarray(current,dtype=np.float64)
    lower,upper=coordinates.min(axis=1),coordinates.max(axis=1)
    vertices = [point for triangle in current for point in triangle]
    tree = BVHTree.FromPolygons(vertices, [tuple(range(i, i+3)) for i in range(0,len(vertices),3)])
    failures, maximum, samples, exact_faces = [], 0., 0, 0
    range_corrections=0; maximum_kernel_error=0.
    for face, points in enumerate(original):
        # An edge/face spanning an edited region is not an unchanged control.
        probes = [tuple(point) for point in points] + [tuple((a[k]+b[k])/2 for k in range(3)) for a,b in zip(points,points[1:]+points[:1])] + [tuple(sum(point[k] for point in points)/3 for k in range(3))]
        if "--all-surface" not in sys.argv and any(in_changed_region(point) for point in probes):
            continue
        if exact_triangle_key(points) in identical:
            exact_faces+=1;samples+=len(probes)
            continue
        for point in probes:
            nearest = tree.find_nearest(point)
            error = triangle_distance(point,current[nearest[2]]) if nearest[0] is not None else float("inf")
            if error>3e-6 and nearest[0] is not None:
                # Blender's float32 nearest kernel misprojects long narrow
                # triangles (the unchanged source centroid control reproduces
                # 1.557mm). Select all triangle bounds, then perform the actual
                # point/triangle distance in double precision. The physical
                # acceptance bound stays three micrometres.
                # Any triangle within3um must have its AABB within3um too.
                # This exhaustive bound query avoids the same inaccurate
                # float32 closest-point kernel used by nearest_range.
                query=np.asarray(point,dtype=np.float64)
                candidates=np.flatnonzero(np.all(lower<=query+3e-6,axis=1)&np.all(upper>=query-3e-6,axis=1))
                corrected=min([error]+[triangle_distance(point,current[int(index)]) for index in candidates])
                if corrected<error:
                    range_corrections+=1;maximum_kernel_error=max(maximum_kernel_error,error-corrected)
                error=corrected
            maximum = max(maximum,error); samples += 1
            if error > 3e-6:
                failures.append({"face":face,"point":list(point),"distanceM":error})
    closure=[]
    for mesh in bpy.context.scene.objects:
        if mesh.type!="MESH" or not (mesh.name in (name,"core__golden coastal sandstone") or mesh.name.startswith("core_finish_bedchamber")):
            continue
        bm=bmesh.new();bm.from_mesh(mesh.data)
        boundary=sum(e.is_boundary for e in bm.edges); nonmanifold=sum(not e.is_manifold for e in bm.edges)
        closure.append({"mesh":mesh.name,"boundaryEdges":boundary,"nonmanifoldEdges":nonmanifold})
        bm.free()
    failures.sort(key=lambda row:-row["distanceM"])
    report={"mesh":name,"sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest(),
            "baselineSha256":hashlib.sha256(baseline.read_bytes()).hexdigest(),
            "preUnionOperandSourceSha256":hashlib.sha256(operand_source.read_bytes()).hexdigest(),
            "preUnionAdditionBounds":{"min":addition_bounds[0],"max":addition_bounds[1]},
            "preUnionWorkingBounds":{"min":PATCH_BOUNDS[0],"max":PATCH_BOUNDS[1]},
            "preCutStructuralBearingBounds": None if BEARING_BOUNDS is None else {"min":BEARING_BOUNDS[0],"max":BEARING_BOUNDS[1]},
            "allSurfaceControl":"--all-surface" in sys.argv,
            "baselineBounds":baseline_bounds,"sourceBounds":source_bounds,"exactBounds":baseline_bounds==source_bounds,
            "authoredTransition":"No excluded regions: every source triangle is a control against the retained candidate" if "--all-surface" in sys.argv else "100mm bedrock/side embed, clipped to the exact public historical silhouette; a120mm working margin. Bounds measured from the archived input before union, not from resulting deviations.",
            "coordinates":"native [x,-worldZ,up] metres", "unchangedCoastSamples":samples,
            "maximumUnchangedSurfaceDistanceM":maximum,"toleranceM":3e-6,"bitIdenticalUnchangedTriangles":exact_faces,
            "doublePrecisionCandidateCorrections":range_corrections,"maximumFloat32KernelErrorM":maximum_kernel_error,
            "unchangedCoastFailures":failures[:100],"unchangedCoastFailureCount":len(failures),
            "closedSolids":closure,"passed":not failures and all(not row["nonmanifoldEdges"] for row in closure)
                and ("--all-surface" not in sys.argv or baseline_bounds==source_bounds)}
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8",newline="\n")
    print(json.dumps({"passed":report["passed"],"samples":samples,"maxErrorM":maximum,"failures":len(failures)}),flush=True)
    if not report["passed"]:raise RuntimeError("Retained-coast geometric controls failed; see bound report")


if __name__=="__main__":main()
