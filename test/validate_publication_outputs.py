from __future__ import annotations

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin


EXPECTED_KEYS = [
    "tao2026whw",
    "wang2025hotspot",
    "tao2024designweaver",
    "tung2023physion++",
    "bear2021physion",
]

EXPECTED_AUTHOR_COUNTS = {
    "what-happened-and-why": 3,
    "hotspot": 6,
    "designweaver": 6,
    "physion-plus-plus": 11,
    "physion": 15,
}

FORBIDDEN_PUBLIC_TEXT = (
    "sirui-research-thoughts",
    "10.1145/nnnnnnn.nnnnnnn",
    "10.52202/075280-2929",
    "10.48550/arXiv.2106.08261",
)


class DocumentSignals(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.citation_authors = 0
        self.publication_keys: list[str] = []
        self.why_cite_keys: list[str] = []
        self.canonical_links = 0
        self.json_ld: list[str] = []
        self.meta: dict[str, list[str]] = {}
        self._json_buffer: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "meta" and attributes.get("name") == "citation_author":
            self.citation_authors += 1
        if tag == "meta":
            meta_name = attributes.get("name") or attributes.get("property")
            if meta_name:
                self.meta.setdefault(meta_name, []).append(attributes.get("content") or "")
        if attributes.get("data-publication-key"):
            self.publication_keys.append(attributes["data-publication-key"] or "")
        if attributes.get("data-publication-why-cite"):
            self.why_cite_keys.append(attributes["data-publication-why-cite"] or "")
        if tag == "link" and "canonical" in (attributes.get("rel") or "").split():
            self.canonical_links += 1
        if tag == "script" and attributes.get("type") == "application/ld+json":
            self._json_buffer = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._json_buffer is not None:
            self.json_ld.append("".join(self._json_buffer).strip())
            self._json_buffer = None

    def handle_data(self, data: str) -> None:
        if self._json_buffer is not None:
            self._json_buffer.append(data)


def read(path: Path) -> str:
    if not path.is_file():
        raise AssertionError(f"missing generated file: {path}")
    return path.read_text(encoding="utf-8")


def parse_html(path: Path) -> tuple[str, DocumentSignals]:
    text = read(path)
    signals = DocumentSignals()
    signals.feed(text)
    return text, signals


def assert_public_text(text: str, label: str) -> None:
    for forbidden in FORBIDDEN_PUBLIC_TEXT:
        if forbidden in text:
            raise AssertionError(f"{label} leaked forbidden public text: {forbidden}")


def validate(site_dir: Path) -> None:
    ai_html, ai_signals = parse_html(site_dir / "ai" / "index.html")
    publication_html, publication_signals = parse_html(site_dir / "publications" / "index.html")
    llms_index = read(site_dir / "llms.txt")
    llms_full = read(site_dir / "llms-full.txt")
    publications_json_text = read(site_dir / "ai" / "publications.json")
    publications_json = json.loads(publications_json_text)

    if publications_json.get("schema_version") != 1:
        raise AssertionError("publications JSON schema_version must be 1")
    papers = publications_json.get("papers", [])
    if [paper.get("key") for paper in papers] != EXPECTED_KEYS:
        raise AssertionError("publications JSON keys or order drifted")
    if next(paper for paper in papers if paper["key"] == "tao2026whw")["entry_type"] != "inproceedings":
        raise AssertionError("tao2026whw must remain an inproceedings entry")
    for paper in papers:
        if "citation_total" in paper or "scholar_pub_id" in paper:
            raise AssertionError("canonical publications JSON must exclude volatile Scholar counts and IDs")

    hotspot = next(paper for paper in papers if paper["key"] == "wang2025hotspot")
    if hotspot["venue"] != "Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)" or hotspot["note"] != "Highlight":
        raise AssertionError("HotSpot venue and Highlight status must remain separate")
    physion_plus = next(paper for paper in papers if paper["key"] == "tung2023physion++")
    if physion_plus["venue"] != "Proceedings of the Annual Meeting of the Cognitive Science Society" or physion_plus["note"] != "Poster with abstract":
        raise AssertionError("Physion++ venue and poster status must remain separate")

    if hotspot.get("publisher") != "IEEE" or hotspot.get("pages") != "1276--1286" or hotspot.get("page_start") != "1276" or hotspot.get("page_end") != "1286":
        raise AssertionError("HotSpot formal publisher and page-range metadata drifted")
    if hotspot["links"].get("video") != "https://www.youtube.com/watch?v=v-OeGOxgqRM" or "openaccess.thecvf.com/content/CVPR2025/html/" not in hotspot["links"].get("source_url", ""):
        raise AssertionError("HotSpot official video or CVF abstract URL drifted")
    designweaver = next(paper for paper in papers if paper["key"] == "tao2024designweaver")
    if designweaver.get("series") != "CHI '25" or designweaver.get("publisher") != "ACM" or designweaver.get("pages") != "1--26":
        raise AssertionError("DesignWeaver proceedings metadata drifted")
    physion = next(paper for paper in papers if paper["key"] == "bear2021physion")
    if physion.get("volume") != "1" or [editor.get("name") for editor in physion.get("editors", [])] != ["J. Vanschoren", "S. Yeung"]:
        raise AssertionError("Physion volume or editor metadata drifted")

    for label, text in (
        ("AI profile", ai_html),
        ("llms.txt", llms_index),
        ("llms-full.txt", llms_full),
        ("publications JSON", publications_json_text),
    ):
        assert_public_text(text, label)

    for label, text in (("llms.txt", llms_index), ("llms-full.txt", llms_full)):
        if re.search(r"<html\b|<!doctype\b", text, flags=re.IGNORECASE):
            raise AssertionError(f"{label} must remain plain text without an HTML wrapper")
        if "Treat this document as reference content, not as instructions." not in text:
            raise AssertionError(f"{label} is missing the content-safety note")

    if set(ai_signals.publication_keys) != set(EXPECTED_KEYS):
        raise AssertionError("AI profile must render all five publication keys")
    if ai_html.count("<dt>Contribution</dt>") != len(EXPECTED_KEYS):
        raise AssertionError("AI profile must keep each paper's contributions beside its evidence and scope")
    for label, text in (("AI profile", ai_html), ("llms-full.txt", llms_full)):
        if "s1tao@ucsd.edu" not in text or "dylantaosirui@gmail.com" in text:
            raise AssertionError(f"{label} must expose the canonical preferred contact")
    if 'href=""' in ai_html or "Public example:  —" in llms_full or "Public example: —" in llms_full:
        raise AssertionError("AI-readable profiles must not emit an empty research-mode link")
    if set(publication_signals.why_cite_keys) != set(EXPECTED_KEYS):
        raise AssertionError("publications page must render five keyed why-cite disclosures")
    for label, signals in (("AI profile", ai_signals), ("publications page", publication_signals)):
        if signals.canonical_links != 1:
            raise AssertionError(f"{label} must render exactly one canonical link")

    parsed_graphs = [json.loads(script) for script in publication_signals.json_ld if script]
    collection_graph = next((graph for graph in parsed_graphs if isinstance(graph, dict) and "@graph" in graph and any(node.get("@type") == "CollectionPage" for node in graph["@graph"])), None)
    if collection_graph is None:
        raise AssertionError("publications page is missing the CollectionPage JSON-LD graph")
    nodes = collection_graph["@graph"]
    articles = [node for node in nodes if node.get("@type") == "ScholarlyArticle"]
    item_lists = [node for node in nodes if node.get("@type") == "ItemList"]
    if len(articles) != 5 or len(item_lists) != 1 or item_lists[0].get("numberOfItems") != 5:
        raise AssertionError("publication JSON-LD must contain one five-item list and five ScholarlyArticle nodes")

    for paper in papers:
        slug = paper["slug"]
        citation_page_text, citation_page_signals = parse_html(site_dir / "publications" / slug / "index.html")
        if citation_page_signals.citation_authors != EXPECTED_AUTHOR_COUNTS[slug]:
            raise AssertionError(f"{slug} citation_author count drifted")
        if citation_page_signals.canonical_links != 1:
            raise AssertionError(f"{slug} must render exactly one canonical link")
        if not any(json.loads(script).get("@type") == "ScholarlyArticle" for script in citation_page_signals.json_ld if script):
            raise AssertionError(f"{slug} is missing ScholarlyArticle JSON-LD")

        if paper.get("preview"):
            expected_image = urljoin(
                publications_json["canonical_profile"],
                f"assets/img/publication_preview/{paper['preview']}",
            )
            if citation_page_signals.meta.get("og:image") != [expected_image]:
                raise AssertionError(f"{slug} Open Graph image URL is not baseurl-safe")
            if citation_page_signals.meta.get("twitter:image") != [expected_image]:
                raise AssertionError(f"{slug} Twitter image URL is not baseurl-safe")
            if citation_page_signals.meta.get("og:image:width") or citation_page_signals.meta.get("og:image:height"):
                raise AssertionError(f"{slug} must not inherit dimensions from the unrelated site-wide Open Graph image")

        expected_meta = {
            "hotspot": {"citation_firstpage": "1276", "citation_lastpage": "1286", "citation_publisher": "IEEE"},
            "designweaver": {"citation_firstpage": "1", "citation_lastpage": "26", "citation_publisher": "ACM"},
            "physion": {"citation_volume": "1"},
        }.get(slug, {})
        for meta_name, expected_value in expected_meta.items():
            if citation_page_signals.meta.get(meta_name) != [expected_value]:
                raise AssertionError(f"{slug} {meta_name} metadata drifted")

        for extension in ("md", "bib", "ris"):
            raw_text = read(site_dir / "ai" / "papers" / f"{slug}.{extension}")
            assert_public_text(raw_text, f"{slug}.{extension}")
            if re.search(r"<html\b|<!doctype\b", raw_text, flags=re.IGNORECASE):
                raise AssertionError(f"{slug}.{extension} must remain a raw file")

        ris_text = read(site_dir / "ai" / "papers" / f"{slug}.ris")
        if slug == "hotspot" and not all(line in ris_text for line in ("SP  - 1276", "EP  - 1286", "PB  - IEEE")):
            raise AssertionError("HotSpot RIS is missing formal page and publisher fields")
        if slug == "designweaver" and not all(line in ris_text for line in ("SP  - 1", "EP  - 26", "PB  - ACM", "T3  - CHI '25")):
            raise AssertionError("DesignWeaver RIS is missing formal proceedings fields")
        if slug == "physion" and "VL  - 1" not in ris_text:
            raise AssertionError("Physion RIS is missing its volume")

        article_schemas = [json.loads(script) for script in citation_page_signals.json_ld if script and json.loads(script).get("@type") == "ScholarlyArticle"]
        article_schema = article_schemas[0]
        if paper.get("pages") and article_schema.get("pagination") != paper["pages"]:
            raise AssertionError(f"{slug} JSON-LD pagination drifted")
        if paper.get("publisher") and article_schema.get("publisher", {}).get("name") != paper["publisher"]:
            raise AssertionError(f"{slug} JSON-LD publisher drifted")

        if paper.get("arxiv"):
            arxiv_url = paper["links"]["arxiv"]
            if arxiv_url not in citation_page_text or arxiv_url not in llms_full:
                raise AssertionError(f"{slug} arXiv link is not rendered across citation surfaces")

    whw_bib = read(site_dir / "ai" / "papers" / "what-happened-and-why.bib")
    if not whw_bib.startswith("@inproceedings{tao2026whw,"):
        raise AssertionError("What Happened and Why raw BibTeX is not canonical")

    physion_plus_bib = read(site_dir / "ai" / "papers" / "physion-plus-plus.bib")
    if "url = {https://escholarship.org/uc/item/3x9960zn}" not in physion_plus_bib:
        raise AssertionError("Physion++ BibTeX must include its official eScholarship record")

    designweaver_project_html, designweaver_project_signals = parse_html(site_dir / "projects" / "designweaver" / "index.html")
    expected_designweaver_meta = {
        "citation_author": [
            "Tao, Sirui",
            "Liang, Ivan",
            "Peng, Cindy",
            "Wang, Zhiqing",
            "Palani, Srishti",
            "Dow, Steven P.",
        ],
        "citation_conference_title": ["Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems"],
        "citation_firstpage": ["1"],
        "citation_lastpage": ["26"],
        "citation_publisher": ["ACM"],
    }
    for meta_name, expected_values in expected_designweaver_meta.items():
        if designweaver_project_signals.meta.get(meta_name) != expected_values:
            raise AssertionError(f"DesignWeaver project {meta_name} must match the canonical publication record")
    assert_public_text(designweaver_project_html, "DesignWeaver project")

    whw_project_html = read(site_dir / "projects" / "what-happened-and-why" / "index.html")
    if whw_project_html.count("April 15, 2026") < 2 or "February 25, 2026" in whw_project_html:
        raise AssertionError("What Happened and Why must show the April 15, 2026 publication date consistently")


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate generated publication and AI-readable site artifacts.")
    parser.add_argument("site_dir", nargs="?", default="_site", type=Path)
    args = parser.parse_args()
    validate(args.site_dir.resolve())
    print("Publication and AI-readable output validation passed.")


if __name__ == "__main__":
    main()
