"""Measure actual native estate circulation; no inferred floor equation.

This checks the delivered source's thresholds, hall, new library stair, both
library room routes, retained private gallery and the two real moving leaves.
The runtime still needs separate decoded-Draco capsule journeys.
"""
import hashlib
import json
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"bin"))
import coastal_estate_architecture as estate

bpy.ops.wm.open_mainfile(filepath=str(ROOT/"artwork/coastal-home/coastal-home.blend"))
scene=bpy.context.scene
manifest_arg=next((a.split("=",1)[1] for a in sys.argv if a.startswith("--manifest=")),None)
proposed=ROOT/".jekyll-cache/estate-architecture/manifest-proposed.json"
manifest=Path(manifest_arg) if manifest_arg else proposed if proposed.exists() else ROOT/"assets/models/home/manifest.json"
config=json.loads(manifest.read_text())
assert len([r for r in config["rooms"] if r.get("library")])==2,"Both library rooms must be present in the inspected manifest"
trees=[]
solids=[]
for obj in scene.objects:
    if obj.type!="MESH" or obj.get("estateDoor") or obj.get("shadowOnly") or obj.name.startswith(("coast_","core_flora_")):
        continue
    bm=bmesh.new()
    bm.from_mesh(obj.data)
    bm.transform(obj.matrix_world)
    if obj.name in ("core__golden coastal sandstone","core_estate_library_liftaway_roof"):
        solid={"name":obj.name,"nonManifoldEdges":sum(not edge.is_manifold for edge in bm.edges),"signedVolume":bm.calc_volume(signed=True)}
        assert solid["nonManifoldEdges"]==0 and solid["signedVolume"]>0,solid
        solids.append(solid)
    trees.append((obj.name,BVHTree.FromBMesh(bm)))
    bm.free()

def hit(point,direction,distance):
    best=None
    for name,tree in trees:
        pos,normal,face,d=tree.ray_cast(Vector(point),Vector(direction),distance)
        if pos is not None and (best is None or d<best[3]):
            best=(name,list(pos),list(normal),d)
    return best

def point(q):
    x,z,ny=q
    return x,-ny,z

def segment_samples(route,spacing=.16):
    out=[]
    for a,b in zip(route,route[1:]):
        a,b=Vector(a),Vector(b)
        n=max(1,int((b-a).length/spacing)+1)
        out.extend(tuple(a.lerp(b,k/n)) for k in range(n))
    out.append(route[-1])
    return out

checks=[]
for room in config["rooms"]:
    if not room.get("library"):
        continue
    route=[point(q) for q in room["library"]["route"]]
    for i,q in enumerate(segment_samples(route)):
        x,y,f=q
        floor=hit((x,y,f+.30),(0,0,-1),.7)
        ceiling=hit((x,y,f+.08),(0,0,1),8)
        check={"route":room["id"],"sample":i,"native":list(q),"floor":floor,"ceiling":ceiling}
        check["floorError"]=abs(floor[1][2]-f) if floor else None
        check["headroom"]=ceiling[1][2]-f if ceiling else 8
        checks.append(check)
        assert floor and check["floorError"]<.045,check
        assert check["headroom"]>2.15,check
    # Solid objects across the waist-height body route would expose an uncut
    # rock wall or a fitted shelf left across a doorway.
    for a,b in zip(route,route[1:]):
        a,b=Vector(a)+Vector((0,0,1.0)),Vector(b)+Vector((0,0,1.0))
        obstacle=hit(a,(b-a).normalized(),(b-a).length-.02)
        assert obstacle is None,{"route":room["id"],"from":list(a),"to":list(b),"obstacle":obstacle}
        side=(b-a).normalized().cross(Vector((0,0,1)))*.28
        for offset in (side,-side):
            obstacle=hit(a+offset,(b-a).normalized(),(b-a).length-.02)
            assert obstacle is None,{"route":room["id"],"bodySide":list(offset),"from":list(a),"to":list(b),"obstacle":obstacle}

stair=[]
for i,q in enumerate(config["estateLibrary"]["stairRoute"]):
    x,y,f=point(q)
    floor=hit((x,y,f+.08),(0,0,-1),.30)
    ceiling=hit((x,y,f+.02),(0,0,1),8)
    report={"tread":i+1,"position":[x,y,f],"floor":floor,"headroom":ceiling[1][2]-f if ceiling else 8}
    stair.append(report)
    assert floor and abs(floor[1][2]-f)<.02,report
    assert report["headroom"]>2.1,report

report={"sourceSha256":hashlib.sha256((ROOT/"artwork/coastal-home/coastal-home.blend").read_bytes()).hexdigest(),
        "waistRouteWidth":.56,
        "routeSamples":len(checks),"maximumFloorError":max(c["floorError"] for c in checks),
        "minimumRouteHeadroom":min(c["headroom"] for c in checks),
        "minimumStairHeadroom":min(c["headroom"] for c in stair),
        "nativeClosedSolids":solids,
        "routes":checks,"stairs":stair,
        "doors":config["estateDoors"],
        "boundary":"Native source ray contacts. Separate delivered capsule and rendered acceptance remain required."}
out=ROOT/".jekyll-cache/estate-architecture/native-contacts.json"
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps({k:v for k,v in report.items() if k not in ("routes","stairs","doors")}),flush=True)
