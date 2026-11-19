"""Carve the gym into the cliff north of the lounge, furnish it, and turn the bay it leaves into a
living room (Sirui, 2026-10-15); see coastal_gym.py.

Run with Blender 4.5 LTS from the repository root:
  blender -b --python-exit-code 1 --python bin/refresh_coastal_gym.py [-- --preview=DIR]
then bin/bake_coastal_light.py, bin/optimize_coastal_exports.py -- --interiors-only,
bin/review_coastal_models.py and bin/build_coastal_perch_support.py. The carving happens once
(the house file remembers it); re-running replaces the gym's furnishings, front and floors and the
living room. --preview renders review views and saves nothing.
"""

import json
import math
import sys
from pathlib import Path
import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_decor as decor
import coastal_gym as gymkit
from coastal_gym import FRONT, PASSAGE, ROOM, STATIONS, LIVING, arch_profile, extrusion, front_y, vault_height
from coastal_landscape import cliff_surface, web

SOURCE = ROOT / "artwork/coastal-home/coastal-home.blend"
MANIFEST = ROOT / "assets/models/home/manifest.json"
args = {a.split("=", 1)[0][2:]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}
preview = args.get("preview")
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
report = {}


def clean_solid(obj):
    """Weld, close coplanar boundary loops left on cut planes, and orient outward."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00005)
    boundary = [e for e in bm.edges if e.is_boundary]
    if boundary:
        bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    open_edges = sum(1 for e in bm.edges if not e.is_manifold)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return open_edges


# 1. The excavation, once: a single-storey vault from the back wall out through the cliff, and a
# passage from the lounge. The cutters carry the house's chalk limestone, so the new faces are
# plastered like the rest of the cave.
mainland = bpy.data.objects["core__golden coastal sandstone"]
plaster = bpy.data.materials["chalk limestone"]
if not scene.get("gymCarved"):
    vault = arch_profile(ROOM["x0"], ROOM["x1"], ROOM["bottom"], ROOM["spring"], ROOM["crown"])
    passage = arch_profile(PASSAGE["y0"], PASSAGE["y1"], ROOM["bottom"], PASSAGE["spring"], PASSAGE["crown"], n=16)
    cutters = [
        extrusion("gym excavation tool", vault, "y", ROOM["back"], 24.0, plaster),
        extrusion("gym passage tool", passage, "x", PASSAGE["x0"], PASSAGE["x1"], plaster),
    ]
    bpy.context.view_layer.objects.active = mainland
    for cutter in cutters:
        modifier = mainland.modifiers.new("carve gym", "BOOLEAN")
        modifier.operation, modifier.solver, modifier.object = "DIFFERENCE", "EXACT", cutter
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    open_edges = clean_solid(mainland)
    assert open_edges == 0, f"the carved mainland has {open_edges} open edges"
    hit, location, _, _ = mainland.ray_cast(Vector((8.5, 20, 1.5)), Vector((0, -1, 0)))
    assert hit and location.y < ROOM["back"] + 0.05, f"the gym excavation is not open from the sea: {location}"
    hit, location, _, _ = mainland.ray_cast(Vector((4.0, 1.55, 1.2)), Vector((1, 0, 0)))
    assert hit and location.x > ROOM["x0"] + 4.5, f"the passage does not reach the gym: {location}"
    scene["gymCarved"] = True
    report["carved"] = {"mainlandVertices": len(mainland.data.vertices), "openEdges": open_edges}

# Cut faces seaward of the glass are the cave mouth's reveal: sandstone, not plaster.
slots = [m.name if m else "" for m in mainland.data.materials]
plaster_slot, rock_slot = slots.index("chalk limestone"), slots.index("golden coastal sandstone")
reveal = 0
for polygon in mainland.data.polygons:
    if polygon.material_index != plaster_slot:
        continue
    c = mainland.matrix_world @ polygon.center
    if ROOM["x0"] - 0.3 < c.x < ROOM["x1"] + 0.3 and c.y > front_y(min(max(c.x, ROOM["x0"]), ROOM["x1"])) + 0.02:
        polygon.material_index = rock_slot
        reveal += 1
report["revealFacesToSandstone"] = reveal

# 2. Clear the old gym (every gym_ object), previous runs' shell parts and the living room.
removed = 0
for obj in [o for o in bpy.data.objects if o.name.startswith("gym_") or o.get("gymRoom") or o.get("livingRoom")]:
    bpy.data.objects.remove(obj, do_unlink=True)
    removed += 1
report["removedObjects"] = removed

mats = gymkit.gym_materials()
bronze = bpy.data.materials["dark bronze"]
glass = bpy.data.materials["facade low-iron glass"]
travertine = bpy.data.materials["travertine paving stone"]
oak = bpy.data.materials["pale oak"]


def oriented_box(bm, center, size, angle):
    m = Matrix.Translation(center) @ Matrix.Rotation(angle, 4, "Z") @ Matrix.Diagonal((*size, 1))
    bmesh.ops.create_cube(bm, size=1, matrix=m)


shell = []
# Floors: polished concrete to the glass, a travertine ledge from the glass to the cliff face,
# and oak through the passage. Their tops meet the house's floor level.
(ax, ay), (bx, by) = FRONT
inside = [(ROOM["x0"], ROOM["back"]), (ROOM["x1"], ROOM["back"]), (bx, by), (ax, ay)]
bm = bmesh.new()
gymkit.slab(bm, inside, -0.28, -0.015)
shell.append(decor.from_bmesh("core_gym_floor", bm, mats["concrete"], smooth=False))
samples = [ROOM["x0"] + (ROOM["x1"] - ROOM["x0"]) * k / 10 for k in range(11)]
face_line = [(x, min(cliff_surface(x, z) for z in (0.0, 0.5, 1.0)) - 0.04) for x in samples]
ledge = [(x, front_y(x)) for x in samples] + list(reversed(face_line))
bm = bmesh.new()
gymkit.slab(bm, ledge, -0.28, -0.015)
shell.append(decor.from_bmesh("core_gym_ledge", bm, travertine, smooth=False))
bm = bmesh.new()
gymkit.slab(bm, [(PASSAGE["x0"], PASSAGE["y0"]), (PASSAGE["x1"], PASSAGE["y0"]), (PASSAGE["x1"], PASSAGE["y1"]), (PASSAGE["x0"], PASSAGE["y1"])], -0.28, -0.015)
shell.append(decor.from_bmesh("core_gym_passage_floor", bm, oak, smooth=False))

# The glazed mouth: bronze sill, mullions and an arched head along the cliff's line, with panes of
# the same anti-reflective glass as the main front.
angle = math.atan2(by - ay, bx - ax)
along = Vector((bx - ax, by - ay, 0)).normalized()
frame, panes = bmesh.new(), bmesh.new()
mullions = [k / 4 for k in range(5)]
length = Vector((bx - ax, by - ay)).length
oriented_box(frame, ((ax + bx) / 2, (ay + by) / 2, 0.02), (length + 0.06, 0.09, 0.04), angle)


def point(t, z):
    return Vector((ax + (bx - ax) * t, ay + (by - ay) * t, z))


for t in mullions:
    p = point(t, 0)
    top = vault_height(p.x) - 0.02
    oriented_box(frame, (p.x, p.y, top / 2), (0.07, 0.09, top), angle)
steps = 48
for k in range(steps):
    t0, t1 = k / steps, (k + 1) / steps
    p0, p1 = point(t0, 0), point(t1, 0)
    z0, z1 = vault_height(p0.x) - 0.04, vault_height(p1.x) - 0.04
    mid = (p0 + p1) / 2
    run = math.hypot((p1 - p0).length, z1 - z0)
    head = Matrix.Translation((mid.x, mid.y, (z0 + z1) / 2)) @ Matrix.Rotation(angle, 4, "Z") @ Matrix.Rotation(-math.atan2(z1 - z0, (p1 - p0).length), 4, "Y") @ Matrix.Diagonal((run + 0.01, 0.09, 0.06, 1))
    bmesh.ops.create_cube(frame, size=1, matrix=head)
for a, b in zip(mullions, mullions[1:]):
    outline = []
    ta, tb = a + 0.04 / length, b - 0.04 / length
    for k in range(13):
        t = ta + (tb - ta) * k / 12
        p = point(t, 0)
        outline.append((p.x, p.y, vault_height(p.x) - 0.08))
    lower = [point(tb, 0.05), point(ta, 0.05)]
    verts = [panes.verts.new((v.x, v.y, v.z)) for v in lower] + [panes.verts.new(c) for c in outline]
    panes.faces.new(verts)
shell.append(decor.from_bmesh("core_gym_front_frame", frame, bronze, smooth=False))
shell.append(decor.from_bmesh("core_gym_front_glass", panes, glass, smooth=False))
for obj in shell:
    obj["gymRoom"] = True

# 3. The gym's equipment and the living room.
equipment = gymkit.build_gym(mats)
living = gymkit.build_living(mats)
# The right-hand working dumbbell keeps the prop name today's scene looks for.
for obj in equipment:
    if obj.get("activityProp") == "exercise-weight-right":
        obj["activityProp"] = "exercise-weight"
report["gymObjects"] = {o.name: len(o.data.vertices) for o in equipment}
report["livingObjects"] = {o.name: len(o.data.vertices) for o in living}

# 4. The web manifest: the gym room, its stations and walls; the walk through the passage.
config = json.loads(MANIFEST.read_text(encoding="utf-8"))
S = STATIONS
gym = next(r for r in config["rooms"] if r["id"] == "gym")
gym.update(
    target=web((8.75, 1.0, 1.15)),
    actor=web(S["rest"]["actor"]),
    facing=math.pi,
    egress=web((4.45, 1.55, 0.0)),
    exitPath=[web((6.9, 1.55, 0.0)), web((5.5, 1.55, 0.0)), web((4.45, 1.55, 0.0))],
)
gym["camera"] = {"radius": 3.0, "yaw": 3.0, "pitch": 0.2, "fov": 52, "envelope": {"yaw": [2.7, 3.38], "pitch": [0.06, 0.5], "radius": [2.2, 3.2]}}
px, py, pz = S["pullup"]["bar"]
grip = S["pullup"]["grip"]
(l, r) = S["dip"]["handles"]
dip_y = S["dip"]["actor"][1]
config["equipment"].update(
    pullup={"actor": web(S["pullup"]["actor"]), "facing": math.pi, "hands": [web((px - grip, py, pz)), web((px + grip, py, pz))]},
    dip={"actor": web(S["dip"]["actor"]), "facing": math.pi, "hands": [web((l[0], dip_y, l[2])), web((r[0], dip_y, r[2]))]},
    dumbbell={"actor": web(S["dumbbells"]["actor"]), "facing": math.pi, "rest": web(S["dumbbells"]["pair"][0]), "restLeft": web(S["dumbbells"]["pair"][1]), "hands": []},
    bench={"parked": web(S["bench"]["actor"])},
)
config["equipment"]["gym"] = {
    # Back squats inside the cage facing the room; presses and front squats facing the rack.
    "rack": {"bar": web(S["rack"]["bar"]), "actor": web(S["rack"]["actor"]), "unrack": web(S["rack"]["unrack"]), "facing": math.pi,
             "press": web(S["rack"]["press"]), "pressUnrack": web(S["rack"]["pressUnrack"]), "entry": web(S["rack"]["entry"]),
             "posts": {"x": list(S["rack"]["posts"]["x"]), "z": sorted(-y for y in S["rack"]["posts"]["y"])}},
    "platform": {"bar": web(S["platform"]["bar"]), "actor": web(S["platform"]["actor"]), "facing": math.pi},
    # The lifter lies with the head under the uprights (+X) and faces the feet (-X): facing -pi/2.
    # "mount" is where they stand at the seat end before sitting astride the bench.
    "bench": {"bar": web(S["bench"]["bar"]), "barAxis": "z", "actor": web(S["bench"]["actor"]), "facing": -math.pi / 2,
              "mount": web((S["bench"]["pad"]["x"][0] - 0.2, S["bench"]["pad"]["y"], 0.0)),
              "seat": web(S["rest"]["seat"]), "inclineDegrees": S["bench"]["inclineDegrees"], "hinge": web((S["bench"]["pad"]["x"][0] + 0.42, S["bench"]["pad"]["y"], S["bench"]["pad"]["top"] - 0.055))},
    "pullup": {"bar": web(S["pullup"]["bar"]), "grip": grip, "actor": web(S["pullup"]["actor"]), "facing": math.pi},
    "dip": {"actor": web(S["dip"]["actor"]), "facing": math.pi, "hands": [web((l[0], dip_y, l[2])), web((r[0], dip_y, r[2]))],
            "front": web((S["dip"]["actor"][0], S["dip"]["bars"]["y"][1] + 0.3, 0.0))},
    "dumbbells": {"actor": web(S["dumbbells"]["actor"]), "facing": math.pi, "pair": [web(p) for p in S["dumbbells"]["pair"]]},
    "whiteboard": {"center": web(S["whiteboard"]["center"]), "size": list(S["whiteboard"]["size"]), "actor": web(S["whiteboard"]["actor"]), "facing": 0.0},
    "plates": {"tree": web(S["plates"]["tree"])},
    "rest": {"actor": web(S["rest"]["actor"]), "seat": web(S["rest"]["seat"]), "bottle": web(S["rest"]["bottle"])},
}
# The rock between the house and the gym, and the gym's walls, for camera transitions.
walls = config.setdefault("cameraCollision", {}).setdefault("walls", [])
walls[:] = [w for w in walls if not w.get("gym")]
walls.append({"gym": True, "min": web((5.25, ROOM["back"], -0.3))[:2] + [-front_y(ROOM["x0"])], "max": web((ROOM["x0"], 0, 3.6))[:2] + [1.0]})
for w in walls[-1:]:
    lo = [min(a, b) for a, b in zip(w["min"], w["max"])]
    hi = [max(a, b) for a, b in zip(w["min"], w["max"])]
    w["min"], w["max"] = [round(v, 3) for v in lo], [round(v, 3) for v in hi]
config["activities"]["workout"]["room"] = "gym"
# The shell's room anchor marks where the routine arrives (the scene and tests read it).
anchor = bpy.data.objects.get("anchor_gym")
if anchor:
    anchor.location = Vector(S["rest"]["actor"])
# Navigation reads each room's floor contact from terrain.contacts; keep the gym's in step.
config.setdefault("terrain", {}).setdefault("contacts", {})["gym"] = {k: gym[k] for k in ("actor", "egress", "floor", "exitPath") if k in gym}

if preview:
    out = Path(preview)
    out.mkdir(parents=True, exist_ok=True)
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x, scene.render.resolution_y = 1100, 760
    for obj in scene.objects:
        if obj.get("caveRoof"):
            obj.hide_render = True
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 20))
    sun = bpy.context.object
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(62), 0, math.radians(-100))
    bpy.ops.object.light_add(type="AREA", location=(8.6, 1.8, 3.0))
    lamp = bpy.context.object
    lamp.data.energy = 300
    lamp.data.size = 3
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    scene.camera = cam
    cam.data.angle = math.radians(60)
    views = {
        "gym-room": ((8.3, 4.2, 1.8), (8.9, 0.6, 1.0)),
        "gym-corner": ((8.9, 2.6, 1.6), (10.1, -0.5, 1.3)),
        "gym-sea": ((6.0, 14.0, 4.0), (8.5, 4.0, 1.5)),
        "gym-from-lounge": ((3.2, 1.6, 1.6), (8.0, 1.5, 1.2)),
        "living": ((0.2, 4.2, 2.6), (0.0, 1.2, 0.4)),
        "living-wide": ((-3.0, 4.3, 3.2), (1.5, 0.8, 0.6)),
        "cliff-outside": ((2.0, 26.0, 6.0), (6.0, 3.0, 2.0)),
    }
    for name, (eye, target) in views.items():
        cam.location = eye
        cam.rotation_euler = (Vector(target) - Vector(eye)).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(out / f"{name}.png")
        bpy.ops.render.render(write_still=True)
    print(json.dumps(report, indent=2), flush=True)
    sys.exit(0)

MANIFEST.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
(ROOT / "artwork/coastal-home/reviews/gym.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2), flush=True)
