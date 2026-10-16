"""The gym as its own rock-cut room north of the lounge, and the living room it leaves behind
(Sirui, 2026-10-15: "expand the house and move the gym to a separate room on first floor on left
side of the living room so we have proper living room and a separate gym").

The gym is a single-storey chamber carved into the cliff beside the main arch, reached through a
short passage in the lounge's north wall, with its own glazed mouth facing the sunset. Its
stations are data (STATIONS), shared by the room builder, the web manifest (equipment.gym) and the
clip and prop code, so a lift, its bar and its props always agree.

Coordinates are Blender's: metres, Z up, +Y toward the sea (west), +X north. The manifest stores
the same points through coastal_landscape.web(), as three.js (x, z, -y).
"""

import math
import bmesh
import bpy
from mathutils import Matrix, Vector

import coastal_decor as decor

# The chamber: an axis-aligned room whose sea front follows the cliff, set inside solid rock at
# every height (the cliff's foot is undercut by up to a metre here), under a segmental vault.
ROOM = {"x0": 6.0, "x1": 11.0, "back": -1.0, "spring": 2.65, "crown": 3.55, "bottom": -0.40}
FRONT = ((6.0, 2.8), (11.0, 6.5))  # the glass line, plan view
# Through the lounge's north wall, between the jute sun and the potted olive.
PASSAGE = {"x0": 4.55, "x1": 6.25, "y0": 1.0, "y1": 2.1, "spring": 1.95, "crown": 2.35}


def front_y(x):
    (x0, y0), (x1, y1) = FRONT
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0)


# Stations. A lifter faces +Y (the sea and the room camera) except on the bench. "actor" is the
# floor point between the feet (between the hips for the bench), "bar" a bar's centre, bars run
# along X unless noted. Heights are absolute (the floor is z = 0).
STATIONS = {
    "rack": {
        # A full power rack against the back wall: front posts at y = 0.05, rear at y = -0.75.
        "posts": {"x": (8.2, 9.4), "y": (-0.75, 0.05), "top": 2.45},
        # The bar rests in J-cups on the inside of the front posts, a little below the shoulders of
        # a standing lifter, so it lifts off as they stand up under it. A bar is longer than the
        # cage is wide, so every lift that starts here happens inside the cage and the bar never
        # has to pass a post: the lifter faces the room throughout.
        "bar": (8.8, -0.05, 1.28),
        # Back squats: back under the bar from the room side ("unrack"), stand, two steps back
        # into the cage ("actor").
        "unrack": (8.8, 0.025, 0.0),
        "actor": (8.8, -0.35, 0.0),
        # Presses and front squats: duck under the bar into the cage, turn, take the bar onto the
        # front of the shoulders ("pressUnrack"), step back ("press").
        "pressUnrack": (8.8, -0.18, 0.0),
        "press": (8.8, -0.45, 0.0),
        # Where a lifter waits outside the cage, in line with the bar.
        "entry": (8.8, 0.45, 0.0),
        "safeties": 0.82,
    },
    "pullup": {
        # A wall-mounted frame in the back corner right of the rack: two uprights against the wall,
        # long top arms carrying the bar out over the floor, so the lifter hangs between the wall
        # and the bar facing the room, and the face stays behind the bar as the chin clears it. The
        # bar is low enough (2.15 m) to reach with a small jump.
        "frame": {"x": (9.94, 10.66), "y": -0.92, "top": 2.4},
        "bar": (10.3, 0.2, 2.15),
        "grip": 0.3,
        "actor": (10.3, 0.0, 0.0),
    },
    "dip": {
        # Parallel dip bars off the same uprights at hip height, wider than any of the figures'
        # shoulders so they can step between them; set behind the pull-up bar so a dipper's head
        # never meets it. The lifter faces the room.
        "bars": {"x": (9.94, 10.66), "y": (-0.92, -0.3), "z": 1.24},
        "handles": ((9.94, -0.55, 1.24), (10.66, -0.55, 1.24)),
        "actor": (10.3, -0.55, 0.0),
    },
    "platform": {
        # A deadlift platform in front of the rack; the bar waits on it, plates on.
        "center": (8.8, 1.78, 0.0),
        "size": (2.4, 1.3),
        "bar": (8.8, 1.70, 0.225),
        # Bar over mid-foot: the shins just touch it.
        "actor": (8.8, 1.63, 0.0),
    },
    "bench": {
        # A flat-to-incline bench with its own uprights along the north wall. The bench runs along
        # X; the lifter lies on it head toward +X, feet on the floor toward -X.
        "pad": {"x": (9.62, 10.86), "y": 2.65, "top": 0.45},
        "uprights": 10.74,
        "bar": (10.60, 2.65, 1.06),
        "barAxis": "y",
        # Under the hips; "facing" is the direction the head points.
        "actor": (10.18, 2.65, 0.0),
        "facing": "+x",
        "inclineDegrees": 32,
    },
    "dumbbells": {
        # A two-tier rack along the south wall; the working pair waits on the top tier.
        "rack": {"x": (6.18, 6.56), "y": (-0.85, 0.75), "tiers": (0.38, 0.72)},
        "pair": ((6.42, -0.06, 0.745), (6.42, 0.24, 0.745)),
        "actor": (7.0, 0.1, 0.0),
    },
    "whiteboard": {
        # On the back wall left of the rack, facing the room camera.
        "center": (7.25, -0.965, 1.55),
        "size": (1.4, 0.95),
        "actor": (7.25, -0.45, 0.0),
    },
    # The plate tree by the glass on the passage side, out of every walking line.
    "plates": {"tree": (6.95, 2.95, 0.0)},
    # Between sets: a water bottle on the bench end, a towel over it.
    "rest": {"actor": (7.6, 1.25, 0.0), "seat": (9.78, 2.65, 0.45), "bottle": (9.66, 2.38, 0.0)},
}

