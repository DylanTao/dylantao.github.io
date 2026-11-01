"""Coverage regressions for export-only planar compaction."""
import importlib.util
import json
import unittest
from collections import Counter
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("coastal_export_geometry", Path(__file__).resolve().parents[1] / "bin/coastal_export_geometry.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def positions(points):
    return {i: (x, y, 0.) for i, (x, y) in enumerate(points)}


class PlanarExportCoverageTests(unittest.TestCase):
    def test_actual_110mm_false_cap_witness_remains_a_hole(self):
        fixture = json.loads((Path(__file__).parent / "fixtures/coastal-export-false-cap.json").read_text())
        points = dict(enumerate(fixture["positions"]))
        result = MODULE.planar_patch_coverage(points, fixture["triangles"], fixture["boundaryEdges"], fixture["normal"])
        self.assertFalse(result["passed"])
        self.assertEqual(result["boundaryLoops"], 2)
        witness = fixture["oldFalseCapWitnessNative"]

        def contains(triangle):
            corners = [points[i] for i in triangle]
            signs = [(b[0] - a[0]) * (witness[1] - a[1]) - (b[1] - a[1]) * (witness[0] - a[0])
                     for a, b in zip(corners, corners[1:] + corners[:1])]
            return min(signs) >= 0 or max(signs) <= 0

        self.assertFalse(any(contains(triangle) for triangle in fixture["triangles"]))

    def test_valid_concave_patch_retains_its_notch(self):
        points = positions([(0, 0), (2, 0), (2, 1), (1, 1), (1, 2), (0, 2)])
        triangles = [(0, 1, 3), (1, 2, 3), (0, 3, 5), (3, 4, 5)]
        boundary = [(i, (i + 1) % 6) for i in range(6)]
        self.assertTrue(MODULE.planar_patch_coverage(points, triangles, boundary, (0, 0, 1))["passed"])

    def test_hole_component_falls_back_to_original_faces(self):
        points = positions([(0, 0), (4, 0), (4, 4), (0, 4), (1, 1), (3, 1), (3, 3), (1, 3)])
        triangles = [(0, 1, 5), (0, 5, 4), (1, 2, 6), (1, 6, 5), (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7)]
        boundary = [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4)]
        result = MODULE.planar_patch_coverage(points, triangles, boundary, (0, 0, 1))
        self.assertFalse(result["passed"])
        self.assertEqual(result["boundaryLoops"], 2)

    def test_retaining_an_original_hole_corridor_leaves_a_valid_disk(self):
        points = positions([(0, 0), (4, 0), (4, 4), (0, 4), (1, 1), (3, 1), (3, 3), (1, 3)])
        remaining = [(1, 2, 6), (1, 6, 5), (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7)]
        edges = Counter(tuple(sorted((a, b))) for t in remaining for a, b in zip(t, t[1:] + t[:1]))
        boundary = [edge for edge, count in edges.items() if count == 1]
        self.assertTrue(MODULE.planar_patch_coverage(points, remaining, boundary, (0, 0, 1))["passed"])

    def test_new_cap_across_concavity_is_rejected(self):
        points = positions([(0, 0), (2, 0), (2, 1), (1, 1), (1, 2), (0, 2)])
        wrong_cap = [(0, 1, 2), (0, 2, 4), (0, 4, 5)]
        original_boundary = [(i, (i + 1) % 6) for i in range(6)]
        self.assertFalse(MODULE.planar_patch_coverage(points, wrong_cap, original_boundary, (0, 0, 1))["passed"])

    def test_projected_bow_tie_is_rejected(self):
        points = positions([(0, 0), (2, 2), (0, 2), (2, 0)])
        boundary = [(0, 1), (1, 2), (2, 3), (3, 0)]
        self.assertFalse(MODULE.planar_patch_coverage(points, [(0, 1, 2), (0, 2, 3)], boundary, (0, 0, 1))["passed"])

    def test_flipped_or_degenerate_render_triangles_stay_original(self):
        points = positions([(0, 0), (1, 0), (0, 1), (.5, 0)])
        boundary = [(0, 1), (1, 2), (2, 0)]
        for triangles in [[(0, 2, 1)], [(0, 1, 2), (0, 3, 1)]]:
            with self.subTest(triangles=triangles):
                self.assertFalse(MODULE.planar_patch_coverage(points, triangles, boundary, (0, 0, 1))["passed"])

    def test_global_plane_drift_does_not_accumulate_across_stars(self):
        points = {0: (0., 0., 0.), 1: (1., 0., 0.), 2: (0., 1., 4e-6)}
        self.assertFalse(MODULE.planar_patch_coverage(points, [(0, 1, 2)], [(0, 1), (1, 2), (2, 0)], (0, 0, 1))["passed"])

    def test_negative_axis_oriented_surface_is_valid(self):
        points = positions([(0, 0), (1, 0), (0, 1)])
        self.assertTrue(MODULE.planar_patch_coverage(points, [(0, 2, 1)], [(0, 1), (1, 2), (2, 0)], (0, 0, -1))["passed"])


if __name__ == "__main__":
    unittest.main()
