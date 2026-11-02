# Coastal-world rendering research: November 2026

The next large experiment is a cache of static surface information with explicit
invalidation, while preserving live actors, water, plants, shadows and relighting.
It is a research candidate, not a shipped renderer or a claimed improvement over
published methods. The [bounded runner](design-experiment-backlog.md#reproducible-rendering-research-november-2026)
already supplies isolated worktrees, source bindings, structured continuation,
deadlines and retained failures. Extend that system rather than starting another
unbounded agent loop.

## What the existing evidence rules out

The rainy native coast still has a roughly 50 ms frame median at full quality.
The [rain checkpoint](../artwork/coastal-home/reviews/rain-contacts-2026-11-02/README.md)
preserves detail and reduces contact queries, but does not establish a whole-scene
speedup. The [wide-view experiments](../artwork/coastal-home/reviews/wide-view-runtime-2026-10-28/README.md)
already tried material sharing and two pixel-identical contiguous-buffer batching
variants. About 254 fewer draws still made matched native frame pacing worse and
added buffers. Do not repeat those experiments on a draw-count proxy.

The [representation review](graphics-representation-review-2026-10.md) retains
the actual owned trained-Gaussian and image-depth failures. A new neural method
needs new evidence on hidden views, relighting, contacts, training cost and actual
browser execution. A paper's reconstruction FPS does not measure this house.

## Primary literature and fit

| Primary source                                                                                                                                                                                                                                  | Review level and useful finding                                                                                                                                                                                                                               | Consequence for this benchmark                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [HiPR, Padilla et al., SIGGRAPH 2026 Real-Time Live extended abstract](https://graphics.cs.utah.edu/research/projects/hipr/HiPR-SIGGRAPH 2026-RTL.pdf)                                                                                          | Complete three-page method text reviewed. It prioritizes changed tiles through object/depth visibility and discovered light-path dependencies, then eventually updates the remainder. The reference uses Vulkan inline ray tracing.                           | Separate change dependencies from scheduling. The current raster house has no equivalent transport-discovery pass; an image-difference mask is not that pass. No HiPR reproduction or unbiased-convergence claim follows.                                        |
| [Taming optimization variance in compact neural shading networks, Bitterli et al., SIGGRAPH 2026](https://research.nvidia.com/labs/rtr/publication/bitterli2026taming/) and [author implementation](https://github.com/NVlabs/neuralappearance) | Abstract and implementation prerequisites reviewed; full-paper reproduction is still open. The training method retains stronger small-network instances while reallocating their batch budget. The implementation requires Vulkan Cooperative Vector support. | A compact learned material could replace expensive procedural evaluation, but training consistency, browser inference, memory and quality need measurement. The current WebGL runtime cannot inherit the implementation's hardware path by changing an API name. |
| [GHPT, Bo et al., CVPR 2026](https://nwu-vislab.github.io/GHPT/)                                                                                                                                                                                | Author method overview and paper inspected; no reproduction. A reconstructed Gaussian G-buffer is combined with material recovery and mesh-based hardware ray tracing.                                                                                        | G-buffer/lighting separation is relevant; replacing this already authored mesh with a reconstructed field is a different experiment. Its reported desktop result does not predict WebGL or iPhone performance.                                                   |
| [RNG, Fan et al., CVPR 2025](https://openaccess.thecvf.com/content/CVPR2025/html/Fan_RNG_Relightable_Neural_Gaussians_CVPR_2025_paper.html)                                                                                                     | Primary abstract reviewed; a subsequent full-page fetch returned403. It conditions appearance on viewing and lighting directions and adds learned shadow/depth components.                                                                                    | Retain as a lead for bounded owned objects. Do not claim its trained representation, relighting quality or cost without actual weights and evaluation.                                                                                                           |
| [ROGR, Tang et al., NeurIPS 2025](https://papers.neurips.cc/paper_files/paper/2025/hash/3dd1d3a91d338e209f2de35e7f929748-Abstract-Conference.html)                                                                                              | Abstract reviewed; paper retrieved, not fully reviewed. Generative relighting produces data for a lighting-conditioned object NeRF.                                                                                                                           | This solves acquisition/relighting, rather than submission cost for a known articulated world. Generated lighting must not silently become the house's ground truth.                                                                                             |
| [Khronos WEBGL_multi_draw specification](https://registry.khronos.org/webgl/extensions/WEBGL_multi_draw/)                                                                                                                                       | API specification reviewed. Multi-draw exposes multiple argument lists and `gl_DrawID` within a call.                                                                                                                                                         | Capability and fallback must be checked on each real backend. Fewer calls alone failed here already; any new descriptor-based submission path needs actual driver attribution and matched quality/cost.                                                          |

These are targeted fit decisions, not an exhaustive SOTA survey. The newer
papers motivate experiments; they do not authorize a neural, WebGPU or
ray-tracing replacement. Licensing and dependency checks precede any copied
implementation or trained weights. This note includes no third-party figure,
model or texture.

## First new experiment: measured change coverage

`bin/measure_coastal_temporal_reuse.cjs` records the complete owned product with
native clocks, a selected Ghibli avatar, public activity/Rooms/fullscreen/Pause
controls and an actual drag. It captures four moving observations, a paused
repeat and a moved camera in the study, gym and coast. Actual buffers, quality,
camera deltas, animation times and served-body hashes accompany the images.

The [initial census](../artwork/coastal-home/research/temporal-reuse-2026-11-02/README.md)
uses a native RTX 3080 Ti at 2560×1440, high quality and requested MSAA 2. All ten
rooms are loaded and 211 served bodies are retained. There are no console or
request failures. Paused pairs change zero pixels. Actual drags change more than
3.64 million pixels in every view, so camera changes cannot reuse final color
without another correctness mechanism.

For 32-pixel tiles, the study's three moving intervals change 52.78%, 2.31% and
2.36% of tile capacity; the gym changes 93.25–93.92%, and the coast 19.28–40.67%.
The gym camera also moves by 24–32 micrometers between observations. These are
actual 2.4–4.6-second screenshot intervals, not adjacent display frames or a
benchmark frame rate. The initial study interval remains in the result; it is
not discarded as warmup. A separate 2/255 diagnostic does not replace the exact
gate. Readback, screenshots and inspection instrumentation make these records
unsuitable for performance claims.

An offline oracle copies changed target tiles into the preceding image and
reconstructs the exact target. That checks accounting and edge handling; it does
not predict dirty tiles or demonstrate saved rendering work. In particular,
freezing last-frame RGB or assuming a static room is safe is not admitted.

## Next bounded hypotheses

1. Cache expensive static geometry/material evaluation, not finished lighting.
   Start with an unused lab module and explicit source/camera/projection,
   geometry, material and visibility generations. Every undeclared dependency
   invalidates. Preserve depth, fine surface detail and object/receiver identity.
2. Classify animated/deformed/transmissive surfaces explicitly. Water, rain,
   actors, cloth, rooted wind, doors, fire and mirrors continue their real paths.
   A dynamic shadow, indirect source or changed reflection must invalidate its
   affected data; unsupported cases take the original renderer.
3. Compare a material-space cache with a compact learned-material experiment
   only after held-out view, illumination and resolution tests exist. Include
   training duration, repeated-seed variation, weight/texture bytes and actual
   browser inference cost. An untrained network is not a compression result.

Before a renderer trial, freeze the complete product and run the correctness
controls first. Use exact masks, per-surface comparisons, held-out views and
motion/contact/occlusion sequences. Keep aliasing, temporal instability and
highlights visible in the evidence. Then reserve a quiet native ABBA window
with identical buffer/MSAA, clock/pose, backend and assets; use actual GPU/driver
attribution alongside CPU submission and whole-frame intervals. Add a modern
WebKit functional fallback and a separate physical-iPhone measurement. Record
memory, compilation/startup and p95, not just the fastest median.

The current house, fuller authored detail and three coastal scenes remain the
reference. A result may be better for this task without beating a published
method generally. A stronger claim needs its actual nearest method, code,
settings, training cost and comparable held-out benchmark. Failed or slower
results remain part of the research record.

## Resume

Use queue entry `dependency-aware-surface-reuse` for this next source review and
`compact-neural-material` for the separate trained-material lead. Both remain
proposed until their exact method, dependency contract and executable gates are
reviewed. The daily task discovers only queued sources and spends no model
tokens. An explicit bounded `review` or `run` can select a later model; neither
automatically admits, commits, pushes, signs a cache or publishes a renderer.
