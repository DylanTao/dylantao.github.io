"""Resurvey the approved rest point without rewriting native geometry or cache."""
import argparse,hashlib,json,sys
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'bin'))
from coastal_wildlife_anchors import resurvey_sea_lion_rest, resting_ground_height
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',type=Path,default=ROOT/'artwork/coastal-home/coastal-home.blend')
parser.add_argument('--manifest',type=Path,default=ROOT/'assets/models/home/manifest.json')
parser.add_argument('--report',type=Path,required=True)
parser.add_argument('--apply',action='store_true')
options=parser.parse_args(args)
assert bpy.app.version==(4,5,9),'Use Blender4.5.9'
bpy.ops.wm.open_mainfile(filepath=str(options.source))
config=json.loads(options.manifest.read_text(encoding='utf8'))
report=resurvey_sea_lion_rest(config,resting_ground_height(list(bpy.context.scene.objects)))
report.update({'nativeSha256':hashlib.sha256(options.source.read_bytes()).hexdigest(),'applied':options.apply})
if options.apply:options.manifest.write_text(json.dumps(config,indent=2)+'\n',encoding='utf8',newline='\n')
options.report.parent.mkdir(parents=True,exist_ok=True)
options.report.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8',newline='\n')
print(json.dumps(report,indent=2))
