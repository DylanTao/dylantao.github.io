"""Replay only the supported reading fixture and its own installation record.

Exact Blender4.5.9; defaults write an ignored candidate, never canonical source,
manifest or cache. The coordinator replays migrate(scene, config), then performs
the complete AO/export/support/sketch/static-light pipeline separately.
"""
import copy
import hashlib
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'bin'))
import coastal_private_reading as reading
from refresh_coastal_study_hardware import immutable_scene_digest


def migrate(scene, config):
    original_objects = list(scene.objects)
    before = immutable_scene_digest(SimpleNamespace(objects=original_objects), {})
    old = copy.deepcopy(config)
    objects, report = reading.build(scene)
    fixture = reading.register(config)
    after = immutable_scene_digest(SimpleNamespace(objects=original_objects), {})
    if before != after:
        raise RuntimeError('Retained scene geometry/attributes/transforms changed')
    expected = copy.deepcopy(old)
    expected.setdefault('installationLines', []).append(reading.installation())
    if config != expected:
        raise RuntimeError('Reading fixture changed unrelated metadata')
    return {**report, 'unchangedSceneDigestBefore': before, 'unchangedSceneDigestAfter': after,
            'installation': fixture, 'metadataChange': 'One newinstallationLines record; original lightcage and every oldsource retained',
            'next': 'Native contact/bounce bake; export complete room-library-upper, update official metadata/cache and review the combined source'}


def main():
    args = {a[2:].split('=', 1)[0]: a.split('=', 1)[1] for a in sys.argv if a.startswith('--') and '=' in a}
    source = Path(args.get('source', str(ROOT/'artwork/coastal-home/coastal-home.blend')))
    manifest = Path(args.get('manifest', str(ROOT/'assets/models/home/manifest.json')))
    out = Path(args.get('out', str(ROOT/'.jekyll-cache/visual-qa/private-reading-lantern')))
    out.mkdir(parents=True, exist_ok=True)
    destination, config_out = out/'candidate.blend', out/'manifest.json'
    if destination.resolve() in (source.resolve(), (ROOT/'artwork/coastal-home/coastal-home.blend').resolve()) or config_out.resolve() == manifest.resolve():
        raise RuntimeError('Private candidate must not overwrite an input')
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(source))
    config = json.loads(manifest.read_text(encoding='utf-8'))
    report = migrate(bpy.context.scene, config)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(destination), compress=True)
    config_out.write_text(json.dumps(config, indent=2)+'\n', encoding='utf-8', newline='\n')
    report.update({'sourceBeforeSha256': source_hash, 'sourceAfterSha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
                   'sourceOut': str(destination), 'manifestOut': str(config_out)})
    (out/'receipt.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
