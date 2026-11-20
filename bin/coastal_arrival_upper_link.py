
"""Connect the straight arrival's middle landing to the retained oak pocket door."""

from argparse import ArgumentParser
from hashlib import sha256
import json
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import coastal_arrival_hall as hall
import coastal_shell as shell


HEIGHT = 2.597
SILL_Z = 17.621
NEAR_Z, FAR_Z = 18.80, 19.96
INNER_X, TURN_X, OUTER_X = 1.295, 2.035, 3.299
CEILING = 4.711


def mesh_digest(mesh):
    """A stable digest of the original positions, winding, UVs, and baked corner colors."""
    result = sha256()
    for vert in mesh.vertices:
        result.update(repr(tuple(vert.co)).encode())
    for polygon in mesh.polygons:
        result.update(repr((tuple(polygon.vertices), polygon.material_index, polygon.use_smooth)).encode())
    for layer in mesh.uv_layers:
        for corner in layer.data:
            result.update(repr(tuple(corner.uv)).encode())
    for layer in mesh.color_attributes:
        for corner in layer.data:
            result.update(repr(tuple(corner.color)).encode())
    return result.hexdigest()


def box_plan(x0, x1, z0, z1):
    return [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]


def link_solid(scene, name, plan, bottom, top, material, sample):
    """One closed slab, including the concave landing plan, with metre-scale surface UVs."""
    count = len(plan)
    vertices = [(x, -z, y) for y in (bottom, top) for x, z in plan]
    faces = [list(range(count)), list(reversed(range(count, 2 * count)))]
    faces.extend((i, i + count, (i + 1) % count + count, (i + 1) % count) for i in range(count))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    body = bmesh.new()
    body.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(body, faces=list(body.faces))
    assert all(edge.is_manifold and edge.is_contiguous for edge in body.edges), name
    assert body.calc_volume(signed=True) > 0, name
    body.to_mesh(mesh)
    body.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(material)
    obj["closedSolid"] = True
    obj["installationGroup"] = "arrival"
    obj["architectureComponent"] = "arrival-straight-b"
    for original in sample.uv_layers:
        uv = mesh.uv_layers.new(name=original.name)
        for face in mesh.polygons:
            normal_axis = max(range(3), key=lambda axis: abs(face.normal[axis]))
            a, b = [axis for axis in range(3) if axis != normal_axis]
            for loop in face.loop_indices:
                co = mesh.vertices[mesh.loops[loop].vertex_index].co
                uv.data[loop].uv = (co[a] * .42, co[b] * .42)
    for original in sample.color_attributes:
        if original.domain != "CORNER":
            continue
        layer = mesh.color_attributes.new(name=original.name, type=original.data_type, domain="CORNER")
        # Match the adjacent receiver for this reversible local prototype.
        # The installed cut should get the ordinary source-bound local AO rebake.
        if original.data:
            color = tuple(original.data[len(original.data) // 2].color)
            for corner in layer.data:
                corner.color = color
    return obj


def fit_upper_link_wall_rail(scene):
    """Refit the old sloping east rail to the completed landing."""
    if not scene.get("coastalArrivalUpperLink") or scene.get("coastalArrivalUpperLinkRail"):
        raise ValueError("Expected a newly linked upper landing with the original Flight A rail")
    lo = (3.197, -21.58, .84)
    hi = (3.298, -17.56, 3.57)
    removed = {}
    for material, expected in (("honey ash", 1), ("brushed brass", 5)):
        owner = scene.objects[f"core_arrival_hall__{material}"]
        removed[material] = hall._remove_islands(owner, lambda a, b: shell.inside(a, b, lo, hi))
        if removed[material] != expected:
            raise ValueError(f"Expected {expected} Flight A {material} rail parts, found {removed[material]}")
    rails = hall.Parts("core_arrival_B_upper_link_rail")
    hall._wall_rail(
        rails.bm(bpy.data.materials["honey ash"]), rails.bm(bpy.data.materials["brushed brass"]),
        [(3.3, 19.83, HEIGHT), (3.3, 17.72, HEIGHT)], (-.07, 0),
    )
    objects = rails.finish()
    for obj in objects:
        obj["installationGroup"] = "arrival"
        obj["architectureComponent"] = "arrival-straight-b"
    scene["coastalArrivalUpperLinkRail"] = True
    bpy.context.view_layer.update()
    return {
        "removedFlightARailIslands": removed,
        "added": [obj.name for obj in objects],
        "lightLine": {
            "a": [3.23, 3.447, 19.83],
            "b": [3.23, 3.447, 17.72],
            "region": {"min": [1.32, 2.5, 17.49], "max": [3.35, 4.8, 20.07]},
            "intensity": 1.16,
        },
    }


def build_upper_link(scene):
    original_liner = scene.objects["core_arrival_B_east_wall"]
    if scene.get("coastalArrivalUpperLink"):
        raise ValueError("The straight arrival already has its upper-floor link")
    first = scene.objects["core_arrival_B_treads__pale oak"]
    stone = original_liner.data.materials[0]
    oak = first.data.materials[0]
    keep_rock = ("core__golden coastal sandstone", "coast_shared_golden coastal sandstone")
    retained = {name: mesh_digest(scene.objects[name].data) for name in keep_rock if scene.objects.get(name)}

    # The half-turn reaches old void. Open the new 110 mm liner and remove only
    # the nearby portions of two earlier guard owners over the new standing floor.
    cuts = [
        hall._cut(scene, "Arrival B upper liner aperture", 1.325, 1.475, NEAR_Z, FAR_Z, 2.589, CEILING, stone, [original_liner]),
    ]
    guard = [
        scene.objects[name]
        for name in ("core_arrival_hall__honey ash", "core_arrival_hall__brushed brass")
        if scene.objects.get(name)
    ]
    if guard:
        cuts.append(hall._cut(scene, "Arrival B upper guard fit", 1.82, 2.048, 17.621, FAR_Z,
                              HEIGHT - .025, 4.15, oak, guard))

    plan = [
        (INNER_X, NEAR_Z), (TURN_X, NEAR_Z), (TURN_X, SILL_Z),
        (OUTER_X, SILL_Z), (OUTER_X, FAR_Z), (INNER_X, FAR_Z),
    ]
    substrate = link_solid(scene, "core_arrival_B_upper_link_base", plan, HEIGHT - .19, HEIGHT - .032, stone, original_liner.data)
    floor = link_solid(scene, "core_arrival_B_upper_link__pale oak", plan, HEIGHT - .032, HEIGHT, oak, first.data)
    fixed = []
    for suffix, rect, bottom, top in (
        ("seaward_return", (1.455, TURN_X, NEAR_Z - .104, NEAR_Z), HEIGHT - .19, 4.79375),
        ("west_return", (TURN_X - .10, TURN_X, SILL_Z, NEAR_Z - .104), HEIGHT - .19, 4.79375),
        ("landward_closure", (1.455, OUTER_X, FAR_Z, FAR_Z + .094), HEIGHT - .19, 4.79375),
    ):
        fixed.append(link_solid(scene, "core_arrival_B_upper_link_" + suffix, box_plan(*rect), bottom, top, stone, original_liner.data))
    fixed.append(link_solid(scene, "core_arrival_B_upper_link_head", plan, CEILING, 4.79375, stone, original_liner.data))

    for name, original in retained.items():
        assert mesh_digest(scene.objects[name].data) == original, name
    scene["coastalArrivalUpperLink"] = True
    rail = fit_upper_link_wall_rail(scene)
    return {
        "rail": rail,
        "nativePlan": [[x, -z] for x, z in plan],
        "nativeSillHeight": HEIGHT,
        "opening": {"min": [1.345, HEIGHT, NEAR_Z], "max": [1.455, CEILING, FAR_Z]},
        "cuts": cuts,
        "added": [obj.name for obj in [substrate, floor, *fixed]],
        "retainedRockTuplesSha256": retained,
        "route": [[.195, 2.59375, 19.38], [2.65, HEIGHT, 19.38],
                  [2.65, 2.6, 17.30], [2.65, 2.6, 16.10],
                  [2.65, 2.6, 15.30], [2.65, 2.6, 14.10]],
    }


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--expected-source", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--fit-wall-rail", action="store_true", help="Refit the rail of an already linked upper landing")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    src, dst, report = [path.resolve() for path in (args.source, args.output, args.report)]
    actual = sha256(src.read_bytes()).hexdigest()
    if actual != args.expected_source or len({src, dst, report}) != 3:
        parser.error("Use a hash-pinned source and two independent output paths")
    if bpy.app.version[:2] != (4, 5):
        parser.error("This is a Blender 4.5 LTS native fit")
    bpy.ops.wm.open_mainfile(filepath=str(src))
    scene = bpy.context.scene
    proof = fit_upper_link_wall_rail(scene) if args.fit_wall_rail else build_upper_link(scene)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(dst), compress=True)
    proof.update(sourceSha256=actual, outputSha256=sha256(dst.read_bytes()).hexdigest())
    report.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(proof))


if __name__ == "__main__":
    main()
