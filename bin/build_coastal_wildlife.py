"""Editable, rounded coastal animal masters with separately animated heads/limbs."""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'assets/models/home'; SOURCE=ROOT/'artwork/coastal-home'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,c):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.77
    return m
fur=mat('Warm gray fur',(.27,.245,.19)); cream=mat('Soft muzzle',(.62,.59,.49)); ink=mat('Dark nose',(.018,.024,.023)); eye=mat('Glossy eye',(.008,.013,.015));eye.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.23
pink=mat('Ear lining',(.43,.28,.23)); brown=mat('Sea lion coat',(.23,.16,.10)); sealmat=mat('Harbor seal coat',(.36,.39,.37))
def empty(name,parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;return o
def ell(name,p,s,m,parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=14,location=p);o=bpy.context.object;o.name=name;o.scale=s;o.parent=parent;o.data.materials.append(m)
    for f in o.data.polygons:f.use_smooth=True
    return o
def eyes(head,x,y,z):
    for s in (-1,1):
        ell('Eye',(s*x,y,z),(.025,.018,.028),eye,head)
        ell('Eye glint',(s*x-.006,y-.016,z+.009),(.007,.005,.008),cream,head)
def rabbit():
    root=empty('BrushRabbit');head=empty('Head',root);head.location=(0,-.21,.37)
    ell('Body',(0,.04,.23),(.21,.32,.24),fur,root);ell('Haunch',(0,.16,.22),(.235,.22,.23),fur,root)
    ell('Cheek',(0,0,0),(.16,.15,.155),fur,head);ell('Muzzle',(0,-.12,-.045),(.09,.072,.062),cream,head)
    ell('Nose',(0,-.184,-.016),(.023,.018,.018),pink,head);eyes(head,.11,-.105,.035)
    for s in (-1,1):
        ear=empty('Ear'+str(s),head);ear.location=(s*.075,.01,.115);ear.rotation_euler.y=s*.15
        ell('Ear',(0,0,.15),(.047,.048,.20),fur,ear);ell('Ear inside',(0,-.041,.15),(.025,.011,.15),pink,ear)
        for yy in (-.20,.17):ell('Foot'+str(s)+str(yy),(s*.15,yy,.045),(.085,.14,.045),fur,root)
    ell('Tail',(0,.34,.23),(.09,.08,.10),cream,root)
    return root
def pinniped(lion):
    root=empty('CaliforniaSeaLion' if lion else 'HarborSeal');coat=brown if lion else sealmat
    ell('Body',(0,.03,.22),(.31,.67,.25),coat,root)
    head=empty('Head',root);head.location=(0,-.45,.48 if lion else .28)
    if lion:ell('Neck',(0,-.38,.42),(.23,.26,.40),coat,root)
    ell('Head form',(0,0,.09),(.20,.21,.22 if lion else .17),coat,head)
    ell('Muzzle',(0,-.185,.015),(.135,.12,.083),cream if not lion else brown,head)
    ell('Nose',(0,-.292,.05),(.046,.026,.025),ink,head);eyes(head,.143,-.157,.13)
    for s in (-1,1):
        if lion:ell('Small ear',(s*.19,.015,.13),(.043,.022,.058),coat,head)
        fin=ell('Flipper'+str(s),(s*.30,-.25,.067),(.12,.39,.057) if lion else (.12,.22,.044),coat,root);fin.rotation_euler.z=s*.65
        ell('Hind flipper',(s*.11,.67,.052),(.15,.25,.05),coat,root)
    if not lion:
        for i in range(35):
            a=i*2.399; yy=-.2+(i%9)*.09;xx=math.cos(a)*.21;zz=.22+.235*math.sqrt(max(0,1-(xx/.31)**2-(yy/.67)**2))
            ell('Seal spot',(xx,yy,zz),(.026,.04,.008),fur,root)
    return root
masters=[rabbit(),pinniped(True),pinniped(False)]
for root in masters:
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for o in root.children_recursive:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(root.name+'.glb')),export_format='GLB',use_selection=True,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7)
for i,root in enumerate(masters): root.location.x=i*2
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'wildlife.blend'))
