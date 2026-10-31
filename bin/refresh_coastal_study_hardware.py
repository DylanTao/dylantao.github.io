"""Fit the retained study hardware without rebuilding its desk or room.

Run with exact Blender 4.5.9 and --python-exit-code 1. The default writes a
private candidate. A coordinator may call migrate(scene) on a later accepted
native scene; unchanged hardware islands, topology and finish attributes are
required. Bake the moved study, export it and refresh light metadata separately.
"""

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
SOURCE = Path(ARGS.get("source", str(ROOT / "artwork/coastal-home/coastal-home.blend")))
OUT = Path(ARGS.get("out", str(ROOT / ".jekyll-cache/visual-qa/study-hardware")))

# Native coordinates are Z-up; the runtime maps (x,y,z) to (x,z,-y).
# These closed boxes contain complete authored islands, never a vertex slice.
REGIONS = {
    "primary": ((-11.86, -5.35, .879), (-11.62, -4.35, 1.55)),
    "secondary": ((-11.84, -6.18, .879), (-11.20, -5.70, 1.41)),
    "laptop": ((-11.66, -4.28, .879), (-11.15, -3.78, 1.12)),
    "tower": ((-10.94, -7.03, -.001), (-10.46, -6.77, .51)),
}
EXPECTED = {
    "primary": {"matte black device": (320, 4), "monitor screen glass": (8, 1), "screen code blue light": (32, 4),
                "screen code light": (112, 14), "screen code warm light": (32, 4)},
    "secondary": {"matte black device": (320, 4), "monitor screen glass": (8, 1), "screen code blue light": (24, 3),
                  "screen code light": (80, 10), "screen code warm light": (24, 3)},
    "laptop": {"black magnesium laptop": (192, 2), "matte black device": (8, 1), "monitor screen glass": (8, 1),
               "screen code blue light": (24, 3), "screen code light": (48, 6)},
    "tower": {"matte black device": (1368, 21), "pc black steel": (672, 7), "pc circuit board": (96, 1),
              "pc rgb glow": (1016, 15), "pc tempered glass": (96, 1), "rtx graphite shroud": (96, 1)},
}
TARGET_INCHES = {"primary": 43., "secondary": 31.5, "laptop": 17.}
INPUT_SIGNATURES = {
    "primary": "616f5891beb79a069e428d72ddd678c40a00a0534d8e08f390f89fe21fe0f807",
    "secondary": "4495b2765c912ef094708fcaaa2bbf531c83a5f2aebf525b1f90e1c166bc257a",
    "laptop": "5c424dec7e4061dc6e9e67ac8c1e8bc8405a0876f2e0a2c5d3ad8af5837cffa0",
    "tower": "29608adef9b93198a11458c4998e7fded6cc79a8650c7e131958b9d5204af2ad",
}
# Scale complete assemblies about their support plane. Only the primary needs
# translation: its old foot overhung the back edge of the marble slab by 7 cm.
PIVOTS = {"primary": (-11.75, -4.85, .88), "secondary": (-11.58082, -6.01166, .88), "laptop": (-11.38, -4.06, .88)}
SHIFTS = {"primary": (.12, 0., 0.), "secondary": (0., 0., 0.), "laptop": (0., 0., 0.), "tower": (0., .86, 0.)}


