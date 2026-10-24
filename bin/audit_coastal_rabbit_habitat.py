"""Audit and optionally repair only the west rabbit's final mainland loop.

Run with Blender --background --python-exit-code 1 --python
bin/audit_coastal_rabbit_habitat.py -- --apply

The source and delivered meshes are read-only. Without --apply this writes only
an audit receipt. --source=, --manifest= and --output= accept explicit paths.
Low iceplant and grasses are soft groundcover; rigid scrub, agave and trees remain
in the original conservative body guard. Every botanical intersection is kept.
"""
import copy
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_camera import camera_support_meshes
from coastal_retreat import sync_west_rabbit_habitat
from rabbit_habitats import RABBIT_HABITAT_LOOPS, sample_loop

args = {a[2:].split("=", 1)[0]: a.split("=", 1)[1]
        for a in sys.argv if a.startswith("--") and "=" in a}


def argument_path(key, default):
    value = Path(args.get(key, default))
    return value if value.is_absolute() else ROOT / value


source = argument_path("source", "artwork/coastal-home/coastal-home.blend")
manifest = argument_path("manifest", "assets/models/home/manifest.json")
output = argument_path("output", "artwork/coastal-home/reviews/retreat-2026-10-24/rabbit-west-native-audit.json")
protected = [source, *sorted((ROOT / "assets/models/home").glob("*.glb"))]


def asset_key(path):
    return path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else path.as_posix()


