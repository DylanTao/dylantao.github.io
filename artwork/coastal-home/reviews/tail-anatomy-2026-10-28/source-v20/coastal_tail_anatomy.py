"""Native pelvic attachment, continuous cloth cuff and articulated Lizard tail.

This isolated trial replaces the old detached tail component. It does not edit
the head, hands, original actions or any other avatar scene.
"""
import bisect
import math
import hashlib
import json

import bpy
import bmesh
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

from coastal_tail_corrective import action_digest,canonical_material,remove_zero_keys,catmull,arc,resample
from refresh_coastal_character_finish import split_faces,select_only
import coastal_tail_port as port

JOINTS=['TailFinish'+str(i) for i in range(6)]
TIP='TailFinishEnd'
SIDES=24
ROOT_POINT=Vector((0,.055,.925))


def smooth(value):
    value=max(0,min(1,value))
    return value*value*(3-2*value)


def normalized_weights(values):
    chosen=sorted(((name,weight) for name,weight in values.items() if weight>1e-7),key=lambda item:(-item[1],item[0]))[:4]
    total=sum(weight for name,weight in chosen)
    assert total>0
    return {name:weight/total for name,weight in chosen}


def bind(obj,index,weights):
    for group in list(obj.data.vertices[index].groups):obj.vertex_groups[group.group].remove([index])
    for name,weight in normalized_weights(weights).items():
        (obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)).add([index],weight,'REPLACE')


def mesh_status(obj):
    bm=bmesh.new();bm.from_mesh(obj.data)
    result={'vertices':len(bm.verts),'faces':len(bm.faces),'boundaryEdges':sum(e.is_boundary for e in bm.edges),'nonmanifoldEdges':sum(not e.is_manifold for e in bm.edges),'signedVolumeM3':bm.calc_volume()}
    bm.free();return result


def orient_closed(data):
    bm=bmesh.new();bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bm.calc_volume()<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(data);bm.free();data.update()


def extract_original(mesh):
    groups={g.index for g in mesh.vertex_groups if g.name.startswith('Tail')}
    indices=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups if g.group in groups)>.5]
    assert len(indices)==416
    points=[mesh.matrix_world@mesh.data.vertices[i].co for i in indices]
    centers=[sum(points[i:i+16],Vector())/16 for i in range(0,416,16)]
    lengths=arc(centers)
    radii=[max((point-center).length for point in points[i*16:(i+1)*16]) for i,center in enumerate(centers)]
    selected=set(indices)
    old=split_faces(mesh,lambda face:all(v.index in selected for v in face.verts))
    assert old and len(old.data.vertices)==416
    bpy.data.objects.remove(old,do_unlink=True)
    return centers,lengths,radii


def make_curve(old_centers,old_lengths):
    shift=ROOT_POINT-old_centers[0]
    shifted=[point+shift for point in old_centers]
    # A short smooth neck replaces the tilted free cap. Distal reference knots
    # remain explicit authoring references instead of a mandatory old ring set.
    knots=[ROOT_POINT,ROOT_POINT+Vector((0,.055,-.006)),shifted[4],shifted[8],shifted[13],shifted[19],shifted[25]]
    dense=catmull(knots,steps=48)
    factor=old_lengths[-1]/arc(dense)[-1]
    dense=[ROOT_POINT+(point-ROOT_POINT)*factor for point in dense]
    distances=[0.]+[i*.005 for i in range(1,25)]+[.12+i*.01 for i in range(1,21)]
    value=.35
    while value<old_lengths[-1]:distances.append(value);value+=.03
    distances.append(old_lengths[-1])
    centers=resample(dense,[distance/old_lengths[-1] for distance in distances])
    return centers,distances


