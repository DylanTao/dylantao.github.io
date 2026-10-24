"""A grounded arrival garden and a supported, inhabitable pool terrace.

Original geometry for Sirui's retained coastal home. Native metres: +Z up,
+Y Pacific, +X north. This module never saves or exports: the coordinator applies
``build(scene, config)`` to the final architectural source, then bakes/exports once.
The legible load path is an architectural model, not structural certification.
"""
import json
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

import coastal_flora as flora
import coastal_shell as shell
import coastal_sunken as sunken
from coastal_decor import from_bmesh, lathe
from coastal_landscape import web
from coastal_office import Parts, box, cylinder, _mat

VERSION = 1
DECK = {"x": (-8.5, 8.0), "y": (4.58, 12.8), "floor": 0.0}
POOL = {"x": (-7.8, 3.0), "y": (6.90, 11.65), "surface": -.09,
        "deep": -1.44, "shelf": -.31, "bar": -.94, "laneBack": 9.3}
PAVILION = {"x": (3.65, 7.90), "y": (6.6, 11.7), "roof": 2.78}
GARDEN_CLEAR = (-6.2, 8.5, -22.5, -8.2)
GARDEN_PATH = ((3.42, -18.75), (3.42, -20.4), (1.6, -21.1),
               (-1.2, -20.3), (-3.5, -17.4), (-4.55, -13.5))
MEADOWS = ((-2.45, -16.7, 2.05, 2.55), (6.55, -17.3, 1.4, 3.1),
           (-4.8, -10.9, 1.0, 1.3))


def materials():
    get = bpy.data.materials.get
    return {"stone": get("warm cut stone"), "rock": get("golden coastal sandstone"),
            "paving": get("travertine paving stone"), "oak": get("pale oak"),
            "smoked": get("honey ash"), "bronze": get("brushed brass"),
            "nickel": get("polished nickel"), "linen": get("linen"),
            "dark": get("charcoal"), "glass": get("facade low-iron glass"),
            "tile": get("sea glass pool mosaic") or _mat("sea glass pool mosaic", (.12, .29, .27), .3),
            "water": get("infinity pool water") or _mat("infinity pool water", (.12, .37, .36), .13),
            "shell": _mat("ivory pool chaise ceramic", (.81, .79, .70), .31),
            "soil": _mat("garden mineral mulch", (.205, .175, .13), .96),
            "leaf": get("coastal sage leaf"), "stem": get("sage stem wood"),
            "grass": get("dry coastal grass leaf"), "flower": get("daisy flower"),
            "light": get("festoon bulb glass") or _mat("festoon bulb glass", (.95, .8, .56), .3, 0, (1, .74, .44), 1.2)}


def terrain_tree(scene):
    """Use retained evaluated triangles, including every current lift-away rock section."""
    vertices, triangles, names = [], [], []
    graph = bpy.context.evaluated_depsgraph_get()
    for obj in scene.objects:
        if obj.type != "MESH" or not (obj.name == "core__golden coastal sandstone" or
                                      obj.name == "coast_shared_golden coastal sandstone" or obj.get("caveRoof")):
            continue
        if obj.get("bathroomCeilingFor") or "plaster" in obj.name:
            continue
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        offset = len(vertices)
        vertices.extend(obj.matrix_world @ v.co for v in mesh.vertices)
        triangles.extend(tuple(offset + i for i in t.vertices) for t in mesh.loop_triangles)
        evaluated.to_mesh_clear()
        names.append(obj.name)
    if not triangles:
        raise RuntimeError("Estate planting requires retained native terrain triangles")
    return BVHTree.FromPolygons(vertices, triangles, all_triangles=True), names


def grounded(tree, x, y, minimum=5.0):
    hit, normal, index, _ = tree.ray_cast(Vector((x, y, 40)), Vector((0, 0, -1)), 60)
    if hit is None or hit.z < minimum or normal.z < .25:
        raise ValueError(f"No upward native garden support at {(x, y)}")
    return hit.z, index


def _prism(bm, polygon, z0, z1):
    """Closed vertical polygon with explicit correctly oriented caps."""
    lo = [bm.verts.new((x, y, z0)) for x, y in polygon]
    hi = [bm.verts.new((x, y, z1)) for x, y in polygon]
    bm.faces.new(list(reversed(lo)))
    bm.faces.new(hi)
    for k in range(len(lo)):
        j = (k + 1) % len(lo)
        bm.faces.new((lo[k], lo[j], hi[j], hi[k]))


def _tapered_pier(bm, x, root, front, width, under_pool=True):
    """A deep corbel meets a broad cliff socket instead of hanging on a pool lip."""
    top = POOL["deep"]-.384 if under_pool else -.40
    profile = [(root - .7, -5.9), (root - .7, top)]
    if under_pool:
        profile.extend(((front-.25, top), (front-.25,-.40)))
    profile.extend(((front, -.40), (front, -2.05), (root + 1.35, -5.35)))
    rings = [[bm.verts.new((xx, y, z)) for y, z in profile]
             for xx in (x - width / 2, x + width / 2)]
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[1])
    for k in range(len(profile)):
        j = (k + 1) % len(profile)
        bm.faces.new((rings[0][k], rings[0][j], rings[1][j], rings[1][k]))


