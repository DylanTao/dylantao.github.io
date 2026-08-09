# Code activity — design intent, current state, and unfinished work

Handoff brief. Written for an agent picking this up cold. Everything below is
either verified or explicitly labelled as unverified. Delete this file once the
open items are closed.

Three repositories are involved:

| Repo                              | Role                                                              | Last commit from this work |
| --------------------------------- | ----------------------------------------------------------------- | -------------------------- |
| `DylanTao/dylantao.github.io`     | the site, `/github-activity/` page                                | `ec85559c4`                |
| `DylanTao/DylanTao`               | profile README, `github-metrics.svg`, `docs/github-activity.json` | `b2e60da`                  |
| `DylanTao/github-metrics-private` | the collector, the SVG renderer, the scheduler                    | `0d25524`                  |

---

## 1. The original problem

The published code history undercounted badly. The site reported **3,418
commits for 2026** against GitHub's **~4,338**, and 2017–2020 did not exist at
all. Three causes, all in the collector's scan contract:

1. **`gh-pages` was never scanned.** GitHub credits a commit on the default
   branch _or_ `gh-pages`. For `dylantao.github.io` alone this hid 539 of 1,118
   commits in 2026.
2. **Merge commits were dropped.** GitHub counts them.
3. **Only `affiliation=owner` repositories were enumerated** — 74 of 300.

Plus a fourth, separate defect: a **rolling five-year window** meant every
refresh silently deleted the earliest year. Published lifetime totals could
only ever shrink.

Verification that this was the real mechanism, not a guess: `origin/main` has
579 DylanTao-authored 2026 commits and `origin/gh-pages` has 539 — together
exactly the 1,118 GitHub reports for that repo.

---

## 2. Design intent (what the owner asked for)

These are the owner's stated intentions. Treat them as the specification.

### 2.1 Two commit numbers, not one

Chosen explicitly over the alternatives:

- **`commits`** — every commit GitHub credits. Default branch **plus**
  `gh-pages`, merges included. This exists so the page reconciles with the
  contribution graph.
- **`authored_commits`** — the non-merge, non-deploy subset. This is the **only**
  channel that carries `additions` / `deletions`, because a merge diff restates
  the branch it absorbs and a deploy restates the whole generated site.
  Counting their lines would report machine output as writing.

### 2.2 Lifetime, never a rolling window

Anchored at the account creation day (**2017-08-31**), verified against
`viewer.createdAt` on every run so a stale constant fails closed. The window
only grows forward.

### 2.3 Named sources, ready for a second feed

The owner will supply an **anonymized intern-work feed** (daily commits, lines
added, lines removed) when that internship ends. Adding it must be a _data
drop_, not a schema change.

Human-facing names were requested explicitly: **"Personal"** and **"Intern
work"** — not `personal_code_activity` style identifiers.

### 2.4 Accuracy over speed

Stated directly: _"we can be slower, i don't care about speed, as long as it is
accurately updated."_ Any optimization must be **verified**, not assumed. This
is why cache reuse is keyed on branch head OIDs rather than `pushed_at`
metadata.

### 2.5 Figures must stay elegant and readable

Quoting the owner: _"make sure they are still elegant, simple and readable, for
all these figures improvement. don't overwhelm user with too much details that
it distracts from the main point. also in website live version, we have also
have some toggle and control well designed to help see these nuance better,
with interactivity, or toggle, filter, hover, etc. color, legend, bottom."_

**This is the least-completed part of the work. See §5.**

---

## 3. What was built and verified

### 3.1 Collector (`github-metrics-private`)

`scripts/build_repository_inventory.py`:

- Pins the default branch **and** `gh-pages` per repository
  (`get_contribution_branch_oids`), scanning the default branch first so a
  commit on both keeps its authored classification.
- Enumerates `owner,collaborator,organization_member`. Forks stay excluded,
  matching GitHub.
- `record_commit()` is the single place channel policy lives.
- `daily_window()` returns the fixed lifetime window.
- Publishes **schema 4** with a `source` descriptor.
- **Incremental scanning:** every run re-pins branch head OIDs and reuses a
  cached per-repository scan only when those OIDs match. Head OIDs are a
  cryptographic summary of reachability, so this is verified reuse. It
  correctly handles the case a date-based cache gets wrong — merging an old
  branch makes long-past commits newly reachable and necessarily moves the head.
  Cache is `.personal-scan-cache.json`, gitignored, and degrades to a full scan
  on anything it cannot vouch for.
- **Deduplication is per repository**, matching how
  `commitContributionsByRepository` accounts for commits. This was verified, not
  assumed — see §3.4.

### 3.2 Site (`dylantao.github.io`)

- `bin/import_code_activity.py` — replaces `bin/import_personal_code_activity.py`.
  Validates the profile snapshot plus any contributed sources, merges them into
  `_data/code_activity.json`.
