"""Two inhabited storeys carved into one continuous mainland cliff.

Blender is Z-up, the Pacific is +Y. Floor heights and room translations are
also recorded in the web manifest. The shore is a continuous section along X,
not an island or a separate mountain behind a pedestal.
"""

import math
import random
import bpy
import bmesh
from mathutils import Vector
from coastal_sculpt import surface
from coastal_interiors import curved_wall
from coastal_landscape import shoreline, cliff_surface, beach_width, beach_point, top_height, export_contacts, web


import json
from pathlib import Path

CONFIG = json.loads(
    (
        Path(__file__).resolve().parents[1] / "assets/models/home/manifest.json"
    ).read_text()
)
RISE = max(r["floor"] for r in CONFIG["rooms"])
OFFSETS = {
    r["id"]: (r["offset"][0], -r["offset"][2], r["offset"][1]) for r in CONFIG["rooms"]
}


def cliff_normals(obj):
    normals = []
    for face in obj.data.polygons:
        front = all(
            abs(v.co.y - cliff_surface(v.co.x, v.co.z)) < 0.12
            for v in (obj.data.vertices[i] for i in face.vertices)
        )
        face.use_smooth = front
        for index in face.loop_indices:
            v = obj.data.vertices[obj.data.loops[index].vertex_index].co
            if front:
                dx = (
                    cliff_surface(v.x + 0.005, v.z) - cliff_surface(v.x - 0.005, v.z)
                ) / 0.01
                dz = (
                    cliff_surface(v.x, v.z + 0.005) - cliff_surface(v.x, v.z - 0.005)
                ) / 0.01
                normals.append(tuple(Vector((-dx, 1, -dz)).normalized()))
            else:
                normals.append((0, 0, 0))
    obj.data.normals_split_custom_set(normals)


