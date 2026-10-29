"""Clear the retained study-to-patio route and the actual pavilion kitchen entrance.

Run with Blender 4.5.9. The default writes a review candidate; --apply explicitly
admits the migration after its native and browser round trips have passed.
"""
import hashlib
import json
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_architecture_finish import edit_islands, inside, tool_difference
from coastal_office import Parts, box, cylinder
import coastal_shell as shell

ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1]
        for a in sys.argv if a.startswith("--") and "=" in a}
SOURCE = Path(ARGS.get("source", str(ROOT / "artwork/coastal-home/coastal-home.blend")))
MANIFEST = Path(ARGS.get("manifest", str(ROOT / "assets/models/home/manifest.json")))
OUT = Path(ARGS.get("out", str(ROOT / ".jekyll-cache/visual-qa/house-final-2026-10-28/walk-flow")))


def migrate(scene, config):
    if scene.get("walkFlowRevision", 0):
        raise RuntimeError("Refusing to apply the retained walk migration twice")
    orphan = scene.objects["core_facade__weathered_teak_wood"]
    removed = edit_islands(orphan, lambda lo, hi: inside(
        lo, hi, (-3.23, -2.67, .43), (-2.73, -2.23, .85), .001))
    if len(removed) != 2 or any(row["vertices"] != 56 for row in removed):
        raise RuntimeError(f"Orphan bistro-seat inventory changed: {removed}")

    panels, pulls = [], []
    objects = [o for o in scene.objects if o.type == "MESH" and
               o.name.startswith("core_estate_pavilion__")]
    for obj in objects:
        retired = edit_islands(obj, lambda lo, hi: inside(
            lo, hi, (4.27, -.695, .07), (5.405, -.66, .85), .002))
        if retired:
            panels.append({"mesh": obj.name, "islands": retired})
        retired = edit_islands(obj, lambda lo, hi: inside(
            lo, hi, (4.42, -.665, .65), (5.255, -.635, .69), .002))
        if retired:
            pulls.append({"mesh": obj.name, "islands": retired})
    if sum(len(row["islands"]) for row in panels) != 2:
        raise RuntimeError(f"Expected exactly two complete cabinet fronts: {panels}")
    if sum(len(row["islands"]) for row in pulls) != 2:
        raise RuntimeError(f"Expected exactly two complete cabinet pulls: {pulls}")

    # Use the retained finishes, without resetting a later palette through a
    # historical builder's material factory.
    materials = {"stone": bpy.data.materials["warm cut stone"],
                 "oak": bpy.data.materials["pale oak"],
                 "bronze": bpy.data.materials["brushed brass"]}
    tool = shell._box_object("temporary cook-counter entrance trim",
                             (4.05, -1.50, -.10), (5.25, -.50, 1.10), materials["stone"])
    cuts = []
    for obj in objects:
        # The tool clears only the rear cabinet's end; the grill, hollow sink,
        # wet bar, roof, columns, table and every complete dining chair stay put.
        if obj.name.endswith(("__honey ash", "__travertine paving stone")):
            cuts.append({"mesh": obj.name, "cut": tool_difference(obj, tool)})
    bpy.data.objects.remove(tool, do_unlink=True)
    if len(cuts) != 2:
        raise RuntimeError(f"Retained counter material inventory changed: {cuts}")

    fronts = Parts("core_walkflow_pavilion_cabinet")
    box(fronts.bm(materials["oak"]), (5.65, -.677, .46), (.75, .025, .77), .015, segments=2)
    cylinder(fronts.bm(materials["bronze"]), (5.54, -.65, .67), (5.76, -.65, .67), .009, 8)
    made = fronts.finish()
    for obj in made:
        obj["estateOutdoors"] = True
        obj["installationGroup"] = "exterior"

    old_route = config["retreat"]["patioRoute"]
    route = old_route[:4] + [[4.6, 0, 1.8], [4.6, 0, -.1], [6.8, 0, -.1], [5.05, 0, -.35]]
    config["retreat"]["patioRoute"] = route
    config["retreat"]["patioCirculation"] = {
        "revision": 1, "counterEndX": 5.25, "entryRawWidth": 1.29,
        "routePurpose": "Living and study to the usable cook aisle and dining-table side, with the same return route",
    }
    scene["walkFlowRevision"] = 1
    return {"retiredOrphanChair": removed, "retiredCabinetFronts": panels,
            "retiredCabinetPulls": pulls, "counterCuts": cuts,
            "replacementFronts": [o.name for o in made], "routeBefore": old_route,
            "routeAfter": route, "entryRawWidthM": 1.29}


def main():
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("Use exact Blender 4.5.9")
    OUT.mkdir(parents=True, exist_ok=True)
    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    config = json.loads(MANIFEST.read_text(encoding="utf-8"))
    result = migrate(bpy.context.scene, config)
    source_out = ROOT / "artwork/coastal-home/coastal-home.blend" if "--apply" in sys.argv else OUT / "candidate.blend"
    manifest_out = ROOT / "assets/models/home/manifest.json" if "--apply" in sys.argv else OUT / "manifest.json"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source_out), compress=True)
    manifest_out.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8", newline="\n")
    result.update({"sourceBeforeSha256": source_hash,
                   "sourceAfterSha256": hashlib.sha256(source_out.read_bytes()).hexdigest(),
                   "sourceOut": str(source_out)})
    (OUT / "receipt.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
