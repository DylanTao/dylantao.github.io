"""Fit acoustic backing behind Sirui's settee and carry stone onto the seaward headwall."""

import math

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from coastal_listening_joinery import stone_uv

STONE = "listening room sedimentary stone"
LEGACY_CLOTH = "bar moss mohair"
OLIVE = "listening room olive mohair"
OLIVE_RGB = (0.123, 0.109, 0.052)
WALNUT = "listening room quarter-cut walnut"
OLD_WINGS = "core_speakeasy_loggia_felt_wings__speaker charcoal felt"
BACKING = "core_speakeasy_loggia_shoulder_backing__walnut and mohair"
GABLE = "core_speakeasy_gable__bar umber lime plaster"
CENTRE = Vector((-9.468, 8.57, 0))
JOIN = 0.0018


def settee_cloth():
    cloth = bpy.data.materials.get(OLIVE)
    if cloth is None:
        cloth = bpy.data.materials[LEGACY_CLOTH].copy()
        cloth.name = OLIVE
    bsdf = cloth.node_tree.nodes["Principled BSDF"]
    rgba = (*OLIVE_RGB, 1)
    cloth.diffuse_color = rgba
    cloth.roughness = 0.91
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = 0.91
    if "Sheen Weight" in bsdf.inputs:
        bsdf.inputs["Sheen Weight"].default_value = 0.19
        bsdf.inputs["Sheen Roughness"].default_value = 0.68
        bsdf.inputs["Sheen Tint"].default_value = rgba
    return cloth


def fit_settee_upholstery(scene):
    cloth = settee_cloth()
    for part in ("sofa_seat", "sofa_back", "sofa_channels"):
        obj = scene.objects["core_speakeasy_" + part + "__" + LEGACY_CLOTH]
        assert len(obj.data.materials) == 1
        obj.data.materials[0] = cloth
    return cloth


