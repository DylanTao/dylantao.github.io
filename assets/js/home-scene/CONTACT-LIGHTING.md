# Contact light in the coastal room

This follow-up corrects the room's contact-lighting terms. It is a small original browser implementation derived from [Jimenez, Wu, Pesce and Jarabo, Practical Realtime Strategies for Accurate Indirect Occlusion, ATVI-TR-16-01, 2016](https://www.activision.com/cdn/research/PracticalRealtimeStrategiesTRfinal.pdf). It does not implement that paper's complete GTAO/GTSO system, claim its ground-truth agreement or timing, or establish current SOTA quality. The homepage retains its controls, avatars, authored Pacific clock and shared record state.

## Observed problem

The previous `SSAOPass` multiplied the finished beauty image. That attenuated direct sunlight, reflected highlights and emission in addition to diffuse ambient light. Its unweighted 5 × 5 blur mixed visibility across unrelated surfaces, producing gray edge halos. Its normalized-depth bias of 0.00015, with the room camera's 0.05–300 m range, also ignored roughly 4.5 cm of depth difference. Small prop and foot contacts could disappear. The random per-document kernel made repeated stills differ.

Matched actual room screenshots preceded this change. The new finish computes a visibility buffer before the beauty pass, filters it using surface geometry, and applies it within each physical material's lighting calculation. Existing wood, cloth, skin, leaf, water and reflection shader hooks and cache identities are preserved. The footer's transparent finish keeps its existing pipeline.

## Horizon integral and reconstruction

`contact-occlusion.mjs` projects the geometric normal into each view-oriented slice. For signed projected-normal angle γ, negative/positive horizon angles h₁/h₂, and projected-normal length L:

```text
F(h,γ) = [cos γ - cos(2h-γ) + 2h sin γ] / 4
slice visibility = L [F(h₁,γ) + F(h₂,γ)]
```

This is the paper's analytic cosine-weighted inner integral. The site uses four fixed slice orientations, four radial steps and two sides, for at most 32 depth probes per pixel. It sums the slice integrals and normalizes by the same finite quadrature for the unoccluded hemisphere. This local normalization makes an unobstructed inclined plane exactly one; it is an approximation to the outer angular integral. Independent numerical quadrature and an analytic visible-cone test check the inner integral.

The search radius is 0.36 m. Projection converts it to pixels, capped at 40; a 2 mm normal offset rejects surface self-occlusion. Far samples blend to the current horizon over the last 35% of the metric radius. Background and offscreen samples contribute no occluder. These radius, bias and attenuation values are authored quality choices, not measured material properties.

A 3 × 3 reconstruction weights a neighbor by spatial distance s, symmetric distance d to the two tangent planes, and normal agreement c:

```text
weight = exp(-0.5(s/1.25)² - (d/0.018 m)²) max(0,c)¹⁶
d = max(|(Q-P)·N_P|, |(Q-P)·N_Q|)
```

Using tangent-plane distance retains adjacent samples on an inclined surface while rejecting separate depth layers and normal discontinuities. A unit test checks rejection of a neighboring wall/depth layer. The visibility buffer retains the existing 480-pixel maximum dimension and is sampled during material shading. Its final bilinear upsampling is not a full-resolution bilateral upsampler; silhouette contacts smaller than that buffer's pixel footprint remain limited.

There is no stochastic rotation or temporal accumulation. A composed still is deterministic, and camera changes have no stale history to reproject or reset. This avoids temporal trails but does not eliminate spatial aliasing or the directional bias of four fixed slices.

## Diffuse bounce and correct lighting term

For visibility A and linear diffuse albedo ρ, the paper's local cubic fit gives:

```text
G(A,ρ) = (2.0404ρ - 0.3324) A³
       + (-4.7951ρ + 0.6417) A²
       + (2.7552ρ + 0.6903) A
effective visibility = clamp(max(A,G(A,ρ)), 0, 1)
indirect diffuse *= effective visibility
```

The fit approximates light reflected by a neighborhood of similar albedo. Pale stone and linen corners retain some diffuse bounce instead of receiving the same gray attenuation as black material. It cannot reproduce colored light arriving from differently colored nearby objects; clamping albedo outside the paper's sampled 0.1–0.9 range is a bounded extrapolation. It is not a global illumination solver or an exact energy identity. Tests ensure zero albedo retains A, more reflective albedo never reduces bounce, and the factor remains between A and one.

Only `reflectedLight.indirectDiffuse` receives this factor. Direct sunlight, emission, indirect specular, clearcoat and sheen retain their existing lighting behavior. GTSO/bent-normal/specular occlusion is not implemented. Hemisphere and sky illumination are not uniform, so this scalar AO remains an approximation to that directional environment.

The unlisted original-geometry [lighting study](./contact-lab.html) compares no contact shading, the previous full-image composite, and the new method using the same camera. Its sun-only condition checks direct-light invariance; its ambient condition exposes contact and local-bounce changes. This study is not part of the public homepage flow.

## Lifecycle, portability and cost

The room finish reuses the existing half-float normal/depth, visibility and blur targets, then renders beauty and tone mapping. It removes the previous beauty copy and whole-image AO multiply: five rendering stages replace seven, with two fewer full-screen draws and no new GLB, raster image or public control. The normal buffer still comes from a geometric override material; custom procedural bump detail and the leaf's tiny vertex sway are not represented in that buffer. Screen-space depth cannot see hidden/offscreen geometry, and it overestimates thin occluders without depth peeling or the paper's thickness heuristic.

