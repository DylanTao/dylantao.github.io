# Agentic Usage Ledger

This ledger keeps the visible homepage AI-work counters honest enough to be useful without pretending the old runs were measured perfectly.

Agent-facing Codex overlay: `.codex/skills/agentic-usage-ledger/SKILL.md`. This document remains the canonical source for usage-counter math, evidence, and update history.

## Public Data File

The homepage reads `_data/agentic_usage.yml` for repo-scoped retained-log estimates and `_data/direct_usage_tracker.json` for the independent direct-account health surface. `assets/data/codex-profile-usage.json` is a byte-equivalent public copy for the private profile renderer.

The direct tracker is intentionally non-additive. It publishes only `accountCount`, anonymous healthy/fresh/quota-data counts, an unknown (`null`) at-limit count, explicit units/method/coverage/confidence/timestamp fields, and the separate dated Personal `20.9B` rounded checkpoint with `1 of 2 accounts` coverage. It never publishes aliases, emails, identifiers, plan types, raw percentages, reset timestamps, exact account usage, daily histories, API-cost conversions, or a combined lifetime.

`bin/import_direct_usage_snapshot.py` is the only site-side account publication boundary. It consumes the exact identity-free collector schema, requires a fresh complete healthy 2-of-2 result, rejects extra fields, and replaces both public copies atomically. Invalid, incomplete, stale, or future input leaves the last valid outputs untouched. Until the first live two-account cycle succeeds, both files explicitly publish incomplete coverage, zero observed counts, unavailable confidence, and a null timestamp; those zeros mean no observation, not unhealthy accounts.

Update that file when a future Codex or agentic run materially changes this site, especially if the work touches homepage visuals, custom layouts, custom scripts, publications/CV polish, or the 3D desk scene.

The homepage contact ledger should render the playful tree-sacrifice estimate in the top caption, then four compact stat cells for tokens, agent-hours, commits, and estimated kWh. Keep detailed conversion caveats in this document and in the small homepage info tooltip, not as extra ledger paragraphs. The headline line may use light archaic copy, but the numbers and tooltip math should stay plain.

The site does not read Codex authentication files and does not call private account endpoints. Direct collection belongs outside this public repository and must hand the importer only the sanitized collector projection. The former exact account-history publication path is retired and no per-account history file is published going forward.

`local_lifetime` remains a fork-aware retained-log replay across local project directories since June 19, 2026. It is a separate repo-development audit and pricing-mix sample, not an account total, quota metric, or input to the direct tracker. Win-CodexBar 0.42's raw 30-day total remains historical diagnostic evidence only.

## Current Baseline

Cutoff for the full site revamp: May 22, 2026 at 6:05 PM Pacific, the first clear homepage redesign commit.

### Current Snapshot Authority

There are two independent numeric authorities. `_data/agentic_usage.yml` owns repo-scoped retained-log estimates; `_data/direct_usage_tracker.json` owns anonymous direct-account quota health and the separate dated Personal rounded checkpoint. Never sum or reconcile them. Direct-account exact readings are not retained in this public ledger.

Evidence and counting contract:

- The audit recursively scans every retained year under `~/.codex/sessions`, then includes JSONL files whose **first** `session_meta.payload.cwd` contains `dylantao.github.io`. The first metadata record is the leaf identity; later session metadata can be copied parent ancestry.
- Ordered `turn_context` records supply `turn_id`, `model`, and `effort`. For modern logs, token ancestry is globally deduped by `(turn_id, full total_token_usage snapshot)`, retaining the earliest event, and the unique `last_token_usage` deltas are summed.
- Legacy events without `last_token_usage` use positive cumulative deltas. Their complete five-field snapshots are conservatively deduped across files; an accidental exact collision between independent legacy sessions could undercount, but this avoids the larger known error of summing copied fork ancestry.
- An explicit `forked_from_id` (or the unambiguous nested subagent `parent_thread_id` fallback) marks contextless token events before the leaf's first `turn_context` as copied fork preamble. These are counted as skipped ancestry, not `unknown/unknown` child usage.
- Active agent-hours use globally unique context/token events per leaf session, with gaps capped at 45 minutes. Parallel leaf sessions remain additive. A gap belongs to the model/effort active at its start, so a new context does not claim the time preceding it.
- Missing-context tokens remain visible as `unknown/unknown` and are not silently assigned to a model. Truncated, deleted, or unretained local logs cannot be reconstructed.
- Direct account publication is account-count-only and non-additive. Import a fresh complete sanitized projection with `python bin/import_direct_usage_snapshot.py PATH_TO_PROJECTION.json`; do not expose collector credentials or per-account detail to this repository.
- `local_lifetime` runs the same ancestry-deduplication and additive-event pipeline across every retained leaf session, without the site-cwd filter, beginning June 19, 2026 at 12:00 AM Pacific. It is a retained-device slice and a model/cache/request-mix sample, not a substitute for the account counter.
- Win-CodexBar 0.42 raw 30-day aggregation is diagnostic only. Its file/fork counting and cumulative-snapshot summation duplicate copied ancestry and intermediate totals, so it must not feed canonical lifetime or daily numbers.
- Repo-scoped estimate cards may keep their documented equivalence lenses, but direct account health and the Personal 20.9B rounded checkpoint never receive an API-cost conversion.
- The helper refuses to check or write from a shallow git checkout. Fetch full history first so repo commit counts cannot collapse to the shallow boundary.

Cutoff for the 3D desk/vinyl counter: June 16, 2026 at 8:00 PM Pacific, when the meme-record and desk-scene burst began.

- Desk commits are path-scoped to `assets/js/home.js`, `_sass/_home.scss`, `_includes/home/hero.liquid`, `docs/homepage-desk-scene-brief.md`, and `assets/img/home`.
- Desk tokens and hours are **not** path-attributed. They are an all-repo retained-session time-window estimate after the desk cutoff, because session logs do not reliably map each token to a changed file.

Model cutover: July 9, 2026 at 2:28:23 PM Pacific (`2026-07-09T21:28:23.394Z`). Development work is intended to use `gpt-5.6-sol` with `ultra` effort from that point. `model_tracking` checks the deduplicated all-local retained context inventory so the global development-default policy remains observable even when this repo's cwd-attributed sessions are unavailable; site usage scopes remain repo-filtered and preserve their last audited nonzero snapshot. The `since_gpt_5_6` scope measures repo-attributed retained-session usage after this boundary. If no post-cutover contexts remain anywhere in retained local history, tracking is `unobserved` and the check fails rather than claiming alignment.

### Model-Deviation Acknowledgment Contract

- `bin/audit_agentic_usage.py` owns the versioned `MODEL_DEVIATION_ACKNOWLEDGMENTS` mapping. Every entry is turn-specific and records the exact retained timestamp, model, effort, acknowledgment date, reason, and provenance. It is not a model-wide exception or an environment bypass.
- A mapped turn is acknowledged only when its complete `(turn_id, timestamp, model, effort)` signature still matches. A new turn id, a changed signature, or an incomplete reason/provenance remains unacknowledged and fails closed.
- `model_tracking` always renders every observed deviation with its original model and effort, plus total, acknowledged, and unacknowledged counts. `acknowledged_deviations` means the retained evidence is accepted under the named policy version; it does not mean the turns were aligned or relabeled.
- `--check` fails when tracking is `unobserved` or any deviation is unacknowledged. Adding another acknowledgment requires a reviewed per-turn entry, a policy-version bump, updated focused tests, and a regenerated ledger.
- The public note remains the declared current default, `gpt-5.6-sol` / `ultra`; it is not a claim that every historical retained turn matched that default.

## Energy and Cut-Tree Equivalence

The public page uses a "tree-cut lens" as a stored-carbon equivalence because it is more legible than tree-years. This is not literal felled-tree accounting: cutting or removing a tree does not instantly release all stored carbon, and the real effect depends on wood products, decay, burning, roots, soil carbon, foregone future growth, species, age, and site conditions.

The midpoint calculation uses:

```text
kWh = token_count * Wh_per_token / 1000
kg_CO2e = kWh * 0.373
tree_years = kg_CO2e / 60
cut_tree_equivalent = kg_CO2e / 600
```

