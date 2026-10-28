"""One bounded F6 experiment on the immutable v84 native source; no canonical save."""
import hashlib,json,math,sys
from pathlib import Path
import bpy,bmesh
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path.cwd();sys.path.insert(0,str(ROOT/'bin'))
from coastal_cliff_finish import triangulate_actual_render_faces
from coastal_landscape import top_height
QA=ROOT/'.jekyll-cache/visual-qa/cliff-2026-10-28'
SOURCE=QA/'baseline/source.blend';OUT=QA/'attempt-1';OUT.mkdir(parents=True,exist_ok=True)
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
LO=Vector((-14.8,-9,5.9));HI=Vector((14,6.5,12.4))
top_margin=.65;top_controls=0
for p in verts:
 if not all(LO[k]<=p[k]<=HI[k] for k in range(3)):continue
 hit=tree.ray_cast(Vector((p.x,p.y,30)),Vector((0,0,-1)),60)[0]
 if hit is not None and abs(hit.z-p.z)<1e-4:
  top_margin=max(top_margin,top_height(p.x,p.y)-p.z+.15);top_controls+=1
print('TOP FREEZE',top_margin,top_controls,flush=True)
def ease(v):
 t=max(0.,min(1.,v));return t*t*(3-2*t)
def inside(p):return all(LO[k]-1e-6<=p[k]<=HI[k]+1e-6 for k in range(3))
def warp(p):
 x,y,z=p
 if not inside(p):return p.copy()
 edge=ease((x-LO.x)/2)*ease((HI.x-x)/2)*ease((y-LO.y)/2)*ease((HI.y-y)/3)
 if not edge:return p.copy()
 # Freeze the complete contact-bearing top, and every occupied lower section.
 weight=edge*ease((z-5.9)/.9)*ease((top_height(x,y)-z-top_margin)/.9)
 if not weight:return p.copy()
 # Recede and flare the reveal instead of projecting a height-band beak.
 # Broad shallow channels break the planar return without a noise overlay.
 wave=.78+.22*math.sin(x*.45+.3)**2
 return Vector((x+.65*math.tanh(x/5.8)*weight,y-1.05*weight*wave,z))
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
 explicit=triangulate_actual_render_faces(bm,mesh,LO,HI)
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
 if minimum<.15:raise RuntimeError(f'Fold/compression in {obj.name}: {minimum}')
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
 mesh.normals_split_custom_set([tuple(v.vector) for v in attribute.data]);mesh.attributes.remove(attribute)
 mesh.calc_loop_triangles();added=len(mesh.loop_triangles)-before_tri;total_added+=added
 receipts.append({'mesh':obj.name,'beforeTriangles':before_tri,'afterTriangles':len(mesh.loop_triangles),'addedTriangles':added,'explicitLocalSourcePolygons':explicit,'subdividedEdges':subdivided,'movedVertices':moved,'maximumDisplacementM':maximum,'minimumSampledJacobian':minimum,'nonmanifoldBefore':before_open,'nonmanifoldAfter':after_open,'activeColor':getattr(mesh.color_attributes.active_color,'name',None)})
 print(receipts[-1],flush=True)
if total_added>14396:raise RuntimeError(f'Exceeded immutable static potential headroom: {total_added}')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'candidate.blend'),compress=True)
report={'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'candidateSha256':hashlib.sha256((OUT/'candidate.blend').read_bytes()).hexdigest(),'boundsNative':[list(LO),list(HI)],'addedNativeTriangles':total_added,'maximumPotentialBeforeExportCompaction':735604+total_added,'meshes':receipts,'scope':'One visual experiment, not admission. Same-source render, exact unrelated scope, outside surface/fields, shared-boundary, overlap, contacts, decoded budgets and runtime flight checks still required.'}
(OUT/'recipe-receipt.json').write_text(json.dumps(report,indent=2)+'\n')
