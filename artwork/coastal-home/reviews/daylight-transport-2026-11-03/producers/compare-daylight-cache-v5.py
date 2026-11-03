from pathlib import Path
import base64,gzip,hashlib,json,struct
root=Path.cwd();q=Path(__file__).parent;old=json.loads((q/'daylight-bake-v1/before/assets/models/home/static-light-field.json').read_bytes());body=(root/'assets/models/home/static-light-field.json').read_bytes();new=json.loads(body)
a=base64.b64decode(old['transport']);b=base64.b64decode(new['transport']);assert len(a)==len(b)==380928
sources=31;stride=sources*12*8;assert len(a)%stride==0
changed=[]
for probe in range(len(a)//stride):
    for source in range(sources):
        start=probe*stride+source*12*8;end=start+12*8
        if a[start:end]!=b[start:end]:changed.append({'probe':probe,'source':source})
assert all(row['source']<3 for row in changed),changed
assert old['moments']==new['moments']
assert old['probes']==new['probes']
models=lambda d:{k:v for k,v in d['inputs']['dependencies'].items()if k.endswith('.glb')}
assert models(old)==models(new);assert len(models(new))==61
manifest=json.loads((root/'assets/models/home/manifest.json').read_bytes());prior=json.loads((q/'daylight-bake-v1/before/assets/models/home/manifest.json').read_bytes())
for d in [manifest,prior]:d.pop('staticLightFieldCache',None)
assert manifest==prior
stats=new['statistics'];assert stats['triangles']+stats['skippedTriangles']<=750000
record={'scope':'Independent comparison of official final sky-only deep-bounce cache against previous public one-bounce cache. No mutation. Original practical coefficients and every model dependency are bit-exact; the manifest differs only in the owning cache descriptor.','version':new['version'],'cacheBytes':len(body),'gzipBytes':len(gzip.compress(body,mtime=0)),'sha256':hashlib.sha256(body).hexdigest(),'signature':new['signature'],'practicalBasesChanged':[],'skyBasesChanged':len(changed),'distanceMomentsExact':True,'probePositionsValidityExact':True,'allModelInputsExact':True,'modelInputCount':len(models(new)),'manifestOnlyCacheDescriptor':True,'statistics':stats}
target=q/'sky-bake-v5-comparison.json';assert not target.exists();target.write_text(json.dumps(record,indent=2)+'\n',encoding='utf8');print(json.dumps({k:v for k,v in record.items()if k!='statistics'},indent=2))
