"""Exact retained rest-body, finger/limb weights, bones and authored key review."""

import hashlib
import json
import subprocess
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
reference = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--baseline-ref=")), "4767b7805")
output = ROOT / ".jekyll-cache/visual-qa/human-performance"
output.mkdir(parents=True, exist_ok=True)

def fingerprint(source):
    bpy.ops.wm.open_mainfile(filepath=str(source))
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    mesh = bpy.data.objects["SiruiMesh"]
    def digest(value):
        return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()
    keys = [(track.name, [(c.data_path, c.array_index, [(list(k.co), k.interpolation) for k in c.keyframe_points])
                        for strip in track.strips for c in strip.action.fcurves])
            for track in arm.animation_data.nla_tracks]
    body_weights = [[(mesh.vertex_groups[g.group].name, g.weight) for g in v.groups
                     if mesh.vertex_groups[g.group].name != "Head"
                     and not mesh.vertex_groups[g.group].name.startswith("Eye.")]
                    for v in mesh.data.vertices]
    return {"vertices": digest([list(v.co) for v in mesh.data.vertices]),
            "faces": digest([(list(p.vertices), p.material_index) for p in mesh.data.polygons]),
            "limbWeights": digest(body_weights), "keys": digest(keys),
            "bones": digest([(b.name, list(b.head_local), list(b.tail_local), [list(row) for row in b.matrix_local]) for b in arm.data.bones])}

reports = []
for style in ("ghibli", "south-park", "simpsons", "rick-and-morty", "lizard"):
    baseline = output / (style + "-before.blend")
    baseline.write_bytes(subprocess.check_output(["git", "show", reference + ":artwork/coastal-home/sirui-" + style + ".blend"]))
    original = fingerprint(baseline)
    current = fingerprint(ROOT / "artwork/coastal-home" / ("sirui-" + style + ".blend"))
    assert current == original, (style, original, current)
    reports.append({"avatar": style, "exactRetained": current})
report = {"baselineRef": reference, "reports": reports}
(ROOT / "artwork/coastal-home/reviews/character-retained.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
