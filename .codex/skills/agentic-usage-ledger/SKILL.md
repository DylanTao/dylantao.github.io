---
name: agentic-usage-ledger
description: Update, audit, and display Codex or agentic usage counters for this customized DylanTao/Sirui `dylantao.github.io` site. Use when touching homepage Codex token, agent-hour, commit, energy, tree-equivalence, API-cost, CodexBar-ratio money-joke labels, freshness hooks, `_data/agentic_usage.yml`, `docs/agentic-usage-ledger.md`, or the homepage usage counter, especially before committing or pushing site changes.
---

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
   - immediately format the generated ledger with `npx prettier _data/agentic_usage.yml --write`, then review and stage only the intended files;
   - after committing, rerun `python bin/audit_agentic_usage.py` read-only and update the ledger again only if visible labels, commit counts, rounded hours, rounded energy/tree, or rounded cost labels changed.
4. Recount commits after the relevant work is committed when possible. Prefer the read-only helper over ad hoc scripts:
   - `python bin/audit_agentic_usage.py`
5. Estimate Codex tokens from every retained year under `~/.codex/sessions`:
   - include a JSONL file when its **first** `session_meta.payload.cwd` contains `dylantao.github.io`; the first `session_meta.payload.id` is the leaf session identity, while later copied parent metadata is ancestry;
   - read ordered `turn_context` records for `turn_id`, `model`, and `effort` attribution;
   - globally dedupe copied ancestry by `(turn_id, full total_token_usage snapshot)`, keeping the earliest retained event;
   - sum unique `payload.info.last_token_usage` deltas; use positive cumulative deltas only as a conservative fallback for legacy events without additive usage;
   - keep missing-context usage visible as `unknown/unknown` rather than inventing model attribution.
6. Estimate active agent-hours from the globally unique context and token-event timeline for each leaf session. Cap each gap at 45 minutes, keep parallel leaf sessions additive, and attribute a gap to the model/effort active at its start.
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
10. Recompute all three price lenses whenever token totals change:

- `api_cost_equivalence` uses each logged model's Standard short-context rates: `gpt-5.5` and `gpt-5.6-sol` at $5 / 1M uncached input, $0.50 / 1M cached-read input, and $30 / 1M output;
- record the documented `gpt-5.6-sol` $6.25 / 1M cache-write input rate, but do not apply it because retained logs do not identify cache-write tokens;
- do not infer a long-context threshold or actual Codex billing;
- retain the former `gpt-5.3-codex` math as `legacy_api_cost_equivalence` for historical comparison only;
- keep `codexbar_cost_estimate` separate, using the local screenshot ratio `$2,616.40 / 3B tokens = ~$0.872 per 1M tokens` for the public `Sam's money waste so far` joke.

11. Keep `model_tracking` aligned to the declared development default `gpt-5.6-sol` / `ultra` from `2026-07-09T21:28:23.394Z`. `--check` must fail if a retained post-cutover `turn_context` deviates, and report `unobserved` rather than `aligned` when no post-cutover contexts remain. Keep the homepage model note data-driven from `model_tracking.public_note`.

12. Frame public environmental copy as a "tree-cut lens" only when it is a stored-carbon equivalence. Do not imply instant emissions from cutting a tree, and do not round small values up to one tree.

## Scope Rules

- Full site revamp counter starts at May 22, 2026 6:05 PM Pacific.
- 3D desk/vinyl counter starts at June 16, 2026 8:00 PM Pacific.
- Keep 3D commit counts path-scoped to the homepage vinyl/desk/coffee/3D-scene work. Its token and hour labels are explicitly an all-repo retained-session time-window estimate after the desk cutoff, not desk-only attribution.
- Keep energy/cut-tree copy understated and caveated; true Codex inference energy is not exposed in the logs, and tree carbon varies by species, age, wood fate, roots, soil, and future growth.
