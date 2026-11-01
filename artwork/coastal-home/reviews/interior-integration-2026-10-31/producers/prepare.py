"""Prepare a complete private product; preserve unowned manifest spelling."""
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

root = Path.cwd()
sys.path.insert(0, str(root / 'bin'))
from coastal_private_reading import register

q = root / '.jekyll-cache/visual-qa/interior-integration-20261031'
before = (root / 'assets/models/home/manifest.json').read_bytes()
old = json.loads(before)
config = json.loads(before)
record = register(config)
assert len(config['installationLines']) == len(old['installationLines']) + 1
text = before.decode('utf8').replace('\r\n', '\n')
match = re.search(r'"installationLines"\s*:\s*', text)
assert match
start = match.end()
_, end = json.JSONDecoder().raw_decode(text, start)
assert text[start] == '[' and text[end - 1] == ']'
body = text[start + 1:end - 1].rstrip()
new_record = json.dumps(record, indent=2)
new_record = '\n'.join('    ' + line for line in new_record.splitlines())
patched = text[:start + 1] + body + ',\n' + new_record + '\n  ' + text[end - 1:]
assert json.loads(patched) == config, 'Unowned metadata changed'
(q / 'candidate-manifest.json').write_text(patched, encoding='utf8', newline='\n')
(q / 'metadata-patch.json').write_text(json.dumps({
    'method': 'Append one qualified direct-only reading-light record; all other JSON values and raw fields preserved',
    'inputSha256': hashlib.sha256(before).hexdigest(),
    'outputSha256': hashlib.sha256(patched.encode()).hexdigest(),
    'newInstallation': record,
}, indent=2) + '\n', encoding='utf8')
site = q / 'site/al-folio'
if not site.exists():
    shutil.copytree(root / '.jekyll-cache/visual-qa/room-navigation-20261031/site/al-folio', site)
print('Private metadata and complete build seed prepared', site)
