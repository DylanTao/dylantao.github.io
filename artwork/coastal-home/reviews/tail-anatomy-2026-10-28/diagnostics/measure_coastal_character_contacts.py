"""Read-only native seat-patch measurements in each retained lounge clip.

Use Blender 4.5.9. Writes a receipt only; no source, mesh or animation is saved.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
STYLES = ("lizard", "south-park", "simpsons", "ghibli", "rick-and-morty")
PROXIMAL = .45
SAMPLES = 13


def main():
    assert bpy.app.version == (4, 5, 9), bpy.app.version_string
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT / "artwork/coastal-home")
    parser.add_argument("--master", type=Path, help="Measure the five tagged scenes in the final character library")
    parser.add_argument("--out", type=Path, default=ROOT / ".jekyll-cache/visual-qa/character-finish-2026-10-26/native-seat-contacts.json")
    opts = parser.parse_args(args)
    opts.source_dir = opts.source_dir.resolve()
    opts.master = opts.master.resolve() if opts.master else None
    opts.out = opts.out.resolve()
    receipt = {"blender": bpy.app.version_string, "units": "metres", "scope": "13 sampled native lounge frames, not a continuous contact guarantee", "proximalHipToKneeFraction": PROXIMAL, "avatars": {}}
    for style in STYLES:
        source = opts.master or opts.source_dir / f"sirui-{style}.blend"
        before = hashlib.sha256(source.read_bytes()).hexdigest()
        bpy.ops.wm.open_mainfile(filepath=str(source))
        if opts.master:
            bpy.context.window.scene = next(scene for scene in bpy.data.scenes if scene.get("finishAvatar") == style)
        arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
        chosen = []
        for mesh in (o for o in arm.children if o.type == "MESH"):
            names = {g.index: g.name for g in mesh.vertex_groups}
            pants = {vi: re.sub(r"\.\d{3}$", "", mesh.data.materials[p.material_index].name) for p in mesh.data.polygons if re.sub(r"\.\d{3}$", "", mesh.data.materials[p.material_index].name) in ("olive trousers", "charcoal shorts") for vi in p.vertices}
            patch = {}
            for i in sorted(pants):
                vertex = mesh.data.vertices[i]
                group = max(vertex.groups, key=lambda g: g.weight, default=None)
                bone = names[group.group] if group else ""
                fraction = None
                if bone in ("Thigh.L", "Thigh.R"):
                    rest = arm.data.bones[bone]
                    head, tail = arm.matrix_world @ rest.head_local, arm.matrix_world @ rest.tail_local
                    axis = tail - head
                    fraction = ((mesh.matrix_world @ vertex.co) - head).dot(axis) / axis.length_squared
                    if fraction > PROXIMAL:
                        continue
                elif bone != "Hips":
                    continue
                patch[i] = {"bone": bone, "material": pants[i], "hipToKneeFraction": fraction}
            if patch:
                chosen.append((mesh, patch))
        assert chosen
        track = next(t for t in arm.animation_data.nla_tracks if t.name == "lounge")
        for t in arm.animation_data.nla_tracks:
            t.mute = t.name != "lounge"
        strip = track.strips[0]
        frames = [strip.frame_start + (strip.frame_end - strip.frame_start) * i / (SAMPLES - 1) for i in range(SAMPLES)]
        fps = bpy.context.scene.render.fps / bpy.context.scene.render.fps_base
        samples = []
        for frame in frames:
            bpy.context.scene.frame_set(int(frame), subframe=frame - int(frame))
            points = []
            for mesh, patch in chosen:
                evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
                me = evaluated.to_mesh()
                for i, spec in patch.items():
                    p = evaluated.matrix_world @ me.vertices[i].co
                    points.append({"mesh": mesh.get("finishCanonicalName", mesh.name), "vertex": i, "point": [p.x, p.z, -p.y], **spec})
                evaluated.to_mesh_clear()
            points.sort(key=lambda p: p["point"][1])
            minimum = points[0]["point"][1]
            samples.append({"frame": frame, "secondsFromStripStart": (frame - strip.frame_start) / fps, "minY": minimum, "witnesses": [p for p in points if p["point"][1] <= minimum + .002], "patchPoints": [p["point"] for p in points]})
        assert hashlib.sha256(source.read_bytes()).hexdigest() == before
        entry = {"sourceSha256": before, "sourceFile": str(source.relative_to(ROOT)).replace("\\", "/") if source.is_relative_to(ROOT) else source.name, "sourceScene": bpy.context.scene.name, "fps": fps, "stripFrames": [strip.frame_start, strip.frame_end], "sampledFrames": frames, "minYRange": [min(s["minY"] for s in samples), max(s["minY"] for s in samples)], "patchVertices": sum(len(patch) for _, patch in chosen), "samples": samples}
        receipt["avatars"][style] = entry
        print("NATIVE-SEAT", style, entry["minYRange"], entry["patchVertices"], flush=True)
    opts.out.parent.mkdir(parents=True, exist_ok=True)
    opts.out.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
