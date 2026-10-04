# Native shader preparation experiment — October 4, 2026

The candidate is rejected and the runtime baseline is retained. Three matched pairs at each size show faster startup with unchanged fixed-pose pixels, but the mobile emulation's sampled peak host heap increases in every pair. Its three candidate peaks exceed all three baseline peaks. This applies the requested rule to retain the baseline when a regression occurs. No public push occurred.

The retained source correction is limited to `bin/profile_coastal_startup.cjs`: scroll the actual scene into view before waiting for readiness. The original corrected profiler reaches ready on the native GPU at 390 px/DPR 3, shows a complete occupied study, reports no runtime errors, and stops submitting frames after offscreen settling. Runtime modules, request ordering, art, models, textures and existing services remain unchanged.

## Matched measurements

Each table gives the median and observed minimum–maximum for three runs. Pair order is A–B, B–A, A–B. Baseline source is `dff672c14a6dd7acdb4835b7c537d0f84c370a76`. Both variants use Rick and Morty, the same authored Friday 13:20 Pacific routine, matched seeded randomness, real assets, native RAF/performance/timers, one worker, fresh browser profiles and disabled HTTP cache. Only authored Date is fixed. The actual renderer is ANGLE/NVIDIA RTX 3080 Ti/D3D11; OS shader cache and GC timing are uncontrolled. Source hashes, individual values, paired deltas and sample standard deviations are retained in the JSON receipt.

### 1440×1000, DPR 1

| Metric                                         | Baseline median [range]       | Candidate median [range]      |
| ---------------------------------------------- | ----------------------------- | ----------------------------- |
| Activation to ready                            | 7.464 [7.367–8.039] s         | 3.735 [3.630–4.210] s         |
| First GPU completion observed (upper bound)    | 10.267 [10.124–10.818] s      | 4.037 [3.952–4.565] s         |
| First pixel observation                        | 10.965 [10.848–11.592] s      | 4.309 [4.295–4.893] s         |
| Largest startup long task                      | 6.218 [6.133–6.751] s         | 0.618 [0.162–0.650] s         |
| Largest later long task                        | 2.753 [2.729–2.773] s         | 1.312 [1.272–1.313] s         |
| Largest whole-run trusted input delivery delay | 6.033 [5.919–6.558] s         | 1.287 [1.022–1.299] s         |
| Sampled peak host heap                         | 155.474 [116.876–161.410] MiB | 158.187 [156.140–167.228] MiB |
| CDP heap observed at ready                     | 20.538 [19.179–31.478] MiB    | 33.541 [32.058–37.742] MiB    |
| CDP heap observed after return inside          | 24.103 [23.504–30.934] MiB    | 36.151 [20.764–36.759] MiB    |

### 390×1000, DPR 3 on the same desktop GPU

| Metric                                         | Baseline median [range]       | Candidate median [range]      |
| ---------------------------------------------- | ----------------------------- | ----------------------------- |
| Activation to ready                            | 7.617 [7.604–7.900] s         | 3.858 [3.561–4.354] s         |
| First GPU completion observed (upper bound)    | 9.965 [9.919–10.340] s        | 4.149 [3.849–4.361] s         |
| First pixel observation                        | 10.709 [10.692–11.207] s      | 4.543 [4.244–5.191] s         |
| Largest startup long task                      | 6.165 [6.143–6.453] s         | 0.229 [0.204–0.245] s         |
| Largest later long task                        | 2.483 [2.402–2.877] s         | 1.295 [1.247–1.661] s         |
| Largest whole-run trusted input delivery delay | 2.355 [2.237–6.419] s         | 1.073 [1.067–1.536] s         |
| Sampled peak host heap                         | 141.729 [139.918–151.964] MiB | 158.396 [155.521–174.255] MiB |
| CDP heap observed at ready                     | 23.225 [20.868–27.456] MiB    | 31.755 [28.891–31.851] MiB    |
| CDP heap observed after return inside          | 35.627 [26.903–36.404] MiB    | 35.656 [26.254–35.676] MiB    |

