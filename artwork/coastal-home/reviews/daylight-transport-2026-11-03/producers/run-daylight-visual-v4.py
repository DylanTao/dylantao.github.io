from pathlib import Path
from datetime import datetime, timezone
import json,os,subprocess,time
q=Path(__file__).parent;out=q/'daylight-checkpoint-v4';wt=Path('C:/dev/dqa1103')
env=dict(os.environ,NO_WEBSERVER='1',VISUAL_BASE_URL=json.loads((out/'server.json').read_bytes())['url'].rstrip('/'),CI='1')
command=['C:/Program Files/nodejs/npx.cmd','playwright','test','--config','test/visual/public.config.js','--project','desktop-1440','--workers','1','--output',str(out/'targeted-results'),'test/visual/static-light-field.spec.js','test/visual/desk-scene.spec.js','--grep','static light field:|coastal loading: the occupied room|coastal loading: a stalled optional']
start=time.monotonic()
with(out/'targeted-visual.log').open('wb') as log:r=subprocess.run(command,cwd=wt,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=660)
(out/'TARGETED-VISUAL.json').write_text(json.dumps({'at':datetime.now(timezone.utc).isoformat(),'command':command,'env':{k:env[k]for k in ['NO_WEBSERVER','VISUAL_BASE_URL','CI']},'seconds':time.monotonic()-start,'exitCode':r.returncode},indent=2)+'\n',encoding='utf8')
print(json.dumps({'exitCode':r.returncode,'seconds':time.monotonic()-start}));raise SystemExit(r.returncode)
