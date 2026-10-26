# October 2026 handoff: resume here

**Current resume point: [Opus continuation checklist](#opus-continuation-checklist-started-2026-10-24).** Work it top to bottom; then read the [October 24 retreat revision](#october-24-retreat-revision) and the earlier sitewide goals and unresolved queue below it.
The dated queues, assignments and parked WIPs below it preserve history and custody; they are not a new implementation checklist.
`main`, the canonical briefs and current rendered evidence take precedence over an older plan.

Originally written October 22 before a token pause, then reconciled October 23 and 24. Local-only sources and private reports remain on Sirui's machine.

## Codex continuation brief (from 2026-10-26)

From October 24 to 26, 2026, Claude Opus coordinated this site with up to six parallel workers; Codex continues from here. This brief gives Sirui's intent and the working conventions. The checklist below gives each item's status, evidence and "Best effort so far" notes. Choose your own implementation. The intent, constraints and acceptance evidence matter more than any approach sketched here. Resume procedures further down this file are history.

**Sirui's intent, by stream.** Each item's details live in its checklist entry and owning brief.

- **The whole site.** Make it awesome, not minimal: polish the playful pieces (the 3D home, the La Jolla miniature, the coffee ring) rather than cutting them. Susan Kare's lessons in `WEBSITE_DESIGN_HEURISTICS.md` apply everywhere: meaningful and memorable first, just enough detail, a little motion. Make only claims the evidence shows (nothing "photoreal" or "state of the art" unless proven), and credit sources.
- **Brand.** The orange sun (item 26) is settled. Keep it the same everywhere (`material-lite-revamp.md`, Brand Mark).
- **The house** (items 8–10, 12 and 23). A retreat set into the La Jolla cliff that blends with the landform, with no carved-hole look. The pool and patio cantilever modestly, on a structure an engineer would believe. The house has:
  - one stair, and a sandstone pivot door at arrival;
  - living spaces kept private from the onsen path;
  - a spacious study with an open ocean view and a door to the patio;
  - the bed chamber beside the library;
  - a corridor of soft, rounded niches with sculpture and light;
  - a whiskey corner facing the sea.

  The interior, material and kitchen lessons came from a private study on October 25. Never name or link its source anywhere.

- **Life** (item 22). The five avatars:
  - hold up on a 4K screen;
  - meet tables, cups and cutlery without passing through them;
  - eat gourmet meals that change by day, naturally rather than in robotic loops;
  - sit in furniture you would stay in for hours (the dining armchairs are done);
  - enjoy whiskey evenings in the study.
- **Performance** (items 4–7 and 24). Push strong GPUs, such as a 4K PC with an RTX 3080, without lag or crashes. Keep phones smooth and load fast: the targets are ready in 10 s or less on the laptop and 15 s or less in phone emulation. Never flicker while zooming or walking. The quality tiers and `?perf=1` are on `main`; real-device numbers are the missing evidence.
- **Footer and miniature** (items 19–20). An honest, physically based dusk over measured hills with lit houses. It is not yet photoreal; the sky notes say why and what to try next.
- **Build diary** (item 25). A scrollable timeline on the 3D world's project page, like a construction team's record of a house going up, with sub-pages that show how human and AI iterations polished the world. Use the before and after captures the workers left in the review folders.
- **Loading sketch** (item 21). A line drawing that grows more intricate as loading really progresses.

**How the work was run.** Keep what helps.

- **Integration.**
  - One coordinator integrated through a detached LF worktree (`.claude/worktrees/integration`, with `git -c core.autocrlf=false`). It cherry-picked verified worker commits, ran the gates, pushed to `main` and fast-forwarded the main checkout. Workers never pushed.
  - Before deleting any `agent/*` branch or worktree, run `git log main..agent/<name>`: unintegrated work may remain.
- **Gates for each batch:**
  - Prettier on the changed files;
  - `npm.cmd run lint:style-contract` and `git diff --check`;
  - `python -m unittest discover -s test -p "test_*.py"` and `node --test test/*.test.mjs`;
  - when scene specs change, `node bin/run_visual_scene_group.cjs scene-core-1 --project all --verify-only`. Register any new scene test in `test/visual/scene-groups.json`.
- **Static light cache.**
  - When a signature input changes (home GLBs, the manifest, the furniture index, `controller.mjs` and other scene modules), re-bake with `node bin/bake_coastal_static_light.cjs`. Commit only the cache and its manifest descriptor.
  - Point `COASTAL_CACHE_URL` at a server whose baseurl matches the `_site` build. A root server for an `/al-folio` build 404s every asset, and the bake then times out at `lightField.ready`.
  - Expect only `inputs`, `signature` and `statistics` to change unless lighting geometry changed.
- **`coastal-home.blend`** has one writer at a time. Other 3D work uses separate `.blend` files and JSON anchors.
- **CI.**
  - Watch every push to success: eight workflows, 41 of them visual jobs.
  - Scene tests run on software WebGL in CI, where one page call can take 30 s. Read state from in-page recorders rather than tight polls.
- **Metrics.** Never push the site repo while the nightly "Dylan Local GitHub Metrics Refresh" task runs (1:15 AM Pacific, about two hours). At the end of a batch, follow the commit-activity rule in `AGENTS.md`.
- **Windows.**
  - Build `--baseurl /al-folio` from PowerShell, not Git Bash.
  - A worktree without `node_modules` can set `NODE_PATH` to the main checkout's; never junction it.

**Where to look:**

- the checklist below;
- `docs/homepage-desk-scene-brief.md` for the 3D home;
- `WEBSITE_DESIGN_HEURISTICS.md`;
- `docs/material-lite-revamp.md`;
- `docs/performance-notes.md`;
- the review folders under `artwork/coastal-home/reviews/` (house, life, first-person) and `.jekyll-cache/visual-qa/`, for evidence and rejected attempts.

**Starting prompt for Codex:**

> Continue Sirui's website from the current `main`. Read `AGENTS.md`, then the Codex continuation brief and the Opus continuation checklist at the top of `docs/october-2026-handoff.md`, then the owning brief for the item you pick. Take an open item whose evidence you can produce. Read its "Best effort so far" note and the retained attempts before trying again. Preserve Sirui's intent, the orange-sun identity, Inter, locked copy, personal voice and accurate credit. Prefer one verified checkpoint to a broad half-change: run the gates, re-bake the light cache when its inputs change, watch CI to green and check the live site. Mark an item done only when it is verified; otherwise leave an honest note with what you tried, the evidence and the next hypothesis.

## Opus continuation checklist (started 2026-10-24)

**How to read this list (Sirui, 2026-10-26):** there is no rush to finish it, because more usage windows will come. What matters is a clear picture of every item and a genuine best effort on each. Mark an item `[x]` only when it is verified. When an item still resists after a real attempt, leave it `[ ]` and add a **Best effort so far** note. The note says what was tried, the evidence, why it fell short, and the next hypothesis, so that a later model can pick it up rather than start over. A weak fix that passes a test is not a finish.

Sirui's requests after the retreat revision:

- The site and the 3D home lag on laptop, 4K PC and iPhone (Chrome on iOS, which is WebKit). Loading is long, and zooming and walking flicker and lag.
- Geometry intersections remain, in rooms, on people and animals, and outside.
- Commit stats must be refreshed without being asked.

He also approved four decisions:

- standing approval for recount-verified GitHub calendar gaps (see `AGENTS.md`);
- archiving the October 22 parked branches as `archive/oct22-*` tags;
- an automatic overlap audit plus a full visual sweep;
- tuning and verifying the phone tier in WebKit as well as Chromium.

Work the items in order. On Oct 24 Sirui allowed a few parallel agents: each works in its own worktree on files no other agent touches, and one coordinator integrates. Mark each `[x]` with its commit and evidence.

**Window 1: unblock and hygiene**

- [x] 1a. Fix the focus test `sitewide.spec.js:1863`. It focuses before `load`, so Chromium's later `#research` fragment handling resets focus to `<body>`. Wait for `load` first. **Done** in `2acd88996`; green in CI on `bbd32e659` (visual run 40137937323).
- [ ] 1b. Fix the night-door test `estate-redesign.spec.js:38/165`, new on Oct 24 and never green in CI. At 21:30 `scheduledOpen` stays true, so the routine and light update (`controller.mjs:1235`) did not apply. Reproduce in the Linux Playwright image and fix the cause. **Not reproduced:** it passed locally under software GL, and the Linux image timed out earlier in the test. It then passed in CI on `bbd32e659` (run 40137937323, attempt 1), so it is intermittent. `2acd88996` makes the assertion print the clock mode, activity, daylight and door state; if it fails again, start from that message.
- [x] 1c. Commit Codex's leftover `retreat-integration-2026-10-24/ci-repair` and `deployed` evidence. After CI is green, append the release receipt (workflow and job IDs, Pages commit) and update the retreat section's custody line. **Evidence committed** in `bbd32e659`; the receipt waits for a fully green visual run. **Receipt:** `85a6ece96` was the first fully green run: all 8 workflows passed, including all 41 visual jobs (visual run 40159669524). Pages commit `539e817ea` deployed it. See [release-receipt.json](../artwork/coastal-home/reviews/retreat-integration-2026-10-24/release-receipt.json).
- [x] 1d. Two new intermittent failures on `bbd32e659`: `interactions.spec.js:1474` (legacy job) failed once and passed on rerun; `desk-scene.spec.js:3276` (scene-journey job) timed out, and its rerun was cancelled by the next push. Check the next visual run, and reproduce whichever fails again. **Resolved:** `desk-scene.spec.js:3276` passed on `effe8aa15` and `a7c8534e5`. `interactions.spec.js:1474` failed again on `a7c8534e5`. The cause was real: after an outside click, focus stayed on `<body>` until the closing motion settled (0.7–4 s locally). `2eba41d12` returns focus when the press's click lands, so locally it comes back 0–4 ms after the click in 12 of 12 runs. On `a7c8534e5` the night-facade poll (`estate-redesign.spec.js:172`) also ran out of wall time 22 software frames in, just short of closed. `9258c6684` gives it 300 ms steps and a 120 s budget, and keeps the last state.
- [x] 1e. Two deterministic failures on `effe8aa15`, both fixed:
  - `desk-scene.spec.js:1608` (bone-texture release, scene-core-2 job) expected every replaced rig to have drawn. Since `9afa1dd00` the Walk body is only compiled until someone walks, so it never allocates a bone texture. `8b63a94c8` tags Walk rigs at disposal and keeps the leak check for every rig.
  - The Generated metrics contracts job runs the whole Python suite without `pypdf`, which the Oct 23 CV PDF test imports; it surfaced only because a code-activity refresh triggered that workflow. `be108a555` installs `requirements-cv-pdf.txt` there as `unit-tests.yml` does.
- [ ] 2. Add the end-of-batch metrics rule to `AGENTS.md` and memory, then refresh. The scan has failed parity nightly since Oct 23. Diagnose with the per-repo, per-day probe, record any recount-verified gap, scan, publish the profile, then import Build Rhythm. **Done:** the rule is in `38ff91361`. The Oct 23 shortfall (114 local commits, GitHub credits 112) is recorded in the metrics repo (`e34b8bb`, `295f490`). The Oct 24 scan passed parity and published profile `048b77c`; Build Rhythm runs through Oct 23 (`695de2001`).
- [ ] 3. Tag `agent/design`, `agent/scene-interior` and `agent/scene-furniture` as `archive/oct22-*`, then remove their worktrees and branches. **Done:** the `archive/oct22-*` tags exist, and GitHub keeps only `main` and `gh-pages`. The clean Oct 18 publish worktree was also removed, after unlinking its `node_modules` junction.

**Windows 2–3: speed and stability.** On Oct 24 the 3D home took 32.3 s to become ready on the Intel Arc laptop, against 7.4–8.8 s on Oct 12. Downloads end at about 2 s, and the batched warmup takes 1.8 s.

- [ ] 4. Baseline: `bin/profile_coastal_startup.cjs` cold and warm at 1440 DPR 1, at 390 DPR 3 with CPU throttling, and in WebKit iPhone emulation; `bin/measure_coastal_views.cjs` frame times; a frame-to-frame flicker metric over a scripted zoom and walk; mobile Lighthouse. Record them in `performance-notes.md`.
- [ ] 5. Loading. Target: ready in 10 s or less on the laptop and 15 s or less in phone emulation. **In progress:** checkpoint 1 (`8e9f92a58`..`1fb356c1f`, light cache re-signed in `15e894f83`) is a median of 3 interleaved pairs under heavy load. Cold desktop ready fell from 48.2 to 33.7 s: one camera-field classification, the light cache fetched with the first requests and aborted only on a stall, rooms requested at the manifest, the house compiled while they download, and the Walk head-cut variants moved after the first frame. Fewer and smaller programs come next.
  - Batch or defer the blocking compiles outside `program-warmup.mjs`: `walk-presence.mjs` (plain `render()`) and `interior-reflections.mjs` (a scene-wide `compileAsync` per mirror).
  - Fetch rooms and the light field in parallel with the shell and coast, and Draco-compress `pip.glb`.
  - Minify the `.mjs` modules in production (2.53 MB raw, about 776 KB gzipped).
  - Use `font-display: swap` for Font Awesome, and stop CDN CSS blocking render.
- [ ] 6. Flicker and lag:
  - a stable outdoor shadow fit with hysteresis and texel snapping, without a per-frame cache redraw (`controller.mjs:291-321, 2975`);
  - hold the resolution governor and the MSAA and shadow sizes during interaction;
  - hysteresis on culling and LOD, idle prewarm of LOD0 shaders, and a fade-in instead of a pop;
  - hysteresis on semantic zoom;
  - temporally stable haze and contact noise;
  - a mirror update rate tied to camera motion.
- [ ] 7. Phone quality tier (DPR, MSAA, shadows, contact shading, haze, mirrors) plus a `?perf=1` overlay with ready time and frame p50/p95, so Sirui can report real-device numbers.
  - **On `main` since 2026-10-26** as `61c94a86c`, `73a70c310`, `aa3111787` and `dd514f942` (from `agent/perf`). They add `quality.mjs` with a low/standard/high ladder and its governor, `?quality=low|standard|high`, and the `?perf=1` overlay. Standard draws exactly as before; automation stays pinned to standard unless `?quality=auto`.
  - **Still to do:** real-device numbers (an iPhone with `?perf=1`, and promotion on the 4K desktop), a `WEBGL_lose_context` test, and optionally a scene test for `quality` (it needs a `scene-groups.json` entry). Evidence is in `.jekyll-cache/visual-qa/perf-2026-10-24/`.

**Windows 3–4: geometry**

- [ ] 8. A general overlap audit, as a Blender script: mesh-to-mesh overlap volume and coplanar z-fighting faces across the shell, rooms, furniture and fixtures, in a ranked report. Fix the top offenders in the `bin/coastal_*.py` builders, then add a regression threshold.
- [ ] 9. A full-screen visual sweep of every room, station and key exterior view, fixing the visible intersections. Include people and animals.
- [ ] 10. Organic cliff transitions: contour cutters plus bevel, remesh or displacement on the box-Boolean faces (`bin/coastal_retreat.py` `_cut`), keeping the support and the terrace.
- [x] 11. South Park extreme down-look: exclude the primary-beauty head ownership (see the retained defect below). **Done** in `43968a1f5` ([head-exclusion review](../artwork/coastal-home/reviews/first-person-head-2026-10-24/README.md)). All five rigs bind the head rigidly, so primary-view draws submit a cached body-only index. Mirrors and sun shadows keep the whole person, and no shader variant or draw is added. Native fixture and real-house desktop/touch checks pass for all five avatars, and the control reproduces the defect.

**Windows 4–5: house follow-ups**

- [ ] 12. Put the bedroom and library next to each other: an adjacent spiral chamber, a route of 6 m or less (now 15.8 m including a 5.06 m bridge), with the bridge removed.
- [ ] 13. Build one authored pool activity, with contacts, entry and exit, camera and recovery.
- [x] 14. Weather: 14a and 14b in `6d0efabe5` and `e8d734208`, 14c and 14d in `93789ceee` (rain is now a world-stable shower that reads as rain, still one draw) and `551610ecf`. Overcast lighting still keeps crisp shadows; that follow-up belongs to `atmosphere.mjs`.
  - [x] a daily workflow. `.github/workflows/update-weather.yml` refreshes the NWS hourly snapshot at 10:25 UTC with `GITHUB_TOKEN`, so its pushes start no CI and the scheduled deploy publishes them. On an outage or stale data it keeps the last valid snapshot.
  - Follow-up: `bin/verify_coastal_retreat_interactions.cjs` pins a natural rain case on 2026-10-30 inside the Oct 24 snapshot. Re-point or retire that case the next time it is used. It is not in CI.
  - [x] a better long-range model. A CV-selected ridge logistic weather generator (14 terms: harmonics, wet-day memory, yesterday's amount, days since rain) scores held-out Brier 0.08089 against 0.08416 for the old model, and is better in 9 of 10 held-out years. ENSO did not help and is left out. See `artwork/coastal-home/weather-2026-10-24/README.md` and `model-evaluation.json`.
  - [ ] verify that rain renders, and document it honestly (14c, in progress).
- [ ] 15. Optional: relocate the laundry bay, only if the pool close-up clearly improves.

**Sirui's Oct 24 evening requests (parallel streams; the coordinator integrates)**

Sirui reviewed live on a laptop, then on a 4K PC with an RTX 3080. Each request went to one worker, in its own worktree:

- [x] 18. Coffee ring, for "doesn't look like a stain from coffee", the over-busy animation, and on top of the cards. **Done** in `a38862db7`. It now draws the band a mug's foot prints: coffee at both pinned edges and a clean inside. The drop-shaped rim had caused a Cornsweet pale-disc illusion. It rests on the top slip clear of the words, and arrives as one soft 3.2 s settle.
- [ ] 19. Connect balance, with the La Jolla miniature moved up (sky worker, S1).
- [ ] 20. Footer dusk (sky worker, S2). Sirui chose all four parts: sky gradient, page-to-sky edge, change over time, and sun, sea and haze. The background band must read as the hills behind the coast, with lit houses, not as sea.
- [ ] 21. Loading sketch: more detailed line drawing that reveals real progress (sketch worker, formerly weather).
- [ ] 22. Characters at 4K, hand-table contacts, gourmet food, drink and dessert by day, natural eating and drinking, and comfortable furniture (life worker).
  - **Paused 2026-10-26.** Meals (L1–L3) are on `main`.
    - The Lizard's rebuilt face skin is on `main` as `af630dc87`.
    - WIP `1fc4d2cdf` is not for `main` as it stands. It holds the dining armchairs (baked; seated fixture `bin/review_coastal_seating.py`), fridge labels 1.5 mm proud of the glass, and the whiskey corner furniture with six text-free bottles. The whiskey corner is exported but not baked.
  - **Remaining:**
    - Re-export the armchairs with the crowned cushion and review them at the table.
    - Raise the Lizard 1.2 cm on the banquette.
    - Bake and review the whiskey corner, run its feet-up fixture, and wire the whiskey-evening routine to the house's `study-whiskey-lounge` anchor.
    - Then the banquette, cloud sofa and Eames lounge.
  - Dining chairs become comfortable armchairs with armrests, so people can sit and chat for a long time (Sirui, Oct 25).
  - The study gets a whiskey corner facing the ocean, built with the house worker (Sirui, Oct 25):
    - a comfy small loveseat and ottoman;
    - a side table with a decanter and tumblers;
    - a small display of five to eight bottles with invented labels;
    - an evening-drink routine there on whiskey days.
- [ ] 23. Architecture, all in the house worker's queue:
  - the exterior blended into the cliff, with no carved holes;
  - pool and patio cantilevered modestly on a feasible structure;
  - entrance geometry, and privacy from the onsen path;
  - one stair, with the main pivot door on the textured lower-living wall;
  - a spacious study with unblocked views and a door to the patio;
  - the bed chamber beside the library (option B);
  - a corridor with rounded niches, sculptures and soft light.
- [ ] 24. Hardware-adaptive quality, with a high tier for strong GPUs that never lags or crashes (perf worker, with item 7).
- [ ] 25. A build-diary timeline on the 3D world's project page, plus sub-pages (story worker).
- [x] 26. Logo, after the Susan Kare study (Sirui, Oct 25–26). Sirui chose direction C of three: an orange that is also the sun going down into the Pacific, the same on every visit. The navbar, favicon set (16-pixel grid, `bin/build_brand_icons.cjs`) and home-screen icon now share it, replacing the 2024 "S" tab icon. The procedural orange grows on the 404 page. The contract is in `material-lite-revamp.md` under Brand Mark.

**Final window**

- [ ] 16. Update this handoff, the performance page and records, and durable heuristics or skills. Refresh the successor prompt.
- [ ] 17. Refresh the commit stats under the `AGENTS.md` rule, and check Scholar freshness.

## October 24 retreat revision

**Current implementation:** the house is eight metres inside the cliff, with a lighter rock-supported pool court, curved lower-living arrival, separate private onsen route, one bowed internal stair, usable patio access, clifftop seating and warm guide lighting. The complete workstation now occupies one tall library with a rolling ladder and hearth; the upstairs office becomes private living. Public curtains frame the view. Bathroom stone, fitted planting and night fixtures are refined. The local weather artifact combines a date-limited NWS snapshot with NOAA-derived seasonal simulation; it is not a live or SOTA forecasting service.

[The house review](design-reviews/2026-10-24/HOUSE_REVISION.md) owns actual before/after judgments, proof and tradeoffs. [Portable evidence](../artwork/coastal-home/reviews/retreat-integration-2026-10-24/README.md) retains the final assets and failed diagnostic history. Earlier `b66903e74` deployment facts below remain historical and do not verify this changed runtime. The first candidate `162685ac8` exposed inlet, gull-framing and recovery-fixture failures in CI; the [repair review](../artwork/coastal-home/reviews/retreat-integration-2026-10-24/ci-repair/README.md) records their concrete fixes and unchanged assertions. Final source, CI and deployed custody is recorded in the [release receipt](../artwork/coastal-home/reviews/retreat-integration-2026-10-24/release-receipt.json). The first fully green run, `85a6ece96`, carries the retreat runtime plus the later integrated batches, and Pages commit `539e817ea` deployed it.

The final native source is `c1fced7e108395b64ca7c8ad96e9a275d131b47115d4cbaf334da48701940027`, with shell `209d5a92?`. Actual exported planting roots now contact rock; the earlier 3?8 cm positive-gap receipt is before evidence. Fresh native companion proof covers all 420 flights with the unchanged 0.42 m envelope. The light cache and loading drawings are rebuilt from these assets. Native geometry, compressed delivery, browser input and deployment each have their own scope; do not substitute a source count for a visitor journey.

### House follow-ups that remain real

| Item / owner                                   | Observed limit and next decisive move                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bedroom adjacency ? architecture owner         | The functioning spiral route still requires 4.2 m of bedroom approach plus 7.4 m of upper connection, including a 5.05 m bridge. Propose an adjacent stair chamber and actual new floor openings/footprint. Require native and delivered body clearance, guards, companion flights and comparable bedroom/library views; another route-only patch cannot meet the proximity request. |
| Organic cliff transitions ? architecture owner | The heavy freestanding pool frame is gone, but the excavated sandstone still has large angular Boolean faces. Test one genuine contour/section repair with unchanged rock support and usable terrace, then compare the same exterior. Do not merely conceal geology or call the result photorealistic.                                                                               |
| Phone smoothness ? device/performance owner    | Host Intel Arc desktop and 390-pixel touch emulation prove function, not phone FPS, thermals or touch-joystick quality. Profile one real device before selecting a bottleneck-specific optimization.                                                                                                                                                                                 |
| Laundry service bay ? optional taste decision  | Retained playful cloth still crosses the pool close-up. A deliberate relocation needs the posts, cloth, wind/constraint frame and cameras to move together. Do not hide only its cloth.                                                                                                                                                                                              |

Unbuilt pool activities, bounded graphics approximations and optional Search Console/maintenance questions remain in the earlier queue below. Ladder climbing is an explicit non-goal. Forecast expiry to seasonal simulation is intentional. GA4 Viewer access and private analysis are already complete locally; no credentials or private rows belong in this handoff or Git, and tracking remains unchanged.

The design lesson stays in the canonical brief: carry a housing transform through every CPU/GPU/material/fixture/contact frame exactly once; inspect decoded planting roots rather than accepting a name or permissive clearance; prove animation after ready, with a furnished image and later frames. A stalled shared-browser diagnostic does not prove a visitor defect; keep it and compare fresh full-quality processes. These are bounded lessons, not another duplicated skill checklist.

## October 24 closeout and next review

### Goals to carry forward

- **Less, but more Sirui:** personal, playful, thoughtful and serious about evidence. Preserve Inter on the website, the orange identity, coastal atmosphere, locked copy, research sequence and authorship/credit. Papers remain accessible; the homepage is not a paper-first showcase. The PDF CV keeps its separately recovered typography through its owning recipe.
- A visitor should understand Sirui's intellectual direction, find relevant work/resources, and assess an appropriate next step. More clicks, longer visits, larger counters or more effects are not goals by themselves.
- The inhabited home should feel connected, warm and intentional, with grounded poses, reliable circulation, clear state/recovery, coherent light and bounded loading/rendering cost. Its routine is authored fiction, not live location tracking.
- Improve the operational question when evidence warrants it and state changed assumptions. Do not redefine success around whatever is easiest to ship, or silently replace Sirui's taste with a generic portfolio style.

### Closeout release verification

The published runtime is `b66903e74a95a9b545611bbe6705d27d68b2f1fa`, served by
Pages commit `20bdc88eb70c3afe47886b8de2f829a56cee46d9`. The Pages build is `built`
and its commit names that exact source. Its public runtime assets are identical
to `a6ac4455a6c76c518b5be4e6767c157f2f82404f`; the follow-up changes only the
frozen-clock test calls and their scene-brief guidance.

- **CI:** All **41 visual jobs passed**, and the [visual workflow](https://github.com/DylanTao/dylantao.github.io/actions/runs/40097492943) is terminal success. [Integration](https://github.com/DylanTao/dylantao.github.io/actions/runs/40097492993), [formatting](https://github.com/DylanTao/dylantao.github.io/actions/runs/40097492886), [CodeQL](https://github.com/DylanTao/dylantao.github.io/actions/runs/40097492928), [deployment](https://github.com/DylanTao/dylantao.github.io/actions/runs/40097492985) and [post-deployment links](https://github.com/DylanTao/dylantao.github.io/actions/runs/40097648197) passed on `b66903e74`. The push link workflow intentionally skips. Upgrade was not triggered by the test/brief follow-up; it [passed on the identical-runtime source](https://github.com/DylanTao/dylantao.github.io/actions/runs/40096299445). The [final receipt](design-reviews/2026-10-24/RELEASE_VERIFICATION.json) records exact source, workflow and job identities, independently checked at 13:57 UTC.
- **Local checks at the integrated runtime checkpoint:** 288 Python tests passed; Node reported 699 passed, seven optional GPU skips and zero failures. The 30 focused native-collar/presence tests passed. Style contract, all four changed skill validators, canonical-LF formatting and `git diff --check` passed. The complete production `/al-folio/` Docker build passed. The interrupted native Windows build is not acceptance evidence. The test/brief-only `b66903e74` follow-up additionally passed the targeted Linux recovery and scene-group inventory checks below.
- **Deployed Walk:** [desktop/mobile receipt and captures](../artwork/coastal-home/reviews/first-person-collar-2026-10-24/README.md#exact-deployed-acceptance) pass on Intel Arc D3D11 with full assets, native clocks and no module overlays. Both actual browser module hashes match canonical source; down-look, liner-hidden diagnostic/restoration, source switch, full native mirror and return to the bath routine pass with no runtime errors. This is touch-viewport evidence, not physical-phone or entrance-route proof.
- **Deployed counter:** [all six states](design-reviews/2026-10-24/ANALYTICS_REVIEW.md#deployed-verification) pass on the actual built script with synthetic values and no script override. One earlier unlocalized HTTP 503 and the single diagnostic retry are retained; no network-reliability claim follows. No real counter increments or analytics were sent by this check.

The first closeout matrix on `a6ac4455a` exposed frozen-clock shader warmup waits:
five callers omitted the existing helper's `page` argument. All 13 observed
failures had that cause; the superseded run was cancelled. `b66903e74` services
the existing clock-aware wait without changing assertions, timeouts, scene
quality or runtime. The exact formerly failing mobile breakfast recovery passed
on qualified Linux Mesa, and the scene-group inventory retains all 112 registered
cases per viewport with no missing, extra or duplicate cases.

The final receipt commit changes only Jekyll-excluded `docs/` and `artwork/`
evidence and uses `[skip ci]` to avoid repeating an unchanged runtime matrix.
Runtime verification belongs to `b66903e74`; the later metadata HEAD is not a
claim of another deployment. Raw closeout captures/logs remain in ignored
`.jekyll-cache/`, including all 184 byte-verified files copied from the collar
worker before removing only that completed worker worktree. Historical
design/interior/furniture worktrees remain preserved.

### Earlier verified baseline

The latest fully verified runtime before this closeout is `c14e73b3a6df92a8793505acf939532d95accd0b`.
All [41 visual jobs](https://github.com/DylanTao/dylantao.github.io/actions/runs/40086812406),
[integration](https://github.com/DylanTao/dylantao.github.io/actions/runs/40086812490),
[CodeQL](https://github.com/DylanTao/dylantao.github.io/actions/runs/40086812520),
[formatting](https://github.com/DylanTao/dylantao.github.io/actions/runs/40086812486),
[deployment](https://github.com/DylanTao/dylantao.github.io/actions/runs/40086812427) and
[post-deployment links](https://github.com/DylanTao/dylantao.github.io/actions/runs/40087003367) passed.
Pages commit `63626f8d6a22d02bbd70c0b7c6e0626832cf3f97` names that exact source.
The public Focus page matched the local production preview at desktop/mobile in noon/evening, with unchanged copy and no overflow/runtime errors.
The local Python suite passed 288 tests. These are dated results; recheck current Git/runtime state before relying on them after further changes.

| Completed area             | Current record and boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original October queue     | The [October 23 reconciliation](#october-23-reconciled-checklist) closes the icons, motion, landscape, furniture, water-garden, studio-log and retained graphics-comparison work. Do not cherry-pick parked WIPs over the newer integrated sources.                                                                                                                                                                                                                                                                                                                                       |
| October 23 estate baseline | [Estate evidence](evidence/coastal-estate-2026-10-23/README.md) covers the supported pool terrace, pavilion/BBQ/wet bar, grounded garden, independent living/private entrances, moving doors, two-floor cave library, bedroom connection, lighting, loading and circulation. [Bathrooms](evidence/coastal-bathrooms-2026-10-23/README.md) and [mirrors](evidence/estate-mirrors-2026-10-23/README.md) retain their own acceptance and limits.                                                                                                                                             |
| First-person Walk          | [Native and real-house review](../artwork/coastal-home/reviews/first-person-collar-2026-10-24/README.md): a fitted primary-only collar liner closes the measured sightline; refreshing actual draw materials fixes initial upstairs face exposure after style replacement. All-five native checks and final desktop/mobile D3D11 house acceptance pass. One added small draw; host timings do not establish phone performance. The [head-exclusion review](../artwork/coastal-home/reviews/first-person-head-2026-10-24/README.md) closes South Park's extreme-down defect (`43968a1f5`). |
| CV                         | The canonical JSON drives web/JSON/PDF. The four-page tagged PDF uses `HCI` in the print gutter with aligned descriptions; the unpublished entry is `Manuscript under review.`. [Recipe](../artwork/cv/README.md) and its receipt own current output; older evidence hashes are checkpoints. No full PDF/UA certification is claimed.                                                                                                                                                                                                                                                     |
| Mobile Research Focus      | [Before/after review](design-reviews/2026-10-24/FOCUS_ITERATION.md): same copy, 14/16 px labels/titles, native touch/keyboard controls and forced-colors selection; about 128 px more mobile scrolling. Desktop layout stays intact. Rendered legibility is verified; comprehension/recall are not.                                                                                                                                                                                                                                                                                       |
| Discovery                  | [Discovery evidence](evidence/discovery-accessibility-2026-10-23/README.md) and [SEO guide](SEO.md) cover canonical metadata, source-linked machine formats, truthful CV/paper projections and generated-output validation. Technical availability does not establish ranking.                                                                                                                                                                                                                                                                                                            |
| GA4                        | [Read-only reporting](ga4-readonly-analysis.md), the first historical aggregate export and executed analysis are complete. On this machine, private setup/analysis start at `.codex/local/analytics/LOCAL_SETUP.md` and `analysis/ANALYSIS.md`. These files are ignored and absent from a fresh clone. Never copy credentials, raw rows, notebook outputs or sparse audience data into Git. Tracking/settings are unchanged.                                                                                                                                                              |

### Remaining work and decisions

The closeout also corrects the separate blog counter from "people read it" to "views": its source is `page_pv`, not distinct people or completed reading. [Synthetic before/after evidence](design-reviews/2026-10-24/ANALYTICS_REVIEW.md#october-24-counter-label-correction) covers the display change and unchanged requests. This does not decide whether that third-party counter should remain.

These items remain alongside the newer house follow-ups above. A missing measurement, an unbuilt feature and a defect require different next moves.

| Item and status                                                 | Evidence / attempts                                                                                                                                                                                                                                                                                                                                                                                                                   | Next decisive action and acceptance                                                                                                                                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| South Park extreme-down head silhouette — closed 2026-10-24     | The [head-exclusion review](../artwork/coastal-home/reviews/first-person-head-2026-10-24/README.md) swaps in a body-only index only in primary-view `onBeforeRender`. The shadow pass uses `onBeforeShadow`, so no shadow geometry is lost. The native fixture keeps mirror and sun-shadow hashes for all five styles. The real-house desktop/touch check covers all five avatars at pitch −1.4, plus walking and the routine return. | None. A future avatar must keep rigid Head ownership (`test/walk-head-exclusion.test.mjs` asserts it), or the body-only index will need a blended-weight rule.                                                                          |
| Physical-phone performance — evidence gap                       | [Estate limits](evidence/coastal-estate-2026-10-23/README.md#retained-limits-and-next-inspections) distinguish host-emulated stress traces from hardware evidence.                                                                                                                                                                                                                                                                    | Record a real phone/browser, cold/warm state, walking/orbit path, frame-time distribution and thermal behavior. Use a matched target before claiming faster phone rendering. No device session is currently available to this agent.    |
| Pool swimming/stool/lounger activities — unbuilt feature        | Distinct swim lane, shallow shelf and stool bay are modelled; Walk excludes water. Existing idle/bath clips are not proof of swimming or supported pool seating.                                                                                                                                                                                                                                                                      | Choose one authored activity, then prove native contacts, privacy, entry/exit, support/water behavior and camera/recovery for the intended avatars. Preserve current safe walking behavior until that evidence exists.                  |
| Broad mainland/coast diffuse receivers — retained approximation | The current night views and per-material lighting budget are accepted; broad batches use bounded receiver approximations.                                                                                                                                                                                                                                                                                                             | Reopen for a visible local lighting error. Partition only that batch and compare the same view/time/material with shader, cache-size and frame-cost evidence.                                                                           |
| Reader outcomes — unperformed reader tasks                      | Focus legibility and the two entry-page inspections are rendered evidence. They are not unfamiliar-reader feedback.                                                                                                                                                                                                                                                                                                                   | Ask a reader to explain the research connection and retrieve a relevant resource. Record actual paraphrases and wrong turns; keep successful composition.                                                                               |
| Activity/DesignWeaver entry refinements — hypotheses            | Mobile activity shows identity/chart context but research context requires global navigation. DesignWeaver exposes question/contribution/Paper/Code immediately; citation is farther down. Private `analysis/FOLLOW_UP_TASKS.md` retains the data grain and inspection paths.                                                                                                                                                         | Task-test direct arrival. A quiet research-context link or opening citation anchor is conditional on observed friction, not an automatically required patch. No source-to-landing relationship is inferred from separate GA breakdowns. |
| Search visibility — unverified outcome                          | GA referral attribution is available; Search Console query/indexing reports have not been inspected. No AI-rank or popularity increase is established.                                                                                                                                                                                                                                                                                | Use separately authorized Search Console reporting if a specific question needs it. Compare like periods and keep measured referrals separate from ranking or all AI-mediated visits.                                                   |
| Measurement policy — Sirui decisions                            | Consent/retention/filter settings and the privacy boundary for the separate counter were not audited. Proposed resource/contact events are not implemented.                                                                                                                                                                                                                                                                           | Agree the first learning audience, useful outcome definitions and privacy boundary before instrumentation. Read-only access is not permission to alter collection or key events.                                                        |
| Maintenance/retell/research ideas — deferred by evidence        | September's roadmap is historical. Focus-mixin consolidation and a local purge-parity lane are maintenance candidates. Retell waves and unreproduced representation families retain their [backlog](design-experiment-backlog.md) / [fit-review](graphics-representation-review-2026-10.md) gates.                                                                                                                                    | Reopen for a concrete defect, useful story or source-backed experiment. Keep the rejected trained replacements rejected until their quality/relighting gate changes. Do not claim named-paper reproduction from the bounded trainers.   |

Earlier personal choices keep their current defaults. Open-ended "make it nicer" or "expand as needed" language does not create an endless required feature list. A successor may identify a better opportunity, but must show the observation, expected benefit, tradeoff and decisive evidence.

### Resume procedure and stopping rule

1. Check `git status --short --branch`, live ancestry and worktree ownership. Pin every GitHub command to `DylanTao/dylantao.github.io`; this fork's `gh` default can resolve to upstream al-folio. Preserve concurrent sources; the old design/interior/furniture worktrees contain historical custody and must not be deleted merely because their feature names now exist on main.
2. Read this current section, [Decision Order / Continuing And Handing Off](../WEBSITE_DESIGN_HEURISTICS.md#continuing-and-handing-off), and the owning brief/evidence. Read older history only when it resolves a specific question.
3. Critique one current route/state against Sirui's goals. Keep is a valid decision. Review retained attempts first, then try a changed bounded repair when it can answer an unresolved hypothesis. Preserve rejected results and their reason; a successor need not repeat them to prove effort.
4. Use one owned server and comparable baseline; perform proportional desktop/mobile, input, accessibility, loading/error and performance checks for the change. Do not rebuild or repeat a passing full matrix without a new change or unresolved question.
5. Integrate explicit paths through one coordinator and record actual local/CI/deployed scope. Each open item ends with one next decisive step, not "a smarter model will fix it." Continue useful changed hypotheses; stop when the bounded question is answered, required evidence is unavailable, or a larger experiment's cost/risk is disproportionate to the current benefit. Record that reason rather than inventing a model-capability blocker.

Copy-paste starting prompt for Opus or a later model:

> Continue Sirui's website from the current main, not from the historical queue. Read the October 24 retreat revision and earlier closeout in docs/october-2026-handoff.md, WEBSITE_DESIGN_HEURISTICS.md and the owning scene/content brief. Preserve locked copy, Inter, orange/coastal identity, personal voice, accurate credit, accessible papers and existing tracking. Critique the live result independently. Choose one evidenced remaining problem or useful bounded experiment; keep working composition when no defect is shown. Review retained attempts, test a useful changed hypothesis before deferring a known issue, compare the same state, and retain actual outcomes and tradeoffs. Refine operational goals transparently without replacing Sirui's intent. Use proportional checks and finish a verified checkpoint. Update the existing handoff/backlog and only the smallest reusable skill/heuristic lesson. Record actual model/effort if exposed; otherwise mark it unknown. Keep credentials and private analytics local. Do not repeat completed work or invent improvements to fill a quota.

## Historical working rules and sequencing

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

## Original resume procedure (October 22, historical)

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

## Parked work at October 22 (historical local custody)

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

## Original October 22 queue (historical)

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
      Realistic. The later trained comparisons below add actual weights and held-out tests; the named paper families are not thereby reproduced.

### Existing features verified; final bounded experiments

- [x] **Phone carousel:** the shipped scroll-snapped deck rows already implement the requested phone exploration.
- [x] **Laptop-lid scroll:** already implemented in the revamp page and its device script/styles.
- [x] **Honest loader:** uses real progress and the loading sketch; no simulated timer was added.
- [x] **Moving temporal antialiasing experiment.** The opt-in `?scene-lab=1&antialias=temporal` now uses actual prior
      geometry/bones/CPU vertices, projection jitter, HDR history, depth rejection and neighborhood clipping. In the
      independent moving-pose fixture, edge error falls about 65% and variation of frame error about 72%; a disabled-depth
      negative control fails the revealed-surface criterion. Actual house controls, skin/CPU/camera vectors, reactive
      transparency, haze depth, failure restoration, geometry release and the 1.1 MP fallback are checked. Shader/water
      coverage remains conservative, and the public spatial default stays in place. The frozen-photo experiment remains
      a separate spatial method. See [implementation and limits](../assets/js/home-scene/TEMPORAL-AA.md).
- [x] **Trained replacement assessment: two candidates rejected.** A genuinely trained 2D print field and a calibrated
      3D Gaussian furniture fit now have owned inputs, real exported weights, held-out evaluation, browser bytes/costs,
      numerical checks and native Chromium/WebKit interaction/disposal evidence. The 77,896-byte print field loses ink
      detail (21.06 dB held-out RGB); the 10,240-byte Gaussian fit loses furniture detail (14.19 dB held-out foreground)
      and fixed-color splats do not preserve relighting. Retain the original image and mesh. The
      [updated representation review](graphics-representation-review-2026-10.md#trained-comparisons-and-adoption-decisions)
      records these completed negative comparisons and their exact revisit gates.

**Future research, without reproduction credit:** TensoRF, neural LOD/variable bitrate, learned anchors/compression,
dynamic splats, learned discontinuity curves and learned stylization are still not implemented. The two original
bounded trainers are not substitutes for those named methods. Their evidence-based rejection closes the present
replacement decision; each family remains documented for a later model rather than being claimed as shipped.

Earlier personal decisions (paper-link density, coffee-ring dry-in, race/battery behavior, star density, page naming,
marine-layer frequency, sunset and laundry) keep their current defaults. They are not silently decided by this pass.

### Data refresh: approved and validated

- [x] **Google Scholar:** the paired October 23 citation/lens snapshot is fresh. This remains the publication freshness gate.
- [x] **Build Rhythm and GitHub profile:** Sirui's October 23 reply approved the exception capped at one commit for
      October 22 in this website repository. The original question observed 24 scanned versus 23 calendar credits;
      the latest independently verified history has **25** versus **24**, still within that exact repository/date cap.
      All 25 measured commits remain: 15 on the default branch and 10 deploy-only on `gh-pages`. The additional
      cherry-pick `6320a6b87842a9321c4004fba9e0114e2eb5424d` retains its October 22, 21:36:15 PDT author date and
      October 23, 01:59:36 PDT committer date. No cause for the calendar difference is asserted.
      Collector revision `8684a9b` records the approval; larger, reversed, other-date and other-repository differences
      still fail. All 190 private collector/privacy tests pass. The normal collector then rescanned all **310**
      repositories with **zero cache reuse** and passed inventory, branch-head, annual/day attribution and stability
      checks. The validated public snapshot has **3,340** daily points through **October 22**, **43,455** lifetime
      commits and **38,666** authored commits. The new day contributes 275/265; every earlier daily row is unchanged.
      The five-file bundle, both theme SVGs and the unchanged README passed fresh private-name privacy checks;
      independently rederived weekly totals and all 310 cache-row sums agree. The profile is published at
      [`895f903`](https://github.com/DylanTao/DylanTao/commit/895f90388c789e4cdf539f037c9db7fac2d16b6d), and the normal
      site importer passed its check and imported the same snapshot.

The public profile and `_data/code_activity.json` now cover October 22. No counts or dates were changed to force parity,
and the retired token/agent-hour ledger was not revived. Private diagnostic cache/proof files remain in
`github-metrics-private/.local/`; no private repository inventory enters this site. The final continuation above resolves moving TAA as an opt-in experiment and replacement assessment through two trained negative comparisons; unreproduced research families retain explicit notes.

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

### October 23 discovery, accessibility, and skills continuation

The follow-up keeps Sirui's writing and research facts while improving how visitors and search systems reach the existing record:

- [x] Collection-based post/project metadata, honest project genres and known dates, removal of the nonexistent search target, and the stable Pip AI anchor.
- [x] Specific CV search metadata and a JSON alternative linked to the canonical Person, plus the configured Google verification token. This is technical publication, not evidence of account verification or ranking.
- [x] CV H2/H3 semantics, stable unique section IDs, native no-JavaScript links, keyboard arrival, contact row headers/mailto, and a scoped current-web print layout.
- [x] Current PDF: the later source-recovery continuation rebuilt all four tagged pages from the same canonical JSON as the web CV, preserving credits, rejection notes and links. Earlier July statistics were not carried forward or guessed. The historical earlier-version labels have been replaced by current-format labels.
- [x] Honest navigation timing and once-only numeric scroll milestones, with meaningful old-implementation regression failures.
- [x] Generated discovery checks in the existing CI entrypoint compare actual writing/catalog records, schemas, format fragments, and current CV JSON. New fixture tests cover both deployment baseurls and malformed projections.
- [x] Outcome-based reflective practice in the canonical heuristics and the existing portfolio-writing, website-design-critique, and tacit-knowledge skills. The SEO guide now documents the actual site and a measurement plan.
- [x] Footer-credit reduced-motion cascade correction, with a failing-old-build regression and unchanged sunset/dusk contrast checks passing on Windows and Linux desktop/phone. The source preserves the existing credit colors and coast.
- [x] Legacy album functional proof uses controlled frames after actual first-draw readiness. Original real-input and state assertions remain; Chromium/WebKit pass on Windows and Linux without a runtime change or larger timeout.

[Discovery evidence and remaining boundaries](evidence/discovery-accessibility-2026-10-23/README.md) retain the observed problems, decisions, earlier checkpoints and unmeasured search outcomes. The native PDF source boundary is now resolved.

### Final October 23 continuation

- [x] Recovered the matching native public CV design through a bounded connected-source search, without copying private general-CV material into the repository. The [four-page current PDF, licensed typography, source recipe and acceptance evidence](evidence/current-cv-pdf-2026-10-23/README.md) keep web, JSON and PDF facts aligned. The canonical reflective-practice note and writing skill now route future CV work through this recipe.
- [x] Extracted the hidden globe's inline stylesheet and script into owned assets. Ciphertext, access behavior, privacy metadata and text remain unchanged. A measured PurgeCSS safelist preserves all 271 rules; desktop/phone before-and-after captures, four-width real interactions, no-JS behavior and the complete keyboard/refresh journey pass. See [extraction evidence](evidence/secret-globe-extraction-2026-10-23/README.md).
- [x] Completed the two bounded graphics investigations above with actual native rendering and trained artifacts. No lower-quality image or furniture replacement was introduced.

Local integration: the production build, generated discovery validator, 267 Python tests, 606 Node passes (seven intentional skips), scoped formatting/style checks and registered native moving-TAA case pass. The TAA case also passes in Linux Docker with its disabled-depth negative control. Release acceptance remains bound to the exact pushed source, all terminal CI jobs, Pages deployment and current live bytes; ignored release receipts retain those later results.

Search ranking and recommendation frequency remain unmeasured. No promise of popularity or first-place search placement is inferred from one private message. Sirui's identity, research facts and personal defaults remain the reference for future improvements.
