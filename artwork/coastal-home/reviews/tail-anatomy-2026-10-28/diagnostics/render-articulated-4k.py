from pathlib import Path
import bpy,json,math,hashlib
from mathutils import Vector
qa=Path(__file__).parent;folder=qa/'v22';data=json.loads((folder/'render-geometry.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
house=Path('C:/dev/site-takeover-worktrees/finish-house/.jekyll-cache/visual-qa/finish-house-2026-10-26/models-v84/room-sleep.glb')
bpy.ops.import_scene.gltf(filepath=str(house))
for obj in bpy.context.scene.objects:
 if obj.type=='MESH' and (obj.name.startswith('sleep_reno_wardrobe') or obj.name.startswith('sleep_reno_arch')):obj.hide_render=True
# Only room-shell/wardrobe obstructions are omitted in this diagnostic closeup;
# bed, made cover, every person mesh and the full tail remain rendered.
for part in data['meshes']:
 mesh=bpy.data.meshes.new(part['name']);mesh.from_pydata([(x,-z,y) for x,y,z in part['points']],[],part['faces']);mesh.update()
 obj=bpy.data.objects.new(part['name'],mesh);bpy.context.scene.collection.objects.link(obj)
 material=bpy.data.materials.new(part['material']);material.diffuse_color=(*part['color'],1);material.use_nodes=True
 bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*part['color'],1);bsdf.inputs['Roughness'].default_value=part.get('roughness',.5)
 mesh.materials.append(material)
 for face in mesh.polygons:face.use_smooth=True
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.world=bpy.data.worlds.new('diagnostic studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.7,.8,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
def light(location,power,size):
 d=bpy.data.lights.new('diagnostic softbox','AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(d.name,d);scene.collection.objects.link(o);o.location=location;o.rotation_euler=(Vector((-7,-7,2.4))-o.location).to_track_quat('-Z','Y').to_euler()
light((-6,-8.2,5),400,4);light((-8,-5,4),150,3)
camdata=bpy.data.cameras.new('actual geometry inspection');cam=bpy.data.objects.new(camdata.name,camdata);scene.collection.objects.link(cam);scene.camera=cam
cam.location=(-5.6,-8.5,3.2);target=Vector((-7.05,-6.98,2.35));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=60
scene.render.resolution_x=3840;scene.render.resolution_y=2160;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(folder/'rejected-roll-native-4k.png')
scene.view_settings.view_transform='AgX';bpy.ops.render.render(write_still=True)
evidence={'scope':data['scope'],'image':'rejected-roll-native-4k.png','actualRenderPixels':[3840,2160],'renderer':'Blender4.5.9 Cycles CPU12samples, diagnostic studio light','sourceGlbSha256':data['sourceGlbSha256'],'roomSha256':hashlib.sha256(house.read_bytes()).hexdigest(),'poseGeometrySha256':hashlib.sha256((folder/'render-geometry.json').read_bytes()).hexdigest(),'phase':data['phase'],'seconds':data['seconds'],'camera':list(cam.location),'target':list(target),'omission':'Wardrobe and room-shell obstructions omitted for diagnostic cross-section only; bed, made cover and all person/tail meshes retained. Not a public full-scene admission image.'}
(folder/'render-evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
