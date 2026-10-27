# Performance notes

How fast the coastal home and the site are, what has been done about it, and what to try next. Written October 18, 2026 on main 94755609f (full screen, the gym tripod camera, skinned wildlife, renovation phases 2-3) and re-checked on main 049dba240 (the oak-and-marble kitchen and the living room's lantern; main 3c3b6852a, which changes only tests since, serves the same scene). The longer, record-ready entry with every citation lives in the graphics record (performance system), and the public write-up for visitors is `/projects/graphics-performance/` (Making the 3D home fast), a child of the Graphics Lab.

## How to measure

- `bin/measure_coastal_views.cjs`: per-view frame cost of the 3D home (the occupied study, the authored outside view, the 160 m coast with the hinterland and planting loaded, optionally a turned coast pose and full screen). It attributes every draw to a pass by viewport size (2048x2048 shadow map, 384x384 sea mirror, the canvas size for beauty and output, the contact pass's size for its prepass), times the whole frame with a GPU timer query, and records process CPU time, so a busy GPU process shows even when the page is idle. `COASTAL_VIEWS_AB=HEAD` compares the committed scene files with the working tree in ABBA order, a fresh browser per run; `COASTAL_VIEWS_EXTRA` adds working-tree variants with URL flags; `COASTAL_VIEWS_TOGGLES` resamples a view with one pass removed.
- `bin/compare_coastal_stills.cjs`: pixel parity for changes that must not change a still (reduced motion, seeded randomness, fixed routine time), base, work, work, base. The base-vs-base pair is the control.
- `bin/profile_coastal_startup.cjs`: the cold-start timeline (program warmup, model transfers, long tasks).
- `bin/measure_coastal_startup.cjs`: click-to-ready time, cold or warm (a second session on the first one's profile), at 1440x900 or in phone emulation (`--device phone`, with `--throttle 4` for CPU throttling), with the loading stages, the programs linked before ready, long tasks and idle frame intervals.
- `bin/coastal_shader_census.cjs`: `dump` saves every program the home links, with its full sources; `bench` compiles each one alone in a fresh browser and times it, optionally beside edited variants of its source, which is how the shares of compile time below were measured.
- `bin/measure_coastal_flicker.cjs`: frame-to-frame change while the view zooms, orbits, pans or walks with the world paused (mean change, acceleration, A-B-A flips, pops), with the scene's static shadow redraws and resolution changes over each recording.
- Run them from PowerShell against a no-watch server (`bundle exec jekyll serve --port 4136 --baseurl /al-folio --no-watch`); `COASTAL_VIEWS_URL` / `COASTAL_STILLS_URL` point at it. The A/B tools serve changed modules themselves, so the server need not be rebuilt between variants.

This laptop is shared: other agents' servers and browsers use about half the CPU and sometimes the same integrated GPU, which stretches frame intervals without any page work (a 0.9 s gap with an idle page is GPU contention, not script). Compare only interleaved runs, report medians with their range, and prefer draw counts, script time per frame and pixel parity over frame rates.

## Where the frame goes, and what it costs now

Measured October 18 on main 94755609f against the same tree with this work, three interleaved pairs, 1440x1000 at DPR 1 (a 545x461 canvas), median of the runs' medians with the range. "Script" is the time inside the scene's frame callback.

| View                   | Script per frame                        | Draws per frame | Shadow-map draws | Program switches | Frame interval |
| ---------------------- | --------------------------------------- | --------------- | ---------------- | ---------------- | -------------- |
| Study (occupied room)  | 20.2 (19.2-20.6) to 15.3 (14.1-21.9) ms | 541 to 311      | 268 to 38        | 96 to 52         | 16.7 ms both   |
| Outside, authored 48 m | 89.8 (84.1-91.6) to 56.9 (52.1-67.0) ms | 1,554 to 1,292  | 353 to 91        | 579 to 173       | 100 to 67 ms   |
| Coast at 160 m         | 86.9 (79.6-97.6) to 50.7 (49.7-53.8) ms | 1,694 to 1,371  | 404 to 91        | 605 to 176       | 100 to 50 ms   |

An earlier pair of runs on a quieter machine gave the same picture (study 20.5 to 12.7 ms, outside 83.6 to 43.9 ms, coast 82.5 to 47.5 ms), and so did two pairs after the rebase onto main 049dba240:

| View (main 049dba240)  | Script per frame                          | Draws per frame | Shadow-map draws | Program switches | Frame interval |
| ---------------------- | ----------------------------------------- | --------------- | ---------------- | ---------------- | -------------- |
| Study (occupied room)  | 17.6 (16.7-18.6) to 10.2 (9.6-10.8) ms    | 548 to 315      | 269 to 36        | 98 to 53         | 16.7 ms both   |
| Outside, authored 48 m | 69.3 (68.2-70.5) to 48.8 (42.3-55.4) ms   | 1,576 to 1,293  | 364 to 83        | 580 to 174       | 67 to 50 ms    |
| Coast at 160 m         | 101.8 (95.3-108.2) to 49.1 (47.4-50.9) ms | 1,713 to 1,400  | 406 to 91        | 606 to 177       | 108 to 50 ms   |

The outside frame still spends most of its time in three's per-draw path: about 800 draws for the beauty pass plus three's transmission copy (the onsen water and the coffee hopper glass make three redraw every opaque object into a full-size target), about 400 for the sea mirror, and each draw still refreshes its own material. Startup to the first composed frame (12-19 s on this laptop, dominated by compiling about 70 shader programs) did not change.

Full screen at 2560x1440 and DPR 1.5 asked main for a 3840x2160 drawing buffer: 4.4 fps in the study and 2.7 fps outside (333 ms of script, 355 ms of GPU per frame). With the budget the buffer is 1642x923 (the adaptive step kept one 0.85 step and undid two unhelpful ones): 11.9 and 6.1 fps, with the composer's passes at the canvas size.

The site's pages, live, Lighthouse desktop, median of three: the homepage scores 61 with a 1.85 s LCP (the portrait), 903 ms of total blocking time (826 ms of it `paper-research-field.js` mounting its WebGL field at load) and 1.8 MB; DesignWeaver scores 80 with a 1.69 s LCP and a 0.17 layout shift (the whole article moves once). Both pages carry 500 KB of Inter variable fonts, about 210 KB of Font Awesome webfonts, and three render-blocking stylesheets (Google's Material Icons, `main.css`, the Font Awesome CDN). GitHub Pages serves every file with `max-age=600` and gzip only.

## What changed (October 18)

| Change                         | Module                                              | What it does                                                                                                                        |
| ------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Flat vector-array uniforms     | `static-light-field.mjs`, `light-installations.mjs` | Three r164 re-flattened every `Vector3[]` uniform on each material switch; it was the largest single cost of an outside frame.      |
| Program-grouped opaque draws   | `draw-order.mjs`                                    | Groups opaque draws by shader program (about 580 program switches per outside frame became 173).                                    |
| Two-stage shadow cache         | `shadow-cache.mjs`                                  | Static casters drawn once into a cached map, copied each frame with `blitFramebuffer`; only moving casters drawn over it.           |
| Shared Draco pool              | `model-loader.mjs`                                  | Up to four decoder workers for the whole page instead of one per loader (2.0-2.7x faster decoding in isolation); forgets failures.  |
| Pixel budget, adaptive density | `resolution.mjs`                                    | Caps the drawing buffer at 2.1 MP (full screen asks for up to 8 MP) and adapts large buffers to frame time; composer stays in step. |

Still frames: matched deterministic stills with every change but the draw grouping are identical in the study and outside and differ by at most 2/255 in 0.5 % of pixels at 160 m; the draw grouping adds exact-depth-tie pixels (39 outside with a maximum channel delta of 40, 6 in the study, 4 at 160 m). Live shadow maps matched a full redraw to the texel in 7 of 8 checks and by all but one texel in the eighth. The budget leaves the ordinary canvas's size untouched. The draw grouping's tie pixels are shown in [the October 18 evidence](evidence/performance-2026-10-18/README.md); `?draw-order=material` restores three's order if any of them matters. Comparison flags (session URL): `?shadow-cache=0`, `?draw-order=material`, `?resolution=fixed`. `getSceneEvidence()` reports `shadowCache` and `resolution`, and in the lab (`?scene-lab=1`) `labScene.verifyShadowCache()` compares the next frame's cached shadow map with a full redraw.

Tried and set aside: a GPU-occlusion gate for three's transmission copy (correct, but its padded probes always saw the onsen water or the hopper glass through slats and glass, so it never engaged), the sea mirror without interiors (13 of 108 coast stills changed), adaptive density on the ordinary canvas (draw-bound, so fewer pixels only blur), a 60 fps cap (a smoothness decision).

## Rules for later work

- Store any array-of-vectors uniform as a flat `Float32Array`.
- New moving shadow casters need no registration: the shadow cache notices matrix, geometry and material changes. A caster animated only in its vertex shader must carry a `customDepthMaterial` (as the swaying planting does), or its shadow will be cached in place.
- Keep the renderer's pixel ratio fixed after creation; change the drawing buffer through `resolution.mjs`, which moves the renderer and the composer together.
- Before claiming a pixel-identical change, run `bin/compare_coastal_stills.cjs` and check its control pair; hold back a change that reorders asynchronous loading (`COASTAL_STILLS_HOLD`), or the reduced-motion wildlife race shows up as a difference.
- Time a new shader's cold compile, not only its frame cost: ANGLE's Direct3D compiler unrolls constant-bound loops and inlines every call. The footer sea's first shader compiled in 1.9 s against 0.6 s for the water it replaced; uniform loop bounds, short integer hashes and a strip texture in place of an eighteen-branch shoreline brought it level (`footer-coast/water.mjs`, October 18).

## WebGPU

Rechecked against official documentation on October 26: [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html) supports WebGPU with a WebGL 2 fallback. Its existence is not a performance measurement for this scene. The earlier blanket recommendation against it, version/status claims and issue-based speed comparison are withdrawn; none was re-measured on this PC.

This site still ships three r164, custom GLSL materials and EffectComposer passes. Three's [Material documentation](https://threejs.org/docs/pages/Material.html#onBeforeCompile) explicitly limits `onBeforeCompile` to WebGLRenderer and recommends NodeMaterial/TSL for WebGPURenderer. A useful trial therefore requires a real material and postprocessing port, including the source-bound light field, reflections and contact lighting. First port one representative outside view in isolation; compare matched 2K/4K stills, startup, frame costs and memory on both backends before replacing the visitor renderer. WebGPU has not been implemented or benchmarked here. Batching the many static draws remains a separate, measurable hypothesis on either API.

## Next (in order)

1. Share identical materials between meshes, so grouped draws skip three's material refresh. The October 26 PC attempt failed still parity and was withdrawn; inspect per-draw receiver state before trying again (details below).
2. A non-transmissive stand-in for the small hopper glass and the distant onsen water, which would remove three's transmission copy outside (a look change of a few dozen pixels; needs Sirui).
3. A lighter sea mirror: no interiors, or every other frame while the camera is still (needs Sirui).
4. BatchedMesh for the hinterland's and planting's static pieces (identity instance matrices, transforms baked).
5. Meshopt as a post-process for faster decoding (3.4-7.5x here, but 1-46 % more bytes after gzip).
6. Minify the ES modules (jekyll-terser skips `.mjs`): 3D modules 330 to 201 KB gzipped, the rest 110 to 72 KB.
7. A content-hashed Service Worker cache, since GitHub Pages re-sends every model after each deploy.

The graphics record's performance entry has the measurements behind each item and the verified sources.

## October 23: complete arrival and reusable static lighting

The first reveal now waits for all six base interior rooms, 17 default furniture placements, their embedded textures, composed steam, lighting and the view's shader programs. The earlier first frame contained only one room and unfinished indirect lighting; subsequent work could stall the visible scene. Exterior planting, hinterland and deliberate fine-detail upgrades remain lazy. Dining task light now follows both actual pendant positions, with meal and kitchen-visit illumination, and two bounded washers light the new entrance.

`bin/bake_coastal_static_light.cjs` reuses the actual runtime to trace fixed diffuse transport once. The generated 403,489-byte JSON field replaces a roughly 10–11.6 second per-visitor bake in these captures with a 1.3 ms restore. It preserves live sky and practical relighting; roundtrip tests compare sampled irradiance exactly. Its source signature covers the normalized manifest, model bytes, collector/material sources and geometry-producing Three/GLTF/Draco dependencies. A separate response digest, strict shape/range checks and an LF attribute protect restoration. Stale or invalid data falls back to the runtime bake. New geometry requires regeneration, not a hand-edited signature.

The same seeded native Chromium host at 390×844, DPR 3 and touch reached the new complete first frame in 22.95 seconds with the cache, versus 33.37 seconds without it. The ready observer saw six rooms, all 17 default placements and completed lighting; there were no later interior model requests. The cached sample observed about 30 fps in full screen at 740,610 pixels and two MSAA samples. This is phone viewport emulation on the host GPU, with a single before/after pair, not a physical-phone benchmark or a general FPS improvement claim. The old incomplete-frame baseline returned sooner; that is a different readiness contract. Reduced motion settled with no further frames. A baseline full-screen capture stalled once and was stopped rather than retried.

Compact coarse-touch screens now begin full screen with a 1.5× density cap and a 1.8 MP ceiling. Moving frames may probe lower densities down to a bounded floor, including buffers below 1 MP; an unhelpful probe reverts. Desktop and embedded profiles retain their previous pixel budgets. The phone sample reverted a probe when it did not help, which demonstrates the guard rather than a speed gain. Native GPU programs still warm up in batches with nonblocking completion where supported, as recommended by [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#prefer_khr_parallel_shader_compile); the static transport cache does not bypass driver compilation.

Walking excludes 180,289 soft-plant triangles from collision while retaining 4,020 trunk triangles; those plants still draw normally. This removes leaf/grass barriers and field-building work, without claiming a measured frame-rate change. The real cedar barrier across the rear doorway was removed in Blender instead of weakening wall collision. [The checkpoint](evidence/coastal-arrival-2026-10-23/README.md) records return-route, browser and rendering evidence.

## October 24: what the arrival waited on, and what changed

Sirui's report: the 3D home lagged and took long to load on his Intel Arc laptop, a 4K desktop and an iPhone, and flickered while zooming and walking. Measurements were made on the Intel Arc laptop (ANGLE on Direct3D 11) in headless Chromium 145 at 1440x900 and DPR 1, with a cold profile and no lab flag, timed from the 3D click to `sceneState === "ready"`. Three other agents shared the machine, keeping 8-12 of its 22 logical cores busy, so every comparison below is a median of interleaved runs.

### Baseline (main a7c8534e5)

| Arrival | Coast | Room stage | Lighting stage | First-frame stage | Ready  |
| ------- | ----- | ---------- | -------------- | ----------------- | ------ |
| Cold    | 1.5 s | 12.6 s     | 24.3 s         | 5.3 s             | 46.4 s |
| Warm    | 1.0 s | 11.5 s     | 16.9 s         | 5.2 s             | 36.1 s |

The room stage was the rooms, the avatar and the walking body's compiles. The lighting stage was the light-cache restore plus each bathroom mirror's whole-scene `compileAsync`. The first-frame stage was the batched warmup and the first draw. A second visit on the same profile saved only network time and some compiles: the GPU program cache is not what the arrival waits on. Other runs that day ranged from 32 s on a quieter machine to 61 s.

A Chrome trace with the `gpu.angle` category settled where the time went. ANGLE's Direct3D compiler (`D3DCompile`, FXC) used 503 s of CPU across 341 calls during a 63 s arrival. Fragment shaders took 129 ms at the median, 7.6 s at the 90th percentile and 25 s at most; the eight slowest (three sandstone, three plaster, the onsen's caustic stone and the marble) took 15-25 s each, so the slowest shader alone set a floor whatever the parallelism. Of 169 pixel compiles, 32 repeated identical HLSL. They were legitimate vertex variants (skinning, morph targets, instancing, wind sway), which ANGLE compiles once per program. The GPU process's main thread was busy for 26 s, mostly compositing, and was not a bottleneck. The camera-field worker spent 43 s re-running full-grid classifications. Compiling each program alone, then again with one part of its shader removed, attributed the cost:

| Part of a lit program                                 | Share of its FXC time |
| ----------------------------------------------------- | --------------------- |
| Static light field (static-light-field.mjs)           | 25-53 %               |
| Eight unrolled warm-practical point lights (three.js) | 20-28 %               |
| Light installations (light-installations.mjs)         | 12-23 %               |
| Light well (light-well.mjs), PCF-soft sun shadow      | 5-10 % each           |
| Procedural stone noise (realism.mjs)                  | 4-11 s per stone kind |

The first view draws 74 of about 124 programs, about 63 % of the isolated compile cost. The walking body's head-cut variants (eight programs, about 30 s) are drawn only in Walk.

### What changed

| Commit    | Change                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 8e9f92a58 | The camera field voxelizes as models arrive and classifies once, when the rooms are in.                                                                |
| 75be6307a | The light cache is fetched, checked and parsed right after the manifest; only a failed check or a request that stalls for 20 s falls back to the bake. |
| 9671276d0 | The ten room models download right after the manifest, at low priority, behind the house and coast.                                                    |
| 4dfd7c06e | The house, coast, desk and companion programs start compiling while the rooms download; the mirrors' compile runs after the batched warmup.            |
| 83c2a311a | The walking body's head-cut variants compile after the first frame.                                                                                    |
| 8df284b16 | Meshes exported without vertex colour draw with white, so painted and unpainted copies of a surface share one program (123 to 120 programs).           |
| 229d4e12e | Sandstone, plaster, marble and travertine loop their noise octaves under a uniform count instead of unrolling three per call site.                     |

The first five took ready from a median of 48.2 s (42.5, 48.9, 48.2) to 33.7 s (33.7, 34.5, 33.6) under heavy load, and from 40.2 and 35.8 s to 34.0 and 34.5 s on a quieter machine. The old arrival degraded with load; the new one held 33.6-34.5 s in every run. The light-cache fix matters most on a busy or slow device. Fetched after the rooms under compile load, the cache missed its 8 s budget in two of three runs of an intermediate version, and the fallback bake took ready to 55-72 s.

The last two took ready from a median of 41.4 s (46.4, 41.4, 38.9) to 39.1 s (54.8, 39.1, 36.4), with 116-122 programs at ready instead of 128-129; the arrival avatar is random, and the slow 54.8 s run stalled in parsing under a load spike. Isolated compile of the eleven heaviest stone programs fell from 92.2 to 73.0 s, the cliff sandstone from 17.5 to 9.7 s. Drawn full screen at 1440x900, the looped marble also ran faster on the GPU (9.4 to 8.1 ms and 9.6 to 8.4 ms per draw, 100 interleaved rounds in each order).

Stills (`bin/compare_coastal_stills.cjs`) are identical in the study for every change. Outside, merging the colour variants flips 4 exact-depth-tie pixels on a coplanar arch-frame edge, because merged programs regroup the opaque draws (identical under `?draw-order=material`), and the noise loop moves 12 isolated distant sandstone pixels by 1/255. The remaining exterior differences are the reduced-motion wildlife race, which also differs base to base.

### Measured non-wins

- `#pragma optimize(off)` and `#pragma debug(on)`: ANGLE ignores both; FXC time was unchanged.
- Uniform loop bounds for the light-installation and light-well loops: no change in FXC time.
- Branchless rewrites of the static light field's octahedral wrap and border remap: no reliable change, and one marble program compiled three times slower.
- Binding the light well only to meshes whose bounds reach the bath: it split program families that span the bath box (chalk limestone, brass, cut stone, porcelain, olive leaf), which cancelled the merges.
- Playwright WebKit on Windows: no first frame after 70 minutes, with its GPU process compiling serially on ANGLE/Direct3D 11 (3,200 s of CPU). It is not a proxy for iOS, whose WebKit compiles through Metal; only an actual iPhone can measure that.

### Flicker and lag while the view moves

Three things changed the whole picture while the view moved:

- Outside, the sun's shadow square was refitted on every frame. Its half-width followed the zoom in 1 m steps and its centre followed the orbit target or the walker, so shadow texels changed size or position from frame to frame and shadow edges shimmered. Every change of the light's matrix also redrew the static shadow cache, about 260 casters on the coast.
- In full screen, the resolution governor changed the drawing buffer during a drag (three to six changes in one 7 s orbit, down to a factor of 0.35), and the detail level followed the adapted buffer, so a density step could also reallocate MSAA, the shadow map and the mirror target mid-drag.
- Furniture below 1.5 px of projected radius was culled without hysteresis, so a zoom resting near that size blinked distant pieces.

| Commit    | Change                                                                                                                                                                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28266ea98 | Adaptive resolution and the detail level hold while the camera has moved in the last 0.6 s; the frames seen meanwhile decide once the view rests. Detail follows the buffer before adaptation.                                                                                                                |
| a63d4fac9 | While the coast view moves, the shadow square's half-width moves along a ladder of nine sizes from 12 to 120 m, with one step of hysteresis and an 8 % margin, and its centre holds until the focus has drifted by that margin (1 m around a walker). 0.6 s after the view rests it returns to the exact fit. |
| 234bdcaa3 | A culled furniture piece returns only at 1.35 times the threshold.                                                                                                                                                                                                                                            |
| 0f9d1b1e6 | A paused or reduced-motion coast view that stops moving draws one more frame after the rest, so the exact fit always returns; without it a still's shadows depended on the path the camera took.                                                                                                              |

Driving the lab camera from inside the page on every animation frame, with the world paused, counted the static shadow redraws over 4 s of motion and 1.5 s of rest (two interleaved pairs; frames came 60-200 ms apart under this load):

| Motion over 4 s                   | Before                       | After                        |
| --------------------------------- | ---------------------------- | ---------------------------- |
| Zoom out and back in, 48 to 106 m | 21 of 25 and 34 of 35 frames | 9 of 30 and 10 of 31 frames  |
| Pan 20 m                          | 37 of 37 and 59 of 59 frames | 13 of 46 and 16 of 65 frames |
| Orbit 1.2 rad around the target   | 2 of 32 and 2 of 49 frames   | 3 of 39 and 4 of 24 frames   |

An orbit around a fixed target moved neither the square's centre nor its size before, so it rarely redrew; entering and leaving the stepped fit now adds one or two redraws to it. The full-screen resolution hold is covered by its unit test; in the browser, one Playwright drag pair went from six resolution changes (down to a factor of 0.36) to one after the drag, and a lab-driven pair never adapted in either version because background compiles kept restarting the governor's window, so that part is not separately confirmed.

Checked and left alone: furniture levels of detail already switch with 12 % hysteresis (`detail-levels.mjs`); semantic zoom changes view only after a further 0.32 push past the limit and forgets a partial push after 0.7 s; the haze march's jitter is a fixed screen pattern and the contact pass has no random term, so neither changes between frames of a still view. The bathroom mirrors re-capture at most 15 times a second while the camera moves, and at once after a jump. Capturing every moving frame removed the mirror's stepping, but that bound is a tested contract (`test/interior-reflections.test.mjs`) and the change would add a room render to every moving frame in the two bathroom views, so it was dropped.

Stills: with all four changes the study, outside and 160 m stills match base exactly in three of four captures; the fourth differs only in the reduced-motion wildlife (gulls and sea lions), the race that also separates base captures. Under this load the frames of a scripted interaction came 100-800 ms apart, so the frame-image metrics were dominated by real motion between frames and moved within run-to-run noise; the redraw counts carry the result. Playwright's own mouse and wheel events stalled for more than 0.6 s under the same load, which the scene correctly takes as rests, so the counts from those runs vary (a zoom took 8-30 redraws against 20-21) and are not the measure. Frame-time effects were not measured here: on a quiet machine or Sirui's hardware, `?perf=1` shows them.

### Quality tiers and the `?perf=1` readout

Sirui asked for detail that follows the device: more on a 4K desktop with a strong GPU, less on a phone, without lag or crashes. `quality.mjs` defines three tiers that change what the home costs, never what it shows: every tier draws the same house, coast, people and animals with the same shader programs. No tier setting is part of a program's key, so a tier change compiles nothing (118-120 programs at every tier).

| Setting                                  | Low                                                  | Standard (as before)                          | High                                          |
| ---------------------------------------- | ---------------------------------------------------- | --------------------------------------------- | --------------------------------------------- |
| Page embed: pixel budget, density cap    | 1.2 MP, 1.25                                         | 2.1 MP, 1.5                                   | 4.2 MP, 2                                     |
| Full screen: budget, density, floor      | 1.8 MP, 1.25, 0.6                                    | 8.3 MP, 2, 0.35 (1.8 MP, 1.5, 0.6 on a phone) | 8.3 MP, 2, 0.5                                |
| MSAA ceiling                             | 2                                                    | 4                                             | 4                                             |
| Sun shadow map                           | 1024                                                 | 2048, 4096 in large full screen               | 4096 where the GPU allows 8192 textures       |
| Contact pass, sea mirror                 | half, two thirds                                     | 480 px, 384 px in the embed                   | 1.5 times                                     |
| Bathroom mirrors                         | 128                                                  | 256 (128 on a phone)                          | 512                                           |
| Haze march                               | two thirds of the steps, one resolution step coarser | 24 steps outside, 18 inside                   | 1.25 times the steps, half resolution at most |
| Texture filtering, embed and full screen | 1, 4                                                 | 1, 8                                          | 8, 16                                         |
| Furniture detail reach and bytes         | 0.8 times                                            | as authored                                   | 1.4 times                                     |

How a tier is chosen:

- A phone (coarse pointer, short side under 768 px), a GPU without 8192-pixel textures or a device reporting 2 GB of memory or less starts at low; everything else starts at standard. `?quality=low|standard|high` pins a tier.
- High is offered only where the GPU allows 8192-pixel textures, the device does not report less than 8 GB, and the high tier's render targets at the screen's own full-screen size fit a 1.28 GB estimate. A standard device earns it after 90 frames at rest with a 75th-percentile interval of 19 ms or less and a median GPU time of 6 ms or less (one frame in eight is timed). Without a GPU timer it needs a median under 15 ms, so 60 Hz pacing alone never qualifies.
- 90 frames with a 75th-percentile interval over 40 ms demote one tier, but only while the page's own script takes less than 60 % of the frame: frames bound by script would not get faster with fewer pixels. The laptop's coast view (about 49 ms of script in a 50-67 ms frame) therefore stays where it is. A demotion is final for the session.
- Nothing switches while the camera moves or background shaders compile.
- A lost WebGL context stores a cap one tier lower in sessionStorage, so switching to 3D again restarts lower.
- Automation (`navigator.webdriver`) draws standard and holds it, as it holds the cinematic layer still, unless the URL asks with `?quality=auto` or a tier. Visual tests are unchanged.

Render-target memory estimated by `targetMemory()` (the composer, three's transmission target, bloom, contact, haze, the shadow map and its cache copy, both mirrors; an estimate for budgeting, not a driver measurement):

| View                                       | Low    | Standard | High        |
| ------------------------------------------ | ------ | -------- | ----------- |
| Laptop embed, 1000x480 CSS at DPR 1.5      | 115 MB | 258 MB   | 457 MB      |
| 4K desktop embed, DPR 2                    | 115 MB | 258 MB   | 604 MB      |
| 4K desktop full screen, 1920x1080 at DPR 2 | 251 MB | 1,166 MB | 1,193 MB    |
| Phone full screen, 390x844 at DPR 3        | 84 MB  | 164 MB   | not offered |

Measured on the shared laptop (headless Chromium on ANGLE/Direct3D 11, 1440x900 at DPR 1, cold profiles, heavy load from other agents):

- Each pinned tier applied its settings with no errors and no new programs (118-121 programs in every run). Low drew MSAA 2, a 1024 shadow map, a 240 px contact pass, 257 px sea and 128 px bathroom mirrors and 16 haze steps outside. High drew a 4096 shadow map, a 720 px contact pass, 576 px sea and 512 px bathroom mirrors and 8x filtering (16x in full screen). Estimated targets at the 544x460 embed: 50, 113 and 313 MB.
- Time to ready, pinned and interleaved: standard 37.5 and 46.7 s, high 51.1 and 43.9 s, a difference inside the run-to-run spread. Switching a resting standard view to high in the lab drew the next frame 0.65-0.85 s after the switch and the one after it 0.57-0.6 s later, against a usual 83 ms here: one hitch while the larger shadow map, mirrors and targets are allocated and drawn, once per session.
- Unpinned, one standard session demoted to low after about 20 s of 33 ms median and 50 ms 75th-percentile frames with 20 ms of script (other agents' browsers shared the GPU); it then held 17 ms frames. Another, at 117 ms medians, did not demote within 20 s.
- In phone emulation (390x844 at DPR 3, touch) an unpinned session started low (a 437x440 buffer, 43 MB); under automation it holds standard.
- Stills of the standard tier against main: the study and the 160 m coast are identical; outside, 37 pixels at the foot of the frame move by 1/255 between captures of the same version too. They track whether a capture lands within 0.6 s of the last camera move, before the rest refit from the October 24 motion work, not the tiers.

Not verified: a real phone, the 4K desktop, promotion to high (this machine never had 6 ms of GPU headroom) and recovery after an actual context loss (only the stored cap is exercised by its code path).

`?perf=1` adds a three-line readout over the scene's top-left corner, below the full-screen bar when that shows: ready time (or the loading stage), tier, frame p50 and p95, GPU time per frame where a timer exists, buffer size and density factor, MSAA, shadow map, programs, draws, estimated target memory and the view. Its copy button puts the whole summary, with the GPU's name, cores and pixel ratio, on the clipboard as JSON (or shows it to select when the clipboard is refused), so a phone can report its numbers. `getSceneEvidence().quality` reports the tier, its settings and history, the memory estimate and the cost of the last switch; in the lab, `setQualityTier(tier)` switches at once.

## October 26 PC: arrival baseline and retained optimization attempts

The [portable startup review](../artwork/coastal-home/reviews/startup-and-frame-2026-10-26/README.md) records the full cold/warm host measurements, mobile Lighthouse settings, original arrival avatars, source readback and the retained walking-spike triplet. Chromium desktop reached ready in 12.705 s cold and 8.398 s warm; CPU ×4 phone emulation took 18.504 s and 17.387 s. Windows WebKit phone emulation took 17.986 s cold and 19.183 s warm. These are observations with different arrival avatars, not causal cold/warm comparisons or physical-iPhone results. The final WebKit prime/warm pair had a coordinated quiet host window. All visits restored the cache and reported no runtime errors. The 10 s / 15 s targets remain open.

The initial mobile Lighthouse diagnostic on the uncompressed local transport scored 49 for performance, 100 for accessibility and 100 for best practices: FCP 11.204 s, LCP 12.929 s, TBT 300 ms and CLS 0.02614. Its result does not stand in for the deployed CDN. The flicker recording found zero zoom spikes and seven walking spikes with no resolution changes; the saved frames show a ceiling/wall appearing during the walk. Synchronized camera/roof state is still needed to attribute that transition. Readback changes capture timing, so its intervals are not clean FPS measurements.

Further frame experiments were withdrawn. Their sources, matched controls and raw runs remain in `.jekyll-cache/visual-qa/finish-todos-2026-10-26/`:

| Attempt                                                            | Observed result and decision                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact Float32 uniform-upload reuse                                 | No useful FPS gain in the interleaved native 2K run; withdrawn.                                                                                                                                                                   |
| Uniform bounds for the large GLSL field loops                      | About 6–8% slower in the pinned-avatar ABBA run; withdrawn.                                                                                                                                                                       |
| Specialize receivers wholly outside the static-light region        | Only a small/noisy difference; outside same-version captures were themselves unstable. Withdrawn. An earlier mismatched-avatar pair was invalidated and rerun with explicit avatar pinning.                                       |
| Batch geometry for the contact normal pass                         | Changed 20,839 exact study pixels even after fixing the batch's visibility ownership, and added about 29 MB of geometry buffers; withdrawn. The 853 × 480 pass with roughly 677 draws was the sea mirror, not the normal prepass. |
| Stationary sea mirror at 15 Hz, with full refresh on motion/stills | Removed about 14% of submitted outside draws but moved outside FPS only from 18.4/17.9 to 18.8/18.0 in the quiet pinned-avatar ABBA run. Withdrawn; the small gain did not justify the temporal compromise.                       |

The new probe pins the same actual arrival avatar and fixed date across comparisons; a source rewrite fails closed if that selector changes. Compiled-module still comparisons also bind the raw modules, exact minifier recipe and served bytes. Study pairs matched exactly, while some outside/coast captures changed between repeats of the same version; global exact parity is not claimed from those samples. Keep investigating per-draw receiver state and exact-depth ownership before static sharing or batching. The current wide view remains expensive; no WebGPU backend or broad frame-rate improvement is being claimed.

One further startup attempt skipped per-mirror compilation after the common frame warmup. It removed 117.4 ms of direct preparation work in an exploratory trace, but the second bathroom then linked two extra programs during its visit. Reflection captures use a different visible-light set. The attempt was withdrawn and the original preparation retained; `module-delivery-2026-10-26/bathroom-warmup/` keeps the actual baseline/candidate counts. A faster readiness number that merely moves compilation to a later room is not a finish.

## October 26 PC: preserve full-screen detail and measure the remaining cost

Sirui saw a soft 2K scene on the desktop. The visible preview identified an RTX 3080 Ti through ANGLE/Direct3D 11, had permanently demoted to low and was drawing 1880x957 into a 2560x1303 CSS viewport. Its earlier decision used 50 ms wall-frame intervals and 16 ms of submission work. Later wall gaps exceeded 500 ms despite a reported GPU pass of 10-22 ms. Those scopes do not identify the cause of the gaps; they do show that wall pacing alone is insufficient evidence for an irreversible quality loss.

The repair requests the high-performance GPU, keeps desktop full-screen adaptation above 0.8 linear density, and restores the budgeted native buffer when animation is paused or reduced motion is selected. Compact touch retains its separate memory budget and 0.6 floor. The quality governor now checks available GPU timing before demoting, tests whether a reduction actually improves the next settled window by 15%, restores an unhelpful reduction and permits recovery after sustained headroom and a longer cooldown. High retains its memory guard. Geometry, animals and room content remain present at every tier. These are fidelity and recovery changes, not a claim of faster rendering.

Native Chromium captured an interleaved 2K ABBA and one 4K pair, with complete assets, native animation scheduling and fixed routine time. The baseline is `8f13a4646`; only controller/quality/resolution differ. Both work 2K runs retained a 2560x1440 drawing buffer; one baseline ended at 1536x864 and retained that softened still. Both 4K runs drew 3840x2160 (1920x1080 CSS at DPR 2). All six runs had no page or console errors.

| Outside view                  | Moving frame p50 | Callback submission p50 | Timed GPU pass median | Draws       |
| ----------------------------- | ---------------- | ----------------------- | --------------------- | ----------- |
| 2K baseline A, adapted to 0.6 | 64 ms            | 53 ms                   | 62.2 ms               | 2110        |
| 2K work A / B, native         | 80 / 78 ms       | 68 / 65 ms              | 68.5 / 65.8 ms        | 2117 / 2107 |
| 2K baseline B, native         | 80 ms            | 68 ms                   | 64.9 ms               | 2116        |
| 4K baseline / work, native    | 121 / 127 ms     | 111 / 113 ms            | 108.4 / 104.7 ms      | 2112 / 2122 |

The wide view is still expensive on this PC. Restoring detail has not solved its frame cost. The callback can wait in the WebGL driver, and the elapsed GPU query covers haze/composer, excluding earlier reflection calls; neither number is a pure CPU/GPU utilization measurement. No 60 fps, real-phone or context-loss recovery claim follows. Raw source-routed captures and receipts remain in `.jekyll-cache/visual-qa/pc-fidelity-2026-10-26/quality/`; the portable review retains source hashes and selected unscaled comparisons.

**Material reuse attempt, withdrawn.** Static opaque finishes were shared only within one loaded model and original material, preserving receiver packs and separate animated/transmissive finishes. The broad wood/stone/metal version changed 100,186 study pixels, with a 53/255 maximum channel delta, while same-version controls matched. Restricting reuse to wood/metal still changed 28,850 exact pixels (21/255 maximum), although none crossed pixelmatch's perceptual threshold. The latter is not exact parity. Both runtime changes were reverted before publication; no performance win is claimed. Recipes, sources, test and ABBA stills are retained under `material-sharing-attempt1/`, `material-sharing-attempt2/`, `material-parity/` and `material-parity-v2/` in the same ignored review directory. Next inspect per-draw receiver/uniform state and exact-depth ownership before any sharing or static batching; the cause is not yet established.
