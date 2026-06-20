# Agentic Usage Ledger

This ledger keeps the visible homepage AI-work counters honest enough to be useful without pretending the old runs were measured perfectly.

## Public Data File

The homepage reads `_data/agentic_usage.yml`.

Update that file when a future Codex or agentic run materially changes this site, especially if the work touches homepage visuals, custom layouts, custom scripts, publications/CV polish, or the 3D desk scene.

The homepage contact ledger should render the playful tree-sacrifice estimate in the top caption, then four compact stat cells for tokens, agent-hours, commits, and estimated kWh. Keep detailed conversion caveats in this document and in the small homepage info tooltip, not as extra ledger paragraphs. The headline line may use light archaic copy, but the numbers and tooltip math should stay plain.

## Current Baseline

Cutoff for the full site revamp: May 22, 2026 at 6:05 PM Pacific, the first clear homepage redesign commit.

Published total baseline, estimated on June 19, 2026:

- 219 commits since the revamp cutoff, including the Sam meme split-tooltip polish milestone.
- 1.79B estimated Codex tokens.
- 166 estimated active agent-hours.
- Public money joke: about $1.6K from the CodexBar screenshot ratio, treated as a local estimate rather than an actual bill.
- API-cost reference: about $580 at `gpt-5.3-codex` list prices, kept as API cosplay rather than an actual Codex bill.
- Tree-cut lens: about 1074 kWh, 401 kg CO2e, or a stored-carbon equivalent of about 0.7 ten-year urban trees. Range: 0.22-2.2 trees.

Evidence behind the total:

- `python bin/audit_agentic_usage.py --write --include-pending-commit` scanned retained local Codex session logs for this repo, deduped by `session_meta.payload.id`, and counted 47 sessions after the revamp cutoff.
- The audit showed about 1.787B raw tokens and 165.66 active hours after clipping sessions to the cutoff and including the pending milestone commit, then rounded those values for the public UI.
- The audit tracks input, cached input, output, reasoning-output, and total tokens; interpolates token snapshots for sessions crossing a cutoff; and caps timestamp gaps at 45 minutes to avoid counting long idle periods.
- The public money joke uses the CodexBar screenshot ratio `$2,616.40 / 3B tokens = ~$0.872 per 1M tokens`, applied to the rounded public token count.

Cutoff for the 3D desk/vinyl counter: June 16, 2026 at 8:00 PM Pacific, when the meme-record and desk-scene burst began.

Published 3D desk baseline:

- 69 commits touching the homepage desk/vinyl/coffee scene paths, including the Sam meme split-tooltip polish milestone.
- 730M estimated Codex tokens.
- 52 estimated active agent-hours.
- Public money joke reference: about $640 from the CodexBar screenshot ratio.
- API-cost reference: about $230 at `gpt-5.3-codex` list prices, kept as API cosplay rather than an actual Codex bill.
- Tree-cut lens: about 438 kWh, 163 kg CO2e, or a stored-carbon equivalent of about 0.27 ten-year urban trees. Range: 0.09-0.9 trees.

Evidence behind the 3D desk baseline:

- Relevant commit paths: `assets/js/home.js`, `_sass/_home.scss`, `_includes/home/hero.liquid`, `docs/homepage-desk-scene-brief.md`, and `assets/img/home`.
- The audit counted 12 Codex sessions after the 3D cutoff, about 729.2M raw tokens, and about 51.60 active hours, rounded for the public UI.

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
- Commit delta: public total moved from 182 to 219 revamp commits; desk-scene total moved from 35 to 69 scoped commits.
- Token delta: public total moved from 1.36B to 1.79B; desk-scene total moved from 350M to 730M.
- Active-hour delta: public total moved from 135 to 166 hours; desk-scene total moved from 25 to 52 hours.
- Energy/cut-tree delta: public total moved from 816 kWh / ~0.5 tree to 1074 kWh / ~0.7 tree; desk-scene total moved from 210 kWh / ~0.13 tree to 438 kWh / ~0.27 tree.
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

## Future Entry Template

### YYYY-MM-DD

- Work scope:
- Commit delta:
- Token delta:
- Active-hour delta:
- Energy/cut-tree delta:
- Evidence:
- Updated public totals:
