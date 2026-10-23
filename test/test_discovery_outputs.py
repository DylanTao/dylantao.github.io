from __future__ import annotations

import copy
import html
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


REPO_ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("discovery_validator", REPO_ROOT / "test" / "validate_publication_outputs.py")
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


class DiscoveryFixture:
    """A small generated site with independent human, catalog, and schema projections."""

    def __init__(self, root: Path, baseurl: str) -> None:
        self.site = root / "site"
        self.source = root / "source"
        self.profile = f"https://example.test{baseurl}/"
        self.person_id = self.profile.rstrip("/") + "#sirui-tao"
        self.resume = {"basics": {"name": "Sirui Tao", "summary": "Research through design."}}
        self.projects = [
            {"slug": "research", "human_url": self.url("projects/research/"), "category": "research"},
            {"slug": "pip", "human_url": self.url("projects/p/"), "category": "fun"},
        ]
        self.posts = [
            {"route": "blog/2026/first-note/", "date": "2026-04-27"},
            {"route": "blog/2026/second-note/", "date": "2026-10-23"},
        ]
        self.pages: dict[str, dict] = {}
        self.write_json(self.source / "_data" / "resume.json", self.resume)
        self.write_json(self.site / "assets" / "json" / "resume.json", self.resume)
        self.write_json(self.site / "ai" / "publications.json", {"canonical_profile": self.profile})
        self.write_projects()
        self.add_page("", [{"@type": "Person", "@id": self.person_id, "name": "Sirui Tao"}])
        self.add_page("projects/")
        self.add_page("projects/p/record/")
        self.add_page("blog/2026/")
        self.add_page("blog/page/2/")
        self.add_page("blog/2026/secret-globe/")
        for project in self.projects:
            route = project["human_url"].removeprefix(self.profile)
            self.add_page(route, [{"@type": "CreativeWork", "url": project["human_url"], "genre": "Research project" if project["category"] == "research" else "Website experiment"}], anchor=f"project-{project['slug']}")
        for post in self.posts:
            self.write_post(post)
        self.write_ai()
        self.add_page("cv/", [
            {"@type": "Person", "@id": self.person_id, "name": "Sirui Tao"},
            {"@type": "AboutPage", "url": self.url("cv/"), "mainEntity": {"@id": self.person_id}},
        ], alternates=[self.url("assets/json/resume.json")], anchor="cv")

    def url(self, route: str) -> str:
        return self.profile + route

    @staticmethod
    def write_json(path: Path, value) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding="utf-8")

    def write_projects(self) -> None:
        self.write_json(self.site / "ai" / "projects.json", {"projects": self.projects})

    def add_page(self, route: str, schemas=None, *, body: str = "", alternates=None, anchor: str = "") -> None:
        self.pages[route] = {"schemas": schemas or [], "body": body, "alternates": alternates or [], "anchor": anchor}
        self.render_page(route)

    def render_page(self, route: str) -> None:
        page = self.pages[route]
        scripts = "".join(f'<script type="application/ld+json">{json.dumps(node)}</script>' for node in page["schemas"])
        alternates = "".join(f'<link rel="alternate" type="application/json" href="{html.escape(url, quote=True)}">' for url in page["alternates"])
        path = self.site / route / "index.html"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            f'<html><head><link rel="canonical" href="{self.url(route)}">{scripts}{alternates}</head>'
            f'<body><a data-site-format="ai" href="{self.url("ai/")}#{page["anchor"]}">AI</a>{page["body"]}</body></html>',
            encoding="utf-8",
        )

    def write_ai(self) -> None:
        ids = ["writing", "cv", "projects", *(f"project-{project['slug']}" for project in self.projects)]
        body = "".join(f'<section id="{identifier}"></section>' for identifier in ids)
        body += '<ol class="ai-writing-list">'
        for post in self.posts:
            body += f'<li><time datetime="{post["date"]}T12:00:00Z">{post["date"]}</time><a href="{self.url(post["route"])}">A note</a></li>'
        body += "</ol>"
        self.add_page("ai/", body=body)

    def write_post(self, post: dict) -> None:
        self.add_page(post["route"], [{"@type": "BlogPosting", "url": self.url(post["route"]), "datePublished": post["date"], "dateModified": post["date"]}], anchor="writing")

    def validate(self) -> None:
        VALIDATOR.validate_discovery_outputs(self.site, source_dir=self.source)


