"""Fit the ocean-facing machines and boxing equipment in the retained gym.

Blender 4.5 LTS, from the repository root:
  blender -b artwork/coastal-home/coastal-home.blend --python-exit-code 1 --python bin/coastal_gym_cardio.py -- --save-as=PATH
Omit --save-as to measure the installation in memory. Positions use the house's
final Blender world frame, with +Y toward the Pacific. All dimensions are metres.
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_coastal_furniture as furniture
from coastal_decor import material
from coastal_gym import slab


PREFIX = "gym_cardio_"
ROWER = (10.04, -3.79)
BIKE = (8.57, -4.18)
MAT_TOP = 0.012


class Piece:
    """One object around a physical pivot, with its geometry batched by finish."""

    def __init__(self, name, origin):
        self.name = PREFIX + name
        self.origin = Vector(origin)
        self.parts = {}

    def surface(self, name):
        if name not in self.parts:
            self.parts[name] = bmesh.new()
        return self.parts[name]

    def box(self, name, center, size, radius=0.008, tilt=0):
        furniture.box(self.surface(name), center, size, radius, segments=2, matrix=Matrix.Rotation(tilt, 4, "X"))

    def tube(self, name, points, radius, sides=10):
        section = [(radius * math.cos(i * math.tau / sides), radius * math.sin(i * math.tau / sides)) for i in range(sides)]
        furniture.sweep(self.surface(name), [Vector(p) for p in points], section)

    def wheel(self, name, center, profile, sides=36):
        """A closed rim or hub about the wheel axle. Profile points are (axial x, radius)."""
        bm = self.surface(name)
        cx, cy, cz = center
        rings = [
            [bm.verts.new((cx + x, cy + r * math.cos(i * math.tau / sides), cz + r * math.sin(i * math.tau / sides))) for i in range(sides)]
            for x, r in profile
        ]
        for a, b in zip(rings, rings[1:] + rings[:1]):
            for i in range(sides):
                j = (i + 1) % sides
                face = bm.faces.new((a[i], a[j], b[j], b[i]))
                face.smooth = True

    def upholstery(self, name, sections):
        """Elliptical cross sections give the saddle its nose and the seat a rolled edge."""
        rows = [
            [Vector((width * math.cos(a), y, z + height * math.sin(a))) for a in (i * math.tau / 12 for i in range(12))]
            for y, z, width, height in sections
        ]
        bm = self.surface(name)
        ends = furniture.grid(bm, rows, close=True, smooth=True)
        bm.faces.new(list(reversed(ends[0])))
        bm.faces.new(ends[-1])

    def finish(self):
        combined = bmesh.new()
        mesh = bpy.data.meshes.new(self.name)
        for index, (name, part) in enumerate(self.parts.items()):
            mesh.materials.append(bpy.data.materials[name])
            bmesh.ops.recalc_face_normals(part, faces=list(part.faces))
            data = bpy.data.meshes.new("gym part")
            part.to_mesh(data)
            for face in data.polygons:
                face.material_index = index
            combined.from_mesh(data)
            bpy.data.meshes.remove(data)
            part.free()
        combined.to_mesh(mesh)
        combined.free()
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = self.origin
        return obj


OAK = "pale oak"
STEEL = "cardio sea green enamel"
TRIM = "cardio satin pewter"
GRIP = "cardio graphite rubber"
HIDE = "cardio saddle leather"
BRASS = "cardio brushed bronze"
MAT = "cardio cork rubber"
CANVAS = "cardio sand canvas"


def finishes():
    material(STEEL, (0.13, 0.24, 0.205), 0.38, 0.28)
    material(TRIM, (0.42, 0.46, 0.44), 0.34, 0.65)
    material(GRIP, (0.048, 0.054, 0.051), 0.81)
    material(HIDE, (0.31, 0.127, 0.063), 0.66)
    material(BRASS, (0.46, 0.29, 0.125), 0.4, 0.62)
    material(MAT, (0.112, 0.125, 0.109), 0.94)
    material(CANVAS, (0.51, 0.34, 0.20), 0.86)


def threshold():
    """Scribe flush ash boards between the actual tile ends and the glazed wall."""
    tiles = bpy.data.objects["gym__gym rubber"]
    ends = {}
    for face in tiles.data.polygons:
        if face.normal.z < 0.999 or not 0.20 < face.area < 0.25:
            continue
        p = tiles.matrix_world @ face.center
        if abs(p.z - 0.018) < 0.001 and p.x > 8:
            key = round(p.x, 2)
            ends[key] = max(ends.get(key, -math.inf), p.y + 0.25)
    if len(ends) != 6:
        raise ValueError(f"Expected six tile columns across the cardio bay, found {sorted(ends)}")
    floor = bpy.data.objects["core_gym_floor"]
    points = [floor.matrix_world @ vertex.co for vertex in floor.data.vertices]
    left, right = min(p.x for p in points), max(p.x for p in points)
    left_y, right_y = [max(p.y for p in points if abs(p.x - edge) < 0.001) for edge in (left, right)]
    slope = (right_y - left_y) / (right - left)

    def inside_frame(x):
        return left_y + (x - left) * slope - 0.10

    apron = Piece("window_boards", (0, 0, 0))
    support = max(p.z for p in points)
    for center, end in sorted(ends.items()):
        for i in range(4):
            x0 = center - 0.25 + i * 0.125 + 0.001
            x1 = x0 + 0.123
            y0 = end + 0.001
            if inside_frame(x1) <= y0:
                continue
            if inside_frame(x0) <= y0:
                x0 = left + (y0 + 0.10 - left_y) / slope
                outline = [(x0, y0), (x1, y0), (x1, inside_frame(x1))]
            else:
                outline = [(x0, y0), (x1, y0), (x1, inside_frame(x1)), (x0, inside_frame(x0))]
            slab(apron.surface(OAK), outline, support + 0.0003, 0.0178)
    return apron.finish()


def foot(piece, y, width):
    piece.tube(STEEL, [(-width / 2, y, 0.048), (width / 2, y, 0.048)], 0.027)
    for sign in (-1, 1):
        piece.box(GRIP, (sign * (width / 2 - 0.025), y, 0.035), (0.067, 0.093, 0.046), 0.014)


def rower(floor):
    x, y = ROWER
    base = Piece("rower", (x, y, floor))
    base.box(MAT, (0, 0, MAT_TOP / 2), (0.63, 2.30, MAT_TOP), 0.006)
    for sign in (-1, 1):
        # Two ash rails, a flush running strip and a cross-foot at each end.
        base.box(OAK, (sign * 0.16, -0.055, 0.123), (0.045, 1.99, 0.108), 0.012)
        base.box(TRIM, (sign * 0.16, -0.24, 0.18), (0.020, 1.56, 0.007), 0.003)
        base.box(STEEL, (sign * 0.15, 0.40, 0.214), (0.124, 0.275, 0.030), 0.012, 0.66)
        base.box(GRIP, (sign * 0.15, 0.405, 0.237), (0.129, 0.042, 0.033), 0.009, 0.66)
        base.tube(STEEL, [(sign * 0.16, 0.45, 0.13), (sign * 0.137, 0.76, 0.393), (sign * 0.16, 0.94, 0.13)], 0.023)
    for fy in (-0.92, 0.85):
        foot(base, fy, 0.45)
        base.box(STEEL, (0, fy, 0.078), (0.35, 0.054, 0.040))
    # A flask rests on the mat outside the seat travel and the line of the cord.
    furniture.lathe(base.surface(STEEL), [(0.031, MAT_TOP), (0.036, 0.020), (0.036, 0.165), (0.021, 0.182),
                                           (0.021, 0.189)], center=(0.26, 0.49, 0), segments=16)
    furniture.lathe(base.surface(BRASS), [(0.022, 0.189), (0.022, 0.202), (0.019, 0.205)],
                    center=(0.26, 0.49, 0), segments=16)
    # The handle rests in the cradle above the foot stretchers. Its cord returns to the drum.
    cord = Piece("rower_cord", (x, y + 0.57, floor + 0.36))
    cord.tube(TRIM, [(0, 0, 0), (0, -0.19, -0.033)], 0.006, 8)
    handle = Piece("rower_handle", (x, y + 0.38, floor + 0.327))
    handle.tube(OAK, [(-0.20, 0, 0), (0.20, 0, 0)], 0.016)
    for sign in (-1, 1):
        handle.tube(GRIP, [(sign * 0.074, 0, 0), (sign * 0.204, 0, 0)], 0.020)
    seat = Piece("rower_seat", (x, y - 0.38, floor))
    seat.box(STEEL, (0, 0, 0.204), (0.32, 0.14, 0.040))
    seat.upholstery(HIDE, [(-0.122, 0.255, 0.12, 0.021), (-0.082, 0.259, 0.178, 0.038),
                          (0.06, 0.253, 0.17, 0.032), (0.123, 0.25, 0.11, 0.02)])
    # An open, fixed shroud with an independently pivoted impeller inside it.
    hub = (0, 0.76, 0.393)
    base.wheel(STEEL, hub, [(-0.106, 0.232), (-0.105, 0.253), (-0.087, 0.262), (0.087, 0.262), (0.105, 0.253), (0.106, 0.232)])
    for sign in (-1, 1):
        for i in range(8):
            a = i * math.tau / 8
            base.tube(TRIM, [(sign * 0.112, hub[1] + r * math.cos(a + s), hub[2] + r * math.sin(a + s))
                             for r, s in ((0.041, 0), (0.24, 0.23))], 0.004, 6)
    fan = Piece("rower_fan", (x, y + hub[1], floor + hub[2]))
    fan.wheel(BRASS, (0, 0, 0), [(-0.122, 0.012), (-0.120, 0.044), (0.120, 0.044), (0.122, 0.012)], 24)
    for i in range(12):
        a = i * math.tau / 12
        # A swept paddle catches a slice of light through the stationary grille.
        blade = fan.surface(TRIM)
        rings = []
        for r, skew in ((0.04, 0), (0.14, 0.21), (0.22, 0.37)):
            rings.append([blade.verts.new((ax, r * math.cos(a + skew + twist), r * math.sin(a + skew + twist)))
                          for ax, twist in ((-0.072, 0), (0.072, 0.13), (0.072, 0.18), (-0.072, 0.05))])
        for p, q in zip(rings, rings[1:]):
            for n in range(4):
                blade.faces.new((p[n], p[(n + 1) % 4], q[(n + 1) % 4], q[n]))
        blade.faces.new(rings[0])
        blade.faces.new(rings[-1])
    return [base.finish(), fan.finish(), seat.finish(), cord.finish(), handle.finish()]


def bike(floor):
    x, y = BIKE
    base = Piece("bike", (x, y, floor))
    base.box(MAT, (0, 0, MAT_TOP / 2), (0.57, 1.15, MAT_TOP), 0.006)
    for fy in (-0.405, 0.37):
        foot(base, fy, 0.48)
    base.tube(STEEL, [(0, -0.405, 0.052), (0, 0.37, 0.052)], 0.037)
    for sign in (-1, 1):
        base.tube(STEEL, [(sign * 0.066, -0.405, 0.060), (sign * 0.065, -0.02, 0.30),
                          (sign * 0.078, 0.28, 0.356), (sign * 0.09, 0.37, 0.064)], 0.024)
    base.tube(STEEL, [(0, -0.02, 0.285), (0, -0.19, 0.69)], 0.042)
    base.tube(TRIM, [(0, -0.19, 0.69), (0, -0.235, 0.818)], 0.023)
    base.tube(STEEL, [(0, -0.39, 0.065), (0, -0.17, 0.645), (0, 0.235, 0.688)], 0.025)
    base.tube(STEEL, [(0, -0.015, 0.31), (0, 0.218, 0.683), (0, 0.252, 0.923)], 0.035)
    base.tube(TRIM, [(0, 0.25, 0.91), (0, 0.276, 0.996)], 0.024)
    base.upholstery(HIDE, [(-0.39, 0.848, 0.065, 0.018), (-0.33, 0.85, 0.106, 0.035),
                          (-0.245, 0.85, 0.086, 0.034), (-0.115, 0.837, 0.033, 0.019), (-0.09, 0.839, 0.017, 0.014)])
    bars = [(-0.201, 0.36, 1.095), (-0.215, 0.26, 1.032), (-0.16, 0.226, 1.006), (0, 0.274, 1.0),
            (0.16, 0.226, 1.006), (0.215, 0.26, 1.032), (0.201, 0.36, 1.095)]
    base.tube(TRIM, bars, 0.018, 12)
    for sign in (-1, 1):
        base.tube(GRIP, [(sign * 0.215, 0.263, 1.034), (sign * 0.2004, 0.3641, 1.0977)], 0.023)
    # Two diagonal guards around the belt leave the flywheel silhouette legible from the door.
    for z0, z1 in ((0.37, 0.39), (0.23, 0.317)):
        base.tube(GRIP, [(0.069, -0.02, z0), (0.069, 0.28, z1)], 0.008, 8)
    wheel = Piece("bike_flywheel", (x, y + 0.28, floor + 0.356))
    wheel.wheel(TRIM, (0, 0, 0), [(-0.034, 0.187), (-0.032, 0.238), (-0.023, 0.245),
                                  (0.023, 0.245), (0.032, 0.238), (0.034, 0.187)])
    wheel.wheel(BRASS, (0, 0, 0), [(-0.047, 0.015), (-0.047, 0.050), (0.047, 0.050), (0.047, 0.015)], 24)
    for i in range(5):
        a = i * math.tau / 5
        wheel.tube(STEEL, [(0, r * math.cos(a + s), r * math.sin(a + s)) for r, s in ((0.040, 0), (0.128, 0.13), (0.196, 0.38))], 0.021)
    crank = Piece("bike_crank", (x, y - 0.02, floor + 0.30))
    crank.wheel(TRIM, (0, 0, 0), [(-0.077, 0.012), (-0.074, 0.061), (0.074, 0.061), (0.077, 0.012)], 24)
    pedals = []
    for sign, side in ((-1, "left"), (1, "right")):
        crank.tube(TRIM, [(sign * 0.082, 0, 0), (sign * 0.092, sign * 0.145, sign * 0.065)], 0.014)
        pedal = Piece("pedal_" + side, (x + sign * 0.132, y - 0.02 + sign * 0.145, floor + 0.30 + sign * 0.065))
        pedal.box(GRIP, (0, 0, 0), (0.092, 0.069, 0.021), 0.006)
        pedals.append(pedal.finish())
    return [base.finish(), crank.finish(), wheel.finish(), *pedals]


def overhead(x, y):
    hit, p, _, _, obj, _ = bpy.context.scene.ray_cast(
        bpy.context.evaluated_depsgraph_get(), Vector((x, y, 2.49)), Vector((0, 0, 1)), distance=1.8
    )
    if not hit or not 3.1 < p.z < 4.0:
        raise ValueError(f"No overhead support for the bag at {(x, y)}: {obj.name if obj else None}")
    return p.z


def heavy_bag():
    x, y = 8.04, -4.78
    roof = overhead(x, y)
    pivot = 2.58
    mount = Piece("heavy_mount", (x, y, pivot))
    mount.box(OAK, (0, 0, roof - pivot - 0.04), (0.36, 0.13, 0.08))
    mount.tube(TRIM, [(0, 0, 0), (0, 0, roof - pivot - 0.076)], 0.009)
    body = Piece("heavy_bag", (x, y, pivot))
    def leather_surface(finish, profile):
        furniture.lathe(body.surface(finish), [(r, z - pivot) for r, z in profile], segments=28)
    leather_surface(HIDE, [(0.116, 0.67), (0.156, 0.692), (0.173, 0.744), (0.176, 1.11),
                           (0.17, 1.69), (0.16, 1.78), (0.13, 1.824)])
    leather_surface(CANVAS, [(0.166, 1.742), (0.17, 1.747), (0.166, 1.776), (0.161, 1.78)])
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        ca, sa = math.cos(a), math.sin(a)
        body.tube(CANVAS, [(r * ca, r * sa, z - pivot) for r, z in ((0.164, 1.735), (0.14, 1.835), (0.054, 2.08))], 0.016, 8)
        body.tube(TRIM, [(0.054 * ca, 0.054 * sa, 2.08 - pivot), (0, 0, 0)], 0.005, 8)
    return [mount.finish(), body.finish()]


def double_end():
    x, y = 10.92, -7.45
    center = 1.46
    roof, floor = overhead(x, y), floor_at(x, y)
    fixed = Piece("double_anchors", (x, y, 0))
    for z, height in ((floor, 0.026), (roof - 0.046, 0.046)):
        furniture.lathe(fixed.surface(TRIM), [(0.045, z), (0.052, z + height * 0.32), (0.033, z + height)], segments=18)
    body = Piece("double_bag", (x, y, center))
    furniture.lathe(body.surface(HIDE), [(0.018, -0.195), (0.048, -0.15), (0.095, -0.082), (0.108, -0.02),
                                         (0.11, 0.03), (0.089, 0.105), (0.039, 0.17), (0.016, 0.188)], segments=24)
    furniture.lathe(body.surface(CANVAS), [(0.1085, -0.03), (0.111, -0.015), (0.1115, 0.016)], segments=24)
    cords = []
    for name, z, tip in (("bottom", floor + 0.026, center - 0.195), ("top", roof - 0.046, center + 0.188)):
        cord = Piece("double_" + name, (x, y, z))
        cord.tube(GRIP, [(0, 0, 0), (0, 0, tip - z)], 0.006, 8)
        cords.append(cord.finish())
    return [fixed.finish(), body.finish(), *cords]


def bag_wall():
    # The bracket and shelf are cantilevered from the rock wall beyond the concrete slab.
    x, y, top = 10.68, -6.21, 1.97
    mount = Piece("speed_platform", (x, y, top))
    furniture.lathe(mount.surface(OAK), [(0.222, 0), (0.243, 0.008), (0.243, 0.039), (0.231, 0.047)], segments=32)
    for side in (-0.115, 0.115):
        mount.box(STEEL, (0.503, side, 0.185), (0.044, 0.064, 0.31))
        mount.tube(STEEL, [(0.486, side, 0.29), (0.065, side, 0.073), (0.485, side, 0.073)], 0.018)
    mount.box(STEEL, (0.057, 0, 0.057), (0.047, 0.268, 0.020))
    mount.tube(BRASS, [(0, 0, -0.04), (0, 0, 0)], 0.014)
    pear = Piece("speed_bag", (x, y, top - 0.04))
    furniture.lathe(pear.surface(HIDE), [(0.026, -0.284), (0.068, -0.269), (0.096, -0.23), (0.097, -0.19),
                                        (0.074, -0.132), (0.035, -0.073), (0.013, -0.017), (0.011, 0)], segments=24)
    shelf = Piece("wrap_shelf", (11.20, -6.82, 0.91))
    shelf.box(OAK, (-0.135, 0, 0), (0.28, 0.76, 0.037))
    for along in (-0.27, 0.27):
        shelf.tube(STEEL, [(-0.015, along, -0.16), (-0.18, along, -0.026), (-0.01, along, -0.026)], 0.011)
    for along in (-0.24, -0.14):
        furniture.lathe(shelf.surface(CANVAS), [(0.043, 0.019), (0.046, 0.023), (0.046, 0.067), (0.04, 0.071)],
                        center=(-0.15, along, 0), segments=18)
    for i in range(2):
        shelf.box("linen", (-0.132, 0.15, 0.036 + i * 0.031), (0.215 - i * 0.014, 0.296, 0.032), 0.014)
    for along in (-0.13, 0.10):
        shelf.tube(BRASS, [(-0.235, along, -0.018), (-0.235, along, -0.065)], 0.009, 8)
        for dz, r, paint in ((-0.118, 0.042, CANVAS), (-0.196, 0.063, HIDE)):
            furniture.lathe(shelf.surface(paint), [(r * 0.68, -0.05), (r, -0.024), (r, 0.025), (r * 0.71, 0.065)],
                            center=(-0.235, along, dz), segments=18)
        furniture.lathe(shelf.surface(HIDE), [(0.014, 0), (0.028, 0.03), (0.023, 0.071), (0.011, 0.089)],
                        center=(-0.265, along + 0.043, -0.235), segments=12)
    # Both timber handles rest in the peg; the loop hangs clear of the gloves.
    rope = [(-0.237, -0.28 + 0.052 * math.sin(a), -0.221 + 0.168 * math.cos(a))
            for a in (math.tau * i / 24 for i in range(1, 24))]
    shelf.tube(GRIP, rope, 0.0036, 6)
    for end in (rope[0], rope[-1]):
        shelf.tube(OAK, [end, (end[0], end[1], -0.023)], 0.009, 8)
    shelf.tube(BRASS, [(-0.209, -0.28, -0.019), (-0.252, -0.28, -0.046)], 0.007, 8)
    return [mount.finish(), pear.finish(), shelf.finish()]


def lamps():
    # The two fittings share a parchment diffuser; the source regions in the
    # manifest are local to the bag wall and the window respectively.
    paper = material("cardio parchment", (0.74, 0.59, 0.39), 0.82)
    shader = paper.node_tree.nodes["Principled BSDF"]
    shader.inputs["Emission Color"].default_value = (1.0, 0.63, 0.32, 1)
    shader.inputs["Emission Strength"].default_value = 0.64
    x, y, bottom = 9.10, -5.85, 2.36
    roof = overhead(x, y)
    hardware = Piece("pendant_mount", (x, y, bottom))
    hardware.tube(GRIP, [(0, 0, 0.265), (0, 0, roof - bottom)], 0.006, 8)
    for z, r in ((0, 0.09), (0.257, 0.079)):
        furniture.lathe(hardware.surface(BRASS), [(r, z), (r, z + 0.008)], segments=24)
    shade = Piece("pendant_paper", (x, y, bottom))
    furniture.lathe(shade.surface(paper.name), [(0.089, 0.008), (0.096, 0.048), (0.092, 0.206), (0.079, 0.257)], segments=24)
    lamp = shade.finish()
    lamp["installationGlow"] = "gym-boxing-pendant"
    sill = Piece("sill_diffuser", (0, 0, 0))
    sill.tube(paper.name, [(8.08, -3.765, 0.031), (10.84, -1.723, 0.031)], 0.005, 8)
    strip = sill.finish()
    strip["installationGlow"] = "gym-window-sill"
    return [hardware.finish(), lamp, strip]


def floor_at(x, y):
    # The rubber tiles meet a stone border at the diagonal glass. Read the actual support.
    scene = bpy.context.scene
    hit, point, _, _, obj, _ = scene.ray_cast(bpy.context.evaluated_depsgraph_get(), Vector((x, y, 0.09)), Vector((0, 0, -1)), distance=0.15)
    if not hit or not (obj.name.startswith("gym__gym rubber") or obj.name == "core_gym_floor"):
        raise ValueError(f"No gym floor beneath {(x, y)}: {obj.name if obj else None}")
    return point.z


def main():
    if not bpy.data.objects.get("core_gym_front_header"):
        raise ValueError("Open the retained house with the November gym header before installing these stations.")
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(PREFIX):
            mesh = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)
    bpy.context.view_layer.update()
    finishes()
    objects = [threshold(), *rower(floor_at(*ROWER)), *bike(floor_at(*BIKE)), *heavy_bag(), *double_end(), *bag_wall(), *lamps()]
    triangles = sum(sum(len(p.vertices) - 2 for p in obj.data.polygons) for obj in objects)
    print(f"Gym cardio: {len(objects)} pieces, {triangles:,} triangles.", flush=True)
    target = next((arg.split("=", 1)[1] for arg in sys.argv if arg.startswith("--save-as=")), None)
    if target:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(Path(target).resolve()), compress=True)


if __name__ == "__main__":
    main()
