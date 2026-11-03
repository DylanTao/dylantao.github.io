"""Keep sealed visual evidence byte-exact when source formatting changes."""
import base64
import gzip
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEWS = ROOT / "artwork/coastal-home/reviews"


class RestingReviewCustody(unittest.TestCase):
    def test_exporter_custody_preserves_the_qualified_programs_and_each_original_body(self):
        packet = REVIEWS / "geology-export-custody-2026-11-02"
        qualification = json.loads((packet / "QUALIFICATION.json").read_text(encoding="utf8"))
        for relative, row in qualification["code"].items():
            body = (ROOT / relative).read_bytes().replace(b"\r\n", b"\n")
            self.assertEqual(hashlib.sha256(body).hexdigest(), row["gitLfSha256"], relative)
        row = qualification["evidence"]
        stored = (packet / row["file"]).read_bytes()
        self.assertEqual(len(stored), row["bytes"])
        self.assertEqual(hashlib.sha256(stored).hexdigest(), row["sha256"])
        raw = gzip.decompress(stored)
        self.assertEqual(len(raw), row["uncompressedBytes"])
        evidence = json.loads(raw)
        self.assertEqual(len(evidence["files"]), row["fileCount"])
        seen = set()
        for payload in evidence["files"]:
            with self.subTest(payload=payload["path"]):
                relative = Path(payload["path"])
                self.assertFalse(relative.is_absolute())
                self.assertNotIn("..", relative.parts)
                self.assertNotIn(payload["path"], seen)
                seen.add(payload["path"])
                body = base64.b64decode(payload["base64"], validate=True)
                self.assertEqual(len(body), payload["bytes"])
                self.assertEqual(hashlib.sha256(body).hexdigest(), payload["sha256"])

    def test_committed_packets_keep_every_recorded_payload(self):
        packets = {
            "resting-wildlife-ci-2026-11-01": "MANIFEST.json",
            "contact-cpu-2026-11-01": "MANIFEST.json",
            "contact-regions-2026-11-01": "MANIFEST.json",
            "contact-regions-integration-2026-11-01": "MANIFEST.json",
            "contact-cpu-integration-2026-11-01": "MANIFEST.json",
            "contact-input-ci-2026-11-01": "MANIFEST.json",
            "gym-dashboard-2026-11-01": "MANIFEST.json",
            "gym-integration-2026-11-01": "MANIFEST.json",
            "gym-close-2026-11-01": "MANIFEST.json",
            "gym-pad-timing-2026-11-01": "MANIFEST.json",
            "startup-inspection-2026-11-01": "MANIFEST.json",
            "research-runner-2026-11-01": "MANIFEST.json",
            "research-deadline-2026-11-01": "MANIFEST.json",
            "research-schema-2026-11-01": "MANIFEST.json",
            "research-protocol-2026-11-01": "MANIFEST.json",
            "research-census-2026-11-02": "MANIFEST.json",
            "washi-material-2026-11-02": "MANIFEST.json",
            "garden-nook-seams-2026-11-02": "MANIFEST.json",
            "garden-native-2026-11-02": "MANIFEST.json",
            "camera-focus-2026-11-02": "MANIFEST.json",
            "exporter-integration-2026-11-02": "MANIFEST.json",
            "overlap-visibility-2026-11-02": "MANIFEST.json",
            "entrance-inspection-2026-11-02": "MANIFEST.json",
            "ci-runner-2026-11-02": "MANIFEST.json",
            "surface-roles-2026-11-02": "MANIFEST.json",
            "ci-exploration-2026-11-02": "MANIFEST.json",
            "exporter-holes-2026-11-01": "MANIFEST.json",
            "exterior-waterline-2026-11-01": "MANIFEST.json",
            "waterline-release-2026-11-01": "MANIFEST.json",
            "static-indices-rain-2026-11-01": "MANIFEST.json",
            "rain-contacts-2026-11-02": "MANIFEST.json",
            "ambience-integration-2026-11-02": "MANIFEST.json",
            "bedroom-ambience-2026-11-01": "MANIFEST.json",
            "nook-olive-2026-11-01": "MANIFEST.json",
            "rooms-menu-stacking-2026-11-01": "MANIFEST.json",
            "pinniped-contact-2026-11-01": "MANIFEST.json",
            "raccoon-body-contact-2026-11-01": "MANIFEST.json",
            "resting-wildlife-integration-2026-11-01": "MANIFEST.json",
            "visible-wildlife-release-2026-11-01": "payloads.json",
        }
        packets = {REVIEWS / folder: index for folder, index in packets.items()}
        packets[ROOT / "artwork/site-fidelity/reviews/metrics-pc-2026-11-01"] = "MANIFEST.json"
        packets[ROOT / "artwork/site-fidelity/reviews/nielsen-portfolio-2026-11-01"] = "MANIFEST.json"
        packets[ROOT / "artwork/site-fidelity/reviews/cv-navigation-2026-11-01"] = "MANIFEST.json"
        packets[ROOT / "artwork/coastal-home/research/temporal-reuse-2026-11-02"] = "MANIFEST.json"
        for base, index in packets.items():
            folder = base.name
            manifest = json.loads((base / index).read_text(encoding="utf8"))
            records = manifest.get("files", manifest.get("payloads"))
            self.assertTrue(records, folder)
            seen = set()
            for record in records:
                relative = record.get("path", record.get("file"))
                with self.subTest(packet=folder, payload=relative):
                    path = (base / relative).resolve()
                    self.assertTrue(path.is_relative_to(base.resolve()))
                    self.assertNotIn(relative, seen)
                    seen.add(relative)
                    data = path.read_bytes()
                    self.assertEqual(len(data), record.get("bytes", record.get("storedBytes")))
                    self.assertEqual(hashlib.sha256(data).hexdigest(), record.get("sha256", record.get("storedSha256")))
                    if record.get("encoding") == "gzip":
                        body = gzip.decompress(data)
                        self.assertEqual(len(body), record["bodyBytes"])
                        self.assertEqual(hashlib.sha256(body).hexdigest(), record["bodySha256"])


if __name__ == "__main__":
    unittest.main()
