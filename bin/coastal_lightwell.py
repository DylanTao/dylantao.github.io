"""A light well drilled from the clifftop into the onsen's vault (Sirui, 2026-10-14).

The shaft leans 28 degrees toward the south, so the noon sun passes it for most of the year,
and flares at the bottom into a smooth limestone-lined lip. A ring of river stones guards the
opening on the clifftop. Because the cutaway lifts the roof for interior views, the onsen also
gets a shadow-only copy of its own vault (the browser draws it into the sun's shadow map but
never on screen): the bath then receives direct sun only through the shaft, while every other
room keeps the cutaway's open sunlight. House coordinates: +X north, +Y west (the sea), Z up.
"""

import math
import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

# The aperture sits about a metre south of the pool centre, where a beam tilted by the noon sun
# lands in the water through much of the year.
APERTURE_XY = Vector((2.2, -3.18))
TILT = math.radians(28)
AXIS = Vector((-math.sin(TILT), 0.0, math.cos(TILT)))
RADIUS = 0.42
FLARE = 0.62
ONSEN_REGION = {"min": (1.9, -5.55, 3.9), "max": (5.75, -1.2, 8.4)}


def surface_point(obj, origin, direction):
    """First hit on an object's evaluated surface, in world space."""
    graph = bpy.context.evaluated_depsgraph_get()
    mesh = obj.evaluated_get(graph).to_mesh()
    tree = BVHTree.FromPolygons([obj.matrix_world @ v.co for v in mesh.vertices], [tuple(p.vertices) for p in mesh.polygons])
    obj.evaluated_get(graph).to_mesh_clear()
    hit = tree.ray_cast(Vector(origin), Vector(direction).normalized(), 40)
    return hit[0]


