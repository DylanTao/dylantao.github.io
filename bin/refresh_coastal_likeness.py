"""Apply the October 15 likeness pass to the four retained human sources and re-export them.

Replaces only hair, brows, face skin and mouth (bin/coastal_likeness.py), saves each editable
source on its idle track, exports its GLB with the same Draco settings as the other focused
refreshes, renders the model-review portraits with the existing render_portrait path, and
records bytes in artwork/coastal-home/reviews/character-likeness.json. The Lizard has no 2D
reference and is not touched. Run from the repository root with Blender 4.5 LTS:

  blender -b --python-exit-code 1 --python bin/refresh_coastal_likeness.py -- --baseline-ref=f403dfead
  blender -b --python-exit-code 1 --python bin/review_coastal_likeness.py -- --baseline-ref=f403dfead

Options: --avatar=<style> (repeatable), --no-portraits. Re-running is idempotent: the pass
finds and replaces its own head features.
"""

import gzip
import json
import subprocess
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_likeness import STYLES, install_likeness
from coastal_sculpt import render_portrait

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
baseline_ref = next((a.split("=", 1)[1] for a in args if a.startswith("--baseline-ref=")), None)
requested = [a.split("=", 1)[1] for a in args if a.startswith("--avatar=")] or list(STYLES)
assert set(requested) <= set(STYLES), requested
output = ROOT / "artwork/coastal-home/reviews/character-likeness.json"
previous = json.loads(output.read_text())["avatars"] if output.exists() else []
report = []


def triangles(path):
    data = path.read_bytes()
    length = int.from_bytes(data[12:16], "little")
    document = json.loads(data[20:20 + length])
    return sum(document["accessors"][p["indices"]]["count"] // 3 for m in document["meshes"] for p in m["primitives"])


for style in requested:
    source = ROOT / "artwork/coastal-home" / f"sirui-{style}.blend"
    target = ROOT / "assets/models/home" / f"sirui-{style}.glb"
    if baseline_ref:
        before_blob = subprocess.check_output(["git", "show", f"{baseline_ref}:assets/models/home/sirui-{style}.glb"], cwd=ROOT)
    else:
        before_blob = target.read_bytes()
    before_path = ROOT / ".jekyll-cache" / f"likeness-before-{style}.glb"
    before_path.parent.mkdir(exist_ok=True)
    before_path.write_bytes(before_blob)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    detail = install_likeness(arm, style)
    assert len(arm.animation_data.nla_tracks) == 14
    for track in arm.animation_data.nla_tracks:
        track.mute = track.name != "idle"
    bpy.context.scene.frame_set(1)
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
    after_blob = target.read_bytes()
    report.append({
        **detail,
        "beforeBytes": len(before_blob), "afterBytes": len(after_blob),
        "beforeGzipEquivalent": len(gzip.compress(before_blob)),
        "afterGzipEquivalent": len(gzip.compress(after_blob)),
        "beforeTriangles": triangles(before_path), "afterTriangles": triangles(target),
        "clips": len(arm.animation_data.nla_tracks),
    })
    before_path.unlink()
    print(json.dumps(report[-1]), flush=True)
    if "--no-portraits" not in args:
        # The builder's model-review studies: idle track, frame 1, after the source is saved.
        for track in arm.animation_data.nla_tracks:
            track.mute = track.name != "idle"
        bpy.context.scene.frame_set(1)
        render_portrait(arm, style, ROOT / "artwork/coastal-home")

updated = {entry["avatar"]: entry for entry in report}
merged = [updated.pop(entry["avatar"], entry) for entry in previous] + list(updated.values())
output.write_text(json.dumps({
    "pass": "October 15 reference likeness: hair, brows, face skin and open expression",
    "references": {
        "ghibli": "assets/img/sirui_pic_ghbili.png", "south-park": "assets/img/sirui_pic_south_park.png",
        "simpsons": "assets/img/sirui_pic_simpsons.png", "rick-and-morty": "assets/img/sirui_pic_rick_and_morty.png",
    },
    "baselineRef": baseline_ref,
    "computedGzipNote": "Computed gzip equivalents of the GLB bytes, not measured HTTP transfer.",
    "avatars": merged,
}, indent=2) + "\n")
print(output, flush=True)
