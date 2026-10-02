"""Small original eyelid surfaces; retained body, fingers and clip keys.

The two native shape keys cover the existing sclera instead of shrinking eyes.
Only irises/pupils follow Eye bones; sclera and skin stay with the head.
"""

import math
import bpy
from mathutils import Quaternion, Vector


def install_expression(arm):
    gaze_fit = arm.get("avatar") == "ghibli"
    mesh = next(o for o in arm.children if o.type == "MESH" and o.name == "SiruiMesh")
    for obj in list(arm.children):
        if obj.get("characterLids"):
            old_mesh = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if not old_mesh.users:
                bpy.data.meshes.remove(old_mesh)
    skin = next(m for m in mesh.data.materials if m.name == "skin")
    head = mesh.vertex_groups.get("Head")
    samples, vertices, polygons, closed, sides = [], [], [], [], []
    for side in ("L", "R"):
        group = mesh.vertex_groups["Eye." + side]
        eye = {v.index for v in mesh.data.vertices
               if any(g.group == group.index and g.weight > .9 for g in v.groups)}
        white = set()
        adjacent = {}
        for poly in mesh.data.polygons:
            if mesh.data.materials[poly.material_index].name != "warm white":
                continue
            indices = list(poly.vertices)
            white.update(indices)
            for i in indices:
                adjacent.setdefault(i, set()).update(indices)
        components = []
        while white:
            component, pending = set(), [white.pop()]
            while pending:
                i = pending.pop()
                component.add(i)
                new = adjacent.get(i, set()) & white
                white.difference_update(new)
                pending.extend(new)
            components.append(component)
        pivot = arm.matrix_world @ arm.data.bones["Eye." + side].head_local
        # Spatial component matching remains correct after a focused re-export
        # has already moved the static sclera weights onto Head.
        def distance(component):
            center = sum((mesh.matrix_world @ mesh.data.vertices[i].co for i in component), Vector()) / len(component)
            return (center - pivot).length
        component = min(components, key=distance)
        coords = [mesh.matrix_world @ mesh.data.vertices[i].co for i in component]
        lo = Vector(tuple(min(p[a] for p in coords) for a in range(3)))
        hi = Vector(tuple(max(p[a] for p in coords) for a in range(3)))
        center, radius = (lo + hi) * .5, (hi - lo) * .5
        # The retained iris/catchlight layers project in front of the sclera.
        # Cover their actual surface envelope at closure, not merely the globe.
        optical = [mesh.matrix_world @ mesh.data.vertices[i].co for i in eye]
        if gaze_fit:
            # The small natural eye's protruding catchlights can escape a lid
            # fitted only to neutral gaze. Sweep the actual retained optical
            # vertices around their native eye pivot through runtime's bounds.
            basis = arm.matrix_world @ arm.data.bones["Eye." + side].matrix_local
            inverse = basis.inverted()
            local = [inverse @ p for p in optical]
            # Match Three's intrinsic XYZ quaternion product, not Blender's
            # extrinsic Euler sequence when both angles are nonzero.
            optical = [basis @ (Quaternion((1, 0, 0), -pitch) @ Quaternion((0, 1, 0), yaw)).to_matrix().to_4x4() @ p
                       for yaw in (-.2, -.1, 0, .1, .2)
                       for pitch in (-.12, -.06, 0, .06, .12)
                       for p in local]
        cover_depth = max(radius.y, center.y - min(p.y for p in optical)) * 1.12
        sample = {"side": side, "center": list(center), "radius": list(radius)}
        if gaze_fit:
            sample["closedDepth"] = cover_depth
            sample["gazeSweep"] = {"yaw": [-.2, .2], "pitch": [-.12, .12], "poses": 25, "cornerScale": 1.04}
        samples.append(sample)
        # The eyeball remains round during a saccade. Reassign only static white
        # and existing soft lid vertices; the original surface is unchanged.
        static = set(component)
        for poly in mesh.data.polygons:
            if mesh.data.materials[poly.material_index].name == "skin":
                static.update(i for i in poly.vertices if i in eye)
        for name in ("L", "R"):
            mesh.vertex_groups["Eye." + name].remove(list(static))
        head.add(list(static), 1, "REPLACE")
        for sign, opening in ((1, .80), (-1, .88)):
            offset = len(vertices)
            segments, rings = 32, 5
            for ring in range(rings + 1):
                t = ring / rings
                for segment in range(segments + 1):
                    angle = math.pi * segment / segments
                    x = math.cos(angle) * .998

                    def point(aperture, depth, closure=False):
                        z = sign * math.sin(angle) * (1.07 * (1 - t) + aperture * t)
                        front = math.sqrt(max(0, 1 - x * x - z * z))
                        if closure and gaze_fit:
                            # A smooth broad closure rests ahead of the fitted
                            # optical sweep with a small corner coverage margin.
                            f = min(1, front / .45)
                            front = f * f * (3 - 2 * f)
                        px = x * (1.04 if closure and gaze_fit else 1)
                        return (center.x + radius.x * px,
                                center.y - depth * front - .0007,
                                center.z + radius.z * z)

                    vertices.append(point(opening, radius.y))
                    closed.append(point(-.012, cover_depth, True))
                    sides.append(side)
            for ring in range(rings):
                for segment in range(segments):
                    a = offset + ring * (segments + 1) + segment
                    face = (a, a + 1, a + segments + 2, a + segments + 1)
                    polygons.append(face if sign > 0 else tuple(reversed(face)))
    data = bpy.data.meshes.new("Sirui sculpted eyelid patches")
    data.from_pydata(vertices, [], polygons)
    data.update()
    obj = bpy.data.objects.new("SiruiEyelids", data)
    bpy.context.collection.objects.link(obj)
    obj.parent = arm
    obj["characterLids"] = True
    obj["expression"] = "Original paired upper/lower lid coverage; L/R Blink morphs"
    data.materials.append(skin)
    for polygon in data.polygons:
        polygon.use_smooth = True
    obj.vertex_groups.new(name="Head").add(list(range(len(vertices))), 1, "REPLACE")
    mod = obj.modifiers.new("character skin", "ARMATURE")
    mod.object = arm
    obj.shape_key_add(name="Basis")
    for side in ("L", "R"):
        key = obj.shape_key_add(name="Blink" + side)
        for i, value in enumerate(closed):
            if sides[i] == side:
                key.data[i].co = value
    return {"vertices": len(vertices), "triangles": len(polygons) * 2, "eyes": samples}
