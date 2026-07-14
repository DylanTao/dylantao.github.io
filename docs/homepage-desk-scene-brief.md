# Homepage Desk Scene Brief

This brief records the intended 2D and 3D homepage desk scene so a future model or agent can rerun the same target and compare alignment.

Agent-facing Codex overlay: `.codex/skills/homepage-desk-scene/SKILL.md`. This brief remains the canonical copy-pastable scene contract and handoff source.

## Current Priority Order

Protect these concerns in order when a scene improvement creates a tradeoff:

1. Preserve working, accessible 2D/3D state and deliberate recovery paths.
2. Make the room and exterior read as one continuous anchored cliff-cave environment.
3. Keep albums, project papers, turntable, onsen/lizard/laptop, lounge chair, controls, and usage note legible in their important states.
4. Keep the hero usable at laptop, tablet, and narrow-mobile dimensions without hiding the research story.
5. Improve thickness, materials, lighting, and physically motivated motion only when the earlier contracts remain stable and the scene stays lightweight.

## Known Inspection Targets

Treat these as unresolved until current rendered evidence proves them complete:

- Full 360 room yaw, especially believable rear-wall clearance at 180 degrees.
- Shared interior/exterior anchors: cave opening, window, floor, desk, onsen, lounge massing, plinth, cliff, and camera targets.
- Visible thickness or curved geometry when orbiting albums, papers, furniture, room shell, floor, pool, desk objects, and exterior forms.
- Default-view legibility of the turntable/tonearm, four rack sleeves, A4 project titles, onsen/lizard/lap desk, and lounge chair/ottoman.
- Mobile 2D/3D switching, controls, usage tag, object focus, window transition, and return path without overlap or cropped primary media.
- Coastal water, foam, wet sand, and gust motion that feels physically motivated without a heavy simulation or constant offscreen work.

## Non-Goals

- Do not turn the vignette into a fullscreen scene, photoreal renderer, or general-purpose 3D engine.
- Do not add a heavy asset or fluid-simulation pipeline unless it clearly replaces the current lightweight approach and remains fast.
- Do not add unlicensed audio, autoplay, fake player chrome, or interaction that implies copyrighted music is playing.
- Do not redesign unrelated homepage narrative, posts, projects, global navigation, or footer while working on the scene.
- Do not change usage-counter math inside scene code; route accounting changes through `$agentic-usage-ledger` at the coordinated publish checkpoint.
- Do not replace the whole scene before preserving and testing shared state, object order, keyboard paths, and deliberate inside/outside transitions.

## Acceptance Evidence Map

| Contract                 | Required evidence                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stable render and camera | Nonblank canvas plus before/after pixel evidence that drag and zoom visibly change the scene without automatic inside/outside transitions                            |
| Shared 2D/3D state       | Current record, spin state, and discovered-card order survive mode changes and match in both representations                                                         |
| Room/exterior continuity | Comparable interior, side/rear-yaw, outside-default, outside-zoom, and return screenshots showing the same anchors and material language                             |
| Object interaction       | Album focus/swap/drop, artifact focus/open, reset, scroll-back, window jump, outside return, and four-card replay complete without stale focus or hidden hit targets |
| Responsive layout        | Screenshots at 1440x1000, 1280x800, 768x1024, and 390x1000; controls, usage note, window, focused objects, and primary media remain visible                          |
| Theme and access         | Light/dark surfaces remain legible; keyboard focus and reduced-motion paths retain all content and controls                                                          |
| Runtime quality          | No horizontal overflow or new console errors; animation idles when hidden and the renderer pixel ratio remains capped                                                |

Run the targeted source and behavior checks before accepting scene work:

```powershell
npm.cmd run lint:prettier
npm.cmd run lint:style-contract
bundle exec jekyll build
npm.cmd run test:visual:scene
npm.cmd run test:visual:legacy -- --grep "home dropped|home opened|home 3D"
```

Automated compact coverage exercises coarse-pointer mode switching, outside entry, zoom, controls, and window return at tablet and narrow-mobile sizes, while detailed album/artifact picking remains desktop-weighted. Keep mobile browser screenshots and direct touch/control checks for object focus/drop and real-device confidence. Use the Docker/root-site verification in `AGENTS.md` before publish.

## Accepted Architecture Checkpoint — 2026-07-14 full-matrix acceptance

