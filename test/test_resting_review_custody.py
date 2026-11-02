"""Keep sealed visual evidence byte-exact when source formatting changes."""
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEWS = ROOT / "artwork/coastal-home/reviews"


class RestingReviewCustody(unittest.TestCase):
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
            "exporter-holes-2026-11-01": "MANIFEST.json",
            "exterior-waterline-2026-11-01": "MANIFEST.json",
            "waterline-release-2026-11-01": "MANIFEST.json",
            "static-indices-rain-2026-11-01": "MANIFEST.json",
            "rain-contacts-2026-11-02": "MANIFEST.json",
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
        for base, index in packets.items():
            folder = base.name
            records = json.loads((base / index).read_text(encoding="utf8"))["files"]
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
                    self.assertEqual(len(data), record["bytes"])
                    self.assertEqual(hashlib.sha256(data).hexdigest(), record["sha256"])


if __name__ == "__main__":
    unittest.main()
