# Complete-world temporal-change census

This is a source-bound readback experiment for a future static-surface cache.
It changes no renderer, asset, light, clock or quality setting beyond the
recorded public controls. It is not a runtime reuse predictor, saved-work
measurement, HiPR reproduction or SOTA result.

The frozen complete product is the ambience checkpoint declared at
`d9e7cc17283b66f4e5b6466daddc1817fc1114e4`, served by
`house-ambience-20261102-36472`. All 211 observed module/model/JSON responses
match the frozen product bytes. The native backend is RTX 3080 Ti via ANGLE
D3D11. Every capture has an actual 2560×1440 drawing buffer, high tier, requested
MSAA 2 and all ten rooms loaded. Date, performance and RAF stay native. Ghibli,
Work/Workout, Rooms, fullscreen, Pause and drag use actual UI actions.

Four moving screenshots, a paused repeat and a dragged view are retained for
each room. Their exact PNG hashes, actual acquisition times, animation seconds,
camera vectors, renderer/quality state and source bindings are in the compressed
result. Screenshot/readback cost is included in the real 2.4–4.6-second gaps;
these are not display-frame intervals or FPS measurements.

| View         | Exact changed 32 px tile capacity, three intervals | Paused changed pixels | Actual drag changed pixels |
| ------------ | -------------------------------------------------- | --------------------: | -------------------------: |
| Study, Work  | 52.78%, 2.31%, 2.36%                               |                     0 |                  3,684,637 |
| Gym, Workout | 93.25%, 93.67%, 93.92%                             |                     0 |                  3,647,630 |
| Coast, Work  | 19.28%, 40.67%, 33.44%                             |                     0 |                  3,677,732 |

The gym camera moves 24–32 micrometers between moving observations. Its 2/255
diagnostic tile fractions are 48.08–50.97%; exact differences remain the gate.
The study's first 52.78% interval is retained. No settling, shading or camera
cause is inferred from a final-image difference alone.

The offline oracle copies target tiles into the preceding image and exactly
reconstructs every target. It tests accounting, alpha and partial edge tiles.
It has already rendered and read the target, so it cannot demonstrate avoided
work or discover visibility/lighting dependencies. Paused repeats and actual
drag provide controls against counting an unchanged or stuck canvas as a result.

The initial producer expected Boolean `true` from a fullscreen field whose
correct value was the string `native`. That harness control failed before any
measurement; its failure is retained. The corrected producer tests Boolean
presence while recording the original field. No runtime workaround was added.
The final three-view run has no console or request failures.

The next hypothesis and source literature are in
[the November research plan](../../../../docs/coastal-rendering-research-2026-11.md).
Prefer caching static surface evaluation with explicit invalidation to freezing
final RGB. Every unknown dynamic shadow, reflection, relighting, deformation or
camera dependency falls back. Keep the original renderer and full detail; prove
quality before reserving quiet native timing. The 21 PNGs retain the original
capture bytes. `MANIFEST.json` binds all packet payloads.
