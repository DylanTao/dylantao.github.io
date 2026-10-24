"""Continue the retained house with two native carved bathrooms; never rebuild old rooms."""
import json
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_bathrooms as baths
import coastal_renovation as renovation
import coastal_preview as preview

args = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
source = ROOT / "artwork/coastal-home/coastal-home.blend"
manifest = ROOT / "assets/models/home/manifest.json"
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
config = json.loads(manifest.read_text(encoding="utf-8"))
objects, report = baths.build(scene, config)
renovation.soften_interiors(objects)
out = Path(args.get("preview", "artwork/coastal-home/reviews/bathrooms"))
out = out if out.is_absolute() else ROOT / out
if "preview" in args:
    camera = preview.setup(scene, resolution=(1050, 744), samples=int(args.get("samples", 16)))
    for room in report["rooms"]:
        f = room["floor"]
        preview.add_fill(scene, room["id"]+" mirror wash", (-7.85, -3.65, f+2.14), energy=90, size=1.25, target=(-6.5, -3.65, f+.8))
        preview.add_fill(scene, room["id"]+" shower cove", (-6.6, -2.0, f+2.20), energy=65, size=1.6, target=(-6.6, -3.6, f+.4))
        preview.add_fill(scene, room["id"]+" entry bounce", (-4.95, -5.15, f+1.95), energy=18, size=1.0, target=(-6.6, -4.3, f+.6))
    views = {r["id"]: preview.room_eye(r) for r in report["rooms"]}
    views["upper-vanity"] = ((-6.16, -4.75, 4.10), (-8.0, -3.55, 3.95), 55)
    views["lower-entry"] = ((-3.91, -5.15, 1.62), (-6.45, -4.4, 1.05), 64)
    views["upper-wc"] = ((-7.40, -4.12, 4.18), (-7.58, -5.53, 3.06), 60)
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
