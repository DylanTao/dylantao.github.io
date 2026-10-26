"""The hills behind the footer coast: real ground and houses, seen from La Jolla Bay.

The footer frieze is a compressed panorama from a boat in La Jolla Bay, looking at the land:
Torrey Pines mesa and the campus to the north-east (left), the hills above La Jolla Shores to the
east, Mount Soledad to the south-east and the Village and the Cove to the south (right). Beyond
Point La Jolla the land ends and the open Pacific begins.

Ground: USGS 3D Elevation Program (3DEP), the National Map's 3DEPElevation image service (U.S.
Geological Survey, public domain). Houses: building footprints from OpenStreetMap (© OpenStreetMap
contributors, Open Database License 1.0). From the bay the script measures, along each compass
bearing, the skyline (the highest elevation angle over the Earth's curvature, with standard
refraction), a nearer ridge in front of it, and the houses whose windows face the bay. It writes
them in compact form to assets/js/footer-coast/skyline-data.mjs; skyline.mjs warps the bearings
onto the frieze's x axis. Downloads are cached in .jekyll-cache/coastal-skyline/ and never
committed; artwork/la-jolla/skyline/provenance.json records the sources, queries and counts.

Usage: python bin/coastal_skyline.py [--refresh]
"""
import gzip
import hashlib
import json
import math
import random
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".jekyll-cache" / "coastal-skyline"
OUT = ROOT / "assets" / "js" / "footer-coast" / "skyline-data.mjs"
RELIEF = ROOT / "assets" / "models" / "la-jolla" / "hills.png"
PROVENANCE = ROOT / "artwork" / "la-jolla" / "skyline" / "provenance.json"
AGENT = "SiruiCoastalSkyline/1.0 (dylantao.github.io)"

# West, south, east, north (degrees). The skyline lies within 7 km of the bay.
DEM_BOUNDS = (-117.32, 32.80, -117.18, 32.92)
DEM_SIZE = (1120, 960)
DEM_URL = (
    "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?"
    + urllib.parse.urlencode(
        {
            "bbox": ",".join(map(str, DEM_BOUNDS)),
            "bboxSR": 4326,
            "imageSR": 4326,
            "size": f"{DEM_SIZE[0]},{DEM_SIZE[1]}",
            "format": "tiff",
            "pixelType": "F32",
            "interpolation": "RSP_BilinearInterpolation",
            "f": "image",
        }
    )
)
OSM_BOUNDS = (32.825, -117.285, 32.895, -117.215)  # south, west, north, east
OSM_ENDPOINT = "https://api.openstreetmap.org/api/0.6/map"
OSM_TILE_COUNT = 4  # bounded 0.0175-degree map reads; public API's node limit applies per tile

# A boat in La Jolla Bay, about 1 km off the Shores, with an eye 15 m above the water.
VIEW = (32.862, -117.266)
EYE = 15.0
EARTH = 6371000.0
REFRACTION = 0.13  # the standard coefficient for a ray near the ground
BEARINGS = (0.0, 232.0, 0.5)  # first, last, step (degrees from north)
LIGHT_BEARINGS = (8.0, 214.0)
MAX_LIGHTS = 1200
# The relief as the bay sees it: one column per RELIEF_BEARING_STEP degrees, one row per RELIEF_STEP
# of elevation from RELIEF_LOW up to the highest crest.
RELIEF_BEARINGS = 929
RELIEF_BEARING_STEP = 0.25
RELIEF_LOW = -0.4
RELIEF_STEP = 0.04
RELIEF_ROWS = 147
RELIEF_KM = 8.0
NEAR_REACH = 1700.0  # metres: the foothills in front of Mount Soledad and the Shores ridge
NEAR_FALLOFF = 2.5 / 600  # degrees per metre beyond the reach


def fetch(url, path, data=None):
    if path.exists() and "--refresh" not in sys.argv:
        return path.read_bytes()
    print("Downloading", url[:96], flush=True)
    request = urllib.request.Request(url, data=data, headers={"User-Agent": AGENT})
    body = urllib.request.urlopen(request, timeout=180).read()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return body


def load_ground():
    path = CACHE / "3dep.tif"
    fetch(DEM_URL, path)
    ground = np.array(Image.open(path), dtype=np.float64)
    # The service leaves no-data and a few wild values offshore; La Jolla's ground stays below 260 m.
    ground = np.where(np.isfinite(ground) & (ground > -10) & (ground < 280), ground, 0.0)
    ground = np.maximum(ground, 0.0)
    # A 3 x 3 median removes single-pixel spikes without softening the ridges.
    padded = np.pad(ground, 1, mode="edge")
    stack = np.stack([padded[dy : dy + ground.shape[0], dx : dx + ground.shape[1]] for dy in range(3) for dx in range(3)])
    return np.median(stack, axis=0)


