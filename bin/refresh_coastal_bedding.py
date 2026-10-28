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
import hashlib
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_bedding
from coastal_bedding import AVATARS, MATTRESS, OLD_PILLOW, draped_duvet, pillow, remove_component, sleepers

SOURCE = ROOT / "artwork/coastal-home"
ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
def option_path(name, default):
    path = Path(ARGS.get(name, default))
    return path if path.is_absolute() else ROOT / path

house_source = option_path("source", "artwork/coastal-home/coastal-home.blend")
house_output = option_path("source-out", str(house_source))
manifest = option_path("manifest", "assets/models/home/manifest.json")
report = option_path("report", "artwork/coastal-home/reviews/bedding.json")
config = json.loads(manifest.read_text(encoding="utf-8"))
room = next(room for room in config["rooms"] if room["id"] == "sleep")
destination = Vector((room["actor"][0], -room["actor"][2], room["actor"][1]))
translation = destination - coastal_bedding.SLEEP_ACTOR
if config.get("estateLibrary", {}).get("adjacentBedchamber"):
    # Solve in the original neutral body frame, against the real table's new
    # east-side position, then translate the complete solved cloth assembly.
    coastal_bedding.BEDSIDE["center"] = (-2.07, -2.47)
avatar_source = option_path("avatar-source", str(SOURCE))
bodies = sleepers(avatar_source)
envelope_digest = hashlib.sha256()
import numpy as np
for body in bodies:
    envelope_digest.update(f"{body['avatar']}:{body['frame']}\n".encode("ascii"))
    envelope_digest.update(np.asarray([tuple(point) for point in body["points"]], dtype="<f4").tobytes())
    envelope_digest.update(np.asarray(body["triangles"], dtype="<i4").tobytes())
    envelope_digest.update(np.asarray(body["head"], dtype=np.uint8).tobytes())
bpy.ops.wm.open_mainfile(filepath=str(house_source))
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
    "neutralFrameTranslationNativeM": list(translation),
    "bedsideSupportNeutralFrame": coastal_bedding.BEDSIDE,
    "coverMetricScope": "Legacy top-minus30mm vertical estimate for the filled cover; tilted/folded cloth requires actual triangle and rendered skin review. This is not a signed material-penetration metric.",
    "bodyEnvelopeSha256": envelope_digest.hexdigest(),
    "avatarSource": {"kind": "five-scene finish library" if avatar_source.is_file() else "original five native sources",
        "sha256": hashlib.sha256(avatar_source.read_bytes()).hexdigest() if avatar_source.is_file() else {
            avatar: hashlib.sha256((avatar_source / f"sirui-{avatar}.blend").read_bytes()).hexdigest() for avatar in AVATARS}},
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
    for obj in (pillow_obj, cover):
        obj.location += translation
    print(variant, json.dumps(entry), flush=True)

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(house_output), compress=True)
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8", newline="\n")
print(json.dumps(summary, indent=2), flush=True)
