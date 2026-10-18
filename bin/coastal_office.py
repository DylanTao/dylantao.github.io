"""Sirui's office in the deepened study (Sirui, 2026-10-16): "my laptop is a lg gram pro 32gb super
light model, also i have gaming pc, with black shell, and glass side panel, with rgb lights and
3080ti and two monitor, one 43 inch, and one 32 inch, could you put them in a l-shaped desk table
that is artistic and marble slab with texture, milky white, japandi style".

The desk is one L of milky veined marble, 5 cm thick, on two marble waterfall legs and a light-oak
drawer pedestal at the corner. Sirui sits at the long run beside the bedroom screen facing south,
the 43-inch monitor (AORUS FV43U size, 967 x 586 mm) straight ahead and the 32-inch (714 x 425 mm)
turned toward him on the corner, so the side view from the gallery shows his profile, both screens
and the return behind him: research papers, the turntable, and the black tower with its tempered
glass side, RGB fans and a three-fan RTX 3080 Ti, glass facing the room. The LG gram Pro 16 (357 x
248 x 15 mm, black magnesium) is open at his right hand. A bookshelf wall behind the return closes
the office off from the walk to the stair and holds the records.

The typing pose fixes the ergonomics: hands 34.5 cm in front of the hips at 92.5 cm, the seat
cushion at 51.5 cm and the feet on a footrest at 22 cm (bin/review_coastal_models.py). The desk top
is at 88 cm, the keyboard's keys at 90.5 cm with an oak wrist rest under the wrists, and the 43-inch
panel's centre near seated eye height. House coordinates: metres, Z up, +Y toward the sea, +X north.
"""

import math
import bmesh
import bpy
from mathutils import Matrix, Vector

Z0 = 2.6
DESK_TOP = 0.88
SLAB = 0.05
MAIN = {"x": (-1.38, -0.66), "y": (-4.37, -2.15)}
RETURN = {"x": (-1.38, 1.0), "y": (-5.09, -4.37)}
ACTOR = (-0.36, -3.55)  # between the hips; Sirui faces -X (south)
EYE = (ACTOR[0] - 0.05, ACTOR[1], Z0 + 1.2)
SHELF = {"x": (-1.4, 1.0), "y": (-5.72, -5.42), "levels": (0.04, 0.44, 0.84, 1.24, 1.64), "top": 1.95}
# The record sleeves stand on the bookshelf's top board in front of a back rail; papers and the
# turntable lie on the return. Each is drawn by the browser (controller.mjs makeDeskObjects).
RECORDS = [(-0.62 + 0.38 * k, -5.53) for k in range(4)]
PAPERS = ((-0.72, -4.6), (-0.41, -4.63))
TURNTABLE = (0.17, -4.7)
PC = {"x": (0.53, 0.99), "y": (-4.85, -4.62), "height": 0.49}
LAMP = (-1.2, -2.32)
LAPTOP = (-0.98, -2.76)
MONITOR_43 = {"size": (0.967, 0.586), "center": (-1.24, ACTOR[1]), "bottom": 0.075}
MONITOR_32 = {"size": (0.714, 0.425), "center": (-1.12, -4.62), "bottom": 0.09}


def _mat(name, color, roughness=0.6, metallic=0.0, emission=None, strength=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, alpha)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = alpha
    if alpha < 1:
        mat.surface_render_method = "BLENDED"
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def office_materials():
    get = bpy.data.materials.get
    return {
        "marble": get("milky veined marble"),
        "oak": get("pale oak"),
        "smoked": get("honey ash"),
        "nickel": get("polished nickel"),
        "brass": get("brushed brass"),
        "linen": get("linen"),
        "indigo": get("indigo textile"),
        "ochre": get("ochre textile"),
        "sage": get("sage textile"),
        "terra": get("terracotta"),
        "leaf": get("olive leaf"),
        "ink": get("charcoal"),
        "black": _mat("matte black device", (0.018, 0.018, 0.02), 0.45, 0.2),
        "magnesium": _mat("black magnesium laptop", (0.03, 0.031, 0.034), 0.38, 0.55),
        "screen": _mat("monitor screen glass", (0.008, 0.009, 0.012), 0.42, 0.0, (0.025, 0.04, 0.065), 1.0),
        "code": _mat("screen code light", (0.6, 0.72, 0.68), 0.5, 0.0, (0.55, 0.78, 0.7), 1.6),
        "code warm": _mat("screen code warm light", (0.85, 0.55, 0.35), 0.5, 0.0, (0.95, 0.6, 0.35), 1.6),
        "code blue": _mat("screen code blue light", (0.45, 0.6, 0.95), 0.5, 0.0, (0.45, 0.62, 1.0), 1.6),
        "pc": _mat("pc black steel", (0.02, 0.021, 0.024), 0.42, 0.55),
        "board": _mat("pc circuit board", (0.012, 0.02, 0.018), 0.55, 0.1),
        "glass": _mat("pc tempered glass", (0.05, 0.055, 0.06), 0.04, 0.0, alpha=0.22),
        "rgb": _mat("pc rgb glow", (0.6, 0.3, 0.9), 0.4, 0.0, (0.55, 0.25, 1.0), 3.0),
        "gpu": _mat("rtx graphite shroud", (0.07, 0.072, 0.075), 0.35, 0.75),
        "keycap": _mat("oatmeal keycap", (0.72, 0.68, 0.6), 0.55),
        "mesh": _mat("graphite chair textile", (0.06, 0.062, 0.065), 0.85),
        "aluminium": get("polished nickel"),
        "paper": get("sketch paper") or _mat("sketch paper", (0.88, 0.86, 0.8), 0.9),
        "cork": get("cork board") or _mat("cork board", (0.6, 0.45, 0.3), 0.85),
    }


