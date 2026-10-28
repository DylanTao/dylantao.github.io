"""Large-scale retained-rock, pavilion and cantilever composition (final native metres)."""
import math
import hashlib
import json
import os
import subprocess
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

from coastal_office import Parts, box, cylinder, _mat, rooted_leaf
import coastal_estate_architecture as architecture
from coastal_architecture_finish import bounds, components, edit_islands, inside, rock_objects, tool_difference
import coastal_shell as shell


def smooth(value):
    t = min(1., max(0., value))
    return t * t * (3 - 2 * t)


def exact_set_boolean(target, tool, operation, solver="EXACT"):
    """Treat disconnected, overlapping coast rocks as a solid union operand."""
    bpy.context.view_layer.objects.active=target
    modifier=target.modifiers.new("Exact set operation on retained rock islands","BOOLEAN")
    modifier.operation=operation
    modifier.solver=solver
    modifier.object=tool
    modifier.use_self=solver=="EXACT"
    modifier.use_hole_tolerant=False
    modifier.material_mode="TRANSFER"
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def triangulate_actual_render_faces(bm, mesh, lo, hi, all_quads=False):
    """Keep Blender's exact pre-cut render diagonals on nonplanar source faces."""
    bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table()
    source_faces=list(bm.faces)
    mesh.calc_loop_triangles()
    groups={}
    for triangle in mesh.loop_triangles:groups.setdefault(triangle.polygon_index,[]).append(tuple(triangle.vertices))
    remove=[]
    for polygon in mesh.polygons:
        # Retained Boolean n-gons can be nonplanar too. Preserve every valid
        # original render diagonal, not only the source grid's quads.
        if len(polygon.vertices)<=3:continue
        face=source_faces[polygon.index]
        if not all_quads and not all(max(v.co[k] for v in face.verts)>=lo[k]-1e-6 and min(v.co[k] for v in face.verts)<=hi[k]+1e-6 for k in range(3)):
            continue
        # Some retained Boolean quads contain a zero-area render triangle but
        # still carry a necessary topological edge. Preserve the whole original
        # quad rather than dropping that edge during explicit triangulation.
        if any(((bm.verts[indices[1]].co-bm.verts[indices[0]].co).cross(bm.verts[indices[2]].co-bm.verts[indices[0]].co)).length<1e-12 or bm.faces.get([bm.verts[i] for i in indices]) is not None for indices in groups[polygon.index]):
            continue
        loops={loop.vert:loop for loop in face.loops}
        for indices in groups[polygon.index]:
            vertices=[bm.verts[i] for i in indices]
            if ((vertices[1].co-vertices[0].co).cross(vertices[2].co-vertices[0].co)).length<1e-12:
                continue
            if bm.faces.get(vertices) is not None:
                raise RuntimeError(f"Render triangulation already exists: polygon{polygon.index} original{list(polygon.vertices)} bm{[v.index for v in face.verts]} triangle{indices}")
            new=bm.faces.new(vertices,face)
            for loop in new.loops:loop.copy_from(loops[loop.vert])
        remove.append(face)
    if remove:bmesh.ops.delete(bm,geom=remove,context="FACES_ONLY")
    return len(remove)


def restore_original_outside(target, original_mesh, lo, hi, remove_caps=False, bounded_plane_split=False):
    """Admit a Boolean only inside its explicit patch box, preserving all else.

    A material-batched coast can contain distant self-overlapping rocks in the
    same connected component. Even a local solid operand can make a set solver
    simplify those rocks. Plane splitting, without capping or moving retained
    faces, keeps the exact old exterior outside the authored patch.
    """
    old=bmesh.new();old.from_mesh(original_mesh)
    triangulated=triangulate_actual_render_faces(old,original_mesh,lo,hi,all_quads=True)
    new=bmesh.new();new.from_mesh(target.data)
    bmesh.ops.transform(old,matrix=target.matrix_world,verts=list(old.verts))
    bmesh.ops.transform(new,matrix=target.matrix_world,verts=list(new.verts))
    planes=[]
    for axis in range(3):
        for value,sign in ((lo[axis],-1),(hi[axis],1)):
            point=Vector();point[axis]=value
            normal=Vector();normal[axis]=sign
            planes.append((point,normal))
    for point,normal in planes:
        # Complete adjacency is necessary for long planar caps: selecting a
        # fragment can split a shared edge without updating its other face.
        # Every nonplanar quad was already made into its original render tris,
        # so these plane splits cannot change a retained surface diagonal.
        retained_geometry=list(old.verts)+list(old.edges)+list(old.faces)
        if bounded_plane_split:
            # Render triangles are fixed above. Restrict the retained-side
            # plane operation to the physical box and complete face adjacency;
            # remote exterior triangles need no new tessellation or vertices.
            faces={face for face in old.faces if all(max(v.co[k] for v in face.verts)>=lo[k]-1e-6 and
                min(v.co[k] for v in face.verts)<=hi[k]+1e-6 for k in range(3))}
            faces.update(linked for face in list(faces) for edge in face.edges for linked in edge.link_faces)
            edges={edge for face in faces for edge in face.edges}
            vertices={vertex for face in faces for vertex in face.verts}
            retained_geometry=list(vertices)+list(edges)+list(faces)
        bmesh.ops.bisect_plane(old,geom=retained_geometry,
            dist=1e-7,plane_co=point,plane_no=normal,clear_inner=False,clear_outer=False)
        bmesh.ops.bisect_plane(new,geom=list(new.verts)+list(new.edges)+list(new.faces),
            dist=1e-7,plane_co=point,plane_no=normal,clear_inner=False,clear_outer=True)
    inside=lambda p:all(lo[k]-1e-6<=p[k]<=hi[k]+1e-6 for k in range(3))
    cap_faces=[]
    if remove_caps:
        cap_tag=new.faces.layers.int.get("Finish temporary boundary")
        if cap_tag is None:raise RuntimeError("Temporary Boolean cap identity was lost")
        cap_faces=[face for face in new.faces if face[cap_tag] and any(all(abs(v.co[k]-value)<3e-6 for v in face.verts) for k in range(3) for value in (lo[k],hi[k]))]
        bmesh.ops.delete(new,geom=cap_faces,context="FACES")
    bmesh.ops.delete(old,geom=[face for face in old.faces if inside(face.calc_center_median())],context="FACES")
    retained_faces=len(old.faces)
    temporary=bpy.data.meshes.new("bounded Boolean interior")
    new.to_mesh(temporary);new.free()
    old.from_mesh(temporary);bpy.data.meshes.remove(temporary)
    candidates=[v for v in old.verts if all(lo[k]-1e-4<=v.co[k]<=hi[k]+1e-4 for k in range(3))]
    bmesh.ops.remove_doubles(old,verts=candidates,dist=3e-6)
    # A solver can subdivide a boundary edge without moving its physical line.
    # Split its retained counterpart at that exact collinear vertex before the
    # weld, rather than filling a crack with an invented cap.
    split=0
    boundary=[e for e in old.edges if e.is_boundary]
    vertices=list({v for edge in boundary for v in edge.verts})
    for edge in list(boundary):
        if not edge.is_valid:continue
        a,b=edge.verts;direction=b.co-a.co;length2=direction.length_squared
        if length2<1e-12:continue
        on=[]
        for vertex in vertices:
            if vertex in (a,b):continue
            fraction=(vertex.co-a.co).dot(direction)/length2
            if 1e-5<fraction<1-1e-5 and (vertex.co-(a.co+direction*fraction)).length<=3e-6:
                on.append((fraction,vertex.co.copy()))
        previous=a
        for fraction,point in sorted(on,key=lambda row:row[0]):
            if not edge.is_valid:break
            # Split from the current retained start toward the unchanged end.
            relative=(point-previous.co).length/(b.co-previous.co).length
            new_edge,vertex=bmesh.utils.edge_split(edge,previous,relative)
            vertex.co=point;split+=1
            edge=next((e for e in vertex.link_edges if b in e.verts),new_edge)
            previous=vertex
    candidates=[v for v in old.verts if all(lo[k]-1e-4<=v.co[k]<=hi[k]+1e-4 for k in range(3))]
    bmesh.ops.remove_doubles(old,verts=candidates,dist=3e-6)
    unused=[v for v in old.verts if not v.link_faces]
    if unused:bmesh.ops.delete(old,geom=unused,context="VERTS")
    nonmanifold=sum(not e.is_manifold for e in old.edges)
    bmesh.ops.transform(old,matrix=target.matrix_world.inverted(),verts=list(old.verts))
    old.to_mesh(target.data);old.free();target.data.update()
    cap_attribute=target.data.attributes.get("Finish temporary boundary")
    if cap_attribute:target.data.attributes.remove(cap_attribute)
    if nonmanifold:raise RuntimeError(f"Bounded native patch {target.name} has {nonmanifold} unjoined edges")
    return {"nativeBounds":{"min":list(lo),"max":list(hi)},"outsideFacesRetained":retained_faces,
            "collinearBoundarySplits":split,"nonmanifoldEdges":nonmanifold,"temporaryCapsRemoved":len(cap_faces),
            "retainedSourceQuadsUsingOriginalRenderTriangles":triangulated,
            "boundedRetainedPlaneSplits":bounded_plane_split,
            "method":"Original outside triangles plus solved interior, exact plane splits and 3um coincident boundary weld; no caps"}


