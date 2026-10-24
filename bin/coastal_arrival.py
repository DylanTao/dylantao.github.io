"""Connected clifftop arrival, a carved stair, and a small sea-facing infinity basin.

Original geometry; all coordinates are Blender metres, +Z up and +Y toward the Pacific.
The cutters stay inside the retained mainland so its hinterland seam is unchanged.
"""
import math
import json
import bmesh
import bpy
from mathutils import Vector
import coastal_shell as shell
import coastal_anchors as anchors
import coastal_sunken as sunken
from coastal_landscape import top_height, web
from coastal_office import Parts, box, cylinder, _mat

ENTRY = {"x": (2.62, 4.22), "back": -18.0, "front": -9.04, "bottom": 2.6, "count": 32}
ENTRY["top"] = top_height(3.42, ENTRY["back"]) + 0.045
# A second, perpendicular flight reaches the public living floor. The upper landing retains
# a side connection to the private gallery, rather than making every visitor enter that floor.
LOWER_ENTRY = {"x": (-2.05, 2.43), "y": (-9.52, -7.92), "count": 16, "rise": 2.6}
ENTRY_WASHERS = ((-3.62, -8.1, 2.05), (4.42, -8.3, 4.6))
POOL = {"x": (-3.55, 1.65), "y": (7.76, 10.24), "floor": -1.22, "surface": -0.09}
PAN = {"actor": (7.25, 1.2, 0.0), "rest": (6.75, 1.15, 0.85)}


def clear(scene, prefixes):
    for obj in list(scene.objects):
        if obj.name.startswith(prefixes):
            bpy.data.objects.remove(obj, do_unlink=True)


def materials():
    get = bpy.data.materials.get
    return {"stone": get("warm cut stone"), "rock": get("golden coastal sandstone"), "oak": get("pale oak"),
            "smoked": get("honey ash"), "brass": get("brushed brass"), "black": get("matte black device"),
            "plaster": get("chalk limestone"), "glass": get("facade low-iron glass"),
            "water": _mat("infinity pool water", (0.12, 0.37, 0.36), 0.13, 0.0),
            "tile": _mat("sea glass pool mosaic", (0.12, 0.29, 0.27), 0.3),
            "light": _mat("arrival step diffuser", (0.84, 0.74, 0.57), 0.4, 0.0, (1.0, 0.76, 0.47), 1.2)}


