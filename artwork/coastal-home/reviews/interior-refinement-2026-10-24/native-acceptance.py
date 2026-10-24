import sys, json, hashlib, math
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'bin'))
import coastal_bathrooms as baths
import coastal_interior_refinement as refined
import coastal_renovation as renovation
import coastal_preview as preview
args={a.split('=',1)[0][2:]:a.split('=',1)[1] for a in sys.argv if a.startswith('--') and '=' in a}
source=Path(args.get('source',str(ROOT/'artwork/coastal-home/coastal-home.blend')))
expected='e907fb08f65525bf1388d48e6dc79ea6627c2f89d0941bc6d05a5fac239ea813'
if hashlib.sha256(source.read_bytes()).hexdigest()!=expected:
 raise RuntimeError('This dated pre-setback fixture requires the retained e0658c636 source; pass --source=PATH. Do not rebuild old-coordinate bathrooms in the transformed estate.')
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene
config=json.loads((ROOT/'assets/models/home/manifest.json').read_text())
bath_objects,bath_report=baths.build(scene,config)
new_objects,report=refined.apply(scene,config)
def signature(objects):
 return {o.name:hashlib.sha256(b''.join(__import__('struct').pack('<3f',*v.co) for v in o.data.vertices)).hexdigest() for o in objects}
before=signature(new_objects)
again,second=refined.apply(scene,config)
assert before==signature(again)
assert len([p for p in config['installationPoints'] if p['id']=='library-hearth'])==1
renovation.soften_interiors(bath_objects+again)
trees=[]
for o in scene.objects:
 if o.type!='MESH' or o.get('shadowOnly') or o.get('water'):continue
 if any(m and ('glass' in m.name or 'diffuser' in m.name) for m in o.data.materials):continue
 trees.append((o.name,BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[tuple(f.vertices) for f in o.data.polygons])))
probes=[]
for room in config['rooms']:
 if not room.get('bathroom'):continue
 for key in ('route','wcApproachRoute','showerRoute'):
  for q in room['bathroom'][key]:
   point=Vector((q[0],-q[2],q[1]))
   hits=[]
   for name,tree in trees:
    loc,normal,_,dist=tree.ray_cast(point+Vector((0,0,.2)),Vector((0,0,-1)),.4)
    if loc is not None:hits.append((dist,name,loc.z))
   assert hits,(room['id'],key,q)
   first=min(hits)
   assert abs(first[2]-point.z)<.04,(room['id'],key,q,first)
   probes.append({'room':room['id'],'branch':key,'point':q,'delta':first[2]-point.z})
out=ROOT/'.jekyll-cache/interior-refinement/after'
out.mkdir(parents=True,exist_ok=True)
report.update(idempotent=True,bathroomFloorProbes=probes,bathroomFloorMaterials=[m.name for m in baths.materials()['floor']],bathroomLines={r['id']:r['lighting']['lines'] for r in config['rooms'] if r.get('bathroom')})
(out/'native-review.json').write_text(json.dumps(report,indent=2))
(out/'manifest-interior-proposed.json').write_text(json.dumps(config,indent=2))
if '--render' in sys.argv:
 camera=preview.setup(scene,resolution=(1050,744),samples=12)
 for room in bath_report['rooms']:
  f=room['floor']
  preview.add_fill(scene,room['id']+' mirror wash',(-7.85,-3.65,f+2.14),energy=90,size=1.25,target=(-6.5,-3.65,f+.8))
  preview.add_fill(scene,room['id']+' shower cove',(-6.6,-2.0,f+2.20),energy=65,size=1.6,target=(-6.6,-3.6,f+.4))
  preview.add_fill(scene,room['id']+' entry bounce',(-4.95,-5.15,f+1.95),energy=18,size=1,target=(-6.6,-4.3,f+.6))
 views={r['id']:preview.room_eye(r) for r in bath_report['rooms']}
 views['lounge-plant']=((2.65,4.23,1.50),(4.83,3.62,.9),58)
 preview.add_fill(scene,'lounge botanical', (3.5,3.9,2.2),energy=30,size=1.2,target=(4.9,3.6,.5))
 if args.get('only'):views={k:v for k,v in views.items() if k in args['only'].split(',')}
 preview.render(scene,camera,views,out)
print(json.dumps({'idempotent':True,'objects':len(again),'triangles':sum(x['triangles'] for x in report['objects']),'floorProbes':len(probes),'out':str(out)}),flush=True)