- The room now uses one live 13-point organic footprint for the extruded floor. Twelve contiguous side/rear shell panels terminate at the actual central glass aperture, whose deliberately unequal stone reveals keep the front physically open; do not describe or test this as a geometrically closed loop. An open-center ceiling cap preserves the diorama camera and full rear-yaw clearance.
- The exterior keeps the reciprocal room graph inside one continuous cliff mass. The aperture must sit high in that mass, with substantially more live cliff below than above, while a few broad overlapping stone strata connect it to the beach, wet sand, foam, and ocean without façade-like flaps or tiny rock facets.
- Default composition gives the onsen/lizard/lap desk and lounge enough projected area to read while keeping the chair, ottoman, dropped-card fan, usage note, and transport controls clear of one another. The working desk sits modestly right of the onsen-to-window corridor so the lizard retains a real view through the left glass pane without crowding the room edge.
- The exact desk note “Welcome to Sirui’s cave.” must remain visibly legible in initial desktop and mobile frames. Texture readiness alone is insufficient: the face must clear its backing bevel and retain measurable rendered bounds. The note is interior onboarding rather than architecture, so it yields in outside mode instead of occluding the reciprocal chair or other room landmarks.
- Window entry uses layered disclosure: a quiet sill- or frame-anchored hotspot is present in the default view, one bounded pulse may introduce it, and the short “Step outside” label appears only on hover or closer zoom. Reduced motion keeps the same static affordance.
- Architecture evidence is sampled from live geometry and real raycasts: a welded floor-cap boundary and clipped screen silhouette, live shell spans and open aperture reveals, actual aperture-to-summit/foot elevation, welcome-note bounds, window guidance, camera-to-landmark occlusion, and a clear 3×3 lizard-to-ocean/horizon cone derived from the live left-pane geometry. The desk, turntable, and center mullion remain eligible occluders; the evidence must report all nine samples clear rather than hide a blocker or aim through the mullion. Projected bounds prove composition only; visibility claims require the accompanying occlusion result. Static topology is cached, automatic interaction evidence stays lightweight, and deep raycasts run only on an explicit QA request so telemetry never rides the orbit path. Keep the dedicated welcome/cue, top-oblique, rear-shell, high-cliff, mobile-drop, compact-outside, dark, and return captures when changing these contracts.
- The 2D collage and shake/drop layout keep the portrait/record, one settled discovery card, and both research slips legible. Both representations use the same stage height at each breakpoint; center and distribute the shorter 2D collage instead of shifting the page when visitors choose 3D. Do not restyle it merely to mimic the 3D material pass.
- Remaining visual headroom is material realism and subtle massing, not another topology rewrite. Prefer warmer low-contrast stone variation, lighting, and a few broad layers while keeping the scene lightweight; the target is a convincing miniature, not a photoreal asset pipeline.

## Interaction Discoverability

- Keep the `2D | 3D` switch always visible but visually quiet. The 3D mode should feel discoverable without forcing users to hover or already know the album interaction, especially on touch devices.
- Hide only the extra 3D transport/reset controls until 3D mode is active.

## 2D Artifact Stain

- Use one coffee stain, not two separate marks.
- The stain sits visually on top of the two artifact cards at their right edges, as if the same cup ring crossed both paper surfaces.
- The mark should not read as a perfect circle. It should be an off-round, slightly squashed ring with broken arcs, uneven absorbed edges, darker pooled segments, soft paper bleed, and small satellite droplets.
- The stain may touch card surfaces, but card text, icons, and route affordances remain readable.
- In motion, the stain should feel like an animated design cue: quiet, handmade, and desk-like, not a decorative logo or a clean vector target.

## 3D Desk Vignette

