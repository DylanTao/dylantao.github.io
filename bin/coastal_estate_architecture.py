"""A carved two-storey library and a private, legible arrival threshold.

Original native geometry, in Blender metres (+Y sea, +Z up). This extends the
retained house; it never regenerates a bathroom, avatar, terrain perimeter or
interactive desk. Excavations preserve disjoint native geological components.
"""
import math
import random

import bpy
import bmesh
from mathutils import Vector

import coastal_shell as shell
import coastal_sunken as sunken
from coastal_landscape import web
from coastal_office import Parts, box, cylinder, _mat


LIBRARY = {"x": (11.55, 15.55), "y": (-.20, 9.45), "upperFront": 6.05,
           "rise": 2.6, "ceiling": 5.65}
# Local joinery coordinates are reflected and translated once into the actual
# screen-right (negative-X) native wing. The hall runs BEHIND the bathrooms.
LINK = {"x": (7.20, 12.95), "y": (-11.30, -9.90), "height": 2.38}
SPINE = {"x": (11.55, 12.95), "y": (-9.90, -.20)}
VESTIBULE = {"x": (5.45, 7.55), "y": (-11.35, -10.20)}
STAIR = {"x": (11.74, 12.86), "y": (.95, 5.15), "count": 16}
PREFIXES = ("core_estate_structure", "core_estate_link_ceiling_", "core_estate_spine_ceiling_",
            "core_estate_library_", "core_estate_arrival", "core_estate_door_",
            "library_", "library-upper_")


def native(point):
    x,y,z=point
    return (3.0-x,y+2.70,z)


def wing_web(point):
    return web(native(point))


def place(obj):
    """Reflect actual mesh coordinates and orient the solid's faces correctly."""
    bm=bmesh.new()
    bm.from_mesh(obj.data)
    for vertex in bm.verts:
        vertex.co=Vector(native(vertex.co))
    bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return obj


def materials():
    get = bpy.data.materials.get
    return {"stone": get("warm cut stone"), "plaster": get("chalk limestone"),
            "rock": get("golden coastal sandstone"), "oak": get("pale oak"),
            "smoked": get("honey ash"), "bronze": get("brushed brass"),
            "linen": get("linen"), "ink": get("charcoal"),
            "travertine": get("honed travertine") or get("warm cut stone"),
            "glass": get("facade low-iron glass"),
            "doorGlass": _mat("estate fluted bronze glass", (.28, .30, .27), .15, alpha=.34),
            "paper": _mat("library warm paper edges", (.65, .59, .46), .9),
            "bookOlive": _mat("library olive cloth", (.18, .23, .17), .88),
            "bookOchre": _mat("library ochre cloth", (.45, .28, .10), .88),
            "bookBrick": _mat("library clay cloth", (.35, .16, .12), .88),
            "bookBlue": _mat("library slate cloth", (.13, .19, .23), .88),
            "light": _mat("estate warm opal diffuser", (.87, .73, .51), .4, 0,
                           (1.0, .72, .39), 1.7)}


def panel(name, mat, center, size, radius=.01, **tags):
    p = Parts(name)
    box(p.bm(mat), center, size, radius)
    objects = p.finish()
    for obj in objects:
        for key, value in tags.items():
            obj[key] = value
    return objects


def _remove(scene):
    for obj in list(scene.objects):
        if obj.name.startswith(PREFIXES) and not obj.get("closedSolid"):
            bpy.data.objects.remove(obj, do_unlink=True)


def arch_profile():
    x0, x1 = LIBRARY["x"]
    c, r = (x0+x1)/2, (x1-x0)/2+.12
    return [(c-r, -.30), (c+r, -.30)] + [
        (c+r*math.cos(k*math.pi/40), 3.85+1.95*math.sin(k*math.pi/40))
        for k in range(41)]


