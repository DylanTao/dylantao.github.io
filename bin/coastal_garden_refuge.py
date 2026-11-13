"""A court garden for the bay under the bedroom.

The bay is 2.98 m wide, 2.9 m deep and only 1.54 m high, open to the pool terrace one step up.
Nobody stands in it, so it is built the way a Japanese house treats such a pocket: a tsubo-niwa,
a small garden made to be looked into and sat down in. A low timber deck carries floor cushions,
a tea table and a standing paper lantern; ferns, cast-iron plants and moss fill the back and the
west side; stepping stones lead in from the terrace past a stone basin.

Everything is additive. No rock is cut and no existing object moves. The objects carry the
kitchen prefix because the bay continues the breakfast nook next door, and because a room model
can be exported without touching the shell.

The lantern is the garden's one light. Its lamp is an authored installation point in
assets/models/home/manifest.json (installationPoints, id "tea-garden-lantern") at LANTERN_LAMP
below; the objects here carry the two custom properties the web scene reads for it
(light-installations.mjs): installationGroup, so the garden is lit with the terrace it opens onto,
and installationGlow on the paper, so the shade glows on the lamp's schedule.

Preview (writes PNGs, saves nothing):
    blender -b --factory-startup artwork/coastal-home/coastal-home.blend \
        --python bin/coastal_garden_refuge.py -- --preview=<directory>
Install into the opened file (saves it; refuses a second run):
    blender -b --factory-startup --python-exit-code 1 artwork/coastal-home/coastal-home.blend \
        --python bin/coastal_garden_refuge.py -- --install
"""

import math
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

VERSION = 1
PREFIX = "kitchen_garden"
ORIGIN = Vector((0.0, -8.0, 0.0))  # the kitchen room's object origin
SEED = 20261113

# The bay, in the house file's metres (x east, y toward the sea, z up), from ray casts on
# coastal-home.blend cb531e38: floor -0.2, slab underside 1.34, terrace paving 0.001.
WEST, EAST = -8.43, -5.45
BACK, FRONT = -6.30, -3.40
FLOOR, CEILING = -0.20, 1.34
STAIR_EAST, STAIR_FRONT = -8.04, -5.05  # the spiral stair's base occupies the back-west corner
CLEAR = 0.002  # things rest this far above what carries them: no crossing, no coincident faces
GRAVEL_TOP = FLOOR + 0.015
DECK_TOP = FLOOR + 0.12
HEADROOM = CEILING - 0.14  # nothing grows closer to the slab than this

MATERIALS = {
    "gravel": "honed travertine",
    "deck": "pale oak",
    "frame": "honey ash",
    "stone": "warm cut stone",
    "futon": "linen",
    "bolster_warm": "terracotta",
    "bolster_cool": "indigo textile",
    "cushion_sun": "linen canvas sun",
    "cushion_sage": "sage textile",
    "glaze": "celadon glaze",
    "water": "bathroom celadon ceramic",
    "fern": "interior Asplenium fern leaf",
    "broadleaf": "interior Strelitzia broadleaf",
    "stem": "interior botanical leaf stem",
    "moss": "interior Epipremnum leaf",
    "moss_dark": "dark sage leaf",
    "paper": "garden lantern paper",
}

# The lantern stands on the deck's west edge, between the two cushions and across the tea table
# from the futon, so its lamp is higher than every seat and within a metre of each of them.
LANTERN = (-7.27, -4.63)
LANTERN_HALF, LANTERN_TALL, LANTERN_SHADE = 0.115, 0.78, 0.40  # half width, height, where the paper starts
LANTERN_LAMP = (LANTERN[0], LANTERN[1], DECK_TOP + (LANTERN_SHADE + LANTERN_TALL - 0.038) / 2)  # the middle of the paper
# The paper is the living room's washi with a warmer lamp behind it. Its own name keeps the two
# lanterns on their own schedules; the web scene scales this emission by the lamp's level.
LANTERN_PAPER_SOURCE = "washi lantern paper"
# Chosen from evening frames on November 13: at the lamp's night level this prints as a warm peach
# shade. The living room's paler washi, at the same level, saturates to a white box.
LANTERN_EMISSION, LANTERN_EMISSION_STRENGTH = (1.0, 0.5, 0.2), 0.6
RECEIVER_GROUP = "exterior"
GLOW_TAG = "tea-garden"


