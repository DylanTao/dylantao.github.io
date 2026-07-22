from __future__ import annotations

import hashlib
import re
import unittest
from datetime import datetime
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
PROJECTS_PAGE = REPO_ROOT / "_pages" / "projects.md"
PROJECTS_DIR = REPO_ROOT / "_projects"
GUIDES_DIR = REPO_ROOT / "assets" / "downloads" / "site-experiments"
PROJECT_CARD_DATA = REPO_ROOT / "_data" / "project_cards.yml"
PROJECT_CARD_INCLUDE = REPO_ROOT / "_includes" / "projects.liquid"
PROJECT_CARD_ICON_INCLUDE = REPO_ROOT / "_includes" / "project_card_icon.liquid"
STORY_COMPONENTS = REPO_ROOT / "_sass" / "_components.scss"
STORY_LAYOUT = REPO_ROOT / "_sass" / "_layout.scss"
RESEARCH_SKILLS_POST = REPO_ROOT / "_posts" / "2026-04-27-research-skills-starter-pack.md"

EXPECTED_CHRONOLOGY = [
    ("openai-build-week", "Scaffolding for Taste — OpenAI Build Week", "2026-07-18T18:46:02-07:00"),
    ("paper-constellation", "Paper Constellation", "2026-07-15T16:51:26-07:00"),
    ("build-rhythm", "Build Rhythm", "2026-07-11T14:46:58-07:00"),
    ("homepage-desk-scene", "The Desk That Learned Depth", "2026-06-17T20:55:49-07:00"),
    ("hci-spooder-man", "HCI Spooder-Man", "2026-05-30T19:29:43-07:00"),
    ("scholar-lens", "Scholar Lens", "2026-05-30T15:19:54-07:00"),
    ("wall-of-rejection", "Wall of Rejection", "2026-05-29T15:24:23-07:00"),
    ("ikea-project-cards", "The IKEA Card Experiment", "2026-05-27T19:20:51-07:00"),
    ("website-revamp", "Vibe-Coding a Research Portfolio", "2026-05-23T18:37:36-07:00"),
    ("dogtor-portal", "Dogtor's Hidden Portal", "2026-05-13T19:41:53-07:00"),
]

REPRODUCTION_GUIDES = [
    "paper-constellation-reproduction.md",
    "build-rhythm-reproduction.md",
    "homepage-desk-scene-reproduction.md",
    "dogtor-portal-reproduction.md",
    "scholar-lens-reproduction.md",
    "wall-of-rejection-reproduction.md",
    "ikea-project-cards-reproduction.md",
    "not-a-good-driver-reproduction.md",
]


