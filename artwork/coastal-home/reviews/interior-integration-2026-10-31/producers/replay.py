"""Replay the three qualified independent recipes; no canonical writes."""
import bpy,hashlib,json,sys
from pathlib import Path
root=Path.cwd();sys.path.insert(0,str(root/'bin'))
import refresh_coastal_study_hardware as hardware
import refresh_coastal_pothos_blades as pothos
import refresh_coastal_private_reading as reading
source=root/'artwork/coastal-home/coastal-home.blend';source_sha=hashlib.sha256(source.read_bytes()).hexdigest()
assert source_sha=='75afc57f664101e59150910f86662b21ccf01087c393521ab1fa1886e481c5ad'
assert bpy.app.version==(4,5,9)
out=root/'.jekyll-cache/visual-qa/interior-integration-20261031';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
config=json.loads((root/'assets/models/home/manifest.json').read_bytes())
receipts={'hardware':hardware.migrate(scene),'pothos':pothos.migrate(scene),'reading':reading.migrate(scene,config)}
bpy.context.preferences.filepaths.save_version=0
candidate=out/'candidate-pre-ao.blend';bpy.ops.wm.save_as_mainfile(filepath=str(candidate),compress=True)
(out/'candidate-manifest.json').write_text(json.dumps(config,indent=2)+'\n',encoding='utf8')
(out/'replay.json').write_text(json.dumps({'sourceSha256':source_sha,'candidateSha256':hashlib.sha256(candidate.read_bytes()).hexdigest(),'receipts':receipts},indent=2)+'\n',encoding='utf8')
print('Qualified recipe replay completed; canonical source untouched.',flush=True)
print('native',candidate,'pothosTriangles',receipts['pothos']['trianglesAfter'],flush=True)
