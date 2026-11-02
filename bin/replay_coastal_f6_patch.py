"""Guarded mesh-only F6 replay on an exact independently accepted native source.

Run with the pinned Blender4.5.9. This applies only explicitly fingerprinted
owned mesh datablocks; canonical object roles, unrelated geometry, materials,
interior artwork and all source files remain untouched. Outputs are private QA
controls, never the canonical artwork path.
"""
from pathlib import Path
import hashlib
import json
import sys

import bpy
import numpy as np

# Blender's --python entrypoint does not add its script directory to sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit_coastal_f6_native_topology import OWNERS as GEOLOGY_OWNERS, qualify as qualify_topology


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def clean(value):
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, bpy.types.ID):
        return {"idType": value.bl_rna.identifier, "name": value.name_full}
    if hasattr(value, "items"):
        return {str(k): clean(v) for k, v in value.items()}
    try:
        return [clean(v) for v in value]
    except TypeError:
        return str(value)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()


def column_hash(collection, prop, width, dtype):
    values = np.empty(len(collection) * width, dtype=dtype)
    collection.foreach_get(prop, values)
    return hashlib.sha256(values.tobytes()).hexdigest()


def attribute_hash(a):
    formats = {
        "FLOAT": ("value", 1, np.float32),
        "INT": ("value", 1, np.int32),
        "BOOLEAN": ("value", 1, np.bool_),
        "FLOAT_VECTOR": ("vector", 3, np.float32),
        "FLOAT2": ("vector", 2, np.float32),
        "FLOAT_COLOR": ("color", 4, np.float32),
        "BYTE_COLOR": ("color", 4, np.float32),
        "INT32_2D": ("value", 2, np.int32),
        "INT16_2D": ("value", 2, np.int32),
    }
    if a.data_type in formats:
        prop, width, dtype = formats[a.data_type]
        try:
            value = column_hash(a.data, prop, width, dtype)
        except (AttributeError, TypeError, RuntimeError):
            value = digest([clean(getattr(row, prop)) for row in a.data])
    else:
        value = digest([
            {p.identifier: clean(getattr(row, p.identifier))
             for p in row.bl_rna.properties if p.identifier != "rna_type"}
            for row in a.data
        ])
    return {"domain": a.domain, "type": a.data_type, "count": len(a.data), "sha256": value}


def mesh_record(mesh, semantic=False):
    arrays = [
        ("vertices", mesh.vertices, "co", 3, np.float32),
        ("edges", mesh.edges, "vertices", 2, np.int32),
        ("loopVertices", mesh.loops, "vertex_index", 1, np.int32),
        ("loopEdges", mesh.loops, "edge_index", 1, np.int32),
        ("faceStarts", mesh.polygons, "loop_start", 1, np.int32),
        ("faceSizes", mesh.polygons, "loop_total", 1, np.int32),
        ("faceMaterials", mesh.polygons, "material_index", 1, np.int32),
        ("faceSmoothing", mesh.polygons, "use_smooth", 1, np.bool_),
        ("actualCornerNormals", mesh.corner_normals, "vector", 3, np.float32),
    ]
    result = {name: column_hash(c, p, w, d) for name, c, p, w, d in arrays}
    result["counts"] = [len(mesh.vertices), len(mesh.edges), len(mesh.loops), len(mesh.polygons)]
    result["attributes"] = {
        a.name: attribute_hash(a) for a in mesh.attributes
        if not (semantic and (a.name.startswith(".") or a.name == "custom_normal"))
    }
    result["activeColor"] = mesh.color_attributes.active_color.name if mesh.color_attributes.active_color else None
    result["materials"] = [m.name if m else None for m in mesh.materials]
    return result


def object_roles(o):
    return {
        "type": o.type,
        "worldMatrix": clean(o.matrix_world),
        "localMatrix": clean(o.matrix_local),
        "parent": o.parent.name if o.parent else None,
        "hideRender": o.hide_render,
        "hideViewport": o.hide_viewport,
        "properties": clean(dict(o.items())),
        "materialSlots": [[slot.link, slot.material.name if slot.material else None] for slot in o.material_slots],
    }


def material_record(material):
    result = {"diffuse": clean(material.diffuse_color), "roughness": material.roughness,
              "metallic": material.metallic, "nodesEnabled": material.use_nodes,
              "properties": clean(dict(material.items()))}
    if material.use_nodes:
        result["nodes"] = [
            {"name": node.name, "type": node.bl_idname,
             "inputs": [(s.name, clean(s.default_value)) for s in node.inputs if hasattr(s, "default_value")],
             "image": node.image.name if hasattr(node, "image") and node.image else None}
            for node in material.node_tree.nodes
        ]
        result["links"] = [(l.from_node.name, l.from_socket.name, l.to_node.name, l.to_socket.name)
                           for l in material.node_tree.links]
    return result


