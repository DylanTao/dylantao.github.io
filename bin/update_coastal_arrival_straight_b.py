"""Bind the source-verified straight arrival to the existing coastal runtime."""

from argparse import ArgumentParser
import json
import math
from pathlib import Path
from refresh_coastal_arrival_contacts import fit_manifest_dining


def route_point(value):
    return [round(number, 6) for number in value]


def bind_upper_access(config, main_entry, link):
    stairs = config["navigation"]
    landing = link["route"][0][1]
    floor = [point for point in reversed(main_entry) if point[1] == 0]
    treads = [point for point in reversed(main_entry) if 0 < point[1] <= landing]
    stairs["lowerStairApproach"] = floor
    stairs["stairs"] = [floor[-1], *treads, *link["route"]]
    stairs["upperLandingHeight"] = landing
    if rail := link.get("rail"):
        prior = next(line for line in config["installationLines"] if line["id"] == "arrival-rail-a")
        prior.update(rail["lightLine"])
    # Daily routes from the western rooms go around the front of the living pit.
    # East-side egresses already have a clear straight connection to the foyer.
    living_crossing = [[-1.155, 0, 5.29], [2.595, 0, 5.29], [2.745, 0, 5.44], [3.195, 0, 6.04]]
    stairs["lowerStairExits"] = {
        **{room: [[-3, 0, 5.6], *living_crossing] for room in ("study", "sleep", "library")},
        "kitchen": living_crossing,
    }
    # The narrow turn behind the old chair positions is covered by the refitted set.
    guest_room = next(room for room in config["rooms"] if room["id"] == "bath-living")
    bath = guest_room["bathroom"]
    bath["route"] = [floor[0], *reversed(living_crossing), [-4.605, 0, 13.39], [-5.8, 0, 12.05]]
    guest_room["egress"] = floor[0]
    guest_room["exitPath"] = list(reversed(bath["route"][:-1]))
    config["terrain"]["contacts"]["bath-living"].update(
        egress=guest_room["egress"], exitPath=guest_room["exitPath"],
    )

    surfaces = config["terrain"]["supportSurfaces"]
    half_width = config["entrance"]["stairWidth"] * .5
    half_going = config["entrance"]["going"] * .5
    for index, (x, height, z) in enumerate(treads, 1):
        surfaces.append({
            "id": f"arrival-b-tread-{index}", "height": height,
            "polygon": [
                [x-half_width, z-half_going], [x+half_width, z-half_going],
                [x+half_width, z+half_going], [x-half_width, z+half_going],
            ],
        })
    surfaces.append({
        "id": "arrival-b-upper-link", "height": link["nativeSillHeight"],
        "polygon": [[x, -y] for x, y in link["nativePlan"]],
    })


def update(config, builder, native, upper_link=None):
    route_source = native.get("routeSourceSha256", native["outputSha256"])
    if builder["outputSha256"] != route_source or not native["passed"] or not native["optics"]["passed"]:
        raise ValueError("Use matching native source and journey evidence with passing support and optics")
    if route_source != native["outputSha256"] and not native.get("retainedRouteGeometrySha256"):
        raise ValueError("Later house revisions must verify the retained native stair")
    if len(builder["routeProbes"]) != 61:
        raise ValueError("The measured straight arrival has 61 support stations")
    portal, *passage, terminal = [route_point(point) for point in builder["routeProbes"]]
    route = [portal, *passage, terminal]
    config["entrance"].update({
        "straightDescent": True,
        "firstVisit": True,
        "headroom": native["minimumHeadroom"],
        "top": portal[1],
        "floor": terminal[1],
        "portal": portal,
        "foyer": terminal,
        "route": list(reversed(route)),
        "rill": builder["rill"],
        "going": builder["going"],
        "stairWidth": builder["stairWidth"],
        "hall": {"min": [-1.705, 0, 11.145], "max": [1.455, 10.5, 31.865]},
        "pivotDoor": {
            "x": [builder["door"]["opening"]["min"][0], builder["door"]["opening"]["max"][0]],
            "height": builder["door"]["opening"]["max"][1],
            "pivotX": builder["door"]["pivot"]["x"],
            "z": builder["door"]["pivot"]["z"],
        },
    })
    fit_manifest_dining(config)
    walk = config["walk"]
    walk["start"] = {"position": portal, "yaw": math.pi, "pitch": -0.08}
    walk["mainEntryRoute"] = route
    walk["places"]["arrival-hall"] = {
        "label": "Arrival hall", "room": "lounge", "position": terminal, "yaw": math.pi, "pitch": 0, "fov": 60,
    }
    doors = config["estateDoors"]
    main = [index for index, door in enumerate(doors) if door["id"] == "main"]
    if len(main) != 1:
        raise ValueError("The current coastal loft must have one main estate door")
    doors[main[0]] = builder["door"]
    guest = next(room["bathroom"] for room in config["rooms"] if room["id"] == "bath-living")
    guest["route"] = [
        terminal, [-0.705, 0, 9.64], [-3.255, 0, 10.09],
        [-4.605, 0, 13.39], [-5.80, 0, 12.05],
    ]
    terrain = config["terrain"]
    terrain["supportSurfaces"] = [
        surface for surface in terrain["supportSurfaces"] if not surface["id"].startswith(("arrival-hall-", "arrival-b-"))
    ]
    upper_link = upper_link or builder.get("upperLink")
    if upper_link:
        if upper_link.get("outputSha256", builder["outputSha256"]) != route_source:
            raise ValueError("The upper link receipt belongs to a different native source")
        bind_upper_access(config, route, upper_link)


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--builder-report", type=Path, required=True)
    parser.add_argument("--native-proof", type=Path, required=True)
    parser.add_argument("--upper-link-report", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    config, builder, native = (
        json.loads(path.read_text(encoding="utf-8"))
        for path in (args.manifest, args.builder_report, args.native_proof)
    )
    upper_link = json.loads(args.upper_link_report.read_text(encoding="utf-8")) if args.upper_link_report else None
    update(config, builder, native, upper_link)
    args.out.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(args.out)


if __name__ == "__main__":
    main()