Uniform objects belong to one finish, avoiding cross-canvas texture state. A wide exterior view disables contact lighting; an explicit animal inspection enables the same bounded pass and binds streamed native materials to its uniforms. The ocean's undisplaced normal-override plane has a contact-only exemption, preserving its displaced beauty, reflections and arrival raycasts. `withoutContactLighting` also suppresses contact shading for auxiliary mirror draws, including the first interior-to-exterior frame, then restores the previous state in `finally`. The mirrored camera never samples the main camera's visibility buffer. No accumulated AO history survives hidden/offscreen suspension, reduced motion, camera changes or renderer disposal. Shadow-map updates and scene visibility are restored after the prepass, including an exception path. The shader uses bounded constant loops and Three r164's existing WebGL2 depth textures; it introduces no additional required GPU extension.

`gpu-timer.mjs` optionally samples the finish every eighth lab frame with [Khronos EXT_disjoint_timer_query_webgl2](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/). It reads results only after completion, bounds pending queries to four, discards disjoint results and deletes queries on disposal. Public pages do not request the extension. Unsupported devices report unavailable timing; this extension is telemetry, not a rendering requirement.

The two new public runtime modules are 9,511 source bytes / 3,558 gzip bytes when compressed individually. Existing-controller/material/finish edits add code as well. The unlisted comparison's module is 4,657 bytes / 1,867 gzip and is not requested by the homepage. No new image or model transfer is added.

## Actual evidence

Ignored `.jekyll-cache/visual-qa/coastal-contact-followup/` contains matched `before-*` / `after-*` PNGs of the study, kitchen, gym and onsen. They use the same October 1, 2026 authored local time, camera, Ghibli model and reduced-motion pose within each pair. The study's shelf edges and pale countertop/room contacts retain clearer surface separation. `lab-direct-comparison.png` and `lab-indirect-comparison.png` show the controlled original-geometry study.

The recorded Chromium controlled capture compares each 392 × 328 canvas with the no-AO view. A pixel counts as changed when any RGB channel differs by more than two 8-bit levels:

| Lighting condition | Previous composite changed pixels | New horizon changed pixels | New mean absolute RGB difference | New maximum RGB difference |
| ------------------ | --------------------------------- | -------------------------- | -------------------------------- | -------------------------- |
| Sun only           | 4.96%                             | 0.00%                      | 0.00                             | 0                          |
| Ambient only       | 8.96%                             | 13.51%                     | 1.28                             | 50                         |
| Sun and ambient    | 8.12%                             | 9.02%                      | 0.79                             | 49                         |

This establishes direct-term invariance and an observable indirect effect; the changed-pixel ratio is not a ground-truth accuracy score. The old pass's random kernel means its exact ratio varies between loads (the earlier sun-only capture was 5.41%). The new horizon output repeated identically for unchanged geometry; direct-only invariance held in every capture. Chromium ANGLE/D3D11 and Windows Playwright WebKit both passed the rendered sun-only pixel-invariance test and produced nonblank WebGL2 output without shader errors. This is two local browser engines, not coverage of all GPU drivers.

Real-clock measurements on October 1, 2026 at about 21:03 Pacific used a 1440 × 1000 viewport, actual 544 × 460 drawing buffer and 480 × 406 AO buffer on an NVIDIA GeForce RTX 3080 Ti / ANGLE Direct3D 11. The camera, avatar and authored time matched for each room. One browser context at a time sampled 64 completed GPU queries over the finish, then the last 150 of 660 native animation-frame intervals. No Playwright fake clock was installed:

| View    | Previous GPU median / p95 | New GPU median / p95 | Previous / new median JS submission | Previous / new frame median |
| ------- | ------------------------- | -------------------- | ----------------------------------- | --------------------------- |
| Study   | 4.11 / 11.83 ms           | 5.83 / 9.98 ms       | 6.70 / 5.30 ms                      | 16.7 / 16.7 ms              |
| Kitchen | 5.59 / 12.56 ms           | 4.21 / 10.08 ms      | 7.50 / 5.20 ms                      | 16.7 / 16.7 ms              |
| Gym     | 8.84 / 17.01 ms           | 5.34 / 9.77 ms       | 8.60 / 6.70 ms                      | 16.7 / 16.7 ms              |

Frame p95 remained 16.8 ms, except the new gym capture at 16.7 ms. These are short observations on a shared host, with live poses and companion draw counts varying slightly. They measure the whole finish, including the existing complex model/shadow work and GPU submission gaps; they do not isolate AO-only GPU cost or establish a universal speedup. In the study the median GPU interval increased. Mobile input checks are not a mobile GPU benchmark.

`test/coastal-contact-lighting.test.mjs` checks independent arc quadrature, analytic cone visibility, bounded albedo response, edge reconstruction, preserved shader hooks/cache identities, auxiliary-camera suppression and GPU-query completion/disjoint/disposal behavior. `test/coastal-contact-rendering.test.mjs` checks actual direct/indirect pixels, actual `contactEnabled` uniforms during first-transition mirror draws, and a real `WEBGL_lose_context` failure followed by a clean one-canvas retry. Run against the owned external Docker preview:

```powershell
$env:COASTAL_BASE_URL='http://127.0.0.1:8082'
node --test test/coastal-contact-lighting.test.mjs test/coastal-contact-rendering.test.mjs
$env:COASTAL_BROWSER='webkit'
node --test --test-name-pattern='rendered horizon' test/coastal-contact-rendering.test.mjs
```

The rendered tests explicitly skip when no `COASTAL_BASE_URL` is supplied; that skip is not rendering proof. The reflection test checked 171 actual physical draws at the mirror target with `contactEnabled=false`. Existing desktop light/dark and mobile nonblank orbit/zoom, touch pinch, hidden/offscreen recovery and failed-mesh retry checks passed on the owned Docker server. The coordinator owns the combined affected-route checkpoint and production build; this is a local rendering iteration, not publication approval.