def local_solid_boolean(target, addition, operation="UNION"):
    """Solve a clipped local solid, never a whole compound house/coast mass."""
    original_materials=list(target.data.materials)
    original_mesh=target.data.copy()
    original_mesh.use_fake_user=True
    cut_lo,cut_hi=bounds([addition.matrix_world@v.co for v in addition.data.vertices])
    lo,hi=cut_lo-Vector((.12,.12,.12)),cut_hi+Vector((.12,.12,.12))
    bm=bmesh.new();bm.from_mesh(target.data)
    triangulate_actual_render_faces(bm,target.data,lo,hi,all_quads=True)
    bmesh.ops.transform(bm,matrix=target.matrix_world,verts=list(bm.verts))
    cap_tag=bm.faces.layers.int.new("Finish temporary boundary")
    cap_count=0
    for axis in range(3):
        for value,sign in ((lo[axis],-1),(hi[axis],1)):
            point=Vector();point[axis]=value
            normal=Vector();normal[axis]=sign
            bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,
                plane_co=point,plane_no=normal,clear_inner=False,clear_outer=True)
            boundary=[edge for edge in bm.edges if edge.is_boundary and all(abs(v.co[axis]-value)<3e-6 for v in edge.verts)]
            if boundary:
                caps=bmesh.ops.holes_fill(bm,edges=boundary,sides=0)["faces"]
                cap_count+=len(caps)
                for face in caps:face[cap_tag]=1
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    local_nonmanifold=sum(not edge.is_manifold for edge in bm.edges)
    local_vertices=len(bm.verts)
    bmesh.ops.transform(bm,matrix=target.matrix_world.inverted(),verts=list(bm.verts))
    bm.to_mesh(target.data);bm.free()
    if local_nonmanifold:raise RuntimeError(f"Local closed union operand has {local_nonmanifold} open/invalid edges")
    from audit_coastal_overlap_volume import topology
    operand_audit=topology(target.data)
    attempt=os.environ.get("COASTAL_ARCHITECTURE_ATTEMPT") if operation=="UNION" and target.name=="coast_shared_golden coastal sandstone" else None
    if attempt:
        (Path(attempt)/"coast-local-operand.json").write_text(json.dumps(operand_audit,indent=2)+"\n",encoding="utf-8")
        bpy.ops.wm.save_as_mainfile(filepath=str(Path(attempt)/"coast-local-operand.blend"),compress=True)
    solver="MANIFOLD" if local_nonmanifold==0 else "EXACT"
    exact_set_boolean(target,addition,operation,solver=solver)
    bm=bmesh.new();bm.from_mesh(target.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=3e-6)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=3e-6)
    wires=[e for e in bm.edges if e.is_wire]
    if wires:bmesh.ops.delete(bm,geom=wires,context="EDGES")
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    nonmanifold=sum(not e.is_manifold for e in bm.edges)
    bm.to_mesh(target.data);bm.free()
    if attempt:bpy.ops.wm.save_as_mainfile(filepath=str(Path(attempt)/"coast-local-solved.blend"),compress=True)
    # This temporary whole-component solver result is never admitted directly.
    # Its exterior is replaced by the original source below; the assembled,
    # bounded solid must pass the strict closed-edge gate after that operation.
    result_materials=list(target.data.materials)
    complete=original_materials+[m for m in result_materials if m not in original_materials]
    indices=[complete.index(result_materials[f.material_index]) for f in target.data.polygons]
    target.data.materials.clear()
    for material in complete:target.data.materials.append(material)
    for face,index in zip(target.data.polygons,indices):face.material_index=index
    bounded=restore_original_outside(target,original_mesh,lo,hi,remove_caps=True)
    bpy.data.meshes.remove(original_mesh)
    return {"operation":operation,"solver":solver,"inputAdditionBounds":{"min":list(cut_lo),"max":list(cut_hi)},"workingExpansionM":.12,
            "localInputVertices":local_vertices,"temporaryInputCaps":cap_count,"localInputNonmanifoldEdges":local_nonmanifold,"localInputAudit":operand_audit,
            "solvedInputNonmanifoldEdges":nonmanifold,"coincidentPointWeldM":3e-6,"boundedPatch":bounded}


def union_preserving_components(target,addition):
    return local_solid_boolean(target,addition,"UNION")


