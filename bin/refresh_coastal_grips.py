"""Focused Ghibli hand source/export update; no house or other avatar rebuild.

Run on an unarticulated source, --repose after grip fitting changes, or
--export-only on the retained result.
The full authoring path is build_coastal_home.py -- --avatar=ghibli.
The runtime must consume the same per-avatar wrist offsets before acceptance.
"""

import json
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_hands import install_hand_rig, rewrite_existing_clips, write_grip_manifest

source = ROOT / "artwork/coastal-home/sirui-ghibli.blend"
bpy.ops.wm.open_mainfile(filepath=str(source))
arm = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
if "--export-only" not in sys.argv:
    if "--repose" in sys.argv:
        names = [bone.name for bone in arm.data.bones if bone.name.startswith("Hand.Finger.")]
        assert len(names) == 20, "Expected the articulated source"
    else:
        names = install_hand_rig(arm, "ghibli")
    rewrite_existing_clips(arm, names)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
else:
    assert arm.data.bones.get("Hand.Finger.0.0.L"), "Expected the articulated source"
for track in arm.animation_data.nla_tracks:
    track.mute = False
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=str(ROOT / "assets/models/home/sirui-ghibli.glb"),
    export_format="GLB", use_selection=True, export_yup=True,
    export_animations=True, export_animation_mode="NLA_TRACKS",
    export_force_sampling=True, export_extras=True,
    export_cameras=False, export_lights=False,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=12,
)
offsets = write_grip_manifest(ROOT / "assets/models/home/manifest.json")
print(json.dumps({"gripWristOffsets": offsets, "rigBones": len(arm.data.bones),
                  "bytes": (ROOT / "assets/models/home/sirui-ghibli.glb").stat().st_size}, indent=2))
