from __future__ import annotations

import importlib.util
import math
import unittest
from pathlib import Path


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


if __name__ == "__main__":
    unittest.main()
