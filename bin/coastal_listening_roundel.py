"""Fabricate and fit the listening cabinet stone roundel and its annular lamp."""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

PIVOT = Vector((-12.391, 7.4885, 1.556))
RADIUS = 0.220
OFFSET = (0.335, -0.005, 0.175)
SPLAY = -8
MOUNT = "core_speakeasy_stone_mount__dark bronze"
RING_SECTION = (
    (-12.391, 0.287),
    (-12.375, 0.296),
    (-12.354, 0.295),
    (-12.349, 0.292),
    (-12.349, None),
    (-12.391, None),
)


def roundel_owner(prefix):
    matches = [o for o in bpy.context.scene.objects if o.name.startswith(prefix)]
    if len(matches) != 1:
        raise ValueError(f"Expected one {prefix} geometry owner, found {len(matches)}")
    return matches[0]


def assembly_matrix(radius=RADIUS, offset=OFFSET, splay=SPLAY):
    return (
        Matrix.Translation(PIVOT + Vector(offset))
        @ Matrix.Rotation(math.radians(splay), 4, "Z")
        @ Matrix.Diagonal((1, radius / 0.296, radius / 0.296, 1))
        @ Matrix.Translation(-PIVOT)
    )


def inner_radius(radius):
    return 0.282 + 0.0015 * 0.296 / radius


def circular_section(x, radius, count=72):
    angles = (math.tau * i / count for i in range(count))
    return [Vector((x, PIVOT.y + radius * math.cos(angle), PIVOT.z + radius * math.sin(angle))) for angle in angles]


def fixture_sections(radius):
    return [circular_section(x, r if r is not None else inner_radius(radius)) for x, r in RING_SECTION]


def loft(facets, caps=False):
    n = len(facets[0])
    vertices = [v for row in facets for v in row]
    faces = []
    count = len(facets) - int(caps)
    for j in range(count):
        j2 = (j + 1) % len(facets)
        for k in range(n):
            k2 = (k + 1) % n
            faces.append((j * n + k, j * n + k2, j2 * n + k2, j2 * n + k))
    if caps:
        end = (len(facets) - 1) * n
        faces.extend((tuple(range(n)), tuple(end + i for i in range(n))))
    return vertices, faces


def formed_mesh(name, sections, material, transform=None, cap=False, carrier=()):
    vertices, faces = loft(sections, cap)
    if carrier:
        plate, sides = loft(carrier, True)
        faces.extend(tuple(len(vertices) + index for index in face) for face in sides)
        vertices.extend(plate)
    if transform is not None:
        vertices = [transform @ v for v in vertices]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if not all(edge.is_manifold for edge in bm.edges):
        raise ValueError(f"{name} requires a closed fixture")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return mesh


def chamfered_section(x, y, z, width, height, chamfer):
    u, v = width / 2, height / 2
    xy = [
        (-u + chamfer, -v),
        (u - chamfer, -v),
        (u, -v + chamfer),
        (u, v - chamfer),
        (u - chamfer, v),
        (-u + chamfer, v),
        (-u, v - chamfer),
        (-u, -v + chamfer),
    ]
    return [Vector((x, y + w, z + h)) for w, h in xy]


def fit_roundel():
    """Finish the current full-sized assembly once, retaining the original two finishes."""
    halo = roundel_owner("core_speakeasy_stone_halo__")
    stone = roundel_owner("core_speakeasy_stone_medallion__")
    felt = roundel_owner("core_speakeasy_cabinet_back__")
    bpy.context.view_layer.update()
    native = [stone.matrix_world @ v.co for v in stone.data.vertices]
    z_radius = (max(p.z for p in native) - min(p.z for p in native)) / 2
    existing_mount = bpy.context.scene.objects.get(MOUNT)
    if existing_mount is not None:
        if abs(z_radius - 0.282 * RADIUS / 0.296) >= 0.001 or existing_mount.get("installationGroup") != "speakeasy":
            raise ValueError("Found a mount with a different listening-room stone fit")
        return stone, halo, existing_mount
    if abs(z_radius - 0.282) >= 0.001:
        raise ValueError("Expected the original cabinet roundel before fitting")
    assert halo.get("installationGlow") == "listening-bar" and stone.get("installationGroup") == "speakeasy"

    transform = assembly_matrix()
    stone.data.transform(stone.matrix_world.inverted() @ transform @ stone.matrix_world)
    original = halo.data
    name = original.name
    halo.data = formed_mesh(
        name + " lamp", fixture_sections(RADIUS), original.materials[0], halo.matrix_world.inverted() @ transform
    )
    if not original.users:
        bpy.data.meshes.remove(original)
        halo.data.name = name

    # Broad wall flange through the cabinet backing, decreasing to a concealed
    # socket in the open bore of the lamp. A 0.6 mm lap seats the stone from behind.
    face = max((felt.matrix_world @ v.co).x for v in felt.data.vertices)
    centre = PIVOT + Vector(OFFSET)
    sections = [
        chamfered_section(face - 0.0006, centre.y, centre.z, 0.146, 0.162, 0.012),
        chamfered_section(face + 0.012, centre.y, centre.z, 0.146, 0.162, 0.012),
        chamfered_section(face + 0.022, centre.y, centre.z, 0.100, 0.114, 0.014),
        [transform @ p for p in chamfered_section(-12.3774, PIVOT.y, PIVOT.z, 0.112, 0.139, 0.014)],
    ]
    # One hidden, socket-welded carrier catches the emitter at its rear lip and
    # transfers its load into the same flanged arm as the stone. It is smaller
    # than the illuminated profile and makes no optical cutout.
    carrier = [
        [transform @ p for p in circular_section(x, r, count=72)]
        for x, r in ((-12.3985, 0.280), (-12.396, 0.289), (-12.388, 0.289))
    ]
    mount = bpy.data.objects.new(
        MOUNT,
        formed_mesh(MOUNT, sections, bpy.data.materials["dark bronze"], cap=True, carrier=carrier),
    )
    for collection in halo.users_collection:
        collection.objects.link(mount)
    mount["installationGroup"] = "speakeasy"
    bpy.context.view_layer.update()
    return stone, halo, mount
