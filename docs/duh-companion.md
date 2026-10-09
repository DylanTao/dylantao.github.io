# From P to duh

Duh is the default companion on the human website. It is an original soft charcoal dot with small, readable eyes. P remains alive on `/projects/p/`, with its existing gesture playground, portrait renderer and credits. Its model and miniature-home adapter remain in the repository. Neither character is an assistant identity or a ChatGPT Pet.

The intent is a warmer, simpler silhouette and a few legible interactions. The site’s research content, reading order, navigation, selectable text and existing four palettes remain authoritative. This is a character experiment, not evidence of improved engagement or a visitor study.

## Architecture and motion

- `duh-motion.mjs` owns the center-body collider and gesture state. It uses fixed 1/120-second steps, at most six steps from a 50 ms input frame, a 1,600 px/s velocity ceiling, damped wall contacts and recent timestamped release samples. A stationary hold discards old throw velocity.
- `duh-portrait.mjs` draws one 96 × 96 canvas at device-pixel ratio ≤ 2. Twenty fixed-angle radii morph between dot, apple, peach, watermelon, rounded square and triangle. The `duh-body.mjs` inertial shell adds gravity sag, grip lag, direction-aware stretch and damped shaking. Its contour is area-normalized, with bounded radial dents and quadratic midpoint curves. This is an art-directed 2D approximation, not a physical material model.
- `duh-page.mjs` owns one animation-frame scheduler, pointer capture, semantic controls, clearance, invitations and decorative cleanup. It reuses P’s `choosePerch` and `clearAt` helpers. P’s motor, portrait and scene code remain separate.
- `duh-viewport.mjs` checks nearby obstacle edges when inherited perch rows miss a narrow phone gap.
- `_sass/_duh.scss` uses the existing background, text, divider and accent tokens. The charcoal silhouette stays stable; evening adds a lighter rim. Fruit stipple and rind stripes are static, not animated noise.

The six gesture states are REST, PLAY, HELD, AIRBORNE, TIDY and RETREAT. Expression, shape, pause and reduced-motion preference are separate. There is no queued animation backlog. A new deliberate drag interrupts motion immediately; cancellation never becomes a throw.

## Interaction contract

- A released click pets duh. Three close clicks produce one happy squish. Clicks never contribute to retreat.
- Three intentional releases above 850 px/s within 12 seconds arm an eight-second breather after settling. Collision impulses never count as rough throws. Reset and recall remain available throughout.
- Cursor gaze is small. An approach needs a stationary fine pointer in empty nearby space, clear reading clearance along the path, and a 12-second cooldown. A short anticipated hop stops 43 pixels from the pointer; greeting artwork is click-through. Typing, selection, scrolling, blur and hidden tabs cancel invitations.
- Reading clearance includes definition lists, standalone captions and project fact strips. Main and ancestor style/class changes invalidate the cached rectangles even when the main content keeps the same size. A rescan preserves the current position and any still-clear path. Only newly blocked routes cancel an approach; a necessary relocation glides with a bounded speed while yielding pointer input over reading and remaining grabbable in clear space. Returning from a pet or retreat does not reset position. P's moving project character is excluded from the static obstacle cache; the playground's actual caption remains protected reading.
- The fixed corner panel is removed. The character itself is a semantic button: tap/Enter pets or wakes it, a stationary 700 ms hold pauses, Shift-click or R resets in place, P pauses, H greets, T tosses and arrows move. Alt + Shift + D recalls and focuses it from anywhere. Its native tooltip, accessible description and project explanation describe the actions.
- Touch drags directly inside the 56-pixel character target; the surrounding page scrolls normally. Double-tap followed by a tap on a clear nearby space moves without dragging, never consuming a native link action. Escape cancels. The existing project invitation resets and recalls it to the play corner. A graphics failure retains the button and a simple dot.
- A retreat becomes a small tucked pose at the departure point. Tap it to return early; automatic return expands in the same place.
- In empty space, duh occasionally anticipates a short hop or rolls, and spontaneously morphs through its existing fruit and primitive repertoire before returning to charcoal. These actions never count as rough throws. They wait while typing/selecting and during direct play. Travel duration follows distance; a minimum-jerk curve gives anticipation, acceleration and a soft landing. Eyes lead an excursion, widen in flight, ease into giggles and close for sleep. Ground flattening fades out in flight. The separate contact shadow grows and fades with height over its landing plane.
- Reduced motion uses immediate shapes and static expressions, with no pursuit, bounce, shake, scattered pieces or animated cleanup. Paused motion does not accumulate elapsed physics.

## Safe impacts

Swept circle/rectangle contacts use at most 160 cached surfaces, including individual ink-line bounds from eligible short paragraphs, headings and list items. Nested text blocks own their contact; long columns stay still. A strong hit moves text by at most four pixels and 0.35 degrees; an off-center heavy-object hit travels at most three pixels and rocks by up to 1.8 degrees. At most three nodes react, with a damped oscillation and small residue for Duh to repair. Additive compositor translation preserves authored transforms, layout, DOM text, links and selection; text is never split or reparented. Selection immediately clears the effect. A pointer-down on a link or control freezes its current visual position through click dispatch, then restores the page so the native action keeps its target.

