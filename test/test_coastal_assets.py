"""Check the actual GLB deliverables, not the authoring script's spelling."""

from pathlib import Path
import gzip
import json
import struct
import unittest

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets/models/home"
MANIFEST = json.loads((ASSETS / "manifest.json").read_text(encoding="utf-8"))


def glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<III", data)
    assert magic == 0x46546C67 and version == 2 and length == len(data)
    json_length, chunk_type = struct.unpack_from("<II", data, 12)
    assert chunk_type == 0x4E4F534A
    return json.loads(data[20 : 20 + json_length])


class CoastalAssetsTest(unittest.TestCase):
    def test_each_avatar_has_an_actual_blender_study_and_one_shared_wall_print(self):
        for avatar in MANIFEST["avatars"]:
            data = (
                ROOT / "artwork/coastal-home/portraits" / (avatar["id"] + ".png")
            ).read_bytes()
            self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
            self.assertEqual(struct.unpack_from(">II", data, 16), (384, 480))
        self.assertEqual(
            (ASSETS / MANIFEST["wallArt"]["file"]).resolve(),
            (ROOT / "assets/img/home/sirui_capy.jpg").resolve(),
        )
        self.assertEqual(
            (ASSETS / MANIFEST["wallArt"]["file"]).read_bytes()[:2], b"\xff\xd8"
        )

    def test_every_export_and_editable_source_exists(self):
        self.assertEqual(len(MANIFEST["rooms"]), 6)
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

    def test_all_five_characters_are_skinned_with_ten_nonempty_clips(self):
        required = {
            "idle",
            "walk",
            "typing",
            "reading",
            "eat",
            "drink",
            "workout",
            "soak",
            "lounge",
            "sleep",
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
            else:
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

    def test_first_scene_compressed_budget_includes_engine_and_selected_avatar(self):
        runtime = list((ROOT / "assets/js/home-scene").glob("*.mjs"))
        runtime += list((ROOT / "assets/js/vendor/three-r164").rglob("*.js"))
        runtime += [
            ROOT / "assets/js/three.module.min.js",
            ROOT / "assets/models/home/coast.glb",
            ASSETS / "manifest.json",
            ROOT / "assets/img/home/coastal-vignette.svg",
        ]
        base = sum(len(gzip.compress(p.read_bytes())) for p in runtime)
        base += len(gzip.compress((ASSETS / MANIFEST["shell"]).read_bytes()))
        base += len(gzip.compress((ASSETS / MANIFEST["wallArt"]["file"]).read_bytes()))
        base += sum(
            p.stat().st_size
            for p in (ROOT / "assets/js/vendor/three-r164").rglob("*.wasm")
        )
        largest_room = max(
            len(gzip.compress((ASSETS / r["file"]).read_bytes()))
            for r in MANIFEST["rooms"]
        )
        largest_actor = max(
            len(gzip.compress((ASSETS / a["file"]).read_bytes()))
            for a in MANIFEST["avatars"]
        )
        self.assertLess(base + largest_room + largest_actor, 4 * 1024 * 1024)

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
