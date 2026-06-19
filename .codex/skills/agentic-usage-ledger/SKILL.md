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
   - midpoint `Wh_per_token = 0.0006`
   - range `Wh_per_token = 0.0002-0.002`
9. Frame the public environmental copy as "urban-tree years of CO2 absorption," not literal "trees cut down."

## Scope Rules

- Full site revamp counter starts at May 22, 2026 6:05 PM Pacific.
- 3D desk/vinyl counter starts at June 16, 2026 8:00 PM Pacific.
- Update the 3D counter only for the homepage vinyl/desk/coffee/3D-scene work.
- Keep energy/tree-year copy understated and caveated; true Codex inference energy is not exposed in the logs.
