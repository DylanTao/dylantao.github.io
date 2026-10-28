"""Pinned v84 laundry service-bay patch, Blender 4.5.9 only.

Existing native geometry is untouched. Two supported bronze masts share the
runtime installation frame stored in nativeLaundryFrame. The complete runtime
line, garments, pegs, collider frame and actual world wind use this same frame.
This creates authored fictional hardware, not a verified real home feature.
"""
import bpy,bmesh,hashlib,json,sys,math,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
import argparse
parser=argparse.ArgumentParser(description='Add the verified supported laundry frame to the pinned v84 source.')
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--report',type=Path,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
source=args.source.resolve();dest=args.output.resolve();report_path=args.report.resolve()
if source==dest:raise ValueError('Write a separate candidate; never overwrite the intake source.')
if dest.exists():raise FileExistsError('Candidate already exists; choose a fresh output path.')
dest.parent.mkdir(parents=True,exist_ok=True);report_path.parent.mkdir(parents=True,exist_ok=True)
pin='4aaa7a66626af86d1c10ff021fda6a52e97e46caed3fad1e39c9e0173617d681'

assert bpy.app.version==(4,5,9);assert hashlib.sha256(source.read_bytes()).hexdigest()==pin
NAMES=set()
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

before=snapshot(source)
# The source uses a shared native frame; leave all retained objects untouched.
p0=(-2.5409,-7.4546);p1=(.5395,-7.1348);span=math.dist(p0,p1);origin=[5.1,.001,3.02];desired=(2.85,-1.2);length=math.hypot(*desired);along=[v/length for v in desired]
sourceAngle=math.atan2(p1[1]-p0[1],p1[0]-p0[0]);targetAngle=math.atan2(along[1],along[0]);yaw=sourceAngle-targetAngle;c,s=math.cos(yaw),math.sin(yaw)
translation=[origin[0]-(c*p0[0]+s*p0[1]),origin[1],origin[2]-(-s*p0[0]+c*p0[1])]
posts=[origin,[origin[0]+along[0]*span,origin[1],origin[2]+along[1]*span]]
frame={'version':1,'yaw':yaw,'translation':translation,'rail':[],'floorY':0.,'postBaseY':-.03,'postTopY':2.57,'postsWorld':posts,'lineHeight':1.94,'scope':'Complete supported dry service bay; no retired parapet rail collider.'}
bm=bmesh.new()
for point in posts:
 x,y,z=point
 # Radius and cap follow the existing authored mast proportions. The long
 # shaft now meets real paving, rather than starting at the retired cap rail.
 bmesh.ops.create_cone(bm,cap_ends=True,cap_tris=False,segments=12,radius1=.028,radius2=.028,depth=2.60,matrix=Matrix.Translation((x,-z,y+1.27)))
 bmesh.ops.create_uvsphere(bm,u_segments=12,v_segments=6,radius=.036,matrix=Matrix.Translation((x,-z,y+2.57)))
mesh=bpy.data.meshes.new('laundry supported bronze masts');bm.to_mesh(mesh);bm.free();mesh.update()
material=bpy.data.objects['core_facade__dark_bronze'].data.materials[0];mesh.materials.append(material)
for f in mesh.polygons:f.use_smooth=True
attr=mesh.color_attributes.new(name='AOColor0',type='FLOAT_COLOR',domain='CORNER')
for v in attr.data:v.color=(1,1,1,1)
mesh.color_attributes.active_color=attr
obj=bpy.data.objects.new('core_laundry_frame_posts',mesh);bpy.context.scene.collection.objects.link(obj);obj['nativeLaundryFrame']=json.dumps(frame,sort_keys=True,separators=(',',':'));obj['laundryHardware']=True;obj['vertexColorSource']='Neutral modulation for new bronze hardware; existing native AO fields preserved.'
mesh.calc_loop_triangles();triangles=len(mesh.loop_triangles);bm=bmesh.new();bm.from_mesh(mesh);nonmanifold=sum(not e.is_manifold for e in bm.edges);bm.free();assert nonmanifold==0
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(dest),compress=True)
after=snapshot(dest);changed=[n for n in before['objects'] if before['objects'][n]!=after['objects'].get(n)];added=sorted(set(after['objects'])-set(before['objects']));assert not changed,changed;assert added==['core_laundry_frame_posts'];assert before['materials']==after['materials']
report={'sourceSha256':pin,'candidateSha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'frame':frame,'newObject':'core_laundry_frame_posts','newTriangles':triangles,'newNonmanifoldEdges':nonmanifold,'changedExistingObjects':changed,'addedObjects':added,'existingObjectCount':len(before['objects']),'allExistingMeshTopologyAttributesNormalsTransformsPropertiesExact':True,'materialsExact':True,'baselineObjectsSha256':hashlib.sha256(json.dumps(before['objects'],sort_keys=True).encode()).hexdigest(),'candidateRetainedObjectsSha256':hashlib.sha256(json.dumps({n:after['objects'][n] for n in before['objects']},sort_keys=True).encode()).hexdigest(),'sourceSaved':False,'supportScope':'Posts use actual service paving readback; native body/overlap/flight and decoded/render gates follow.'}
report_path.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True)
