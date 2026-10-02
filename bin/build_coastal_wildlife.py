"""Original coastal animal masters: crafted profiles, articulated pivots, vertex coat marks.
Blender Z-up animals face -Y, exported as +Z; runtime aligns the habitat heading.
No downloaded model, commercial texture, generated backdrop, or biological solver.
"""
import bpy, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/models/home'; SOURCE=ROOT/'artwork/coastal-home'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def mat(name,c,rough=.8):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough
    return m
fur=mat('Brush rabbit agouti',(.30,.25,.18));cream=mat('Warm muzzle',(.54,.48,.37));ink=mat('Nose and mouth',(.023,.029,.025),.48)
eye=mat('Dark amber animal eyes',(.028,.020,.012),.2);glint=mat('Eye catchlight',(.68,.72,.65),.25)
pink=mat('Rabbit ear lining',(.37,.25,.19));brown=mat('California sea lion umber',(.19,.125,.075),.63);sealmat=mat('Harbor seal slate',(.29,.33,.32),.74)
def empty(name,parent=None,p=(0,0,0)):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;o.location=p;return o

def ell(name,p,s,m,parent,segments=20,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings)
    o=bpy.context.object;o.name=name;o.parent=parent;o.location=p;o.scale=s;o.data.materials.append(m)
    for f in o.data.polygons:f.use_smooth=True
    return o

def mesh(name,verts,faces,m,parent):
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d)
    bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(m)
    for f in d.polygons:f.use_smooth=True
    return o

def loft(name,profiles,m,parent,slices=3,sides=20):
    # Closed Catmull-Rom sections: (longitudinal y, center z, width, height).
    def cubic(a,b,c,d,t):return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
    rows=[]
    for i in range(len(profiles)-1):
        for j in range(slices):
            a,b,c,d=[profiles[max(0,min(len(profiles)-1,k))] for k in (i-1,i,i+1,i+2)]
            row=[cubic(a[k],b[k],c[k],d[k],j/slices) for k in range(4)];row[2]=max(.001,row[2]);row[3]=max(.001,row[3]);rows.append(row)
    rows.append(profiles[-1]);verts=[(math.cos(j*math.tau/sides)*rx,y,z+math.sin(j*math.tau/sides)*rz) for y,z,rx,rz in rows for j in range(sides)]
    faces=[]
    for i in range(len(rows)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,a+sides,b+sides,b))
    faces.extend([tuple(range(sides)),tuple((len(rows)-1)*sides+j for j in reversed(range(sides)))])
    return mesh(name,verts,faces,m,parent)

def tube(name,points,radius,m,parent):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=2;d.bevel_depth=radius;d.bevel_resolution=0
    s=d.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for b,p in zip(s.bezier_points,points):b.co=p;b.handle_left_type=b.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(m);return o

def join(objects,name,remesh=None):
    parent=objects[0].parent;bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.join();o=bpy.context.object
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if remesh:
        r=o.modifiers.new('Continuous sculpt surface','REMESH');r.mode='VOXEL';r.voxel_size=remesh;r.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=r.name)
        r=o.modifiers.new('Surface polish','SMOOTH');r.factor=.65;r.iterations=3;bpy.ops.object.modifier_apply(modifier=r.name)
        r=o.modifiers.new('Web silhouette budget','DECIMATE');r.ratio=.24;bpy.ops.object.modifier_apply(modifier=r.name)
    o.name=name;o.parent=parent
    for f in o.data.polygons:f.use_smooth=True
    return o

def merge(root):
    # One primitive for each material under an articulated parent.
    for pivot in [root]+[o for o in root.children_recursive if o.type=='EMPTY']:
        groups={}
        for o in list(pivot.children):
            if o.type in ('MESH','CURVE') and len(o.data.materials)==1:groups.setdefault(o.data.materials[0].name,[]).append(o)
        for name,parts in groups.items():
            if len(parts)>1 or parts[0].type=='CURVE':join(parts,pivot.name+' '+name)

def eyes(head,x,y,z,size=.024):
    for side,label in ((-1,'L'),(1,'R')):
        pivot=empty('Eye'+label,head,(side*x,y,z));ell('Eye inset',(0,0,0),(size,size*.48,size*.88),eye,pivot)
        ell('Eye catchlight',(-size*.2,-size*.42,size*.25),(size*.17,size*.1,size*.17),glint,pivot,12,6)

