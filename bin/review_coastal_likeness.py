"""Review the October 15 likeness pass on the four human sources against a baseline commit.

1. Exact retention: every SiruiMesh vertex outside the replaced head features (position and
   every skin weight), the faces among them, all bones, every authored key, the eyelid mesh
   with its Blink morphs, and the object transforms match the baseline exactly.
2. Every new hair, brow, face and mouth vertex is skinned fully to Head.
3. The sleep clip still rests the head where review_coastal_models.py expects it.
4. Clearances: hair inside the ears, spectacle rims or eyelids; eye parts inside the rebuilt
   face; hair inside the body in all fourteen clips at five key times, before and after.
5. Bedding advisory: the new heads against the retained per-avatar pillows and duvets in
   coastal-home.blend, which is opened read-only and never saved.

  blender -b --python-exit-code 1 --python bin/review_coastal_likeness.py -- --baseline-ref=f403dfead
Writes artwork/coastal-home/reviews/character-likeness-review.json.
"""

import hashlib
import json
import subprocess
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_bedding import MATTRESS, SLEEP_ACTOR
from coastal_likeness import SLEEP_BACK_Y, STYLES, HeadFrame, components, likeness_vertices

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
options = {arg[2:].split("=", 1)[0]: arg.split("=", 1)[1] for arg in args if arg.startswith("--") and "=" in arg}
def option_path(name, default):
    path = Path(options.get(name, default))
    return path if path.is_absolute() else ROOT / path
HOUSE = option_path("source", "artwork/coastal-home/coastal-home.blend")
MANIFEST = option_path("manifest", "assets/models/home/manifest.json")
BEDDING = option_path("bedding", "artwork/coastal-home/reviews/bedding.json")
reference = next((a.split("=", 1)[1] for a in args if a.startswith("--baseline-ref=")), "f403dfead")
requested = [a.split("=", 1)[1] for a in args if a.startswith("--avatar=")] or list(STYLES)
CACHE = ROOT / ".jekyll-cache/visual-qa/character-likeness"
CACHE.mkdir(parents=True, exist_ok=True)
CLIPS = ("idle", "walk", "typing", "reading", "eat", "drink", "workout", "pullup", "dip",
         "coffee-prep", "carry", "soak", "lounge", "sleep")
