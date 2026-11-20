"""Build the straight B entrance on a source-pinned coastal loft."""

import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import coastal_arrival_hall as old
import coastal_office
from coastal_arrival_upper_link import build_upper_link
from coastal_arrival_finish_fit import fit_arrival_finishes
from refresh_coastal_arrival_contacts import fit_native_contacts
from coastal_embedded_lift_cut import splice_cut


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sweep_boxes(floor, ceiling, west, east):
    if len(floor) != len(ceiling) or any(a[0] != b[0] for a, b in zip(floor, ceiling)):
        raise ValueError("The stair cutter's lower and upper stations must align")
    return [
        (
            (west, min(a[0], b[0]), min(a[1], b[1])),
            (east, max(a[0], b[0]), max(c[1], d[1])),
        )
        for a, b, c, d in zip(floor[:-1], floor[1:], ceiling[:-1], ceiling[1:])
    ]


def excavation_scope(boxes):
    outer_low = tuple(min(low[i] for low, _ in boxes) for i in range(3))
    outer_high = tuple(max(high[i] for _, high in boxes) for i in range(3))

    def bounds(points):
        return tuple(min(p[i] for p in points) for i in range(3)), tuple(max(p[i] for p in points) for i in range(3))

    def touches(points, margin):
        low, high = bounds(points)
        if any(low[i] > outer_high[i] + margin or high[i] < outer_low[i] - margin for i in range(3)):
            return False
        return any(
            low[1] <= end[1] + margin
            and high[1] >= start[1] - margin
            and low[2] <= end[2] + margin
            and high[2] >= start[2] - margin
            for start, end in boxes
        )

    def distance(points):
        low, high = bounds(points)
        return min(max(0, *(low[i] - end[i] for i in range(3)), *(start[i] - high[i] for i in range(3))) for start, end in boxes)

    return touches, distance


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--expected-source", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    opts = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    source, output, report = (path.resolve() for path in (opts.source, opts.output, opts.report))
    if len({source, output, report}) != 3 or digest(source) != opts.expected_source:
        parser.error("Use the expected source checksum and two distinct output paths")
    if bpy.app.version[:2] != (4, 5):
        parser.error("Use the project's pinned Blender 4.5 LTS exporter")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    if scene.get("coastalArrivalStraightB"):
        parser.error("This native file already has the straight B arrival")
    output.parent.mkdir(parents=True, exist_ok=True)
    report.parent.mkdir(parents=True, exist_ok=True)
    build_straight_arrival(scene, source, output, report)


