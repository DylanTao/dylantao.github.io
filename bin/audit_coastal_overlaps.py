"""Rank mesh interpenetration and coplanar z-fighting across Sirui's built coastal home.

Run with Blender against the native source; the delivered furniture is placed at its
manifest anchors exactly as ``furniture.mjs`` places it:

    blender --background -t 8 --python-exit-code 1 --python bin/audit_coastal_overlaps.py -- \
        [--source=artwork/coastal-home/coastal-home.blend] [--furniture=1] \
        [--out=.jekyll-cache/overlap-audit/overlap-audit.json]

Two defect families are measured on world-space triangles:

* Interpenetration. Every pair of meshes whose bounds meet is tested with
  ``BVHTree.overlap``. Each crossing triangle pair contributes its intersection segment.
  Segments are clustered into spatial *sites* (one contact or defect each, even inside a
  room batch that merges many parts of one material). At each site, points sampled on the
  crossing triangles are tested against the other mesh with a winding-number ray test
  (closed meshes only); the deepest inside point gives the site's penetration depth.
* Coplanar overlap (z-fighting). Faces whose planes agree within 1 mm and 1 degree and
  whose areas overlap, on different objects or materials. Same-facing pairs flicker;
  opposite-facing pairs between closed solids are hidden interior contact faces.

Intentional contacts are classified by the explicit, bounded rules in ``CONTACT_RULES``:
each names its geometric test, its reason and its depth bound, so a contact that grows past
its bound is ranked as an offender again. Only geometry that is never drawn with the house
(shadow-only copies, furniture placeholders replaced by their streamed items) and mutually
exclusive bedding variants are excluded before measurement, and the report lists them.
"""
import hashlib
import json
import math
import sys
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}


def _path(key, default):
    p = Path(ARGS.get(key, default))
    return p if p.is_absolute() else ROOT / p


SOURCE = _path("source", "artwork/coastal-home/coastal-home.blend")
MANIFEST = _path("manifest", "assets/models/home/manifest.json")
OUT = _path("out", ".jekyll-cache/overlap-audit/overlap-audit.json")
FURNITURE = ARGS.get("furniture", "1") != "0"
DELIVERED = ARGS.get("delivered", "0") == "1"  # audit the decoded delivered GLBs instead of the source
ONLY = ARGS.get("only")  # optional comma list of name prefixes, for quick reruns
PLANE_TOLERANCE = 0.001  # coplanar within 1 mm
ANGLE_TOLERANCE = math.radians(1.0)
MIN_COPLANAR_AREA = 1e-4  # 1 cm2 per pair before reporting
MIN_SEAM = 0.004  # metres of intersection curve before a site is sampled for depth
SITE_CELL = 0.06  # metres: seams closer than about two cells belong to one site
SAMPLE_CAP = 160
GRAZING_DEGREES = 20.0
GRAZING_SHARE = 0.5  # a site whose seam is mostly grazing is a visible patchy overlap

CONTACT_RULES = [
    {"id": "shallow-seam", "maxDepth": 0.004,
     "test": "deepest mutual penetration at the site <= 4 mm",
     "reason": "Touching solids within compression and bevel tolerance; the seam reads as a contact at every supported camera distance."},
    {"id": "water-in-basin", "maxDepth": 0.6,
     "test": "one side is a water surface",
     "reason": "A water surface meets its own basin walls, steps and rim at the waterline."},
    {"id": "planting-root", "maxDepth": 0.045, "maxHeightFraction": 0.2,
     "test": "plant geometry inside rock, ground, soil, a planter or a floor, no deeper than max(45 mm, 20% of the plant part's height), every inside sample in the part's lowest 30% (or 25 cm)",
     "reason": "Stems, trunks and leaf bases rooted in soil, mulch, rock or a planter; on a slope the uphill side of a shrub or trunk sits deeper (the agave contract embeds rosettes 22 mm)."},
    {"id": "terrain-landform", "maxDepth": 1.0,
     "test": "both meshes are terrain (coast/rock/soil)",
     "reason": "Sand, sandstone, haul-out rocks and the mainland meet where one landform emerges from another; there is no inhabited surface between them."},
    {"id": "support-rest", "maxDepth": 0.025,
     "test": ">= 60% of the host's crossed faces face up; every inside sample within 6 cm of the resting part's lowest point",
     "reason": "An item resting on a floor, tread, shelf, counter or ground: only its base sits in the upward support, hiding compression gaps."},
    {"id": "one-sided-embed", "maxDepth": 0.12, "maxHiddenFraction": 0.25,
     "test": "the host's crossed faces all face one way (normal coherence >= 0.8) and at most 25% of the penetrating part's extent along that normal is hidden",
     "reason": "A fixture, cabinet, frame, hood, shelf or panel set into the wall, ceiling or block it is fixed to: the hidden end never emerges elsewhere, so the visible result is a flush contact."},
    {"id": "structural-joint", "maxDepth": 0.12,
     "test": "the penetrating part is slender (<= 9 cm in two axes and >= 3x longer)",
     "reason": "A post, baluster, column, leg, rung or rod seated into the rail, tread, slab or frame it joins; its end is hidden inside that member."},
]
RULE = {r["id"]: r for r in CONTACT_RULES}
EXCLUSIONS = [
    {"id": "never-drawn", "reason": "Shadow-only copies and render-hidden geometry are never drawn in the beauty pass."},
    {"id": "furniture-placeholder", "reason": "A collision proxy hidden as soon as its streamed furniture item is placed; the item itself is audited at its anchor."},
    {"id": "bedding-variants", "reason": "Only one of the six made/fitted bedding variants is shown at a time; variants are audited against everything else."},
    {"id": "foliage-overlap", "reason": "Soft leaf, grass and petal cards interleave like real foliage; plant-to-plant pairs are counted, not ranked."},
]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def log(*parts):
    print("[overlap]", *parts, flush=True)