def scene_record(exclude=()):
    cache = {}
    objects = {}
    for o in bpy.context.scene.objects:
        if o.name in exclude:
            continue
        mesh = None
        if o.type == "MESH":
            key = o.data.as_pointer()
            if key not in cache:
                cache[key] = digest(mesh_record(o.data))
            mesh = cache[key]
        objects[o.name] = {"roles": object_roles(o), "mesh": mesh}
    return {"objects": objects, "materials": {m.name: material_record(m) for m in bpy.data.materials}}


def topology_records(names):
    """Reject incidence-only closure false positives before a native handback."""
    records = {name: qualify_topology(bpy.data.objects[name].data)
               for name in names if name in GEOLOGY_OWNERS}
    if not all(row["passed"] for row in records.values()):
        failed = [name for name, row in records.items() if not row["passed"]]
        raise RuntimeError("F6 native directed topology failed: " + ", ".join(failed))
    return records


def prepare(reference, qualified, accepted_sha, names, directory, qualification_reports, appearance_status=None):
    """Create a private mesh library + exact baseline/target manifest."""
    directory = Path(directory).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    reference = Path(reference).resolve()
    qualified = Path(qualified).resolve()
    bpy.ops.wm.open_mainfile(filepath=str(reference))
    baseline = {name: {"mesh": mesh_record(bpy.data.objects[name].data, semantic=True),
                       "roles": object_roles(bpy.data.objects[name])} for name in names}
    bpy.ops.wm.open_mainfile(filepath=str(qualified))
    topology = topology_records(names)
    targets = {}
    meshes = set()
    for name in names:
        o = bpy.data.objects[name]
        meshes.add(o.data)
        targets[name] = {"patchMeshName": o.data.name, "fields": mesh_record(o.data),
                         "materialNames": [m.name if m else None for m in o.data.materials]}
    asset = directory / "owned-meshes.blend"
    bpy.data.libraries.write(str(asset), meshes, fake_user=True, compress=True)
    manifest = {
        "schema": "coastal-f6-owned-mesh-patch/v1",
        "blenderVersion": [4, 5, 9],
        "acceptedInputSha256": accepted_sha,
        "referenceSha256": sha(reference),
        "qualifiedCandidateSha256": sha(qualified),
        "patchAsset": asset.name,
        "patchAssetSha256": sha(asset),
        "baselineOwners": baseline,
        "targetOwners": targets,
        "targetNativeDirectedTopology": topology,
        "qualificationReports": qualification_reports,
        "appearanceStatus": appearance_status or "Numerically qualified183 private integration control; left fold and library junction remain appearance-rejected. Never publish this control.",
        "policy": "Mesh-only bounded delta, not replacement of the old complete scene. Require exact accepted input hash and original owner geometry/fields/roles; preserve every unrelated object/material and all current object roles. Verify target fields and saved roundtrip independently. Output only private visual-QA paths.",
    }
    path = directory / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2))
    return path


