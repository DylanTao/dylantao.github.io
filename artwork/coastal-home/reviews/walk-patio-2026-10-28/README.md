# Actual visitor routes between the study, terrace and covered dining area

Sirui reported that walking felt awkward and the study could not reach the patio. The earlier door test covered only the short crossing on either side of a staged leaf. It did not establish the complete connection to outdoor living.

The full keyboard audit found three concrete misses:

- The current tall study/library no longer carried the old per-room `floorBounds`. The room classifier therefore called its sea-facing indoor approach “outside.” The runtime now uses the retained actual native footprint and distinguishes the desk and reading stations on that shared floor.
- Two orphan seat/back islands of an old bistro chair remained in the promenade, after its other parts were removed. They stopped the body around world X=-3.54, Z=2.55. Their removal preserves the genuine fire bench.
- The historical patio-route endpoint had become the laundry bay. Continuing toward the actual covered kitchen stopped at Z=1.64: the rear cabinet closed the approach. The coherent native correction caps the counter/base at X=5.25, replaces its first two cabinet fronts and pulls with one complete front, and keeps the grill, sink and dining furniture fixed. The metadata now reaches the cook aisle and the usable table approach.

The coordinator owns those native changes in `bin/refresh_coastal_walk_flow.py`. This worker changes the room classifier and acceptance tests; it adds no collision exception, teleport across a threshold or invisible shortcut. The existing 1.5 m east pivot is accessible and remains in place. The staged eye-level images show it from the actual desk and its approach; those two images are appearance inspection, not journey proof.

## Evidence and scope

- The retained baseline keyboard walkthrough reaches the study from the pavilion but cannot complete the patio connection. Both the delivered native solver and real browser inputs reproduce each obstruction independently.
- The chair-only 171.68 m loop is explicitly partial: it still ends at the obsolete service-bay destination. It is retained to explain the second discovery, not relabeled as finished outdoor living.
- The coherent pre-AO native candidate completes a fully unstaged 194.08 m keyboard loop over 66 waypoints: pavilion, living, study, covered dining, study, living, covered dining and back to the pavilion. Its native-rendered table view is retained separately.
- The canonical export after the selective pavilion AO bake passes all five native walking cases, including the full 22.5 m study-to-table path in both directions, real floor/headroom support and bidirectional movement of a 1.2 m diameter body through the promenade and pavilion entry. The 31 focused runtime/door checks pass.
- The new browser regression permits one supported initial desk fixture. Every subsequent turn, crossing and return uses ordinary inputs. Its JSON records the complete path and rejects any later placement call. A pixel gate also rejects controls over an empty canvas.

| Final browser evidence                              | Full input journey      | Rendered state                                 |
| --------------------------------------------------- | ----------------------- | ---------------------------------------------- |
| Canonical AO export, Chromium / RTX 3080 Ti / D3D11 | 99.915 m; 41 waypoints  | 1440 x 1000; actual geometry visible           |
| Official-cache build, Windows WebKit 27.2/v2380     | 100.077 m; 41 waypoints | 390 x 1000 final view; strict pixel gates pass |
| Official-cache build, pinned Linux WebKit 26.0      | 99.782 m; 41 waypoints  | 390 x 1000 final view; strict pixel gates pass |

Both WebKit cases disclose a 480 x 320 functional walking viewport and restore 390 x 1000 before the final capture. Both complete the same full route, retain zero subsequent placement calls and report no actionable browser errors. Their durations are software-fixture costs, not device benchmarks. WebKit reports “Apple GPU” in these PC/container runs; that string does not establish physical device hardware.

The retained captures use October 28 at 13:00 Pacific. The coordinator subsequently pins the final CI case to the past dry October 23 at the same weekday routine hour, as the weather-fixture contract requires. Existing captures are not silently redated. The native geometry and route are unchanged by that fixture correction.

These are circulation and rendered-visibility checks. They do not certify engineering, physical-iPhone performance, the cliff's aesthetic acceptance or completion of the broader scene checklist. Early candidate previews retained all production assets and compiled modules while omitting the stale light-cache descriptor. The final WebKit cases instead use the complete compiled production build with official cache signature `5251671b73123ad948736e5235dfef440004516270ca4b5e03a044242e140ae9`, without HTTP model/module/route overrides. [The readback](official-asset-readback.json) independently binds its manifest, model, light cache and compiled walking module. Release and deployed qualification remain in the coordinator's receipt.

## Windows WebKit resize control

Pinned Windows WebKit can report a successful walk while its composited screenshots have lost the canvas after a drawing-buffer resize. The independent `webkit-resize-repro.cjs` reproduces this without site assets, Three.js, fake clocks or a popover: GPU readback remains red while the screenshot becomes white. CSS-only resizing and unchanged-buffer reparenting remain visible. This matches [Playwright issue 42885](https://github.com/microsoft/playwright/issues/42885) and the [upstream Windows WebKit fix](https://github.com/WebKit/WebKit/pull/75957).

The isolated QA installation of Playwright `1.65.0-alpha-2026-10-28`, WebKit 27.2/v2380, presents all six resize controls correctly. No production portal, renderer workaround or repository dependency update was made. The old browser is retained as a negative control; functional solver progress alone is not visual acceptance. A physical iPhone remains a separate device check.

The pinned Linux case initially completed its route but captured an empty surface immediately after the final resize. Completing a second actual draw before the still resolves that presentation delay; the same complete scene and strict pixel threshold remain. The official-cache Linux rerun passes both visible-patio and full-size return gates. The persistent Windows-port resize defect remains independently reproducible and is not hidden by that settling step.

## October 29 CI circulation budget

The visual run on `09a26c9a6` passed 40 jobs but failed desktop `scene-journey`: its three earlier cases passed, then the new visitor case exhausted its twenty-minute software budget. The retained trace completes study to covered dining and back, then continues into the lower corridor, reaching 55.4246 m. It reports one earlier blocked sample, not a sustained collision stall. Cleanup then attempted to inspect an already closed page and obscured the original timeout. [The source-bound failure receipt](ci-2026-10-29/failure-receipt.json), raw compressed protocol traces and screenshots preserve that failure.

The full visitor case now owns one desktop `scene-circulation` CI shard, separate from the long pavilion journey. Its software budget is 45 minutes, while its native budget remains six minutes. Every route point, actual asset, capsule, keyboard input, 10 Hz functional cadence and pixel gate remains. Waypoint JSON is written as the visitor progresses, so a timeout preserves its last real pose without a browser call during teardown. The actual registry still covers all 134 cases at each standard width, with no missing, duplicated or extra case.

The corrected harness passes the complete native RTX 3080 Ti route in 1.7 minutes. Its isolated pinned Linux/Mesa run also passes: 100.041 m over all 41 waypoints, with visible patio and restored full-size return captures, in 14.7 minutes of test execution. These are functional circulation checks, not software-renderer performance targets or a claim that the failed original CI run was green. The subsequent CI result is recorded separately.
