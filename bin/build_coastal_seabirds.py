"""Original brown pelican and Brandt's cormorant masters for the coastal home.

Blender Z-up / -Y forward, authored in a level flight frame like the gull: the pelican glides
low over the swell in that frame, and the cormorant stands by pitching its BodyPose (at the hip)
upright, so its spread wings become the wing-drying pose. Each body, neck and head is one
remeshed surface painted with vertex colours, then exported as one skinned mesh with two
primitives (coastal_wildlife_rig.skin). No downloaded mesh, texture or scanned animal is used.
"""
import bpy, math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/models/home'
SOURCE = ROOT / 'artwork/coastal-home'
helpers = (ROOT / 'bin/build_coastal_wildlife.py').read_text(encoding='utf-8').split('def rabbit():')[0]
exec(compile(helpers, 'build_coastal_wildlife_helpers', 'exec'), globals())
neighbours = (ROOT / 'bin/build_coastal_neighbors.py').read_text(encoding='utf-8')
exec(compile(neighbours[neighbours.index('def airfoil('):neighbours.index('def bird(')], 'build_coastal_neighbors_airfoil', 'exec'), globals())
sys.path.insert(0, str(ROOT / 'bin'))
from coastal_wildlife_rig import skin, export, chain, ramp

plumage = mat('Seabird plumage', (1, 1, 1), .88)
billmat = mat('Seabird bill', (1, 1, 1), .62)
footmat = mat('Seabird feet', (.11, .11, .105), .8)
pelican_eye = mat('Pelican eye', (.62, .62, .55), .2)
cormorant_eye = mat('Cormorant eye', (.03, .30, .34), .2)


def mix(a, b, u):
    return tuple(x + (y - x) * max(0, min(1, u)) for x, y in zip(a, b))


def paint(obj, colour, world=True):
    """One corner colour layer from a function of the world (or local) vertex position."""
    bpy.context.view_layer.update()
    layer = obj.data.color_attributes.new(name='Paint', type='BYTE_COLOR', domain='CORNER')
    for loop in obj.data.loops:
        co = obj.data.vertices[loop.vertex_index].co
        p = obj.matrix_world @ co if world else co
        grain = math.sin(p.x * 61 + p.y * 23) * math.sin(p.z * 47 - p.y * 31) * .012
        layer.data[loop.index].color = (*[max(.004, c + grain) for c in colour(p)], 1)


def bird_eyes(head, x, y, z, size, material):
    for side, label in ((-1, 'L'), (1, 'R')):
        pivot = empty('Eye' + label, head, (side * x, y, z))
        ell('Eye inset', (0, 0, 0), (size, size * .5, size * .9), material, pivot)
        ell('Eye pupil', (0, -size * .32, 0), (size * .45, size * .3, size * .45), eye, pivot, 12, 6)
        ell('Eye catchlight', (-size * .2, -size * .52, size * .25), (size * .17, size * .1, size * .17), glint, pivot, 12, 6)


def wing(body, side, label, shoulder, inner, wrist, hand, primaries, colour):
    w = empty('Wing' + label, body, (side * shoulder[0], shoulder[1], shoulder[2]))
    part = airfoil('Cambered inner wing', inner, plumage, w, side)
    paint(part, lambda p: colour(p, 'inner'), world=False)
    tip = empty('WingTip' + label, w, (side * wrist[0], wrist[1], wrist[2]))
    part = airfoil('Primary hand', hand, plumage, tip, side)
    paint(part, lambda p: colour(p, 'hand'), world=False)
    for f in range(primaries[0]):
        start, y = primaries[1] + f * primaries[2], primaries[3] + f * primaries[4]
        part = airfoil('Fingered primary', [(start, y, -.006, primaries[6], .005), (start + primaries[5] * .75, y + primaries[5] * .12, -.009, primaries[6] * .85, .004),
                                            (start + primaries[5], y + primaries[5] * .18, -.011, .002, .001)], plumage, tip, side)
        paint(part, lambda p: colour(p, 'primary'), world=False)


def webbed_foot(foot, scale, material):
    s = scale
    mesh('Webbed foot', [(0, .02 * s, 0), (-.03 * s, -.05 * s, -.006 * s), (-.01 * s, -.065 * s, -.008 * s), (.01 * s, -.065 * s, -.008 * s),
                         (.03 * s, -.05 * s, -.006 * s), (0, -.008 * s, .01 * s)],
         [(0, 1, 2), (0, 2, 3), (0, 3, 4), (5, 1, 0), (5, 2, 1), (5, 3, 2), (5, 4, 3), (5, 0, 4)], material, foot)


