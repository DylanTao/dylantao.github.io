"""Two original, stacked bathrooms carved beside the retained coastal home.

Coordinates are native Blender metres (+Z up, +Y toward the Pacific). The public
bath opens from the lower rear aisle; the upper is a true bedroom en suite.
"""
import math
import bpy
import bmesh
from mathutils import Matrix, Vector
import coastal_shell as shell
import coastal_sunken as sunken
from coastal_landscape import web
from coastal_office import Parts, box, cylinder, _mat

ROOMS = (("bath-living", "Guest bathroom", 0.0), ("bath-bedroom", "Bedroom en suite", 2.6))
BOUNDS = {"x": (-8.25, -4.85), "y": (-6.10, -1.85)}
DOOR = {"y": (-5.75, -4.55), "height": 2.28, "x": -4.55}


def materials():
    get = bpy.data.materials.get
    return {"plaster": get("chalk limestone"), "stone": get("warm cut stone"),
            "travertine": get("honed travertine") or get("warm cut stone"),
            "oak": get("pale oak"), "smoked": get("honey ash"),
            "bronze": get("brushed brass"), "nickel": get("polished nickel"),
            "linen": get("linen"), "dark": get("charcoal"),
            "ceramic": _mat("bathroom porcelain glaze", (.84, .825, .77), .18),
            "sea": _mat("bathroom celadon ceramic", (.15, .31, .28), .28),
            "glass": _mat("bathroom clear shower glass", (.70, .84, .78), .06, alpha=.14),
            "mirror": _mat("bathroom satin mirror", (.64, .69, .68), .055, .98),
            "light": _mat("bathroom warm diffuser", (.90, .78, .58), .35, 0,
                           (1.0, .74, .43), 2.1),
            # Three adjacent cuts of the same stone; names retain the existing
            # world-scale travertine shader, without a downloaded texture set.
            "floor": tuple(_mat("bathroom honed travertine "+name, color, .68)
                           for name, color in (("ivory", (.68, .61, .49)),
                                               ("oat", (.63, .565, .46)),
                                               ("sand", (.655, .59, .475)))),
            "grout": _mat("bathroom warm mineral grout", (.43, .405, .35), .93),
            "fern": _mat("bathroom fern leaf", (.12, .22, .095), .79)}


def _ellipse(bm, center, radii, profile, segments=48):
    """Closed profile of an elliptical hollow vessel/seat, with genuine inner faces."""
    rings = []
    for r, z in profile:
        rings.append([bm.verts.new((center[0]+radii[0]*r*math.cos(k*math.tau/segments),
                                   center[1]+radii[1]*r*math.sin(k*math.tau/segments),
                                   center[2]+z)) for k in range(segments)])
    for a, b in zip(rings, rings[1:]+rings[:1]):
        for k in range(segments):
            bm.faces.new((a[k], a[(k+1)%segments], b[(k+1)%segments], b[k]))


def _panel(p, material, name, center, size, radius=.012, **tags):
    """A separate tagged mesh where cutaway ownership differs from material batches."""
    q = Parts(name)
    box(q.bm(material), center, size, radius)
    objects = q.finish()
    for obj in objects:
        for k, v in tags.items():
            obj[k] = v
    return objects


