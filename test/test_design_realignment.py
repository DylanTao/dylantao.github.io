from __future__ import annotations

import hashlib
import json
import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
VENDOR_ROOT = REPO_ROOT / "assets" / "vendor" / "paper-shaders" / "0.0.80"

SIGNATURE_PHRASES = (
    "Making AI tools that sharpen design judgment.",
    "Scaffolding taste in an age of generative abundance.",
    "Design, Evaluate, Situate.",
    "Vibes -> Variables -> Value",
    "Make better design decisions visible.",
)


class DesignRealignmentContractTests(unittest.TestCase):
    def test_design_spine_keeps_signature_copy_and_human_ai_goals(self) -> None:
        heuristics = (REPO_ROOT / "WEBSITE_DESIGN_HEURISTICS.md").read_text(encoding="utf-8")
        for phrase in SIGNATURE_PHRASES:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, heuristics)
        for contract in (
            "Less, but more Sirui",
            "An Evolving Spine",
            "Signature Copy Locklist",
            "Human And AI Are Different Reading Surfaces",
            "Three Narrative Type Roles",
            "docs/design-experiment-backlog.md",
        ):
            self.assertIn(contract, heuristics)

    def test_backlog_records_deferred_experiments_without_vendoring_them(self) -> None:
        backlog = (REPO_ROOT / "docs" / "design-experiment-backlog.md").read_text(encoding="utf-8")
        for phrase in (
            "Paper Water",
            "travel-photo-abstraction",
            "lieflat-charts",
            "Visitor benefit",
            "Performance, accessibility",
            "Sirui decision",
            "Revisit trigger",
        ):
            self.assertIn(phrase, backlog)
        self.assertFalse((REPO_ROOT / ".codex" / "skills" / "travel-photo-abstraction").exists())
        for path in (
            REPO_ROOT / "AGENTS.md",
            REPO_ROOT / ".codex" / "skills" / "website-design-critique" / "SKILL.md",
            REPO_ROOT / ".codex" / "skills" / "portfolio-writing-voice" / "SKILL.md",
        ):
            self.assertIn("docs/design-experiment-backlog.md", path.read_text(encoding="utf-8"))

    def test_inter_load_and_computed_roles_use_supported_weights(self) -> None:
        config = (REPO_ROOT / "_config.yml").read_text(encoding="utf-8")
        themes = (REPO_ROOT / "_sass" / "_themes.scss").read_text(encoding="utf-8")
        self.assertRegex(config, r"Inter:wght@400;500;600;700")
        self.assertNotRegex(config, r"Inter:wght@[^\n]*800")
        for role in ("--type-display", "--type-heading", "--type-reading", "--type-compact"):
            self.assertIn(role, themes)
        for legacy in (
            "--type-label",
            "--type-meta",
            "--type-body",
            "--type-prose",
            "--type-lede",
            "--type-card-title",
            "--type-section-title",
            "--type-page-title",
            "--type-case-title",
        ):
            self.assertRegex(themes, rf"{re.escape(legacy)}:\s+var\(--type-")

    def test_paper_vendor_manifest_matches_the_minimal_closure(self) -> None:
        manifest = json.loads((VENDOR_ROOT / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["name"], "@paper-design/shaders")
        self.assertEqual(manifest["version"], "0.0.80")
        self.assertEqual(manifest["license"], "Apache-2.0")
        self.assertEqual(manifest["archive"]["npm_shasum"], "13398a1c145b157681e7beb313ffe4fab5d54a38")
        self.assertEqual(manifest["archive"]["sha256"], "6e7fb50002b2a1a3ec9eb4d3024e007d7877df30b31cc7d5f0a44cca46949f22")

        listed = {entry["path"] for entry in manifest["files"]}
        actual = {
            path.relative_to(VENDOR_ROOT).as_posix()
            for path in VENDOR_ROOT.rglob("*")
            if path.is_file() and path.name not in {"manifest.json", "README.md"}
        }
        self.assertEqual(listed, actual)
        for entry in manifest["files"]:
            payload = (VENDOR_ROOT / entry["path"]).read_bytes()
            self.assertEqual(len(payload), entry["bytes"])
            self.assertEqual(hashlib.sha256(payload).hexdigest(), entry["sha256"])
        self.assertIn("Apache License", (VENDOR_ROOT / "LICENSE").read_text(encoding="utf-8"))

    def test_dot_orbit_is_bounded_route_gated_and_fail_soft(self) -> None:
        script = (REPO_ROOT / "assets" / "js" / "paper-research-field.js").read_text(encoding="utf-8")
        scripts_include = (REPO_ROOT / "_includes" / "scripts.liquid").read_text(encoding="utf-8")
        research_include = (REPO_ROOT / "_includes" / "home" / "research_motion.liquid").read_text(encoding="utf-8")
        realignment = (REPO_ROOT / "_sass" / "_realignment.scss").read_text(encoding="utf-8")
        vendor_mount = (VENDOR_ROOT / "dist" / "shader-mount.js").read_text(encoding="utf-8")

        self.assertEqual(script.count("new ShaderMount("), 1)
        self.assertIn("!window.__siruiPaperResearchField", script)
        self.assertIn("480000", script)
        self.assertIn("fixedFrame", script)
        self.assertIn('event.preventDefault();', script)
        self.assertIn('field.dataset.paperShaderState = "fallback"', script)
        self.assertIn("canvasPixels", script)
        self.assertIn("currentSpeed", script)
        for mode in ("design", "evaluate", "situated"):
            self.assertRegex(script, rf"{mode}:\s+\{{[^}}]+speed:")

        self.assertRegex(
            scripts_include,
            r"\{% if page\.research_motion %\}[\s\S]+paper-research-field\.js[\s\S]+\{% endif %\}",
        )
        self.assertIn("data-paper-research-field", research_include)
        self.assertIn("data-research-mode", research_include)
        self.assertIn("Paper Shaders", research_include)
        self.assertIn("https://paper.design/", research_include)
        self.assertIn("P06RgnUKX_I", research_include)
        for alpha in ("0.48", "0.34", "0.42"):
            self.assertIn(alpha, script)
        self.assertIn("opacity: 0.76", realignment)
        self.assertIn("opacity: 0.92", realignment)
        self.assertIn("IntersectionObserver", vendor_mount)
        self.assertIn('visibilitychange', vendor_mount)
        self.assertIn("this.currentSpeed", vendor_mount)

    def test_static_paper_texture_is_reproducible(self) -> None:
        recipe = json.loads((REPO_ROOT / "assets" / "img" / "website-revamp" / "paper-texture.recipe.json").read_text(encoding="utf-8"))
        output = REPO_ROOT / recipe["output"]
        self.assertTrue(output.is_file())
        self.assertEqual(hashlib.sha256(output.read_bytes()).hexdigest(), recipe["output_sha256"])
        self.assertEqual(recipe["parameters"]["seed"], 0.731)
        generator = (REPO_ROOT / recipe["generator"]).read_text(encoding="utf-8")
        self.assertIn("paper-texture.js", generator)
        self.assertIn("image/webp", generator)

    def test_static_project_shader_fields_are_reproducible_and_route_specific(self) -> None:
        recipe_paths = (
            REPO_ROOT / "assets" / "img" / "paper-shaders" / "build-rhythm-waves.recipe.json",
            REPO_ROOT / "assets" / "img" / "paper-shaders" / "designweaver-static-mesh.recipe.json",
        )
        total_bytes = 0
        for recipe_path in recipe_paths:
            recipe = json.loads(recipe_path.read_text(encoding="utf-8"))
            output = REPO_ROOT / recipe["output"]
            self.assertTrue(output.is_file())
            self.assertEqual(recipe["version"], "0.0.80")
            self.assertEqual(hashlib.sha256(output.read_bytes()).hexdigest(), recipe["output_sha256"])
            total_bytes += output.stat().st_size
        self.assertLess(total_bytes, 400_000)

        generator = (REPO_ROOT / "bin" / "generate_paper_accents.cjs").read_text(encoding="utf-8")
        self.assertIn("waves.js", generator)
        self.assertIn("static-mesh-gradient.js", generator)
        self.assertIn("image/webp", generator)
        self.assertIn('data-paper-static-accent="waves"', (REPO_ROOT / "_projects" / "build-rhythm.md").read_text(encoding="utf-8"))
        self.assertIn(
            'data-paper-static-accent="static-mesh-gradient"',
            (REPO_ROOT / "_projects" / "designweaver.md").read_text(encoding="utf-8"),
        )

    def test_origin_cue_and_ai_routes_have_stable_hooks(self) -> None:
        origin = (REPO_ROOT / "_includes" / "widget_origin_link.liquid").read_text(encoding="utf-8")
        components = (REPO_ROOT / "_sass" / "_components.scss").read_text(encoding="utf-8")
        switch = (REPO_ROOT / "_includes" / "site_format_switch.liquid").read_text(encoding="utf-8")
        ai_page = (REPO_ROOT / "_pages" / "ai.md").read_text(encoding="utf-8")
        ai_script = (REPO_ROOT / "assets" / "js" / "ai-view.js").read_text(encoding="utf-8")

        self.assertIn("data-origin-cue", origin)
        self.assertIn("widget-origin-glint", origin)
        self.assertIn("widget-origin-glint-core", origin)
        self.assertNotIn("widget-origin-word", origin)
        self.assertNotIn("widget-origin-arrow", origin)
        self.assertNotIn("widget-origin-tooltip", origin)
        self.assertNotIn("widget-origin-thread", origin)
        self.assertIn("2.75rem", components)
        for anchor in ("#projects", "#writing", "#cv", "#project-"):
            self.assertIn(anchor, switch)
        for anchor in ('id="projects"', 'id="writing"', 'id="cv"', 'id="project-{{ project.slug }}"'):
            self.assertIn(anchor, ai_page)
        for target in ("humanProjects", "humanWriting", "humanCv", "data-project-slug"):
            self.assertIn(target, ai_script)


if __name__ == "__main__":
    unittest.main()
