"""Move the six-place poolside dining setting under the retained study roof."""

import math
from collections import Counter, defaultdict

import bmesh
import bpy
from mathutils import Matrix, Vector


from coastal_office import Parts, box, cylinder
from coastal_shell import _box_object, _islands, boolean_preserving_islands

APRON = ((-12.78, -0.78), (-8.50, 6.03))
FLOOR = 0.001
RAIL_APERTURE = ((-8.440, -0.760, -0.030), (-8.360, 1.207, 1.175))
RAIL_NAMES = ("core_estate_terrace__brushed brass", "core_estate_guard__facade low-iron glass")
STATIONS = {
    "dining": ((5.82, 2.04, 0.0), (-10.18, 4.03, FLOOR), math.pi / 2),
    "bbq": ((5.78, -1.01, 0.0), (-12.40, 3.79, FLOOR), -math.pi / 2),
    "wet_bar": ((3.58, -0.17, 0.0), (-12.37, 0.75, FLOOR), math.pi),
}
PAVILION_MATERIAL_BATCHES = (
    "pale oak",
    "brushed brass",
    "warm cut stone",
    "honey ash",
    "festoon bulb glass",
    "travertine paving stone",
    "polished nickel",
    "charcoal",
    "linen",
    "facade low-iron glass",
)
PATH_FROM_PATIO = (
    (-7.95, -2.55),
    (-8.445, 0.96),
    (-9.12, 1.82),
    (-9.26, 2.54),
)

FRIDGE_PREFIX = "core_study_bbq_fridge"
FRIDGE_REVISION = "studyBbqFridgeRevision"
PREP_CASE = "core_estate_pavilion__honey ash"
PREP_PANEL = "core_estate_pavilion__pale oak"
PREP_PULL = "core_estate_pavilion__brushed brass"
FRIDGE_OPENING = ((-12.674, 2.817, 0.021), (-12.025, 3.431, 0.806))


def frame(source, destination, yaw):
    return Matrix.Translation(destination) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Translation(-Vector(source))


def bounds(points):
    return tuple(Vector([extrema(p[axis] for p in points) for axis in range(3)]) for extrema in (min, max))


def add_box(parts, material, lo, hi, radius=0.001):
    lo, hi = Vector(lo), Vector(hi)
    box(parts.bm(material), (lo + hi) / 2, hi - lo, radius, segments=1)


def classify(name, lo, hi):
    """Authoring batches share finishes. Classify the actual connected parts."""
    if name.startswith("core_estate_pavilion_breakfast_"):
        return "dining"
    if name.startswith(("core_estate_sink__", "core_walkflow_pavilion_cabinet__")):
        return "bbq"
    finish = name.split("__", 1)[1]
    if finish == "brushed brass":
        if hi.z <= 0.161 and lo.z >= -0.005:
            return "pergola"
        if lo.z > 2.20:
            return "pendant_drop"
    if lo.z > 2.55 or hi.z - lo.z > 2.30:
        return "pergola"
    if hi.x <= 4.02:
        return "wet_bar"
    if hi.y <= -0.52:
        return "bbq"
    if lo.y >= 0.85:
        return "dining"
    raise ValueError(f"Unclassified pavilion component {name} {tuple(lo)} .. {tuple(hi)}")


def roof_at(scene, x, y):
    hit, point, normal, _, owner, _ = scene.ray_cast(
        bpy.context.evaluated_depsgraph_get(), Vector((x, y, 3.0)), Vector((0, 0, 1)), distance=5.0
    )
    if not hit or normal.z > -0.8 or point.z < 4.5 or "roof" not in owner.name:
        raise ValueError(f"Missing underside of the retained roof at {(x, y)}: {owner.name if hit else None}")
    return point.z