- `_pages/github-activity.md` — `Lifetime` default range, a
  `Commits counted: All / Authored` toggle, a source legend, an `Authored`
  table column.
- `assets/js/github-activity.js` — source-aware row model, stacked commit
  bands, legend that doubles as a source filter.

### 3.3 Profile (`DylanTao/DylanTao`)

- `docs/github-activity.json` — schema 4, `2017-08-31 → 2026-08-07`.
- `assets/github-metrics.svg` — now reads `LIFETIME · WEEKLY`, and the footer
  dates the code history and the token trace **separately** so each is read at
  its own age.

### 3.4 The reconciliation that gates correctness

Per-repository comparison against GitHub's own
`contributionsCollection.commitContributionsByRepository`:

```
2024  DylanTao/dylantao.github.io       github 113   scan 113   MATCH
2025  DylanTao/dylantao.github.io       github 185   scan 185   MATCH
2026  DylanTao/dylantao.github.io       github 1118  scan 1118  MATCH
2023  Tianyue-Zhao/CSE291_RL_Project    github  31   scan  31   MATCH
...
verifiable totals: github=1613  scan=1604   (22 of 22 repos match exactly)
```

**Re-run this after any change to scan semantics.** It is the acceptance test.

Published result:

```
year  commits  authored        year  commits  authored
2018       17        16        2023       82        78
2020        7         7        2024      603       503
2021      111       111        2025      344       221
2022      156       153        2026     4268      3689
```

---

## 4. Known limitations (accepted, not bugs)

- **9 commits (0.6%) unreachable.** Six repos: three upstream repos
  (`alshedivat/al-folio`, `BachiLi/loma_public`,
  `SimplifyJobs/New-Grad-Positions`) that `/user/repos` does not return under
  any affiliation, and three single web-UI commits in org `.github` repos the
  GraphQL author filter does not match.
- **Private repositories are unverifiable.** GitHub exposes only
  `restrictedContributionsCount`, which counts contributions of _all_ kinds
  (issues, PRs, reviews), not just commits. Do **not** compare it to a commit
  count — an earlier analysis in this project did exactly that and produced a
  false "overcount" alarm.
- **One pathological repository.** `semantic-scaffolding-map` — GitHub cannot
  serve the diff-bearing history query at any window size, so it falls back to
  one REST call per commit, roughly 20–25 minutes. The cache means this is paid
  once per head change.
- **Token trace lags.** It is built from retained **Codex** session logs. Work
  done through other agents produces no Codex events, so the trace freezes. It
  is now dated on the badge rather than hidden.

---

## 5. Unfinished work — start here

Ordered by importance. Items 1 and 2 are known-failing or known-unverified.

### 5.1 Visual regression — root cause found and fixed, needs re-run

The first push left `Visual checkpoints` failing on `main`: **23 failed, 142
passed**. It was _not_ stale baselines. Every failure was one assertion:

```
test/visual/build-rhythm-story.spec.js:146
  expect(original).toMatch(dataPattern)
```

The Playwright spec injects a fixture into the page's data node, and it still
referenced `#personal-code-activity-data` with a schema-3 body. The Python
contract test was updated during the rename; this spec was missed.

Fixed: the fixture is now schema 4, keyed by named source, carrying both commit
channels, and spanning the lifetime window. **This has not yet been run green in
CI** — the local run cannot verify it because the Playwright webServer times out
after 600s on this machine (ImageMagick fails per image with `Invalid Parameter

- /dev`, making the Jekyll build too slow). Re-run in CI, or on a machine with a
  working ImageMagick, and confirm before trusting it.

If genuine snapshot diffs remain after that, read the diff images before
regenerating: `npm.cmd run test:visual:update`.

### 5.2 The figures were never visually reviewed

This is the biggest gap against §2.5. Everything about the chart was verified by
grepping rendered HTML for markers — **no screenshots were ever taken, and no
human or agent has actually looked at the result.**

`AGENTS.md` requires, for sitewide rendered UI:

> Before/after screenshots at 1440x1000, 1280x800, 768x1024, and 390x1000;
> check light/dark when relevant, keyboard focus, reduced motion, overflow, and
> console errors.

None of that was done. Required reading before touching this:
`.codex/skills/website-design-critique/SKILL.md` and
`WEBSITE_DESIGN_HEURISTICS.md`.

Specific things to scrutinize:

- **The chart now spans 9 years instead of 5.** Density, axis labels, and year
  gridlines were never checked at that width. The dense 2026 region may now be
  compressed to illegibility on narrow screens.
- **The profile SVG renders 467 weekly buckets, up from 300.** Same concern, on
  a fixed-width canvas that cannot scroll. Look at it.
- **The `Commits counted` toggle is a mode switch, not a comparison.** The owner
  asked to "see these nuance better." Right now you see total _or_ authored,
  never both. Consider drawing the total as a band with authored as a line
  inside it, so the merge/deploy portion reads as the gap between them — one
  figure, both numbers, no extra clicking. This is probably the single highest-
  value design improvement available.
