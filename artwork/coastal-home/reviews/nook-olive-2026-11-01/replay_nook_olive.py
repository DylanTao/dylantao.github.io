"""Guarded descendant replay; no whole-room builder or canonical asset write.

Blender4.5.9 --background --python-exit-code1 --python this.py --
--repo-root REPO --source VERIFIED_INPUT --source-sha SHA256 --out NEW_QA_DIR
"""
import bpy,bmesh,json,hashlib,sys,math,numpy as np
from pathlib import Path
from mathutils import Vector
from types import SimpleNamespace
import argparse
parser=argparse.ArgumentParser(description='Replay only the original nook olive blades/petioles and six short branches in a private candidate.')
for name in ['repo-root','source','source-sha','out']:parser.add_argument('--'+name,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else[])
WT=Path(args.repo_root).resolve();source=Path(args.source).resolve();Q=Path(args.out).resolve();qa=(WT/'.jekyll-cache/visual-qa').resolve()
assert bpy.app.version==(4,5,9)
assert Q.is_relative_to(qa)and Q!=qa and not Q.exists(),'Use a new private QA output directory'
assert hashlib.sha256(source.read_bytes()).hexdigest()==args.source_sha.lower(),'Explicit input SHA mismatch'
assert not source.is_relative_to(Q)
sys.path.insert(0,str(WT/'bin'))
from coastal_kitchen import nook_olive_layout,nook_olive_leaf_points,nook_olive_leaf_triangles
from coastal_office import Parts,cylinder
from refresh_coastal_study_hardware import islands
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
Q.mkdir(parents=True)
wood=scene.objects['kitchen__honey ash'];leaf=scene.objects['kitchen__olive leaf'];assert len(leaf.data.polygons)==40 and len(leaf.data.vertices)==160
original=list(scene.objects);old_normals=np.array([n.vector[:] for n in wood.data.corner_normals]);old_codes=np.empty(len(wood.data.loops)*2,dtype=np.int32);wood.data.attributes["custom_normal"].data.foreach_get("value",old_codes);old_colors={o.name:{a.name:np.array([tuple(v.color) for v in a.data]) for a in o.data.color_attributes} for o in [wood,leaf]}
components=islands(wood.data);layout=nook_olive_layout();selected={leaf.name:list(range(160)),wood.name:[]};old=[];used=set()
for k,f in enumerate(leaf.data.polygons):
 assert len(f.vertices)==4
 root=leaf.data.vertices[f.vertices[0]].co.copy();z=-.42+.95+(k%13)*.04
 axis=Vector((-4.72,4.14,-.42+.36)).lerp(Vector((-4.68,4.11,-.42+1.5)),(z-(-.42+.36))/1.14)
 expected=(root+axis)*.5
 choices=[(float((sum((wood.data.vertices[i].co for i in c),Vector())/len(c)-expected).length),c) for c in components if len(c)==6 and not used.intersection(c)]
 distance,ids=min(choices,key=lambda v:v[0]);assert distance<3e-6,(k,distance);used.update(ids);selected[wood.name].extend(ids);old.append((axis,root,ids))
