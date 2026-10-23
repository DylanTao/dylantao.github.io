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
GPU cost. Results are recorded at the release checkpoint after the integrated scene is captured.
