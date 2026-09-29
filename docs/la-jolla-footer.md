# La Jolla, beside Connect and across the footer

Sirui's September 14 plan places a compressed coastal miniature on a translucent atlas beside Connect, with a related landscape filling the bottom of human reading pages. The larger viewer and process live at `/projects/la-jolla/`; the Projects index includes its own card. On mobile the Connect miniature follows the text. AI profiles, redirects, and the secret globe remain undecorated.

## Composition and provenance

The composition brings together DIB's folded glass bays, Geisel Library, Salk's courtyard, Scripps Pier, the Cove, cliff villas, Spanish houses, palms, tennis, volleyball, surfers, and beach life. It deliberately compresses landmark distances. The map below uses actual OpenStreetMap coastline and roads, with a translucent feathered edge and OpenStreetMap/ODbL attribution. It is not a geographically accurate model of building locations.

Coordinated generated front/back studies were passed through a local Hunyuan3D-2mv shape reconstruction. The raw mesh and its actual Blender clay render are retained. Its softened architectural details made it a shape study; the production architecture is deliberately authored in Blender. Source images retain actual `gpt-image` version `2.0` C2PA metadata. Sources, licenses, editable `.blend` files, downloads, and reconstruction details are recorded in [provenance](../artwork/la-jolla/PROVENANCE.md).

## Light, activity, and reveal

The follow-up separates the compositions: Connect centers Geisel and Salk, with a smaller DIB campus, Torrey pines and a rocky Cove. The footer is a continuous seaside neighborhood with villas, houses, DIB and courts. Its wider composition now includes placed Geisel and Salk instances on the campus side, and Brockton Villa, La Valencia and the Children�s Pool seawall on the village side. The compact atlas retains its separate composition, sharing the refined campus architecture. Mainland and beach extend to ±38 units, beyond the camera edges. The tennis court has a retaining foundation; Geisel has a buried podium, central core and paired concrete buttresses. DIB has five folded bays, with the office in bay three at the third floor, plus landward cladding, a gallery and an external stair informed by Sirui's additional photographs. The atlas has an irregular blurred SVG mask and an element mask that fades before the rotated image reaches its crop boundary.

Both scenes follow the selected site theme. The footer moves from quiet morning to midday surfing and courts, warm afternoon activity, then an evening bonfire with parked boards and lit windows. The campus miniature keeps its quieter Cove and courtyard composition, with surfing during the day and illuminated windows at night. The DIB third-floor office lights from noon onward and on a stable subset of nights. This is a personal vignette, not live occupancy information.

Terrain is always present. The first live frame keeps the preview's complete composition; downloading the model must not shrink the coast or restart a building entrance. After an upward scroll, building groups lower and emerge left to right according to footer visibility on subsequent passes. There is no scroll interception. The coast fills the viewport width and reaches the bottom edge; copyright sits quietly inside it. Sirui removed the al-folio credit, update date, and separate lighting/motion controls.

On wide displays, the camera expands sideways while retaining at least 13 world units of vertical clearance. Palm crowns and the DIB roof stay inside the frame as the footer becomes a shorter panorama. The outer shoreline carries recognizable architecture researched from map outlines, satellite views, official building plans and photographs. Repeated generic trees and copied houses no longer fill the sides. Low approach terraces, reading benches, porch tables, warm windows and flowering pots connect the landmarks to the neighborhood. The Connect miniature keeps its own camera and geometry. Homepage content grows to 2240 px on a 4K display, while the section rail stays near the left edge and moves or hides before reaching the footer.

Reveal, camera settling, and authored motion use active elapsed time instead of a per-frame time cap. Exponential easing keeps the response consistent when frames are slow. Offscreen and hidden-page recovery reset the clock, so suspension does not advance the vignette. Browser reversal checks place the page at the reveal boundary before measuring the response; they do not include the separate page-level smooth-scroll duration.

The customized footer uses `footer_fixed: false`. The previous fixed-footer branch left a masked band and a separate bottom gap even when the scene itself measured full width. Acceptance now checks the actual bottom edge and absence of that mask, as well as width.

The Connect and project miniatures allow gentle bounded orbit with dragging or arrow keys; Home resets the view. On narrow screens, the footer permits horizontal exploration across both landmark wings while vertical touch gestures retain page scrolling. Left/right arrow keys pan, and Home returns to the studio and beach. Reduced motion keeps a composed still view and deliberate camera interaction. Offscreen and hidden-document render loops stop.

## Implementation and budgets

- `_includes/la-jolla-miniature.liquid`, `_includes/la-jolla-footer.liquid`, `_sass/_footer-coast.scss`, and `_includes/footer.liquid` own integration and layout.
- `assets/js/footer-coast/entry.mjs` imports the renderer near visibility (450 px), using its content-versioned URL from the page. `assets.mjs` shares decoder, model resources, and geometry; instances have their own materials and light/activity state.
- `scene.mjs` uses the existing pinned Three.js stack, studio reflections, soft sun shadows, bounded contact occlusion, and authored water/plant/character motion. It caps device pixel density at 1.5 and animation at approximately 30 fps.
- `panorama.mjs` extends only the footer instance�s outer terrain. The architecture, veranda, seawall and seals are authored and batched in Blender. Its cloned geometries are disposed with that instance; the miniature's shared model remains unchanged.
- `bin/build_la_jolla.py`, `coastal_landmarks.py`, `coastal_campus.py`, `coastal_panorama.py`, and `build_la_jolla_miniature.py` retain editable sources. Repeated authoring primitives reuse finished shapes with independent mesh data before batching, avoiding repeated Blender scene updates. The two compressed GLBs total about 1.6 MB; geometry, atlas, and every poster variant total about 2.7 MB, below the approximate 4 MB combined asset target. Concept boards and the raw reconstruction are downloads, not initial scene resources.
- `bin/render_coast_posters.cjs` captures the actual runtime camera, extended panorama, materials, and all four themes. The coast has a wide still and a narrow DIB-centered still; both miniature sizes share a fixed-width still. The responsive crop follows the live camera, including the tablet's minimum world width. The wide still includes extra sky and water for those taller frames. Twelve WebP files total about 710 KB; a visitor loads only the applicable view and theme. Regenerate all variants together: the wide noon still supplies their shared cache version. The original Blender renders remain authoring/process assets.
- The composed still remains visible without JavaScript, WebGL, or successful model decoding. The entry module selects its theme without importing the renderer. Once a complete frame is drawn, it appears underneath the still, which fades away over 240 ms. Reduced motion switches directly. Graphics failure restores the still immediately; context recovery draws before announcing readiness. There are no controls for unavailable graphics.

## Verification

`test/visual/footer-coast.spec.js` covers four themes, full viewport width, nonblank and changing pixels, lazy loading, automatic activity, reversible reveal, offscreen recovery, keyboard and touch orbit, native vertical scrolling, reduced motion, context loss, and failed-model/no-JavaScript fallbacks. Loading checks hold the real model request, compare the still to the first complete frame at the four standard viewports plus 4K, and sample the animated handoff to reject a blank canvas or collapsing buildings. Use one owned server and one worker during review.

```powershell
$env:NO_WEBSERVER='1'
$env:VISUAL_BASE_URL='http://127.0.0.1:8080'
npx.cmd playwright test --config test/visual/public.config.js footer-coast.spec.js --workers 1
```

Current captures, measurements, corrected defects, and limitations live in [the refinement evidence](evidence/coastal-refinement-2026-09-14/README.md). Local mobile emulation is not a physical-phone benchmark. Browser behavior and a successful model load do not establish film-quality art direction.
