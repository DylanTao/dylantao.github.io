"""Seated contacts on a furniture piece for each avatar style (a lab fixture for the L4 seating).

Each style sits in its authored clip (eat by default, at the clip's middle frame): its lowest
pelvis or thigh skin rests 1 cm into the seat's cushion, centred across the seat, and the back of
its pelvis 5 mm in front of the backrest. The fixture then counts the skin vertices inside the
piece's frame (oak, metal: none may be) and inside its cushions (a soft seat takes a little), and
measures the clearance from the hips to the frame (the arms) and the feet against the floor.

Nothing in the repository changes except the report:
  blender -b --python-exit-code 1 --python bin/review_coastal_seating.py -- --item=dining-chair
  ... --clip=eat --avatar=lizard,ghibli --render   (also a still per style beside the report)
"""

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def option(name, default=None):
    for a in ARGS:
        if a == f"--{name}":
            return True
        if a.startswith(f"--{name}="):
            return a.split("=", 1)[1]
    return default


ITEM = option("item", "dining-chair")
CLIP = option("clip", "eat")
STYLES = option("avatar", "lizard,south-park,simpsons,ghibli,rick-and-morty").split(",")
RENDER = bool(option("render"))
# --with=whiskey-ottoman@0,-0.8 adds another piece at a Blender-frame offset (x, y) from this one.
WITH = [(w.split("@")[0], tuple(float(v) for v in w.split("@")[1].split(","))) for w in (option("with", "") or "").split(";") if w]
OUT = ROOT / "artwork" / "coastal-home" / "reviews" / "life-2026-10-24"
SOFT = ("linen", "leather", "boucle", "velvet", "cushion", "textile", "cotton")


def furniture():
    """The item's finest level (and any --with pieces), imported into the open scene: BVHs of their
    soft and hard parts."""
    index = json.loads((ROOT / "assets/models/home/furniture/index.json").read_text(encoding="utf-8"))
    entry = index["items"][ITEM]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "assets/models/home/furniture" / entry["lods"][-1]["file"]))
    for name, (dx, dy) in WITH:
        added = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(ROOT / "assets/models/home/furniture" / index["items"][name]["lods"][-1]["file"]))
        for o in set(bpy.data.objects) - added:
            if o.parent is None:
                o.location.x += dx
                o.location.y += dy
    bpy.context.view_layer.update()
    parts = {"soft": ([], []), "hard": ([], [])}
    for o in set(bpy.data.objects) - before:
        if o.type != "MESH":
            continue
        kind = "soft" if any(w in (o.active_material.name if o.active_material else "").lower() for w in SOFT) else "hard"
        verts, faces = parts[kind]
        base = len(verts)
        verts.extend(o.matrix_world @ v.co for v in o.data.vertices)
        faces.extend(tuple(base + i for i in p.vertices) for p in o.data.polygons)
    trees = {k: BVHTree.FromPolygons(v, f) for k, (v, f) in parts.items() if f}
    seat = Vector(entry["seat"])  # three.js: x, y up, z forward
    return entry, trees, Vector((seat.x, -seat.z, seat.y)), entry["seatHeight"]


def inside(tree, p, reach=0.12):
    hit = tree.find_nearest(p, reach)
    if hit[0] is None:
        return None, None
    location, normal, _, distance = hit
    return (p - location).dot(normal) < 0, distance


def main():
    report = {"item": ITEM, "with": [w[0] for w in WITH], "clip": CLIP, "avatars": {}}
    for style in STYLES:
        bpy.ops.wm.open_mainfile(filepath=str(ROOT / "artwork/coastal-home" / f"sirui-{style}.blend"))
        entry, trees, seat, seat_height = furniture()
        arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
        track = next(t for t in arm.animation_data.nla_tracks if t.name == CLIP)
        # Blender hands out a new wrapper on each access, so tracks compare by name.
        for t in arm.animation_data.nla_tracks:
            t.mute = t.name != CLIP
        strip = track.strips[0]
        frame = round((strip.frame_start + strip.frame_end) / 2)
        bpy.context.scene.frame_set(frame)
        graph = bpy.context.evaluated_depsgraph_get()
        skin = []
        for o in arm.children:
            if o.type != "MESH":
                continue
            names = {g.index: g.name for g in o.vertex_groups}
            evaluated = o.evaluated_get(graph)
            mesh = evaluated.to_mesh()
            for v, source in zip(mesh.vertices, o.data.vertices):
                best = max(source.groups, key=lambda g: g.weight, default=None)
                skin.append((evaluated.matrix_world @ v.co, names.get(best.group, "") if best else ""))
            evaluated.to_mesh_clear()
        pelvis = [p for p, bone in skin if bone in ("Hips", "Thigh.L", "Thigh.R")]
        lowest = min(p.z for p in pelvis)
        rear = max(p.y for p in pelvis)  # Blender -y is the front
        # The backrest's face in front of the pelvis: the first soft or hard surface met going back.
        z = seat_height + 0.12
        back = None
        for tree in trees.values():
            hit = tree.ray_cast(Vector((seat.x, seat.y - 0.5, z)), Vector((0, 1, 0)), 1.5)
            if hit[0] is not None and (back is None or hit[0].y < back):
                back = hit[0].y
        shift = Vector((seat.x, (back - 0.005 - rear) if back is not None else seat.y, seat_height - 0.01 - lowest))
        moved = [(p + shift, bone) for p, bone in skin]
        out = {"frame": frame, "shift": [round(c, 4) for c in shift], "soft": {"vertices": 0, "depth": 0.0}, "hard": {"vertices": 0, "depth": 0.0, "bones": {}}}
        clearance = math.inf
        for p, bone in moved:
            for kind, tree in trees.items():
                is_in, distance = inside(tree, p)
                if is_in is None:
                    continue
                if is_in:
                    out[kind]["vertices"] += 1
                    out[kind]["depth"] = max(out[kind]["depth"], distance)
                    if kind == "hard":
                        out["hard"]["bones"][bone] = out["hard"]["bones"].get(bone, 0) + 1
                elif kind == "hard" and bone in ("Hips", "Thigh.L", "Thigh.R"):
                    clearance = min(clearance, distance)
        out["soft"]["depth"] = round(out["soft"]["depth"], 4)
        out["hard"]["depth"] = round(out["hard"]["depth"], 4)
        out["hipFrameClearance"] = round(clearance, 4) if clearance < math.inf else None
        out["floor"] = round(min(p.z for p, _ in moved), 4)
        report["avatars"][style] = out
        print("SEATING", style, json.dumps(out), flush=True)
        if RENDER:
            arm.location += shift
            render(OUT / f"seating-{ITEM}-{CLIP}-{style}.png", seat)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"seating-{ITEM}-{CLIP}.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")


def render(path, seat):
    scene = bpy.context.scene
    data = bpy.data.cameras.new("seating")
    data.lens = 45
    camera = bpy.data.objects.new("seating", data)
    scene.collection.objects.link(camera)
    target = Vector((seat.x, seat.y, 0.75))
    camera.location = target + Vector((1.5, -1.7, 0.55))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