class Parts:
    """Geometry collected per material; each material becomes one batched object (study__<material>)."""

    def __init__(self, prefix):
        self.prefix = prefix
        self.groups = {}

    def bm(self, mat):
        if mat.name not in self.groups:
            self.groups[mat.name] = (mat, bmesh.new())
        return self.groups[mat.name][1]

    def finish(self):
        objects = []
        for name, (mat, bm) in self.groups.items():
            if not bm.verts:
                bm.free()
                continue
            data = bpy.data.meshes.new(f"{self.prefix}__{name}")
            bm.to_mesh(data)
            bm.free()
            data.materials.append(mat)
            for face in data.polygons:
                face.use_smooth = True
            obj = bpy.data.objects.new(f"{self.prefix}__{name}", data)
            bpy.context.collection.objects.link(obj)
            objects.append(obj)
        return objects


def _append(bm, temp):
    data = bpy.data.meshes.new("tmp")
    temp.to_mesh(data)
    temp.free()
    bm.from_mesh(data)
    bpy.data.meshes.remove(data)


def box(bm, center, size, radius=0.0, yaw=0.0, segments=3, pitch=0.0):
    """A box, optionally rounded on every edge, turned by `yaw` about Z (and `pitch` about its own X)."""
    temp = bmesh.new()
    m = Matrix.Translation(center) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Rotation(pitch, 4, "X") @ Matrix.Diagonal((*size, 1))
    bmesh.ops.create_cube(temp, size=1, matrix=m)
    if radius > 0:
        bmesh.ops.bevel(temp, geom=list(temp.edges), offset=min(radius, min(size) * 0.45), offset_type="OFFSET", segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True)
    _append(bm, temp)


def cylinder(bm, start, end, radius, segments=16, radius2=None):
    axis = Vector(end) - Vector(start)
    rotation = axis.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
    m = Matrix.Translation((Vector(start) + Vector(end)) / 2) @ rotation
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius if radius2 is None else radius2, depth=axis.length, matrix=m)


def lathe(bm, profile, center, segments=32):
    """Revolve (radius, z) pairs about a vertical axis, closing the bottom and top."""
    temp = bmesh.new()
    rings = [[temp.verts.new((center[0] + r * math.cos(a), center[1] + r * math.sin(a), center[2] + z)) for a in (k * math.tau / segments for k in range(segments))] for r, z in profile]
    for lower, upper in zip(rings, rings[1:]):
        for k in range(segments):
            temp.faces.new((lower[k], lower[(k + 1) % segments], upper[(k + 1) % segments], upper[k]))
    temp.faces.new(list(reversed(rings[0])))
    temp.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(temp, faces=list(temp.faces))
    _append(bm, temp)


def l_slab(bm, outline, z0, z1, radius):
    """An extruded plan outline with rounded edges (the marble L)."""
    temp = bmesh.new()
    bottom = [temp.verts.new((x, y, z0)) for x, y in outline]
    top = [temp.verts.new((x, y, z1)) for x, y in outline]
    temp.faces.new(list(reversed(bottom)))
    temp.faces.new(top)
    n = len(outline)
    for k in range(n):
        temp.faces.new((bottom[k], bottom[(k + 1) % n], top[(k + 1) % n], top[k]))
    bmesh.ops.recalc_face_normals(temp, faces=list(temp.faces))
    bmesh.ops.bevel(temp, geom=list(temp.edges), offset=radius, offset_type="OFFSET", segments=4, profile=0.5, affect="EDGES", clamp_overlap=True)
    _append(bm, temp)


