# Source-derived ground behind the coast

The old hill image ended at −0.4 degrees, while the lower visible background reached about −7.4 degrees. Clamp-to-edge repeated the last row into vertical curtains. The new radial field connects the existing native coast edge to the original measured ridge, with real source slopes between them. It does not add a flat apron or label sea as land.

Source checkpoint: `6d24859d92e0d6351b2cf7cc538b697e3c35e7a2`. This is an isolated footer checkpoint for coordinator integration. It does not claim deployment, physical-phone acceptance, a uniformly scaled geographic reconstruction, or completion of the separate home-scene FPS/architecture work.

## Comparable evidence

The four current browser controls use the same compiled module and full scene: only the retained original 147-row angular image is substituted to select the legacy plane fallback. Both images keep native buffers, foreground models, lighting, water and camera. `browser/ground-*.json.gz` records the actual source/native edge measurements; `views/control-*.png` and `views/ground-*.png` are the paired rendered canvases.

| View    | Retained angular control           | Source depth                  |
| ------- | ---------------------------------- | ----------------------------- |
| Desktop | [1440](views/control-1440.png)     | [1440](views/ground-1440.png) |
| Phone   | [390](views/control-390.png)       | [390](views/ground-390.png)   |
| 4K noon | Historical curtain diagnosis below | [3840](views/3840-noon.png)   |

`views/` also retains morning, noon, afternoon and evening at 1440, 390 and 3840 pixels. These are real native Chromium/D3D11 renders, without scene-asset omissions. All 13 authored landmark groups remain. The complete production readback verifies 37 footer assets plus all 121 committed home assets; the home assets are present, rather than used as evidence of a new home-scene improvement.

The production build completed in 311.588 seconds. Its compiled sky SHA-256 is `e3d81a3ade02fa81b4b2e9c9d7d9cbb46fe3e1cc14e3a78fc07d5b3094f05150`, exactly the served capture/timing candidate. Final source comments were clarified after the timed run; the resulting minified bytes are identical. The preview began as the complete published `0dd41eb7e` build and used the actual Liquid, Sass, JS and module compiler recipes for changed bytes. Root's later compact-header repair is separate.

## Source and geometry controls

- A fresh [public USGS 3DEP read](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer) matches the prior 3,278,182-byte TIFF exactly: SHA-256 `86761b4871928941bb7c454074ef0ee5f7e8c2dc10e93b3d4438edbe3a006809`. Exact request, bounded DEM extent, raw hash and existing OSM receipts remain in the canonical [provenance](../../skyline/provenance.json). The raw TIFF stays in ignored cache; no new OSM reads or skyline-data changes were made.
- Original angular RGB rows retain SHA-256 `417e10a3934d88331e00b1f0e7e2eca113f5320dc65288ef956b66cb82fca20f`. The atlas is 929×235 RGB, 133,098 bytes. Metadata and gutters separate the unchanged 147-row prefix from 81 radial samples per bearing. Distances and source normals come from the same filtered DEM. Zero/no-data samples never support terrain triangles; a tiny positive land value remains positive after quantization.
- Each bearing uses one isotropic depth/height scale, anchored at the actual authored back edge and at the original skyline projection in the existing reference camera. It preserves radial slope and the established landmark-to-bearing mapping. The stage fit is deliberately stylized because the frieze compresses landmark distances. It is not a surveyed shoreline, bathymetry, or uniform geographic projection.
- Source search spacing is 8 metres. The 81-sample radial grids span different distances, so their sample spacing ranges about 0.3–82.1 metres; they are not 8-metre grids. The byte height range is 0–280 metres, with a 1.10-metre quantization bound. Encoded native datums have 1-mm stage precision.
- The renderer allocates 37,665 vertices and draws 60,411 supported triangles in one additional opaque draw. Actual exported native geometry differs from the encoded back edge by at most 0.00526 Y / 0.00533 Z stage units across 397 checked columns. The durable browser bound is 0.006. Double-precision crest projection error is approximately 4e−15 degrees; the separate Float32 gate is 1e−4 degrees.
- Terrain and the legacy fallback call the same measured-normal ground/air shading function. Grass/chaparral variation remains authored procedural colour, not a land-cover survey. House glyphs retain their already published source window angles/distances, OSM footprint/height assumptions, skyline ceiling and the subpixel area filter. A rejected first prototype incorrectly sampled house elevations from a radial field that stops at the bare crest; it is preserved separately. Native foreground GLBs, geographic sun direction/disk visibility, camera/tilt behaviour and water optics remain unchanged.
- The group stays outside the water mirror and contact pass. Context recovery retains the source arrays; disposal releases the geometry, materials, texture and anchor cache. Legacy 147-row images still use the prior plane path, and an incomplete field does not become a depth field.

## Cost, with limits

Root and the native-geometry worker explicitly stopped local compute/render work. The coordinated run began at **2026-10-29 12:16:11 UTC**, finished at **12:16:48 UTC**, closed browser/samplers, and released the hold after 37 seconds. The 84-second watchdog did not fire. All eight states passed their startup assertions: full native buffer, actual NVIDIA RTX 3080 Ti / ANGLE D3D11 renderer, non-miniature, all 13 landmark groups, current theme/depth state, complete GLB response, real RAF, live people and no collected runtime errors.

