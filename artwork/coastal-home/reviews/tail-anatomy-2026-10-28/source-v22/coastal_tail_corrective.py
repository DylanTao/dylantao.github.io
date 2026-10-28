"""Bounded native trial: a rear garment port and an independent seated drape.

Only the existing tail component and the two clothing layers at its attachment
are involved. This module does not edit actions, rigs or canonical files.
"""
import hashlib
import json

import bpy
import bmesh
from mathutils import Matrix, Vector

from refresh_coastal_character_finish import split_faces, select_only


def canonical_material(material):
    return material.get("finishCanonicalName", material.name)


def catmull(points, steps=32):
    result=[]
    for i in range(len(points)-1):
        a,b,c,d=points[max(0,i-1)],points[i],points[i+1],points[min(len(points)-1,i+2)]
        for j in range(steps):
            t=j/steps
            result.append((2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)*.5)
    return result+[points[-1]]


def arc(points):
    result=[0.]
    for a,b in zip(points,points[1:]):result.append(result[-1]+(b-a).length)
    return result


def resample(points, fractions):
    lengths=arc(points);out=[];at=0
    for fraction in fractions:
        distance=lengths[-1]*fraction
        while at<len(lengths)-2 and lengths[at+1]<distance:at+=1
        t=(distance-lengths[at])/max(1e-12,lengths[at+1]-lengths[at])
        out.append(points[at].lerp(points[at+1],t))
    return out


def action_digest(arm):
    values=[]
    for track in arm.animation_data.nla_tracks:
        for strip in track.strips:
            values.append([track.name,strip.frame_start,strip.frame_end,
                [(c.data_path,c.array_index,[(tuple(k.co),tuple(k.handle_left),tuple(k.handle_right),k.interpolation) for k in c.keyframe_points]) for c in strip.action.fcurves]])
    return hashlib.sha256(json.dumps(values,sort_keys=True).encode()).hexdigest()


def remove_zero_keys(obj):
    keys=obj.data.shape_keys
    if not keys:return
    basis=keys.key_blocks[0]
    assert all((point.co-base.co).length==0 for key in list(keys.key_blocks)[1:] for point,base in zip(key.data,basis.data)),obj.name
    obj.shape_key_clear()


