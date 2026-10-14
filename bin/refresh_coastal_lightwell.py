"""Drill the light well into the retained house (Sirui, 2026-10-14); see coastal_lightwell.py.

Run with Blender 4.5 LTS from the repository root:
  blender -b --python-exit-code 1 --python bin/refresh_coastal_lightwell.py
then bin/bake_coastal_light.py -- --room=onsen and bin/optimize_coastal_exports.py -- --interiors-only.
The shaft is drilled once; re-running rebuilds only the rim, the shadow vault and the manifest entry.
"""

import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_lightwell as well

SOURCE = ROOT / "artwork/coastal-home/coastal-home.blend"
MANIFEST = ROOT / "assets/models/home/manifest.json"
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
ceiling = bpy.data.objects["core_liftaway_cave_ceiling"]
limestone = bpy.data.materials["chalk limestone"]
stone = bpy.data.materials["warm cut stone"]
for name in ("core_lightwell_rim", "onsen_shadow_vault"):
    if name in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)

report = {}
if not ceiling.get("lightWell"):
    # The vault's underside above the aperture, then the clifftop where the tilted axis leaves the rock.
    inside = well.surface_point(ceiling, (well.APERTURE_XY.x, well.APERTURE_XY.y, 3.2), (0, 0, 1))
    entry = inside + well.AXIS * 0.01
    exit_point = well.surface_point(ceiling, entry, well.AXIS)
    cutter = well.well_cutter(inside.z, exit_point.z, limestone)
    open_edges = well.drill(ceiling, cutter)
    bpy.data.objects.remove(cutter, do_unlink=True)
    assert open_edges == 0, f"the drilled roof has {open_edges} open edges"
    ceiling["lightWell"] = True
    ceiling["lightWellAperture"] = list(inside)
    ceiling["lightWellTop"] = list(exit_point)
    report["drilled"] = True
aperture = Vector(ceiling["lightWellAperture"])
top = Vector(ceiling["lightWellTop"])
report["plantingVerticesRemoved"] = well.clear_planting(top, well.RADIUS + 0.55)
ground = lambda x, y: well.surface_point(ceiling, (x, y, 20), (0, 0, -1)).z
rim = well.rim_stones(stone, top, ground)
vault = well.shadow_vault(ceiling, limestone)
report.update({"aperture": [round(c, 3) for c in aperture], "top": [round(c, 3) for c in top],
               "shaftLengthMeters": round((top - aperture).length, 3), "rimVertices": len(rim.data.vertices),
               "shadowVaultFaces": len(vault.data.polygons)})

# The browser reads the shaft from the manifest (three.js axes: x, up, -y).
three = lambda v: [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]
config = json.loads(MANIFEST.read_text(encoding="utf-8"))
config["lightWell"] = {
    "room": "onsen",
    "aperture": three(aperture),
    "apertureRadius": well.RADIUS,
    "flareRadius": well.FLARE,
    "top": three(top),
    "topRadius": well.RADIUS,
    "axis": three(well.AXIS),
    "floor": 2.6,
}
MANIFEST.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
(ROOT / "artwork/coastal-home/reviews/light-well.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2), flush=True)
