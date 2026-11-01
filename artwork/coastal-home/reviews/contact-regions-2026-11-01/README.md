# Exact terrain-region reuse, November 1

Source: `dbb7cd848e6b9d69332fda1d2d2fcee8aa46b0d3`.
Baseline: published `321a8ebc946d20334bc6c49189640a6002fb8582`.
This worker checkpoint changes only `wildlife-ground-contact.mjs` and its focused
bounds tests. Integration, returning-browser versions, final terrain and release
checks remain coordinator-owned. No worker push occurred.

The paired PC comparison reduces median contact-fit cost by 2.2 ms across the
six resting pinnipeds and by 0.4 ms for the raccoon. Frame timing is unchanged.
Every checked physical pose and contact field remains exact.

## The bounded change

Node Inspector profiles sampled 600 actual delivered wildlife updates each at Noon
and Evening. In the Noon sample, `minimumSurfaceGap` accounts for 24.4% self cost,
`maximumHeightInBounds` 21.7%, point sampling 10.1% and skin transforms 7.3%.
Repeated region lookup and bound-plane work were the dominant target. These
concurrent samples select the attempt; they do not establish a speedup.

A captured region's first/last cell indices now form one collision-free numeric
pair when both corners are inside the captured grid and the grid's squared
index range is a safe integer. Outside or unsafe ranges retain the original
four-coordinate string key. Candidate triangle insertion/order and all point,
plane and finite-face calculations stay unchanged. The immutable plane tolerance
is calculated once with the identical operation order instead of at every
corner query. Capture still invalidates both region maps; visibility stays live.
No face, skin point, pose, update or animal is removed. No clearance, joint or
fallback gate is relaxed.

The focused tests compare ordinary numeric regions with unsafe-pair and
unsafe-cell fallback grids, including negative coordinates, grades, stacked
surfaces, exact finite-face results, live visibility and recapture. Separate
outside-row/column witnesses reject aliasing onto an occupied cell.

## Exact physical evidence

Fresh baseline/candidate recaptures compare all recorded fields, complete world
skin hashes, roots, bones, contacts and other-animal matrices:

- 2,166 pinniped and 893 raccoon dense poses, covering 16,530,608 vertex records.
- 1,007 pinniped events and 15,105 complete skin poses around the retained switch,
  roll, support-transfer and mode failures.
- 463 raccoon event poses and 2,436 numeric 30/60 Hz trajectory poses, including
  actual draw-catch-up controls.
- Seven actual uninstrumented native beauty-draw GPU readbacks: all six resting
  pinnipeds and the raccoon. Uploaded Float32 bone matrices match with error 0;
  actual samplers/programs, GL state and restored callbacks are recorded.

The current 321a dense census has 700/2,166 poses with 1,783 upward-projection
misses, maximum 7 in a pose. These remain explicit and identical between variants.
They are not complete skin coverage. Unchanged posed coordinates and unchanged
native triangles inherit the predecessor's full 3D separation result; this is
an identity argument, not a new independent all-face SAT run or all-time proof.
The older 729/1,806 census is not substituted for this measured baseline.

The new dense outputs are stored once where the two freshly captured byte
streams match. `DENSE-EQUALITY.json.gz` binds both original names, byte counts and
hashes. Event/trajectory results and retained event inputs that match predecessor
packets use lossless references in `REUSED-DATA.json.gz`. Where necessary, the
recipe changes only one top-level label literal. Reconstructed bytes must match
the current capture hash. Dense files that differ from historical packets remain
packaged here; no nontrivial payload difference is hidden by reuse. Predecessor
packets are unchanged.

## One paired native comparison

Both families use the full frozen 321a product: all 1,363 files and 180 module
receipts match the coordinator's immutable production copy, without omissions.
The module receipt SHA is
`663a4f75c2aa0a42248e936ed34c3cfb18f27b79ba939cd6260ba7438b415e93`.
The unchanged cache signature is
`f4d91be561003835bcf5c7c0eb819d2511131728d12cfe4bc451d86a856d38c5`.
Native/coast/model/manifest/cache bodies are qualified against this exact baseline.
The real owning Jekyll/Terser compiler produces the candidate helper. Only that
compiled helper and its module receipt differ in the served product.

The exclusive 4197 server, PID 14228, separates baseline/candidate through isolated
context fixture cookies and reports owner/variant headers. All 30 response bodies
are checked per run. Three private passive timing-wrapper bodies are byte-identical
between variants; the canonical wildlife/controller sources are unchanged.
Native Date/performance/RAF, public Noon, the same declared camera, actual
2560 x 1440 page viewport and GL drawing buffer, actual 2-sample MSAA, pinned high
quality and NVIDIA RTX 3080 Ti/D3D11 are checked. Renderer memory is identical at
801,297,818 bytes; that metric does not measure JS heap. No quality demotion occurs.
Every measured frame contains all six pinniped fits or the one raccoon fit.

The coordinator paused owned builds, captures, bakes and CPU audits. Run order
was pinniped baseline/candidate, then raccoon candidate/baseline. Each capture
measures active time 30-50 s. All measured frames fall within the coordinated
quiet interval; the final frame ended at 16:32:59 UTC and all browser processes
exited by 16:33:02 UTC. Full wall/monotonic bounds are retained.

