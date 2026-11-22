"""Fit the public passages in the retained coastal master (native metres, Z up).

Run in Blender 4.5 with the master open and -- --save-as=PATH --manifest-out=PATH.
The existing sole arrival flight, bath, rain rill and the listening room are the
datums. The model, walking field and drawings all use the same built surfaces.
"""

import argparse
import json
import math
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import coastal_arrival_hall as hall
from coastal_listening_bar import Joinery
from coastal_supper_gallery import build_supper_gallery, study_window
from coastal_sunken_tea import fit_sunken_tea
from coastal_tea_landings import refit_tea_landings
from coastal_pool_inlay import inlay
from refine_coastal_passage_finishes import refine_passage_finishes
from refine_coastal_cliff_passage import build as fit_cliff_lift
from fit_coastal_passage_contacts import fit_passage_contacts
from fit_coastal_tea_planting_stone import fit as fit_tea_planting_stone
from raise_coastal_entry_canopy import fit_entry_headroom

ROOT = Path(__file__).resolve().parents[1]


def timber_returns(scene, config):
    """Retire A, B and C while keeping the oak landing serving the pocket door."""

    def old_flight(lo, hi):
        x0, z0, h0 = lo.x, -hi.y, lo.z
        x1, z1, h1 = hi.x, -lo.y, hi.z
        east = (
            x0 >= 1.989 and x1 <= 3.303 and z0 >= 17.575 and z1 <= 21.56 and h1 <= 2.50
        )
        cross = (
            x0 >= -3.405 and x1 <= 2.016 and z0 >= 16.378 and z1 <= 17.63 and h0 > 2.26
        )
        west = (
            x0 >= -3.405 and x1 <= -2.176 and z0 >= 17.578 and z1 <= 21.841 and h0 > 4.9
        )
        return east or cross or west

    removed = {}
    for mat in ("warm cut stone", "pale oak"):
        obj = scene.objects["core_arrival_hall__" + mat]
        removed[mat] = hall._remove_islands(obj, old_flight)
    if removed != {"warm cut stone": 5, "pale oak": 40}:
        raise ValueError(f"Unexpected old stair on this source: {removed}")
    for mat in ("honey ash", "brushed brass", "estate warm opal diffuser"):
        # The old hall builder reserves these three batches for the defunct
        # well guards, stair wall rail/brackets, and tread lights respectively.
        obj = scene.objects["core_arrival_hall__" + mat]
        bpy.data.objects.remove(obj, do_unlink=True)

    j = Joinery("core_onsen_passage_", "arrival")
    oak, bronze = "pale oak", "dark bronze"
    # The side of the old stairwell is now the back of the shallow display recess.
    # Side returns meet the new gallery liner and the retained sandstone jamb.
    j.block(
        "backing",
        "bar umber lime plaster",
        (1.915, -18.71, 2.409),
        (1.955, -16.363, 4.79),
        0.007,
    )
    j.block("end", oak, (1.95, -16.397, 2.41), (2.038, -16.36, 4.78), 0.006)
    j.block("head", oak, (1.95, -18.70, 4.665), (2.04, -16.39, 4.77), 0.004)
    j.block("ledge", oak, (1.95, -17.58, 3.18), (2.036, -16.56, 3.211), 0.009)
    # Long quiet boards and three narrow shadow gaps along the west of the passage.
    for i in range(11):
        y = -18.671 + i * 0.208
        j.block("boards", oak, (1.955, y, 2.597), (1.985, y + 0.202, 4.65), 0.003)
    j.block("light_lip", bronze, (1.978, -18.62, 4.602), (2.015, -16.418, 4.626), 0.004)
    j.block(
        "paper",
        "estate warm opal diffuser",
        (1.989, -18.60, 4.626),
        (2.008, -16.435, 4.637),
        0.001,
    )
    j.block("base", oak, (1.968, -18.70, 2.48), (2.018, -16.394, 2.651), 0.004)
    # Bridge the 21 mm old/new landing seam at the same walking elevation.
    j.block("sill", oak, (2.028, -17.633, 2.566), (3.278, -17.597, 2.597), 0.002)
    for name, obj in j.finish():
        if name == "paper":
            obj["installationGlow"] = "outdoor-portal"
    config["installationLines"].append(
        {
            "id": "onsen-side-oak-cove",
            "schedule": "steps",
            "a": [2.009, 4.633, 16.46],
            "b": [2.009, 4.633, 18.56],
            "intensity": 0.72,
            "color": [1, 0.79, 0.57],
            "emitterRadius": 0.038,
            "transport": False,
            "region": {"min": [1.89, 2.52, 16.3], "max": [3.33, 4.74, 18.84]},
        }
    )
    return removed


