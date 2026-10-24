# Performance notes

How fast the coastal home and the site are, what has been done about it, and what to try next. Written October 18, 2026 on main 94755609f (full screen, the gym tripod camera, skinned wildlife, renovation phases 2-3) and re-checked on main 049dba240 (the oak-and-marble kitchen and the living room's lantern; main 3c3b6852a, which changes only tests since, serves the same scene). The longer, record-ready entry with every citation lives in the graphics record (performance system), and the public write-up for visitors is `/projects/graphics-performance/` (Making the 3D home fast), a child of the Graphics Lab.

## How to measure

- `bin/measure_coastal_views.cjs`: per-view frame cost of the 3D home (the occupied study, the authored outside view, the 160 m coast with the hinterland and planting loaded, optionally a turned coast pose and full screen). It attributes every draw to a pass by viewport size (2048x2048 shadow map, 384x384 sea mirror, the canvas size for beauty and output, the contact pass's size for its prepass), times the whole frame with a GPU timer query, and records process CPU time, so a busy GPU process shows even when the page is idle. `COASTAL_VIEWS_AB=HEAD` compares the committed scene files with the working tree in ABBA order, a fresh browser per run; `COASTAL_VIEWS_EXTRA` adds working-tree variants with URL flags; `COASTAL_VIEWS_TOGGLES` resamples a view with one pass removed.
- `bin/compare_coastal_stills.cjs`: pixel parity for changes that must not change a still (reduced motion, seeded randomness, fixed routine time), base, work, work, base. The base-vs-base pair is the control.
- `bin/profile_coastal_startup.cjs`: the cold-start timeline (program warmup, model transfers, long tasks).
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

Not now. Three.js r186 (September 2026) still calls WebGPURenderer experimental and keeps WebGLRenderer as the recommended renderer for WebGL 2 work; WebGPURenderer does not run `onBeforeCompile` patches or EffectComposer passes, so every string-patched material and the contact, bloom and output passes would be rewritten in TSL. Its per-object uniform buffers are measurably slower than WebGLRenderer with many distinct draws (three.js issue 30560, open), which is this scene's exact profile, and visitors without WebGPU (Firefox outside Windows and Apple-silicon Macs, older Safari, much of Linux) would get its WebGL 2 backend. Revisit when that issue is fixed and after the scene has moved from r164 to a current three.js on WebGLRenderer; then port materials one at a time through the NodeMaterial compatibility layer (r184) and switch only if both backends win an A/B. The real prize would be render bundles and compute culling for the static draws.

## Next (in order)

1. Share identical materials between meshes, so grouped draws skip three's material refresh (needs Sirui; materials.mjs and realism.mjs).
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