# Plate sizes (lb) and their radii and thicknesses (m): competition-style bumper diameters for the
# big plates, iron change plates for the small ones.
PLATES = {45: (0.225, 0.062), 35: (0.21, 0.052), 25: (0.18, 0.042), 10: (0.13, 0.028), 5: (0.105, 0.022), 2.5: (0.085, 0.016)}

# The new living room, in the middle bay the gym leaves: a sofa facing the sea, a low table, a rug
# that joins the reading corner, and a record console behind the sofa (the house's records).
LIVING = {
    "sofa": {"x": (-1.15, 1.15), "y": (0.42, 1.38), "seat": 0.43, "back": 0.82},
    "table": {"center": (0.0, 2.18), "size": (1.2, 0.62), "top": 0.41},
    "rug": {"x": (-1.65, 1.65), "y": (0.15, 3.25)},
    "console": {"x": (-0.95, 0.95), "y": (-0.32, 0.12), "top": 0.62},
    "lamp": (-1.42, 0.62),
}


def arch_profile(a, b, bottom, spring, crown, n=28):
    """A wall-and-vault outline (u, z): walls from `bottom` to the springing, then a segmental arc."""
    centre, half, rise = (a + b) / 2, (b - a) / 2, crown - spring
    radius = (half * half + rise * rise) / (2 * rise)
    cz = crown - radius
    start = math.atan2(spring - cz, half)
    points = [(a, bottom), (b, bottom), (b, spring)]
    for k in range(1, n):
        angle = start + (math.pi - 2 * start) * k / n
        points.append((centre + radius * math.cos(angle), cz + radius * math.sin(angle)))
    points.append((a, spring))
    return points


def vault_height(x):
    """The chamber's ceiling height above a plan point at x."""
    a, b = ROOM["x0"], ROOM["x1"]
    centre, half, rise = (a + b) / 2, (b - a) / 2, ROOM["crown"] - ROOM["spring"]
    radius = (half * half + rise * rise) / (2 * rise)
    cz = ROOM["crown"] - radius
    dx = min(abs(x - centre), half)
    return max(ROOM["spring"], cz + math.sqrt(max(0.0, radius * radius - dx * dx)))


