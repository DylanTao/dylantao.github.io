"""What the whole-home section still hides.

Orbiting the house lifts its roof (the objects tagged ``caveRoof``). This probe answers, from the
house file itself, what a viewer straight above then sees: for every cell of the plan it casts a
ray down, steps past the lift-away pieces, and records the first thing it meets and whether a room
lies underneath. It prints how much of the rooms' area is open, what hides the rest (cliff rock,
planting, built things on the clifftop), and which rooms those are.

    blender -b --factory-startup artwork/coastal-home/coastal-home.blend \
        --python bin/probe_coastal_cutaway.py -- [--step=0.25] [--cut=5.5] [--out=report.json]

November 15, 2026, before any change: 253 m2 of room surface under the plan, 34 % of it open from
above; 24 % under cliff rock (the whole gym, the bedroom's bath, part of the library and of the
upper floor, the arrival hall), 36 % under clifftop planting, 6 % under built things. Read it again
after carving a new lift-away roof: the room it covers should move to "open".

Blender is z-up with +y toward the sea; the site's scene is y-up with +z toward the sea.
"""

import json
import sys
from collections import defaultdict

import bpy
from mathutils import Vector

CLIFF = "core__golden coastal sandstone"
# The house's plan: a little wider than the main lift-away roof (core_retreat_liftaway_roof).
PLAN = (-13.0, 11.5, -17.0, 0.0)
PLANTING = ("flora", "planting", "agave", "palm", "torrey", "sage", "iceplant", "berry")


def arguments():
    if "--" not in sys.argv:
        return {}
    return dict(a[2:].split("=", 1) for a in sys.argv[sys.argv.index("--") + 1 :] if a.startswith("--") and "=" in a)


def is_planting(name):
    return any(key in name for key in PLANTING)


def main():
    args = arguments()
    step = float(args.get("step", "0.25"))
    cut = float(args.get("cut", "5.5"))
    scene = bpy.context.scene
    depsgraph = bpy.context.evaluated_depsgraph_get()
    roofs = {o.name for o in scene.objects if o.type == "MESH" and o.get("caveRoof")}

    def is_room(name, z, up):
        """A floor, or the top of something standing in a room."""
        if name == CLIFF or name in roofs or name.startswith("coast_shared") or is_planting(name):
            return False
        if any(key in name for key in ("water", "terrace", "pool", "infinity")):
            return False
        return -0.6 <= z <= 5.0 and up > 0.7

    def column(x, y):
        hits = []
        origin, direction = Vector((x, y, 60.0)), Vector((0, 0, -1))
        for _ in range(200):
            ok, location, normal, _index, obj, _matrix = scene.ray_cast(depsgraph, origin, direction)
            if not ok or location.z < -1.0:
                break
            if obj.name not in roofs:
                hits.append((obj.name, location.z, normal.z))
            origin = location + direction * 0.003
        return hits

    x0, x1, y0, y1 = PLAN
    cell = step * step
    rooms = opened = 0.0
    hidden_by = defaultdict(float)
    hidden_rooms = defaultdict(lambda: defaultdict(float))
    covers = defaultdict(lambda: defaultdict(float))
    grid = []
    y = y0
    while y <= y1 + 1e-9:
        row = []
        x = x0
        while x <= x1 + 1e-9:
            hits = column(x, y)
            room = next((hit for hit in hits if is_room(*hit)), None)
            if room is None:
                row.append(0)
            else:
                rooms += cell
                first = hits[0]
                if first is room or first[1] < cut:
                    opened += cell
                    row.append(1)
                else:
                    kind = "rock" if first[0] == CLIFF else "planting" if is_planting(first[0]) else "built"
                    hidden_by[kind] += cell
                    hidden_rooms[kind][room[0]] += cell
                    covers[kind][first[0]] += cell
                    row.append({"rock": 2, "planting": 3, "built": 4}[kind])
            x += step
        grid.append(row)
        y += step

    print(f"lift-away pieces: {len(roofs)}")
    print(f"rooms under the plan: {rooms:.1f} m2; open to a viewer straight above: {opened:.1f} m2 ({100 * opened / max(rooms, 1e-9):.0f} %)")
    report = {"step": step, "cut": cut, "plan": PLAN, "roofs": sorted(roofs), "rooms": round(rooms, 1), "open": round(opened, 1), "hidden": {}}
    for kind, area in sorted(hidden_by.items(), key=lambda item: -item[1]):
        print(f"  hidden by {kind}: {area:.1f} m2 ({100 * area / rooms:.0f} %)")
        report["hidden"][kind] = {
            "area": round(area, 1),
            "by": {name: round(a, 1) for name, a in sorted(covers[kind].items(), key=lambda item: -item[1])[:12]},
            "rooms": {name: round(a, 1) for name, a in sorted(hidden_rooms[kind].items(), key=lambda item: -item[1])[:16]},
        }
        for name, a in sorted(covers[kind].items(), key=lambda item: -item[1])[:6]:
            print(f"      under {a:6.1f} m2 of {name}")
        for name, a in sorted(hidden_rooms[kind].items(), key=lambda item: -item[1])[:10]:
            print(f"      hides {a:6.1f} m2 of {name}")
    if args.get("out"):
        # 0 no room, 1 open, 2 under rock, 3 under planting, 4 under something built.
        report["grid"] = grid
        with open(args["out"], "w", encoding="utf-8") as handle:
            json.dump(report, handle)
        print("wrote", args["out"])


main()
