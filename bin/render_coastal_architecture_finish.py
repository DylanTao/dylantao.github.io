"""Actual retained-native views for architectural iteration, not browser-light acceptance."""
import json
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_preview as preview

ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
source = Path(ARGS.get("source", str(ROOT / "artwork/coastal-home/coastal-home.blend")))
manifest = Path(ARGS.get("manifest", str(ROOT / "assets/models/home/manifest.json")))
out = Path(ARGS.get("out", str(ROOT / ".jekyll-cache/visual-qa/finish-house-2026-10-26/baseline/renders")))
if not out.is_absolute():
    out = ROOT / out
bpy.ops.wm.open_mainfile(filepath=str(source))
config = json.loads(manifest.read_text(encoding="utf-8"))
width = int(ARGS.get("width", "1200"))
height = int(ARGS.get("height", "800"))
scene = bpy.context.scene
camera = preview.setup(scene, resolution=(width, height), samples=16, cutaway=ARGS.get("cutaway", "0") == "1")
for obj in scene.objects:
    if obj.get("bedding"):
        obj.hide_render = obj["bedding"] != ARGS.get("bedding", "empty")
views = {"sea": ((-18, 27, 14), (-1., -4.0, 2.8), 58),
         "pavilion": ((-9.0, -28.8, 13.0), (-2.5, -20.4, 9.1), 55),
         "library": ((-9.90, -3.8, 1.55), (-10.6, -6.9, 1.05), 65),
         "corridor": ((-3.85, -8.75, 1.65), (-6.36, -9.665, 1.45), 62),
         "hall": ((1.2, -21.8, 1.65), (-1.6, -17.0, 3.4), 62)}
bed = next(r for r in config["rooms"] if r["id"] == "sleep")
views["bed"] = preview.room_eye(bed)
if ARGS.get("only"):
    views = {k: v for k, v in views.items() if k in ARGS["only"].split(",")}
preview.add_fill(scene, "architectural review interior stand-in", (-9., -6.8, 4.5), energy=100, size=3, target=(-10.5, -5.0, .4))
preview.add_fill(scene, "architectural review hall stand-in", (.15, -19.7, 5.9), energy=140, size=2, target=(-1, -18, 2))
print(preview.render(scene, camera, views, out), flush=True)
