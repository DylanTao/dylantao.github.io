# Homepage Desk Scene Brief

This is the active brief for **Sirui's inhabited coastal home**, approved September 2026. Sirui is an adult man: preserve his long black hair, round glasses, and clean-shaven likeness. Earlier single-room procedural experiments are [archived](history/research-studio-2026-09/homepage-desk-scene-before.md); their geometry rules do not govern this Blender implementation.

## Current Priority Order

1. A recognizable Sirui, readable activity, grounded pose, and useful camera framing.
2. One connected house, cliff, and Pacific exterior across all room visits.
3. Reliable Now/Explore state, album interactions, accessibility, and recovery.
4. A convincing Realistic treatment: crafted geometry, coherent coastal light, soft contacts, and water. The three-style experiment is deferred to GPT-7 at Sirui's request.
5. Bounded asset size and animation work; optional atmosphere after functional proof.

## Known Inspection Targets

- Study hand/keyboard contact, chair back orientation, supported feet, and a camera that shows Sirui's profile. In the gym, keep the rack, bench, and exercising character readable together; the study bookshelf must not block its camera.
- Kitchen utensil/cup contact; onsen waterline; pillow/duvet occlusion; tail clearance.
- Five distinct male interpretations: Lizard, South Park, Simpsons, Ghibli, Rick and Morty. One character at a time, independent of the selected album.
- Unobstructed record and paper focus, visible camera changes, and a clear outside/return route.
- Previewing time never lets a later clock tick seize the camera. Now clears both previews.
- Readable controls and the exact greeting “Welcome to Sirui’s cave.” at every supported viewport.

## Architecture And Assets

- `bin/coastal_section.py`: two storeys at 0 and 2.6 meters, a 15-riser stair, room offsets shared with the manifest, one excavated mainland cliff and a continuous beach. `navigation.mjs` follows the corridors and treads; `locomotion.mjs` fits the walking feet to their support.
- `bin/coastal_clothing.py` and `bin/coastal_hair.py`: continuous sleeved garments and ear-tucked, collar-length hair surfaces. Review front, profile and full-body renders before accepting likeness.
- `bin/build_coastal_home.py`, `bin/coastal_sculpt.py`, and `bin/coastal_craft.py`: original Blender geometry, continuous sculpt surfaces, fitted furniture, shared humanoid bone convention, Lizard tail bones, and ten clips per avatar.
- `bin/coastal_characters.py`: the four human models, with shaped faces, inset eyes, side-parted hair, sloping sleeves, fingers, trousers, and canvas shoes. `artwork/coastal-home/portraits/` holds Blender model studies, excluded from production.
- `bin/coastal_interiors.py`: scalloped mountain wall, curved low divisions, rounded returns, the print niche, and the fitted gym with a power rack, loaded barbell, padded bench and dumbbell stand.
- `artwork/coastal-home/*.blend`: editable sources. `artwork/` is excluded from the built website.
- `assets/models/home/manifest.json`: asset paths, room/camera/actor anchors, editable schedules, activities, clips, and prop choices.
- `assets/js/home-scene/routine.mjs`: pure Pacific clock and exploration state.
- `assets/js/home-scene/controller.mjs`: lazy loading, mixer, camera, interactions, lifecycle, and the album-controller adapter.
- `assets/js/home-scene/materials.mjs`: shared-geometry art direction and illustrated outlines/ink.
- `assets/js/home-scene/realism.mjs` and `reflection.mjs`: physical-scale surface detail, bounded screen-space contact shadows, final color management, and live sea reflections of the actual scene.
- `assets/js/home-scene/model-loader.mjs`: Draco geometry decoding through a pinned static same-origin worker. Blender's `--export-only` route rebuilds GLBs from the editable sources without repeating sculpting.
- `assets/js/home-scene/environment.mjs`: Pacific water geometry, procedural sky and reflections, graphic surf, and atmosphere. `coast.glb` supplies connected headlands and style-specific geology.
- `assets/js/home.js`: existing 2D desk and shared record state; lazy adapter to the extracted runtime.
- `_includes/home/world_controls.liquid` and `_sass/_coastal-home.scss`: accessible scene controls and responsive composition.
- Three.js r164 and its matching GLTFLoader closure remain local. The splat study has an independent r180/Spark dependency graph.

