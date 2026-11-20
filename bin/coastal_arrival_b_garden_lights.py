"""Fit shielded low light to the authored B stair and clifftop seat."""

import argparse
from base64 import b64encode
from hashlib import file_digest
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path.cwd() / "bin"))
from coastal_decor import from_bmesh, material

PREFIX = "core_entry_landscape_"
GROUP = "entry-garden"
BRONZE = "Entry marker · patinated bronze"
LENS = "Entry marker · warm opal"
PORTAL_BOUNDS = {"min": [-1.72, 4.92, 24.24], "max": [1.46, 9.18, 31.87]}
GARDEN_BOUNDS = {"min": [-4.55, 7.65, 29.16], "max": [3.89, 12.0, 32.21]}


def digest(path):
    with path.open("rb") as file:
        return file_digest(file, "sha256").hexdigest()


def native(v):
    return Vector((v[0], -v[2], v[1]))


def web(v, rounded=True):
    values = [v.x, v.z, -v.y]
    return [round(value, 6) for value in values] if rounded else values


def tree(obj):
    return BVHTree.FromPolygons(
        [obj.matrix_world @ vertex.co for vertex in obj.data.vertices],
        [tuple(face.vertices) for face in obj.data.polygons],
    )


def surface(scene, owner, origin, bearing, reach):
    obj = scene.objects.get(owner)
    if obj is None:
        raise ValueError(f"Missing native mounting surface {owner}")
    survey = tree(obj)
    point, normal, _, span = survey.ray_cast(native(origin), native(bearing), reach)
    if point is None or abs(normal.z) > 0.1 or abs(span) < 0.10:
        raise ValueError(f"No side mounting face at {origin} on {owner}")
    if normal.dot(native(bearing)) > 0:
        normal.negate()
    return obj, point, normal.normalized()


def box(mesh, depth, tangent, vertical, low, high, point):
    axes = Matrix((tangent, depth, vertical)).transposed().to_4x4()
    axes.translation = point
    lo, hi = Vector(low), Vector(high)
    base = axes @ Matrix.Translation((lo + hi) / 2) @ Matrix.Diagonal((*((hi - lo) / 2), 1))
    bmesh.ops.create_cube(mesh, size=2, matrix=base)


def fit_fixture(slug, position, normal, width):
    # Depth is measured from the stone face. The backing rests 8 mm into
    # the wall, the visor stands 28 mm proud, and the opal lies below it.
    bronze = material(BRONZE, (0.19, 0.115, 0.069), roughness=0.52, metallic=0.45)
    diffuser = material(LENS, (0.71, 0.54, 0.34), roughness=0.77)
    bsdf = diffuser.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Emission Color"].default_value = (1, 0.62, 0.28, 1)
    bsdf.inputs["Emission Strength"].default_value = 0.35
    body, lens = bmesh.new(), bmesh.new()
    up = Vector((0, 0, 1))
    tangent = normal.cross(up).normalized()
    half = width / 2
    box(body, normal, tangent, up, (-half, -0.008, -0.024), (half, 0.008, 0.026), position)
    box(body, normal, tangent, up, (-half, 0.008, 0.013), (half, 0.028, 0.026), position)
    for hand in (-1, 1):
        left, right = sorted((hand * half, hand * (half - 0.011)))
        box(body, normal, tangent, up, (left, 0.008, -0.024), (right, 0.022, 0.013), position)
    box(lens, normal, tangent, up, (-half + 0.013, 0.009, -0.014), (half - 0.013, 0.015, 0.011), position)
    owners = []
    for role, mesh, finish in (("shield", body, bronze), ("diffuser", lens, diffuser)):
        name = f"{PREFIX}light_{slug}_{role}"
        obj = from_bmesh(name, mesh, finish, smooth=False)
        obj["installationGroup"] = GROUP
        obj["walk"] = "through"
        if role == "diffuser":
            obj["installationGlow"] = "entry-b-walkway"
        owners.append(obj.name)
    return position + normal * 0.027 + Vector((0, 0, -0.012)), owners


def point_meta(slug, emitter, target, bounds, color, watts):
    direction = (native(target) - emitter).normalized()
    if direction.z > -0.16:
        raise ValueError(f"{slug} fixture must throw its light down from the shield")
    return {
        "id": f"entry-b-{slug}",
        "schedule": "steps",
        "position": web(emitter),
        "intensity": watts,
        "color": color,
        "cone": [*web(direction), 0.47],
        "region": bounds,
        "transport": False,
        "emitterRadius": 0.026,
        "glowTag": "entry-b-walkway",
    }


