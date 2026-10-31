"""Small fitted planting compositions and a carved library hearth.

Author in the retained native coordinates, after the library/workstation move
and before the estate's one final landward transform. No asset export, source
save, new shadow light or runtime pass is owned by this module.
"""
import math

import bpy
from mathutils import Vector

from coastal_landscape import web
from coastal_office import Parts, box, cylinder, _mat

PREFIXES = ("lounge_refined_", "library_refined_", "bath-living_refined_", "bath-bedroom_refined_")
HEARTH = (-12.3, 5.1, 0.0)


def materials():
    get = bpy.data.materials.get
    return {
        "stone": get("honed travertine") or get("warm cut stone"),
        "oak": get("pale oak"), "dark": get("charcoal"),
        "bark": get("honey ash"), "bronze": get("brushed brass"),
        "soil": _mat("interior botanical mineral soil", (.065, .052, .036), .98),
        "broad": _mat("interior Strelitzia broadleaf", (.075, .18, .105), .68),
        "fern": _mat("interior Asplenium fern leaf", (.16, .275, .095), .8),
        "vine": _mat("interior Epipremnum leaf", (.17, .235, .085), .77),
        "stem": _mat("interior botanical leaf stem", (.095, .145, .055), .84),
        "ember": _mat("library hearth ember glow", (.55, .09, .015), .8, 0, (1, .16, .018), 2.4),
        "flame": _mat("library hearth warm flame", (1, .24, .025), .7, 0, (1, .24, .025), 3.0),
        "steel": _mat("library hearth blackened steel", (.025, .023, .019), .64, .45),
    }


def _trough(p, m, center, size, finish="stone"):
    """An open liner integrated with a low joinery plinth, not a floating pot."""
    x, y, z = center
    sx, sy, h = size
    shell, soil = p.bm(m[finish]), p.bm(m["soil"])
    wall = .035 if sx > .3 else .015
    box(shell, (x, y, z+.025), (sx, sy, .05), .012)
    for sign in (-1, 1):
        box(shell, (x+sign*(sx-wall)/2, y, z+h/2), (wall, sy, h), .012)
        box(shell, (x, y+sign*(sy-wall)/2, z+h/2), (sx-2*wall, wall, h), .012)
    box(soil, (x, y, z+h-.025), (sx-2.2*wall, sy-2.2*wall, .018))
    return Vector((x, y, z+h-.016))


def _blade(stem, leaves, base, start, tip, width, bend=.045):
    """A broad pointed blade, lightly folded around a real rooted midrib."""
    base, start, tip = Vector(base), Vector(start), Vector(tip)
    cylinder(stem, base, start, .007, 7, radius2=.004)
    axis = tip-start
    side = axis.cross(Vector((0, 0, 1)))
    if side.length < .001:
        side = Vector((1, 0, 0))
    side.normalize()
    rings = []
    for k in range(9):
        t = k/8
        mid = start.lerp(tip, t)
        mid.z += bend*math.sin(t*math.pi)
        w = max(.0007, width*math.sin(t*math.pi)**.68)
        rings.append([leaves.verts.new(mid+side*w*s-Vector((0, 0, abs(s)*w*.22)))
                      for s in (-1, 0, 1)])
        if k:
            cylinder(stem, tuple(rings[k-1][1].co), tuple(rings[k][1].co), .0025, 5)
    for a, b in zip(rings, rings[1:]):
        for j in range(2):
            leaves.faces.new((a[j], a[j+1], b[j+1], b[j]))


def _strelitzia(p, m, base):
    stem, leaf = p.bm(m["stem"]), p.bm(m["broad"])
    # The fans lean along the north return, keeping the doorway and the middle
    # of the panorama clear. Different heights make a single curated silhouette.
    for x, y, start_z, dx, dy, dz, width in (
            (-.06, -.36, .72, -.22, -.15, .67, .13),
            (.03, -.18, .93, -.09, .18, .58, .15),
            (-.04, .10, .65, -.20, .35, .56, .135),
            (.02, .32, .82, .06, .13, .58, .12),
            (-.08, .02, .53, -.17, -.18, .48, .11)):
        foot = base+Vector((x, y, 0))
        start = foot+Vector((-.025, .02, start_z))
        _blade(stem, leaf, foot, start, start+Vector((dx, dy, dz)), width)


def _fern(p, m, base, scale=1):
    stem, leaf = p.bm(m["stem"]), p.bm(m["fern"])
    for k in range(9):
        a = k*2.399963
        reach = (.18+.045*math.sin(k*1.7))*scale
        foot = Vector(base)+Vector((math.cos(a)*.012, math.sin(a)*.012, 0))
        start = foot+Vector((0, 0, .035*scale))
        tip = foot+Vector((math.cos(a)*reach, math.sin(a)*reach, (.20+.08*math.cos(k))*scale))
        _blade(stem, leaf, foot, start, tip, .043*scale, .075*scale)