def facing_yaw(at, target):
    """Yaw (about Z) that turns local +Y (a panel's screen side) toward `target`."""
    return math.atan2(target[1] - at[1], target[0] - at[0]) - math.pi / 2


# The desk ---------------------------------------------------------------------------------------

def build_desk(p, m):
    (mx0, mx1), (my0, my1) = MAIN["x"], MAIN["y"]
    (rx0, rx1), (ry0, ry1) = RETURN["x"], RETURN["y"]
    top, under = Z0 + DESK_TOP, Z0 + DESK_TOP - SLAB
    outline = [(mx0, ry0), (rx1, ry0), (rx1, ry1), (mx1, ry1), (mx1, my1), (mx0, my1)]
    l_slab(p.bm(m["marble"]), outline, under, top, 0.014)
    marble = p.bm(m["marble"])
    # Waterfall legs: the long run's seaward end and the return's north end, 5 cm marble slabs.
    box(marble, ((mx0 + mx1) / 2, my1 - 0.03, Z0 + (DESK_TOP - SLAB) / 2), (mx1 - mx0 - 0.02, SLAB, DESK_TOP - SLAB + 0.002), 0.012)
    box(marble, (rx1 - 0.03, (ry0 + ry1) / 2, Z0 + (DESK_TOP - SLAB) / 2), (SLAB, ry1 - ry0 - 0.02, DESK_TOP - SLAB + 0.002), 0.012)
    # The corner pedestal: light oak, three drawers with nickel pulls, on a recessed plinth.
    oak, smoked, nickel = p.bm(m["oak"]), p.bm(m["smoked"]), p.bm(m["nickel"])
    px0, px1, py0, py1 = mx0 + 0.04, mx0 + 0.52, ry0 + 0.04, ry1 - 0.03
    height = DESK_TOP - SLAB - 0.06
    box(smoked, ((px0 + px1) / 2, (py0 + py1) / 2, Z0 + 0.03), (px1 - px0 - 0.04, py1 - py0 - 0.04, 0.06), 0.008)
    box(oak, ((px0 + px1) / 2, (py0 + py1) / 2, Z0 + 0.06 + height / 2), (px1 - px0, py1 - py0, height), 0.01)
    for k in range(3):
        z = Z0 + 0.06 + height * (k + 0.5) / 3
        box(oak, ((px0 + px1) / 2, py1 + 0.006, z), (px1 - px0 - 0.03, 0.014, height / 3 - 0.014), 0.004)
        cylinder(nickel, ((px0 + px1) / 2 - 0.08, py1 + 0.03, z), ((px0 + px1) / 2 + 0.08, py1 + 0.03, z), 0.007, 12)
        for dx in (-0.08, 0.08):
            cylinder(nickel, ((px0 + px1) / 2 + dx, py1 + 0.013, z), ((px0 + px1) / 2 + dx, py1 + 0.03, z), 0.005, 10)
    # A thin brass inlay along the long run's front edge, the one shiny line on the desk.
    box(p.bm(m["brass"]), (mx1 + 0.0005, (my0 + my1) / 2 + 0.2, top - 0.022), (0.003, my1 - my0 - 0.5, 0.006), 0.0)


def build_monitor(p, m, spec, facing_target, name):
    """A flat panel on a pedestal stand, its screen showing an editor in soft emissive lines."""
    (w, h), (cx, cy), bottom = spec["size"], spec["center"], spec["bottom"]
    yaw = facing_yaw((cx, cy), facing_target)
    front = Matrix.Rotation(yaw, 3, "Z")
    z = Z0 + DESK_TOP + bottom + h / 2
    black, screen = p.bm(m["black"]), p.bm(m["screen"])
    # Panel: a slim bezel frame, the glass a hair in front, a rounded back housing behind.
    box(black, (cx, cy, z), (w + 0.012, 0.022, h + 0.012), 0.004, yaw)
    box(black, tuple(Vector((cx, cy, z - 0.03)) + front @ Vector((0, -0.032, 0))), (w * 0.62, 0.05, h * 0.55), 0.02, yaw)
    box(screen, tuple(Vector((cx, cy, z)) + front @ Vector((0, 0.0115, 0))), (w - 0.006, 0.002, h - 0.006), 0.0, yaw)
    # Stand: a neck from the housing to an oval nickel-edged foot on the desk.
    back = Vector((cx, cy, 0)) + front @ Vector((0, -0.11, 0))
    foot = Z0 + DESK_TOP
    box(black, (back.x, back.y, foot + 0.006), (0.34 if w > 0.8 else 0.26, 0.2, 0.012), 0.006, yaw)
    neck_top = Vector((cx, cy, z - h * 0.18)) + front @ Vector((0, -0.055, 0))
    cylinder(black, (back.x, back.y, foot + 0.012), (neck_top.x, neck_top.y, neck_top.z), 0.022, 16)
    # Code on screen: a column of short lines in three colours, the way an editor reads at a glance.
    lines = 22 if w > 0.8 else 16
    for k in range(lines):
        depth = (k * 7) % 5
        length = (0.18 + 0.27 * ((k * 37) % 11) / 10) * w
        x0 = -w / 2 + 0.06 * w + depth * 0.025 * w
        zz = z + h / 2 - 0.06 * h - k * (h * 0.86 / lines)
        mat = m["code"] if k % 3 else (m["code warm"] if k % 2 else m["code blue"])
        center = Vector((cx, cy, zz)) + front @ Vector((x0 + length / 2, 0.0135, 0))
        box(p.bm(mat), tuple(center), (length, 0.0015, h * 0.012), 0.0, yaw)
    return yaw


