"""Verify exact retained payloads and the admitted source bindings."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("--git", metavar="REF")
args = p.parse_args()
folder = Path(__file__).resolve().parent
root = folder.parents[3]
manifest = json.loads((folder / "manifest.json").read_bytes())

def read(path):
    if args.git:
        return subprocess.check_output(["git", "show", f"{args.git}:{path}"], cwd=root)
    return (root / path).read_bytes()

for entry in manifest["payloads"]:
    raw = read((folder.relative_to(root) / entry["path"]).as_posix())
    if entry["mode"] == "text-lf":
        raw = raw.replace(b"\r\n", b"\n")
    assert len(raw) == entry["bytes"], entry["path"]
    assert hashlib.sha256(raw).hexdigest() == entry["sha256"], entry["path"]
for entry in manifest["sourceBindings"]:
    raw = read(entry["path"])
    if entry["mode"] == "text-lf":
        raw = raw.replace(b"\r\n", b"\n")
    assert len(raw) == entry["bytes"], entry["path"]
    assert hashlib.sha256(raw).hexdigest() == entry["sha256"], entry["path"]
print(f"PASS {len(manifest['payloads'])} payloads and {len(manifest['sourceBindings'])} source bindings", args.git or "worktree")
