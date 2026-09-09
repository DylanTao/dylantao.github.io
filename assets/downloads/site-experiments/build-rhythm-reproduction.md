# Build Rhythm Reproduction Brief

Use this brief to create a site-native activity story from your own aggregate data. Adapt the reasoning, not Sirui Tao's data, layout, palette, or code.

## Visitor problem

Help a reader understand code cadence and change without implying that either one measures productivity, quality, or cause.

## Data boundary

- Publish dated aggregates only. Never ship repository names, commit messages, credentials, source identities, or event-level records.
- Keep each code source on its declared calendar. Align matching `YYYY-MM-DD` labels for display without claiming that they describe one shared 24-hour window.
- Admit code history only from an exact schema-5 source-calendar contract with complete union-label coverage and one row for every calendar label from the pinned lifetime start through the latest reported label. Require each source to declare its date basis and completion timezone: `Personal` uses GitHub profile author-date labels completed in `America/Los_Angeles`, while contributed feeds use UTC calendar labels. Include a named source key only inside that source's declared coverage; absence before a later start is not zero. Per-source entries carry only `commits`, `authored_commits`, `additions`, and `deletions`. `commits` is the source's reported total; for the `Personal` source, its approved basis matches the GitHub contribution graph. `authored_commits` is the non-merge, non-deploy subset that owns first-parent raw-text line counts. Documentation and data text count, intrinsic binary changes count as zero, and repository attributes are neutralized.
- Keep one clock. Token, cost, or agent-usage series belong on their own page with their own evidence, or nowhere; do not draw them beside the code history, and do not combine unlike signals into one score.
- Do not animate a static observation as live activity.

## Suggested structure

1. Cadence: compare daily commits by drawing the reported total across visible sources as a quiet outer boundary and soft band down to a crisp summed authored line. For `Personal` alone, that total matches the GitHub contribution graph; a combined total makes no such claim. Their gap makes merges and deploys visible without hiding either count behind a mode switch; use stacked source areas and a filter to preserve source detail, and label the figure as cadence rather than productivity.
2. Magnitude and direction: additions and deletions around the same selected source-calendar label.
3. Readable and literal: explain any log or symmetric-log transform while preserving the reported values.
4. Explorer: range, scale, keyboard inspection, endpoint-change readout, and the reported-value table.

## Interaction contract

- Use normal scroll and a bounded SVG story; do not hijack wheel or touch input.
- One selected code-label period synchronizes the commit and line-change plots, annotation, and reported-value table.
- Provide focusable marks or an equivalent slider with arrow, Home, and End keys.
- Reduced motion switches chapters immediately to complete still states.
- Pause work when the story is offscreen or the tab is hidden.

## Acceptance checks

- Verify desktop, laptop, tablet, and narrow mobile.
- Verify keyboard inspection, visible focus, the reported code-activity table, and horizontal-table guidance.
- Verify no productivity, cost, billing, or causal language slips into the interface.
- Verify code history appears only after the complete schema-5 source-calendar contract passes; otherwise show one compact `Code history is being rebuilt.` state.
- Verify the total boundary, gap band, and authored line remain distinguishable in both themes and at every target width; thin lifetime year labels before they collide and keep a shorter recent window available for daily detail.
- Defer construction of the lifetime exact-value table until its disclosure opens, then verify all selected-window rows and columns remain available to keyboard and screen-reader users.
- Verify year grids and left/right x coordinates match across the commit and line-change plots, including range and keyboard selection states.
- Verify loading failure leaves a readable explanation and server-rendered context.

## Copy-ready coding-agent prompt

> Build an evidence-first activity story for my site using dated code aggregates. Accept code history only from an exact schema-5 source-calendar contract with complete union-label coverage and one row for every calendar label in the pinned lifetime window through the latest reported label. Require every source to declare its date basis and completion timezone: use GitHub profile author-date labels completed in `America/Los_Angeles` for `Personal`, UTC calendar labels for contributed feeds, and never describe matching labels as one shared 24-hour window. Include each approved named source only on labels inside its own coverage, leaving earlier labels absent rather than zero. Compare the reported total and authored subset across visible sources in one figure: draw the total as a quiet outer boundary with a soft band down to a crisp summed authored line, so their gap shows merges and deploys without a mode switch; use stacked source areas and a filter to preserve source detail. State that only `Personal` uses the approved GitHub contribution-parity basis; do not describe another source or their combined total as the contribution graph. Count authored first-parent raw-text changes, with intrinsic binaries at zero and repository attributes neutralized. If the source is missing or malformed, show one compact `Code history is being rebuilt.` state and preserve the last valid snapshot. Keep one clock: no token, cost, or agent-usage series beside the code history. Never publish identities, credentials, sessions, paths, or raw events. Use normal scrolling, one bounded transition, keyboard inspection, a reported-date-label inspector and table, a reduced-motion still state, and clear source/freshness labels. Do not claim productivity, quality, or cause. Match my site's typography, color roles, and responsive system. Test desktop, laptop, tablet, narrow mobile, keyboard, reduced motion, and invalid-data fallback states.

## Credit

Narrative pacing inspired by [The Rhythm of Food](https://rhythm-of-food.net/) by Google News Lab and Truth & Beauty, introduced to Sirui by [John Thompson](https://jrthomp.com/). No source assets, layout, or code are included here.