def build_keyboard(p, m):
    """A low mechanical keyboard on a felt mat, an oak wrist rest, and a mouse at the right hand."""
    ax, ay = ACTOR
    kx = ax - 0.43
    top = Z0 + DESK_TOP
    box(p.bm(m["indigo"]), (-0.86, ay + 0.12, top + 0.002), (0.38, 0.86, 0.004), 0.002)
    black = p.bm(m["black"])
    box(black, (kx, ay, top + 0.004 + 0.012), (0.135, 0.36, 0.024), 0.006)
    keys, accent = p.bm(m["keycap"]), p.bm(m["ochre"])
    # Five rows of keys; row 0, nearest Sirui, has the space bar across its middle.
    for row in range(5):
        x = kx + 0.05 - row * 0.024
        for col in range(15):
            if row == 0 and 4 <= col <= 10:
                if col == 7:
                    box(keys, (x, ay - 0.165 + col * 0.0236, top + 0.031), (0.019, 0.155, 0.009), 0.003)
                continue
            mat = accent if (row, col) in ((4, 14), (4, 0), (1, 14)) else keys
            box(mat, (x, ay - 0.165 + col * 0.0236, top + 0.031), (0.019, 0.019, 0.009), 0.003)
    box(p.bm(m["oak"]), (ax - 0.335, ay, top + 0.011), (0.055, 0.36, 0.018), 0.008)
    # Mouse: a low rounded shell.
    mouse = bmesh.new()
    bmesh.ops.create_uvsphere(mouse, u_segments=20, v_segments=12, radius=1.0)
    for v in mouse.verts:
        v.co = Vector((v.co.x * 0.062, v.co.y * 0.034, max(v.co.z, -0.1) * 0.036))
    bmesh.ops.translate(mouse, verts=list(mouse.verts), vec=(kx + 0.005, ay + 0.31, top + 0.008))
    _append(p.bm(m["black"]), mouse)


def build_laptop(p, m):
    """The LG gram Pro 16, open at about 110 degrees, turned toward Sirui at his right hand."""
    at = LAPTOP
    yaw = facing_yaw(at, EYE)
    front = Matrix.Rotation(yaw, 3, "Z")
    top = Z0 + DESK_TOP
    w, d, t = 0.357, 0.248, 0.0155
    mg, screen = p.bm(m["magnesium"]), p.bm(m["screen"])
    box(mg, (at[0], at[1], top + t * 0.3), (w, d, t * 0.6), 0.004, yaw)
    box(p.bm(m["black"]), tuple(Vector((at[0], at[1], top + t * 0.6 + 0.0005)) + front @ Vector((0, 0.02, 0))), (w - 0.04, d * 0.42, 0.001), 0.0, yaw)
    # The lid hinges along the base's far edge and leans back 20 degrees past upright; its
    # screen faces Sirui (local +Y).
    hinge = Vector((at[0], at[1], top + t * 0.6)) + front @ Vector((0, -d / 2 + 0.006, 0))
    lean = math.radians(20)
    tilt = Matrix.Rotation(lean, 3, "X")
    lid_center = hinge + front @ (tilt @ Vector((0, 0, 0.12)))
    box(mg, tuple(lid_center), (w, t * 0.4, 0.24), 0.003, yaw, pitch=lean)
    box(screen, tuple(lid_center + front @ (tilt @ Vector((0, 0.0035, 0)))), (w - 0.016, 0.0015, 0.225), 0.0, yaw, pitch=lean)
    for k in range(9):
        length = 0.08 + 0.14 * ((k * 5) % 7) / 6
        local = Vector((-0.13 + length / 2, 0.005, 0.09 - k * 0.022))
        mat = m["code"] if k % 3 else m["code blue"]
        box(p.bm(mat), tuple(lid_center + front @ (tilt @ local)), (length, 0.001, 0.006), 0.0, yaw, pitch=lean)