def pelican():
    root = empty('BrownPelican'); body = empty('BodyPose', root, (0, 0, .10))
    parts = [loft('Pelican body', [(-.30, .05, .04, .045), (-.24, .03, .10, .095), (-.10, 0, .155, .13), (.08, 0, .145, .115), (.24, .02, .09, .07), (.34, .035, .035, .03)], plumage, body, 4, 24)]
    # The retracted flight neck folds into a bulge ahead of the breast; the head rides on it.
    for i in range(7):
        u = i / 6
        p = tuple((1 - u) ** 2 * a + 2 * u * (1 - u) * b + u * u * c for a, b, c in zip((0, -.29, .055), (0, -.375, .125), (0, -.33, .215)))
        parts.append(ell('Folded neck', p, (.06 - .016 * u, .062 - .012 * u, .064 - .014 * u), plumage, body))
    head = empty('Head', body, (0, -.31, .26))
    parts.append(ell('Pelican crown', (0, 0, 0), (.042, .066, .046), plumage, head))
    parts.append(ell('Pelican forehead', (0, -.035, -.004), (.032, .04, .034), plumage, head))
    torso = join(parts, 'Continuous pelican body', .0115)
    def coat(p):
        crown = ramp(p.z, .335, .375) * ramp(p.y, -.24, -.30)
        neck = ramp(p.y, -.24, -.29) * ramp(p.z, .16, .22)
        top = (.34, .32, .29) if p.z > .10 else (.19, .17, .14)
        base = mix((.19, .17, .14), (.36, .34, .31), ramp(p.z, .06, .14))
        return mix(mix(base, (.83, .81, .74), neck), (.86, .76, .42), crown)
    paint(torso, coat)
    bird_eyes(head, .036, -.034, .012, .010, pelican_eye)
    muzzle = empty('Muzzle', head, (0, -.05, -.004))
    upper = loft('Pelican upper mandible', [(0, 0, .022, .015), (-.10, -.004, .02, .011), (-.22, -.010, .018, .009), (-.31, -.016, .014, .008), (-.335, -.027, .007, .008)], billmat, muzzle, 4, 16)
    paint(upper, lambda p: mix((.56, .48, .41), (.72, .33, .12), ramp(p.y, -.27, -.33)), world=False)
    jaw = empty('Jaw', muzzle, (0, .002, -.01))
    lower = loft('Pelican lower mandible', [(0, -.004, .02, .008), (-.15, -.010, .018, .007), (-.30, -.014, .011, .006), (-.32, -.016, .004, .004)], billmat, jaw, 4, 14)
    paint(lower, lambda p: (.50, .43, .37), world=False)
    pouch = loft('Pelican pouch', [(.004, -.022, .015, .02), (-.07, -.045, .018, .034), (-.17, -.046, .016, .03), (-.26, -.028, .01, .015), (-.30, -.018, .004, .004)], billmat, jaw, 4, 16)
    paint(pouch, lambda p: (.21, .19, .12), world=False)
    def feathers(p, kind):
        if kind == 'primary': return (.09, .085, .08)
        if kind == 'hand': return mix((.42, .41, .38), (.10, .095, .09), ramp(p.y, -.01, .05))
        return mix((.50, .49, .45), (.12, .11, .10), ramp(p.y, .005, .06))
    for side, label in ((-1, 'L'), (1, 'R')):
        wing(body, side, label, (.10, -.10, .05), [(0, 0, 0, .15, .03), (.15, .012, .008, .16, .027), (.33, .02, .012, .145, .021), (.50, .03, .008, .125, .015)],
             (.48, .03, .008), [(-.03, 0, 0, .12, .014), (.10, .016, -.004, .105, .010), (.22, .04, -.008, .07, .006), (.28, .06, -.01, .005, .002)],
             (6, .15, .022, -.035, .028, .17, .021), feathers)
        leg = empty('Leg' + label, body, (side * .06, .10, -.05))
        ell('Pelican tarsus', (0, 0, -.035), (.014, .016, .04), footmat, leg, 12, 8)
        foot = empty('Foot' + label, leg, (0, -.01, -.075)); webbed_foot(foot, 1.25, footmat)
    tail = empty('Tail', body, (0, .33, .03))
    t = loft('Pelican tail', [(0, 0, .05, .018), (.08, 0, .07, .012), (.15, -.004, .07, .008), (.18, -.004, .05, .004)], plumage, tail, 3, 16)
    paint(t, lambda p: (.24, .22, .19), world=False)
    return root


