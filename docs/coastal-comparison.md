# Compare two coastal house builds

Serve the main and candidate builds at different origins, such as two local ports. Give each build its own output directory when building Jekyll. Use the full homepage URL, including the base path when the build has one. The comparison runs against the bytes those servers send.

```powershell
node bin/compare_coastal_revisions.cjs --main-url http://127.0.0.1:8080/ --candidate-url http://127.0.0.1:4182/ --out .jekyll-cache/visual-qa/coastal-comparison-01
```

Add `--main-manifest-sha256` and `--candidate-manifest-sha256` when the two build receipts provide pins. The SHA-256 values refer to the exact served `assets/models/home/manifest.json` bytes. Use a new output directory for each run.

The console shows each build's main numbers and candidate-minus-main deltas. `comparison.json` keeps the homepage, manifest and compiled module receipt hashes, a per-file cold scene ledger and its digest, the actual GPU and browser, the published Rooms and lab look lists, and the PNG names and hashes. Each side saves the manifest the cold browser loaded. Hashes identify delivered content. The server or deployment receipt provides its source commit.

## What the command measures

- **Ready and bytes.** A cold browser context enters 3D using the homepage button and records click to the first composed ready frame. The `?cinematic=live` test switch keeps the normal loading sketch visible in automation. The ledger counts one copy of each successful scene response initiated by that point at that side's origin and base path. Sizes are the exact served bodies normalized to gzip level 6, without the source compiler credit. The 4 MiB reference is the same as the first-scene gate. This observed cohort does not cover the static gate's worst-case avatar, bedding and detail combinations. Aborted requests are listed separately.
- **Moving frame and draws.** A second context in the same browser opens the embedded scene lab with reduced motion. Rooms → House film stages the grouped coastal models. Return restores the room and keeps both coast roots visible. The tool records this setup separately, restores motion, and opens full screen before sampling. The governor's fixed mode, the Standard tier and a native 2560 × 1440 canvas hold resolution equal. Two six-second samples use the existing view sampler to measure the median and p95 frame intervals and mean GL draws across passes. The views are the Realistic noon coast and the Realistic night lounge. Submission and available GPU timings are also retained.
- **Stills.** The same lab context reduces motion and draws noon coast, dusk section, and night lounge once per available look. Both builds use the same camera vectors and November 20 light at 12:00, 16:46, and 21:00 Pacific. The lab uses clear weather. Each captured canvas must be nonblank and at native resolution. For shared looks, compare the paired figures at the same camera and projection. Each build keeps its own published and lab lists, including any choices with no peer.

The views use native Chromium on this computer. The comparison uses a fixed routine date, a shared random seed, and the existing Lizard avatar fixture. The browser runs each served routine with the same avatar selection conditioning. Hashes and bytes always use the original served response. Start with the renderer idle. Compare cold timing causally only when the servers share their delivery conditions. Public Pages and local Docker can usefully compare exact delivered bytes and matched native renders, but their cold ready times include different network paths. Two six-second samples and up to fifteen desktop PNGs per revision generally take a few minutes. The tool bounds each revision to six minutes and any individual normal 3D startup to two minutes.

A stale manifest, missing scene asset, software renderer, downscaled buffer, incomplete capture or unmatched camera fails the command. A partial report identifies the failing phase and missing frames. An unavailable view leaves the remaining independent views eligible for capture. Keep the two served builds fixed during capture.

```powershell
node --test test/coastal-comparison.test.mjs
```

## November 21, 2026 · Native 2K checkpoint

Main was `409ffeb6cb64e21029c1db82f8667a3a54bcfc35`. The candidate was `761c8a7a82f8424f7d38165581092ceae5f0e0e4`. Both were immutable production builds served on separate loopback origins with the same `/al-folio/` base path. The runner verified the original compiled modules against both build receipts, and both signatures restored their corresponding static-light cache.

The host was an Intel Core Ultra 7 155H with Intel Arc graphics (`0x00007D55`), using Arc driver `32.0.101.8132`, ANGLE Direct3D 11, and Chromium `145.0.7632.6` on Windows 11 build 26300. The scene used Standard quality at DPR 1 with a verified 2560 × 1440 drawing buffer for capture and timing.

