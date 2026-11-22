"""Give the installed glass entrance enough clearance on the actual stair."""

import bmesh
from mathutils import Vector

from coastal_shell import _islands


PREFIX = "core_entry_leaf_"
MARKER = "entryLeafHeadroom"
CENTRES = (-31.80, -30.50, -29.20, -27.90)
RAISE = (0.10, 0.36, 0.71, 0.48)


def components(obj):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(obj.data)
        return [[v.index for v in part] for part in _islands(mesh)]
    finally:
        mesh.free()


def member(scene, piece):
    matches = [
        obj for obj in scene.objects
        if obj.type == "MESH" and obj.name.startswith(f"{PREFIX}{piece}__")
    ]
    if len(matches) != 1:
        raise ValueError(f"The native rain canopy needs one {piece} batch")
    return matches[0]


def glass_elevation(point, centre):
    x = (point.x + 0.115) / 1.69
    y = (point.y - centre) / 0.92
    return 10.55 - (centre + 31.6) * 0.37 + 0.17 * x + 0.095 * (1 - x * x - y * y)


def fit_entry_headroom(scene):
    if scene.get(MARKER):
        return []
    finished = []
    for piece, expected in (("laminated_glass", 4), ("rims", 136), ("cantilevers", 8), ("rain_chains", 4)):
        obj = member(scene, piece)
        matrix = obj.matrix_world
        local_up = matrix.inverted().to_3x3() @ Vector((0, 0, 1))
        islands = components(obj)
        if len(islands) != expected:
            raise ValueError(f"{obj.name}: expected {expected} intact canopy parts, got {len(islands)}")
        counts = [0] * len(CENTRES)
        for indices in islands:
            vertices = [obj.data.vertices[i] for i in indices]
            points = [matrix @ v.co for v in vertices]
            centre = sum(points, Vector()) / len(points)
            if piece == "rims":
                # The projected ellipses overlap, so distinguish the rim
                # segments by the height of the actual leaf surface too.
                distances = [
                    sum(abs(glass_elevation(p, y) - p.z) for p in points) / len(points)
                    for y in CENTRES
                ]
                owner = min(range(len(CENTRES)), key=distances.__getitem__)
                if distances[owner] > 0.023:
                    raise ValueError("A bronze rim segment no longer follows its authored glass")
            else:
                owner = min(range(len(CENTRES)), key=lambda i: abs(CENTRES[i] - centre.y))
                if abs(CENTRES[owner] - centre.y) > 0.09:
                    raise ValueError(f"{obj.name}: an attachment wandered from its leaf")
            counts[owner] += 1
            if piece in ("cantilevers", "rain_chains"):
                # The upper ring follows the raised leaf. The lower ring
                # stays fixed at its old masonry anchor or gutter invert.
                upper = [v for v, p in zip(vertices, points) if p.z > centre.z]
                if len(upper) * 2 != len(vertices):
                    raise ValueError(f"{obj.name}: expected two separate attachment rings")
                vertices = upper
            for vertex in vertices:
                vertex.co += RAISE[owner] * local_up
        if counts != [expected // len(CENTRES)] * len(CENTRES):
            raise ValueError(f"{obj.name}: uneven partition across the four leaves: {counts}")
        obj.data.update()
        finished.append(obj.name)
    scene[MARKER] = 1
    return finished
