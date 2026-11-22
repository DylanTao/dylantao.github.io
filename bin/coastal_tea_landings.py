"""Restore the dry promenade at the sunken tea garden's two stair heads.

The branching flight shares two low treads and a stone landing beneath the
bedroom. Positions are Blender metres (x, seaward y, height).
"""

import bpy
from mathutils import Vector

import coastal_arrival_hall as hall
from coastal_embedded_lift_cut import discard
from coastal_listening_bar import Joinery
from coastal_sunken_tea import BRONZE, FLOOR, GLASS, OAK, STONE, TERRACE

PREFIX = "core_tea_garden_"
RETIRED = (
    "pool_stair",
    "pool_bearing",
    "stair_cheek",
    "stair_handrail",
    "flight_guards",
    "library_stair",
    "library_bearing",
    "library_flight_guards",
)
PAVING = "travertine paving stone"
BRASS = "brushed brass"
BED_SLAB = "core_finish_bedchamber_slab__warm cut stone"
BED_FLOOR = "core_finish_bedchamber_floor__pale oak"
BED_SILL = "sleep_fin_window__brushed brass"
BED_GLASS = "sleep_fin_window__facade low-iron glass"

RISE = (TERRACE - FLOOR) / 6
LEVELS = [FLOOR + index * RISE for index in range(7)]
FOOT_X = (-8.005, -7.442)
SPLIT_Y = (-4.630, -3.854)
POOL_X = (-7.981, -7.165)
POOL_LIP = -3.394
SIDE_Y = (-4.600, -3.806)
SIDE_TURN, SIDE_LIP = -8.62, -9.16
NOTCH_X = (-7.996, -7.156)
NOTCH_BACK = -3.815
LOW_GLASS = 1.887


def refit_window_over_stair(scene):
    """Retain the wardrobe and pane, raising only the sill over the stair."""
    x0, x1 = NOTCH_X
    material = bpy.data.materials[STONE]
    floor = hall._cut(
        scene, "Tea stair soffit pocket", x0, x1, 3.378, -NOTCH_BACK, 1.316, 1.504,
        material, [scene.objects[BED_SLAB], scene.objects[BED_FLOOR]],
    )
    # Relieve the underside behind the oak edge. The wardrobe remains on
    # its untouched oak boards and the thick western cheek of the slab.
    rear = hall._cut(
        scene, "Tea stair rear headroom", x0, x1, -NOTCH_BACK - .002, 4.105, 1.316, 1.465,
        material, [scene.objects[BED_SLAB]],
    )
    window = hall._cut(
        scene, "Tea stair raised glazing sill", x0, x1, 3.395, 3.456, 1.494, LOW_GLASS,
        material, [scene.objects[BED_SILL], scene.objects[BED_GLASS]],
    )
    j = Joinery(PREFIX, "bedchamber")
    # The raised sill and jambs land on the uncut slab shoulders. The dark
    # metal inside the window frame maintains the original sightline above it.
    j.block("bedroom_pocket_sill", BRASS, (x0 - .004, -3.447, LOW_GLASS - .025), (x1 + .004, -3.403, LOW_GLASS + .004), .002)
    for x in (x0 - .016, x1 + .016):
        j.block("bedroom_pocket_sill", BRASS, (x - .008, -3.447, 1.515), (x + .008, -3.403, LOW_GLASS - .026), .002)

    # A recessed oak frame shades the plane of the cut without a low lintel
    # across the feet. Its boards lie outside the clear opening.
    j.block("bedroom_pocket_oak", OAK, (x0 - .052, NOTCH_BACK - .032, 1.464), (x1 + .052, NOTCH_BACK - .002, 1.511), .004)
    for a, b in ((x0 - .034, x0 - .002), (x1 + .002, x1 + .034)):
        j.block("bedroom_pocket_oak", OAK, (a, NOTCH_BACK - .001, 1.350), (b, -3.401, 1.511), .004)

    # A low-iron, full-height return guards three inside edges of the new
    # opening. It stops before the working wardrobe front and stays inboard
    # of the continuous bedroom window.
    panels = (
        ((x0 - .014, NOTCH_BACK - .020, 1.505), (x1 + .014, NOTCH_BACK - .008, 2.556)),
        ((x0 - .020, NOTCH_BACK - .006, 1.505), (x0 - .008, -3.455, 2.556)),
        ((x1 + .008, NOTCH_BACK - .006, 1.505), (x1 + .020, -3.455, 2.556)),
    )
    for lo, hi in panels:
        j.block("bedroom_pocket_guard_glass", GLASS, lo, hi)
    for a, b in (
        ((x0 - .014, NOTCH_BACK - .014, 2.561), (x1 + .014, NOTCH_BACK - .014, 2.561)),
        ((x0 - .014, NOTCH_BACK - .014, 2.561), (x0 - .014, -3.440, 2.561)),
        ((x1 + .014, NOTCH_BACK - .014, 2.561), (x1 + .014, -3.440, 2.561)),
    ):
        j.span("bedroom_pocket_guard_cap", BRONZE, a, b, .010)
    result = j.finish()
    for piece, obj in result:
        if piece.endswith("guard_glass"):
            obj["glazing"] = True
            obj["walk"] = "solid"
    return [floor, rear, window], result


