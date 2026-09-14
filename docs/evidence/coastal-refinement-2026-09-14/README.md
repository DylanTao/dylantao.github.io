# Coastal world and reading refinement — September 14, 2026

This checkpoint implements Sirui's approved coastal-world, La Jolla, reading-layout, and P plan. Browser screenshots below are actual rendered output. The generated concepts are a higher art-direction target; the delivered world remains a stylized browser scene, with a visible gap from animated-film character and environment quality.

## Reference → Blender → browser

- Generated [architecture and interior study](../../../artwork/coastal-home/direction/architecture.png), [character and wildlife study](../../../artwork/coastal-home/direction/character-wildlife.png), and coordinated [La Jolla views](../../../artwork/la-jolla/direction/). The retained C2PA metadata reports **gpt-image version 2.0**, not Images 2.5. [Exact metadata and hashes](../../../artwork/coastal-home/direction/provenance.json).
- Actual Blender [exterior clay](../../../artwork/coastal-home/reviews/exterior-clay.png), [cutaway clay](../../../artwork/coastal-home/reviews/section-clay.png), [material review](../../../artwork/coastal-home/reviews/section.png), [seated character review](../../../artwork/coastal-home/reviews/ghibli-seated.png), and [wildlife masters](../../../artwork/coastal-home/reviews/wildlife-masters.png). The five masters also have front, profile, three-quarter, full-body, and seated renders in the source folders.
- Actual [daytime exterior](home-day-1440-outside.png), [nighttime exterior](home-night-1440-outside.png), [cutaway](home-day-1440-overview.png), [night cutaway](home-night-1440-overview.png), and [occupied sleeping contact](home-occupied-sleep.png). Room captures use manifest cameras; the Blender camera reviews use their corresponding target and lens. Blender review renders do not include the browser's dynamic water, P, or activity system.
- Editable `.blend` sources, original GLBs, authoring scripts, and licenses remain in the repository. Blender 4.5.9 was used through Python, not native-app mouse automation.

Local Hunyuan3D-2mv reconstruction completed on the RTX 3080 Ti in 301.88 seconds with 30 steps, octree resolution 256, seed 20260914, and model revision `3a761b539b29fe4ff64714813aa9560fd66f5de0`. Its [raw mesh, clay render, and attempt record](../../../artwork/la-jolla/reconstruction/) are retained. The 563,412-face output was a softened shape study. The shipped architecture was finished by authoring the landmarks in Blender; it is not presented as an accurate automatic reconstruction.

## Corrected visible and functional defects

| Finding                                               | Correction and evidence                                                                                                                                                                                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repeated cliff bands and thin beach                   | Unequal headlands, shelves, inclined channels, uneven ridge, a sloping berm, wet sand, haul-outs, and tidal basins. Compare the exterior pair below.                                                                                                                 |
| Disconnected excavation and central stair obstruction | Full-depth carved opening, substantial returns, two floors, landward stair and landing. The lower gym keeps its rack, bench, and dumbbells.                                                                                                                          |
| Plant mats intersected the cliff                      | Upward-facing groundcover and BVH raycasts against the actual carved mesh for planting, habitat paths, and perches.                                                                                                                                                  |
| Trouser weighting and rigid sleeves                   | Corrected seated leg skinning; eight-ring shoulder/cuff blends, fitted glasses, revised hair, and typing hands. Five actual browser avatar captures are linked below.                                                                                                |
| Floating duvet and misplaced sleeping head            | Draped cloth hem against the mattress; sleeping actor aligned with the pillow, with the same contact saved in the manifest and Blender anchor.                                                                                                                       |
| Ocean hotspot stole paper clicks                      | Visible paper/record hits now take priority over the invisible ocean fallback. Actual pointer and touch activation passes in Chromium and WebKit.                                                                                                                    |
| Footer still had a bottom band                        | Selected the customized non-fixed footer branch, removed its mask, and checked the actual bottom edge rather than width alone.                                                                                                                                       |
| P remained asleep or could not demonstrate a squeeze  | Old nap storage is cleared, rests expire, journeys begin automatically, and invited travel first seeks reachable local space. The narrow-screen encounter passed three consecutive checks after a fresh served-source verification.                                  |
| Article layouts alternated and cramped nested rows    | One approximately 68-character column, aligned headings/resources/end navigation, stacked story beats, outside desktop contents navigation, and Inter's five primary roles.                                                                                          |
| Production purge dropped module-created effects       | Included `.mjs` source in PurgeCSS content. Lens, previews, comparison, P, and reading checks also passed against the purged production build.                                                                                                                       |
| Decoder corrupted in an archived checkout             | The vendor-wide text rule normalized 21 bytes in `draco_decoder.wasm`. A specific binary attribute now preserves the original upstream SHA-256 `a680d927bed9cb864ddbd63521868891af2bfbe755092761b4837487618df8ac`; staged and working bytes were verified identical. |

