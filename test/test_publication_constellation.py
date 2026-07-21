from __future__ import annotations

import re
import unittest
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
CONSTELLATION_PATH = REPO_ROOT / "_data" / "publication_constellation.yml"
LENS_PATH = REPO_ROOT / "_data" / "publication_lens.yml"
BIB_PATH = REPO_ROOT / "_bibliography" / "papers.bib"
WALL_PATH = REPO_ROOT / "_data" / "wall_of_rejection.yml"
PUBLICATIONS_PAGE_PATH = REPO_ROOT / "_pages" / "publications.md"
CONSTELLATION_INCLUDE_PATH = REPO_ROOT / "_includes" / "publications" / "paper_constellation.liquid"
SCHOLAR_INCLUDE_PATH = REPO_ROOT / "_includes" / "publications" / "scholar_lens.liquid"
WALL_INCLUDE_PATH = REPO_ROOT / "_includes" / "publications" / "wall_of_rejection.liquid"
WIDGET_ORIGIN_INCLUDE_PATH = REPO_ROOT / "_includes" / "widget_origin_link.liquid"
CONSTELLATION_SCRIPT_PATH = REPO_ROOT / "assets" / "js" / "paper-constellation.js"
LENS_SCRIPT_PATH = REPO_ROOT / "assets" / "js" / "publication-lens.js"
PROJECT_PATH = REPO_ROOT / "_projects" / "paper-constellation.md"
REPRODUCTION_GUIDE_PATH = REPO_ROOT / "assets" / "downloads" / "site-experiments" / "paper-constellation-reproduction.md"
TEASER_PATH = (
    REPO_ROOT
    / "assets"
    / "img"
    / "project_pics"
    / "paper-constellation"
    / "paper-constellation-desktop-surface-6832a6a05-1440-light.png"
)

EXPECTED_THREADS = {"design", "evaluate", "situate"}
EXPECTED_FUTURE_IDS = {
    "future-major-01",
    "future-major-02",
    "future-major-03",
    "future-minor-01",
    "future-minor-02",
    "future-minor-03",
    "future-minor-04",
}
EXPECTED_REJECTION_RECORDS = {"chi-rejection", "uist-rejection"}

ROOT_FIELDS = {"schema_version", "metadata", "threads", "papers", "future", "edges"}
THREAD_FIELDS = {"label", "summary", "position"}
THREAD_POSITION_FIELDS = {"x", "anchor_y"}
PAPER_FIELDS = {"display_label", "memberships", "position", "mobile_thread", "qualifier"}
MEMBERSHIP_FIELDS = {"thread", "relation"}
POSITION_FIELDS = {"x", "y"}
FUTURE_FIELDS = {"label", "size", "thread", "position", "rejection_records"}
EDGE_FIELDS = {"id", "source", "target", "relation"}
ENDPOINT_FIELDS = {"kind", "id"}


def load_yaml(path: Path) -> dict:
    with path.open(encoding="utf-8") as stream:
        return yaml.safe_load(stream)


def bibtex_keys() -> set[str]:
    text = BIB_PATH.read_text(encoding="utf-8")
    return set(re.findall(r"^@\w+\{([^,]+),", text, flags=re.MULTILINE))


class PublicationConstellationContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.constellation = load_yaml(CONSTELLATION_PATH)
        cls.lens = load_yaml(LENS_PATH)
        cls.wall = load_yaml(WALL_PATH)
        cls.paper_keys = bibtex_keys()

    def test_root_schema_is_small_and_explicit(self) -> None:
        self.assertEqual(self.constellation["schema_version"], 1)
        self.assertEqual(set(self.constellation), ROOT_FIELDS)

    def test_three_research_threads_have_bounded_geometry(self) -> None:
        threads = self.constellation["threads"]
        self.assertEqual(set(threads), EXPECTED_THREADS)
        for thread_id, thread in threads.items():
            with self.subTest(thread=thread_id):
                self.assertEqual(set(thread), THREAD_FIELDS)
                self.assertEqual(set(thread["position"]), THREAD_POSITION_FIELDS)
                self.assertTrue(thread["label"].strip())
                self.assertTrue(thread["summary"].strip())
                for value in thread["position"].values():
                    self.assertIsInstance(value, int)
                    self.assertGreaterEqual(value, 0)
                    self.assertLessEqual(value, 100)

    def test_paper_overlay_matches_the_canonical_bibliography(self) -> None:
        papers = self.constellation["papers"]
        self.assertEqual(set(papers), self.paper_keys)
        for paper_key, paper in papers.items():
            with self.subTest(paper=paper_key):
                self.assertLessEqual(set(paper), PAPER_FIELDS)
                self.assertEqual(PAPER_FIELDS - {"qualifier"} - set(paper), set())
                self.assertEqual(set(paper["position"]), POSITION_FIELDS)
                self.assertIn(paper["mobile_thread"], EXPECTED_THREADS)
                self.assertGreater(len(paper["memberships"]), 0)
                for membership in paper["memberships"]:
                    self.assertEqual(set(membership), MEMBERSHIP_FIELDS)
                    self.assertIn(membership["thread"], EXPECTED_THREADS)
                    self.assertIn(membership["relation"], {"primary", "bridge", "adjacent"})
                for value in paper["position"].values():
                    self.assertIsInstance(value, int)
                    self.assertGreaterEqual(value, 0)
                    self.assertLessEqual(value, 100)

    def test_future_nodes_are_anonymous_and_allowlisted(self) -> None:
        future = self.constellation["future"]
        self.assertEqual(set(future), EXPECTED_FUTURE_IDS)
        self.assertEqual(sum(node["size"] == "major" for node in future.values()), 3)
        self.assertEqual(sum(node["size"] == "minor" for node in future.values()), 4)
        self.assertEqual(sum(node["thread"] == "design" for node in future.values()), 5)
        self.assertEqual(sum(node["thread"] == "situate" for node in future.values()), 2)

        for node_id, node in future.items():
            with self.subTest(node=node_id):
                self.assertLessEqual(set(node), FUTURE_FIELDS)
                self.assertEqual(FUTURE_FIELDS - {"rejection_records"} - set(node), set())
                self.assertEqual(node["label"], "?")
                self.assertIn(node["size"], {"major", "minor"})
                self.assertIn(node["thread"], {"design", "situate"})
                self.assertEqual(set(node["position"]), POSITION_FIELDS)
                for value in node["position"].values():
                    self.assertIsInstance(value, int)
                    self.assertGreaterEqual(value, 0)
                    self.assertLessEqual(value, 100)

    def test_only_one_future_node_carries_the_two_public_rejection_records(self) -> None:
        future = self.constellation["future"]
        tagged = [node for node in future.values() if node.get("rejection_records")]
        self.assertEqual(len(tagged), 1)
        self.assertEqual(set(tagged[0]["rejection_records"]), EXPECTED_REJECTION_RECORDS)

        wall_badge_ids = {badge["id"] for badge in self.wall["badges"]}
        self.assertTrue(EXPECTED_REJECTION_RECORDS <= wall_badge_ids)

    def test_edges_are_neutral_valid_and_cover_each_future_node_once(self) -> None:
        edges = self.constellation["edges"]
        self.assertEqual(len(edges), 9)
        self.assertEqual({edge["id"] for edge in edges}, {f"edge-{index:02d}" for index in range(1, 10)})

        future_targets: list[str] = []
        for edge in edges:
            with self.subTest(edge=edge["id"]):
                self.assertEqual(set(edge), EDGE_FIELDS)
                self.assertRegex(edge["id"], r"^edge-\d{2}$")
                self.assertIn(edge["relation"], {"extends", "bridge", "future"})
                for endpoint_name in ("source", "target"):
                    endpoint = edge[endpoint_name]
                    self.assertEqual(set(endpoint), ENDPOINT_FIELDS)
                    self.assertIn(endpoint["kind"], {"paper", "thread", "future"})
                    valid_ids = {
                        "paper": self.paper_keys,
                        "thread": EXPECTED_THREADS,
                        "future": EXPECTED_FUTURE_IDS,
                    }[endpoint["kind"]]
                    self.assertIn(endpoint["id"], valid_ids)
                if edge["target"]["kind"] == "future":
                    future_targets.append(edge["target"]["id"])

        self.assertEqual(set(future_targets), EXPECTED_FUTURE_IDS)
        self.assertEqual(len(future_targets), len(set(future_targets)))

    def test_lifetime_and_annual_citation_freshness_are_truthfully_separate(self) -> None:
        metadata = self.lens["metadata"]
        self.assertIn("totals_last_synced", metadata)
        self.assertIn("yearly_snapshot_as_of", metadata)
        self.assertNotIn("last_synced", metadata)
        self.assertEqual(
            metadata["total_citations"],
            sum(paper["citation_total"] for paper in self.lens["papers"].values()),
        )
        annual_snapshot_total = sum(bucket["total"] for bucket in self.lens["citation_years"])
        self.assertLessEqual(annual_snapshot_total, metadata["total_citations"])
        self.assertIn("snapshot", metadata["yearly_note"].lower())
        self.assertIn("separately", metadata["yearly_note"].lower())

    def test_authorship_roles_use_one_canonical_first_author_value(self) -> None:
        roles = {paper["role"] for paper in self.lens["papers"].values()}
        self.assertLessEqual(roles, {"first-author", "coauthor"})
        self.assertIn("first-author", roles)
        rendered_sources = "\n".join(
            path.read_text(encoding="utf-8")
            for path in (SCHOLAR_INCLUDE_PATH, LENS_SCRIPT_PATH, CONSTELLATION_INCLUDE_PATH)
        )
        self.assertNotIn("co-first", rendered_sources)

    def test_page_is_list_first_and_constellation_is_progressive_enhancement(self) -> None:
        page = PUBLICATIONS_PAGE_PATH.read_text(encoding="utf-8")
        self.assertRegex(page, r'data-publication-view-switcher[^>]* hidden>')
        self.assertRegex(page, r'id="publication-list-view" data-publication-view-panel="list">')
        self.assertRegex(
            page,
            r'id="paper-constellation-view" data-publication-view-panel="constellation" hidden>',
        )
        self.assertLess(
            page.index("{% bibliography %}"),
            page.index('<div id="paper-constellation-view"'),
        )
        self.assertIn("{% include publications/paper_constellation.liquid %}", page)

    def test_constellation_runtime_is_deterministic_and_filtered_nodes_are_inert(self) -> None:
        script = CONSTELLATION_SCRIPT_PATH.read_text(encoding="utf-8")
        for forbidden_runtime in ("forceSimulation", "Math.random", "d3.", "requestIdleCallback"):
            with self.subTest(forbidden_runtime=forbidden_runtime):
                self.assertNotIn(forbidden_runtime, script)
        self.assertIn("paperButton.disabled = filtered", script)
        self.assertIn("paperButton.tabIndex = filtered ? -1 : 0", script)
        self.assertIn('node.setAttribute("aria-hidden", filtered ? "true" : "false")', script)
        self.assertIn('event.key !== "Escape"', script)
        self.assertIn('window.matchMedia("(prefers-reduced-motion: reduce)")', script)
        self.assertIn('window.matchMedia("(max-width: 820px)")', script)
        self.assertIn('new ResizeObserver(scheduleMobileGeometry)', script)
        self.assertIn("document.fonts?.ready.then(scheduleMobileGeometry)", script)

    def test_mobile_constellation_is_one_measured_trail_not_three_thread_cards(self) -> None:
        include = CONSTELLATION_INCLUDE_PATH.read_text(encoding="utf-8")
        script = CONSTELLATION_SCRIPT_PATH.read_text(encoding="utf-8")

        self.assertNotIn("paper-constellation-mobile-thread", include)
        self.assertIn('class="paper-constellation-mobile-trail"', include)
        self.assertIn("data-constellation-mobile-rail", include)
        self.assertIn("data-constellation-mobile-edge", include)
        self.assertIn("data-constellation-mobile-membership", include)
        self.assertIn("data-constellation-mobile-paper-row", include)
        self.assertIn("data-constellation-detail-slot", include)
        self.assertIn("data-constellation-detail-dock", include)
        self.assertIn('aria-label="Seven anonymous future-work nodes"', include)
        self.assertIn('aria-label="Published papers, newest first"', include)
        self.assertIn("mobileCurve", script)
        self.assertIn("placeMobileDetail", script)
        self.assertNotIn("setInterval", script)

    def test_future_work_rendering_has_an_allowlisted_public_vocabulary(self) -> None:
        allowed_values = {
            "?",
            "major",
            "minor",
            "design",
            "situate",
            "chi-rejection",
            "uist-rejection",
        }

        def string_values(value) -> set[str]:
            if isinstance(value, str):
                return {value}
            if isinstance(value, dict):
                values: set[str] = set()
                for child in value.values():
                    values.update(string_values(child))
                return values
            if isinstance(value, list):
                values = set()
                for child in value:
                    values.update(string_values(child))
                return values
            return set()

        self.assertLessEqual(string_values(self.constellation["future"]), allowed_values)

        include = CONSTELLATION_INCLUDE_PATH.read_text(encoding="utf-8")
        script = CONSTELLATION_SCRIPT_PATH.read_text(encoding="utf-8")
        self.assertNotRegex(include, r"future_record\.(?:name|title|author|collaborator|draft|venue|hint)")
        for analytics_token in ("dataLayer", "gtag(", "analytics", "telemetry"):
            with self.subTest(analytics_token=analytics_token):
                self.assertNotIn(analytics_token, script)

    def test_origin_routes_and_reproduction_artifact_are_real_and_semantic(self) -> None:
        self.assertTrue(PROJECT_PATH.is_file())
        self.assertTrue(REPRODUCTION_GUIDE_PATH.is_file())
        self.assertTrue(TEASER_PATH.is_file())

        project = PROJECT_PATH.read_text(encoding="utf-8")
        guide = REPRODUCTION_GUIDE_PATH.read_text(encoding="utf-8")
        self.assertIn("{{ '/publications/' | relative_url }}", project)
        self.assertNotIn("?view=constellation", project)
        self.assertIn("assets/img/project_pics/paper-constellation/paper-constellation-desktop-surface-6832a6a05-1440-light.png", project)
        self.assertEqual(TEASER_PATH.read_bytes()[:8], b"\x89PNG\r\n\x1a\n")
        self.assertIn("totals_last_synced", guide)
        self.assertIn("yearly_snapshot_as_of", guide)

        expected_origins = {
            CONSTELLATION_INCLUDE_PATH: ("/projects/paper-constellation/", "Read how Paper Constellation began"),
            SCHOLAR_INCLUDE_PATH: ("/projects/scholar-lens/", "Read how Scholar Lens began"),
            WALL_INCLUDE_PATH: ("/projects/wall-of-rejection/", "Read how the Wall of Rejection began"),
        }
        for path, (route, label) in expected_origins.items():
            with self.subTest(path=path.name):
                source = path.read_text(encoding="utf-8")
                self.assertIn(route, source)
                self.assertIn("{% include widget_origin_link.liquid", source)
                self.assertIn(f'label="{label}"', source)
                origin_call = next(line for line in source.splitlines() if "widget_origin_link.liquid" in line)
                self.assertNotIn("?", origin_call)

        origin_include = WIDGET_ORIGIN_INCLUDE_PATH.read_text(encoding="utf-8")
        self.assertIn('class="widget-origin-link', origin_include)
        self.assertIn('data-affordance="origin"', origin_include)
        self.assertIn('<svg class="widget-origin-mark"', origin_include)
        self.assertIn('focusable="false"', origin_include)
        self.assertIn('class="widget-origin-tooltip"', origin_include)
        self.assertIn("How this began", origin_include)
        self.assertNotRegex(origin_include, r">\s*\?\s*<")

        constellation_include = CONSTELLATION_INCLUDE_PATH.read_text(encoding="utf-8")
        self.assertIn("{{ future_record.label }}", constellation_include)
        self.assertEqual({node["label"] for node in self.constellation["future"].values()}, {"?"})

        self.assertIn("scholar-lens-heading-actions", SCHOLAR_INCLUDE_PATH.read_text(encoding="utf-8"))
        self.assertIn("rejection-wall-heading-actions", WALL_INCLUDE_PATH.read_text(encoding="utf-8"))

    def test_inspiration_credit_and_debut_provenance_are_exact(self) -> None:
        project = PROJECT_PATH.read_text(encoding="utf-8")
        guide = REPRODUCTION_GUIDE_PATH.read_text(encoding="utf-8")
        for artifact_name, artifact in (("project", project), ("guide", guide)):
            for source in (
                "Nadieh Bremer",
                "https://royalconstellations.visualcinnamon.com/",
                "https://www.datasketch.es/project/royal-constellations",
                "John Thompson",
                "https://jrthomp.com/",
            ):
                with self.subTest(artifact=artifact_name, source=source):
                    self.assertIn(source, artifact)

            self.assertNotIn("canvas implementation", artifact.lower())
            for provenance in (
                "855f1bce8",
                "2026-07-15T04:10:52-07:00",
                "eeb0a5764",
                "2026-07-15T16:51:26-07:00",
            ):
                with self.subTest(artifact=artifact_name, provenance=provenance):
                    self.assertIn(provenance, artifact)

        self.assertIn("D3 force-directed SVG implementation", guide)
        self.assertIn("D3 force-directed SVG implementation", project)
        self.assertIn("server-rendered HTML with fixed SVG geometry", project)


if __name__ == "__main__":
    unittest.main()
