# Shader warm-up memory follow-up - October 4, 2026

Both shader prototypes remain unpublished. The runtime still equals public source `dff672c14a6dd7acdb4835b7c537d0f84c370a76`; private profiler checkpoint `bec47b7bf9ad3e4d29850740122c3be8605d0a6e` is preserved. The [earlier experiment](native-shader-experiment.md) and its rejected candidate are retained unchanged.

The earlier approximately 17 MiB increase is a sampled peak tradeoff, not evidence of a leak or an established unacceptable budget. This follow-up finds a small bounded program-cache cost and similar settled heaps. One focused allocation correction removes 311 temporary materials while retaining the startup benefit. Its peak measurements remain variable, so a reliable peak reduction is not established.

## Matched comparison

Each cell gives the median of two runs; peak ranges are included because their variation matters. Native Chromium 145.0.7632.6 uses ANGLE/NVIDIA RTX 3080 Ti/D3D11 at 390x1000/DPR 3, with the existing renderer DPR cap. This emulates mobile dimensions on a desktop GPU. Avatar, authored Friday 13:20 Pacific routine, seeded randomness, HTTP-cache policy, real assets, native timers and action windows match. OS shader cache and natural GC timing remain uncontrolled.

| Metric                                               | Published baseline  | Original warm-up    | Shared-normal correction |
| ---------------------------------------------------- | ------------------- | ------------------- | ------------------------ |
| Activation to ready, seconds                         | 8.404               | 3.845               | 3.664                    |
| Sampled natural-use peak, MiB [range]                | 147.1 [145.2-149.0] | 151.0 [150.7-151.3] | 136.2 [112.7-159.8]      |
| Natural idle heap, ready +20-30 seconds, MiB         | 71.530              | 71.964              | 71.962                   |
| Final natural idle heap, MiB                         | 79.201              | 79.562              | 76.299                   |
| Immediate V8 heap after forced GC, MiB (diagnostic)  | 18.755              | 18.942              | 18.978                   |
| Programs after identical room actions                | 43                  | 46                  | 46                       |
| Geometries / textures after identical room actions   | 274 / 27            | 274 / 27            | 274 / 27                 |
| Temporary warm-up materials allocated / then pending | 0 / 0               | 484 / 0             | 173 / 0                  |

The largest startup long task has a median of 6.978 seconds for baseline, 0.397 for original warm-up, and 0.235 for the correction. Later transition stalls remain: largest later-task medians are 2.748, 1.470 and 1.278 seconds respectively. The corrected first two real frames still link five and two programs; preparation is incomplete.

Sampling is every 200 ms. Chromium's [`performance.memory` implementation](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/timing/memory_info.cc) includes V8 heap plus external memory; the [CDP V8 metric](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/inspector/inspector_performance_agent.cc) has a different scope. These figures are not VRAM or total process memory. Synchronous main-thread work can hide allocation peaks between samples.

The original 17 MiB result used shorter windows, CPU profiling, 100 ms sampling and full scene-evidence reads around every frame. This follow-up uses lightweight scalar telemetry and longer natural-use windows. Its peak deltas are separate measurements and do not erase the earlier observation. The correction's upper peak exceeds both original runs; its lower median cannot establish a consistent reduction.

## Lifetimes and attribution

Each run uses 30 seconds of initial idle, eight-second exterior, return, kitchen and study windows, three public 2D/3D reuse cycles (two seconds hidden, six visible), and ten seconds of final idle. Two actual reloads then repeat fifteen-second idle and five-second exterior/return windows. Public mode toggles reuse the controller; the original `pagehide` disposal runs on each reload and final navigation. Development LiveReload is suppressed solely in the isolated test page. The two scene session keys are fixed on reload so the same avatar and initial mode are measured.

All natural windows finish before forced GC. The immediate V8 diagnostic uses the same `HeapProfiler.collectGarbage` invocation in every condition. A separately recorded 500 ms sample permits rendering to resume afterward; it is not the immediate retained-heap measurement. No forced-GC result replaces a natural-use sample.

Observed growth is bounded in these windows:

- Each condition returns to its same program, geometry and texture counts through all three reuse cycles and all three document entries. Hidden-state textures fall from 27 to 21 and return to 27. Program references stay at 202 for baseline and 205 for both prototypes.
- Both prototypes retain three additional physical program permutations: 31 physical programs versus baseline's 28 after the same actions. There is no growing program or material-reference count. Three.js r164 [program acquisition](https://raw.githubusercontent.com/mrdoob/three.js/r164/src/renderers/webgl/WebGLPrograms.js) reuses matching cache keys. Whole-scene warm-up traverses invisible objects too, so it can prepare permutations beyond the observed draw path; attribution to particular meshes is not established.
- All 484 original temporary materials, or 173 corrected ones, are disposed after the first real composed frame. Pending warm-up material count is zero at readiness and every later checkpoint. In the earlier experiment, sampled mobile peaks occurred 11.6-20.2 seconds after activation, after readiness; the new original candidate's largest peak also occurs after temporary materials have been released. Unreachable allocation can still await natural collection.
- After actual disposal, every condition has zero geometries, zero pending warm-up materials, and the same residual counters of four depth programs and three textures before document teardown. The common residue is reported rather than treated as complete GPU disposal. Material disposal releases program references; renderer disposal clears the custom [shader cache](https://raw.githubusercontent.com/mrdoob/three.js/r164/src/renderers/webgl/WebGLShaderCache.js).
- Separately forced GC after final navigation leaves one document, four nodes, zero event listeners and about 1.117 MiB V8 heap in clean baseline/original/corrected runs. Old documents do not accumulate across the measured reloads. Immediate occupied-scene V8 diagnostics remain roughly 18.0-19.0 MiB across entries.

Confidence is high that resources remain bounded in this tested lifecycle and that a lasting 17 MiB offset is absent from the measured settled windows. The data supports transient allocation and collection timing plus a small retained cache cost. Confidence is moderate in that broad attribution; the exact byte-by-byte origin of the earlier 17 MiB peak remains unproven. Driver memory, a physical phone, longer sessions and other avatars are unmeasured.

## Single focused correction

The normal warm-up previously cloned the same `contact.normalMaterial` for every visible mesh. The correction allocates one temporary normal material and shares it among those compile proxies, matching the actual normal pass's shared material. The existing final wait for every renderer program remains, covering static, skinned and morph variants despite `compileAsync` checking each material's current program. Shadow discovery, beauty/transmission/output preparation, request ordering, models and authored presentation keep their original behavior.

Temporary allocations fall from 484 to 173 (64.3%): 172 shadow materials plus one normal material. Both corrected runs retain the same warmed programs and first-draw link counts. The correction is an isolated candidate; the site's runtime files were not edited. The exact patch is retained as `shared-normal-material.diff` in the QA folder.

## Verification and receipts

Local receipts are under `.jekyll-cache/visual-qa/scene-warmup-memory-20261004T1808Z/`: `memory-result.json`, `experiment-manifest.json`, all named run JSON/logs, `memory.cjs`, source snapshots, `shared-normal-material.diff`, and `pixel-comparison.json`. Original first-experiment artifacts remain under `.jekyll-cache/visual-qa/scene-startup-native-20261004T1647Z/`.

There are six matched measurement records, covering eighteen natural scene entries and eighteen actual disposals. Five complete harness invocations pass all assertions. `natural-A1q` completed its three measurement windows and disposals with zero scene, console or request errors, then encountered an isolated observer error on the final `about:blank` page. Its full failed receipt and exact harness are preserved, and `natural-A1q-validated.json` explicitly validates only the completed data. The clean `natural-A2` run confirms the corrected harness. Two earlier preflights with development reload/session-state or restricted asset issues are retained and excluded.

Four additional native reduced-motion runs pass at 1440x1000/DPR 1 and 390x1000/DPR 3. First frame, occupied study, exterior and return-inside images have exactly equal decoded RGB and alpha pixels in all eight baseline/correction state pairs. The inspected first view is complete and nonblank. Each run checks runtime/console errors, actual room/avatar readiness, offscreen frame suspension and 2D escape.

Repository formatting, style contract, Python checks, production `/al-folio` build, public-output validation and preservation receipts accompany this report. Both candidates remain unpublished pending a publication decision and release-scale validation. No scheduled website jobs, new services or foreground-browser changes were performed.
