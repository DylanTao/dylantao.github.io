"""User-approved, pixel-preserving outer-paper masks. Never redraw a figure."""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import hashlib
import json

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'assets/img/publication_preview'
reports=[]
for name in ('designweaver','herding_cats_why_what'):
    source=BASE/(name+'.png')
    rgb=np.array(Image.open(source).convert('RGB'))
    # Only neutral near-white pixels are eligible, connected to the exterior.
    paper=(rgb.min(axis=2)>=246)&(rgb.max(axis=2)-rgb.min(axis=2)<=5)
    mask=Image.fromarray(np.where(paper,255,0).astype('uint8')).copy()
    # Seed every edge: figures may divide the paper into several exterior regions.
    for x in range(mask.width):
        for y in (0,mask.height-1):
            if mask.getpixel((x,y))==255:ImageDraw.floodfill(mask,(x,y),128,thresh=0)
    for y in range(mask.height):
        for x in (0,mask.width-1):
            if mask.getpixel((x,y))==255:ImageDraw.floodfill(mask,(x,y),128,thresh=0)
    alpha=np.where(np.array(mask)==128,0,255).astype('uint8')
    rgba=np.dstack((rgb,alpha))
    output=BASE/(name+'-transparent.png')
    Image.fromarray(rgba).save(output,optimize=True)
    assert np.array_equal(np.array(Image.open(output))[:,:,:3],rgb)
    reports.append({'source':source.relative_to(ROOT).as_posix(),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
                    'derivative':output.relative_to(ROOT).as_posix(),'dimensions':[mask.width,mask.height],
                    'transparentPixels':int((alpha==0).sum()),'rgbPixelsChanged':0,
                    'method':'Edge-connected neutral paper mask; no resampling, recoloring or generated pixels'})
out=ROOT/'artwork/research-figures'
out.mkdir(exist_ok=True)
(out/'mask-provenance.json').write_text(json.dumps(reports,indent=2)+'\n')
print(json.dumps(reports,indent=2))
