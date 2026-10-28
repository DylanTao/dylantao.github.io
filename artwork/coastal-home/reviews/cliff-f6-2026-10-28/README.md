# F6 cliff integration: rejected experiment, October 28, 2026

**F6 remains open. Do not copy these candidate sources or models into the site.** The stronger contour changes the mass visibly, but it does not produce a convincing organic cliff. Preserving many ambiguous groundcover supports produces angular depressions, the long excavation lips remain, and the strict outside-surface and normal controls fail. Passing circulation, flight and budget checks does not make this an acceptable visual repair.

The immutable baseline is the frozen v84 native source, SHA-256 `4aaa7a66626af86d1c10ff021fda6a52e97e46caed3fad1e39c9e0173617d681`. The [house intake roster](../architecture-finish-2026-10-28/intake-manifest.json) identifies its complete source/model family. This work used a copied source, exact Blender 4.5.9 LTS (`8bf95cbd38d1`) and separate port 4117. No canonical source, model, manifest, cache, runtime, test registry or handoff document changed.

## Actual rendered comparison

| Same-view state                | Frozen v84                            | Rejected finite contour              |
| ------------------------------ | ------------------------------------- | ------------------------------------ |
| Native 3840×2160 overview      | [Before](native-before-overview.webp) | [After](native-finite-overview.webp) |
| Native 3840×2160 close         | [Before](native-before-close.webp)    | [After](native-finite-close.webp)    |
| Actual shaded WebGL, 3840×2160 | [Before](web-before-4k.webp)          | [After](web-finite-4k.webp)          |

These are real renders, not concept images. Both native close views are lossless WebP encodings with equal decoded RGBA hashes. The other full-resolution WebPs are quality-90 review derivatives. [images.json](images.json) distinguishes these encodings, records original PNG hashes and retains 3840×2160 dimensions throughout; the original PNGs remain in ignored QA. Native frames use the same Eevee preview setup, afternoon light, camera and 32 samples. They establish shape, not the browser's final material/light result. [The native settings](native-render.json) and [actual WebGL controls](web-controls.json) keep those scopes separate.

The browser frames include the complete normal scene, animals, plants, furniture and delivered avatar. Both source-routed 4K architecture cases passed, including nonblank views, visible drag/zoom changes, room visits, a real 3840×2160 drawing buffer and a same-geometry white-AO control. The preview uses c37 source modules with the coordinator's frozen RT `static-light-field.mjs` override (SHA-256 `aa6cc8a38f45cfbb4b9ab61e4ea5ec805a40551675d8951931088ec22b454c77`) to admit v84's 28 actual CPU practicals. The 16-region, 750,000-triangle and 800,000-byte ceilings were unchanged. The initial 26-practical baseline failed to initialize and is retained in ignored QA. No provisional RT cache was used. This is a source-routed functional preview, not a new production or cache admission.

## What was tried

