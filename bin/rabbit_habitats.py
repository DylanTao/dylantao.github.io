"""Clifftop brush-rabbit loops along the existing scrub's clear edges.

Coordinates are Blender X/Y. The west loop follows intact mainland outside the
excavated retreat, rotated around its relocated gull perch. Its retained shape
still exercises the rabbit's give-way behavior. Heights must be sampled from the
actual finished support, never this plan alone.
"""

RABBIT_HABITAT_LOOPS = {
    "rabbitWest": [(-13.7, -1.1), (-14.7, -1.2), (-14.9, -1.7), (-13.8, -1.8)],
    # The former eastern loop stood on the retreat's liftaway roof. This same
    # loop translated four metres east stays on visible, permanent sandstone.
    "rabbitEast": [(11.9, -5.3), (13.1, -5.3), (13.3, -5.7), (12.1, -5.7)],
}

# Preserve the eastern route's measured native root clearance when relocating
# it. The contact fit independently places the actual skin and paws; this is
# not a blanket animal lift. See rabbit-fixed-ground-2026-10-31.
RABBIT_ROOT_OFFSETS = {"rabbitEast": 0.027520547485351265}


def sample_loop(points, height, subdivisions=12, root_offset=.025):
    """Closed loop sampled on finished ground with its authored root clearance."""
    result = []
    for a, b in zip(points, points[1:] + points[:1]):
        for i in range(subdivisions):
            t = i / subdivisions
            x, y = a[0] * (1-t) + b[0] * t, a[1] * (1-t) + b[1] * t
            result.append([round(x, 4), round(height(x, y) + root_offset, 4), round(-y, 4)])
    return result
