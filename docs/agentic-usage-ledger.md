# Agentic Usage Ledger

This ledger keeps the visible homepage AI-work counters honest enough to be useful without pretending the old runs were measured perfectly.

Agent-facing Codex overlay: `.codex/skills/agentic-usage-ledger/SKILL.md`. This document remains the canonical source for usage-counter math, evidence, and update history.

## Public Data File

The homepage reads `_data/agentic_usage.yml`.

Update that file when a future Codex or agentic run materially changes this site, especially if the work touches homepage visuals, custom layouts, custom scripts, publications/CV polish, or the 3D desk scene.

The homepage contact ledger should render the playful tree-sacrifice estimate in the top caption, then four compact stat cells for tokens, agent-hours, commits, and estimated kWh. Keep detailed conversion caveats in this document and in the small homepage info tooltip, not as extra ledger paragraphs. The headline line may use light archaic copy, but the numbers and tooltip math should stay plain.

## Current Baseline

Cutoff for the full site revamp: May 22, 2026 at 6:05 PM Pacific, the first clear homepage redesign commit.

Published total baseline, estimated on June 22, 2026:

- 260 commits since the revamp cutoff, including the Japandi cliff-house room, click-only window transitions, compact album/source cards, album-disc swap, outside-coast, mobile card-tap milestones, the long-run room/exterior improvement pass, the onsen lounge scene pass, the follow-up layout/window stability pass, and the center-pinned room-view pass.
- 2.3B estimated Codex tokens.
- 206 estimated active agent-hours.
- Public money joke: about $2.0K from the CodexBar screenshot ratio, treated as a local estimate rather than an actual bill.
- API-cost reference: about $740 at `gpt-5.3-codex` list prices, kept as API cosplay rather than an actual Codex bill.
- Tree-cut lens: about 1380 kWh, 515 kg CO2e, or a stored-carbon equivalent of about 0.9 ten-year urban trees. Range: 0.29-2.9 trees.

Evidence behind the total:

- `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path _sass/_home.scss --pending-path docs/homepage-desk-scene-brief.md` scanned retained local Codex session logs for this repo, deduped by `session_meta.payload.id`, and counted 59 sessions after the revamp cutoff.
- The audit showed about 2.299B raw tokens and 205.79 active hours after clipping sessions to the cutoff, then rounded those values for the public UI.
- The audit tracks input, cached input, output, reasoning-output, and total tokens; interpolates token snapshots for sessions crossing a cutoff; and caps timestamp gaps at 45 minutes to avoid counting long idle periods.
- The public money joke uses the CodexBar screenshot ratio `$2,616.40 / 3B tokens = ~$0.872 per 1M tokens`, applied to the rounded public token count.

Cutoff for the 3D desk/vinyl counter: June 16, 2026 at 8:00 PM Pacific, when the meme-record and desk-scene burst began.

Published 3D desk baseline:

- 97 commits touching the homepage desk/vinyl/coffee scene paths, including the Japandi cliff-house room, click-only window transitions, compact album/source cards, A4 project artifacts, album-disc swap, outside-coast, mobile card-tap milestones, the long-run room/exterior improvement pass, the onsen lounge scene pass, the follow-up layout/window stability pass, and the center-pinned room-view pass.
- 1.24B estimated Codex tokens.
- 92 estimated active agent-hours.
- Public money joke reference: about $1.1K from the CodexBar screenshot ratio.
- API-cost reference: about $390 at `gpt-5.3-codex` list prices, kept as API cosplay rather than an actual Codex bill.
- Tree-cut lens: about 744 kWh, 278 kg CO2e, or a stored-carbon equivalent of about 0.5 ten-year urban trees. Range: 0.15-1.5 trees.

Evidence behind the 3D desk baseline:

- Relevant commit paths: `assets/js/home.js`, `_sass/_home.scss`, `_includes/home/hero.liquid`, `docs/homepage-desk-scene-brief.md`, and `assets/img/home`.
- The audit counted 24 Codex sessions after the 3D cutoff, about 1.241B raw tokens, and about 91.73 active hours, rounded for the public UI.

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

- OpenAI API pricing, `gpt-5.3-codex` list rates: https://developers.openai.com/api/docs/pricing
- CodexBar local dashboard screenshot, June 19, 2026: `$2,616.40 / 3B tokens`, used only as a public joke estimate.
- Epoch AI, "How much energy does ChatGPT use?": https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use
- EPA Greenhouse Gas Equivalencies Calculator calculations and references: https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator-calculations-and-references
- USDA Forest Service, "Forest Carbon FAQs": https://www.fs.usda.gov/sites/default/files/Forest-Carbon-FAQs.pdf
- USDA Forest Service urban/community tree carbon storage summary: https://research.fs.usda.gov/treesearch/46254

