"""Furniture for the coastal home (Sirui, 2026-10-19), built in its own Blender source.

Sirui asked for the pieces he lives with: "my desk cahri herman miller aeron chair with head rest ...
Eames Lounge Chair and Ottoman in living room should also be improved", a larger dining table, a
glass-door refrigerator, a fancy Italian range with a swing-arm pot filler, a floating fireplace,
and the giant cast-iron pan he lifts to train his wrists. Each piece is original code-authored
geometry written to artwork/coastal-home/furniture.blend and exported per level of detail to
assets/models/home/furniture/<item>-lod0.glb (close and full-screen views) and <item>-lod1.glb (the
default), with index.json describing both for the runtime (assets/js/home-scene/furniture.mjs).

Real products set sizes, proportions and the reading of materials; nothing is a scan or a copy of a
downloaded model. Herman Miller's terms for the Eames model Sirui downloaded from its configurator
(MillerKnoll terms of use, effective 2026-10-06: personal, non-commercial use; no reproduction,
distribution, modification, derivative works or public display) do not allow shipping it on a
website, so the lounge chair is rebuilt here and the download served only as a measured reference:
overall dimensions and a handful of section heights read in Blender (artwork/coastal-home/PROVENANCE.md).

Conventions (the coastal-home pipeline): metres, Blender Z up. An item's origin is its floor-contact
centre and its front faces -Y, which the glTF exporter turns into three.js +Y up with the front
facing +Z: the manifest's actor-facing convention, so a furniture anchor's yaw turns an item the way
an actor's facing turns an avatar. Every surface carries the house's baked contact light in its
colour attribute (a Cycles AO bake, 0.70-1.0 in 32 grey steps, as bin/bake_coastal_light.py does
for the rooms), so the pieces sit in the house's light.

Run from the repository root:
  blender --background --factory-startup --python-exit-code 1 --python bin/build_coastal_furniture.py
  ... -- --item=eames-lounge,aeron   only these items (index.json keeps the others)
  ... -- --no-bake                    skip the AO bake (quick geometry checks)
  ... -- --review                     also render review stills to .jekyll-cache/visual-qa/furniture/
"""

import hashlib
import json
import math
import sys
import time
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "models" / "home" / "furniture"
SOURCE = ROOT / "artwork" / "coastal-home" / "furniture.blend"
REVIEW_JSON = ROOT / "artwork" / "coastal-home" / "reviews" / "furniture.json"
REVIEW_DIR = ROOT / ".jekyll-cache" / "visual-qa" / "furniture"
ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def option(name, default=None):
    for a in ARGS:
        if a == f"--{name}":
            return True
        if a.startswith(f"--{name}="):
            return a.split("=", 1)[1]
    return default


ONLY = set(option("item").split(",")) if option("item") else None
BAKE = not option("no-bake")
REVIEW = bool(option("review"))
LODS = (0, 1)
TAU = math.tau


# ── Textures ─────────────────────────────────────────────────────────────────────────────────────
# Small tiling images generated here (numpy), written into the GLBs as WebP (EXT_texture_webp).
# Rows run bottom to top, as Blender stores them; a normal map's green is +V, glTF's convention.


def _smooth(f):
    return f * f * (3.0 - 2.0 * f)


def lattice(rows, cols, shape, rng):
    """Periodic value noise: a random lattice of rows x cols, smoothly interpolated to `shape`."""
    h, w = shape
    grid = rng.random((rows, cols)).astype(np.float32)
    y = np.arange(h, dtype=np.float32) * rows / h
    x = np.arange(w, dtype=np.float32) * cols / w
    y0 = np.floor(y).astype(np.int64)
    x0 = np.floor(x).astype(np.int64)
    fy = _smooth(y - y0)[:, None]
    fx = _smooth(x - x0)[None, :]
    y0 %= rows
    x0 %= cols
    y1 = (y0 + 1) % rows
    x1 = (x0 + 1) % cols
    top = grid[y0][:, x0] * (1 - fx) + grid[y0][:, x1] * fx
    bottom = grid[y1][:, x0] * (1 - fx) + grid[y1][:, x1] * fx
    return top * (1 - fy) + bottom * fy


def fbm(shape, rows, cols, rng, octaves=4, gain=0.5):
    total, amp, norm = np.zeros(shape, np.float32), 1.0, 0.0
    for o in range(octaves):
        total += amp * lattice(rows * 2**o, cols * 2**o, shape, rng)
        norm += amp
        amp *= gain
    return total / norm


def worley(size, cells, rng):
    """Distances to the nearest and second-nearest jittered cell points, periodic."""
    points = rng.random((cells, cells, 2)).astype(np.float32)
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) * (cells / size)
    cx, cy = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    f1 = np.full((size, size), 9.0, np.float32)
    f2 = f1.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            nx, ny = cx + dx, cy + dy
            p = points[ny % cells, nx % cells]
            d = np.sqrt((nx + p[..., 0] - x) ** 2 + (ny + p[..., 1] - y) ** 2)
            f2 = np.where(d < f1, f1, np.minimum(f2, d))
            f1 = np.minimum(f1, d)
    return f1, f2


