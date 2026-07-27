from __future__ import annotations

import json
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_RESUME_PATH = REPO_ROOT / "_data" / "resume.json"
DOWNLOAD_RESUME_PATH = REPO_ROOT / "assets" / "json" / "resume.json"
MENTORSHIP_INCLUDE_PATH = REPO_ROOT / "_includes" / "cv" / "mentorship.liquid"


class CvMentorshipTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.data_bytes = DATA_RESUME_PATH.read_bytes()
        cls.download_bytes = DOWNLOAD_RESUME_PATH.read_bytes()
        cls.resume = json.loads(cls.data_bytes.decode("utf-8"))
        cls.include = MENTORSHIP_INCLUDE_PATH.read_text(encoding="utf-8")

    def test_resume_copies_are_byte_identical(self) -> None:
        self.assertEqual(self.data_bytes, self.download_bytes)

    def test_current_and_alumni_order_is_explicit(self) -> None:
        entries = self.resume["mentorship"]
        self.assertEqual(
            [(entry["status"], entry["name"]) for entry in entries],
            [
                ("current", "Shreya Krishnamurthy"),
                ("current", "Cecilia Lin"),
                ("alumni", "Kiruthika Marikumaran"),
                ("alumni", "Domonick Marshall"),
                ("alumni", "Erin Huang"),
                ("alumni", "Suma Vintha"),
            ],
        )

    def test_cecilia_and_p5_links_are_preserved(self) -> None:
        entries = self.resume["mentorship"]
        cecilia = next(entry for entry in entries if entry["name"] == "Cecilia Lin")
        self.assertEqual(cecilia["url"], "https://www.linkedin.com/in/cecilialin1")
        self.assertEqual(cecilia["details"], "B.S. UCSD")
        for entry in entries:
            self.assertEqual(entry["paperLabel"], "P5")
            self.assertEqual(entry["paperAnchor"], "cv-publication-p5")

    def test_renderer_has_semantic_groups_and_linked_coda(self) -> None:
        self.assertIn("mentorship_statuses = 'current,alumni'", self.include)
        self.assertIn("{{ mentorship_status | capitalize }}", self.include)
        self.assertIn('href="#cv-publication-p5">[P5]</a>', self.include)
        self.assertIn(
            "Fun fact: every intern I’ve mentored so far has worked on",
            self.include,
        )
        normalized_include = " ".join(self.include.split())
        self.assertIn(
            "the twice-rejected paper. Hopefully the rejection streak ends soon :-)",
            normalized_include,
        )


if __name__ == "__main__":
    unittest.main()
