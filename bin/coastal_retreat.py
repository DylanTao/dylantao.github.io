"""Inland retreat revision of Sirui's inhabited coastal section.

Native Blender metres, +Y to the Pacific, +Z up. This is a migration from the
retained October 24 source, not a second independent house. Geometry, authored
contacts and supports move together; the mainland, coast, wildlife and hinterland
remain in their measured world coordinates. Refresh against a pristine retained
source. Applying twice to the same migrated scene is an explicit no-op.
"""
import copy
import json
import math
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree

import coastal_shell as shell
import coastal_sunken as sunken
from coastal_landscape import web
from coastal_office import Parts, box, cylinder
import coastal_estate_architecture as library

VERSION = 1
SETBACK = 8.0
WORKSTATION = (-10.4, 6.7, -2.6)
LIBRARY = {"x": (-12.55, -8.55), "y": (-2.5, 7.15), "floor": 0., "ceiling": 5.65}
SPIRAL = {"center": (-10.5, -.80), "inner": .19, "outer": 1.20,
          "count": 16, "rise": 2.6, "start": math.pi*.55, "sweep": math.pi*1.45}


def _move(obj, delta):
    obj.location += Vector(delta)


def _remove_prefixes(scene, prefixes):
    removed=[]
    for obj in list(scene.objects):
        if obj.name.startswith(prefixes):
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    return removed


def _point(value, delta):
    return [round(value[k]+delta[k], 6) for k in range(3)]


def _translate_tree(value, delta, key=""):
    """Translate a spatial manifest branch, with explicit non-position fields.

    Colours, direction vectors, sizes and relative drop offsets are untouched.
    A vector translation is deliberately never run over terrain/habitat branches.
    """
    vectors={"axis", "cone", "color", "colour", "size", "step", "alternate", "normal",
             "restDirection", "direction", "dimensions", "scale", "rotation"}
    if key in vectors:
        return copy.deepcopy(value)
    if isinstance(value, list):
        if len(value)==3 and all(isinstance(q,(int,float)) for q in value):
            return _point(value,delta)
        return [_translate_tree(q,delta,key) for q in value]
    if isinstance(value,dict):
        return {k:_translate_tree(v,delta,k) for k,v in value.items()}
    return value


def _spatial_manifest(config):
    delta=(0,0,SETBACK)
    keys=("rooms", "wallArt", "companion", "equipment", "interiorLights", "furniture",
          "fireplace", "terrace", "infinityPool", "estateDoors", "estateLibrary", "lightWell",
          "lightTransportRegions", "installationReceivers", "installationLines", "installationPoints")
    for key in keys:
        if key in config:
            config[key]=_translate_tree(config[key],delta)
    for point in config.get("installationPoints",[]):
        if point.get("id","").startswith("garden-"):
            point["position"]=_point(point["position"],(0,0,-SETBACK))
            if point.get("region"):point["region"]=_translate_tree(point["region"],(0,0,-SETBACK))
    # Scalar coordinate fields are distinct from dimensions and direction values.
    config["facade"]["planeZ"]+=SETBACK
    config["cameraCollision"]["facade"]["planeZ"]+=SETBACK
    for key in ("upperAisleZ","lowerAisleZ"):
        config["navigation"][key]+=SETBACK
    for key in ("stairs","lowerStairApproach"):
        config["navigation"][key]=[_point(q,delta) for q in config["navigation"][key]]
    config["views"]["overview"]["target"]=_point(config["views"]["overview"]["target"],delta)
    # Outside remains a coastal view and now aims between the inset mouth and shore.
    config["views"]["outside"]["target"][2]+=SETBACK*.45
    # This collection contains only source-authored house/deck supports. Coastal
    # habitats/perches live in separate terrain branches and are never moved.
    for support in config["terrain"]["supportSurfaces"]:
        support["polygon"]=[[q[0],round(q[1]+SETBACK,5)] for q in support["polygon"]]
    config["terrain"]["contacts"]=_translate_tree(config["terrain"]["contacts"],delta)
    config["cameraCollision"]["walls"]=_translate_tree(config["cameraCollision"]["walls"],delta)
    # Native outdoor metadata intentionally uses source-Z-up bounds, unlike room
    # vectors. Shift its authored bounds explicitly instead of guessing by length.
    outdoors=config["estateOutdoors"]
    for name in ("terrace","pool","pavilion"):
        bounds=outdoors[name]["bounds"]
        bounds["y"]=[q-SETBACK for q in bounds["y"]]
    outdoors["terrace"].update(piers=[],edgeDepthMetres=.24,
                                structuralStatus="Inset into retained native rock; no engineering certification")
    outdoors["pool"]["bounds"]["laneBack"]-=SETBACK
    for zone in config.get("infinityPool",{}).get("zones",[]):
        if len(zone.get("bounds",[]))==4:
            zone["bounds"][2]-=SETBACK;zone["bounds"][3]-=SETBACK
    for key in ("lights","strips","pendants","wetBarLight","lighting"):
        if key in outdoors["pavilion"]:
            outdoors["pavilion"][key]=_translate_tree(outdoors["pavilion"][key],delta)
    for key in ("zones","submergedSeats","chaiseContacts"):
        if key in outdoors["pool"]:
            # These are descriptive native records, retained as pre-setback source
            # data in the review; the runtime consumes infinityPool.
            outdoors["pool"]["source"+key[0].upper()+key[1:]]=outdoors["pool"].pop(key)


def _light_regions(config):
    """Native room bounds replace obsolete two-floor and long-corridor regions."""
    receiver=config["installationReceivers"]["groups"]
    receiver={k:v for k,v in receiver.items() if not k.startswith("gallery") and k not in ("library-upper","architecture")}
    receiver["library"]={"min":[-12.65,-.08,-7.25],"max":[-8.35,5.7,2.65]}
    receiver["gallery"]=[{"min":[-9.9,-.08,.20],"max":[-3.75,5.2,1.85]}]
    receiver["architecture"]=[receiver["living"],receiver["upper"],receiver["library"],*receiver["gallery"]]
    # Exterior's first court region follows the house; its second garden region
    # stays attached to real retained terrain and needs precompensation.
    if isinstance(receiver.get("exterior"),list) and len(receiver["exterior"])>1:
        receiver["exterior"][1]=_translate_tree(receiver["exterior"][1],(0,0,-SETBACK))
    config["installationReceivers"]["groups"]=receiver
    config["lightTransportRegions"]=[q for q in config.get("lightTransportRegions",[]) if not q.get("id","").startswith("library-link-")]
    config["lightTransportRegions"] += [{"id":"retreat-library","min":[-12.65,-.08,-7.25],"max":[-8.35,5.7,2.65]},
                                        {"id":"retreat-short-link","min":[-9.9,-.08,.20],"max":[-3.75,5.2,1.85]}]
    lines=[{"id":"tall-books-west","a":web((-12.19,-2.15,4.72)),"b":web((-12.19,2.65,4.72)),"intensity":.72},
           {"id":"tall-books-east","a":web((-8.91,4.65,4.72)),"b":web((-8.91,6.75,4.72)),"intensity":.62}]
    config["installationLines"].append({"id":"short-bedroom-link","a":web((-8.95,-1.65,4.85)),"b":web((-4.0,-1.65,4.85)),"intensity":.40,
                                        "schedule":"steps","region":receiver["gallery"][0],"transport":True,"glowTag":"short-bedroom-link"})
    for room in config["rooms"]:
        if room["id"]=="library":room["lighting"]={"lines":lines,"visits":["study","library"]}


def _geology(scene):
    return [o for o in scene.objects if o.type=="MESH" and
            (o.name in ("core__golden coastal sandstone","coast_shared_golden coastal sandstone") or o.get("closedSolid"))]


def _cut(scene, name, lo, hi, material, include_coast=True):
    cutter=shell._box_object(name,lo,hi,material)
    reports=[]
    for obj in _geology(scene):
        if not include_coast and obj.name=="coast_shared_golden coastal sandstone":
            continue
        if obj==cutter:
            continue
        result=shell.boolean_preserving_islands(obj,cutter)
        if not result.get("skippedDisjoint"):
            reports.append({"mesh":obj.name,**result})
    bpy.data.objects.remove(cutter,do_unlink=True)
    return reports


