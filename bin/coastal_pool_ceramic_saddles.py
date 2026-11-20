"""Fit three folded ceramic panels to the exposed native rock beneath the pool.

The girder, sandstone, terrace and approach remain the existing structure.
All dimensions use Blender world metres. The optional CLI replaces the earlier
projected relief in a separate native output and records its surveyed support.
"""

from argparse import ArgumentParser
from collections import Counter
from math import ceil, pi, sin, tau
import hashlib
import json
from pathlib import Path
import statistics
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

CLIFF = "coast_shared_golden coastal sandstone"
GIRDER = "core_finish_pool_front_box_girder"
PREFIX = "core_pool_tide_relief_"
OLD_RELIEF = {PREFIX + key for key in ("pale", "slate", "oxide")}
BAYS = ((-2.505, -1.409), (-1.335, -0.239), (-0.165, .931))
TOP, BOTTOM = -.504, -1.858
EYES = {
    "central": ((-1.5, 10.5, -6.89306 + 1.61), (-1.55, 4.56, -.28), 50),
    "oblique": ((-8.0, 14.0, -6.71922 + 1.61), (-1.80, 4.55, -.36), 36),
}
STONE_FINGERS = (0.426, 0.334, 0.245)
PALE = (0.570, 0.421, 0.289)
BLUE = (0.101, 0.165, 0.207)
OXIDE = (0.292, 0.151, 0.092)
MAX_NOSE = .130


def fields(scene):
    names = (CLIFF, GIRDER, "core__golden coastal sandstone", "core_estate_terrace__warm cut stone")
    trees = {}
    for name in names:
        obj = scene.objects[name]
        mesh, world = obj.data, obj.matrix_world
        mesh.calc_loop_triangles()
        trees[name] = BVHTree.FromPolygons([world @ v.co for v in mesh.vertices],
                                           [f.vertices[:] for f in mesh.loop_triangles], all_triangles=True)
    normal = Vector((0, -1, 0))
    witnessed = []
    def mount(x,z):
        start=Vector((x,16,z))
        points=[]
        for name, tree in trees.items():
            p,n,_,distance=tree.ray_cast(start,normal,25)
            if p is not None:
                points.append((distance,name,p,n))
        if not points:
            raise RuntimeError(f"Gap in the retained support at {x:.4f}, {z:.4f}")
        _,owner,p,n=min(points,key=lambda h:h[0])
        if owner!=CLIFF or p.y<4.94 or p.y>5.64 or n.y<.12:
            raise RuntimeError(f"Trial leaves the seaward sandstone at x={x:.4f}, z={z:.4f}, {owner}, {p.y:.4f}, {n.y:.4f}")
        witnessed.append((x,p.y,z,n.y))
        return p.y
    return mount, witnessed


def surface_panel(bm, mount, lo, hi, floor, ceiling, rear, front):
    """Two matching thin, watertight skins following the measured rock grid."""
    nx, nz = ceil((hi-lo)/.047),ceil((ceiling-floor)/.041)
    front_points, behind_points=[],[]
    for k in range(nz+1):
        z=floor+(ceiling-floor)*k/nz
        for i in range(nx+1):
            x=lo+(hi-lo)*i/nx
            y=mount(x,z)
            front_points.append(bm.verts.new((x,y+front,z)))
            behind_points.append(bm.verts.new((x,y+rear,z)))
    w=nx+1
    for z in range(nz):
        for x in range(nx):
            k=z*w+x
            corners=(k,k+w,k+w+1,k+1)
            bm.faces.new([front_points[i] for i in corners])
            bm.faces.new([behind_points[i] for i in reversed(corners)])
    border = [*range(w), *(k*w+nx for k in range(1,nz+1)), *(nz*w+k for k in reversed(range(nx))),
              *(k*w for k in reversed(range(1,nz)))]
    for a,b in zip(border,border[1:]+border[:1]):
        bm.faces.new((front_points[a],front_points[b],behind_points[b],behind_points[a]))


def fluted_piece(bm,mount,x,width,z0,z1,reach,tilt):
    profile=((-0.50,.017),(0.50,.017),(0.50,.057),(.14,reach),(-.33,reach*.66),(-.50,.048))
    rings=[]
    stations=max(4,ceil((z1-z0)/.043))
    for index in range(stations+1):
        t=index/stations
        z=z0+(z1-z0)*t
        ring=[]
        for offset, nose in profile:
            u=x+offset*width+tilt*(t-.5)
            ring.append(bm.verts.new((u,mount(u,z)+nose,z)))
        rings.append(ring)
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(rings[-1])
    for a,b in zip(rings,rings[1:]):
        for i in range(len(a)):
            j=(i+1)%len(a)
            bm.faces.new((a[i],a[j],b[j],b[i]))


