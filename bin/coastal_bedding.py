"""Bedding for the sleep room: the original fitted cover, and the October refit (Sirui,
2026-10-14). Each avatar gets its own pillow, dented under its head, and its own duvet, draped
over its sleeping body by a small position-based cloth solver; an empty, made bed has both
undented. The runtime shows the pair that matches who is (or is not) asleep."""
import math
import numpy as np
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from coastal_sculpt import surface

AVATARS = ("lizard", "south-park", "simpsons", "ghibli", "rick-and-morty")
# Avatar sources stand at their own origin; the sleep actor sits here in the house.
SLEEP_ACTOR = Vector((-3.1, -3.49, 2.6))
MATTRESS = {"center": (-3.10, -3.18, 3.03), "size": (1.49, 2.18, 0.22)}
BEDFRAME = {"center": (-3.10, -3.15, 2.80), "size": (1.54, 2.25, 0.32)}
BEDSIDE = {"center": (-4.13, -2.47), "radius": 0.23, "bottom": 2.6, "top": 3.28}
OLD_PILLOW = {"min": (-3.53, -2.57, 3.09), "max": (-2.67, -2.13, 3.33)}
PILLOW_FRONT = -2.33 - 0.22
OVERHANG = {"side": 0.4, "foot": 0.32}
# Bend resistance across two cells: a filled duvet folds in broad curves, not crumples.
BEND = 0.12


def duvet(name, mat, offset=(0, 0, 0)):
    nx, ny = 32, 36
    vertices, faces = [], []
    for j in range(ny + 1):
        v = j / ny
        for i in range(nx + 1):
            u = i / nx
            # The hem drapes below the mattress top (0.54 m). Broad central
            # fullness leaves room for the reclining body; small folds settle
            # toward the edges rather than forming a second rigid mattress.
            across = max(0, math.sin(math.pi * u)) ** 0.6
            along = max(0, math.sin(math.pi * v)) ** 0.28
            y = 1.52 + (v - 0.5) * 1.61
            # The adult pose rests on the pillow; cloth fullness follows its
            # torso and raised toes instead of letting shoes emerge through it.
            toes = .16 * math.exp(-((y - 1.08) / .30) ** 2)
            torso = .055 * math.exp(-((y - 1.91) / .40) ** 2)
            z = 0.48 + across * (0.34 * along + toes + torso)
            z += 0.008 * math.sin(u * 42 + v * 13) * across * along
            vertices.append((-3.10 + (u - 0.5) * 1.59 + offset[0],
                             y + offset[1], z + offset[2]))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    obj = surface(name, vertices, faces, mat)
    bpy.context.view_layer.objects.active = obj
    solid = obj.modifiers.new("Soft folded hem", "SOLIDIFY")
    solid.thickness = 0.028
    solid.offset = -1
    bpy.ops.object.modifier_apply(modifier=solid.name)
    return obj


def pose_clip(arm, clip, frame):
    for track in arm.animation_data.nla_tracks:
        track.mute = track.name != clip
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()


def sleepers(source, frames=(25, 73)):
    """Every avatar's deformed sleep surface in house coordinates, at the deepest and shallowest
    breath. Opens each avatar source, so call it before opening the house."""
    bodies = []
    for avatar in AVATARS:
        bpy.ops.wm.open_mainfile(filepath=str(source / f"sirui-{avatar}.blend"))
        arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
        meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
        for frame in frames:
            pose_clip(arm, "sleep", frame)
            graph = bpy.context.evaluated_depsgraph_get()
            for mesh in meshes:
                evaluated = mesh.evaluated_get(graph)
                data = evaluated.to_mesh()
                data.calc_loop_triangles()
                head = mesh.vertex_groups.get("Head")
                head_index = head.index if head else -1
                points = [evaluated.matrix_world @ v.co + SLEEP_ACTOR for v in data.vertices]
                is_head = [any(g.group == head_index and g.weight > 0.5 for g in mesh.data.vertices[v.index].groups)
                           for v in data.vertices] if head_index >= 0 and len(data.vertices) == len(mesh.data.vertices) else [False] * len(points)
                bodies.append({"avatar": avatar, "frame": frame, "mesh": mesh.name, "points": points,
                               "triangles": [tuple(t.vertices) for t in data.loop_triangles], "head": is_head})
                evaluated.to_mesh_clear()
    return bodies