def build_pc(p, m):
    """A black mid-tower on the return: tempered glass toward the room, three RGB intake fans in the
    front, a 240 mm radiator with two RGB fans under the roof, an RGB-topped memory bank and a long
    three-fan RTX 3080 Ti across the board, over a power-supply shroud."""
    (x0, x1), (y0, y1), h = PC["x"], PC["y"], PC["height"]
    base = Z0 + DESK_TOP
    steel, board, glass, rgb, gpu, black = (p.bm(m[k]) for k in ("pc", "board", "glass", "rgb", "gpu", "black"))
    t = 0.008
    # Shell: feet, floor, roof, front, back and the solid right side (-Y); the glass is the left (+Y).
    for fx in (x0 + 0.05, x1 - 0.05):
        for fy in (y0 + 0.035, y1 - 0.035):
            box(black, (fx, fy, base + 0.008), (0.05, 0.03, 0.016), 0.006)
    z0 = base + 0.016
    box(steel, ((x0 + x1) / 2, (y0 + y1) / 2, z0 + t / 2), (x1 - x0, y1 - y0, t), 0.003)
    box(steel, ((x0 + x1) / 2, (y0 + y1) / 2, z0 + h - t / 2), (x1 - x0, y1 - y0, t), 0.004)
    box(steel, ((x0 + x1) / 2, y0 + t / 2, z0 + h / 2), (x1 - x0, t, h), 0.003)
    box(steel, (x1 - t / 2, (y0 + y1) / 2, z0 + h / 2), (t, y1 - y0, h), 0.003)
    box(steel, (x0 + t / 2, (y0 + y1) / 2, z0 + h / 2), (t * 1.6, y1 - y0, h), 0.004)
    box(glass, ((x0 + x1) / 2, y1 - 0.003, z0 + h / 2), (x1 - x0 - 0.012, 0.004, h - 0.012), 0.002)
    # Front intake: three RGB rings behind the front grille, glowing through it and seen inside.
    for k in range(3):
        fz = z0 + 0.09 + k * 0.135
        cylinder(rgb, (x0 + 0.024, (y0 + y1) / 2, fz), (x0 + 0.03, (y0 + y1) / 2, fz), 0.058, 32)
        cylinder(black, (x0 + 0.02, (y0 + y1) / 2, fz), (x0 + 0.034, (y0 + y1) / 2, fz), 0.05, 24)
        cylinder(black, (x0 + 0.012, (y0 + y1) / 2, fz), (x0 + 0.04, (y0 + y1) / 2, fz), 0.017, 12)
    # Motherboard on the right side, the CPU block and memory near its top.
    bx = (x0 + x1) / 2 + 0.03
    box(board, (bx, y0 + t + 0.004, z0 + h * 0.6), (0.3, 0.006, 0.3), 0.002)
    cylinder(black, (bx - 0.02, y0 + 0.012, z0 + h * 0.7), (bx - 0.02, y0 + 0.05, z0 + h * 0.7), 0.035, 24)
    cylinder(rgb, (bx - 0.02, y0 + 0.05, z0 + h * 0.7), (bx - 0.02, y0 + 0.054, z0 + h * 0.7), 0.036, 24)
    for k in range(4):
        rx = bx + 0.08 + k * 0.012
        box(black, (rx, y0 + 0.04, z0 + h * 0.66), (0.007, 0.06, 0.13), 0.002)
        box(rgb, (rx, y0 + 0.072, z0 + h * 0.66), (0.007, 0.006, 0.13), 0.001)
    # Radiator and two fans under the roof.
    box(black, ((x0 + x1) / 2 + 0.01, (y0 + y1) / 2, z0 + h - 0.04), (0.29, y1 - y0 - 0.06, 0.028), 0.004)
    for k in (-1, 1):
        fx = (x0 + x1) / 2 + 0.01 + k * 0.068
        cylinder(rgb, (fx, (y0 + y1) / 2, z0 + h - 0.062), (fx, (y0 + y1) / 2, z0 + h - 0.057), 0.058, 32)
        cylinder(black, (fx, (y0 + y1) / 2, z0 + h - 0.066), (fx, (y0 + y1) / 2, z0 + h - 0.054), 0.05, 24)
    # The RTX 3080 Ti: a 28.5 cm graphite card standing out from the board, fans facing down, its
    # light bar along the edge that faces the glass.
    gz = z0 + h * 0.38
    gy = y0 + 0.012 + 0.06
    box(gpu, (bx - 0.01, gy, gz), (0.285, 0.12, 0.055), 0.006)
    for k in (-1, 0, 1):
        fx = bx - 0.01 + k * 0.088
        cylinder(black, (fx, gy, gz - 0.029), (fx, gy, gz - 0.026), 0.04, 24)
        cylinder(rgb, (fx, gy, gz - 0.0295), (fx, gy, gz - 0.028), 0.006, 12)
    box(rgb, (bx - 0.01, gy + 0.061, gz + 0.012), (0.2, 0.003, 0.012), 0.001)
    box(steel, (x1 - 0.02, gy, gz), (0.01, 0.12, 0.07), 0.002)
    # Power-supply shroud and an RGB strip under the roof's front edge.
    box(steel, ((x0 + x1) / 2, (y0 + y1) / 2, z0 + 0.055), (x1 - x0 - 0.02, y1 - y0 - 0.02, 0.09), 0.006)
    box(rgb, ((x0 + x1) / 2, y1 - 0.02, z0 + h - 0.016), (x1 - x0 - 0.06, 0.004, 0.005), 0.001)


