"""Build a source-bound anatomical Lizard trial in a fresh isolated directory."""
from pathlib import Path
import argparse,hashlib,json,sys
import bpy

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'bin'))
from coastal_tail_anatomy import create_anatomy_trial
from build_coastal_character_library import export_library


def main():
    assert bpy.app.version==(4,5,9)
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=ROOT/'artwork/coastal-home/character-finish.blend')
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    source=args.source.resolve();out=args.out.resolve()
    assert not out.is_relative_to(ROOT/'artwork/coastal-home'),'Canonical artwork cannot be a trial destination'
    assert not any((out/name).exists() for name in ['character-finish.blend','failed.blend','receipt.json','failure.json']),'Retained attempts are immutable'
    out.mkdir(parents=True,exist_ok=True)
    for name in ['coastal_tail_anatomy.py','coastal_tail_port.py','refresh_coastal_tail_anatomy.py']:(out/name).write_bytes((ROOT/'bin'/name).read_bytes())
    original=hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.window.scene=next(scene for scene in bpy.data.scenes if scene.get('finishAvatar')=='lizard')
    arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mesh=next(o for o in arm.children if o.get('finishCanonicalName',o.name)=='SiruiMesh')
    bpy.context.preferences.filepaths.save_version=0
    try:receipt=create_anatomy_trial(arm,mesh)
    except Exception as error:
        bpy.ops.wm.save_as_mainfile(filepath=str(out/'failed.blend'),compress=True)
        (out/'failure.json').write_text(json.dumps({'sourceSha256':original,'error':str(error)},indent=2)+'\n');raise
    candidate=out/'character-finish.blend';bpy.ops.wm.save_as_mainfile(filepath=str(candidate),compress=True)
    receipt.update({'sourceSha256':original,'candidateSha256':hashlib.sha256(candidate.read_bytes()).hexdigest(),'candidate':str(candidate)})
    receipt['exports']=export_library(candidate,out)
    assert hashlib.sha256(source.read_bytes()).hexdigest()==original
    (out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print('ANATOMICAL-TAIL-TRIAL',json.dumps({key:value for key,value in receipt.items() if key!='exports'}),flush=True)


if __name__=='__main__':main()