def shadow_depth(scene, point):
    # A small native visibility map affects this one local source only.
    # The support, plant silhouettes and planting shelf remain in the cast.
    center = native(point["position"])
    axis = native(point["cone"][:3]).normalized()
    right = axis.cross(Vector((0, 0, 1))).normalized()
    up = right.cross(axis).normalized()
    opening = math.sqrt(1 - point["cone"][3] ** 2) / point["cone"][3]
    distance, side = 1.8, 48
    casters = [
        tree(obj)
        for obj in scene.objects
        if obj.type == "MESH"
        and obj.name.startswith((PREFIX, "core_arrival_B_", "core__golden coastal sandstone"))
        and not obj.name.startswith(PREFIX + "light_")
    ]
    samples = bytearray()
    for y in range(side):
        v = (2 * (y + 0.5) / side - 1) * opening
        for x in range(side):
            u = (2 * (x + 0.5) / side - 1) * opening
            direction = (axis + right * u + up * v).normalized()
            depth = distance
            for caster in casters:
                hit, _, _, length = caster.ray_cast(center + direction * 0.004, direction, depth)
                if hit is not None:
                    depth = min(depth, length + 0.004)
            samples.append(round(depth / distance * 255))
    if not 0 < samples.count(255) < len(samples):
        raise ValueError("Expected both open and occluded lamp directions")
    return {"size": side, "distance": distance, "data": b64encode(samples).decode("ascii")}


def scene_fit(scene):
    if not scene.objects.get("core_arrival_B_portal_plinth"):
        raise ValueError("The straight B portal and its entry landscaping are required")
    specifications = [
        (
            "west-reveal",
            "core_arrival_B_west_wall",
            (0.195, 8.765, 30.96),
            (-1, 0, 0),
            2.0,
            0.174,
            (0.32, 7.95, 29.76),
            {"min": [-1.76, 6.62, 27.30], "max": [1.56, 8.716, 31.89]},
            [1.0, 0.70, 0.43],
            2.05,
        ),
        (
            "east-reveal",
            "core_arrival_B_east_wall",
            (0.195, 7.11, 27.72),
            (1, 0, 0),
            2.0,
            0.174,
            (0.35, 5.95, 26.35),
            {"min": [-1.76, 5.02, 24.27], "max": [1.56, 7.065, 28.46]},
            [1.0, 0.70, 0.43],
            1.80,
        ),
        (
            "garden-seat",
            "core_entry_landscape_stone_seat",
            (3.225220, 8.955, 30.119709),
            (-0.258819, 0, 0.965926),
            2.0,
            0.126,
            (3.26, 8.752516, 30.59),
            {"min": [2.95, 8.50, 29.93], "max": [3.78, 9.02, 31.07]},
            [1.0, 0.64, 0.35],
            0.34,
        ),
    ]
    retained = []
    for obj in scene.objects:
        if obj.name.startswith(PREFIX + "light_"):
            raise ValueError("The B light fittings already exist in the supplied source")
        if obj.type == "MESH" and obj.name.startswith(PREFIX):
            retained.append(obj.name)
            obj["installationGroup"] = GROUP
    if len(retained) < 9:
        raise ValueError("Expected all authored B garden landscape meshes")
    placements = []
    points = []
    for slug, owner, origin, bearing, reach, width, target, bounds, color, watts in specifications:
        _, hit, normal = surface(scene, owner, origin, bearing, reach)
        emitter, owners = fit_fixture(slug, hit, normal, width)
        point = point_meta(slug, emitter, target, bounds, color, watts)
        if slug == "garden-seat":
            point["cone"][3] = 0.63
            point["shadowDepth"] = shadow_depth(scene, point)
        points.append(point)
        placements.append(
            {
                "id": slug,
                "fixtureMeshes": owners,
                "nativeOwner": owner,
                "mountWeb": web(hit),
                "normalWeb": web(normal),
                "emitterWeb": web(emitter),
                "targetWeb": target,
                "widthM": width,
                "deepestInsetM": 0.008,
                "maximumProjectionM": 0.028,
            }
        )
    bpy.context.view_layer.update()
    return {
        "positions": placements,
        "points": points,
        "gardenBounds": GARDEN_BOUNDS,
        "arrivalExtension": PORTAL_BOUNDS,
        "existingLandscapingRetagged": retained,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ("source", "output", "report"):
        parser.add_argument("--" + flag, type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    source, output, report = (p.resolve() for p in (args.source, args.output, args.report))
    if len({source, output, report}) != 3 or output.exists() or report.exists():
        parser.error("Choose new, separate output and receipt files")
    original = digest(source)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    receipt = scene_fit(bpy.context.scene)
    output.parent.mkdir(parents=True, exist_ok=True)
    report.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    assert digest(source) == original
    receipt.update(sourceSha256=original, outputSha256=digest(output))
    report.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(receipt["positions"], indent=2))


if __name__ == "__main__":
    main()
