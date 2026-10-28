# P: compressed delivery, retained geometry

The measured production arrival exceeded the 4 MiB normalized gzip budget: 4,408,419 bytes for a Ghibli arrival. P alone accounted for 420,393 bytes. Its old GLB had no Draco compression.

The exact retained `artwork/pip/pip.blend` is exported with Blender 4.5.9 and the shared recipe in `bin/pip_model_export.py`. It is not rebuilt, decimated or resaved. `bin/build_pip.py` uses the same export recipe for future builds.

The candidate is 139,108 bytes raw and 101,144 bytes at gzip level 9, saving 319,249 gzipped bytes. All 27 meshes, their parents, world transforms and materials remain the same. All 35,504 triangles remain. Actual pinned Three/CPU Draco decoding finds at most 10.484 micrometres of position error and 0.003860 normal-vector error. P has no image textures; its unused delivered UV attribute is omitted while the native UVs remain in the `.blend`. This is bounded quantization, not bitwise geometry losslessness.

The actual native-GPU 3840 x 2160 studio pair is retained as lossless WebP. Only 340 pixels exceed a three-level channel difference, or 0.00410% of the whole frame; mean maximum-channel change is 0.00962/255. Both images are visually reviewed. This qualifies geometry and materials; whole-home behavior and phone performance are separate checks.

`recipe.json` pins the unchanged source and exact settings. The complete production arrival readback is added separately after the new build; subtracting the byte saving alone is not the arrival gate. The six startup and 2K/4K frame measurements retain the preceding compressed delivery, with the same positions, normals and materials and its unused UVs still present. Those measurements are explicitly pinned to that build. P is moving geometry and is excluded from the static transport input set; the actual existing cache signature is checked independently.

The final material-retirement build's actual standard lunch arrival is retained in `arrival-retirement-lunch.json.gz`: 180 unique resources, Simpsons arrival, 4,128,228 normalized gzip bytes, and zero page errors. Holding that observed family fixed, the largest avatar plus largest LOD1 dish gives 4,188,014 bytes against 4,194,304, leaving 6,290 bytes. This remains a conditional byte bound, not a universal tier/exploration or startup-time claim.
