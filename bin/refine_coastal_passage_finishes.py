"""Finish the upper passage, the wet pool return, and the glass entrance."""

import bmesh
from mathutils import Vector

from coastal_shell import _islands


PASSAGE = "core_onsen_passage_"
RETURN = "core_arrival_B_upper_link_west_return"
SILL = "core_onsen_passage_sill__pale oak"
POOL_MOSAIC = "core_estate_pool__sea glass pool mosaic"
POOL_STONE = "core_estate_pool__warm cut stone"
LINE = "onsen-side-oak-cove"
OLD_PORTAL = "core_garden_threshold_oak_portal"
MARK = "passageFinishFaces"


def _vertices_x(obj):
    return [float((obj.matrix_world @ v.co).x) for v in obj.data.vertices]


def _place_lining(scene, config):
    members = [obj for obj in scene.objects if obj.name.startswith(PASSAGE) and obj.name != SILL]
    pieces = {obj.name[len(PASSAGE):].split("__", 1)[0]: obj for obj in members}
    expected = {"backing", "end", "head", "ledge", "boards", "light_lip", "paper", "base"}
    if pieces.keys() != expected or len(members) != len(pieces):
        raise ValueError("Expected the complete onsen side-wall lining on the native house")
    lining_face = max(_vertices_x(pieces["boards"]))
    seat_face = max(_vertices_x(scene.objects[RETURN]))
    # Keep 53 mm between the old face and the outer panel surface, enough
    # for its backing and the oak, while a metre of circulation stays clear.
    displacement = seat_face + 0.053 - lining_face
    if not 0.07 <= displacement <= 0.14:
        raise ValueError("The passage wall and panel are no longer in their surveyed locations")
    light = next((line for line in config["installationLines"] if line["id"] == LINE), None)
    if light is None:
        raise ValueError("The lined cove needs its existing scheduled source")

    for key, obj in pieces.items():
        if key == "backing":
            # The thickened back retains its original bearing into the jamb
            # where the passage turns. Its new front meets the moved boards.
            xs = _vertices_x(obj)
            midway = 0.5 * (min(xs) + max(xs))
            delta = obj.matrix_world.inverted().to_3x3() @ Vector((displacement, 0, 0))
            for v, x in zip(obj.data.vertices, xs):
                if x > midway:
                    v.co += delta
            obj.data.update()
        else:
            matrix = obj.matrix_world.copy()
            matrix.translation.x += displacement
            obj.matrix_world = matrix
    for end in ("a", "b"):
        light[end][0] = round(light[end][0] + displacement, 5)
    return {"stoneX": seat_face, "boardX": lining_face + displacement, "shift": displacement}


def _tile_wet_return(scene):
    tile = scene.objects[POOL_MOSAIC].data.materials[0]
    if tile.name != "Basin · tidal glass tesserae":
        raise ValueError("The retained tiled floor must supply the same packed inlay atlas")

    pool = scene.objects[POOL_STONE]
    mesh, matrix = pool.data, pool.matrix_world
    normal_matrix = matrix.to_3x3().inverted().transposed()
    positions = [matrix @ v.co for v in mesh.vertices]
    wet = []
    for face in mesh.polygons:
        vertices = [positions[i] for i in face.vertices]
        normal = (normal_matrix @ face.normal).normalized()
        if normal.x > 0.45 and all(
            -3.306 <= v.x <= -3.299 and -1.101 <= v.y <= 1.301 and -1.441 <= v.z <= -0.333
            for v in vertices
        ):
            wet.append(face)
    if len(wet) != 9:
        raise ValueError(f"The sun-shelf return needs its one wet face and eight bevel faces, got {len(wet)}")

    # These are only the x-facing pieces at the inside sun-shelf return.
    # Reuse the wall third of the existing world-aligned basin inlay atlas.
    material_slot = mesh.materials.find(tile.name)
    if material_slot < 0:
        mesh.materials.append(tile)
        material_slot = len(mesh.materials) - 1
    uv = mesh.uv_layers.active or mesh.uv_layers.new(name="Basin stone setting")
    for face in wet:
        face.material_index = material_slot
        for i in face.loop_indices:
            point = positions[mesh.loops[i].vertex_index]
            uv.data[i].uv = ((point.y + 2.1) / 10.8, 2 / 3 + (point.z + 1.44) / 4.065)
    mesh.update()
    return [face.index for face in wet]


def _remove_overhead_slats(scene):
    # The old single portal retained twelve short planks after its broad head
    # came down. Their shadows also printed as dark rectangles on the new glass.
    portal = scene.objects[OLD_PORTAL]
    mesh = bmesh.new()
    try:
        mesh.from_mesh(portal.data)
        slats = []
        for island in _islands(mesh):
            points = [portal.matrix_world @ v.co for v in island]
            if all(
                -1.412 <= p.x <= 1.116 and -31.630 <= p.y <= -30.780 and 10.445 <= p.z <= 10.505
                for p in points
            ):
                slats.append(island)
        if len(slats) != 12:
            raise ValueError(f"Expected the twelve redundant portal planks, got {len(slats)}")
        bmesh.ops.delete(mesh, geom=[v for slat in slats for v in slat], context="VERTS")
        mesh.to_mesh(portal.data)
        portal.data.update()
    finally:
        mesh.free()
    return len(slats)


def refine_passage_finishes(scene, config):
    if scene.get(MARK):
        return
    witness = _place_lining(scene, config)
    faces = _tile_wet_return(scene)
    slats = _remove_overhead_slats(scene)
    scene[MARK] = 1
    return {"lining": witness, "tiledPoolFaces": faces, "removedPortalSlats": slats}