## Update Heuristic

Prefer the helper for future updates:

```bash
python bin/audit_agentic_usage.py
python bin/audit_agentic_usage.py --write --include-pending-commit
```

The helper is read-only by default. With `--write`, it updates `_data/agentic_usage.yml`; with `--include-pending-commit`, it adds one pending commit to scopes that currently have worktree changes, which lets a final combined commit carry fresh public counters before it exists on `HEAD`.

Use this freshness gate before pushing site changes:

1. Run the normal relevant checks for the change.
2. If `_data/citations.yml` is more than one day stale or publication pages changed, run `python bin/update_scholar_citations.py --force` and review `_data/citations.yml` plus `_data/publication_lens.yml`. Otherwise rely on the daily GitHub workflow.
3. Before the final commit, run `python bin/audit_agentic_usage.py --write --include-pending-commit` and review the visible-label deltas.
4. Commit the intended work and refreshed ledger together when feasible.
5. After the commit, rerun `python bin/audit_agentic_usage.py` read-only. Update again only if visible labels, commit counts, rounded hours, rounded kWh/tree, or rounded cost labels changed.
6. Stage only intended files; do not sweep unrelated dirty files into a stats update.

Do not chase tiny drift caused by running the audit itself. This is an estimate for a public joke, not a billing-grade ledger.

## Codex hook behavior

This repo has a project-local Codex `PreToolUse` hook in `.codex/hooks.json`. It checks Codex-issued `git commit` and `git push` commands before they run.

- Normal `git commit` runs `python bin/audit_agentic_usage.py --check --include-pending-commit`; `git commit --amend` and `git push` run `python bin/audit_agentic_usage.py --check`.
- If public ledger fields are stale, the hook blocks and asks Codex to run the matching `--write` audit command, review `_data/agentic_usage.yml`, and stage only intended files.
- If staged paths touch publication or citation surfaces, the hook requires today's `_data/citations.yml` snapshot and keeps `_data/citations.yml` plus `_data/publication_lens.yml` staged together.
- For unrelated work, Scholar data more than one day stale becomes model-visible context instead of a block, because the daily GitHub workflow remains the routine refresh path.
- Codex requires changed repo-local hooks to be reviewed and trusted through `/hooks`.

Manual fallback:

1. Recount commits after the work is committed, or use the current uncommitted state only if the user explicitly wants a pre-commit estimate.

```bash
git rev-list --count --since="2026-05-22 18:00" HEAD -- .
git rev-list --count --since="2026-06-16 20:00" HEAD -- assets/js/home.js _sass/_home.scss _includes/home/hero.liquid docs/homepage-desk-scene-brief.md assets/img/home
```

2. Parse retained Codex sessions under `C:\Users\dylan\.codex\sessions\2026`. Include sessions whose `session_meta.payload.cwd` contains `dylantao.github.io`.

3. For token totals, use the last `event_msg` with `payload.type == "token_count"` in each session and read `payload.info.total_token_usage.total_tokens`. Deduplicate by `session_meta.payload.id`; if multiple files share an id, keep the highest/latest token snapshot.

4. For active agent-hours, sum timestamp gaps within each retained session, capping each gap at 45 minutes to avoid counting idle time. Give very small one-shot sessions a 0.05 hour floor.

5. If a session spans a cutoff and exact apportionment is not worth the complexity, add a short note and a conservative manual estimate rather than silently overcounting.

6. Round public labels to readable units:

- Use `M` for millions and `B` for billions of tokens.
- Round large public token counts to the nearest 10M so the audit itself does not churn visible labels.
- Use whole hours once the value is above 10 hours.
- Keep exact-ish evidence in this markdown file, not in the homepage UI.

7. Update `_data/agentic_usage.yml` and append a dated note here when the estimate changes materially.

8. Recompute the energy and cut-tree equivalence from the token totals using the formula above. Keep public copy compact: show the cut-tree midpoint in the top caption, show kWh as the fourth stat cell, and keep the stored-carbon caveats in the docs and info tooltip.

9. Recompute both cost lenses when token totals change: keep `api_cost_equivalence` as the OpenAI `gpt-5.3-codex` list-price reference, and use `codexbar_cost_estimate` for the public `Sam's money waste so far` joke. Both are estimates, not actual Codex product spend.

## Update Log

### 2026-06-19

