"""Refresh the retained neutral-baked house without rebuilding its geometry.

Run with Blender 4.5 LTS, then optimize_coastal_exports.py -- --interiors-only.
The full house builder applies these same finishes before its initial save.
"""

import hashlib
import json
import struct
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_finishes import apply_finishes, separate_retained_mug


def geometry_hash():
    digest = hashlib.sha256()
    for obj in sorted(bpy.context.scene.objects, key=lambda o: o.name):
        digest.update(obj.name.encode())
        for row in obj.matrix_world:
            digest.update(struct.pack("<4f", *row))
        if obj.type == "MESH":
            for v in obj.data.vertices:
                digest.update(struct.pack("<3f", *v.co))
            for face in obj.data.polygons:
                digest.update(struct.pack("<I", len(face.vertices)))
                digest.update(struct.pack("<" + "I" * len(face.vertices), *face.vertices))
    return digest.hexdigest()


def material(name, color, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    bs = mat.node_tree.nodes["Principled BSDF"]
    bs.inputs["Base Color"].default_value = mat.diffuse_color
    bs.inputs["Roughness"].default_value = roughness
    return mat


source = ROOT / "artwork/coastal-home/coastal-home.blend"
bpy.ops.wm.open_mainfile(filepath=str(source))
before = geometry_hash()
ceramic_faces = separate_retained_mug(material)
updated = apply_finishes()
after = geometry_hash()
assert before == after, "Material refresh changed authored geometry or anchors"
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
report = {"method": "PBR-only refresh; retained neutral vertex-contact bake",
          "geometrySha256Before": before, "geometrySha256After": after,
          "updatedMaterials": updated, "mugFacesReassigned": ceramic_faces}
(ROOT / "artwork/coastal-home/reviews/warm-finishes.json").write_text(
    json.dumps(report, indent=2) + "\n")
print(json.dumps(report), flush=True)
