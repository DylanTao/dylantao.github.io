import bpy,sys,json,math,hashlib
from pathlib import Path
ROOT=Path.cwd();sys.path.insert(0,str(ROOT/'bin'))
import coastal_preview as preview
q=ROOT/'.jekyll-cache/visual-qa/cliff-2026-10-28'
views={'overview':((-18,27,14),(-1,-4,2.8),58),'close':((-14,19,12),(0,-3,5.5),42)}
report={}
for name,path in [('candidate-2-finite',q/'attempt-2-finite/candidate.blend')]:
 bpy.ops.wm.open_mainfile(filepath=str(path));scene=bpy.context.scene
 camera=preview.setup(scene,resolution=(3840,2160),samples=32,cutaway=False)
 for obj in scene.objects:
  if obj.get('bedding'):obj.hide_render=obj['bedding']!='empty'
 report[name]={'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'views':views,'engine':'BLENDER_EEVEE_NEXT','samples':32,'size':[3840,2160]}
 preview.render(scene,camera,views,q/name/'native-4k')
(q/'render-pair.json').write_text(json.dumps(report,indent=2)+'\n')
