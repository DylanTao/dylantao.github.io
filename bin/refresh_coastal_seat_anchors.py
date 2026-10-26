"""Hand the nook banquette and the living's cloud sofa to the furniture pipeline, and clear the nook table.

    blender --background -t 8 --python-exit-code 1 --python bin/refresh_coastal_seat_anchors.py -- \
        [--source=artwork/coastal-home/coastal-home.blend] [--manifest=assets/models/home/manifest.json] \
        [--output=.jekyll-cache/seat-anchors/coastal-home.blend] [--config-output=.jekyll-cache/seat-anchors/manifest.json]

The built-in banquette (bin/coastal_kitchen.py) and the conversation pit's U sofa (bin/coastal_living.py)
become streamed furniture: their plinths and cushions (and the cushions, pillows and throw resting on
them) move, unchanged, into one placeholder per anchor (coastal_anchors: <room>_placeholder_<anchor>,
furniturePlaceholder = anchor), so each room reads the same until the life worker's item lands. The
plaster upstands, oak caps, treads, rug and floor cushions stay architecture. The breakfast plate and
the celadon carafe on the nook table are removed. Final (post-retreat) coordinates throughout; a source
already carrying ``seatAnchorsVersion`` is a checked no-op.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_anchors as anchors
import coastal_shell as shell

VERSION = 1
ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}


def _path(key, default):
    p = Path(ARGS.get(key, default))
    return p if p.is_absolute() else ROOT / p


# Native boxes (lo, hi) that hold whole islands of each batch. Listed from a native island survey.
NOOK = ((-4.96, -5.60, -0.45), (-3.55, -4.00, 0.70))
BANQUETTE = {
    "kitchen__honey ash": [((-4.95, -5.34, -0.43), (-3.60, -4.94, -0.07)), ((-4.71, -5.58, -0.43), (-4.31, -4.05, -0.07))],
    "kitchen__rust boucle textile": [NOOK],
    "kitchen__indigo textile": [((-4.77, -4.68, 0.04), (-4.59, -4.22, 0.39))],
    "kitchen__terracotta": [((-4.48, -5.40, 0.04), (-4.02, -5.22, 0.39))],
}
BREAKFAST = {
    "kitchen__warm glazed porcelain": [((-4.11, -4.88, 0.31), (-3.77, -4.54, 0.35))],
    "kitchen__celadon glaze": [((-3.76, -4.41, 0.31), (-3.58, -4.23, 0.58))],
}
PIT = ((-1.10, -9.00, -0.45), (2.90, -5.95, 1.0))
SOFA = {
    "lounge__honey ash": [((-1.00, -8.71, -0.43), (2.79, -8.33, -0.10)), ((-0.78, -8.29, -0.43), (-0.40, -6.02, -0.10)),
                          ((2.19, -8.29, -0.43), (2.57, -6.02, -0.10))],
    "lounge__cloud boucle textile": [PIT],
    "lounge__indigo textile": [((-1.10, -9.00, 0.0), (2.90, -5.95, 0.45))],
    "lounge__ochre textile": [((-1.10, -9.00, 0.0), (2.90, -5.95, 0.45))],
    "lounge__terracotta": [((-1.10, -9.00, 0.0), (2.90, -5.95, 0.45))],
    "lounge__ochre knit textile": [((-0.95, -7.52, 0.02), (-0.38, -6.72, 0.52))],
}
# Anchors (three.js metres: x, up, zw = -Blender y), the item's floor-contact centre, front to the sea.
ENTRIES = [
    {"id": "nook-banquette", "item": "banquette", "room": "kitchen", "position": [-4.27, -0.42, 4.815], "yaw": round(math.pi, 4),
     "seatHeight": 0.46, "footprint": [1.32, 1.51]},
    {"id": "living-sofa", "item": "cloud-sofa", "room": "lounge", "position": [0.895, -0.42, 7.435], "yaw": round(math.pi, 4),
     "seatHeight": 0.44, "footprint": [3.83, 2.87]},
]


def take_islands(obj, boxes):
    """Remove the islands lying wholly inside any box and return them as a bmesh (or None)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    islands = shell._islands(bm)
    taken = []
    for island in islands:
        pts = [obj.matrix_world @ v.co for v in island]
        lo = [min(p[k] for p in pts) for k in range(3)]
        hi = [max(p[k] for p in pts) for k in range(3)]
        if any(all(a[k] - 1e-4 <= lo[k] and hi[k] <= b[k] + 1e-4 for k in range(3)) for a, b in boxes):
            taken.extend(island)
    if not taken:
        bm.free()
        return None, 0
    keep = bm.copy()
    keep.verts.ensure_lookup_table()
    taken_index = {v.index for v in taken}
    bmesh.ops.delete(keep, geom=[keep.verts[i] for i in taken_index], context="VERTS")
    out = bm.copy()
    out.verts.ensure_lookup_table()
    bmesh.ops.delete(out, geom=[v for v in out.verts if v.index not in taken_index], context="VERTS")
    bm.free()
    keep.to_mesh(obj.data)
    keep.free()
    obj.data.update()
    count = len(shell._islands(out))
    return out, count


