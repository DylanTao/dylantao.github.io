from pathlib import Path
from datetime import datetime,timezone
import subprocess,json,hashlib,os,time,shutil
root=Path.cwd();q=Path(__file__).parent;out=q/'daylight-bake-v5';assert not out.exists();out.mkdir()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
protected=['artwork/coastal-home/coastal-home.blend','assets/models/home/home-shell.glb','assets/models/home/room-kitchen.glb']
before={p:sha(root/p)for p in protected}
for rel in ['assets/models/home/manifest.json','assets/models/home/static-light-field.json']:
    dest=out/'before'/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/rel,dest)
inputs=['test/visual/desk-scene.spec.js','assets/js/home.js','test/visual/static-light-field.spec.js','assets/js/home-scene/diffuse-paths.mjs','assets/js/home-scene/interior-exposure.mjs','assets/js/home-scene/static-light-field.mjs','assets/js/home-scene/controller.mjs','bin/coastal_static_light_inputs.cjs','test/diffuse-paths.test.mjs','test/interior-exposure.test.mjs']
record={'at':datetime.now(timezone.utc).isoformat(),'sourceHead':subprocess.check_output(['git','rev-parse','HEAD']).decode().strip(),'sourceFiles':[{'path':p,'sha256':sha(root/p)}for p in inputs],'protectedBefore':before,'scope':'Official owning producer, full current public geometry and newly authored three-bounce transport. No native/export changes or manual cache edits. Bounded position-based camera exposure is a separate presentation control.'}
(out/'SOURCE.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
env=os.environ.copy();env['COASTAL_CACHE_URL']='http://127.0.0.1:55404/al-folio/';env['COASTAL_BAKE_TIMEOUT_MS']='300000';start=time.monotonic()
with(out/'bake.log').open('wb')as log:r=subprocess.run(['node','bin/bake_coastal_static_light.cjs'],env=env,stdout=log,stderr=subprocess.STDOUT,timeout=600)
record.update(exitCode=r.returncode,seconds=time.monotonic()-start,protectedAfter={p:sha(root/p)for p in protected})
assert record['protectedBefore']==record['protectedAfter']
if r.returncode==0:
    record['cacheBytes']=(root/'assets/models/home/static-light-field.json').stat().st_size;record['cacheSha256']=sha(root/'assets/models/home/static-light-field.json');record['manifestSha256']=sha(root/'assets/models/home/manifest.json')
(out/'PROCESS.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8');print(json.dumps(record,indent=2));assert r.returncode==0
