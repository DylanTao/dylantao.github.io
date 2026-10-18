"""Skinned single-mesh rigs for the coastal animals (Blender 4.5).

Species builders still author articulated pivots (empties) and the parts that hang from
them. `skin()` turns one build into an armature and one mesh with two materials, so an
animal draws as two primitives instead of a dozen, and continuous parts (trunks, necks,
tails, ears, flippers) bend between bones instead of hinging as rigid pieces.

Every bone points along Blender +Z with zero roll. The glTF exporter writes such joints with
identity rotations, so runtime rotations act about the model's own axes (x across, y up,
z forward in the browser) exactly as the former pivots did. Part colours, whether from a
material or from authored coat vertex colours, are baked into one byte colour layer.
"""
import bpy
from mathutils import Vector


def smooth(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def ramp(value, a, b):
    """0 at a, 1 at b, smooth in between; a may exceed b."""
    return smooth((value - a) / (b - a))


def chain(value, stations):
    """Blend between consecutive (bone, station) pairs, stations ascending."""
    if value <= stations[0][1]:
        return [(stations[0][0], 1.0)]
    for (a, sa), (b, sb) in zip(stations, stations[1:]):
        if value <= sb:
            w = smooth((value - sa) / (sb - sa))
            return [(a, 1.0 - w), (b, w)]
    return [(stations[-1][0], 1.0)]


def canonical(obj):
    return obj.name.split('.')[0]


def vertex_material(name, roughness, layer='Coat'):
    # An authoring material may already hold this name; move it aside so the export keeps it clean.
    held = bpy.data.materials.get(name)
    if held is not None:
        held.name = name + ' (authoring)'
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = roughness
    node = material.node_tree.nodes.new('ShaderNodeVertexColor')
    node.layer_name = layer
    material.node_tree.links.new(node.outputs['Color'], bsdf.inputs['Base Color'])
    material.diffuse_color = (1, 1, 1, 1)
    return material


def _part_colours(obj, mesh):
    """Per-corner linear colours: an authored colour layer if present, else the material colour."""
    layer = mesh.color_attributes[0] if len(mesh.color_attributes) else None
    colours = []
    if layer is not None:
        if layer.domain == 'CORNER':
            colours = [tuple(layer.data[i].color[:3]) for i in range(len(mesh.loops))]
        else:
            colours = [tuple(layer.data[loop.vertex_index].color[:3]) for loop in mesh.loops]
        return colours
    slots = [slot.material for slot in obj.material_slots]
    for polygon in mesh.polygons:
        material = slots[polygon.material_index] if polygon.material_index < len(slots) else None
        colour = tuple(material.diffuse_color[:3]) if material else (0.5, 0.5, 0.5)
        colours.extend([colour] * polygon.loop_total)
    return colours


def skin(root, *, extra_bones=(), parents=None, weights=None, gloss=(), coat_roughness=0.9, gloss_roughness=0.3,
         coat_name=None, gloss_name=None):
    """Replace an empty-pivot build with an armature and one two-material skinned mesh.

    extra_bones: (name, parent, head) bones with no pivot of their own (spines, jaws, tails).
    parents: bone -> new parent, to re-hang a pivot (e.g. a head under a new chest bone).
    weights(part, owner, co): [(bone, weight)] for blended parts, or None for rigid ownership.
    gloss: material names that render on the glossy primitive (eyes, noses, catchlights).
    """
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    species = canonical(root)
    descendants = list(root.children_recursive)
    pivots = [o for o in descendants if o.type == 'EMPTY']
    bones = {}
    for pivot in pivots:
        parent = pivot.parent
        bones[canonical(pivot)] = [canonical(parent) if parent is not None and parent is not root else None,
                                   pivot.matrix_world.translation.copy()]
    for name, parent, head in extra_bones:
        bones[name] = [parent, Vector(head)]
    for name, parent in (parents or {}).items():
        bones[name][0] = parent
    vertices, faces, materials, loop_colours, vertex_weights = [], [], [], [], []
    gloss = set(gloss)
    for part in descendants:
        if part.type not in ('MESH', 'CURVE'):
            continue
        owner = part.parent
        while owner is not None and owner is not root and owner.type != 'EMPTY':
            owner = owner.parent
        owner_name = canonical(owner) if owner is not None and owner is not root else 'BodyPose'
        mesh = bpy.data.meshes.new_from_object(part.evaluated_get(depsgraph), preserve_all_data_layers=True,
                                               depsgraph=depsgraph)
        mesh.transform(part.matrix_world)
        colours = _part_colours(part, mesh)
        slots = [slot.material for slot in part.material_slots]
        offset = len(vertices)
        part_name = part.name.split('.')[0]
        for vertex in mesh.vertices:
            co = vertex.co.copy()
            vertices.append(co)
            vertex_weights.append((weights(part_name, owner_name, co) if weights else None) or [(owner_name, 1.0)])
        for polygon in mesh.polygons:
            faces.append(tuple(offset + i for i in polygon.vertices))
            material = slots[polygon.material_index] if polygon.material_index < len(slots) else None
            materials.append(1 if material is not None and material.name.split('.')[0] in gloss else 0)
        loop_colours.extend(colours)
        bpy.data.meshes.remove(mesh)
    for obj in reversed([root] + descendants):
        bpy.data.objects.remove(obj, do_unlink=True)

    data = bpy.data.meshes.new(species + ' skin')
    data.from_pydata([tuple(v) for v in vertices], [], faces)
    data.update()
    for polygon in data.polygons:
        polygon.use_smooth = True
        polygon.material_index = materials[polygon.index]
    layer = data.color_attributes.new('Coat', 'BYTE_COLOR', 'CORNER')
    for index, colour in enumerate(loop_colours):
        layer.data[index].color = (*colour, 1.0)
    data.materials.append(vertex_material(coat_name or species + ' coat', coat_roughness))
    data.materials.append(vertex_material(gloss_name or species + ' gloss', gloss_roughness))

    armature = bpy.data.armatures.new(species + ' rig')
    rig = bpy.data.objects.new(species, armature)
    bpy.context.collection.objects.link(rig)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    placed = set()
    while len(placed) < len(bones):
        progress = False
        for name, (parent, head) in bones.items():
            if name in placed or (parent is not None and parent not in placed):
                continue
            bone = armature.edit_bones.new(name)
            bone.head = head
            bone.tail = head + Vector((0, 0, 0.03))
            bone.roll = 0
            if parent is not None:
                bone.parent = armature.edit_bones[parent]
            placed.add(name)
            progress = True
        if not progress:
            raise ValueError(f'{species}: unresolved bone parents {set(bones) - placed}')
    bpy.ops.object.mode_set(mode='OBJECT')

    body = bpy.data.objects.new(species + ' skin', data)
    bpy.context.collection.objects.link(body)
    body.parent = rig
    modifier = body.modifiers.new('Rig', 'ARMATURE')
    modifier.object = rig
    groups = {name: body.vertex_groups.new(name=name) for name in bones}
    for index, pairs in enumerate(vertex_weights):
        total = sum(w for _, w in pairs if w > 1e-4) or 1.0
        for bone, w in pairs:
            if w > 1e-4:
                groups[bone].add([index], w / total, 'REPLACE')
    return rig


def export(rig, path):
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    for child in rig.children:
        child.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_animations=False,
                              export_skins=True, export_texcoords=False, export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=7)
    body = rig.children[0]
    triangles = sum(len(p.vertices) - 2 for p in body.data.polygons)
    print('RIG', rig.name, 'bones', len(rig.data.bones), 'vertices', len(body.data.vertices), 'triangles', triangles,
          'bytes', path.stat().st_size)
    return triangles
