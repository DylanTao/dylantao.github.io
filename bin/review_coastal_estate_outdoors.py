"""Measure delivered native pool levels, rooted planting, and terrace load-path contacts.

This reads an explicitly named preview/final .blend. It never saves the source.
It is a geometric contact audit, not a structural engineering certification.
"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"bin"))
import coastal_estate_outdoors as outdoors

args={a[2:].split("=",1)[0]:a.split("=",1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
def path(key,default):
    p=Path(args.get(key,default));return p if p.is_absolute() else ROOT/p

source=path("source",".jekyll-cache/estate-outdoors/coastal-estate-preview.blend")
config_path=path("manifest",".jekyll-cache/estate-outdoors/manifest-preview.json")
output=path("output",".jekyll-cache/estate-outdoors/native-contacts.json")
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene
config=json.loads(config_path.read_text(encoding="utf-8"))
estate=config["estateOutdoors"]
terrain,names=outdoors.terrain_tree(scene)
vertices=[];triangles=[]
for obj in scene.objects:
    if obj.type!="MESH" or obj.get("flora") or obj.get("water") or obj.get("caveRoof"):
        continue
    if any(("glass" in m.name.lower() and "mosaic" not in m.name.lower()) or
           any(k in m.name.lower() for k in ("leaf","foliage","water")) for m in obj.data.materials if m):
        continue
    if not obj.name.startswith(("core_","coast_")):
        continue
    mesh=obj.data;mesh.calc_loop_triangles();offset=len(vertices)
    vertices.extend(obj.matrix_world@v.co for v in mesh.vertices)
    triangles.extend(tuple(offset+i for i in t.vertices) for t in mesh.loop_triangles)
rigid=BVHTree.FromPolygons(vertices,triangles,all_triangles=True)
report={"source":str(source),"poolLevels":[],"rootContacts":[],"pierSockets":[],"chaiseContacts":[]}
checks=(("swim",[(x,y) for x in (-7.35,-5.3,-2.4,.8,2.55) for y in (9.65,10.6,11.25)],-1.44),
        ("sun-shelf",[(-7.35,7.25),(-4.25,8.7),(-5.9,9.12)],-.31),
        ("social",[(.55,8.70),(1.6,7.9),(2.75,8.8)],-.94))
for zone,points,expected in checks:
    for x,y in points:
        hit,_,triangle,_=rigid.ray_cast(Vector((x,y,.25)),Vector((0,0,-1)),3)
        if hit is None or abs(hit.z-expected)>.003:
            raise AssertionError({"zone":zone,"sample":[x,y],"expected":expected,"hit":None if hit is None else list(hit)})
        report["poolLevels"].append({"zone":zone,"point":list(hit),"expected":expected,"error":abs(hit.z-expected)})
for x in (-6.65,-5.20):
    hit,_,_,_=rigid.ray_cast(Vector((x,7.97,1.0)),Vector((0,0,-1)),2)
    if hit is None or hit.z<=outdoors.POOL["surface"]+.04:
        raise AssertionError({"chaiseSeatX":x,"hit":None if hit is None else list(hit)})
    report["chaiseContacts"].append({"seat":list(hit),"seatAboveWater":hit.z-outdoors.POOL["surface"]})
chaise=bpy.data.objects["core_estate_pool__ivory pool chaise ceramic"]
chair_min=min((chaise.matrix_world@v.co).z for v in chaise.data.vertices)
if abs(chair_min-outdoors.POOL["shelf"])>.0001:
    raise AssertionError({"chairFoot":chair_min,"shelf":outdoors.POOL["shelf"]})
report["chaiseFootLevel"]=chair_min
sink_hit,_,_,_=rigid.ray_cast(Vector((6.94,7.0,1.18)),Vector((0,0,-1)),1.0)
if sink_hit is None or not .82<sink_hit.z<.89:
    raise AssertionError({"sinkBowl":None if sink_hit is None else list(sink_hit),"expected":"Recessed native bowl below the .985m countertop"})
report["recessedSinkBowl"]=list(sink_hit)
report["entrySteps"]=[]
for k in range(7):
    expected=-.18*(k+1)
    y=outdoors.POOL["y"][0]+.16+k*.31
    hit,_,_,_=rigid.ray_cast(Vector((-1.14,y,.25)),Vector((0,0,-1)),3)
    if hit is None or abs(hit.z-expected)>.003:
        raise AssertionError({"poolEntryTread":k+1,"expected":expected,"hit":None if hit is None else list(hit)})
    report["entrySteps"].append({"point":list(hit),"expected":expected,"riser":.18})
for root in estate["garden"]["roots"]:
    x,y,z=root["point"]
    actual,triangle=outdoors.grounded(terrain,x,y)
    error=abs(actual-z)
    if error>.0001:raise AssertionError({"root":root,"actual":actual,"error":error})
    report["rootContacts"].append({"kind":root["kind"],"point":[x,y,z],"error":error,"triangle":triangle})
for pier in estate["terrace"]["piers"]:
    point=Vector(pier["nativeCliffContact"])
    hit,_,_,_=terrain.ray_cast(Vector((point.x,27,point.z)),Vector((0,-1,0)),50)
    if hit is None or (hit-point).length>.0001:
        raise AssertionError({"pier":pier,"contact":None if hit is None else list(hit)})
    report["pierSockets"].append({"x":point.x,"contact":list(hit),"error":(hit-point).length,
                                 "socketOverlap":pier["socketOverlap"]})
report["swimLaneMetres"]=outdoors.POOL["x"][1]-outdoors.POOL["x"][0]
report["maximumPoolLevelError"]=max(v["error"] for v in report["poolLevels"])
report["maximumRootError"]=max(v["error"] for v in report["rootContacts"])
report["scope"]="Actual retained-source native contact checks; no building-code certification or physical-phone performance claim"
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"poolLevelSamples":len(report["poolLevels"]),"plantRoots":len(report["rootContacts"]),
                  "pierSockets":len(report["pierSockets"]),"maxPoolError":report["maximumPoolLevelError"],
                  "maxRootError":report["maximumRootError"],"output":str(output)}),flush=True)
