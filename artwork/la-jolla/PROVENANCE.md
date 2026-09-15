# La Jolla footer miniature

Original geometry authored on September 14, 2026 with Blender 4.5.9's Python API. The actual editable source is `la-jolla.blend`; `bin/build_la_jolla.py` reproduces its geometry, materials, camera, and GLB export. Blender ran in background mode, not through manual UI operations.

The user's four social-media screenshots inform the idea of a crafted miniature along the bottom of a page: restrained pastel materials, an architectural silhouette, a gentle arrival, and warm windows. No artwork, models, layout markup, or source code from the unidentified reference website is included.

The two user-supplied DIB photographs guide the repeated folded glass bays, charcoal cheeks, concrete base, horizontal lower floors, and solid end volume. The window anchor interprets the user's annotations at 28.6% / 53.4% and 33% / 50.3%. It is a small personal detail in a stylized building, not a surveyed reconstruction or live office-occupancy indicator. Reference photos remain outside the shipped assets.

UC San Diego's [DIB overview](https://dib.ucsd.edu/about/index.html) and [Design Lab](https://designlab.ucsd.edu/) verify the building identity and the Design Lab's third-floor location. The coast, villa, cottages, courts, beach furniture, palms, and surfers are original illustrative models. The composition deliberately brings inland and coastal places together; it is not a geographic map.

Three.js r164, the matched GLTF/Draco loaders, and ambient-occlusion passes use the repository's existing licensed distribution. The matching Blender exporter performs Draco compression. There are no downloaded third-party meshes, HDR photographs, texture packs, or generated scenic backdrops.

`la-jolla-day.png` is an actual transparent Cycles render of the editable model. `assets/models/la-jolla/poster.webp` is its compressed graphics-failure/no-JavaScript fallback. The interactive scene uses geometry, procedural water, generated reflection lighting, and shadows. The poster is never its ocean or sky background.

Reproduce from the repository root:

```powershell
& 'C:/Users/dylan/.cache/sirui-studio-tools/blender-4.5.9-windows-x64/blender.exe' --background --python bin/build_la_jolla.py
# Reframe/render the saved Blender scene without rebuilding geometry:
& 'C:/Users/dylan/.cache/sirui-studio-tools/blender-4.5.9-windows-x64/blender.exe' --background --python bin/build_la_jolla.py -- --render-only
node -e "require('C:/Users/dylan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')('artwork/la-jolla/la-jolla-day.png').webp({quality:88}).toFile('assets/models/la-jolla/poster.webp')"
```

Blender and Sharp paths are local tooling locations, not website dependencies. See [the implementation brief](../../docs/la-jolla-footer.md) for scope and acceptance evidence.

## September 14: atlas, multiview experiment, and miniature

Sirui's follow-up photographs and explicit correction establish **five folded DIB bays**, with the personal office vignette in the middle bay on the third floor. The additional landward/end views guide cladding, ribbon glazing and the external stair. Photographs are references only and are not bundled in the public assets. The Connect composition now features Geisel, Salk, DIB, Scripps Pier, Torrey pines and the rocky Cove; the footer keeps the seaside neighborhood and courts. Geisel's concrete core, paired buttresses and podium, and the tennis retaining foundation, correct the previously unsupported appearance. Salk's bands and openings follow the [official architecture guide](https://www.salk.edu/explore-salk-architecture-guide/). The map uses the original OSM response with an irregular feathered vector mask; no geography was regenerated.

The later refinement extends both the footer and Connect miniature with original Geisel, Salk, and Scripps Pier geometry (`bin/coastal_landmarks.py`). Sources consulted: [Geisel architecture](https://geisel50.ucsd.edu/about/architecture.html), [Salk architecture](https://www.salk.edu/about/about-salk/architecture/), [Scripps Pier](https://scripps.ucsd.edu/about/scripps-pier), and the DIB photographs above. These are visual references, not photogrammetry or copied architectural models.

- `direction/front.png`, `back.png`, and `atlas.png`: generated design studies. Original C2PA metadata identifies `gpt-image` version `2.0`; the image tool offered no Images 2.5 selector. Hashes and metadata are recorded in `../coastal-home/direction/provenance.json`.
- `reconstruction/multiview-shape.glb`: actual locally inferred Hunyuan3D-2mv shape, using front and back concepts, seed 20260914, 30 steps, octree resolution 256. `attempt.json` records the pinned model revision, successful result, duration, hardware and face/vertex counts. `clay.png` is the actual Blender render of this mesh. It is a **generated shape study**, not the production landmark model.
- `reconstruction/HUNYUAN-LICENSE.txt`: retained Tencent Hunyuan3D 2.0 Community License for the reconstruction model/tooling. The run used `tencent/Hunyuan3D-2mv`, revision `3a761b539b29fe4ff64714813aa9560fd66f5de0`. Model weights and upstream code stay in the local tools cache, outside this repository.
- `miniature.blend`, `miniature.png`, and `assets/models/la-jolla/miniature.glb`: deliberately authored Blender composition and actual render. The reconstructed silhouette helped review the massing, but the runtime GLB is **not** a relabeled Hunyuan export. `bin/build_la_jolla_miniature.py` reproduces the compact composition.
- `atlas/openstreetmap.json.gz` and `atlas/provenance.json`: retained sourced coastline and road response and retrieval metadata. Bounds are 32.817 to 32.915 north, -117.293 to -117.206 east. `bin/build_coastal_atlas.py` projects these ways into `assets/models/la-jolla/atlas.svg`, with a soft alpha boundary.
- Geographic data is © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), under ODbL. The SVG carries its attribution; the interface links to it. Generated atlas art is a direction study only, never substituted for the sourced geometry.

The miniature compresses landmark distances and scales to form an artistic block. Neither the model nor its office light represents current occupancy. Theme-linked activities, evening fire, window lighting, and left-to-right footer reveal are authored vignettes. `bin/prepare_coastal_web.py` generates bounded public WebP previews from the original concepts and Blender renders. The raw reconstruction and editable sources are optional downloads and never initial-page dependencies.

The final process and browser evidence are in [the refinement record](../../docs/evidence/coastal-refinement-2026-09-14/README.md).