protected_before = {asset_key(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
config = json.loads(manifest.read_text(encoding="utf-8"))
before = copy.deepcopy(config)
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.view_layer.update()
deps = bpy.context.evaluated_depsgraph_get()


def build(objects):
    vertices, faces = [], []
    for obj in objects:
        evaluated = obj.evaluated_get(deps)
        mesh = evaluated.to_mesh()
        offset = len(vertices)
        vertices.extend(obj.matrix_world @ vertex.co for vertex in mesh.vertices)
        faces.extend(tuple(offset + i for i in face.vertices) for face in mesh.polygons)
        evaluated.to_mesh_clear()
    return BVHTree.FromPolygons(vertices, faces)


objects = list(bpy.context.scene.objects)
ground_objects = camera_support_meshes(objects)
ground = build(ground_objects)
plants = [obj for obj in objects if obj.type == "MESH" and
          (obj.get("flora") or obj.get("roofPlanting") or any(
              material and (material.name in ("coastal sage scrub", "blue sage agave leaf", "coastal wildflower ochre")
                            or any(part in material.name.lower() for part in (
                                "agave", "foliage", "leaf", "frond", "sage scrub", "wildflower",
                                "palm bark", "fern", "olive trunk", "olive bark", "tree bark")))
              for material in obj.data.materials))]
foliage = build(plants)
plant_trees = [(obj.name, build([obj])) for obj in plants]
soft = {"core_flora_iceplant", "core_flora_iceplant_flowers", "core_flora_red_iceplant",
        "core_flora_dry_grass", "core_flora_wild_oats", "core_estate_garden_flora_grass"}
hard = build([obj for obj in plants if obj.name not in soft])


def height(x, y):
    hit = ground.ray_cast(Vector((x, y, 30)), Vector((0, 0, -1)), 60)[0]
    if hit is None:
        raise ValueError(("Missing physical support", x, y))
    return hit.z


stencil = [(i * .1, j * .1) for i in range(-3, 4) for j in range(-3, 4) if i * i + j * j <= 10]
perch_world = config["terrain"]["perches"][0]
perch = (perch_world[0], -perch_world[2])
plan = RABBIT_HABITAT_LOOPS["rabbitWest"]
path = sample_loop(plan, height)
result = {"plan": plan, "path": path, "samples": 0, "bodyRays": 0, "plantHits": 0,
          "maximumLinearSupportError": 0, "maximumGiveWayHeightError": 0,
          "neighborhoodMaximumDrop": 0, "neighborhoodMinimumDrop": 0,
          "unsupportedNeighborhoodSamples": 0, "witnesses": [], "plantGroups": {}, "hardPlantHits": 0}
nearest, hard_nearest = math.inf, math.inf
for index, a in enumerate(path):
    b = path[(index + 1) % len(path)]
    for i in range(8):
        t = i / 8
        x, y = a[0] * (1 - t) + b[0] * t, -(a[2] * (1 - t) + b[2] * t)
        h = a[1] * (1 - t) + b[1] * t - .025
        result["maximumLinearSupportError"] = max(result["maximumLinearSupportError"], abs(h - height(x, y)))
        for weight in (0, .25, .5, .75, 1):
            dx, dy = x - perch[0], y - perch[1]
            distance = math.hypot(dx, dy)
            push = weight * (1 - distance) ** 2 / 2 if 1e-6 < distance < 1 else 0
            xx = x + dx / distance * push if distance > 1e-6 else x
            yy = y + dy / distance * push if distance > 1e-6 else y
            result["maximumGiveWayHeightError"] = max(result["maximumGiveWayHeightError"], abs(h - height(xx, yy)))
            result["samples"] += 1
            for dh in (.22, .45, .65):
                hit = foliage.find_nearest(Vector((xx, yy, h + dh)))
                hard_hit = hard.find_nearest(Vector((xx, yy, h + dh)))
                if hit[0] is not None:
                    nearest = min(nearest, hit[3])
                if hard_hit[0] is not None:
                    hard_nearest = min(hard_nearest, hard_hit[3])
            for sx, sy in stencil:
                result["bodyRays"] += 1
                start = Vector((xx + sx, yy + sy, h + .02))
                if hard.ray_cast(start, Vector((0, 0, 1)), .83)[0] is not None:
                    result["hardPlantHits"] += 1
                hit = foliage.ray_cast(start, Vector((0, 0, 1)), .83)[0]
                if hit is not None:
                    result["plantHits"] += 1
                    for name, tree in plant_trees:
                        if tree.ray_cast(start, Vector((0, 0, 1)), .83)[0] is not None:
                            result["plantGroups"][name] = result["plantGroups"].get(name, 0) + 1
                    if len(result["witnesses"]) < 5:
                        result["witnesses"].append({"kind": "plant", "segment": index, "weight": weight,
                                                    "xyz": [xx + sx, yy + sy, h], "hit": list(hit)})
                drop = h - height(xx + sx, yy + sy)
                result["neighborhoodMaximumDrop"] = max(result["neighborhoodMaximumDrop"], drop)
                result["neighborhoodMinimumDrop"] = min(result["neighborhoodMinimumDrop"], drop)
                if drop > .6:
                    result["unsupportedNeighborhoodSamples"] += 1
result["minimumFoliageDistance"] = nearest
result["minimumHardFoliageDistance"] = hard_nearest
assert result["hardPlantHits"] == 0, "Rabbit body intersects rigid vegetation"
assert hard_nearest > .28, "Rabbit has insufficient rigid foliage clearance"
assert result["maximumLinearSupportError"] < .005, "Grounded loop floats from physical terrain"
assert result["maximumGiveWayHeightError"] < .03, "Actual XZ-only give-way loses close terrain contact"
assert result["unsupportedNeighborhoodSamples"] == 0, "Rabbit body neighborhood crosses an unsupported void"

# Exercise the very same source hook used after the final architectural migration.
sync_west_rabbit_habitat(bpy.context.scene, config)
assert config["terrain"]["habitats"]["rabbitWest"]["path"] == path, "Native builder differs from evaluated proof"
restored = copy.deepcopy(config)
restored["terrain"]["habitats"]["rabbitWest"]["path"] = before["terrain"]["habitats"]["rabbitWest"]["path"]
assert restored == before, "Repair changed metadata beyond the one west rabbit path"
if "--apply" in sys.argv:
    manifest.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
assert all(hashlib.sha256(p.read_bytes()).hexdigest() == protected_before[asset_key(p)]
           for p in protected), "Read-only source or delivered mesh changed"
report = {"sourceSha256": protected_before[asset_key(source)],
          "method": "Native evaluated BVH; final grounded 48-point loop; 8 substeps per segment; gull weights 0,.25,.5,.75,1; original 37-point body stencil; exact runtime XZ-only avoidance without Y reprojection",
          "groundMeshes": [obj.name for obj in ground_objects], "floraMeshes": [obj.name for obj in plants],
          "softGroundcoverMeshes": sorted(soft), "perchNativeXY": perch,
          "bodyColumn": {"radius": math.sqrt(10) * .1, "bottom": .02, "top": .85, "stencilPoints": len(stencil)},
          "result": result, "onlyWestRabbitPathChanged": True,
          "sourceAndDeliveredMeshesUnchanged": protected_before, "applied": "--apply" in sys.argv}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print("RABBIT_NATIVE_AUDIT " + json.dumps({k: v for k, v in result.items() if k not in ("path", "witnesses")}, separators=(",", ":")))
