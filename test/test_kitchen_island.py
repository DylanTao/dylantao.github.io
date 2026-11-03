import hashlib
import ast
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bin"))
import coastal_kitchen_island as island
from refresh_coastal_pavilion_breakfast import validate_paths


class KitchenIslandTests(unittest.TestCase):
    def test_fixed_east_and_rigid_props_are_distinct(self):
        low, high = [-3.035, 0, 5.995], [-1.865, .975, 8.505]
        self.assertEqual(island.displacement("kitchen__honed travertine", low, high, low), .15)
        self.assertEqual(island.displacement("kitchen__honed travertine", low, high, high), 0)
        for owner in ("kitchen__oatmeal glaze", "kitchen__meyer lemon"):
            self.assertEqual(island.displacement(owner, low, high, low), .075)
            self.assertEqual(island.displacement(owner, low, high, high), .075)
        self.assertEqual(island.displacement("kitchen__honey ash", [-2.64, .975, 7.35], [-2.26, 1.01, 7.85], low), .075)
        self.assertEqual(sum(row[0] for row in island.EXPECTED.values()), 83)
        self.assertEqual(sum(row[1] for row in island.EXPECTED.values()), 16372)

    def test_original_guard_domain_does_not_follow_new_builder_default(self):
        self.assertTrue(island.owned_bounds([-3.035, 0, 5.995], [-1.865, .975, 8.505]))
        self.assertFalse(island.owned_bounds([-4.5, 0, 5.995], [-4, .975, 8.505]))
        self.assertFalse(island.owned_bounds([-3.035, 0, 4.5], [-1.865, .975, 5.0]))
        self.assertFalse(island.owned_bounds([-3.035, 1.5, 5.995], [-1.865, 1.975, 8.505]))

    def test_fresh_builder_derives_all_prop_centres_from_the_new_bounds(self):
        tree = ast.parse((ROOT / "bin" / "coastal_kitchen.py").read_text(encoding="utf8"))
        island_node = next(n for n in tree.body if isinstance(n, ast.Assign)
                           and any(isinstance(t, ast.Name) and t.id == "ISLAND" for t in n.targets))
        self.assertEqual(ast.literal_eval(island_node.value)["x"], (-2.80, -1.95))
        builder = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "build_island")
        expressions = [ast.unparse(n) for n in ast.walk(builder) if isinstance(n, ast.BinOp)]
        # Both the cutting-board call and the bowl/fruit origin derive the
        # centre; an absolute old prop coordinate would break this contract.
        self.assertGreaterEqual(expressions.count("(x0 + x1) / 2"), 6)
        bx_by = next(n for n in ast.walk(builder) if isinstance(n, ast.Assign)
                     and isinstance(n.targets[0], ast.Tuple)
                     and all(isinstance(t, ast.Name) for t in n.targets[0].elts)
                     and [t.id for t in n.targets[0].elts] == ["bx", "by"])
        self.assertEqual(ast.unparse(bx_by.value.elts[0]), "(x0 + x1) / 2")

    def test_private_replay_fails_closed_and_never_replaces_failed_outputs(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source.blend"
            source.write_bytes(b"native source")
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            qa = root / ".jekyll-cache" / "visual-qa"
            output, report = qa / "candidate.blend", qa / "receipt.json"
            self.assertEqual(validate_paths(root, source, digest, output, report)[0], source)
            with self.assertRaises(ValueError):
                validate_paths(root, source, "0" * 64, output, report)
            with self.assertRaises(ValueError):
                validate_paths(root, source, digest, root / "artwork" / "coastal-home.blend", report)
            qa.mkdir(parents=True)
            output.write_bytes(b"retained failed candidate")
            with self.assertRaises(ValueError):
                validate_paths(root, source, digest, output, report)
            self.assertEqual(output.read_bytes(), b"retained failed candidate")