## Comparable viewport evidence

Baseline application source is `bb56e6af5c8963f1a117dee1a46da924faa1bd52`. The replay restores only the byte-identical upstream decoder described above so that it represents the previously working local 3D view. It does not change the baseline geometry, CSS, or application behavior. Earlier captures with the damaged archived decoder were replaced for the homepage and footer.

| Viewport    | Reading before / after                                                        | Connect before / after                                              | Footer before / after                                             | Home exterior before / after                                                |
| ----------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1440 × 1000 | [Before](before-1440-designweaver.png) / [After](after-1440-designweaver.png) | [Before](before-1440-connect.png) / [After](after-1440-connect.png) | [Before](before-1440-footer.png) / [After](after-1440-footer.png) | [Before](home-before-1440-outside.png) / [After](home-day-1440-outside.png) |
| 1280 × 800  | [Before](before-1280-designweaver.png) / [After](after-1280-designweaver.png) | [Before](before-1280-connect.png) / [After](after-1280-connect.png) | [Before](before-1280-footer.png) / [After](after-1280-footer.png) | [Before](home-before-1280-outside.png) / [After](home-day-1280-outside.png) |
| 768 × 1024  | [Before](before-768-designweaver.png) / [After](after-768-designweaver.png)   | [Before](before-768-connect.png) / [After](after-768-connect.png)   | [Before](before-768-footer.png) / [After](after-768-footer.png)   | [Before](home-before-768-outside.png) / [After](home-day-768-outside.png)   |
| 390 × 1000  | [Before](before-390-designweaver.png) / [After](after-390-designweaver.png)   | [Before](before-390-connect.png) / [After](after-390-connect.png)   | [Before](before-390-footer.png) / [After](after-390-footer.png)   | [Before](home-before-390-outside.png) / [After](home-day-390-outside.png)   |

Blog, study, and cutaway pairs at those same widths are retained beside this file. No horizontal overflow was recorded in the selected route captures. Homepage 3D uses its San Diego activity palette independently of the site theme; day captures use Work and night captures use Coding. The occupied Sleep preview is a separate routine state, not an evening-light capture.

| Room            | Day                               | Night                               |
| --------------- | --------------------------------- | ----------------------------------- |
| Study           | [View](home-day-1440-study.png)   | [View](home-night-1440-study.png)   |
| Gym             | [View](home-day-1440-gym.png)     | [View](home-night-1440-gym.png)     |
| Kitchen         | [View](home-day-1440-kitchen.png) | [View](home-night-1440-kitchen.png) |
| Lounge          | [View](home-day-1440-lounge.png)  | [View](home-night-1440-lounge.png)  |
| Onsen           | [View](home-day-1440-onsen.png)   | [View](home-night-1440-onsen.png)   |
| Sleeping alcove | [View](home-day-1440-sleep.png)   | [View](home-night-1440-sleep.png)   |

Avatar browser studies: [Lizard](avatar-lizard.png), [South Park](avatar-south-park.png), [Simpsons](avatar-simpsons.png), [Ghibli](avatar-ghibli.png), [Rick and Morty](avatar-rick-and-morty.png).

Footer themes: [morning](footer-morning.png), [noon](footer-noon.png), [afternoon](footer-afternoon.png), [evening](footer-evening.png). The DIB light is an authored personal vignette, not occupancy information.

## Payload and runtime

[Asset budget](asset-budget.json): the two La Jolla GLBs, atlas, manifest, and fallback images total **2,524,112 bytes (2.52 MB)**. The source concepts, editable Blender files, and reconstruction are downloads rather than initial scene resources. Atlas coastline/roads are actual OpenStreetMap geometry with attribution; landmark distances are artistically compressed.

