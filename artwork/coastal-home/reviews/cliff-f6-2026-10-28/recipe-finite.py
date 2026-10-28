"""One bounded F6 experiment on the immutable v84 native source; no canonical save."""
import hashlib,json,math,sys
from pathlib import Path
import bpy,bmesh
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
ROOT=Path.cwd();sys.path.insert(0,str(ROOT/'bin'))
from coastal_cliff_finish import triangulate_actual_render_faces
from coastal_landscape import top_height
QA=ROOT/'.jekyll-cache/visual-qa/cliff-2026-10-28'
SOURCE=QA/'baseline/source.blend';OUT=QA/'attempt-2-finite';OUT.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()=='4aaa7a66626af86d1c10ff021fda6a52e97e46caed3fad1e39c9e0173617d681'
assert bpy.app.version==(4,5,9)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
NAMES={'core__golden coastal sandstone','core_liftaway_cave_ceiling','core_liftaway_cave_ceiling_rear','core_retreat_liftaway_roof','core_estate_library_liftaway_roof','core_bathwing_liftaway_roof'}
targets=[o for o in bpy.context.scene.objects if o.name in NAMES]
verts=[];faces=[]
for obj in targets:
 offset=len(verts);obj.data.calc_loop_triangles();verts.extend(obj.matrix_world@v.co for v in obj.data.vertices)
 faces.extend(tuple(offset+i for i in f.vertices) for f in obj.data.loop_triangles)
tree=BVHTree.FromPolygons(verts,faces,all_triangles=True)
LO=Vector((-22,-12,5.9));HI=Vector((17,19,14.35))
from coastal_architecture_finish import components
protect=[]
for obj in bpy.context.scene.objects:
 if obj.type!='MESH':continue
 if obj.name=='core__blue sage agave leaf' or obj.get('roofPlanting') or obj.get('flora') or obj.name.startswith('core_flora_'):
  bm=bmesh.new();bm.from_mesh(obj.data)
  for island in components(bm):
   ps=[obj.matrix_world@v.co for v in island];low=min(p.z for p in ps)
   roots=[p for p in ps if p.z<low+.015];root=sum(roots,Vector())/len(roots)
   rosette=obj.name=='core__blue sage agave leaf' or obj.get('roofPlanting')
   hit=tree.ray_cast(Vector((root.x,root.y,30)),Vector((0,0,-1)),60)[0]
   if not rosette and (hit is None or abs(root.z-hit.z)>.15):continue
   if LO.x-3<root.x<HI.x+3 and LO.y-3<root.y<HI.y+3 and root.z>LO.z-.2:
    protect.append({'kind':'complete-rosette-root' if rosette else 'retained-flora-root','center':list(root),'inner':.70 if rosette else .10,'outer':3.4 if rosette else .65})
  bm.free()
perches=json.loads((QA/'baseline/models/wildlife-perch-support.json').read_text())
for patch in perches['patches']:
 p=patch.get('nativeOrigin',patch['origin']);center=Vector((p[0],-p[2],p[1]))
 if LO.x-3<center.x<HI.x+3 and LO.y-3<center.y<HI.y+3 and center.z>LO.z-.2:
  protect.append({'kind':'retained-wildlife-patch','id':patch['id'],'center':list(center),'inner':1.35,'outer':2.8})
# The chimney's actual contact footprint and the door/window/upper structure remain fixed.
for name in ['core_fireplace_cap__golden coastal sandstone']:
 obj=bpy.context.scene.objects.get(name)
 if obj:
  points=[obj.matrix_world@v.co for v in obj.data.vertices]
  center=sum(points,Vector())/len(points)
  protect.append({'kind':'retained-chimney-cap','center':list(center),'inner':1.5,'outer':3.2})
unique={}
for pin in protect:
 key=tuple(round(v/.04) for v in pin['center'])
 if key not in unique or pin['inner']>unique[key]['inner']:unique[key]=pin
