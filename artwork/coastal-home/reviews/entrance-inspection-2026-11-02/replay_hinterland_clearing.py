"""Retire only source-bound complete shrub mounds intersecting the actual new shaft."""
import argparse,gzip,bpy,hashlib,json,runpy,sys
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo-root',type=Path,required=True)
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--source-sha256',required=True)
parser.add_argument('--census',type=Path,required=True)
parser.add_argument('--census-sha256',required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
root=args.repo_root.resolve();out=args.output.resolve()
qa=root/'.jekyll-cache/visual-qa'
if qa not in out.parents or out.exists():raise ValueError('A fresh owned QA output is required')
q=Path(__file__).parent
sys.path.insert(0,str(root/'bin'))
import coastal_breakfast_nook as nook
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=args.source.resolve()
census_path=args.census.resolve()
raw=census_path.read_bytes();assert sha(census_path)==args.census_sha256
census=json.loads(gzip.decompress(raw)if raw[:2]==b'\x1f\x8b'else raw)
assert census['sourceSha256']==args.source_sha256
assert sha(source)==census['sourceSha256'] and bpy.app.version==(4,5,9)
out.mkdir(parents=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
ns=runpy.run_path(str(root/'artwork/coastal-home/reviews/bedroom-ambience-2026-11-01/replay_lighting.py'))
before=ns['native_state']();materials=ns['materials']();removed={};expected={};counts=[]
assert len(census['affected'])==8
for row in census['affected']:
    assert row['owner']=='hinterland_flora_10_09' and row['materials']==['hinterland scrub canopy']
    assert (len(row['vertices']),len(row['faces']))in[(28,45),(13,18)]
    obj=bpy.data.objects[row['owner']]
    matching=[r for r in nook._islands(obj)if r['faces']==set(row['faces'])and set(r['vertices'])==set(row['vertices'])]
    assert len(matching)==1 and matching[0]['lo']==row['lo'] and matching[0]['hi']==row['hi']
    removed.setdefault(row['owner'],set()).update(row['faces'])
for name,faces in removed.items():
    obj=bpy.data.objects[name];original=obj.data
    retained=set(range(len(original.polygons)))-faces
    subset=nook._subset(original,retained,name+' source-bound cleared mesh')
    proxy=bpy.data.objects.new('private exact retained field witness',subset);proxy.matrix_world=obj.matrix_world.copy()
    expected[name]=ns['geometry'](proxy)
    assert [subset.polygons[i].material_index for i in range(len(subset.polygons))]==[original.polygons[i].material_index for i in sorted(retained)]
    bpy.data.objects.remove(proxy)
    counts.append({'owner':name,'originalPolygons':len(original.polygons),'retiredPolygons':len(faces),'retainedPolygons':len(subset.polygons),'exactRetainedNativeGeometry':expected[name]})
    obj.data=subset
after=ns['native_state']()
assert all(before[name]==after[name]for name in before if name not in removed)
assert all(after[name]['geometry']==expected[name]for name in removed)
assert ns['materials']()==materials
bpy.context.scene['straightArrivalHinterlandClearing']=1
candidate=out/'candidate.blend'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(candidate),compress=True)
bpy.ops.wm.open_mainfile(filepath=str(candidate))
assert ns['native_state']()==after and ns['materials']()==materials
assert sha(source)==census['sourceSha256']
receipt={'scope':'PRIVATE physical retirement of8 whole original shrub mound components /279triangles with finite intersection against the exact piecewise straight-arrival shaft. No trunk/talus/ground changes, no owner-wide retirement, no field interpolation/new AO. Every retained native P/N/UV/color/port/material field checked by exact subset and saved reopen. Canonical source unchanged; export/cache/body/appearance gates separate.','sourceSha256':sha(source),'candidateSha256':sha(candidate),'censusSha256':sha(census_path),'producerSha256':sha(Path(__file__)),'unownedMeshesExact':len(before)-len(removed),'owners':counts,'removed':census['affected']}
(out/'CLEARING.json').write_text(json.dumps(receipt,indent=2)+'\n')
# The existing hinterland's declared codec, not the coastal geology adapter.
bpy.ops.object.select_all(action='SELECT')
export=out/'hinterland.glb'
bpy.ops.export_scene.gltf(filepath=str(export),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_texcoords=False,export_normals=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_image_format='NONE',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7,export_draco_position_quantization=16,export_draco_normal_quantization=10,export_draco_color_quantization=8)
receipt['export']={'sha256':sha(export),'bytes':export.stat().st_size,'positionBits':16,'normalBits':10,'colorBits':8,'separateFromNativeFieldProof':True}
(out/'CLEARING.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:receipt[k]for k in['candidateSha256','unownedMeshesExact','owners','export']},indent=2))
