"""Read-only retained-native inventory and rock rays for the architectural finish."""
import hashlib
import json
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
from coastal_architecture_finish import components
ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
SOURCE = Path(ARGS.get("source", str(ROOT / "artwork/coastal-home/coastal-home.blend")))
OUT = Path(ARGS.get("out", str(ROOT / ".jekyll-cache/visual-qa/finish-house-2026-10-26/baseline/native-survey.json")))


def main():
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("Use exact Blender 4.5.9")
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    objects, rocks = [], []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        vertices = [obj.matrix_world @ v.co for v in obj.data.vertices]
        if not vertices:
            continue
        record = {"name": obj.name, "vertices": len(vertices), "polygons": len(obj.data.polygons),
                  "matrixWorld":[list(row) for row in obj.matrix_world],
                  "lo": [min(v[k] for v in vertices) for k in range(3)],
                  "hi": [max(v[k] for v in vertices) for k in range(3)],
                  "materials": [m.name if m else None for m in obj.data.materials],
                  "props": {k: obj[k] for k in obj.keys() if isinstance(obj[k], (str, int, float, bool))}}
        if obj.name in ("core__golden coastal sandstone", "coast_shared_golden coastal sandstone", "core_retreat_liftaway_roof", "core_estate_library_liftaway_roof", "core_bathwing_liftaway_roof") or obj.name.startswith(("core_finish", "coast_finish")):
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            record["topology"] = {"boundaryEdges": sum(e.is_boundary for e in bm.edges),
                                  "wireEdges": sum(e.is_wire for e in bm.edges),
                                  "nonmanifoldEdges": sum(not e.is_manifold for e in bm.edges),
                                  "examples": [{"ends": [list(obj.matrix_world @ v.co) for v in e.verts],
                                                "faces": len(e.link_faces), "areas": [f.calc_area() for f in e.link_faces]}
                                               for e in bm.edges if not e.is_manifold][:12]}
            bm.free()
        if obj.name == "coast_shared_golden coastal sandstone":
            region = [p for p in vertices if -8.45 <= p.x <= -4.84 and 4.50 <= p.y <= 13.0 and -2.02 <= p.z <= 3.20]
            record["legacyNotch"] = {"floorVertices": sum(abs(p.z + 1.95) < .002 for p in region),
                                      "westWallVertices": sum(abs(p.x + 8.39) < .002 for p in region),
                                      "eastWallVertices": sum(abs(p.x + 4.90) < .002 for p in region),
                                      "rearVertices": sum(abs(p.y - 4.58) < .002 for p in region),
                                      "count": len(region)}
        if obj.name.startswith(("study_", "library_", "core_retreat_spiral", "lounge__chalk", "lounge__pale", "lounge__honey")):
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            record["islands"] = []
            for group in components(bm):
                points = [obj.matrix_world @ v.co for v in group]
                record["islands"].append({"lo": [min(v[k] for v in points) for k in range(3)],
                                          "hi": [max(v[k] for v in points) for k in range(3)]})
            bm.free()
        if obj.name.startswith(("sleep_", "study_", "lounge__", "core_retreat_", "core_bath", "core_estate_", "library_", "core_arrival", "core_pavilion", "core__golden", "coast_shared_golden", "core_finish", "coast_finish")):
            objects.append(record)
        if obj.name in ("core__golden coastal sandstone", "coast_shared_golden coastal sandstone", "core_retreat_liftaway_roof", "core_estate_library_liftaway_roof", "core_bathwing_liftaway_roof", "core_liftaway_cave_ceiling", "core_liftaway_cave_ceiling_rear", "core_arrival_court__golden coastal sandstone"):
            rocks.append((obj, BVHTree.FromPolygons(vertices, [list(p.vertices) for p in obj.data.polygons])))
    rays = []
    # Horizontal side rays measure retained rock thickness around both possible
    # adjacent bedroom fins, rather than treating a metadata box as support.
    for label, xs, zs in (("east-fin", [-8.3, -7.5, -6.5, -5.5, -4.5], [4.5, 5.5, 6.5, 7.5, 8.5]),
                          ("west-fin", [-16., -15., -14., -13., -12.5], [3.5, 4.5, 5.5, 6.5, 7.5])):
        for x in xs:
            for zw in zs:
                hits = []
                for obj, tree in rocks:
                    p, n, index, d = tree.ray_cast(Vector((x, -zw, 20)), Vector((0, 0, -1)), 30)
                    if p is not None:
                        hits.append({"mesh": obj.name, "point": list(p), "normal": list(n), "distance": d})
                rays.append({"label": label, "worldPlan": [x, zw], "hits": hits})
    lid=next((o for o in bpy.context.scene.objects if o.name.startswith("core_arrival_lid__")),None)
    lid_seams=[]
    if lid:
        lid_tree=BVHTree.FromPolygons([lid.matrix_world@v.co for v in lid.data.vertices],[list(p.vertices) for p in lid.data.polygons])
        def top_at(x,y,collection):
            hits=[]
            for obj,tree in collection:
                point,normal,index,distance=tree.ray_cast(Vector((x,y,30)),Vector((0,0,-1)),40)
                if point is not None and normal.z>.2:hits.append((point.z,obj,point,normal))
            return max(hits,key=lambda r:r[0]) if hits else None
        for edge,a,b,direction in (("west",(2.62,-12.62),(2.62,-16.37),(-1,0)),
                                    ("east",(4.38,-12.62),(4.38,-16.37),(1,0)),
                                    ("sea",(2.62,-12.62),(4.38,-12.62),(0,1)),
                                    ("land",(2.62,-16.37),(4.38,-16.37),(0,-1))):
            for k in range(1,20):
                x,y=(a[j]+(b[j]-a[j])*k/20 for j in range(2))
                outside=top_at(x+direction[0]*.003,y+direction[1]*.003,rocks)
                inside=top_at(x-direction[0]*.003,y-direction[1]*.003,[(lid,lid_tree)])
                if not outside or not inside:
                    lid_seams.append({"edge":edge,"point":[x,y],"missing":True});continue
                def projected(hit):
                    _,_,p,n=hit
                    return p.z-(n.x*(x-p.x)+n.y*(y-p.y))/n.z
                lid_seams.append({"edge":edge,"point":[x,y],"outsideMesh":outside[1].name,
                                  "outsideHeight":projected(outside),"lidHeight":projected(inside),
                                  "deltaMm":1000*(projected(inside)-projected(outside))})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                               "coordinates": "native [x,-worldZ,up] metres", "objects": objects, "finRays": rays,
                               "lidSeams":lid_seams}, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"out": str(OUT), "objects": len(objects), "rays": len(rays)}), flush=True)


if __name__ == "__main__":
    main()
