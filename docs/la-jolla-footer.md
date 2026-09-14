# A small La Jolla at the end of the page

Sirui requested a coastal counterpart to a miniature city that rises into a website footer. This site-owned component follows the reading flow on human pages and keeps the existing copyright, al-folio credit, update date, and mobile return link. It adds no repeated navigation link row. AI profiles, redirects, and the secret globe remain undecorated.

## Composition

A long sandstone shore ties together an arcaded cliff villa, tiled Spanish cottages, palms, an open-air tennis court, beach volleyball, parasols, surfers, and the Design and Innovation Building. The DIB is distinguished by four projecting glass bays, narrow mullions, dark folded sides, two lower horizontal floors, and a solid end volume. The user's marked third-floor corner has a separate warm emissive pane and a small local light. Its switch is an authored detail, never a claim about actual occupancy.

This is a personal collage of places, not a map. The source photos identify the DIB and the window; they do not imply that the DIB is on the beach. Models and inspiration boundaries are documented in [asset provenance](../artwork/la-jolla/PROVENANCE.md).

## Rendering and motion

- Actual Blender geometry and one compressed GLB; a generated reflection studio, soft directional shadows, restrained ambient contact shadows, and the site's four visitor-local/manual themes.
- Ocean geometry with changing surface normals, shallow-water color, broken foam, and a feathered seaward edge. Water, plant motion, and surfer movement are bounded authored effects, not a fluid or collision solver.
- A small arrival movement settles as the reader reaches the scene. There is no scroll interception, sticky stage, continuous rise/fall loop, or page background image.
- Surfers move as complete figures. Palm crowns pivot at their own trunks. Motion runs at most 30 frames per second, stops offscreen/in hidden documents, and composes a still scene under reduced motion.
- Narrow screens frame the studio more closely. Horizontal swipes or focused Left/Right arrow keys visit the coastline. Vertical swipes retain ordinary page scrolling. The studio-light switch brings the view back to the DIB.
- A motion pause sits beside the studio-light switch. Reduced motion keeps lighting and deliberate camera moves available, while automatic travel, water, and wind remain still.

## Ownership and loading

`_includes/la-jolla-footer.liquid` and `_sass/_footer-coast.scss` own the component. `_includes/footer.liquid` supplies the integration point; the homepage room, album controller, Pip state, and general page content are untouched.

`assets/js/footer-coast/entry.mjs` waits until the footer is within 450 pixels of the viewport before importing the renderer. `scene.mjs` reuses the version-matched loader and contact-shadow utility. `assets/models/la-jolla/manifest.json` holds the model name and office anchor. The GLB is about 716 KiB; its 73,000 triangles are grouped by material. Pixel density is capped at 1.5, shadow maps update on layout changes, and ambient-occlusion buffers are bounded by the existing finishing utility.

The actual Blender render remains visible if JavaScript, WebGL, model decoding, or context recovery fails. Controls appear only after successful initialization. Context loss restores the poster and hides unavailable controls. A restored context returns to the current light/pause/theme state.

## Verification

The focused suite is `test/visual/footer-coast.spec.js`, included in the existing scene test command. It covers actual changed pixels for light and motion, nonblank frames, four themes at all four standard sizes, mobile pan/keyboard access, lazy loading, pause/offscreen recovery, reduced motion, context loss, failed loading, and integration with project/blog/publication/AI routes.

```powershell
$env:NO_WEBSERVER='1'
$env:VISUAL_BASE_URL='http://127.0.0.1:8080'
npx.cmd playwright test --config test/visual/footer-coast.config.js --output .jekyll-cache/visual-qa/la-jolla-footer/checkpoint
```

Use `COAST_THEME=noon` and one `--project desktop-1440` while iterating. The current before/after captures and measured results live in [the evidence record](evidence/la-jolla-footer/README.md). Measurements from local Chromium mobile emulation are not physical-phone benchmarks. Source reproducibility does not substitute for Sirui's visual review.