def frontmatter(path: Path) -> dict[str, str]:
    source = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\s*\n(.*?)\n---", source, flags=re.DOTALL)
    if not match:
        raise AssertionError(f"{path} has no frontmatter")
    values: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line or line.startswith((" ", "\t")):
            continue
        key, value = line.split(":", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


class SiteExperimentsTests(unittest.TestCase):
    def test_research_skills_reading_bridge_reaches_the_writing_section(self) -> None:
        source = RESEARCH_SKILLS_POST.read_text(encoding="utf-8")
        self.assertIn("## 3. Learn to write research clearly", source)
        self.assertIn("[section 3](#learn-to-write-research-clearly)", source)
        self.assertNotIn("[section 3](#3-learn-to-write-research-clearly)", source)

    def test_site_experiments_have_truthful_chronological_metadata(self) -> None:
        records = []
        for slug, expected_title, expected_debut in EXPECTED_CHRONOLOGY:
            values = frontmatter(PROJECTS_DIR / f"{slug}.md")
            self.assertEqual(values.get("title"), expected_title)
            self.assertEqual(values.get("category"), "fun")
            self.assertEqual(values.get("site_experiment"), "true")
            teaser = values.get("img")
            self.assertTrue(teaser, f"{slug} is missing a project-card teaser")
            self.assertTrue((REPO_ROOT / teaser).is_file(), f"{slug} teaser does not exist: {teaser}")
            self.assertEqual(values.get("debut_date"), expected_debut)
            debut = datetime.fromisoformat(expected_debut)
            records.append((debut, expected_title))

        actual = [title for _, title in sorted(records, reverse=True)]
        self.assertEqual(actual, [title for _, title, _ in EXPECTED_CHRONOLOGY])

    def test_projects_index_groups_experiments_once_and_sorts_by_debut(self) -> None:
        source = PROJECTS_PAGE.read_text(encoding="utf-8")
        rationale = (
            "I keep these site experiments on record so newer models can re-review the last best pass—and I keep only changes that survive "
            "screenshots, accessibility checks, and my own judgment."
        )
        self.assertEqual(source.count(rationale), 1)
        self.assertIn('where: "site_experiment", true | sort: "debut_date" | reverse', source)
        self.assertIn("data-site-experiment-grid", source)
        self.assertIn("Other playful builds", source)
        self.assertEqual(source.count("{% include projects.liquid heading_level=4 %}"), 2)

        card_include = (REPO_ROOT / "_includes" / "projects.liquid").read_text(encoding="utf-8")
        self.assertIn("{% if include.heading_level == 4 %}", card_include)
        self.assertIn('<h4 class="card-title">{{ project.title }}</h4>', card_include)

    def test_fun_project_cards_have_evidence_bound_origins_and_one_icon_family(self) -> None:
        project_cards = yaml.safe_load(PROJECT_CARD_DATA.read_text(encoding="utf-8"))
        expected_icons = {
            "openai-build-week": "archive",
            "paper-constellation": "constellation",
            "build-rhythm": "pulse",
            "homepage-desk-scene": "desk",
            "hci-spooder-man": "spooder",
            "scholar-lens": "citation",
            "wall-of-rejection": "receipt",
            "ikea-project-cards": "expand",
            "website-revamp": "archive",
            "dogtor-portal": "paw",
            "not-a-good-driver": "wheel",
        }

        for slug, icon in expected_icons.items():
            with self.subTest(slug=slug):
                card = project_cards[slug]
                self.assertGreater(len(card["origin_line"]), 30)
                self.assertEqual(card["icon"], icon)
                self.assertGreater(len(card["teaser_alt"]), 40)

        evolved_projects = set(expected_icons) - {"not-a-good-driver"}
        for slug in evolved_projects:
            with self.subTest(evolution=slug):
                self.assertGreater(len(project_cards[slug]["evolution_line"]), 30)
        self.assertNotIn("evolution_line", project_cards["not-a-good-driver"])

        card_include = PROJECT_CARD_INCLUDE.read_text(encoding="utf-8")
        self.assertIn("project_card_icon.liquid icon=project_card_data.icon", card_include)
        self.assertIn('class="project-card-story" data-project-card-story', card_include)
        self.assertIn('class="project-card-story-label">Why it began</p>', card_include)
        self.assertIn('{% if project_card_data.evolution_line %}', card_include)
        self.assertIn('class="project-card-story-label">What changed</p>', card_include)
        self.assertIn("project_card_data.teaser_alt | default: project.title", card_include)
        self.assertIn("alt=project_teaser_alt", card_include)

        icon_include = PROJECT_CARD_ICON_INCLUDE.read_text(encoding="utf-8")
        self.assertIn('viewBox="0 0 24 24"', icon_include)
        self.assertIn('stroke="currentColor"', icon_include)
        self.assertIn('aria-hidden="true"', icon_include)
        self.assertIn('focusable="false"', icon_include)
        for icon in expected_icons.values():
            with self.subTest(icon=icon):
                self.assertEqual(icon_include.count(f"{{% when '{icon}' %}}"), 1)

    def test_scholar_lens_traces_one_paper_without_merging_citation_clocks(self) -> None:
        source = (PROJECTS_DIR / "scholar-lens.md").read_text(encoding="utf-8")
        trace = (REPO_ROOT / "_includes" / "scholar_story_trace.liquid").read_text(encoding="utf-8")
        project_cards = yaml.safe_load(PROJECT_CARD_DATA.read_text(encoding="utf-8"))
        self.assertEqual(source.count('class="project-story-beat"'), 3)
        self.assertIn("{% include scholar_story_trace.liquid %}", source)
        self.assertEqual(trace.count('class="scholar-story-trace-step"'), 3)
        for phrase in (
            "{% assign scholar_lens_data = site.data.publication_lens %}",
            "{% assign scholar_designweaver = scholar_lens_data.papers.tao2024designweaver %}",
            "Follow DesignWeaver through the lens",
            "scholar_lens_data.metadata.totals_last_synced",
            "scholar_lens_data.metadata.total_citations",
            "Navigation context, not an impact score",
            "does not infer paper quality, author contribution, causality, or reader interest",
            "does not collect private Scholar history",
            "Technical provenance and exact ledger",
            'data-evidence-kind="responsive-runtime-crop"',
            'data-evidence-source-commit="497b222662fa198ad5e6a43d2727cdb06ec3babf"',
            'data-evidence-desktop-source-viewport="1440x1000"',
            'data-evidence-mobile-source-viewport="390x1000"',
            'data-evidence-theme="light"',
            'data-evidence-theme-mode="noon"',
            'data-evidence-interaction="keyboard-focus-on-designweaver-title-link"',
            'data-evidence-desktop-state="linked-row-citation-chip-and-annual-bars"',
            'data-evidence-mobile-state="focused-bibliography-row"',
            'data-evidence-browser="Chromium 145.0.7632.6"',
            "does not pretend the desktop-only chart is present",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, source)
        for phrase in (
            "Current data anatomy",
            "One key, three cues",
            "Bibliography row",
            "Lifetime citation chip",
            "Annual bars",
            'data-bibliography-key="tao2024designweaver"',
            'data-lifetime-sync="{{ scholar_story_lens.metadata.totals_last_synced }}"',
            'data-lifetime-citations="{{ scholar_story_designweaver.citation_total }}"',
            'data-all-paper-citations="{{ scholar_story_lens.metadata.total_citations }}"',
            'data-annual-snapshot="{{ scholar_story_lens.metadata.yearly_snapshot_as_of }}"',
            "{{ scholar_story_designweaver.citation_total }}",
            "The bars retain the separately dated",
            "They are not reconstructed to equal the later lifetime chip",
        ):
            with self.subTest(trace_phrase=phrase):
                self.assertIn(phrase, trace)
        self.assertNotIn("<strong>38 citations</strong>", source)
        self.assertNotIn("<strong>38</strong>", trace)
        self.assertNotIn("records 38 citations; all five listed papers total 227", source)

        evidence = {
            "assets/img/project_pics/scholar-lens/scholar-lens-designweaver-497b22266-1440-light.png": (
                (1440, 900),
                "064d8496d66fb0b7b362d99cc80c60fe57b2f7c750fc1ba064eac4ea8519ed73",
            ),
            "assets/img/project_pics/scholar-lens/scholar-lens-designweaver-497b22266-390-light.png": (
                (360, 270),
                "6cd988e461b996886e7a90cad758abc1ebb378ddcaec6d7192bdcec7505c59ae",
            ),
        }
        for relative_path, (dimensions, expected_hash) in evidence.items():
            with self.subTest(relative_path=relative_path):
                payload = (REPO_ROOT / relative_path).read_bytes()
                self.assertEqual(payload[:8], b"\x89PNG\r\n\x1a\n")
                self.assertEqual((int.from_bytes(payload[16:20], "big"), int.from_bytes(payload[20:24], "big")), dimensions)
                self.assertEqual(hashlib.sha256(payload).hexdigest(), expected_hash)

        scholar_card = project_cards["scholar-lens"]
        self.assertEqual(
            scholar_card["mobile_teaser"],
            "/assets/img/project_pics/scholar-lens/scholar-lens-designweaver-497b22266-390-light.png",
        )
        self.assertEqual(
            scholar_card["teaser_alt"],
            "DesignWeaver highlighted in Scholar Lens's responsive publication and citation view",
        )
        self.assertNotIn("site-experiments/scholar-lens.png", source)

    def test_wall_of_rejection_keeps_events_receipts_and_combo_math_distinct(self) -> None:
        source = (PROJECTS_DIR / "wall-of-rejection.md").read_text(encoding="utf-8")
        self.assertEqual(source.count('class="project-story-beat"'), 3)
        self.assertEqual(source.count('class="project-storyboard-step"'), 4)
        self.assertEqual(source.count("wall-of-rejection-steam-reference.png"), 1)
        for phrase in (
            "From meme to receipt wall",
            "origin-source-image",
            "wall-of-rejection.png",
            "Event",
            "Badge",
            "Receipt",
            "Non-additive combo",
            "38 XP from four events",
            "contributes <strong>0 XP</strong>",
            "same rejection event never earns points twice",
            "profile statistics are fictional joke copy",
            "A selected public record",
            "four allowlisted rejection events",
            "Accepted work remains in the bibliography",
            "/projects/hci-spooder-man/",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, source)

    def test_ikea_story_uses_current_anatomy_when_exact_history_cannot_build(self) -> None:
        source = (PROJECTS_DIR / "ikea-project-cards.md").read_text(encoding="utf-8")
        self.assertEqual(source.count('class="project-story-beat"'), 3)
        self.assertEqual(source.count('class="project-storyboard-step"'), 0)
        self.assertEqual(source.count('class="ikea-state-frame"'), 3)
        for phrase in (
            "Collapsed",
            "Moving",
            "Open",
            "The first FLIP",
            "More signals, then less motion",
            "One cancelable clock",
            "Current anatomy, exact source history",
            'data-evidence-kind="annotated-current-state-anatomy"',
            'data-runtime-contract="9fa9403e4"',
            "static, reduced-motion-safe anatomy",
            "did not finish a build within a bounded four-minute run",
            'data-capture-viewport="not-retained"',
            "Full technical revision record",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, source)

    def test_dogtor_story_explains_recovery_without_publishing_the_destination(self) -> None:
        source = (PROJECTS_DIR / "dogtor-portal.md").read_text(encoding="utf-8")
        self.assertEqual(source.count('class="project-storyboard-step"'), 4)
        self.assertEqual(source.count('class="dogtor-story-icon"'), 4)
        for phrase in (
            "Notice the clue",
            "Choose a fruit",
            "Recover cleanly",
            "Ask before precision",
            "Public boundary",
            "Where the public story stops",
            "Destination, access details, private writing, visitor records, and precise location remain outside the page",
            'data-artifact-type="public-clue-art"',
            'data-artifact-sha256="11b59deb8de4fa08fe8b0485d6703813adeeef032c13f25ab741cbee55e11741"',
            "Exact source-commit links stay out of this public case study",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, source)
        for private_fragment in (
            "siruiSecretFruitPass",
            "sirui-research-thoughts",
            "sirui-private-message",
            "blog-secret.js",
            "517914d12",
            "f692637b0",
            "643493599",
            "6bf1bdea0",
        ):
            with self.subTest(private_fragment=private_fragment):
                self.assertNotIn(private_fragment, source)

    def test_website_revamp_separates_archive_checkpoint_and_live_children(self) -> None:
        source = (PROJECTS_DIR / "website-revamp.md").read_text(encoding="utf-8")
        self.assertEqual(source.count('class="project-story-beat"'), 3)
        self.assertIn("Archive, redesign, living system", source)
        self.assertIn('data-archive-wayback-timestamp="20260209013429"', source)
        self.assertIn('data-archive-site-commit="not-preserved"', source)
        self.assertIn('data-june-artifact-status="historical-checkpoint-not-current"', source)
        self.assertIn('data-website-child-experiments', source)
        for route in (
            "/projects/homepage-desk-scene/",
            "/projects/build-rhythm/",
            "/projects/paper-constellation/",
            "/projects/scholar-lens/",
            "/projects/ikea-project-cards/",
            "/projects/wall-of-rejection/",
            "/projects/hci-spooder-man/",
            "/projects/dogtor-portal/",
        ):
            with self.subTest(route=route):
                self.assertEqual(source.count(route), 1)
        self.assertIn("No static image on this page is labeled as a current capture", source)
        self.assertIn("hachettebookgroup.com/titles/donald-a-schon/the-reflective-practitioner", source)

    def test_paper_constellation_and_scholar_lens_link_the_shared_record_both_ways(self) -> None:
        constellation = (PROJECTS_DIR / "paper-constellation.md").read_text(encoding="utf-8")
        scholar = (PROJECTS_DIR / "scholar-lens.md").read_text(encoding="utf-8")
        self.assertEqual(constellation.count("/projects/scholar-lens/"), 1)
        self.assertEqual(scholar.count("/projects/paper-constellation/"), 1)

    def test_spooder_story_marks_remix_art_and_keeps_wall_one_link_away(self) -> None:
        source = (PROJECTS_DIR / "hci-spooder-man.md").read_text(encoding="utf-8")
        script = (REPO_ROOT / "assets" / "js" / "spooder-project.js").read_text(
            encoding="utf-8"
        )
        styles = STORY_COMPONENTS.read_text(encoding="utf-8")
        self.assertEqual(source.count('class="project-story-beat"'), 3)
        self.assertIn('data-spooder-artwork-boundary="remix-material-not-history"', source)
        self.assertIn("Remix frames with a documented origin", source)
        self.assertIn("The factual chronology lives in the origin beats above", source)
        self.assertIn("Remix provenance and technical record", source)
        self.assertIn("Playful HCI Spooder-Man remix artwork from a set of city scenes, character lineups, and title cards", source)
        self.assertGreaterEqual(source.count("/projects/wall-of-rejection/"), 2)
        for commit in ("95acdb781", "5b6ae82ea", "c91889bd5"):
            with self.subTest(commit=commit):
                self.assertIn(commit, source)
        self.assertIn("const priorFocus = document.activeElement;", script)
        self.assertIn("priorFocus.focus({ preventScroll: true });", script)
        self.assertIn("body:has(.hci-spooder-hero) #back-to-top", styles)
        self.assertIn("min-width: 2.75rem;", styles)
        self.assertIn("min-height: 2.75rem;", styles)

    def test_driver_story_has_three_roles_and_no_fabricated_evolution(self) -> None:
        source = (PROJECTS_DIR / "not-a-good-driver.md").read_text(encoding="utf-8")
        self.assertEqual(source.count('class="project-storyboard-step"'), 3)
        for phrase in (
            "Driver · create the action",
            "Passenger · share the ride",
            "Spectator · make it a show",
            'data-driver-teaser-kind="illustrative-concept-art"',
            'data-driver-runtime-capture="not-preserved"',
            'data-driver-historical-comparison="not-supported"',
            'data-evidence-kind="conceptual-role-and-sightline-anatomy"',
            "What the surviving evidence supports",
            "The teaser is illustrative concept art",
            "the role story describes design intent rather than observed player behavior",
            "Design the view around the roles",
            "not-a-good-driver-reproduction.md",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, source)
        self.assertNotIn("## What changed", source)

    def test_paper_constellation_case_hero_uses_the_mobile_trail_on_phones(self) -> None:
        source = (PROJECTS_DIR / "paper-constellation.md").read_text(encoding="utf-8")
        self.assertIn('class="project-case-media site-experiment-evidence-figure paper-constellation-case-hero-media"', source)
        self.assertIn('media="(max-width: 520px)"', source)
        self.assertEqual(source.count("paper-constellation-mobile-trail-390-light-2026-07-16.png"), 2)
        self.assertIn("purpose-built chronological trail on a narrow phone", source)

    def test_reproduction_guides_and_case_study_routes_exist(self) -> None:
        for filename in REPRODUCTION_GUIDES:
            with self.subTest(filename=filename):
                guide = GUIDES_DIR / filename
                self.assertTrue(guide.is_file(), f"missing {guide}")
                self.assertGreater(len(guide.read_text(encoding="utf-8")), 500)

    def test_build_rhythm_credit_preserves_the_source_session(self) -> None:
        source = (PROJECTS_DIR / "build-rhythm.md").read_text(encoding="utf-8")
        for phrase in (
            "John Thompson",
            "Autodesk HCI internship Wednesday design session",
            "Balancing Performance, Interactivity and Effort: SVG, Canvas, and WebGL",
            "Google News Lab",
            "Truth & Beauty",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, source)

    def test_build_rhythm_uses_a_plain_language_story_before_the_technical_record(self) -> None:
        source = (PROJECTS_DIR / "build-rhythm.md").read_text(encoding="utf-8")
        self.assertNotIn("What the page protects", source)
        self.assertEqual(source.count('class="project-story-beat"'), 3)
        self.assertEqual(source.count("<span>Why</span>"), 1)
        self.assertEqual(source.count("<span>What</span>"), 1)
        self.assertEqual(source.count("<span>How</span>"), 1)
        for phrase in (
            "How to read the rhythm",
            "GitHub cadence",
            "Site-token rhythm",
            "Lifetime checkpoint",
            "Source histories and session-level details stay private",
            "The lesson I carried over was pacing",
            "Full technical revision record",
            "source-level daily history retired from the public dataset",
            "it documents interface anatomy",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, source)
        self.assertIn('class="project-story-disclosure"', source)
        self.assertEqual(source.count('class="site-experiment-ledger"'), 1)
        self.assertLess(source.index('aria-label="Build Rhythm summary"'), source.index('class="project-story-beats"'))
        self.assertLess(source.index('class="project-story-beats"'), source.index('class="project-story-disclosure"'))
        for commit in ("b4203f3ea", "71b8f4c89", "ed0d3ba40", "d3f13be35", "1b07cea4c", "6b4b7bd59", "7e224db12", "6edea07f4"):
            with self.subTest(commit=commit):
                self.assertIn(commit, source)

        self.assertNotIn("build-rhythm-combined-71b8f4c89-1440-light.png", source)
        self.assertFalse(
            (REPO_ROOT / "assets" / "img" / "project_pics" / "site-experiments" / "build-rhythm-combined-71b8f4c89-1440-light.png").exists()
        )

    def test_paper_constellation_story_preserves_lineage_privacy_and_two_geometries(self) -> None:
        source = (PROJECTS_DIR / "paper-constellation.md").read_text(encoding="utf-8")
        self.assertNotIn("stacked thread lists", source)
        self.assertEqual(source.count('class="project-story-beat"'), 3)
        self.assertIn("Three recurring research threads", source)
        self.assertIn("DesignWeaver to What Happened and Why", source)
        self.assertIn("chronological vertical thread trail", source)
        self.assertIn("These are reading aids, not rankings", source)
        self.assertIn("not evidence that one paper caused the other", source)
        self.assertIn("D3 force-directed SVG implementation", source)
        self.assertIn("graphics adjacency rather than an interaction-study claim", source)
        self.assertIn('class="project-story-comparison paper-constellation-evidence-pair"', source)
        self.assertIn('class="project-story-note project-story-note--privacy', source)
        self.assertIn('class="project-story-disclosure', source)
        for phrase in (
            "five accepted papers",
            "seven anonymous future nodes",
            "nine canonical paths",
            "Nadieh Bremer",
            "Visual Cinnamon",
            "John Thompson",
            "6832a6a05b5ff2b6c692bb3f5e3654a535e4401e",
            'data-desktop-capture-date="2026-07-16"',
            'data-desktop-source-viewport="1440x1000"',
            'data-desktop-device-pixel-ratio="1"',
            'data-desktop-theme="light"',
            'data-desktop-view="constellation-active"',
            'data-desktop-state="no-paper-pinned"',
            'data-desktop-artifact-size="1012x753"',
            'data-mobile-source-viewport="390x1000"',
            'data-mobile-theme="light"',
            'data-mobile-state="no-paper-pinned"',
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, source)

        desktop_asset = REPO_ROOT / "assets" / "img" / "project_pics" / "paper-constellation" / "paper-constellation-desktop-surface-6832a6a05-1440-light.png"
        desktop_payload = desktop_asset.read_bytes()
        self.assertEqual((int.from_bytes(desktop_payload[16:20], "big"), int.from_bytes(desktop_payload[20:24], "big")), (1012, 753))
        self.assertEqual(hashlib.sha256(desktop_payload).hexdigest(), "9224cc710c1ffbe9d7e6b4be7471af098660b6490726b8d8671cc158b67b1bf8")

    def test_story_primitives_keep_prose_and_evidence_on_separate_measures(self) -> None:
        components = STORY_COMPONENTS.read_text(encoding="utf-8")
        layout = STORY_LAYOUT.read_text(encoding="utf-8")
        for selector in (
            ".project-story-beats",
            ".project-story-comparison",
            ".project-storyboard",
            ".project-story-note",
            ".project-story-disclosure",
        ):
            with self.subTest(selector=selector):
                self.assertIn(selector, components)
                self.assertIn(selector, layout)
        self.assertIn("min-height: 2.75rem", components)
        self.assertIn("outline: var(--md-lite-focus-ring)", components)
        self.assertIn("max-width: min(100%, 72rem)", layout)
        self.assertIn("max-width: min(var(--measure-prose), 68ch)", layout)
        self.assertIn(".site-experiment-reproduce", layout)

    def test_truthful_teasers_are_tracked_for_newest_visual_experiments(self) -> None:
        for relative_path in (
            "assets/img/project_pics/paper-constellation/paper-constellation-teaser.png",
            "assets/img/project_pics/site-experiments/build-rhythm-stage.png",
            "assets/img/project_pics/site-experiments/homepage-desk-depth.png",
            "assets/img/project_pics/scholar-lens/scholar-lens-designweaver-497b22266-1440-light.png",
            "assets/img/project_pics/site-experiments/wall-of-rejection.png",
            "assets/img/project_pics/site-experiments/ikea-card-expanded.png",
        ):
            with self.subTest(relative_path=relative_path):
                path = REPO_ROOT / relative_path
                self.assertTrue(path.is_file(), f"missing {relative_path}")
                self.assertGreater(path.stat().st_size, 20_000)

    def test_paper_constellation_uses_a_truthful_mobile_runtime_crop(self) -> None:
        project_cards = yaml.safe_load(PROJECT_CARD_DATA.read_text(encoding="utf-8"))
        relative_path = project_cards["paper-constellation"]["mobile_teaser"].lstrip("/")
        self.assertEqual(
            relative_path,
            "assets/img/project_pics/paper-constellation/paper-constellation-mobile-trail-390-light-2026-07-16.png",
        )

        payload = (REPO_ROOT / relative_path).read_bytes()
        self.assertEqual(payload[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual((int.from_bytes(payload[16:20], "big"), int.from_bytes(payload[20:24], "big")), (360, 270))
        blob_hash = hashlib.sha1(f"blob {len(payload)}\0".encode() + payload).hexdigest()
        self.assertEqual(blob_hash, "57454076a5d55411c56a16dc3886d79333039c9a")

        card_include = PROJECT_CARD_INCLUDE.read_text(encoding="utf-8")
        self.assertEqual(card_include.count("data-project-card-mobile-teaser"), 1)
        self.assertIn('media="(max-width: 767px)"', card_include)
        self.assertIn('srcset="{{ project_card_data.mobile_teaser | relative_url }}"', card_include)
        self.assertNotIn("mobile_teaser_alt", project_cards["paper-constellation"])
        self.assertEqual(
            project_cards["paper-constellation"]["teaser_alt"],
            "Paper Constellation preview showing accepted papers and anonymous future nodes across the Design, Evaluate, and Situate research threads",
        )
        self.assertNotIn("mobile_teaser_alt", card_include)
        self.assertIn('alt="{{ project_card_data.teaser_alt | default: project.title | escape }}"', card_include)

    def test_build_rhythm_teaser_matches_the_approved_token_rhythm_capture(self) -> None:
        teaser = REPO_ROOT / "assets" / "img" / "project_pics" / "site-experiments" / "build-rhythm-stage.png"
        payload = teaser.read_bytes()
        self.assertEqual(payload[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual((int.from_bytes(payload[16:20], "big"), int.from_bytes(payload[20:24], "big")), (702, 508))
        blob_hash = hashlib.sha1(f"blob {len(payload)}\0".encode() + payload).hexdigest()
        self.assertEqual(blob_hash, "a85dfb18c584fdd064e92afe59a07daee37884a6")

        source = (REPO_ROOT / "_projects" / "build-rhythm.md").read_text(encoding="utf-8")
        for phrase in (
            'data-evidence-kind="interface-anatomy-not-live-data"',
            'data-asset-revision-commit="c613c7b0f3ef96e51e63321ad0b914dbef9add5d"',
            'data-asset-revision-committed-at="2026-07-16T11:41:43-07:00"',
            'data-capture-date="not-retained"',
            'data-capture-viewport="not-retained"',
            'data-capture-theme="not-retained"',
            'data-capture-interaction-state="not-retained"',
            "Annotated site-token chapter",
            "it documents interface anatomy",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, source)
        self.assertNotIn("asset\u00e2", source)

    def test_paper_constellation_reproduction_guide_matches_mobile_trail(self) -> None:
        guide = (GUIDES_DIR / "paper-constellation-reproduction.md").read_text(encoding="utf-8")
        self.assertNotIn("ordered thread sections", guide)
        for phrase in (
            "one chronological vertical trail",
            "three visible Design, Evaluate, and Situate rails",
            "five accepted-paper buttons",
            "seven anonymous future nodes",
            "five secondary-membership stubs",
            "all nine canonical edges",
            "measured anchors",
            "`ResizeObserver`",
            "immediately below its row",
            "restores focus to that paper button",
            "returns the detail panel to its neutral dock",
            "Future nodes remain noninteractive",
            "Scholar Lens synchronization",
            "rejection receipts",
            "major/minor sizing",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, guide)
        self.assertNotIn("paper\u00e2", guide)

    def test_homepage_desk_capture_pair_has_pinned_state_and_provenance(self) -> None:
        asset_root = REPO_ROOT / "assets" / "img" / "project_pics" / "site-experiments"
        expected_blobs = {
            "homepage-desk-2d-2026-07-16.png": "9d166020439832fd05f5db910003f37a7b307e6f",
            "homepage-desk-3d-2026-07-16.png": "5ef2444654bbaff5a8f5692e96e2d344e7db79ba",
        }
        payloads: dict[str, bytes] = {}

        for filename, expected_blob in expected_blobs.items():
            with self.subTest(filename=filename):
                payload = (asset_root / filename).read_bytes()
                payloads[filename] = payload
                self.assertEqual(payload[:8], b"\x89PNG\r\n\x1a\n")
                self.assertEqual((int.from_bytes(payload[16:20], "big"), int.from_bytes(payload[20:24], "big")), (1440, 1000))
                blob_hash = hashlib.sha1(f"blob {len(payload)}\0".encode() + payload).hexdigest()
                self.assertEqual(blob_hash, expected_blob)

        self.assertNotEqual(payloads["homepage-desk-2d-2026-07-16.png"], payloads["homepage-desk-3d-2026-07-16.png"])
        self.assertEqual((asset_root / "homepage-desk-depth.png").read_bytes(), payloads["homepage-desk-3d-2026-07-16.png"])

        reproduced_sha256 = {
            "homepage-desk-588e36509-2d-2026-07-16.png": "4f8389dbab217d95b8b21ca6efb1b21f3a00afe3df52a6edc0150b471c344756",
            "homepage-desk-588e36509-3d-2026-07-16.png": "8e63f3d8d62e657c31e306e1bc76004ed694692e54914a87d4bbdb81c3b6a5f8",
        }
        for filename, expected_sha256 in reproduced_sha256.items():
            with self.subTest(filename=filename):
                payload = (asset_root / filename).read_bytes()
                self.assertEqual(payload[:8], b"\x89PNG\r\n\x1a\n")
                self.assertEqual((int.from_bytes(payload[16:20], "big"), int.from_bytes(payload[20:24], "big")), (1440, 1000))
                self.assertEqual(hashlib.sha256(payload).hexdigest(), expected_sha256)

        case_study = (PROJECTS_DIR / "homepage-desk-scene.md").read_text(encoding="utf-8")
        self.assertEqual(case_study.count("data-desk-comparison-era="), 2)
        self.assertEqual(re.findall(r'data-desk-evidence-mode="([^"]+)"', case_study), ["2d", "3d", "2d", "3d"])
        self.assertIn('class="project-story-comparison desk-scene-evidence-pair"', case_study)
        self.assertIn('class="project-story-disclosure site-experiment-technical-details"', case_study)
        self.assertIn("exact-commit replay", case_study)
        self.assertIn("record the model context for each era", case_study)
        self.assertIn("rather than isolated model performance", case_study)
        for phrase in (
            'data-evidence-kind="historical-runtime-capture"',
            'data-evidence-archive-commit="588e365090e883323d836f5da023f7d40632f096"',
            'data-evidence-archive-date="2026-06-21"',
            'data-evidence-capture-date="not-retained"',
            'data-evidence-source-viewport="not-retained"',
            'data-evidence-image-size="1440x1000"',
            'data-evidence-theme="light"',
            'data-evidence-interaction-state="not-retained"',
            "its exact viewport, capture date, and interaction state were not retained",
            "homepage-desk-588e36509-2d-2026-07-16.png",
            "homepage-desk-588e36509-3d-2026-07-16.png",
            "homepage-desk-2d-2026-07-16.png",
            "homepage-desk-3d-2026-07-16.png",
            'data-source-commit="588e365090e883323d836f5da023f7d40632f096"',
            'data-capture-source="8fc9bf7d3"',
            'data-scene-checkpoint="1b07cea4c"',
            'data-capture-viewport="1440x1000"',
            'data-capture-theme="light"',
            'data-capture-state="yellow-submarine-stopped-zero-discoveries"',
            'data-capture-sequence="2d-then-mode-switch-only"',
            'data-capture-device-pixel-ratio="1"',
            'data-capture-device-pixel-ratio="3"',
            "2ffd379af",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, case_study)

    def test_widget_origin_routes_are_explicit_and_contextual(self) -> None:
        expectations = {
            "_pages/github-activity.md": "/projects/build-rhythm/",
            "_pages/projects.md": "/projects/ikea-project-cards/",
            "_includes/home/hero.liquid": "/projects/homepage-desk-scene/",
            "_pages/blog.md": "/projects/dogtor-portal/",
            "_includes/publications/paper_constellation.liquid": "/projects/paper-constellation/",
            "_includes/publications/scholar_lens.liquid": "/projects/scholar-lens/",
            "_includes/publications/wall_of_rejection.liquid": "/projects/wall-of-rejection/",
        }
        for relative_path, route in expectations.items():
            with self.subTest(relative_path=relative_path):
                source = (REPO_ROOT / relative_path).read_text(encoding="utf-8")
                self.assertIn(route, source)
                self.assertIn("{% include widget_origin_link.liquid", source)
                self.assertNotRegex(source, r'<span[^>]+widget-origin-mark[^>]*>\s*\?\s*</span>')

        dog_script = (REPO_ROOT / "assets" / "js" / "blog-secret.js").read_text(encoding="utf-8")
        self.assertIn("hasDiscoveredPortal", dog_script)
        self.assertIn("revealOrigin", dog_script)


if __name__ == "__main__":
    unittest.main()