def surface(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    coords = [obj.matrix_world @ vertex.co for vertex in mesh.vertices]
    faces = [tuple(tri.vertices) for tri in mesh.loop_triangles]
    return BVHTree.FromPolygons(coords, faces, all_triangles=True)


def radius_at(tree, radial, height):
    origin = CENTRE + 1.1 * radial + Vector((0, 0, height))
    hit = tree.ray_cast(origin, -radial, 0.65)[0]
    if hit is None:
        raise ValueError(f"The settee lacks its expected backing at height {height:.4f} m")
    return (hit - CENTRE).dot(radial)


def shoulder_profile(angle, phase, base):
    unit = Vector((math.cos(angle), math.sin(angle), 0))
    # Follow the existing upholstered crown, with a soft fall at the two ends.
    top = 0.814 + 0.112 * math.cos(angle) - 0.009 * (1 - math.sin(math.pi * phase))
    arris = 0.007
    body = 0.012 + 0.013 * math.sin(math.pi * phase)
    base_low, base_high = 0.273, 0.324
    rail_z, waist_z, upper_z = 0.49, 0.660, top - 0.047
    foot_at = radius_at(base, unit, base_low)
    foot_top = radius_at(base, unit, base_high)
    # The solid walnut foot has a shallow rebate in the original plinth.
    # The fitted back leaves 4 mm behind the .827 m compression envelope,
    # allowing the mohair cushion to relax without intersecting the jacket.
    inside = 0.831
    profile = (
        (foot_at - JOIN, base_low),
        (foot_at + 0.014, base_low),
        (foot_top + 0.019, base_high),
        (inside + body - 0.008, rail_z - 0.025),
        (inside + body - 0.002, rail_z - 0.005),
        (inside + body, rail_z + 0.003),
        (inside + body, waist_z),
        (inside + body, upper_z),
        (inside + body - 0.002, top - arris),
        (inside + body - 0.008, top),
        (inside, top),
        (inside, upper_z),
        (inside, waist_z),
        (inside, rail_z),
        (inside, 0.333),
        (foot_top - JOIN, base_high),
    )
    return [CENTRE + unit * r + Vector((0, 0, z)) for r, z in profile]


def fit_shoulder_backing(scene):
    existing = scene.objects.get(BACKING)
    if existing is not None:
        if scene.objects.get(OLD_WINGS) is not None:
            raise ValueError("Both generations of settee backing are present")
        return existing

    bpy.context.view_layer.update()
    plinth = scene.objects["core_speakeasy_sofa_plinth__" + WALNUT]
    seat_back = scene.objects["core_speakeasy_sofa_back__" + LEGACY_CLOTH]
    base = surface(plinth)
    backs = [seat_back.matrix_world @ vert.co for vert in seat_back.data.vertices]
    outer_radius = max(math.hypot((p - CENTRE).x, (p - CENTRE).y) for p in backs)
    if abs(outer_radius - 0.827) > 0.0003:
        raise ValueError(f"The expected settee outer radius is .827 m, measured {outer_radius:.6f} m")
    work = bmesh.new()
    segments = 16
    for sign in (-1, 1):
        rings = []
        for i in range(segments + 1):
            progress = i / segments
            a = sign * (0.655 + 0.681 * progress)
            rings.append([work.verts.new(v) for v in shoulder_profile(a, progress, base)])
        for left, right in zip(rings, rings[1:]):
            for i in range(len(left)):
                j = (i + 1) % len(left)
                face = work.faces.new((left[i], left[j], right[j], right[i]))
                face.smooth = i not in (0, 9)
                face.material_index = int(5 <= i <= 7)
        work.faces.new(rings[0])
        work.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(work, faces=list(work.faces))
    assert all(edge.is_manifold for edge in work.edges) and work.calc_volume(signed=True) > 0
    mesh = bpy.data.meshes.new(BACKING)
    mesh.materials.append(bpy.data.materials[WALNUT])
    mesh.materials.append(settee_cloth())
    work.to_mesh(mesh)
    work.free()
    mesh.update()
    obj = bpy.data.objects.new(BACKING, mesh)
    obj["installationGroup"] = "speakeasy"
    for group in seat_back.users_collection:
        group.objects.link(obj)

    uv = mesh.uv_layers.new(name="Material scale")
    for face in mesh.polygons:
        axis = max(range(3), key=lambda i: abs(face.normal[i]))
        for index in face.loop_indices:
            x, y, z = mesh.vertices[mesh.loops[index].vertex_index].co
            u, v = ((y, z), (x, z), (x, y))[axis]
            uv.data[index].uv = (u / 0.48, v / 1.28)
    old = scene.objects.get(OLD_WINGS)
    if old is not None:
        mesh = old.data
        bpy.data.objects.remove(old, do_unlink=True)
        if not mesh.users:
            bpy.data.meshes.remove(mesh)
    return obj


def face_seaward_headwall(scene):
    obj = scene.objects[GABLE]
    mesh = obj.data
    faces = [
        face
        for face in mesh.polygons
        if face.normal.y < -0.99
        and all(abs((obj.matrix_world @ mesh.vertices[index].co).y - 9.921) < 0.00015 for index in face.vertices)
    ]
    if len(faces) != 16:
        raise ValueError(f"Expected 16 faces closing the front of the fire-loggia headwall, got {len(faces)}")
    material = mesh.materials.find(STONE)
    if material == -1:
        material = len(mesh.materials)
        mesh.materials.append(bpy.data.materials[STONE])
    uv = mesh.uv_layers.active or mesh.uv_layers.new(name="Material scale")
    for face in faces:
        face.material_index = material
        for index in face.loop_indices:
            x, _, z = mesh.vertices[mesh.loops[index].vertex_index].co
            uv.data[index].uv = stone_uv(x, z)
    mesh.update()
    return obj


def fit_settee(scene):
    fit_shoulder_backing(scene)
    fit_settee_upholstery(scene)
    face_seaward_headwall(scene)
