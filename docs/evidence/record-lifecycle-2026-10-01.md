# Record and room recovery checkpoint — October 1, 2026

This local checkpoint fixes measured interaction defects in the existing realistic room and on-disc player. It preserves the minimal public controls, approved B1 margin photo and shared credit, and the workshop paper's archive-only placement. Pending layout concepts remain private. Nothing was pushed or published.

## Findings and changes

- **Skip, then pause before the needle clears.** Pausing 50 ms after a skip cleared the queued texture and transferred artwork below the 0.44 clearance threshold. The DOM fallback also changed immediately, ahead of the simulated transfer. The latest selection now remains queued through pause and repeated selection until the needle clears. Both WebGL and DOM fallback artwork follow that transfer.
- **Hidden 2D work during 3D playback.** Activating a room record restarted the hidden 2D renderer: the baseline recorded 33 draw calls and an angle change from 3.546 to 4.878 radians over 700 ms. Record selection now respects the current view. Returning to 2D resumes its renderer.
- **Invisible source link in keyboard order.** The 2D artwork source accepted focus while its parent was transparent in 3D. The player is now inert in 3D, with an explicit hidden-caption rule. Returning to 2D restores the source link.
- **A persisted return during the initial room load.** The lifecycle handler aborted pending model requests even when the page was retained. The controller now preserves those requests on a persisted pagehide. Genuine teardown still aborts them and releases the canvas; late async callbacks do not report a false graphics failure.

## Evidence

Artifacts stay under `.jekyll-cache/visual-qa/` so capture output does not trigger Jekyll rebuilds. Paths are relative to the repository root.

| Evidence                                                                  | Artifact                                                                                                                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comparable fallback before/after at pause, before needle clearance        | `heartbeat-record-interruptions/before/unavailable-pause-before-clearance.png` and `heartbeat-record-interruptions/after/unavailable-pause-before-clearance.png` |
| Native and fallback pose, queue, actual DOM artwork, and console evidence | `heartbeat-record-interruptions/{before,after,production}/evidence.json`                                                                                         |
| Successful occupied-room return, desktop and phone                        | `heartbeat-record-lifecycle/desk-scene-coastal-home-an-72b2e-survives-a-persisted-return-{desktop-1440,mobile-390}/initial-load-cached-return.png`               |
| Completed paused cue, desktop and phone                                   | `heartbeat-record-lifecycle/desk-scene-record-physics--a0646-ork-until-the-needle-clears-{desktop-1440,mobile-390}/pause-cue-native.png`                         |
| Hidden 2D caption while operating the room                                | `heartbeat-record-lifecycle/desk-scene-coastal-home-al-f949f-haring-and-paper-navigation-{desktop-1440,mobile-390}/record-caption-hidden-in-3d.png`              |
| Home light/dark responsive captures                                       | `heartbeat-home-checkpoint/`                                                                                                                                     |
| WebKit/iPhone record evidence                                             | `heartbeat-record-webkit/`                                                                                                                                       |
| Production asset/build inspection                                         | `heartbeat-record-production-evidence.json` and `.jekyll-cache/heartbeat-record-production.log`                                                                  |

The actual minified production `home.js` was substituted into the same public component for an additional native/fallback cue probe. It retained the old artwork through pause, then transferred above clearance: native lift **0.4502**, fallback lift **0.4441**, with no runtime errors. This is a production-bundle interaction check, not a full production baseurl browser matrix. The `/al-folio` build and generated asset references were inspected separately. Controller source and built output match after normalizing line endings; `home.js` intentionally differs because Jekyll minifies it.

The persisted-return probes dispatch synthetic `pagehide` and `pageshow` events while a model response is delayed. They verify the controller's event behavior, original avatar/record state, and nonblank render. They do **not** establish that the browser actually placed this page in BFCache. Separate teardown probes during room and avatar loads verify cancellation without a late failure event.

## Verification

- Scoped Chromium desktop and phone interaction cases: **21 passed, 1 intentional desktop skip**.
- Scoped WebKit/iPhone record cases: **4 passed**.
- Home checkpoint at 1440×1000, 1280×800, 768×1024 and 390×1000: **4 passed**, each covering light and dark.
- Worker mesh/decoder failure and retry cases: **2 passed**.
- Python suite: **166 passed**. Pure coastal-physics Node tests: **8 passed**.
- Style contract, changed-file Prettier, syntax and diff checks passed.
- Production Jekyll build with `/al-folio`: passed in **200.852 seconds**.
- Override audit reports the existing **80 overrides**; this checkpoint adds none.

The scene is still an interactive WebGL approximation. This recovery work adds no new claim about photorealism or research-grade physical accuracy.
