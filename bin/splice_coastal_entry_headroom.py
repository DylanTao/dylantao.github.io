"""Transplant the fitted canopy or the bedroom window into its packed carrier."""

from argparse import ArgumentParser
from hashlib import sha256
import json
from pathlib import Path
import struct

from pack_coastal_streamed_models import read_glb


CANOPY = tuple("core_entry_leaf_" + name + "__" for name in ("laminated_glass", "rims", "cantilevers", "rain_chains"))
BEDROOM = ("sleep_fin_window__brushed brass", "sleep_fin_window__facade low-iron glass")
DRACO = "KHR_draco_mesh_compression"


def geometry(document, piece):
    matches = [node for node in document["nodes"] if node.get("name", "").startswith(piece)]
    if len(matches) != 1:
        raise ValueError(f"Expected one packed member for {piece}")
    node = matches[0]
    primitive, = document["meshes"][node["mesh"]]["primitives"]
    return node, primitive


def contents(view, payload):
    offset = view.get("byteOffset", 0)
    return payload[offset:offset + view["byteLength"]]


def splice(base, replacement, output, members=CANOPY):
    house, old_payload = read_glb(base)
    fresh, new_payload = read_glb(replacement)
    if len(house["buffers"]) != 1 or len(fresh["buffers"]) != 1:
        raise ValueError("Expected a single embedded GLB buffer")
    replacements = {}
    for piece in members:
        before_node, before = geometry(house, piece)
        after_node, after = geometry(fresh, piece)
        old_material = house["materials"][before["material"]]["name"]
        new_material = fresh["materials"][after["material"]]["name"]
        transform = ("translation", "rotation", "scale", "matrix")
        if old_material != new_material or any(before_node.get(key) != after_node.get(key) for key in transform):
            raise ValueError(f"{piece}: changed transform or finish")
        if before["attributes"].keys() != after["attributes"].keys():
            raise ValueError(f"{piece}: expected the same packed vertex attributes")

        old_draco, new_draco = before["extensions"][DRACO], after["extensions"][DRACO]
        view = old_draco["bufferView"]
        if view in replacements:
            raise ValueError("Multiple members share a compressed view")
        replacements[view] = contents(fresh["bufferViews"][new_draco["bufferView"]], new_payload)
        old_draco["attributes"] = new_draco["attributes"]
        old_ids = [before["indices"], *before["attributes"].values()]
        new_ids = [after["indices"], *(after["attributes"][key] for key in before["attributes"])]
        for old_index, new_index in zip(old_ids, new_ids):
            old = house["accessors"][old_index]
            new = fresh["accessors"][new_index]
            if "bufferView" in old or "bufferView" in new or "sparse" in old or "sparse" in new:
                raise ValueError(f"{piece}: expected fully compressed geometry")
            if any(old.get(key) != new.get(key) for key in ("type", "componentType", "normalized")):
                raise ValueError(f"{piece}: changed packed attribute representation")
            house["accessors"][old_index] = new

    payload = bytearray()
    for index, view in enumerate(house["bufferViews"]):
        original = contents(view, old_payload)
        body = replacements.get(index, original)
        view["byteOffset"], view["byteLength"] = len(payload), len(body)
        payload.extend(body)
        payload.extend(b"\0" * (-len(payload) % 4))
    house["buffers"][0]["byteLength"] = len(payload)
    header = json.dumps(house, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    header += b" " * (-len(header) % 4)
    result = (
        struct.pack("<4sIIII", b"glTF", 2, 28 + len(header) + len(payload), len(header), 0x4E4F534A)
        + header
        + struct.pack("<II", len(payload), 0x004E4942)
        + payload
    )
    output.write_bytes(result)
    print(f"{output.name}: replaced {len(replacements)} geometry views, SHA-256 {sha256(result).hexdigest()}")


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, required=True)
    parser.add_argument("--replacement", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--members", choices=("entry-canopy", "bedroom-window"), default="entry-canopy")
    args = parser.parse_args()
    if args.out.resolve() in (args.base.resolve(), args.replacement.resolve()):
        raise SystemExit("Write the candidate to a separate path")
    splice(args.base, args.replacement, args.out, BEDROOM if args.members == "bedroom-window" else CANOPY)
