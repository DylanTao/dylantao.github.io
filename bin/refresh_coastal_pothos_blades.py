"""Replace only the retained Epipremnum blades, leaving their stems rooted.

Run with Blender4.5.9 and --python-exit-code1. Defaults to a private candidate;
the coordinator may replay migrate(scene) on a later accepted native source.
No source overwrite, global plant helper, material, fixture or light is owned
by this refresh. Re-bake contacts/light and export room-library separately.
"""
import hashlib
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'bin'))
from coastal_interior_refinement import pothos_lamina
from refresh_coastal_study_hardware import immutable_scene_digest

OWNER = 'library_refined_botanical__interior Epipremnum leaf'
INPUT_SHA256 = 'c71290581d742e6c6e6d86cfb73e2a5356142c5cb8362affa43fdcb8233229ad'


def fingerprint(obj):
    digest = hashlib.sha256()
    digest.update(obj.name.encode())
    digest.update(np.asarray(obj.matrix_world, dtype='<f4').tobytes())
    digest.update(np.asarray([v.co[:] for v in obj.data.vertices], dtype='<f4').tobytes())
    digest.update(json.dumps([list(f.vertices) for f in obj.data.polygons], separators=(',', ':')).encode())
    digest.update(json.dumps([m.name for m in obj.data.materials], separators=(',', ':')).encode())
    return digest.hexdigest()


def migrate(scene):
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError('Use exact Blender4.5.9')
    if scene.get('pothosBladeRevision'):
        raise RuntimeError('Pothos blades have already been refreshed')
    obj = scene.objects.get(OWNER)
    if obj is None or obj.type != 'MESH':
        raise RuntimeError('Missing retained Epipremnum owner')
    actual = fingerprint(obj)
    if actual != INPUT_SHA256:
        raise RuntimeError(f'Retained Epipremnum input changed: {actual}')
    old = obj.data
    if len(old.vertices) != 120 or len(old.polygons) != 30 or any(len(f.vertices) != 4 for f in old.polygons):
        raise RuntimeError('Expected exactly30retained quad blades')
    old_color = old.color_attributes.active_color
    if old_color is None or old_color.domain != 'CORNER' or old_color.data_type != 'FLOAT_COLOR':
        raise RuntimeError('Unexpected retained leaf contact field')
    permitted = {'position', '.edge_verts', 'sharp_face', '.corner_vert', '.corner_edge', old_color.name}
    if any(a.name not in permitted for a in old.attributes):
        raise RuntimeError('Unowned retained leaf attribute')
    others = SimpleNamespace(objects=[o for o in scene.objects if o != obj])
    before = immutable_scene_digest(others, {})
    vertices, faces, colors, roots = [], [], [], []
    for index, face in enumerate(old.polygons):
        indices = list(face.vertices)
        root, tip = old.vertices[indices[0]].co.copy(), old.vertices[indices[2]].co.copy()
        points, patch = pothos_lamina(root, tip, .036, index)
        offset = len(vertices)
        vertices.extend(points)
        faces.extend(tuple(i+offset for i in f) for f in patch)
        # Preserve the old root/mid/tip contact variation along the new blade.
        # This is an interim transported field; final integration re-bakes it.
        old_colors = [np.asarray(old_color.data[i].color[:], dtype=np.float64) for i in face.loop_indices]
        midpoint = (old_colors[1]+old_colors[3])/2
        axis = points[-1]-points[0]
        point_colors = []
        for point in points:
            t = min(1., max(0., (point-root).dot(axis)/axis.length_squared))
            value = old_colors[0]*(1-2*t)+midpoint*(2*t) if t <= .5 else midpoint*(2-2*t)+old_colors[2]*(2*t-1)
            point_colors.append(value)
        for f in patch:
            colors.extend(point_colors[i] for i in f)
        roots.append({'index': index, 'nativeRoot': list(obj.matrix_world@root),
                      'nativeTipBefore': list(obj.matrix_world@tip),
                      'nativeTipAfter': list(obj.matrix_world@points[-1]),
                      'rootVertex': offset, 'lengthM': (tip-root).length})
    mesh = bpy.data.meshes.new(old.name+' curved blades')
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(old.materials[0])
    for face in mesh.polygons:
        face.use_smooth = True
    field = mesh.color_attributes.new(name=old_color.name, type='FLOAT_COLOR', domain='CORNER')
    for row, color in zip(field.data, colors):
        row.color = color
    mesh.color_attributes.active_color = field
    mesh.update()
    mesh.calc_loop_triangles()
    if len(mesh.vertices) != 420 or len(mesh.loop_triangles) != 480:
        raise RuntimeError('Unexpected blade tessellation')
    if any(t.area < 1e-10 for t in mesh.loop_triangles):
        raise RuntimeError('Collapsed blade triangle')
    obj.data = mesh
    after = immutable_scene_digest(others, {})
    if after != before:
        obj.data = old
        raise RuntimeError('Unselected scene changed')
    root_errors = [(obj.matrix_world@mesh.vertices[r['rootVertex']].co-Vector(r['nativeRoot'])).length for r in roots]
    if max(root_errors) != 0:
        raise RuntimeError('A retained petiole root moved')
    scene['pothosBladeRevision'] = 1
    return {'owner': OWNER, 'inputFingerprintSha256': actual, 'outputFingerprintSha256': fingerprint(obj),
            'unchangedSceneDigestBefore': before, 'unchangedSceneDigestAfter': after,
            'blades': len(roots), 'verticesBefore': len(old.vertices), 'verticesAfter': len(mesh.vertices),
            'trianglesBefore': 60, 'trianglesAfter': len(mesh.loop_triangles),
            'maximumRootMovementM': max(root_errors), 'bladeRoots': roots,
            'orientation': 'Native+Y seaward glazing and upper sky; independent of camera',
            'next': 'Bake contact/bounce, export effort10 room-library and refresh official static light before publication'}


def main():
    args = {a[2:].split('=', 1)[0]: a.split('=', 1)[1] for a in sys.argv if a.startswith('--') and '=' in a}
    source = Path(args.get('source', str(ROOT/'artwork/coastal-home/coastal-home.blend')))
    out = Path(args.get('out', str(ROOT/'.jekyll-cache/visual-qa/pothos-blades')))
    out.mkdir(parents=True, exist_ok=True)
    destination = out/'candidate.blend'
    if destination.resolve() in (source.resolve(), (ROOT/'artwork/coastal-home/coastal-home.blend').resolve()):
        raise RuntimeError('Candidate output must not replace a source')
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(source))
    receipt = migrate(bpy.context.scene)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(destination), compress=True)
    receipt.update({'sourceBeforeSha256': source_hash, 'sourceAfterSha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
                    'sourceOut': str(destination)})
    (out/'receipt.json').write_text(json.dumps(receipt, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({k: v for k, v in receipt.items() if k != 'bladeRoots'}), flush=True)


if __name__ == '__main__':
    main()
