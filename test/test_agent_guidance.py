from __future__ import annotations

import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SKILL_ROOT = REPO_ROOT / ".codex" / "skills"

CANONICAL_HEADINGS = {
    "WEBSITE_DESIGN_HEURISTICS.md": {
        "Decision Order",
        "Agent Quick Index",
        "First-Glance Story",
        "Visual Hierarchy",
        "Color",
        "Motion",
        "Content",
        "Accessibility And Quality Checks",
        "Screenshot Critique Ritual",
        "Acceptance Evidence",
        "Page Archetypes",
        "Occam's Razor For UI",
        "Responsive Layout",
        "Footer And Global Chrome",
        "Blog Voice",
        "Conservative Inspiration Boundaries",
        "Process Artifacts",
        "Maintenance And CI",
    },
    "docs/homepage-desk-scene-brief.md": {
        "Current Priority Order",
        "Known Inspection Targets",
        "Non-Goals",
        "Acceptance Evidence Map",
        "Interaction Discoverability",
        "3D Desk Vignette",
        "Outside Vignette",
        "Acceptance Checklist",
        "Future Model Handoff Prompt",
    },
    "docs/agentic-usage-ledger.md": {
        "Public Data File",
        "Current Snapshot Authority",
        "Update Heuristic",
        "Codex hook behavior",
        "Future Entry Template",
    },
}

SKILL_SOURCE_LINKS = {
    "agentic-usage-ledger": {"docs/agentic-usage-ledger.md", "_data/agentic_usage.yml"},
    "al-folio-upstream-sync": {
        ".github/copilot-instructions.md",
        "docs/BOUNDARIES.md",
        ".al-folio-overrides.yml",
    },
    "homepage-desk-scene": {
        "WEBSITE_DESIGN_HEURISTICS.md",
        "docs/homepage-desk-scene-brief.md",
    },
    "portfolio-writing-voice": {"WEBSITE_DESIGN_HEURISTICS.md"},
    "tacit-knowledge-to-skill": {
        "WEBSITE_DESIGN_HEURISTICS.md",
        "docs/homepage-desk-scene-brief.md",
        "docs/agentic-usage-ledger.md",
    },
    "website-design-critique": {"WEBSITE_DESIGN_HEURISTICS.md"},
}


