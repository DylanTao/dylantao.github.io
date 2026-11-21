"""Append Draco pine branch primitives to the delivered hinterland without re-encoding it."""

from argparse import ArgumentParser
from copy import deepcopy
import gzip
from hashlib import sha256
import json
from pathlib import Path
import struct

from pack_coastal_streamed_models import read_glb

EXT = "KHR_draco_mesh_compression"
SUPPORT = "hinterland_pine_support_"
TRUNK_MATERIAL = "hinterland pine trunk"


def add_branches(base, base_bin, added, added_bin):
    before = deepcopy(base)
    tables = ("nodes", "meshes", "accessors", "bufferViews")
    offset = {table: len(base[table]) for table in tables}
    if any(len(document["buffers"]) != 1 or document["buffers"][0].get("uri") for document in [base, added]):
        raise ValueError("Pine supports require single-buffer embedded GLBs")
    if any(len(document["scenes"]) != 1 for document in [base, added]) or added["scenes"][0]["nodes"] != list(
        range(len(added["nodes"]))
    ):
        raise ValueError("Pine supports must be independent root nodes in the sole scene")
    if list(added.get("extensionsRequired", ())) != [EXT] or EXT not in base.get("extensionsRequired", ()):
        raise ValueError("Pine supports must use the retained Draco codec")
    if any(added.get(key) for key in ("animations", "images", "textures", "skins", "cameras")):
        raise ValueError("Pine support export should contain only the branches")
    if len(added["materials"]) != 1 or added["materials"][0].get("name") != TRUNK_MATERIAL:
        raise ValueError("Pine supports must use the retained pine bark")
    material = base["materials"].index(added["materials"][0])
    original_names = {row.get("name") for row in base["nodes"]}
    names = {row.get("name", "") for row in added["nodes"]}
    if not names or len(names) != len(added["nodes"]) or any(not name.startswith(SUPPORT) for name in names):
        raise ValueError("Unexpected support node name")
    if original_names & names:
        raise ValueError("These support nodes are already present")

    binary_offset = len(base_bin)
    for row in added["bufferViews"]:
        if row.get("buffer", 0) != 0 or row.get("extensions"):
            raise ValueError("Unsupported branch buffer view")
        row["byteOffset"] = binary_offset + row.get("byteOffset", 0)
    for row in added["accessors"]:
        if "bufferView" in row or "sparse" in row:
            raise ValueError("Expected branch accessors carried solely by Draco")
    for mesh in added["meshes"]:
        if len(mesh["primitives"]) != 1:
            raise ValueError("One pine bark primitive is expected per spatial cell")
        primitive = mesh["primitives"][0]
        if set(primitive["extensions"]) != {EXT} or primitive["material"] != 0 or primitive.get("mode", 4) != 4:
            raise ValueError("Unexpected branch primitive fields")
        if set(primitive["attributes"]) != {"POSITION", "NORMAL", "COLOR_0"}:
            raise ValueError("Branches must retain geometry and baked vertex colour")
        primitive["material"] = material
        primitive["indices"] += offset["accessors"]
        for key in primitive["attributes"]:
            primitive["attributes"][key] += offset["accessors"]
        primitive["extensions"][EXT]["bufferView"] += offset["bufferViews"]
    for node in added["nodes"]:
        if "children" in node or "skin" in node or "extensions" in node:
            raise ValueError("Unsupported branch node hierarchy")
        node["mesh"] += offset["meshes"]
    for table in tables:
        base[table].extend(added[table])
        assert base[table][: offset[table]] == before[table]
    base["scenes"][0]["nodes"].extend(offset["nodes"] + node for node in added["scenes"][0]["nodes"])
    assert base["scenes"][0]["nodes"][: len(before["scenes"][0]["nodes"])] == before["scenes"][0]["nodes"]
    binary = base_bin + added_bin
    base["buffers"][0]["byteLength"] = len(binary)
    assert base["materials"] == before["materials"] and binary.startswith(base_bin)
    return base, binary, sorted(names), offset


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, required=True)
    parser.add_argument("--supports", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    paths = [p.resolve() for p in [args.base, args.supports, args.out, args.report]]
    if len(set(paths)) != len(paths):
        parser.error("input, output and report paths must be different")
    base, base_bin = read_glb(args.base)
    added, added_bin = read_glb(args.supports)
    original_triangles = sum(
        base["accessors"][p["indices"]]["count"] // 3 for m in base["meshes"] for p in m["primitives"]
    )
    original_primitives = sum(len(m["primitives"]) for m in base["meshes"])
    model, binary, names, offset = add_branches(base, base_bin, added, added_bin)
    assert len(binary) % 4 == 0
    document = json.dumps(model, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    document += b" " * (-len(document) % 4)
    packed = (
        struct.pack("<4sIIII", b"glTF", 2, 28 + len(document) + len(binary), len(document), 0x4E4F534A)
        + document
        + struct.pack("<II", len(binary), 0x004E4942)
        + binary
    )
    old = args.base.read_bytes()
    args.out.write_bytes(packed)
    assert read_glb(args.out) == (model, binary)
    total = sum(model["accessors"][p["indices"]]["count"] // 3 for m in model["meshes"] for p in m["primitives"])
    report = {
        "originalSha256": sha256(old).hexdigest(),
        "newSha256": sha256(packed).hexdigest(),
        "rawBytes": len(packed),
        "additionalRawBytes": len(packed) - len(old),
        "gzip6Bytes": len(gzip.compress(packed, compresslevel=6, mtime=0)),
        "additionalGzip6Bytes": len(gzip.compress(packed, compresslevel=6, mtime=0))
        - len(gzip.compress(old, compresslevel=6, mtime=0)),
        "originalTriangles": original_triangles,
        "totalTriangles": total,
        "addedTriangles": total - original_triangles,
        "unchangedPrimitives": original_primitives,
        "unchangedOriginalBinaryBytes": len(base_bin),
        "unchangedTablePrefixes": offset,
        "newNodes": names,
    }
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