def _curved_tunnel(scene,centers,material):
    """One closed sweep, avoiding dozens of redundant mainland Booleans."""
    first=Vector(centers[0]);last=Vector(centers[-1])
    back=(first-Vector(centers[1]));back.z=0;back.normalize()
    forward=(last-Vector(centers[-2]));forward.z=0;forward.normalize()
    centers=[tuple(first+back*.32)]+centers+[tuple(last+forward*.32)]
    bm=bmesh.new();rings=[]
    for k,q in enumerate(centers):
        a=centers[max(0,k-1)];b=centers[min(len(centers)-1,k+1)]
        tangent=Vector((b[0]-a[0],b[1]-a[1],0)).normalized()
        side=Vector((-tangent.y,tangent.x,0))*1.02
        base=Vector(q)
        rings.append([bm.verts.new(base+side+Vector((0,0,-.22))),
                      bm.verts.new(base-side+Vector((0,0,-.22))),
                      bm.verts.new(base-side+Vector((0,0,2.75))),
                      bm.verts.new(base+side+Vector((0,0,2.75)))])
    bm.faces.new(list(reversed(rings[0])));bm.faces.new(rings[-1])
    for a,b in zip(rings,rings[1:]):
        for k in range(4):bm.faces.new((a[k],a[(k+1)%4],b[(k+1)%4],b[k]))
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    data=bpy.data.meshes.new("retreat curved stair cutter");bm.to_mesh(data);bm.free()
    data.materials.append(material)
    cutter=bpy.data.objects.new(data.name,data);scene.collection.objects.link(cutter)
    reports=[]
    targets=_geology(scene)+[o for o in scene.objects if o.type=="MESH" and o.name.startswith("core_estate_garden") and not o.get("flora")]
    for obj in targets:
        result=shell.boolean_preserving_islands(obj,cutter)
        if not result.get("skippedDisjoint"):reports.append({"mesh":obj.name,**result})
    bpy.data.objects.remove(cutter,do_unlink=True)
    _clear_stair_foliage(scene,centers,1.10)
    return reports


def _clear_stair_foliage(scene,centers,radius):
    """Retire complete leaf/stem islands at a carved void; never Boolean cards."""
    result=[]
    for obj in scene.objects:
        if not obj.name.startswith("core_estate_garden") or not obj.get("flora"):
            continue
        def keep(lo,hi):
            if any(lo.x-radius<=q[0]<=hi.x+radius and lo.y-radius<=q[1]<=hi.y+radius for q in centers):
                return False
            return None
        _,count=shell.edit_islands(obj,keep)
        result.append({"mesh":obj.name,"removedPlantIslands":count})
    return result


def _partition_roof(scene,m):
    """The added inland roof is an actual part of the native mainland solid."""
    mainland=bpy.data.objects["core__golden coastal sandstone"]
    cutter=shell._box_object("retreat inhabited roof partition",(-12.80,-16.1,5.83),(11.25,-3.43,26),m["rock"])
    roof=mainland.copy();roof.data=mainland.data.copy();scene.collection.objects.link(roof)
    shell.boolean(roof,cutter,"INTERSECT")
    shell.boolean_preserving_islands(mainland,cutter)
    bpy.data.objects.remove(cutter,do_unlink=True)
    roof.name=roof.data.name="core_retreat_liftaway_roof"
    for k in list(roof.keys()):del roof[k]
    roof["caveRoof"]=True;roof["closedSolid"]=True;roof["cutawaySection"]="inhabited-roof"
    return {"mainlandOpenEdges":shell.clean_solid(mainland),"roofOpenEdges":shell.clean_solid(roof)}


def _lightwell(scene,config,m):
    """Continue the onsen's actual inclined shaft to the new native roof height."""
    aperture=config["lightWell"]["aperture"]
    a=Vector((aperture[0],-aperture[2],aperture[1]-.12))
    old_top=config["lightWell"]["top"]
    old=Vector((old_top[0],-old_top[2],old_top[1]))
    trees=[]
    for obj in _geology(scene):
        trees.append(BVHTree.FromPolygons([obj.matrix_world@v.co for v in obj.data.vertices],[list(f.vertices) for f in obj.data.polygons]))
    hits=[h for t in trees if (h:=t.ray_cast(Vector((old.x,old.y,30)),Vector((0,0,-1)),40)[0]) is not None]
    top=max(h.z for h in hits)+.04
    x=aperture[0]-(top-aperture[1])*.4695/.8829
    b=Vector((x,old.y,top+.55))
    bm=bmesh.new()
    center=(a+b)/2;axis=b-a
    matrix=Matrix.Translation(center)@axis.to_track_quat("Z","Y").to_matrix().to_4x4()
    bmesh.ops.create_cone(bm,cap_ends=True,cap_tris=False,segments=40,radius1=.425,radius2=.425,depth=axis.length,matrix=matrix)
    data=bpy.data.meshes.new("retreat onsen light shaft");bm.to_mesh(data);bm.free();data.materials.append(m["rock"])
    cutter=bpy.data.objects.new(data.name,data);scene.collection.objects.link(cutter)
    report=[]
    for obj in _geology(scene):
        result=shell.boolean_preserving_islands(obj,cutter)
        if not result.get("skippedDisjoint"):report.append({"mesh":obj.name,**result})
    bpy.data.objects.remove(cutter,do_unlink=True)
    rim=bpy.data.objects.get("core_lightwell_rim")
    if rim:_move(rim,(x-old.x,0,top-old.z))
    config["lightWell"]["top"]=web((x,old.y,top))
    return {"top":config["lightWell"]["top"],"aperture":aperture,"cuts":report}


def _retire_old_stair(scene):
    """Remove the actual native central treads/guards, not their collision only."""
    removed=[]
    for name in ("core__pale oak","core__chalk limestone","core__honey ash","core__brushed brass"):
        obj=bpy.data.objects.get(name)
        if obj:
            _,count=shell.edit_islands(obj,lambda lo,hi:False if shell.inside(lo,hi,(-2.14,-7.73,-.02),(2.23,-6.38,3.60)) else None)
            removed.append({"mesh":name,"islands":count})
    _remove_prefixes(scene,("core_reno_stair_guard",))
    return removed


def _open_short_link(scene,m):
    cutter=shell._box_object("retreat real bedroom and living aperture",(-9.05,-2.25,-.18),(-3.90,-.22,5.18),m["plaster"])
    report=[]
    for name in ("core__chalk limestone","core__pale oak","core__honey ash","core__brushed brass"):
        obj=bpy.data.objects.get(name)
        if obj:report.append({"mesh":name,"cut":shell.boolean_preserving_islands(obj,cutter)})
    bpy.data.objects.remove(cutter,do_unlink=True)
    cutter=shell._box_object("retreat bedside apron guard opening",(-3.85,-1.55,2.62),(-.90,-.60,3.9),m["plaster"])
    for name in ("core__honey ash","core__brushed brass"):
        obj=bpy.data.objects.get(name)
        if obj:report.append({"mesh":name,"bedsideGuard":shell.boolean_preserving_islands(obj,cutter)})
    bpy.data.objects.remove(cutter,do_unlink=True)
    return report


def _curved_house_stair(scene,m):
    """One continuous inward-bowed stair occupies the retained rear stair void."""
    p=Parts("core_retreat_house_stair")
    supports=[]
    centers=[]
    count=16
    # A shallow curved plan remains within the existing rear void, while its
    # seaward edge never presents the old second straight flight below the onsen.
    for k in range(count):
        t=(k+.5)/count
        x=-2.05+4.0*t
        y=-7.03-.26*math.sin(t*math.pi)
        z=(k+1)*2.6/count
        yaw=math.atan2(-.26*math.pi*math.cos(t*math.pi),4.)
        # Stone tread under a 28 mm oak cap; the two tops are never coplanar.
        box(p.bm(m["stone"]),(x,y,z-.109),(.27,1.03,.162),.014,yaw=yaw)
        box(p.bm(m["oak"]),(x,y,z-.014),(.266,1.015,.028),.006,yaw=yaw)
        supports.append(sunken.support(f"retreat-house-tread-{k+1}",(x-.135,x+.135,y-.505,y+.505),z))
        centers.append((x,y,z))
    for side in (-1,1):
        rail=[]
        for k in range(count+1):
            t=k/count
            x=-2.05+4*t
            y=-7.03-.26*math.sin(t*math.pi)+side*.49
            z=2.6*t
            rail.append((x,y,z+.96))
            cylinder(p.bm(m["bronze"]),(x,y,z+.03),(x,y,z+.94),.009,8)
        for a,b in zip(rail,rail[1:]):
            cylinder(p.bm(m["smoked"]),a,b,.025,12)
    # Fill the old head-of-stair branch so there is exactly one readable descent.
    objects=p.finish()
    return objects,supports,[web(q) for q in centers]


