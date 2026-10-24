"""Keep the delivered CV download tied to the current public record."""
from __future__ import annotations

import hashlib
import html
import json
from pathlib import Path
import re
import unittest
import unicodedata
from urllib.parse import urljoin, urlsplit, urlunsplit

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]


def visible(value: str) -> str:
    value = re.sub(r"\[([^\]]+)\]\(https?://[^)]+\)", r"\1", value)
    value = re.sub(r"<[^>]+>", "", value)
    # Chromium's embedded font uses standard fi/fl glyph ligatures; NFKC expands
    # those while retaining every word, numeral and punctuation mark.
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", html.unescape(value)))


def normalized_url(value: str) -> str:
    parts = urlsplit(value)
    return urlunsplit(parts._replace(path=parts.path or "/")) if parts.scheme in {"http", "https"} else value


class CurrentCvPdfTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = (ROOT / "assets/json/resume.json").read_bytes()
        cls.cv = json.loads(cls.raw)
        cls.pdf_path = ROOT / "assets/pdf/Sirui_Tao_CV_Public.pdf"
        cls.pdf = PdfReader(cls.pdf_path)
        cls.text = visible("\n".join(page.extract_text() for page in cls.pdf.pages))
        cls.receipt = json.loads((ROOT / "artwork/cv/build-receipt.json").read_text(encoding="utf8"))

    def test_published_pdf_is_bound_to_the_current_canonical_record(self):
        self.assertEqual(self.raw, (ROOT / "_data/resume.json").read_bytes())
        self.assertEqual(hashlib.sha256(self.raw.replace(b"\r\n", b"\n")).hexdigest(), self.receipt["resume_lf_sha256"], "Rebuild the CV PDF after changing its public record.")
        self.assertEqual(hashlib.sha256(self.pdf_path.read_bytes()).hexdigest(), self.receipt["pdf_sha256"], "Rebuild the PDF and its receipt together.")
        self.assertEqual({key: len(value) for key, value in self.cv.items() if isinstance(value, list)}, self.receipt["records"])

    def test_four_readable_letter_pages_retain_tags_outline_and_language(self):
        self.assertEqual(len(self.pdf.pages), 4)
        for page in self.pdf.pages:
            self.assertEqual((float(page.mediabox.width), float(page.mediabox.height)), (612, 792))
            self.assertGreater(len(page.extract_text()), 1700)
        catalog = self.pdf.trailer["/Root"]
        self.assertTrue(catalog["/MarkInfo"]["/Marked"])
        self.assertIn("/StructTreeRoot", catalog)
        self.assertTrue(str(catalog["/Lang"]).startswith("en"))
        self.assertTrue(self.pdf.outline)

    def test_all_current_public_claims_dates_and_credits_are_in_the_pdf(self):
        # IDs and URLs have separate link checks. Empty image/certificates are not claims.
        excluded = {"url", "image", "anchor", "paperAnchor", "username", "region", "countryCode"}
        def visit(value, key="", path=()):
            if isinstance(value, dict):
                for child_key, child in value.items():
                    if child_key not in excluded:
                        visit(child, child_key, path + (child_key,))
            elif isinstance(value, list):
                for child in value:
                    visit(child, key, path)
            elif isinstance(value, str) and value:
                label = "Current" if key == "status" and value == "current" else "Alumni" if key == "status" and value == "alumni" else value
                if path == ("skills", "name") and value == "Human-Computer Interaction":
                    label = "HCI"
                with self.subTest(field=key, claim=label):
                    self.assertIn(visible(label), self.text)
        visit(self.cv)
        skills_text = visible(self.pdf.pages[3].extract_text().split("Skills", 1)[1].split("Languages", 1)[0])
        for skill in self.cv["skills"]:
            label = "HCI" if skill["name"] == "Human-Computer Interaction" else skill["name"]
            self.assertIn(visible(label), skills_text)
            for keyword in skill["keywords"]:
                self.assertIn(visible(keyword), skills_text)
        self.assertNotIn("ResubmittingtoCHI27", self.text)
        self.assertNotIn("Citation=226", self.text)
        self.assertIn("Manuscriptunderreview.", self.text)
        self.assertIn("Underreview", self.text)
        self.assertNotIn("XXX:abcdefg", self.text)
        self.assertNotIn("Preparingforsubmission", self.text)

    def test_every_current_destination_is_a_real_pdf_link(self):
        links = []
        destinations = 0
        for page in self.pdf.pages:
            for reference in page.get("/Annots", []):
                annotation = reference.get_object()
                action = annotation.get("/A", {})
                if action.get("/URI"):
                    links.append(normalized_url(str(action["/URI"])))
                if annotation.get("/Dest") or action.get("/S") == "/GoTo":
                    destinations += 1
        urls = set()
        def visit(value):
            if isinstance(value, dict):
                if value.get("url"):
                    urls.add(urljoin(self.cv["basics"]["url"], value["url"]))
                for child in value.values():
                    visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)
            elif isinstance(value, str):
                urls.update(re.findall(r"\]\((https?://[^)]+)\)", value))
                urls.update(re.findall(r"href=['\"]([^'\"]+)['\"]", value))
        visit(self.cv)
        urls.add("mailto:" + self.cv["basics"]["email"])
        for url in urls:
            with self.subTest(url=url):
                self.assertIn(normalized_url(url), links)
        self.assertGreaterEqual(destinations, len(self.cv["mentorship"]))


if __name__ == "__main__":
    unittest.main()
