"""Orient the six physical caps in Arrival B's curved seat."""

from argparse import ArgumentParser
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import sys

import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from coastal_shell import _islands

SEAT = "core_entry_landscape_stone_seat"


def corner_payload(mesh):
    """Compare real material and per-corner payloads independent of face direction."""
    uv_layers = list(mesh.uv_layers)
    shades = [layer for layer in mesh.color_attributes if layer.domain == "CORNER"]
    return Counter(
        (
            face.material_index,
            tuple(
                sorted(
                    (
                        tuple(mesh.vertices[mesh.loops[loop].vertex_index].co),
                        tuple(tuple(layer.data[loop].uv) for layer in uv_layers),
                        tuple(tuple(layer.data[loop].color) for layer in shades),
                    )
                    for loop in face.loop_indices
                )
            ),
        )
        for face in mesh.polygons
    )


def orient_entry_seat(scene):
    obj = scene.objects[SEAT]
    before = corner_payload(obj.data)
    shape = bmesh.new()
    shape.from_mesh(obj.data)
    shape.normal_update()
    islands = _islands(shape)
    if len(islands) != 6:
        shape.free()
        raise ValueError(f"Expected six curved seat blocks, found {len(islands)}")
    touched, checks = [], []
    for island in islands:
        faces = {face for v in island for face in v.link_faces}
        if any(not edge.is_manifold or not edge.is_contiguous for v in island for edge in v.link_edges):
            shape.free()
            raise ValueError("A native seat component has a break in the solid")
        volume = sum(
            face.calc_area() * face.normal.dot(face.calc_center_median()) / 3 for face in faces
        )
        if abs(volume) < 1e-6:
            shape.free()
            raise ValueError("A native seat block has ambiguous orientation")
        top_z = max(v.co.z for v in island)
        tops = [face for face in faces if all(abs(v.co.z - top_z) < 1e-5 for v in face.verts)]
        if len(tops) != 1 or abs(tops[0].normal.z) < 0.999:
            shape.free()
            raise ValueError("Expected one level cap per curved seat block")
        if volume < 0:
            touched.extend(faces)
        checks.append(
            {"top": tops[0], "previousNormalZ": float(tops[0].normal.z), "inputSignedM3": volume}
        )
    if touched:
        bmesh.ops.reverse_faces(shape, faces=touched)
        shape.normal_update()
    caps = []
    for row in checks:
        top = row.pop("top")
        if top.normal.z < 0.999:
            shape.free()
            raise RuntimeError("A seat cap still faces down")
        caps.append(
            {
                **row,
                "finalNormalZ": float(top.normal.z),
                "nativeCenter": list(obj.matrix_world @ top.calc_center_median()),
                "capAreaM2": top.calc_area(),
            }
        )
    if touched:
        shape.to_mesh(obj.data)
        obj.data.update()
    shape.free()
    if corner_payload(obj.data) != before:
        raise RuntimeError(
            "Orientation must retain material assignment, positions, UV and baked corner data"
        )
    return {
        "mesh": obj.name,
        "flippedFaces": len(touched),
        "capCount": len(caps),
        "caps": caps,
        "cornerPayloadPreserved": True,
    }


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--expected-source", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    src, out, report = [p.resolve() for p in (args.source, args.output, args.report)]
    identity = digest(src)
    if identity != args.expected_source or len({src, out, report}) != 3:
        parser.error("Use a hash-pinned input and two separate outputs")
    out.parent.mkdir(parents=True, exist_ok=True)
    report.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(src))
    receipt = orient_entry_seat(bpy.context.scene)
    if receipt["flippedFaces"]:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(out), compress=True)
    else:
        out.write_bytes(src.read_bytes())
    receipt.update(sourceSha256=identity, outputSha256=digest(out))
    report.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
