---
name: portfolio-writing-voice
description: Maintain Sirui's portfolio, CV, project, and blog voice while preserving research meaning and credit. Use for public copy, discovery summaries, reflective posts, teaching artifacts, and source-credit edits, especially when integrating references into an existing argument.
---

# Portfolio Writing Voice

## Purpose

Use this skill to keep public writing specific, warm, research-grounded, and credit-aware. The canonical source for the voice constraints is `WEBSITE_DESIGN_HEURISTICS.md`, not this skill.

## Required Context

Read the target file first, then read the relevant headings in `WEBSITE_DESIGN_HEURISTICS.md`:

- Decision Order
- Content
- Page Archetypes
- Blog Voice
- Conservative Inspiration Boundaries
- Process Artifacts
- Reflective Practice

For research-skills resource updates, also inspect the existing structure and credit anchors before adding anything.

For a CV PDF refresh, read `artwork/cv/README.md` for the canonical source, builder, and PDF checks. Follow the guidance for source recovery and verifying public formats in `Reflective Practice` before deferring for a missing local source.

When a story is testing a new visual or data-storytelling treatment, also read `docs/design-experiment-backlog.md` so the narrative hypothesis, source/license boundary, evidence, and Sirui decision remain connected to the copy rather than becoming undocumented style drift.

## Writing Rules

- Preserve research meaning over clever phrasing.
- Tie AI/design language to concrete research questions, artifacts, studies, or situations.
- Integrate new references where they fit the current argument; avoid detached add-on sections unless the structure truly needs one.
- Credit people, papers, talks, reports, collaborators, and tools plainly near the lesson they shaped.
- Keep blog copy casual but useful; every note should tell readers why it is worth opening.
- Keep project pages concrete first: question, artifact, contribution, evidence, venue/status, and links before philosophy.

## Parallel Scope

- Own the selected posts, projects, case studies, captions, excerpts, and narrative fields agreed for the content stream.
- Do not rewrite desk-scene copy, interaction labels, album metadata, or scene implementation files; route those changes to `$homepage-desk-scene`.
- Use `$website-design-critique` when the visitor problem is layout or hierarchy rather than wording.
- Do not push from a worker stream. Leave publishing to the coordinator.

## Editing Workflow

1. Identify the page's verified claims, source/credit anchors, and the existing section that already carries the closest idea.
2. State the reader problem and preserve the scope of the research claim before tightening prose.
3. Make the smallest integrated edit that improves clarity or credit.
4. Preserve verified links and existing anchors unless the user asks to restructure; verify new references before presenting them as sources.
5. Check headings, frontmatter, internal links, generated excerpts/cards, and the rendered route when the edit affects public navigation.
6. For discovery summaries or CV formats, compare visible claims, dates, status, and credit with their canonical sources. Preserve successful wording when the observed problem is a link, semantic structure, or stale snapshot; use `docs/SEO.md` for discovery checks.
7. Compare the result with the original reader problem. State the observed improvement and remaining uncertainty using `Reflective Practice`; promote only a reusable lesson into `WEBSITE_DESIGN_HEURISTICS.md`.

## Verification

For Markdown/content-only work, usually run:

```powershell
npm.cmd run lint:prettier
npm.cmd run lint:style-contract
bundle exec jekyll build
```

Add targeted HTML/link inspection when the edit changes generated navigation, previews, or include behavior.

Before handoff, summarize which claims were preserved, which sources or credits were added or moved, and which rendered routes/excerpts were checked. Keep qualitative feedback separate from measured search outcomes.