The retained v73 sea render was inspected first. Its height-band projection makes a pointed lip at the rock interface. The real [Torrey Pines cliff photograph and account](https://torreypine.org/nature-center/geology/cliffs/) and [sandstone cave photographs](https://torreypine.org/nature-center/geology/rock-formations/torrey-sandstone/) informed the intended broad strata, worn recesses and continuous shoulders. The photographs were viewed as references; none of their pixels or textures are included here.

1. A recessed, flared upper throat applied the same map to the core and all five touching closed roof partitions, with the whole planted top and inhabited lower section fixed. It added 2,488 native render triangles. The [overview](native-timid-overview.webp) is almost indistinguishable from v84 at a useful scale: the constraint was too conservative and missed much of the broad flank.
2. The stronger contour expanded to native `x [-22,17], y [-12,19], z [5.9,14.35]`, with two meter-scale flank recesses and no seaward beak or added boulders. A stationary authored displacement field was integrated in small steps, identically across the touching solids. The [strong overview](native-strong-overview.webp) changes the mass but exposes pinched ground and a partition/ledge mismatch. Sampled local Jacobians remain positive, with strong compression as low as about 0.026; this is an authoring map, not a physical erosion simulation or a proof against every self-intersection.
3. Two technical variants retained the same contour: preserve every original render diagonal before conversion, then split the actual source surface at the six finite patch boundaries before moving vertices. Boundary splitting reduces the outside error substantially but does not eliminate it. The final finite source is `1dcebe7f64f324ffbd8ac4e28aa993854635990d36968bb0d80b6bb48b5363d4`.

The explicit rosette, wildlife and chimney support patches were held. Ordinary flora is material-batched into many disconnected components. No complete botanical clusters were positively identified or moved. Ground-adjacent component bottoms were treated conservatively as ambiguous support patches, not declared rooted plants or used as permission to move leaf fragments. The resulting 13,089 protection points overconstrain the upper surface and contribute to the angular depressions. The coordinator authorized rigid movement of complete identified ordinary plants, but this attempt did not establish those identities; it retained their supports instead.

## Measured result and rejection gates

- [Saved-source scope](outside-audit.json): only four rock meshes changed. All unrelated object/mesh fingerprints and all materials remain exact; the object roster is unchanged. All six candidate rock solids retain zero nonmanifold edges. Their active native AO color fields remain present where they existed.
- **Outside geometry fails.** At the existing 3 μm control, the finite candidate has 144/15 failing forward/reverse probes in the core (maximum measured nearest-surface distance 62.1/16.2 mm), and 104/2 in the retreat roof (25.5/4.0 mm). Bath and library roofs are below 0.7 μm; both other ceilings remain within the original tolerance. These are all-surface outside portions in both directions, including triangles crossing the finite bounds, not a few conveniently chosen points. The original diagonal-only version had errors up to roughly 0.35 m. No tolerance was relaxed.
- **Outside normals fail.** The saved native corner-normal stream changes beyond the authored region. The intended float loop field is retained in the finite source for diagnosis, but it is not an accepted substitute for preserved native/exported normals. The effects of interpolation, topology changes and Blender's relative normal encoding still need isolation. AO/material preservation and closed solids do not excuse this failure.
- [Native contacts](contacts.json): nine routes, 117 contact samples, twelve rock bearings and four forward cantilever controls pass. These are geometric contacts, not an engineering certification. The seven existing decoded architecture/capsule cases also pass against the actual finite Draco export.
- [Actual runtime flight trace](flight-summary.json): all 420 flights, 3,629,951 samples and the retained 0.42 m sphere pass against the final finite source. Minimum conservative clearance remains 0.441936 m. The trace and preset hashes are recorded; the route preset was not changed to evade the terrain.
- [Native overlap comparison](overlap-comparison.json): visible z-fighting is 0.7289→0.72045 m², grazing seam remains 3.257 m, and deep sites over 5 cm increase from 288 to 313 against the unchanged 350 ceiling. The broad raw offender-seam total rises from 667.845 to 680.888 m. The audit samples crossing depth/seams and coplanar area, not overlap volume. Global sampling can change some unchanged pair estimates; exact native scope is checked separately. No new pair verdict or exception was admitted.
- The final authoring mesh adds 10,556 native triangles. The actual browser field collects 630,112 traced plus 116,182 skipped triangles: **746,294 total potential**, below the unchanged 750,000 ceiling. Its unbound snapshot is 780,458 JSON bytes before final source inputs. No complete source-bound cache or 4 MiB arrival closure is claimed. These shared-machine functional runs are not hardware, startup-time or physical-phone benchmarks.

## Reproduce and continue

[attempts.json](attempts.json) binds every source and exact recipe, and [source-binding.json](source-binding.json) binds the final native/prepared source, actual exported home-shell, runtime roster and export settings. Only `home-shell.glb` differs in the copied model family; every other delivery remains byte-identical to frozen v84. Draco stays level 10, position 14, normal 8, color 6. The native sources and full raw reports remain in ignored `.jekyll-cache/visual-qa/cliff-2026-10-28/`, including failed initializations and incomplete diagnostic audit runs.

The four retained `recipe-*.py` files reproduce the actual experiments from the repository root after populating the pinned `baseline/source.blend` and model roster in that QA directory. They write only candidate files there and assert the exact v84 input hash and Blender version. [audit_scope.py](audit_scope.py) reproduces the finite outside-field comparison; [render_native.py](render_native.py) reproduces its native frames. These are rejected experiment recipes, not a canonical build step.

```powershell
& 'D:/tools/blender-4.5.9-windows-x64/blender.exe' --background --python-exit-code 1 --python artwork/coastal-home/reviews/cliff-f6-2026-10-28/recipe-finite.py
& 'D:/tools/blender-4.5.9-windows-x64/blender.exe' --background --python-exit-code 1 --python artwork/coastal-home/reviews/cliff-f6-2026-10-28/audit_scope.py
# Native contact audit and actual runtime trace remain separate from rendered acceptance.
& 'D:/tools/blender-4.5.9-windows-x64/blender.exe' --background --python-exit-code 1 --python bin/review_coastal_retreat.py -- --source=.jekyll-cache/visual-qa/cliff-2026-10-28/attempt-2-finite/candidate.blend --manifest=.jekyll-cache/visual-qa/cliff-2026-10-28/baseline/manifest.json --out=.jekyll-cache/visual-qa/cliff-2026-10-28/attempt-2-finite/native-contacts.json
$env:NO_WEBSERVER='1'; $env:VISUAL_BASE_URL='http://127.0.0.1:4117/al-folio'
$env:COASTAL_MODELS_ROOT=(Resolve-Path '.jekyll-cache/visual-qa/cliff-2026-10-28/models-candidate-finite').Path
$env:COASTAL_RUNTIME_ROOT=(Resolve-Path '.jekyll-cache/visual-qa/cliff-2026-10-28/runtime-root').Path
$env:VISUAL_ARCHITECTURE_4K='1'
npx.cmd playwright test --config test/visual/architecture-finish.config.js --project desktop-1440 --workers 1
```

The next hypothesis is a deliberately rebuilt shared boundary/contour with explicit thickness and common partition ownership, after assigning persistent IDs to complete plants. Keep the exact retained exterior and optical fields as hard controls. Another ambient warp around thousands of guessed plant pins, or another noise layer over the flat cut, would repeat the observed failure. This packet records a genuine failed attempt; F6 and Sirui's visual acceptance remain open.
