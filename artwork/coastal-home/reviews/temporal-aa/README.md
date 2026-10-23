# Moving temporal reconstruction, October 23

**Decision: retain the public spatial default; accept this bounded authoring experiment.** `?scene-lab=1&antialias=temporal` now runs real moving-frame reconstruction. It is separate from the frozen spatial-photo experiment. The module is not imported without the explicit flag.

## Independent moving reference

The registered native fixture renders 24 moving frames of subpixel diagonal geometry and camera translation at 128×128. Each of the last eight current poses has its own independent reference: 16 centered spatial samples, each with four-sample MSAA. References never average different moving poses. Baseline and candidate use the same geometry, shading, camera pose and four-sample beauty buffer; the candidate adds jittered history.

| Metric across held-out evaluation frames | Spatial baseline | Temporal candidate |
| ---------------------------------------- | ---------------: | -----------------: |
| Mean RGB squared error                   |       0.00425447 |         0.00200763 |
| Mean edge RGB squared error              |       0.02477091 |         0.00875201 |
| Sum of squared changes in frame error    |        412.51457 |          115.29458 |

Edge error improves about 65%, and variation of frame error about 72%, in this fixture. The latter measures error variation relative to a moving-pose reference, not a universal perceptual shimmer score. Direct inspection of [baseline](baselineImage.png), [candidate](finalImage.png) and [reference](referenceImage.png) shows less broken coverage with some residual softness. This does not establish universal house, water, lighting, phone or performance superiority.

[The raw positive record](native.json) includes every evaluated frame and exact normalized source hashes. The native acceptance case runs in Windows Chromium and Linux Docker Chromium. Its deliberate [disabled-depth control](disabled-depth.json) changes only the prior-depth gate: revealed-region error increases from **0** to **0.03117**, failing the positive criterion. The registered test asserts that this negative result remains detectable.

## Integration and cleanup checks

- Actual previous bone, CPU vertex and camera motion produce measured X velocities `0.032135`, `0.032135` and `−0.028229`, matching independent projected expectations within half-float precision.
- Newly revealed surfaces and a genuinely transparent reactive surface both match the current jittered image in the measured interior (MSE zero). Current reactive coverage cannot be overridden by dilated neighboring motion. Raw/unsupported drawables disable accumulation for the whole frame.
- A depth consumer in the actual finish pipeline reads **0.741176**, versus expected **0.740741**; the earlier color-copy implementation returned cleared depth **1** and failed this check. The copy now disables automatic clearing and leaves beauty depth intact for haze.
- Deliberate preparation and cleanup failures restore projection and inverse. Removed skinned geometry loses its auxiliary attribute; only the live 48-byte fixture vertex history remains. Disposal releases owned targets/materials/bone textures and auxiliary geometry attributes. A 2000×2000 resize disables accumulation and shrinks targets to 1×1.
- [Actual-house evidence](home.json) and [capture](home-active.png) use real RAF/performance, fixed Date only, the full scene and its haze. Keyboard camera input, reduced-motion reset, temporal disable and resume work without console/page errors. One 496×409 moving sequence reported 28 timing samples, 45 ms median interval and 27 ms median submit. Startup/streaming outliers remain in the record; this is a single native sequence, not an ABBA cost comparison.

The first unaccepted algorithm was worse than the baseline: global error 0.004797, edge error 0.02783 and frame-error variation about 1480. Surface-footprint velocity/depth handling and clipping-based reactivity corrected that outcome. Review also caught cleared downstream depth and retained old geometry; the new native assertions cover those failures. Initial one-off house attempts used software rendering and a screenshot stability wait; their ignored diagnostic logs remain, rather than being relabeled as passing evidence. The corrected runner uses the repository's Windows D3D11 launch options and a direct viewport crop.

## Cost and limits

Two HDR histories and two motion/depth targets require about **40 bytes/pixel**, capped at **1.1 MP** (44 MB targets). The recorded house canvas uses 8,114,560 target bytes plus 4,866,504 bytes of CPU previous-position arrays and 46,336 bytes of CPU bone history. Geometry and bone data also have GPU copies; these figures are not a complete process-memory accounting. The 128-square blocking-submit sample is not a pure GPU timestamp or a general device budget.

Transparent water/glass, custom shader deformation, instancing and morphs retain current coverage rather than fabricated histories. Lighting/reflection motion is only conservatively rejected by color change. Velocity dilation and reactive edges remain bounded approximations; real sky/water silhouettes can receive less benefit than the opaque fixture. Full-screen buffers beyond the cap keep spatial rendering. These are reasons to keep the explicit opt-in and the original public default.

Reproduce the native positive/negative case with an owned built server and `NO_WEBSERVER=1`, `VISUAL_BASE_URL`, then:

```powershell
npx.cmd playwright test --config test/visual/public.config.js desk-scene.spec.js --project desktop-1440 --grep "coastal temporal:" --workers 1
```

The [implementation note](../../../../assets/js/home-scene/TEMPORAL-AA.md) explains pass order, resets, ownership and source/license boundaries. This is original temporal reconstruction code, not the adaptive ray-tracing implementation from the cited research paper.