def excavate(scene, m):
    """Real rock cavities and apertures, preserving untouched disconnected islands."""
    reports = []
    if not scene.get("bathroomWingCutVersion"):
        # Two inhabited storeys, separated later by a real structural slab.
        tools = [shell._box_object("bathroom stacked excavation", (-8.45, -6.30, -.20),
                                   (-4.75, -1.65, 5.20), m["plaster"])]
        for _, _, floor in ROOMS:
            tools.append(shell._box_object("bathroom doorway excavation", (-5.0, DOOR["y"][0], floor-.05),
                                           (-4.05, DOOR["y"][1], floor+DOOR["height"]), m["plaster"]))
        for obj in list(scene.objects):
            if obj.type != "MESH" or not (obj.name == "core__golden coastal sandstone" or obj.get("caveRoof")):
                continue
            cuts = [shell.boolean_preserving_islands(obj, tool) for tool in tools]
            reports.append({"mesh": obj.name, "cuts": cuts})
        for tool in tools:
            bpy.data.objects.remove(tool, do_unlink=True)
        # The roof above the wing remains original native cliff rock, now a deliberate
        # lift-away section. It retains the same physical rooftop support in Walk.
        mainland = bpy.data.objects["core__golden coastal sandstone"]
        tool = shell._box_object("bathroom roof partition", (-8.60, -6.45, 5.17),
                                 (-4.74, -1.50, 14.5), m["stone"])
        roof = mainland.copy()
        roof.data = mainland.data.copy()
        scene.collection.objects.link(roof)
        shell.boolean(roof, tool, "INTERSECT")
        shell.boolean_preserving_islands(mainland, tool)
        bpy.data.objects.remove(tool, do_unlink=True)
        roof.name = roof.data.name = "core_bathwing_liftaway_roof"
        for key in list(roof.keys()):
            del roof[key]
        roof["caveRoof"] = True
        roof["cutawaySection"] = "inhabited-roof"
        roof["closedSolid"] = True
        assert shell.clean_solid(roof) == 0, "bathroom native roof must be closed"
        scene["bathroomWingCutVersion"] = 1
        scene["bathroomWingCutReport"] = __import__("json").dumps(reports)
    # Retire one front wardrobe bay and leave a generous dressing approach. Every
    # remaining component keeps its native material; the fitted bed never moves.
    for obj in list(scene.objects):
        if obj.name.startswith("sleep_reno_wardrobe"):
            bpy.data.objects.remove(obj, do_unlink=True)
    q = Parts("sleep_reno_wardrobe")
    oak, smoked, pulls = q.bm(m["oak"]), q.bm(m["smoked"]), q.bm(m["nickel"])
    x0, x1, y0, y1, h = -4.4, -3.85, -7.4, -5.85, 1.85
    box(smoked, ((x0+x1)/2+.02, (y0+y1)/2, 2.64), (x1-x0-.04, y1-y0-.04, .08), .01)
    box(oak, ((x0+x1)/2, (y0+y1)/2, 2.6+.08+(h-.08)/2), (x1-x0, y1-y0, h-.08), .012)
    for k in range(3):
        ya, yb = y0+(y1-y0)*k/3, y0+(y1-y0)*(k+1)/3
        box(oak, (x1+.008, (ya+yb)/2, 2.6+.08+(h-.08)/2), (.02, yb-ya-.01, h-.12), .006)
        py = yb-.06 if k%2 == 0 else ya+.06
        cylinder(pulls, (x1+.035, py, 3.45), (x1+.035, py, 3.8), .008, 10)
    q.finish()
    scene["bathroomWardrobeBayRetired"] = True
    # An existing small corner planter occupied the new public threshold. Move
    # its original pot, soil and leaves together to the adjacent solid wall.
    if not scene.get("bathroomThresholdPlantMoved"):
        for obj in scene.objects:
            if obj.type == "MESH" and obj.name.startswith("core__"):
                shell.edit_islands(obj, lambda lo, hi: (0, 1.6, 0)
                                   if shell.inside(lo, hi, (-4.90, -5.90, -.01), (-4.05, -4.70, 1.10)) else None)
        scene["bathroomThresholdPlantMoved"] = True
    # Leaf tips can extend beyond the pot's box. A second pass uses the native
    # connected component centre with a generous bounded region, so all old
    # leaves follow the pot rather than leaving an invisible-looking thicket.
    if scene.get("bathroomThresholdPlantVersion", 0) < 3:
        for obj in scene.objects:
            if obj.type == "MESH" and obj.name in ("core__terracotta", "core__charcoal", "core__olive leaf", "core__honey ash"):
                shell.edit_islands(obj, lambda lo, hi: (0, 1.6, 0)
                                   if -5.2 < (lo.x+hi.x)/2 < -3.7 and -6.5 < (lo.y+hi.y)/2 < -4.7 and hi.z < 1.8 else None)
        scene["bathroomThresholdPlantVersion"] = 3
    return reports or __import__("json").loads(scene.get("bathroomWingCutReport", "[]"))


