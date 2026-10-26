# PC full-screen quality, October 26

The desktop image should retain useful geometry and material detail. Sirui's preview was drawing 1880x957 into a 2560x1303 view after a permanent tier reduction. This checkpoint makes pressure reductions reversible, checks available GPU timing, raises the desktop full-screen density floor to 0.8 and restores the budgeted native buffer for paused/reduced-motion stills. Compact touch keeps its separate budget and 0.6 floor. The renderer requests the high-performance GPU.

The six native Chromium runs in [quality-receipt.json](quality-receipt.json) compare `8f13a4646` with only controller/quality/resolution changed, using complete delivered assets and native animation scheduling. They identify the RTX 3080 Ti through ANGLE/D3D11. The receipt binds those three experimental source files and the model inputs, records actual canvas dimensions, retains all moving samples and names every original PNG's hash. These are **before the cliff/wildlife revision**, whose combined production acceptance is separate.

| Comparable state                    | Baseline                                            | Repair                                               |
| ----------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| 2K stable view, original dimensions | [A, retained 1536x864 buffer](2k-base-a-still.webp) | [A, restored 2560x1440 buffer](2k-work-a-still.webp) |
| 2K moving view                      | Original retained locally                           | [2560x1440](2k-work-a-moving.webp)                   |
| 4K stable view                      | [3840x2160](4k-base-still.webp)                     | [3840x2160](4k-work-still.webp)                      |
| 4K moving view                      | Original retained locally                           | [3840x2160](4k-work-moving.webp)                     |

The WebP derivatives retain original dimensions without cropping. Fixed routine time does not freeze animal animation; these captures establish buffer/detail behavior, **not exact still parity**. The 2K pair sequence is base/work/work/base; 4K has one pair. All six runs have zero page/console errors. The [probe recipe](probe-quality.cjs) requires an already built `/al-folio/` server and routes only scene modules and model assets from this checkout; production Jekyll and browser gates remain separate.

The wide view still costs about 78-80 ms per moving frame at native 2K and 127 ms in the single native 4K work sample. The callback can wait in the WebGL driver; its elapsed GPU query excludes earlier reflection work and later presentation. There is no FPS gain, physical-phone or actual context-loss claim. [Performance notes](../../../../docs/performance-notes.md) give the complete table, scope and WebGPU assessment.

Material sharing was tried and withdrawn. [Broad reuse](material-parity.json) changed 100,186 exact study pixels (53/255 maximum), despite matching same-version controls. [Wood/metal only](material-parity-v2.json) still changed 28,850 (21/255 maximum). Passing a perceptual threshold is not exact parity. Neither runtime variant ships and neither has a claimed speed gain. Both recipes, full sources, tests and ABBA PNGs remain under `.jekyll-cache/visual-qa/pc-fidelity-2026-10-26/material-sharing-attempt{1,2}/` and `material-parity{,-v2}/`. Next inspect receiver/uniform ownership and depth ties before another sharing or batching attempt.
