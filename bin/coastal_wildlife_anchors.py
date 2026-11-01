"""Resting-wildlife metadata from the finished physical coast.

The first sea lion moves30cm across and30cm seaward of the old unsafe rock
shoulder. Its original12.2658um authoring offset is preserved; the rock stays.
"""
import math

SEA_LION_0_PLAN = (-9.7, -14.8115)  # Three X/Z; Blender X/Y is (x,-z).
SEA_LION_AUTHORING_OFFSET = 0.000012265839


def resurvey_sea_lion_rest(config, native_height):
    path = config['terrain']['habitats']['seaLion']['path']
    if not path:
        raise ValueError('Finished haul-out metadata is required')
    x, z = SEA_LION_0_PLAN
    height = native_height(x,-z)
    if height is None or not math.isfinite(height) or height <= -7.3:
        raise ValueError('The surveyed sea-lion rest lost its physical haul-out')
    before = list(path[0])
    path[0] = [x,round(height+SEA_LION_AUTHORING_OFFSET,4),z]
    return {'before':before,'after':list(path[0]),'nativeGroundHeight':height,
            'authoringOffsetM':SEA_LION_AUTHORING_OFFSET,
            'method':'Finished native mesh downward support; preserve the original authoring offset and round metadata to4decimals'}


def resting_ground_height(objects):
    """Actual render triangles of the native haul-outs, without water fallback."""
    import bpy
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    bpy.context.view_layer.update()
    targets=[o for o in objects if o.type=='MESH' and
             (o.name=='coast_shared_golden coastal sandstone' or o.name.startswith('coast_haulout_ledge'))]
    if not targets:
        raise ValueError('Finished native haul-out surfaces are missing')
    vertices,faces=[],[]
    for obj in targets:
        obj.data.calc_loop_triangles();offset=len(vertices)
        vertices.extend(obj.matrix_world@v.co for v in obj.data.vertices)
        faces.extend(tuple(offset+i for i in t.vertices) for t in obj.data.loop_triangles)
    tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True)
    def height(x,y):
        hit,_,_,_=tree.ray_cast(Vector((x,y,30)),Vector((0,0,-1)))
        return None if hit is None else hit.z
    return height
