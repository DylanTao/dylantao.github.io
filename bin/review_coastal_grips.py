"""Compare actual deformed hand surfaces and preserved non-grip source poses.

Run in Blender with --baseline=<absolute pre-change Ghibli .blend>. Distances
are vertex samples against the finite authored cylinders; they are not a
continuous collision proof or a physics simulation.
"""

import hashlib
import json
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_hands import grip_offset

baseline = next((Path(arg.split("=", 1)[1]) for arg in sys.argv if arg.startswith("--baseline=")), None)
assert baseline and baseline.is_file(), "Supply the pre-change source with --baseline="
clips = ("idle", "walk", "typing", "reading", "eat", "drink", "workout", "coffee-prep", "carry", "soak", "lounge", "sleep")
frames = (1, 25, 49, 73, 97)


def load(path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    return next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"), bpy.data.objects["SiruiMesh"]


def pose(arm, clip, frame):
    for track in arm.animation_data.nla_tracks:
        track.mute = track.name != clip
    whole = int(frame)
    bpy.context.scene.frame_set(whole, subframe=frame - whole)
    bpy.context.view_layer.update()


def vertices(mesh):
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    points = np.empty(len(evaluated.data.vertices) * 3, dtype=np.float32)
    evaluated.data.vertices.foreach_get("co", points)
    matrix = np.array(evaluated.matrix_world, dtype=np.float64)
    return points.reshape((-1, 3)) @ matrix[:3, :3].T + matrix[:3, 3]


def topology(mesh):
    digest = hashlib.sha256()
    for vertex in mesh.data.vertices:
        digest.update(np.array(vertex.co, dtype=np.float32).tobytes())
    for polygon in mesh.data.polygons:
        digest.update(np.array((*polygon.vertices, polygon.material_index), dtype=np.int32).tobytes())
    return digest.hexdigest()


def hand_masks(mesh):
    names = {group.index: group.name for group in mesh.vertex_groups}
    masks = {}
    for side in ("L", "R"):
        total = np.array([sum(g.weight for g in vertex.groups
                              if names[g.group].startswith("Hand.") and names[g.group].endswith("." + side))
                          for vertex in mesh.data.vertices])
        masks[side] = total > 0.2
        for digit in ("0", "1", "2", "3", "thumb"):
            masks[side + digit] = np.array([sum(g.weight for g in vertex.groups
                                                if names[g.group].startswith("Hand.Finger." + digit + ".")
                                                and names[g.group].endswith("." + side))
                                            for vertex in mesh.data.vertices]) > 0.75
    return masks


def cylinder_distances(points, x, z, radius, low, high):
    radial = np.hypot(points[:, 0] - x, points[:, 2] - z) - radius
    axial = np.abs(points[:, 1] - (low + high) / 2) - (high - low) / 2
    return np.hypot(np.maximum(radial, 0), np.maximum(axial, 0)) + np.minimum(np.maximum(radial, axial), 0)


cached = {}
arm, mesh = load(baseline)
original_topology = topology(mesh)
for clip in clips:
    for frame in frames:
        pose(arm, clip, frame)
        cached[clip, frame] = vertices(mesh)
before_masks = hand_masks(mesh)
before = []
for clip in ("pullup", "dip"):
    for frame in frames:
        pose(arm, clip, frame)
        points = vertices(mesh)
        x, z, radius, low, high = ((0.30, 2.322, 0.026, -0.30, 0.04) if clip == "pullup"
                                  else (0.43, 1.192, 0.034, -0.08, 0.22))
        for side, sign in (("L", -1), ("R", 1)):
            distances = cylinder_distances(points[before_masks[side]], sign * x, z, radius, low, high)
            before.append({"clip": clip, "frame": frame, "side": side,
                           "minimumSignedMeters": float(distances.min()),
                           "verticesInsideBeyond3mm": int((distances < -0.003).sum())})

arm, mesh = load(ROOT / "artwork/coastal-home/sirui-ghibli.blend")
assert topology(mesh) == original_topology, "Rest vertices, topology or material assignment changed"
assert len(arm.data.bones) == 38 and len(arm.animation_data.nla_tracks) == 14
neutral = []
for clip in clips:
    largest = 0
    for frame in frames:
        pose(arm, clip, frame)
        error = np.linalg.norm(vertices(mesh) - cached[clip, frame], axis=1).max()
        largest = max(largest, float(error))
    assert largest < 0.000002, (clip, largest)
    neutral.append({"clip": clip, "samples": len(frames), "maximumVertexDifferenceMeters": largest})
masks = hand_masks(mesh)
contacts = []
for clip in ("pullup", "dip"):
    # The delivered grips are keyed every frame. Sample actual half-frames
    # between those keys, as well as the initial authored frame.
    for frame in (1, *(frame + 0.5 for frame in range(3, 97, 3))):
        pose(arm, clip, frame)
        points = vertices(mesh)
        x, z, radius, low, high = ((0.30, 2.322, 0.026, -0.30, 0.04) if clip == "pullup"
                                  else (0.43, 1.192, 0.034, -0.08, 0.22))
        for side, sign in (("L", -1), ("R", 1)):
            distances = cylinder_distances(points[masks[side]], sign * x, z, radius, low, high)
            goal = Vector((sign * x, -0.01, z)) + grip_offset(side, clip)
            row = {"clip": clip, "frame": frame, "side": side, "sampledHandVertices": int(masks[side].sum()),
                   "minimumSignedMeters": float(distances.min()),
                   "verticesInsideBeyond3mm": int((distances < -0.003).sum()),
                   "verticesWithin2mm": int((np.abs(distances) < 0.002).sum()),
                   "wristTargetErrorMeters": (arm.pose.bones["Hand." + side].head - goal).length,
                   "digits": {}}
            for digit in ("0", "1", "2", "3", "thumb"):
                distance = cylinder_distances(points[masks[side + digit]], sign * x, z, radius, low, high)
                row["digits"][digit] = {"minimumSignedMeters": float(distance.min()),
                                         "verticesWithin2mm": int((np.abs(distance) < 0.002).sum())}
            assert row["minimumSignedMeters"] > -0.003, row
            assert all(d["verticesWithin2mm"] > 0 for d in row["digits"].values()), row
            assert row["wristTargetErrorMeters"] < 0.001, row
            contacts.append(row)
offsets = {clip: [[round(v.x, 6), round(v.z, 6), round(-v.y, 6)]
                 for v in (grip_offset(side, clip) for side in ("L", "R"))]
           for clip in ("pullup", "dip")}
report = {"reference": "Anatomical Hand.L/R wrist, cylinder surface measured separately",
          "surfaceMethod": "Original deformed source vertices versus signed finite-cylinder distance",
          "limitations": "Authored FK/IK grip with bounded skin compression, not a contact dynamics solver or continuous mesh collision proof",
          "topologySha256": original_topology, "rigBones": len(arm.data.bones),
          "gripWristOffsets": offsets, "unchangedPoses": neutral, "baseline": before, "contacts": contacts}
output = ROOT / "artwork/coastal-home/reviews/hand-contacts.json"
output.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"unchangedPoseMaximumMeters": max(r["maximumVertexDifferenceMeters"] for r in neutral),
                  "handMinimumSignedMeters": min(r["minimumSignedMeters"] for r in contacts),
                  "wristTargetMaximumMeters": max(r["wristTargetErrorMeters"] for r in contacts),
                  "contactSamples": len(contacts), "gripWristOffsets": offsets}, indent=2))
