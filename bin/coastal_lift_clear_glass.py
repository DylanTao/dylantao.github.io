"""Refit the embedded cliff lift with clear telescoping ocean-side gates.

Run in Blender with --source INPUT.blend --output NEW.blend --report REPORT.json
after the -- separator. The source must already contain the splayed ocean window.
"""

import argparse
from array import array
from hashlib import file_digest, sha256
import json
from pathlib import Path
import sys

import bpy

bin_dir = Path(__file__).resolve().parent
if not (bin_dir / "coastal_cliff_lift.py").is_file():
    bin_dir = Path.cwd() / "bin"
sys.path.insert(0, str(bin_dir))
import coastal_cliff_lift as lift
import coastal_decor as decor
from coastal_arrival_upper_link import mesh_digest
from coastal_breakfast_nook import _subset
from coastal_listening_bar import GLASS, Joinery
from coastal_listening_joinery import WALNUT, contours, map_finish

PREFIX = "core_cliff_lift_"
BRONZE = "ocean lift dry bronze"
OCEAN = ("cabDoorBeach", "beachGate")
WINDOW_OLD = PREFIX + "ocean_window_bronze_edge__brushed brass"
FIXED_OLD = (PREFIX + "ocean_reveal__listening room brushed copper", PREFIX + "reveal_lamp__bar opal strip", WINDOW_OLD)
DOCK_BUILD = ("stone_door_head", "stone_door_jamb")
HEAD_BOTTOM = 2.046
DECK_DAYLIGHT = 0.036


def digest(file):
    with file.open("rb") as handle:
        return file_digest(handle, "sha256").hexdigest()


def target_kind(obj):
    name = obj.name
    if name in FIXED_OLD:
        return "drop"
    if name.startswith(tuple(PREFIX + p + "_" for p in OCEAN)):
        return "moving"
    if name.startswith(tuple(PREFIX + p + "__" for p in DOCK_BUILD)):
        return "mixed entrance"
    return None


def tag_dynamic(obj, kind, slide):
    obj["cliffLiftPart"] = kind
    obj["cliffLiftSlide"] = slide
    obj["dynamic"] = True
    obj["walk"] = "through"


def pane(j, piece, plane, level, lo, hi):
    lift.gate_box(j, piece, GLASS, "north", plane - 0.004, plane + 0.004, lo, hi, level + DECK_DAYLIGHT, level + 2.053)
    lift.gate_box(j, piece, BRONZE, "north", plane - 0.010, plane + 0.001, lo, hi, level + 0.020, level + 0.041)
    lift.gate_box(j, piece, BRONZE, "north", plane - 0.010, plane + 0.001, lo, hi, level + HEAD_BOTTOM, level + 2.065)


def toe(j, piece, plane, base, lo, hi):
    rings = []
    bevel = 0.002
    for i in range(7):
        u = lo + (hi - lo) * i / 6
        curve = 0.0028 * (1 - (u / 0.55) ** 2)
        near, far = plane - 0.0105 - curve, plane - 0.0022 - curve
        low, high = base + 0.07, base + 0.114
        around = [
            (near + bevel, low),
            (far - bevel, low),
            (far, low + bevel),
            (far, high - bevel),
            (far - bevel, high),
            (near + bevel, high),
            (near, high - bevel),
            (near, low + bevel),
        ]
        rings.append([(lift.CX + u, y, z) for y, z in around])
    contours(j, piece, WALNUT, rings, caps=True, smooth=False)


def ocean_leaves(j):
    # Keep both pairs of two telescoping leaves, their two original guide planes
    # and exact slide travel. A five-millimetre clear meeting and a two-millimetre
    # horizontal lap at the separated tracks leave the whole view transparent.
    for kind, datum, level in (
        ("cabDoorBeach", lift.Y1 - 0.079 - 0.003, lift.TOP),
        ("beachGate", lift.Y1 + 0.012, lift.BEACH),
    ):
        for label, sign in (("left", -1), ("right", 1)):
            for index, (a, b) in enumerate(((0.0025, 0.277), (0.275, 0.545))):
                piece = f"{kind}_{label}_{index}"
                lo, hi = sorted((sign * a, sign * b))
                plane = datum + (0.008 if index else -0.008)
                pane(j, piece, plane, level, lo, hi)
                if kind == "cabDoorBeach":
                    toe(j, piece, plane, level, lo, hi)


def shaft_head(j):
    # Keep bronze up in the head pocket. The old bottom fascia and long fixed
    # fin in front of the ocean are absent. The side guides already in the
    # section stay integrated with the stone and have no cross-venue members.
    native = [(-14.23, 10.57), (-13.91, 10.70), (-13.51, 10.74), (-13.11, 10.70), (-12.79, 10.57)]
    rings = []
    for x, y in native:
        rings.append([(x, y + dy, z) for dy, z in ((-0.023, 2.047), (-0.011, 2.047), (-0.011, 2.070), (-0.023, 2.070))])
    contours(j, "ocean_window_head_pocket", BRONZE, rings, caps=True, smooth=False)


