"""Apply the overlap audit's bounded native repairs to the canonical coastal home source.

    blender --background -t 8 --python-exit-code 1 --python bin/refresh_coastal_overlap_repairs.py -- \
        [--source=artwork/coastal-home/coastal-home.blend] [--output=.jekyll-cache/overlap-repair/coastal-home.blend] \
        [--report=artwork/coastal-home/reviews/house-2026-10-24/overlap-repairs.json]

Writes a candidate source (default under .jekyll-cache) and a JSON report of every edited
island. A source already carrying ``overlapRepairVersion`` is a checked no-op. Review the
candidate with ``bin/audit_coastal_overlaps.py -- --source=<candidate>`` before copying it over
the canonical source; then bake and export as usual.
"""
import hashlib
import json
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_overlap_repairs as repairs

ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}


def _path(key, default):
    p = Path(ARGS.get(key, default))
    return p if p.is_absolute() else ROOT / p


source = _path("source", "artwork/coastal-home/coastal-home.blend")
output = _path("output", ".jekyll-cache/overlap-repair/coastal-home.blend")
report_path = _path("report", ".jekyll-cache/overlap-repair/overlap-repairs.json")
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
if scene.get("overlapRepairVersion") == repairs.VERSION:
    print(json.dumps({"retained": True, "version": repairs.VERSION, "source": str(source)}), flush=True)
    sys.exit(0)
