# In-Place Project Card Reproduction Brief

Use this brief to let one project preview open inside a collection while preserving orientation and access.

## State contract

- At most one card is expanded.
- Its trigger owns `aria-expanded` and `aria-controls` for a panel with real `hidden` state.
- Keyboard activation moves focus to the primary action after settlement unless the visitor has moved focus elsewhere.
- Close, Escape, and outside dismissal restore focus before hiding a focused control.
- A polite status announces the opened or closed project.

## One motion clock

1. Measure every card and the candidate active surface before state changes.
2. Apply the final grid state.
3. On the next frame, translate cards from their previous position to the final position.
4. Reveal newly added space on the opening card with a surface clip driven by the same timing; never nonuniformly scale text or images.
5. Cancel the prior clock before a rapid retarget and begin from the current visible bounds.
6. Perform at most one post-transition visibility correction.

Sibling cards may translate and quiet slightly, but they should not shrink. Do not layer image zoom, staggered panel keyframes, or simultaneous smooth scrolling on top of FLIP. Closing should update `hidden`, `aria-expanded`, and focus immediately, then let translation-only layout motion explain the collapse; do not keep an outgoing visual clone alive. Clean up finished animation objects as part of settlement so engines that retain them cannot leak stale state. Keep the ordinary collapsed-card hover lift as the pointer affordance.

## Reduced motion

Apply the final layout immediately, move focus normally, and skip transform, clip, and scroll animation. The same content and recovery paths remain available.

## Acceptance checks

- Test rapid card-to-card retargeting and interruption.
- Test Enter, primary-action focus, Escape, outside dismissal, close, and focus return.
- Test expanded CTA visibility, 44-pixel primary and close actions, and one-column layout on narrow mobile.
- Capture open and closed states at 1440x1000, 1280x800, 768x1024, and 390x1000.

## Accepted checkpoints

- `192bcc00c` established the 430 ms translation-only FLIP pass, stale-run cancellation, deterministic focus-before-hide, and reduced-motion checks.
- `8d98dc902` added the shared opening clip, removed descendant keyframes and image zoom, guarded delayed keyboard focus against interruption, explicitly cleared finished animations across Chromium and WebKit, and put the expanded light/dark state into the four-viewport CI matrix.

## Copy-ready coding-agent prompt

> Add accessible in-place previews to my project grid. Keep one expanded card, native button and panel semantics, polite status, keyboard entry, Escape/outside/close recovery, deterministic focus restoration, and 44-pixel actions. Use one cancelable FLIP clock: translate siblings only, reveal the opening surface with clipping, never scale text nonuniformly, and perform at most one post-transition visibility correction. Reduced motion must apply the final state immediately. Preserve a quiet collapsed-card hover lift and verify rapid retargeting plus four responsive viewports.

## Credit

Interaction principle inspired by the [IKEA PS 2026 collection story](https://www.ikea.com/global/en/stories/design/ikea-ps-2026-collection/). Adapt the in-place reading idea, not its assets, layout, or motion signature.