## Assets And Provenance

See [asset provenance](../artwork/coastal-home/PROVENANCE.md). The real portrait anchors likeness. Generated boards are concept art, not finished models. The experimental Pacific print retains alpha and stays outside the production build; research figures and their credit stay intact. Blender sources and web exports are reproducible from the authoring script.

## Non-Goals

Completed work is integrated locally on `main`; production deployment is a separate action. This work does not rewrite research results, alter citation semantics, restore retired usage counters, or migrate the theme plugins. The miniature routine is authored fiction, not a claim about Sirui's observed location or live behavior.

## San Diego Routine

Use `America/Los_Angeles`, including DST. Website themes remain visitor-local or manually selected.

| Weekday time | Activity              | Room            |
| ------------ | --------------------- | --------------- |
| 03:00–11:30  | Sleep                 | Sleeping alcove |
| 11:30–12:30  | Breakfast and coffee  | Kitchen         |
| 12:30–14:00  | Reading/research      | Study           |
| 14:00–14:30  | Lunch                 | Kitchen         |
| 14:30–17:30  | Desk work             | Study           |
| 17:30–18:15  | Workout               | Gym             |
| 18:15–19:00  | Onsen                 | Onsen           |
| 19:00–20:00  | Dinner                | Kitchen         |
| 20:00–22:30  | Lounge and ocean time | Terrace         |
| 22:30–03:00  | Vibe coding           | Study           |

On weekends, coding runs until 04:00; sleep lasts until 12:30; breakfast continues until 14:00. The evening drink rotates deterministically by date among whiskey, cocktail, beer, and coffee. Quiet reclining and sipping alternate. The exact current minute is displayed; activity preview defaults never replace the clock.

## Interaction Discoverability

