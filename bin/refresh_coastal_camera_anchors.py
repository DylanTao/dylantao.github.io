"""Refresh authored camera metadata without resaving or modifying native meshes."""
import argparse
import hashlib
import json
import re
from pathlib import Path

from coastal_camera import finish_room_arrivals, finish_outside_orbit

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--manifest", type=Path, default=ROOT / "assets/models/home/manifest.json")
parser.add_argument("--apply", action="store_true")
args = parser.parse_args()
before = args.manifest.read_bytes()
config = json.loads(before)
changes = finish_room_arrivals(config)
outside = finish_outside_orbit(config)
if args.apply:
    # Preserve the authored numeric spelling and compact arrays outside these owned fields.
    source = before.decode('utf-8').replace('\r\n', '\n')
    for change in changes:
        if change['before'] == change['after']:
            continue
        anchor = re.search(r'\{\s*"id"\s*:\s*"' + re.escape(change['room']) + r'"', source)
        if not anchor:
            raise ValueError('Missing room ' + change['room'])
        value = re.search(r'"target"\s*:\s*(\[[^\]]*\])', source[anchor.start():])
        if not value:
            raise ValueError('Missing room target')
        a, b = (anchor.start() + x for x in value.span(1))
        source = source[:a] + json.dumps(change['after']) + source[b:]
    if outside['before'] != outside['after']:
        views = source.index('"views"')
        anchor = re.search(r'"outside"\s*:\s*\{', source[views:])
        if not anchor:
            raise ValueError('Missing outside view')
        offset = views + anchor.start()
        value = re.search(r'"pitch"\s*:\s*(\[[^\]]*\])', source[offset:])
        if not value:
            raise ValueError('Missing outside pitch envelope')
        a, b = (offset + x for x in value.span(1))
        source = source[:a] + json.dumps(outside['after']) + source[b:]
    if json.loads(source) != config:
        raise ValueError('Camera metadata patch changed unrelated manifest data')
    args.manifest.write_text(source, encoding="utf-8", newline="\n")
print(json.dumps({"manifest": str(args.manifest), "applied": args.apply,
                  "beforeSha256": hashlib.sha256(before).hexdigest(),
                  "afterSha256": hashlib.sha256(args.manifest.read_bytes()).hexdigest(),
                  "changes": changes, "outsideOrbit": outside}, indent=2))