protect=list(unique.values())
pin_trees=[]
for indices in [[i for i,p in enumerate(protect) if p['outer']<=.65],[i for i,p in enumerate(protect) if p['outer']>.65]]:
 if not indices:continue
 pins=KDTree(len(indices))
 for i in indices:pins.insert(Vector(protect[i]['center']),i)
 pins.balance();pin_trees.append((pins,max(protect[i]['outer'] for i in indices)))
print('PROTECTED CONTACTS',len(protect),flush=True)
def ease(v):
 t=max(0.,min(1.,v));return t*t*(3-2*t)
def inside(p):return all(LO[k]-1e-6<=p[k]<=HI[k]+1e-6 for k in range(3))
def velocity(p):
 x,y,z=p
 if not inside(p):return Vector()
 edge=ease((x-LO.x)/4)*ease((HI.x-x)/4)*ease((y-LO.y)/3)*ease((HI.y-y)/4)
 if not edge:return Vector()
 # Only actual retained supports are pinned; unoccupied upper rock can become a landform.
 weight=edge*ease((z-5.9)/1.3)*ease((HI.z-z)/1.3)*ease((abs(x)-5.9)/2.6)
 for pins,radius in pin_trees:
  for center,index,d in pins.find_range(p,radius):
   pin=protect[index]
   weight*=ease((d-pin['inner'])/(pin['outer']-pin['inner']))
   if weight<1e-10:return Vector()
 if not weight:return Vector()
 # Two broad drainage recesses and a flared throat erode the entire flank.
 # Meter-scale massing, not high-frequency surface noise or added boulders.
 gully=math.exp(-((y-4.8)/3.4)**2)+.70*math.exp(-((y-11.6)/2.8)**2)
 side=ease((abs(x)-5.5)/4)
 return Vector((math.tanh(x/7.5)*weight*(.85+1.55*gully),-.8*weight*(.7+.3*math.cos(x*.3+z*.6)),-.65*weight*gully*side))
def warp(p):
 # Integrate a stationary, pinned velocity field. This avoids the fold that a
 # single large displacement could create around a contact-protection boundary.
 point=p.copy()
 for step in range(12):point+=velocity(point)*.8/12
 return point
def jacobian(p):
 columns=[]
 for axis in range(3):
  d=Vector();d[axis]=.001
  columns.append((warp(p+d)-warp(p-d))/.002)
 return Matrix(columns).transposed()
