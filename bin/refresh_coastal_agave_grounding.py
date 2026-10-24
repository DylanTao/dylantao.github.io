import bpy,sys,json,hashlib,struct
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'bin'))
from coastal_roof_planting import ground_rosettes
source=Path(next((a.split('=',1)[1] for a in sys.argv if a.startswith('--source=')),root/'artwork/coastal-home/coastal-home.blend'))
out=root/'.jekyll-cache/retreat-grounding';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene

def included(obj):
    if obj.get('shadowOnly') or obj.get('facadeDoor') or obj.get('estateDoor'):return False
    if obj.get('flora') and not any(m and any(word in m.name.lower() for word in ('bark','trunk')) for m in obj.data.materials):return False
    return True

def digest(objects):
    h=hashlib.sha256();count=vertices=faces=0
    for obj in sorted(objects,key=lambda o:o.name):
        if obj.type!='MESH':continue
        h.update(obj.name.encode());count+=1
        for v in obj.data.vertices:
            h.update(struct.pack('<3d',*(obj.matrix_world@v.co)));vertices+=1
        for f in obj.data.polygons:
            h.update(struct.pack('<I',len(f.vertices)));h.update(struct.pack('<'+'I'*len(f.vertices),*f.vertices));faces+=1
    return {'sha256':h.hexdigest(),'meshes':count,'vertices':vertices,'faces':faces}
agaves=[o for o in scene.objects if o.type=='MESH' and (o.name=='core__blue sage agave leaf' or o.get('roofPlanting'))]
before=digest([o for o in scene.objects if o.type=='MESH' and included(o)])
other_before=digest([o for o in scene.objects if o not in agaves])
objects,report=ground_rosettes(scene)
report['sourceBeforeSha256']=hashlib.sha256(source.read_bytes()).hexdigest()
report['companionIncludedBVHBefore']=before
report['companionIncludedBVHAfter']=digest([o for o in scene.objects if o.type=='MESH' and included(o)])
report['otherGeometryBefore']=other_before
report['otherGeometryAfter']=digest([o for o in scene.objects if o not in agaves])
report['changedNodesIncludedInCompanionBVH']=[o.name for o in agaves if included(o)]
assert report['otherGeometryAfter']==other_before
report['changedObjects']=[o.name for o in objects]
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'coastal-home.blend'),compress=True)
report['sourceAfterSha256']=hashlib.sha256((out/'coastal-home.blend').read_bytes()).hexdigest()
(out/'agave-grounding.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='contacts'}),flush=True)
