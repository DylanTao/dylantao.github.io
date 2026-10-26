"""Sirui's whiskey corner in the study: a loveseat by the hearth, facing the sea (October 25).

    blender --background -t 8 --python-exit-code 1 --python bin/refresh_coastal_whiskey_corner.py -- \\
        [--source=artwork/coastal-home/coastal-home.blend] [--manifest=assets/models/home/manifest.json] \\
        [--output=.jekyll-cache/whiskey-corner/coastal-home.blend] [--config-output=.jekyll-cache/whiskey-corner/manifest.json]

"i like whiskey so my study, i want a nice place and comfy small sofa with ottoman for me to enjoy
whiskry and enjoy the ocean view", and "some nice bottles there" (Sirui). The library's sea end, between
the glass and the desk with the hearth on its west wall, becomes that corner:

- the two reading chairs there are retired, clearing the floor;
- a bottle niche is cut 0.30 m into the west wall between the window and the hearth, lined in the
  hearth's honed travertine, with a warm line of light hidden under its lintel;
- four furniture anchors, with plain placeholders until the life worker's items stream: the loveseat
  (anchor ``study-whiskey-lounge``, its origin, facing the sea), the ottoman and the side table placed
  in the loveseat's frame (ottoman centre at x +0.28, z +0.86 under the occupied seat;
  table at x +0.95, z +0.05 by the reaching hand), and the bottle display
  on the niche's shelf;
- the library's visit spot and route move to the window past the loveseat's east side, and the
  companion's first exit point to its own perch, clear of the loveseat's back.

Coordinates are final three.js world metres (x, up, zw). A source already carrying
``whiskeyCornerVersion`` is a checked no-op.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_anchors as anchors  # noqa: E402
import coastal_arrival_hall as hall  # noqa: E402
from coastal_office import Parts  # noqa: E402

VERSION = 2
ARGS = {a[2:].split("=", 1)[0]: a.split("=", 1)[1] for a in sys.argv if a.startswith("--") and "=" in a}


def _path(key, default):
    p = Path(ARGS.get(key, default))
    return p if p.is_absolute() else ROOT / p


# The loveseat's origin (floor-contact centre) and facing: the sea, so its front looks down -zw.
ORIGIN = (-10.50, 0.0, 2.55)
YAW = math.pi
# Item bounds from the life worker's furniture index (x across, z front-back, local metres).
LOVESEAT = {"half": (0.73, 0.456), "seat": 0.46, "back": 0.82}
OTTOMAN = {"at": (0.28, 0.86), "half": (0.33, 0.25), "top": 0.42}
TABLE = {"at": (0.95, 0.05), "half": (0.26, 0.26), "top": 0.896}
# The niche: its opening in the west wall (lining face at x -12.55), the shelf and lintel, 2 cm liners.
NICHE = {"zw": (0.89, 1.93), "h": (0.93, 1.57), "face": -12.55, "back": -12.85, "liner": 0.02, "proud": 0.005}
BOTTLES = {"half": (0.467, 0.063)}
# The library visit walks in east of the desk, turns in front of it clear of the shelf's end, and comes
# down the 0.72 m between the loveseat and the east shelf to the window.
ROUTE = {"spot": (-9.41, 1.55), "turn": (-9.41, 3.8)}


def world(local_x, local_z):
    """A point in the loveseat's frame (front +z) to world (x, zw)."""
    sx, cz = math.sin(YAW), math.cos(YAW)
    # Rotation about +Y by YAW in three.js: x' = x cos + z sin, z' = -x sin + z cos.
    return ORIGIN[0] + local_x * cz + local_z * sx, ORIGIN[2] - local_x * sx + local_z * cz


def frame_of(name):
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise RuntimeError(f"missing {name}")
    return obj.matrix_world.copy()


def box(bm, frame_inv, x0, x1, z0, z1, h0, h1):
    """A closed box given in world (x, zw, h), written in the room batch's local frame."""
    temp = bmesh.new()
    hall.wbox(temp, x0, x1, z0, z1, h0, h1)
    for v in temp.verts:
        v.co = frame_inv @ v.co
    hall._append(bm, temp)


source = _path("source", "artwork/coastal-home/coastal-home.blend")
manifest_path = _path("manifest", "assets/models/home/manifest.json")
output = _path("output", ".jekyll-cache/whiskey-corner/coastal-home.blend")
config_output = _path("config-output", ".jekyll-cache/whiskey-corner/manifest.json")
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
config = json.loads(manifest_path.read_text(encoding="utf-8"))
if scene.get("whiskeyCornerVersion") == VERSION:
    print(json.dumps({"retained": True, "version": VERSION}), flush=True)
    sys.exit(0)
