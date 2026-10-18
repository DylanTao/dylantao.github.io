"""Renovate the coastal home (Sirui, 2026-10-16); see coastal_renovation.py, coastal_shell.py and
coastal_office.py.

Run with Blender 4.5 LTS from the repository root, after bin/refresh_coastal_gym.py:
  blender -b --python-exit-code 1 --python bin/refresh_coastal_renovation.py [-- --preview=DIR]
then bin/bake_coastal_light.py, bin/optimize_coastal_exports.py -- --interiors-only,
bin/review_coastal_models.py and bin/build_coastal_perch_support.py. Every step is idempotent:
the carving and the moves happen once (the house file remembers them), the rebuilt pieces are
replaced on every run, and the manifest's data is recomputed from the same constants.
--preview renders every room from its web camera (and the renovation's close views) and saves
nothing.
"""

import json
import math
import sys
from pathlib import Path
import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_office as office
import coastal_preview as preview
import coastal_renovation as renovation
import coastal_shell as shell
from coastal_landscape import web

SOURCE = ROOT / "artwork/coastal-home/coastal-home.blend"
MANIFEST = ROOT / "assets/models/home/manifest.json"
args = {a.split("=", 1)[0][2:]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
preview_dir = args.get("preview")
# Phases run in order (1 materials and edges, 2 the larger house and office, 3 the living room,
# 4 dining and kitchen); --phase=N stops after phase N.
PHASE = int(args.get("phase", 2))
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
config = json.loads(MANIFEST.read_text(encoding="utf-8"))
report = {}

# 1. Materials: wood, stone, a little metal.
report["palette"] = renovation.apply_palette()

# 2. A larger house: the excavation 2.4 m deeper, the stair and back fittings moved with the wall.
report["deepened"] = shell.deepen_cave(scene)
report["moved"] = shell.move_back(scene)
floors, report["floors"] = shell.build_floors(scene)
shell.build_screens(scene)
shell.bedroom_back(scene)

# 3. The onsen keeps a shadow-only copy of the vault over it (the cut-away lifts the real one), now
# over its new depth too, so the bath still takes direct sun only through the light well.
def onsen_shadow_vault():
    old = bpy.data.objects.get("onsen_shadow_vault")
    material = old.data.materials[0] if old else bpy.data.materials["chalk limestone"]
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    low, high = Vector((1.9, shell.NEW_BACK - 0.1, 3.9)), Vector((5.75, -1.2, 8.4))
    pieces = []
    for name in ("core_liftaway_cave_ceiling", "core_liftaway_cave_ceiling_rear"):
        source = bpy.data.objects[name]
        copy = source.copy()
        copy.data = source.data.copy()
        scene.collection.objects.link(copy)
        for key in list(copy.keys()):
            del copy[key]
        region = shell._box_object("onsen region", tuple(low), tuple(high), material)
        shell.boolean(copy, region, "INTERSECT")
        bpy.data.objects.remove(region, do_unlink=True)
        pieces.append(copy)
    bpy.ops.object.select_all(action="DESELECT")
    for piece in pieces:
        piece.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.object.join()
    vault = bpy.context.view_layer.objects.active
    # The curtain on the bath's south side, as coastal_lightwell.shadow_vault() hangs it.
    bm = bmesh.new()
    bm.from_mesh(vault.data)
    to_local = vault.matrix_world.inverted()
    curtain = Matrix.Translation(to_local @ Vector((low.x - 0.05, (low.y + high.y) / 2, (2.85 + 5.9) / 2)))
    bmesh.ops.create_cube(bm, size=1, matrix=curtain @ Matrix.Diagonal((0.1, high.y - low.y, 5.9 - 2.85, 1)))
    bm.to_mesh(vault.data)
    bm.free()
    vault.data.materials.clear()
    vault.data.materials.append(material)
    vault.name = vault.data.name = "onsen_shadow_vault"
    vault["shadowOnly"] = True
    return len(vault.data.vertices)


report["onsenShadowVault"] = onsen_shadow_vault()

# 4. The office.
office_objects, report["office"] = office.build_office(scene)

# 5. The living room: the cloud sofa facing the TV wall, and the reading nook beyond it.
if PHASE >= 3:
    import coastal_living as living

    living_objects, report["living"] = living.build_living(scene)

# 6. Edges: smooth shading, weighted normals and rounded corners on every interior mesh.
report["softened"] = renovation.soften_interiors()

# 7. The manifest: the stair, the upper walk, the floors the feet stand on, the rooms' actors and
# walks, the camera's walls and the desk's props, all from the constants above.
def three(point):
    return [round(v, 4) for v in web(point)]


def update_manifest():
    D, Z0 = shell.DEPTH, shell.RISE
    nav = config["navigation"]
    start, end, n = 1.20, -2.70, 15
    depth = (start - end) / n
    nav["stairs"] = (
        [three((-2.1, shell.STAIR_Y, 0))]
        + [three((-0.8 - (start - (i + 0.5) * depth), shell.STAIR_Y, (i + 1) * Z0 / n)) for i in range(n)]
        + [three((2.35, shell.STAIR_Y, Z0)), three((2.35, shell.UPPER_AISLE_Y, Z0))]
    )
    nav["upperAisleZ"] = round(-shell.UPPER_AISLE_Y, 4)
    nav["lowerAisleZ"] = 3.3
    nav["stairX"] = 2.35
    nav["lowerStairApproach"] = [[-2.55, 0, 3.3], [-2.55, 0, round(-shell.STAIR_Y, 4)], [-2.1, 0, round(-shell.STAIR_Y, 4)]]
    back = round(-shell.LOWER_BACK - 0.2, 4)
    (nx0, nx1), (_, ny1) = shell.NOTCH["x"], shell.NOTCH["y"]
    surfaces = [
        {"id": "lower-floor", "height": 0, "polygon": [[-4.6, -4.6], [4.6, -4.6], [4.6, back], [-4.6, back]]},
        {"id": "upper-gallery", "height": Z0, "polygon": [[-4.6, 1.3], [4.6, 1.3], [4.6, back], [nx1, back], [nx1, -ny1], [nx0, -ny1], [nx0, back], [-4.6, back]]},
    ]
    for i in range(n):
        x = -2.0 + (i + 0.5) * 0.26
        z0, z1 = round(4.12 + D, 4), round(5.18 + D, 4)
        surfaces.append({"id": f"tread-{i + 1}", "height": round((i + 1) * Z0 / n, 5), "polygon": [[x - 0.134, z0], [x + 0.134, z0], [x + 0.134, z1], [x - 0.134, z1]]})
    config["terrain"]["supportSurfaces"] = [s for s in config["terrain"]["supportSurfaces"] if not (s["id"] in ("lower-floor", "upper-gallery") or s["id"].startswith("tread-"))] + surfaces
    rooms = {r["id"]: r for r in config["rooms"]}
    aisle = shell.UPPER_AISLE_Y
    ax, ay = office.ACTOR
    study = rooms["study"]
    study.update(
        actor=three((ax, ay, Z0)),
        facing=-math.pi / 2,
        target=three((-0.35, -3.8, 4.05)),
        egress=three((1.3, aisle, Z0)),
        exitPath=[three((0.15, -3.5, Z0)), three((1.3, -3.9, Z0)), three((1.3, aisle, Z0))],
    )
    study["camera"] = {
        # From over the living room's double height: Sirui's profile at the 43-inch, the 32-inch, the
        # turntable and the RGB tower on the return, the records on the bookshelf behind.
        "radius": 3.9,
        "yaw": 2.85,
        "pitch": 0.24,
        "fov": 40,
        "envelope": {"yaw": [2.45, 3.25], "pitch": [0.12, 0.62], "radius": [3.0, 4.5], "clearance": {"origin": study["target"][:], "maxX": 1.72, "maxZ": 9.0}},
    }
    top = Z0 + office.DESK_TOP
    shelf_top = Z0 + office.SHELF["top"] + 0.024
    study["desk"] = {
        "turntable": three((*office.TURNTABLE, top + 0.035)),
        "papers": [three((x, y, top + 0.0045)) for x, y in office.PAPERS],
        "paperYaw": 0.0,
        "records": [three((x, y, shelf_top + 0.176)) for x, y in office.RECORDS],
        "recordYaw": round(math.pi + 0.05, 4),
        # The invisible "window" hotspot that leads outside stands edge-on along the onsen screen: the
        # office camera now looks in through the gallery opening the hotspot used to fill.
        "window": three((1.84, -3.6, 3.9)),
        "windowYaw": round(math.pi / 2, 4),
        "drop": {"origin": three((0.0, -2.25, Z0 + 0.024)), "step": [0.42, 0.002, 0], "alternate": [0, 0, 0.09]},
        "focus": three((-0.55, -3.0, 4.25)),
    }
    # The evening on the sofa's inland arm, facing the sea, seen through the glass front's middle pane
    # between the curtain stacks: Sirui's face, the cloud U around him, the TV wall to the left.
    lounge = rooms["lounge"]
    lx, ly = living.ACTOR if PHASE >= 3 else (None, None)
    if PHASE >= 3:
        lounge.update(
            label="Living room",
            actor=three((lx, ly, 0)),
            facing=math.pi,
            target=three((0.75, 1.25, 1.0)),
            egress=three((2.05, -0.6, 0)),
            exitPath=[three((1.0, 1.1, 0)), three((1.55, 1.05, 0)), three((2.05, 0.15, 0)), three((2.05, -0.6, 0))],
        )
        lounge["camera"] = {"radius": 5.4, "yaw": 3.3, "pitch": 0.3, "fov": 40, "envelope": {"yaw": [2.85, 3.75], "pitch": [0.12, 0.62], "radius": [4.2, 6.4]}}
        for name, (x, y, z) in (("anchor_lounge", (lx, ly, 0)),):
            if bpy.data.objects.get(name):
                bpy.data.objects[name].location = Vector((x, y, z))
    rooms["sleep"].update(egress=three((-2.12, aisle, Z0)), exitPath=[three((-2.12, -3.95, Z0)), three((-1.95, -4.7, Z0)), three((-2.12, aisle, Z0))])
    rooms["onsen"].update(egress=three((3.17, aisle, Z0)), exitPath=[three((3.17, -4.45, Z0)), three((3.17, aisle, Z0))])
    config["terrain"]["contacts"] = {r["id"]: {k: r[k] for k in ("actor", "egress", "floor", "exitPath") if k in r} for r in config["rooms"]}
    walls = config["cameraCollision"]["walls"]
    house = [
        {"min": [-5.2, -0.26, -4.5], "max": [-4.7, 6, round(5.55 + D, 3)]},
        {"min": [4.7, -0.26, -4.5], "max": [5.2, 6, round(5.55 + D, 3)]},
        {"min": [-5.2, -0.26, round(5.35 + D, 3)], "max": [5.2, 6, round(5.65 + D, 3)]},
        {"min": [-4.7, 2.34, 1.3], "max": [4.7, 2.6, round(-ny1, 3)]},
    ]
    config["cameraCollision"]["walls"] = house + [w for w in walls if w.get("gym")]
    anchor = bpy.data.objects.get("anchor_study")
    if anchor:
        anchor.location = Vector((ax, ay, Z0))
    return {"stairs": len(nav["stairs"]), "surfaces": len(surfaces)}


report["manifest"] = update_manifest()

if preview_dir:
    out = Path(preview_dir)
    out = out if out.is_absolute() else ROOT / out
    camera = preview.setup(scene, resolution=(1200, 800))
    views = preview.manifest_views(config, rooms=args.get("rooms", "").split(",") if args.get("rooms") else None, orbit="orbit" in args)
    overview = config["views"]["overview"]
    views["overview"] = preview.room_eye({"target": overview["target"], "camera": overview})
    views.update(
        {
            "study-desk": ((0.6, -2.2, 4.0), (-0.9, -4.1, 3.45), 55),
            "study-pc": ((0.4, -3.2, 3.9), (0.75, -4.75, 3.65), 55),
            "study-shelf": ((0.2, -2.9, 4.2), (-0.2, -5.6, 4.1), 55),
            "study-back": ((-0.2, -6.4, 4.4), (-0.6, -3.6, 3.4), 60),
            "upper-floor": ((0.0, 1.5, 7.5), (0.0, -4.8, 2.6), 60),
            "lower-back": ((0.5, -1.0, 1.6), (0.0, -6.8, 0.9), 65),
            "bedroom-back": ((-2.6, -3.0, 4.2), (-4.0, -6.5, 3.2), 60),
            "onsen-back": ((2.6, -2.5, 4.2), (3.6, -6.8, 3.1), 60),
        }
    )
    print(json.dumps({k: (len(v) if isinstance(v, (list, dict)) else v) for k, v in report.items()}, default=str), flush=True)
    print(json.dumps(report.get("deepened"), default=str), json.dumps(report.get("moved"), default=str), flush=True)
    print("RENDERED", preview.render(scene, camera, views, out), flush=True)
    sys.exit(0)

MANIFEST.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
scene["renovation"] = 2
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
(ROOT / "artwork/coastal-home/reviews/renovation.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
print(json.dumps({k: (len(v) if isinstance(v, (list, dict)) else v) for k, v in report.items()}, default=str), flush=True)
