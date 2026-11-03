"""Replay the additive footrest on an explicitly pinned private descendant."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def validate_paths(repo, source, source_sha256, output, report):
    repo, source, output, report = (Path(p).resolve() for p in (repo, source, output, report))
    qa = repo / ".jekyll-cache" / "visual-qa"
    if not re.fullmatch("[0-9a-f]{64}", source_sha256) or not source.is_file() or digest(source) != source_sha256:
        raise ValueError("The coordinator-provided source SHA must match the actual input")
    if source.suffix != ".blend" or output.suffix != ".blend" or report.suffix != ".json":
        raise ValueError("Expected native source/output and a JSON receipt")
    if source == output or output.exists() or report.exists():
        raise ValueError("Use new private output and receipt paths; no replacement")
    if not output.is_relative_to(qa) or not report.is_relative_to(qa):
        raise ValueError("Outputs must remain inside the explicitly named repo's visual QA directory")
    return source, output, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--source-sha256", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None)
    source, output, report = validate_paths(args.repo_root, args.source, args.source_sha256, args.output, args.report)
    import bpy
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("This owning recipe requires Blender 4.5.9")
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import coastal_pavilion_breakfast as footrest
    bpy.ops.wm.open_mainfile(filepath=str(source))
    result = footrest.build(bpy.context.scene)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    bpy.ops.wm.open_mainfile(filepath=str(output))
    bpy.context.view_layer.update()
    changed = [name for name, expected in result["oldMeshDigests"].items()
               if not bpy.data.objects.get(name) or footrest._mesh_digest(bpy.data.objects[name]) != expected]
    if changed:
        raise RuntimeError(f"Saved/reopened descendant changed old mesh fields: {changed}")
    if digest(source) != args.source_sha256:
        raise RuntimeError("Input bytes changed during the replay")
    result.update(source=str(source), sourceSha256=args.source_sha256, output=str(output), outputSha256=digest(output),
                  helperSha256=digest(footrest.__file__), producerSha256=digest(__file__), blender=list(bpy.app.version),
                  savedReopenOldFieldsExact=True, nativeOnly=True, aoNotRun=True, exportNotRun=True)
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf8", newline="\n")
    print(json.dumps({"report": str(report), "outputSha256": result["outputSha256"],
                      "oldMeshesExact": result["oldMeshesExact"], "triangles": result["triangles"]}))


if __name__ == "__main__":
    main()
