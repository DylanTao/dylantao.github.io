"""Export bounded perch contacts from retained coast and deployed gull geometry.

No scene geometry or shared manifest is modified. Local physical triangles,
decoded sole samples and native tarsus endpoints remain inspectable data.
The gull is one skinned mesh, so its feet and tarsi are read from the decoded
FootL/FootR and LegL/LegR vertex groups around their joint origins.
Rock patches at the cliff foot carry the Brandt's cormorants' roosts.
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

# Brandt's cormorants roost on the talus and haul-out rocks at the cliff foot, beside the
# sea lions, rather than on the sheer fluted face, which a ledge survey found has no
# upward-facing shelf open to the sea. (x, expected support height, z) in browser metres.
ROOSTS = [
    ('rock-west-0', [-11.77, -6.053, -14.571]),
    ('rock-west-1', [-13.506, -6.041, -14.918]),
    ('rock-east-0', [15.13, -6.158, -12.91]),
    ('rock-east-1', [15.226, -6.158, -13.615]),
]


def three(point):
    return [round(point.x, 7), round(point.z, 7), round(-point.y, 7)]


def main():
    source = ROOT / 'artwork/coastal-home/coastal-home.blend'
    glb = ROOT / 'assets/models/home/WesternGull.glb'
    manifest = json.loads((ROOT / 'assets/models/home/manifest.json').read_text())
    bpy.ops.wm.open_mainfile(filepath=str(source))
    coast = camera_support_meshes(list(bpy.context.scene.objects))
    # Leaves and grass blades (refresh_coastal_flora.py) are not something a gull stands on.
    structural = [o for o in bpy.context.scene.objects if o.type == 'MESH'
                  and o.name.startswith('core_')
                  and not o.get('flora')
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
    places.append(('gallery-rail', 'rail', manifest.get('retreat', {}).get('galleryPerch', [4.2, 3.46, 1.31])))
    places += [(name, 'rock', point) for name, point in ROOSTS]
    for name, kind, original in places:
        x, height, z = original
        hit, _, _, _ = bvh.ray_cast(Vector((x, -z, height + .2)), Vector((0, 0, -1)))
        if hit is None or (kind == 'rock' and abs(hit.z - height) > .25):
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

    # The displaced west perch now lies on a differently quantized broad rock
    # face. Preserve its complete native patch, and derive contact against the
    # actual delivered surface so a millimetre of Draco rounding cannot put the
    # webbed sole inside the rendered rock. Other retained perch patches keep
    # their original native survey. No triangle is discarded to meet the budget.
    exported = set(bpy.context.scene.objects)
    delivered_files = [ROOT / 'assets/models/home/home-shell.glb', ROOT / 'assets/models/home/coast.glb']
    for delivered in delivered_files:
        bpy.ops.import_scene.gltf(filepath=str(delivered))
    decoded = [o for o in set(bpy.context.scene.objects) - exported if o.type == 'MESH']
    delivered_triangles = []
    for obj in decoded:
        obj.data.calc_loop_triangles()
        delivered_triangles += [[obj.matrix_world @ obj.data.vertices[i].co for i in face.vertices]
                                for face in obj.data.loop_triangles]
    delivered_vertices = [vertex for triangle in delivered_triangles for vertex in triangle]
    delivered_bvh = BVHTree.FromPolygons(delivered_vertices,
        [tuple(range(i, i + 3)) for i in range(0, len(delivered_vertices), 3)])
    patch = patches[0]
    x, height, z = patch['original']
    hit, _, _, _ = delivered_bvh.ray_cast(Vector((x, -z, height + .2)), Vector((0, 0, -1)), 1)
    if hit is None or abs(hit.z-height) > .051:
        raise ValueError('Displaced west perch is not supported by the delivered rock')
    origin = Vector((x, -z, hit.z))
    actual = []
    for triangle in delivered_triangles:
        if (min(v.x for v in triangle) > x + .27 or max(v.x for v in triangle) < x - .27
                or min(v.y for v in triangle) > -z + .27 or max(v.y for v in triangle) < -z - .27
                or min(v.z for v in triangle) > hit.z + .28 or max(v.z for v in triangle) < hit.z - .28):
            continue
        actual.append([coordinate for vertex in triangle for coordinate in three(vertex - origin)])
    if not actual:
        raise ValueError('Empty delivered west-perch patch')
    patch['nativeOrigin'] = patch['origin']
    patch['nativeTriangles'] = patch['triangles']
    patch.update(origin=three(origin), triangles=actual, contactGeometry='decoded delivered shell/coast')

    existing = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    imported = set(bpy.context.scene.objects) - existing
    rig = next(o for o in imported if o.type == 'ARMATURE')
    # The importer also adds an unskinned icosphere (its bone display shape); take the skinned body.
    body = next(o for o in imported if o.type == 'MESH' and o.find_armature() == rig)
    bpy.context.view_layer.update()

    def joint(name):
        return rig.matrix_world @ rig.data.bones[name].head_local

    def members(name):
        group = body.vertex_groups[name].index
        chosen = set()
        for vertex in body.data.vertices:
            if any(g.group == group and g.weight >= .5 for g in vertex.groups):
                chosen.add(vertex.index)
        return chosen

    body.data.calc_loop_triangles()
    feet = {}
    for side in ('L', 'R'):
        origin = joint('Foot' + side)
        chosen = members('Foot' + side)
        index = {v: i for i, v in enumerate(sorted(chosen))}
        foot_vertices = [body.matrix_world @ body.data.vertices[v].co - origin for v in sorted(chosen)]
        faces = [tuple(index[i] for i in t.vertices) for t in body.data.loop_triangles if all(i in chosen for i in t.vertices)]
        foot = BVHTree.FromPolygons(foot_vertices, faces)
        minimum = min(v.z for v in foot_vertices) - .02
        samples = {}
        for face in faces:
            a, b, c = [foot_vertices[i] for i in face]
            for i in range(9):
                for j in range(9 - i):
                    point = a + (b - a) * (i / 8) + (c - a) * (j / 8)
                    hit, _, _, _ = foot.ray_cast(Vector((point.x, point.y, minimum)), Vector((0, 0, 1)))
                    if hit is not None:
                        samples[(round(hit.x, 7), round(hit.y, 7))] = three(hit)
        hip = joint('Leg' + side)
        leg_vertices = [body.matrix_world @ body.data.vertices[v].co - hip for v in members('Leg' + side)]
        feet[side] = {'position': three(origin), 'hip': three(hip),
                      'ankle': three(max(foot_vertices, key=lambda v: v.z)),
                      'legLength': round(-min(v.z for v in leg_vertices), 7), 'sole': list(samples.values())}
    result = {'version': 1, 'units': 'metres', 'coastSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
              'gullSha256': hashlib.sha256(glb.read_bytes()).hexdigest(),
              'deliveredSha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in delivered_files},
              'method': 'Retained physical local triangles and decoded native sole/ankle/tarsus geometry',
              'patches': patches, 'feet': feet}
    destination = ROOT / 'assets/models/home/wildlife-perch-support.json'
    destination.write_text(json.dumps(result, separators=(',', ':')) + '\n', encoding='utf-8')
    print('PERCH SUPPORT', destination.stat().st_size, 'bytes;', [(p['id'], len(p['triangles'])) for p in patches],
          'sole samples', {side: len(foot['sole']) for side, foot in feet.items()})


if __name__ == '__main__':
    main()
