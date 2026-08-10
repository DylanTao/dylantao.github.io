# Build Rhythm Reproduction Brief

Use this brief to create a site-native activity story from your own aggregate data. Adapt the reasoning, not Sirui Tao's data, layout, palette, or code.

## Visitor problem

Help a reader understand code cadence, change, completed personal agent usage, and a separate repo-scoped token rhythm without implying that any of them measures productivity, quality, or cause.

## Data boundary

- Publish dated aggregates only. Never ship repository names, commit messages, credentials, source identities, plans, reset times, or source-level usage.
- Keep each code source on its declared calendar. Align matching `YYYY-MM-DD` labels for display without claiming that they describe one shared 24-hour window.
- Build a repo-token rhythm only from a separate public evidence source: deduplicated retained logs attributed to that repo. Declare one reporting timezone, group by day, fill quiet dates, and publish cumulative rounded values rather than session or event records.
- The exact point keys are `date`, `token_count`, and `tokens_label`. Dates must be consecutive, counts must be nonnegative and nondecreasing, and the latest point must match the public rounded repo total. Differences between adjacent rounded points are rounded increases, not exact daily usage.
- Fail closed if the repo-token source is missing or malformed. Never include session, turn, model, path, raw-event, source, billing, or account-level cost fields in that series. The estimate may revise when retained evidence changes, so expose its cutoff, freshness, method, and estimate confidence. If a separate aggregate API-rate replay is shown, label it as an estimate and explicitly say it is not a bill.
- Admit code history only from an exact schema-5 source-calendar contract with complete union-label coverage and one row for every calendar label from the pinned lifetime start through the latest reported label. Require each source to declare its date basis and completion timezone: `Personal` uses GitHub profile author-date labels completed in `America/Los_Angeles`, while contributed feeds use UTC calendar labels. Include a named source key only inside that source's declared coverage; absence before a later start is not zero. Per-source entries carry only `commits`, `authored_commits`, `additions`, and `deletions`. `commits` is the source's reported total; for the `Personal` source, its approved basis matches the GitHub contribution graph. `authored_commits` is the non-merge, non-deploy subset that owns first-parent raw-text line counts. Documentation and data text count, intrinsic binary changes count as zero, and repository attributes are neutralized.
- Publish the combined personal agent series only from sanitized completed-day totals whose source count, label, method, and confidence form an approved provenance tuple. A family breakdown may contain only fixed `codex` and `claude` buckets whose priors and daily values conserve the combined series. Never publish account identities, per-account readings or histories, credentials, plans, quotas, reset timestamps, repository details, or event-level patterns.
- Give the personal agent series its own observed date domain and linear y-axis in an independently dated inset. Render validated families as stacked cumulative areas with exact text labels, begin the inset at the first completed Codex day, and keep Claude at zero until its first retained event. Never stretch that shorter record across the code-history domain. Never add it to the repo-scoped retained-session estimate or sum it across a selected range.
- Do not combine the signals into one score or animate a static observation as live activity.

## Suggested structure

1. Cadence: compare daily commits by drawing the reported total across visible sources as a quiet outer boundary and soft band down to a crisp summed authored line. For `Personal` alone, that total matches the GitHub contribution graph; a combined total makes no such claim. Their gap makes merges and deploys visible without hiding either count behind a mode switch; use stacked source areas and a filter to preserve source detail, and label the figure as cadence rather than productivity.
2. Magnitude and direction: additions and deletions around the same selected source-calendar label.
3. Readable and literal: explain any log or symmetric-log transform while preserving the reported values.
4. Personal agent days: add a third plot only when sanitized completed-day coverage validates, with its own linear scale, stacked Codex/Claude family areas when available, and explicit unobserved prehistory.
5. Change the evidence source: reset before showing the rounded daily cumulative repo estimate and its rounded adjacent-point increases as a separate workload trace, not a quality score.
6. Explorer: range, scale, keyboard inspection, endpoint-change readout, and the reported-value table.

## Interaction contract

