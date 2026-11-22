"""Open the original terrace guard between the posts at the new supper stair."""

import bmesh
from mathutils import Vector

from coastal_shell import _islands


RAIL = "core_estate_terrace__brushed brass"
GLASS = "core_estate_guard__facade low-iron glass"
POST_X = -7.2357
GUARD_Y = 4.70
MARK = "supperApproachGuard"


def _bounds(obj, vertices):
    points = [obj.matrix_world @ v.co for v in vertices]
    return tuple(tuple(f(axis) for axis in zip(*points)) for f in (min, max))


def _near(value, target):
    return abs(value - target) < 0.018


def _member(obj, mesh, matches):
    found = [vertices for vertices in _islands(mesh) if matches(*_bounds(obj, vertices))]
    if len(found) != 1:
        raise ValueError(f"{obj.name}: expected exactly one stair-mouth guard member, got {len(found)}")
    return found[0]


def _across_mouth(lo, hi):
    return (
        _near(lo[0], -8.40) and hi[0] > POST_X + 1
        and _near(lo[1], GUARD_Y - 0.018) and _near(hi[1], GUARD_Y + 0.018)
        and lo[2] > 1.08
    )


def _glazed_bay(lo, hi):
    return (
        _near(lo[0], -8.391) and _near(hi[0], -7.2447)
        and _near(lo[1], GUARD_Y) and _near(hi[1], GUARD_Y)
        and _near(lo[2], 0.08) and _near(hi[2], 1.10)
    )


def fit_supper_approach(scene):
    if scene.get(MARK):
        return
    rail, glass = (scene.objects[name] for name in (RAIL, GLASS))
    metal, glazed = bmesh.new(), bmesh.new()
    try:
        metal.from_mesh(rail.data)
        glazed.from_mesh(glass.data)
        across = _member(rail, metal, _across_mouth)
        pane = _member(glass, glazed, _glazed_bay)
        geom = set(across)
        geom.update(edge for vertex in across for edge in vertex.link_edges)
        geom.update(face for vertex in across for face in vertex.link_faces)
        world = rail.matrix_world
        caps = bmesh.ops.bisect_plane(
            metal,
            geom=list(geom),
            dist=0.00001,
            plane_co=world.inverted() @ Vector((POST_X, GUARD_Y, 1.12)),
            plane_no=(world.to_3x3().transposed() @ Vector((1, 0, 0))).normalized(),
            clear_inner=True,
            clear_outer=False,
        )["geom_cut"]
        edges = [e for e in caps if isinstance(e, bmesh.types.BMEdge) and e.is_valid and e.is_boundary]
        closure = bmesh.ops.holes_fill(metal, edges=edges, sides=0)["faces"]
        if len(closure) != 1 or any(not edge.is_manifold for edge in closure[0].edges):
            raise ValueError("The retained rail needs one sealed brass end above its original post")
        cap = closure[0]
        neighbour = next(f for edge in cap.edges for f in edge.link_faces if f != cap)
        cap.material_index = neighbour.material_index
        # The west return rail is a different connected member with its own
        # authored end. Both verified neighbouring posts and panes stay seated.
        bmesh.ops.delete(glazed, geom=list(pane), context="VERTS")
        metal.to_mesh(rail.data)
        glazed.to_mesh(glass.data)
        rail.data.update()
        glass.data.update()
    finally:
        metal.free()
        glazed.free()
    scene[MARK] = 1
