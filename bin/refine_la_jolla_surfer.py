"""Patch only Surfer1 in both saved sources, then export each without rebuilding the coast.

Run Blender 4.5.9 --background --python bin/refine_la_jolla_surfer.py -- --report <file>.
Untouched native object/material fingerprints must survive save/reopen exactly. The report
also records the Blender file-subversion warning's actual semantic comparison boundary.
"""
import hashlib
import json
import sys
import tempfile
import struct
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'bin'))
from coastal_surfer import refine_rider_board


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def properties(value):
    return {k: value[k].to_list() if hasattr(value[k], 'to_list') else value[k] for k in value.keys()}


def snapshot():
    objects = {}
    for o in bpy.data.objects:
        if o.name == 'Surfer1' or any(p.name == 'Surfer1' for p in parents(o)):
            continue
        state = dict(type=o.type, parent=o.parent.name if o.parent else None,
                     matrix=[list(row) for row in o.matrix_local], hide=(o.hide_render, o.hide_viewport), props=properties(o))
        if o.type == 'MESH':
            d = o.data
            state['mesh'] = dict(vertices=[list(v.co) for v in d.vertices], edges=[list(e.vertices) for e in d.edges],
                                 polygons=[(list(p.vertices), p.material_index, p.use_smooth) for p in d.polygons],
                                 materials=[m.name for m in d.materials],
                                 attributes={a.name: [getattr(v, 'value', getattr(v, 'vector', getattr(v, 'color', None)))[:] if hasattr(getattr(v, 'value', getattr(v, 'vector', getattr(v, 'color', None))), '__len__') else getattr(v, 'value', None) for v in a.data] for a in d.attributes})
        elif o.type in ('CAMERA', 'LIGHT'):
            state['data'] = {p.identifier: getattr(o.data, p.identifier)[:] if getattr(p, 'is_array', False) else getattr(o.data, p.identifier)
                             for p in o.data.bl_rna.properties if p.type in ('BOOLEAN', 'INT', 'FLOAT', 'ENUM', 'STRING') and p.identifier not in ('name', 'session_uid')}
        state['modifiers'] = [(m.name, m.type, {p.identifier: getattr(m, p.identifier)[:] if getattr(p, 'is_array', False) else getattr(m, p.identifier)
                               for p in m.bl_rna.properties if p.type in ('BOOLEAN', 'INT', 'FLOAT', 'ENUM', 'STRING')}) for m in o.modifiers]
        state['animation'] = {'action': o.animation_data.action.name if o.animation_data.action else None,
                              'nla': [(track.name, [(s.name, s.frame_start, s.frame_end, s.action.name) for s in track.strips]) for track in o.animation_data.nla_tracks]} if o.animation_data else None
        objects[o.name] = state
    materials = {}
    for m in bpy.data.materials:
        if m.name.startswith('Rider board '):
            continue
        nodes = []
        if m.node_tree:
            for n in m.node_tree.nodes:
                nodes.append((n.name, n.type, [(s.name, s.default_value[:] if hasattr(s.default_value, '__len__') else s.default_value) for s in n.inputs if hasattr(s, 'default_value')]))
        materials[m.name] = (list(m.diffuse_color), m.use_nodes, m.roughness, m.metallic, nodes, properties(m))
    return {'objects': objects, 'materials': materials, 'actions': {a.name: digest((a.frame_range[:], properties(a))) for a in bpy.data.actions}}


def parents(obj):
    while obj.parent:
        obj = obj.parent
        yield obj


report = {'blender': bpy.app.version_string, 'build_hash': bpy.app.build_hash.decode(), 'files': {}}
for stem, level in (('la-jolla', 6), ('miniature', 7)):
    native = ROOT / 'artwork/la-jolla' / (stem + '.blend')
    bpy.ops.wm.open_mainfile(filepath=str(native))
    source_version = tuple(bpy.data.version)
    # Blender drops zero-user datablocks on save; retain the source's unused default
    # material explicitly rather than silently losing it during this bounded repair.
    retained_orphans = [m.name for m in bpy.data.materials if m.users == 0]
    for name in retained_orphans:
        bpy.data.materials[name].use_fake_user = True
    before = snapshot()
    refine_rider_board()
    for m in bpy.data.materials:
        if m.users == 0:
            m.use_fake_user = True
            if m.name not in retained_orphans:
                retained_orphans.append(m.name)
    assert snapshot() == before, 'Patch touched an unrelated native object/material'
    bpy.context.preferences.filepaths.save_version = 0
    candidate = Path(tempfile.gettempdir()) / ('coast-surfer-' + stem + '.blend')
    bpy.ops.wm.save_as_mainfile(filepath=str(candidate))
    bpy.ops.wm.open_mainfile(filepath=str(candidate))
    after = snapshot()
    if after != before:
        debug = ROOT / '.jekyll-cache/visual-qa/surfer-2026-10-28'
        debug.mkdir(parents=True, exist_ok=True)
        (debug / 'native-before.json').write_text(json.dumps(before, default=str))
        (debug / 'native-after.json').write_text(json.dumps(after, default=str))
        print('Changed native keys:', {group: [key for key in before[group] if before[group][key] != after[group].get(key)] for group in before})
    assert after == before, 'Untouched native data changed on save/reopen'
    native.write_bytes(candidate.read_bytes())
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:
        campus_only = stem == 'la-jolla' and any(a.name in ('Geisel', 'Salk') for a in [o, *parents(o)])
        if o.type not in ('LIGHT', 'CAMERA') and not campus_only:
            o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT / 'assets/models/la-jolla' / (stem + '.glb')),
        export_format='GLB', use_selection=True, export_cameras=False, export_lights=False, export_animations=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=level)
    if stem == 'la-jolla':
        data = (ROOT / 'assets/models/la-jolla/la-jolla.glb').read_bytes()
        length = struct.unpack_from('<I', data, 12)[0]
        exported = json.loads(data[20:20+length])
        path = ROOT / 'assets/models/la-jolla/manifest.json'
        manifest = json.loads(path.read_text())
        manifest['triangleCount'] = sum(exported['accessors'][p['indices']]['count'] // 3 for m in exported['meshes'] for p in m['primitives'])
        path.write_text(json.dumps(manifest, indent=2) + '\n')
    report['files'][stem] = {'untouched_objects': len(before['objects']), 'untouched_materials': len(before['materials']),
                            'source_version_before': source_version, 'source_version_after': tuple(bpy.data.version),
                            'untouched_snapshot_sha256': digest(before), 'save_reopen_equal': before == after,
                            'retained_orphan_materials': retained_orphans,
                            'scope': 'Surfer1 board material, deck stringer, removed rigid wake only'}
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if '--report' in args:
    Path(args[args.index('--report')+1]).write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