# --------------------------------------------------------------------------- collection

ROOMS = ("study", "sleep", "kitchen", "lounge", "gym", "onsen", "bath-living", "bath-bedroom", "library-upper", "library", "records")
PLANT_WORDS = (" leaf", "_leaf", "foliage", "fronds", "needles", "flora", "botanical leaf", "grass", "petal", "flowers", "stems",
               "iceplant", "sagebrush", "_sage", "wild_oats", "buckwheat", "yucca", "prickly_pear", "lemonade", "daisy", "agave")


def category(name, props):
    n = name.lower()
    if props.get("furnitureItem"):
        return "furniture"
    if n.startswith("coast_"):
        return "coast"
    if n in ("core_infinity_water", "onsen_water") or n.endswith(" water"):
        return "water"
    if n.startswith("core_retreat_roof_planting") or any(w in n for w in PLANT_WORDS):
        if "soil" in n or "mulch" in n:
            return "soil"
        return "plant"
    if "mineral soil" in n or "mulch" in n:
        return "soil"
    if "sandstone" in n or (props.get("caveRoof") and "ceiling" not in n) or "liftaway_roof" in n:
        return "rock"
    if "glass" in n or "glazing" in n or "mirror" in n:
        return "glass"
    if n.startswith(ROOMS):
        return "room"
    return "shell"


def room_of(name):
    for prefix in ROOMS:
        if name.startswith(prefix):
            return prefix
    if name.startswith("furniture:"):
        return "furniture"
    return "core"


def mesh_arrays(obj):
    me = obj.data
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    m = np.array(obj.matrix_world)
    co = co @ m[:3, :3].T + m[:3, 3]
    tri = np.empty(n * 3, dtype=np.int64)
    me.loop_triangles.foreach_get("vertices", tri)
    tri = tri.reshape(-1, 3)
    mi = np.empty(n, dtype=np.int64)
    me.loop_triangles.foreach_get("material_index", mi)
    mats = [m.name if m else "" for m in me.materials] or [""]
    mi = np.clip(mi, 0, len(mats) - 1)
    edges = np.sort(np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]]), axis=1)
    boundary = 0
    if len(edges):
        _, counts = np.unique(edges, axis=0, return_counts=True)
        boundary = int((counts == 1).sum())
    return co, tri, mi, mats, boundary


def import_furniture(scene, config):
    """Place every streamed item as furniture.mjs does: anchor position, yaw about +Y (Blender +Z)."""
    index = json.loads((ROOT / "assets/models/home/furniture/index.json").read_text(encoding="utf-8"))
    placed = []
    for anchor in config.get("furniture", []):
        item = index["items"].get(anchor["item"])
        if not item:
            continue
        lod = max(item["lods"], key=lambda q: q.get("triangles", 0))
        path = ROOT / "assets/models/home/furniture" / lod["file"]
        before = set(scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(path))
        new = [o for o in scene.objects if o not in before]
        root = bpy.data.objects.new(f"furniture:{anchor['id']}", None)
        scene.collection.objects.link(root)
        for o in new:
            if o.parent is None:
                o.parent = root
        x, y, z = anchor["position"]
        root.location = (x, -z, y)
        root.rotation_euler = (0, 0, anchor.get("yaw", 0) or 0)
        bpy.context.view_layer.update()
        for o in new:
            if o.type == "MESH":
                o["furnitureItem"] = anchor["item"]
                o["furnitureAnchor"] = anchor["id"]
                o.name = f"furniture:{anchor['id']}/{o.name}"
        placed.append({"anchor": anchor["id"], "item": anchor["item"], "file": lod["file"], "sha256": sha256(path),
                       "meshes": sum(1 for o in new if o.type == "MESH")})
    return placed


def islands(tri, nv):
    """Connected part label per triangle (shared vertex indices), by min-label propagation."""
    lab = np.arange(nv)
    for _ in range(200):
        t = lab[tri].min(1)
        new = lab.copy()
        for k in range(3):
            np.minimum.at(new, tri[:, k], t)
        new = new[new]
        if np.array_equal(new, lab):
            break
        lab = new
    part = lab[tri[:, 0]]
    _, part = np.unique(part, return_inverse=True)
    return part.reshape(-1)


