"""Original articulated raccoon, western gull and sandpiper masters.

Blender Z-up / -Y forward. Only these three exports and their editable source
are written; the approved rabbit and pinniped masters are retained byte-for-byte.
"""
import bpy, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/models/home'
SOURCE = ROOT / 'artwork/coastal-home'
# Reuse the original author's primitive/sculpt helpers without executing its
# animal builders or exports. This keeps the two sources independently rebuildable.
helpers = (ROOT / 'bin/build_coastal_wildlife.py').read_text(encoding='utf-8').split('def rabbit():')[0]
exec(compile(helpers, 'build_coastal_wildlife_helpers', 'exec'), globals())

coat = mat('Raccoon grizzled coat', (.31, .29, .25), .94)
gullwhite = mat('Western gull ivory', (.76, .77, .72), .86)
gullgray = mat('Western gull mantle', (.29, .33, .34), .91)
featherink = mat('Flight feather tips', (.035, .043, .042), .91)
bill = mat('Gull bill ochre', (.63, .40, .095), .72)
billspot = mat('Quiet bill spot', (.32, .105, .065), .88)
legpink = mat('Gull leg muted pink', (.48, .32, .27), .84)
sandcoat = mat('Sandpiper warm slate', (.31, .29, .24), .93)
sandbelly = mat('Sandpiper pale belly', (.63, .60, .49), .93)
sandleg = mat('Sandpiper dark legs', (.14, .16, .13), .89)
eye_surface = mat('Original inset eye surface', (1,1,1), .2)
feather_surface = mat('Original shaded flight feathers', (1,1,1), .91)


