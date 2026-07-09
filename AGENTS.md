# Agent Guidelines for al-folio (v1.x)

`al-folio` is the starter repo for the pluginized v1 architecture. This customized fork also carries Dylan/Sirui site-specific content, layouts, analytics, SEO, and interaction overrides.

## Read This First

- Start with `.github/copilot-instructions.md` for architecture, ownership boundaries, and CI expectations.
- Use `.codex/skills/al-folio-upstream-sync/SKILL.md` before syncing upstream al-folio into this customized site.
- Use `docs/BOUNDARIES.md` as the source of truth for starter-vs-plugin ownership.
- Use `.agents/skills/al-folio-bootstrap/SKILL.md` for new-site setup tasks.
- Use `.agents/skills/al-folio-v1-migration/SKILL.md` when planning a full customized-fork migration.
- Use `.codex/skills/agentic-usage-ledger/SKILL.md` when updating Codex token, agent-hour, or commit counters for this customized site.
- Use `.codex/skills/tacit-knowledge-to-skill/SKILL.md` when deciding whether a living heuristic should stay human-facing, become a new Codex skill, or update an existing skill.
- Use `.codex/skills/website-design-critique/SKILL.md` for homepage/sitewide visual critique, responsive polish, and restrained design passes.
- Use `.codex/skills/portfolio-writing-voice/SKILL.md` for blog, project, case-study, and site-copy edits that need Sirui's research voice and source-credit habits.
- Use `.codex/skills/homepage-desk-scene/SKILL.md` for the homepage 2D/3D desk, album, coffee-stain, and cliff-cave scene.
- Use `.github/agents/customize.agent.md` for site customization work.
- Use `.github/agents/docs.agent.md` for documentation work.

## First-Run Checklist

Before changing this customized site:

1. Run `git status --short --branch`; preserve unrelated work and confirm the intended branch.
2. Classify the request as starter/plugin work, sitewide design/content work, homepage desk-scene work, or publish/accounting work.
3. Read the matching skill and its canonical human document before editing. Skills route the work; canonical documents carry the detailed contract.
4. Inspect the current rendered route before making visual judgments. Capture a comparable baseline for meaningful UI work.
5. State the intended files, explicit non-goals, and verification evidence. Stage and commit only explicit paths.

## Parallel Work Contract

- Use `$website-design-critique` with `$portfolio-writing-voice` for the sitewide UI/content stream. Use `$homepage-desk-scene` for the 2D/3D album-room stream.
- Parallel agents may inspect the same site, but they must not write the same worktree or file concurrently. Use separate named worktrees/branches for independent implementation, or serialize edits in one shared Codex worktree.
- Treat `assets/js/home.js`, `_sass/_home.scss`, `_includes/home/hero.liquid`, and desk-scene interaction tests as high-conflict paths. Reserve each overlapping file to one writer at a time and hand it back through the coordinator before another stream edits it.
- The sitewide stream must not change desk-scene state, geometry, album behavior, or scene-only selectors. The desk-scene stream must not rewrite posts, projects, general homepage narrative, or global chrome.
- Integrate verified checkpoints onto `main` through one coordinator. Worker branches do not push independently.
- Refresh `_data/agentic_usage.yml` once after parallel workers stop and the intended changes are integrated. The coordinator owns the final ledger audit, commit, push, and deployed smoke check.

## What This Repo Owns

- Starter wiring (`Gemfile`, `_config.yml`)
- Starter content and documentation
- Cross-plugin integration tests
- Visual regression tests
- This fork's site identity, content, analytics, SEO, custom layouts, custom scripts, and custom assets

Runtime/component logic belongs in owning plugin repos (`al_folio_core`, `al_folio_distill`, `al_search`, `al_icons`, `al_cookie`, and other `al-*` gems). Local overrides are valid when they are intentional site customizations.

### Customized-Fork Precedence