def _library_structure(scene,m):
    """A single double-height room, no mezzanine and no long rear corridor."""
    p=Parts("core_retreat_library")
    link=Parts("core_retreat_gallery")
    x0,x1=LIBRARY["x"]; y0,y1=LIBRARY["y"]
    stone,oak,plaster=p.bm(m["stone"]),p.bm(m["oak"]),p.bm(m["plaster"])
    # The stone bed stops under the 22 mm boards: a flush stone top z-fought with the oak.
    box(stone,((x0+x1)/2,(y0+y1)/2,-.141),(x1-x0+.12,y1-y0+.12,.238),.018)
    library._floor(p,m["oak"],(x0,x1,y0,y1),0)
    # Ground aperture opens at the east side in front of the bathroom wing. The
    # enclosing east wall leaves this real 1.4m passage, rather than a route through rock.
    box(plaster,(x0-.06,(y0+y1)/2,2.78),(.12,y1-y0,5.56),.04)
    box(plaster,((x0+x1)/2,y0-.06,2.78),(x1-x0,.12,5.56),.04)
    for a,b in ((y0,-1.85),(-.25,y1)):
        box(plaster,(x1+.06,(a+b)/2,2.78),(.12,b-a,5.56),.035)
    # Short open connection runs along the seaward bathroom return, with no long
    # enclosed landward spine. Upper bridge ends immediately at the spiral landing.
    supports=[sunken.support("retreat-library-floor",(x0,x1,y0,y1),0)]
    for f in (0.,2.6):
        b=(-9.42 if f else -9.7,-3.80,-1.72,-.32)
        box(link.bm(m["stone"]),((b[0]+b[1])/2,(b[2]+b[3])/2,f-.131),(b[1]-b[0],b[3]-b[2],.218),.012)
        library._floor(link,m["oak"],b,f)
        supports.append(sunken.support(f"retreat-library-bridge-{f:g}",b,f))
    # A short bedside apron joins the existing upper floor to the close bridge.
    # Its actual front edge gives room to pass the retained bed/duvet and planter.
    b=(-3.85,-.90,-2.30,-.75)
    box(link.bm(m["stone"]),((b[0]+b[1])/2,(b[2]+b[3])/2,2.469),(b[1]-b[0],b[3]-b[2],.218),.02)
    library._floor(link,m["oak"],b,2.6)
    supports.append(sunken.support("retreat-bedroom-bridge-apron",b,2.6))
    for x in (-3.75,-2.5,-1.25):
        cylinder(link.bm(m["bronze"]),(x,-.8,2.62),(x,-.8,3.62),.012,10)
    cylinder(link.bm(m["smoked"]),(-3.75,-.8,3.62),(-1.25,-.8,3.62),.026,12)
    # The solid bridge has a visible handrail on its open edge, while the bathroom
    # wall is the closed inland edge. Keep the 1.2m approach to the bedroom clear.
    for x in (-8.4,-7.2,-6.,-4.8):
        cylinder(link.bm(m["bronze"]),(x,-.37,2.62),(x,-.37,3.62),.012,10)
    cylinder(link.bm(m["smoked"]),(-9.1,-.37,3.62),(-4.45,-.37,3.62),.026,12)
    # New tall books are explicitly lower-room furniture; all keep material batches.
    books=Parts("library")
    for f in (0.,2.35):
        library._books(books,m,-12.36,.30,f,-1,111+int(f*10),length=4.95)
    # The book wall's seaward gap is the warm fireplace; a second tall bank frames
    # the east window jamb without filling the view or desk circulation.
    for f in (0.,2.35):
        library._books(books,m,-8.73,5.7,f,1,151+int(f*10),length=2.20)
    # Native moveable ladder on a continuous bronze rail. Separate complete
    # assembly has a stable pivot: runtime may slide it along the shelves.
    ladder=Parts("library_ladder")
    lx,ly=-11.70,-.05
    for y in (ly-.28,ly+.28):
        cylinder(ladder.bm(m["oak"]),(lx,y,.08),(lx-.40,y,4.75),.036,12)
    for k in range(13):
        z=.22+k*.345
        x=lx-.40*(z-.08)/4.67
        cylinder(ladder.bm(m["smoked"]),(x,ly-.28,z),(x,ly+.28,z),.025,12)
    for y in (ly-.29,ly+.29):
        cylinder(ladder.bm(m["bronze"]),(lx+.015,y,.09),(lx-.055,y,.09),.09,16)
    ladder_objects=ladder.finish()
    for obj in ladder_objects:
        obj["libraryLadder"]=True
        obj["walk"]="solid"
    cylinder(p.bm(m["bronze"]),(-12.11,-2.20,4.70),(-12.11,2.70,4.70),.021,12)
    # Continuous cove serves the actual double-height shelves.
    box(p.bm(m["light"]),(-12.19,.25,4.72),(.018,4.8,.025),.003)
    box(p.bm(m["light"]),(-8.91,5.70,4.72),(.018,2.1,.025),.003)
    box(link.bm(m["light"]),(-6.475,-1.65,4.85),(4.95,.018,.025),.003)
    objects=p.finish()+link.finish()+books.finish()+ladder_objects
    for x in (-11.30,-9.80):
        seat=Parts("library_reading_seat")
        library._chair(seat,m,(x,5.40,0),0)
        objects+=seat.finish()
    glazing=library.facade(m)
    for obj in glazing:
        library.place(obj);_move(obj,(0,-5.,0))
    objects+=glazing
    ceiling=library.panel("core_retreat_library_ceiling",m["plaster"],((x0+x1)/2,(y0+y1)/2,5.70),(x1-x0,y1-y0,.10),.025,caveRoof=True,roomCeilingFor="library")
    return objects+ceiling,supports


def _spiral(m):
    p=Parts("core_retreat_spiral")
    cx,cy=SPIRAL["center"]; ri,ro=SPIRAL["inner"],SPIRAL["outer"]
    n=SPIRAL["count"]; start,sweep=SPIRAL["start"],SPIRAL["sweep"]
    route=[]; supports=[]
    cylinder(p.bm(m["bronze"]),(cx,cy,.01),(cx,cy,3.65),ri*.65,20)
    for k in range(n):
        a=start+sweep*k/n; b=start+sweep*(k+1)/n
        z=(k+1)*SPIRAL["rise"]/n
        poly=[]
        for j in range(5):
            th=a+(b-a)*j/4; poly.append((cx+ro*math.cos(th),cy+ro*math.sin(th)))
        for j in range(4,-1,-1):
            th=a+(b-a)*j/4; poly.append((cx+ri*math.cos(th),cy+ri*math.sin(th)))
        from coastal_estate_outdoors import _prism
        _prism(p.bm(m["oak"]),poly,z-.07,z)
        supports.append({"id":f"retreat-spiral-tread-{k+1}","polygon":[[x,-y] for x,y in reversed(poly)],"height":round(z,6)})
        th=(a+b)/2
        route.append(web((cx+.72*math.cos(th),cy+.72*math.sin(th),z)))
        pa=(cx+ro*math.cos(a),cy+ro*math.sin(a),z+.98)
        pb=(cx+ro*math.cos(b),cy+ro*math.sin(b),z+.98+SPIRAL["rise"]/n)
        # The last three wedges meet the solid bedroom bridge. This is the
        # actual upper entry opening, never a route through a retained handrail.
        if k<n-3:
            cylinder(p.bm(m["smoked"]),pa,pb,.025,12)
            cylinder(p.bm(m["bronze"]),(pa[0],pa[1],z),(pa[0],pa[1],pa[2]),.009,8)
    # A real annular top landing closes the otherwise unsupported capsule edge
    # beyond the last wedge, overlapping the short bridge. It occupies the open
    # sector of the helix, never a slab above its low first risers.
    from coastal_estate_outdoors import _prism
    landing=[]
    for j in range(13):
        a=-.28+.83*j/12;landing.append((cx+ro*math.cos(a),cy+ro*math.sin(a)))
    for j in range(12,-1,-1):
        a=-.28+.83*j/12;landing.append((cx+.45*math.cos(a),cy+.45*math.sin(a)))
    _prism(p.bm(m["oak"]),landing,2.53,2.6)
    supports.append({"id":"retreat-spiral-top-landing","polygon":[[x,-y] for x,y in reversed(landing)],"height":2.6})
    for r in (.45,ro):
        q=(cx+r*math.cos(.55),cy+r*math.sin(.55))
        cylinder(p.bm(m["bronze"]),(q[0],q[1],2.62),(q[0],q[1],3.6),.009,8)
    cylinder(p.bm(m["smoked"]),(cx+.45*math.cos(.55),cy+.45*math.sin(.55),3.6),(cx+ro*math.cos(.55),cy+ro*math.sin(.55),3.6),.025,12)
    return p.finish(),supports,route