- Work scope: added the publish freshness gate and the write-capable `bin/audit_agentic_usage.py` helper.
- Commit delta: public total moved from 182 to 222 revamp commits; desk-scene total moved from 35 to 70 scoped commits.
- Token delta: public total moved from 1.36B to 1.81B; desk-scene total moved from 350M to 750M.
- Active-hour delta: public total moved from 135 to 167 hours; desk-scene total moved from 25 to 53 hours.
- Energy/cut-tree delta: public total moved from 816 kWh / ~0.5 tree to 1086 kWh / ~0.7 tree; desk-scene total moved from 210 kWh / ~0.13 tree to 450 kWh / ~0.28 tree.
- Cost delta: added API list-price equivalence plus the CodexBar-ratio public joke estimate; current public money joke is about $1.6K for the full revamp.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 73 repo sessions, counted 46 sessions after the revamp cutoff and 11 after the desk cutoff, and rounded the clipped totals for the public UI.
- Follow-up transparent icon pass: public total moved to 212 commits, 1.69B tokens, 159 hours, 1014 kWh, and about $550 API cosplay; desk-scene total moved to 62 commits, 630M tokens, 45 hours, 378 kWh, and about $200 API cosplay.
- Desk physics/outside-motion polish: public total moved to 213 commits; desk-scene total moved to 63 scoped commits, 640M tokens, 384 kWh, and roughly 0.24 trees cut.
- Album-hit, instanced-glint, tooltip, and crying icon pass: public total moved to 214 commits, 1.72B tokens, 161 hours, 1032 kWh, and about $1.5K for the CodexBar-ratio money joke; desk-scene total moved to 64 commits, 660M tokens, 47 hours, and 396 kWh.
- Post-commit album interaction/glint audit: public total moved to 215 commits and 162 hours; desk-scene total moved to 65 scoped commits and 48 hours. Rounded token, energy, tree, API-cost, and CodexBar labels stayed unchanged.
- Shoreline WebGL and outside-return glow pass: public total moved to 216 commits, 1.74B tokens, and 1044 kWh; desk-scene total moved to 66 commits, 680M tokens, 408 kWh, about $220 API cosplay, and about $590 on the CodexBar-ratio money joke. Active-hour and tree-midpoint labels stayed rounded the same.

### 2026-06-20

