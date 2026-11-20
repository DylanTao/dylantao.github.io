"""Build the listening bar at the seaward end of the study's existing BBQ loggia.

Native coordinates in metres. Positive Y leads from the library, across the
dining terrace, through the bar to the lift. The rock roof stays in place.
"""

import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import coastal_decor as decor
import coastal_listening_joinery as listening
from coastal_listening_roundel import fit_roundel
from coastal_office import box, cylinder, lathe
from coastal_shell import boolean_preserving_islands

PREFIX = "core_speakeasy_"
OAK = "bar smoked oak"
LINING = "bar umber lime plaster"
CEILING = "bar pale clay vault"
STONE = "bar green limestone"
WOOL = "bar moss mohair"
HIDE = "bar saddle leather"
BRASS = "brushed brass"
STEEL = "dark bronze"
LAMP = "bar opal strip"
AMBER = "bar amber bottle"
GREEN = "bar olive bottle"
PAPER = "bar uncoated paper"
GLASS = "facade low-iron glass"


class Joinery:
    """Each installation with shared motion and finish is one exported mesh."""

    def __init__(self, prefix, group):
        self.prefix = prefix
        self.group = group
        self.meshes = {}

    def mesh(self, piece, finish):
        key = (piece, finish)
        if key not in self.meshes:
            self.meshes[key] = bmesh.new()
        return self.meshes[key]

    def block(self, piece, finish, low, high, bevel=0):
        lo, hi = Vector(low), Vector(high)
        box(self.mesh(piece, finish), (lo + hi) / 2, hi - lo, bevel, segments=2 if bevel >= 0.025 else 1)

    def span(self, piece, finish, a, b, radius, sides=8, tip=None):
        cylinder(self.mesh(piece, finish), a, b, radius, sides, radius2=tip)

    def turned(self, piece, finish, base, profile, sides=16):
        lathe(self.mesh(piece, finish), profile, base, sides)

    def set_out(self, matrix):
        for bm in self.meshes.values():
            bmesh.ops.transform(bm, matrix=matrix, verts=list(bm.verts))

    def finish(self, pieces=None):
        result = []
        for (piece, material), bm in self.meshes.items():
            if pieces is not None and piece not in pieces:
                bm.free()
                continue
            smooth = [face.smooth for face in bm.faces]
            obj = decor.from_bmesh(
                self.prefix + piece + "__" + material, bm, bpy.data.materials[material], smooth=False
            )
            obj.data.polygons.foreach_set("use_smooth", smooth)
            obj["installationGroup"] = self.group
            result.append((piece, obj))
        return result


def finishes():
    decor.material(OAK, (0.139, 0.081, 0.054), 0.61)
    decor.material(LINING, (0.402, 0.344, 0.271), 0.93, refresh=True)
    decor.material(CEILING, (0.505, 0.365, 0.275), 0.96)
    decor.material(STONE, (0.106, 0.156, 0.141), 0.40)
    decor.material(WOOL, (0.157, 0.213, 0.165), 0.95)
    decor.material(HIDE, (0.351, 0.205, 0.135), 0.67)
    decor.material(PAPER, (0.69, 0.62, 0.46), 0.95)
    for name, colour in ((AMBER, (0.46, 0.181, 0.043)), (GREEN, (0.123, 0.203, 0.128))):
        mat = decor.material(name, colour, 0.17)
        # The amber body takes the shelf light. A conservative transmission is
        # enough to catch a meniscus without another full-screen glass pane.
        mat.node_tree.nodes["Principled BSDF"].inputs["Transmission Weight"].default_value = 0.22
    lamp = decor.material(LAMP, (0.89, 0.69, 0.43), 0.65)
    bsdf = lamp.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Emission Color"].default_value = (1, 0.64, 0.32, 1)
    bsdf.inputs["Emission Strength"].default_value = 0.78
    listening.finishes()


