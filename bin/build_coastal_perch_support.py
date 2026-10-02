"""Export bounded perch contacts from retained coast and deployed gull geometry.

No scene geometry or shared manifest is modified. Local physical triangles,
decoded sole samples and native tarsus endpoints remain inspectable data.
"""
import bpy
import hashlib
import json
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'bin'))
from coastal_camera import camera_support_meshes


def three(point):
    return [round(point.x, 7), round(point.z, 7), round(-point.y, 7)]


def main():
    source = ROOT / 'artwork/coastal-home/coastal-home.blend'
    glb = ROOT / 'assets/models/home/WesternGull.glb'
    manifest = json.loads((ROOT / 'assets/models/home/manifest.json').read_text())
    bpy.ops.wm.open_mainfile(filepath=str(source))
    coast = camera_support_meshes(list(bpy.context.scene.objects))
    structural = [o for o in bpy.context.scene.objects if o.type == 'MESH'
                  and o.name.startswith('core_')
                  and o.get('renderStyle') in (None, 'realistic')]
    objects = list(dict.fromkeys(coast + structural))
    triangles = []
    for obj in objects:
        obj.data.calc_loop_triangles()
        for face in obj.data.loop_triangles:
            triangles.append([obj.matrix_world @ obj.data.vertices[i].co for i in face.vertices])
    vertices = [vertex for triangle in triangles for vertex in triangle]
    bvh = BVHTree.FromPolygons(vertices, [tuple(range(i, i + 3)) for i in range(0, len(vertices), 3)])
    patches = []
    places = [(f'coast-{i}', 'coast', p) for i, p in enumerate(manifest['terrain']['perches'])]
    places.append(('gallery-rail', 'rail', [4.2, 3.46, 1.31]))
    for name, kind, original in places:
        x, height, z = original
        hit, _, _, _ = bvh.ray_cast(Vector((x, -z, height + .2)), Vector((0, 0, -1)))
        if hit is None:
            raise ValueError(f'Missing physical support at {name}')
        origin = Vector((x, -z, hit.z))
        local = []
        for triangle in triangles:
            if (min(v.x for v in triangle) > x + .27 or max(v.x for v in triangle) < x - .27
                    or min(v.y for v in triangle) > -z + .27 or max(v.y for v in triangle) < -z - .27
                    or min(v.z for v in triangle) > hit.z + .28 or max(v.z for v in triangle) < hit.z - .28):
                continue
            local.append([coordinate for vertex in triangle for coordinate in three(vertex - origin)])
        if not local:
            raise ValueError(f'Empty physical support patch at {name}')
        patches.append({'id': name, 'kind': kind, 'original': original, 'origin': three(origin),
                        'radius': .27, 'maximumHeight': .22, 'triangles': local})

    existing = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    master = next(o for o in set(bpy.context.scene.objects) - existing if o.name == 'WesternGull')
    feet = {}
    for side in ('L', 'R'):
        pivot = next(o for o in master.children_recursive if o.name == 'Foot' + side)
        inverse = pivot.matrix_world.inverted()
        vertices, faces = [], []
        for obj in pivot.children_recursive:
            if obj.type != 'MESH':
                continue
            offset = len(vertices)
            vertices.extend(inverse @ obj.matrix_world @ v.co for v in obj.data.vertices)
            obj.data.calc_loop_triangles()
            faces.extend(tuple(offset + i for i in t.vertices) for t in obj.data.loop_triangles)
        foot = BVHTree.FromPolygons(vertices, faces)
        minimum = min(v.z for v in vertices) - .02
        samples = {}
        for face in faces:
            a, b, c = [vertices[i] for i in face]
            for i in range(9):
                for j in range(9 - i):
                    point = a + (b - a) * (i / 8) + (c - a) * (j / 8)
                    hit, _, _, _ = foot.ray_cast(Vector((point.x, point.y, minimum)), Vector((0, 0, 1)))
                    if hit is not None:
                        samples[(round(hit.x, 7), round(hit.y, 7))] = three(hit)
        leg = next(o for o in master.children_recursive if o.name == 'Leg' + side)
        leg_inverse = leg.matrix_world.inverted()
        leg_vertices = [leg_inverse @ obj.matrix_world @ vertex.co
                        for obj in leg.children_recursive if obj.type == 'MESH' for vertex in obj.data.vertices]
        feet[side] = {'position': three(pivot.matrix_world.translation), 'hip': three(leg.matrix_world.translation),
                      'ankle': three(max(vertices, key=lambda v: v.z)),
                      'legLength': round(-min(v.z for v in leg_vertices), 7), 'sole': list(samples.values())}
    result = {'version': 1, 'units': 'metres', 'coastSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
              'gullSha256': hashlib.sha256(glb.read_bytes()).hexdigest(),
              'method': 'Retained physical local triangles and decoded native sole/ankle/tarsus geometry',
              'patches': patches, 'feet': feet}
    destination = ROOT / 'assets/models/home/wildlife-perch-support.json'
    destination.write_text(json.dumps(result, separators=(',', ':')) + '\n', encoding='utf-8')
    print('PERCH SUPPORT', destination.stat().st_size, 'bytes;', [(p['id'], len(p['triangles'])) for p in patches],
          'sole samples', {side: len(foot['sole']) for side, foot in feet.items()})


if __name__ == '__main__':
    main()
