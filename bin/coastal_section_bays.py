"""Partition three scoped ceilings in the retained coastal master.

From the authoritative eleven-ao.blend, run inside Blender 4.5 LTS:

blender -t 2 -b eleven-ao.blend --python-exit-code 1 --python coastal_section_bays.py -- \
  --repo D:/dev/dylantao.github.io --expected-source HASH \
  --output section-bays.blend --report native-partition.json

The world coordinates below are native Blender metres (Z up). Each stone block
is a watertight sibling of the mainland. The dressing alcove already lies
beneath the main roof, so the original plaster head joins the section and the
small bearing at its inland edge stays attached.
"""

import argparse
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

CLIFF = "core__golden coastal sandstone"
HEAD = "core_bedroom_fit_bay_head"
SECTION = "inhabited-roof"
MARKER = "coastalSectionBays"
# Restrict the lateral cut to each ceiling and only then move up through its rock.
BAYS = (
    ("gym", (5.811, -9.083, 3.692), (11.189, -3.725, 5.847), 2.0),
    ("ensuite", (-8.424, -14.276, 5.195), (-4.776, -9.680, 5.849), 2.0),
)
SOURCE_FACE = "section_bay_source_face"
# This includes both arrival landings and the continuous sidewalls of the latest
# straight entrance, in Blender coordinates. Exact UV/baked tuples must agree.
ARRIVAL = ((-2.05, -32.0, -0.26), (1.66, -11.4, 11.0))


def bounds(vertices):
    return tuple(tuple(f(vertex[axis] for vertex in vertices) for axis in range(3)) for f in (min, max))


def box_distance(corners, box, *, whole=False):
    low, high = bounds(corners)
    a, b = box
    if whole:
        return max(0.0, *(a[k] - low[k] for k in range(3)), *(high[k] - b[k] for k in range(3)))
    return max(0.0, *(low[k] - b[k] for k in range(3)), *(a[k] - high[k] for k in range(3)))


def intersects(points, box, pad):
    if box_distance(points, box) > pad:
        return False
    a, b = box
    polygon = list(points)
    for axis in range(3):
        for edge, sign in ((a[axis] - pad, 1), (b[axis] + pad, -1)):
            if not polygon:
                return False
            result = []
            last = polygon[-1]
            score = (last[axis] - edge) * sign
            for vertex in polygon:
                distance = (vertex[axis] - edge) * sign
                if (distance < 0) != (score < 0):
                    result.append(last.lerp(vertex, score / (score - distance)))
                if distance >= 0:
                    result.append(vertex)
                last, score = vertex, distance
            polygon = result
    return len(polygon) >= 3


def tags(obj, bay):
    obj["caveRoof"] = True
    obj["closedSolid"] = True
    obj["cutawaySection"] = SECTION
    obj["cutawayOverviewOnly"] = True
    obj["sectionBay"] = bay


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def solid_volume(obj):
    m = bmesh.new()
    m.from_mesh(obj.data)
    volume = m.calc_volume(signed=True) * obj.matrix_world.to_3x3().determinant()
    m.free()
    if volume <= 0:
        raise RuntimeError("No positive solid volume in " + obj.name)
    return volume


def exact_normal_ledger(obj, zone):
    """Directed face/corner signature to attest the arrival's original normals."""
    mesh = obj.data
    verts = [obj.matrix_world @ v.co for v in mesh.vertices]
    records = []
    for f in mesh.polygons:
        if not intersects([verts[i] for i in f.vertices], zone, 0.0):
            continue
        corners = tuple(struct.pack("<6f", *verts[mesh.loops[i].vertex_index], *mesh.corner_normals[i].vector)
                        for i in f.loop_indices)
        records.append(struct.pack("<I", len(corners)) + b"".join(min(corners[i:] + corners[:i] for i in range(len(corners)))))
    return len(records), hashlib.sha256(b"".join(sorted(records))).hexdigest()


def partition_solid(target, tool, operation):
    modifier = target.modifiers.new("Scoped native section", "BOOLEAN")
    modifier.operation = operation
    modifier.solver = "MANIFOLD"
    modifier.object = tool
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=modifier.name)

