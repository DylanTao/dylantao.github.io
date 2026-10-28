"""Measure closed-solid intersection volumes; never assign a volume to open surfaces.

Run with Blender 4.5.9, e.g. ``--background -t 8 --python-exit-code 1 --python
bin/audit_coastal_overlap_volume.py -- --source=... --out=...``. ``--delivered=1``
uses the decoded deliveries and ``--self-test=1`` runs the analytic control solids.
The older overlap audit remains the independent visible seam/depth acceptance gate.
"""
import hashlib
import json
import sys
import time
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import audit_coastal_overlaps as contacts

ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}


def topology(mesh):
    """Conservative eligibility, independent of a Boolean's returned volume."""
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    # Exporters split vertices at shading/material seams. This sub-micron weld
    # restores identical positions; it cannot close a visible crack or hole.
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bm.normal_update()
    boundary = sum(e.is_boundary for e in bm.edges)
    nonmanifold = sum(not e.is_manifold for e in bm.edges)
    inconsistent = sum(e.is_manifold and not e.is_contiguous for e in bm.edges)
    degenerate = sum(f.calc_area() <= 1e-12 for f in bm.faces)
    bm.verts.index_update()
    bm.faces.index_update()
    tree = BVHTree.FromBMesh(bm)
    # Nonadjacent intersecting triangles make a solid ambiguous. Reject rather
    # than silently summing overlapping pieces inside a material batch.
    faces = list(bm.faces)
    pending = set(faces)
    component_volumes = []
    while pending:
        seed = pending.pop()
        component, stack = [seed], [seed]
        while stack:
            for edge in stack.pop().edges:
                for face in edge.link_faces:
                    if face in pending:
                        pending.remove(face)
                        component.append(face)
                        stack.append(face)
        signed = 0.
        for face in component:
            vertices = [v.co for v in face.verts]
            signed += sum(vertices[0].dot(vertices[k].cross(vertices[k + 1])) / 6
                          for k in range(1, len(vertices) - 1))
        component_volumes.append(signed)
    inverted = sum(v < -1e-10 for v in component_volumes)
    self_crossings = []
    for a, b in tree.overlap(tree):
        if a >= b or set(faces[a].verts).intersection(faces[b].verts):
            continue
        self_crossings.append([a, b])
        if len(self_crossings) == 16:
            break
    volume = sum(component_volumes) if not nonmanifold and not inconsistent and not inverted else None
    result = {"vertices": len(bm.verts), "faces": len(bm.faces), "boundaryEdges": boundary,
              "nonmanifoldEdges": nonmanifold, "inconsistentEdges": inconsistent,
              "degenerateFaces": degenerate, "possibleSelfIntersectionExamples": self_crossings,
              "componentCount": len(component_volumes), "invertedComponents": inverted,
              "volumeM3": volume}
    result["eligible"] = bool(bm.faces) and not (nonmanifold or inconsistent or degenerate or self_crossings or inverted)
    bm.free()
    return result


def make_object(name, vertices, faces):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def remove(obj):
    mesh = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if not mesh.users:
        bpy.data.meshes.remove(mesh)


def intersection(a, b):
    obj = bpy.data.objects.new("volume intersection", a.data.copy())
    bpy.context.scene.collection.objects.link(obj)
    modifier = obj.modifiers.new("Exact solid intersection", "BOOLEAN")
    modifier.operation = "INTERSECT"
    modifier.solver = "EXACT"
    modifier.object = b
    modifier.use_self = False
    modifier.use_hole_tolerant = False
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    result = topology(mesh) if mesh.polygons else {"eligible": True, "volumeM3": 0., "faces": 0}
    bpy.data.meshes.remove(mesh)
    remove(obj)
    return {"volumeM3": result.get("volumeM3") if result["eligible"] else None,
            "valid": result["eligible"], "outputTopology": result}


def cube(name, lo, hi, open_top=False):
    vertices = [(x, y, z) for z in (lo[2], hi[2]) for y in (lo[1], hi[1]) for x in (lo[0], hi[0])]
    faces = [(0, 2, 3, 1), (0, 1, 5, 4), (1, 3, 7, 5), (3, 2, 6, 7), (2, 0, 4, 6)]
    if not open_top:
        faces.append((4, 5, 7, 6))
    return make_object(name, vertices, faces)