def build_chair(p, m):
    """An ergonomic task chair: polished five-star base, graphite seat at 51.5 cm, a sculpted back."""
    ax, ay = ACTOR
    alu, black, fabric = p.bm(m["aluminium"]), p.bm(m["black"]), p.bm(m["mesh"])
    floor = Z0
    for k in range(5):
        a = k * math.tau / 5 + 0.3
        tip = Vector((ax + 0.33 * math.cos(a), ay + 0.33 * math.sin(a), floor + 0.07))
        cylinder(alu, (ax, ay, floor + 0.1), tuple(tip), 0.018, 12, radius2=0.012)
        caster = bmesh.new()
        bmesh.ops.create_uvsphere(caster, u_segments=12, v_segments=8, radius=0.028)
        bmesh.ops.translate(caster, verts=list(caster.verts), vec=(tip.x, tip.y, floor + 0.03))
        _append(black, caster)
    cylinder(black, (ax, ay, floor + 0.09), (ax, ay, floor + 0.3), 0.03, 16)
    cylinder(alu, (ax, ay, floor + 0.3), (ax, ay, floor + 0.43), 0.022, 16)
    box(black, (ax - 0.01, ay, floor + 0.445), (0.24, 0.2, 0.03), 0.01)
    # Seat: cushion top at 51.5 cm, waterfall front edge toward the desk.
    box(fabric, (ax - 0.04, ay, floor + 0.485), (0.5, 0.49, 0.06), 0.025)
    # Back: a sculpted pad on a smoked spine, leaning back slightly.
    spine_base = Vector((ax + 0.2, ay, floor + 0.46))
    cylinder(black, tuple(spine_base), (ax + 0.27, ay, floor + 0.72), 0.022, 12)
    box(fabric, (ax + 0.28, ay, floor + 0.98), (0.07, 0.46, 0.56), 0.03, 0.0, pitch=0.0)
    box(fabric, (ax + 0.255, ay, floor + 0.74), (0.06, 0.42, 0.14), 0.025)
    # Armrests.
    for side in (-1, 1):
        y = ay + side * 0.27
        cylinder(black, (ax + 0.05, y, floor + 0.45), (ax + 0.05, y, floor + 0.66), 0.014, 10)
        box(black, (ax - 0.02, y, floor + 0.675), (0.24, 0.07, 0.03), 0.012)


def build_footrest(p, m):
    """An oak footrest under the desk with its top exactly at 22 cm, where the seated feet rest."""
    ax, ay = ACTOR
    fx = ax - 0.49
    oak, smoked = p.bm(m["oak"]), p.bm(m["smoked"])
    box(oak, (fx, ay, Z0 + 0.204), (0.4, 0.49, 0.032), 0.01)
    for dy in (-0.195, 0.195):
        box(smoked, (fx, ay + dy, Z0 + 0.095), (0.355, 0.044, 0.19), 0.01)
    box(smoked, (fx, ay, Z0 + 0.061), (0.034, 0.42, 0.035), 0.009)


def build_lamp(p, m):
    """A brass-and-nickel task lamp at the seaward end of the long run, its linen shade over the desk."""
    lx, ly = LAMP
    top = Z0 + DESK_TOP
    brass, nickel, linen = p.bm(m["brass"]), p.bm(m["nickel"]), p.bm(m["linen"])
    lathe(nickel, [(0.0, 0.0), (0.075, 0.0), (0.078, 0.006), (0.07, 0.016), (0.0, 0.018)], (lx, ly, top), 32)
    elbow = Vector((lx + 0.04, ly - 0.02, top + 0.38))
    head = Vector((lx + 0.23, ly - 0.1, top + 0.47))
    cylinder(brass, (lx, ly, top + 0.016), tuple(elbow), 0.008, 10)
    cylinder(brass, tuple(elbow), tuple(head), 0.007, 10)
    lathe(linen, [(0.0, 0.0), (0.08, -0.002), (0.13, -0.12), (0.125, -0.122), (0.075, -0.004), (0.0, 0.004)], (head.x, head.y, head.z), 32)
    return (head.x, head.y, head.z - 0.07)


