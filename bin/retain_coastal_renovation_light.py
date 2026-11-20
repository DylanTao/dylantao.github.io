"""Retain the authored cliff's corner light outside the combined house edits."""

from argparse import ArgumentParser
import hashlib
import json
from pathlib import Path
import sys

import bpy
import numpy as np

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "bin"))
from coastal_arrival_straight_b import sweep_boxes
from coastal_embedded_lift_cut import BOUNCE, CUTS, ROCK, UV


def field(items, prop, width=1, dtype=np.float32):
    values = np.empty(len(items) * width, dtype=dtype)
    items.foreach_get(prop, values)
    return values.reshape(-1, width) if width > 1 else values


def ports(obj):
    mesh = obj.data
    return (
        np.array(obj.matrix_world),
        field(mesh.vertices, "co", 3),
        field(mesh.loops, "vertex_index", dtype=np.int32),
        field(mesh.polygons, "loop_start", dtype=np.int32),
        field(mesh.polygons, "loop_total", dtype=np.int32),
        field(mesh.polygons, "material_index", dtype=np.int32),
        field(mesh.polygons, "use_smooth", dtype=np.bool_),
        field(mesh.uv_layers[UV].data, "uv", 2),
        field(mesh.corner_normals, "vector", 3),
    )


def colour(obj):
    layer = obj.data.color_attributes[BOUNCE]
    if layer.domain != "CORNER" or len(layer.data) != len(obj.data.loops):
        raise ValueError(f"Missing native corner light on {obj.name}")
    return layer.data


def digest(parts):
    result = hashlib.sha256()
    for array in parts:
        result.update(np.ascontiguousarray(array).tobytes())
    return result.hexdigest()


def arrival_extent(receipt):
    # The qualified receipt collects the portal, the 48 tread midpoints, and
    # the compression lane. Convert the world Y-up tread probes to native.
    going = receipt["going"]
    treads = receipt["routeProbes"][1:49][::-1]
    axis, trigger, _ = receipt["nativeTrigger"]
    top = receipt["nativePortal"][1] + 0.70
    if len(treads) != 48 or any(x != axis for x, _, _ in treads):
        raise ValueError("Expected the qualified 48-tread straight B arrival receipt")
    foot = -treads[0][2] + going / 2
    run = []
    for _, height, world_z in treads:
        y = -world_z
        high, low = y + going / 2, y - going / 2
        if run and high < run[-1][0] - 1e-6:
            run.append((high, run[-1][1]))
        run += [(high, height), (low, height)]
    floor = (
        [(trigger + 0.41, -0.30), (foot, -0.30)]
        + [(y, z - 0.30) for y, z in run]
        + [(top - 1.205, 7.72)]
    )
    ceiling = (
        [(trigger + 0.41, 2.31), (foot, 2.31)]
        + [(y, z + 2.33) for y, z in run]
        + [(top - 1.205, 10.63)]
    )
    return sweep_boxes(floor, ceiling, axis - 1.97, axis + 1.33)


def assembly_extents(scene, prefix):
    boxes = []
    for obj in scene.objects:
        if obj.type == "MESH" and obj.name.startswith(prefix):
            matrix = np.array(obj.matrix_world)
            points = (
                field(obj.data.vertices, "co", 3) @ matrix[:3, :3].T + matrix[:3, 3]
            )
            boxes.append((points.min(axis=0), points.max(axis=0)))
    if not boxes:
        raise ValueError(f"Missing authored geometry for {prefix}")
    return boxes


