"""Extract and restore original living plants without rebuilding the current furniture.

blender -b -t 6 --python-exit-code 1 --python bin/restore_coastal_living_plants.py -- --reference=PATH
The reference is coastal-home.blend from retained commit 512fc0807. The library is subsequently
self-contained: ordinary living rebuilds use coastal_living_plants.ensure_living_plants().
"""
import hashlib
import json
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"bin"))
from coastal_living_plants import ensure_living_plants,LIBRARY,PREFIX
from coastal_shell import _islands

args={a.split("=",1)[0][2:]:a.split("=",1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
reference=Path(args["reference"]).resolve()
assert hashlib.sha256(reference.read_bytes()).hexdigest()=="89bc1ef9854c17b4038aeb972fb09351ece0083cd29e7c7ab340acffb49faaef", "reference must be the retained 512fc0807 native source"
source=ROOT/"artwork/coastal-home/coastal-home.blend"
report={"referenceCommit":"512fc0807","referenceSha256":hashlib.sha256(reference.read_bytes()).hexdigest(),"removedBy":"coastal_living.build_living cleared every lounge__ material batch","parts":[]}

bpy.ops.wm.open_mainfile(filepath=str(reference))
parts=[]
# Exact whole leaf/branch geometry, plus narrowly identified native pot/stem islands.
specs=[
 ("lounge__olive leaf","olive_foliage",lambda lo,hi:lo.x>3.5,Vector((-1.35,.5,-.0195))),
 ("lounge__olive bark wood","olive_stems",lambda lo,hi:True,Vector((-1.35,.5,-.0195))),
 ("lounge__linen","olive_planter",lambda lo,hi:lo.x>4.0 and hi.x<4.7 and lo.y>3.0 and hi.y<3.8 and lo.z>-.01 and hi.z<.56,Vector((-1.35,.5,-.0195))),
 ("lounge__olive leaf","table_foliage",lambda lo,hi:hi.x<2,Vector((3.37,-1.79,.224))),
 ("lounge__honey ash","table_stems",lambda lo,hi:lo.x>1.3 and hi.x<1.55 and lo.y>1.8 and hi.y<2.1 and lo.z>.45 and hi.z<.75,Vector((3.37,-1.79,.224))),
 ("lounge__charcoal","table_pot",lambda lo,hi:lo.x>1.3 and hi.x<1.55 and lo.y>1.8 and hi.y<2.1 and lo.z>.35 and hi.z<.49,Vector((3.37,-1.79,.224))),
]
for name,suffix,select,delta in specs:
 original=bpy.data.objects[name]
 obj=original.copy();obj.data=original.data.copy();obj.name=PREFIX+suffix;bpy.context.scene.collection.objects.link(obj)
 # Bake the retained native object transform into its mesh before filtering whole islands.
 obj.data.transform(obj.matrix_world);obj.matrix_world=Matrix.Identity(4)
 bm=bmesh.new();bm.from_mesh(obj.data);remove=[]
 for island in _islands(bm):
  lo=Vector([min(v.co[k] for v in island) for k in range(3)]);hi=Vector([max(v.co[k] for v in island) for k in range(3)])
  if not select(lo,hi):remove.extend(island)
  else:
   for v in island:v.co+=delta
 if remove:bmesh.ops.delete(bm,geom=remove,context="VERTS")
 bm.to_mesh(obj.data);bm.free();obj.data.update()
 assert obj.data.vertices, suffix
 obj["retainedLivingPlant"]=suffix
 parts.append(obj)
 lo=[min(v.co[k] for v in obj.data.vertices) for k in range(3)];hi=[max(v.co[k] for v in obj.data.vertices) for k in range(3)]
 report["parts"].append({"name":obj.name,"vertices":len(obj.data.vertices),"polygons":len(obj.data.polygons),"delta":list(delta),"bounds":{"min":lo,"max":hi}})
bpy.data.libraries.write(str(LIBRARY),set(parts),fake_user=True,compress=True)

bpy.ops.wm.open_mainfile(filepath=str(source))
for obj in [o for o in bpy.context.scene.objects if o.name.startswith(PREFIX)]:
 bpy.data.objects.remove(obj,do_unlink=True)
restored=ensure_living_plants(bpy.context.scene)
assert len(restored)==6
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
report.update(library=str(LIBRARY.relative_to(ROOT)).replace("\\","/"),restoredParts=len(restored),placement="floor olive outside the pit at (3.0,3.9,-.0195); original small plant on the actual credenza top at (4.79,.13,.584)")
(ROOT/"artwork/coastal-home/reviews/living-plant-restoration.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report),flush=True)
