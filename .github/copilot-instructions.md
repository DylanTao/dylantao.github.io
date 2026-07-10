# Copilot Coding Agent Instructions (v1.x)

## Repository Role

`al-folio` is a **thin starter** for the pluginized architecture.

This repo owns starter configuration, docs, sample content, integration tests, and visual parity checks.

## Customized-Fork Precedence

This checkout is also Dylan/Sirui's deployed personal site. Intentional local content, identity, analytics, SEO, layouts, includes, Sass, scripts, interactions, and assets remain owned here even when the same path category is normally plugin-owned. Use `docs/BOUNDARIES.md` to distinguish a site-specific override from a shared runtime fix; do not remove a local contract merely to make the repository resemble a pristine starter.

Read `AGENTS.md` for the first-run checklist, parallel-work contract, skill routing, and publish freshness gate before implementation.

## Ownership Boundaries

Follow `docs/BOUNDARIES.md`.

- Starter (`al-folio`) owns:
  - `Gemfile`, `_config.yml`
  - starter content (`_pages`, `_posts`, `_projects`, `_news`, `_data`)
  - docs
  - integration tests (`test/integration_*.sh`)
  - visual tests (`test/visual/*`)
- Plugin repos own:
  - runtime/component logic
  - component correctness/unit tests
  - feature-specific assets

Do not reintroduce plugin-owned runtime assets into starter paths unless intentionally overriding behavior.

## Plugin Naming and Featuring

- Theme-coupled plugins: repo `al-folio-<feature>`, gem/plugin id `al_folio_<feature>`.
- Reusable plugins: repo `al-<feature>` (or neutral), gem/plugin id aligned to namespace.
- Featured plugin metadata lives in `_data/featured_plugins.yml`.
- Featuring and bundling are separate decisions.

## Core Stack

- Jekyll (Ruby)
- Node tooling only (Prettier, Playwright)
- No starter-local Tailwind build pipeline

## High-Signal Paths

- `_config.yml` - starter plugin wiring and feature flags
- `_data/featured_plugins.yml` - plugin catalog metadata
- `test/style_contract.js` - starter contract checks
- `test/integration_*.sh` - cross-plugin integration checks
- `test/visual/` - visual parity checks
- `.github/workflows/` - CI workflows
- `docs/` - user, maintainer, upgrade, and plugin-system documentation
- `.agents/skills/al-folio-bootstrap/SKILL.md` - canonical agent workflow for new site setup
- `.agents/skills/al-folio-v1-migration/SKILL.md` - canonical agent workflow for customized fork migration
- `.codex/skills` - customized repo-local Codex overlays for this site; keep them linked to canonical human docs
- `WEBSITE_DESIGN_HEURISTICS.md` - canonical human design and writing memory
- `docs/homepage-desk-scene-brief.md` - canonical 2D/3D desk-scene contract and handoff
- `.claude/skills` - symlink to `.agents/skills` when present

## Validated Commands

On Windows PowerShell, use the explicit executable names below; bare `npm` or `curl` may resolve to a wrapper or alias. Run the Bash integration scripts only through a working Git Bash or WSL environment.

```powershell
npm.cmd ci
npm.cmd run lint:prettier
npm.cmd run lint:style-contract
python -m unittest discover -s test -p "test_*.py"
bundle exec jekyll build --baseurl /al-folio
bash test/integration_comments.sh
bash test/integration_plugin_toggles.sh
bash test/integration_distill.sh
bash test/integration_bootstrap_compat.sh
bash test/integration_upgrade_cli.sh
npx.cmd playwright install chromium webkit
npm.cmd run test:visual
bundle exec al-folio upgrade audit
bundle exec al-folio upgrade overrides audit
bundle exec al-folio upgrade report
docker compose up -d
curl.exe -fsS http://127.0.0.1:8080/ | Out-Null
docker compose logs --tail=80
docker compose down
```

## CI Expectations

Keep these workflows aligned when changing starter behavior:

- `unit-tests.yml`
- `visual-regression.yml`
- `upgrade-check.yml`
- `deploy.yml`

## Editing Guidance

- Prefer starter wiring/docs/content changes in this repo.
- Route runtime/layout/feature fixes to owning plugin repos.
- Preserve intentional Dylan/Sirui site behavior locally; port only genuinely shared fixes to plugin repos.
- Do not let parallel agents write the same worktree or overlapping homepage files concurrently; follow the coordinator contract in `AGENTS.md`.
- Keep all contributor guidance consistent with v1 ownership boundaries.
- When a site keeps local overrides of plugin-owned files, run `bundle exec al-folio upgrade overrides audit` and update `.al-folio-overrides.yml` after reviewing diffs.
