"""Refresh authored camera metadata without resaving or modifying native meshes."""
import argparse
import hashlib
import json
from pathlib import Path

from coastal_camera import finish_room_arrivals

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--manifest", type=Path, default=ROOT / "assets/models/home/manifest.json")
parser.add_argument("--apply", action="store_true")
args = parser.parse_args()
before = args.manifest.read_bytes()
config = json.loads(before)
changes = finish_room_arrivals(config)
if args.apply:
    args.manifest.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"manifest": str(args.manifest), "applied": args.apply,
                  "beforeSha256": hashlib.sha256(before).hexdigest(),
                  "afterSha256": hashlib.sha256(args.manifest.read_bytes()).hexdigest(),
                  "changes": changes}, indent=2))
