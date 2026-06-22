# Homepage Desk Scene Brief

This brief records the intended 2D and 3D homepage desk scene so a future model or agent can rerun the same target and compare alignment.

## 2D Artifact Stain

- Use one coffee stain, not two separate marks.
- The stain sits visually on top of the two artifact cards at their right edges, as if the same cup ring crossed both paper surfaces.
- The mark should not read as a perfect circle. It should be an off-round, slightly squashed ring with broken arcs, uneven absorbed edges, darker pooled segments, soft paper bleed, and small satellite droplets.
- The stain may touch card surfaces, but card text, icons, and route affordances remain readable.
- In motion, the stain should feel like an animated design cue: quiet, handmade, and desk-like, not a decorative logo or a clean vector target.

## 3D Desk Vignette

- The desk is a small polished room vignette inside the hero media footprint, not a fullscreen model.
- High-level revamp aim for future Codex/model passes: turn the scene into a continuous 360 Japandi cliff-house environment, where the interior and exterior are two views of one house/environment rather than separate stage sets.
- The spatial contract is anchor-first: window wall, floor slab, desk, onsen pool, lounge chair corner, album shelf, roof/plinth, shell, cliff shelves, shoreline, and camera targets should share one coordinate language. If the interior window moves or scales, the exterior house window and visible room anchors must move or scale with it.
- 360 viewing is part of the design target. Dragging in 3D should orbit around the active room/exterior anchor through a full yaw range, with bounded pitch and no automatic inside/outside transition. Wheel/trackpad only explores zoom/dolly.
- Flat stand-ins should be treated as temporary failures. Albums, source cards, A4 papers, floor slab, window frame, onsen pool, lizard Sirui, lounge chair, ottoman, desk, mug, turntable, laptop, roof/plinth, and shell surfaces need visible thickness, bevels, or curved mesh geometry so orbiting does not reveal cardboard cutouts.
- Water/sand motion should read physically motivated without becoming a heavy simulation: waves advect foam, wet sand darkens near the wave reach, sand ripples/gusts move along the shoreline, and lightweight heightfield/shader motion replaces purely sliding flat planes.
- The current 3D target is a warm Japandi cliff-house nook, not a literal office desk render: carved stone/plaster side forms, a warm wood desk/floor, a small stone-clad Japanese onsen-style soaking pool, a cozy reading/work lounge corner, and a large floor-to-ceiling window wall should all read together.
- The room should feel explorable from the first view. The desk sits closer to the glass, while deeper room cues such as the onsen, lizard Sirui, chair/ottoman, stone ribs, ceiling mass, sill, and decor prevent the scene from collapsing into a flat tabletop.
- The onsen replaces the old bed cue. It should read as a small-scale soaking pool with stone cladding, warm water, steam, a cocktail ledge, and a waterproof/lap desk setup showing a tiny VS Code/Codex screen.
- Lizard Sirui should visibly relax in the onsen rather than sit as a generic prop: head, body, tail, eyes, resting arms, and water contact should make the scale and action legible.
- The lounge corner should be Herman Miller Eames Lounge Chair + Ottoman inspired, with molded wood shells, cream cushions, a black swivel/star base, and rounded 3D cushions/shells rather than flat panels.
- The table has a turntable, elegant Autodesk mug, coffee surface, a single table stain, two non-overlapping artifact cards, and four album sleeves organized in a shelf or crate.
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
- Dropped albums and song cards should feel like flat paper objects losing energy: shallow arcs, short slides, deterministic fan slots, thin card edges, and visible floor contact shadows. Avoid high bounces, hovering rest poses, or generic object-view lifts that make sleeves look like rigid blocks.
- Dropping or flicking an album should leave object-view and ease back to the full room view, so the user never gets stranded in a close crop after discovery.
- Flicking a rack sleeve while another album or card is focused must clear the previous focus as part of the drop, not leave stale `data-focused-desk-object` state behind.
- In 2D, the discovered-card pile should remain visibly paper-like after repeated drops: separated fan slots, slight elevation cues, and enough offset for individual card edges to read instead of becoming a single glossy slab.
- The 2D active/preview record should never read as a blank pale circle. Keep the CSS vinyl groove and cover-art fallback visible under the Three.js record canvas so the meme disk stays legible while WebGL is loading, subtle, or temporarily transparent.
- In 3D mode, hidden 2D portrait/card/artifact layers must not stay in the hero grid flow. The room canvas, usage note, and 3D controls should all remain visible together on laptop-height desktop viewports and mobile after switching modes; on mobile, keep the usage note above the control strip rather than letting the two overlays collide.
- The 3D usage note should behave like a compact counter overlay, not a prose caption crossing the table. Keep the commit/token/hour/tree line visible in scene, and reserve the explanatory model-damage sentence for non-3D or fuller ledger contexts.
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

Interior and exterior should read as two scales of the same cliff-house world: warm Japandi wood, soft stone/plaster, a sculptural carved-rock nook, floor-to-ceiling framed glass, sandy coastal light, and soft non-photoreal shading. The outside cutaway house should reuse the same big-window language and the same floor/stone/wood vocabulary rather than switching to a different facade style.

