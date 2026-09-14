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
