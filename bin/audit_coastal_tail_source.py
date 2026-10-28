"""Read-only Lizard zero-target and local-port source controls.

Use --candidate=<trial.blend> --out=<receipt.json> with exact Blender4.5.9.
The declared rear-port box is diagnostic; changes outside it are reported.
"""
from pathlib import Path
import json,sys,hashlib
import bpy
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"bin"))
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"artwork/coastal-home/reviews/tail-anatomy-2026-10-28/source-v22"))
from coastal_tail_corrective import action_digest
ROOT=Path(__file__).resolve().parents[1]
opts={x[2:].split('=',1)[0]:x.split('=',1)[1] for x in sys.argv if x.startswith('--') and '=' in x}
BASELINE=Path(opts.get('baseline',str(ROOT/'artwork/coastal-home/character-finish.blend'))).resolve()
CANDIDATE=Path(opts['candidate']).resolve()
OUTPUT=Path(opts['out']).resolve()
ANATOMICAL=opts.get('anatomical')=='1'
def snapshot(source):
 bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.window.scene=next(s for s in bpy.data.scenes if s.get('finishAvatar')=='lizard')
 arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 for o in arm.children:
  if o.type=='MESH' and o.data.shape_keys:
   for name in ('SeatedDrape','MidRollDrape','TailPortDrape'):
    key=o.data.shape_keys.key_blocks.get(name)
    if key:key.value=0
 def key(o,v):
  return json.dumps([list(o.matrix_world@v.co),sorted((o.vertex_groups[g.group].name,g.weight) for g in v.groups)],separators=(',',':'))
 values={};geometry={};skin_faces=[];cloth_points=[];cloth_faces=[];port_boxes=[]
 bone_data={b.name:[b.parent.name if b.parent else None,[list(r) for r in b.matrix_local]] for b in arm.data.bones}
 rig=hashlib.sha256(json.dumps([(name,*data) for name,data in bone_data.items()]).encode()).hexdigest();actions=action_digest(arm)
 for o in arm.children:
  if o.type!='MESH':continue
  if o.get('tailPortPatchBounds'):
   from mathutils import Vector
   port_boxes.append([list(o.matrix_world@Vector(corner)) for corner in o['tailPortPatchBounds']])
  skin={i for p in o.data.polygons if o.data.materials[p.material_index].get('finishCanonicalName',o.data.materials[p.material_index].name)=='skin' for i in p.vertices}
  excluded=set()
  if ANATOMICAL:
   if o.get('tailArticulation'):excluded=set(skin)
   else:excluded={v.index for v in o.data.vertices if any(o.vertex_groups[g.group].name.startswith('Tail') and g.weight>0 for g in v.groups)}
   skin-=excluded
  for i in skin:geometry[key(o,o.data.vertices[i])]=None
  for face in o.data.polygons:
   material=o.data.materials[face.material_index].get('finishCanonicalName',o.data.materials[face.material_index].name)
   if material=='skin' and not (ANATOMICAL and any(i in excluded for i in face.vertices)):
    corners=[(list(o.matrix_world@o.data.vertices[o.data.loops[i].vertex_index].co),list(o.data.corner_normals[i].vector)) for i in face.loop_indices]
    rotations=[corners[i:]+corners[:i] for i in range(len(corners))];skin_faces.append(min(json.dumps(x,separators=(',',':')) for x in rotations))
  o.data.calc_loop_triangles();offset=len(cloth_points);cloth_points.extend(list(o.matrix_world@v.co) for v in o.data.vertices)
  for triangle in o.data.loop_triangles:
   material=o.data.materials[triangle.material_index].get('finishCanonicalName',o.data.materials[triangle.material_index].name)
   if material in ('Sirui shirt','charcoal shorts'):cloth_faces.append(tuple(offset+i for i in triangle.vertices))
 for clip in ('idle','walk','lounge','typing','sleep'):
  for t in arm.animation_data.nla_tracks:t.mute=t.name!=clip
  bpy.context.scene.frame_set(49)
  graph=bpy.context.evaluated_depsgraph_get();v={}
  for o in arm.children:
   if o.type!='MESH':continue
   ev=o.evaluated_get(graph);me=ev.to_mesh()
   for original,posed in zip(o.data.vertices,me.vertices):
    k=key(o,original)
    if k in geometry:v[k]=list(ev.matrix_world@posed.co)
   ev.to_mesh_clear()
  values[clip]=v
 return {'skinKeys':sorted(geometry),'skinCornerNormalsSha256':hashlib.sha256(json.dumps(sorted(skin_faces)).encode()).hexdigest(),'rig':rig,'boneData':bone_data,'actions':actions,'evaluated':values,'clothPoints':cloth_points,'clothFaces':cloth_faces,'portBoxes':port_boxes}
before=snapshot(BASELINE)
after=snapshot(CANDIDATE)
rows={}
for clip,v in before['evaluated'].items():
 a=after['evaluated'][clip];missing=[k for k in v if k not in a];errors=sorted([(sum((x-y)**2 for x,y in zip(p,a[k]))**.5,k,p,a[k]) for k,p in v.items() if k in a],reverse=True)
 rows[clip]={'maximumPositionErrorM':errors[0][0],'missing':len(missing),'worst':[errors[i] for i in range(3)]}