[Measured runtime](runtime.json), Windows desktop with RTX 3080 Ti, headless Chromium through ANGLE D3D11:

| Measurement                                       | 1440 px viewport, DPR 1 | 390 px viewport, emulated DPR 3 |
| ------------------------------------------------- | ----------------------- | ------------------------------- |
| Cutaway, 15 seconds                               | 60.03 fps               | 60.05 fps                       |
| Exterior, 15 seconds                              | 60.04 fps               | 60.01 fps                       |
| 95th percentile rendered-frame interval           | 16.8 ms or less         | 16.7 ms                         |
| Initial Three.js / GLB requests before opening 3D | None                    | None                            |
| Home frames while offscreen, 1.5 seconds          | 0                       | 0                               |

Pixel density is capped; the emulated mobile home canvas was 525 × 528 pixels. Exterior multipass rendering still submits roughly 2.65 million triangles and 1,403 draw calls. These figures establish behavior on this desktop GPU, not performance on a phone. A physical-device profile and further geometry/shadow LOD remain useful next checks. La Jolla instances share model resources, stop offscreen, and cap animation near 30 fps.

## Verification record

- The La Jolla route stalled on its second theme in Linux: the first headless page stayed visible and continued rendering its coastal canvases. A local Playwright Linux-container reproduction timed out after 90 seconds. Releasing each completed theme page before opening the next made the same full-assets, two-theme check pass in about 80 seconds. Current/failing pages remain open for failure screenshots and traces. CI runs the scene process before the site process to expose graphics failures earlier.
- A 10 fps scheduling probe exposed a roughly 12-second first journey: the spring delta cap also slowed P's behavior clock. The schedule and travel now use elapsed wall time while spring integration remains capped; hidden-page recovery still resets the clock. A browser regression check enforces the first-journey deadline at that cadence. This is a scheduling probe, not a physical-device performance measurement.
- Linux CI runs the four public viewports on isolated runners, with one browser worker each and separate site/scene processes. The Chromium/WebKit legacy scope runs once on the desktop runner. This preserves all checks and assets while avoiding a single serialized software-WebGL queue; artifact names retain the viewport.
- Deployed smoke inspection caught an unsupported `redirect_from` field: this site does not load the redirect plugin. An explicit legacy page now forwards `/projects/pip/` to `/projects/p/`, retaining query strings and anchors, with a no-JavaScript fallback. Desktop and mobile browser checks exercise the old address.
- Python unit suite: **163 passed**. Node routine/navigation/companion suite: **17 passed**. Style contract passed.
- Production Jekyll build at `/al-folio`: passed, 46.39 seconds. PurgeCSS output was exercised through the production preview.
- Public site matrix: 280 cases; the first pass had 181 passes, 92 deliberate viewport skips, and seven stale layout/index assertions. Correcting those expectations and rerunning their affected cases yielded **188 distinct applicable passes**; the scoped rerun was nine passes and three skips.
- Public scene matrix: 124 cases; 104 passed, 19 deliberately skipped, and one narrow-screen squeeze failure. After the route-planning fix, that encounter passed three consecutive fresh checks. Production reading/P follow-up: **nine passes, one skip** across desktop and narrow mobile.
- Chromium/WebKit legacy interaction scope: 28 cases. The five failing cases exposed obsolete test controls and the ocean picking defect. After repair, the six 3D cases passed in both engines, completing **25 applicable cases with three deliberate skips** in that scope. This covers actual pointer/touch paper activation, record state, outside/inside navigation, keyboard controls, publication disclosures, and expanded previews.
- Four-theme footer checks cover reversal, no bottom gap, touch scrolling, keyboard orbit, lazy loading, offscreen recovery, context failure, reduced motion, and static fallbacks. Final selected browser captures reported no page errors.
- Formatting uses Prettier with native-EOL detection for this Windows checkout; CI uses the canonical LF checkout. Existing override ownership was audited and the four changed shadowed files were acknowledged. The decoder's staged bytes were checked against the recorded upstream hash.

No visitor study, physical-phone benchmark, fluid solver, rigid-body ecology, baked normal-map texture set, or film-production quality is claimed. Contact lighting is baked vertex AO/indirect diffuse, supplemented by procedural material normals and dynamic lights. Motion uses bounded authored states and paths. Architectural and Illustrated treatments remain documented GPT-7 experiments.
