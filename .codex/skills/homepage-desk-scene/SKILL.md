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

Use `WEBSITE_DESIGN_HEURISTICS.md` only for broader design principles such as restrained motion, proof proximity, responsive layout, and materiality.

## Working Rules

- Preserve shared 2D/3D state: current meme record, spin state, and discovered album/source-card order.
- Keep the `2D | 3D` switch visible but quiet.
- Keep album, artifact-card, dropped-card, window, outside-return, reset, drag, zoom, and mobile interactions deliberate and discoverable.
- Maintain the warm Japandi cliff-cave room/exterior continuity described in the brief.
- Keep the public handoff prompt in `docs/homepage-desk-scene-brief.md`; update it only when the actual next-task contract changes.
- Keep the usage counter readable and compact; use `$agentic-usage-ledger` for counter math and freshness.

## Verification

For small source-only edits, run the relevant lint/build checks from `AGENTS.md`.

For behavior or visual edits, use Playwright or browser screenshots across desktop and mobile states:

- 2D cards and record legibility
- 3D interior default and interaction movement
- outside view and return path
- album swap/focus/drop states
- mobile scene controls and usage note

Before accepting a 3D change, confirm the canvas is nonblank and drag/zoom produce visible pixel changes.
