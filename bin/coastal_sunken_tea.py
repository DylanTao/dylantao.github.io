
"""Lower the tea garden, retain the bedroom above, and connect its two exits.

The plan uses Blender metres with +Y towards the sea and Z up. Manifest
positions are written as (x, height, -y). Run fit_sunken_tea on the retained
native master before packing the shell, coast, and kitchen.
"""

from itertools import product

import bpy

import coastal_arrival_hall as hall
import coastal_shell as shell
from coastal_arrival_straight_b import excavation_scope
from coastal_embedded_lift_cut import discard, splice_cut
from coastal_listening_bar import Joinery

WEST, EAST, BACK, FRONT = -8.43, -5.25, -6.30, -3.40
FLOOR, OLD_FLOOR, SOFFIT = -1.04, -0.20, 1.34
LOWER = FLOOR - OLD_FLOOR
TERRACE, LIBRARY = 0.001, 0.0
STONE, OAK, BRONZE, GLASS = "warm cut stone", "pale oak", "dark bronze", "facade low-iron glass"
ROCK = ("core__golden coastal sandstone", "coast_shared_golden coastal sandstone")
TERRACE_OWNERS = ("core_estate_terrace__warm cut stone", "core_estate_terrace__travertine paving stone")
LIBRARY_FLOORS = ("core_retreat_library__warm cut stone", "core_retreat_library__pale oak")
LIBRARY_WALL = "core_retreat_library__chalk limestone"
POOL_X, POOL_RUN, POOL_GOING = (-8.32, -7.20), -3.93, 0.36
SIDE_Y, SIDE_RUN, SIDE_GOING = (-4.61, -3.54), -8.32, 0.34


def cut(scene, name, lo, hi, owners):
    return hall._cut(scene, name, lo[0], hi[0], -hi[1], -lo[1], lo[2], hi[2], scene.objects[ROCK[0]].data.materials[0], [scene.objects[n] for n in owners])


def orthogonal_cut(scene, name, boxes):
    """Make a single watertight, axis-aligned union for the retained cliff."""
    axes = [sorted({corner[i] for box in boxes for corner in box}) for i in range(3)]
    occupied = set()
    for cell in product(*(range(len(axis) - 1) for axis in axes)):
        center = [(axis[k] + axis[k + 1]) / 2 for axis, k in zip(axes, cell)]
        if any(all(lo[i] < center[i] < hi[i] for i in range(3)) for lo, hi in boxes):
            occupied.add(cell)
    vertices, faces, indices = [], [], {}
    sides = (
        ((-1, 0, 0), ((0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0))),
        ((1, 0, 0), ((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1))),
        ((0, -1, 0), ((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1))),
        ((0, 1, 0), ((0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0))),
        ((0, 0, -1), ((0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0))),
        ((0, 0, 1), ((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1))),
    )
    for cell in sorted(occupied):
        for direction, corners in sides:
            if tuple(k + d for k, d in zip(cell, direction)) in occupied:
                continue
            face = []
            for offset in corners:
                key = tuple(k + d for k, d in zip(cell, offset))
                if key not in indices:
                    indices[key] = len(vertices)
                    vertices.append([axis[k] for axis, k in zip(axes, key)])
                face.append(indices[key])
            faces.append(face)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(scene.objects[ROCK[0]].data.materials[0])
    tool = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(tool)
    bpy.context.view_layer.update()
    touches, distance = excavation_scope(boxes)
    try:
        return {
            "cutter": name,
            "meshes": {
                owner: splice_cut(scene.objects[owner], tool, touches_cut=touches, cut_distance=distance, stop_at_retained_edges=True)
                for owner in ROCK
            },
        }
    finally:
        discard(tool)


def fits_plan(lo, hi, x0, x1, y0, y1):
    return x0 <= lo.x and hi.x <= x1 and y0 <= lo.y and hi.y <= y1


