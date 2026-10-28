"""Check the actual GLB deliverables, not the authoring script's spelling."""

from pathlib import Path
import gzip
import json
import struct
import unittest
import os

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(os.environ.get("COASTAL_MODELS_ROOT", ROOT / "assets/models/home")).resolve()
MANIFEST = json.loads((ASSETS / "manifest.json").read_text(encoding="utf-8"))


def asset_path(name):
    # A candidate models directory can live under ignored QA storage while
    # unchanged images still belong to the site's canonical assets tree.
    return (ROOT / "assets/models/home" / name) if name.startswith("../") else ASSETS / name


def glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<III", data)
    assert magic == 0x46546C67 and version == 2 and length == len(data)
    json_length, chunk_type = struct.unpack_from("<II", data, 12)
    assert chunk_type == 0x4E4F534A
    return json.loads(data[20 : 20 + json_length])


class CoastalAssetsTest(unittest.TestCase):
    def test_exported_room_anchors_match_the_two_storey_runtime(self):
        shell = glb(ASSETS / MANIFEST["shell"])
        anchors = {
            n["name"]: n.get("translation", [0, 0, 0])
            for n in shell["nodes"]
            if n["name"].startswith("anchor_")
        }
        expected_floors = {0, 1.5, 2.6} if MANIFEST.get("estateLibrary", {}).get("adjacentBedchamber") else {0, 2.6}
        self.assertEqual({r["floor"] for r in MANIFEST["rooms"]}, expected_floors)
        for room in MANIFEST["rooms"]:
            for actual, expected in zip(anchors["anchor_" + room["id"]], room["actor"]):
                self.assertAlmostEqual(actual, expected, places=5)
        self.assertTrue(
            any(n.get("extras", {}).get("caveRoof") for n in shell["nodes"])
        )

    def test_each_avatar_has_an_actual_blender_study_and_one_shared_wall_print(self):
        for avatar in MANIFEST["avatars"]:
            data = (
                ROOT / "artwork/coastal-home/portraits" / (avatar["id"] + ".png")
            ).read_bytes()
            self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
            self.assertEqual(struct.unpack_from(">II", data, 16), (384, 480))
        self.assertEqual(
            asset_path(MANIFEST["wallArt"]["file"]).resolve(),
            (ROOT / "assets/img/home/sirui_capy.jpg").resolve(),
        )
        self.assertEqual(
            asset_path(MANIFEST["wallArt"]["file"]).read_bytes()[:2], b"\xff\xd8"
        )

    def test_every_export_and_editable_source_exists(self):
        self.assertEqual(
            {room["id"] for room in MANIFEST["rooms"]},
            {"study", "sleep", "kitchen", "gym", "onsen", "lounge", "bath-living", "bath-bedroom", "library", "library-upper"},
        )
        for entry in MANIFEST["rooms"] + MANIFEST["avatars"]:
            asset = glb(ASSETS / entry["file"])
            self.assertGreater(len(asset["meshes"]), 0)
            self.assertTrue(
                all(
                    "POSITION" in p["attributes"]
                    for m in asset["meshes"]
                    for p in m["primitives"]
                )
            )
        self.assertTrue((ROOT / "artwork/coastal-home/coastal-home.blend").is_file())

    def test_all_five_characters_have_contact_and_daily_activity_clips(self):
        required = {
            "idle",
            "walk",
            "typing",
            "reading",
            "eat",
            "drink",
            "workout",
            "pullup",
            "dip",
            "coffee-prep",
            "carry",
            "soak",
            "lounge",
            "sleep",
        }
        finger_joints = {
            f"Hand.Finger.{digit}.{segment}.{side}"
            for digit in ("0", "1", "2", "3", "thumb")
            for segment in (0, 1)
            for side in ("L", "R")
        }
        conventions = []
        for avatar in MANIFEST["avatars"]:
            data = glb(ASSETS / avatar["file"])
            self.assertEqual({a["name"] for a in data["animations"]}, required)
            self.assertTrue(data["skins"])
            names = {data["nodes"][n]["name"] for n in data["skins"][0]["joints"]}
            if avatar["id"] == "lizard":
                self.assertIn("Tail", names)
                self.assertIn("TailTip", names)
                names -= {"Tail", "TailTip"}
            if "gripWristOffsets" in avatar:
                self.assertEqual(avatar["id"], "ghibli")
                self.assertEqual(set(avatar["gripWristOffsets"]), {"pullup", "dip"})
                self.assertTrue(finger_joints <= names)
                names -= finger_joints
            conventions.append(names)
            for clip in data["animations"]:
                self.assertGreater(len(clip["channels"]), 5)
                self.assertTrue(
                    any(
                        data["accessors"][s["input"]]["count"] > 2
                        for s in clip["samplers"]
                    )
                )
            self.assertTrue(
                (
                    ROOT
                    / "artwork/coastal-home"
                    / (Path(avatar["file"]).stem + ".blend")
                ).is_file()
            )
        self.assertTrue(all(c == conventions[0] for c in conventions))

    def test_complete_first_scene_budget_includes_all_rooms_furniture_and_selected_avatar(self):
        # Pages serves the unchanged Draco WASM as gzip too (verified response/body hash in
        # reviews/pc-quality-2026-10-26/wasm-transfer.json). Count a level-six transfer consistently
        # for every input; the four-MiB ceiling is unchanged. This is not allocated/decoded memory.
        def transfer_size(path):
            return len(gzip.compress(path.read_bytes(), compresslevel=6))

        runtime = list((ROOT / "assets/js/home-scene").glob("*.mjs"))
        runtime += list((ROOT / "assets/js/vendor/three-r164").rglob("*.js"))
        runtime += [
            ROOT / "assets/js/three.module.min.js",
            ASSETS / "coast.glb",
            ASSETS / "manifest.json",
            ROOT / "assets/img/home/coastal-vignette.svg",
        ]
        base = sum(transfer_size(p) for p in runtime)
        base += transfer_size(ASSETS / MANIFEST["shell"])
        base += transfer_size(asset_path(MANIFEST["wallArt"]["file"]))
        base += sum(
            transfer_size(p)
            for p in (ROOT / "assets/js/vendor/three-r164").rglob("*.wasm")
        )
        all_rooms = sum(
            transfer_size(ASSETS / r["file"])
            for r in MANIFEST["rooms"]
        )
        largest_actor = max(
            transfer_size(ASSETS / a["file"])
            for a in MANIFEST["avatars"]
        )
        furniture = json.loads((ASSETS / "furniture/index.json").read_text(encoding="utf-8"))
        # An anchor whose item has not landed yet streams nothing (its room placeholder stands in).
        default_models = {
            furniture["items"][anchor["item"]]["lods"][0]["file"]
            for anchor in MANIFEST["furniture"]
            if anchor["item"] in furniture["items"]
        }
        defaults = sum(transfer_size(ASSETS / "furniture" / name) for name in default_models)
        auxiliary = sum(
            transfer_size(ASSETS / name)
            for name in ("furniture/index.json", "loading-sketch.json", MANIFEST["staticLightFieldCache"]["url"])
        )
        # The loading sketch's index carries the coast view; a load adds only its arrival room's drawing.
        auxiliary += max(transfer_size(path) for path in (ASSETS / "loading-sketch").glob("*.json"))
        self.assertLess(base + all_rooms + largest_actor + defaults + auxiliary, 4 * 1024 * 1024)

    def test_mesh_compression_is_shipped_and_has_a_local_decoder(self):
        for entry in MANIFEST["rooms"] + MANIFEST["avatars"]:
            self.assertIn(
                "KHR_draco_mesh_compression",
                glb(ASSETS / entry["file"])["extensionsRequired"],
            )
        self.assertTrue(
            (
                ROOT / "assets/js/vendor/three-r164/libs/draco/draco_decoder.wasm"
            ).is_file()
        )

    def test_routine_and_room_references_are_complete(self):
        rooms = {r["id"] for r in MANIFEST["rooms"]}
        for schedule in (MANIFEST["weekday"], MANIFEST["weekend"]):
            self.assertEqual(schedule[0][0], 0)
            self.assertEqual([s[0] for s in schedule], sorted({s[0] for s in schedule}))
            for _, activity in schedule:
                self.assertIn(MANIFEST["activities"][activity]["room"], rooms)
        self.assertEqual(MANIFEST["timeZone"], "America/Los_Angeles")
