"""Native ray survey for the actual migrated scene, including return journeys."""
import json,math,sys,hashlib
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
args={a[2:].split("=",1)[0]:a.split("=",1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
source=Path(args.get("source",str(ROOT/".jekyll-cache/retreat/coastal-retreat.blend")))
manifest=Path(args.get("manifest",str(ROOT/".jekyll-cache/retreat/manifest.json")))
out=Path(args.get("out",str(ROOT/".jekyll-cache/retreat/native-contacts.json")))
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
config=json.loads(manifest.read_text(encoding="utf-8"))
trees=[];rock=[]
for o in scene.objects:
    if o.type!="MESH" or o.get("shadowOnly") or o.get("facadeDoor") or o.get("estateDoor"):
        continue
    if o.get("flora") and not any(m and any(word in m.name.lower() for word in ("bark","trunk")) for m in o.data.materials):
        continue
    vertices=[o.matrix_world@v.co for v in o.data.vertices]
    if not vertices:continue
    tree=BVHTree.FromPolygons(vertices,[list(f.vertices) for f in o.data.polygons])
    trees.append((o.name,tree))
    if o.name in ("core__golden coastal sandstone","coast_shared_golden coastal sandstone"):
        rock.append((o.name,tree))
def hit(point,direction,distance,collection=trees):
    result=None
    for name,tree in collection:
        p,n,i,d=tree.ray_cast(Vector(point),Vector(direction),distance)
        if p is not None and (result is None or d<result["distance"]):
            result={"mesh":name,"position":list(p),"normal":list(n),"triangle":i,"distance":d}
    return result
def native(q):return (q[0],-q[2],q[1])
routes={"main-entry":config["walk"]["mainEntryRoute"],"patio":config["retreat"]["patioRoute"],
        "bedroom-study":config["estateLibrary"]["privateConnection"],"spiral":config["estateLibrary"]["stairRoute"]}
if config["estateLibrary"].get("bedroomApproach"):routes["bedroom-approach"]=config["estateLibrary"]["bedroomApproach"]
if config.get("privateEntrance"):routes["private-onsen"]=config["privateEntrance"]["route"]
if config["retreat"].get("poolEdgeRoute"):routes["pool-entry-coping"]=config["retreat"]["poolEdgeRoute"]
if config["retreat"].get("gymConnection"):routes["gym-connection"]=config["retreat"]["gymConnection"]["route"]
for room in config["rooms"]:
    if room.get("library"):routes[room["id"]]=room["library"]["route"]
checks=[];failures=[]
for label,route in routes.items():
    # Respect exact native stair tread centres: interpolate plan and use the
    # lower adjacent tread height only for contact search across a riser.
    for index,q in enumerate(route):
        x,y,z=native(q)
        floor=hit((x,y,z+.25),(0,0,-1),.65)
        head=hit((x,y,z+.09),(0,0,1),9)
        error=abs(floor["position"][2]-z) if floor else None
        clearance=head["position"][2]-z if head else 9
        check={"route":label,"index":index,"point":q,"floor":floor,"floorError":error,"headroom":clearance,"ceiling":head}
        checks.append(check)
        if error is None or error>.065 or clearance<2.10:failures.append(check)
    # A sampled knee/waist/chest envelope catches walls/furniture across a route.
    for index,(a,b) in enumerate(zip(route,route[1:])):
        a,b=Vector(native(a)),Vector(native(b));delta=b-a
        if delta.length<.001:continue
        side=Vector((-delta.y,delta.x,0)).normalized()*.25
        for h in (0.55,1.1,1.65):
            for offset in (Vector((0,0,0)),side,-side):
                start=a+offset+Vector((0,0,h));target=b+offset+Vector((0,0,h))
                obstacle=hit(start,(target-start).normalized(),max(0,(target-start).length-.03))
                if obstacle:
                    failures.append({"route":label,"segment":index,"height":h,"offset":list(offset),"obstacle":obstacle})
bearing=[]
cantilever=config.get("estateOutdoors",{}).get("terrace",{}).get("structure")
bearing_y=(-.8,1.2,1.95) if cantilever else (-.8,1.2,3.45)
for x in (-7.5,-4.5,-1.5,2.5):
    for y in bearing_y:
        # Starting 1cm above the basin cut observes the newly excavated retained
        # coast's top bearing, not its underside or the modeled pool shell.
        contact=hit((x,y,-1.70),(0,0,-1),.35,rock)
        sample={"native":[x,y,-1.72],"bearing":contact}
        bearing.append(sample)
        if not contact or abs(contact["position"][2]+1.72)>.02:failures.append({"bearing":sample})
forward_clearance=[]
if cantilever:
    # The forward span is intentionally in air now. Hold the same backspan
    # rock-height bound and independently require a real gap under the basin.
    for x in (-7.5,-4.5,-1.5,2.5):
        q=(x,3.45,-1.825)
        support=hit(q,(0,0,-1),.12,rock)
        row={"native":q,"clearanceAtLeastM":.12,"unexpectedSupport":support}
        forward_clearance.append(row)
        if support:failures.append({"cantileverAirClearance":row})
companion=[]
def sphere(q,r,label):
    point=Vector(native(q));nearest=[]
    for name,tree in trees:
        p,n,i,d=tree.find_nearest(point)
        if p is not None:nearest.append((d,name))
    distance,name=min(nearest)
    check={"id":label,"point":q,"radius":r,"clearance":distance,"mesh":name}
    companion.append(check)
    if distance<r:failures.append({"companion":check})
for room,perches in config["companion"]["perches"].items():
    hover=config["companion"].get("hover",{}).get(room,.72)
    for k,q in enumerate(perches):sphere([q[0],q[1]+hover,q[2]],.30,f"perch:{room}:{k}")
def cruise(q):
    base=next((o["air"] for o in config["companion"].get("airPointOverrides",[]) if o["point"]==q),q)
    return Vector((base[0],base[1]+1.65,base[2]))
air=[cruise(q) for q in config["navigation"]["stairs"]]
air_routes={"curved-stair-air":air}
full_companion=args.get("companion-scope","core") in ("all","source-candidates")
for label in (("bedroom-approach","bedroom-study","study","library") if full_companion else ()):
    if label in routes:air_routes[label+"-air"]=[cruise(q) for q in routes[label]]
for label,route in air_routes.items():
    for k,(a,b) in enumerate(zip(route,route[1:])):
        for j in range(math.ceil((b-a).length/.08)+1):
            q=a.lerp(b,j/max(1,math.ceil((b-a).length/.08)))
            sphere(list(q),.42,f"{label}:{k}:{j}")
report={"sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest(),"routeCount":len(routes),
        "samples":checks,"bearing":bearing,"forwardCantileverClearance":forward_clearance,"failures":failures,"passed":not failures,
        "companionSphereChecks":companion,
        "companionScope":"diagnostic human-route air candidates; actual runtime flights audited separately" if full_companion else "all room perches and main curved stair; full runtime flight audit is separate",
        "scope":"Actual source rays and 0.5m-wide body-line sweep. Delivered compressed capsule and rendered evidence are separate gates."}
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"passed":not failures,"routes":len(routes),"samples":len(checks),"failures":len(failures),"firstFailures":failures[:12],"report":str(out)}),flush=True)
if failures:sys.exit(1)
