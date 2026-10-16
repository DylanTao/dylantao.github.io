"""Technical design records stay readable, linked and true to the repository (2026-10-15).

Each record in _data/design_records/ is the design space for one long-running project: its page under
/projects/<project>/record/, its JSON endpoint and bin/design_record_brief.py all read the same data.
These checks keep that data trustworthy for the next person or agent: the schema holds, every file
path is in the repository, every source and system resolves, the history stays in order, every commit
exists in Git history, and each project page links to its record.
"""

from __future__ import annotations

import datetime as dt
import importlib.util
import json
import re
import subprocess
import unittest
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
RECORDS_DIR = REPO_ROOT / "_data" / "design_records"
PAGES_DIR = REPO_ROOT / "_pages"
PROJECTS_DIR = REPO_ROOT / "_projects"
JSON_DIR = REPO_ROOT / "assets" / "json" / "design-records"
INCLUDE = REPO_ROOT / "_includes" / "design_record.liquid"
BRIEF_SCRIPT = REPO_ROOT / "bin" / "design_record_brief.py"

REPOSITORY = "https://github.com/DylanTao/dylantao.github.io"
STATUSES = {"shipped", "experimental", "retired"}
READINESS = ["ready", "needs-measurement", "needs-decision", "needs-research", "blocked"]
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SHA_PATTERN = re.compile(r"^[0-9a-f]{7,40}$")
URL_PATTERN = re.compile(r"^https?://\S+$")
RESERVED_ANCHORS = {
    "main",
    "navbar",
    "footer",
    "progress",
    "design-record-title",
    "design-history",
    "design-history-title",
    "open-problems",
    "open-problems-title",
    "before-changing",
    "before-changing-title",
    "sources",
    "sources-title",
}
# Hype the voice rules exclude; the records describe bounded browser work.
BANNED_PHRASES = ("film quality", "film-quality", "cutting-edge", "world-class", "revolutionary", "groundbreaking")
# Private routes stay out of public pages and JSON.
PRIVATE_TEXT = ("sirui-research-thoughts",)


def load_records() -> dict[str, dict]:
    return {path.stem: yaml.safe_load(path.read_text(encoding="utf-8")) for path in sorted(RECORDS_DIR.glob("*.yml"))}


def front_matter(path: Path, required: bool = True) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\s*\n(.*?)\n---\s*\n", text, flags=re.DOTALL)
    if not match:
        if required:
            raise AssertionError(f"{path.relative_to(REPO_ROOT)} has no front matter")
        return {}
    return yaml.safe_load(match.group(1)) or {}


def as_date(value) -> dt.date:
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    return dt.date.fromisoformat(str(value))


def git(*args: str) -> str | None:
    try:
        result = subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=False)
    except FileNotFoundError:
        return None
    return result.stdout if result.returncode == 0 else None


def repository_files() -> set[str] | None:
    """Tracked files plus untracked ones that are not ignored, or None without Git."""
    listing = git("ls-files", "--cached", "--others", "--exclude-standard", "-z")
    if listing is None:
        return None
    return {path for path in listing.split("\0") if path}


def techniques(record: dict):
    for system in record["systems"]:
        for technique in system["techniques"]:
            yield system, technique


def text_fields(value):
    if isinstance(value, dict):
        for item in value.values():
            yield from text_fields(item)
    elif isinstance(value, list):
        for item in value:
            yield from text_fields(item)
    elif isinstance(value, str):
        yield value


class DesignRecordSchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.records = load_records()

    def test_three_records_exist_and_name_themselves(self) -> None:
        self.assertTrue({"homepage-desk-scene", "pip", "website-revamp"} <= set(self.records))
        for slug, record in self.records.items():
            with self.subTest(slug=slug):
                self.assertEqual(record.get("schema_version"), 1)
                self.assertEqual(record.get("slug"), slug)
                self.assertEqual(record.get("repository"), REPOSITORY)
                self.assertEqual(record.get("branch"), "main")
                for key in ("title", "summary", "record_url", "json_url"):
                    self.assertIsInstance(record.get(key), str, key)
                    self.assertTrue(record[key].strip(), key)
                as_date(record["updated"])
                project = record["project"]
                for key in ("title", "url", "source"):
                    self.assertIsInstance(project.get(key), str, key)
                self.assertTrue(record["record_url"].startswith(project["url"]), "a record lives under its project's route")
                self.assertEqual(record["record_url"], project["url"] + "record/")
                self.assertEqual(record["json_url"], f"/assets/json/design-records/{slug}.json")

    def test_reading_constraints_and_tests_are_listed(self) -> None:
        for slug, record in self.records.items():
            with self.subTest(slug=slug):
                self.assertTrue(record.get("read_first"))
                for doc in record["read_first"]:
                    self.assertTrue(doc.get("path") and doc.get("why"))
                self.assertTrue(record.get("constraints"))
                self.assertTrue(all(isinstance(item, str) and item.strip() for item in record["constraints"]))
                self.assertTrue(record.get("tests"))
                for check in record["tests"]:
                    self.assertTrue(check.get("path") and check.get("covers"))

    def test_systems_and_techniques_follow_the_schema(self) -> None:
        for slug, record in self.records.items():
            system_ids = [system["id"] for system in record["systems"]]
            technique_ids = [technique["id"] for _, technique in techniques(record)]
            problem_ids = [problem["id"] for problem in record.get("open_problems") or []]
            with self.subTest(slug=slug, check="ids"):
                self.assertTrue(system_ids)
                self.assertEqual(len(system_ids), len(set(system_ids)), "duplicate system id")
                self.assertEqual(len(technique_ids), len(set(technique_ids)), "duplicate technique id")
                self.assertEqual(len(problem_ids), len(set(problem_ids)), "duplicate open problem id")
                # The page gives each system and technique an id and a heading id (`<id>-title`).
                anchors = set(system_ids) | set(technique_ids) | {f"{identifier}-title" for identifier in system_ids + technique_ids}
                self.assertEqual(len(anchors), (len(system_ids) + len(technique_ids)) * 2, "a technique id collides with a system anchor")
                self.assertFalse(anchors & RESERVED_ANCHORS, "an id collides with a page anchor")
                for identifier in system_ids + technique_ids + problem_ids:
                    self.assertRegex(identifier, ID_PATTERN)
            for system in record["systems"]:
                with self.subTest(slug=slug, system=system["id"]):
                    self.assertTrue(system.get("name") and system.get("summary"))
                    self.assertTrue(system.get("techniques"), "a system needs at least one technique")
            for system, technique in techniques(record):
                with self.subTest(slug=slug, technique=technique["id"]):
                    for key in ("name", "what", "how"):
                        self.assertIsInstance(technique.get(key), str, key)
                        self.assertTrue(technique[key].strip(), key)
                    self.assertIn(technique.get("status"), STATUSES)
                    if "since" in technique:
                        as_date(technique["since"])
                    for key in ("files", "sources", "limits", "next"):
                        self.assertIsInstance(technique.get(key), list, key)
                    for key in ("tests",):
                        self.assertIsInstance(technique.get(key, []), list, key)
                    for file in technique["files"]:
                        self.assertTrue(file.get("path"))
                    for limit in technique["limits"]:
                        self.assertIsInstance(limit, str)
                    for step in technique["next"]:
                        self.assertIsInstance(step.get("move"), str)
                        self.assertTrue(step["move"].strip())
                        self.assertIn(step.get("readiness"), READINESS)
                    if technique["status"] == "retired":
                        retired = technique.get("retired") or {}
                        self.assertTrue(retired.get("reason"), "a retired technique says why")
                        as_date(retired.get("date"))
                    else:
                        self.assertTrue(technique["files"], "a live technique names the files that hold it")
                        self.assertNotIn("retired", technique)

    def test_history_moves_are_complete_and_in_order(self) -> None:
        for slug, record in self.records.items():
            system_ids = {system["id"] for system in record["systems"]}
            previous = None
            anchors = set()
            self.assertTrue(record.get("history"), f"{slug} needs a design history")
            for index, move in enumerate(record["history"]):
                with self.subTest(slug=slug, move=move.get("title", index)):
                    for key in ("title", "frame", "move", "backtalk", "reframe"):
                        self.assertIsInstance(move.get(key), str, key)
                        self.assertTrue(move[key].strip(), key)
                    self.assertIn(move.get("system"), system_ids)
                    date = as_date(move["date"])
                    if previous:
                        self.assertGreaterEqual(date, previous, "append moves in date order, oldest first")
                    previous = date
                    anchor = (date, re.sub(r"[^a-z0-9]+", "-", move["title"].lower()).strip("-"))
                    self.assertNotIn(anchor, anchors, "two moves share a date and title")
                    anchors.add(anchor)
                    for dimension in move.get("dimensions") or []:
                        self.assertIsInstance(dimension, str)
                    if "commit" in move:
                        self.assertIsInstance(move["commit"], str, "quote commit shas so YAML keeps them as text")
                        self.assertRegex(move["commit"], SHA_PATTERN)

    def test_open_problems_follow_the_schema(self) -> None:
        for slug, record in self.records.items():
            system_ids = {system["id"] for system in record["systems"]}
            for problem in record.get("open_problems") or []:
                with self.subTest(slug=slug, problem=problem.get("id")):
                    self.assertTrue(problem.get("title") and problem.get("why_hard"))
                    self.assertIn(problem.get("system"), system_ids)
                    self.assertIn(problem.get("readiness"), READINESS)
                    self.assertIsInstance(problem.get("candidate_moves"), list)
                    self.assertTrue(problem["candidate_moves"], "an open problem proposes at least one move")
                    self.assertIsInstance(problem.get("sources"), list)

    def test_every_source_resolves_and_is_cited(self) -> None:
        for slug, record in self.records.items():
            sources = record.get("sources") or []
            ids = [source.get("id") for source in sources]
            with self.subTest(slug=slug, check="unique"):
                self.assertEqual(len(ids), len(set(ids)), "duplicate source id")
            for source in sources:
                with self.subTest(slug=slug, source=source.get("id")):
                    self.assertRegex(source["id"], ID_PATTERN)
                    self.assertTrue(source.get("label") and source.get("citation"))
                    self.assertRegex(source.get("url", ""), URL_PATTERN)
            cited = []
            for _, technique in techniques(record):
                cited += technique["sources"]
            for move in record["history"]:
                cited += move.get("sources") or []
            for problem in record.get("open_problems") or []:
                cited += problem["sources"]
            with self.subTest(slug=slug, check="references"):
                self.assertEqual(sorted(set(cited) - set(ids)), [], "a source id does not resolve")
                self.assertEqual(sorted(set(ids) - set(cited)), [], "a listed source is never cited")

    def test_text_keeps_to_the_voice_and_privacy_rules(self) -> None:
        for slug, record in self.records.items():
            text = "\n".join(text_fields(record)).lower()
            for phrase in BANNED_PHRASES + PRIVATE_TEXT:
                with self.subTest(slug=slug, phrase=phrase):
                    self.assertNotIn(phrase, text)

    def test_the_record_serializes_to_json(self) -> None:
        for slug, record in self.records.items():
            with self.subTest(slug=slug):
                json.loads(json.dumps(record, default=str))


class DesignRecordRepositoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.records = load_records()
        cls.files = repository_files()

    def assert_in_repository(self, path: str) -> None:
        self.assertFalse(path.startswith("/") or ".." in Path(path).parts, f"{path} must be a repository path")
        target = REPO_ROOT / path
        if path.endswith("/"):
            self.assertTrue(target.is_dir(), f"{path} is not a directory")
            if self.files is not None:
                self.assertTrue(any(name.startswith(path) for name in self.files), f"{path} has no files in the repository")
        else:
            self.assertTrue(target.is_file(), f"{path} does not exist")
            if self.files is not None:
                self.assertIn(path, self.files, f"{path} is ignored by Git, so its GitHub link would be missing")

    def test_every_file_path_is_in_the_repository(self) -> None:
        for slug, record in self.records.items():
            paths = [record["project"]["source"]]
            paths += [doc["path"] for doc in record["read_first"]]
            paths += [check["path"] for check in record["tests"]]
            for _, technique in techniques(record):
                paths += [file["path"] for file in technique["files"]]
                paths += technique.get("tests", [])
            for path in paths:
                with self.subTest(slug=slug, path=path):
                    self.assert_in_repository(path)

    def test_commits_exist_in_history(self) -> None:
        shas = []
        for slug, record in self.records.items():
            shas += [(slug, move["commit"]) for move in record["history"] if move.get("commit")]
            shas += [(slug, t["retired"]["commit"]) for _, t in techniques(record) if (t.get("retired") or {}).get("commit")]
        for slug, sha in shas:
            self.assertRegex(sha, SHA_PATTERN, f"{slug}: {sha}")
        if git("rev-parse", "--is-shallow-repository") in (None, "true\n"):
            self.skipTest("Git history is unavailable or shallow here; the full checkout verifies commits.")
        history = (git("rev-list", "HEAD") or "").split()
        for slug, sha in shas:
            with self.subTest(slug=slug, sha=sha):
                self.assertTrue(any(full.startswith(sha) for full in history), f"{sha} is not in this branch's history")


class DesignRecordRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.records = load_records()
        cls.pages = {}
        for path in sorted(PAGES_DIR.glob("*.md")):
            # Some excluded starter pages carry no front matter at all.
            data = front_matter(path, required=False)
            if data.get("record"):
                cls.pages[data["record"]] = (path, data)

    def test_each_record_has_one_page_under_its_project(self) -> None:
        self.assertEqual(set(self.pages), set(self.records), "every record has a page and every record page has a record")
        for slug, record in self.records.items():
            path, data = self.pages[slug]
            with self.subTest(slug=slug):
                self.assertEqual(data.get("permalink"), record["record_url"])
                self.assertEqual(data.get("title"), record["title"])
                self.assertFalse(data.get("nav"), "record pages stay out of the navbar")
                self.assertTrue(data.get("description"))
                self.assertTrue(str(data.get("ai_anchor", "")).startswith("#project-"))
                self.assertIn("{% include design_record.liquid slug=page.record %}", path.read_text(encoding="utf-8"))

    def test_records_are_not_projects(self) -> None:
        # A record in the _projects collection would add a project card and change the site's counts.
        record_routes = {record["record_url"] for record in self.records.values()}
        for path in sorted(PROJECTS_DIR.glob("*.md")):
            with self.subTest(project=path.name):
                self.assertNotIn(front_matter(path, required=False).get("permalink"), record_routes)

    def test_each_project_page_links_to_its_record(self) -> None:
        for slug, record in self.records.items():
            source = (REPO_ROOT / record["project"]["source"]).read_text(encoding="utf-8")
            with self.subTest(slug=slug):
                self.assertIn(f"{{{{ '{record['record_url']}' | relative_url }}}}", source)
                page_route = front_matter(REPO_ROOT / record["project"]["source"]).get("permalink")
                if page_route:
                    self.assertEqual(page_route, record["project"]["url"])
                else:
                    self.assertEqual(record["project"]["url"], f"/projects/{Path(record['project']['source']).stem}/")

    def test_each_record_has_a_json_endpoint(self) -> None:
        for slug, record in self.records.items():
            path = JSON_DIR / f"{slug}.json"
            with self.subTest(slug=slug):
                self.assertTrue(path.is_file())
                data = front_matter(path)
                self.assertEqual(data.get("permalink"), record["json_url"])
                self.assertEqual(data.get("layout"), "none")
                self.assertIs(data.get("sitemap"), False)
                self.assertIn(f'site.data.design_records["{slug}"] | jsonify', path.read_text(encoding="utf-8"))

    def test_the_include_renders_every_part_of_a_record(self) -> None:
        include = INCLUDE.read_text(encoding="utf-8")
        self.assertIn("site.data.design_records[include.slug]", include)
        for field in ("technique.files", "technique.sources", "technique.limits", "technique.next", "record.history", "record.open_problems", "record.sources", "record.constraints"):
            with self.subTest(field=field):
                self.assertIn(field, include)


class DesignRecordBriefTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        spec = importlib.util.spec_from_file_location("design_record_brief", BRIEF_SCRIPT)
        cls.brief = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.brief)
        cls.records = load_records()

    def test_briefs_rank_candidates_by_readiness(self) -> None:
        for slug, record in self.records.items():
            with self.subTest(slug=slug):
                brief = self.brief.build_brief(record, None, 1000)
                self.assertTrue(brief["candidates"], "a record proposes at least one next move")
                order = [READINESS.index(item["readiness"]) for item in brief["candidates"]]
                self.assertEqual(order, sorted(order))
                self.assertEqual(len(brief["systems"]), len(record["systems"]))
                self.assertIn("## Candidate moves", self.brief.markdown(brief))

    def test_a_brief_can_focus_on_one_system(self) -> None:
        record = self.records["homepage-desk-scene"]
        brief = self.brief.build_brief(record, "wind-plants", 1000)
        self.assertEqual([system["id"] for system in brief["systems"]], ["wind-plants"])
        self.assertTrue(all(item["system"] == "wind-plants" for item in brief["candidates"]))

    def test_retired_techniques_are_reported_not_proposed(self) -> None:
        record = self.records["pip"]
        brief = self.brief.build_brief(record, "duh-body", 1000)
        retired = [item["name"] for system in brief["systems"] for item in system["retired"]]
        self.assertIn("A soft-body preview", retired)
        self.assertNotIn("duh-softbody", [item["anchor"] for item in brief["candidates"]])


if __name__ == "__main__":
    unittest.main()
