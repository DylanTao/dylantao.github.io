"""Verify the immutable flight checkpoint's payload and source bindings."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--git", metavar="REF")
args = parser.parse_args()
folder = Path(__file__).resolve().parent
root = folder.parents[3]
manifest = json.loads((folder / "manifest.json").read_bytes())


def check(entry, prefix):
    path = (prefix / entry["path"]).as_posix()
    raw = subprocess.check_output(["git", "show", f"{args.git}:{path}"], cwd=root) if args.git else (root / path).read_bytes()
    if entry["mode"] == "text-lf":
        raw = raw.replace(b"\r\n", b"\n")
    assert len(raw) == entry["bytes"], path
    assert hashlib.sha256(raw).hexdigest() == entry["sha256"], path


for entry in manifest["payloads"]:
    check(entry, folder.relative_to(root))
for entry in manifest["sourceBindings"]:
    check(entry, Path())
print(f"PASS {len(manifest['payloads'])} payloads and {len(manifest['sourceBindings'])} source bindings", args.git or "worktree")
