# Study daylight and bounded diffuse transport, November 3

The daytime study/library was too dark even though its probes were valid. This
checkpoint adds second and third diffuse surfaces to the existing sky/ground
transport and separate room-camera exposure, capped at1.8×. Practical transport
remains exactly the previous single-bounce result. Turning toward a lamp does
not change the exposure target. The native models, sun/moon/atmosphere, practical
powers, texture/shader budget and quality tiers are unchanged.

## Accepted local evidence

- [The official owning bake](controls/daylight-bake-v5/PROCESS.json.gz) writes
  cache `c6bca92a…`,712,544 bytes/186,913gzip. Independent
  [readback](controls/sky-bake-v5-comparison.json.gz) proves all61model inputs,
  probe positions/validity, moments and all28practical bases exact. The complete
  pre-ROI count stays731,761, below the unchanged750,000limit. No triangle
  striding or field-budget increase is admitted.
- [Full production build](validation/BUILD-GATES.json.gz),
  [420Python/1,047Node cases](validation/UNIT-GATES.json.gz), and the style
  contract pass; seven pre-existing Node skips remain. [Three native GPU cases](validation/TARGETED-VISUAL.json.gz)
  pass: exact linear diffuse/ownership/zero-ray relighting, the first complete
  cached view, and the stalled-cache fallback. Existing scene cases are extended;
  no new roster entry is needed.
- `before-study-2k` and `study-2k` retain matched date, authored cameras and
  output sizes. `study-4k` has an actual3840×2160drawing buffer on the RTX3080Ti.
  `study-phone-webkit` renders complete day/night/turned views with modern
  WebKit. These are appearance and functional results, not physical-phone or
  steady-frame performance measurements.
- `room-tour` retains the twelve actual public Rooms/fullscreen/day/night views
  used for critique. The original run's final network assertion failed on
  Chromium's two streamed-model abort reports; that exit remains failed.
  The matched study producer independently clones and hashes all three streamed
  resources while returning their original responses untouched, and requires
  actual parsed/restored consumption before qualifying a protocol body loss.
  All three final study runs pass. The tour is visual review evidence, not a
  falsely relabeled zero-network-error run.
- `sunset` retains seven genuine November3LaJolla sky/sea states on one fixed
  offshore camera, from35minutes before modeled sunset to35minutes after.
  The actual sun descends below the horizon and the sky/sea move from gold to
  red/violet dusk. The authoring-clock input and offshore camera are disclosed
  fixtures; no atmosphere palette or model response is substituted. This checks
  the existing astronomy/atmosphere rather than claiming newly implemented
  solar physics or a seated interior view.

## Rejected controls and remaining work

The all-source deeper-lamp candidate exceeds the unchanged4MiBfirst-scene
transfer gate. Its failed run remains in `rejected`. The selected environment-only
path passes that gate without changing lamp coefficients. The angular solar
grid fails held-out aperture accuracy and its834,743-byte deflated basis alone
exceeds the entire cache budget. Lossless packing trials do not rescue it.
`research` preserves those exact producers, results and candidate modules. No
SOTA speedup or general research superiority is claimed.

The first deeper-path GPU fixture also catches sky leaking into a closed thin
shell. A normal-only origin still fails; checking neighboring walls below the
old1mmnear interval fixes it. The new CPU regression reproduces the old failure,
and the original GPU/closed-room assertions now pass unchanged. The red controls
remain retained. Earlier capture-producer scope and hidden-clock failures are
retained separately from product failures.

The public bedroom view is still too dominated by its bedside lamp in daytime.
Its orbit camera sits outside the finite sleep cage, so camera-only adaptation
does not help that view. Metering the actual room subject, with continuous
coverage and unchanged weak moon/source energy, is the next bounded hypothesis.
Whole-house ambience, cliff/entrance/garden integration, the optional breakfast
venue and final physical-iPhone comparison stay open. Cache-miss baking is more
expensive; the cache-hit field still traces no visitor rays and releases its BVH.

This packet establishes local implementation/visual evidence. Publication must
be checked independently after the checkpoint is pushed. Exact machine payloads
are losslessly gzipped; `MANIFEST.json` binds both compressed and original bytes.
Copied producers retain original QA paths and require fresh source bindings
when replayed elsewhere. Nothing in an older packet is rewritten.
