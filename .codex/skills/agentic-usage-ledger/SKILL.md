# Agentic Usage Ledger

Use this skill when updating, auditing, or displaying Codex/agentic usage counters for this customized `dylantao.github.io` site.

## Workflow

1. Read `docs/agentic-usage-ledger.md` and `_data/agentic_usage.yml`.
2. Keep the visible homepage numbers powered by `_data/agentic_usage.yml`; do not hardcode duplicate totals in templates.
3. Recount commits after the relevant work is committed when possible.
4. Estimate Codex tokens from retained local session logs:
   - include sessions whose `session_meta.payload.cwd` contains `dylantao.github.io`;
   - dedupe by `session_meta.payload.id`;
   - use the latest/highest `payload.info.total_token_usage.total_tokens` from `event_msg` entries where `payload.type` is `token_count`.
5. Estimate active agent-hours by summing session timestamp gaps with each gap capped at 45 minutes.
6. If logs are missing, use a conservative commit-density estimate and record that assumption in `docs/agentic-usage-ledger.md`.
7. Round public labels for readability, but keep the evidence trail in markdown.
8. Recompute energy equivalence whenever token totals change:
   - `kWh = token_count * Wh_per_token / 1000`
   - `kg_CO2e = kWh * 0.373`
   - `tree_years = kg_CO2e / 60`
   - `cut_tree_equivalent = kg_CO2e / 600`
   - midpoint `Wh_per_token = 0.0006`
   - range `Wh_per_token = 0.0002-0.002`
   - cut-tree basis `600 kg CO2e`, derived from EPA's urban-tree annual sequestration over 10 years.
9. Frame public environmental copy as a "tree-cut lens" only when it is a stored-carbon equivalence. Do not imply instant emissions from cutting a tree, and do not round small values up to one tree.

## Scope Rules

- Full site revamp counter starts at May 22, 2026 6:05 PM Pacific.
- 3D desk/vinyl counter starts at June 16, 2026 8:00 PM Pacific.
- Update the 3D counter only for the homepage vinyl/desk/coffee/3D-scene work.
- Keep energy/cut-tree copy understated and caveated; true Codex inference energy is not exposed in the logs, and tree carbon varies by species, age, wood fate, roots, soil, and future growth.