class Parts:
    """One bmesh per material, so the room gains one object per material like its neighbours."""

    def __init__(self):
        self.meshes = {}

    def of(self, role):
        name = MATERIALS[role]
        if name not in self.meshes:
            self.meshes[name] = bmesh.new()
        return self.meshes[name]

    def triangles(self):
        total = 0
        for bm in self.meshes.values():
            total += sum(len(face.verts) - 2 for face in bm.faces)
        return total


def box(bm, lo, hi, bevel=0.0, segments=2, smooth=False):
    lo, hi = Vector(lo), Vector(hi)
    made = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    size, centre = hi - lo, (lo + hi) / 2
    for vert in made:
        vert.co = Vector((vert.co.x * size.x, vert.co.y * size.y, vert.co.z * size.z)) + centre
    faces = {face for vert in made for face in vert.link_faces}
    if bevel > 0:
        edges = {edge for face in faces for edge in face.edges}
        result = bmesh.ops.bevel(bm, geom=list(edges), offset=bevel, segments=segments, profile=0.5, affect="EDGES")
        faces = set(result["faces"]) | {face for face in faces if face.is_valid}
    for face in faces:
        if face.is_valid:
            face.smooth = smooth
    return faces


def cylinder(bm, centre, radius, height, segments=16, top_radius=None, smooth=True, caps=True):
    made = bmesh.ops.create_cone(
        bm,
        cap_ends=caps,
        cap_tris=False,
        segments=segments,
        radius1=radius,
        radius2=radius if top_radius is None else top_radius,
        depth=height,
        matrix=Matrix.Translation(Vector(centre) + Vector((0, 0, height / 2))),
    )["verts"]
    for face in {face for vert in made for face in vert.link_faces}:
        face.smooth = smooth and len(face.verts) == 4
    return made


def blob(bm, centre, radii, rng, wobble=0.08, dome=False, subdivisions=2):
    """A rounded stone, or with `dome` the top half of one: a moss mound open underneath."""
    made = bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1.0)["verts"]
    if dome:
        bmesh.ops.delete(bm, geom=[vert for vert in made if vert.co.z < -0.02], context="VERTS")
        made = [vert for vert in made if vert.is_valid]
    for vert in made:
        swell = 1.0 + wobble * (rng.random() - 0.5) * 2
        vert.co = Vector((vert.co.x * radii[0] * swell, vert.co.y * radii[1] * swell, max(vert.co.z, 0.0 if dome else -1.0) * radii[2])) + Vector(centre)
    for face in {face for vert in made for face in vert.link_faces}:
        face.smooth = True


def leaf(bm, root, heading, length, width, rise, arch, fold=0.18, stations=6, stalk=0.0):
    """A strap leaf rooted at `root`: it leaves at `rise` degrees above level and arches over by
    `arch` degrees toward its tip. Three points across, folded along the midrib."""
    forward = Vector((math.cos(heading), math.sin(heading), 0.0))
    side = Vector((-forward.y, forward.x, 0.0))
    point = Vector(root)
    rows = []
    step = (length + stalk) / stations
    for i in range(stations + 1):
        t = i / stations
        along = t * (length + stalk)
        blade = min(1.0, max(0.0, (along - stalk) / length)) if length > 0 else 0.0
        elevation = math.radians(rise - arch * t * t)
        # A lance: widest two fifths of the way up, drawn to a point; a stalk stays a thread.
        half = 0.5 * width * max(0.0, math.sin(math.pi * blade**0.72)) ** 0.85 + 0.006
        crease = fold * half
        if point.z > HEADROOM:
            point.z = HEADROOM
        rows.append(
            (
                bm.verts.new(point - side * half + Vector((0, 0, crease))),
                bm.verts.new(point),
                bm.verts.new(point + side * half + Vector((0, 0, crease))),
            )
        )
        point = point + (forward * math.cos(elevation) + Vector((0, 0, math.sin(elevation)))) * step
    for a, b in zip(rows, rows[1:]):
        for face in (bm.faces.new((a[0], a[1], b[1], b[0])), bm.faces.new((a[1], a[2], b[2], b[1]))):
            face.smooth = True


def fern(parts, at, rng, leaves=9, reach=0.5):
    for i in range(leaves):
        heading = 2 * math.pi * (i + rng.random() * 0.6) / leaves
        leaf(
            parts.of("fern"),
            Vector(at) + Vector((math.cos(heading), math.sin(heading), 0)) * 0.02,
            heading,
            length=reach * rng.uniform(0.72, 1.08),
            width=reach * rng.uniform(0.2, 0.27),
            rise=rng.uniform(52, 78),
            arch=rng.uniform(58, 96),
        )