def self_test():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    a = cube("control A", (0, 0, 0), (2, 2, 2))
    b = cube("overlap B", (1, 1, 1), (3, 3, 3))
    c = cube("touching C", (2, 0, 0), (3, 1, 1))
    d = cube("disjoint D", (4, 4, 4), (5, 5, 5))
    opened = cube("open control", (0, 0, 0), (1, 1, 1), True)
    cases = []
    for target, expected in ((b, 1.), (c, 0.), (d, 0.), (a, 8.)):
        result = intersection(a, target)
        assert result["valid"] and abs(result["volumeM3"] - expected) < 1e-7, result
        cases.append({"name": target.name, "expectedM3": expected, **result})
    invalid = topology(opened.data)
    assert not invalid["eligible"] and invalid["boundaryEdges"] == 4, invalid
    return {"passed": True, "closedControls": cases, "openControl": invalid}


def main():
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("Use exact Blender 4.5.9")
    out = Path(ARGS.get("out", str(ROOT / ".jekyll-cache/overlap-audit/volume.json")))
    if ARGS.get("self-test") == "1":
        report = self_test()
    else:
        started = time.time()
        config = json.loads(contacts.MANIFEST.read_text(encoding="utf-8"))
        if contacts.DELIVERED:
            bpy.ops.wm.read_factory_settings(use_empty=True)
            contacts.import_delivered(bpy.context.scene, config)
        else:
            bpy.ops.wm.open_mainfile(filepath=str(contacts.SOURCE))
        furniture = contacts.import_furniture(bpy.context.scene, config) if contacts.FURNITURE else []
        meshes, skipped = contacts.collect(bpy.context.scene)
        solids, inventory = [], []
        for data in meshes:
            obj = make_object("volume input/" + data["name"], data["co"].tolist(), data["tri"].tolist())
            eligibility = topology(obj.data)
            inventory.append({"mesh": data["name"], "category": data["category"], **eligibility})
            if eligibility["eligible"]:
                solids.append((obj, data, eligibility))
            else:
                remove(obj)
        pairs, rejected = [], []
        for i, (a, da, ta) in enumerate(solids):
            for b, db, tb in solids[i + 1:]:
                if (da["hi"] <= db["lo"]).any() or (db["hi"] <= da["lo"]).any():
                    continue
                if da.get("bedding") and db.get("bedding") and da["bedding"] != db["bedding"]:
                    continue
                result = intersection(a, b)
                record = {"a": da["name"], "b": db["name"], **result}
                if not result["valid"]:
                    rejected.append(record)
                elif result["volumeM3"] > 1e-9:
                    pairs.append(record)
        pairs.sort(key=lambda p: -p["volumeM3"])
        report = {"tool": "bin/audit_coastal_overlap_volume.py",
                  "toolSha256": hashlib.sha256(Path(__file__).read_bytes().replace(b"\r\n", b"\n")).hexdigest(),
                  "sourceSha256": contacts.sha256(contacts.SOURCE),
                  "manifestSha256": contacts.sha256(contacts.MANIFEST), "delivered": contacts.DELIVERED,
                  "scope": "Exact Boolean intersection of topologically closed, consistently oriented, nondegenerate meshes without detected nonadjacent self intersections. Open or ambiguous material batches have no assigned solid volume; visible seam/depth audit remains separate.",
                  "units": "cubic metres", "weldToleranceM": 1e-7, "inventory": inventory,
                  "excludedBeforeMeasurement": skipped, "furniture": furniture,
                  "eligibleSolidCount": len(solids), "nonzeroIntersections": pairs,
                  "invalidBooleanResults": rejected, "seconds": round(time.time() - started, 2)}
        # Deliberately no single scene-wide sum: several pairwise volumes may
        # occupy the same triple intersection, and bedding variants exclude one another.
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"out": str(out), "passed": report.get("passed"),
                      "eligibleSolids": report.get("eligibleSolidCount"),
                      "nonzeroIntersections": len(report.get("nonzeroIntersections", []))}), flush=True)


if __name__ == "__main__":
    main()
