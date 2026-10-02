"""Refresh only cameraCollision elevations from the retained finished coast.

Run with Blender --background --python-exit-code 1 --python
bin/repair_coastal_camera.py. No geometry, contact, view, envelope, wall or asset
changes; this avoids a full coastline rebuild for an incorrect proxy export.
"""
import bpy
import copy
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'bin'))
from coastal_camera import camera_support_meshes, create_camera_height, sample_camera_elevations

manifest_path = ROOT / 'assets/models/home/manifest.json'
source = ROOT / 'artwork/coastal-home/coastal-home.blend'
before = json.loads(manifest_path.read_text(encoding='utf-8'))
after = copy.deepcopy(before)
bpy.ops.wm.open_mainfile(filepath=str(source))
objects = list(bpy.context.scene.objects)
height = create_camera_height(objects)
collision = after['cameraCollision']
collision['elevations'] = sample_camera_elevations(collision, height)
assert len(collision['elevations']) == collision['width'] * collision['height']
assert min(collision['elevations']) >= -7.35
restored = copy.deepcopy(after)
restored['cameraCollision']['elevations'] = before['cameraCollision']['elevations']
assert restored == before, 'Repair changed more than camera collision elevations'


def non_elevation_hash(manifest):
    preserved = copy.deepcopy(manifest)
    del preserved['cameraCollision']['elevations']
    canonical = json.dumps(preserved, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(canonical).hexdigest()


preserved_before = non_elevation_hash(before)
preserved_after = non_elevation_hash(after)
assert preserved_before == preserved_after, 'Repair changed non-elevation manifest data'
report = {
    'source': str(source), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'meshes': [obj.name for obj in camera_support_meshes(objects)],
    'vertices': sum(len(obj.data.vertices) for obj in camera_support_meshes(objects)),
    'gridSize': [collision['width'], collision['height']], 'meanSeaLevel': -7.35,
    'changedSamples': sum(a != b for a, b in zip(before['cameraCollision']['elevations'], collision['elevations'])),
    'onlyElevationsChanged': restored == before,
    'nonElevationSha256Before': preserved_before,
    'nonElevationSha256After': preserved_after,
    'directRays': [{'x': x, 'threeZ': z, 'height': height(x, -z)}
                   for x, z in [(-10, -14.596), (-10, -14), (-10, -16), (-8, -14), (-10, 5), (25, 5), (0, 0), (0, -27)]],
}
manifest_path.write_text(json.dumps(after, indent=2) + '\n', encoding='utf-8')
report_path = ROOT / '.jekyll-cache/visual-qa/coastal-camera-repair/evidence.json'
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