def rehouse(mats, h):
    """Move fitted room contents as groups before batching, then build floors."""
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith("core_") or obj.name == "anchor_outside":
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        group = obj.name.split("_")[0]
        if obj.name.startswith("anchor_"):
            group = obj.name.split("_")[1]
        if group == "records":
            group = "study"
        if group in OFFSETS:
            dx, dy, dz = OFFSETS[group]
            obj.location.x += dx
            obj.location.y += dy
            obj.location.z += dz

    for room in CONFIG["rooms"]:
        anchor = bpy.data.objects.get("anchor_" + room["id"])
        if anchor:
            x, y, z = room["actor"]
            anchor.location = (x, -z, y)
    box, tube, slab = h["box"], h["tube"], h["polygon_slab"]
    oak, stone, plaster = mats["oak"], mats["edge"], mats["plaster"]
    lower = [
        (-4.8, -5.35),
        (4.8, -5.35),
        (4.8, 3.7),
        (4.3, 4.8),
        (-3.95, 4.8),
        (-4.8, 4.0),
    ]
    slab("core_ground_floor", lower, -0.28, -0.022, stone)
    # The front notch is the stair opening; the rear landing is continuous.
    upper = [
        (-4.7, -5.3),
        (-2.08, -5.3),
        (-2.08, -4.08),
        (2.05, -4.08),
        (2.05, -5.3),
        (4.7, -5.3),
        (4.7, -1.30),
        (-4.7, -1.30),
    ]
    slab("core_upper_floor", upper, RISE - 0.24, RISE - 0.022, plaster)
    rng = random.Random(19)
    # Separate fitted boards make the two elevations unambiguous in close-up.
    for upper_floor, y0, y1, height in (
        (False, -5.2, 4.45, 0),
        (True, -5.15, -1.3, RISE),
    ):
        for col in range(31):
            x = -4.5 + col * 0.30
            y = y0
            while y < y1:
                length = min(y1 - y, rng.uniform(1.2, 2.3))
                if upper_floor and -2.1 < x < 2.1 and y < -4.08:
                    y = -4.06
                    continue
                if length > 0.04:
                    box(
                        "core_fitted_floorboard",
                        (x, y + length / 2, height - 0.009),
                        (0.294, length - 0.007, 0.023),
                        oak,
                        0.003,
                    )
                y += max(length, 0.5)

    # A real 15-riser stair, 1.02 m clear width, with closed risers and continuous
    # stringers. Its centerline is the only route between floors in the runtime.
    n, start, end, sx = 15, 1.20, -2.70, 1.615
    depth = (start - end) / n
    for i in range(n):
        z = (i + 1) * RISE / n
        y = start - (i + 0.5) * depth
        box(
            "core_stair_closed_riser",
            (sx, y, z / 2),
            (1.04, depth + 0.008, z),
            plaster,
            0.012,
        )
        box(
            "core_stair_oak_tread",
            (sx, y + 0.008, z - 0.014),
            (1.085, depth + 0.025, 0.028),
            oak,
            0.006,
        )
    for x in (1.06, 2.17):
        tube(
            "core_stair_handrail",
            [
                (x, start + 0.1, 0.88),
                (x, end, RISE + 0.88),
                (x, end - 0.45, RISE + 0.88),
            ],
            0.027,
            mats["wood"],
        )
        for i in range(0, n, 3):
            y = start - (i + 0.5) * depth
            z = (i + 1) * RISE / n
            box(
                "core_stair_baluster",
                (x, y, z + 0.43),
                (0.023, 0.023, 0.86),
                mats["brass"],
                0.006,
            )
    # Upper balcony rail follows the floor edge and leaves the stair open.
    # Rotate the complete stair to the landward wall. Treads, closed risers and
    # handrails share the transform; the exported walking path uses it too.
    from mathutils import Matrix
    transform = Matrix(((0,-1,0,-.8),(1,0,0,-6.265),(0,0,1,0),(0,0,0,1)))
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith("core_stair_"):
            obj.matrix_world = transform @ obj.matrix_world
    for xa, xb in ((-4.6, 4.55),):
        tube(
            "core_gallery_rail",
            [(xa, -1.31, RISE + 0.83), (xb, -1.31, RISE + 0.83)],
            0.032,
            mats["wood"],
        )
        for i in range(round((xb - xa) / 0.65) + 1):
            x = xa + i * (xb - xa) / max(1, round((xb - xa) / 0.65))
            box(
                "core_gallery_spindle",
                (x, -1.31, RISE + 0.42),
                (0.023, 0.023, 0.82),
                mats["brass"],
                0.006,
            )

    # The rooms are alcoves, with rounded returns and long views through the
    # atrium. Lower storage belongs under the gallery, not an empty void.
    for x in (-1.78, 1.87):
        path = [
            (x + 0.06 * math.sin(i / 12 * math.pi), -5.12 + i / 12 * 1.6)
            for i in range(13)
        ]
        curved_wall(
            "core_upper_alcove_return",
            [(x, y, RISE, RISE + 1.18) for x, y in path],
            plaster,
            0.12,
        )
    for x in (-4.72, 4.72):
        path = [(x, -5.2), (x * 0.995, -4.7), (x * 0.97, -4.3)]
        curved_wall(
            "core_rounded_back_return",
            [(x, y, RISE, RISE + 2.12) for x, y in path],
            plaster,
            0.16,
        )
    # Shallow cupboards line the sheltered part of the lower storey.
    for i in range(10):
        x = -4.17 + i * 0.80
        if -2.4 < x < 2.3:
            continue
        box(
            "core_lower_storage",
            (x, -4.97, 0.92),
            (0.77, 0.42, 1.80),
            mats["sage"],
            0.035,
        )
        box(
            "core_cupboard_pull",
            (x + 0.25, -4.743, 1.0),
            (0.018, 0.025, 0.18),
            mats["brass"],
            0.007,
        )
    # A pale kitchen wall provides a casual home for the shared capybara print.
    curved_wall(
        "kitchen_print_wall",
        [
            (x, y, 0, 2.15)
            for x, y in [(-4.45, -0.17), (-3.9, -0.32), (-2.4, -0.32), (-1.75, -0.12)]
        ],
        plaster,
        0.16,
    )
    # Gym battens behind the power rack, underneath the upper gallery.
    for i in range(25):
        box(
            "gym_oak_backing",
            (-1.43 + i * 0.119, -0.14, 1.15),
            (0.046, 0.04, 2.22),
            mats["wood"],
            0.008,
        )
    for x in (-4.1, 3.9):
        h["potted_plant"]("core", x, -3.25, 0, 1.1, mats, h)
    # The long front gallery reads as carved stone, not a thin office mezzanine.
    # Tapered side returns and a shaped lintel frame both inhabited levels.
    for side in (-1,1):
        path=[(side*(4.70-.38*math.sin(t*math.pi/2)), -1.36+t*.75, 0, RISE+.12) for t in [i/12 for i in range(13)]]
        curved_wall("core_carved_gallery_return", path, plaster, .34)
    archverts, archfaces=[],[]
    for row in range(2):
        for i in range(65):
            t=i/64
            x=-4.40+8.80*t
            bottom=RISE-.25-.53*(abs(x)/4.4)**5
            archverts.extend([(x,-1.50+row*.40,bottom),(x,-1.50+row*.40,RISE-.02)])
    for row in range(2):
        for i in range(64):
            p=row*130+i*2
            archfaces.append((p,p+2,p+3,p+1))
    for i in range(64):
        p=i*2
        archfaces.extend([(p,p+130,p+132,p+2),(p+1,p+3,p+133,p+131)])
    surface("core_carved_gallery_arch",archverts,archfaces,plaster)
    # Export navigation from the stair transform instead of retaining old steps.
    CONFIG["navigation"].update({"upperAisleZ":3.94,"stairX":2.35,
        "stairs":[web((-2.1, -4.65,0))]+[web((-.8-(start-(i+.5)*depth),-4.65,(i+1)*RISE/n)) for i in range(n)]+[web((2.35,-4.65,RISE)),web((2.35,-3.94,RISE))],
        "lowerStairApproach":[[-2.55,0,3.3],[-2.55,0,4.65],[-2.1,0,4.65]]})
    for room in CONFIG["rooms"]:
        if room["floor"]>0:
            room["egress"][2]=3.94
            if room.get("exitPath"):
                room["exitPath"][-1][2]=3.94
    CONFIG["views"]["outside"].update({"target":[3,-.2,-6],"radius":48,"yaw":3.48,"pitch":.37})
    CONFIG["views"]["overview"].update({"radius":18.5,"yaw":3.30,"pitch":.43})