def move_furniture(scene):
    garden = [obj for obj in scene.objects if obj.name.startswith("kitchen_garden__")]
    if len(garden) != 16:
        raise ValueError(f"The retained tea garden should have 16 finish batches, found {len(garden)}")
    for obj in garden:
        obj.location.z += LOWER
    bpy.context.view_layer.update()

    # The entire timber seat and tea set move inland together, clear of the
    # side approach. Low terrace stones and plants keep their own substrates.
    platform = (-7.43, -5.49, -5.64, -3.70)
    fixed_to_platform = {"celadon glaze", "garden lantern paper", "honey ash", "indigo textile", "linen", "linen canvas sun", "sage textile", "terracotta"}
    for obj in garden:
        material = obj.name.split("__", 1)[1]
        if material in fixed_to_platform:
            obj.location.y -= 0.43
        elif material == "pale oak":
            shell.edit_islands(obj, lambda lo, hi: (0, -0.43, 0) if fits_plan(lo, hi, *platform) and hi.z > FLOOR + 0.05 else None)
        elif material == "warm cut stone":
            # Keep the basin. Free the outer stair from its former approach stones.
            shell.edit_islands(obj, lambda lo, hi: (0.40, -0.70, 0) if hi.y > POOL_RUN - .08 and lo.x < POOL_X[1] and hi.z <= FLOOR + .14 else None)
        elif "leaf" in material:
            # Flexible foliage does not obstruct a capsule. The basin,
            # timber joinery, lantern and its rigid frame keep their own solids.
            obj["walk"] = "through"
            if "Strelitzia" not in material:
                shell.edit_islands(obj, lambda lo, hi: (0.21, -0.68, 0) if hi.y > POOL_RUN - .18 and lo.x < POOL_X[1] else None)

    bpy.context.view_layer.update()
    return [obj.name for obj in garden]


def move_library_planter(scene):
    """Keep the original stem and linen planter together beside the window."""
    plan = (-9.06, -8.64, -4.51, -4.09)
    moved = {}
    for name in ("study__linen", "study__honey ash"):
        moved[name], _ = shell.edit_islands(
            scene.objects[name],
            lambda lo, hi: (0, 1.18, 0) if fits_plan(lo, hi, *plan) and -.004 <= lo.z <= hi.z <= 1.61 else None,
        )
    if moved["study__linen"] != 1 or not moved["study__honey ash"]:
        raise ValueError(f"The library planter's original components changed: {moved}")
    return moved


def move_library_rug(scene):
    """Clear the last tread while preserving the rug and its four indigo borders."""
    outline = (-11.858, -9.64, -5.658, -3.442)
    moved = {}
    for name in ("study__linen", "study__indigo textile"):
        moved[name], _ = shell.edit_islands(
            scene.objects[name],
            lambda lo, hi: (-0.52, 0, 0) if fits_plan(lo, hi, *outline) and -.004 <= lo.z <= hi.z <= .019 else None,
        )
    if tuple(moved.values()) != (1, 4):
        raise ValueError(f"The library rug's original components changed: {moved}")
    return moved