report = {"version": repairs.VERSION, "source": source.relative_to(ROOT).as_posix() if source.is_relative_to(ROOT) else str(source),
          "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest()}
# 1. Stone bases flush with their oak boards and tread caps.
report["flushCaps"] = repairs.lower_flush_caps(scene)
# 1b. The terrace's travertine tiles stood only 1 mm proud of their stone bed; Draco quantizes each
#     mesh separately, so in delivery the two tops met and fought across the whole terrace. The bed
#     now stops under the tiles' own bottoms. Found by the --delivered=1 audit.
report["terraceTiles"] = repairs.lower_flush_caps(
    scene, tolerance=0.0015, pairs=[("core_estate_terrace__warm cut stone", "core_estate_terrace__travertine paving stone")])
# 1c. The arched lunette frame was swept exactly along the rock arch it sits in; both double-sided
#     faces met along the arch and flipped their depth tie when draws regrouped. Its outer edge
#     now keeps a 5 mm shadow reveal below the rock.
report["lunetteReveal"] = repairs.inset_arch_extrados(scene, "core_facade_lunette_frame")
# 2. The west landward olive stood inside the streamed glass wine fridge (kitchen anchor
#    -4.37, -11.64); the counter run beyond it ends at the guest bath's doorway (y -13.75..-12.55),
#    so the whole plant moves to the arrival foyer's north-west corner, at the foot of the
#    curved stair, clear of the walls and of the foyer route corner at (-5.8, -15.2).
report["fridgeOlive"] = repairs.relocate_plant(
    scene, ("core__terracotta", "core__charcoal", "core__olive leaf", "core__honey ash"),
    (-4.9, -12.4, -0.05), (-3.6, -10.6, 1.2), (-6.30, -14.68))
#    The two house olives' leaves were untagged and so walled off a 0.8 m bush in Walk; like the
#    rest of the planting ("soft leaves do not block a body"), they are soft foliage, while the
#    terracotta pots and woody stems stay solid.
bpy.data.objects["core__olive leaf"]["flora"] = True
report["oliveLeavesSoft"] = {"mesh": "core__olive leaf", "flora": True}
# 2b. On the ground floor the guest bath's parked pocket-door leaf (and its edge pull) stood on
#     the kitchen face of the bathroom wall, inside the streamed fridge and the oak pantry. It
#     slides 12 cm into its own 16 cm wall pocket; the en suite's leaf upstairs is unobstructed.
report["guestBathPocketLeaf"] = repairs.move_islands(
    scene, ("bath-living__pale oak", "bath-living__brushed brass"),
    (-4.70, -12.60, -0.05), (-4.58, -11.40, 2.30), (-0.12, 0.0, 0.0))
#     Beside it, the tall oak pantry ran 7 cm into that 1.2 m doorway and over its oak jamb; it
#     narrows from 60 to 48 cm toward the fridge, its two fronts, plinth and handles with it.
report["pantryDoorway"] = repairs.scale_islands_y(
    scene, ("kitchen__pale oak", "kitchen__honey ash", "kitchen__polished nickel"),
    (-4.76, -12.65, -0.02), (-3.96, -11.99, 2.40), -12.02, 0.8)
# 3. The arrival foyer slab ran on under the guest bathroom's tiles at the same height.
report["foyerSlab"] = repairs.trim_slab(scene, "core_retreat_arrival__warm cut stone", (-8.70, -14.40, -0.40), (-4.74, -9.55, 0.06))
# 4. Smaller flush faces, each moved by a few millimetres so one surface is clearly in front:
#    the counter hob's 1 mm black plate lay on the marble at the same height, inside a stainless
#    frame 1 mm higher; the hob now stands proud with its black top over its frame.
report["kitchenHob"] = [
    repairs.move_islands(scene, ("kitchen__satin appliance stainless",), (-4.62, -6.40, 0.90), (-4.18, -5.90, 0.92), (0, 0, 0.003)),
    repairs.move_islands(scene, ("kitchen__charcoal",), (-4.60, -6.38, 0.91), (-4.20, -5.92, 0.92), (0, 0, 0.007)),
]
#    One facade paving tile and the plinth on it were flush with the terrace slab around them.
report["facadeTile"] = repairs.move_islands(scene, ("core_facade__travertine_paving_stone",), (-4.30, -2.30, -0.05), (-3.55, -1.55, 0.35), (0, 0, 0.005))
#    The two submerged chaises' bases were flush with the shelf's mosaic floor.
report["poolChaises"] = repairs.move_islands(scene, ("core_estate_pool__ivory pool chaise ceramic",), (-7.10, -1.10, -0.32), (-4.80, 1.05, 0.45), (0, 0, 0.003))
#    The terrace slab's seaward face shared the pool wall's plane below the waterline.
report["terraceFace"] = repairs.shift_vertices(scene, "core_estate_terrace__warm cut stone", (-8.6, -3.5, -0.3), (8.1, -1.0, 0.05),
                                               lambda p, a, b: p[1] > b[1] - 0.02, (0, -0.005, 0))
# 5. The gym passage floor ran 25 cm into the gym's own floor at the same height; it now stops
#    at the gym floor's edge (x = 6.0). The threshold stone above both is unchanged.
report["gymPassageFloor"] = repairs.shift_vertices(scene, "core_gym_passage_floor", (4.5, -7.1, -0.3), (6.3, -5.8, 0.0),
                                                   lambda p, a, b: p[0] > 6.1, (-0.25, 0, 0))
# 6. The private onsen threshold slab and the bridge's upper slab shared the upper slab's
#    underside plane (z 2.36), a flickering ceiling seen from below; their soffits rise 2 cm.
report["privateThresholdSoffit"] = repairs.shift_vertices(scene, "core_retreat_private_arrival__warm cut stone", (3.25, -16.25, 2.3), (5.65, -14.65, 2.65),
                                                          lambda p, a, b: p[2] < (a[2] + b[2]) / 2, (0, 0, 0.02))
report["gallerySoffit"] = repairs.shift_vertices(scene, "core_retreat_gallery__warm cut stone", (-9.8, -10.4, 2.3), (-0.8, -8.2, 2.65),
                                                 lambda p, a, b: p[2] < (a[2] + b[2]) / 2, (0, 0, 0.02))
#    The laptop's 1 mm keyboard inset lay 1 mm above the deck it sits in; it now stands 3 mm proud.
report["laptopDeck"] = repairs.move_islands(scene, ("study__matte black device",), (-11.55, -4.23, 0.885), (-11.19, -3.92, 0.895), (0, 0, 0.002))
#    The private garden's stone pad was flush with the private spiral's oak top landing.
report["privateGardenPad"] = repairs.shift_vertices(scene, "core_retreat_private_arrival__warm cut stone", (6.95, -14.55, 7.3), (8.0, -13.4, 7.7),
                                                    lambda p, a, b: p[2] > (a[2] + b[2]) / 2, (0, 0, -0.006))
# 6b. The ground-level corridor floor (boards and stone bed) ran 1.15 m into the library over the
#     library's own floor at the same height; it now ends at the library wall's inner face.
report["corridorBoards"] = repairs.trim_islands_x(scene, "core_retreat_gallery__pale oak", (-9.8, -9.8, -0.05), (-3.7, -8.2, 0.01), -8.55)
report["corridorBed"] = repairs.trim_slab(scene, "core_retreat_gallery__warm cut stone", (-10.0, -9.9, -0.40), (-8.55, -8.15, 0.01))
# 7. The clifftop garden's travertine path is one ribbon draped on the coarse roof terrain, and
#    the mulch bed runs under it: terrain and mulch broke through its top in patches. The ribbon's
#    top now clears the highest ground or mulch within 18 cm by 12 mm. The mulch bed itself is
#    kept whole: deleting its faces under the path left bare terrain beside the path.
report["gardenPath"] = repairs.conform_path(
    scene, "core_estate_garden__travertine paving stone",
    ("core_retreat_liftaway_roof", "core__golden coastal sandstone", "core_estate_garden__garden mineral mulch",
     "core_liftaway_cave_ceiling_rear", "core_liftaway_cave_ceiling", "core_estate_library_liftaway_roof"),
    radius=0.3, max_lift=0.20)
scene["overlapRepairVersion"] = repairs.VERSION
output.parent.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
report["output"] = output.relative_to(ROOT).as_posix() if output.is_relative_to(ROOT) else str(output)
report["outputSha256"] = hashlib.sha256(output.read_bytes()).hexdigest()
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({k: v for k, v in report.items() if k in ("output", "outputSha256")}), flush=True)
