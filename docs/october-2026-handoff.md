# October 2026 handoff: resume here

Written 2026-10-22 by the coordinating agent before a five-day token pause, so the next session can continue without
re-deriving context. `main` is the source of truth; everything below that is not on `main` lives in local worktrees on
Sirui's laptop.

**October 23 continuation:** use the [reconciled checklist](#october-23-reconciled-checklist) below for current status.
The original queue and parked commit IDs remain as custody/history, not proof that every listed idea is still unbuilt.

## Working rules (from Sirui; historical sequencing below)

- Original handoff: one agent at a time. Superseded October 23 by Sirui's explicit parallel, ultra-mode continuation. One coordinator still integrates and publishes.
- Push verified intermediate milestones to `main` as they land; never leave review branches. Sirui reviews on the live
  site and asks for revisions there.
- No pile of branches: delete an agent's branch and worktree as soon as everything on it is on `main`. Do not push
  agent branches to GitHub.
- Make the site awesome, not minimal; polish playful pieces, never cut them.

## State on 2026-10-22

`main` is at `e77a2d55a`. Live this round, in order:

- Design language: grammar and tokens (`docs/material-lite-revamp.md` 2026-10 section), flat project cards, panels
  and decks, one 16:10 frame for closed cards, one-language navbar.
- Polish pass (complete): content visible before any reveal fires; publication entries as one grid with the venue
  chip and autoplaying Physion MP4 previews (`assets/js/preview-motion.mjs`); a light dried-coffee ring
  (`assets/js/home-coffee-stain.js`); hero slips on one edge; the Lately notes at a reading measure; the light-paths
  race starts in view; /news/ dates on the first line.
- 3D: full screen at native resolution with matching detail (`resolution.mjs`, `realism.mjs`); Walk mode (keys and
  mouse, twin thumb sticks, gamepad; `walk-controls.mjs`, `colliders.mjs`); Yale Bright Star Catalogue stars for La
  Jolla's real sky (`stars.mjs`); the far land continuing past the model and a soft sea horizon (`far-field.mjs`).
- Data: GitHub profile (DylanTao/DylanTao 71a1909) and Build Rhythm (`_data/code_activity.json`) through 2026-10-21.
  The metrics collector gained a reviewed Oct 19 gap (github-metrics-private ebecfb5, Sirui approved).
- CI hardening: only the legacy stream installs WebKit; visual jobs get 75 minutes.

### Open issue: one red check on `main`

Update (later on 2026-10-22): the cause is the coast's surfer. In the failing runs the surfboard and its white wake pass
behind "Tao.", lifting the 2 px ring the test samples; the passing run's surfer was further right. The fix stacks extra
2 px and 3 px halo layers in `_sass/_footer-coast.scss` so the ring is nearly solid halo. If CI still fails, give the
credit a soft scrim or keep the surfer's path clear of the bottom centre. The original diagnosis follows.

`Visual checkpoints (desktop-1440, scene-footer-light)` fails one case, `footer-coast.spec.js:315` "coastal sky: La
Jolla's real sunset and dusk keep the theme, the credit and the coast on one clock": the credit's contrast at dusk is
4.457:1 against a 4.5:1 floor. It is deterministic (4.459 and 4.457 in two runs), it started with the polish slices
(c3da53bd0), although none of them touch the footer, and raising the dark halo's alpha floor from 0.92 to 0.97 in
`assets/js/footer-coast/sky-look.mjs` (`creditHalo`) did not move it. The test measures the text colour against a 2 px
ring of background pixels around the glyphs (`creditContrast`), and the halo is the `text-shadow` in
`_sass/_footer-coast.scss` (1 px, 2 px and 6 px layers of `--coast-halo`). Next steps:

1. Find why the scene behind the credit got brighter at 18:30 (for example the page above the footer changing
   height, which moves where the footer sits; compare `credit-contrast-dusk` attachments of a passing and a failing
   run).
2. Then either lighten the evening credit ink or add a denser 3 px halo layer, and confirm in the Linux Playwright
   image against a local server. The command is in `windows-tooling-gotchas` memory; Docker Desktop must be running.

## Resume procedure

1. `git status` on `main` (expect clean), `git worktree list`, and read this file.
2. Start Docker Desktop if needed, then `docker compose up -d`. The first build after a restart regenerates every
   responsive image, so it takes about 20 minutes, and the preview serves on 8080.
3. Pick the next item from the queue below and run one agent for it, in a worktree under `.claude/worktrees/<name>`.
   For a parked pass, reuse its worktree and branch. Give each agent its own Jekyll port (4151+).
4. Integrate each finished slice as follows:
   1. In a detached, LF-normalized worktree, run `git -c core.autocrlf=false worktree add --detach .claude/worktrees/integration origin/main`.
   2. Cherry-pick the slice.
   3. Run the gates:
      - Prettier on the changed files;
      - `npm.cmd run lint:style-contract`;
      - `python -m unittest discover -s test -p "test_*.py"`;
      - `node --test test/*.test.mjs` (a glob, not a directory, on Node 22);
      - when `test/visual/*.spec.js` or `scene-groups.json` changed: `node bin/run_visual_scene_group.cjs scene-core-1 --project all --verify-only`;
      - when an override changed: `bundle exec al-folio upgrade overrides audit`.
   4. Run `git push origin HEAD:main`, then `git merge --ff-only origin/main` in the main checkout.
5. Watch CI with `gh run list -R DylanTao/dylantao.github.io --commit <full sha>`. Every push cancels the previous
   commit's visual run, so batch pushes when a full visual result matters.
6. Metrics: the nightly task "Dylan Local GitHub Metrics Refresh" fails closed on any new busy-day difference between
   GitHub's calendar and the scan.
   - To diagnose, compare `.local/scan-cache.json` rows with `gh api graphql` contributionsCollection per repo and
     day, for public repos only.
   - Each reviewed entry needs Sirui's approval.
   - Don't push the site repo during a scan.

## Parked work (local only)

| Worktree / branch                               | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Next step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `design` / `agent/design`                       | WIP `7ce141e99` (on `e77a2d55a`): step 6 icons. `_includes/icon.liquid` and `_data/icons.yml` hold 20 Lucide glyphs (ISC, Feather MIT notices) and replace the Font Awesome UI icons on the hero slips (icon names in `_pages/about.md`), the navbar search, project cards, the blog list and posts, archives, page and blog navigation, the CV, the AI page, the heuristics preview, the publications view switch and copy-code. The plus turns 45° into ×. Paper links are flat, there is one tonal "Pinned" chip, and the brand orange moves 4.4 px onto the content edge. Source checks pass and 10 overrides are accepted on LF. `36b8763a7` keeps the step 7 draft at `docs/drafts/theme-water-reveal.draft.mjs`. | Step 6: serve on 4152 and run `python .jekyll-cache/visual-qa/scripts/webp_variants.py` (in that worktree). Run "public route: projects-index" at 1280, 1440 and 390, the six-route checkpoint (home, projects-index, project-designweaver, publications, blog-index, cv), and the legacy `--grep "navbar\|project card\|project preview\|pagination"` on a `/al-folio` build. Then reword the WIP into a `feat:` commit; the draft file stays off `main`. Step 7 plan: a water-spread theme change (`waterReveal()` in site-motion.mjs on `::view-transition-new(root)`); a liquid indicator for the theme stops; shared-axis page navigation via `pagereveal` with `navigation.activation.from`; an ink dissolve when an expanded card closes (feTurbulence, rAF, skipped under reduced motion and automation); remove the deck fan rotation, the story-beat rise-ins and the heading slide-in; add "motion never gates visibility" to the heuristics. Font Awesome still loads for brand logos and for icons outside this pass (hero desk controls and CTA arrow, 3D world controls, bib buttons, Wall of Rejection). |
| `scene-interior` / `agent/scene-interior`       | WIP `42819bdb8`: kitchen phase built (partition wall removed, sunken breakfast-nook treads, two pendants, boards relaid) with furniture anchors `kitchen-range`, `kitchen-range-hood`, `kitchen-pot-filler`, `kitchen-glass-fridge`, `dining-table`, `dining-chair-1..6`; `bin/coastal_sunken.py`, `bin/coastal_anchors.py`, `bin/refresh_coastal_interior.py`. Unverified.                                                                                                                                                                                                                                                                                                                                             | Rebase on `main`, re-run the kitchen refresh, bake and scene checks, ship the kitchen slice, then the living pit with flue and rock cap, the entrance, the top of the house, gym lighting with pan anchors, and the pool.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `scene-furniture` / `agent/scene-furniture`     | WIP `cad6532bf`: Eames chair and ottoman rebuilt in Blender (`bin/build_coastal_furniture.py`), LOD1 6,376 tris / 67 KB and LOD0 36,130 tris / 444 KB (near 1.6 m or full screen), `furniture.mjs`, `detail-levels.mjs`, `furniture/index.json`. `cdef0eb12` holds TEMPORARY preview anchors in `manifest.json`: drop it before integrating.                                                                                                                                                                                                                                                                                                                                                                            | Verify in scene, ship with the runtime, then the Aeron, Italian range with hood and pot filler, glass fridge, dining set, cast-iron pan with dumbbells (plus a pan-raise move), and the UFO fireplace with fire.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `scene-environment` / `agent/scene-environment` | Clean; everything is on `main`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Planets and moon (Standish elements, Mallama and Hilton magnitudes; JPL Horizons references for 2026-10-22 04:30 UTC, e.g. Saturn RA 9.855°, Dec +1.305°, mag 0.42), then far trees, then landscape variety and coastline lights.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Herman Miller's terms do not allow redistributing the configurator GLB Sirui downloaded (`Downloads/323567.glb`), so
the Eames is original geometry measured from it. If Sirui downloads an Aeron model, use it only as a reference too.

### Furniture interface (scene-interior and scene-furniture)

- Items live in `assets/models/home/furniture/<item>-lod{1,0}.glb` with `furniture/index.json`. Axes are glTF metres,
  +y up; an item's origin is its floor-contact centre, and its front faces +z at yaw 0, like an actor's facing.
- The house adds `manifest.furniture` anchors `{id, item, room, position, yaw}` and `manifest.fireplace
{anchor, flueTop, cap}`. It also keeps a placeholder object per anchor with the custom property `furniturePlaceholder`.
- The runtime places items at anchors, parented to the anchor's room, and hides the placeholder once an item is ready.
  It swaps LODs by distance and full screen, and silently skips whatever is missing.
- Target sizes: Eames 0.84 × 1.55 footprint, seat 0.38; Aeron seat 0.46, 1.25 tall with headrest; dining table
  2.2 × 1.0 × 0.74; dining chair seat 0.45; range 1.2 W × 0.70 D × 0.92 H; fridge 0.76 × 0.70 × 2.13; pan Ø 0.40 plus a
  0.25 handle; fireplace bowl Ø 0.9 at 0.75, flue start 1.9, flue Ø 0.20.

## Queue (one agent at a time, in this order)

1. Fix the red footer dusk-contrast check (above).
2. Design: icons, then motion.
3. Far landscape: planets and moon, far trees, landscape and coastline lights.
4. House:
   1. Kitchen, nook and dining (WIP).
   2. Sunken living pit with the floating-fireplace flue and rock cap.
   3. Entrance from the cliff top and a foyer.
   4. The top of the house and the rock cut.
   5. Brighter gym lighting and the pan station.
   6. An outdoor infinity pool.
   7. Expansion as needed.
5. Furniture:
   1. Eames and the runtime (WIP).
   2. The Aeron (Carbon gray by default, Mineral as the alternative).
   3. The Italian range set.
   4. The glass fridge.
   5. The dining set.
   6. The cast-iron pan and dumbbells.
   7. The floating fireplace and its fire.
6. Approved earlier, never built:
   - a phone experiment carousel on /projects/;
   - the revamp laptop-lid scroll;
   - Tufte sidenotes on long posts;
   - a clifftop creek and koi pond (plus the onsen drip);
   - temporal anti-aliasing;
   - an FFT ocean;
   - real cloth for the duvet;
   - an honest 3D loader (optional);
   - a public version of the studio log in Sirui's voice.
7. Last: refresh Google Scholar, Build Rhythm and the GitHub profile.
8. Later: the research entry in `docs/design-experiment-backlog.md` (Gaussian splatting, neural level of detail,
   discontinuity-aware neural fields, stylized rendering).

## Decisions waiting for Sirui (defaults in place)

- Homepage papers: keep all links and "When this paper helps" (default), or only the title plus PDF, Code and Video.
- Coffee ring: keep its one-time 1.5 s dry-in (default)?
- Light-paths race: skip autostart on battery? (default: no)
- Night sky density: `NIGHT_SKY_MAGNITUDE` in `stars.mjs` (19.4; 20.0 roughly doubles the stars).
- Earlier open items: the performance page title and credit, the revamp deck open by default, marine-layer frequency
  and the red sunset, laundry and cloth hardware, the onsen drip versus a koi pond.

## Gotchas learned this round

- Pin scene tests' clocks. A walker test that held still within 5 cm failed on CI because sliding along a wall or a
  moving avatar is correct physics; assert under a fraction of free walking instead, and give heavy scene cases the
  600 s Linux budget.
- A visual job "cancelled" at exactly 50 minutes was a timeout caused by a slow apt mirror, not a superseding push;
  compare step durations before blaming code.
- `coastal-home.blend` is a committed binary edited in place by scripts; only one agent may own it.
- `git stash pop` and Python text-mode writes produce CRLF on this machine; normalize before override audits.

## October 23 reconciled checklist

This pass starts from `95e336a2d`, reads the parked work, and keeps uncertain scene changes off the site. Checked means
completed or an existing implementation verified in source; an unchecked item is still work. The two scene worktrees
and the design draft remain intact. Do not replace their original sources with a fresh simplified model.

### Completed and verified this pass

- [x] **Footer dusk contrast.** The existing halo fix passes `footer-coast.spec.js`'s sunset/dusk case in Linux Chromium
      (Docker, desktop 1440). The existing source commit's full Visual checkpoints run also passed:
      [39904611455](https://github.com/DylanTao/dylantao.github.io/actions/runs/39904611455). No further footer edit was needed.
- [x] **Design step 6: interface icons.** Resume `d86ed0962` from `agent/design`, keeping the water draft commit off main.
      Review desktop and phone renders; pass the six-route, four-viewport light/dark checkpoint (24 tests) and the scoped
      Chromium/WebKit navigation/card suite (13 passed, 5 intentional skips). Retain the Lucide ISC and Feather MIT notices.
- [x] **Part of design step 7: theme water reveal.** Finish the parked outline as sampled, interpolated paths on the
      root view-transition snapshot. A CSS circle remains the module-failure fallback. Rapid changes retain the last
      choice; reduced motion swaps immediately. Desktop/phone midpoint screenshots and interruption checks pass.
- [x] **Part of design step 7: readable motion.** Remove heading slide-ins, the card/deck story's delayed rise-ins, and
      the runtime deck fan/fold rotation. Keep the layout spring, in-place expansion, scroll recovery and action controls.
      State the visibility rule in the existing heuristics rather than creating a new skill.
- [x] **Google Scholar.** Fetch a fresh paired citation/lens snapshot on October 23. The previous snapshot was October 17;
      this is a real fetch, not a date-only freshness edit.

Local evidence is under `.jekyll-cache/visual-qa/`: `iteration-todo-home-baseline`,
`iteration-todo-icons-before-review`, `checkpoint`, `todo-footer-linux`, and `todo-motion`.
These local artifacts are ignored by Git; the source and limits in this checklist are the durable handoff.

### October 23 integrated continuation

Sirui asked to finish the entire remaining queue, parallelize, and keep precise notes for experiments that cannot be
completed well. The coordinator integrated isolated house, furniture, environment and record work onto `main`.
Original parked WIPs remain historical custody; the temporary furniture-anchor commit was never integrated.

The following statuses distinguish implemented work from a completed review that leaves an experiment deferred.
The release verification section below records the combined checks.

- [x] **Theme-stop liquid indicator.** Four persistent choices now keep the menu open during comparisons. The named
      indicator travels/morphs between stops; arrow keys, Home/End, Escape and focus restoration work. Rapid theme changes
      retain the final choice. Reduced motion selects immediately. The menu is protected from the companion.
- [x] **Shared-axis page navigation.** Supported same-origin transitions reverse on Back and retain stationary chrome.
      The card-to-page shared morph and Back restoration remain. Missing Navigation Activation data uses the existing
      crossfade; it never guesses a forward direction. BFCache entry listeners read the current handoff on each reveal.
- [x] **Card-close ink study.** A 240 ms inert, accessibility-hidden copy contains optional story prose only; figures,
      media, controls and persistent summaries are excluded. Real semantics and focus update immediately. Reopen cancels
      the copy. If closing gives its space to another word, link or figure (including the tested phone layout), the ink
      copy is discarded. Reduced motion closes cleanly. This is a bounded flourish, not a research-figure filter.
- [x] **Planets.** Five bright planets reuse the star draw, extinction and visibility model. Twenty seasonal JPL Horizons
      comparisons cover positions/magnitudes; the existing moon remains. See
      [PLANETS.md](../assets/js/home-scene/PLANETS.md) and the planet reference tests.
- [x] **Far trees, landscape variety and coastline lights.** Original procedural groves, meadow/soil variation and
      land-only coastline lights share the existing atmosphere and reflection. See
      [environment acceptance](../artwork/coastal-home/reviews/environment-2026-10-23.json).
- [x] **Kitchen, nook and dining.** Rebuilt the retained native source with actual Boolean cuts, supported nook treads,
      open cooking run and six dining places. Native contacts, seated poses, camera views and Walk clearance were checked.
- [x] **Living pit, flue and rock cap.** A 42 cm pit has two 21 cm transitions, a supported seated pose, continuous flue
      and cap. Runtime travel uses actual supports rather than the seated actor root; all 36 room pairs retain the correct
      local treads and use the main stair only between storeys.
- [x] **Clifftop entrance and foyer.** Connected top approach, stair route, landing and recessed foyer replace door-like
      islands in solid rock. Exported support geometry is checked against native source and actual Walk probes.
- [x] **House top and rock cut.** The top-cut and approach are rebuilt with the closed shell, rather than hiding the
      rear seam with a camera restriction. Desktop, tablet, phone and full-screen views were inspected.
- [x] **Gym light and pan station.** Brighter native task light, pan/dumbbell anchors and runtime held-object alignment
      accompany a real pan-raise activity. The pan transfers to the hand and returns; it is not just a static prop.
- [x] **Infinity pool.** A connected outdoor basin/access route uses the shared water/light clock. Native basin and
      clearance checks, rendered waterline and Walk water rejection are retained. Further house expansion stays open-ended.
      House evidence: [acceptance](../artwork/coastal-home/reviews/interior-acceptance.json),
      [contacts](../artwork/coastal-home/reviews/interior-contacts.json) and native review reports beside them.
- [x] **Eames and furniture runtime.** Original geometry, actual room anchors, near/full-screen LOD swaps, visibility,
      disposal and recovery are implemented. The copied configurator asset and temporary anchors are excluded.
- [x] **Aeron.** Original Carbon-default geometry with a real Mineral material alternative. Both LODs and material changes
      were inspected in the room, including full-screen close-ups.
- [x] **Italian range, hood and pot filler.** Original models use the kitchen anchors; the articulated pot filler,
      cooking clearances and fixed materials survive the shared material pass.
- [x] **Glass fridge.** Transparent doors reveal original interior contents in the actual kitchen.
- [x] **Dining table and six chairs.** A six-place table and woven chairs use exported floor-contact anchors.
- [x] **Pan, dumbbells, floating fireplace and fire.** Original models, held contacts, return paths and reduced-motion
      fire are checked. A final frame review caught a 30 cm mismatch between the furniture neck and the native flue;
      both delivered detail levels now meet the house pipe. Decoded mesh tests, a failing-original regression and four
      [actual joint/full-flue views](../artwork/coastal-home/reviews/furniture/fireplace-joint/README.md) retain the proof.
      [Furniture evidence and limits](../artwork/coastal-home/FURNITURE.md) retain nine initial renders and the corrected
      281,156-byte default / 835,064-byte fine unique payloads. The other twenty furniture GLBs and all anchors are unchanged.
- [x] **Creek, koi pond and onsen drip.** Both requested water features are implemented without a competing fluid solver:
      native carved creek/pond, five original koi, and droplets from the existing bamboo tip into the existing impulse
      solver. The garden is attached to the hinterland; bed depths are checked against native terrain. See
      [WATER-GARDEN.md](../assets/js/home-scene/WATER-GARDEN.md). The new hinterland is 1,468,104 bytes (+113,036).
- [x] **FFT ocean experiment.** A real 64-square inverse FFT/Phillips field drives shared CPU/GPU height, reflected water
      and wildlife contacts at the same time. It is opt-in at `?scene-lab=1&ocean=fft`; analytic water stays the default.
      [FFT-OCEAN.md](../assets/js/home-scene/FFT-OCEAN.md) records bounded forecast storage, upload cost and noisy matched
      timings. No speed superiority or general fluid-physics claim is made.
- [x] **Dynamic duvet, bounded implementation.** Coarse particles, compliant stretch/bending constraints and gravity
      deform the authored detailed quilt around its fitted contact envelope. Pause holds; reduced motion restores the
      exact authored mesh; the pillow stays static. The optimized Lizard run measured 281 particles, 3,237 constraints,
      3.6 ms median / 6.7 ms p95 update cost and 3.89 mm maximum observed displacement. This is not arbitrary body contact
      or self-colliding cloth. See [physics limits](../assets/js/home-scene/PHYSICS.md) and
      [retained evidence](../artwork/coastal-home/reviews/duvet/lizard-optimized.json).
- [x] **Public studio log and Tufte sidenotes.** A source-checked reflective post,
      [When the website talks back](../_posts/2026-10-23-when-the-website-talks-back.md), turns the private log into a public
      narrative under this continuation's publishing scope. Its three real footnotes become margin notes only where
      space permits; each original note remains one keyboard-linked node. Phone, no-JS and print retain endnotes.
- [x] **Representation/stylized-rendering review.** The [source/fit review](graphics-representation-review-2026-10.md)
      covers the named representation families and representative compression, anchor, dynamic and style descendants.
      A separate matched static-geometry ink comparison is implemented in the authoring lab; [real browser captures and costs](../artwork/coastal-home/reviews/graphics-studies/README.md) include photo cancellation, disposal and continued-input proof. The live home remains
      Realistic. Learned pipelines remain explicitly unimplemented below; a source review is not a reproduction.

### Existing features verified; experiments deliberately left for later

- [x] **Phone carousel:** the shipped scroll-snapped deck rows already implement the requested phone exploration.
- [x] **Laptop-lid scroll:** already implemented in the revamp page and its device script/styles.
- [x] **Honest loader:** uses real progress and the loading sketch; no simulated timer was added.
- [ ] **Moving temporal antialiasing:** remains deferred. Reliable history on moving characters/water needs motion
      vectors, disocclusion rejection and measured improvement; those are not implemented. The new 2–16-sample frozen
      photo experiment accumulates jittered final output in linear light, refuses a live view, aborts on changes, caps
      capture at 2.2 MP and restores the camera in `finally`. It is explicitly not moving-scene TAA. Keep both the
      experiment and this limit for the next model rather than relabelling supersampling as completion.
- [ ] **Trained representation replacements:** 3DGS/compressed/anchor/dynamic variants, neural LOD/variable bitrate,
      factorized fields, learned 2D discontinuities and learned stylization remain unimplemented. They need honest
      training, owned calibrated inputs and held-out views, actual browser bytes/costs and exact code/asset-license review.
      The source/fit review records a concrete revisit gate per family. No weights, paper demo assets or untrained
      placeholder were substituted for the functioning relightable mesh.

Earlier personal decisions (paper-link density, coffee-ring dry-in, race/battery behavior, star density, page naming,
marine-layer frequency, sunset and laundry) keep their current defaults. They are not silently decided by this pass.

### Data refresh: one exact external hold

- [x] **Google Scholar:** the paired October 23 citation/lens snapshot is fresh. This remains the publication freshness gate.
- [ ] **Build Rhythm and GitHub profile:** the full fail-closed collector completed all 310 repositories but rejected its
      aggregate. GitHub caught up from 23 to 24 October 22 credits, so the earlier exception question is obsolete. The
      second full scan now contains **25** distinct attributable commits for that day while the calendar still credits
      **24**. The additional default-branch commit is `6320a6b87842a9321c4004fba9e0114e2eb5424d`: its retained author date
      is October 22, 21:36:15 PDT, and its cherry-pick committer date is October 23, 01:59:36 PDT. The commit API confirms
      the author identity and dates. Default-branch count is 15; the unchanged `gh-pages` count is 10. All 310 cache
      entries match the collector source/mode and live eligible inventory. Previously reviewed exceptions still match;
      no other new public day discrepancy or annual-gap failure was found. A subsequent read-only probe still returned
      24 credits. Indexing/backfill delay is possible, not established. No exception was added, count deleted or date
      relabelled. Revisit when the calendar credits 25, then rerun the normal collector and all render/privacy/import
      gates before publishing. This remains unfinished; a successful scan count alone is not a fresh validated snapshot.

The last validated public profile and `_data/code_activity.json` remain through October 21. They were not marked fresh,
counts were not adjusted to force parity, and the retired token/agent-hour ledger was not revived. Private diagnostic
cache/proof files remain in `github-metrics-private/.local/`; no private repository inventory enters this site.

### Integrated verification

The combined production build, style contract, 241 Python tests and 595 Node tests pass (seven intentional Node skips,
602 total). The four-viewport 2026 archive case and both complete album-transfer/playback/navigation cases pass after
their fixtures were updated for the new post and graphics-study disclosure.
The 24-test affected-route checkpoint covers six routes at all four standard viewports in light/dark. New motion and
sidenote cases pass across Chromium viewports and desktop/phone WebKit, with actual phone taps checked separately.
Both prior Linux regressions also pass. Changed upstream overrides are re-acknowledged.

[Local acceptance and retained evidence](evidence/october-todo-completion-2026-10-23/README.md) distinguish native,
rendered, measured and deferred results. Release acceptance also requires exact-SHA CI/Pages and live content/assets;
those post-push results are tied to the published revision, rather than inferred from these local checks.