Factors:

- Token energy midpoint: `0.0006 Wh/token`, derived from Epoch AI's rough GPT-4o estimate of `0.3 Wh` for a 500-output-token query.
- Token energy range: `0.0002-0.002 Wh/token`, used because Codex logs combine cached, input, output, and reasoning tokens, and true inference energy is not exposed.
- Grid emissions: `0.373 kg CO2e/kWh`, converted from EPA's `823.1 lb CO2e/MWh` electricity factor.
- Tree-year absorption, kept as internal/legacy context: `0.060 metric tons CO2 per urban tree planted per year`, from EPA's greenhouse gas equivalencies methodology.
- Cut-tree equivalent: `600 kg CO2e` per ten-year urban tree, derived as `0.060 metric tons CO2/tree/year * 10 years * 1000 kg/metric ton`. Public copy should present this as stored-carbon equivalence and should not round small values up to one tree.

Sources:

- Direct Codex app-server rate-limit collector projection, used only for anonymous two-account health/fresh/quota-data counts.
- OpenAI API pricing, used for the request-aware Standard short/long-context replay and the retained legacy `gpt-5.3-codex` lens: https://developers.openai.com/api/docs/pricing
- CodexBar local dashboard screenshot, June 19, 2026: `$2,616.40 / 3B tokens`, retained only as historical diagnostic provenance.
- Win-CodexBar 0.42 raw 30-day scan, retained only as noncanonical diagnostic provenance because it counts files/forks and cumulative snapshots.
- Epoch AI, "How much energy does ChatGPT use?": https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use
- EPA Greenhouse Gas Equivalencies Calculator calculations and references: https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator-calculations-and-references
- USDA Forest Service, "Forest Carbon FAQs": https://www.fs.usda.gov/sites/default/files/Forest-Carbon-FAQs.pdf
- USDA Forest Service urban/community tree carbon storage summary: https://research.fs.usda.gov/treesearch/46254

## Update Heuristic

Prefer the helper for future updates:

```powershell
python bin/audit_agentic_usage.py
python bin/audit_agentic_usage.py --write --include-pending-commit
npx.cmd prettier _data/agentic_usage.yml --write
```

The helper is read-only by default. With `--write`, it updates `_data/agentic_usage.yml`; with `--include-pending-commit`, it adds one pending commit to repo-wide scopes that have worktree changes and to the desk scope only when a desk path changed. `--check` also enforces the post-cutover `gpt-5.6-sol` / `ultra` contract against all retained-local contexts, accepting only exact deviations recorded in the versioned acknowledgment mapping.

If no retained site-cwd usage can be attributed on the current machine, the helper preserves the previously audited site-revamp token/hour snapshot while still refreshing commit counts. It never replaces a nonzero audited scope with zeros merely because local session attribution is unavailable. The cumulative `local_lifetime` scope is monotonic and fails closed more strictly: an empty or lower retained-archive scan preserves the last audited snapshot, while a genuinely nondecreasing scan refreshes it. This prevents cross-machine or deleted-log gaps from making retained lifetime evidence silently shrink.

The scanner prefilters JSONL lines to session metadata, turn contexts, and token-count events before decoding them. The Codex publish hook allows 150 seconds for the retained-session audit inside a 180-second hook budget. This preserves a fail-closed freshness check while leaving headroom above the roughly 107-second July 12 scan as the retained archive grows.

Use this freshness gate before pushing site changes:

1. Run the normal relevant checks for the change.
2. If `_data/citations.yml` is more than one day stale or publication pages changed, run `python bin/update_scholar_citations.py --force` and review `_data/citations.yml` plus `_data/publication_lens.yml`. Otherwise rely on the daily GitHub workflow.
3. Before the final commit, run `python bin/audit_agentic_usage.py --write --include-pending-commit`, format the generated file with `npx.cmd prettier _data/agentic_usage.yml --write`, and review the visible-label deltas.
4. Commit the intended work and refreshed ledger together when feasible.
5. After the commit, rerun `python bin/audit_agentic_usage.py` read-only. Update again only if visible labels, commit counts, rounded hours, rounded kWh/tree, or rounded cost labels changed.
6. Stage only intended files; do not sweep unrelated dirty files into a stats update.

Do not chase tiny drift caused by running the audit itself. This is an estimate for a public joke, not a billing-grade ledger.

## Codex hook behavior

This repo has a project-local Codex `PreToolUse` hook in `.codex/hooks.json`. It checks Codex-issued `git commit` and `git push` commands before they run.

- Normal `git commit` runs `python bin/audit_agentic_usage.py --check --include-pending-commit`; `git commit --amend` and `git push` run `python bin/audit_agentic_usage.py --check`.
- If public ledger fields are stale, the hook blocks and asks Codex to run the matching `--write` audit command, review `_data/agentic_usage.yml`, and stage only intended files.
- If model tracking is unobserved or contains any unacknowledged deviation, the hook blocks. There is no command-line or environment bypass; acknowledgment requires a reviewed source-mapping change.
- If staged paths touch publication or citation surfaces, the hook requires today's `_data/citations.yml` snapshot and keeps `_data/citations.yml` plus `_data/publication_lens.yml` staged together.
- For unrelated work, Scholar data more than one day stale becomes model-visible context instead of a block, because the daily GitHub workflow remains the routine refresh path.
- Codex requires changed repo-local hooks to be reviewed and trusted through `/hooks`.

Manual fallback:

1. Recount commits after the work is committed, or use the current uncommitted state only if the user explicitly wants a pre-commit estimate.

```bash
git rev-list --count --since="2026-05-22 18:00" HEAD -- .
git rev-list --count --since="2026-06-16 20:00" HEAD -- assets/js/home.js _sass/_home.scss _includes/home/hero.liquid docs/homepage-desk-scene-brief.md assets/img/home
```

2. Parse every retained year under `%CODEX_HOME%\sessions`. Use the first `session_meta` for leaf id and repo cwd; do not overwrite it with copied parent metadata later in a fork file.

3. Walk contexts and token events in file order. Globally keep the earliest event for each `(turn_id, full total snapshot)` and sum unique `last_token_usage`. For a legacy event without additive usage, subtract its previous cumulative snapshot within the leaf file and keep only positive deltas.

4. For active agent-hours, rebuild each leaf timeline from globally unique contexts and usage events, cap gaps at 45 minutes, and give very small one-shot leaf sessions a 0.05 hour floor. Parallel leaf sessions are additive; copied ancestry is not.

5. Cutoffs operate at retained event timestamps. A response whose token event lands just after a cutoff is counted after it; do not claim billing-grade sub-response apportionment.

6. Round public labels to readable units:

- Use `M` for millions and `B` for billions of tokens.
- Round large public token counts to the nearest 10M so the audit itself does not churn visible labels.
- Use whole hours once the value is above 10 hours.
- Keep exact-ish evidence in this markdown file, not in the homepage UI.

7. Update `_data/agentic_usage.yml` and append a dated note here when the estimate changes materially.

8. Recompute the energy and cut-tree equivalence from the token totals using the formula above. Keep public copy compact: show the cut-tree midpoint in the top caption, show kWh as the fourth stat cell, and keep the stored-carbon caveats in the docs and info tooltip.

9. Recompute and keep the price estimates separate when token totals change:

- Local `api_cost_equivalence` is a request-aware replay of retained events. `gpt-5.5` and `gpt-5.6-sol` have the same Standard short-context rates: $5 / 1M uncached input, $0.50 / 1M cached-read input, and $30 / 1M output. A request with more than 272,000 input tokens uses the long-context rates of $10 / 1M uncached input, $1 / 1M cached-read input, and $45 / 1M output. `xhigh` and `ultra` are effort labels and do not add a separate rate. The current retained-local replay is about $13.2K.
- The retired account-lifetime API-rate replay is historical only and must not return to public tracker data or copy.
- The `gpt-5.6-sol` cache-write rates are recorded, but no cache-write quantity is applied because retained logs do not identify those tokens.
- `legacy_api_cost_equivalence` keeps the former `gpt-5.3-codex` math for historical comparison only.
- `codexbar_cost_estimate` preserves the old screenshot ratio for historical diagnostics only; it is not rendered, and Win-CodexBar 0.42 raw totals are not a pricing input.