class DiscoveryOutputsTests(unittest.TestCase):
    def fixture(self, baseurl: str = "") -> DiscoveryFixture:
        cache = REPO_ROOT / ".jekyll-cache"
        cache.mkdir(exist_ok=True)
        temporary = tempfile.TemporaryDirectory(prefix="discovery-fixture-", dir=cache)
        self.addCleanup(temporary.cleanup)
        return DiscoveryFixture(Path(temporary.name), baseurl)

    def test_valid_generated_projections_work_with_empty_and_nonempty_baseurl(self) -> None:
        for baseurl in ("", "/al-folio"):
            with self.subTest(baseurl=baseurl):
                self.fixture(baseurl).validate()

    def test_writing_coverage_is_derived_from_the_index_instead_of_a_fixed_count(self) -> None:
        fixture = self.fixture()
        new_post = {"route": "blog/2027/a-future-note/", "date": "2027-02-14"}
        fixture.posts.append(new_post)
        fixture.write_post(new_post)
        fixture.write_ai()
        fixture.validate()

    def test_archives_pagination_and_secret_pages_cannot_claim_to_be_posts(self) -> None:
        for route in ("blog/2026/", "blog/page/2/", "blog/2026/secret-globe/"):
            with self.subTest(route=route):
                fixture = self.fixture()
                fixture.add_page(route, [{"@type": "BlogPosting", "url": fixture.url(route), "datePublished": "2025-01-01"}])
                with self.assertRaisesRegex(AssertionError, "not an actual writing entry"):
                    fixture.validate()

    def test_actual_writing_entries_need_exactly_one_blog_schema(self) -> None:
        for duplicate in (False, True):
            with self.subTest(duplicate=duplicate):
                fixture = self.fixture()
                route = fixture.posts[0]["route"]
                schemas = fixture.pages[route]["schemas"]
                fixture.pages[route]["schemas"] = schemas * 2 if duplicate else []
                fixture.render_page(route)
                with self.assertRaisesRegex(AssertionError, "exactly one BlogPosting"):
                    fixture.validate()

    def test_post_urls_and_publication_dates_must_match_the_visible_writing_index(self) -> None:
        for field, value, message in (
            ("url", "https://example.test/blog/another/", "BlogPosting URL"),
            ("datePublished", "2025-01-01", "datePublished"),
            ("datePublished", "not a date", "real publication date"),
            ("dateModified", "2020-01-01", "predates publication"),
        ):
            with self.subTest(field=field, value=value):
                fixture = self.fixture()
                route = fixture.posts[0]["route"]
                fixture.pages[route]["schemas"][0][field] = value
                fixture.render_page(route)
                with self.assertRaisesRegex(AssertionError, message):
                    fixture.validate()

    def test_repeated_writing_targets_are_not_counted_as_independent_posts(self) -> None:
        fixture = self.fixture()
        fixture.posts.append(copy.deepcopy(fixture.posts[0]))
        fixture.write_ai()
        with self.assertRaisesRegex(AssertionError, "repeats a post URL"):
            fixture.validate()

    def test_project_indexes_and_technical_records_are_not_authored_project_schemas(self) -> None:
        for route in ("projects/", "projects/p/record/"):
            with self.subTest(route=route):
                fixture = self.fixture()
                fixture.add_page(route, [{"@type": "CreativeWork", "url": fixture.url(route), "genre": "Research project"}])
                with self.assertRaisesRegex(AssertionError, "not an authored project"):
                    fixture.validate()

    def test_project_genre_cannot_promote_playful_experiments_into_research(self) -> None:
        for route, genre in (("projects/research/", "Research Publication"), ("projects/research/", "Personal project"), ("projects/p/", "Research project")):
            with self.subTest(route=route, genre=genre):
                fixture = self.fixture()
                fixture.pages[route]["schemas"][0]["genre"] = genre
                fixture.render_page(route)
                with self.assertRaisesRegex(AssertionError, "genre must match project category"):
                    fixture.validate()

    def test_project_schema_uses_its_catalog_route_and_exists_once(self) -> None:
        for mutation, message in (("url", "CreativeWork URL"), ("missing", "exactly one CreativeWork"), ("duplicate", "exactly one CreativeWork")):
            with self.subTest(mutation=mutation):
                fixture = self.fixture()
                route = "projects/p/"
                if mutation == "url":
                    fixture.pages[route]["schemas"][0]["url"] = fixture.url("projects/pip/")
                elif mutation == "missing":
                    fixture.pages[route]["schemas"] = []
                else:
                    fixture.pages[route]["schemas"] *= 2
                fixture.render_page(route)
                with self.assertRaisesRegex(AssertionError, message):
                    fixture.validate()

    def test_human_route_rename_must_keep_the_actual_stable_ai_anchor(self) -> None:
        for baseurl in ("", "/al-folio"):
            with self.subTest(baseurl=baseurl):
                fixture = self.fixture(baseurl)
                fixture.pages["projects/p/"]["anchor"] = "project-p"
                fixture.render_page("projects/p/")
                with self.assertRaisesRegex(AssertionError, "no matching fragment: project-p"):
                    fixture.validate()

    def test_cv_about_page_must_reference_the_same_person_as_the_homepage(self) -> None:
        for mutation, message in (("missing", "one AboutPage"), ("wrong-person", "canonical Person"), ("wrong-name", "Person name"), ("wrong-home-name", "homepage Person name")):
            with self.subTest(mutation=mutation):
                fixture = self.fixture()
                if mutation == "missing":
                    fixture.pages["cv/"]["schemas"].pop()
                elif mutation == "wrong-person":
                    fixture.pages["cv/"]["schemas"][1]["mainEntity"]["@id"] = "https://example.test/#someone-else"
                elif mutation == "wrong-name":
                    fixture.pages["cv/"]["schemas"][0]["name"] = "Someone Else"
                else:
                    fixture.pages[""]["schemas"][0]["name"] = "Someone Else"
                    fixture.render_page("")
                fixture.render_page("cv/")
                with self.assertRaisesRegex(AssertionError, message):
                    fixture.validate()

    def test_cv_json_is_discoverable_and_is_the_current_canonical_resume(self) -> None:
        for mutation, message in (("missing-alternate", "JSON Resume alternate"), ("missing-file", "missing generated discovery target"), ("stale-json", "match canonical _data/resume.json")):
            with self.subTest(mutation=mutation):
                fixture = self.fixture()
                if mutation == "missing-alternate":
                    fixture.pages["cv/"]["alternates"] = []
                    fixture.render_page("cv/")
                elif mutation == "missing-file":
                    (fixture.site / "assets" / "json" / "resume.json").unlink()
                else:
                    fixture.write_json(fixture.site / "assets" / "json" / "resume.json", {"basics": {"name": "Outdated Person"}})
                with self.assertRaisesRegex(AssertionError, message):
                    fixture.validate()

    def test_a_search_action_cannot_advertise_a_nonexistent_route(self) -> None:
        fixture = self.fixture()
        fixture.pages[""]["schemas"].append({"@type": "WebSite", "potentialAction": {"@type": "SearchAction", "target": fixture.url("search?q={search_term_string}")}})
        fixture.render_page("")
        with self.assertRaisesRegex(AssertionError, "missing generated discovery target.*search"):
            fixture.validate()
        fixture.add_page("search")
        fixture.validate()

    def test_nested_schema_types_do_not_mistake_a_project_venue_for_another_authored_work(self) -> None:
        fixture = self.fixture()
        fixture.pages["projects/research/"]["schemas"][0]["isPartOf"] = {"@type": "CreativeWork", "name": "A real proceedings volume"}
        fixture.render_page("projects/research/")
        fixture.validate()

    def test_invalid_json_ld_fails_with_the_affected_page(self) -> None:
        fixture = self.fixture()
        path = fixture.site / "blog" / "2026" / "index.html"
        text = path.read_text(encoding="utf-8").replace("</head>", '<script type="application/ld+json">{"@type": broken}</script></head>')
        path.write_text(text, encoding="utf-8")
        with self.assertRaisesRegex(AssertionError, r"blog.*2026.*invalid JSON-LD"):
            fixture.validate()

    def test_discovery_targets_cannot_escape_the_canonical_site_or_baseurl(self) -> None:
        for href in ("https://elsewhere.test/ai/#writing", "https://example.test/ai/#writing", "https://example.test/al-folio/%2e%2e/ai/#writing"):
            with self.subTest(href=href):
                fixture = self.fixture("/al-folio")
                path = fixture.site / "cv" / "index.html"
                text = path.read_text(encoding="utf-8").replace(f'{fixture.url("ai/")}#cv', href)
                path.write_text(text, encoding="utf-8")
                with self.assertRaisesRegex(AssertionError, "canonical site|baseurl|generated site|missing generated discovery target"):
                    fixture.validate()


if __name__ == "__main__":
    unittest.main()
