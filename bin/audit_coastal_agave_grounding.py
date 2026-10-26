import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'bin'))
args={a[2:].split('=',1)[0]:a.split('=',1)[1] for a in sys.argv if a.startswith('--') and '=' in a}
import coastal_shell as shell
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'assets/models/home/home-shell.glb'))
scene=bpy.context.scene
agaves=[o for o in scene.objects if o.type=='MESH' and ('blue sage agave leaf' in o.name.replace('_',' ') or o.get('roofPlanting'))]
assert len(agaves)==4,[o.name for o in agaves]
supports=[]
for o in scene.objects:
 if o.type=='MESH' and (o.get('caveRoof') or o.get('closedSolid') or 'golden coastal sandstone' in o.name.replace('_',' ')):
  supports.append((o,BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[list(f.vertices) for f in o.data.polygons])))
reference_path=root/args.get('reference','artwork/coastal-home/reviews/retreat-2026-10-24/agave-grounding.json')
reference=json.loads(reference_path.read_text())['contacts']
contacts=[]
for obj in agaves:
 bm=__import__('bmesh').new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table()
 for island in shell._islands(bm):
  points=[obj.matrix_world@v.co for v in island];bottom=min(p.z for p in points)
  points=[p for p in points if p.z<bottom+.015];q=sum(points,Vector())/len(points)
  ref=min(reference,key=lambda r:math.hypot(q.x-r['rootAfter'][0],q.y-r['rootAfter'][1]))
  assert math.hypot(q.x-ref['rootAfter'][0],q.y-ref['rootAfter'][1])<.02
  hits=[]
  for support,tree in supports:
   hit=tree.ray_cast(q+Vector((0,0,.15)),Vector((0,0,-1)),20)[0]
   if hit is not None:hits.append((q.z-hit.z,support.name))
  gap,support=min(hits)
  # Validate the complete worst-case gap after collecting all roots.
  contacts.append({'root':list(q),'support':support,'gap':gap,'referenceRoot':ref['rootAfter']})
 bm.free()
assert len(contacts)==282,len(contacts)
report={'scope':'Actual decoded delivered Draco agave leaf roots versus decoded shell support, no analytic ground','leaves':len(contacts),'rosettes':len({tuple(q['referenceRoot']) for q in contacts}),'minimumGap':min(q['gap'] for q in contacts),'maximumGap':max(q['gap'] for q in contacts),'contacts':contacts}
assert report['rosettes']==32
assert report['maximumGap']<0, 'Delivered agave roots still float'
assert report['minimumGap']>-.045, 'Delivered agave roots sink excessively'
destination=root/args.get('out','.jekyll-cache/retreat-grounding/delivered-agave-contact.json')
destination.parent.mkdir(parents=True,exist_ok=True)
destination.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='contacts'}))
