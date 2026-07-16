# Build Rhythm Reproduction Brief

Use this brief to create a site-native activity story from your own aggregate data. Adapt the reasoning, not Sirui Tao's data, layout, palette, or code.

## Visitor problem

Help a reader understand cadence, change, and a separate account-health observation without implying that any of them measures productivity, quality, or cause.

## Data boundary

- Publish dated aggregates only. Never ship repository names, commit messages, credentials, account aliases, account identifiers, plans, raw quota percentages, reset times, or exact per-account usage.
- Keep GitHub commits, additions, and deletions on one weekly calendar.
- Keep direct quota health on its own observation date and report only anonymous account counts. Quota windows remain per-account and non-additive.
- If you retain a rounded personal token checkpoint as historical context, label its date and one-account coverage; never present it as a multi-account total or current quota health.
- Do not combine the measures into one score or animate a static snapshot as live activity.

## Suggested structure

1. Cadence: weekly commits, explicitly labeled as cadence rather than productivity.
2. Magnitude and direction: additions and deletions around the same selected week.
3. Readable and literal: explain any log or symmetric-log transform while preserving exact values.
4. Change the measure: reset before showing a dated anonymous account-health observation, and explain why its quota windows cannot be summed.
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
- Verify complete and pending account-health states both remain truthful; a missing observation must never render as a false zero.
- Verify any personal token checkpoint remains visibly historical, rounded, and scoped to one account.
- Verify loading failure leaves a readable explanation and server-rendered context.

## Copy-ready coding-agent prompt

> Build an evidence-first activity story for my site using only my dated aggregate data. Keep weekly commits and line changes separate from anonymous account-health counts; never sum per-account quota windows. If I supply a rounded historical token checkpoint, label its date and one-account coverage instead of treating it as current or additive. Use normal scrolling, one bounded transition, keyboard inspection, exact tables, a reduced-motion still state, and clear source/freshness labels. Do not publish repository names, account identifiers, raw events, credentials, percentages, reset times, cost theater, productivity rankings, or causal claims. Match my site's typography, color roles, and responsive system. Test the same important states at desktop, laptop, tablet, and narrow mobile widths.

## Credit

Narrative pacing inspired by [The Rhythm of Food](https://rhythm-of-food.net/) by Google News Lab and Truth & Beauty, introduced to Sirui by [John Thompson](https://jrthomp.com/). No source assets, layout, or code are included here.
