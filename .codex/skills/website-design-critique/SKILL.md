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

- Decision Order, Agent Quick Index, Acceptance Evidence, Proportional Visual QA
- First-Glance Story, Visual Hierarchy, Color, Motion
- Accessibility And Quality Checks, Screenshot Critique Ritual
- Page Archetypes, Occam's Razor For UI, Responsive Layout
- Footer And Global Chrome, Conservative Inspiration Boundaries

For homepage desk or 3D-widget work, switch to `$homepage-desk-scene` instead of treating the scene as generic page decoration.

For copy changes in posts, projects, case studies, or homepage narrative, also use `$portfolio-writing-voice`.

For a new or deferred visual idea, also read `docs/design-experiment-backlog.md`. Record the hypothesis, licensing boundary, visitor benefit, budget, evidence, Sirui decision, and revisit trigger there instead of inventing a parallel skill or silently treating inspiration as approval to ship.

## Parallel Scope

- Own the affected public routes, page hierarchy, general content presentation, and non-scene responsive behavior.
- Do not change desk-scene geometry, state, album behavior, hit targets, or scene-only selectors. Route those changes to `$homepage-desk-scene`.
- Treat `assets/js/home.js`, `_sass/_home.scss`, and `_includes/home/hero.liquid` as high-conflict shared files. Reserve and serialize any necessary edit through the coordinator; never write one while a scene agent is editing it.
- Do not refresh or push the usage ledger from a worker stream. The coordinator performs the final publish audit after integration.

## Workflow

1. Inspect one representative rendered state and capture a comparable baseline before changing taste-level details.
2. State the visitor problem: what is unclear, too loud, hidden, cramped, overlapping, or unsupported by evidence?
3. Declare the route/file scope and non-goals, especially any excluded desk-scene or shared files.
4. Prefer the smallest change that improves hierarchy, readability, responsive behavior, proof proximity, or interaction state.
5. Preserve approved copy when layout can solve the issue.
6. Keep motion explanatory, bounded, reduced-motion aware, and quieter than the words.
7. Capture the same representative state after the change and explain what became clearer. Expand to the checkpoint matrix only after the direction is worth keeping.
8. Update `WEBSITE_DESIGN_HEURISTICS.md` only when a durable new design lesson emerges.

## Verification

Use the `Proportional Visual QA` ladder in `WEBSITE_DESIGN_HEURISTICS.md`:

- **Iteration:** reuse the owned server and run `npm.cmd run test:visual:iterate` for exactly one route, state, theme, and viewport. Inspect the saved PNG directly. Do not run a full build or matrix between small design adjustments.
- **Checkpoint:** set an explicit `VISUAL_ROUTE_IDS` list and run `npm.cmd run test:visual:checkpoint`; add relevant focus, motion, contrast, or interaction checks.
- **Release:** run the full four-viewport public and legacy suites only after Sirui accepts the direction and the integrated diff is ready to publish.
- If interactive browser capture stalls once, switch to the repository Playwright lane. Do not spend repeated tool calls reconnecting visual control.

Use the change-type matrix in `AGENTS.md`. Source inspection alone is not acceptance evidence, but release-sized evidence is not required for each intermediate taste judgment.