Every dollar figure above is an API-rate estimate, not the actual Codex product, subscription, or account bill.

## Update Log

### 2026-06-19

- Work scope: added the publish freshness gate and the write-capable `bin/audit_agentic_usage.py` helper.
- Commit delta: public total moved from 182 to 222 revamp commits; desk-scene total moved from 35 to 70 scoped commits.
- Token delta: public total moved from 1.36B to 1.81B; desk-scene total moved from 350M to 750M.
- Active-hour delta: public total moved from 135 to 167 hours; desk-scene total moved from 25 to 53 hours.
- Energy/cut-tree delta: public total moved from 816 kWh / ~0.5 tree to 1086 kWh / ~0.7 tree; desk-scene total moved from 210 kWh / ~0.13 tree to 450 kWh / ~0.28 tree.
- Cost delta: added API list-price equivalence plus the CodexBar-ratio public joke estimate; the then-current public money joke was about $1.6K for the full revamp.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 73 repo sessions, counted 46 sessions after the revamp cutoff and 11 after the desk cutoff, and rounded the clipped totals for the public UI.
- Follow-up transparent icon pass: public total moved to 212 commits, 1.69B tokens, 159 hours, 1014 kWh, and about $550 API cosplay; desk-scene total moved to 62 commits, 630M tokens, 45 hours, 378 kWh, and about $200 API cosplay.
- Desk physics/outside-motion polish: public total moved to 213 commits; desk-scene total moved to 63 scoped commits, 640M tokens, 384 kWh, and roughly 0.24 trees cut.
- Album-hit, instanced-glint, tooltip, and crying icon pass: public total moved to 214 commits, 1.72B tokens, 161 hours, 1032 kWh, and about $1.5K for the CodexBar-ratio money joke; desk-scene total moved to 64 commits, 660M tokens, 47 hours, and 396 kWh.
- Post-commit album interaction/glint audit: public total moved to 215 commits and 162 hours; desk-scene total moved to 65 scoped commits and 48 hours. Rounded token, energy, tree, API-cost, and CodexBar labels stayed unchanged.
- Shoreline WebGL and outside-return glow pass: public total moved to 216 commits, 1.74B tokens, and 1044 kWh; desk-scene total moved to 66 commits, 680M tokens, 408 kWh, about $220 API cosplay, and about $590 on the CodexBar-ratio money joke. Active-hour and tree-midpoint labels stayed rounded the same.

### 2026-06-20

- Desk card grounding pass: public total moved to 217 commits, 1.75B tokens, 163 hours, 1050 kWh, roughly 0.7 trees, and about $570 API cosplay; desk-scene total moved to 67 scoped commits, 690M tokens, 49 hours, 414 kWh, roughly 0.26 trees cut, and about $600 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` before commit and `python bin/audit_agentic_usage.py --write` after commit scanned `%CODEX_HOME%\sessions\2026`, found 73 repo sessions, counted 46 sessions after the revamp cutoff and 11 after the desk cutoff, and refreshed raw token snapshots plus commit counts.
- Coastal shader-overlay pass: public total moved to 218 commits, 1.77B tokens, 165 hours, 1062 kWh, and about $570 API cosplay; desk-scene total moved to 68 scoped commits, 710M tokens, 51 hours, 426 kWh, roughly 0.26 trees cut, about $230 API cosplay, and about $620 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` before commit and `python bin/audit_agentic_usage.py --write` after commit scanned `%CODEX_HOME%\sessions\2026`, found 74 repo sessions, counted 47 sessions after the revamp cutoff and 12 after the desk cutoff, and refreshed raw token snapshots plus commit counts.
- Sam meme split-tooltip pass: public total moved to 219 commits, 1.79B tokens, 166 hours, 1074 kWh, roughly 0.7 trees, about $580 API cosplay, and about $1.6K on the CodexBar-ratio money joke; desk-scene total moved to 69 scoped commits, 730M tokens, 52 hours, 438 kWh, roughly 0.27 trees cut, about $230 API cosplay, and about $640 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` before commit scanned `%CODEX_HOME%\sessions\2026`, found 74 repo sessions, counted 47 sessions after the revamp cutoff and 12 after the desk cutoff, and refreshed raw token snapshots plus commit counts.
- 3D room layout-flow pass: public total moved to 219 commits, 1.79B tokens, 166 hours, 1074 kWh, about $580 API cosplay, and about $1.6K on the CodexBar-ratio money joke; desk-scene total moved to 69 scoped commits, 730M tokens, 52 hours, 438 kWh, roughly 0.27 trees cut, and about $640 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 74 repo sessions, counted 47 sessions after the revamp cutoff and 12 after the desk cutoff, and included the pending 3D layout-flow commit in the public labels.
- Sirui WebGL globe restoration: public total moved to 220 commits while rounded token, active-hour, energy, tree, API-cost, and CodexBar labels stayed unchanged; desk-scene public labels stayed unchanged.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 74 repo sessions, counted 47 sessions after the revamp cutoff and 12 after the desk cutoff, and included the pending Sirui globe commit in the public total.
- Agentic cost tooltip UX polish: public total moved to 221 commits, 1.8B tokens, 167 hours, 1080 kWh, roughly 0.7 trees, about $580 API cosplay, and about $1.6K on the CodexBar-ratio money joke; desk-scene total moved to 70 scoped commits, 740M tokens, 53 hours, 444 kWh, roughly 0.28 trees cut, about $230 API cosplay, and about $650 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py` after commit showed visible-label drift, then `python bin/audit_agentic_usage.py --write` scanned `%CODEX_HOME%\sessions\2026`, found 74 repo sessions, counted 47 sessions after the revamp cutoff and 12 after the desk cutoff, and refreshed `_data/agentic_usage.yml`.
- Agentic usage refresh: public total moved to 222 commits, 1.81B tokens, 1086 kWh, and about $590 API cosplay; desk-scene rounded labels moved to 750M tokens, 450 kWh, and about $240 API cosplay while desk commits, hours, tree midpoint, and CodexBar labels stayed unchanged.
- Evidence: `python bin/audit_agentic_usage.py --write` after commit scanned `%CODEX_HOME%\sessions\2026`, found 74 repo sessions, counted 47 sessions after the revamp cutoff and 12 after the desk cutoff, and refreshed `_data/agentic_usage.yml` before amending the counter commit.
- Dark 3D room texture pass: public total moved to 223 commits, 1.83B tokens, 169 hours, 1098 kWh, about $590 API cosplay, and about $1.6K on the CodexBar-ratio money joke; desk-scene total moved to 71 scoped commits, 770M tokens, 55 hours, 462 kWh, roughly 0.29 trees cut, about $250 API cosplay, and about $670 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` before commit and `python bin/audit_agentic_usage.py --write` after commit scanned `%CODEX_HOME%\sessions\2026`, found 74 repo sessions, counted 47 sessions after the revamp cutoff and 12 after the desk cutoff, and refreshed the public labels for the room-texture commit.
- Desk room-return and pile-spread pass: public total moved to 227 commits, 1.87B tokens, 172 hours, 1122 kWh, about $610 API cosplay, and about $1.6K on the CodexBar-ratio money joke; desk-scene total moved to 72 scoped commits, 810M tokens, 58 hours, 486 kWh, roughly 0.3 trees cut, about $260 API cosplay, and about $710 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 76 repo sessions, counted 49 sessions after the revamp cutoff and 14 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending desk-scene commit.
- Footer tally, album rack, and 2D card-lane pass: public total moved to 230 commits, 1.93B tokens, 175 hours, 1158 kWh, about $620 API cosplay, and about $1.7K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 73 commits, 870M tokens, 61 hours, 522 kWh, about $270 API cosplay, and about $760 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write` after commit scanned `%CODEX_HOME%\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the committed footer-tally, album-rack, and 2D card-lane milestone.
- Outside cutaway readability pass: public total moved to 232 commits, 1.94B tokens, 178 hours, 1164 kWh, about $630 API cosplay, and about $1.7K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 75 commits, 890M tokens, 64 hours, 534 kWh, about $280 API cosplay, and about $780 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md` scanned `%CODEX_HOME%\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending outside-cutaway commit only.
- Desk HUD, focus, and paper-drop pass: public total moved to 234 commits, 1.96B tokens, 179 hours, 1176 kWh, about $630 API cosplay, and about $1.7K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 77 commits, 900M tokens, 64 hours, 540 kWh, roughly 0.3 trees cut, about $280 API cosplay, and about $780 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path _sass/_home.scss --pending-path docs/homepage-desk-scene-brief.md`, then a post-commit `python bin/audit_agentic_usage.py --write`, scanned `%CODEX_HOME%\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this desk HUD, focus, and paper-drop commit.
- Desk overlay and pile-grounding pass: public total moved to 236 commits, 1.97B tokens, 180 hours, 1182 kWh, about $630 API cosplay, and about $1.7K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 79 commits, 910M tokens, 66 hours, 546 kWh, roughly 0.3 trees cut, about $290 API cosplay, and about $790 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path _data/agentic_usage.yml --pending-path _includes/home/hero.liquid --pending-path _sass/_home.scss --pending-path docs/agentic-usage-ledger.md --pending-path docs/homepage-desk-scene-brief.md`, then a post-commit `python bin/audit_agentic_usage.py --write`, scanned `%CODEX_HOME%\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the desk overlay and pile-grounding commit.
- 3D album rack picking pass: public total moved to 237 commits, 1.98B tokens, 180 hours, 1188 kWh, about $640 API cosplay, and about $1.7K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 80 commits, 920M tokens, 66 hours, 552 kWh, roughly 0.3 trees cut, about $290 API cosplay, and about $800 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md --pending-path test/visual/interactions.spec.js --pending-path test/visual/playwright.config.js` scanned `%CODEX_HOME%\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending 3D album rack picking commit.
- Desk paper physics and room-texture sync pass: public total moved to 238 commits, 2B tokens, 181 hours, 1200 kWh, about $640 API cosplay, and about $1.7K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 81 commits, 940M tokens, 67 hours, 564 kWh, roughly 0.4 trees cut, about $300 API cosplay, and about $820 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path _sass/_home.scss --pending-path _includes/home/hero.liquid --pending-path docs/homepage-desk-scene-brief.md --pending-path test/visual/interactions.spec.js`, then a post-commit `python bin/audit_agentic_usage.py --write`, scanned `%CODEX_HOME%\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this desk paper-physics and room-texture sync commit.
- 2D vinyl record legibility pass: public total moved to 240 commits while rounded total tokens, hours, energy, tree midpoint, API-cost, and CodexBar labels stayed unchanged; the path-scoped desk counter moved to 83 commits, 960M tokens, 68 hours, 576 kWh, roughly 0.4 trees cut, about $300 API cosplay, and about $840 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md` scanned `%CODEX_HOME%\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending 2D vinyl record legibility commit.
- Rack-flick focus-clear pass: public total moved to 241 commits, 2.02B tokens, 1212 kWh, and roughly 0.8 trees while rounded total hours, API-cost, and CodexBar labels stayed unchanged; the path-scoped desk counter moved to 84 commits while rounded desk tokens, hours, energy, tree midpoint, API-cost, and CodexBar labels stayed unchanged.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md --pending-path test/visual/interactions.spec.js` scanned `%CODEX_HOME%\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending rack-flick focus-clear commit.
- Focused album and synced floor-pile pass: public total moved to 242 commits, 2.03B tokens, 183 hours, 1218 kWh, and roughly 0.8 trees while rounded public API-cost and CodexBar labels stayed unchanged; the path-scoped desk counter moved to 85 commits, 980M tokens, 69 hours, 588 kWh, roughly 0.4 trees cut, about $310 API cosplay, and about $850 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md` scanned `%CODEX_HOME%\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending focused-album and synced floor-pile commit.
- Outside-view scroll-return pass: public total moved to 243 commits, 2.05B tokens, 184 hours, 1230 kWh, and about $660 API cosplay while rounded public tree midpoint and CodexBar labels stayed unchanged; the path-scoped desk counter moved to 86 commits, 990M tokens, 70 hours, 594 kWh, and about $860 on the CodexBar-ratio money joke while rounded desk tree midpoint and API-cost labels stayed unchanged.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md --pending-path test/visual/interactions.spec.js` scanned `%CODEX_HOME%\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending outside-view scroll-return commit.
- A4 cards, album swap, and outside-coast pass: public total moved to 244 commits, 2.09B tokens, 186 hours, 1254 kWh, about $670 API cosplay, and about $1.8K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 87 commits, 1.03B tokens, 72 hours, 618 kWh, about $320 API cosplay, and about $900 on the CodexBar-ratio money joke while rounded tree midpoints stayed unchanged.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path _includes/home/hero.liquid --pending-path _sass/_home.scss --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md --pending-path test/visual/interactions.spec.js` scanned `%CODEX_HOME%\sessions\2026`, found 80 repo sessions, counted 53 sessions after the revamp cutoff and 18 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending A4 card, album swap, outside-coast, and mobile card-tap commit.

