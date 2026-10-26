# Water, hills and retained stills: PC review, October 26

This checkpoint extends `4b77a54d9cda04d81ed416f38a7d4d999970753e` after Sirui's PC review. It improves the footer and Connect/project miniature without editing the main home's geometry, renderer quality controller, wildlife or lighting cache. The coastline's authored architecture and public copy remain. It is still a stylized miniature, not a photoreal reconstruction.

## What changed

The water now renders a submerged sand/reef mesh into a full-canvas color/depth target. The footer's grid has 49,665 vertices and 98,304 triangles. Snell-refracted rays meet that relief; Beer–Lambert extinction and homogeneous single scattering account for the water column. Water's dielectric Fresnel response replaces the earlier view-normalized reflection boost. Normals follow the geometric wave derivatives plus smaller wind ripples. The bottom and planar reflection refresh on demand rather than adding a steady render pass. The optics and geography references, authored coefficients and bathymetry boundary are in [provenance](../../PROVENANCE.md).

The distant hills use 0.25°×0.04° relief instead of 1°×0.08°. Shading follows the measured ground normals under sun and sky; the presentation studio no longer illuminates terrain kilometres away. Actual OpenStreetMap polygons supply the selected buildings' widths/depths and distances. Small facade/roof/window glyphs replace circular points. Eleven selected buildings have height or levels tags; the other 1,189 use an explicit 6 m display assumption. Sixteen bounded primary map-API reads supplied the polygons after Overpass failures. [The source receipt](../../skyline/provenance.json) records every URL, raw hash and retrieval time. Raw inputs remain ignored; no reference-photo pixels are committed.

The darker water exposed two afternoon credit failures, each about 4.287:1 at the median glyph ring. A denser daytime halo repaired them: 5.979:1 at 768 pixels and 6.151:1 at 390 pixels. The gate measures the median ring; it is not a claim that every background pixel or the whole site satisfies a contrast standard.

A separate before-control found a blank first reduced-motion frame in Windows WebKit on both the old source and the candidate. A subsequent draw restored the model. Preserving the drawing buffer keeps the first still painted as the formerly hidden canvas appears. This retains framebuffer storage and may add browser copy work; it is not a free performance change. The WebKit probe reports a generic `Apple GPU` string on this host. It establishes engine behavior, not a physical Apple device or phone measurement.

## Evidence and limits

`capture.cjs` renders complete pages with only footer modules/relief routed to pinned before and current after sources. It retains matching 2560- and 3840-pixel noon/evening views, renderer strings, full buffer sizes, errors and exact source/image hashes under `.jekyll-cache/visual-qa/site-fidelity-2026-10-26/matched-final/`. Models, textures, fonts and page assets stay available. These are native RTX 3080 Ti/D3D11 renders at emulated viewport sizes. Selected images and `receipt.json` in this folder make the checkpoint portable.

The full local QA folder retains all attempts: the first overly flat hill pass, subsequent lighting passes, the first full footer run with two credit failures, the WebKit failures, the old/new/preserved-buffer controls and the earlier cost study. The selected water ablations disable bottom color, scattering, reflection and depth attenuation at the same camera/time; restoring the complete state restores its pixels. An unattenuated-bottom view is a diagnostic, not the intended sea appearance.

Remaining limits: the relief stays on a far plane, small canyons and some Village transitions remain soft, and building glyphs are not detailed meshes. Most heights are assumed. The underwater canyon/reefs are authored rather than surveyed; optical coefficients are not live water measurements. Caustics and bright-light streaks remain approximations, with no multiple scattering or photon tracing. The page's cream-to-navy turn and slightly purple deep twilight are unchanged. Physical-phone cost and Sirui's acceptance of the new appearance remain open.

## Bounded cost study

`measure.cjs` uses complete bare-footer scenes, three interleaved pairs per viewport and 24 actually drawn callbacks per run, in fresh contexts within one Chromium process. All twelve final runs identified native RTX 3080 Ti/ANGLE/D3D11, used full buffers, had no runtime errors and had valid nondisjoint GPU queries. Only owned GPU jobs were quiet; CPU work and other PC apps were uncontrolled. `cost.json` retains individual samples and exact input hashes.

| Viewport                | Callback CPU p50, before → after | Queried GL GPU p50 | First-ready wall median | Steady draws |
| ----------------------- | -------------------------------- | ------------------ | ----------------------- | ------------ |
| 2560×480                | 2.60 → 2.70 ms                   | 3.062 → 2.850 ms   | 554 → 736 ms            | 324 → 324    |
| 390×480, host emulation | 2.40 → 2.00 ms                   | 0.182 → 0.190 ms   | 683 → 726 ms            | 200 → 200    |

These are medians of three run medians, with substantial pair spread; they support no speedup or FPS conclusion. The existing cap yielded 33.3 ms median drawn-callback gaps. GPU queries cover submitted GL work and exclude later compositor/presentation or retained-buffer copies. New bottom construction took 41.5–44.6 ms of CPU in this run; its initial submission took 9.3–23.7 ms at 2K, including initialization/compile work. The target rendered once and was then reused. The 390-pixel result is not phone performance.

## Verification

- Python: 314 passed. Node: 806 passed, 7 skipped; final touched optics/sky modules also passed targeted checks.
- All twelve runtime posters regenerated together. Final production `/al-folio` build passed in 89.118 seconds; targeted formatting/style checks passed.
- Initial full Chromium footer run: 53 passed, 37 skipped, 2 afternoon contrast failures retained. After the halo repair, all 18 theme/clock cases passed (2 intentionally skipped), covering four widths, four anchors, dusk and dawn. The two repaired cases also retain their numeric contrast receipts.
- After framebuffer preservation, Windows WebKit passed four focused loading, afternoon/evening and transport-ablation cases. The new legacy first-static-frame regression passed Chromium desktop and WebKit mobile emulation.
- Final framebuffer loading/context/transport checks: 14 passed, 6 intentionally skipped. The exact checkpoint receipt is recorded in `receipt.json`.

The four-width morning/noon/afternoon/evening contact sheets were inspected at the checkpoint. Selected 2K/4K views retain the full source framing; `water-ablations.png` shows the same-camera transport controls. The hill silhouettes and small facade glyphs read more distinctly, but the far-plane terrain remains simplified. The new public regression is `coastal sea: refracted bottom and volumetric light use the current relief`; the legacy cross-engine regression is `coastal reduced-motion first frame stays painted before any interaction`.

The coordinator owns registry integration, CI, publication, live verification and the main handoff. Preserve the ignored QA folder and `.jekyll-cache/coastal-skyline/` inputs before removing this worktree.