| Measurement                                       |             Main |        Candidate |
| ------------------------------------------------- | ---------------: | ---------------: |
| Cold 3D click → composed Ready                    |         23.161 s |         25.977 s |
| Cold first-scene gzip-6 bytes, 218 responses each |        4,050,273 |        4,050,373 |
| Separate embedded Film click → Return             |          3.929 s |          4.958 s |
| Noon coast frame p50 / p95                        | 233.3 / 583.4 ms | 249.9 / 633.3 ms |
| Noon coast mean GL draws per frame                |          3,962.9 |          3,967.5 |
| Night lounge frame p50 / p95                      | 250.0 / 500.0 ms | 249.9 / 416.6 ms |
| Night lounge mean GL draws per frame              |          1,184.5 |          1,186.8 |

Cold Ready includes the normal loading drawing and ends on the first composed frame. The observed byte delta was +100 B. An earlier cold pair with the same bodies reached Ready in 24.748 s and 22.496 s, reversing the ordering. The reversal shows that a single run can change the ordering. The moving samples began after the separate 793 × 480 reduced-motion Film stage, both visible roots survived Return, and normal motion resumed. The requested six-second windows spanned 8.09–9.20 seconds in the recorded browser clock. The values are paired observations of these states.

Both builds exposed Realistic, Painted, Watercolour, Woodblock, and Cartoon. All 30 native PNGs matched their recorded hashes and passed the fixed camera checks for noon coast, dusk section, and night lounge, with zero reported browser errors.

A separate direct moving 2K outside selection from Study attached both coastal GLBs on both builds. Each parsed within 2.3–3.7 seconds of its request, and both roots remained hidden through 90 seconds. In the controller, `loadFlora()` and `loadHinterland()` each call `revealCoast()`, which awaits the shared program warmup queue before making its root visible. Film groups both first attachments in one reveal. The measurements locate the delay between attachment and reveal. The separate costs of the queue, moving frames and buffer size remain unresolved because the staged run changes all three. [Outside and Film reveal](https://github.com/DylanTao/dylantao.github.io/blob/409ffeb6cb64e21029c1db82f8667a3a54bcfc35/assets/js/home-scene/controller.mjs#L1306-L1359)

To replay these revisions, build both source SHAs in production mode with the `/al-folio` base path and serve each build below that path. Use the exact served manifest pins from this checkpoint.

```powershell
node bin/compare_coastal_revisions.cjs `
  --main-url http://127.0.0.1:4191/al-folio/ `
  --candidate-url http://127.0.0.1:4192/al-folio/ `
  --main-manifest-sha256 8d73f791e0f7ced08c38d51cb5e5d68bc99e82e04b58606695525f7c7cc02684 `
  --candidate-manifest-sha256 66e92ca823bf22da28920f1c733ddd967b8b46c172eb544d791e50e94a3cbf84 `
  --out .jekyll-cache/visual-qa/coastal-comparison-nov21
```

## What delayed the trees

A visitor selected **Step outside** from the Study at noon on the Intel Arc laptop. The visible frame was fixed at 2560 × 1440 with the same camera and avatar. The old scene parsed both coastal models within four seconds of requesting them, then kept them hidden while it prepared their drawing programs. Submitting the two groups together saved work. In a moving scene it still left the hill bare past 90 seconds.

| Ordinary exterior, native 2K                                            |    Both models visible |
| ----------------------------------------------------------------------- | ---------------------: |
| Earlier code, ambient motion on                                         | Still hidden at 90.5 s |
| One joint preparation, ambient motion on                                | Still hidden at 90.9 s |
| Earlier code, reduced motion                                            |                 8.94 s |
| One joint preparation, reduced motion                                   |                 6.41 s |
| One joint preparation with a short pause between settled exterior draws |                 27.0 s |

During that last measurement the visitor’s right-arrow turn appeared within a 0.26-second sample while the trees were still arriving. A separate on-foot visit advanced 1.23 m under the W key and revealed the planted headland in 25.51 seconds. Fourteen more frames followed at the ordinary cadence. The first transition to this large outside view could still occupy the browser for 7.7 seconds. These observations use the frozen November 20 deployment’s models and a single changed controller. [Earlier and revised views from the water](../artwork/concepts/coastal-home/2026-11-20/stepping-outside.webp)

The controller leaves a 120 ms interval between settled outdoor frames while the driver prepares newly attached coastal models. Camera transitions, orbit input and active walking keep requesting their own frames. Reduced motion retains its normal rest behavior. The film still holds the last completed entrance picture. A test that canceled a pending film, then interrupted a plant download, retained the headland. A later Step outside retried the planting and recovered it. Run `node --test test/coastal-stream-reveal.test.mjs` for overlapping requests, optional assets, retries and disposal.