def retire_previous(scene):
    """One-time narrow retirement of replaced terrace pieces; keep facade and fire nook."""
    if scene.get("estateOutdoorRetiredVersion", 0) >= VERSION:
        return json.loads(scene.get("estateOutdoorRetirementReport", "{}"))
    report = {"removedObjects": [], "removedIslands": {}}
    for obj in list(scene.objects):
        if obj.name.startswith("core_infinity_") or obj.name in (
                "core_terrace_festoon_bulbs", "core_facade__festoon_cable"):
            report["removedObjects"].append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    # The historical facade material batches combine glass/frame and terrace guard.
    # Delete complete guard/post islands, leaving the exact glazed facade at Y4.48.
    for name in ("core_facade__dark_bronze", "core_facade__facade_low-iron_glass"):
        obj = bpy.data.objects.get(name)
        if obj:
            _, removed = shell.edit_islands(obj, lambda lo, hi: False if lo.y > 4.57 else None)
            report["removedIslands"][name] = removed
    for name in ("core_facade__golden_coastal_sandstone", "core_facade__travertine_paving_stone"):
        obj = bpy.data.objects.get(name)
        if obj:
            # Old parapet/coping stand above the deck; the ledge and native paving remain below.
            _, removed = shell.edit_islands(obj, lambda lo, hi: False if lo.y > 4.57 and lo.z >= .025 and hi.z < .85 else None)
            report["removedIslands"][name] = removed
    # The original sculpted ledge was an open underside, unsuitable for an Exact Boolean:
    # its automatic cap could span the new basin. The new structure fully replaces it.
    # Preserve only the fire nook's explicit bench/plinth components in their exact place.
    for name,bounds in (("core_facade__golden_coastal_sandstone",((-5.3,4.9,-.05),(-4.6,6.95,.45))),
                        ("core_facade__travertine_paving_stone",((-4.3,5.7,-.1),(-3.6,6.5,.33)))):
        obj=bpy.data.objects.get(name)
        if obj:
            _,removed=shell.edit_islands(obj,lambda lo,hi:None if shell.inside(lo,hi,*bounds) else False)
            report["removedIslands"][name]=report["removedIslands"].get(name,0)+removed
    # Old bistro/loungers occupied the narrow promenade. The west fire nook remains at its
    # exact scheduled coordinates; the new island chairs are placed on a real sun shelf.
    for name in ("core_facade__weathered_teak_wood", "core_facade__outdoor_canvas_cotton"):
        obj = bpy.data.objects.get(name)
        if obj:
            _, removed = shell.edit_islands(obj, lambda lo, hi: False if lo.x > -3.1 and lo.y > 4.57 else None)
            report["removedIslands"][name] = removed
    # Move each rosemary pot and its complete leaf-card population together onto dry deck.
    # Their former Y≈7 position becomes water in the enlarged basin.
    for name in ("core_facade__terracotta","core_facade__rosemary_leaf"):
        obj=bpy.data.objects.get(name)
        if obj:
            moved,_=shell.edit_islands(obj,lambda lo,hi:(0,-.78,0) if hi.x<0 and lo.y>6.5 else None)
            report.setdefault("movedRosemaryIslands",{})[name]=moved
    scene["estateOutdoorRetiredVersion"] = VERSION
    scene["estateOutdoorRetirementReport"] = json.dumps(report)
    return report


def excavate_terrace(scene,m):
    """Fit the western deck/pool into the real projecting jamb, retaining the far coast."""
    if scene.get("estateTerraceCutVersion",0)>=VERSION:
        return json.loads(scene.get("estateTerraceCutReport","[]"))
    cutter=shell._box_object("estate western terrace excavation",(-8.39,4.58,-1.95),(-4.90,12.93,3.15),m["stone"])
    report=[]
    for obj in list(scene.objects):
        if obj.type!="MESH" or not (obj.name in ("core__golden coastal sandstone","coast_shared_golden coastal sandstone") or obj.get("caveRoof")):
            continue
        report.append({"mesh":obj.name,"cut":shell.boolean_preserving_islands(obj,cutter)})
    bpy.data.objects.remove(cutter,do_unlink=True)
    # The enlarged basin overlaps the former narrow terrace. Excise its real ledge/paving,
    # rather than concealing a solid slab just below the new water surface.
    aperture=shell._box_object("estate pool aperture",(-7.80,6.90,-1.95),(3.00,11.65,.09),m["stone"])
    for name in ("core_facade__golden_coastal_sandstone","core_facade__travertine_paving_stone"):
        obj=bpy.data.objects.get(name)
        if obj:report.append({"mesh":name,"poolAperture":shell.boolean_preserving_islands(obj,aperture)})
    bpy.data.objects.remove(aperture,do_unlink=True)
    scene["estateTerraceCutVersion"]=VERSION
    scene["estateTerraceCutReport"]=json.dumps(report)
    return report