def excavate(scene, m):
    if scene.get("estateLibraryCutVersion", 0) >= 1:
        return {"retained": True, "version": 1}
    tools = [shell._prism("estate library vault tool", arch_profile(), "y", -.40, 16.0, m["plaster"]),
             shell._box_object("estate library spine tool", (11.40, -11.45, -.20), (13.10, -.10, 5.20), m["plaster"])]
    for f in (0.0, 2.6):
        tools.append(shell._box_object("estate private link tool", (7.05, -11.45, f-.12),
                                       (13.10, -9.75, f+2.46), m["plaster"]))
        tools.append(shell._box_object("estate bedroom rear vestibule tool", (5.30,-11.50,f-.12),
                                       (7.70,-10.0,f+2.46),m["plaster"]))
    for tool in tools:
        place(tool)
    reports = []
    for obj in list(scene.objects):
        if obj.type != "MESH" or not (obj.name in ("core__golden coastal sandstone", "coast_shared_golden coastal sandstone") or obj.get("caveRoof")):
            continue
        cuts = [shell.boolean_preserving_islands(obj, tool) for tool in tools]
        reports.append({"mesh": obj.name, "cuts": cuts})
    for tool in tools:
        bpy.data.objects.remove(tool, do_unlink=True)
    # The actual rock above the new occupied wing lifts, while its enclosing
    # walls and the mainland perimeter remain connected and permanently present.
    mainland = bpy.data.objects["core__golden coastal sandstone"]
    tool = shell._box_object("estate library roof partition", (11.38, -11.43, 5.78),
                             (15.80, 9.48, 26), m["rock"])
    place(tool)
    roof = mainland.copy()
    roof.data = mainland.data.copy()
    scene.collection.objects.link(roof)
    shell.boolean(roof, tool, "INTERSECT")
    shell.boolean_preserving_islands(mainland, tool)
    bpy.data.objects.remove(tool, do_unlink=True)
    roof.name = roof.data.name = "core_estate_library_liftaway_roof"
    for k in list(roof.keys()):
        del roof[k]
    roof["caveRoof"] = True
    roof["closedSolid"] = True
    roof["estateArchitecture"] = True
    report = {"mainlandOpenEdges": shell.clean_solid(mainland), "roofOpenEdges": shell.clean_solid(roof)}
    assert report["mainlandOpenEdges"] == 0 and report["roofOpenEdges"] == 0, report
    scene["estateLibraryCutVersion"] = 1
    return {"version": 1, "cuts": reports, **report}


def _floor(p, material, bounds, height, width=.22):
    xa, xb, ya, yb = bounds
    n = max(1, math.ceil((xb-xa)/width))
    for k in range(n):
        a, b = xa+(xb-xa)*k/n, xa+(xb-xa)*(k+1)/n
        box(p.bm(material), ((a+b)/2, (ya+yb)/2, height-.011),
            (b-a-.002, yb-ya, .022), .002, segments=1)


