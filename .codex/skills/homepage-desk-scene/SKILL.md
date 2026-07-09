---
name: homepage-desk-scene
description: Maintain and improve the customized homepage 2D/3D interactive desk, album, coffee-stain, usage-counter, and Japandi cliff-cave room scene. Use when changing `assets/js/home.js`, `_sass/_home.scss`, `_includes/home/hero.liquid`, `docs/homepage-desk-scene-brief.md`, homepage 3D room/exterior behavior, album or artifact interactions, desk-scene responsive layout, or visual QA for the homepage desk widget.
---

# Homepage Desk Scene

## Purpose

Use this skill for the homepage desk/album scene. Do not treat this as a generic hero decoration pass; the scene has a canonical brief, shared interaction state, and visual QA history.

## Required Context

Read these before changing scene behavior:

- `docs/homepage-desk-scene-brief.md`
- `_includes/home/hero.liquid`
- `_sass/_home.scss`
- `assets/js/home.js`

Start with `Current Priority Order`, `Known Inspection Targets`, `Non-Goals`, and `Acceptance Evidence Map` in the brief. Use `WEBSITE_DESIGN_HEURISTICS.md` only for broader design principles such as decision order, restrained motion, proof proximity, responsive layout, and materiality.

## Parallel Scope

- Own scene behavior and scene-owned regions in `assets/js/home.js`, `_sass/_home.scss`, `_includes/home/hero.liquid`, the canonical brief, relevant home interaction tests, and scene assets.
- Do not rewrite posts, projects, general homepage narrative, global navigation, footer, or unrelated styles.
- Treat the three implementation files above as high-conflict shared paths. Reserve each file through the coordinator and never edit it while a sitewide agent is writing it.
- Do not refresh the usage ledger or push from a worker stream. Use `$agentic-usage-ledger` only at the coordinator's final integrated publish checkpoint.

## Working Rules

- Preserve shared 2D/3D state: current meme record, spin state, and discovered album/source-card order.
- Keep the `2D | 3D` switch visible but quiet.
- Keep album, artifact-card, dropped-card, window, outside-return, reset, drag, zoom, and mobile interactions deliberate and discoverable.
- Maintain the warm Japandi cliff-cave room/exterior continuity described in the brief.
- Fix functional state, anchor continuity, object legibility, and responsive access before adding richer geometry or effects.
- Keep the public handoff prompt in `docs/homepage-desk-scene-brief.md`; update it only when the actual next-task contract changes.
- Keep the usage counter readable and compact; never infer or hardcode counter math in scene code.

## Verification

For small source-only edits, run the relevant lint/build checks from `AGENTS.md`.

For behavior or visual edits, use the brief's acceptance evidence map and comparable Playwright/browser screenshots at 1440x1000, 1280x800, 768x1024, and 390x1000:

- 2D cards and record legibility
- 3D interior default, side/rear yaw, and interaction movement
- outside default/zoom and return path
- album swap/focus/drop states
- mobile scene controls and usage note
- light/dark surfaces, keyboard focus, reduced motion, overflow, and console errors

Before accepting a 3D change, confirm the canvas is nonblank and drag/zoom produce visible pixel changes. Run the targeted commands in the brief and the production Docker/root-site verification in `AGENTS.md`; report remaining limitations rather than marking an unverified state complete.
