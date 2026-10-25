#!/usr/bin/env python3
"""Build the coastal scene's weather from retained NOAA/NWS bytes; standard library only.

With no option this is an offline, deterministic rebuild of assets/js/home-scene/weather-data.mjs
and the build receipt from the bytes under artwork/coastal-home/weather-2026-10-24/source.

  --refresh-forecast  the daily path: fetch, validate and adopt a newer NWS hourly forecast. Any fetch
                      or validation failure keeps the last valid snapshot: exit 75 when the failure is
                      transient (try again tomorrow), exit 1 when the response no longer validates.
  --dry-run           with --refresh-forecast: fetch and validate, report, and write nothing.
  --refresh           a deliberate refresh of every source, including the station records and ONI.
  --evaluate          rerun the model comparison on the fixed chronological split.
  --check             rebuild in memory and fail if the committed outputs differ.
"""

import argparse
import calendar
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
import functools
import gzip
import hashlib
from itertools import repeat
import json
import math
from operator import add, mul
import os
from pathlib import Path
import random
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
STATION = "USW00023188"
LOCAL_STATION = "US1CASD0030"
WET_TENTHS_MM = 3  # >= 0.3 mm. US gauges report 0.01 in, which GHCN stores as 3 tenths of a millimetre.
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
USER_AGENT = "Sirui-Coastal-Home-Weather/2.0 (+https://dylantao.github.io; https://github.com/DylanTao/dylantao.github.io)"
POINTS_URL = "https://api.weather.gov/points/32.8328,-117.2713"
HOURLY_URL = "https://api.weather.gov/gridpoints/SGX/53,20/forecast/hourly"
GRID = ("SGX", 53, 20)
MODEL_URLS = {
    f"{STATION}.dly.gz": f"https://www.ncei.noaa.gov/pub/data/ghcn/daily/all/{STATION}.dly",
    f"{LOCAL_STATION}.dly.gz": f"https://www.ncei.noaa.gov/pub/data/ghcn/daily/all/{LOCAL_STATION}.dly",
    "ghcn-readme.txt.gz": "https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt",
    "ghcnd-version.txt.gz": "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-version.txt",
    "oni.ascii.txt.gz": "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt",
}
FORECAST_URLS = {"points.json.gz": POINTS_URL, "forecast-hourly.json.gz": HOURLY_URL}
URLS = {**MODEL_URLS, **FORECAST_URLS}
EXIT_DEFERRED = 75
SPLIT = {"train": (1991, 2015), "heldOut": (2016, 2025), "production": (1991, 2025)}
FOLDS = [(1991, 1995), (1996, 2000), (2001, 2005), (2006, 2010), (2011, 2015)]
LAMBDAS = [0.0, 1.0, 3.0, 10.0, 30.0]
SEQUENCE = (date(2000, 1, 1), date(2099, 12, 31))
AMOUNT_LEVELS = 20  # midpoint quantiles (i + 0.5) / 20 of each month's wet-day amounts
DRY_SPELL_CAP = 31

HARMONICS = ["s1", "c1", "s2", "c2", "s3", "c3"]
PERSISTENCE = ["w1", "w1*s1", "w1*c1"]
# Chosen by five-fold blocked cross-validation inside 1991-2015 before any held-out comparison with
# the previous model: --evaluate reruns that selection and reports whether it still picks this.
PRODUCTION = {
    "id": "second-order-amount-dry-spell",
    "features": ["1", *HARMONICS, *PERSISTENCE, "w2", "w1*w2", "a1", "dsl"],
    "lambda": 10.0,
}
CANDIDATES = [
    ("harmonic-climatology", ["1", *HARMONICS]),
    ("first-order", ["1", *HARMONICS, *PERSISTENCE]),
    ("second-order", ["1", *HARMONICS, *PERSISTENCE, "w2", "w1*w2"]),
    ("second-order-amount", ["1", *HARMONICS, *PERSISTENCE, "w2", "w1*w2", "a1"]),
    (PRODUCTION["id"], PRODUCTION["features"]),
    ("second-order-amount-wet-30-days", ["1", *HARMONICS, *PERSISTENCE, "w2", "w1*w2", "a1", "n30"]),
    ("second-order-amount-rain-30-days", ["1", *HARMONICS, *PERSISTENCE, "w2", "w1*w2", "a1", "l30"]),
    ("third-order-amount", ["1", *HARMONICS, *PERSISTENCE, "w2", "w1*w2", "w3", "a1"]),
    ("second-order-amount-enso", ["1", *HARMONICS, *PERSISTENCE, "w2", "w1*w2", "a1", "oni", "oni*s1", "oni*c1"]),
    ("production-plus-enso", [*PRODUCTION["features"], "oni", "oni*s1", "oni*c1"]),
]
RELIABILITY_BINS = [0, 0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0]
SEASONS = ["DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"]


class Deferred(Exception):
    """A transient failure. Keep the last valid snapshot; the next run tries again."""


class Rejected(Exception):
    """The response no longer validates. Keep the last valid snapshot; a person should look."""


@dataclass(frozen=True)
class Layout:
    root: Path = ROOT

    @property
    def review(self):
        return self.root / "artwork/coastal-home/weather-2026-10-24"

    @property
    def sources(self):
        return self.review / "source"

    @property
    def retrieval(self):
        return self.sources / "retrieval.json"

    @property
    def receipt(self):
        return self.review / "build-receipt.json"

    @property
    def evaluation(self):
        return self.review / "model-evaluation.json"

    @property
    def output(self):
        return self.root / "assets/js/home-scene/weather-data.mjs"


# ---------------------------------------------------------------- formatting and atomic writes


def number_text(value):
    """A JSON number as Prettier prints it: 5.3e-05 becomes 5.3e-5, while 1.0 stays 1.0."""
    text = json.dumps(value, allow_nan=False).lower()
    text = re.sub(r"^([+-]?[\d.]+e)(?:\+|(-))?0*(\d)", lambda m: m.group(1) + (m.group(2) or "") + m.group(3), text)
    text = re.sub(r"^([+-]?[\d.]+)e[+-]?0+$", r"\1", text)
    text = re.sub(r"(\.\d+?)0+(?=e|$)", r"\1", text)
    return re.sub(r"\.(?=e|$)", "", text)


