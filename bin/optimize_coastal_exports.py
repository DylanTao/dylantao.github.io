"""Export bounded web geometry from the retained high-resolution Blender source."""
import bpy
import json
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
room=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--room=')),None)
interiors_only='--interiors-only' in sys.argv
draco_level=int(next((a.split('=',1)[1] for a in sys.argv if a.startswith('--draco-level=')),'7'))
assert 0 <= draco_level <= 10,draco_level
ROOMS=tuple(room['id'] for room in json.loads((ROOT/'assets/models/home/manifest.json').read_text(encoding='utf-8'))['rooms'])
assert room is None or room in ROOMS,room
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'artwork/coastal-home/coastal-home.blend'))
scene=bpy.context.scene
report=[]
for o in scene.objects:
    if o.type!='MESH':continue
    if room and not o.name.startswith(room+'_'):continue
    if interiors_only and o.name.startswith('coast_'):continue
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
    # These rock finishes sample world-space position/normal, never UVs. Keep their authoring UV
    # layers in the native source, but avoid encoding an unused coordinate stream in delivered GLBs.
    used_materials=[o.data.materials[i] for i in {face.material_index for face in o.data.polygons}]
    if used_materials and all(m and 'sandstone' in m.name.lower() and
            not (m.use_nodes and any(n.type=='TEX_IMAGE' and n.image and
                 any(output.is_linked for output in n.outputs) for n in m.node_tree.nodes))
            for m in used_materials):
        for layer in list(o.data.uv_layers):o.data.uv_layers.remove(layer)
    before=len(o.data.polygons)
    # Batching renames the mainland by material. Preserve those contact meshes
    # and their authored split normals; decimation here facets the cave jambs.
    if before>14000 and not any(n in o.name for n in ('mainland','ceiling','foundation','golden coastal sandstone','coastal sage scrub')):
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('Web silhouette LOD','DECIMATE');mod.ratio=.42;mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    report.append({'mesh':o.name,'facesBefore':before,'facesExported':len(o.data.polygons)})
# The clifftop planting streams after the first frame as its own file (refresh_coastal_flora.py).
exports=[('room-'+room,room+'_')] if room else [('home-shell','core_'),('flora','core_flora_')]+[('room-'+r,r+'_') for r in ROOMS]+[('coast','coast_')]
if interiors_only:exports=[e for e in exports if e[0]!='coast']
# --only=home-shell,room-kitchen re-exports just those files, so unchanged ones keep their bytes.
only=next((a.split('=',1)[1].split(',') for a in sys.argv if a.startswith('--only=')),None)
if only:exports=[e for e in exports if e[0] in only]
for name,prefix in exports:
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects:
        if o.name.startswith(prefix) and not (name=='home-shell' and o.name.startswith('core_flora_')) or name=='home-shell' and o.type=='EMPTY':o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/models/home'/f'{name}.glb'),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=draco_level,export_draco_color_quantization=6,export_draco_normal_quantization=8,export_draco_position_quantization=14)
output=ROOT/'artwork/coastal-home/reviews/web-export.json'
if room and output.exists():
    report=[m for m in json.loads(output.read_text())['meshes'] if not m['mesh'].startswith(room+'_')]+report
elif interiors_only and output.exists():
    report=[m for m in json.loads(output.read_text())['meshes'] if m['mesh'].startswith('coast_')]+report
output.write_text(json.dumps({'bakedColorQuantization':'32 grayscale steps, shared per vertex','dracoColorBits':6,'meshes':report},indent=2)+'\n',encoding='utf-8',newline='\n')
