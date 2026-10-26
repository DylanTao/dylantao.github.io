"""A bounded native cliff study: eroded ribs, eased court edges and grounded neighbours.

Default output is an ignored candidate, leaving the canonical scene untouched. Run with exact
Blender 4.5.9, review the candidate, then use --apply to save the same migration canonically.
This edits retained geometry; it never rebuilds the house from an older architectural source.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_shell as shell
from coastal_landscape import cliff_surface, top_height
from coastal_roof_planting import ground_rosettes

VERSION = 1
SOURCE = ROOT / "artwork/coastal-home/coastal-home.blend"
MANIFEST = ROOT / "assets/models/home/manifest.json"
REVIEW = ROOT / ".jekyll-cache/visual-qa/pc-fidelity-2026-10-26/cliff"
APPLY = "--apply" in sys.argv


def tree(obj):
    return BVHTree.FromPolygons([obj.matrix_world @ v.co for v in obj.data.vertices],
                               [list(f.vertices) for f in obj.data.polygons])


def fingerprint(obj):
    h = hashlib.sha256()
    for v in obj.data.vertices:
        h.update((",".join(f"{q:.9f}" for q in obj.matrix_world @ v.co) + ";").encode())
    for f in obj.data.polygons:
        h.update((",".join(map(str, f.vertices)) + f":{f.material_index};").encode())
    return h.hexdigest()


def geology(scene):
    return [o for o in scene.objects if o.type == "MESH" and
            (o.name in ("core__golden coastal sandstone", "coast_shared_golden coastal sandstone")
             or o.get("closedSolid") or o.get("caveRoof")) and not o.get("shadowOnly")]


def sculpt(obj, material):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    inverse = obj.matrix_world.inverted()
    before = {"vertices": len(bm.verts), "faces": len(bm.faces),
              "openEdges": sum(not e.is_manifold for e in bm.edges)}
    # The old outdoor-court cutter left one perfectly flat vertical wall around the arch. Carry
    # both sides of its roof partition through the same map, making a thick, irregular reveal
    # while preserving the opening's X/Z dimensions, the floor and every circulation point.
    def court_vertex(v):
        q=obj.matrix_world@v.co
        return abs(q.y+3.42)<.055 and -8.46<q.x<8.11
    def side_vertex(v):
        q=obj.matrix_world@v.co
        return (abs(q.x+8.43)<.025 or abs(q.x-8.08)<.025) and q.y> -3.45
    court_faces = [f for f in bm.faces if all(court_vertex(v) for v in f.verts)
                   or all(side_vertex(v) for v in f.verts)]
    # An extruded arch face is a concave n-gon. Warping just its perimeter creates a triangular
    # fan, not a rock surface. Tessellate its interior before the contour map; keep all shared
    # boundary vertices so the closed roof and mainland still meet exactly.
    if court_faces:
        bmesh.ops.triangulate(bm,faces=court_faces,quad_method="BEAUTY",ngon_method="BEAUTY")
    for _ in range(5):
        court_edges={e for e in bm.edges if e.calc_length()>.60 and
                     (all(court_vertex(v) for v in e.verts) or all(side_vertex(v) for v in e.verts))}
        if not court_edges:break
        bmesh.ops.subdivide_edges(bm,edges=list(court_edges),cuts=1,use_grid_fill=True)
    for f in bm.faces:
        if all(court_vertex(v) for v in f.verts) or all(side_vertex(v) for v in f.verts): f.smooth=True
    # Refine only the existing exposed face. Upper soil, habitats, the intertidal contact and all
    # interior rooms keep their positions. A half-metre source grid cannot resolve narrow gullies.
    front = [f for f in bm.faces if f.normal.y > .3 and all(
        abs((q := obj.matrix_world @ v.co).y - cliff_surface(q.x, q.z)) < .4
        and -5.6 < q.z < top_height(q.x, q.y) - .55 for v in f.verts)]
    edges = {e for f in front for e in f.edges if e.calc_length() > .32}
    if edges:
        bmesh.ops.subdivide_edges(bm, edges=list(edges), cuts=1, use_grid_fill=True)
    bm.normal_update()
    moved = 0
    contoured = 0
    side_contoured = 0
    maximum = 0
    channels = [(-27.1,.36,.52),(-23.3,.45,.68),(-18.7,.33,.43),(-15.6,.28,.56),
                (-12.4,.40,.66),(-9.4,.31,.48),(-6.1,.26,.54),(-2.8,.37,.46),
                (1.3,.35,.56),(5.7,.42,.62),(10.2,.32,.51),(14.4,.40,.70),
                (18.1,.28,.45),(22.6,.46,.64),(27.3,.35,.53),(32.8,.38,.62)]
    for v in bm.verts:
        q = obj.matrix_world @ v.co
        if (abs(q.x+8.43)<.025 or abs(q.x-8.08)<.025) and q.y> -3.42:
            # Keep both the roof's soil edge and the inhabited library's ceiling fixed. Below
            # the rim, a shallow irregular stone reveal replaces the cutter plane. Add rock toward
            # the court, preserving the thin library roof's outside face and its physical thickness.
            # The back taper also meets the separately contoured arch face without a new seam.
            left = q.x<0
            base = 5.80 if left else 3.52
            floor_blend = min(1.,max(0.,(q.z-base)/.8))
            rim_blend = min(1.,max(0.,(top_height(q.x,q.y)-q.z)/.8))
            back_blend = min(1.,max(0.,(q.y+3.42)/.9))
            relief = .46+.19*math.sin(q.y*.83+q.z*.37)+.10*math.sin(q.y*2.4-q.z*.63)
            q.x += (1 if left else -1)*floor_blend*rim_blend*back_blend*relief
            v.co = inverse@q
            side_contoured += 1
            continue
        if abs(q.y + 3.42) < .055 and -8.46 < q.x < 8.11 and q.z > .35:
            floor_blend = min(1.,max(0.,(q.z-.35)/1.7))
            edge_blend = min(1.,max(0.,(q.x+8.46)/.6),max(0.,(8.11-q.x)/.6))
            relief = .45 + .20*math.sin(q.x*.73+q.z*.31) + .16*math.sin(q.x*1.37-q.z*.54)
            q.y += floor_blend*edge_blend*relief
            v.co = inverse @ q
            contoured += 1
            continue
        if not -29 < q.x < 35 or abs(q.y - cliff_surface(q.x, q.z)) > .4:
            continue
        soil = top_height(q.x, q.y) - q.z
        mask = min(1., max(0., (soil - .55) / .7)) * min(1., max(0., (q.z + 5.6) / .8))
        if mask <= 0:
            continue
        grooves = sum(depth * math.exp(-((q.x - center - .07*math.sin(q.z*.8 + i)) / width)**2)
                      * (.72 + .28*math.sin(q.z*.31 + i*.83)**2)
                      for i, (center, width, depth) in enumerate(channels))
        bedding = .055*math.tanh(math.sin(q.z*4.6 + .12*q.x)*2.)
        delta = mask * (bedding - grooves)
        q.y += delta
        v.co = inverse @ q
        moved += 1
        maximum = max(maximum, abs(delta))
    bm.normal_update()
    # Round the exposed box-cut court/library rims. Partition seams of the lift-away roofs,
    # inhabited interior faces and the basin's bearing plane are explicitly outside this band.
    rims = []
    if obj.name == "core__golden coastal sandstone":
        for edge in bm.edges:
            if len(edge.link_faces) != 2 or edge.calc_length() < .5:
                continue
            a, b = [obj.matrix_world @ v.co for v in edge.verts]
            if min(a.y,b.y) < -3.0 or min(a.z,b.z) < .35 or max(a.z,b.z) > 12:
                continue
            if not all(-13.2 < q.x < 11.7 for q in (a,b)):
                continue
            if any(abs(q.z-5.83)<.04 or abs(q.x+12.8)<.04 or abs(q.x-11.25)<.04 for q in (a,b)):
                continue
            if edge.calc_face_angle() > math.radians(52):
                rims.append(edge)
    if rims:
        bmesh.ops.bevel(bm, geom=rims, offset=.34, offset_type="OFFSET", segments=4,
                        profile=.5, affect="EDGES", clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    mat_index = len(obj.data.materials)
    obj.data.materials.append(material)
    painted = 0
    for f in bm.faces:
        points = [obj.matrix_world @ v.co for v in f.verts]
        center = sum(points, Vector()) / len(points)
        external = (f.normal.y > .25 and abs(center.y - cliff_surface(center.x, center.z)) < 1.15)
        court = -13.3 < center.x < 11.8 and center.y > -3.5 and abs(f.normal.z) < .7
        if external or court:
            f.material_index = mat_index
            painted += 1
    after_open = sum(not e.is_manifold for e in bm.edges)
    if after_open > before["openEdges"]:
        bm.free()
        raise RuntimeError(f"Cliff study introduced open/nonmanifold edges on {obj.name}: {before['openEdges']} -> {after_open}")
    bm.to_mesh(obj.data)
    bm.free()
    if obj.data.has_custom_normals:
        obj.data.normals_split_custom_set([(0.,0.,0.)]*len(obj.data.loops))
    obj.data.update()
    return {"mesh": obj.name, "before": before, "after": {"vertices": len(obj.data.vertices),
            "faces": len(obj.data.polygons), "openEdges": after_open}, "displacedVertices": moved,
            "maximumDisplacement": maximum, "contouredCourtVertices": contoured,
            "contouredSideVertices": side_contoured,
            "easedRimEdges": len(rims), "exteriorFaces": painted}


def move_chimney_rosette(scene):
    cap = scene.objects["core_fireplace_cap__golden coastal sandstone"]
    plants = [o for o in scene.objects if o.type == "MESH" and
              (o.name == "core__blue sage agave leaf" or o.get("roofPlanting"))]
    groups = {}
    for obj in plants:
        bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table()
        for island in shell._islands(bm):
            points = [obj.matrix_world @ v.co for v in island]
            bottom = min(q.z for q in points)
            roots = [q for q in points if q.z < bottom + .015]
            root = sum(roots, Vector()) / len(roots)
            groups.setdefault(tuple(round(q,3) for q in root), []).append((obj, [v.index for v in island], root))
        bm.free()
    changed = []
    for entries in groups.values():
        root = sum((e[2] for e in entries), Vector()) / len(entries)
        if math.hypot(root.x-1., root.y+7.1) > 2.:
            continue
        points = [obj.matrix_world @ obj.data.vertices[i].co for obj, indices, _ in entries for i in indices]
        lo = Vector(tuple(min(p[k] for p in points) for k in range(3)))
        hi = Vector(tuple(max(p[k] for p in points) for k in range(3)))
        cap_points = [cap.matrix_world @ Vector(q) for q in cap.bound_box]
        cap_lo = Vector(tuple(min(p[k] for p in cap_points) for k in range(3)))
        cap_hi = Vector(tuple(max(p[k] for p in cap_points) for k in range(3)))
        if any(hi[k] < cap_lo[k] or lo[k] > cap_hi[k] for k in range(3)):
            continue
        owner = entries[0][0].get("cutawayVegetationSupport")
        support = scene.objects.get(owner)
        if support is None:
            raise RuntimeError("The chimney rosette lost its roof owner")
        support_tree = tree(support)
        # Both neighbouring rosettes clear the cap as a cluster, preserving their relative plan.
        dx = 2.0
        if lo.x + dx < cap_hi.x + .10:
            raise RuntimeError("The retained two-metre cluster move does not clear the chimney")
        hit = support_tree.ray_cast(root + Vector((dx,0,1.)), Vector((0,0,-1)), 3)[0]
        if hit is None:
            raise RuntimeError("No roof supports the relocated complete rosette")
        delta = Vector((dx,0,hit.z-.022-root.z))
        for obj, indices, _ in entries:
            local = obj.matrix_world.inverted().to_3x3() @ delta
            for i in indices: obj.data.vertices[i].co += local
            obj.data.update()
        changed.append({"rootBefore": list(root), "rootAfter": list(root+delta), "translation": list(delta),
                        "leaves": len(entries), "support": owner, "minimumHorizontalCapClearance": .10})
    if not changed:
        raise RuntimeError("The measured chimney/agave interference was not found")
    return changed


def fit_existing_rosettes(scene):
    """Rigidly fit the complete existing plants before the unchanged strict contact validator."""
    plants = [o for o in scene.objects if o.type == "MESH" and
              (o.name == "core__blue sage agave leaf" or o.get("roofPlanting"))]
    groups = {}
    for obj in plants:
        bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table()
        for island in shell._islands(bm):
            points = [obj.matrix_world @ v.co for v in island]
            bottom = min(p.z for p in points)
            roots = [p for p in points if p.z < bottom+.015]
            root = sum(roots,Vector())/len(roots)
            groups.setdefault(tuple(round(q,3) for q in root), []).append((obj,[v.index for v in island],root))
        bm.free()
    if len(groups) != 32: raise RuntimeError("Complete rosette ownership changed")
    supports = [(o,tree(o)) for o in geology(scene)]
    fitted = []
    for entries in groups.values():
        root = sum((e[2] for e in entries),Vector())/len(entries)
        hits = [(root.z-h.z,o,h) for o,t in supports
                if (h := t.ray_cast(root+Vector((0,0,.25)),Vector((0,0,-1)),2)[0]) is not None]
        gap,owner,hit = min(hits,key=lambda q:q[0])
        if abs(gap) > .10: raise RuntimeError(f"Cliff study displaced plant support excessively: {gap}")
        expected = owner.name if owner.get("caveRoof") else None
        if {o.get("cutawayVegetationSupport") for o,_,_ in entries} != {expected}:
            raise RuntimeError("A plant changed its roof visibility owner")
        dz = hit.z-.022-root.z
        for obj,indices,_ in entries:
            local=obj.matrix_world.inverted().to_3x3()@Vector((0,0,dz))
            for index in indices: obj.data.vertices[index].co += local
            obj.data.update()
        fitted.append({"root":list(root),"translation":[0,0,dz],"support":owner.name})
    return fitted


def relocate_raccoon(scene, config):
    supports = [(o, tree(o)) for o in geology(scene) if not o.get("caveRoof")]
    old = config["terrain"]["habitats"]["raccoon"]["path"]
    path, contacts = [], []
    for x, _, zw in old:
        x -= 2.; zw += 14.
        hits = [(o,h,n) for o,t in supports if (h := (result := t.ray_cast(Vector((x,-zw,30)), Vector((0,0,-1)),40))[0]) is not None
                and (n := result[1]).z > .7]
        if not hits: raise RuntimeError("Raccoon route lost intact visible bedrock")
        obj, hit, normal = max(hits, key=lambda q:q[1].z)
        path.append([round(x,4),round(hit.z+.025,4),round(zw,4)])
        contacts.append({"point": path[-1], "support": obj.name, "normal": list(normal), "caveRoof": False})
    config["terrain"]["habitats"]["raccoon"]["path"] = path
    return {"reason": "Intact mainland remains visible in the house section; the den no longer stands on a removed roof",
            "oldPath": old, "contacts": contacts, "rootClearance": .025}


def main():
    if bpy.app.version != (4,5,9): raise RuntimeError("Use exact Blender 4.5.9")
    REVIEW.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene = bpy.context.scene
    if scene.get("pcCliffIntegrationVersion"):
        raise RuntimeError("This one-time retained-source study is already applied")
    before = {o.name:fingerprint(o) for o in scene.objects if o.type == "MESH"}
    config = json.loads(MANIFEST.read_text(encoding="utf-8"))
    rock = bpy.data.materials["golden coastal sandstone"].copy()
    rock.name = "La Jolla bluff sandstone"
    rock.diffuse_color = (.66,.55,.40,1)
    if rock.use_nodes:
        principled = next(n for n in rock.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        principled.inputs["Base Color"].default_value = (.66,.55,.40,1)
    report = {"sourceBeforeSha256":hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
              "scope":"Retained native outside surfaces; original rooms, floor heights and bearing plane preserved",
              "reference":"California State Parks Torrey Pines photographs 090-P99076 and 090-P99072; references not redistributed"}
    # caveRoof also tags the metal lunette and some plaster ceiling plates. A visibility tag is
    # not a geology classifier: only these retained rock masses may be sculpted.
    rock_names = {"core__golden coastal sandstone", "coast_shared_golden coastal sandstone",
                  "core_liftaway_cave_ceiling", "core_liftaway_cave_ceiling_rear",
                  "core_retreat_liftaway_roof", "core_estate_library_liftaway_roof",
                  "core_bathwing_liftaway_roof"}
    targets = [o for o in geology(scene) if o.name in rock_names]
    bedding = scene.objects.get("coast_shared_warm sandstone bedding")
    if bedding is not None: targets.append(bedding)
    report["cliff"] = [sculpt(o,rock) for o in targets]
    report["rosette"] = move_chimney_rosette(scene)
    report["plantFit"] = fit_existing_rosettes(scene)
    _,report["agaveGrounding"] = ground_rosettes(scene)
    report["raccoon"] = relocate_raccoon(scene,config)
    from coastal_camera import create_camera_height, sample_camera_elevations
    config["cameraCollision"]["elevations"] = sample_camera_elevations(
        config["cameraCollision"],create_camera_height(list(scene.objects)))
    scene["pcCliffIntegrationVersion"] = VERSION
    report["changedMeshes"] = [o.name for o in scene.objects if o.type == "MESH" and before.get(o.name) != fingerprint(o)]
    target = SOURCE if APPLY else REVIEW/"candidate.blend"
    target_manifest = MANIFEST if APPLY else REVIEW/"manifest.json"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
    target_manifest.write_text(json.dumps(config,indent=2)+"\n",encoding="utf-8",newline="\n")
    report["sourceAfterSha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
    report["candidate"] = str(target.relative_to(ROOT))
    (REVIEW/("applied.json" if APPLY else "candidate.json")).write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"candidate":str(target),"changed":report["changedMeshes"],"cliff":report["cliff"],"rosette":report["rosette"]}),flush=True)


if __name__ == "__main__": main()
