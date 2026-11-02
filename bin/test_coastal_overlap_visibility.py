"""Actual Blender closed-solid controls for conservative same-owner cover.

Blender4.5.9 --background --factory-startup --python-exit-code1 --python THIS --
 --out=NEW_PRIVATE_QA_JSON
"""
import hashlib
import json
from pathlib import Path
import sys
import bpy
import bmesh
from mathutils import Matrix
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'bin'))
import audit_coastal_overlaps as audit

assert bpy.app.version == (4, 5, 9)
args = {a[2:].split('=', 1)[0]: a.split('=', 1)[1] for a in sys.argv if a.startswith('--') and '=' in a}
out = Path(args['out']).resolve()
assert not out.exists() and out.is_relative_to(ROOT / '.jekyll-cache/visual-qa')

def object_boxes(name, boxes, open_cover=False):
    bm = bmesh.new()
    for index, (lo, hi) in enumerate(boxes):
        size = [hi[k] - lo[k] for k in range(3)]
        centre = [(lo[k] + hi[k]) / 2 for k in range(3)]
        result = bmesh.ops.create_cube(bm, size=1, matrix=Matrix.Translation(centre) @ Matrix.Diagonal((*size, 1)))
        if open_cover and index == len(boxes) - 1:
            vertices = set(result['verts'])
            face = next(f for f in bm.faces if all(v in vertices for v in f.verts) and f.normal.z > .5)
            bmesh.ops.delete(bm, geom=[face], context='FACES_ONLY')
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj

base = ((-1, -1, -.2), (1, 1, 0))
overlapping_cover = ((-.8, -.8, -.01), (.8, .8, .03))
separated_cover = ((-.8, -.8, .01), (.8, .8, .03))
rows = []
for case, cover, open_cover, expected in [
    ('uncovered-real-coplanar', None, False, False),
    ('closed-same-owner-cover', overlapping_cover, False, True),
    ('air-gap-is-not-a-closed-interior', separated_cover, False, False),
    ('open-batch-cannot-prove-solid-cover', overlapping_cover, True, False),
]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    a = object_boxes('core_test_a', [base] + ([cover] if cover else []), open_cover)
    object_boxes('core_test_b', [base])
    meshes, _ = audit.collect(bpy.context.scene)
    trees = audit.build_trees(meshes)
    point = np.array([0., 0., audit.BURY_OFFSET])
    normal = np.array([0., 0., 1.])
    skip = set(range(len(meshes)))
    old = audit.buried(meshes, trees, point, skip, normal)
    actual = audit.buried(meshes, trees, point, skip, normal, pair_interiors=True)
    assert old is False and actual is expected, (case, old, actual)
    rows.append({'case': case, 'legacyBuried': old, 'actualBuried': actual, 'expectedBuried': expected, 'closedOwners': {m['name']: m['closed'] for m in meshes}})

# An optional source-bound house witness supplements the portable solid controls.
source_sha = None
witness = None
assert ('source' in args) == ('source-sha256' in args)
if 'source' in args:
    source = Path(args['source']).resolve()
    source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
    assert source_sha == args['source-sha256']
    bpy.ops.wm.open_mainfile(filepath=str(source))
    meshes, _ = audit.collect(bpy.context.scene)
    selected = [m for m in meshes if m['name'] in {'core__golden coastal sandstone', 'core_breakfast_nook__chalk limestone'}]
    assert len(selected) == 2
    trees = audit.build_trees(selected)
    point = np.array([-7.85 + audit.BURY_OFFSET, -6.385, .56])
    normal = np.array([1., 0., 0.])
    assert not audit.buried(selected, trees, point, {0, 1}, normal)
    assert audit.buried(selected, trees, point, {0, 1}, normal, pair_interiors=True)
    providers = [{'owner': m['name'], 'closed': m['closed'], 'winding': [audit.winding(tree, point, direction) for direction in audit.DIRS], 'contains': audit.is_inside(tree, point)} for m, tree in zip(selected, trees)]
    assert any(p['owner'] == 'core_breakfast_nook__chalk limestone' and p['closed'] and p['contains'] for p in providers)
    witness = {'pointNative': point.tolist(), 'normalNative': normal.tolist(), 'newLinerInterior': True, 'providers': providers}
result = {'sourceSha256': source_sha, 'toolSha256': hashlib.sha256((ROOT / 'bin/audit_coastal_overlaps.py').read_bytes().replace(b'\r\n', b'\n')).hexdigest(), 'controls': rows, 'actualNativeWitness': witness, 'scope': 'Closed-solid winding only for pair-owned interior cover; same-facing exposed duplicates still fail, open owners and real air gaps cannot supply this new proof. Existing tolerances, sealing rays, grazing classification and regression ratchets are unchanged.'}
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
print(json.dumps({'controls': len(rows), 'actualNativeWitness': witness is not None, 'passed': True}))
