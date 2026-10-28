"""Read-only full-tail native contact controls for an isolated trial."""
import sys,json,hashlib
from pathlib import Path
import bpy,numpy as np,bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'bin'))
from audit_coastal_overlaps import segments,is_inside
opts={s[2:].split('=',1)[0]:s.split('=',1)[1] for s in sys.argv if s.startswith('--') and '=' in s}
source=ROOT/opts.get('source','artwork/coastal-home/character-finish.blend')
bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.window.scene=next(s for s in bpy.data.scenes if s.get('finishAvatar')=='lizard')
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');tail=next((o for o in arm.children if o.get('tailCorrective') or o.get('tailArticulation')),None)
anatomical=bool(tail and tail.get('tailArticulation'))
ring_sides=int(tail['tailArticulation']['ringSides']) if anatomical else 16
attachment_vertices=ring_sides*3
fixtures=[]
house=Path(opts.get('house-models',str(ROOT/'assets/models/home')))
index=json.loads((house/'furniture/index.json').read_text())
for label,item,shift in [('whiskey','whiskey-loveseat',(.28,-.0187,-.0533)),('banquette','banquette',(-.3165,.4379,-.0533)),('cloud','cloud-sofa',(1.045,1.1542,-.0733)),('dining','dining-chair',(0,-.0054,-.0433))]:
 entry=max(index['items'][item]['lods'],key=lambda x:x['triangles']);file=house/'furniture'/entry['file'];before=set(bpy.data.objects)
 bpy.ops.import_scene.gltf(filepath=str(file));parts={'soft':([],[]),'hard':([],[])}
 for o in set(bpy.data.objects)-before:
  if o.type!='MESH':continue
  kind='soft' if any(x in (o.active_material.name if o.active_material else '').lower() for x in ('linen','leather','boucle','velvet','cushion','textile','cotton')) else 'hard'
  vs,fs=parts[kind];base=len(vs);vs.extend(o.matrix_world@v.co for v in o.data.vertices);fs.extend(tuple(base+i for i in p.vertices) for p in o.data.polygons)
 fixtures.append((label,{k:BVHTree.FromPolygons(v,f) for k,(v,f) in parts.items() if f},Vector(shift),{'file':str(file),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}))