The grid is descriptive, not a mandate for photoreal geometry. Keep the room stylized and graphic, but preserve the stable anchors: big rear window, desk close to the glass, onsen and lounge corner deeper in the room, rear-left record shelf/turntable on the desk, front-right paper/mug work zone, and the dropped-card fan on the near floor.

## Outside Vignette

- The window should read as a floor-to-ceiling designer window with frame, sill, glass, and a view plane.
- The exterior should show the same house, not a separate miniature world: the large glass wall, desk by the window, onsen/lizard/lap-desk cue behind it, lounge corner massing, roof overhang, stone plinth, and wood/stone material language must correspond to the interior view.
- Zooming toward the window reveals a faint object-native hint, but zooming must not automatically enter or leave the room. Clicking the inside window enters outside.
- Once outside, scroll/trackpad zoom should explore the exterior view and zoom closer into the window without automatically re-entering the room; clicking the visible window/glow returns inside.
- The outside scene should be a stylized San Diego cliff-beach diorama with layered water, shoreline foam, sand, irregular cliff terraces, cliff-side house, and time-of-day lighting.
- Prefer layered terrain and shader/canvas motion over flat planes: overlapping water bands, irregular cliff shelves, foreground rocks, shore foam, sand gusts, and a narrower headland backdrop should create depth.
- In the house cutaway, lizard Sirui relaxes in the mini onsen. The lap desk/laptop sits near the pool and shows a small VS Code/Codex hint.
- The cutaway room details should be readable at the default outside camera: soften glass/glow wash, keep the onsen/lizard/laptop forward enough to see, and avoid dark pier/foundation pieces overpowering the window.
- Outside mode should keep a subtle way back inside through the house/window itself: a warm, gently pulsing interior glow plus the existing keyboard-accessible controls.
- Outside mode is scoped to the hero. If the user scrolls the hero mostly out of view, the scene should automatically return to the room state while preserving the current record, spin state, and discovered-card order.
- The interior ocean/window view plane must never be fully hidden by orbit cutaway logic. Side and rear orbit angles may fade the glass/recess, but the coastal view should remain visible enough to preserve the room/exterior continuity.

## WebGL / Three.js Direction

- Keep the core scene in Three.js and use generated canvas textures for painterly material detail: floorboards, ocean foam, sand, cliff striation, onsen water/steam cues, laptop screen, chair wood/cushion surfaces, and record labels.
- Favor cheap GPU motion before adding heavier simulation: scrolling texture offsets, small mesh bobbing, and eased object arcs already give ocean/sand/card motion without a particle system.
- The outside view uses texture-offset ocean/foam motion, transparent sand-gust planes, small instanced shoreline glints, and low-resolution shader overlays for foam/sand shimmer near the beach. This should read as living coastal motion while staying cheap and only animating outside mode.
- The current implementation also uses repeated simple mesh primitives for the house, cliff shelves, stone ribs, and roof/floor framing. Future work should improve these with better shared anchors and materials before introducing a heavy asset pipeline.
- The desk view uses a tiny instanced glint mesh on record/card/mug surfaces. Keep this as a single low-cost GPU accent that only animates while the scene is spinning, focused, hovered, or already tweening.
- Next valuable additions would be depth-aware dust/glisten accents or a physically richer water shader if it clearly improves the current lightweight shader-overlay stack. Avoid full fluid simulation unless it replaces the existing canvas-texture, shader-overlay, and instanced-accent motion with a clearly better, still-fast effect.
- Keep renderer pixel ratio capped and animate only when visible, spinning, moving, or outside textures are active.

## Acceptance Checklist

- One visible coffee stain, organic and non-circular, not clipped, readable on light and dark themes.
- 3D canvas prewarms, renders nonblank, and drag/zoom produce visible pixel changes.
- The bed is gone from the active interior/exterior cue. The onsen, lizard Sirui, cocktail ledge, lap desk, warm water, and steam read at default and closer views.
- The lounge chair and ottoman read as an Eames-inspired 3D object with molded wood, cream cushions, and black base, not as flat rectangles.
- Four albums are in an organized shelf; discovered song cards settle on the floor in the same order as the 2D pile.
- Album click, card focus, 2D shake discovery, 3D album flick discovery, album-drop room return, scroll-back, reset, window jump, and outside return all work.
- Inside wheel/trackpad zoom never auto-enters outside; outside wheel/trackpad zoom never auto-enters inside. Window clicks are the deliberate mode switch.
- 2D dropped meme discoveries read as compact album/source cards; only the 3D project artifacts read as A4 papers.
- Mobile keeps the scene usable without cropping the window, controls, or artifact focus states.
- For the onsen/chair layout, a passing default view shows the onsen as a left-midground pool and the Eames-inspired chair/ottoman as a smaller back-right reading/work corner, with neither object colliding with the desk controls.

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