def add_joints(arm,centers,distances):
    source_length=distances[-1]
    joint_arcs=[0,.04,.16,.40,.66,.92,source_length]
    heads=resample(centers,[distance/source_length for distance in joint_arcs])
    select_only([arm],arm);bpy.ops.object.mode_set(mode='EDIT')
    inverse=arm.matrix_world.inverted()
    previous=arm.data.edit_bones['Hips']
    for i,name in enumerate(JOINTS):
        bone=arm.data.edit_bones.new(name)
        bone.head=inverse@heads[i];bone.tail=inverse@heads[i+1]
        bone.parent=previous;bone.use_connect=i>0;bone.use_deform=True
        previous=bone
    end=arm.data.edit_bones.new(TIP)
    end.head=inverse@heads[-1];end.tail=inverse@(heads[-1]+(heads[-1]-heads[-2]).normalized()*.015)
    end.parent=previous;end.use_connect=True;end.use_deform=False
    bpy.ops.object.mode_set(mode='OBJECT')
    for index,target,influence in [(0,'Tail',1),(4,'TailTip',.5),(5,'TailTip',.5)]:
        bone=arm.pose.bones[JOINTS[index]]
        constraint=bone.constraints.new('COPY_ROTATION');constraint.name='original local tail intent'
        constraint.target=arm;constraint.subtarget=target
        constraint.target_space='LOCAL';constraint.owner_space='LOCAL';constraint.mix_mode='OFFSET';constraint.influence=influence
    return joint_arcs,heads


def tail_weights(distance,joint_arcs):
    midpoints=[(a+b)/2 for a,b in zip(joint_arcs,joint_arcs[1:])]
    at=bisect.bisect_right(midpoints,distance)
    if at==0:weights={JOINTS[0]:1.}
    elif at==6:weights={JOINTS[-1]:1.}
    else:
        amount=(distance-midpoints[at-1])/(midpoints[at]-midpoints[at-1])
        weights={JOINTS[at-1]:1-amount,JOINTS[at]:amount}
    hips=1-smooth(distance/.05)
    return normalized_weights({**{name:value*(1-hips) for name,value in weights.items()},'Hips':hips})


def original_radius(distance,distances,radii):
    at=max(1,min(len(distances)-1,bisect.bisect_right(distances,distance)))
    amount=(distance-distances[at-1])/(distances[at]-distances[at-1])
    return radii[at-1]*(1-amount)+radii[at]*amount


def create_skin(arm,mesh,centers,distances,old_distances,old_radii,joint_arcs):
    pod=[(Vector((0,-.028,.925)),.025,.025),(Vector((0,-.005,.925)),.105,.070),(Vector((0,.025,.925)),.115,.075)]
    world=[];weights=[];ring_specs=[]
    for center,rx,rz in pod:
        ring_specs.append((center,Vector((1,0,0)),Vector((0,0,1)),rx,rz,{'Hips':1.}))
    tangent0=Vector((0,1,0));x_axis=Vector((1,0,0));previous=tangent0
    for i,(center,distance) in enumerate(zip(centers,distances)):
        tangent=centers[min(len(centers)-1,i+1)]-centers[max(0,i-1)]
        tangent.normalize()
        if i==0:tangent=tangent0
        x_axis=previous.rotation_difference(tangent)@x_axis
        x_axis=(x_axis-tangent*x_axis.dot(tangent)).normalized()
        z_axis=x_axis.cross(tangent).normalized();previous=tangent
        radius=original_radius(distance,old_distances,old_radii)
        blend=smooth(distance/.45)
        rx=.075*(1-blend)+radius*blend
        rz=.055*(1-blend)+radius*blend
        ring_specs.append((center,x_axis,z_axis,rx,rz,tail_weights(distance,joint_arcs)))
    for center,x_axis,z_axis,rx,rz,binding in ring_specs:
        for side in range(SIDES):
            angle=2*math.pi*side/SIDES
            world.append(center+x_axis*(math.cos(angle)*rx)+z_axis*(math.sin(angle)*rz));weights.append(binding)
    faces=[]
    for ring in range(len(ring_specs)-1):
        for side in range(SIDES):
            following=(side+1)%SIDES
            faces.append((ring*SIDES+side,ring*SIDES+following,(ring+1)*SIDES+following,(ring+1)*SIDES+side))
    faces.extend([tuple(reversed(range(SIDES))),tuple((len(ring_specs)-1)*SIDES+i for i in range(SIDES))])
    data=bpy.data.meshes.new('connected pelvic tail skin')
    inverse=mesh.matrix_world.inverted();data.from_pydata([inverse@point for point in world],[],faces);data.update()
    material=next(m for m in mesh.data.materials if canonical_material(m)=='skin');data.materials.append(material)
    skin=bpy.data.objects.new('SiruiAnatomicalTail',data);bpy.context.scene.collection.objects.link(skin)
    skin.parent=arm;skin.matrix_world=mesh.matrix_world.copy()
    for bone in arm.data.bones:skin.vertex_groups.new(name=bone.name)
    for i,binding in enumerate(weights):bind(skin,i,binding)
    for face in data.polygons:face.use_smooth=True
    modifier=skin.modifiers.new('native articulated skin','ARMATURE');modifier.object=arm;modifier.use_deform_preserve_volume=False
    orient_closed(data)
    skin['finishCanonicalName']=skin.name
    skin['tailArticulation']={'version':1,'jointNamesJSON':json.dumps(JOINTS),'tipName':TIP,'jointArcsM':joint_arcs,'rootPodRings':len(pod),'ringSides':SIDES,'ringCount':len(ring_specs),'tailDistancesM':distances,'nativeRootPoint':list(ROOT_POINT),'nativeTrial':True,'anatomy':'one closed pelvic attachment and appendage; no internal free tail cap'}
    return skin,len(pod),ring_specs