def read(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


def markdown_headings(relative_path: str) -> set[str]:
    return {
        match.group(1).strip()
        for match in re.finditer(r"^#{1,6}\s+(.+?)\s*$", read(relative_path), flags=re.MULTILINE)
    }


def frontmatter_value(text: str, key: str) -> str | None:
    match = re.search(rf"^{re.escape(key)}:\s*(.+?)\s*$", text, flags=re.MULTILINE)
    if not match:
        return None
    return match.group(1).strip().strip('"\'')


def quoted_yaml_value(text: str, key: str) -> str | None:
    match = re.search(rf'^\s+{re.escape(key)}:\s+"([^"]*)"\s*$', text, flags=re.MULTILINE)
    return match.group(1) if match else None


class AgentGuidanceContractTest(unittest.TestCase):
    def skill_directories(self) -> list[Path]:
        return sorted(path for path in SKILL_ROOT.iterdir() if path.is_dir())

    def test_required_canonical_headings_exist(self) -> None:
        for relative_path, required_headings in CANONICAL_HEADINGS.items():
            with self.subTest(path=relative_path):
                self.assertTrue((REPO_ROOT / relative_path).is_file(), f"missing canonical file: {relative_path}")
                missing = required_headings - markdown_headings(relative_path)
                self.assertEqual(missing, set(), f"{relative_path} is missing headings: {sorted(missing)}")

    def test_all_repo_skills_are_well_formed_and_concise(self) -> None:
        skill_directories = self.skill_directories()
        self.assertGreater(len(skill_directories), 0, "no repo-local skills found")

        for skill_directory in skill_directories:
            skill_name = skill_directory.name
            skill_path = skill_directory / "SKILL.md"
            metadata_path = skill_directory / "agents" / "openai.yaml"
            with self.subTest(skill=skill_name):
                self.assertTrue(skill_path.is_file(), f"{skill_name} is missing SKILL.md")
                self.assertTrue(metadata_path.is_file(), f"{skill_name} is missing agents/openai.yaml")

                skill_text = skill_path.read_text(encoding="utf-8")
                self.assertTrue(skill_text.startswith("---\n"), f"{skill_name} is missing YAML frontmatter")
                self.assertEqual(frontmatter_value(skill_text, "name"), skill_name)
                description = frontmatter_value(skill_text, "description")
                self.assertTrue(description, f"{skill_name} is missing a description")
                self.assertNotRegex(skill_text, r"\b(?:TODO|TBD|PLACEHOLDER)\b")
                self.assertLessEqual(len(skill_text.splitlines()), 200, f"{skill_name} should remain a concise overlay")

                metadata_text = metadata_path.read_text(encoding="utf-8")
                display_name = quoted_yaml_value(metadata_text, "display_name")
                short_description = quoted_yaml_value(metadata_text, "short_description")
                default_prompt = quoted_yaml_value(metadata_text, "default_prompt")
                self.assertTrue(display_name, f"{skill_name} metadata is missing display_name")
                self.assertTrue(short_description, f"{skill_name} metadata is missing short_description")
                self.assertGreaterEqual(len(short_description or ""), 25)
                self.assertLessEqual(len(short_description or ""), 64)
                self.assertTrue(default_prompt, f"{skill_name} metadata is missing default_prompt")
                self.assertTrue(
                    (default_prompt or "").startswith(f"Use ${skill_name} "),
                    f"{skill_name} default_prompt must begin with its literal skill invocation",
                )

    def test_skill_source_links_and_agent_routes_do_not_drift(self) -> None:
        agents_text = read("AGENTS.md")
        discovered_names = {path.name for path in self.skill_directories()}
        self.assertEqual(
            discovered_names,
            set(SKILL_SOURCE_LINKS),
            "update SKILL_SOURCE_LINKS when adding or removing a repo-local skill",
        )

        for skill_name, source_paths in SKILL_SOURCE_LINKS.items():
            skill_text = read(f".codex/skills/{skill_name}/SKILL.md")
            with self.subTest(skill=skill_name):
                self.assertIn(f".codex/skills/{skill_name}/SKILL.md", agents_text)
                for source_path in source_paths:
                    self.assertTrue((REPO_ROOT / source_path).exists(), f"missing source path: {source_path}")
                    self.assertIn(source_path, skill_text, f"{skill_name} does not link to {source_path}")

    def test_parallel_and_customized_fork_contracts_are_visible(self) -> None:
        agents_text = read("AGENTS.md")
        copilot_text = read(".github/copilot-instructions.md")
        claude_text = read("CLAUDE.md")
        design_skill = read(".codex/skills/website-design-critique/SKILL.md")
        scene_skill = read(".codex/skills/homepage-desk-scene/SKILL.md")

        for phrase in (
            "## First-Run Checklist",
            "## Parallel Work Contract",
            "## Verification By Change Type",
            "### Customized-Fork Precedence",
        ):
            self.assertIn(phrase, agents_text)

        self.assertIn("## Customized-Fork Precedence", copilot_text)
        self.assertIn("customized fork", claude_text.lower())
        self.assertIn("curl.exe -fsS http://127.0.0.1:8080/", claude_text)
        self.assertNotIn("must **not** own `_includes`", claude_text)
        self.assertIn("## Parallel Scope", design_skill)
        self.assertIn("## Parallel Scope", scene_skill)
        self.assertIn("one writer at a time", agents_text)
        self.assertIn("coordinator", agents_text.lower())

    def test_repo_local_skills_use_windows_safe_node_commands(self) -> None:
        bare_node_command = re.compile(r"(?<![\w.])(?:npm|npx) (?=(?:run|prettier|playwright)\b)")

        for skill_directory in self.skill_directories():
            skill_text = (skill_directory / "SKILL.md").read_text(encoding="utf-8")
            with self.subTest(skill=skill_directory.name):
                self.assertNotRegex(skill_text, bare_node_command)

    def test_agent_entrypoint_changes_trigger_unit_contract(self) -> None:
        unit_workflow = read(".github/workflows/unit-tests.yml")
        self.assertGreaterEqual(unit_workflow.count('- "CLAUDE.md"'), 2)


if __name__ == "__main__":
    unittest.main()
