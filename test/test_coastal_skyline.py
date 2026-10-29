from __future__ import annotations

import importlib.util
import math
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np


SPEC = importlib.util.spec_from_file_location("coastal_skyline", Path(__file__).resolve().parents[1] / "bin" / "coastal_skyline.py")
skyline = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(skyline)


class CoastalFootprintTest(unittest.TestCase):
    def building(self, tags=None):
        lat, lon = skyline.VIEW[0] + 0.02, skyline.VIEW[1]
        dx = 12 / (111320 * math.cos(math.radians(lat)))
        dy = 5 / 110574
        return {
            "center": {"lat": lat, "lon": lon},
            "geometry": [{"lat": lat + y * dy, "lon": lon + x * dx} for x, y in [(-1, -1), (1, -1), (1, 1), (-1, 1), (-1, -1)]],
            "tags": tags or {},
        }

    def test_polygon_dimensions_follow_the_bay_view_in_metres(self):
        building = skyline.footprint(self.building())
        self.assertAlmostEqual(building["width"], 24, places=5)
        self.assertAlmostEqual(building["depth"], 10, places=5)

    def test_missing_height_is_an_explicit_six_metre_assumption(self):
        building = skyline.footprint(self.building())
        self.assertEqual(building["height"], 6)
        self.assertFalse(building["tagged_height"])

    def test_height_units_levels_and_roof_tags_are_retained(self):
        feet = skyline.footprint(self.building({"height": "20 ft", "roof:shape": "gabled"}))
        self.assertAlmostEqual(feet["height"], 6.096)
        self.assertTrue(feet["tagged_height"])
        self.assertEqual(feet["roof"], 1)
        levels = skyline.footprint(self.building({"building:levels": "3", "roof:shape": "flat"}))
        self.assertEqual(levels["height"], 9)
        self.assertTrue(levels["tagged_height"])
        self.assertEqual(levels["roof"], 0)


class CoastalDepthTest(unittest.TestCase):
    class Ground:
        cos = 1.0

        def __init__(self, land=True):
            self.land = land

        def point(self, bearing, distance):
            return distance / 110574.0, 0.0

        def at(self, lat, lon):
            return max(0.0, min(240.0, (lat * 110574.0 - 1000.0) * 0.1)) if self.land else 0.0

    def fixture(self, land=True):
        stage = {
            "bearings": [[-1, 0], [1, 0.5]],
            "edge": [[-1, 1.25, -8], [1, 1.25, -8]],
            "camera": {"position": [0, 20.5, 38], "target": [0, 4.5, 0]},
            "cotangent": 2.375,
        }
        angular = (np.arange(skyline.RELIEF_ROWS * 3 * 3) % 256).astype(np.uint8).reshape(skyline.RELIEF_ROWS, 3, 3)
        with patch.object(skyline, "RELIEF_BEARINGS", 3):
            image, details = skyline.depth_relief(self.Ground(land), angular, stage)
        return image, details, angular

    def test_original_angular_pixels_and_filter_gutters_are_preserved(self):
        image, details, angular = self.fixture()
        np.testing.assert_array_equal(image[:147], angular)
        np.testing.assert_array_equal(image[147], angular[-1])
        np.testing.assert_array_equal(image[152], image[153])
        np.testing.assert_array_equal(image[234], image[233])
        self.assertEqual(details["schema"], "sirui-coastal-depth-v1")

    def test_radial_metadata_keeps_real_positive_shore_support_and_native_datum(self):
        image, details, _ = self.fixture()
        word = lambda row: int(image[row, 1, 0]) * 256 + int(image[row, 1, 1])
        shore, crest = word(148), word(149)
        self.assertGreater(shore, 1000)
        self.assertLess(shore, 1012)
        self.assertGreater(crest, 3390)
        self.assertLess(crest, 3420)
        self.assertEqual(word(150), 1250)
        self.assertEqual(word(151), 8000)
        self.assertEqual(int(image[150, 1, 2]) * 256 + int(image[151, 1, 2]), 9728)
        self.assertEqual(image[148, 1, 2], image[153, 1, 2])
        self.assertEqual(image[149, 1, 2], image[233, 1, 2])
        self.assertGreater(image[153, 1, 2], 0, "A real sub-quantum positive shore must not become a sea hole")
        for j in (0, 1, 19, 40, 80):
            distance = shore + (crest - shore) * j / 80
            actual = self.Ground().at(distance / 110574, 0)
            decoded = int(image[153 + j, 1, 2]) * 280 / 255
            self.assertLessEqual(abs(decoded - actual), details["height_quantization_error_bound_m"])

    def test_zero_offshore_or_missing_ground_never_becomes_a_land_strip(self):
        image, details, _ = self.fixture(False)
        self.assertEqual(details["supported_columns"], 0)
        self.assertEqual(details["positive_radial_samples"], 0)
        self.assertFalse(image[148:].any())

    def test_existing_compass_anchors_and_native_edge_are_read_without_new_coordinates(self):
        stage = skyline.stage_mapping()
        self.assertAlmostEqual(skyline.stage_x(stage["bearings"], 33.8), -41.7)
        self.assertAlmostEqual(skyline.stage_x(stage["bearings"], 51.4), -28)
        self.assertAlmostEqual(skyline.stage_x(stage["bearings"], 198.4), 25.8)
        self.assertEqual(len(stage["edge"]), 521)
        self.assertEqual(stage["edge"][0][0], -82)
        self.assertEqual(stage["edge"][-1][0], 82)
        self.assertAlmostEqual(stage["cotangent"], 2.375)

    def test_relief_only_keeps_existing_osm_custody_and_does_not_write_skyline_data(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            provenance = root / "provenance.json"
            cached = root / "3dep.tif"
            cached.write_bytes(b"pinned source")
            houses = {"source": "existing OSM snapshot", "normalized_sha256": "kept", "requests": ["kept"]}
            provenance.write_text(json.dumps({"ground": {}, "houses": houses}))
            with patch.object(skyline.sys, "argv", ["coastal_skyline.py", "--relief-only"]), patch.object(skyline, "CACHE", root), patch.object(
                skyline, "PROVENANCE", provenance
            ), patch.object(skyline, "load_ground", return_value=np.zeros((2, 2))), patch.object(
                skyline, "load_buildings", side_effect=AssertionError("Relief must not refresh OSM")
            ), patch.object(skyline, "write_relief", return_value={"positive_radial_samples": 12}):
                skyline.main()
            self.assertEqual(json.loads(provenance.read_text())["houses"], houses)
            self.assertFalse((root / "skyline-data.mjs").exists())


if __name__ == "__main__":
    unittest.main()
