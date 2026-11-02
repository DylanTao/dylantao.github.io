"""Replay only the qualified bedroom metadata and isolated globe material role.

Run with Blender 4.5.9 --background INPUT --python-exit-code 1 --python
replay_lighting.py -- --repo-root REPO --source INPUT --source-sha SHA256
--manifest INPUT_MANIFEST --out REPO/.jekyll-cache/visual-qa/NEW_DIRECTORY

This produces a private candidate, never an export, cache signature or publish.
Use the coordinator's combined native source after the terrain/arrival replays.
"""
import argparse
import array
import ast
import copy
import gzip
import hashlib
import json
import sys
from pathlib import Path

import bpy


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stream(collection, field, width, typecode="f"):
    data = array.array(typecode, [0]) * (len(collection) * width)
    collection.foreach_get(field, data)
    return data.tobytes()


def geometry(obj):
    mesh = obj.data
    digest = hashlib.sha256()
    digest.update(repr(tuple(value for row in obj.matrix_world for value in row)).encode("ascii"))
    for collection, field, width, kind in [
        (mesh.vertices, "co", 3, "f"), (mesh.vertices, "normal", 3, "f"),
        (mesh.edges, "vertices", 2, "i"), (mesh.loops, "vertex_index", 1, "i"),
        (mesh.polygons, "loop_start", 1, "i"), (mesh.polygons, "loop_total", 1, "i"),
        (mesh.polygons, "use_smooth", 1, "b"), (mesh.corner_normals, "vector", 3, "f"),
    ]:
        digest.update(stream(collection, field, width, kind))
    for attr in sorted(mesh.attributes, key=lambda item: item.name):
        # Exhaustively compared separately against the exact allowed face IDs.
        if attr.name == "material_index":
            continue
        if attr.data_type in {"FLOAT_COLOR", "BYTE_COLOR"}:
            field, width, kind = "color", 4, "f"
        elif attr.data_type == "FLOAT_VECTOR":
            field, width, kind = "vector", 3, "f"
        elif attr.data_type == "FLOAT2":
            field, width, kind = "vector", 2, "f"
        elif attr.data_type in {"INT16_2D", "INT32_2D", "INT32_4D"}:
            field, width, kind = "value", 4 if attr.data_type == "INT32_4D" else 2, "i"
        elif attr.data_type in {"FLOAT", "INT", "BOOLEAN", "INT8"}:
            field, width, kind = "value", 1, "f" if attr.data_type == "FLOAT" else "i"
        else:
            raise RuntimeError(f"Unhandled native attribute {attr.name}: {attr.data_type}")
        digest.update(repr((attr.name, attr.domain, attr.data_type)).encode("utf8"))
        digest.update(stream(attr.data, field, width, kind))
    if mesh.shape_keys:
        for key in mesh.shape_keys.key_blocks:
            digest.update(key.name.encode("utf8"))
            digest.update(stream(key.data, "co", 3))
    return {"sha256": digest.hexdigest(), "vertices": len(mesh.vertices), "polygons": len(mesh.polygons)}


def native_state():
    return {
        obj.name: {
            "geometry": geometry(obj),
            "faces": [face.material_index for face in obj.data.polygons],
            "slots": [slot.material.name if slot.material else None for slot in obj.material_slots],
        }
        for obj in sorted(bpy.context.scene.objects, key=lambda item: item.name) if obj.type == "MESH"
    }


def materials():
    result = {}
    for material in bpy.data.materials:
        bsdf = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None) if material.use_nodes else None
        result[material.name] = {
            "diffuseColor": list(material.diffuse_color), "roughness": material.roughness,
            "metallic": material.metallic,
            "bsdf": {
                name: list(bsdf.inputs[name].default_value) if hasattr(bsdf.inputs[name].default_value, "__len__") else bsdf.inputs[name].default_value
                for name in ["Base Color", "Roughness", "Metallic", "Emission Color", "Emission Strength"] if bsdf and name in bsdf.inputs
            },
        }
    return result