def move_material_batches(scene):
    expected = tuple("core_estate_pavilion__" + finish for finish in PAVILION_MATERIAL_BATCHES)
    native = {obj.name: obj for obj in scene.objects}
    if any(name not in native for name in expected):
        raise ValueError("Missing a native pavilion batch; survey the retained source before moving it.")
    selected = [native[name] for name in expected]
    selected += [
        ob
        for ob in scene.objects
        if ob.type == "MESH"
        and ob.name.startswith(
            ("core_estate_pavilion_breakfast_", "core_estate_sink__", "core_walkflow_pavilion_cabinet__")
        )
    ]
    transforms = {label: frame(*spec) for label, spec in STATIONS.items()}
    counts, group_points = Counter(), defaultdict(list)
    optional_breakfast = []
    for obj in selected:
        if obj.name.startswith("core_estate_pavilion_breakfast_"):
            optional_breakfast.append(obj.name)
        to_world = obj.matrix_world.copy()
        to_local = to_world.inverted()
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        discard = []
        for component in _islands(mesh):
            world_points = [to_world @ vert.co for vert in component]
            lo, hi = bounds(world_points)
            kind = classify(obj.name, lo, hi)
            counts[kind] += 1
            if kind == "pergola":
                discard.extend(component)
                continue
            if kind == "pendant_drop":
                center = transforms["dining"] @ ((lo + hi) / 2)
                ceiling = roof_at(scene, center.x, center.y)
                bottom = lo.z + FLOOR
                for vert, old in zip(component, world_points):
                    point = transforms["dining"] @ old
                    # Extend the original bronze cable without stretching its cross-section.
                    point.z = bottom + ((old.z - lo.z) / (hi.z - lo.z)) * (ceiling + 0.004 - bottom)
                    vert.co = to_local @ point
                    group_points[kind].append(point)
                continue
            for vert, old in zip(component, world_points):
                point = transforms[kind] @ old
                vert.co = to_local @ point
                group_points[kind].append(point)
        if discard:
            bmesh.ops.delete(mesh, geom=discard, context="VERTS")
        mesh.to_mesh(obj.data)
        mesh.free()
        obj.data.update()
    if counts["pergola"] != 36 or counts["pendant_drop"] != 2:
        raise ValueError(f"Unexpected pergola assembly count: {counts}")
    group_bounds = {
        k: [[round(v, 5) for v in bound] for bound in bounds(points)] for k, points in group_points.items()
    }
    return {
        "counts": dict(counts),
        "groupBounds": group_bounds,
        "optionalBreakfastMeshes": optional_breakfast,
        "transformMatrices": {k: [list(row) for row in mat] for k, mat in transforms.items()},
    }


def build_apron():
    stone = bpy.data.materials["warm cut stone"]
    pavers = bpy.data.materials["travertine paving stone"]
    (x0, y0), (x1, y1) = APRON
    core = Parts("core_study_loggia")
    # The bed sits into the surveyed basalt/sandstone shelf; preserve the visible root and vault.
    add_box(core, stone, (x0, y0, -0.30), (x1, y1, -0.0258), 0.004)
    columns, rows = 5, 7
    for i in range(columns):
        a, b = x0 + (x1 - x0) * i / columns, x0 + (x1 - x0) * (i + 1) / columns
        for j in range(rows):
            c, d = y0 + (y1 - y0) * j / rows, y0 + (y1 - y0) * (j + 1) / rows
            add_box(core, pavers, (a + 0.003, c + 0.003, -0.026), (b - 0.003, d - 0.003, FLOOR))
    objects = core.finish()
    for ob in objects:
        ob["estateOutdoors"] = True
        ob["studyLoggia"] = True
    return [ob.name for ob in objects]


def open_internal_guard(scene):
    """Open only the part that now separates two dry, flush slabs."""
    stone = bpy.data.materials["chalk limestone"]
    bronze = bpy.data.materials["brushed brass"]
    cutting = Parts("study loggia removable guard opening tool")
    add_box(cutting, stone, *RAIL_APERTURE, radius=0)
    tool = cutting.finish()[0]
    bpy.context.view_layer.update()
    receipts = {}
    for name in RAIL_NAMES:
        receipts[name] = boolean_preserving_islands(scene.objects[name], tool)
        if receipts[name].get("skippedDisjoint") or receipts[name].get("cutNonManifold"):
            raise ValueError(f"Guard opening did not preserve closed affected parts: {receipts[name]}")
    bpy.data.objects.remove(tool, do_unlink=True)
    end = Parts("core_study_loggia_entry_post")
    cylinder(end.bm(bronze), (-8.4, -0.766, 0.001), (-8.4, -0.766, 1.133), 0.012, 12)
    [post] = end.finish()
    post["estateOutdoors"] = True
    post["studyLoggia"] = True
    return receipts


