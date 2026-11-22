"""An inhabited second storey above the listening vault and a stair beside it.

Coordinates are native metres. Both landings connect directly to real paving.
Four material batches carry the stair, floor and guard into the walk field.
"""

import math

from coastal_listening_bar import Joinery
from coastal_office import l_slab
from coastal_arrival_hall import _cut, _remove_islands
from coastal_supper_approach import fit_supper_approach

OAK = "pale oak"
WALNUT = "listening room quarter-cut walnut"
STONE = "Loggia · shell limestone"
BRONZE = "dark bronze"
LINEN = "Loggia · oatmeal sailcloth"
HIDE = "bar saddle leather"
LEVEL = 3.062
START = 5.34
STEPS = 18
GOING = 0.28
WEST, EAST = -8.34, -7.12
END = START + STEPS * GOING


def guard(j, a, b, foot, finish=BRONZE):
    length = math.dist(a, b)
    count = math.ceil(length / 0.78)
    for i in range(count + 1):
        u = i / count
        x = a[0] + (b[0] - a[0]) * u
        y = a[1] + (b[1] - a[1]) * u
        j.span("bronze", finish, (x, y, foot), (x, y, foot + 0.99), 0.014, 8)
    j.span("handrail", WALNUT, (*a, foot + 0.997), (*b, foot + 0.997), 0.025, 12)
    # The fine guard infill stops below a seated guest's horizon.
    for h in (0.28, 0.52, 0.76):
        j.span("bronze", finish, (*a, foot + h), (*b, foot + h), 0.005, 5)


