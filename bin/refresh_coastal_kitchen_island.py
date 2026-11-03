"""Replay the exact island-only delta on an explicitly pinned private source."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--source-sha256", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None)
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from refresh_coastal_pavilion_breakfast import validate_paths, digest
    source, output, report = validate_paths(args.repo_root, args.source, args.source_sha256, args.output, args.report)
    import bpy
    import coastal_kitchen_island as island
    import coastal_pavilion_chair as custody
    from coastal_pavilion_breakfast import _mesh_digest
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("This exact recipe requires Blender 4.5.9")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    result = island.build(bpy.context.scene)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    bpy.ops.wm.open_mainfile(filepath=str(output))
    bpy.context.view_layer.update()
    roster = {o.name for o in bpy.context.scene.objects if o.type == "MESH"}
    if roster != set(result["expectedSavedMeshDigests"]):
        raise RuntimeError("Saved native object roster changed")
    for name, expected in result["expectedSavedMeshDigests"].items():
        if _mesh_digest(bpy.data.objects[name]) != expected:
            raise RuntimeError(f"Saved/reopened field change: {name}")
    if digest(source) != args.source_sha256:
        raise RuntimeError("Original source bytes changed")
    result.update(source=str(source), sourceSha256=args.source_sha256, output=str(output), outputSha256=digest(output),
                  blender=list(bpy.app.version), savedReopenExact=True, manifestUntouched=True,
                  dependencies={str(p): digest(p) for p in (Path(__file__), Path(island.__file__), Path(custody.__file__),
                                                           Path(custody.__file__).with_name("coastal_pavilion_breakfast.py"),
                                                           Path(__file__).with_name("refresh_coastal_pavilion_breakfast.py"))})
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf8", newline="\n")
    print(json.dumps({"outputSha256": result["outputSha256"], "unownedMeshesExact": len(result["unownedMeshesExact"]),
                      "newNodes": result["newNodes"], "netTriangles": result["netTriangles"]}))


if __name__ == "__main__":
    main()