def whiskers(head,y,z,width,length,count=3):
    for side in (-1,1):
        for i in range(count):
            h=z+(i-(count-1)/2)*.009
            tube('Muzzle whisker',[(side*width,y,h),(side*(width+length*.55),y-.02,h+.008),(side*(width+length),y+.005+i*.015,h+.018)],.0012,cream,head)

def rabbit():
    root=empty('BrushRabbit');body=empty('BodyPose',root)
    parts=[loft('Torso',[(-.21,.22,.10,.16),(-.11,.23,.155,.19),(.10,.22,.185,.20),(.26,.21,.16,.16),(.32,.21,.015,.025)],fur,body)]
    for s in (-1,1):parts.append(ell('Haunch',(s*.115,.13,.15),(.105,.17,.13),fur,body))
    join(parts,'Continuous rabbit torso',.011)
    head=empty('Head',body,(0,-.225,.315))
    join([ell('Head crown',(0,.016,.01),(.125,.122,.127),fur,head),ell('Long cheek',(0,-.06,-.025),(.102,.10,.08),fur,head)],'Shaped rabbit head',.007)
    for s in (-1,1):ell('Split muzzle',(s*.027,-.139,-.03),(.043,.029,.031),cream,head)
    ell('Rabbit nose',(0,-.17,-.007),(.019,.012,.014),pink,head)
    tube('Quiet lip',[(0,-.17,-.022),(0,-.168,-.036),(-.022,-.157,-.046)],.002,ink,head)
    tube('Quiet lip',[(0,-.168,-.036),(.022,-.157,-.046)],.002,ink,head)
    eyes(head,.099,-.088,.025,.021);whiskers(head,-.149,-.026,.033,.061)
    for s,label in ((-1,'L'),(1,'R')):
        ear=empty('Ear'+label,head,(s*.059,.014,.09));ear.rotation_euler.y=s*.12
        loft('Short rounded ear',[(-.021,.035,.028,.032),(-.01,.10,.03,.055),(.008,.157,.018,.038),(.017,.187,.001,.004)],fur,ear,4,16)
        ell('Ear lining',(0,-.028,.10),(.016,.007,.064),pink,ear,16,10)
        leg=empty('Foreleg'+label,root,(s*.092,-.145,.165));ell('Foreleg',(0,.012,-.058),(.033,.043,.096),fur,leg)
        paw=empty('FrontPaw'+label,root,(s*.093,-.194,.032));ell('Front paw',(0,0,0),(.037,.072,.032),fur,paw)
        leg=empty('Hindleg'+label,root,(s*.145,.115,.13));ell('Folded hock',(0,-.004,-.061),(.043,.075,.075),fur,leg)
        paw=empty('HindPaw'+label,root,(s*.142,.079,.039));ell('Long hind paw',(0,0,0),(.057,.115,.039),fur,paw)
    ell('Small brush tail',(0,.316,.193),(.058,.055,.061),cream,body);merge(root);return root

def flipper(parent,name,p,length,width,angle,m,drop=0):
    pivot=empty(name,parent,p);pivot.rotation_euler.z=angle
    loft('Tapered paddle',[(0,0,width*.46,.024),(length*.2,-drop*.5-.008,width*.75,.027),(length*.7,-drop-.008,width,.021),(length,-drop-.007,width*.7,.012),(length*1.06,-drop-.007,.006,.005)],m,pivot,3,16)

def colors(o,seal):
    color=o.data.color_attributes.new(name='Animal coat',type='BYTE_COLOR',domain='CORNER')
    for loop in o.data.loops:
        p=o.matrix_world@o.data.vertices[loop.vertex_index].co;grain=math.sin(p.x*41+p.y*13)*math.sin(p.y*27-p.z*18)*.022
        if seal:
            spots=math.sin(p.x*24+p.y*9)+math.sin(p.y*19-p.z*17)+math.sin(p.x*19-p.y*17+p.z*13);mark=max(0,min(1,(spots-.9)*3.5))*.20;light=.03*max(0,p.z/.5)
            c=(.29+grain+light-mark,.33+grain+light-mark,.32+grain+light-mark)
        else:
            light=max(0,min(1,p.z/.8))*.045;c=(.17+grain+light,.11+grain+light*.7,.062+grain*.7+light*.35)
        color.data[loop.index].color=(*c,1)
    m=o.data.materials[0];m.diffuse_color=(1,1,1,1);a=m.node_tree.nodes.get('Coat color') or m.node_tree.nodes.new('ShaderNodeVertexColor');a.name='Coat color';a.layer_name='Animal coat'
    m.node_tree.links.new(a.outputs['Color'],m.node_tree.nodes['Principled BSDF'].inputs['Base Color'])