### 2026-06-21

- Japandi cliff-house room and outside-polish pass: public total moved to 247 commits, 2.11B tokens, 188 hours, 1266 kWh, about $680 API cosplay, and about $1.8K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 90 commits, 1.05B tokens, 74 hours, 630 kWh, roughly 0.4 trees cut, about $330 API cosplay, and about $920 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path _data/citations.yml --pending-path _data/publication_lens.yml --pending-path _sass/_home.scss --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md --pending-path test/visual/interactions.spec.js` scanned `%CODEX_HOME%\sessions\2026`, found 81 repo sessions, counted 54 sessions after the revamp cutoff and 19 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending 3D room/outside/cards commit.
- Scholar freshness gate: `python bin/update_scholar_citations.py --force` refreshed `_data/citations.yml` and `_data/publication_lens.yml` on June 21; total citations moved to 212 after the Physion citation count moved to 163.
- Long-run room/exterior improvement pass: public total moved to 251 commits, 2.17B tokens, 193 hours, 1302 kWh, about $700 API cosplay, and about $1.9K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 93 commits, 1.11B tokens, 79 hours, 666 kWh, roughly 0.4 trees cut, about $350 API cosplay, and about $970 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md` scanned `%CODEX_HOME%\sessions\2026`, found 82 repo sessions, counted 55 sessions after the revamp cutoff and 20 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending long-run room/exterior improvement commit.

### 2026-06-22

