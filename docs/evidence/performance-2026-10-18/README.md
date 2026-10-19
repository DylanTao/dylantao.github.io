# Performance checkpoint: October 18, 2026

Measured on main 94755609f (full screen, the gym tripod camera, skinned wildlife, renovation phases 2-3) against the same tree with this branch's changes, and re-checked on main 049dba240. Shared Windows laptop: Intel Core Ultra 7 155H (22 logical cores), Intel Arc integrated GPU, headless Chromium with ANGLE/D3D11, 1440x1000 viewport at DPR 1, a 545x461 scene canvas. Other agents' servers and browsers used about half the CPU and at times the GPU, so frame rates are noisy; script time per frame, draw counts and pixel parity are the robust measures. Raw JSON and captures stay in `.jekyll-cache/visual-qa/perf-2026-10-18/` (not committed).

## Method

- `bin/measure_coastal_views.cjs`: a fresh browser per run, seeded page randomness, the routine's Date fixed at Friday 13:20 (the study), 6 s samples of the occupied study, the authored outside view (48 m) and the 160 m coast with the hinterland and planting loaded. Draws are attributed to passes by viewport size; "script" is the time inside the scene's frame callback. Base and work alternate (ABBA).
- `bin/compare_coastal_stills.cjs`: reduced-motion stills, base, work, work, base; the base pair is the control. `COASTAL_STILLS_HOLD=assets/js/home-scene/model-loader.mjs` keeps the decoder change out of the comparison, because it reorders asynchronous loading and so exposes a pre-existing race in reduced-motion wildlife poses (2,334 px of animals, seen in the unchanged base as well).
- Shadow cache: `labScene.verifyShadowCache()` redraws the whole shadow map the old way inside a live frame and counts texels that differ from the cached composite.

## Result (three interleaved pairs, median of run medians, range)

| View                   | Script ms per frame                  | Draws          | Shadow draws | Program switches | Frame interval |
| ---------------------- | ------------------------------------ | -------------- | ------------ | ---------------- | -------------- |
| Study                  | 20.2 (19.2-20.6) to 15.3 (14.1-21.9) | 541 to 311     | 268 to 38    | 96 to 52         | 16.7 ms both   |
| Outside, authored 48 m | 89.8 (84.1-91.6) to 56.9 (52.1-67.0) | 1,554 to 1,292 | 353 to 91    | 579 to 173       | 100 to 67 ms   |
| Coast at 160 m         | 86.9 (79.6-97.6) to 50.7 (49.7-53.8) | 1,694 to 1,371 | 404 to 91    | 605 to 176       | 100 to 50 ms   |

Frame rates (noisy under contention): study 35.6 to 43.9 fps, outside 10.1 to 15.3, coast 9.3 to 13.8. An earlier two-pair run on a quieter machine: study 20.5 to 12.7 ms, outside 83.6 to 43.9 ms, coast 82.5 to 47.5 ms. Activation to the first composed frame: 13.8 s (11.9-25.9) and 14.3 s (12.6-16.5), unchanged within noise.

## Re-check on main 049dba240 (two interleaved pairs, same method)

Main moved on to the oak-and-marble kitchen relay and the living room's lantern (049dba240; its successor 2958e6adb only registers test cases, so it serves the same scene). The branch was rebased onto it and measured again against it:

| View                   | Script ms per frame                    | Draws          | Shadow draws | Program switches | Frame interval | GPU ms per frame |
| ---------------------- | -------------------------------------- | -------------- | ------------ | ---------------- | -------------- | ---------------- |
| Study                  | 17.6 (16.7-18.6) to 10.2 (9.6-10.8)    | 548 to 315     | 269 to 36    | 98 to 53         | 16.7 ms both   | 21.7 to 15.3     |
| Outside, authored 48 m | 69.3 (68.2-70.5) to 48.8 (42.3-55.4)   | 1,576 to 1,293 | 364 to 83    | 580 to 174       | 66.8 to 50.0   | 78.7 to 53.8     |
| Coast at 160 m         | 101.8 (95.3-108.2) to 49.1 (47.4-50.9) | 1,713 to 1,400 | 406 to 91    | 606 to 177       | 108.3 to 50.0  | 93.6 to 53.6     |

Frame rates: study 39.2 to 46.0 fps, outside 11.4 to 15.1, coast 9.4 to 12.7. Triangles per frame: study 1.64 to 1.11 million, outside 4.67 to 3.92, coast 4.98 to 4.23 (the cached shadow casters are no longer submitted). By the end of the study sample the shadow cache had rebuilt 12 times in 1,795 shadow frames. Its counter then rose to 45 by the end of the outside sample and 73 by the end of the coast sample, a span that includes the camera's flight outside and its zoom to 160 m, both of which move the shadow square every frame; the sampled frames averaged 83 and 91 shadow draws against 364 and 406, so almost all of them were cached. With a still camera, rebuilds come only from the routine's clock moving the sun (it is checked every 30 seconds) and from casters that start or stop moving.

## Attribution (outside, authored view, 2 runs each, script ms per frame)

