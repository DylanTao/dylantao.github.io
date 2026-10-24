"""Continue the retained native house with the coastal estate architecture.

Use -- --preview=DIR for unsaved matched source-native review, or --output=PATH
to stage the changed source separately. The manifest patch is always retained
beside the native geometry report for coordinator-owned runtime integration.
"""
import json
import hashlib
import sys
from pathlib import Path

import bpy

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"bin"))
import coastal_estate_architecture as estate
import coastal_renovation as renovation
import coastal_preview as preview

args={a[2:].split("=",1)[0]:a.split("=",1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
source=Path(args.get("source",str(ROOT/"artwork/coastal-home/coastal-home.blend")))
source=source if source.is_absolute() else ROOT/source
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene
config=json.loads((ROOT/"assets/models/home/manifest.json").read_text(encoding="utf-8"))
if "furniture-only" in args:
    room=args["furniture-only"]
    if room!="library-upper":
        raise ValueError("The bounded furniture refresh is reserved for library-upper")
    if not scene.get("estateLibraryCutVersion") or bpy.data.objects.get("anchor_"+room) is None:
        raise RuntimeError("Furniture-only requires the retained, already-authored library source")
    # Do not run build(): it owns excavation and the initial manifest projection.
    # This maintenance route cannot clear supports, reset rooms or touch outdoors.
    for obj in list(scene.objects):
        if obj.type=="MESH" and obj.name.startswith(room+"_"):
            bpy.data.objects.remove(obj,do_unlink=True)
    objects=estate.furniture(estate.materials(),room=room)
    for obj in objects:
        estate.place(obj)
        obj["estateArchitecture"]=True
    renovation.soften_interiors(objects)
    authored=next(entry for entry in estate.manifest_rooms() if entry["id"]==room)
    anchor=bpy.data.objects.get("anchor_"+room)
    if anchor:
        x,y,z=authored["actor"]
        anchor.location=(x,-z,y)
    output=Path(args.get("output",str(source)))
    output=output if output.is_absolute() else ROOT/output
    output.parent.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(output),compress=True)
    patch={"room":room,"roomUpdates":{"actor":authored["actor"],"library":authored["library"],"lighting":authored["lighting"]},
           "contactUpdates":{"actor":authored["actor"]},"sourceAnchor":"anchor_"+room,
           "privateConnectionEndpoint":authored["actor"],
           "sourceSha256":hashlib.sha256(output.read_bytes()).hexdigest(),
           "geometry":{"deskWidth":1.60,"stairPassageWidth":.82,"bookWallLength":3.70,
                       "objects":[obj.name for obj in objects]},
           "untouched":["excavation","supports","manifest","outdoors","other room meshes","interactive study"]}
    out=ROOT/".jekyll-cache/estate-architecture"
    out.mkdir(parents=True,exist_ok=True)
    (out/"furniture-library-upper.json").write_text(json.dumps(patch,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(patch),flush=True)
    sys.exit(0)
objects,report=estate.build(scene,config)
renovation.soften_interiors(objects)
out=Path(args.get("preview",".jekyll-cache/estate-architecture"))
out=out if out.is_absolute() else ROOT/out
out.mkdir(parents=True,exist_ok=True)
(out/"geometry.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
(out/"manifest-proposed.json").write_text(json.dumps(config,indent=2)+"\n",encoding="utf-8")
patch={"rooms":report["rooms"],"estateDoors":config["estateDoors"],"estateLibrary":config["estateLibrary"],
       "supportSurfaces":[q for q in config["terrain"]["supportSurfaces"] if q["id"].startswith("estate-")],
       "contacts":{room["id"]:{key:room[key] for key in ("actor","egress","floor","exitPath")} for room in report["rooms"]},
       "walkRegion":config["walk"]["region"]}
(out/"manifest-patch.json").write_text(json.dumps(patch,indent=2)+"\n",encoding="utf-8")
if "preview" in args:
    camera=preview.setup(scene,resolution=(1200,800),samples=int(args.get("samples",16)),cutaway=args.get("cutaway","1")=="1")
    preview.add_fill(scene,"library lower books",estate.native((14.85,3,2.10)),energy=130,size=3,target=estate.native((13.1,3,.7)))
    preview.add_fill(scene,"library upper books",estate.native((14.85,3,4.65)),energy=130,size=3,target=estate.native((13.1,3,3.2)))
    preview.add_fill(scene,"entry door wash",(-2.9,-7.3,2.05),energy=28,size=.8,target=(-2.8,-8.5,1))
    views={"library-ground":(estate.native((13.7,1.6,1.60)),estate.native((13.55,7.5,1.8)),65),
           "library-upper":(estate.native((13.45,.60,4.15)),estate.native((14.1,5.2,3.80)),62),
           "library-exterior":((-24,26,12),(-5.5,4.5,2.5),58),
           "main-door":((-2.8,-9.2,1.65),(-2.8,-6.7,1.3),62),
           "private-door":((3.4,-8.8,4.20),(3.4,-6.6,3.8),62)}
    if args.get("only"):
        views={k:v for k,v in views.items() if k in args["only"].split(",")}
    print("RENDERED",preview.render(scene,camera,views,out),flush=True)
else:
    output=Path(args.get("output",str(source)))
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(output),compress=True)
print(json.dumps({"rooms":[r["id"] for r in report["rooms"]],"objects":len(objects),"triangles":sum(o["triangles"] for o in report["objects"]),"report":str(out/"geometry.json")}),flush=True)