- The desk is a small polished room vignette inside the hero media footprint, not a fullscreen model.
- High-level revamp aim for future Codex/model passes: turn the scene into a continuous 360 Japandi cave-house environment, where the interior and exterior are two views of one carved cliff room/environment rather than separate stage sets.
- The spatial contract is anchor-first: square-ish cave mouth/window wall, floor slab, desk, onsen pool, lounge chair corner, album shelf, roof/plinth, shell, cliff shelves, shoreline, and camera targets should share one coordinate language. If the interior cave mouth/window moves or scales, the exterior cutaway cave opening and visible room anchors must move or scale with it.
- Interior and exterior are reciprocal camera states in one architectural world. Reuse the actual room scene graph through the cliff aperture; do not build or hand-tune a second miniature room. When the camera crosses the glass, the projected left-to-right ordering should mirror while object identity, scale relationships, materials, and interaction state remain unchanged.
- 360 viewing is part of the design target. Dragging in 3D should orbit around the active room/exterior anchor through a full yaw range, with bounded pitch and no automatic inside/outside transition. Wheel/trackpad only explores zoom/dolly.
- Flat stand-ins should be treated as temporary failures. Albums, source cards, A4 papers, floor slab, window frame, onsen pool, lizard Sirui, lounge chair, ottoman, desk, mug, turntable, laptop, roof/plinth, and shell surfaces need visible thickness, bevels, or curved mesh geometry so orbiting does not reveal cardboard cutouts.
- Water/sand motion should read physically motivated without becoming a heavy simulation: waves advect foam, wet sand darkens near the wave reach, sand ripples/gusts move along the shoreline, and lightweight heightfield/shader motion replaces purely sliding flat planes.
- The current 3D target is a warm Japandi cliff-cave nook, not a literal office desk render: carved stone/plaster side forms, a warm wood desk/floor, a small stone-clad Japanese onsen-style soaking pool, a cozy reading/work lounge corner, and a square, cave-mouth-like floor-to-ceiling window wall should all read together.
- The room should feel explorable from the first view. The desk sits closer to the glass, while deeper room cues such as the onsen, lizard Sirui, chair/ottoman, stone ribs, ceiling mass, sill, and decor prevent the scene from collapsing into a flat tabletop.
- Current interaction priority: the interior room view should be a full 360 bounded orbit. Dragging in room mode moves the camera around the room anchor with bounded pitch, but clamps its horizontal position inside the scaled side, rear, and window-side footprint; it must not become an exterior camera unless the user deliberately clicks into outside mode. The open-diorama camera may remain vertically elevated, especially on compact canvases, so onsen, lounge, albums, and papers stay readable without pretending this is a sealed first-person walkthrough. The full yaw range must preserve visible wall clearance, and the 180-degree rear view should show rear-room floor, trim, and decor from inside the glass rather than from an accidental exterior cutaway.
- The onsen replaces the old bed cue. It should read as a small-scale soaking pool with stone cladding, warm water, steam, a cocktail ledge, and a waterproof/lap desk setup showing a tiny VS Code/Codex screen.
- Lizard Sirui should visibly relax in the onsen rather than sit as a generic prop: head, body, tail, eyes, resting arms, and water contact should make the scale and action legible.
- The lounge corner should be Herman Miller Eames Lounge Chair + Ottoman inspired, with molded wood shells, cream cushions, a black swivel/star base, and rounded 3D cushions/shells rather than flat panels.
- Chair material reference: use warm walnut-like molded plywood shells with visible curved edge thickness and subtle grain, soft cream leather-like cushions with rounded volume and gentle seams, and a black metal swivel/star base. Treat any local product image as a private reference unless explicitly approved for the public repo; preserve the material/color description here as the durable reference for future model passes.
- The table has a visible turntable, elegant Autodesk mug, coffee surface, a single table stain, and two non-overlapping artifact cards. In the default 3D desk view, the vinyl player platter, label, tonearm, and base must remain readable rather than being hidden by the album shelf.
- The vinyl tonearm/stylus must rest on the record only while the meme disk is playing. When stopped or paused, it must be visibly parked away from the vinyl.
- The four album sleeves live in a wall-mounted shelf on the wall opposite the capy photo wall, not beside the turntable; the shelf should stay clear of the tonearm sweep while keeping the sleeves clickable.
- Personal Sirui photo art is part of the 3D room language: the lizard meme is a large framed art piece on the wall opposite the window, the dog photo is a small framed desk object, and the capy photo is framed on a side wall. Each should be real textured 3D geometry with frame depth, glass/mat cues, and click-to-admire focus.
- Albums are object-native controls. Clicking one should first focus it in a top-down inspection pose over the turntable/rack without changing the playing record; clicking that focused sleeve again swaps the current vinyl, starts the meme record, and returns the sleeve to the rack. Dragging or flicking can scatter an album and reveal a small song card.
- Album rack hit targets should follow the visible left-to-right sleeve order, including while another sleeve is focused; dropped/empty rack slots must not remain clickable.
- Thrown or dropped albums are floor evidence, not record-replacement controls. Picking must ignore hidden rack proxies and thrown album entries, and a click on a visible rack sleeve should replace the currently focused sleeve instead of reselecting the enlarged now-playing album.
- The focused "now playing" album should read as a sleeve propped on a small desk/easel ledge near the turntable, with a front-facing pose and enough room context still visible. Replacement clicks should favor nearby visible rack sleeves over the enlarged focused sleeve so the interaction feels like swapping records, not fighting the hitbox.
- On desktop, the focused sleeve should separate from the rack and read as an inspectable top-down record sleeve: larger than rack sleeves, hovering over the turntable/rack zone, and not committed until the second click. Mobile can keep a tighter pose so the sleeve does not crowd the controls or window.
- Artifact cards are object-native controls. First activation lifts the selected card to a readable front-facing angle; second activation or keyboard confirmation opens the project link.
- Only the 3D project artifact cards should read as scaled white A4 papers: readable hand-drawn project labels, messy ruled scribbles, doodles, and a slightly tactile paper edge.
- Dropped meme-record discoveries are album/source cards, not A4 papers. In 2D they should look like compact collected music cards with real cover art, title/artist, and the Spotify/source affordance. In 3D they should match that compact card language when they settle on the floor.
- Once all four meme-record discoveries have been found, a successful shake should replay all four album/source cards in one burst. Do not clear the pile on pointer-down or regress to one-card replay.
- Album selection should feel like a sleeve-disc swap: show the real cover, lift/remove the meme disc, insert the replacement, start the vinyl, and return the sleeve to the rack rather than leaving it stranded in a giant focused pose.
- Scroll or wheel back over the scene restores the default camera and object positions before letting the page feel stuck.
- The 2D and 3D views share one logical state: current meme record, spin state, and dropped meme-card order. A card discovered in one view must be visible as already discovered in the other.
- Dropped albums and song cards should feel like flat paper objects losing energy: shallow arcs, short slides, deterministic fan slots, thin card edges, and visible floor contact shadows. They must settle just above the floor plane, never visually sink through it, hover high above it, or hide their edge thickness.
- Dropping or flicking an album should leave object-view and ease back to the full room view, so the user never gets stranded in a close crop after discovery.
- Flicking a rack sleeve while another album or card is focused must clear the previous focus as part of the drop, not leave stale `data-focused-desk-object` state behind.
- In 2D, the discovered-card pile should remain visibly paper-like after repeated drops: separated fan slots, slight elevation cues, and enough offset for individual card edges to read instead of becoming a single glossy slab.
- The 2D active/preview record should never read as a blank pale circle. Keep the CSS vinyl groove and cover-art fallback visible under the Three.js record canvas so the meme disk stays legible while WebGL is loading, subtle, or temporarily transparent.
- In 3D mode, hidden 2D portrait/card/artifact layers must not stay in the hero grid flow. The room canvas, usage note, and 3D controls should all remain visible together on laptop-height desktop viewports and mobile after switching modes; on mobile, keep the usage note above the control strip rather than letting the two overlays collide.
- The 3D usage note should behave like a compact counter overlay, not a prose caption crossing the table. Keep only explicit `commits` and `tokens` visible in scene, and reserve hours, energy/tree equivalents, cost, and explanatory model-damage copy for fuller ledger contexts.
- On mobile, keep that 3D counter as a small upper-wall tag, not a full-width caption across the window, table, or floor-card zone.
- Focused album and artifact views should keep enough of the room in frame to feel like reading an object on the desk, not a hard crop into a separate inspection scene.
- Dark mode must not collapse the room floor into a black slab. The generated floorboard texture should stay visible through a warm material tint, with low-opacity contact shadows and enough wall/floor separation for the dropped cards to read as paper lying on a room surface.