def build_terrace(scene, config, tree, m):
    p = Parts("core_estate_terrace")
    stone, paving, bronze = p.bm(m["stone"]), p.bm(m["paving"]), p.bm(m["bronze"])
    x0, x1 = DECK["x"]
    y0, y1 = DECK["y"]
    px0, px1 = POOL["x"]
    py0, py1 = POOL["y"]
    # Four connected slabs make a real aperture: no hidden full slab crosses the swimming pool.
    rectangles = ((x0, x1, y0, py0), (x0, px0 - .22, py0, y1),
                  (px1 + .22, x1, py0, y1), (px0 - .22, px1 + .22, py1 + .23, y1))
    supports = []
    for k, (a, b, c, d) in enumerate(rectangles):
        box(stone, ((a+b)/2, (c+d)/2, -.25), (b-a, d-c, .50), .018, segments=2)
        # Large-format pavers use actual thin joints, with a bounded geometry count.
        nx, ny = max(1, math.ceil((b-a)/1.15)), max(1, math.ceil((d-c)/1.15))
        for i in range(nx):
            for j in range(ny):
                xx, yy = a+(i+.5)*(b-a)/nx, c+(j+.5)*(d-c)/ny
                box(paving, (xx, yy, -.012), ((b-a)/nx-.006, (d-c)/ny-.006, .026), .003, segments=1)
        supports.append(sunken.support(f"estate-deck-{k}", (a,b,c,d), .001))
    # Visible front edge girder and a deep pool ring beam distribute load to three piers.
    box(stone, ((x0+x1)/2, y1-.12, -.54), (x1-x0, .34, .98), .025, segments=2)
    box(stone, ((px0+px1)/2, py1+.10, -1.55), (px1-px0+.58, .40, .64), .025, segments=2)
    pier_report = []
    for x, width in ((-7.6, 1.15), (-2.45, 1.15), (5.75, 1.15)):
        hit, _, index, _ = tree.ray_cast(Vector((x, 27, -4.6)), Vector((0,-1,0)), 50)
        if hit is None:
            raise ValueError(f"No retained cliff socket for terrace pier {x}")
        root = hit.y - .40
        _tapered_pier(stone, x, root, y1-.22, width, under_pool=x<3.2)
        pier_report.append({"x":x, "width":width, "nativeCliffContact":list(hit),
                            "triangle":index, "socketOverlap":.70, "front":y1-.22})
    # A flush slot beside the basin reads as drainage and separates stone from the water.
    for x in (px0-.15, px1+.15):
        box(p.bm(m["dark"]), (x, (py0+py1)/2, .003), (.026, py1-py0, .009), .002, segments=1)
    # All dry edges get a visible guard. The sea-facing pool has its own low overflow edge.
    rail_paths = (((x0+.10,y0),(x0+.10,y1-.10)), ((x0+.10,y1-.10),(x1-.10,y1-.10)),
                  ((x1-.10,y1-.10),(x1-.10,6.45)))
    glass = Parts("core_estate_guard")
    for a,b in rail_paths:
        length = math.dist(a,b)
        n = math.ceil(length/1.25)
        for k in range(n):
            t0,t1 = k/n,(k+1)/n
            aa = Vector(a).lerp(Vector(b),t0)
            bb = Vector(a).lerp(Vector(b),t1)
            center=(aa+bb)/2
            yaw=math.atan2(bb.y-aa.y,bb.x-aa.x)
            box(glass.bm(m["glass"]), (center.x,center.y,.59), (length/n-.018,.014,1.02), 0,yaw=yaw)
        for k in range(n+1):
            q=Vector(a).lerp(Vector(b),k/n)
            cylinder(bronze, (q.x,q.y,0), (q.x,q.y,1.12), .012, 8)
        cylinder(bronze, (*a,1.12), (*b,1.12), .019, 10)
    objects=p.finish()+glass.finish()
    for obj in objects:
        obj["estateOutdoors"]=True
    config["terrace"]["region"]={"min":[x0-.2,-1.9,-y1-.2],"max":[x1+.2,3.4,-y0+.2]}
    return objects, supports, {"bounds":DECK,"dryAreaSquareMetres":round(sum((b-a)*(d-c) for a,b,c,d in rectangles),2),
                                "piers":pier_report,"structuralStatus":"Illustrated load path; no engineering certification"}


def _chaise(bm, x, y, base):
    """Closed sculpted wave-shell: raised head, low seat, upturned foot, no box chair."""
    controls=((-1.0,.64),(-.87,.75),(-.63,.69),(-.28,.41),(.12,.30),(.68,.32),(.99,.40))
    profile=[]
    for i in range(len(controls)-1):
        a,b,c,d=(Vector(controls[max(0,i-1)]),Vector(controls[i]),
                 Vector(controls[i+1]),Vector(controls[min(len(controls)-1,i+2)]))
        for k in range(6):
            t=k/6
            q=.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
            profile.append(tuple(q))
    profile.append(controls[-1])
    profile.extend(((1.03,.34),(.98,0),(.70,0),(.67,.25),(.12,.23),(-.28,.34),
                    (-.63,.61),(-.70,.24),(-.85,0),(-1.0,0)))
    rows=[]
    for side in (-1,1):
        rows.append([bm.verts.new((x+side*(.32+.035*math.cos(t*math.pi/2)),y+t,base+h)) for t,h in profile])
    bm.faces.new(list(reversed(rows[0])))
    bm.faces.new(rows[1])
    for k in range(len(profile)):
        j=(k+1)%len(profile)
        bm.faces.new((rows[0][k],rows[0][j],rows[1][j],rows[1][k]))


