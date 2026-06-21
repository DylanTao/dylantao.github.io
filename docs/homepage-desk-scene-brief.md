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
- The current 3D target is a warm Japandi cliff-house nook, not a literal office desk render: carved stone/plaster side forms, a warm wood desk/floor, a low bed deeper in the room, and a large floor-to-ceiling window wall should all read together.
- The room should feel explorable from the first view. The desk sits closer to the glass, while deeper room cues such as bed, stone ribs, ceiling mass, sill, and decor prevent the scene from collapsing into a flat tabletop.
- The table has a turntable, elegant Autodesk mug, coffee surface, a single table stain, two non-overlapping artifact cards, and four album sleeves organized in a shelf or crate.
- Albums are object-native controls. Clicking one should focus it as a leaning "now playing" sleeve near the turntable, update the record label, and start the meme vinyl spinning. Dragging or flicking can scatter an album and reveal a small song card.
- Album rack hit targets should follow the visible left-to-right sleeve order, including while another sleeve is focused; dropped/empty rack slots must not remain clickable.
- Thrown or dropped albums are floor evidence, not record-replacement controls. Picking must ignore hidden rack proxies and thrown album entries, and a click on a visible rack sleeve should replace the currently focused sleeve instead of reselecting the enlarged now-playing album.
- The focused "now playing" album should read as a sleeve propped on a small desk/easel ledge near the turntable, with a front-facing pose and enough room context still visible. Replacement clicks should favor nearby visible rack sleeves over the enlarged focused sleeve so the interaction feels like swapping records, not fighting the hitbox.
- On desktop, the focused sleeve should separate from the rack and read as the featured now-playing object: larger than rack sleeves, slightly forward/right on the easel, and nearly front-facing. Mobile can keep a tighter pose so the sleeve does not crowd the controls or window.
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
|  [low bed]                  deeper warm Japandi room zone
|
|  [albums] [turntable]        desk pulled closer to the window
|
|        [paper cards] [mug]   front-right working zone
|
|  dropped meme cards          floor in front of desk, compact fan stack with contact shadows
+--------------------------------------------------------------> +x
```

Interior and exterior should read as two scales of the same cliff-house world: warm Japandi wood, soft stone/plaster, a sculptural carved-rock nook, floor-to-ceiling framed glass, sandy coastal light, and soft non-photoreal shading. The outside cutaway house should reuse the same big-window language and the same floor/stone/wood vocabulary rather than switching to a different facade style.

The grid is descriptive, not a mandate for photoreal geometry. Keep the room stylized and graphic, but preserve the stable anchors: big rear window, desk close to the glass, bed deeper in the room, rear-left record shelf/turntable on the desk, front-right paper/mug work zone, and the dropped-card fan on the near floor.

## Outside Vignette

- The window should read as a floor-to-ceiling designer window with frame, sill, glass, and a view plane.
- The exterior should show the same house, not a separate miniature world: the large glass wall, desk by the window, low bed behind it, roof overhang, stone plinth, and wood/stone material language must correspond to the interior view.
- Zooming toward the window reveals a faint object-native hint, but zooming must not automatically enter or leave the room. Clicking the inside window enters outside.
- Once outside, scroll/trackpad zoom should explore the exterior view and zoom closer into the window without automatically re-entering the room; clicking the visible window/glow returns inside.
- The outside scene should be a stylized San Diego cliff-beach diorama with layered water, shoreline foam, sand, irregular cliff terraces, cliff-side house, and time-of-day lighting.
- Prefer layered terrain and shader/canvas motion over flat planes: overlapping water bands, irregular cliff shelves, foreground rocks, shore foam, sand gusts, and a narrower headland backdrop should create depth.
- In the house cutaway, Sirui sleeps sideways. The laptop sits next to Sirui's head and shows a small VS Code/Codex hint. The blanket has a cute cartoon cat pattern.
- The cutaway room details should be readable at the default outside camera: soften glass/glow wash, keep the bed/head/laptop forward enough to see, and avoid dark pier/foundation pieces overpowering the window.
- Outside mode should keep a subtle way back inside through the house/window itself: a warm, gently pulsing interior glow plus the existing keyboard-accessible controls.
- Outside mode is scoped to the hero. If the user scrolls the hero mostly out of view, the scene should automatically return to the room state while preserving the current record, spin state, and discovered-card order.

## WebGL / Three.js Direction

- Keep the core scene in Three.js and use generated canvas textures for painterly material detail: floorboards, ocean foam, sand, cliff striation, blanket pattern, laptop screen, and record labels.
- Favor cheap GPU motion before adding heavier simulation: scrolling texture offsets, small mesh bobbing, and eased object arcs already give ocean/sand/card motion without a particle system.
- The outside view uses texture-offset ocean/foam motion, transparent sand-gust planes, small instanced shoreline glints, and low-resolution shader overlays for foam/sand shimmer near the beach. This should read as living coastal motion while staying cheap and only animating outside mode.
- The current implementation also uses repeated simple mesh primitives for the house, cliff shelves, stone ribs, and roof/floor framing. Future work should improve these with better shared anchors and materials before introducing a heavy asset pipeline.
- The desk view uses a tiny instanced glint mesh on record/card/mug surfaces. Keep this as a single low-cost GPU accent that only animates while the scene is spinning, focused, hovered, or already tweening.
- Next valuable additions would be depth-aware dust/glisten accents or a physically richer water shader if it clearly improves the current lightweight shader-overlay stack. Avoid full fluid simulation unless it replaces the existing canvas-texture, shader-overlay, and instanced-accent motion with a clearly better, still-fast effect.
- Keep renderer pixel ratio capped and animate only when visible, spinning, moving, or outside textures are active.

## Acceptance Checklist

- One visible coffee stain, organic and non-circular, not clipped, readable on light and dark themes.
- 3D canvas prewarms, renders nonblank, and drag/zoom produce visible pixel changes.
- Four albums are in an organized shelf; discovered song cards settle on the floor in the same order as the 2D pile.
- Album click, card focus, 2D shake discovery, 3D album flick discovery, album-drop room return, scroll-back, reset, window jump, and outside return all work.
- Inside wheel/trackpad zoom never auto-enters outside; outside wheel/trackpad zoom never auto-enters inside. Window clicks are the deliberate mode switch.
- 2D dropped meme discoveries read as compact album/source cards; only the 3D project artifacts read as A4 papers.
- Mobile keeps the scene usable without cropping the window, controls, or artifact focus states.
