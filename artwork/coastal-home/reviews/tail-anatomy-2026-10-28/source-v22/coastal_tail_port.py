"""Local garment subtraction for a measured tail port, leaving remote cloth exact."""
import bpy
import bmesh
from mathutils import Vector
from mathutils.geometry import barycentric_transform
from mathutils.bvhtree import BVHTree
from coastal_tail_corrective import canonical_material, remove_zero_keys
from refresh_coastal_character_finish import split_faces, select_only

PATCH_LO=Vector((-.142,.0143,-.4417))
PATCH_HI=Vector((.142,.2423,-.0507))


def planes():
    for axis in range(3):
        for value,sign in ((PATCH_LO[axis],-1),(PATCH_HI[axis],1)):
            origin=Vector();origin[axis]=value
            normal=Vector();normal[axis]=sign
            yield origin,normal


def near_plane(face, origin, normal):
    return all(abs((vertex.co-origin).dot(normal))<3e-6 for vertex in face.verts)


def replace_data(obj,bm):
    bm.to_mesh(obj.data);obj.data.update();bm.free()


def crop_inside(obj):
    bm=bmesh.new();bm.from_mesh(obj.data)
    for origin,normal in planes():
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=origin,plane_no=normal,clear_outer=True)
        boundary=[e for e in bm.edges if e.is_boundary and all(abs((v.co-origin).dot(normal))<3e-6 for v in e.verts)]
        if boundary:
            made=bmesh.ops.holes_fill(bm,edges=boundary,sides=0)['faces']
            for face in made:face.smooth=False
    if bm.faces:bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    replace_data(obj,bm)


def keep_outside(obj):
    bm=bmesh.new();bm.from_mesh(obj.data)
    touched=bm.faces.layers.int.new('tailPatchTouched')
    for face in bm.faces:
        face[touched]=int(all(min(v.co[k] for v in face.verts)<=PATCH_HI[k] and max(v.co[k] for v in face.verts)>=PATCH_LO[k] for k in range(3)))
    for origin,normal in planes():
        faces=[f for f in bm.faces if f[touched]]
        geom=set(faces)
        for face in faces:geom.update(face.verts);geom.update(face.edges)
        if geom:bmesh.ops.bisect_plane(bm,geom=list(geom),dist=1e-7,plane_co=origin,plane_no=normal)
    inside=[f for f in bm.faces if f[touched] and all(PATCH_LO[k]-1e-7<=f.calc_center_median()[k]<=PATCH_HI[k]+1e-7 for k in range(3))]
    bmesh.ops.delete(bm,geom=inside,context='FACES')
    replace_data(obj,bm)


def triangulate_with_normals(obj):
    me=obj.data;me.calc_loop_triangles()
    refs=[];vertices=[v.co.copy() for v in me.vertices]
    weights=[[(g.group,g.weight) for g in v.groups] for v in me.vertices]
    group_names=[g.name for g in obj.vertex_groups]
    for t in me.loop_triangles:
        refs.append(([vertices[i].copy() for i in t.vertices],[me.corner_normals[i].vector.copy() for i in t.loops],t.material_index,me.polygons[t.polygon_index].use_smooth,tuple(t.vertices)))
    fresh=bpy.data.meshes.new(me.name+' local triangulated surface')
    fresh.from_pydata(vertices,[],[r[4] for r in refs]);fresh.update()
    for material in me.materials:fresh.materials.append(material)
    obj.data=fresh
    obj.vertex_groups.clear()
    for name in group_names:obj.vertex_groups.new(name=name)
    for i,groups in enumerate(weights):
        for group,weight in groups:obj.vertex_groups[group].add([i],weight,'REPLACE')
    attribute=fresh.attributes.new('tailOriginalTriangle','INT','FACE')
    for i,ref in enumerate(refs):
        fresh.polygons[i].material_index=ref[2];fresh.polygons[i].use_smooth=ref[3];attribute.data[i].value=i+1
    fresh.normals_split_custom_set([n for ref in refs for n in ref[1]])
    return refs


def restore_remote_normals(obj,refs):
    me=obj.data;attribute=me.attributes.get('tailOriginalTriangle')
    normals=[n.vector.copy() for n in me.corner_normals]
    restored=0
    for face in me.polygons:
        value=attribute.data[face.index].value if attribute else 0
        # Only the unmodified outer fragment gets its original optical field.
        center=face.center
        if not value or value>len(refs) or all(PATCH_LO[k]-1e-6<=center[k]<=PATCH_HI[k]+1e-6 for k in range(3)):continue
        positions,prior,*_=refs[value-1]
        for loop in face.loop_indices:
            p=me.vertices[me.loops[loop].vertex_index].co
            normals[loop]=barycentric_transform(p,*positions,*prior).normalized()
            restored+=1
    me.normals_split_custom_set(normals)
    return restored


