import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


SPEC = importlib.util.spec_from_file_location("coastal_output_validator", Path(__file__).with_name("validate_publication_outputs.py"))
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


class CoastalCacheOutputTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.site = Path(self.temp.name)
        self.home = self.site / "assets" / "models" / "home"
        self.home.mkdir(parents=True)
        self.body = b'{"version":1,"signature":"source"}\n'
        (self.home / "static-light-field.json").write_bytes(self.body)
        self.descriptor = {"url": "static-light-field.json", "signature": "source", "sha256": hashlib.sha256(self.body).hexdigest()}
        self.write_manifest()

    def write_manifest(self):
        (self.home / "manifest.json").write_text(json.dumps({"staticLightFieldCache": self.descriptor}), encoding="utf-8")

    def test_exact_built_bytes_pass(self):
        VALIDATOR.validate_coastal_cache(self.site)

    def test_packed_snapshot_preserves_built_byte_and_signature_contract(self):
        for version in (2, 3):
            with self.subTest(version=version):
                self.body = json.dumps({"version": version, "signature": "source", "transport": "AAAA", "moments": "AAAA"}).encode()
                (self.home / "static-light-field.json").write_bytes(self.body)
                self.descriptor["sha256"] = hashlib.sha256(self.body).hexdigest()
                self.write_manifest()
                VALIDATOR.validate_coastal_cache(self.site)

    def test_unknown_snapshot_version_fails_even_with_matching_digest(self):
        self.body = b'{"version":999,"signature":"source"}\n'
        (self.home / "static-light-field.json").write_bytes(self.body)
        self.descriptor["sha256"] = hashlib.sha256(self.body).hexdigest()
        self.write_manifest()
        with self.assertRaisesRegex(AssertionError, "unsupported snapshot version"):
            VALIDATOR.validate_coastal_cache(self.site)

    def test_minifier_removing_final_newline_fails(self):
        (self.home / "static-light-field.json").write_bytes(self.body.rstrip())
        with self.assertRaisesRegex(AssertionError, "bytes changed"):
            VALIDATOR.validate_coastal_cache(self.site)

    def test_lounge_sunlight_keeps_its_signed_bytes_and_geometry(self):
        sunlight = b'{"geometryFingerprint":"house"}\n'
        self.body = b'{"version":3,"signature":"source","loungeSolarGeometry":"house"}\n'
        (self.home / "static-light-field.json").write_bytes(self.body)
        room = self.home / "lounge-solar.json"
        room.write_bytes(sunlight)
        self.descriptor.update(
            sha256=hashlib.sha256(self.body).hexdigest(),
            loungeSolar=room.name,
            loungeSolarGeometry="house",
            loungeSolarSha256=hashlib.sha256(sunlight).hexdigest(),
        )
        self.write_manifest()
        VALIDATOR.validate_coastal_cache(self.site)
        room.write_bytes(sunlight.rstrip())
        with self.assertRaisesRegex(AssertionError, "sunlight bytes changed"):
            VALIDATOR.validate_coastal_cache(self.site)
        self.descriptor["loungeSolarSha256"] = hashlib.sha256(room.read_bytes()).hexdigest()
        self.descriptor["loungeSolarGeometry"] = "old house"
        self.write_manifest()
        with self.assertRaisesRegex(AssertionError, "sunlight geometry"):
            VALIDATOR.validate_coastal_cache(self.site)

    def test_different_source_signature_fails(self):
        self.descriptor["signature"] = "different"
        self.write_manifest()
        with self.assertRaisesRegex(AssertionError, "signature"):
            VALIDATOR.validate_coastal_cache(self.site)

    def test_missing_cache_fails(self):
        (self.home / "static-light-field.json").unlink()
        with self.assertRaises(FileNotFoundError):
            VALIDATOR.validate_coastal_cache(self.site)


if __name__ == "__main__":
    unittest.main()
