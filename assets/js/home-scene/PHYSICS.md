# Coastal room and record physics

This October 2026 site customization adds a browser-sized subset of research-derived water rendering and mechanical motion. It is not a validated current SOTA simulation, an implementation of a complete SIGGRAPH paper, or a reconstruction of an actual La Jolla building or weather observation. The Blender objects and human improvements are a separate authored-model change.

## What changed

The previous sea already had analytic vertical waves, procedural foam, a live reflection, a sky environment and contact shading. The new work adds choppy horizontal displacement, a common dispersive field for geometry and pixel normals, footprint filtering with unresolved slope energy, and dielectric reflection applied to the correct lighting term. Existing SSAO, particles, planar reflection and procedural material texture should not be credited as newly invented techniques.

The record previously used prescribed rotation and a simple arm interpolation. Both the rendered player and its CSS/SVG fallback now use the same driven-rotor integral and staged lift/swing/lower mechanism. The study platter uses that same mathematical model with its own continuous state. Selection and the requested spin state remain shared between the two views. The public arrival remains a stationary portrait; nothing plays audio or pretends to advance a music track.

A subsequent [contact-lighting pass](./CONTACT-LIGHTING.md) replaces the room's whole-image SSAO composite with cosine-weighted horizon visibility applied to indirect diffuse light. That note records its separate equations, primary source, controlled comparisons, costs and limits. It does not change the water or mechanical models below.

## Ocean field and scale transition

`ocean-spectrum.mjs` authors ten bounded wave components, with wavelengths from 24.7 m to 0.061 m. Units are meters and seconds. For component direction **d**, amplitude _a_, wavenumber _k_, choppiness _q_ and phase _φ_:

```text
θ = k d·(x,z) - ω t + φ
ω² = g k + (σ/ρ) k³
D = (q a d.x cos θ, a sin θ, q a d.z cos θ)
P = (x,0,z) + ΣD
N = normalize((∂P/∂z) × (∂P/∂x))
```

Here `g = 9.80665 m/s²`, `σ = 0.074 N/m`, and `ρ = 1025 kg/m³`. Analytic tangents differentiate the actual choppy displacement, including its horizontal Jacobian. The steepness sum `Σqak < 0.3` bounds the horizontal perturbation and prevents foldover for this authored spectrum. Finite differences of displaced positions test the tangents; a grid over time tests the determinant against `(1 - Σqak)²`.

A Gaussian band weight `w = exp(-0.5(k f)²)` filters each amplitude for footprint _f_. The vertex stage uses a conservative 1.1 m footprint. The fragment stage derives _f_ from `dFdx/dFdy` of ocean coordinates. Unresolved mean-square slope is `v = Σ0.5(ak)²(1 - w²)`. Resolved slope energy plus _v_ equals the original authored spectrum's slope energy; a numerical test verifies that accounting.

`environment.mjs` broadens the material with `r_eff = (r⁴ + v)^(1/4)`, clamped to `[0.14,0.65]`. This is a **scalar isotropic appearance fit**. It does not reproduce the 2010 paper's anisotropic slope covariance, full statistical BRDF or exact filtering, and it is not an exact moment identity for GGX's heavy-tailed slope distribution. It reduces distant shimmer and keeps short-wave energy from simply vanishing.

Source relationships:

- [Finch, GPU Gems: Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models) supplies the practical Gerstner displacement, derivative and steepness framework.
- [Bruneton, Neyret and Holzschuch, Real-time Realistic Ocean Lighting using Seamless Transitions from Geometry to BRDF, Computer Graphics Forum 29(2), 2010](https://evasion.inrialpes.fr/Publications/2010/BNH10/) motivates transferring unresolved surface detail into reflectance statistics. The implementation here is the bounded scalar approximation described above.
- [Arc Blanc: A Comprehensive Real-Time Ocean Simulation Framework, 2025](https://arxiv.org/html/2503.03326v2) provides a modern reference for multiscale ocean representation and gravity/capillary dispersion. This site does **not** implement its FFT spectrum, JONSWAP model, cascades, shallow-water model, breaking-fluid solver or solid/fluid coupling.

Foam uses horizontal Jacobian compression and crest height, masked by the authored shoreline and procedural lace. Since 2026-10-13 it adds a swash band at the waterline whose width follows a periodic run-up and a broken front that travels shoreward and fades; foam is lit as a white Lambertian surface under the pixel's own diffuse light (it was a constant, unlit color). Its depth color uses a Beer-Lambert-shaped attenuation with approximate distance-derived depth, and within a metre or two of the waterline the thin water shows a wet-sand color. These are local art-directed models, without bathymetry, foam transport, conservation of foam mass or a breaking-wave solver. The deep-water dispersion approximation is less accurate near shore. The finite 400 m surface and fixed spectrum do not simulate ocean weather.

## Reflection, sunlight and materials

`reflection.mjs` retains the existing 384 × 384 half-float planar reflection and oblique clipping, now explicitly rendering its source in linear radiance. The material receives a five-tap roughness filter. Exact unpolarized dielectric Fresnel with `n = 1.333` replaces only **indirect specular**; direct light and diffuse shading survive. At normal incidence, `F = ((n-1)/(n+1))² ≈ 0.0204`; grazing incidence tends to one. Tests check those boundaries and monotonicity.

The mirror is a flat reference plane with slope-based UV distortion, not a curved ray-traced reflector. The five taps approximate blur and do not integrate a true rough reflection lobe. The indirect environment treatment also retains Three's BRDF approximations. Linen pigment receives footprint filtering; existing material normal fields and contact AO remain intact.

`daylight.mjs` uses [NOAA's fractional-year solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF) at an approximate La Jolla setting, 32.83° N, 117.27° W. World +X means north, +Z east and the sea lies west. Sun direction, shadow direction and procedural sky agree on this direction. Pacific daylight-saving offset is resolved at local noon; overnight instants on DST transition dates are an approximation. This is not a high-precision ephemeris or an atmospheric scattering implementation. Night's weak key is an authored moon light, without lunar astronomy. The sky environment map refreshes at twenty-minute preview buckets; its specular illumination can lag the current sun within a bucket. Clear-day distance haze is authored, not a weather feed.

## Record mechanics

`record-motion.mjs` uses an illustrative disc-plus-light-platter inertia `I = 0.0036 kg·m²`. For comparison, a uniform 180 g, 12-inch disc alone has `0.5 × 0.18 × 0.1524² ≈ 0.00209 kg·m²`. The actual pictured hardware is not measured.

The driven rotor targets 33⅓ RPM. The model `dω/dt = (ω_target - ω)/τ` has an exact angle integral:

```text
ω(t+dt) = ω_target + (ω(t)-ω_target) exp(-dt/τ)
angle(t+dt) = angle(t) + ω_target dt
             + (ω(t)-ω_target) τ (1-exp(-dt/τ))
```

The motor has an authored 0.72 s acceleration response and 0.30 s braking response. `E = 0.5 I ω²` exposes illustrative rotor energy. This is a controlled motor model, not measured drive torque, bearing friction, wow/flutter or audio stylus dynamics. Physical phase is unbounded; only drawing wraps at a revolution.

For each arm coordinate the critically damped equation is `x'' + 2λx' + λ²(x-target) = 0`. With `d = x-target`, `c = x' + λd`, its exact update is `x_new = target + (d+c dt)e^(-λdt)` and `x'_new = (x'-λc dt)e^(-λdt)`. A bounded 120 Hz substep checks lift/swing/lower phase transitions. The integrators themselves are frame-partition independent; threshold decisions have that substep precision. Lift must clear the disc before yaw traverses. A unilateral contact bound keeps the stylus above the record plane.

Play/stop/cue changes preserve positions and velocities. A cue holds the arm raised and brakes the platter until the newest selected artwork can transfer. Late graphics initialization retains the already displayed fallback record and physical phase. Late image callbacks cannot replace a more recently displayed selection; disposal discards arriving textures. Reduced motion composes a still without resetting disc phase. Hidden or offscreen views suspend active time and resume without adding elapsed hidden time.

## Cost and evidence

- Ocean geometry changes from 14,641 vertices / 28,800 triangles to 25,921 vertices / 51,200 triangles: +22,400 triangles with no new ocean draw call or render pass. The existing reflection remains 384²; its texture filtering changes from one tap to five. There are ten deterministic field components per ocean vertex/fragment and no new scenic image asset.
- The standalone player replaces 38 separate decorative groove-ring meshes with a filtered radial shader and circular anisotropic tangent field. The CSS/SVG fallback imports only the small mechanics module; reduced motion does not require Three.
- The three new runtime modules total 9,789 source bytes / 3,814 gzip bytes when compressed individually. The fallback's mechanics module is 4,038 source bytes / 1,362 gzip bytes. Those are measured module payload sizes, not total site transfer; existing-controller/shader edits add code too. No new GLB or raster asset is introduced by this runtime change.
- `test/coastal-physics.test.mjs` verifies integrator partition invariance, interruption continuity, rotor energy decay, held cues, staged clearance/contact, wave derivatives, slope-energy accounting, steepness bounds, Fresnel and La Jolla day/night/DST direction.
- `test/visual/desk-scene.spec.js` adds rendered and fallback rapid-cue tests, keyboard transport, deliberately delayed/unavailable graphics, late initialization continuity, touch transport, shared 2D/3D selection, raised study-label transfers, moving water and pause/reduced-motion checks. Existing nonblank canvas, visible orbit/zoom, viewport and hidden-tab recovery checks remain required.
- Comparable screenshots and real-clock performance captures live under ignored `.jekyll-cache/visual-qa/coastal-baseline`, `coastal-after-3`, `coastal-record-physics`, `coastal-mechanism-final` and `coastal-ocean-comparison`. Timing captures deliberately do not install Playwright's fake clock. Local frame interval and JavaScript submission time are observations of that device, not GPU timestamp measurements or mobile performance guarantees.

Real-clock local captures on October 1, 2026 used one owned Chromium context with ANGLE / Direct3D 11 on an NVIDIA GeForce RTX 3080 Ti, a 1440 × 1000 viewport and the actual 545 × 462 hero canvas. Each view measured 150 animation-frame intervals after warm-up, without parallel visual tests in this stream. Other programs share this host; this is an observational comparison, not an isolated benchmark. The daytime preview (13:20 Pacific) measured:

| View                 | Baseline median / p95 frame interval | Changed median / p95 frame interval | Changed median JS submission |
| -------------------- | ------------------------------------ | ----------------------------------- | ---------------------------- |
| Normal exterior      | 16.7 / 16.7 ms                       | 16.7 / 16.8 ms                      | 8.3 ms                       |
| Wider ocean overview | 16.7 / 16.8 ms                       | 16.7 / 16.8 ms                      | 11.4 ms                      |
| Ocean quarter view   | 16.7 / 16.7 ms                       | 16.7 / 16.7 ms                      | 8.2 ms                       |
| Onsen                | 16.7 / 16.7 ms                       | 16.7 / 16.7 ms                      | 4.0 ms                       |

An earlier evening exterior measured 16.7 ms median and 33.3 ms p95. These short local observations include the existing substantial model/shadow/reflection cost; they do not guarantee 60 fps across devices or isolate GPU shader time. At the ordinary exterior scale, 650 ms-separated captures changed 2.23% of pixels; the wider sea view changed 4.14%. Whole-view ratios can also include the existing birds, so the dedicated water interaction test additionally compares an interior patch of sea pixels.

The coordinator performs the affected-route checkpoint, targeted scene interaction checks and production build after combining the model/runtime/site changes. The release-scale full matrix remains reserved for publication.

## Curtain cloth

On October 15, 2026, `curtain-cloth.mjs` and `sheer-fabric.mjs` were added as standalone modules for sheer curtains on rails inside the glass front: a cloth solver driven by the shared breeze, and a thin-sheet fabric whose see-through weave, glow and partial shadow depend on angle. The controller does not use them yet. They are a real-time approximation for a browser scene, not a validated textile, airflow or measured-BSDF model.

### Cloth

Each panel is a 29 × 25 particle grid with mass lumped from a voile's areal density (0.075 kg/m²) and a weighted hem (0.03 kg/m). A 1/60 s step runs five substeps of extended position-based dynamics with one constraint pass each. For a distance constraint `C = |x_i - x_j| - l`:

```text
α̃ = α / h²        Δλ = -C / (w_i + w_j + α̃)        (λ restarts at 0 every substep)
x_i += w_i Δλ ∇C   x_j -= w_j Δλ ∇C                 v = (x - x_prev) / h
```

Structural constraints have `α = 0`, alternating shear diagonals `0.02 m/N`, and skip-one horizontal bends `1.2 m/N`. One-sided tethers keep every particle within `r Δy` of its column's heading point. Constraints run in colour batches in which no two share a particle, so consecutive projections do not wait on each other's square roots. The same pass then costs about a third as much as in row order.

The heading row is kinematic. A carrier ring sits on the rail at every fourth column. Between two rings, the columns lie at equal arc length on a half sine `A sin(πx/s)` whose length equals the fabric between them, `L = 4h`, and the folds alternate room side and glass side. With `m = Aπ/s`, `L/s = (1/π)∫₀^π √(1 + m² cos²u) du`, which is tabulated and inverted. Open fraction `o` spaces the rings at `s = (w_closed(1 - o) + w_stack o)/(n - 1)`, and the lead carrier moves at most 0.45 m/s. Horizontal rest lengths follow the heading's chords; bends are blended 20 % toward the closed pleat, so a gathered stack flares slightly.

Air acts per triangle from the wind relative to the triangle's mean velocity, `u = w - v̄`:

```text
F = ½ ρ A |u| [ C_N (u·n) n + C_F (u - (u·n) n) ] / (1 + k Δt),   k = ½ ρ C_N |u| / ρ_A
```

The model uses `ρ = 1.2 kg/m³`, `C_N = 0.9` (a solid plate is about 1.2; the open weave leaks air) and `C_F = 0.02`, with a third of the force applied to each corner. The normal force carries both drag and lift. The divisor applies that drag semi-implicitly, so a gust cannot drive the cloth past the air's own speed. Wind is sampled on a 5 × 6 lattice of particles per panel and interpolated bilinearly. Contacts are the floor and half-spaces: the room side of the door pulls, and per-panel keep-outs at the kitchen's dining table and the lounge's potted plant. A panel sleeps when the wind would lean it less than 0.03 rad (`u < √(2·0.03·ρ_A g/(ρ C_N)) ≈ 0.20 m/s`) and every particle stays under 1 cm/s for 0.75 s. It wakes above 1.3 times that wind or when it is drawn. Reduced motion relaxes the drape for 1.5 s with heavy damping and no wind, then holds it static.

The facade draft is the six-mode room field at 25 % everywhere, plus a jet in each open doorway. The jet speed is `2.4 · softplus₀.₁₂(0.6 + u_out,z) · (1 + 0.32 flutter(rate·t))`, where `u_out` is the shared field 0.8 m outside. Smoothstep shoulders 0.25 m wide bound the open gap, and the jet decays as `1/(1 + d/1.8 m)` into the room, with travelling ±35 % gust cells. Closed glass carries a 0.05 m/s convective layer that decays as `e^{-d/0.18 m}`. In the doorway the median speed is 1.0 m/s (p90 1.4, peak about 1.9 m/s); beside closed glass it is 0.06 m/s. The draft is an authored sketch, not ventilation CFD.

### Fabric

Openness follows a plain weave of round yarns. Each thread direction is a row of cylinders, with yarn-to-spacing ratio `r`, seen at angle `α` across the row:

```text
O(ω) = max(0, 1 - r_warp / cos α_t) · max(0, 1 - r_weft / cos α_b),   cos α_t = |ω·n| / √((ω·n)² + (ω·t)²)
```

At normal incidence `O = (1 - r)² = 0.36`, so `r = 0.4`, and the gaps close where `cos α = r`, about 66°. These endpoints match the crossed-cylinder screen geometry of Kotey, Wright and Collins (2009): `A_o = (S - D)²/S²` and `cos θ_cutoff = D/S`. Between the endpoints this model uses the exact parallel-cylinder projection per thread direction rather than their fitted cosine power. Visible coverage `c = 1 - O(view)` drives alpha-to-coverage in the composer's 4× multisampled target, dithered by a quarter sample with interleaved gradient noise. Without samples it falls back to a hashed discard. Faint warp streaks and weft bars live in fabric metres and fade before they are finer than about two pixels. The double-folded hem's open fraction is squared.

Light from behind the sheet, relative to the viewer, is transmitted where it meets yarn:

```text
L = E cos θ_i (1 - O(ω_i)) / max(c, 0.25) · T · [ (1 - φ)/π + 2 φ p_HG(cos θ_s; g) ],   T = 0.42 · tint,  φ = 0.45,  g = 0.6
```

The diffuse part is the thin-walled Lambertian BTDF of glTF's diffuse-transmission extension. The forward lobe is Henyey-Greenstein about the light's travel direction, so the sheet glows hardest around the sun. Indirect light uses the hemisphere, ambient and environment irradiance on the far side, plus the blurred environment along the view ray. Reflection is Three's physical BRDF with Charlie sheen, roughness 0.85 and F0 1.4 %. In the shadow pass, a fragment is discarded when an ordered 3 × 3 threshold falls below `O(ω_l) + (1 - O)·T̄·φ·0.7`. `PCFSoftShadowMap` filters with a box three texels wide, which covers exactly one period of that pattern and reads back the passing fraction with no grid left over. A 4 × 4 Bayer pattern visibly crosshatched the floor. The curtain's own shadow lookup offsets toward each light, so a back-lit sheet is not shadowed by itself.

### Sources

- [Müller, Heidelberger, Hennix and Ratcliff, Position Based Dynamics, 2007](https://matthias-research.github.io/pages/publications/posBasedDyn.pdf).
- [Macklin, Müller and Chentanez, XPBD: Position-Based Simulation of Compliant Constrained Dynamics, 2016](https://matthias-research.github.io/pages/publications/XPBD.pdf), and [Macklin et al., Small Steps in Physics Simulation, 2019](https://matthias-research.github.io/pages/publications/smallsteps.pdf).
- [Provot, Deformation constraints in a mass-spring model to describe rigid cloth behaviour, Graphics Interface 1995](https://graphicsinterface.org/proceedings/gi1995/gi1995-17/) for the structural, shear and flexion pattern; the solver here uses compliant constraints, not springs.
- [Kim, Chentanez and Müller, Long Range Attachments, SCA 2012](https://matthias-research.github.io/pages/publications/sca2012cloth.pdf).
- [Keckeisen, Kimmerle, Thomaszewski and Wacker, Modelling Effects of Wind Fields in Cloth Animations, WSCG 2004](http://wscg.zcu.cz/wscg2004/Papers_2004_Full/C73.pdf) for per-face forces from the relative air velocity; this module uses one flat-plate normal coefficient plus skin friction instead of their separate drag and lift coefficients.
- [Kotey, Wright and Collins, Determining Off-Normal Solar Optical Properties of Insect Screens, ASHRAE Transactions 115(1), 2009](https://uwspace.uwaterloo.ca/handle/10012/11550).
- [Estevez and Kulla, Production Friendly Microfacet Sheen BRDF, SIGGRAPH 2017 course](https://blog.selfshadow.com/publications/s2017-shading-course/imageworks/s2017_pbs_imageworks_sheen.pdf), which Three's sheen implements.
- [Khronos, KHR_materials_diffuse_transmission](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_diffuse_transmission/README.md).
- [Henyey and Greenstein, Diffuse radiation in the Galaxy, ApJ 93:70, 1941](https://doi.org/10.1086/144246); the form used follows [pbrt's phase functions](https://pbr-book.org/4ed/Volume_Scattering/Phase_Functions).
- [Jimenez, Next Generation Post Processing in Call of Duty: Advanced Warfare, 2014](https://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare/) for interleaved gradient noise.

### Cost, evidence and limits

Four panels hold 2,900 particles, with 10,752 constraints and 2,668 tethers. On the October 15 development machine, under other load, Node's V8 measured a best of 1.17–1.21 ms per 60 Hz frame. In headless Chromium, stepping plus attribute writing took a 1.3–2.9 ms median. After construction a step creates no arrays; only about 0.3 KB per frame of engine heap numbers remain, from the cold `update` wrapper. `test/curtain-cloth.test.mjs` covers bounded strain, gale stability and energy decay, rings held on the rail, gathered width, bitwise determinism and frame partitioning, sleep and wake, reduced motion, absence of array allocation, the draft's door contrast, clearances against the authored furniture, normals and winding, the openness model, and the shader patches' include markers. Lab captures live under ignored `.jekyll-cache/curtain-lab/shots/`.

Limits: there is no self-collision, so gathered stacks and violent gusts can interpenetrate, and after a 3–7 m/s gale folds can stay crossed. Structural strain stays at 1–7 % in the doorway draft and reaches about 20 % in such gales. The air model has no shielding, wake or feedback on the flow, so the inner folds of a stack feel the full wind. Depth shadow maps cannot colour the light the yarn transmits, and the dither resolves cleanly only under `PCFSoftShadowMap`, where shadow coverage is quantised to ninths. The fabric is authored, not measured: neither yarn-level specular nor a microcylinder cloth model is implemented. Placement has been checked against decoded model bounds and rendered with the authored shell, kitchen, gym and lounge models in a lab page; it has not yet run in the live controller.
