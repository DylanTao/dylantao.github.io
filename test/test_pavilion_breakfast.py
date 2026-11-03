import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "bin" / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


footrest = load("coastal_pavilion_breakfast")
refresh = load("refresh_coastal_pavilion_breakfast")


class PavilionFootrestTests(unittest.TestCase):
    def test_exact_closed_budget_and_positive_supports(self):
        parts = footrest.parts()
        self.assertEqual([part["topology"]["triangles"] for part in parts], [28, 12, 12, 28])
        self.assertEqual(len(set(part["name"] for part in parts)), 4)
        for part in parts:
            self.assertEqual(part["topology"]["badDirectedEdges"], 0)
            self.assertGreater(part["topology"]["signedVolume"], 0)
            self.assertGreater(part["topology"]["minimumDoubleArea"], 0)
        self.assertEqual(footrest.TOP, .236)
        self.assertEqual(footrest.PAD_TOP, .575)
        self.assertEqual(sum(len(part["triangles"]) for part in parts), 80)
        self.assertAlmostEqual(6.86 - max(p[0] for part in parts for p in part["points"]), .02)

    def test_top_does_not_fill_the_existing_leg_slot(self):
        top = footrest.parts()[0]
        # The table's existing leg footprint lies wholly in the open U slot.
        for x in (6.3850269318, 6.47, 6.5550870895):
            for z in (-1.89, -1.80, -1.7500324249):
                at = (x, z)
                for face in footrest.triangulate_clockwise(footrest.PLAN):
                    self.assertFalse(footrest._inside_triangle(at, *(footrest.PLAN[i] for i in face)))
        self.assertEqual(len(top["triangles"]), 28)

    def test_native_rotation_and_bearing_embeds_are_explicit(self):
        self.assertEqual(footrest.native((1, 2, 3)), (1, -3, 2))
        for part in footrest.parts()[1:3]:
            ys = [p[2] for p in part["points"]]
            self.assertAlmostEqual(min(ys), footrest.FLOOR - .004)
            self.assertAlmostEqual(max(ys), footrest.BOTTOM + .006)

    def test_source_and_output_guards_preserve_failed_work(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp)
            source = repo / "pinned.blend"
            source.write_bytes(b"private explicit source control")
            sha = hashlib.sha256(source.read_bytes()).hexdigest()
            qa = repo / ".jekyll-cache" / "visual-qa"
            output, report = qa / "new.blend", qa / "receipt.json"
            self.assertEqual(refresh.validate_paths(repo, source, sha, output, report), (source, output, report))
            for bad in ("0" * 64, "bad", sha.upper()):
                with self.assertRaises(ValueError):
                    refresh.validate_paths(repo, source, bad, output, report)
            for bad_output in (source, repo / "artwork" / "master.blend", repo / "outside.blend"):
                with self.assertRaises(ValueError):
                    refresh.validate_paths(repo, source, sha, bad_output, report)
            qa.mkdir(parents=True)
            output.write_bytes(b"retained failed candidate")
            with self.assertRaises(ValueError):
                refresh.validate_paths(repo, source, sha, output, report)
            self.assertEqual(output.read_bytes(), b"retained failed candidate")


if __name__ == "__main__":
    unittest.main()