def _library_manifest(config,stair_route):
    rooms={r["id"]:r for r in config["rooms"]}
    old_study=copy.deepcopy(rooms["study"])
    delta=(WORKSTATION[0],WORKSTATION[2],-WORKSTATION[1])
    study=_translate_tree(old_study,delta)
    study.update(floor=0.,label="Cave study",offset=[0,0,0],
                 target=web((-10.8,3.2,1.8)),
                 egress=web((-2.8,-5.6,0)),
                 exitPath=[web(q) for q in ((-9.0,3.15,0),(-9.0,-1.05,0),(-3.65,-1.05,0),(-3.65,-5.6,0),(-2.8,-5.6,0))],
                 camera={"radius":4.0,"yaw":2.7,"pitch":.30,"fov":55,
                         "envelope":{"yaw":None,"pitch":[.05,.65],"radius":[2.2,5.5]}})
    study["library"]={"private":False,"route":[web(q) for q in ((-2.8,-5.6,0),(-3.65,-5.6,0),(-3.65,-1.05,0),(-9.0,-1.05,0),(-9.0,3.15,0),(-9.8,3.15,0))],"headroom":5.5}
    study["desk"]["window"]=web((-10.55,7.10,1.65))
    study["desk"]["windowYaw"]=0
    study["lightRegion"]={"min":[-12.6,0,-7.2],"max":[-8.45,5.6,2.5]}
    rooms["study"].clear();rooms["study"].update(study)
    reading=rooms["library"]
    reading.update(actor=web((-10.55,5.75,0)),target=web((-10.55,5.85,1.3)),floor=0,
                   egress=study["egress"],exitPath=[web(q) for q in ((-10.55,4.7,0),(-9.0,4.2,0),(-9.0,-1.05,0),(-3.65,-1.05,0),(-3.65,-5.6,0),(-2.8,-5.6,0))],
                   lightRegion=study["lightRegion"],library={"private":False,"route":study["library"]["route"][:-1]+[web((-9.0,4.2,0)),web((-10.55,4.7,0)),web((-10.55,5.75,0))],"headroom":5.5})
    chill=rooms["library-upper"]
    chill.clear();chill.update(id="library-upper",label="Private living",file="room-library-upper.glb",floor=2.6,offset=[0,2.6,0],
                              actor=web((0,-3.6,2.6)),target=web((0,-3.7,3.65)),facing=0,
                              egress=web((1.3,-6.1,2.6)),exitPath=[web((.2,-4.2,2.6)),web((1.3,-4.7,2.6)),web((1.3,-6.1,2.6))],
                              camera={"radius":3.6,"yaw":-.1,"pitch":.15,"fov":52,"envelope":{"yaw":None,"pitch":[.05,.6],"radius":[2.3,5.5]}})
    # Contacts drive routine travel and must match the moved actual seated body.
    for r in (study,reading,chill):
        config["terrain"]["contacts"][r["id"]]={key:copy.deepcopy(r[key]) for key in ("actor","egress","floor","exitPath")}
    config["companion"]["perches"]["study"]=[_point(q,delta) for q in config["companion"]["perches"]["study"]]
    for anchor in config.get("furniture",[]):
        if anchor.get("room")=="study":
            anchor["position"]=_point(anchor["position"],delta)
    for key in ("screens","rgb","desk"):
        if key in config["interiorLights"]:
            config["interiorLights"][key]=_translate_tree(config["interiorLights"][key],delta)
    config["estateLibrary"]={"bounds":{"min":[-12.65,-.2,-7.25],"max":[-4.4,5.8,2.6]},
                             "volume":"single double-height study and library; no mezzanine",
                             "privateConnection":[web(q) for q in ((-3.1,-1.75,2.6),(-4.3,-1.75,2.6),(-4.3,-1.05,2.6),(-9.35,-.80,2.6))]+list(reversed(stair_route))+[web(q) for q in ((-9.6,.4,0),(-9.0,.4,0),(-9.0,3.15,0),(-9.8,3.15,0))],
                             "stairRoute":stair_route,
                             "stairApproach":{"bottom":web((-9.6,.4,0)),"top":web((-9.35,-.80,2.6))},
                             "ladder":{"nodes":[o.name for o in bpy.context.scene.objects if o.get("libraryLadder")],
                                       "travelAxis":"z","travel":[-1.80,1.80],"rest":0,
                                       "pivot":web((-11.70,-.05,0)),"rail":[web((-12.11,-2.20,4.70)),web((-12.11,2.70,4.70))],
                                       "climbable":False,"rungPitch":.345,"width":.56},
                             "galleryLighting":[]}


def _private_chill(m):
    p=Parts("library-upper")
    # Quiet upper living space replaces the monitors, tower and office shelving.
    for x in (-.5,.5):
        box(p.bm(m["smoked"]),(x,-3.82,2.85),(.92,1.18,.42),.10)
        box(p.bm(m["linen"]),(x,-3.78,3.12),(.90,1.14,.20),.095)
        box(p.bm(m["linen"]),(x,-4.27,3.48),(.9,.20,.62),.09,pitch=-.12)
    box(p.bm(m["travertine"]),(0,-2.75,2.96),(1.20,.58,.08),.12)
    box(p.bm(m["travertine"]),(0,-2.75,2.77),(.38,.34,.35),.06)
    box(p.bm(m["paper"]),(-.25,-2.72,3.015),(.33,.25,.025),.006)
    return p.finish()


def finish_metadata(scene,config):
    """Final world-coordinate metadata and native emission ownership, no geometry moves."""
    rooms={r["id"]:r for r in config["rooms"]}
    config["equipment"]["gym"]["choreographyOrigin"]=[0,0,SETBACK]
    rooms["study"].pop("lightRegion",None)
    rooms["library-upper"]["lightRegion"]={"min":[-1.65,2.55,10.25],"max":[1.3,4.7,12.55]}
    config["lightTransportRegions"]=[q for q in config["lightTransportRegions"] if q.get("id")!="retreat-library"]
    groups=config["installationReceivers"]["groups"]
    groups["architecture"]=[groups["living"],groups["upper"]]
    config["installationPoints"]=[q for q in config["installationPoints"] if q.get("id") not in ("library-reading-lamp","library-writing-lamp")]
    groups["exterior"]={"min":[-8.7,-1.95,-5.1],"max":[8.3,3.6,3.49]}
    groups["garden"]={"min":[-7,6,8],"max":[10.3,12,24.1]}
    groups["arrival"]={"min":[-6.7,-.1,13.55],"max":[-1.9,2.4,17.6]}
    groups["clifftop"]={"min":[5.3,7,8.9],"max":[10.3,10,13.1]}
    config["installationReceivers"]["order"]=["library","gallery","bath-living","bath-bedroom","arrival","clifftop","garden","living","upper","gym","exterior"]
    config["interiorLights"]["entrance"]["region"]={"min":[-6.7,-.1,13.55],"max":[-1.9,2.4,17.6]}
    config["estateLibrary"]["bedroomApproach"]=[[-1.4,2.6,11.95],[-1.4,2.6,9.6],[-3.1,2.6,9.6],[-3.1,2.6,9.75]]
    rooms["sleep"]["exitPath"]=[[-1.4,2.6,11.95],[-1.4,2.6,12.7],[-2.12,2.6,14.1]]
    config["terrain"]["contacts"]["sleep"]["exitPath"]=copy.deepcopy(rooms["sleep"]["exitPath"])
    for obj in scene.objects:
        if not obj.name.startswith("core_retreat_"):continue
        if "library" in obj.name or "spiral" in obj.name:group="library"
        elif "gallery" in obj.name:group="gallery"
        elif "clifftop" in obj.name:group="clifftop"
        elif "private_arrival" in obj.name:group="garden"
        elif "arrival" in obj.name:group="arrival"
        else:group="architecture"
        obj["installationGroup"]=group
        if obj.type=="MESH" and any(mat and "diffuser" in mat.name for mat in obj.data.materials):
            if "clifftop" in obj.name:obj["installationGlow"]="clifftop-lounge"
            elif "arrival" in obj.name:obj["installationGlow"]="outdoor-portal"
            elif "gallery" in obj.name:obj["installationGlow"]="short-bedroom-link"
    for obj in _geology(scene):
        if obj.type!="MESH":continue
        native=next((k for k,mat in enumerate(obj.data.materials) if mat and mat.name=="golden coastal sandstone"),None)
        if native is None:continue
        for face in obj.data.polygons:
            mat=obj.data.materials[face.material_index]
            if mat and mat.name in ("chalk limestone","warm cut stone"):
                face.material_index=native


def apply_companion_routes(config):
    """One final-frame preset owns all native-probed companion flight metadata."""
    path=Path(__file__).resolve().parents[1]/"artwork/coastal-home/companion-flight-paths.json"
    preset=json.loads(path.read_text(encoding="utf-8"))
    if preset.get("routeFrame")!="world-after-retreat" or preset.get("routeSetbackMetres")!=config["retreat"]["setbackMetres"]:
        raise RuntimeError("Companion flight preset does not match the final native housing frame")
    if set(preset["perches"])!={r["id"] for r in config["rooms"]}:
        raise RuntimeError("Every inhabited room requires an audited companion perch")
    config["companion"].update(copy.deepcopy(preset))


def sync_anchors_and_coastal_perch(scene,config):
    """Final room contacts own native anchors; replace one genuinely excavated perch."""
    anchors=[]
    for room in config["rooms"]:
        name="anchor_"+room["id"]
        obj=scene.objects.get(name)
        if obj is None:
            obj=bpy.data.objects.new(name,None)
            scene.collection.objects.link(obj)
        before=list(obj.matrix_world.translation)
        q=room["actor"]
        obj.matrix_world.translation=Vector((q[0],-q[2],q[1]))
        anchors.append({"name":name,"previousNative":before,"actor":q})
    # The old west perch at(-8,-1) was inside the now-open court. The replacement
    # is on intact, upward-facing mainland beyond the library's excavated edge.
    x,y=-13.6,-1.0
    mainland=bpy.data.objects["core__golden coastal sandstone"]
    tree=BVHTree.FromPolygons([mainland.matrix_world@v.co for v in mainland.data.vertices],
                              [list(f.vertices) for f in mainland.data.polygons])
    hit,normal,_,_=tree.ray_cast(Vector((x,y,25)),Vector((0,0,-1)),35)
    if hit is None or normal.z<.9 or hit.z<6:
        raise RuntimeError("Replacement west-shoulder gull perch lost its native bedrock")
    previous=config["retreat"].get("displacedCoastPerch",{}).get("previous",copy.deepcopy(config["terrain"]["perches"][0]))
    config["terrain"]["perches"][0]=web((x,y,hit.z+.05))
    config["retreat"]["displacedCoastPerch"]={"previous":previous,"current":config["terrain"]["perches"][0],
        "support":mainland.name,"contact":web(hit),"reason":"Original west perch was inside the actual new courtyard excavation"}
    return {"anchors":anchors,"coastalPerch":config["retreat"]["displacedCoastPerch"]}


