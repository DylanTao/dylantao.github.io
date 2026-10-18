# Performance notes

How fast the coastal home and the site are, what has been done about it, and what to try next. Written October 18, 2026 on main 94755609f (full screen, the gym tripod camera, skinned wildlife, renovation phases 2-3). The longer, record-ready entry with every citation lives in the graphics record (performance system).

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

An earlier pair of runs on a quieter machine gave the same picture (study 20.5 to 12.7 ms, outside 83.6 to 43.9 ms, coast 82.5 to 47.5 ms). The outside frame still spends most of its time in three's per-draw path: about 800 draws for the beauty pass plus three's transmission copy (the onsen water and the coffee hopper glass make three redraw every opaque object into a full-size target), about 400 for the sea mirror, and each draw still refreshes its own material. Startup to the first composed frame (12-19 s on this laptop, dominated by compiling about 70 shader programs) did not change.

Full screen at 2560x1440 and DPR 1.5 asked main for a 3840x2160 drawing buffer: 4.4 fps in the study and 2.7 fps outside (333 ms of script, 355 ms of GPU per frame). With the budget the buffer is 1642x923 (the adaptive step kept one 0.85 step and undid two unhelpful ones): 11.9 and 6.1 fps, with the composer's passes at the canvas size.

The site's pages, live, Lighthouse desktop, median of three: the homepage scores 61 with a 1.85 s LCP (the portrait), 903 ms of total blocking time (826 ms of it `paper-research-field.js` mounting its WebGL field at load) and 1.8 MB; DesignWeaver scores 80 with a 1.69 s LCP and a 0.17 layout shift (the whole article moves once). Both pages carry 500 KB of Inter variable fonts, about 210 KB of Font Awesome webfonts, and three render-blocking stylesheets (Google's Material Icons, `main.css`, the Font Awesome CDN). GitHub Pages serves every file with `max-age=600` and gzip only.

## What changed (October 18)

| Change                         | Module                                              | What it does                                                                                                                        |
| ------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Flat vector-array uniforms     | `static-light-field.mjs`, `light-installations.mjs` | Three r164 re-flattened every `Vector3[]` uniform on each material switch; it was the largest single cost of an outside frame.      |
| Program-grouped opaque draws   | `draw-order.mjs`                                    | Groups opaque draws by shader program (about 580 program switches per outside frame became 173).                                    |
| Two-stage shadow cache         | `shadow-cache.mjs`                                  | Static casters drawn once into a cached map, copied each frame with `blitFramebuffer`; only moving casters drawn over it.           |
| Shared Draco pool              | `model-loader.mjs`                                  | Up to four decoder workers for the whole page instead of one per loader (2.0-2.7x faster decoding in isolation).                    |
| Pixel budget, adaptive density | `resolution.mjs`                                    | Caps the drawing buffer at 2.1 MP (full screen asks for up to 8 MP) and adapts large buffers to frame time; composer stays in step. |

Still frames: matched deterministic stills with every change but the draw grouping are identical in the study and outside and differ by at most 2/255 in 0.5 % of pixels at 160 m; the draw grouping adds exact-depth-tie pixels (39 outside with a maximum channel delta of 40, 6 in the study, 4 at 160 m). Live shadow maps matched a full redraw to the texel in 7 of 8 checks and by all but one texel in the eighth. The budget leaves the ordinary canvas's size untouched. The draw grouping's tie pixels are shown in [the October 18 evidence](evidence/performance-2026-10-18/README.md); `?draw-order=material` restores three's order if any of them matters. Comparison flags (session URL): `?shadow-cache=0`, `?draw-order=material`, `?resolution=fixed`. `getSceneEvidence()` reports `shadowCache` and `resolution`, and in the lab (`?scene-lab=1`) `labScene.verifyShadowCache()` compares the next frame's cached shadow map with a full redraw.

Tried and set aside: a GPU-occlusion gate for three's transmission copy (correct, but its padded probes always saw the onsen water or the hopper glass through slats and glass, so it never engaged), the sea mirror without interiors (13 of 108 coast stills changed), adaptive density on the ordinary canvas (draw-bound, so fewer pixels only blur), a 60 fps cap (a smoothness decision).

## Rules for later work

- Store any array-of-vectors uniform as a flat `Float32Array`.
- New moving shadow casters need no registration: the shadow cache notices matrix, geometry and material changes. A caster animated only in its vertex shader must carry a `customDepthMaterial` (as the swaying planting does), or its shadow will be cached in place.
- Keep the renderer's pixel ratio fixed after creation; change the drawing buffer through `resolution.mjs`, which moves the renderer and the composer together.
- Before claiming a pixel-identical change, run `bin/compare_coastal_stills.cjs` and check its control pair; hold back a change that reorders asynchronous loading (`COASTAL_STILLS_HOLD`), or the reduced-motion wildlife race shows up as a difference.

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