def pothos_lamina(root, original_tip, width, index):
    """A cupped trailing blade oriented toward the seaward window.

    Only Epipremnum uses this form. The petiole root remains fixed and the
    retained blade length/width sets its size. The lamina hangs downward with
    a varied inclination; its normal follows the physical +Y window and the
    sky above, independently of any camera. Four broad cross-sections keep
    the little plant inexpensive while giving its silhouette a real fold.
    """
    root, original_tip = Vector(root), Vector(original_tip)
    old_axis = original_tip-root
    length = old_axis.length
    side = 1 if old_axis.x >= 0 else -1
    phase = index*2.399963229728653
    axis = Vector((side*(.55+.08*math.sin(phase)),
                   .29+.055*math.cos(phase*.71),
                   -.79+.045*math.sin(phase*.83))).normalized()
    light = Vector((.16*math.sin(phase), 1, .65))
    normal = (light-axis*light.dot(axis)).normalized()
    lateral = normal.cross(axis).normalized()
    # Small alternating twist and unequal lobes avoid thirty repeated cards.
    twist = .12*math.sin(phase*1.3)
    transverse = lateral*math.cos(twist)+normal*math.sin(twist)
    bend_normal = axis.cross(transverse).normalized()
    if bend_normal.dot(normal) < 0:
        bend_normal.negate()
    vertices = [root]
    rings = []
    for t, profile in ((.14, .78), (.36, 1.), (.62, .75), (.84, .34)):
        center = root+axis*(length*t)+bend_normal*(.007*math.sin(math.pi*t))
        ring = []
        for s in (-1, 0, 1):
            breadth = width*profile*(.94 if s < 0 else 1.)
            # A shallow raised midrib and recurved edges catch actual light;
            # they are geometry, not a face-the-viewer normal override.
            ridge = (.0014 if s == 0 else -.0030)*math.sin(math.pi*t)
            ring.append(len(vertices))
            vertices.append(center+transverse*(s*breadth)+bend_normal*ridge)
        rings.append(ring)
    tip = len(vertices)
    vertices.append(root+axis*length)
    faces = [(0, rings[0][0], rings[0][1]), (0, rings[0][1], rings[0][2])]
    for a, b in zip(rings, rings[1:]):
        faces.extend(((a[0], b[0], b[1], a[1]), (a[1], b[1], b[2], a[2])))
    faces.extend(((rings[-1][0], tip, rings[-1][1]), (rings[-1][1], tip, rings[-1][2])))
    # Keep every triangle wound toward the physical window. The cross-section
    # indexing above is deliberately independent of alternating stem sides.
    a, b, c = (vertices[i] for i in faces[0])
    if (b-a).cross(c-a).dot(normal) < 0:
        faces = [tuple(reversed(face)) for face in faces]
    return vertices, faces


def _pothos(p, m, base):
    stem, leaf = p.bm(m["stem"]), p.bm(m["vine"])
    for strand in range(3):
        previous = Vector(base)+Vector((-.055+strand*.055, .01, 0))
        for k in range(10):
            point = Vector(base)+Vector((-.055+strand*.055+.035*math.sin(k*.75+strand),
                                        .06+.018*math.sin(k), -.052*k))
            if k:
                cylinder(stem, previous, point, .003, 6)
            side = -1 if k%2 else 1
            root = point+Vector((side*.018, .012, -.004))
            tip = root+Vector((side*.068, .045, -.018))
            cylinder(stem, point, root, .0025, 3)
            vertices, faces = pothos_lamina(root, tip, .036, strand*10+k)
            added = [leaf.verts.new(v) for v in vertices]
            for face in faces:
                leaf.faces.new([added[i] for i in face])
            previous = point


