#!/usr/bin/env python3
"""Build a small weather snapshot and seasonal scene sequence; stdlib, offline by default."""

import argparse
import calendar
from collections import defaultdict
from datetime import date, datetime, timedelta
import gzip
import hashlib
import json
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "artwork/coastal-home/weather-2026-10-24"
SOURCES = REVIEW / "source"
OUTPUT = ROOT / "assets/js/home-scene/weather-data.mjs"
STATION = "USW00023188"
WET_TENTHS_MM = 3  # >= 0.3 mm; GHCN's 0.1 mm precision cannot represent 0.254 mm.
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
URLS = {
    f"{STATION}.dly.gz": f"https://www.ncei.noaa.gov/pub/data/ghcn/daily/all/{STATION}.dly",
    "US1CASD0030.dly.gz": "https://www.ncei.noaa.gov/pub/data/ghcn/daily/all/US1CASD0030.dly",
    "ghcn-readme.txt.gz": "https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt",
    "ghcnd-version.txt.gz": "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-version.txt",
    "points.json.gz": "https://api.weather.gov/points/32.8328,-117.2713",
    "forecast-hourly.json.gz": "https://api.weather.gov/gridpoints/SGX/53,20/forecast/hourly",
}


def refresh():
    SOURCES.mkdir(parents=True, exist_ok=True)
    for name, url in URLS.items():
        request = urllib.request.Request(url, headers={"User-Agent": "Sirui-Coastal-Home-Offline-Weather/1.0 (dylantao.github.io)"})
        with urllib.request.urlopen(request, timeout=45) as response:
            data = response.read()
        (SOURCES / name).write_bytes(gzip.compress(data, mtime=0) if name.endswith(".gz") else data)


def read_precip(path):
    """Accept single-day PRCP with no quality flag; missing and multiday totals stay absent."""
    records = {}
    skipped = defaultdict(int)
    for line in gzip.decompress(path.read_bytes()).decode("ascii").splitlines():
        if line[17:21] != "PRCP":
            continue
        year, month = int(line[11:15]), int(line[15:17])
        for day in range(1, calendar.monthrange(year, month)[1] + 1):
            offset = 21 + 8 * (day - 1)
            value, quality = int(line[offset : offset + 5]), line[offset + 6]
            key = date(year, month, day)
            if value < 0 or quality != " ":
                skipped[year] += 1
            else:
                records[key] = value
    return records, dict(skipped)


def fit(records, first, last):
    monthly = [[0, 0] for _ in range(12)]
    transitions = [[[0, 0], [0, 0]] for _ in range(12)]
    amounts = [[] for _ in range(12)]
    for day, amount in sorted(records.items()):
        if not first <= day.year <= last:
            continue
        month, wet = day.month - 1, int(amount >= WET_TENTHS_MM)
        monthly[month][wet] += 1
        if wet:
            amounts[month].append(amount / 10)
        previous = records.get(day - timedelta(days=1))
        # A pair may not cross into the held-out period or bridge a missing observation.
        if previous is not None and (day - timedelta(days=1)).year >= first:
            transitions[month][int(previous >= WET_TENTHS_MM)][wet] += 1
    climatology = [wet / (dry + wet) for dry, wet in monthly]
    # Beta prior strength 12 days centered on month climatology. Fixed before holdout scoring.
    probabilities = [[(wet + 12 * climatology[m]) / (dry + wet + 12) for dry, wet in states] for m, states in enumerate(transitions)]
    quantiles = []
    for values in amounts:
        values.sort()
        quantiles.append([values[round((len(values) - 1) * p)] for p in [0.1, 0.3, 0.5, 0.7, 0.9]])
    return {"climatology": climatology, "transition": probabilities, "quantilesMm": quantiles, "counts": monthly, "pairs": transitions}


def validate(records, model):
    sums = defaultdict(float)
    count = 0
    yearly = defaultdict(lambda: defaultdict(float))
    for day, amount in sorted(records.items()):
        previous = records.get(day - timedelta(days=1))
        if not 2016 <= day.year <= 2025 or previous is None:
            continue
        target, prior = int(amount >= WET_TENTHS_MM), int(previous >= WET_TENTHS_MM)
        probabilities = {"monthly_climatology": model["climatology"][day.month - 1], "seasonal_markov": model["transition"][day.month - 1][prior], "persistence": prior, "always_dry": 0}
        for name, probability in probabilities.items():
            loss = (probability - target) ** 2
            sums[name] += loss
            yearly[day.year][name] += loss
        yearly[day.year]["days"] += 1
        count += 1
    brier = {name: round(value / count, 8) for name, value in sums.items()}
    return {"train": [1991, 2015], "heldOut": [2016, 2025], "days": count, "brier": brier, "skillVsClimatology": round(1 - brier["seasonal_markov"] / brier["monthly_climatology"], 5), "yearly": {str(y): {k: round(v / values["days"], 8) if k != "days" else int(v) for k, v in values.items()} for y, values in yearly.items()}}


def date_hash(text, salt):
    # Same unsigned FNV/avalanche construction as the pure browser sampler.
    h = 2166136261 ^ salt
    for char in text:
        h = ((h ^ ord(char)) * 16777619) & 0xFFFFFFFF
    h ^= h >> 15
    h = (h * 2246822519) & 0xFFFFFFFF
    h ^= h >> 13
    return h / 4294967296