def collect(scene):
    meshes, skipped = [], []
    for obj in scene.objects:
        if obj.type != "MESH":
            continue
        if ONLY and not obj.name.startswith(tuple(ONLY.split(","))):
            continue
        props = {k: obj[k] for k in obj.keys() if isinstance(obj[k], (int, float, str, bool))}
        if obj.hide_render or obj.get("shadowOnly"):
            skipped.append({"mesh": obj.name, "exclusion": "never-drawn"})
            continue
        if FURNITURE and (obj.get("furniturePlaceholder") or "_placeholder_" in obj.name):
            skipped.append({"mesh": obj.name, "exclusion": "furniture-placeholder"})
            continue
        if not obj.data.polygons:
            continue
        co, tri, mi, mats, boundary = mesh_arrays(obj)
        if not len(tri):
            continue
        p = co[tri]
        cross = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
        area2 = np.linalg.norm(cross, axis=1)
        normal = np.zeros_like(cross)
        good = area2 > 1e-14
        normal[good] = cross[good] / area2[good, None]
        part = islands(tri, len(co))
        count = int(part.max()) + 1
        plo = np.full((count, 3), np.inf)
        phi = np.full((count, 3), -np.inf)
        for k in range(3):
            np.minimum.at(plo, part, p[:, k])
            np.maximum.at(phi, part, p[:, k])
        meshes.append({
            "part": part, "partLo": plo, "partHi": phi,
            "name": obj.name, "props": props, "category": category(obj.name, props), "room": room_of(obj.name),
            "co": co, "tri": tri, "P": p, "mat": mi, "mats": mats, "closed": boundary == 0, "boundaryEdges": boundary,
            "normal": normal, "area": area2 / 2, "lo": co.min(0), "hi": co.max(0), "bedding": obj.get("bedding"),
        })
    return meshes, skipped


# --------------------------------------------------------------------------- z-fighting


def _clip_area(a, b):
    """Overlap area of two coplanar triangles in 2D (Sutherland-Hodgman)."""
    poly = list(a)
    if (b[1][0] - b[0][0]) * (b[2][1] - b[0][1]) - (b[1][1] - b[0][1]) * (b[2][0] - b[0][0]) < 0:
        b = b[::-1]
    for i in range(3):
        if not poly:
            return 0.0
        ax, ay = b[i]
        bx, by = b[(i + 1) % 3]
        ex, ey = bx - ax, by - ay
        out = []
        n = len(poly)
        for j in range(n):
            px, py = poly[j]
            qx, qy = poly[(j + 1) % n]
            sp = ex * (py - ay) - ey * (px - ax)
            sq = ex * (qy - ay) - ey * (qx - ax)
            if sp >= 0:
                out.append((px, py))
            if (sp >= 0) != (sq >= 0):
                t = sp / (sp - sq)
                out.append((px + (qx - px) * t, py + (qy - py) * t))
        poly = out
    if len(poly) < 3:
        return 0.0
    s = 0.0
    for j in range(len(poly)):
        x0, y0 = poly[j]
        x1, y1 = poly[(j + 1) % len(poly)]
        s += x0 * y1 - x1 * y0
    return abs(s) / 2


