import bpy,json,sys,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path.cwd();Q=ROOT/'.jekyll-cache/visual-qa/sweep-2026-10-28';source=Q/'frozen-v84-native.blend'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='4aaa7a66626af86d1c10ff021fda6a52e97e46caed3fad1e39c9e0173617d681'
assert bpy.app.version==(4,5,9)
bpy.ops.wm.open_mainfile(filepath=str(source))
point=Vector((.55,-7.45,.42));rows=[]
for obj in bpy.context.scene.objects:
 if obj.type!='MESH' or not obj.data.vertices:continue
 points=[obj.matrix_world@v.co for v in obj.data.vertices];lo=Vector([min(p[k] for p in points) for k in range(3)]);hi=Vector([max(p[k] for p in points) for k in range(3)])
 if not all(lo[k]-1e-7<=point[k]<=hi[k]+1e-7 for k in range(3)):continue
 mesh=obj.data;mesh.calc_loop_triangles();triangles=[t for t in mesh.loop_triangles if t.area>1e-12]
 tree=BVHTree.FromPolygons(points,[list(t.vertices) for t in triangles],all_triangles=True);nearest=tree.find_nearest(point)
 if nearest[0] is None:continue
 t=triangles[nearest[2]];parity=[]
 for d in [Vector((1,.247,.113)).normalized(),Vector((.373,1,.197)).normalized(),Vector((.217,.117,1)).normalized()]:
  start=point.copy();hits=[]
  for i in range(100):
   p,n,index,distance=tree.ray_cast(start,d,200)
   if p is None:break
   hits.append((p-point).length);start=p+d*1e-5
  parity.append({'intersections':len(hits),'odd':bool(len(hits)%2)})
 rows.append({'mesh':obj.name,'sourceMesh':mesh.name,'boundsNative':[list(lo),list(hi)],'boundsWeb':[[lo.x,lo.z,-hi.y],[hi.x,hi.z,-lo.y]],'nearestDistanceM':nearest[3],'nearestNative':list(nearest[0]),'triangle':{'loopTriangle':t.index,'polygon':t.polygon_index,'indices':list(t.vertices),'native':[list(points[i]) for i in t.vertices],'web':[[points[i].x,points[i].z,-points[i].y] for i in t.vertices]},'parity':parity,'material':[m.name for m in mesh.materials if m],'modifiers':[(m.name,m.type) for m in obj.modifiers],'properties':dict(obj.items())})
rows.sort(key=lambda r:r['nearestDistanceM'])
report={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'targetNative':list(point),'targetWeb':[point.x,point.z,-point.y],'candidates':rows}
(Q/'native-living-blocker.json').write_text(json.dumps(report,indent=2,default=str)+'\n')
print(json.dumps([{'name':r['mesh'],'distance':r['nearestDistanceM'],'insideParity':[p['odd'] for p in r['parity']],'triangle':r['triangle']['loopTriangle']} for r in rows],indent=2),flush=True)
