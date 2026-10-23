"""Build the land around the coastal home as its own asset (Sirui, 2026-10-15).

Run with Blender 4.5 LTS from the repository root:
  blender -b --python-exit-code 1 --python bin/build_coastal_hinterland.py
  (add -- --preview to render review stills instead of baking and exporting)
then format what it writes:
  npx prettier --write assets/models/home/manifest.json artwork/coastal-home/reviews/hinterland.json

It reads the retained mainland's outer boundary from artwork/coastal-home/coastal-home.blend
(appended into a fresh file; the source is never saved), builds the mesa, canyons, coasts,
beaches, planting, lookout, gliderport and gliders designed in coastal_hinterland.py and
coastal_hinterland_props.py, bakes ambient occlusion into vertex colours with the mainland as an
occluder, exports assets/models/home/hinterland.glb (Draco), saves
artwork/coastal-home/hinterland.blend, and writes the manifest's `hinterland` key: the file, the wind
sock's node and pivot, the gliders' routes and the camera's terrain grid over the new land (which
assets/js/home-scene/hinterland.mjs merges into `cameraCollision` at runtime; that key is never
rewritten). `-- --fast` skips the bake, for quick looks in the browser; `-- --gpu` bakes on oneAPI.
"""

import json
import math
import sys
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import delaunay_2d_cdt
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_hinterland as H  # noqa: E402

SOURCE = ROOT / "artwork/coastal-home/coastal-home.blend"
TARGET = ROOT / "artwork/coastal-home/hinterland.blend"
MANIFEST = ROOT / "assets/models/home/manifest.json"
EXPORT = ROOT / "assets/models/home/hinterland.glb"
REVIEW = ROOT / "artwork/coastal-home/reviews/hinterland.json"
ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS
PREVIEW_DIR = ROOT / ".jekyll-cache/visual-qa/coastal-hinterland-2026-10-15/blender"
MAINLAND = ["core__golden coastal sandstone", "core_liftaway_cave_ceiling", "coast_shared_golden coastal sandstone", "coast_shared_dry beach sand"]
report = {"started": time.strftime("%Y-%m-%d %H:%M:%S")}
started = time.time()


def log(*items):
    print(f"[{time.time() - started:7.1f}s]", *items, flush=True)


# ---------------------------------------------------------------------------------------------
# A fresh file with the retained mainland appended (read-only on the source).

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
with bpy.data.libraries.load(str(SOURCE), link=False) as (src, dst):
    dst.objects = [name for name in src.objects if name in MAINLAND]
mainland = []
reference = bpy.data.collections.new("Retained mainland (bake occluder only)")
scene.collection.children.link(reference)
for obj in dst.objects:
    reference.objects.link(obj)
    mainland.append(obj)
assert len(mainland) == len(MAINLAND), [o.name for o in mainland]
# Where the retained clifftop is already planted or walked (flora.glb, the doorway and its
# stepping stones): read once so the transition planting keeps clear, then removed again.
with bpy.data.libraries.load(str(SOURCE), link=False) as (src, dst):
    dst.objects = [name for name in src.objects if name.startswith(("core_flora_", "core_landward_path", "core_entry", "core_recessed_entry"))]
occupied_points = []
for obj in dst.objects:
    step = 3 if obj.name.startswith("core_flora_") else 1
    co = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)[::step]
    mw = np.array(obj.matrix_world)
    occupied_points.extend((co @ mw[:3, :3].T + mw[:3, 3]).tolist())
    data = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.meshes.remove(data)
occupied_points = np.asarray(occupied_points)
bpy.context.view_layer.update()
block = bpy.data.objects["core__golden coastal sandstone"]
block_world = np.array([block.matrix_world @ v.co for v in block.data.vertices])


def snap(points, tolerance=2e-3):
    """Snap designed boundary points (n x 3) to the retained mesh's own vertices."""
    out = []
    worst = 0.0
    for p in points:
        d = np.linalg.norm(block_world - p, axis=1)
        i = int(np.argmin(d))
        worst = max(worst, float(d[i]))
        out.append(block_world[i])
    assert worst < tolerance, f"retained boundary moved: {worst:.4f} m"
    return np.asarray(out), worst


# The mainland's top surface is the grid coastal_section.py built: 225 columns 0.5 m apart along x
# and 41 rows from the back wall to the ridge. Its boundary vertices are snapped from the mesh.
xs = np.linspace(H.MAIN_X0, H.MAIN_X1, 225)
back = np.stack([xs, np.full_like(xs, H.MAIN_BACK), H.top_height(xs, H.MAIN_BACK)], 1)
back, back_err = snap(back)


def end_edge(x):
    rows = []
    shore = float(H.shoreline(x))
    for j in range(41):
        t = j / 40
        y = -32 + (shore + 32) * t
        z = float(H.top_height(x, y))
        y += (float(H.cliff_surface(x, z)) - shore) * t**8
        z = float(H.top_height(x, y))
        if j == 40:
            z = float(H.ridge(x))
            y = float(H.cliff_surface(x, z))
        rows.append((x, y, z))
    return np.asarray(rows)


south_end, south_err = snap(end_edge(H.MAIN_X0))
north_end, north_err = snap(end_edge(H.MAIN_X1))
report["retainedBoundary"] = {"backVertices": len(back), "endVertices": len(south_end), "maxSnapMetres": max(back_err, south_err, north_err)}
log("retained boundary snapped", report["retainedBoundary"])

# Normals and baked colours of the retained top surface along those edges, so the new ground meets
# it with the same shading.
corner_normals = block.data.corner_normals if hasattr(block.data, "corner_normals") else None
up_normals = {}
for poly in block.data.polygons:
    n = block.matrix_world.to_3x3() @ poly.normal
    if n.z < 0.35:
        continue
    for li in poly.loop_indices:
        vi = block.data.loops[li].vertex_index
        cn = block.matrix_world.to_3x3() @ (corner_normals[li].vector if corner_normals else poly.normal)
        up_normals.setdefault(vi, []).append(cn)
baked = {}
attr = block.data.color_attributes.active_color
if attr:
    sums, counts = {}, {}
    for loop, color in zip(block.data.loops, attr.data):
        sums[loop.vertex_index] = sums.get(loop.vertex_index, 0.0) + sum(color.color[:3]) / 3
        counts[loop.vertex_index] = counts.get(loop.vertex_index, 0) + 1
    baked = {i: round(sums[i] / counts[i] * 32) / 32 for i in sums}


def retained_shading(points):
    normals, shades = [], []
    for p in points:
        i = int(np.argmin(np.linalg.norm(block_world - p, axis=1)))
        ns = up_normals.get(i)
        normals.append(tuple((sum(ns, Vector()) / len(ns)).normalized()) if ns else (0.0, 0.0, 1.0))
        shades.append(baked.get(i, 0.95))
    return np.asarray(normals), np.asarray(shades)


# ---------------------------------------------------------------------------------------------
# Materials. Names route the browser's shading (assets/js/home-scene/realism.mjs): "sandstone"
# gets bedding, tafoni and clifftop soil; "sand"/"stone" a light grain; "beach"/"tideline" the
# wet-sand band; anything else the plain standard material. Vertex colours carry baked occlusion,
# and for the white-based ground the albedo too.


def material(name, color, roughness=0.9, double=True, metallic=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*color, 1)
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    m.use_backface_culling = not double
    return m


# Avoid "oak", "ash" (as in "wash"), "linen", "leaf" and the like in new names unless that shading
# is wanted: realism.mjs matches substrings.
MATS = {
    "golden": material("golden coastal sandstone", (0.62, 0.43, 0.265), 0.86),
    "bedding": material("warm sandstone bedding", (0.54, 0.385, 0.255), 0.89),
    "pale": material("pale torrey sandstone", (0.86, 0.77, 0.62), 0.88),
    "loam": material("hinterland sandy loam", (1.0, 1.0, 1.0), 0.95),
    "bluff": material("distant bluff stone", (1.0, 1.0, 1.0), 0.92),
    "trail": material("hinterland trail dust", (0.52, 0.44, 0.32), 0.96),
    "lawn": material("gliderport launch lawn", (0.42, 0.47, 0.22), 0.9),
    "sand": material("dry beach sand", (0.81, 0.69, 0.49), 0.96),
    "wet": material("wet tideline sand", (0.48, 0.40, 0.27), 0.30),
    # Planting, closed low-poly masses drawn one-sided.
    # One white-based canopy material carries every species' colour in its vertices, so a tile of
    # scrub is a single draw.
    "canopy": material("hinterland scrub canopy", (1.0, 1.0, 1.0), 0.88, double=False),
    "pine_trunk": material("hinterland pine trunk", (0.25, 0.18, 0.12), 0.9, double=False),
    # The lookout, the gliderport and the wind sock.
    "deck_wood": material("viewing deck wood", (0.5, 0.42, 0.33), 0.8, double=False),
    "bench_wood": material("bench slat wood", (0.46, 0.32, 0.2), 0.7, double=False),
    "bench_steel": material("bench frame steel", (0.13, 0.13, 0.13), 0.5, double=False, metallic=0.6),
    "viewer_enamel": material("coin viewer enamel", (0.04, 0.3, 0.34), 0.35, double=False),
    "viewer_steel": material("coin viewer steel", (0.56, 0.57, 0.59), 0.35, double=False, metallic=0.85),
    "fence_post": material("fence post wood", (0.37, 0.29, 0.2), 0.85, double=False),
    "fence_chain": material("fence chain steel", (0.24, 0.23, 0.22), 0.45, double=False, metallic=0.7),
    "mast_steel": material("windsock mast steel", (0.62, 0.63, 0.65), 0.4, double=False, metallic=0.8),
    "sock_orange": material("windsock nylon orange", (0.86, 0.26, 0.04), 0.6, double=True),
    "sock_white": material("windsock nylon white", (0.86, 0.86, 0.83), 0.6, double=True),
    # The gliders.
    "lines": material("glider lines", (0.32, 0.32, 0.33), 0.6, double=False),
    "harness": material("glider harness", (0.07, 0.07, 0.08), 0.7, double=False),
    "frame": material("glider frame aluminium", (0.7, 0.72, 0.75), 0.35, double=False, metallic=0.8),
    "sail": material("hang glider sail", (0.88, 0.88, 0.86), 0.55, double=True),
    "sail_trim": material("hang glider sail trim", (0.74, 0.08, 0.06), 0.55, double=True),
    "canopy_red": material("paraglider canopy red", (0.74, 0.07, 0.05), 0.55, double=False),
    "canopy_white": material("paraglider canopy white", (0.87, 0.87, 0.85), 0.55, double=False),
    "canopy_yellow": material("paraglider canopy yellow", (0.92, 0.66, 0.04), 0.55, double=False),
    "canopy_orange": material("paraglider canopy orange", (0.9, 0.3, 0.03), 0.55, double=False),
    "canopy_blue": material("paraglider canopy blue", (0.05, 0.2, 0.58), 0.55, double=False),
    "canopy_sky": material("paraglider canopy sky", (0.42, 0.68, 0.88), 0.55, double=False),
    "helmet_red": material("glider helmet red", (0.7, 0.06, 0.05), 0.4, double=False),
    "helmet_white": material("glider helmet white", (0.88, 0.88, 0.88), 0.4, double=False),
    "helmet_yellow": material("glider helmet yellow", (0.9, 0.7, 0.05), 0.4, double=False),
}


