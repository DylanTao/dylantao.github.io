"""Render close-up triage tiles for ranked sites of an overlap audit report.

    blender --background -t 8 --python-exit-code 1 --python bin/render_coastal_overlaps.py -- \
        --report=.jekyll-cache/overlap-audit/overlap-audit.json [--sites-file=picked.json] \
        [--top=48] [--kind=offenders|zfight] [--out=.jekyll-cache/overlap-audit/sheets]

Each tile is a local crop: only the triangles of the site's two meshes (penetrating side red,
host blue) and of nearby geometry (pale grey) inside a box around the seam are rebuilt as
temporary meshes, so a kilometre-scale rock or terrain batch cannot hide the site. Two
workbench views per site are written as ``<kind>-<rank>-<view>.png``.
"""
import json
import sys
from pathlib import Path

import bpy
import bmesh
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}


def _arg_path(key, default):
    p = Path(ARGS.get(key, default))
    return p if p.is_absolute() else ROOT / p


REPORT = _arg_path("report", ".jekyll-cache/overlap-audit/overlap-audit.json")
OUT = _arg_path("out", ".jekyll-cache/overlap-audit/sheets")
TOP = int(ARGS.get("top", "48"))
KIND = ARGS.get("kind", "offenders")
SITES = ARGS.get("sites")

report = json.loads(REPORT.read_text(encoding="utf-8"))
source = Path(report["source"]) if Path(report["source"]).is_absolute() else ROOT / report["source"]
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
if report.get("furniture"):
    import audit_coastal_overlaps as audit
    audit.import_furniture(scene, json.loads((ROOT / "assets/models/home/manifest.json").read_text(encoding="utf-8")))
bpy.context.view_layer.update()

if ARGS.get("sites-file"):
    sites = json.loads(_arg_path("sites-file", "").read_text(encoding="utf-8"))
elif KIND == "zfight":
    sites = [r for r in report["coplanar"] if r["verdict"] == "z-fighting"]
else:
    sites = [r for r in report["interpenetration"] if r["severity"] > 0]
for r in sites:
    if "center" not in r:
        lo, hi = r["bounds"]
        r["center"] = [(lo[k] + hi[k]) / 2 for k in range(3)]
    r.setdefault("penetrating", r["a"])

triangles = {}
for o in scene.objects:
    if o.type != "MESH" or o.hide_render or o.get("shadowOnly"):
        continue
    me = o.data
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    if not n:
        continue
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    m = np.array(o.matrix_world)
    co = co @ m[:3, :3].T + m[:3, 3]
    tri = np.empty(n * 3, dtype=np.int64)
    me.loop_triangles.foreach_get("vertices", tri)
    P = co[tri.reshape(-1, 3)]
    triangles[o.name] = (P, P.min(1), P.max(1))
    o.hide_render = True

scene.render.engine = "BLENDER_WORKBENCH"
sh = scene.display.shading
sh.light = "STUDIO"
sh.color_type = "OBJECT"
sh.show_cavity = True
sh.cavity_type = "WORLD"
sh.show_object_outline = True
sh.show_backface_culling = False
scene.display.render_aa = "8"
scene.render.resolution_x = 520
scene.render.resolution_y = 390
cam_data = bpy.data.cameras.new("triage")
cam_data.lens = 30
cam = bpy.data.objects.new("triage", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def crop(name, lo, hi, color):
    P, tlo, thi = triangles[name]
    sel = np.all((tlo <= hi) & (thi >= lo), axis=1)
    if not sel.any():
        return None
    Q = P[sel]
    bm = bmesh.new()
    for t in Q:
        vs = [bm.verts.new(Vector(v)) for v in t]
        try:
            bm.faces.new(vs)
        except ValueError:
            pass
    me = bpy.data.meshes.new("crop")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new("crop", me)
    obj.color = color
    scene.collection.objects.link(obj)
    return obj


ranks = [int(q) for q in SITES.split(",")] if SITES else list(range(1, min(TOP, len(sites)) + 1))
OUT.mkdir(parents=True, exist_ok=True)
written = 0
for rank in ranks:
    r = sites[rank - 1]
    lo = np.array(r["bounds"][0], dtype=float)
    hi = np.array(r["bounds"][1], dtype=float)
    size = float(np.linalg.norm(hi - lo))
    margin = max(0.25, 0.45 * size)
    lo_c, hi_c = lo - margin, hi + margin
    pen = r["penetrating"]
    host = r["b"] if pen == r["a"] else r["a"]
    temps = []
    for name in list(triangles):
        if name in (pen, host):
            continue
        t = crop(name, lo_c, hi_c, (0.84, 0.84, 0.82, 1))
        if t:
            temps.append(t)
    for name, color in ((host, (0.25, 0.45, 0.88, 1)), (pen, (0.88, 0.25, 0.2, 1))):
        if name in triangles:
            t = crop(name, lo_c, hi_c, color)
            if t:
                temps.append(t)
    center = Vector(r["center"])
    crossed = (r.get("crossedB") if pen == r["a"] else r.get("crossedA")) or {}
    mean = Vector(crossed.get("mean") or (0.4, -0.5, 0.6))
    views = [mean.normalized() if mean.length > 0.2 else Vector((0.4, -0.5, 0.6)).normalized(), Vector((0.55, -0.6, 0.58)).normalized()]
    for k, d in enumerate(views):
        if abs(d.z) > 0.96:
            d = (d + Vector((0.3, -0.25, 0))).normalized()
        dist = max(0.35, (size + 2 * margin) * 0.95)
        cam.location = center + d * dist
        cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam_data.clip_start = 0.005
        cam_data.clip_end = dist * 3 + 10
        scene.render.filepath = str(OUT / f"{KIND}-{rank:03d}-{k}.png")
        bpy.ops.render.render(write_still=True)
        written += 1
    for t in temps:
        me = t.data
        bpy.data.objects.remove(t, do_unlink=True)
        bpy.data.meshes.remove(me)
print(json.dumps({"written": written, "out": str(OUT)}), flush=True)
