# Intern Activity Sync

How internship coding activity reaches the public Build Rhythm figure as the `intern` source, and the rules that keep it publishable.

`_data/code_activity_sources/README.md` is the contract of record for the feed's field shape. This document covers the surrounding procedure: where the numbers come from, how they are mapped, what to run, and what must never cross over.

## Where The Numbers Come From

A work-managed machine runs its own aggregate collector over work project repositories. It counts default-branch, non-merge commits with exact author attribution on UTC committed dates, and keeps a certified daily history whose start is fixed. That collector publishes an identity-free daily aggregate — dates and counts only — into a dedicated single-purpose private bridge repository over an SSH key held in the OS credential store.

Neither the collector's configuration nor its bridge destination belongs in this repository. This public repo receives only the finished `intern` feed. It never holds the work aggregate, the bridge remote, the credential target, or the transport history.

The work-side aggregate carries `date`, `commits`, `additions`, and `deletions` per completed UTC day. The `intern` feed adds `authored_commits`, so the mapping below is the step that turns one into the other.

## Mapping To The Feed

Write `_data/code_activity_sources/intern.json` exactly as the sources README specifies, with these decisions:

- **`commits` equals `authored_commits`.** The work-side collector counts non-merge commits only, so its per-day number _is_ the authored subset. Reporting the same value for both keeps `commits` an honest floor instead of inventing a merge and deploy gap that was never measured. The figure's `gap = merges + deploys` readout therefore sits at zero for this source by construction — not because no merge ever happened. Giving this source a real gap would require the work-side collector to count merges per day first; it currently does not.
- **Coverage starts at the internship start date, not at the collector's certified history start.** The collector's history reaches years further back, but the intern source did not exist then. Publishing those days as zero would assert observed inactivity where there was no observation at all. Dates outside this feed's coverage stay absent, exactly as the sources README requires.
- **Completed UTC days only.** The importer rejects any point dated today or later in UTC, so the feed must end at yesterday UTC or earlier. This is a moving boundary: a feed that validated yesterday still validates today, but one built from a partial day never validates.
- **Lines require an authored commit.** A day with zero authored commits must report zero additions and zero deletions. The work-side data satisfies this naturally, since a day with no commits has no line changes.

## Publishing

Drop the feed in and validate before writing anything public:

```bash
python bin/import_code_activity.py --personal-repo ../DylanTao --repo-root . --check
```

`--check` validates the next snapshot without writing `_data/code_activity.json`. Drop `--check` to publish once it passes. The importer allowlists this source's id, label, and basis in `APPROVED_SOURCE_CONTRACTS` and revalidates every field on ingest, so a malformed feed fails closed and preserves the prior public snapshot rather than publishing a partial series.

Two operational notes:

- The importer needs the personal metrics checkout at `--personal-repo`, because it reads `docs/github-activity.json` from there to build the `personal` source. There is no way to publish the `intern` source alone.
- `zoneinfo` needs a time zone database. On a bare Windows checkout `ZoneInfo("UTC")` raises `ZoneInfoNotFoundError` with no `tzdata` installed; use `bin/setup-python-deps`, or run the interpreter with `tzdata` available.

## Monotonic Rules

Once the `intern` source reaches the public snapshot, later refreshes may extend its coverage but may not drop the source, move its start later, or move its end earlier. Deleting `intern.json` does not retire the source — a missing or narrowed feed fails closed and keeps the prior snapshot. Retiring it requires a deliberate contract change in the importer.

This mirrors the fixed-start rule on the work side, so a truncated or re-scanned work history cannot quietly shorten published intern history.

## How It Renders

`intern` is the second code-activity source, and the figure distinguishes it with a stacked olive band, a surface-colored seam along its lower edge, per-source readout cells, and the Sources chips in the key strip above the chart. `sourceColor` in `assets/js/github-activity.js` gives the first source the primary accent and every later source `--github-activity-source-alt-color`, defined in `_sass/_github-activity.scss` as a terracotta mixed toward the current text color so it holds up in both the light and dark palettes. Legend swatches read from the same function, so the key and the series never disagree.

Personal history keeps the primary accent, which means a single-source page looks unchanged and adding the intern feed does not restyle existing history.

The two sources do not share a calendar. Personal rows carry GitHub profile author-date labels completed in `America/Los_Angeles`; intern rows are UTC calendar dates. The public snapshot aligns matching `YYYY-MM-DD` labels and its `date_basis` is `source_reported_calendar` — it deliberately does not claim one shared timezone or a common 24-hour interval. Do not describe the combined series as a single timezone.

## What Must Never Cross Over

The feed carries counts and dates only. No repository, employer, host, branch, commit identifier, commit message, path, account, or email field, and no exact timestamps. The validator accepts only the documented fields and rejects extras rather than ignoring them.

Transport commits in the private bridge are a delivery mechanism, not contributions. They must never be presented as native GitHub contribution activity, and no marker or backdated commits are created anywhere in this pipeline. GitHub Connect contribution sharing is the only mechanism that can populate a native contribution graph, and it carries commit counts only — never line counts — so it does not replace this feed.

Publishing internship aggregates is gated on employer approval being actually established, not assumed. Keep the feed out of the public snapshot until that is settled.
