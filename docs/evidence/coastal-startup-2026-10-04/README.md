# Coastal startup checkpoint — October 4, 2026

The first scene draw now waits for the occupied room and selected avatar. Opening, coast, room and view messages remain accessible until that draw completes; Look around then becomes available and secondary rooms stream. This fixes premature rendering and misleading readiness while preserving the existing models, materials, authored routine, album state and visual direction.

Cold startup still takes about 14 seconds on this host. This checkpoint does not establish a speed improvement. Native CPU samples identify synchronous Three.js shader/program realization, including driver program-log/status queries, as the dominant remaining main-thread stall. The actual scene and CI screenshots were inspected; the unavailable Library reference pixels were not compared.

## Failure diagnosis

The [b022 visual run](https://github.com/DylanTao/dylantao.github.io/actions/runs/37166950123) finished with all four site streams passing and four scene streams plus legacy failing.

- All four scene streams fail at `clock.pauseAt(Date.now() + 1000)`: browser IPC arrives after the target time on the software GPU. The correction fixes wall time while acquiring the pause, then restores advancing Date before `runFor`. A 1.6-second delayed-command reproduction verifies the former failure and exactly 100 ms of subsequent clock advancement. All 69 original simulation assertions remain identical.
- Legacy exhausts its 120-second total budget after several 12–16-second software-rendered input round trips. The study button is visible in its failure screenshot; this is not evidence that the control disappeared. The return test now exercises the public Back inside action with native keyboard Enter and verifies the Now/Explore boundary.
- WebKit's shorter viewport exposes a readiness-order assumption: the first scene can be below the fold. The helper shows the canvas before waiting for its completed first draw. The app continues to suspend offscreen rendering.

## Qualified native measurements

The captures use fresh Chromium contexts, disabled HTTP cache, real fonts and assets, native performance/RAF/timers, CPU sampling, and ANGLE D3D11 on an NVIDIA RTX 3080 Ti. Only the authored routine Date is fixed at October 2, 13:20 Pacific. The initial captures using Playwright's clock helper are retained for audit but excluded from these measurements because that helper also virtualizes performance/RAF/timers.

| Capture                     | Arrival avatar | Ready from 3D activation | First complete-frame observation | Settled study FPS | Settled outside FPS |
| --------------------------- | -------------- | -----------------------: | -------------------------------: | ----------------: | ------------------: |
| b022, 1440×1000, DPR 1      | South Park     |                   9.75 s |                          14.50 s |             58.84 |               33.35 |
| Candidate, 1440×1000, DPR 1 | Rick and Morty |                  10.09 s |                          14.06 s |             58.50 |               32.67 |
| Candidate, 390×1000, DPR 3  | Rick and Morty |                  10.43 s |                          14.03 s |             58.25 |               33.04 |

These are single captures with different arrival avatars and uncontrolled OS shader caches. The phone-sized capture uses the same PC GPU; it is not a physical-phone benchmark. First-frame observation includes inspection latency and is backed by a nonblank screenshot.

On the candidate desktop capture, the study and avatar parse by 1.03 and 1.14 seconds after controller startup. The first render submission then stalls for 8.74 seconds; another submission takes 3.66 seconds, and first outside rendering takes 2.85 seconds. The largest browser frame gap is 8.77 seconds. The source fix removes the earlier partial-house draw; shader/program setup still blocks a complete first view.

The settled study submits about 533 draw calls / 2.08 million triangles; outside submits about 2,132 / 4.58 million. These count multipass submissions rather than unique authored geometry. The existing finish-pass GPU timer reports medians of 5.49 ms inside and 8.42 ms outside, excluding ocean reflection and CPU solvers. The profiler records complete render-submit durations and every browser frame gap separately.

CDP reports a 21.46 MB used JavaScript heap and 64.32 MB total heap for the candidate desktop capture. GC timing makes this unsuitable as a memory-saving claim. Three resource counts and heap values do not measure total GPU VRAM. After offscreen settling, the scene adds zero frames. Particle preparation measured about 79 ms in the initial diagnostic; the authored 18 simulated seconds are not 18 wall-clock seconds.

## Verification and preserved work

- Both production profiles built successfully: root 96.625 s, `/al-folio` 91.229 s. Publication/output validation and the unchanged PurgeCSS configuration pass.
- 20 focused scene cases pass across 1440, 1280, 768 and 390 widths, including delayed avatars, first-frame status, original conserved-water/steam proof, pause/recovery, visible water changes and album transfer.
- Four additional light/dark composition cases pass at desktop and phone widths, including nonblank canvas, keyboard focus and actual orbit/zoom pixel changes. Their rendered captures were inspected.
- Six focused legacy cases pass in Chromium desktop and WebKit/iPhone emulation: public return, album sharing and project navigation.
- The complete conserved-water/steam case also passes with ANGLE SwiftShader forced at 390 width in 6.6 minutes, using the existing Linux 600-second transport budget. All 69 simulation assertions and original assets are retained.
- The public outside/zoom/scroll/return case passes with ANGLE SwiftShader forced on desktop in 1.1 minutes, within its unchanged 120-second budget. This is Windows software-rendering evidence; the Linux workflow still needs its own rerun.
- 168 Python and 58 relevant Node numerical/state tests pass. The style contract and override audit pass; the existing 80 override acknowledgements remain unchanged.
- All 20 original GLBs and all 445 validated image files are retained with matching hashes in both production profiles. No Blender geometry, visual treatment, shader, solver, dependency, credentials, worktree or existing server was replaced.

Raw evidence lives in `.jekyll-cache/visual-qa/scene-diagnosis-20261004T0136Z/`: `qualified-performance-summary.json`, `*-realclock-*.json`, CPU profiles, loading/transport screenshots, CI logs and original source backups. Initial failed test/profiler receipts remain alongside corrected results. The initial local checkpoint did not include a full Linux run; the post-push outcome is recorded below.

## Linux release follow-up

The normal push of `5ab7a8b` deployed successfully; its generated Pages commit is `26511dc232ac27c9ed72e679be0c843603d82e91`. Live module bytes match the tested source, and the published first-frame loading case passes with real room and avatar assets. The [exact-commit Linux run](https://github.com/DylanTao/dylantao.github.io/actions/runs/37171843485) finishes with all four site streams and legacy passing. The four scene streams progress past the old clock race and then exhaust the existing 600-second transport budget. In the phone trace, `runFor(900)` takes 301 seconds while drawing the full native volume; the next `runFor(2400)` cannot finish before the deadline.

The follow-up fixture uses a disclosed 15 Hz virtual RAF cadence for Linux/software proof and retains the default cadence for native checks. All 69 assertions, every `runFor` interval, solver code, actual assets, effects and render dimensions remain unchanged. The controller samples elapsed time, so the complete simulation interval still advances and sampled scene frames use the actual renderer. Cancellation preserves pending-frame suspension. The proof records its virtual timestamps and actual GPU renderer; it is explicitly excluded from performance measurements.

Local forced SwiftShader proof passes in 2.0 minutes with 3.2 simulated seconds of steam advancement, relative water-mass error `7.45e-16` and a measured water-patch pixel change of `0.0417`. The native cadence also passes in 41.4 seconds. These are fixture results, not an app rendering-speed improvement. Follow-up logs and traces live in `.jekyll-cache/visual-qa/scene-publication-20261004T0240Z/`; the replacement Linux matrix must complete before this release is considered verified.

## Explicit clock follow-up

The [84bd771c Linux run](https://github.com/DylanTao/dylantao.github.io/actions/runs/37174633286) is terminal: all four site streams pass, while scene and legacy stop at different animation deadlines. Its laptop and phone transport proofs pass at 15 Hz; laptop records 3.2 simulated seconds, relative water-mass error `5.59e-16`, actual SwiftShader and a water-patch change of `0.0727`. Tablet still exceeds the 600-second transport budget. Desktop misses P's short Curious phase, laptop times out waiting for an exterior frame after resume, phone spends 126 seconds rendering 650 virtual milliseconds of album transfer, and legacy again exceeds its unchanged 120-second total budget.

The next fixture checkpoint explicitly advances gesture, water and requested still frames. It waits for the reduced-motion control to update before drawing its final stopped frame. Album transfer retains the original ten-second single-callback jump using `fastForward` after acquiring a safe pause; [Playwright documents the same jump semantics for `pauseAt`](https://playwright.dev/docs/api/class-clock#clock-pause-at). Existing pose, nap/wake, water-pixel, conservation, contact/lift, newest-album and Now/Explore assertions remain intact.

Software transport and album proof use a disclosed 10 Hz virtual continuous cadence, with a 16 ms initial input frame. A 5 Hz attempt was rejected by the unchanged pause equality assertion: its next queued frame could arrive after the existing 100 ms settling window. That failed receipt is retained. Native proof keeps Playwright's default RAF cadence. All original transport simulation intervals, assets, effects, dimensions and runtime code remain unchanged; these clock-controlled captures are explicitly excluded from performance benchmarks.

Eight focused native-GPU checks pass at desktop and phone widths. Chromium desktop and WebKit mobile public return checks also pass. Forced SwiftShader transport passes with 3.2 simulated seconds, relative mass error `1.86e-16` and water-patch change `0.095`; software exterior water and album proof pass in 2.8 and 2.0 minutes within their original 300-second budgets. The forced software public return case takes 34.1 seconds within its original 120-second budget. The pose and real-pixel captures were inspected; 168 Python and ten companion state tests pass. Exact-commit Linux matrix and Pages completion remain the release verification gate. No application GPU speed improvement is claimed.

## Reproduce and next bounded work

```powershell
$env:COASTAL_PROFILE_URL='http://127.0.0.1:8080/'
$env:COASTAL_PROFILE_WIDTH='1440'
$env:COASTAL_PROFILE_DPR='1'
node bin/profile_coastal_startup.cjs .jekyll-cache/visual-qa/coastal-startup.json
```

Use one owned server and one headless browser worker. For the next performance experiment, inspect async shader/program preparation against the actual composer render target and its shadow/contact/transmission variants, preserving first-frame pixels and error reporting. Then profile the exterior's reflection and draw submissions separately. Do not infer benefits from byte size alone or reduce geometry/effects to make a software-GPU test pass. Reference-dependent art/face/cliff/interior changes remain separate until the required reference pixels are available.