def load_buildings():
    path = CACHE / "osm-footprints.json.gz"
    if not path.exists() or "--refresh" in sys.argv:
        data = load_map_tiles()
        path.write_bytes(gzip.compress(json.dumps(data, separators=(",", ":")).encode()))
    data = json.loads(gzip.decompress(path.read_bytes()))
    return data, [footprint(e) for e in data["elements"] if "center" in e and len(e.get("geometry", [])) >= 3]


def load_map_tiles():
    """The Overpass services failed during the PC attempt. Read the same bounded area through
    OpenStreetMap's primary map API, retaining every raw tile and its hash. This is a sequence of
    map reads, not a claim of a single atomic historical snapshot. Ways shared by tiles are deduped.
    """
    south, west, north, east = OSM_BOUNDS
    ways, receipts = {}, []
    for j in range(OSM_TILE_COUNT):
        for i in range(OSM_TILE_COUNT):
            bounds = [round(west + (east - west) * i / OSM_TILE_COUNT, 6), round(south + (north - south) * j / OSM_TILE_COUNT, 6), round(west + (east - west) * (i + 1) / OSM_TILE_COUNT, 6), round(south + (north - south) * (j + 1) / OSM_TILE_COUNT, 6)]
            url = OSM_ENDPOINT + "?" + urllib.parse.urlencode({"bbox": ",".join(map(str, bounds))})
            raw = CACHE / f"osm-map-{j}-{i}.osm"
            packed = raw.with_suffix(".osm.gz")
            if packed.exists() and "--refresh" not in sys.argv:
                body = gzip.decompress(packed.read_bytes())
                retrieved = datetime.fromtimestamp(packed.stat().st_mtime, timezone.utc).isoformat()
            else:
                body = fetch(url, raw)
                packed.write_bytes(gzip.compress(body))
                raw.unlink()
                retrieved = datetime.now(timezone.utc).isoformat()
            root = ET.fromstring(body)
            nodes = {n.attrib["id"]: {"lat": float(n.attrib["lat"]), "lon": float(n.attrib["lon"])} for n in root.findall("node")}
            kept = 0
            for way in root.findall("way"):
                tags = {t.attrib["k"]: t.attrib["v"] for t in way.findall("tag")}
                if "building" not in tags or tags["building"] == "no":
                    continue
                points = [nodes[n.attrib["ref"]] for n in way.findall("nd") if n.attrib["ref"] in nodes]
                if len(points) < 3:
                    continue
                lat = (min(p["lat"] for p in points) + max(p["lat"] for p in points)) / 2
                lon = (min(p["lon"] for p in points) + max(p["lon"] for p in points)) / 2
                if not (south <= lat <= north and west <= lon <= east):
                    continue
                ways[way.attrib["id"]] = {"type": "way", "id": int(way.attrib["id"]), "center": {"lat": lat, "lon": lon}, "geometry": points, "tags": tags}
                kept += 1
            receipts.append({"url": url, "bounds_west_south_east_north": bounds, "retrieved_at_utc": retrieved, "raw_sha256": hashlib.sha256(body).hexdigest(), "building_ways_in_tile": kept})
    return {"source": "OpenStreetMap map API, bounded tile reads", "requests": receipts, "elements": sorted(ways.values(), key=lambda e: e["id"])}


def footprint(element):
    """The building's real footprint width across the bay view and depth along it.

    Height comes from OSM height/levels when encoded; otherwise 6 m is an explicit display
    assumption. No individual house, occupancy, or surveyed building height is inferred.
    """
    lat, lon = element["center"]["lat"], element["center"]["lon"]
    _, distance = place(lat, lon)
    dx = (lon - VIEW[1]) * 111320.0 * math.cos(math.radians(VIEW[0]))
    dy = (lat - VIEW[0]) * 110574.0
    along = np.array([dx, dy]) / max(distance, 1.0)
    across = np.array([-along[1], along[0]])
    points = np.array([[(p["lon"] - lon) * 111320.0 * math.cos(math.radians(lat)), (p["lat"] - lat) * 110574.0] for p in element["geometry"]])
    width = float(np.ptp(points @ across))
    depth = float(np.ptp(points @ along))
    tags = element.get("tags", {})
    def number(value):
        match = re.search(r"[0-9]+(?:\.[0-9]+)?", str(value or ""))
        return float(match[0]) if match else None
    height = number(tags.get("height"))
    if height and re.search(r"ft|feet|'", tags.get("height", "")):
        height *= 0.3048
    levels = number(tags.get("building:levels"))
    tagged = height is not None or levels is not None
    if height is None:
        height = levels * 3.0 if levels is not None else 6.0
    roof = 0 if tags.get("roof:shape") == "flat" else 1 if tags.get("roof:shape") in {"gabled", "hipped", "pyramidal"} else 0
    return {"lat": lat, "lon": lon, "width": width, "depth": depth, "height": max(2.0, min(height, 65.0)), "tagged_height": tagged, "roof": roof}


