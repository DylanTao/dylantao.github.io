"""Independent saved-source scope and outside-field control for the F6 candidate."""
import bpy,bmesh,hashlib,json,sys,math
import numpy as np
from pathlib import Path
ROOT=Path.cwd();sys.path.insert(0,str(ROOT/'bin'))
from audit_coastal_export_geometry import compare
from audit_coastal_architecture_finish import triangle_distance
from mathutils import Vector
from mathutils.bvhtree import BVHTree
q=ROOT/'.jekyll-cache/visual-qa/cliff-2026-10-28'
variant='attempt-2-finite'
receipt=json.loads((q/variant/'recipe-receipt.json').read_text())
LO,HI=receipt['boundsNative']
NAMES={'core__golden coastal sandstone','core_liftaway_cave_ceiling','core_liftaway_cave_ceiling_rear','core_retreat_liftaway_roof','core_estate_library_liftaway_roof','core_bathwing_liftaway_roof'}
def array(col,prop,width,dtype):
 a=np.empty(len(col)*width,dtype=dtype);col.foreach_get(prop,a);return a.tobytes()
def mesh_hash(m):
 h=hashlib.sha256()
 for col,prop,w,d in [(m.vertices,'co',3,np.float32),(m.edges,'vertices',2,np.int32),(m.loops,'vertex_index',1,np.int32),(m.polygons,'loop_start',1,np.int32),(m.polygons,'loop_total',1,np.int32),(m.polygons,'material_index',1,np.int32),(m.polygons,'use_smooth',1,np.bool_),(m.corner_normals,'vector',3,np.float32)]:h.update(array(col,prop,w,d))
 for a in m.attributes:
  h.update((a.name+a.domain+a.data_type).encode())
  if a.data_type in ['FLOAT','INT','BOOLEAN']:h.update(array(a.data,'value',1,np.float32 if a.data_type=='FLOAT' else np.int32))
  elif a.data_type=='FLOAT_VECTOR':h.update(array(a.data,'vector',3,np.float32))
  elif a.data_type in ['FLOAT_COLOR','BYTE_COLOR']:h.update(array(a.data,'color',4,np.float32))
  elif a.data_type=='FLOAT2':h.update(array(a.data,'vector',2,np.float32))
  elif a.data_type=='INT32_2D':h.update(array(a.data,'value',2,np.int32))
  else:h.update(str([tuple(v.value) if hasattr(v,'value') and not isinstance(v.value,(float,int,bool)) else str(v) for v in a.data]).encode())
 h.update(str([x.name if x else None for x in m.materials]).encode());h.update(str(getattr(m.color_attributes.active_color,'name',None)).encode())
 return h.hexdigest()
def props(o):return json.dumps({'matrix':[list(v) for v in o.matrix_world],'parent':o.parent.name if o.parent else None,'data':o.data.name if o.data else None,'properties':dict(o.items()),'hideRender':o.hide_render,'hideViewport':o.hide_viewport},sort_keys=True,default=str)
def snapshot(path):
 bpy.ops.wm.open_mainfile(filepath=str(path))
 result={'objects':{},'targets':{},'materials':{}}
 for o in bpy.context.scene.objects:
  result['objects'][o.name]={'type':o.type,'props':props(o),'mesh':mesh_hash(o.data) if o.type=='MESH' else None}
  if o.name not in NAMES:continue
  m=o.data;m.calc_loop_triangles();pts=[tuple(o.matrix_world@v.co) for v in m.vertices];ns=[tuple(v.vector) for v in m.corner_normals];a=m.color_attributes.active_color
  colors=[tuple(v.color) for v in a.data] if a else None
  fs=[]
  for t in m.loop_triangles:
   if t.area<1e-12:continue
   fs.append({'p':[pts[i] for i in t.vertices],'n':[ns[i] for i in t.loops],'c':[(colors[j] if a.domain=='CORNER' else colors[i]) if colors else (1.,1.,1.,1.) for i,j in zip(t.vertices,t.loops)],'m':m.materials[t.material_index].name})
  bm=bmesh.new();bm.from_mesh(m);nonmanifold=sum(not e.is_manifold for e in bm.edges);bm.free()
  result['targets'][o.name]={'triangles':fs,'nonmanifold':nonmanifold,'activeColor':getattr(a,'name',None)}
 for m in bpy.data.materials:
  result['materials'][m.name]={'diffuse':list(m.diffuse_color),'roughness':m.roughness,'metallic':m.metallic,'nodes':[(n.name,n.bl_idname,[(s.name,list(s.default_value) if hasattr(s.default_value,'__len__') and not isinstance(s.default_value,str) else str(s.default_value)) for s in n.inputs if hasattr(s,'default_value')]) for n in m.node_tree.nodes] if m.use_nodes else None,'links':[(l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name) for l in m.node_tree.links] if m.use_nodes else None}
 return result
