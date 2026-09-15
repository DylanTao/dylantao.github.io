# Coastal world finishing evidence

This continues the approved September 14 reference direction and the previous [coastal checkpoint](../coastal-refinement-2026-09-14/README.md). The delivered scene remains authored interactive 3D. Generated concepts are retained in `artwork/coastal-home/direction/` and `artwork/la-jolla/direction/`; their actual image metadata is documented in the corresponding provenance files. No new image-model claim is made in this finishing pass.

## Defects and corrections

| Visible defect                                                    | Correction and review                                                                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rear orbit exposed open ceiling edges and the room's back         | Closed Boolean mainland/roof solids, boundary verification, complete exterior roof, landward entry; nine actual orbit samples                           |
| Interior orbit could enter a wall                                 | Shared camera envelopes for every input and transition, terrain BVH height samples and near-plane wall clearance                                        |
| Kitchen lacked recognizable fitted equipment                      | Island and perimeter cabinets, espresso machine and grinder, double-door fridge and freezer, sink/hob/oven; room and matching Blender renders           |
| Refrigerator was hidden behind the print partition                | Moved to the visible end of the working counter while retaining the one-meter aisle                                                                     |
| Gym used one generic loop and occupied bench space                | Pull-ups, dips and dumbbell sets with approaches/rests; multi-grip bar, dip attachments and a parked bench                                              |
| Baked pull-up elbows changed direction between poses              | Stable authored elbow plane, denser compatible Euler keys, all five Blender pose studies; runtime contact correction handles small mixed-pose residuals |
| Dumbbell pickup was beyond arm reach                              | Adjusted the exported approach stance; measured pickup and return drift below 0.001 m                                                                   |
| Cup and weight could appear in the hand without leaving a surface | Move the same tagged authored mesh between its counter/rack and the wrist, including return phases                                                      |
| An old room cache restored a floating duvet block                 | Restore the current draped cloth in every section rebuild; inspect empty and occupied sleeping views                                                    |
| Transparent research images still sat on a white card             | Pixel-preserving edge masks plus transparent figure containers and restrained local dark-theme contrast                                                 |
| P stopped at travel corners and lacked secondary motion           | Continuous arc-length travel, clearance-checked curves, gaze-first departure, body banking, asymmetric fins and damped antennae                         |
| Miniature and footer repeated the same landmarks                  | Campus/Cove composition beside Connect; neighborhood, villas, courts and beach across the footer                                                        |
| Geisel/courts appeared unsupported; DIB had four bays             | Podium and buttresses, court foundation, five folded DIB bays and middle-bay third-floor office                                                         |
| Atlas corners and footer ground revealed their boundaries         | Irregular feathered atlas mask and terrain extended beyond both viewport edges                                                                          |
| Side rail sat too far left; return control moved near the footer  | Narrower rail gap and stable safe-area bottom corner, with keyboard and hidden-state checks                                                             |

## Evidence locations

- `artwork/coastal-home/reviews/`: actual Blender neutral-clay/material exterior and cutaway views using manifest cameras; five seated, reaching, pull-up and dip studies; wildlife masters; baked-light and optimized-export reports.
- `artwork/coastal-home/portraits/`: front, profile, three-quarter and full-body studies of all five variants.
- `.jekyll-cache/visual-qa/coastal-finish-day-{1440,1280,768,390}/`: actual browser exterior, overview, every room and all five study avatars. Heights are 1000, 800, 1024 and 1000 respectively.
- `.jekyll-cache/visual-qa/coastal-finish-night-1440/`: the same rooms with the authored night routine and evening lighting.
- `.jekyll-cache/visual-qa/coastal-finish-motion/`: full exterior orbit and moving pull-up/dip/coffee contact samples, generated by `bin/capture_coastal_finish.cjs`.
- `.jekyll-cache/visual-qa/coastal-finish-transfers/`: actual pickup, carrying, use and return of the cup and dumbbell, including owner/position/grip evidence.
- `.jekyll-cache/visual-qa/checkpoint/` and `test-results/public-visual-{site,scene}/`: responsive route, theme, keyboard/touch, motion, recovery and fallback captures. The wide navigation case uses 1920 pixels.
- `artwork/research-figures/mask-provenance.json`: original hashes, alpha counts and exact RGB preservation. Original downloads remain linked.

Selected final browser captures and the measured asset report are retained beside this document. Earlier cache-only captures called `coastal-finish-baseline` and `coastal-finish-camera` lacked the generated stylesheet and are rejected evidence.

## Verification and limits

The native Windows production build uses Ruby 3.3.12, the locked gems, Jekyll and ImageMagick. Docker Desktop could not start because of a stale inference socket. Automatic approval review rejected stopping Docker and removing that socket, so the repair was abandoned. A local server serves the actual production output at `http://localhost:8080/`; it also exposes current authored assets during review. Gems live outside the Jekyll source tree so upstream assets are not accidentally excluded. The preview server uses persistent connections and a sufficient request queue for module-loading bursts.

Python asset/content checks, JavaScript state/contact tests, Prettier, the style contract, a production build and the local override audit are part of this checkpoint. The override audit acknowledges the changed scripts include; unrelated Windows line-ending/upstream-baseline advisories are retained instead of accepting all overrides. Scholar's September 14 snapshot satisfies the publish gate; this pass does not change publication data.

The final local checkpoint passed 163 Python checks and 23 JavaScript checks. The full public-site run passed 184 cases, with 92 intentional viewport-specific skips; four remaining cases used an obsolete magnifier-link selector after the original-download link was added. After scoping that selector to its figure, all four reruns passed. The affected-route checkpoint passed all 20 cases across four viewports and light/dark themes. The separate scene run passed 112 cases with 28 intentional skips, including the 1920-pixel rail/corner check, full orbit and interior limits, touch, graphics failure, offscreen pause, reduced motion, and all four footer themes.

The Chromium/WebKit legacy pass uses the same published-route grep as `.github/workflows/visual-regression.yml`. The unscoped legacy command also visits the retired `/blog/2021/distill/` starter fixture, which is not a published page; that attempt was stopped and is not acceptance evidence. No fixture content was added to the website to make that command pass. The new camera/contact unit tests are included in the existing CI contract check.

The applicable Chromium/WebKit run passed 25 cases with three intentional engine-specific skips. Final formatting (native line endings), style, unit and diff checks passed. Local runtime errors were empty in the retained scene, motion and route captures. Publishing and deployed-asset verification use the resulting source commit rather than an HTTP status alone.

The final moving-pose review recorded nine exterior samples and pull-up contacts for all five avatars. Maximum sampled wrist/contact drift was 0.0000042 m; this is a numerical joint measurement, not a claim about whole-hand anatomy. Cup and dumbbell ownership tests also verified pickup and return. The two La Jolla scenes, atlas, posters and manifest total 1,951,589 bytes. The largest gzip-compressed first home selection under the existing asset check is 3,278,702 bytes, below its 4 MiB limit. The retained report lists individual GLBs separately; the complete five-avatar library is not an initial download.

The browser world remains stylized. The approved film reference has richer close-up surfacing and environmental detail; these assets are not described as film-production quality. Camera collision uses sampled terrain and authored wall proxies, not arbitrary mesh navigation. Contact checks cover the authored poses and routes, not unrestricted whole-body physics. Mobile evidence is desktop browser emulation, not a physical-phone benchmark. The four theme activities and DIB window pattern are personal vignettes, not live occupancy.
