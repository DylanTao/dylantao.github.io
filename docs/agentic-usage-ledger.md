# Agentic Usage Ledger

This ledger keeps the visible homepage AI-work counters honest enough to be useful without pretending the old runs were measured perfectly.

## Public Data File

The homepage reads `_data/agentic_usage.yml`.

Update that file when a future Codex or agentic run materially changes this site, especially if the work touches homepage visuals, custom layouts, custom scripts, publications/CV polish, or the 3D desk scene.

## Current Baseline

Cutoff for the full site revamp: May 22, 2026 at 6:05 PM Pacific, the first clear homepage redesign commit.

Published total baseline, estimated on June 18, 2026:

- 182 commits since the revamp cutoff.
- 1.36B estimated Codex tokens.
- 135 estimated active agent-hours.
- Energy lens: about 816 kWh, 305 kg CO2e, or 5.1 urban-tree years of CO2 absorption. Range: 1.7-16.9 tree-years.

Evidence behind the total:

- Retained local Codex session logs for this repo, deduped by `session_meta.payload.id`, show 1,255,985,046 total tokens and 125.15 active hours across 40 sessions.
- Those logs begin on May 23, 2026 at about 9:40 PM Pacific, so the first redesign day is partly missing.
- The missing pre-log stretch covers about 13 revamp commits. The baseline adds a rough 100M tokens and 10 active hours for that gap, using the observed post-log token/hour density per commit.

Cutoff for the 3D desk/vinyl counter: June 16, 2026 at 8:00 PM Pacific, when the meme-record and desk-scene burst began.

Published 3D desk baseline:

- 35 commits touching the homepage desk/vinyl/coffee scene paths.
- 350M estimated Codex tokens.
- 25 estimated active agent-hours.
- Energy lens: about 210 kWh, 78 kg CO2e, or 1.3 urban-tree years of CO2 absorption. Range: 0.4-4.4 tree-years.

Evidence behind the 3D desk baseline:

- Relevant commit paths: `assets/js/home.js`, `_sass/_home.scss`, `_includes/home/hero.liquid`, `docs/homepage-desk-scene-brief.md`, and `assets/img/home`.
- Deduped local Codex sessions after the 3D cutoff show 348,933,378 total tokens and 24.92 active hours, rounded for the public UI.

## Energy and Tree-Year Equivalence

The public page uses "urban-tree years of CO2 absorption" instead of "trees cut down." Literal cut-tree equivalence depends on species, tree age, wood fate, land-use assumptions, and whether carbon is released immediately or over time.

The midpoint calculation uses:

```text
kWh = token_count * Wh_per_token / 1000
kg_CO2e = kWh * 0.373
tree_years = kg_CO2e / 60
```

Factors:

- Token energy midpoint: `0.0006 Wh/token`, derived from Epoch AI's rough GPT-4o estimate of `0.3 Wh` for a 500-output-token query.
- Token energy range: `0.0002-0.002 Wh/token`, used because Codex logs combine cached, input, output, and reasoning tokens, and true inference energy is not exposed.
- Grid emissions: `0.373 kg CO2e/kWh`, converted from EPA's `823.1 lb CO2e/MWh` electricity factor.
- Tree-year absorption: `0.060 metric tons CO2 per urban tree planted per year`, from EPA's greenhouse gas equivalencies methodology.

Sources:

- Epoch AI, "How much energy does ChatGPT use?": https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use
- EPA Greenhouse Gas Equivalencies Calculator calculations and references: https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator-calculations-and-references

## Update Heuristic

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
- Use whole hours once the value is above 10 hours.
- Keep exact-ish evidence in this markdown file, not in the homepage UI.

7. Update `_data/agentic_usage.yml` and append a dated note here when the estimate changes materially.

8. Recompute the energy equivalence from the token totals using the formula above. Keep public copy framed as an estimate with a range.

## Future Entry Template

### YYYY-MM-DD

- Work scope:
- Commit delta:
- Token delta:
- Active-hour delta:
- Energy/tree-year delta:
- Evidence:
- Updated public totals:
