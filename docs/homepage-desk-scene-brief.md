# Homepage Desk Scene Brief

This is the active brief for **Sirui's inhabited coastal home**, approved September 2026. Sirui is an adult man: preserve his long black hair, round glasses, and clean-shaven likeness. Earlier single-room procedural experiments are [archived](history/research-studio-2026-09/homepage-desk-scene-before.md); their geometry rules do not govern this Blender implementation.

## Current Priority Order

1. A recognizable Sirui, readable activity, grounded pose, and useful camera framing.
2. One connected house, cliff, and Pacific exterior across all room visits.
3. Reliable Now/Explore state, album interactions, accessibility, and recovery.
4. Distinct Architectural, Realistic, and Illustrated treatments of the same world.
5. Bounded asset size and animation work; optional atmosphere after functional proof.

## Known Inspection Targets

- Study hand/keyboard contact, chair back orientation, supported feet, and a camera that shows Sirui's profile.
- Kitchen utensil/cup contact; onsen waterline; pillow/duvet occlusion; tail clearance.
- Five distinct male interpretations: Lizard, South Park, Simpsons, Ghibli, Rick and Morty. One character at a time, independent of the selected album.
- Unobstructed record and paper focus, visible camera changes, and a clear outside/return route.
- Previewing time never lets a later clock tick seize the camera. Now clears both previews.
- Readable controls and the exact greeting “Welcome to Sirui’s cave.” at every supported viewport.

## Architecture And Assets

- `bin/build_coastal_home.py`: original Blender geometry, shared humanoid bone convention, Lizard tail bones, and ten clips per avatar.
- `artwork/coastal-home/*.blend`: editable sources. `artwork/` is excluded from the built website.
- `assets/models/home/manifest.json`: asset paths, room/camera/actor anchors, editable schedules, activities, clips, and prop choices.
- `assets/js/home-scene/routine.mjs`: pure Pacific clock and exploration state.
- `assets/js/home-scene/controller.mjs`: lazy loading, mixer, camera, interactions, lifecycle, and the album-controller adapter.
- `assets/js/home-scene/materials.mjs`: shared-geometry art direction and illustrated outlines/ink.
- `assets/js/home-scene/environment.mjs`: Pacific water geometry, procedural sky and reflections, graphic surf, and atmosphere. `coast.glb` supplies connected headlands and style-specific geology.
- `assets/js/home.js`: existing 2D desk and shared record state; lazy adapter to the extracted runtime.
- `_includes/home/world_controls.liquid` and `_sass/_coastal-home.scss`: accessible scene controls and responsive composition.
- Three.js r164 and its matching GLTFLoader closure remain local. The splat study has an independent r180/Spark dependency graph.

## Assets And Provenance

See [asset provenance](../artwork/coastal-home/PROVENANCE.md). The real portrait anchors likeness. Generated boards are concept art, not finished models. The experimental Pacific print retains alpha and stays outside the production build; research figures and their credit stay intact. Blender sources and web exports are reproducible from the authoring script.

## Non-Goals

This branch is a local review deliverable, not a production deployment. It does not rewrite research results, alter citation semantics, restore retired usage counters, or migrate the theme plugins. The miniature routine is authored fiction, not a claim about Sirui's observed location or live behavior.

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
- Keep the quiet 2D/3D switch, named style icons, avatar picker, and Explore disclosure.
- Now follows the occupied room. Whole home, room visits, orbit, and previews opt out of camera following until Now.
- Visit the desk keeps album and research-paper interactions one click away. First activation focuses an object; second activation plays the album or opens its paper link.
- Preserve current record, spin state, discovery order, and avatar through modes and styles. Dropped cards retain their source links and four-card replay.
- Arrow keys orbit; plus/minus zoom; D discovers a record; Escape returns to the study. The Explore panel supplies equivalent object buttons. Wheel zoom requires canvas focus, preserving ordinary page scrolling.
- Motion pause and reduced motion use composed still poses. Camera controls remain usable.

Touch supports orbit and two-finger pinch; explicit zoom buttons provide another path. A cached back/forward return pauses and restores the controllers without destroying shared state.

## 3D Desk Vignette

The initial view frames the occupied room. Shared low partitions, arch bays, flooring, and the cliff connect the study, kitchen, gym, onsen, lounge, and sleeping alcove. Load the shell, occupied room detail, and selected avatar first; stream other rooms after the first meaningful frame.

Architectural is an orthographic crafted miniature with matte plaster, simplified sandstone strata, and quiet model water. Realistic changes to perspective, fractured rock and scrub geometry, a procedural sky, moving physical water and environment reflections, and on-demand wood/fabric/stone detail. Illustrated returns to orthographic projection with modeled cliff contours and faults, graphic surf and sun, variable outlines, crosshatching, halftones, and stepped character poses while the camera remains smooth. Shared architecture, identity, activity, and interaction state persist; the styles have different physical detail as well as materials.

## Outside Vignette

The exterior is the same house and cliff viewed from outside. The glass bay and Step outside control lead there; Visit the desk or a room button returns. No background image is used in any homepage style. The Pacific has modeled water, continuous sandstone headlands, strata, and style-specific geometry. The onsen pose faces the ocean. The image-derived splat study remains isolated under artwork/.

## Acceptance Evidence Map

| Contract                                                          | Evidence                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Time, midnight/noon, weekends, DST, preview/Now                   | `node.exe --test test/coastal-routine.test.mjs`                                    |
| Nonblank scene, orbit/zoom pixel changes, room continuity         | `test/visual/desk-scene.spec.js`, four viewport projects                           |
| Avatar/style repetition, one actor, clips and contacts            | Browser pose captures plus exported asset/joint checks                             |
| Records, artifact focus/open, drop/return, 2D sharing             | Browser scene suite plus retained legacy 2D interactions                           |
| Reduced motion, keyboard/touch, load failures, pause and recovery | Targeted browser cases; inspect screenshots and runtime errors                     |
| Sitewide typography, layout, themes, overflow                     | Explicit public-route checkpoint at 1440×1000, 1280×800, 768×1024, 390×1000        |
| Payload and runtime cost                                          | Asset report and desktop/mobile browser measurements in the implementation handoff |
| Local splat tradeoff                                              | `artwork/coastal-home/splat-lab/` and its findings                                 |

## Acceptance Checklist

Keep original and comparable new captures, including live cinematic states. Inspect the images directly. Confirm a nonblank WebGL canvas and actual changed pixels after drag/zoom; source attributes are supporting evidence, not a substitute. Verify one active avatar, sane contact points, room connectivity, deterministic previews, failure recovery, and repeated mode/style switches. Run formatting, style contract, Python tests, production build, and override audit. Report measured limitations honestly.

## Future Model Handoff Prompt

Improve Sirui's inhabited coastal home from the current Blender source and extracted runtime. Read the active brief, asset provenance, and latest implementation evidence first. Preserve the five adult male identities, shared album state, authored Pacific routine, and Now/Explore camera boundary. Inspect a comparable rendered state before editing. Improve one visible problem, rebuild the relevant assets, then test contact, camera, fallback, and performance. Historical single-room experiments are reference material, not current constraints.