def make_mesh(name, verts, tris, mats, mat_index=None, normals=None, colors=None, smooth=True):
    """A mesh object from numpy arrays: verts (n x 3), tris (m x 3)."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(np.asarray(verts, float).tolist(), [], np.asarray(tris, int).tolist())
    for m in mats:
        mesh.materials.append(m)
    if mat_index is not None:
        mesh.polygons.foreach_set("material_index", np.asarray(mat_index, np.int32))
    mesh.polygons.foreach_set("use_smooth", np.ones(len(mesh.polygons), bool) if smooth else np.zeros(len(mesh.polygons), bool))
    mesh.update()
    if normals is not None:
        mesh.normals_split_custom_set_from_vertices([tuple(n) for n in np.asarray(normals, float)])
    if colors is not None:
        attr = mesh.color_attributes.new("Hinterland tint", "FLOAT_COLOR", "POINT")
        rgba = np.concatenate([np.asarray(colors, np.float32), np.ones((len(colors), 1), np.float32)], 1)
        attr.data.foreach_set("color", rgba.ravel())
        mesh.color_attributes.active_color = attr
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


def vertex_normals(verts, tris):
    v = np.asarray(verts, float)
    t = np.asarray(tris, int)
    fn = np.cross(v[t[:, 1]] - v[t[:, 0]], v[t[:, 2]] - v[t[:, 0]])
    n = np.zeros_like(v)
    for k in range(3):
        np.add.at(n, t[:, k], fn)
    length = np.linalg.norm(n, axis=1, keepdims=True)
    return n / np.maximum(length, 1e-12)


# ---------------------------------------------------------------------------------------------
# The coasts: cliff faces and beaches, column by column from each end of the mainland.


def column_rows(side, u, top):
    """Row heights for one face column, bottom to top. At the seam they repeat the mainland's
    two 80-row stacks (foundation to -0.26 m, block to the ridge); further out they thin."""
    if u <= 10.0:
        lower = np.linspace(H.FOOT, -0.26, 81)
        upper = np.linspace(-0.26, top, 81)[1:]
        return np.concatenate([lower, upper])
    # Halving steps (80, 40, 20, 10 rows) keep every zipper between neighbours to pairs of rows.
    cave = side == "south" and any(abs(u - at) < half + 4.0 for at, half, _, _ in H.CAVES)
    n = 80 if cave or u <= 30 else 40 if u <= 75 else 20 if u <= 170 else 10
    return np.linspace(H.FOOT, top, n + 1)


def zipper(a_idx, a_frac, b_idx, b_frac):
    """Triangulate the strip between two columns of vertices with different row fractions."""
    tris = []
    i = j = 0
    while i < len(a_idx) - 1 or j < len(b_idx) - 1:
        advance_a = j == len(b_idx) - 1 or (i < len(a_idx) - 1 and a_frac[i + 1] <= b_frac[j + 1])
        if advance_a:
            tris.append((a_idx[i], b_idx[j], a_idx[i + 1]))
            i += 1
        else:
            tris.append((a_idx[i], b_idx[j], b_idx[j + 1]))
            j += 1
    return tris


def build_coast(side):
    samples = H.coast_samples(side)
    edge, top = H.edge_heights(samples)
    ridge_point = (south_end if side == "south" else north_end)[-1]
    edge[0], top[0] = ridge_point[:2], ridge_point[2]
    u, P, D, xr = samples["u"], samples["P"], samples["D"], samples["xr"]
    n = len(u)
    verts, columns, fracs = [], [], []
    for i in range(n):
        rows = column_rows(side, float(u[i]), float(top[i]))
        relief = H.face_relief(side, np.full_like(rows, u[i]), np.full_like(rows, xr[i]), rows, np.full_like(rows, top[i]))
        xy = P[i][None, :] + D[i][None, :] * relief[:, None]
        if i == 0:
            # The first column is the mainland's own end column.
            xy[:, 0] = samples["P"][0, 0]
            xy[:, 1] = H.cliff_surface(xy[:, 0], rows)
        xy[-1] = edge[i]
        col = np.concatenate([xy, rows[:, None]], 1)
        # A lip folds back under the ground so a hairline seam never shows sky.
        lip = np.array([[*(edge[i] - D[i] * 0.35), top[i] - 0.55]])
        col = np.vstack([col, lip])
        start = len(verts)
        verts.extend(col.tolist())
        frac = np.concatenate([(rows - H.FOOT) / max(top[i] - H.FOOT, 0.5), [1.02]])
        columns.append(list(range(start, start + len(col))))
        fracs.append(frac)
    tris = []
    for i in range(n - 1):
        tris.extend(zipper(columns[i], fracs[i], columns[i + 1], fracs[i + 1]))
    verts = np.asarray(verts)
    tris = np.asarray(tris)
    # Orientation: faces must look seaward.
    v0, v1, v2 = verts[tris[:, 0]], verts[tris[:, 1]], verts[tris[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)
    col_of = np.zeros(len(verts), int)
    for i, c in enumerate(columns):
        col_of[c] = i
    seaward = D[col_of[tris[:, 0]]]
    if np.mean(np.sum(fn[:, :2] * seaward, 1) > 0) < 0.5:
        tris = tris[:, [0, 2, 1]]
    return {"samples": samples, "edge": edge, "top": top, "verts": verts, "tris": tris, "columns": columns, "col_of": col_of}


log("building coasts")
COASTS = {side: build_coast(side) for side in ("south", "north")}
for side, c in COASTS.items():
    log(side, "face", len(c["verts"]), "verts", len(c["tris"]), "tris", "top range", round(float(c["top"].min()), 2), round(float(c["top"].max()), 2))


def build_beach(side):
    c = COASTS[side]
    s = c["samples"]
    u, P, D, xr = s["u"], s["P"], s["D"], s["xr"]
    width = H.beach_design(s)
    starts = []
    for i in range(len(u)):
        relief = float(H.face_relief(side, u[i], xr[i], -6.7, c["top"][i]))
        start = P[i] + D[i] * (relief - 0.65)
        if i == 0:
            start = np.array([P[i][0], float(H.cliff_surface(P[i][0], -6.7)) - 0.65])
        # The waterline must stay seaward of the shore shader's clamped line where the beach faces
        # the open sea (see coastal_hinterland.CLAMPED_WATERLINE).
        facing = float(D[i][1])
        if facing > 0.6 and width[i] > 0.5:
            need = (H.CLAMPED_WATERLINE[side] - 0.3 - start[1]) / (0.42 * facing)
            width[i] = max(width[i], need)
        starts.append(start)
    starts = np.asarray(starts)
    count = lambda ui: 40 if ui <= 12 else 16 if ui <= 120 else 8
    verts, tris, mat = [], [], []
    columns = []
    for i in range(len(u)):
        if width[i] < 0.6:
            columns.append(None)
            continue
        k = count(u[i])
        t = np.linspace(0.0, 1.0, k + 1)
        xy = starts[i][None, :] + D[i][None, :] * (t * width[i])[:, None]
        z = H.beach_profile(np.full_like(t, xr[i]), t)
        if i == 0:
            xy[:, 0] = P[0][0]
            xy[:, 1] = starts[0][1] + t * float(H.beach_width(P[0][0]))
        base = len(verts)
        verts.extend(np.concatenate([xy, z[:, None]], 1).tolist())
        columns.append((list(range(base, base + k + 1)), t))
    for i in range(len(u) - 1):
        a, b = columns[i], columns[i + 1]
        if a is None or b is None:
            continue
        tris.extend(zipper(a[0], a[1], b[0], b[1]))
    verts = np.asarray(verts)
    tris = np.asarray(tris)
    v0, v1, v2 = verts[tris[:, 0]], verts[tris[:, 1]], verts[tris[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)
    flip = fn[:, 2] < 0
    tris[flip] = tris[flip][:, [0, 2, 1]]
    centre_z = (v0[:, 2] + v1[:, 2] + v2[:, 2]) / 3
    mat = (centre_z < -7.13).astype(int)
    # A skirt under the seam column hides any hairline against the retained beach.
    first = columns[0]
    if first is not None:
        idx, t = first
        skirt = len(verts)
        drop = verts[idx] - np.array([0, 0, 0.35])
        verts = np.vstack([verts, drop])
        extra = []
        for k in range(len(idx) - 1):
            extra.append((idx[k], skirt + k, idx[k + 1]))
            extra.append((idx[k + 1], skirt + k, skirt + k + 1))
        tris = np.vstack([tris, np.asarray(extra)])
        mat = np.concatenate([mat, np.zeros(len(extra), int)])
    return {"verts": verts, "tris": tris, "mat": mat, "width": width, "starts": starts}


BEACHES = {side: build_beach(side) for side in ("south", "north")}
for side, b in BEACHES.items():
    log(side, "beach", len(b["verts"]), "verts", len(b["tris"]), "tris")


# ---------------------------------------------------------------------------------------------
# The ground: one constrained Delaunay triangulation of the land between the mainland's walls,
# both coasts' top edges and the far boundary, dense at the seam and coarse far away.


def ground_spacing(x, y):
    """Target triangle size: the mainland's 0.5 m at its walls, 1-2.5 m within 60 m, then coarser
    out to 18 m on the far hill; canyon walls and the coastal brink stay finer."""
    d = H.mainland_distance(x, y)
    s = np.interp(d, [0, 3, 22, 60, 140, 300, 700], [0.5, 1.0, 1.3, 2.4, 4.6, 9.0, 18.0])
    wall, rib, floor = H.canyon_masks(x, y)
    s = np.where(wall > 0.08, np.minimum(s, np.interp(d, [0, 120, 260, 500], [1.5, 2.0, 3.2, 6.0])), s)
    return s


def coast_edge_lines():
    lines = {}
    for side, c in COASTS.items():
        lines[side] = np.concatenate([c["edge"], c["top"][:, None]], 1)
    return lines


EDGES = coast_edge_lines()
x_lo, x_hi, y_lo = H.EXTENT["x0"], H.EXTENT["x1"], H.EXTENT["y0"]
boundary = []
boundary += south_end[::-1].tolist()  # ridge to back corner
boundary += back[1:].tolist()
boundary += north_end[1:].tolist()
boundary += EDGES["north"][1:].tolist()
far = [(x_hi, y_lo), (x_lo, y_lo)]
boundary += [(x, y, float(H.ground_height(x, y))) for x, y in far]
boundary += EDGES["south"][:0:-1].tolist()
boundary = np.asarray(boundary)
area = 0.5 * np.sum(boundary[:, 0] * np.roll(boundary[:, 1], -1) - np.roll(boundary[:, 0], -1) * boundary[:, 1])
if area < 0:
    boundary = boundary[::-1]
log("ground boundary", len(boundary), "vertices, area", round(abs(area)), "m2")


def trail_strip(name):
    """Left and right borders of a trail, its graded centreline heights, and its frame."""
    centre = H.resample(H.TRAILS[name], 1.0)
    h = H.ground_height(centre[:, 0], centre[:, 1])
    # Grade the tread: a 7 m running mean, so the path cuts and fills gently.
    k = 7
    pad = np.concatenate([np.full(k, h[0]), h, np.full(k, h[-1])])
    graded = np.convolve(pad, np.ones(2 * k + 1) / (2 * k + 1), mode="same")[k:-k]
    tangent = np.gradient(centre, axis=0)
    tangent /= np.linalg.norm(tangent, axis=1, keepdims=True)
    normal = np.stack([-tangent[:, 1], tangent[:, 0]], 1)
    half = H.TRAIL_WIDTH / 2
    left, right = centre + normal * half, centre - normal * half
    d = H.mainland_distance(centre[:, 0], centre[:, 1])
    step = np.where(d < 80, 1, np.where(d < 200, 2, 3))
    keep = [0]
    for i in range(1, len(centre) - 1):
        if i - keep[-1] >= step[i]:
            keep.append(i)
    keep.append(len(centre) - 1)
    return {"centre": centre, "graded": graded, "left": left[keep], "right": right[keep], "keep": keep}


def lookout_pose():
    """The viewing deck stands on the south headland's rim over the middle sea cave, its seaward
    railing just past the brink; the Coast Walk ends at its open landward side."""
    s = COASTS["south"]["samples"]
    i = int(np.argmin(np.abs(s["u"] - H.LOOKOUT_U)))
    edge = COASTS["south"]["edge"][i]
    seaward = s["D"][i]
    centre = edge - seaward * 1.1
    yaw = math.atan2(-seaward[0], seaward[1])
    landward = centre - seaward * 3.0
    return {"centre": centre, "yaw": yaw, "seaward": seaward, "landward": landward, "edge": edge}


LOOKOUT = lookout_pose()


def three(p):
    """Blender (x, y, z) to the browser's (x, y, z)."""
    return [round(float(p[0]), 2), round(float(p[2]), 2), round(float(-p[1]), 2)]