def paint_shared_surface(pivot, target):
    # Preserve authored shade changes as vertex colors, then merge the static
    # same-material surface under this one acting pivot to bound draw calls.
    attribute = 'Neighbour shades'
    node = target.node_tree.nodes.get(attribute) or target.node_tree.nodes.new('ShaderNodeVertexColor')
    node.name = attribute; node.layer_name = attribute
    target.node_tree.links.new(node.outputs['Color'], target.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    for obj in pivot.children:
        if obj.type!='MESH':continue
        color = tuple(obj.data.materials[0].diffuse_color)
        layer = obj.data.color_attributes.new(name=attribute,type='BYTE_COLOR',domain='CORNER')
        for value in layer.data:value.color=color
        obj.data.materials[0]=target


def neighbor_eyes(root):
    for pivot in root.children_recursive:
        if pivot.type=='EMPTY' and pivot.name.split('.')[0] in ('EyeL','EyeR'):
            paint_shared_surface(pivot,eye_surface)


def vertex_coat(obj, kind):
    layer = obj.data.color_attributes.new(name='Original coat', type='BYTE_COLOR', domain='CORNER')
    for loop in obj.data.loops:
        p = obj.matrix_world @ obj.data.vertices[loop.vertex_index].co
        grain = math.sin(p.x*59+p.y*29)*math.sin(p.z*41-p.y*19)*.024
        if kind == 'tail':
            ring = .5 + .5*math.cos((p.y-.40)*math.tau/.13)
            dark = max(0, min(1, (ring-.4)*4))*.18
            c = (.32+grain-dark, .30+grain-dark, .25+grain-dark)
        elif kind == 'head':
            # Integrated cheek and mask colours follow the shaped face surface.
            mask = math.exp(-((abs(p.x)-.085)/.082)**4-((p.z-.405)/.065)**4) if p.y < -.335 else 0
            muzzle = max(0, min(1, (-p.y-.36)/.12))*.18
            c = (max(.006,.42+grain+muzzle-mask*.405), max(.006,.40+grain+muzzle-mask*.385), max(.006,.34+grain+muzzle-mask*.325))
        else:
            light = max(0, min(1, (.36-p.z)/.24))*.08
            c = (.31+grain+light, .29+grain+light, .25+grain+light)
        layer.data[loop.index].color = (*c, 1)
    material = obj.data.materials[0]
    material.diffuse_color = (1, 1, 1, 1)
    node = material.node_tree.nodes.get('Original coat') or material.node_tree.nodes.new('ShaderNodeVertexColor')
    node.name = 'Original coat'; node.layer_name = 'Original coat'
    material.node_tree.links.new(node.outputs['Color'], material.node_tree.nodes['Principled BSDF'].inputs['Base Color'])


def raccoon():
    root = empty('Raccoon'); body = empty('BodyPose', root)
    loft('Continuous arched raccoon trunk', [(-.29,.285,.115,.13),(-.15,.32,.18,.16),(.09,.335,.215,.185),(.29,.32,.19,.16),(.39,.28,.045,.065)], coat, body, 5, 24)
    head = empty('Head', body, (0,-.30,.37))
    shaped = join([ell('Raccoon brow',(0,-.01,.02),(.135,.14,.12),coat,head), ell('Tapered snout',(0,-.115,-.043),(.074,.11,.054),coat,head)], 'Continuous tapered raccoon head', .009)
    muzzle = empty('Muzzle', head, (0,-.222,-.036))
    ell('Soft raccoon nose',(0,0,.007),(.034,.022,.021),ink,muzzle)
    tube('Raccoon lip',[(-.04,-.216,-.061),(0,-.225,-.066),(.04,-.216,-.061)],.0022,ink,head)
    eyes(head,.099,-.103,.035,.019)
    for side,label in ((-1,'L'),(1,'R')):
        ear = empty('Ear'+label,head,(side*.105,.018,.095))
        ell('Round rimmed ear',(0,0,.036),(.043,.025,.054),coat,ear)
        ell('Inset ear',(0,-.022,.039),(.025,.007,.033),ink,ear,16,8)
        for fore, span, hipz, width in ((True,-.215,.29,.15),(False,.235,.305,.17)):
            labelroot = 'Foreleg' if fore else 'Hindleg'
            upper = empty(labelroot+label,root,(side*width,span,hipz))
            ell('Upper articulated leg',(0,0,-.077),(.038,.046,.095),coat,upper)
            lower = empty('Lower'+labelroot+label,root,(side*width,span,-.15+hipz))
            ell('Lower articulated leg',(0,0,-.065),(.026,.029,.078),coat,lower)
            paw = empty(('FrontPaw' if fore else 'HindPaw')+label,root,(side*width,span-.025,.025))
            ell('Bare five-toed paw',(0,-.013,0),(.043,.062,.025),ink,paw,16,8)
            for digit in range(5):
                ell('Quiet toe',((digit-2)*.013,-.062+abs(digit-2)*.005,-.003),(.008,.028,.012),ink,paw,12,6)
    tail = empty('Tail',body,(0,.35,.28))
    tailmesh = loft('Continuous ringed tail',[(0,0,.085,.075),(.12,-.04,.082,.072),(.29,-.12,.073,.062),(.48,-.17,.054,.047),(.61,-.17,.008,.014)],coat,tail,6,20)
    neighbor_eyes(root);merge(root); bpy.context.view_layer.update()
    for obj in root.children_recursive:
        if obj.type=='MESH' and obj.data.materials[0]==coat:
            vertex_coat(obj,'tail' if obj.parent==tail else 'head' if obj.parent==head else 'body')
    return root


def airfoil(name, profiles, material, parent, side):
    # Continuous closed elliptical cross-sections along the span, with real
    # camber, taper and swept trailing edge instead of separate flat spheres.
    sides=12; vertices=[]
    for x,y,z,chord,thickness in profiles:
        for i in range(sides):
            a=i*math.tau/sides
            vertices.append((side*x,y+math.cos(a)*chord,z+math.sin(a)*thickness))
    faces=[]
    for j in range(len(profiles)-1):
        for i in range(sides):
            a=j*sides+i; b=j*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces += [tuple(reversed(range(sides))),tuple((len(profiles)-1)*sides+i for i in range(sides))]
    return mesh(name,vertices,faces,material,parent)


def bird(sand=False):
    root=empty('Sandpiper' if sand else 'WesternGull'); body=empty('BodyPose',root)
    material=sandcoat if sand else gullwhite
    loft('Continuous bird breast and tail',[(-.19,.22,.045,.055),(-.11,.205,.084,.115),(.06,.185,.101,.113),(.19,.18,.064,.060),(.30,.165,.014,.016)],material,body,5,20)
    ell('Breast inset',(0,-.023,.135),(.075,.135,.052),sandbelly if sand else gullwhite,body)
    head=empty('Head',body,(0,-.172,.295 if sand else .33))
    join([ell('Bird crown',(0,-.013,.01),(.070 if sand else .09,.081,.087),material,head),ell('Joined neck',(0,.055,-.065),(.057,.069,.093),material,head)],'Shaped bird head and neck',.009)
    eyes(head,.063 if sand else .078,-.05,.025,.011 if sand else .013)
    muzzle=empty('Muzzle',head,(0,-.103,-.002))
    if sand:
        # Long fine probing bill with a flattened base and closed taper.
        loft('Fine sandpiper bill',[(-.165,-.001,.001,.002),(-.09,0,.008,.007),(0,.004,.016,.013)],ink,muzzle,4,12)
    else:
        loft('Tapered gull bill',[(-.148,-.007,.004,.007),(-.117,.004,.020,.022),(-.04,.004,.027,.025),(.013,.004,.020,.020)],bill,muzzle,4,16)
        ell('Muted red bill spot',(0,-.074,-.018),(.015,.023,.005),billspot,muzzle,12,6)
        tube('Bill seam',[(-.019,-.018,-.001),(-.018,-.091,-.003),(0,-.137,-.007)],.0012,ink,muzzle)
    for side,label in ((-1,'L'),(1,'R')):
        wing=empty('Wing'+label,body,(side*.057,.012,.218))
        airfoil('Cambered connected upper wing',[(0,0,0,.096,.025),(.08,.006,.006,.106,.026),(.21,.03,.012,.088,.022),(.31,.065,.007,.075,.015)],sandcoat if sand else gullgray,wing,side)
        tip=empty('WingTip'+label,wing,(side*.275,.049,.008))
        airfoil('Overlapping primary fan',[(-.026,-.008,-.001,.079,.017),(.07,.01,-.006,.073,.013),(.18,.056,-.012,.055,.008),(.28,.107,-.018,.003,.002)],sandcoat if sand else gullwhite,tip,side)
        for feather in range(5):
            start=.105+feather*.028; y=.026+feather*.012
            airfoil('Tapered primary feather',[(start,y,-.008,.041,.006),(start+.085,y+.018,-.01,.037,.004),(start+.11,y+.032,-.012,.001,.001)],sandcoat if sand else featherink,tip,side)
        leg=empty('Leg'+label,root,(side*.043,.018,.135))
        ell('Slender tarsus',(0,0,-.052),(.009,.011,.062),sandleg if sand else legpink,leg,12,8)
        foot=empty('Foot'+label,root,(side*.043,-.009,.009))
        if sand:
            for digit in range(3):
                tube('Separated probing toe',[(0,0,0),((digit-1)*.018,-.029,-.006),((digit-1)*.025,-.055,-.009)],.004,sandleg,foot)
            tube('Rear toe',[(0,0,0),(0,.024,-.007)],.0035,sandleg,foot)
        else:
            mesh('Actual webbed foot',[(0,.025,0),(-.026,-.046,-.006),(0,-.059,-.009),(.026,-.046,-.006),(0,-.009,.011)],[(0,1,2,3),(0,4,1),(1,4,2),(2,4,3),(3,4,0)],legpink,foot)
    neighbor_eyes(root)
    if not sand:
        for pivot in root.children_recursive:
            if pivot.type=='EMPTY' and pivot.name.split('.')[0] in ('WingTipL','WingTipR'):
                paint_shared_surface(pivot,feather_surface)
    merge(root);return root


masters=[raccoon(),bird(),bird(True)]
pivots={obj:obj.name for obj in bpy.data.objects if obj.type=='EMPTY'}
for root in masters:
    for obj,name in pivots.items():obj.name='Source retained '+name
    root.name=pivots[root]
    for obj in root.children_recursive:
        if obj in pivots:obj.name=pivots[obj].split('.')[0]
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for obj in root.children_recursive:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(root.name+'.glb')),export_format='GLB',use_selection=True,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7)
    print('NEIGHBOUR',root.name,'meshes',sum(obj.type=='MESH' for obj in root.children_recursive),'triangles',sum(sum(len(face.vertices)-2 for face in obj.data.polygons) for obj in root.children_recursive if obj.type=='MESH'))
    for obj,name in pivots.items():obj.name='Restore source '+name
    for obj,name in pivots.items():obj.name=name
for i,root in enumerate(masters):root.location.x=i*1.8
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'neighbors.blend'))
