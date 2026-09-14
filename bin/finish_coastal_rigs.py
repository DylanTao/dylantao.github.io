"""Apply the cuff weighting checkpoint to retained rigs without remeshing faces."""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
for avatar in ('lizard','south-park','simpsons','ghibli','rick-and-morty'):
    path=ROOT/'artwork/coastal-home'/f'sirui-{avatar}.blend'
    bpy.ops.wm.open_mainfile(filepath=str(path))
    mesh=bpy.data.objects['SiruiMesh'];arm=bpy.data.objects['Sirui']
    width=.255 if avatar=='lizard' else .25 if avatar=='south-park' else .16 if avatar=='rick-and-morty' else .235
    vertices={v for p in mesh.data.polygons if mesh.data.materials[p.material_index].name=='Sirui shirt' for v in p.vertices}
    for group in mesh.vertex_groups:group.remove(list(vertices))
    for index in vertices:
        co=mesh.matrix_world @ mesh.data.vertices[index].co
        clamp=lambda value:max(0,min(1,value))
        t=clamp((abs(co.x)-width*.55)/(width*.5))*clamp((co.z-.76)/.10)
        for bone,w in [('Arm.'+('L' if co.x<0 else 'R'),t),('Spine',1-t)]:
            if w>.001:(mesh.vertex_groups.get(bone) or mesh.vertex_groups.new(name=bone)).add([index],w,'REPLACE')
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
    for track in arm.animation_data.nla_tracks:track.mute=False
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/models/home'/f'sirui-{avatar}.glb'),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_extras=True,export_lights=False,export_cameras=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12)