def cast_iron_plant(parts, at, rng, leaves=7, height=0.7):
    for i in range(leaves):
        heading = 2 * math.pi * (i + rng.random() * 0.8) / leaves
        leaf(
            parts.of("broadleaf"),
            Vector(at) + Vector((math.cos(heading), math.sin(heading), 0)) * rng.uniform(0.01, 0.05),
            heading,
            length=height * rng.uniform(0.55, 0.72),
            width=height * rng.uniform(0.24, 0.31),
            rise=rng.uniform(72, 86),
            arch=rng.uniform(34, 64),
            fold=0.3,
            stalk=height * rng.uniform(0.28, 0.4),
        )


def build_parts():
    rng = random.Random(SEED)
    parts = Parts()
    ground = GRAVEL_TOP + CLEAR

    # Pale gravel over the rock floor, stepped around the stair's base.
    box(parts.of("gravel"), (STAIR_EAST, BACK + 0.01, FLOOR + CLEAR), (EAST - 0.01, FRONT - 0.03, GRAVEL_TOP))
    box(parts.of("gravel"), (WEST + 0.01, STAIR_FRONT, FLOOR + CLEAR), (STAIR_EAST, FRONT - 0.03, GRAVEL_TOP))

    # A low deck of seven boards, running back from the terrace along the east wall.
    deck_west, deck_east, deck_back, deck_front = -7.42, -5.50, -5.62, -3.72
    boards, gap = 7, 0.006
    pitch = (deck_east - deck_west) / boards
    for i in range(boards):
        box(
            parts.of("deck"),
            (deck_west + i * pitch + gap / 2, deck_back, ground),
            (deck_west + (i + 1) * pitch - gap / 2, deck_front, DECK_TOP),
            bevel=0.004,
            segments=1,
        )
    on_deck = DECK_TOP + CLEAR

    # Somewhere to stay: a futon along the wall with two bolsters to lean on, two floor cushions,
    # and a tea table between them.
    box(parts.of("futon"), (-6.30, -5.42, on_deck), (-5.56, -3.92, on_deck + 0.11), bevel=0.045, segments=3, smooth=True)
    for role, y in (("bolster_warm", -5.02), ("bolster_cool", -4.30)):
        made = box(parts.of(role), (-5.74, y - 0.33, on_deck + 0.112), (-5.56, y + 0.33, on_deck + 0.47), bevel=0.07, segments=3, smooth=True)
        verts = {vert for face in made for vert in face.verts}
        lean = Matrix.Rotation(math.radians(-11), 4, "Y")
        pivot = Vector((-5.56, y, on_deck + 0.112))
        for vert in verts:
            vert.co = lean @ (vert.co - pivot) + pivot
    for role, centre in (("cushion_sun", (-6.98, -5.08)), ("cushion_sage", (-7.02, -4.18))):
        made = cylinder(parts.of(role), (centre[0], centre[1], on_deck), 0.27, 0.11, segments=18)
        rim = [edge for edge in {edge for vert in made for edge in vert.link_edges} if abs(edge.verts[0].co.z - edge.verts[1].co.z) < 1e-6]
        result = bmesh.ops.bevel(parts.of(role), geom=rim, offset=0.04, segments=3, profile=0.5, affect="EDGES")
        for face in result["faces"]:
            face.smooth = True
    table = (-6.72, -4.64)
    cylinder(parts.of("frame"), (table[0], table[1], on_deck), 0.09, 0.2, segments=12)
    cylinder(parts.of("deck"), (table[0], table[1], on_deck + 0.2 + CLEAR), 0.31, 0.028, segments=24)
    top = on_deck + 0.228 + 2 * CLEAR
    cylinder(parts.of("glaze"), (table[0] - 0.07, table[1] + 0.03, top), 0.062, 0.075, segments=12, top_radius=0.05)
    cylinder(parts.of("glaze"), (table[0] - 0.07, table[1] + 0.03, top + 0.075), 0.03, 0.022, segments=10, top_radius=0.012)
    for dx, dy in ((0.1, -0.08), (0.13, 0.09)):
        cylinder(parts.of("glaze"), (table[0] + dx, table[1] + dy, top), 0.03, 0.042, segments=10, top_radius=0.036)

    # Stepping stones from the terrace to the deck, a basin, and two stones to anchor the planting.
    for centre, radii in (((-7.84, -3.78), (0.25, 0.2, 0.035)), ((-7.78, -4.38), (0.24, 0.2, 0.03)), ((-7.66, -4.98), (0.2, 0.23, 0.032))):
        blob(parts.of("stone"), (centre[0], centre[1], ground + radii[2]), radii, rng, wobble=0.05)
    basin = (-7.80, -5.72)
    cylinder(parts.of("stone"), (basin[0], basin[1], ground), 0.2, 0.3, segments=14, top_radius=0.215)
    cylinder(parts.of("water"), (basin[0], basin[1], ground + 0.3 + CLEAR), 0.15, 0.006, segments=14)
    blob(parts.of("stone"), (-6.05, -6.02, ground + 0.11), (0.2, 0.15, 0.13), rng, wobble=0.12)

    # Shade planting: ferns and cast-iron plants along the back wall and the west side, moss between.
    for at, reach in (((-7.42, -6.04), 0.52), ((-6.62, -6.08), 0.46), ((-5.74, -5.9), 0.42), ((-8.16, -4.66), 0.44), ((-7.72, -3.66), 0.34), ((-7.5, -5.74), 0.36)):
        fern(parts, (at[0], at[1], ground), rng, leaves=9, reach=reach)
    for at, height in (((-7.02, -6.14), 0.84), ((-6.2, -6.16), 0.72), ((-8.24, -5.02), 0.6)):
        cast_iron_plant(parts, (at[0], at[1], ground), rng, leaves=6, height=height)
    for role, centre, radii in (
        ("moss", (-7.78, -5.3), (0.26, 0.2, 0.09)),
        ("moss_dark", (-7.2, -5.86), (0.22, 0.17, 0.08)),
        ("moss", (-6.4, -5.86), (0.2, 0.15, 0.07)),
        ("moss_dark", (-8.18, -4.42), (0.17, 0.2, 0.07)),
        ("moss", (-8.2, -4.06), (0.15, 0.18, 0.06)),
        ("moss", (-7.52, -3.98), (0.2, 0.14, 0.05)),
        ("moss_dark", (-5.86, -5.72), (0.16, 0.13, 0.06)),
    ):
        blob(parts.of(role), (centre[0], centre[1], ground), radii, rng, wobble=0.1, dome=True)

    # A standing paper lantern (an andon): four slender posts, a stretcher near the deck, and a
    # paper shade held between two timber plates. Every part keeps a gap from the next, so the
    # paper never shares a plane with the frame.
    lx, ly = LANTERN
    half, post = LANTERN_HALF, 0.011
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = lx + sx * half, ly + sy * half
            box(parts.of("frame"), (x - post, y - post, on_deck), (x + post, y + post, DECK_TOP + LANTERN_TALL))
    for z in (DECK_TOP + 0.11, DECK_TOP + LANTERN_SHADE - 0.016, DECK_TOP + LANTERN_TALL - 0.036):
        box(parts.of("frame"), (lx - half + post + CLEAR, ly - half + post + CLEAR, z), (lx + half - post - CLEAR, ly + half - post - CLEAR, z + 0.014))
    box(
        parts.of("paper"),
        (lx - half + post + 0.004, ly - half + post + 0.004, DECK_TOP + LANTERN_SHADE),
        (lx + half - post - 0.004, ly + half - post - 0.004, DECK_TOP + LANTERN_TALL - 0.038),
    )

    # Leaves press against the walls they meet and stones sit flat; nothing passes through rock.
    inset = 0.014
    for bm in parts.meshes.values():
        for vert in bm.verts:
            vert.co.x = min(max(vert.co.x, WEST + inset), EAST - inset)
            vert.co.y = min(max(vert.co.y, BACK + inset), FRONT - 0.03)
            vert.co.z = min(max(vert.co.z, FLOOR + CLEAR), HEADROOM)
    return parts


