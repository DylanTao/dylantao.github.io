"""The 4K character finish (Sirui, 2026-10-24: "the character geomtry is still rough, like you
literally see the lizard face"). Focused refreshes of the retained avatar sources; the skeleton,
the fourteen clips, the eyes and eyelids, hair and glasses stay as they are.

- Lizard face: the head skin was sculpted as welded spheres (a 6 mm remesh reduced to 28 %), and the
  open mouth was cut through those coarse triangles, so its lips zigzag and the muzzle creases read
  crude at 4K. The skin is rebuilt as one finer continuous surface (a 3.2 mm voxel remesh of the same
  volume, relaxed and reduced to about the old count), and the same mouth is cut again with the
  original tool, read back from the mouth's lining: the same open smile, lining and tongue, now with
  a clean rim and softened lips.
- Sleeves (--sleeves): under the T-shirt the upper-arm skin took the arm's weights while the cloth
  blends into the spine, so a raised arm pushed skin through the sleeve. Covered arm skin then takes
  the nearest cloth's weights, so it moves with the sleeve. Geometry is unchanged.

Rigidity holds: every new head vertex is weighted to Head alone, and no triangle mixes the head
with the body (the first-person Walk view clips the head by that binding).

Run from the repository root with Blender 4.5 LTS:
  blender -b --python-exit-code 1 --python bin/refresh_coastal_character_finish.py -- --avatar=lizard
  ... --no-export        update and check the source only
  ... --scratch=<dir>    write the source and GLB there instead (the repository stays untouched)
"""

import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
STYLES = ("lizard", "south-park", "simpsons", "ghibli", "rick-and-morty")
requested = [a.split("=", 1)[1] for a in ARGS if a.startswith("--avatar=")] or list(STYLES)
EXPORT = "--no-export" not in ARGS
SLEEVES = "--sleeves" in ARGS
SCRATCH = next((Path(a.split("=", 1)[1]) for a in ARGS if a.startswith("--scratch=")), None)
REPORT = ROOT / "artwork" / "coastal-home" / "reviews" / "life-2026-10-24" / "character-finish.json"


def select_only(objects, active):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active


def group_weight(vertex, index):
    return next((g.weight for g in vertex.groups if g.group == index), 0.0)


