"""Fit Arrival B's finishes to their actual slabs and liner."""

from argparse import ArgumentParser
from hashlib import sha256
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import coastal_arrival_hall as hall
from coastal_arrival_upper_link import mesh_digest

MARKER = "coastalArrivalBFinishFit"
SLAB_TOP = -0.022
FLOOR_NOTCH_Z = 14.98
LINER_INSIDE = 1.345
LINER_OUTSIDE = 1.455
APERTURE_NEAR = 18.80
APERTURE_FAR = 19.96
SILL_UNDERSIDE = 2.565


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def mesh_bounds(obj):
    points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    return [[select(point[axis] for point in points) for axis in range(3)] for select in (min, max)]


def move_plane(obj, axis, original, fitted):
    frame = obj.matrix_world
    inverse = frame.inverted()
    moved = 0
    for vertex in obj.data.vertices:
        world = frame @ vertex.co
        if abs(world[axis] - original) > 0.00005:
            continue
        world[axis] = fitted
        vertex.co = inverse @ world
        moved += 1
    if moved != 4:
        raise ValueError(f"Expected four vertices on {obj.name}'s fitted plane, found {moved}")
    obj.data.update()
    return {"mesh": obj.name, "moved": moved, "axisXYZ": axis, "previous": original, "fitted": fitted}


def fit_arrival_finishes(scene):
    if scene.get(MARKER):
        return {"alreadyFitted": True}
    if not scene.get("coastalArrivalStraightB") or not scene.get("coastalArrivalUpperLink"):
        raise ValueError("Supply the straight arrival with its upper link already fitted")

    plate = scene.objects["core_arrival_B_compression_floor"]
    oak = scene.objects["core_reno_floorboards_lower"]
    slab = scene.objects["core_reno_slab_ground"]
    shell = scene.objects["core_arrival_B_east_wall"]
    head = scene.objects["core_arrival_B_upper_link_head"]
    sill = scene.objects["core_arrival_B_upper_link_base"]
    stop = scene.objects["core_arrival_B_upper_link__pale oak"]
    assert abs(mesh_bounds(slab)[1][2] - SLAB_TOP) < 0.00005
    assert abs(mesh_bounds(stop)[0][2] - SILL_UNDERSIDE) < 0.00005
    floor_bounds = mesh_bounds(plate)
    if any(
        abs(actual - expected) > 0.00005
        for actual, expected in zip(
            floor_bounds[0] + floor_bounds[1], [-0.905, -14.418, -0.140, 1.295, -11.148, 0.002]
        )
    ):
        raise ValueError("Arrival B has a different compression-floor footprint")

    preserved = [
        "core__golden coastal sandstone",
        "coast_shared_golden coastal sandstone",
        "core_entry_landscape_sandstone",
        "core_entry_landscape_stone_seat",
        slab.name,
        stop.name,
        "core_arrival_B_stair_support",
        "core_arrival_B_treads__pale oak",
        "core_arrival_B_reveal_panel",
        "core_arrival_B_reveal_pull",
    ]
    custody = {
        name: mesh_digest(scene.objects[name].data) for name in preserved if scene.objects.get(name)
    }
    before = {obj.name: mesh_bounds(obj) for obj in [plate, oak, shell, head, sill]}

    # The stone supplies the visible foyer finish. Cut back the retired oak
    # only beneath the stone and the two lower structural risers.
    x0, x1 = floor_bounds[0][0], floor_bounds[1][0]
    finish_cut = hall._cut(
        scene,
        "B oak to inset travertine",
        x0,
        x1,
        -floor_bounds[1][1],
        FLOOR_NOTCH_Z,
        -0.040,
        0.025,
        oak.data.materials[0],
        [oak],
    )
    plate_fit = move_plane(plate, 2, floor_bounds[0][2], SLAB_TOP)
    head_fit = move_plane(head, 0, before[head.name][0][0], LINER_OUTSIDE)

    # The original liner itself carries the sill. Two small stone substrates
    # meet it on either side beneath the continuous oak cap.
    base_cut = hall._cut(
        scene,
        "B upper substrate to liner",
        LINER_INSIDE,
        LINER_OUTSIDE,
        APERTURE_NEAR - 0.002,
        APERTURE_FAR + 0.002,
        before[sill.name][0][2] - 0.002,
        SILL_UNDERSIDE + 0.002,
        sill.data.materials[0],
        [sill],
    )
    sill_cut = hall._cut(
        scene,
        "B oak sill in liner",
        LINER_INSIDE - 0.018,
        LINER_OUTSIDE + 0.018,
        APERTURE_NEAR,
        APERTURE_FAR,
        SILL_UNDERSIDE - 0.0001,
        SILL_UNDERSIDE + 0.032,
        shell.data.materials[0],
        [shell],
    )
    for receipt in (finish_cut, base_cut, sill_cut):
        if not receipt["meshes"] or any(mesh["cutNonManifold"] for mesh in receipt["meshes"]):
            raise RuntimeError(f"Unqualified {receipt['cutter']} cut")

    assert all(
        mesh_digest(scene.objects[name].data) == fingerprint for name, fingerprint in custody.items()
    )
    scene[MARKER] = True
    bpy.context.view_layer.update()
    return {
        "alreadyFitted": False,
        "floorNotch": [[x0, -FLOOR_NOTCH_Z], [x1, floor_bounds[1][1]]],
        "floor": plate_fit,
        "head": head_fit,
        "cuts": [finish_cut, base_cut, sill_cut],
        "before": before,
        "after": {obj.name: mesh_bounds(obj) for obj in [plate, oak, shell, head, sill]},
        "retainedMeshDigest": custody,
    }


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--expected-source", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    origin, target, report = [path.resolve() for path in (args.source, args.output, args.report)]
    original = digest(origin)
    if original != args.expected_source or len({origin, target, report}) != 3:
        parser.error("Use the expected native SHA, a separate output, and a separate receipt")
    if bpy.app.version[:2] != (4, 5):
        parser.error("Use the site's Blender 4.5 LTS")
    bpy.ops.wm.open_mainfile(filepath=str(origin))
    result = fit_arrival_finishes(bpy.context.scene)
    if result["alreadyFitted"]:
        # Keep a repeat replay byte-for-byte identical.
        target.write_bytes(origin.read_bytes())
    else:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True)
    result.update(sourceSha256=original, outputSha256=digest(target))
    report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
