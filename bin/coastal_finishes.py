"""Quiet warm finishes on the original coastal-home meshes.

Values are linear RGB. Material names stay stable for the web renderer; the
glaze is authored PBR data rather than a downloaded texture or added shader.
"""

import bpy


FINISHES = {
    "honey ash": ((0.115, 0.049, 0.018), 0.41, 0),
    "pale oak": ((0.29, 0.175, 0.08), 0.48, 0),
    "chalk limestone": ((0.72, 0.66, 0.53), 0.91, 0),
    "warm cut stone": ((0.46, 0.40, 0.305), 0.88, 0),
    "smoked olive cabinetry": ((0.15, 0.225, 0.18), 0.60, 0),
    "brushed brass": ((0.43, 0.245, 0.075), 0.31, 0),
    "warm glazed porcelain": ((0.61, 0.68, 0.58), 0.20, 0.4),
    "hand glazed celadon": ((0.18, 0.32, 0.265), 0.19, 0.45),
}


def celadon(make_material):
    color, roughness, _ = FINISHES["hand glazed celadon"]
    return make_material("hand glazed celadon", color, roughness)


def apply_finishes():
    """Update PBR data without moving geometry, contacts or baked occlusion."""
    updated = []
    for name, (color, roughness, coat) in FINISHES.items():
        mat = bpy.data.materials.get(name)
        if not mat:
            continue
        mat.diffuse_color = (*color, 1)
        bs = mat.node_tree.nodes.get("Principled BSDF")
        bs.inputs["Base Color"].default_value = mat.diffuse_color
        bs.inputs["Roughness"].default_value = roughness
        bs.inputs["Coat Weight"].default_value = coat
        bs.inputs["Coat Roughness"].default_value = 0.16
        updated.append(name)
    return updated


def separate_retained_mug(make_material):
    """Migrate the retained batched mug from linen to its own ceramic finish.

    The footprint is the authored mug and handle after the study room offset.
    Reassign only their existing polygons, leaving all mesh coordinates intact.
    A fresh house build creates the ceramic directly in coastal_craft.py.
    """
    obj = bpy.data.objects.get("study__linen")
    if not obj:
        return 0
    glaze = bpy.data.materials.get("hand glazed celadon") or celadon(make_material)
    index = next((i for i, m in enumerate(obj.data.materials) if m == glaze), None)
    if index is None:
        index = len(obj.data.materials)
        obj.data.materials.append(glaze)
    changed = 0
    for face in obj.data.polygons:
        center = obj.matrix_world @ face.center
        if (-1.409 < center.x < -1.225 and -2.912 < center.y < -2.748
                and 3.48 < center.z < 3.645):
            if face.material_index != index:
                face.material_index = index
                changed += 1
    return changed
