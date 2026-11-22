"""Fit the retained planting stone behind the tea garden's relocated oak deck.

Run inside Blender with --source, --expected-source, --out and --report.
The result is a separate native file ready for the two-surface AO rebake.
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


STONE = "kitchen_garden__warm cut stone"
DECK = "kitchen_garden__pale oak"
WALL = "core_tea_garden_back_riser__warm cut stone"
GRAVEL = "kitchen_garden__honed travertine"
MIN_CLEARANCE = 0.022


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds(points):
    return tuple(tuple(reduce(point[axis] for point in points) for axis in range(3)) for reduce in (min, max))


def islands(mesh):
    neighbors = [set() for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        neighbors[a].add(b)
        neighbors[b].add(a)
    remaining = set(range(len(neighbors)))
    while remaining:
        pending = [remaining.pop()]
        component = []
        while pending:
            vertex = pending.pop()
            component.append(vertex)
            unseen = neighbors[vertex] & remaining
            remaining.difference_update(unseen)
            pending.extend(unseen)
        yield sorted(component)


def support_at(gravel, x, y):
    world_to_local = gravel.matrix_world.inverted()
    origin = world_to_local @ Vector((x, y, -0.75))
    direction = world_to_local.to_3x3() @ Vector((0, 0, -1))
    hit, point, normal, _ = gravel.ray_cast(origin, direction)
    if not hit or (world_to_local.to_3x3().transposed() @ normal).normalized().z < 0.99:
        raise RuntimeError(f"The new stone pocket lacks an upward gravel surface at {(x, y)}")
    return (gravel.matrix_world @ point).z


def fit(scene):
    stone = scene.objects[STONE]
    deck = scene.objects[DECK]
    wall = scene.objects[WALL]
    gravel = scene.objects[GRAVEL]
    if stone.data.users != 1:
        raise RuntimeError("The stone batch unexpectedly shares its vertex data")

    original = [stone.matrix_world @ vertex.co for vertex in stone.data.vertices]
    selected = []
    for ids in islands(stone.data):
        lo, hi = bounds([original[i] for i in ids])
        centre = [(a + b) / 2 for a, b in zip(lo, hi)]
        if abs(centre[0] + 6.05) < 0.02 and abs(centre[1] + 6.02) < 0.02:
            selected.append((ids, lo, hi))
    if len(selected) != 1 or len(selected[0][0]) != 42:
        raise RuntimeError("The retained rounded planting stone did not match its authored component")
    ids, original_lo, original_hi = selected[0]

    deck_components = []
    for part in islands(deck.data):
        lo, hi = bounds([deck.matrix_world @ deck.data.vertices[i].co for i in part])
        if lo[0] < original_hi[0] and hi[0] > original_lo[0] and abs(hi[2] + 0.92) < 0.01:
            deck_components.append(lo[1])
    if not deck_components:
        raise RuntimeError("The retained deck boards could not be found at the stone's x coordinate")
    deck_edge = min(deck_components)
    wall_edge = max((wall.matrix_world @ vertex.co).y for vertex in wall.data.vertices)
    if abs(deck_edge + 6.05) > 0.002 or abs(wall_edge + 6.248) > 0.002:
        raise RuntimeError("The rear deck pocket differs from the measured design")
    target_lo = wall_edge + MIN_CLEARANCE
    target_hi = deck_edge - MIN_CLEARANCE
    scale = (target_hi - target_lo) / (original_hi[1] - original_lo[1])
    if not 0.45 < scale < 0.65:
        raise RuntimeError("The retained stone needs a different physical fit")

    world_to_local = stone.matrix_world.inverted()
    for i in ids:
        x, y, z = original[i]
        stone.data.vertices[i].co = world_to_local @ Vector((x, target_lo + (y - original_lo[1]) * scale, z))
    stone.data.update()
    lo, hi = bounds([stone.matrix_world @ stone.data.vertices[i].co for i in ids])
    wall_gap, deck_gap = lo[1] - wall_edge, deck_edge - hi[1]
    if min(wall_gap, deck_gap) < MIN_CLEARANCE - 1e-5:
        raise RuntimeError("The planted stone no longer clears the wall and deck")
    for axis in (0, 2):
        if max(abs(limits[axis] - old[axis]) for limits, old in ((lo, original_lo), (hi, original_hi))) > 1e-6:
            raise RuntimeError("The stone's x or z extent changed unexpectedly")
    changed = set(ids)
    if any((stone.matrix_world @ vertex.co - original[vertex.index]).length > 1e-7 for vertex in stone.data.vertices if vertex.index not in changed):
        raise RuntimeError("A different planting stone changed")

    x = (lo[0] + hi[0]) / 2
    y = (lo[1] + hi[1]) / 2
    bed = support_at(gravel, x, y)
    embed = bed - lo[2]
    if not 0.001 < embed < 0.025:
        raise RuntimeError("The fitted planting stone is floating or excessively embedded")
    return {
        "mesh": STONE, "selectedVertices": len(ids), "before": [original_lo, original_hi], "after": [lo, hi],
        "deckEdgeY": deck_edge, "wallEdgeY": wall_edge, "deckClearanceM": deck_gap, "wallClearanceM": wall_gap,
        "support": {"mesh": GRAVEL, "position": [x, y, bed], "embedM": embed},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--expected-source", required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    options = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    source, destination, report = (file.resolve() for file in (options.source, options.out, options.report))
    if len({source, destination, report}) != 3 or destination.exists() or report.exists():
        raise RuntimeError("Supply separate new paths for the fitted Blender file and its evidence")
    source_hash = digest(source)
    if source_hash != options.expected_source.lower():
        raise RuntimeError("The native input no longer matches the expected source SHA-256")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    bpy.context.view_layer.update()
    result = fit(bpy.context.scene)
    destination.parent.mkdir(parents=True, exist_ok=True)
    report.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(destination), compress=True)
    result.update({"sourceSha256": source_hash, "fittedSha256": digest(destination)})
    report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