def replay(manifest_path, source, expected_sha, output, report_path):
    manifest_path = Path(manifest_path).resolve()
    config = json.loads(manifest_path.read_text())
    source = Path(source).resolve()
    output = Path(output).resolve()
    report_path = Path(report_path).resolve()
    asset = (manifest_path.parent / config["patchAsset"]).resolve()
    assert bpy.app.version == tuple(config["blenderVersion"]) == (4, 5, 9)
    assert expected_sha == config["acceptedInputSha256"] == sha(source), "Exact accepted native input changed"
    assert sha(asset) == config["patchAssetSha256"], "Qualified patch asset changed"
    assert output not in [source, asset] and output.suffix.lower() == ".blend"
    assert ".jekyll-cache/visual-qa/" in output.as_posix().lower(), "Private integration-control output only"
    assert not output.exists(), "Keep every existing private trial; choose a fresh output path"
    output.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    names = list(config["targetOwners"])
    bpy.ops.wm.open_mainfile(filepath=str(source))
    preflight = {}
    for name, baseline in config["baselineOwners"].items():
        o = bpy.data.objects.get(name)
        actual = {"mesh": mesh_record(o.data, semantic=True), "roles": object_roles(o)} if o else None
        preflight[name] = {"passed": actual == baseline, "expected": baseline, "actual": actual}
    report = {"source": str(source), "sourceSha256": expected_sha, "manifest": str(manifest_path),
              "patchSha256": config["patchAssetSha256"], "output": str(output),
              "appearanceStatus": config["appearanceStatus"], "ownerPreflight": preflight,
              "passed": False, "sourceFileUnchanged": True}
    if not all(r["passed"] for r in preflight.values()):
        report_path.write_text(json.dumps(report, indent=2))
        raise RuntimeError("An original owned mesh/field/role differs; no native mutation or output was admitted")
    before = scene_record(exclude=names)
    roster = set(o.name for o in bpy.context.scene.objects)
    roles = {name: object_roles(bpy.data.objects[name]) for name in names}
    original_meshes = {bpy.data.objects[name].data for name in names}
    original_mesh_names = {name: bpy.data.objects[name].data.name for name in names}
    existing_materials = {m.name: m for m in bpy.data.materials}
    requested_names = list(dict.fromkeys(row["patchMeshName"] for row in config["targetOwners"].values()))
    with bpy.data.libraries.load(str(asset), link=False) as (available, requested):
        assert set(requested_names) <= set(available.meshes)
        requested.meshes = list(requested_names)
    loaded = dict(zip(requested_names, requested.meshes))
    rebound = set()
    for name, target in config["targetOwners"].items():
        mesh = loaded[target["patchMeshName"]]
        if mesh.as_pointer() not in rebound:
            had_material_attribute = mesh.attributes.get("material_index") is not None
            material_indices = np.empty(len(mesh.polygons), dtype=np.int32)
            mesh.polygons.foreach_get("material_index", material_indices)
            mesh.materials.clear()
            for material_name in target["materialNames"]:
                assert material_name in existing_materials, (name, "Missing accepted material", material_name)
                mesh.materials.append(existing_materials[material_name])
            if had_material_attribute:
                mesh.polygons.foreach_set("material_index", material_indices)
            else:
                assert not np.any(material_indices), "Absent material attribute had nondefault indices"
            rebound.add(mesh.as_pointer())
        bpy.data.objects[name].data = mesh
    for mesh in original_meshes:
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    for name in names:
        bpy.data.objects[name].data.name = original_mesh_names[name]
    for material in list(bpy.data.materials):
        if material.name not in existing_materials and material.users == 0:
            bpy.data.materials.remove(material)
    targets = {name: mesh_record(bpy.data.objects[name].data) == row["fields"]
               for name, row in config["targetOwners"].items()}
    replay_topology = topology_records(names)
    after = scene_record(exclude=names)
    roles_exact = all(object_roles(bpy.data.objects[name]) == roles[name] for name in names)
    if not roles_exact or not all(targets.values()):
        report["targetDiagnostics"] = {
            name: {"expectedFields": config["targetOwners"][name]["fields"],
                   "actualFields": mesh_record(bpy.data.objects[name].data),
                   "originalRoles": roles[name], "actualRoles": object_roles(bpy.data.objects[name])}
            for name in names if not targets[name] or object_roles(bpy.data.objects[name]) != roles[name]
        }
        report_path.write_text(json.dumps(report, indent=2))
    assert before == after and roster == set(o.name for o in bpy.context.scene.objects), "Unrelated canonical artwork changed"
    assert roles_exact and all(targets.values()), "Owned patch fields or canonical object roles changed"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    bpy.ops.wm.open_mainfile(filepath=str(output))
    roundtrip = scene_record(exclude=names)
    roundtrip_targets = {name: mesh_record(bpy.data.objects[name].data) == row["fields"]
                         for name, row in config["targetOwners"].items()}
    roundtrip_topology = topology_records(names)
    report.update({"allUnrelatedObjectsAndMaterialsExact": before == after == roundtrip,
                   "canonicalOwnedObjectRolesExact": roles_exact,
                   "ownerTargetFieldsExact": targets, "savedOwnerTargetFieldsExact": roundtrip_targets,
                   "nativeDirectedTopology": replay_topology, "savedNativeDirectedTopology": roundtrip_topology,
                   "unrelatedBeforeSha256": digest(before), "unrelatedAfterSha256": digest(after),
                   "unrelatedSavedSha256": digest(roundtrip), "sourceFileUnchanged": sha(source) == expected_sha,
                   "outputSha256": sha(output)})
    report["passed"] = report["allUnrelatedObjectsAndMaterialsExact"] and roles_exact and all(roundtrip_targets.values()) and report["sourceFileUnchanged"]
    report_path.write_text(json.dumps(report, indent=2))
    assert report["passed"], "Saved private replay did not preserve the accepted scene"
    print("GUARDED_F6_REPLAY", report["passed"], len(names), report["outputSha256"], flush=True)


def main():
    args = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
    replay(args["manifest"], args["source"], args["expected-source-sha256"], args["out"], args["report"])


if __name__ == "__main__":
    main()
