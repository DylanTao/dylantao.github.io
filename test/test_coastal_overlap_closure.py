"""Exact geometric closure must preserve real gaps and parallel source charts."""
import ast
from pathlib import Path
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
tree = ast.parse((ROOT / 'bin/audit_coastal_overlaps.py').read_text(encoding='utf8'))
functions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'exact_geometric_chain']
assert len(functions) == 1
namespace = {'np': np}
exec(compile(ast.Module(body=functions, type_ignores=[]), '<exact-geometric-closure>', 'exec'), namespace)
closure = namespace['exact_geometric_chain']
POINTS = np.array([(0., 0., 0.), (1., 0., 0.), (0., 1., 0.), (0., 0., 1.)])
FACES = np.array([(0, 2, 1), (0, 1, 3), (1, 2, 3), (2, 0, 3)], dtype=np.int64)


class CoastalOverlapClosure(unittest.TestCase):
    def test_real_corner_splits_close_without_altering_either_array(self):
        positions = POINTS[FACES].reshape(-1, 3).copy()
        triangles = np.arange(12).reshape(-1, 3)
        old_p, old_t = positions.copy(), triangles.copy()
        result = closure(positions, triangles)
        self.assertTrue(result['closedForWinding'])
        self.assertEqual(result['directedOccurrencesCounted'], 12)
        self.assertEqual(result['coordinateEdges'], 6)
        np.testing.assert_array_equal(positions, old_p)
        np.testing.assert_array_equal(triangles, old_t)

    def test_missing_face_and_even_a_tiny_real_seam_remain_open(self):
        self.assertFalse(closure(POINTS, FACES[:-1])['closedForWinding'])
        positions = POINTS[FACES].reshape(-1, 3).copy()
        positions[0, 0] = 1e-12
        self.assertFalse(closure(positions, np.arange(12).reshape(-1, 3))['closedForWinding'])

    def test_flipped_face_cannot_be_hidden_by_undirected_edge_counts(self):
        triangles = FACES.copy()
        triangles[0] = triangles[0, ::-1]
        result = closure(POINTS, triangles)
        self.assertFalse(result['closedForWinding'])
        self.assertEqual(result['imbalancedCoordinateEdges'], 3)
        self.assertEqual(result['unmatchedDirectedOccurrences'], 6)

    def test_parallel_closed_charts_keep_every_occurrence(self):
        result = closure(POINTS, np.concatenate([FACES, FACES]))
        self.assertTrue(result['closedForWinding'])
        self.assertEqual(result['trianglesCounted'], 8)
        self.assertEqual(result['directedOccurrencesCounted'], 24)
        self.assertEqual(result['maxCoordinateEdgeIncidence'], 4)

    def test_zero_charts_are_accounted_for_without_creating_a_solid(self):
        zero = np.array([(0, 0, 0)], dtype=np.int64)
        self.assertFalse(closure(POINTS, zero)['closedForWinding'])
        result = closure(POINTS, np.concatenate([FACES, zero]))
        self.assertTrue(result['closedForWinding'])
        self.assertEqual(result['trianglesCounted'], 5)
        self.assertEqual(result['zeroLengthOccurrencesCounted'], 3)

    def test_nonfinite_coordinates_and_invalid_indices_fail_closed(self):
        points = POINTS.copy()
        points[0, 0] = np.nan
        for positions, triangles in [(points, FACES), (POINTS, np.array([(0, 1, 99)])), (POINTS, FACES.astype(float))]:
            with self.subTest(triangles=triangles.tolist()):
                with self.assertRaises(ValueError):
                    closure(positions, triangles)


if __name__ == '__main__':
    unittest.main()