Each width ran baseline → candidate → candidate → baseline, with at least 60 complete drawn frames per state. The baseline uses the delivered post-footprint-filter sky (`daca20b89cdefffa7587b585045283d7a0a3c3dc6c7b71186a122aa617a6410b`) and original angular PNG. The candidate uses the exact compiled/data bytes above. Neither changes pixel density, resolution, materials, foreground models or LOD.

| Full native buffer | CPU median per run, baseline / candidate | GPU median per run, baseline / candidate | Median interval |
| ------------------ | ---------------------------------------- | ---------------------------------------- | --------------- |
| 2560×480           | 2 ms / 2 ms                              | 2.56–2.60 / 2.01–2.41 ms                 | 33 ms           |
| 3840×480           | 2–3 ms / 2–3 ms                          | 2.70–2.87 / 1.36–2.57 ms                 | 32–33 ms        |

CPU timing covers the actual draw body with native `performance.now`, whose observed granularity is 1 ms. GPU spans use `EXT_disjoint_timer_query_webgl2` around the full draw; all returned queries are non-disjoint. Raw per-frame rows and tails are retained in `cost/results.json.gz`. Depending on the state, 59 or 60 queries were available at stop; at most one final query was pending and was explicitly disposed. The GPU spans include the full command interval, not an isolated shader attribution. The repeat spread is substantial; this does **not** establish a speedup, a cold-start improvement, or physical-phone cost. The existing roughly 30 fps footer cap holds in this bounded run.

Draws change 324→325 at 2K and 366→367 at 4K; triangles add exactly 60,411. Programs change 18→19 and uploaded geometries 189→190, with 17 textures in both. Known added GPU storage is 1,567,746 geometry bytes plus 327,008 decoded RGBA atlas bytes. CPU retention includes the 873,260-byte field readback, typed geometry and anchor-map/object overhead; browser image storage is additional. These are allocation accounts, not a total process/GPU-memory measurement. Readiness gates passed, but cold upload/compile latency was not causally benchmarked.

The diagnostic wrapper is **not product source**. It observes a renderer instance at the draw boundary and restores `info.autoReset`; it installs no global renderer/prototype hook and collects zero timing samples during preflight. Exact native-frame hashes were deliberately tested. Repeated unchanged **no-hook** draws already differ by 1/255 in 71–286 channels; inactive-hook draws differ in 78–294 channels, with unchanged elapsed time and camera. All 12 controls and their actual differences are retained. Independent contexts also have randomized SSAO kernels. Seeded and settled hash-equality attempts failed too. This is an honest observed rounding floor, not claimed exact pixel parity or permission to relax product image gates.

## Retained rejected attempts

`attempts/` retains actual sources/data and frames, rather than just proposed ideas:

1. A level apron joined the foreground but made an invented flat strip; rejected.
2. Extending the same angular image to −15 degrees covered the view but treated sea-level ray hits as land; rejected.
3. Positive-height alpha kept sea truthful but revealed a pale gap between a far plane and the authored coast; rejected.
4. The first source-depth house placement used clamped radial elevations past the bare crest; replaced with the original published house window angles/distances.

The original magenta diagnostic threshold initially missed the rendered green channel of about 82. Its corrected mask analysis is retained separately: 44,705 unsupported pixels (8.95% of the frame) at 1440, and 9,606 (7.44%) at 390. Historical diagnosis captures predate the independent subpixel-house fix; the four current legacy fallback controls above are the final same-module comparisons.

## Verification and reproduction

- 79 focused coast Node tests pass, including five actual-atlas/source/crest/support controls. All 319 Python tests pass, including eight skyline/producer tests. Style contract, targeted Prettier and `git diff --check` pass.
- New native source/native-edge browser case: four standard widths pass. Native loading/theme/credit/mirror/reveal/context/fallback regression: 22 pass, two existing scope skips. Modern Windows WebKit 27.2: eight ground, real clock, phone pan, context, pointer and permission/tilt cases pass. No physical sensor/device claim is made.
- All twelve posters were regenerated through the unchanged `bin/render_coast_posters.cjs`, with the existing quality settings. Original poster bytes and version are retained under `before-posters/`. Four miniature variants were re-rendered without intentional scene/geometry changes; small byte changes from independently initialized contact rendering are not a miniature redesign.
- The exact new title requiring coordinator registry integration is **`coastal ground: source relief meets the native coast and keeps the measured ridge`**, in `test/visual/footer-coast.spec.js`. The coordinator owns the registry, combined-main build/gates, publication and live check.

To reproduce, restore the gzipped diagnostic producers to an ignored `.jekyll-cache/visual-qa/identity-footer-20261029/` directory in this checkout and use a complete production build at the owned port (4151 in the retained run). The scripts use normal `NODE_PATH` dependencies; they do not require a junction or modify the renderer in product files. Restore `cost-scene.mjs`, old sky and old PNG to the paths named in `depth-cost.cjs` if repeating the optional timed diagnostic. Do not repeat timing without an explicit quiet window. For product gates, use the normal external-server `NO_WEBSERVER=1` and `VISUAL_BASE_URL` settings and the committed test title. Modern WebKit used Playwright `1.65.0-alpha-2026-10-28`, WebKit 27.2 revision 2380; the exact config is retained. This does not relabel the separate known pinned-old-WebKit home fullscreen issue.

`manifest.json` binds every binary/gzipped payload and the actual source checkpoint. Run `python verify.py` to verify local payloads; `python verify.py --git HEAD` additionally verifies committed blobs. Source text bindings normalize CRLF to LF; binary payloads remain exact.
