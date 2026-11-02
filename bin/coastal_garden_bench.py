"""Source-bound open backrest relief and end pillow for the new plant-garden bench.

Run only after coastal_breakfast_nook has moved the original furnishings and
built its new bench. This edits no old room/cooking/terrain geometry. The replay
owns before/after custody, lighting, export and actual body-motion verification.
"""


def finish_garden_bench(scene):
    import math
    import bpy
    import bmesh
    from mathutils import Matrix, Vector
    import coastal_breakfast_nook as nook
    from coastal_office import Parts, box

    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("Garden bench requires the qualified Blender4.5.9 constructor")
    if any(obj.name.startswith("core_garden_bench_tail") for obj in scene.objects):
        raise RuntimeError("Garden bench relief is already authored")

    wood='core_breakfast_nook__honey ash';oak='core_breakfast_nook__pale oak'
    back='kitchen_breakfast_cushion.001';pillow='kitchen_breakfast_cushion.002'
    olive=sorted(o.name for o in bpy.context.scene.objects if o.type=='MESH'and o.name.startswith('kitchen')and'olive'in o.name)
    assert len(olive)==4,olive
    owned={wood,oak,back,pillow,*olive}
    for name in owned:
        obj=bpy.data.objects.get(name)
        if not obj or obj.type!='MESH' or obj.data.users!=1 or obj.data.shape_keys:
            raise RuntimeError('Exclusive garden furnishing ownership changed: '+name)

    def data_fingerprint(obj):
        # Read the shared local data through a fresh UNLINKED identity object.
        # Never touch the real owner's transform to measure its local fields.
        proxy=bpy.data.objects.new('private readonly local-field witness',obj.data)
        try:return nook.view_bench_fingerprint(proxy)
        finally:bpy.data.objects.remove(proxy)

    def world_bounds(obj):
        p=[obj.matrix_world@v.co for v in obj.data.vertices]
        return [[min(a[k]for a in p)for k in range(3)],[max(a[k]for a in p)for k in range(3)]]

    def valid_parts(obj):
        bm=bmesh.new();bm.from_mesh(obj.data)
        assert all(e.is_manifold and e.is_contiguous for e in bm.edges),obj.name
        groups=nook._islands(obj);rows=[]
        for row in groups:
            part=nook._subset(obj.data,row['faces'],'private positive part')
            scratch=bmesh.new();scratch.from_mesh(part)
            volume=scratch.calc_volume(signed=True);scratch.free()
            assert volume>0,(obj.name,volume)
            rows.append({'loWorld':row['lo'],'hiWorld':row['hi'],'volumeM3':volume})
            bpy.data.meshes.remove(part)
        bm.free();return rows

    changes=[]
    parts=Parts('core_garden_bench_tail')
    new_bounds=[]
    def wbox(material,lo,hi):
        center=[(lo[k]+hi[k])/2 for k in range(3)]
        size=[hi[k]-lo[k]for k in range(3)]
        assert min(size)>0
        box(parts.bm(bpy.data.materials[material]),nook.native(center),(size[0],size[2],size[1]),0)
        new_bounds.append({'material':material,'loWorld':lo,'hiWorld':hi})

    # Only the new rear plinth and back are replaced. The front seat cushion stays exact.
    for name,lo,hi in [(wood,[-7.79,-1.02,5.43],[-6.68,-.68,6.03]),(oak,[-7.79,-.68,5.95],[-6.68,-.10,6.03])]:
        obj=bpy.data.objects[name]
        islands=nook._islands(obj)
        chosen=[r for r in islands if max(abs(r['lo'][k]-lo[k])for k in range(3))<1e-5 and max(abs(r['hi'][k]-hi[k])for k in range(3))<1e-5]
        assert len(chosen)==1,(name,islands)
        row=chosen[0];assert len(row['vertices'])==8 and len(row['faces'])==6
        retained=set(range(len(obj.data.polygons)))-row['faces']
        changes.append({'owner':name,'retiredNewFaces':sorted(row['faces']),'retainedFaces':len(retained)})
        if retained:
            expected=nook._subset(obj.data,retained,name+' retained exact')
            obj.data=expected
            changes[-1]['retainedNativeFieldsSha256']=nook.view_bench_fingerprint(obj)
        else:
            bpy.data.objects.remove(obj,do_unlink=True)

    # A full front bearing, continuous100mm base and two side bearings surround the rear void.
    wbox('honey ash',[-7.79,-1.02,5.43],[-6.68,-.92,6.03])
    wbox('honey ash',[-7.79,-.92,5.43],[-6.68,-.68,5.829])
    wbox('honey ash',[-7.79,-.92,5.829],[-7.35,-.68,6.03])
    wbox('honey ash',[-7.03,-.92,5.829],[-6.68,-.68,6.03])
    wbox('pale oak',[-7.79,-.68,5.95],[-7.35,-.10,6.03])
    wbox('pale oak',[-7.03,-.68,5.95],[-6.68,-.10,6.03])
    new=parts.finish()
    new_names=[o.name for o in new]
    for obj in new:
        obj['breakfastNook']=True

    # The tool exits above the actual cushion top. A tail can enter the open
    #32cm channel while sitting; a closed upper bridge would trap the turn.
    x0,x1,lower,top,r=-7.35,-7.03,-.92,.10,.04
    profile=[(x0,lower),(x1,lower),(x1,top-r)]
    for i in range(1,9):
        a=i*math.pi/16
        profile.append((x1-r+r*math.cos(a),top-r+r*math.sin(a)))
    profile.append((x0+r,top))
    for i in range(1,9):
        a=math.pi/2+i*math.pi/16
        profile.append((x0+r+r*math.cos(a),top-r+r*math.sin(a)))
    n=len(profile)
    points=[nook.native((x,y,z))for z in (5.829,6.08)for x,y in profile]
    faces=[list(range(n-1,-1,-1)),list(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
    mesh=bpy.data.meshes.new('private rounded tail relief tool')
    mesh.from_pydata(points,[],faces)
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    tool=bpy.data.objects.new('private rounded tail relief tool',mesh);bpy.context.scene.collection.objects.link(tool)
    obj=bpy.data.objects[back]
    old_tri=sum(len(f.vertices)-2 for f in obj.data.polygons)
    assert len(nook._islands(obj))==1
    valid_parts(obj)
    bpy.context.view_layer.objects.active=obj
    modifier=obj.modifiers.new('NEW garden back cushion tail relief','BOOLEAN')
    modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=tool
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(tool,do_unlink=True);bpy.data.meshes.remove(mesh)
    assert len(obj.data.materials)==1 and obj.data.materials[0].name=='rust boucle textile'
    changes.append({'owner':back,'originalTriangles':old_tri,'candidateTriangles':sum(len(f.vertices)-2 for f in obj.data.polygons),'roundedReliefWorld':[[x0,lower,5.829],[x1,top,6.08]],'cornerRadiusM':r,'positiveParts':valid_parts(obj)})

    # Move the complete plant, including all foliage/branches/pot, without editing its local data.
    for name in olive:
        obj=bpy.data.objects[name];original=data_fingerprint(obj);old=world_bounds(obj)
        obj.matrix_world=Matrix.Translation((.15,0,0))@obj.matrix_world
        bpy.context.view_layer.update()
        actual=world_bounds(obj)
        assert data_fingerprint(obj)==original
        assert all(abs(actual[side][k]-old[side][k]-(.15 if k==0 else 0))<1e-6 for side in (0,1)for k in range(3))
        changes.append({'owner':name,'action':'rigid-whole-olive','deltaWorld':[.15,0,0],'localDataSha256':original,'beforeNativeBounds':old,'afterNativeBounds':world_bounds(obj)})

    # Turn the small pillow into a supported west armrest, clear of the central seat.
    obj=bpy.data.objects[pillow];original=data_fingerprint(obj);old=world_bounds(obj)
    center=Vector([(old[0][k]+old[1][k])/2 for k in range(3)])
    target=Vector(nook.native((-7.68,-.41,5.62)))
    obj.matrix_world=Matrix.Translation(target)@Matrix.Rotation(-math.pi/2,4,'Z')@Matrix.Translation(-center)@obj.matrix_world
    assert data_fingerprint(obj)==original
    changes.append({'owner':pillow,'action':'rigid-west-end-pillow','yawDegreesNative':-90,'localDataSha256':original,'beforeNativeBounds':old,'afterNativeBounds':world_bounds(obj)})

    bpy.context.view_layer.update()
    for obj in new: valid_parts(obj)

    return {"version": 2, "scope": "NEW bench open backrest relief with continuous base/front bearing and two independently supported cushion lobes; whole olive rigid150mm east move and rigid west-end pillow. Body motion, support, bake and export verification remain separate.",
            "owned": sorted(owned), "newObjects": new_names, "newBoxes": new_bounds, "changes": changes}
