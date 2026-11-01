"""Verify the bake changed only the owned contact/bounce attributes."""
import bpy
import hashlib
import json
import sys
from pathlib import Path
import numpy as np

root = Path.cwd()
sys.path.insert(0, str(root / 'bin'))
from refresh_coastal_study_hardware import immutable_scene_digest
q = root / '.jekyll-cache/visual-qa/interior-integration-20261031'
prefixes = ('study_', 'library_', 'library-upper_')
rows = []
for name in ['candidate-pre-ao.blend', 'candidate-ao.blend']:
    bpy.ops.wm.open_mainfile(filepath=str(q / name))
    scene = bpy.context.scene
    normals = hashlib.sha256()
    fields = []
    for obj in sorted(scene.objects, key=lambda x:x.name):
        if obj.type != 'MESH':
            continue
        normals.update(obj.name.encode())
        normals.update(np.array([n.vector[:] for n in obj.data.corner_normals], dtype='<f4').tobytes())
        if obj.name.startswith(prefixes):
            for attr in list(obj.data.color_attributes):
                fields.append({'mesh': obj.name, 'name': attr.name, 'corners': len(attr.data)})
                obj.data.color_attributes.remove(attr)
    rows.append({'source': name, 'geometryAndUnownedAttributesSha256': immutable_scene_digest(scene, {}),
                 'effectiveNormalsSha256': normals.hexdigest(), 'ownedColorFields': fields})
assert rows[0]['geometryAndUnownedAttributesSha256'] == rows[1]['geometryAndUnownedAttributesSha256']
assert rows[0]['effectiveNormalsSha256'] == rows[1]['effectiveNormalsSha256']
report = {'method': 'Remove only owned study/library/upper color attributes in memory, then compare every native mesh/transform/topology/material slot/remaining attribute and effective corner normal',
          'exactOutsideOwnedColors': True, 'rows': rows}
(q / 'ao-preservation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
print('AO preservation exact; all geometry and effective normals retained', rows[0]['geometryAndUnownedAttributesSha256'])
