# Character performance — October 2, 2026

This local checkpoint improves the inhabited room's human, robot and selected coastal animals. The five Sirui avatars gain real eyelid morphs, restrained eyes-first attention and a quiet return to the routine. P gains a complete visitor encounter and more deliberate flight. Brush rabbits, California sea lions and harbor seals gain continuous anatomy, connected acting parts and varied motion. The approved homepage narrative, B1 margin photo and archive-only workshop paper are retained.

## Delivered behavior

- **Human:** irregular and occasionally doubled blinks; independently timed lids; eyes lead a small head acknowledgement. Breathing adds at most 0.65 mm of Head-joint translation with a small pitch. Sleep closes the eyes. Pause, reduced motion, hidden views and mode changes compose still poses. Strength, walking, coffee preparation and carrying suppress additive neck motion. All five rest bodies, limb/finger weights, bones and fourteen clip keys match the prior source review; only ocular weighting and the new lids change.
- **P:** task → notice → one greeting → listen → return. Remaining nearby cannot repeat the greeting; re-entry also requires cooldown. The eyes lead the neck and shell, antennae settle at different rates, and optical catchlights follow pupils. Flights anticipate, use minimum-jerk distance timing, round circulation corners within 12 cm, bank within 0.16 radians and settle at safe perches. The world clock freezes through reading-page ownership. A modeled click still opens P's project.
- **Animals:** rabbit takeoff and landing hold horizontal travel; forward motion occurs during flight with tuck, compression and clearance. Ears can act independently. Marine heads, necks, eyes and flippers now use canonical exported pivots; the prior suffixed names silently disabled head acting. Flipper roots overlap the actual torso in 384 sampled vertices across bounded acting extremes, with at least 7.33 mm overlap. Marine coat marks use vertex colors.
- **Inspection:** click an animal outside for a nearby orbit, or press N on the focused canvas to cycle eight neighbours. Enter restores the coastline; Back inside returns to the routine. The real animals stay in their habitats. Arrival angles use bounded head/body visibility rays through the actual coast only at selection. Continuous camera tracking uses cached bounds for the selected animal and terrain clearance. Public controls remain minimal; Realistic is the sole treatment.

## Measured asset cost

| Selected wildlife                |    Before |     After |
| -------------------------------- | --------: | --------: |
| Three master GLBs                | 311,156 B | 185,648 B |
| Eight instances, mesh primitives |       222 |       116 |
| Eight instances, triangles       |   138,528 |    80,020 |

The selected wildlife payload falls **40.34%**; primitives fall **47.75%**, and triangles **42.23%**. The rabbit individually grows to support a continuous surface and articulated paws; the marine reductions exceed that increase. Each Sirui avatar adds 792 vertices / 1,280 triangles and approximately 36–37 KB raw GLB / 16–17 KB computed gzip. P's GLB remains 848,688 bytes and 27 meshes. Gzip equivalents are computed compression, rather than measured HTTP transfer encoding.

[Wildlife asset counts](wildlife-budget.json) · [Sampled flipper overlap](flipper-overlap.json) · [Human retention](../../../artwork/coastal-home/reviews/character-retained.json) · [Human expression payload](../../../artwork/coastal-home/reviews/character-expression.json)

## Actual render review

The coordinator's stable local artifact root is `.jekyll-cache/visual-qa/character-review-october/`. These files are outside watched Jekyll inputs and production assets. `bin/render_character_review.cjs` composes labeled boards from inspected actual images; it does not generate or substitute imagery.

| Artifact                                                                | What it proves                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `human-eyes.png`                                                        | Matched native open/closed studies and Ghibli's closed profile through the spectacles                  |
| `human-motion/human-study-motion.webm`                                  | 8.5 seconds of the real study camera: glance, acknowledge, return, routine and two blinks              |
| `human-motion/study-blink-frame.png`                                    | Frame-aligned actual WebGL closure, with both lid influences near one                                  |
| `robot-encounter.png`                                                   | The actual P GLB and shared motion in labeled isolated studio states                                   |
| `robot/room-performance-12s.webm`                                       | The worker's actual homepage encounter and short perch flight                                          |
| `wildlife/before/model-masters.png`, `wildlife/after/model-masters.png` | Matched actual Blender animal silhouettes and connected flipper roots in neutral studio lighting       |
| `wildlife-shape.png`                                                    | Actual product-lighting marine close-ups and rabbit foliage; private cameras only                      |
| `marine-shape.png`, `rabbit-hop.png`                                    | Compact actual marine comparisons and a four-frame rabbit acting sequence                              |
| `wildlife/after/hop-*.png`                                              | Fixed-camera planted takeoff, flight tuck, planted landing and settle at an actual authored path point |

The first eyelid prototype left the protruding irises visible; it was rejected. Render review also rejected marine flippers whose roots lay outside the body. Both are corrected in editable sources and delivered GLBs. Integration review corrected human Y-up yaw/pitch/roll mapping, lazy turntable discovery, P's shadow phase and a greeting/motor mismatch across ownership handoff. The native eyes remain in the inspected glasses envelope; neither that review nor the sampled flipper overlap proves continuous surface collision clearance.

