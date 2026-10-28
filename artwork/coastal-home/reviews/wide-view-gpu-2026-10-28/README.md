# Wide outside-view diagnostic ? 2026-10-28

The dominant measured interval is the main material/scene render, which includes Three's full-resolution transmission capture and final beauty. The ocean, reflection, analytic haze and shadow work are smaller. This identifies a next experiment; it is not a verified optimization or a clean production performance comparison.

## Exact served state and controls

Complete combined production site: `http://127.0.0.1:4130/al-folio/?scene-lab=1&quality=high&resolution=fixed`. The coordinator reserved the host GPU window: other owned browsers/builds/native jobs were held. All diagnostic browser processes are now closed; no further GPU probes ran after release. Only owned ignored QA files were written. No public code, tests, quality thresholds or assets changed.

The probe retains all served scene modules and assets and records 301/302 response hashes. It changes no shader, geometry, texture, uniform, visibility, quality setting or reflection cadence. Public South Park selection, a fixed authored Date and global LCG seed 7 are explicit controls. Native RAF, performance and timers remain native. Existing site composer timers remain enabled; a conflicting active query is skipped, never nested. Queries are polled only after availability; both runs have zero disjoint events and zero pending-cap exclusions. The 2K/4K runs retain 6,310/4,522 per-pass query samples, respectively, with 858/612 active-query exclusions across calls.

Before/after **no renderer/GPU hooks from this probe**, three-and-a-half-second frame-count controls:

| Native buffer |    Before |     After |
| ------------- | --------: | --------: |
| 2560 ? 1440   | 15.45 fps | 15.98 fps |
| 3840 ? 2160   | 12.18 fps | 12.08 fps |

These short observations are not a speedup relative to the older 15.6/9.3 figures: source checkpoint, selection and lifetime state differ. The actual 4K renderer readback is NVIDIA RTX 3080 Ti / ANGLE D3D11, Chromium 145. The 2K process used the same host/launch flags and high-performance renderer request, but failed at the subsequent fullscreen resize before its final backend readback; do not invent a separately recorded 2K GPU string.

The first process completed 2K, then hit Chromium's `Browser.setWindowBounds` fullscreen-resize restriction and closed in `finally`. Its portable raw receipt is `2k-receipt.json.gz`. The remaining 4K run used a fresh initially-3840?2160 page; its portable receipt is `4k-receipt.json.gz`. This is retained infrastructure failure, not a quality/resolution fallback. Full-resolution [2K](outside-2k.png) and [4K](outside-4k.png) were inspected and are nonblank complete outside views.

## GPU command-interval attribution

Median milliseconds, in the actual outside camera at radius 48 m:

| Scope                                                         |    2K |    4K |
| ------------------------------------------------------------- | ----: | ----: |
| Main scene render, including transmission, beauty and shadows | 52.32 | 72.36 |
| Sea reflection scene render                                   |  4.97 |  6.80 |
| Ocean draw in the transmission target                         |  1.61 |  3.44 |
| Ocean draw in beauty                                          |  1.55 |  3.30 |
| Shadow-map work                                               |  1.05 |  0.73 |
| Analytic haze composite                                       |  0.23 |  0.58 |
| Full-size color framebuffer blit                              |  0.10 |  0.21 |

The ocean and shadow rows are **subsets** of the main interval, sampled in separate forward/reverse query modes. Do not add them to it. The main scene query has 154/119 samples and about 2,128 submitted draws; the reflection has 176/136 samples and about 740 draws. Other postprocessing render calls are individually sub-millisecond in this state. The haze volume is enabled but **not marching** (`marine=0`, no dust or shafts); this says nothing about the foggy/low-sun march. Timer boundaries cover GPU command intervals, which can include device idle waiting for commands; they do not isolate shader ALU, raw triangle cost or pure CPU utilization. Driver waits can fall in the next reflection call. Clears, mip generation and work outside the selected callback may not all be separately attributed. No exhaustive sum or utilization claim is made.

Source inspection confirms the expensive main scope includes an opaque transmission redraw: the shipped Three r164 `Ht` function allocates a full-viewport half-float transmission target with four samples and calls `Gt(t,n,i)` on the opaque list before the ordinary scene draw. The ocean callback is observed in both this target and beauty. Main beauty uses two samples at 2K and zero at 4K. `transmission-source.json.gz` binds excerpts to actual served Three SHA `d08334115492bd88100491499f9dc9c830759154e524ec536739d1dacb2bce18`. This does **not** time every opaque draw separately or prove that triangle count alone is the bottleneck.

