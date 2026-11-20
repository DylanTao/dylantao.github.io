"""Cab, gates and fittings for the passenger lift inside the sandstone.

The upper gate opens east straight into the listening room. At the lower
stop, the north gate opens onto a level rock gallery and the dry beach.
The surrounding excavation and gallery are authored in the native cliff.
"""

import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from coastal_listening_bar import BRASS, GLASS, LAMP, STEEL, Joinery, finishes
from coastal_listening_joinery import COPPER, WALNUT, map_finish

PREFIX = "core_cliff_lift_"
X0, X1 = -14.35, -12.67
Y0, Y1 = 8.34, 10.30
CX, CY = (X0 + X1) / 2, (Y0 + Y1) / 2
TOP, BEACH = 0.001, -6.45


def structure(j):
    # The rock carries the car guides on their brackets. Everything in this
    # assembly stays inside the excavated cross-section.
    for y in (Y0 + 0.12, Y1 - 0.13):
        j.block("rail", STEEL, (X0 + 0.011, y - 0.026, BEACH - 0.16), (X0 + 0.042, y + 0.026, TOP + 2.285), 0.003)
        for z in (BEACH - 0.10, -4.67, -2.93, -1.18, 0.63, 2.18):
            j.block("rail_bracket", COPPER, (X0 - 0.016, y - 0.045, z), (X0 + 0.048, y + 0.045, z + 0.038), 0.003)
    j.block(
        "recessed_guide", COPPER, (X0 + 0.048, Y1 - 0.121, BEACH + 0.048), (X0 + 0.068, Y1 - 0.095, TOP + 2.195), 0.003
    )
    j.block("line", LAMP, (X0 + 0.063, Y1 - 0.095, BEACH + 0.061), (X0 + 0.067, Y1 - 0.091, TOP + 2.179))
    # Three to four metres separate the cab and face of the cliff. A bronze
    # reveal rests in the sheltered east edge of the slit. The sea sees the
    # lit section through the rock at all three surveyed rider eye heights.
    j.block("ocean_reveal", COPPER, (-13.279, 12.73, -4.10), (-13.242, 12.935, 1.85), 0.004)
    j.block("reveal_lamp", LAMP, (-13.287, 12.923, -4.07), (-13.265, 12.942, 1.80), 0.003)
    # A low light follows the gallery around the turn, under a projecting
    # bronze lip. All metal stays above the two stone steps and outside Walk.
    j.block("gallery_reveal", COPPER, (-12.78, 12.302, -6.13), (-11.66, 12.342, -6.076), 0.004)
    j.block("gallery_lamp", LAMP, (-12.76, 12.335, -6.13), (-11.684, 12.347, -6.110), 0.002)
    j.block("gallery_reveal", COPPER, (-11.88, 12.32, -4.190), (-11.83, 13.59, -4.133), 0.004)
    j.block("gallery_lamp", LAMP, (-11.855, 12.35, -4.201), (-11.839, 13.55, -4.183), 0.002)
    for plane, floor, side in ((X1, TOP, "east"), (Y1, BEACH, "north")):
        gate_box(
            j,
            "stone_door_head",
            COPPER,
            side,
            plane - 0.019,
            plane + 0.018,
            -0.625,
            0.625,
            floor + 2.094,
            floor + 2.141,
        )
        for sign in (-1, 1):
            a, b = sorted((sign * 0.599, sign * 0.624))
            gate_box(
                j, "stone_door_jamb", COPPER, side, plane - 0.017, plane + 0.016, a, b, floor + 0.005, floor + 2.109
            )
    j.block("pit_floor", STEEL, (X0 + 0.02, Y0 + 0.02, BEACH - 0.218), (X1 - 0.02, Y1 - 0.02, BEACH - 0.191), 0.005)


def gate_box(j, piece, finish, side, depth0, depth1, a, b, low, high):
    if side == "east":
        j.block(piece, finish, (depth0, CY + a, low), (depth1, CY + b, high))
    else:
        j.block(piece, finish, (CX + a, depth0, low), (CX + b, depth1, high))