def extrusion(name, profile, axis, start, end, mat):
    """A closed prism: `profile` (u, z) swept along `axis` ('x' or 'y') from start to end."""
    bm = bmesh.new()
    rings = []
    for along in (start, end):
        ring = []
        for u, z in profile:
            co = (along, u, z) if axis == "x" else (u, along, z)
            ring.append(bm.verts.new(co))
        rings.append(ring)
    n = len(profile)
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[1])
    for k in range(n):
        bm.faces.new((rings[0][k], rings[0][(k + 1) % n], rings[1][(k + 1) % n], rings[1][k]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    if bm.calc_volume(signed=True) < 0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    return decor.from_bmesh(name, bm, mat, smooth=False)


def slab(bm, outline, z0, z1):
    """A flat polygonal slab between z0 and z1."""
    bottom = [bm.verts.new((x, y, z0)) for x, y in outline]
    top = [bm.verts.new((x, y, z1)) for x, y in outline]
    bm.faces.new(list(reversed(bottom)))
    bm.faces.new(top)
    n = len(outline)
    for k in range(n):
        bm.faces.new((bottom[k], bottom[(k + 1) % n], top[(k + 1) % n], top[k]))


def rounded_box(bm, center, size, radius=0.01):
    """A box with softened edges (a bevelled cube), so close-ups never show knife-sharp corners."""
    temp = bmesh.new()
    bmesh.ops.create_cube(temp, size=1, matrix=Matrix.Translation(center) @ Matrix.Diagonal((*size, 1)))
    if radius > 0:
        bmesh.ops.bevel(temp, geom=list(temp.edges), offset=min(radius, min(size) * 0.45), segments=2, affect="EDGES", profile=0.5)
    data = bpy.data.meshes.new("tmp")
    temp.to_mesh(data)
    temp.free()
    bm.from_mesh(data)
    bpy.data.meshes.remove(data)


class Parts:
    """Collects geometry per material; each material becomes one batched object."""

    def __init__(self, prefix):
        self.prefix = prefix
        self.groups = {}

    def bm(self, mat):
        if mat.name not in self.groups:
            self.groups[mat.name] = (mat, bmesh.new())
        return self.groups[mat.name][1]

    def finish(self, smooth_names=()):
        objects = []
        for name, (mat, bm) in self.groups.items():
            if not bm.verts:
                bm.free()
                continue
            obj = decor.from_bmesh(f"{self.prefix}__{name}", bm, mat, smooth=name in smooth_names)
            objects.append(obj)
        return objects


def barbell_plates(weight):
    """Plates per side for a total weight on a 45 lb bar, heaviest first."""
    side = max(0.0, (weight - 45) / 2)
    out = []
    for plate in (45, 35, 25, 10, 5, 2.5):
        while side >= plate - 1e-6:
            out.append(plate)
            side -= plate
    return out


def _material(name, color, roughness, metallic=0.0):
    return bpy.data.materials.get(name) or decor.material(name, color, roughness, metallic)


def gym_materials():
    return {
        "steel": _material("powder coated gym steel", (0.045, 0.064, 0.063), 0.44, 0.52),
        "rubber": _material("gym rubber", (0.026, 0.030, 0.028), 0.91),
        "chrome": _material("barbell brushed steel", (0.42, 0.46, 0.46), 0.26, 0.86),
        "pad": _material("saddle bench upholstery", (0.21, 0.095, 0.046), 0.72),
        "oak": bpy.data.materials["pale oak"],
        "ash": bpy.data.materials["honey ash"],
        "board": _material("whiteboard enamel", (0.92, 0.93, 0.92), 0.22),
        "frame": _material("satin appliance stainless", (0.45, 0.49, 0.48), 0.30, 0.72),
        "label": bpy.data.materials["sage textile"],
        "linen": bpy.data.materials["linen"],
        "ink": bpy.data.materials["charcoal"],
        "terra": bpy.data.materials["terracotta"],
        "brass": bpy.data.materials["brushed brass"],
        "jute": bpy.data.materials["woven jute"],
        "diffuser": _material("gym light diffuser", (0.86, 0.86, 0.84), 0.5),
        "concrete": _material("gym polished concrete", (0.46, 0.45, 0.42), 0.55),
        "fig": _material("fiddle fig leaf", (0.16, 0.27, 0.11), 0.55),
        "vinyl": _material("record sleeve card", (0.62, 0.52, 0.42), 0.8),
        "glaze": bpy.data.materials.get("celadon glaze") or _material("celadon glaze", (0.55, 0.66, 0.58), 0.25),
    }


def build_rack(parts, m):
    s = STATIONS["rack"]
    (xa, xb), (yr, yf), top = s["posts"]["x"], s["posts"]["y"], s["posts"]["top"]
    steel, chrome, rubber = parts.bm(m["steel"]), parts.bm(m["chrome"]), parts.bm(m["rubber"])
    bx, by, bz = s["bar"]
    for x in (xa, xb):
        inward = 1 if x == xa else -1
        for y in (yr, yf):
            rounded_box(steel, (x, y, top / 2), (0.075, 0.075, top), 0.006)
            rounded_box(steel, (x, y, 0.02), (0.22, 0.22, 0.04), 0.006)
            # Numbered adjustment holes down the inner face.
            for k in range(18):
                rounded_box(rubber, (x + inward * 0.039, y, 0.42 + k * 0.09), (0.004, 0.022, 0.022), 0.0)
        # Side braces at the top and the floor, and the safety arms.
        rounded_box(steel, (x, (yr + yf) / 2, top - 0.04), (0.07, yf - yr + 0.075, 0.07), 0.006)
        rounded_box(steel, (x, (yr + yf) / 2, 0.06), (0.07, yf - yr + 0.075, 0.05), 0.006)
        rounded_box(steel, (x, (yr + yf) / 2 + 0.12, s["safeties"]), (0.07, yf - yr + 0.5, 0.055), 0.006)
        # J-cups on the inside of the front posts, opening into the cage.
        rounded_box(steel, (x, yf - 0.06, bz - 0.04), (0.09, 0.15, 0.03), 0.006)
        rounded_box(steel, (x, yf - 0.125, bz), (0.09, 0.02, 0.07), 0.006)
    # Crossmembers front and back at the top, and a rear one low down.
    for y in (yr, yf):
        rounded_box(steel, ((xa + xb) / 2, y, top - 0.04), (xb - xa + 0.075, 0.07, 0.07), 0.006)
    rounded_box(steel, ((xa + xb) / 2, yr, 0.12), (xb - xa, 0.07, 0.08), 0.006)


def build_tower(parts, m):
    """The wall-mounted pull-up and dip station in the back corner right of the rack."""
    p, d = STATIONS["pullup"], STATIONS["dip"]
    (xa, xb), y, top = p["frame"]["x"], p["frame"]["y"], p["frame"]["top"]
    steel, chrome, rubber = parts.bm(m["steel"]), parts.bm(m["chrome"]), parts.bm(m["rubber"])
    bx, by, bz = p["bar"]
    for x in (xa, xb):
        rounded_box(steel, (x, y, top / 2), (0.075, 0.075, top), 0.006)
        # Wall plates, and a foot reaching under the dip bars.
        for z in (0.45, top - 0.35):
            rounded_box(steel, (x, ROOM["back"] + 0.028, z), (0.14, 0.056, 0.26), 0.006)
        rounded_box(steel, (x, (y + d["bars"]["y"][1]) / 2, 0.025), (0.08, d["bars"]["y"][1] - y + 0.1, 0.05), 0.006)
        # Top arms out to the bar.
        rounded_box(steel, (x, (y + by) / 2, bz), (0.06, by - y + 0.06, 0.06), 0.006)
        # Dip bars with a brace back to the upright.
        y0, y1 = d["bars"]["y"]
        dz = d["bars"]["z"]
        decor.cylinder(steel, (x, y0, dz), (x, y1 - 0.06, dz), 0.024, segments=14)
        decor.cylinder(rubber, (x, y1 - 0.34, dz), (x, y1, dz), 0.027, segments=16)
        decor.cylinder(steel, (x, y, dz - 0.38), (x, (y0 + y1) / 2, dz - 0.01), 0.018, segments=10)
    decor.cylinder(chrome, (xa - 0.03, by, bz), (xb + 0.03, by, bz), 0.016, segments=16)


def build_platform(parts, m):
    s = STATIONS["platform"]
    cx, cy, _ = s["center"]
    w, d = s["size"]
    oak, rubber, ash = parts.bm(m["oak"]), parts.bm(m["rubber"]), parts.bm(m["ash"])
    # Oak centre for the lifter, rubber either side where the plates land.
    rounded_box(oak, (cx, cy, 0.012), (0.9, d, 0.024), 0.004)
    for side in (-1, 1):
        rounded_box(rubber, (cx + side * (0.45 + (w - 0.9) / 4), cy, 0.012), ((w - 0.9) / 2, d, 0.024), 0.004)
    for k in range(1, 3):
        rounded_box(ash, (cx - 0.45 + k * 0.3, cy, 0.025), (0.004, d - 0.02, 0.002), 0.0)


def build_bench(parts, props, m):
    s = STATIONS["bench"]
    (x0, x1), y, top = s["pad"]["x"], s["pad"]["y"], s["pad"]["top"]
    steel, rubber = parts.bm(m["steel"]), parts.bm(m["rubber"])
    middle = (x0 + x1) / 2
    rounded_box(steel, (middle, y, 0.17), (x1 - x0 - 0.1, 0.07, 0.07), 0.008)
    for x in (x0 + 0.08, x1 - 0.08):
        rounded_box(steel, (x, y, 0.05), (0.07, 0.5, 0.06), 0.008)
        for side in (-1, 1):
            rounded_box(rubber, (x, y + side * 0.22, 0.03), (0.09, 0.08, 0.06), 0.01)
        rounded_box(steel, (x + (0.12 if x < middle else -0.12), y, 0.3), (0.06, 0.06, 0.26), 0.006)
    # Uprights with J-hooks at the head end.
    ux = s["uprights"]
    bz = s["bar"][2]
    for side in (-1, 1):
        uy = y + side * 0.56
        rounded_box(steel, (ux, uy, 0.62), (0.06, 0.06, 1.24), 0.006)
        rounded_box(steel, (ux, uy, 0.04), (0.42, 0.08, 0.05), 0.006)
        rounded_box(steel, (ux - 0.05, uy, bz - 0.035), (0.13, 0.08, 0.03), 0.006)
        rounded_box(steel, (ux - 0.105, uy, bz), (0.02, 0.08, 0.07), 0.006)
    rounded_box(steel, (ux, y, 1.18), (0.05, 1.12, 0.05), 0.006)
    # Seat (fixed) and backrest (a prop, raised for incline presses).
    seat = bmesh.new()
    rounded_box(seat, (x0 + 0.2, y, top - 0.055), (0.38, 0.29, 0.1), 0.035)
    props.append(("gym_bench_seat", seat, m["pad"], None))
    back = bmesh.new()
    rounded_box(back, ((x0 + 0.42 + x1) / 2, y, top - 0.055), (x1 - x0 - 0.44, 0.29, 0.1), 0.035)
    props.append(("gym_bench_backrest", back, m["pad"], {"activityProp": "bench-backrest", "hinge": [x0 + 0.42, y, top - 0.055]}))


def _dumbbell(bm_metal, bm_rubber, center, weight):
    """A hex dumbbell along X of a given weight (lb); the heads grow with the weight."""
    head = 0.045 + 0.0016 * weight
    half = 0.07 + 0.0006 * weight
    c = Vector(center)
    d = Vector((1, 0, 0))
    decor.cylinder(bm_metal, c - d * half, c + d * half, 0.016, segments=12)
    for side in (-1, 1):
        a = c + d * side * half
        b = c + d * side * (half + 0.035 + 0.0012 * weight)
        decor.cylinder(bm_rubber, a, b, head, segments=6)


def build_dumbbells(parts, props, m):
    s = STATIONS["dumbbells"]
    (x0, x1), (y0, y1), tiers = s["rack"]["x"], s["rack"]["y"], s["rack"]["tiers"]
    steel, rubber, chrome = parts.bm(m["steel"]), parts.bm(m["rubber"]), parts.bm(m["chrome"])
    for y in (y0 + 0.05, y1 - 0.05):
        rounded_box(steel, ((x0 + x1) / 2, y, 0.02), (x1 - x0, 0.08, 0.04), 0.006)
        rounded_box(steel, (x1 - 0.05, y, tiers[1] / 2), (0.05, 0.05, tiers[1]), 0.006)
        rounded_box(steel, (x0 + 0.05, y, tiers[0] / 2), (0.05, 0.05, tiers[0]), 0.006)
    for tier, x in zip(tiers, (x0 + 0.1, x1 - 0.12)):
        rounded_box(steel, (x, (y0 + y1) / 2, tier), (0.2, y1 - y0, 0.025), 0.004)
    # Pairs from 15 to 60 lb along the tiers; the working pair (35 lb) is a prop on the top tier.
    weights = [15, 20, 25, 30, 40, 45, 50, 60]
    slots = [y0 + 0.13 + k * (y1 - y0 - 0.26) / 9 for k in range(10)]
    working = [p[1] for p in s["pair"]]
    k = 0
    for tier, x, row in ((tiers[1], x1 - 0.12, range(10)), (tiers[0], x0 + 0.1, (0, 2, 4, 6, 8))):
        for slot in row:
            y = slots[slot]
            if tier == tiers[1] and any(abs(y - w) < 0.09 for w in working):
                continue
            _dumbbell(chrome, rubber, (x, y, tier + 0.06), weights[k % len(weights)])
            k += 1
    for side, (px, py, pz) in zip(("right", "left"), s["pair"]):
        metal, head = bmesh.new(), bmesh.new()
        _dumbbell(metal, head, (px, py, pz), 35)
        props.append((f"gym_working_dumbbell_{side}_handle", metal, m["chrome"], {"activityProp": f"exercise-weight-{side}"}))
        props.append((f"gym_working_dumbbell_{side}_head", head, m["rubber"], {"activityProp": f"exercise-weight-{side}"}))


def build_whiteboard(parts, props, m):
    s = STATIONS["whiteboard"]
    cx, cy, cz = s["center"]
    w, h = s["size"]
    frame = parts.bm(m["frame"])
    for dz in (-h / 2, h / 2):
        rounded_box(frame, (cx, cy + 0.012, cz + dz), (w + 0.04, 0.03, 0.03), 0.006)
    for dx in (-w / 2, w / 2):
        rounded_box(frame, (cx + dx, cy + 0.012, cz), (0.03, 0.03, h + 0.04), 0.006)
    rounded_box(frame, (cx, cy + 0.045, cz - h / 2 - 0.025), (w * 0.6, 0.06, 0.012), 0.004)
    for k, mat in enumerate((m["ink"], m["terra"], m["label"])):
        x = cx - 0.15 + k * 0.12
        decor.cylinder(parts.bm(mat), (x, cy + 0.05, cz - h / 2 - 0.012), (x + 0.11, cy + 0.05, cz - h / 2 - 0.012), 0.008, segments=8)
    # The writing surface carries UVs so the scene can draw the training board on it.
    face = bmesh.new()
    uv = face.loops.layers.uv.new("UVMap")
    corners = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    verts = [face.verts.new((cx + u, cy + 0.006, cz + v)) for u, v in corners]
    poly = face.faces.new(verts)
    poly.normal_update()
    if poly.normal.y < 0:
        bmesh.ops.reverse_faces(face, faces=[poly])
    for loop in poly.loops:
        co = loop.vert.co
        loop[uv].uv = ((co.x - cx) / w + 0.5, (co.z - cz) / h + 0.5)
    props.append(("gym_whiteboard_face", face, m["board"], {"activityProp": "whiteboard", "whiteboardSize": [w, h]}))


def build_plate_tree(parts, m):
    x, y, _ = STATIONS["plates"]["tree"]
    steel, rubber, label = parts.bm(m["steel"]), parts.bm(m["rubber"]), parts.bm(m["label"])
    rounded_box(steel, (x, y, 0.03), (0.5, 0.5, 0.05), 0.008)
    decor.cylinder(steel, (x, y, 0.05), (x, y, 1.15), 0.03, segments=12)
    # Horns at three heights on two sides, holding the plates that are not on the bars.
    stacks = {(-1, 0.32): (45, 45, 45), (1, 0.32): (45, 45, 35), (-1, 0.66): (25, 25, 25), (1, 0.66): (10, 10, 10), (-1, 0.95): (5, 5, 5), (1, 0.95): (2.5, 2.5, 2.5)}
    for (side, z), plates in stacks.items():
        decor.cylinder(steel, (x, y, z), (x, y + side * 0.2, z), 0.022, segments=10)
        offset = 0.04
        for plate in plates:
            r, t = PLATES[plate]
            decor.cylinder(rubber, (x, y + side * offset, z), (x, y + side * (offset + t), z), r, segments=28)
            decor.cylinder(label, (x, y + side * (offset + t + 0.001), z), (x, y + side * (offset + t + 0.002), z), r * 0.3, segments=16)
            offset += t + 0.004


def build_rest_corner(parts, m):
    s = STATIONS["rest"]
    bx, by, _ = s["bottle"]
    # A steel bottle on the floor by the bench, and a towel over the bench end.
    decor.lathe(parts.bm(m["frame"]), [(0.0, 0.0), (0.036, 0.0), (0.038, 0.02), (0.038, 0.2), (0.028, 0.235), (0.02, 0.25), (0.0, 0.25)], (bx, by, 0.0), 24)
    sx, sy, sz = s["seat"]
    linen = parts.bm(m["linen"])
    rounded_box(linen, (sx + 0.05, sy, sz + 0.012), (0.34, 0.3, 0.012), 0.004)
    for side in (-1, 1):
        rounded_box(linen, (sx + 0.05, sy + side * 0.155, sz - 0.12), (0.34, 0.012, 0.24), 0.004)


def build_lights(parts, m):
    # A long linear pendant over the lifting bay and a short one over the bench, hung from the vault.
    ink, diffuser = parts.bm(m["ink"]), parts.bm(m["diffuser"])
    for (x0, x1, y) in ((7.0, 10.4, 0.9), (9.6, 10.8, 2.65)):
        z = vault_height((x0 + x1) / 2) - 0.6
        rounded_box(ink, ((x0 + x1) / 2, y, z + 0.03), (x1 - x0, 0.07, 0.05), 0.01)
        rounded_box(diffuser, ((x0 + x1) / 2, y, z), (x1 - x0 - 0.04, 0.055, 0.012), 0.004)
        for x in (x0 + 0.15, x1 - 0.15):
            decor.cylinder(ink, (x, y, z + 0.05), (x, y, vault_height(x) + 0.05), 0.003, segments=6)


def build_floor_tiles(parts, m):
    rubber = parts.bm(m["rubber"])
    p = STATIONS["platform"]
    pcx, pcy, _ = p["center"]
    pw, pd = p["size"]
    x0, x1, back = ROOM["x0"], ROOM["x1"], ROOM["back"]
    size = 0.5
    for i in range(int(round((x1 - x0) / size))):
        for j in range(int((front_y(x1) - back) / size)):
            cx, cy = x0 + (i + 0.5) * size, back + (j + 0.5) * size
            if cy + size / 2 > front_y(cx) - 0.25:
                continue
            if abs(cx - pcx) < pw / 2 + 0.2 and abs(cy - pcy) < pd / 2 + 0.2:
                continue
            rounded_box(rubber, (cx, cy, 0.009), (size - 0.006, size - 0.006, 0.018), 0.002)


def build_gym(m):
    """All gym equipment: batched static parts per material, plus separate props."""
    parts, props = Parts("gym"), []
    build_floor_tiles(parts, m)
    build_rack(parts, m)
    build_tower(parts, m)
    build_platform(parts, m)
    build_bench(parts, props, m)
    build_dumbbells(parts, props, m)
    build_whiteboard(parts, props, m)
    build_plate_tree(parts, m)
    build_rest_corner(parts, m)
    build_lights(parts, m)
    objects = parts.finish(smooth_names=("saddle bench upholstery", "linen"))
    for name, bm, mat, tags in props:
        obj = decor.from_bmesh(name, bm, mat, smooth=True)
        for key, value in (tags or {}).items():
            obj[key] = value
        objects.append(obj)
    return objects


def build_living(m):
    """The middle bay as a living room: sofa, low table, rug, record console, lamp and a fig."""
    parts = Parts("lounge_living")
    s = LIVING["sofa"]
    (x0, x1), (y0, y1), seat, back = s["x"], s["y"], s["seat"], s["back"]
    linen, oak, ink = parts.bm(m["linen"]), parts.bm(m["oak"]), parts.bm(m["ink"])
    # Plinth, three seat cushions, three back cushions and two arms, all softly rounded.
    rounded_box(linen, ((x0 + x1) / 2, (y0 + y1) / 2, 0.2), (x1 - x0, y1 - y0, 0.2), 0.05)
    width = (x1 - x0 - 0.36) / 3
    for k in range(3):
        cx = x0 + 0.18 + width * (k + 0.5)
        rounded_box(linen, (cx, (y0 + y1) / 2 + 0.06, seat - 0.06), (width - 0.02, y1 - y0 - 0.26, 0.14), 0.06)
        rounded_box(linen, (cx, y0 + 0.13, (seat + back) / 2 + 0.04), (width - 0.03, 0.2, back - seat + 0.02), 0.08)
    for x in (x0 + 0.09, x1 - 0.09):
        rounded_box(linen, (x, (y0 + y1) / 2, 0.42), (0.18, y1 - y0, 0.36), 0.07)
    for x in (x0 + 0.08, x1 - 0.08):
        for y in (y0 + 0.08, y1 - 0.08):
            decor.cylinder(oak, (x, y, 0.0), (x, y, 0.1), 0.022, segments=10)
    # A low oak table with a stack of books and a celadon bowl.
    t = LIVING["table"]
    (cx, cy), (w, d), top = t["center"], t["size"], t["top"]
    rounded_box(oak, (cx, cy, top - 0.02), (w, d, 0.04), 0.015)
    for dx in (-w / 2 + 0.07, w / 2 - 0.07):
        rounded_box(oak, (cx + dx, cy, (top - 0.04) / 2), (0.05, d - 0.08, top - 0.04), 0.01)
    rounded_box(oak, (cx, cy, 0.08), (w - 0.16, d - 0.16, 0.02), 0.006)
    heights = (0.035, 0.03, 0.028)
    for k, mat in enumerate((m["terra"], m["linen"], m["label"])):
        rounded_box(parts.bm(mat), (cx - 0.3, cy - 0.05, top + heights[k] / 2 + sum(heights[:k])), (0.26 - k * 0.02, 0.19 - k * 0.01, heights[k]), 0.004)
    decor.lathe(parts.bm(m["glaze"]), [(0.0, 0.0), (0.05, 0.0), (0.1, 0.03), (0.13, 0.07), (0.125, 0.075), (0.09, 0.04), (0.0, 0.035)], (cx + 0.28, cy + 0.04, top), 32)
    # A rug that runs under the sofa and toward the glass.
    r = LIVING["rug"]
    (rx0, rx1), (ry0, ry1) = r["x"], r["y"]
    rounded_box(parts.bm(m["jute"]), ((rx0 + rx1) / 2, (ry0 + ry1) / 2, 0.006), (rx1 - rx0, ry1 - ry0, 0.012), 0.004)
    # The record console behind the sofa: an oak credenza, a turntable and a run of sleeves.
    c = LIVING["console"]
    (cx0, cx1), (cy0, cy1), ctop = c["x"], c["y"], c["top"]
    mid = (cy0 + cy1) / 2
    rounded_box(oak, ((cx0 + cx1) / 2, mid, ctop / 2 + 0.025), (cx1 - cx0, cy1 - cy0, ctop - 0.05), 0.012)
    for x in (cx0 + 0.06, cx1 - 0.06):
        for y in (cy0 + 0.05, cy1 - 0.05):
            decor.cylinder(oak, (x, y, 0.0), (x, y, 0.05), 0.016, segments=8)
    rounded_box(ink, (cx1 - 0.3, mid, ctop + 0.03), (0.42, 0.34, 0.06), 0.01)
    decor.cylinder(ink, (cx1 - 0.33, mid, ctop + 0.06), (cx1 - 0.33, mid, ctop + 0.075), 0.15, segments=36)
    decor.cylinder(parts.bm(m["brass"]), (cx1 - 0.14, mid + 0.1, ctop + 0.09), (cx1 - 0.3, mid + 0.02, ctop + 0.09), 0.004, segments=6)
    for k in range(14):
        rounded_box(parts.bm(m["vinyl"] if k % 3 else m["terra"]), (cx0 + 0.08 + k * 0.022, mid, ctop + 0.155), (0.006, 0.31, 0.31), 0.0)
    # An arc floor lamp reaching over the sofa's end.
    lx, ly = LIVING["lamp"]
    brass = parts.bm(m["brass"])
    rounded_box(ink, (lx, ly, 0.02), (0.3, 0.3, 0.04), 0.01)
    arc = [(lx, ly, 0.04), (lx + 0.05, ly + 0.1, 1.2), (lx + 0.3, ly + 0.35, 1.75), (lx + 0.75, ly + 0.55, 1.85), (lx + 1.0, ly + 0.6, 1.72)]
    for a, b in zip(arc, arc[1:]):
        decor.cylinder(brass, a, b, 0.012, segments=8)
    decor.lathe(linen, [(0.0, 0.0), (0.16, 0.0), (0.1, 0.16), (0.0, 0.16)], (lx + 1.0, ly + 0.6, 1.52), 24)
    # A fiddle-leaf fig in a terracotta pot at the console's end.
    px, py = cx0 - 0.32, mid + 0.05
    decor.lathe(parts.bm(m["terra"]), [(0.0, 0.0), (0.16, 0.0), (0.2, 0.36), (0.21, 0.4), (0.0, 0.38)], (px, py, 0.0), 28)
    stem, leaves = parts.bm(m["ash"]), parts.bm(m["fig"])
    decor.cylinder(stem, (px, py, 0.38), (px + 0.03, py, 1.5), 0.014, segments=8)
    for k in range(22):
        z = 0.75 + k * 0.035
        a = k * 2.39996
        root = Vector((px + 0.015 + 0.01 * math.cos(a), py + 0.01 * math.sin(a), z))
        tip = root + Vector((0.2 * math.cos(a), 0.2 * math.sin(a), 0.06 + 0.04 * math.sin(k * 1.7)))
        side = (tip - root).cross(Vector((0, 0, 1))).normalized() * 0.07
        mid_leaf = root.lerp(tip, 0.55)
        leaves.faces.new([leaves.verts.new(v) for v in (root, mid_leaf + side, tip, mid_leaf - side)])
    objects = parts.finish(smooth_names=("linen",))
    for obj in objects:
        obj["livingRoom"] = True
    return objects