if scene.get("whiskeyCornerVersion") == 1:
    # The original left seat was 0.84-0.92 m from the side table, beyond every
    # delivered arm's 0.513 m chain. Occupy the other seat and align its ottoman;
    # moving the table instead would narrow the library's east passage.
    entry = next(a for a in config["furniture"] if a["id"] == "study-whiskey-ottoman")
    previous = list(entry["position"])
    target = world(*OTTOMAN["at"])
    dx, dz = target[0] - previous[0], target[1] - previous[2]
    objects = [o for o in scene.objects if o.get("furniturePlaceholder") == entry["id"]]
    if len(objects) != 1:
        raise RuntimeError(f"expected one retained ottoman placeholder, found {[o.name for o in objects]}")
    for obj in objects:
        obj.matrix_world.translation.x += dx
        obj.matrix_world.translation.y -= dz
    entry["position"] = [round(target[0], 4), previous[1], round(target[1], 4)]
    config["activities"]["lounge"]["whiskeyStation"] = "study-whiskey-lounge"
    scene["whiskeyCornerVersion"] = VERSION
    for p in (output, config_output):
        p.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    config_output.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8", newline="\n")
    report = {"version": VERSION, "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
              "ottomanBefore": previous, "ottomanAfter": entry["position"], "objects": [o.name for o in objects],
              "reason": "The other seat reaches the retained side table without narrowing the east passage."}
    (output.parent / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(report), flush=True)
    sys.exit(0)
report = {"version": VERSION}
config["activities"]["lounge"]["whiskeyStation"] = "study-whiskey-lounge"

# 1. The two reading chairs leave the sea end.
retired = [o.name for o in scene.objects if o.name.startswith("library_reading_seat")]
for name in retired:
    bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
if len(retired) != 6:
    raise RuntimeError(f"expected the two reading chairs' six batches, found {retired}")
report["retired"] = retired

# 2. The niche: one cutter through the wall's lining into the rock behind it.
m = {"rock": bpy.data.materials["golden coastal sandstone"]}
(nz0, nz1), (nh0, nh1) = NICHE["zw"], NICHE["h"]
targets = list(dict.fromkeys(hall._geology(scene) + [bpy.data.objects["core_retreat_library__chalk limestone"]]))
cutter = hall._cutter("whiskey niche", NICHE["back"] - 0.01, NICHE["face"] + 0.02, nz0, nz1, nh0, nh1, m["rock"])
report["cut"] = hall._apply(cutter, targets)

# The room's batches carry the retreat's setback; new parts are written in that frame.
frame = frame_of("library_refined_hearth__honed travertine")
inverse = frame.inverted()
niche = Parts("library_whiskey_niche")
travertine = niche.bm(bpy.data.materials["honed travertine"])
glow = niche.bm(bpy.data.materials["estate warm opal diffuser"])
t, front, back = NICHE["liner"], NICHE["face"] + NICHE["proud"], NICHE["back"]
box(travertine, inverse, back, front, nz0, nz1, nh0, nh0 + 0.04)  # the shelf
box(travertine, inverse, back, front, nz0, nz1, nh1 - 0.04, nh1)  # the lintel
box(travertine, inverse, back, front, nz0, nz0 + t, nh0 + 0.04, nh1 - 0.04)
box(travertine, inverse, back, front, nz1 - t, nz1, nh0 + 0.04, nh1 - 0.04)
box(travertine, inverse, back, back + t, nz0 + t, nz1 - t, nh0 + 0.04, nh1 - 0.04)
# A warm strip tucked under the lintel's front edge, washing the bottles and the stone behind them.
box(glow, inverse, front - 0.05, front - 0.02, nz0 + t + 0.02, nz1 - t - 0.02, nh1 - 0.055, nh1 - 0.04)
made = niche.finish()
for obj in made:
    obj.matrix_world = frame
    obj["installationGroup"] = "library"
    if obj.name.endswith("estate warm opal diffuser"):
        obj["installationGlow"] = "whiskey-niche"
report["niche"] = [o.name for o in made]

# 3. Placeholders, one per anchor, in the library's frame.
linen, ash = (bpy.data.materials[n] for n in ("linen", "honey ash"))
entries = []


def placeholder(anchor, item, position, yaw, parts):
    holder = anchors.Placeholder("library", anchor)
    for material, (x0, x1, z0, z1, h0, h1) in parts:
        box(holder.bm(material), inverse, x0, x1, z0, z1, h0, h1)
    obj = holder.finish()
    obj.matrix_world = frame
    entries.append({"id": anchor, "item": item, "room": "library", "position": [round(v, 4) for v in position], "yaw": round(yaw, 4)})
    return obj


def footprint(at, half):
    cx, cz = world(*at)
    # Square to the world axes at yaw pi, so local half extents map straight onto x and zw.
    return cx - half[0], cx + half[0], cz - half[1], cz + half[1]


lx0, lx1, lz0, lz1 = footprint((0.0, 0.0), LOVESEAT["half"])
back_z = world(0.0, -LOVESEAT["half"][1] + 0.18)[1]  # the backrest, at the loveseat's rear
placeholder("study-whiskey-lounge", "whiskey-loveseat", (ORIGIN[0], 0.0, ORIGIN[2]), YAW,
            [(linen, (lx0, lx1, lz0, lz1, 0.0, LOVESEAT["seat"])),
             (linen, (lx0, lx1, min(back_z, lz1), max(back_z, lz1), LOVESEAT["seat"], LOVESEAT["back"]))])