def build_pool(scene, config, m):
    p=Parts("core_estate_pool")
    stone,tile=p.bm(m["stone"]),p.bm(m["tile"])
    x0,x1=POOL["x"];y0,y1=POOL["y"]
    floor=POOL["deep"]
    # A real stepped basin: deep lane extends full width; shelf and stool bay are contiguous.
    box(stone,((x0+x1)/2,(y0+y1)/2,floor-.204),(x1-x0+.50,y1-y0+.50,.36),.02,segments=2)
    box(tile,((x0+x1)/2,(POOL["laneBack"]+y1)/2,floor-.012),(x1-x0,y1-POOL["laneBack"],.024),.003,segments=1)
    for a,b,z in ((x0,-3.3,POOL["shelf"]),(-3.3,.3,floor),(.3,x1,POOL["bar"])):
        if z>floor:
            box(stone,((a+b)/2,(y0+POOL["laneBack"])/2,(floor+z-.024)/2),(b-a,POOL["laneBack"]-y0,z-floor-.024),.005,segments=1)
        box(tile,((a+b)/2,(y0+POOL["laneBack"])/2,z-.012),(b-a,POOL["laneBack"]-y0,.024),.003,segments=1)
    for x in (x0-.12,x1+.12):
        box(stone,(x,(y0+y1)/2,(floor+.035)/2),(.24,y1-y0+.48,.035-floor),.015,segments=2)
        box(tile,(x+(.125 if x<x0 else -.125),(y0+y1)/2,(floor-.09)/2),(.024,y1-y0,-.09-floor),.003,segments=1)
        box(p.bm(m["paving"]),(x,(y0+y1)/2,.025),(.34,y1-y0+.54,.05),.012,segments=2)
    box(stone,((x0+x1)/2,y0-.12,(floor+.02)/2),(x1-x0,.24,.02-floor),.012,segments=2)
    box(tile,((x0+x1)/2,y1+.035,(floor-.08)/2),(x1-x0,.07,-.08-floor),.003,segments=1)
    # Catch trough sits behind the low infinity lip; perimeter deck has its own glass guard.
    box(p.bm(m["dark"]),((x0+x1)/2,y1+.14,-.15),(x1-x0,.18,.06),.004,segments=1)
    # Entry treads at the shelf's north end leave both chaises and the dry circulation clear.
    for k in range(7):
        z=-.18*(k+1)
        yy=y0+.16+k*.31
        box(tile,(-1.14,yy,(floor+z)/2),(1.25,.33,z-floor),.006,segments=2)
    for x in (-6.65,-5.20):
        _chaise(p.bm(m["shell"]),x,7.97,POOL["shelf"])
    # Two submerged round seats, a low underwater bench and a separate dry-side service counter.
    stool_positions=[]
    for y in (7.48,8.35):
        cylinder(p.bm(m["bronze"]),(2.42,y,POOL["bar"]),(2.42,y,-.46),.065,14)
        lathe(tile,[(.24,0),(.265,.025),(.265,.085),(.24,.105),(.01,.105)],(2.42,y,-.46),24)
        stool_positions.append(web((2.42,y,-.355)))
    box(tile,(.98,7.10,-.67),(1.05,.40,.38),.025,segments=2)
    objects=p.finish()
    water_bm=bmesh.new()
    bmesh.ops.create_grid(water_bm,x_segments=48,y_segments=26,size=1)
    for v in water_bm.verts:
        v.co=Vector(((x0+x1)/2+v.co.x*(x1-x0)/2,(y0+y1)/2+v.co.y*(y1-y0)/2,POOL["surface"]))
    water=from_bmesh("core_infinity_water",water_bm,m["water"],smooth=False)
    water["water"]=True;water["noBake"]=True;water["estateOutdoors"]=True
    bsdf=m["water"].node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Transmission Weight"].default_value=.82
    bsdf.inputs["IOR"].default_value=1.333
    zones=[{"id":"swim","bounds":[x0,x1,POOL["laneBack"],y1],"bottom":floor,"depth":1.35},
           {"id":"sun-shelf","bounds":[x0,-3.3,y0,POOL["laneBack"]],"bottom":POOL["shelf"],"depth":.22},
           {"id":"entry","bounds":[-3.3,.3,y0,POOL["laneBack"]],"bottom":floor,"steps":7,"riser":.18},
           {"id":"social","bounds":[.3,x1,y0,POOL["laneBack"]],"bottom":POOL["bar"],"depth":.85}]
    config["infinityPool"]={"center":web(((x0+x1)/2,(y0+y1)/2,POOL["surface"])),"size":[x1-x0,y1-y0],
                            "depth":1.35,"waterline":POOL["surface"],"node":water.name,"zones":zones,
                            "access":[web((-1.14,6.35,0)),web((-1.14,6.75,0))],"waveAmplitude":.004,
                            "seats":stool_positions,"safety":"Water remains excluded from first-person walking"}
    for obj in objects:
        obj["estateOutdoors"]=True
    return objects+[water], {"bounds":POOL,"zones":zones,"submergedSeats":stool_positions,
                             "swimLength":x1-x0,"surfaceVertices":len(water.data.vertices)}


def _dining_chair(p,m,x,y,yaw=0):
    rot=Matrix.Rotation(yaw,3,"Z")
    def co(a,b,z):
        q=rot@Vector((a,b,0));return(x+q.x,y+q.y,z)
    for a in (-.22,.22):
        for b in (-.22,.22):
            cylinder(p.bm(m["smoked"]),co(a,b,0),co(a*.88,b*.88,.46),.025,10)
    box(p.bm(m["oak"]),(x,y,.44),(.51,.51,.08),.03,yaw=yaw,segments=2)
    box(p.bm(m["linen"]),(x,y,.50),(.48,.47,.07),.03,yaw=yaw,segments=3)
    for a in (-.22,.22):
        cylinder(p.bm(m["smoked"]),co(a,-.22,.44),co(a,-.27,.87),.022,10)
    box(p.bm(m["oak"]),co(0,-.26,.77),(.51,.06,.25),.035,yaw=yaw,segments=3)


