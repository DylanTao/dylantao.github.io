import bpy,json,hashlib,itertools
from pathlib import Path
from mathutils import Vector
Q=Path.cwd()/'.jekyll-cache/visual-qa/sweep-2026-10-28';source=Q/'frozen-v84-native.blend';sha=hashlib.sha256(source.read_bytes()).hexdigest()
assert sha=='4aaa7a66626af86d1c10ff021fda6a52e97e46caed3fad1e39c9e0173617d681';assert bpy.app.version==(4,5,9)
bpy.ops.wm.open_mainfile(filepath=str(source));a=json.loads((Q/'living-cell-origin.json').read_text());rows=[]
for contributor in a['origin']['contributors']:
 obj=bpy.data.objects.get(contributor['name']);assert obj and obj.type=='MESH',contributor['name'];m=obj.data;m.calc_loop_triangles();world=[obj.matrix_world@v.co for v in m.vertices];web=[Vector((v.x,v.z,-v.y)) for v in world];matches=[]
 for t in contributor['triangles']:
  points=[Vector(p) for p in t['world']];center=sum(points,Vector())/3;best=None
  for nt in m.loop_triangles:
   verts=[web[i] for i in nt.vertices]
   if ((sum(verts,Vector())/3)-center).length>.01:continue
   error=min(max((points[k]-verts[j]).length for k,j in enumerate(order)) for order in itertools.permutations(range(3)))
   if best is None or error<best['maximumVertexErrorM']:best={'sourceLoopTriangle':nt.index,'polygon':nt.polygon_index,'sourceIndices':list(nt.vertices),'worldWeb':[list(v) for v in verts],'maximumVertexErrorM':error}
  matches.append({'decodedTriangle':t['triangle'],'match':best})
 rows.append({'object':obj.name,'mesh':m.name,'properties':dict(obj.items()),'sourceVertexCount':len(m.vertices),'sourceTriangleCount':len(m.loop_triangles),'boundsWeb':[[min(v[k] for v in web) for k in range(3)],[max(v[k] for v in web) for k in range(3)]],'matches':matches})
report={'sourceSha256':sha,'blender':bpy.app.version_string,'readOnly':True,'sourceSaved':False,'contributors':rows};(Q/'native-living-cell-origin.json').write_text(json.dumps(report,indent=2,default=str)+'\n');print(json.dumps(report,indent=2,default=str),flush=True)