def build_shelf(p, m):
    """A bookshelf wall behind the return: smoked-oak uprights, light-oak shelves, open on both sides,
    holding books, ceramics and a trailing plant, with a ledge on its top board where the record
    sleeves stand (the browser draws the sleeves at RECORDS)."""
    (x0, x1), (y0, y1) = SHELF["x"], SHELF["y"]
    smoked, oak = p.bm(m["smoked"]), p.bm(m["oak"])
    top = SHELF["top"]
    bays = 4
    width = (x1 - x0) / bays
    for k in range(bays + 1):
        box(smoked, (x0 + width * k, (y0 + y1) / 2, Z0 + top / 2), (0.035, y1 - y0, top), 0.008)
    for level in SHELF["levels"] + (top - 0.015,):
        box(oak, ((x0 + x1) / 2, (y0 + y1) / 2, Z0 + level + 0.012), (x1 - x0 + 0.03, y1 - y0, 0.026), 0.006)
    # The record ledge: a lip at the front of the top board and a rail behind the sleeves.
    ledge = Z0 + top + 0.011
    box(smoked, ((x0 + x1) / 2, y1 - 0.012, ledge + 0.012), (x1 - x0, 0.016, 0.024), 0.005)
    for x in (x0 + 0.12, (x0 + x1) / 2, x1 - 0.12):
        box(smoked, (x, y0 + 0.05, ledge + 0.1), (0.022, 0.022, 0.2), 0.005)
    box(smoked, ((x0 + x1) / 2, y0 + 0.05, ledge + 0.19), (x1 - x0 - 0.2, 0.02, 0.02), 0.006)
    # Books: runs of spines in the house's textiles and paper tones; some bays hold ceramics.
    colors = ("linen", "sage", "terra", "indigo", "ochre", "smoked", "linen", "oak")
    decor = {(1, 1): "terra", (2, 0): "linen", (0, 3): "indigo", (3, 2): "sage"}
    seed = 7
    for li, level in enumerate(SHELF["levels"][:4]):
        z = Z0 + level + 0.025
        for bay in range(bays):
            if (li, bay) in decor:
                continue
            x, end_x = x0 + width * bay + 0.03, x0 + width * (bay + 1) - 0.03
            while x < end_x - 0.12:
                seed = (seed * 1103515245 + 12345) % 2147483648
                w = 0.022 + 0.018 * (seed % 100) / 100
                height = 0.2 + 0.1 * ((seed // 100) % 100) / 100
                mat = m[colors[(seed // 10000) % len(colors)]]
                box(p.bm(mat), (x + w / 2, (y0 + y1) / 2 + 0.01, z + height / 2), (w, 0.17, height), 0.003)
                x += w + 0.002
    profiles = {
        "terra": [(0.0, 0.0), (0.05, 0.0), (0.07, 0.06), (0.06, 0.13), (0.03, 0.17), (0.035, 0.2), (0.0, 0.2)],
        "linen": [(0.0, 0.0), (0.06, 0.0), (0.1, 0.05), (0.11, 0.09), (0.0, 0.08)],
        "indigo": [(0.0, 0.0), (0.04, 0.0), (0.045, 0.12), (0.025, 0.16), (0.0, 0.16)],
        "sage": [(0.0, 0.0), (0.07, 0.0), (0.075, 0.1), (0.0, 0.1)],
    }
    for (li, bay), mat in decor.items():
        center = (x0 + width * (bay + 0.5), (y0 + y1) / 2, Z0 + SHELF["levels"][li] + 0.025)
        lathe(p.bm(m[mat]), profiles[mat], center, 28)
    # A trailing pothos at the shelf's south end, spilling over the top board.
    pot_at = (x0 + 0.22, (y0 + y1) / 2, ledge)
    lathe(p.bm(m["terra"]), [(0.0, 0.0), (0.07, 0.0), (0.09, 0.13), (0.0, 0.12)], pot_at, 24)
    leaves = p.bm(m["leaf"])
    for k in range(30):
        a = k * 2.39996
        r = 0.08 + 0.02 * (k % 3)
        drop = (0.02 + 0.05 * (k % 9)) if k % 2 else 0.01 * (k % 5)
        root = Vector((pot_at[0] + r * math.cos(a), pot_at[1] + 0.6 * r * math.sin(a), pot_at[2] + 0.12 - drop))
        tip = root + Vector((0.06 * math.cos(a), 0.05 * math.sin(a), -0.03))
        side = (tip - root).cross(Vector((0, 0, 1))).normalized() * 0.03
        mid = root.lerp(tip, 0.5)
        leaves.faces.new([leaves.verts.new(v) for v in (root, mid + side, tip, mid - side)])


def build_rug(p, m):
    """A wool rug under the chair: oatmeal field, indigo border."""
    box(p.bm(m["linen"]), (-0.35, -3.25, Z0 + 0.006), (2.2, 2.2, 0.012), 0.004)
    for (cx, cy, sx, sy) in ((-0.35, -2.2, 2.2, 0.08), (-0.35, -4.3, 2.2, 0.08), (-1.4, -3.25, 0.08, 2.2), (0.7, -3.25, 0.08, 2.2)):
        box(p.bm(m["indigo"]), (cx, cy, Z0 + 0.0125), (sx, sy, 0.002), 0.0)


def build_pinboard(p, m):
    """Sketches pinned on a cork board, hung on the bedroom screen's study side above the 43-inch."""
    x = -1.78 + 0.03
    cy, cz = -3.15, Z0 + 1.82
    w, h = 0.78, 0.5
    box(p.bm(m["cork"]), (x + 0.01, cy, cz), (0.02, w, h), 0.004)
    box(p.bm(m["oak"]), (x + 0.012, cy, cz + h / 2), (0.03, w + 0.03, 0.03), 0.006)
    box(p.bm(m["oak"]), (x + 0.012, cy, cz - h / 2), (0.03, w + 0.03, 0.03), 0.006)
    for (dy, dz, cw, ch) in ((-0.25, 0.1, 0.16, 0.12), (-0.05, 0.12, 0.13, 0.16), (0.17, 0.09, 0.18, 0.13), (-0.2, -0.12, 0.15, 0.11), (0.05, -0.1, 0.18, 0.13), (0.25, -0.13, 0.1, 0.1)):
        box(p.bm(m["paper"]), (x + 0.0215, cy + dy, cz + dz), (0.003, cw, ch), 0.0)
        box(p.bm(m["terra"]), (x + 0.026, cy + dy, cz + dz + ch / 2 - 0.02), (0.008, 0.012, 0.012), 0.003)


def build_plant(p, m):
    """A fiddle-leaf fig in a tall stoneware pot by the onsen screen, out of the camera's orbit."""
    px, py = 1.55, -3.0
    lathe(p.bm(m["linen"]), [(0.0, 0.0), (0.15, 0.0), (0.19, 0.08), (0.2, 0.42), (0.18, 0.44), (0.0, 0.42)], (px, py, Z0), 32)
    stem, leaves = p.bm(m["smoked"]), p.bm(m["leaf"])
    cylinder(stem, (px, py, Z0 + 0.42), (px + 0.03, py - 0.02, Z0 + 1.55), 0.014, 8)
    for k in range(28):
        z = Z0 + 0.85 + k * 0.026
        a = k * 2.39996
        root = Vector((px + 0.015 + 0.01 * math.cos(a), py + 0.01 * math.sin(a), z))
        tip = root + Vector((0.2 * math.cos(a), 0.2 * math.sin(a), 0.06 + 0.04 * math.sin(k * 1.7)))
        side = (tip - root).cross(Vector((0, 0, 1))).normalized() * 0.07
        mid = root.lerp(tip, 0.55)
        leaves.faces.new([leaves.verts.new(v) for v in (root, mid + side, tip, mid - side)])


def build_office(scene):
    """Remove the old study and furnish the office; returns objects and the props' anchor data."""
    removed = 0
    for obj in [o for o in scene.objects if o.name.startswith("study_")]:
        bpy.data.objects.remove(obj, do_unlink=True)
        removed += 1
    m = office_materials()
    p = Parts("study")
    build_desk(p, m)
    yaw43 = build_monitor(p, m, MONITOR_43, EYE, "43")
    yaw32 = build_monitor(p, m, MONITOR_32, EYE, "32")
    build_keyboard(p, m)
    build_laptop(p, m)
    build_pc(p, m)
    build_chair(p, m)
    build_footrest(p, m)
    bulb = build_lamp(p, m)
    build_shelf(p, m)
    build_rug(p, m)
    build_pinboard(p, m)
    build_plant(p, m)
    objects = p.finish()
    return objects, {"removed": removed, "lampBulb": bulb, "monitorYaw": {"43": yaw43, "32": yaw32}}