def compact_retained_coast(scene, config):
    """Remove remote plane-cut tessellation, preserving the actual coast surface.

    This is topology compaction, not a geometry LOD. Admission requires the
    independent seven-probe triangle controls in BOTH directions at3um.
    """
    from mathutils.geometry import barycentric_transform
    from audit_coastal_architecture_finish import triangle_distance
    root=Path(__file__).resolve().parents[1]
    commit="75d956485"
    expected="b3a258ceb567a99f64d01314964c19dddc2ea8eb3cb43677a5620ba546e80975"
    source=root/".jekyll-cache/visual-qa/finish-house-2026-10-26/baseline/architecture-admission-source.blend"
    if not source.exists():
        source.parent.mkdir(parents=True,exist_ok=True)
        with source.open("wb") as handle:
            subprocess.run(["git","show",commit+":artwork/coastal-home/coastal-home.blend"],stdout=handle,check=True,cwd=root)
    if hashlib.sha256(source.read_bytes()).hexdigest()!=expected:
        raise RuntimeError("The retained architecture admission source does not match its public Git blob")
    coast=scene.objects["coast_shared_golden coastal sandstone"]
    before={"vertices":len(coast.data.vertices),"polygons":len(coast.data.polygons)}
    with bpy.data.libraries.load(str(source),link=False) as (_,loaded):
        loaded.objects=["coast_shared_golden coastal sandstone"]
    reference=loaded.objects[0]
    original=reference.data.copy()
    for mesh in (coast.data,original):
        normals=[normal.vector.copy() for normal in mesh.corner_normals]
        attribute=mesh.attributes.new("Finish exact retained normal","FLOAT_VECTOR","CORNER")
        for entry,value in zip(attribute.data,normals):entry.vector=value
    coast.data.calc_loop_triangles()
    triangles=[(list(face.vertices),list(face.loops)) for face in coast.data.loop_triangles if face.area>1e-12]
    points=[vertex.co.copy() for vertex in coast.data.vertices]
    normals=[normal.vector.copy() for normal in coast.data.corner_normals]
    tree=BVHTree.FromPolygons(points,[face[0] for face in triangles],all_triangles=True)
    # These input bounds enclose the authored undercroft, historical saddle
    # reconstruction AND actual basin recess. The failed control at minY1.9
    # crossed the basin, producing18unjoined edges; it was not admitted.
    lo,hi=Vector((-8.62,-1.60,-2.70)),Vector((8.15,13.20,3.30))
    receipt=restore_original_outside(coast,original,lo,hi,bounded_plane_split=True)
    attribute=coast.data.attributes["Finish exact retained normal"]
    recovered=[]
    for loop in coast.data.loops:
        entry=attribute.data[loop.index]
        if entry.vector.length>=.01:continue
        point=coast.data.vertices[loop.vertex_index].co
        _,_,index,_=tree.find_nearest(point)
        triangle=triangles[index]
        error=triangle_distance(point,[points[i] for i in triangle[0]])
        if error>3e-6:
            raise RuntimeError(f"Normal recovery left its actual retained source triangle:{error}m")
        entry.vector=barycentric_transform(point,*[points[i] for i in triangle[0]],*[normals[i] for i in triangle[1]]).normalized()
        recovered.append({"corner":loop.index,"surfaceDistanceM":error})
    coast.data.normals_split_custom_set([tuple(entry.vector.normalized()) for entry in attribute.data])
    coast.data.attributes.remove(attribute)
    bpy.data.objects.remove(reference,do_unlink=True)
    bpy.data.meshes.remove(original)
    return {"sourceCommit":commit,"sourceSha256":expected,"before":before,
            "after":{"vertices":len(coast.data.vertices),"polygons":len(coast.data.polygons)},
            "splitNormalRecoveries":recovered,"boundedPatch":receipt,
            "scope":"No position/normal/color quantization change. Actual all-surface3um bidirectional and decoded gates remain required."}


def round_sea_closure(scene, config):
    """Thicken the exposed x11 sea-side core closure into a curved rock return.

    This owns the actual flat closure identified in the retained sea render.
    It leaves the separate coast mesh and all occupied x<=8.08m patio intact.
    """
    obj=scene.objects["core__golden coastal sandstone"]
    def deformation(p):
        x,y,z=p
        across=smooth((x-8.30)/2.70)*(1-smooth((x-11.0)/1.80))
        sea=smooth((y-.10)/1.70)*(1-smooth((y-7.0)/1.65))
        height=smooth((z+.26)/1.25)*(1-smooth((z-3.0)/1.20))
        soffit=smooth((z-1.80)/.85)*(1-smooth((z-3.0)/1.20))
        return Vector((x-1.50*across*sea*height,y,z-.35*across*sea*soffit))
    def jacobian(p):
        columns=[]
        for axis in range(3):
            offset=Vector();offset[axis]=.001
            columns.append((deformation(p+offset)-deformation(p-offset))/.002)
        return Matrix(columns).transposed()
    minimum=1.;count=0
    for ix in range(19):
        for iy in range(19):
            for iz in range(19):
                determinant=jacobian(Vector((8.3+4.5*ix/18,.1+8.55*iy/18,-.26+4.46*iz/18))).determinant()
                minimum=min(minimum,determinant);count+=1
    if minimum<.1:raise RuntimeError(f"The physical closure map folds or excessively compresses its source:{minimum}")
    bm=bmesh.new();bm.from_mesh(obj.data)
    before_open=sum(not edge.is_manifold for edge in bm.edges)
    if before_open:raise RuntimeError(f"The original owning core must be closed before rounding:{before_open}")
    layer=bm.loops.layers.float_vector.new("Finish closure normal")
    values=[entry.vector.copy() for entry in obj.data.corner_normals]
    bm.faces.ensure_lookup_table()
    for face in obj.data.polygons:
        for loop,index in zip(bm.faces[face.index].loops,face.loop_indices):loop[layer]=values[index]
    triangulate_actual_render_faces(bm,obj.data,Vector(),Vector(),all_quads=True)
    bm.normal_update()
    faces=[face for face in bm.faces if face.normal.x<-.99 and
           all(abs(v.co.x-11.)<1e-4 for v in face.verts) and
           max(v.co.y for v in face.verts)>.1 and max(v.co.z for v in face.verts)<2.651]
    edges={edge for face in faces for edge in face.edges if edge.calc_length()>.60}
    if not edges:raise RuntimeError("The inspected x11 closure was not found in its actual owning mesh")
    source_faces=len(faces)
    bmesh.ops.subdivide_edges(bm,edges=list(edges),cuts=3,use_grid_fill=True)
    before={v:v.co.copy() for v in bm.verts}
    maximum=0.;moved=0;changed=set()
    for vertex,point in before.items():
        vertex.co=deformation(point)
        distance=(vertex.co-point).length
        maximum=max(maximum,distance);moved+=distance>1e-7
        if distance>1e-7:changed.add(vertex)
    for face in bm.faces:
        for loop in face.loops:
            # Three original corners on a2.56e-6m² seam face at x−12.8
            # already use Blender's zero/automatic normal. They are outside
            # the deformation and must retain their original value exactly.
            if loop.vert not in changed:continue
            value=loop[layer]
            if value.length<.01:raise RuntimeError("Closure subdivision lost a retained source normal")
            loop[layer]=(jacobian(before[loop.vert]).inverted().transposed()@value).normalized()
    nonmanifold=sum(not edge.is_manifold for edge in bm.edges)
    if nonmanifold:raise RuntimeError(f"Curved physical closure opened its owning solid:{nonmanifold}")
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    attribute=obj.data.attributes["Finish closure normal"]
    obj.data.normals_split_custom_set([tuple(entry.vector) for entry in attribute.data])
    obj.data.attributes.remove(attribute)
    receipt={"mesh":obj.name,"inputNativeBounds":{"min":[8.3,.1,-.26],"max":[12.8,8.65,4.2]},
             "identifiedSourcePlaneX":11.,"originalPlanarFaces":source_faces,"subdividedLongEdges":len(edges),
             "movedVertices":moved,"maximumDisplacementM":maximum,"maximumAddedRockThicknessM":1.50,
             "maximumSoffitDropM":.35,"jacobianSamples":count,"minimumJacobianDeterminant":minimum,
             "nonmanifoldEdges":nonmanifold,"unchanged":"Separate retained coast, occupied patio x<=8.08m, gym nativeY<=-.9m and original arrival/public stairs",
             "scope":"Actual source solid deformation. Same-view native/browser image, strict overlap, physical routes and decoded gates remain required."}
    config.setdefault("retreat",{})["curvedSeaClosure"]=receipt
    return receipt