- Default to 2D at every viewport, including desktop (Sirui's live-review correction). A deliberate session choice takes precedence.
- Keep the quiet 2D/3D switch, a Look around / Back inside action, and motion pause. 3D always opens in Realistic, including sessions with an obsolete saved style. Choose a new character on each document refresh, avoiding an immediate repeat. Preserve that character when changing modes. Avatar, activity, time, room and experimental style selectors are authoring controls, available only with `?scene-lab=1`.
- Now follows the occupied room. Whole home, room visits, orbit, and previews opt out of camera following until Now.
- Visit the desk keeps album and research-paper interactions one click away. First activation focuses an object; second activation plays the album or opens its paper link.
- Preserve current record, spin state, discovery order, and avatar through modes and styles. Dropped cards retain their source links and four-card replay.
- Arrow keys orbit; plus/minus zoom; D discovers a record; Escape returns to the study. Ordinary visitors keep the shared 2D album and research links; the authoring panel supplies equivalent scene-object buttons. Wheel zoom requires canvas focus, preserving ordinary page scrolling.
- Motion pause and reduced motion use composed still poses. Camera controls remain usable.

Touch supports orbit and two-finger pinch; explicit zoom buttons provide another path. A cached back/forward return pauses and restores the controllers without destroying shared state.

## 3D Desk Vignette

The initial view frames the occupied room. Kitchen, gym and lounge occupy the lower storey; study, sleeping alcove and onsen occupy the upper storey, 2.6 meters above. A 15-riser oak stair, gallery, rounded returns and fitted cupboards connect them. Lower circulation passes behind and around the closed stair; upper circulation passes behind the furniture. Room offsets, floor heights, tread coordinates and camera views live in the manifest and are shared with Blender authoring.

The house is excavated into a continuous mainland cliff. Foundation, cave jambs, roof, inland terrain and beach share one shoreline section. The surf follows that section; the beach sits roughly seven meters below the lower floor. There must be no freestanding pedestal, detached arch, air gap or circular beach ring. Only the local ceiling lifts for cutaways; the mainland and back wall stay present. Check the direct Blender render as well as the browser exterior.

Sirui's capybara beach-party image hangs in a light oak frame in the kitchen, unchanged across avatars. Self-portraits remain model-review assets. The onsen camera looks past Sirui toward the actual Pacific geometry. Load the shell, occupied room and selected avatar first, then stream the remaining rooms.

The scene uses an asymmetric feathered alpha silhouette that reaches transparency before every canvas edge. A scenic image is never used to hide the rectangle. Match the canvas's CSS height to its renderer container at mobile widths; a legacy minimum height must not stretch the picture or overlap the clock. Keep the keyboard focus contour inside the visible silhouette so the mask cannot erase it. Verify the rendered perimeter against the page in light and dark themes.

Realistic is the public direction. Perspective, eroded sandstone, separate oak boards, fitted shelving, thin botanical leaves, a stone onsen rim, and warm modeled fixtures establish the scene before effects. Procedural material detail uses physical coordinates; contact occlusion, soft directional shadows, sky lighting, coastal haze, moving water, shoreline wash, and an exterior reflection pass support that geometry. The sky and ocean are rendered geometry, not scenic images.

Architectural and Illustrated remain unfinished lab experiments. Sirui explicitly deferred the three-style comparison to a future GPT-7 attempt after finding the current treatments too similar. See the complete [GPT-7 experiment note](design-experiment-backlog.md). They are not current public acceptance targets and should not regain public controls without a convincing comparison and a new Sirui request.

## Outside Vignette

The exterior is the same house and cliff viewed from outside. The Pacific opening and Look around action lead there; Back inside resumes the current routine. The authoring lab retains individual room visits. No background image is used in any homepage style. The Pacific has modeled water, continuous sandstone headlands, strata, and style-specific geometry. The onsen pose faces the ocean. The image-derived splat study remains isolated under artwork/.

## Acceptance Evidence Map

| Contract                                                          | Evidence                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Time, midnight/noon, weekends, DST, preview/Now                   | `node.exe --test test/coastal-routine.test.mjs`                                    |
| Nonblank scene, orbit/zoom pixel changes, room continuity         | `test/visual/desk-scene.spec.js`, four viewport projects                           |
| Avatar/mode repetition, one actor, clips and contacts             | Browser pose captures plus exported asset/joint checks                             |
| Records, artifact focus/open, drop/return, 2D sharing             | Browser scene suite plus retained legacy 2D interactions                           |
| Reduced motion, keyboard/touch, load failures, pause and recovery | Targeted browser cases; inspect screenshots and runtime errors                     |
| Sitewide typography, layout, themes, overflow                     | Explicit public-route checkpoint at 1440×1000, 1280×800, 768×1024, 390×1000        |
| Payload and runtime cost                                          | Asset report and desktop/mobile browser measurements in the implementation handoff |
| Local splat tradeoff                                              | `artwork/coastal-home/splat-lab/` and its findings                                 |

## Acceptance Checklist

Keep original and comparable new captures, including live cinematic states. Inspect the images directly. Confirm a nonblank WebGL canvas and actual changed pixels after drag/zoom; source attributes are supporting evidence, not a substitute. Verify one active avatar, sane contact points, room connectivity, deterministic previews, failure recovery, and repeated avatar/mode switches. Run formatting, style contract, Python tests, production build, and override audit. Report measured limitations honestly.

## Future Model Handoff Prompt

Improve Sirui's inhabited coastal home from the current Blender source and extracted runtime. Read the active brief, asset provenance, and latest implementation evidence first. Preserve the five adult male identities, shared album state, authored Pacific routine, and Now/Explore camera boundary. Inspect a comparable rendered state before editing. Improve one visible problem, rebuild the relevant assets, then test contact, camera, fallback, and performance. Historical single-room experiments are reference material, not current constraints.
