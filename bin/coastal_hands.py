"""Original hand articulation with per-clip anatomical wrist targets.

The equipment solver targets anatomical Hand.L/R wrists, using per-avatar
offsets for the two grip clips. Ten finger segments are children of each hand;
other clips retain their original shape. This is authored FK/IK pose correction,
not a hand/contact dynamics simulation.
"""

import math
import json
import bpy
from mathutils import Matrix, Vector


def clamp(value):
    return max(0.0, min(1.0, value))


def digit_paths(arm, side):
    """Centerlines of the existing welded fingers, in adult rest space."""
    wrist = arm.data.bones["Hand." + side].head_local
    shift = wrist.z - 0.61
    paths = {}
    for index, length in enumerate((0.053, 0.062, 0.058, 0.047)):
        x = wrist.x + (index - 1.5) * 0.019
        paths[str(index)] = tuple(Vector(point) for point in (
            (x, -0.034, 0.532 + shift),
            (x, -0.049, 0.532 - length * 0.47 + shift),
            (x, -0.048, 0.532 - length + shift),
        ))
    sign = -1 if side == "L" else 1
    paths["thumb"] = tuple(Vector(point) for point in (
        (wrist.x - sign * 0.027, -0.028, 0.578 + shift),
        (wrist.x - sign * 0.051, -0.044, 0.549 + shift),
        (wrist.x - sign * 0.044, -0.061, 0.525 + shift),
    ))
    return paths


def segment_distance(point, a, b):
    t = clamp((point - a).dot(b - a) / (b - a).length_squared)
    return (point - a.lerp(b, t)).length, t


def install_hand_rig(arm, style):
    """Add deform joints without modifying vertices or the original skeleton."""
    if style != "ghibli":
        return []
    assert not arm.data.bones.get("Hand.Finger.0.0.L"), "Hand rig already installed"
    paths = {side: digit_paths(arm, side) for side in ("L", "R")}
    added = []
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for side in ("L", "R"):
        contact = arm.data.edit_bones["Hand." + side]
        for digit, points in paths[side].items():
            parent = contact
            for segment in range(2):
                bone = arm.data.edit_bones.new(f"Hand.Finger.{digit}.{segment}.{side}")
                bone.head, bone.tail = points[segment:segment + 2]
                bone.parent = parent
                added.append(bone.name)
                parent = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.parent != arm:
            continue
        for side in ("L", "R"):
            old = obj.vertex_groups.get("Hand." + side)
            if old is None:
                continue
            groups = {digit: [obj.vertex_groups.new(name=f"Hand.Finger.{digit}.{j}.{side}")
                              for j in range(2)] for digit in paths[side]}
            for vertex in obj.data.vertices:
                total = next((g.weight for g in vertex.groups if g.group == old.index), 0)
                if total <= 0:
                    continue
                co = arm.matrix_world.inverted() @ obj.matrix_world @ vertex.co
                candidates = []
                for digit, (a, b, c) in paths[side].items():
                    d0, t0 = segment_distance(co, a, b)
                    d1, t1 = segment_distance(co, b, c)
                    candidates.append((min(d0, d1), digit, t0 if d0 <= d1 else 1 + t1))
                distance, digit, along = min(candidates)
                a, b, c = paths[side][digit]
                if digit == "thumb":
                    # The thumb emerges at the palm edge. A radial falloff
                    # would leave the outer welded fingertips unarticulated.
                    root = clamp(along * (b - a).length / 0.012)
                    edge = clamp((abs(co.x - arm.data.bones["Hand." + side].head_local.x) - 0.026) / 0.012)
                    fraction = root * edge
                else:
                    fraction = clamp((a.z + 0.005 - co.z) / 0.024)
                distal = clamp((along - 0.82) / 0.36)
                old.remove([vertex.index])
                for group, weight in ((old, total * (1 - fraction)),
                                      (groups[digit][0], total * fraction * (1 - distal)),
                                      (groups[digit][1], total * fraction * distal)):
                    if weight > 0.00001:
                        group.add([vertex.index], weight, "REPLACE")
    for name in added:
        arm.pose.bones[name].rotation_mode = "XYZ"
    arm["handArticulation"] = "Ghibli native finger grip; anatomical wrists with per-clip equipment offsets"
    bpy.context.view_layer.update()
    return added


def orient_toward(bone, goal):
    pivot = bone.head.copy()
    turn = (bone.tail - pivot).normalized().rotation_difference((goal - pivot).normalized())
    bone.matrix = (Matrix.Translation(pivot) @ turn.to_matrix().to_4x4()
                   @ Matrix.Translation(-pivot) @ bone.matrix)
    bpy.context.view_layer.update()


def grip_offset(side, clip):
    """Anatomical wrist relative to the equipment center, Blender Z-up meters."""
    sign = -1 if side == "L" else 1
    return Vector((sign * 0.050, 0, -0.055)) if clip == "pullup" else Vector((-sign * 0.055, 0, 0.058))


def update_manifest_grips(document):
    """Persist only Ghibli's anatomical wrist contract in exported Y-up space."""
    offsets = {clip: [[round(v.x, 6), round(v.z, 6), 0]
                      for v in (grip_offset(side, clip) for side in ("L", "R"))]
               for clip in ("pullup", "dip")}
    entry = next(avatar for avatar in document["avatars"] if avatar["id"] == "ghibli")
    entry["gripWristOffsets"] = offsets
    return offsets