def feature_points():
    """Where the review cameras should look (browser coordinates)."""
    s = COASTS["south"]["samples"]
    caves = []
    for at, half, crown, depth in H.CAVES:
        i = int(np.argmin(np.abs(s["u"] - at)))
        mouth = s["P"][i] + s["D"][i] * float(H.face_relief("south", s["u"][i], s["xr"][i], crown - 1.5, COASTS["south"]["top"][i]) + depth)
        caves.append(three((*mouth, crown - 1.5)))
    return {"caves": caves, "deck": three((*LOOKOUT["centre"], float(H.ground_height(*LOOKOUT["centre"]))))}


report["features"] = feature_points()
H.TRAILS["coast-walk"] = H.TRAILS["coast-walk"] + [tuple(LOOKOUT["landward"])]
TRAIL_STRIPS = {name: trail_strip(name) for name in H.TRAILS}


def trail_grading(x, y, h):
    """Blend the ground toward each trail's graded tread within its width plus a 1.6 m shoulder."""
    out = h.copy()
    on_trail = np.zeros(h.shape, bool)
    for name, strip in TRAIL_STRIPS.items():
        dist, arc, _ = H.polyline_frame(strip["centre"], x, y)
        along = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(strip["centre"], axis=0), axis=1))])
        tread = np.interp(arc, along, strip["graded"])
        w = 1 - H.smoothstep(H.TRAIL_WIDTH / 2, H.TRAIL_WIDTH / 2 + 1.6, dist)
        out = out * (1 - w) + (tread + 0.02) * w
        on_trail |= dist < H.TRAIL_WIDTH / 2 + 0.05
    return out, on_trail


def gliderport_polygon():
    """The launch lawn: from the bluff's brink (less a margin) back 40 m, rounded at the corners."""
    north = EDGES["north"]
    x0, x1 = H.GLIDERPORT["x"]
    xs_ = np.linspace(x0, x1, 28)
    edge_y = np.interp(xs_, north[:, 0], north[:, 1]) - H.GLIDERPORT["edge_margin"]
    front = np.stack([xs_, edge_y], 1)
    back_ = np.stack([xs_[::-1], np.full(len(xs_), H.GLIDERPORT["back"]) + 3 * np.sin(np.linspace(0, math.pi, len(xs_)))], 1)
    return np.vstack([front, back_])


LAWN = gliderport_polygon()
LAWN_HEIGHT = float(np.median(H.ground_height(LAWN[:, 0], LAWN[:, 1])))


def lawn_grading(x, y, h):
    """Grade the gliderport's launch to a gentle slope down toward the brink."""
    inside = point_in_polygon(LAWN, x, y)
    dist = polygon_distance(LAWN, x, y)
    w = np.where(inside, 1.0, 1 - H.smoothstep(0.0, 6.0, dist))
    target = 0.7 * LAWN_HEIGHT + 0.3 * h  # mostly flat; the mesa's own swell kept faintly
    return h * (1 - w) + target * w, inside


def point_in_polygon(poly, x, y):
    x, y = np.asarray(x, float), np.asarray(y, float)
    inside = np.zeros(x.shape, bool)
    px, py = poly[:, 0], poly[:, 1]
    j = len(poly) - 1
    for i in range(len(poly)):
        cond = (py[i] > y) != (py[j] > y)
        xint = (px[j] - px[i]) * (y - py[i]) / np.where(py[j] - py[i] == 0, 1e-12, py[j] - py[i]) + px[i]
        inside ^= cond & (x < xint)
        j = i
    return inside


def polygon_distance(poly, x, y):
    closed = np.vstack([poly, poly[:1]])
    d, _, _ = H.polyline_frame(closed, x, y)
    return d


def finished_height(x, y):
    h = H.ground_height(x, y)
    h, on_trail = trail_grading(x, y, h)
    h, on_lawn = lawn_grading(x, y, h)
    return h, on_trail, on_lawn


def interior_points():
    """One jittered point per quadtree leaf, leaves sized to the target spacing."""
    rng = np.random.default_rng(1015)
    size = 32.0
    gx = np.arange(x_lo, x_hi, size)
    gy = np.arange(y_lo, 90.0, size)
    cx, cy = np.meshgrid(gx + size / 2, gy + size / 2)
    cells = [np.stack([cx.ravel(), cy.ravel()], 1)]
    leaves = []
    while size >= 0.5 - 1e-9 and len(cells[-1]):
        c = cells[-1]
        probes = [c] + [c + np.array([sx, sy]) * size * 0.45 for sx in (-1, 1) for sy in (-1, 1)]
        want = np.min(np.stack([ground_spacing(p[:, 0], p[:, 1]) for p in probes]), axis=0)
        split = (want < size * 0.72) & (size > 0.5 + 1e-9)
        leaves.append((c[~split], size))
        q = size / 4
        children = c[split]
        cells.append(np.concatenate([children + np.array([dx, dy]) for dx in (-q, q) for dy in (-q, q)]) if len(children) else np.zeros((0, 2)))
        size /= 2
    pts = []
    sizes = []
    for c, s in leaves:
        if not len(c):
            continue
        jitter = (rng.random(c.shape) - 0.5) * 0.62 * s
        pts.append(c + jitter)
        sizes.append(np.full(len(c), s))
    return np.concatenate(pts), np.concatenate(sizes)


log("sampling the ground")
pts, sizes = interior_points()
# Drop points on the mainland and in the sea, then those crowding a constraint.
outside_main = ~((pts[:, 0] > H.MAIN_X0 - 0.05) & (pts[:, 0] < H.MAIN_X1 + 0.05) & (pts[:, 1] > H.MAIN_BACK - 0.05))
pts, sizes = pts[outside_main], sizes[outside_main]
land = point_in_polygon(boundary[:, :2], pts[:, 0], pts[:, 1])
pts, sizes = pts[land], sizes[land]
constraints = [boundary[:, :2]]
for strip in TRAIL_STRIPS.values():
    constraints += [strip["left"], strip["right"]]