def cutter_for(skin,pod_count,distances,clearance=.005):
    prefix=pod_count+bisect.bisect_right(distances,.24)
    count=prefix*SIDES
    faces=[tuple(face.vertices) for face in skin.data.polygons if max(face.vertices)<count]
    faces.append(tuple((prefix-1)*SIDES+i for i in range(SIDES)))
    data=bpy.data.meshes.new('anatomical skin socket cavity')
    data.from_pydata([vertex.co.copy() for vertex in list(skin.data.vertices)[:count]],[],faces);data.update()
    orient_closed(data)
    normals=[vertex.normal.copy() for vertex in data.vertices]
    for vertex,normal in zip(data.vertices,normals):vertex.co+=normal*clearance
    data.update();obj=bpy.data.objects.new('anatomical socket construction',data);bpy.context.scene.collection.objects.link(obj);obj.matrix_world=skin.matrix_world.copy()
    return obj,prefix


def cloth_weights(skin):
    skin.data.calc_loop_triangles()
    faces=[tuple(triangle.vertices) for triangle in skin.data.loop_triangles]
    points=[vertex.co.copy() for vertex in skin.data.vertices]
    tree=BVHTree.FromPolygons(points,faces,all_triangles=True)
    bindings=[{skin.vertex_groups[g.group].name:g.weight for g in vertex.groups} for vertex in skin.data.vertices]
    def nearest(point):
        location,normal,index,distance=tree.find_nearest(point)
        indices=faces[index];basis=[points[i] for i in indices]
        bary=barycentric_transform(location,*basis,Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))
        values={}
        for i,amount in zip(indices,bary):
            for name,weight in bindings[i].items():values[name]=values.get(name,0)+weight*amount
        return normalized_weights(values)
    return nearest