def structure(scene, m):
    p = Parts("core_estate_structure")
    stone, plaster = p.bm(m["stone"]), p.bm(m["plaster"])
    xa, xb = LIBRARY["x"]
    ya, yb = LIBRARY["y"]
    supports, objects = [], []
    box(stone, ((xa+xb)/2, (ya+yb)/2, -.14), (xb-xa+.24, yb-ya+.24, .28), .012)
    # A broad stepped bearing is embedded well behind the original cliff face;
    # the seaward floor is visibly a carved masonry ledge, not a thin cantilever.
    for z, y0, y1 in ((-1.46, 6.75, 8.65), (-.92, 6.75, 9.10), (-.38, 6.75, 9.57)):
        box(p.bm(m["rock"]), ((xa+xb)/2,(y0+y1)/2,z),
            (xb-xa+.46,y1-y0,.72), .10)
    for x in (xa-.12,xb+.12):
        box(stone,(x,8.80,1.72),(.24,1.50,3.50),.045)
    supports.append(sunken.support("estate-library-ground", (xa, xb, ya, yb), 0))
    # Long gallery connection is real floor and enclosing plaster, not a route
    # through the retained rock. Both levels are supported independently.
    for f in (0.0, 2.6):
        for name, b in (("vestibule",(*VESTIBULE["x"],*VESTIBULE["y"])),("link", (*LINK["x"], *LINK["y"])), ("spine", (*SPINE["x"], *SPINE["y"]))):
            x0, x1, y0, y1 = b
            box(stone, ((x0+x1)/2, (y0+y1)/2, f-.13), (x1-x0, y1-y0, .26), .009)
            _floor(p, m["oak"], b, f)
            supports.append(sunken.support(f"estate-{name}-{f:g}", b, f))
        # The two parallel wall planes stop short of existing rooms' rear aisle.
        box(plaster, (10.075, -11.36, f+1.18), (5.75, .12, 2.36), .025)
        box(plaster, (9.375, -9.84, f+1.18), (4.35, .12, 2.36), .025)
        box(plaster, (11.49, -5.05, f+1.18), (.12, 9.70, 2.36), .025)
        box(plaster, (13.01, -5.05, f+1.18), (.12, 9.70, 2.36), .025)
        box(plaster,(6.50,-11.41,f+1.18),(2.10,.12,2.36),.025)
        box(plaster,(5.39,-10.775,f+1.18),(.12,1.15,2.36),.025)
        # Recessed oak reveals and one continuous warm line give the long
        # connection a deliberate rhythm without freestanding corridor clutter.
        for x in (7.7,9.2,10.7,12.2):
            box(p.bm(m["smoked"]),(x,-11.276,f+1.19),(.045,.055,2.30),.008)
        box(p.bm(m["oak"]),(10.075,-11.244,f+2.27),(5.4,.075,.10),.012)
        box(p.bm(m["light"]),(10.075,-11.198,f+2.255),(5.3,.014,.018),.004)
        box(p.bm(m["oak"]),(12.984,-5.05,f+2.27),(.075,9.45,.10),.012)
        box(p.bm(m["light"]),(12.938,-5.05,f+2.255),(.014,9.35,.018),.004)
        objects += panel(f"core_estate_link_ceiling_{f:g}", m["plaster"], (10.075, -10.60, f+2.43),
                         (5.75, 1.58, .10), .01, caveRoof=f>0, roomCeilingFor="library" if f==0 else "library-upper")
        objects += panel(f"core_estate_spine_ceiling_{f:g}", m["plaster"], (12.25, -5.05, f+2.43),
                         (1.58, 9.70, .10), .01, caveRoof=f>0, roomCeilingFor="library" if f==0 else "library-upper")
        objects += panel(f"core_estate_link_ceiling_vestibule_{f:g}",m["plaster"],(6.50,-10.775,f+2.43),
                         (2.10,1.15,.10),.01,caveRoof=f>0,roomCeilingFor="library" if f==0 else "library-upper")
    _floor(p, m["oak"], (xa, xb, ya, yb), 0)
    # The gallery has a genuine stair void. Its last 4.1 m are an open,
    # double-height reading room, so both floors share the tall Pacific aperture.
    upper_rectangles = [(12.98, xb, ya, LIBRARY["upperFront"]),
                        (xa, 12.98, ya, .80), (xa, 12.98, 5.15, LIBRARY["upperFront"])]
    upper_finish=Parts("core_estate_library_mezzanine_finish")
    for k, b in enumerate(upper_rectangles):
        x0,x1,y0,y1=b
        objects += panel(f"core_estate_library_mezzanine_{k}", m["stone"], ((x0+x1)/2,(y0+y1)/2,2.47),
                         (x1-x0,y1-y0,.26), .01, roomCeilingFor="library")
        _floor(upper_finish,m["oak"],b,2.6)
        supports.append(sunken.support(f"estate-library-mezzanine-{k}",b,2.6))
    for obj in upper_finish.finish():
        obj["roomCeilingFor"]="library"
        objects.append(obj)
    # Fitted stone jambs and rough, visible sandstone returns flank the book
    # walls; the room reads as a carved cave rather than a glazed freestanding box.
    for x in (xa-.065, xb+.065):
        box(plaster, (x, (ya+5.50)/2, 2.80), (.13, 5.50-ya, 5.60), .045)
    box(plaster, ((13.08+xb)/2, -.29, 2.80), (xb-13.08,.18,5.60), .045)
    # An upper coffer follows the carved vault and stops behind the crown glass.
    objects += panel("core_estate_library_ceiling", m["plaster"], ((xa+xb)/2,2.55,5.64),
                     (xb-xa,5.50,.10), .025, caveRoof=True, roomCeilingFor="library-upper")
    objects += p.finish()
    return objects, supports


def _guard(p, m, a, b, floor):
    cylinder(p.bm(m["smoked"]), (*a, floor+.99), (*b, floor+.99), .025, 12)
    n=max(1,math.ceil(math.dist(a,b)/.11))
    for k in range(n+1):
        t=k/n
        x,y=a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t
        cylinder(p.bm(m["bronze"]),(x,y,floor+.02),(x,y,floor+.97),.007,8)


