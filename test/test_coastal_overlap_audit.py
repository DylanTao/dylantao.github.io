"""The committed house overlap audit binds what ships and holds its regression thresholds.

``bin/audit_coastal_overlaps.py`` needs Blender, which CI lacks. The compact report it feeds
(``bin/summarize_coastal_overlaps.py``) is committed instead and bound by SHA-256 to the native
source, every delivered house GLB and the audit tool itself; the streamed furniture it placed is
recorded. Re-exporting house geometry without re-auditing therefore fails here, and the
thresholds below ratchet: they may be lowered after repairs, never raised to admit new overlaps.
Delivered Draco checks of the repaired families live in test/coastal-overlap-delivered.test.mjs.
"""
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "artwork/coastal-home/reviews/house-2026-10-24"
MODELS = ROOT / "assets/models/home"

# Ratchet, from the October 24 repaired audit (before repairs: 105.18 m2 of visible z-fighting,
# 42.3 m of grazing seams, 336 deep crossings over 5 cm). Depth comes from seeded random samples
# per site, so unchanged geometry can move a few sites across 5 cm; the deep bounds keep ~3%.
MAX_ZFIGHT_AREA_M2 = 2.2
MAX_ZFIGHT_PAIR_M2 = 0.35
MAX_GRAZING_SEAM_M = 5.6
MAX_DELIVERED_ZFIGHT_AREA_M2 = 2.5
MAX_DEEP_OVER_5CM = 315
MAX_DEEP_SEVERITY = 47500.0
REVIEWED_TOP_PAIRS = 60
VERDICTS = {"designed", "hidden", "built-into-rock", "terrain", "planting", "deferred", "follow-up"}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def lf_sha256(path):
    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()


class CoastalOverlapAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report = json.loads((REVIEW / "overlap-audit.json").read_text(encoding="utf-8"))
        cls.verdicts = json.loads((REVIEW / "overlap-verdicts.json").read_text(encoding="utf-8"))["pairs"]
        cls.manifest = json.loads((MODELS / "manifest.json").read_text(encoding="utf-8"))

    def test_report_binds_the_audited_source_tool_and_every_delivered_house_model(self):
        r = self.report
        self.assertEqual(r["sourceSha256"], sha256(ROOT / r["source"]), "the native source changed without a re-audit")
        self.assertEqual(r["toolSha256"], lf_sha256(ROOT / "bin/audit_coastal_overlaps.py"), "the audit tool changed without a re-audit")
        delivered = {p.name for p in MODELS.glob("*.glb") if p.name.startswith(("home-shell", "room-", "coast", "flora"))}
        self.assertEqual(set(r["exportsSha256"]), delivered)
        for name, digest in r["exportsSha256"].items():
            self.assertEqual(digest, sha256(MODELS / name), f"{name} was re-exported without a re-audit")
        # Streamed furniture is audited in place and recorded with its file hash and anchor, but it is
        # not bound here: the furniture pipeline has its own owner and collision tests, so a furniture
        # export must not fail this house report. The house worker re-audits at each house checkpoint.
        self.assertTrue(r["furniture"], "the audit places the streamed furniture at its anchors")
        self.assertTrue(all(item["anchor"] and item["sha256"] for item in r["furniture"]))
        self.assertIn("furnitureAnchorsSha256", r)

    def test_contacts_are_explicit_bounded_rules_not_blanket_ignores(self):
        rules = self.report["contactRules"]
        self.assertTrue(rules)
        for rule in rules:
            self.assertTrue(rule["reason"].strip() and rule["test"].strip(), rule["id"])
            self.assertGreater(rule["maxDepth"], 0)
            self.assertLessEqual(rule["maxDepth"], 1.0)
        for exclusion in self.report["exclusions"]:
            self.assertTrue(exclusion["reason"].strip(), exclusion["id"])
        # Only never-drawn geometry is skipped before measurement.
        self.assertLessEqual(set(self.report["skipped"]), {"never-drawn", "furniture-placeholder"})

    def test_visible_z_fighting_and_grazing_seams_stay_within_the_repaired_ratchet(self):
        t = self.report["totals"]
        self.assertLessEqual(t["zFightingVisibleAreaM2"], MAX_ZFIGHT_AREA_M2)
        self.assertLessEqual(t["grazingSeamM"], MAX_GRAZING_SEAM_M)
        for pair in self.report["zFighting"]:
            if pair["visibleAreaM2"] > MAX_ZFIGHT_PAIR_M2:
                self.assertIn(pair["verdict"], ("hidden", "deferred"), f"{pair['pair']}: {pair['visibleAreaM2']} m2 of visible z-fighting")
        before = self.report["before"]["totals"]
        self.assertLess(t["zFightingVisibleAreaM2"], before["zFightingVisibleAreaM2"] / 10)
        self.assertLess(t["grazingSeamM"], before["grazingSeamM"] / 4)

    def test_the_decoded_delivery_was_audited_too_and_keeps_its_own_z_fighting_ratchet(self):
        delivered = self.report["delivered"]
        self.assertIsNotNone(delivered, "audit the decoded GLBs with --delivered=1")
        for name, digest in delivered["exportsSha256"].items():
            self.assertEqual(digest, sha256(MODELS / name), f"{name} changed after the delivered audit")
        self.assertEqual(set(delivered["exportsSha256"]), set(self.report["exportsSha256"]))
        self.assertLessEqual(delivered["totals"]["zFightingVisibleAreaM2"], MAX_DELIVERED_ZFIGHT_AREA_M2)

    def test_deep_crossings_ratchet_and_the_top_pairs_carry_reviewed_bounded_verdicts(self):
        t = self.report["totals"]
        self.assertLessEqual(t["deepSitesOver5cm"], MAX_DEEP_OVER_5CM)
        self.assertLessEqual(t["deepSeverity"], MAX_DEEP_SEVERITY)
        for pair in self.report["deepOffenderPairs"][:REVIEWED_TOP_PAIRS]:
            verdict = self.verdicts.get(pair["pair"])
            self.assertIsNotNone(verdict, f"unreviewed top overlap: {pair['pair']}")
            self.assertIn(verdict["verdict"], VERDICTS)
            self.assertTrue(verdict["reason"].strip())
            self.assertLessEqual(pair["maxDepthM"], verdict["maxDepthM"], f"{pair['pair']} grew past its reviewed depth")
            self.assertLessEqual(pair["seamM"], verdict["maxSeamM"], f"{pair['pair']} grew past its reviewed seam")


if __name__ == "__main__":
    unittest.main()