def pinniped(lion):
    root=empty('CaliforniaSeaLion' if lion else 'HarborSeal');coat=brown if lion else sealmat;body=empty('BodyPose',root)
    profiles=[(-.58,.61,.115,.18),(-.42,.46,.24,.33),(-.16,.29,.32,.265),(.18,.255,.34,.24),(.52,.17,.23,.15),(.77,.075,.08,.06),(.83,.059,.018,.023)] if lion else [(-.53,.22,.11,.135),(-.35,.24,.26,.21),(-.05,.24,.33,.23),(.28,.215,.31,.21),(.60,.13,.19,.115),(.78,.055,.052,.042),(.84,.043,.014,.018)]
    loft('Continuous raised neck and trunk' if lion else 'Continuous tapered trunk',profiles,coat,body,5 if lion else 7,28 if lion else 40)
    head=empty('Head',body,(0,-.60,.76 if lion else .285))
    loft('Tapered pinniped head',[(-.25,-.017,.035,.039),(-.18,.016,.095,.078),(-.09,.075,.145,.143),(.045,.087,.157,.152),(.125,.058,.045,.066)],coat,head,4,24)
    for s in (-1,1):ell('Muzzle lobe',(s*.05,-.192,-.005),(.061,.061,.045),cream if not lion else coat,head)
    ell('Soft triangular nose',(0,-.253,.019),(.036,.024,.024),ink,head)
    tube('Mouth line',[(-.057,-.229,-.035),(0,-.238,-.045),(.057,-.229,-.035)],.0025,ink,head)
    eyes(head,.123,-.104,.108,.021 if lion else .025);whiskers(head,-.216,-.013,.061,.10 if lion else .11,4)
    if lion:
        for s in (-1,1):
            ear=ell('Visible small ear flap',(s*.153,.036,.111),(.023,.028,.047),coat,head);ear.rotation_euler.y=s*.2
    for s,label in ((-1,'L'),(1,'R')):
        flipper(root,'FrontFlipper'+label,(s*.17,-.24,.155 if lion else .13),.52 if lion else .25,.095 if lion else .068,-s*.88,coat,.12 if lion else .097)
        flipper(root,'RearFlipper'+label,(s*.05,.76,.035),.27 if lion else .24,.094,s*(-.3 if lion else -.45),coat)
    merge(root);bpy.context.view_layer.update()
    for o in root.children_recursive:
        if o.type=='MESH' and o.data.materials[0]==coat:colors(o,not lion)
    return root

masters=[rabbit(),pinniped(True),pinniped(False)]
acting_names={'Head','BodyPose','EarL','EarR','EyeL','EyeR','ForelegL','ForelegR','HindlegL','HindlegR','FrontPawL','FrontPawR','HindPawL','HindPawR','FrontFlipperL','FrontFlipperR','RearFlipperL','RearFlipperR'}
named_pivots={o:o.name for o in bpy.data.objects if o.type=='EMPTY' and o.name.split('.')[0] in acting_names}
for root in masters:
    # Blender IDs are unique across the editable three-master source. Each GLB
    # is independent, so export canonical pivots instead of Head.001/Head.002,
    # which Three sanitizes and previously left marine heads unanimated.
    for o,name in named_pivots.items():o.name='Source retained '+name
    for o in root.children_recursive:
        if o in named_pivots:o.name=named_pivots[o].split('.')[0]
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for o in root.children_recursive:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(root.name+'.glb')),export_format='GLB',use_selection=True,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7)
    print('WILDLIFE',root.name,'meshes',sum(o.type=='MESH' for o in root.children_recursive),'triangles',sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH'))
    for o,name in named_pivots.items():o.name='Restore source '+name
    for o,name in named_pivots.items():o.name=name
for i,root in enumerate(masters):root.location.x=i*2
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'wildlife.blend'))
