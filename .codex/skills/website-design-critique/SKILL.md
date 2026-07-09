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

- Decision Order, Agent Quick Index, Acceptance Evidence
- First-Glance Story, Visual Hierarchy, Color, Motion
- Accessibility And Quality Checks, Screenshot Critique Ritual
- Page Archetypes, Occam's Razor For UI, Responsive Layout
- Footer And Global Chrome, Conservative Inspiration Boundaries

For homepage desk or 3D-widget work, switch to `$homepage-desk-scene` instead of treating the scene as generic page decoration.

For copy changes in posts, projects, case studies, or homepage narrative, also use `$portfolio-writing-voice`.

## Parallel Scope

- Own the affected public routes, page hierarchy, general content presentation, and non-scene responsive behavior.
- Do not change desk-scene geometry, state, album behavior, hit targets, or scene-only selectors. Route those changes to `$homepage-desk-scene`.
- Treat `assets/js/home.js`, `_sass/_home.scss`, and `_includes/home/hero.liquid` as high-conflict shared files. Reserve and serialize any necessary edit through the coordinator; never write one while a scene agent is editing it.
- Do not refresh or push the usage ledger from a worker stream. The coordinator performs the final publish audit after integration.

## Workflow

1. Inspect the rendered affected routes and capture comparable baseline states before changing taste-level details.
2. State the visitor problem: what is unclear, too loud, hidden, cramped, overlapping, or unsupported by evidence?
3. Declare the route/file scope and non-goals, especially any excluded desk-scene or shared files.
4. Prefer the smallest change that improves hierarchy, readability, responsive behavior, proof proximity, or interaction state.
5. Preserve approved copy when layout can solve the issue.
6. Keep motion explanatory, bounded, reduced-motion aware, and quieter than the words.
7. Capture the same rendered states after the change and explain what became clearer.
8. Update `WEBSITE_DESIGN_HEURISTICS.md` only when a durable new design lesson emerges.

## Verification

For meaningful visual passes, rendered verification is required. Verify at least:

- 1440x1000, 1280x800, 768x1024, and 390x1000 screenshots;
- light and dark modes when theme-sensitive UI changed;
- keyboard focus and reduced-motion behavior for interactive elements;
- no text overlap, primary-media occlusion, horizontal overflow, broken route, or new console error.

Use the change-type matrix in `AGENTS.md`. Run targeted Playwright checks and inspect the production Docker/root-site render before publishing public UI changes; source inspection alone is not acceptance evidence.
