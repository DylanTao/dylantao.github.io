"""The interior pass (Sirui, 2026-10-20): the open kitchen, the sunken breakfast nook and the dining room
first, then the living room's conversation pit and its fireplace flue, the entrance, the rock around the
cave, the gym's light and the outdoor pool. See coastal_kitchen.py and the modules each phase names.

Run with Blender 4.5 LTS from the repository root:
  blender -b --python-exit-code 1 --python bin/refresh_coastal_interior.py -- --phases=kitchen [--preview=DIR]
then bin/bake_coastal_light.py -- --prefixes=core_,kitchen_ and bin/optimize_coastal_exports.py.
Every phase is idempotent: the floor cuts happen once (the house file remembers them), the rebuilt
pieces are replaced on every run, and the manifest's data is recomputed from the same constants.
--preview renders the phases' views from the web manifest's cameras and close views, and saves nothing.
"""

import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_anchors as anchors
import coastal_preview as preview
import coastal_renovation as renovation
import coastal_shell as shell
import coastal_sunken as sunken
from coastal_landscape import web

SOURCE = ROOT / "artwork/coastal-home/coastal-home.blend"
MANIFEST = ROOT / "assets/models/home/manifest.json"
args = {a.split("=", 1)[0][2:]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
PHASES = [p for p in args.get("phases", "kitchen").split(",") if p]
preview_dir = args.get("preview")
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
config = json.loads(MANIFEST.read_text(encoding="utf-8"))
review_path = ROOT / "artwork/coastal-home/reviews/interior.json"
report = json.loads(review_path.read_text()) if review_path.exists() else {}
report["phases"] = sorted(set(report.get("phases", []) + PHASES))
views = {}


def three(point):
    return [round(v, 4) for v in web(point)]


def set_supports(prefix, supports):
    """Replace the manifest terrain supports whose id starts with `prefix`."""
    terrain = config["terrain"]
    terrain["supportSurfaces"] = [s for s in terrain["supportSurfaces"] if not s["id"].startswith(prefix)] + supports


def sunken_holes():
    """Every sunken opening the phases so far have made, for relaying the ground floor's boards."""
    holes = []
    for key in scene.get("sunkenCuts", []):
        x0, x1, y0, y1, _ = (float(v) for v in key.split(","))
        holes.append((x0, x1, y0, y1))
    return holes


def move_islands(objects, box_lo, box_hi, delta):
    """Move every island of `objects` lying inside the box by `delta` (the back hall's potted plants)."""
    moved = 0
    for name in objects:
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        moved += shell.edit_islands(obj, lambda lo, hi: delta if shell.inside(lo, hi, box_lo, box_hi) else None)[0]
    return moved


# ── 1. Kitchen, breakfast nook and dining room ────────────────────────────────────────────────────
if "kitchen" in PHASES:
    import coastal_kitchen as kitchen

    objects, placeholders, supports, report["kitchen"] = kitchen.build_kitchen(scene)
    nook = (kitchen.NOOK["x"][0], kitchen.NOOK["x"][1], kitchen.NOOK["y"][0], kitchen.NOOK["y"][1])
    # --skip-cut (previews only) leaves the slab and the coast block uncut, for quick camera checks.
    report["kitchenCuts"] = [] if "skip-cut" in args else sunken.cut_ground(scene, [nook])
    boards, report["kitchenBoards"] = sunken.relay_boards(scene, sunken_holes())
    report["kitchenSoftened"] = len(renovation.soften_interiors(objects + placeholders + [boards]))
    # The back hall's potted plant stood where the kitchen's walk to the stair now passes the dining
    # room: it moves into the corner beside the pantry.
    report["kitchenPlantPieces"] = 0 if scene.get("kitchenPlantMoved") else move_islands(
        ("core__terracotta", "core__olive leaf", "core__charcoal", "core__honey ash"),
        (-4.1, -5.1, -0.05), (-2.6, -3.6, 1.6), (-0.97, -0.92, 0.0)
    )
    scene["kitchenPlantMoved"] = True
    set_supports("nook-", supports)
    rooms = {r["id"]: r for r in config["rooms"]}
    room = rooms["kitchen"]
    seat = three((kitchen.SEAT[0], kitchen.SEAT[1], kitchen.SEAT_ACTOR_Z))
    # The shell's room anchor follows the actor (test_coastal_assets checks the exported empties).
    if bpy.data.objects.get("anchor_kitchen"):
        bpy.data.objects["anchor_kitchen"].location = Vector((kitchen.SEAT[0], kitchen.SEAT[1], kitchen.SEAT_ACTOR_Z))
    room.update(
        actor=seat,
        facing=math.pi,
        target=three((-3.45, 1.75, 0.62)),
        egress=three((kitchen.EGRESS[0], kitchen.EGRESS[1], 0)),
        exitPath=[three((kitchen.COFFEE_WAY[0], kitchen.COFFEE_WAY[1], 0)), three((kitchen.EGRESS[0], kitchen.EGRESS[1], 0))],
    )
    # The arrival view through the kitchen door: Sirui in the nook facing the sea, the island and the
    # coffee bar, and the dining room and the cooking bay beyond the open kitchen. The orbit stays low
    # enough that the view passes under the bronze door head and the gallery soffit.
    # Inside the open sliding door, the primary meal view stays clear of the hanging sheer's stack.
    room["target"] = [-3.85, 0.95, -3.0]
    room["camera"] = {"radius": 3.2, "yaw": 1.96, "pitch": 0.24, "envelope": {"yaw": [1.6, 2.2], "pitch": [0.15, 0.55], "radius": [2.6, 4.1]}}
    if args.get("kcam"):  # previews: --kcam=tx,ty,tz,yaw,pitch,radius (Blender target)
        tx, ty, tz, yaw, pitch, radius = (float(v) for v in args["kcam"].split(","))
        room["target"] = three((tx, ty, tz))
        room["camera"].update(yaw=yaw, pitch=pitch, radius=radius)
    coffee = config["equipment"]["coffee"]
    coffee.update(approach=[three((kitchen.EGRESS[0], kitchen.EGRESS[1], 0)), three((kitchen.COFFEE_WAY[0], kitchen.COFFEE_WAY[1], 0)), coffee["actor"]], seat=seat)
    px, py, pz = kitchen.PENDANT
    dx, dy, dz = kitchen.DINING_LIGHT
    (lx0, lx1), lz = kitchen.SHELF_LIGHT["y"], kitchen.SHELF_LIGHT["z"]
    config["interiorLights"] = {
        # Three.js coordinates. The nook's lantern, the soffit downlights over the cooking bay and the
        # dining room's saucer pendants (a downlight under the pair), one vault downlight over the
        # island and the line under the lower shelf, all bounded by the kitchen and dining bay
        # (light-installations.mjs).
        "region": {"min": [-5.15, -0.5, -4.45], "max": [-0.2, 5.4, 4.75]},
        "pendant": three((px, py, pz)),
        "downlights": [three((x, y, kitchen.SOFFIT - 0.012)) for x, y in kitchen.DOWNLIGHTS] + [three((dx, dy, dz))],
        "vault": [three((-2.45, 0.75, 4.6))],
        "shelf": [three((kitchen.SHELF_LIGHT["x"] + 0.15, lx0, lz)), three((kitchen.SHELF_LIGHT["x"] + 0.15, lx1, lz))],
    }
    # The capybara print on the cave wall above the nook's banquette, facing the kitchen (+x), and the
    # brass picture light above it (warm-practicals.mjs "kitchen").
    cx, cy, cz = kitchen.PRINT["center"]
    config["wallArt"].update(
        position=three((cx, cy, cz)),
        yaw=round(anchors.blender_yaw_to_three((1, 0)), 4),
        size=kitchen.PRINT["size"],
        light=three(kitchen.PICTURE_LIGHT),
    )
    # The walk between the rooms of the ground floor passes behind the dining room now (y -5.6).
    nav = config["navigation"]
    nav["lowerAisleZ"] = 5.6
    nav["lowerStairApproach"] = [[-2.55, 0, 5.6], [-2.55, 0, round(-shell.STAIR_Y, 4)], [-2.1, 0, round(-shell.STAIR_Y, 4)]]
    anchors.merge_anchors(config, kitchen.furniture_anchors())
    report["kitchenAnchors"] = [e["id"] for e in kitchen.furniture_anchors()]
    views.update(
        {
            "kitchen-nook": ((-2.3, 3.0, 1.55), (-4.2, 3.3, 0.2), 60),
            "kitchen-bay": ((-2.6, -0.3, 1.7), (-4.4, -2.6, 1.2), 62),
            "kitchen-dining": ((0.6, -0.9, 1.75), (-2.2, -3.4, 0.6), 62),
            "kitchen-from-living": ((1.2, 1.4, 2.0), (-3.4, -1.6, 0.9), 62),
            "kitchen-top": ((-2.6, -0.4, 9.0), (-2.6, -0.4, 0.0), 62),
        }
    )

# ── 2. The living room's conversation pit, the fireplace's flue and its clifftop cap ───────────────
if "living" in PHASES:
    import coastal_living as living

    if any(key.startswith(f"{living.PIT['x'][0]:.3f},{living.PIT['x'][1]:.3f}") for key in scene.get("sunkenCuts", [])):
        scene["livingPlantMoved"] = True

    objects, placeholders, supports, report["living"] = living.build_living(scene)
    pit = (living.PIT["x"][0], living.PIT["x"][1], living.PIT["y"][0], living.PIT["y"][1])
    report["livingCuts"] = [] if "skip-cut" in args else sunken.cut_ground(scene, [pit])
    boards, report["livingBoards"] = sunken.relay_boards(scene, sunken_holes())
    report["livingSoftened"] = len(renovation.soften_interiors(objects + placeholders + [boards]))
    # The jute sun and the shelf of pots leave the north wall to the TV: they move along it into the
    # back hall, where the dining room sees them.
    decor = [o for o in scene.objects if o.name.startswith("lounge_decor")]
    if not scene.get("livingDecorMoved"):
        for obj in decor:
            obj.location.y -= 3.3
        scene["livingDecorMoved"] = True
    # The back hall's other potted plant moves toward the north wall, clear of the walk to the gym.
    report["livingPlantPieces"] = 0 if scene.get("livingPlantMoved") else move_islands(
        ("core__terracotta", "core__olive leaf", "core__charcoal", "core__honey ash"),
        (3.2, -3.9, -0.05), (4.6, -2.5, 1.6), (0.55, 0.0, 0.0)
    )
    scene["livingPlantMoved"] = True
    set_supports("pit-", supports)
    rooms = {r["id"]: r for r in config["rooms"]}
    lounge = rooms["lounge"]
    sx, sy = living.SEAT
    if bpy.data.objects.get("anchor_lounge"):
        bpy.data.objects["anchor_lounge"].location = Vector((sx, sy, living.SEAT_ACTOR_Z))
    lounge.update(
        actor=three((sx, sy, living.SEAT_ACTOR_Z)),
        facing=math.pi,
        target=three((0.55, 0.55, 0.42)),
        egress=three((3.27, -1.2, 0)),
        exitPath=[
            three((sx, sy + 0.46, living.PIT_FLOOR)),
            three((0.1, 2.1, living.PIT_FLOOR)),
            three((0.1, 2.5, living.PIT_FLOOR / 2)),
            three((0.3, 2.95, 0)),
            three((3.27, 2.88, 0)),
            three((3.27, -1.2, 0)),
        ],
    )
    # The evening in the pit, seen through the glass front's middle pane: Sirui's face past the fire,
    # the cloud seating around him; the orbit passes under the bronze door head.
    lounge["camera"] = {"radius": 5.8, "yaw": 3.18, "pitch": 0.34, "fov": 40, "envelope": {"yaw": [2.95, 3.42], "pitch": [0.12, 0.45], "radius": [4.4, 6.4]}}
    # The gym's walk leaves the living room along the passage and turns inland past the pit's north end.
    gym = rooms["gym"]
    gym.update(egress=three((3.5, 1.55, 0)), exitPath=[three((6.9, 1.55, 0)), three((5.5, 1.55, 0)), three((4.45, 1.55, 0)), three((3.5, 1.55, 0))])
    fx, fy = living.FIREPLACE
    config["fireplace"] = {
        "anchor": "living-fireplace",
        # The flue's top on the clifftop and the cap's footing (three.js metres); the cap is a cluster of
        # sandstone boulders lifted away with the roof in cut-away views.
        "flueTop": three((fx, fy, report["living"]["flueTop"])),
        "cap": three((fx, fy, report["living"]["clifftop"])),
        "flueStart": three((fx, fy, living.FLUE_START)),
        "flueRadius": living.FLUE_RADIUS,
    }
    anchors.merge_anchors(config, living.furniture_anchors())
    report["livingAnchors"] = [e["id"] for e in living.furniture_anchors()]
    views.update(
        {
            "living-pit": ((3.6, 3.4, 2.2), (0.6, 0.6, -0.1), 60),
            "living-from-kitchen": ((-2.6, 1.2, 1.9), (2.5, 1.0, 0.3), 62),
            "living-eames": ((2.2, 4.1, 1.7), (4.2, 2.9, 0.4), 60),
            "living-tv": ((1.0, 2.6, 1.3), (5.0, 0.2, 1.0), 62),
            "living-flue": ((-2.8, 3.8, 1.6), (1.0, 1.0, 3.6), 70),
            "living-top": ((0.9, 0.9, 9.0), (0.9, 0.9, 0.0), 62),
            "clifftop-cap": ((4.0, 5.0, 9.0), (0.95, 1.15, 7.3), 50),
        }
    )

if any(p in PHASES for p in ("entrance", "pool", "gym")):
    import coastal_arrival as arrival
    if "entrance" in PHASES:
        previous_cuts = report.get("entrance", {}).get("cuts", [])
        objects, supports, report["entrance"] = arrival.build_entry(scene, config)
        if not report["entrance"]["cuts"]:
            report["entrance"]["cuts"] = previous_cuts
        renovation.soften_interiors(objects)
        set_supports("arrival-", supports)
        views["entrance-top"] = ((6.5, -20.0, 12.2), (3.42, -17.8, arrival.ENTRY["top"] + 0.5), 55)
        views["entrance-foyer"] = ((2.7, -7.25, 4.10), (3.42, -10.0, 3.5), 68)
    if "pool" in PHASES:
        objects, supports, report["pool"] = arrival.build_pool(scene, config)
        renovation.soften_interiors(objects)
        set_supports("infinity-", supports)
        views["infinity-pool"] = ((5.8, 13.8, 3.7), (-0.9, 8.7, -0.1), 55)
    if "gym" in PHASES:
        objects, report["gymStation"] = arrival.build_gym_station(scene, config)
        renovation.soften_interiors(objects)
        views["gym-pan"] = ((8.1, 3.2, 2.0), (6.75, 1.15, 0.7), 60)

config["terrain"]["contacts"] = {r["id"]: {k: r[k] for k in ("actor", "egress", "floor", "exitPath") if k in r} for r in config["rooms"]}

if preview_dir:
    out = Path(preview_dir)
    out = out if out.is_absolute() else ROOT / out
    camera = preview.setup(scene, resolution=(1200, 800), cutaway="roof" not in args)
    preview.add_fill(scene, "fill lower", (0.0, 1.5, 2.2), energy=120, size=6.0)
    preview.add_fill(scene, "fill back", (-1.5, -3.5, 2.2), energy=60, size=4.0)
    rendered = preview.manifest_views(config, rooms=[r for p, r in (("kitchen", "kitchen"), ("living", "lounge")) if p in PHASES], orbit=False)
    rendered.update(views)
    if args.get("only"):
        rendered = {k: v for k, v in rendered.items() if k in args["only"].split(",")}
    print(json.dumps(report, default=str), flush=True)
    print("RENDERED", preview.render(scene, camera, rendered, out), flush=True)
    sys.exit(0)

MANIFEST.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
(ROOT / "artwork/coastal-home/reviews/interior.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
print(json.dumps(report, default=str), flush=True)
