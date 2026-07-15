# In-Place Project Card Reproduction Brief

Use this brief to let one project preview open inside a collection while preserving orientation and access.

## State contract

- At most one card is expanded.
- Its trigger owns `aria-expanded` and `aria-controls` for a panel with real `hidden` state.
- Keyboard activation moves focus to the primary action.
- Close, Escape, and outside dismissal restore focus before hiding a focused control.
- A polite status announces the opened or closed project.

## One motion clock

1. Measure every card before state changes.
2. Apply the final grid state.
3. On the next frame, translate cards from their previous position to the final position.
4. Reveal newly added active-card space with a clip; never nonuniformly scale text or images.
5. Cancel the prior clock before a rapid retarget and begin from the current visible bounds.
6. Perform at most one post-transition visibility correction.

Sibling cards may translate and quiet slightly, but they should not shrink. Do not layer image zoom, staggered panel keyframes, and simultaneous smooth scrolling on top of FLIP. Keep the ordinary collapsed-card hover lift as the pointer affordance.

## Reduced motion

Apply the final layout immediately, move focus normally, and skip transform, clip, and scroll animation. The same content and recovery paths remain available.

## Acceptance checks

- Test rapid card-to-card retargeting and interruption.
- Test Enter, primary-action focus, Escape, outside dismissal, close, and focus return.
- Test expanded CTA visibility and one-column layout on narrow mobile.
- Capture open and closed states at 1440x1000, 1280x800, 768x1024, and 390x1000.

## Copy-ready coding-agent prompt

> Add accessible in-place previews to my project grid. Keep one expanded card, native button and panel semantics, polite status, keyboard entry, Escape/outside/close recovery, and deterministic focus restoration. Use one cancelable FLIP clock: translate siblings only, reveal active space with clipping, never scale text nonuniformly, and perform at most one post-transition visibility correction. Reduced motion must apply the final state immediately. Preserve a quiet collapsed-card hover lift and verify rapid retargeting plus four responsive viewports.

## Credit

Interaction principle inspired by the [IKEA PS 2026 collection story](https://www.ikea.com/global/en/stories/design/ikea-ps-2026-collection/). Adapt the in-place reading idea, not its assets, layout, or motion signature.