def upstairs(j):
    # The high table shares a walnut banquette along the inland wall. Its
    # curved corners leave room to pass between the bench and the ocean rail.
    j.block("bearing", STONE, (-12.36, 6.36, 0.01), (-12.18, 6.56, 2.97), 0.009)
    j.block("bearing", STONE, (-8.58, 6.36, 0.01), (-8.41, 6.56, 2.97), 0.009)
    outline = [
        (-12.37, 6.34),
        (-8.34, 6.34),
        (-8.34, END),
        (-7.12, END),
        (-7.12, 11.34),
        (-8.31, 11.34),
        (-8.58, 11.14),
        (-12.10, 11.14),
        (-12.37, 10.88),
    ]
    l_slab(j.mesh("deck", STONE), outline, 2.951, LEVEL, 0.018)
    # A separate oak soffit and floor joints give the gallery a thin shadow line.
    for x in (-11.70, -10.91, -10.12, -9.33, -8.54):
        j.block(
            "joints",
            BRONZE,
            (x, 6.36, LEVEL + 0.0005),
            (x + 0.007, 10.99, LEVEL + 0.0018),
        )
    for a, b in [
        ((-12.32, 6.40), (-8.41, 6.40)),
        ((-8.38, 6.43), (-8.38, END - 0.08)),
        ((-7.16, END), (-7.16, 11.25)),
        ((-7.20, 11.28), (-8.28, 11.28)),
        ((-8.28, 11.28), (-8.59, 11.09)),
        ((-8.59, 11.09), (-12.06, 11.09)),
        ((-12.06, 11.09), (-12.31, 10.84)),
        ((-12.31, 10.84), (-12.31, 6.4)),
    ]:
        guard(j, a, b, LEVEL)
    # A timber canopy on its own posts shelters the inland end. The exposed
    # deck stays open to the sky reflected from the Pacific.
    for x in (-12.23, -8.56):
        for y in (6.48, 8.30):
            j.block(
                "posts",
                WALNUT,
                (x - 0.045, y - 0.048, LEVEL),
                (x + 0.045, y + 0.048, 5.44),
                0.006,
            )
        j.block(
            "beams", WALNUT, (x - 0.054, 6.37, 5.37), (x + 0.054, 8.42, 5.49), 0.008
        )
    for i in range(15):
        y = 6.38 + i * 0.142
        j.block(
            "ceiling_slats", OAK, (-12.29, y, 5.46), (-8.49, y + 0.098, 5.535), 0.003
        )
    # Reeded back panel and the low ledge are set against the protected West side.
    j.block("back", WALNUT, (-12.25, 6.62, LEVEL), (-12.12, 9.06, 4.11), 0.025)
    for i in range(20):
        y = 6.67 + i * 0.120
        j.block("reeds", OAK, (-12.118, y, 3.18), (-12.10, y + 0.023, 3.72), 0.006)
    j.block("bench", WALNUT, (-12.115, 6.70, LEVEL), (-11.48, 9.0, 3.44), 0.04)
    for i in range(3):
        y = 6.71 + i * 0.76
        j.block("seat", HIDE, (-12.095, y, 3.434), (-11.47, y + 0.744, 3.536), 0.038)
        j.block("bolster", HIDE, (-12.099, y, 3.51), (-11.96, y + 0.745, 3.91), 0.048)
    # Two round tables make room for the 1.18 m through aisle at the entry.
    for y in (7.30, 8.43):
        for piece, material, base, profile in [
            (
                "feet",
                BRONZE,
                LEVEL,
                [(0.25, 0), (0.25, 0.022), (0.11, 0.044), (0.045, 0.08), (0.04, 0.68)],
            ),
            (
                "table",
                WALNUT,
                LEVEL + 0.68,
                [(0.37, 0), (0.405, 0.018), (0.401, 0.042), (0.375, 0.051)],
            ),
        ]:
            j.turned(piece, material, (-11.09, y, base), profile, 28)
        j.turned(
            "stools",
            WALNUT,
            (-10.43, y - 0.025, LEVEL),
            [(0.16, 0.0), (0.145, 0.03), (0.094, 0.34), (0.17, 0.379)],
            20,
        )
        j.turned(
            "seat",
            HIDE,
            (-10.43, y - 0.025, LEVEL + 0.379),
            [(0.17, 0), (0.191, 0.034), (0.18, 0.082)],
            24,
        )
        j.turned(
            "lamps",
            BRONZE,
            (-11.0, y + 0.11, LEVEL + 0.731),
            [(0.055, 0), (0.052, 0.02), (0.013, 0.031), (0.012, 0.158)],
            16,
        )
        j.turned(
            "shades",
            "estate warm opal diffuser",
            (-11.0, y + 0.11, LEVEL + 0.883),
            [(0.070, 0), (0.067, 0.040), (0.030, 0.061)],
            18,
        )
    # Cabinet to set down a record or a drink with a framed upper sea opening.
    j.block("shelf", WALNUT, (-9.68, 6.48, 3.07), (-8.80, 6.82, 3.88), 0.018)
    j.block(
        "counter",
        "bar green limestone",
        (-9.70, 6.47, 3.87),
        (-8.77, 6.85, 3.921),
        0.01,
    )
    j.block("lintel", WALNUT, (-12.27, 8.263, 5.32), (-8.51, 8.345, 5.452), 0.006)