def glass_canopy(scene, config):
    """Replace the exposed upper soffit. Rock continues to cover the lower stair."""
    # The upper 4.3 metres are already clear of bedrock in the native terrain
    # survey. Terminate the deep liner where its roof first meets the cliff.
    liner = scene.objects["core_arrival_B_continuous_soffit"]
    rock = liner.data.materials[0]
    hall._cut(
        scene,
        "Daylit upper approach",
        -1.83,
        1.56,
        27.62,
        32.35,
        7.90,
        11.6,
        rock,
        [liner],
    )
    old = scene.objects["core_garden_threshold_oak_portal"]
    # Retain the rooted, flanking cheek timbers. The solid slats and header
    # spanning the drive no longer enclose the upper approach.
    hall._remove_islands(old, lambda lo, hi: hi.x - lo.x > 1.7 and lo.z > 8.49)
    j = Joinery("core_entry_leaf_", "arrival")
    bronze, glass = "dark bronze", "facade low-iron glass"
    rx, ry = 1.69, 0.92

    def leaf(t, s, cy, i):
        # Offset ellipse projected over a pitched, slightly cambered blade.
        return (
            -0.115 + rx * s * math.cos(t),
            cy + ry * s * math.sin(t),
            10.55 + (cy + 31.6) * -0.37 + 0.17 * s * math.cos(t) + 0.095 * (1 - s * s),
        )

    # Four canopies overlap by 28 cm along the run. A shared high sill lets
    # the sky show between their rims from stair height.
    for i, cy in enumerate((-31.8, -30.50, -29.20, -27.90)):
        bm = j.mesh("laminated_glass", glass)
        n = 34
        rim = [leaf(2 * math.pi * k / n, 1, cy, i) for k in range(n)]
        inner = [bm.verts.new(leaf(2 * math.pi * k / n, 0.54, cy, i)) for k in range(n)]
        centre = bm.verts.new(leaf(0, 0, cy, i))
        outer = [bm.verts.new(q) for q in rim]
        for k in range(n):
            n2 = (k + 1) % n
            bm.faces.new((centre, inner[k], inner[n2]))
            bm.faces.new((inner[k], outer[k], outer[n2], inner[n2]))
            j.span("rims", bronze, rim[k], rim[n2], 0.015, 7)
        y = cy + 0.06
        z = leaf(math.pi, 1, cy, i)[2]
        j.span(
            "cantilevers",
            bronze,
            (-1.675, y, z - 0.32),
            (-1.50, y, z - 0.019),
            0.035,
            8,
        )
        j.span(
            "cantilevers", bronze, (1.415, y, z - 0.12), (1.405, y, z + 0.218), 0.023, 8
        )
    # A folded collector slopes to its outlet; the downpipe empties directly
    # into the descending existing rill beside the treads.
    y0, y1 = -31.99, -27.57
    invert = lambda y: 9.37 - 0.27 * (y + 31.8)
    bm = j.mesh("collector", bronze)
    ends = []
    for y in (y0, y1):
        z = invert(y)
        ends.append(
            [
                bm.verts.new((x, y, z + h))
                for x, h in [
                    (-1.87, 0.061),
                    (-1.87, -0.010),
                    (-1.73, -0.010),
                    (-1.73, 0.061),
                    (-1.742, 0.061),
                    (-1.742, 0.003),
                    (-1.858, 0.003),
                    (-1.858, 0.061),
                ]
            ]
        )
    for k in range(8):
        bm.faces.new(
            (ends[0][k], ends[1][k], ends[1][(k + 1) % 8], ends[0][(k + 1) % 8])
        )
    bm.faces.new(ends[0])
    bm.faces.new(tuple(reversed(ends[1])))
    j.span(
        "outlet",
        bronze,
        (-1.80, y1 - 0.02, invert(y1)),
        (-1.80, y1 - 0.02, 6.54),
        0.043,
        10,
    )
    j.span(
        "outlet", bronze, (-1.80, y1 - 0.02, 6.54), (-1.38, y1 - 0.02, 6.44), 0.043, 10
    )
    for i, cy in enumerate((-31.8, -30.50, -29.20, -27.90)):
        # Overlapping brass cups form the wet chain, visible in silhouette.
        x, y, z = leaf(math.pi, 1, cy, i)
        j.span(
            "rain_chains",
            bronze,
            (x, y, z - 0.012),
            (x, y, invert(y) + 0.026),
            0.008,
            6,
        )
        for k in range(max(0, int((z - invert(y) - 0.08) / 0.16))):
            h = z - 0.09 - k * 0.16
            j.turned(
                "rain_cups",
                "brushed brass",
                (x, y, h),
                [(0.012, 0), (0.028, 0.04), (0.025, 0.04), (0.010, 0.006)],
                10,
            )
    j.finish()


def apply(scene, config):
    if scene.get("passageRenovation") == 1:
        raise ValueError("These passages are already fitted on this source")
    counts = timber_returns(scene, config)
    glass_canopy(scene, config)
    build_supper_gallery(scene, config)
    study_window(scene)
    inlay(scene)
    fit_cliff_lift(scene)
    refine_passage_finishes(scene, config)
    fit_sunken_tea(scene, config)
    fit_passage_contacts(scene)
    fit_entry_headroom(scene)
    refit_tea_landings(scene, config)
    bpy.context.view_layer.update()
    fit_tea_planting_stone(scene)
    scene["passageRenovation"] = 1
    bpy.context.view_layer.update()
    return counts


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--save-as", type=Path, required=True)
    parser.add_argument(
        "--manifest", type=Path, default=ROOT / "assets/models/home/manifest.json"
    )
    parser.add_argument("--manifest-out", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    config = json.loads(args.manifest.read_text(encoding="utf-8"))
    counts = apply(bpy.context.scene, config)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(args.save_as.resolve()), compress=True)
    args.manifest_out.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print("Retired flights", counts, flush=True)


if __name__ == "__main__":
    main()
