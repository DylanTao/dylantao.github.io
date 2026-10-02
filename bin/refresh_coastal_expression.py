"""Augment the five retained sources with compact, original facial morphs."""

import hashlib
import gzip
import json
import sys
import subprocess
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_expression import install_expression

report = []
baseline_ref = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--baseline-ref=")), None)
requested = {a.split("=", 1)[1] for a in sys.argv if a.startswith("--avatar=")}
output = ROOT / "artwork/coastal-home/reviews/character-expression.json"
previous = json.loads(output.read_text()) if requested and output.exists() else []
for style in ("ghibli", "south-park", "simpsons", "rick-and-morty", "lizard"):
    if requested and style not in requested:
        continue
    source = ROOT / "artwork/coastal-home" / ("sirui-" + style + ".blend")
    target = ROOT / "assets/models/home" / ("sirui-" + style + ".glb")
    before_blob = (subprocess.check_output(["git", "show", baseline_ref + ":assets/models/home/sirui-" + style + ".glb"])
                   if baseline_ref else target.read_bytes())
    before = len(before_blob)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    mesh = bpy.data.objects["SiruiMesh"]
    def retained():
        return hashlib.sha256(b"".join(bytes(str(tuple(v.co)), "ascii") for v in mesh.data.vertices)).hexdigest()
    before_mesh = retained()
    detail = install_expression(arm)
    assert retained() == before_mesh, "Existing body/hand/head vertices changed"
    assert len(arm.animation_data.nla_tracks) == 14
    for track in arm.animation_data.nla_tracks:
        track.mute = track.name != "idle"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
    for track in arm.animation_data.nla_tracks:
        track.mute = False
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    for child in arm.children:
        if child.type == "MESH":
            child.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(target), export_format="GLB", use_selection=True,
        export_yup=True, export_animations=True, export_animation_mode="NLA_TRACKS",
        export_force_sampling=True, export_extras=True, export_cameras=False,
        export_lights=False, export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7, export_draco_position_quantization=14,
        export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
    )
    report.append({"avatar": style, "beforeBytes": before, "afterBytes": target.stat().st_size,
                   "beforeGzipEquivalent": len(gzip.compress(before_blob)),
                   "afterGzipEquivalent": len(gzip.compress(target.read_bytes())),
                   "retainedVertexHash": before_mesh, "clips": 14, **detail})
if previous:
    updated = {entry["avatar"]: entry for entry in report}
    report = [updated.pop(entry["avatar"], entry) for entry in previous] + list(updated.values())
output.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
