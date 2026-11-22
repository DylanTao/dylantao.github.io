"""Fit measured joints in the renovated supper gallery and public passages.

Apply to the assembled native house before baking and packing the shell.
Coordinates are Blender world metres. Existing paving and framework stay in
place. Only the added material at each joint is refitted.
"""

import bmesh
from mathutils import Vector

from coastal_shell import _islands


MARKER = "passageContactsFitted"
GALLERY = "core_listening_gallery_"
GYM_SILL = "core_passage_finish_gym_sill__"
ONSEN = "core_onsen_passage_"
PIVOT = "core_study_window_pivot_"


def member(scene, prefix):
    found = [obj for obj in scene.objects if obj.type == "MESH" and obj.name.startswith(prefix)]
    if len(found) != 1:
        raise ValueError(f"Expected one native mesh for {prefix}, found {len(found)}")
    return found[0]


def islands(obj):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(obj.data)
        return [[v.index for v in part] for part in _islands(mesh)]
    finally:
        mesh.free()


def fit(obj, axis, old, new, indices=None):
    """Reshape an authored extent while retaining its bevel, UVs and data layers."""
    vertices = obj.data.vertices
    selected = [vertices[i] for i in indices] if indices is not None else list(vertices)
    matrix = obj.matrix_world
    inverse = matrix.inverted()
    coordinates = [matrix @ v.co for v in selected]
    original = min(v[axis] for v in coordinates), max(v[axis] for v in coordinates)
    if any(abs(a - b) > 0.0015 for a, b in zip(original, old)):
        raise ValueError(f"{obj.name} axis {axis}: expected {old}, measured {original}")

    new_start = new[0]
    scale = (new[1] - new[0]) / (original[1] - original[0])
    for vertex, point in zip(selected, coordinates):
        point[axis] = new_start + (point[axis] - original[0]) * scale
        vertex.co = inverse @ point
    obj.data.update()


def fit_gallery(scene):
    landing = member(scene, GALLERY + "landing__")
    # The seated travertine stops at y=4.797 (bed at 4.800). The loggia meets it
    # on the west at x=-8.500. Keep the approach slab at its authored tread level
    # and start it at those existing edges with a small open movement joint.
    fit(landing, 0, (-8.60, -7.12), (-8.498, -7.12))
    fit(landing, 1, (4.39, 5.34), (4.802, 5.34))

    bearing = member(scene, GALLERY + "bearing__")
    west, east = sorted(
        islands(bearing),
        key=lambda indices: min((bearing.matrix_world @ bearing.data.vertices[i].co).x for i in indices),
    )
    # The west side already bears on the retained 2.948 m masonry vault cap.
    # Seat a shim there instead of continuing a pier through the horn and LPs.
    vault = member(scene, "core_speakeasy_cut_vault__")
    for x in (-12.345, -12.195):
        for y in (6.375, 6.545):
            hit, point, _, _ = vault.ray_cast(
                vault.matrix_world.inverted() @ Vector((x, y, 3.12)),
                vault.matrix_world.inverted().to_3x3() @ Vector((0, 0, -1)),
            )
            if not hit or abs((vault.matrix_world @ point).z - 2.948) > 0.002:
                raise ValueError("The west gallery bearing has lost its continuous vault cap")
    fit(bearing, 2, (0.01, 2.97), (2.947, 2.952), west)
    fit(bearing, 2, (0.01, 2.97), (0.01, 2.952), east)

    stringers = member(scene, GALLERY + "stringers__")
    parts = sorted(
        islands(stringers),
        key=lambda indices: min((stringers.matrix_world @ stringers.data.vertices[i].co).x for i in indices),
    )
    if len(parts) != 2:
        raise ValueError("Expected both side-mounted stair stringers")
    for indices, end, left in zip(parts, (-8.34, -7.12), (True, False)):
        xx = [(stringers.matrix_world @ stringers.data.vertices[i].co).x for i in indices]
        low, high = min(xx), max(xx)
        if not (0.14 < high - low < 0.165 and low < end < high):
            raise ValueError("The timber stringer must be the surveyed stair edge piece")
        # The side-mounted timber follows the nosings without cutting through
        # every stone tread. The oak cap still overhangs the edge by 8 mm.
        shift = end - 0.002 - high if left else end + 0.002 - low
        fit(stringers, 0, (low, high), (low + shift, high + shift), indices)

    slats = member(scene, GALLERY + "ceiling_slats__")
    # The new slats rest on the existing 5.490 m beam tops.
    fit(slats, 2, (5.460, 5.535), (5.489, 5.535))
    return [landing, bearing, stringers, slats]


def fit_thresholds(scene):
    gym = [obj for obj in scene.objects if obj.type == "MESH" and obj.name.startswith(GYM_SILL)]
    if len(gym) != 2:
        raise ValueError("Expected both the gym stone sill and its bronze tracks")
    # Support on the actual -15 mm slab, with 1 mm of seating into the old bed.
    # The ramp and track crests retain their authored world positions.
    for obj in gym:
        points = [(obj.matrix_world @ vertex.co).z for vertex in obj.data.vertices]
        underside = [i for i, z in enumerate(points) if abs(z + 0.060) <= 0.0005]
        if len(underside) * 2 != len(points):
            raise ValueError(f"{obj.name}: missing the surveyed planar underside")
        delta = obj.matrix_world.inverted().to_3x3() @ Vector((0, 0, 0.044))
        for i in underside:
            obj.data.vertices[i].co += delta
        obj.data.update()

    base = member(scene, ONSEN + "base__")
    sill = member(scene, ONSEN + "sill__")
    # The floor is already carried by the old hall and the upper-link slab.
    # Retain the 53 mm visible oak skirting and fill only the floor seam.
    fit(base, 2, (2.480, 2.651), (2.598, 2.651))
    fit(sill, 1, (-17.633, -17.597), (-17.619, -17.611))

    frame = member(scene, PIVOT + "frame__")
    uprights = [
        part
        for part in islands(frame)
        if min((frame.matrix_world @ frame.data.vertices[i].co).z for i in part) < 1.1
    ]
    if len(uprights) != 2:
        raise ValueError("The study opening needs its two retained walnut uprights")
    # Each jamb sits on the existing oak sill rather than occupying its width.
    for part in uprights:
        fit(frame, 2, (1.075, 1.756), (1.108, 1.756), part)
    return [*gym, base, sill, frame]


def fit_passage_contacts(scene):
    """Apply once to the final native assembly and return meshes to rebake."""
    if scene.get(MARKER):
        return []
    changed = [*fit_gallery(scene), *fit_thresholds(scene)]
    scene[MARKER] = 1
    return [obj.name for obj in changed]
