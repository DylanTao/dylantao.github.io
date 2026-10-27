"""Native cloth finish against retained arm geometry and finite authored poses.

This module changes connected sleeve cloth only. Skin, joints, Blink and all
original animation channels remain unchanged; trial tail work is separate.
"""
import hashlib
import heapq
import bpy
from mathutils import Matrix
from mathutils.bvhtree import BVHTree

STYLES = ("lizard", "south-park", "simpsons", "ghibli", "rick-and-morty")

def smoothstep(a, b, value):
    t = min(1.0, max(0.0, (value - a) / (b - a)))
    return t * t * (3 - 2 * t)

def surface_weights(mesh, triangle, point, vertices):
    a, b, c = [vertices[i] for i in triangle]
    u, v, p = b-a, c-a, point-a
    aa, ab, bb = u.dot(u), u.dot(v), v.dot(v)
    denominator = aa*bb-ab*ab
    if abs(denominator) < 1e-15:
        return {}
    s = (bb*p.dot(u)-ab*p.dot(v))/denominator
    t = (aa*p.dot(v)-ab*p.dot(u))/denominator
    barycentric = [max(0, 1-s-t), max(0, s), max(0, t)]
    total = sum(barycentric)
    weights = {}
    for i, coordinate in zip(triangle, barycentric):
        for group in mesh.data.vertices[i].groups:
            weights[group.group] = weights.get(group.group, 0) + coordinate/total*group.weight
    total = sum(weights.values())
    return {key: value/total for key, value in weights.items() if value > 1e-8}