- Onsen lounge scene pass: public total moved to 257 commits, 2.27B tokens, 203 hours, 1362 kWh, about $730 API cosplay, and about $2.0K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 95 commits, 1.21B tokens, 89 hours, 726 kWh, roughly 0.5 trees cut, about $380 API cosplay, and about $1.1K on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md` scanned `%CODEX_HOME%\sessions\2026`, found 84 repo sessions, counted 57 sessions after the revamp cutoff and 22 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending onsen lounge scene commit.
- Onsen/chair layout and window stability pass: public total moved to 258 commits, 2.28B tokens, 204 hours, 1368 kWh, and roughly 0.9 trees while the public API-cost and CodexBar labels stayed rounded at about $730 API cosplay and about $2.0K; the path-scoped desk counter moved to 96 commits, 1.23B tokens, 90 hours, 738 kWh, roughly 0.5 trees cut, about $390 API cosplay, and about $1.1K on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 84 repo sessions, counted 57 sessions after the revamp cutoff and 22 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending onsen/chair layout and window stability commit.
- Center-pinned room-view pass: public total moved to 260 commits, 2.3B tokens, 206 hours, 1380 kWh, about $740 API cosplay, and about $2.0K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 97 commits, 1.24B tokens, 92 hours, 744 kWh, roughly 0.5 trees cut, about $390 API cosplay, and about $1.1K on the CodexBar-ratio money joke.
- Evidence: `python bin\audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path _sass/_home.scss --pending-path docs/homepage-desk-scene-brief.md` scanned `%CODEX_HOME%\sessions\2026`, found 86 repo sessions, counted 59 sessions after the revamp cutoff and 24 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending centered-room 3D commit.
- 3D room layout repair pass: public total moved to 261 commits, 2.32B tokens, 207 hours, 1392 kWh, about $740 API cosplay, and about $2.0K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 98 commits, 1.26B tokens, 93 hours, 756 kWh, roughly 0.5 trees cut, about $400 API cosplay, and about $1.1K on the CodexBar-ratio money joke.
- Evidence: `python bin\audit_agentic_usage.py --write --include-pending-commit`, then post-commit `python bin\audit_agentic_usage.py --write`, scanned `%CODEX_HOME%\sessions\2026`, found 86 repo sessions, counted 59 sessions after the revamp cutoff and 24 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this room layout, album, A4 paper, onsen, chair, and centered-360 repair commit.
- Spacious rear-room yaw pass: public total moved to 262 commits, 2.33B tokens, 208 hours, 1398 kWh, about $750 API cosplay, and about $2.0K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 99 commits, 1.27B tokens, 94 hours, 762 kWh, roughly 0.5 trees cut, about $400 API cosplay, and about $1.1K on the CodexBar-ratio money joke.
- Evidence: `python bin\audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 86 repo sessions, counted 59 sessions after the revamp cutoff and 24 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this rear-room depth, full-yaw, and 180-degree interior-clearance commit.
- Cliff-cave room pass: public total moved to 263 commits, 2.35B tokens, 210 hours, 1410 kWh, about $750 API cosplay, and about $2.0K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 100 commits, 1.29B tokens, 96 hours, 774 kWh, roughly 0.5 trees cut, about $410 API cosplay, and about $1.1K on the CodexBar-ratio money joke.
- Evidence: `python bin\audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 87 repo sessions, counted 60 sessions after the revamp cutoff and 25 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this cave-room geometry, card-grounding, and cliff-cutaway commit.
- Scholar freshness gate: `python bin/update_scholar_citations.py --force` refreshed `_data/citations.yml` and `_data/publication_lens.yml` on June 22; citation counts moved to 165 for Physion, 35 for DesignWeaver, 15 for Hotspot, and 0 for the remaining tracked publications.
- Vinyl player visibility pass: public total moved to 264 commits, 2.36B tokens, 211 hours, 1416 kWh, about $760 API cosplay, and about $2.1K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 101 commits, 1.3B tokens, 97 hours, and 780 kWh while rounded desk tree midpoint, API-cost, and CodexBar labels stayed unchanged.
- Evidence: `python bin\audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 87 repo sessions, counted 60 sessions after the revamp cutoff and 25 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this visible turntable and rear-left album-niche commit.

### 2026-06-23

- Vinyl tonearm and wall-mounted album-shelf pass: public total moved to 265 commits and 213 hours while rounded public tokens, energy, tree midpoint, API-cost, and CodexBar labels stayed unchanged; the path-scoped desk counter moved to 102 commits, 1.31B tokens, 99 hours, and 786 kWh while rounded desk tree midpoint, API-cost, and CodexBar labels stayed unchanged.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md` scanned `%CODEX_HOME%\sessions\2026`, found 87 repo sessions, counted 60 sessions after the revamp cutoff and 25 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending tonearm and opposite-wall shelf commit.

### 2026-06-27

- Homepage desk-scene reference brief: public total moved to 269 commits, 216 hours, and about $770 API cosplay while rounded public tokens, energy, tree midpoint, and CodexBar labels stayed unchanged; the path-scoped desk counter moved to 103 commits, 1.33B tokens, 102 hours, and 798 kWh while rounded desk tree midpoint, API-cost, and CodexBar labels stayed unchanged.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 90 repo sessions, counted 63 sessions after the revamp cutoff and 28 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending desk-scene reference commit.
- Remote Prettier follow-up: public total moved to 270 commits, 2.39B tokens, and 1434 kWh while rounded public hours, tree midpoint, API-cost, and CodexBar labels stayed unchanged; the path-scoped desk counter stayed at 103 commits, 1.33B tokens, 102 hours, and 798 kWh.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 90 repo sessions, counted 63 sessions after the revamp cutoff and 28 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending YAML-formatting follow-up.

### 2026-06-29

- Repo-local Codex skills conversion: public total moved to 272 commits, 2.41B tokens, 219 hours, 1446 kWh, about $770 API cosplay, and about $2.1K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 104 commits, 1.35B tokens, 105 hours, 810 kWh, about $430 API cosplay, and about $1.2K on the CodexBar-ratio money joke while rounded tree midpoints stayed unchanged.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 92 repo sessions, counted 65 sessions after the revamp cutoff and 30 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending repo-local skill conversion commit.

### 2026-06-30

- Narrow reading-aid pass: public total moved to 282 commits, 2.48B tokens, 228 hours, 1488 kWh, about $800 API cosplay, and about $2.2K on the CodexBar-ratio money joke; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.42B tokens, 114 hours, and 852 kWh.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 93 repo sessions, counted 66 sessions after the revamp cutoff and 31 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending narrow reading-aid commit.

### 2026-07-01

- Reading-aid balance follow-up: public total moved to 283 commits, 2.49B tokens, 229 hours, and 1494 kWh while rounded API-cost, tree midpoint, and CodexBar labels stayed at about $800 API cosplay, roughly 0.9 trees, and about $2.2K; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.43B tokens, 115 hours, and 858 kWh.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 93 repo sessions, counted 66 sessions after the revamp cutoff and 31 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending reading-aid balance commit.

### 2026-07-03

- Sirui fruit-gate pass plus remote Prettier follow-up: public total moved to 285 commits, 2.5B tokens, 230 hours, and 1500 kWh while rounded API-cost, tree midpoint, and CodexBar labels stayed at about $800 API cosplay, roughly 0.9 trees, and about $2.2K; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.44B tokens, 116 hours, 864 kWh, about $460 API cosplay, and about $1.3K on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 94 repo sessions, counted 67 sessions after the revamp cutoff and 32 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending Sirui fruit-gate and formatter-fix commits.

### 2026-07-04

- Sirui fruit-gate art polish: public total moved to 286 commits, 2.51B tokens, 232 hours, 1506 kWh, and about $810 API cosplay while rounded tree midpoint and CodexBar labels stayed at roughly 0.9 trees and about $2.2K; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.45B tokens, 118 hours, and 870 kWh.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 94 repo sessions, counted 67 sessions after the revamp cutoff and 32 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending Sirui fruit-gate art polish commit.

### 2026-07-05

- Don Norman reading-note publish: public total moved to 287 commits, 2.52B tokens, 233 hours, and 1512 kWh while rounded tree midpoint, API-cost, and CodexBar labels stayed unchanged; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.46B tokens, 119 hours, and 876 kWh.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `%CODEX_HOME%\sessions\2026`, found 95 repo sessions, counted 68 sessions after the revamp cutoff and 33 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending content commit.

### 2026-07-06

- Don Norman reading-note CI follow-up: public total moved to 288 commits, 2.53B tokens, 234 hours, and 1518 kWh while rounded tree midpoint, API-cost, and CodexBar labels stayed unchanged; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.47B tokens, 120 hours, 882 kWh, and about $470 API cosplay.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path .github/workflows/visual-regression.yml --pending-path _data/agentic_usage.yml --pending-path _posts/2026-03-04-don-norman-design-lab-talk.md --pending-path _posts/2026-05-13-prototyping-to-understand-humans.md --pending-path _posts/2026-07-05-specialists-generalists-ai-distributed-cognition.md --pending-path docs/agentic-usage-ledger.md` scanned `%CODEX_HOME%\sessions\2026`, found 95 repo sessions, counted 68 sessions after the revamp cutoff and 33 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending CI-formatting and visual-baseline commit.
- Customized visual-subset CI repair: public total moved to 289 commits, 2.54B tokens, 236 hours, and 1524 kWh while rounded tree midpoint, API-cost, and CodexBar labels stayed unchanged; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.49B tokens, 122 hours, 894 kWh, and about $470 API cosplay.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path .github/workflows/visual-regression.yml --pending-path _data/agentic_usage.yml --pending-path _posts/2026-03-04-don-norman-design-lab-talk.md --pending-path _posts/2026-05-13-prototyping-to-understand-humans.md --pending-path _posts/2026-07-05-specialists-generalists-ai-distributed-cognition.md --pending-path docs/agentic-usage-ledger.md` scanned `%CODEX_HOME%\sessions\2026`, found 95 repo sessions, counted 68 sessions after the revamp cutoff and 33 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending customized visual-subset and Markdown-formatting commit.
- Combined blog-post publish to main: public total moved to 294 commits, 2.55B tokens, 238 hours, 1530 kWh, and roughly 1.0 ten-year urban tree stored-carbon equivalent while API-cost and CodexBar labels stayed rounded at about $820 API cosplay and about $2.2K; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.5B tokens, 124 hours, 900 kWh, and about $470 API cosplay.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path _data/agentic_usage.yml --pending-path docs/agentic-usage-ledger.md` after merging both blog branches into main scanned `%CODEX_HOME%\sessions\2026`, found 95 repo sessions, counted 68 sessions after the revamp cutoff and 33 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the committed main merge plus pending counter follow-up that publish both July 5 blog posts.

