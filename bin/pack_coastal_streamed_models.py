"""Partition the exported coastal shell and bedroom without re-encoding geometry."""

from argparse import ArgumentParser
from collections import defaultdict
from copy import deepcopy
import gzip
from hashlib import sha256
import json
from pathlib import Path
import struct

GLB_METADATA = ("extensionsRequired", "extensionsUsed", "asset", "extras")
FINISH_TEXTURES = {
    "baseColorTexture", "metallicRoughnessTexture", "normalTexture",
    "occlusionTexture", "specularTexture", "specularColorTexture",
    "sheenColorTexture", "sheenRoughnessTexture", "clearcoatTexture",
    "clearcoatRoughnessTexture", "clearcoatNormalTexture",
}
BAR_DETAIL = (
    "bottles", "glassware", "stoppers", "coasters", "speaker_hardware",
    "vu_needles", "amplifier_knobs", "bass_cones", "bass_surround",
    "compression_driver", "horn_bell", "horn_lip", "horn_shell",
    "stool_seats", "stool_legs", "stool_backs", "stool_back_stays",
    "stool_stretchers", "saddle_seats", "saddle_legs", "saddle_backs",
    "saddle_stays", "saddle_stretchers", "island_staves", "cabinet_crown",
    "cabinet_dividers", "bolsters", "cofactors", "lp_shelves",
    "loggia_ceiling_fan", "loggia_heat_fins", "loggia_shoulder_backing",
    "loggia_bench_seat", "loggia_bench_back", "loggia_bench_welt", "loggia_bench_apron",
    "loggia_scatter_cushions", "loggia_saddle_backs", "loggia_fire_coals", "loggia_paving",
    "records", "sofa_channels", "loose_cushion", "footrail", "lamp_cap", "entry_reeds",
)


def read_glb(path):
    data = path.read_bytes()
    magic, version, length, json_length, tag = struct.unpack_from("<4sIIII", data)
    if (magic, version, length, tag) != (b"glTF", 2, len(data), 0x4E4F534A):
        raise ValueError(f"{path}: expected a glTF 2.0 binary")
    binary_length, tag = struct.unpack_from("<II", data, 20 + json_length)
    if tag != 0x004E4942 or 28 + json_length + binary_length != len(data):
        raise ValueError(f"{path}: expected one embedded binary chunk")
    return json.loads(data[20:20 + json_length]), data[28 + json_length:]


