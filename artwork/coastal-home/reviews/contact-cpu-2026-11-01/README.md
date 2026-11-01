# Exact contact-query reuse: a modest CPU gain

Source `8ef8696236c0233504f626976783b6dabbb0433d` reduces repeated ground-query
work against physical baseline `d36672bda0b3ee557989853f51665b1893da398a`.
The matched six-pinniped case saves 1.6 ms median CPU time. Raccoon fit time
and frame cadence show no meaningful improvement. Those limits remain open.

## What changed

The captured point/face index uses collision-free numeric keys inside its
existing cell rectangle. Cell size, triangle membership, insertion order and
barycentric tests stay unchanged. Outside rows/columns cannot alias occupied
cells; unsafe index ranges use the original string keys. Boundary indexing
retains its original representation.

Repeated point queries may reuse a result only within the same captured patch,
at bit-identical X/Z coordinates and within a proven height-filter interval.
Its upper boundary is the first previously excluded surface. Moving through
that height, changing coordinates, switching patches or capturing new ground
runs the full query. Visibility is read again. All delivered points, faces,
poses and physical targets remain; update cadence, models and visibility
policy are unchanged. There is no floating-point reassociation in this pass.

The cache adds one record per queried point: at most 31,468 records across
these six land pinnipeds and the raccoon's curled-body subset. Total JS heap
cost was not measured. Renderer memory is identical in the matched captures;
that metric does not include these JS records.

## Exact physical controls

- All 893 dense raccoon poses match d366, including every world-skin hash,
  root, bone matrix, paw, contact field and other-animal matrix. The 2,166
  pinniped poses also match all accepted skin/contact records. Together these
  compare 16,530,608 vertex records.
- All 1,007 pinniped events / 15,105 full-skin poses and their contact/velocity
  fields match the accepted physical output exactly. So do all 463 raccoon
  event poses and 2,436 numeric 30/60 Hz trajectory poses.
- Four complete recaptured outputs are byte-identical to predecessor packets.
  `REUSED_PAYLOADS.json` binds both compressed and original bytes. Those files
  are referenced directly instead of duplicated. Their historical harness
  labels remain; the current source mapping is in `SOURCE_BINDINGS.json`.
- Terrain/model/manifest bodies are unchanged. Identical complete posed
  coordinates therefore preserve the predecessor's full terrain-face
  separation result, including explicit missing-projection custody and paw
  tangencies. This is an identity derivation; this pass does not claim a new
  independent all-face SAT run or all-time proof.

The full wildlife suite passes 71/71 tests. Focused cases include negative
coordinates, outside-grid aliases, unsafe grid dimensions, stacked surfaces,
height thresholds, live visibility, distinct patches and recapture. Targeted
Prettier and diff checks pass.

## Native timing

Both pairs use native Date/performance/RAF, public Noon, the same complete
frozen scene and 29 checked response bodies, fixed authoring views, high tier,
2560×1440 buffer, 4× MSAA and 4096 shadows. No quality demotion occurs.
Temporary passive timers and restored beauty-draw callbacks record actual
calls and frame intervals. Their executed bodies are retained separately.

| Matched cost, median / P95   | d366 baseline  | Query reuse    |
| ---------------------------- | -------------- | -------------- |
| Six-pinniped contact fits    | 13.8 / 16.0 ms | 12.2 / 14.3 ms |
| Six-pinniped complete poses  | 13.9 / 16.2 ms | 12.3 / 14.6 ms |
| Pinniped-view frame interval | 33.3 / 33.4 ms | 33.3 / 33.4 ms |
| Raccoon body fit             | 2.6 / 3.1 ms   | 2.6 / 3.0 ms   |
| Complete raccoon pose        | 3.4 / 4.0 ms   | 3.2 / 3.8 ms   |
| Raccoon-view frame interval  | 16.7 / 16.7 ms | 16.7 / 16.8 ms |

These are current matched pairs on the RTX 3080 Ti, active time 30–50 s.
Earlier unmatched physical-checkpoint timings are not used to calculate a
gain. Raccoon captures contain 1,199 / 1,200 draws; pinniped captures contain
699 / 696. Native elapsed spans are retained. The six contact fits run every
measured frame. No throughput or physical-phone improvement is claimed.

Pinniped camera matrices match exactly. The raccoon camera's maximum Float64
difference is 1.78e-15; its Float32 matrices and projection match exactly.
Camera matrices remain constant inside each window. Source, quality settings,
backend and GPU-memory controls are retained in `data/NATIVE-COMPARISON-v1.json.gz`.

## Actual delivery and remaining work

The candidate uses exclusive port 4184, PID 7108, against frozen d366 on 4178,
PID 28544. GPU readback from all seven actual beauty draws has zero uploaded
bone-matrix error; callbacks and GL state restore correctly. Native Chromium
2K and modern WebKit 390 px public Noon/Evening raccoon, sea-lion and seal
views are nonblank and free of runtime errors. WebKit here is a PC functional
check, not a physical iPhone benchmark.

The numeric-only attempt is retained with its exact dense qualification; it
was superseded before an isolated native timing run. The combined query-cache
attempt is retained with its raccoon fit/frame no-win. Next, profile the
remaining hot paths before another allocation, bound or transform attempt.
The coordinator owns final integration, cache-busting URLs, final-terrain
resurvey and release checks. This worker writes no wildlife/controller code,
native products, manifest or light cache and performs no push.

The producers are gzip archives of the measured source, including their
original PC paths. Decompress and adapt paths deliberately when replaying
elsewhere. The existing isolated worktree commands are:

```powershell
node --no-warnings --test test/wildlife-ground-bounds.test.mjs
node --no-warnings .jekyll-cache/visual-qa/contact-cpu-20261101/raccoon-dense-proof.mjs
node --no-warnings .jekyll-cache/visual-qa/contact-cpu-20261101/pinniped-temporal-proof.mjs
$env:BENCH_VIEW='pinniped'; $env:BENCH_LABEL='candidate'
node .jekyll-cache/visual-qa/contact-cpu-20261101/native-benchmark.cjs
```

Timing requires a coordinated quiet window. `MANIFEST.json` binds every packet
payload; `PAYLOAD_ORIGINALS.json` binds all decompressed archive bytes.