def mass_map(point):
    """Monotone plan deformation; the inhabited <=5.9m section never moves."""
    x, y, z = point
    height = smooth((z - 5.90) / 1.75) * (1 - smooth((z - 10.75) / 2.25))
    front = smooth((y + 5.50) / 2.08)
    if not height or not front:
        return Vector(point)
    projection = (2.15 + .25 * math.cos(x * .30)) * height * front
    # Compress the opening's upper shoulders smoothly; both touching roof
    # partitions receive this same map, so their interfaces stay identical.
    inset = 1.35 * height * front
    if x < -8.43:
        dx = inset * smooth((x + 15.) / (15. - 8.43))
    elif x > 8.08:
        dx = -inset * smooth((15. - x) / (15. - 8.08))
    else:
        u = (x + 8.43) / (8.08 + 8.43)
        dx = inset * (1 - 2 * u)
    return Vector((x + dx, y + projection, z))


def reshape_rock(scene):
    # Group complete retained agave rosettes before moving the underlying roof.
    clusters = {}
    for obj in scene.objects:
        if obj.type != "MESH" or not (obj.name == "core__blue sage agave leaf" or obj.get("roofPlanting")):
            continue
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.verts.ensure_lookup_table()
        for island in components(bm):
            points = [obj.matrix_world @ v.co for v in island]
            low = min(p.z for p in points)
            roots = [p for p in points if p.z < low + .015]
            root = sum(roots, Vector()) / len(roots)
            clusters.setdefault(tuple(round(v, 3) for v in root), []).append((obj, [v.index for v in island], root))
        bm.free()
    if len(clusters) != 32:
        raise RuntimeError(f"Retained rosette inventory changed: {len(clusters)}")
    moved_plants = []
    for entries in clusters.values():
        root = sum((r for _, _, r in entries), Vector()) / len(entries)
        delta = mass_map(root) - root
        if delta.length < 1e-7:
            continue
        for obj, indices, _ in entries:
            local = obj.matrix_world.inverted().to_3x3() @ delta
            for i in indices:
                obj.data.vertices[i].co += local
        moved_plants.append({"rootBefore": list(root), "planTranslation": list(delta), "leaves": len(entries)})
    changed = []
    targets = rock_objects(scene)
    bedding = scene.objects.get("coast_shared_warm sandstone bedding")
    if bedding:
        targets.append(bedding)
    for obj in targets:
        if obj.name=="coast_shared_golden coastal sandstone":
            normal_values=[normal.vector.copy() for normal in obj.data.corner_normals]
            attribute=obj.data.attributes.get("Finish source normal") or obj.data.attributes.new("Finish source normal","FLOAT_VECTOR","CORNER")
            transforms={}
            for vertex in obj.data.vertices:
                point=vertex.co.copy()
                if (mass_map(point)-point).length<1e-7:continue
                columns=[]
                for axis in range(3):
                    offset=Vector();offset[axis]=.001
                    columns.append((mass_map(point+offset)-mass_map(point-offset))/.002)
                transforms[vertex.index]=Matrix(columns).transposed().inverted().transposed()
            for loop,normal,value in zip(obj.data.loops,normal_values,attribute.data):
                transform=transforms.get(loop.vertex_index)
                value.vector=(transform@normal).normalized() if transform else normal
            # Fix the original render diagonals BEFORE any BMesh conversion or
            # normal recalculation can rotate the remote nonplanar quads.
            explicit=bmesh.new();explicit.from_mesh(obj.data)
            triangulate_actual_render_faces(explicit,obj.data,Vector(),Vector(),all_quads=True)
            explicit.to_mesh(obj.data);explicit.free();obj.data.update()
        before_bm = bmesh.new()
        before_bm.from_mesh(obj.data)
        before_open = sum(not e.is_manifold for e in before_bm.edges)
        before_bm.free()
        maximum = 0.
        inverse = obj.matrix_world.inverted()
        for vertex in obj.data.vertices:
            before = obj.matrix_world @ vertex.co
            after = mass_map(before)
            maximum = max(maximum, (after - before).length)
            vertex.co = inverse @ after
        if obj.name=="coast_shared_golden coastal sandstone":
            reference=obj.data.copy();reference.name="Finish mass-mapped coastal normal reference"
            reference.use_fake_user=True;obj["finishNormalReferenceMesh"]=reference.name
        if maximum:
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
            nonmanifold = sum(not e.is_manifold for e in bm.edges)
            bm.to_mesh(obj.data)
            bm.free()
            obj.data.update()
            if nonmanifold != before_open:
                raise RuntimeError(f"Mass deformation changed {obj.name} topology: {before_open} -> {nonmanifold}")
            changed.append({"mesh": obj.name, "maximumDisplacementM": maximum, "nonmanifoldEdgesBefore": before_open,
                            "nonmanifoldEdges": nonmanifold})
    # The exact rendered triangle can differ by a few millimetres from the
    # legacy quad BVH diagonal. Refit a whole retained rosette when that makes
    # its old22mm embed exceed the unchanged25mm prefit limit; never reshape it.
    supports=[]
    for support in scene.objects:
        if support.type=="MESH" and (support.get("caveRoof") or support.get("closedSolid") or support.name in ("core__golden coastal sandstone","coast_shared_golden coastal sandstone")):
            supports.append((support,BVHTree.FromPolygons([support.matrix_world@v.co for v in support.data.vertices],[list(f.vertices) for f in support.data.polygons])))
    refits=[]
    for entries in clusters.values():
        roots=[]
        for obj,indices,_ in entries:
            points=[obj.matrix_world@obj.data.vertices[i].co for i in indices]
            low=min(point.z for point in points)
            points=[point for point in points if point.z<low+.015]
            roots.append(sum(points,Vector())/len(points))
        root=sum(roots,Vector())/len(roots);hits=[]
        for support,tree in supports:
            hit=tree.ray_cast(root+Vector((0,0,.15)),Vector((0,0,-1)),20)[0]
            if hit is not None:hits.append((root.z-hit.z,support,hit))
        gap,support,hit=min(hits,key=lambda row:row[0])
        if -.025<=gap<=.13:continue
        dz=-gap-.022
        if abs(dz)>.015:raise RuntimeError(f"Rosette requires a separately reviewed larger refit: {list(root)} {dz}")
        for obj,indices,_ in entries:
            delta=obj.matrix_world.inverted().to_3x3()@Vector((0,0,dz))
            for index in indices:obj.data.vertices[index].co+=delta
        refits.append({"root":list(root),"nativeSupport":support.name,"previousGapM":gap,"rigidTranslationM":[0,0,dz]})
    from coastal_roof_planting import ground_rosettes
    _, grounding = ground_rosettes(scene)
    return {"changed": changed, "completeRosettesMoved": moved_plants,"triangleContactRefits":refits, "rosetteGrounding": grounding,
            "composition": "A 2.15-2.4m deep curved rock brow and compressed high shoulders; continuous retained solid, not a surface-noise overlay. Floors, room apertures and clifftop routes beyond world Z=5.5 remain fixed."}


