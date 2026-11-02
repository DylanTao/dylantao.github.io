"""Apply one additive garden to a SHA-pinned private native source.

Blender4.5.9 --background --factory-startup --python-exit-code1 --python THIS --
 --source INPUT --source-sha256 SHA --output REPO/.jekyll-cache/visual-qa/NEW

No export, cache descriptor, canonical asset or source input is written.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'bin'))
import coastal_breakfast_garden as garden

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for key in ('source','source-sha256','output'):parser.add_argument('--'+key,required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    source=Path(args.source).resolve();out=Path(args.output).resolve()
    if bpy.app.version!=(4,5,9) or sha(source)!=args.source_sha256:
        raise RuntimeError('Exact source and Blender4.5.9 required')
    if out.exists() or not out.is_relative_to(ROOT/'.jekyll-cache/visual-qa') or source.is_relative_to(out):
        raise RuntimeError('New private QA destination required')
    spec=importlib.util.spec_from_file_location('garden_custody',ROOT/'artwork/coastal-home/reviews/bedroom-ambience-2026-11-01/replay_lighting.py')
    custody=importlib.util.module_from_spec(spec);spec.loader.exec_module(custody)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    before=custody.native_state()
    materials=custody.materials()
    producer_files={p.relative_to(ROOT).as_posix():sha(p)for p in (Path(__file__).resolve(),ROOT/'bin/coastal_breakfast_garden.py')}
    out.mkdir(parents=True)
    objects,metadata=garden.build(bpy.context.scene)
    after=custody.native_state()
    changed=[name for name,state in before.items()if after.get(name)!=state]
    if changed:raise RuntimeError('Existing native field changed: '+str(changed))
    if materials!=custody.materials():
        raise RuntimeError('Existing material changed')
    added=sorted(set(after)-set(before))
    if added!=sorted(o.name for o in objects) or len(added)!=4:raise RuntimeError('Exact four new batches required')
    stats=[]
    for obj in objects:
        obj.data.calc_loop_triangles()
        stats.append({'name':obj.name,'triangles':len(obj.data.loop_triangles),'vertices':len(obj.data.vertices)})
    if sum(r['triangles']for r in stats)>1200:raise RuntimeError('Garden local triangle budget exceeded; global750000 remains independent')
    bpy.context.preferences.filepaths.save_version=0
    target=out/'candidate.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
    bpy.ops.wm.open_mainfile(filepath=str(target))
    if custody.native_state()!=after:raise RuntimeError('Saved/reopened numeric fields changed')
    if sha(source)!=args.source_sha256:raise RuntimeError('Input was changed')
    if producer_files!={name:sha(ROOT/name)for name in producer_files}:raise RuntimeError('Producer changed during replay')
    receipt={'sourceSha256':args.source_sha256,'candidateSha256':sha(target),'producerFiles':producer_files,'unchangedNativeMeshes':len(before),'unrelatedChanges':changed,'added':stats,'triangles':sum(r['triangles']for r in stats),'garden':metadata,'qualified':'Native custody and bounded addition only; supports/body/export/cache/appearance remain required.'}
    (out/'GARDEN.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8',newline='\n')
    print(json.dumps({'source':str(target),'sha256':sha(target),'triangles':receipt['triangles']}))

if __name__=='__main__':main()
