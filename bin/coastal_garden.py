"""Fitted planters and hanging greenery for the occupied rooms."""

import math
from coastal_craft import potted_plant


def garden(mats, h):
    # These coordinates are in the finished two-storey section, before batching.
    potted_plant("study_botanical", -1.35, -4.8, 4.43, 0.82, mats, h)
    h["box"](
        "study_planter_bracket",
        (-1.35, -5.02, 5.46),
        (0.10, 0.55, 0.08),
        mats["wood"],
        0.02,
    )
    for side in (-1, 1):
        h["tube"](
            "study_planter_cord",
            [(-1.35, -4.8, 5.45), (-1.35 + side * 0.115, -4.8, 4.64)],
            0.008,
            mats["wood"],
        )
    for side in (-1, 1):
        points = []
        for i in range(10):
            z = 4.66 - i * 0.09
            x = -1.35 + side * (0.11 + 0.07 * math.sin(i * 0.7))
            y = -4.72 + 0.055 * math.sin(i * 0.9)
            points.append((x, y, z))
            leaf = h["sphere"](
                "study_botanical_trailing_leaf",
                (x + side * 0.055, y + 0.02, z),
                (0.08, 0.025, 0.055),
                mats["leaf"],
                segments=12,
            )
            leaf.rotation_euler.y = side * 0.5
        h["tube"]("study_botanical_vine", points, 0.009, mats["leaf"])
    potted_plant("lounge_botanical", 4.18, 4.05, 0, 1.7, mats, h)
    potted_plant("kitchen_botanical", -4.25, 3.65, 0, 1.35, mats, h)