- Desk card grounding pass: public total moved to 217 commits, 1.75B tokens, 163 hours, 1050 kWh, roughly 0.7 trees, and about $570 API cosplay; desk-scene total moved to 67 scoped commits, 690M tokens, 49 hours, 414 kWh, roughly 0.26 trees cut, and about $600 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` before commit and `python bin/audit_agentic_usage.py --write` after commit scanned `C:\Users\dylan\.codex\sessions\2026`, found 73 repo sessions, counted 46 sessions after the revamp cutoff and 11 after the desk cutoff, and refreshed raw token snapshots plus commit counts.
- Coastal shader-overlay pass: public total moved to 218 commits, 1.77B tokens, 165 hours, 1062 kWh, and about $570 API cosplay; desk-scene total moved to 68 scoped commits, 710M tokens, 51 hours, 426 kWh, roughly 0.26 trees cut, about $230 API cosplay, and about $620 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` before commit and `python bin/audit_agentic_usage.py --write` after commit scanned `C:\Users\dylan\.codex\sessions\2026`, found 74 repo sessions, counted 47 sessions after the revamp cutoff and 12 after the desk cutoff, and refreshed raw token snapshots plus commit counts.
- Sam meme split-tooltip pass: public total moved to 219 commits, 1.79B tokens, 166 hours, 1074 kWh, roughly 0.7 trees, about $580 API cosplay, and about $1.6K on the CodexBar-ratio money joke; desk-scene total moved to 69 scoped commits, 730M tokens, 52 hours, 438 kWh, roughly 0.27 trees cut, about $230 API cosplay, and about $640 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` before commit scanned `C:\Users\dylan\.codex\sessions\2026`, found 74 repo sessions, counted 47 sessions after the revamp cutoff and 12 after the desk cutoff, and refreshed raw token snapshots plus commit counts.
- 3D room layout-flow pass: public total moved to 219 commits, 1.79B tokens, 166 hours, 1074 kWh, about $580 API cosplay, and about $1.6K on the CodexBar-ratio money joke; desk-scene total moved to 69 scoped commits, 730M tokens, 52 hours, 438 kWh, roughly 0.27 trees cut, and about $640 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 74 repo sessions, counted 47 sessions after the revamp cutoff and 12 after the desk cutoff, and included the pending 3D layout-flow commit in the public labels.
- Sirui WebGL globe restoration: public total moved to 220 commits while rounded token, active-hour, energy, tree, API-cost, and CodexBar labels stayed unchanged; desk-scene public labels stayed unchanged.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 74 repo sessions, counted 47 sessions after the revamp cutoff and 12 after the desk cutoff, and included the pending Sirui globe commit in the public total.
- Agentic cost tooltip UX polish: public total moved to 221 commits, 1.8B tokens, 167 hours, 1080 kWh, roughly 0.7 trees, about $580 API cosplay, and about $1.6K on the CodexBar-ratio money joke; desk-scene total moved to 70 scoped commits, 740M tokens, 53 hours, 444 kWh, roughly 0.28 trees cut, about $230 API cosplay, and about $650 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py` after commit showed visible-label drift, then `python bin/audit_agentic_usage.py --write` scanned `C:\Users\dylan\.codex\sessions\2026`, found 74 repo sessions, counted 47 sessions after the revamp cutoff and 12 after the desk cutoff, and refreshed `_data/agentic_usage.yml`.
- Agentic usage refresh: public total moved to 222 commits, 1.81B tokens, 1086 kWh, and about $590 API cosplay; desk-scene rounded labels moved to 750M tokens, 450 kWh, and about $240 API cosplay while desk commits, hours, tree midpoint, and CodexBar labels stayed unchanged.
- Evidence: `python bin/audit_agentic_usage.py --write` after commit scanned `C:\Users\dylan\.codex\sessions\2026`, found 74 repo sessions, counted 47 sessions after the revamp cutoff and 12 after the desk cutoff, and refreshed `_data/agentic_usage.yml` before amending the counter commit.
- Dark 3D room texture pass: public total moved to 223 commits, 1.83B tokens, 169 hours, 1098 kWh, about $590 API cosplay, and about $1.6K on the CodexBar-ratio money joke; desk-scene total moved to 71 scoped commits, 770M tokens, 55 hours, 462 kWh, roughly 0.29 trees cut, about $250 API cosplay, and about $670 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` before commit and `python bin/audit_agentic_usage.py --write` after commit scanned `C:\Users\dylan\.codex\sessions\2026`, found 74 repo sessions, counted 47 sessions after the revamp cutoff and 12 after the desk cutoff, and refreshed the public labels for the room-texture commit.
- Desk room-return and pile-spread pass: public total moved to 227 commits, 1.87B tokens, 172 hours, 1122 kWh, about $610 API cosplay, and about $1.6K on the CodexBar-ratio money joke; desk-scene total moved to 72 scoped commits, 810M tokens, 58 hours, 486 kWh, roughly 0.3 trees cut, about $260 API cosplay, and about $710 on the CodexBar-ratio money joke.
- Evidence: `C:\Users\dylan\.conda\envs\dw\python.exe bin/audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 76 repo sessions, counted 49 sessions after the revamp cutoff and 14 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending desk-scene commit.
- Footer tally, album rack, and 2D card-lane pass: public total moved to 230 commits, 1.93B tokens, 175 hours, 1158 kWh, about $620 API cosplay, and about $1.7K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 73 commits, 870M tokens, 61 hours, 522 kWh, about $270 API cosplay, and about $760 on the CodexBar-ratio money joke.
- Evidence: `C:\Users\dylan\.conda\envs\dw\python.exe bin/audit_agentic_usage.py --write` after commit scanned `C:\Users\dylan\.codex\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the committed footer-tally, album-rack, and 2D card-lane milestone.
- Outside cutaway readability pass: public total moved to 232 commits, 1.94B tokens, 178 hours, 1164 kWh, about $630 API cosplay, and about $1.7K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 75 commits, 890M tokens, 64 hours, 534 kWh, about $280 API cosplay, and about $780 on the CodexBar-ratio money joke.
- Evidence: `C:\Users\dylan\.conda\envs\dw\python.exe bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md` scanned `C:\Users\dylan\.codex\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending outside-cutaway commit only.
- Desk HUD, focus, and paper-drop pass: public total moved to 234 commits, 1.96B tokens, 179 hours, 1176 kWh, about $630 API cosplay, and about $1.7K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 77 commits, 900M tokens, 64 hours, 540 kWh, roughly 0.3 trees cut, about $280 API cosplay, and about $780 on the CodexBar-ratio money joke.
- Evidence: `C:\Users\dylan\.conda\envs\dw\python.exe bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path _sass/_home.scss --pending-path docs/homepage-desk-scene-brief.md`, then a post-commit `C:\Users\dylan\.conda\envs\dw\python.exe bin/audit_agentic_usage.py --write`, scanned `C:\Users\dylan\.codex\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this desk HUD, focus, and paper-drop commit.
- Desk overlay and pile-grounding pass: public total moved to 236 commits, 1.97B tokens, 180 hours, 1182 kWh, about $630 API cosplay, and about $1.7K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 79 commits, 910M tokens, 66 hours, 546 kWh, roughly 0.3 trees cut, about $290 API cosplay, and about $790 on the CodexBar-ratio money joke.
- Evidence: `C:\Users\dylan\.conda\envs\dw\python.exe bin/audit_agentic_usage.py --write --include-pending-commit --pending-path _data/agentic_usage.yml --pending-path _includes/home/hero.liquid --pending-path _sass/_home.scss --pending-path docs/agentic-usage-ledger.md --pending-path docs/homepage-desk-scene-brief.md`, then a post-commit `C:\Users\dylan\.conda\envs\dw\python.exe bin/audit_agentic_usage.py --write`, scanned `C:\Users\dylan\.codex\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the desk overlay and pile-grounding commit.
- 3D album rack picking pass: public total moved to 237 commits, 1.98B tokens, 180 hours, 1188 kWh, about $640 API cosplay, and about $1.7K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 80 commits, 920M tokens, 66 hours, 552 kWh, roughly 0.3 trees cut, about $290 API cosplay, and about $800 on the CodexBar-ratio money joke.
- Evidence: `C:\Users\dylan\.conda\envs\dw\python.exe bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md --pending-path test/visual/interactions.spec.js --pending-path test/visual/playwright.config.js` scanned `C:\Users\dylan\.codex\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending 3D album rack picking commit.
- Desk paper physics and room-texture sync pass: public total moved to 238 commits, 2B tokens, 181 hours, 1200 kWh, about $640 API cosplay, and about $1.7K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 81 commits, 940M tokens, 67 hours, 564 kWh, roughly 0.4 trees cut, about $300 API cosplay, and about $820 on the CodexBar-ratio money joke.
- Evidence: `C:\Users\dylan\.conda\envs\dw\python.exe bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path _sass/_home.scss --pending-path _includes/home/hero.liquid --pending-path docs/homepage-desk-scene-brief.md --pending-path test/visual/interactions.spec.js`, then a post-commit `C:\Users\dylan\.conda\envs\dw\python.exe bin/audit_agentic_usage.py --write`, scanned `C:\Users\dylan\.codex\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this desk paper-physics and room-texture sync commit.
- 2D vinyl record legibility pass: public total moved to 240 commits while rounded total tokens, hours, energy, tree midpoint, API-cost, and CodexBar labels stayed unchanged; the path-scoped desk counter moved to 83 commits, 960M tokens, 68 hours, 576 kWh, roughly 0.4 trees cut, about $300 API cosplay, and about $840 on the CodexBar-ratio money joke.
- Evidence: `C:\Users\dylan\.conda\envs\dw\python.exe bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md` scanned `C:\Users\dylan\.codex\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending 2D vinyl record legibility commit.
- Rack-flick focus-clear pass: public total moved to 241 commits, 2.02B tokens, 1212 kWh, and roughly 0.8 trees while rounded total hours, API-cost, and CodexBar labels stayed unchanged; the path-scoped desk counter moved to 84 commits while rounded desk tokens, hours, energy, tree midpoint, API-cost, and CodexBar labels stayed unchanged.
- Evidence: `C:\Users\dylan\.conda\envs\dw\python.exe bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md --pending-path test/visual/interactions.spec.js` scanned `C:\Users\dylan\.codex\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending rack-flick focus-clear commit.
- Focused album and synced floor-pile pass: public total moved to 242 commits, 2.03B tokens, 183 hours, 1218 kWh, and roughly 0.8 trees while rounded public API-cost and CodexBar labels stayed unchanged; the path-scoped desk counter moved to 85 commits, 980M tokens, 69 hours, 588 kWh, roughly 0.4 trees cut, about $310 API cosplay, and about $850 on the CodexBar-ratio money joke.
- Evidence: `C:\Users\dylan\.conda\envs\dw\python.exe bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md` scanned `C:\Users\dylan\.codex\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending focused-album and synced floor-pile commit.
- Outside-view scroll-return pass: public total moved to 243 commits, 2.05B tokens, 184 hours, 1230 kWh, and about $660 API cosplay while rounded public tree midpoint and CodexBar labels stayed unchanged; the path-scoped desk counter moved to 86 commits, 990M tokens, 70 hours, 594 kWh, and about $860 on the CodexBar-ratio money joke while rounded desk tree midpoint and API-cost labels stayed unchanged.
- Evidence: `C:\Users\dylan\.conda\envs\dw\python.exe bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md --pending-path test/visual/interactions.spec.js` scanned `C:\Users\dylan\.codex\sessions\2026`, found 78 repo sessions, counted 51 sessions after the revamp cutoff and 16 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending outside-view scroll-return commit.
- A4 cards, album swap, and outside-coast pass: public total moved to 244 commits, 2.09B tokens, 186 hours, 1254 kWh, about $670 API cosplay, and about $1.8K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 87 commits, 1.03B tokens, 72 hours, 618 kWh, about $320 API cosplay, and about $900 on the CodexBar-ratio money joke while rounded tree midpoints stayed unchanged.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path _includes/home/hero.liquid --pending-path _sass/_home.scss --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md --pending-path test/visual/interactions.spec.js` scanned `C:\Users\dylan\.codex\sessions\2026`, found 80 repo sessions, counted 53 sessions after the revamp cutoff and 18 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending A4 card, album swap, outside-coast, and mobile card-tap commit.

