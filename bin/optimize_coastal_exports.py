"""Export bounded web geometry from the retained high-resolution Blender source."""
import bpy
import json
import sys
import re
import hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'bin'))
args={a[2:].split('=',1)[0]:a.split('=',1)[1] for a in sys.argv if a.startswith('--') and '=' in a}
def option_path(name,default):
    path=Path(args.get(name,default))
    return path if path.is_absolute() else ROOT/path
source=option_path('source','artwork/coastal-home/coastal-home.blend')
manifest=option_path('manifest','assets/models/home/manifest.json')
models_out=option_path('models-out','assets/models/home')
models_out.mkdir(parents=True,exist_ok=True)
room=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--room=')),None)
interiors_only='--interiors-only' in sys.argv
draco_level=int(next((a.split('=',1)[1] for a in sys.argv if a.startswith('--draco-level=')),'7'))
assert 0 <= draco_level <= 10,draco_level
ROOMS=tuple(room['id'] for room in json.loads(manifest.read_text(encoding='utf-8'))['rooms'])
assert room is None or room in ROOMS,room
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene
report=[]
planar_report=[]
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
    retained_geology=o.name in ('core__golden coastal sandstone','coast_shared_golden coastal sandstone')
    if used_materials and (retained_geology or all(m and 'sandstone' in m.name.lower() for m in used_materials)) and all(m and
            not (m.use_nodes and any(n.type=='TEX_IMAGE' and n.image and
                 any(output.is_linked for output in n.outputs) for n in m.node_tree.nodes))
            for m in used_materials):
        for layer in list(o.data.uv_layers):o.data.uv_layers.remove(layer)
    if o.name == 'core__golden coastal sandstone':
        from coastal_export_geometry import compact_constant_planar, install_exact_export_normals
        planar_report.append({'mesh':o.name,**compact_constant_planar(o.data)})
        install_exact_export_normals()
    before=len(o.data.polygons)
    # Batching renames the mainland by material. Preserve those contact meshes
    # and their authored split normals; decimation here facets the cave jambs.
    if before>14000 and not any(n in o.name for n in ('mainland','ceiling','foundation','golden coastal sandstone','coastal sage scrub')):
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('Web silhouette LOD','DECIMATE');mod.ratio=.42;mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    report.append({'mesh':o.name,'facesBefore':before,'facesExported':len(o.data.polygons)})
if '--active-geology-ao' in sys.argv:
    # Blender4.5 MATERIAL export otherwise inserts white COLOR_0 and sends
    # this unlinked baked attribute as COLOR_1, which the runtime never reads.
    # Connect it only on the static sandstone family. Base factors and all
    # room furnishings/characters retain their authored material graphs.
    for material in bpy.data.materials:
        if not re.fullmatch(r'(?:golden coastal sandstone|La Jolla bluff sandstone|warm sandstone bedding)(?:\.\d+)?',material.name):
            continue
        if not material.use_nodes:
            continue
        nodes,links=material.node_tree.nodes,material.node_tree.links
        bsdf=nodes.get('Principled BSDF')
        if bsdf is None or bsdf.inputs['Base Color'].is_linked:
            raise RuntimeError(f'Geology AO requires the retained unlinked base factor: {material.name}')
        base=list(bsdf.inputs['Base Color'].default_value)
        color=nodes.new('ShaderNodeVertexColor');color.layer_name='Baked bounce'
        multiply=nodes.new('ShaderNodeMix');multiply.data_type='RGBA';multiply.blend_type='MULTIPLY'
        multiply.inputs[0].default_value=1.;multiply.inputs[7].default_value=base
        links.new(color.outputs['Color'],multiply.inputs[6])
        links.new(multiply.outputs[2],bsdf.inputs['Base Color'])
# The clifftop planting streams after the first frame as its own file (refresh_coastal_flora.py).
if 'prepared-source' in args:
    prepared=option_path('prepared-source',args['prepared-source'])
    prepared.parent.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(prepared),compress=True)
exports=[('room-'+room,room+'_')] if room else [('home-shell','core_'),('flora','core_flora_')]+[('room-'+r,r+'_') for r in ROOMS]+[('coast','coast_')]
if interiors_only:exports=[e for e in exports if e[0]!='coast']
# --only=home-shell,room-kitchen re-exports just those files, so unchanged ones keep their bytes.
only=next((a.split('=',1)[1].split(',') for a in sys.argv if a.startswith('--only=')),None)
if only:exports=[e for e in exports if e[0] in only]
for name,prefix in exports:
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects:
        if o.name.startswith(prefix) and not (name=='home-shell' and o.name.startswith('core_flora_')) or name=='home-shell' and o.type=='EMPTY':o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(models_out/f'{name}.glb'),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=draco_level,export_draco_color_quantization=6,export_draco_normal_quantization=8,export_draco_position_quantization=14)
output=option_path('report','artwork/coastal-home/reviews/web-export.json')
output.parent.mkdir(parents=True,exist_ok=True)
if room and output.exists():
    report=[m for m in json.loads(output.read_text(encoding='utf-8'))['meshes'] if not m['mesh'].startswith(room+'_')]+report
elif interiors_only and output.exists():
    report=[m for m in json.loads(output.read_text(encoding='utf-8'))['meshes'] if m['mesh'].startswith('coast_')]+report
output.write_text(json.dumps({'bakedColorQuantization':'32 grayscale steps, shared per vertex','dracoColorBits':6,
    'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'activeStaticGeologyAO':'--active-geology-ao' in sys.argv,'constantPlanarCompaction':planar_report,'meshes':report},indent=2)+'\n',encoding='utf-8',newline='\n')
