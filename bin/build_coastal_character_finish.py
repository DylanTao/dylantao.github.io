"""Fit the five original characters' sleeves, preserving each original input.

Run with Blender 4.5.9 and a separate scratch --out directory. Assemble these
editable sources with build_coastal_character_library.py, then audit that master.
"""
import argparse
import json
import sys
from pathlib import Path

import bpy

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'bin'))
from coastal_character_finish import STYLES, fitted_sleeves, posed_sleeve_clearance, sha256
from refresh_coastal_character_finish import export, rigidity


def main():
    assert bpy.app.version==(4,5,9),bpy.app.version_string
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',type=Path,required=True)
    opts=parser.parse_args(args)
    opts.out=opts.out.resolve()
    opts.out.mkdir(parents=True,exist_ok=True)
    report={'blender':bpy.app.version_string,'generatorSha256':sha256(Path(__file__)),'coreSha256':sha256(ROOT/'bin/coastal_character_finish.py'),'method':'Connected sleeve cloth follows barycentric weights of the retained anatomical surface and receives bounded clearance in nine finite authored poses. Original skin, topology, joints, Blink and all fourteen NLA channels remain unchanged.','avatars':{}}
    for style in STYLES:
        source=ROOT/f'artwork/coastal-home/sirui-{style}.blend'
        before=sha256(source)
        bpy.ops.wm.open_mainfile(filepath=str(source))
        arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
        mesh=next(o for o in arm.children if o.name=='SiruiMesh')
        entry={'sleeves':fitted_sleeves(arm,mesh,.020 if style=='lizard' else .012,True),'posedClearance':posed_sleeve_clearance(arm,mesh),**rigidity(mesh)}
        assert entry['partialRigidWeights']==0 and entry['mixedTriangles']==0
        entry['clips']=[track.name for track in arm.animation_data.nla_tracks]
        assert len(entry['clips'])==14
        for track in arm.animation_data.nla_tracks:
            track.mute=track.name!='idle'
        bpy.context.scene.frame_set(1)
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(opts.out/source.name),compress=True)
        target=opts.out/f'sirui-{style}.glb'
        export(arm,target)
        assert sha256(source)==before
        entry.update({'originalInputSha256':before,'glbSha256':sha256(target),'bytes':target.stat().st_size})
        report['avatars'][style]=entry
        print('SLEEVE-FINISH',style,json.dumps(entry),flush=True)
    (opts.out/'finish-receipt.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')


if __name__=='__main__':
    main()