def build_entry(scene, config):
    clear(scene, ("core_arrival_",))
    m = materials()
    # Replace the earlier decorative closed doorway: it had no passage through the rock.
    # Its pieces are retained as islands in the original core material batches.
    old_z = top_height(-0.5, -10.1)
    retired = 0
    for obj in scene.objects:
        if obj.type == "MESH" and obj.name.startswith("core__"):
            retired += shell.edit_islands(obj, lambda lo, hi: False if shell.inside(lo, hi, (-1.95, -11.92, old_z - 0.34), (0.95, -9.15, old_z + 2.15)) else None)[1]
    e = ENTRY
    x0, x1 = e["x"]
    # The tunnel is 2.45 m clear above the stair pitch. Its last treads open to the sky.
    cut_report = []
    if not scene.get("clifftopArrivalCut"):
        profile = [(e["back"] - 0.14, e["top"] - 0.19), (e["front"] + 0.16, 2.41),
                   (e["front"] + 0.16, 5.25), (e["back"] - 0.14, e["top"] + 2.65)]
        cutter = shell._prism("arrival stair cutter", profile, "x", x0 - 0.06, x1 + 0.06, m["plaster"])
        foyer = shell._box_object("arrival foyer cutter", (2.43, -9.15, 2.42), (4.47, -7.52, 5.28), m["plaster"])
        for obj in list(scene.objects):
            if obj.type != "MESH" or obj.name.startswith(("arrival ", "core_arrival_")):
                continue
            if obj.name in ("core__golden coastal sandstone", "coast_shared_golden coastal sandstone") or obj.get("caveRoof"):
                before = len(obj.data.polygons)
                stair_cut = shell.boolean_preserving_islands(obj, cutter)
                foyer_cut = shell.boolean_preserving_islands(obj, foyer)
                cut_report.append({"mesh": obj.name, "facesBefore": before, "facesAfter": len(obj.data.polygons),
                                   "stair": stair_cut, "foyer": foyer_cut})
        bpy.data.objects.remove(cutter, do_unlink=True)
        bpy.data.objects.remove(foyer, do_unlink=True)
        scene["clifftopArrivalCut"] = True
    p = Parts("core_arrival")
    stone, oak, bronze = p.bm(m["stone"]), p.bm(m["oak"]), p.bm(m["brass"])
    # A foyer with an open connection to the upper gallery, a shoe bench and a narrow console.
    box(stone, (3.45, -8.31, 2.48), (2.04, 1.66, 0.24), 0.015)
    box(oak, (4.32, -8.53, 3.05), (0.28, 0.96, 0.09), 0.025)
    for y in (-8.9, -8.16):
        box(p.bm(m["smoked"]), (4.32, y, 2.82), (0.22, 0.055, 0.44), 0.008)
    # Oak slats and hooks stop below the tunnel ceiling.
    for k in range(9):
        box(oak, (4.43, -8.96 + k * 0.11, 3.79), (0.035, 0.055, 1.10), 0.008)
    for y in (-8.75, -8.42):
        cylinder(bronze, (4.41, y, 4.09), (4.32, y, 4.09), 0.012, 10)
    supports = [sunken.support("arrival-foyer", (2.43, 4.47, -9.15, -7.52), 2.6)]
    count = e["count"]
    run = (e["front"] - e["back"]) / count
    rise = (e["top"] - e["bottom"]) / count
    route = [web((2.35, -6.1, 2.6)), web((3.42, -6.1, 2.6)), web((3.42, -7.62, 2.6)), web((3.42, e["front"] + 0.12, 2.6))]
    for k in range(count):
        y1, y0 = e["front"] - k * run, e["front"] - (k + 1) * run
        z = e["bottom"] + (k + 1) * rise
        box(stone, ((x0 + x1) / 2, (y0 + y1) / 2, z - 0.12), (x1 - x0, run + 0.008, 0.24), 0.006)
        box(oak, ((x0 + x1) / 2, (y0 + y1) / 2, z - 0.016), (x1 - x0 - 0.04, run - 0.006, 0.032), 0.006)
        supports.append(sunken.support(f"arrival-tread-{k + 1}", (x0, x1, y0, y1), z))
        route.append(web((3.42, (y0 + y1) / 2, z)))
        # Shaded step-level wayfinding at every fourth riser, fixed warm light even while paused.
        if k % 4 == 0:
            box(p.bm(m["light"]), (x1 - 0.018, y1 - 0.07, z + 0.13), (0.012, 0.12, 0.024), 0.003)
    # Continuous handrails follow the pitch. At the mouth, sandstone cheeks frame a quiet open portal.
    for x in (x0 + 0.08, x1 - 0.08):
        cylinder(bronze, (x, e["front"], 3.48), (x, e["back"], e["top"] + 0.88), 0.022, 12)
        for k in range(0, count + 1, 4):
            y = e["front"] - k * run
            z = e["bottom"] + k * rise
            cylinder(bronze, (x, y, z), (x, y, z + 0.88), 0.012, 10)
    top = e["top"]
    box(stone, (3.42, e["back"] - 0.56, top - 0.1), (2.24, 1.16, 0.20), 0.025)
    supports.append(sunken.support("arrival-top-landing", (2.3, 4.54, e["back"] - 1.14, e["back"] + 0.02), top))
    for x in (2.37, 4.47):
        box(p.bm(m["rock"]), (x, e["back"] + 0.11, top + 0.52), (0.22, 1.8, 1.06), 0.055)
    # A thin slatted canopy is supported by four posts, and leaves the actual opening unobstructed.
    for x in (2.39, 4.45):
        for y in (e["back"] - 0.6, e["back"] + 0.8):
            cylinder(p.bm(m["smoked"]), (x, y, top), (x, y, top + 2.35), 0.045, 12)
    for k in range(15):
        box(oak, (3.42, e["back"] - 0.7 + k * 0.12, top + 2.36), (2.30, 0.075, 0.07), 0.01)
    # The retained inland stepping-stone path gains a short branch to the new portal.
    for k in range(6):
        x, y = 0.60 + k * 0.38, e["back"] - 0.56
        box(stone, (x, y, top_height(x, y) + 0.02), (0.42, 1.05, 0.07), 0.015)
    objects = p.finish()
    lower_objects, lower_supports, lower_route, lower_report = build_lower_entry(scene)
    objects += lower_objects
    supports += lower_supports
    # Both routes are living-to-clifftop, so reversing this is the physical arrival journey.
    route = lower_route + route[3:]
    config["entrance"] = {"floor": 2.6, "top": round(top, 4), "stairWidth": x1 - x0, "riser": round(rise, 4), "going": round(run, 4), "route": route,
                          "foyer": web((3.42, -8.35, 2.6)), "portal": web((3.42, e["back"] - 0.55, top)), "headroom": 2.45,
                          "bounds": {"min": [-3.7, -.2, 7.1], "max": [4.6, top + 2.5, 19.2]}}
    config["entrance"].update(floor=0, foyer=web((-2.8, -8.4, 0)),
                              privateGallery=web((3.42, -7.35, 2.6)), lowerFlight=lower_report,
                              privateEntrance={"route": [web((3.42, -8.72, 2.6)), web((3.42, -7.35, 2.6)),
                                                           web((3.42, -6.1, 2.6)), web((2.35, -6.1, 2.6))]})
    # The whole coast makes the shell's broad Box3 ineligible as a compact Walk bound. Extend the
    # exact existing field explicitly, so its inland treads are actually rasterized and climbable.
    config["walk"] = {"region": {"min": [-18.0, -1.5, -11.2], "max": [18.0, top + 3.0, 35.0]},
                      "start": {"position": web((3.42, e["back"] - 0.55, top)), "yaw": math.pi, "pitch": -.08},
                      "mainEntryRoute": list(reversed(route + [web((3.42, e["back"] - 0.55, top))]))}
    config.setdefault("interiorLights", {})["entrance"] = {
        "positions": [web(p) for p in ENTRY_WASHERS],
        "region": {"min": [-3.65, -0.2, 7.3], "max": [4.6, 5.3, 9.6]}}
    # The camera's analytic rear-wall box has the same doorway as the native solid.
    walls = config["cameraCollision"]["walls"]
    walls[:] = [w for w in walls if not (w.get("arrival") or w["min"][2] == 7.75)]
    walls.extend([{"arrival": True, "min": [-5.2, -0.26, 7.75], "max": [-3.68, 6, 8.05]},
                  {"arrival": True, "min": [-3.68, 2.70, 7.75], "max": [-1.98, 6, 8.05]},
                  {"arrival": True, "min": [-1.98, -0.26, 7.75], "max": [2.42, 6, 8.05]},
                  {"arrival": True, "min": [2.42, 5.28, 7.75], "max": [4.48, 6, 8.05]},
                  {"arrival": True, "min": [4.48, -0.26, 7.75], "max": [5.2, 6, 8.05]}])
    return objects, supports, {"cuts": cut_report, "retiredDecorativeDoorIslands": retired, "risers": count, "rise": rise, "run": run, "headroom": 2.45, "lowerFlight": lower_report}