def coplanar_overlaps(meshes, trees):
    """Same-plane overlaps between different meshes or materials.

    Plane buckets (normal within ~2.4 degree cells, offset within 4 mm cells, with border
    duplication) only decide which triangles share a plane with another mesh or material.
    Partner triangles then come from that mesh's BVH within 1 mm of four points on the
    triangle, and every candidate is checked exactly: normals within 1 degree, all partner
    vertices within 1 mm of the plane, and a positive clipped overlap area.
    """
    keep = [m["area"] > 5e-7 for m in meshes]
    owner = np.concatenate([np.full(int(k.sum()), i) for i, k in enumerate(keep)])
    local = np.concatenate([np.nonzero(k)[0] for k in keep])
    P = np.concatenate([m["P"][k] for m, k in zip(meshes, keep)])
    N = np.concatenate([m["normal"][k] for m, k in zip(meshes, keep)])
    MAT = np.concatenate([m["mat"][k] for m, k in zip(meshes, keep)])
    D = np.einsum("ij,ij->i", N, P[:, 0])
    big = np.argmax(np.abs(N), axis=1)
    sign = np.sign(N[np.arange(len(N)), big])
    canon = N * sign[:, None]
    coff = D * sign
    qn, qd = 1 / 24.0, 0.004
    kn = np.floor(canon / qn).astype(np.int64)
    kd = np.floor(coff / qd).astype(np.int64)
    rows = [np.arange(len(N))]
    keys = [np.column_stack([kn, kd])]
    frac = coff / qd - kd
    for side, mask in ((-1, frac < PLANE_TOLERANCE / qd), (1, frac > 1 - PLANE_TOLERANCE / qd)):
        sel = np.nonzero(mask)[0]
        rows.append(sel)
        keys.append(np.column_stack([kn[sel], kd[sel] + side]))
    rows = np.concatenate(rows)
    keys = np.concatenate(keys)
    extra_r, extra_k = [], []
    for axis in range(3):
        f = canon[rows, axis] / qn - keys[:, axis]
        for side, mask in ((-1, f < 0.45), (1, f > 0.55)):
            sel = np.nonzero(mask)[0]
            k2 = keys[sel].copy()
            k2[:, axis] += side
            extra_r.append(rows[sel])
            extra_k.append(k2)
    rows = np.concatenate([rows] + extra_r)
    keys = np.concatenate([keys] + extra_k)
    order = np.lexsort(keys.T[::-1])
    keys, rows = keys[order], rows[order]
    gid = np.zeros(len(rows), dtype=np.int64)
    gid[1:] = np.any(np.diff(keys, axis=0) != 0, axis=1)
    gid = np.cumsum(gid)
    combo = owner[rows] * 4096 + MAT[rows]
    # Only groups with at least two distinct (mesh, material) combinations can fight.
    pair_gc = np.unique(np.column_stack([gid, combo]), axis=0)
    gcount = np.bincount(pair_gc[:, 0], minlength=int(gid.max()) + 1)
    good = gcount[gid] >= 2
    rows_g, gid_g = rows[good], gid[good]
    # (triangle, candidate mesh): every mesh present in one of the triangle's plane groups.
    pair_go = np.unique(np.column_stack([gid_g, owner[rows_g]]), axis=0)
    starts = np.searchsorted(pair_go[:, 0], gid_g, side="left")
    stops = np.searchsorted(pair_go[:, 0], gid_g, side="right")
    lens = stops - starts
    rep_rows = np.repeat(rows_g, lens)
    if len(lens):
        offs = np.repeat(starts - np.concatenate([[0], np.cumsum(lens)[:-1]]), lens) + np.arange(int(lens.sum()))
        cand_owner = pair_go[offs, 1]
    else:
        cand_owner = np.zeros(0, dtype=np.int64)
    qp = np.unique(np.column_stack([rep_rows, cand_owner]), axis=0) if len(rep_rows) else np.zeros((0, 2), dtype=np.int64)
    if len(qp):
        mlo = np.array([m["lo"] for m in meshes]) - PLANE_TOLERANCE
        mhi = np.array([m["hi"] for m in meshes]) + PLANE_TOLERANCE
        tlo = P[qp[:, 0]].min(1)
        thi = P[qp[:, 0]].max(1)
        qp = qp[np.all((tlo <= mhi[qp[:, 1]]) & (thi >= mlo[qp[:, 1]]), axis=1)]
    log(f"coplanar prefilter: {len(qp)} triangle/mesh queries from {int(good.sum())} bucketed rows")
    bary = np.array([[1 / 3, 1 / 3, 1 / 3], [0.8, 0.1, 0.1], [0.1, 0.8, 0.1], [0.1, 0.1, 0.8]])
    cos_tol = math.cos(ANGLE_TOLERANCE)
    found = set()
    for r, o in qp:
        tree = trees[o]
        hits = set()
        for q in bary @ P[r]:
            for _, _, index, _ in tree.find_nearest_range(Vector(q), PLANE_TOLERANCE):
                hits.add(index)
        if not hits:
            continue
        m = meshes[o]
        for t in hits:
            if o == owner[r] and (t == local[r] or m["mat"][t] == MAT[r]):
                continue
            if abs(float(m["normal"][t] @ N[r])) < cos_tol:
                continue
            if np.abs((m["P"][t] - P[r][0]) @ N[r]).max() > PLANE_TOLERANCE:
                continue
            bo, bb = meshes[owner[r]]["bedding"], m["bedding"]
            if bo and bb and bo != bb:
                continue
            a_key = (int(owner[r]), int(local[r]))
            b_key = (int(o), int(t))
            found.add((a_key, b_key) if a_key < b_key else (b_key, a_key))
    pairs = {}
    for (oi, ti), (oj, tj) in found:
        a, b = meshes[oi], meshes[oj]
        pa, pb, na = a["P"][ti], b["P"][tj], a["normal"][ti]
        u = pa[1] - pa[0]
        u = u / np.linalg.norm(u)
        v = np.cross(na, u)
        a2 = [((q - pa[0]) @ u, (q - pa[0]) @ v) for q in pa]
        b2 = [((q - pa[0]) @ u, (q - pa[0]) @ v) for q in pb]
        area = _clip_area(a2, b2)
        if area <= 1e-7:
            continue
        ma = a["mats"][a["mat"][ti]]
        mb = b["mats"][b["mat"][tj]]
        facing = "same" if float(b["normal"][tj] @ na) > 0 else "opposite"
        k2 = (oi, ma, oj, mb, facing) if (oi, ma) <= (oj, mb) else (oj, mb, oi, ma, facing)
        c = (pa.mean(0) + pb.mean(0)) / 2
        rec = pairs.setdefault(k2, {"area": 0.0, "triangles": 0, "maxGap": 0.0, "at": None, "largest": 0.0, "lo": c.copy(), "hi": c.copy(), "samples": []})
        rec["samples"].append((area, c, na.copy()))
        rec["area"] += area
        rec["triangles"] += 1
        rec["maxGap"] = max(rec["maxGap"], float(np.abs((pb - pa[0]) @ na).max()))
        rec["lo"] = np.minimum(rec["lo"], c)
        rec["hi"] = np.maximum(rec["hi"], c)
        if area > rec["largest"]:
            rec["largest"] = area
            rec["at"] = [round(float(q), 3) for q in c]
            rec["normal"] = [round(float(q), 3) for q in na]
    out = []
    for (oi, ma, oj, mb, facing), rec in pairs.items():
        if rec["area"] < MIN_COPLANAR_AREA:
            continue
        a, b = meshes[oi], meshes[oj]
        visible_area = rec["area"]
        if facing == "opposite":
            verdict = "hidden-interior-contact" if a["closed"] and b["closed"] else "back-to-back-open"
        else:
            visible_area = rec["area"] * exposed_share(meshes, trees, rec["samples"], {oi, oj})
            verdict = "z-fighting" if visible_area >= MIN_COPLANAR_AREA else "buried-coplanar"
        out.append({"a": a["name"], "materialA": ma, "b": b["name"], "materialB": mb, "facing": facing,
                    "areaM2": round(rec["area"], 6), "visibleAreaM2": round(visible_area, 6),
                    "trianglePairs": rec["triangles"], "maxPlaneGapMm": round(rec["maxGap"] * 1000, 3),
                    "at": rec["at"], "normal": rec.get("normal"),
                    "bounds": [[round(float(q), 3) for q in rec["lo"]], [round(float(q), 3) for q in rec["hi"]]],
                    "sameObject": oi == oj, "categories": [a["category"], b["category"]], "verdict": verdict})
    out.sort(key=lambda r: (r["verdict"] != "z-fighting", -r["visibleAreaM2"]))
    return out, len(found)