def stair_and_gallery(m):
    p=Parts("core_estate_library_stair")
    xa,xb=STAIR["x"]
    ya,yb=STAIR["y"]
    supports=[]
    n=STAIR["count"]
    for k in range(n):
        a,b=ya+(yb-ya)*k/n,ya+(yb-ya)*(k+1)/n
        z=(k+1)*2.6/n
        box(p.bm(m["smoked"]),((xa+xb)/2,(a+b)/2,z-.075),(xb-xa,b-a+.008,.15),.012)
        box(p.bm(m["oak"]),((xa+xb)/2,(a+b)/2,z-.014),(xb-xa-.015,b-a-.002,.028),.005)
        supports.append(sunken.support(f"estate-library-tread-{k+1}",(xa,xb,a,b),z))
    for x in (xa+.035,xb-.035):
        cylinder(p.bm(m["bronze"]),(x,ya,.92),(x,yb,3.52),.019,12)
        for k in range(0,n+1,2):
            y,z=ya+(yb-ya)*k/n,2.6*k/n
            cylinder(p.bm(m["bronze"]),(x,y,z),(x,y,z+.92),.009,8)
    for a,b in (((12.98,.80),(12.98,5.27)),((11.55,6.02),(15.55,6.02))):
        _guard(p,m,a,b,2.6)
    return p.finish(),supports


def _books(p,m,x,y,floor,side,seed,length=4.35):
    """One long book wall: real book blocks, thin covers and readable shelf edges."""
    rng=random.Random(seed)
    oak=p.bm(m["smoked"])
    box(oak,(x,y,floor+1.14),(.055,length,2.28),.012)
    for j in range(5):
        z=floor+.14+j*.43
        box(oak,(x-side*.14,y,z),(.36,length+.03,.037),.009)
        cursor=y-length/2+.105
        while cursor<y+length/2-.155:
            thick=rng.uniform(.035,.075)
            height=rng.uniform(.24,.355)
            depth=rng.uniform(.19,.245)
            if cursor+thick>y+length/2-.135:break
            material=m[rng.choice(("bookOlive","bookOchre","bookBrick","bookBlue"))]
            xx=x-side*(.035+depth/2)
            box(p.bm(m["paper"]),(xx,cursor+thick/2,z+.024+height/2),
                (depth-.012,thick-.009,height-.012))
            for yy in (cursor+.003,cursor+thick-.003):
                box(p.bm(material),(xx,yy,z+.024+height/2),(depth,.006,height))
            box(p.bm(material),(x-side*(.035+depth),cursor+thick/2,z+.024+height/2),
                (.008,thick,height))
            cursor+=thick+.008
    for yy in (y-length/2-.025,y,y+length/2+.025):
        box(oak,(x-side*.14,yy,floor+1.14),(.36,.035,2.28),.006)