def _bvh(bodies):
    vertices, triangles = [], []
    for body in bodies:
        base = len(vertices)
        vertices.extend(body["points"])
        triangles.extend((a + base, b + base, c + base) for a, b, c in body["triangles"])
    return BVHTree.FromPolygons(vertices, triangles), vertices, triangles


def remove_component(obj, low, high):
    """Delete the connected parts of a material-batched mesh that lie inside a box (world
    coordinates; batched meshes keep their own origin)."""
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
        if all(low[k] <= (to_world @ v.co)[k] <= high[k] for v in island for k in range(3)):
            doomed.extend(island)
    removed = len(doomed)
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return removed


def pillow(name, mat, bodies, center=(-3.10, -2.33), size=(0.72, 0.44), loft=0.17, gap=0.004):
    """A down pillow: a flat contact patch on the mattress, a pinched seam all round, and a top
    pressed down wherever any sleeping head rests, the dent spread by the cover's tension."""
    base = MATTRESS["center"][2] + MATTRESS["size"][2] / 2
    seam = 0.035
    nx, ny = 40, 26
    grid = {}
    for j in range(ny + 1):
        for i in range(nx + 1):
            s, t = i / nx * 2 - 1, j / ny * 2 - 1
            e = (1 - abs(s) ** 4) * (1 - abs(t) ** 4)
            grid[i, j] = (center[0] + s * size[0] / 2, center[1] + t * size[1] / 2, e)
    tree = _bvh(bodies)[0] if bodies else None
    top = {}
    need = {}
    for key, (x, y, e) in grid.items():
        z = base + seam + (loft - seam) * e ** 0.45
        top[key] = z
        hit = tree.ray_cast(Vector((x, y, base - 0.02)), Vector((0, 0, 1)), 1.0) if tree else (None,)
        need[key] = max(0.0, z - (hit[0].z - gap)) if hit[0] is not None else 0.0
    # The cover spreads each pressed point into a soft funnel (radius 8 cm), never shallower
    # than the head itself requires.
    radius = 0.08
    pressed = [(grid[k][0], grid[k][1], d) for k, d in need.items() if d > 0]
    for key, (x, y, e) in grid.items():
        dent = 0.0
        for px, py, d in pressed:
            r = math.hypot(x - px, y - py)
            if r < radius:
                dent = max(dent, d * (1 - (r / radius) ** 2) ** 2)
        floor = base + seam * (1 - min(1, e * 4)) + 0.02
        top[key] = max(floor, top[key] - dent) if e > 0 else top[key]
    vertices, faces, index = [], [], {}
    for key, (x, y, e) in grid.items():
        index["t", key] = len(vertices)
        vertices.append((x, y, top[key]))
    for key, (x, y, e) in grid.items():
        i, j = key
        if i in (0, nx) or j in (0, ny):
            index["b", key] = index["t", key]
        else:
            index["b", key] = len(vertices)
            vertices.append((x, y, base + seam * (1 - min(1, e * 4))))
    for j in range(ny):
        for i in range(nx):
            q = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            faces.append(tuple(index["t", k] for k in q))
            faces.append(tuple(index["b", k] for k in reversed(q)))
    obj = surface(name, vertices, faces, mat)
    deepest = max(need.values(), default=0.0)
    return obj, deepest


def chin(bodies):
    """The lowest point of the sleepers' heads along the bed (toward the feet). Hair counts: it
    is weighted to the head, so the shoulder-length locks of October 15 set the hem as well."""
    return min((p.y for b in bodies for p, h in zip(b["points"], b["head"]) if h), default=None)