## Acceptance and reproduction

The final checkpoint includes:

- **166 Python tests pass** and **66 Node tests pass**, with three existing opt-in GPU rendering tests skipped. Formatting for changed files, the style contract, Python compilation and diff checks pass. A full-repository Prettier check passes with `--end-of-line auto`; the default check reports existing Windows checkout line-ending warnings rather than providing a clean full-repository result.
- **Six new interaction cases pass** across desktop Chromium and 390 px phone emulation: human attention/stillness, P's encounter, and animal inspection/zoom/return. P's pointer fixture passes on both widths. Four additional avatar/hidden-view recovery cases pass.
- The four-viewport light/dark room checkpoint records **nine passes / three skips**; the skipped non-desktop resource cases exercise shared geometry on desktop instead. The public homepage checkpoint passes at all four viewport sizes. These are targeted checkpoints, not a release-scale full matrix.
- The corrected coast additionally passes full exterior orbit and guided room bounds on desktop, animal inspection on desktop and phone, and outside zoom/scroll/return in **desktop Chromium and iPhone WebKit**. The first desktop run started before Docker refreshed the repaired grid; served-data equality was then confirmed and that case passed. The separate 2D disc checks passed in both engines.
- The production `/al-folio` build passes. [Eighteen module/model/manifest hashes and prefixed references](production.json) match the source: binary GLBs, LF-normalized modules, and canonical JSON data because production legitimately minifies the manifest. Authoring sources remain excluded. The existing override audit passes, reporting 80 existing overrides and no override-manifest change.

Actual-distance assertions caught a distant overhead marine view that earlier pixel and attribute checks missed. The original camera export sampled before beach construction and used a mainland-height fallback on BVH misses. The repair samples finished physical surfaces, changing 608 of 1,824 heights while preserving all other manifest data. [Direct rays and preservation hashes](camera-support.json) show the sea-lion ledge at -6.613 m, inland at +10.298 m, and no-hit ocean at mean sea level -7.35 m. Future source builds now sample after the beach, rocks and tidal basins exist. The static 2 m grid and mean-water floor approximate terrain; they do not provide animated wave-surface collision clearance.

Final review captures live under `.jekyll-cache/visual-qa/characters-final-performance/`, `characters-camera-desktop-final/` and `characters-camera-accepted/` (the latter's phone capture). The broader responsive, public-route and second-engine checkpoint folders are retained separately.

```powershell
node --test test/*.test.mjs
python -m unittest discover -s test -p "test_*.py"
$env:NO_WEBSERVER='1'; $env:VISUAL_BASE_URL='http://127.0.0.1:8080'
npx.cmd playwright test --config test/visual/public.config.js desk-scene.spec.js --grep 'character performance:|coastal neighbours:' --project desktop-1440 --project mobile-390 --workers 1
node bin/measure_character_performance.cjs after
node bin/render_character_review.cjs
```

Local GPU timing uses native RAF/performance/randomness with a Date-only routine override, two seconds of warmup and four seconds of live sampling per view. Phone width is browser emulation on the same Windows GPU. These observations describe this machine; they are not physical-phone, production-network or controlled before/after speed claims. The raw before/after results remain under `.jekyll-cache/visual-qa/characters-{before,after}/`.

[Native runtime observations](runtime.json) record approximately 60 fps in all four final samples, no runtime errors and a p95 frame interval around 16.7–16.8 ms. Final median submissions were 6.0 / 10.1 ms for desktop study/exterior and 4.5 / 9.9 ms at phone width. Exterior draw calls were 1,216 / 1,208 versus the earlier 1,528 / 1,521; study calls were 522 / 520 versus 518 / 513. Blinks add a small room cost, while fewer marine primitives lower exterior submissions. The separate runs support bounded resource counts, rather than a controlled causal FPS improvement.

## References and limits

[Disney Research's _Realistic and Interactive Robot Gaze_](https://la.disneyresearch.com/wp-content/uploads/root.pdf) informs layered gaze, habituation and a return to a task. [Reachy Mini's original interpolation code](https://github.com/pollen-robotics/reachy_mini/blob/main/src/reachy_mini/utils/interpolation.py) is a primary reference for standard minimum-jerk timing. [NOAA's seal/sea-lion distinctions](https://www.fisheries.noaa.gov/feature-story/it-seal-or-sea-lion) inform the marine anatomy. All geometry and choreography here are original. No Disney asset, recorded robot dance or research implementation is copied.

This remains a stylized interactive browser world. The motions are authored, without a biological dynamics, physical flight or general object-collision solver. Pointer proximity is the visitor cue; P does not hear or understand speech. Raccoon and birds are unchanged, and some rabbit habitat positions remain obscured by plants. Short videos record the raw canvas without its page CSS edge feather; full-page images retain that composition. No publishing or pushing is part of this checkpoint. Sirui's taste review remains open.
