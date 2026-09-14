"""Produce bounded web previews while retaining the original editable artwork."""
from pathlib import Path
from PIL import Image
import re,json,hashlib
ROOT=Path(__file__).resolve().parents[1]
previews=ROOT/'assets/img/coastal-process';previews.mkdir(exist_ok=True)
sources={
    'architecture':ROOT/'artwork/coastal-home/direction/architecture.png',
    'character-wildlife':ROOT/'artwork/coastal-home/direction/character-wildlife.png',
    'la-jolla-front':ROOT/'artwork/la-jolla/direction/front.png',
    'la-jolla-back':ROOT/'artwork/la-jolla/direction/back.png',
    'atlas-direction':ROOT/'artwork/la-jolla/direction/atlas.png',
    'reconstruction-clay':ROOT/'artwork/la-jolla/reconstruction/clay.png',
}
metadata=[]
for name,path in sources.items():
    image=Image.open(path);image.thumbnail((1280,1280));image.save(previews/f'{name}.webp',quality=85,method=6)
    if 'direction' in str(path):
        data=path.read_bytes()
        evidence=re.findall(rb'.{0,25}gpt.{0,40}',data)
        metadata.append({'asset':str(path.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(data).hexdigest(),'tool':'image_gen.imagegen','modelSelectorExposed':False,'modelFromC2PA':{'name':'gpt-image','version':'2.0'} if any(b'gpt-imagegversionc2.0' in x for x in evidence) else None,'rawModelMetadata':[s.decode('utf8','replace') for s in evidence]})
for a,b in [('artwork/la-jolla/miniature.png','assets/models/la-jolla/miniature.webp'),('artwork/la-jolla/la-jolla-day.png','assets/models/la-jolla/poster.webp'),('artwork/pip/pip-model.png','assets/models/pip/poster.webp')]:
    image=Image.open(ROOT/a);image.thumbnail((1400,1000));image.save(ROOT/b,quality=86,method=6)
(ROOT/'artwork/coastal-home/direction/provenance.json').write_text(json.dumps({'note':'The requested Images 2.5 name was not selectable in the tool. The retained outputs embed gpt-image version 2.0 in C2PA softwareAgent metadata. Generated concepts are not browser-render evidence.','assets':metadata},indent=2)+'\n')
