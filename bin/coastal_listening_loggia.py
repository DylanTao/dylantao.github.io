"""Fit the open fire loggia and sheltered listening seat into the existing bar."""

import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import coastal_decor as decor
from coastal_listening_bar import GLASS, Joinery, architecture
from coastal_listening_joinery import COPPER, WALNUT, contours, map_finish
from coastal_listening_settee import fit_settee
from refresh_coastal_listening_contacts import install, originals_for

PREFIX = "core_speakeasy_loggia_"
STONE = "Loggia · shell limestone"
LAVA = "Loggia · honed black basalt"
LINEN = "Loggia · oatmeal sailcloth"
SLOT = "Loggia · recessed radiator grille"
FIRE = (-9.83, 11.50)


def outline():
    # The inside edge continues the room; the sea corner has a generous
    # radius. Its western third bears on the surveyed rock ledge.
    points = [(-11.94, 10.16), (-8.42, 10.16), (-8.42, 11.59)]
    for i in range(1, 11):
        t = math.pi * 0.5 * i / 10
        points.append((-9.08 + 0.66 * math.cos(t), 11.59 + 0.66 * math.sin(t)))
    points += [(-11.67, 12.25), (-11.94, 12.01)]
    return points


def slab(j):
    points = outline()
    contours(
        j,
        "deck",
        STONE,
        [[(x, y, z) for x, y in points] for z in (-0.208, 0.001)],
        smooth=False,
    )
    deps = bpy.context.evaluated_depsgraph_get()
    # Individual foundations follow the existing rock; the limestone slab
    # cantilevers seaward from these two rows.
    for x, y in ((-11.63, 10.44), (-11.48, 11.34), (-10.88, 10.49)):
        ok, hit, _, _, obj, _ = bpy.context.scene.ray_cast(
            deps, Vector((x, y, -0.215)), Vector((0, 0, -1)), distance=0.23
        )
        if not ok or "sandstone" not in obj.name:
            raise ValueError(f"Loggia bearing misses native cliff at {x,y}")
        j.block(
            "bearings",
            LAVA,
            (x - 0.12, y - 0.11, hit.z + 0.002),
            (x + 0.12, y + 0.11, -0.209),
            0.008,
        )
    # The low-iron wind guard follows the finished deck perimeter. Its cap
    # crosses below a standing person's ocean horizon.
    for a, b in zip(points[1:], points[2:] + points[:1]):
        p, q = Vector(a), Vector(b)
        delta = q - p
        gap = delta.normalized() * 0.009
        p += gap
        q -= gap
        bm = j.mesh("wind_guard", GLASS)
        bm.faces.new(
            [
                bm.verts.new(v)
                for v in ((*p, 0.056), (*q, 0.056), (*q, 0.927), (*p, 0.927))
            ]
        )
        j.span("guard_cap", COPPER, (*p, 0.936), (*q, 0.936), 0.011, 10)
    for x, y in (points[1], points[2], points[-3], points[-1], points[0]):
        j.span("guard_stanchions", COPPER, (x, y, 0.007), (x, y, 0.935), 0.014, 10)


def shelter(j):
    # Split-sawn fins fan over the listener. Each has its own changing bevel
    # and section as it meets the sound-absorbing pads above the seat.
    for i in range(11):
        f = i / 10
        path = []
        for k in range(11):
            t = k / 10
            x = -10.42 + 1.68 * t
            y = (7.75 + 0.48 * f) * (1 - t) + (7.47 + 2.21 * f) * t
            z = 2.347 + 0.116 * math.sin(t * math.pi) - 0.152 * t
            w = 0.012 + 0.018 * t
            path.append(
                [
                    (x, y - w, z),
                    (x, y + w, z + 0.003),
                    (x, y + w, z + 0.046),
                    (x, y - w, z + 0.046),
                ]
            )
        contours(j, "ceiling_fan", WALNUT, path, smooth=False)
    for x in (-11.512, -10.265):
        j.block(
            "door_lining", WALNUT, (x, 9.913, 0.005), (x + 0.022, 10.170, 2.141), 0.004
        )
    j.block(
        "door_lining", WALNUT, (-11.49, 9.913, 2.114), (-10.266, 10.167, 2.143), 0.005
    )


