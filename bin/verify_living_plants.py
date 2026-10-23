"""Read-only native planting preservation, support and library-reload check.

Run Blender with -- --baseline=PATH; no native source is saved.
"""
import bpy, json, hashlib, struct, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
args={a.split('=',1)[0][2:]:a.split('=',1)[1] for a in sys.argv if a.startswith('--') and '=' in a}
sys.path.insert(0,str(ROOT/'bin'))
from coastal_living_plants import ensure_living_plants, PREFIX

def snapshot(path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    result={}
    for o in bpy.context.scene.objects:
        h=hashlib.sha256()
        h.update(o.type.encode());h.update(str([list(row) for row in o.matrix_world]).encode())
        if o.type=='MESH':
            for v in o.data.vertices:h.update(struct.pack('<3f',*v.co))
            for p in o.data.polygons:h.update(str((list(p.vertices),p.material_index,p.use_smooth)).encode())
            h.update(str([m.name if m else None for m in o.data.materials]).encode())
            for a in o.data.color_attributes:
                h.update(str((a.name,a.domain,a.data_type)).encode())
                for c in a.data:h.update(struct.pack('<4f',*c.color))
        result[o.name]=h.hexdigest()
    return result

baseline=Path(args['baseline']).resolve()
old=snapshot(baseline)
new=snapshot(ROOT/'artwork/coastal-home/coastal-home.blend')
added=sorted(set(new)-set(old));removed=sorted(set(old)-set(new))
changed=[name for name in old.keys() & new.keys() if old[name]!=new[name]]
assert not removed and not changed,(removed,changed)
assert len(added)==6 and all(n.startswith(PREFIX) for n in added),added

scene=bpy.context.scene
samples=[]
for label,points,height in [('olive',[(3,3.9),(2.82,3.9),(3.18,3.9),(3,3.72),(3,4.08)],-.0195),('credenza',[(4.79,.13),(4.77,.13),(4.81,.13)],.584)]:
    for x,y in points:
        origin=Vector((x,y,height+.001));hits=[]
        for candidate in scene.objects:
            if candidate.type!='MESH' or candidate.name.startswith(PREFIX):continue
            corners=[candidate.matrix_world@Vector(c) for c in candidate.bound_box]
            if not all(min(p[k] for p in corners)-.001<=origin[k]<=max(p[k] for p in corners)+.001 for k in [0,1]):continue
            if min(p.z for p in corners)>height+.001 or max(p.z for p in corners)<height-.02:continue
            inv=candidate.matrix_world.inverted()
            hit,point,normal,face=candidate.ray_cast(inv@origin,inv.to_3x3()@Vector((0,0,-1)))
            if hit:
                point=candidate.matrix_world@point
                if height-.02<=point.z<=height+.001:hits.append((point.z,candidate,point))
        assert hits,(label,x,y)
        z,obj,loc=max(hits,key=lambda h:h[0])
        assert abs(loc.z-height)<.0001,(label,loc.z)
        samples.append(dict(plant=label,xy=[x,y],height=loc.z,support=obj.name))

count=len(scene.objects)
first=ensure_living_plants(scene);second=ensure_living_plants(scene)
assert len(scene.objects)==count and {o.name for o in first}=={o.name for o in second}
# Simulate the next clean build as well: the exact same six-part native library loads once.
for obj in first:bpy.data.objects.remove(obj,do_unlink=True)
reloaded=ensure_living_plants(scene)
assert len(reloaded)==6 and len(scene.objects)==count
for obj in reloaded:
    assert obj.name in added
    assert all(slot.material and not slot.material.name[-4:].startswith('.') for slot in obj.material_slots)

result=dict(baselineSourceSha256=hashlib.sha256(baseline.read_bytes()).hexdigest(),baselineCommit='49d99b07716f46771afcbd782674d63b9bc75360',unchangedObjects=len(old),addedObjects=added,removedObjects=removed,changedExistingObjects=changed,objectHashFields='type, world matrix, positions, polygon topology, material slots, smooth flags, native baked color attributes',supportRays=samples,idempotentExisting=True,idempotentReload=True)
(ROOT/'.jekyll-cache/living-preservation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result),flush=True)
