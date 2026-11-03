import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_pavilion_chair as chair
from coastal_pavilion_breakfast import topology


class PavilionChairTests(unittest.TestCase):
    def test_lobes_are_positive_closed_with_an_open_top_tail_channel(self):
        parts = chair.parts()
        self.assertEqual(len(parts), 2)
        self.assertEqual(sum(len(part["triangles"]) for part in parts), 88)
        for index, part in enumerate(parts):
            proof = topology(part)
            self.assertEqual(proof["badDirectedEdges"], 0)
            self.assertGreater(proof["signedVolume"], 0)
            self.assertGreater(proof["minimumDoubleArea"], 0)
            # Actual delivered Tail-contact face envelope, not a joint origin.
            xs = [p[0] for p in part["points"]]
            if index == 0:
                self.assertLess(max(xs), 6.477871567314654 - 0.03)
            else:
                self.assertGreater(min(xs), 6.705212422497647 + 0.03)
            world_up = [p[2] for p in part["points"]]
            self.assertGreaterEqual(min(world_up), 0.645 - 1e-12)
            self.assertLessEqual(max(world_up), 0.895 + 1e-12)

    def test_original_panel_and_donor_are_independently_pinned(self):
        self.assertEqual(len(chair.PANEL_SHA256), 64)
        self.assertEqual(len(chair.POST_SHA256), 64)
        self.assertNotEqual(chair.PANEL_SHA256, chair.POST_SHA256)
        self.assertEqual(len({*chair.NAMES, chair.POST_NAME}), 3)
        self.assertNotIn(chair.OWNER, chair.NAMES)
        self.assertNotIn(chair.POST_OWNER, chair.NAMES)

    def test_refresh_uses_the_existing_pinned_private_output_guard(self):
        spec = importlib.util.spec_from_file_location("pavilion_chair_refresh", ROOT / "bin" / "refresh_coastal_pavilion_chair.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for digest in ["", "0" * 63, "F" * 64, "unknown"]:
            with self.assertRaises(ValueError):
                module.validate_paths(ROOT, ROOT / "missing.blend", digest, ROOT / "canonical.blend", ROOT / "report.json")


if __name__ == "__main__":
    unittest.main()