def _hollow_sink(bm,center,segments=32):
    """Closed metal wall around a real cavity and small drain, with no cap across the rim."""
    profile=((.24,0),(.24,.025),(.211,.025),(.18,-.13),(.04,-.15),(.008,-.15),
             (.008,-.17),(.045,-.17),(.20,-.15),(.235,-.02))
    rows=[[bm.verts.new((center[0]+r*math.cos(k*math.tau/segments),
                         center[1]+r*math.sin(k*math.tau/segments),center[2]+z))
           for k in range(segments)] for r,z in profile]
    for a,b in zip(rows,rows[1:]+rows[:1]):
        for k in range(segments):
            j=(k+1)%segments;bm.faces.new((a[k],a[j],b[j],b[k]))


def build_pavilion(scene, config, m):
    p=Parts("core_estate_pavilion")
    oak,bronze,stone=p.bm(m["oak"]),p.bm(m["bronze"]),p.bm(m["stone"])
    # Four stout timber columns and bronze shoes visibly support the slender roof.
    for x in (3.78,7.76):
        for y in (6.72,11.53):
            box(bronze,(x,y,.08),(.19,.19,.16),.008,segments=2)
            box(p.bm(m["smoked"]),(x,y,1.43),(.14,.14,2.70),.012,segments=2)
    for x in (3.78,7.76):
        box(oak,(x,9.10,2.72),(.18,5.10,.20),.014,segments=2)
    for y in (6.72,11.53):
        box(oak,(5.77,y,2.72),(4.22,.16,.20),.014,segments=2)
    for x in (3.78,7.76):
        box(p.bm(m["light"]),(x,9.125,2.615),(.025,4.78,.012),.003,segments=1)
    for y in (6.72,11.53):
        box(p.bm(m["light"]),(5.77,y,2.615),(3.98,.025,.012),.003,segments=1)
    # A weather cover over the kitchen and close slats over the sea-facing dining room.
    box(p.bm(m["smoked"]),(5.77,7.58,2.89),(4.45,2.13,.11),.025,segments=2)
    for k in range(19):
        box(oak,(5.77,8.72+k*.158,2.87),(4.42,.066,.12),.009,segments=2)
    # Sintered-stone wet bar between pool and cook's aisle. A true recessed sink, wall spout,
    # front fluting, chilled drawers and useful dry preparation surfaces make it inhabited.
    box(stone,(3.58,7.83,.47),(.56,2.40,.94),.035,segments=3)
    box(p.bm(m["paving"]),(3.58,7.83,.985),(.76,2.56,.09),.03,segments=3)
    for k in range(26):
        box(oak,(3.285,6.70+k*.088,.47),(.038,.042,.82),.009,segments=2)
    # The dry kitchenette sits at the pavilion rear, not in the arrival crosswalk.
    box(p.bm(m["smoked"]),(5.78,6.99,.46),(3.25,.64,.92),.018,segments=2)
    box(p.bm(m["paving"]),(5.78,6.99,.95),(3.36,.73,.07),.018,segments=2)
    for x in (4.55,5.13,6.43,7.04):
        box(oak,(x,7.323,.46),(.53,.025,.77),.015,segments=2)
        cylinder(bronze,(x-.11,7.35,.67),(x+.11,7.35,.67),.009,8)
    # Open barbecue grate, rounded hinged hood parked up, front controls and lower ventilation.
    box(p.bm(m["nickel"]),(5.81,6.99,1.00),(1.05,.58,.10),.025,segments=3)
    box(p.bm(m["dark"]),(5.81,6.99,1.055),(.92,.45,.012),.005,segments=1)
    for k in range(14):
        cylinder(p.bm(m["nickel"]),(5.39+k*.065,6.79,1.07),(5.39+k*.065,7.19,1.07),.009,8)
    box(p.bm(m["nickel"]),(5.81,6.72,1.25),(1.04,.15,.39),.08,pitch=-.18,segments=5)
    for x in (5.53,5.81,6.09):
        cylinder(bronze,(x,7.302,.87),(x,7.33,.87),.034,12)
    for k in range(9):
        box(p.bm(m["dark"]),(5.51+k*.075,7.325,.25),(.033,.012,.17),.003,segments=1)
    # A compact hollow prep sink and arched mixer occupy the north counter end.
    sink=Parts("core_estate_sink")
    _hollow_sink(sink.bm(m["nickel"]),(6.91,7.0,.985))
    cylinder(bronze,(7.21,6.84,.98),(7.21,6.84,1.24),.015,12)
    cylinder(bronze,(7.21,6.84,1.24),(7.03,6.95,1.24),.015,12)
    cylinder(bronze,(7.03,6.95,1.24),(7.03,6.95,1.18),.015,12)
    # Oval table, six coherent chairs; an unobstructed 1.2m aisle connects bar and dining.
    tx,ty=5.82,10.04
    for x in (5.17,6.47):
        box(stone,(x,ty,.36),(.24,.58,.72),.035,segments=3)
    _prism(p.bm(m["paving"]),[(tx+1.225*math.cos(k*math.tau/48),ty+.51*math.sin(k*math.tau/48))
                               for k in range(48)],.715,.805)
    for x in (5.04,5.82,6.60):
        _dining_chair(p,m,x,9.20,0)
        _dining_chair(p,m,x,10.90,math.pi)
    # Two quiet pendants, under-counter glow and one low brass lantern. Root binds their
    # bounded analytic emitters to the existing terrace schedule rather than adding PointLights.
    for x in (5.25,6.40):
        cylinder(bronze,(x,ty,2.75),(x,ty,2.24),.004,6)
        lathe(oak,[(.01,0),(.13,0),(.18,-.065),(.18,-.09),(.01,-.09)],(x,ty,2.22),24)
        cylinder(p.bm(m["light"]),(x,ty,2.125),(x,ty,2.14),.12,20)
    box(p.bm(m["light"]),(3.29,7.83,.905),(.014,2.13,.018),.003,segments=1)
    # A very small tray and two tumblers; no prop clutter obscures the architecture.
    box(oak,(3.58,8.45,1.045),(.38,.48,.035),.025,segments=3)
    for y in (8.32,8.56):
        lathe(p.bm(m["glass"]),[(.055,0),(.06,.13),(.049,.13),(.045,.012)],(3.58,y,1.065),16)
    objects=p.finish()+sink.finish()
    # The bowl genuinely passes through the countertop and cabinet. A display-only basin
    # sitting on an uncut counter would show a stone disc instead of a hollow sink.
    cutter=Parts("estate temporary sink aperture")
    cylinder(cutter.bm(m["nickel"]),(6.91,7.0,.78),(6.91,7.0,1.10),.211,32)
    tool=cutter.finish()[0]
    sink_cuts=[]
    for obj in objects:
        if obj.name in ("core_estate_pavilion__travertine paving stone","core_estate_pavilion__honey ash"):
            sink_cuts.append({"mesh":obj.name,"cut":shell.boolean_preserving_islands(obj,tool)})
    bpy.data.objects.remove(tool,do_unlink=True)
    for obj in objects:
        obj["estateOutdoors"]=True
    return objects,{"bounds":PAVILION,"diningSeats":6,"coveredKitchen":True,
                    "barCounter":web((3.58,7.83,.985)),"cookAisleWidth":1.18,"nativeSinkAperture":sink_cuts,
                    "lighting":[{"id":"pavilion-pendants","a":web((5.25,ty,2.13)),"b":web((6.4,ty,2.13)),"intensity":.34},
                                {"id":"wet-bar","a":web((3.29,6.82,.905)),"b":web((3.29,8.88,.905)),"intensity":.12}]}