def furniture(m,room=None):
    if room is not None and room not in ("library","library-upper"):
        raise ValueError(f"Unknown estate furniture room: {room}")
    out=[]
    for id,f in (("library",0.0),("library-upper",2.6)):
        if room is not None and id!=room:
            continue
        p=Parts(id)
        # A two-level book wall on the sheltered east side, mirrored lower
        # shelving to the west beyond the staircase. All books share six batches.
        _books(p,m,15.43,2.20 if f else 2.62,f,1,37+int(f*10),length=3.70 if f else 4.35)
        if not f:
            _books(p,m,11.67,7.0,0,-1,71)
        # Cove light is set into real oak joinery, with metadata for the runtime's
        # existing analytic-line lighting rather than extra shadowed point lights.
        box(p.bm(m["light"]),(15.22,2.20 if f else 2.62,f+2.27),(.015,3.54 if f else 4.20,.022),.004)
        if f:
            # Private ocean-view writing table, two waterfall legs, leather pad,
            # a task light and one intentionally open paper book.
            # The east-side 82cm passage joins the stair landing to the rear
            # office. A wall-to-wall desktop would strand the landing at sea.
            box(p.bm(m["travertine"]),(14.60,4.55,3.35),(1.60,.72,.065),.035)
            for x in (14.0,15.20):
                box(p.bm(m["travertine"]),(x,4.55,2.96),(.085,.63,.72),.025)
            box(p.bm(m["ink"]),(14.55,4.56,3.388),(.72,.38,.008),.015)
            box(p.bm(m["paper"]),(15.03,4.58,3.407),(.32,.25,.028),.006)
            cylinder(p.bm(m["bronze"]),(14.0,4.71,3.39),(14.0,4.71,3.83),.012,12)
            cylinder(p.bm(m["bronze"]),(14.0,4.71,3.83),(14.30,4.71,3.83),.012,12)
            cylinder(p.bm(m["light"]),(14.30,4.71,3.80),(14.30,4.71,3.84),.07,20)
            _chair(p,m,(14.60,3.64,2.6),0)
        else:
            # Ocean-facing twin reading chairs, a low carved table, and a
            # continuous upholstered window seat beneath the double-height void.
            for x in (12.62,14.40):
                _chair(p,m,(x,6.70,0),0)
            box(p.bm(m["travertine"]),(13.55,7.38,.35),(.86,.66,.12),.10)
            box(p.bm(m["travertine"]),(13.55,7.38,.15),(.40,.38,.28),.07)
            box(p.bm(m["paper"]),(13.55,7.38,.425),(.31,.23,.025),.005)
            box(p.bm(m["smoked"]),(13.55,9.10,.29),(3.55,.52,.45),.06)
            box(p.bm(m["linen"]),(13.55,9.08,.56),(3.43,.48,.15),.065)
            for x in (12.10,15.0):
                box(p.bm(m["linen"]),(x,9.23,.80),(.52,.14,.39),.06,pitch=.15)
            cylinder(p.bm(m["bronze"]),(15.04,7.62,.02),(15.04,7.62,1.55),.018,12)
            cylinder(p.bm(m["light"]),(15.04,7.62,1.55),(15.04,7.62,1.76),.17,24)
        out+=p.finish()
    return out


def _chair(p,m,at,yaw):
    x,y,f=at
    for dx in (-.28,.28):
        for dy in (-.27,.27):
            cylinder(p.bm(m["smoked"]),(x+dx,y+dy,f+.02),(x+dx,y+dy,f+.39),.028,12)
    box(p.bm(m["oak"]),(x,y,f+.37),(.73,.72,.075),.07,yaw=yaw)
    box(p.bm(m["linen"]),(x,y,f+.47),(.67,.64,.16),.075,yaw=yaw)
    box(p.bm(m["oak"]),(x,y-.30,f+.78),(.74,.075,.62),.045,yaw=yaw,pitch=-.16)
    box(p.bm(m["linen"]),(x,y-.247,f+.79),(.66,.115,.49),.065,yaw=yaw,pitch=-.16)
    for dx in (-.355,.355):
        cylinder(p.bm(m["oak"]),(x+dx,y-.25,f+.64),(x+dx,y+.27,f+.64),.03,12)


def facade(m):
    p=Parts("core_estate_library_facade")
    xa,xb=LIBRARY["x"]
    y=LIBRARY["y"][1]+.03
    # Bronze arch scribed inside the retained cliff. Slender piers follow the
    # two-storey structure rather than giving the glass an unsupported outline.
    profile=arch_profile()[2:]
    for a,b in zip(profile,profile[1:]):
        cylinder(p.bm(m["bronze"]),(a[0],y,a[1]),(b[0],y,b[1]),.035,8)
    for x in (xa+.08,(xa+xb)/2,xb-.08):
        cylinder(p.bm(m["bronze"]),(x,y,0),(x,y,5.67 if x==(xa+xb)/2 else 3.95),.027,10)
    for z in (.08,2.60):
        box(p.bm(m["bronze"]),((xa+xb)/2,y,z),(xb-xa,.085,.05),.006)
    # Upper crown is fixed glass, lower glazing deliberately has a continuous
    # opaque stone bench as a clear physical edge instead of an unmarked void.
    glass=Parts("core_estate_library_glazing")
    from coastal_facade import slab
    slab(glass.bm(m["glass"]),[(xa+.10,.10),(xb-.10,.10)]+[(x,z-.08) for x,z in profile if xa+.10<=x<=xb-.10],y-.012,y+.012)
    out=p.finish()+glass.finish()
    for obj in out:
        if obj.name.startswith("core_estate_library_glazing"):
            obj["walk"]="solid"
    return out


