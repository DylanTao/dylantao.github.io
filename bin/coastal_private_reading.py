"""One ceiling-supported paper reading light, clear of the bedroom approach.

Native Z-up coordinates are already in the final retreat frame. The shade is
original geometry; its analytic line is direct-only because the retained
transport field has all28channels in use. It adds no native light/shadow map.
"""
import copy
import math

VERSION = 1
PREFIX = 'library-upper_reading_lantern'
ID = 'private-living-reading-lantern'
CENTER = (.65, -12.65)
SHADE_BOTTOM = 4.78
SHADE_TOP = 5.10
SHADE_MATERIAL = 'private living washi diffuser'
ORIGINAL_CAGE = {'min': [-1.65, 2.55, 10.25], 'max': [1.3, 4.7, 12.55]}


def installation():
    return {'id': ID, 'schedule': 'privateReading', 'a': [.65, 4.855, 12.65], 'b': [.65, 5.015, 12.65],
            'intensity': 3.25, 'color': [1., .74, .50], 'transport': False, 'glowTag': ID,
            'region': {'min': [-1.65, 2.55, 10.25], 'max': [1.3, 4.7, 14.1]}}


def register(config):
    room = next((r for r in config.get('rooms', []) if r['id'] == 'library-upper'), None)
    if room is None or room.get('floor') != 2.6 or room.get('lightRegion') != ORIGINAL_CAGE:
        raise RuntimeError('Retained private-room floor/cage changed; review the physical placement')
    if config.get('retreat', {}).get('setbackMetres') != 8:
        raise RuntimeError('Reading light requires the final8mretreat frame')
    sources = config.setdefault('installationLines', [])
    old = [s for s in sources if s.get('id') == ID]
    authored = installation()
    if old and old != [authored]:
        raise RuntimeError('An independently changed reading-light installation already exists')
    if not old:
        sources.append(copy.deepcopy(authored))
    return authored


def build(scene):
    import bpy
    from mathutils import Vector
    from coastal_office import Parts, cylinder, lathe, _mat

    if bpy.app.version != (4, 5, 9):
        raise RuntimeError('Use exact Blender4.5.9')
    if scene.get('privateReadingLanternVersion') or any(o.name.startswith(PREFIX) for o in scene.objects):
        raise RuntimeError('The reading lantern is already present')
    if bpy.data.materials.get(SHADE_MATERIAL):
        raise RuntimeError('Retained material already owns the proposed shade name')
    x, y = CENTER
    deps = bpy.context.evaluated_depsgraph_get()
    samples = []
    for index in range(17):
        radius = 0 if index == 0 else .21
        angle = (index-1)*math.tau/16
        xx, yy = x+radius*math.cos(angle), y+radius*math.sin(angle)
        ok, floor, normal, face, obj, _ = scene.ray_cast(deps, Vector((xx, yy, 2.67)), Vector((0, 0, -1)), distance=.2)
        if not ok or normal.z < .9 or abs(floor.z-2.6025) > .002:
            raise RuntimeError(f'No retained upper-floor support below shade: {index}')
        clear = SHADE_BOTTOM-floor.z
        if clear <= 2.1:
            raise RuntimeError('The shade reduces standing clearance below2.1m')
        samples.append({'index': index, 'nativePoint': list(floor), 'owner': obj.name, 'face': face, 'clearHeightM': clear})
    ok, anchor, normal, face, owner, _ = scene.ray_cast(deps, Vector((x, y, SHADE_TOP+.06)), Vector((0, 0, 1)), distance=2.)
    if not ok or normal.z > -.8 or anchor.z < SHADE_TOP+.10:
        raise RuntimeError('No actual ceiling attachment for reading lantern')
    ceiling = {'point': list(anchor), 'normal': list(normal), 'owner': owner.name, 'face': face}
    materials = {name: bpy.data.materials.get(name) for name in ['brushed brass', 'charcoal']}
    if any(m is None for m in materials.values()):
        raise RuntimeError('Retained attachment finishes are missing')
    shade = _mat(SHADE_MATERIAL, (.88, .82, .69), .91, 0, (1., .74, .50), 1.1)
    p = Parts(PREFIX)
    lathe(p.bm(shade), [(.025, 0), (.095, .025), (.15, .08), (.17, .16), (.147, .235), (.09, .29), (.025, .32)],
          (x, y, SHADE_BOTTOM), segments=16)
    # Three fine supporting hoops give the small paper shade a physical scale.
    # Their triangular wire sections are closed native solids, batched with the
    # existing brass canopy, so this detail adds no draw or material.
    hoops = p.bm(materials['brushed brass'])
    for height, radius in ((.08, .15), (.16, .17), (.235, .147)):
        rings = []
        for i in range(16):
            angle = i*math.tau/16
            ring = []
            for j in range(3):
                cross = j*math.tau/3
                r = radius+.002+.0015*math.cos(cross)
                ring.append(hoops.verts.new((x+r*math.cos(angle), y+r*math.sin(angle), SHADE_BOTTOM+height+.0015*math.sin(cross))))
            rings.append(ring)
        for i in range(16):
            for j in range(3):
                hoops.faces.new((rings[i][j], rings[(i+1)%16][j], rings[(i+1)%16][(j+1)%3], rings[i][(j+1)%3]))
    attach = anchor+normal*.006
    cylinder(p.bm(materials['charcoal']), (x, y, SHADE_TOP), attach, .0025, 6)
    cylinder(p.bm(materials['brushed brass']), anchor+normal*.012, anchor, .035, 12)
    objects = p.finish()
    triangles = 0
    for obj in objects:
        obj['privateReadingLantern'] = True
        obj['installationGroup'] = 'upper'
        if any(m and m.name == SHADE_MATERIAL for m in obj.data.materials):
            obj['installationGlow'] = ID
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    if triangles > 700:
        raise RuntimeError('Reading fixture exceeds its 700 triangle budget')
    scene['privateReadingLanternVersion'] = VERSION
    return objects, {'version': VERSION, 'objects': [o.name for o in objects], 'triangles': triangles,
                     'nativeCeilingAttachment': ceiling, 'floorAndClearanceSamples': samples,
                     'shadeNativeBounds': [[x-.17, y-.17, SHADE_BOTTOM], [x+.17, y+.17, SHADE_TOP]],
                     'minimumClearHeightM': min(s['clearHeightM'] for s in samples),
                     'method': 'Ceiling-supported shade, cord and canopy. One bounded direct-only analytic line; no newtransportchannel or PointLight/shadowmap.'}