def coast(mats, h):
    """A shared shoreline section closes foundation, roof, land and beach."""
    rock = h["material"]("golden coastal sandstone", (0.62, 0.43, 0.265), 0.86)
    sand = h["material"]("dry beach sand", (0.81, 0.69, 0.49), 0.96)
    wet = h["material"]("wet tideline sand", (0.48, 0.40, 0.27), 0.30)
    scrub = h["material"]("coastal sage scrub", (0.26, 0.34, 0.16), 0.92)
    nx, ny = 224, 40
    xmin, xmax = -36, 76
    xs = [xmin + (xmax - xmin) * i / nx for i in range(nx + 1)]
    objects = []

    def ridge(x):
        z = top_height(x, shoreline(x))
        for _ in range(5):
            z = top_height(x, cliff_surface(x, z))
        return z

    def mass(name, bottom, top, upper):
        verts, faces = [], []
        # Two matched terrain grids make a closed manifold before carving.
        for layer in (0, 1):
            for j in range(ny + 1):
                t = j / ny
                for x in xs:
                    y = -32 + (shoreline(x) + 32) * t
                    z = bottom
                    if layer:
                        z = top
                        if upper:
                            z = top_height(x, y)
                    y += (cliff_surface(x, z) - shoreline(x)) * t**8
                    if layer and upper:
                        z = top_height(x, y)
                        if j == ny:
                            z = ridge(x)
                            y = cliff_surface(x, z)
                    verts.append((x, y, z))
        block = (nx + 1) * (ny + 1)
        for layer in (0, 1):
            for j in range(ny):
                for i in range(nx):
                    p = layer * block + j * (nx + 1) + i
                    face = (p, p + 1, p + nx + 2, p + nx + 1)
                    faces.append(face if layer else tuple(reversed(face)))
        for j in (0, ny):
            if j == ny:
                front = []
                for row in range(81):
                    t = row / 80
                    line = []
                    for x in xs:
                        ztop = top
                        if upper:
                            ztop = ridge(x)
                        z = bottom + (ztop - bottom) * t
                        line.append(len(verts))
                        verts.append((x, cliff_surface(x, z), z))
                    front.append(line)
                for row in range(80):
                    for i in range(nx):
                        faces.append(
                            (
                                front[row][i + 1],
                                front[row][i],
                                front[row + 1][i],
                                front[row + 1][i + 1],
                            )
                        )
                continue
            for i in range(nx):
                p = j * (nx + 1) + i
                face = (p, p + 1, p + 1 + block, p + block)
                faces.append(face if j == 0 else tuple(reversed(face)))
        for i in (0, nx):
            for j in range(ny):
                p = j * (nx + 1) + i
                face = (p, p + nx + 1, p + nx + 1 + block, p + block)
                faces.append(tuple(reversed(face)) if i == 0 else face)
        obj = surface(name, verts, faces, rock, smooth=False)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.0001)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        if bm.calc_volume(signed=True) < 0:
            bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        return obj

    base = mass("coast_continuous_cliff_foundation", -8.4, -0.26, False)
    cliff_normals(base)
    objects.append(base)
    roof = mass("core_carved_mainland", -0.26, 6.75, True)
    roof.data.materials.append(mats["plaster"])
    # Carve a full-depth arched dwelling into that same mass. Roof, jambs and
    # foundation share coordinates; there is no gap or separate scenic arch.
    arch = [(-4.94, -0.40), (4.94, -0.40)]
    arch += [
        (
            5.20 * math.cos(a * math.pi / 64),
            0.04 + 5.95 * math.sin(a * math.pi / 64) ** 0.44,
        )
        for a in range(65)
    ]
    verts = [(x, y, z) for y in (-5.48, 25) for x, z in arch]
    n = len(arch)
    faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    cutter = surface("dwelling excavation tool", verts, faces, mats["plaster"])
    for obj in (roof, cutter):
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.0001)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        if bm.calc_volume(signed=True) < 0:
            bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
    bpy.context.view_layer.objects.active = roof
    boolean = roof.modifiers.new("carved two storey home", "BOOLEAN")
    boolean.operation, boolean.solver, boolean.object = "DIFFERENCE", "EXACT", cutter
    bpy.ops.object.modifier_apply(modifier=boolean.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    bpy.context.view_layer.update()
    hit, location, _, _ = roof.ray_cast(Vector((0, 20, 2)), Vector((0, -1, 0)))
    assert hit and location.y < -5.3, f"Excavation is not open: {location}"
    print("Cave excavation verified", tuple(location), flush=True)
    # Only lift the local ceiling for an interior cutaway. Keep the actual
    # mainland, back wall and side jambs visible; hiding the whole landmass
    # exposed an enormous flat foundation behind the rooms.
    coordinates = [tuple(v.co) for v in roof.data.vertices]
    # Boolean partition preserves the inside faces along the reveal. Selecting
    # faces by centroid left 186 open boundary edges and see-through rock.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 7.325, 16.95))
    split = bpy.context.object
    split.name = 'Closed cutaway partition tool'
    split.dimensions = (11.3, 25.35, 26.1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    split.data.materials.append(mats['edge'])
    solids = []
    for name, operation in [('core_liftaway_cave_ceiling','INTERSECT'),('core_continuous_mainland_and_cave_walls','DIFFERENCE')]:
        obj = roof.copy(); obj.data = roof.data.copy()
        bpy.context.collection.objects.link(obj); obj.name = name
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new('Solid stone section', 'BOOLEAN')
        modifier.operation = operation; modifier.solver = 'EXACT'; modifier.object = split
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bm = bmesh.new(); bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00005)
        # Boolean seams can leave coplanar boundary loops on the cut plane.
        # Close those actual edge loops, rather than making the rock double-sided.
        boundary_edges = [e for e in bm.edges if e.is_boundary]
        if boundary_edges:
            bmesh.ops.holes_fill(bm, edges=boundary_edges, sides=0)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        boundary = sum(not e.is_manifold for e in bm.edges)
        assert boundary == 0, f'{name} has {boundary} non-manifold edges'
        bm.to_mesh(obj.data); bm.free(); cliff_normals(obj)
        obj['closedSolid'] = True
        solids.append(obj)
    bpy.data.objects.remove(split, do_unlink=True)
    top = solids[0]
    top["caveRoof"] = True
    top['cutawaySection'] = 'inhabited-roof'
    # Fit planting and exported wildlife paths to the actual triangulated
    # support, including the excavation. Sampling only its analytic precursor
    # left small plant mats cutting through the coarser rendered ridge.
    from mathutils.bvhtree import BVHTree
    supports = BVHTree.FromPolygons(coordinates, [tuple(f.vertices) for f in roof.data.polygons])
    def support_height(x, y):
        hit, _, _, _ = supports.ray_cast(Vector((x, y, 30)), Vector((0, 0, -1)))
        return hit.z if hit is not None else top_height(x, y)
    from coastal_camera import camera_manifest, landward_entry
    camera_manifest(CONFIG, support_height)
    landward_entry(mats, h, support_height)
    bpy.data.objects.remove(roof, do_unlink=True)
    # Beach is one long sloping shore. It joins the foot of the very same cliff
    # and disappears below the water instead of ending as a polygonal ring.
    verts, faces, rows = [], [], 40
    for j in range(rows + 1):
        t = j / rows
        for x in xs:
            verts.append(beach_point(x, t))
    for j in range(rows):
        for i in range(nx):
            p = j * (nx + 1) + i
            faces.append((p, p + 1, p + nx + 2, p + nx + 1))
    beach = surface("coast_long_sloping_beach", verts, faces, sand)
    beach.data.materials.append(wet)
    for face in beach.data.polygons:
        face.material_index = int(face.center.z < -7.13)
    objects.append(beach)
    rng = random.Random(93)
    # Fallen rock gathers below the headlands, leaving usable expanses of sand.
    for i in range(90):
        center = (-14, -8, 12, 23, 34)[i % 5]
        x = center + rng.gauss(0, 1.8)
        x, y, z = beach_point(x, rng.uniform(.03,.22))
        size = rng.uniform(.24, 1.1)
        obj = h["sphere"](
            "coast_talus",
            (x, y, z + size * .18),
            (size, size*.74, size*.57),
            rock,
            segments=16,
        )
        # Broad chipped silhouettes, with smoothed normals rather than pebbles.
        for v in obj.data.vertices:
            v.co *= 1 + .13 * math.sin(v.co.x*3.1 + i) * math.cos(v.co.z*2.7)
        obj.rotation_euler.z = rng.random() * math.tau
        objects.append(obj)
    export_contacts(CONFIG)
    for habitat in CONFIG['terrain']['habitats'].values():
        if habitat['kind'] != 'clifftop':
            continue
        coarse = habitat['path']
        path = []
        for a, b in zip(coarse, coarse[1:] + coarse[:1]):
            for i in range(12):
                t = i / 12
                x, z = a[0]*(1-t)+b[0]*t, a[2]*(1-t)+b[2]*t
                path.append([round(x,4), round(support_height(x,-z)+.025,4), round(z,4)])
        habitat['path'] = path
    for perch in CONFIG['terrain']['perches']:
        perch[1] = round(support_height(perch[0],-perch[2])+.05,4)
    # Low, broad wave-worn haul-out rocks. Their exact top contacts are exported.
    for i, (x,t) in enumerate([(-10,.32),(-8.6,.34),(11,.29)]):
        x,y,z = beach_point(x,t)
        hgt = .48 if i < 2 else .38
        obj = h["sphere"]("coast_haulout_ledge", (x,y,z), (1.7,1.1,hgt), rock, segments=24)
        objects.append(obj)
        CONFIG["terrain"]["habitats"]["seaLion"]["path"].append(web((x,y,z+hgt)))
    from coastal_garden import coastal_planting
    coastal_planting(mats, h, support_height, shoreline, scrub)
    # Shallow rock basins sit above the active waterline. Their rims and water
    # levels share the beach section; these are pockets, not floating disks.
    pool_water = h['material']('tide pool sea glass',(.10,.24,.22),.15,.12)
    CONFIG['terrain']['tidePools']=[]
    for i,(x,t,rx,ry) in enumerate([(-11.8,.19,1.15,.72),(8.7,.20,1.50,.83)]):
        cx,cy,cz=beach_point(x,t)
        vertices,faces=[],[]
        rings=[(.0,-.07),(.70,-.06),(.83,.13),(1.,.035)]
        for radius,z in rings:
            for j in range(65):
                a=j/64*math.tau;vary=1+.07*math.sin(5*a+i)+.035*math.sin(9*a)
                vertices.append((cx+rx*radius*math.cos(a)*vary,cy+ry*radius*math.sin(a)*vary,cz+z))
        for k in range(3):
            for j in range(64):
                p=k*65+j;faces.append((p,p+1,p+66,p+65))
        objects.append(surface('coast_tidal_basin',vertices,faces,rock))
        points=[(cx+rx*.77*math.cos(j/64*math.tau),cy+ry*.77*math.sin(j/64*math.tau),cz+.018) for j in range(64)]
        objects.append(surface('coast_tide_pool_water',points,[tuple(range(64))],pool_water))
        CONFIG['terrain']['tidePools'].append({'center':web((cx,cy,cz+.018)),'radii':[rx*.77,ry*.77]})
    manifest = Path(__file__).resolve().parents[1] / "assets/models/home/manifest.json"
    manifest.write_text(json.dumps(CONFIG, indent=2) + "\n", encoding="utf-8")
    return objects
