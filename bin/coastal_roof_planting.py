"""Give roof-supported agaves the visibility ownership of their actual rock roof.

Leaf cards are open surfaces. Partition complete connected islands without
cutting them or turning leaves into physical roof meshes. The separate grounding
pass translates whole rosettes onto their actual support without reshaping leaves.
"""
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import coastal_shell as shell

VERSION = 1


def partition(scene):
    if scene.get("roofPlantingVersion") == VERSION:
        return [], {"retained": True, "version": VERSION}
    obj = bpy.data.objects.get("core__blue sage agave leaf")
    if obj is None:
        raise RuntimeError("Missing retained native agave batch")
    trees = []
    for support in scene.objects:
        if support.type != "MESH" or not (support.get("caveRoof") or support.get("closedSolid") or
                support.name in ("core__golden coastal sandstone", "coast_shared_golden coastal sandstone")):
            continue
        tree = BVHTree.FromPolygons([support.matrix_world @ v.co for v in support.data.vertices],
                                    [list(f.vertices) for f in support.data.polygons])
        trees.append((support, tree))
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    owners, contacts = {}, []
    for island in shell._islands(bm):
        points = [obj.matrix_world @ v.co for v in island]
        bottom = min(p.z for p in points)
        roots = [p for p in points if p.z < bottom + .015]
        root = sum(roots, Vector()) / len(roots)
        hits = []
        for support, tree in trees:
            hit, _, _, _ = tree.ray_cast(root + Vector((0, 0, .12)), Vector((0, 0, -1)), 20)
            if hit is not None:
                hits.append((root.z - hit.z, support, hit))
        if not hits:
            raise RuntimeError(f"Agave leaf lost native ground at {list(root)}")
        drop, support, hit = min(hits, key=lambda h: h[0])
        if drop > .13 or drop < -.03:
            raise RuntimeError(f"Unsupported agave root at {list(root)}: {support.name}, gap {drop}")
        roof = support.name if support.get("caveRoof") else None
        contacts.append({"root": list(root), "support": support.name, "gap": drop, "roof": bool(roof)})
        if roof:
            owners.setdefault(roof, set()).update(v.index for v in island)
    all_roof = set().union(*owners.values()) if owners else set()
    created = []
    for name, chosen in owners.items():
        group = obj.copy()
        group.data = obj.data.copy()
        group.name = group.data.name = "core_retreat_roof_planting__" + name
        scene.collection.objects.link(group)
        part = bmesh.new()
        part.from_mesh(group.data)
        part.verts.ensure_lookup_table()
        bmesh.ops.delete(part, geom=[v for v in part.verts if v.index not in chosen], context="VERTS")
        part.to_mesh(group.data)
        part.free()
        group["cutawayVegetationSupport"] = name
        group["roofPlanting"] = True
        # No caveRoof/closedSolid flag: plant cards must never become a roof airwall.
        created.append(group)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index in all_roof], context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    scene["roofPlantingVersion"] = VERSION
    return created, {"version": VERSION, "leaves": len(contacts), "roofLeaves": sum(bool(q["roof"]) for q in contacts),
                     "groundLeaves": sum(not q["roof"] for q in contacts),
                     "nodes": [{"name": o.name, "support": o["cutawayVegetationSupport"],
                                "vertices": len(o.data.vertices), "faces": len(o.data.polygons)} for o in created],
                     "contacts": contacts, "positionsChanged": False}


def ground_rosettes(scene, embed=.022):
    """Translate each complete rosette onto its measured support, without reshaping leaves."""
    objects=[o for o in scene.objects if o.type=='MESH' and
             (o.name=='core__blue sage agave leaf' or o.get('roofPlanting'))]
    supports=[]
    for support in scene.objects:
        if support.type=='MESH' and (support.get('caveRoof') or support.get('closedSolid') or
                support.name in ('core__golden coastal sandstone','coast_shared_golden coastal sandstone')):
            supports.append((support,BVHTree.FromPolygons([support.matrix_world@v.co for v in support.data.vertices],
                                                        [list(f.vertices) for f in support.data.polygons])))
    groups={}
    for obj in objects:
        bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table()
        for island in shell._islands(bm):
            points=[obj.matrix_world@v.co for v in island]
            bottom=min(p.z for p in points)
            roots=[p for p in points if p.z<bottom+.015]
            root=sum(roots,Vector())/len(roots)
            key=tuple(round(q,3) for q in root)
            groups.setdefault(key,[]).append((obj,[v.index for v in island],root))
        bm.free()
    if len(groups)!=32:raise RuntimeError(f'Expected 32 complete retained rosettes, found {len(groups)}')
    records=[];maximum_error=0
    for entries in groups.values():
        root=sum((item[2] for item in entries),Vector())/len(entries)
        hits=[]
        for support,tree in supports:
            hit=tree.ray_cast(root+Vector((0,0,.15)),Vector((0,0,-1)),20)[0]
            if hit is not None:hits.append((root.z-hit.z,support,hit))
        gap,support,hit=min(hits,key=lambda q:q[0])
        if not -.025<=gap<=.13:raise RuntimeError(f'Unexpected rosette contact {list(root)}: {gap}')
        dz=-gap-embed
        owners={obj.get('cutawayVegetationSupport') for obj,_,_ in entries}
        expected=support.name if support.get('caveRoof') else None
        if owners!={expected}:raise RuntimeError(f'Rosette support ownership changed: {owners} != {expected}')
        count=0
        for obj,indices,_ in entries:
            local=obj.matrix_world.inverted().to_3x3()@Vector((0,0,dz))
            for index in indices:
                vertex=obj.data.vertices[index];before=obj.matrix_world@vertex.co
                vertex.co+=local
                error=((obj.matrix_world@vertex.co)-before-Vector((0,0,dz))).length
                maximum_error=max(maximum_error,error);count+=1
        new_root=root+Vector((0,0,dz))
        new_hit=next(t for o,t in supports if o==support).ray_cast(new_root+Vector((0,0,.15)),Vector((0,0,-1)),20)[0]
        new_gap=new_root.z-new_hit.z
        if not -embed-.002<=new_gap<=-embed+.002:raise RuntimeError(f'Grounded rosette floats: {new_gap}')
        records.append({'rootBefore':list(root),'rootAfter':list(new_root),'support':support.name,
                        'roofOwner':expected,'leaves':len(entries),'vertices':count,
                        'oldGap':gap,'newGap':new_gap,'translation':[0,0,dz]})
    for obj in objects:obj.data.update()
    if maximum_error>3e-6:raise RuntimeError(f'Leaf relative geometry changed: {maximum_error}')
    scene['agaveGroundingVersion']=1
    return objects,{'version':1,'rosettes':len(groups),'embed':embed,'contacts':records,
                    'maximumRigidTranslationError':maximum_error,'positionsChanged':True,
                    'shapeMaterialAndRoofOwnershipPreserved':True}
