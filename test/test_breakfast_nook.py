import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("coastal_breakfast_nook", ROOT / "bin/coastal_breakfast_nook.py")
nook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nook)


class BreakfastNookTests(unittest.TestCase):
    def baseline(self):
        return json.loads((ROOT / "assets/models/home/manifest.json").read_text(encoding="utf-8"))

    def test_portal_quantization_margin_preserves_retained_header_and_slab(self):
        low, high = nook.BOXES["portal"]
        self.assertEqual((low[2], high[2]), (3.9715962409973145, 5.2690815925598145))
        self.assertEqual(high[2] - low[2], 1.2974853515625)
        self.assertGreaterEqual(high[2] - low[2], 1.28)
        self.assertEqual((low[1], high[1]), (-1.18, 1.12))
        self.assertEqual((low[2], high[2]), (nook.BOXES["stairs"][0][2], nook.BOXES["stairs"][1][2]))
        self.assertNotIn("core_finish_bedchamber_slab", nook.OWNER_BOXES)

    def test_metadata_changes_only_the_measured_owning_placements(self):
        before = self.baseline()
        actual = copy.deepcopy(before)
        plan = nook.apply_placement(actual)
        self.assertEqual(next(r for r in actual["rooms"] if r["id"] == "kitchen")["floor"], 0)
        self.assertEqual(plan["tableY"] - plan["seatY"], .28)
        self.assertEqual(plan["actor"], [-7.19, -1.075, 5.71])
        self.assertEqual(len(actual["furniture"]), len(before["furniture"]) - 1)
        self.assertEqual(len(actual["lightTransportRegions"]), len(before["lightTransportRegions"]) + 1)
        # Undo precisely the leased keys, then demand the entire unrelated manifest exact.
        restore = copy.deepcopy(actual)
        original_rooms = {r["id"]: r for r in before["rooms"]}
        for room in restore["rooms"]:
            if room["id"] == "kitchen":
                for key in ("actor", "target", "exitPath", "breakfastNook", "practicalSource", "egress", "camera"):
                    if key in original_rooms["kitchen"]:
                        room[key] = copy.deepcopy(original_rooms["kitchen"][key])
                    else:
                        room.pop(key, None)
            if room["id"] == "library":
                room["lightRegion"] = copy.deepcopy(original_rooms["library"]["lightRegion"])
        for key in ("furniture", "wallArt", "interiorLights", "lightTransportRegions"):
            restore[key] = copy.deepcopy(before[key])
        restore["terrain"]["supportSurfaces"] = copy.deepcopy(before["terrain"]["supportSurfaces"])
        restore["terrain"]["contacts"]["kitchen"] = copy.deepcopy(before["terrain"]["contacts"]["kitchen"])
        restore["equipment"]["coffee"] = copy.deepcopy(before["equipment"]["coffee"])
        self.assertEqual(restore, before)
        room = next(r for r in actual["rooms"] if r["id"] == "kitchen")
        self.assertEqual(room["camera"]["envelope"], original_rooms["kitchen"]["camera"]["envelope"])
        self.assertEqual(actual["terrain"]["contacts"]["kitchen"]["exitPath"], room["exitPath"])
        self.assertEqual(actual["equipment"]["coffee"]["walkPath"][0], room["actor"])
        with self.assertRaises(RuntimeError):
            nook.apply_placement(actual)

    def test_old_study_is_contained_at_actual_binary64_bounds(self):
        c = self.baseline()
        nook.apply_placement(c)
        room = next(r for r in c["rooms"] if r["id"] == "kitchen")
        old = room["breakfastNook"]["replacedStudy"]
        library = next(r for r in c["rooms"] if r["id"] == "library")["lightRegion"]
        self.assertEqual(old["min"][1], 2.55 - 2.6)
        self.assertEqual(old["max"][2], 4.55 + 8 - 6.7)
        for axis in range(3):
            self.assertLessEqual(library["min"][axis], old["min"][axis])
            self.assertGreaterEqual(library["max"][axis], old["max"][axis])
        # The real backrest is atZ5.83; lower high-Z probes must clear it.
        cage = nook.LIGHT_REGION
        high_z = cage["min"][2] + .75 * (cage["max"][2] - cage["min"][2])
        self.assertLess(high_z, 5.83 - .02)

    def test_changed_original_owners_fail_closed(self):
        for edit in (lambda c: c["rooms"].__setitem__(next(i for i,r in enumerate(c["rooms"]) if r["id"] == "kitchen"), {"id":"kitchen","actor":[0,0,0],"floor":0}),
                     lambda c: c["furniture"].clear(),
                     lambda c: c["interiorLights"].__setitem__("pendant",[0,0,0]),
                     lambda c: c["lightTransportRegions"].append({"id":"other","replaces":"study"})):
            c = self.baseline(); edit(c)
            with self.assertRaises(RuntimeError): nook.apply_placement(c)
        self.assertNotIn("core_finish_bedchamber_slab", nook.OWNER_BOXES)
        self.assertEqual(nook.OWNER_BOXES["core_finish_bedchamber_rock_fin__La Jolla bluff sandstone"], ("portal",))

    def test_replay_requires_exact_source_and_new_private_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); source = root / "source.blend"; source.write_bytes(b"immutable input")
            manifest = root / "manifest.json"; manifest.write_text("{}",encoding="utf-8")
            sha = hashlib.sha256(source.read_bytes()).hexdigest()
            output = root / ".jekyll-cache/visual-qa/new-trial"
            nook.validate_replay_paths(root,source,sha,manifest,output)
            self.assertFalse(output.exists())
            for bad in (root,root/"assets/models/home",root/".jekyll-cache/visual-qa"):
                with self.assertRaises(ValueError): nook.validate_replay_paths(root,source,sha,manifest,bad)
            with self.assertRaises(ValueError): nook.validate_replay_paths(root,source,"0"*64,manifest,output)
            output.mkdir(parents=True)
            with self.assertRaises(ValueError): nook.validate_replay_paths(root,source,sha,manifest,output)
            self.assertEqual(source.read_bytes(),b"immutable input")


if __name__ == "__main__":
    unittest.main()
