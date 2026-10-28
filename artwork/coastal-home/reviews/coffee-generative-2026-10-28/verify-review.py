"""Read back portable evidence after checkout, allowing Git's text line endings."""
from pathlib import Path
import hashlib
import json

review = Path(__file__).resolve().parent
manifest = json.loads((review / "manifest.json").read_text(encoding="utf8"))
for name, expected in manifest["files"].items():
    raw = (review / name).read_bytes()
    canonical = raw if name.endswith(".png") else raw.replace(b"\r\n", b"\n")
    assert len(canonical) == expected["bytes"], name
    assert hashlib.sha256(canonical).hexdigest() == expected["sha256"], name
print(f"Verified {len(manifest['files'])} portable evidence files")
