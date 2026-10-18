"""Check the shipped hinterland (bin/build_coastal_hinterland.py): the land beyond the mainland's
walls, its planting, lookout, gliderport, wind sock and gliders."""

from pathlib import Path
import json
import re
import struct
import unittest

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets/models/home"
MANIFEST = json.loads((ASSETS / "manifest.json").read_text(encoding="utf-8"))
ENTRY = MANIFEST.get("hinterland")


def glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<III", data)
    assert magic == 0x46546C67 and version == 2 and length == len(data)
    json_length, chunk_type = struct.unpack_from("<II", data, 12)
    assert chunk_type == 0x4E4F534A
    return json.loads(data[20 : 20 + json_length])


@unittest.skipUnless(ENTRY, "the manifest has no hinterland")
class CoastalHinterlandTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = ASSETS / ENTRY["file"]
        cls.gltf = glb(cls.path)

    def primitives(self):
        for node in self.gltf["nodes"]:
            if "mesh" in node:
                for primitive in self.gltf["meshes"][node["mesh"]]["primitives"]:
                    yield node, primitive

    def test_compressed_bounded_and_streamed_after_the_first_scene(self):
        self.assertIn("KHR_draco_mesh_compression", self.gltf["extensionsRequired"])
        self.assertLess(self.path.stat().st_size, 1_700_000)
        triangles = sum(self.gltf["accessors"][p["indices"]]["count"] // 3 for _, p in self.primitives())
        self.assertLess(triangles, 240_000)
        first_scene = {MANIFEST["shell"], MANIFEST["coast"]} | {r["file"] for r in MANIFEST["rooms"]} | {a["file"] for a in MANIFEST["avatars"]}
        self.assertNotIn(ENTRY["file"], first_scene)
        self.assertTrue((ROOT / "artwork/coastal-home/hinterland.blend").is_file())

    def test_every_primitive_carries_its_baked_colour(self):
        # Without COLOR_0 the white-based ground and scrub would render white.
        for node, primitive in self.primitives():
            self.assertIn("COLOR_0", primitive["attributes"], node["name"])
            self.assertIn("NORMAL", primitive["attributes"], node["name"])

    def test_the_land_reaches_well_past_the_mainland_on_three_sides(self):
        lo = [float("inf")] * 3
        hi = [float("-inf")] * 3
        for node, primitive in self.primitives():
            accessor = self.gltf["accessors"][primitive["attributes"]["POSITION"]]
            t = node.get("translation", [0, 0, 0])
            for axis in range(3):
                lo[axis] = min(lo[axis], accessor["min"][axis] + t[axis])
                hi[axis] = max(hi[axis], accessor["max"][axis] + t[axis])
        # Browser axes: x north, y up, z inland. The mainland spans x -36..76 and z up to 32.
        self.assertLess(lo[0], -400)
        self.assertGreater(hi[0], 400)
        self.assertGreater(hi[2], 400)
        self.assertGreater(hi[1], 40, "a hill closes the view inland")

    def test_named_nodes_for_the_wind_sock_and_gliders(self):
        nodes = {n["name"]: n for n in self.gltf["nodes"]}
        sock = ENTRY["windsock"]
        self.assertIn(sock["node"], nodes)
        self.assertIn(sock["mast"], nodes)
        self.assertTrue(nodes[sock["node"]].get("extras", {}).get("windsock"))
        for glider in ENTRY["gliders"]:
            self.assertIn(glider["node"], nodes)
            self.assertTrue(nodes[glider["node"]].get("extras", {}).get("glider"))
            self.assertGreaterEqual(len(glider["route"]), 8)
            self.assertTrue(5 < glider["speed"] < 16)
        kinds = {g["kind"] for g in ENTRY["gliders"]}
        self.assertEqual(kinds, {"paraglider", "hang-glider"})

    def test_material_names_route_to_the_intended_shading(self):
        # realism.mjs matches substrings: "ash" in "wash" would get wood grain, "leaf" a breeze.
        unintended = re.compile(r"oak|ash|walnut|linen|textile|cotton|woven|leaf|foliage|water", re.I)
        for material in self.gltf["materials"]:
            name = material["name"]
            if name.endswith(" wood"):
                continue
            self.assertIsNone(unintended.search(name), name)

    def test_camera_grid_shares_the_retained_lattice(self):
        grid = ENTRY["cameraGrid"]
        retained = MANIFEST["cameraCollision"]
        self.assertEqual(grid["step"], retained["step"])
        self.assertEqual(len(grid["elevations"]), grid["width"] * grid["height"])
        for axis in (0, 1):
            offset = (retained["origin"][axis] - grid["origin"][axis]) / grid["step"]
            self.assertEqual(offset, round(offset))
            self.assertGreaterEqual(offset, 0)
        self.assertGreaterEqual(grid["width"], retained["width"])
        self.assertGreaterEqual(grid["height"], retained["height"])
        self.assertGreaterEqual(min(grid["elevations"]), -7.35)


if __name__ == "__main__":
    unittest.main()