class Ground:
    def __init__(self, heights):
        self.h = heights
        self.rows, self.cols = heights.shape
        self.cos = math.cos(math.radians(VIEW[0]))

    def at(self, lat, lon):
        west, south, east, north = DEM_BOUNDS
        x = (lon - west) / (east - west) * self.cols - 0.5
        y = (north - lat) / (north - south) * self.rows - 0.5
        if x < 0 or y < 0 or x >= self.cols - 1 or y >= self.rows - 1:
            return 0.0
        x0, y0 = int(x), int(y)
        fx, fy = x - x0, y - y0
        h = self.h
        return (h[y0, x0] * (1 - fx) + h[y0, x0 + 1] * fx) * (1 - fy) + (h[y0 + 1, x0] * (1 - fx) + h[y0 + 1, x0 + 1] * fx) * fy

    def point(self, bearing, distance):
        b = math.radians(bearing)
        return VIEW[0] + distance * math.cos(b) / 110574.0, VIEW[1] + distance * math.sin(b) / (111320.0 * self.cos)


def elevation_angle(height, distance):
    drop = distance * distance * (1 - REFRACTION) / (2 * EARTH)
    return math.degrees(math.atan2(height - EYE - drop, distance))


def place(lat, lon):
    dx = (lon - VIEW[1]) * 111320.0 * math.cos(math.radians(VIEW[0]))
    dy = (lat - VIEW[0]) * 110574.0
    return (math.degrees(math.atan2(dx, dy)) + 360) % 360, math.hypot(dx, dy)


def ray(ground, bearing, until=9000.0, step=12.0):
    """(distance, height, angle) samples along a bearing."""
    out = []
    d = 60.0
    while d < until:
        h = ground.at(*ground.point(bearing, d))
        out.append((d, h, elevation_angle(h, d)))
        d += step
    return out


def skyline(ground):
    first, last, step = BEARINGS
    rows = []
    for i in range(int(round((last - first) / step)) + 1):
        bearing = first + i * step
        samples = ray(ground, bearing)
        d_far, h_far, a_far = max(samples, key=lambda s: s[2])
        # The sea's own horizon where no land rises above it.
        if a_far < 0:
            d_far, h_far, a_far = 0.0, 0.0, elevation_angle(0.0, math.sqrt(2 * EYE * EARTH / (1 - REFRACTION)))
        # The nearer hills: the highest ground within a fixed reach, so the ridge in front stays
        # continuous from bearing to bearing (equal to the skyline where that lies within reach).
        # Ground beyond the reach fades out of it over 600 m, so no ridge ends at a sharp edge.
        near = [(d, h, a - max(0.0, d - NEAR_REACH) * NEAR_FALLOFF) for d, h, a in samples if d < NEAR_REACH + 600]
        d_near, h_near, a_near = max(near, key=lambda s: s[2]) if near else (d_far, h_far, a_far)
        if a_near >= a_far or a_far <= 0:
            d_near, h_near, a_near = d_far, h_far, a_far
        rows.append((bearing, a_far, d_far, h_far, a_near, d_near))
    return rows