def sync_west_rabbit_habitat(scene,config):
    """Ground only the displaced west loop on the final, excavated mainland."""
    from coastal_camera import create_camera_height
    from rabbit_habitats import RABBIT_HABITAT_LOOPS, sample_loop
    height=create_camera_height(list(scene.objects))
    path=sample_loop(RABBIT_HABITAT_LOOPS["rabbitWest"],height)
    if any(point[1]<6 for point in path):
        raise RuntimeError("West rabbit loop lost its intact clifftop support")
    config["terrain"]["habitats"]["rabbitWest"]["path"]=path
    return {"plan":RABBIT_HABITAT_LOOPS["rabbitWest"],"points":len(path),
            "frame":"fixed native mainland; never shares the housing setback",
            "rootClearance":.025}


def repair_gym_connection(scene,config):
    """Open the actual retained-rock septum at the moved gym's usable aisle."""
    route=[[7.6,0,5.9],[6.2,0,5.9],[5.5,0,6.3],[4.45,0,6.3],[3.5,0,6.45]]
    room=next(r for r in config["rooms"] if r["id"]=="gym")
    room["exitPath"]=route
    config["equipment"]["gym"]["exit"]=copy.deepcopy(route[0])
    config["terrain"]["contacts"]["gym"]["exitPath"]=copy.deepcopy(route)
    config.setdefault("retreat",{})["gymConnection"]={"route":[room["actor"],*route],"clearHeight":2.45,
                                                     "bounds":{"min":[4.8,-.3,5.1],"max":[6.25,2.45,6.7]}}
    if scene.get("retreatGymConnectionVersion")==1:return [],{"retained":True}
    m=library.materials()
    cuts=_cut(scene,"retreat actual gym passage",(4.80,-6.70,-.30),(6.25,-5.10,2.45),m["rock"])
    p=Parts("core_retreat_gym_threshold")
    box(p.bm(m["stone"]),(5.525,-5.90,-.10),(1.45,1.60,.20),.014)
    objects=p.finish()
    # This is a filler for the actual missing threshold, not a second floor
    # plate embedded in the two retained gym slabs.
    for obj in objects:
        for name in ("core_gym_floor","core_gym_passage_floor"):
            original=scene.objects.get(name)
            if original:shell.boolean(obj,original,"DIFFERENCE")
    for obj in objects:obj["installationGroup"]="gym"
    config["terrain"]["supportSurfaces"].append(sunken.support("retreat-gym-threshold",(4.8,6.25,-6.7,-5.1),0))
    scene["retreatGymConnectionVersion"]=1
    return objects,{"cuts":cuts,"route":config["retreat"]["gymConnection"]["route"]}


def _slim_terrace(scene,m):
    """Retire oversized pier/ring islands; the inset basin bears on native rock."""
    removed=[]
    for obj in scene.objects:
        if not obj.name.startswith("core_estate_terrace") or obj.type!="MESH":
            continue
        # Dry slab tops end at Z0; deep ring and corbel islands are below −.5m.
        _,count=shell.edit_islands(obj,lambda lo,hi:False if lo.z<-.55 else None)
        for vertex in obj.data.vertices:
            if -.525<vertex.co.z<-.03:vertex.co.z=-.03+(vertex.co.z+.03)*.45
        obj.data.update()
        removed.append({"mesh":obj.name,"removedDeepStructureIslands":count})
    return removed


