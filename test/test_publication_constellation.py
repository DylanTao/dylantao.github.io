from __future__ import annotations

import re
import unittest
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
CONSTELLATION_PATH = REPO_ROOT / "_data" / "publication_constellation.yml"
BIB_PATH = REPO_ROOT / "_bibliography" / "papers.bib"
WALL_PATH = REPO_ROOT / "_data" / "wall_of_rejection.yml"

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


if __name__ == "__main__":
    unittest.main()