def relief(ground):
    """What the bay sees along each bearing and elevation: the ground's slope (its normal's east and
    north components) and its distance, as an RGB image with the highest elevation on top. Rows above
    the skyline repeat the crest, so the shader's filtering never mixes the sky into the slopes."""
    image = np.zeros((RELIEF_ROWS, RELIEF_BEARINGS, 3), dtype=np.uint8)
    for b in range(RELIEF_BEARINGS):
        bearing = b * RELIEF_BEARING_STEP
        samples = ray(ground, bearing, step=8.0)
        filled = None
        for j in range(RELIEF_ROWS):
            elevation = RELIEF_LOW + j * RELIEF_STEP
            hit = next((s for s in samples if s[2] >= elevation), None)
            if hit is None:
                break
            d, h, _ = hit
            lat, lon = ground.point(bearing, d)
            # The slope over about 40 m, from the ground's gradient.
            step_lon = 20.0 / (111320.0 * ground.cos)
            step_lat = 20.0 / 110574.0
            gx = (ground.at(lat, lon + step_lon) - ground.at(lat, lon - step_lon)) / 40.0
            gy = (ground.at(lat + step_lat, lon) - ground.at(lat - step_lat, lon)) / 40.0
            n = np.array([-gx, -gy, 1.0])
            n /= np.linalg.norm(n)
            filled = (round((n[0] * 0.5 + 0.5) * 255), round((n[1] * 0.5 + 0.5) * 255), max(1, min(255, round(d / 1000 / RELIEF_KM * 255))))
            image[RELIEF_ROWS - 1 - j, b] = filled
        if filled is not None:
            for j in range(RELIEF_ROWS):
                if image[RELIEF_ROWS - 1 - j, b, 2] == 0:
                    image[RELIEF_ROWS - 1 - j, b] = filled
    # A small angular filter keeps source-raster noise from striping the hills without averaging
    # across the old nine degrees of distance, which erased the canyon's relief.
    slopes = image[..., :2].astype(np.float64)
    padded = np.pad(slopes, ((1, 1), (1, 1), (0, 0)), mode="edge")
    image[..., :2] = np.round(sum(padded[dy : dy + RELIEF_ROWS, dx : dx + RELIEF_BEARINGS] for dy in range(3) for dx in range(3)) / 9).astype(np.uint8)
    distance = np.pad(image[..., 2].astype(np.float64), ((0, 0), (1, 1)), mode="edge")
    image[..., 2] = np.round(sum(distance[:, dx : dx + RELIEF_BEARINGS] for dx in range(3)) / 3).astype(np.uint8)
    return image


def visible_houses(ground, buildings):
    """Houses seen from the bay on the slopes behind the shore, each with its window height."""
    lo, hi = LIGHT_BEARINGS
    seen = []
    for building in buildings:
        lat, lon = building["lat"], building["lon"]
        bearing, distance = place(lat, lon)
        if not (lo <= bearing <= hi) or distance < 450 or distance > 7000:
            continue
        h = ground.at(lat, lon)
        window = elevation_angle(h + building["height"] * 0.55, distance)
        if window < 0.3:
            continue  # on the flat shore: the frieze's own coast stands there
        hidden = False
        d = 80.0
        while d < distance - 40:
            if elevation_angle(ground.at(*ground.point(bearing, d)), d) > window - 0.015:
                hidden = True
                break
            d += 15.0
        if not hidden:
            seen.append((bearing, window, distance, h, building))
    return seen


