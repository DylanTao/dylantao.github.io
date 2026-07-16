# Build Rhythm Reproduction Brief

Use this brief to create a site-native activity story from your own aggregate data. Adapt the reasoning, not Sirui Tao's data, layout, palette, or code.

## Visitor problem

Help a reader understand cadence, change, a repo-scoped token rhythm, and a separate account-health observation without implying that any of them measures productivity, quality, or cause.

## Data boundary

- Publish dated aggregates only. Never ship repository names, commit messages, credentials, account aliases, account identifiers, plans, raw quota percentages, reset times, or exact per-account usage.
- Keep GitHub commits, additions, and deletions on one weekly calendar.
- Build a repo-token rhythm only from a separate public evidence source: deduplicated retained logs attributed to that repo. Declare one reporting timezone, group by day, fill quiet dates, and publish cumulative rounded values rather than session or event records.
- The exact point keys are `date`, `token_count`, and `tokens_label`. Dates must be consecutive, counts must be nonnegative and nondecreasing, and the latest point must match the public rounded repo total. Differences between adjacent rounded points are rounded increases, not exact daily usage.
- Fail closed if the token source is missing or malformed. Never include session, turn, model, path, raw-event, account, quota, or cost fields in the series. The estimate may revise when retained evidence changes, so expose its cutoff, freshness, method, and estimate confidence.
- Keep direct quota health on its own observation date and report only anonymous account counts. Quota windows remain per-account and non-additive.
- If you retain a rounded personal token checkpoint as historical context, label its date and one-account coverage; never present it as a multi-account total or current quota health.
- Do not combine the three sources into one score or animate a static snapshot as live activity.

## Suggested structure

1. Cadence: weekly commits, explicitly labeled as cadence rather than productivity.
2. Magnitude and direction: additions and deletions around the same selected week.
3. Readable and literal: explain any log or symmetric-log transform while preserving exact values.
4. Token accumulation: show the rounded daily cumulative repo estimate and its rounded adjacent-point increases as a workload trace, not a quality score.
5. Change the measure: reset before showing a dated anonymous account-health observation, and explain why its quota windows cannot be summed.
6. Explorer: range, scale, keyboard inspection, and the exact GitHub table.

## Interaction contract

- Use normal scroll and a bounded SVG story; do not hijack wheel or touch input.
- One selected period synchronizes chart marks, readout, annotation, and table row.
- Provide focusable marks or an equivalent slider with arrow, Home, and End keys.
- Keep a server-rendered daily token summary and table outside any `aria-hidden` chart so the rounded endpoint and source points remain available without JavaScript.
- Reduced motion switches chapters immediately to complete still states.
- Pause work when the story is offscreen or the tab is hidden.

## Acceptance checks

- Verify desktop, laptop, tablet, and narrow mobile.
- Verify keyboard inspection, visible focus, the exact GitHub table, the rounded daily token table, and horizontal-table guidance.
- Verify no productivity, cost, plan-price, or causal language slips into the interface.
- Verify token dates are consecutive, counts are safe nonnegative integers and nondecreasing, point keys are exact, and the latest label equals the public repo total.
- Verify a missing, malformed, or privacy-unsafe token source leaves the GitHub explorer and server-rendered token evidence intact while withholding the enhanced token chart.
- Verify complete and pending account-health states both remain truthful; a missing observation must never render as a false zero.
- Verify any personal token checkpoint remains visibly historical, rounded, and scoped to one account.
- Verify loading failure leaves a readable explanation and server-rendered context.

## Copy-ready coding-agent prompt

> Build an evidence-first activity story for my site using only dated aggregates. Keep weekly GitHub cadence, a daily cumulative repo-token estimate, and dated anonymous account health on three separate clocks; never sum per-account quota windows. Derive the token rhythm only from deduplicated repo-attributed retained logs, use consecutive Pacific dates with quiet-day fill and rounded nondecreasing points, and expose a server-rendered daily table. Treat adjacent differences as rounded increases, not exact daily use. Fail closed on missing or malformed token data and never publish session, turn, model, path, account, quota, raw-event, or cost fields. If I supply a rounded historical personal checkpoint, label its date and one-account coverage instead of treating it as current or additive. Use normal scrolling, one bounded transition, keyboard inspection, an exact GitHub table, a reduced-motion still state, and clear source/freshness labels. Do not claim productivity, quality, or cause. Match my site's typography, color roles, and responsive system. Test desktop, laptop, tablet, narrow mobile, keyboard, reduced motion, and invalid-data fallback states.

## Credit

Narrative pacing inspired by [The Rhythm of Food](https://rhythm-of-food.net/) by Google News Lab and Truth & Beauty, introduced to Sirui by [John Thompson](https://jrthomp.com/). No source assets, layout, or code are included here.
