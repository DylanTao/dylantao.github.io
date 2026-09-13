# Research studio and inhabited coastal home

Review branch: `codex/research-studio-reset`, based on `bba74ccc1`. This is a local review deliverable; no production push or deployment is included.

## Open and review

- Website: [localhost:8080](http://localhost:8080/?cinematic=live), also open in the Codex app.
- Start/restart the owned preview with `docker compose up -d`. Compose serves the personal site with an empty base URL; the separate production check uses `/al-folio`.
- Start in 2D on every screen. Choose 3D, then open Explore to select Sirui, visit a room, preview an activity/time, or pause motion. Now clears previews and follows the authored Pacific routine.
- Inspect the isolated [depth study](http://127.0.0.1:4106/artwork/coastal-home/splat-lab/). To restart it, serve the repository root with `python -m http.server 4106 --bind 127.0.0.1`.
- [Evidence gallery](evidence/research-studio/README.md), [scene brief](homepage-desk-scene-brief.md), [asset provenance](../artwork/coastal-home/PROVENANCE.md), and [splat findings](../artwork/coastal-home/splat-lab/FINDINGS.md).

## What changed

The homepage now leads with the research question, selected DesignWeaver and What Happened and Why work, then thesis/research, publications and updates, and students/contact. Newsreader provides display typography; Inter remains the reading/control face. Repeated framing was shortened while signature copy and original research figures remain intact.

Projects expose a direct case-study link alongside their existing previews. The blog opens with its first paragraph before a desktop contents rail or compact mobile disclosure. CV sections use open paper and hairlines; the Wall of Rejection remains near the top of publications with smaller badges, a tighter XP panel, and a collapsed note. Navigation, archives, news, experiments, and Human/AI counterparts were included in the route checks. Numeric results remain real text throughout cinematic reveals.

The 3D runtime was extracted from `assets/js/home.js` into schedule, controller, material, and environment modules. Editable Blender sources produce six connected rooms, coastal headlands, five skinned Sirui variants, and ten animation clips per avatar. Four humanoids share a bone convention; Lizard adds tail bones. The browser uses a matching local Three.js r164/GLTFLoader closure and an AnimationMixer.

The revised Lizard follows the supplied portrait's swept-back long hair, exposed forehead, glasses, and clean-shaven face, with a broad lizard muzzle and jaw. Sirui explicitly rejected the first doll-like face and paired hair locks. Onsen poses now face the ocean, with bare shoulders above the water. Style, avatar, album, room, and preview state are independent.

| Treatment     | Projection and physical direction                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Architectural | Orthographic crafted miniature; simplified sandstone, matte plaster and wood, quiet model sea                                              |
| Realistic     | Perspective; fractured rock and scrub, procedural sky/environment light, displaced reflective water, on-demand material detail             |
| Illustrated   | Orthographic; modeled ink faults/contours, graphic surf/sun, halftones and crosshatching, 12 fps character poses with smooth camera motion |

There is no image backdrop in any homepage treatment. The generated Pacific illustration is excluded from Jekyll and appears only in the isolated splat experiment.

## Runtime boundaries

`assets/models/home/manifest.json` owns asset paths, room/camera/actor/egress anchors, activity props/clips, and editable weekday/weekend schedules. `routine.mjs` resolves `America/Los_Angeles`, including DST. Visitor-local and manually selected website themes remain separate from the miniature's clock.

The scene loads only after choosing 3D. Shell, coast, occupied room, and selected avatar load first; other rooms stream afterward. Rendering stops offscreen or hidden, DPR is capped at 1.5, and reduced motion uses composed poses. Asset or WebGL failure restores the usable 2D desk. Cached back/forward navigation pauses and restores controllers instead of destroying them.

The final measured initial scene is 1.02 MiB with estimated gzip compression (3.66 MB measured local engine/data/model HTTP transfer). Explicit GPU measurements reached about 60 fps in all three styles on this computer. The [evidence report](evidence/research-studio/README.md) records the exact method, timings, device-emulation limits, and unchanged baseline formatting/override warnings.

Album focus, second-click playback/open, swaps, four-card discovery/replay, source links, and sharing between 2D/3D remain. The controls also support keyboard orbit/zoom, D discovery, room buttons, one-finger orbit, and two-finger pinch.

## Evidence and reproduction

The committed gallery contains a curated subset of comparable captures and machine-readable measurements. Full local captures and test output live under the ignored `.jekyll-cache/visual-qa/` directory so screenshot writes do not trigger Jekyll rebuilds. Source checks supplement direct inspection; a ready flag alone was never treated as proof of visible WebGL.

```powershell
node --test test/coastal-routine.test.mjs
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

Blender reproduction: `blender --background --python bin/build_coastal_home.py`. The official portable 4.5.9 LTS build worked after the installed Store launcher denied background execution. The script writes the `.blend` sources and optimized GLBs together. Each source opens with its idle NLA track selected; switch tracks to inspect another action.

Sipping, eating, and reading hand contacts are solved in Blender and baked into the exported clips. Cups sit beyond the stylized closed hand instead of disappearing inside it; the reading prop opens across both hands. Use `--python-exit-code 1` in scripted Blender runs to treat an authoring exception as a failed command.

## Review limits

These are original, editable stylized models and authored animation loops. The likeness still requires Sirui's visual judgment; passing a joint or screenshot test is not approval of the portrait. Transitions follow authored room egress paths, not a physics simulation or general collision solver. Production-quality character deformation, arbitrary prop interaction, and unrestricted camera collision are not claimed.

Desktop and mobile measurements are serial Chromium measurements on this Windows computer. Mobile viewport/touch/DPR emulation is not a physical phone benchmark. The splat experiment uses authored image depth, not a trained reconstruction; its findings are separate from the homepage implementation.

Historical design notes moved under `docs/history/research-studio-2026-09/`. The living heuristics and current scene brief carry the active rules. Retired agent-usage counters remain retired. Google Scholar and its paired publication projection were refreshed from the live source on September 12, 2026.