def mix(a,b,t):return {k:tuple(a[k][i]*(1-t)+b[k][i]*t for i in range(len(a[k]))) for k in ['p','n','c']}
def clip(poly,axis,value,sign):
 out=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  da=(a['p'][axis]-value)*sign;db=(b['p'][axis]-value)*sign
  if da>=0:out.append(a)
  if (da<0)!=(db<0):out.append(mix(a,b,da/(da-db)))
 return out
def outside(snapshot):
 result=[]
 for f in snapshot['triangles']:
  poly=[{k:f[k][i] for k in ['p','n','c']} for i in range(3)]
  pieces=[]
  for axis,value,sign in [(k,LO[k],1) for k in range(3)]+[(k,HI[k],-1) for k in range(3)]:
   if not poly:break
   outer=clip(poly,axis,value,-sign)
   if len(outer)>=3:pieces.append(outer)
   poly=clip(poly,axis,value,sign)
  for piece in pieces:
   for i in range(1,len(piece)-1):
    tri=[piece[0],piece[i],piece[i+1]]
    a,b,c=[np.array(p['p']) for p in tri]
    if np.linalg.norm(np.cross(b-a,c-a))<1e-12:continue
    result.append({**{k:[p[k] for p in tri] for k in ['p','n','c']},'m':f['m']})
 return {'triangles':result}
before=snapshot(q/'baseline/source.blend');after=snapshot(q/variant/'candidate.blend')
changed=[n for n in before['objects'] if before['objects'][n]!=after['objects'].get(n)]
report={'sourceSha256':hashlib.sha256((q/'baseline/source.blend').read_bytes()).hexdigest(),'candidateSha256':hashlib.sha256((q/variant/'candidate.blend').read_bytes()).hexdigest(),'changedObjects':changed,'unrelatedExact':all(before['objects'][n]==after['objects'].get(n) for n in before['objects'] if n not in NAMES),'objectRosterExact':set(before['objects'])==set(after['objects']),'materialsExact':before['materials']==after['materials'],'outsideBoundsNative':[LO,HI],'targets':{}}
report['objectCount']=len(before['objects']);report['materialCount']=len(before['materials'])
report['unrelatedFingerprints']={}
for version,data in [('baseline',before),('candidate',after)]:
 unrelated={name:row for name,row in data['objects'].items() if name not in NAMES}
 report['unrelatedFingerprints'][version]={'objects':len(unrelated),'sha256':hashlib.sha256(json.dumps(unrelated,sort_keys=True).encode()).hexdigest(),'materialsSha256':hashlib.sha256(json.dumps(data['materials'],sort_keys=True).encode()).hexdigest()}