def _ribbon(bm,tree,points,width,lift=.035,depth=.11):
    """A small contour-following closed ribbon, each station raycast to actual terrain."""
    rows=[]
    for i,q in enumerate(points):
        a,b=Vector(points[max(0,i-1)]),Vector(points[min(len(points)-1,i+1)])
        tangent=(b-a).normalized();normal=Vector((-tangent.y,tangent.x))
        row=[]
        for sign in (-1,1):
            p=Vector(q)+normal*sign*width/2
            z,_=grounded(tree,p.x,p.y)
            row.append((p.x,p.y,z+lift))
        rows.append([bm.verts.new(v) for v in row]+[bm.verts.new((v[0],v[1],v[2]-depth)) for v in row])
    for a,b in zip(rows,rows[1:]):
        bm.faces.new((a[0],b[0],b[1],a[1]))
        bm.faces.new((a[2],a[3],b[3],b[2]))
        bm.faces.new((a[0],a[2],b[2],b[0]))
        bm.faces.new((a[1],b[1],b[3],a[3]))
    bm.faces.new((rows[0][0],rows[0][2],rows[0][3],rows[0][1]))
    bm.faces.new((rows[-1][0],rows[-1][1],rows[-1][3],rows[-1][2]))


def _resample(points,spacing=.32):
    out=[]
    for a,b in zip(points,points[1:]):
        steps=max(1,math.ceil(math.dist(a,b)/spacing))
        out.extend(tuple(Vector(a).lerp(Vector(b),k/steps)) for k in range(steps))
    return out+[tuple(points[-1])]


def _clear_old_garden(scene):
    if scene.get("estateGardenClearedVersion",0)>=VERSION:
        return json.loads(scene.get("estateGardenClearingReport","{}"))
    x0,x1,y0,y1=GARDEN_CLEAR
    report={}
    for name,bounds in (("core__warm cut stone",((-2.0,-22.5,6.4),(2.4,-10.5,10.0))),
                        ("core_arrival__warm cut stone",((-.2,-19.2,6.4),(2.76,-17.9,9.0)))):
        obj=bpy.data.objects.get(name)
        if obj:
            _,n=shell.edit_islands(obj,lambda lo,hi:False if shell.inside(lo,hi,*bounds) and hi.z-lo.z<.30 else None)
            report[name+" obsolete path islands"]=n
    for obj in list(scene.objects):
        if obj.type!="MESH" or not obj.name.startswith("core_flora_") or "palm" in obj.name or "torrey" in obj.name:
            continue
        # Flora is composed of unconnected leaf cards. Remove only local triangles; no
        # approximate heights are used to reposition a remaining stem or a whole plant.
        bm=bmesh.new();bm.from_mesh(obj.data);mat=obj.matrix_world
        doomed=[f for f in bm.faces if any(x0<(mat@v.co).x<x1 and y0<(mat@v.co).y<y1 for v in f.verts)]
        n=len(doomed)
        if doomed:bmesh.ops.delete(bm,geom=doomed,context="FACES")
        loose=[v for v in bm.verts if not v.link_faces]
        if loose:bmesh.ops.delete(bm,geom=loose,context="VERTS")
        bm.to_mesh(obj.data);bm.free();obj.data.update()
        if n:report[obj.name]=n
    scene["estateGardenClearedVersion"]=VERSION
    scene["estateGardenClearingReport"]=json.dumps(report)
    return report


