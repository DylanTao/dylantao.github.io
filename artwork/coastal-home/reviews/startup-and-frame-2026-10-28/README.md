# October 28 PC measurements

These are bounded measurements of the complete frozen `scene-compact` production build, served on port 4124. `measurements.json` pins the native master, actual P model, module build and light cache. Raw reports are gzip-compressed without changing their original bytes. The two native workers held builds, rendering and heavy CPU work during the measurements.

| Startup case                           | Ready, cold | Ready, warm |
| -------------------------------------- | ----------: | ----------: |
| Chromium desktop, 1440 x 900, DPR 1    |    12.311 s |     8.763 s |
| Chromium phone viewport, DPR 3, CPU x4 |    18.313 s |    17.610 s |
| Windows WebKit phone viewport, DPR 3   |    18.959 s |    18.681 s |

All six restored the cache and reported no runtime errors. The ready values come from the scene transition; wall observation is retained separately. Arrival identities differ and are recorded. These are individual observations, not a causal comparison, a physical-phone test or a general speedup claim. The 10 s / 15 s targets remain open. Windows WebKit's reported Apple GPU string does not turn host emulation into iPhone evidence.

The high-quality, fixed-resolution full-screen attribution uses actual 2560 x 1440 and 3840 x 2160 buffers on this RTX 3080 Ti through ANGLE/D3D11. The existing harness pins South Park and seeds UUID/random order; it retains the complete production geometry and materials. Each view is sampled for three seconds, so these are short diagnostics.

| View         | 2K observed fps | 4K observed fps |
| ------------ | --------------: | --------------: |
| Study        |            34.8 |            18.8 |
| Outside      |            15.6 |             9.3 |
| Coast, 160 m |            19.9 |            13.0 |

The outside view submits about 2,307 draws per frame. The GPU timer covers the compositing pass and excludes earlier reflection work; callback submission can also wait on the driver. These counters do not measure total VRAM or establish a 60 fps result.

The scripted zoom and walk retain 30 and 85 frames, respectively, with zero detected acceleration spikes and zero resolution changes. The moving full-screen study orbit retains 1,014 frames and 11 detected spikes, with zero resolution changes. Its three strongest adjacent frames are retained. The metric includes real camera and character movement and does not by itself identify shader flicker; it does not close the no-flicker request.

Lighthouse 13.5.0's default simulated mobile run scores 55 performance, 100 accessibility and 100 best practices, with FCP 11.633 s, LCP 13.583 s, TBT 93 ms and CLS 0.01489. It audits the initial 2D homepage. The full raw report is retained rather than projecting those scores onto the 3D scene.

The later P delivery removes only an unused UV attribute; its positions, normals, hierarchy and materials are identical to the compressed model measured here. Its separate geometry/render qualification and complete arrival readback belong to the P compression review. These timings remain pinned to the delivery that was actually measured.
