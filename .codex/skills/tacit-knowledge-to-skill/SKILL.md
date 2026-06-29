---
name: tacit-knowledge-to-skill
description: Decide whether Dylan/Sirui's tacit design, writing, engineering, or workflow knowledge should stay in a human-facing living Markdown note, become a new repo-local Codex skill, or update an existing skill. Use when a user asks to convert heuristics, critique rituals, handoff prompts, recurring repo procedures, project-writing guidance, blog-writing guidance, or other reusable agent knowledge into skills, or when a new lesson should be recorded for future Codex sessions.
---

# Tacit Knowledge To Skill

## Purpose

Use this skill to keep human-readable knowledge and agent-operational knowledge linked without duplicating long rules. The default for this repo is human Markdown first, with concise `.codex/skills/*/SKILL.md` overlays that point to canonical docs.

## Decision Rules

Create or update a skill when the knowledge is:

- repeated across sessions and likely to save future exploration time;
- procedural enough that Codex can act on it;
- fragile, high-cost, or easy to forget during implementation;
- triggered by recognizable user phrases, paths, workflows, or repo areas;
- better expressed as an agent workflow than as public prose.

Keep the knowledge only in human Markdown when it is:

- primarily a teaching artifact, blog-ready note, reflection, or copy-pastable prompt;
- taste language that humans should read and adapt directly;
- still evolving too quickly to become operational guidance;
- useful context but not a reliable trigger for agent behavior.

Update an existing skill instead of creating a new one when the trigger, source docs, validation commands, or output style already fit a current skill.

## Source Model

Preserve canonical human files unless the user explicitly wants a migration:

- `WEBSITE_DESIGN_HEURISTICS.md` stays the canonical design and writing memory.
- `docs/homepage-desk-scene-brief.md` stays the canonical desk-scene brief and handoff prompt.
- `docs/agentic-usage-ledger.md` stays the canonical usage math and evidence log.

Skills should quote paths and headings, not copy whole sections. If a skill and a human doc disagree, treat the human doc as the source of truth and update the skill to point at the current heading or workflow.

## Conversion Workflow

1. Inspect the existing docs, skills, and agent guidance before deciding.
2. Classify each candidate as `human doc only`, `new skill`, or `update existing skill`.
3. For each skill, write a trigger-rich frontmatter `description`; keep detailed source material in canonical docs.
4. Add `agents/openai.yaml` with a literal `$skill-name` default prompt.
5. Add or update a short routing note in `AGENTS.md` when the skill changes how future agents should start.
6. Validate the skill with `python C:\Users\dylan\.codex\skills\.system\skill-creator\scripts\quick_validate.py <skill-folder>`.

## Validation

Check for:

- matching folder name and YAML `name`;
- no placeholder text;
- trigger language in the description;
- `agents/openai.yaml` default prompt that includes the literal `$skill-name`;
- links from the skill to the canonical human docs it depends on;
- no duplicated long heuristic lists that would drift.