def main():
    ground = Ground(load_ground())
    osm, buildings = load_buildings()
    profile = skyline(ground)
    view = relief(ground)
    Image.fromarray(view, "RGB").save(RELIEF, optimize=True)
    houses = visible_houses(ground, buildings)
    rng = random.Random(20261024)
    lights = sorted(rng.sample(houses, min(MAX_LIGHTS, len(houses))), key=lambda r: (r[0], r[1]))
    peak = max(profile, key=lambda r: r[1])
    print(f"Skyline: {len(profile)} bearings; highest {peak[1]:.2f} deg at {peak[0]:.1f} deg, {peak[2] / 1000:.2f} km, {peak[3]:.0f} m")
    print(f"Houses: {len(buildings)} footprints, {len(houses)} facing the bay, {len(lights)} kept as lights")

    first, last, step = BEARINGS
    far = [round(r[1] * 100) for r in profile]
    near = [round(r[4] * 100) for r in profile]
    # Distances and heights set the haze and the evening shadow line. Where the skyline passes from
    # one ridge to another they jump, so they are averaged over five degrees, then kept every
    # second bearing (one degree apart).
    def smoothed(values, half=5):
        return [sum(values[max(0, i - half) : i + half + 1]) / len(values[max(0, i - half) : i + half + 1]) for i in range(len(values))]

    far_km = [round(v / 100) for v in smoothed([r[2] for r in profile])[::2]]
    near_km = [round(v / 100) for v in smoothed([r[5] for r in profile])[::2]]
    crest = [round(v) for v in smoothed([r[3] for r in profile])[::2]]
    flat, footprints, previous = [], [], 0
    for bearing, angle, distance, _h, building in lights:
        b = round(bearing * 100)
        flat += [b - previous, round(angle * 100)]
        previous = b
        footprints += [round(building["width"] * 10), round(building["depth"] * 10), round(building["height"] * 10), round(distance / 10), int(building["tagged_height"]), building["roof"]]
    js = f"""// Generated by bin/coastal_skyline.py; do not edit. The hills and houses behind the footer
// coast, as seen from a boat in La Jolla Bay ({VIEW[0]} N, {-VIEW[1]} W, eye {EYE:g} m).
// Ground: USGS 3D Elevation Program (3DEP), U.S. Geological Survey, public domain.
// Houses: derived from OpenStreetMap building footprints, (c) OpenStreetMap contributors, available
// under the Open Database License 1.0 (https://www.openstreetmap.org/copyright).
// Bearings run from {first:g} to {last:g} degrees east of north in steps of {step:g}: the skyline's
// elevation angle and that of the nearer hills within {NEAR_REACH / 1000:g} km (hundredths of a degree).
// Every second bearing (one degree apart), averaged over five degrees: their distances (hundreds of
// metres) and the skyline ground's height (metres). Lights: houses whose windows face the bay, sorted by bearing, as the step
// in bearing from the previous house and the window's elevation angle (hundredths of a degree).
export const SKYLINE = Object.freeze({{
  view: [{VIEW[0]}, {VIEW[1]}],
  bearings: [{first:g}, {last:g}, {step:g}],
  far: {json.dumps(far, separators=(',', ':'))},
  farDistance: {json.dumps(far_km, separators=(',', ':'))},
  crest: {json.dumps(crest, separators=(',', ':'))},
  near: {json.dumps(near, separators=(',', ':'))},
  nearDistance: {json.dumps(near_km, separators=(',', ':'))},
  lights: {json.dumps(flat, separators=(',', ':'))},
  // Per selected building: footprint width/depth and height (dm), distance (10 m), tagged-height
  // flag, roof form. Untagged heights assume 6 m; widths/depths come from the actual OSM polygons.
  footprints: {json.dumps(footprints, separators=(',', ':'))},
}});
"""
    OUT.write_text(js, encoding="utf8", newline="\n")
    PROVENANCE.parent.mkdir(parents=True, exist_ok=True)
    PROVENANCE.write_text(
        json.dumps(
            {
                "ground": {
                    "source": "USGS 3D Elevation Program (3DEP), The National Map, 3DEPElevation ImageServer",
                    "license": "U.S. Geological Survey data, public domain",
                    "request": DEM_URL,
                    "bounds_west_south_east_north": DEM_BOUNDS,
                    "pixels": DEM_SIZE,
                    "raw_sha256": hashlib.sha256((CACHE / "3dep.tif").read_bytes()).hexdigest(),
                    "relief_bearing_step_deg": RELIEF_BEARING_STEP,
                    "relief_elevation_step_deg": RELIEF_STEP,
                    "relief_pixels": [RELIEF_BEARINGS, RELIEF_ROWS],
                },
                "houses": {
                    "source": "OpenStreetMap contributors",
                    "license": "ODbL 1.0",
                    "attribution": "https://www.openstreetmap.org/copyright",
                    "endpoint": OSM_ENDPOINT,
                    "read_method": osm.get("source"),
                    "snapshot_boundary": "sequential tile reads, not an atomic snapshot",
                    "normalized_sha256": hashlib.sha256(gzip.decompress((CACHE / "osm-footprints.json.gz").read_bytes())).hexdigest(),
                    "requests": osm.get("requests", []),
                    "footprints": len(buildings),
                    "facing_the_bay": len(houses),
                    "lights": len(lights),
                    "selected_with_height_tags": sum(int(r[4]["tagged_height"]) for r in lights),
                    "untagged_height_assumption_m": 6.0,
                },
                "view": {"latitude": VIEW[0], "longitude": VIEW[1], "eye_m": EYE, "refraction": REFRACTION},
                "skyline_peak": {"bearing": peak[0], "angle_deg": round(peak[1], 3), "distance_km": round(peak[2] / 1000, 2), "height_m": round(peak[3])},
            },
            indent=2,
        )
        + "\n",
        encoding="utf8",
        newline="\n",
    )
    # Format the generated files as the repository's Prettier check expects (best effort).
    import shutil
    import subprocess

    npx = shutil.which("npx.cmd") or shutil.which("npx")
    if npx:
        subprocess.run([npx, "prettier", "--write", str(OUT), str(PROVENANCE)], cwd=ROOT, check=False, capture_output=True)
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes) and {PROVENANCE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