### 2026-07-09

- Usage/model parser checkpoint: switched from per-file cumulative maxima to first-metadata leaf identity, ordered turn-context attribution, global copied-ancestry deduplication, and additive `last_token_usage` accounting. Added all-year discovery, a conservative legacy cumulative fallback, and copied-ancestry-safe active hours.
- Retained turn inventory after the revamp cutoff: 560 unique `gpt-5.5/xhigh` turns, 6 `gpt-5.5/medium` turns, and 10 `gpt-5.6-sol/ultra` turns. The post-cutover check found zero deviations.
- Published total: 296 revamp commits including the pending combined checkpoint, 2.698B raw / 2.7B rounded tokens, 242.96 / 243 rounded agent-hours, 1620 kWh, about 1.0 ten-year urban tree stored-carbon equivalent, about $2.4K at logged-model Standard short rates, about $860 under the retained legacy `gpt-5.3-codex` lens, and about $2.4K under the separate CodexBar ratio.
- Desk window: 108 path-scoped commits including the pending hero binding, but 1.613B raw / 1.61B rounded tokens and 128.97 / 129 rounded hours are explicitly an all-repo retained-session time-window estimate, not desk-only attribution.
- Since-`gpt-5.6-sol` window: 89.23M raw / 89M rounded tokens and 3.90 / 4 rounded hours, all attributed to the 10 retained `gpt-5.6-sol/ultra` turns; the corrected fork-preamble rule leaves no post-cutover `unknown/unknown` bucket.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned 104 repo leaf sessions across `%CODEX_HOME%\sessions`, retained 21,844 unique additive events, skipped 788 copied or repeated snapshots plus 385 explicit fork-preamble events, and wrote `_data/agentic_usage.yml`. The session logs were still growing during the run, so exact raw totals can drift while rounded public labels stay stable.
- `gpt-5.6-sol/ultra` pipeline, site, and scene checkpoint: the public total moved to 305 commits including the pending commit, 3.040B raw / 3.04B rounded tokens, 255.11 / 255 rounded agent-hours, 1824 kWh, about 1.1 ten-year urban tree stored-carbon equivalent, about $2.6K at logged-model Standard short-context rates, and about $2.7K under the separate CodexBar ratio.
- Desk window: 110 path-scoped commits, 1.956B raw / 1.96B rounded tokens, 141.11 / 141 rounded hours, 1176 kWh, about 0.7 ten-year urban tree stored-carbon equivalent, about $1.6K under the logged-model API lens, and about $1.7K under the CodexBar lens.
- Since-`gpt-5.6-sol` window: 431.728M raw / 430M rounded tokens and 16.05 / 16 rounded hours across 20 retained sessions and 29 retained `gpt-5.6-sol/ultra` turns. The alignment check found zero post-cutover deviations.
- Evidence: the pending-commit audit scanned 118 repo leaf sessions, retained 21,688 unique usage events, and wrote `_data/agentic_usage.yml`. Public pricing was checked on July 9, 2026. Cache writes remain unpriced because the retained logs do not expose a distinct cache-write bucket.

### 2026-07-10

- Research-grounded homepage motion checkpoint: added interaction-driven kinetic response to the bounded Design/Evaluate/Situate diagram, explicit `commits` and `tokens` wording in the 3D overlay, a quieter proof-card coffee ring, source credit, an intent record, and a reduced-motion visual contract.
- Published total: 306 revamp commits including the pending checkpoint, 3.1B rounded tokens, 257 rounded agent-hours, 1860 kWh, about 1.2 ten-year urban trees' stored-carbon equivalent, about $2.6K at logged-model Standard short-context rates, and about $2.7K under the separate CodexBar ratio.
- Desk window: 111 path-scoped commits including the now-committed hero/Sass change; retained-session totals moved to 2.02B rounded tokens, 143 rounded hours, 1212 kWh, and about 0.8 ten-year urban trees' stored-carbon equivalent. Tokens and hours remain an all-repo time-window estimate, not desk-only attribution.
- Since-`gpt-5.6-sol` window: 11 commits including the pending checkpoint, 490M rounded tokens, and 18 rounded hours across 34 retained `gpt-5.6-sol/ultra` turns; the alignment check found zero deviations.
- Evidence: the pending-commit audit followed by the post-commit `python bin/audit_agentic_usage.py --write` refresh scanned 123 repo leaf sessions across retained years, counted 24,334 additive usage events before ancestry deduplication, and refreshed `_data/agentic_usage.yml` after the four-viewport scene checks, light/dark sitewide matrix, Docker render, and production Jekyll build passed.
- Sitewide route and hidden-journey checkpoint: expanded current-route coverage to publications, CV, news, year archives, blog pagination, and the locked secret page; corrected the fruit gate's truthful feedback, focus recovery, session persistence, and precise-location consent; and improved mobile evidence order, CV navigation, archive date economy, and page-two priority without spreading ambient effects across every route.
- Published total: 307 revamp commits including the pending checkpoint, 3.12B rounded tokens, 258 rounded agent-hours, 1872 kWh, about 1.2 ten-year urban trees' stored-carbon equivalent, about $2.6K at logged-model Standard short-context rates, and about $2.7K under the separate CodexBar ratio.
- Desk window: 111 path-scoped commits; retained-session totals moved to 2.04B rounded tokens, 144 rounded hours, 1224 kWh, and about 0.8 ten-year urban trees' stored-carbon equivalent. Tokens and hours remain an all-repo time-window estimate, not desk-only attribution.
- Since-`gpt-5.6-sol` window: 12 commits including the checkpoint, 520M rounded tokens, and 19 rounded hours across 37 retained `gpt-5.6-sol/ultra` turns; the alignment check found zero post-cutover deviations.
- Evidence: the pending-commit audit followed by the post-commit `python bin/audit_agentic_usage.py --write` refresh scanned 126 repo leaf sessions across retained years, retained 22,287 additive usage events after copied-ancestry and fork-preamble filtering, and refreshed `_data/agentic_usage.yml`. The expanded Docker route run passed 21 tests with three intentional skips before the archive assertion was normalized; the four-viewport archive rerun then passed, alongside source checks, the production Jekyll build, and the local-override audit.

### 2026-07-11

- Research-grounded GitHub activity checkpoint: added a site-native focus-and-context view, keyboard inspection, exact weekly table, readable/literal scale controls, a privacy-safe fallback snapshot, and responsive coverage; the personal and Autodesk profile cards were redesigned in the same bounded visual system.
- Published total after the formatter and local-preview follow-ups: 310 revamp commits, 3.12B rounded tokens, and 259 rounded agent-hours. Since-`gpt-5.6-sol`: 15 commits, 520M rounded tokens, and 20 rounded hours. Token, energy, tree, API-cost, and CodexBar labels stayed unchanged at this checkpoint.
- Evidence: the task-local goal snapshot at 2026-07-11 14:36 PDT reported 862,105 tokens and 3,270 elapsed seconds. Because the task began in the shared `misc` workspace rather than this checkout, the pending commit and elapsed time were added manually; detailed retained-log model buckets remain at the prior audited snapshot.