def build_lower_entry(scene):
    """Carved switchback to a ground-floor foyer; built supports match every actual tread."""
    m = materials()
    e = LOWER_ENTRY
    x0, x1 = e["x"]
    y0, y1 = e["y"]
    cuts = []
    if scene.get("lowerArrivalCutVersion", 0) < 1:
        profile = [(x0 - .08, -.20), (x1 + .08, 2.40), (x1 + .08, 5.30), (x0 - .08, 2.70)]
        flight = shell._prism("lower arrival flight cutter", profile, "y", y0 - .06, y1 + .06, m["plaster"])
        foyer = shell._box_object("lower arrival foyer cutter", (-3.68, y0 - .06, -.20), (-1.98, -7.10, 2.70), m["plaster"])
        for obj in list(scene.objects):
            if obj.type == "MESH" and (obj.name in ("core__golden coastal sandstone", "coast_shared_golden coastal sandstone") or obj.get("caveRoof")):
                flight_cut = shell.boolean_preserving_islands(obj, flight)
                foyer_cut = shell.boolean_preserving_islands(obj, foyer)
                cuts.append({"mesh": obj.name, "flight": flight_cut, "foyer": foyer_cut})
        bpy.data.objects.remove(flight, do_unlink=True)
        bpy.data.objects.remove(foyer, do_unlink=True)
        scene["lowerArrivalCut"] = True
        scene["lowerArrivalCutVersion"] = 1
        scene["lowerArrivalCutReport"] = json.dumps(cuts)
    # The old free-standing sage cupboard banks obstructed the lower rear circulation. Retire
    # their separate native islands; the new coat/shoe bench has a deliberate recessed home.
    cupboards = (((-4.9, -7.76, -.02), (-2.10, -7.0, 2.05)), ((2.15, -7.76, -.02), (4.9, -7.0, 2.05)))
    removed = 0
    for obj in scene.objects:
        if obj.type == "MESH" and obj.name.startswith("core__"):
            removed += shell.edit_islands(obj, lambda lo, hi: False if any(shell.inside(lo, hi, *bounds) for bounds in cupboards) else None)[1]
    scene["entryRetiredCupboardIslands"] = int(scene.get("entryRetiredCupboardIslands", 0)) + removed
    # An old onsen decorative rail crossed the optional gallery doorway. Cut the actual mesh,
    # rather than instructing the collision system to ignore a visibly solid obstacle.
    rail_cutter = shell._box_object("arrival doorway rail cutter", (2.43, -8.08, 2.59), (4.47, -7.64, 5.15), m["plaster"])
    door_pieces = []
    for obj in scene.objects:
        if obj.type == "MESH" and obj.name.startswith("onsen_decor"):
            shell.boolean(obj, rail_cutter, "DIFFERENCE")
            door_pieces.append(obj.name)
    bpy.data.objects.remove(rail_cutter, do_unlink=True)
    p = Parts("core_arrival_lower")
    stone, oak, bronze = p.bm(m["stone"]), p.bm(m["oak"]), p.bm(m["brass"])
    box(stone, (-2.835, (y0 - 7.10) / 2, -.12), (1.57, -7.10 - y0, .24), .012)
    supports = [sunken.support("arrival-lower-foyer", (-3.62, x0, y0, -7.10), 0)]
    going, rise = (x1 - x0) / e["count"], e["rise"] / e["count"]
    route = [web((3.27, -1.2, 0)), web((3.27, -5.6, 0)), web((-2.8, -5.6, 0)),
             web((-2.8, -7.2, 0)), web((-2.8, -8.72, 0)), web((x0 - .15, -8.72, 0))]
    for k in range(e["count"]):
        a, b, z = x0 + k * going, x0 + (k + 1) * going, (k + 1) * rise
        box(stone, ((a + b) / 2, (y0 + y1) / 2, z - .12), (going + .008, y1 - y0, .24), .006)
        box(oak, ((a + b) / 2, (y0 + y1) / 2, z - .016), (going - .006, y1 - y0 - .04, .032), .006)
        supports.append(sunken.support(f"arrival-lower-tread-{k+1}", (a, b, y0, y1), z))
        route.append(web(((a + b) / 2, -8.72, z)))
        if k % 4 == 0:
            box(p.bm(m["light"]), (a + .07, y0 + .018, z + .13), (.12, .012, .024), .003)
    route += [web((2.59, -8.72, 2.6)), web((3.42, -8.72, 2.6))]
    for y in (y0 + .08, y1 - .08):
        cylinder(bronze, (x0, y, .88), (x1, y, 3.48), .022, 12)
        for k in range(0, e["count"] + 1, 4):
            x, z = x0 + k * going, k * rise
            cylinder(bronze, (x, y, z), (x, y, z + .88), .012, 10)
    # Guard the upper stair opening's closed end as well as its gallery edge. The east end
    # remains the actual stair landing; a visitor cannot mistake the west edge for a descent.
    guard = p.bm(m["smoked"])
    for a, b in (((-2.12, -7.73), (1.92, -7.73)), ((-2.12, -7.73), (-2.12, -6.45))):
        cylinder(guard, (*a, 3.54), (*b, 3.54), .025, 12)
        length = math.dist(a, b)
        n = math.ceil(length / .12)
        for k in range(n+1):
            t = k/n
            x, y = a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t
            cylinder(bronze, (x, y, 2.62), (x, y, 3.52), .008, 8)
    # A pale-oak recessed entry bench with a shoe bay, vertical coat battens, hooks and warm
    # wall washers replaces the miscellaneous green cabinets without occupying circulation.
    smoked = p.bm(m["smoked"])
    box(oak, (-3.43, -8.46, .47), (.30, 1.25, .08), .025)
    for y in (-9.03, -7.89):
        box(smoked, (-3.43, y, .24), (.25, .055, .43), .008)
    box(oak, (-3.43, -8.46, .13), (.25, 1.17, .035), .008)
    for k in range(12):
        box(oak, (-3.59, -9.04 + k * .108, 1.24), (.035, .045, 1.72), .008)
    for y in (-8.9, -8.55, -8.2):
        cylinder(bronze, (-3.57, y, 1.75), (-3.49, y, 1.75), .012, 10)
    # Geometry for two bounded warm wall washers, consumed analytically by interiorLights.
    for x, y, z in ENTRY_WASHERS:
        box(p.bm(m["smoked"]), (x, y, z + .035), (.12, .32, .07), .018)
        box(p.bm(m["light"]), (x, y, z - .008), (.09, .28, .018), .006)
    return p.finish(), supports, route, {"risers": e["count"], "rise": rise, "run": going, "width": y1-y0,
            "minimumHeadroom": 2.4, "cuts": cuts or json.loads(scene.get("lowerArrivalCutReport", "[]")),
            "removedCupboardIslands": int(scene["entryRetiredCupboardIslands"]), "clearedGalleryDoorMeshes": door_pieces}


