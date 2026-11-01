"""Verify immutable payloads and source bytes at this checkpoint, optionally from Git."""
import argparse,hashlib,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--git');args=p.parse_args()
folder=Path(__file__).resolve().parent;root=folder.parents[3]
def read(relative):
    if args.git:return subprocess.check_output(['git','show',args.git+':'+relative],cwd=root)
    return (root/relative).read_bytes()
prefix=folder.relative_to(root).as_posix()
manifest=json.loads(read(prefix+'/MANIFEST.json'))
for row in manifest['payloads']:
    b=read(prefix+'/'+row['path']);assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],row['path']
bindings=json.loads(read(prefix+'/SOURCE_BINDINGS.json'))
for row in bindings['files']:
    b=read(row['path']);b=b.replace(b'\r\n',b'\n') if row['normalization']=='LF' else b
    assert hashlib.sha256(b).hexdigest()==row['sha256'],row['path']
print(json.dumps({'verifiedPayloads':len(manifest['payloads']),'verifiedSources':len(bindings['files']),'git':args.git}))