def _hearth(p, m):
    x, y, _ = HEARTH
    stone, steel = p.bm(m["stone"]), p.bm(m["steel"])
    # Solid jambs, hearth and lintel enclose a genuinely recessed firebox. The
    # opening faces into the library, with a slim flue disappearing into rock.
    box(stone, (x+.12, y, .10), (.78, 1.88, .20), .055)
    for side in (-1, 1):
        box(stone, (x+.055, y+side*.77, .62), (.53, .22, .90), .035)
    box(stone, (x+.055, y, 1.105), (.56, 1.76, .17), .04)
    box(steel, (x-.19, y, .62), (.025, 1.34, .82), .005)
    box(steel, (x+.03, y, .225), (.45, 1.32, .045), .008)
    cylinder(steel, (x-.15, y, 1.14), (x-.15, y, 5.57), .075, 18)
    # Charred split logs and separate warm embers, rather than a glowing solid
    # orange wall. The stylized flames are authored geometry, not a fire solver.
    for k in range(4):
        yy = y-.48+k*.31
        cylinder(p.bm(m["bark"]), (x-.075, yy-.11, .29), (x+.14, yy+.13, .34), .045, 9)
    for k in range(12):
        yy = y-.53+k*.096
        cylinder(p.bm(m["ember"]), (x+.07, yy, .265), (x+.07, yy, .280), .044, 9)
    flame = p.bm(m["flame"])
    for k in range(5):
        yy, h = y-.44+k*.22, .24+.065*math.sin(k*1.8)
        a = flame.verts.new((x+.09, yy-.057, .28))
        b = flame.verts.new((x+.13, yy+.065, .28))
        c = flame.verts.new((x+.10, yy+.052, .40))
        d = flame.verts.new((x+.04, yy+.015, .28+h))
        e = flame.verts.new((x+.085, yy-.045, .40))
        flame.faces.new((a, b, c, d, e))
    # One small, dim brass reading sconce is a fitted native detail; its useful
    # illumination is the existing library cove, not an extra PointLight.
    cylinder(p.bm(m["bronze"]), (x+.03, y-1.05, 1.45), (x+.23, y-1.05, 1.45), .013, 10)


def apply(scene, config):
    """Idempotent additive refresh; returns native objects plus explicit metadata."""
    removed = []
    for obj in list(scene.objects):
        if obj.name.startswith(PREFIXES) or obj.name.startswith("lounge_retained_plant_olive_"):
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    m, objects, roots = materials(), [], []

    p = Parts("lounge_refined_botanical")
    base = _trough(p, m, (4.89, 3.65, 0), (.42, 1.25, .34))
    _strelitzia(p, m, base)
    objects += p.finish()
    roots.append({"room": "lounge", "species": "Strelitzia", "root": web(base),
                  "support": "floor-mounted limestone bed at the north glazing return"})

    for id, _, floor in (("bath-living", "Guest bathroom", 0), ("bath-bedroom", "En suite", 2.6)):
        p = Parts(id+"_refined_botanical")
        base = _trough(p, m, (-8.055, -3.12, floor+.869), (.15, .20, .075), "oak")
        _fern(p, m, base, .65)
        parts = p.finish()
        for obj in parts:
            obj["bathroomRoom"] = id
        objects += parts
        roots.append({"room": id, "species": "Asplenium", "root": web(base),
                      "support": "small inset oak liner on the actual vanity stone"})

    p = Parts("library_refined_botanical")
    # Fitted into the landward bookshelf's upper end, away from the hearth and
    # spiral approach. The trailing leaves are attached to their own stems.
    box(p.bm(m["oak"]), (-11.65, -2.16, 3.04), (.56, .31, .055), .014)
    base = _trough(p, m, (-11.65, -2.16, 3.065), (.37, .23, .12), "oak")
    _pothos(p, m, base)
    objects += p.finish()
    roots.append({"room": "library", "species": "Epipremnum", "root": web(base),
                  "support": "fitted bookshelf liner, clear of the spiral and fireplace"})

    p = Parts("library_refined_hearth")
    _hearth(p, m)
    parts = p.finish()
    for obj in parts:
        if any(mat and "glow" in mat.name or mat and "flame" in mat.name for mat in obj.data.materials):
            obj["installationGlow"] = "library-hearth"
        obj["interiorRefinement"] = True
    objects += parts
    points = config.setdefault("installationPoints", [])
    points[:] = [point for point in points if point.get("id") != "library-hearth"]
    points.append({"id": "library-hearth", "schedule": "libraryHearth", "position": web((-11.95, 5.1, .56)),
                   "intensity": 1.8, "color": [1, .45, .15], "transport": True,
                   "distance": 5.0, "emitterRadius": .22, "glowTag": "library-hearth",
                   "region": {"min": [-12.55, -.05, -7.15], "max": [-8.55, 5.65, 2.5]}})
    scene["interiorRefinementVersion"] = 1
    report = {"version": 1, "coordinates": "native before the final estate setback",
              "removed": removed, "planting": roots, "hearth": {"base": list(HEARTH),
              "flueTop": web((-12.45, 5.1, 5.57)), "newAnalyticPoints": 1,
              "newPointLights": 0, "newShadowMaps": 0},
              "objects": [{"name": obj.name, "vertices": len(obj.data.vertices),
                           "triangles": sum(len(face.vertices)-2 for face in obj.data.polygons)} for obj in objects]}
    return objects, report
