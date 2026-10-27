"""Read back the finished library against the five immutable native inputs.

Checks actual geometry, binding, rest joints, retained action channels and Blink
shapes. No model is changed. Contact and rendered evidence are separate gates.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
STYLES = ('lizard','south-park','simpsons','ghibli','rick-and-morty')
sys.path.insert(0,str(ROOT/'bin'))
from audit_coastal_overlaps import segments


def digest(value):
    return hashlib.sha256(json.dumps(value,separators=(',',':'),sort_keys=True).encode()).hexdigest()


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(value):
    return value.get('finishCanonicalName',value.name)


def cuff_contacts(scene):
    arm=next(o for o in scene.objects if o.type=='ARMATURE')
    obj=next(o for o in arm.children if o.type=='MESH' and canonical(o)=='SiruiMesh')
    groups={g.index for g in obj.vertex_groups if g.name.startswith(('Arm.','Forearm.'))}
    arm_ids={v.index for v in obj.data.vertices if any(g.group in groups and g.weight>.1 for g in v.groups)}
    rows=[]
    for clip in ('idle','lounge','drink'):
        for track in arm.animation_data.nla_tracks:
            track.mute=track.name!=clip
        for frame in (1,49,97):
            scene.frame_set(frame)
            evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
            me=evaluated.to_mesh()
            me.calc_loop_triangles()
            vertices=[evaluated.matrix_world@v.co for v in me.vertices]
            skin=[tuple(t.vertices) for t in me.loop_triangles if canonical(me.materials[t.material_index])=='skin' and any(i in arm_ids for i in t.vertices)]
            shirt=[tuple(t.vertices) for t in me.loop_triangles if canonical(me.materials[t.material_index])=='Sirui shirt']
            a,b=BVHTree.FromPolygons(vertices,skin,all_triangles=True),BVHTree.FromPolygons(vertices,shirt,all_triangles=True)
            pairs=a.overlap(b)
            count,length=0,0
            if pairs:
                points=np.array(vertices,dtype=np.float64)
                p0,p1,distances,coplanar=segments(points[np.array(skin,dtype=np.int32)[[i for i,j in pairs]]],points[np.array(shirt,dtype=np.int32)[[j for i,j in pairs]]])
                count=int((distances>1e-6).sum())
                length=float(distances.sum())
            rows.append({'clip':clip,'frame':frame,'crossingTrianglePairs':count,'intersectionLength':length})
            evaluated.to_mesh_clear()
    return rows


def inspect(scene,style):
    arm = next(o for o in scene.objects if o.type == 'ARMATURE')
    mesh = next(o for o in arm.children if o.type == 'MESH' and canonical(o) == 'SiruiMesh')
    names = {g.index:g.name for g in mesh.vertex_groups}
    materials = {i:canonical(material) for i,material in enumerate(mesh.data.materials)}
    skin_faces = [p for p in mesh.data.polygons if materials[p.material_index] == 'skin']
    skin_ids = sorted({i for p in skin_faces for i in p.vertices})
    skin = [{'id':i,'co':list(mesh.data.vertices[i].co),'weights':sorted((names[g.group],g.weight) for g in mesh.data.vertices[i].groups)} for i in skin_ids]
    shirt_ids = sorted({i for p in mesh.data.polygons if materials[p.material_index] == 'Sirui shirt' for i in p.vertices})
    bones = [{'name':b.name,'parent':b.parent.name if b.parent else None,'matrix':[list(row) for row in b.matrix_local]} for b in arm.data.bones]
    clips = {}
    for track in arm.animation_data.nla_tracks:
        strip = track.strips[0]
        curves = []
        for curve in strip.action.fcurves:
            curves.append({'path':curve.data_path,'index':curve.array_index,'keys':[[list(p.co),list(p.handle_left),list(p.handle_right),p.interpolation] for p in curve.keyframe_points]})
        clips[track.name] = {'frames':[strip.frame_start,strip.frame_end],'actionFrames':[strip.action_frame_start,strip.action_frame_end],'repeat':strip.repeat,'curvesSha256':digest(sorted(curves,key=lambda c:(c['path'],c['index'])))}
    blinks = []
    for obj in arm.children:
        if obj.type == 'MESH' and obj.data.shape_keys:
            keys = obj.data.shape_keys.key_blocks
            for name in ('BlinkL','BlinkR'):
                if name in keys:
                    blinks.append({'object':canonical(obj),'key':name,'sha256':digest([list(p.co) for p in keys[name].data])})
    assert len(clips) == 14
    assert len(blinks) == 2
    return {'skinSha256':digest({'vertices':skin,'faces':[list(p.vertices) for p in skin_faces]}),'skinVertices':len(skin),'skinFaces':len(skin_faces),'rigSha256':digest(bones),'bones':len(bones),'clips':clips,'blinks':blinks,'shirt':{i:list(mesh.matrix_world @ mesh.data.vertices[i].co) for i in shirt_ids},'allVertices':len(mesh.data.vertices),'allFaces':len(mesh.data.polygons)}


def main():
    assert bpy.app.version == (4,5,9),bpy.app.version_string
    args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--master',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    opts = parser.parse_args(args)
    opts.master,opts.out = opts.master.resolve(),opts.out.resolve()
    originals = {}
    original_cuffs = {}
    inputs = {}
    for style in STYLES:
        source = ROOT/f'artwork/coastal-home/sirui-{style}.blend'
        inputs[style] = sha256(source)
        bpy.ops.wm.open_mainfile(filepath=str(source))
        originals[style] = inspect(bpy.context.scene,style)
        original_cuffs[style] = cuff_contacts(bpy.context.scene)
    bpy.ops.wm.open_mainfile(filepath=str(opts.master))
    report = {'blender':bpy.app.version_string,'masterSha256':sha256(opts.master),'originalInputSha256':inputs,'avatars':{}}
    for style in STYLES:
        scene = next(scene for scene in bpy.data.scenes if scene.get('finishAvatar') == style)
        bpy.context.window.scene = scene
        before,after = originals[style],inspect(scene,style)
        for field in ('skinSha256','skinVertices','skinFaces','rigSha256','bones','clips','blinks','allVertices','allFaces'):
            assert before[field] == after[field],(style,field)
        assert before['shirt'].keys() == after['shirt'].keys()
        movements = [sum((a-b)**2 for a,b in zip(before['shirt'][i],after['shirt'][i]))**.5 for i in before['shirt']]
        maximum = max(movements,default=0)
        assert .001 < maximum < .07,(style,maximum)
        report['avatars'][style] = {key:value for key,value in after.items() if key != 'shirt'}
        report['avatars'][style]['maximumClothRestDisplacement'] = maximum
        after_cuffs=cuff_contacts(scene)
        report['avatars'][style]['cuffContactScope']='Actual arm-skin/shirt triangle-intersection segments in nine explicit native poses, including hidden upper attachment; not a continuous or exposed-surface guarantee.'
        report['avatars'][style]['cuffContacts']={'before':original_cuffs[style],'after':after_cuffs}
        before_length=sum(row['intersectionLength'] for row in original_cuffs[style])
        after_length=sum(row['intersectionLength'] for row in after_cuffs)
        assert after_length<before_length,(style,before_length,after_length)
        print('CUFF-CONTACTS',style,before_length,after_length,flush=True)
        print('CHARACTER-NATIVE-AUDIT',style,'skin/joints/actions/Blink exact','maximum cloth displacement',maximum,flush=True)
    for style,expected in inputs.items():
        assert sha256(ROOT/f'artwork/coastal-home/sirui-{style}.blend') == expected
    opts.out.parent.mkdir(parents=True,exist_ok=True)
    opts.out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')


if __name__ == '__main__':
    main()