def restore(obj, old, regions):
    current, previous = ports(obj), ports(old)
    if any(not np.array_equal(a, b) for a, b in zip(current, previous)):
        raise ValueError(
            f"The prelight and baked source disagree on native geometry, UV or corner normals for {obj.name}"
        )
    matrix, vertices, indices, starts, sizes, *_ = current
    world = vertices[indices] @ matrix[:3, :3].T + matrix[:3, 3]
    low, high = np.minimum.reduceat(world, starts, axis=0), np.maximum.reduceat(
        world, starts, axis=0
    )
    local = np.zeros(len(starts), dtype=bool)
    sites = {}
    for name, boxes, margin in regions:
        selected = np.zeros_like(local)
        for start, stop in boxes:
            selected |= (
                (low <= np.asarray(stop) + margin)
                & (high >= np.asarray(start) - margin)
            ).all(axis=1)
        local |= selected
        sites[name] = {"faces": int(selected.sum()), "marginM": margin}
    if not local.any() or local.all():
        raise ValueError(f"Unbounded bounce mask for {obj.name}")
    corner = np.repeat(local, sizes)
    baked = field(colour(obj), "color", 4)
    retained = field(colour(old), "color", 4)
    result = retained.copy()
    result[corner] = baked[corner]
    colour(obj).foreach_set("color", result.ravel())
    verified = field(colour(obj), "color", 4)
    if not np.array_equal(verified, result) or not np.array_equal(
        verified[~corner], retained[~corner]
    ):
        raise ValueError(f"Restored corner light failed exact readback for {obj.name}")
    return {
        "localFaces": int(local.sum()),
        "distantFaces": int((~local).sum()),
        "localCornersChanged": int(
            np.any(baked[corner] != retained[corner], axis=1).sum()
        ),
        "distantCornersRestored": int(
            np.any(baked[~corner] != retained[~corner], axis=1).sum()
        ),
        "regions": sites,
        "geometryUvNormalsSha256": digest(current),
        "retainedRgbaSha256": digest([verified[~corner]]),
    }


def main():
    parser = ArgumentParser(description=__doc__)
    for key in ("before", "source", "out", "report"):
        parser.add_argument(f"--{key}", type=Path, required=True)
    parser.add_argument("--arrival-receipt", type=Path)
    parser.add_argument("--window-receipt", type=Path)
    opt = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    before, source, out, report = (
        p.resolve() for p in (opt.before, opt.source, opt.out, opt.report)
    )
    if out in (before, source) or report in (before, source, out):
        parser.error("Use separate candidate and receipt outputs")
    arrival = (
        json.loads(opt.arrival_receipt.read_text(encoding="utf-8"))
        if opt.arrival_receipt
        else None
    )
    window = (
        json.loads(opt.window_receipt.read_text(encoding="utf-8"))
        if opt.window_receipt
        else None
    )
    if arrival is None and window is None:
        parser.error("Supply the excavation receipt for this light bake")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    if not scene.get("coastalArrivalStraightB"):
        raise ValueError(
            "The baked source does not contain the qualified Arrival B cut"
        )
    bpy.context.view_layer.update()
    roof = assembly_extents(scene, "core_entry_landscape_")
    pool = assembly_extents(scene, "core_pool_tide_relief_")
    loggia = assembly_extents(scene, "core_speakeasy_loggia_") if window else []
    with bpy.data.libraries.load(str(before), link=False) as (_, library):
        library.objects = list(ROCK)
    evidence = {}
    for index, name in enumerate(ROCK):
        regions = [("pool relief", pool, 0.55)]
        if arrival:
            regions.append(("embedded lift", CUTS, (0.365, 0.949)[index]))
            if index == 0:
                regions.append(
                    (
                        "Arrival B",
                        arrival_extent(arrival),
                        arrival["cutCustody"][name]["farMargin"],
                    )
                )
        if window:
            regions += [
                (
                    "ocean embrasure",
                    [window["cutBounds"]],
                    window["solids"][name]["farMargin"],
                ),
                ("fire loggia", loggia, 0.55),
            ]
        if index == 0:
            regions.append(("entry garden", roof, 0.55))
        original = library.objects[index]
        evidence[name] = restore(scene.objects[name], original, regions)
        detached = original.data
        bpy.data.objects.remove(original, do_unlink=True)
        if not detached.users:
            bpy.data.meshes.remove(detached)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(out), compress=True)
    receipt = {
        "before": str(before),
        "baked": str(source),
        "out": str(out),
        "rock": evidence,
    }
    report.write_text(
        json.dumps(receipt, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    print(json.dumps(receipt), flush=True)


if __name__ == "__main__":
    main()