def globe_guard(scene, receipt):
    """Bind the original globe, independently of unrelated descendant edits."""
    obj = scene.objects[receipt["owner"]]
    mesh = obj.data
    vertices = set(receipt["vertexIndices"])
    faces = [face for face in mesh.polygons if any(index in vertices for index in face.vertices)]
    assert all(all(index in vertices for index in face.vertices) for face in faces)
    loops = {index for face in faces for index in face.loop_indices}
    edges = {edge.index for edge in mesh.edges if all(index in vertices for index in edge.vertices)}
    domains = {"POINT": vertices, "FACE": {face.index for face in faces}, "CORNER": loops, "EDGE": edges}
    payload = {
        "matrix": [list(row) for row in obj.matrix_world],
        "vertices": [(index, list(mesh.vertices[index].co), list(mesh.vertices[index].normal)) for index in sorted(vertices)],
        "faces": [(face.index, list(face.vertices), face.use_smooth) for face in faces],
        "cornerNormals": [(index, list(mesh.corner_normals[index].vector)) for index in sorted(loops)],
        "attributes": [],
    }
    for attr in sorted(mesh.attributes, key=lambda item: item.name):
        if attr.name == "material_index":
            continue
        assert attr.domain in domains, (attr.name, attr.domain)
        field = "color" if attr.data_type in {"FLOAT_COLOR", "BYTE_COLOR"} else "vector" if attr.data_type in {"FLOAT_VECTOR", "FLOAT2"} else "value"
        values = []
        for index in sorted(domains[attr.domain]):
            value = getattr(attr.data[index], field)
            values.append((index, list(value) if hasattr(value, "__len__") else value))
        payload["attributes"].append({"name": attr.name, "domain": attr.domain, "type": attr.data_type, "values": values})
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf8")).hexdigest()


