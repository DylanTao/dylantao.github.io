"""Apply the original outdoor authoring module to an explicit source, safely by default.

Default outputs are ignored preview files. This never overwrites the retained source or
public manifest unless the coordinator explicitly supplies those paths as output arguments.
Example: blender -b --python-exit-code 1 --python bin/refresh_coastal_estate_outdoors.py
 -- --render --only=estate,arrival,pool --repeat-check

The coordinator can use --repair-firebench-only to migrate only the six retained
bench islands. That mode never rebuilds outdoors, softens other meshes, renders,
or writes the manifest; it saves only the explicitly chosen blend and report.
"""
from array import array
import hashlib
import json
import sys
from pathlib import Path

import bpy

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"bin"))
import coastal_estate_outdoors as outdoors
import coastal_preview as preview
import coastal_renovation as renovation

args={a[2:].split("=",1)[0]:a.split("=",1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
def path(key,default):
    p=Path(args.get(key,default))
    return p if p.is_absolute() else ROOT/p

source=path("source","artwork/coastal-home/coastal-home.blend")
manifest=path("manifest","assets/models/home/manifest.json")
output=path("output",".jekyll-cache/estate-outdoors/coastal-estate-preview.blend")
config_output=path("config-output",".jekyll-cache/estate-outdoors/manifest-preview.json")
report_output=path("report-output",".jekyll-cache/estate-outdoors/geometry.json")
source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
repair_only="--repair-firebench-only" in sys.argv
if repair_only and ("--render" in sys.argv or "config-output" in args):
    raise ValueError("--repair-firebench-only cannot render or write a manifest")
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene


def geometry_digest(obj):
    """Exact source geometry/transform fingerprint, including stored corner normals."""
    mesh=obj.data
    digest=hashlib.sha256()
    for collection,attribute,typecode,count in ((mesh.vertices,"co","f",3),
                                               (mesh.loops,"vertex_index","I",1),
                                               (mesh.polygons,"material_index","I",1)):
        values=array(typecode,[0])*(len(collection)*count)
        collection.foreach_get(attribute,values)
        digest.update(values.tobytes())
    digest.update(array("d",[value for row in obj.matrix_world for value in row]).tobytes())
    if mesh.has_custom_normals:
        digest.update(array("f",[value for normal in mesh.corner_normals for value in normal.vector]).tobytes())
    return digest.hexdigest()


if repair_only:
    manifest_hash=hashlib.sha256(manifest.read_bytes()).hexdigest() if manifest.exists() else None
    before={obj.name:geometry_digest(obj) for obj in scene.objects if obj.type=="MESH"}
    objects,report=outdoors.repair_firebench(scene)
    changed={obj.name for obj in objects}
    after={obj.name:geometry_digest(obj) for obj in scene.objects if obj.type=="MESH"}
    unexpected=[name for name in before.keys()|after.keys()
                if name not in changed and before.get(name)!=after.get(name)]
    if unexpected:
        raise AssertionError({"unexpectedGeometryChanges":unexpected})
    if "--repeat-check" in sys.argv:
        outdoors.repair_firebench(scene)
        repeated={obj.name:geometry_digest(obj) for obj in scene.objects if obj.type=="MESH"}
        if after!=repeated:
            raise AssertionError("Fire-bench repair changed geometry on a second call")
        report["repeatCheck"]="Every native mesh and stored normal is unchanged on second call"
    report.update(source=str(source),sourceSha256=source_hash,mode="repair-firebench-only",
                  unchangedOtherMeshes=len(before)-len(changed),
                  beforeMeshHashes={name:before[name] for name in changed},
                  afterMeshHashes={name:after[name] for name in changed},
                  manifestSha256=manifest_hash)
    for p in (output,report_output):p.parent.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(output),compress=True)
    if manifest_hash is not None and hashlib.sha256(manifest.read_bytes()).hexdigest()!=manifest_hash:
        raise AssertionError("The manifest changed during a source-only fire-bench repair")
    report_output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"source":str(source),"output":str(output),"report":str(report_output),
                      "changedMeshes":sorted(changed),"unchangedOtherMeshes":report["unchangedOtherMeshes"],
                      "manifestUntouched":True}),flush=True)
    sys.exit(0)

config=json.loads(manifest.read_text(encoding="utf-8"))
objects,report=outdoors.build(scene,config)
renovation.soften_interiors(objects)
if "--repeat-check" in sys.argv:
    before={o.name:(len(o.data.vertices),len(o.data.polygons)) for o in objects}
    objects,second=outdoors.build(scene,config)
    renovation.soften_interiors(objects)
    after={o.name:(len(o.data.vertices),len(o.data.polygons)) for o in objects}
    if before!=after:
        raise AssertionError({"first":before,"second":after})
    report["repeatCheck"]="Same delivered object names and vertex/face counts after a second build"
report["sourceSha256"]=source_hash
report["source"]=str(source)
report.update(meshes=len(objects),vertices=sum(len(o.data.vertices) for o in objects),
              triangles=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in objects))
report["references"]=[
    {"title":"WOHA: Alila Villas Uluwatu","url":"https://woha.net/project/alila-villas-uluwatu/",
     "principle":"Cliff, local stone, pavilion and landscape read as one architecture"},
    {"title":"Aman: Amangiri","url":"https://www.aman.com/resorts/amangiri",
     "principle":"Pool court organized around retained rock; framed lounging and outlook"},
    {"title":"Ledge Lounger: in-pool chaise loungers","url":"https://ledgeloungers.com/collections/in-pool-chaise-loungers",
     "principle":"22cm shelf matches the reference shallow-water typology; chaises here are original geometry"}]
for p in (output,config_output,report_output):p.parent.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(output),compress=True)
config_output.write_text(json.dumps(config,indent=2)+"\n",encoding="utf-8")
report_output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
if "--render" in sys.argv:
    camera=preview.setup(scene,resolution=(int(args.get("width",1100)),int(args.get("height",760))),samples=int(args.get("samples",16)),cutaway=False)
    # The generic preview clears glazing by material name. Pool mosaic contains the historic
    # phrase "sea glass" but is an opaque fired tile, so restore its authored alpha here.
    tile=bpy.data.materials.get("sea glass pool mosaic")
    if tile:
        tile.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value=1.0
        tile.surface_render_method="DITHERED"
    views={"estate":((-17,28,13),(-1,4.5,2.3),54),
           "pool":((-10.5,19.0,6.2),(-2.2,8.9,-.15),54),
           "pavilion":((1.7,14.6,4.3),(5.5,8.9,1.2),54),
           "arrival":((-.1,-24.4,11.8),(3.4,-17.1,8.1),52),
           "garden":((-12,-24,16),(.4,-15.5,8.0),58)}
    if args.get("only"):views={k:v for k,v in views.items() if k in args["only"].split(",")}
    report["renders"]=preview.render(scene,camera,views,report_output.parent)
    report_output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"source":str(source),"output":str(output),"config":str(config_output),"report":str(report_output),
                  "meshes":report["meshes"],"triangles":report["triangles"],"gardenRoots":len(report["garden"]["roots"])}),flush=True)
