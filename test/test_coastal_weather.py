import contextlib
import gzip
import hashlib
import importlib.util
import io
import json
import shutil
import tempfile
import unittest
import urllib.error
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("coastal_weather_builder", ROOT / "bin/build_coastal_weather.py")
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)
LAYOUT = BUILDER.Layout()


def retained(name):
    return gzip.decompress((LAYOUT.sources / name).read_bytes())


def utc(text):
    return datetime.fromisoformat(text).astimezone(timezone.utc)


# The daily workflow replaces the committed snapshot, so the tests' clock follows it: one hour after
# its issue or first hour, whichever is later, which every valid snapshot satisfies.
SNAPSHOT = json.loads(retained("forecast-hourly.json.gz"))["properties"]
ISSUED = utc(SNAPSHOT["updateTime"])
NOW = max(ISSUED, utc(SNAPSHOT["periods"][0]["startTime"])) + timedelta(hours=1)
NEWER = (NOW - timedelta(minutes=30)).isoformat()


def hourly(edit=None):
    payload = json.loads(retained("forecast-hourly.json.gz"))
    if edit:
        edit(payload["properties"])
    return json.dumps(payload).encode("utf-8")


class FakeNws:
    """Serves the NWS pair from memory; a list of responses per URL is consumed in order."""

    def __init__(self, points=None, forecast=None):
        self.responses = {BUILDER.POINTS_URL: points or [retained("points.json.gz")], BUILDER.HOURLY_URL: forecast or [retained("forecast-hourly.json.gz")]}
        self.requests = []

    def __call__(self, url):
        self.requests.append(url)
        queue = self.responses[url]
        response = queue.pop(0) if len(queue) > 1 else queue[0]
        if isinstance(response, Exception):
            raise response
        return response, {"httpDate": "Sat, 24 Oct 2026 15:00:00 GMT", "lastModified": None}


class CoastalWeatherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.layout = BUILDER.Layout(Path(self.temp.name))
        shutil.copytree(LAYOUT.review, self.layout.review)
        self.layout.output.parent.mkdir(parents=True)
        shutil.copy2(LAYOUT.output, self.layout.output)

    def tearDown(self):
        self.temp.cleanup()

    def snapshot(self):
        return {path.relative_to(self.layout.root): path.read_bytes() for path in self.layout.root.rglob("*") if path.is_file()}

    def run_main(self, args, get):
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()) as errors:
            status = BUILDER.main(args, layout=self.layout, get=get, now=NOW, sleep=lambda _: None)
        return status, errors.getvalue()

    # ------------------------------------------------------------ custody and reproducibility

    def test_response_and_runtime_custody(self):
        receipt = json.loads(LAYOUT.receipt.read_text(encoding="utf-8"))
        retrieval = json.loads(LAYOUT.retrieval.read_text(encoding="utf-8"))
        self.assertEqual([entry["file"] for entry in receipt["sources"]], [f"source/{name}" for name in BUILDER.URLS])
        for source in receipt["sources"]:
            raw = gzip.decompress((LAYOUT.review / source["file"]).read_bytes())
            self.assertEqual(len(raw), source["decodedBytes"])
            self.assertEqual(hashlib.sha256(raw).hexdigest(), source["decodedSha256"])
            self.assertTrue(retrieval[Path(source["file"]).name].items() <= source.items())
        canonical = LAYOUT.output.read_bytes().replace(b"\r\n", b"\n")
        self.assertEqual(hashlib.sha256(canonical).hexdigest(), receipt["runtimeCanonicalLfSha256"])
        self.assertEqual(len(canonical), receipt["runtimeBytes"])

    def test_offline_rebuild_reproduces_the_committed_outputs(self):
        outputs, _ = BUILDER.build(*BUILDER.load_sources(LAYOUT))
        self.assertEqual(outputs["runtime"], LAYOUT.output.read_bytes().replace(b"\r\n", b"\n"))
        self.assertEqual(outputs["receipt"], LAYOUT.receipt.read_bytes().replace(b"\r\n", b"\n"))

    def test_parser_rejects_missing_and_quality_flagged_precipitation(self):
        cells = [f"{3:5}   ", f"{90:5} Q ", f"{-9999:5}   "] + [f"{0:5}   "] * 28
        records, rejected = BUILDER.read_precip(("USW00023188202001PRCP" + "".join(cells) + "\n").encode("ascii"))
        self.assertEqual(records[date(2020, 1, 1)], 3)
        self.assertNotIn(date(2020, 1, 2), records)
        self.assertNotIn(date(2020, 1, 3), records)
        self.assertEqual(rejected[2020], 2)

    # ------------------------------------------------------------ the model

    def test_holdout_is_chronological_and_the_model_beats_the_previous_one(self):
        receipt = json.loads(LAYOUT.receipt.read_text(encoding="utf-8"))
        coverage, validation = receipt["coverage"], receipt["validation"]
        self.assertEqual(coverage["1991_2025AcceptedDays"], coverage["1991_2025ExpectedDays"])
        self.assertEqual((validation["train"], validation["heldOut"], validation["days"]), ([1991, 2015], [2016, 2025], 3653))
        model = BUILDER.PRODUCTION["id"]
        for baseline in ["previous_monthly_markov", "monthly_climatology", "persistence", "always_dry"]:
            self.assertLess(validation["brier"][model], validation["brier"][baseline])
        self.assertLess(validation["logLoss"][model], validation["logLoss"]["previous_monthly_markov"])
        self.assertLess(validation["brierDifferenceVsPreviousModel"]["blockBootstrap95"][1], 0)
        self.assertGreaterEqual(validation["yearsBetterThanPreviousModel"], 8)
        self.assertLess(validation["murphyDecomposition"][model]["reliability"], validation["murphyDecomposition"]["previous_monthly_markov"]["reliability"])
        self.assertLess(validation["amountCrpsMm"]["twentyMidpointQuantiles"], validation["amountCrpsMm"]["previousFiveQuantiles"])
        # The previous production model is reproduced exactly as a baseline.
        self.assertEqual(validation["brier"]["previous_monthly_markov"], 0.08416261)

    def test_fit_never_looks_ahead(self):
        sources, _ = BUILDER.load_sources(LAYOUT)
        records, _ = BUILDER.read_precip(sources["USW00023188.dly.gz"])
        records = {day: value for day, value in records.items() if 2013 <= day.year <= 2016}
        names, lam = BUILDER.PRODUCTION["features"], BUILDER.PRODUCTION["lambda"]
        before = BUILDER.fit_model(BUILDER.observed_rows(records), names, lam, (2014, 2015))
        flooded = {day: (900 if day.year >= 2016 else value) for day, value in records.items()}
        self.assertEqual(before, BUILDER.fit_model(BUILDER.observed_rows(flooded), names, lam, (2014, 2015)))

    def test_generated_json_is_laid_out_as_prettier_prints_it(self):
        self.assertEqual(BUILDER.pretty_json({"a": [1, 2], "b": [[1, 2], [3, 4]], "c": {}}), '{\n  "a": [1, 2],\n  "b": [\n    [1, 2],\n    [3, 4]\n  ],\n  "c": {}\n}')
        with self.assertRaises(ValueError):
            BUILDER.pretty_json({"long": list(range(100))})
        # Prettier's number normalization, observed with prettier 3.8.3.
        cases = {1.0: "1.0", 0.0: "0.0", 0.1: "0.1", 1e-05: "1e-5", 5.3e-05: "5.3e-5", 1e20: "1e20", 1.5e-10: "1.5e-10", -2e-07: "-2e-7", 100: "100"}
        for value, text in cases.items():
            self.assertEqual(BUILDER.number_text(value), text)
            self.assertEqual(json.loads(text), value)

    # ------------------------------------------------------------ the daily refresh

    def test_unchanged_forecast_writes_nothing(self):
        before = self.snapshot()
        regenerated = hourly(lambda p: p.update(generatedAt=(NOW - timedelta(minutes=1)).isoformat()))
        status, _ = self.run_main(["--refresh-forecast"], FakeNws(forecast=[regenerated]))
        self.assertEqual(status, 0)
        self.assertEqual(before, self.snapshot())

    def test_newer_forecast_is_adopted_with_honest_timestamps(self):
        wet_hours = [utc(period["startTime"]).timestamp() for period in SNAPSHOT["periods"][30:36]]
        generated = (NOW - timedelta(minutes=2)).isoformat()

        def edit(properties):
            properties["updateTime"] = NEWER
            properties["generatedAt"] = generated
            for period in properties["periods"][30:36]:
                period["shortForecast"] = "Rain Likely"
                period["probabilityOfPrecipitation"]["value"] = 70

        fake = FakeNws(forecast=[urllib.error.HTTPError(BUILDER.HOURLY_URL, 503, "busy", None, None), hourly(edit)])
        status, _ = self.run_main(["--refresh-forecast"], fake)
        self.assertEqual(status, 0)
        self.assertEqual(fake.requests.count(BUILDER.HOURLY_URL), 2, "a server error is retried")
        receipt = json.loads(self.layout.receipt.read_text(encoding="utf-8"))
        runtime = self.layout.output.read_text(encoding="utf-8")
        self.assertEqual(receipt["forecast"]["issued"], NEWER)
        self.assertEqual(receipt["forecast"]["generated"], generated)
        self.assertEqual(receipt["forecast"]["retrieved"], NOW.isoformat().replace("+00:00", "Z"))
        data = json.loads(runtime.split("COASTAL_WEATHER_DATA = ", 1)[1].rstrip().rstrip(";"))
        self.assertEqual(data["forecast"]["issued"], NEWER)
        rows = {row[5]: row for rows in data["forecast"]["days"].values() for row in rows}
        self.assertTrue(all(rows[int(epoch)][3] == 0.7 and rows[int(epoch)][4] == 0.28 for epoch in wet_hours))
        self.assertEqual(hashlib.sha256(runtime.encode("utf-8")).hexdigest(), receipt["runtimeCanonicalLfSha256"])
        entry = next(source for source in receipt["sources"] if source["file"] == "source/forecast-hourly.json.gz")
        self.assertEqual(entry["decodedSha256"], hashlib.sha256(gzip.decompress((self.layout.sources / "forecast-hourly.json.gz").read_bytes())).hexdigest())
        # The station model is untouched by a forecast refresh.
        self.assertEqual(receipt["model"], json.loads(LAYOUT.receipt.read_text(encoding="utf-8"))["model"])
        self.assertEqual((self.layout.sources / "points.json.gz").read_bytes(), (LAYOUT.sources / "points.json.gz").read_bytes())

    def test_dry_run_reports_without_writing(self):
        before = self.snapshot()
        status, _ = self.run_main(["--refresh-forecast", "--dry-run"], FakeNws(forecast=[hourly(lambda p: p.update(updateTime=NEWER))]))
        self.assertEqual(status, 0)
        self.assertEqual(before, self.snapshot())

    def test_failures_keep_the_last_valid_snapshot(self):
        def gap(properties):
            del properties["periods"][40]

        def bad_chance(properties):
            properties["periods"][3]["probabilityOfPrecipitation"]["value"] = 140

        def moved(raw):
            payload = json.loads(raw)
            payload["properties"]["gridX"] = 54
            return json.dumps(payload).encode("utf-8")

        offline = urllib.error.URLError("unreachable")
        cases = {
            "network outage": (FakeNws(forecast=[offline]), 75),
            "point metadata outage": (FakeNws(points=[TimeoutError("slow")]), 75),
            "stale upstream forecast": (FakeNws(forecast=[hourly(lambda p: p.update(updateTime=(NOW - timedelta(hours=48)).isoformat()))]), 75),
            "older than the retained snapshot": (FakeNws(forecast=[hourly(lambda p: p.update(updateTime=(ISSUED - timedelta(hours=1)).isoformat()))]), 75),
            "issued in the future": (FakeNws(forecast=[hourly(lambda p: p.update(updateTime=(NOW + timedelta(hours=2)).isoformat()))]), 1),
            "forecast missing": (FakeNws(forecast=[urllib.error.HTTPError(BUILDER.HOURLY_URL, 404, "gone", None, None)]), 1),
            "not JSON": (FakeNws(forecast=[b"<html>maintenance</html>"]), 1),
            "empty periods": (FakeNws(forecast=[hourly(lambda p: p.update(periods=[]))]), 1),
            "missing hour": (FakeNws(forecast=[hourly(gap)]), 1),
            "impossible probability": (FakeNws(forecast=[hourly(bad_chance)]), 1),
            "grid cell moved": (FakeNws(points=[moved(retained("points.json.gz"))]), 1),
        }
        before = self.snapshot()
        for label, (fake, expected) in cases.items():
            with self.subTest(label):
                status, message = self.run_main(["--refresh-forecast"], fake)
                self.assertEqual(status, expected, message)
                self.assertIn("keeping the last valid snapshot", message)
                self.assertEqual(before, self.snapshot())

    def test_a_long_outage_fails_before_the_published_forecast_runs_out(self):
        expires = utc(SNAPSHOT["periods"][-1]["endTime"])
        offline = urllib.error.URLError("unreachable")
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()) as errors:
            early = BUILDER.main(["--refresh-forecast"], layout=self.layout, get=FakeNws(forecast=[offline]), now=expires - timedelta(hours=96), sleep=lambda _: None)
            late = BUILDER.main(["--refresh-forecast"], layout=self.layout, get=FakeNws(forecast=[offline]), now=expires - timedelta(hours=48), sleep=lambda _: None)
        self.assertEqual((early, late), (75, 1))
        self.assertIn("failing too long", errors.getvalue())

    def test_requests_identify_the_site(self):
        self.assertIn("dylantao.github.io", BUILDER.USER_AGENT)
        self.assertNotIn("@", BUILDER.USER_AGENT)


if __name__ == "__main__":
    unittest.main()