def _box(name, center, size, bevel=0.0):
    # Applied in world space: the support field's ray casts are in house coordinates.
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("edge", "BEVEL")
        mod.width, mod.segments = bevel, 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def support_field(bodies, pillow_obj, bounds, step=0.01):
    """The top of everything a cover can rest on, sampled every centimetre by casting down: the
    floor, bed frame, mattress, bedside table, pillow and the sleeper. A duvet only ever touches
    these from above, so their upper envelope is all the drape needs."""
    (x0, x1), (y0, y1) = bounds
    xs = np.arange(x0, x1 + step / 2, step)
    ys = np.arange(y0, y1 + step / 2, step)
    field = np.full((len(ys), len(xs)), 2.6)
    temporary = [_box("frame support", BEDFRAME["center"], BEDFRAME["size"], 0.1),
                 _box("mattress support", MATTRESS["center"], MATTRESS["size"], 0.1)]
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=BEDSIDE["radius"], depth=BEDSIDE["top"] - BEDSIDE["bottom"],
                                        location=(*BEDSIDE["center"], (BEDSIDE["top"] + BEDSIDE["bottom"]) / 2))
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    temporary.append(bpy.context.object)
    graph = bpy.context.evaluated_depsgraph_get()
    trees = [BVHTree.FromObject(o, graph) for o in temporary + [pillow_obj]]
    if bodies:
        trees.append(_bvh(bodies)[0])
    down = Vector((0, 0, -1))
    for j, y in enumerate(ys):
        for i, x in enumerate(xs):
            top = 2.6
            for tree in trees:
                hit = tree.ray_cast(Vector((x, y, 6.0)), down)
                if hit[0] is not None and hit[0].z > top:
                    top = hit[0].z
            field[j, i] = top
    for obj in temporary:
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.meshes.remove(data)
    return xs, ys, field


def _sample(field, x, y):
    xs, ys, h = field
    fx = np.clip((x - xs[0]) / (xs[1] - xs[0]), 0, len(xs) - 1.001)
    fy = np.clip((y - ys[0]) / (ys[1] - ys[0]), 0, len(ys) - 1.001)
    i, j = fx.astype(int), fy.astype(int)
    tx, ty = fx - i, fy - j
    return (h[j, i] * (1 - tx) * (1 - ty) + h[j, i + 1] * tx * (1 - ty)
            + h[j + 1, i] * (1 - tx) * ty + h[j + 1, i + 1] * tx * ty)


def drape(field, grid, start_z, margin=0.02, dt=1 / 120, steps=480, iterations=10, bend=BEND):
    """Position-based dynamics (Mueller et al., 2007): the cover falls under gravity, distance
    constraints keep its weave (stretch and shear stiff, a soft bend across two cells), and every
    vertex is projected out of the support field with a margin. Constraints are coloured so no
    two in a batch share a vertex, which gives Gauss-Seidel convergence with whole-array updates.
    A vertex that would step under a higher surface sideways (an overhang swinging into the
    mattress) is held at its previous position across, like a wall, instead of being lifted on
    top. Contacts are inelastic and carry friction."""
    (left, right, nx), (foot, reach, ny) = grid
    xs = np.linspace(left, right, nx)
    ys = np.linspace(foot, reach, ny)
    gx, gy = np.meshgrid(xs, ys)
    position = np.stack([gx.ravel(), gy.ravel(), np.full(gx.size, start_z)], axis=1)
    velocity = np.zeros_like(position)
    index = np.arange(nx * ny).reshape(ny, nx)
    batches = []

    def add(a, b, stiffness):
        a, b = a.ravel(), b.ravel()
        batches.append((a, b, np.linalg.norm(position[b] - position[a], axis=1), stiffness))

    for parity in (0, 1):
        add(index[:, parity:-1:2], index[:, parity + 1 :: 2], 1.0)
        add(index[parity:-1:2, :], index[parity + 1 :: 2, :], 1.0)
        add(index[parity:-1:2, :-1], index[parity + 1 :: 2, 1:], 0.6)
        add(index[parity:-1:2, 1:], index[parity + 1 :: 2, :-1], 0.6)
    for phase in (0, 2):
        columns = [c for c in range(nx - 2) if c % 4 in (phase, phase + 1)]
        rows = [r for r in range(ny - 2) if r % 4 in (phase, phase + 1)]
        add(index[:, columns], index[:, [c + 2 for c in columns]], bend)
        add(index[rows, :], index[[r + 2 for r in rows], :], bend)
    gravity = np.array([0, 0, -9.81])
    for _ in range(steps):
        velocity = (velocity + gravity * dt) * 0.995
        predicted = position + velocity * dt
        came_from = _sample(field, position[:, 0], position[:, 1]) + margin
        for _ in range(iterations):
            for a, b, rest, stiffness in batches:
                d = predicted[b] - predicted[a]
                length = np.maximum(np.linalg.norm(d, axis=1), 1e-9)
                correction = d * ((length - rest) / length * 0.5 * stiffness)[:, None]
                predicted[a] += correction
                predicted[b] -= correction
            floor = _sample(field, predicted[:, 0], predicted[:, 1]) + margin
            below = predicted[:, 2] < floor
            if below.any():
                wall = below & (floor - predicted[:, 2] > 0.03) & (position[:, 2] >= came_from - 1e-4)
                predicted[wall, :2] = position[wall, :2]
                floor[wall] = came_from[wall]
                predicted[below, 2] = np.maximum(predicted[below, 2], floor[below])
        contact = predicted[:, 2] <= _sample(field, predicted[:, 0], predicted[:, 1]) + margin + 0.002
        velocity = (predicted - position) / dt
        velocity[contact, 2] = np.minimum(velocity[contact, 2], 0.0)
        velocity[contact, :2] *= 0.35
        speed = np.linalg.norm(velocity, axis=1)
        velocity *= np.minimum(1.0, 2.5 / np.maximum(speed, 1e-9))[:, None]
        position = predicted
    return position.reshape(ny, nx, 3)