constraints.append(LAWN)
dense = np.concatenate([H.resample(np.vstack([c, c[:1]]) if c is LAWN or c is constraints[0] else c, 0.25) for c in constraints])
tree = KDTree(len(dense))
for i, p in enumerate(dense):
    tree.insert((p[0], p[1], 0.0), i)
tree.balance()
near = np.array([tree.find((p[0], p[1], 0.0))[2] for p in pts])
crowded = near < 0.45 * sizes
pts, sizes = pts[~crowded], sizes[~crowded]
# Nor may a point sit inside a trail strip or straddle the lawn's edge.
for strip in TRAIL_STRIPS.values():
    dist, _, _ = H.polyline_frame(strip["centre"], pts[:, 0], pts[:, 1])
    keep = dist > H.TRAIL_WIDTH / 2 + 0.2
    pts, sizes = pts[keep], sizes[keep]
log("interior points", len(pts))

# Assemble the CDT input: boundary polygon (one face), trail borders and lawn (edges), points.
coords = []
fixed_z = []
edges = []


def add_polyline(points, closed=False, z=None):
    start = len(coords)
    for k, p in enumerate(points):
        coords.append((float(p[0]), float(p[1])))
        fixed_z.append(None if z is None else float(z[k]))
    idx = list(range(start, len(coords)))
    pairs = list(zip(idx, idx[1:])) + ([(idx[-1], idx[0])] if closed else [])
    return idx, pairs


boundary_idx, _ = add_polyline(boundary[:, :2], closed=True, z=boundary[:, 2])
for strip in TRAIL_STRIPS.values():
    li, le = add_polyline(strip["left"])
    ri, re_ = add_polyline(strip["right"])
    edges += le + re_ + [(li[0], ri[0]), (li[-1], ri[-1])]
lawn_idx, lawn_edges = add_polyline(LAWN, closed=True)
edges += lawn_edges
point_start = len(coords)
for p in pts:
    coords.append((float(p[0]), float(p[1])))
    fixed_z.append(None)
log("triangulating", len(coords), "vertices", len(edges), "constraint edges")
out_v, out_e, out_f, out_orig_v, _, _ = delaunay_2d_cdt([Vector(c) for c in coords], edges, [boundary_idx], 1, 1e-7, True)
tris = np.asarray([f for f in out_f if len(f) == 3], int)
assert len(tris) == len(out_f), "the triangulation returned a non-triangle"
xy = np.asarray([(v.x, v.y) for v in out_v])
z = np.zeros(len(xy))
known = np.zeros(len(xy), bool)
for i, origin in enumerate(out_orig_v):
    for o in origin:
        if fixed_z[o] is not None:
            z[i] = fixed_z[o]
            known[i] = True
            break
h, on_trail, on_lawn = finished_height(xy[:, 0], xy[:, 1])
z = np.where(known, z, h)
used = np.unique(tris)
remap = -np.ones(len(xy), int)
remap[used] = np.arange(len(used))
ground_xy, ground_z, tris = xy[used], z[used], remap[tris]
ground = np.concatenate([ground_xy, ground_z[:, None]], 1)
# Upward-facing triangles.
v0, v1, v2 = ground[tris[:, 0]], ground[tris[:, 1]], ground[tris[:, 2]]
flip = np.cross(v1 - v0, v2 - v0)[:, 2] < 0
tris[flip] = tris[flip][:, [0, 2, 1]]
log("ground", len(ground), "verts", len(tris), "tris")
report["ground"] = {"vertices": int(len(ground)), "triangles": int(len(tris))}


# ---------------------------------------------------------------------------------------------
# Shading of the ground: normals that meet the mainland's, materials by distance and slope, and
# per-corner colours (a tint on the sandstone, the albedo itself on the white-based ground).

ground_n = vertex_normals(ground, tris)
seam_points = np.vstack([back, south_end, north_end])
seam_normals, seam_shades = retained_shading(seam_points)
seam_key = {(round(p[0], 4), round(p[1], 4)): k for k, p in enumerate(seam_points)}
seam_vertex = -np.ones(len(ground), int)
for i, p in enumerate(ground):
    k = seam_key.get((round(p[0], 4), round(p[1], 4)))
    if k is not None:
        seam_vertex[i] = k
on_seam = seam_vertex >= 0
ground_n[on_seam] = seam_normals[seam_vertex[on_seam]]
report["ground"]["seamVertices"] = int(on_seam.sum())
gx, gy, gz = ground[:, 0], ground[:, 1], ground[:, 2]
g_d = H.mainland_distance(gx, gy)
g_wall, g_rib, g_floor = H.canyon_masks(gx, gy)
uncarved = H.ground_height(gx, gy, with_canyons=False)
carved = uncarved - gz
g_cap = H.smoothstep(0.3, 1.1, carved) * H.smoothstep(4.5, 1.8, carved) * H.smoothstep(0.92, 0.6, ground_n[:, 2])
g_albedo = H.ground_albedo(gx, gy, gz, ground_n[:, 2], g_d, g_wall, g_rib, g_floor, g_cap)
g_tint = H.sandstone_tint(H.GOLDEN, gz, uncarved, g_wall, g_rib, g_cap)


def hash01(x, y):
    v = np.sin(x * 12.9898 + y * 78.233) * 43758.5453
    return v - np.floor(v)


centroid = ground[tris].mean(axis=1)
cnz = ground_n[tris][:, :, 2].mean(axis=1)
c_d = H.mainland_distance(centroid[:, 0], centroid[:, 1])
c_trail = np.zeros(len(tris), bool)
for strip in TRAIL_STRIPS.values():
    dist, _, _ = H.polyline_frame(strip["centre"], centroid[:, 0], centroid[:, 1])
    c_trail |= dist < H.TRAIL_WIDTH / 2 + 0.02
c_lawn = point_in_polygon(LAWN, centroid[:, 0], centroid[:, 1]) & ~c_trail
dither = hash01(centroid[:, 0], centroid[:, 1])
# The retained clifftop's sandstone shading (soil and grass over the rock) continues 60 m out, then
# dithers into the white-based ground, where the colour map takes over, by 90 m.
near = (c_d < 60) | ((c_d < 90) & (dither < (90 - c_d) / 30))
steep_near = (cnz < 0.74) & (c_d < 170)
GROUND_MATS = ["golden", "loam", "trail", "lawn"]
g_mat = np.where(c_trail, 2, np.where(c_lawn, 3, np.where(near | steep_near, 0, 1)))
corner_color = np.empty((len(tris), 3, 3))
for k in range(3):
    vi = tris[:, k]
    corner_color[:, k] = np.where((g_mat == 0)[:, None], g_tint[vi], g_albedo[vi])
    dust = (0.9 + 0.1 * hash01(gx[vi] * 0.31, gy[vi] * 0.29))[:, None]
    corner_color[:, k] = np.where((g_mat >= 2)[:, None], np.repeat(dust, 3, 1), corner_color[:, k])
report["ground"]["materials"] = {GROUND_MATS[m]: int((g_mat == m).sum()) for m in range(4)}


# ---------------------------------------------------------------------------------------------
# Shading of the cliffs and beaches.


def coast_shading(side):
    c = COASTS[side]
    s = c["samples"]
    verts, tris_, col_of = c["verts"], c["tris"], c["col_of"]
    u_of = s["u"][col_of]
    top_of = c["top"][col_of]
    xr_of = s["xr"][col_of]
    n = vertex_normals(verts, tris_)
    # The seam column takes the mainland's analytic face normal (coastal_section.cliff_normals).
    first = np.asarray(c["columns"][0][:-1])
    fx, fz = verts[first, 0], verts[first, 2]
    dx = (H.cliff_surface(fx + 0.005, fz) - H.cliff_surface(fx - 0.005, fz)) / 0.01
    dz = (H.cliff_surface(fx, fz + 0.005) - H.cliff_surface(fx, fz - 0.005)) / 0.01
    seam_n = np.stack([-dx, np.ones_like(dx), -dz], 1)
    n[first] = seam_n / np.linalg.norm(seam_n, axis=1, keepdims=True)
    tri_u = u_of[tris_].mean(axis=1)
    centre = verts[tris_].mean(axis=1)
    dith = hash01(np.floor(tri_u * 0.7), 3.1)
    if side == "north":
        # golden at the seam, pale Torrey sandstone along the bluffs, white-based stone far away
        golden = (tri_u < 30) | ((tri_u < 62) & (dith < (62 - tri_u) / 32))
        far = (tri_u > 240) | ((tri_u > 205) & (dith < (tri_u - 205) / 35))
        mat = np.where(golden, 0, np.where(far, 3, 2))
    else:
        far = (tri_u > 185) | ((tri_u > 160) & (dith < (tri_u - 160) / 25))
        mat = np.where(far, 3, 0)
    # The mainland's inclined bedding bands continue across the seam.
    xr_c = xr_of[tris_].mean(axis=1)
    bedding = centre[:, 2] + 0.055 * xr_c + 0.08 * np.sin(xr_c * 0.33)
    band = (np.sin(bedding * 3.1) > 0.92) & (tri_u < 45) & (mat == 0)
    mat = np.where(band, 1, mat)
    col = np.empty((len(tris_), 3, 3))
    for k in range(3):
        vi = tris_[:, k]
        pale_tint = H.bluff_albedo(verts[vi, 2], top_of[vi], u_of[vi], "tint")
        if side == "north":
            far_albedo = H.bluff_albedo(verts[vi, 2], top_of[vi], u_of[vi], "albedo")
        else:
            far_albedo = np.repeat(H.GOLDEN[None, :] * 1.05, len(vi), 0)
        col[:, k] = np.where((mat == 2)[:, None], pale_tint, np.where((mat == 3)[:, None], far_albedo, 1.0))
    return n, mat, col


COAST_MATS = ["golden", "bedding", "pale", "bluff"]
SHADING = {side: coast_shading(side) for side in COASTS}


# ---------------------------------------------------------------------------------------------
# Objects: the ground in tiles sized by distance (so the camera and the sun's shadow map cull
# them), the cliffs and beaches in runs along each coast.


