# Build Rhythm Reproduction Brief

Use this brief to create a site-native activity story from your own aggregate data. Adapt the reasoning, not Sirui Tao's data, layout, palette, or code.

## Visitor problem

Help a reader understand cadence and change without implying that commits, lines, or tokens measure productivity, quality, or cause.

## Data boundary

- Publish dated aggregates only. Never ship repository names, commit messages, raw account events, credentials, or private identifiers.
- Keep GitHub commits, additions, and deletions on one weekly calendar.
- Keep tool-use tokens on their own truthful horizon and source label.
- Do not combine the measures into one score or animate a static snapshot as live activity.

## Suggested structure

1. Cadence: weekly commits, explicitly labeled as cadence rather than productivity.
2. Magnitude and direction: additions and deletions around the same selected week.
3. Readable and literal: explain any log or symmetric-log transform while preserving exact values.
4. A separate clock: reset before showing a shorter tool-use snapshot.
5. Explorer: range, scale, keyboard inspection, and exact tables.

## Interaction contract

- Use normal scroll and a bounded SVG story; do not hijack wheel or touch input.
- One selected period synchronizes chart marks, readout, annotation, and table row.
- Provide focusable marks or an equivalent slider with arrow, Home, and End keys.
- Reduced motion switches chapters immediately to complete still states.
- Pause work when the story is offscreen or the tab is hidden.

## Acceptance checks

- Verify desktop, laptop, tablet, and narrow mobile.
- Verify keyboard inspection, visible focus, exact tables, and horizontal-table guidance.
- Verify no productivity, cost, plan-price, or causal language slips into the interface.
- Verify loading failure leaves a readable explanation and server-rendered context.

## Copy-ready coding-agent prompt

> Build an evidence-first activity story for my site using only my dated aggregate data. Keep commits, additions, deletions, and tool-use tokens in their truthful units and time horizons. Use normal scrolling, one bounded transition, keyboard inspection, exact tables, a reduced-motion still state, and clear source/freshness labels. Do not publish repository names, raw events, credentials, cost theater, productivity rankings, or causal claims. Match my site's typography, color roles, and responsive system. Test the same important states at desktop, laptop, tablet, and narrow mobile widths.

## Credit

Narrative pacing inspired by [The Rhythm of Food](https://rhythm-of-food.net/) by Google News Lab and Truth & Beauty, introduced to Sirui by [John Thompson](https://jrthomp.com/). No source assets, layout, or code are included here.