FRAMES = (1, 25, 49, 73, 97)
RAY = Vector((0.0123, 0.0217, 1.0)).normalized()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def open_source(path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    mesh = bpy.data.objects["SiruiMesh"]
    lids = next(o for o in arm.children if o.get("characterLids"))
    return arm, mesh, lids


def owned_parts(arm, mesh):
    return likeness_vertices(mesh, arm.data.bones["Eye.R"].head_local.z)


def fingerprint(arm, mesh, lids):
    owned = owned_parts(arm, mesh)
    replaced = set().union(*owned.values())
    me = mesh.data
    keep = [v.index for v in me.vertices if v.index not in replaced]
    rank = {i: n for n, i in enumerate(keep)}
    groups = [g.name for g in mesh.vertex_groups]
    names = [m.name if m else "" for m in me.materials]
    vertices = [[list(me.vertices[i].co), sorted((groups[g.group], g.weight) for g in me.vertices[i].groups)]
                for i in keep]
    faces = [[[rank[i] for i in p.vertices], names[p.material_index], p.use_smooth]
             for p in me.polygons if all(i in rank for i in p.vertices)]
    keys = [(track.name, [(c.data_path, c.array_index, [(list(k.co), k.interpolation) for k in c.keyframe_points])
                          for strip in track.strips for c in strip.action.fcurves])
            for track in arm.animation_data.nla_tracks]
    bones = [(b.name, list(b.head_local), list(b.tail_local), [list(r) for r in b.matrix_local],
              b.parent.name if b.parent else None) for b in arm.data.bones]
    lid_groups = [g.name for g in lids.vertex_groups]
    eyelids = {"vertices": [list(v.co) for v in lids.data.vertices],
               "faces": [list(p.vertices) for p in lids.data.polygons],
               "weights": [sorted((lid_groups[g.group], g.weight) for g in v.groups) for v in lids.data.vertices],
               "shapeKeys": {kb.name: [list(d.co) for d in kb.data] for kb in lids.data.shape_keys.key_blocks}}
    objects = [(o.name, [list(r) for r in o.matrix_world], o.parent.name if o.parent else None)
               for o in sorted(bpy.context.scene.objects, key=lambda o: o.name) if o.type in ("MESH", "ARMATURE")]
    return ({"retainedVertices": digest(vertices), "retainedFaces": digest(faces), "keys": digest(keys),
             "bones": digest(bones), "eyelids": digest(eyelids), "objects": digest(objects)},
            {"retainedVertices": len(keep), "retainedFaces": len(faces),
             "replacedVertices": {k: len(v) for k, v in owned.items()}})


def inside(tree, point):
    """Ray parity against a closed mesh."""
    count, origin = 0, point.copy()
    for _ in range(64):
        hit = tree.ray_cast(origin, RAY, 10.0)
        if hit[0] is None:
            break
        count += 1
        origin = hit[0] + RAY * 1e-6
    return count % 2 == 1


def part_tree(mesh, vertex_set, evaluated=None):
    me = mesh.data
    points = evaluated if evaluated is not None else [v.co.copy() for v in me.vertices]
    polygons = [list(p.vertices) for p in me.polygons if all(i in vertex_set for i in p.vertices)]
    return BVHTree.FromPolygons(points, polygons)


def deformed(mesh):
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = mesh.evaluated_get(graph)
    data = evaluated.to_mesh()
    points = [evaluated.matrix_world @ v.co for v in data.vertices]
    evaluated.to_mesh_clear()
    return points


def pose(arm, clip, frame):
    for track in arm.animation_data.nla_tracks:
        track.mute = track.name != clip
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()


def body_penetration(arm, mesh, hair):
    """Deepest hair vertex inside the body (shirt, arms, hands, neck, legs) per clip."""
    me = mesh.data
    head = mesh.vertex_groups["Head"].index
    body = {v.index for v in me.vertices if not any(g.group == head and g.weight > 0.5 for g in v.groups)}
    polygons = [list(p.vertices) for p in me.polygons if all(i in body for i in p.vertices)]
    results = {}
    for clip in CLIPS:
        worst, count = 0.0, 0
        for frame in FRAMES:
            pose(arm, clip, frame)
            points = deformed(mesh)
            tree = BVHTree.FromPolygons(points, polygons)
            for i in hair:
                found = tree.find_nearest(points[i], 0.06)
                if found[0] is not None and (points[i] - found[0]).dot(found[1]) < 0:
                    count += 1
                    worst = max(worst, found[3])
        results[clip] = {"verticesInside": count, "deepestMeters": round(worst, 4)}
    return results


def head_parts(arm, mesh):
    """Owned features, all hair (old scalp, ribbons and collar sheets, or the new shell) and brows."""
    owned = owned_parts(arm, mesh)
    me = mesh.data
    names = [m.name if m else "" for m in me.materials]
    eye = arm.data.bones["Eye.R"].head_local
    hair, brows = set(), set()
    for part in components(me, [p for p in me.polygons if names[p.material_index] == "long black hair"]):
        center = sum((me.vertices[i].co for i in part), Vector()) / len(part)
        # Brows sit on the forehead just above the eyes; every hair piece reaches back over the head.
        (brows if len(part) < 2000 and center.y < eye.y + 0.06 and eye.z < center.z < eye.z + 0.25
         else hair).update(part)
    return owned, hair, brows


def static_clearance(style, arm, mesh, lids, after):
    """Rest-pose checks among parts that all move rigidly with the head."""
    me = mesh.data
    owned, shell, brows = head_parts(arm, mesh)
    names = [m.name if m else "" for m in me.materials]
    glass = {i for p in me.polygons if names[p.material_index] == "wire spectacles" for i in p.vertices}
    front = min(me.vertices[i].co.y for i in glass)
    rims = {i for i in glass if me.vertices[i].co.y < front + 0.03}
    head = mesh.vertex_groups["Head"].index
    eye_groups = {mesh.vertex_groups["Eye.L"].index, mesh.vertex_groups["Eye.R"].index}
    face = owned["face"]
    eye_parts = set()
    for p in me.polygons:
        if names[p.material_index] in ("warm white", "warm brown iris", "ink details"):
            if all(i not in owned["teeth"] for i in p.vertices):
                eye_parts.update(p.vertices)
    # The soft eyelid tubes: Head-only skin pieces other than the face (neck and arms are not Head).
    for part in components(me, [p for p in me.polygons if names[p.material_index] == "skin"]):
        groups = me.vertices[next(iter(part))].groups
        if part != face and len(groups) == 1 and groups[0].group == head:
            eye_parts.update(part)
    eye_parts = {i for i in eye_parts if any(g.group in eye_groups | {head} for g in me.vertices[i].groups)}
    shell_tree, brow_tree, face_tree = part_tree(mesh, shell), part_tree(mesh, brows), part_tree(mesh, face)
    report = {
        "rimVerticesInsideHair": sum(inside(shell_tree, me.vertices[i].co) for i in rims),
        "rimVerticesInsideBrows": sum(inside(brow_tree, me.vertices[i].co) for i in rims),
        "armVerticesInsideHair": sum(inside(shell_tree, me.vertices[i].co) for i in glass - rims),
        "armVertices": len(glass - rims),
        "eyePartVerticesInsideFace": sum(inside(face_tree, me.vertices[i].co) for i in eye_parts),
        "eyePartVertices": len(eye_parts),
    }
    lid_points = {"open": [v.co.copy() for v in lids.data.vertices]}
    keyed = lids.data.shape_keys.key_blocks
    lid_points["closed"] = [keyed["BlinkL"].data[i].co + keyed["BlinkR"].data[i].co - keyed["Basis"].data[i].co
                            for i in range(len(lids.data.vertices))]
    for state, points in lid_points.items():
        report[f"eyelidVerticesInsideHair_{state}"] = sum(inside(shell_tree, p) for p in points)
        report[f"eyelidVerticesInsideFace_{state}"] = sum(inside(face_tree, p) for p in points)
    if after:
        frame = HeadFrame(style, mesh, arm)
        worst = 0.0
        hits = 0
        for i in shell | brows:
            p = me.vertices[i].co
            for center, radius in frame.ears.values():
                s = sum(((p[k] - center[k]) / radius[k]) ** 2 for k in range(3))
                if s < 1:
                    hits += 1
                    worst = max(worst, (1 - s ** 0.5) * min(radius))
        report["hairVerticesInsideEars"] = hits
        report["deepestInsideEarMeters"] = round(worst, 4)
        bad = [i for i in set().union(*owned.values())
               if [(g.group, round(g.weight, 6)) for g in me.vertices[i].groups] != [(head, 1.0)]]
        report["newVerticesNotHeadOnly"] = len(bad)
        assert not bad, (style, len(bad))
        report["rearmostRestY"] = round(max(me.vertices[i].co.y for i in set().union(*owned.values())), 4)
        assert report["rearmostRestY"] <= SLEEP_BACK_Y[style] + 0.0005, report
    return report, shell, brows


def sleep_contact(arm, mesh):
    head = mesh.vertex_groups["Head"].index
    rows = []
    for frame in FRAMES:
        pose(arm, "sleep", frame)
        points = deformed(mesh)
        heads = [points[v.index] for v in mesh.data.vertices if any(g.group == head and g.weight > .9 for g in v.groups)]
        low = min(p.z for p in heads)
        # The same window review_coastal_models.py asserts for the fitted pillow.
        assert .607 <= low <= .625, (frame, low)
        rows.append({"frame": frame, "headMinZ": round(low, 4)})
    return rows


def sleep_points(arm, mesh, vertex_set):
    head = mesh.vertex_groups["Head"].index
    heads = {v.index for v in mesh.data.vertices if any(g.group == head and g.weight > .5 for g in v.groups)}
    out = []
    for frame in (25, 73):
        pose(arm, "sleep", frame)
        points = deformed(mesh)
        out.append({"frame": frame, "head": [points[i] + SLEEP_ACTOR for i in heads],
                    "features": [points[i] + SLEEP_ACTOR for i in vertex_set]})
    return out


reports, bedding_points = [], {}
for style in requested:
    baseline = CACHE / f"{style}-before.blend"
    baseline.write_bytes(subprocess.check_output(
        ["git", "show", f"{reference}:artwork/coastal-home/sirui-{style}.blend"], cwd=ROOT))
    arm, mesh, lids = open_source(baseline)
    before, before_counts = fingerprint(arm, mesh, lids)
    before_static, before_shell, _ = static_clearance(style, arm, mesh, lids, after=False)
    before_body = body_penetration(arm, mesh, before_shell)
    arm, mesh, lids = open_source(ROOT / "artwork/coastal-home" / f"sirui-{style}.blend")
    after, after_counts = fingerprint(arm, mesh, lids)
    assert after == before, (style, before, after)
    after_static, shell, brows = static_clearance(style, arm, mesh, lids, after=True)
    after_body = body_penetration(arm, mesh, shell)
    contact = sleep_contact(arm, mesh)
    owned = owned_parts(arm, mesh)
    bedding_points[style] = sleep_points(arm, mesh, set().union(*owned.values()))
    reports.append({"avatar": style, "exactRetained": after, "counts": {"before": before_counts, "after": after_counts},
                    "clearance": {"before": before_static, "after": after_static},
                    "hairInsideBody": {"before": before_body, "after": after_body},
                    "sleepHeadContact": contact})
    print(json.dumps({"avatar": style, "after": after_static,
                      "deepestBody": {c: r["deepestMeters"] for c, r in after_body.items()}}), flush=True)

# Bedding advisory against the retained house source, opened read-only and never saved.
bpy.ops.wm.open_mainfile(filepath=str(HOUSE))
house_config = json.loads(MANIFEST.read_text(encoding="utf-8"))
sleep_room = next(room for room in house_config["rooms"] if room["id"] == "sleep")
sx, sy, sz = sleep_room["actor"]
translation = Vector((sx, -sz, sy)) - SLEEP_ACTOR
if abs(sleep_room.get("facing", 0.)) > 1e-8:
    raise RuntimeError("The bedding advisory's hem bounds require the actual zero-yaw sleep frame")
fitted = json.loads(BEDDING.read_text(encoding="utf-8"))["variants"]
mattress_top = MATTRESS["center"][2] + MATTRESS["size"][2] / 2 + translation.z
graph = bpy.context.evaluated_depsgraph_get()
def world_tree(obj):
    evaluated = obj.evaluated_get(graph)
    data = evaluated.to_mesh()
    data.calc_loop_triangles()
    tree = BVHTree.FromPolygons([evaluated.matrix_world @ vertex.co for vertex in data.vertices],
        [list(face.vertices) for face in data.loop_triangles], all_triangles=True)
    evaluated.to_mesh_clear()
    return tree
advice = {}
for style, frames in bedding_points.items():
    frames = [{"frame": frame["frame"], "head": [point+translation for point in frame["head"]],
               "features": [point+translation for point in frame["features"]]} for frame in frames]
    pillow, cover = bpy.data.objects[f"sleep_pillow_{style}"], bpy.data.objects[f"sleep_duvet_{style}"]
    pillow_tree, cover_tree = world_tree(pillow), world_tree(cover)
    pc = [pillow.matrix_world @ Vector(c) for c in pillow.bound_box]
    p_low = Vector([min(p[k] for p in pc) for k in range(3)])
    p_high = Vector([max(p[k] for p in pc) for k in range(3)])
    cc = [cover.matrix_world @ Vector(c) for c in cover.bound_box]
    c_low = Vector([min(p[k] for p in cc) for k in range(3)])
    c_high = Vector([max(p[k] for p in cc) for k in range(3)])
    hem = fitted[style]["duvet"]["hemY"] + translation.y
    worst_pillow = worst_cover = 0.0
    inside_pillow = above_cover = 0
    chin = min(p.y for f in frames for p in f["head"])
    for f in frames:
        for point in f["head"]:
            if p_low.x <= point.x <= p_high.x and p_low.y <= point.y <= p_high.y and point.z < p_high.z:
                hit = pillow_tree.ray_cast(Vector((point.x, point.y, p_high.z + 1)), Vector((0, 0, -1)))
                if hit[0] is not None and mattress_top < point.z < hit[0].z - 0.001:
                    inside_pillow += 1
                    worst_pillow = max(worst_pillow, hit[0].z - point.z)
            if c_low.x + 0.05 <= point.x <= c_high.x - 0.05 and c_low.y + 0.05 <= point.y <= hem - 0.04:
                hit = cover_tree.ray_cast(point + Vector((0, 0, 2)), Vector((0, 0, -1)))
                if hit[0] is not None and point.z > hit[0].z - 0.03:
                    above_cover += 1
                    worst_cover = max(worst_cover, point.z - (hit[0].z - 0.03))
    advice[style] = {
        "insidePillow": inside_pillow, "worstInsidePillowMeters": round(worst_pillow, 4),
        "fittedWorstInsidePillowMeters": fitted[style]["worstInsidePillowMeters"],
        "aboveCoverUnderside": above_cover, "worstAboveCoverUndersideMeters": round(worst_cover, 4),
        "lowestHeadY": round(chin, 4), "fittedHemY": hem, "refitHemY": round(chin - 0.07, 4),
        # The thresholds review_coastal_models.py asserts after a bedding refit.
        "refitNeeded": worst_pillow >= .01 or worst_cover >= .032 or abs((chin - 0.07) - hem) > 0.02,
    }
    print(style, json.dumps(advice[style]), flush=True)

output = option_path("out", "artwork/coastal-home/reviews/character-likeness-review.json")
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({
    "baselineRef": reference, "houseSourceSha256": hashlib.sha256(HOUSE.read_bytes()).hexdigest(),
    "houseManifestSha256": hashlib.sha256(MANIFEST.read_bytes()).hexdigest(), "sleepActor": sleep_room["actor"],
    "method": "Exact digests of everything outside the replaced head features; ray-parity and nearest-surface "
              "tests on actual rest and deformed Blender meshes at five key times per clip",
    "limitations": "Sampled vertex tests, not continuous collision proof. Hair is rigidly skinned to Head; "
                   "it has no secondary motion. Bedding advice is read-only; refresh_coastal_bedding.py owns the refit.",
    "avatars": reports, "beddingAdvisory": advice}, indent=2) + "\n", encoding="utf-8", newline="\n")
print(output, flush=True)
