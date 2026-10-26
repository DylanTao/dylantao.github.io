"""The 3D home's build diary: _data/home_world_diary.yml, its images and the pages that render it.

The diary is data so that future work appends an entry instead of rewriting markup. These checks keep an
appended entry honest: a real date in order, a note that says who noticed, images that exist at the sizes
the page asks for, alt text, and links that resolve.
"""

from __future__ import annotations

import re
import struct
import unittest
from datetime import date
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
DIARY = REPO_ROOT / "_data" / "home_world_diary.yml"
PROJECTS_DIR = REPO_ROOT / "_projects"
PAGES_DIR = REPO_ROOT / "_pages"
INCLUDE = REPO_ROOT / "_includes" / "build-diary.liquid"
COMPARE_INCLUDE = REPO_ROOT / "_includes" / "build-diary-compare.liquid"
STYLES = REPO_ROOT / "_sass" / "_build-diary.scss"
SCRIPT = REPO_ROOT / "assets" / "js" / "build-diary.mjs"
MAIN_STYLESHEET = REPO_ROOT / "assets" / "css" / "main.scss"

STATUSES = {"done", "in-progress", "open"}
NOTE_AUTHORS = {"sirui", "review"}
COMPARE_KINDS = {"slider", "pair"}
MAX_IMAGE_BYTES = 200 * 1024


def webp_size(path: Path) -> tuple[int, int]:
    """Width and height of a WebP file, read from its header (no imaging library needed)."""
    data = path.read_bytes()[:64]
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise AssertionError(f"{path} is not a WebP file")
    chunk = data[12:16]
    if chunk == b"VP8X":
        width = 1 + int.from_bytes(data[24:27], "little")
        height = 1 + int.from_bytes(data[27:30], "little")
        return width, height
    if chunk == b"VP8 ":
        if data[23:26] != b"\x9d\x01\x2a":
            raise AssertionError(f"{path} has no VP8 start code")
        width, height = struct.unpack("<HH", data[26:30])
        return width & 0x3FFF, height & 0x3FFF
    if chunk == b"VP8L":
        if data[20] != 0x2F:
            raise AssertionError(f"{path} has no VP8L signature")
        bits = int.from_bytes(data[21:25], "little")
        return 1 + (bits & 0x3FFF), 1 + ((bits >> 14) & 0x3FFF)
    raise AssertionError(f"{path} has an unknown WebP chunk {chunk!r}")


def page_exists(url: str) -> bool:
    """Whether a site path such as /projects/la-jolla/ names a page in this repository."""
    path = url.split("#", 1)[0]
    match = re.fullmatch(r"/projects/([a-z0-9-]+)/", path)
    if match and (PROJECTS_DIR / f"{match.group(1)}.md").is_file():
        return True
    for page in list(PAGES_DIR.glob("*.md")) + list(PROJECTS_DIR.glob("*.md")):
        if re.search(rf"(?m)^permalink: {re.escape(path)}\s*$", page.read_text(encoding="utf-8")):
            return True
    return False


class HomeWorldDiaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.diary = yaml.safe_load(DIARY.read_text(encoding="utf-8"))
        cls.image_dir = REPO_ROOT / cls.diary["image_dir"].strip("/")

    def shots(self, entry: dict) -> list[tuple[str, dict, dict]]:
        compares = ([entry["compare"]] if entry.get("compare") else []) + list(entry.get("extra", []))
        return [(entry["id"], compare, compare[side]) for compare in compares for side in ("before", "after")]

    def test_header_streams_and_phases(self) -> None:
        self.assertEqual(self.diary["schema_version"], 1)
        date.fromisoformat(self.diary["start"])
        self.assertTrue(self.diary["image_dir"].startswith("/assets/img/"))
        self.assertTrue(self.image_dir.is_dir())

        for stream_id, stream in self.diary["streams"].items():
            with self.subTest(stream=stream_id):
                self.assertTrue(stream["label"] and stream["short"])
                self.assertTrue(stream["url"].startswith("/"), "streams link to a page on this site")
                self.assertTrue(page_exists(stream["url"]), f"{stream['url']} is not a page")

        phase_ids = [phase["id"] for phase in self.diary["phases"]]
        self.assertEqual(len(phase_ids), len(set(phase_ids)))
        used = {entry["phase"] for entry in self.diary["entries"]}
        for phase in self.diary["phases"]:
            with self.subTest(phase=phase["id"]):
                self.assertTrue(phase["when"] and phase["title"] and phase["summary"])
                self.assertIn(phase["id"], used, "every chapter holds at least one entry")

    def test_entries_are_dated_in_order_and_say_who_noticed(self) -> None:
        entries = self.diary["entries"]
        ids = [entry["id"] for entry in entries]
        self.assertEqual(len(ids), len(set(ids)), "entry ids are page anchors and must be unique")
        phase_order = [phase["id"] for phase in self.diary["phases"]]
        start = date.fromisoformat(self.diary["start"])
        previous = start
        previous_phase = 0
        for entry in entries:
            with self.subTest(entry=entry["id"]):
                self.assertRegex(entry["id"], r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
                day = date.fromisoformat(entry["date"])
                self.assertGreaterEqual(day, previous, "entries run oldest first")
                self.assertGreaterEqual(day, start)
                previous = day
                phase_index = phase_order.index(entry["phase"])
                self.assertGreaterEqual(phase_index, previous_phase, "entries follow the chapters' order")
                previous_phase = phase_index
                self.assertIn(entry["stream"], self.diary["streams"])
                self.assertTrue(entry["title"].strip())
                self.assertIn(entry.get("status", "done"), STATUSES)

                note = entry["note"]
                self.assertIn(note["by"], NOTE_AUTHORS)
                self.assertEqual(("quote" in note) + ("text" in note), 1, "a note is a quote or a paraphrase, not both")
                if "quote" in note:
                    self.assertEqual(note["by"], "sirui", "only Sirui's own words are quoted")
                    self.assertNotIn("“", note["quote"], "the page adds the quotation marks")
                if "said" in note:
                    date.fromisoformat(note["said"])

                if entry.get("status", "done") == "done":
                    self.assertTrue(entry.get("change", "").strip(), "a finished entry says what changed")
                    self.assertTrue(entry.get("compare") or entry.get("metrics"), "a finished entry shows its evidence")
                for metric in entry.get("metrics", []):
                    self.assertTrue(metric["label"] and metric["before"] and metric["after"])

                for link in entry.get("links", []):
                    self.assertTrue(link["label"].strip())
                    url = link["url"]
                    self.assertTrue(url.startswith(("https://", "/")), url)
                    if url.startswith("/"):
                        self.assertTrue(page_exists(url), f"{url} is not a page")
                    if "/commit/" in url:
                        self.assertRegex(url, r"^https://github\.com/DylanTao/dylantao\.github\.io/commit/[0-9a-f]{7,40}$")

    def test_images_exist_at_the_sizes_the_page_asks_for(self) -> None:
        referenced: set[str] = set()
        for entry in self.diary["entries"]:
            compares = ([entry["compare"]] if entry.get("compare") else []) + list(entry.get("extra", []))
            for compare in compares:
                with self.subTest(entry=entry["id"], view=compare.get("view", "")[:40]):
                    self.assertIn(compare["kind"], COMPARE_KINDS)
                    self.assertTrue(compare["view"].strip(), "every comparison names its camera")
                    before, after = compare["before"], compare["after"]
                    if compare["kind"] == "slider":
                        self.assertEqual((before["width"], before["height"]), (after["width"], after["height"]), "a slider pair shares one frame")
                    self.assertNotEqual(before["alt"], after["alt"])
            for _, compare, shot in self.shots(entry):
                with self.subTest(entry=entry["id"], image=shot["img"]):
                    self.assertGreaterEqual(len(shot["alt"]), 40, "alt text describes the view")
                    self.assertTrue(shot["source"].strip())
                    if not shot["source"].startswith(".jekyll-cache/"):
                        self.assertTrue((REPO_ROOT / shot["source"]).is_file(), f"missing capture {shot['source']}")
                    full = self.image_dir / f"{shot['img']}.webp"
                    self.assertEqual(webp_size(full), (shot["width"], shot["height"]))
                    self.assertLessEqual(shot["width"], 1440)
                    referenced.add(full.name)
                    for width in (960, 480):
                        variant = self.image_dir / f"{shot['img']}-{width}.webp"
                        if shot["width"] > width:
                            vw, vh = webp_size(variant)
                            self.assertEqual(vw, width)
                            self.assertLessEqual(abs(vh - shot["height"] * width / shot["width"]), 1)
                            referenced.add(variant.name)
                        else:
                            self.assertFalse(variant.exists(), f"{variant.name} is never requested")

        on_disk = {path.name for path in self.image_dir.glob("*.webp")}
        self.assertEqual(on_disk - referenced, set(), "every diary image belongs to an entry")
        for path in self.image_dir.glob("*.webp"):
            with self.subTest(weight=path.name):
                self.assertLessEqual(path.stat().st_size, MAX_IMAGE_BYTES)

    def test_pages_render_the_diary_through_the_include(self) -> None:
        desk = (PROJECTS_DIR / "homepage-desk-scene.md").read_text(encoding="utf-8")
        self.assertEqual(desk.count("{% include build-diary.liquid %}"), 1)
        self.assertIn("## The build diary {#build-diary}", desk)
        self.assertIn('href="#build-diary"', desk)
        self.assertRegex(desk, r"(?m)^cinematic: true$")

        house = (PROJECTS_DIR / "house-in-the-cliff.md").read_text(encoding="utf-8")
        self.assertIn('{% include build-diary.liquid stream="house" detail=true %}', house)
        self.assertRegex(house, r"(?m)^parent: homepage-desk-scene$")

        include = INCLUDE.read_text(encoding="utf-8")
        for phrase in (
            "site.data.home_world_diary",
            "where: 'stream', include.stream",
            'id="diary-{{ entry.id }}"',
            'id="diary-chapter-{{ phase.id }}"',
            "{% include build-diary-compare.liquid",
            "My note",
            "The review found",
            "What changed",
            "/assets/js/build-diary.mjs",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, include)

        compare = COMPARE_INCLUDE.read_text(encoding="utf-8")
        for phrase in ('loading="lazy"', 'decoding="async"', "srcset=", 'type="range"', "data-diary-control hidden", "aria-label=", "build-diary-compare--wide"):
            with self.subTest(compare_phrase=phrase):
                self.assertIn(phrase, compare)

        styles = STYLES.read_text(encoding="utf-8")
        self.assertIn('@use "build-diary";', MAIN_STYLESHEET.read_text(encoding="utf-8"))
        # Motion runs only while the cinematic layer is live, never under Pause motion or reduced motion.
        self.assertIn('html.cinematic-live:not([data-motion="paused"])', styles)
        self.assertIn("@media (prefers-reduced-motion: reduce)", styles)
        self.assertIn("&[hidden] {\n    display: none;", styles)

        script = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('root.classList.contains("cinematic-live")', script)
        self.assertIn("prefers-reduced-motion: reduce", script)
        self.assertIn('"is-adjusted"', script)
        self.assertIn("aria-valuetext", script)


if __name__ == "__main__":
    unittest.main()
