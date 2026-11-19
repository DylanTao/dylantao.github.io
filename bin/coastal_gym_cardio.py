"""Build the gym's two ocean-facing cardio stations in the retained house.

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


def finishes():
    material(STEEL, (0.13, 0.24, 0.205), 0.38, 0.28)
    material(TRIM, (0.42, 0.46, 0.44), 0.34, 0.65)
    material(GRIP, (0.048, 0.054, 0.051), 0.81)
    material(HIDE, (0.31, 0.127, 0.063), 0.66)
    material(BRASS, (0.46, 0.29, 0.125), 0.4, 0.62)
    material(MAT, (0.112, 0.125, 0.109), 0.94)


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
    # The handle rests in the cradle above the foot stretchers. Its cord returns to the drum.
    base.tube(TRIM, [(0, 0.57, 0.36), (0, 0.38, 0.329)], 0.006, 8)
    base.tube(OAK, [(-0.20, 0.38, 0.327), (0.20, 0.38, 0.327)], 0.016)
    for sign in (-1, 1):
        base.tube(GRIP, [(sign * 0.074, 0.38, 0.327), (sign * 0.204, 0.38, 0.327)], 0.020)
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
    return [base.finish(), fan.finish(), seat.finish()]


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
        base.tube(GRIP, [(sign * 0.215, 0.263, 1.034), (sign * 0.201, 0.36, 1.095)], 0.023)
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
    for sign in (-1, 1):
        crank.tube(TRIM, [(sign * 0.082, 0, 0), (sign * 0.092, sign * 0.145, sign * 0.065)], 0.014)
        crank.box(GRIP, (sign * 0.132, sign * 0.145, sign * 0.065), (0.092, 0.069, 0.021), 0.006)
    return [base.finish(), crank.finish(), wheel.finish()]


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
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()
    finishes()
    objects = [threshold(), *rower(floor_at(*ROWER)), *bike(floor_at(*BIKE))]
    triangles = sum(sum(len(p.vertices) - 2 for p in obj.data.polygons) for obj in objects)
    print(f"Gym cardio: {len(objects)} pieces, {triangles:,} triangles.", flush=True)
    target = next((arg.split("=", 1)[1] for arg in sys.argv if arg.startswith("--save-as=")), None)
    if target:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(Path(target).resolve()), compress=True)


if __name__ == "__main__":
    main()
