import importlib.util
import pathlib
import types
import unittest


spec = importlib.util.spec_from_file_location(
    "water_precision", pathlib.Path(__file__).parents[1] / "bin/coastal_water_export_precision.py"
)
water = importlib.util.module_from_spec(spec)
spec.loader.exec_module(water)


class WaterExportPrecisionTests(unittest.TestCase):
    def test_only_water_receives_copied_precision_settings(self):
        calls = []

        def original(primitive, dll, export_settings, encoded_primitives_cache):
            calls.append((primitive, dll, export_settings, encoded_primitives_cache))
            return "encoded"

        records = []
        encode = water.precision_encoder(original, records)
        settings = {"gltf_draco_position_quantization": 14, "gltf_draco_normal_quantization": 8, "color": 6}
        dll, cache = object(), {}
        for name in ("warm sandstone bedding", None, *sorted(water.WATER_MATERIALS)):
            primitive = types.SimpleNamespace(material=types.SimpleNamespace(name=name))
            self.assertEqual(encode(primitive, dll, settings, cache), "encoded")
            actual = calls[-1]
            self.assertIs(actual[0], primitive)
            self.assertIs(actual[1], dll)
            self.assertIs(actual[3], cache)
            if name in water.WATER_MATERIALS:
                self.assertIsNot(actual[2], settings)
                self.assertEqual(actual[2], {**settings, "gltf_draco_position_quantization": 18,
                                             "gltf_draco_normal_quantization": 10})
            else:
                self.assertIs(actual[2], settings)
        self.assertEqual(settings["gltf_draco_position_quantization"], 14)
        self.assertEqual(settings["gltf_draco_normal_quantization"], 8)
        self.assertEqual(len(records), 2)

    def test_unexpected_sdk_signature_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "signature changed"):
            water.precision_encoder(lambda primitive: None, [])