def _entry(scene,config,m):
    """Main stair bends under the mountain directly to the lower living floor.

    The old upper foyer has no public opening. A separate discreet side path
    reaches the onsen privately; its threshold is oak rather than a glass leaf.
    """
    p=Parts("core_retreat_arrival")
    # Fit the inland portal to actual native ground, so climbing outside joins
    # the clifftop instead of ending in a recessed, impassable sill.
    terrain_hits=[]
    for obj in _geology(scene):
        tree=BVHTree.FromPolygons([obj.matrix_world@v.co for v in obj.data.vertices],[list(f.vertices) for f in obj.data.polygons])
        h=tree.ray_cast(Vector((3.42,-23.20,30)),Vector((0,0,-1)),40)[0]
        if h is not None:terrain_hits.append(h.z)
    top=max(terrain_hits)+.025
    # Original garden portal stays where the garden's mineral path actually ends.
    points=[(3.42,-18.55,top),(3.42,-17.5,top),
            (3.42,-15.8,top-1.1),(2.7,-14.2,top-2.2),
            (.85,-13.25,top-3.4),(-1.25,-13.25,top-4.65),
            (-2.8,-14.2,top-5.8),(-2.8,-15.6,.78),(-2.8,-15.6,0.)]
    # Source coordinates here are FINAL world, because this stair must keep its
    # clifftop mouth fixed while its lower end joins the translated dwelling.
    centers=[]
    for a,b in zip(points,points[1:]):
        length=math.dist(a[:2],b[:2])
        n=max(1,math.ceil(abs(b[2]-a[2])/.165),math.ceil(length/.29))
        for k in range(1,n+1):
            t=k/n
            centers.append(tuple(a[j]+(b[j]-a[j])*t for j in range(3)))
    # Final zero-length vertical tail is replaced by four short folded risers,
    # never an invisible jump at the bottom of a visually straight stair.
    centers=centers[:-5] if len(centers)>5 and centers[-1][:2]==centers[-2][:2] else centers
    # Smooth 6m-radius, 108-degree arc: 0.2356m centre spacing between equal
    # risers, with overlapping 0.31m-deep tread support patches.
    n=48
    centers=[]
    for k in range(n):
        t=(k+.5)/n
        # Broad U-turn: the full arc bends farther under the cliff, with actual
        # inside/outside handrails. A 1.6m clear width remains throughout.
        theta=math.pi*.60*t
        x=-2.58+6.0*math.cos(theta)
        y=-22.50+6.0*math.sin(theta)
        z=top*(1-(k+1)/n)
        centers.append((x,y,z))
    # Endpoints are connected by real flat vestibules, not a room selector hop.
    start=centers[0];end=centers[-1]
    cuts=[]
    supports=[]
    for k,q in enumerate(centers):
        a=centers[max(0,k-1)];b=centers[min(n-1,k+1)]
        yaw=math.atan2(b[1]-a[1],b[0]-a[0])
        # Points live in final coords; move back before common housing shift.
        x,y,z=q; y+=SETBACK
        box(p.bm(m["stone"]),(x,y,z-.119),(.31,1.64,.182),.012,yaw=yaw)
        box(p.bm(m["oak"]),(x,y,z-.014),(.30,1.60,.028),.005,yaw=yaw)
        # Oriented tread footprint, not a bounding rectangle that invents corners.
        poly=[]
        for dx,dy in ((-.155,-.82),(.155,-.82),(.155,.82),(-.155,.82)):
            poly.append((x+dx*math.cos(yaw)-dy*math.sin(yaw),y+dx*math.sin(yaw)+dy*math.cos(yaw)))
        supports.append({"id":f"retreat-arrival-tread-{k+1}","height":z,"polygon":[[a,-b] for a,b in reversed(poly)]})
        if k%4==0:
            x2=x-.76*math.sin(yaw);y2=y+.76*math.cos(yaw)
            box(p.bm(m["light"]),(x2,y2,z+.14),(.08,.028,.025),.003,yaw=yaw)
    cuts+=_curved_tunnel(scene,centers,m["plaster"])
    for side in (-1,1):
        rail=[]
        for k,q in enumerate(centers):
            a=centers[max(0,k-1)];b=centers[min(n-1,k+1)]
            yaw=math.atan2(b[1]-a[1],b[0]-a[0])
            x=q[0]-side*.77*math.sin(yaw);y=q[1]+SETBACK+side*.77*math.cos(yaw)
            rail.append((x,y,q[2]+.98))
            if k%2==0:
                cylinder(p.bm(m["bronze"]),(x,y,q[2]+.03),(x,y,q[2]+.97),.009,8)
        for a,b in zip(rail,rail[1:]):cylinder(p.bm(m["smoked"]),a,b,.026,12)
    # Portal-to-stair and stair-to-living are broad level vestibules.
    from coastal_estate_outdoors import _prism
    top_poly=[(2.3,-23.8),(4.55,-23.8),(4.55,-22.56),(2.3,-22.56)]
    _prism(p.bm(m["stone"]),[(x,y+SETBACK) for x,y in top_poly],top-.19,top)
    supports.append({"id":"retreat-arrival-top","polygon":[[x,-y-SETBACK] for x,y in reversed(top_poly)],"height":top})
    # Lower foyer joins the original lower rear aisle at native (−2.8,−13.6).
    ex,ey,ez=end
    lower=(-6.65,-1.95,min(ey,-13.6)-1.15,max(ey,-13.6)+.8)
    x0,x1,y0,y1=lower
    box(p.bm(m["stone"]),((x0+x1)/2,(y0+y1)/2+SETBACK,-.12),(x1-x0,y1-y0,.24),.018)
    supports.append(sunken.support("retreat-arrival-foyer",(x0,x1,y0+SETBACK,y1+SETBACK),0))
    cuts.extend(_cut(scene,"retreat lower foyer excavation",(x0-.04,y0-.04,-.2),(x1+.04,y1+.04,2.65),m["plaster"]))
    cuts.extend(_cut(scene,"retreat top portal excavation",(2.25,-23.85,top-.23),(4.60,-22.56,top+3.0),m["plaster"]))
    washers=[(-6.57,-15.9,2.1),(-2.04,-15.0,2.1)]
    for x,y,z in washers:
        box(p.bm(m["smoked"]),(x,y+SETBACK,z+.035),(.09,.30,.065),.012)
        box(p.bm(m["light"]),(x,y+SETBACK,z-.008),(.065,.27,.018),.004)
    config["interiorLights"]["entrance"]={"positions":[web(q) for q in washers],
                                          "region":{"min":[-6.7,-.1,13.55],"max":[4.65,top+3,24.0]}}
    # Slender posts and cedar shade replace the heavy old plaster portal.
    for x in (2.36,4.48):
        for y in (-23.60,-22.72):
            cylinder(p.bm(m["bronze"]),(x,y+SETBACK,top),(x,y+SETBACK,top+2.30),.032,12)
        box(p.bm(m["stone"]),(x,-23.15+SETBACK,top+.22),(.16,.90,.44),.035)
        cylinder(p.bm(m["smoked"]),(x,-23.55+SETBACK,top+.96),(x,-22.70+SETBACK,top+.96),.025,12)
    for k in range(11):
        box(p.bm(m["oak"]),(3.42,-23.75+k*.12+SETBACK,top+2.34),(2.38,.058,.065),.008)
    box(p.bm(m["smoked"]),(3.42,-23.73+SETBACK,top+2.30),(2.42,.055,.075),.01)
    box(p.bm(m["light"]),(3.42,-23.72+SETBACK,top+2.25),(2.27,.012,.020),.003)
    for line in config["installationLines"]:
        if line.get("id")=="portal-brow":
            line.update(a=web((2.285,-23.72,top+2.25)),b=web((4.555,-23.72,top+2.25)),
                        region={"min":[2.1,top-.1,22.4],"max":[4.8,top+2.5,24.0]},intensity=.18)
    # The main arrival ends at a private-feeling oak threshold, not an unmarked
    # open cut or the old translucent onsen screen. The actual leaf slides into
    # its native plaster return with the existing proximity-door controller.
    dx0,dx1,dy,dh=-3.6,-2.0,-14.10,2.30
    for x in (dx0,dx1):
        box(p.bm(m["oak"]),(x,dy+SETBACK,dh/2),(.07,.18,dh),.012)
    box(p.bm(m["oak"]),((dx0+dx1)/2,dy+SETBACK,dh+.03),(dx1-dx0+.14,.18,.06),.012)
    box(p.bm(m["plaster"]),((-6.60+dx0)/2,dy+SETBACK,1.14),(dx0+6.60,.14,2.28),.035)
    leaf=Parts("core_retreat_door_main")
    box(leaf.bm(m["oak"]),((dx0+dx1)/2,dy+SETBACK,dh/2),(dx1-dx0-.08,.045,dh-.045),.018)
    for x in (dx0+.09,dx1-.09):
        box(leaf.bm(m["smoked"]),(x,dy-.028+SETBACK,dh/2),(.018,.012,dh-.10),.003)
    cylinder(leaf.bm(m["bronze"]),(dx1-.16,dy-.07+SETBACK,.88),(dx1-.16,dy-.07+SETBACK,1.42),.014,12)
    leaves=leaf.finish()
    for obj in leaves:obj["estateDoor"]="main";obj["walk"]="dynamic-door"
    config["estateDoors"]=[{"id":"main","nodes":[obj.name for obj in leaves],"slideX":-1.65,
                            "center":web((-2.8,dy,1.10)),"opening":{"min":web((dx0,dy+.12,0)),"max":web((dx1,dy-.12,dh))},
                            "activationDistance":2.1,"floor":0,"material":"oak pocket leaf"}]
    config["entrance"]={"floor":0,"top":top,"portal":web((3.42,-23.20,top)),"foyer":web((-2.8,-13.6,0)),
                        "route":[web((-2.8,-13.6,0)),web((-2.8,-15.2,0)),web((-5.8,-15.2,0)),web((-5.8,ey-.45,0)),web((ex,ey,0))]+[web(q) for q in reversed(centers)]+[web((3.42,-23.20,top))],
                        "headroom":2.65,"stairWidth":1.6,"riser":top/n,"going":6.0*math.pi*.60/n,
                        "publicDestination":"lower living floor; no onsen branch","curved":True}
    config["walk"]["mainEntryRoute"]=list(reversed(config["entrance"]["route"]))
    config["walk"]["mainEntryRoute"] += [web((3.27,-13.6,0)),web((3.27,-9.2,0))]
    arrival,next_step=config["walk"]["mainEntryRoute"][:2]
    config["walk"]["start"]={"position":arrival[:],
        "yaw":math.atan2(next_step[0]-arrival[0],next_step[2]-arrival[2]),"pitch":-.08}
    # This branch is final-space and must not be translated a second time.
    config["walk"]["region"]={"min":[-18,-2,-11.2],"max":[18,top+3,35]}
    return p.finish()+leaves,supports,{"cuts":cuts,"centers":centers,"risers":n,"rise":top/n}