def build_portal(scene,m):
    """Layered mineral/timber portal around the unmodified upper stair and landing."""
    top=7.507202835352889
    retired={}
    if scene.get("estatePortalRetiredVersion",0)<VERSION:
        for name in ("core_arrival__pale oak","core_arrival__honey ash","core_arrival__golden coastal sandstone"):
            obj=bpy.data.objects.get(name)
            if obj:
                _,n=shell.edit_islands(obj,lambda lo,hi:False if shell.inside(lo,hi,(2.24,-18.85,7.49),(4.60,-16.94,10.1)) else None)
                retired[name]=n
        scene["estatePortalRetiredVersion"]=VERSION
        scene["estatePortalRetirementReport"]=json.dumps(retired)
    else:retired=json.loads(scene.get("estatePortalRetirementReport","{}"))
    p=Parts("core_estate_portal")
    stone,oak,bronze=p.bm(m["stone"]),p.bm(m["oak"]),p.bm(m["bronze"])
    # Rounded mineral fins sit outside the retained 1.6m stair: the approach stays generous.
    for x in (2.35,4.49):
        box(stone,(x,-18.0,top+1.12),(.24,1.96,2.24),.065,segments=5)
        for j in range(5):
            box(oak,(x+(.128 if x<3 else -.128),-18.65+j*.29,top+1.15),(.038,.065,1.70),.012,segments=2)
    box(stone,(3.42,-18.03,top+2.36),(2.92,2.52,.19),.095,segments=6)
    box(p.bm(m["smoked"]),(3.42,-18.03,top+2.235),(2.62,2.29,.075),.035,segments=3)
    for k in range(16):
        box(oak,(3.42,-19.08+k*.14,top+2.18),(2.60,.058,.06),.009,segments=2)
    # Concealed linear edge below the brow and two small handrail-height reveals.
    box(p.bm(m["light"]),(3.42,-19.11,top+2.19),(2.36,.018,.018),.003,segments=1)
    for x in (2.485,4.355):
        box(p.bm(m["light"]),(x,-18.03,top+.40),(.018,1.42,.018),.003,segments=1)
    # Quiet vertical brass reveal and one tactile stone plaque. No oversized invented branding.
    box(bronze,(2.216,-18.93,top+1.10),(.012,.035,1.90),.003,segments=1)
    box(stone,(4.64,-18.57,top+.69),(.06,.52,.28),.035,segments=4)
    objects=p.finish()
    for obj in objects:obj["estateOutdoors"]=True
    return objects,{"retiredCanopyIslands":retired,"stairTop":top,"clearWidth":1.9,
                    "lighting":[{"id":"portal-brow","a":web((2.24,-19.11,top+2.19)),
                                 "b":web((4.60,-19.11,top+2.19)),"intensity":.11}],
                    "preserved":"All existing stair treads, landing slabs and bronze handrails"}


