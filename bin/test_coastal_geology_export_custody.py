"""Run with Blender4.5.9 --background --python-exit-code1 --python this_file."""
from pathlib import Path
import hashlib
import importlib.util
import json
import sys

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from coastal_geology_export_custody import install_geology_export_custody, qualify_static_ports


def mesh_object(name, points, charts):
    mesh = bpy.data.meshes.new(name)
    edges, edge_ids, faces, loop_edges = [], {}, [], []
    for chart, polygons in enumerate(charts):
        for polygon in polygons:
            faces.append(polygon)
            for a, b in zip(polygon, polygon[1:] + polygon[:1]):
                key = chart, min(a, b), max(a, b)
                if key not in edge_ids:
                    edge_ids[key] = len(edges)
                    edges.append((a, b))
                loop_edges.append(edge_ids[key])
    mesh.vertices.add(len(points))
    mesh.vertices.foreach_set("co", np.asarray(points, np.float32).reshape(-1))
    mesh.edges.add(len(edges))
    mesh.edges.foreach_set("vertices", np.asarray(edges, np.int32).reshape(-1))
    mesh.loops.add(sum(map(len, faces)))
    mesh.loops.foreach_set("vertex_index", np.asarray([v for f in faces for v in f], np.int32))
    mesh.loops.foreach_set("edge_index", np.asarray(loop_edges, np.int32))
    mesh.polygons.add(len(faces))
    mesh.polygons.foreach_set("loop_start", np.asarray([3 * i for i in range(len(faces))], np.int32))
    mesh.polygons.foreach_set("loop_total", np.full(len(faces), 3, np.int32))
    mesh.polygons.foreach_set("use_smooth", np.zeros(len(faces), np.bool_))
    mesh.update(calc_edges=False)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def fields(mesh):
    return {
        "P": [v.co[:] for v in mesh.vertices], "E": [e.vertices[:] for e in mesh.edges],
        "F": [f.vertices[:] for f in mesh.polygons],
        "L": [(l.vertex_index, l.edge_index) for l in mesh.loops],
        "N": [v.vector[:] for v in mesh.corner_normals],
    }


def main():
    assert bpy.app.version == (4, 5, 9)
    out = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
    out.mkdir(parents=True, exist_ok=False)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    points = [(0, 0, 0), (1, 0, 0), (0, 1, 0), (0, 0, 1), (0, 0, -1)]
    upper = [[0, 2, 1], [0, 1, 3], [1, 2, 3], [2, 0, 3]]
    lower = [[0, 1, 2], [0, 4, 1], [1, 4, 2], [2, 4, 0]]
    geology = mesh_object("core__golden coastal sandstone", points, [upper, lower])
    original = fields(geology.data)
    (out / "ORIGINAL-FIELDS.json").write_text(json.dumps(original))
    qualify_static_ports(geology)
    # Do not use Mesh.copy(): validate() can mutate shared copy-on-write
    # corner storage before unsharing it. Build a separate RNA control.
    control = mesh_object("negative_validate_control", points, [upper, lower])
    assert control.data.validate() and len(control.data.polygons) == 7
    control_mesh = control.data
    bpy.data.objects.remove(control, do_unlink=True)
    bpy.data.meshes.remove(control_mesh)
    assert fields(geology.data) == original
    ordinary = mesh_object("ordinary_validation_control", points[:4], [upper])
    ordinary.location.x = 3
    bad = mesh_object("open_rejection", points[:4], [upper[:3]])
    try:
        qualify_static_ports(bad)
        raise AssertionError("An open fixture was admitted")
    except RuntimeError as error:
        assert "directed port boundary" in str(error)
    bpy.data.objects.remove(bad, do_unlink=True)
    flipped = mesh_object("winding_rejection", points[:4], [[upper[0][::-1], *upper[1:]]])
    try:
        qualify_static_ports(flipped)
        raise AssertionError("A flipped closed-incidence fixture was admitted")
    except RuntimeError as error:
        assert "directed port boundary" in str(error)
    bpy.data.objects.remove(flipped, do_unlink=True)
    source = out / "source.blend"
    geology_name = geology.name
    bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    geology = bpy.data.objects[geology_name]
    (out / "REOPENED-FIELDS.json").write_text(json.dumps(fields(geology.data)))
    assert fields(geology.data) == original
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    custody = install_geology_export_custody(source, source_hash, out / "custody")
    water_path = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--water-helper=")), None)
    if water_path:
        spec = importlib.util.spec_from_file_location("fixture_water_precision", water_path)
        water = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(water)
        water.install_water_precision()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(out / "fixture.glb"), export_format="GLB", use_selection=True,
        export_cameras=False, export_lights=False, export_animations=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=8,
        export_draco_color_quantization=6,
    )
    report = custody.finish()
    assert fields(geology.data) == original
    selected = [r for r in report["codecCalls"] if r["selectedGeology"]]
    other = [r for r in report["codecCalls"] if not r["selectedGeology"]]
    assert selected and all(r["positionActual"] == 0 and r["normalBitsUnchanged"] == 8 for r in selected)
    assert other and all(r["positionActual"] == r["positionBefore"] == 14 for r in other)
    assert any(r["owner"] == "ordinary_validation_control" and r["ordinaryValidationExecuted"] for r in report["validationCalls"])
    result = {"parallelPortOriginalFaces": 8, "ordinaryValidateLostFaces": 1,
              "nativeFieldsExactAfterExport": True, "openRejected": True,
              "flippedIncidenceClosedRejected": True, "otherOwnerStillValidated": True,
              "sourceFileUnchanged": report["sourceUnchanged"], "sdkUnchanged": report["installedSdkBytesUnchanged"],
              "owningWaterHookCompatibilityTested": bool(water_path),
              "productionWasmDecodePending": True, "passed": True}
    (out / "NATIVE-FIXTURE.json").write_text(json.dumps(result, indent=2))
    print("GEOLOGY_EXPORT_NATIVE_FIXTURE", json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
