---
name: agentic-usage-ledger
description: Update, audit, and display Codex or agentic usage counters for this customized DylanTao/Sirui `dylantao.github.io` site. Use when touching account-lifetime or local Codex tokens, agent-hours, commits, energy, tree-equivalence, API-rate estimates, freshness hooks, `_data/agentic_usage.yml`, `docs/agentic-usage-ledger.md`, or the homepage usage counter, especially before committing or pushing site changes.
---

# Agentic Usage Ledger

Use this skill when updating, auditing, or displaying Codex/agentic usage counters for this customized `dylantao.github.io` site.

## Workflow

1. Read `docs/agentic-usage-ledger.md` and `_data/agentic_usage.yml`.
2. Keep the visible homepage numbers powered by `_data/agentic_usage.yml`; do not hardcode duplicate totals in templates.
   - The homepage contact ledger renders the quiet `Build ledger · since …` caption above four compact stat cells for site-build tokens, agent-hours, commits, and estimated kWh; do not restore the former tree-sacrifice headline.
   - The token cell may carry one focusable price-replay disclosure sourced only from `total.api_cost_equivalence.usd_label`. Label it as a Standard public-API rate replay of retained site-build logs, not an actual Codex bill, and note that unavailable cache-write tokens are excluded.
   - Never price or visually associate that disclosure with the independent rounded combined-lifetime heartbeat. Keep conversion detail and cutoff context in `docs/agentic-usage-ledger.md` and the compact disclosure, not as extra paragraphs or a fifth stat cell.
3. Before pushing this customized site, run the publish freshness gate:
   - rely on the daily Google Scholar workflow for routine citation freshness;
   - refresh Scholar locally with `python bin/update_scholar_citations.py --force` only when `_data/citations.yml` is more than one day stale or publication pages changed;
   - before the final commit, run `python bin/audit_agentic_usage.py --write --include-pending-commit` so the helper can estimate the pending commit and update `_data/agentic_usage.yml`;
   - immediately format the generated ledger with `npx.cmd prettier _data/agentic_usage.yml --write`, then review and stage only the intended files;
   - after committing, rerun `python bin/audit_agentic_usage.py` read-only and update the ledger again only if visible labels, commit counts, rounded hours, rounded energy/tree, or rounded cost labels changed.
4. Recount commits after the relevant work is committed when possible. Prefer the read-only helper over ad hoc scripts:
   - `python bin/audit_agentic_usage.py`
   - The helper fails closed in a shallow checkout. Fetch complete history before checking or writing; never accept shallow `git rev-list` counts as ledger truth.
5. Establish the source hierarchy, then estimate scoped Codex tokens:
   - Direct account publication is one anonymous rounded combined lifetime total. `_data/direct_usage_tracker.json` is primary for that surface; it exposes no source-level readings and is never added to retained-session estimates.
   - For repo-attributed usage, scan every retained year under `~/.codex/sessions` and include a JSONL file when its **first** `session_meta.payload.cwd` contains `dylantao.github.io`; the first `session_meta.payload.id` is the leaf session identity, while later copied parent metadata is ancestry.
   - read ordered `turn_context` records for `turn_id`, `model`, and `effort` attribution;
   - globally dedupe copied ancestry by `(turn_id, full total_token_usage snapshot)`, keeping the earliest retained event;
   - sum unique `payload.info.last_token_usage` deltas; use positive cumulative deltas only as a conservative fallback for legacy events without additive usage;
   - keep missing-context usage visible as `unknown/unknown` rather than inventing model attribution.
   - Publish `local_lifetime` as a separate fork-aware retained-device slice across every local leaf session since Jun 19, 2026. Treat this cumulative evidence as monotonic: preserve the last audited snapshot when a scan is empty or lower, and refresh only from a nondecreasing complete-enough retained archive. Its roughly 7.7B-token checkpoint is not account lifetime.
   - Never promote Win-CodexBar 0.42 raw 30-day totals to canonical evidence. They count files/forks and cumulative snapshots, which duplicates copied ancestry and intermediate totals.
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
10. Recompute and keep the price estimates separate whenever token totals change:

- local `api_cost_equivalence` replays retained requests using current Standard API rates; any rendered amount comes from its generated `usd_label` rather than a hardcoded estimate;
- `gpt-5.5` and `gpt-5.6-sol` use the same short-context rates: $5 / 1M uncached input, $0.50 / 1M cached-read input, and $30 / 1M output;
- when a request has more than 272,000 input tokens, use the long-context rates of $10 / 1M uncached input, $1 / 1M cached-read input, and $45 / 1M output;
- `xhigh` and `ultra` do not add a separate price; they are effort labels, not pricing tiers;
- the schema-3 rounded combined-lifetime evidence never receives a request-aware cost field or API-cost conversion; Build Rhythm may show only the separately named `hypothetical_mix_matched_api_rate_replay` thought experiment, scaled from `local_lifetime.api_cost_equivalence.priced_token_usage.total_tokens` rather than the raw local total, with its mix assumptions, Standard API pricing source and date, unsupported-model and cache-write exclusions, and explicit not-an-actual-bill caveat;
- record the documented `gpt-5.6-sol` cache-write rates, but do not apply them because retained logs do not identify cache-write tokens;
- retain the former `gpt-5.3-codex` math as `legacy_api_cost_equivalence` for historical comparison only;
- retain `codexbar_cost_estimate` only as historical diagnostic provenance; never render it or use it to price current public stats.
- Treat every dollar figure as an API-rate estimate, never an actual Codex product, subscription, or account bill.

11. Keep `model_tracking` tied to the declared development default `gpt-5.6-sol` / `ultra` from `2026-07-09T21:28:23.394Z`. Build this policy check from the deduplicated all-local retained context inventory, even when repo-cwd session attribution is unavailable; site usage scopes remain repo-filtered and preserve their last audited nonzero snapshot. Render every deviation truthfully. Accept one only when its exact `(turn_id, timestamp, model, effort)` signature has a per-turn reason and provenance in the versioned in-repo acknowledgment mapping; never add a blanket flag or environment bypass. `--check` must fail on `unobserved` tracking or any unacknowledged deviation, so every new deviation fails closed. Keep the homepage model note data-driven from `model_tracking.public_note` and treat it as the declared current default, not a claim of perfect historical alignment.

12. Frame public environmental copy as a "tree-cut lens" only when it is a stored-carbon equivalence. Do not imply instant emissions from cutting a tree, and do not round small values up to one tree.

## Scope Rules

- Full site revamp counter starts at May 22, 2026 6:05 PM Pacific.
- `_data/direct_usage_tracker.json` is the only public direct-account surface and contains one rounded combined lifetime total plus terse provenance, with no source-level readings.
- Retained local history starts at June 19, 2026 12:00 AM Pacific and spans every locally retained Codex session after global ancestry deduplication. Keep its session count and model mix visible in the data file, label its request-aware price replay as an estimate rather than a bill, and never present this retained slice as account lifetime.
- Win-CodexBar 0.42 raw 30-day aggregation is diagnostic provenance only, not a canonical usage or price source.
- 3D desk/vinyl counter starts at June 16, 2026 8:00 PM Pacific.
- Keep 3D commit counts path-scoped to the homepage vinyl/desk/coffee/3D-scene work. Its token and hour labels are explicitly an all-repo retained-session time-window estimate after the desk cutoff, not desk-only attribution.
- Keep energy/cut-tree copy understated and caveated; true Codex inference energy is not exposed in the logs, and tree carbon varies by species, age, wood fate, roots, soil, and future growth.
