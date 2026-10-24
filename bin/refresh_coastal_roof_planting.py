"""Partition supported roof agaves in the accepted source; no geometry relocation."""
import hashlib
import json
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_roof_planting import partition

source = ROOT / "artwork/coastal-home/coastal-home.blend"
bpy.ops.wm.open_mainfile(filepath=str(source))
objects, report = partition(bpy.context.scene)
if not report.get("retained"):
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
report["sourceSha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
out = ROOT / "artwork/coastal-home/reviews/retreat-2026-10-24/roof-planting.json"
out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k: v for k, v in report.items() if k != "contacts"}), flush=True)