def build_garden(scene,config,tree,m):
    clearing=_clear_old_garden(scene)
    p=Parts("core_estate_garden")
    stone,oak=p.bm(m["stone"]),p.bm(m["oak"])
    roots=[]
    # Keep the original palm's rich crown and sway weights, but relocate the entire plant
    # from the excavated stair to a real uncut native support beside the new meadow.
    palm_to=(7.25,-17.0)
    gz,triangle=grounded(tree,*palm_to)
    moved=[]
    if scene.get("estatePalmRelocatedVersion",0)<VERSION:
        delta=Vector((palm_to[0]-2.9,palm_to[1]+12.7,gz-7.260490608215332))
        for name in ("core_flora_palm_trunk","core_flora_palm_fronds"):
            obj=bpy.data.objects.get(name)
            if obj:
                for v in obj.data.vertices:v.co+=obj.matrix_world.inverted().to_3x3()@delta
                obj.data.update();moved.append(name)
        scene["estatePalmRelocatedVersion"]=VERSION
    roots.append({"kind":"retained-palm","point":[*palm_to,gz],"triangle":triangle,"rootEmbed":.20})
    # Mineral path follows the contour, with real thickness beneath every sampled station.
    path=_resample(GARDEN_PATH)
    _ribbon(p.bm(m["paving"]),tree,path,1.38,lift=.025,depth=.14)
    # Fine edging makes three deliberate meadow beds, instead of triangular green turf.
    # Mineral mulch is also conformed to actual triangles, and edging stops at the path.
    for cx,cy,rx,ry in MEADOWS:
        points=[(cx+rx*math.cos(k*math.tau/72),cy+ry*math.sin(k*math.tau/72)) for k in range(73)]
        groups=[];current=[]
        for q in points:
            if flora.clear_of([GARDEN_PATH],q[0],q[1],.88):
                current.append(q)
            elif current:
                if len(current)>1:groups.append(current)
                current=[]
        if len(current)>1:groups.append(current)
        for group in groups:_ribbon(stone,tree,group,.10,lift=.11,depth=.22)
        bm=p.bm(m["soil"])
        rings=[]
        for ri in range(1,7):
            r=ri/6*.95
            ring=[]
            for k in range(48):
                x,y=cx+rx*r*math.cos(k*math.tau/48),cy+ry*r*math.sin(k*math.tau/48)
                z,_=grounded(tree,x,y)
                ring.append(bm.verts.new((x,y,z+.012)))
            rings.append(ring)
        z,_=grounded(tree,cx,cy);center=bm.verts.new((cx,cy,z+.012))
        for k in range(48):
            j=(k+1)%48;bm.faces.new((center,rings[0][k],rings[0][j]))
            for a,b in zip(rings,rings[1:]):bm.faces.new((a[k],b[k],b[j],a[j]))
    # Two low stone-backed oak benches are set on small native-grounded view courts. Each
    # support is individually rooted; no bench floats across the slope under a broad flat slab.
    seats=[]
    for cx,cy,yaw in ((-4.45,-12.8,-.18),(5.75,-20.05,.36)):
        z,_=grounded(tree,cx,cy)
        box(oak,(cx,cy,z+.46),(2.0,.56,.10),.055,yaw=yaw,segments=3)
        for sign in (-1,1):
            dx,dy=sign*.76*math.cos(yaw),sign*.76*math.sin(yaw)
            foot,_=grounded(tree,cx+dx,cy+dy)
            box(stone,(cx+dx,cy+dy,(foot+z+.41)/2),(.20,.45,z+.41-foot+.10),.025,yaw=yaw,segments=2)
        box(stone,(cx+math.sin(yaw)*.28,cy-math.cos(yaw)*.28,z+.55),(2.16,.18,.92),.06,yaw=yaw,segments=3)
        seats.append(web((cx,cy,z+.46)))
    # Restrained low lanterns sit below the eye; no glowing pole competes with the view.
    fixture_points=[]
    for x,y in ((2.40,-20.28),(-.54,-19.84),(-3.85,-16.72),(5.1,-18.9)):
        z,_=grounded(tree,x,y)
        box(p.bm(m["smoked"]),(x,y,z+.19),(.075,.075,.38),.009,segments=2)
        box(p.bm(m["light"]),(x,y,z+.285),(.085,.085,.025),.008,segments=2)
        box(p.bm(m["bronze"]),(x,y,z+.325),(.14,.14,.04),.009,segments=2)
        fixture_points.append(web((x,y,z+.285)))
    rng=random.Random(102326)
    plant_parts={k:flora.Sway() for k in ("leaf","stem","grass","flower")}
    # Three botanical families, clustered rather than scattered props. Every actual root
    # carries its retained triangle index so verification can repeat the exact contact.
    for index in range(145):
        cx,cy,rx,ry=MEADOWS[index%len(MEADOWS)]
        t=rng.uniform(0,math.tau);r=math.sqrt(rng.uniform(.05,.83))
        x,y=cx+rx*r*math.cos(t),cy+ry*r*math.sin(t)
        if not flora.clear_of([GARDEN_PATH],x,y,.94):continue
        if 2.2<x<4.7 and -19.4<y<-8:continue
        z,tri=grounded(tree,x,y)
        if index%6==0:
            flora.shrub(plant_parts["leaf"],plant_parts["stem"],plant_parts["flower"],x,y,z-.015,
                        rng.uniform(.32,.55),rng,index%12==0)
            kind="sage"
        else:
            flora.grass(plant_parts["grass"],x,y,z-.015,rng)
            kind="grass"
        roots.append({"kind":kind,"point":[round(x,6),round(y,6),round(z,6)],"triangle":tri,"rootEmbed":.015})
    objects=p.finish()
    for key,collector in plant_parts.items():
        if collector.bm.faces:
            obj=collector.finish(f"core_estate_garden_flora_{key}",m[key]);obj["flora"]=True
            objects.append(obj)
        else:collector.bm.free()
    for obj in objects:obj["estateOutdoors"]=True
    return objects,{"clearedOldFaces":clearing,"retainedPalmMeshesMoved":moved,"path":list(GARDEN_PATH),
                    "pathWidth":1.38,"roots":roots,"viewSeats":seats,"pathLights":fixture_points,
                    "grounding":"Evaluated retained-source BVH triangles; no analytic height approximation"}


def build(scene, config):
    """Idempotently add the outdoor estate to the coordinator's current architecture."""
    for obj in list(scene.objects):
        if obj.get("estateOutdoors"):
            bpy.data.objects.remove(obj,do_unlink=True)
    retirement=retire_previous(scene)
    cuts=excavate_terrace(scene,materials())
    tree,terrain_names=terrain_tree(scene)
    m=materials()
    for key,value in m.items():
        if value is None:raise ValueError(f"Missing retained material {key}")
    terrace,supports,terrace_report=build_terrace(scene,config,tree,m)
    pool,pool_report=build_pool(scene,config,m)
    pavilion,pavilion_report=build_pavilion(scene,config,m)
    garden,garden_report=build_garden(scene,config,tree,m)
    all_objects=terrace+pool+pavilion+garden
    existing=config["terrain"]["supportSurfaces"]
    existing[:]=[s for s in existing if not s["id"].startswith(("estate-","infinity-deck"))]
    existing.extend(supports)
    portal,portal_report=build_portal(scene,m)
    all_objects+=portal
    config["estateOutdoors"]={"version":VERSION,"coordinateSystem":"Blender +Z up, +Y Pacific",
                              "terrace":terrace_report,"pool":pool_report,
                              "pavilion":pavilion_report,"garden":garden_report,"portal":portal_report}
    # Keep old emitter count: canopy-integrated strips use the former terrace schedule.
    config["terrace"]["festoon"]={"points":[web(v) for v in ((3.78,6.72,2.70),(3.78,11.53,2.70),
                    (7.76,11.53,2.70),(7.76,6.72,2.70),(3.78,6.72,2.70))],"sag":0,"bulbs":[],
                    "type":"concealed pavilion perimeter strips"}
    report={"version":VERSION,"terrainMeshes":terrain_names,"retirement":retirement,
            "terrace":terrace_report,"pool":pool_report,"pavilion":pavilion_report,"garden":garden_report,
            "portal":portal_report,"excavation":cuts,
            "meshes":len(all_objects),"vertices":sum(len(o.data.vertices) for o in all_objects),
            "triangles":sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in all_objects),
            "supportSurfaces":len(supports),"newTextures":0,"newNativeLights":0}
    scene["estateOutdoorVersion"]=VERSION
    return all_objects,report