- Use normal scroll and a bounded SVG story; do not hijack wheel or touch input.
- One selected code-label period synchronizes the commit and line-change plots, annotation, and reported-value table. A matching label may map the inspector into the independent UTC-labeled agent inset when that label has completed personal-agent coverage; this is label alignment, not a shared timezone. Otherwise report it as `unobserved`. Keep the inset on its complete observed span and report endpoint change for ranges, never a token sum.
- Provide focusable marks or an equivalent slider with arrow, Home, and End keys.
- Keep a server-rendered daily token summary and table outside any `aria-hidden` chart so the rounded endpoint and source points remain available without JavaScript.
- Reduced motion switches chapters immediately to complete still states.
- Pause work when the story is offscreen or the tab is hidden.

## Acceptance checks

- Verify desktop, laptop, tablet, and narrow mobile.
- Verify keyboard inspection, visible focus, the reported code-activity table, the rounded daily token table, and horizontal-table guidance.
- Verify no productivity, uncaveated cost, billing, plan-price, or causal language slips into the interface.
- Verify repo-token dates are consecutive, counts are safe nonnegative integers and nondecreasing, point keys are exact, and the latest label equals the public repo total.
- Verify a missing, malformed, or privacy-unsafe token source leaves the code-activity explorer and server-rendered token evidence intact while withholding the enhanced token chart.
- Verify automated and user-reported provenance states both remain truthful; a missing observation must never render as a false zero.
- Verify code history appears only after the complete schema-5 source-calendar contract passes; otherwise show one compact `Code history is being rebuilt.` state.
- Verify the total boundary, gap band, and authored line remain distinguishable in both themes and at every target width; thin lifetime year labels before they collide and keep a shorter recent window available for daily detail.
- Defer construction of the lifetime exact-value table until its disclosure opens, then verify all selected-window rows and columns remain available to keyboard and screen-reader users.
- Verify the personal agent series contains sanitized completed-day totals, uses an explicit independent date domain, and stays separate from the repo estimate.
- Verify year grids and left/right x coordinates match across the commit and line-change plots, including range and keyboard selection states; separately verify the agent inset spans its own observed start and end and maps its inspector marker to that domain.
- Verify loading failure leaves a readable explanation and server-rendered context.

## Copy-ready coding-agent prompt

> Build an evidence-first activity story for my site using dated code aggregates. Accept code history only from an exact schema-5 source-calendar contract with complete union-label coverage and one row for every calendar label in the pinned lifetime window through the latest reported label. Require every source to declare its date basis and completion timezone: use GitHub profile author-date labels completed in `America/Los_Angeles` for `Personal`, UTC calendar labels for contributed feeds, and never describe matching labels as one shared 24-hour window. Include each approved named source only on labels inside its own coverage, leaving earlier labels absent rather than zero. Compare the reported total and authored subset across visible sources in one figure: draw the total as a quiet outer boundary with a soft band down to a crisp summed authored line, so their gap shows merges and deploys without a mode switch; use stacked source areas and a filter to preserve source detail. State that only `Personal` uses the approved GitHub contribution-parity basis; do not describe another source or their combined total as the contribution graph. Count authored first-parent raw-text changes, with intrinsic binaries at zero and repository attributes neutralized. If the source is missing or malformed, show one compact `Code history is being rebuilt.` state and preserve the last valid snapshot. Add sanitized combined personal agent completed-day totals only when their coverage and provenance tuple validate; label its matched inspector values as UTC date labels, require exact family conservation, and draw stacked cumulative areas with visible labels inside an independently dated inset spanning only observed days. Keep the separate daily cumulative repo-token estimate on its own clock. Never publish identities, per-account readings, credentials, sessions, turns, models, paths, or raw events; keep any aggregate API-rate replay separate, caveated, and explicitly not a bill. Use normal scrolling, one bounded transition, keyboard inspection, a reported-date-label inspector and table, a reduced-motion still state, and clear source/freshness labels. Do not claim productivity, quality, or cause. Match my site's typography, color roles, and responsive system. Test desktop, laptop, tablet, narrow mobile, keyboard, reduced motion, and invalid-data fallback states.

## Credit

Narrative pacing inspired by [The Rhythm of Food](https://rhythm-of-food.net/) by Google News Lab and Truth & Beauty, introduced to Sirui by [John Thompson](https://jrthomp.com/). No source assets, layout, or code are included here.
