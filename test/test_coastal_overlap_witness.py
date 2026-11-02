"""Finite overlap witnesses must belong to the two surfaces being inspected."""
import ast
import math
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
tree = ast.parse((ROOT / 'bin/audit_coastal_overlaps.py').read_text(encoding='utf8'))
names = {'_clip_polygon', '_clip_area_centroid', '_clip_area'}
functions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
assert len(functions) == 3
namespace = {}
exec(compile(ast.Module(body=functions, type_ignores=[]), '<finite-overlap-functions>', 'exec'), namespace)
clip = namespace['_clip_area_centroid']


class CoastalOverlapWitness(unittest.TestCase):
    def test_small_corner_overlap_has_a_witness_in_both_triangles(self):
        a = [(0, 0), (4, 0), (0, 4)]
        b = [(3.5, 0), (4.5, 0), (3.5, 1)]
        area, point = clip(a, b)
        self.assertAlmostEqual(area, .125)
        self.assertAlmostEqual(point[0], 11 / 3)
        self.assertAlmostEqual(point[1], 1 / 6)
        self.assertGreaterEqual(point[0], 3.5)
        self.assertLessEqual(sum(point), 4)
        # The old mean of whole-triangle centroids is outside B; using it can
        # ask a different wall or floor whether this intersection is covered.
        old_x = (sum(p[0] for p in a) + sum(p[0] for p in b)) / 6
        self.assertLess(old_x, 3.5)

    def test_winding_vertex_start_and_source_order_do_not_move_the_witness(self):
        a, b = [(0, 0), (4, 0), (0, 4)], [(3.5, 0), (4.5, 0), (3.5, 1)]
        expected = clip(a, b)
        for reverse_a in (False, True):
            for reverse_b in (False, True):
                for k in range(3):
                    aa, bb = a[::-1] if reverse_a else a, b[::-1] if reverse_b else b
                    for first, second in ((aa[k:] + aa[:k], bb), (bb, aa[k:] + aa[:k])):
                        area, point = clip(first, second)
                        self.assertAlmostEqual(area, expected[0])
                        for actual, wanted in zip(point, expected[1]):
                            self.assertAlmostEqual(actual, wanted)

    def test_disjoint_and_edge_only_contacts_have_no_area_witness(self):
        a = [(0, 0), (1, 0), (0, 1)]
        for b in ([(2, 2), (3, 2), (2, 3)], [(1, 0), (2, 0), (1, 1)]):
            self.assertEqual(clip(a, b), (0, None))

    def test_far_translated_identical_triangle_retains_its_centroid(self):
        a = [(100, -200), (104, -200), (100, -196)]
        area, point = clip(a, a)
        self.assertAlmostEqual(area, 8)
        self.assertAlmostEqual(point[0], 100 + 4 / 3)
        self.assertAlmostEqual(point[1], -200 + 4 / 3)
        self.assertTrue(all(math.isfinite(v) for v in point))


if __name__ == '__main__':
    unittest.main()
