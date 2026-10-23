# Trained Pacific print field

**Decision: retain the original image.** The candidate has genuinely learned weights and fewer raw representation bytes, but blurs the thin ink marks and costs more GPU time. This completed bounded comparison adds no homepage treatment.

## Training and custody

`bin/train_coastal_print_field.py` fits three learned bilinear feature grids (16 × 8, 48 × 24, 128 × 64; four channels each) and a 14 → 24 → 24 → 4 ReLU decoder. It outputs premultiplied sRGB and alpha. Adam optimizes only the deterministic coordinate-hash training split; validation selects the best logged checkpoint. Separate test coordinates never enter optimization or checkpoint selection. The int16 export quantizes each parameter block with its own scale.

The target is the existing 1200 × 600, **228,966-byte** [original coastal WebP](../coastal-print.webp). Its generated source and generation ID are recorded in [provenance](../PROVENANCE.md). This is one static illustration, not photographs of a real coast. Exact image-plane UV coordinates provide calibration; no multiview or 3D calibration is claimed.

The final run used Torch 2.6.0+cpu, four threads, seed 1701, 3,000 steps and batches of 4,096. There are **576,038** training coordinates, **71,987** validation coordinates and **71,975** held-out test coordinates. [The complete training record](training.json) binds the actual trainer, target, split and exported weight hashes. A repeated run produced identical weight bytes; elapsed time varied with machine load.

## Observed result

The 38,948 trained parameters occupy **77,896 int16 bytes**, before the manifest and decoder, versus 228,966 bytes for the WebP. Float-to-int16 held-out quality changes by less than 0.001 dB. Held-out premultiplied RGB quality is **21.06 dB PSNR**, with alpha RMSE **0.03659**. Nearby training coordinates make this interpolation task easier than reconstructing a novel scene or unseen 3D view.

The browser renders those exported weights, rather than a saved prediction image. Whole-print, cliff at 3× and agave at 4× views share coordinates, backing resolution, paper color and display size. Captures expose lost hatch marks and flattened rock/plant edges. Independent color/alpha outputs can also overshoot the ideal premultiplied-color constraint near transparency. This small field is not a high-fidelity image codec.

The [raw browser record](browser/browser.json) contains every timing query, actual renderer and acceptance check. Chromium exposes nondisjoint GPU queries; WebKit does not expose that extension here. Zero CPU timestamps do not establish zero or equal GPU cost. These are local native-browser samples, not physical-phone measurements.

| Matched view | Original image GPU ms | Trained field GPU ms |
| ------------ | --------------------: | -------------------: |
| whole        |                 0.666 |               14.587 |
| cliff, 3×    |                 0.547 |               15.195 |
| agave, 4×    |                 0.583 |               14.791 |

These final ABBA medians use the reported Intel Arc renderer and 1200 × 600 backing store. Earlier samples were 0.15–0.17 ms for the image and 0.95–1.83 ms for the field; concurrent machine load was not isolated. Both samples favor the image, without establishing a stable absolute frame budget. The adoption decision also rests on visible fidelity loss.

Both engines check keyboard pan/zoom, reset, visible pixel changes, all four viewport widths, no overflow, GL/console errors and actual texture/program disposal. The fixed backing store is CSS-scaled on phones; it has no adaptive rendering budget. No continuous animation or homepage dependency is added. `reconstruction.png` is a Python sanity-check image, not the browser representation.

## Method and license boundaries

This is original code under the repository's MIT license. The browser uses dependency-free WebGL2. Torch is training-only, under its [2.6.0 license](https://github.com/pytorch/pytorch/blob/v2.6.0/LICENSE). No paper code, weights, demonstration images or third-party dataset was copied.

[Discontinuity-aware 2D neural fields](https://yashbelhe.github.io/danf/index.html) constructs features around supplied curves. This field has no supplied or learned discontinuity curves and **does not reproduce** that method or Liu et al.'s learned-discontinuity method. The observed blur does not refute those papers.

## Reproduce

From the repository root, with NumPy, Pillow and Torch available:

```powershell
python bin/train_coastal_print_field.py --steps 3000
python -m http.server 4162 --bind 127.0.0.1
# In a second shell; PRINT_FIELD_URL can select another owned server.
node bin/measure_coastal_print_field.cjs
python -m unittest test.test_learned_representation_artifacts
```

Open `http://127.0.0.1:4162/artwork/coastal-home/learned-print/`. The page, weights, captures and trainer stay outside the public dependency graph; `artwork/` is excluded from Jekyll. A later trial needs materially better ink/alpha reconstruction at the same complete payload and measured browser cost. More model capacity alone does not establish a visitor benefit.