def _tile_floor(p, m, floor, upper):
    stone = p.bm(m["travertine"])
    border = p.bm(m["stone"])
    # A warm perimeter frame makes the room read as a considered stone carpet.
    # Every exposed top stays at the existing support height, including the
    # flush shower transition and doorway: no new walking curb or raised mat.
    x0, x1 = BOUNDS["x"]
    y0, y1 = BOUNDS["y"]
    box(p.bm(m["grout"]), ((x0+x1)/2, (y0+y1)/2, floor-.023), (x1-x0, y1-y0, .040))
    edge, wet = .14, -3.02
    for xa, xb, ya, yb in ((x0, x0+edge, y0, y1), (x1-edge, x1, y0, y1),
                           (x0+edge, x1-edge, y0, y0+edge),
                           (x0+edge, x1-edge, y1-edge, y1)):
        box(border, ((xa+xb)/2, (ya+yb)/2, floor-.018), (xb-xa-.002, yb-ya-.002, .036), .0015, segments=1)
    # Long quiet slabs in a half-bond arrangement, rather than the former
    # uniform square grid. End cuts stay beside the perimeter border.
    a, b = x0+edge, x1-edge
    dy = (wet-(y0+edge))/2
    width = (b-a)/3
    for row in range(2):
        cuts = [a] + [a+(j+.5*row)*width for j in range(1-row, 3)
                      if a+.01 < a+(j+.5*row)*width < b-.01] + [b]
        for col, (xa, xb) in enumerate(zip(cuts, cuts[1:])):
            ya, yb = y0+edge+row*dy, y0+edge+(row+1)*dy
            batch = p.bm(m["floor"][(col+row+(1 if upper else 0))%3])
            box(batch, ((xa+xb)/2, (ya+yb)/2, floor-.018), (xb-xa-.002, yb-ya-.002, .036), .0015, segments=1)
    # Smaller cuts distinguish the wet zone. Their 2 mm recessed joints are
    # explicit geometry; this suggests a grippier finish, not a safety rating.
    rows, cols = 7, 19
    for row in range(rows):
        for col in range(cols):
            xa, xb = a+(b-a)*col/cols, a+(b-a)*(col+1)/cols
            ya, yb = wet+(y1-edge-wet)*row/rows, wet+(y1-edge-wet)*(row+1)/rows
            batch = p.bm(m["floor"][(col//4+row//3)%3])
            box(batch, ((xa+xb)/2, (ya+yb)/2, floor-.018), (xb-xa-.002, yb-ya-.002, .036))
    # The skirting is quiet and continuous behind the vanity and WC. The
    # doorway and glass shower approach remain entirely clear.
    for center, size in (((-8.235, -3.975, floor+.055), (.026, 4.19, .11)),
                         ((-6.60, -6.085, floor+.055), (3.27, .025, .11))):
        box(border, center, size, .004, segments=1)
    # Door's continuous stone threshold overlaps the old native floor; no curb.
    box(stone, (-4.68, -5.15, floor-.018), (.94, 1.198, .036), .002, segments=1)
    # Native slab below each storey. Upper slab is only hidden while inspecting
    # the guest room, never simply removed from walking geometry.
    tag = {"bathroomCeilingFor": "bath-living"} if upper else {}
    return _panel(p, m["stone"], "core_bathwing_upper_slab" if upper else "core_bathwing_lower_slab",
                  (-6.60, -3.975, floor-.14), (3.72, 4.65, .24), .018, **tag)


def _walls(p, m, floor, upper):
    plaster = p.bm(m["plaster"])
    h = 2.35
    # Three continuous soft plaster walls; a fitted oak pocket door remains
    # visibly parked in its recess beside the genuine 1.2m open aperture.
    box(plaster, (-8.34, -3.975, floor+h/2), (.18, 4.61, h), .055)
    box(plaster, (-6.60, -6.19, floor+h/2), (3.66, .18, h), .055)
    # The shower niche is actually recessed into this wall, with separate
    # jambs/lintel/sill; no dark rectangle placed on an uninterrupted solid.
    for xa, xb, za, zb in ((-8.43, -5.98, 0, h), (-5.0, -4.77, 0, h),
                           (-5.98, -5.0, 0, 1.10), (-5.98, -5.0, 1.75, h)):
        box(plaster, ((xa+xb)/2, -1.76, floor+(za+zb)/2), (xb-xa, .18, zb-za), .018)
    box(plaster, (-5.49, -1.675, floor+1.425), (.98, .025, .65), .012)
    for ya, yb in ((-6.28, -5.75), (-4.55, -1.67)):
        box(plaster, (-4.79, (ya+yb)/2, floor+h/2), (.16, yb-ya, h), .035)
    box(plaster, (-4.79, -5.15, floor+2.315), (.20, 1.25, .07), .012)
    oak = p.bm(m["oak"])
    for y in DOOR["y"]:
        box(oak, (-4.52, y, floor+1.135), (.09, .045, 2.27), .008)
    box(oak, (-4.52, -5.15, floor+2.275), (.09, 1.24, .055), .008)
    box(oak, (-4.65, -3.99, floor+1.135), (.055, 1.10, 2.25), .015)
    cylinder(p.bm(m["bronze"]), (-4.605, -4.45, floor+.92), (-4.605, -4.45, floor+1.12), .011, 12)
    # A rounded full-height privacy nib screens the WC from the open doorway.
    box(plaster, (-6.82, -5.40, floor+1.175), (.15, 1.40, 2.35), .055)
    # Ceiling is actual enclosure, but gets the same orbit cutaway as the roof.
    return _panel(p, m["plaster"], f"core_bathwing_{'upper' if upper else 'lower'}_ceiling",
                  (-6.60, -3.975, floor+2.39), (3.62, 4.55, .08), .025,
                  caveRoof=bool(upper), bathroomCeilingFor="bath-living" if not upper else "bath-bedroom")


def _toilet(p, m, floor):
    white = p.bm(m["ceramic"])
    center = (-7.58, -5.53, floor)
    # Hanging shell, inner bowl and a separate rounded seat: the opening is real.
    _ellipse(white, center, (.205, .295), [(0.48, .20), (.80, .255), (1, .39), (1, .425),
             (.84, .43), (.78, .395), (.50, .29), (.20, .255), (.16, .25)], 48)
    _ellipse(white, center, (.217, .308), [(1, .44), (.99, .46), (.79, .46), (.77, .44)], 48)
    box(white, (-7.58, -5.84, floor+.365), (.30, .28, .22), .06)
    # Raised soft-close lid and the two visible hinge pins.
    lid = bmesh.new()
    _ellipse(lid, (0, 0, 0), (.215, .29), [(1, -.012), (1, .012), (.02, .012), (.02, -.012)], 40)
    transform = Matrix.Translation(Vector((-7.58, -5.855, floor+.695))) @ Matrix.Rotation(math.radians(83), 4, "X")
    for v in lid.verts:
        v.co = transform @ v.co
    tmp = bpy.data.meshes.new("WC lid")
    lid.to_mesh(tmp)
    lid.free()
    white.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)
    metal = p.bm(m["nickel"])
    for x in (-7.70, -7.46):
        cylinder(metal, (x, -5.85, floor+.445), (x, -5.78, floor+.445), .015, 12)
    # Discreet inset flush and toilet-roll holder, not a feature wall of clutter.
    box(metal, (-7.58, -6.083, floor+1.03), (.24, .014, .15), .018)
    for x in (-7.64, -7.52):
        box(metal, (x, -6.070, floor+1.03), (.085, .012, .075), .012)
    cylinder(p.bm(m["bronze"]), (-6.92, -5.61, floor+.68), (-6.92, -5.82, floor+.68), .012, 12)
    cylinder(p.bm(m["linen"]), (-6.92, -5.64, floor+.68), (-6.92, -5.79, floor+.68), .052, 20)
    return {"center": web(center), "seatHeight": .46, "bowlInnerDepth": .205}


def _vanity(p, m, floor, upper):
    oak, stone = p.bm(m["oak"]), p.bm(m["travertine"])
    # Fitted floating oak with a recessed shadow line and individually milled ribs.
    box(oak, (-7.96, -3.65, floor+.575), (.51, 1.50, .43), .04)
    for k in range(31):
        y = -4.37+k*.048
        box(oak, (-7.692, y, floor+.585), (.025, .026, .365), .009, segments=2)
    box(stone, (-7.95, -3.65, floor+.83), (.61, 1.60, .075), .028)
    # Vessel bowl: actual inward normals, curved well and visible bronze drain.
    basin = stone if upper else p.bm(m["ceramic"])
    _ellipse(basin, (-7.93, -3.68, floor), (.225, .335),
             [(.76, .868), (1, .965), (.99, 1.00), (.88, 1.00), (.83, .97), (.58, .89), (.12, .875)], 56)
    cylinder(p.bm(m["bronze"]), (-7.93, -3.68, floor+.875), (-7.93, -3.68, floor+.880), .021, 20)
    # Wall spout sweeps over the basin rather than emerging through its opening.
    metal = p.bm(m["bronze"])
    cylinder(metal, (-8.245, -3.68, floor+1.09), (-7.94, -3.68, floor+1.09), .016, 16)
    cylinder(metal, (-7.94, -3.68, floor+1.09), (-7.94, -3.68, floor+1.035), .016, 16)
    cylinder(metal, (-8.24, -3.31, floor+1.06), (-8.20, -3.31, floor+1.06), .031, 20)
    # Recessed rounded mirror cabinet with slim bronze edge and a warm linewash.
    box(p.bm(m["smoked"]), (-8.235, -3.65, floor+1.67), (.045, 1.55, 1.02), .07)
    box(metal, (-8.202, -3.65, floor+1.67), (.025, 1.50, .97), .06)
    box(p.bm(m["mirror"]), (-8.185, -3.65, floor+1.67), (.012, 1.46, .93), .055)
    box(p.bm(m["light"]), (-8.16, -3.65, floor+2.225), (.025, 1.42, .024), .009)
    # Hidden under the floating cabinet, a soft night guide makes the floor
    # and toe clearance readable without shining another lamp into the mirror.
    box(p.bm(m["light"]), (-7.93, -3.65, floor+.352), (.025, 1.28, .014), .004)
    # One considered soap bottle and a linen hand towel on a warm metal bar.
    cylinder(p.bm(m["sea"]), (-7.95, -4.24, floor+.868), (-7.95, -4.24, floor+1.00), .038, 20)
    cylinder(metal, (-7.95, -4.24, floor+1), (-7.95, -4.24, floor+1.035), .013, 12)
    box(metal, (-7.92, -4.24, floor+1.035), (.075, .018, .014), .005)
    cylinder(metal, (-7.64, -3.02, floor+.68), (-7.64, -3.37, floor+.68), .011, 12)
    box(p.bm(m["linen"]), (-7.625, -3.19, floor+.535), (.028, .28, .31), .015)
    return [{"id": "mirror", "a": web((-8.10, -4.31, floor+2.16)),
             "b": web((-8.10, -2.99, floor+2.16)), "intensity": .78},
            {"id": "vanity-underlight", "a": web((-7.93, -4.27, floor+.352)),
             "b": web((-7.93, -3.03, floor+.352)), "intensity": .075}]


def _shower(p, m, floor, upper):
    tile = p.bm(m["sea"] if upper else m["travertine"])
    # A quiet vertical glazed zone at the back of the walk-in shower, bounded by
    # honed stone rather than covering the whole room in small busy tiles.
    for k in range(18):
        xa, xb = -8.19+3.28*k/18, -8.19+3.28*(k+1)/18
        parts = [(xa, xb, .02, 2.32)]
        if xb > -5.98 and xa < -5.0:
            parts = [(max(xa, -5.98), min(xb, -5.0), .02, 1.10),
                     (max(xa, -5.98), min(xb, -5.0), 1.75, 2.32)]
            if xa < -5.98: parts.append((xa, -5.98, .02, 2.32))
            if xb > -5.0: parts.append((-5.0, xb, .02, 2.32))
        for a, b, c, d in parts:
            if b-a > .004:
                box(tile, ((a+b)/2, -1.848, floor+(c+d)/2), (b-a-.003, .018, d-c-.002), .002, segments=1)
    glass = p.bm(m["glass"])
    # Fixed glass stops short of the open 1.2m approach on the right.
    box(glass, (-7.27, -3.02, floor+1.05), (1.83, .012, 2.10), .005, segments=2)
    bronze = p.bm(m["bronze"])
    box(bronze, (-7.27, -3.02, floor+.012), (1.86, .025, .024), .003)
    cylinder(bronze, (-6.355, -3.02, floor+.015), (-6.355, -3.02, floor+2.10), .012, 12)
    for x in (-8.14, -6.40):
        box(bronze, (x, -3.02, floor+.25), (.036, .022, .065), .005)
    # Broad rainhead, wall handshower, controls and linear drain.
    cylinder(bronze, (-7.20, -1.89, floor+2.12), (-7.20, -2.40, floor+2.12), .017, 16)
    cylinder(bronze, (-7.20, -2.40, floor+2.08), (-7.20, -2.40, floor+2.11), .145, 32)
    cylinder(bronze, (-6.64, -1.90, floor+1.16), (-6.64, -1.85, floor+1.16), .043, 20)
    cylinder(bronze, (-6.36, -1.91, floor+.87), (-6.36, -1.91, floor+1.45), .012, 12)
    cylinder(bronze, (-6.36, -1.94, floor+1.4), (-6.36, -1.99, floor+1.57), .022, 12)
    # Hose as a small genuine swept curve.
    for k in range(18):
        t0, t1 = k/18, (k+1)/18
        def at(t): return (-6.36+.08*math.sin(t*math.pi), -1.94, floor+.94-.44*math.sin(t*math.pi)+.42*t)
        cylinder(bronze, at(t0), at(t1), .006, 8)
    box(p.bm(m["dark"]), (-7.21, -1.99, floor+.001), (1.60, .035, .008), .004)
    for k in range(25):
        box(bronze, (-7.98+k*.064, -1.99, floor+.006), (.0025, .034, .004), .0005, segments=1)
    # A floating bench and the shower niche are depth-bearing built pieces.
    box(p.bm(m["travertine"]), (-8.02, -2.40, floor+.46), (.36, .86, .10), .04)
    box(p.bm(m["travertine"]), (-5.49, -1.775, floor+1.10), (.98, .15, .055), .016)
    box(p.bm(m["sea"]), (-5.49, -1.697, floor+1.42), (.95, .014, .60), .012)
    box(p.bm(m["light"]), (-5.49, -1.77, floor+1.72), (.84, .022, .018), .006)
    box(p.bm(m["light"]), (-6.535, -1.96, floor+2.24), (2.83, .018, .022), .006)
    for x, h in ((-5.72, .17), (-5.47, .21)):
        cylinder(p.bm(m["sea"]), (x, -1.775, floor+1.13), (x, -1.775, floor+1.13+h), .037, 20)
        cylinder(bronze, (x, -1.775, floor+1.13+h), (x, -1.775, floor+1.16+h), .018, 12)
    return {"id": "shower", "a": web((-7.95, -1.96, floor+2.24)),
            "b": web((-5.12, -1.96, floor+2.24)), "intensity": .52}


def sync_room_anchors(scene, rooms):
    """Persist the same actor contacts as source-native EMPTY anchors in the shell."""
    anchors = []
    for room in rooms:
        if not room.get("bathroom"):
            continue
        name = "anchor_"+room["id"]
        obj = bpy.data.objects.get(name)
        if obj is None:
            obj = bpy.data.objects.new(name, None)
            scene.collection.objects.link(obj)
        assert obj.type == "EMPTY", (name, obj.type)
        x, y, z = room["actor"]
        obj.location = (x, -z, y)
        obj.empty_display_type = "PLAIN_AXES"
        obj.empty_display_size = .15
        anchors.append(obj)
    return anchors


def build(scene, config):
    for obj in list(scene.objects):
        if obj.name.startswith(("bath-living_", "bath-bedroom_", "core_bathwing_")) and not obj.get("closedSolid"):
            bpy.data.objects.remove(obj, do_unlink=True)
    m = materials()
    cuts = excavate(scene, m)
    objects, supports, metadata = [], [], []
    for id, label, floor in ROOMS:
        upper = floor > 0
        p = Parts(id)
        objects += _tile_floor(p, m, floor, upper)
        objects += _walls(p, m, floor, upper)
        wc = _toilet(p, m, floor)
        lines = _vanity(p, m, floor, upper)+[_shower(p, m, floor, upper)]
        # A folded bath sheet in the dry zone and a small oak perch furnish the
        # room without crowding its broad circulation spine.
        box(p.bm(m["oak"]), (-5.40, -5.86, floor+.43), (.44, .42, .08), .045)
        for x in (-5.54, -5.26):
            for y in (-5.99, -5.73):
                cylinder(p.bm(m["oak"]), (x, y, floor+.03), (x, y, floor+.40), .027, 12)
        box(p.bm(m["linen"]), (-5.40, -5.86, floor+.505), (.32, .29, .065), .025)
        room_objects = p.finish()
        for obj in room_objects:
            obj["bathroomRoom"] = id
            if any(mat and mat.name == m["light"].name for mat in obj.data.materials):
                obj["roomLight"] = id
            if any(mat and mat.name == m["glass"].name for mat in obj.data.materials):
                obj["walk"] = "solid"
        objects += room_objects
        supports.append(sunken.support(id+"-floor", (-8.25, -4.38, -6.1, -1.85), floor))
        route = [(3.27, -5.6, floor), (-2.8, -5.6, floor), (-4.05, -5.6, floor),
                 (-4.05, -5.15, floor), (-5.6, -5.15, floor), (-5.8, -4.05, floor)]
        if upper:
            route = [(-2.12, -6.1, floor), (-3.1, -6.1, floor), (-3.1, -5.15, floor),
                     (-5.6, -5.15, floor), (-5.8, -4.05, floor)]
        r = {"id": id, "label": label, "file": "room-"+id+".glb", "floor": floor,
             "offset": [0, floor, 0], "target": web((-6.70, -3.70, floor+1.05)),
             "actor": web((-5.8, -4.05, floor)), "facing": 0,
             "egress": web(route[0]), "exitPath": [web(q) for q in reversed(route[:-1])],
             "camera": {"radius": 2.55, "yaw": .80, "pitch": .20, "fov": 54,
                        "envelope": {"yaw": [.45, .95], "pitch": [.12, .42], "radius": [1.9, 2.7]}},
             "bathroom": {"kind": "ensuite" if upper else "guest", "entry": web((-4.45, -5.15, floor)),
                          "doorWidth": 1.2, "headroom": 2.35, "route": [web(q) for q in route],
                          "wcApproachRoute": [web(q) for q in ((-5.8, -4.05, floor), (-6.4, -4.15, floor),
                                               (-7.25, -4.15, floor), (-7.25, -4.85, floor), (-7.58, -4.85, floor))],
                          "showerRoute": [web(q) for q in ((-5.8, -4.05, floor), (-5.9, -3.4, floor), (-5.9, -2.45, floor))],
                          "headroomProbes": [web(q) for q in ((-4.45, -5.15, floor), (-5.8, -4.05, floor), (-5.9, -2.45, floor))],
                          "privacy": {"target": web((-7.58, -5.53, floor+.46)),
                                      "observers": [web(q) for q in ((-4.05, -5.15, floor+1.6), (-3.1, -5.6, floor+1.6))]},
                          "wc": wc, "shower": {"min": [-8.2, floor, 1.9], "max": [-4.9, floor+2.3, 3.0]}},
             "lightRegion": {"min": [-8.25, floor, 1.85], "max": [-4.38, floor+2.35, 6.1]},
             "lighting": {"lines": lines}}
        metadata.append(r)
    config["rooms"] = [r for r in config["rooms"] if r["id"] not in {q[0] for q in ROOMS}]+metadata
    sync_room_anchors(scene, metadata)
    config["terrain"]["supportSurfaces"] = [s for s in config["terrain"]["supportSurfaces"] if not s["id"].startswith(("bath-living-", "bath-bedroom-"))]+supports
    config["terrain"].setdefault("contacts", {}).update({r["id"]: {k:r[k] for k in ("actor", "egress", "floor", "exitPath")} for r in metadata})
    # Split the retained left-side analytic wall around the real door in each
    # storey. Native voxel/capsule fields still use the actual exported aperture.
    walls = config["cameraCollision"]["walls"]
    walls[:] = [w for w in walls if not w.get("bathrooms") and not
                (w["min"][0] == -5.2 and w["max"][0] == -4.7 and w["min"][2] == -4.5)]
    for za, zb, ya, yb in ((-4.5, 4.55, -.26, 6), (5.75, 7.95, -.26, 6),
                           (4.55, 5.75, -.26, 0), (4.55, 5.75, 2.28, 2.6), (4.55, 5.75, 4.88, 6)):
        walls.append({"bathrooms": True, "min": [-5.2, ya, za], "max": [-4.7, yb, zb]})
    return objects, {"rooms": metadata, "cuts": cuts, "geometry": [
        {"name": o.name, "vertices": len(o.data.vertices), "triangles": sum(len(p.vertices)-2 for p in o.data.polygons)} for o in objects]}
