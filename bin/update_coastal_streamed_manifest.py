"""Bind verified coastal detail GLBs and native bedding variants to the room manifest."""

from argparse import ArgumentParser
from hashlib import sha256
import json
from pathlib import Path

# Y-up GLB world coordinates in metres. The boxes reach each walking approach
# and the adjacent eye-height band so orbit and free look can warm the detail.
# Room views request the packs explicitly while the selected room is attaching.
DETAIL_VIEWS = {
    "bar": (
        ("speakeasy", "supper-gallery", "terrace", "study", "outside", "overview"),
        (-15.5, -0.4, -12.0),
        (-8.1, 5.6, -5.4),
    ),
    "bath": (
        ("garden", "gym", "ocean-baths", "tea-garden", "terrace", "outside", "overview"),
        (-8.5, -1.8, -9.5),
        (17, 5, -1.25),
    ),
    "garden": (
        ("entrance", "outside", "overview"),
        (-7.8, 6.3, 7.5),
        (9.8, 11.2, 22.8),
    ),
}


ROOM_APPROACH = {
    "library": ((-13.8, -0.45, -1.8), (-7.0, 6.8, 11.6)),
    "bath-living": ((-8.7, -0.45, 9.05), (-3.8, 2.45, 15.3)),
    "bath-bedroom": ((-8.7, 2.15, 9.05), (-3.8, 5.9, 15.3)),
    "onsen": ((0.65, 2.15, 8.2), (6.0, 6.1, 14.2)),
}


def verify_output(directory, report):
    file = report["file"]
    if Path(file).name != file:
        raise ValueError(f"Invalid package filename: {file}")
    data = (directory / file).read_bytes()
    if len(data) != report["bytes"] or sha256(data).hexdigest() != report["sha256"]:
        raise ValueError(f"Packed bytes differ from their receipt: {file}")


def update_manifest(manifest, report):
    if "listeningCoveWorld" in report:
        ends = report["listeningCoveWorld"]
        lines = [p for p in manifest["installationLines"] if p["id"] != "walnut-cove"]
        lines.append({
            "id": "walnut-cove", "schedule": "listening", "a": ends[:3], "b": ends[3:],
            "intensity": .51, "color": [1, .67, .385], "transport": False,
            "region": {"min": [-12.48, 1.5, -8.25], "max": [-9.64, 2.85, -6.29]},
        })
        manifest["installationLines"] = lines
    if "terraceFireWorld" in report:
        x, bed_y, z = report["terraceFireWorld"]
        terrace = {"min": [-11.96, -0.04, -12.28], "max": [-8.40, 2.1, -9.82]}
        receivers = manifest["installationReceivers"]["groups"]["speakeasy"]
        receivers["min"][2] = min(receivers["min"][2], terrace["min"][2])
        points = [p for p in manifest["installationPoints"] if p["id"] != "loggia-fire"]
        points.append({
            "id": "loggia-fire", "schedule": "listening",
            "position": [x, round(bed_y + 0.266, 3), z],
            "intensity": 1.48, "color": [1, 0.54, 0.24], "region": terrace,
            "transport": False, "emitterRadius": 0.16,
        })
        manifest["installationPoints"] = points
    bedding = report["bedding"]
    expected = {"empty"} | {avatar["id"] for avatar in manifest["avatars"]}
    if set(bedding) != expected:
        missing = sorted(expected - bedding.keys())
        extra = sorted(bedding.keys() - expected)
        raise ValueError(f"Native bedding tags do not match avatar ids. Missing={missing}, extra={extra}")
    manifest["streamedBedding"] = {variant: bedding[variant]["file"] for variant in sorted(bedding)}
    manifest["streamedDetails"] = []
    for kind, (places, near_min, near_max) in DETAIL_VIEWS.items():
        if kind == "garden" and report.get("expandedUpperTerrace"):
            near_min = (-24.0, 6.0, -8.5)
            near_max = (31.5, 16.0, 22.8)
        detail = {
            "file": report[kind]["file"],
            "places": places,
            "near": {"min": near_min, "max": near_max},
            "members": report[f"{kind}GeometryOnly"],
        }
        finishes = sorted(
            name for name in report["finishMaterials"]
            if (kind == "bar" and name.startswith("listening room "))
            or (kind == "bath" and name in ("Silver pea gravel", "Basin · tidal glass tesserae"))
        )
        if finishes:
            detail["finishMaterials"] = finishes
        manifest["streamedDetails"].append(detail)

    if "firewood" in report:
        manifest["streamedDetails"].append(firewood_entry(report))
    if "entryArt" in report:
        manifest["streamedDetails"].append({
            "file": report["entryArt"]["file"],
            "places": ["entrance", "outside", "overview"],
            "near": {"min": [-6.2, 4.9, 22.3], "max": [6.4, 13.9, 34.2]},
            "firstFrame": ["entrance"],
            "members": report["entryArtGeometryOnly"],
        })
    if "poolRelief" in report:
        # The new straight entrance is enclosed all the way to its opening.
        # From the shore a walking visitor can see the fins well before
        # reaching the structure, including from the lower lift landing.
        manifest["streamedDetails"].append({
            "file": report["poolRelief"]["file"],
            "places": ["outside", "overview", "terrace", "garden", "gym", "ocean-baths", "beach"],
            "near": {"min": [-13.4, -7.7, -17.0], "max": [6.1, 3.35, -1.25]},
            "firstFrame": ["outside", "overview", "terrace", "gym"],
            "members": report["poolReliefGeometryOnly"],
        })

    for room, packed in report.get("roomDetails", {}).items():
        low, high = ROOM_APPROACH[room]
        places = [room, "overview", "outside"]
        if room == "library":
            places.append("library-upper")
        manifest["streamedDetails"].append({
            "file": packed["detail"]["file"],
            "room": room,
            "places": places,
            "near": {"min": low, "max": high},
            "members": packed["geometryOnly"],
            **(
                {"firstFrame": ["study", "library", "library-upper", "lounge", "sleep"]}
                if room == "library"
                else {"firstFrame": ["onsen"]} if room == "onsen" else {}
            ),
        })



def firewood_entry(report):
    return {
        "file": report["firewood"]["file"],
        "places": ["lounge", "kitchen", "study", "outside", "overview"],
        "firstFrame": ["lounge", "kitchen"],
        "near": {"min": [-2.0, -0.5, 9.0], "max": [5.5, 3.65, 18.0]},
        "members": report["firewoodGeometryOnly"],
    }


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--split-report", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    report = json.loads(args.split_report.read_text(encoding="utf-8"))
    root = args.split_report.parent
    for entry in [report[key] for key in ("shell", "sleepBase", *DETAIL_VIEWS)] + list(report["bedding"].values()):
        verify_output(root, entry)
    if "entryArt" in report:
        verify_output(root, report["entryArt"])
    if "poolRelief" in report:
        verify_output(root, report["poolRelief"])
    if "firewood" in report:
        verify_output(root, report["firewood"])
    for packed in report.get("roomDetails", {}).values():
        verify_output(root, packed["base"])
        verify_output(root, packed["detail"])
    update_manifest(manifest, report)
    args.out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(args.out)


if __name__ == "__main__":
    main()
