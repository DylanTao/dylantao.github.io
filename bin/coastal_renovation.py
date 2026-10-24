"""The coastal home's renovation (Sirui, 2026-10-16), as if a team of interior architects had been
invited in: "nice yet cozy ... without too busy material palettes, like wooden and stone as two main
ones, and some interesting shiny metal finishes, with some occasional color pop".

Materials. Two families carry the house: wood (light natural oak for floors, joinery and furniture,
with a smoked-oak accent for frames, rails and legs; hinoki-pale slats for the screens) and stone
(lime plaster on every wall, honed limestone, travertine and a milky veined marble for the desk and
kitchen). Polished nickel and brushed brass are the metals, used sparingly; terracotta, ochre, sage
and a deep indigo are the colour pops, kept to textiles, ceramics and art. The plaster, marble and
travertine read through the runtime's procedural shading in assets/js/home-scene/realism.mjs, keyed
by material name, so no texture is downloaded.

Edges. Every box-built piece of furniture was flat shaded, so its bevels read as a run of creases.
soften() shades each interior mesh smooth, keeps only true corners sharp and recomputes weighted
normals; unbevelled corners (slats, frames, steel, wall ends) get a small rounded bevel first.

House coordinates are Blender's: metres, Z up, +Y toward the sea (west), +X north.
"""

import math
import bmesh
import bpy
from mathutils import Matrix, Vector

# Linear RGB, roughness, metallic, coat. Material names stay stable for the web renderer.
PALETTE = {
    # Wood
    "pale oak": ((0.47, 0.32, 0.175), 0.5, 0.0, 0.0),
    "honey ash": ((0.13, 0.085, 0.055), 0.45, 0.0, 0.0),
    "cedar wood": ((0.6, 0.46, 0.29), 0.6, 0.0, 0.0),
    # Stone
    "chalk limestone": ((0.74, 0.69, 0.585), 0.7, 0.0, 0.0),
    "warm cut stone": ((0.56, 0.5, 0.41), 0.6, 0.0, 0.0),
    "travertine paving stone": ((0.79, 0.71, 0.59), 0.62, 0.0, 0.0),
    # Metal
    "brushed brass": ((0.55, 0.37, 0.14), 0.3, 0.9, 0.0),
}
NEW_MATERIALS = {
    "polished nickel": ((0.8, 0.77, 0.72), 0.14, 1.0, 0.0),
    "milky veined marble": ((0.86, 0.85, 0.82), 0.24, 0.0, 0.0),
    "honed limestone": ((0.66, 0.61, 0.52), 0.55, 0.0, 0.0),
    "indigo textile": ((0.03, 0.045, 0.13), 0.9, 0.0, 0.0),
    "ochre textile": ((0.55, 0.33, 0.08), 0.9, 0.0, 0.0),
}


def material(name, refresh=True):
    """A palette material, created when missing and (by default) brought to its palette values."""
    spec = PALETTE.get(name) or NEW_MATERIALS.get(name)
    mat = bpy.data.materials.get(name)
    if mat and not refresh:
        return mat
    mat = mat or bpy.data.materials.new(name)
    color, roughness, metallic, coat = spec
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Coat Weight"].default_value = coat
    return mat


def apply_palette():
    updated = []
    for name in list(PALETTE) + list(NEW_MATERIALS):
        if name in PALETTE and not bpy.data.materials.get(name):
            continue
        material(name)
        updated.append(name)
    return updated


# Edges ----------------------------------------------------------------------------------------

ROOM_PREFIXES = ("core_", "study_", "kitchen_", "lounge_", "sleep_", "gym_", "onsen_", "bath-living_", "bath-bedroom_")
# Organic, sculpted or carved meshes keep their authored normals; glass, water and paper stay flat.
KEEP = ("golden coastal sandstone", "liftaway", "shadow_vault", "flora", "duvet", "pillow", "water", "whiteboard_face")
FLAT_MATERIALS = ("glass", "leaf", "foliage", "paper", "canvas", "cork", "embers", "bulb", "cable", "water", "turquoise")


def _apply(obj, modifier):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def bevel_corners(obj, offset, angle=math.radians(70), min_length=None):
    """Round every unbevelled corner sharper than `angle` with a two-segment bevel."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    min_length = min_length if min_length is not None else offset * 2.5
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > angle and e.calc_length() > min_length]
    if edges:
        bmesh.ops.bevel(bm, geom=edges, offset=offset, offset_type="OFFSET", segments=2, profile=0.5, affect="EDGES", clamp_overlap=True)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return len(edges)


def soften(obj, bevel=0.0, angle=48):
    """Smooth shading with weighted normals; corners sharper than `angle` degrees stay crisp."""
    beveled = bevel_corners(obj, bevel) if bevel else 0
    me = obj.data
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(angle))
    modifier = obj.modifiers.new("soft weighted normals", "WEIGHTED_NORMAL")
    modifier.keep_sharp = True
    modifier.mode = "FACE_AREA"
    modifier.weight = 50
    _apply(obj, modifier)
    return beveled


# Unbevelled pieces and the radius their corners get (metres). Matched on the object name.
BEVELS = (
    ("cedar", 0.005),
    ("gym__powder coated gym steel", 0.004),
    ("gym__barbell brushed steel", 0.002),
    ("gym__gym rubber", 0.003),
    ("gym__satin appliance stainless", 0.003),
    ("gym__charcoal", 0.003),
    ("gym__sage textile", 0.002),
    ("gym__honey ash", 0.003),
    ("gym__terracotta", 0.002),
    ("core__chalk limestone", 0.018),
    ("core_facade__dark_bronze", 0.004),
    ("core_facade_door_", 0.004),
    ("core_gym_front_frame", 0.004),
    ("decor pale oak", 0.004),
    ("lounge_living__", 0.004),
    ("kitchen__warm cut stone", 0.004),
    ("core_facade__weathered_teak_wood", 0.004),
    ("core_facade__travertine_paving_stone", 0.006),
    ("core_facade__warm_cut_stone", 0.01),
)


def soften_interiors(objects=None):
    report = {}
    for obj in objects or list(bpy.context.scene.objects):
        if obj.type != "MESH" or not obj.name.startswith(ROOM_PREFIXES) or not obj.data.polygons:
            continue
        if any(k in obj.name for k in KEEP) or obj.get("flora"):
            continue
        names = [m.name for m in obj.data.materials if m]
        if any(any(f in n for f in FLAT_MATERIALS) for n in names):
            continue
        bevel = next((r for key, r in BEVELS if key in obj.name), 0.0)
        before = len(obj.data.vertices)
        beveled = soften(obj, bevel)
        report[obj.name] = {"bevelledEdges": beveled, "bevel": bevel, "vertices": [before, len(obj.data.vertices)]}
        obj["softened"] = True
    return report
