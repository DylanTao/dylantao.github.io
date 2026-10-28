"""Compare every non-rider exported node with the reviewed pre-change commit.

Run from the repo root. Compressed geometry bytes, material definitions, accessor
bounds/counts and transforms must match; storage indices may differ after the patch.
"""
import json, hashlib, struct, subprocess
from pathlib import Path
qa=Path(__file__).resolve().parent
root=Path.cwd()
def load(data):
    n=struct.unpack_from('<I',data,12)[0]
    return json.loads(data[20:20+n]),data[28+n:]
def snapshot(data):
    d,b=load(data)
    out={}
    parents={c:i for i,n in enumerate(d['nodes']) for c in n.get('children',[])}
    def rider(i):
        return d['nodes'][i]['name']=='Surfer1' or (i in parents and rider(parents[i]))
    for i,node in enumerate(d['nodes']):
        if rider(i):continue
        value={k:v for k,v in node.items() if k not in ('mesh','children')}
        value['children']=[d['nodes'][j]['name'] for j in node.get('children',[])]
        if 'mesh' in node:
            prim=[]
            for p in d['meshes'][node['mesh']]['primitives']:
                draco=p.get('extensions',{}).get('KHR_draco_mesh_compression')
                v=d['bufferViews'][draco['bufferView']]
                chunk=b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
                prim.append({'draco':hashlib.sha256(chunk).hexdigest(),'material':d['materials'][p['material']],'attributes':{k:d['accessors'][v] for k,v in p['attributes'].items()}})
            value['primitives']=prim
        out[node['name']]=value
    return out
report={}
for stem in ['la-jolla','miniature']:
    before=subprocess.check_output(['git','show','759a3b58b:assets/models/la-jolla/'+stem+'.glb'],cwd=root)
    a=snapshot(before);b=snapshot((root/'assets/models/la-jolla'/(stem+'.glb')).read_bytes())
    # Accessor names/buffer indices are storage details, compare payload hashes and bounds/counts.
    for states in [a,b]:
        for n in states.values():
            for p in n.get('primitives',[]):
                for acc in p['attributes'].values():
                    for k in ['bufferView','byteOffset','name']:acc.pop(k,None)
    changed=[n for n in a if a[n]!=b.get(n)]
    report[stem]={'non_target_nodes':len(a),'changed':changed,'added':sorted(set(b)-set(a)),'removed':sorted(set(a)-set(b))}
(qa/'export-readback.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
assert all(not item['changed'] and not item['added'] and not item['removed'] for item in report.values())