def lantern_paper():
    name = MATERIALS["paper"]
    material = bpy.data.materials.get(name)
    if material is not None:
        return material
    source = bpy.data.materials.get(LANTERN_PAPER_SOURCE)
    if source is None:
        raise RuntimeError(f"the house file has no material named {LANTERN_PAPER_SOURCE!r}")
    material = source.copy()
    material.name = name
    shader = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Emission Color"].default_value = (*LANTERN_EMISSION, 1.0)
    shader.inputs["Emission Strength"].default_value = LANTERN_EMISSION_STRENGTH
    return material


def install(scene=None):
    scene = scene or bpy.context.scene
    if scene.get("gardenRefugeVersion") or any(ob.name.startswith(PREFIX) for ob in bpy.data.objects):
        raise RuntimeError("the garden refuge is already in this file")
    parts = build_parts()
    lantern_paper()
    made = []
    for material_name, bm in sorted(parts.meshes.items()):
        material = bpy.data.materials.get(material_name)
        if material is None:
            raise RuntimeError(f"the house file has no material named {material_name!r}")
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        for vert in bm.verts:
            vert.co -= ORIGIN
        bm.normal_update()
        mesh = bpy.data.meshes.new(f"{PREFIX}__{material_name}")
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(material)
        ob = bpy.data.objects.new(f"{PREFIX}__{material_name}", mesh)
        ob.location = ORIGIN
        ob["gardenRefuge"] = VERSION
        ob["installationGroup"] = RECEIVER_GROUP
        if material_name == MATERIALS["paper"]:
            ob["installationGlow"] = GLOW_TAG
        scene.collection.objects.link(ob)
        made.append(ob)
    scene["gardenRefugeVersion"] = VERSION
    bpy.context.view_layer.update()
    return made