def build_pool(scene, config):
    clear(scene, ("core_infinity_",))
    m = materials()
    p = Parts("core_infinity")
    x0, x1 = POOL["x"]
    y0, y1 = POOL["y"]
    stone, tile = p.bm(m["stone"]), p.bm(m["tile"])
    # A solid cantilever tied back into the existing sandstone terrace, with a thick corbel root.
    box(p.bm(m["rock"]), (-0.95, 7.27, -0.66), (5.96, 1.18, 1.32), 0.08)
    box(stone, ((x0 + x1) / 2, (y0 + y1) / 2, POOL["floor"] - 0.13), (x1 - x0 + 0.42, y1 - y0 + 0.42, 0.26), 0.025)
    box(tile, ((x0 + x1) / 2, (y0 + y1) / 2, POOL["floor"] - 0.012), (x1 - x0, y1 - y0, 0.024), 0.005)
    for x in (x0 - 0.11, x1 + 0.11):
        box(stone, (x, (y0 + y1) / 2, -0.63), (0.22, y1 - y0 + 0.42, 1.26), 0.015)
        box(stone, (x, (y0 + y1) / 2, 0.015), (0.30, y1 - y0 + 0.58, 0.05), 0.01)
    box(stone, ((x0 + x1) / 2, y0 - 0.11, -0.63), (x1 - x0, 0.22, 1.26), 0.015)
    # The water overtops a narrow sea edge into a concealed catch gutter; no opaque parapet blocks it.
    box(tile, ((x0 + x1) / 2, y1 + 0.035, -0.645), (x1 - x0, 0.07, 1.12), 0.004)
    box(stone, ((x0 + x1) / 2, y1 + 0.18, -0.25), (x1 - x0 + 0.4, 0.22, 0.15), 0.01)
    box(tile, ((x0 + x1) / 2, y1 + 0.15, -0.18), (x1 - x0, 0.16, 0.02), 0.004)
    # Deck reached through a real opening in the terrace's original rail, not across its glass.
    box(stone, ((x0 + x1) / 2, 7.18, -0.09), (x1 - x0 + 0.8, 1.16, 0.18), 0.015)
    if not scene.get("infinityPoolAccessCut"):
        tool = shell._box_object("pool access cutter", (-1.7, 6.35, 0.025), (-0.6, 8.0, 1.4), m["stone"])
        for name in ("core_facade__golden_coastal_sandstone", "core_facade__travertine_paving_stone", "core_facade__dark_bronze", "core_terrace_balustrade_glass", "core_facade__facade_low_iron_glass"):
            obj = bpy.data.objects.get(name)
            if obj:
                shell.boolean(obj, tool, "DIFFERENCE")
        bpy.data.objects.remove(tool, do_unlink=True)
        scene["infinityPoolAccessCut"] = True
    for x in (x0 - 0.32, x1 + 0.32):
        cylinder(p.bm(m["brass"]), (x, 6.7, 0.95), (x, y1 + 0.25, 0.95), 0.019, 12)
        for y in (6.85, 8.1, 9.3, y1 + 0.20):
            cylinder(p.bm(m["brass"]), (x, y, 0), (x, y, 0.95), 0.014, 10)
    # Native broad entry treads descend into the shallow end; water remains a Walk exclusion.
    for k in range(3):
        z = -0.27 * (k + 1)
        box(tile, (x0 + 0.58, y0 + 0.16 + k * 0.28, (POOL["floor"] + z) / 2), (0.95, 0.30, z - POOL["floor"]), 0.008)
    objects = p.finish()
    water_bm = bmesh.new()
    bmesh.ops.create_grid(water_bm, x_segments=40, y_segments=20, size=1)
    for v in water_bm.verts:
        v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0) / 2, (y0 + y1) / 2 + v.co.y * (y1 - y0) / 2, POOL["surface"]))
    water = shell.from_bmesh("core_infinity_water", water_bm, m["water"])
    water["water"] = True
    water["noBake"] = True
    bsdf = m["water"].node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Transmission Weight"].default_value = 0.82
    bsdf.inputs["IOR"].default_value = 1.333
    config["infinityPool"] = {"center": web(((x0 + x1) / 2, (y0 + y1) / 2, POOL["surface"])), "size": [x1 - x0, y1 - y0],
                              "depth": round(POOL["surface"] - POOL["floor"], 3), "waterline": POOL["surface"], "node": water.name,
                              "access": [web((-1.15, 6.25, 0)), web((-1.15, 7.20, 0))], "waveAmplitude": 0.004}
    return objects + [water], [sunken.support("infinity-deck", (x0 - 0.4, x1 + 0.4, 6.6, y0 - 0.12), 0.0)], {"waterline": POOL["surface"], "depth": 1.13, "surfaceVertices": len(water.data.vertices)}


