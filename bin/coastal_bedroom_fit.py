"""Native fitting for the retained coastal bedroom.

Call install_bedroom_fit(scene) with the retained house open. It returns native
and web anchors for the caller to bind, and does not save a blend or manifest.
Native world uses Z up, with +Y towards the sea. The source uses web [X,Z,-Y].
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

FLOOR = 1.50
BAY = {"west": -5.25, "east": -4.80, "inland": -7.93, "sea": -7.10, "ceiling": 3.62}
CHAIR_AT = Vector((-6.24, -4.255, FLOOR))
CHAIR_YAW = math.radians(12)
OLD_TABLE = Vector((-5.77, -5.95, FLOOR))
NEW_TABLE = Vector((-5.58, -4.10, FLOOR))


def web(location):
    x, y, z = location
    return [float(x), float(z), float(-y)]


def position(location):
    return {"native": [float(v) for v in location], "web": web(location)}


def material(name, color, roughness=0.73, metallic=0):
    surface = bpy.data.materials.get(name)
    if surface:
        return surface
    surface = bpy.data.materials.new(name)
    surface.diffuse_color = (*color, 1)
    surface.use_nodes = True
    shader = surface.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return surface


def make_mesh(scene, name, points, faces, surface):
    data = bpy.data.meshes.new(name)
    data.from_pydata(points, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(data)
    bm.free()
    data.materials.append(surface)
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    return obj


def extrusion(scene, name, first, last, surface):
    count = len(first)
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    return make_mesh(scene, name, first + last, faces, surface)


def panel(scene, name, lo, hi, surface):
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    profile = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    return extrusion(scene, name, [(x, y, z0) for x, y in profile], [(x, y, z1) for x, y in profile], surface)


def bench_panel(scene, name, center, size, surface, bevel=0.018, transform=Matrix.Identity(4)):
    x, y, z = Vector(center)
    w, d, h = (component / 2 for component in size)
    r = min(bevel, w * 0.7, d * 0.7)
    corners = [
        (x - w + r, y - d),
        (x + w - r, y - d),
        (x + w, y - d + r),
        (x + w, y + d - r),
        (x + w - r, y + d),
        (x - w + r, y + d),
        (x - w, y + d - r),
        (x - w, y - d + r),
    ]
    first = [transform @ Vector((a, b, z - h)) for a, b in corners]
    last = [transform @ Vector((a, b, z + h)) for a, b in corners]
    return extrusion(scene, name, first, last, surface)


def rail(scene, name, path, radius, surface, sides=6):
    """A curved closed wooden member with a consistent side frame."""
    rings = []
    for index, point in enumerate(path):
        point = Vector(point)
        vec = Vector(path[min(index + 1, len(path) - 1)]) - Vector(path[max(index - 1, 0)])
        tangent = vec.normalized()
        sideways = tangent.cross(Vector((0, 0, 1)))
        if sideways.length < 0.001:
            sideways = tangent.cross(Vector((0, 1, 0)))
        sideways.normalize()
        other = tangent.cross(sideways).normalized()
        rings.extend(
            point + radius * (sideways * math.cos(j * math.tau / sides) + other * math.sin(j * math.tau / sides))
            for j in range(sides)
        )
    faces = [tuple(reversed(range(sides))), tuple(range(len(rings) - sides, len(rings)))]
    for i in range(len(path) - 1):
        faces.extend(
            (i * sides + j, i * sides + (j + 1) % sides, (i + 1) * sides + (j + 1) % sides, (i + 1) * sides + j)
            for j in range(sides)
        )
    obj = make_mesh(scene, name, rings, faces, surface)
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return obj


def cut_wall(scene, plaster):
    wall = scene.objects["core_finish_bedchamber_wall_east__chalk limestone"]
    cutter = panel(
        scene, "bedroom fit cutter", (-5.252, BAY["inland"], 1.477), (-5.148, BAY["sea"], BAY["ceiling"]), plaster
    )
    modifier = wall.modifiers.new("Dressing bay opening", "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = cutter
    try:
        with bpy.context.temp_override(object=wall, active_object=wall):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    finally:
        geometry = cutter.data
        bpy.data.objects.remove(cutter, do_unlink=True)
        bpy.data.meshes.remove(geometry)
    return wall.name


def make_bay(scene, oak, stone, plaster, bronze, mirror):
    west, east, lo, hi, ceiling = (BAY[key] for key in ("west", "east", "inland", "sea", "ceiling"))
    outer = -4.775
    floor_name = "core_bedroom_fit_bay_floor"
    panel(scene, "core_bedroom_fit_bay_stone", (-5.15, lo - 0.018, 1.344), (outer, hi + 0.018, 1.478), stone)
    panel(scene, floor_name, (-5.251, lo, 1.478), (east, hi, FLOOR), oak)
    panel(scene, "core_bedroom_fit_bay_back", (east, lo - 0.025, 1.478), (outer, hi + 0.025, ceiling + 0.064), plaster)
    panel(scene, "core_bedroom_fit_bay_inland", (west + 0.10, lo - 0.025, 1.478), (east, lo, ceiling + 0.064), plaster)
    panel(scene, "core_bedroom_fit_bay_seaward", (west + 0.10, hi, 1.478), (east, hi + 0.025, ceiling + 0.064), plaster)
    panel(scene, "core_bedroom_fit_bay_head", (west + 0.10, lo, ceiling), (east, hi, ceiling + 0.064), plaster)
    for index, y in enumerate((lo + 0.155, hi - 0.155), 1):
        # Negative X key bears on the retained sandstone fin. The tip holds the new stone deck.
        outline = [(-5.264, 1.039), (-4.857, 1.344), (-5.264, 1.344)]
        extrusion(
            scene,
            f"core_bedroom_fit_bay_bearing_{index}",
            [(x, y - 0.056, z) for x, z in outline],
            [(x, y + 0.056, z) for x, z in outline],
            stone,
        )
    bench_y = -7.366
    bench_panel(scene, "sleep_fit_dressing_bench", (-4.976, bench_y, 1.918), (0.328, 0.49, 0.064), oak)
    for index, y in enumerate((bench_y - 0.183, bench_y + 0.183), 1):
        panel(
            scene, f"sleep_fit_dressing_bench_foot_{index}", (-5.087, y - 0.036, FLOOR), (-4.852, y + 0.036, 1.895), oak
        )
    mirror_angle = math.radians(49)
    mirror_transform = Matrix.Translation(Vector((-5.073, -7.77, 2.4415))) @ Matrix.Rotation(mirror_angle, 4, "Z")
    bench_panel(
        scene, "sleep_fit_full_mirror_frame", (0, -0.009, 0), (0.366, 0.023, 1.719), bronze, 0.008, mirror_transform
    )
    bench_panel(scene, "sleep_fit_full_mirror", (0, 0.004, 0), (0.350, 0.004, 1.695), mirror, 0.007, mirror_transform)
    normal = mirror_transform.to_3x3() @ Vector((0, 1, 0))
    mirror_at = mirror_transform @ Vector((0, 0.006, 0))
    for index, z in enumerate((1.73, 3.11), 1):
        panel(
            scene,
            f"sleep_fit_mirror_standoff_{index}",
            (-5.203, lo + 0.002, z - 0.026),
            (-5.152, -7.846, z + 0.026),
            bronze,
        )
    return {
        "bench": position((-4.976, bench_y, 1.950)),
        "mirror": {
            "surface": position(mirror_at),
            "nativeNormal": [float(v) for v in normal],
            "webNormal": web(normal),
            "node": "sleep_fit_full_mirror",
            "width": 0.350,
            "height": 1.695,
        },
        "floorSupport": floor_name,
        "newClearFloorAreaM2": round((east - west) * (hi - lo), 6),
        "newClearDepthM": round(east - west, 6),
        "clearOpeningM": [round(hi - lo, 6), round(ceiling - FLOOR, 6)],
        "outerFaceNativeX": outer,
    }


def move_old_fittings(scene):
    """Move the original occasional table and its linen shade as one reading-side set."""
    table = scene.objects["sleep__pale oak"]
    offset = NEW_TABLE - OLD_TABLE
    table.matrix_world = Matrix.Translation(offset) @ table.matrix_world
    linen = scene.objects["sleep__linen"]
    inverse = linen.matrix_world.inverted()
    moved = 0
    for vertex in linen.data.vertices:
        p = linen.matrix_world @ vertex.co
        if -5.92 < p.x < -5.62 and -6.10 < p.y < -5.80 and 2.13 < p.z < 2.53:
            vertex.co = inverse @ (p + offset)
            moved += 1
    if moved != 222:
        raise RuntimeError(f"Bedside shade selection expected 222 vertices. Found {moved}.")
    linen.data.update()
    # The actual picture clears the new opening and remains in the bedroom.
    old = Vector((-5.28, -7.0, 2.45))
    new = Vector((-6.77, -8.474, 2.82))
    transform = Matrix.Translation(new) @ Matrix.Rotation(-math.pi / 2, 4, "Z") @ Matrix.Translation(-old)
    art = []
    for obj in tuple(scene.objects):
        if obj.type == "MESH" and obj.name.startswith("sleep_decor "):
            obj.matrix_world = transform @ obj.matrix_world
            art.append(obj.name)
    if len(art) != 5:
        raise RuntimeError(f"Expected five retained art material batches, found {len(art)}.")
    return {"table": position(NEW_TABLE), "practicalSource": position(NEW_TABLE + Vector((0, 0, 0.83))), "wallArt": art}


def clear_bedroom_walk(scene):
    """Tuck free hems of the unoccupied cover and keep the pot in the window corner."""
    cover = scene.objects["sleep_duvet_empty"]
    inverse = cover.matrix_world.inverted()
    moved = 0
    old_points = [cover.matrix_world @ v.co for v in cover.data.vertices]
    for vertex, p in zip(cover.data.vertices, old_points):
        x, y, h = p
        if x > -6.20:
            x = -6.20 + 0.49 * (x + 6.20)
            if h < 1.875 and p.x > -6.03:
                x = max(x, -6.023)
        if y < -7.56:
            y = -7.56 + 0.39 * (y + 7.56)
            if h < 1.875 and p.y < -7.755:
                y = min(y, -7.761)
        if (x, y) != (p.x, p.y):
            vertex.co = inverse @ Vector((x, y, h))
            moved += 1
    if not moved:
        raise RuntimeError("The retained made-bed cover lost its hanging free hems.")
    cover.data.update()
    after_points = [cover.matrix_world @ v.co for v in cover.data.vertices]

    before = Vector((-5.65, -4.80, FLOOR))
    after = Vector((-5.445, -4.70, FLOOR))
    transform = Matrix.Translation(after) @ Matrix.Scale(0.65, 4) @ Matrix.Translation(-before)
    for name in ("sleep__terracotta", "sleep__charcoal", "sleep__olive leaf"):
        part = scene.objects[name]
        part.matrix_world = transform @ part.matrix_world
    stems = scene.objects["sleep__honey ash"]
    inverse = stems.matrix_world.inverted()
    stem_vertices = 0
    for v in stems.data.vertices:
        p = stems.matrix_world @ v.co
        if p.y > -5.20:
            v.co = inverse @ transform @ p
            stem_vertices += 1
    if stem_vertices != 462:
        raise RuntimeError(f"The retained plant stem selection expected 462 vertices. Found {stem_vertices}.")
    stems.data.update()
    return {
        "madeBedFreeHemVertices": moved,
        "footHemGainM": min(v.y for v in after_points) - min(v.y for v in old_points),
        "eastHemGainM": max(v.x for v in old_points) - max(v.x for v in after_points),
        "retainedPot": position(after),
        "retainedPotScale": 0.65,
        "retainedStemVertices": stem_vertices,
    }


def wool_material():
    surface = material("sleep fit oatmeal woven wool", (0.43, 0.34, 0.24), 0.95)
    if surface.node_tree.nodes.get("Woven wool colour"):
        return surface
    size = 64
    image = bpy.data.images.new("Bedroom wool weave · packed", width=size, height=size, alpha=False)
    pixels = []
    for j in range(size):
        for i in range(size):
            over = (0.5 + 0.5 * math.sin(i * math.tau / 4)) * (0.5 + 0.5 * math.cos(j * math.tau / 4))
            warp = 0.028 * math.sin(i * math.tau / 4)
            fleck = 0.018 * math.sin((3 * i + 5 * j) * 1.618)
            pixels.extend(
                (
                    0.43 + warp + fleck + 0.06 * over,
                    0.34 + warp + fleck + 0.052 * over,
                    0.24 + warp + fleck + 0.043 * over,
                    1,
                )
            )
    image.pixels.foreach_set(pixels)
    image.pack()
    nodes = surface.node_tree.nodes
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = "Woven wool colour"
    texture.image = image
    surface.node_tree.links.new(texture.outputs["Color"], nodes.get("Principled BSDF").inputs["Base Color"])
    return surface


def chair_and_rug(scene, oak, linen):
    at = CHAIR_AT.copy()
    transform = Matrix.Translation(at) @ Matrix.Rotation(CHAIR_YAW, 4, "Z")
    local = lambda point: transform @ Vector(point)
    rug_lo = (-6.826, -4.94, FLOOR)
    rug_hi = (-5.856, -3.851, FLOOR + 0.011)
    rug = panel(scene, "sleep_fit_woven_rug", rug_lo, rug_hi, wool_material())
    uv = rug.data.uv_layers.new(name="Wool weave")
    for polygon in rug.data.polygons:
        for index in polygon.loop_indices:
            p = rug.data.vertices[rug.data.loops[index].vertex_index].co
            uv.data[index].uv = ((p.x - rug_lo[0]) * 7.4, (p.y - rug_lo[1]) * 7.4)
    spots = []
    for index, (x, y) in enumerate(((-0.265, -0.230), (0.265, -0.230), (-0.265, 0.204), (0.265, 0.204)), 1):
        foot = 0.011
        spots.append(local((x, y, foot)))
        bench_panel(
            scene,
            f"sleep_fit_reading_foot_{index}",
            (x, y, (0.395 + foot) / 2),
            (0.052, 0.056, 0.395 - foot),
            oak,
            0.009,
            transform,
        )
    bench_panel(scene, "sleep_fit_reading_seat", (0, -0.025, 0.388), (0.650, 0.602, 0.062), oak, 0.027, transform)
    bench_panel(scene, "sleep_fit_reading_cushion", (0, 0.008, 0.437), (0.567, 0.527, 0.055), linen, 0.045, transform)
    for x in (-0.270, 0.270):
        label = "west" if x < 0 else "east"
        rail(
            scene,
            f"sleep_fit_reading_back_{label}",
            [local((x, -0.278, 0.385)), local((x, -0.302, 0.651)), local((x, -0.341, 0.979))],
            0.026,
            oak,
            6,
        )
    bench_panel(
        scene, "sleep_fit_reading_back_panel", (0, -0.311, 0.788), (0.545, 0.057, 0.335), linen, 0.022, transform
    )
    arm = [
        (0.313, 0.157, 0.433),
        (0.316, 0.202, 0.470),
        (0.321, 0.218, 0.531),
        (0.322, 0.195, 0.601),
        (0.320, 0.129, 0.647),
        (0.317, 0.018, 0.659),
        (0.313, -0.115, 0.651),
        (0.306, -0.243, 0.638),
        (0.280, -0.304, 0.645),
    ]
    rail(scene, "sleep_fit_reading_curled_arm", [local(p) for p in arm], 0.025, oak, 6)
    ledge = (0.347, -0.037, 0.677)
    bench_panel(scene, "sleep_fit_reading_book_ledge", ledge, (0.164, 0.286, 0.027), oak, 0.021, transform)
    front = transform.to_3x3() @ Vector((0, 1, 0))
    facing = math.atan2(front.x, -front.y)
    return {
        "facingWebYaw": facing,
        "rotationNativeZ": CHAIR_YAW,
        "forwardNative": list(front),
        "floor": position(at),
        "seat": position(local((0, -0.047, 0.4645))),
        "readingEye": position(local((0, -0.091, 1.205))),
        "handsLedge": position(local((ledge[0], ledge[1], ledge[2] + 0.0135))),
        "footTargets": [position(local((x, 0.382, 0.011))) for x in (-0.118, 0.118)],
        "chairBearing": [position(q) for q in spots],
        "nativeSources": {
            "seat": "sleep_fit_reading_cushion",
            "rug": "sleep_fit_woven_rug",
            "ledge": "sleep_fit_reading_book_ledge",
        },
    }


def bedside_niche(scene, plaster, bronze, glow, clay, leaf, stem):
    # Frame and sill stand forward of the retained liner to make a real usable recess.
    # Both ends and the header are closed. The actual east liner is its visible back.
    x0, x1 = -5.399, -5.25
    y0, y1 = -6.443, -5.242
    floor, top = 2.544, 3.157
    rim = 0.051
    panel(scene, "sleep_fit_niche_sill", (x0, y0, floor), (x1, y1, floor + rim), plaster)
    panel(scene, "sleep_fit_niche_header", (x0, y0, top - rim), (x1, y1, top), plaster)
    panel(scene, "sleep_fit_niche_inland", (x0, y0, floor + rim), (x1, y0 + rim, top - rim), plaster)
    panel(scene, "sleep_fit_niche_seaward", (x0, y1 - rim, floor + rim), (x1, y1, top - rim), plaster)
    sources = []
    for label, y in (("inland", -6.209), ("seaward", -5.511)):
        mount = Vector((-5.302, y, 2.985))
        aim = Vector((-6.65, -5.855, 2.178))
        direction = (aim - mount).normalized()
        nose = mount + direction * 0.061
        rail(scene, f"sleep_fit_reading_mount_{label}", [mount + Vector((0.048, 0, 0)), mount], 0.031, bronze, 8)
        rail(scene, f"sleep_fit_reading_lamp_{label}", [mount, nose], 0.041, bronze, 8)
        rail(
            scene,
            f"sleep_fit_reading_glow_{label}",
            [nose + direction * 0.002, nose + direction * 0.008],
            0.032,
            glow,
            8,
        )
        sources.append(
            {
                "id": f"bedchamber-reading-{label}",
                "position": position(nose + direction * 0.009),
                "aimAt": position(aim),
                "temperatureK": 2400,
                "emitterRadius": 0.032,
                "receiverGroup": "bedchamber",
            }
        )
    plant = Vector((-5.331, -5.337, 2.595))
    rail(
        scene, "sleep_fit_niche_planter", [plant + Vector((0, 0, 0.002)), plant + Vector((0, 0, 0.092))], 0.047, clay, 9
    )
    shoot = [
        plant + Vector(p)
        for p in (
            (0, 0, 0.078),
            (-0.037, 0.004, 0.065),
            (-0.082, -0.015, 0.052),
            (-0.096, -0.044, 0.001),
            (-0.102, -0.050, -0.052),
            (-0.112, -0.066, -0.103),
            (-0.126, -0.076, -0.149),
        )
    ]
    rail(scene, "sleep_fit_niche_trailing_stem", shoot, 0.0032, stem, 5)
    leaves = []
    for index, q in enumerate(shoot[1:], 1):
        side = (-1) ** index
        for scale in (0.8, 1.1):
            start = q + Vector((0, 0.004 * side, 0))
            tip = start + Vector((-0.012, 0.041 * side, -0.031)) * scale
            cross = Vector((0.013, 0.004 * side, -0.004)) * scale
            mid = start.lerp(tip, 0.47)
            leaves.append((start, mid + cross, tip, mid - cross, mid + Vector((-0.007, 0, 0.004))))
    points = [v for polygon in leaves for v in polygon]
    faces = [
        tuple(5 * i + j for j in triangle)
        for i in range(len(leaves))
        for triangle in ((0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4))
    ]
    make_mesh(scene, "sleep_fit_niche_trailing_leaves", points, faces, leaf)
    return {
        "lights": sources,
        "nicheClearM": [round(x1 - x0, 3), round(y1 - y0 - 2 * rim, 3), round(top - floor - 2 * rim, 3)],
        "plantPotBearing": position(plant),
    }


def install_bedroom_fit(scene=None):
    scene = scene or bpy.context.scene
    if any(o.name.startswith(("sleep_fit_", "core_bedroom_fit_")) for o in scene.objects):
        raise RuntimeError("Start with the retained bedroom. This fitting is already present.")
    oak = material("pale oak", (0.52, 0.367, 0.226))
    stone = material("warm cut stone", (0.438, 0.365, 0.281))
    plaster = material("chalk limestone", (0.642, 0.575, 0.470), 0.92)
    bronze = material("brushed brass", (0.336, 0.244, 0.141), 0.45, 0.72)
    linen = material("sleep fit oatmeal linen", (0.477, 0.410, 0.318), 0.92)
    mirror = material("sleep fit dressing mirror", (0.72, 0.76, 0.77), 0.06, 0.96)
    glow = material("sleep fit amber opal", (0.89, 0.613, 0.327), 0.38)
    shader = glow.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Emission Color"].default_value = (1, 0.652, 0.312, 1)
    shader.inputs["Emission Strength"].default_value = 2.0
    clay = material("terracotta", (0.41, 0.181, 0.089), 0.8)
    leaf = material("sleep fit quiet vine", (0.129, 0.231, 0.081), 0.85)
    stem = material("sleep fit vine stem", (0.157, 0.166, 0.070), 0.81)
    wall = cut_wall(scene, plaster)
    dressing = make_bay(scene, oak, stone, plaster, bronze, mirror)
    retained = move_old_fittings(scene)
    walking = clear_bedroom_walk(scene)
    reading = chair_and_rug(scene, oak, linen)
    niche = bedside_niche(scene, plaster, bronze, glow, clay, leaf, stem)
    bpy.context.view_layer.update()
    authored = [o for o in scene.objects if o.name.startswith(("sleep_fit_", "core_bedroom_fit_"))]
    for obj in authored:
        obj["installationGroup"] = "bedchamber"
        if obj.name.startswith("sleep_fit_reading_glow_"):
            obj["installationGlow"] = "bedchamber-reading"
        obj.data.calc_loop_triangles()
    return {
        "dressing": dressing,
        "reading": reading,
        "niche": niche,
        "retainedFittings": retained,
        "walkFit": walking,
        "modifiedShellWall": wall,
        "newNativeTriangles": sum(len(obj.data.loop_triangles) for obj in authored),
        "newObjects": [obj.name for obj in authored],
    }


if __name__ == "__main__":
    install_bedroom_fit()
    output = next(value.split("=", 1)[1] for value in sys.argv if value.startswith("--save-as="))
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(output).resolve()), compress=True)