def arrival(m):
    p=Parts("core_estate_arrival")
    # The public stair now terminates at an unmistakable, proportioned door:
    # warm stone surround, recessed oak reveal, bronze threshold and long pull.
    doors=[]
    for id,x0,x1,y,f,slide in (("main",-3.59,-2.08,-7.37,0.0,-1.56),
                              ("private",2.47,4.43,-7.56,2.6,2.02)):
        h=2.28
        for x in (x0,x1):
            box(p.bm(m["oak"]),(x,y,f+h/2),(.065,.18,h),.013)
        box(p.bm(m["oak"]),((x0+x1)/2,y,f+h+.025),(x1-x0+.13,.18,.065),.012)
        box(p.bm(m["bronze"]),((x0+x1)/2,y,f+.006),(x1-x0,.20,.012),.002)
        box(p.bm(m["light"]),((x0+x1)/2,y-.092,f+h-.015),(x1-x0-.12,.015,.016),.004)
        leaf=Parts("core_estate_door_"+id)
        center=(x0+x1)/2
        box(leaf.bm(m["doorGlass"]),(center,y,f+h/2),(x1-x0-.09,.028,h-.05),.015)
        for x in (x0+.04,x1-.04):
            box(leaf.bm(m["bronze"]),(x,y,f+h/2),(.025,.045,h-.045),.005)
        for z in (.03,h-.03):
            box(leaf.bm(m["bronze"]),(center,y,f+z),(x1-x0-.06,.045,.025),.005)
        # Fine ribs read as translucent screening at arrival, not a blank sheet.
        for k in range(1,int((x1-x0)/.035)):
            cylinder(leaf.bm(m["doorGlass"]),(x0+k*.035,y-.019,f+.04),(x0+k*.035,y-.019,f+h-.04),.004,6)
        cylinder(leaf.bm(m["bronze"]),(x1-.14,y-.065,f+.88),(x1-.14,y-.065,f+1.38),.014,12)
        leafs=leaf.finish()
        for obj in leafs:
            obj["estateDoor"]=id
            obj["walk"]="dynamic-door"
        doors.append({"id":id,"nodes":[obj.name for obj in leafs],"slideX":slide,
                      "center":web((center,y,f+1.1)),"opening":{"min":web((x0,y+.12,f)),"max":web((x1,y-.12,f+h))},
                      "activationDistance":2.1,"floor":f})
        p_objects=leafs
        if id=="main":
            # The relocated coat bench and its oak ribs sit against a real
            # plaster return, sheltering the living room from the open stair.
            box(p.bm(m["plaster"]),(-3.65,-6.66,1.17),(.12,1.42,2.34),.035)
        doors[-1]["objects"]=p_objects
    objects=p.finish()
    for d in doors:
        objects+=d.pop("objects")
    return objects,doors


def manifest_rooms():
    rooms=[]
    base=[(5.8,-8.80),(5.8,-10.60),(7.30,-10.60),(10.7,-10.60),(12.25,-10.60),(12.25,-1.0),(12.25,.30),(13.40,.30),(13.60,2.8)]
    for id,label,f in (("library","Cave library",0.0),("library-upper","Private library gallery",2.6)):
        route=[wing_web((x,y,f)) for x,y in base]
        target=(13.65,6.65,1.15) if not f else (14.05,4.12,3.75)
        actor=(13.55,6.05,0) if not f else (13.50,3.0,2.6)
        rooms.append({"id":id,"label":label,"file":"room-"+id+".glb","floor":f,"offset":[0,f,0],
                      "target":wing_web(target),"actor":wing_web(actor),"facing":0,"egress":route[0],
                      "exitPath":list(reversed(route[1:])),
                      "camera":{"radius":4.6 if not f else 3.0,"yaw":-.15,"pitch":.12,"fov":52,
                                "envelope":{"yaw":[-.45,.25],"pitch":[.08,.34],"radius":[2.7,5.1] if not f else [2.2,3.8]}},
                      "library":{"private":bool(f),"route":route+[wing_web(actor)],
                                 "headroom":2.38,"floorBounds":{"min":wing_web((15.55,9.45 if not f else 6.05,f)),"max":wing_web((11.55,-.2,f+2.38))}},
                      "lightRegion":{"min":[-12.55,f,-12.15],"max":[-8.55,f+2.4,-2.5]},
                      "lighting":{"lines":[{"id":"books","a":wing_web((15.22,.43 if f else .52,f+2.27)),"b":wing_web((15.22,3.97 if f else 4.72,f+2.27)),"intensity":.65}]}})
    return rooms


