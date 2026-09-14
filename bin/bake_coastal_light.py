"""Bake soft static occlusion and indirect bounce into exported color attributes.

Direct sun and practical lights remain dynamic in Three.js. This small, clamped
modulation supplies local bounce/contact without baking a time of day into color.
"""
import bpy
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'artwork/coastal-home/coastal-home.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='CUDA';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='CUDA'
scene.cycles.device='GPU';scene.cycles.max_bounces=4
scene.world=scene.world or bpy.data.worlds.new('Coastal bounce studio')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.72,.79,.85,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
bpy.ops.object.light_add(type='AREA',location=(0,12,8))
light=bpy.context.object;light.name='Bake only broad sky';light.data.energy=1200;light.data.shape='DISK';light.data.size=12
from mathutils import Vector
light.rotation_euler=(Vector((0,-2,1))-light.location).to_track_quat('-Z','Y').to_euler()
selected=[]
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type=='MESH' and o.name.startswith(('core_','study_','kitchen_','lounge_','sleep_','gym_','onsen_')) and not o.name.startswith('core_continuous') and not o.get('caveRoof'):
        for a in list(o.data.color_attributes):o.data.color_attributes.remove(a)
        a=o.data.color_attributes.new(name='Baked contact and bounce',type='FLOAT_COLOR',domain='CORNER')
        o.data.color_attributes.active_color=a
        o.select_set(True);selected.append(o)
if not selected:raise RuntimeError('No static room surfaces to bake')
bpy.context.view_layer.objects.active=selected[0]
scene.render.bake.target='VERTEX_COLORS'
bpy.ops.object.bake(type='AO',use_clear=True)
occlusion={o.name:[c.color[0] for c in o.data.color_attributes.active_color.data] for o in selected}
bpy.ops.object.bake(type='DIFFUSE',pass_filter={'INDIRECT'},use_clear=True)
stats=[]
for o in selected:
    values=[]
    for i,c in enumerate(o.data.color_attributes.active_color.data):
        ao=max(0,min(1,occlusion[o.name][i]))
        bounce=max(0,min(1,sum(c.color[:3])/3))
        value=.68+.27*ao+.05*bounce
        c.color=(value,value,value,1);values.append(value)
    o['bakedLighting']='Cycles AO + diffuse indirect, 24 samples, neutral modulation'
    stats.append({'mesh':o.name,'corners':len(values),'min':min(values),'max':max(values)})
bpy.data.objects.remove(light,do_unlink=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
for name,prefix in [('home-shell','core_')]+[('room-'+r,r+'_') for r in ('study','sleep','kitchen','gym','onsen','lounge')]:
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects:
        if o.name.startswith(prefix):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/models/home'/f'{name}.glb'),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7)
(ROOT/'artwork/coastal-home/reviews/baked-light.json').write_text(json.dumps({'method':'Cycles AO and diffuse indirect color-attribute bake','samples':24,'surfaces':stats},indent=2)+'\n')
