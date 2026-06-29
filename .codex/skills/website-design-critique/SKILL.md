---
name: website-design-critique
description: Critique and refine the customized DylanTao/Sirui academic portfolio using the living website design heuristics. Use for homepage redesigns, sitewide visual audits, screenshot critique loops, responsive polish, motion and hierarchy tuning, project-card or publication-page visual passes, and any request that says to make the site clearer, more polished, less flashy, more restrained, or grounded in design principles.
---

# Website Design Critique

## Purpose

Use this skill for design judgment, not for generic decoration. The canonical design memory is `WEBSITE_DESIGN_HEURISTICS.md`; read the relevant headings there before proposing or implementing visual changes.

## Required Context

Always start with:

```powershell
Get-Content -Raw WEBSITE_DESIGN_HEURISTICS.md
```

For targeted work, focus on these headings:

- First-glance story, Visual Hierarchy, Color, Motion
- Accessibility And Quality Checks, Screenshot Critique Ritual
- Page Archetypes, Occam's Razor For UI, Responsive Layout
- Footer And Global Chrome, Conservative Inspiration Boundaries

For homepage desk or 3D-widget work, switch to `$homepage-desk-scene` instead of treating the scene as generic page decoration.

## Workflow

1. Inspect the actual page, screenshots, or affected templates before changing taste-level details.
2. State the visitor problem: what is unclear, too loud, hidden, cramped, overlapping, or unsupported by evidence?
3. Prefer the smallest change that improves hierarchy, readability, responsive behavior, proof proximity, or interaction state.
4. Preserve approved copy when layout can solve the issue.
5. Keep motion explanatory, bounded, reduced-motion aware, and quieter than the words.
6. Update `WEBSITE_DESIGN_HEURISTICS.md` only when a durable new design lesson emerges.

## Verification

For meaningful visual passes, verify at least:

- desktop, laptop/tablet, and narrow mobile screenshots;
- light and dark modes when theme-sensitive UI changed;
- keyboard focus and reduced-motion behavior for interactive elements;
- no text overlap, primary-media occlusion, or horizontal overflow.

Use repo commands from `AGENTS.md`; run Docker or Playwright visual checks when rendered UI changed enough that source inspection is not reliable.