def build_straight_arrival(scene, source, output, report):
    AXIS=.195
    FOOT=-14.42
    END=-11.55
    GOING=.28
    RISE=8.3/48
    LANDING=1.4
    WIDTH=2.20
    WALL_W=AXIS-1.90
    WALL_E=AXIS+1.26

    def open_profile_prism(name,profile,x0,x1,material):
        clean=[]
        for point in profile:
            if not clean or clean[-1]!=point:
                clean.append(point)
        if clean[0]==clean[-1]:
            clean.pop()
        n=len(clean)
        vertices=[(x,y,z) for x in (x0,x1) for y,z in clean]
        faces=[list(reversed(range(n))),list(range(n,2*n))]
        faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
        data=bpy.data.meshes.new(name)
        data.from_pydata(vertices,[],faces)
        bm=bmesh.new()
        bm.from_mesh(data)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        signed=bm.calc_volume(signed=True)
        if signed<0:
            bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
        bad=sum(not edge.is_manifold for edge in bm.edges)
        if bad or not signed:
            raise RuntimeError(f"Open or zero-volume prism {name}: {bad}")
        bm.to_mesh(data)
        bm.free()
        data.update()
        obj=bpy.data.objects.new(name,data)
        scene.collection.objects.link(obj)
        if material:
            data.materials.append(material)
        obj["closedSolid"]=True
        return obj

    def prism_between(name,bottom,top,x0,x1,material):
        return open_profile_prism(name,bottom+list(reversed(top)),x0,x1,material)

    def box(name,lo,hi,material):
        return open_profile_prism(name,[(lo[1],lo[2]),(hi[1],lo[2]),(hi[1],hi[2]),(lo[1],hi[2])],lo[0],hi[0],material)

    def make_stations():
        station,steps=[],[]
        y,h=FOOT,0
        for fi,count in enumerate((15,16,17)):
            for i in range(count):
                h+=RISE
                steps.append((y-GOING,y,h))
                station.extend([(y,h),(y-GOING,h)])
                y-=GOING
            if fi<2:
                station.append((y-LANDING,h))
                y-=LANDING
        return station,steps,y

    profile,steps,YTOP=make_stations()
    PORTAL=(AXIS,YTOP-.70,8.3)
    TRIGGER=(AXIS,END,0)
    TERMINAL=(AXIS,END+.56,0)
    cut_floor=[(END+.41,-.30),(FOOT,-.30)]
    cut_floor +=[(y,z-.30) for y,z in profile]
    cut_floor +=[(YTOP-1.205,7.72)]
    cut_top=[(END+.41,2.31),(FOOT,2.31)]
    cut_top +=[(y,z+2.33) for y,z in profile]
    cut_top +=[(YTOP-1.205,10.63)]

    cliff=bpy.data.objects["core__golden coastal sandstone"]
    hall=bpy.data.objects["core_arrival_hall__golden coastal sandstone"]
    rock=cliff.data.materials[0]
    liner=bpy.data.materials.get("warm cut stone")
    oak=bpy.data.materials.get("pale oak")
    brass=bpy.data.materials.get("brushed brass")
    paving=bpy.data.materials.get("travertine paving stone")
    assert all((rock,liner,oak,brass,paving))

    cutter=prism_between("Arrival B excavation",cut_floor,cut_top,WALL_W-.07,WALL_E+.07,rock)
    # The displaced coastline is limited to the actual cutter envelope. The roof
    # survey covers the whole native model and will fail if a retained slab intrudes.
    boxes = sweep_boxes(cut_floor, cut_top, WALL_W - .07, WALL_E + .07)
    touches, distance = excavation_scope(boxes)
    cuts = {cliff.name: splice_cut(cliff, cutter, touches_cut=touches, cut_distance=distance)}
    bpy.data.objects.remove(cutter, do_unlink=True)
    targets = [cliff]
    print("Arrival bedrock tuple custody passed", flush=True)
    # Retire only the obstructing local pieces of the older arrival walls, stair
    # trim and forecourt. Reuse the current assembly's scoped island cutter.
    old_targets=[o for o in scene.objects if o.type=="MESH" and o.name not in {x.name for x in targets}
                 and o.name.startswith(("core_arrival_hall__","core_arrival_wall__","core_arrival_living__",
                                        "core_arrival_court__","core_arrival_paths__"))]
    old_cut=prism_between("Arrival B trim scope",cut_floor,cut_top,WALL_W-.07,WALL_E+.07,rock)
    local=old._apply(old_cut,old_targets)
    retired = ("core_arrival_door_main__golden coastal sandstone", "core_arrival_door_main__brushed brass")
    for name in retired:
        obj = bpy.data.objects.get(name)
        if obj is None or obj.get("estateDoor") != "main":
            raise RuntimeError(f"Expected the existing main door owner {name}")
        bpy.data.objects.remove(obj, do_unlink=True)

    # Extend the measured floor profile along the surveyed centre axis. Each long
    # prism is closed. Material seams use a concrete offset rather than double faces.
    support=prism_between("core_arrival_B_stair_support",[(FOOT,-.32)]+[(y,z-.35) for y,z in profile],
        [(FOOT,-.025)]+[(y,z-.025) for y,z in profile],
        AXIS-WIDTH/2,AXIS+WIDTH/2,liner)

    def box_between(bm,lo,hi):
        center=tuple((a+b)*.5 for a,b in zip(lo,hi))
        size=tuple(b-a for a,b in zip(lo,hi))
        coastal_office.box(bm,center,size)

    treads=coastal_office.Parts("core_arrival_B_treads")
    for y0,y1,top in steps:
        box_between(treads.bm(oak),(AXIS-WIDTH/2,y0+.002,top-.024),(AXIS+WIDTH/2,y1-.002,top))
    for i in range(len(profile)-1):
        y0,z0=profile[i]
        y1,z1=profile[i+1]
        if abs(z0-z1)<1e-7 and abs(y0-y1)>1.3:
            box_between(treads.bm(oak),(AXIS-WIDTH/2,min(y0,y1)+.002,z0-.024),(AXIS+WIDTH/2,max(y0,y1)-.002,z0))
    treads.finish()
    grade=[(FOOT,0)]
    for i,((y0,z0),(y1,z1)) in enumerate(zip(profile[:-1],profile[1:])):
        if abs(z0-z1)<1e-7 and abs(y0-y1)>1.3:
            grade.extend(((y0,z0),(y1,z1)))
    grade.append((YTOP,8.30))
    inner_roof=[(END,2.14),(FOOT,2.14)]+[(y,z+2.20) for y,z in grade[1:]]
    inner_roof.append((YTOP-1.20,10.50))
    outer_roof=[(y,z+.10) for y,z in inner_roof]
    prism_between("core_arrival_B_continuous_soffit",inner_roof,outer_roof,WALL_W,WALL_E,liner)
    for side,x0,x1 in (("west",WALL_W,WALL_W+.11),("east",WALL_E-.11,WALL_E)):
        lower=[(END,-.14),(FOOT,-.14)]+[(y,z-.18) for y,z in profile]+[(YTOP-1.20,8.14)]
        upper=[(y,z-.001) for y,z in inner_roof]
        prism_between("core_arrival_B_"+side+"_wall",lower,upper,x0,x1,liner)
    box("core_arrival_B_portal_plinth",(AXIS-1.115,YTOP-1.19,7.74),(AXIS+1.115,YTOP+.004,8.30),paving)

    box("core_arrival_B_compression_floor",(AXIS-WIDTH/2,FOOT+.002,-.14),(AXIS+WIDTH/2,END+.402,.002),paving)
    # The side rill follows the same gravity profile outside the clear stair width.
    rill_top=[(y,z-.06) for y,z in grade]
    rill_bottom=[(y,z-.10) for y,z in rill_top]
    prism_between("core_arrival_B_rill_bed",rill_bottom,rill_top,AXIS-1.66,AXIS-1.26,liner)
    for k,x0,x1 in (("outer",AXIS-1.76,AXIS-1.66),("inner",AXIS-1.26,AXIS-1.18)):
        prism_between("core_arrival_B_rill_kerb_"+k,rill_bottom,[(y,z+.09) for y,z in rill_top],x0,x1,liner)


    # A stationary cut-stone throat and an actual inward-pivot leaf give the
    # protected approach an opaque closure. The open leaf folds beside the lane.
    frame_west = AXIS - WIDTH / 2
    frame_east = AXIS + WIDTH / 2
    pivot_y = END + .124
    box("core_arrival_B_west_cheek", (WALL_W, END + .084, -.012),
        (frame_west, END + .176, 2.142), liner)
    box("core_arrival_B_east_cheek", (frame_east + .028, END + .084, -.012),
        (WALL_E, END + .176, 2.142), liner)
    box("core_arrival_B_reveal_lintel", (frame_west, END + .084, 2.132),
        (frame_east + .028, END + .176, 2.155), liner)
    # The seaward returns occlude the light gaps without entering the hinge
    # sweep, which moves back into the passage on the landward side.
    box("core_arrival_B_east_stop", (frame_east - .005, END + .187, -.012),
        (frame_east + .032, END + .209, 2.142), liner)
    box("core_arrival_B_head_stop", (frame_west, END + .186, 2.106),
        (frame_east + .028, END + .209, 2.152), liner)
    gate = box("core_arrival_B_reveal_panel", (frame_west + .006, pivot_y - .022, .003),
               (frame_east - .004, pivot_y + .022, 2.122), oak)
    gate["estateDoor"] = "main"
    gate["dynamic"] = True
    gate["walk"] = "solid"
    pull_x = frame_west + .127
    pull = box("core_arrival_B_reveal_pull", (pull_x - .012, pivot_y - .042, .940),
               (pull_x + .012, pivot_y - .022, 1.125), brass)
    pull["estateDoor"] = "main"
    pull["dynamic"] = True
    pull["walk"] = "through"

    def flowing_material(name):
        existing = bpy.data.materials.get(name)
        if existing:
            return existing
        material = bpy.data.materials.new(name)
        material.diffuse_color = (0.58, 0.78, 0.74, 1)
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = material.diffuse_color
        bsdf.inputs["Roughness"].default_value = 0.075
        bsdf.inputs["IOR"].default_value = 1.333
        bsdf.inputs["Transmission Weight"].default_value = 0.88
        return material

    channel = flowing_material("arrival flowing spring water")
    spill = flowing_material("arrival spring rill spill")
    rill_vertices, rill_faces, rill_slots = [], [], []

    def rill_strip(start, stop, slot):
        first = len(rill_vertices)
        for y, z in (start, stop):
            rill_vertices.extend((x, y, z - .037) for x in (AXIS - 1.658, AXIS - 1.266))
        rill_faces.append((first, first + 2, first + 3, first + 1))
        rill_slots.append(slot)

    for start, stop in zip(grade, grade[1:]):
        if abs(stop[1] - start[1]) > 0.12:
            # A short spill sheet at each sloping run meets the channel at a
            # shared edge. The two shader roles never occupy the same plane.
            amount = 0.065 / abs(stop[0] - start[0])
            meeting = tuple(a + (b - a) * amount for a, b in zip(start, stop))
            rill_strip(start, meeting, 1)
            rill_strip(meeting, stop, 0)
        else:
            rill_strip(start, stop, 0)
    rill_geometry = bpy.data.meshes.new("Arrival B flow surface")
    rill_geometry.from_pydata(rill_vertices, [], rill_faces)
    rill_geometry.materials.append(channel)
    rill_geometry.materials.append(spill)
    for face, slot in zip(rill_geometry.polygons, rill_slots):
        face.material_index = slot
    rill_geometry.update()
    rill_surface = bpy.data.objects.new("core_arrival_B_flow_surface", rill_geometry)
    scene.collection.objects.link(rill_surface)
    rill_surface["water"] = True
    rill_surface["walk"] = "through"

    scene["coastalArrivalStraightB"] = True
    bpy.context.view_layer.update()
    for obj in scene.objects:
        if obj.name.startswith("core_arrival_B_"):
            obj["installationGroup"] = "arrival"
            obj["architectureComponent"] = "arrival-straight-b"

    bpy.context.view_layer.update()
    fit_native_contacts(scene)
    upper_link = build_upper_link(scene)
    finish_fit = fit_arrival_finishes(scene)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    center_stations = [PORTAL] + [(AXIS, (y0+y1)/2, z) for y0,y1,z in reversed(steps)]
    # Allow the entire 240 mm-radius capsule to leave the first riser before
    # the initial level waypoint. The treads and actual nosing stay in place.
    level_start = FOOT + 0.31
    center_stations.extend((AXIS, level_start + (END - level_start) * i / 10, 0) for i in range(10))
    center_stations.extend((TRIGGER, TERMINAL))
    if len(center_stations) != 61:
        raise RuntimeError("The authored centreline must retain the existing 61 survey stations")
    receipt = {
        "sourceSha256": digest(source),
        "outputSha256": digest(output),
        "cutCustody": cuts,
        "oldScopedCuts": local,
        "retiredLegacyDoorOwners": retired,
        "upperLink": upper_link,
        "finishFit": finish_fit,
        "nativePortal": PORTAL,
        "nativeTrigger": TRIGGER,
        "nativeTerminal": TERMINAL,
        "routeProbes": [(x, z, -y) for x, y, z in center_stations],
        "going": GOING,
        "stairWidth": WIDTH,
        "rill": {"origin": [AXIS - 1.462, -YTOP], "direction": [0, -1], "speed": 0.45},
        "door": {
            "id": "main",
            "nodes": [gate.name, pull.name],
            "pivot": {"x": frame_east, "z": -pivot_y, "angle": math.pi / 2},
            "center": [AXIS, 1.065, -pivot_y],
            "opening": {"min": [frame_west, 0, -pivot_y - .14], "max": [frame_east, 2.12, -pivot_y + .22]},
            "activationDistance": 2.8,
            "floor": 0,
            "material": "pale oak with a bronze pull",
        },
    }
    report.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8", newline="\n")
    print("Arrival B authored with", len(center_stations), "stations and SHA", receipt["outputSha256"], flush=True)


if __name__ == "__main__":
    main()
