# Shared-State 2D/3D Desk Reproduction Brief

Use this brief to design your own compact artifact scene. Preserve the state and evidence pattern; do not clone Sirui Tao's room, personal images, copy, geometry, or album art.

## Visitor problem

Offer a quick 2D proof collection and a richer 3D view without making them feel like unrelated demos or pushing the portfolio's main claim below the fold.

## Start with one logical state

- Define the selected artifact, play/active state, and discovery order once.
- Let 2D and 3D render that shared state; a mode switch changes representation, not content.
- Keep the stage height stable at each breakpoint so switching modes does not move the page.
- Provide explicit reset, Escape, and scroll-away recovery.

## Build the 3D world anchor-first

1. Establish room bounds, opening, floor, work surface, evidence objects, and camera targets in one coordinate system.
2. Use the same scene graph for inside and outside views; change cameras and context instead of hand-matching a second miniature.
3. Give important objects real thickness before adding texture or atmosphere.
4. Keep rendering lightweight: capped device pixel ratio, visibility-gated animation, cheap generated textures, and no heavy simulation by default.

## Access and motion

- Keep the 2D | 3D switch visible, quiet, keyboard-operable, and touch-friendly.
- Never make zoom automatically change inside/outside state.
- Reduced motion settles every discovery into the same final state without flight or pulse.
- Preserve a complete static composition if WebGL is unavailable.

## Model-to-model review record

For each pass, record the date, model and effort as context, commit, attempted change, visitor problem, accepted result, failure or reversion, and comparable evidence. Hold the brief, viewports, and important states steady. Do not claim the model alone caused the outcome.

## Extending the desk into an inhabited home

- Keep 2D as the initial view at every width; remember deliberate session choices.
- Separate the actor, art direction, room camera, selected album, and clock preview into independent state.
- Author room anchors, editable schedules, and activity/prop definitions as data. Use an IANA time zone for the routine and test DST, midnight, weekends, and returning from a hidden tab.
- Now follows the routine; exploring opts out until the visitor explicitly returns. Treat the schedule as an imagined day, never as real location tracking.
- Use connected floor, cliff, and water geometry. Do not substitute a background illustration for an explorable exterior.
- Export editable Blender sources, skinned GLBs, and named clips. Inspect hands, feet, furniture, and prop contact in the browser after every rig change.
- Make rendering treatments differ in projection, physical detail, light, and motion as appropriate, while preserving identity and interaction state. Keep image-derived splat studies isolated from the production engine.

## Acceptance checks

- Capture 1440x1000, 1280x800, 768x1024, and 390x1000.
- Verify nonblank rendering plus visible drag and zoom changes.
- Verify selected state and discovery order across mode switches.
- Verify keyboard focus, touch controls, reduced motion, dark surfaces, overflow, console errors, and every recovery path.

## Copy-ready coding-agent prompt

> Build a compact 2D/3D artifact scene for my portfolio. First define one shared state for selected artifact, active state, and discovery order. Keep 2D as the quick evidence view and 3D as an optional exploration of the same objects. Derive inside and outside views from one scene graph, use lightweight geometry and materials, preserve keyboard/touch/reset/Escape paths, cap rendering cost, and provide complete reduced-motion and non-WebGL states. Iterate with the same four viewports and interaction states, and report what each pass fixed, broke, or reverted.

## Credit boundary

Sirui's artifact-language lesson was influenced by [Jackie Hu's portfolio](https://jackiehu.design/). Use meaningful artifacts from your own life and work; do not reuse source assets or exact styling.