def restore_coast_split_normals(obj, working_bounds):
    """Keep the original absolute split normals outside authored working boxes."""
    attribute=obj.data.attributes.get("Finish source normal")
    if attribute is None:raise RuntimeError("Original coastal split normals were lost")
    preserved=[entry.vector.copy() for entry in attribute.data]
    reference=bpy.data.meshes[obj["finishNormalReferenceMesh"]]
    reference.calc_loop_triangles()
    triangles=[triangle for triangle in reference.loop_triangles if triangle.area>1e-12]
    ref_vertices=[vertex.co.copy() for vertex in reference.vertices]
    tree=BVHTree.FromPolygons(ref_vertices,[list(triangle.vertices) for triangle in triangles])
    ref_normals=reference.attributes["Finish source normal"].data
    recovered,max_distance=0,0.
    def source_normal(point):
        nonlocal recovered,max_distance
        from audit_coastal_architecture_finish import triangle_distance
        nearest=tree.find_nearest(point)
        if nearest[0] is None:raise RuntimeError("No original coastal normal support")
        triangle=triangles[nearest[2]]
        positions=[ref_vertices[i] for i in triangle.vertices]
        distance=triangle_distance(point,positions)
        if distance>3e-6:raise RuntimeError(f"A retained corner left its original coastal surface: {list(point)} {distance}m")
        max_distance=max(max_distance,distance);recovered+=1
        a,b,c=[tuple(p) for p in positions]
        sub=lambda u,v:tuple(x-y for x,y in zip(u,v))
        dot=lambda u,v:sum(x*y for x,y in zip(u,v))
        e0,e1,p=sub(b,a),sub(c,a),sub(point,a)
        d00,d01,d11=dot(e0,e0),dot(e0,e1),dot(e1,e1)
        d20,d21=dot(p,e0),dot(p,e1);denominator=d00*d11-d01*d01
        u=(d11*d20-d01*d21)/denominator;v=(d00*d21-d01*d20)/denominator
        values=[ref_normals[i].vector for i in triangle.loops]
        return (values[0]*(1-u-v)+values[1]*u+values[2]*v).normalized()
    obj.data.normals_split_custom_set([(0.,0.,0.)]*len(obj.data.loops))
    geometric=[normal.vector.copy() for normal in obj.data.corner_normals]
    normals=[];outside=0
    for loop,normal,source in zip(obj.data.loops,geometric,preserved):
        point=obj.data.vertices[loop.vertex_index].co
        distances=[]
        for region in working_bounds:
            lo,hi=region["min"],region["max"]
            if all(lo[k]-3e-6<=point[k]<=hi[k]+3e-6 for k in range(3)):
                distances.append(min(min(point[k]-lo[k],hi[k]-point[k]) for k in range(3)))
        if not distances:
            if source.length<.8:source=source_normal(point)
            normals.append(tuple(source));outside+=1
        elif source.length>.8:
            blend=smooth(max(distances)/.08)
            normals.append(tuple((source*(1-blend)+normal*blend).normalized()))
        else:normals.append(tuple(normal))
    obj.data.normals_split_custom_set(normals)
    obj.data.attributes.remove(attribute)
    bpy.data.meshes.remove(reference);del obj["finishNormalReferenceMesh"]
    return {"retainedAbsoluteSourceCorners":outside,"workingBounds":working_bounds,
            "sourceNormalsRecoveredAtSplitCorners":recovered,"maximumReferenceDistanceM":max_distance,
            "method":"Original split normals transformed by the mass map Jacobian; exact outside CSG boxes,80mm blend to geometric normals inside. No normal stream precision reduction."}


def roof_height(zw):
    return 8.95 + 1.65 * smooth((zw - 17.44) / (23.18 - 17.44))