| Variant                                 | Script ms | Draws | Program switches |
| --------------------------------------- | --------- | ----- | ---------------- |
| main 94755609f                          | 76-82     | 1,563 | 584              |
| all changes                             | 42-47     | 1,282 | 173              |
| all changes, three's draw order         | 59        | 1,285 | 559              |
| all changes, no shadow cache            | 45-50     | 1,560 | 193              |
| all changes, vector-array uniforms back | 80        | 1,300 | 173              |

The flat uniforms are what make material switches cheap: with them held back, the same 173 program switches and 1,300 draws still cost 80 ms, because every material switch re-flattened the arrays. With them in, the draw grouping and the shadow cache add their savings on top.

## Pixel parity (deterministic stills, 251,790 px each)

| Comparison                                  | Study     | Outside        | 160 m coast     |
| ------------------------------------------- | --------- | -------------- | --------------- |
| Control (base vs base)                      | 0         | 0              | 0-1,532 (max 3) |
| All changes but the draw grouping (matched) | 0         | 0              | 1,261 (max 2)   |
| All changes (ranked draw grouping, matched) | 6 (max 5) | 39-41 (max 40) | 4 (max 5)       |

`draw-order-outside-before.png` and `draw-order-outside-after.png` are the matched outside stills; `draw-order-outside-diff.png` rings the 39 changed pixels (clifftop planting, the glass front's edges): exact depth ties between surfaces of different programs, which the draw order now resolves differently. An unranked first version changed about 340 pixels along the waterline; ranking each program group by its earliest material keeps the sea drawn before the beach. Live shadow maps: 0 of 4,194,304 texels differed in 7 of 8 checks and 1 texel in the eighth (an exact tie between a static and a moving caster).

## Decoding (isolated, 8 interleaved rounds in one page, warmed decoders, median ms)

Draco worker pool (one run):

| Model       | 1 worker | 4 workers |
| ----------- | -------- | --------- |
| House shell | 323      | 118       |
| Avatar      | 315      | 130       |
| Kitchen     | 151      | 74        |
| Hinterland  | 388      | 180       |

Draco against meshopt (a second run; meshopt files re-encoded with glTF-Transform 4.5.1 `meshopt()` defaults, decoded with meshoptimizer 1.3's decoder on the main thread; sizes are gzip -9):

| Model       | Draco, 4 workers | Meshopt | Size, Draco to meshopt |
| ----------- | ---------------- | ------- | ---------------------- |
| House shell | 118              | 23      | 469 to 664 KB          |
| Avatar      | 131              | 39      | 511 to 747 KB          |
| Kitchen     | 54               | 9       | 216 to 218 KB          |
| Hinterland  | 117              | 30      | 1,171 to 1,422 KB      |
| Flora       | 229              | 31      | 2,080 to 2,322 KB      |

Meshopt is not adopted here: it would need a post-process after the Blender export, matched quantization, the planting's custom attributes kept, and a decision that faster decoding is worth about 20 % more bytes.

## Full screen (2560x1440 viewport at DPR 1.5, the home's own full-screen mode, one pair)

| Variant         | Drawing buffer     | Study           | Outside                            |
| --------------- | ------------------ | --------------- | ---------------------------------- |
| main 94755609f  | 3840x2160 (8.3 MP) | 4.4 fps, 32 ms  | 2.7 fps, 333 ms script, 355 ms GPU |
| with the budget | 1642x923 (1.5 MP)  | 11.9 fps, 29 ms | 6.1 fps, 78 ms script, 112 ms GPU  |

The budget capped the buffer at 1931x1086 (2.1 MP); the adaptive step then kept one 0.85 step (frame time 66.7 to 50.1 ms at the 75th percentile), undid two further steps that did not help, and stopped probing. Every composer pass ran at the canvas size (beauty 1642x923, bloom 821x462 and down), so the composer stayed in step with the renderer.

## Site pages (live site, Lighthouse 12.8.2 desktop preset, median of three runs)

| Page                    | Score      | LCP    | TBT    | CLS   | Weight               |
| ----------------------- | ---------- | ------ | ------ | ----- | -------------------- |
| Homepage                | 61 (54-67) | 1.85 s | 903 ms | 0.003 | 1.8 MB, 128 requests |
| /projects/designweaver/ | 80 (78-80) | 1.69 s | 56 ms  | 0.170 | 2.0 MB, 104 requests |

Homepage: `paper-research-field.js` spends 826 ms of script at load (it mounts its WebGL field as soon as its noise texture arrives, visible or not), ScrollTrigger about 0.6 s with the layout it triggers; the LCP is the eager portrait. Both pages: Inter variable fonts 240 KB and 259 KB (italic), Font Awesome webfonts about 210 KB, three render-blocking stylesheets (Google's Material Icons about 320 ms, `main.css` about 300 ms, the Font Awesome CDN about 270 ms), and 86-107 resources with GitHub Pages' fixed 10-minute cache. DesignWeaver's 0.17 layout shift is one move of the whole article. Not changed in this branch: these belong to the site's own design and motion work.