def build(scene, config):
    _remove(scene)
    m=materials()
    if not scene.get("estateEntryBenchMovedVersion"):
        moved=0
        for obj in scene.objects:
            if obj.type=="MESH" and obj.name.startswith("core_arrival_lower_"):
                moved+=shell.edit_islands(obj,lambda lo,hi:(0,1.8,0) if shell.inside(lo,hi,(-3.61,-9.15,0),(-3.26,-7.75,2.11)) else None)[0]
        scene["estateEntryBenchMoved"]=moved
        scene["estateEntryBenchMovedVersion"]=1
    if not scene.get("estateBedroomArtRelocated"):
        moved=[]
        for obj in scene.objects:
            if obj.type!="MESH" or not obj.name.startswith("sleep_decor "):
                continue
            to_local=obj.matrix_world.inverted()
            for vertex in obj.data.vertices:
                q=obj.matrix_world@vertex.co
                vertex.co=to_local@Vector((-4.68+(q.y+7.8505),-3.30-(q.x+3.55),q.z))
            obj.data.update()
            moved.append(obj.name)
        scene["estateBedroomArtRelocated"]=len(moved)
    cuts=excavate(scene,m)
    objects,supports=structure(scene,m)
    stair,ss=stair_and_gallery(m)
    objects+=stair+furniture(m)+facade(m)
    supports+=ss
    for obj in objects:
        place(obj)
    for support in supports:
        support["polygon"]=[[round(3.0-x,4),round(z-2.70,4)] for x,z in reversed(support["polygon"])]
    entry,doors=arrival(m)
    objects+=entry
    for obj in objects:
        obj["estateArchitecture"]=True
    rooms=manifest_rooms()
    for room in rooms:
        name="anchor_"+room["id"]
        anchor=bpy.data.objects.get(name) or bpy.data.objects.new(name,None)
        if not anchor.name in scene.collection.objects:
            scene.collection.objects.link(anchor)
        x,y,z=room["actor"]
        anchor.location=(x,-z,y)
    config["rooms"]=[r for r in config["rooms"] if r["id"] not in {q["id"] for q in rooms}]+rooms
    config["estateDoors"]=doors
    config["terrain"]["supportSurfaces"]=[s for s in config["terrain"]["supportSurfaces"] if not s["id"].startswith("estate-")]+supports
    config["estateLibrary"]={"bounds":{"min":[-12.80,-.28,-18.70],"max":[-2.35,5.8,8.80]},
                            "privateConnection":[web((-3.1,-6.1,2.6))]+rooms[1]["library"]["route"],
                            "stairRoute":[wing_web((12.3,STAIR['y'][0]+(STAIR['y'][1]-STAIR['y'][0])*(k+.5)/STAIR['count'],2.6*(k+1)/STAIR['count'])) for k in range(STAIR['count'])],
                            "galleryLighting":[{"floor":f,"lines":[{"id":"link","a":wing_web((7.45,-11.198,f+2.255)),"b":wing_web((12.70,-11.198,f+2.255)),"intensity":.52},{"id":"spine","a":wing_web((12.938,-9.55,f+2.255)),"b":wing_web((12.938,-.40,f+2.255)),"intensity":.52}]} for f in (0.0,2.6)]}
    config["walk"]["region"]["min"][0]=min(config["walk"]["region"]["min"][0],-14.0)
    return objects,{"cuts":cuts,"rooms":rooms,"doors":doors,"supports":supports,
                    "nativeBounds":{"x":[-12.55,-8.55],"y":[2.50,12.15]},"preservedInteractiveStudy":True,
                    "objects":[{"name":o.name,"vertices":len(o.data.vertices),"triangles":sum(len(f.vertices)-2 for f in o.data.polygons)} for o in objects]}
