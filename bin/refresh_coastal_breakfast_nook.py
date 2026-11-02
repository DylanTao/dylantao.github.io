"""Replay a private breakfast delta on a coordinator-pinned native descendant.

Blender4.5.9 --background --factory-startup --python-exit-code1 --python THIS --
 --source INPUT --source-sha256 SHA --manifest MANIFEST --output NEW_QA_DIR
 --csg-driver ARRIVAL_DRIVER --csg-parts PARTS_DIR --csg-receipt CUSTODY_JSON

The helper receipt binds all four original helper bodies plus the driver.
Only its exact guarded cut function is extracted; the arrival builder never runs.
No export, native-light bake, cache signing, canonical replacement or push occurs.
"""
import argparse
import ast
import hashlib
import importlib.util
import json
import sys
import traceback
from pathlib import Path
from types import SimpleNamespace

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_breakfast_nook as nook
import coastal_shell


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def helpers(driver, parts, receipt, output, closed_field=None, project_slab_caps=False, exact_membership=False):
    metadata = json.loads(receipt.read_text(encoding="utf-8"))
    expected = {Path(entry["path"]).name: entry["sha256"] for entry in metadata["files"]}
    names = ("native_custody.py", "triangle_fields.py", "boundary.py", "refit.py")
    if set(expected) != {*names, driver.name}:
        raise ValueError("Exact four-helper/one-driver receipt required")
    sources = {name: parts / name for name in names}
    sources[driver.name] = driver
    for name, path in sources.items():
        if sha(path) != expected[name]:
            raise ValueError("CSG source changed: " + name)
    tree = ast.parse(driver.read_text(encoding="utf-8"))
    node = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "guarded_manifold_cut")
    bodies = {name: path.read_text(encoding="utf-8") for name, path in sources.items() if name in names}
    bodies["guarded_manifold_cut.py"] = ast.get_source_segment(driver.read_text(encoding="utf-8"), node) + "\n"
    directory = output / "bound-csg-parts"
    directory.mkdir()
    records = {}
    for name, text in bodies.items():
        (directory / ("original-" + name)).write_text(text, encoding="utf-8")
        text = text.replace("Arrival", "Breakfast").replace("arrival_", "breakfast_")
        if name == "boundary.py" and exact_membership:
            (directory / "pre-exact-r6-membership.py").write_bytes(text.encode("utf-8"))
            tree = ast.parse(text)
            node = next(node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef) and node.name == "inside")
            old_inside = ast.get_source_segment(text, node)
            if text.count(old_inside) != 1:
                raise RuntimeError("Exact R6 membership hook changed")
            text = text.replace(old_inside, "def inside(point):\n        return r6_exact_contains(point)")
        if name == "guarded_manifold_cut.py":
            needle = "                points=[tuple(v) for v in source['p']]\n                for li in face.loop_indices:"
            replacement = "                points=[tuple(v) for v in source['p']]\n                original_indices=list(face.loop_indices)\n                actual_points=[tuple(obj.matrix_world@obj.data.vertices[obj.data.loops[li].vertex_index].co)for li in original_indices]\n                cycle=next((k for k in range(3)if len(actual_points)==3 and actual_points==points[-k:]+points[:-k]),None)\n                for corner,li in enumerate(original_indices):"
            if text.count(needle) != 1:
                raise RuntimeError("Guarded exact-corner hook changed")
            text = text.replace(needle, replacement)
            needle = "                    if at in points:\n                        k=points.index(at);weights=np.zeros(3);weights[k]=1."
            replacement = "                    if cycle is not None:\n                        k=(corner-cycle)%3;weights=np.zeros(3);weights[k]=1.\n                    elif at in points:\n                        k=points.index(at);weights=np.zeros(3);weights[k]=1."
            if text.count(needle) != 1:
                raise RuntimeError("Guarded affine-corner hook changed")
            text = text.replace(needle, replacement)
            before_closed = text
            if closed_field:
                needle = "weights=np.asarray(exact_fields.barycentric(at,source['p']))"
                replacement = "weights=np.asarray(closed_source_fields.field_weights(at,source['p']))"
                if text.count(needle) != 1:
                    raise RuntimeError("Guarded born-corner interpolation hook changed")
                text = text.replace(needle, replacement)
                (directory / "pre-closed-born-interpolation.py").write_bytes(before_closed.encode("utf-8"))
            if project_slab_caps:
                (directory / "pre-created-slab-cap-projection.py").write_bytes(text.encode("utf-8"))
                needle = "        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=modifier.name)"
                replacement = needle + "\n        created_cap_projection=project_created_slab_caps(obj,tool,original_fields[obj.name])\n        if created_cap_projection['applicable']:(qa/'created-slab-cap-projection.json').write_text(json.dumps(created_cap_projection,indent=2)+'\\n')"
                if text.count(needle) != 1:
                    raise RuntimeError("Created-SLAB-cap projection hook changed")
                text = text.replace(needle, replacement)
                needle = "            refit=_r.refit_split_points(obj,original_fields[obj.name],exact_fields)"
                replacement = needle + "\n            projection_check=project_created_slab_caps(obj,tool,original_fields[obj.name],apply=False)\n            if projection_check.get('moves'):raise RuntimeError('Inherited refit left a born SLAB cap off its exact declared plane')"
                if text.count(needle) != 1:
                    raise RuntimeError("Created-SLAB-cap post-refit hook changed")
                text = text.replace(needle, replacement)
                needle = "'outsideCustody':outside_custody,"
                if text.count(needle) != 1:
                    raise RuntimeError("Created-SLAB-cap result hook changed")
                text = text.replace(needle, "'createdCapProjection':created_cap_projection," + needle)
            if exact_membership:
                needle = "        restore_original_outside=_u.restore_original_outside"
                if text.count(needle) != 1:
                    raise RuntimeError("Exact R6 classifier injection hook changed")
                text = text.replace(needle, "        _u.r6_exact_contains=exact_axis_tool_classifier(tool,qa,obj.name)\n" + needle)
        (directory / name).write_text(text, encoding="utf-8")
        records[name] = {"originalSha256": sha(directory / ("original-" + name)), "executedSha256": sha(directory / name)}
        if name == "guarded_manifold_cut.py" and closed_field:
            records[name]["beforeClosedBornInterpolationSha256"] = sha(directory / "pre-closed-born-interpolation.py")
        if name == "guarded_manifold_cut.py" and project_slab_caps:
            records[name]["beforeCreatedSlabCapProjectionSha256"] = sha(directory / "pre-created-slab-cap-projection.py")
        if name == "boundary.py" and exact_membership:
            records[name]["beforeExactR6MembershipSha256"] = sha(directory / "pre-exact-r6-membership.py")
    (directory / "CUSTODY.json").write_text(json.dumps({"inputReceiptSha256": sha(receipt), "driverSha256": sha(driver), "files": records,
        "closedBornInterpolation": closed_field, "projectCreatedSlabCaps": project_slab_caps, "exactR6ToolMembership": exact_membership,
        "changes": "Private provenance namespace; exact cyclic corner custody preserves different original RGB at coincident corners. Existing physical bounds and refit weights unchanged. Optional pinned closed-source field changes only the single born-corner interpolation call; exact corner branches remain intact."}, indent=2) + "\n", encoding="utf-8")
    return directory


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ("source", "source-sha256", "manifest", "output", "csg-driver", "csg-parts", "csg-receipt"):
        parser.add_argument("--" + key, required=True)
    for key in ("closed-field-kernel", "closed-field-kernel-sha256", "closed-field-calibration"):
        parser.add_argument("--" + key)
    parser.add_argument("--project-created-slab-caps", action="store_true")
    parser.add_argument("--exact-r6-tool-membership", action="store_true")
    parser.add_argument("--restore-partial-zero-fans", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    repo, source, manifest, output = nook.validate_replay_paths(ROOT, args.source, args.source_sha256, args.manifest, args.output)
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("Exact Blender4.5.9 required")
    # Bind all helper inputs before creating a product candidate.
    driver, parts, receipt = (Path(value).resolve() for value in (args.csg_driver, args.csg_parts, args.csg_receipt))
    metadata = json.loads(receipt.read_text(encoding="utf-8"))
    for entry in metadata["files"]:
        path = driver if Path(entry["path"]).name == driver.name else parts / Path(entry["path"]).name
        if sha(path) != entry["sha256"]:
            raise ValueError("Unbound construction helper " + str(path))
    closed_module, closed_field = None, None
    closed_arguments = (args.closed_field_kernel, args.closed_field_kernel_sha256, args.closed_field_calibration)
    if any(closed_arguments):
        if not all(closed_arguments):
            raise ValueError("Closed-source control requires kernel path, exact SHA and independent calibration")
        kernel_path, calibration_path = Path(args.closed_field_kernel).resolve(), Path(args.closed_field_calibration).resolve()
        calibration = json.loads(calibration_path.read_text(encoding="utf-8"))
        if (sha(kernel_path) != args.closed_field_kernel_sha256 or calibration.get("producerSha256") != args.closed_field_kernel_sha256
                or calibration.get("passed") is not True or calibration.get("zeroAreaFieldsRequirePairedCornerCustody") is not True
                or calibration.get("thresholdsUnchanged") != {"geometryM": 3e-6, "normal": 1e-6, "RGB": 1e-7}):
            raise ValueError("Unqualified closed-source field input")
        module_spec = importlib.util.spec_from_file_location("pinned_closed_source_fields", kernel_path)
        closed_module = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(closed_module)
        kernel_text = kernel_path.read_text(encoding="utf-8")
        field_node = next(node for node in ast.parse(kernel_text).body if isinstance(node, ast.FunctionDef) and node.name == "field_weights")
        closed_field = {"scope": "PRIVATE born-corner control only; no geometry/refit or exact-corner change",
                        "kernelPath": str(kernel_path), "kernelSha256": sha(kernel_path),
                        "fieldFunctionBodySha256": hashlib.sha256(ast.get_source_segment(kernel_text, field_node).encode("utf-8")).hexdigest(),
                        "calibrationPath": str(calibration_path), "calibrationSha256": sha(calibration_path),
                        "independentCases": calibration["cases"], "zeroAreaPolicy": "Raise; paired source-corner/port custody required"}
    output.mkdir(parents=True)
    report = {"status": "unqualified-private-delta", "sourceSha256": args.source_sha256, "manifestSha256": sha(manifest), "blender": bpy.app.version_string,
              "producerFiles": {str(path.relative_to(ROOT)): sha(path) for path in (Path(__file__).resolve(), ROOT / "bin" / "coastal_breakfast_nook.py", ROOT / "bin" / "coastal_kitchen.py")},
              "next": "Independent full native fields/topology/support/body/contact, native light bake, compressed geometry, actual128probe field and complete public Rooms/Walk/views required. No canonical admission."}
    if closed_field:
        report["closedBornInterpolation"] = closed_field
    try:
        bpy.ops.wm.open_mainfile(filepath=str(source))
        if bpy.context.scene.get("underBedroomBreakfastVersion"):
            raise RuntimeError("Breakfast delta is already authored")
        if any(o.type == "MESH" and o.data.attributes.get("Breakfast source triangle") for o in bpy.context.scene.objects):
            raise RuntimeError("Existing private breakfast provenance must be reviewed")
        config = json.loads(manifest.read_text(encoding="utf-8"))
        nook.apply_placement(config)
        report["retiredViewBench"] = nook.retire_view_bench(bpy.context.scene)
        parts_dir = helpers(driver, parts, receipt, output, closed_field, args.project_created_slab_caps, args.exact_r6_tool_membership)
        context = {"bpy": bpy, "bmesh": bmesh, "json": json, "Vector": Vector, "importlib": importlib,
                   "parts_dir": parts_dir, "qa": output, "original_fields": {}, "closed_source_fields": closed_module,
                   "project_created_slab_caps": nook.project_created_slab_caps,
                   "exact_axis_tool_classifier": nook.exact_axis_tool_classifier}
        exec(compile((parts_dir / "native_custody.py").read_text(encoding="utf-8"), "bound native custody", "exec"), context)
        spec = importlib.util.spec_from_file_location("breakfast_exact_fields", parts_dir / "triangle_fields.py")
        kernel = importlib.util.module_from_spec(spec); spec.loader.exec_module(kernel)
        def volume(obj):
            bm = bmesh.new(); bm.from_mesh(obj.data)
            result = abs(bm.calc_volume(signed=True)); bm.free()
            return result
        context.update(exact_fields=kernel, old=SimpleNamespace(_volume=volume))
        exec(compile((parts_dir / "guarded_manifold_cut.py").read_text(encoding="utf-8"), "bound physical-local cut", "exec"), context)
        cut = context["guarded_manifold_cut"]
        report["cuts"] = []
        report["temporaryCutTools"] = []
        landing_plane = None
        for owner, boxes in nook.OWNER_BOXES.items():
            obj = bpy.data.objects[owner]
            source_fan_mesh = obj.data.copy() if args.restore_partial_zero_fans and owner == "core__golden coastal sandstone" else None
            source_fan_matrix = obj.matrix_world.copy() if source_fan_mesh else None
            bm = bmesh.new(); bm.from_mesh(obj.data)
            invalid = sum(not edge.is_manifold or not edge.is_contiguous for edge in bm.edges); bm.free()
            if invalid:
                raise RuntimeError("Input directed topology invalid: " + owner)
            tools = []
            component_records = []
            for name in boxes:
                lo, hi = nook.BOXES[name]
                component = coastal_shell._box_object("breakfast tool " + name, (lo[0], -hi[2], lo[1]), (hi[0], -lo[2], hi[1]), bpy.data.materials["golden coastal sandstone"])
                component_records.append(nook.author_cutter(component, name))
                if name == "room":
                    component_records[-1]["retainedGroundedFrontReturns"] = nook.retain_grounded_front_returns(component)
                if name == "stairs":
                    landing_plane = component_records[-1]["authored"]["nativeBounds"][1][0]
                tools.append(component)
            tool = tools[0]
            for other in tools[1:]:
                modifier = tool.modifiers.new("new tool union only", "BOOLEAN")
                modifier.operation = "UNION"; modifier.solver = "MANIFOLD"; modifier.object = other
                bpy.context.view_layer.objects.active = tool; bpy.ops.object.modifier_apply(modifier=modifier.name)
                bpy.data.objects.remove(other, do_unlink=True)
            triangulation_control = nook.triangulate_temporary_tool(tool)
            report["temporaryCutTools"].append({"owner": owner, "components": component_records,
                                                "newToolTriangulation": triangulation_control,
                                                "actualUnion": nook.cutter_geometry(tool, "actual union")})
            report["cuts"] += cut(tool, [obj])
            if source_fan_mesh:
                report["partialZeroFanRestoration"] = nook.restore_partial_zero_fans(obj, source_fan_mesh, source_fan_matrix)
                bpy.data.meshes.remove(source_fan_mesh)
            bm = bmesh.new(); bm.from_mesh(obj.data)
            invalid = sum(not edge.is_manifold or not edge.is_contiguous for edge in bm.edges); bm.free()
            if invalid:
                raise RuntimeError("Output directed topology invalid: " + owner)
        report["furniture"] = nook.move_furnishings(bpy.context.scene)
        if landing_plane is None:
            raise RuntimeError("Actual stair tool plane was not recorded")
        report["structure"] = nook.build_structure(bpy.context.scene, landing_plane)
        bpy.context.view_layer.update()
        bpy.context.scene["underBedroomBreakfastVersion"] = nook.VERSION
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(output / "candidate.blend"), compress=True)
        (output / "manifest.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
        if sha(source) != args.source_sha256:
            raise RuntimeError("Input file changed")
        report.update(candidateSha256=sha(output / "candidate.blend"), manifestOutputSha256=sha(output / "manifest.json"))
    except Exception as error:
        report.update(status="failed-private-delta", error=str(error), traceback=traceback.format_exc())
        bpy.ops.wm.save_as_mainfile(filepath=str(output / "FAILED-DIAGNOSTIC.blend"), compress=True)
        raise
    finally:
        (output / "REPLAY.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
