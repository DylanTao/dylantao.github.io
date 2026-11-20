"""Transplant only the freshly cleared native canopy primitive into the shipping GLB."""
from copy import deepcopy
from hashlib import sha256
import argparse
import json
from pathlib import Path
import struct

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--base", type=Path, required=True)
parser.add_argument("--replacement", type=Path, required=True)
parser.add_argument("--out", type=Path, required=True)
args = parser.parse_args()

BASE_SHA = "93f90372bba71c64b6153372ae3166901aacaa8633277e18f1afbe49e8986832"
OWNER = "hinterland_flora_10_09"
MAT = "hinterland scrub canopy"
EXT = "KHR_draco_mesh_compression"

def read_glb(file):
    data = file.read_bytes()
    magic, version, size, json_length, json_type = struct.unpack_from("<4sIIII", data)
    assert (magic, version, size, json_type) == (b"glTF", 2, len(data), 0x4E4F534A)
    doc = json.loads(data[20:20 + json_length])
    size, kind = struct.unpack_from("<II", data, 20 + json_length)
    payload = data[28 + json_length:]
    assert kind == 0x004E4942 and len(payload) == size and len(doc["buffers"]) == 1
    return doc, payload, sha256(data).hexdigest()

def canopy(doc):
    node = next(n for n in doc["nodes"] if n.get("name") == OWNER)
    primitive = next(
        p for p in doc["meshes"][node["mesh"]]["primitives"]
        if doc["materials"][p["material"]]["name"] == MAT
    )
    return node, primitive

def binary(doc, data, index):
    view = doc["bufferViews"][index]
    start = view.get("byteOffset", 0)
    return data[start:start + view["byteLength"]]

def pad(data, byte):
    return data + byte * (-len(data) % 4)

base, base_bin, base_hash = read_glb(args.base)
replacement, replace_bin, replace_hash = read_glb(args.replacement)
assert base_hash == BASE_SHA
before = deepcopy(base)
base_node, base_canopy = canopy(base)
new_node, new_canopy = canopy(replacement)
clone_meta = lambda node: {k: v for k, v in node.items() if k != "mesh"}
assert clone_meta(base_node) == clone_meta(new_node)
assert base["materials"][base_canopy["material"]] == replacement["materials"][new_canopy["material"]]
assert base_canopy["mode"] == new_canopy["mode"] == 4
assert base_canopy[ "extensions"][EXT]["attributes"] == new_canopy["extensions"][EXT]["attributes"]
old_index = base_canopy["extensions"][EXT]["bufferView"]
new_index = new_canopy["extensions"][EXT]["bufferView"]
body = binary(replacement, replace_bin, new_index)
view = base["bufferViews"][old_index]
start = view.get("byteOffset", 0)
end = start + len(pad(binary(base, base_bin, old_index), b"\0"))
new_body = pad(body, b"\0")
delta = len(new_body) - (end - start)
assert start % 4 == end % 4 == delta % 4 == 0
assert len(body) == replacement["bufferViews"][new_index]["byteLength"]
output_bin = base_bin[:start] + new_body + base_bin[end:]
for index, row in enumerate(base["bufferViews"]):
    offset = row.get("byteOffset", 0)
    if index == old_index:
        row["byteLength"] = len(body)
    elif offset >= end:
        row["byteOffset"] = offset + delta
    elif offset + row["byteLength"] > start:
        raise ValueError(f"Unexpected data alias in bufferView {index}")
    if index != old_index:
        assert binary(base, output_bin, index) == binary(before, base_bin, index)
base["buffers"][0]["byteLength"] += delta
old_ids = [base_canopy["indices"], *base_canopy["attributes"].values()]
new_ids = [new_canopy["indices"], *(new_canopy["attributes"][key] for key in base_canopy["attributes"])]
assert len(set(old_ids)) == len(old_ids)
for old_id, new_id in zip(old_ids, new_ids):
    new_field = replacement["accessors"][new_id]
    assert "bufferView" not in base["accessors"][old_id] and "bufferView" not in new_field
    for key in ("type", "componentType", "normalized", "min", "max"):
        assert base["accessors"][old_id].get(key) == new_field.get(key), (key, old_id)
    base["accessors"][old_id] = new_field
old_count = before["accessors"][old_ids[0]]["count"] // 3
new_count = base["accessors"][old_ids[0]]["count"] // 3
assert old_count - new_count == 111
assert all(a == b for i, (a, b) in enumerate(zip(before["accessors"], base["accessors"])) if i not in old_ids)
assert all(base[k] == before[k] for k in ("nodes", "scenes", "meshes", "materials", "extensionsUsed"))
header = pad(json.dumps(base, separators=(",", ":"), ensure_ascii=False).encode("utf-8"), b" ")
target = (
    struct.pack("<4sIIII", b"glTF", 2, 28 + len(header) + len(output_bin), len(header), 0x4E4F534A)
    + header + struct.pack("<II", len(output_bin), 0x004E4942) + output_bin
)
assert not args.out.exists()
args.out.write_bytes(target)
check = {
    "owner": OWNER, "material": MAT, "originalGLBSha256": base_hash, "replacementGLBSha256": replace_hash,
    "candidateGLBSha256": sha256(target).hexdigest(), "candidateGLBBytes": len(target),
    "untouchedBufferViews": len(base["bufferViews"]) - 1, "untouchedPrimitives": sum(len(m["primitives"]) for m in base["meshes"]) - 1,
    "originalCanopyTriangles": old_count, "retainedCanopyTriangles": new_count, "removedCanopyTriangles": old_count - new_count,
}
args.out.with_name("GLB-SPLICE-VERIFICATION.json").write_text(json.dumps(check, indent=2) + "\n", encoding="utf-8")
print(json.dumps(check, indent=2))
