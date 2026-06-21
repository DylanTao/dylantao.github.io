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
- The table has a turntable, elegant Autodesk mug, coffee surface, a single table stain, two non-overlapping artifact cards, and four album sleeves organized in a shelf or crate.
- Albums are object-native controls. Clicking one should focus it as a leaning "now playing" sleeve near the turntable, update the record label, and start the meme vinyl spinning. Dragging or flicking can scatter an album and reveal a small song card.
- Album rack hit targets should follow the visible left-to-right sleeve order, including while another sleeve is focused; dropped/empty rack slots must not remain clickable.
- Thrown or dropped albums are floor evidence, not record-replacement controls. Picking must ignore hidden rack proxies and thrown album entries, and a click on a visible rack sleeve should replace the currently focused sleeve instead of reselecting the enlarged now-playing album.
- The focused "now playing" album should read as a sleeve propped on a small desk/easel ledge near the turntable, with a front-facing pose and enough room context still visible. Replacement clicks should favor nearby visible rack sleeves over the enlarged focused sleeve so the interaction feels like swapping records, not fighting the hitbox.
- On desktop, the focused sleeve should separate from the rack and read as the featured now-playing object: larger than rack sleeves, slightly forward/right on the easel, and nearly front-facing. Mobile can keep a tighter pose so the sleeve does not crowd the controls or window.
- Artifact cards are object-native controls. First activation lifts the selected card to a readable front-facing angle; second activation or keyboard confirmation opens the project link.
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
|  W W W       window: four-pane frame, thick sill, warm wood trim
|  W W W       outside view: same horizon, ocean, sand/cliff palette
|
|  [albums] [turntable]        rear-left desk zone
|
|        [paper cards] [mug]   front-right working zone
|
|  dropped meme cards          floor in front of desk, compact fan stack with contact shadows
+--------------------------------------------------------------> +x
```

Interior and exterior should read as two scales of the same hut/desk world: warm wood framing, lightly gridded floor/wall board textures, four-pane windows, sandy coastal light, and soft non-photoreal shading. The outside cutaway house should reuse the four-pane window language and the same generated floor/wall texture vocabulary rather than switching to a different facade style.

The grid is descriptive, not a mandate for photoreal geometry. Keep the room stylized and graphic, but preserve the stable anchors: rear window, rear-left record shelf/turntable, front-right paper/mug work zone, and the dropped-card fan on the near floor.

## Outside Vignette

- The window should read as a real window with frame, sill, glass, and a view plane.
- Zooming toward the window reveals a faint object-native jump affordance. The outside scene should be a stylized San Diego cliff-beach diorama with ocean, beach, cliff-side house, and time-of-day lighting.
- In the house cutaway, Sirui sleeps sideways. The laptop sits next to Sirui's head and shows a small VS Code/Codex hint. The blanket has a cute cartoon cat pattern.
- The cutaway room details should be readable at the default outside camera: soften glass/glow wash, keep the bed/head/laptop forward enough to see, and avoid dark pier/foundation pieces overpowering the window.
- Outside mode should keep a subtle way back inside through the house/window itself: a warm, gently pulsing interior glow plus the existing keyboard-accessible controls.

## WebGL / Three.js Direction

- Keep the core scene in Three.js and use generated canvas textures for painterly material detail: floorboards, ocean foam, sand, cliff striation, blanket pattern, laptop screen, and record labels.
- Favor cheap GPU motion before adding heavier simulation: scrolling texture offsets, small mesh bobbing, and eased object arcs already give ocean/sand/card motion without a particle system.
- The outside view uses texture-offset ocean/foam motion, transparent sand-gust planes, small instanced shoreline glints, and low-resolution shader overlays for foam/sand shimmer near the beach. This should read as living coastal motion while staying cheap and only animating outside mode.
- The desk view uses a tiny instanced glint mesh on record/card/mug surfaces. Keep this as a single low-cost GPU accent that only animates while the scene is spinning, focused, hovered, or already tweening.
- Next valuable additions would be depth-aware dust/glisten accents or a physically richer water shader if it clearly improves the current lightweight shader-overlay stack. Avoid full fluid simulation unless it replaces the existing canvas-texture, shader-overlay, and instanced-accent motion with a clearly better, still-fast effect.
- Keep renderer pixel ratio capped and animate only when visible, spinning, moving, or outside textures are active.

## Acceptance Checklist

- One visible coffee stain, organic and non-circular, not clipped, readable on light and dark themes.
- 3D canvas prewarms, renders nonblank, and drag/zoom produce visible pixel changes.
- Four albums are in an organized shelf; discovered song cards settle on the floor in the same order as the 2D pile.
- Album click, card focus, 2D shake discovery, 3D album flick discovery, album-drop room return, scroll-back, reset, window jump, and outside return all work.
- Mobile keeps the scene usable without cropping the window, controls, or artifact focus states.