def bounds(objects):
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for ob in objects:
        for corner in ob.bound_box:
            point = ob.matrix_world @ Vector(corner)
            lo = Vector(map(min, lo, point))
            hi = Vector(map(max, hi, point))
    return lo, hi


def report(objects):
    lo, hi = bounds(objects)
    triangles = sum(len(ob.data.polygons) for ob in objects)
    assert lo.x >= WEST and hi.x <= EAST and lo.y >= BACK and hi.y <= FRONT, (lo, hi)
    assert lo.z >= FLOOR and hi.z <= CEILING - 0.1, (lo.z, hi.z)
    print(f"GARDEN objects={len(objects)} triangles={triangles} min={tuple(round(v, 3) for v in lo)} max={tuple(round(v, 3) for v in hi)}")
    # The lamp in the web scene's coordinates (x, height, -y), for the manifest's installation point.
    print(f"GARDEN lantern lamp web position={[round(LANTERN_LAMP[0], 3), round(LANTERN_LAMP[2], 3), round(-LANTERN_LAMP[1], 3)]}")
    for ob in objects:
        print(f"GARDEN   {ob.name}: {len(ob.data.polygons)} triangles")
    return triangles


def preview(directory):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light, shading.color_type = "STUDIO", "MATERIAL"
    shading.show_shadows, shading.shadow_intensity = True, 0.3
    shading.show_cavity, shading.cavity_type = True, "BOTH"
    scene.display.render_aa = "8"
    scene.render.resolution_x, scene.render.resolution_y = 1600, 900
    data = bpy.data.cameras.new("garden_preview")
    camera = bpy.data.objects.new("garden_preview", data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    for name, eye, at, lens in (
        ("garden-from-pool", (-3.6, 3.2, 3.4), (-6.9, -4.6, 0.1), 40),
        ("garden-front", (-6.94, 0.6, 0.85), (-6.94, -5.2, 0.3), 24),
        ("garden-close", (-7.6, -2.5, 0.75), (-6.5, -5.4, 0.2), 22),
        ("garden-plan", (-6.94, -4.85, 1.3), (-6.94, -4.86, 0.0), 14),
    ):
        camera.location = eye
        camera.rotation_euler = (Vector(at) - Vector(eye)).to_track_quat("-Z", "Y").to_euler()
        data.lens, data.clip_start, data.clip_end = lens, 0.03, 300
        scene.render.filepath = f"{directory}/{name}.png"
        bpy.ops.render.render(write_still=True)


def main():
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    objects = install()
    report(objects)
    for argument in arguments:
        if argument.startswith("--preview="):
            preview(argument.split("=", 1)[1])
            print("GARDEN preview only; nothing saved")
            return
    if "--install" in arguments:
        bpy.ops.wm.save_mainfile()
        print("GARDEN installed and saved")
    else:
        print("GARDEN built in memory; pass --install to save or --preview=<directory> to look")


if __name__ == "__main__":
    main()
