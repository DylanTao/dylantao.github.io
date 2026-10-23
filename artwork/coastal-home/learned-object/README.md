# Calibrated static-object Gaussian fit

**Decision: retain the relightable mesh.** This is a genuine trained 3D representation, with owned calibrated inputs and held-out camera views. Its smaller raw weight file does not justify the missing edges, poor foreground reconstruction, extra accumulation target or loss of relighting.

## Inputs and training

The target is Sirui's original Eames-inspired chair and ottoman GLB, **66,580 bytes**, built in the existing furniture source. Its exact bytes from site revision `9a8236b33` are retained as `data/source.glb`, so future furniture edits do not silently change this experiment's baseline. [Furniture provenance](../FURNITURE.md) distinguishes that original mesh from reference-only configurator downloads. No downloaded product geometry, research demonstration scene or paper weights enter this experiment.

`bin/capture_coastal_object_field.cjs` renders 24 fixed-light, 64 × 64 views of that exact GLB. Yaws 0°, 60° … 300° at pitches 10° and 35° are the 12 training views. The 12 interleaved yaws 30°, 90° … 330° are held out. The original source digest, normalized metre-to-object transform, full camera matrices, focal lengths, image digests and deterministic area-weighted surface initialization are retained in [the dataset](data/dataset.json). Each `.rgba` is the actual unmodified browser readback, bottom row first. These are synthetic calibrated references, not photographs or a reconstruction of previously unknown geometry.

The original differentiable CPU rasterizer in `bin/train_coastal_object_field.py` optimizes 256 Gaussian positions, three world-axis scales, constant sRGB colors and opacities. Perspective Jacobians project their covariance; near-to-far alpha transmittance composes the target. It uses seed 1701, four Torch 2.6.0+cpu threads and a fixed 1,000-step Adam budget. Training views alone enter optimization; held-out views do not select a checkpoint. [The complete training record](training.json) binds the trainer, calibrated dataset and actual exported parameters. A repeated run produced identical weights.

## Result and browser evaluation

The learned file contains **10,240 bytes**: 256 × 10 float32 values. This excludes the manifest, decoder and shared Three.js engine. Training whole-image PSNR is **24.10 dB** and held-out quality is **22.40 dB** at the training resolution. Foreground-only held-out quality is only **14.19 dB**; the mask selects target pixels differing from the captured paper background by more than 0.04 in at least one sRGB channel. The paper background makes the whole-image score look more favorable than the furniture.

The browser renders the actual exported means, scales, colors and opacities. A fresh 256 × 256 rendering of each held-out camera compares it with the original mesh, exposing the blurred pads, broken thin supports and missing sharp silhouette. This is also a genuine resolution change from the training images, not an enlarged saved 64-pixel prediction. The [raw browser record](browser/browser.json) includes the reference error, both renderer identities, all queries and visual interaction checks.

Direct RGBA8 accumulation initially introduced visible numerical drift. The retained decoder accumulates in a float target and then displays it: RGBA32F when float blending is available, otherwise RGBA16F. At 256², the RGBA32F target alone costs **1,048,576 bytes**, beyond the trained attributes. Its six-sigma support truncation keeps the browser and float Python reference within two 8-bit color levels. GPU timings include the accumulation and display passes; their local measurements do not establish a mobile or whole-house performance win. Camera covariance projection and sorting are measured separately from static draws.

| Held-out yaw / pitch     | Mesh GPU ms | Gaussian GPU ms |
| ------------------------ | ----------: | --------------: |
| 30 degrees / 10 degrees  |       0.136 |           0.447 |
| 150 degrees / 35 degrees |       0.147 |           0.458 |
| 270 degrees / 10 degrees |       0.124 |           0.404 |

These final ABBA medians use the reported Intel Arc renderer and 256-square backing store. The separately measured median covariance projection/sort/upload preparation was 0.30 ms in Chromium; WebKit timestamps quantized this small work to zero. Actual uploads occur in the next draw. These static object numbers are not the full homepage frame budget.

Chromium and WebKit both have visible mode/camera changes, clean console/GL checks, a fitting 390-pixel layout and resource disposal evidence. Numeric readback and native composited screenshots use separate documents: a valid readback alone did not establish visible WebKit presentation in the first combined-document attempt. The failed logs remain in the local ignored cache. GPU query values are accepted only when available and nondisjoint; WebKit's missing extension is recorded as unavailable, not zero time.

## Scope and source licenses

The fit has no learned rotation, spherical harmonics, densification, pruning, learned anchors, temporal deformation, material decomposition or relighting. Sorting these fixed-color splats is not a replacement for mesh depth, collision or animated furniture in the house. It does not implement TensoRF, neural geometric LOD, variable-bitrate dictionaries or learned stylization.

[Kerbl et al.'s 3D Gaussian Splatting](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/) motivates optimizing spatial Gaussian parameters and projecting covariance. This smaller original implementation is **not a reproduction** of their training, density control or optimized renderer. No code or license terms from that implementation are imported. The experiment code uses this repository's MIT license; its existing Three.js r164 dependency retains the [vendored MIT notice](../../../assets/js/vendor/three-r164/README.md). Torch remains training-only, under its [2.6.0 license](https://github.com/pytorch/pytorch/blob/v2.6.0/LICENSE). The owned mesh's provenance carries through to its synthetic views and learned derivative.

## Reproduce

```powershell

python -m http.server 4162 --bind 127.0.0.1

# In a second shell, while that server remains alive:

node bin/capture_coastal_object_field.cjs

python bin/train_coastal_object_field.py --steps 1000

node bin/measure_coastal_object_field.cjs

python -m unittest test.test_learned_representation_artifacts

```

Open `http://127.0.0.1:4162/artwork/coastal-home/learned-object/`. Capture uses `?capture=1` to keep the trained decoder out of the reference session. Browser comparison can narrow to `PRINT_FIELD_ENGINES=chromium`; the retained acceptance record covers both engines. All experiment assets are excluded from Jekyll by the existing `artwork/` rule. No homepage runtime, camera, materials or public control changes.

A later candidate must retain thin furniture detail, support the required light/depth contract and demonstrate complete bytes and frame costs at matched quality. This completed negative comparison does not declare the other representation families implemented.