def make_drape(arm, mesh):
    groups={g.index for g in mesh.vertex_groups if g.name.startswith('Tail')}
    ids=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups if g.group in groups)>.5]
    assert len(ids)==416
    selected=set(ids)
    assert all(not (selected.intersection(face.vertices) and not set(face.vertices)<=selected) for face in mesh.data.polygons)
    original={i:mesh.data.vertices[i].co.copy() for i in ids}
    for track in arm.animation_data.nla_tracks:track.mute=track.name!='lounge'
    bpy.context.scene.frame_set(49)
    ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh()
    points=[ev.matrix_world@me.vertices[i].co for i in ids];ev.to_mesh_clear()
    centers=[sum(points[i:i+16],Vector())/16 for i in range(0,416,16)]
    lengths=arc(centers)
    root=centers[0]
    path=catmull([root,root+Vector((0,.10,.036)),root+Vector((.30,.12,.12)),
                  root+Vector((.60,-.06,.084)),root+Vector((.90,-.15,0))])
    scale=lengths[-1]/arc(path)[-1]
    path=[centers[0]+(p-centers[0])*scale for p in path]
    desired=resample(path,[d/lengths[-1] for d in lengths])
    # Polyline resampling loses a little curved arc; hold the sampled source
    # centreline length too, about the second retained attachment ring.
    for _ in range(4):
        factor=lengths[-1]/arc(desired)[-1]
        desired=[centers[0]+(p-centers[0])*factor for p in desired]
    transforms={name:arm.matrix_world@bone.matrix@bone.bone.matrix_local.inverted()@arm.matrix_world.inverted() for name,bone in arm.pose.bones.items()}
    targets={};replay=0.;radius_error=0.
    for at,i in enumerate(ids):
        ring=at//16;old=centers[min(25,ring+1)]-centers[max(0,ring-1)];new=desired[min(25,ring+1)]-desired[max(0,ring-1)]
        offset=points[at]-centers[ring]
        # Transport the actual radial plane onto the lateral route. A bounded
        # attachment blend avoids rotating the first thick ring abruptly.
        start=ring*16
        normal=(points[start+1]-points[start]).cross(points[start+4]-points[start]).normalized()
        if normal.dot(old)<0:normal=-normal
        turn=normal.rotation_difference(new.normalized())
        amount=min(1.,ring/4)
        amount=amount*amount*(3-2*amount)
        turn=turn.__class__((1,0,0,0)).slerp(turn,amount)
        target=desired[ring]+turn@offset
        if ring==0:target=points[at].copy()
        radius_error=max(radius_error,abs((target-desired[ring]).length-offset.length))
        matrix=Matrix(((0.,)*4,)*4);vertex=mesh.data.vertices[i];total=sum(g.weight for g in vertex.groups)
        for binding in vertex.groups:
            transform=transforms[mesh.vertex_groups[binding.group].name]
            for row in range(4):
                for column in range(4):matrix[row][column]+=transform[row][column]*binding.weight/total
        replay=max(replay,(matrix@(mesh.matrix_world@vertex.co)-points[at]).length)
        targets[tuple(original[i])]=mesh.matrix_world.inverted()@(matrix.inverted()@target)
    assert replay<2e-6 and radius_error<2e-6,(replay,radius_error)
    tail=split_faces(mesh,lambda face:all(v.index in selected for v in face.verts))
    assert len(tail.data.vertices)==416
    remove_zero_keys(tail)
    tail.name='SiruiTailCorrective';tail['finishCanonicalName']=tail.name
    tail['tailCorrective']={'version':1,'morph':'SeatedDrape','nativeTrial':True}
    tail.shape_key_add(name='Basis');key=tail.shape_key_add(name='SeatedDrape')
    for vertex in tail.data.vertices:key.data[vertex.index].co=targets[tuple(vertex.co)]
    key.value=0
    return tail,{'vertices':416,'retainedAttachmentRings':1,'sourceCenterlineLengthM':lengths[-1],
                 'targetCenterlineLengthM':arc(desired)[-1],'maximumRingRadiusErrorM':radius_error,'inverseSkinReplayErrorM':replay}


