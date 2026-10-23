"""Refresh source-bound JPL Horizons validation fixtures, never runtime network data."""
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
references = []
for date in ("2026-01-22", "2026-04-22", "2026-07-22", "2026-10-22"):
    for name, number in (("Mercury", 199), ("Venus", 299), ("Mars", 499), ("Jupiter", 599), ("Saturn", 699)):
        params = {"format": "json", "COMMAND": str(number), "CENTER": "500@399", "MAKE_EPHEM": "YES", "EPHEM_TYPE": "OBSERVER", "START_TIME": date + " 04:30", "STOP_TIME": date + " 04:31", "STEP_SIZE": "1 m", "QUANTITIES": "1,9", "CSV_FORMAT": "YES", "ANG_FORMAT": "DEG"}
        url = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urllib.parse.urlencode({key: "'" + value + "'" if key != "format" else value for key, value in params.items()})
        result = json.load(urllib.request.urlopen(url, timeout=60))["result"]
        row = result.split("$$SOE")[1].splitlines()[1].split(",")
        references.append({"utc": date + "T04:30:00Z", "name": name, "ra": float(row[3]), "dec": float(row[4]), "magnitude": float(row[5]), "url": url})
        print(name, date, row[3:6], flush=True)
path = ROOT / "test/fixtures/planet-horizons.json"
path.parent.mkdir(exist_ok=True)
path.write_text(json.dumps({"source": "JPL Horizons DE441 astrometric ICRF, geocenter; retrieved 2026-10-23", "references": references}, indent=2) + "\n")
