"""A small, grounded fern garden beside the normal-height breakfast bench.

Authored in the nook's retained world convention [x, up, landward]. This adds
four material batches only; existing room geometry, lighting and routes stay
owned by their original builders. The cultivated foliage is original geometry,
using the interior's existing Asplenium/stem/soil materials.
"""
import math

VERSION = 5
FLOOR = -1.02
PREFIX = 'core_breakfast_garden'
BED = {'min': [-6.53, FLOOR - .008, 6.23], 'max': [-5.55, -.78, 6.51]}
ROOTS = [(-6.27, -.799, 6.325), (-5.81, -.799, 6.335)]


def native(point):
    return (point[0], -point[2], point[1])


def blades():
    """Rooted, gently folded strap leaves; no copied bitmap or plant mesh."""
    result = []
    for plant, root in enumerate(ROOTS):
        for leaf in range(7):
            angle = leaf * 2.399963229728653 + plant * .83
            reach = .19 + .025 * math.sin(leaf * 1.73 + plant)
            height = .36 + .065 * math.cos(leaf * 1.31 + plant * .4)
            width = .030 + .004 * math.cos(leaf * 2.11)
            axis = (math.cos(angle) * reach, math.sin(angle) * reach * .48)
            axis_length = math.hypot(*axis)
            side = (-axis[1] / axis_length, axis[0] / axis_length)
            stem_top = (root[0] + axis[0] * .11, root[1] + .055, root[2] + axis[1] * .11)
            vertices = []
            for row in range(11):
                t = row / 10
                horizontal = .18 * t + .82 * t * t
                centre = (stem_top[0] + axis[0] * horizontal,
                          stem_top[1] + height * math.sin(math.pi * .65 * t),
                          stem_top[2] + axis[1] * horizontal)
                half = max(.0008, width * math.sin(math.pi * t) ** .68)
                ruffle = .0018 * math.sin(math.pi * 6 * t + leaf * .7) * math.sin(math.pi * t)
                for k in (-1, 0, 1):
                    vertices.append((centre[0] + side[0] * half * k,
                                     centre[1] + (.006 * math.sin(math.pi * t) if k == 0 else ruffle * k),
                                     centre[2] + side[1] * half * k))
            faces = []
            for row in range(10):
                a, b = row * 3, (row + 1) * 3
                faces += [(a, b+1, b), (a, a+1, b+1), (a+1, b+2, b+1), (a+1, a+2, b+2)]
            result.append({'plant': plant, 'leaf': leaf, 'root': root, 'stemTop': stem_top,
                           'vertices': vertices, 'faces': faces})
    return result


def build(scene):
    import bpy
    import bmesh
    from coastal_office import Parts, box, cylinder
    if scene.get('underBedroomBreakfastGardenVersion') or any(o.name.startswith(PREFIX) for o in scene.objects):
        raise RuntimeError('Existing garden must be reviewed; do not duplicate it')
    if not scene.get('underBedroomBreakfastVersion'):
        raise RuntimeError('The qualified under-bedroom room is required')
    names = {'stone':'warm cut stone','soil':'interior botanical mineral soil',
             'leaf':'interior Asplenium fern leaf','stem':'interior botanical leaf stem'}
    materials = {key:bpy.data.materials[name] for key,name in names.items()}
    parts = Parts(PREFIX)
    def solid(key, lo, hi):
        centre = [(a+b)/2 for a,b in zip(lo,hi)]
        size = [b-a for a,b in zip(lo,hi)]
        box(parts.bm(materials[key]), native(centre), (size[0],size[2],size[1]), 0)
    lo, hi = BED['min'], BED['max']
    wall = .026
    # A single closed rounded liner, with a real inner cavity and floor.
    stone=parts.bm(materials['stone'])
    kind=stone.faces.layers.int.new('Garden rounded stone')
    def ring(inset, y):
        x0,x1,z0,z1=lo[0]+inset,hi[0]-inset,lo[2]+inset,hi[2]-inset
        radius=.035-inset
        points=[]
        for cx,cz,start in [(x1-radius,z1-radius,0),(x0+radius,z1-radius,90),
                            (x0+radius,z0+radius,180),(x1-radius,z0+radius,270)]:
            for k in range(4):
                a=math.radians(start+k*30)
                points.append(stone.verts.new(native((cx+radius*math.cos(a),y,cz+radius*math.sin(a)))))
        return points
    rings=[ring(0,lo[1]),ring(0,hi[1]),ring(wall,hi[1]),ring(wall,lo[1]+.043)]
    for layer,(a,b) in enumerate(zip(rings,rings[1:])):
        for j in range(16):
            f=stone.faces.new((a[j],a[(j+1)%16],b[(j+1)%16],b[j]))
            f[kind]=1 if layer!=1 else 0
    stone.faces.new(tuple(reversed(rings[0])))[kind]=0
    stone.faces.new(tuple(rings[-1]))[kind]=0
    bmesh.ops.recalc_face_normals(stone,faces=list(stone.faces))
    solid('soil',[lo[0]+wall+.003,hi[1]-.032,lo[2]+wall+.003],
                 [hi[0]-wall-.003,hi[1]-.018,hi[2]-wall-.003])
    leaves = parts.bm(materials['leaf'])
    for leaf in blades():
        verts = [leaves.verts.new(native(p)) for p in leaf['vertices']]
        for face in leaf['faces']:
            polygon = leaves.faces.new([verts[i] for i in face]); polygon.smooth = True
        root, top = leaf['root'], leaf['stemTop']
        middle = ((root[0]+top[0])/2, root[1]+.032, (root[2]+top[2])/2)
        cylinder(parts.bm(materials['stem']),native(root),native(middle),.0028,4)
        cylinder(parts.bm(materials['stem']),native(middle),native(top),.0023,4)
    # Three rounded pebbles in gaps between the rooted plants.
    stones = parts.bm(materials['stone'])
    for x, z, radius in ((-6.45, 6.36, .027), (-6.04, 6.40, .034),
                         (-5.62, 6.32, .025)):
        y = hi[1]-.019
        previous=set(stones.faces)
        result=bmesh.ops.create_icosphere(stones,subdivisions=1,radius=1)
        for v in result['verts']:
            a,b,c=v.co
            v.co=native((x+radius*a,y+.017*c,z-radius*.67*b))
        for face in set(stones.faces)-previous:face[kind]=1
    objects = parts.finish()
    for obj in objects:
        obj['breakfastGarden'] = True
        if obj.name.endswith('__warm cut stone'):
            attr=obj.data.attributes['Garden rounded stone']
            for face in obj.data.polygons:face.use_smooth=bool(attr.data[face.index].value)
        elif obj.name.endswith('__interior botanical mineral soil'):
            for face in obj.data.polygons:face.use_smooth=False
    scene['underBedroomBreakfastGardenVersion'] = VERSION
    return objects, {'version':VERSION,'bed':BED,'roots':[list(p)for p in ROOTS],
      'leafCount':14,'materials':names,'nativeGroundOverlapM':.008,
      'scope':'New additive garden only; unchanged existing source, fixtures and circulation require independent native/decoded/appearance checks.'}