### 2026-06-21

- Japandi cliff-house room and outside-polish pass: public total moved to 247 commits, 2.11B tokens, 188 hours, 1266 kWh, about $680 API cosplay, and about $1.8K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 90 commits, 1.05B tokens, 74 hours, 630 kWh, roughly 0.4 trees cut, about $330 API cosplay, and about $920 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path _data/citations.yml --pending-path _data/publication_lens.yml --pending-path _sass/_home.scss --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md --pending-path test/visual/interactions.spec.js` scanned `C:\Users\dylan\.codex\sessions\2026`, found 81 repo sessions, counted 54 sessions after the revamp cutoff and 19 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending 3D room/outside/cards commit.
- Scholar freshness gate: `python bin/update_scholar_citations.py --force` refreshed `_data/citations.yml` and `_data/publication_lens.yml` on June 21; total citations moved to 212 after the Physion citation count moved to 163.
- Long-run room/exterior improvement pass: public total moved to 251 commits, 2.17B tokens, 193 hours, 1302 kWh, about $700 API cosplay, and about $1.9K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 93 commits, 1.11B tokens, 79 hours, 666 kWh, roughly 0.4 trees cut, about $350 API cosplay, and about $970 on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md` scanned `C:\Users\dylan\.codex\sessions\2026`, found 82 repo sessions, counted 55 sessions after the revamp cutoff and 20 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending long-run room/exterior improvement commit.

