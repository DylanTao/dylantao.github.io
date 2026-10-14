"""Refit the retained sleep room's bedding to the five sleeping avatars (Sirui, 2026-10-14).

The old pillow was a rigid bevelled box that every head sank 9 cm into, and the old cover was a
height field whose top hem dived to the mattress through the sleepers' chests. This builds six
bed variants, each a pillow plus a duvet tagged with a `bedding` property: "empty" (a made bed)
and one per avatar, whose pillow is dented under that avatar's head and whose duvet is draped
over that avatar's sleeping body by the position-based solver in coastal_bedding.py. The
runtime shows the variant that matches who is, or is not, asleep.

Run with Blender 4.5 LTS from the repository root:
  blender -b --python-exit-code 1 --python bin/refresh_coastal_bedding.py
then bin/bake_coastal_light.py -- --room=sleep, bin/optimize_coastal_exports.py -- --room=sleep
and bin/review_coastal_models.py.
"""

import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_bedding import AVATARS, MATTRESS, OLD_PILLOW, draped_duvet, pillow, remove_component, sleepers

SOURCE = ROOT / "artwork/coastal-home"
bodies = sleepers(SOURCE)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE / "coastal-home.blend"))
linen = bpy.data.materials["linen"]
sage = bpy.data.materials["sage textile"]

# The original box pillow sits inside the material-batched linen; earlier refits removed it.
removed = remove_component(bpy.data.objects["sleep__linen"], OLD_PILLOW["min"], OLD_PILLOW["max"])
for name in [o.name for o in bpy.data.objects if o.name.startswith(("sleep_pillow", "sleep_duvet"))]:
    bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)

mattress_top = MATTRESS["center"][2] + MATTRESS["size"][2] / 2
summary = {
    "method": "Per-avatar sleep clips at frames 25 and 73 (deepest and shallowest breath); pillow dented by vertical "
    "ray casts with an 8 cm tension funnel; duvet settled by coloured Gauss-Seidel position-based dynamics over "
    "the upper envelope of sleeper, pillow, mattress, frame and bedside table, trimmed 7 cm below the chin",
    "oldPillowVerticesRemoved": removed,
    "variants": {},
}
for variant in ("empty",) + AVATARS:
    own = [b for b in bodies if b["avatar"] == variant]
    pillow_obj, deepest = pillow(f"sleep_pillow_{variant}", linen, own)
    cover, drape = draped_duvet(f"sleep_duvet_{variant}", sage, own, pillow_obj)
    for obj in (pillow_obj, cover):
        obj["bedding"] = variant
    entry = {"pillowDeepestPressMeters": round(deepest, 4), "pillowVertices": len(pillow_obj.data.vertices),
             "duvetVertices": len(cover.data.vertices), "duvet": drape}
    if own:
        # What still shows through: sleeper points under the cover's footprint above its underside,
        # and sleeper points inside the pillow, at both breaths.
        graph = bpy.context.evaluated_depsgraph_get()
        cover_tree = BVHTree.FromObject(cover, graph)
        pillow_tree = BVHTree.FromObject(pillow_obj, graph)
        corners = [cover.matrix_world @ Vector(c) for c in cover.bound_box]
        low = Vector([min(p[k] for p in corners) for k in range(3)])
        high = Vector([max(p[k] for p in corners) for k in range(3)])
        pc = [pillow_obj.matrix_world @ Vector(c) for c in pillow_obj.bound_box]
        p_low = Vector([min(p[k] for p in pc) for k in range(3)])
        p_high = Vector([max(p[k] for p in pc) for k in range(3)])
        checked = above = inside = 0
        worst_above = worst_inside = 0.0
        for body in own:
            for point in body["points"]:
                if low.x + 0.05 <= point.x <= high.x - 0.05 and low.y + 0.05 <= point.y <= drape["hemY"] - 0.04:
                    checked += 1
                    hit = cover_tree.ray_cast(point + Vector((0, 0, 2)), Vector((0, 0, -1)))
                    # The first surface met from above is the cover's top; its underside is 30 mm lower.
                    if hit[0] is not None and point.z > hit[0].z - 0.03:
                        above += 1
                        worst_above = max(worst_above, point.z - (hit[0].z - 0.03))
                if p_low.x <= point.x <= p_high.x and p_low.y <= point.y <= p_high.y and point.z < p_high.z:
                    hit = pillow_tree.ray_cast(Vector((point.x, point.y, p_high.z + 1)), Vector((0, 0, -1)))
                    if hit[0] is not None and mattress_top < point.z < hit[0].z - 0.001:
                        inside += 1
                        worst_inside = max(worst_inside, hit[0].z - point.z)
        entry.update({"coverChecked": checked, "aboveCoverUnderside": above, "worstAboveCoverUndersideMeters": round(worst_above, 4),
                      "insidePillow": inside, "worstInsidePillowMeters": round(worst_inside, 4)})
    summary["variants"][variant] = entry
    print(variant, json.dumps(entry), flush=True)

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "coastal-home.blend"), compress=True)
(SOURCE / "reviews/bedding.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2), flush=True)
