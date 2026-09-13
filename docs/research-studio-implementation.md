# Research studio and inhabited coastal home

Integrated on `main` after the local review branch, based on `bba74ccc1`. This is a local deliverable; no production push or deployment is included. Follow-up edits default to `main` for this single-owner checkout.

## Open and review

- Website: [localhost:8080](http://localhost:8080/?cinematic=live), also open in the Codex app.
- Start/restart the owned preview with `docker compose up -d`. Compose serves the personal site with an empty base URL; the separate production check uses `/al-folio`.
- Start in 2D on every screen; an explicit mode choice survives for the session. A page refresh chooses a new Sirui, avoiding the immediately previous avatar. Public 3D opens in Realistic with Look around / Back inside and pause. The San Diego routine runs automatically. The same capybara beach-party print hangs on the wall for every character.
- For authoring and deterministic checks only, add `?scene-lab=1` to expose room, avatar, activity, time, and album controls. These controls are hidden and inert on the public page.
- Inspect the isolated [depth study](http://127.0.0.1:4106/artwork/coastal-home/splat-lab/). To restart it, serve the repository root with `python -m http.server 4106 --bind 127.0.0.1`.
- [Latest habitat evidence](evidence/coastal-section/README.md), [Realistic evidence](evidence/coastal-realism/README.md), [preceding refinement](evidence/coastal-home-refinement/README.md), [original sitewide checkpoint](evidence/research-studio/README.md), [scene brief](homepage-desk-scene-brief.md), [asset provenance](../artwork/coastal-home/PROVENANCE.md), and [splat findings](../artwork/coastal-home/splat-lab/FINDINGS.md).

## What changed

The homepage now leads with the research question, selected DesignWeaver and What Happened and Why work, then thesis/research, publications and updates, and students/contact. Newsreader provides display typography; Inter remains the reading/control face. Repeated framing was shortened while signature copy and original research figures remain intact.

Projects expose a direct case-study link alongside their existing previews. The blog opens with its first paragraph before a desktop contents rail or compact mobile disclosure. CV sections use open paper and hairlines; the Wall of Rejection remains near the top of publications with smaller badges, a tighter XP panel, and a collapsed note. Navigation, archives, news, experiments, and Human/AI counterparts were included in the route checks. Numeric results remain real text throughout cinematic reveals.

The 3D runtime was extracted from `assets/js/home.js` into schedule, controller, material, and environment modules. Editable Blender sources produce six connected rooms, coastal headlands, five skinned Sirui variants, and ten animation clips per avatar. Four humanoids share a bone convention; Lizard adds tail bones. The browser uses a matching local Three.js r164/GLTFLoader closure and an AnimationMixer.

The revised Lizard follows the supplied portrait's swept-back long hair, exposed forehead, glasses, and clean-shaven face, with a broad lizard muzzle and jaw. Sirui explicitly rejected the first doll-like face and paired hair locks. Onsen poses now face the ocean, with bare shoulders above the water. Style, avatar, album, room, and preview state are independent.

The latest refinement uses Blender remeshing and continuous surfaces for faces, hair, shirts, hands, and trousers. It adds actual Cycles portraits of all five models. A shared stone vault now joins the home to its hillside, with a tall supporting cliff, a beach at sea level, and distant headlands. Cutaway views remove the roof and its attached plants together. The selected-work figures are smaller, uncropped thumbnails beside their titles and summaries.

The current pass focuses on Realistic at Sirui's request. Fitted shelves, individual floorboards, thin botanical leaves, cabinet joinery, ceramic objects, lanterns, woven and folded textiles, and the stone onsen rim are original Blender meshes. Procedural surface detail operates in physical coordinates. Contact shadows, final color management, reflected coastal light, live sea reflections, onsen ripples, and vapor support those forms. Draco reduces the actual model downloads rather than relying on hypothetical HTTP compression. The dark-theme facts-row surface conflict is removed; narrow screens use readable label/value rows.

The Architectural and Illustrated experiments are retained only in `?scene-lab=1`. Sirui deferred their three-style comparison to [a future GPT-7 attempt](design-experiment-backlog.md). They are outside current visual acceptance.

There is no image backdrop in any homepage treatment. The generated Pacific illustration is excluded from Jekyll and appears only in the isolated splat experiment.

## Runtime boundaries

The September 13 refinement gives the gym a rack, loaded barbell, padded bench, dumbbell stand and open workout area. Curved divisions, scalloped back-wall recesses, rounded returns and a print niche fit the rooms into the cave. Four human models are rebuilt with shaped faces, inset eyes, side-parted hair, relaxed sleeves and laced shoes. Their Blender studies now live under `artwork/`; the wall uses Sirui's existing capybara image independently of the avatar. The scene edge uses a feathered asymmetric vector mask with complete perimeter transparency, and the mobile canvas no longer inherits an oversized minimum height.

`assets/models/home/manifest.json` owns asset paths, room/camera/actor/egress anchors, activity props/clips, and editable weekday/weekend schedules. `routine.mjs` resolves `America/Los_Angeles`, including DST. Visitor-local and manually selected website themes remain separate from the miniature's clock.

The scene loads only after choosing 3D. Shell, coast, occupied room, and selected avatar load first; other rooms stream afterward. Rendering stops offscreen or hidden, DPR is capped at 1.5, and reduced motion uses composed poses. Asset or WebGL failure restores the usable 2D desk. Cached back/forward navigation pauses and restores controllers instead of destroying them.

The [latest evidence report](evidence/coastal-section/README.md) records the rebuilt scene's payload and performance, exact measurement method, device-emulation limits, and check results. The preceding galleries retain their earlier measurements as historical evidence; they do not describe the revised meshes.

Album focus, second-click playback/open, swaps, four-card discovery/replay, source links, and sharing between 2D/3D remain. The controls also support keyboard orbit/zoom, D discovery, room buttons, one-finger orbit, and two-finger pinch.

The subsequent likeness and section correction places the study, sleep and onsen on an upper gallery above the kitchen, lounge and gym. Fifteen closed risers, a clear stair approach and a tread-aware foot correction connect their activity anchors. The cliff and beach are continuous mainland sections, with a matching ocean shoreline. All five models have revised hair, connected shirts and trousers, and front/profile/full-body review renders. `coastal_section.py`, `coastal_hair.py` and `coastal_clothing.py` preserve the editable authoring decisions.

## Evidence and reproduction

The committed gallery contains a curated subset of comparable captures and machine-readable measurements. Full local captures and test output live under the ignored `.jekyll-cache/visual-qa/` directory so screenshot writes do not trigger Jekyll rebuilds. Source checks supplement direct inspection; a ready flag alone was never treated as proof of visible WebGL.

```powershell
node --test test/coastal-routine.test.mjs test/coastal-navigation.test.mjs
python -m unittest discover -s test -p "test_*.py"
npm.cmd run lint:prettier
npm.cmd run lint:style-contract
$env:NO_WEBSERVER='1'
$env:VISUAL_BASE_URL='http://127.0.0.1:8080'
npx.cmd playwright test --config test/visual/public.config.js desk-scene.spec.js --workers 1
node bin/measure_coastal_home.cjs
node bin/measure_coastal_splats.cjs
docker compose exec -T -e JEKYLL_ENV=production jekyll bundle exec jekyll build --baseurl /al-folio --destination /tmp/sirui-studio-production --quiet
docker compose exec -T jekyll bundle exec al-folio upgrade overrides audit
```

Blender reproduction: `blender --background --python-exit-code 1 --python bin/build_coastal_home.py`. The official portable 4.5.9 LTS build worked after the installed Store launcher denied background execution. The script and its `coastal_sculpt`, `coastal_craft`, `coastal_characters`, and `coastal_interiors` helpers write the `.blend` sources, optimized GLBs, and model-review portraits together. Use `-- --avatar=ghibli` to rebuild one variant. Each character source opens with its idle NLA track selected; switch tracks to inspect another action.

Sipping, eating, and reading hand contacts are solved in Blender and baked into the exported clips. Cups sit beyond the stylized closed hand instead of disappearing inside it; the reading prop opens across both hands. Use `--python-exit-code 1` in scripted Blender runs to treat an authoring exception as a failed command.

## Review limits

These are original, editable stylized models and authored animation loops. The likeness still requires Sirui's visual judgment; passing a joint or screenshot test is not approval of the portrait. Transitions follow authored room egress paths, not a physics simulation or general collision solver. Production-quality character deformation, arbitrary prop interaction, and unrestricted camera collision are not claimed.

Desktop and mobile measurements are serial Chromium measurements on this Windows computer. Mobile viewport/touch/DPR emulation is not a physical phone benchmark. The splat experiment uses authored image depth, not a trained reconstruction; its findings are separate from the homepage implementation.

Historical design notes moved under `docs/history/research-studio-2026-09/`. The living heuristics and current scene brief carry the active rules. Retired agent-usage counters remain retired. Google Scholar and its paired publication projection were refreshed from the live source on September 12, 2026.
