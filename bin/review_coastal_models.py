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
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_hands import grip_offset
ARGS = {arg[2:].split("=", 1)[0]: arg.split("=", 1)[1] for arg in sys.argv if arg.startswith("--") and "=" in arg}
def option_path(name, default):
    path = Path(ARGS.get(name, default))
    return path if path.is_absolute() else ROOT / path
OUT = option_path("out", "artwork/coastal-home/reviews")
HOUSE = option_path("source", "artwork/coastal-home/coastal-home.blend")
MODELS = option_path("models", "assets/models/home")
MANIFEST = option_path("manifest", str(MODELS / "manifest.json"))
BEDDING = option_path("bedding", str(OUT / "bedding.json"))
config = json.loads(MANIFEST.read_text(encoding="utf-8"))
sleep_room = next(room for room in config["rooms"] if room["id"] == "sleep")
x, up, zw = sleep_room["actor"]
sleep_transform = Matrix.Translation((x, -zw, up)) @ Matrix.Rotation(sleep_room.get("facing", 0.), 4, "Z")
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
                    sleep_feet[avatar] = [sleep_transform @ (evaluated.matrix_world @ evaluated.data.vertices[v.index].co)
                                         for v in mesh.data.vertices
                                         if any(g.group in feet and g.weight > .9 for g in v.groups)]
            samples.append(sample)
        maximum = max((d for s in samples for d in s["wristDriftMeters"].values()), default=0)
        # Source baked fixed grips should be precise. Runtime cross-fades and
        # the coffee equipment's lateral variation are checked in the browser.
        if clip in ("typing", "reading", "pullup", "dip", "coffee-prep", "carry"):
            assert maximum < .005, (avatar, clip, maximum)
        report["clips"].append({"clip": clip, "maximumWristDriftMeters": maximum, "samples": samples})
    contacts.append(report)

bpy.ops.wm.open_mainfile(filepath=str(HOUSE))
sleep_cover = []
for avatar, points in sleep_feet.items():
    # Each avatar sleeps under its own draped duvet (refresh_coastal_bedding.py).
    duvet = bpy.data.objects["sleep_duvet_" + avatar]
    cloth = BVHTree.FromObject(duvet, bpy.context.evaluated_depsgraph_get())
    penetration = []
    for point in points:
        local = duvet.matrix_world.inverted() @ point
        hit, _, _, _ = cloth.ray_cast(local + Vector((0, 0, 2)), Vector((0, 0, -1)))
        assert hit is not None, (avatar, list(point))
        penetration.append(local.z - hit.z)
    maximum = max(penetration)
    assert maximum < .003, (avatar, maximum)
    sleep_cover.append({"avatar": avatar, "maximumFootAboveDuvetMeters": maximum,
                        "method": "Actual weighted foot vertices raycast against the avatar's own draped duvet"})
bedding = json.loads(BEDDING.read_text(encoding="utf-8"))
for avatar in AVATARS:
    fit = bedding["variants"][avatar]
    # The whole body, both breaths: at most 3 cm into the 3 cm filled cover, nothing in the pillow
    # deeper than 1 cm.
    assert fit["worstAboveCoverUndersideMeters"] < .032, (avatar, fit)
    assert fit["worstInsidePillowMeters"] < .01, (avatar, fit)


def glb(path):
    data = path.read_bytes()
    assert struct.unpack_from("<III", data) == (0x46546C67, 2, len(data))
    count, kind = struct.unpack_from("<II", data, 12)
    assert kind == 0x4E4F534A
    return data, json.loads(data[20:20 + count])


assets = []
for path in sorted(MODELS.glob("*.glb")):
    data, document = glb(path)
    triangles = sum(document["accessors"][p["indices"]]["count"] // 3
                    for mesh in document["meshes"] for p in mesh["primitives"])
    assets.append({"file": path.name, "bytes": len(data), "gzipBytes": len(gzip.compress(data)),
                   "triangles": triangles, "sha256": hashlib.sha256(data).hexdigest(),
                   "materials": [m["name"] for m in document["materials"]],
                   "animations": [a["name"] for a in document.get("animations", [])]})
report = {"method": "Actual Blender pose vertices and named wrists; five authored key times per clip",
          "scope": "Original five immutable native rig sources; final character-finish delivered skin is an independent gate",
          "houseSourceSha256": hashlib.sha256(HOUSE.read_bytes()).hexdigest(),
          "houseManifestSha256": hashlib.sha256(MANIFEST.read_bytes()).hexdigest(),
          "sleepActor": sleep_room["actor"],
          "coordinateSystem": "Blender Z-up, meters", "avatars": contacts,
          "sleepCover": sleep_cover,
          "assets": assets, "totalGlbBytes": sum(a["bytes"] for a in assets)}
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "model-contacts.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"assets": [{k: a[k] for k in ("file", "bytes", "triangles")} for a in assets],
                  "contacts": [{"avatar": a["avatar"], "height": a["standingBounds"]["max"][2],
                                "maximumWristDrift": max(c["maximumWristDriftMeters"] for c in a["clips"])}
                               for a in contacts]}, indent=2), flush=True)