BURY_OFFSET = 0.003
SEALED_GAP = 0.025
_BOUNDS = {}


def buried(meshes, trees, point, skip, normal=None):
    """True when no camera can see ``point``: it lies inside a closed solid other than ``skip``,
    or (given the face ``normal``) another surface seals it within SEALED_GAP along that normal,
    like the bottom of a floor tile a centimetre above its slab."""
    key = id(meshes)
    if key not in _BOUNDS:
        _BOUNDS.clear()
        _BOUNDS[key] = (np.array([m["lo"] for m in meshes]) - SEALED_GAP, np.array([m["hi"] for m in meshes]) + SEALED_GAP)
    lo, hi = _BOUNDS[key]
    near = np.nonzero(np.all((point >= lo) & (point <= hi), axis=1))[0]
    origin = Vector(point)
    direction = Vector(normal) if normal is not None else None
    for k in near:
        if k in skip:
            continue
        if direction is not None and trees[k].ray_cast(origin, direction, SEALED_GAP)[0] is not None:
            return True
        m = meshes[k]
        if m["closed"] and np.all(point >= m["lo"]) and np.all(point <= m["hi"]) and is_inside(trees[k], point):
            return True
    return False


def exposed_share(meshes, trees, samples, skip, cap=24):
    """Area share of a same-facing overlap whose outward side is open air."""
    samples = sorted(samples, key=lambda q: -q[0])[:cap]
    total = sum(q[0] for q in samples) or 1.0
    open_area = 0.0
    for area, c, n in samples:
        if not buried(meshes, trees, c + n * BURY_OFFSET, skip, n):
            open_area += area
    return open_area / total


# --------------------------------------------------------------------------- interpenetration

DIRS = [Vector((0.5736, 0.5774, 0.5812)).normalized(), Vector((-0.6, 0.31, 0.737)).normalized()]


def winding(tree, p, direction):
    """Exits minus entries along a ray; > 0 inside an outward-oriented solid (robust to overlapping parts)."""
    total = 0
    origin = Vector(p)
    for _ in range(96):
        hit, normal, _, _ = tree.ray_cast(origin, direction)
        if hit is None:
            break
        total += 1 if normal.dot(direction) > 0 else -1
        origin = hit + direction * 2e-5
    return total


def is_inside(tree, p):
    return winding(tree, p, DIRS[0]) > 0 and winding(tree, p, DIRS[1]) > 0


def segments(A, B):
    """Vectorised triangle-triangle intersection segments for k pairs (k,3,3 arrays)."""
    na = np.cross(A[:, 1] - A[:, 0], A[:, 2] - A[:, 0])
    nb = np.cross(B[:, 1] - B[:, 0], B[:, 2] - B[:, 0])
    la = np.linalg.norm(na, axis=1)
    lb = np.linalg.norm(nb, axis=1)
    ok = (la > 1e-14) & (lb > 1e-14)
    na = na / np.maximum(la, 1e-30)[:, None]
    nb = nb / np.maximum(lb, 1e-30)[:, None]
    dA = np.einsum("kij,kj->ki", A - B[:, :1], nb)
    dB = np.einsum("kij,kj->ki", B - A[:, :1], na)
    coplanar = ok & (np.abs(np.einsum("kj,kj->k", na, nb)) > 0.99985) & (np.abs(dB).max(1) < PLANE_TOLERANCE)
    pts, valid = [], []
    for T, d, O in ((A, dA, B), (B, dB, A)):
        v0 = O[:, 1] - O[:, 0]
        v1 = O[:, 2] - O[:, 0]
        d00 = np.einsum("kj,kj->k", v0, v0)
        d01 = np.einsum("kj,kj->k", v0, v1)
        d11 = np.einsum("kj,kj->k", v1, v1)
        den = d00 * d11 - d01 * d01
        for i, j in ((0, 1), (1, 2), (2, 0)):
            cross = ((d[:, i] > 0) != (d[:, j] > 0)) & (np.abs(d[:, i] - d[:, j]) > 1e-15)
            t = np.where(cross, d[:, i] / np.where(cross, d[:, i] - d[:, j], 1), 0)
            q = T[:, i] + (T[:, j] - T[:, i]) * t[:, None]
            v2 = q - O[:, 0]
            d20 = np.einsum("kj,kj->k", v2, v0)
            d21 = np.einsum("kj,kj->k", v2, v1)
            with np.errstate(divide="ignore", invalid="ignore"):
                b1 = (d11 * d20 - d01 * d21) / den
                b2 = (d00 * d21 - d01 * d20) / den
            inside = cross & (den > 0) & (b1 >= -1e-9) & (b2 >= -1e-9) & (b1 + b2 <= 1 + 1e-9)
            pts.append(q)
            valid.append(inside)
    pts = np.stack(pts, axis=1)  # k,6,3
    valid = np.stack(valid, axis=1) & ok[:, None] & ~coplanar[:, None]
    dist = np.linalg.norm(pts[:, :, None] - pts[:, None], axis=3)
    mask = valid[:, :, None] & valid[:, None, :]
    dist = np.where(mask, dist, -1)
    flat = dist.reshape(len(A), -1)
    best = flat.argmax(1)
    length = flat[np.arange(len(A)), best]
    i, j = np.unravel_index(best, (6, 6))
    s0 = pts[np.arange(len(A)), i]
    s1 = pts[np.arange(len(A)), j]
    length = np.maximum(length, 0)
    return s0, s1, length, coplanar