def pavilion(scene, config):
    from coastal_arrival_hall import _heightfield
    m = architecture.materials()
    concrete = _mat("warm board-formed concrete", (.47, .445, .39), .88)
    soil = _mat("pavilion mineral roof soil", (.25, .22, .16), .98)
    leaf = _mat("pavilion native succulent leaf", (.24, .32, .20), .84)
    original_ground = []
    for obj in rock_objects(scene):
        original_ground.append(BVHTree.FromPolygons([obj.matrix_world @ v.co for v in obj.data.vertices],
                                                   [list(p.vertices) for p in obj.data.polygons]))
    def ground(x, zw):
        # Construction samples inside a protected oculus use its real outer
        # rock rim; the earth is then cut clear of the complete light well.
        # Sampling the open shaft's bottom would pull an earth slab through it.
        from coastal_arrival_hall import OCULI
        for cx,cz in OCULI["centers"]:
            d=math.hypot(x-cx,zw-cz)
            if d<.82:
                direction=Vector((x-cx,zw-cz)) if d>1e-6 else Vector((1,0))
                direction.normalize();x,zw=cx+.82*direction.x,cz+.82*direction.y
        hits = [hit.z for tree in original_ground if (hit := tree.ray_cast(Vector((x, -zw, 20)), Vector((0, 0, -1)), 30)[0]) is not None]
        if not hits:
            raise RuntimeError(f"No retained pavilion ground at {x},{zw}")
        return max(hits)
    receipts = []
    # Lower the closed sea end into its real rock; retain 2.3m at the arrival.
    for obj in scene.objects:
        if obj.type != "MESH" or not obj.name.startswith("core_arrival_court__"):
            continue
        if any(m and m.name == "warm cut stone" for m in obj.data.materials):
            removed = edit_islands(obj, lambda lo, hi: inside(lo, hi, (-3.65, -23.31, 10.59), (-1.93, -17.37, 10.81)))
            if removed:
                receipts.append({"mesh": obj.name, "replacedRoof": removed})
        elif "golden coastal sandstone" in obj.name:
            changed = edit_islands(obj, lambda lo, hi: inside(lo, hi, (-3.59, -23.11, 7.55), (-1.99, -17.43, 10.61)),
                lambda p: Vector((p.x, p.y, 7.56 + (p.z - 7.56) * (roof_height(-p.y) - 7.56) / (10.60 - 7.56))))
            if changed:
                receipts.append({"mesh": obj.name, "buriedSideWalls": changed})
        elif "honey ash" in obj.name or "opal diffuser" in obj.name:
            changed = edit_islands(obj, lambda lo, hi: inside(lo, hi, (-3.41, -23.12, 10.49), (-2.19, -17.69, 10.61)),
                lambda p: Vector((p.x, p.y, roof_height(-p.y) + p.z - 10.60)))
            if changed:
                receipts.append({"mesh": obj.name, "slopedSoffit": changed})
    roof = Parts("core_finish_pavilion_roof")
    _heightfield(roof.bm(concrete), -4.05, -1.86, 17.30, 24.00,
                 lambda x, zw: roof_height(zw) + .22, .22, cell=.28)
    roof_objects = roof.finish()
    for obj in roof_objects:
        obj["closedSolid"] = True
        obj["cameraSupport"] = True
        obj["installationGroup"] = "arrival"
    planted = Parts("core_finish_pavilion_planted_roof")
    _heightfield(planted.bm(soil), -3.91, -2.00, 17.52, 23.70,
                 lambda x, zw: roof_height(zw) + .335, .115, cell=.28)
    # Low original rosettes, explicitly distinct from the retained 32 agaves.
    for j in range(10):
        zw = 17.85 + .57 * j
        for i in range(2):
            x = -3.53 + .99 * i + .10 * math.sin(j * 2.1)
            h = roof_height(zw) + .335
            root = Vector((x, -zw, h - .006))
            for k in range(7):
                a = math.tau * k / 7 + j * .37
                tip = root + Vector((.15 * math.cos(a), .15 * math.sin(a), .065 + .022 * (k % 2)))
                rooted_leaf(planted.bm(leaf), planted.bm(leaf), root, root, tip, .027, twig=False)
    plant_objects = planted.finish()
    # The 1.38m garden ribbons remain clear. Three joined rock shoulders meet
    # the real wall faces below the soffit, rather than intersecting the roof.
    berm_objects=[]
    for label,x0,x1,z0,z1 in (("west",-4.35,-3.58,17.05,23.13),
                              ("east",-2.00,-1.13,17.05,22.50),
                              ("sea",-3.58,-2.00,17.05,17.44)):
        berm=Parts("core_finish_pavilion_rock_shoulder_"+label)
        bm=berm.bm(bpy.data.materials.get("La Jolla bluff sandstone") or m["rock"])
        nx,nz=max(4,math.ceil((x1-x0)/.14)),max(3,math.ceil((z1-z0)/.19))
        top,bottom={},{}
        for i in range(nx+1):
            x=x0+(x1-x0)*i/nx
            for j in range(nz+1):
                zw=z0+(z1-z0)*j/nz;g=ground(x,zw)
                across=smooth(i/nx) if label=="west" else 1-smooth(i/nx) if label=="east" else 1.
                land=1-smooth((zw-22.8)/.33) if label=="west" else 1-smooth((zw-22.1)/.4) if label=="east" else 1.
                weight=across*smooth((zw-17.05)/.39)*land
                height=g+weight*max(0.,roof_height(zw)-.015-g)
                top[i,j]=bm.verts.new((x,-zw,height));bottom[i,j]=bm.verts.new((x,-zw,g-.022))
        for i in range(nx):
            for j in range(nz):
                bm.faces.new((top[i,j],top[i+1,j],top[i+1,j+1],top[i,j+1]))
                bm.faces.new((bottom[i,j+1],bottom[i+1,j+1],bottom[i+1,j],bottom[i,j]))
        for i in range(nx):
            for j in (0,nz):bm.faces.new((top[i,j],top[i+1,j],bottom[i+1,j],bottom[i,j]))
        for j in range(nz):
            for i in (0,nx):bm.faces.new((top[i,j],top[i,j+1],bottom[i,j+1],bottom[i,j]))
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        objects=berm.finish()
        if label=="east":
            from coastal_arrival_hall import OCULI
            for index,(cx,cz) in enumerate(OCULI["centers"]):
                tool=Parts("temporary protected light well")
                cylinder(tool.bm(m["rock"]),(cx,-cz,-10),(cx,-cz,20),.76,64)
                cutter=tool.finish()[0]
                for obj in objects:tool_difference(obj,cutter)
                bpy.data.objects.remove(cutter,do_unlink=True)
        berm_objects+=objects
    for obj in plant_objects + berm_objects:
        obj["installationGroup"] = "garden"
        if "succulent leaf" in obj.name:
            obj["flora"] = True
        if obj in berm_objects:
            obj["cameraSupport"] = True
    for line in config["installationLines"]:
        if line["id"] == "portal-brow":
            for key in ("a", "b"):
                line[key][1] = roof_height(line[key][2]) - .09
    return {"changed": receipts, "roof": [o.name for o in roof_objects], "plantedRoof": [o.name for o in plant_objects],
            "rockShoulder": [o.name for o in berm_objects], "roofSeaHeight": roof_height(17.44), "roofArrivalHeight": roof_height(23.18),
            "overhangsM": {"west": .47, "arrival": .82},
            "buriedFaces":["west","east","closed sea end"],"protectedLightWellRadiusM":.76,
            "preserved": "oculi, three flights, pivot door, forecourt walking surface and both original garden path ribbons"}