def cut_ports(arm, mesh, tail, clearance=.006):
    # Operate in native bind space. Five swept shape samples cover the bounded
    # port trial; acceptance still tests actual animated cloth and full tail.
    prior_pose=arm.data.pose_position
    arm.data.pose_position='REST'
    for track in arm.animation_data.nla_tracks:track.mute=True
    for bone in arm.pose.bones:bone.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update()
    garments=[];report=[]
    for material in ('Sirui shirt','charcoal shorts'):
        obj=split_faces(mesh,lambda face:canonical_material(mesh.data.materials[face.material_index])==material)
        assert obj
        remove_zero_keys(obj)
        obj.name='SiruiTailPort-'+material;obj['finishCanonicalName']=obj.name
        original=[v.co.copy() for v in obj.data.vertices];before_faces=len(obj.data.polygons)
        material_index=next(i for i,m in enumerate(obj.data.materials) if canonical_material(m)==material)
        # The source contains overlapping closed clothing components. Resolve
        # each independently so a port cannot union the distant sleeves/legs.
        select_only([obj],obj)
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
        components=list(bpy.context.selected_objects)
        before_volume=0
        for part in components:
            bm=bmesh.new();bm.from_mesh(part.data);before_volume+=abs(bm.calc_volume());bm.free()
        for alpha in (1,):
            basis=tail.data.shape_keys.key_blocks['Basis'];target=tail.data.shape_keys.key_blocks['SeatedDrape']
            data=bpy.data.meshes.new('tail port construction')
            hull=bmesh.new()
            for key in (basis,target):
                for i in range(48):hull.verts.new(key.data[i].co)
            bmesh.ops.remove_doubles(hull,verts=list(hull.verts),dist=1e-7)
            bmesh.ops.convex_hull(hull,input=list(hull.verts),use_existing_faces=False)
            bmesh.ops.recalc_face_normals(hull,faces=list(hull.faces))
            hull.to_mesh(data);hull.free()
            tool=bpy.data.objects.new('tail port construction',data);bpy.context.scene.collection.objects.link(tool)
            tool.matrix_world=tail.matrix_world.copy()
            tool.data.update()
            # A physical lining clearance, never a larger tail radius.
            normals=[v.normal.copy() for v in tool.data.vertices]
            for v,n in zip(tool.data.vertices,normals):v.co+=n*clearance
            for part in components:
                select_only([part],part)
                modifier=part.modifiers.new('rear tail port','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=tool
                modifier.use_self=True
                bpy.ops.object.modifier_apply(modifier=modifier.name)
                for face in part.data.polygons:face.material_index=material_index
            construction_data=tool.data
            bpy.data.objects.remove(tool,do_unlink=True)
            bpy.data.meshes.remove(construction_data)
            volume=0
            for part in components:
                bm=bmesh.new();bm.from_mesh(part.data);volume+=abs(bm.calc_volume());bm.free()
            assert volume>=before_volume*.75,(material,alpha,'invalid unbounded Boolean loss',before_volume,volume)
        select_only(components,obj);bpy.ops.object.join()
        # A port rim follows the actual tail attachment, rather than the old
        # closed waist cap's Hips/Spine blend. Keep this binding change local.
        tail_basis=tail.data.shape_keys.key_blocks['Basis']
        bound=[]
        original_keys={tuple(p) for p in original}
        for vertex in obj.data.vertices:
            p=vertex.co
            if not (-.145<=p.x<=.145 and .015<=p.y<=.16 and -.44<=p.z<=-.07):continue
            nearest=min(range(48),key=lambda i:(p-tail_basis.data[i].co).length_squared)
            distance=(p-tail_basis.data[nearest].co).length
            influence=1. if tuple(p) not in original_keys else max(0.,min(1.,(.085-distance)/.025))
            if not influence:continue
            prior={obj.vertex_groups[g.group].name:g.weight for g in vertex.groups}
            goal={tail.vertex_groups[g.group].name:g.weight for g in tail.data.vertices[nearest].groups}
            after={name:prior.get(name,0)*(1-influence)+goal.get(name,0)*influence for name in set(prior)|set(goal)}
            for binding in list(vertex.groups):obj.vertex_groups[binding.group].remove([vertex.index])
            for name,weight in after.items():
                if weight>1e-8:
                    group=obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name);group.add([vertex.index],weight,'REPLACE')
            bound.append(vertex.index)
        obj['tailPortTrial']=True;obj['portClearanceM']=clearance
        changed=[v.co for v in obj.data.vertices if not any((v.co-p).length<1e-7 for p in original)]
        report.append({'material':material,'originalVertices':len(original),'vertices':len(obj.data.vertices),
                       'beforeFaces':before_faces,'faces':len(obj.data.polygons),'newVertices':len(changed),'tailBoundRimVertices':len(bound),
                       'newVertexBounds':[[min(p[k] for p in changed) for k in range(3)],[max(p[k] for p in changed) for k in range(3)]] if changed else None})
        garments.append(obj)
    arm.data.pose_position=prior_pose
    return garments,report


def create_trial(arm,mesh):
    actions=action_digest(arm)
    tail,report=make_drape(arm,mesh)
    garments,ports=cut_ports(arm,mesh,tail)
    assert action_digest(arm)==actions,'Original fourteen clip channels must remain exact'
    for track in arm.animation_data.nla_tracks:track.mute=track.name!='idle'
    bpy.context.scene.frame_set(1)
    return {'drape':report,'garmentPorts':ports,'originalActionsSha256':actions,'originalFourteenClipChannelsExact':True}
