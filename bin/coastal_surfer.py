"""Bounded Surfer1 board treatment shared by the original builder and saved-source repair.

The Jim Hollan cameo is posed by people-pose.mjs. The black clothing and red board
are Sirui's art direction, not a documented claim about anybody's surfing equipment.
"""
import math


def refine_rider_board():
    import bpy

    rider = bpy.data.objects['Surfer1']
    board = next(o for o in rider.children if o.type == 'MESH' and o.name.startswith('Longboard'))
    for obj in list(rider.children):
        if obj.name == 'Rider board white stringer' or (obj.type == 'MESH' and any(m.name == 'Sea foam' for m in obj.data.materials)):
            bpy.data.objects.remove(obj, do_unlink=True)

    def material(name, rgb, roughness):
        mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        mat.diffuse_color = (*rgb, 1)
        mat.use_nodes = True
        node = mat.node_tree.nodes.get('Principled BSDF')
        node.inputs['Base Color'].default_value = (*rgb, 1)
        node.inputs['Roughness'].default_value = roughness
        return mat

    red = material('Rider board red', (.62, .035, .025), .38)
    white = material('Rider board white stringer', (.92, .92, .86), .4)
    board.data.materials.clear()
    board.data.materials.append(red)
    # A narrow original mesh on the actual ellipsoid deck, not a floating highlight.
    verts = []
    for i in range(33):
        x = -.62 + 1.24 * i / 32
        for y in (-.009, .009):
            z = .043 * math.sqrt(max(0, 1 - (x / .72) ** 2 - (y / .17) ** 2)) + .0018
            verts.append((x, y, z))
    data = bpy.data.meshes.new('Rider board white stringer')
    data.from_pydata(verts, [], [(2*i, 2*i+1, 2*i+3, 2*i+2) for i in range(32)])
    data.materials.append(white)
    stripe = bpy.data.objects.new('Rider board white stringer', data)
    bpy.context.collection.objects.link(stripe)
    stripe.parent = rider
    return rider