def draped_duvet(name, mat, bodies, pillow_obj, spacing=0.03, quilt=0.3):
    """A quilted cover settled over one sleeper (or an empty, made bed), trimmed straight across
    the chest a hand's breadth below the chin, then given thickness away from the sleeper."""
    mattress_top = MATTRESS["center"][2] + MATTRESS["size"][2] / 2
    # A double duvet: wide enough to tent over a sleeper and still fall past both sides.
    left = MATTRESS["center"][0] - MATTRESS["size"][0] / 2 - OVERHANG["side"]
    right = MATTRESS["center"][0] + MATTRESS["size"][0] / 2 + OVERHANG["side"]
    foot = MATTRESS["center"][1] - MATTRESS["size"][1] / 2 - OVERHANG["foot"]
    lowest_chin = chin(bodies)
    # A made bed folds back just short of the pillow.
    hem = lowest_chin - 0.07 if lowest_chin is not None else PILLOW_FRONT - 0.05
    # Extra cloth past the hem settles over the chin, then is cut away for a straight edge. A made
    # bed is laid just above the mattress, short of the pillow, in a stiffer, smoother hand.
    reach = hem + 0.12 if bodies else hem + 0.04
    field = support_field(bodies, pillow_obj, ((left - 0.3, right + 0.3), (foot - 0.3, reach + 0.3)))
    inside = field[2][(field[1] >= foot)[:, None] & (field[1] <= reach)[:, None] & (field[0] >= left)[None, :] & (field[0] <= right)[None, :]]
    start = float(max(inside.max(), mattress_top + 0.17)) + 0.04 if bodies else mattress_top + 0.03
    nx = round((right - left) / spacing) + 1
    ny = round((reach - foot) / spacing) + 1
    settled = drape(field, ((left, right, nx), (foot, reach, ny)), start, bend=BEND if bodies else 0.35)
    vertices = [tuple(settled[j, i]) for j in range(ny) for i in range(nx)]
    faces = [(j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i) for j in range(ny - 1) for i in range(nx - 1)]
    cover = surface(name, vertices, faces, mat)
    cover.data.update()
    # Quilting: each square of filling puffs between its stitch lines, in the cloth's own rest
    # coordinates so the stitches follow the drape.
    normals = [Vector(v.normal) for v in cover.data.vertices]
    for k, (v, n) in enumerate(zip(cover.data.vertices, normals)):
        u, w = (k % nx) * spacing, (k // nx) * spacing
        puff = (math.sin(math.pi * u / quilt) * math.sin(math.pi * w / quilt)) ** 2
        v.co += n * 0.007 * puff
    # Trim the top straight across at the hem, along the draped surface.
    bm = bmesh.new()
    bm.from_mesh(cover.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, hem, 0), plane_no=(0, 1, 0), clear_outer=True)
    bm.to_mesh(cover.data)
    bm.free()
    # Flat stretches need few vertices; folds keep theirs.
    bpy.context.view_layer.objects.active = cover
    lighter = cover.modifiers.new("Web density", "DECIMATE")
    lighter.ratio = 0.5
    bpy.ops.object.modifier_apply(modifier=lighter.name)
    solid = cover.modifiers.new("Filled cover", "SOLIDIFY")
    solid.thickness = 0.03
    solid.offset = 1
    solid.thickness_clamp = 1.5
    bpy.ops.object.modifier_apply(modifier=solid.name)
    for face in cover.data.polygons:
        face.use_smooth = True
    return cover, {"hemY": round(hem, 4), "startZ": round(start, 4), "grid": [nx, ny]}
