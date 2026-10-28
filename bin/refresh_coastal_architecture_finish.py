"""Apply the bounded architectural migration to a retained candidate, never implicitly main."""
import hashlib
import json
import os
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_architecture_finish as finish

ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
APPLY = "--apply" in sys.argv
SOURCE = Path(ARGS.get("source", str(ROOT / "artwork/coastal-home/coastal-home.blend")))
MANIFEST = Path(ARGS.get("manifest", str(ROOT / "assets/models/home/manifest.json")))
DIRECTORY = Path(ARGS.get("out", str(ROOT / ".jekyll-cache/visual-qa/finish-house-2026-10-26/attempts/v1")))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("Use exact Blender 4.5.9")
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene = bpy.context.scene
    config = json.loads(MANIFEST.read_text(encoding="utf-8"))
    DIRECTORY.mkdir(parents=True, exist_ok=True)
    os.environ["COASTAL_ARCHITECTURE_ATTEMPT"]=str(DIRECTORY.resolve())
    before = digest(SOURCE)
    complete = set(str(scene.get("architectureFinishSteps", "")).split(",")) - {""}
    requested = ARGS.get("steps", "shelves,patio,sofa").split(",")
    steps = {"shelves": finish.clear_cross_shelf, "patio": finish.patio_door, "sofa": finish.cloud_station,
             "niches": finish.corridor_niches, "hall": finish.hall_light, "books": finish.book_dividers,
             "bedroom": finish.adjacent_bedchamber, "overlaps": finish.floor_layer_overlaps,
             "pool-contacts": finish.pool_activity_contacts, "lid": finish.arrival_lid_seams,
             "forecourt": finish.forecourt_corners, "wildlife-ground": finish.ground_wildlife,
             "sofa-lining": finish.sofa_lining, "routes": finish.finish_activity_routes,
             "bed-details": finish.bedside_accessories,
             "plant-stems": finish.bedroom_plant_stems,
             "niche-fit": finish.fit_niches,
             "circulation-fit": finish.circulation_fit,
             "record-rail": finish.fit_record_backrail,
             "patio-leaf-ownership": finish.patio_leaf_export_ownership,
             "spiral-wardrobe-termination": finish.spiral_wardrobe_termination,
             "bath-roof-reveal": finish.bath_roof_reveal,
             "bed-contacts": lambda scene, config: finish.bed_transfer_contacts(scene, config, final=True)}
    import coastal_cliff_finish
    steps["massing"] = coastal_cliff_finish.build
    steps["structural-fit"] = coastal_cliff_finish.fit_structure
    steps["interface-fit"] = coastal_cliff_finish.fit_small_interfaces
    steps["pool-liner-clearance"] = coastal_cliff_finish.fit_pool_liner_face
    steps["compact-coast"] = coastal_cliff_finish.compact_retained_coast
    steps["round-sea-closure"] = coastal_cliff_finish.round_sea_closure
    receipts = {}
    (DIRECTORY / "recipe.py").write_bytes((ROOT / "bin/coastal_architecture_finish.py").read_bytes())
    (DIRECTORY / "cliff-recipe.py").write_bytes((ROOT / "bin/coastal_cliff_finish.py").read_bytes())
    for name in requested:
        if name not in steps:
            raise RuntimeError(f"Unknown architecture step: {name}")
        if name in complete and name not in ("bed-contacts", "routes"):
            raise RuntimeError(f"Refusing to apply {name} twice to retained source")
        if name=="massing":
            scene["architectureFinishSteps"]=",".join(sorted(complete))
            bpy.context.preferences.filepaths.save_version=0
            bpy.ops.wm.save_as_mainfile(filepath=str(DIRECTORY/"before-massing.blend"),compress=True)
            (DIRECTORY/"before-massing-manifest.json").write_text(json.dumps(config,indent=2)+"\n",encoding="utf-8",newline="\n")
        try:
            receipts[name] = steps[name](scene, config)
        except Exception as exc:
            bpy.context.preferences.filepaths.save_version = 0
            bpy.ops.wm.save_as_mainfile(filepath=str(DIRECTORY / "failed.blend"), compress=True)
            (DIRECTORY / "failure.json").write_text(json.dumps({"step": name, "error": str(exc), "sourceBeforeSha256": before}, indent=2) + "\n", encoding="utf-8")
            raise
        complete.add(name)
    scene["architectureFinishSteps"] = ",".join(sorted(complete))
    scene["architectureFinishVersion"] = finish.VERSION
    bpy.context.view_layer.update()
    source_out = ROOT / "artwork/coastal-home/coastal-home.blend" if APPLY else DIRECTORY / "candidate.blend"
    manifest_out = ROOT / "assets/models/home/manifest.json" if APPLY else DIRECTORY / "manifest.json"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source_out), compress=True)
    manifest_out.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8", newline="\n")
    preset=json.loads((ROOT/"artwork/coastal-home/companion-flight-paths.json").read_text(encoding="utf-8"))
    preset={key:config["companion"].get(key,value) for key,value in preset.items()}
    (DIRECTORY/"companion-flight-paths.json").write_text(json.dumps(preset,indent=1)+"\n",encoding="utf-8",newline="\n")
    report = {"tool": "bin/refresh_coastal_architecture_finish.py", "version": finish.VERSION,
              "sourceBeforeSha256": before, "sourceAfterSha256": digest(source_out),
              "manifestSha256": digest(manifest_out), "steps": receipts,
              "candidate": str(source_out), "applied": APPLY}
    (DIRECTORY / "receipt.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"candidate": str(source_out), "steps": requested, "receipt": str(DIRECTORY / "receipt.json")}), flush=True)


if __name__ == "__main__":
    main()