def masonry():
    j = Joinery(PREFIX, "exterior")

    def step(piece, x, y, top, support, bevel=.003):
        j.block(piece, STONE, (x[0], y[0], support), (x[1], y[1], top), bevel)

    # The narrow toe fits between the existing pier and timber seat. The
    # first two treads open to an 776mm-deep shared landing with a full turn.
    step("shared_stair", FOOT_X, (-5.170, -4.900), LEVELS[1], -1.023)
    step("shared_stair", FOOT_X, (-4.900, SPLIT_Y[0]), LEVELS[2], -1.023)
    step("shared_landing", (-8.348, -7.442), SPLIT_Y, LEVELS[3], -1.023)
    step("library_landing", (SIDE_TURN, -8.348), SIDE_Y, LEVELS[3], -1.216)
    step("library_stair", (SIDE_TURN - .27, SIDE_TURN), SIDE_Y, LEVELS[4], -1.216)
    step("library_stair", (SIDE_LIP, SIDE_TURN - .27), SIDE_Y, LEVELS[5], -1.216)

    # The final short pool treads sit beneath the relieved glazing edge.
    # Their top riser is 694mm from the protected promenade's centre.
    step("pool_stair", POOL_X, (SPLIT_Y[1], -3.624), LEVELS[4], FLOOR + .001)
    step("pool_stair", POOL_X, (-3.624, POOL_LIP), LEVELS[5], FLOOR + .001)

    # Return the width and finish of both old upper slots at their original
    # floor levels. These walls bear on the bottom of the old cut.
    deck = (-8.374, -7.147)
    step("promenade_return_bearing", deck, (POOL_LIP, -2.131), -.0251, -1.217, .001)
    j.block("promenade_return", PAVING, (deck[0], POOL_LIP, -.025), (deck[1], -2.131, TERRACE), .001)
    step("pool_cheek_return", (deck[0], POOL_X[0] - .002), (-3.793, POOL_LIP), -.0251, -1.217, .002)
    j.block("pool_cheek_return", PAVING, (deck[0], -3.793, -.025), (POOL_X[0] - .002, POOL_LIP, TERRACE), .001)

    library_edge = (-4.619, -3.531)
    step("library_return_bearing", (-10.018, SIDE_LIP), library_edge, -.0221, -1.217, .001)
    j.block("library_return", OAK, (-10.018, library_edge[0], -.022), (SIDE_LIP, library_edge[1], 0.0), .001)
    # Outside the narrowed top flight, the masonry cheeks close the small
    # ledges between the old excavation and the new stone.
    for y in ((library_edge[0], SIDE_Y[0] - .002), (SIDE_Y[1] + .002, library_edge[1])):
        step("library_return_bearing", (SIDE_LIP, -8.589), y, 0.0, -1.217, .001)

    # Rail ends stay within the stair opening so the adjoining dry lanes
    # keep their full clearance. The split remains open inside the landing.
    for x in (POOL_X[0] - .006, POOL_X[1] + .007):
        for y, surface in ((-3.780, LEVELS[4]), (POOL_LIP - .025, LEVELS[5])):
            j.span("pool_newel", BRONZE, (x, y, surface), (x, y, .95), .012)
        j.span("pool_newel", BRONZE, (x, -3.780, .95), (x, POOL_LIP - .025, .95), .017)
        j.span("pool_newel", BRONZE, (x, -3.780, .44), (x, POOL_LIP - .025, .44), .010)
    for y in (SIDE_Y[0] - .008, SIDE_Y[1] + .008):
        for x, surface in ((-8.57, LEVELS[3]), (-8.89, LEVELS[4]), (SIDE_LIP + .025, LEVELS[5])):
            j.span("library_newel", BRONZE, (x, y, surface), (x, y, .99), .012)
        j.span("library_newel", BRONZE, (-8.57, y, .99), (SIDE_LIP + .025, y, .99), .017)
        j.span("library_newel", BRONZE, (-8.57, y, .47), (SIDE_LIP + .025, y, .47), .010)
    return j.finish()


def refit_tea_landings(scene, config):
    """Apply once to the retained version-2 garden, or return its state."""
    version = scene.get("sunkenTeaGarden")
    if version == 3:
        return {"alreadyFitted": True}
    if version != 2:
        raise ValueError("Refit the retained version-2 tea garden")
    replaced = []
    for piece in RETIRED:
        matches = [obj for obj in scene.objects if obj.name.startswith(f"{PREFIX}{piece}__")]
        if len(matches) != 1:
            raise ValueError(f"Expected a single tea garden {piece} object")
        replaced.extend(matches)
    for obj in replaced:
        discard(obj)
    # Trim the inside edge of the fitted stone liner by 35mm. Its cut
    # sandstone backing remains intact and the entrance has a true toe.
    liner = scene.objects["core_tea_garden_west_bearing__warm cut stone"]
    inverse = liner.matrix_world.inverted()
    for vertex in liner.data.vertices:
        world = liner.matrix_world @ vertex.co
        if world.y < -5.039 and world.x > -7.985:
            vertex.co = inverse @ Vector((-8.014, world.y, world.z))
    cuts, opening = refit_window_over_stair(scene)
    building = masonry()
    config["walk"]["places"]["tea-garden"]["position"] = [-7.681, -1.025, 5.36]
    scene["sunkenTeaGarden"] = 3
    bpy.context.view_layer.update()
    return {"sillAndSlab": cuts, "fitted": [obj.name for _, obj in opening + building], "replaced": len(replaced)}