def make_lid(mainland, tool, name, bay, lo, hi, helpers):
    cut, qualify, uv_name, bounce_name, initialise = helpers
    lid = mainland.copy()
    lid.data = mainland.data.copy()
    bpy.context.scene.collection.objects.link(lid)
    lid.name = lid.data.name = name
    field = lid.data.attributes.new(SOURCE_FACE, "INT", "FACE")
    field.data.foreach_set("value", np.arange(1, len(field.data) + 1, dtype=np.int32))
    bpy.context.view_layer.update()
    cut(lid, tool, "INTERSECT")
    part = bmesh.new()
    part.from_mesh(lid.data)
    uv = part.loops.layers.uv.get(uv_name)
    colour = part.loops.layers.float_color.get(bounce_name)
    source = part.faces.layers.int.get(SOURCE_FACE)
    if uv is None or colour is None or source is None:
        raise RuntimeError("Native intersection lost authored corner fields")
    cuts = [f for f in part.faces if f[source] == 0]
    inherited = [f for f in part.faces if f[source] != 0]
    if not cuts or not inherited:
        raise RuntimeError(f"Intersection needs inherited outside and new cutting planes {name}: {len(cuts)} new, {len(inherited)} old, {[f[source] for f in part.faces][:16]}")
    colors = [tuple(l[colour]) for f in inherited for l in f.loops]
    rgba = tuple(statistics.median(c[index] for c in colors) for index in range(4))
    max_excursion = max(box_distance([lid.matrix_world @ v.co for v in f.verts], (lo,hi), whole=True) for f in part.faces)
    if max_excursion > 0.00002:
        raise RuntimeError(f"{name} leaves its local roof envelope by {max_excursion:.6f} m")
    for f in cuts:
        f.smooth = False
        initialise(f, uv, colour, rgba, lid.matrix_world)
    part.faces.layers.int.remove(source)
    part.to_mesh(lid.data)
    part.free()
    lid.data.update()
    tags(lid, bay)
    return lid, {"ports": qualify(lid), "caps": len(cuts), "inherited": len(inherited),
                 "volume": solid_volume(lid), "maxExcursion": max_excursion, "capBounce": list(rgba)}


def build():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--repo", type=Path, required=True)
    p.add_argument("--expected-source", required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    options = p.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    source = Path(bpy.data.filepath).resolve()
    result, report = options.output.resolve(), options.report.resolve()
    if bpy.app.version[:3] != (4, 5, 9) or not source.is_file() or sha(source) != options.expected_source.lower():
        p.error("Open the pinned Blender 4.5.9 native source first")
    if len({source, result, report}) != 3:
        p.error("Source, output and report must be distinct")
    if bpy.context.scene.get(MARKER):
        p.error("Source already has section bays")
    sys.path.insert(0, str(options.repo.resolve() / "bin"))
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from coastal_embedded_lift_cut import BOUNCE, UV, discard, far_faces, paint_new_face, splice_cut
    from coastal_geology_export_custody import qualify_static_ports
    from coastal_shell import _box_object

    scene = bpy.context.scene
    mainland = scene.objects[CLIFF]
    base_volume = solid_volume(mainland)
    before = qualify_static_ports(mainland)
    print("Native volume", base_volume, flush=True)
    def arrival_faces(points, _):
        return not intersects(points, ARRIVAL, 0.0)
    arrival = far_faces(mainland, 0, touches_cut=arrival_faces)
    arrival_normals = exact_normal_ledger(mainland, ARRIVAL)

    output = []
    for bay, lo, hi, limit in BAYS:
        name = CLIFF.replace("__", "_section_" + bay + "__")
        box = (lo, hi)
        print(f"Partitioning {bay} over {lo} .. {hi}", flush=True)
        tool = _box_object("section partition tool", lo, hi, mainland.data.materials[0])
        old_volume = solid_volume(mainland)
        def distance(points):
            return box_distance(points, box)
        def touches(points, margin):
            return intersects(points, box, margin)
        try:
            lid, section = make_lid(mainland, tool, name, bay, lo, hi,
                                    (partition_solid, qualify_static_ports, UV, BOUNCE, paint_new_face))
            partition = splice_cut(mainland, tool, touches_cut=touches, cut_distance=distance, seam_limit=limit,
                                   solver=partition_solid, stop_at_retained_edges=True)
        finally:
            discard(tool)
        new_volume = solid_volume(mainland)
        error = old_volume - new_volume - section["volume"]
        if abs(error) > 1e-5:
            raise RuntimeError(f"{bay} changes the recomposed volume by {error:.8f} cubic metres")
        output.append({"id": bay, "name": lid.name, "bounds": box, "lid": section, "partition": partition,
                       "volumeResidual": error})
        print(f"{bay}: {section['ports']['faces']} lid faces, volume {section['volume']:.6f}, native closure {error:.8f}; seam {partition['sourceSeamReach']:.4f} / {partition['resultSeamReach']:.4f}; ignored {partition['remoteBooleanChangesIgnored']}", flush=True)

    tags(scene.objects[HEAD], "dressing")
    qualify_static_ports(scene.objects[HEAD])
    from coastal_section_canopy import attach
    canopy = attach(scene)
    arrival_after = far_faces(mainland, 0, touches_cut=arrival_faces)
    print("arrival before/after", arrival, arrival_after, flush=True)
    arrival_normals_after = exact_normal_ledger(mainland, ARRIVAL)
    scene[MARKER] = 1
    bpy.context.view_layer.update()
    values = {"sourceSha256": options.expected_source.lower(), "nativeBefore": before,
              "nativeAfter": qualify_static_ports(mainland), "bays": output, "canopy": canopy, "arrivalBounds": ARRIVAL,
              "arrivalFaces": {"baseline": arrival, "candidate": arrival_after}, "arrivalNormals": {"before": arrival_normals, "after": arrival_normals_after},
              "volumeBefore": base_volume, "volumeAfter": solid_volume(mainland) + sum(r["lid"]["volume"] for r in output)}
    result.parent.mkdir(parents=True, exist_ok=True)
    report.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(result), compress=True)
    values["resultSha256"] = sha(result)
    report.write_text(json.dumps(values, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
