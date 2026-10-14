"""Add detail and decoration to the retained house (Sirui, 2026-10-14); see coastal_decor.py.

Run with Blender 4.5 LTS from the repository root:
  blender -b --python-exit-code 1 --python bin/refresh_coastal_decor.py
then bake and export each touched room (bake_coastal_light.py and optimize_coastal_exports.py
with --room=onsen, sleep, study and lounge). Re-running replaces the previous decoration.
"""

import json
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_decor as decor

SOURCE = ROOT / "artwork/coastal-home/coastal-home.blend"
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
for obj in [o for o in bpy.data.objects if o.get("decor")]:
    bpy.data.objects.remove(obj, do_unlink=True)
slabs = decor.remove_rim_slabs(bpy.data.objects["onsen__warm cut stone"])

mats = bpy.data.materials
stone, oak, brass, jute, terracotta = (mats[n] for n in ("warm cut stone", "pale oak", "brushed brass", "woven jute", "terracotta"))
cedar = decor.material("cedar wood", (0.55, 0.33, 0.2), 0.62)
bamboo = decor.material("dry bamboo", (0.42, 0.45, 0.2), 0.42, refresh=True)
cork = decor.material("cork board", (0.6, 0.45, 0.3), 0.85)
paper = decor.material("sketch paper", (0.88, 0.86, 0.8), 0.9)
paints = {
    "sky": decor.material("linen canvas sky", (0.86, 0.78, 0.64), 0.92),
    "sea": decor.material("linen canvas sea", (0.16, 0.36, 0.4), 0.9),
    "sand": decor.material("linen canvas sand", (0.76, 0.58, 0.38), 0.92),
    "sun": decor.material("linen canvas sun", (0.9, 0.5, 0.22), 0.9),
}
glazes = (
    decor.material("celadon glaze", (0.55, 0.66, 0.58), 0.25),
    decor.material("tenmoku glaze", (0.2, 0.12, 0.08), 0.2),
    decor.material("oatmeal glaze", (0.8, 0.74, 0.62), 0.45),
)

pieces = {
    "onsen": [decor.river_stones(stone), decor.slat_panel(cedar, 2.35, 4.45, 2.6, 3.75), *decor.bucket_and_stool(cedar, brass), decor.bamboo_spout(bamboo)],
    "sleep": decor.framed_seascape("sleep_seascape", (-3.55, 3.55), (1.05, 0.7), oak, paints),
    "study": decor.pinboard("study_pinboard", (-0.6, 3.8), (0.95, 0.62), cork, oak, paper, terracotta),
    "lounge": [*decor.rope_sun("lounge_rope_sun", (0.45, 1.3), 0.42, jute, terracotta), *decor.pottery_shelf("lounge_pottery", (-0.55, 0.88), oak, glazes)],
}
report = {"rimSlabVerticesRemovedThisRun": slabs, "rooms": {}}
for room, objects in pieces.items():
    by_material = {}
    for obj in objects:
        by_material.setdefault(obj.data.materials[0].name, []).append(obj)
    names = []
    for material_name, group in by_material.items():
        joined = decor.join(group, f"{room}_decor {material_name}")
        joined["decor"] = True
        names.append({"mesh": joined.name, "vertices": len(joined.data.vertices), "faces": len(joined.data.polygons)})
    report["rooms"][room] = names

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
(ROOT / "artwork/coastal-home/reviews/decor.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2), flush=True)