ox0, ox1, oz0, oz1 = footprint(OTTOMAN["at"], OTTOMAN["half"])
ottoman_at = world(*OTTOMAN["at"])
placeholder("study-whiskey-ottoman", "whiskey-ottoman", (ottoman_at[0], 0.0, ottoman_at[1]), YAW,
            [(linen, (ox0, ox1, oz0, oz1, 0.0, OTTOMAN["top"]))])
tx0, tx1, tz0, tz1 = footprint(TABLE["at"], TABLE["half"])
table_at = world(*TABLE["at"])
placeholder("study-whiskey-side-table", "whiskey-side-table", (table_at[0], 0.0, table_at[1]), YAW,
            [(ash, (tx0, tx1, tz0, tz1, TABLE["top"] - 0.03, TABLE["top"])),
             (ash, (table_at[0] - 0.04, table_at[0] + 0.04, table_at[1] - 0.04, table_at[1] + 0.04, 0.0, TABLE["top"] - 0.03))])
shelf = nh0 + 0.04
bottle_x = (NICHE["face"] + back + t) / 2
bottles = []
for k in range(6):
    z = nz0 + t + 0.08 + k * ((nz1 - nz0 - 2 * t - 0.16) / 5)
    bottles.append((ash, (bottle_x - 0.035, bottle_x + 0.035, z - 0.035, z + 0.035, shelf, shelf + 0.33)))
placeholder("study-whiskey-bottles", "whiskey-bottles", (bottle_x, shelf, (nz0 + nz1) / 2), math.pi / 2, bottles)
anchors.merge_anchors(config, entries)
report["anchors"] = entries

# 4. The library's visit spot moves to the window past the loveseat; its routes follow.
library = next(r for r in config["rooms"] if r["id"] == "library")
spot, turn = ROUTE["spot"], ROUTE["turn"]
library["actor"] = [spot[0], 0, spot[1]]
library["facing"] = math.pi
route = library["library"]["route"]
cut_at = next(i for i, p in enumerate(route) if abs(p[0] + 9.0) < 1e-6 and abs(p[2] - 3.8) < 1e-6)
library["library"]["route"] = route[:cut_at + 1] + [[turn[0], 0, turn[1]], [spot[0], 0, spot[1]]]
exit_path = library["exitPath"]
library["exitPath"] = [[turn[0], 0, turn[1]]] + [p for p in exit_path if not (abs(p[0] + 10.55) < 1e-6 and abs(p[2] - 3.3) < 1e-6)]
# The shell's room anchor (an empty the runtime places the occupant at) moves with the visit spot.
anchor_empty = bpy.data.objects.get("anchor_library")
if anchor_empty is None:
    raise RuntimeError("missing the shell's anchor_library empty")
anchor_world = anchor_empty.matrix_world.copy()
anchor_world.translation = hall.Vector(hall.native(spot[0], spot[1], 0.0))
anchor_empty.matrix_world = anchor_world
# Navigation reads each room's contacts from the terrain; they follow the room.
contacts = config["terrain"]["contacts"]["library"]
contacts["actor"] = list(library["actor"])
contacts["exitPath"] = [list(q) for q in library["exitPath"]]
companion_exit = config["companion"]["roomExits"]["library"]["exitPath"]
first_perch = config["companion"]["perches"]["library"][0]
if abs(companion_exit[0][0] + 10.55) < 1e-6 and abs(companion_exit[0][2] - 3.3) < 1e-6:
    companion_exit[0] = list(first_perch)

# 5. The niche's light: the hearth's evening schedule, inside the niche only.
lines = [line for line in config["installationLines"] if line.get("id") != "whiskey-niche"]
lines.append({"id": "whiskey-niche", "a": [front - 0.035, nh1 - 0.05, nz0 + t + 0.03], "b": [front - 0.035, nh1 - 0.05, nz1 - t - 0.03],
              "intensity": 0.35, "schedule": "libraryHearth", "transport": False, "glowTag": "whiskey-niche",
              "region": {"min": [back - 0.02, nh0 - 0.02, nz0 - 0.02], "max": [NICHE["face"] + 0.3, nh1 + 0.02, nz1 + 0.02]}})
config["installationLines"] = lines

# The companion's delivered route preset is the source its routes are read from: keep it equal.
preset_path = ROOT / "artwork/coastal-home/companion-flight-paths.json"
preset = json.loads(preset_path.read_text(encoding="utf-8"))
for key in preset:
    if key in config["companion"]:
        preset[key] = config["companion"][key]
preset_path.write_text(json.dumps(preset, indent=1) + "\n", encoding="utf-8", newline="\n")

scene["whiskeyCornerVersion"] = VERSION
for p in (output, config_output):
    p.parent.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
report["sourceSha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
config_output.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8", newline="\n")
(output.parent / "report.json").write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"output": str(output), "anchors": entries, "retired": retired}), flush=True)