This repository is both a v1 starter and Dylan/Sirui's deployed personal site. For work in this checkout, explicit site identity, content, analytics, SEO, local layouts, Sass, scripts, interactions, and assets are owned here even when they shadow plugin paths. Use `docs/BOUNDARIES.md` to decide whether a fix is site-specific or should be ported to a shared plugin; do not use the thin-starter framing to erase an intentional local contract. Review shadowed plugin files with the override audit.

## Validated Local Command Set

Run from repo root:

```bash
npm ci
npm run lint:prettier
npm run lint:style-contract
python -m unittest discover -s test -p "test_*.py"
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

## Verification By Change Type

| Change                              | Minimum evidence                                                                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent guidance or repo-local skills | Targeted Prettier check, `python -m unittest discover -s test -p "test_*.py"`, quick-validate every changed skill, and `git diff --check`                             |
| Markdown/content                    | Prettier, style contract, production Jekyll build, and rendered inspection of the affected route/excerpt                                                              |
| Sitewide rendered UI                | Before/after screenshots at 1440x1000, 1280x800, 768x1024, and 390x1000; check light/dark when relevant, keyboard focus, reduced motion, overflow, and console errors |
| Homepage desk scene                 | The desk-scene brief's acceptance evidence map plus targeted Playwright/browser states; confirm nonblank WebGL and visible drag/zoom pixel changes                    |
| Plugin-owned local override         | Relevant checks above plus `bundle exec al-folio upgrade overrides audit` and reviewed `.al-folio-overrides.yml` state                                                |

Source checks are not a substitute for rendered inspection when public UI changed. Use Docker or the production Jekyll build before publish, then verify the deployed commit rather than relying on HTTP 200 alone.

## Living Heuristics And Codex Skills

- `WEBSITE_DESIGN_HEURISTICS.md` remains the canonical human-readable, copy-pastable design and writing memory.
- `docs/homepage-desk-scene-brief.md` remains the canonical desk-scene brief and handoff prompt.
- `docs/agentic-usage-ledger.md` remains the canonical usage-counter math and evidence log.
- Repo-local `.codex/skills/` files are concise Codex overlays that read those living docs by heading or path. Do not duplicate the long heuristic lists into skills unless the user explicitly asks for a source-of-truth migration.

## Publish Freshness Gate

Before pushing changes to this customized site:

- Use `.codex/skills/agentic-usage-ledger/SKILL.md` and `docs/agentic-usage-ledger.md` for the homepage Codex token, agent-hour, commit, energy, and tree-equivalence counters.
- Google Scholar runs daily in `.github/workflows/update-citations.yml`; locally run `python bin/update_scholar_citations.py --force` only if `_data/citations.yml` is more than one day stale or publication pages changed.
- Before the final commit, run `python bin/audit_agentic_usage.py --write --include-pending-commit`; the helper estimates the pending commit and updates `_data/agentic_usage.yml`.
- Format the generated ledger with `npx prettier _data/agentic_usage.yml --write` before staging it.
- After commit, rerun `python bin/audit_agentic_usage.py` read-only; update the ledger again only if visible labels, commit counts, rounded hours, rounded energy/tree, or rounded cost labels changed.
- Stage only intended files; do not sweep unrelated dirty files into a stats refresh.
- This repo has a project-local Codex hook in `.codex/hooks.json` that checks `git commit`/`git push` freshness. Review and trust it with `/hooks` when Codex reports a new or changed hook.

## Agent Routing Rules

- If change is starter wiring/docs/integration/visual testing: edit here.
- If change is runtime feature behavior shared by al-folio users: route to the owning plugin repo.
- If change is Dylan/Sirui site identity, content, analytics, SEO, custom layouts, custom scripts, or custom assets: preserve the local override.
- Do not add starter-local npm build scripts for theme/runtime assets.
- Keep docs aligned with pluginized v1 ownership.
- If you create or keep local overrides of plugin-owned files, run `bundle exec al-folio upgrade overrides audit` and commit `.al-folio-overrides.yml` after review when feasible.