### 2026-06-22

- Onsen lounge scene pass: public total moved to 257 commits, 2.27B tokens, 203 hours, 1362 kWh, about $730 API cosplay, and about $2.0K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 95 commits, 1.21B tokens, 89 hours, 726 kWh, roughly 0.5 trees cut, about $380 API cosplay, and about $1.1K on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md` scanned `C:\Users\dylan\.codex\sessions\2026`, found 84 repo sessions, counted 57 sessions after the revamp cutoff and 22 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending onsen lounge scene commit.
- Onsen/chair layout and window stability pass: public total moved to 258 commits, 2.28B tokens, 204 hours, 1368 kWh, and roughly 0.9 trees while the public API-cost and CodexBar labels stayed rounded at about $730 API cosplay and about $2.0K; the path-scoped desk counter moved to 96 commits, 1.23B tokens, 90 hours, 738 kWh, roughly 0.5 trees cut, about $390 API cosplay, and about $1.1K on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 84 repo sessions, counted 57 sessions after the revamp cutoff and 22 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending onsen/chair layout and window stability commit.
- Center-pinned room-view pass: public total moved to 260 commits, 2.3B tokens, 206 hours, 1380 kWh, about $740 API cosplay, and about $2.0K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 97 commits, 1.24B tokens, 92 hours, 744 kWh, roughly 0.5 trees cut, about $390 API cosplay, and about $1.1K on the CodexBar-ratio money joke.
- Evidence: `python bin\audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path _sass/_home.scss --pending-path docs/homepage-desk-scene-brief.md` scanned `C:\Users\dylan\.codex\sessions\2026`, found 86 repo sessions, counted 59 sessions after the revamp cutoff and 24 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending centered-room 3D commit.
- 3D room layout repair pass: public total moved to 261 commits, 2.32B tokens, 207 hours, 1392 kWh, about $740 API cosplay, and about $2.0K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 98 commits, 1.26B tokens, 93 hours, 756 kWh, roughly 0.5 trees cut, about $400 API cosplay, and about $1.1K on the CodexBar-ratio money joke.
- Evidence: `python bin\audit_agentic_usage.py --write --include-pending-commit`, then post-commit `python bin\audit_agentic_usage.py --write`, scanned `C:\Users\dylan\.codex\sessions\2026`, found 86 repo sessions, counted 59 sessions after the revamp cutoff and 24 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this room layout, album, A4 paper, onsen, chair, and centered-360 repair commit.
- Spacious rear-room yaw pass: public total moved to 262 commits, 2.33B tokens, 208 hours, 1398 kWh, about $750 API cosplay, and about $2.0K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 99 commits, 1.27B tokens, 94 hours, 762 kWh, roughly 0.5 trees cut, about $400 API cosplay, and about $1.1K on the CodexBar-ratio money joke.
- Evidence: `python bin\audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 86 repo sessions, counted 59 sessions after the revamp cutoff and 24 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this rear-room depth, full-yaw, and 180-degree interior-clearance commit.
- Cliff-cave room pass: public total moved to 263 commits, 2.35B tokens, 210 hours, 1410 kWh, about $750 API cosplay, and about $2.0K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 100 commits, 1.29B tokens, 96 hours, 774 kWh, roughly 0.5 trees cut, about $410 API cosplay, and about $1.1K on the CodexBar-ratio money joke.
- Evidence: `python bin\audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 87 repo sessions, counted 60 sessions after the revamp cutoff and 25 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this cave-room geometry, card-grounding, and cliff-cutaway commit.
- Scholar freshness gate: `python bin/update_scholar_citations.py --force` refreshed `_data/citations.yml` and `_data/publication_lens.yml` on June 22; citation counts moved to 165 for Physion, 35 for DesignWeaver, 15 for Hotspot, and 0 for the remaining tracked publications.
- Vinyl player visibility pass: public total moved to 264 commits, 2.36B tokens, 211 hours, 1416 kWh, about $760 API cosplay, and about $2.1K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 101 commits, 1.3B tokens, 97 hours, and 780 kWh while rounded desk tree midpoint, API-cost, and CodexBar labels stayed unchanged.
- Evidence: `python bin\audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 87 repo sessions, counted 60 sessions after the revamp cutoff and 25 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this visible turntable and rear-left album-niche commit.