# This control changes only existing leaf/twig coordinates and their owned corner normals.
# Attribute/topology copies below bind every retained original vertex, edge, polygon and colour.
def fingerprint():
 h=hashlib.sha256();details={}
 for o in sorted(original,key=lambda x:x.name):
  h.update(json.dumps({'name':o.name,'matrix':[list(x) for x in o.matrix_world],'props':dict(o.items()),'data':o.data.name if o.data else None},sort_keys=True,default=str).encode())
  if o.type!='MESH':continue
  if o is leaf:continue  # The entire original leaf-only mesh is the owned shape replacement.
  m=o.data;ids=set(selected.get(o.name,[]));loops={l.index for l in m.loops if l.vertex_index in ids}
  h.update(json.dumps({'materials':[a.name if a else None for a in m.materials],'polygons':[(list(f.vertices),f.material_index,f.use_smooth) for f in m.polygons]},sort_keys=True).encode())
  for a in m.attributes:
   h.update(f'{a.name}|{a.domain}|{a.data_type}|{len(a.data)}'.encode())
   if not len(a.data):continue
   for prop in a.data[0].bl_rna.properties:
    if prop.identifier=='rna_type' or prop.type not in ('INT','FLOAT','BOOLEAN'):continue
    w=prop.array_length if getattr(prop,'is_array',False) else 1;v=np.empty(len(a.data)*w,dtype=np.float32 if prop.type=='FLOAT' else np.int32 if prop.type=='INT' else np.bool_);a.data.foreach_get(prop.identifier,v);v=v.reshape((-1,w))
    if o.name in selected and a.name=='position':v[list(ids)]=0
    if o.name in selected and a.name=='custom_normal' and a.domain=='CORNER':v[list(loops)]=0
    body=v.tobytes();h.update(body);details[o.name+"|"+a.name+"|"+prop.identifier]={"sha256":hashlib.sha256(body).hexdigest(),"domain":a.domain,"type":a.data_type,"items":len(a.data)}
 globals()["last_details"]=details
 return h.hexdigest()
before=fingerprint();before_details=last_details.copy();new_normals=old_normals.copy();touched_loops=set()
for k,(axis,root,ids) in enumerate(old):
 n=layout['leaves'][k];base2,root2=n['base'],n['root'];u=(root-axis).normalized();v=(root2-base2).normalized();rotate=u.rotation_difference(v);centre=(axis+root)*.5;centre2=(base2+root2)*.5;ratio=(root2-base2).length/(root-axis).length
 for i in ids:
  d=wood.data.vertices[i].co-centre;axial=u*d.dot(u);wood.data.vertices[i].co=centre2+rotate@(d-axial+axial*ratio)
 for l in wood.data.loops:
  if l.vertex_index in ids:new_normals[l.index]=tuple(rotate@Vector(old_normals[l.index]));touched_loops.add(l.index)
 # Petiole/root transforms retain the original twig topology and finish.