def fit_masonry():
    j = Joinery("core_tea_garden_", "exterior")
    # New slab spans the contained bay, bearing on its lower stone returns.
    # Keep the original back stair landing and its west shoulder.
    j.block("floor", STONE, (-8.35, BACK + .012, -1.222), (-5.282, FRONT - .114, FLOOR), .004)
    j.block("floor", STONE, (-8.35, FRONT - .113, -1.222), (POOL_X[1] + .016, FRONT - .002, FLOOR), .003)
    j.block("back_bearing", STONE, (-8.35, BACK + .012, -1.34), (EAST - .008, BACK + .19, -1.224), .004)
    j.block("back_riser", STONE, (-8.35, BACK + .012, FLOOR), (EAST - .008, BACK + .125, OLD_FLOOR + .018), .004)
    for y0, y1 in ((BACK + .142, SIDE_Y[0] - .013), (SIDE_Y[1] + .013, FRONT - .008)):
        j.block("west_bearing", STONE, (WEST + .008, y0, -1.32), (-8.352, y1, OLD_FLOOR + .015), .004)
    j.block("east_bearing", STONE, (-5.28, BACK + .126, -1.31), (EAST - .004, FRONT - .115, OLD_FLOOR - .002), .003)
    j.block("water_threshold_sill", STONE, (POOL_X[1] + .018, FRONT - .113, -1.30), (EAST - .009, FRONT - .006, -.101), .005)
    j.block("water_threshold_liner", OAK, (POOL_X[1] + .018, FRONT - .104, -.100), (EAST - .010, FRONT - .009, -.073), .003)

    # Both six-riser flights keep the lower treads below the bedroom soffit
    # and meet the two retained floor planes at their respective landings.
    j.block("pool_bearing", STONE, (POOL_X[0], FRONT - .001, -1.217), (POOL_X[1], POOL_RUN + 5 * POOL_GOING, FLOOR - .001), .002)
    j.block("library_bearing", STONE, (SIDE_RUN - 5 * SIDE_GOING, SIDE_Y[0] + .01, -1.217), (-8.351, SIDE_Y[1] - .01, FLOOR - .001), .002)
    rise = (TERRACE - FLOOR) / 6
    for i in range(5):
        y = POOL_RUN + i * POOL_GOING
        level = FLOOR + (i + 1) * rise
        j.block("pool_stair", STONE, (POOL_X[0], y, FLOOR + .001), (POOL_X[1], y + POOL_GOING, level), .004)
    rise = (LIBRARY - FLOOR) / 6
    for i in range(5):
        x = SIDE_RUN - i * SIDE_GOING
        level = FLOOR + (i + 1) * rise
        j.block("library_stair", STONE, (x - SIDE_GOING, SIDE_Y[0] + .010, FLOOR + .001), (x, SIDE_Y[1] - .010, level), .004)

    # Solid cut-sandstone stair cheeks close the retained terrace paving edges.
    for x0, x1 in ((POOL_X[0] - .053, POOL_X[0] - .002), (POOL_X[1] + .002, POOL_X[1] + .053)):
        j.block("stair_cheek", STONE, (x0, -3.404, -1.22), (x1, POOL_RUN + 5 * POOL_GOING, TERRACE - .002), .003)
        x = (x0 + x1) / 2
        end = POOL_RUN + 5 * POOL_GOING - .025
        for y in (-3.38, (end - 3.38) / 2, end):
            j.span("flight_guards", BRONZE, (x, y, TERRACE), (x, y, 1.01), .012, 8)
        j.span("flight_guards", BRONZE, (x, -3.39, 1.012), (x, end, 1.012), .018, 8)
        j.span("flight_guards", BRONZE, (x, -3.39, .55), (x, end, .55), .010, 8)
    y = FRONT - .053
    j.span("stair_handrail", BRONZE, (POOL_X[1] + .004, POOL_RUN - .08, .09), (POOL_X[1] + .004, y, .49), .016, 8)
    j.span("stair_handrail", BRONZE, (POOL_X[1] + .004, POOL_RUN + .08, -.764), (POOL_X[1] + .004, POOL_RUN + .08, .165), .012, 8)

    j.block("library_head", OAK, (-8.552, SIDE_Y[0], 2.145), (-8.425, SIDE_Y[1], 2.192), .006)
    for y0, y1 in ((SIDE_Y[0], SIDE_Y[0] + .024), (SIDE_Y[1] - .024, SIDE_Y[1])):
        j.block("library_jambs", OAK, (-8.552, y0, FLOOR), (-8.425, y1, 2.144), .004)
        y = (y0 + y1) / 2
        for x in (-8.61, -9.19, -9.91):
            j.span("library_flight_guards", BRONZE, (x, y, LIBRARY), (x, y, .99), .012, 8)
        j.span("library_flight_guards", BRONZE, (-8.58, y, 1.00), (-9.97, y, 1.00), .018, 8)
        j.span("library_flight_guards", BRONZE, (-8.58, y, .53), (-9.97, y, .53), .010, 8)
    return j


