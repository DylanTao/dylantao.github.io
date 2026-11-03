from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,subprocess,urllib.request
root=Path.cwd();q=Path(__file__).parent;out=q/'brand-ci-live-v1';assert not out.exists();out.mkdir()
head='66e3ae1b5cce34d71ae37ef2062b26a952993a43'
run=lambda args:subprocess.check_output(args,cwd=root)
pages=run(['git','rev-parse','origin/gh-pages']).decode().strip();subject=run(['git','log','-1','--format=%s',pages]).decode().strip();assert head in subject
runs=json.loads(run(['gh','run','list','--commit',head,'--limit','20','--json','databaseId,name,status,conclusion,headSha,url']))
assert len(runs)==10 and all(r['headSha']==head and r['status']=='completed'and r['conclusion']in['success','skipped']for r in runs)
visualrun=next(r for r in runs if r['name']=='Visual checkpoints')
visual=json.loads(run(['gh','run','view',str(visualrun['databaseId']),'--json','status,conclusion,jobs,headSha,url']))
assert visual['headSha']==head and visual['conclusion']=='success'and len(visual['jobs'])==46 and all(j['conclusion']=='success'for j in visual['jobs'])
rows=[];sha=lambda b:hashlib.sha256(b).hexdigest()
for rel in ['index.html','blog/index.html','assets/css/main.css','assets/js/brand-orange.js','assets/js/module-build.json','assets/img/favicon.svg','assets/models/home/manifest.json','assets/models/home/static-light-field.json','assets/models/home/room-kitchen.glb']:
    expected=run(['git','show',pages+':'+rel]);url='https://dylantao.github.io/'+(''if rel=='index.html'else rel)+'?delivery='+head
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Sirui-site-deployment-verification'}),timeout=60)as response:body=response.read();status=response.status
    row={'path':rel,'url':url,'status':status,'bytes':len(body),'sha256':sha(body),'expectedSha256':sha(expected),'exact':body==expected};rows.append(row);assert status==200 and row['exact'],row
    if rel=='assets/css/main.css':assert body.count(b'data-brand-state')==12
    if rel=='assets/js/module-build.json':
        modules=json.loads(body)['modules'];assert len(modules)==189
        for name,record in modules.items():assert sha(run(['git','show',head+':'+name]).replace(b'\r\n',b'\n'))==record['sourceSha256']
ui=json.loads((q/'brand-live-ui-v4/REPORT.json').read_bytes());assert len(ui['rows'])==2 and all(r['final']=='adrift'and not r['errors']for r in ui['rows'])
record={'at':datetime.now(timezone.utc).isoformat(),'sourceHead':head,'pagesHead':pages,'pagesSubject':subject,'visualRun':visual['url'],'visualJobsPassed':46,'allApplicableWorkflowsPassed':True,'compiledSourcesBoundToCommit':len(modules),'responses':rows,'publicMouseAndTouchUiPassed':True,'scope':'Pinned brand release after all46visual jobs and every applicable workflow succeeded. Local main has later unpushed disabled-chair work and private daylight edits; source comparisons bind the published commit, not the changing working tree. Actual public Chromium mouse/touch is separate from local modern-WebKit and physical-iPhone evidence. No new physical-device or frame-performance claim.'}
for name,d in [('DELIVERY',record),('RUNS',runs),('VISUAL-JOBS',visual)]: (out/(name+'.json')).write_text(json.dumps(d,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:v for k,v in record.items()if k not in ['responses','scope']},indent=2))