### 2026-07-12

- Retained-local history became a separate public context scope with a Jun 19 boundary: 7,417,721,920 raw / 7.42B rounded tracked tokens across 314 counted sessions and 360 rounded agent-hours, with a ~$5.9K logged-model Standard short-context API equivalence. This is retained device history, not OpenAI account lifetime usage or an actual bill; unobserved cache writes and long-context premiums are excluded.
- Model mix in that retained-local scope: 4,494,217,651 tokens attributed to `gpt-5.5/xhigh` and 2,923,504,269 to `gpt-5.6-sol/ultra`. The all-local post-cutover policy check observed 424 retained contexts with zero deviations.
- The site-only public snapshot remains preserved at 3.12B rounded tokens and 259 hours because this machine had no first-cwd site sessions; its complete git history still refreshed independently. The cumulative retained-local scope now also fails closed on empty or lower partial archives so cross-machine or deleted-log gaps cannot make lifetime evidence shrink.
- Evidence: the final follow-up `python bin/audit_agentic_usage.py --write` scan covered 316 retained local leaf sessions across all cwd values, counted 50,318 post-boundary usage events, and refreshed `_data/agentic_usage.yml` after the responsive, interaction, privacy, and reduced-motion QA pass.
- Personal rounded checkpoint: `20.9B` tokens captured at `2026-07-12T18:40:36.572451Z`, explicitly covering 1 of 2 accounts and never combined with tracker health.
- Later fork-aware local replay: retained logs since June 19 remain a separate pricing-mix sample. Direct-account totals and account-derived pricing extrapolations are removed from this public ledger and are not rendered.
- Win-CodexBar 0.42 reconciliation remains historical diagnostic context only. Its raw scan duplicated copied ancestry and cumulative snapshots, so neither its token nor cost output feeds the tracker, website, or combined lifetime usage.
- Source-level cause: the Windows scanner starts cumulative deltas from zero for each JSONL file and clamps counter decreases before continuing. That behavior duplicates fork ancestry and replay resets; the diagnostic is retained qualitatively without publishing raw account or CodexBar totals.
- Homepage cliff-room continuity checkpoint: rebuilt interior/exterior anchors, rear-orbit clearance, compact 390/768 framing, genuine window/return raycasts, grounded album/card drops, full-room recovery after a sleeve swap, and explicit `commits · tokens` scene copy. The independent scene matrix passed 15 states with 25 intentional viewport skips; the legacy interaction slice passed 6 with 2 intentional mobile skips; the current sitewide matrix, production `/al-folio` build, and override audits passed.
- Pending public totals: 325 revamp commits after amending the preserved checkpoint, 3.39B rounded tokens, 268 rounded agent-hours, 2034 kWh, about 1.3 ten-year urban trees' stored-carbon equivalent, and about $2.9K under the request-aware logged-model API-rate replay. The desk window is 114 path-scoped commits, 2.31B rounded retained-session tokens, and 154 rounded hours; only its commit and token labels render inside the 3D scene.
- Since-`gpt-5.6-sol` window: 30 commits including the amended checkpoint, 780M rounded tokens, and 29 rounded hours. The all-local policy inventory truthfully records 140 `gpt-5.6-sol/ultra` contexts plus two retained July 11 `gpt-5.4-mini` deviations; the public development-default note remains a declared target rather than a claim that the retained archive is perfectly aligned.
- Retained-local replay: 10.2B rounded tokens and 464 rounded hours since June 19, with an approximately $8.2K request-aware API-rate replay. Evidence: `python bin/audit_agentic_usage.py --write` scanned 369 local and 147 repo-attributed leaf sessions, counted 26,276 additive usage events after skipping 18,090 copied/repeated snapshots and 11,108 fork-preamble events, then refreshed the retained-log ledger. The former account-history publication is retired.

### 2026-07-13

- Reciprocal cliff-room checkpoint: replaced the hand-matched exterior miniature with the actual room under reciprocal cameras; rebuilt the coast around one ocean and shoreline; corrected onsen/lounge scale, wall evidence, bounded rear orbit, live coastal theme recoloring, and album-settlement QA.
- Integrated public totals: 332 revamp commits including this checkpoint and the concurrent metrics/interaction work preserved during rebase, 3.61B rounded retained-session tokens, 278 rounded agent-hours, 2166 kWh, about 1.3 ten-year urban trees' stored-carbon equivalent, and about $3.1K under the request-aware API-rate replay.
- Desk window: 116 path-scoped commits, 2.52B rounded retained-session tokens, and 164 rounded hours. The compact 3D overlay intentionally renders only `116 commits · 2.52B tokens`; hours, energy, tree, and cost lenses remain in fuller ledger contexts.
- Since-`gpt-5.6-sol` window: 37 commits including this checkpoint and the preserved concurrent work, 1B rounded tokens, and 39 rounded hours. The all-local policy inventory still records the two retained July 11 `gpt-5.4-mini` deviations rather than silently claiming perfect alignment.
- Evidence: `python bin/audit_agentic_usage.py --write` scanned 382 local and 160 repo-attributed leaf sessions, retained 27,556 additive usage events after skipping 33,519 copied/repeated snapshots and 19,019 fork-preamble events, then refreshed `_data/agentic_usage.yml`. The production scene matrix passed 15 required states with 25 intentional viewport guards; the stabilized legacy slice passed 6 with 2 intentional mobile skips; the focused rear-orbit return-occlusion journey passed; the Docker-root keyboard-after-shake regression passed on desktop and mobile; and the production Jekyll build, Docker root scene, 64 Python tests, style contract, and override audit passed.
- Public-CV truth checkpoint: replaced the four-page public PDF, synchronized the web and downloadable JSON projections, and corrected UIST 2026 service to `Special Recognition for 2 + Highly Useful for 2`.
- Pending public totals: 333 revamp commits, 3.83B rounded retained-session tokens, 289 rounded agent-hours, 2298 kWh, about 1.4 ten-year urban trees' stored-carbon equivalent, and about $3.3K under the request-aware API-rate replay. The desk path remains 116 commits; its all-repo post-cutoff estimate moved to 2.75B tokens and 175 hours.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned 393 retained local and 171 repo-attributed leaf sessions, retained 28,902 additive usage events after skipping 58,937 copied/repeated snapshots and 21,447 fork-preamble events, and refreshed `_data/agentic_usage.yml`. The two JSON projections matched, the service line rendered in the production `/al-folio` build, and all four PDF pages were rendered and inspected without clipping or overlap.

### 2026-07-14

