"""Retain Inter's license and convert the pinned upstream variable fonts to WOFF2."""
from pathlib import Path
import hashlib
import json
import urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/fonts/inter'
OUT.mkdir(parents=True, exist_ok=True)
request = urllib.request.Request('https://api.github.com/repos/google/fonts/commits?path=ofl/inter&per_page=1', headers={'User-Agent': 'Sirui-portfolio-font-build'})
revision = json.load(urllib.request.urlopen(request))[0]['sha']
base = f'https://raw.githubusercontent.com/google/fonts/{revision}/ofl/inter/'
assets = []
for name, remote in [('Inter', 'Inter%5Bopsz%2Cwght%5D.ttf'), ('Inter-Italic', 'Inter-Italic%5Bopsz%2Cwght%5D.ttf')]:
    data = urllib.request.urlopen(base + remote).read()
    temporary = ROOT / '.jekyll-cache' / (name + '.ttf')
    temporary.write_bytes(data)
    font = instantiateVariableFont(TTFont(temporary), {'wght': (400, 600)}, inplace=False)
    font.flavor = 'woff2'
    destination = OUT / (name + '.woff2')
    font.save(destination)
    assets.append({'file': destination.name, 'source': base + remote, 'sourceSha256': hashlib.sha256(data).hexdigest(), 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()})
(OUT / 'OFL.txt').write_bytes(urllib.request.urlopen(base + 'OFL.txt').read())
(OUT / 'provenance.json').write_text(json.dumps({'family': 'Inter', 'authors': 'The Inter Project Authors', 'license': 'SIL OFL 1.1', 'revision': revision, 'weights': [400, 600], 'conversion': 'FontTools variable weight range 400-600, WOFF2; glyph set and optical sizing retained', 'assets': assets}, indent=2) + '\n')