def split_faces(obj, keep):
    """A new object holding the faces `keep(polygon)` selects, removed from `obj`."""
    select_only([obj], obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    for f in bm.faces:
        f.select = False
    for v in bm.verts:
        v.select = False
    count = 0
    for f in bm.faces:
        if keep(f):
            f.select = True
            count += 1
    bmesh.update_edit_mesh(obj.data)
    if count:
        bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    if not count:
        return None
    return next(o for o in bpy.context.selected_objects if o is not obj)


# ── Lizard face ──────────────────────────────────────────────────────────────────────────────────


def ellipsoid(name, centre, radii, segments=96, rings=48):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=centre)
    obj = bpy.context.object
    obj.name = name
    obj.scale = radii
    select_only([obj], obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def lizard_face(arm, mesh):
    """The same face and the same open mouth, on a finer, continuous skin with clean lips."""
    me = mesh.data
    head = mesh.vertex_groups["Head"].index
    mats = {m.name: i for i, m in enumerate(me.materials)}
    skin_index = mats["skin"]

    def is_head_skin(f):
        return f.material_index == skin_index and all(group_weight(me.vertices[v.index], head) > 0.999 for v in f.verts)

    # The mouth's dark lining (an ellipsoid left whole inside the head) places the original mouth
    # tool: in bin/coastal_sculpt.py it sat 6.6 cm in front of the lining and 2 mm higher, with radii
    # (0.129, 0.16, 0.063) against the lining's (0.119, 0.085, 0.052), in the same head scale.
    lining = [mesh.matrix_world @ me.vertices[v].co for p in me.polygons if p.material_index == mats["mouth"] for v in p.vertices]
    lo = Vector([min(c[i] for c in lining) for i in range(3)])
    hi = Vector([max(c[i] for c in lining) for i in range(3)])
    centre, half = (lo + hi) / 2, (hi - lo) / 2
    k = half.x / 0.119
    assert abs(half.y / 0.085 - k) < 0.02 and abs(half.z / 0.052 - k) < 0.02, (half, k)
    tool_centre = centre + Vector((0.0, -0.066 * k, 0.002 * k))
    tool_radii = (0.129 * k, 0.16 * k, 0.063 * k)

    skin = split_faces(mesh, is_head_skin)
    before = len(skin.data.polygons)
    # One continuous skin: the welded spheres' volume remeshed finely and relaxed, which also
    # rounds the creases where the spheres met; then reduced to about the old face count.
    select_only([skin], skin)
    skin.data.remesh_voxel_size = 0.0032
    skin.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()
    relax = skin.modifiers.new("relaxed skin", "SMOOTH")
    relax.factor = 0.5
    relax.iterations = 10
    bpy.ops.object.modifier_apply(modifier=relax.name)
    reduce = skin.modifiers.new("reduce", "DECIMATE")
    reduce.ratio = min(1.0, 15000 / max(1, len(skin.data.polygons)))
    bpy.ops.object.modifier_apply(modifier=reduce.name)
    # The same mouth, cut again: its rim now follows the smooth surface, not the old triangles.
    tool = ellipsoid("mouth tool", tool_centre, tool_radii)
    select_only([skin], skin)
    cut = skin.modifiers.new("open mouth", "BOOLEAN")
    cut.operation = "DIFFERENCE"
    cut.solver = "EXACT"
    cut.object = tool
    bpy.ops.object.modifier_apply(modifier=cut.name)
    bpy.data.objects.remove(tool, do_unlink=True)
    # Soft lips: the skin within a few millimetres of the mouth tool's surface is relaxed, rounding
    # the rim where the face turns into the mouth.
    lips = skin.vertex_groups.new(name="lips")
    near = []
    for v in skin.data.vertices:
        d = skin.matrix_world @ v.co - tool_centre
        r = math.sqrt((d.x / tool_radii[0]) ** 2 + (d.y / tool_radii[1]) ** 2 + (d.z / tool_radii[2]) ** 2)
        if 0.96 < r < 1.09:
            near.append(v.index)
    lips.add(near, 1.0, "REPLACE")
    soften = skin.modifiers.new("soft lips", "SMOOTH")
    soften.factor = 0.5
    soften.iterations = 5
    soften.vertex_group = lips.name
    bpy.ops.object.modifier_apply(modifier=soften.name)
    for p in skin.data.polygons:
        p.use_smooth = True
        p.material_index = skin_index
    # Every vertex of the new skin follows Head alone.
    skin.vertex_groups.clear()
    g = skin.vertex_groups.new(name="Head")
    g.add(list(range(len(skin.data.vertices))), 1.0, "REPLACE")
    after = len(skin.data.polygons)
    select_only([mesh, skin], mesh)
    bpy.ops.object.join()
    return {"faceSkinBefore": before, "faceSkinAfter": after, "mouthTool": {"centre": [round(c, 4) for c in tool_centre], "radii": [round(r, 4) for r in tool_radii]}, "lipVertices": len(near)}



# ── Sleeves ──────────────────────────────────────────────────────────────────────────────────────


def sleeve_weights(mesh):
    """Upper-arm skin under the shirt takes the nearest cloth's weights."""
    me = mesh.data
    mats = {m.name: i for i, m in enumerate(me.materials)}
    if "Sirui shirt" not in mats or "skin" not in mats:
        return 0
    shirt, skin = mats["Sirui shirt"], mats["skin"]
    world = mesh.matrix_world
    shirt_faces = [p for p in me.polygons if p.material_index == shirt]
    verts = [world @ v.co for v in me.vertices]
    tree = BVHTree.FromPolygons(verts, [tuple(p.vertices) for p in shirt_faces])
    arm_groups = {mesh.vertex_groups[n].index for n in ("Arm.L", "Arm.R") if n in mesh.vertex_groups}
    skin_verts = {vi for p in me.polygons if p.material_index == skin for vi in p.vertices}
    names = {g.index: g.name for g in mesh.vertex_groups}
    changed = 0
    for vi in skin_verts:
        v = me.vertices[vi]
        if not any(g.group in arm_groups and g.weight > 0.5 for g in v.groups):
            continue
        hit = tree.find_nearest(verts[vi], 0.03)
        if hit[0] is None:
            continue
        # Copy the cloth weights from the nearest shirt face's vertices.
        face = shirt_faces[hit[2]]
        weights = {}
        for fv in face.vertices:
            for g in me.vertices[fv].groups:
                weights[g.group] = weights.get(g.group, 0.0) + g.weight / len(face.vertices)
        for g in list(v.groups):
            mesh.vertex_groups[g.group].remove([vi])
        for group, w in weights.items():
            if w > 0.001:
                mesh.vertex_groups[group].add([vi], w, "REPLACE")
        changed += 1
    return changed


# ── Checks and export ────────────────────────────────────────────────────────────────────────────


def rigidity(mesh):
    me = mesh.data
    rigid = [mesh.vertex_groups[n].index for n in ("Head", "Eye.L", "Eye.R") if n in mesh.vertex_groups]
    partial, mixed = 0, 0
    for v in me.vertices:
        for g in v.groups:
            if g.group in rigid and 1e-4 < g.weight < 1 - 1e-4:
                partial += 1
    head = mesh.vertex_groups["Head"].index
    is_head = [group_weight(v, head) > 0.5 for v in me.vertices]
    for p in me.polygons:
        flags = {is_head[vi] for vi in p.vertices}
        if len(flags) > 1:
            mixed += 1
    return {"partialRigidWeights": partial, "mixedTriangles": mixed}


def export(arm, path):
    for track in arm.animation_data.nla_tracks:
        track.mute = False
    select_only([arm] + [c for c in arm.children if c.type == "MESH"], arm)
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=True,
        export_yup=True, export_animations=True, export_animation_mode="NLA_TRACKS",
        export_force_sampling=True, export_extras=True, export_cameras=False,
        export_lights=False, export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7, export_draco_position_quantization=14,
        export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
    )