## Room Grid Contract

Top-down schematic for the shared room language, with `+x` moving right, `+z` moving toward the viewer, and the viewer looking from the lower edge of the grid:

```text
z
^
|  W W W       floor-to-ceiling window wall: big designer frame, thick sill, warm wood trim
|  W W W       outside view: same horizon, ocean, sand/cliff palette
|
|  [onsen pool] [lounge chair] deeper warm Japandi room zone
|
|  [albums] [turntable]        desk pulled closer to the window
|
|        [paper cards] [mug]   front-right working zone
|
|  dropped meme cards          floor in front of desk, compact fan stack with contact shadows
+--------------------------------------------------------------> +x
```

Interior and exterior should read as two scales of the same cliff-cave world: warm Japandi wood, soft stone/plaster, a sculptural carved-rock nook, square cave-mouth glass, sandy coastal light, and soft non-photoreal shading. The outside cutaway house should reuse the same cave opening/window language and the same floor/stone/wood vocabulary rather than switching to a different facade style.

The grid is descriptive, not a mandate for photoreal geometry. Keep the room stylized and graphic, but preserve the stable anchors: big rear window, desk close to the glass, onsen and lounge corner deeper in the room, rear-left record shelf/turntable on the desk, front-right paper/mug work zone, and the dropped-card fan on the near floor.

## Outside Vignette

