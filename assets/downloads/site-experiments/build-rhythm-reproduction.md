# Build Rhythm Reproduction Brief

Use this brief to create a site-native activity story from your own aggregate data. Adapt the reasoning, not Sirui Tao's data, layout, palette, or code.

## Visitor problem

Help a reader understand a rounded lifetime snapshot, weekly code change, and daily retained-token work without repeating the same figure or implying that any signal measures productivity, quality, or cause.

## Data boundary

- Publish dated aggregates only. Never ship repository names, commit messages, credentials, source identities, plans, reset times, machine paths, sessions, turns, models, or raw events.
- Keep GitHub commits, additions, and deletions on one weekly calendar.
- Build the website series only from deduplicated retained logs attributed to that repository. Build the all-work series from the independently deduplicated all-retained dataset. Declare one reporting timezone, group by day, fill quiet dates, and publish cumulative rounded values rather than event records.
- Give the two retained-token sources separate strict endpoints. Their exact top-level keys are `schema`, `label`, `units`, `grain`, `aggregation`, `method`, `since`, `updated_at`, `confidence`, `privacy_note`, and `points`. Each point contains only `date`, `token_count`, and `tokens_label`.
- Dates must be consecutive, counts must be safe nonnegative integers and nondecreasing, and each latest point must match its scope's public rounded endpoint. Derive daily deltas in the view; differences between adjacent rounded points are rounded estimates, not exact daily usage. Each series' first cumulative point is only a baseline with no daily delta, so never subtract it from zero or plot it as one day's work.
- Fail closed if either token source is missing, malformed, nonmonotonic, or privacy-unsafe. Never substitute one scope for the other.
- Keep the rounded lifetime total on its own observation date and direct schema. Never add it to a retained-session estimate.
- A `hypothetical_mix_matched_api_rate_replay` may appear only beside the lifetime total, never inside the direct schema. Scale from the retained sample's priced dollars per priced token, never from its larger raw total. Name the assumption that lifetime use matched the sample's model, cache, request-length, and input/output mix; link the rate source and date; disclose excluded unsupported-model and cache-write tokens; and say it is not an actual bill.

## Suggested structure

1. Scope guide: explain the lifetime, weekly GitHub, and daily retained-token clocks in three concise cards.
2. Lifetime snapshot: one rounded endpoint, observation date, and optional source-pinned mix-matched price replay.
3. GitHub explorer: commits for cadence; additions and deletions for magnitude and direction.
4. Daily token rhythm: one dual-series figure of all retained Codex work and the website; keep cumulative totals as text summaries.
5. Evidence disclosures: native details for the daily values and weekly GitHub table.

## Transform and interaction contract

- Prefix every chart heading or badge with `Y-AXIS:` in wide and compact states. Name units and transform literally: `LOG1P`, `SYMLOG`, or `LINEAR`.
- GitHub Readable uses log1p for nonnegative commits and symmetric log for signed line changes. Literal uses linear axes. Both modes plot the same reported values.
- The daily comparison uses log1p because release bursts would otherwise flatten ordinary days. Axis tick labels remain in original token units.
- Hover previews a day. Click or tap pins it. A focusable SVG inspector supports Left, Right, Home, End, and Escape, with a visible focus ring.
- Keep one selected date synchronized across the guide, markers, and visible readout. Ordinary hover may update visible copy, but only pinning and keyboard changes should enter an ARIA live region.
- Preserve vertical touch scrolling. Redraw from measured bounds after resize or theme changes. Reduced motion should remain completely static.
- Keep the exact rows in a collapsed native disclosure that remains usable without JavaScript. Do not force every visitor through a long table.

## Acceptance checks

- Verify 1440×1000, 1280×800, 768×1024, and 390×1000 in light and dark themes.
- Verify both strict JSON endpoints, exact keys, consecutive dates, monotonic counts, current endpoint equality, and absence of identity or event fields.
- Verify two nonzero daily paths, original-unit tick labels, an explicit `Y-AXIS:` transform label at every width, and no cumulative chart duplicating the endpoint summaries.
- Verify mouse preview, click/tap pinning, Left/Right/Home/End/Escape, visible focus, responsive redraw, reduced motion, 200% zoom, and no horizontal page overflow.
- Verify the daily table starts collapsed yet remains available with JavaScript disabled.
- Verify malformed or missing daily data leaves the lifetime snapshot, GitHub explorer, endpoint summaries, and native disclosures readable while withholding the enhanced comparison.
- Verify the lifetime checkpoint stays rounded and independent. Its hypothetical replay must not appear in schema 3 or masquerade as a bill.

## Copy-ready coding-agent prompt

> Build an evidence-first activity story from dated aggregates. Start with a concise three-scope guide, then show one rounded lifetime snapshot, a weekly GitHub explorer, and one dual-series daily-delta chart comparing all retained Codex work with this website. Generate the two token sources independently as strict cumulative daily endpoints whose points contain only date, token_count, and tokens_label; derive adjacent rounded deltas in the view. Prefix every chart heading with Y-AXIS: and preserve LOG1P, SYMLOG, or LINEAR in compact states. Make the daily SVG inspector support hover preview, tap/click pinning, visible focus, Left/Right/Home/End/Escape, and a quiet ARIA live path that announces only pinned or keyboard changes. Keep cumulative totals as text summaries and full daily rows inside a native collapsed disclosure. Keep the rounded lifetime total in its independent direct schema. If you add a hypothetical_mix_matched_api_rate_replay, scale from priced dollars per priced token, name the retained-mix assumption, link the Standard public API rate and date, disclose excluded unsupported-model and unavailable cache-write tokens, and say it is not an actual bill. Fail closed on malformed or privacy-unsafe data. Do not claim productivity, quality, or cause.

## Credit

Narrative pacing inspired by [The Rhythm of Food](https://rhythm-of-food.net/) by Google News Lab and Truth & Beauty, introduced to Sirui by [John Thompson](https://jrthomp.com/). No source assets, layout, or code are included here.
