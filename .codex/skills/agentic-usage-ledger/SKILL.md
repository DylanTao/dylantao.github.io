# Agentic Usage Ledger

Use this skill when updating, auditing, or displaying Codex/agentic usage counters for this customized `dylantao.github.io` site.

## Workflow

1. Read `docs/agentic-usage-ledger.md` and `_data/agentic_usage.yml`.
2. Keep the visible homepage numbers powered by `_data/agentic_usage.yml`; do not hardcode duplicate totals in templates.
   - The homepage contact ledger renders a playful tree-sacrifice caption above compact stat cells for tokens, agent-hours, commits, and estimated kWh.
   - Keep conversion detail and cutoff context in `docs/agentic-usage-ledger.md` and the small homepage info tooltip, not as extra paragraphs under the stats.
3. Before pushing this customized site, run the publish freshness gate:
   - rely on the daily Google Scholar workflow for routine citation freshness;
   - refresh Scholar locally with `python bin/update_scholar_citations.py --force` only when `_data/citations.yml` is more than one day stale or publication pages changed;
   - before the final commit, run `python bin/audit_agentic_usage.py --write --include-pending-commit` so the helper can estimate the pending commit and update `_data/agentic_usage.yml`;
   - after committing, rerun `python bin/audit_agentic_usage.py` read-only and update the ledger again only if visible labels, commit counts, rounded hours, rounded energy/tree, or rounded cost labels changed.
4. Recount commits after the relevant work is committed when possible. Prefer the read-only helper over ad hoc scripts:
   - `python bin/audit_agentic_usage.py`
5. Estimate Codex tokens from retained local session logs:
   - include sessions whose `session_meta.payload.cwd` contains `dylantao.github.io`;
   - dedupe by `session_meta.payload.id`;
   - use cumulative `payload.info.total_token_usage.total_tokens` snapshots from `event_msg` entries where `payload.type` is `token_count`;
   - clip or conservatively apportion sessions that cross a counter cutoff.
6. Estimate active agent-hours by summing session timestamp gaps with each gap capped at 45 minutes.
7. If logs are missing, use a conservative commit-density estimate and record that assumption in `docs/agentic-usage-ledger.md`.
8. Round public labels for readability, but keep the evidence trail in markdown.
9. Recompute energy equivalence whenever token totals change:
   - `kWh = token_count * Wh_per_token / 1000`
   - `kg_CO2e = kWh * 0.373`
   - `tree_years = kg_CO2e / 60`
   - `cut_tree_equivalent = kg_CO2e / 600`
   - midpoint `Wh_per_token = 0.0006`
   - range `Wh_per_token = 0.0002-0.002`
   - cut-tree basis `600 kg CO2e`, derived from EPA's urban-tree annual sequestration over 10 years.
10. Recompute both cost lenses whenever token totals change:

- use `gpt-5.3-codex` standard API rates stored in `_data/agentic_usage.yml`;
- compute `(input_tokens - cached_input_tokens) * input_rate + cached_input_tokens * cached_rate + output_tokens * output_rate`;
- keep that as API-cost equivalence only, not actual Codex product spend;
- compute `codexbar_cost_estimate` from the local CodexBar screenshot ratio `$2,616.40 / 3B tokens = ~$0.872 per 1M tokens`;
- use the CodexBar-ratio label for the public `Sam's money waste so far` tooltip joke, with a caveat that it is not an actual bill.

11. Frame public environmental copy as a "tree-cut lens" only when it is a stored-carbon equivalence. Do not imply instant emissions from cutting a tree, and do not round small values up to one tree.

## Scope Rules

- Full site revamp counter starts at May 22, 2026 6:05 PM Pacific.
- 3D desk/vinyl counter starts at June 16, 2026 8:00 PM Pacific.
- Update the 3D counter only for the homepage vinyl/desk/coffee/3D-scene work.
- Keep energy/cut-tree copy understated and caveated; true Codex inference energy is not exposed in the logs, and tree carbon varies by species, age, wood fate, roots, soil, and future growth.