def main():
    report = json.loads(REPORT.read_text(encoding="utf-8")) if REPORT.exists() else {"avatars": {}}
    for style in requested:
        source = ROOT / "artwork" / "coastal-home" / f"sirui-{style}.blend"
        target = ROOT / "assets" / "models" / "home" / f"sirui-{style}.glb"
        bpy.ops.wm.open_mainfile(filepath=str(source))
        arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
        mesh = next(o for o in arm.children if o.name == "SiruiMesh")
        before_bytes = target.stat().st_size
        clips = len(arm.animation_data.nla_tracks)
        entry = {"clips": clips, "beforeBytes": before_bytes, "beforeTriangles": sum(len(p.vertices) - 2 for p in mesh.data.polygons)}
        if style == "lizard":
            entry.update(lizard_face(arm, mesh))
            mesh = next(o for o in arm.children if o.name.startswith("SiruiMesh"))
            mesh.name = "SiruiMesh"
        entry["sleeveVertices"] = sleeve_weights(mesh) if SLEEVES else 0
        entry.update(rigidity(mesh))
        assert entry["partialRigidWeights"] == 0 and entry["mixedTriangles"] == 0, entry
        assert len(arm.animation_data.nla_tracks) == clips == 14
        entry["afterTriangles"] = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
        for track in arm.animation_data.nla_tracks:
            track.mute = track.name != "idle"
        bpy.context.scene.frame_set(1)
        bpy.context.preferences.filepaths.save_version = 0
        if SCRATCH:
            SCRATCH.mkdir(parents=True, exist_ok=True)
            source, target = SCRATCH / source.name, SCRATCH / target.name
        bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
        if EXPORT:
            export(arm, target)
            entry["afterBytes"] = target.stat().st_size
        report["avatars"][style] = entry
        print("FINISH", style, json.dumps(entry), flush=True)
    path = SCRATCH / REPORT.name if SCRATCH else REPORT
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
