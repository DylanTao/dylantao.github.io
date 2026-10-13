# Coastal startup checkpoint — October 12, 2026

The October 4 checkpoint left one dominant stall: synchronous shader program realization. This checkpoint removes it without changing a pixel. Programs now compile on the GPU driver's worker threads (`KHR_parallel_shader_compile`) before the first composed draw, and streamed rooms join the house only after their programs are ready.

## Diagnosis

A WebGL call probe (fresh Chromium context, ANGLE D3D11, RTX 3080 Ti, 1440×1000, DPR 1) timed every shader and program call during 3D activation. KHR_parallel_shader_compile was available, but Three.js r164 compiles a material's program on its first draw and immediately reads the program log, which blocks until the driver finishes:

| Moment                       | Main-thread frame | Programs linked in that frame | Blocking `getProgramInfoLog` |
| ---------------------------- | ----------------: | ----------------------------: | ---------------------------: |
| First composed view          |            13.5 s |                            22 |                       13.2 s |
| Secondary rooms arrive       |             5.8 s |                            11 |                        5.7 s |
| Later detail (one program)   |             1.7 s |                             1 |                        1.6 s |
| First Look around (outside)  |             5.2 s |                             7 |                        5.1 s |
| **Total across the session** |                   |                            41 |                   **26.0 s** |

Each of this scene's programs takes 0.1–1.8 s to compile on D3D11, so these first draws froze the page for 26 seconds in all.

## Change

`assets/js/home-scene/program-warmup.mjs` creates every program a composed frame needs, then waits without blocking:

- scene materials, compiled while a linear half-float target is bound, because the beauty pass draws into one and programs are keyed by output color space and tone mapping;
- the contact pass's normal override, compiled against the actual meshes it draws (programs vary with skinning, morphs and vertex attributes);
- shadow depth variants, mirroring `WebGLShadowMap.getDepthMaterial` and compiled without fog, because the shadow pass draws without a scene;
- back faces of transmissive double-sided materials (the coffee glass), a variant `WebGLRenderer.compile` does not create;
- the contact pass's two full-screen materials and `OutputPass`, whose defines are set as its first draw would set them.

Programs are shared by cache key, so each proxy compiled under the real draw's state is the program that draw later finds. When the driver reports a program complete, its main-thread link resolution (about 0.1 s for the largest) runs in its own task, so no frame pays for several at once. Polling uses `scheduler.postTask` where available: driver completion is wall-clock work, and a virtualized test clock would otherwise hold streamed rooms back. Without the extension, or on a software rasterizer (SwiftShader, llvmpipe), nothing waits and drawing keeps the previous path: there, compilation shares the cores that draw, and warming every variant only added work (a Linux software-GL run of the loading, persisted-return and avatar-release cases took 7.7 minutes with one timeout before this guard, 4.3 minutes after, and 5.0 minutes on the unchanged baseline).

## Results

Same probe and machine, the same day:

| Measure                                  | Before | After |
| ---------------------------------------- | -----: | ----: |
| Blocking `getProgramInfoLog`, session    | 26.0 s | 0.6 s |
| Longest main-thread frame during startup | 13.5 s | 0.2 s |
| Room-streaming stall                     |  5.8 s |  none |
| First outside view stall                 |  5.2 s |  none |

`bin/profile_coastal_startup.cjs` (cold context, cache disabled) reported activation to readiness 11.3 s before and 7.4–7.6 s after, and the first complete frame observed at 17.1 s before and 8.7–8.8 s after, in back-to-back runs. Later runs on the same shared workstation ranged from 8.3 to 13.8 s under other load, so the blocking-read totals above are the robust measure. Most of the remaining wait is the driver compiling in parallel while the page stays responsive; the status reads "Preparing the view." until the first composed draw.

**Pixel parity.** Deterministic captures (seeded page randomness with Three's UUIDs on a separate generator, a paused Playwright clock at 13:20 Pacific, reduced motion, the same arrival avatar) of the settled study and the outside view are identical before and after: 0 of 251,790 pixels differ in each, compared at threshold 0.

**Steady frame rate.** The change runs nothing per frame. Two seeded captures of the same build differed by 25–40% in settled frame rate on this shared workstation, so no frame-rate claim is made either way. The profiler gained an optional `COASTAL_PROFILE_SEED` that seeds the page's randomness (and isolates Three's UUIDs) so future A/B captures at least share an arrival avatar, wildlife and dust.

**Regression checks.** The full desk-scene suite passes at 1440 px (45 passed, 3 skipped), and the loading, persisted-return, avatar, rapid-room and transport cases pass at 768 and 390 px.

## Limits

- Programs created later by an avatar switch or a newly loaded activity prop still compile on their first draw; an avatar switch was kept immediate so its visible state does not wait on the driver.
- Phone-sized captures use this workstation's GPU, not a phone. Software rendering (SwiftShader, as in CI) still compiles on the CPU; there the change moves the cost off the first frame rather than removing it.
- PMREM environment generation still compiles its blur program synchronously at startup (about 0.2–0.4 s).
