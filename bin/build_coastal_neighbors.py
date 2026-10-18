"""Original articulated raccoon, western gull and sandpiper masters.

Blender Z-up / -Y forward. Only these three exports and their editable source
are written. Each master is exported as one skinned mesh (coastal_wildlife_rig.skin):
the raccoon's trunk and three-bone tail bend, the birds' necks and tails bend, and the
gull's lower mandible opens for calls and squabbles.
"""
import bpy, math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/models/home'
SOURCE = ROOT / 'artwork/coastal-home'
# Reuse the original author's primitive/sculpt helpers without executing its
# animal builders or exports. This keeps the two sources independently rebuildable.
helpers = (ROOT / 'bin/build_coastal_wildlife.py').read_text(encoding='utf-8').split('def rabbit():')[0]
exec(compile(helpers, 'build_coastal_wildlife_helpers', 'exec'), globals())
sys.path.insert(0, str(ROOT / 'bin'))
from coastal_wildlife_rig import skin, export, chain, ramp

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
gape = mat('Gull gape', (.36, .07, .055), .6)


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
    # Three tail bones follow the ringed loft's centreline so the tail can curl and sway.
    mid = empty('TailMid',tail,(0,.24,-.10)); empty('TailTip',mid,(0,.22,-.065))
    loft('Continuous ringed tail',[(0,0,.085,.075),(.12,-.04,.082,.072),(.29,-.12,.073,.062),(.48,-.17,.054,.047),(.61,-.17,.008,.014)],coat,tail,6,20)
    neighbor_eyes(root); bpy.context.view_layer.update()
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
        # Upper and lower mandibles meet at the gape; the lower one, with its red gonys spot,
        # hangs from a Jaw pivot so calls and threats open the bill over a dark gape.
        loft('Hooked upper mandible',[(-.150,-.007,.004,.006),(-.135,0,.012,.012),(-.117,.008,.019,.016),(-.04,.011,.026,.016),(.013,.01,.02,.015)],bill,muzzle,4,16)
        jaw=empty('Jaw',muzzle,(0,.004,-.004))
        loft('Angled lower mandible',[(-.137,-.002,.003,.004),(-.114,-.008,.013,.009),(-.06,-.006,.02,.009),(.008,-.002,.018,.01)],bill,jaw,4,16)
        ell('Muted red bill spot',(0,-.108,-.011),(.014,.016,.006),billspot,jaw,12,6)
        ell('Gull gape',(0,-.05,-.002),(.017,.065,.006),gape,muzzle,12,6)
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
    return root


GLOSS = {'Nose and mouth', 'Original inset eye surface', 'Gull gape'}


def rig_raccoon():
    def weights(part, owner, co):
        if part == 'Continuous arched raccoon trunk':return chain(co.y,[('Chest',-.17),('Hips',.2)])
        if part == 'Continuous ringed tail':return chain(co.y,[('Tail',.38),('TailMid',.59),('TailTip',.8)])
        if part == 'Upper articulated leg':w=ramp(co.z,.17,.125);return [(owner,1-w),('Lower'+owner,w)]
        if part == 'Lower articulated leg':
            w=ramp(co.z,.035,.005);paw=('FrontPaw' if 'Fore' in owner else 'HindPaw')+owner[-1];return [(owner,1-w),(paw,w)]
        return None
    return skin(raccoon(),extra_bones=[('Hips','BodyPose',(0,.20,.32)),('Chest','BodyPose',(0,-.16,.33))],
        parents={'Head':'Chest','Tail':'Hips'},weights=weights,gloss=GLOSS,coat_roughness=.94,coat_name='Raccoon grizzled coat')


def rig_bird(sand):
    head_z = .295 if sand else .33
    def weights(part, owner, co):
        if part == 'Shaped bird head and neck':w=ramp(co.z,head_z-.085,head_z-.03);return [('Neck',1-w),('Head',w)]
        if part == 'Continuous bird breast and tail':w=ramp(co.y,.12,.23);return [('BodyPose',1-w),('Tail',w)]
        if part == 'Cambered connected upper wing':w=ramp(abs(co.x),.28,.35);return [(owner,1-w),('WingTip'+owner[-1],w)]
        if part == 'Gull gape':return [('Muzzle',.5),('Jaw',.5)]
        return None
    extra=[('Neck','BodyPose',(0,-.115,head_z-.07)),('Tail','BodyPose',(0,.20,.172))]
    return skin(bird(sand),extra_bones=extra,parents={'Head':'Neck'},weights=weights,gloss=GLOSS,coat_roughness=.9,
        coat_name='Sandpiper plumage' if sand else 'Western gull plumage')


if __name__ == '__main__':
    rigs=[rig_raccoon(),rig_bird(False),rig_bird(True)]
    for rig in rigs:export(rig,OUT/(rig.name+'.glb'))
    for i,rig in enumerate(rigs):rig.location.x=i*1.8
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'neighbors.blend'))
    # Contact data is authored from the retained physical surfaces and these exact
    # deployed soles. The helper reads the coast, but never saves or changes it.
    from runpy import run_path
    run_path(str(ROOT/'bin/build_coastal_perch_support.py'),run_name='__main__')
