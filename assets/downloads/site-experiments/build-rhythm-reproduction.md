# Build Rhythm Reproduction Brief

Use this brief to create a site-native activity story from your own aggregate data. Adapt the reasoning, not Sirui Tao's data, layout, palette, or code.

## Visitor problem

Help a reader understand cadence, change, observed combined-lifetime growth, and a separate repo-scoped token rhythm without implying that any of them measures productivity, quality, or cause.

## Data boundary

- Publish dated aggregates only. Never ship repository names, commit messages, credentials, source identities, plans, reset times, or source-level usage.
- Keep GitHub commits, additions, and deletions on one weekly calendar.
- Build a repo-token rhythm only from a separate public evidence source: deduplicated retained logs attributed to that repo. Declare one reporting timezone, group by day, fill quiet dates, and publish cumulative rounded values rather than session or event records.
- The exact point keys are `date`, `token_count`, and `tokens_label`. Dates must be consecutive, counts must be nonnegative and nondecreasing, and the latest point must match the public rounded repo total. Differences between adjacent rounded points are rounded increases, not exact daily usage.
- Fail closed if the repo-token source is missing or malformed. Never include session, turn, model, path, raw-event, source, or cost fields in that series. The estimate may revise when retained evidence changes, so expose its cutoff, freshness, method, and estimate confidence.
- Build the combined-lifetime history only from verified, identity-free aggregate observations. Use daily-last grain, nondecreasing rounded counts, later nondecreasing same-day replacement, and a final point equal to the latest published total. Dates before the first verified combined observation are unobserved, not zero.
- Publish only `date`, rounded `token_count`, `tokens_label`, and `observation` for each lifetime point. Never publish account or source identities, per-source readings or histories, credentials, plans, quotas, reset timestamps, repository details, or exact work patterns.
- Keep the lifetime series on GitHub's date domain with its own linear y-axis. Leave the line blank before coverage begins and dash segments across multi-day observation gaps. Never add it to the repo-scoped retained-session estimate or sum it across a selected range.
- Do not combine the signals into one score or animate a static observation as live activity.

## Suggested structure

1. Cadence: weekly commits, explicitly labeled as cadence rather than productivity.
2. Magnitude and direction: additions and deletions around the same selected week.
3. Readable and literal: explain any log or symmetric-log transform while preserving exact values.
4. Observed lifetime growth: add a third GitHub-axis plot with its own linear scale, explicit unobserved prehistory, and the latest total.
5. Change the evidence source: reset before showing the rounded daily cumulative repo estimate and its rounded adjacent-point increases as a separate workload trace, not a quality score.
6. Explorer: range, scale, keyboard inspection, endpoint-change readout, and the exact GitHub table.

## Interaction contract

- Use normal scroll and a bounded SVG story; do not hijack wheel or touch input.
- One selected period synchronizes all three GitHub-axis plots, the readout, annotation, and table row. Report the latest verified lifetime observation at or before that period—or `unobserved`—and an observed endpoint change for ranges, never a sum.
- Provide focusable marks or an equivalent slider with arrow, Home, and End keys.
- Keep a server-rendered daily token summary and table outside any `aria-hidden` chart so the rounded endpoint and source points remain available without JavaScript.
- Reduced motion switches chapters immediately to complete still states.
- Pause work when the story is offscreen or the tab is hidden.

## Acceptance checks

- Verify desktop, laptop, tablet, and narrow mobile.
- Verify keyboard inspection, visible focus, the exact GitHub table, the rounded daily token table, and horizontal-table guidance.
- Verify no productivity, cost, plan-price, or causal language slips into the interface.
- Verify repo-token dates are consecutive, counts are safe nonnegative integers and nondecreasing, point keys are exact, and the latest label equals the public repo total.
- Verify a missing, malformed, or privacy-unsafe token source leaves the GitHub explorer and server-rendered token evidence intact while withholding the enhanced token chart.
- Verify automated and user-reported provenance states both remain truthful; a missing observation must never render as a false zero.
- Verify the lifetime history stays rounded, anonymous, nondecreasing, shared-x, and separate from the repo estimate.
- Verify year grids and left/right x coordinates match across all three GitHub-axis plots, including range and keyboard selection states.
- Verify loading failure leaves a readable explanation and server-rendered context.

## Copy-ready coding-agent prompt

> Build an evidence-first activity story for my site using only dated aggregates. Put weekly GitHub commits, line changes, and anonymous observed combined-lifetime tokens on one shared five-year x-axis, with a separate y-axis for each panel. Begin the lifetime line at the first verified combined observation, leave earlier dates unobserved, and dash multi-day gaps. Publish only rounded daily-last combined points with date, count, label, and automated or user-reported provenance—never source identities, per-source readings or histories, credentials, plans, quotas, session, turn, model, path, raw-event, or cost fields. Show the selected period's latest observation and endpoint change, never a cumulative sum. Keep the separate daily cumulative repo-token estimate on its own clock; derive it only from deduplicated repo-attributed retained logs, use consecutive Pacific dates with quiet-day fill and rounded nondecreasing points, and expose a server-rendered daily table. Fail closed on missing or malformed data. Use normal scrolling, one bounded transition, keyboard inspection, an exact GitHub table, a reduced-motion still state, and clear source/freshness labels. Do not claim productivity, quality, or cause. Match my site's typography, color roles, and responsive system. Test desktop, laptop, tablet, narrow mobile, keyboard, reduced motion, and invalid-data fallback states.

## Credit

Narrative pacing inspired by [The Rhythm of Food](https://rhythm-of-food.net/) by Google News Lab and Truth & Beauty, introduced to Sirui by [John Thompson](https://jrthomp.com/). No source assets, layout, or code are included here.