receipts=[];total_added=0
for obj in targets:
 mesh=obj.data;mesh.calc_loop_triangles();before_tri=len(mesh.loop_triangles)
 bm=bmesh.new();bm.from_mesh(mesh);bm.faces.ensure_lookup_table();bm.verts.ensure_lookup_table()
 layer=bm.loops.layers.float_vector.new('F6 retained absolute source normal')
 for face in mesh.polygons:
  for loop,index in zip(bm.faces[face.index].loops,face.loop_indices):loop[layer]=mesh.corner_normals[index].vector
 before_open=sum(not e.is_manifold for e in bm.edges)
 explicit=triangulate_actual_render_faces(bm,mesh,LO,HI,all_quads=True)
 # Split the real source surface at all six finite boundaries first. Moving
 # an inside vertex on an unsplit triangle would also move its outside part.
 for axis in range(3):
  for value in [LO[axis],HI[axis]]:
   selected=set()
   for face in bm.faces:
    ps=[obj.matrix_world@v.co for v in face.verts]
    if min(p[axis] for p in ps)>value+1e-7 or max(p[axis] for p in ps)<value-1e-7:continue
    if all(max(p[k] for p in ps)>=LO[k]-1e-6 and min(p[k] for p in ps)<=HI[k]+1e-6 for k in range(3) if k!=axis):selected.add(face)
   selected.update(link for f in list(selected) for e in f.edges for link in e.link_faces)
   edges={e for f in selected for e in f.edges};vs={v for e in edges for v in e.verts}
   point=Vector();point[axis]=value;normal=Vector();normal[axis]=1
   bmesh.ops.bisect_plane(bm,geom=list(vs)+list(edges)+list(selected),dist=1e-7,plane_co=point,plane_no=normal,clear_inner=False,clear_outer=False)
 inverse=obj.matrix_world.inverted();subdivided=0
 for iteration in range(5):
  edges=[]
  for edge in bm.edges:
   if edge.calc_length()<=1.0:continue
   points=[obj.matrix_world@v.co for v in edge.verts];mid=(points[0]+points[1])*.5
   if not inside(mid):continue
   if any((warp(p)-p).length>1e-7 for p in points+[mid]):edges.append(edge)
  if not edges:break
  subdivided+=len(edges);bmesh.ops.subdivide_edges(bm,edges=edges,cuts=1,use_grid_fill=True)
 original={v:obj.matrix_world@v.co for v in bm.verts}
 transforms={};moved=0;maximum=0.;minimum=1.
 for vertex,point in original.items():
  after=warp(point);distance=(after-point).length
  if distance<=1e-7:continue
  J=jacobian(point);minimum=min(minimum,J.determinant())
  transforms[vertex]=J.inverted().transposed();vertex.co=inverse@after
  moved+=1;maximum=max(maximum,distance)
 if minimum<=0:raise RuntimeError(f'Fold in {obj.name}: {minimum}')
 if not moved:
  bm.free()
  receipts.append({'mesh':obj.name,'beforeTriangles':before_tri,'afterTriangles':before_tri,'addedTriangles':0,'movedVertices':0,'unchangedNativeMesh':True})
  continue
 bm.normal_update()
 for face in bm.faces:
  for loop in face.loops:
   normal=loop[layer]
   if loop.vert in transforms:normal=(transforms[loop.vert]@normal).normalized()
   loop[layer]=normal
 after_open=sum(not e.is_manifold for e in bm.edges)
 if after_open!=before_open:raise RuntimeError((obj.name,'new open edges',before_open,after_open))
 bm.to_mesh(mesh);bm.free();mesh.update()
 attribute=mesh.attributes['F6 retained absolute source normal']
 # Retain the intended float field as readback evidence; Blender's native
 # relative-short normal codec is independently measured after this set.
 wanted=[tuple(v.vector) for v in attribute.data]
 mesh.normals_split_custom_set(wanted)
 native_error=max((Vector(a)-b.vector).length for a,b in zip(wanted,mesh.corner_normals))
 mesh.calc_loop_triangles();added=len(mesh.loop_triangles)-before_tri;total_added+=added
 receipts.append({'mesh':obj.name,'beforeTriangles':before_tri,'afterTriangles':len(mesh.loop_triangles),'addedTriangles':added,'explicitLocalSourcePolygons':explicit,'subdividedEdges':subdivided,'movedVertices':moved,'maximumDisplacementM':maximum,'minimumSampledJacobian':minimum,'tightCompressionNeedsReview':minimum<.15,'maximumNativeVsIntendedSplitNormalError':native_error,'nonmanifoldBefore':before_open,'nonmanifoldAfter':after_open,'activeColor':getattr(mesh.color_attributes.active_color,'name',None)})
 print(receipts[-1],flush=True)
if total_added>14396:raise RuntimeError(f'Exceeded immutable static potential headroom: {total_added}')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'candidate.blend'),compress=True)
report={'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'candidateSha256':hashlib.sha256((OUT/'candidate.blend').read_bytes()).hexdigest(),'boundsNative':[list(LO),list(HI)],'protectedContacts':protect,'addedNativeTriangles':total_added,'maximumPotentialBeforeExportCompaction':735604+total_added,'meshes':receipts,'scope':'Second coordinated contour, not admission. Same-source render, exact unrelated scope, outside surface/fields, shared-boundary, overlap, contacts, decoded budgets and runtime flight checks still required.'}
(OUT/'recipe-receipt.json').write_text(json.dumps(report,indent=2)+'\n')