rows=[]
for clip in [t.name for t in arm.animation_data.nla_tracks]:
 for t in arm.animation_data.nla_tracks:t.mute=t.name!=clip

 strip=next(t for t in arm.animation_data.nla_tracks if t.name==clip).strips[0]
 count=int(opts.get('samples','13'))
 for frame in [strip.frame_start+(strip.frame_end-strip.frame_start)*j/(count-1) for j in range(count)]:
  bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame))
  graph=bpy.context.evaluated_depsgraph_get()
  body_points=[];parts={x:[] for x in ('skin','Sirui shirt','charcoal shorts')};tp=[];tf=[]
  for o in arm.children:
   if o.type!='MESH' or o is tail:continue
   ev=o.evaluated_get(graph);me=ev.to_mesh();me.calc_loop_triangles();offset=len(body_points);ps=[ev.matrix_world@v.co for v in me.vertices];body_points+=ps
   tail_ids={v.index for v in o.data.vertices if sum(g.weight for g in v.groups if o.vertex_groups[g.group].name.startswith('Tail'))>.5} if not tail else set()
   if tail_ids:
    tmap={i:len(tp)+n for n,i in enumerate(sorted(tail_ids))};tp += [ps[i] for i in sorted(tail_ids)]
    tf += [tuple(tmap[i] for i in t.vertices) for t in me.loop_triangles if set(t.vertices)<=tail_ids]
   for t in me.loop_triangles:
    name=me.materials[t.material_index].get('finishCanonicalName',me.materials[t.material_index].name)
    if name in parts and not set(t.vertices)<=tail_ids:parts[name].append(tuple(offset+i for i in t.vertices))
   ev.to_mesh_clear()
  for alpha in ((0,.25,.5,.75,1) if not anatomical and clip in ('lounge','typing','reading','eat','drink') else (0,)):
   if tail:
    if not anatomical:tail.data.shape_keys.key_blocks['SeatedDrape'].value=alpha
    bpy.context.view_layer.update()
    for garment in arm.children:
     definition=garment.get('tailPortCorrective')
     if definition:garment.data.shape_keys.key_blocks[definition['morph']].value=alpha
    bpy.context.view_layer.update()
    ev=tail.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();me.calc_loop_triangles();tp=[ev.matrix_world@v.co for v in me.vertices];tf=[tuple(t.vertices) for t in me.loop_triangles];ev.to_mesh_clear()
   tree=BVHTree.FromPolygons(tp,tf,all_triangles=True);ta=np.array(tp,dtype=np.float64)[np.array(tf)];r={'clip':clip,'frame':frame,'weight':alpha,'cloth':{},'furniture':{}}
   for name,faces in parts.items():
    other=BVHTree.FromPolygons(body_points,faces,all_triangles=True);pairs=tree.overlap(other);length=0;attachment_length=0;inside=[];inside_attachment=0;witnesses=[]
    if pairs:
     a,b,dist,plane=segments(ta[[i for i,j in pairs]],np.array(body_points,dtype=np.float64)[np.array(faces)[[j for i,j in pairs]]]);length=float(dist[dist>1e-6].sum())
     attachment_length=float(sum(d for d,(i,j) in zip(dist,pairs) if d>1e-6 and max(tf[i])<attachment_vertices))
    for at,p in enumerate(tp):
     if is_inside(other,p):
      depth=other.find_nearest(p)[3];inside.append(depth);inside_attachment+=int(at<attachment_vertices)
      if len(witnesses)<4:witnesses.append({'vertex':at,'position':list(p),'depthM':depth})
    r['cloth'][name]={'crossingM':length,'inside':len(inside),'maxDepthM':max(inside,default=0),'firstThreeRingsCrossingM':attachment_length,'firstThreeRingsInside':inside_attachment,'witnesses':witnesses}
   surface=tp+[sum((tp[i] for i in f),Vector())/len(f) for f in tf]
   if clip in ('lounge','typing','reading','eat','drink'):
    for label,trees,shift,binding in fixtures:
     r['furniture'][label]={}
     for kind,tree in trees.items():
      hits=[tree.find_nearest(p+shift)[3] for p in surface if is_inside(tree,p+shift)]
      r['furniture'][label][kind]={'insideSurfaceProbes':len(hits),'maximumDepthM':max(hits,default=0),'rootRingInside':sum(is_inside(tree,p+shift) for p in tp[:ring_sides])}
   rows.append(r)
   print('TAIL',clip,frame,alpha,[(k,v['crossingM']) for k,v in r['cloth'].items()],r['furniture'],flush=True)
scope=f'Every native tail/component triangle against complete posed other Skin/shirt/shorts at{int(opts.get("samples","13"))}frames of all14clips; no attachment exclusion. '+('Anatomical source FK only; no runtime chain correction applied. ' if anatomical else 'Five seated morph weights included. ')+'Actual finest v84 furniture solids use every component vertex and triangle centroid in explicitly retained seating fixtures. Those offsets are diagnostic; actual final controller/contact placement remains a separate required gate. Finite sampled controls, not continuous or public runtime admission.'
out=Path(opts.get('out',str(source.parent/'quick-audit.json')));out.write_text(json.dumps({'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'scope':scope,'anatomicalSourceFK':anatomical,'furnitureBindings':{label:{'nativeAvatarOffset':list(shift),**binding} for label,trees,shift,binding in fixtures},'toolLfSha256':hashlib.sha256(Path(__file__).read_bytes().replace(b'\r\n',b'\n')).hexdigest(),'rows':rows},indent=2)+'\n',encoding='utf8')
