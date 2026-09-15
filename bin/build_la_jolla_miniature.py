"""Compose the authored landmark models into a compact coastal relief in Blender."""
import bpy, math, json
import random
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/models/la-jolla'
SOURCE=ROOT/'artwork/la-jolla'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'la-jolla.blend'))
scene=bpy.context.scene
for obj in scene.objects: obj.hide_render=False

def discard(obj):
    for child in list(obj.children): discard(child)
    bpy.data.objects.remove(obj, do_unlink=True)
for name in ('Coast','Village','Courts','Palms','EveningBonfire','ParkedBoards','Lifeguard'):
    if name in bpy.data.objects: discard(bpy.data.objects[name])
def move(name, center, target, scale=1):
    o=bpy.data.objects.get(name)
    if o:
        o.matrix_world=Matrix.Translation(Vector(target)) @ Matrix.Scale(scale,4) @ Matrix.Translation(-Vector(center)) @ o.matrix_world
move('DIB',(7.5,2.7,.93),(4.8,7.3,.93),.65)
move('Salk',(-7,6.4,.93),(-4.3,2.8,.93),1.04)
move('Geisel',(-1.3,6.2,.93),(-1.5,7.5,.93),1.0)
move('ScrippsPier',(12.5,-3.8,0),(-7.4,-4.25,0))
for obj in list(bpy.data.objects['Surf'].children):
    if obj.type == 'EMPTY' and obj.name.startswith('Surfer'):
        obj.location.x *= .52
        obj.location.y -= 1.0
    else:
        discard(obj)

def mesh(name,verts,faces,material):
    m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
    o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);m.materials.append(material)
    bevel=o.modifiers.new('Soft mineral edge','BEVEL');bevel.width=.09;bevel.segments=3
    return o
stone=bpy.data.materials['Sandstone stratum 1']; sand=bpy.data.materials['Fine dry sand']
def terrain_height(x,y):
    plateau=2.2*math.exp(-((x-7.2)/2.4)**6-((y-.65)/2.1)**6)
    shore=max(0,min(1,(y+2.2)/1.2))
    return .16+.77*shore+plateau
n=180
verts=[]
for layer in range(4):
    for i in range(n):
        a=i*math.tau/n
        x=10.4*math.cos(a); y=3.0+7.6*math.sin(a)
        cliff=terrain_height(x,y)-.92
        if layer==0: z=-1.0
        elif layer==1: z=-.55; x*=1.008;y=3+(y-3)*1.008
        elif layer==2: z=.35; x*=.992;y=3+(y-3)*.992
        else: z=.92+cliff
        verts.append((x+.12*math.sin(a*7),y+.15*math.sin(a*9),z))
faces=[]
for j in range(3):
    for i in range(n):
        k=j*n+i; nxt=j*n+(i+1)%n;faces.append((k,nxt,nxt+n,k+n))
faces.append(tuple(reversed(range(n))))
# Radial top rings avoid a single nonplanar n-gon cutting through the cove.
for j in range(1,31):
    f=1-j/31
    for i in range(n):
        x,y,_=verts[3*n+i];xx=x*f;yy=3+(y-3)*f
        verts.append((xx,yy,terrain_height(xx,yy)))
    prev=(j+2)*n;current=(j+3)*n
    for i in range(n):faces.append((prev+i,prev+(i+1)%n,current+(i+1)%n,current+i))
faces.append(tuple(range(len(verts)-n,len(verts))))
land=mesh('Miniature sandstone land',verts,faces,stone)
for name in ('Sandstone stratum 2','Sandstone stratum 3','Fine dry sand','Coastal groundcover'):
    land.data.materials.append(bpy.data.materials[name])
for p in land.data.polygons:
    p.use_smooth=True
    if p.center.z<.2:p.material_index=3
    elif p.center.z<.7:p.material_index=1
    elif p.center.z>.88 and p.normal.z>.65:p.material_index=4
# Continuous mineral/groundcover color avoids jagged material boundaries on
# the radial topology. Geological form stays in the mesh, not a noisy texture.
mat=bpy.data.materials.new('Miniature continuous sandstone');mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.84
colors=mat.node_tree.nodes.new('ShaderNodeVertexColor');colors.layer_name='CoastalStrata'
mat.node_tree.links.new(colors.outputs['Color'],bsdf.inputs['Base Color'])
land.data.materials.clear();land.data.materials.append(mat)
attribute=land.data.color_attributes.new(name='CoastalStrata',type='FLOAT_COLOR',domain='CORNER')
for p in land.data.polygons:
    p.material_index=0
    for li in p.loop_indices:
        v=land.data.vertices[land.data.loops[li].vertex_index];x,y,z=v.co
        softness=max(0,min(1,(p.normal.z-.65)/.30))*max(0,min(1,(z-.68)/.22))
        tone=.025*math.sin(z*7+x*.05)
        rock=(.70+tone,.59+tone,.42+tone);green=(.40,.48,.26)
        attribute.data[li].color=tuple(a*(1-softness)+b*softness for a,b in zip(rock,green))+(1,)
# Broad sand and a translucent water slab form the foreground of the relief.
def shoreline(x):return -3.5+.017*x*x+.42*math.sin(x*.58)
def ribbon(name,front,back,z,mat,rows=16):
    vv=[];ff=[];nx=140
    for i in range(nx+1):
        x=-10.1+20.2*i/nx
        for j in range(rows+1):
            t=j/rows;y=front(x)*(1-t)+back(x)*t
            vv.append((x,y,z(x,y,t)))
            if i<nx and j<rows:
                a=i*(rows+1)+j;ff.append((a,a+rows+1,a+rows+2,a+1))
    return mesh(name,vv,ff,mat)
beach=ribbon('Cove crescent',shoreline,lambda x:shoreline(x)+1.85,lambda x,y,t:.06+.13*t,sand)
water=ribbon('PacificSurface',lambda x:-8.4+.018*x*x,shoreline,lambda x,y,t:.035,bpy.data.materials['Pacific water'])
# The water and sand share a curved edge; the mineral underside follows it.
for name,func,mat in [('Pacific relief edge',lambda x:-8.4+.018*x*x,bpy.data.materials['Pacific water']),('Sand cut edge',shoreline,sand)]:
    vv=[];ff=[]
    for i in range(141):
        x=-10.1+20.2*i/140;y=func(x)
        vv.extend([(x,y,-.96),(x,y,.032)])
        if i<140:ff.append((2*i,2*i+2,2*i+3,2*i+1))
    mesh(name,vv,ff,mat)

def line(name,points,width,mat):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=width;c.bevel_resolution=3
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,v in zip(s.points,points):p.co=(*v,1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);c.materials.append(mat)
    return o
# A walkable network gives the open space scale and connects the landmarks.
for controls in [[(-7.4,-.35),(-7.4,.55),(-4.3,.55),(-1,.5),(2,1.3),(4,2.1)],
                 [(-7.4,.55),(-7.4,5),(-4.2,5.3),(-1.5,5),(2.6,5.3),(4.8,5.7)],
                 [(2,1.3),(2,-.5),(4.6,-1.3),(5.9,-1.1)]]:
    points=[]
    for a,b in zip(controls,controls[1:]):
        for j in range(12):
            t=j/12;x=a[0]*(1-t)+b[0]*t;y=a[1]*(1-t)+b[1]*t
            points.append((x,y,terrain_height(x,y)+.018))
    line('Limestone pedestrian path',points,.15,bpy.data.materials['Limestone trim'])
for k in range(3):
    line('Curving broken surf',[(x,shoreline(x)-.26-k*.52,.07) for x in [-9.2+j*.10 for j in range(187)]],.018+k*.002,bpy.data.materials['Sea foam'])
# New planting follows the compressed terrain surface.
rng=random.Random(41)
for i in range(90):
    x=rng.uniform(-9.2,9.2);y=rng.uniform(-1.5,9.8)
    if (x/9.8)**2+((y-3)/7.0)**2>.93:continue
    if -7<x<-1.3 and .3<y<5.2:continue
    if 2<x<8 and 5.3<y<9.8 or abs(x+1.5)<2.7 and y>4.7:continue
    z=terrain_height(x,y);size=rng.uniform(.12,.32)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,z+size*.65))
    o=bpy.context.object;o.name='Native coastal planting';o.scale=(size*1.2,size,size*.8);o.data.materials.append(bpy.data.materials['Palm frond'])
    for f in o.data.polygons:f.use_smooth=True
# Wave-worn rocks cluster below the headland, leaving open sand for beach life.
for i in range(28):
    x=rng.uniform(5.0,9.5) if i<19 else rng.uniform(-9.5,-8)
    y=shoreline(x)+rng.uniform(-.25,1.2);r=rng.uniform(.13,.45)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,.10+r*.25))
    o=bpy.context.object;o.name='Wave polished sandstone';o.scale=(r,r*.7,r*.48);o.data.materials.append(stone)
    for p in o.data.polygons:p.use_smooth=True
# Torrey pines and a sheltered rocky Cove give this relief a different story
# from the footer's palms, villas and active beach promenade.
def orb(name,point,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=point)
    o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o
for x,y,h in [(7.4,.9,1.7),(8.3,2.1,1.4),(6.0,2.1,1.2),(-8.4,6.1,1.7)]:
    z=terrain_height(x,y)
    line('Wind-shaped Torrey pine',[(x,y,z),(x+.13,y,z+h*.5),(x-.12,y+.12,z+h)],.085,bpy.data.materials['Warm oak'])
    for j in range(5):
        a=j*math.tau/5;xx=x+math.cos(a)*.40;yy=y+math.sin(a)*.33
        orb('Torrey pine canopy',(xx,yy,z+h-.10+math.sin(a)*.1),(.57,.46,.22),bpy.data.materials['Palm frond'])
# Native animals rest on an explicit low rocky shelf rather than open water.
sealmat=bpy.data.materials['Charcoal anodized fins']
for i,(x,y) in enumerate([(6.1,-1.85),(7,-1.6),(7.7,-1.4)]):
    shelf=orb('Cove haul-out rock',(x,y,.14),(.64,.50,.18),stone)
    orb('Resting California sea lion',(x,y,.36),(.34,.15,.15),sealmat)
    orb('Sea lion raised head',(x-.23,y,.54),(.12,.12,.19),sealmat)
    orb('Sea lion muzzle',(x-.30,y-.045,.62),(.105,.08,.065),sealmat)
    for s in (-1,1):
        fin=orb('Sea lion flipper',(x+.23,y+s*.14,.31),(.16,.065,.025),sealmat);fin.rotation_euler.z=s*.3
# A low, supported observation terrace overlooks the sheltered cove.
for x,y in [(4.3,.1),(4.3,.8)]:
    line('Cove overlook bench',[(x,y,1.14),(x+.8,y,1.14)],.06,bpy.data.materials['Warm oak'])
    for xx in (x+.1,x+.7):line('Bench foot',[(xx,y,.94),(xx,y,1.14)],.035,stone)
# Join static top-level details by material; moving groups and window names stay.
def detail_box(name, pos, dims, material):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=bpy.context.object;o.name=name;o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    return o
# Salk's laboratory bands and recessed teak openings frame its ocean court.
for side in (-1,1):
    xx=-4.3+side*1.78*1.04
    for fl in range(2):
        zz=.93+.51+fl*.66
        detail_box('Salk laboratory glass band',(xx+side*.604,2.8,zz),(.035,3.90,.40),bpy.data.materials['Pacific blue glazing'])
        detail_box('Salk front glass band',(xx,.703,zz),(.99,.03,.40),bpy.data.materials['Pacific blue glazing'])
        for j in range(11):
            detail_box('Salk concrete facade rhythm',(xx+side*.634,.92+j*.374,zz),(.042,.027,.42),bpy.data.materials['Limestone trim'])
    for j in range(5):
        yy=2.8+(-1.6+j*.8)*1.04
        detail_box('Salk recessed study glass',(-4.3+side*.994,yy,1.99),(.025,.25,.44),bpy.data.materials['Village glazing'])
buckets={}
for o in list(scene.objects):
    if o.type=='CURVE':
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
    if o.type=='MESH' and o.parent is None and o.name!='PacificSurface':
        buckets.setdefault(tuple(m.name for m in o.data.materials),[]).append(o)
for items in buckets.values():
    if len(items)<2:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in items:o.select_set(True)
    bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join()
bpy.context.preferences.filepaths.save_version=0
scene.camera.location=(18,-30,30);scene.camera.rotation_euler=(Vector((0,1,1.0))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.ortho_scale=30
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.cycles.samples=32
scene.render.film_transparent=True
preferences=bpy.context.preferences.addons['cycles'].preferences;preferences.compute_device_type='CUDA';preferences.get_devices()
for device in preferences.devices: device.use=device.type=='CUDA'
scene.cycles.device='GPU'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'miniature.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type not in ('LIGHT','CAMERA'):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'miniature.glb'),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7)
scene.render.filepath=str(SOURCE/'miniature.png');bpy.ops.render.render(write_still=True)
manifest=json.loads((OUT/'manifest.json').read_text())
old=manifest['office'];office=[4.8+(old[0]-7.5)*.65,.93+(old[1]-.93)*.65,-(7.3+(-old[2]-2.7)*.65)]
manifest['miniature']={'model':'miniature.glb','camera':[18,30,30],'target':[0,1,-1],'width':30,'office':office,'landmarks':['DIB','Geisel','Salk','ScrippsPier','Cove','TorreyPines']}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
