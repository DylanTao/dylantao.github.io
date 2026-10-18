"""Eevee review renders of every room from its web camera, without saving the house.

Run with Blender 4.5 LTS from the repository root:
  blender -b --python-exit-code 1 --python bin/render_coastal_rooms.py -- --out=DIR [--rooms=study,kitchen] [--arrival]
--arrival renders only each room's arrival view (no envelope corners). Custom close views for the
renovated rooms come from coastal_preview / CLOSE_VIEWS below.
"""

import json
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_preview as preview

args = {a.split("=", 1)[0][2:]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
flags = {a[2:] for a in sys.argv if a.startswith("--") and "=" not in a}
# Blender resolves a relative render path against its own working directory, not the shell's.
out = Path(args.get("out", ".jekyll-cache/visual-qa/rooms"))
out = out if out.is_absolute() else ROOT / out
rooms = [r for r in args.get("rooms", "").split(",") if r] or None
config = json.loads((ROOT / "assets/models/home/manifest.json").read_text(encoding="utf-8"))
bpy.ops.wm.open_mainfile(filepath=str(ROOT / "artwork/coastal-home/coastal-home.blend"))
scene = bpy.context.scene
camera = preview.setup(scene, resolution=(1200, 800))

# Close views (eye, target, fov) in Blender coordinates, for the furniture the renovation changes.
CLOSE_VIEWS = {
    "study": {"study-desk-side": ((2.2, -1.2, 4.3), (-0.4, -3.6, 3.3), 50), "study-from-gallery": ((-1.0, 0.6, 4.6), (-0.3, -3.4, 3.2), 55)},
    "kitchen": {"kitchen-counter": ((-1.4, 2.6, 2.0), (-4.0, 0.2, 1.0), 55), "kitchen-dining": ((-0.8, 4.6, 2.4), (-3.2, 2.2, 0.6), 55)},
    "lounge": {"living": ((0.2, 4.2, 2.6), (0.0, 1.2, 0.4), 60), "living-wide": ((-3.0, 4.3, 3.2), (1.5, 0.8, 0.6), 60), "lounge-chair": ((1.8, 4.4, 1.9), (3.3, 1.2, 0.6), 55)},
    "sleep": {},
    "onsen": {},
    "gym": {},
}
views = preview.manifest_views(config, rooms, orbit="arrival" not in flags)
for room, extra in CLOSE_VIEWS.items():
    if rooms is None or room in rooms:
        views.update(extra)
# Extra views from the command line: --views=name:ex,ey,ez:tx,ty,tz:fov;name2:... (Blender coordinates).
for spec in [v for v in args.get("views", "").split(";") if v]:
    name, eye, target, fov = spec.split(":")
    views[name] = (tuple(float(c) for c in eye.split(",")), tuple(float(c) for c in target.split(",")), float(fov))
if "only-views" in flags:
    views = {k: v for k, v in views.items() if k in [s.split(":")[0] for s in args.get("views", "").split(";") if s]}
if rooms is None or "overview" in (rooms or []):
    overview = config["views"]["overview"]
    views["overview"] = preview.room_eye({"target": overview["target"], "camera": overview})
written = preview.render(scene, camera, views, out)
print("RENDERED", json.dumps(written, indent=1), flush=True)
