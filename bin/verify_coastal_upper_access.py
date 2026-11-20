import bpy
import json
import math
import sys
from hashlib import sha256
from pathlib import Path
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

source, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
for name in ("core_arrival_door_upper__pale oak", "core_arrival_door_upper__brushed brass"):
    o = scene.objects[name]
    o.matrix_world = Matrix.Translation(Vector((-1.15, 0, 0))) @ o.matrix_world
bpy.context.view_layer.update()
verts, polys, names = [], [], []
for work in scene.objects:
    if (
        work.type != "MESH"
        or work.hide_render
        or work.get("shadowOnly")
        or work.get("renderStyle") not in (None, "realistic")
    ):
        continue
    if work.get("flora") or work.get("walk") == "through":
        continue
    pts = [work.matrix_world @ v.co for v in work.data.vertices]
    if not pts or max(p.x for p in pts) < -0.1 or min(p.x for p in pts) > 3.4:
        continue
    if max(p.y for p in pts) < -20.4 or min(p.y for p in pts) > -13.5:
        continue
    offset = len(verts)
    verts.extend(pts)
    polys.extend([offset + i for i in face.vertices] for face in work.data.polygons)
    names.extend([work.name] * len(work.data.polygons))
tree = BVHTree.FromPolygons(verts, polys)


def ray(x, y, z, direction, length):
    p, n, i, d = tree.ray_cast(Vector((x, -z, y)), Vector(direction), length)
    return None if p is None else (p, names[i], d)


rows = []
support_tolerance = 0.04
spans = [((0.195, 2.59375, 19.38), (2.65, 2.597, 19.38)), ((2.65, 2.597, 19.38), (2.65, 2.6, 14.1))]
for a, b in spans:
    length = math.hypot(b[0] - a[0], b[2] - a[2])
    tangent = ((b[0] - a[0]) / length, (b[2] - a[2]) / length)
    steps = math.ceil(length / 0.047)
    for i in range(steps + 1):
        t = i / steps
        for side in (-0.19, 0, 0.19):
            x, y, z = [a[j] + t * (b[j] - a[j]) for j in range(3)]
            x -= side * tangent[1]
            z += side * tangent[0]
            floor = ray(x, y + 0.085, z, (0, 0, -1), 0.2)
            overhead = ray(x, y + 0.04, z, (0, 0, 1), 4)
            hits = []
            if side == 0:
                for h in (0.25, 0.65, 1.18, 1.75):
                    for direction in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0)):
                        hit = ray(x, y + h, z, direction, 0.24)
                        if hit:
                            hits.append((h, direction, hit[1], hit[2]))
            rows.append(
                {
                    "at": [x, y, z],
                    "side": side,
                    "floor": None if floor is None else [floor[0].z - y, floor[1]],
                    "overhead": None if overhead is None else [overhead[0].z - y, overhead[1]],
                    "bodyProbeHits": hits,
                }
            )
bad = [r for r in rows if not r["floor"] or abs(r["floor"][0]) > support_tolerance or r["bodyProbeHits"]]
headroom = min([r["overhead"][0] for r in rows if r["overhead"]], default=0)
summary = {
    "rows": len(rows),
    "failed": len(bad),
    "minimumHeadroom": headroom,
    "maximumSupportError": max(abs(r["floor"][0]) for r in rows if r["floor"]),
    "passes": not bad and headroom >= 2.05,
}
output.write_text(
    json.dumps(
        {
            "sourceSha256": sha256(source.read_bytes()).hexdigest(),
            "summary": summary,
            "failedRows": bad,
            "probes": rows,
        },
        indent=2,
    )
    + "\n"
)
print(json.dumps(summary))
