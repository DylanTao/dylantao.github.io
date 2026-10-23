# Representation and ink review, October 23, 2026

The visitor question is whether a representation can improve this freely explored, relit, inhabited house at its
current download and frame budget. A paper's reconstruction benchmark is not a measurement of this site.

## Source review and disposition

| Candidate                                                                                                                | What its primary source actually provides                                                                          | Fit and decision for this house                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [3D Gaussian Splatting, Kerbl et al., SIGGRAPH 2023](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)          | Optimized anisotropic Gaussians and visibility-aware splatting reconstruct radiance from calibrated images.        | The retained [image-depth study](../artwork/coastal-home/splat-lab/FINDINGS.md) is an image-derived splat comparison, **not** this training method. It exposed missing occluded surfaces and did not establish a performance win. Keep the authored, relightable mesh. A new comparison needs calibrated multiview training and a separately reviewed runtime/license. |
| [TensoRF, Chen et al., ECCV 2022](https://apchenstu.github.io/TensoRF/)                                                  | Low-rank vector/matrix factors encode density and view-dependent color in a radiance field.                        | Factorizing the current mesh's coordinates would not implement this method. There are no trained field weights or calibrated reference set in the site. Do not ship an untrained placeholder or claim compression savings. Revisit for a bounded static object after recording trained bytes, held-out views and browser inference cost.                               |
| [Neural Geometric LOD, Takikawa et al., CVPR 2021](https://nv-tlabs.github.io/nglod/)                                    | Octree feature volumes, neural signed-distance evaluation and interpolation between detail levels represent shape. | The furniture's authored mesh LODs remain mesh LODs. Neural evaluation, surface traversal, materials and animation integration would be a new pipeline. Keep the functioning mesh swaps; no neural speed or quality claim is accepted.                                                                                                                                 |
| [Discontinuity-Aware 2D Neural Fields, Belhe et al., SIGGRAPH Asia 2023](https://yashbelhe.github.io/danf/index.html)    | A feature field can remain discontinuous across supplied curves while being smooth elsewhere.                      | It addresses a 2D field, not unseen 3D surfaces or an articulated house. Potential fit: compress an original static illustration with known edges. No training/compression result is fabricated from a generic edge shader.                                                                                                                                            |
| [Real-time Hatching, Praun et al., SIGGRAPH 2001](https://collaborate.princeton.edu/en/publications/real-time-hatching/) | Tonal art maps coordinate stroke density across tone and resolution.                                               | A useful source for asking whether marks belong to a surface and survive changes in scale. The small surface-ink experiment below does **not** implement tonal art maps, lapped textures or curvature-aligned strokes.                                                                                                                                                 |

Additional named families from the original queue were checked against their primary sources:

| Candidate                                                                                                         | Method and disposition for this site                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Scaffold-GS, Lu et al., CVPR 2024](https://city-super.github.io/scaffold-gs/)                                    | Learned anchor features decode view-dependent local Gaussians. These anchors are not furniture placement anchors. A trained static scene and a browser decoder are prerequisites; neither is added here.                                                                                                                                                             |
| [LightGaussian, Fan et al., NeurIPS 2024](https://lightgaussian.github.io/)                                       | Pruning, spherical-harmonic distillation and quantization compress an already trained Gaussian field. It cannot compress the site's GLBs directly. No site compression ratio is claimed; revisit after a trained field earns its place.                                                                                                                              |
| [4D-GS, Wu et al., CVPR 2024](https://guanjunwu.github.io/4dgs/)                                                  | Decomposed space-time features and an MLP deform Gaussians over learned time. A recorded sequence is a different contract from interactive cloth, arbitrary walking and relighting. Keep live simulation; revisit a bounded prerecorded vignette with multiview training and held-out times.                                                                         |
| [Variable Bitrate Neural Fields, Takikawa et al., SIGGRAPH 2022](https://research.nvidia.com/vbnf)                | A learned dictionary compresses feature grids using vector quantization and supports multiple resolutions. This is not ordinary Draco mesh compression. Training, dictionary bytes and browser neural evaluation remain unimplemented; no memory win is inferred from the paper.                                                                                     |
| [2D Neural Fields with Learned Discontinuities, Liu et al., Eurographics 2025](https://doi.org/10.1111/cgf.70023) | Extends discontinuity-aware 2D fields by learning which mesh edges carry discontinuities. It can fit an image without supplied edge curves, but does not recover the house's hidden geometry. Revisit one original static print with real trained bytes and zoom comparisons.                                                                                        |
| [StyleGaussian, Liu et al., SIGGRAPH Asia 2024](https://kunhao-liu.github.io/StyleGaussian/)                      | Embeds scene features into reconstructed Gaussians, transforms them from a style image, and decodes stylized colors. It requires the reconstructed field and trained feature pipeline; the procedural hatch comparison below is not this method. Retain it as a separate learned-stylization candidate, with owned style inputs and measured browser costs required. |

This is a targeted review of the queued methods and representative descendants, not an exhaustive survey.
These are completed source/fit decisions, with the unimplemented learned pipelines retained as explicit future
experiments. They are not completed reproductions. Original author code, weights, reference photographs and demo
assets have not been copied into production. Any later adoption must check the exact implementation and asset
licenses, train/evaluate honestly, and pass matched camera, bytes, interaction and frame-time comparisons.

## Bounded NPR experiment

The archived illustrated material puts its dots and hatching in screen coordinates. The separate
"Compare ink studies" action under Graphics studies in `?scene-lab=1` anchors two authored hatch directions in world coordinates, shades in a consistent world
frame, and uses derivatives to fade subpixel strokes to their mean coverage. It uses the same geometry, palette,
toon ramp, camera, clock and outline pass. No neural network, new texture, model download or render target is added.
The archived screen-space material is the comparison baseline. The active home remains Realistic, including the
authoring lab; neither image changes its style. Characters, transparent surfaces, water and postprocessing are
excluded from this explicitly static-geometry study.

The adaptation is deliberately narrower than the paper: crossed analytic lines replace tonal art maps; world axes
replace curvature directions; a soft coverage average replaces a multiresolution texture construction. On articulated
characters the world pattern moves through the skin, so this comparison is most meaningful on the static house.
It remains an authoring experiment until matched captures and costs justify a different default.

Reproduce with the actual built homepage, freeze its preview date/hour, set the lab camera, and select "Compare ink
studies". Both images use that same view; the `labScene.captureInkStudy(false/true)` API also returns the image and
measurements separately. Record renderer, viewport/DPR, warmup,
submission/frame timings, draw calls, triangles and downloaded bytes. Do not interpret display-capped FPS as equal
GPU cost. [Retained real-browser evidence](../artwork/coastal-home/reviews/graphics-studies/README.md)
contains the matched images, exact served-module hashes, raw costs, cancellation checks and post-disposal zoom proof.
At 640 by 540, both ink studies drew 448 static meshes in 508 calls; the five synchronized draws had medians of
14 ms for screen ink and 18 ms for surface ink in one local run. The quieter candidate establishes a different
working treatment, without establishing better quality or speed. The active Realistic home remained usable.