def _clifftop_retreat(scene,config,m):
    """Terrain-seated view lounge and a separate concealed onsen descent."""
    geology=_geology(scene)
    vertices=[];faces=[]
    for o in geology:
        offset=len(vertices)
        vertices.extend(o.matrix_world@v.co for v in o.data.vertices)
        faces.extend([[offset+i for i in f.vertices] for f in o.data.polygons])
    tree=BVHTree.FromPolygons(vertices,faces)
    def ground(x,y):
        hit=tree.ray_cast(Vector((x,y,30)),Vector((0,0,-1)),40)[0]
        if hit is None:raise ValueError(("No actual clifftop",x,y))
        return hit.z
    x0,x1,y0,y1=5.40,10.1,-13.0,-9.0
    top=min(ground(x,y) for x in (x0,x1) for y in (y0,y1))-.04
    cuts=_cut(scene,"retreat clifftop sunken lounge",(x0-.1,y0-.1,top-.20),(x1+.1,y1+.1,30),m["rock"])
    p=Parts("core_retreat_clifftop")
    box(p.bm(m["stone"]),((x0+x1)/2,(y0+y1)/2,top-.091),(x1-x0,y1-y0,.138),.04)
    library._floor(p,m["oak"],(x0,x1,y0,y1),top)
    # Low wraparound conversation seating keeps the prospect open above waist.
    for x in (6.0,6.95,7.9):
        box(p.bm(m["smoked"]),(x,-12.45,top+.20),(.91,.68,.40),.06)
        box(p.bm(m["linen"]),(x,-12.39,top+.46),(.87,.64,.15),.07)
        box(p.bm(m["linen"]),(x,-12.73,top+.76),(.88,.15,.56),.07,pitch=-.12)
    for y in (-11.45,-10.50):
        box(p.bm(m["smoked"]),(9.65,y,top+.20),(.68,.91,.40),.06)
        box(p.bm(m["linen"]),(9.60,y,top+.46),(.64,.87,.15),.07)
        box(p.bm(m["linen"]),(9.96,y,top+.76),(.15,.88,.56),.07)
    box(p.bm(m["travertine"]),(8.0,-11.15,top+.36),(1.1,.8,.12),.15)
    box(p.bm(m["travertine"]),(8.0,-11.15,top+.16),(.50,.42,.30),.10)
    # A thin slatted partial canopy gives shade without an enclosed pavilion.
    for x,y in ((5.55,-12.85),(9.95,-12.85),(9.95,-9.15)):
        cylinder(p.bm(m["bronze"]),(x,y,top),(x,y,top+2.35),.035,12)
    for x in [5.50+i*.25 for i in range(19)]:
        box(p.bm(m["oak"]),(x,-11.0,top+2.38),(.065,3.9,.075),.009)
    for y in (-12.82,-9.18):
        box(p.bm(m["smoked"]),(7.75,y,top+2.32),(4.6,.065,.08),.012)
        box(p.bm(m["light"]),(7.75,y,top+2.27),(4.35,.015,.022),.003)
    objects=p.finish()
    support=sunken.support("retreat-clifftop-lounge",(x0,x1,y0,y1),top)
    # Independent spiral descends beside the onsen's landward wall. One complete
    # turn drops >2.6m, maintaining headroom under the preceding revolution.
    p=Parts("core_retreat_private_arrival")
    cx,cy=6.10,-15.0;ro,ri=1.45,.25
    start=math.pi*.5;sweep=math.pi*2.4;n=32
    entry=(cx+1.70*math.cos(.65),cy+1.70*math.sin(.65))
    private_top=ground(*entry)+.015
    centers=[];private_supports=[]
    from coastal_estate_outdoors import _prism
    for k in range(n):
        a=start+sweep*k/n;b=start+sweep*(k+1)/n
        z=private_top-(private_top-2.6)*(k+1)/n
        poly=[]
        for j in range(6):
            t=a+(b-a)*j/5;poly.append((cx+ro*math.cos(t),cy+ro*math.sin(t)))
        for j in range(5,-1,-1):
            t=a+(b-a)*j/5;poly.append((cx+ri*math.cos(t),cy+ri*math.sin(t)))
        _prism(p.bm(m["oak"]),poly,z-.07,z)
        private_supports.append({"id":f"retreat-private-tread-{k+1}","polygon":[[x,-y] for x,y in reversed(poly)],"height":z})
        t=(a+b)/2;centers.append((cx+.95*math.cos(t),cy+.95*math.sin(t),z))
        pa=(cx+ro*math.cos(a),cy+ro*math.sin(a),z+.98)
        pb=(cx+ro*math.cos(b),cy+ro*math.sin(b),z+.98-(private_top-2.6)/n)
        cylinder(p.bm(m["bronze"]),pa,pb,.021,12)
        cylinder(p.bm(m["bronze"]),(pa[0],pa[1],z),(pa[0],pa[1],pa[2]),.008,8)
    cylinder(p.bm(m["bronze"]),(cx,cy,2.6),(cx,cy,private_top+1),.10,20)
    # A real top landing approaches the helix tangentially. Crossing the outer
    # handrail radially was a native-point success but a capsule failure.
    landing=[]
    for k in range(13):
        th=.60+(math.pi*.5-.60)*k/12
        landing.append((cx+(ro+.07)*math.cos(th),cy+(ro+.07)*math.sin(th)))
    for k in range(12,-1,-1):
        th=.60+(math.pi*.5-.60)*k/12
        landing.append((cx+ri*math.cos(th),cy+ri*math.sin(th)))
    _prism(p.bm(m["oak"]),landing,private_top-.085,private_top)
    private_supports.append({"id":"retreat-private-top-landing","polygon":[[x,-y] for x,y in reversed(landing)],"height":private_top})
    box(p.bm(m["stone"]),(entry[0],entry[1],private_top-.10),(.88,.96,.20),.025)
    private_supports.append(sunken.support("retreat-private-garden-pad",(entry[0]-.44,entry[0]+.44,entry[1]-.48,entry[1]+.48),private_top))
    cuts+=_cut(scene,"retreat private garden landing",(entry[0]-.45,entry[1]-.49,private_top-.21),
               (entry[0]+.45,entry[1]+.49,30),m["rock"])
    bm=bmesh.new()
    bmesh.ops.create_cone(bm,cap_ends=True,cap_tris=False,segments=64,radius1=ro+.08,radius2=ro+.08,depth=27.6,
                         matrix=Matrix.Translation((cx,cy,16.2)))
    data=bpy.data.meshes.new("retreat concealed circular private stair excavation");bm.to_mesh(data);bm.free();data.materials.append(m["rock"])
    cutter=bpy.data.objects.new(data.name,data);scene.collection.objects.link(cutter)
    for obj in _geology(scene)+[o for o in scene.objects if o.type=="MESH" and o.name.startswith("core_estate_garden") and not o.get("flora")]:
        result=shell.boolean_preserving_islands(obj,cutter)
        if not result.get("skippedDisjoint"):cuts.append({"mesh":obj.name,**result})
    bpy.data.objects.remove(cutter,do_unlink=True)
    _clear_stair_foliage(scene,centers,ro+.12)
    # Guard the actual circular shaft, with one deliberate garden-side entry gap.
    for k in range(52):
        a=2*math.pi*k/52;b=2*math.pi*(k+1)/52
        if abs((a-.65+math.pi)%(2*math.pi)-math.pi)<.38:continue
        r=ro+.13
        pa=(cx+r*math.cos(a),cy+r*math.sin(a),private_top+1.02)
        pb=(cx+r*math.cos(b),cy+r*math.sin(b),private_top+1.02)
        cylinder(p.bm(m["bronze"]),pa,pb,.021,10)
        if k%2==0:cylinder(p.bm(m["bronze"]),(pa[0],pa[1],private_top),(pa[0],pa[1],pa[2]),.009,8)
    # Real short side threshold reaches the sheltered onsen, with a cedar pocket
    # panel visibly parked beside the opening instead of another glass wall.
    end=centers[-1]
    box(p.bm(m["stone"]),(4.45,-15.45,2.48),(2.30,1.52,.24),.025)
    private_supports.append(sunken.support("retreat-private-threshold",(3.3,5.6,-16.21,-14.69),2.6))
    box(p.bm(m["oak"]),(4.57,-14.0,3.72),(.07,1.12,2.22),.025)
    box(p.bm(m["light"]),(4.52,-14.01,4.75),(.018,1.0,.02),.003)
    cuts+=_cut(scene,"retreat private onsen threshold excavation",(3.28,-16.23,2.40),(5.65,-14.60,5.18),m["plaster"])
    aperture=shell._box_object("retreat actual private plaster aperture",(4.20,-16.25,2.58),(5.70,-14.60,5.15),m["plaster"])
    for name in ("core__chalk limestone","core__honey ash","core__brushed brass"):
        obj=bpy.data.objects.get(name)
        if obj:cuts.append({"privateWall":name,"cut":shell.boolean_preserving_islands(obj,aperture)})
    bpy.data.objects.remove(aperture,do_unlink=True)
    objects+=p.finish()
    config["privateEntrance"]={"destination":"onsen","discreet":True,"glassDoor":False,
                               "route":[web((*entry,private_top)),web((cx+.95*math.cos(.9),cy+.95*math.sin(.9),private_top))]+[web(q) for q in centers]+[web((4.45,-15.45,2.6)),web((3.42,-15.35,2.6))],
                               "publicRoute":False,"headroomPerTurn":(private_top-2.6)*2*math.pi/sweep}
    config["clifftopLounge"]={"bounds":{"min":[x0,top,-y1],"max":[x1,top+2.5,-y0]},"seats":5,"ground":top,
                              "style":"low conversation seating, partial oak shade, unobstructed Pacific outlook"}
    for y in (-12.82,-9.18):
        config["installationLines"].append({"id":f"clifftop-lounge-{y}","a":web((5.6,y,top+2.27)),"b":web((9.9,y,top+2.27)),
                                            "intensity":.27,"schedule":"festoon","transport":False,
                                            "region":config["clifftopLounge"]["bounds"],"glowTag":"clifftop-lounge"})
    return objects,[support]+private_supports,{"cuts":cuts,"ground":top,"privateTop":private_top,"privateRoute":config["privateEntrance"]["route"]}


