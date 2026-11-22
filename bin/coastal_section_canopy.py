"""Give only the clifftop vegetation and deck their measured roof ownership.

Roof motion changes render visibility. These parts keep their native places,
materials and supporting stone. Ground rooted on the mainland stays visible.
"""

from collections import Counter, defaultdict
import hashlib
import struct

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

MAINLAND = "core__golden coastal sandstone"
GYM_LID = "core_section_gym__golden coastal sandstone"
OLD_ROOF = "core_retreat_liftaway_roof"
GEOLOGY_ROOFS = ("core_liftaway_cave_ceiling", "core_retreat_liftaway_roof",
                 "core_bathwing_liftaway_roof", "core_estate_library_liftaway_roof",
                 "core_section_")


def support_field(scene):
    """Use the actual native upper rock before any render-only roof movement."""
    vertices, triangles, names = [], [], []
    for obj in scene.objects:
        if obj.type != "MESH" or not (obj.name == MAINLAND or (
            obj.get("caveRoof") and obj.name.startswith(GEOLOGY_ROOFS)
        )):
            continue
        source, transform = obj.data, obj.matrix_world
        offset = len(vertices)
        vertices.extend(transform @ v.co for v in source.vertices)
        source.calc_loop_triangles()
        triangles.extend(tuple(offset + i for i in face.vertices) for face in source.loop_triangles)
        names.extend([obj.name] * len(source.loop_triangles))
    support = BVHTree.FromPolygons(vertices, triangles, all_triangles=True)
    vertical = Vector((0, 0, -1))
    def beneath(point):
        # Follow the actual planting height. Ignore layers several metres away
        # and canopy parts that have already been authored on the shoreline.
        if not (-14 <= point.x <= 12.1 and -17.1 <= point.y <= .2 and point.z >= 5.60):
            return None
        hit, _, face, _ = support.ray_cast(point - vertical * .22, vertical, 1.52)
        if hit is None or names[face] == MAINLAND:
            return None
        return names[face]
    return beneath


def island_bindings(obj, beneath):
    """Keep complete rosettes, stalks and sprays. Groundcover mats follow their faces."""
    mesh, world = obj.data, obj.matrix_world
    groups = defaultdict(set)
    if obj.name in ("core_flora_iceplant", "core_flora_red_iceplant"):
        for face in mesh.polygons:
            owner = beneath(world @ face.center)
            if owner:
                groups[owner].add(face.index)
        return groups
    from coastal_shell import _islands
    bm = bmesh.new()
    bm.from_mesh(mesh)
    for island in _islands(bm):
        points = [world @ v.co for v in island]
        lowest = min(p.z for p in points)
        base = [p for p in points if p.z <= lowest + .075]
        owner = beneath(sum(base, Vector()) / len(base))
        if owner:
            groups[owner].update(f.index for v in island for f in v.link_faces)
    bm.free()
    return groups


def face_ledger(obj):
    """Directed position, UV and colour bytes, independent of vertex numbering."""
    mesh = obj.data
    uvs = list(mesh.uv_layers)
    fields = [field for field in mesh.color_attributes if field.domain == "CORNER"]
    unique = Counter()
    for face in mesh.polygons:
        corner = []
        for i in face.loop_indices:
            values = list(mesh.vertices[mesh.loops[i].vertex_index].co)
            for uv in uvs:
                values.extend(uv.data[i].uv)
            for field in fields:
                values.extend(field.data[i].color)
            corner.append(struct.pack(f"<{len(values)}f", *values))
        directed = min(corner[i:] + corner[:i] for i in range(len(corner)))
        material = mesh.materials[face.material_index]
        label = material.name.encode("utf-8") if material else b""
        unique[bytes((int(face.use_smooth),)) + struct.pack("<I",len(corner)) + label + b"\x00" + b"".join(directed)] += 1
    return unique


def keep_faces(obj, selected):
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.delete(mesh, geom=[face for face in mesh.faces if face.index not in selected], context="FACES")
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()


