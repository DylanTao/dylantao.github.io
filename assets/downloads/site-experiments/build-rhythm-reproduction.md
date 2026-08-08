# Build Rhythm Reproduction Brief

Use this brief to create a site-native activity story from your own aggregate data. Adapt the reasoning, not Sirui Tao's data, layout, palette, or code.

## Visitor problem

Help a reader understand code cadence, change, completed personal agent usage, and a separate repo-scoped token rhythm without implying that any of them measures productivity, quality, or cause.

## Data boundary

- Publish dated aggregates only. Never ship repository names, commit messages, credentials, source identities, plans, reset times, or source-level usage.
- Keep GitHub commits, additions, and deletions on one daily UTC calendar.
- Build a repo-token rhythm only from a separate public evidence source: deduplicated retained logs attributed to that repo. Declare one reporting timezone, group by day, fill quiet dates, and publish cumulative rounded values rather than session or event records.
- The exact point keys are `date`, `token_count`, and `tokens_label`. Dates must be consecutive, counts must be nonnegative and nondecreasing, and the latest point must match the public rounded repo total. Differences between adjacent rounded points are rounded increases, not exact daily usage.
- Fail closed if the repo-token source is missing or malformed. Never include session, turn, model, path, raw-event, source, or cost fields in that series. The estimate may revise when retained evidence changes, so expose its cutoff, freshness, method, and estimate confidence.
- Admit code history only from an exact schema-4 source with UTC timezone, complete coverage, one row for every date from the pinned lifetime start through the latest completed day, and per-source entries carrying only `commits`, `authored_commits`, `additions`, and `deletions`. `commits` matches the GitHub contribution graph; `authored_commits` is the non-merge, non-deploy subset that owns the line counts.
- Publish the combined personal agent series only from sanitized completed-day totals whose source count, label, method, and confidence form an approved provenance tuple. A family breakdown may contain only fixed `codex` and `claude` buckets whose priors and daily values conserve the combined series. Never publish account identities, per-account readings or histories, credentials, plans, quotas, reset timestamps, repository details, or event-level patterns.
- Keep the personal agent series on the code-history date domain with its own linear y-axis. Render validated families as stacked cumulative areas with exact text labels, leave the plot blank before Codex daily coverage begins, and keep Claude at zero until its first retained event. Never add it to the repo-scoped retained-session estimate or sum it across a selected range.
- Do not combine the signals into one score or animate a static observation as live activity.

## Suggested structure

1. Cadence: daily commits, explicitly labeled as cadence rather than productivity.
2. Magnitude and direction: additions and deletions around the same selected day.
3. Readable and literal: explain any log or symmetric-log transform while preserving exact values.
4. Personal agent days: add a third plot only when sanitized completed-day coverage validates, with its own linear scale, stacked Codex/Claude family areas when available, and explicit unobserved prehistory.
5. Change the evidence source: reset before showing the rounded daily cumulative repo estimate and its rounded adjacent-point increases as a separate workload trace, not a quality score.
6. Explorer: range, scale, keyboard inspection, endpoint-change readout, and the exact GitHub table.

## Interaction contract

- Use normal scroll and a bounded SVG story; do not hijack wheel or touch input.
- One selected period synchronizes all available plots, the readout, annotation, and table row. Report personal agent coverage as completed-day usage—or `unobserved`—and an endpoint change for ranges, never a sum.
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
- Verify code history appears only after the complete schema-4 UTC contract passes; otherwise show one compact `Code history is being rebuilt.` state.
- Verify the personal agent series contains sanitized completed-day totals, shares the date axis, and stays separate from the repo estimate.
- Verify year grids and left/right x coordinates match across all three GitHub-axis plots, including range and keyboard selection states.
- Verify loading failure leaves a readable explanation and server-rendered context.

## Copy-ready coding-agent prompt

> Build an evidence-first activity story for my site using dated personal aggregates. Accept code history only from an exact schema-4 source with complete UTC coverage and one row per named source for every date in the pinned lifetime window through the latest completed day. Report both the contribution-graph commit total and the authored subset that owns the line counts, and let a reader switch between them. If it is missing or malformed, show one compact `Code history is being rebuilt.` state and preserve the last valid snapshot. Add sanitized combined personal agent completed-day totals only when their coverage and provenance tuple validate; when fixed Codex/Claude families are present, require exact conservation and draw stacked cumulative areas with visible labels. Keep the separate daily cumulative repo-token estimate on its own clock. Never publish identities, per-account readings, credentials, sessions, turns, models, paths, raw events, or cost fields. Use normal scrolling, one bounded transition, keyboard inspection, an exact-date inspector and table, a reduced-motion still state, and clear source/freshness labels. Do not claim productivity, quality, or cause. Match my site's typography, color roles, and responsive system. Test desktop, laptop, tablet, narrow mobile, keyboard, reduced motion, and invalid-data fallback states.

## Credit

Narrative pacing inspired by [The Rhythm of Food](https://rhythm-of-food.net/) by Google News Lab and Truth & Beauty, introduced to Sirui by [John Thompson](https://jrthomp.com/). No source assets, layout, or code are included here.
