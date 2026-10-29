"""Move the complete retained lounge foot pouf with its already shifted seat.

Candidate output is the default. This migration never rebuilds the furnished
room, changes a rig, or stretches a leg. Bake and export the changed room after
review, and regenerate the official static-light cache before publication.
"""
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
SOURCE = Path(ARGS.get("source", str(ROOT / "artwork/coastal-home/coastal-home.blend")))
OUT = Path(ARGS.get("out", str(ROOT / ".jekyll-cache/visual-qa/foot-pouf")))


def migrate(scene):
    if scene.get("footPoufRevision"):
        raise RuntimeError("The retained foot pouf has already been migrated")
    obj = scene.objects.get("lounge__ochre knit textile")
    if obj is None or obj.type != "MESH" or [m.name for m in obj.data.materials] != ["ochre knit textile"]:
        raise RuntimeError("Expected the exact retained knit-pouf owner")
    mesh = obj.data
    adjacency = [set() for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        adjacency[a].add(b)
        adjacency[b].add(a)
    pending, islands = set(range(len(mesh.vertices))), []
    while pending:
        seed = pending.pop()
        island, stack = {seed}, [seed]
        while stack:
            for other in adjacency[stack.pop()]:
                if other in pending:
                    pending.remove(other)
                    island.add(other)
                    stack.append(other)
        points = [obj.matrix_world @ mesh.vertices[i].co for i in island]
        lo = [min(p[k] for p in points) for k in range(3)]
        hi = [max(p[k] for p in points) for k in range(3)]
        if len(island) == 280 and all(abs(a-b) < .0001 for a, b in zip(lo, [-.43, -8.26, -.408])) and all(abs(a-b) < .0001 for a, b in zip(hi, [.13, -7.70, -.263])):
            islands.append((island, lo, hi))
    if len(islands) != 1:
        raise RuntimeError(f"Expected one complete 280-vertex foot pouf, got {len(islands)}")
    selected, lo, hi = islands[0]
    if any(not (set(p.vertices) <= selected or set(p.vertices).isdisjoint(selected)) for p in mesh.polygons):
        raise RuntimeError("The selected pouf must own complete polygons")
    normals = [n.vector.copy() for n in mesh.corner_normals]
    original_vertices = [v.co.copy() for v in mesh.vertices]
    original_normals = [n.copy() for n in normals]
    bottom, top = lo[2], -.2766
    scale = (top-bottom)/(hi[2]-bottom)
    inverse = obj.matrix_world.inverted()
    local_normal = obj.matrix_world.to_3x3().transposed() @ Matrix.Diagonal(Vector((1, 1, 1/scale))) @ obj.matrix_world.to_3x3().inverted().transposed()
    for i in selected:
        point = obj.matrix_world @ mesh.vertices[i].co
        point.x += .25
        point.y -= .12
        point.z = bottom + (point.z-bottom)*scale
        mesh.vertices[i].co = inverse @ point
    for loop in mesh.loops:
        if loop.vertex_index in selected:
            normals[loop.index] = (local_normal @ normals[loop.index]).normalized()
    # Blender4.5 FREE corner normals retain untouched vectors exactly. Calling
    # normals_split_custom_set here would re-encode every corner in short2.
    previous = mesh.attributes.get("custom_normal")
    if previous:
        mesh.attributes.remove(previous)
    field = mesh.attributes.new("custom_normal", "FLOAT_VECTOR", "CORNER")
    field.data.foreach_set("vector", [x for n in normals for x in n])
    mesh.update()
    if any(mesh.vertices[i].co != original_vertices[i] for i in range(len(mesh.vertices)) if i not in selected):
        raise RuntimeError("An unrelated pouf vertex changed")
    outside_normal_delta = max(((mesh.corner_normals[i].vector-original_normals[i]).length for i, loop in enumerate(mesh.loops) if loop.vertex_index not in selected), default=0)
    if outside_normal_delta != 0:
        raise RuntimeError(f"An unrelated pouf corner normal changed: {outside_normal_delta}")
    scene["footPoufRevision"] = 1
    return {"mesh": obj.name, "vertices": len(selected), "nativeBeforeBounds": [lo, hi],
            "worldTranslationM": [.25, 0, .12], "nativeBottomM": bottom, "nativeTopM": top,
            "heightScale": scale, "outsideCornerNormalDelta": outside_normal_delta,
            "intent": "The complete real foot support follows the existing lounge seat; actor, clips and leg lengths stay exact"}


def main():
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("Use exact Blender4.5.9")
    OUT.mkdir(parents=True, exist_ok=True)
    before = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    receipt = migrate(bpy.context.scene)
    destination = ROOT / "artwork/coastal-home/coastal-home.blend" if "--apply" in sys.argv else OUT / "candidate.blend"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(destination), compress=True)
    receipt.update({"sourceBeforeSha256": before, "sourceAfterSha256": hashlib.sha256(destination.read_bytes()).hexdigest(), "sourceOut": str(destination)})
    (OUT / "receipt.json").write_text(json.dumps(receipt, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps(receipt), flush=True)


if __name__ == "__main__":
    main()
