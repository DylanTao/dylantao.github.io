"""Supplementary actual-source views; final browser lighting governs acceptance."""
import json,sys
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/"bin"))
import coastal_preview as preview
args={a[2:].split("=",1)[0]:a.split("=",1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
bpy.ops.wm.open_mainfile(filepath=str(ROOT/args.get("source",".jekyll-cache/retreat/coastal-retreat.blend")))
scene=bpy.context.scene
camera=preview.setup(scene,resolution=(1100,760),samples=12,cutaway=args.get("cutaway","0")=="1")
preview.add_fill(scene,"retreat library task stand-in",(-10.8,-4.5,3),energy=130,size=3,target=(-10.5,-5.6,.7))
views={"exterior":((-17,28,13),(-1,-3.5,2.3),54),
       "library":((-9.2,-2.1,1.65),(-11.4,-5.0,2.1),66),
       "clifftop":((14,-18,14),(6.9,-11.6,8.8),58),
       "entry":((5.8,-26.2,11),(2.2,-22,7.8),56)}
if args.get("only"):views={k:v for k,v in views.items() if k in args["only"].split(",")}
out=ROOT/".jekyll-cache/retreat/native-renders";out.mkdir(parents=True,exist_ok=True)
print(preview.render(scene,camera,views,out),flush=True)
