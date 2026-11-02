"""The public sleep relocation must also move its diffuse-light region."""
import ast
import copy
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


def emit_bedchamber_region(config):
    """Replay only the owning pure metadata assignments, without loading Blender."""
    tree = ast.parse((ROOT / "bin/coastal_architecture_finish.py").read_text(encoding="utf8"))
    owner = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "adjacent_bedchamber")
    region = next(n for n in owner.body if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name) and n.targets[0].id == "region")
    light = next(n for n in owner.body if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Subscript) and isinstance(n.targets[0].value, ast.Name) and n.targets[0].value.id == "room" and isinstance(n.targets[0].slice, ast.Constant) and n.targets[0].slice.value == "lightRegion")
    room = next(r for r in config["rooms"] if r["id"] == "sleep")
    bounds = config["estateLibrary"]["adjacentBedchamber"]["bounds"]
    env = {"room": room, "floor": room["floor"], "x0": bounds["min"][0], "x1": bounds["max"][0], "z0": bounds["min"][2], "z1": bounds["max"][2]}
    code = compile(ast.Module(body=[region, light], type_ignores=[]), "owning-bedchamber-metadata", "exec")
    exec(code, {"__builtins__": {"list": list}}, env)
    return env


def emit_gallery_region(config):
    """Replay the pure gallery assignment owned by the native metadata finish."""
    tree = ast.parse((ROOT / "bin/coastal_retreat.py").read_text(encoding="utf8"))
    owner = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "finish_metadata")
    assignment = next(n for n in owner.body if isinstance(n, ast.Assign) and ast.unparse(n.targets[0]) == "rooms['library-upper']['lightRegion']")
    rooms = {room["id"]: room for room in config["rooms"]}
    code = compile(ast.Module(body=[assignment], type_ignores=[]), "owning-gallery-metadata", "exec")
    exec(code, {"__builtins__": {}}, {"rooms": rooms})
    return rooms["library-upper"]["lightRegion"]


class BedchamberLightRegionTests(unittest.TestCase):
    def setUp(self):
        self.baseline = json.loads((ROOT / "assets/models/home/manifest.json").read_text(encoding="utf8"))
        # Exercise the migration after it has landed in the product too. Keep
        # unrelated current fields, but restore the two pre-assignment cages.
        next(r for r in self.baseline["rooms"] if r["id"] == "sleep").pop("lightRegion", None)
        next(r for r in self.baseline["rooms"] if r["id"] == "library-upper")["lightRegion"] = {
            "min": [-1.65, 2.55, 10.25], "max": [1.3, 4.7, 12.55]
        }

    def test_current_product_region_replay_is_idempotent(self):
        config = json.loads((ROOT / "assets/models/home/manifest.json").read_text(encoding="utf8"))
        before = copy.deepcopy(config)
        emit_bedchamber_region(config)
        emit_gallery_region(config)
        self.assertEqual(config, before)

    def test_region_tracks_the_actual_public_sleep_frame(self):
        config = copy.deepcopy(self.baseline)
        env = emit_bedchamber_region(config)
        actual = env["room"]["lightRegion"]
        self.assertEqual(actual, {"min": [-8.53, 1.45, 3.3], "max": [-5.15, 5.25, 8.62]})
        self.assertEqual(actual, config["installationReceivers"]["groups"]["bedchamber"])
        for point in [env["room"]["actor"], env["room"]["walkActor"], env["room"]["bedTransfer"]["seat"]["position"]]:
            self.assertTrue(all(actual["min"][i] <= point[i] <= actual["max"][i] for i in range(3)), point)
        self.assertIsNot(actual["min"], env["region"]["min"])
        self.assertIsNot(actual["max"], env["region"]["max"])

    def test_metadata_replay_changes_no_other_room_fixture_or_schedule(self):
        config = copy.deepcopy(self.baseline)
        emit_bedchamber_region(config)
        room = next(r for r in config["rooms"] if r["id"] == "sleep")
        region = room.pop("lightRegion")
        self.assertEqual(config, self.baseline)
        self.assertNotEqual(region["min"], [-4.3, 2.55, 10])

    def test_actual_runtime_replaces_one_region_without_adding_a_seventeenth(self):
        candidate = copy.deepcopy(self.baseline)
        emit_bedchamber_region(candidate)
        url = (ROOT / "assets/js/home-scene/static-light-field.mjs").as_uri()
        script = f'import {{ staticLightRegions }} from {json.dumps(url)}; let text=""; for await(const part of process.stdin)text+=part; console.log(JSON.stringify(JSON.parse(text).map(staticLightRegions)));'
        result = subprocess.run(["node", "--input-type=module", "-e", script], input=json.dumps([self.baseline, candidate]), text=True, capture_output=True, timeout=30, check=True)
        baseline, actual = json.loads(result.stdout)
        self.assertEqual(len(actual), 16)
        self.assertEqual(len(actual) * 8, 128)
        self.assertEqual([r["id"] for r in actual], [r["id"] for r in baseline])
        self.assertEqual([a["id"] for a, b in zip(actual, baseline) if a != b], ["sleep"])
        self.assertEqual(next(r for r in actual if r["id"] == "sleep")["min"], [-8.53, 1.45, 3.3])

    def test_gallery_preserves_both_original_occupied_loft_envelopes(self):
        config = copy.deepcopy(self.baseline)
        original = next(r for r in config["rooms"] if r["id"] == "library-upper")["lightRegion"]
        actual = emit_gallery_region(config)
        self.assertEqual(actual, {"min": [-4.3, 2.55, 10.0], "max": [1.3, 4.7, 12.8]})
        # A containing AABB also preserves its monotone 25 cm support skirt.
        # Check complete bounds, rather than relying on sampled room vertices.
        for region in [original, {"min": [-4.3, 2.55, 10.0], "max": [-1.85, 4.4, 12.8]}]:
            self.assertTrue(all(actual["min"][i] <= region["min"][i] and actual["max"][i] >= region["max"][i] for i in range(3)))
        next(r for r in config["rooms"] if r["id"] == "library-upper")["lightRegion"] = original
        self.assertEqual(config, self.baseline)

    def test_combined_metadata_replaces_only_two_of_sixteen_regions(self):
        candidate = copy.deepcopy(self.baseline)
        emit_bedchamber_region(candidate)
        emit_gallery_region(candidate)
        url = (ROOT / "assets/js/home-scene/static-light-field.mjs").as_uri()
        script = f'import {{ staticLightRegions }} from {json.dumps(url)}; let text=""; for await(const part of process.stdin)text+=part; console.log(JSON.stringify(JSON.parse(text).map(staticLightRegions)));'
        result = subprocess.run(["node", "--input-type=module", "-e", script], input=json.dumps([self.baseline, candidate]), text=True, capture_output=True, timeout=30, check=True)
        baseline, actual = json.loads(result.stdout)
        self.assertEqual(len(actual), 16)
        self.assertEqual(len(actual) * 8, 128)
        self.assertEqual([r["id"] for r in actual], [r["id"] for r in baseline])
        self.assertEqual([a["id"] for a, b in zip(actual, baseline) if a != b], ["sleep", "library-upper"])


if __name__ == "__main__":
    unittest.main()
