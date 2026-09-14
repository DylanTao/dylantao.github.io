"""A lightweight vector atlas from attributed OpenStreetMap ways, not AI geography."""
import json
import gzip
import urllib.request
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "artwork/la-jolla/atlas"
SOURCE.mkdir(parents=True, exist_ok=True)
bounds = (32.817, -117.293, 32.915, -117.206)
query = '[out:json][timeout:40];(way["natural"="coastline"](32.817,-117.293,32.915,-117.206);way["highway"~"^(primary|secondary|tertiary|residential)$"](32.817,-117.293,32.915,-117.206););out geom;'
cache = SOURCE / "openstreetmap.json.gz"
if not cache.exists():
    request = urllib.request.Request("https://overpass-api.de/api/interpreter", data=urllib.parse.urlencode({"data": query}).encode(), headers={"User-Agent": "SiruiCoastalAtlas/1.0 (dylantao.github.io)"})
    with gzip.open(cache,'wb') as output:output.write(urllib.request.urlopen(request, timeout=60).read())
with gzip.open(cache,'rt',encoding='utf8') as stream:data=json.load(stream)
def point(p):
    return ((p['lon']-bounds[1])/(bounds[3]-bounds[1])*900, (bounds[2]-p['lat'])/(bounds[2]-bounds[0])*900)
coasts, roads = [], []
for way in data['elements']:
    pts = [point(p) for p in way.get('geometry', [])]
    if not pts:
        continue
    d = 'M'+' L'.join(f'{x:.2f},{y:.2f}' for x,y in pts)
    (coasts if way.get('tags', {}).get('natural') == 'coastline' else roads).append(d)
paths = ''.join(f'<path d="{d}"/>' for d in roads)
shore = ''.join(f'<path d="{d}"/>' for d in coasts)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900">
<title>La Jolla coastline and roads</title><desc>OpenStreetMap contributors, ODbL. Geographic base; landmark distances in the 3D miniature are compressed.</desc>
<defs><radialGradient id="fade"><stop offset="45%" stop-color="white"/><stop offset="100%" stop-color="black"/></radialGradient><mask id="edge"><rect width="900" height="900" fill="url(#fade)"/></mask></defs>
<g mask="url(#edge)"><rect width="900" height="900" fill="#b0c2b1" opacity=".12"/>
<g fill="none" stroke="#859690" stroke-width=".65" opacity=".55">{paths}</g>
<g fill="none" stroke="#7eacb7" stroke-width="18" opacity=".13">{shore}</g>
<g fill="none" stroke="#699ca8" stroke-width="1.6" opacity=".65">{shore}</g>
<g font-family="Inter, sans-serif" font-size="15" letter-spacing="2" fill="#6a878d" opacity=".7"><text x="45" y="430" transform="rotate(-25 45 430)">PACIFIC OCEAN</text><text x="230" y="710">LA JOLLA</text><text x="545" y="180">UC SAN DIEGO</text></g></g></svg>'''
(ROOT / "assets/models/la-jolla/atlas.svg").write_text(svg, encoding='utf8')
(SOURCE / 'provenance.json').write_text(json.dumps({'source':'OpenStreetMap contributors', 'license':'ODbL 1.0', 'attribution':'https://www.openstreetmap.org/copyright', 'endpoint':'https://overpass-api.de/api/interpreter', 'query':query, 'bounds':bounds, 'osm_base':data.get('osm3s',{}).get('timestamp_osm_base'), 'ways':len(data['elements'])}, indent=2)+'\n')
print('Atlas:', len(coasts), 'coastline ways;', len(roads), 'road ways')