def _measured_island(obj, limits, vertex_count):
    """Return the single surveyed component, preserving material batches outside it."""
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    matches = []
    for island in _islands(mesh):
        actual = bounds([obj.matrix_world @ vert.co for vert in island])
        if all(abs(a - b) < 0.001 for point, expected in zip(actual, limits) for a, b in zip(point, expected)):
            matches.append((island, actual))
    if len(matches) != 1 or len(matches[0][0]) != vertex_count:
        mesh.free()
        raise ValueError(f"The surveyed fridge host has changed: {obj.name}")
    island, actual = matches[0]
    return mesh, island, [list(point) for point in actual]


def _retire_prep_front(obj, limits, vertex_count):
    mesh, island, measured = _measured_island(obj, limits, vertex_count)
    bmesh.ops.delete(mesh, geom=island, context="VERTS")
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()
    return {"mesh": obj.name, "nativeBounds": measured, "removedVertices": vertex_count}


def _fridge_finish(name, color, roughness, metallic=0, brush=0):
    if bpy.data.materials.get(name):
        raise ValueError(f"Unexpected existing fridge material: {name}")
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Anisotropic"].default_value = brush
    return material


def _rectangular_sleeve(mesh, x0, x1, outside, inside):
    """A closed gasket or frame with a real through opening in the Y/Z plane."""

    def ring(x, limits):
        y0, z0, y1, z1 = limits
        return [mesh.verts.new((x, y, z)) for y, z in ((y0, z0), (y1, z0), (y1, z1), (y0, z1))]

    outer_back, outer_front = ring(x0, outside), ring(x1, outside)
    inner_back, inner_front = ring(x0, inside), ring(x1, inside)
    faces = []
    for i in range(4):
        j = (i + 1) % 4
        faces.extend(
            (
                mesh.faces.new((outer_back[i], outer_back[j], outer_front[j], outer_front[i])),
                mesh.faces.new((inner_back[j], inner_back[i], inner_front[i], inner_front[j])),
                mesh.faces.new((outer_front[i], outer_front[j], inner_front[j], inner_front[i])),
                mesh.faces.new((outer_back[j], outer_back[i], inner_back[i], inner_back[j])),
            )
        )
    bmesh.ops.recalc_face_normals(mesh, faces=faces)


