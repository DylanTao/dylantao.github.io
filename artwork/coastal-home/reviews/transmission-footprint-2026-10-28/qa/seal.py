"""Seal the owned diagnostic as a portable review; does not modify site files."""
from pathlib import Path
import hashlib
import json
import shutil
from urllib.parse import urlparse, unquote
from PIL import Image

ROOT = Path.cwd()
Q = ROOT / '.jekyll-cache/visual-qa/transmission-roi-2026-10-28'
OUT = ROOT / 'artwork/coastal-home/reviews/transmission-footprint-2026-10-28'
OUT.mkdir(parents=True, exist_ok=True)

def sha(b):
    return hashlib.sha256(b).hexdigest()

def read(name):
    return json.loads((Q / name).read_text(encoding='utf-8-sig'))

def write(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

intake = read('intake.json')
assert intake['allSourceBeforeAfterAndCopiesMatch']
frozen = Q / 'baseline-site/al-folio'
copy_check = []
for row in intake['files']:
    b = (frozen / row['file']).read_bytes()
    assert len(b) == row['bytes'] and sha(b) == row['sha256'], row['file']
    copy_check.append(row)
write(OUT / 'source-roster.json', {
    'source': intake['source'],
    'copy': str(frozen.relative_to(ROOT)),
    'ownedServer': 'http://127.0.0.1:4136/al-folio/',
    'files': copy_check,
    'fileCount': len(copy_check),
    'bytes': sum(r['bytes'] for r in copy_check),
    'intakeBeforeAfterAndCopiesMatch': True,
    'sealCopyReadbackMatches': True,
    'intakeJsonSha256': sha((Q / 'intake.json').read_bytes()),
})

analysis = {
    'date': '2026-10-28',
    'decision': 'Reject this bounded scissor attempt before a renderer prototype. No source change or claimed performance gain.',
    'quietTiming': False,
    'timings': None,
    'browserClosed': True,
    'prototypeCount': 0,
    'pixelParity': 'Not applicable: no cropped renderer candidate was made. The diagnostic data render is not a beauty/parity comparison.',
    'publicSourceChanges': [],
    'hostVideoControllers': read('host-gpu.json'),
    'controls': {
        'completeFrozenSite': intake['source'],
        'nativeDpr': 1,
        'reducedMotion': 'reduce',
        'date': '2026-10-28T13:20:00-07:00',
        'quality': 'high',
        'resolution': 'fixed',
        'selection': 'Public avatar select south-park; public authoring-lab Outside visit; fullscreen.',
        'nativeRafAndTimers': True,
        'random': 'No global Math.random override; this is a footprint diagnostic, not interleaved pixel parity.',
        'networkRoutes': 'Only analytics endpoints fulfilled empty. No scene, model, texture, module, CSS, font or quality asset omitted.',
        'notes': 'Fresh Chromium process per final resolution. Native D3D11-backed headless Chromium is a functional renderer, not a native visible-browser performance benchmark.',
    },
    'rows': [],
    'limitations': [
        'The full-frame fallback is certified safe; the inability to certify a smaller bound is not proof that actual rendering samples a global mip.',
        'The expanded-triangle normal bound includes hidden/back-facing triangles and more helper positions than the real rasterized quads. It is deliberately loose.',
        'One-percent plus0.002 normal rounding margin and the finite-water mip padding are analytic envelopes, not a cross-driver floating-point or mip-generation proof. Any prototype would still need exact controlled beauty parity.',
        'Data-render roughness and LOD maxima are half-float values after four-sample resolve. They are not strict maxima of individual covered samples.',
        'The positive-red test flags only the valid interior LOD interval10.25..10.95 that mixes the final1x1 mip. Zero flags do not prove absence of every possible out-of-chain or endpoint LOD.',
        'Actual current onsen texture extrema are one-state bounds. A running implementation must recompute or derive an all-time bound; it cannot reuse these flat reduced-motion values.',
        'The scene shadow cache is enabled but not warmed: reduced-motion demand rendering has fewer than its30 still frames. No cache timing attribution is made.',
        'No isolated GPU timing window was available. Existing scene timers in evidence are uncontrolled observations and are excluded from conclusions.',
    ],
    'nextHypothesis': 'Tighten only the hopper derivative envelope using the actual clipped primitive and2x2 raster helper quads, with a finite numerical/near-plane/unknown-path fallback to full capture. First determine whether it excludes the false near-zero normal region of triangle49 without changing the material. If a bounded sampler support remains useful, retain the existing full-size4xMSAA transmission target, mips and full beauty, then require same-state pixel parity and quiet interleaved GPU timings. Stop if certification remains full-frame.',
}

for label in ['2k', '4k']:
    shot = read(f'baseline-{label}-outside.json')
    end = read(f'restored-{label}-outside.json')
    foot = read(f'footprint-{label}.json')
    provenance = read(f'restored-{label}-provenance.json')
    bounds = read(f'complete-bounds-{label}.json')
    normal = read(f'roughness-bound-{label}.json')
    data = read(f'mip-diagnostic-{label}.json')
    assert not shot['errors'] and not end['errors']
    assert provenance['glError'] == 0 and data['glError'] == 0
    assert data['actualSamples'] == 4 and bounds['finalFraction'] == 1
    assert len(foot['transmissiveObjects']) == 6
    state = foot['state']
    assert state['currentRoom'] == 'outside' and state['avatarId'] == 'south-park'
    assert state['ecology']['farField']['near']['complete']
    for name in ['flora.glb', 'hinterland.glb', 'sirui-south-park.glb']:
        assert any(m['asset'] == name and m.get('parsedMilliseconds') is not None for m in state['loading']['models']), name
    served = []
    for response in end['responses']:
        path = unquote(urlparse(response['url']).path)
        assert path.startswith('/al-folio/')
        rel = path.removeprefix('/al-folio/') or 'index.html'
        disk = (frozen / rel).read_bytes()
        assert sha(disk) == response['sourceSha256'], rel
        body_matches = response['sha256'] == sha(disk)
        bom_only = not body_matches and disk.startswith(b'\xef\xbb\xbf') and response['sha256'] == sha(disk[3:])
        assert body_matches or bom_only, rel
        served.append({**response, 'frozenPath': rel, 'browserBodyComparison': 'exact bytes' if body_matches else 'Chromium text response stripped the UTF-8 BOM only; raw HTTP independently matches disk'})
    write(OUT / f'served-{label}.json', served)
    state_excerpt = {k: state[k] for k in ['ready', 'avatarId', 'currentRoom', 'frames', 'camera', 'target', 'canvasWidth', 'canvasHeight', 'resolution', 'quality', 'detail', 'shadowCache', 'rendering', 'resources']}
    state_excerpt['loadedModels'] = state['loading']['models']
    state_excerpt['lightField'] = state['simulation']['lightField']
    state_excerpt['nearField'] = state['ecology']['farField']['near']
    state_excerpt['onsen'] = state['simulation']['onsen']
    write(OUT / f'footprint-{label}.json', {**{k:v for k,v in foot.items() if k!='state'}, 'stateExcerpt': state_excerpt, 'fullRawFile': str((Q / f'footprint-{label}.json').relative_to(ROOT)), 'fullRawSha256': sha((Q / f'footprint-{label}.json').read_bytes())})
    for stem in ['complete-bounds', 'roughness-bound', 'mip-diagnostic']:
        shutil.copy2(Q / f'{stem}-{label}.json', OUT / f'{stem}-{label}.json')
    warnings = end['consoleMessages']
    assert not any('Program object expected' in x['text'] or 'GL_INVALID' in x['text'] for x in warnings)
    hopper = next(r for r in normal['rows'] if r['object'] == 'kitchen__coffee_hopper_glass')
    analysis['rows'].append({
        'label': label,
        'canvas': [foot['width'], foot['height']],
        'backend': foot['backend'],
        'userAgent': provenance['userAgent'],
        'glVersion': provenance['glVersion'],
        'shadingLanguage': provenance['shadingLanguage'],
        'camera': state['camera'],
        'target': state['target'],
        'transmissiveEntries': len(foot['transmissiveObjects']),
        'preFilterFraction': bounds['preFilterFraction'],
        'waterOnlyAnalyticEnvelopeFraction': bounds['waterOnlyFraction'],
        'finalConservativeFraction': bounds['finalFraction'],
        'maximumResolvedRoughness': data['maximumResolvedRoughness'],
        'maximumResolvedLod': data['maximumResolvedLod'],
        'globalMipInteriorFlaggedPixels': data['flaggedPixels'],
        'coveredPixels': data['coveredPixels'],
        'hopperWorst': hopper['worst'],
        'hopperRoughnessEnvelope': hopper['effectiveRoughnessUpper'],
        'hopperLodEnvelope': hopper['lodUpper'],
        'shadowCacheBefore': state['shadowCache'],
        'shadowCacheAfter': provenance['shadowCache'],
        'glErrorAfterDiagnostic': data['glError'],
        'glErrorAfterRestoration': provenance['glError'],
        'pageOrHttpErrors': end['errors'],
        'retiredProgramWarnings': 0,
        'consoleWarnings': warnings,
        'servedResponseCount': len(served),
        'exactBodyResponses': sum(r['matchesFrozenBytes'] for r in served),
        'bomStrippedTextResponses': sum(not r['matchesFrozenBytes'] for r in served),
        'sceneModulesAndAssetsByteBound': True,
    })

write(OUT / 'analysis.json', analysis)
for name in ['transmission-implementation.json', 'filter-and-roughness-source.json', 'css-raw-http-readback.json']:
    shutil.copy2(Q / name, OUT / name)

images = []
for name in ['baseline-2k-outside', 'baseline-4k-outside']:
    source = Q / f'{name}.png'
    image = Image.open(source).convert('RGBA')
    destination = OUT / f'{name}.webp'
    image.save(destination, 'WEBP', lossless=True, method=6)
    decoded = Image.open(destination).convert('RGBA')
    assert decoded.size == image.size and decoded.tobytes() == image.tobytes()
    images.append({'file': destination.name, 'bytes': destination.stat().st_size, 'sha256': sha(destination.read_bytes()), 'dimensions': image.size, 'sourcePng': str(source.relative_to(ROOT)), 'sourcePngSha256': sha(source.read_bytes()), 'decodedRgbaSha256': sha(image.tobytes()), 'losslessReadbackMatches': True})
write(OUT / 'images.json', images)
early = Q / 'retained-early-2k/baseline-2k-outside.json'
write(OUT / 'retained-early-state.json', {'decision': 'Rejected representative screenshot: distant flora had not completed visible load. Replaced by guarded complete-scene2K capture; raw files retained. Final footprint/LOD readback repeats unchanged.', 'rawJson': str(early.relative_to(ROOT)), 'rawJsonSha256': sha(early.read_bytes()), 'rawPng': str(early.with_suffix('.png').relative_to(ROOT)), 'rawPngSha256': sha(early.with_suffix('.png').read_bytes()), 'earlyShadowCache': json.loads(early.read_text())['state']['shadowCache']})

recipes = OUT / 'qa'
recipes.mkdir(exist_ok=True)
for name in ['capture-footprint.js', 'bound-roughness.js', 'complete-bounds.js', 'diagnose-mips.js', 'inspect.cjs', 'serve.py', 'seal.py']:
    shutil.copy2(Q / name, recipes / name)
write(OUT / 'raw-roster.json', [{'file': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())} for p in sorted(Q.rglob('*')) if p.is_file() and 'baseline-site' not in p.parts])
print(json.dumps({'review': str(OUT.relative_to(ROOT)), 'files': len(list(OUT.rglob('*'))), 'sourceFiles': len(copy_check), 'sourceBytes': sum(r['bytes'] for r in copy_check), 'rows': [{k:r[k] for k in ['label','waterOnlyAnalyticEnvelopeFraction','finalConservativeFraction','maximumResolvedLod','retiredProgramWarnings','servedResponseCount','exactBodyResponses','bomStrippedTextResponses']} for r in analysis['rows']]}, indent=2))