def write_grip_manifest(path):
    document = json.loads(path.read_text(encoding="utf-8"))
    offsets = update_manifest_grips(document)
    path.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    return offsets


def pose_grip(arm, side, clip):
    """Wrap the original finger surfaces around an authored cylindrical grip."""
    pb = arm.pose.bones
    hand = pb["Hand." + side]
    if not pb.get("Hand.Finger.0.0." + side):
        return
    radius = 0.026 if clip == "pullup" else 0.034
    sign = -1 if side == "L" else 1
    xaxis = Vector((0, sign if clip == "pullup" else -sign, 0))
    yaxis = Vector((0, 0, 1)) if clip == "pullup" else Vector((sign, 0, 0))
    zaxis = xaxis.cross(yaxis)
    basis = Matrix((xaxis, yaxis, zaxis)).transposed().to_4x4()
    hand.matrix = Matrix.Translation(hand.matrix.translation) @ basis
    contact_frame = Matrix.Translation(hand.matrix.translation - grip_offset(side, clip)) @ basis
    bpy.context.view_layer.update()
    for digit in digit_paths(arm, side):
        upper = pb[f"Hand.Finger.{digit}.0.{side}"]
        lower = pb[f"Hand.Finger.{digit}.1.{side}"]
        root_local = contact_frame.inverted() @ upper.head
        pad_radius = radius + (0.003 if clip == "pullup" else 0.0045)
        if digit == "thumb":
            local_tip = Vector((-sign * 0.044, pad_radius / math.sqrt(2), pad_radius / math.sqrt(2)))
        else:
            scale = pad_radius / math.hypot(0.90, 0.43)
            local_tip = Vector((root_local.x, 0.90 * scale, 0.43 * scale))
        target = contact_frame @ local_tip
        root = upper.head.copy()
        l1, l2 = upper.length, lower.length
        direction = target - root
        distance = min(direction.length, l1 + l2 - 0.00001)
        direction.normalize()
        along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * max(distance, 0.00001))
        bend = (lower.head - root) if digit == "thumb" else contact_frame.to_3x3() @ Vector((0, 1, 1))
        bend -= direction * bend.dot(direction)
        bend.normalize()
        elbow = root + direction * along + bend * math.sqrt(max(0, l1 * l1 - along * along))
        orient_toward(upper, elbow)
        orient_toward(lower, target)


def solve_fixed_wrist(arm, side, goal):
    """Match the existing stable two-bone elbow solver at the true wrist."""
    pb = arm.pose.bones
    upper, lower, hand = (pb[name + "." + side] for name in ("Arm", "Forearm", "Hand"))
    bpy.context.view_layer.update()
    a, b, c = (bone.head.copy() for bone in (upper, lower, hand))
    target = Vector(goal)
    direction = target - a
    l1, l2 = (b - a).length, (c - b).length
    distance = min(direction.length, l1 + l2 - 0.00001)
    direction.normalize()
    along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * max(distance, 0.00001))
    bend = Vector((-0.7 if side == "L" else 0.7, -0.45, -0.4))
    bend -= direction * bend.dot(direction)
    bend.normalize()
    elbow = a + direction * along + bend * math.sqrt(max(0, l1 * l1 - along * along))
    for bone, child, destination in ((upper, lower, elbow), (lower, hand, target)):
        pivot = bone.head.copy()
        turn = (child.head - pivot).normalized().rotation_difference((destination - pivot).normalized())
        bone.matrix = (Matrix.Translation(pivot) @ turn.to_matrix().to_4x4()
                       @ Matrix.Translation(-pivot) @ bone.matrix)
        bpy.context.view_layer.update()


def rewrite_existing_clips(arm, names):
    """Update a retained source; neutral new joints preserve the other clips."""
    for track in arm.animation_data.nla_tracks:
        track.mute = True
    for track in arm.animation_data.nla_tracks:
        action = track.strips[0].action
        arm.animation_data.action = action
        prior = {}
        frames = range(1, 98) if track.name in ("pullup", "dip") else (1, 97)
        for frame in frames:
            bpy.context.scene.frame_set(frame)
            for name in names:
                bone = arm.pose.bones[name]
                bone.rotation_euler = (0, 0, 0)
                bone.location = (0, 0, 0)
                bone.scale = (1, 1, 1)
            bpy.context.view_layer.update()
            keyed = list(names)
            if track.name in ("pullup", "dip"):
                for side, sign in (("L", -1), ("R", 1)):
                    x, z = (0.30, 2.322) if track.name == "pullup" else (0.43, 1.192)
                    goal = Vector((sign * x, -0.01, z)) + grip_offset(side, track.name)
                    solve_fixed_wrist(arm, side, goal)
                    pose_grip(arm, side, track.name)
                    keyed.extend(name + "." + side for name in ("Arm", "Forearm", "Hand"))
            for name in keyed:
                bone = arm.pose.bones[name]
                if name in prior:
                    bone.rotation_euler.make_compatible(prior[name])
                prior[name] = bone.rotation_euler.copy()
                for path in ("rotation_euler", "location", "scale"):
                    bone.keyframe_insert(data_path=path, frame=frame, group=name)
        arm.animation_data.action = None
    for track in arm.animation_data.nla_tracks:
        track.mute = track.name != "idle"
    bpy.context.scene.frame_set(1)