def seat(j):
    cx, cy = -9.58, 11.12

    def arc(section, n=27):
        return [
            [(cx + r * math.cos(a), cy + r * math.sin(a), z) for r, z in section]
            for a in [math.radians(-37 + i * 139 / (n - 1)) for i in range(n)]
        ]

    contours(
        j,
        "bench_base",
        STONE,
        arc([(0.912, 0.005), (1.095, 0.005), (1.095, 0.370), (0.912, 0.370)]),
        smooth=True,
    )
    contours(
        j,
        "bench_seat",
        LINEN,
        arc(
            [
                (0.645, 0.351),
                (1.077, 0.374),
                (1.078, 0.423),
                (0.684, 0.444),
                (0.635, 0.422),
            ]
        ),
        smooth=True,
    )
    contours(
        j,
        "bench_back",
        STONE,
        arc(
            [
                (1.033, 0.432),
                (1.100, 0.432),
                (1.103, 0.821),
                (1.05, 0.829),
                (0.971, 0.735),
            ]
        ),
        smooth=True,
    )
    # A dark return below the upholstered seat hides the radiant strip. Light
    # catches the bronze fins inside the slot when seen from the outer door.
    contours(
        j,
        "heat_recess",
        SLOT,
        arc([(0.902, 0.208), (0.909, 0.208), (0.909, 0.295), (0.902, 0.295)]),
        smooth=True,
    )
    for i in range(47):
        a = math.radians(-35 + i * 135 / 46)

        def p(r, z):
            return (cx + r * math.cos(a), cy + r * math.sin(a), z)

        j.span("heat_fins", COPPER, p(0.890, 0.212), p(0.896, 0.288), 0.004, 5)


def brazier(j):
    x, y = FIRE

    def oval(r, z):
        return [
            (
                x + 0.601 * r * math.cos(i * math.tau / 64),
                y + 0.372 * r * math.sin(i * math.tau / 64),
                z,
            )
            for i in range(64)
        ]

    contours(
        j,
        "fire_plinth",
        LAVA,
        [
            oval(r, z)
            for r, z in ((0.76, 0.004), (0.82, 0.038), (0.89, 0.258), (0.94, 0.284))
        ],
    )
    # Both sides of the bronze lip and the dark interior are visible from
    # a seat. Its floor receives the actual billets and the rising flame.
    contours(
        j,
        "fire_rim",
        COPPER,
        [
            oval(r, z)
            for r, z in (
                (0.938, 0.286),
                (1, 0.298),
                (1, 0.334),
                (0.973, 0.344),
                (0.660, 0.335),
                (0.642, 0.308),
            )
        ],
        caps=False,
    )
    contours(
        j,
        "fire_bed",
        LAVA,
        [
            oval(r, z)
            for r, z in (
                (0.64, 0.307),
                (0.615, 0.278),
                (0.49, 0.238),
                (0.27, 0.211),
                (0.006, 0.208),
            )
        ],
        caps=False,
    )


def build():
    scene = bpy.context.scene
    wall_prefix = "core_speakeasy_"
    changed = {"walls", "window_seat", "window_liner", "panorama"}
    prior = originals_for(wall_prefix, changed)
    replacement = Joinery(wall_prefix, "speakeasy")
    architecture(replacement)
    install(prior, replacement.finish(changed), wall_prefix)
    for ob in tuple(scene.objects):
        if ob.name.startswith(PREFIX):
            bpy.data.objects.remove(ob, do_unlink=True)
    for name, colour, rough, metal in (
        (STONE, (0.50, 0.425, 0.337), 0.81, 0),
        (LAVA, (0.136, 0.119, 0.108), 0.76, 0),
        (LINEN, (0.67, 0.569, 0.43), 0.96, 0),
        (SLOT, (0.134, 0.072, 0.037), 0.55, 0.17),
    ):
        decor.material(name, colour, rough, metal)
    j = Joinery(PREFIX, "speakeasy")
    slab(j)
    shelter(j)
    seat(j)
    brazier(j)
    for part, ob in j.finish():
        map_finish(ob)
        if part == "fire_bed":
            ob["terraceFireWorld"] = [FIRE[0], 0.214, -FIRE[1]]
        if part in ("heat_recess", "heat_fins"):
            ob["radiantSeat"] = True
        if part in ("heat_fins", "guard_cap", "ceiling_fan"):
            ob["walk"] = "through"
    fit_settee(scene)
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    for x, y in (
        (-10.87, 10.02),
        (-10.87, 10.48),
        (-10.74, 11.19),
        (-10.64, 11.69),
        (-10.64, 12.02),
    ):
        ok, ground, _, _, owner, _ = scene.ray_cast(
            deps, Vector((x, y, 1.60)), Vector((0, 0, -1)), distance=1.7
        )
        if not ok or abs(ground.z - 0.001) > 0.015:
            raise ValueError(f"Walking line to the terrace blocked at {x,y} by {owner}")
    for x in (-11.19, -10.87, -10.55):
        for z in (0.34, 1.61, 1.95):
            hit, *_ = scene.ray_cast(
                deps, Vector((x, 9.73, z)), Vector((0, 1, 0)), distance=0.65
            )
            if hit:
                raise ValueError(f"Loggia threshold blocked at {x,z}")


if __name__ == "__main__":
    build()
    dest = Path(
        next(a.split("=", 1)[1] for a in sys.argv if a.startswith("--save-as="))
    )
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()), compress=True)