Desktop median readiness improves by 50.0%; mobile emulation improves by 49.4%. The mobile sampled peak heap median increases by 11.8% (141.729 to 158.396 MiB), with candidate range 155.521–174.255 MiB versus baseline 139.918–151.964 MiB. Heap observed at readiness also increases at both sizes. These are sampled host-JS measurements, not GPU VRAM or an absolute allocation peak; the capture cannot isolate allocation lifetimes from GC timing. The consistent mobile increase is sufficient to reject this candidate conservatively.

The baseline's later study stall is 2.270–2.773 seconds. It is reduced by preparation, but an exterior-entry stall remains: 1.272–1.313 seconds on desktop and 1.247–1.661 seconds in mobile emulation. Every long task and native RAF interval, including intervals ≥500 ms, remains in the raw receipt; a steady sampling window is not used to hide transition stalls.

GPU completion is observed using a nonblocking WebGL2 fence on a native timer. This is an upper bound that can be delayed by subsequent main-thread work, not physical presentation time. Screenshot observation is separate. Trusted CDP F24 probes have no bound action and measure input delivery/acknowledgement, not physical input or INP. CPU profiling, seeded randomness and probes add matched overhead. Mobile emulation uses the desktop GPU and the existing renderer DPR cap; it supplies no physical-phone or Safari performance claim.

## Candidate and functional evidence

The candidate exists only in isolated QA module overrides. It collects the actual shadow mapper's draw descriptions, prepares custom/static/skinned depth and normal variants, and compiles physical/light/environment beauty against the actual composer target. Transmission backfaces, contact horizon and bilateral blur, and the output pass's actual transfer/tone defines are prepared separately. Renderer state is restored in `finally`, all retained programs are awaited, and readiness still follows the actual composed first view. This follows the checked-in r164 pipeline and its [renderer](https://raw.githubusercontent.com/mrdoob/three.js/r164/src/renderers/WebGLRenderer.js), [shadow mapper](https://raw.githubusercontent.com/mrdoob/three.js/r164/src/renderers/webgl/WebGLShadowMap.js) and [program parameters](https://raw.githubusercontent.com/mrdoob/three.js/r164/src/renderers/webgl/WebGLPrograms.js).

Preparation remains incomplete: desktop still links five programs in the first real draw and two in the second. A single `compileAsync` call would not qualify the actual composer, light, material, contact, output, shadow and transmission paths. The retained candidate is not claimed to eliminate every lazy variant.

All twelve moving comparisons and four reduced-motion runs complete with zero runtime/console errors, actual first-view actor/room readiness, zero submitted frames after offscreen settling, and successful 2D escape. At both sizes, first-frame, occupied-study, exterior and return-inside reduced-motion captures have exactly equal RGB and alpha pixels: eight state pairs, checked independently of PNG compression. The inspected first view is nonblank and complete. This unshipped candidate did not receive a full four-viewport/theme/engine release matrix.

## Verification and retained receipts

- `npx.cmd prettier --check bin/profile_coastal_startup.cjs` passes.
- `node --check bin/profile_coastal_startup.cjs` passes.
- `npm.cmd run lint:style-contract` passes.
- `python -m unittest discover -s test -p "test_*.py"` passes all 168 checks in 2.541 seconds.
- Production Jekyll `/al-folio` build passes in 256.272 seconds using the existing container and a separate ignored destination. Controller and finish-module bytes equal the retained runtime baseline; the evidence document is excluded from public output.
- `python test/validate_publication_outputs.py <production-al-folio>` passes.
- The corrected original profiler passes the native 390 px/DPR 3 case.
- The fixed native harness passes 12 moving runs and four reduced-motion runs; every run checks actual visibility, source/actor/room, errors, offscreen suspension and 2D escape.
- All eight RGB/alpha comparisons pass, and `git diff --check` passes.

Local receipts are under `.jekyll-cache/visual-qa/scene-startup-native-20261004T1647Z/`: `native-shader-result.json`, `still-pixel-comparison.json`, `precondition-mobile.json`, and each named run's JSON, CPU profile, log and four original canvas PNGs. Baseline/candidate module snapshots, `bench.cjs`, `shader_preparation.inc.mjs`, `make_candidate.py` and the summarizer are retained for review. The earlier erroneous harness `isVisible` assertion and preliminary RAF-fence/rounded-heap run are retained separately and excluded from the final matched comparison. No CI reruns, new model assets or services, scheduled website jobs or foreground changes were performed for this experiment.