| Median / P95 cost            | Published 321a | Region reuse   |
| ---------------------------- | -------------- | -------------- |
| Six-pinniped contact fits    | 15.4 / 20.6 ms | 13.2 / 17.0 ms |
| Six-pinniped complete poses  | 15.6 / 20.8 ms | 13.3 / 17.2 ms |
| Pinniped-view frame interval | 33.3 / 50.0 ms | 33.3 / 50.0 ms |
| Raccoon body fit             | 3.1 / 4.8 ms   | 2.7 / 4.2 ms   |
| Complete raccoon pose        | 4.0 / 5.9 ms   | 3.6 / 5.3 ms   |
| Raccoon-view frame interval  | 16.7 / 16.8 ms | 16.7 / 16.8 ms |

This is one paired comparison per family on this PC, with passive recorder
overhead in frame timing. It does not establish a general FPS or physical-phone
improvement. Earlier concurrent or differently sourced measurements are not
used to calculate these reductions.

## Camera qualification and the failed exact assertions

The original comparator incorrectly included pre-window warm-up draws. One
raccoon camera changed by 3.55e-15 before time 30. Within each actual 30-50 s
measurement window, every world and projection matrix is exactly constant.

Across variants, projection matrices match exactly. Camera world matrices differ
by at most 3.55e-15. The only differing Float32 world coefficient is a near-zero
term; exact Float32 bit equality therefore honestly fails. Using unchanged Three
matrix inversion, only one Float32 inverse-view coefficient differs, by at most
5.55e-17. The conservative real-linear projection bound over a deliberately
oversized +/-1,000,000 m world cube and the actual 0.05 m near plane is at most
0.00000233 pixels horizontally, zero vertically.

The coordinator accepted this explicit limit for the fit-cost comparison only.
Both failed exact assertions and the complete matrix diagnostics are retained.
This is neither a direct GPU camera-uniform readback nor a bit-identical raster
claim. It changes no physical or source gate. Every required body binding,
backend/buffer/quality condition and actual fit count matches.

## Append-only V1 correction

The predecessor contact-cpu review says 4x MSAA. Its actual
`rendering.msaaSamples` was 2 in both variants; `quality.settings.maxSamples=4`
was the cap. The previous paired costs remain matched, but the 4x wording is
incorrect. That sealed packet is not rewritten. This review reports actual
2-sample rendering separately from the configured cap.

## Functional appearance, failures and portability

Uninstrumented native 2K and modern WebKit 390 px public Noon/Evening views of
the raccoon, sea lion and seal are retained and directly inspected. The seven GPU
sampler probes pass without runtime errors. WebKit is PC emulation, not a physical
phone or its frame-rate evidence.

The first native public run collected one unknown-URL `ERR_CONNECTION_FAILED`
console error and is unqualified. Its original log, six-frame metadata and one
representative screenshot are packaged; the full original six images stay local.
The network-instrumented diagnostic completed all six nonblank native views with
the unchanged standard runtime collector at errors 0. Its additional blanket
empty-network assertion failed on the existing deterministic jsDelivr/SRI stubs
and one unassigned coast `ERR_ABORTED`. That cause is not invented. Actual coast
supports and the complete coast source body are independently present. A separate
saved-data receipt qualifies the original standard appearance/runtime criteria;
the failed blanket assertion is not rewritten as a passing command. Modern WebKit
uses the original criteria and exits 0 with all raw network events retained.
No product error filter or new scene asset omission was added.

Complete original trace/network event streams are packaged byte-exact.
`TRACE-ARCHIVES.json` binds the original 82 MB of full trace archives, whose
embedded resources and screencast frames stay local rather than being duplicated.
This packet is not a standalone complete Trace Viewer archive. Public PNGs,
source/readback receipts and the entire seed coverage are provided separately.

All 73 wildlife tests pass. Python's ordinary 328-case invocation failed 10
custody reads beyond Windows MAX_PATH under this longer worktree name; those files
exist via extended paths and match HEAD. Whole-extended discovery passes custody
but fails two unchanged asset tests using literal parent-directory paths. The
final normal discovery, with only the custody module's REVIEWS filesystem root
expressed as an extended absolute path, passes all 328 cases. Assertions and test
sources are unchanged. Both failed invocations and that exact workaround are
retained; the coordinator repeats ordinary discovery on the shorter main checkout.
Targeted formatting, style contract and whitespace gates pass.

Initial incomplete loader/vendor and retained-event input copies also failed;
completed copies pass all numerical checks. No failed source/shape experiment is
represented as an accepted physical result.

## Integration and next gate

The worker changes no controller, home.js, import version, native model, canonical
manifest/cache, gym or desk-scene test. The coordinator must version the returning
browser import chain and preserve its current gym/navigation work. JS heap cost
was not measured; only the renderer-memory estimate is compared.

Final terrain will change later. Its rebuilt source/model/cache combination
requires a new contact, route, full-skin/terrain-face and performance gate. This
321a result cannot stand in for that integration. No independent push occurred.
The 4195 gym checkpoint and all predecessor evidence remain frozen.

`MANIFEST.json` hashes every payload except itself. Generated text and numeric
payloads are gzip original bytes. Human metadata is formatted before sealing.
