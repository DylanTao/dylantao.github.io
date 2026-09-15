"""Author camera envelopes and a terrain-height proxy from the final solid."""
import math


def camera_manifest(config, height):
    # Outside collision samples come from the final Boolean mesh's BVH.
    xs = [-36 + i * 2 for i in range(57)]
    ys = [-32 + i * 2 for i in range(32)]
    config['cameraCollision'] = {
        'origin': [-36, -30], 'step': 2, 'width': len(xs), 'height': len(ys),
        'elevations': [round(height(x,y),3) for y in reversed(ys) for x in xs],
        'clearance': .32,
        'walls': [
            {'min':[-5.2,-.26,-4.5], 'max':[-4.7,6,5.55]},
            {'min':[4.7,-.26,-4.5], 'max':[5.2,6,5.55]},
            {'min':[-5.2,-.26,5.35], 'max':[5.2,6,5.65]},
            {'min':[-4.7,2.34,1.30], 'max':[4.7,2.60,4.08]},
        ],
    }
    config['cutawaySections'] = [{'id':'inhabited-roof','tag':'caveRoof','closed':True}]
    for key in ('outside','overview'):
        view = config['views'][key]
        view['envelope'] = {'yaw':None if key=='outside' else [2.38,3.96],
            'pitch':[.18,.86] if key=='outside' else [.25,.78],
            'radius':[24,72] if key=='outside' else [13,25]}
    for room in config['rooms']:
        if room['id']=='onsen':
            room['camera']={'radius':3.7,'yaw':3.5,'pitch':.36}
        camera = room['camera']; yaw = camera['yaw']; r = camera['radius']
        camera['envelope'] = {'yaw':[round(yaw-.55,3),round(yaw+.55,3)],
            'pitch':[.12,.62], 'radius':[round(r*.78,3),round(r*1.18,3)]}
    config['version'] = 5


def landward_entry(mats, h, height):
    # A small planted stone entry at grade; its recessed closed oak door leads
    # into the sheltered landward side without showing an unfinished back wall.
    x,y = -.5,-10.1; z = height(x,y)
    for dx in (-1.05,1.05):
        h['box']('core_recessed_entry_jamb',(x+dx,y,z+.70),(.45,1.50,1.8),mats['edge'],.18)
    h['box']('core_entry_lintel',(x,y,z+1.61),(2.55,1.62,.40),mats['edge'],.18)
    h['box']('core_entry_recess',(x,y+.23,z+.72),(1.75,.22,1.6),mats['ink'],.06)
    h['box']('core_entry_oak_door',(x,y+.08,z+.70),(1.30,.08,1.50),mats['wood'],.035)
    for i in range(11):
        h['box']('core_entry_oak_slat',(x-.57+i*.114,y+.025,z+.70),(.006,.025,1.39),mats['oak'],.002)
    h['tube']('core_entry_pull',[(x+.42,y-.045,z+.54),(x+.42,y-.045,z+.91)],.021,mats['brass'])
    for i in range(3):
        yy=y-.82-i*.36
        ground=height(x,yy)
        h['box']('core_entry_threshold',(x,yy,ground+.02),(2.3,.43,.14),mats['edge'],.06)
    for i in range(17):
        yy=y-1.8-i*.57; xx=x+math.sin(i*.18)*1.1
        h['box']('core_landward_path',(xx,yy,height(xx,yy)+.025),(1.60,.54,.065),mats['edge'],.06)
