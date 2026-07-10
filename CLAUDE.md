# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The import above (`AGENTS.md`, which itself defers to `.github/copilot-instructions.md` and `docs/BOUNDARIES.md`) is the canonical short entry point: ownership boundaries, the validated command set, and routing rules. `AGENTS.md` takes precedence if any generic starter guidance below drifts. This checkout is also Dylan/Sirui's deployed personal site, so its intentional local content, layouts, includes, Sass, scripts, interactions, analytics, SEO, and assets are first-class site-owned contracts.

## What this repo is

Upstream `al-folio` v1.x is a **thin Jekyll starter**, not a theme. This customized fork owns starter wiring and tests plus Dylan/Sirui's site identity, content, analytics, SEO, local layouts, includes, Sass, scripts, interactions, and assets. Shared runtime belongs in the versioned gems; deliberate site-specific overrides remain here and are tracked with the override audit. `docs/BOUNDARIES.md` is the authoritative area-to-gem ownership table, and the customized-fork precedence in `AGENTS.md` governs ambiguous cases.

The biggest recurring mistake is applying the thin-starter rule mechanically and erasing an intentional local site contract. Route behavior shared by all al-folio users to the owning gem; keep Dylan/Sirui-specific presentation and interaction behavior in this repo.

## The plugin ecosystem (read this before routing any change)

The `al-*` / `al_folio_*` gems are developed as **sibling repos on disk** at `~/Documents/dev/al-org/<repo>` (repo dir uses hyphens, e.g. `al-folio-core`; gem/plugin id uses underscores, e.g. `al_folio_core`). To test a gem fix against this site, point the `Gemfile` at it: `gem "al_folio_core", path: "../al-folio-core"` (or `git:`/`branch:`), then `bundle install`.

**`al_folio_core` is the hub.** `_config.yml` sets `theme: al_folio_core`; the gem ships every base `_layouts/*.liquid` and `_includes/*.liquid`, the base theme JS/CSS, and the `details`/`file_exists` tags + `hideCustomBibtex`/`remove_accents` filters. Crucially, its `_includes/plugins/*.liquid` are **thin wrappers that call custom Liquid tags defined by sibling gems**. So a feature renders only when _both_ (a) its gem is present in the plugin list, and (b) the relevant flag is on. The wrapper→tag→gem delegation map:

| Wrapper / call site       | Tag                                                 | Gem                                                                            |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| search assets             | `al_search_assets`                                  | `al_search` (Cmd-K ninja-keys palette; index built at build time from content) |
| comments                  | `al_comments`                                       | `al_comments` (Giscus + Disqus, front-matter gated)                            |
| cookie banner             | `al_cookie_styles` / `al_cookie_scripts`            | `al_cookie` (consent-mode gating of analytics)                                 |
| icon `<link>`s            | `al_icons_styles`                                   | `al_icons` (FontAwesome/Academicons/Scholar Icons from CDN)                    |
| analytics                 | `al_analytics_scripts`                              | `al_analytics` (GA/Cronitor/Pirsch/OpenPanel)                                  |
| math                      | `al_math_styles` / `al_math_scripts`                | `al_math` (MathJax, pseudocode.js, TikZJax)                                    |
| charts                    | `al_charts_scripts`                                 | `al_charts` (Mermaid/Chart.js/ECharts/Plotly/Vega/Leaflet/diff2html)           |
| image tools               | `al_img_tools_styles` / `al_img_tools_scripts`      | `al_img_tools` (zoom, lightbox, sliders, galleries)                            |
| newsletter                | `al_newsletter_form` / `al_newsletter_scripts`      | `al_newsletter` (Loops.so signup)                                              |
| `layout: cv`              | `al_folio_cv_render`                                | `al_folio_cv` (RenderCV YAML + JSONResume)                                     |
| `layout: distill`         | `al_folio_distill_render`                           | `al_folio_distill` (vendored, hash-pinned distillpub runtime)                  |
| citation badges           | `google_scholar_citations` / `inspirehep_citations` | `al_citations`                                                                 |
| external posts            | (generator, no tag)                                 | `al_ext_posts` (RSS/URL ingestion → synthetic posts)                           |
| legacy Bootstrap behavior | (opt-in assets)                                     | `al_folio_bootstrap_compat`                                                    |
| upgrade/audit CLI         | `bundle exec al-folio …`                            | `al_folio_upgrade`                                                             |

Architectural facts that span repos:

- **Feature gating is two-layered.** Site-wide config flags (`search_enabled`, `enable_math`, `enable_cookie_consent`, `enable_darkmode`, `al_folio.features.cv.enabled`, `al_folio.features.distill.enabled`) _and_ per-page front matter (`images:`, `tikzjax`, `chart.*`, `mermaid.*`, `giscus_comments`, `layout: distill|cv`). A tag emits an empty string when its gem/flag/config is absent — features fail silently, not loudly.
- **Most feature gems are `AssetsGenerator`s** that inject their JS/CSS as Jekyll static files at build time _only when enabled_. These assets are not committed into the site, and several use pinned-CDN URLs + SRI hashes read from `_config.yml`'s `third_party_libraries:` block.
- **Two parallel lists must stay in sync:** `Gemfile` (pinned versions, e.g. `al_folio_core '= 1.0.9'`) and `_config.yml`'s `plugins:` list. Adding/removing a plugin means editing both.
- **The v1 config contract** (`al_folio.api_version: 1`, `style_engine: tailwind`, `tailwind.{version,css_entry,preflight}`, `distill.{engine,source}`) is enforced twice: as build-time warnings/violations by `al_folio_core`'s `:after_init` hook, and as **blocking** findings by `al-folio upgrade audit`. Don't remove these keys.
- **Local overrides are allowed but tracked.** A site may shadow a gem-owned `_layouts/_includes/_sass` file locally. When it does, `al-folio upgrade overrides audit` records owner gem + version + upstream/local SHA256 in `.al-folio-overrides.yml`; that file must be committed so future `bundle update`s can flag upstream drift. Shared fixes should be ported to the owning gem instead.
- **Bootstrap compat is opt-in and time-boxed.** `al_folio.compat.bootstrap.enabled: true` (default false) activates `al_folio_bootstrap_compat`. Supported through v1.2, deprecated v1.3, removed in v2.0 — migrate content off `data-toggle`/Bootstrap classes before then.

## Daily dev loop (not in the AGENTS.md command set)

```powershell
bundle install                                # ruby gems
bundle exec jekyll serve                      # customized site → http://localhost:4000/
bundle exec jekyll build --baseurl /al-folio  # production-style build to _site/
bash test/integration_distill.sh             # run ONE integration test (any of the five)
npm.cmd run test:visual:update                # refresh snapshots after an intentional UI change
bundle exec al-folio upgrade apply --safe     # deterministic codemods (font-weight-* → font-*, remote→local URLs)
bundle exec al-folio upgrade overrides diff <path>    # then `overrides accept <path>` to acknowledge an override
```

As in `AGENTS.md`, use explicit `.cmd` Node executables on Windows and run Bash scripts only through a working Git Bash or WSL environment.

`bin/setup-python-deps` installs the optional Python toolchain in `requirements.txt` (`nbconvert` for `jekyll-jupyter-notebook`, `rendercv[full]` for CV rendering, `scholarly` for `bin/update_scholar_citations.py`). Responsive-image generation (`imagemagick.enabled: true`) needs ImageMagick `convert` on PATH. `bin/deploy` is the manual `gh-pages` build+purgecss+force-push path (CI normally deploys).

## Docker serving model (v1-specific)

`docker compose up -d` bind-mounts the repo to `/srv/jekyll` and runs `bin/entry_point.sh`, which serves with `--force_polling --destination /tmp/_site`. The build output deliberately goes to **container-local `/tmp/_site`, not the bind-mounted `_site`**—writing `_site` back across the host bind mount caused write deadlocks. The container also `inotifywait`s `_config.yml` and restarts Jekyll on change (config edits aren't hot-reloaded by `--watch`). This checkout's Compose configuration serves the customized site at the root; verify it with `curl.exe -fsS http://127.0.0.1:8080/ | Out-Null`. The separate production build covers `/al-folio` compatibility. `docker-compose-slim.yml` pulls a prebuilt `:slim` image instead of building locally.

## CI gates and the style contract

`npm.cmd run lint:style-contract` (`test/style_contract.js`) enforces starter wiring, required plugin/config contracts, visual-evidence routing, and the ban on starter-local theme build scripts. It does not forbid this customized fork's intentional local overrides; review those with `bundle exec al-folio upgrade overrides audit`. Other gates include `unit-tests.yml`, the separate Chromium public-route/WebGL processes plus Chromium-desktop and WebKit-mobile interaction checks in `visual-regression.yml`, `upgrade-check.yml`, and `prettier.yml`. Prettier uses `@shopify/prettier-plugin-liquid` with `printWidth: 150`; run `npm.cmd run lint:prettier` before pushing.