### 2026-06-23

- Vinyl tonearm and wall-mounted album-shelf pass: public total moved to 265 commits and 213 hours while rounded public tokens, energy, tree midpoint, API-cost, and CodexBar labels stayed unchanged; the path-scoped desk counter moved to 102 commits, 1.31B tokens, 99 hours, and 786 kWh while rounded desk tree midpoint, API-cost, and CodexBar labels stayed unchanged.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path assets/js/home.js --pending-path docs/homepage-desk-scene-brief.md` scanned `C:\Users\dylan\.codex\sessions\2026`, found 87 repo sessions, counted 60 sessions after the revamp cutoff and 25 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending tonearm and opposite-wall shelf commit.

### 2026-06-27

- Homepage desk-scene reference brief: public total moved to 269 commits, 216 hours, and about $770 API cosplay while rounded public tokens, energy, tree midpoint, and CodexBar labels stayed unchanged; the path-scoped desk counter moved to 103 commits, 1.33B tokens, 102 hours, and 798 kWh while rounded desk tree midpoint, API-cost, and CodexBar labels stayed unchanged.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 90 repo sessions, counted 63 sessions after the revamp cutoff and 28 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending desk-scene reference commit.
- Remote Prettier follow-up: public total moved to 270 commits, 2.39B tokens, and 1434 kWh while rounded public hours, tree midpoint, API-cost, and CodexBar labels stayed unchanged; the path-scoped desk counter stayed at 103 commits, 1.33B tokens, 102 hours, and 798 kWh.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 90 repo sessions, counted 63 sessions after the revamp cutoff and 28 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending YAML-formatting follow-up.

### 2026-06-29

- Repo-local Codex skills conversion: public total moved to 272 commits, 2.41B tokens, 219 hours, 1446 kWh, about $770 API cosplay, and about $2.1K on the CodexBar-ratio money joke; the path-scoped desk counter moved to 104 commits, 1.35B tokens, 105 hours, 810 kWh, about $430 API cosplay, and about $1.2K on the CodexBar-ratio money joke while rounded tree midpoints stayed unchanged.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 92 repo sessions, counted 65 sessions after the revamp cutoff and 30 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending repo-local skill conversion commit.

### 2026-06-30

- Narrow reading-aid pass: public total moved to 282 commits, 2.48B tokens, 228 hours, 1488 kWh, about $800 API cosplay, and about $2.2K on the CodexBar-ratio money joke; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.42B tokens, 114 hours, and 852 kWh.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 93 repo sessions, counted 66 sessions after the revamp cutoff and 31 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending narrow reading-aid commit.

### 2026-07-01

- Reading-aid balance follow-up: public total moved to 283 commits, 2.49B tokens, 229 hours, and 1494 kWh while rounded API-cost, tree midpoint, and CodexBar labels stayed at about $800 API cosplay, roughly 0.9 trees, and about $2.2K; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.43B tokens, 115 hours, and 858 kWh.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 93 repo sessions, counted 66 sessions after the revamp cutoff and 31 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending reading-aid balance commit.

### 2026-07-03

- Sirui fruit-gate pass plus remote Prettier follow-up: public total moved to 285 commits, 2.5B tokens, 230 hours, and 1500 kWh while rounded API-cost, tree midpoint, and CodexBar labels stayed at about $800 API cosplay, roughly 0.9 trees, and about $2.2K; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.44B tokens, 116 hours, 864 kWh, about $460 API cosplay, and about $1.3K on the CodexBar-ratio money joke.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 94 repo sessions, counted 67 sessions after the revamp cutoff and 32 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for the pending Sirui fruit-gate and formatter-fix commits.

### 2026-07-04

- Sirui fruit-gate art polish: public total moved to 286 commits, 2.51B tokens, 232 hours, 1506 kWh, and about $810 API cosplay while rounded tree midpoint and CodexBar labels stayed at roughly 0.9 trees and about $2.2K; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.45B tokens, 118 hours, and 870 kWh.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 94 repo sessions, counted 67 sessions after the revamp cutoff and 32 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending Sirui fruit-gate art polish commit.

### 2026-07-05

- Don Norman reading-note publish: public total moved to 287 commits, 2.52B tokens, 233 hours, and 1512 kWh while rounded tree midpoint, API-cost, and CodexBar labels stayed unchanged; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.46B tokens, 119 hours, and 876 kWh.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned `C:\Users\dylan\.codex\sessions\2026`, found 95 repo sessions, counted 68 sessions after the revamp cutoff and 33 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending content commit.

### 2026-07-06

- Don Norman reading-note CI follow-up: public total moved to 288 commits, 2.53B tokens, 234 hours, and 1518 kWh while rounded tree midpoint, API-cost, and CodexBar labels stayed unchanged; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.47B tokens, 120 hours, 882 kWh, and about $470 API cosplay.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path .github/workflows/visual-regression.yml --pending-path _data/agentic_usage.yml --pending-path _posts/2026-03-04-don-norman-design-lab-talk.md --pending-path _posts/2026-05-13-prototyping-to-understand-humans.md --pending-path _posts/2026-07-05-specialists-generalists-ai-distributed-cognition.md --pending-path docs/agentic-usage-ledger.md` scanned `C:\Users\dylan\.codex\sessions\2026`, found 95 repo sessions, counted 68 sessions after the revamp cutoff and 33 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending CI-formatting and visual-baseline commit.
- Customized visual-subset CI repair: public total moved to 289 commits, 2.54B tokens, 236 hours, and 1524 kWh while rounded tree midpoint, API-cost, and CodexBar labels stayed unchanged; the path-scoped desk counter stayed at 107 commits, while retained-session desk-window totals moved to 1.49B tokens, 122 hours, 894 kWh, and about $470 API cosplay.
- Evidence: `python bin/audit_agentic_usage.py --write --include-pending-commit --pending-path .github/workflows/visual-regression.yml --pending-path _data/agentic_usage.yml --pending-path _posts/2026-03-04-don-norman-design-lab-talk.md --pending-path _posts/2026-05-13-prototyping-to-understand-humans.md --pending-path _posts/2026-07-05-specialists-generalists-ai-distributed-cognition.md --pending-path docs/agentic-usage-ledger.md` scanned `C:\Users\dylan\.codex\sessions\2026`, found 95 repo sessions, counted 68 sessions after the revamp cutoff and 33 after the desk cutoff, and refreshed `_data/agentic_usage.yml` for this pending customized visual-subset and Markdown-formatting commit.

## Future Entry Template

### YYYY-MM-DD

- Work scope:
- Commit delta:
- Token delta:
- Active-hour delta:
- Energy/cut-tree delta:
- Evidence:
- Updated public totals:
