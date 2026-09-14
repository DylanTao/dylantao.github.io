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

def discard(obj):
    for child in list(obj.children): discard(child)
    bpy.data.objects.remove(obj, do_unlink=True)
for name in ('Coast',):
    discard(bpy.data.objects[name])
def move(name, center, target, scale=1):
    o=bpy.data.objects.get(name)
    if o:
        o.matrix_world=Matrix.Translation(Vector(target)) @ Matrix.Scale(scale,4) @ Matrix.Translation(-Vector(center)) @ o.matrix_world
move('DIB',(7.5,2.7,.93),(4.2,4.2,.93),.82)
move('Salk',(-7,6.4,.93),(-3.7,3.1,.93),.82)
move('Geisel',(-1.3,6.2,.93),(-1.3,7.3,.93),.93)
move('ScrippsPier',(12.5,-3.8,0),(6.5,-3.8,0))
move('CliffVilla',(-10.4,2.65,3.43),(-7.0,.45,3.43),.85)
for name,center,target in [
    ('CasitaApricot',(-5.1,2.7,.93),(-7.1,4.3,.93)),
    ('CasitaCream',(-2.7,2.9,.93),(-7.1,6.5,.93)),
    ('CasitaRose',(-.3,2.8,.93),(-5.5,7.8,.93)),
    ('CasitaEast',(16,2.4,.93),(7.4,1.2,.93)),
    ('Lifeguard',(18.5,-.1,.5),(3.8,-2.5,.5))]: move(name,center,target,.8)
move('Tennis',(-17,.4,.94),(6.4,.15,.94),.78)
move('BeachVolleyball',(0,-1.35,.18),(-1.4,-2.4,.18),.8)
for obj in list(bpy.data.objects['Surf'].children):
    if obj.type == 'EMPTY' and obj.name.startswith('Surfer'):
        obj.location.x *= .52
        obj.location.y -= 1.0
    else:
        discard(obj)
# Palms retain their individually authored curved trunks and folded leaves.
for obj in list(bpy.data.objects):
    if obj.type=='EMPTY' and obj.name.startswith('Palm') and obj.name!='Palms':
        bounds=[o.matrix_world@Vector(c) for o in obj.children_recursive if o.type=='MESH' for c in o.bound_box]
        if not bounds: continue
        cx=sum(v.x for v in bounds)/len(bounds); cy=sum(v.y for v in bounds)/len(bounds)
        move(obj.name,(cx,cy,0),(max(-8.5,min(8.5,cx*.55)),cy,0),.85)

def mesh(name,verts,faces,material):
    m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
    o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);m.materials.append(material)
    bevel=o.modifiers.new('Soft mineral edge','BEVEL');bevel.width=.09;bevel.segments=3
    return o
stone=bpy.data.materials['Sandstone stratum 1']; sand=bpy.data.materials['Fine dry sand']
def terrain_height(x,y):
    plateau=2.5*math.exp(-((x+7)/2.8)**6-((y-.45)/2.1)**6)
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
# The interior terrace is level and has a sculpted raised west headland.
for x,y,z,sx,sy in [(-7,.45,3.4,1.5,1.05)]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x,y,(z-.2)/2))
    o=bpy.context.object;o.name='Supported coastal terrace';o.dimensions=(sx*2,sy*2,z+.2)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(stone)
    b=o.modifiers.new('Eroded terrace edge','BEVEL');b.width=.55;b.segments=5
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
for controls in [[(-8,3),(-6.2,2.2),(-4,1),(-1,.5),(2,1.3),(4.2,2.1),(7,2.0)],
                 [(-6.2,2.2),(-5.7,4.8),(-4.4,6.8),(-1,6.8),(2.6,6.7),(4.2,5.8)],
                 [(2,1.3),(2,-.5),(2.8,-1.3),(6.5,-1.1)]]:
    points=[]
    for a,b in zip(controls,controls[1:]):
        for j in range(12):
            t=j/12;x=a[0]*(1-t)+b[0]*t;y=a[1]*(1-t)+b[1]*t
            points.append((x,y,terrain_height(x,y)+.018))
    line('Limestone pedestrian path',points,.15,bpy.data.materials['Limestone trim'])
for k in range(3):
    line('Curving broken surf',[(x,shoreline(x)-.26-k*.52,.07) for x in [-9.2+j*.10 for j in range(187)]],.018+k*.002,bpy.data.materials['Sea foam'])
# Remove scenery outside the compressed land; new planting follows its surface.
for ownername in ('Palms','Courts'):
    owner=bpy.data.objects.get(ownername)
    if owner:
        for o in list(owner.children):
            if o.type=='MESH':discard(o)
rng=random.Random(41)
for i in range(90):
    x=rng.uniform(-9.2,9.2);y=rng.uniform(-1.5,9.8)
    if (x/9.8)**2+((y-3)/7.0)**2>.93:continue
    if 4.2<x<8.6 and -1.2<y<1.6:continue
    if ((x+3.7)/2.6)**2+((y-3.1)/2.5)**2<1 or ((x-4.2)/3.5)**2+((y-4.2)/2.2)**2<1 or abs(x+1.3)<2.5 and y>5:continue
    if -9<x<-5.4 and -.8<y<2:continue
    z=terrain_height(x,y);size=rng.uniform(.12,.32)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,z+size*.65))
    o=bpy.context.object;o.name='Native coastal planting';o.scale=(size*1.2,size,size*.8);o.data.materials.append(bpy.data.materials['Palm frond'])
    for f in o.data.polygons:f.use_smooth=True
# Wave-worn rocks cluster below the villa, leaving open sand for beach life.
for i in range(28):
    x=rng.uniform(-8.6,-4.5) if i<19 else rng.uniform(7.5,9.5)
    y=shoreline(x)+rng.uniform(-.25,1.2);r=rng.uniform(.13,.45)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,.10+r*.25))
    o=bpy.context.object;o.name='Wave polished sandstone';o.scale=(r,r*.7,r*.48);o.data.materials.append(stone)
    for p in o.data.polygons:p.use_smooth=True
bpy.context.preferences.filepaths.save_version=0
scene.camera.location=(22,-30,27);scene.camera.rotation_euler=(Vector((0,1,1.0))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
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
manifest=json.loads((OUT/'manifest.json').read_text());manifest['miniature']={'model':'miniature.glb','camera':[22,27,30],'target':[0,1,-1],'width':30,'office':[2.579,2.857,-2.893]}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
