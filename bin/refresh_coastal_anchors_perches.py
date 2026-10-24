"""Synchronize native empty anchors and the one displaced west coastal perch."""
import json
import sys
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"bin"))
from coastal_retreat import sync_anchors_and_coastal_perch

source=ROOT/"artwork/coastal-home/coastal-home.blend"
manifest=ROOT/"assets/models/home/manifest.json"
bpy.ops.wm.open_mainfile(filepath=str(source))
config=json.loads(manifest.read_text(encoding="utf-8"))
config["equipment"]["gym"]["choreographyOrigin"]=[0,0,config["retreat"]["setbackMetres"]]
config["cameraCollision"]["facade"]["planeZ"]=config["facade"]["planeZ"]
report=sync_anchors_and_coastal_perch(bpy.context.scene,config)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
manifest.write_text(json.dumps(config,indent=2)+"\n",encoding="utf-8")
out=ROOT/"artwork/coastal-home/reviews/retreat-2026-10-24/anchor-perch-closure.json"
out.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print(json.dumps(report),flush=True)