def landing_trim(j):
    # Retain two landing-side jambs only. The continuous header is recessed
    # on the room side and its lower edge is above the walking line.
    depth = lift.Y1
    floor = lift.BEACH
    lift.gate_box(
        j,
        "ocean_landing_head",
        BRONZE,
        "north",
        depth - 0.013,
        depth + 0.006,
        -0.623,
        0.623,
        floor + 2.096,
        floor + 2.131,
    )
    for sign in (-1, 1):
        lo, hi = sorted((sign * 0.603, sign * 0.621))
        lift.gate_box(
            j,
            "ocean_landing_jambs",
            BRONZE,
            "north",
            depth - 0.013,
            depth + 0.006,
            lo,
            hi,
            floor + 0.006,
            floor + 2.096,
        )


def validate_parts(scene):
    required = {"cab", "cabDoorTop", "cabDoorBeach", "topGate", "beachGate"}
    found = {o.get("cliffLiftPart") for o in scene.objects if o.get("cliffLiftPart")}
    assert required <= found
    selected = [o for o in scene.objects if o.get("cliffLiftPart") in OCEAN]
    rows = []
    for o in selected:
        n = o.name
        kind = o.get("cliffLiftPart")
        side = "left" if "_left_" in n else "right"
        index = 0 if "_0__" in n else 1
        assert o["cliffLiftSlide"] == (-1 if side == "left" else 1) * (0.54 if index == 0 else 0.27)
        assert o["walk"] == "through" and o["dynamic"] and o["installationGroup"] == "cliff-lift"
        coordinates = [o.matrix_world @ v.co for v in o.data.vertices]
        lo = tuple(min(c) for c in zip(*coordinates))
        hi = tuple(max(c) for c in zip(*coordinates))
        material = o.data.materials[0].name
        if material == BRONZE:
            z0 = lift.TOP if kind == "cabDoorBeach" else lift.BEACH
            assert all(v[2] < z0 + 0.043 or v[2] > z0 + 2.044 for v in coordinates)
        rows.append(
            {"name": n, "kind": kind, "slide": o["cliffLiftSlide"], "material": material, "nativeBounds": [lo, hi]}
        )
    assert len(selected) == 20
    assert sum(row["material"] == GLASS for row in rows) == 8
    return rows


def property_snapshot(value):
    if hasattr(value, "to_dict"):
        value = value.to_dict()
    elif hasattr(value, "to_list"):
        value = value.to_list()
    if isinstance(value, dict):
        return tuple(sorted((name, property_snapshot(item)) for name, item in value.items()))
    if isinstance(value, (list, tuple)):
        return tuple(property_snapshot(item) for item in value)
    if isinstance(value, bpy.types.ID):
        return (type(value).__name__, value.name_full)
    return value


def mesh_snapshot(scene):
    """Bind all meshes outside the installation to their actual native data."""
    snapshot = {}
    for obj in scene.objects:
        if obj.type != "MESH":
            continue
        mesh = obj.data
        normals = array("f", [0.0]) * (3 * len(mesh.corner_normals))
        if normals:
            mesh.corner_normals.foreach_get("vector", normals)
        snapshot[obj.name] = (
            mesh_digest(mesh),
            tuple(tuple(row) for row in obj.matrix_world),
            sha256(normals.tobytes()).hexdigest(),
            tuple(slot.material.name if slot.material else None for slot in obj.material_slots),
            property_snapshot(dict(obj.items())),
        )
    return snapshot


def finish_snapshot():
    snapshot = {}
    for material in bpy.data.materials:
        tree = material.node_tree
        nodes = tuple(sorted((node.name, node.type) for node in tree.nodes)) if tree else ()
        wires = (
            tuple(
                sorted(
                    (wire.from_node.name, wire.from_socket.identifier, wire.to_node.name, wire.to_socket.identifier)
                    for wire in tree.links
                )
            )
            if tree
            else ()
        )
        bsdf = next((node for node in tree.nodes if node.type == "BSDF_PRINCIPLED"), None) if tree else None
        fields = {}
        if bsdf:
            for name in (
                "Base Color",
                "Roughness",
                "Metallic",
                "Emission Color",
                "Emission Strength",
                "Transmission Weight",
            ):
                value = bsdf.inputs[name].default_value
                fields[name] = tuple(value) if hasattr(value, "__len__") else value
        snapshot[material.name] = (
            tuple(material.diffuse_color),
            material.roughness,
            material.metallic,
            nodes,
            wires,
            fields,
        )
    return snapshot


