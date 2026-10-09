# From P to duh

Duh is the default companion on the human website. It is an original soft charcoal dot with small, readable eyes. P remains alive on `/projects/p/`, with its existing gesture playground, portrait renderer and credits. Its model and miniature-home adapter remain in the repository. Neither character is an assistant identity or a ChatGPT Pet.

The intent is a warmer, simpler silhouette and a few legible interactions. The site’s research content, reading order, navigation, selectable text and existing four palettes remain authoritative. This is a character experiment, not evidence of improved engagement or a visitor study.

## Architecture and motion

- `duh-motion.mjs` owns the center-body collider and gesture state. It uses fixed 1/120-second steps, at most six steps from a 50 ms input frame, a 1,600 px/s velocity ceiling, damped wall contacts and recent timestamped release samples. A stationary hold discards old throw velocity.
- `duh-portrait.mjs` draws one 96 × 96 canvas at device-pixel ratio ≤ 2. Twenty fixed-angle radii morph between dot, apple, peach, watermelon, rounded square and triangle. The `duh-body.mjs` inertial shell adds gravity sag, grip lag, direction-aware stretch and damped shaking. Its contour is area-normalized, with bounded radial dents and quadratic midpoint curves. This is an art-directed 2D approximation, not a physical material model.
- `duh-page.mjs` owns one animation-frame scheduler, pointer capture, semantic controls, clearance, invitations and decorative cleanup. It reuses P’s `choosePerch` and `clearAt` helpers. P’s motor, portrait and scene code remain separate.
- `_sass/_duh.scss` uses the existing background, text, divider and accent tokens. The charcoal silhouette stays stable; evening adds a lighter rim. Fruit stipple and rind stripes are static, not animated noise.

The six gesture states are REST, PLAY, HELD, AIRBORNE, TIDY and RETREAT. Expression, shape, pause and reduced-motion preference are separate. There is no queued animation backlog. A new deliberate drag interrupts motion immediately; cancellation never becomes a throw.

## Interaction contract

- A released click pets duh. Three close clicks produce one happy squish. Clicks never contribute to retreat.
- Three intentional releases above 850 px/s within 12 seconds arm an eight-second breather after settling. Collision impulses never count as rough throws. Reset and recall remain available throughout.
- Cursor gaze is small. An approach needs a stationary fine pointer in empty nearby space, clear reading clearance along the path, and a 12-second cooldown. A short anticipated hop stops 43 pixels from the pointer; greeting artwork is click-through. Typing, selection, scrolling, blur and hidden tabs cancel invitations.
- Reading clearance includes definition lists, standalone captions and project fact strips. Main and ancestor style/class changes invalidate the cached rectangles even when the main content keeps the same size. Every rescan cancels an active approach before choosing a new perch.
- Touch uses native scrolling by default. Move mode sets `touch-action: none` before the next touch begins. Direction buttons and Little toss provide a single-tap alternative; arrow keys move a focused duh. Escape cancels.
- The smaller duh disclosure contains Pause, Reset & invite back and Move mode. There is no shape picker or duplicate portrait. Tap/Enter pets the character; focused arrow keys move it, H invites a greeting, P pauses and R resets. A graphics failure keeps a simple dot and semantic controls.
- In empty space, duh occasionally anticipates a short hop or rolls, and spontaneously morphs through its existing fruit and primitive repertoire before returning to charcoal. These actions never count as rough throws. They wait while controls are open, while typing/selecting, and during direct play.
- Reduced motion uses immediate shapes and static expressions, with no pursuit, bounce, shake, scattered pieces or animated cleanup. Paused motion does not accumulate elapsed physics.

## Safe impacts

Swept circle/rectangle contacts use at most 160 cached surfaces, including visible paragraphs and headings. A strong hit displaces at most two actual text blocks by up to 18 pixels before settling to a smaller offset. Additive compositor translation preserves authored transforms, layout, DOM text, links and selection; text is never split or reparented. Selection immediately clears the effect. A pointer-down on a link or control freezes its current visual position through click dispatch, then restores the page so the native action keeps its target.

The project playground still marks its heavy block and up to four aria-hidden decorative words. Those words alone get pointer-transparent overlay copies. Duh then hops toward a clear nearby repair position where possible and makes two small pulling gestures as displaced text and copies return. If no clear path exists, it performs the gesture from its current perch. This is a bounded 2D illusion, not a document layout physics engine.

Reset, resize, scrolling, selection, pointer cancellation, reduced-motion changes and lifecycle changes restore every effect immediately. A new drag starts clean. Three rough releases still lead to a short retreat, with recall always available. Nothing is persisted.

## Budget and boundaries

Duh stays on the page in both the homepage's 2D and 3D modes; this release does not add a duh avatar inside the miniature. The retained scene robot does not take world ownership on ordinary pages, avoiding a duplicate default character. The Human surface gets duh; the AI surface remains motion-free.

No new runtime dependency, image download, audio, model request, camera or microphone. One small rendered canvas, a bounded contour, at most four loose decorative pieces, two displaced reading blocks, four heavy targets and 160 cached collision surfaces. Layout is measured on invalidation, not every animation frame. Hidden pages stop drawing. The idle scheduler samples at one hertz with brief blinks and spaced short character actions; paused rendering sleeps. Frame intervals are capped instead of replaying background-tab time.

P’s previous default-page tests have been replaced by duh’s current public behavior tests in `test/visual/duh.spec.js`. P’s project journeys, ownership, graphics recovery, reduced-motion and gesture tests remain in `test/visual/companion.spec.js`; its existing unit tests remain intact.

The three retained P world-adapter cases explicitly mount the legacy page controller in their test fixture. The ordinary homepage mode test checks the production boundary: one duh, no default P, and no companion on the AI surface.

The implementation follows broad motion and accessibility principles. [Position Based Dynamics](https://matthias-research.github.io/pages/publications/posBasedDyn.pdf) provides background on controlled deformation; this renderer does not implement that paper’s solver. [W3C Pointer Events](https://www.w3.org/TR/pointerevents3/#the-touch-action-css-property) informs touch-action and cancellation handling. [WCAG’s dragging-movement guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) informs the single-pointer alternatives. No proprietary character assets or source code are bundled.

## Publication route

The existing GitHub Actions `deploy.yml` builds Jekyll, purges the built CSS and publishes `_site` to `gh-pages`. GitHub Pages serves that branch at `https://dylantao.github.io/`. There is no additional Site created for this work, and no repository or website access change.