def fit_pocket_window(j, config):
    # Two leaves on separate runners travel into the same opaque pocket.
    aperture_lo, aperture_hi, pocket_stop = -7.135, -5.985, -5.337
    sill, lintel = -.098, 1.289
    inside, outside = FRONT - .134, FRONT - .015
    j.block("window_head", OAK, (aperture_lo - .025, inside, 1.291), (pocket_stop + .022, outside, 1.338), .004)
    j.block("window_jamb", OAK, (aperture_lo - .044, inside, sill), (aperture_lo - .002, outside, 1.291), .004)
    # The two thin pocket skins leave both tracks and both leaves clear.
    for ya, yb in ((inside, inside + .016), (outside - .016, outside)):
        j.block("concealed_pocket", OAK, (aperture_hi, ya, sill), (pocket_stop + .013, yb, 1.292), .004)
    j.block("concealed_pocket", STONE, (pocket_stop + .004, inside + .016, sill), (pocket_stop + .03, outside - .016, 1.291), .004)
    # A separate clear fall guard remains on the terrace side of the open window.
    j.block("terrace_guard_glass", GLASS, (POOL_X[1] + .006, -3.358, .023), (EAST - .015, -3.342, 1.055), .001)
    j.span("terrace_guard_rail", BRONZE, (POOL_X[1] + .006, -3.35, 1.058), (EAST - .015, -3.35, 1.058), .012)
    for xa in (POOL_X[1] + .035, -6.28, EAST - .035):
        j.block("terrace_guard_shoes", BRONZE, (xa - .025, -3.374, TERRACE), (xa + .025, -3.326, .048), .003)
    width = (aperture_hi - aperture_lo) / 2.0
    for i, y in enumerate((inside + .039, inside + .080)):
        lo = aperture_lo + i * width - .004
        hi = aperture_lo + (i + 1) * width + .004
        key = f"tea-garden-window-{i + 1}"
        leaf = Joinery(f"core_{key.replace('-', '_')}_", "exterior")
        leaf.block("pane", GLASS, (lo + .01, y - .004, sill + .015), (hi - .01, y + .004, lintel - .013), .001)
        for xa in (lo, hi - .016):
            leaf.block("stiles", BRONZE, (xa, y - .010, sill), (xa + .016, y + .010, lintel), .002)
        for z in (sill, lintel - .017):
            leaf.block("track", BRONZE, (lo + .016, y - .010, z), (hi - .016, y + .010, z + .017), .002)
        # The fully-open extent has 16 mm side clearance in the opaque housing.
        travel = aperture_hi + .020 - lo
        nodes = []
        for _, obj in leaf.finish():
            obj["estateDoor"] = key
            obj["walk"] = "dynamic-door"
            obj["slideX"] = travel
            nodes.append(obj.name)
        config["estateDoors"].append({
            "id": key, "nodes": nodes, "slideX": travel,
            "center": [(lo + hi) / 2, (lintel + sill) / 2, -y],
            "opening": {"min": [lo, sill, -y - .015], "max": [hi, lintel, -y + .015]},
            "activationDistance": 1.35, "floor": FLOOR,
            "material": "low-iron glazing in a two-track oak pocket",
        })
    return [aperture_lo, aperture_hi, aperture_hi + .020, aperture_hi + .020 + width + .008]


def fit_sunken_tea(scene, config):
    if scene.get("sunkenTeaGarden"):
        raise ValueError("The tea garden is already lowered")
    # The lower bay leaves the bearing and existing bedroom spiral landing
    # in its northwest corner. All intersecting cliff cuts are applied once.
    main_bay = ((-8.045, BACK + .003, -1.34), (EAST + .006, FRONT + .002, -.131))
    west_return = ((WEST + .006, -5.046, -1.34), (-8.034, FRONT + .002, -.131))
    pool_stair = (
        (POOL_X[0] - .055, POOL_RUN - .084, -1.22),
        (POOL_X[1] + .055, POOL_RUN + 5 * POOL_GOING, .038),
    )
    library_stair = (
        (SIDE_RUN - 5 * SIDE_GOING, SIDE_Y[0] - .010, -1.22),
        (SIDE_RUN + .022, SIDE_Y[1] + .010, .035),
    )
    library_door = (
        (-8.587, SIDE_Y[0] - .004, -1.221),
        (-8.413, SIDE_Y[1] + .004, 2.195),
    )
    excavation = [
        orthogonal_cut(scene, "Tea garden cliff cuts", (main_bay, west_return, pool_stair, library_stair, library_door)),
        cut(scene, "Tea garden pool stair", *pool_stair, TERRACE_OWNERS),
        cut(scene, "Tea garden library flight", *library_stair, LIBRARY_FLOORS),
        cut(scene, "Tea garden library doorway", *library_door, (LIBRARY_WALL,)),
    ]
    furniture = move_furniture(scene)
    planter = move_library_planter(scene)
    rug = move_library_rug(scene)
    joinery = fit_masonry()
    window = fit_pocket_window(joinery, config)
    for piece, obj in joinery.finish():
        if piece == "terrace_guard_glass":
            obj["glazing"] = True
            obj["walk"] = "solid"
    lamp = next(item for item in config["installationPoints"] if item["id"] == "tea-garden-lantern")
    lamp["position"] = [-7.27, round(0.491 + LOWER, 3), 5.06]
    lamp["region"] = {"min": [-8.43, -1.08, 3.4], "max": [-5.25, 1.34, 6.3]}
    config["walk"]["places"]["tea-garden"] = {
        "label": "Tea garden", "room": "kitchen", "position": [-7.79, -1.025, 4.67], "yaw": -.42, "pitch": -.10, "fov": 67,
        "bounds": {"min": [WEST, FLOOR - .03, -FRONT], "max": [EAST, SOFFIT, -BACK]},
    }
    scene["sunkenTeaGarden"] = 1
    bpy.context.view_layer.update()
    return {"bay": [WEST, EAST, BACK, FRONT, FLOOR, SOFFIT], "cuts": excavation, "moved": furniture, "planter": planter, "rug": rug, "window": window}