def tile_key(points):
    """A quadtree tile per point: 128 m near the house, 320 m beyond 150 m, 640 m beyond 420 m."""
    keys = []
    for x, y in points:
        size = 640.0
        while size > 128.0:
            cx = math.floor(x / size) * size + size / 2
            cy = math.floor(y / size) * size + size / 2
            nearest = float(H.mainland_distance(cx, cy)) - size * 0.71
            if nearest > (420.0 if size >= 640 else 150.0):
                break
            size = 320.0 if size == 640.0 else 128.0
        keys.append((size, math.floor(x / size), math.floor(y / size)))
    return keys


def split_mesh(name, verts, tris_, mats_keys, mat_idx, normals, corner_colors, groups):
    """One object per group label, each with only its vertices and the materials it uses."""
    objects = []
    for label in sorted(set(groups)):
        sel = np.asarray([g == label for g in groups])
        t = tris_[sel]
        used = np.unique(t)
        remap = -np.ones(len(verts), int)
        remap[used] = np.arange(len(used))
        mi = mat_idx[sel]
        present = sorted(set(mi.tolist()))
        local = {m: k for k, m in enumerate(present)}
        obj_name = f"{name}_{label}" if isinstance(label, str) else f"{name}_{len(objects):02d}"
        obj = make_mesh(obj_name, verts[used], remap[t], [MATS[mats_keys[m]] for m in present], [local[m] for m in mi], normals[used])
        if corner_colors is not None:
            attr = obj.data.color_attributes.new("Hinterland tint", "FLOAT_COLOR", "CORNER")
            rgba = np.concatenate([corner_colors[sel].reshape(-1, 3), np.ones((sel.sum() * 3, 1))], 1).astype(np.float32)
            attr.data.foreach_set("color", rgba.ravel())
            obj.data.color_attributes.active_color = attr
        objects.append(obj)
    return objects


log("tiling")
keys = tile_key(centroid[:, :2])
labels = {k: i for i, k in enumerate(sorted(set(keys)))}
ground_groups = [f"{labels[k]:02d}" for k in keys]
GROUND_OBJECTS = split_mesh("hinterland_ground", ground, tris, GROUND_MATS, g_mat, ground_n, corner_color, ground_groups)
log("ground tiles", len(GROUND_OBJECTS))
COAST_OBJECTS = []
for side, c in COASTS.items():
    n, mat, col = SHADING[side]
    tri_u = c["samples"]["u"][c["col_of"][c["tris"][:, 0]]]
    run = np.digitize(tri_u, [40, 110, 200, 320, 480])
    COAST_OBJECTS += split_mesh(f"hinterland_cliff_{side}", c["verts"], c["tris"], COAST_MATS, mat, n, col, [f"{r}" for r in run])
    b = BEACHES[side]
    bn = vertex_normals(b["verts"], b["tris"])
    bc = b["verts"][b["tris"]].mean(axis=1)
    run = np.digitize(np.abs(bc[:, 0] - (H.MAIN_X0 if side == "south" else H.MAIN_X1)), [40, 110, 200, 320, 480])
    COAST_OBJECTS += split_mesh(f"hinterland_beach_{side}", b["verts"], b["tris"], ["sand", "wet"], b["mat"], bn, None, [f"{r}" for r in run])
log("coast objects", len(COAST_OBJECTS))


# ---------------------------------------------------------------------------------------------
# Review stills: Cycles renders from the browser lab's cameras (three.js target, yaw, pitch and
# radius), with the colour attribute multiplied in as the browser does.

VIEWS = {
    "default-outside": ([3, -0.2, -6], 3.48, 0.37, 48),
    "back-from-inland": ([20, 4, 10], 0.25, 0.32, 70),
    "south-end": ([-36, 2, 2], -1.25, 0.3, 55),
    "north-end": ([76, 2, 2], 1.85, 0.3, 55),
    "wide-sea": ([3, -0.2, -6], 3.48, 0.37, 160),
    "wide-south-west": ([-20, 0, 0], 4.1, 0.3, 160),
    "wide-north-west": ([40, 0, 0], 2.55, 0.3, 160),
    "wide-inland": ([20, 0, 20], 0.6, 0.45, 160),
    "sea-caves": ([-118, -3, -26], 2.6, 0.12, 40),
    "badlands": ([118, 4, 60], 2.2, 0.3, 60),
}


def blender_point(p):
    return Vector((p[0], -p[2], p[1]))