def normal_from_height(height, strength):
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
    n = np.stack([-dx * strength, -dy * strength, np.ones_like(height)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    rgba = np.ones(height.shape + (4,), np.float32)
    rgba[..., :3] = n * 0.5 + 0.5
    return rgba


def srgb_to_linear(c):
    c = np.asarray(c, np.float32) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def tex_leather(size):
    """Pebble-grain leather: plateaus between creases (cellular), a little fine pore noise."""
    rng = np.random.default_rng(31)
    f1, f2 = worley(size, max(8, size // 22), rng)
    plate = np.clip((f2 - f1) / 0.32, 0, 1)
    height = _smooth(plate) * 0.8 + 0.2 * fbm((size, size), 64, 64, rng, 2)
    return normal_from_height(height, 1.6 * size / 512), "Non-Color"


def tex_walnut(size):
    """Walnut veneer, grain running along V: growth bands, wavy figure, streaks and pores."""
    rng = np.random.default_rng(7)
    shape = (size, size)
    u = (np.arange(size, dtype=np.float32) / size)[None, :]
    warp = fbm(shape, 2, 5, rng, 3)
    wave = fbm(shape, 3, 2, rng, 2)
    bands = 0.5 + 0.5 * np.sin(TAU * (14 * u + 1.9 * warp + 0.35 * wave))
    streaks = fbm(shape, 8, 160, rng, 3)
    pores = lattice(48, 300, shape, rng)
    t = np.clip(0.4 * _smooth(bands) + 0.6 * streaks + 0.12 * (warp - 0.5), 0, 1)
    dark, mid, light = srgb_to_linear((74, 44, 26)), srgb_to_linear((110, 69, 41)), srgb_to_linear((140, 93, 58))
    col = np.where(t[..., None] < 0.5, dark + (mid - dark) * (t[..., None] / 0.5), mid + (light - mid) * ((t[..., None] - 0.5) / 0.5))
    col *= (1.0 - 0.18 * (pores > 0.82))[..., None]
    rgba = np.ones(shape + (4,), np.float32)
    rgba[..., :3] = linear_to_srgb(col)
    return rgba, "sRGB"


def tex_plywood_edge(size):
    """The edge of a moulded plywood shell: pale birch plies between thin dark glue lines, across V."""
    rng = np.random.default_rng(3)
    shape = (size, size)
    v = (np.arange(size, dtype=np.float32) / size)[:, None]
    plies = 7
    line = np.abs(((v * plies) % 1.0) - 0.5)
    glue = np.clip(1 - line / 0.06, 0, 1)
    tint = 0.85 + 0.15 * fbm(shape, 4, 24, rng, 2)
    ply = srgb_to_linear((214, 182, 136))
    col = ply[None, None, :] * tint[..., None] * (1 - 0.55 * glue[..., None])
    rgba = np.ones(shape + (4,), np.float32)
    rgba[..., :3] = linear_to_srgb(col)
    return rgba, "sRGB"


def tex_cast_iron(size):
    """Seasoned cast iron: a fine sand-cast pebble and shallow pits."""
    rng = np.random.default_rng(11)
    f1, f2 = worley(size, max(8, size // 6), rng)
    height = 0.7 * fbm((size, size), 48, 48, rng, 3) - 0.6 * np.clip(1 - f1 / 0.22, 0, 1) ** 2
    return normal_from_height(height, 1.1 * size / 512), "Non-Color"


def linear_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


TEXTURES = {"leather": tex_leather, "walnut": tex_walnut, "plywood-edge": tex_plywood_edge, "cast-iron": tex_cast_iron}
_image_cache = {}


def image(kind, size):
    key = (kind, size)
    if key in _image_cache:
        return _image_cache[key]
    pixels, colorspace = TEXTURES[kind](size)
    alpha = pixels.shape[-1] == 4 and float(pixels[..., 3].min()) < 1.0
    img = bpy.data.images.new(f"{kind} {size}", size, size, alpha=alpha)
    img.colorspace_settings.name = colorspace
    img.pixels.foreach_set(np.ascontiguousarray(pixels, np.float32).ravel())
    img.pack()
    _image_cache[key] = img
    return img


# ── Materials ────────────────────────────────────────────────────────────────────────────────────
# Linear RGB, roughness, metallic. Names stay stable across levels of detail except where a level
# carries its own texture size; the runtime strips the " (lod1)" suffix. Names avoid the words
# realism.mjs keys its procedural shading to (wood, oak, walnut, linen, stone, marble, ...) unless a
# piece is meant to share that shading.

MATERIALS = {
    # Eames lounge chair and ottoman (Sirui's: white leather, walnut, black base).
    "eames leather": dict(color=(0.74, 0.72, 0.68), roughness=0.42, normal=("leather", {0: 1024})),
    "eames veneer": dict(color=(1, 1, 1), roughness=0.36, albedo=("walnut", {0: 1024, 1: 512})),
    "eames plywood edge": dict(color=(0.82, 0.78, 0.72), roughness=0.5, albedo=("plywood-edge", {0: 256}), fallback=(0.5, 0.36, 0.21)),
    "eames black aluminium": dict(color=(0.011, 0.011, 0.012), roughness=0.2, metallic=0.55),
    "eames glide": dict(color=(0.02, 0.02, 0.02), roughness=0.75),
}


def _principled(mat):
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    return nodes.get("Principled BSDF") or next(n for n in nodes if n.type == "BSDF_PRINCIPLED")


_material_cache = {}


def material(name, lod):
    """The Blender material for `name` at `lod` (textures at that level's size, or none)."""
    spec = MATERIALS[name]
    textured = {k: spec[k] for k in ("albedo", "normal", "alpha") if k in spec and lod in spec[k][1]}
    key = (name, lod if any(len(spec[k][1]) > 1 or lod not in spec[k][1] for k in ("albedo", "normal", "alpha") if k in spec) else 0)
    if key in _material_cache:
        return _material_cache[key]
    label = name if key[1] == 0 else f"{name} (lod{lod})"
    mat = bpy.data.materials.new(label)
    bsdf = _principled(mat)
    color = spec["color"] if textured.get("albedo") or "albedo" not in spec else spec.get("fallback", spec["color"])
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = spec.get("roughness", 0.5)
    bsdf.inputs["Metallic"].default_value = spec.get("metallic", 0.0)
    mat.diffuse_color = (*color, 1)
    if spec.get("emission"):
        bsdf.inputs["Emission Color"].default_value = (*spec["emission"], 1)
        bsdf.inputs["Emission Strength"].default_value = spec.get("strength", 1.0)
    tree = mat.node_tree
    if "albedo" in textured:
        kind, sizes = textured["albedo"]
        node = tree.nodes.new("ShaderNodeTexImage")
        node.image = image(kind, sizes[lod])
        tree.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
        if spec.get("cutout"):
            clip = tree.nodes.new("ShaderNodeMath")
            clip.operation = "ROUND"
            tree.links.new(node.outputs["Alpha"], clip.inputs[0])
            tree.links.new(clip.outputs[0], bsdf.inputs["Alpha"])
    if "normal" in textured:
        kind, sizes = textured["normal"]
        node = tree.nodes.new("ShaderNodeTexImage")
        node.image = image(kind, sizes[lod])
        mapper = tree.nodes.new("ShaderNodeNormalMap")
        mapper.inputs["Strength"].default_value = spec.get("normalStrength", 1.0)
        tree.links.new(node.outputs["Color"], mapper.inputs["Color"])
        tree.links.new(mapper.outputs["Normal"], bsdf.inputs["Normal"])
    mat.use_backface_culling = not spec.get("doubleSided", False)
    _material_cache[key] = mat
    return mat


# ── Geometry ─────────────────────────────────────────────────────────────────────────────────────


class Parts:
    """Geometry for one item at one level of detail, batched per material."""

    def __init__(self, item, lod):
        self.item, self.lod = item, lod
        self.groups = {}
        self.nodes = []  # (name, bmesh-by-material dict, matrix, extras) for separately posed parts

    def bm(self, name, node=None):
        groups = self.groups if node is None else node["groups"]
        if name not in groups:
            bm = bmesh.new()
            bm.loops.layers.uv.verify()
            groups[name] = bm
        return groups[name]

    def node(self, name, origin=(0, 0, 0), extras=None):
        """A separately posed child (a pivot): geometry added to it is in its own frame."""
        entry = {"name": name, "groups": {}, "origin": Vector(origin), "extras": extras or {}}
        self.nodes.append(entry)
        return entry


def _uv(bm):
    return bm.loops.layers.uv.verify()


def grid(bm, rows, uvs=None, close=False, flip=False, smooth=True):
    """Quads between successive rows of points (lists of Vectors). `close` wraps each row."""
    uvl = _uv(bm)
    verts = [[bm.verts.new(p) for p in row] for row in rows]
    count = len(rows[0])
    span = count if close else count - 1
    for r in range(len(rows) - 1):
        for c in range(span):
            c1 = (c + 1) % count
            quad = [verts[r][c], verts[r][c1], verts[r + 1][c1], verts[r + 1][c]]
            corners = [(r, c), (r, c1), (r + 1, c1), (r + 1, c)]
            if flip:
                quad.reverse()
                corners.reverse()
            try:
                face = bm.faces.new(quad)
            except ValueError:
                continue
            face.smooth = smooth
            if uvs is not None:
                for loop, (rr, cc) in zip(face.loops, corners):
                    u, v = uvs[rr][cc]
                    if close and cc == 0 and c == count - 1:
                        u = uvs[rr][-1][0] + (uvs[rr][-1][0] - uvs[rr][-2][0])
                    loop[uvl].uv = (u, v)
    return verts


def fan(bm, center, ring, center_uv=None, ring_uvs=None, flip=False, smooth=True):
    """Triangles from one vertex to a closed ring (a pole)."""
    uvl = _uv(bm)
    c = bm.verts.new(center)
    vs = [bm.verts.new(p) for p in ring]
    n = len(vs)
    for i in range(n):
        tri = [c, vs[i], vs[(i + 1) % n]]
        uv = [center_uv, ring_uvs[i] if ring_uvs else None, ring_uvs[(i + 1) % n] if ring_uvs else None]
        if flip:
            tri.reverse()
            uv.reverse()
        face = bm.faces.new(tri)
        face.smooth = smooth
        if center_uv is not None:
            for loop, t in zip(face.loops, uv):
                loop[uvl].uv = t
    return c, vs


def lathe(bm, profile, center=(0, 0, 0), segments=24, uv_scale=1.0, smooth=True, cap_bottom=True, cap_top=True):
    """Revolve (radius, z) pairs about a vertical axis; zero radii become poles."""
    cx, cy, cz = center
    rows, uvs, length = [], [], 0.0
    previous = None
    for r, z in profile:
        if previous:
            length += math.hypot(r - previous[0], z - previous[1])
        previous = (r, z)
        rows.append([Vector((cx + r * math.cos(a), cy + r * math.sin(a), cz + z)) for a in (k * TAU / segments for k in range(segments))])
        uvs.append([(k / segments * TAU * max(r, 0.01) * uv_scale, length * uv_scale) for k in range(segments)])
    verts = grid(bm, rows, uvs, close=True, smooth=smooth)
    if cap_bottom and profile[0][0] > 1e-6:
        try:
            f = bm.faces.new(list(reversed(verts[0])))
            f.smooth = False
        except ValueError:
            pass
    if cap_top and profile[-1][0] > 1e-6:
        try:
            f = bm.faces.new(verts[-1])
            f.smooth = False
        except ValueError:
            pass
    return verts


def frames_along(points):
    """Parallel-transport frames (tangent, normal, binormal) along a polyline."""
    pts = [Vector(p) for p in points]
    tangents = []
    for i in range(len(pts)):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, len(pts) - 1)]
        tangents.append((b - a).normalized())
    up = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
    normal = (up - tangents[0] * up.dot(tangents[0])).normalized()
    frames = []
    for i, t in enumerate(tangents):
        if i:
            normal = (normal - t * normal.dot(t)).normalized()
        frames.append((t, normal, t.cross(normal)))
    return pts, frames


def sweep(bm, points, section, closed=False, caps=True, scale=None, uv_scale=1.0, smooth=True, twist=0.0):
    """Sweep a closed 2D section [(x, y)] along a polyline; `scale(i, t)` -> (sx, sy) tapers it."""
    pts, frames = frames_along(points)
    rows, uvs, length = [], [], 0.0
    perimeter = sum(math.hypot(section[(k + 1) % len(section)][0] - section[k][0], section[(k + 1) % len(section)][1] - section[k][1]) for k in range(len(section)))
    for i, (p, (t, n, b)) in enumerate(zip(pts, frames)):
        if i:
            length += (p - pts[i - 1]).length
        sx, sy = scale(i, i / max(len(pts) - 1, 1)) if scale else (1.0, 1.0)
        ca, sa = math.cos(twist * i), math.sin(twist * i)
        row, uvrow, run = [], [], 0.0
        for k, (x, y) in enumerate(section):
            xx, yy = x * ca - y * sa, x * sa + y * ca
            row.append(p + n * (xx * sx) + b * (yy * sy))
            if k:
                run += math.hypot(section[k][0] - section[k - 1][0], section[k][1] - section[k - 1][1])
            uvrow.append((run / perimeter * perimeter * uv_scale, length * uv_scale))
        rows.append(row)
        uvs.append(uvrow)
    if closed:
        rows.append(rows[0])
        uvs.append([(u, length * uv_scale) for u, _ in uvs[0]])
    verts = grid(bm, rows, uvs, close=True, smooth=smooth)
    if caps and not closed:
        for ring, flip in ((verts[0], True), (verts[-1], False)):
            try:
                f = bm.faces.new(list(reversed(ring)) if flip else ring)
                f.smooth = False
            except ValueError:
                pass
    return verts


def circle(radius, segments, start=0.0):
    return [(radius * math.cos(start + k * TAU / segments), radius * math.sin(start + k * TAU / segments)) for k in range(segments)]


def rounded_rect(w, h, r, per_corner=4):
    """A closed rounded rectangle section centred on the origin, counter-clockwise."""
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    out = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for k in range(per_corner + 1):
            a = math.radians(a0 + 90 * k / per_corner)
            out.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return out


def box(bm, center, size, radius=0.0, segments=2, matrix=None):
    """A box, optionally rounded on every edge, transformed by `matrix` about its centre."""
    temp = bmesh.new()
    m = Matrix.Translation(center) @ (matrix or Matrix.Identity(4)) @ Matrix.Diagonal((*size, 1))
    bmesh.ops.create_cube(temp, size=1, matrix=m, calc_uvs=True)
    if radius > 0:
        bmesh.ops.bevel(temp, geom=list(temp.edges), offset=min(radius, min(size) * 0.45), offset_type="OFFSET", segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True)
    for f in temp.faces:
        f.smooth = radius > 0
    data = bpy.data.meshes.new("tmp")
    temp.to_mesh(data)
    temp.free()
    bm.from_mesh(data)
    bpy.data.meshes.remove(data)


def catmull(points, samples):
    """A Catmull-Rom curve through `points`, resampled to `samples` points evenly by arc length."""
    pts = [Vector(p) for p in points]
    dense = []
    for i in range(len(pts) - 1):
        p0 = pts[max(i - 1, 0)]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[min(i + 2, len(pts) - 1)]
        for k in range(24):
            t = k / 24
            t2, t3 = t * t, t * t * t
            dense.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    dense.append(pts[-1])
    return resample(dense, samples)


def resample(dense, samples):
    lengths = [0.0]
    for a, b in zip(dense, dense[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    total = lengths[-1]
    out, j = [], 0
    for k in range(samples):
        s = total * k / (samples - 1)
        while j < len(lengths) - 2 and lengths[j + 1] < s:
            j += 1
        seg = lengths[j + 1] - lengths[j] or 1.0
        out.append(dense[j].lerp(dense[j + 1], (s - lengths[j]) / seg))
    return out


# ── Upholstery: a superellipse cushion on a bent spine ────────────────────────────────────────────


class Spine:
    """A curve in the YZ plane, by arc length. A cushion's local (x, s, t) maps to
    spine(s) + N(s) t + X x, N being the tangent turned toward the cushion's face (+90° about X)."""

    def __init__(self, points, samples=200):
        self.points = catmull([Vector((0, y, z)) for y, z in points], samples)
        self.lengths = [0.0]
        for a, b in zip(self.points, self.points[1:]):
            self.lengths.append(self.lengths[-1] + (b - a).length)
        self.length = self.lengths[-1]

    def at(self, s):
        s = min(max(s, 0.0), self.length)
        j = 0
        lo, hi = 0, len(self.lengths) - 2
        while lo <= hi:
            mid = (lo + hi) // 2
            if self.lengths[mid] <= s:
                j = mid
                lo = mid + 1
            else:
                hi = mid - 1
        seg = self.lengths[j + 1] - self.lengths[j] or 1.0
        f = (s - self.lengths[j]) / seg
        p = self.points[j].lerp(self.points[j + 1], f)
        t = (self.points[j + 1] - self.points[j]).normalized()
        return p, t, Vector((0, -t.z, t.y))

    def extend(self, s):
        """Points beyond either end continue along the end tangents."""
        if 0 <= s <= self.length:
            return self.at(s)
        end = 0.0 if s < 0 else self.length
        p, t, n = self.at(end)
        return p + t * (s - end), t, n


def superellipse(half_w, half_l, exponent, count):
    """`count` points evenly spaced by arc length around |x/a|^n + |y/b|^n = 1, with outward normals,
    starting at +x and running counter-clockwise."""
    dense = []
    for k in range(2400):
        a = k / 2400 * TAU
        c, s = math.cos(a), math.sin(a)
        x = half_w * math.copysign(abs(c) ** (2 / exponent), c)
        y = half_l * math.copysign(abs(s) ** (2 / exponent), s)
        dense.append(Vector((x, y, 0)))
    dense.append(dense[0].copy())
    pts = resample(dense, count + 1)[:-1]
    normals = []
    for i, p in enumerate(pts):
        a, b = pts[i - 1], pts[(i + 1) % count]
        t = (b - a).normalized()
        normals.append(Vector((t.y, -t.x, 0)))
    return pts, normals


def cushion(bm, spec, quality):
    """A tufted, piped leather cushion.

    spec: width, length (plan, along x and the spine), thickness (callable of the plan point or a
    number), exponent (corner squareness), spine (Spine) with `s0` (where the plan's -y edge sits on
    it), cup (edge rise across the width), roll (edge radius on the face), lower (edge radius at the
    back), buttons [(x, y)] in plan coordinates (y from the plan's centre along the spine),
    tuft (dimple depth), crease (fold depth), piping (radius) and pipe_bm (where piping goes).
    quality: segments around, face rings, roll rings.
    """
    W, L = spec["width"], spec["length"]
    hw, hl = W / 2, L / 2
    seg, rings, roll_rings = quality["segments"], quality["rings"], quality["roll"]
    outline, normals = superellipse(hw, hl, spec.get("exponent", 4.0), seg)
    spine, s0 = spec["spine"], spec.get("s0", 0.0)
    cup = spec.get("cup", 0.0)
    roll, lower = spec.get("roll", 0.035), spec.get("lower", 0.02)
    thickness = spec["thickness"]
    T = (lambda x, y: thickness) if not callable(thickness) else thickness
    dome = spec.get("dome", 0.006)
    buttons = spec.get("buttons", [])
    tuft, crease = spec.get("tuft", 0.0), spec.get("crease", 0.0)
    tile = spec.get("tile", 0.08)

    x0 = spec.get("x0", 0.0)

    def place(x, y, t):
        p, _, n = spine.extend(s0 + hl + y)
        rise = cup * (x / hw) ** 2
        return p + Vector((x + x0, 0, 0)) + n * (t + rise)

    def tufting(x, y):
        d = 0.0
        for bx, by in buttons:
            r2 = (x - bx) ** 2 + (y - by) ** 2
            d += tuft * math.exp(-r2 / (2 * 0.028**2))
            if crease:
                # Folds run from each button toward its neighbours and out to the edge.
                for ang in (0.0, math.pi / 2, math.pi, 1.5 * math.pi):
                    ux, uy = math.cos(ang), math.sin(ang)
                    along = (x - bx) * ux + (y - by) * uy
                    if along <= 0:
                        continue
                    across = abs(-(x - bx) * uy + (y - by) * ux)
                    reach = 0.16
                    d += crease * math.exp(-(across**2) / (2 * 0.009**2)) * max(0.0, 1 - along / reach) ** 1.5
        return d

    rows, uvs = [], []
    # Face: rings from the centre to the start of the roll, scaled toward the centre.
    inset = [o - nrm * roll for o, nrm in zip(outline, normals)]
    for k in range(1, rings + 1):
        f = k / rings
        row, uvrow = [], []
        for p in inset:
            x, y = p.x * f, p.y * f
            t = T(x, y) - dome * f * f - tufting(x, y)
            row.append(place(x, y, t))
            uvrow.append((x / tile, y / tile))
        rows.append(row)
        uvs.append(uvrow)
    # The face roll down to the seam, and the back roll to the underside.
    perimeter = [0.0]
    for a, b in zip(outline, outline[1:] + outline[:1]):
        perimeter.append(perimeter[-1] + (b - a).length)
    seam_row = len(rows) + roll_rings - 1
    for k in range(1, roll_rings + 1):
        a = k / roll_rings * math.pi / 2
        row, uvrow = [], []
        for i, (o, nrm) in enumerate(zip(outline, normals)):
            x, y = o.x - nrm.x * roll * (1 - math.sin(a)), o.y - nrm.y * roll * (1 - math.sin(a))
            top = T(o.x, o.y)
            seam = spec.get("seam", 0.55) * top
            t = seam + (top - seam - dome) * math.cos(a)
            row.append(place(x, y, t))
            uvrow.append((perimeter[i] / tile, (top - t) / tile))
        rows.append(row)
        uvs.append(uvrow)
    for k in range(1, max(2, roll_rings // 2) + 1):
        a = math.pi / 2 + k / max(2, roll_rings // 2) * math.pi / 2
        row, uvrow = [], []
        for i, (o, nrm) in enumerate(zip(outline, normals)):
            x, y = o.x - nrm.x * lower * (1 - math.sin(a)), o.y - nrm.y * lower * (1 - math.sin(a))
            top = T(o.x, o.y)
            seam = spec.get("seam", 0.55) * top
            t = seam * (1 + math.cos(a))
            row.append(place(x, y, max(t, 0.0)))
            uvrow.append((perimeter[i] / tile, (top - t) / tile))
        rows.append(row)
        uvs.append(uvrow)
    # The underside: a few rings back to the centre.
    under = [o - nrm * lower for o, nrm in zip(outline, normals)]
    for k in range(quality.get("under", 2), 0, -1):
        f = (k - 1) / quality.get("under", 2) * 0.999 + 0.001
        rows.append([place(p.x * f, p.y * f, 0.0) for p in under])
        uvs.append([(p.x * f / tile, p.y * f / tile) for p in under])
    centre = place(0, 0, T(0, 0) - dome - tufting(0, 0))
    # The rings run counter-clockwise seen from the face, so quads face outward as built.
    grid(bm, rows, uvs, close=True, flip=True)
    fan(bm, centre, rows[0], (0, 0), uvs[0], flip=False)
    fan(bm, place(0, 0, 0.0), rows[-1], (0, 0), uvs[-1], flip=True)
    # Buttons: small leather domes sunk into the dimples.
    for bx, by in buttons:
        t = T(bx, by) - dome - tufting(bx, by)
        _, _, n = spine.extend(s0 + hl + by)
        base = place(bx, by, t - 0.002)
        profile = [(0.0, 0.0), (0.0105, 0.0), (0.0105, 0.002), (0.008, 0.0055), (0.0, 0.0068)]
        temp = bmesh.new()
        temp.loops.layers.uv.verify()
        lathe(temp, profile, (0, 0, 0), max(10, quality["segments"] // 6), cap_bottom=False)
        rot = Vector((0, 0, 1)).rotation_difference(n).to_matrix().to_4x4()
        bmesh.ops.transform(temp, matrix=Matrix.Translation(base) @ rot, verts=list(temp.verts))
        _merge(bm, temp)
    # Piping along the seam, pushed out by most of its radius so it reads as a welt.
    if spec.get("piping") and quality.get("pipe", 0):
        r = spec["piping"]
        path = []
        for p, o, nrm in zip(rows[seam_row], outline, normals):
            _, tangent, _ = spine.extend(s0 + hl + o.y)
            path.append(p + (Vector((nrm.x, 0, 0)) + tangent * nrm.y).normalized() * r * 0.55)
        sweep(spec.get("pipe_bm", bm), path + [path[0]], circle(r, quality["pipe"]), caps=False, uv_scale=1 / tile)
    return rows, seam_row


def _merge(bm, temp):
    data = bpy.data.meshes.new("tmp")
    temp.to_mesh(data)
    temp.free()
    bm.from_mesh(data)
    bpy.data.meshes.remove(data)


def panel(parts, spec, quality):
    """A moulded plywood shell under or behind a cushion: veneer on both faces, the plies on its edge.
    Shares the cushion's plan/spine convention (spec: width, length, exponent, spine, s0, cup, x0) and
    lies between t = -gap - thickness and t = -gap."""
    W, L = spec["width"], spec["length"]
    hw, hl = W / 2, L / 2
    seg, rings = quality["segments"], max(2, quality["rings"] // 2)
    outline, normals = superellipse(hw, hl, spec.get("exponent", 4.0), seg)
    spine, s0, cup = spec["spine"], spec.get("s0", 0.0), spec.get("cup", 0.0)
    gap, th, x0 = spec.get("gap", 0.003), spec.get("thickness", 0.014), spec.get("x0", 0.0)
    lift = spec.get("lift", lambda x, y: 0.0)
    tile = spec.get("tile", 0.45)

    def place(x, y, t):
        p, _, n = spine.extend(s0 + hl + y)
        return p + Vector((x + x0, 0, 0)) + n * (t + cup * (x / hw) ** 2 + lift(x, y))

    veneer, edge = parts.bm(spec.get("face", "eames veneer")), parts.bm(spec.get("edge", "eames plywood edge"))
    for t, flip in ((-gap, False), (-gap - th, True)):
        rows, uvs = [], []
        for k in range(1, rings + 1):
            f = k / rings
            rows.append([place(p.x * f, p.y * f, t) for p in outline])
            uvs.append([(p.x * f / tile, p.y * f / tile) for p in outline])
        grid(veneer, rows, uvs, close=True, flip=not flip)
        fan(veneer, place(0, 0, t), rows[0], (0, 0), uvs[0], flip=flip)
    perimeter = [0.0]
    for a, b in zip(outline, outline[1:] + outline[:1]):
        perimeter.append(perimeter[-1] + (b - a).length)
    rim = [[place(p.x, p.y, -gap) for p in outline], [place(p.x, p.y, -gap - th) for p in outline]]
    grid(edge, rim, [[(perimeter[i] / 0.05, 0.0) for i in range(seg)], [(perimeter[i] / 0.05, 1.0) for i in range(seg)]], close=True)
    return place


def extruded_outline(bm, outline_yz, x_center, thickness, uv_tile=0.6, smooth_rim=True):
    """A flat plate in the YZ plane (an outline of (y, z) points), `thickness` thick along X."""
    temp = bmesh.new()
    uvl = temp.loops.layers.uv.verify()
    a = [temp.verts.new((x_center - thickness / 2, y, z)) for y, z in outline_yz]
    b = [temp.verts.new((x_center + thickness / 2, y, z)) for y, z in outline_yz]
    fa = temp.faces.new(list(reversed(a)))
    fb = temp.faces.new(b)
    n = len(outline_yz)
    for i in range(n):
        f = temp.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
        f.smooth = smooth_rim
    for f in (fa, fb):
        for loop in f.loops:
            loop[uvl].uv = (loop.vert.co.y / uv_tile, loop.vert.co.z / uv_tile)
    bmesh.ops.triangulate(temp, faces=[fa, fb], quad_method="BEAUTY", ngon_method="BEAUTY")
    _merge(bm, temp)


def star_base(parts, mat, center, legs, tip_radius, hub_top, tip_height, start_angle, quality, width=(0.046, 0.03), height=(0.032, 0.021), glide="eames glide"):
    """A cast swivel base: tapered, gently arched legs from a hub to glide bosses."""
    cx, cy = center
    bm = parts.bm(mat)
    steps = quality["leg"]
    section = rounded_rect(1.0, 1.0, 0.32, 3 if steps > 6 else 1)
    for i in range(legs):
        a = start_angle + i * TAU / legs
        d = Vector((math.cos(a), math.sin(a), 0))
        path = catmull(
            [Vector((cx, cy, 0)) + d * r + Vector((0, 0, z)) for r, z in ((0.04, hub_top), (tip_radius * 0.4, hub_top - 0.012), (tip_radius * 0.75, tip_height + 0.022), (tip_radius, tip_height))],
            steps,
        )

        def scale(j, t):
            return (width[0] + (width[1] - width[0]) * t, height[0] + (height[1] - height[0]) * t)

        sweep(bm, path, section, caps=True, scale=scale)
        tip = Vector((cx, cy, 0)) + d * tip_radius
        lathe(bm, [(0.0, 0.012), (0.019, 0.012), (0.021, 0.03), (0.017, tip_height + 0.012), (0.0, tip_height + 0.014)], (tip.x, tip.y, 0), max(8, quality["segments"] // 5))
        lathe(parts.bm(glide), [(0.0, 0.0), (0.016, 0.0), (0.02, 0.006), (0.019, 0.0125), (0.0, 0.0125)], (tip.x, tip.y, 0), max(8, quality["segments"] // 5))
    lathe(
        bm,
        [(0.0, hub_top - 0.07), (0.05, hub_top - 0.07), (0.068, hub_top - 0.05), (0.07, hub_top - 0.025), (0.055, hub_top + 0.004), (0.033, hub_top + 0.012), (0.0, hub_top + 0.014)],
        (cx, cy, 0),
        max(12, quality["segments"] // 3),
    )


QUALITY = {
    0: dict(segments=64, rings=16, roll=5, under=2, pipe=6, leg=14, arm=40),
    1: dict(segments=32, rings=3, roll=2, under=1, pipe=0, leg=5, arm=16),
}


def spine_offset(spine, value, axis="y"):
    """Arc length along `spine` where its y (default) or z comes closest to `value`."""
    best, best_s = 1e9, 0.0
    for k in range(400):
        s = spine.length * k / 399
        p, _, _ = spine.at(s)
        d = abs((p.y if axis == "y" else p.z) - value)
        if d < best:
            best, best_s = d, s
    return best_s


def build_eames(parts, q):
    """The lounge chair and ottoman as Sirui has them: white leather, walnut shells, black base.

    Proportions follow the measured reference (Herman Miller's published 32.75 x 32.75 x 31.5 in
    standard chair and 26 x 21 x 17.25 in ottoman; section heights read from the downloaded model),
    authored here as cushions on bent spines and moulded shells. Chair frame: the chair's centre at
    y = 0 before the pair is centred on its footprint; front is -y."""
    leather = "eames leather"
    pipe_bm = parts.bm(leather)
    cushion_q = dict(segments=q["segments"], rings=q["rings"], roll=q["roll"], under=q["under"], pipe=q["pipe"])
    small_q = dict(segments=max(16, q["segments"] * 3 // 4), rings=max(2, q["rings"] // 2), roll=q["roll"], under=1, pipe=q["pipe"])
    lod0 = parts.lod == 0
    crease = 0.0075 if lod0 else 0.0
    tuft = 0.02 if lod0 else 0.008

    # Seat: a deep cushion on a shell that dips toward the back.
    seat_spine = Spine([(-0.43, 0.264), (-0.408, 0.262), (-0.31, 0.256), (-0.21, 0.246), (-0.10, 0.232), (0.0, 0.212), (0.05, 0.195), (0.088, 0.176), (0.11, 0.165)])
    seat_s0 = spine_offset(seat_spine, -0.408)
    seat = dict(
        width=0.614,
        length=0.496,
        exponent=3.3,
        spine=seat_spine,
        s0=seat_s0,
        thickness=lambda x, y: (0.112 - 0.012 * (y / 0.248)) * (1 - 0.07 * (x / 0.307) ** 2),
        cup=0.012,
        roll=0.046,
        lower=0.02,
        seam=0.5,
        buttons=[(0.0, 0.03)],
        tuft=tuft,
        crease=crease,
        piping=0.0048,
        pipe_bm=pipe_bm,
    )
    cushion(parts.bm(leather), seat, cushion_q)
    panel(parts, dict(width=0.648, length=0.53, exponent=3.6, spine=seat_spine, s0=seat_s0 - 0.017, cup=0.026, thickness=0.014), q)

    # Back: a reclined cushion with a lumbar roll, cupped across its width.
    back_spine = Spine([(0.17, 0.19), (0.182, 0.212), (0.213, 0.28), (0.244, 0.345), (0.27, 0.41), (0.296, 0.47), (0.305, 0.49)])
    back_len = 0.29
    back_s0 = spine_offset(back_spine, 0.182)
    back = dict(
        width=0.6,
        length=back_len,
        exponent=3.4,
        spine=back_spine,
        s0=back_s0,
        thickness=lambda x, y: (0.082 + 0.022 * math.exp(-(((y + 0.06) / 0.07) ** 2))) * (1 - 0.06 * (x / 0.3) ** 2),
        cup=0.034,
        roll=0.044,
        lower=0.016,
        seam=0.45,
        buttons=[(-0.125, 0.01), (0.125, 0.01)],
        tuft=tuft,
        crease=crease,
        piping=0.0048,
        pipe_bm=pipe_bm,
    )
    cushion(parts.bm(leather), back, cushion_q)
    panel(parts, dict(width=0.632, length=back_len + 0.03, exponent=3.6, spine=back_spine, s0=back_s0 - 0.016, cup=0.04, thickness=0.014), q)

    # Headrest.
    head_spine = Spine([(0.338, 0.5), (0.343, 0.525), (0.359, 0.60), (0.374, 0.67), (0.39, 0.74), (0.40, 0.785), (0.404, 0.81)])
    head_len = 0.27
    head_s0 = spine_offset(head_spine, 0.343)
    head = dict(
        width=0.592,
        length=head_len,
        exponent=3.4,
        spine=head_spine,
        s0=head_s0,
        thickness=lambda x, y: (0.068 + 0.024 * math.exp(-(((y + 0.085) / 0.06) ** 2))) * (1 - 0.06 * (x / 0.296) ** 2),
        cup=0.03,
        roll=0.04,
        lower=0.015,
        seam=0.45,
        buttons=[(-0.122, 0.018), (0.122, 0.018)],
        tuft=tuft,
        crease=crease,
        piping=0.0046,
        pipe_bm=pipe_bm,
    )
    cushion(parts.bm(leather), head, cushion_q)
    panel(parts, dict(width=0.622, length=head_len + 0.026, exponent=3.6, spine=head_spine, s0=head_s0 - 0.013, cup=0.036, thickness=0.014), q)

    # Arm pads on black aluminium arms, over walnut wings that rise from the seat shell.
    for side in (-1, 1):
        arm_spine = Spine([(-0.25, 0.4), (-0.218, 0.402), (-0.05, 0.408), (0.127, 0.413), (0.16, 0.414)])
        arm = dict(
            width=0.118,
            length=0.345,
            exponent=2.7,
            spine=arm_spine,
            s0=spine_offset(arm_spine, -0.218),
            x0=side * 0.346,
            thickness=lambda x, y: 0.066 * (1 - 0.1 * (x / 0.059) ** 2),
            roll=0.03,
            lower=0.014,
            seam=0.42,
            piping=0.0042,
            pipe_bm=pipe_bm,
        )
        cushion(parts.bm(leather), arm, small_q)
        box(parts.bm("eames black aluminium"), (side * 0.343, -0.04, 0.392), (0.05, 0.3, 0.014), 0.005 if lod0 else 0.0)
        box(parts.bm("eames black aluminium"), (side * 0.32, 0.085, 0.36), (0.016, 0.05, 0.08), 0.004 if lod0 else 0.0)
        wing = [(-0.17, 0.262), (-0.15, 0.322), (-0.11, 0.366), (-0.05, 0.384), (0.04, 0.388), (0.095, 0.372), (0.118, 0.33), (0.12, 0.25), (0.105, 0.2), (0.0, 0.215), (-0.1, 0.236)]
        if not lod0:
            wing = wing[::2] + [wing[-1]]
        extruded_outline(parts.bm("eames veneer"), wing, side * 0.318, 0.014)

    # Back braces: two black aluminium bars joining the back shell to the headrest shell.
    for side in (-1, 1):
        x = side * 0.12
        path = catmull([Vector((x, 0.305, 0.41)), Vector((x, 0.33, 0.47)), Vector((x, 0.352, 0.54)), Vector((x, 0.366, 0.61))], 10 if lod0 else 4)
        sweep(parts.bm("eames black aluminium"), [p + Vector((0, 0.018, 0)) for p in path], rounded_rect(0.034, 0.011, 0.004, 2 if lod0 else 1), caps=True)

    # Swivel: the spider under the seat shell, the column and the five-star base.
    hub = (0.0, -0.052)
    lathe(parts.bm("eames black aluminium"), [(0.0, 0.12), (0.03, 0.12), (0.03, 0.178), (0.1, 0.182), (0.105, 0.19), (0.0, 0.192)], (hub[0], hub[1], 0), max(12, q["segments"] // 3))
    for k in range(4):
        a = k * TAU / 4 + TAU / 8
        box(parts.bm("eames black aluminium"), (hub[0] + 0.1 * math.cos(a), hub[1] + 0.1 * math.sin(a), 0.19), (0.16, 0.03, 0.01), 0.003 if lod0 else 0.0, matrix=Matrix.Rotation(a, 4, "Z"))
    star_base(parts, "eames black aluminium", hub, 5, 0.392, 0.112, 0.034, -math.pi / 2, q)

    # Ottoman: a dished shell, a deep cushion with two buttons, a four-star base.
    oy = -0.91
    otto_spine = Spine([(oy - 0.3, 0.304), (oy - 0.262, 0.302), (oy, 0.288), (oy + 0.262, 0.302), (oy + 0.3, 0.304)])
    otto_s0 = spine_offset(otto_spine, oy - 0.262)
    otto = dict(
        width=0.636,
        length=0.524,
        exponent=3.4,
        spine=otto_spine,
        s0=otto_s0,
        thickness=lambda x, y: 0.135 * (1 - 0.07 * (x / 0.318) ** 2) * (1 - 0.06 * (y / 0.262) ** 2),
        cup=0.01,
        roll=0.05,
        lower=0.02,
        seam=0.48,
        buttons=[(-0.13, 0.0), (0.13, 0.0)],
        tuft=tuft,
        crease=crease,
        piping=0.0048,
        pipe_bm=pipe_bm,
    )
    cushion(parts.bm(leather), otto, cushion_q)
    panel(parts, dict(width=0.664, length=0.55, exponent=3.6, spine=otto_spine, s0=otto_s0 - 0.013, cup=0.03, thickness=0.014), q)
    lathe(parts.bm("eames black aluminium"), [(0.0, 0.1), (0.028, 0.1), (0.028, 0.255), (0.09, 0.258), (0.0, 0.266)], (0.0, oy, 0), max(12, q["segments"] // 3))
    star_base(parts, "eames black aluminium", (0.0, oy), 4, 0.218, 0.095, 0.032, math.pi / 4, q, width=(0.04, 0.028), height=(0.028, 0.019))
    return dict(
        label="Eames lounge chair and ottoman",
        seat=(0.0, -0.06, 0.33),
        seatHeight=0.38,
        near=1.6,
        provenance="Original Blender geometry after the Eames Lounge Chair and Ottoman (Herman Miller): published dimensions and a measured reference from Sirui's configurator download, whose terms do not allow redistribution; nothing from the download is shipped.",
    )


ITEMS = {"eames-lounge": build_eames}


# ── Realize, bake, export ────────────────────────────────────────────────────────────────────────


def _mesh(name, bm, mat):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    me.set_sharp_from_angle(angle=math.radians(46))
    return me


def realize(parts, collection, center_shift=Vector((0, 0, 0))):
    root = bpy.data.objects.new(f"{parts.item}.lod{parts.lod}", None)
    root.empty_display_size = 0.2
    collection.objects.link(root)
    root["furnitureItem"] = parts.item
    root["lod"] = parts.lod
    objects = []
    for name, bm in parts.groups.items():
        bmesh.ops.translate(bm, verts=bm.verts, vec=center_shift)
        label = f"{parts.item}.lod{parts.lod}__{name}"
        obj = bpy.data.objects.new(label, _mesh(label, bm, material(name, parts.lod)))
        collection.objects.link(obj)
        obj.parent = root
        objects.append(obj)
    for node in parts.nodes:
        pivot = bpy.data.objects.new(f"{parts.item}.lod{parts.lod}::{node['name']}", None)
        collection.objects.link(pivot)
        pivot.parent = root
        pivot.location = node["origin"] + center_shift
        for k, v in node["extras"].items():
            pivot[k] = v
        for name, bm in node["groups"].items():
            label = f"{parts.item}.lod{parts.lod}::{node['name']}__{name}"
            obj = bpy.data.objects.new(label, _mesh(label, bm, material(name, parts.lod)))
            collection.objects.link(obj)
            obj.parent = pivot
            objects.append(obj)
    return root, objects


def footprint_shift(parts):
    """The shift that puts the footprint's centre at the origin (x and y; z untouched)."""
    lo, hi = Vector((1e9, 1e9, 1e9)), Vector((-1e9, -1e9, -1e9))
    groups = list(parts.groups.values())
    for node in parts.nodes:
        for bm in node["groups"].values():
            for v in bm.verts:
                p = v.co + node["origin"]
                lo, hi = Vector(map(min, lo, p)), Vector(map(max, hi, p))
    for bm in groups:
        for v in bm.verts:
            lo, hi = Vector(map(min, lo, v.co)), Vector(map(max, hi, v.co))
    return Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, 0.0))


def bake(objects, collection, distance=0.32, samples=32):
    """Cycles AO into each surface's colour attribute, then the house's quantized grey (0.70-1.0)."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.world = scene.world or bpy.data.worlds.new("Furniture bake")
    scene.world.light_settings.distance = distance
    for col in bpy.data.collections:
        for o in col.objects:
            o.hide_render = col is not collection
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, -0.0005))
    floor = bpy.context.object
    floor.name = "bake floor"
    clear = [o for o in objects if any(m and MATERIALS.get(m.name.split(" (lod")[0], {}).get("bakeClear") for m in o.data.materials)]
    for o in clear:
        o.hide_render = True
    targets = [o for o in objects if o not in clear]
    bpy.ops.object.select_all(action="DESELECT")
    for o in targets:
        for a in list(o.data.color_attributes):
            o.data.color_attributes.remove(a)
        attr = o.data.color_attributes.new(name="Baked contact", type="FLOAT_COLOR", domain="CORNER")
        o.data.color_attributes.active_color = attr
        o.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]
    scene.render.bake.target = "VERTEX_COLORS"
    bpy.ops.object.bake(type="AO", use_clear=True)
    stats = []
    for o in targets:
        me = o.data
        attr = me.color_attributes.active_color
        sums = [0.0] * len(me.vertices)
        counts = [0] * len(me.vertices)
        for loop, c in zip(me.loops, attr.data):
            sums[loop.vertex_index] += c.color[0]
            counts[loop.vertex_index] += 1
        for a in list(me.color_attributes):
            me.color_attributes.remove(a)
        out = me.color_attributes.new(name="Baked contact", type="BYTE_COLOR", domain="POINT")
        values = []
        for i, c in enumerate(out.data):
            ao = max(0.0, min(1.0, sums[i] / max(1, counts[i])))
            v = round((0.70 + 0.30 * ao) * 32) / 32
            c.color = (v, v, v, 1)
            values.append(v)
        me.color_attributes.active_color = out
        # The exporter's COLOR_0 is the colour attribute marked for rendering.
        me.color_attributes.render_color_index = me.color_attributes.find(out.name)
        stats.append((min(values), max(values)))
    for o in clear:
        o.hide_render = False
    bpy.data.objects.remove(floor, do_unlink=True)
    for col in bpy.data.collections:
        for o in col.objects:
            o.hide_render = False
    return stats


def export(root, path):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_image_format="WEBP",
        export_image_quality=84,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=8,
    )


def triangles(objects):
    total = 0
    for o in objects:
        o.data.calc_loop_triangles()
        total += len(o.data.loop_triangles)
    return total


def bounds_three(objects):
    """World bounds of the meshes in three.js axes (x, Blender z, -Blender y)."""
    lo, hi = [1e9] * 3, [-1e9] * 3
    for o in objects:
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            q = (p.x, p.z, -p.y)
            lo = [min(a, b) for a, b in zip(lo, q)]
            hi = [max(a, b) for a, b in zip(hi, q)]
    return {"min": [round(v, 4) for v in lo], "max": [round(v, 4) for v in hi]}


def to_three(p):
    return [round(p[0], 4), round(p[2], 4), round(-p[1], 4)]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


# ── Review stills ────────────────────────────────────────────────────────────────────────────────


def review(collection, objects, path, direction=(-0.62, -1.0, 0.62)):
    scene = bpy.context.scene
    for col in bpy.data.collections:
        for o in col.objects:
            o.hide_render = col is not collection
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in objects:
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            lo, hi = Vector(map(min, lo, p)), Vector(map(max, hi, p))
    centre, size = (lo + hi) / 2, (hi - lo).length
    cam_data = bpy.data.cameras.new("review camera")
    cam_data.lens = 50
    cam = bpy.data.objects.new("review camera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = centre + Vector(direction).normalized() * size * 1.55
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    sun_data = bpy.data.lights.new("review sun", "SUN")
    sun_data.energy = 3.2
    sun_data.angle = math.radians(6)
    sun = bpy.data.objects.new("review sun", sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(48), 0, math.radians(-38))
    world = scene.world or bpy.data.worlds.new("review world")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.78, 0.78, 0.76, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -0.0005))
    floor = bpy.context.object
    floor_mat = bpy.data.materials.get("review floor") or bpy.data.materials.new("review floor")
    _principled(floor_mat).inputs["Base Color"].default_value = (0.62, 0.6, 0.57, 1)
    floor.data.materials.append(floor_mat)
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1100, 820
    scene.view_settings.view_transform = "AgX"
    scene.render.filepath = str(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    for thing in (cam, sun, floor):
        bpy.data.objects.remove(thing, do_unlink=True)
    for col in bpy.data.collections:
        for o in col.objects:
            o.hide_render = False


# ── Main ─────────────────────────────────────────────────────────────────────────────────────────


def main():
    started = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    index_path = OUT / "index.json"
    previous = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}
    index = {
        "version": 1,
        "axes": "glTF/three.js metres, +y up. An item's origin is its floor-contact centre and its front faces +z at yaw 0, the manifest's actor-facing convention: a furniture anchor's yaw turns an item as an actor's facing turns an avatar.",
        "items": previous.get("items", {}),
    }
    report = json.loads(REVIEW_JSON.read_text(encoding="utf-8")) if REVIEW_JSON.exists() else {"items": {}}
    for item, builder in ITEMS.items():
        if ONLY and item not in ONLY:
            continue
        levels, meta = {}, None
        for lod in LODS:
            parts = Parts(item, lod)
            meta = builder(parts, QUALITY[lod])
            shift = footprint_shift(parts)
            collection = bpy.data.collections.new(f"{item} LOD{lod}")
            scene.collection.children.link(collection)
            root, objects = realize(parts, collection, shift)
            bpy.context.view_layer.update()
            baked = bake(objects, collection) if BAKE else []
            path = OUT / f"{item}-lod{lod}.glb"
            export(root, path)
            levels[lod] = {
                "file": path.name,
                "triangles": triangles(objects),
                "bytes": path.stat().st_size,
                "bounds": bounds_three(objects),
                "shift": [round(v, 4) for v in shift],
                "sha256": sha256(path),
                "baked": [round(min(a for a, _ in baked), 3), round(max(b for _, b in baked), 3)] if baked else None,
            }
            if REVIEW:
                review(collection, objects, REVIEW_DIR / f"{item}-lod{lod}.png")
            print(f"FURNITURE {item} lod{lod}: {levels[lod]['triangles']} triangles, {levels[lod]['bytes']} bytes")
        shift = Vector(levels[0]["shift"])
        entry = {
            "label": meta["label"],
            "lods": [
                {"file": levels[1]["file"], "triangles": levels[1]["triangles"], "bytes": levels[1]["bytes"]},
                {"file": levels[0]["file"], "triangles": levels[0]["triangles"], "bytes": levels[0]["bytes"], "near": meta["near"], "fullscreen": True},
            ],
            "bounds": levels[0]["bounds"],
            "origin": "floor-center",
            "front": "+z",
        }
        if "seatHeight" in meta:
            entry["seatHeight"] = meta["seatHeight"]
        if "seat" in meta:
            entry["seat"] = to_three(Vector(meta["seat"]) + shift)
        for key in ("grip", "pivots", "variants", "emitters", "glow"):
            if key in meta:
                entry[key] = meta[key]
        entry["provenance"] = meta["provenance"]
        index["items"][item] = entry
        report["items"][item] = {"levels": {str(k): v for k, v in levels.items()}}
    index["items"] = dict(sorted(index["items"].items()))
    index_path.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8", newline="\n")
    report["blender"] = bpy.app.version_string
    report["built"] = time.strftime("%Y-%m-%d")
    REVIEW_JSON.parent.mkdir(parents=True, exist_ok=True)
    REVIEW_JSON.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
    if not ONLY or option("save"):
        bpy.context.preferences.filepaths.save_version = 0
        SOURCE.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
    print(f"FURNITURE done in {time.time() - started:.1f} s")


main()