def sequence(model):
    start, end = date(2000, 1, 1), date(2099, 12, 31)
    flags, wet, day = [], 0, start
    while day <= end:
        wet = int(date_hash(day.isoformat(), 317) < model["transition"][day.month - 1][wet])
        flags.append(wet)
        day += timedelta(days=1)
    encoded = "".join(ALPHABET[sum(bit << j for j, bit in enumerate(flags[i : i + 6]))] for i in range(0, len(flags), 6))
    return {"start": start.isoformat(), "end": end.isoformat(), "wetBits": encoded, "wetDays": sum(flags), "days": len(flags)}


def cloud_cover(description):
    text = description.lower()
    if "mostly cloudy" in text or "considerable cloud" in text:
        return 0.8
    if "partly" in text:
        return 0.45
    if "mostly sunny" in text or "mostly clear" in text:
        return 0.2
    if any(word in text for word in ["cloudy", "overcast", "rain", "showers", "drizzle", "fog"]):
        return 0.95
    return 0.04


def forecast():
    source = json.loads(gzip.decompress((SOURCES / "forecast-hourly.json.gz").read_bytes()))
    properties = source["properties"]
    days = defaultdict(list)
    for period in properties["periods"]:
        start, end = datetime.fromisoformat(period["startTime"]), datetime.fromisoformat(period["endTime"])
        # NWS supplies Pacific ISO offsets. Retain UTC epoch as well so repeated DST hours have custody.
        chance = period.get("probabilityOfPrecipitation", {}).get("value")
        chance = max(0, min(100, chance or 0)) / 100
        text = period["shortForecast"].lower()
        rain = bool(re.search(r"rain|shower|drizzle|thunder", text))
        # Probability is not rainfall rate. The bounded visual amplitude is an authored interpretation.
        amplitude = (0.55 if "heavy" in text else 0.28) if rain and chance >= 0.3 else 0
        local_minute = start.hour * 60 + start.minute
        duration_minutes = (end.timestamp() - start.timestamp()) / 60
        days[start.date().isoformat()].append([local_minute, min(1440, local_minute + duration_minutes), round(cloud_cover(text), 3), round(chance, 3), round(amplitude, 3), int(start.timestamp())])
    first = properties["periods"][0]["startTime"]
    last = properties["periods"][-1]["endTime"]
    return {"source": "NWS SGX/53,20 hourly", "issued": properties["updateTime"], "generated": properties["generatedAt"], "validFrom": first, "validThrough": last, "days": dict(days)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="explicitly download current NOAA/NWS source files; otherwise rebuild retained bytes offline")
    args = parser.parse_args()
    if args.refresh:
        refresh()
    records, skipped = read_precip(SOURCES / f"{STATION}.dly.gz")
    evaluation = validate(records, fit(records, 1991, 2015))
    if evaluation["skillVsClimatology"] <= 0:
        raise SystemExit("The candidate did not beat monthly climatology on the held-out period; review before shipping.")
    fitted = fit(records, 1991, 2025)
    generated = sequence(fitted)
    snapshot = forecast()
    runtime = {"version": 1, "station": STATION, "fitYears": [1991, 2025], "wetThresholdMm": 0.3, "monthlyChance": fitted["climatology"], "transition": fitted["transition"], "amountQuantilesMm": fitted["quantilesMm"], "sequence": {k: v for k, v in generated.items() if k not in ["wetDays", "days"]}, "forecast": snapshot}
    header = "// Generated offline by bin/build_coastal_weather.py; see artwork/coastal-home/weather-2026-10-24.\n// NWS snapshot expires to a seasonal scene simulation, never a stale live forecast.\n// prettier-ignore\n"
    OUTPUT.write_text(header + "export const COASTAL_WEATHER_DATA = " + json.dumps(runtime, separators=(",", ":"), ensure_ascii=True) + ";\n", encoding="utf-8", newline="\n")
    receipts = []
    for name, url in URLS.items():
        path = SOURCES / name
        data = gzip.decompress(path.read_bytes()) if name.endswith(".gz") else path.read_bytes()
        receipts.append({"file": f"source/{name}", "url": url, "decodedBytes": len(data), "decodedSha256": hashlib.sha256(data).hexdigest()})
    local, local_skipped = read_precip(SOURCES / "US1CASD0030.dly.gz")
    receipt = {"schema": 1, "sources": receipts, "station": {"id": STATION, "name": "San Diego Lindbergh Field", "lat": 32.7336, "lon": -117.1831, "limitation": "Nearby coastal regional proxy, not the house microclimate; gauge-day totals do not establish within-day rain timing."}, "coverage": {"1991_2025AcceptedDays": sum(1991 <= d.year <= 2025 for d in records), "1991_2025ExpectedDays": (date(2026, 1, 1) - date(1991, 1, 1)).days, "rejectedOrMissingByYear": {str(y): n for y, n in skipped.items() if 1991 <= y <= 2025}, "localComparison": {"id": "US1CASD0030", "accepted2010_2025": sum(2010 <= d.year <= 2025 for d in local), "expected2010_2025": (date(2026, 1, 1) - date(2010, 1, 1)).days, "rejectedOrMissingByYear": {str(y): n for y, n in local_skipped.items() if 2010 <= y <= 2025}}}, "validation": evaluation, "productionRefitYears": [1991, 2025], "monthlyCounts": fitted["counts"], "monthlyTransitionCounts": fitted["pairs"], "precomputedSequence": {k: v for k, v in generated.items() if k != "wetBits"}, "forecast": {k: v for k, v in snapshot.items() if k != "days"}, "runtimeBytes": OUTPUT.stat().st_size, "runtimeCanonicalLfSha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest()}
    (REVIEW / "build-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"validation": evaluation["brier"], "skill": evaluation["skillVsClimatology"], "runtimeBytes": OUTPUT.stat().st_size, "forecastValidThrough": snapshot["validThrough"]}, indent=2))


if __name__ == "__main__":
    main()
