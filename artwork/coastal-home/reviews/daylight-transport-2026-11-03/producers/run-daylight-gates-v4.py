from pathlib import Path
from datetime import datetime,timezone
import json,os,subprocess,sys,sysconfig,time
root=Path.cwd();q=Path(__file__).parent;wt=Path('C:/dev/dqa1103');out=q/'daylight-checkpoint-v4';assert (out/'SOURCE.json').exists()
lane=sys.argv[1];rows=[]
env=dict(os.environ,BUNDLE_PATH='C:/tools/site-gems-ruby33',JEKYLL_ENV='production',MAGICK_THREAD_LIMIT='4',OPENBLAS_NUM_THREADS='1')
env['PATH']='C:/tools/site-bin;C:/tools/Ruby33/bin;'+sysconfig.get_path('scripts')+';'+env['PATH']
def run(name,args,timeout):
    start=time.monotonic()
    with(out/(name+'.log')).open('wb')as log:r=subprocess.run(args,cwd=wt,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=timeout)
    rows.append({'name':name,'command':args,'exitCode':r.returncode,'seconds':time.monotonic()-start})
    (out/(lane.upper()+'-GATES.json')).write_text(json.dumps({'at':datetime.now(timezone.utc).isoformat(),'processes':rows},indent=2)+'\n',encoding='utf8');print(json.dumps(rows[-1]),flush=True);assert r.returncode==0,name
if lane=='install':run('npm-ci',['C:/Program Files/nodejs/npm.cmd','ci'],180)
elif lane=='build':run('production-build',['C:/tools/Ruby33/bin/ruby.exe','C:/tools/Ruby33/bin/bundle','exec','jekyll','build','--baseurl','/al-folio','--destination',str(out/'site/al-folio')],900)
elif lane=='unit':
    run('python',[sys.executable,'-X','utf8','-m','unittest','discover','-s','test','-p','test_*.py'],600)
    run('node',['node','--test',*[str(p.relative_to(wt))for p in sorted((wt/'test').glob('*.test.mjs'))]],600)
    run('style',['node','test/style_contract.js'],120)
else:raise ValueError(lane)
