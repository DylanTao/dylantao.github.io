# PC startup and frame baseline, October 26

These are observations of the complete home on the RTX 3080 Ti PC, using native browser clocks and the restored static-light cache. They do not establish a speedup or a physical-phone result. The baseline server's controller was read back and matched the recorded Git blob; `baseline-custody.json` records its hash and the retained raw profile hashes.

| Visit                                 | Click to ready | Host wall time | Linked programs at ready / later |
| ------------------------------------- | -------------: | -------------: | -------------------------------: |
| Chromium desktop, cold                |       12.705 s |       13.292 s |                          117 / 0 |
| Chromium desktop, warm                |        8.398 s |        8.947 s |                          118 / 0 |
| Chromium phone viewport, CPU ×4, cold |       18.504 s |       19.972 s |                          118 / 0 |
| Chromium phone viewport, CPU ×4, warm |       17.387 s |       18.484 s |                          118 / 0 |
| Windows WebKit phone viewport, cold   |       17.986 s |       19.175 s |                          117 / 0 |
| Windows WebKit phone viewport, warm   |       19.183 s |       20.580 s |                          117 / 0 |

The phone viewport is 390 × 664 at DPR 3 on this PC's GPU. Chromium's CPU throttle does not emulate a phone GPU. Windows WebKit's “Apple GPU” string is a privacy label. Its Long Tasks API is unsupported, so zero recorded entries do not mean there were no long tasks. The last WebKit prime/warm pair used a coordinated quiet window; the earlier samples used the shared workstation. Original arrivals chose different avatars, recorded in the model timings, so the cold and warm rows are not a controlled causal comparison. There were no reported runtime errors in these visits.

Lighthouse 13.5.0 recorded performance 49, accessibility 100 and best practices 100 on the local, uncompressed baseline transport. Its FCP was 11.204 s, LCP 12.929 s, TBT 300 ms and CLS 0.02614. This is an emulator diagnostic, not the deployed CDN or an iPhone score. The compact audit retains the settings and measurements; the complete original report remains under the ignored QA directory with its hash recorded here.

The flicker probe retains the actual downsampled frame triplet around the largest walking spike. Zoom recorded 29 frames, zero acceleration spikes, ten shadow refits and zero resolution changes. Walking recorded 77 frames, seven spikes, nine shadow refits and zero resolution changes. The triplet changes from an open section to a visible ceiling/wall during the walk; without synchronized per-frame camera/roof state it does not identify whether the transition is physical occlusion, section ownership or unstable shading. Readback adds work, so the 216.6 ms zoom capture interval is not a clean frame-rate claim. Repeat the probe with synchronized state after the architecture is frozen.

The 10 s desktop and 15 s phone targets remain open. The portable baseline supports follow-up comparisons; it does not turn one fast warm visit into target acceptance.
