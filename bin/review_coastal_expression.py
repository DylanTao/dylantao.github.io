"""Exact retained rest-body, finger/limb weights, bones and authored key review."""

import hashlib
import json
import subprocess
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_likeness import STYLES as LIKENESS_STYLES, likeness_vertices
reference = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--baseline-ref=")), "4767b7805")
output = ROOT / ".jekyll-cache/visual-qa/human-performance"
output.mkdir(parents=True, exist_ok=True)

def fingerprint(source, style):
    bpy.ops.wm.open_mainfile(filepath=str(source))
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    mesh = bpy.data.objects["SiruiMesh"]
    def digest(value):
        return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()
    keys = [(track.name, [(c.data_path, c.array_index, [(list(k.co), k.interpolation) for k in c.keyframe_points])
                        for strip in track.strips for c in strip.action.fcurves])
            for track in arm.animation_data.nla_tracks]
    # The October 15 likeness pass replaced the human studies' hair, brows, face skin and mouth
    # (review_coastal_likeness.py checks it); everything else is compared here, in order.
    replaced = (set().union(*likeness_vertices(mesh, arm.data.bones["Eye.R"].head_local.z).values())
                if style in LIKENESS_STYLES else set())
    keep = [v for v in mesh.data.vertices if v.index not in replaced]
    rank = {v.index: n for n, v in enumerate(keep)}
    body_weights = [[(mesh.vertex_groups[g.group].name, g.weight) for g in v.groups
                     if mesh.vertex_groups[g.group].name != "Head"
                     and not mesh.vertex_groups[g.group].name.startswith("Eye.")]
                    for v in keep]
    return {"vertices": digest([list(v.co) for v in keep]),
            "faces": digest([([rank[i] for i in p.vertices], p.material_index) for p in mesh.data.polygons
                             if all(i in rank for i in p.vertices)]),
            "limbWeights": digest(body_weights), "keys": digest(keys),
            "bones": digest([(b.name, list(b.head_local), list(b.tail_local), [list(row) for row in b.matrix_local]) for b in arm.data.bones])}

reports = []
for style in ("ghibli", "south-park", "simpsons", "rick-and-morty", "lizard"):
    baseline = output / (style + "-before.blend")
    baseline.write_bytes(subprocess.check_output(["git", "show", reference + ":artwork/coastal-home/sirui-" + style + ".blend"]))
    original = fingerprint(baseline, style)
    current = fingerprint(ROOT / "artwork/coastal-home" / ("sirui-" + style + ".blend"), style)
    assert current == original, (style, original, current)
    reports.append({"avatar": style, "exactRetained": current})
report = {"baselineRef": reference, "reports": reports}
(ROOT / "artwork/coastal-home/reviews/character-retained.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
