"""Refine the embedded lift's landings, enclosure and adjoining gym threshold.

Run in Blender 4.5 against the embedded lift and open workout-garden master.
All coordinates are native Blender metres. The new surfaces fit inside the
existing excavations and preserve the door travel and the uninterrupted low-iron glazing.
"""

import argparse
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from coastal_cliff_lift import BEACH, CX, CY, TOP, X0, X1, Y0, Y1
from coastal_listening_bar import CEILING, LAMP, Joinery
from coastal_listening_joinery import COPPER, WALNUT, contours, map_finish
from coastal_section_canopy import attach_estate_garden


PREFIX = "core_passage_finish_"
STONE = "golden coastal sandstone"
BRONZE = "ocean lift dry bronze"
PAVING = "honed travertine"


def arch(join, part, sections, *, inside, finish=STONE):
    """Skin a barrel vault with its springing and outer bearing in the rock."""
    rings = []
    for origin, across, width, spring, rise, wall in sections:
        half = width / 2
        angles = [math.pi * n / 20 for n in range(21)]
        inner = [(half * math.cos(a), spring + rise * math.sin(a)) for a in angles]
        outer = [
            ((half + wall) * math.cos(a), spring + (rise + wall) * math.sin(a))
            for a in reversed(angles)
        ]
        positions = [origin + across * x + Vector((0, 0, height)) for x, height in (*inner, *outer)]
        rings.append(positions)
    bm = join.mesh(part, finish)
    contours(join, part, finish, rings, smooth=False)
    profile_length = len(rings[0])
    for i, face in enumerate(bm.faces):
        edge = i % profile_length
        face.smooth = (not inside or edge < 20) and len(face.verts) == 4


def wall_wash(join, y0, y1):
    """The brass hood shields a narrow strip aimed across the vaulted ceiling."""
    for side in (-1, 1):
        x = CX + side * 0.619
        join.span("wash_recess", BRONZE, (x, y0, -4.635), (x, y1, -4.635), 0.025, 8)
        x -= side * 0.012
        join.span("wash", LAMP, (x, y0 + 0.02, -4.620), (x, y1 - 0.02, -4.620), 0.009, 8)


def lower_gallery(join):
    # The buried vault opens toward the turn. Its rise stays above all six
    # authored eye rays, including the lowest cab's horizontal ocean view.
    across = Vector((1, 0, 0))
    arch(
        join, "lower_vault",
        [
            (Vector((CX, y, 0)), across, width, spring, rise, 0.15)
            for y, width, spring, rise in (
                (10.39, 1.255, -4.60, 0.37),
                (10.52, 1.265, -4.60, 0.37),
                (11.25, 1.27, -4.59, 0.38),
                (11.90, 1.28, -4.58, 0.39),
                (12.30, 1.34, -4.57, 0.40),
            )
        ],
        inside=True,
    )
    wall_wash(join, 10.57, 12.11)

    # A quieter return of the same stone at the ocean door. The recessed inner
    # crown stays beyond the level lower-landing pad and clears the two steps.
    across = Vector((0, 1, 0))
    arch(
        join, "shore_portal",
        [
            (Vector((x, 12.96, 0)), across, width, spring, rise, wall)
            for x, width, spring, rise, wall in (
                (-12.18, 1.205, -4.67, 0.43, 0.145),
                (-11.82, 1.23, -4.68, 0.46, 0.15),
                (-11.43, 1.255, -4.70, 0.51, 0.165),
                (-11.32, 1.27, -4.70, 0.52, 0.17),
                (-11.27, 1.28, -4.70, 0.525, 0.165),
            )
        ],
        inside=True,
    )
    # Jambs and crown are one assembly as seen from the beach; the wide outer
    # checks touch both cut faces, leaving the original dry walking line intact.
    for side in (-1, 1):
        y0, y1 = sorted((12.96 + side * 0.623, 12.96 + side * 0.785))
        join.block("shore_portal", STONE, (-11.94, y0, -6.77), (-11.27, y1, -4.687), 0.028)


def car_ceiling(join):
    # A rounded timber soffit makes the glass read as a room. Its central panel
    # has over 2.07 m of head clearance and is entirely behind the view opening.
    join.block("cab_soffit", WALNUT, (X0 + 0.103, Y0 + 0.109, TOP + 2.092),
               (X1 - 0.102, Y1 - 0.105, TOP + 2.135), 0.021)
    join.block("cab_insert", CEILING, (X0 + 0.239, Y0 + 0.23, TOP + 2.075),
               (X1 - 0.228, Y1 - 0.254, TOP + 2.105), 0.024)
    for x in (X0 + 0.178, X1 - 0.173):
        join.block("cab_strip", LAMP, (x, Y0 + 0.262, TOP + 2.084),
                   (x + 0.015, Y1 - 0.236, TOP + 2.093), 0.003)
    # The side studs at the glass ends carry the edge of the lining. There is
    # no intermediate mullion between the visitor and the ocean.
    for x in (X0 + 0.098, X1 - 0.099):
        join.span("cab_rounded_stile", COPPER, (x, Y1 - 0.104, TOP + 0.047),
                  (x, Y1 - 0.104, TOP + 2.114), 0.014, 12)


def gym_sill(join):
    a = Vector((6, -5.2, 0))
    b = Vector((11, -1.50, 0))
    along = (b - a).normalized()
    outward = Vector((-along.y, along.x, 0))
    # The lip rises to the existing indoor floor and returns to the new patio.
    # The double dark tracks sit flush in the three bands of honed limestone.
    offsets = (-0.152, -0.053, -0.039, 0.039, 0.053, 0.147)
    levels = (0.031, 0.032, 0.032, 0.030, 0.030, 0.018)
    for i, (start, end) in enumerate(zip(offsets, offsets[1:])):
        outline = [(start, levels[i]), (end, levels[i + 1]), (end, -0.06), (start, -0.06)]
        profiles = [
            [origin + outward * d + Vector((0, 0, h)) for d, h in outline]
            for origin in (a + along * 0.35, b - along * 0.08)
        ]
        contours(join, "gym_sill", BRONZE if i in (1, 3) else PAVING, profiles, smooth=False)


def finish(join):
    objects = []
    for mesh in join.meshes.values():
        bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
    for piece, obj in join.finish():
        map_finish(obj)
        if piece.startswith("cab_"):
            obj["cliffLiftPart"] = "cab"
            obj["dynamic"] = True
            obj["walk"] = "through"
        if piece in ("wash", "cab_strip"):
            obj["installationGlow"] = "cliff-lift-line"
        objects.append(obj)
    return objects


def build(scene):
    if not scene.get("embeddedLiftNativeExcavation"):
        raise ValueError("Open the native house with the embedded cliff lift")
    for name in ("core_workout_garden_threshold__honed travertine", "core_gym_front_frame"):
        if name not in scene.objects:
            raise ValueError("Missing native workout-garden member " + name)
    for obj in list(scene.objects):
        if obj.name.startswith(PREFIX):
            bpy.data.objects.remove(obj, do_unlink=True)
    lift = Joinery(PREFIX, "cliff-lift")
    lower_gallery(lift)
    car_ceiling(lift)
    gym = Joinery(PREFIX, "gym")
    gym_sill(gym)
    objects = [*finish(lift), *finish(gym)]
    for record in attach_estate_garden(scene):
        print(record)
    bpy.context.view_layer.update()
    return objects


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    if args.output.resolve() == Path(bpy.data.filepath).resolve():
        parser.error("Use a distinct output file")
    build(bpy.context.scene)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()), compress=True)


if __name__ == "__main__":
    main()