def retain_east_dock(obj):
    """The west-facing shore fixture shares a material batch with the upper one."""
    original = obj.data
    selected = {
        face.index
        for face in original.polygons
        if all((obj.matrix_world @ original.vertices[index].co).z >= 0 for index in face.vertices)
    }
    if not 0 < len(selected) < len(original.polygons):
        raise ValueError(f"{obj.name} must contain distinct upper and beach fixtures")
    result = _subset(original, selected, obj.name + " east dock preserved")

    def face_signature(mesh, face):
        return (
            tuple(tuple(mesh.vertices[index].co) for index in face.vertices),
            face.material_index,
            face.use_smooth,
        )

    assert [face_signature(original, original.polygons[index]) for index in sorted(selected)] == [
        face_signature(result, face) for face in result.polygons
    ]
    obj.data = result
    return {"originalFaces": len(original.polygons), "retainedUpperFaces": len(selected)}


def refit_clear_glass(scene):
    if not scene.get("splayedOceanWindow") or scene.get("oceanLiftClearLeaves"):
        raise ValueError("Expected an unmodified splayed cliff-lift ocean window")
    old = mesh_snapshot(scene)
    finishes = finish_snapshot()
    targets = {obj.name: kind for obj in scene.objects if obj.type == "MESH" and (kind := target_kind(obj))}
    expected = {"drop": 3, "moving": 16, "mixed entrance": 2}
    actual = {kind: sum(value == kind for value in targets.values()) for kind in expected}
    if actual != expected:
        raise ValueError(f"Unexpected original cliff-lift fixtures {actual}, expected {expected}")
    upper = {}
    for name, kind in targets.items():
        obj = scene.objects[name]
        if kind == "mixed entrance":
            upper[name] = retain_east_dock(obj)
        else:
            bpy.data.objects.remove(obj, do_unlink=True)

    decor.material(BRONZE, (0.19, 0.106, 0.059), roughness=0.49, metallic=0.63)
    joinery = Joinery(PREFIX, "cliff-lift")
    ocean_leaves(joinery)
    shaft_head(joinery)
    landing_trim(joinery)
    added = []
    for piece, obj in joinery.finish():
        if piece.startswith(OCEAN):
            kind, side, leaf = piece.split("_")
            tag_dynamic(obj, kind, (-1 if side == "left" else 1) * (0.54 if leaf == "0" else 0.27))
        else:
            obj["walk"] = "through"
        map_finish(obj)
        added.append(obj.name)
    scene["oceanLiftClearLeaves"] = 1
    bpy.context.view_layer.update()
    unchanged = set(old) - set(targets)
    snapshot = mesh_snapshot(scene)
    changed = sorted(name for name in unchanged if snapshot.get(name) != old[name])
    assert not changed, f"Unrelated native mesh data changed: {changed}"
    after_finishes = finish_snapshot()
    assert all(after_finishes.get(name) == expected for name, expected in finishes.items())

    return {
        "unchangedNativeMeshes": len(unchanged),
        "retiredOrRebuiltOwners": targets,
        "preservedUpperDockFixtures": upper,
        "newOwners": sorted(added),
        "oceanMovingMeshes": validate_parts(scene),
        "gatePaneBottomM": DECK_DAYLIGHT,
        "gateHeadMinimumM": HEAD_BOTTOM,
        "movingGroups": ["cab", "cabDoorTop", "cabDoorBeach", "topGate", "beachGate"],
        "cliffRockMeshesUnchanged": True,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path, help="Existing native house Blender file")
    parser.add_argument("--output", required=True, type=Path, help="New native Blender file")
    parser.add_argument("--report", required=True, type=Path, help="New native verification JSON")
    parsed = parser.parse_args(argv)
    source, output, report = (path.resolve() for path in (parsed.source, parsed.output, parsed.report))
    if not source.is_file() or source.suffix.lower() != ".blend":
        parser.error("--source must be an existing .blend")
    if output.suffix.lower() != ".blend" or report.suffix.lower() != ".json":
        parser.error("--output must be .blend and --report must be .json")
    if len({source, output, report}) != 3:
        parser.error("Source, output and report must be distinct paths")
    if output.exists() or report.exists():
        parser.error("Choose new output and report paths")

    source_hash = digest(source)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    evidence = refit_clear_glass(bpy.context.scene)
    expected_meshes = mesh_snapshot(bpy.context.scene)
    expected_finishes = finish_snapshot()
    output.parent.mkdir(parents=True, exist_ok=True)
    report.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    bpy.ops.wm.open_mainfile(filepath=str(output))
    assert mesh_snapshot(bpy.context.scene) == expected_meshes
    assert finish_snapshot() == expected_finishes
    assert digest(source) == source_hash
    evidence.update(sourceSha256=source_hash, outputSha256=digest(output), reopenedVerified=True)
    report.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Saved {output} and verified {evidence['unchangedNativeMeshes']} retained meshes.")


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else None)