- The window should read as a floor-to-ceiling designer window with frame, sill, glass, and a view plane.
- The exterior should show the same house, not a separate miniature world: the large glass wall, desk by the window, onsen/lizard/lap-desk cue behind it, lounge corner massing, roof overhang, stone plinth, and wood/stone material language must correspond to the interior view.
- Zooming toward the window reveals a faint object-native hint, but zooming must not automatically enter or leave the room. Clicking the inside window enters outside.
- Once outside, scroll/trackpad zoom should explore the exterior view and zoom closer into the window without automatically re-entering the room; clicking the visible window/glow returns inside.
- The outside scene should be a stylized San Diego cliff-beach diorama with one physical ocean, shoreline foam, dry and wet sand, irregular cliff massing, the carved room aperture, and time-of-day lighting.
- Prefer broad terrain massing and one source of truth per landscape layer over stacked scenic planes: the shoreline should organize wet sand and foam, the cliff foot should meet that coast, and restrained texture or shader motion should create depth without duplicating the ocean or turning small stone forms into noise.
- Through the exterior aperture, the same lizard Sirui relaxes in the same onsen. The lap desk/laptop sits near the pool and shows a small VS Code/Codex hint; this is the room itself, not a reconstructed mini cue.
- The cutaway room details should be readable at the default outside camera: soften glass/glow wash, keep the onsen/lizard/laptop forward enough to see, and avoid dark pier/foundation pieces overpowering the window.
- Outside mode should keep a subtle way back inside through the house/window itself: a warm, gently pulsing interior glow plus the existing keyboard-accessible controls. The object-native glow and hit target must depth-test against the cliff and disappear when side/rear orbit puts solid rock between the visitor and the aperture; Escape and reset remain available recovery paths.
- Outside mode is scoped to the hero. If the user scrolls the hero mostly out of view, the scene should automatically return to the room state while preserving the current record, spin state, and discovered-card order.
- The interior ocean/window view plane must never be fully hidden by orbit cutaway logic. Side and rear orbit angles may fade the glass/recess, but the coastal view should remain visible enough to preserve the room/exterior continuity.

## WebGL / Three.js Direction

- Keep the core scene in Three.js and use generated canvas textures for painterly material detail: floorboards, ocean foam, sand, cliff striation, onsen water/steam cues, laptop screen, chair wood/cushion surfaces, and record labels.
- Favor cheap GPU motion before adding heavier simulation: scrolling texture offsets, small mesh bobbing, and eased object arcs already give ocean/sand/card motion without a particle system.
- The outside view uses texture-offset ocean/foam motion, transparent sand-gust planes, small instanced shoreline glints, and low-resolution shader overlays for foam/sand shimmer near the beach. This should read as living coastal motion while staying cheap and only animating outside mode.
- The current implementation centralizes room bounds plus the window, desk, onsen, chair, and rack anchors. Those anchors drive one shared room graph, reciprocal camera poses, the cliff aperture, and the return target; camera positions and look targets remain view-specific framing parameters. The exterior wraps that same room graph in one ocean/shoreline/cliff composition with a few broad extruded faces; preserve the shared anchor contract before introducing a heavier asset pipeline.
- The desk view uses a tiny instanced glint mesh on record/card/mug surfaces. Keep this as a single low-cost GPU accent that only animates while the scene is spinning, focused, hovered, or already tweening.
- Next valuable additions would be depth-aware dust/glisten accents or a physically richer water shader if it clearly improves the current lightweight shader-overlay stack. Avoid full fluid simulation unless it replaces the existing canvas-texture, shader-overlay, and instanced-accent motion with a clearly better, still-fast effect.
- Keep renderer pixel ratio capped and animate only when visible, spinning, moving, or outside textures are active.

## Inspiration Research Queue

These references are prompts for comparative study, not a source library to copy. For every future experiment, record the visitor problem and the specific technique being tested; verify the license and provenance of every public asset, texture, model, shader, sound, and code sample before reuse. Sound must be explicitly opt-in with no autoplay. Motion-heavy ideas need a reduced-motion or static equivalent, and additions must stay within the current capped-DPR, visibility-gated render budget rather than accumulating as permanent background work.

### Homepage Mini-World

