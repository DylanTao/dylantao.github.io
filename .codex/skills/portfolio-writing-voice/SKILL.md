---
name: portfolio-writing-voice
description: Maintain Sirui's portfolio, project-page, and blog-writing voice while preserving research meaning and credit. Use when editing `_posts`, `_projects`, project case studies, homepage/site copy, captions, descriptions, reflective posts, teaching artifacts, or source-credit sections, especially when integrating new references into existing writing instead of bolting on detached sections.
---

# Portfolio Writing Voice

## Purpose

Use this skill to keep public writing specific, warm, research-grounded, and credit-aware. The canonical source for the voice constraints is `WEBSITE_DESIGN_HEURISTICS.md`, not this skill.

## Required Context

Read the target file first, then read the relevant headings in `WEBSITE_DESIGN_HEURISTICS.md`:

- Content
- Page Archetypes
- Blog Voice
- Conservative Inspiration Boundaries
- Process Artifacts

For research-skills resource updates, also inspect the existing structure and credit anchors before adding anything.

## Writing Rules

- Preserve research meaning over clever phrasing.
- Tie AI/design language to concrete research questions, artifacts, studies, or situations.
- Integrate new references where they fit the current argument; avoid detached add-on sections unless the structure truly needs one.
- Credit people, papers, talks, reports, collaborators, and tools plainly near the lesson they shaped.
- Keep blog copy casual but useful; every note should tell readers why it is worth opening.
- Keep project pages concrete first: question, artifact, contribution, evidence, venue/status, and links before philosophy.

## Editing Workflow

1. Identify the existing section that already carries the closest idea.
2. Make the smallest integrated edit that improves clarity or credit.
3. Preserve verified links and existing anchors unless the user asks to restructure.
4. Check headings, frontmatter, internal links, and rendered excerpts when the edit affects public navigation.
5. Use `WEBSITE_DESIGN_HEURISTICS.md` for durable lessons, not as a dumping ground for one-off wording.

## Verification

For Markdown/content-only work, usually run:

```powershell
npm run lint:prettier
npm run lint:style-contract
bundle exec jekyll build
```

Add targeted HTML/link inspection when the edit changes generated navigation, previews, or include behavior.