def install_prep_fridge(scene=None):
    """Fit a 600 mm chassis into the middle dry bay of the relocated study BBQ."""
    scene = scene or bpy.context.scene
    if scene.get(FRIDGE_REVISION) == 1:
        return {
            "meshes": sorted(o.name for o in scene.objects if o.name.startswith(FRIDGE_PREFIX)),
            "alreadyInstalled": True,
        }
    if not scene.get("studyLoggiaRelocationVersion"):
        raise ValueError("Relocate the pavilion and retain its cook-counter entrance before fitting the fridge")

    case = scene.objects[PREP_CASE]
    panel = scene.objects[PREP_PANEL]
    pull = scene.objects[PREP_PULL]
    case_bounds = ((-12.720, 2.165, 0.001), (-12.080, 4.320, 0.921))
    panel_bounds = ((-12.0795, 2.875, 0.076), (-12.0545, 3.405, 0.846))
    pull_bounds = ((-12.049, 3.030, 0.662), (-12.031, 3.250, 0.680))
    for obj, limits, count in ((case, case_bounds, 132), (panel, panel_bounds, 56), (pull, pull_bounds, 16)):
        mesh, _, _ = _measured_island(obj, limits, count)
        mesh.free()

    cutter = _box_object("temporary BBQ fridge bay cutter", *FRIDGE_OPENING, case.data.materials[0])
    bpy.context.view_layer.update()
    try:
        cut = boolean_preserving_islands(case, cutter)
    finally:
        bpy.data.objects.remove(cutter, do_unlink=True)
    if cut.get("cutNonManifold") != 0 or cut["affectedVertices"] != 132:
        raise ValueError(f"The cabinet pocket must remain a closed cut in the one surveyed case: {cut}")
    retired = [_retire_prep_front(panel, panel_bounds, 56), _retire_prep_front(pull, pull_bounds, 16)]

    steel = _fridge_finish("BBQ brushed charcoal steel", (0.145, 0.157, 0.161), 0.38, 0.83, 0.42)
    rubber = _fridge_finish("BBQ graphite seal", (0.021, 0.023, 0.025), 0.73)
    chassis = Parts(FRIDGE_PREFIX + "_chassis")
    add_box(chassis, rubber, (-12.626, 2.824, 0.028), (-12.116, 3.424, 0.794), 0.003)
    for y in (2.846, 3.380):
        add_box(chassis, rubber, (-12.55, y, 0.022), (-12.16, y + 0.023, 0.0275), 0.001)
    seal = Parts(FRIDGE_PREFIX + "_seal")
    _rectangular_sleeve(seal.bm(rubber), -12.115, -12.084, (2.828, 0.152, 3.420, 0.789), (2.832, 0.158, 3.416, 0.783))
    vents = Parts(FRIDGE_PREFIX + "_grille")
    _rectangular_sleeve(vents.bm(rubber), -12.111, -12.079, (2.838, 0.056, 3.410, 0.137), (2.855, 0.071, 3.393, 0.122))
    for z in (0.078, 0.090, 0.102, 0.114):
        add_box(vents, steel, (-12.107, 2.858, z - 0.002), (-12.083, 3.390, z + 0.002), 0.0008)

    front = Parts(FRIDGE_PREFIX + "_door")
    add_box(front, steel, (-12.093, 2.837, 0.164), (-12.063, 3.411, 0.778), 0.002)
    [door] = front.finish()
    finger = Parts("temporary BBQ fridge finger-pull cutter")
    add_box(finger, rubber, (-12.084, 3.066, 0.706), (-12.049, 3.303, 0.740), 0.004)
    [tool] = finger.finish()
    bpy.context.view_layer.update()
    try:
        grip = boolean_preserving_islands(door, tool)
    finally:
        bpy.data.objects.remove(tool, do_unlink=True)
    if grip.get("cutNonManifold") != 0:
        raise ValueError(f"The recessed pull broke the door skin: {grip}")

    objects = chassis.finish() + seal.finish() + vents.finish() + [door]
    for obj in objects:
        obj["estateOutdoors"] = True
        obj["studyLoggia"] = True
        obj["installationGroup"] = "exterior"
        # Follow the horizontal grain of the door in both Blender and the delivered glTF.
        mesh = obj.data
        if steel in mesh.materials[:]:
            uv = mesh.uv_layers.new(name="Brush grain")
            for loop in mesh.loops:
                co = mesh.vertices[loop.vertex_index].co
                uv.data[loop.index].uv = (co.y - 2.817, co.z - 0.021)
        for polygon in mesh.polygons:
            polygon.use_smooth = False
    scene[FRIDGE_REVISION] = 1
    bpy.context.view_layer.update()
    return {
        "meshes": [obj.name for obj in objects],
        "host": case.name,
        "caseCut": cut,
        "retiredPrepFront": retired,
        "openingBoundsNative": FRIDGE_OPENING,
        "chassisWidthM": 0.600,
        "doorRecessionFromOldOakM": 0.0085,
        "fingerPullDepthM": 0.021,
        "fingerPullCut": grip,
        "toeGrilleOpenings": 5,
    }


def relocate_pavilion(scene=None):
    """Fit the retained dining/BBQ onto the native roofed study shelf and hand back the binding geometry."""
    scene = scene or bpy.context.scene
    if scene.get("studyLoggiaRelocationVersion"):
        raise ValueError("Study loggia pavilion assembly has already moved.")
    receipt = move_material_batches(scene)
    receipt["floorMeshes"] = build_apron()
    receipt["guardCut"] = open_internal_guard(scene)
    receipt["floor"] = {"worldXYCorners": APRON, "topZ": FLOOR}
    receipt["patioApproach"] = PATH_FROM_PATIO
    bpy.context.view_layer.update()
    scene["studyLoggiaRelocationVersion"] = 1
    receipt["outdoorFridge"] = install_prep_fridge(scene)
    return receipt