def cantilever(scene, config):
    m = architecture.materials()
    concrete = _mat("warm board-formed concrete", (.47, .445, .39), .88)
    # A curved undercroft removes the retained rock directly below the forward
    # span; the cantilever is real, rather than a label on a slab fully on rock.
    profile = [(2.05, -.22), (5.00, -.22)]
    profile += [(5.00 - 2.95 * t, -1.95 - .35 * t - .40 * math.sin(math.pi * t)) for t in (k / 16 for k in range(17))]
    tool = shell._prism("curved cantilever undercroft", profile, "x", -8.56, 8.08, m["rock"])
    cuts = [tool_difference(obj, tool) for obj in rock_objects(scene)]
    bpy.data.objects.remove(tool, do_unlink=True)
    # Recover only the old terrace's cut volume from its exact public pre-estate
    # coast. Shape a low saddle inside that retained exterior silhouette; all
    # current source outside this box remains authoritative and unchanged.
    from coastal_arrival_hall import _heightfield
    root = Path(__file__).resolve().parents[1]
    historical_commit = "7fe95cbfcad7d578e05e1e549ab43c8e0773142d"
    historical_sha256 = "d65abc2178c175a00f09334c4929dbeff91db70b84c782c85a44a7ed3f5a760f"
    source = root / ".jekyll-cache/visual-qa/finish-house-2026-10-26/baseline/pre-estate-cliff.blend"
    if not source.exists():
        source.parent.mkdir(parents=True, exist_ok=True)
        with source.open("wb") as handle:
            subprocess.run(["git", "show", historical_commit + ":artwork/coastal-home/coastal-home.blend"],
                           stdout=handle, check=True, cwd=root)
    if hashlib.sha256(source.read_bytes()).hexdigest() != historical_sha256:
        raise RuntimeError("The retained pre-estate native source does not match its public Git blob")
    with bpy.data.libraries.load(str(source), link=False) as (data_from, data_to):
        if "coast_shared_golden coastal sandstone" not in data_from.objects:
            raise RuntimeError("The retained coast object is absent from its historical source")
        data_to.objects = ["coast_shared_golden coastal sandstone"]
    reference = data_to.objects[0]
    scene.collection.objects.link(reference)
    reference.name = "temporary pre-estate coast reference"
    patch = Parts("coast_finish_recontoured_terrace_notch")
    def shoulder(x, zw):
        u = (x + 8.39) / (8.39 - 4.90)
        y = -zw
        low = -.70 - 1.10 * smooth((y - 4.58) / 4.6)
        side = smooth(abs(2 * u - 1)) * smooth((y - 5.0) / 1.2)
        return low + side * (3.15 - low)
    _heightfield(patch.bm(bpy.data.materials.get("La Jolla bluff sandstone") or m["rock"]),
                 -8.49, -4.80, -13.03, -4.48, shoulder, None, cell=.22, soffit=-2.05)
    patch_objects = patch.finish()
    for obj in patch_objects:
        exact_set_boolean(obj, reference, "INTERSECT")
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
        bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        if any(not e.is_manifold for e in bm.edges):
            raise RuntimeError("The historical silhouette / saddle intersection is not closed")
        bm.to_mesh(obj.data)
        bm.free()
        obj["closedSolid"] = True
        # The missing volume meets the old cut planes exactly. A set union
        # removes those internal coincident faces; difference-by-an-adjacent
        # shell emitted duplicate caps in retained v11/v12 failures.
        retained=scene.objects["coast_shared_golden coastal sandstone"]
        reconstruction_union=union_preserving_components(retained,obj)
        rock_material=bpy.data.materials.get("La Jolla bluff sandstone") or m["rock"]
        if rock_material not in list(retained.data.materials):retained.data.materials.append(rock_material)
        rock_index=list(retained.data.materials).index(rock_material)
        for face in retained.data.polygons:
            point=retained.matrix_world@face.center
            if -8.392<=point.x<=-4.898 and 4.578<=point.y<=12.932 and -1.952<=point.z<=3.152:
                face.material_index=rock_index
        bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.objects.remove(reference, do_unlink=True)
    eased = 0  # The smooth saddle has no obsolete sharp box rim to bevel.
    # The original basin's closed 36cm structural shell becomes exposed. Keep
    # every mosaic, coping, drain, water and entry tread exactly where authored.
    structural = []
    for obj in scene.objects:
        if obj.name.startswith("core_estate_pool__warm cut stone"):
            obj.data.materials.clear()
            obj.data.materials.append(concrete)
            structural.append(obj.name)
    # The retained infinity face was only a thin mosaic skin. A real 180mm
    # concrete front wall, carried by the 360mm basin base, closes a box girder.
    # The channel above it stays open around the original charcoal catch trough.
    # Millimetre-deep horizontal form-board joints are modeled, not a label.
    front = [(3.72, -1.474), (3.90, -1.474)]
    for h in (-1.28, -1.10, -.92, -.74, -.56, -.38):
        front += [(3.90, h-.002), (3.896, h-.001), (3.896, h+.001), (3.90, h+.002)]
    front += [(3.90, -.10), (3.88, -.10), (3.88, -.18), (3.74, -.18), (3.74, -.11), (3.72, -.11)]
    front_wall = shell._prism("core_finish_pool_front_box_girder", front, "x", -7.8, 3.0, concrete)
    front_wall["closedSolid"] = True
    front_wall["installationGroup"] = "exterior"
    ribs = Parts("core_finish_terrace_structure")
    for x in (4.75, 7.40):
        box(ribs.bm(concrete), (x, .62, -.435), (.18, 8.02, .39), .018, segments=3)
    ribs_objects = ribs.finish()
    for obj in ribs_objects:
        obj["installationGroup"] = "exterior"
    wash = Parts("core_finish_cantilever_wash")
    box(wash.bm(m["light"]), (-2.40, 3.89, -1.845), (10.15, .02, .015), .003)
    lights = wash.finish()
    for obj in lights:
        obj["installationGlow"] = "cantilever-wash"
    config["installationLines"].append({"id": "cantilever-wash", "a": [-7.475, -1.845, -3.89], "b": [2.675, -1.845, -3.89],
        "intensity": .14, "schedule": "festoon", "transport": False, "glowTag": "cantilever-wash",
        "region": {"min": [-8.3, -6.5, -7.5], "max": [3.4, -.25, -1.8]}})
    terrace = config["estateOutdoors"]["terrace"]
    terrace["structure"] = {"bearingNativeY": 2.05, "patioFrontNativeY": 4.80, "poolLipNativeY": 3.65,
        "poolCantileverM": 1.60, "patioCantileverM": 2.75, "backspanM": 5.47,
        "basinStructuralDepthM": .36, "eastDeckRibDepthM": .39,
        "frontConcreteWallHeightM": 1.374, "boxGirderDepthM":1.724, "frontWallThicknessM": .18,
        "materials": ["warm board-formed concrete", "sandstone", "travertine"],
        "status": "Geometric architectural scheme with native bearing and clearance receipts; not an engineering certification"}
    terrace["structuralStatus"] = "Inset backspan and real 1.6m pool / 2.75m patio projection on exposed basin shell and deck ribs; no engineering certification"
    normal_bounds=[row["boundedPatch"]["nativeBounds"] for row in cuts if row.get("mesh")=="coast_shared_golden coastal sandstone" and row.get("boundedPatch")]
    normal_bounds.append(reconstruction_union["boundedPatch"]["nativeBounds"])
    normal_receipt=restore_coast_split_normals(scene.objects["coast_shared_golden coastal sandstone"],normal_bounds)
    return {"cuts": cuts, "exposedBasin": structural, "frontBoxGirder": front_wall.name, "ribs": [o.name for o in ribs_objects],
            "closedLegacyNotch": ["coast_shared_golden coastal sandstone"], "legacyNotchRimsRounded": eased,
            "reconstructedSource": {"commit": historical_commit, "sha256": historical_sha256,
                                    "nativeRegion": {"min": [-8.39,4.58,-1.95], "max": [-4.90,12.93,3.15]},
                                    "bedrockEmbedM": .10,
                                    "sideEmbedM": .10,
                                    "method": "Historical coast intersected with a smooth saddle volume, then exact set union with the current coast. Current house and all geometry outside the bounded obsolete cut remain authoritative."},
            "islandPreservation":reconstruction_union,
            "splitNormals":normal_receipt,
            "scheme": terrace["structure"]}


def build(scene, config):
    return {"rockComposition": reshape_rock(scene), "pavilion": pavilion(scene, config), "cantilever": cantilever(scene, config)}