def build(scene,config,refine=None):
    if scene.get("inlandRetreatVersion")==VERSION:
        return [],{"retained":True,"version":VERSION}
    m=library.materials()
    report={"version":VERSION,"setback":SETBACK,"workstationNativeTranslation":WORKSTATION}
    # Retire the old two-level wing, long galleries and both fluted entry doors.
    report["retired"]=_remove_prefixes(scene,("core_estate_structure","core_estate_link_ceiling","core_estate_spine_ceiling",
        "core_estate_library_mezzanine","core_estate_library_stair","core_estate_library_facade","core_estate_library_glazing",
        "core_estate_library_ceiling","core_estate_arrival","core_estate_door_","core_estate_portal","library_","library-upper_","core_arrival_"))
    report["oldCentralStair"]=_retire_old_stair(scene)
    report["actualShortLinkAperture"]=_open_short_link(scene,m)
    report["retiredUncuratedFacadePots"]=_remove_prefixes(scene,("core_facade__terracotta","core_facade__olive_leaf",
        "core_facade__olive_bark_wood","core_facade__rosemary_leaf","study__olive leaf","study__terracotta"))
    for obj in scene.objects:
        if obj.name.startswith("core_estate_portal"):_move(obj,(0,-4.65,0))
    config["estateOutdoors"]["portal"]=_translate_tree(config["estateOutdoors"]["portal"],(0,0,4.65))
    for line in config.get("installationLines",[]):
        if line.get("id","").startswith("portal-"):
            for key in ("a","b"):line[key]=_point(line[key],(0,0,4.65-SETBACK))
            line["region"]=_translate_tree(line["region"],(0,0,4.65-SETBACK))
    # Office hardware, chair, keyboard, anchors and source lights remain one fitted
    # assembly. Native holders, papers, records and interactive props share delta.
    office=[]
    for obj in scene.objects:
        if obj.name.startswith(("study_","records_")) or obj.name=="anchor_study":
            _move(obj,WORKSTATION);office.append(obj.name)
    report["workstationObjects"]=office
    stair,stair_supports,stair_route=_curved_house_stair(scene,m)
    wing,wing_supports=_library_structure(scene,m)
    spiral,spiral_supports,spiral_route=_spiral(m)
    chill=_private_chill(m)
    objects=stair+wing+spiral+chill
    # The relocated hall door is an actual opening at both levels. No bathroom
    # geometry is modified: the short link passes in front of its sea-side wall.
    # Native geometry, including the mainland, is truly excavated after setback.
    config["terrain"]["supportSurfaces"]=[s for s in config["terrain"]["supportSurfaces"]
        if not s["id"].startswith(("estate-library-","estate-link-","estate-spine-","estate-vestibule-","arrival-","tread-"))]
    config["terrain"]["supportSurfaces"]+=stair_supports+wing_supports+spiral_supports
    _library_manifest(config,spiral_route)
    if refine:
        refined,refined_report=refine(scene,config)
        objects+=refined
        report["interior"]=refined_report
    config["estateDoors"]=[]
    config["navigation"]["stairs"]=[web((-2.18,-7.03,0))]+stair_route+[web((2.35,-7.03,2.6)),web((2.35,-6.1,2.6))]
    config["navigation"]["lowerStairApproach"]=[web((-2.55,-5.6,0)),web((-2.55,-7.03,0)),web((-2.18,-7.03,0))]
    report["terraceStructure"]=_slim_terrace(scene,m)
    # Remove obsolete gallery light definitions/receiver regions before relocation.
    for key in ("installationLines","installationPoints"):
        config[key]=[q for q in config[key] if not q.get("id","").startswith("gallery-")]
    for key in ("installationReceivers","lightTransportRegions"):
        if isinstance(config.get(key),dict):
            config[key]={k:v for k,v in config[key].items() if not k.startswith("gallery") and k!="library-upper"}
    _light_regions(config)
    _spatial_manifest(config)
    rack=config.get("equipment",{}).get("gym",{}).get("rack",{})
    if rack.get("posts",{}).get("z"):
        rack["posts"]["z"]=[q+SETBACK for q in rack["posts"]["z"]]
    # Match entire housing geometry to its transformed manifest. Actual sandstone
    # is never translated, nor outdoor garden/terrain/animal assets.
    moving=[]
    for obj in scene.objects:
        name=obj.name
        if name.startswith(("coast_","core_flora_","core_estate_garden","core_estate_portal")):
            continue
        if name in ("core__golden coastal sandstone","core__blue sage agave leaf") or obj.get("closedSolid"):
            continue
        if name.startswith(("core_","study_","sleep_","onsen_","kitchen_","lounge_","gym_","bath-","library","records_","anchor_")):
            if name=="anchor_outside":continue
            _move(obj,(0,-SETBACK,0));moving.append(name)
    report["movedHousingObjects"]=moving
    # New living excavation is the actual continued arch section, extended 8m
    # inland. Pool court and lower basin are cut independently, retaining bearing.
    cuts=[]
    arch=shell._prism("retreat main vault",shell.arch_points(),"y",-15.95,-3.35,m["plaster"])
    for obj in _geology(scene):
        result=shell.boolean_preserving_islands(obj,arch)
        if not result.get("skippedDisjoint"):cuts.append({"mesh":obj.name,"arch":result})
    bpy.data.objects.remove(arch,do_unlink=True)
    cuts+=_cut(scene,"retreat gym excavation",(5.8,-9.1,-.34),(11.2,-.9,3.7),m["plaster"])
    cuts+=_cut(scene,"retreat library excavation",(-12.72,-10.65,-.28),(-8.35,24.,5.80),m["plaster"])
    cuts+=_cut(scene,"retreat short library connection",(-9.82,-10.30,-.18),(-3.85,-8.26,5.18),m["plaster"])
    # Open court keeps the sea view and weather outdoors; the house's roof still
    # covers every inhabited room, including Walk with orbit cutaways hidden.
    cuts+=_cut(scene,"retreat outdoor court",(-8.43,-3.42,-.52),(8.08,30.,24),m["rock"],include_coast=False)
    cuts+=_cut(scene,"retreat pool rock basin",(-7.82,-1.12,-1.72),(3.02,3.68,.15),m["stone"])
    # The bathroom source has its own shape and two storeys, now genuinely set
    # back into undisturbed rock. Its clear opening does not rely on old cuts.
    cuts+=_cut(scene,"retreat bathroom wing",(-8.64,-14.45,-.30),(-4.37,-9.48,5.20),m["plaster"])
    # Existing sunken floors move with the home. Excavate their actual delivered
    # depths in the new rock, rather than leaving a 2cm sandstone cap over oak.
    for support in config["terrain"]["supportSurfaces"]:
        if support["id"] not in ("nook-floor","pit-floor"):continue
        xs=[q[0] for q in support["polygon"]];ys=[-q[1] for q in support["polygon"]]
        cuts+=_cut(scene,"retreat "+support["id"]+" rock clearance",
                   (min(xs)-.005,min(ys)-.005,support["height"]-.14),(max(xs)+.005,max(ys)+.005,.04),m["stone"])
    report["excavations"]=cuts
    entry,entry_supports,entry_report=_entry(scene,config,m)
    objects+=entry
    # _entry builds pre-transform geometry around fixed final coordinates and is
    # called after the common move, so apply only its own 8m setback now.
    for obj in entry:_move(obj,(0,-SETBACK,0))
    for support in entry_supports:
        support["polygon"]=[[q[0],q[1]+SETBACK] for q in support["polygon"]]
    config["terrain"]["supportSurfaces"]+=entry_supports
    report["entrance"]=entry_report
    clifftop,clifftop_supports,clifftop_report=_clifftop_retreat(scene,config,m)
    objects+=clifftop
    config["terrain"]["supportSurfaces"]+=clifftop_supports
    report["clifftop"]=clifftop_report
    report["lightWell"]=_lightwell(scene,config,m)
    report["roof"]=_partition_roof(scene,m)
    from coastal_camera import create_camera_height,sample_camera_elevations
    config["cameraCollision"]["elevations"]=sample_camera_elevations(config["cameraCollision"],create_camera_height(list(scene.objects)))
    config["habitatTransform"]={"translation":[0,0,SETBACK],
                                "studyTranslation":[WORKSTATION[0],WORKSTATION[2],-WORKSTATION[1]+SETBACK],
                                "coordinateSystem":"THREE world metres; source-authored housing only"}
    config["weatherShelters"]=[{"min":[-5.2,-.5,3.35],"max":[5.2,6.,15.95]},
                                {"min":[-12.72,-.2,.7],"max":[-8.35,5.8,10.65]},
                                {"min":[-8.64,-.3,9.48],"max":[-4.37,5.2,14.45]},
                                {"min":[5.8,-.3,.9],"max":[11.2,3.7,9.1]},
                                {"min":[3.65,0,-3.7],"max":[7.9,2.78,1.4]}]
    config["retreat"]={"version":VERSION,"setbackMetres":SETBACK,"houseOnly":True,
                       "libraryBounds":{k:([v[0]-SETBACK,v[1]-SETBACK] if k=="y" else v) for k,v in LIBRARY.items()},
                       "workstationNativeTranslation":WORKSTATION,"galleryPerch":[4.2,3.46,9.31],
                       "spiralRoute":[_point(q,(0,0,SETBACK)) for q in spiral_route],
                       "patioRoute":[web(q) for q in ((3.27,-9.2,0),(3.27,-5.1,0),(3.0,-3.5,0),(3.0,-2.4,0),(4.8,-2.4,0))],
                       "poolEdgeRoute":[web(q) for q in ((3.27,-9.2,0),(3.27,-5.1,0),(3.0,-3.5,0),(3.0,-2.4,0),(-1.5,-2.4,0),(-1.5,-1.65,0))]}
    scene["inlandRetreatVersion"]=VERSION
    scene["inlandRetreatSetback"]=SETBACK
    for obj in objects:obj["retreatRevision"]=VERSION
    finish_metadata(scene,config)
    threshold,threshold_report=repair_gym_connection(scene,config)
    objects+=threshold
    report["gymConnection"]=threshold_report
    from coastal_roof_planting import partition, ground_rosettes
    plants,plant_report=partition(scene)
    objects+=plants
    report["roofPlanting"]=plant_report
    _,report["agaveGrounding"]=ground_rosettes(scene)
    apply_companion_routes(config)
    report["finalAnchorsAndPerch"]=sync_anchors_and_coastal_perch(scene,config)
    report["westRabbitHabitat"]=sync_west_rabbit_habitat(scene,config)
    return objects,report