def fitted_sleeves(arm, mesh, clearance, anatomical=False):
    """Follow each real cuff band over the garment's topology, preserving the torso.

    Only the last 15–22 cm of connected cloth can change binding. A small physical
    cuff clearance keeps the skin from crossing its cloth depth. The original
    skin, hands and all joints are unchanged.
    """
    me = mesh.data
    faces = [p for p in me.polygons if me.materials[p.material_index].name == "Sirui shirt"]
    points = {i: mesh.matrix_world @ me.vertices[i].co for p in faces for i in p.vertices}
    graph = {i: {} for i in points}
    for p in faces:
        for a, b in zip(p.vertices, list(p.vertices[1:])+[p.vertices[0]]):
            graph[a][b] = graph[b][a] = (points[a]-points[b]).length
    normals = mesh.matrix_world.to_3x3().inverted().transposed()
    inverse = mesh.matrix_world.inverted()
    me.calc_loop_triangles()
    world_vertices = [mesh.matrix_world @ vertex.co for vertex in me.vertices]
    report = {}
    for sign, side in ((-1, "L"), (1, "R")):
        bone = arm.data.bones[f"Arm.{side}"]
        a, b = arm.matrix_world @ bone.head_local, arm.matrix_world @ bone.tail_local
        axis = b-a
        direction = axis.normalized()
        seeds = set()
        seed_faces = 0
        for p in faces:
            center = mesh.matrix_world @ p.center
            along = (center-a).dot(axis)/axis.length_squared
            radius = (center-a-axis*along).length
            normal = (normals @ p.normal).normalized()
            if sign*center.x > abs(a.x)*.75 and .9 < along < 1.15 and radius < .16 and abs(normal.dot(direction)) > .90:
                seeds.update(p.vertices)
                seed_faces += 1
        assert 24 <= seed_faces <= 128, (side, seed_faces)
        distance = {i: 0 for i in seeds}
        reach = .22 if anatomical else .15
        queue = [(0, i) for i in seeds]
        heapq.heapify(queue)
        while queue:
            cost, i = heapq.heappop(queue)
            if cost != distance[i]:
                continue
            for j, edge in graph[i].items():
                total = cost+edge
                if total > reach or total >= distance.get(j, float("inf")):
                    continue
                distance[j] = total
                heapq.heappush(queue, (total, j))
        changed = 0
        maximum_shift = 0
        group = mesh.vertex_groups[f"Arm.{side}"]
        arm_groups = {mesh.vertex_groups[name].index for name in (f"Arm.{side}", f"Forearm.{side}")}
        triangles = [tuple(triangle.vertices) for triangle in me.loop_triangles if me.materials[me.polygons[triangle.polygon_index].material_index].name == "skin" and any(any(binding.group in arm_groups and binding.weight > .1 for binding in me.vertices[i].groups) for i in triangle.vertices)]
        tree = BVHTree.FromPolygons(world_vertices, triangles, all_triangles=True) if anatomical else None
        for i, cost in distance.items():
            vertex = me.vertices[i]
            before = {g.group: g.weight for g in vertex.groups}
            after = before.copy()
            if anatomical:
                hit = tree.find_nearest(points[i], .08)
                if hit[0] is not None:
                    alpha = (1-smoothstep(.14, .22, cost))*(1-smoothstep(.05, .08, hit[3]))
                    target = surface_weights(mesh, triangles[hit[2]], hit[0], world_vertices)
                    after = {key: before.get(key, 0)*(1-alpha)+target.get(key, 0)*alpha for key in set(before)|set(target)}
            else:
                wanted = 1-smoothstep(.015, .15, cost)
                old = before.get(group.index, 0)
                weight = max(old, wanted)
                rest = sum(v for k, v in before.items() if k != group.index)
                after = {key: value*(1-weight)/rest for key, value in before.items() if key != group.index and rest}
                after[group.index] = weight
            if any(abs(after.get(key, 0)-before.get(key, 0)) > 1e-5 for key in set(before)|set(after)):
                for key in before:
                    mesh.vertex_groups[key].remove([i])
                for key, value in after.items():
                    if value > 1e-6:
                        mesh.vertex_groups[key].add([i], value, "REPLACE")
                changed += 1
            p = points[i]
            radial = p-a-axis*((p-a).dot(axis)/axis.length_squared)
            shift = clearance*(1-smoothstep(0, .22 if anatomical else .10, cost))
            if radial.length and shift:
                vertex.co = inverse @ (p+radial.normalized()*shift)
                maximum_shift = max(maximum_shift, shift)
        report[side] = {"cuffBandFaces": seed_faces, "geodesicVertices": len(distance), "changedWeights": changed, "maximumRestShift": maximum_shift}
    me.update()
    return report

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def posed_sleeve_clearance(arm, mesh):
    """Fit retained cloth against the actual closed arms in finite sampled poses.

    The original skin, skeleton and actions stay unchanged. Linear skinning is
    inverted only for a bounded displacement of the connected sleeve vertices.
    This is an offline authoring fit, not runtime collision simulation.
    """
    me = mesh.data
    names = {g.index: g.name for g in mesh.vertex_groups}
    arm_groups = {g.index for g in mesh.vertex_groups if g.name.startswith(("Arm.", "Forearm."))}
    skin_ids = {v.index for v in me.vertices if any(g.group in arm_groups and g.weight > .1 for g in v.groups)}
    shirt_ids = {i for p in me.polygons if me.materials[p.material_index].name == "Sirui shirt" for i in p.vertices}
    chosen = set()
    for i in shirt_ids:
        p = mesh.matrix_world @ me.vertices[i].co
        for side in ("L", "R"):
            bone = arm.data.bones[f"Arm.{side}"]
            cuff = arm.matrix_world @ bone.tail_local
            if (p-cuff).length < .245:
                chosen.add(i)
    chosen = sorted(chosen)
    me.calc_loop_triangles()
    skin_triangles = [tuple(t.vertices) for t in me.loop_triangles if me.materials[t.material_index].name == "skin" and any(i in skin_ids for i in t.vertices)]
    original = {i: mesh.matrix_world @ me.vertices[i].co for i in chosen}
    samples = []
    for clip, frame in (("idle", 1), ("idle", 49), ("lounge", 1), ("lounge", 49), ("drink", 49), ("eat", 49), ("typing", 49), ("reading", 49), ("workout", 49)):
        for track in arm.animation_data.nla_tracks:
            track.mute = track.name != clip
        bpy.context.scene.frame_set(frame)
        evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        posed = evaluated.to_mesh()
        points = [evaluated.matrix_world @ v.co for v in posed.vertices]
        tree = BVHTree.FromPolygons(points, skin_triangles, all_triangles=True)
        transforms = {}
        bones = {name: arm.matrix_world @ bone.matrix @ bone.bone.matrix_local.inverted() @ arm.matrix_world.inverted() for name, bone in arm.pose.bones.items()}
        for i in chosen:
            matrix = Matrix(((0.,)*4,)*4)
            vertex = me.vertices[i]
            total = sum(g.weight for g in vertex.groups)
            for binding in vertex.groups:
                transform = bones[names[binding.group]]
                for row in range(4):
                    for column in range(4):
                        matrix[row][column] += transform[row][column]*binding.weight/total
            assert (matrix @ original[i]-points[i]).length < 2e-5
            transforms[i] = (matrix, matrix.inverted())
        evaluated.to_mesh_clear()
        samples.append((clip, frame, tree, transforms))
    current = {i: p.copy() for i, p in original.items()}
    history = []
    for iteration in range(10):
        maximum = 0
        corrections = 0
        for clip, frame, tree, transforms in samples:
            for i in chosen:
                matrix, inverse = transforms[i]
                point = matrix @ current[i]
                hit = tree.find_nearest(point, .07)
                if hit[0] is None:
                    continue
                signed = (point-hit[0]).dot(hit[1])
                if signed >= .004:
                    continue
                correction = hit[1]*(.004-signed)
                proposed = inverse @ (point+correction)
                if (proposed-original[i]).length > .055:
                    continue
                current[i] = proposed
                maximum = max(maximum, correction.length)
                corrections += 1
        history.append({"iteration": iteration, "corrections": corrections, "largestPosedCorrection": maximum})
        if maximum < .0001:
            break
    inverse_mesh = mesh.matrix_world.inverted()
    for i, point in current.items():
        me.vertices[i].co = inverse_mesh @ point
    me.update()
    return {"sampledPoses": [{"clip": clip, "frame": frame} for clip, frame, _, _ in samples], "clothVertices": len(chosen), "maximumRestDisplacement": max((current[i]-original[i]).length for i in chosen), "clearance": .004, "iterations": history}
