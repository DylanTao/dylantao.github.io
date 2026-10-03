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

Foam uses horizontal Jacobian compression and crest height, masked by the authored shoreline and procedural lace. Its depth color uses a Beer-Lambert-shaped attenuation with approximate distance-derived depth. These are local art-directed models, without bathymetry, foam transport, conservation of foam mass or a breaking-wave solver. The deep-water dispersion approximation is less accurate near shore. The finite 400 m surface and fixed spectrum do not simulate ocean weather.

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