# Rebuild only the original leaf-only owner: eleven vertices/twelve triangles per blade.
old_leaf_attributes=[(a.name,a.domain,a.data_type,np.array([tuple(v.color)for v in a.data]))for a in leaf.data.color_attributes]
old_leaf_values={name:[values[k*4:(k+1)*4].mean(axis=0)for k in range(40)]for name,domain,kind,values in old_leaf_attributes}
bm=bmesh.new()
for definition in layout['leaves']:
 points=nook_olive_leaf_points(definition);assert len(points)==11
 vertices=[bm.verts.new(point)for point in points]
 for indices in nook_olive_leaf_triangles():bm.faces.new([vertices[index]for index in indices])
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(leaf.data);bm.free()
for a in list(leaf.data.color_attributes):leaf.data.color_attributes.remove(a)
for name,domain,kind,values in old_leaf_attributes:
 attr=leaf.data.color_attributes.new(name=name,type=kind,domain='CORNER')
 for f in leaf.data.polygons:
  for loop in f.loop_indices:attr.data[loop].color=old_leaf_values[name][f.index//12]
 leaf.data.color_attributes.active_color=attr
for f in leaf.data.polygons:f.use_smooth=True
wood.data.update();leaf.data.update();wood.data.normals_split_custom_set(new_normals.tolist());codes=np.empty_like(old_codes);wood.data.attributes["custom_normal"].data.foreach_get("value",codes);keep=np.ones(len(wood.data.loops),dtype=bool);keep[list(touched_loops)]=False;codes.reshape((-1,2))[keep]=old_codes.reshape((-1,2))[keep];wood.data.attributes["custom_normal"].data.foreach_set("value",codes);wood.data.update();after=fingerprint();changes={k:{'before':before_details.get(k),'after':last_details.get(k)} for k in set(before_details)|set(last_details) if before_details.get(k)!=last_details.get(k)};(Q/'v4-retained-attribute-differences.json').write_text(json.dumps(changes,indent=2),encoding='utf8');assert before==after,('retained original RNA changed',before,after)
normals=np.array([n.vector[:] for n in wood.data.corner_normals]);untouched=[i for i in range(len(normals)) if i not in touched_loops];normal_error=float(np.abs(normals[untouched]-old_normals[untouched]).max());assert normal_error<=1e-6,normal_error
parts=Parts('kitchen_nook_olive');bm=parts.bm(wood.data.materials[0])
for base,end in layout['branches']:cylinder(bm,tuple(base),tuple(end),.005,6,radius2=.0028)
new=parts.finish();assert len(new)==1;new[0].matrix_world=wood.matrix_world.copy();new[0]['nookPlantBranch']=True
for o in [wood]:
 for a in o.data.color_attributes:assert np.array_equal(old_colors[o.name][a.name],np.array([tuple(v.color) for v in a.data]))
leaf_points=np.array([v.co[:] for v in leaf.data.vertices]);assert np.all(leaf_points.min(axis=0)>[-4.95,3.90,.25]) and np.all(leaf_points.max(axis=0)<[-4.43,4.36,1.20]),leaf_points.tolist()
assert len(leaf.data.vertices)==440 and len(leaf.data.polygons)==480
assert sum(a['branch']is not None for a in layout['leaves'])==36 and sum(a['branch']is None for a in layout['leaves'])==4
face_areas=[f.area for f in leaf.data.polygons];assert min(face_areas)>1e-8
# Every blade is a connected, curved disk with the exact layout root and tip.
curve=[];camber=[];midrib=[]
for k,definition in enumerate(layout['leaves']):
 points=[v.co.copy()for v in leaf.data.vertices[k*11:(k+1)*11]];assert (points[0]-definition['root']).length<1e-6 and(points[-1]-definition['tip']).length<1e-6
 axis=definition['tip']-definition['root'];normal=(points[6]-points[4]).cross(axis).normalized();camber.append(abs((points[5]-definition['root']-axis*.5).dot(normal)));midrib.append(abs((points[5]-(points[4]+points[6])*.5).dot(normal)));curve.append(max(((p-definition['root']).cross(axis)).length/axis.length for p in points))
assert min(curve)>.004 and min(camber)>.0028 and min(midrib)>.0013
# The canopy stays inside the retained pot's 20cm plan radius, below the old trunk crown.
max_radius=max(math.hypot(float(v.co.x+4.72),float(v.co.y-4.14))for v in leaf.data.vertices);assert max_radius<.2
assert leaf_points[:,2].max()<layout['crown'].z
assert hashlib.sha256(source.read_bytes()).hexdigest()==args.source_sha.lower()
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(Q/'candidate.blend'),compress=True)
report={'scope':'Private rounded curved-blade control only, not admission. All original scene/object metadata and all unowned mesh RNA exact; owned leaf-only geometry replaced; original240 petiole vertices moved with owned corner normals; original trunk/pot/unowned wood finish exact.','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'candidateSha256':hashlib.sha256((Q/'candidate.blend').read_bytes()).hexdigest(),'leaves':40,'branchLeaves':sum(a['branch']is not None for a in layout['leaves']),'apexLeaves':sum(a['branch']is None for a in layout['leaves']),'leafVertices':len(leaf.data.vertices),'leafTriangles':len(leaf.data.polygons),'movedTwigVertices':len(selected[wood.name]),'addedBranches':6,'branchTriangles':sum(len(f.vertices)-2 for f in new[0].data.polygons),'outsideOriginalRnaBefore':before,'outsideOriginalRnaAfter':after,'outsideWoodNormalMaxError':normal_error,'leafBounds':[leaf_points.min(axis=0).tolist(),leaf_points.max(axis=0).tolist()],'newObjects':[o.name for o in new],'explicitInputSha256':args.source_sha,'minimumLeafTriangleAreaM2':min(face_areas),'minimumCentrelineCamberM':min(camber),'minimumMidribElevationM':min(midrib),'maximumCanopyPlanRadiusM':max_radius,'owningHelperSha256':hashlib.sha256((WT/'bin/coastal_kitchen.py').read_bytes()).hexdigest(),'next':'Coordinator combines verified source, performs native colour bake and final room export/cache/complete public QA. This replay does not sign or publish.'}
(Q/'REPLAY.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print(json.dumps(report))
