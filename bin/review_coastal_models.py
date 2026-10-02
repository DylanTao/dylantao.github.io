"""Measure the actual revised Blender rigs and binary web deliverables.

Run after the focused rebuilds, vertex-light bake and optimized export. The
contact sample covers the authored clips; it is not whole-body dynamics.
"""

import gzip
import hashlib
import json
import math
import struct
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_hands import grip_offset
OUT = ROOT / "artwork/coastal-home/reviews"
AVATARS = ("lizard", "south-park", "simpsons", "ghibli", "rick-and-morty")


def pose(arm, clip, frame):
    for track in arm.animation_data.nla_tracks:
        track.mute = track.name != clip
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()


def bounds(obj, group=None):
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    index = obj.vertex_groups[group].index if group else None
    points = [evaluated.matrix_world @ evaluated.data.vertices[v.index].co
              for v in obj.data.vertices if index is None or any(
                  g.group == index and g.weight > .9 for g in v.groups)]
    return {"min": [min(p[k] for p in points) for k in range(3)],
            "max": [max(p[k] for p in points) for k in range(3)]}


contacts = []
sleep_feet = {}
for avatar in AVATARS:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / "artwork/coastal-home" / f"sirui-{avatar}.blend"))
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    mesh = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    pose(arm, "idle", 1)
    report = {"avatar": avatar, "standingBounds": bounds(mesh), "clips": []}
    for clip in ("typing", "reading", "pullup", "dip", "coffee-prep", "carry", "sleep", "soak"):
        samples = []
        for frame in (1, 25, 49, 73, 97):
            pose(arm, clip, frame)
            phase = (frame - 1) / 96 * math.tau
            goals = {}
            if clip == "typing":
                goals = {side: (x, -.345, .925 + .006 * math.sin(phase * 4 + i * math.pi))
                         for i, (side, x) in enumerate((("L", -.13), ("R", .13)))}
            elif clip == "reading":
                goals = {"L": (-.16, -.36, 1), "R": (.16, -.36, 1)}
            elif clip in ("pullup", "dip"):
                x, z = (.30, 2.322) if clip == "pullup" else (.43, 1.192)
                goals = {"L": (-x, -.01, z), "R": (x, -.01, z)}
                if arm.data.bones.get("Hand.Finger.0.0.L"):
                    goals = {side: Vector(goal) + grip_offset(side, clip)
                             for side, goal in goals.items()}
            elif clip == "coffee-prep":
                goals = {"R": (.13, -.49, 1.06 + .035 * math.sin(phase))}
            elif clip == "carry":
                goals = {"R": (.16, -.30, .91)}
            hands = {side: list(arm.pose.bones["Hand." + side].head) for side in ("L", "R")}
            drift = {side: (Vector(hands[side]) - Vector(goal)).length for side, goal in goals.items()}
            sample = {"frame": frame, "wristDriftMeters": drift, "wrist": hands}
            if clip in ("pullup", "dip") and arm.data.bones.get("Hand.Finger.0.0.L"):
                sample["contactReference"] = "Anatomical wrist offset from cylinder center"
            if clip in ("typing", "soak"):
                sample["feet"] = {side: bounds(mesh, "Foot." + side) for side in ("L", "R")}
            if clip == "typing":
                for side, foot in sample["feet"].items():
                    # The final study/dining board covers the whole sole. The
                    # lizard's rounded toes penetrate it by less than 2 mm.
                    assert abs(foot["min"][2] - .22) < .003, (avatar, side, foot)
                    assert -.69 <= foot["min"][1] and foot["max"][1] <= -.29
                    assert -.245 <= foot["min"][0] and foot["max"][0] <= .245
                sample["supportTopMeters"] = .22
            if clip == "sleep":
                sample["bodyBounds"] = bounds(mesh)
                assert sample["bodyBounds"]["min"][2] >= .52, (avatar, sample["bodyBounds"])
                sample["headBounds"] = bounds(mesh, "Head")
                assert .607 <= sample["headBounds"]["min"][2] <= .625, (avatar, sample["headBounds"])
                if frame == 1:
                    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
                    feet = {mesh.vertex_groups["Foot." + side].index for side in ("L", "R")}
                    sleep_feet[avatar] = [evaluated.matrix_world @ evaluated.data.vertices[v.index].co
                                         + Vector((-3.1, -3.49, 2.6)) for v in mesh.data.vertices
                                         if any(g.group in feet and g.weight > .9 for g in v.groups)]
            samples.append(sample)
        maximum = max((d for s in samples for d in s["wristDriftMeters"].values()), default=0)
        # Source baked fixed grips should be precise. Runtime cross-fades and
        # the coffee equipment's lateral variation are checked in the browser.
        if clip in ("typing", "reading", "pullup", "dip", "coffee-prep", "carry"):
            assert maximum < .005, (avatar, clip, maximum)
        report["clips"].append({"clip": clip, "maximumWristDriftMeters": maximum, "samples": samples})
    contacts.append(report)

bpy.ops.wm.open_mainfile(filepath=str(ROOT / "artwork/coastal-home/coastal-home.blend"))
duvet = next(o for o in bpy.context.scene.objects if o.type == "MESH" and o.name.startswith("sleep_")
             and any(m.name == "sage textile" for m in o.data.materials))
cloth = BVHTree.FromObject(duvet, bpy.context.evaluated_depsgraph_get())
sleep_cover = []
for avatar, points in sleep_feet.items():
    penetration = []
    for point in points:
        local = duvet.matrix_world.inverted() @ point
        hit, _, _, _ = cloth.ray_cast(local + Vector((0, 0, 2)), Vector((0, 0, -1)))
        assert hit is not None, (avatar, list(point))
        penetration.append(local.z - hit.z)
    maximum = max(penetration)
    assert maximum < .003, (avatar, maximum)
    sleep_cover.append({"avatar": avatar, "maximumFootAboveDuvetMeters": maximum,
                        "method": "Actual weighted foot vertices raycast against fitted cloth"})


def glb(path):
    data = path.read_bytes()
    assert struct.unpack_from("<III", data) == (0x46546C67, 2, len(data))
    count, kind = struct.unpack_from("<II", data, 12)
    assert kind == 0x4E4F534A
    return data, json.loads(data[20:20 + count])


assets = []
for path in sorted((ROOT / "assets/models/home").glob("*.glb")):
    data, document = glb(path)
    triangles = sum(document["accessors"][p["indices"]]["count"] // 3
                    for mesh in document["meshes"] for p in mesh["primitives"])
    assets.append({"file": path.name, "bytes": len(data), "gzipBytes": len(gzip.compress(data)),
                   "triangles": triangles, "sha256": hashlib.sha256(data).hexdigest(),
                   "materials": [m["name"] for m in document["materials"]],
                   "animations": [a["name"] for a in document.get("animations", [])]})
report = {"method": "Actual Blender pose vertices and named wrists; five authored key times per clip",
          "coordinateSystem": "Blender Z-up, meters", "avatars": contacts,
          "sleepCover": sleep_cover,
          "assets": assets, "totalGlbBytes": sum(a["bytes"] for a in assets)}
OUT.mkdir(exist_ok=True)
(OUT / "model-contacts.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"assets": [{k: a[k] for k in ("file", "bytes", "triangles")} for a in assets],
                  "contacts": [{"avatar": a["avatar"], "height": a["standingBounds"]["max"][2],
                                "maximumWristDrift": max(c["maximumWristDriftMeters"] for c in a["clips"])}
                               for a in contacts]}, indent=2), flush=True)