- **The source legend is hidden while only one source exists**, which is correct
  for clutter but means the owner currently sees almost none of the requested
  interactivity. Re-evaluate once the intern feed lands.
- **Hover, color, and filtering got minimal attention.** The owner named these
  explicitly. The day readout still shows plain text; there is no tooltip design
  work, and no color encoding distinguishes authored from total.

### 5.3 Line counts were never independently reconciled

The owner explicitly asked: _"maybe also check if your number of lines added and
removed are also off."_

The _mechanism_ was fixed and reasoned about — lines follow authored commits
only, first-parent diffs, no double counting. But unlike commits, the line
totals were **never verified against an independent source**. GitHub exposes no
line-count API, so the check has to be local:

```bash
git log <branch> --no-merges --author=<...> --since=... --numstat --format=""
```

summed per day and compared to the published `additions` / `deletions` for one
or two repositories. An earlier attempt timed out and was never retried.

### 5.4 `_data/github_activity.json` is now inconsistent

The legacy schema-2 weekly file (300 weeks, `generatedAt` 2026-07-15) is still
committed and still asserted by `test_github_activity_privacy.py`. It predates
the lifetime model and now disagrees with it. Decide whether to retire it or
regenerate it on the lifetime contract.

### 5.5 The scan cache does not help CI

`.personal-scan-cache.json` is gitignored and machine-local, so the hosted
workflow still does a full scan every time. Consider committing it to the
private repo — it contains repository names, which that repo already holds, and
the public bundle checker guards the published output separately.

### 5.6 Document the intern-feed contract for the owner

The validator exists (`validate_contributed_snapshot`) but there is no
user-facing description of the file to produce. When the internship data
arrives, it must be dropped at
`_data/code_activity_sources/intern.json` in exactly this shape:

```json
{
  "schema": 1,
  "id": "intern",
  "label": "Intern work",
  "basis": "reported_daily_summary",
  "timezone": "UTC",
  "coverage": {
    "starts_on": "2026-06-15",
    "complete_through": "2026-09-01",
    "status": "complete"
  },
  "points": [
    {
      "date": "2026-06-15",
      "commits": 12,
      "authored_commits": 9,
      "additions": 1840,
      "deletions": 460
    }
  ]
}
```

Rules the validator enforces: dense daily coverage across its own window,
completed UTC days only, `authored_commits <= commits`, no lines without an
authored commit, and **no other fields** — a stray repository or employer name
is rejected rather than published. The source appears automatically as a second
stacked series labelled "Intern work"; days outside its coverage omit it rather
than showing zero.

### 5.7 Override audit never run

`AGENTS.md` asks for `bundle exec al-folio upgrade overrides audit` when
plugin-owned files are shadowed. `.al-folio-overrides.yml` contains no
`github-activity` entries so this is _probably_ unnecessary, but the audit was
not run.

---

## 6. Gotchas that cost real time here

- **The scheduler referenced the renamed importer.** `DylanMetricsRefresh.psm1`
  pointed at `bin/import_personal_code_activity.py`; the next unattended run
  would have failed on a missing file. Fixed — but check the scheduler whenever
  a path changes. There is a live Windows task, `Dylan Personal Metrics
Refresh`, plus a daily site workflow `update-code-activity.yml`.
- **The metrics bot races you.** During this work it pushed the _old_ schema-3
  five-year data to the profile repo. It was caught at merge time. Verify
  `schema == 4` and `starts_on == 2017-08-31` after any merge into that repo.
- **The renderer is fail-closed on three separate inputs.** A stale input keeps
  the last good SVG and exits 75. Check `stderr`, not just the exit code.
- **`gh api graphql` costs ~1–4s per page** because it spawns a subprocess. Page
  size is at the connection maximum (100). History pages retry rather than
  discarding a window, and the diff-bearing query has a short 25s deadline so a
  hopeless request reaches the per-commit fallback quickly.

---

## 7. Commands

```powershell
# Full scan (first run ~45 min; later runs seconds unless heads moved)
cd ..\github-metrics-private
python scripts\build_repository_inventory.py <out.json> --local-personal

# Import into the site
cd ..\dylantao.github.io
python bin\import_code_activity.py --personal-repo ..\DylanTao --repo-root .

# Render the profile SVG (fail-closed; read stderr)
cd ..\github-metrics-private
python scripts\render_public_profile.py `
  ..\DylanTao\docs\github-activity.json <codex.json> <rhythm.json> `
  ..\DylanTao\assets\github-metrics.svg --github-max-age-hours 48

# Tests
python -m unittest discover -s tests -p "test_*.py"      # collector, 130
python -m unittest discover -s test  -p "test_*.py"      # site, 270
Invoke-Pester -Path .\tests\DylanMetricsRefresh.Tests.ps1 # scheduler, 75
```
