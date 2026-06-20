# Agent Guidelines for al-folio (v1.x)

`al-folio` is the starter repo for the pluginized v1 architecture. This customized fork also carries Dylan/Sirui site-specific content, layouts, analytics, SEO, and interaction overrides.

## Read This First

- Start with `.github/copilot-instructions.md` for architecture, ownership boundaries, and CI expectations.
- Use `.codex/skills/al-folio-upstream-sync/SKILL.md` before syncing upstream al-folio into this customized site.
- Use `docs/BOUNDARIES.md` as the source of truth for starter-vs-plugin ownership.
- Use `.agents/skills/al-folio-bootstrap/SKILL.md` for new-site setup tasks.
- Use `.agents/skills/al-folio-v1-migration/SKILL.md` when planning a full customized-fork migration.
- Use `.codex/skills/agentic-usage-ledger/SKILL.md` when updating Codex token, agent-hour, or commit counters for this customized site.
- Use `.github/agents/customize.agent.md` for site customization work.
- Use `.github/agents/docs.agent.md` for documentation work.

## What This Repo Owns

- Starter wiring (`Gemfile`, `_config.yml`)
- Starter content and documentation
- Cross-plugin integration tests
- Visual regression tests
- This fork's site identity, content, analytics, SEO, custom layouts, custom scripts, and custom assets

Runtime/component logic belongs in owning plugin repos (`al_folio_core`, `al_folio_distill`, `al_search`, `al_icons`, `al_cookie`, and other `al-*` gems). Local overrides are valid when they are intentional site customizations.

## Validated Local Command Set

Run from repo root:

```bash
npm ci
npm run lint:prettier
npm run lint:style-contract
bundle exec jekyll build --baseurl /al-folio
bash test/integration_comments.sh
bash test/integration_plugin_toggles.sh
bash test/integration_distill.sh
bash test/integration_bootstrap_compat.sh
bash test/integration_upgrade_cli.sh
npx playwright install chromium webkit
npm run test:visual
bundle exec al-folio upgrade audit
bundle exec al-folio upgrade overrides audit
bundle exec al-folio upgrade report
docker compose up -d
curl -fsS http://127.0.0.1:8080/al-folio/ >/dev/null
docker compose logs --tail=80
docker compose down
```

For this customized personal site, also verify `http://localhost:8080/` with empty `baseurl`.

## Publish Freshness Gate

Before pushing changes to this customized site:

- Use `.codex/skills/agentic-usage-ledger/SKILL.md` and `docs/agentic-usage-ledger.md` for the homepage Codex token, agent-hour, commit, energy, and tree-equivalence counters.
- Google Scholar runs daily in `.github/workflows/update-citations.yml`; locally run `python bin/update_scholar_citations.py --force` only if `_data/citations.yml` is more than one day stale or publication pages changed.
- Before the final commit, run `python bin/audit_agentic_usage.py --write --include-pending-commit`; the helper estimates the pending commit and updates `_data/agentic_usage.yml`.
- After commit, rerun `python bin/audit_agentic_usage.py` read-only; update the ledger again only if visible labels, commit counts, rounded hours, rounded energy/tree, or rounded cost labels changed.
- Stage only intended files; do not sweep unrelated dirty files into a stats refresh.

## Agent Routing Rules

- If change is starter wiring/docs/integration/visual testing: edit here.
- If change is runtime feature behavior shared by al-folio users: route to the owning plugin repo.
- If change is Dylan/Sirui site identity, content, analytics, SEO, custom layouts, custom scripts, or custom assets: preserve the local override.
- Do not add starter-local npm build scripts for theme/runtime assets.
- Keep docs aligned with pluginized v1 ownership.
- If you create or keep local overrides of plugin-owned files, run `bundle exec al-folio upgrade overrides audit` and commit `.al-folio-overrides.yml` after review when feasible.