def sew_ports(arm,mesh,skin,cutter):
    # Fixed source patch, with the actual connected anatomical cavity replacing
    # the detached-root convex sweep. Shared vertices close every cloth seam.
    port.PATCH_LO=Vector((-.205,-.065,-.50))
    port.PATCH_HI=Vector((.205,.355,-.025))
    nearest=cloth_weights(skin)
    cutter_tree=BVHTree.FromPolygons([v.co for v in cutter.data.vertices],[p.vertices for p in cutter.data.polygons])
    report=[]
    for material in ('Sirui shirt','charcoal shorts'):
        obj=split_faces(mesh,lambda face:canonical_material(mesh.data.materials[face.material_index])==material)
        remove_zero_keys(obj);obj.name='SiruiAnatomicalPort-'+material;obj['finishCanonicalName']=obj.name
        refs=port.triangulate_with_normals(obj)
        material_index=next(i for i,m in enumerate(obj.data.materials) if canonical_material(m)==material)
        select_only([obj],obj);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
        components=list(bpy.context.selected_objects);parts=[]
        for outer in components:
            inner=outer.copy();inner.data=outer.data.copy();bpy.context.scene.collection.objects.link(inner)
            port.crop_inside(inner)
            if not inner.data.polygons:
                bpy.data.objects.remove(inner,do_unlink=True);parts.append(outer);continue
            port.keep_outside(outer);select_only([inner],inner)
            modifier=inner.modifiers.new('continuous anatomical port','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter;modifier.use_self=True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            bm=bmesh.new();bm.from_mesh(inner.data)
            caps=[face for face in bm.faces if any(port.near_plane(face,o,n) for o,n in port.planes())]
            bmesh.ops.delete(bm,geom=caps,context='FACES');port.replace_data(inner,bm)
            select_only([outer,inner],outer);bpy.ops.object.join()
            bm=bmesh.new();bm.from_mesh(outer.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=7e-7);port.replace_data(outer,bm);parts.append(outer)
        select_only(parts,obj);bpy.ops.object.join();port.restore_remote_normals(obj,refs)
        for face in obj.data.polygons:face.material_index=material_index
        attribute=obj.data.attributes.get('tailOriginalTriangle')
        rim={i for face in obj.data.polygons if attribute and attribute.data[face.index].value==0 for i in face.vertices}
        bound=0
        for vertex in obj.data.vertices:
            if not all(port.PATCH_LO[k]<=vertex.co[k]<=port.PATCH_HI[k] for k in range(3)):continue
            distance=cutter_tree.find_nearest(vertex.co)[3]
            amount=1. if vertex.index in rim else max(0,1-distance/.025)
            if not amount:continue
            prior={obj.vertex_groups[g.group].name:g.weight for g in vertex.groups};goal=nearest(vertex.co)
            after={name:prior.get(name,0)*(1-amount)+goal.get(name,0)*amount for name in set(prior)|set(goal)}
            bind(obj,vertex.index,after);bound+=1
        obj['tailPortTrial']=True;obj['anatomicalTailPort']={'version':1,'clearanceM':.005,'sewnCutVertices':len(rim),'skinMatchedVertices':bound,'nativeTrial':True}
        obj['tailPortPatchBounds']=[list(port.PATCH_LO),list(port.PATCH_HI)]
        report.append({'material':material,**mesh_status(obj),'sewnCutVertices':len(rim),'skinMatchedVertices':bound,'nativeLocalBox':[list(port.PATCH_LO),list(port.PATCH_HI)]})
    return report


def create_anatomy_trial(arm,mesh):
    actions=action_digest(arm)
    original_bones={bone.name:[list(row) for row in bone.matrix_local] for bone in arm.data.bones}
    pose=arm.data.pose_position;arm.data.pose_position='REST'
    for track in arm.animation_data.nla_tracks:track.mute=True
    bpy.context.view_layer.update()
    centers,lengths,radii=extract_original(mesh)
    new_centers,distances=make_curve(centers,lengths)
    joint_arcs,heads=add_joints(arm,new_centers,distances)
    skin,pod_count,rings=create_skin(arm,mesh,new_centers,distances,lengths,radii,joint_arcs)
    cutter,prefix=cutter_for(skin,pod_count,distances)
    ports=sew_ports(arm,mesh,skin,cutter)
    cutter_data=cutter.data;bpy.data.objects.remove(cutter,do_unlink=True);bpy.data.meshes.remove(cutter_data)
    assert action_digest(arm)==actions,'Original fourteen action channels must remain intact'
    bone_error=max(abs(value-arm.data.bones[name].matrix_local[i][j]) for name,rows in original_bones.items() for i,row in enumerate(rows) for j,value in enumerate(row))
    arm.data.pose_position=pose
    for track in arm.animation_data.nla_tracks:track.mute=track.name!='idle'
    bpy.context.scene.frame_set(1)
    return {'state':'Anatomical reconstruction trial only; full actual-contact and4K gates pending','originalActionsSha256':actions,'originalFourteenClipChannelsExact':True,'originalBoneBindMaximumComponentError':bone_error,'newJoints':JOINTS,'jointNativeHeads':[list(point) for point in heads],'originalTailCenterlineM':lengths[-1],'newTailRestCenterlineM':arc(new_centers)[-1],'skin':mesh_status(skin),'rootPodRings':pod_count,'clothCavityPrefixRings':prefix,'garmentPorts':ports,'sourceIntent':'Bounded new pelvic attachment and tail/cloth topology. Head, hands and rest of person untouched. Exact old tail counts/rings were not requirements.'}
