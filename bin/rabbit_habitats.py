"""Clifftop brush-rabbit loops along the existing scrub's clear edges.

Coordinates are Blender X/Y. The dense original loops ran through sage crowns;
these nearby loops were checked against the retained planted coast. Heights must
still be sampled from the actual finished support, never this plan alone.
"""

RABBIT_HABITAT_LOOPS = {
    "rabbitWest": [(-7.9, -.9), (-6.9, -.8), (-6.7, -.3), (-7.8, -.2)],
    "rabbitEast": [(7.9, -5.3), (9.1, -5.3), (9.3, -5.7), (8.1, -5.7)],
}


def sample_loop(points, height, subdivisions=12):
    """Closed loop with the same 25 mm root support offset as the other fauna."""
    result = []
    for a, b in zip(points, points[1:] + points[:1]):
        for i in range(subdivisions):
            t = i / subdivisions
            x, y = a[0] * (1-t) + b[0] * t, a[1] * (1-t) + b[1] * t
            result.append([round(x, 4), round(height(x, y) + .025, 4), round(-y, 4)])
    return result
