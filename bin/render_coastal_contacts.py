"""Actual Blender contact/pose review of each retained avatar and animal master."""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artwork/coastal-home/reviews';OUT.mkdir(exist_ok=True)

def studio(target,position,scale):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
    for d in prefs.devices:d.use=d.type=='CUDA'
    scene.cycles.device='GPU'
    scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('Soft neutral contact review');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.58,.60,.61,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.55
    bpy.ops.object.light_add(type='AREA',location=(-3,-4,6));light=bpy.context.object;light.data.energy=450;light.data.size=4
    light.rotation_euler=(Vector(target)-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015))
    bpy.ops.object.camera_add(location=position);cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=scale
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
    scene.view_settings.view_transform='AgX'
    return scene

for avatar in ('lizard','south-park','simpsons','ghibli','rick-and-morty'):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'artwork/coastal-home'/f'sirui-{avatar}.blend'))
    arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    for track in arm.animation_data.nla_tracks:track.mute=track.name!='typing'
    bpy.context.scene.frame_set(28)
    scene=studio((0,-.15,.67),(2.8,-4.6,2.4),1.85)
    # Exact fitted support heights: cushion top 51.5 cm, footrest top 22 cm.
    for name,location,size in [('seat',(0,0,.49),(.56,.64,.05)),('footrest',(0,-.37,.11),(.49,.28,.22)),('keyboard',(0,-.43,.89),(.48,.22,.02))]:
        bpy.ops.mesh.primitive_cube_add(size=1,location=location);support=bpy.context.object;support.name=name;support.scale=size
    scene.render.filepath=str(OUT/f'{avatar}-seated.png');bpy.ops.render.render(write_still=True)
    for pose in ('pullup','dip','coffee-prep'):
        bpy.ops.wm.open_mainfile(filepath=str(ROOT/'artwork/coastal-home'/f'sirui-{avatar}.blend'))
        arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
        for track in arm.animation_data.nla_tracks:track.mute=track.name!=pose
        bpy.context.scene.frame_set(28)
        scene=studio((0,-.08,1.55 if pose=='pullup' else 1.05),(3.2,-5.2,2.8),2.8)
        grips=[(-.30,-.01,2.322),(.30,-.01,2.322)] if pose=='pullup' else [(-.43,-.01,1.192),(.43,-.01,1.192)] if pose=='dip' else [(0,-.47,.89)]
        for x,y,z in grips:
            bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z));support=bpy.context.object
            support.name='Authored grip' if pose!='coffee-prep' else 'Work surface'
            support.scale=(.055,.37,.055) if pose!='coffee-prep' else (.60,.30,.035)
        scene.render.filepath=str(OUT/f'{avatar}-{pose}.png');bpy.ops.render.render(write_still=True)

bpy.ops.wm.open_mainfile(filepath=str(ROOT/'artwork/coastal-home/wildlife.blend'))
scene=studio((2,0,.25),(4,-7,3.4),6.4)
scene.render.resolution_x=1200;scene.render.resolution_y=600
scene.render.filepath=str(OUT/'wildlife-masters.png');bpy.ops.render.render(write_still=True)