def fit_structure(scene, config):
    """Fit the actual ribs/basin/liner interfaces instead of hiding overlaps."""
    from coastal_architecture_finish import remove_prefixes
    coast = scene.objects["coast_shared_golden coastal sandstone"]
    values = [entry.vector.copy() for entry in coast.data.corner_normals]
    attribute = coast.data.attributes.new("Finish source normal", "FLOAT_VECTOR", "CORNER")
    for entry, value in zip(attribute.data, values):
        entry.vector = value
    reference = coast.data.copy()
    reference.name = "Finish mass-mapped coastal normal reference"
    reference.use_fake_user = True
    coast["finishNormalReferenceMesh"] = reference.name
    pool = scene.objects["core_estate_pool__warm cut stone"]
    lo, hi = bounds([pool.matrix_world @ vertex.co for vertex in pool.data.vertices])
    # Preserve the existing measured -1.72m bearing and its104mm base embed.
    # The old cut was narrower than the actual closed structural shell, so
    # its side/back corners deeply occupied untouched rock.
    cut_lo = Vector((lo.x-.01,lo.y-.01,-1.72))
    cut_hi = Vector((hi.x+.01,hi.y+.01,hi.z+.025))
    cutter = shell._box_object("actual basin shell rock recess",cut_lo,cut_hi,bpy.data.materials["warm cut stone"])
    directory = Path(os.environ["COASTAL_ARCHITECTURE_ATTEMPT"])
    construction = {"beforeSourceOperation":True,"nativeBounds":{"min":list(cut_lo),"max":list(cut_hi)},
                    "workingMarginM":.02,"existingBearingNativeZ":-1.72,"basinBaseEmbedM":-1.72-lo.z,
                    "actualBasinBounds":{"min":list(lo),"max":list(hi)}}
    (directory/"bearing-recess-input.json").write_text(json.dumps(construction,indent=2)+"\n",encoding="utf-8",newline="\n")
    cavity = tool_difference(coast,cutter)
    bpy.data.objects.remove(cutter,do_unlink=True)
    normals = restore_coast_split_normals(coast,[cavity["boundedPatch"]["nativeBounds"]])
    retired = remove_prefixes(scene,("core_finish_terrace_structure__",))
    concrete = bpy.data.materials["warm board-formed concrete"]
    ribs = Parts("core_finish_terrace_structure")
    for x in (4.75,7.40):
        box(ribs.bm(concrete),(x,3.33,-.435),(.18,2.60,.39),.018,segments=3)
    made = ribs.finish()
    for obj in made:
        obj["installationGroup"] = "exterior"
    front = scene.objects["core_finish_pool_front_box_girder"]
    shifted = 0
    for vertex in front.data.vertices:
        if abs(vertex.co.y-3.88)<1e-5:
            vertex.co.y = 3.885
            shifted += 1
    wall = scene.objects["core_finish_corridor_niche_wall__chalk limestone"]
    if min(vertex.co.y for vertex in wall.data.vertices) < -9.73:
        for vertex in wall.data.vertices:
            if vertex.co.y < -9.70:
                vertex.co.y = -9.70+(vertex.co.y+9.70)*.25
    for obj in scene.objects:
        if obj.name.startswith("core_finish_bedchamber_vault__"):
            for vertex in obj.data.vertices:
                if vertex.co.z>5.10:
                    vertex.co.z=5.10+(vertex.co.z-5.10)*(.04/.069)
    for obj in [front,wall,*made]:
        obj.data.update()
    config["estateOutdoors"]["terrace"]["structure"].update({"exposedRibNativeY":[2.03,4.63],
        "ribBearingEmbedM":.02,"basinBearingNativeZ":-1.72,"basinBaseEmbedM":construction["basinBaseEmbedM"],
        "basinSideRockClearanceM":.01,"frontUpperLipShadowJointM":.005})
    return {"basinRecess":cavity,"recessInput":construction,"retiredRibs":retired,
            "ribs":[obj.name for obj in made],"frontLipVerticesMoved":shifted,
            "nicheLinerBackNativeY":-9.72,"vaultOuterTopNativeZ":5.14,"splitNormals":normals}


def fit_small_interfaces(scene, config):
    """Leave no new duplicate slab volume or concrete inside the real trough."""
    stone = scene.objects["core_finish_bedroom_spiral_base__warm cut stone"]
    existing = scene.objects["core_retreat_library__warm cut stone"]
    shell.boolean(stone, existing, "DIFFERENCE")
    if shell.clean_solid(stone):
        raise RuntimeError("Fitted spiral foundation is not a closed solid")
    old = scene.objects["core_finish_pool_front_box_girder"]
    bpy.data.objects.remove(old, do_unlink=True)
    # A full25cm wall with a real180mm-wide trough recess. Its floor meets
    # the existing trough underside; its two sides keep5mm clear of it.
    profile = [(3.65,-1.474),(3.90,-1.474)]
    for h in (-1.28,-1.10,-.92,-.74,-.56,-.38):
        profile += [(3.90,h-.002),(3.896,h-.001),(3.896,h+.001),(3.90,h+.002)]
    profile += [(3.90,-.10),(3.885,-.10),(3.885,-.18),(3.695,-.18),(3.695,-.11),(3.65,-.11)]
    front = shell._prism("core_finish_pool_front_box_girder",profile,"x",-7.8,3.0,bpy.data.materials["warm board-formed concrete"])
    front["closedSolid"] = True
    front["installationGroup"] = "exterior"
    structure = config["estateOutdoors"]["terrace"]["structure"]
    structure["frontWallThicknessM"] = .25
    structure["troughRecessNativeY"] = [3.695,3.885]
    structure["troughBearingNativeZ"] = -.18
    return {"spiralFoundation":"Exact difference from retained library stone; original lower floor stays authoritative",
            "frontGirder":front.name,"wallThicknessM":.25,"troughRecessNativeY":[3.695,3.885],
            "troughBearingNativeZ":-.18,"retained":"Every original trough, coping, mosaic, water and seven pool-entry tread"}


def fit_pool_liner_face(scene, config):
    """Place the concrete behind the retained mosaic's actual wet face."""
    obj = scene.objects["core_finish_pool_front_box_girder"]
    moved = 0
    for vertex in obj.data.vertices:
        if abs(vertex.co.y-3.65) < 1e-6:
            vertex.co.y = 3.665
            moved += 1
    if moved != 4:
        raise RuntimeError(f"Expected four inner girder corners, found{moved}")
    obj.data.update()
    if shell.clean_solid(obj):
        raise RuntimeError("Fitted concrete front is not a closed solid")
    config["estateOutdoors"]["terrace"]["structure"]["frontWallThicknessM"] = .235
    return {"mesh": obj.name, "movedVertices": moved, "mosaicWetFaceNativeY": 3.65,
            "concreteInnerFaceNativeY": 3.665, "liningThicknessM": .015,
            "wallThicknessM": .235, "retained": "Actual mosaic, trough, overflow, coping and bearing remain fixed"}
