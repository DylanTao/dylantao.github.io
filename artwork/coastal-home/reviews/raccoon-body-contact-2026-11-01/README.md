# Curled raccoon contact, with planted paws

Source `d36672bda0b3ee557989853f51665b1893da398a` repairs the curled raccoon's
buried torso and forearms. It measures the delivered torso skin, lifts only
`BodyPose` before leg IK, and folds the tucked forearms beside the chest. The
root route and all four paw transforms stay fixed. Native models, manifest,
light cache, controller, animal counts and update cadence are unchanged.

The native sleeping witness at 18.8007 s was `Raccoon_skin_1` vertex 4012
(`Hips`), 48.575497 mm below sandstone triangle 22872. The den survey reaches
48.874005 mm burial. The accepted fit uses all 3,052 delivered torso/head points
and 6,052 faces, with 0.65 mm clearance and an 80 mm correction bound. It
refuses missing or invisible support. Its `supportResolved` field describes
that subset; it explicitly does not assert whole-skin coverage.

The first trunk-only attempt left lower-foreleg vertex 1642 buried by
13.914479 mm and was rejected. The accepted forearm bend changes the IK pole
continuously as the animal curls; it does not change paw targets or segment
lengths. Actual knee endpoints remain connected within 1e-12 m, and the old
1.045 stretch bound holds. The tail is fitted by its existing contact method.

## Geometry and motion evidence

- The 893 dense poses cover Noon, Evening, waking, foraging, and returning to
  the den. They test 6,272,432 actual skin vertices.
- Another 463 poses surround 31 measured or authored transition events. All
  3,252,112 vertices match the independent trajectory hashes exactly. Actual
  draw catch-up is checked against complete forced poses.
- Both sets have zero missing upward projections. All 13,864 skin triangles
  are also checked against 1,239 classified solid terrain triangles in the
  route bounds plus 3 m, including side and underside faces. No penetrating
  finite-face crossing was found. The closed-triangle SAT records paw
  tangencies explicitly; it does not claim zero intersections. Every recorded
  contact belongs to a planted paw, with minimum signed-plane error above
  -6.79e-15 m. Vertical faces remain explicit in the projected method and are
  included in the independent all-face SAT audit.
- The original breathing code switched waves at half sleep. The baseline and
  first candidate shared a 2.210887 mm snap at dawn, 99.0714007323 s, and a
  0.263631 mm snap at wake, 2.2 s. Continuous blends retain both endpoint waves
  and remove those switches. The final event set's largest motion over 20 µs
  is 0.011337 mm; its largest one-sided velocity difference is 0.001710 m/s.
- An additional 2,424 numeric 30/60 Hz frame intervals retain 2,436 complete
  skin hashes. Larger existing shake and walk changes while curl is zero are
  baseline-identical and remain outside this physical repair. The finite
  surveys are not proofs for every possible time or terrain.

All four paw matrices and the other 27 animals' skeletons match the baseline
exactly in the 893 matched poses. All 2,166 accepted pinniped skin poses
(10,258,176 vertices), roots, contact results and missing-projection records
also match the sealed `b6b2946296f23c8d3e78b281d4914552205f1b1b` result.

## Actual browser delivery

The candidate uses exclusive port 4178, PID 30528, with the complete frozen
4158 site through sealed 4173 and three explicit module overrides. All 29
complete response bodies are saved and hashed. The final GPU readback observes
the real raccoon beauty draw: every uploaded bone matrix matches the CPU
Float32 matrix exactly; callbacks and GL state are restored.

Public theme controls, N inspection and orbit keys produce nonblank 2K native
Chromium and 390 px modern WebKit Noon/Evening captures without runtime errors.
The recorded pitch identifies the overhead and low side views. These use
native Date, performance and RAF; no Playwright clock API is called. WebKit is
a PC browser check, not a physical iPhone result.

The public baseline's neighbor module is minified. Its raccoon motion and
habitat-route results match the b6 Git source exactly at 108,003 sampled
time/palette combinations. This checks the relevant baseline behavior without
claiming textual equality or equivalence of every dependency.

## Measured CPU cost

One quiet native Chromium pair uses the same frozen scene, public Noon, high
quality, fixed 2560×1440 buffer, authoring camera and active-time window
30–50 s. All actual camera world/projection matrices match exactly. Passive
timers wrap the actual pose and body-fit calls, including draw catch-up; the
executed and pristine source bodies are retained separately. The baseline's
neighbor response is explicitly replaced with its b6 source for this pair.

| Cost                                 | Baseline median / P95 | Candidate median / P95 |
| ------------------------------------ | --------------------- | ---------------------- |
| Curled-body fit per drawn frame      | absent                | 3.2 / 4.9 ms           |
| Complete raccoon pose                | 0.8 / 1.4 ms          | 4.2 / 6.1 ms           |
| Actual primary beauty-frame interval | 16.7 / 16.7 ms        | 16.7 / 16.8 ms         |

The RTX 3080 Ti pair records 1,198 versus 1,191 frames. The added CPU expense
is substantial even though the frame medians are unchanged in this view.
This is one isolated PC measurement, not a general performance improvement or
a phone benchmark. CPU optimization remains a separate checkpoint.

## Inputs, checks and remaining work

The ten model files match the referenced b6 Git blobs byte for byte. Exact
public-scene JSON, source bodies and input hashes are retained. The previously
qualified sea-lion 0 point is identical in both variants. This worker makes no
native product, manifest or cache changes; the coordinator must repeat the
animal survey against the final combined F6 terrain and run release gates.

The wildlife suite passes 67/67 tests; the four new focused tests and targeted
Prettier check pass. The original native producer commands run from the
isolated `identity-footer` worktree, with frozen inputs under
`.jekyll-cache/visual-qa/animal-readonly-20261031/inputs`:

```powershell
node --no-warnings --test test/wildlife-raccoon-contact.test.mjs
node --no-warnings .jekyll-cache/visual-qa/raccoon-body-20261101/raccoon-native-proof.mjs
node --no-warnings .jekyll-cache/visual-qa/raccoon-body-20261101/raccoon-full-terrain.mjs --fail-fast
node --no-warnings .jekyll-cache/visual-qa/raccoon-body-20261101/raccoon-temporal.mjs
```

The retained producers are gzip archives of the original source bytes. They
include their original absolute PC paths; decompress and adapt those
deliberately when replaying elsewhere. `inputs/INPUT-BLOB-CUSTODY.json` names
the model blobs, and the JSON inputs are retained directly. Browser producers
require the complete retained preview, not a page with assets omitted.
`MANIFEST.json` and `PAYLOAD_ORIGINALS.json` bind packet bytes and decompressed
payloads. Failed trunk-only and pre-blend attempts stay under `attempts/`.

Next: reduce actual contact CPU expense without changing sample coverage,
cadence, physical tolerances or motion. Separately review the retained old
shake/walk motion witnesses. This checkpoint closes the measured curled-body
burial; it does not close every animal, scene or website item.