def well_cutter(ceiling_z, top_z, mat):
    """A closed lathe along the tilted axis: the shaft, its bottom flare, and margins past both
    rock faces so the Boolean cuts cleanly."""
    start = Vector((APERTURE_XY.x, APERTURE_XY.y, ceiling_z))
    length = (top_z - ceiling_z) / AXIS.z + 1.0
    profile = [(FLARE + 0.08, -0.35), (FLARE, 0.0), (RADIUS + 0.06, 0.18), (RADIUS, 0.32), (RADIUS, length)]
    segments = 48
    bm = bmesh.new()
    frame = AXIS.to_track_quat("Z", "X").to_matrix()
    rings = []
    for r, t in profile:
        rings.append([bm.verts.new(start + frame @ Vector((r * math.cos(a), r * math.sin(a), t)))
                      for a in (k * math.tau / segments for k in range(segments))])
    for lower, upper in zip(rings, rings[1:]):
        for k in range(segments):
            bm.faces.new((lower[k], lower[(k + 1) % segments], upper[(k + 1) % segments], upper[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    data = bpy.data.meshes.new("light well cutter")
    bm.to_mesh(data)
    bm.free()
    data.materials.append(mat)
    obj = bpy.data.objects.new("light well cutter", data)
    bpy.context.collection.objects.link(obj)
    return obj


def drill(target, cutter):
    bpy.context.view_layer.objects.active = target
    modifier = target.modifiers.new("Light well", "BOOLEAN")
    modifier.operation, modifier.solver, modifier.object = "DIFFERENCE", "EXACT", cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bm = bmesh.new()
    bm.from_mesh(target.data)
    open_edges = sum(not e.is_manifold for e in bm.edges)
    bm.free()
    return open_edges


def clear_planting(top, radius, prefixes=("core__coastal sage scrub", "core__blue sage agave leaf", "core__coastal wildflower ochre")):
    """Remove the clifftop planting that would stand in or over the opening."""
    removed = 0
    for name in prefixes:
        obj = bpy.data.objects.get(name)
        if not obj:
            continue
        to_world = obj.matrix_world.copy()
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.verts.ensure_lookup_table()
        seen, doomed = set(), []
        for start in bm.verts:
            if start.index in seen:
                continue
            stack, island = [start], []
            seen.add(start.index)
            while stack:
                v = stack.pop()
                island.append(v)
                for e in v.link_edges:
                    w = e.other_vert(v)
                    if w.index not in seen:
                        seen.add(w.index)
                        stack.append(w)
            middle = sum((to_world @ v.co for v in island), Vector()) / len(island)
            if (middle.xy - top.xy).length < radius and abs(middle.z - top.z) < 1.5:
                doomed.extend(island)
        removed += len(set(doomed))
        bmesh.ops.delete(bm, geom=list(set(doomed)), context="VERTS")
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
    return removed


def rim_stones(mat, top_center, ground, count=14, ring=None, seed=7):
    """River stones bedded around the opening on the clifftop, each set on the ground beneath it."""
    import random
    from mathutils import noise
    rng = random.Random(seed)
    ring = ring or RADIUS + 0.2
    bm = bmesh.new()
    for i in range(count):
        theta = (i + rng.uniform(-0.15, 0.15)) * math.tau / count
        length = math.tau * ring / count * rng.uniform(1.25, 1.45)
        width, height = rng.uniform(0.2, 0.26), rng.uniform(0.16, 0.22)
        offset = Vector((rng.uniform(-50, 50), rng.uniform(-50, 50), rng.uniform(-50, 50)))
        made = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
        turn = Matrix.Rotation(theta + math.pi / 2, 3, "Z")
        x, y = top_center.x + ring * math.cos(theta), top_center.y + ring * math.sin(theta)
        base = ground(x, y)
        for v in made["verts"]:
            p = v.co.copy()
            p *= 1 + 0.13 * noise.noise(p * 1.1 + offset)
            p = Vector((p.x * length / 2, p.y * width / 2, p.z * height / 2))
            if p.z > 0.3 * height / 2:
                p.z = 0.3 * height / 2 + (p.z - 0.3 * height / 2) * 0.45
            v.co = Vector((x, y, base + height * 0.22)) + turn @ p
    data = bpy.data.meshes.new("core_lightwell_rim")
    bm.to_mesh(data)
    bm.free()
    data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = True
    obj = bpy.data.objects.new("core_lightwell_rim", data)
    bpy.context.collection.objects.link(obj)
    obj["caveRoof"] = True
    return obj


def shadow_vault(ceiling, mat):
    """A shadow-only copy of the drilled vault over the onsen alone."""
    copy = ceiling.copy()
    copy.data = ceiling.data.copy()
    bpy.context.collection.objects.link(copy)
    for key in list(copy.keys()):
        del copy[key]
    copy.name = "onsen_shadow_vault"
    low, high = Vector(ONSEN_REGION["min"]), Vector(ONSEN_REGION["max"])
    bpy.ops.mesh.primitive_cube_add(size=1, location=(low + high) / 2)
    region = bpy.context.object
    region.dimensions = high - low
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.context.view_layer.objects.active = copy
    modifier = copy.modifiers.new("Onsen only", "BOOLEAN")
    modifier.operation, modifier.solver, modifier.object = "INTERSECT", "EXACT", region
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(region, do_unlink=True)
    # A curtain on the bath's south side: the vault that would block the noon sun from the study
    # side is lifted there too, so the sun would otherwise reach the bath sideways under it.
    bm = bmesh.new()
    bm.from_mesh(copy.data)
    to_local = copy.matrix_world.inverted()
    curtain = Matrix.Translation(to_local @ Vector((low.x - 0.05, (low.y + high.y) / 2, (2.85 + 5.9) / 2)))
    bmesh.ops.create_cube(bm, size=1, matrix=curtain @ Matrix.Diagonal((0.1, high.y - low.y, 5.9 - 2.85, 1)))
    bm.to_mesh(copy.data)
    bm.free()
    copy.data.materials.clear()
    copy.data.materials.append(mat)
    copy["shadowOnly"] = True
    return copy
