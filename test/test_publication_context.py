from __future__ import annotations

import re
import unittest
from pathlib import Path
from urllib.parse import urlparse

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
CONTEXT_PATH = REPO_ROOT / "_data" / "publication_context.yml"
BIB_PATH = REPO_ROOT / "_bibliography" / "papers.bib"
LENS_PATH = REPO_ROOT / "_data" / "publication_lens.yml"

EXPECTED_KEYS = {
    "tao2026whw",
    "wang2025hotspot",
    "tao2024designweaver",
    "tung2023physion++",
    "bear2021physion",
}

FORBIDDEN_CONTEXT_FIELDS = {
    "title",
    "author",
    "authors",
    "year",
    "month",
    "venue",
    "booktitle",
    "journal",
    "series",
    "editor",
    "volume",
    "number",
    "pages",
    "publisher",
    "isbn",
    "address",
    "doi",
    "arxiv",
    "url",
    "pdf",
    "website",
    "code",
    "video",
    "abbr",
    "note",
    "preview",
    "bibtex_show",
    "selected",
}

REQUIRED_CONTEXT_FIELDS = {
    "slug",
    "abstract",
    "tldr",
    "why_cite",
    "authorship",
    "topics",
    "related_project",
    "provenance",
}

REQUIRED_WHY_CITE_FIELDS = {
    "statement",
    "cite_when",
    "contributions",
    "evidence",
    "boundaries",
}


def load_yaml(path: Path) -> dict:
    with path.open(encoding="utf-8") as stream:
        return yaml.safe_load(stream)


def bibtex_entries() -> dict[str, str]:
    text = BIB_PATH.read_text(encoding="utf-8")
    starts = list(re.finditer(r"^@\w+\{([^,]+),", text, flags=re.MULTILINE))
    entries: dict[str, str] = {}
    for index, match in enumerate(starts):
        end = starts[index + 1].start() if index + 1 < len(starts) else len(text)
        entries[match.group(1)] = text[match.start() : end]
    return entries


class PublicationContextContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.context_root = load_yaml(CONTEXT_PATH)
        cls.context = cls.context_root["papers"]
        cls.lens = load_yaml(LENS_PATH)["papers"]
        cls.bib_entries = bibtex_entries()

    def test_schema_and_key_coverage_are_exact(self) -> None:
        self.assertEqual(self.context_root["schema_version"], 1)
        self.assertEqual(set(self.bib_entries), EXPECTED_KEYS)
        self.assertEqual(set(self.context), EXPECTED_KEYS)
        self.assertEqual(set(self.lens), EXPECTED_KEYS)

    def test_context_is_editorial_not_a_second_bibliography(self) -> None:
        for key, record in self.context.items():
            with self.subTest(key=key):
                self.assertFalse(FORBIDDEN_CONTEXT_FIELDS & set(record))
                self.assertEqual(REQUIRED_CONTEXT_FIELDS - set(record), set())

    def test_why_cite_fields_are_complete_and_bounded(self) -> None:
        for key, record in self.context.items():
            with self.subTest(key=key):
                why_cite = record["why_cite"]
                self.assertEqual(REQUIRED_WHY_CITE_FIELDS - set(why_cite), set())
                self.assertTrue(why_cite["statement"].strip())
                for field in ("cite_when", "contributions", "evidence", "boundaries"):
                    self.assertIsInstance(why_cite[field], list)
                    self.assertGreater(len(why_cite[field]), 0)
                    self.assertTrue(all(isinstance(item, str) and item.strip() for item in why_cite[field]))

    def test_slugs_roles_topics_and_sources_are_valid(self) -> None:
        slugs: list[str] = []
        for key, record in self.context.items():
            with self.subTest(key=key):
                slugs.append(record["slug"])
                self.assertRegex(record["slug"], r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
                self.assertEqual(record["authorship"]["role"], self.lens[key]["role"])
                self.assertTrue(record["authorship"]["role_label"].strip())
                self.assertTrue(record["authorship"]["statement"].strip())
                self.assertGreater(len(record["topics"]), 0)
                self.assertTrue(all(topic.strip() for topic in record["topics"]))
                self.assertRegex(record["provenance"]["reviewed_on"], r"^\d{4}-\d{2}-\d{2}$")
                self.assertTrue(record["provenance"]["basis"].strip())
                self.assertGreater(len(record["provenance"]["sources"]), 0)
                for source in record["provenance"]["sources"]:
                    parsed = urlparse(source)
                    self.assertIn(parsed.scheme, {"http", "https"})
                    self.assertTrue(parsed.netloc)
        self.assertEqual(len(slugs), len(set(slugs)))

    def test_verified_identifiers_are_not_conflated(self) -> None:
        self.assertRegex(self.bib_entries["wang2025hotspot"], r"(?m)^\s*doi\s*=\s*\{10\.1109/CVPR52734\.2025\.00127\}")
        self.assertRegex(self.bib_entries["wang2025hotspot"], r"(?m)^\s*arxiv\s*=\s*\{2411\.14628\}")
        self.assertRegex(self.bib_entries["tao2024designweaver"], r"(?m)^\s*doi\s*=\s*\{10\.1145/3706598\.3714211\}")
        self.assertRegex(self.bib_entries["tao2024designweaver"], r"(?m)^\s*arxiv\s*=\s*\{2502\.09867\}")
        self.assertRegex(self.bib_entries["bear2021physion"], r"(?m)^\s*arxiv\s*=\s*\{2106\.08261\}")

        for key in ("tao2026whw", "tung2023physion++", "bear2021physion"):
            with self.subTest(key=key):
                self.assertIsNone(
                    re.search(r"^\s*doi\s*=", self.bib_entries[key], flags=re.MULTILINE),
                    f"{key} must remain proceedings-DOI-free",
                )

        all_publication_text = CONTEXT_PATH.read_text(encoding="utf-8") + BIB_PATH.read_text(encoding="utf-8")
        self.assertNotIn("10.1145/nnnnnnn.nnnnnnn", all_publication_text)
        self.assertNotIn("10.52202/075280-2929", all_publication_text)
        self.assertNotIn("10.48550/arXiv.2106.08261", all_publication_text)

    def test_formal_venues_are_separate_from_acceptance_status(self) -> None:
        hotspot = self.bib_entries["wang2025hotspot"]
        self.assertRegex(
            hotspot,
            r"(?m)^\s*booktitle\s*=\s*\{Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition \(CVPR\)\}",
        )
        self.assertRegex(hotspot, r"(?m)^\s*note\s*=\s*\{Highlight\}")
        self.assertRegex(hotspot, r"(?m)^\s*pages\s*=\s*\{1276--1286\}")
        self.assertRegex(hotspot, r"(?m)^\s*publisher\s*=\s*\{IEEE\}")
        self.assertRegex(hotspot, r"(?m)^\s*video\s*=\s*\{https://www\.youtube\.com/watch\?v=v-OeGOxgqRM\}")
        self.assertRegex(
            hotspot,
            r"(?m)^\s*url\s*=\s*\{https://openaccess\.thecvf\.com/content/CVPR2025/html/.+_paper\.html\}",
        )

        designweaver = self.bib_entries["tao2024designweaver"]
        self.assertRegex(designweaver, r"(?m)^\s*series\s*=\s*\{CHI '25\}")
        self.assertRegex(designweaver, r"(?m)^\s*pages\s*=\s*\{1--26\}")
        self.assertRegex(designweaver, r"(?m)^\s*publisher\s*=\s*\{ACM\}")

        physion_plus = self.bib_entries["tung2023physion++"]
        self.assertRegex(
            physion_plus,
            r"(?m)^\s*booktitle\s*=\s*\{Proceedings of the Annual Meeting of the Cognitive Science Society\}",
        )
        self.assertRegex(
            physion_plus,
            r"(?m)^\s*note\s*=\s*\{Poster with abstract\}",
        )
        self.assertRegex(
            physion_plus,
            r"(?m)^\s*url\s*=\s*\{https://escholarship\.org/uc/item/3x9960zn\}",
        )

        physion = self.bib_entries["bear2021physion"]
        self.assertRegex(
            physion,
            r"(?m)^\s*pdf\s*=\s*\{https://datasets-benchmarks-proceedings\.neurips\.cc/paper_files/paper/2021/file/d09bf41544a3365a46c9077ebb5e35c3-Paper-round1\.pdf\}",
        )

        whw = self.bib_entries["tao2026whw"]
        self.assertRegex(whw, r"(?m)^\s*url\s*=\s*\{https://herding-cats-ws\.github\.io/2026/papers/p02\.pdf\}")

    def test_machine_templates_use_explicit_public_sources(self) -> None:
        llms_full = (REPO_ROOT / "llms-full.txt").read_text(encoding="utf-8")
        llms_index = (REPO_ROOT / "llms.txt").read_text(encoding="utf-8")
        for text in (llms_full, llms_index):
            self.assertNotIn("for page in site.pages", text)
            self.assertNotIn("sirui-research-thoughts", text)
            self.assertIn("site.data.publication_catalog", text)

        self.assertFalse((REPO_ROOT / "_data" / "bibtex_overrides.yml").exists())
        bib_layout = (REPO_ROOT / "_layouts" / "bib.liquid").read_text(encoding="utf-8")
        self.assertNotIn("site.data.bibtex_overrides", bib_layout)
        self.assertIn("publication_context_entry.citation.bibtex", bib_layout)
        for project_path in ("_projects/designweaver.md", "_projects/what-happened-and-why.md"):
            project_text = (REPO_ROOT / project_path).read_text(encoding="utf-8")
            self.assertIn("site.data.publication_catalog.by_key", project_text)
            self.assertNotIn("@article{taohappened", project_text)

        ai_template = (REPO_ROOT / "_pages" / "ai.md").read_text(encoding="utf-8")
        self.assertIn("{% if mode.link_url and mode.link_label %}", ai_template)
        self.assertIn("paper.why_cite.contributions", ai_template)
        self.assertIn("{% if mode.link_url and mode.link_label -%}", llms_full)

        metadata_template = (REPO_ROOT / "_includes" / "metadata.liquid").read_text(encoding="utf-8")
        self.assertNotIn("relative_url | absolute_url", metadata_template)
        self.assertIn("og_image_source | absolute_url", metadata_template)

        copy_script = (REPO_ROOT / "assets" / "js" / "ai-view.js").read_text(encoding="utf-8")
        self.assertIn('copied = document.execCommand("copy")', copy_script)
        self.assertIn("if (!copied) throw", copy_script)

        designweaver_project = (REPO_ROOT / "_projects" / "designweaver.md").read_text(encoding="utf-8")
        self.assertIn('- "Dow, Steven P."', designweaver_project)
        self.assertIn(
            'citation_conference_title: "Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems"',
            designweaver_project,
        )
        for field in ('citation_firstpage: "1"', 'citation_lastpage: "26"', "citation_publisher: ACM"):
            self.assertIn(field, designweaver_project)

        whw_project = (REPO_ROOT / "_projects" / "what-happened-and-why.md").read_text(encoding="utf-8")
        self.assertIn("status: Published", whw_project)
        self.assertIn("date: 2026-04-15", whw_project)
        self.assertEqual(whw_project.count("April 15, 2026"), 2)
        self.assertNotIn("February 25, 2026", whw_project)

    def test_claim_boundaries_and_rendered_identifiers_are_preserved(self) -> None:
        whw = self.context["tao2026whw"]
        whw_claims = " ".join(whw["why_cite"]["evidence"] + whw["why_cite"]["boundaries"]).lower()
        self.assertIn("position paper", whw_claims)
        self.assertIn("not yet been validated", whw_claims)
        self.assertIn("do not by themselves establish causality", whw_claims)

        self.assertEqual(whw["authorship"]["role_label"], "First and corresponding author")
        self.assertEqual(
            self.context["tao2024designweaver"]["authorship"]["role_label"],
            "First and corresponding author",
        )

        designweaver_evidence = " ".join(self.context["tao2024designweaver"]["why_cite"]["evidence"])
        for null_result in ("p = .059", "p = .579", "p = .1314"):
            self.assertIn(null_result, designweaver_evidence)

        physion_plus_boundaries = " ".join(self.context["tung2023physion++"]["why_cite"]["boundaries"])
        self.assertIn("11-author CogSci record", physion_plus_boundaries)
        self.assertIn("separate nine-author NeurIPS technical paper", physion_plus_boundaries)

        source_paths = (
            "_plugins/publication_catalog.rb",
            "_layouts/publication.liquid",
            "_pages/ai.md",
            "llms-full.txt",
        )
        rendered_source = "\n".join((REPO_ROOT / path).read_text(encoding="utf-8") for path in source_paths)
        self.assertIn('paper.links.arxiv', rendered_source)
        self.assertIn('paper.dig("links", "arxiv")', rendered_source)
        for forbidden_doi in ("10.1145/nnnnnnn.nnnnnnn", "10.52202/075280-2929", "10.48550/arXiv.2106.08261"):
            self.assertNotIn(forbidden_doi, rendered_source)


if __name__ == "__main__":
    unittest.main()