## Important lifetime/shadow-cache limitation

Each run retains 48 `GL_INVALID_VALUE: glGetProgramiv: Program object expected` warnings, plus five existing D3D11 shader warnings. Page/HTTP error arrays are empty, but this is not an empty or clean console. The first no-hook controls already show `shadowCache.enabled=false`, `cachedFrames=0`, one rebuild/copy and subsequent bypasses. Therefore the shadow row is the observed uncached state, not clean cache attribution.

`shadow-cache.mjs` disables itself when a GL error is pending after the first copy. A preexisting program-lifetime error could contaminate admission, but the probe does **not** prove that causal chain. Reflection preparation was one lifetime hypothesis at the time. The later [lifetime qualification](../program-lifetime-2026-10-28/README.md) separately shows that guarded polling and a renderer reset were insufficient for the Chromium warnings, while deferred material retirement clears them in the exercised controls. Console order/text are retained, but **warning timestamps and a pre-selection state snapshot were not collected**. Do not infer the onset time. Re-establish a warning-free lifetime state and verify cache operation before qualifying any optimization.

Exact no-hook arrival/selection sequence, useful for that reproduction:

1. Fresh Chromium with `--use-angle=d3d11 --ignore-gpu-blocklist`; viewport 2560?1440 or initially 3840?2160, DPR 1, America/Los_Angeles, reduced motion `no-preference`.
2. Init Date proxy fixes `2026-10-28T13:20:00-07:00`; global Math.random uses LCG seed 7. No module or avatar-source rewrite.
3. Open the URL above, click 3D, wait `data-scene-state=ready`.
4. Set `[data-world-avatar].value='south-park'` and dispatch bubbling `change`. Wait only `evidence.avatarId==='south-park'`; this is **not** an actor-load-completion guard.
5. Click Full screen and wait fullscreen; click `[data-world-view]`.
6. Wait outside, light field ready, hinterland visible and flora visible; wait 3.5 s.
7. Read starting scene frame count; wait 3.5 s; read ending count/state. Cache is already disabled here, before any renderer hooks. Screenshot follows; only then does `installProbe` attach callbacks.

## One next actionable hypothesis

**Conservatively scissor only the offscreen transmission capture to the union of actual refractive sampling footprints.** Keep its full dimensions, four samples, projection, material ownership, opaque draw order and mip generation, and keep the complete final beauty render. Do not hide the ocean, house, interiors or glass. The old GPU-occlusion gate could not skip the capture because glass/water remained visible; localizing the pixels needed by those surfaces is a different hypothesis.

First compute the union from the actual transmissive render list in this fixed outside view. Bounds must cover displaced world bounds, the maximum thickness/refraction displacement and maximum roughness/IOR mip/filter support, with rounded/padded edges. Unknown deformation, near-plane crossings or unbounded sampling must fall back to the full capture. Clear/restore scissor state correctly and retain every texel the current transmission shader can sample. If the conservative union already occupies most of the target, stop this attempt before a renderer rewrite.

If the bound is useful, prototype scissoring in the pinned r164 transmission path only. Prove exact controlled still parity, including glass and water edges, using same-version controls before admission, then compare quiet interleaved GPU intervals and startup/memory bounds. Do not directly reuse the beauty texture: its 2/0-sample policy differs from the four-sample transmission target. The proposed scissor path preserves those quality policies rather than changing them. No benefit or quality equivalence has yet been measured for this hypothesis.

This targets the dominant full-resolution duplicate material work while leaving the visible scene and quality budgets intact. It avoids repeating withdrawn material sharing, uniform-upload reuse, field-loop changes, normal-pass batching, interior hiding or reduced mirror cadence.

## Portable files

- `probe.cjs.gz`: the exact QA recipe; reserve a new GPU window before running it. It is not a production module.
- `2k-receipt.json.gz` and `4k-receipt.json.gz`: complete raw observations and response hashes.
- `analysis.json`: grouped samples, medians, counts, controls and limitations.
- `transmission-source.json.gz` and `served-*.gz`: byte-preserved source readbacks and excerpts.
- `probe.log.gz`, `probe-4k.log.gz`, `outside-2k.png` and `outside-4k.png`: execution/capture evidence. The PNG pixels are unchanged.
- `coordinator-note.md`: how this earlier diagnostic differs from the later corrected lifecycle state.
