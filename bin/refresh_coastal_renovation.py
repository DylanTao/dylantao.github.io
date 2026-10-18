"""Renovate the coastal home (Sirui, 2026-10-16); see coastal_renovation.py.

Run with Blender 4.5 LTS from the repository root, after bin/refresh_coastal_gym.py:
  blender -b --python-exit-code 1 --python bin/refresh_coastal_renovation.py [-- --preview=DIR]
then bin/bake_coastal_light.py, bin/optimize_coastal_exports.py -- --interiors-only,
bin/review_coastal_models.py and bin/build_coastal_perch_support.py. Every step is idempotent:
re-running brings materials back to the palette and leaves already softened edges alone.
--preview renders every room from its web camera (and the renovation's close views) and saves
nothing.
"""

import json
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_preview as preview
import coastal_renovation as renovation

SOURCE = ROOT / "artwork/coastal-home/coastal-home.blend"
MANIFEST = ROOT / "assets/models/home/manifest.json"
args = {a.split("=", 1)[0][2:]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
preview_dir = args.get("preview")
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
config = json.loads(MANIFEST.read_text(encoding="utf-8"))
report = {}

# 1. Materials: wood, stone, a little metal.
report["palette"] = renovation.apply_palette()

# 2. Edges: smooth shading, weighted normals and rounded corners on every interior mesh.
report["softened"] = renovation.soften_interiors()

if preview_dir:
    out = Path(preview_dir)
    out = out if out.is_absolute() else ROOT / out
    camera = preview.setup(scene, resolution=(1200, 800))
    views = preview.manifest_views(config, orbit=False)
    overview = config["views"]["overview"]
    views["overview"] = preview.room_eye({"target": overview["target"], "camera": overview})
    views.update(
        {
            "study-desk-side": ((2.2, -1.2, 4.3), (-0.4, -3.6, 3.3), 50),
            "kitchen-counter": ((-1.4, 2.6, 2.0), (-4.0, 0.2, 1.0), 55),
            "living-wide": ((-3.0, 4.3, 3.2), (1.5, 0.8, 0.6), 60),
            "gym-room": ((8.3, 4.2, 1.8), (8.9, 0.6, 1.0), 60),
            "gym-rack": ((7.4, 2.2, 1.5), (7.0, -0.4, 0.6), 60),
            "gym-tree": ((8.6, 3.2, 1.4), (6.95, 2.95, 0.6), 55),
        }
    )
    print(json.dumps({k: (len(v) if isinstance(v, (list, dict)) else v) for k, v in report.items()}), flush=True)
    print("RENDERED", preview.render(scene, camera, views, out), flush=True)
    sys.exit(0)

scene["renovation"] = 1
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
(ROOT / "artwork/coastal-home/reviews/renovation.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({k: (len(v) if isinstance(v, (list, dict)) else v) for k, v in report.items()}), flush=True)