def view_camera(name, target, yaw, pitch, radius):
    position = [target[0] + math.sin(yaw) * math.cos(pitch) * radius, target[1] + math.sin(pitch) * radius, target[2] + math.cos(yaw) * math.cos(pitch) * radius]
    data = bpy.data.cameras.new(name)
    data.sensor_fit = "VERTICAL"
    data.angle_y = math.radians(38)
    data.clip_start, data.clip_end = 0.05, 3000
    cam = bpy.data.objects.new(name, data)
    scene.collection.objects.link(cam)
    cam.location = blender_point(position)
    cam.rotation_euler = (blender_point(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
    return cam


def preview(views):
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cave = report["features"]["caves"][1]
    VIEWS["caves"] = ([cave[0], cave[1] + 1.0, cave[2]], 2.25, 0.08, 26)
    deck = report["features"]["deck"]
    VIEWS["deck"] = ([deck[0], deck[1] + 0.8, deck[2]], 1.4, 0.3, 14)
    for obj in scene.objects:
        if obj.type == "MESH" and not obj.data.color_attributes:
            attr = obj.data.color_attributes.new("White", "FLOAT_COLOR", "POINT")
            attr.data.foreach_set("color", np.ones(len(obj.data.vertices) * 4, np.float32))
        if obj.type == "MESH":
            obj.data.color_attributes.render_color_index = obj.data.color_attributes.active_color_index
    for m in bpy.data.materials:
        if not m.use_nodes or "Principled BSDF" not in m.node_tree.nodes:
            continue
        nt = m.node_tree
        bsdf = nt.nodes["Principled BSDF"]
        attr = nt.nodes.new("ShaderNodeVertexColor")
        attr.layer_name = ""
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
        mix.inputs[0].default_value = 1.0
        mix.inputs[6].default_value = bsdf.inputs["Base Color"].default_value
        nt.links.new(attr.outputs["Color"], mix.inputs[7])
        nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    world = bpy.data.worlds.new("Preview sky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.68, 0.86, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    scene.world = world
    sun = bpy.data.objects.new("Preview sun", bpy.data.lights.new("Preview sun", "SUN"))
    sun.data.energy = 4.0
    sun.data.angle = math.radians(1.5)
    scene.collection.objects.link(sun)
    to_sun = Vector((-0.866 * math.cos(math.radians(42)), 0.5 * math.cos(math.radians(42)), math.sin(math.radians(42))))
    sun.rotation_euler = (-to_sun).to_track_quat("-Z", "Y").to_euler()
    sea = bpy.data.meshes.new("Preview sea")
    sea.from_pydata([(-1500, -1500, H.SEA), (1500, -1500, H.SEA), (1500, 1500, H.SEA), (-1500, 1500, H.SEA)], [], [(0, 1, 2, 3)])
    sea.materials.append(material("preview sea", (0.05, 0.2, 0.27), 0.15))
    scene.collection.objects.link(bpy.data.objects.new("Preview sea", sea))
    scene.render.engine = "CYCLES"
    scene.cycles.samples = int(next((a.split("=")[1] for a in ARGS if a.startswith("--samples=")), 24))
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1000, 640
    scene.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    scene.cycles.device = "CPU"
    if "--gpu" in ARGS:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "ONEAPI"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = "GPU"
    for name in views:
        target, yaw, pitch, radius = VIEWS[name]
        cam = view_camera(name, target, yaw, pitch, radius)
        scene.camera = cam
        scene.render.filepath = str(PREVIEW_DIR / f"{name}.png")
        bpy.ops.render.render(write_still=True)
        log("rendered", name)


if PREVIEW and "--before-planting" in ARGS:
    preview(next((a.split("=")[1].split(",") for a in ARGS if a.startswith("--views=")), list(VIEWS)))
    raise SystemExit(0)


# ---------------------------------------------------------------------------------------------
# Planting, the lookout, the gliderport, the wind sock, the gliders and the talus.

import coastal_hinterland_props as P  # noqa: E402


def _ground_tree():
    verts, polys = [], []
    for obj in GROUND_OBJECTS:
        base = len(verts)
        verts.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        polys.extend(tuple(base + i for i in p.vertices) for p in obj.data.polygons)
    return BVHTree.FromPolygons(verts, polys)


GROUND_TREE = _ground_tree()


def ground_at(x, y):
    hit = GROUND_TREE.ray_cast(Vector((x, y, 300.0)), Vector((0, 0, -1)), 600.0)
    if hit[0] is None and "mainland_tree" in globals():
        hit = mainland_tree.ray_cast(Vector((x, y, 60.0)), Vector((0, 0, -1)), 120.0)
    return hit[0].z if hit[0] is not None else float(H.ground_height(x, y))


def ground_hit(x, y):
    hit = GROUND_TREE.ray_cast(Vector((x, y, 300.0)), Vector((0, 0, -1)), 600.0)
    return (hit[0].z, hit[1].z) if hit[0] is not None else (None, None)


rng = np.random.default_rng(20261015)
coast_lines = np.vstack([H.resample(EDGES["south"][:, :2], 0.5), H.resample(EDGES["north"][:, :2], 0.5)])
coast_tree = KDTree(len(coast_lines))
for k, p in enumerate(coast_lines):
    coast_tree.insert((p[0], p[1], 0.0), k)
coast_tree.balance()
deck_xy = LOOKOUT["centre"]


def clear_mask(xs, ys, radius):
    """Not on a trail, the lawn, the deck or the brink (vectorised over candidates)."""
    xs, ys = np.asarray(xs, float), np.asarray(ys, float)
    ok = np.ones(xs.shape, bool)
    for strip in TRAIL_STRIPS.values():
        d, _, _ = H.polyline_frame(strip["centre"], xs, ys)
        ok &= d > H.TRAIL_WIDTH / 2 + 0.6 + radius
    ok &= ~point_in_polygon(LAWN, xs, ys) & (polygon_distance(LAWN, xs, ys) > 1.5 + radius)
    ok &= np.hypot(xs - deck_xy[0], ys - deck_xy[1]) > 5.0 + radius
    brink = np.array([coast_tree.find((x, y, 0.0))[2] for x, y in zip(xs, ys)])
    ok &= brink > 1.6 + 2.0 * radius  # the widest clump never hangs over the edge
    return ok


def level_footprint(xs, ys, reach=1.7, spread=1.0):
    """A clump needs ground all round it that rises or falls less than `spread` metres within
    `reach`, so none sits on a canyon wall or hangs over a rim or the brink."""
    ok = np.ones(len(xs), bool)
    for k, (x, y) in enumerate(zip(xs, ys)):
        heights = [ground_hit(x + dx, y + dy)[0] for dx, dy in ((reach, 0), (-reach, 0), (0, reach), (0, -reach), (0, 0))]
        ok[k] = None not in heights and max(heights) - min(heights) < spread
    return ok


# Scrub: candidates on jittered grids, sparser with distance from the house, kept by the cover
# map that also colours the ground, so planted clumps and painted cover agree.
plants = {"chaparral": [], "sage": [], "buckwheat": [], "riparian": []}
zones = [(0.0, 60.0, 3.5, 0), (60.0, 150.0, 7.0, 1), (150.0, 300.0, 13.0, 1), (300.0, 700.0, 28.0, 2)]
for d0, d1, step, lod in zones:
    xs_ = np.arange(x_lo, x_hi, step)
    ys_ = np.arange(y_lo, 60.0, step)
    gx_, gy_ = np.meshgrid(xs_, ys_)
    cand = np.stack([gx_.ravel(), gy_.ravel()], 1) + (rng.random((gx_.size, 2)) - 0.5) * step * 0.9
    dd = H.mainland_distance(cand[:, 0], cand[:, 1])
    keep = (dd >= max(d0, 4.0)) & (dd < d1)
    keep &= point_in_polygon(boundary[:, :2], cand[:, 0], cand[:, 1])
    cand, dd = cand[keep], dd[keep]
    wall, rib, floor = H.canyon_masks(cand[:, 0], cand[:, 1])
    nz = np.empty(len(cand))
    for k, (x, y) in enumerate(cand):
        nz[k] = ground_hit(x, y)[1] or 1.0
    cover = H.vegetation_cover(cand[:, 0], cand[:, 1], nz, wall, floor)
    share = H.chaparral_share(cand[:, 0], cand[:, 1])
    ramp = 0.35 + 0.65 * H.smoothstep(3.0, 14.0, dd)
    accept = rng.random(len(cand)) < np.clip(cover * (1.3 if lod == 0 else 1.1), 0, 1) * ramp * np.where(nz < 0.6, 0.18, 1.0)
    accept[accept] &= clear_mask(cand[accept, 0], cand[accept, 1], 1.0)
    accept[accept] &= level_footprint(cand[accept, 0], cand[accept, 1])
    for (x, y), f, sh, w in zip(cand[accept], floor[accept], share[accept], wall[accept]):
        r = rng.random()
        kind = "riparian" if f > 0.5 and r < 0.7 else "buckwheat" if r < 0.12 else "chaparral" if rng.random() < sh else "sage"
        plants[kind].append((x, y, lod))
# The retained clifftop's planting stops some 20 m inland, leaving the back of the mainland bare
# up to the seam. A sparse transition planting on that strip (in this asset; the mainland and
# flora.glb are untouched) carries the scrub from the flora into the mesa. It keeps 2.2 m from
# every flora vertex, the doorway and its stepping stones, and sits on the retained surface.
mainland_tree = BVHTree.FromPolygons([Vector(p) for p in block_world], [tuple(p.vertices) for p in block.data.polygons])
occupied_tree = KDTree(len(occupied_points))
for k, p in enumerate(occupied_points):
    occupied_tree.insert(Vector(p), k)
occupied_tree.balance()
transition = []
gx_, gy_ = np.meshgrid(np.arange(H.MAIN_X0 + 1.0, H.MAIN_X1 - 1.0, 3.5), np.arange(H.MAIN_BACK + 0.8, -9.0, 3.5))
cand = np.stack([gx_.ravel(), gy_.ravel()], 1) + (rng.random((gx_.size, 2)) - 0.5) * 3.0
for x, y in cand:
    hit = mainland_tree.ray_cast(Vector((x, y, 60.0)), Vector((0, 0, -1)), 120.0)
    if hit[0] is None or hit[1].z < 0.75 or hit[0].z < 4.0:
        continue
    cover = float(H.vegetation_cover(np.array([x]), np.array([y]), np.array([hit[1].z]), np.zeros(1), np.zeros(1))[0])
    if rng.random() > cover * 0.9:
        continue
    near = occupied_tree.find_range(Vector((x, y, hit[0].z)), 2.2)
    if near or abs(x) < 7.0 and y > -7.0:
        continue
    kind = "buckwheat" if rng.random() < 0.12 else "chaparral" if rng.random() < float(H.chaparral_share(np.array([x]), np.array([y]))[0]) else "sage"
    transition.append((x, y, kind, hit[0].z))
report["transitionPlanting"] = len(transition)
report["planting"] = {k: len(v) for k, v in plants.items()}

# Torrey pine groves: the reserve's on the north mesa and canyon rims, a few behind the house and
# on the headland, and single trees on the far hill.
GROVES = [(132.0, -84.0, 26.0, 13), (162.0, -122.0, 34.0, 16), (206.0, -74.0, 28.0, 11), (97.0, -154.0, 22.0, 9), (252.0, -40.0, 22.0, 7),
          (305.0, -126.0, 40.0, 14), (60.0, -205.0, 40.0, 12), (26.0, -78.0, 18.0, 4), (-22.0, -96.0, 24.0, 5), (-142.0, 22.0, 12.0, 3),
          (-96.0, -150.0, 30.0, 6), (390.0, -60.0, 45.0, 10)]
pines = []
for cx, cy, radius, count in GROVES:
    for _ in range(count * 3):
        if sum(1 for p in pines if math.hypot(p[0] - cx, p[1] - cy) < radius) >= count:
            break
        a, r = rng.uniform(0, math.tau), radius * math.sqrt(rng.random())
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        z, nz_ = ground_hit(x, y)
        if z is None or nz_ < 0.7 or not clear_mask([x], [y], 2.5)[0] or not point_in_polygon(boundary[:, :2], np.array([x]), np.array([y]))[0]:
            continue
        if any(math.hypot(p[0] - x, p[1] - y) < 6.0 for p in pines):
            continue
        pines.append((x, y, rng.uniform(7.5, 12.5)))
far_pines = 0
while far_pines < 46:
    x, y = rng.uniform(-420.0, 60.0), rng.uniform(-620.0, -300.0)
    z, nz_ = ground_hit(x, y)
    if z is None or nz_ < 0.75 or rng.random() > 0.5 + 0.5 * H.chaparral_share(np.array([x]), np.array([y]))[0]:
        continue
    pines.append((x, y, rng.uniform(8.0, 13.0)))
    far_pines += 1
report["planting"]["torreyPines"] = len(pines)


def lod_of(x, y):
    d = float(H.mainland_distance(x, y))
    return 0 if d < 110 else 1 if d < 280 else 2


veg_batches = {}


def veg_batch(x, y):
    key = (math.floor(x / 320.0), math.floor(y / 320.0))
    return veg_batches.setdefault(key, P.Batch())


for kind, items in plants.items():
    for x, y, lod in items:
        P.shrub(veg_batch(x, y), kind, x, y, ground_at, rng, lod)
for x, y, kind, _ in transition:
    P.shrub(veg_batch(x, y), kind, x, y, ground_at, rng, 0)
for x, y, height in pines:
    lean = (0.0, -0.3 if y > -60 else -0.15)  # the onshore wind leans the coastal trees inland
    P.torrey_pine(veg_batch(x, y), x, y, ground_at, height, rng, lod_of(x, y), lean)

# The lookout: deck, railing, bench and coin viewer over the caves.
props = P.Batch()
deck_z, deck_at = P.viewing_deck(props, LOOKOUT["centre"], LOOKOUT["yaw"], ground_at, rng)
vx, vy, _ = deck_at(0.9, 3.4 / 2 - 0.5)
# The viewer looks along the coast toward the house (local +Y is its line of sight).
house = np.array([0.0, 0.0]) - np.array([vx, vy])
toward_house = math.atan2(-house[0], house[1])
P.coin_viewer(props, (vx, vy), toward_house, deck_z)
bx, by, _ = deck_at(-0.9, -0.55)
P.bench(props, (bx, by), LOOKOUT["yaw"] + math.pi, deck_z)
# Benches at the two canyon-rim overlooks of the mesa trail and at the gliderport's edge.
for (x, y), facing in (((-47.5, -33.8), (-1.0, 0.25)), ((66.2, -59.0), (1.0, -0.2))):
    P.bench(props, (x, y), math.atan2(facing[0], -facing[1]), ground_at(x, y))
north_edge = EDGES["north"]
edge_y = lambda x: float(np.interp(x, north_edge[:, 0], north_edge[:, 1]))
for x in (166.0, 191.0):
    y = edge_y(x) - 5.0
    P.bench(props, (x, y), math.pi, ground_at(x, y))
P.chain_fence(props, [(x, edge_y(x) - 1.6) for x in np.linspace(150.0, 206.0, 24)], ground_at)

# The wind sock: a mast and, as its own node, the sock on a swivel at the top.
ws_x, ws_y = H.GLIDERPORT["windsock"]
ws_ground = ground_at(ws_x, ws_y)
MAST_HEIGHT = 6.4
mast = P.Batch()
P.windsock_mast(mast, 0.0, MAST_HEIGHT)
sock = P.Batch()
P.windsock(sock)
REST_DROOP = math.radians(12.0)
REST_YAW = math.radians(-15.0)  # the sock streams east-southeast, downwind of the prevailing WNW sea breeze

# Gliders soaring the ridge lift along the north bluffs. Routes are closed loops: along the bluff
# in the band of lift, a turn out to sea, back along a line further out, and a turn in.
GLIDERS = [
    {"kind": "paraglider", "x": (88.0, 335.0), "offset": 11.0, "turn": 21.0, "above": 11.0, "speed": 8.3, "phase": 0.08, "colors": ("canopy_red", "canopy_white", "helmet_white")},
    {"kind": "paraglider", "x": (142.0, 430.0), "offset": 17.0, "turn": 25.0, "above": 17.0, "speed": 7.7, "phase": 0.47, "colors": ("canopy_yellow", "canopy_orange", "helmet_red")},
    {"kind": "paraglider", "x": (62.0, 262.0), "offset": 14.0, "turn": 23.0, "above": 23.0, "speed": 8.8, "phase": 0.71, "colors": ("canopy_blue", "canopy_sky", "helmet_yellow")},
    {"kind": "hang-glider", "x": (112.0, 500.0), "offset": 24.0, "turn": 36.0, "above": 30.0, "speed": 12.6, "phase": 0.29, "colors": None},
]
tops = north_edge[:, 2]
window = 36.0


def bluff_top(x):
    near = np.abs(north_edge[:, 0] - x) < window
    return float(tops[near].max()) if near.any() else float(np.interp(x, north_edge[:, 0], tops))


def glider_route(spec):
    xa, xb = spec["x"]
    inner, outer = spec["offset"], spec["offset"] + 2 * spec["turn"]
    pts = []
    for x in np.arange(xa, xb, 22.0):
        pts.append((x, edge_y(x) + inner))
    for k in range(1, 8):
        a = -math.pi / 2 + math.pi * k / 8
        pts.append((xb + spec["turn"] * math.cos(a), edge_y(xb) + spec["offset"] + spec["turn"] * (1 + math.sin(a))))
    for x in np.arange(xb, xa, -22.0):
        pts.append((x, edge_y(x) + outer))
    for k in range(1, 8):
        a = math.pi / 2 + math.pi * k / 8
        pts.append((xa + spec["turn"] * math.cos(a), edge_y(xa) + spec["offset"] + spec["turn"] * (1 + math.sin(a))))
    out = []
    total = 0.0
    for k, (x, y) in enumerate(pts):
        if k:
            total += math.hypot(x - pts[k - 1][0], y - pts[k - 1][1])
        z = bluff_top(x) + spec["above"] + 2.5 * math.sin(total / 31.0 + spec["phase"] * 6.0)
        out.append((x, y, z))
    return np.asarray(out)


glider_objects = []
manifest_gliders = []
for i, spec in enumerate(GLIDERS):
    route = glider_route(spec)
    # Every point keeps at least 9 m of air under it.
    for x, y, z in route:
        g = ground_at(x, y) if point_in_polygon(boundary[:, :2], np.array([x]), np.array([y]))[0] else H.SEA
        assert z - max(g, H.SEA) > 9.0, (i, x, y, z, g)
    batch = P.Batch()
    if spec["kind"] == "paraglider":
        P.paraglider(batch, *spec["colors"])
    else:
        P.hang_glider(batch)
    glider_objects.append((f"hinterland_glider_{i}", batch, route))
    manifest_gliders.append({"node": f"hinterland_glider_{i}", "kind": spec["kind"], "speed": spec["speed"], "phase": spec["phase"],
                             "route": [[round(x, 2), round(z, 2), round(-y, 2)] for x, y, z in route]})
report["gliders"] = [{"kind": g["kind"], "points": len(g["route"]), "speed": g["speed"]} for g in manifest_gliders]

# Talus under the tall north bluffs and wave-worn rocks around the headland's foot.
talus = P.Batch()
for side, c in COASTS.items():
    s = c["samples"]
    beach = BEACHES[side]
    for i in range(len(s["u"])):
        u = s["u"][i]
        if side == "north" and u < 45 or side == "south" and not (60 < u < 175 or 295 < u < 410):
            continue
        if side == "south" and any(abs(u - at) < half + 2.5 for at, half, _, _ in H.CAVES):
            continue
        if rng.random() > (0.55 if side == "north" else 0.8):
            continue
        D = s["D"][i]
        T = np.array([-D[1], D[0]])
        start = beach["starts"][i]
        for _ in range(rng.integers(1, 4)):
            size = rng.uniform(0.35, 1.5) * (1.4 if side == "south" else 1.0)
            out = rng.uniform(-0.2, 3.5 if side == "north" else 6.0)
            p = start + D * out + T * rng.uniform(-1.5, 1.5)
            t = np.clip(out / max(beach["width"][i], 1.0), 0, 1)
            z = float(H.beach_profile(s["xr"][i], t)) if beach["width"][i] > 0.6 else H.SEA - 0.4
            mat = "pale" if side == "north" and u > 60 else "golden"
            P.blob(talus, mat, (p[0], p[1], z + size * 0.15), (size * rng.uniform(0.9, 1.3), size, size * rng.uniform(0.5, 0.75)), rng,
                   segments=6, rings=2, color=(rng.uniform(0.8, 1.0),) * 3, lump=0.22)
report["talusRocks"] = int(len(talus.verts))


def batch_object(name, batch, extras=None, sharp=None):
    """An object from a batch whose vertices are in the object's own frame."""
    verts, tris_, mats_, cols = batch.arrays()
    if not len(tris_):
        return None
    keys = sorted(set(mats_.tolist()))
    index = {k: n for n, k in enumerate(keys)}
    obj = make_mesh(name, verts, tris_, [MATS[k] for k in keys], [index[m] for m in mats_], normals=None)
    if sharp is not None:
        obj.data.set_sharp_from_angle(angle=math.radians(sharp))
    attr = obj.data.color_attributes.new("Hinterland tint", "FLOAT_COLOR", "POINT")
    attr.data.foreach_set("color", np.concatenate([cols, np.ones((len(cols), 1))], 1).astype(np.float32).ravel())
    obj.data.color_attributes.active_color = attr
    for key, value in (extras or {}).items():
        obj[key] = value
    return obj


PLANT_OBJECTS = [o for o in (batch_object(f"hinterland_flora_{k[0] + 10:02d}_{k[1] + 10:02d}", b) for k, b in sorted(veg_batches.items())) if o]
PROP_OBJECTS = [o for o in (batch_object("hinterland_lookout_and_gliderport", props, sharp=50), batch_object("hinterland_talus", talus)) if o]
mast_obj = batch_object("hinterland_windsock_mast", mast, sharp=50)
mast_obj.location = (ws_x, ws_y, ws_ground)
sock_obj = batch_object("hinterland_windsock", sock, extras={"windsock": True})
sock_obj.location = (ws_x, ws_y, ws_ground + MAST_HEIGHT + 0.12)
sock_obj.rotation_euler = (REST_DROOP, 0.0, REST_YAW)
for name, batch, route in glider_objects:
    obj = batch_object(name, batch, extras={"glider": True}, sharp=70)
    obj.location = tuple(route[0])
    heading = route[1] - route[0]
    obj.rotation_euler = (0.0, 0.0, math.atan2(heading[0], -heading[1]))  # the model faces -Y
    PROP_OBJECTS.append(obj)
PROP_OBJECTS += [mast_obj, sock_obj]
bpy.context.view_layer.update()
pivot = sock_obj.matrix_world.translation
direction = sock_obj.matrix_world.to_3x3() @ Vector((0, -1, 0))
MANIFEST_EXTRAS = {
    "windsock": {
        "node": "hinterland_windsock",
        "mast": "hinterland_windsock_mast",
        "pivot": [round(pivot.x, 3), round(pivot.z, 3), round(-pivot.y, 3)],
        "axis": "+Z",
        "length": P.WINDSOCK_LENGTH,
        "restDirection": [round(direction.x, 4), round(direction.z, 4), round(-direction.y, 4)],
        "note": "The sock mesh runs along the node's local +Z from its hoop at the node origin (the swivel on the mast). "
        "The authored rotation is the still pose: streaming east-southeast, drooping 12 degrees. At runtime hinterland.mjs turns it with "
        "the coast wind (wind-field.mjs coastWind.vane at the pivot): rotation.y is the vane's yaw and the droop about local X follows its extension.",
    },
    "gliders": manifest_gliders,
    "lookout": {"deck": [round(LOOKOUT["centre"][0], 2), round(deck_z, 2), round(-LOOKOUT["centre"][1], 2)]},
}
log("planting", report["planting"], "plant objects", len(PLANT_OBJECTS))

if PREVIEW:
    preview(next((a.split("=")[1].split(",") for a in ARGS if a.startswith("--views=")), list(VIEWS)))
    raise SystemExit(0)


# ---------------------------------------------------------------------------------------------
# Baked light: Cycles ambient occlusion into the vertex colours, the retained mainland standing in
# as an occluder. As on the house (bake_coastal_light.py), open ground bakes to 0.95; the beaches
# to 1.0, like the retained beach, which carries no colours.

FAST = "--fast" in ARGS
SHIPPED = [o for o in scene.objects if o.type == "MESH" and o.name.startswith("hinterland_")]


def bake_occlusion(objects):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.cycles.max_bounces = 2
    # The CPU by default: a shared integrated GPU has lost its device mid-bake, which no Python
    # handler can catch. `-- --gpu` opts into oneAPI.
    scene.cycles.device = "CPU"
    if "--gpu" in ARGS:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "ONEAPI"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = "GPU"
    scene.world = scene.world or bpy.data.worlds.new("Occlusion sky")
    scene.world.light_settings.distance = 6.0
    scene.render.bake.target = "VERTEX_COLORS"
    occlusion = {}
    for obj in objects:
        attr = obj.data.color_attributes.new("Occlusion", "FLOAT_COLOR", "CORNER")
        obj.data.color_attributes.active_color = attr
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.bake(type="AO", use_clear=True)
    for obj in objects:
        data = np.empty(len(obj.data.loops) * 4, np.float32)
        obj.data.color_attributes["Occlusion"].data.foreach_get("color", data)
        occlusion[obj.name] = data.reshape(-1, 4)[:, 0].copy()
        obj.data.color_attributes.remove(obj.data.color_attributes["Occlusion"])
    return occlusion


def finish_colours(objects, occlusion):
    """One byte colour per corner: the design colour times the baked shade, 64 steps a channel.
    Within 8 m of the mainland's walls the shade eases to the retained surface's own baked value at
    the nearest seam vertex, so no line shows where the two bakes meet."""
    stats = []
    for obj in objects:
        mesh = obj.data
        loops = len(mesh.loops)
        vi = np.empty(loops, np.int32)
        mesh.loops.foreach_get("vertex_index", vi)
        tint = np.ones((loops, 4), np.float32)
        if "Hinterland tint" in mesh.color_attributes:
            tint_attr = mesh.color_attributes["Hinterland tint"]
            raw = np.empty(len(tint_attr.data) * 4, np.float32)
            tint_attr.data.foreach_get("color", raw)
            raw = raw.reshape(-1, 4)
            tint = raw[vi] if tint_attr.domain == "POINT" else raw
        ao = occlusion.get(obj.name, np.ones(loops, np.float32)) if occlusion else np.ones(loops, np.float32)
        # One occlusion value per vertex (as optimize_coastal_exports.py shares its bake), so a
        # vertex keeps one colour within each material and the exporter never splits it.
        sums = np.bincount(vi, weights=ao, minlength=len(mesh.vertices))
        counts = np.maximum(np.bincount(vi, minlength=len(mesh.vertices)), 1)
        ao = (sums / counts)[vi]
        beach = obj.name.startswith("hinterland_beach")
        shade = (0.73 if beach else 0.68) + 0.27 * np.clip(ao, 0, 1)
        if obj.name.startswith("hinterland_ground"):
            co = np.empty(len(mesh.vertices) * 3)
            mesh.vertices.foreach_get("co", co)
            co = co.reshape(-1, 3)[vi]
            d = H.mainland_distance(co[:, 0], co[:, 1])
            close = d < 8.0
            if close.any():
                nearest = np.argmin(np.linalg.norm(seam_points[None, :, :2] - co[close, None, :2], axis=2), axis=1)
                w = 1 - H.smoothstep(0.0, 8.0, d[close])
                shade[close] = shade[close] * (1 - w) + seam_shades[nearest] * w
        rgb = np.clip(tint[:, :3] * shade[:, None], 0, 1)
        rgb = np.round(rgb * 63) / 63
        for name in [a.name for a in mesh.color_attributes]:
            mesh.color_attributes.remove(mesh.color_attributes[name])
        attr = mesh.color_attributes.new("Baked bounce", "BYTE_COLOR", "CORNER")
        attr.data.foreach_set("color", np.concatenate([rgb, np.ones((loops, 1))], 1).astype(np.float32).ravel())
        mesh.color_attributes.active_color = attr
        # The exporter writes the render colour attribute as COLOR_0.
        mesh.color_attributes.render_color_index = mesh.color_attributes.active_color_index
        stats.append({"mesh": obj.name, "corners": loops, "min": round(float(rgb.mean(1).min()), 3), "max": round(float(rgb.mean(1).max()), 3)})
    return stats


log("baking occlusion" if not FAST else "skipping the bake (--fast)")
OCCLUSION = None if FAST else bake_occlusion(SHIPPED)
report["bakedLight"] = finish_colours(SHIPPED, OCCLUSION)


# ---------------------------------------------------------------------------------------------
# The camera's terrain grid (manifest cameraCollision) grows to cover the new land wherever an
# outside camera could reach it. The retained cells are copied unchanged; each new node holds the
# highest ground within two metres (the grid step), so bilinear interpolation never dips below
# the finished surface. Foliage is not ground (coastal_camera.camera_support_meshes).

# The outside orbit (views.outside): target (3, -0.2, -6), 26 m of pan reach and a pitch of at least
# 0.18 rad, with the radius being raised to about 160 m. A little slack on each covers small changes.
CAMERA = {"centre": (3.0, -6.0), "reach": 32.0, "radius": 175.0, "pitch": 0.16, "targetY": -0.2, "margin": 0.8}


def support_tree(objects):
    verts, polys = [], []
    for obj in objects:
        base = len(verts)
        mw = obj.matrix_world
        verts.extend(mw @ v.co for v in obj.data.vertices)
        polys.extend(tuple(base + i for i in p.vertices) for p in obj.data.polygons)
    return BVHTree.FromPolygons(verts, polys)


def camera_grid(config, objects):
    """The new land's cells on the retained grid's lattice. The manifest keeps them in
    `hinterland.cameraGrid`; hinterland.mjs merges them into `cameraCollision` at runtime, the
    retained cells winning, so that key is never rewritten here."""
    old = config["cameraCollision"]
    tree = support_tree(objects)

    def height(bx, by):
        hit = tree.ray_cast(Vector((bx, by, 200.0)), Vector((0, 0, -1)), 400.0)[0]
        return max(hit.z, H.SEA) if hit is not None else H.SEA

    # Where could the camera meet this ground? Its height over any target within reach is at least
    # tan(min pitch) times the horizontal distance; past radius * cos(pitch) it cannot get there.
    cx, cz = CAMERA["centre"]
    reach_h = CAMERA["radius"] * math.cos(CAMERA["pitch"]) + CAMERA["reach"]
    xs_ = np.arange(cx - reach_h, cx + reach_h, 6.0)
    zs_ = np.arange(cz - reach_h, cz + reach_h, 6.0)
    needed = []
    for X in xs_:
        for Z in zs_:
            dh = math.hypot(X - cx, Z - cz)
            if dh > reach_h:
                continue
            h = max(height(X + ox, -(Z + oz)) for ox in (-3, 0, 3) for oz in (-3, 0, 3))
            floor = CAMERA["targetY"] + math.tan(CAMERA["pitch"]) * max(0.0, dh - CAMERA["reach"])
            if h + old["clearance"] + CAMERA["margin"] > floor and h > H.SEA + 0.01:
                needed.append((X, Z))
    needed = np.asarray(needed)
    step = old["step"]
    ox0, oz0 = old["origin"]
    lo_x = min(ox0, math.floor((needed[:, 0].min() - 6 - ox0) / step) * step + ox0)
    lo_z = min(oz0, math.floor((needed[:, 1].min() - 6 - oz0) / step) * step + oz0)
    hi_x = max(ox0 + (old["width"] - 1) * step, math.ceil((needed[:, 0].max() + 6 - ox0) / step) * step + ox0)
    hi_z = max(oz0 + (old["height"] - 1) * step, math.ceil((needed[:, 1].max() + 6 - oz0) / step) * step + oz0)
    width = int(round((hi_x - lo_x) / step)) + 1
    height_n = int(round((hi_z - lo_z) / step)) + 1
    di, dj = int(round((ox0 - lo_x) / step)), int(round((oz0 - lo_z) / step))
    elevations = []
    for j in range(height_n):
        for i in range(width):
            oi, oj = i - di, j - dj
            if 0 <= oi < old["width"] and 0 <= oj < old["height"]:
                elevations.append(old["elevations"][oj * old["width"] + oi])
                continue
            X, Z = lo_x + i * step, lo_z + j * step
            h = max(height(X + ox, -(Z + oz)) for ox in (-2, -1, 0, 1, 2) for oz in (-2, -1, 0, 1, 2))
            elevations.append(H.SEA if h <= H.SEA + 1e-6 else math.ceil(h * 10) / 10)
    grid = {"origin": [lo_x, lo_z], "step": step, "width": width, "height": height_n, "assumption": CAMERA, "elevations": elevations}
    record = {"origin": [lo_x, lo_z], "width": width, "height": height_n, "retainedOffset": [di, dj], "assumption": CAMERA}
    return grid, record


# ---------------------------------------------------------------------------------------------
# Export, manifest, source file and review record.


def export(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(EXPORT), export_format="GLB", use_selection=True, export_extras=True, export_cameras=False, export_lights=False,
        export_animations=False, export_texcoords=False, export_normals=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
        export_active_vertex_color_when_no_material=False, export_image_format="NONE", export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7, export_draco_position_quantization=16, export_draco_normal_quantization=10,
        export_draco_color_quantization=8,
    )


import coastal_water_garden  # noqa: E402
garden_objects, report["waterGarden"] = coastal_water_garden.apply()
SHIPPED += garden_objects
ground_support = [o for o in SHIPPED if o.name.startswith(("hinterland_ground", "hinterland_cliff", "hinterland_beach"))]
config = json.loads(MANIFEST.read_text(encoding="utf-8"))
log("camera grid")
grid, grid_report = camera_grid(config, ground_support)
report["cameraGrid"] = grid_report
hinterland_entry = {"file": "hinterland.glb"}
hinterland_entry.update(globals().get("MANIFEST_EXTRAS", {}))
hinterland_entry["cameraGrid"] = grid
# The key goes right after "coast", so the manifest's diff is one inserted block that no other
# writer's appended keys collide with.
config.pop("hinterland", None)
ordered = {}
for key, value in config.items():
    ordered[key] = value
    if key == "coast":
        ordered["hinterland"] = hinterland_entry
ordered.setdefault("hinterland", hinterland_entry)
config = ordered
MANIFEST.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
log("manifest written", grid["width"], "x", grid["height"], "camera grid")

export(SHIPPED)
report["export"] = {"bytes": EXPORT.stat().st_size, "objects": len(SHIPPED), "triangles": int(sum(len(o.data.polygons) for o in SHIPPED))}
log("exported", report["export"])

for obj in list(reference.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.data.collections.remove(reference)
bpy.ops.outliner.orphans_purge(do_recursive=True) if bpy.context.area else None
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET), compress=True)
report["source"] = {"bytes": TARGET.stat().st_size}
REVIEW.parent.mkdir(parents=True, exist_ok=True)
REVIEW.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
log("done", json.dumps(report["export"]))