def replay_regions(repo, config):
    """Execute only the owning pure assignments, never a whole-room builder."""
    tree = ast.parse((repo / "bin/coastal_architecture_finish.py").read_text(encoding="utf8"))
    owner = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "adjacent_bedchamber")
    region = next(node for node in owner.body if isinstance(node, ast.Assign) and ast.unparse(node.targets[0]) == "region")
    light = next(node for node in owner.body if isinstance(node, ast.Assign) and ast.unparse(node.targets[0]) == "room['lightRegion']")
    room = next(room for room in config["rooms"] if room["id"] == "sleep")
    bounds = config["estateLibrary"]["adjacentBedchamber"]["bounds"]
    env = {"room": room, "floor": room["floor"], "x0": bounds["min"][0], "x1": bounds["max"][0], "z0": bounds["min"][2], "z1": bounds["max"][2]}
    exec(compile(ast.Module(body=[region, light], type_ignores=[]), "owning-bedroom-region", "exec"), {"__builtins__": {"list": list}}, env)
    tree = ast.parse((repo / "bin/coastal_retreat.py").read_text(encoding="utf8"))
    owner = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "finish_metadata")
    light = next(node for node in owner.body if isinstance(node, ast.Assign) and ast.unparse(node.targets[0]) == "rooms['library-upper']['lightRegion']")
    rooms = {room["id"]: room for room in config["rooms"]}
    exec(compile(ast.Module(body=[light], type_ignores=[]), "owning-gallery-region", "exec"), {"__builtins__": {}}, {"rooms": rooms})
    assert rooms["sleep"]["lightRegion"] == {"min": [-8.53, 1.45, 3.3], "max": [-5.15, 5.25, 8.62]}
    assert rooms["library-upper"]["lightRegion"] == {"min": [-4.3, 2.55, 10.0], "max": [1.3, 4.7, 12.8]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ["repo-root", "source", "source-sha", "manifest", "out"]:
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    repo, source, manifest, out = (Path(value).resolve() for value in [args.repo_root, args.source, args.manifest, args.out])
    assert bpy.app.version == (4, 5, 9), bpy.app.version_string
    assert Path(bpy.data.filepath).resolve() == source, "Loaded source differs from explicit source"
    assert sha(source) == args.source_sha.lower(), "Source SHA mismatch"
    qa = (repo / ".jekyll-cache/visual-qa").resolve()
    assert out.is_relative_to(qa) and out != qa and not out.exists(), "Output must be a NEW private QA directory"
    assert not source.is_relative_to(out) and not manifest.is_relative_to(out)
    before = native_state()
    before_materials = materials()
    config = json.loads(manifest.read_text(encoding="utf8"))
    old_config = copy.deepcopy(config)
    replay_regions(repo, config)
    sys.path.insert(0, str(repo / "bin"))
    from coastal_architecture_finish import bedside_diffuser_material, bedside_practical_metadata
    original_globe = bedside_practical_metadata(bpy.context.scene, config)
    original_globe_sha = globe_guard(bpy.context.scene, original_globe)
    assert original_globe_sha == "4fca94a1b386416b1a0f41fce837f75938008bc0691acd48965ab8e46805f6e9", "Retained globe geometry/normal/UV/color identity changed"
    receipt = bedside_diffuser_material(bpy.context.scene, config)
    assert receipt["vertices"] == 222 and receipt["nativePolygons"] == 240, "Delivered fixture ownership changed"
    after, after_materials = native_state(), materials()
    assert set(before) == set(after)
    assert all(before[name]["geometry"] == after[name]["geometry"] for name in before), "Native geometry/attributes changed"
    changed = [name for name in before if before[name] != after[name]]
    assert changed == ([] if receipt["alreadyAuthored"] else ["sleep__linen"]), changed
    assert all(before_materials[name] == after_materials[name] for name in before_materials)
    role = "sleep bedside linen diffuser"
    if not receipt["alreadyAuthored"]:
        assert set(after_materials) - set(before_materials) == {role}
        assert after_materials[role] == before_materials["linen"]
        assert before["sleep__linen"]["slots"] == ["linen"]
        assert after["sleep__linen"]["slots"] == ["linen", role]
        actual = {i for i, pair in enumerate(zip(before["sleep__linen"]["faces"], after["sleep__linen"]["faces"])) if pair[0] != pair[1]}
        assert actual == set(receipt["nativePolygonIndices"]), "Unowned face material changed"
    else:
        assert after_materials == before_materials
    assert after_materials[role]["bsdf"]["Emission Strength"] == 0
    restored = copy.deepcopy(config)
    original_rooms = {room["id"]: room for room in old_config["rooms"]}
    for room in restored["rooms"]:
        for key in (["lightRegion", "practicalSource"] if room["id"] == "sleep" else ["lightRegion"] if room["id"] == "library-upper" else []):
            if key in original_rooms[room["id"]]:
                room[key] = original_rooms[room["id"]][key]
            else:
                room.pop(key, None)
    assert restored == old_config, "Unowned manifest values changed"
    assert sha(source) == args.source_sha.lower(), "Input file changed"
    out.mkdir(parents=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(out / "candidate.blend"), compress=True)
    (out / "manifest.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf8")
    report = {
        "status": "qualified-private-replay", "source": str(source), "sourceSha256": args.source_sha,
        "manifestSourceSha256": sha(manifest), "candidateSha256": sha(out / "candidate.blend"),
        "manifestOutputSha256": sha(out / "manifest.json"), "blender": bpy.app.version_string,
        "nativeGeometryAndNumericAttributesExact": True, "allOriginalMaterialPropertiesExact": True,
        "onlyManifestChanges": ["sleep.lightRegion", "sleep.practicalSource", "library-upper.lightRegion"],
        "changedMeshAssignments": changed, "fixture": receipt,
        "retainedGlobeSha256": original_globe_sha,
        "owningSourceHashes": {name: sha(repo / name) for name in ["bin/coastal_architecture_finish.py", "bin/coastal_retreat.py"]},
        "before": before, "after": after,
        "next": "Coordinator exports only the affected sleep room, then performs combined AO/export/cache/signature and complete public appearance gates. No cache descriptor was signed by this replay.",
    }
    (out / "REPLAY.json.gz").write_bytes(gzip.compress(json.dumps(report).encode("utf8"), mtime=0))
    print(json.dumps({key: value for key, value in report.items() if key not in {"before", "after"}}))


if __name__ == "__main__":
    main()
