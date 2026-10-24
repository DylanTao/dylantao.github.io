import gzip
import hashlib
import importlib.util
import json
from datetime import date
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("coastal_weather_builder", ROOT / "bin/build_coastal_weather.py")
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


class CoastalWeatherTests(unittest.TestCase):
    def test_response_and_runtime_custody(self):
        receipt = json.loads((BUILDER.REVIEW / "build-receipt.json").read_text())
        for source in receipt["sources"]:
            raw = gzip.decompress((BUILDER.REVIEW / source["file"]).read_bytes())
            self.assertEqual(len(raw), source["decodedBytes"])
            self.assertEqual(hashlib.sha256(raw).hexdigest(), source["decodedSha256"])
        canonical = BUILDER.OUTPUT.read_text(encoding="utf-8").replace("\r\n", "\n").encode("utf-8")
        self.assertEqual(hashlib.sha256(canonical).hexdigest(), receipt["runtimeCanonicalLfSha256"])

    def test_parser_rejects_missing_and_quality_flagged_precipitation(self):
        cells = [f"{3:5}   ", f"{90:5} Q ", f"{-9999:5}   "] + [f"{0:5}   "] * 28
        raw = "USW00023188202001PRCP" + "".join(cells) + "\n"
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "station.gz"
            path.write_bytes(gzip.compress(raw.encode("ascii")))
            records, rejected = BUILDER.read_precip(path)
        self.assertEqual(records[date(2020, 1, 1)], 3)
        self.assertNotIn(date(2020, 1, 2), records)
        self.assertNotIn(date(2020, 1, 3), records)
        self.assertEqual(rejected[2020], 2)

    def test_holdout_is_chronological_and_candidate_beats_simple_baselines(self):
        receipt = json.loads((BUILDER.REVIEW / "build-receipt.json").read_text())
        coverage, validation = receipt["coverage"], receipt["validation"]
        self.assertEqual(coverage["1991_2025AcceptedDays"], coverage["1991_2025ExpectedDays"])
        self.assertEqual(validation["train"], [1991, 2015])
        self.assertEqual(validation["heldOut"], [2016, 2025])
        self.assertEqual(validation["days"], 3653)
        for baseline in ["monthly_climatology", "persistence", "always_dry"]:
            self.assertLess(validation["brier"]["seasonal_markov"], validation["brier"][baseline])
        self.assertTrue(all(row["seasonal_markov"] < row["monthly_climatology"] for row in validation["yearly"].values()))

    def test_fit_never_uses_outside_years(self):
        first = {date(2015, 1, 1): 0, date(2015, 1, 2): 3}
        # Give every month at least one wet/dry observation, as the production data has.
        for month in range(2, 13):
            first[date(2015, month, 1)] = 0
            first[date(2015, month, 2)] = 3
        before = BUILDER.fit(first, 2015, 2015)
        first.update({date(2016, 1, 1): 800, date(2016, 1, 2): 1000})
        self.assertEqual(before, BUILDER.fit(first, 2015, 2015))


if __name__ == "__main__":
    unittest.main()
