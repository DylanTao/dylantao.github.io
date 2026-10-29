# Desktop orbit, rock normals and a centered arrival

This checkpoint corrects measured controls and rendering defects. The mountain shape, straight main stair, interior decoration and physical-device performance remain separate open work.

The original 4K-request inspection already completed continuous exterior yaw. Its fixed mouse gain made each 900px sweep turn 7.2 radians; twelve sweeps made 13.75 turns. The same input now follows the visible canvas dimensions: twelve sweeps at CSS 2560×1440 turn 4.21875 times, with an actual 3840×2160 buffer. Small embeds and touch retain their established gain. The outside pitch opens from0.12..1.2 to−0.35..1.35, retaining terrain clearance, room collision steering and the safe pole margin. Five trusted quarter-turns, low/high views and immediate reversal pass. Selecting a room in fullscreen closes its controls panel so it does not intercept the next drag.

This does not reproduce every angle in Sirui's PC report. Room obstacles still constrain their camera arms; confirmation of the finished PC experience remains useful. The retained 4K inspection is functional evidence, not a frame-rate benchmark.

## Actual rock-shader failure

A separate, unaccepted native mountain candidate exposed a large black patch in a complete seated-eye render. Keeping the exact camera, geometry, materials, receivers and scene, replacing only the bump-normal expression reduced 1,075,495 pure-black pixels to zero. The new expression normalizes the screen-space derivative basis and uses a finite near-zero fallback. It preserves bump detail; nearby and grazing controls change at most one channel value on 41/22 pixels, and the far view's 99th-percentile difference is zero.

`shader-diagnostic/` retains the paired 4K failure/control and the measured producer receipt. Those images qualify the numerical repair, not that candidate's geometry, static field or appearance. Its lighting budget and native preservation remain red. The actual high-float precision and CPU conditioning measurements do not prove a GPU underflow cause. The released native source stays `75afc57f…`; no GLB changed here.

## Entrance return

The prior visual CI run 40893107066 finished 41/42. Its full keyboard entrance journey completed 68m but returned at 8.397m against the authored 8.3m marker. The marker lay only 5cm from the landing edge. Native raycasts find 8.300078m stone under the center, but rising rock and paving reach 8.415m under the body's outer footprint.

The public marker and route endpoint now sit at the center of the existing landing. A native regression includes the 24cm body radius plus 13cm steering tolerance; every rim sample remains on the flat platform. The strict public journey height assertion stays unchanged. The clifftop terrain fixture now goes through the pavilion opening before its hill loop, instead of cutting diagonally through its side wall from the new centered marker. A separate native fixture failure required an already-visible, reduced-motion embed to draw after a no-op scroll; it now settles actual visibility, while the following fullscreen action must still draw.

The final entrance round trip passes in Windows Chromium (1.4m) and pinned Linux/Mesa (10.7m), using ordinary keyboard steering with no later body placement. The larger straight-stair/water/planting redesign is not complete.

## Gates and limits

The complete final production build took 111.568 seconds. All 913 Node tests completed:906 passed, seven existing skips. All 320 Python tests pass. The new camera/refresh/native checks and the style contract pass. The registry contains 142 unique scene cases per standard viewport, with no missing or duplicate case. Fullscreen desktop sweeps and the existing room-boundary case pass on native Chromium; the numerical shader/camera combination also passes pinned Mesa and modern WebKit 27.2 touch jumping in portrait/landscape. The software results are functional checks.

The official cache was re-baked with signature `f5ec66a743d773ef5dbd04bd3ff6403e33f598681114992cd72fa17c0844fef7`, SHA-256 `70cb939054eb796e12e076c312cd7e1bdd125064659d2b2fbe91517ab194c8bb`, 792,953 bytes. The camera metadata refresher preserves unrelated numeric spelling and compact terrain arrays; its first whole-file serialization was rejected after adding 6.3KB compressed whitespace and exceeding the unchanged four-MiB gate.

`attempts/` retains failed controls rather than treating later passes as their results. A later commit needs its own CI and deployed readback. Verify this sealed checkpoint with `python artwork/coastal-home/reviews/pc-controls-2026-10-29/verify.py --git <checkpoint>`.