def cluster_sites(mid):
    """Union seams whose midpoints fall in adjacent SITE_CELL cells."""
    cells = np.floor(mid / SITE_CELL).astype(np.int64)
    uniq, inv = np.unique(cells, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    lookup = {tuple(c): k for k, c in enumerate(uniq)}
    parent = list(range(len(uniq)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for k, c in enumerate(uniq):
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    o = lookup.get((c[0] + dx, c[1] + dy, c[2] + dz))
                    if o is not None:
                        ra, rb = find(k), find(o)
                        if ra != rb:
                            parent[ra] = rb
    roots = np.array([find(inv[s]) for s in range(len(inv))])
    return roots


def sample_depth(target, tree, source, tris, rng, cap=SAMPLE_CAP):
    if not target["closed"] or not len(tris):
        return None
    p = source["P"][tris]
    pts = np.concatenate([p.reshape(-1, 3), p.mean(1), (p[:, 0] + p[:, 1]) / 2, (p[:, 1] + p[:, 2]) / 2, (p[:, 2] + p[:, 0]) / 2])
    pts = np.unique(np.round(pts, 5), axis=0)
    if len(pts) > cap:
        pts = pts[rng.choice(len(pts), cap, replace=False)]
    best, best_at, count, zs = 0.0, None, 0, []
    for q in pts:
        v = Vector(q)
        loc, normal, _, dist = tree.find_nearest(v)
        if loc is None or dist < 1e-5:
            continue
        if (v - loc).dot(normal) > 0 and dist > 0.002:
            continue  # clearly on the outside of the nearest face
        if not is_inside(tree, q):
            continue
        count += 1
        zs.append(float(q[2]))
        if dist > best:
            best, best_at = dist, q
    if not count:
        return {"depth": 0.0, "inside": 0, "samples": int(len(pts))}
    return {"depth": round(float(best), 4), "at": [round(float(c), 3) for c in best_at], "inside": count,
            "samples": int(len(pts)), "insideZ": [round(min(zs), 3), round(max(zs), 3)]}


def orientation(normals, weights):
    if not len(normals):
        return None
    nz = normals[:, 2]
    total = float(weights.sum()) or 1.0
    mean = (normals * weights[:, None]).sum(0) / total
    return {"up": round(float(weights[nz > 0.7].sum() / total), 3), "down": round(float(weights[nz < -0.7].sum() / total), 3),
            "vertical": round(float(weights[np.abs(nz) < 0.3].sum() / total), 3),
            "coherence": round(float(np.linalg.norm(mean)), 3), "mean": [round(float(v), 3) for v in mean]}


def build_trees(meshes):
    return [BVHTree.FromPolygons([Vector(q) for q in m["co"]], m["tri"].tolist(), all_triangles=True) for m in meshes]


def interpenetration(meshes, trees):
    lo = np.array([m["lo"] for m in meshes])
    hi = np.array([m["hi"] for m in meshes])
    rng = np.random.default_rng(7)
    sites, foliage = [], {"pairs": 0, "seamM": 0.0}
    checked = crossing_pairs = 0
    t0 = time.time()
    for i in range(len(meshes)):
        overlap = np.nonzero(np.all((lo[i] <= hi + 1e-3) & (hi[i] >= lo - 1e-3), axis=1))[0]
        for j in overlap[overlap > i]:
            a, b = meshes[i], meshes[j]
            if a["bedding"] and b["bedding"] and a["bedding"] != b["bedding"]:
                continue
            pairs = trees[i].overlap(trees[j])
            checked += 1
            if not pairs:
                continue
            ij = np.array(pairs, dtype=np.int64)
            s0, s1, length, coplanar = segments(a["P"][ij[:, 0]], b["P"][ij[:, 1]])
            keep = length > 1e-6
            if not keep.any():
                continue
            crossing_pairs += 1
            if a["category"] == "plant" and b["category"] == "plant":
                foliage["pairs"] += 1
                foliage["seamM"] += float(length.sum())
                continue
            ij, s0, s1, length = ij[keep], s0[keep], s1[keep], length[keep]
            # Same-facing, nearly parallel crossings (within GRAZING_DEGREES) leave a ragged,
            # patchy seam across a visible face: one surface shows through the other.
            dots = np.einsum("ij,ij->i", a["normal"][ij[:, 0]], b["normal"][ij[:, 1]])
            grazing = dots >= math.cos(math.radians(GRAZING_DEGREES))
            roots = cluster_sites((s0 + s1) / 2)
            for root in np.unique(roots):
                sel = roots == root
                seam = float(length[sel].sum())
                lo_s = np.minimum(s0[sel], s1[sel]).min(0)
                hi_s = np.maximum(s0[sel], s1[sel]).max(0)
                ta = np.unique(ij[sel, 0])
                tb = np.unique(ij[sel, 1])
                rec = {"a": a["name"], "b": b["name"], "categoryA": a["category"], "categoryB": b["category"],
                       "roomA": a["room"], "roomB": b["room"], "closedA": a["closed"], "closedB": b["closed"],
                       "seamM": round(seam, 4), "crossings": int(sel.sum()),
                       "grazingSeamM": round(float(length[sel & grazing].sum()), 4),
                       "center": [round(float(v), 3) for v in (lo_s + hi_s) / 2],
                       "bounds": [[round(float(v), 3) for v in lo_s], [round(float(v), 3) for v in hi_s]],
                       "crossedA": orientation(a["normal"][ij[sel, 0]], length[sel]),
                       "crossedB": orientation(b["normal"][ij[sel, 1]], length[sel])}
                for side, m, t in (("A", a, ta), ("B", b, tb)):
                    ids = np.unique(m["part"][t])
                    plo = m["partLo"][ids].min(0)
                    phi = m["partHi"][ids].max(0)
                    rec["part" + side] = [[round(float(v), 3) for v in plo], [round(float(v), 3) for v in phi]]
                    rec["parts" + side] = int(len(ids))
                gsel = sel & grazing
                gseam = float(length[gsel].sum())
                terrain_only = {a["category"], b["category"]} <= {"plant", "rock", "coast", "soil"}
                if gsel.any() and gseam > 0.002 and gseam >= GRAZING_SHARE * seam and not terrain_only:
                    mids = ((s0[gsel] + s1[gsel]) / 2)
                    nrm = a["normal"][ij[gsel, 0]] + b["normal"][ij[gsel, 1]]
                    nrm /= np.maximum(np.linalg.norm(nrm, axis=1), 1e-12)[:, None]
                    order = np.argsort(-length[gsel])[:12]
                    hidden = sum(buried(meshes, trees, mids[q] + nrm[q] * BURY_OFFSET, {i, j}, nrm[q]) for q in order)
                    rec["grazingBuried"] = bool(hidden >= 0.75 * len(order))
                if seam >= MIN_SEAM:
                    cap = 32 if "plant" in (a["category"], b["category"]) else SAMPLE_CAP
                    rec["aInsideB"] = sample_depth(b, trees[j], a, ta, rng, cap)
                    rec["bInsideA"] = sample_depth(a, trees[i], b, tb, rng, cap)
                sites.append(rec)
        if i % 25 == 0:
            log(f"mesh {i}/{len(meshes)} pairs {checked} crossing {crossing_pairs} sites {len(sites)} {time.time() - t0:.0f}s")
    return sites, checked, crossing_pairs, foliage


# --------------------------------------------------------------------------- classification

SUPPORT_HOSTS = ("rock", "coast", "shell", "room", "soil", "furniture")


def classify(rec):
    da = (rec.get("aInsideB") or {}).get("depth", 0.0) or 0.0
    db = (rec.get("bInsideA") or {}).get("depth", 0.0) or 0.0
    depth = max(da, db)
    rec["depth"] = round(depth, 4)
    pen, host = ("A", "B") if da >= db else ("B", "A")
    rec["penetrating"] = rec["a" if pen == "A" else "b"]
    crossed = rec.get("crossed" + host) or {}
    inside = rec.get(("a" if pen == "A" else "b") + "Inside" + host) or {}
    part = rec["part" + pen]
    extent = np.array(part[1]) - np.array(part[0])
    z = inside.get("insideZ")
    mean = np.array(crossed.get("mean") or [0, 0, 0])
    along = float(np.abs(extent) @ np.abs(mean) / max(np.linalg.norm(mean), 1e-9)) if np.linalg.norm(mean) > 0 else 0.0
    rec["hiddenFraction"] = round(depth / along, 3) if along > 1e-6 else None
    cats = {rec["categoryA"], rec["categoryB"]}
    rule = None
    grazing = rec.get("grazingSeamM", 0) >= GRAZING_SHARE * rec["seamM"] and rec.get("grazingSeamM", 0) > 0.002
    rec["grazing"] = bool(grazing)
    if grazing and rec.get("grazingBuried"):
        grazing = False
        rec["grazing"] = False
        rec["grazingHidden"] = True
    if grazing and "water" not in cats and not cats <= {"plant", "rock", "coast", "soil"} and depth > RULE["shallow-seam"]["maxDepth"] / 4:
        # Never a contact: one visible face shows through the other along a ragged seam.
        rec["contactRule"] = None
        rec["severity"] = round(10 * rec["grazingSeamM"] * (1 + 100 * depth), 3)
        rec["openPair"] = False
        return rec
    if "water" in cats and depth <= RULE["water-in-basin"]["maxDepth"]:
        rule = "water-in-basin"
    elif depth <= RULE["shallow-seam"]["maxDepth"]:
        rule = "shallow-seam"
    elif cats <= {"rock", "coast", "soil"} and depth <= RULE["terrain-landform"]["maxDepth"]:
        rule = "terrain-landform"
    elif rec["category" + pen] == "plant" and rec["category" + host] in SUPPORT_HOSTS             and depth <= max(RULE["planting-root"]["maxDepth"], RULE["planting-root"]["maxHeightFraction"] * extent[2])             and (z is None or z[1] - part[0][2] <= max(0.25, 0.3 * extent[2])):
        rule = "planting-root"
    elif crossed.get("up", 0) >= 0.6 and depth <= RULE["support-rest"]["maxDepth"] and (z is None or z[1] - part[0][2] <= 0.06):
        rule = "support-rest"
    elif crossed.get("coherence", 0) >= 0.8 and depth <= RULE["one-sided-embed"]["maxDepth"]             and rec["hiddenFraction"] is not None and rec["hiddenFraction"] <= RULE["one-sided-embed"]["maxHiddenFraction"]:
        rule = "one-sided-embed"
    else:
        s = sorted(extent)
        if s[1] <= 0.09 and s[2] >= 3 * max(s[1], 1e-3) and depth <= RULE["structural-joint"]["maxDepth"]:
            rule = "structural-joint"
    rec["contactRule"] = rule
    measured = "aInsideB" in rec
    rec["openPair"] = measured and rec.get("aInsideB") is None and rec.get("bInsideA") is None
    # Severity ranks deep, long seams first. Open-open crossings (leaf cards, cloth) carry no
    # measurable depth; they rank by seam length at a nominal 5 mm so they are never hidden.
    if rule or not measured:
        rec["severity"] = 0.0
    elif rec["openPair"]:
        rec["severity"] = round(5 * math.sqrt(rec["seamM"]), 3)
    else:
        rec["severity"] = round(depth * 1000 * math.sqrt(max(rec["seamM"], 1e-3)), 3)
    return rec


def import_delivered(scene, config):
    """Load the shipped Draco GLBs (shell, rooms, coast, flora) exactly as delivered."""
    files = [config["shell"], config["coast"], config.get("flora")] + [r["file"] for r in config["rooms"]]
    loaded = []
    for name in [f for f in files if f]:
        before = set(scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(ROOT / "assets/models/home" / name))
        new = [o for o in scene.objects if o not in before]
        loaded.append({"file": name, "objects": len(new), "sha256": sha256(ROOT / "assets/models/home" / name)})
    return loaded


def main():
    t0 = time.time()
    config = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if DELIVERED:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene = bpy.context.scene
        delivered_files = import_delivered(scene, config)
        log("delivered", delivered_files)
    else:
        delivered_files = []
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
        scene = bpy.context.scene
    furniture = import_furniture(scene, config) if FURNITURE else []
    bpy.context.view_layer.update()
    meshes, skipped = collect(scene)
    log(f"collected {len(meshes)} meshes, {sum(len(m['tri']) for m in meshes)} triangles in {time.time() - t0:.1f}s")
    t1 = time.time()
    trees = build_trees(meshes)
    coplanar, coplanar_tested = coplanar_overlaps(meshes, trees)
    log(f"coplanar: {len(coplanar)} pairs ({coplanar_tested} triangle pairs) in {time.time() - t1:.1f}s")
    t2 = time.time()
    sites, checked, crossing_pairs, foliage = interpenetration(meshes, trees)
    for rec in sites:
        classify(rec)
    sites.sort(key=lambda r: -r["severity"])
    t3 = time.time()
    log(f"interpenetration: {len(sites)} sites from {crossing_pairs} crossing pairs in {t3 - t2:.1f}s")
    offenders = [r for r in sites if r["severity"] > 0]
    zfight = [r for r in coplanar if r["verdict"] == "z-fighting"]
    rule_counts = {}
    for r in sites:
        rule_counts[r["contactRule"] or "unclassified"] = rule_counts.get(r["contactRule"] or "unclassified", 0) + 1
    exports = {p.name: sha256(p) for p in sorted((ROOT / "assets/models/home").glob("*.glb"))
               if p.name.startswith(("home-shell", "room-", "coast", "flora"))}
    report = {
        "tool": "bin/audit_coastal_overlaps.py",
        "toolSha256": hashlib.sha256(Path(__file__).read_bytes().replace(b"\r\n", b"\n")).hexdigest(),
        "delivered": DELIVERED,
        "deliveredFiles": delivered_files,
        "source": SOURCE.relative_to(ROOT).as_posix() if SOURCE.is_relative_to(ROOT) else str(SOURCE),
        "sourceSha256": sha256(SOURCE),
        "manifestSha256": sha256(MANIFEST),
        "exportsSha256": exports,
        "furniture": furniture,
        "tolerances": {"planeMm": PLANE_TOLERANCE * 1000, "angleDegrees": math.degrees(ANGLE_TOLERANCE),
                       "minCoplanarAreaCm2": MIN_COPLANAR_AREA * 1e4, "minSeamMm": MIN_SEAM * 1000,
                       "siteCellM": SITE_CELL, "sampleCap": SAMPLE_CAP},
        "contactRules": CONTACT_RULES,
        "exclusions": EXCLUSIONS,
        "skipped": skipped,
        "foliageOverlap": {"pairs": foliage["pairs"], "seamM": round(foliage["seamM"], 2)},
        "counts": {"meshes": len(meshes), "triangles": int(sum(len(m["tri"]) for m in meshes)),
                   "closedMeshes": sum(1 for m in meshes if m["closed"]), "pairsTested": checked,
                   "crossingPairs": crossing_pairs, "sites": len(sites), "offenders": len(offenders),
                   "coplanarPairs": len(coplanar), "zFightingPairs": len(zfight), "coplanarTrianglePairsTested": coplanar_tested},
        "ruleCounts": rule_counts,
        "totals": {"offenderSeamM": round(sum(r["seamM"] for r in offenders), 3),
                   "grazingSeamM": round(sum(r["grazingSeamM"] for r in offenders if r.get("grazing")), 3),
                   "zFightingAreaM2": round(sum(r["visibleAreaM2"] for r in zfight), 5)},
        "seconds": {"collect": round(t1 - t0, 1), "coplanar": round(t2 - t1, 1), "interpenetration": round(t3 - t2, 1)},
        "interpenetration": sites,
        "coplanar": coplanar,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")
    log(json.dumps({"out": str(OUT), **report["counts"], **report["totals"], "rules": rule_counts}))


if __name__ == "__main__":
    main()