def pack_glb(document, binary, wanted, *, keep_empties=False, deferred_materials=()):
    if len(document["buffers"]) != 1 or document["buffers"][0].get("uri"):
        raise ValueError("Expected one embedded buffer")
    if any(document.get(key) for key in ("animations", "skins", "cameras", "extensions")):
        raise ValueError("Expected the static native shell or bedroom export")

    output = {key: deepcopy(document[key]) for key in GLB_METADATA if key in document}
    indices = defaultdict(dict)
    payload = bytearray()
    nodes = document["nodes"]
    parents = {
        child: node_index
        for node_index, node in enumerate(nodes)
        for child in node.get("children", ())
    }
    keep = set(wanted)
    if keep_empties:
        keep.update(index for index, node in enumerate(nodes) if "mesh" not in node)
    for node_index in list(keep):
        while node_index in parents:
            node_index = parents[node_index]
            keep.add(node_index)

    def add(table, source_index):
        if source_index in indices[table]:
            return indices[table][source_index]
        entry = deepcopy(document[table][source_index])
        entries = output.setdefault(table, [])
        output_index = len(entries)
        indices[table][source_index] = output_index
        entries.append(entry)

        if table == "nodes":
            if entry.get("extensions"):
                raise ValueError(f"Unsupported node extension on {entry.get('name')}")
            if "mesh" in entry:
                if source_index in wanted:
                    entry["mesh"] = add("meshes", entry["mesh"])
                else:
                    del entry["mesh"]
            if "children" in entry:
                children = [add("nodes", child) for child in entry["children"] if child in keep]
                if children:
                    entry["children"] = children
                else:
                    del entry["children"]
        elif table == "meshes":
            if entry.get("extensions"):
                raise ValueError(f"Unsupported mesh extension on {entry.get('name')}")
            for primitive in entry["primitives"]:
                if "material" in primitive:
                    primitive["material"] = add("materials", primitive["material"])
                if "indices" in primitive:
                    primitive["indices"] = add("accessors", primitive["indices"])
                primitive["attributes"] = {
                    key: add("accessors", value) for key, value in primitive["attributes"].items()
                }
                if "targets" in primitive:
                    primitive["targets"] = [
                        {key: add("accessors", value) for key, value in target.items()}
                        for target in primitive["targets"]
                    ]
                extensions = primitive.get("extensions", {})
                if extensions:
                    if set(extensions) != {"KHR_draco_mesh_compression"}:
                        raise ValueError(f"Unsupported primitive extensions: {sorted(extensions)}")
                    draco = extensions["KHR_draco_mesh_compression"]
                    draco["bufferView"] = add("bufferViews", draco["bufferView"])
        elif table == "materials":
            remap_material(entry, entry.get("name") in deferred_materials)
        elif table == "textures":
            if "source" in entry:
                entry["source"] = add("images", entry["source"])
            if "sampler" in entry:
                entry["sampler"] = add("samplers", entry["sampler"])
            for extension, value in entry.get("extensions", {}).items():
                if extension not in ("EXT_texture_webp", "KHR_texture_basisu"):
                    raise ValueError(f"Unsupported texture extension: {extension}")
                value["source"] = add("images", value["source"])
        elif table == "images":
            if entry.get("uri"):
                raise ValueError("Expected images embedded in the native model")
            entry["bufferView"] = add("bufferViews", entry["bufferView"])
        elif table == "accessors":
            if "bufferView" in entry:
                entry["bufferView"] = add("bufferViews", entry["bufferView"])
            if "sparse" in entry:
                for value in (entry["sparse"]["indices"], entry["sparse"]["values"]):
                    value["bufferView"] = add("bufferViews", value["bufferView"])
        elif table == "bufferViews":
            if entry.get("buffer", 0) != 0 or entry.get("extensions"):
                raise ValueError("Unsupported buffer view")
            start = entry.get("byteOffset", 0)
            end = start + entry["byteLength"]
            if start < 0 or end > len(binary):
                raise ValueError("Buffer view outside the native model")
            payload.extend(b"\0" * (-len(payload) % 4))
            entry["byteOffset"] = len(payload)
            payload.extend(binary[start:end])
        elif table != "samplers":
            raise ValueError(f"Unsupported glTF table: {table}")
        return output_index

    def remap_material(properties, strip):
        for key, value in list(properties.items()):
            if key == "extras" or not isinstance(value, dict):
                continue
            if key.lower().endswith("texture") and isinstance(value.get("index"), int):
                if strip and key in FINISH_TEXTURES:
                    del properties[key]
                else:
                    value["index"] = add("textures", value["index"])
            else:
                remap_material(value, strip)

    output["scene"] = document.get("scene", 0)
    output["scenes"] = []
    for source_scene in document["scenes"]:
        scene = deepcopy(source_scene)
        scene["nodes"] = [add("nodes", node) for node in source_scene["nodes"] if node in keep]
        output["scenes"].append(scene)
    payload.extend(b"\0" * (-len(payload) % 4))
    output["buffers"] = [{"byteLength": len(payload)}]

    for source_index, output_index in indices["bufferViews"].items():
        source = document["bufferViews"][source_index]
        destination = output["bufferViews"][output_index]
        start = source.get("byteOffset", 0)
        end = destination["byteOffset"]
        length = source["byteLength"]
        if binary[start:start + length] != payload[end:end + length]:
            raise ValueError("Packed binary no longer matches authored GLB")

    metadata = json.dumps(output, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    metadata += b" " * (-len(metadata) % 4)
    header = struct.pack("<4sIIII", b"glTF", 2, 28 + len(metadata) + len(payload), len(metadata), 0x4E4F534A)
    return header + metadata + struct.pack("<II", len(payload), 0x004E4942) + payload


def pack_model(output_dir, filename, document, binary, members, **options):
    data = pack_glb(document, binary, members, **options)
    (output_dir / filename).write_bytes(data)
    return {
        "file": filename,
        "bytes": len(data),
        "gzip6": len(gzip.compress(data, compresslevel=6, mtime=0)),
        "sha256": sha256(data).hexdigest(),
        "nodes": node_names(document, members),
    }


def node_names(document, indices):
    return [document["nodes"][index]["name"] for index in sorted(indices)]


def finish_donors(document, mesh_nodes):
    materials = document["materials"]
    choices = {}
    for index in mesh_nodes:
        mesh = document["meshes"][document["nodes"][index]["mesh"]]
        for primitive in mesh["primitives"]:
            if "material" not in primitive:
                continue
            material = materials[primitive["material"]]
            name = material["name"]
            if name != "Silver pea gravel" and not name.startswith("listening room "):
                continue
            if not any(key in json.dumps(material) for key in FINISH_TEXTURES):
                continue
            draco = primitive.get("extensions", {}).get("KHR_draco_mesh_compression")
            if draco is None:
                raise ValueError(f"Expected Draco for finish donor: {name}")
            size = document["bufferViews"][draco["bufferView"]]["byteLength"]
            candidate = (size, index)
            choices[name] = min(choices.get(name, candidate), candidate)
    return {name: choices[name][1] for name in sorted(choices)}


def pack_shell(path, output_dir):
    document, binary = read_glb(path)
    nodes = document["nodes"]
    mesh_nodes = [index for index, node in enumerate(nodes) if "mesh" in node]
    bar = set()
    bath = set()
    garden = set()
    entry_art = set()
    pool_relief = set()
    expanded_terrace = any(node["name"].startswith("core_arrival_B_") for node in nodes if "mesh" in node)
    prefixes = tuple(f"core_speakeasy_{part}__" for part in BAR_DETAIL)
    for index in mesh_nodes:
        node = nodes[index]
        name = node["name"]
        extras = node.get("extras", {})
        if name.startswith(prefixes) and not extras.get("action"):
            bar.add(index)
        elif name.startswith("core_bath_roji_") and (
            extras.get("walk") == "through" or name in ("core_bath_roji_maple_limb", "core_bath_roji_culms")
        ):
            bath.add(index)
        elif name.startswith("core_entry_landscape_"):
            entry_art.add(index)
        elif name.startswith("core_pool_tide_relief_"):
            pool_relief.add(index)
        elif name.startswith("core_estate_garden_flora_") or (
            expanded_terrace and (
                name.startswith("core_retreat_roof_planting__")
                or name in (
                    "core__blue sage agave leaf",
                    "core_retreat_clifftop__linen",
                    "core_retreat_clifftop__honey ash",
                    "core_retreat_clifftop__honed travertine",
                )
            )
        ):
            garden.add(index)
    if not all((bar, bath, garden)):
        raise ValueError("The authored shell is missing a listening room, bath garden, or court detail pack")
    if len(set(node_names(document, mesh_nodes))) != len(mesh_nodes):
        raise ValueError("The authored shell needs unique mesh owner names for its streaming manifest")

    coves = [nodes[i]["extras"]["listeningCoveWorld"] for i in mesh_nodes
             if nodes[i].get("extras", {}).get("listeningCoveWorld")]
    if len(coves) > 1:
        raise ValueError("The listening-room cove must have one native fixture")
    hearths = [nodes[i]["extras"]["terraceFireWorld"] for i in mesh_nodes
               if "terraceFireWorld" in nodes[i].get("extras", {})]
    if len(hearths) > 1:
        raise ValueError("Expected one fire bowl on the listening terrace")
    donors = finish_donors(document, mesh_nodes)
    bar_donors = {index for name, index in donors.items() if name.startswith("listening room ")}
    bath_donors = set(donors.values()) - bar_donors
    primary = set(mesh_nodes) - bar - bath - garden - entry_art - pool_relief
    def emit(filename, members, **options):
        return pack_model(output_dir, filename, document, binary, members, **options)

    return {
        "shell": emit("home-shell.glb", primary, keep_empties=True, deferred_materials=donors),
        "bar": emit("detail-listening-bar.glb", bar | bar_donors),
        "bath": emit("detail-ocean-baths.glb", bath | bath_donors),
        "garden": emit("detail-court-garden.glb", garden),
        "barGeometryOnly": node_names(document, bar),
        "bathGeometryOnly": node_names(document, bath),
        "gardenGeometryOnly": node_names(document, garden),
        "expandedUpperTerrace": expanded_terrace,
        **({"terraceFireWorld": hearths[0]} if hearths else {}),
        **({"listeningCoveWorld": coves[0]} if coves else {}),
        "finishMaterials": {name: nodes[index]["name"] for name, index in donors.items()},
        **(
            {"entryArt": emit("detail-entry-art.glb", entry_art), "entryArtGeometryOnly": node_names(document, entry_art)}
            if entry_art
            else {}
        ),
        **(
            {"poolRelief": emit("detail-pool-relief.glb", pool_relief), "poolReliefGeometryOnly": node_names(document, pool_relief)}
            if pool_relief
            else {}
        ),
    }


def pack_bedroom(path, output_dir):
    document, binary = read_glb(path)
    variants = defaultdict(set)
    primary = set()
    for index, node in enumerate(document["nodes"]):
        if "mesh" not in node:
            continue
        variant = node.get("extras", {}).get("bedding")
        if variant is None:
            primary.add(index)
        elif not isinstance(variant, str) or not variant or any(
            char not in "abcdefghijklmnopqrstuvwxyz0123456789-" for char in variant
        ):
            raise ValueError(f"Invalid native bedding variant: {variant}")
        else:
            variants[variant].add(index)
    if "empty" not in variants:
        raise ValueError("The native bedroom needs a made bed tagged bedding=empty")
    return {
        "sleepBase": pack_model(output_dir, "room-sleep.glb", document, binary, primary, keep_empties=True),
        "bedding": {
            key: pack_model(output_dir, f"bedding-{key}.glb", document, binary, variants[key])
            for key in sorted(variants)
        },
    }



LIBRARY_BOOK_MATERIALS = {
    "library warm paper edges", "library clay cloth", "library slate cloth",
    "library ochre cloth", "library olive cloth",
}


def provided_room_parts(source_dir, output_dir, include_onsen):
    reports = {}
    rooms = ["library", "bath-living", "bath-bedroom"]
    if include_onsen:
        rooms.append("onsen")
    for room in rooms:
        source = source_dir / f"room-{room}.glb"
        document, binary = read_glb(source)
        meshes = {index: node for index, node in enumerate(document["nodes"]) if "mesh" in node}

        def optional(node):
            name = node["name"]
            extras = node.get("extras", {})
            if any(extras.get(key) for key in ("action", "estateDoor", "facadeDoor", "caveRoof", "bathroomCeilingFor", "roomCeilingFor")):
                return False
            if room == "library":
                return name.rsplit("__", 1)[-1] in LIBRARY_BOOK_MATERIALS
            if room == "onsen":
                return name in {"onsen_decor warm cut stone", "onsen__olive leaf", "onsen__terracotta"}
            if any(token in name.lower() for token in ("door", "partition", "shell", "floor", "ceiling", "wall")):
                return False
            return name.rsplit("__", 1)[-1] not in {"chalk limestone", "honed travertine", "warm cut stone", "bathroom wall plaster"}

        detail = {index for index, node in meshes.items() if optional(node)}
        if not detail or len(detail) == len(meshes):
            raise ValueError(f"{room}: the regional delivery needs both structural and detail mesh owners")
        reports[room] = {
            "base": pack_model(output_dir, source.name, document, binary, set(meshes) - detail, keep_empties=True),
            "detail": pack_model(output_dir, f"detail-{room}.glb", document, binary, detail),
            "source": file_receipt(source),
            "geometryOnly": node_names(document, detail),
        }
    return reports


def file_receipt(path):
    data = path.read_bytes()
    return {"file": path.name, "bytes": len(data), "sha256": sha256(data).hexdigest()}


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--shell", required=True, type=Path)
    parser.add_argument("--bedroom", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--room-source", type=Path)
    parser.add_argument("--onsen-detail", action="store_true", help="Pack the decorative rock and plants separately")
    parser.add_argument("--export-report", type=Path, help="Preserve the native export receipt beside the packed outputs")
    args = parser.parse_args()
    if args.onsen_detail and not args.room_source:
        parser.error("--onsen-detail requires --room-source")
    for path in (args.shell, args.bedroom, args.export_report):
        if path is not None and not path.is_file():
            parser.error(f"Missing input file: {path}")
    if args.out_dir.exists() and any(args.out_dir.iterdir()):
        parser.error("Supply an empty package directory")
    args.out_dir.mkdir(parents=True, exist_ok=True)
    report = pack_shell(args.shell, args.out_dir)
    report.update(pack_bedroom(args.bedroom, args.out_dir))
    if args.room_source:
        report["roomDetails"] = provided_room_parts(args.room_source, args.out_dir, args.onsen_detail)
    report["nativeSources"] = {"shell": file_receipt(args.shell), "bedroom": file_receipt(args.bedroom)}
    if args.export_report:
        receipt = args.out_dir / "native-export-report.json"
        receipt.write_bytes(args.export_report.read_bytes())
        report["nativeSources"]["exportReport"] = file_receipt(receipt)
    output = args.out_dir / "split-report.json"
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(output)


if __name__ == "__main__":
    main()