def cormorant():
    root = empty('BrandtsCormorant'); body = empty('BodyPose', root, (0, .10, .17))
    parts = [loft('Cormorant body', [(-.33, .012, .035, .04), (-.27, 0, .07, .075), (-.15, -.005, .085, .085), (-.02, -.005, .075, .075), (.08, 0, .05, .05), (.12, 0, .025, .025)], plumage, body, 4, 24)]
    for i in range(8):
        u = i / 7
        parts.append(ell('Long neck', (0, -.335 - .19 * u, .012 + .01 * u), (.035 - .006 * u, .045, .037 - .006 * u), plumage, body))
    head = empty('Head', body, (0, -.565, .028))
    parts.append(ell('Cormorant crown', (0, 0, 0), (.028, .05, .032), plumage, head))
    torso = join(parts, 'Continuous cormorant body', .0082)
    def coat(p):
        back = ramp(p.z, .19, .23) * ramp(p.y, -.25, -.05)
        glossy = (.035, .042, .048)
        return mix(glossy, (.10, .085, .07), back * .8)
    paint(torso, coat)
    bird_eyes(head, .023, -.02, .009, .007, cormorant_eye)
    muzzle = empty('Muzzle', head, (0, -.042, .0))
    upper = loft('Cormorant upper mandible', [(0, 0, .011, .01), (-.035, -.002, .008, .007), (-.065, -.004, .006, .005), (-.076, -.009, .004, .005)], billmat, muzzle, 4, 14)
    paint(upper, lambda p: (.12, .12, .12), world=False)
    jaw = empty('Jaw', muzzle, (0, .002, -.008))
    lower = loft('Cormorant lower mandible', [(0, 0, .01, .006), (-.06, -.002, .005, .004), (-.068, -.002, .002, .002)], billmat, jaw, 4, 12)
    paint(lower, lambda p: (.16, .16, .15), world=False)
    gular = ell('Gular patch', (0, .02, -.017), (.015, .032, .012), billmat, jaw, 12, 8)
    paint(gular, lambda p: (.52, .42, .26), world=False)
    def feathers(p, kind):
        if kind == 'inner': return mix((.12, .10, .085), (.05, .05, .055), ramp(p.y, .0, .05))
        return (.04, .042, .045)
    for side, label in ((-1, 'L'), (1, 'R')):
        wing(body, side, label, (.06, -.25, .05), [(0, 0, 0, .095, .02), (.12, .01, .006, .10, .018), (.24, .02, .008, .085, .014)],
             (.23, .02, .006), [(-.02, 0, 0, .075, .011), (.10, .02, -.004, .065, .007), (.20, .045, -.008, .04, .004), (.25, .06, -.01, .004, .002)],
             (5, .10, .022, -.02, .024, .14, .017), feathers)
        leg = empty('Leg' + label, root, (side * .04, .10, .125))
        ell('Cormorant tarsus', (0, 0, -.05), (.011, .013, .058), footmat, leg, 12, 8)
        foot = empty('Foot' + label, root, (side * .045, .08, .008)); webbed_foot(foot, 1.0, footmat)
    tail = empty('Tail', body, (0, .12, 0))
    t = loft('Cormorant tail', [(0, 0, .035, .012), (.10, 0, .05, .008), (.16, 0, .045, .005), (.18, 0, .02, .003)], plumage, tail, 3, 16)
    paint(t, lambda p: (.04, .042, .045), world=False)
    return root


GLOSS = {'Nose and mouth', 'Dark amber animal eyes', 'Eye catchlight', 'Pelican eye', 'Cormorant eye'}


def rig_pelican():
    def weights(part, owner, co):
        if part == 'Continuous pelican body':
            if co.y < -.24 and co.z > .14:
                return chain(co.z, [('NeckBase', .17), ('NeckMid', .25), ('Head', .33)])
            w = ramp(co.y, .22, .32)
            return [('BodyPose', 1 - w), ('Tail', w)]
        if part == 'Cambered inner wing':
            w = ramp(abs(co.x), .48, .60); return [(owner, 1 - w), ('WingTip' + owner[-1], w)]
        return None
    extra = [('NeckBase', 'BodyPose', (0, -.30, .17)), ('NeckMid', 'NeckBase', (0, -.345, .23))]
    return skin(pelican(), extra_bones=extra, parents={'Head': 'NeckMid'}, weights=weights, gloss=GLOSS, coat_roughness=.86,
                coat_name='Brown pelican plumage')


def rig_cormorant():
    def weights(part, owner, co):
        if part == 'Continuous cormorant body':
            if co.y < -.20:
                return chain(-co.y, [('BodyPose', .20), ('NeckBase', .25), ('NeckMid', .38), ('Head', .46)])
            w = ramp(co.y, .17, .23)
            return [('BodyPose', 1 - w), ('Tail', w)]
        if part == 'Cambered inner wing':
            w = ramp(abs(co.x), .23, .31); return [(owner, 1 - w), ('WingTip' + owner[-1], w)]
        return None
    extra = [('NeckBase', 'BodyPose', (0, -.25, .18)), ('NeckMid', 'NeckBase', (0, -.38, .182))]
    return skin(cormorant(), extra_bones=extra, parents={'Head': 'NeckMid'}, weights=weights, gloss=GLOSS, coat_roughness=.8,
                coat_name="Brandt's cormorant plumage")


if __name__ == '__main__':
    rigs = [rig_pelican(), rig_cormorant()]
    for rig in rigs: export(rig, OUT / (rig.name + '.glb'))
    for i, rig in enumerate(rigs): rig.location.x = i * 2.4
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'seabirds.blend'))