print('SCOPE',changed,'unrelated',report['unrelatedExact'],'materials',report['materialsExact'],flush=True)
def geometry_control(source,target):
 exact={tuple(sorted(f['p'])) for f in target['triangles']}
 verts=[p for f in target['triangles'] for p in f['p']]
 tree=BVHTree.FromPolygons(verts,[tuple(range(i,i+3)) for i in range(0,len(verts),3)],all_triangles=True)
 coords=np.asarray([f['p'] for f in target['triangles']],dtype=np.float64);low,high=coords.min(axis=1),coords.max(axis=1)
 result={'triangles':len(source['triangles']),'samples':0,'exactPositionTriangles':0,'maximumProbedBVHSurfaceDistanceM':0.,'failureCount':0,'failures':[]}
 for f in source['triangles']:
  if tuple(sorted(f['p'])) in exact:result['exactPositionTriangles']+=1;result['samples']+=7;continue
  for w in [(1,0,0),(0,1,0),(0,0,1),(.5,.5,0),(0,.5,.5),(.5,0,.5),(1/3,1/3,1/3)]:
   p=tuple(sum(w[i]*f['p'][i][k] for i in range(3)) for k in range(3));near=tree.find_nearest(Vector(p));d=triangle_distance(p,target['triangles'][near[2]]['p'])
   if d>3e-6:
    v=np.asarray(p);candidates=np.flatnonzero(np.all(low<=v+3e-6,axis=1)&np.all(high>=v-3e-6,axis=1))
    for i in candidates:d=min(d,triangle_distance(p,target['triangles'][int(i)]['p']))
   result['samples']+=1;result['maximumProbedBVHSurfaceDistanceM']=max(result['maximumProbedBVHSurfaceDistanceM'],d)
   if d>3e-6:
    result['failureCount']+=1
    if len(result['failures'])<12:result['failures'].append({'point':p,'distanceToBVHNearestM':d})
 return result
for name in sorted(NAMES):
 a,b=before['targets'][name],after['targets'][name]
 # Check every wholly outside triangle's corner fields directly, even if a
 # quantization mismatch would make a general closest-field search expensive.
 def keys(f):return tuple(sorted(f['p']))
 index={}
 for face in b['triangles']:index.setdefault(keys(face),[]).append(face)
 optical={'exactPositionTriangles':0,'maximumNormalError':0.,'maximumColorError':0.,'fieldFailures':0,'witnesses':[]}
 for face in a['triangles']:
  if not any(all(p[k]<LO[k]-1e-6 for p in face['p']) or all(p[k]>HI[k]+1e-6 for p in face['p']) for k in range(3)):continue
  candidates=index.get(keys(face),[])
  if not candidates:continue
  errors=[]
  for f in candidates:
   mapping=[f['p'].index(p) for p in face['p']]
   ne=max(math.dist(face['n'][i],f['n'][mapping[i]]) for i in range(3));ce=max(max(abs(v-w) for v,w in zip(face['c'][i],f['c'][mapping[i]])) for i in range(3));errors.append((ne,ce))
  ne,ce=min(errors,key=lambda row:max(row[0]/1e-6,row[1]/1e-7));optical['exactPositionTriangles']+=1
  optical['maximumNormalError']=max(optical['maximumNormalError'],ne);optical['maximumColorError']=max(optical['maximumColorError'],ce)
  if ne>1e-6 or ce>1e-7:
   optical['fieldFailures']+=1
   if len(optical['witnesses'])<5:optical['witnesses'].append({'point':face['p'][0],'normalError':ne,'colorError':ce})
 print(name,'exact outside optical',optical['fieldFailures'],optical['maximumNormalError'],flush=True)
 forward=geometry_control(outside(a),b);reverse=geometry_control(outside(b),a)
 report['targets'][name]={'nonmanifold':[a['nonmanifold'],b['nonmanifold']],'activeColor':[a['activeColor'],b['activeColor']],'outsideSourceToCandidate':forward,'outsideCandidateToSource':reverse,'outsideExactTriangleFields':optical}
 print(name,'outside failures',forward['failureCount'],reverse['failureCount'],'distance',forward['maximumProbedBVHSurfaceDistanceM'],reverse['maximumProbedBVHSurfaceDistanceM'],flush=True)
 (q/variant/'scope-audit.json').write_text(json.dumps(report,indent=2)+'\n')