def gable(j, y0, y1):
    """Close the head wall over the splayed stone window and the entrance."""
    bm = j.mesh("gable", LINING)
    sections = []
    for i in range(17):
        # The existing stone jamb owns the west return above the lift.
        x = -12.48 + 4.08 * i / 16
        t = (x + 12.68) / 4.28
        h = 2.28 + 0.47 * (1 - (2 * t - 1) ** 2)
        sections.append([bm.verts.new((x, y, z)) for y, z in ((y0, 2.185), (y1, 2.185), (y1, h), (y0, h))])
    for a, b in zip(sections, sections[1:]):
        for k in range(4):
            bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    bm.faces.new(sections[0])
    bm.faces.new(list(reversed(sections[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))


def ocean_reveal(j):
    """The shallow diagonal side light looks past the headland from the bench."""
    x0, x1 = -8.62, -8.40
    y0, y1 = 8.18, 9.54
    splay = 0.26
    sill, head = 1.02, 1.76
    j.block("walls", LINING, (x0, 6.32, 0.002), (x1, 9.92, sill))
    j.block("walls", listening.CUT_ROCK, (x0, 6.32, head), (x1, 9.92, 2.305))
    bm = j.mesh("window_return", listening.CUT_ROCK)
    for inner, outer in (((6.32, y0), (6.32, y0 + splay)), ((y1, 9.92), (y1 + splay, 9.92))):
        sections = []
        for x, ends in ((x0, inner), (x1, outer)):
            sections.append(
                [
                    bm.verts.new((x, y, z))
                    for y, z in ((ends[0], sill), (ends[1], sill), (ends[1], head), (ends[0], head))
                ]
            )
        a, b = sections
        bm.faces.new(a)
        bm.faces.new(list(reversed(b)))
        for n in range(4):
            bm.faces.new((a[n], a[(n + 1) % 4], b[(n + 1) % 4], b[n]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    j.block("window_sill", OAK, (x0 - 0.025, y0, sill), (x1 - 0.008, y1, sill + 0.024), 0.003)
    j.block(
        "window_sidelight",
        GLASS,
        (x1 - 0.022, y0 + splay, sill + 0.025),
        (x1 - 0.014, y1 + splay - 0.012, head - 0.011),
    )


def architecture(j):
    # Keep a 196 mm stone edge above the separate native shore rock.
    j.block("plinth", "warm cut stone", (-12.70, 6.031, -0.242), (-8.40, 10.16, -0.046))
    j.block("paving", STONE, (-12.40, 6.031, -0.046), (-8.40, 10.16, 0.001))
    for y0, y1 in ((6.031, 8.74), (9.90, 10.16)):
        j.block("paving", STONE, (-12.68, y0, -0.046), (-12.40, y1, 0.001))
    # A real 1.20 m threshold from the table, with a protected corner where
    # somebody sitting in the study cannot see straight through to the stools.
    j.block("walls", LINING, (-12.68, 6.032, 0.002), (-9.64, 6.32, 2.185))
    j.block("walls", LINING, (-8.47, 6.032, 0.002), (-8.40, 6.32, 2.185))
    j.block("lintel", OAK, (-9.64, 6.082, 2.146), (-8.47, 6.31, 2.185), 0.006)
    j.block("vestibule", OAK, (-9.51, 7.32, 0.002), (-8.62, 7.42, 2.136), 0.012)
    j.block("vestibule_roof", OAK, (-9.52, 6.32, 2.136), (-8.62, 7.42, 2.19), 0.009)
    for n in range(13):
        x = -9.47 + n * 0.065
        j.block("entry_reeds", OAK, (x, 7.298, 0.12), (x + 0.022, 7.321, 2.07), 0.004)
    j.block("rock_jamb", listening.CUT_ROCK, (-12.68, 6.32, 0.002), (-12.48, 8.701, 2.305))
    j.block("rock_jamb", listening.CUT_ROCK, (-12.68, 9.938, 0.002), (-12.48, 10.16, 2.305))
    j.block("rock_header", listening.CUT_ROCK, (-12.68, 8.701, 2.155), (-12.48, 9.938, 2.305))
    for y in (8.701, 9.914):
        j.block("lift_reveal", listening.COPPER, (-12.681, y, 0.004), (-12.455, y + 0.022, 2.155), 0.004)
    j.block("lift_reveal", listening.COPPER, (-12.681, 8.720, 2.125), (-12.455, 9.916, 2.154), 0.004)
    j.block("lift_call_plate", STEEL, (-12.479, 8.523, 0.982), (-12.463, 8.628, 1.157), 0.006)
    j.span("lift_call", BRASS, (-12.463, 8.575, 1.077), (-12.452, 8.575, 1.077), 0.024, 16)
    ocean_reveal(j)
    # The seaward end is one deep picture window. The lift is behind the
    # rock jamb to the west, entered directly through the room's copper portal.
    j.block("walls", listening.CUT_ROCK, (-12.48, 9.92, 0.002), (-11.51, 10.16, 2.185))
    # The seaward bay has an offset, level opening onto the fire loggia.
    # Its other half keeps the deep window seat inside the listening room.
    j.block("walls", LINING, (-10.24, 9.92, 0.002), (-8.74, 10.16, 0.75))
    j.block("walls", listening.CUT_ROCK, (-8.74, 9.92, 0.002), (-8.40, 10.16, 2.185))
    j.block("walls", listening.CUT_ROCK, (-10.24, 9.92, 1.835), (-8.74, 10.16, 2.185))
    j.block("walls", listening.CUT_ROCK, (-11.51, 9.92, 2.143), (-10.24, 10.16, 2.185))
    j.block("window_seat", listening.WALNUT, (-10.24, 9.80, 0.75), (-8.74, 10.163, 0.802), 0.013)
    for x in (-10.239, -8.767):
        j.block("window_liner", listening.WALNUT, (x, 9.914, 0.802), (x + 0.026, 10.165, 1.843), 0.003)
    j.block("window_liner", listening.WALNUT, (-10.24, 9.914, 1.81), (-8.74, 10.165, 1.837), 0.004)
    j.block("panorama", GLASS, (-10.210, 10.115, 0.802), (-8.768, 10.125, 1.81))
    gable(j, 6.033, 6.319)
    gable(j, 9.921, 10.16)
    listening.vault(j)
    for x in (-9.66, -8.47):
        j.block("entry_jamb", listening.WALNUT, (x - 0.026, 6.021, 0.002), (x + 0.019, 6.315, 2.177), 0.009)
    j.block("entry_header", listening.WALNUT, (-9.685, 6.018, 2.143), (-8.451, 6.315, 2.203), 0.006)
    j.block("lantern_socket", listening.COPPER, (-9.778, 5.992, 1.238), (-9.689, 6.031, 1.509), 0.011)
    j.block("entry_lantern", listening.PARCHMENT, (-9.760, 5.984, 1.264), (-9.707, 5.994, 1.482), 0.006)


def backbar():
    cabinet = Joinery(PREFIX, "speakeasy")
    listening.cabinet(cabinet)
    # The record wall and the car door share the western rock face. From the
    # sofa a visitor sees the horns, the copper threshold and a slice of sea.
    cabinet.set_out(Matrix(((1, 0, 0, 0), (0, 0.66, 0, 6.35 - 0.66 * 6.36), (0, 0, 1, 0), (0, 0, 0, 1))))
    island = Joinery(PREFIX, "speakeasy")
    listening.island(island)
    # Set the island across the listening axis. The guest sees the record
    # spines from the sofa, and there is an open passage to the lift.
    island.set_out(
        Matrix(((0, -0.69, 0, -10.245 + 0.69 * 6.858), (0.92, 0, 0, 7.21 + 0.92 * 11.331), (0, 0, 1, 0), (0, 0, 0, 1)))
    )
    return cabinet.finish() + island.finish()


def shaded_lamp(j, x, y, base):
    j.turned(
        "lamp_base",
        listening.COPPER,
        (x, y, base),
        [(0.064, 0), (0.066, 0.010), (0.046, 0.024), (0.012, 0.037), (0.010, 0.192)],
        18,
    )
    j.turned(
        "parchment",
        listening.PARCHMENT,
        (x, y, base + 0.124),
        [(0.080, 0), (0.086, 0.009), (0.064, 0.111), (0.058, 0.119)],
        24,
    )
    j.turned("lamp_cap", listening.COPPER, (x, y, base + 0.242), [(0.059, 0), (0.061, 0.006), (0.037, 0.012)], 24)


def listening_end(j):
    listening.banquette(j)
    j.turned(
        "small_tables",
        listening.COPPER,
        (-9.37, 8.54, 0.002),
        [(0.145, 0), (0.147, 0.024), (0.026, 0.055), (0.026, 0.455)],
        18,
    )
    j.turned(
        "small_tables",
        listening.WALNUT,
        (-9.37, 8.54, 0.455),
        [(0.220, 0), (0.239, 0.019), (0.239, 0.032), (0.230, 0.040)],
        36,
    )
    shaded_lamp(j, -9.23, 8.56, 0.495)
    shaded_lamp(j, -11.815, 7.22, 1.078)
    # The deck, amplifier and record sleeves occupy the cabinet between the horns.
    x, y, z = -12.207, 7.488, 0.928
    j.block("record_base", listening.WALNUT, (x - 0.254, y - 0.196, z), (x + 0.251, y + 0.197, z + 0.059), 0.009)
    j.turned("platter", STEEL, (x - 0.047, y, z + 0.059), [(0.152, 0), (0.152, 0.015)], 32)
    j.turned("disc", "charcoal", (x - 0.047, y, z + 0.075), [(0.149, 0), (0.149, 0.004)], 36)
    j.turned("label", PAPER, (x - 0.047, y, z + 0.079), [(0.05, 0), (0.05, 0.002)], 24)
    j.span("tonearm", BRASS, (x + 0.152, y + 0.126, z + 0.067), (x + 0.152, y + 0.126, z + 0.105), 0.022, 10)
    j.span("tonearm", BRASS, (x + 0.152, y + 0.126, z + 0.105), (x + 0.042, y + 0.021, z + 0.087), 0.006, 8)
    j.block("tonearm", STEEL, (x + 0.028, y + 0.003, z + 0.080), (x + 0.056, y + 0.032, z + 0.09), 0.002)
    for i in range(4):
        x0 = -12.252 + i * 0.012
        y0 = 6.482 + i * 0.050
        j.block(
            "featured_sleeve" if i == 3 else "record_sleeves",
            (PAPER, WOOL, HIDE, PAPER)[i],
            (x0, y0, 0.955),
            (x0 + 0.008, y0 + 0.216, 1.174),
        )
    j.block("sleeve_ledge", listening.WALNUT, (-12.254, 6.466, 0.929), (-12.203, 6.870, 0.955), 0.003)


def reading_threshold(pieces=None):
    scene = bpy.context.scene
    x0, x1, y = -11.34, -10.04, -0.82
    if not scene.get("studyReadingThresholdCut"):
        tool_mesh = bmesh.new()
        box(tool_mesh, ((x0 + x1) / 2, y, 1.085), (x1 - x0, 0.26, 2.20))
        tool = decor.from_bmesh("study front opening tool", tool_mesh, bpy.data.materials[STEEL])
        bpy.context.view_layer.update()
        for role in ("glazing", "facade"):
            target = next(obj for obj in scene.objects if obj.name.startswith("core_estate_library_" + role + "__"))
            result = boolean_preserving_islands(target, tool)
            if result.get("skippedDisjoint") or result.get("cutNonManifold"):
                raise ValueError(f"Unresolved study threshold in {target.name}: {result}")
        bpy.data.objects.remove(tool, do_unlink=True)
        scene["studyReadingThresholdCut"] = True
    j = Joinery(PREFIX + "study_", "library")
    j.block("floor", "pale oak", (-11.93, -0.79, 0.003), (-9.71, 1.45, 0.031), 0.003)
    j.block("threshold", BRASS, (x0, -0.89, 0.001), (x1, -0.77, 0.013), 0.002)
    for x in (x0 - 0.030, x1):
        j.block("reveal", OAK, (x, -0.919, 0.018), (x + 0.030, -0.697, 2.19), 0.004)
    j.block("reveal", OAK, (x0 - 0.03, -0.919, 2.149), (x1 + 0.03, -0.697, 2.21), 0.004)
    # A two-sided reading pocket shields the study from the barbecue. The
    # seaward opening remains wide enough for a person carrying a tray.
    j.block("nook", LINING, (-11.93, -0.77, 0.033), (-11.82, 1.32, 2.35), 0.008)
    j.block("bench", OAK, (-11.815, -0.51, 0.032), (-11.43, 0.94, 0.405), 0.02)
    j.block("bench", WOOL, (-11.8, -0.50, 0.405), (-11.42, 0.93, 0.476), 0.028)
    j.block("pocket_screen", OAK, (-11.93, 1.32, 0.031), (-10.93, 1.45, 0.91), 0.007)
    for i in range(10):
        x = -11.90 + i * 0.098
        j.block("pocket_screen", OAK, (x, 1.335, 0.91), (x + 0.032, 1.416, 2.35), 0.003)
    j.block("pocket_roof", CEILING, (-11.93, -0.77, 2.35), (-9.71, 1.45, 2.43), 0.009)
    for z in (0.68, 1.29, 1.77):
        j.block("book_ledge", OAK, (-11.818, -0.48, z), (-11.658, 0.92, z + 0.026), 0.004)
    for i in range(16):
        yy = -0.32 + 0.073 * i
        height = 0.135 + 0.052 * (0.5 + 0.5 * math.sin(2.1 * i))
        j.block(
            "reading_shelf",
            (OAK, WOOL, HIDE, PAPER)[i % 4],
            (-11.792, yy, 1.316),
            (-11.665, yy + 0.036, 1.316 + height),
            0.003,
        )
    # The loaded bookcase itself swings, so the secret approach is visible
    # from both directions; it turns against the inside of the western reveal.
    j.block("pivot_back", OAK, (x0 + 0.018, -0.819, 0.041), (x1 - 0.018, -0.769, 2.131), 0.006)
    for x in (x0 + 0.024, x1 - 0.063):
        j.block("pivot_stiles", OAK, (x, -0.968, 0.043), (x + 0.039, -0.818, 2.128), 0.003)
    for z in (0.12, 0.56, 0.98, 1.40, 1.82):
        j.block("pivot_shelves", OAK, (x0 + 0.059, -0.961, z), (x1 - 0.062, -0.816, z + 0.028), 0.003)
    rng = random.Random(11926)
    for row, z in enumerate((0.15, 0.59, 1.01, 1.43, 1.85)):
        for i in range(15):
            if (2 * i + row) % 9 < 2:
                continue
            x = x0 + 0.085 + 0.069 * i
            j.block(
                "pivot_books",
                (PAPER, HIDE, WOOL, OAK)[(i + row) % 4],
                (x, -0.948, z),
                (x + rng.uniform(0.026, 0.052), -0.819, z + rng.uniform(0.15, 0.25)),
                0.002,
            )
    pieces_built = j.finish(pieces)
    for name, obj in pieces_built:
        if name.startswith("pivot_"):
            obj["estateDoor"] = "study-bookcase"
        if name == "pocket_roof":
            obj["caveRoof"] = True
    return pieces_built


def fit_stool_supports():
    """Scribe each walnut leg to the actual underside of its leather saddle and the laid floor."""
    def surface(obj):
        mesh = obj.data
        mesh.calc_loop_triangles()
        return BVHTree.FromPolygons(
            [obj.matrix_world @ v.co for v in mesh.vertices],
            [triangle.vertices for triangle in mesh.loop_triangles],
            all_triangles=True,
        )

    bpy.context.view_layer.update()
    objects = bpy.context.scene.objects
    legs = objects[PREFIX + "stool_legs__" + listening.WALNUT]
    seat = surface(objects[PREFIX + "saddle_seats__" + listening.OXBLOOD])
    floor = surface(objects[PREFIX + "paving__" + STONE])
    world = legs.matrix_world
    local = world.inverted()
    up = Vector((0, 0, 1))
    fitted = []
    for v in legs.data.vertices:
        p = world @ v.co
        # Each tapered leg has two rings. Preserve its splay in plan while
        # cutting the end faces to follow the compound seat and the stone.
        if p.z > 0.40:
            hit = seat.ray_cast(Vector((p.x, p.y, 0.40)), up, 0.55)[0]
            inset = 0.004
        elif p.z < 0.10:
            hit = floor.ray_cast(Vector((p.x, p.y, 0.105)), -up, 0.25)[0]
            inset = -0.00075
        else:
            raise ValueError(f"Unexpected interior vertex on a tapered stool leg at {tuple(p)}")
        if hit is None:
            raise ValueError(f"Missing support at stool leg {tuple(p)}")
        fitted.append(local @ Vector((p.x, p.y, hit.z + inset)))
    for v, p in zip(legs.data.vertices, fitted):
        v.co = p
    legs.data.update()


def build():
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(PREFIX):
            bpy.data.objects.remove(obj, do_unlink=True)
    finishes()
    reading_threshold()
    j = Joinery(PREFIX, "speakeasy")
    architecture(j)
    listening_end(j)
    for name, obj in j.finish() + backbar():
        listening.map_finish(obj)
        if name in ("parchment", "stone_halo", "vu_windows", "entry_lantern"):
            obj["installationGlow"] = "listening-bar"
        if name in ("disc", "label", "record_base", "tonearm", "record_sleeves", "featured_sleeve"):
            obj["barRecordPart"] = name
        if name in ("vault", "cut_vault"):
            obj["caveRoof"] = True
    fit_roundel()
    fit_stool_supports()


if __name__ == "__main__":
    if "--fit-roundel" in sys.argv:
        fit_roundel()
    elif "--fit-stools" in sys.argv:
        fit_stool_supports()
    else:
        build()
    output = next(s.split("=", 1)[1] for s in sys.argv if s.startswith("--save-as="))
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(output).resolve()), compress=True)