out={'originalRigBindExact':before['rig']==after['rig'],'original14ClipChannelsExact':before['actions']==after['actions'],'originalSkinCornerNormalsExact':before['skinCornerNormalsSha256']==after['skinCornerNormalsSha256'],'skinCornerNormalSha256':[before['skinCornerNormalsSha256'],after['skinCornerNormalsSha256']],'beforeSkinVertices':len(before['skinKeys']),'afterSkinVertices':len(after['skinKeys']),'exactBindAndWeights':before['skinKeys']==after['skinKeys'],'poses':rows}
out['anatomicalCohort']=ANATOMICAL
out['originalNamedBoneBindExact']=all(after['boneData'].get(name)==value for name,value in before['boneData'].items())
out['boneCounts']=[len(before['boneData']),len(after['boneData'])]
def cloth_change(source,target):
 tree=BVHTree.FromPolygons(target['clothPoints'],target['clothFaces'],all_triangles=True)
 changed=[];outside=[];maximum=0;outside_probe_count=0;outside_probe_max=0;outside_probe_witnesses=[];exact_vertex_probes=0;exact_triangle_probes=0
 referenced_vertices={tuple(target['clothPoints'][i]) for face in target['clothFaces'] for i in face}
 referenced_triangles={tuple(sorted(tuple(target['clothPoints'][i]) for i in face)) for face in target['clothFaces']}
 from mathutils import Vector
 for face in source['clothFaces']:
  points=[Vector(source['clothPoints'][i]) for i in face];center=sum(points,Vector())/3
  probes=points+[(points[i]+points[(i+1)%3])/2 for i in range(3)]+[center]
  distances=[]
  same_triangle=tuple(sorted(tuple(p) for p in points)) in referenced_triangles
  for p in probes:
   if same_triangle:distances.append(0.);exact_triangle_probes+=1
   elif tuple(p) in referenced_vertices:distances.append(0.);exact_vertex_probes+=1
   else:distances.append(tree.find_nearest(p)[3])
  distance=max(distances);maximum=max(maximum,distance)
  for p,d in zip(probes,distances):
   if not after['portBoxes'] or any(all(lo[k]-3e-6<=p[k]<=hi[k]+3e-6 for k in range(3)) for lo,hi in after['portBoxes']):continue
   outside_probe_max=max(outside_probe_max,d)
   if d>3e-6:
    outside_probe_count+=1
    if len(outside_probe_witnesses)<4:outside_probe_witnesses.append({'position':list(p),'distanceM':d})
  if distance>3e-6:
   area=(points[1]-points[0]).cross(points[2]-points[0]).length/2
   row={'nativeCenter':list(center),'areaM2':area,'distanceM':distance};changed.append(row)
   if not(-.16<=center.x<=.30 and 0<=center.y<=.20 and .68<=center.z<=1.15):outside.append(row)
 return {'triangleProbeCount':len(source['clothFaces'])*7,'exactReferencedTriangleProbes':exact_triangle_probes,'exactReferencedVertexProbes':exact_vertex_probes,'changedTriangleAreaM2':sum(x['areaM2'] for x in changed),'changedTriangles':len(changed),'maximumSurfaceDistanceM':maximum,'changedAreaOutsideDeclaredRearPortM2':sum(x['areaM2'] for x in outside),'outsideWitnesses':sorted(outside,key=lambda x:-x['distanceM'])[:4],'actualCandidatePortBoxesNative':after['portBoxes'],'outsideActualBoxProbeChanges':outside_probe_count,'outsideActualBoxMaximumDistanceM':outside_probe_max,'outsideActualBoxProbeWitnesses':outside_probe_witnesses}
out['clothSourceToTrial']=cloth_change(before,after)
out['clothTrialToSource']=cloth_change(after,before)
out['sourceSha256']=hashlib.sha256((BASELINE).read_bytes()).hexdigest()
out['candidateSha256']=hashlib.sha256((CANDIDATE).read_bytes()).hexdigest()
out['scope']='Exact original skin/rig/actions and five sampled zero-corrective skin poses. Cloth locality is a rest-surface control: exact referenced triangles/vertices first, then seven finite surface probes per remaining triangle. Posed cloth locality and full contact remain separate gates.'
if ANATOMICAL:out['scope']='Original-person Skin cohort excluding only the original tail component and new explicitly tagged pelvic/tail component. All head/hands/feet/neck/forearm/shin Skin remains in the exact vertex/weight/normal and posed controls. New anatomical topology and seven bones are allowed. Whole new component contact/self-contact is a separate required gate; this is not a contact exclusion.'
out['toolLfSha256']=hashlib.sha256(Path(__file__).read_bytes().replace(b'\r\n',b'\n')).hexdigest()
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
OUTPUT.write_text(json.dumps(out,indent=2)+'\n',encoding='utf8');print(json.dumps(out),flush=True)
