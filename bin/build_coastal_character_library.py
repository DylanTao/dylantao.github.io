"""Assemble the five finished, editable avatars in a separate Blender library.

The original five blends remain immutable. Each style has its own scene, native
rig, fourteen NLA clips and Blink shape keys. Export a library with Blender 4.5.9:
  blender -b --python-exit-code 1 --python bin/build_coastal_character_library.py -- \
    --source-dir=<finished scratch sources> --out=<scratch library directory>
  ... --master=artwork/coastal-home/character-finish.blend --export-only --out=<dir>
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'bin'))
from coastal_character_finish import STYLES
from refresh_coastal_character_finish import select_only


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export_active_avatar(arm, target):
    for track in arm.animation_data.nla_tracks:
        track.mute = False
    for child in arm.children:
        keys = child.data.shape_keys if child.type == 'MESH' else None
        if keys and keys.animation_data:
            for track in keys.animation_data.nla_tracks:
                track.mute = False
    select_only([arm]+[obj for obj in arm.children if obj.type == 'MESH'],arm)
    bpy.ops.export_scene.gltf(
        filepath=str(target), export_format='GLB', use_selection=True,
        use_active_scene=True, export_yup=True, export_animations=True,
        export_animation_mode='NLA_TRACKS', export_force_sampling=True,
        export_extras=True, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )


def tag_source(style, source, target):
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    scene.name = 'character-'+style
    scene['finishAvatar'] = style
    arm = next(o for o in scene.objects if o.type == 'ARMATURE')
    arm['finishAvatar'] = style
    for obj in scene.objects:
        obj['finishCanonicalName'] = obj.name
    for material in bpy.data.materials:
        material['finishCanonicalName'] = material.name
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True)


def export_library(master, out):
    bpy.ops.wm.open_mainfile(filepath=str(master))
    scenes = {scene['finishAvatar']: scene for scene in bpy.data.scenes if scene.get('finishAvatar')}
    assert set(scenes) == set(STYLES), set(scenes)
    report = {'blender': bpy.app.version_string, 'masterSha256': sha256(master), 'avatars': {}}
    for style in STYLES:
        scene = scenes[style]
        bpy.context.window.scene = scene
        arm = next(o for o in scene.objects if o.type == 'ARMATURE' and o.get('finishAvatar') == style)
        objects = list(bpy.data.objects)
        materials = list(bpy.data.materials)
        old_objects = [(obj, obj.name) for obj in objects]
        old_materials = [(mat, mat.name) for mat in materials]
        # Blender's global datablock names acquire .001 suffixes in a five-scene
        # library. Restore the retained export names only for this selected rig.
        # Bone names and NLA-track labels are already local to each rig.
        for i, obj in enumerate(objects):
            obj.name = '_finish_hold_object_'+str(i)
        for i, mat in enumerate(materials):
            mat.name = '_finish_hold_material_'+str(i)
        for obj in scene.objects:
            obj.name = obj.get('finishCanonicalName', obj.name)
        used = {slot.material for obj in [arm, *arm.children] if obj.type == 'MESH' for slot in obj.material_slots if slot.material}
        for material in used:
            material.name = material['finishCanonicalName']
        assert len(arm.animation_data.nla_tracks) == 14
        target = out/f'sirui-{style}.glb'
        export_active_avatar(arm, target)
        report['avatars'][style] = {'glbSha256': sha256(target), 'bytes': target.stat().st_size, 'clips': [track.name for track in arm.animation_data.nla_tracks]}
        for i, obj in enumerate(objects):
            obj.name = '_finish_restore_object_'+str(i)
        for i, mat in enumerate(materials):
            mat.name = '_finish_restore_material_'+str(i)
        for obj, name in old_objects:
            obj.name = name
        for mat, name in old_materials:
            mat.name = name
        print('LIBRARY-EXPORT', style, report['avatars'][style], flush=True)
    assert sha256(master) == report['masterSha256']
    return report


def main():
    assert bpy.app.version == (4,5,9), bpy.app.version_string
    args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path)
    parser.add_argument('--master', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--export-only', action='store_true')
    opts = parser.parse_args(args)
    opts.out = opts.out.resolve()
    opts.source_dir = opts.source_dir.resolve() if opts.source_dir else None
    opts.master = opts.master.resolve() if opts.master else None
    opts.out.mkdir(parents=True, exist_ok=True)
    master = opts.master or opts.out/'character-finish.blend'
    inputs = {}
    if not opts.export_only:
        assert opts.source_dir, '--source-dir is required to assemble a library'
        tagged = opts.out/'tagged-inputs'
        tagged.mkdir(exist_ok=True)
        for style in STYLES:
            source = opts.source_dir/f'sirui-{style}.blend'
            inputs[style] = sha256(source)
            tag_source(style, source, tagged/source.name)
            assert sha256(source) == inputs[style]
        bpy.ops.wm.read_factory_settings(use_empty=True)
        empty = list(bpy.data.scenes)
        for style in STYLES:
            with bpy.data.libraries.load(str(tagged/f'sirui-{style}.blend'), link=False) as (data_from, data_to):
                data_to.scenes = ['character-'+style]
            assert data_to.scenes[0]['finishAvatar'] == style
        for scene in empty:
            bpy.data.scenes.remove(scene)
        bpy.context.window.scene = next(scene for scene in bpy.data.scenes if scene.get('finishAvatar') == 'lizard')
        for scene in bpy.data.scenes:
            scene['finishLibraryVersion'] = 1
            scene['finishInputSha256'] = inputs[scene['finishAvatar']]
        bpy.context.preferences.filepaths.save_version = 0
        master.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(master), compress=True)
    report = export_library(master, opts.out)
    if inputs:
        report['inputSourceSha256'] = inputs
    (opts.out/'library-receipt.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')


if __name__ == '__main__':
    main()