def doors(j, kind, side, plane, floor):
    for name, sign in (("left", -1), ("right", 1)):
        for leaf, (a, b) in enumerate(((0.006, 0.276), (0.276, 0.545))):
            piece = f"{kind}_{name}_{leaf}"
            lo, hi = sorted((sign * a, sign * b))
            depth = plane + (0.008 if leaf else -0.008)
            gate_box(j, piece, GLASS, side, depth - 0.004, depth + 0.004, lo, hi, floor + 0.054, floor + 2.030)
            for edge in (lo, hi):
                gate_box(
                    j,
                    piece,
                    COPPER,
                    side,
                    depth - 0.006,
                    depth + 0.006,
                    edge - 0.004,
                    edge + 0.004,
                    floor + 0.045,
                    floor + 2.041,
                )
            gate_box(j, piece, COPPER, side, depth - 0.006, depth + 0.006, lo, hi, floor + 2.019, floor + 2.042)
    half = (Y1 - Y0) / 2 if side == "east" else (X1 - X0) / 2
    half -= 0.088 if kind.startswith("cab") else 0.017
    for a, b in ((-half, -0.56), (0.56, half)):
        gate_box(
            j,
            "cab" if kind.startswith("cab") else "jambs",
            GLASS,
            side,
            plane - 0.025,
            plane - 0.018,
            a,
            b,
            floor + 0.062,
            floor + 2.075,
        )


def car(j):
    x0, x1, y0, y1 = X0 + 0.076, X1 - 0.076, Y0 + 0.079, Y1 - 0.079
    j.block("cab", COPPER, (x0, y0, TOP - 0.080), (x1, y1, TOP - 0.022), 0.009)
    j.block("cab", WALNUT, (x0 + 0.004, y0 + 0.004, TOP - 0.022), (x1 - 0.004, y1 - 0.004, TOP), 0.003)
    j.block("cab", GLASS, (x0 - 0.005, y0 + 0.015, TOP + 0.036), (x0 + 0.005, y1 - 0.016, TOP + 2.109))
    for y_a, y_b in ((y0 + 0.030, CY - 0.010), (CY + 0.010, y1 - 0.030)):
        j.block("cab", COPPER, (x0 + 0.006, y_a, TOP + 0.065), (x0 + 0.027, y_b, TOP + 2.086), 0.008)
    j.block("cab_lamp", LAMP, (x0 + 0.030, y0 + 0.058, TOP + 2.038), (x0 + 0.043, y1 - 0.058, TOP + 2.053), 0.003)
    j.block("cab", GLASS, (x0 + 0.014, y0 - 0.004, TOP + 0.036), (x1 - 0.014, y0 + 0.004, TOP + 2.109))
    for x in (x0, x1):
        for y in (y0, y1):
            j.span("cab", COPPER, (x, y, TOP), (x, y, TOP + 2.140), 0.011, 12)
    j.span("cab", BRASS, (x0 + 0.045, y0 + 0.081, TOP + 0.921), (x0 + 0.045, y1 - 0.083, TOP + 0.921), 0.012, 12)
    j.span("cab", BRASS, (x0 + 0.083, y0 + 0.045, TOP + 0.921), (x1 - 0.083, y0 + 0.045, TOP + 0.921), 0.012, 12)
    j.block("cab", WALNUT, (x0 - 0.003, y0 - 0.003, TOP + 2.129), (x1 + 0.003, y1 + 0.003, TOP + 2.184), 0.009)
    for x in (x0 + 0.112, x1 - 0.129):
        j.block("cab_lamp", LAMP, (x, y0 + 0.14, TOP + 2.117), (x + 0.017, y1 - 0.14, TOP + 2.126), 0.002)
    doors(j, "cabDoorTop", "east", x1 - 0.003, TOP)
    doors(j, "cabDoorBeach", "north", y1 - 0.003, TOP)
    doors(j, "topGate", "east", X1 + 0.012, TOP)
    doors(j, "beachGate", "north", Y1 + 0.012, BEACH)


def build():
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(PREFIX):
            bpy.data.objects.remove(obj, do_unlink=True)
    finishes()
    j = Joinery(PREFIX, "cliff-lift")
    structure(j)
    car(j)
    for piece, obj in j.finish():
        map_finish(obj)
        if piece in ("line", "cab_lamp", "reveal_lamp", "gallery_lamp"):
            obj["installationGlow"] = "cliff-lift-line"
        if piece in ("cab", "cab_lamp"):
            obj["cliffLiftPart"] = "cab"
        elif piece.startswith(("cabDoor", "topGate", "beachGate")):
            kind, side, leaf = piece.split("_")
            obj["cliffLiftPart"] = kind
            # A native +Y slide is a web -Z slide on the upper, east-facing gate.
            direction = (-1 if side == "left" else 1) * (-1 if kind in ("cabDoorTop", "topGate") else 1)
            obj["cliffLiftSlide"] = direction * (0.54 if leaf == "0" else 0.27)
        if obj.get("cliffLiftPart"):
            obj["dynamic"] = True
            obj["walk"] = "through"
    bpy.context.view_layer.update()


if __name__ == "__main__":
    build()
    dest = next(a.split("=", 1)[1] for a in sys.argv if a.startswith("--save-as="))
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(dest).resolve()), compress=True)
