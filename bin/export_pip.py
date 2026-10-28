"""Compress the retained P model; do not regenerate or resave its native source."""
import hashlib
import json
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from pip_model_export import export_model

options = dict(arg[2:].split("=", 1) for arg in sys.argv if arg.startswith("--") and "=" in arg)
source = Path(options.get("source", ROOT / "artwork/pip/pip.blend"))
destination = Path(options.get("out", ROOT / ".jekyll-cache/visual-qa/pip-compression/pip.glb"))
before = hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
destination.parent.mkdir(parents=True, exist_ok=True)
export_model(destination)
assert hashlib.sha256(source.read_bytes()).hexdigest() == before
print(json.dumps({"sourceSha256": before, "bytes": destination.stat().st_size,
                  "outputSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
                  "output": str(destination), "blender": bpy.app.version_string}, indent=2))
