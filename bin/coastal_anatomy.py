"""Adult rest proportions without changing the named rig or activity endpoints.

The miniature's original rig used short lower legs and torso. This authored
rest-space edit retains feet, hands, head features and skin weights at their
physical size, then the build script rebakes its existing contact clips.
"""

import bpy


def adult_height(z):
    levels = ((0.075, 0.075), (0.365, 0.44), (0.68, 0.86), (1.12, 1.36))
    if z <= levels[0][0]:
        return z
    for (a, aa), (b, bb) in zip(levels, levels[1:]):
        if z <= b:
            return aa + (z - a) * (bb - aa) / (b - a)
    return z + 0.24


def fit_adult_rest(arm):
    """Lengthen the long bones, preserving the size of contact extremities."""
    hand_shift = adult_height(0.61) - 0.61
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.parent != arm:
            continue
        names = {group.index: group.name for group in obj.vertex_groups}
        world, inverse = obj.matrix_world.copy(), obj.matrix_world.inverted()
        for vertex in obj.data.vertices:
            co = world @ vertex.co
            original_z = co.z
            weights = {names[g.group]: g.weight for g in vertex.groups}
            hand = sum(w for n, w in weights.items() if n.startswith("Hand."))
            foot = sum(w for n, w in weights.items() if n.startswith("Foot."))
            head = sum(w for n, w in weights.items() if n == "Head" or n.startswith("Eye."))
            mapped = adult_height(co.z)
            # A scale of the entire figure would enlarge the palms and shoes.
            # Blend to rigid translations over their existing skin weights.
            co.z = mapped * (1 - hand - foot - head)
            co.z += (original_z + hand_shift) * hand
            co.z += original_z * foot + (original_z + 0.24) * head
            vertex.co = inverse @ co
        obj.data.update()
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for bone in arm.data.edit_bones:
        if bone.name == "Root" or bone.name.startswith("Foot."):
            continue
        for point in (bone.head, bone.tail):
            if bone.name.startswith("Hand."):
                point.z += hand_shift
            elif bone.name == "Head" or bone.name.startswith("Eye."):
                point.z += 0.24
            else:
                point.z = adult_height(point.z)
    bpy.ops.object.mode_set(mode="OBJECT")
    arm["anatomy"] = "Adult long-bone proportions; unchanged hand and foot scale"
    bpy.context.view_layer.update()