def build_gym_station(scene, config):
    clear(scene, ("gym_pan_station", "gym_placeholder_gym-pan", "study_placeholder_study-aeron"))
    m = materials()
    p = Parts("gym_pan_station")
    box(p.bm(m["smoked"]), (6.75, 1.15, 0.815), (0.7, 0.68, 0.07), 0.02)
    for x in (6.47, 7.03):
        for y in (0.88, 1.42):
            cylinder(p.bm(m["black"]), (x, y, 0), (x, y, 0.78), 0.025, 10)
    box(p.bm(m["oak"]), (6.75, 1.15, 0.28), (0.66, 0.60, 0.05), 0.012)
    # A small front task pendant lights a lifter's face and the pan station, rather than leaving
    # the only bright line behind raised hands. Its analytic segment lives in light-installations.
    box(p.bm(m["black"]), (7.175, 2.2, 2.48), (1.29, 0.075, 0.05), 0.01)
    diffuser = bpy.data.materials.get("gym light diffuser") or _mat("gym light diffuser", (0.95, 0.89, 0.78), .4, 0, (1, .88, .74), 1)
    box(p.bm(diffuser), (7.175, 2.2, 2.45), (1.25, 0.055, 0.012), 0.004)
    for x in (6.65, 7.70):
        cylinder(p.bm(m["black"]), (x, 2.2, 2.5), (x, 2.2, 3.05), .004, 6)
    objects = p.finish()
    ph = anchors.Placeholder("gym", "gym-pan")
    cylinder(ph.bm(m["black"]), (6.75, 1.15, 0.85), (6.75, 1.15, 0.90), 0.20, 32)
    cylinder(ph.bm(m["black"]), (6.75, 0.96, 0.89), (6.75, 0.72, 0.89), 0.025, 10)
    objects.append(ph.finish())
    # Existing chair pieces share batched study materials: remove only islands in its measured box.
    removed = 0
    for obj in scene.objects:
        if obj.type == "MESH" and obj.name.startswith("study__"):
            removed += shell.edit_islands(obj, lambda lo, hi: False if shell.inside(lo, hi, (-0.74, -3.96, 2.59), (0.05, -3.14, 3.91)) else None)[1]
    chair = anchors.Placeholder("study", "study-aeron")
    cylinder(chair.bm(m["black"]), (-0.36, -3.55, 2.6), (-0.36, -3.55, 3.08), 0.035, 12)
    box(chair.bm(m["black"]), (-0.40, -3.55, 3.085), (0.48, 0.49, 0.06), 0.025)
    box(chair.bm(m["black"]), (-0.09, -3.55, 3.56), (0.06, 0.46, 0.56), 0.025)
    objects.append(chair.finish())
    anchors.merge_anchors(config, [anchors.anchor_entry("gym-pan", "cast-iron-pan", "gym", PAN["rest"], yaw=0),
                                   anchors.anchor_entry("study-aeron", "aeron", "study", (-0.36, -3.55, 2.6), facing_blender=(-1, 0))])
    config["equipment"]["gym"]["pan"] = {"actor": web(PAN["actor"]), "facing": math.pi, "rest": web(PAN["rest"]), "anchor": "gym-pan"}
    for side, key in (("right", "exercise-weight"), ("left", "exercise-weight-left")):
        obj = next((o for o in scene.objects if o.get("activityProp") == key and o.name.startswith("gym_")), None)
        if obj:
            anchor_id = f"gym-dumbbell-{side}"
            obj["furniturePlaceholder"] = anchor_id
            point = config["equipment"]["gym"]["dumbbells"]["pair"][0 if side == "right" else 1]
            entry = {"id": anchor_id, "item": "dumbbell", "room": "gym", "position": [point[0], point[1] - 0.084, point[2]], "yaw": 0, "activityProp": key}
            anchors.merge_anchors(config, [entry])
    return objects, {"removedChairIslands": removed, "pan": config["equipment"]["gym"]["pan"]}
