"""October 23 connected main arrival and crafted lounge refinement.

Run from the repository root with Blender 4.5 LTS. This continues the retained editable house,
replacing its own geometry idempotently; one-time excavation cuts are recorded on the scene.
Use -- --preview=DIR to inspect the same changes without saving source or manifest.
After saving: bake_coastal_light.py -- --prefixes=core_arrival_,lounge_, then export only
home-shell,coast,room-onsen,room-lounge with optimize_coastal_exports.py.
"""
import json
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_arrival as arrival
import coastal_living as living
import coastal_preview as preview
import coastal_renovation as renovation
import coastal_kitchen as kitchen
from coastal_landscape import web

args = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
source = ROOT / "artwork/coastal-home/coastal-home.blend"
manifest = ROOT / "assets/models/home/manifest.json"
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
config = json.loads(manifest.read_text(encoding="utf-8"))
phases = args.get("phases", "entrance,living").split(",")
objects, supports, entry = arrival.build_entry(scene, config)
renovation.soften_interiors(objects)
config["terrain"]["supportSurfaces"] = [s for s in config["terrain"]["supportSurfaces"] if not s["id"].startswith("arrival-")] + supports
lounge, placeholders, lounge_report = [], [], {}
if "living" in phases:
    lounge, placeholders, _, lounge_report = living.build_living(scene)
    renovation.soften_interiors(lounge + placeholders)
# Match the two real saucer shades, rather than representing them as one midpoint downlight.
lights = config.setdefault("interiorLights", {})
lights["downlights"] = [web((x, y, kitchen.SOFFIT-.012)) for x, y in kitchen.DOWNLIGHTS]
lights["dining"] = [web((x, y, kitchen.DINING["table"][2]+.75)) for x, y in kitchen.DINING_PENDANTS]
report = {"entrance": entry, "living": lounge_report,
          "walk": config["walk"], "objects": [{"name": o.name, "vertices": len(o.data.vertices),
          "triangles": sum(len(p.vertices)-2 for p in o.data.polygons)} for o in objects+lounge+placeholders]}
out = Path(args.get("preview", "artwork/coastal-home/reviews/arrival-living"))
out = out if out.is_absolute() else ROOT / out
if "preview" in args:
    camera = preview.setup(scene, resolution=(1200, 800), samples=24)
    preview.add_fill(scene, "arrival lower washer", (-2.8, -8.1, 2.05), energy=38, size=.35)
    preview.add_fill(scene, "arrival upper washer", (3.42, -8.3, 4.6), energy=38, size=.35)
    preview.add_fill(scene, "dining pendant preview", (-1.85, -3.05, 1.5), energy=50, size=1.0)
    views = {"lounge": preview.room_eye(next(r for r in config["rooms"] if r["id"] == "lounge")),
             "living-detail": ((2.5, 2.3, 1.0), (-.3, .8, .1), 58),
             "entry-turn": ((3.42, -9.02, 4.18), (-1.4, -8.72, .8), 68),
             "entry-lower": ((-2.8, -8.7, 1.62), (-1.2, -5.6, 1.0), 68),
             "entry-outside": ((6.5, -20, 12.2), (3.42, -17.8, arrival.ENTRY["top"]+.5), 55)}
    if args.get("only"):
        views = {k:v for k,v in views.items() if k in args["only"].split(",")}
    print("RENDERED", preview.render(scene, camera, views, out), flush=True)
else:
    manifest.write_text(json.dumps(config, indent=2)+"\n", encoding="utf-8")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
    out.mkdir(parents=True, exist_ok=True)
    (out / "geometry.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
print(json.dumps(report), flush=True)