def build(scene):
    import coastal_decor as decor
    mount, witnessed=fields(scene)
    palettes=[
        ("bed", "sandstone ceramic saddle", STONE_FINGERS,.79),
        ("frame", "ochre clay return", (.35,.261,.184),.63),
        ("pale", "limestone slip", PALE,.55),
        ("slate", "smoke blue ceramic", BLUE,.57),
        ("oxide", "iron oxide clay", OXIDE,.73),
    ]
    layouts={key:bmesh.new() for key,_,_,_ in palettes}
    for bay,(x0,x1) in enumerate(BAYS):
        # The carrier follows rock at the actual seat, with a 9 mm mortar embed.
        surface_panel(layouts["bed"],mount,x0,x1,BOTTOM,TOP,-.009,.014)
        edge=.041
        for a,b,c,d in (
            (x0,x1,TOP-edge,TOP),
            (x0,x1,BOTTOM,BOTTOM+edge),
            (x0,x0+edge,BOTTOM+edge,TOP-edge),
            (x1-edge,x1,BOTTOM+edge,TOP-edge),
        ):
            surface_panel(layouts["frame"],mount,a,b,c,d,.014,.058)
        inside=x0+.079,x1-.079
        for i in range(16):
            t=(i+.5)/16
            x=inside[0]+(inside[1]-inside[0])*t
            across=(x-BAYS[0][0])/(BAYS[-1][1]-BAYS[0][0])
            wave=-1.164+.163*sin(tau*(1.12*across-.128))+.045*sin(tau*(2.38*across+.15))
            span=.17+.144*(.42+.58*sin(pi*t))
            lean=.017*sin(tau*(across+.13))
            fluted_piece(layouts["pale"],mount,x,.047,wave+.029,wave+.277+.045*sin(pi*t),.106,lean)
            key="oxide" if (i+3*bay)%10==0 else "slate"
            fluted_piece(layouts[key],mount,x,.047,wave-span-.097,wave-.028,MAX_NOSE,lean)
    made=[]
    for key,name,color,roughness in palettes:
        mesh=layouts[key]
        bmesh.ops.recalc_face_normals(mesh,faces=list(mesh.faces))
        if any(not e.is_manifold or not e.is_contiguous for e in mesh.edges):
            raise RuntimeError("Open clay or backing geometry " + key)
        material=decor.material("Relief trial · "+name,color,roughness)
        obj=decor.from_bmesh(PREFIX+"saddle_"+key,mesh,material,smooth=False)
        obj["closedSolid"]=True
        obj["walk"]="through"
        obj["installationGroup"]="exterior"
        made.append(obj)
    details={"mountWitnesses":len(witnessed),"mountOwner":CLIFF,
             "surfaceY":[min(p[1] for p in witnessed),max(p[1] for p in witnessed)],
             "minimumSupportNormalY":min(p[3] for p in witnessed),"boundsXZ": [list(BAYS),[BOTTOM,TOP]],
             "mountDepthIntoRock":.009,"lastCeramicNose":MAX_NOSE,
             "pieces":96,"eachBayWidth":BAYS[0][1]-BAYS[0][0],"clearShadowBays":[BAYS[i+1][0]-BAYS[i][1] for i in range(2)],
             "opaqueParts":[[o.name,len(o.data.polygons)] for o in made]}
    return made,details


def install(scene):
    """Replace exactly the three old relief meshes in the caller's open scene."""
    previous = [obj for obj in scene.objects if obj.name.startswith(PREFIX)]
    if {obj.name for obj in previous} != OLD_RELIEF:
        raise RuntimeError("Expected the three original relief owners before replacement")
    made, receipt = build(scene)
    fresh = {obj.name for obj in made}
    if len(fresh) != 5 or any(name in OLD_RELIEF for name in fresh):
        raise RuntimeError("Expected five uniquely named clay and saddle meshes")
    for obj in previous:
        mesh = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    bpy.context.view_layer.update()
    current = {obj.name for obj in scene.objects if obj.name.startswith(PREFIX)}
    if current != fresh:
        raise RuntimeError("An old relief mesh survived replacement")
    receipt["removedReliefOwners"] = sorted(OLD_RELIEF)
    receipt["installedOwners"] = sorted(current)
    return made, receipt


def main():
    p = ArgumentParser(description=__doc__)
    for key in ("source", "out", "report"):
        p.add_argument("--" + key, type=Path, required=True)
    options = p.parse_args(sys.argv[sys.argv.index("--") + 1:])
    source, out, report = (path.resolve() for path in (options.source, options.out, options.report))
    if len({source, out, report}) != 3 or out.exists() or report.exists():
        p.error("Use fresh native and report paths")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    _, receipt = install(bpy.context.scene)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(out), compress=True)
    receipt.update(sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(), outputSha256=hashlib.sha256(out.read_bytes()).hexdigest())
    report.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf8", newline="\n")


if __name__ == "__main__":
    main()
