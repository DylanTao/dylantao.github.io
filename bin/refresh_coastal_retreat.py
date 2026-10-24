"""Apply the inland retreat to the retained source, then save one combined scene.

Explicit paths keep iterative outputs ignored. Interior module authors original
coordinates; final 8m housing migration is applied once after that module.
"""
import hashlib
import json
import sys
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"bin"))
import coastal_retreat as retreat
import coastal_renovation as renovation

args={a[2:].split("=",1)[0]:a.split("=",1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
def path(key,default):
    p=Path(args.get(key,default));return p if p.is_absolute() else ROOT/p
source=path("source","artwork/coastal-home/coastal-home.blend")
manifest=path("manifest","assets/models/home/manifest.json")
output=path("output",".jekyll-cache/retreat/coastal-retreat.blend")
config_output=path("config-output",".jekyll-cache/retreat/manifest.json")
report_output=path("report-output",".jekyll-cache/retreat/geometry.json")
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene
config=json.loads(manifest.read_text(encoding="utf-8"))
if scene.get("inlandRetreatVersion")==retreat.VERSION:
    if config.get("retreat",{}).get("version")!=retreat.VERSION:
        raise RuntimeError("Migrated source requires its matching migrated manifest; no source saved")
    print(json.dumps({"retained":True,"version":retreat.VERSION,"source":str(source),"manifest":str(manifest),
                      "note":"Already migrated; no bathroom/decor/source reset performed"}),flush=True)
    sys.exit(0)
refine=None
if "--with-interior" in sys.argv:
    import coastal_bathrooms as baths
    import coastal_interior_refinement as interior
    baths_objects,baths_report=baths.build(scene,config)
    renovation.soften_interiors(baths_objects)
    refine=interior.apply
objects,report=retreat.build(scene,config,refine=refine)
renovation.soften_interiors(objects)
report.update(source=str(source),sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
              newObjects=len(objects),newTriangles=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in objects))
for p in (output,config_output,report_output):p.parent.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(output),compress=True)
config_output.write_text(json.dumps(config,indent=2)+"\n",encoding="utf-8")
report_output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"output":str(output),"manifest":str(config_output),"report":str(report_output),
                  "objects":len(objects),"newTriangles":report["newTriangles"],"roof":report["roof"]}),flush=True)
