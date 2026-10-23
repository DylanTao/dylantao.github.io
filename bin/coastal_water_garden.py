"""Original clifftop recirculating creek and koi pond, independent of the dwelling.

Run: blender -b --python-exit-code 1 --python bin/coastal_water_garden.py
The full hinterland builder calls apply() before its camera-grid/export stage too.
Blender +X north, +Y west, +Z up. No third-party models, textures, or images.
"""
import json
import math
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
CENTRE = (-23.0, -52.0)
RADIUS = 3.2
PATH = [(-16, -76), (-15, -72), (-17, -68), (-18, -64), (-20, -60), (-22, -57), (-22.5, -54.7)]


def material(name, colour, roughness=.8, metallic=0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*colour, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*colour, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return m


def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.materials.append(mat)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    for p in data.polygons:
        p.use_smooth = True
    return obj


def nearest_segment(x, y):
    best = (1e9, 0, 0)
    for k, (a, b) in enumerate(zip(PATH, PATH[1:])):
        dx, dy = b[0]-a[0], b[1]-a[1]
        t = min(1, max(0, ((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)))
        d = math.hypot(x-a[0]-dx*t, y-a[1]-dy*t)
        if d < best[0]:
            best = (d, k, t)
    return best


def apply():
    for obj in list(bpy.data.objects):
        if obj.name.startswith("hinterland_garden_"):
            bpy.data.objects.remove(obj, do_unlink=True)
    grounds = [o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith("hinterland_ground")]
    vertices, faces = [], []
    for obj in grounds:
        offset = len(vertices)
        original = obj.data.attributes.get("garden_original_z")
        vertices += [obj.matrix_world @ Vector((v.co.x,v.co.y,original.data[v.index].value if original else v.co.z)) for v in obj.data.vertices]
        faces += [tuple(offset+i for i in p.vertices) for p in obj.data.polygons]
    tree = BVHTree.FromPolygons(vertices, faces)

    def height(x, y):
        hit = tree.ray_cast(Vector((x, y, 80)), Vector((0, 0, -1)), 160)[0]
        if hit is None:
            raise RuntimeError(f"water garden has no terrain at {(x,y)}")
        return hit.z

    level = height(*CENTRE)-.18
    # The recirculating head starts above the pond and each reach falls monotonically.
    levels = [level+.015+.055*(len(PATH)-1-k) for k in range(len(PATH))]
    changed = 0
    for obj in grounds:
        if not any(-40<v.co.x<-8 and -80<v.co.y<-43 for v in obj.data.vertices):
            continue
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        # A 68 cm watercourse cannot be cut into the former multi-metre mesh by moving a handful
        # of vertices. Resolve its bed with a local sub-35 cm tessellation, without touching seams.
        for _ in range(6):
            edges = [e for e in bm.edges if e.calc_length()>.35 and all(-40<v.co.x<-8 and -80<v.co.y<-43 for v in e.verts)
                     and (nearest_segment(*e.verts[0].co.xy)[0]<1.7 or math.hypot(e.verts[0].co.x-CENTRE[0],e.verts[0].co.y-CENTRE[1])<4.2)]
            if not edges:
                break
            bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        original = obj.data.attributes.get("garden_original_z")
        if original is None:
            original = obj.data.attributes.new("garden_original_z", "FLOAT", "POINT")
            for v, datum in zip(obj.data.vertices, original.data):
                datum.value = v.co.z
        for v, datum in zip(obj.data.vertices, original.data):
            x, y = v.co.x, v.co.y
            original_z = datum.value
            r = math.hypot(x-CENTRE[0], (y-CENTRE[1])/1.12)
            d, k, t = nearest_segment(x, y)
            target = original_z
            if r < RADIUS+.8:
                bottom = level-.65 + .55*(r/RADIUS)**4
                w = min(1, max(0, (RADIUS+.8-r)/.7))
                target = min(target, original_z*(1-w)+bottom*w)
            if d < .85:
                bed = levels[k]*(1-t)+levels[k+1]*t-.15
                w = min(1, (.85-d)/.35)
                target = min(target, original_z*(1-w)+bed*w)
            if abs(v.co.z-target)>1e-6:
                changed += 1
            v.co.z = target
        obj.data.update()
    # The original tile-batched scrub predates the garden. Remove only leaf/trunk triangles whose
    # centres stand in its basin or channel; retaining those shrubs would put plants under water.
    removed_plants=0
    for obj in list(bpy.data.objects):
        if obj.type!="MESH" or not obj.name.startswith("hinterland_") or not any(word in obj.name for word in ("plant", "vegetation", "flora")):
            continue
        bm=bmesh.new();bm.from_mesh(obj.data)
        remove=[]
        for face in bm.faces:
            c=obj.matrix_world@face.calc_center_median()
            if math.hypot(c.x-CENTRE[0],(c.y-CENTRE[1])/1.12)<RADIUS+1.8 or nearest_segment(c.x,c.y)[0]<1.7:
                remove.append(face)
        removed_plants+=len(remove)
        if remove:bmesh.ops.delete(bm,geom=remove,context="FACES")
        bm.to_mesh(obj.data);bm.free()
    stone = material("garden smooth river sandstone", (.26,.23,.18))
    water = material("garden clear creek and koi water", (.045,.16,.13), .12)
    shader = water.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Transmission Weight"].default_value=.28
    shader.inputs["IOR"].default_value=1.333
    objects=[]
    n=96
    ring=[(CENTRE[0]+RADIUS*math.cos(k*math.tau/n),CENTRE[1]+RADIUS*1.12*math.sin(k*math.tau/n),level) for k in range(n)]
    pond=mesh("hinterland_garden_koi_water",[(CENTRE[0],CENTRE[1],level)]+ring,[(0,1+k,1+(k+1)%n) for k in range(n)],water)
    pond["gardenRadius"]=RADIUS
    pond["surfaceY"]=level
    objects.append(pond)
    # One connected ribbon; the last reach enters the pond below its bank.
    ribbon=[]
    for k, ((x,y),z) in enumerate(zip(PATH,levels)):
        a=PATH[max(k-1,0)];b=PATH[min(k+1,len(PATH)-1)]
        dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
        for sign in (-1,1):ribbon.append((x-sign*dy/length*.34,y+sign*dx/length*.34,z))
    creek=mesh("hinterland_garden_creek_water",ribbon,[(k*2+1,k*2,k*2+2,k*2+3) for k in range(len(PATH)-1)],water)
    objects.append(creek)
    head=PATH[0]
    spring=mesh("hinterland_garden_spring_water",[(head[0],head[1],levels[0])]+[(head[0]+.48*math.cos(k*math.tau/32),head[1]+.48*math.sin(k*math.tau/32),levels[0]) for k in range(32)],[(0,1+k,1+(k+1)%32) for k in range(32)],water)
    objects.append(spring)
    for k in range(38):
        theta=k*math.tau/38
        x=CENTRE[0]+(RADIUS+.22)*math.cos(theta);y=CENTRE[1]+(RADIUS*1.12+.22)*math.sin(theta)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,level-.04))
        obj=bpy.context.object;obj.name=f"hinterland_garden_bank_{k:02}"
        obj.scale=(.33+.07*math.sin(k*1.7),.27,.22+.08*math.cos(k))
        obj.data.materials.append(stone);objects.append(obj)
    # Creek banks show the designed channel at the coarse terrain's silhouette.
    for k in range(len(PATH)-1):
        a,b=PATH[k],PATH[k+1];dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
        for sign in (-1,1):
            for j in range(max(1,int(length/.7))):
                t=(j+.5)/max(1,int(length/.7));x=a[0]+dx*t-sign*dy/length*.49;y=a[1]+dy*t+sign*dx/length*.49
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,levels[k]*(1-t)+levels[k+1]*t-.03))
                obj=bpy.context.object;obj.name="hinterland_garden_creek_stone";obj.scale=(.32+.07*math.sin(j*4.1+k),.27+.05*math.sin(j*2.4),.16+.05*math.cos(j));obj.rotation_euler.z=j*2.4+k;obj.data.materials.append(stone);objects.append(obj)
    # Group static banks into one original mesh, retaining two animated water nodes.
    bpy.ops.object.select_all(action="DESELECT")
    banks=[o for o in objects if o not in (pond,creek,spring)]
    for o in banks:o.select_set(True)
    bpy.context.view_layer.objects.active=banks[0];bpy.ops.object.join()
    banks[0].name="hinterland_garden_river_stones"
    support_vertices=[];support_faces=[]
    for obj in grounds:
        offset=len(support_vertices);support_vertices.extend(obj.matrix_world@v.co for v in obj.data.vertices)
        support_faces.extend(tuple(offset+i for i in p.vertices) for p in obj.data.polygons)
    support=BVHTree.FromPolygons(support_vertices,support_faces)
    depths=[]
    for k,(a,b) in enumerate(zip(PATH,PATH[1:])):
        for j in range(13):
            t=j/12;x=a[0]*(1-t)+b[0]*t;y=a[1]*(1-t)+b[1]*t
            hit=support.ray_cast(Vector((x,y,80)),Vector((0,0,-1)),160)[0]
            depths.append(levels[k]*(1-t)+levels[k+1]*t-hit.z)
    pond_depths=[]
    for k in range(64):
        theta=k*math.tau/64;r=RADIUS*.8
        hit=support.ray_cast(Vector((CENTRE[0]+r*math.cos(theta),CENTRE[1]+r*1.12*math.sin(theta),80)),Vector((0,0,-1)),160)[0]
        pond_depths.append(level-hit.z)
    if min(depths)<.01 or max(depths)>.8 or min(pond_depths)<.01:
        raise RuntimeError(f"garden water clips uncut terrain: creek {min(depths)}, pond {min(pond_depths)}")
    report={"centre":[CENTRE[0],level,-CENTRE[1]],"radius":RADIUS,"terrainVerticesChanged":changed,"removedPlantTriangles":removed_plants,"nativeSupport":{"creekSamples":len(depths),"minCreekDepth":min(depths),"maxCreekDepth":max(depths),"pondSamples":len(pond_depths),"minPondDepth":min(pond_depths),"maxPondDepth":max(pond_depths)},"creek":[[x,z,-y] for (x,y),z in zip(PATH,levels)],"route":"closed recirculating garden water; no claimed natural stream or fluid solver","source":"original Blender geometry; no third-party assets"}
    path=ROOT/"artwork/coastal-home/reviews/water-garden.json";path.write_text(json.dumps(report,indent=2)+"\n")
    return [pond,creek,spring,banks[0]],report


if __name__=="__main__":
    source=ROOT/"artwork/coastal-home/hinterland.blend"
    bpy.ops.wm.open_mainfile(filepath=str(source))
    objects,report=apply()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(ROOT/"assets/models/home/hinterland.glb"),export_format="GLB",use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_texcoords=False,export_normals=True,export_vertex_color="ACTIVE",export_all_vertex_colors=False,export_image_format="NONE",export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7,export_draco_position_quantization=16,export_draco_normal_quantization=10,export_draco_color_quantization=8)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
    print(json.dumps(report),flush=True)