def attach(scene):
    beneath = support_field(scene)
    vegetation = [obj for obj in scene.objects if obj.type == "MESH" and
                  not obj.get("cutawayVegetationSupport") and (obj.name.startswith("core_flora_") or
                      obj.name == "core__blue sage agave leaf")]
    report = {"deck": [], "flora": []}
    for name in [obj.name for obj in scene.objects if obj.type == "MESH" and
                 obj.name.startswith("core_retreat_clifftop__")]:
        scene.objects[name]["cutawayCompanionSupport"] = GYM_LID
        report["deck"].append(name)

    for source in vegetation:
        groups = island_bindings(source,beneath)
        if not groups:
            continue
        selected = set().union(*groups.values())
        before = face_ledger(source)
        original_name = source.name
        pieces = []
        for index, (roof, faces) in enumerate(sorted(groups.items()), 1):
            obj = source.copy()
            obj.data = source.data.copy()
            scene.collection.objects.link(obj)
            obj.name = obj.data.name = f"{original_name[:49]}_section_{index:02d}"
            obj["cutawayVegetationSupport"] = roof
            keep_faces(obj,faces)
            pieces.append(obj)
        keep_faces(source, set(range(len(source.data.polygons))) - selected)
        received = Counter()
        for obj in [source, *pieces]:
            received.update(face_ledger(obj))
        if before != received:
            raise RuntimeError("Roof binding moved or changed a plant face: " + original_name)
        if not len(source.data.polygons):
            bpy.data.objects.remove(source, do_unlink=True)
        signature = hashlib.sha256()
        for key, count in sorted(before.items()):
            signature.update(key)
            signature.update(struct.pack("<I",count))
        report["flora"].append({"source":original_name,"faceLineage":signature.hexdigest(),
                                "faces":sum(before.values()), "attached":[[o.name,o["cutawayVegetationSupport"],
                                                                           len(o.data.polygons)] for o in pieces]})
    if not report["deck"] or not report["flora"]:
        raise RuntimeError("Expected native clifftop companion surfaces and plants")
    return report


def attach_estate_garden(scene):
    """Carry the part of the clifftop meadow which stands on the lifted rock."""
    marker = "estateGardenSectionOwners"
    if scene.get(marker):
        return []
    beneath = support_field(scene)
    reports = []
    sources = [
        obj for obj in scene.objects if obj.type == "MESH"
        and obj.name.startswith(("core_estate_garden__", "core_estate_garden_flora_"))
        and not obj.get("cutawayCompanionSupport") and not obj.get("cutawayVegetationSupport")
    ]
    for obj in sources:
        # Ground-hugging ribbons and mulch cross the true ownership line;
        # furniture and leaves follow complete native connected components.
        if any(s in obj.name for s in ("travertine paving stone", "garden mineral mulch")):
            groups = defaultdict(set)
            for face in obj.data.polygons:
                owner = beneath(obj.matrix_world @ face.center)
                if owner:
                    groups[owner].add(face.index)
        else:
            groups = island_bindings(obj, beneath)
        if not groups:
            continue
        original_name = obj.name
        geometry = face_ledger(obj)
        all_faces = set(range(len(obj.data.polygons)))
        fixed = all_faces - set().union(*groups.values())
        tag = "cutawayVegetationSupport" if obj.get("flora") else "cutawayCompanionSupport"
        retained = []
        if not fixed and len(groups) == 1:
            obj[tag] = next(iter(groups))
            retained.append(obj)
        else:
            for index, (roof, faces) in enumerate(sorted(groups.items()), 1):
                part = obj.copy()
                part.data = obj.data.copy()
                scene.collection.objects.link(part)
                part.name = f"{original_name[:49]}_seat_{index:02d}"
                part.data.name = part.name
                part[tag] = roof
                keep_faces(part, faces)
                retained.append(part)
            if fixed:
                keep_faces(obj, fixed)
                retained.append(obj)
            else:
                bpy.data.objects.remove(obj, do_unlink=True)
        received = Counter()
        for part in retained:
            received.update(face_ledger(part))
        if received != geometry:
            raise RuntimeError("Section support changed an original garden face: " + original_name)
        reports.append({
            "source": original_name,
            "fixedFaces": len(fixed),
            "owners": {name: len(faces) for name, faces in groups.items()},
        })
    scene[marker] = 1
    return reports
