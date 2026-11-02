"""The private cutter must never treat nearby retained source skin as inside."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("breakfast_membership_subject", ROOT / "bin/coastal_breakfast_nook.py")
nook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nook)
OWNER = "core__golden coastal sandstone"


def box():
    lo, hi = (-7., -3.4199981689453125, -1.), (-6., -3.4000000953674316, 0.)
    vertices = [(lo[0], lo[1], lo[2]), (hi[0], lo[1], lo[2]),
                (hi[0], hi[1], lo[2]), (lo[0], hi[1], lo[2]),
                (lo[0], lo[1], hi[2]), (hi[0], lo[1], hi[2]),
                (hi[0], hi[1], hi[2]), (lo[0], hi[1], hi[2])]
    triangles = [(0, 3, 2), (0, 2, 1), (4, 5, 6), (4, 6, 7),
                 (0, 1, 5), (0, 5, 4), (3, 7, 6), (3, 6, 2),
                 (0, 4, 7), (0, 7, 3), (1, 2, 6), (1, 6, 5)]
    return {"nativeVertices": vertices, "nativeTriangles": triangles, "nativeBounds": [lo, hi]}


class ExactNativeMembershipTests(unittest.TestCase):
    def classify(self, geometry, output):
        with patch.object(nook, "cutter_geometry", return_value=geometry):
            return nook.exact_axis_tool_classifier(object(), output, OWNER)

    def test_retained_skin_less_than_one_micrometre_away_is_outside(self):
        with tempfile.TemporaryDirectory() as directory:
            contains = self.classify(box(), Path(directory))
            # Actual V492 source skin is0.953674um beyond this cutter plane.
            self.assertFalse(contains((-6.5, -3.419999122619629, -.5)))
            self.assertFalse(contains((-6.5, -3.4199981689453125 - 2**-30, -.5)))
            self.assertTrue(contains((-6.5, -3.4199981689453125, -.5)))
            self.assertTrue(contains((-6.5, -3.4199981689453125 + 2**-30, -.5)))

    def test_inclusive_corners_and_exact_volume_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            geometry = box()
            contains = self.classify(geometry, output)
            self.assertTrue(all(contains(point) for point in geometry["nativeVertices"]))
            report = json.loads(next(output.glob("*.json")).read_text())
            self.assertEqual(report["exactCellVolume"], report["exactOrientedTriangleVolume"])
            self.assertEqual(len(report["axisCells"]), 1)
            self.assertFalse(contains((-5.999999999, -3.41, -.5)))
            self.assertFalse(contains((-6.5, -3.41, float("nan"))))

    def test_triangle_order_does_not_change_classification(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            geometry = box()
            before = self.classify(geometry, output)
            geometry["nativeTriangles"].reverse()
            after = self.classify(geometry, output)
            for point in ((-6.5, -3.41, -.5), (-6.5, -3.419999122619629, -.5), (-7., -3.41, 0.)):
                self.assertEqual(before(point), after(point))

    def test_bad_orientation_nonaxis_mesh_and_out_of_lease_owner_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            wrong = box()
            wrong["nativeTriangles"] = [tuple(reversed(face)) for face in wrong["nativeTriangles"]]
            with self.assertRaises(RuntimeError):
                self.classify(wrong, output)
            skew = box()
            skew["nativeVertices"][0] = (-7.001, -3.4199981689453125, -1.)
            with self.assertRaises(RuntimeError):
                self.classify(skew, output)
            with self.assertRaises(RuntimeError):
                nook.exact_axis_tool_classifier(object(), output, "unleased owner")


if __name__ == "__main__":
    unittest.main()
