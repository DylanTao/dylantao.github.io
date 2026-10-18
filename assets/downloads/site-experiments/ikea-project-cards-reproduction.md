# In-Place Project Card Reproduction Brief

Use this brief to let one project preview open inside a collection while preserving orientation and access.

## State contract

- At most one card is expanded.
- Its trigger owns `aria-expanded` and `aria-controls` for a panel with real `hidden` state.
- Keyboard activation moves focus to the primary action after settlement unless the visitor has moved focus elsewhere.
- Close, Escape, and outside dismissal restore focus before hiding a focused control.
- A polite status announces the opened or closed project.

## One spring, one clock

1. Measure every card, the candidate active surface and its picture before state changes.
2. Apply the final grid state. Keep the opened card in its own row: span two columns from its own column, or from the previous one when it ends a row, so no hole is left behind.
3. Measure the whole new layout before creating any animation (a running transform shows up in every rectangle read beneath it).
4. Translate cards from their previous position to the final one along one damped spring (damping ratio 0.84, about 0.6 s to settle), sampled into keyframes. Neighbours wait for a ripple that spreads from the opened card, nearer ones first (at most about 0.11 s), and squash by at most 3% along their path as they land, keeping their area. A card that wraps between rows fades along its row and arrives at the other end of the new one instead of flying diagonally across its neighbours.
5. Reveal newly added space on the opening card with a surface clip on the same spring, and carry its picture with a uniform scale of its painted area; never nonuniformly scale text or images.
6. Let the opened card's words arrive in reading order with a short rise and fade, after its growth reads. Its actions bud out of the panel's edge as one liquid drop and split into their buttons (a throwaway goo-filtered layer under the real buttons), then the labels settle in.
7. Before a rapid retarget, read each element's current speed from its spring, cancel the run, and start the next one from the current visible bounds with that speed.
8. Perform at most one visibility correction after settling, only as far as needed; closing returns the reader to the scroll position they opened from if they have not scrolled.

Sibling cards may translate, squash slightly as they land and quiet slightly, but they should not shrink, and none may widen the page while it travels (clip the grid's horizontal overflow during the run). Closing should update `hidden`, `aria-expanded`, and focus immediately, then let layout motion explain the collapse; do not keep an outgoing visual clone alive. Clean up finished animation objects as part of settlement so engines that retain them cannot leak stale state. Put the close button where the plus was (beside the picture, or just below it on a phone, never over the figure), and keep the ordinary collapsed-card hover lift as the pointer affordance.

## Reduced motion

Apply the final layout immediately, move focus normally, and skip transform, clip, and scroll animation. The same content and recovery paths remain available.

## Acceptance checks

- Test rapid card-to-card retargeting and interruption.
- Test Enter, primary-action focus, Escape, outside dismissal, close, and focus return.
- Test expanded CTA visibility, 44-pixel primary and close actions, and one-column layout on narrow mobile.
- Capture open and closed states at 1440x1000, 1280x800, 768x1024, and 390x1000.

## Accepted checkpoints

- `192bcc00c` established the 430 ms translation-only FLIP pass, stale-run cancellation, deterministic focus-before-hide, and reduced-motion checks.
- `9fa9403e4` added the shared opening clip, removed descendant keyframes and image zoom, guarded delayed keyboard focus against interruption, explicitly cleared finished animations across Chromium and WebKit, and put the expanded light/dark state into the four-viewport CI matrix.
- October 2026 spring revision: in-row placement without holes, one sampled spring with momentum handed through interruptions, wrap-around cards that fade instead of crossing, a uniform-scale picture move, the story in reading order, the close button in the plus's corner, no page-widening travel, and scroll restoration on close.
- October 18, 2026 glass revision: glass cards (the card's own teaser blurred behind its glass), a ripple ordered by distance with a landing squash for neighbours, and actions that bud out as a liquid drop. Parent projects became decks that open in place on the same springs (`assets/js/project-decks.mjs`).

## Copy-ready coding-agent prompt

> Add accessible in-place previews to my project grid. Keep one expanded card, native button and panel semantics, polite status, keyboard entry, Escape/outside/close recovery, deterministic focus restoration, and 44-pixel actions. Open the card in its own row so no hole is left. Move everything on one damped spring sampled into keyframes, let neighbours start in a ripple ordered by distance and squash slightly (area kept) as they land, hand each element's speed to the next run when a click interrupts, fade cards that wrap between rows instead of flying them across, reveal the opening surface with clipping, carry its picture with a uniform scale, never scale text nonuniformly, and perform at most one visibility correction. Reduced motion must apply the final state immediately. Preserve a quiet collapsed-card hover lift and verify rapid retargeting plus four responsive viewports.

## Credit

Interaction principle inspired by the [IKEA PS 2026 collection story](https://www.ikea.com/global/en/stories/design/ikea-ps-2026-collection/). Adapt the in-place reading idea, not its assets, layout, or motion signature.
