"""Apply Sirui's October 24 entrance (bin/coastal_arrival_hall.py) to the canonical home source.

    blender --background -t 8 --python-exit-code 1 --python bin/refresh_coastal_arrival_hall.py -- \
        [--source=artwork/coastal-home/coastal-home.blend] [--manifest=assets/models/home/manifest.json] \
        [--output=.jekyll-cache/arrival-hall/coastal-home.blend] [--config-output=.jekyll-cache/arrival-hall/manifest.json] \
        [--report=.jekyll-cache/arrival-hall/report.json]

Writes a candidate source, its manifest and a report. Review the candidate (native views, the
overlap audit, Walk) before copying both over the canonical files; then bake and export as usual.
A source already carrying ``arrivalHallVersion`` is a checked no-op.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_arrival_hall as hall
import coastal_estate_architecture as library
import coastal_overlap_repairs as repairs
import coastal_renovation as renovation

ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}


def _path(key, default):
    p = Path(ARGS.get(key, default))
    return p if p.is_absolute() else ROOT / p


source = _path("source", "artwork/coastal-home/coastal-home.blend")
manifest_path = _path("manifest", "assets/models/home/manifest.json")
output = _path("output", ".jekyll-cache/arrival-hall/coastal-home.blend")
config_output = _path("config-output", ".jekyll-cache/arrival-hall/manifest.json")
report_path = _path("report", ".jekyll-cache/arrival-hall/report.json")
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
config = json.loads(manifest_path.read_text(encoding="utf-8"))
if scene.get("arrivalHallVersion") == hall.VERSION:
    print(json.dumps({"retained": True, "version": hall.VERSION, "source": str(source)}), flush=True)
    sys.exit(0)

m = library.materials()
m["paving"] = bpy.data.materials["travertine paving stone"]
m["cedar"] = bpy.data.materials["cedar wood"]
missing = [k for k, v in m.items() if v is None]
if missing:
    raise RuntimeError(f"Missing materials: {missing}")
objects, result = hall.build(scene, m)
report = result["report"]
caps = result["caps"]
report["softened"] = len(renovation.soften_interiors(objects))
report["pathConform"] = {name: repairs.conform_path(scene, name, report["pathGround"], radius=0.3, max_lift=0.20)
                         for name in ("core_arrival_paths__travertine paving stone", "core_arrival_paths_roof__travertine paving stone")
                         if bpy.data.objects.get(name)}

# --- Manifest -------------------------------------------------------------------------------------
retired = ("retreat-arrival-", "retreat-private-", "retreat-house-tread-")
terrain = config["terrain"]
terrain["supportSurfaces"] = [s for s in terrain["supportSurfaces"] if not s["id"].startswith(retired)] + hall.supports(caps)
down, stairs, approach = hall.routes(caps, result["samples"])
config["navigation"]["stairs"] = stairs
config["navigation"]["lowerStairApproach"] = approach
config["navigation"]["stairX"] = stairs[-1][0]
config["navigation"]["upperAisleZ"] = stairs[-1][2]
config.pop("privateEntrance", None)
entrance = config["entrance"]
entrance.update({
    "floor": 0, "top": hall.TOP, "portal": down[0], "foyer": [down[-1][0], 0, down[-1][2]],
    "route": list(reversed(down)), "headroom": 2.1, "stairWidth": 1.2, "riser": round(hall.RISE_BC, 5), "going": hall.GOING,
    "publicDestination": "lower living floor through the pivot door; the upper floor's door is on the stair's landing",
    "curved": False, "hall": {"min": [hall.HALL["x"][0], 0.0, hall.HALL["zw"][0]], "max": [hall.HALL["x"][1], hall.CEILING["high"], hall.HALL["zw"][1]]},
    "pivotDoor": {"x": list(hall.DOOR["x"]), "height": hall.DOOR["h"], "pivotX": hall.DOOR["pivotX"], "z": hall.BACK_FACE},
})
walk = config["walk"]
walk["mainEntryRoute"] = down + [[down[-1][0], 0.0, 13.6], [3.27, 0.0, 13.6], [3.27, 0.0, 9.2]]
first, second = walk["mainEntryRoute"][:2]
walk["start"] = {"position": first[:], "yaw": math.atan2(second[0] - first[0], second[2] - first[2]), "pitch": -0.08}
door_z = hall.BACK_FACE + 0.05
config["estateDoors"] = [
    {"id": "main", "nodes": result["leaves"]["main"], "pivot": {"x": hall.DOOR["pivotX"], "z": door_z, "angle": -math.pi / 2},
     "center": [0.0, 1.5, door_z], "opening": {"min": [hall.DOOR["x"][0], 0, hall.BACK_FACE - 0.05], "max": [hall.DOOR["x"][1], hall.DOOR["h"], hall.HALL["zw"][0]]},
     "activationDistance": 2.4, "floor": 0, "material": "sandstone pivot leaf, the wall's own face"},
    {"id": "upper", "nodes": result["leaves"]["upper"], "slideX": -1.15,
     "center": [sum(hall.UPPER_DOOR["x"]) / 2, 3.7, 16.0], "opening": {"min": [hall.UPPER_DOOR["x"][0], 2.6, 15.5], "max": [hall.UPPER_DOOR["x"][1], 4.8, 16.4]},
     "activationDistance": 1.8, "floor": 2.6, "material": "oak pocket leaf"},
]
hall_box = {"min": [hall.HALL["x"][0] - 0.1, -0.1, hall.HALL["zw"][0] - 0.8], "max": [hall.HALL["x"][1] + 0.1, hall.TOP + 2.6, hall.HALL["zw"][1] + 0.2]}
config["interiorLights"]["entrance"] = {"positions": [[0.0, 2.9, 17.0], [2.65, 4.7, 16.9]], "region": hall_box}
receivers = config["installationReceivers"]["groups"]
receivers["arrival"] = hall_box
# The living and upper floor end at the back wall's hall-side face; behind it is the hall, whose own
# fixtures must not count against the living's shader capacity (regions closer than twice the
# receiver tolerance, 5 cm, would still overlap).
back = round(hall.BACK_FACE + 0.40, 2)
for name in ("living", "upper", "architecture"):
    for region in receivers[name] if isinstance(receivers[name], list) else [receivers[name]]:
        region["max"][2] = min(region["max"][2], back)
lines = [line for line in config["installationLines"] if line.get("id") not in ("portal-brow", "back-wall-graze") and not line.get("id", "").startswith("arrival-")]
roof = hall.PAVILION["roof"]
lines.insert(0, {"id": "portal-brow", "a": [hall.PAVILION["inner"][0] + 0.05, roof - 0.09, hall.HALL["zw"][1] - 0.03],
                 "b": [hall.PAVILION["inner"][1] - 0.05, roof - 0.09, hall.HALL["zw"][1] - 0.03], "intensity": 0.18,
                 "schedule": "steps", "transport": False, "glowTag": "outdoor-portal",
                 "region": {"min": [-4.2, hall.TOP - 0.1, 20.5], "max": [-1.5, roof + 0.3, 24.6]}})
lines.append({"id": "back-wall-graze", "a": [-1.92, 5.49, 15.51], "b": [1.92, 5.49, 15.51], "intensity": 0.26, "schedule": "soffit",
              "transport": False, "glowTag": "back-wall-graze", "region": {"min": [-2.2, -0.1, 13.9], "max": [2.2, 5.9, 15.65]}})
# The hall has no window but three small oculi, so it is lit like a gallery all day: a line under
# each wall handrail grazes the stone and lights every tread, and a cove at the top of the well
# washes the landward wall. They follow the entrance's schedule and feed the cached bounce.
(hx0, hx1), (hz0, hz1) = hall.HALL["x"], hall.HALL["zw"]
under = 0.92 - 0.07  # just below the handrail's centre
# Analytic fixtures cast no shadow, so their regions stay inside the rock: under the clifftop over the
# hall (7.3 m at its lowest), and for the top flight, inside the pavilion's walls.
GROUND_OVER_HALL = 7.25
inside = {"min": [hx0 - 0.05, -0.1, back + 0.12], "max": [hx1 + 0.05, GROUND_OVER_HALL, hz1 + 0.2]}
pavilion = {"min": [hx0 - 0.05, hall.LB["h"] - 0.25, hall.LB["zw"][0] - 0.1],
            "max": [hall.PAVILION["inner"][1] + 0.05, hall.PAVILION["roof"] + 0.1, hz1 + 0.2]}
rail = lambda key, a, b, region=inside: {"id": f"arrival-rail-{key}", "a": a, "b": b, "intensity": 1.6, "schedule": "entrance",
                                         "transport": True, "region": region}
lines += [
    rail("a", [hx1 - 0.07, under, hall.A_FOOT], [hx1 - 0.07, hall.LA["h"] + under, hall.LA["zw"][1]]),
    rail("b", [hall.LA["x"][0], hall.LA["h"] + under, hz0 + 0.07], [hall.LB["x"][1], hall.LB["h"] + under, hz0 + 0.07]),
    rail("c", [hx0 + 0.07, hall.LB["h"] + under, hall.LB["zw"][1]], [hx0 + 0.07, hall.TOP + under, hall.PORTAL["zw"][0]], pavilion),
    {"id": "arrival-well-wash", "a": [hall.PAVILION["inner"][1] + 0.05, hall.CEILING["low"] - 0.1, hz1 - 0.07],
     "b": [hx1 - 0.05, hall.CEILING["low"] - 0.1, hz1 - 0.07], "intensity": 1.0, "schedule": "entrance", "transport": True, "region": inside},
]
config["installationLines"] = lines
shelters = [s for s in config.get("weatherShelters", []) if s.get("id") != "arrival-hall"]
shelters.append({"id": "arrival-hall", "min": [hall.HALL["x"][0], -0.3, hall.HALL["zw"][0]], "max": [hall.HALL["x"][1], hall.CEILING["high"], hall.HALL["zw"][1]]})
config["weatherShelters"] = shelters
regions = [r for r in config.get("lightTransportRegions", []) if r.get("id") != "arrival-hall"]
# The hall's probe cage stops below the clifftop over it, so the ground above never reads the hall's light.
regions.append({"id": "arrival-hall", "min": [hall.HALL["x"][0], -0.05, hall.HALL["zw"][0]],
                "max": [hall.HALL["x"][1], round(hall.CEILING["low"] + 0.9, 2), hall.HALL["zw"][1]]})
config["lightTransportRegions"] = regions
# The companion's lowered air points along the retired floating stair no longer match any route.
overrides = config["companion"].get("airPointOverrides", [])
config["companion"]["airPointOverrides"] = [o for o in overrides if not (-2.3 < o["point"][0] < 2.5 and 14.8 < o["point"][2] < 15.7)]
# The gull's gallery perch stood on the handrail where the onsen's louvered screen now guards the
# edge; it moves west of the screen, midway between two of the rail's remaining brass posts.
config["retreat"]["galleryPerch"] = [0.29, 3.46, 9.31]
perches = config["companion"]["perches"]
if "onsen" in perches:
    # Clear of the louvered screen on the gallery's edge, the slat screen and the tub's rim stones.
    perches["onsen"] = [[2.13, 2.6, 9.98], [2.07, 2.6, 10.02]]
# The companion's delivered route preset is the source apply_companion_routes() reads: keep it equal.
preset_path = ROOT / "artwork/coastal-home/companion-flight-paths.json"
preset = json.loads(preset_path.read_text(encoding="utf-8"))
for key in preset:
    if key in config["companion"]:
        preset[key] = config["companion"][key]
preset_path.write_text(json.dumps(preset, indent=1) + "\n", encoding="utf-8", newline="\n")
from coastal_camera import create_camera_height, sample_camera_elevations
config["cameraCollision"]["elevations"] = sample_camera_elevations(config["cameraCollision"], create_camera_height(list(scene.objects)))
report["objects"] = [o.name for o in objects]
report["newTriangles"] = sum(sum(len(f.vertices) - 2 for f in o.data.polygons) for o in objects)
report["routes"] = {"down": len(down), "stairs": len(stairs)}

for p in (output, config_output, report_path):
    p.parent.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
report["source"] = source.relative_to(ROOT).as_posix() if source.is_relative_to(ROOT) else str(source)
report["sourceSha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
report["outputSha256"] = hashlib.sha256(output.read_bytes()).hexdigest()
config_output.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8", newline="\n")
report_path.write_text(json.dumps(report, indent=1, default=str) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"output": str(output), "objects": len(objects), "newTriangles": report["newTriangles"], "routes": report["routes"]}), flush=True)