- Study [Bruno Simon](https://bruno-simon.com/) and the [2019 portfolio](https://2019.bruno-simon.com/) for loading-state pacing, spatial onboarding, camera limits, and how a playful world still points toward real work.
- Study [Susurrus](https://susurrus.vercel.app/), [Locomotive](https://locomotive.ca/en), [Tiny Skies](https://tinyskies.vercel.app/), [GLSL Fluffed](https://mameson.com/experiment/glsl/fluffed_2/fluffed_2.html), [Lumen Decor Studio](https://lumen-decor-studio.vercel.app/), [Jesse Zhou](https://www.jesse-zhou.com/), and [Little Workshop Showroom](https://showroom.littleworkshop.fr/) for camera framing, shader atmosphere, progressive disclosure, material contrast, tactile feedback, and ways to keep ambient motion subordinate to content.
- Compare the [Three.js interactive-room thread](https://discourse.threejs.org/t/interactive-room-three-js-scene/59113), the two room walkthroughs on [YouTube](https://www.youtube.com/watch?v=AB6sulUMRGE) and [YouTube](https://www.youtube.com/watch?v=aNJN8h_QsPA), and the [free 3D-room tutorial discussion](https://www.reddit.com/r/threejs/comments/1mevzvu/created_a_free_tutorial_on_how_to_make_a_3d_room/) for room-scale camera constraints, interior/exterior continuity, lighting, asset organization, and loading strategy. Rebuild techniques in the site's own anchor/material system; do not import an authored room wholesale.

### Secret Dogtor Page

- Study the [Three.js IK example](https://threejs.org/examples/#webgl_animation_skinning_ik) for a future character whose gaze, paws, or body respond to a nearby target without becoming a constant attention trap.
- Study [Pudgy World](https://www.pudgyworld.com/) and the character-led references above for playful world-building, short reward loops, and restrained sound cues. Keep the page's fruit choice and recovery path understandable without animation or audio.

### Future And General

- Use [Poly Pizza](https://poly.pizza/) only as a discovery index for low-poly asset directions. Confirm the license and creator attribution on the exact asset before download or publication, preserve a provenance record in the repo, and prefer purpose-built geometry when it is cheaper or more coherent.
- For any heavier model, texture, shader, or audio idea found in this queue, prototype progressive loading and a lightweight fallback first. Measure initial bytes, time to first usable interaction, steady-state frame time, memory, and mobile thermal behavior; remove the experiment if its delight does not justify the cost.

## Acceptance Checklist

- One visible coffee stain, organic and non-circular, not clipped, readable on light and dark themes.
- 3D canvas prewarms, renders nonblank, and drag/zoom produce visible pixel changes.
- The bed is gone from the active interior/exterior cue. The onsen, lizard Sirui, cocktail ledge, lap desk, warm water, and steam read at default and closer views.
- The lounge chair and ottoman read as an Eames-inspired 3D object with molded wood, cream cushions, and black base, not as flat rectangles.
- Four albums are in an organized shelf; discovered song cards settle on the floor in the same order as the 2D pile.
- Album click, card focus, 2D shake discovery, 3D album flick discovery, album-drop room return, scroll-back, reset, window jump, and outside return all work.
- Inside wheel/trackpad zoom never auto-enters outside; outside wheel/trackpad zoom never auto-enters inside. Window clicks are the deliberate mode switch.
- Interior drag is a full 360 center-room look-around: the camera stays inside the room, yaw can rotate all the way around, 180-degree rear yaw keeps visible rear-wall clearance, and exterior-looking-in composition only appears after the deliberate outside-mode window click.
- 2D dropped meme discoveries read as compact album/source cards; only the 3D project artifacts read as A4 papers.
- Mobile keeps the scene usable without cropping the window, controls, or artifact focus states.
- For the default room layout, a passing view shows four visible album sleeves, readable A4 project-paper titles, the onsen as a left-floor pool, and the Eames-inspired chair/ottoman as a right-floor reading/work corner, with neither object colliding with the table.

## 2026-07-12 Reciprocal Room And Coastal Composition Pass

This pass supersedes the hand-matched exterior miniature described in the July 10 checkpoint. The scene remains deliberately lightweight and stylized; the improvement target was spatial truth and readable composition, not photorealism.

| Visible problem                                                                                                                         | Design intention and implemented response                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Interior and exterior still drifted because two scene graphs only approximated the same layout.                                         | Render the actual room in both modes and change only camera state, visibility treatment, and the cliff/aperture context. A reciprocal outside view mirrors screen ordering by projection instead of remapping landmarks, so desk, onsen, chair, rack, papers, photos, and current album state cannot diverge between copies. The interior uses a true but bounded orbit whose horizontal camera position remains inside the scaled room/window footprint at side and rear yaw. |
| The onsen was too small, the lounge overwhelmed the foreground, and blank wall panels looked like accidental placeholders.              | Treat projected scale as meaning: enlarge and lower the onsen until the pool, lizard, lap desk, and water contact read; reduce/reposition the walnut-and-cream lounge pair until it remains distinct from the desk and controls. Remove empty frames and keep only textured personal-photo evidence with real frame depth.                                                                                                                                                     |
| The cliff, beach, ocean, and sky read as stacked stage sets with duplicated water and detached terrain.                                 | Keep one physical ocean, shape dry and wet beach around one curved shoreline, connect the cliff foot to that coast, and close the rear cliff silhouette for orbit views. Use a few broad low-poly stone planes and restrained foam/water motion; small-vignette geology needs massing before texture marks. Register the rendered wet-sand material and every foam clone so a live theme change recolors the actual coast rather than an unused base material.                 |
| A scene could look plausible in one screenshot while silently losing furniture, photo textures, or coastal contact at another viewport. | Expose `data-composition-evidence` from the rendered scene and test broad relationships: landmark presence and mirrored order, minimum onsen/lounge area, control-strip clearance, photo texture readiness, cliff-foot-to-shoreline proximity, interior camera bounds, and live coastal palette state. Telemetry protects topology; screenshot critique still owns material and atmosphere judgment.                                                                           |

The accepted evidence is the regenerated four-viewport interior/outside matrix, desktop side/rear/orbit/zoom continuity, dark surfaces, reduced motion, keyboard focus, touch controls, album settlement, nonblank WebGL, and visible drag/zoom changes. Do not accept a future duplicate miniature merely because its default screenshot resembles the room; one architectural world is now the contract.

## 2026-07-10 Canonical Room And Cliff-Aperture Pass

This pass treated semantic continuity as the target: 2D stays a quick portrait-and-paper collection, while 3D becomes the exploratory room containing the same record identity, spin state, discovery order, and paper/album evidence. It deliberately did not copy the cave, window, or room into 2D.

| Visible problem                                                                         | Design intention and implemented response                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The default room was a tiny stage surrounded by empty floor.                            | Move the fixed interior camera closer with a narrower field of view so the window, turntable, papers, onsen, and lounge read together. Keep the camera eye fixed inside the room; drag changes only the look direction through a full yaw.                                                                                                                                                                                                                                                                                                                 |
| Side yaw fell into white space and rear yaw looked like a camera collision.             | Extend theme-aware side walls, floor trim, shallow niches, and a rear console around the fixed eye. A deterministic `data-camera-yaw` checkpoint now proves that the QA capture actually reaches the rear range instead of accepting any pixel change.                                                                                                                                                                                                                                                                                                     |
| The exterior looked like a separate balcony/stilt dollhouse or a floating wooden crate. | Derive the outside window from the interior blueprint, map the miniature desk/onsen/chair/rack through a shared compact projection, and use a small onsen-only foreground offset for default-view legibility. Remove balcony/support language and carve the opening from deep asymmetric stone faces tied into an irregular plinth and shoreline. A surrounding coastal dome prevents orbit voids; a slower exterior gesture, bounded close zoom, and yaw-dependent rear clearance keep the camera outside the cliff while repeated drags retain full yaw. |
| Dropped albums and source cards hovered, sank, or collided with the control strip.      | Use shallow parabolic arcs, faster impact-led timing, delayed contact shadows, floor-safe centers, deterministic fan positions, and a landing zone between the desk and controls. Reduced motion skips the flight but preserves the settled evidence. After an album swap, restore the full-room camera before the next interaction so the remaining rack sleeves are visible and raycastable rather than compressed at the canvas edge.                                                                                                                   |
| The 2D collection became either four unrelated lanes or one unreadable slab.            | Use a compact offset fan with thin edges, moderate rotations, and enough exposed area for every card to remain keyboard-openable. The four-card replay preserves discovery order.                                                                                                                                                                                                                                                                                                                                                                          |
| Touch preview exposed play/previous/next controls that were not hit-testable.           | Preview and vinyl state now enable the same controls that hover/focus reveals. Neutral portrait space remains available for shaking; keyboard Space/Enter and Escape recovery stay intact.                                                                                                                                                                                                                                                                                                                                                                 |
| Compact framing cropped the album rack and lounge at opposite edges.                    | Treat sub-800-pixel scene surfaces as compact even when a tablet gives the canvas more raw pixels, and apply one extra scale step only when the canvas itself is portrait-like. This keeps all four rack targets, the onsen, and the lounge inside the default 390/768 compositions without weakening the closer desktop room view.                                                                                                                                                                                                                        |
| Richer floor lighting reused color gradients as height data.                            | Keep the floor as a rough standard material with a color texture and real contact shadows; do not reuse the sRGB albedo as a bump map. Material hierarchy is more truthful than false relief.                                                                                                                                                                                                                                                                                                                                                              |

Screenshots under `.jekyll-cache` are local, gitignored review artifacts rather than durable repository evidence. Before acceptance, regenerate them from the currently served asset, assert the intended 2D/3D and inside/outside state before capture, and visually inspect light interior/default/side/rear, outside/default/orbit/zoom, dark, mobile, and grounded discovery states. The durable checked-in Playwright contract covers DPR capping, explicit yaw, genuine window raycasts, negative rear-wall clicks, compact outside/return, touch targets, dark surfaces, reduced-motion settlement, controller-owned shared state, four-card control clearance, and keyboard access.

## 2026-06-21 Long-Run QA Loop Notes

Screenshot sets were captured under `.jekyll-cache/home-scene-qa/loop00` through `loop13`, with desktop and mobile shots for 2D cards, 3D interior default, interior zoom, outside default, outside max zoom, album swap mid-motion, and album swap settled.

| Loop | Top visible failures                                                                                                                             | Targeted fixes / result                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00   | Interior read as a tabletop in a shallow box; bed was hidden; exterior felt like a separate dollhouse on a pier.                                 | Enlarged the glass wall, widened camera framing, added curved plaster ribs, moved the desk toward the window, reduced exterior glow, and added cove sand. |
| 01   | Ribs read like foreground bars; bed was still buried; exterior glass/base still overpowered the cutaway.                                         | Softened the ribs, reduced to rear shell bands, moved/raised bed cues, and further reduced exterior glow/base darkness.                                   |
| 02   | Bed read as a small bench; exterior underside still looked like stacked support pieces; album motion capture missed the rack.                    | Pulled the bed zone forward, added a cliff plinth/apron, and corrected the QA runner toward tested album/window hit zones.                                |
| 03   | Album mid-motion still hit the turntable; outside entry target shifted with the enlarged window; exterior plinth needed more grounding.          | Probed live hit zones, moved the runner to the reliable window entry, and added a visible front cliff apron.                                              |
| 04   | Album click changed state but did not show a sleeve; mobile return/reset capture could collide with 2D layers; outside max zoom stayed stable.   | Separated visual capture sequences from return-click testing and reloaded before album capture.                                                           |
| 05   | Album sleeve lift was too subtle; mobile outside max zoom could fall back to page scrolling; exterior composition was stable but still stylized. | Switched wheel capture to direct scene wheel events and moved the album play pose forward/right.                                                          |
| 06   | Mobile album sequence briefly fell back to 2D; desktop sleeve was still captured too early/late.                                                 | Reasserted 3D mode before album capture and adjusted screenshot timing.                                                                                   |
| 07   | Focused album cleared before the chosen capture moment; sleeve remained hard to read.                                                            | Measured the focused-state window and removed the completion-triggered early release.                                                                     |
| 08   | Mobile outside max zoom was fixed; album cue remained subtle because reduced-motion timing compressed the visible pose.                          | Forced no-preference motion for QA capture and kept reduced-motion behavior accessible in source.                                                         |
| 09   | Album focus still cleared before the 420 ms screenshot.                                                                                          | Removed the reduced-motion branch from the album hold duration while preserving reduced-motion tween skipping.                                            |
| 10   | Mobile post-outside album capture could navigate away after return.                                                                              | Split outside and album sequences with a fresh homepage load in the QA runner.                                                                            |
| 11   | States were stable, but album midpoint was after the measured focused window.                                                                    | Moved album mid-motion capture to 250 ms.                                                                                                                 |
| 12   | Stable pass: 2D cards, interior, outside, outside zoom, and album settled states held across desktop/mobile.                                     | No source change.                                                                                                                                         |
| 13   | Stable pass repeated with the same framing and interaction states.                                                                               | Accepted as the second consecutive stable visual pass.                                                                                                    |

Final visual read before the onsen/chair pass: the interior had a larger framed glass wall, a softer carved shell, a warmer wood desk/floor relationship, a more visible side bed cue, and stable click-only window navigation. The exterior kept the matching big window, desk/bed/record anchors through glass, layered coastal water/sand/cliff terraces, and no wheel-triggered inside/outside transition. Treat that as historical baseline, not the current completion state.

## Future Model Handoff Prompt

```text
Work in D:\dev\dylantao.github.io on the homepage 2D/3D desk, album room, and cliff-cave environment only. Use $homepage-desk-scene. Read AGENTS.md, .github/copilot-instructions.md, WEBSITE_DESIGN_HEURISTICS.md, docs/homepage-desk-scene-brief.md, _includes/home/hero.liquid, _sass/_home.scss, assets/js/home.js, and the existing home interaction tests before editing.

Start by checking git status and inspecting the live 2D, 3D interior, rear-yaw, outside, album-focus/drop, and mobile states. Record the top visible or behavioral failures against Current Priority Order, Known Inspection Targets, Non-Goals, and the Acceptance Evidence Map. Preserve current record, spin state, discovered-card order, keyboard paths, deliberate click-only inside/outside transitions, and the quiet always-visible 2D | 3D switch.

Improve the smallest coherent set of scene-owned problems. The target is a readable warm Japandi cliff-cave room whose interior and exterior are reciprocal camera states in one scene graph; four rack albums, turntable/tonearm, A4 project papers, onsen/lizard/laptop, lounge chair/ottoman, window, dropped cards, controls, and usage tag must remain understandable. Do not reintroduce a hand-matched exterior miniature. Add geometry, material, lighting, or coastal motion only when it strengthens that reading without making the scene heavy.

Do not rewrite posts, projects, general homepage narrative, global chrome, usage math, or unrelated styles. In a parallel run, reserve shared files through the coordinator and do not edit a file another agent is writing.

Iterate with comparable screenshots at 1440x1000, 1280x800, 768x1024, and 390x1000. Check light/dark when surfaces change, reduced motion and keyboard focus when interactions change, nonblank WebGL, visible drag/zoom pixel differences, console errors, overflow, and every mapped interaction state. Run the targeted checks in this brief plus the production Docker/root-site verification from AGENTS.md. Hand back exact files, before/after evidence, remaining limitations, and verification results; do not push independently.
```