- Restrained-motion and reciprocal-navigation checkpoint: bounded the research-motion response to its canvas, restored the four-stat homepage ledger and additions/deletions build-rhythm evidence, refined Human/AI route counterparts and no-JavaScript navigation, accepted the reciprocal cliff-room architecture after current-source scene QA, and fixed a desktop initial-anchor race found by the final sitewide matrix.
- Direct-account publication boundary: the former exact authenticated snapshot and daily series were removed. The only retained public account baseline is the rounded `20.9B` Personal checkpoint captured `2026-07-12T18:40:36.572451Z`, explicitly covering 1 of 2 accounts and never combined with quota health.
- Published public totals: 336 revamp commits, 5.13B rounded retained-session tokens, 364 rounded agent-hours, 3078 kWh, about 1.9 ten-year urban trees' stored-carbon equivalent, and about $4.5K under the request-aware API-rate replay. The desk window is 117 path-scoped commits, 4.05B rounded retained-session tokens, and 250 rounded hours; its compact scene note still renders only commits and tokens.
- Model-policy inventory: 435 retained post-cutover contexts include 430 `gpt-5.6-sol/ultra` contexts, the two previously recorded July 11 `gpt-5.4-mini` routing-smoke deviations, two July 14 provider-managed Plan-mode usage-reset planning turns recorded as `gpt-5.6-sol/medium` (the first was interrupted), and one July 14 provider-managed automation worker recorded as `gpt-5.6-sol/high`. Policy v1 acknowledges those five exact retained-turn signatures with per-turn reason and provenance, so the computed status is `acknowledged_deviations` with five acknowledged and zero unacknowledged. Their original values remain visible; any new or mismatched deviation still fails the publish hook closed.
- Evidence: the post-commit `python bin/audit_agentic_usage.py --write` scanned 490 local and 222 repo-attributed leaf sessions, retained 36,466 additive usage-event sources after skipping 179,248 copied/repeated snapshots and 86,029 fork-preamble events, and refreshed the retained-log ledger. The former exact account history and projection are retired. The final production scene matrix passed 18 required states with 34 intentional viewport guards; the legacy homepage slice passed 7 states with 3 intentional mobile skips; the sitewide matrix passed 71 states with 21 intentional skips; and the Human/AI counterpart stress repeated cleanly 5/5. The targeted production-baseurl bundle passed seven cases, generated publication/AI-readable outputs validated, and the production Jekyll build completed with only the documented citation, `jupyter-nbconvert`, and Rails deprecation warnings.
- CI-determinism follow-up: the pending repair keeps machine-view Sources current across a late four-pixel chrome shift, scopes WebGL native-click suppression to the canvas so immediate Reset remains available, hides unavailable window telemetry, and gives the unchanged four-card WebKit replay journey a realistic per-test budget.
- Published public totals: 337 revamp commits, 5.26B rounded retained-session tokens, 372 rounded agent-hours, and 3156 kWh. The desk window is 118 path-scoped commits, 4.17B rounded retained-session tokens, and 258 rounded hours; its compact scene note continues to render only commits and tokens.
- Evidence: `python bin/audit_agentic_usage.py --write` scanned 526 local and 228 repo-attributed leaf sessions, retained 37,223 additive usage-event sources after skipping 214,107 copied/repeated snapshots and 86,029 fork-preamble events, and found 504 retained post-cutover turns with five acknowledged and zero unacknowledged deviations.

### 2026-07-15

- Portfolio-experiment evidence checkpoint: completed the nine-project hero-debut chronology, one parent-page rationale for model-to-model re-review, quiet origin routes for the desk/card/portal widgets, truthful participant-visible teaser captures, and mobile/reduced-motion contracts. The Build Rhythm page now carries the full John Thompson, Autodesk HCI internship, Google News Lab, and Truth & Beauty credit chain.
- Model-policy v2 adds exact acknowledgments for two retained `gpt-5.6-sol/xhigh` turns: a no-tools `DIRECT_OK` Codex-LB routing smoke and an explicitly direct-OpenAI, read-only Codex-LB maintenance audit. Both retain their original model/effort values and per-turn provenance; the fail-closed inventory reports seven acknowledged and zero unacknowledged deviations.
- First pending-checkpoint audit: 346 revamp commits, 5.59B rounded retained-session tokens, 402 rounded agent-hours, 3354 kWh, about 2.1 ten-year urban trees' stored-carbon equivalent, and about $4.8K under the request-aware API-rate replay. The desk window remains 119 path-scoped commits; its time-window estimate moved to 4.51B rounded tokens and 288 rounded hours.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned 599 local and 248 repo-attributed leaf sessions, retained 39,345 additive usage-event sources after skipping 217,546 copied/repeated snapshots and 86,029 fork-preamble events, and observed 700 post-cutover turns. The final source suite passed 109 tests plus Prettier, style, JavaScript syntax, publication-output validation, and the local-override audit; the Docker-root project chronology, desk-origin, and Dogtor journey passed nine viewport cases with three intentional non-desktop journey skips.

### 2026-07-16

- Visual-checkpoint determinism follow-up: traced the failed desktop window journey to a locator screenshot leaving the desk canvas above the viewport, then normalized the canvas with `scrollIntoViewIfNeeded()` before converting projected scene ratios to absolute click coordinates. The compact reproduction moved the canvas from a negative Y position back into view and restored the expected `windowJump` raycast without changing production scene behavior.
- Model-policy v6 adds exact acknowledgments for one interrupted, non-site `gpt-5.6-sol/low` personal-metrics startup turn and eight provider-managed `codex-auto-review/low` turns for VariationWeaver-Canvas or semantic-scaffolding-map. All original model/effort values and per-turn provenance remain visible; the fail-closed inventory reports 16 acknowledged and zero unacknowledged deviations.
- Pending public totals: 351 revamp commits, 5.7B rounded retained-session tokens, 408 rounded agent-hours, 3420 kWh, about 2.1 ten-year urban trees' stored-carbon equivalent, and about $4.9K under the request-aware API-rate replay. The desk window remains 119 path-scoped commits; its time-window estimate moved to 4.62B rounded tokens and 294 rounded hours. The separate retained-local context now rounds to 16B tokens and 851 hours.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned 635 local and 252 repo-attributed leaf sessions, retained 40,044 additive usage-event sources after skipping 218,646 copied/repeated snapshots and 89,269 fork-preamble events, and observed 770 retained post-cutover turns. The full Python suite passed 111 tests, including 35 focused ledger-audit tests, and the exact browser reproduction produced `windowJump` with no runtime errors after forcing the canvas above the viewport.
- Direct-account source transition: removed the exact authenticated account-history feed and replaced it with a strict anonymous schema-v2 projection. The public surface reports only complete two-account health/coverage metadata and keeps the dated 20.9B one-of-two rounded checkpoint separate and non-additive; it publishes no account identity, raw quota/reset detail, account-derived cost, or combined lifetime total.
- Direct-tracker checkpoint totals: 353 revamp commits, 5.74B rounded retained-session tokens, 412 rounded agent-hours, 3444 kWh, about 2.1 ten-year urban trees' stored-carbon equivalent, and about $5.0K under the request-aware API-rate replay. The desk window remains 119 path-scoped commits and moved to 4.66B rounded tokens and 298 hours; the separate retained-local replay moved to 16.1B tokens and 860 hours.
- Direct-tracker evidence: the retained-history audit scanned 644 local and 252 repo-attributed leaf sessions, retained 40,339 additive usage-event sources after skipping 218,655 copied/repeated snapshots and 89,269 fork-preamble events, and observed 784 retained post-cutover turns with 16 acknowledged and zero unacknowledged deviations. The independent tracker importer and privacy suite validate the anonymous health artifact separately from every retained-log estimate.
- IKEA-card refinement checkpoint: put the opening surface clip on the same cancelable 430 ms clock as translation-only FLIP, removed competing descendant keyframes and image zoom, made interruption cleanup deterministic across Chromium and WebKit, raised expanded actions to 44 pixels, and documented the accepted behavior with a contextual case-study image and reproduction brief. Rendered inspection also found and fixed the evidence caption's dark-mode contrast.
- Checkpoint totals: 356 revamp commits including the pending ledger commit, 5.77B rounded retained-session tokens, 413 rounded agent-hours, 3462 kWh, about 2.2 ten-year urban trees' stored-carbon equivalent, and about $5.0K under the request-aware API-rate replay. The desk window remains 119 path-scoped commits and moved to 4.69B rounded tokens and 299 hours; the separate retained-local replay moved to 16.2B tokens and 863 hours.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned 650 local and 254 repo-attributed leaf sessions, retained 40,587 additive usage-event sources after skipping 221,634 copied/repeated snapshots and 89,269 fork-preamble events, and observed 790 retained post-cutover turns with 16 acknowledged and zero unacknowledged deviations. The source gates passed full Prettier, the style contract, 88 Python tests, JavaScript syntax, publication-output validation, and the local-override audit; the four-viewport light/dark public evidence matrix passed 12 cases, the post-fix caption-contrast matrix passed four, and the focused Chromium/WebKit interaction slice passed six.

## Future Entry Template

### YYYY-MM-DD

- Work scope:
- Commit delta:
- Token delta:
- Active-hour delta:
- Energy/cut-tree delta:
- Evidence:
- Updated public totals:
