"""Author camera envelopes and a terrain-height proxy from the final solid."""
import math


def camera_support_meshes(objects):
    """Finished physical coast, including retained material-batched sources.

    Foliage and deferred treatments are not ground. Sandstone shell masses,
    beach, talus, haul-outs and tidal basins retain their true support heights.
    """
    return [obj for obj in objects if obj.type == 'MESH'
            and obj.get('renderStyle') in (None, 'realistic')
            and (obj.name.startswith('coast_') or obj.get('caveRoof')
                 or (obj.name.startswith('core_') and
                     ('mainland' in obj.name or any(material and
                         material.name.startswith('golden coastal sandstone')
                         for material in obj.data.materials))))]


def create_camera_height(objects, sea_level=-7.35):
    """Raycast the final authored surfaces; misses are sea, never fake land.

    The renderer's mean Pacific level is -7.35 m. Underwater sand uses that water
    floor too; this static proxy does not sample the animated wave surface.
    """
    import bpy
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    bpy.context.view_layer.update()
    vertices, faces = [], []
    meshes = camera_support_meshes(objects)
    if not meshes:
        raise ValueError('No finished physical coastal meshes for camera collision')
    for obj in meshes:
        offset = len(vertices)
        vertices.extend(obj.matrix_world @ vertex.co for vertex in obj.data.vertices)
        faces.extend(tuple(offset + index for index in face.vertices) for face in obj.data.polygons)
    support = BVHTree.FromPolygons(vertices, faces)
    def height(x, y):
        hit, _, _, _ = support.ray_cast(Vector((x, y, 30)), Vector((0, 0, -1)))
        return max(hit.z, sea_level) if hit is not None else sea_level
    return height


def sample_camera_elevations(collision, height):
    """Row-major Three X/Z grid sampled from the Blender X/Y surface."""
    x0, z0 = collision['origin']
    step = collision['step']
    return [round(height(x0 + i * step, -(z0 + j * step)), 3)
            for j in range(collision['height']) for i in range(collision['width'])]


def camera_manifest(config, height):
    # Outside collision samples come from all final coast surfaces, not an
    # analytic mainland fallback or an unfinished pre-beach section.
    xs = [-36 + i * 2 for i in range(57)]
    ys = [-32 + i * 2 for i in range(32)]
    config['cameraCollision'] = {
        'origin': [-36, -30], 'step': 2, 'width': len(xs), 'height': len(ys),
        'elevations': [],
        'clearance': .32,
        'walls': [
            {'min':[-5.2,-.26,-4.5], 'max':[-4.7,6,5.55]},
            {'min':[4.7,-.26,-4.5], 'max':[5.2,6,5.55]},
            {'min':[-5.2,-.26,5.35], 'max':[5.2,6,5.65]},
            {'min':[-4.7,2.34,1.30], 'max':[4.7,2.60,4.08]},
        ],
    }
    config['cameraCollision']['elevations'] = sample_camera_elevations(config['cameraCollision'], height)
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