def islands(mesh):
    parent = list(range(len(mesh.vertices)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for edge in mesh.edges:
        a, b = map(find, edge.vertices)
        if a != b:
            parent[b] = a
    groups = {}
    for i in range(len(parent)):
        groups.setdefault(find(i), []).append(i)
    return list(groups.values())


def world_points(obj, indices):
    local = np.array([obj.data.vertices[i].co[:] for i in indices], dtype=np.float64)
    matrix = np.array(obj.matrix_world, dtype=np.float64)
    return local @ matrix[:3, :3].T + matrix[:3, 3]


def diagonal(points):
    """Use the actual active-glass plane, including the laptop's retained lean."""
    centered = points - points.mean(axis=0)
    values, axes = np.linalg.eigh(np.cov(centered.T))
    spans = np.ptp(centered @ axes[:, np.argsort(values)[::-1]], axis=0)
    return float(np.hypot(spans[0], spans[1]) / .0254), spans.tolist()


def select(scene):
    groups = {name: {} for name in REGIONS}
    found = {name: {} for name in REGIONS}
    materials = set().union(*(set(items) for items in EXPECTED.values()))
    for material in sorted(materials):
        obj = scene.objects.get("study__" + material)
        if obj is None or obj.type != "MESH" or [m.name for m in obj.data.materials] != [material]:
            raise RuntimeError(f"Missing exact retained hardware owner: {material}")
        for component in islands(obj.data):
            points = world_points(obj, component)
            low, high = points.min(axis=0), points.max(axis=0)
            owners = [name for name, (lo, hi) in REGIONS.items() if np.all(low >= lo) and np.all(high <= hi)]
            if len(owners) > 1:
                raise RuntimeError("Ambiguous hardware component")
            if not owners:
                continue
            name = owners[0]
            if material not in EXPECTED[name]:
                raise RuntimeError(f"Unexpected {material} component in {name}")
            groups[name].setdefault(obj.name, []).extend(component)
            count, pieces = found[name].get(material, (0, 0))
            found[name][material] = (count + len(component), pieces + 1)
    if found != EXPECTED:
        raise RuntimeError(f"Hardware layout/counts changed: {found}")
    for group in groups.values():
        for name, indices in group.items():
            selected = set(indices)
            if any(not (set(p.vertices) <= selected or set(p.vertices).isdisjoint(selected)) for p in scene.objects[name].data.polygons):
                raise RuntimeError(f"Hardware selection cuts a polygon: {name}")
    return groups


def hardware_signatures(scene, groups):
    result = {}
    for group, objects in groups.items():
        digest = hashlib.sha256()
        for name, indices in sorted(objects.items()):
            digest.update(name.encode())
            digest.update(world_points(scene.objects[name], sorted(indices)).astype("<f4").tobytes())
        result[group] = digest.hexdigest()
    return result


def immutable_scene_digest(scene, selected):
    """All scene mesh coordinates except selected points, plus all attributes.

    Hash RNA arrays directly: no bmesh rewrite, merge, normal re-encoding,
    material replacement, triangulation, UV change or vertex-colour rewrite.
    """
    digest = hashlib.sha256()
    for obj in sorted(scene.objects, key=lambda item: item.name):
        digest.update(json.dumps({"name": obj.name, "type": obj.type, "matrix": [list(row) for row in obj.matrix_world],
                                  "hide": [obj.hide_render, obj.hide_viewport], "data": obj.data.name if obj.data else None}, sort_keys=True).encode())
        if obj.type != "MESH":
            continue
        mesh = obj.data
        digest.update(json.dumps({"materials": [m.name if m else None for m in mesh.materials],
                                  "polygons": [(len(p.vertices), p.material_index, p.use_smooth) for p in mesh.polygons]}, sort_keys=True).encode())
        for attr in mesh.attributes:
            digest.update(f"{attr.name}|{attr.domain}|{attr.data_type}|{len(attr.data)}".encode())
            if not len(attr.data):
                continue
            for prop in attr.data[0].bl_rna.properties:
                if prop.identifier == "rna_type" or prop.type not in ("INT", "FLOAT", "BOOLEAN"):
                    continue
                width = prop.array_length if getattr(prop, "is_array", False) else 1
                values = np.empty(len(attr.data)*width, dtype=np.float32 if prop.type == "FLOAT" else np.int32 if prop.type == "INT" else np.bool_)
                attr.data.foreach_get(prop.identifier, values)
                if attr.name == "position" and obj.name in selected:
                    values.reshape((-1, width))[selected[obj.name]] = 0
                digest.update(prop.identifier.encode())
                digest.update(values.tobytes())
    return digest.hexdigest()


def migrate(scene):
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("Use exact Blender 4.5.9")
    if scene.get("studyHardwareRevision"):
        raise RuntimeError("Study hardware has already been fitted")
    groups = select(scene)
    signatures = hardware_signatures(scene, groups)
    if signatures != INPUT_SIGNATURES:
        raise RuntimeError(f"The retained hardware geometry changed: {signatures}")
    selected = {}
    for group in groups.values():
        for name, indices in group.items():
            selected.setdefault(name, []).extend(indices)
    selected = {name: sorted(indices) for name, indices in selected.items()}
    if any(len(indices) != len(set(indices)) for indices in selected.values()):
        raise RuntimeError("Overlapping hardware ownership")
    before = immutable_scene_digest(scene, selected)
    old_normals = {name: np.array([n.vector[:] for n in scene.objects[name].data.corner_normals], dtype=np.float32) for name in selected}
    receipt = {"units": "meters; native Z-up", "targetsActiveGlassInches": TARGET_INCHES,
               "inputHardwareSignatures": signatures, "assemblies": {}, "unchangedSceneDigestBefore": before}
    for group, objects in groups.items():
        all_before = np.concatenate([world_points(scene.objects[name], indices) for name, indices in objects.items()])
        old_diagonal, spans = diagonal(world_points(scene.objects["study__monitor screen glass"], objects["study__monitor screen glass"])) if group in TARGET_INCHES else (None, None)
        scale = TARGET_INCHES[group]/old_diagonal if old_diagonal else 1.
        pivot = Vector(PIVOTS[group]) if group in PIVOTS else Vector((0, 0, 0))
        shift = Vector(SHIFTS[group])
        for name, indices in objects.items():
            obj = scene.objects[name]
            matrix = np.array(obj.matrix_world, dtype=np.float64)
            inverse = np.linalg.inv(matrix)
            local_pivot = inverse[:3, :3] @ np.array(pivot) + inverse[:3, 3]
            local_shift = inverse[:3, :3] @ np.array(shift)
            # Calculate the similarity in local double precision. Repeated
            # mathutils world/local float32 round trips perturb thin code
            # ribbons unnecessarily at the library's offset from the origin.
            for i in indices:
                point = np.array(obj.data.vertices[i].co[:], dtype=np.float64)
                obj.data.vertices[i].co = local_pivot + scale*(point-local_pivot) + local_shift
            obj.data.update()
        all_after = np.concatenate([world_points(scene.objects[name], indices) for name, indices in objects.items()])
        new_diagonal, new_spans = diagonal(world_points(scene.objects["study__monitor screen glass"], objects["study__monitor screen glass"])) if old_diagonal else (None, None)
        if new_diagonal and not math.isclose(new_diagonal, TARGET_INCHES[group], abs_tol=.0001):
            raise RuntimeError(f"Wrong actual glass diagonal: {group} {new_diagonal}")
        receipt["assemblies"][group] = {"vertices": len(all_before), "meshes": {name: len(indices) for name, indices in objects.items()},
                                           "boundsBefore": [all_before.min(axis=0).tolist(), all_before.max(axis=0).tolist()],
                                           "boundsAfter": [all_after.min(axis=0).tolist(), all_after.max(axis=0).tolist()],
                                           "diagonalInchesBefore": old_diagonal, "diagonalInchesAfter": new_diagonal,
                                           "activeGlassSpansBefore": spans, "activeGlassSpansAfter": new_spans,
                                           "uniformScale": scale, "nativePivot": list(pivot), "nativeTranslation": list(shift)}
    after = immutable_scene_digest(scene, selected)
    if after != before:
        raise RuntimeError("Unselected scene geometry, topology or finish attributes changed")
    normal_evidence = {}
    for name, indices in selected.items():
        mesh = scene.objects[name].data
        normals = np.array([n.vector[:] for n in mesh.corner_normals], dtype=np.float32)
        chosen = set(indices)
        mask = np.array([loop.vertex_index in chosen for loop in mesh.loops])
        delta = np.linalg.norm(normals-old_normals[name], axis=1)
        outside = float(delta[~mask].max(initial=0))
        inside = float(delta[mask].max(initial=0))
        selected_degrees = math.degrees(2*math.asin(min(1., inside/2)))
        # Short2 stores normals relative to a geometric reference frame. Its
        # raw bytes stay exact; intentionally moved float32 vertices can alter
        # that frame minutely. This selected-only .05-degree limit was reviewed
        # separately; every unselected corner must still have exact zero drift.
        if outside != 0 or selected_degrees > .05:
            raise RuntimeError(f"Effective normal drift: {name} outside={outside} selectedDegrees={selected_degrees}")
        normal_evidence[name] = {"unselectedCornerMaximumDelta": outside, "selectedCornerMaximumDelta": inside,
                                 "selectedCornerMaximumDegrees": selected_degrees,
                                 "customNormalStorage": mesh.attributes.get("custom_normal").data_type if mesh.attributes.get("custom_normal") else None}
    scene["studyHardwareRevision"] = 1
    receipt.update({"unchangedSceneDigestAfter": after, "effectiveNormals": normal_evidence,
                    "topologyMaterialAndFinishAttributesExact": True,
                    "next": "Re-bake study vertex contact/bounce, export room-study and regenerate official light/support/loading products before publication"})
    return receipt


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    destination = OUT / "candidate.blend"
    if destination.resolve() == SOURCE.resolve() or destination.resolve() == (ROOT / "artwork/coastal-home/coastal-home.blend").resolve():
        raise RuntimeError("Candidate output must not replace a source")
    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    receipt = migrate(bpy.context.scene)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(destination), compress=True)
    receipt.update({"sourceBeforeSha256": source_hash, "sourceAfterSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
                    "sourceOut": str(destination)})
    (OUT / "receipt.json").write_text(json.dumps(receipt, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps(receipt), flush=True)


if __name__ == "__main__":
    main()
