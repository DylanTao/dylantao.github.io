"""Export bounded web geometry from the retained high-resolution Blender source."""
import bpy
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'artwork/coastal-home/coastal-home.blend'))
scene=bpy.context.scene
report=[]
for o in scene.objects:
    if o.type!='MESH':continue
    attr=o.data.color_attributes.active_color
    if attr:
        sums=[0.0]*len(o.data.vertices);counts=[0]*len(sums)
        for loop,color in zip(o.data.loops,attr.data):
            i=loop.vertex_index;sums[i]+=sum(color.color[:3])/3;counts[i]+=1
        for a in list(o.data.color_attributes):o.data.color_attributes.remove(a)
        attr=o.data.color_attributes.new(name='Baked bounce',type='BYTE_COLOR',domain='POINT')
        for i,c in enumerate(attr.data):
            v=round(sums[i]/max(1,counts[i])*32)/32
            c.color=(v,v,v,1)
        o.data.color_attributes.active_color=attr
    before=len(o.data.polygons)
    # Batching renames the mainland by material. Preserve those contact meshes
    # and their authored split normals; decimation here facets the cave jambs.
    if before>14000 and not any(n in o.name for n in ('mainland','ceiling','foundation','golden coastal sandstone','coastal sage scrub')):
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('Web silhouette LOD','DECIMATE');mod.ratio=.42;mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    report.append({'mesh':o.name,'facesBefore':before,'facesExported':len(o.data.polygons)})
for name,prefix in [('home-shell','core_')]+[('room-'+r,r+'_') for r in ('study','sleep','kitchen','gym','onsen','lounge')]+[('coast','coast_')]:
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects:
        if o.name.startswith(prefix) or name=='home-shell' and o.type=='EMPTY':o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/models/home'/f'{name}.glb'),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7,export_draco_color_quantization=6,export_draco_normal_quantization=8,export_draco_position_quantization=14)
(ROOT/'artwork/coastal-home/reviews/web-export.json').write_text(json.dumps({'bakedColorQuantization':'32 grayscale steps, shared per vertex','dracoColorBits':6,'meshes':report},indent=2)+'\n')