source = _path("source", "artwork/coastal-home/coastal-home.blend")
manifest_path = _path("manifest", "assets/models/home/manifest.json")
output = _path("output", ".jekyll-cache/seat-anchors/coastal-home.blend")
config_output = _path("config-output", ".jekyll-cache/seat-anchors/manifest.json")
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
config = json.loads(manifest_path.read_text(encoding="utf-8"))
if scene.get("seatAnchorsVersion") == VERSION:
    print(json.dumps({"retained": True, "version": VERSION}), flush=True)
    sys.exit(0)
report = {"version": VERSION, "moved": {}, "removed": {}}
for room, anchor, table in (("kitchen", "nook-banquette", BANQUETTE), ("lounge", "living-sofa", SOFA)):
    holder = anchors.Placeholder(room, anchor)
    frame = None  # the room's batches carry the retreat's setback; the moved parts keep their local frame
    for name, boxes in table.items():
        obj = bpy.data.objects.get(name)
        if obj is None:
            raise RuntimeError(f"missing batch {name}")
        if frame is None:
            frame = obj.matrix_world.copy()
        elif any(abs(a - b) > 1e-6 for ra, rb in zip(frame, obj.matrix_world) for a, b in zip(ra, rb)):
            raise RuntimeError(f"{name} is not in its room's frame")
        part, count = take_islands(obj, boxes)
        if not count:
            raise RuntimeError(f"nothing of {anchor} found in {name}")
        report["moved"][f"{anchor}:{name}"] = count
        mat = obj.data.materials[0]
        temp = bpy.data.meshes.new("tmp")
        part.to_mesh(temp)
        part.free()
        holder.bm(mat).from_mesh(temp)
        bpy.data.meshes.remove(temp)
    placeholder = holder.finish()
    placeholder.matrix_world = frame
    # The batches' baked colour is their active and render colour; the export quantizes only the
    # active one per vertex, so the merged copy must name it too or it ships per corner, unquantized.
    colors = placeholder.data.color_attributes
    baked = colors.get("Baked contact and bounce")
    if baked is None:
        raise RuntimeError(f"{placeholder.name} lost its baked colour")
    colors.active_color = baked
    colors.render_color_index = colors.active_color_index
    # The moved geometry keeps its baked colour attribute, so it keeps the room's bake label too.
    placeholder["bakedLighting"] = "Cycles AO + diffuse indirect, 24 samples, neutral modulation"
    placeholder["softened"] = True
for name, boxes in BREAKFAST.items():
    obj = bpy.data.objects[name]
    part, count = take_islands(obj, boxes)
    if count != 1:
        raise RuntimeError(f"expected one breakfast piece in {name}, found {count}")
    part.free()
    report["removed"][name] = count
anchors.merge_anchors(config, [{k: v for k, v in e.items() if k in ("id", "item", "room", "position", "yaw")} for e in ENTRIES])
report["anchors"] = ENTRIES
scene["seatAnchorsVersion"] = VERSION
for p in (output, config_output):
    p.parent.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
report["sourceSha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
report["outputSha256"] = hashlib.sha256(output.read_bytes()).hexdigest()
config_output.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8", newline="\n")
(output.parent / "report.json").write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"output": str(output), "moved": report["moved"], "removed": report["removed"]}), flush=True)
