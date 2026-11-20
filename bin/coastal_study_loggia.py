"""Move the six-place poolside dining setting under the retained study roof."""

import math
from collections import Counter, defaultdict

import bmesh
import bpy
from mathutils import Matrix, Vector


from coastal_office import Parts, box, cylinder
from coastal_shell import _islands, boolean_preserving_islands

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
    return receipt