def cut_local_ports(arm,mesh,tail,clearance=.006):
    pose=arm.data.pose_position;arm.data.pose_position='REST'
    for track in arm.animation_data.nla_tracks:track.mute=True
    bpy.context.view_layer.update()
    # The closed cutter is limited to the existing first three tail rings.
    hull=bmesh.new()
    for key in (tail.data.shape_keys.key_blocks['Basis'],):
        for i in range(48):hull.verts.new(key.data[i].co)
    bmesh.ops.remove_doubles(hull,verts=list(hull.verts),dist=1e-7)
    bmesh.ops.convex_hull(hull,input=list(hull.verts),use_existing_faces=False)
    bmesh.ops.recalc_face_normals(hull,faces=list(hull.faces))
    data=bpy.data.meshes.new('local tail port cutter');hull.to_mesh(data);hull.free();data.update()
    normals=[v.normal.copy() for v in data.vertices]
    for vertex,normal in zip(data.vertices,normals):vertex.co+=normal*clearance
    assert all(all(PATCH_LO[k]+.004<v.co[k]<PATCH_HI[k]-.004 for k in range(3)) for v in data.vertices),'Cutter must stay strictly inside the declared local box'
    tool=bpy.data.objects.new('local tail port cutter',data);bpy.context.scene.collection.objects.link(tool);tool.matrix_world=tail.matrix_world.copy()
    cutter_tree=BVHTree.FromPolygons([v.co for v in data.vertices],[p.vertices for p in data.polygons])
    report=[];garments=[]
    for material in ('Sirui shirt','charcoal shorts'):
        obj=split_faces(mesh,lambda face:canonical_material(mesh.data.materials[face.material_index])==material)
        remove_zero_keys(obj);obj.name='SiruiTailPort-'+material;obj['finishCanonicalName']=obj.name
        material_index=next(i for i,m in enumerate(obj.data.materials) if canonical_material(m)==material)
        refs=triangulate_with_normals(obj);before=len(obj.data.vertices)
        select_only([obj],obj);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
        components=list(bpy.context.selected_objects);parts=[]
        for outer in components:
            inner=outer.copy();inner.data=outer.data.copy();bpy.context.scene.collection.objects.link(inner)
            crop_inside(inner)
            if not inner.data.polygons:
                bpy.data.objects.remove(inner,do_unlink=True);parts.append(outer);continue
            keep_outside(outer)
            select_only([inner],inner)
            modifier=inner.modifiers.new('bounded rear tail port','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=tool;modifier.use_self=True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            bm=bmesh.new();bm.from_mesh(inner.data)
            caps=[face for face in bm.faces if any(near_plane(face,o,n) for o,n in planes())]
            bmesh.ops.delete(bm,geom=caps,context='FACES');replace_data(inner,bm)
            select_only([outer,inner],outer);bpy.ops.object.join()
            bm=bmesh.new();bm.from_mesh(outer.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=7e-7);replace_data(outer,bm)
            parts.append(outer)
        select_only(parts,obj);bpy.ops.object.join()
        obj.name='SiruiTailPort-'+material
        restored=restore_remote_normals(obj,refs)
        for face in obj.data.polygons:face.material_index=material_index
        # Rebind only the actual rim and its small native collar blend.
        basis=tail.data.shape_keys.key_blocks['Basis'];bound=0
        attribute=obj.data.attributes.get('tailOriginalTriangle')
        rim={i for face in obj.data.polygons if attribute and attribute.data[face.index].value==0 for i in face.vertices}
        for vertex in obj.data.vertices:
            if not all(PATCH_LO[k]<=vertex.co[k]<=PATCH_HI[k] for k in range(3)):continue
            nearest=min(range(48),key=lambda i:(vertex.co-basis.data[i].co).length_squared)
            distance=cutter_tree.find_nearest(vertex.co)[3]
            amount=1. if vertex.index in rim else max(0,1-distance/.020)
            if amount<=0:continue
            prior={obj.vertex_groups[g.group].name:g.weight for g in vertex.groups};goal={tail.vertex_groups[g.group].name:g.weight for g in tail.data.vertices[nearest].groups}
            for binding in list(vertex.groups):obj.vertex_groups[binding.group].remove([vertex.index])
            for name in set(prior)|set(goal):
                weight=prior.get(name,0)*(1-amount)+goal.get(name,0)*amount
                if weight>1e-8:(obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)).add([vertex.index],weight,'REPLACE')
            bound+=1
        obj['tailPortTrial']=True;obj['portClearanceM']=clearance;obj['tailPortPatchBounds']=[list(PATCH_LO),list(PATCH_HI)]
        bm=bmesh.new();bm.from_mesh(obj.data)
        boundaries=sum(e.is_boundary for e in bm.edges);nonmanifold=sum(not e.is_manifold for e in bm.edges);bm.free()
        report.append({'material':material,'beforeVertices':before,'vertices':len(obj.data.vertices),'faces':len(obj.data.polygons),'boundaryEdges':boundaries,'nonmanifoldEdges':nonmanifold,'remoteCornerNormalsRestored':restored,'tailBoundRimVertices':bound,'cutSurfaceRimVertices':len(rim),'nativeLocalBox':[list(PATCH_LO),list(PATCH_HI)]})
        garments.append(obj)
    bpy.data.objects.remove(tool,do_unlink=True);bpy.data.meshes.remove(data);arm.data.pose_position=pose
    return garments,report