def build_supper_gallery(scene, config):
    fit_supper_approach(scene)
    j = Joinery("core_listening_gallery_", "speakeasy")
    # Stone stringers start at the edge of the existing BBQ paving and finish
    # on the upper deck; every riser is below the guest's walk step height.
    j.block("landing", STONE, (-8.60, 4.39, -0.245), (EAST, START, 0.001), 0.007)
    for i in range(STEPS):
        y = START + i * GOING
        h = (i + 1) * LEVEL / STEPS
        j.block("flight", STONE, (WEST, y, h - 0.205), (EAST, y + GOING, h - 0.018))
        j.block(
            "treads",
            OAK,
            (WEST - 0.008, y - 0.008, h - 0.019),
            (EAST + 0.008, y + GOING - 0.004, h),
            0.004,
        )
    for x in (WEST + 0.036, EAST - 0.036):
        j.span(
            "stringers",
            WALNUT,
            (x, START + 0.02, -0.075),
            (x, END + 0.018, LEVEL - 0.075),
            0.082,
            10,
        )
        j.span(
            "handrail",
            WALNUT,
            (x, START - 0.18, 0.91),
            (x, END + 0.045, LEVEL + 0.99),
            0.027,
            12,
        )
        for i in [0, 3, 6, 9, 12, 15, 17]:
            y = START + (i + 0.5) * GOING
            h = (i + 1) * LEVEL / STEPS
            j.span(
                "bronze",
                BRONZE,
                (x, y, h + 0.002),
                (
                    x,
                    y,
                    0.91 + (y - START + 0.18) * (LEVEL + 0.08) / (END - START + 0.225),
                ),
                0.014,
                8,
            )
    upstairs(j)
    for piece, obj in j.finish():
        if piece == "shades":
            obj["installationGlow"] = "outdoor-portal"
        if piece in ("joints", "shades", "lamps"):
            obj["walk"] = "through"
    config["walk"]["places"]["supper-gallery"] = {
        "label": "Supper gallery",
        "room": "study",
        "position": [-9.09, LEVEL, -10.38],
        "yaw": -0.68,
        "pitch": -0.10,
        "fov": 68,
        "bounds": {"min": [-12.44, 2.96, -11.4], "max": [-7.08, 4.96, -6.30]},
    }
    # Upper dining shares the listening room's receiver. Its earlier bounds
    # ended below this floor and would discard the new bench light at startup.
    config["installationReceivers"]["groups"]["speakeasy"]["max"][1] = 5.56
    config["installationLines"].append(
        {
            "id": "supper-bench",
            "schedule": "steps",
            "a": [-12.07, 3.96, -6.78],
            "b": [-12.07, 3.96, -8.95],
            "intensity": 0.57,
            "color": [1, 0.73, 0.49],
            "emitterRadius": 0.04,
            "transport": False,
            "region": {"min": [-12.3, 3.07, -9.32], "max": [-10.1, 4.3, -6.33]},
        }
    )
    return {"height": LEVEL, "risers": STEPS, "going": GOING, "stairWidth": EAST - WEST}


def study_window(scene):
    # Keep the joinery beneath the sightline for privacy. The original full-
    # height set of ten battens across the opening obstructed the view from a chair.
    screen = next(
        o
        for o in scene.objects
        if o.name.startswith("core_speakeasy_study_pocket_screen__")
    )
    removed = _remove_islands(screen, lambda lo, hi: lo.z > 0.90)
    if removed != 10:
        raise ValueError(f"Expected the ten high screen battens, found {removed}")
    j = Joinery("core_study_window_", "speakeasy")
    j.block("jamb", WALNUT, (-11.927, 1.333, 0.91), (-11.896, 1.418, 2.35), 0.004)
    j.block("jamb", WALNUT, (-10.965, 1.333, 0.91), (-10.934, 1.418, 2.35), 0.004)
    j.block("head", WALNUT, (-11.896, 1.333, 2.296), (-10.965, 1.418, 2.35), 0.004)
    j.block("sill", OAK, (-11.925, 1.315, 0.905), (-10.932, 1.449, 0.937), 0.006)
    j.finish()

    # Give the seated reader a second, wider view through the actual swinging
    # bookcase. Keep books below the sill, above the head and on either side.
    left, right, bottom, top = -11.16, -10.22, 1.075, 1.756
    parts = [
        o for o in scene.objects if o.name.startswith("core_speakeasy_study_pivot_")
    ]
    for obj in parts:
        if "pivot_books" in obj.name:
            _remove_islands(
                obj,
                lambda lo, hi: lo.x < right
                and hi.x > left
                and lo.z < top
                and hi.z > bottom,
            )
        elif "pivot_back" in obj.name or "pivot_shelves" in obj.name:
            _cut(
                scene,
                "Study shelf aperture",
                left,
                right,
                0.71,
                1.03,
                bottom,
                top,
                obj.data.materials[0],
                [obj],
            )
    frame = Joinery("core_study_window_pivot_", "speakeasy")
    for x in (left, right - 0.025):
        frame.block(
            "frame", WALNUT, (x, -0.967, bottom), (x + 0.025, -0.768, top), 0.004
        )
    frame.block(
        "frame", WALNUT, (left, -0.964, top - 0.03), (right, -0.768, top), 0.004
    )
    frame.block(
        "sill", OAK, (left, -0.984, bottom), (right, -0.758, bottom + 0.032), 0.005
    )
    for _, obj in frame.finish():
        obj["estateDoor"] = "study-bookcase"
