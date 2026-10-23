"""Furniture anchors and their placeholders (the house side of the furniture interface, 2026-10-20).

scene-furniture builds the designed pieces (the Eames lounge, the Aeron, the dining set, the Italian
range, its hood and pot filler, the glass refrigerator, the floating fireplace, the cast-iron pan and
dumbbells) as GLBs listed in assets/models/home/furniture/index.json. The house says where each one
stands: the manifest's "furniture" list holds one anchor per piece,

    {"id": "<unique anchor id>", "item": "<index key>", "room": "<room id>", "position": [x, y, z], "yaw": rad}

in the manifest's own frame (three.js metres: x, up, -Blender y; the position is the item's floor-contact
centre) with yaw about +Y in the house's facing convention (an actor's rotation.y): at yaw 0 an item's
front faces +Z, and its front faces [sin(yaw), 0, cos(yaw)]. The runtime turns each item so that its
index.json "front" axis is that front.

Every anchor also keeps a simple placeholder in its room's GLB, an object carrying the custom property
furniturePlaceholder = "<anchor id>" (glTF extras, three.js userData), so the room still reads if an item
fails to load; the furniture runtime hides it once the item is ready. Placeholders are deliberately plain:
the right footprint, height and material family, not a model of the product.

House coordinates here are Blender's (metres, Z up, +Y toward the sea, +X north).
"""

import math
import bmesh
import bpy
from mathutils import Matrix, Vector

from coastal_landscape import web


def blender_yaw_to_three(facing_blender):
    """Yaw (three.js rotation.y) that turns an item's +Z front to face the Blender plan direction
    `facing_blender` (dx, dy). Three's +Z is Blender -Y, so a front facing the sea (Blender +Y) is yaw pi."""
    dx, dy = facing_blender
    # three direction = (dx, -dy); yaw = atan2(x, z)
    return math.atan2(dx, -dy)


class Placeholder:
    """Geometry for one anchor's placeholder, per material; finish() makes one object (one node in
    the GLB) named <room>_placeholder_<anchor>, carrying furniturePlaceholder."""

    def __init__(self, room, anchor):
        self.room, self.anchor = room, anchor
        self.groups = {}

    def bm(self, mat):
        if mat.name not in self.groups:
            self.groups[mat.name] = (mat, bmesh.new())
        return self.groups[mat.name][1]

    def finish(self, collection=None):
        bm = bmesh.new()
        materials = []
        for name, (mat, part) in self.groups.items():
            if not part.verts:
                part.free()
                continue
            index = len(materials)
            materials.append(mat)
            data = bpy.data.meshes.new("tmp")
            part.to_mesh(data)
            part.free()
            for poly in data.polygons:
                poly.material_index = index
            bm.from_mesh(data)
            bpy.data.meshes.remove(data)
        name = f"{self.room}_placeholder_{self.anchor}"
        data = bpy.data.meshes.new(name)
        bm.to_mesh(data)
        bm.free()
        for mat in materials:
            data.materials.append(mat)
        for poly in data.polygons:
            poly.use_smooth = True
        obj = bpy.data.objects.new(name, data)
        (collection or bpy.context.collection).objects.link(obj)
        obj["furniturePlaceholder"] = self.anchor
        return obj


def anchor_entry(anchor, item, room, position, facing_blender=None, yaw=None):
    """A manifest furniture anchor from a Blender floor point and a plan facing (or an explicit yaw)."""
    if yaw is None:
        yaw = blender_yaw_to_three(facing_blender)
    return {
        "id": anchor,
        "item": item,
        "room": room,
        "position": [round(v, 4) for v in web(position)],
        "yaw": round(yaw, 4),
    }


def remove_placeholders(scene, room=None, anchors=None):
    """Remove earlier placeholders (all, one room's, or the given anchors') before rebuilding them."""
    removed = 0
    for obj in list(scene.objects):
        key = obj.get("furniturePlaceholder")
        if not key:
            continue
        if room and not obj.name.startswith(room + "_"):
            continue
        if anchors is not None and key not in anchors:
            continue
        bpy.data.objects.remove(obj, do_unlink=True)
        removed += 1
    return removed


def merge_anchors(config, entries):
    """Replace the manifest's anchors that share an id with `entries`, keeping the others in order."""
    existing = config.get("furniture") or []
    ids = {e["id"] for e in entries}
    kept = [e for e in existing if e["id"] not in ids]
    config["furniture"] = kept + entries
    config["furnitureFrame"] = {
        "position": "three.js metres (x, up, -Blender y); the item's floor-contact centre",
        "yaw": "radians about +Y in the house's facing convention: at yaw 0 an item's front faces +Z; its front faces [sin(yaw), 0, cos(yaw)]",
        "placeholder": "each anchor's room GLB holds an object whose extras carry furniturePlaceholder = the anchor id",
    }
    return config["furniture"]
