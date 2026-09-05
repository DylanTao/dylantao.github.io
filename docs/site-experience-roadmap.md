# Site Experience Roadmap (September 2026)

A staged, restrained plan for the next passes over this site. It was drafted on 2026-09-05 after the Wave 0 defect fixes and the Build Rhythm key redesign landed, and it splits work between two implementers:

- **Fable** (Claude Code): web-level motion and transitions, DOM/CSS/JS craft, accessibility, performance measurement, and concrete structural fixes.
- **GPT-6** (Codex, with the repo's own skills): aesthetic direction through `$website-design-critique`, copy in Sirui's voice through `$portfolio-writing-voice`, the Three.js desk scene through `$homepage-desk-scene`, and ledger accounting through `$agentic-usage-ledger`. Astra may supply 3D and material references with license recorded first.

Every item obeys `WEBSITE_DESIGN_HEURISTICS.md` (Decision Order first), `docs/design-experiment-backlog.md` (a full entry before any new visual idea ships), and `AGENTS.md` (iterate one route/state/viewport/theme, checkpoint explicit routes, full matrix only at release, overrides audit for every touched plugin override, ledger gate before pushes).

## Status (2026-09-05)

Shipped on `main` in the first pass after the roadmap was written:

- Stage 1: skip link and `#main` landmark (focus moves only when the link is used); `--md-lite-space-*`, `--md-lite-motion-duration-*`, and `--md-lite-easing-*` tokens, with the projects FLIP reading its duration from the token; the reading aid reads the reduced-motion preference live.
- Stage 2: previous/next/all-projects navigation on every project page; one text measure and one 4:5 thumbnail shape on the blog index; a shared `read_time` include; descriptive alt text for the six research cards; the caption rule on the compact type role; footer row with RSS, GitHub, Email, and the AI-readable profile.
- Stage 3: the root view-transition crossfade (homepage, AI profile, and hidden page opted out; reduced motion is an instant swap), recorded in the design backlog as `prototype` pending Sirui's live review.
- Accessibility and stability pass from the Lighthouse baseline: collapsed publication panels are `inert` (the copy button inside a closed Bib block was a hidden tab stop on the homepage, publications, and every project page with a citation), footer sentence links are underlined, the Spooder CTA label inherits its button color in every theme, Scholar Lens year bars name themselves from their visible text, and sixteen project figures declare intrinsic dimensions (DesignWeaver's 0.111 layout shift was the summary block moving when the hero image arrived). Re-measured on the same local serve: DesignWeaver accessibility 92 to 100 and layout shift 0.111 to 0.006, publications accessibility 90 to 100, homepage accessibility 90 to 97 with only the desk-mode switch target left.
- Cinematic layer, slice 1 (2026-09-05, Sirui chose the cinematic tier): GSAP 3.15 and ScrollTrigger vendored and loaded only on pages with `cinematic: true`. The projects index gets a staggered entrance, headings that slide in, a pointer spotlight and a few degrees of tilt on the card grid, a title that lingers as the page starts to move, and a gradient field behind the title. The DesignWeaver page becomes a scroll scene: the hero copy scrolls away, the teaser stays, and three steps take its place while a lens moves over the figure and the study size counts up. Still pages under reduced motion, without a fine pointer, and under automation; the design backlog carries the experiment record.
- Cinematic layer, slice 2 (2026-09-05): the homepage below the desk gets a story thread that fills with scroll and lights the section being read, headings that drift slower than the page, a marker that sweeps the thesis question, staggered claim and update cards, and build-ledger numbers that count up; the project image a visitor clicks morphs into the case page's hero and back (cross-document view transition with an early `pagereveal` listener and a render-blocking expect link on the index).
- Reverted on Sirui's call (2026-09-05): co-authored papers with their own project sites (HotSpot, Physion) link out from their cards again; the internal URLs forward to those sites and stay out of the sitemap.

Still open: the focus mixin migration, the accessibility spec additions, purge-parity as a documented lane, the hidden page's CSS/JS extraction and unlocked-state spec, the `what-happened-and-why` inline-style extraction, the desk-mode switch button's tap target (Lighthouse measures it under 24 px; scene lane), and every GPT-6 and Sirui-decision item below.

### Lighthouse baseline (2026-09-05, desktop preset, local static serve of the production build)

Local serving removes network latency, so the byte totals and blocking time are the meaningful columns; treat scores as relative, not as the deployed number.

| Route                                      | Perf | A11y | BP  | SEO | LCP   | CLS   | TBT      | Transferred | LCP element       |
| ------------------------------------------ | ---- | ---- | --- | --- | ----- | ----- | -------- | ----------- | ----------------- |
| `/` (homepage with desk scene)             | 43   | 90   | 100 | 100 | 3.1 s | 0.003 | 2,710 ms | 13.4 MB     | `h1.home-title`   |
| `/projects/`                               | 72   | 96   | 100 | 100 | 2.9 s | 0.003 | 230 ms   | 7.8 MB      | first card image  |
| `/blog/`                                   | 58   | 96   | 100 | 100 | 1.7 s | 0.008 | 450 ms   | 3.3 MB      | post title        |
| `/publications/`                           | 64   | 90   | 100 | 100 | 3.8 s | 0.036 | 230 ms   | 18.6 MB     | publication title |
| `/projects/designweaver/`                  | 72   | 92   | 100 | 100 | 2.5 s | 0.111 | 230 ms   | 2.7 MB      | case hero section |
| `/blog/2026/research-skills-starter-pack/` | 81   | 96   | 100 | 100 | 1.5 s | 0.008 | 220 ms   | 1.7 MB      | paragraph         |

What this says: accessibility is already high everywhere (the remaining points are contrast and link-name audits worth a pass); performance is a weight problem, not a script problem, on every route except the homepage, whose 2.7 s of blocking time is the Three.js scene boot (scene lane). Publications and projects ship multi-megabyte preview images and GIFs; the gallery originals and `physion++.gif` (6.9 MB) are the largest single wins. DesignWeaver's 0.111 layout shift points at a hero image without reserved dimensions. Reports live under `.jekyll-cache/lighthouse/` and are not committed.

## Ground truths that shape the sequencing

- PurgeCSS runs only in CI deploy (`.github/workflows/deploy.yml`) and `bin/deploy`; local lanes serve unpurged builds. The gap is purge parity, not wiring.
- `_sass/_material-lite.scss` defines radius, elevation, state, surface, focus, and two motion tokens; there are no spacing tokens, and `_sass/_realignment.scss` carries 13 ad-hoc `clamp()` values. 163 `:focus-visible` rules live across 14 partials (49 in `_sass/_home.scss`).
- Motion is hand-rolled: CSS transitions, IntersectionObserver reveals, the projects-index FLIP (`assets/js/project-cards.js`, 430 ms literal), Three.js, Paper Shaders. No GSAP, no View Transitions.
- There is no skip link; `_layouts/default.liquid` only marks `role="main"`.
- Playwright captures use `page.goto` with animations disabled, so a cross-document view transition never affects existing captures.
- The hidden page's runtime gate is a sessionStorage fruit pass; `sitewide.spec.js` already reaches the unlocked globe.
- Building `--baseurl /al-folio` must run from PowerShell on this Windows checkout; Git Bash rewrites the argument into a Git install path and produces an unstyled build.

## Stage 1 — Foundations (Fable)

- **Lighthouse baseline, measure only**: production build, purge, static serve, `npx.cmd lighthouse` desktop and mobile for `/`, `/projects/`, `/blog/`, `/publications/`, `/projects/designweaver/`, and one long post; record scores, LCP element, and bytes under `.jekyll-cache/lighthouse/`. Sirui decides whether a dated table enters `docs/` and whether the stale upstream `lighthouse_results/` retire.
- **Skip link and main landmark** in `_layouts/default.liquid`, styled in `_sass/_layout.scss` (hidden until focus-visible, above the navbar, using `--md-lite-focus-ring`).
- **Reduced-motion and focus audit**: subscribe to `matchMedia` changes where scripts read `.matches` once (`assets/js/common.js`, `section-reading-aid.js`); leave `home.js`, `research-motion.js`, `paper-research-field.js` to the scene lane.
- **Cheap accessibility assertions** in `sitewide.spec.js`'s `exercisePublicRoute` (one `h1`, skip link first in tab order, no `img` without alt); a release-lane `test/visual/accessibility.spec.js` for reduced-motion stillness, visible focus on chrome controls, and heading-level order.
- **Token ramp** in `_sass/_material-lite.scss`: `--md-lite-space-1…8` plus fluid `-section`/`-gutter`; `--md-lite-motion-duration-{short,standard,emphasized,long,flip}` and `--md-lite-easing-{standard,decelerate,exit,flip}`; legacy `--motion-*` become aliases; `project-cards.js` reads the flip tokens with the current literals as fallback. Migrate `_realignment.scss`, `_blog.scss` list paddings, and `_components.scss` case spacing. Not `_home.scss`.
- **Focus mixin** in a new output-free `_sass/_mixins.scss`, adopted everywhere except `_home.scss` and `_brand-orange.scss`; a ceiling check in `test/style_contract.js` next to the font-size cap.
- **Purge-parity lane**: build, purge, serve `_site` under an `al-folio` junction, run the checkpoint lane with `NO_WEBSERVER=1` and `VISUAL_BASE_URL`; add `/^--md-lite-/` to the PurgeCSS safelist.
- Verification: iterate one post route at 1440 and 390 (no visible change expected); checkpoint `home,projects-index,blog-index,blog-research-skills,publications,cv,ai-profile,project-designweaver`; zero-diff proof with `BASELINE_URL` and `parity.spec.js` against a pre-change worktree; overrides audit for every touched override; Docker tab-order check in all four theme modes.

## Stage 2 — Wayfinding and reading surfaces (Fable structure, GPT-6 voice)

- [Fable] Adjacent-project navigation in `_layouts/page.liquid` for project pages ("All projects" plus prev/next within the category, skipping `redirect:` projects), reusing the blog navigation grammar through a neutral shared class; add the uncovered research project routes to `test/visual/public-routes.js`.
- [Fable] One reading-time include replacing the three inline copies in `_pages/blog.md` and `_includes/blog_navigation.liquid`; a caption rule in `_sass/_components.scss` covering `figure.liquid` output and hand-written figcaptions.
- [Sirui → Fable] Blog index rhythm: drop the two-column thumbnail variant (recommended) or give every post a thumbnail in a fixed well.
- [Fable] Card data parity, factual half: `teaser_alt` for the six research slugs in `_data/project_cards.yml`. [GPT-6] `origin_line`, `evolution_line`, and `icon` for research cards only if the critique skill wants them; one summary vocabulary decision recorded in the heuristics.
- [Fable] Move `_projects/what-happened-and-why.md`'s inline `_styles` block into `_sass/_components.scss` scoped by its `design_story_class`.
- [Sirui → Fable] Footer links: one quiet compact row (RSS, GitHub, email, `/ai/`), single line at 390.
- [GPT-6] Retell wave 1 per the backlog: The Desk That Learned Depth, Paper Constellation, Scholar Lens; then `description:` fields site-wide in Sirui's voice with before/after captures per route.

## Stage 3 — Navigation motion, performance action, hidden-page hygiene, scene handoff

- [Fable] View Transitions as a root crossfade only: `@view-transition { navigation: auto }` emitted from `_includes/head.liquid` inside `prefers-reduced-motion: no-preference`, skipped for `page.ai_profile`, `page.home_experience`, and `page.secret_globe`; `::view-transition-old/new(root)` on the standard duration and easing tokens; `#navbar` and `#progress` named so fixed chrome does not crossfade with itself. Backlog entry required; card-to-hero morphs recorded as deferred because they compete with the FLIP contract.
- [Fable] `test/visual/navigation-transitions.spec.js`: real link clicks, `pagereveal.viewTransition` true in default motion and false under reduced motion or across the Human/AI switch.
- [Fable] Performance actions from the Stage 1 baseline (a gated hero-image preload in `head.liquid` only if the portrait is the LCP element). [Sirui] re-encode the 25 gallery originals (4.5 to 9.8 MB each) to at most 2000 px with a recipe in `bin/`.
- [Fable] Hidden page hygiene: extract the inline CSS and JS of `_pages/sirui-research-thoughts.md` into `assets/css/secret-globe.scss` and `assets/js/secret-globe.js` gated on `page.secret_globe`, pass Liquid values through `data-*` attributes, add `/^sirui-/` to the PurgeCSS safelist; cover the unlocked state in a scene-process spec by seeding the fruit pass (no secret exists).
- [Fable, doc-only] Desk scene: turn the brief's Known Inspection Targets into a table with a current-evidence column citing `test/visual/desk-scene.spec.js`, and add an assets-and-provenance section. Nothing in `home.js`, `_home.scss`, `hero.liquid`, or `desk-scene.spec.js`.
- [GPT-6 and Astra] Scene handoff with the brief as contract: Known Inspection Targets in priority order, Paper Water only after topology and performance evidence, Astra references with license recorded before download, Three.js import deferral if it lands before LCP, `_home.scss` adoption of the new tokens.

## Stage 4 — Retell waves and deferred grammar (GPT-6-led, Fable support)

- [GPT-6] Waves 2 to 4 per the backlog: playful provenance, research artifacts, then Not A Good Driver if evidence supports it. [GPT-6 and Sirui] judge the Paper fields prototype and the origin glint on rendered routes.
- [Fable] Structural fixes the retells surface (figure sizing, caption reuse, reading-aid eligibility, route data in `sitewide.spec.js`). [Sirui] homepage opt-in to view transitions once the scene lane confirms static above-the-fold entry.

## Must not

- Locked copy verbatim (`WEBSITE_DESIGN_HEURISTICS.md`, Signature Copy Locklist) and the in-scene "Welcome to Sirui's cave."
- FLIP stays the projects index's only layout motion; no card-to-hero transition names; the 430 ms timing and easing values stay.
- No cursor trails, parallax, page-wide particles, ambient loops, wheel or touch hijacking, or clipping as drama.
- Brand orange stays identity-only; brand-mark rules in `docs/material-lite-revamp.md` hold; no sitewide shader language; Paper fields stay `prototype` until judged.
- The sitewide stream never edits `assets/js/home.js`, `_sass/_home.scss`, `_includes/home/hero.liquid`, or `test/visual/desk-scene.spec.js`.
- Inter 400/500/600/700 only; the raw `font-size` ceiling of 333 in `test/style_contract.js`; `_realignment.scss` uses `var(--type-*)`.
- Every edited plugin override re-runs `bundle exec al-folio upgrade overrides audit` and commits `.al-folio-overrides.yml`; pushes go through the ledger gate.
