# Correction: fixed-time fixtures and native animation clocks

Earlier worker reviews described `page.clock.setFixedTime` as fixing only Date
while retaining native RAF/performance. That description was wrong. The installed
Playwright 1.58.2 and 1.65.0-alpha-2026-10-28 implementations both install a clock
runtime that replaces performance, RAF and timers, synchronizing their progress
to wall time. Both explicitly ceil the underlying performance clock to integer
milliseconds. Source paths, versions, hashes and exact excerpts are retained.

This withdraws the **native cadence and high-resolution timing claims** attached
to those fixtures, including the earlier rabbit update EMA comparison. It does
not discard the actual rendered pixels, controlled functional assertions, on-draw
GPU matrix/uniform readbacks or independent Node/Blender geometry measurements.
Those remain evidence under their stated controlled conditions. The sealed
study-foliage, interior-lighting, private-reading, rabbit-contact, fixed-route
and raccoon-tail packets are left unchanged; read this addendum with their
Date-only/native-clock wording.

## Replacement runs without a Playwright clock

The new source producers contain no Playwright clock call. They select Noon and
Evening using the public controls and close the panel before using 3D/fullscreen.
Every result retains native-code strings for `performance.now` and
`requestAnimationFrame`, with no `__pwClock` or fake Date present.

The actual public N/orbit comparison uses frozen accepted rabbit source
`31412345b` as baseline and accepted tail source `98474dd24` as candidate. It
records 56 real-RAF samples per engine at native 2560 x 1440 Chromium/D3D11 and
390 x 1000 WebKit 27.2. All 28 original PNGs are nonblank with zero runtime errors.
They include sleeping views and evening activity; the observed states differ
between runs and are recorded honestly. Frame/time reads bracket the images;
they are not claimed as identical-pose pixel comparisons. The mobile layout is
emulation, not a physical iPhone result.

A private passive wrapper times the unchanged accepted tail's synchronous update
and reads its actual sleep/walk state. The first 60 calls of each measured state
are discarded. The result is a bounded CPU-call diagnostic, not whole-frame FPS:

| Engine / state         | Calls |  Median |     P95 |
| ---------------------- | ----: | ------: | ------: |
| Native Chromium, sleep |   304 | 0.80 ms | 1.00 ms |
| Native Chromium, walk  |   186 | 0.20 ms | 0.30 ms |
| WebKit 27.2, sleep     |   303 |    1 ms |    2 ms |
| WebKit 27.2, walk      |   183 |    0 ms |    1 ms |

The native RTX 3080 Ti Chromium run resolves about 0.1 ms. A separate origin-matched
native-clock probe observes 1 ms steps in this WebKit run; zero short-call readings
mean below its exposed resolution, not zero work. Its reported Apple GPU/Mac user
agent is the WebKit test environment, not physical Apple hardware evidence. After
deliberately installing the clock only in that separate diagnostic, both engines
show the shim and 1 ms steps. Their native precision is therefore distinguished
from the framework's explicit integer-ms rounding.

All 500 tail position/joint/weight tuples are unique under an exact Float32-bit
comparison in their own mesh/bind frame. No exact coincident-sample deduplication
is available. No shape reduction, reduced update rate or clearance waiver was
introduced for these measurements.

## Scope, provenance and retained failures

Forty full HTTP responses are hash-checked against the sealed input/module
bindings after capture: the 26 frozen503 controls, baseline/candidate animal
modules, unchanged terrain/manifest/cache controls and the private wrapper. After
undoing only the wrapper's function rename, line-ending normalization and one
appended blank line, its implementation matches the accepted tail byte-for-byte.

The first no-clock attempt relied on storage and collected no sleeping samples.
Two later attempts left the theme panel open and tried to click the underlying
3D button. The intercepted target was that button, not a broken Noon option.
Correctly closing the panel resolves it. These logs are retained; no forced
click or internal phase assignment supplies the replacement results. The first
integer-ms shim profile is retained as rejected native-timing evidence.

The clock excerpts are from Microsoft's installed Playwright source under its
Apache-2.0 license, retained alongside the versions/hashes and license text.
Raw profile calls, clock-control probes, new frame evidence, exact PNG bytes,
producers and response bindings are hashed by `MANIFEST.json`.

No native model, public manifest, official light cache or product source changes
in this addendum. It neither verifies final F6 geometry nor closes the separate
pinniped or sleeping-trunk issues. The coordinator owns final combined gates,
publication and live verification.
