# La Jolla, beside Connect and across the footer

Sirui's September 14 plan places a compressed coastal miniature on a translucent atlas beside Connect, with a related landscape filling the bottom of human reading pages. The larger viewer and process live at `/projects/la-jolla/`; the Projects index includes its own card. On mobile the Connect miniature follows the text. AI profiles, redirects, and the secret globe remain undecorated.

## Composition and provenance

The composition brings together DIB's folded glass bays, Geisel Library, Salk's courtyard, Scripps Pier, the Cove, cliff villas, Spanish houses, palms, tennis, volleyball, surfers, and beach life. It deliberately compresses landmark distances. The map below uses actual OpenStreetMap coastline and roads, with a translucent feathered edge and OpenStreetMap/ODbL attribution. It is not a geographically accurate model of building locations.

Coordinated generated front/back studies were passed through a local Hunyuan3D-2mv shape reconstruction. The raw mesh and its actual Blender clay render are retained. Its softened architectural details made it a shape study; the production architecture is deliberately authored in Blender. Source images retain actual `gpt-image` version `2.0` C2PA metadata. Sources, licenses, editable `.blend` files, downloads, and reconstruction details are recorded in [provenance](../artwork/la-jolla/PROVENANCE.md).

## Light, activity, and reveal

Both scenes follow the selected site theme: quiet morning; midday surfing and courts; warm afternoon activity; evening bonfire, parked boards, and lit windows. The DIB third-floor office lights from noon onward and on a stable subset of nights. This is a personal vignette, not live occupancy information.

Terrain is always present. Building groups emerge left to right according to footer visibility, and lower again when scrolling up. There is no scroll interception. The coast fills the viewport width and reaches the bottom edge; copyright sits quietly inside it. Sirui removed the al-folio credit, update date, and separate lighting/motion controls.

Reveal, camera settling, and authored motion use active elapsed time instead of a per-frame time cap. Exponential easing keeps the response consistent when frames are slow. Offscreen and hidden-page recovery reset the clock, so suspension does not advance the vignette. Browser reversal checks place the page at the reveal boundary before measuring the response; they do not include the separate page-level smooth-scroll duration.

The customized footer uses `footer_fixed: false`. The previous fixed-footer branch left a masked band and a separate bottom gap even when the scene itself measured full width. Acceptance now checks the actual bottom edge and absence of that mask, as well as width.

The Connect and project miniatures allow gentle bounded orbit with dragging or arrow keys; Home resets the view. On narrow screens, the footer permits horizontal exploration while vertical touch gestures retain page scrolling. Reduced motion keeps a composed still view and deliberate camera interaction. Offscreen and hidden-document render loops stop.

## Implementation and budgets

- `_includes/la-jolla-miniature.liquid`, `_includes/la-jolla-footer.liquid`, `_sass/_footer-coast.scss`, and `_includes/footer.liquid` own integration and layout.
- `assets/js/footer-coast/entry.mjs` imports the renderer near visibility (450 px). `assets.mjs` shares decoder, model resources, and geometry; instances have their own materials and light/activity state.
- `scene.mjs` uses the existing pinned Three.js stack, studio reflections, soft sun shadows, bounded contact occlusion, and authored water/plant/character motion. It caps device pixel density at 1.5 and animation at approximately 30 fps.
- `bin/build_la_jolla.py`, `coastal_landmarks.py`, and `build_la_jolla_miniature.py` retain editable sources. The two compressed GLBs total about 2 MB; geometry, atlas, and posters remain below the approximate 4 MB combined asset target. Concept boards and the raw reconstruction are downloads, not initial scene resources.
- The actual Blender poster remains visible without JavaScript, WebGL, or successful model decoding. Context recovery restores current theme and camera state. There are no controls for unavailable graphics.

## Verification

`test/visual/footer-coast.spec.js` covers four themes, full viewport width, nonblank and changing pixels, lazy loading, automatic activity, reversible reveal, offscreen recovery, keyboard and touch orbit, native vertical scrolling, reduced motion, context loss, and failed-model/no-JavaScript fallbacks. Use one owned server and one worker during review.

```powershell
$env:NO_WEBSERVER='1'
$env:VISUAL_BASE_URL='http://127.0.0.1:8080'
npx.cmd playwright test --config test/visual/public.config.js footer-coast.spec.js --workers 1
```

Current captures, measurements, corrected defects, and limitations live in [the refinement evidence](evidence/coastal-refinement-2026-09-14/README.md). Local mobile emulation is not a physical-phone benchmark. Browser behavior and a successful model load do not establish film-quality art direction.