def scalar_text(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return number_text(value)
    return json.dumps(value, allow_nan=False)


def pretty_json(value, indent=0, key_width=0, trailing=0):
    """JSON laid out as Prettier 3 prints it (printWidth 150), so generated files pass `prettier --check`."""
    pad = " " * indent
    if isinstance(value, dict):
        if not value:
            return "{}"
        items = list(value.items())
        lines = []
        for index, (key, item) in enumerate(items):
            label = json.dumps(key) + ": "
            comma = "," if index < len(items) - 1 else ""
            lines.append(pad + "  " + label + pretty_json(item, indent + 2, len(label), len(comma)) + comma)
        return "{\n" + "\n".join(lines) + "\n" + pad + "}"
    if isinstance(value, list):
        if not value:
            return "[]"
        nested = len(value) > 1 and (
            all(isinstance(item, list) and len(item) > 1 for item in value) or all(isinstance(item, dict) and len(item) > 1 for item in value)
        )
        if not nested and not any(isinstance(item, (dict, list)) for item in value):
            flat = "[" + ", ".join(scalar_text(item) for item in value) + "]"
            if indent + key_width + len(flat) + trailing <= 150:
                return flat
            if all(isinstance(item, (int, float)) and not isinstance(item, bool) for item in value):
                raise ValueError("Prettier fills long number arrays; store this value as an object or shorter rows")
        lines = []
        for index, item in enumerate(value):
            comma = "," if index < len(value) - 1 else ""
            lines.append(pad + "  " + pretty_json(item, indent + 2, 0, len(comma)) + comma)
        return "[\n" + "\n".join(lines) + "\n" + pad + "]"
    return scalar_text(value)


def write_atomically(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp", delete=False)
    try:
        with handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(handle.name, path)
    finally:
        if os.path.exists(handle.name):
            os.unlink(handle.name)


def canonical(data):
    return data.replace(b"\r\n", b"\n")


# ---------------------------------------------------------------- fetching


def http_get(url, timeout=45):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/geo+json, text/plain;q=0.9, */*;q=0.1"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read(), {"httpDate": response.headers.get("Date"), "lastModified": response.headers.get("Last-Modified")}


def fetch(url, get=http_get, attempts=3, pauses=(5, 20), sleep=time.sleep):
    """Bytes and response dates. Server errors and timeouts retry, then defer; other HTTP errors reject."""
    failure = None
    for attempt in range(attempts):
        try:
            return get(url)
        except urllib.error.HTTPError as error:
            if error.code < 500 and error.code not in (408, 429):
                raise Rejected(f"{url} answered HTTP {error.code}") from error
            failure = error
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as error:
            failure = error
        if attempt + 1 < attempts:
            sleep(pauses[min(attempt, len(pauses) - 1)])
    raise Deferred(f"{url} was unavailable after {attempts} attempts ({failure})")


# ---------------------------------------------------------------- station and ENSO records


def read_precip(raw):
    """Accept single-day PRCP with no quality flag; missing values and multiday totals stay absent."""
    records = {}
    skipped = defaultdict(int)
    for line in raw.decode("ascii").splitlines():
        if line[17:21] != "PRCP":
            continue
        year, month = int(line[11:15]), int(line[15:17])
        for day in range(1, calendar.monthrange(year, month)[1] + 1):
            offset = 21 + 8 * (day - 1)
            value, quality = int(line[offset : offset + 5]), line[offset + 6]
            if value < 0 or quality != " ":
                skipped[year] += 1
            else:
                records[date(year, month, day)] = value
    return records, dict(skipped)


def read_oni(raw):
    """CPC's Oceanic Nino Index: (year, centre month) -> anomaly. DJF 1950 is centred on January 1950."""
    table = {}
    for line in raw.decode("ascii").splitlines()[1:]:
        parts = line.split()
        if len(parts) == 4 and parts[0] in SEASONS:
            table[(int(parts[1]), SEASONS.index(parts[0]) + 1)] = float(parts[3])
    return table


def oni_known_before(table, day):
    """The latest season already published when `day`'s month begins: the one ending two months earlier."""
    index = day.year * 12 + day.month - 1 - 3
    return table.get((index // 12, index % 12 + 1))


# ---------------------------------------------------------------- the wet-day model


def phase(day):
    return 2 * math.pi * (day - date(day.year, 1, 1)).days / 365.25


def state_values(day, w1, w2, a1, since, extra=None):
    """Feature values for `day` from the previous days. `since` counts days back to the last wet day."""
    ph = phase(day)
    values = {"1": 1.0, "w1": w1, "w2": w2, "a1": a1, "dsl": math.log(since)}
    for k in (1, 2, 3):
        values[f"s{k}"] = math.sin(k * ph)
        values[f"c{k}"] = math.cos(k * ph)
    if extra:
        values.update(extra)
    return values


def vector(names, values):
    out = []
    for name in names:
        value = 1.0
        for part in name.split("*"):
            value *= values[part]
        out.append(value)
    return out


def logistic(coefficients, row):
    eta = 0.0
    for coefficient, value in zip(coefficients, row):
        eta += coefficient * value
    return 1.0 / (1.0 + math.exp(-eta))


def observed_rows(records, oni=None):
    """One row per accepted day whose previous 30 days are all accepted; lags only look backward."""
    rows = []
    for day in sorted(records):
        if not SPLIT["production"][0] <= day.year <= SPLIT["production"][1]:
            continue
        history = [records.get(day - timedelta(days=k)) for k in range(1, 31)]
        if any(value is None for value in history):
            continue
        wet = [value >= WET_TENTHS_MM for value in history]
        since = next((k + 1 for k, flag in enumerate(wet) if flag), DRY_SPELL_CAP)
        extra = {
            "w3": float(wet[2]),
            "n30": float(sum(wet)),
            "l30": math.log1p(sum(history) / 10),
        }
        if oni is not None:
            extra["oni"] = oni_known_before(oni, day)
        values = state_values(day, float(wet[0]), float(wet[1]), math.log1p(history[0] / 10) if wet[0] else 0.0, since, extra)
        rows.append({"day": day, "wet": int(records[day] >= WET_TENTHS_MM), "amount": records[day] / 10, "values": values})
    return rows


def solve(matrix, rhs):
    size = len(rhs)
    a = [row[:] + [value] for row, value in zip(matrix, rhs)]
    for column in range(size):
        pivot = max(range(column, size), key=lambda r: abs(a[r][column]))
        a[column], a[pivot] = a[pivot], a[column]
        for r in range(column + 1, size):
            factor = a[r][column] / a[column][column]
            if factor:
                for c in range(column, size + 1):
                    a[r][c] -= factor * a[column][c]
    out = [0.0] * size
    for r in range(size - 1, -1, -1):
        out[r] = (a[r][size] - sum(a[r][c] * out[c] for c in range(r + 1, size))) / a[r][r]
    return out


def fit_logistic(columns, target, lam, iterations=60):
    """Ridge-penalized logistic regression by Newton's method; columns[0] is the unpenalized intercept."""
    k, n = len(columns), len(target)
    beta = [0.0] * k
    for _ in range(iterations):
        eta = [0.0] * n
        for coefficient, column in zip(beta, columns):
            eta = list(map(add, eta, map(mul, column, repeat(coefficient))))
        p = [1.0 / (1.0 + math.exp(-value)) for value in eta]
        weight = [q * (1.0 - q) for q in p]
        residual = list(map(lambda t, q: t - q, target, p))
        gradient = [math.fsum(map(mul, column, residual)) - (lam * b if i else 0.0) for i, (column, b) in enumerate(zip(columns, beta))]
        weighted = [list(map(mul, weight, column)) for column in columns]
        hessian = [[0.0] * k for _ in range(k)]
        for i in range(k):
            for j in range(i, k):
                hessian[i][j] = hessian[j][i] = math.fsum(map(mul, weighted[i], columns[j]))
            if i:
                hessian[i][i] += lam
        step = solve(hessian, gradient)
        beta = [b + s for b, s in zip(beta, step)]
        if max(map(abs, step)) < 1e-11:
            break
    return beta


def fit_model(rows, names, lam, years):
    chosen = [row for row in rows if years[0] <= row["day"].year <= years[1]]
    columns = [[vector([name], row["values"])[0] for row in chosen] for name in names]
    # Ten significant digits make the published model independent of platform floating-point libraries.
    return [float(f"{value:.10g}") for value in fit_logistic(columns, [float(row["wet"]) for row in chosen], lam)]


def predict(rows, names, coefficients):
    return [logistic(coefficients, vector(names, row["values"])) for row in rows]


def fit_markov(records, first, last):
    """The 2026-10-24 production model: monthly first-order transitions with a 12-day Beta prior."""
    monthly = [[0, 0] for _ in range(12)]
    transitions = [[[0, 0], [0, 0]] for _ in range(12)]
    for day, amount in sorted(records.items()):
        if not first <= day.year <= last:
            continue
        month, wet = day.month - 1, int(amount >= WET_TENTHS_MM)
        monthly[month][wet] += 1
        previous = records.get(day - timedelta(days=1))
        if previous is not None and (day - timedelta(days=1)).year >= first:
            transitions[month][int(previous >= WET_TENTHS_MM)][wet] += 1
    climatology = [wet / (dry + wet) for dry, wet in monthly]
    probabilities = [[(wet + 12 * climatology[m]) / (dry + wet + 12) for dry, wet in states] for m, states in enumerate(transitions)]
    return {"climatology": climatology, "transition": probabilities, "counts": monthly, "pairs": transitions}


def amount_table(records, first, last, levels):
    by_month = [[] for _ in range(12)]
    for day, amount in records.items():
        if first <= day.year <= last and amount >= WET_TENTHS_MM:
            by_month[day.month - 1].append(amount / 10)
    table = []
    for values in by_month:
        values.sort()
        table.append([values[round((len(values) - 1) * level)] for level in levels])
    return table


def date_hash(text, salt):
    # Same unsigned FNV/avalanche construction as the pure browser sampler.
    h = 2166136261 ^ salt
    for char in text:
        h = ((h ^ ord(char)) * 16777619) & 0xFFFFFFFF
    h ^= h >> 15
    h = (h * 2246822519) & 0xFFFFFFFF
    h ^= h >> 13
    return h / 4294967296


def simulate(coefficients, names, amounts, start, end):
    """The deterministic scene sequence; coastal-weather.mjs draws each wet day's amount the same way."""
    flags, w1, w2, a1, since, day = [], 0.0, 0.0, 0.0, DRY_SPELL_CAP, start
    while day <= end:
        key = day.isoformat()
        wet = date_hash(key, 317) < logistic(coefficients, vector(names, state_values(day, w1, w2, a1, since)))
        table = amounts[day.month - 1]
        amount = table[min(len(table) - 1, int(date_hash(key, 319) * len(table)))] if wet else 0.0
        flags.append(int(wet))
        w2, w1, a1 = w1, float(wet), math.log1p(amount) if wet else 0.0
        since = 1 if wet else min(since + 1, DRY_SPELL_CAP)
        day += timedelta(days=1)
    return flags


def spell_stats(flags, first_year):
    """Wet-day rate, its year-to-year spread and spell lengths for a run of daily flags from 1 January."""
    spells, run = [], 0
    for flag in [*flags, 0]:
        if flag:
            run += 1
        elif run:
            spells.append(run)
            run = 0
    annual, index, year = [], 0, first_year
    while index < len(flags):
        length = 366 if calendar.isleap(year) else 365
        annual.append(sum(flags[index : index + length]))
        index, year = index + length, year + 1
    return {
        "wetDaysPerYear": round(sum(annual) / len(annual), 2),
        "wetDaysPerYearSd": round(_std(annual), 2),
        "meanWetSpellDays": round(sum(spells) / len(spells), 4),
        "wetSpellsOfThreeOrMoreDays": round(sum(s >= 3 for s in spells) / len(spells), 4),
    }


# ---------------------------------------------------------------- scoring


def brier(p, y):
    return math.fsum((a - b) ** 2 for a, b in zip(p, y)) / len(y)


def log_loss(p, y):
    return -math.fsum(math.log(a) if b else math.log1p(-a) for a, b in zip(p, y)) / len(y)


def reliability(p, y):
    """Binned reliability rows [low, high, days, mean forecast, observed frequency] and Murphy's terms."""
    base = sum(y) / len(y)
    rows, rel, res = [], 0.0, 0.0
    for low, high in zip(RELIABILITY_BINS, RELIABILITY_BINS[1:]):
        chosen = [(a, b) for a, b in zip(p, y) if low <= a < high or (high == 1.0 and a == 1.0)]
        if not chosen:
            continue
        forecast = sum(a for a, _ in chosen) / len(chosen)
        observed = sum(b for _, b in chosen) / len(chosen)
        rows.append([low, high, len(chosen), round(forecast, 4), round(observed, 4)])
        rel += len(chosen) * (forecast - observed) ** 2
        res += len(chosen) * (observed - base) ** 2
    return rows, {"reliability": round(rel / len(y), 8), "resolution": round(res / len(y), 8), "uncertainty": round(base * (1 - base), 8)}


def block_interval(differences, block=30, draws=2000, seed=20261024):
    """95% moving-block bootstrap interval of a mean daily score difference."""
    prefix = [0.0]
    for value in differences:
        prefix.append(prefix[-1] + value)
    sums = [prefix[s + block] - prefix[s] for s in range(len(differences) - block + 1)]
    count = len(differences) // block
    rng = random.Random(seed)
    means = sorted(sum(rng.choice(sums) for _ in range(count)) / (count * block) for _ in range(draws))
    return [round(means[int(0.025 * draws)], 8), round(means[int(0.975 * draws) - 1], 8)], round(_std(means), 8)


def _std(values):
    mean = sum(values) / len(values)
    return math.sqrt(sum((v - mean) ** 2 for v in values) / (len(values) - 1))


def crps(samples, value):
    ordered = sorted(samples)
    m = len(ordered)
    spread = sum((2 * i - m + 1) * s for i, s in enumerate(ordered)) / (m * m)
    return sum(abs(s - value) for s in ordered) / m - spread


def validate(records, rows):
    """Fit on 1991-2015 and score 2016-2025 against the previous model and simple baselines."""
    names, lam = PRODUCTION["features"], PRODUCTION["lambda"]
    coefficients = fit_model(rows, names, lam, SPLIT["train"])
    markov = fit_markov(records, *SPLIT["train"])
    held = [row for row in rows if SPLIT["heldOut"][0] <= row["day"].year <= SPLIT["heldOut"][1]]
    y = [row["wet"] for row in held]
    p = {
        PRODUCTION["id"]: predict(held, names, coefficients),
        "previous_monthly_markov": [markov["transition"][row["day"].month - 1][int(row["values"]["w1"])] for row in held],
        "monthly_climatology": [markov["climatology"][row["day"].month - 1] for row in held],
        "persistence": [row["values"]["w1"] for row in held],
        "always_dry": [0.0 for _ in held],
    }
    scores = {name: round(brier(values, y), 8) for name, values in p.items()}
    losses = {name: round(log_loss(p[name], y), 6) for name in [PRODUCTION["id"], "previous_monthly_markov", "monthly_climatology"]}
    yearly = {}
    for year in range(SPLIT["heldOut"][0], SPLIT["heldOut"][1] + 1):
        index = [i for i, row in enumerate(held) if row["day"].year == year]
        yearly[str(year)] = {name: round(brier([p[name][i] for i in index], [y[i] for i in index]), 8) for name in [PRODUCTION["id"], "previous_monthly_markov", "monthly_climatology"]}
        yearly[str(year)]["days"] = len(index)
    differences = [(a - b) ** 2 - (c - b) ** 2 for a, b, c in zip(p[PRODUCTION["id"]], y, p["previous_monthly_markov"])]
    interval, _ = block_interval(differences)
    tables = {name: reliability(p[name], y) for name in [PRODUCTION["id"], "previous_monthly_markov"]}
    levels = [(i + 0.5) / AMOUNT_LEVELS for i in range(AMOUNT_LEVELS)]
    previous_amounts = amount_table(records, *SPLIT["train"], [0.1, 0.3, 0.5, 0.7, 0.9])
    new_amounts = amount_table(records, *SPLIT["train"], levels)
    wet_held = [row for row in held if row["wet"]]
    return {
        "train": list(SPLIT["train"]),
        "heldOut": list(SPLIT["heldOut"]),
        "days": len(held),
        "brier": scores,
        "logLoss": losses,
        "skillVsClimatology": round(1 - scores[PRODUCTION["id"]] / scores["monthly_climatology"], 5),
        "skillVsPreviousModel": round(1 - scores[PRODUCTION["id"]] / scores["previous_monthly_markov"], 5),
        "previousModelSkillVsClimatology": round(1 - scores["previous_monthly_markov"] / scores["monthly_climatology"], 5),
        "brierDifferenceVsPreviousModel": {
            "mean": round(sum(differences) / len(differences), 8),
            "blockBootstrap95": interval,
            "method": "30-day moving blocks, 2000 draws, fixed seed",
        },
        "yearsBetterThanPreviousModel": sum(row[PRODUCTION["id"]] < row["previous_monthly_markov"] for row in yearly.values()),
        "reliability": {name: table[0] for name, table in tables.items()},
        "murphyDecomposition": {name: table[1] for name, table in tables.items()},
        "heldOutCoefficients": dict(zip(names, coefficients)),
        "amountCrpsMm": {
            "previousFiveQuantiles": round(sum(crps(previous_amounts[r["day"].month - 1], r["amount"]) for r in wet_held) / len(wet_held), 4),
            "twentyMidpointQuantiles": round(sum(crps(new_amounts[r["day"].month - 1], r["amount"]) for r in wet_held) / len(wet_held), 4),
            "wetDays": len(wet_held),
        },
        "yearly": yearly,
    }


def evaluate(records, oni):
    """Five-fold blocked CV inside 1991-2015 for every candidate, then the held-out scores for all of them."""
    rows = observed_rows(records, oni)
    train_rows = [row for row in rows if SPLIT["train"][0] <= row["day"].year <= SPLIT["train"][1]]
    held = [row for row in rows if SPLIT["heldOut"][0] <= row["day"].year <= SPLIT["heldOut"][1]]
    y_train = [row["wet"] for row in train_rows]
    y_held = [row["wet"] for row in held]
    results, cv_losses = {}, {}
    for name, names in CANDIDATES:
        best = None
        for lam in LAMBDAS:
            predicted = [0.0] * len(train_rows)
            for low, high in FOLDS:
                fitted = fit_model([row for row in train_rows if not low <= row["day"].year <= high], names, lam, SPLIT["train"])
                for i, row in enumerate(train_rows):
                    if low <= row["day"].year <= high:
                        predicted[i] = logistic(fitted, vector(names, row["values"]))
            score = brier(predicted, y_train)
            if best is None or score < best[1]:
                best = (lam, score, predicted)
        lam, score, predicted = best
        cv_losses[name] = [(a - b) ** 2 for a, b in zip(predicted, y_train)]
        coefficients = fit_model(rows, names, lam, SPLIT["train"])
        held_p = predict(held, names, coefficients)
        results[name] = {
            "parameters": len(names),
            "lambda": lam,
            "cvBrier": round(score, 6),
            "cvLogLoss": round(log_loss(predicted, y_train), 6),
            "heldOutBrier": round(brier(held_p, y_held), 8),
            "heldOutLogLoss": round(log_loss(held_p, y_held), 6),
        }
    markov_cv = [0.0] * len(train_rows)
    for low, high in FOLDS:
        model = fit_markov({d: v for d, v in records.items() if not low <= d.year <= high}, *SPLIT["train"])
        for i, row in enumerate(train_rows):
            if low <= row["day"].year <= high:
                markov_cv[i] = model["transition"][row["day"].month - 1][int(row["values"]["w1"])]
    markov = fit_markov(records, *SPLIT["train"])
    markov_held = [markov["transition"][row["day"].month - 1][int(row["values"]["w1"])] for row in held]
    results["previous_monthly_markov"] = {
        "parameters": 24,
        "lambda": None,
        "cvBrier": round(brier(markov_cv, y_train), 6),
        "cvLogLoss": round(log_loss(markov_cv, y_train), 6),
        "heldOutBrier": round(brier(markov_held, y_held), 8),
        "heldOutLogLoss": round(log_loss(markov_held, y_held), 6),
    }
    leader = min(cv_losses, key=lambda name: sum(cv_losses[name]))
    for name in cv_losses:
        difference = [a - b for a, b in zip(cv_losses[name], cv_losses[leader])]
        _, spread = block_interval(difference) if name != leader else (None, 0.0)
        results[name]["cvBrierAboveBest"] = round(sum(difference) / len(difference), 6)
        results[name]["pairedBlockStandardError"] = spread
    eligible = [name for name in cv_losses if results[name]["cvBrierAboveBest"] <= results[name]["pairedBlockStandardError"]]
    fewest = min(results[name]["parameters"] for name in eligible)
    selected = min((name for name in eligible if results[name]["parameters"] == fewest), key=lambda name: results[name]["cvBrier"])
    # ENSO at the scale where it is known to matter: November-March wet days against that year's SON ONI.
    seasons = [
        (sum(records[d] >= WET_TENTHS_MM for d in records if (d.year == y and d.month >= 11) or (d.year == y + 1 and d.month <= 3)), oni[(y, 10)])
        for y in range(1991, 2025)
    ]
    mean_wet, mean_oni = (sum(s[i] for s in seasons) / len(seasons) for i in (0, 1))
    covariance = sum((w - mean_wet) * (o - mean_oni) for w, o in seasons)
    correlation = covariance / math.sqrt(sum((w - mean_wet) ** 2 for w, _ in seasons) * sum((o - mean_oni) ** 2 for _, o in seasons))
    return {
        "split": {key: list(value) for key, value in SPLIT.items()},
        "folds": [list(fold) for fold in FOLDS],
        "lambdaGrid": LAMBDAS,
        "rule": "Lowest CV Brier; among candidates within one paired block-bootstrap standard error of it, the fewest parameters, then the lower CV Brier. Held-out scores are reported for every candidate after selection.",
        "selected": selected,
        "production": PRODUCTION["id"],
        "ensoInput": "CPC ONI season ending two months before the target month, published before that month begins",
        "ensoSeasonal": {
            "seasons": "November-March, starting 1991 through 2024",
            "correlationWetDaysWithSonOni": round(correlation, 3),
            "count": len(seasons),
        },
        "candidates": results,
    }


# ---------------------------------------------------------------- the NWS forecast


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


def parse_time(text, label):
    try:
        value = datetime.fromisoformat(text)
    except (TypeError, ValueError) as error:
        raise Rejected(f"{label} is not an ISO timestamp") from error
    if value.tzinfo is None:
        raise Rejected(f"{label} has no UTC offset")
    return value


def validate_points(raw):
    try:
        properties = json.loads(raw)["properties"]
        found = (properties["gridId"], properties["gridX"], properties["gridY"])
    except (ValueError, KeyError, TypeError) as error:
        raise Rejected("NWS point metadata is not the documented GeoJSON") from error
    if found != GRID or properties.get("forecastHourly") != HOURLY_URL:
        raise Rejected(f"NWS now maps the La Jolla point to {found}; review the new grid before following it")


def validate_hourly(raw, now, previous_issued=None):
    """Reject malformed responses; defer stale, short or older ones. Returns the response's own times."""
    try:
        properties = json.loads(raw)["properties"]
        periods = properties["periods"]
    except (ValueError, KeyError, TypeError) as error:
        raise Rejected("NWS hourly forecast is not the documented GeoJSON") from error
    if not isinstance(periods, list) or len(periods) < 72:
        raise Rejected("NWS hourly forecast has fewer than 72 periods")
    issued = parse_time(properties.get("updateTime"), "updateTime")
    generated = parse_time(properties.get("generatedAt"), "generatedAt")
    previous_end = None
    for index, period in enumerate(periods):
        if not isinstance(period, dict):
            raise Rejected(f"period {index} is not an object")
        start = parse_time(period.get("startTime"), f"period {index} startTime")
        end = parse_time(period.get("endTime"), f"period {index} endTime")
        if end - start != timedelta(hours=1):
            raise Rejected(f"period {index} is not one hour long")
        if previous_end is not None and start != previous_end:
            raise Rejected(f"period {index} does not follow the previous hour")
        previous_end = end
        chance = (period.get("probabilityOfPrecipitation") or {}).get("value")
        if chance is not None and (isinstance(chance, bool) or not isinstance(chance, (int, float)) or not 0 <= chance <= 100):
            raise Rejected(f"period {index} has an invalid precipitation probability")
        if not isinstance(period.get("shortForecast"), str) or not period["shortForecast"].strip():
            raise Rejected(f"period {index} has no short forecast")
    first = parse_time(periods[0]["startTime"], "first startTime")
    if issued > now + timedelta(minutes=15) or generated > now + timedelta(minutes=15):
        raise Rejected("NWS forecast times are in the future")
    if now - issued > timedelta(hours=36):
        raise Deferred(f"NWS forecast was last updated {issued.isoformat()}, more than 36 hours ago")
    if previous_end - now < timedelta(hours=72):
        raise Deferred("NWS forecast covers fewer than 72 future hours")
    if first - now > timedelta(hours=3):
        raise Deferred("NWS forecast starts more than three hours ahead")
    if previous_issued is not None and issued < previous_issued:
        raise Deferred("NWS served a forecast older than the retained snapshot")
    return {"issued": issued, "generated": generated}


def forecast(raw):
    properties = json.loads(raw)["properties"]
    days = defaultdict(list)
    for period in properties["periods"]:
        start, end = datetime.fromisoformat(period["startTime"]), datetime.fromisoformat(period["endTime"])
        chance = (period.get("probabilityOfPrecipitation") or {}).get("value")
        chance = max(0, min(100, chance or 0)) / 100
        text = period["shortForecast"].lower()
        rain = bool(re.search(r"rain|shower|drizzle|thunder", text))
        # Probability is not rainfall rate. The bounded visual amplitude is an authored interpretation.
        amplitude = (0.55 if "heavy" in text else 0.28) if rain and chance >= 0.3 else 0
        local_minute = start.hour * 60 + start.minute
        minutes = round((end.timestamp() - start.timestamp()) / 60)
        # Pacific ISO offsets give the local minute; the UTC epoch keeps the repeated DST hour distinct.
        days[start.date().isoformat()].append([local_minute, min(1440, local_minute + minutes), round(cloud_cover(text), 3), round(chance, 3), amplitude, int(start.timestamp())])
    periods = properties["periods"]
    return {
        "source": "NWS SGX/53,20 hourly",
        "issued": properties["updateTime"],
        "generated": properties["generatedAt"],
        "validFrom": periods[0]["startTime"],
        "validThrough": periods[-1]["endTime"],
        "days": dict(days),
    }


def forecast_content(snapshot):
    """What the scene shows; NWS regenerates `generatedAt` on every request, so it is not a change."""
    return {key: value for key, value in snapshot.items() if key != "generated"}


# ---------------------------------------------------------------- build


def load_sources(layout):
    sources = {}
    for name in URLS:
        path = layout.sources / name
        sources[name] = gzip.decompress(path.read_bytes()) if path.exists() else None
    retrieval = json.loads(layout.retrieval.read_text(encoding="utf-8")) if layout.retrieval.exists() else {}
    return sources, retrieval


def runtime_bytes(runtime):
    header = (
        "// Generated by bin/build_coastal_weather.py from retained NOAA/NWS bytes; see artwork/coastal-home/weather-2026-10-24.\n"
        "// An NWS hour is a forecast only inside its published interval; otherwise the seasonal model simulates the day.\n"
        "// prettier-ignore\n"
    )
    return (header + "export const COASTAL_WEATHER_DATA = " + json.dumps(runtime, separators=(",", ":"), ensure_ascii=True, allow_nan=False) + ";\n").encode("utf-8")


@functools.lru_cache(maxsize=2)
def station_products(station_raw, local_raw):
    """Everything derived from the gauge records. A forecast refresh reuses it unchanged."""
    records, skipped = read_precip(station_raw)
    local, local_skipped = read_precip(local_raw)
    rows = observed_rows(records)
    evaluation = validate(records, rows)
    if evaluation["skillVsPreviousModel"] <= 0 or evaluation["skillVsClimatology"] <= 0:
        raise SystemExit("The production model no longer beats the previous model and climatology on the held-out years; review before shipping.")
    coefficients = fit_model(rows, PRODUCTION["features"], PRODUCTION["lambda"], SPLIT["production"])
    amounts = amount_table(records, *SPLIT["production"], [(i + 0.5) / AMOUNT_LEVELS for i in range(AMOUNT_LEVELS)])
    flags = simulate(coefficients, PRODUCTION["features"], amounts, *SEQUENCE)
    return {
        "records": records,
        "skipped": skipped,
        "local": local,
        "localSkipped": local_skipped,
        "evaluation": evaluation,
        "coefficients": coefficients,
        "amounts": amounts,
        "climatology": fit_markov(records, *SPLIT["production"]),
        "flags": flags,
    }


def build(sources, retrieval):
    """Every generated byte from decoded source bytes: {path name: bytes} plus a short summary."""
    station = station_products(sources[f"{STATION}.dly.gz"], sources[f"{LOCAL_STATION}.dly.gz"])
    records, skipped, local, local_skipped = station["records"], station["skipped"], station["local"], station["localSkipped"]
    evaluation, coefficients, amounts, climatology, flags = (station[k] for k in ("evaluation", "coefficients", "amounts", "climatology", "flags"))
    names, lam = PRODUCTION["features"], PRODUCTION["lambda"]
    encoded = "".join(ALPHABET[sum(bit << j for j, bit in enumerate(flags[i : i + 6]))] for i in range(0, len(flags), 6))
    snapshot = forecast(sources["forecast-hourly.json.gz"])
    runtime = {
        "version": 2,
        "station": STATION,
        "fitYears": list(SPLIT["production"]),
        "wetThresholdMm": 0.3,
        "monthlyChance": climatology["climatology"],
        "model": {
            "kind": "logistic",
            "id": PRODUCTION["id"],
            "phase": "2*pi*(days since January 1)/365.25",
            "dryDayCap": DRY_SPELL_CAP,
            "features": names,
            "coefficients": coefficients,
        },
        "amountQuantilesMm": amounts,
        "sequence": {"start": SEQUENCE[0].isoformat(), "end": SEQUENCE[1].isoformat(), "wetBits": encoded},
        "forecast": snapshot,
    }
    runtime_data = runtime_bytes(runtime)
    observed_flags = [int(records[d] >= WET_TENTHS_MM) for d in sorted(records) if SPLIT["production"][0] <= d.year <= SPLIT["production"][1]]
    hours = [row for rows_ in snapshot["days"].values() for row in rows_]
    receipts = []
    for name, url in URLS.items():
        data = sources[name]
        entry = {"file": f"source/{name}", "url": url, "decodedBytes": len(data), "decodedSha256": hashlib.sha256(data).hexdigest()}
        entry.update(retrieval.get(name, {}))
        receipts.append(entry)
    receipt = {
        "schema": 2,
        "sources": receipts,
        "station": {
            "id": STATION,
            "name": "San Diego Lindbergh Field",
            "lat": 32.7336,
            "lon": -117.1831,
            "limitation": "Nearby coastal regional proxy, not the house microclimate; gauge-day totals do not establish within-day rain timing.",
        },
        "coverage": {
            "1991_2025AcceptedDays": sum(1991 <= d.year <= 2025 for d in records),
            "1991_2025ExpectedDays": (date(2026, 1, 1) - date(1991, 1, 1)).days,
            "rejectedOrMissingByYear": {str(y): n for y, n in skipped.items() if 1991 <= y <= 2025},
            "localComparison": {
                "id": LOCAL_STATION,
                "accepted2010_2025": sum(2010 <= d.year <= 2025 for d in local),
                "expected2010_2025": (date(2026, 1, 1) - date(2010, 1, 1)).days,
                "rejectedOrMissingByYear": {str(y): n for y, n in local_skipped.items() if 2010 <= y <= 2025},
            },
        },
        "model": {
            "id": PRODUCTION["id"],
            "kind": "Ridge-penalized logistic regression for wet-day occurrence (a GLM weather generator)",
            "lambda": lam,
            "features": {
                "s1..c3": "three annual harmonics of the day of year",
                "w1, w2": "wet yesterday, wet the day before",
                "a1": "ln(1 + yesterday's millimetres) on a wet yesterday, else 0",
                "dsl": f"ln(days since the last wet day), capped at {DRY_SPELL_CAP}",
            },
            "selection": "Five-fold blocked cross-validation inside 1991-2015; see model-evaluation.json",
            "productionCoefficients": dict(zip(names, coefficients)),
            "amounts": f"{AMOUNT_LEVELS} midpoint quantiles of each month's wet-day amounts; a wet day's draw also feeds the next day's a1",
        },
        "validation": evaluation,
        "productionRefitYears": list(SPLIT["production"]),
        "monthlyCounts": climatology["counts"],
        "precomputedSequence": {
            "start": SEQUENCE[0].isoformat(),
            "end": SEQUENCE[1].isoformat(),
            "wetDays": sum(flags),
            "days": len(flags),
            **spell_stats(flags, SEQUENCE[0].year),
            "observed1991_2025": spell_stats(observed_flags, SPLIT["production"][0]),
        },
        "forecast": {
            "source": snapshot["source"],
            "issued": snapshot["issued"],
            "generated": snapshot["generated"],
            "retrieved": retrieval.get("forecast-hourly.json.gz", {}).get("retrieved"),
            "validFrom": snapshot["validFrom"],
            "validThrough": snapshot["validThrough"],
            "hours": len(hours),
            "rainHours": sum(row[4] > 0 for row in hours),
            "maximumPrecipitationChance": max(row[3] for row in hours),
        },
        "runtimeBytes": len(runtime_data),
        "runtimeCanonicalLfSha256": hashlib.sha256(runtime_data).hexdigest(),
    }
    outputs = {"runtime": runtime_data, "receipt": (pretty_json(receipt) + "\n").encode("utf-8")}
    summary = {
        "heldOutBrier": evaluation["brier"],
        "skillVsPreviousModel": evaluation["skillVsPreviousModel"],
        "runtimeBytes": len(runtime_data),
        "forecastIssued": snapshot["issued"],
        "forecastValidThrough": snapshot["validThrough"],
    }
    return outputs, summary


def write_build(layout, outputs):
    changed = []
    for key, path in (("runtime", layout.output), ("receipt", layout.receipt)):
        if not path.exists() or canonical(path.read_bytes()) != outputs[key]:
            write_atomically(path, outputs[key])
            changed.append(path)
    return changed


def stamp(now):
    return now.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def refresh_forecast(layout, now=None, get=http_get, sleep=time.sleep, dry_run=False):
    """Adopt a newer, valid NWS snapshot. Raises Deferred or Rejected and leaves every file untouched."""
    now = now or datetime.now(timezone.utc)
    sources, retrieval = load_sources(layout)
    points, points_dates = fetch(POINTS_URL, get=get, sleep=sleep)
    validate_points(points)
    hourly, hourly_dates = fetch(HOURLY_URL, get=get, sleep=sleep)
    retained = forecast(sources["forecast-hourly.json.gz"])
    times = validate_hourly(hourly, now, previous_issued=parse_time(retained["issued"], "retained updateTime"))
    candidate = forecast(hourly)
    if forecast_content(candidate) == forecast_content(retained) and points == sources["points.json.gz"]:
        return {"status": "unchanged", "issued": retained["issued"], "validThrough": retained["validThrough"]}
    updated_sources = dict(sources, **{"points.json.gz": points, "forecast-hourly.json.gz": hourly})
    updated_retrieval = dict(retrieval)
    for name, dates in (("points.json.gz", points_dates), ("forecast-hourly.json.gz", hourly_dates)):
        if name == "forecast-hourly.json.gz" or updated_sources[name] != sources[name]:
            updated_retrieval[name] = {"retrieved": stamp(now), **{k: v for k, v in dates.items() if v}}
    outputs, summary = build(updated_sources, updated_retrieval)
    result = {
        "status": "would update" if dry_run else "updated",
        "previousIssued": retained["issued"],
        "issued": candidate["issued"],
        "generated": times["generated"].isoformat(),
        "validFrom": candidate["validFrom"],
        "validThrough": candidate["validThrough"],
        "rainHours": sum(row[4] > 0 for rows in candidate["days"].values() for row in rows),
        "runtimeBytes": summary["runtimeBytes"],
    }
    if dry_run:
        return result
    for name in ("points.json.gz", "forecast-hourly.json.gz"):
        if updated_sources[name] != sources[name]:
            write_atomically(layout.sources / name, gzip.compress(updated_sources[name], mtime=0))
    write_atomically(layout.retrieval, (pretty_json(updated_retrieval) + "\n").encode("utf-8"))
    write_build(layout, outputs)
    return result


def refresh_all(layout, now=None, get=http_get, sleep=time.sleep):
    """A deliberate full refresh. Validates the NWS pair first; then writes every source and rebuilds."""
    now = now or datetime.now(timezone.utc)
    sources, retrieval = load_sources(layout)
    fetched = {name: fetch(url, get=get, sleep=sleep) for name, url in URLS.items()}
    validate_points(fetched["points.json.gz"][0])
    validate_hourly(fetched["forecast-hourly.json.gz"][0], now)
    for name, (data, dates) in fetched.items():
        if data != sources.get(name):
            retrieval[name] = {"retrieved": stamp(now), **{k: v for k, v in dates.items() if v}}
        sources[name] = data
    outputs, summary = build(sources, retrieval)
    for name, (data, _) in fetched.items():
        path = layout.sources / name
        if not path.exists() or gzip.decompress(path.read_bytes()) != data:
            write_atomically(path, gzip.compress(data, mtime=0))
    write_atomically(layout.retrieval, (pretty_json(retrieval) + "\n").encode("utf-8"))
    write_build(layout, outputs)
    return summary


def main(argv=None, layout=None, get=http_get, now=None, sleep=time.sleep):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--refresh-forecast", action="store_true", help="fetch and adopt a newer valid NWS hourly forecast")
    mode.add_argument("--refresh", action="store_true", help="deliberately refresh every source, then rebuild")
    mode.add_argument("--evaluate", action="store_true", help="rerun the candidate comparison and write model-evaluation.json")
    mode.add_argument("--check", action="store_true", help="fail if the committed outputs differ from an offline rebuild")
    parser.add_argument("--dry-run", action="store_true", help="with --refresh-forecast: report without writing")
    args = parser.parse_args(argv)
    if args.dry_run and not args.refresh_forecast:
        parser.error("--dry-run applies only to --refresh-forecast")
    layout = layout or Layout()
    try:
        if args.refresh_forecast:
            result = refresh_forecast(layout, now=now, get=get, sleep=sleep, dry_run=args.dry_run)
        elif args.refresh:
            result = refresh_all(layout, now=now, get=get, sleep=sleep)
        elif args.evaluate:
            sources, _ = load_sources(layout)
            records, _ = read_precip(sources[f"{STATION}.dly.gz"])
            result = evaluate(records, read_oni(sources["oni.ascii.txt.gz"]))
            write_atomically(layout.evaluation, (pretty_json(result) + "\n").encode("utf-8"))
        elif args.check:
            outputs, _ = build(*load_sources(layout))
            stale = [str(p.relative_to(layout.root)) for k, p in (("runtime", layout.output), ("receipt", layout.receipt)) if canonical(p.read_bytes()) != outputs[k]]
            if stale:
                print(f"weather outputs are not reproducible from the retained sources: {', '.join(stale)}", file=sys.stderr)
                return 1
            result = {"status": "reproducible"}
        else:
            outputs, result = build(*load_sources(layout))
            write_build(layout, outputs)
    except Deferred as error:
        print(f"weather refresh deferred: {error}; keeping the last valid snapshot", file=sys.stderr)
        # Quiet retries are fine while the published hours last; fail visibly before they run out.
        sources, _ = load_sources(layout)
        expires = parse_time(forecast(sources["forecast-hourly.json.gz"])["validThrough"], "retained validThrough")
        if expires - (now or datetime.now(timezone.utc)) < timedelta(hours=72):
            print(f"the published forecast expires at {expires.isoformat()}; the refresh has been failing too long", file=sys.stderr)
            return 1
        return EXIT_DEFERRED
    except Rejected as error:
        print(f"weather refresh rejected: {error}; keeping the last valid snapshot", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
