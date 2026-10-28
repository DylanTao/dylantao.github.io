"""Rebuild the rejected v22 anatomy in a fresh review destination, never public assets."""
from pathlib import Path
import argparse,hashlib,json,sys
import bpy

REVIEW=Path(__file__).resolve().parent
ROOT=REVIEW.parents[3]
sys.path.insert(0,str(ROOT/'bin'))
sys.path.insert(0,str(REVIEW/'source-v22'))
from coastal_tail_anatomy import create_anatomy_trial
from build_coastal_character_library import export_library


def main():
    assert bpy.app.version==(4,5,9)
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--reconstruct',action='store_true',help='Try rebuilding from the original master; this trial did not demonstrate byte-repeatable Boolean reconstruction')
    options=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    out=options.out.resolve();source=ROOT/'artwork/coastal-home/character-finish.blend'
    assert not out.is_relative_to(ROOT/'artwork') and not out.is_relative_to(ROOT/'assets'),'Only a fresh diagnostic destination is permitted'
    assert not out.exists(),'Retained attempts are immutable'
    out.mkdir(parents=True)
    before=hashlib.sha256(source.read_bytes()).hexdigest()
    assert before=='21808be7aa4bb25db386de94bc02e05616f60de28825b3f57c695132ac7698a6'
    if options.reconstruct:
        bpy.ops.wm.open_mainfile(filepath=str(source))
        bpy.context.window.scene=next(scene for scene in bpy.data.scenes if scene.get('finishAvatar')=='lizard')
        arm=next(obj for obj in bpy.context.scene.objects if obj.type=='ARMATURE')
        mesh=next(obj for obj in arm.children if obj.get('finishCanonicalName',obj.name)=='SiruiMesh')
        receipt=create_anatomy_trial(arm,mesh)
        bpy.context.preferences.filepaths.save_version=0
        master=out/'character-finish.blend';bpy.ops.wm.save_as_mainfile(filepath=str(master),compress=True)
    else:
        master=REVIEW/'rejected-character-finish.blend'
        receipt={'mode':'Exact frozen native master export, not Boolean reconstruction'}
    receipt['exports']=export_library(master,out)
    assert hashlib.sha256(source.read_bytes()).hexdigest()==before
    expected=hashlib.sha256((REVIEW/'rejected-lizard.glb').read_bytes()).hexdigest()
    receipt['lizardExportByteExact']=hashlib.sha256((out/'sirui-lizard.glb').read_bytes()).hexdigest()==expected
    receipt['state']='Rejected native anatomy reproduction; not admission'
    (out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    assert receipt['lizardExportByteExact'],'Reproduced export differs from the retained control'


if __name__=='__main__':main()