The project playground still marks its heavy block and up to four aria-hidden decorative words. Those words alone get pointer-transparent overlay copies. Duh then hops toward a clear nearby repair position where possible and makes two small pulling gestures as displaced text and copies return. If no clear path exists, it performs the gesture from its current perch. This is a bounded 2D illusion, not a document layout physics engine.

Reset, resize, scrolling, selection, pointer cancellation, reduced-motion changes and lifecycle changes restore every effect immediately. A new drag starts clean. Three rough releases still lead to a short retreat, with recall always available. Nothing is persisted.

## Budget and boundaries

Duh stays on the page in both the homepage's 2D and 3D modes; this release does not add a duh avatar inside the miniature. The retained scene robot does not take world ownership on ordinary pages, avoiding a duplicate default character. The Human surface gets duh; the AI surface remains motion-free.

No new runtime dependency, image download, audio, model request, camera or microphone. One small rendered canvas, a bounded contour, at most four loose decorative pieces, three displaced nodes, four heavy targets and 160 cached collision surfaces. Layout is measured on invalidation, not every animation frame. Hidden pages stop drawing. The idle scheduler samples at one hertz with brief blinks and spaced short character actions; paused rendering sleeps. Frame intervals are capped instead of replaying background-tab time.

P’s previous default-page tests have been replaced by duh’s current public behavior tests in `test/visual/duh.spec.js`. P’s project journeys, ownership, graphics recovery, reduced-motion and gesture tests remain in `test/visual/companion.spec.js`; its existing unit tests remain intact.

The three retained P world-adapter cases explicitly mount the legacy page controller in their test fixture. The ordinary homepage mode test checks the production boundary: one duh, no default P, and no companion on the AI surface.

The implementation follows broad motion and accessibility principles. [Position Based Dynamics](https://matthias-research.github.io/pages/publications/posBasedDyn.pdf) provides background on controlled deformation; this renderer does not implement that paper’s solver. [W3C Pointer Events](https://www.w3.org/TR/pointerevents3/#the-touch-action-css-property) informs touch-action and cancellation handling. [WCAG’s dragging-movement guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) informs the single-pointer alternatives. No proprietary character assets or source code are bundled.

## Adjacent homepage motion

The existing coastal house stays an independent 3D scene. Its camera now uses analytic critically damped coordinates, preserving velocity when orbit, zoom or a destination changes. Reduced motion composes the target immediately; pause/visibility stops residual camera velocity, and the existing room clearance bounds cancel velocity at a constraint. This is a focused camera refinement, not a new scene, new lighting system or asset rebuild. The original shared homepage controller, authored avatars, renderer and album state remain intact.

## Publication route

The existing GitHub Actions `deploy.yml` builds Jekyll, purges the built CSS and publishes `_site` to `gh-pages`. GitHub Pages serves that branch at `https://dylantao.github.io/`. There is no additional Site created for this work, and no repository or website access change.

## Companion and scene refinement

Duh now uses its deformed contour to place the contact shadow; lift widens and fades the same shadow on its departure plane. Warmth after petting and cooler curiosity ease with the eyes and body. The peach has a two-lobed silhouette, central seam, blush and short stem, while apple speckles and watermelon rind keep the fruit distinct at small sizes.

The four existing scene surfaces were inspected separately:

| Surface                                  | Scoped refinement                                                                                                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homepage album, shared with the 3D study | Keep the driven platter and lift-before-swing tonearm. Bound phase checks to 240 after slow frames; settled mechanisms use one analytic step. Repeated cues retain position and velocity.                               |
| Coastal cave home                        | Analytic critical damping retains camera velocity when navigation reverses, then settles without oscillation. Pause and reduced motion clear momentum.                                                                  |
| Scroll-revealed footer coast             | Buildings and pointer parallax retain velocity through reversals. Floating surfers use the same wave heights and analytic slopes as the water shader; analytic normals replace repeated finite-difference wave samples. |
| Little La Jolla                          | Orbit targets ease with momentum through keyboard and pointer changes. Reduced motion composes the requested view immediately. Reused vectors avoid per-frame orbit allocations.                                        |

The authored models, album state, landmark names, source attribution, lazy loading, theme lighting and 30 fps footer budget are retained. These are refinements of the site's existing browser scenes, not offline film rendering.

## Mobile viewport and touch contract

The character, pointer samples and DOM collision rectangles use layout-viewport CSS coordinates. VisualViewport offsets, visible dimensions and CSS safe-area insets define the usable bounds. A browser-bar resize updates those bounds without canceling capture or immediately clamping the character. Ordinary scrolling freezes Duh in place and makes it faint and pointer-transparent; after a short quiet interval, it keeps a clear position or glides to the nearest available space. It never swaps visible coordinates to recover. Paused and reduced-motion reading retains the position and quietly hides an obstructed pose.

Only the 56-pixel character button uses touch-action none and disables callout/selection. The page retains native scrolling and text selection. Pointer capture survives viewport updates, coalesced samples keep the hand motion, duplicate samples are ignored, and the release point completes the velocity estimate. The throw speed limit scales down with phone width. Cancellation, a second pointer, blur and leaving the page clear a gesture without launching a throw. Keyboard reset and the existing project invitation remain available.

Viewport behavior follows the [VisualViewport API](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) and local gesture handling follows [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events). Browser emulation covers viewport changes and Chromium native touch injection. WebKit's test driver supplies native taps and pointer capture, but does not expose a native touch-drag API; a physical iPhone remains a separate validation surface.
