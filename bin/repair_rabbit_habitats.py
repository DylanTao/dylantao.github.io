"""Refit only the two rabbit loops using the retained planted coast.

Run with Blender --background --python-exit-code 1 --python
bin/repair_rabbit_habitats.py. No plant, terrain, animal mesh, other habitat,
camera grid, or public control is changed. This is an actual habitat-path repair.
"""
import bpy
import copy
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'bin'))
from coastal_camera import create_camera_height
from rabbit_habitats import RABBIT_HABITAT_LOOPS, sample_loop

manifest_path = ROOT / 'assets/models/home/manifest.json'
source = ROOT / 'artwork/coastal-home/coastal-home.blend'
before = json.loads(manifest_path.read_text(encoding='utf-8'))
after = copy.deepcopy(before)
bpy.ops.wm.open_mainfile(filepath=str(source))
objects = list(bpy.context.scene.objects)
height = create_camera_height(objects)
plants = [obj for obj in objects if obj.type == 'MESH' and any(
    material and material.name in ('coastal sage scrub', 'blue sage agave leaf', 'coastal wildflower ochre')
    for material in obj.data.materials)]
assert len(plants) == 3, 'Expected retained scrub, agave and flower batches'
vertices, faces = [], []
for obj in plants:
    offset = len(vertices)
    vertices.extend(obj.matrix_world @ vertex.co for vertex in obj.data.vertices)
    faces.extend(tuple(offset + index for index in face.vertices) for face in obj.data.polygons)
foliage = BVHTree.FromPolygons(vertices, faces)
stencil = [(i*.1, j*.1) for i in range(-3, 4) for j in range(-3, 4) if i*i+j*j <= 10]


def measure(path):
    """Sample a conservative body column and the actual linear support path.

    These discrete geometry probes are an authoring guard, not continuous
    deforming-body collision detection. They deliberately include flowers.
    """
    blocked = 0
    nearest = math.inf
    max_support_error = 0
    count = 0
    for a, b in zip(path, path[1:] + path[:1]):
        for i in range(8):
            t = i / 8
            x, root_z, y = (a[0]*(1-t)+b[0]*t, a[1]*(1-t)+b[1]*t, -(a[2]*(1-t)+b[2]*t))
            ground = height(x, y)
            max_support_error = max(max_support_error, abs(root_z - (ground+.025)))
            nearest = min(nearest, *(foliage.find_nearest(Vector((x, y, ground+z)))[3] for z in (.22, .45, .65)))
            for dx, dy in stencil:
                hit, _, _, _ = foliage.ray_cast(Vector((x+dx, y+dy, ground+.02)), Vector((0, 0, 1)), .83)
                blocked += hit is not None
            count += 1
    return {'bodySamples': count, 'verticalRays': count*len(stencil), 'blockedRays': blocked,
            'minimumBodyCenterToFoliage': nearest, 'maximumLinearSupportError': max_support_error}


report = {'source': str(source), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'bodyColumn': {'radius': math.sqrt(10)*.1, 'bottom': .02, 'top': .85, 'stencilPoints': len(stencil)},
          'foliageMeshes': [obj.name for obj in plants], 'habitats': {}}
for key, loop in RABBIT_HABITAT_LOOPS.items():
    path = sample_loop(loop, height)
    original = before['terrain']['habitats'][key]['path']
    stats = measure(path)
    assert stats['blockedRays'] == 0, f'{key}: route intersects the planted coast'
    assert stats['minimumBodyCenterToFoliage'] > .28, f'{key}: insufficient body clearance'
    assert stats['maximumLinearSupportError'] < .005, f'{key}: contact path floats from the terrain'
    after['terrain']['habitats'][key]['path'] = path
    report['habitats'][key] = {'before': measure(original), 'after': stats, 'plan': loop}
restored = copy.deepcopy(after)
for key in RABBIT_HABITAT_LOOPS:
    restored['terrain']['habitats'][key]['path'] = before['terrain']['habitats'][key]['path']
assert restored == before, 'Repair changed data beyond the two rabbit paths'
report['onlyTwoRabbitPathsChanged'] = True
manifest_path.write_text(json.dumps(after, indent=2)+'\n', encoding='utf-8')
out = ROOT / '.jekyll-cache/visual-qa/rabbit-habitat-audit/repair.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report, indent=2))
