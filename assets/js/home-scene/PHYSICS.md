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

## Seawater optics, the seabed and the shore (2026-10-18)

Sirui asked on October 18 for water with the quality of two three.js scenes he had seen: a teal harbour that mirrors its lamps in long streaks through mist, and a Mediterranean cove whose turquoise shallows show the sandy, rocky seabed with moving caustics. The Pacific's body colour now comes from what the water absorbs and scatters over the seabed beneath it, instead of a painted teal with a wet-sand tint near the beach.

### The seabed (bathymetry.mjs)

The authored coast reaches only a little way under the sea: the beach slopes to 0.75 m below mean sea level and the cliff's foundation about a metre. `createBathymetry` draws the coast's meshes once from above with an orthographic camera into an 800 × 160 float target (0.5 m cells over x −200…200 m, z −80…0 m). Each cell records the highest surface below a clip plane 0.5 m over the sea; a back face seen from above below sea level is the inside of a solid that rises through the water, so it wins every depth test and marks the column dry. Sand and rock come from the material ("dry beach sand" and "wet tideline sand" are sand; every sandstone and bluff is rock). `fillSeabed` in `sea-optics.mjs` keeps every captured height and continues the open seabed down from the coast by a slope-limited extension, max over captured cells of h − 0.08 d (a two-pass chamfer over the 3 × 3 neighbourhood), steepened by 0.003 r² with r the distance from the nearest captured cell, to a 14 m floor. A turquoise shelf a few metres deep runs along the beach and open water begins about 50 m out. The same passes give each cell its distance to dry land (the true waterline, rocks included) and to the captured coast. The result is a half-float texture: height, rock share, shore distance and coast distance.

The capture runs once when the coast loads, before the first composed frame, with a synchronous readback (17–51 ms draw and readback, 26–45 ms fill on this laptop). The hinterland's coves join later through a pixel-pack buffer behind a fence, polled with scheduler tasks (a paused page clock freezes timers and frames), so that capture never waits on the GPU. Without float render targets the sea keeps the old authored depth.

### Light in the water (sea-optics.mjs)

Three bands stand for the spectrum (650, 550, 450 nm). Pure water absorbs 0.34, 0.0565 and 0.00922 m⁻¹ (Pope and Fry 1997); phytoplankton and dissolved matter add the bio-optical terms Lee et al. use (their equations 12–15 and Table 2) for an authored clear La Jolla day (0.25 mg m⁻³ chlorophyll, 0.015 m⁻¹ CDOM at 440 nm), and particles backscatter 1.9 % of Gordon and Morel's particle scattering (B = 0.3). With κ = a + b_b and u = b_b/κ, the water's subsurface reflectance over a bottom of albedo ρ at depth H is Lee et al.'s semianalytical shallow-water model (1998, equation 21):

```text
r_rs = (0.070 + 0.155 u^0.752) u [1 − 1.03 exp(−(1/cos θ_w + 1.2 (1 + 2u)^½ / cos θ_v) κ H)]
     + 0.31 ρ L exp(−(1/cos θ_w + 1.1 (1 + 4.9u)^½ / cos θ_v) κ H)
R_rs = 0.5 r_rs / (1 − 1.5 r_rs)                          (Lee et al. 1999, equation 2)
L_w  = R_rs E_d (1 − F(θ)) / 0.98
```

θ_w is the refracted sun's zenith in the water and L the bottom's light relative to open sand (its shadow and caustics). The conversion to R_rs diverges as r_rs nears 2/3, which a focused caustic over bright sand in a few centimetres of water can reach, so r_rs stops at 0.3 (R_rs 0.27), above any unfocused seabed's. Their fit is for a nadir view; here the upward factors are stretched by the view's own path, 1/cos θ_v, an adaptation. E_d is the light arriving at the pixel (three's direct and indirect diffuse over the material's albedo), so the water darkens in the cliff's shadow and at night with no separate palette. Over sand the water runs from sand at the waterline through turquoise (a metre takes out the red) to blue-green and navy offshore. In the surf zone a spectrally flat 0.006 m⁻¹ of suspended sand, growing with each crest, turns the water milky.

The view ray refracts at the wave normal and two steps along it find the seabed, so its pattern sits at depth. The seabed is rippled sand (9 cm wave ripples along the shore, filtered with distance), rock with algae, coralline crust and surfgrass in the shallows, and patchy reef with kelp on the deeper rock past the authored coast; detail a pixel cannot resolve is not computed.

### Caustics

Sunlight refracts into the water and lands a path l further down. To first order a ray through a surface of slope ∇h moves by l (1 − 1/n) ∇h, so the irradiance on the seabed changes by 1/|det(I + l (1 − 1/n) Hess h)|: the differential form of the beam-area ratio Watt (1990) traced through a water surface. The Hessian is that of the seven longest pixel-stage wind ripples (0.9 m to 12.5 cm; their amplitude follows the local gusty wind by the Cox–Munk law), evaluated where the sun ray that lands on this seabed point crossed the surface. The shorter ripples focus only close under the surface and are blurred by the sun's disc below that. Each ripple's curvature is blurred by the sun's disc over the path (0.0047 l) and by the pixel footprint, and dropped once a pixel cannot resolve it. A single sheet of the folded map under- and over-counts light; dividing by the sampled mean, (1 + 1.7 σ²)/(1 + 0.3 σ^3.5) in the summed curvature variance σ² = Σ ½ (a k² w l′)² with l′ = l (1 − 1/n) (within 5 % of sampled statistics up to σ² = 28), keeps the seabed's average light unchanged. Two slow noise fields scramble each ripple's phase so the seven plane waves do not focus into a lattice; no ripple's curvature changes. The sun's shadow on the seabed is looked up at that same entry point, 20 cm above the water and the bed, with four compares, so a swimming sea lion shades the sand under it.

### Reflections, glitter and lamps

`reflection.mjs` distorts the 384 px mirror by the wave normal's tilt in screen space, more vertically than across (at a grazing view a tilt along the view moves the image far more), and blurs it with seven taps along the vertical in proportion to the slope deviation, so lamps at dusk smear into columns.

The sun's (or the moon's) path: three r164's directional-light loop calls the sea's own `RE_Direct_SeaSun`, which lays down the diffuse light as `RE_Direct_Physical` does and keeps the GGX lobe apart, shadow included. The lobe's roughness carries the unresolved slope variance, so the path widens as the wind roughens the water. The lobe is then broken into glints. A patch of sea, 9 cm or the pixel's footprint in power-of-two steps, holds on average N = (patch / 3 cm)² D(h) cos θ_h Ω / (4 h·l) facets aimed at the sun's disc: the lobe's own GGX distribution over the disc's solid angle Ω = 6.9 × 10⁻⁵ sr through the reflection Jacobian, with 3 cm standing for the capillary ripples that throw glints (an authored scale). Each patch draws its count for its own seventh of a second with mean one. Below one glint a patch is dark or lit, a lit one exponentially bright (1/N on average, fading in and out); above one the draw spreads 1/√N about the mean, so the far path twinkles; at N = 1 both are the same draw. Half the lobe draws as that count and half as a steady glow: tone mapping compresses a sparse bright glint far more than a steady path of the same mean, and the glow stands for the glints' glare. A flash stops at 8, already white after tone mapping; brighter would only feed the bloom. `?sea-debug=glints` shows N and the draws.

After dark the terrace's lamps (each festoon swag at its lowest bulbs, the fire bowl and the two wall lights) are mirrored by GGX with plain inverse-square falloff. Their light's range cut-off is for lighting, not for being seen. The lobe keeps at most the roughness of 2 m wind ripples, and the bulbs count four times their lighting budget, so the streaks read as they do on a harbour.

### Sunset on the water

Sirui, October 18: "the sunset, reflection should also be better designed. since sunset near pacific ocean is gorgeous and you can have data on when is sunset in lajolla easily". The sun's position already comes from `coastalDaylight` (NOAA's approximation at La Jolla): on October 16, 2026 the sun stands 8.6° up at 17:30, 2.4° at 18:00, sets at 18:16 PDT, and civil dusk ends at 18:41. The scene's sun light keeps one daytime colour down to the horizon, so the water gives its sun the hue the direct beam takes on its slant path through the air:

```text
m(h)   = 1 / (sin h + 0.50572 (h + 6.07995)^-1.6364)       Kasten and Young (1989), h in degrees
tau_R  = 0.008569 L^-4 (1 + 0.0113 L^-2 + 0.00013 L^-4)    Hansen and Travis (1974), L in micrometres
tau_A  = 0.1 (L / 0.55)^-1                                 an authored clean coastal haze
T      = exp(-m (tau_R + tau_A))
tint   = T(h) / T(40 degrees), per band, scaled to keep the scene light's Rec. 709 luminance
```

At the sea's three bands the tint is 1 from 40° up, golden at 8° (1.29, 0.92, 0.42), amber at 4.5° (1.54, 0.84, 0.20), orange at 2° and red-orange on the horizon (2.95, 0.30, 0.001). Only the hue changes, because the scene's own ramp (`sunlight`) already dims the setting sun; after sunset the key light is the authored moon and the tint is 1. The tint colours the sun's glitter path and its light on the seabed, not its diffuse light on the water, since the beach beside it is lit by the scene's light. The sky's sunset colours reach the water through the live mirror and the environment map, so the Fresnel reflection carries whatever the sky shows. The water reads the sun through one accessor, `waterSky()` in `environment.mjs`, which the atmosphere work is to back with its own sun and sky (planned as `pacific.atmosphere`); the provisional tint goes once the sun light carries the colour. At blue hour the lamp streaks take over. The evening breeze is measured, not authored (2.0 m/s at 18:00 against 2.75 m/s at 15:00 in the LJPC1 October means above), so the sunset sea is calmer than the afternoon's but not glassy.

### Wakes and rings

`wildlife.mjs` reports where the two swimming sea lions and the diving pelican meet the water (`waterMarks()`: position, heading, speed and a ring's age). In the same pixel stage as the ripples the sea adds, as slopes and foam, an expanding ring where an animal broke the surface (radius 0.3 + 1.1 t metres, fading over a few seconds) and a Kelvin wake behind a swimmer: two arms at 19.47°, divergent waves along them and white water close behind. It is a stylized surface pattern for up to three animals, not a wave solver.

### The shore

The swash, breaking fronts and shoaling foam now follow the captured shoreline distance instead of the authored beach profile, which sat about 1.5 m off the visible waterline on the left. The water runs up to the true waterline and around the haul-out rocks. Beach sand no longer casts sun shadows: it lies within one shadow-map texel of the shallow water over it and shaded that water in straight-edged patches. The sea's own shadow lookup rises 20 cm for the same reason. Rocks, animals and the cliff still shade it.

### Compile time

ANGLE's Direct3D 11 compiler unrolls loops with constant bounds and inlines every call, and an implicit-derivative texture lookup inside a loop or branch makes it unroll and re-derive the lookup. The first optics more than doubled the sea program's compile, so its loops now run to uniform bounds over flat uniform arrays (the swells and pixel ripples in `ocean-spectrum.mjs`, the caustic ripples, the lamps and the wakes), its seabed and shadow lookups take explicit levels, its value noise uses a short integer hash, the caustics use the seven longest ripples, and the onsen stone evaluates its lens once per fragment. Timed by compiling the page's own captured sources afresh in a bare context (compile and link, six interleaved rounds, this laptop through ANGLE/D3D11): the sea's program took 4.6–5.1 s against 1.7–2.1 s before the restructuring and now 2.74 s median (2.65–2.93 s) against 2.11 s (1.82–2.32 s) without the optics; the onsen stone's receiver program takes 1.33 s (1.17–1.55 s). Both compile on the driver's worker threads with the first view's other programs (`program-warmup.mjs`), and activation to the first ready frame did not grow: 13.3 s median (13.3–14.2 s) against 13.5 s (12.3–14.4 s) in the final interleaved runs.

### Cost and limits

Interleaved A/B on this laptop (`bin/measure_coastal_views.cjs`, base `dcff1a5db` against the working tree, a fresh browser per run, 6 s per view; median of the runs' medians with their range; five pairs for the two exterior views, three for the others). The host was shared with other work, and in the two slowest working-tree runs the mirror pass, which this change does not touch, slowed by the same factor.

| View (1440 × 1000, DPR 1)   | Script per frame, base → water         | GPU per frame, base → water            | Frame interval |
| --------------------------- | -------------------------------------- | -------------------------------------- | -------------- |
| Study (occupied room)       | 10.0 (9.5–12.3) → 10.5 (9.7–10.5) ms   | 17.7 (17.0–18.8) → 16.6 (16.6–19.7) ms | 16.7 ms both   |
| Outside, authored 48 m      | 42.3 (36.0–43.9) → 45.7 (34.6–48.3) ms | 47.3 (46.4–60.1) → 55.8 (42.0–64.0) ms | 50 ms both     |
| Coast at 160 m              | 43.9 (35.0–49.9) → 38.9 (35.1–45.2) ms | 55.4 (41.3–60.5) → 52.6 (46.1–56.5) ms | 50 ms both     |
| Terrace laundry, sea behind | 18.5 (16.5–19.9) → 18.1 (16.9–19.7) ms | 17.6 (15.1–21.4) → 18.9 (17.4–19.7) ms | 16.7 ms both   |

- The seabed is authored geometry plus a smooth extension: no surveyed bathymetry, no sand bars, channels or kelp forest geometry, and nothing under water casts a shadow.
- Caustics come from the pixel-stage ripples only (the swells' curvature is negligible), from one paraxial sheet, without the multiple overlapping images of a strongly folded map.
- Lee et al.'s model is a fit for nadir viewing over a Lambertian bottom; the oblique stretch and the light split between sun and sky are adaptations.
- Glints are a statistical closure on the GGX lobe (one draw per patch and moment), not individual ripples; their 3 cm facet scale is authored.
- The low sun's hue is a three-band transmittance with an authored haze, applied to the water's sun only until the sky's own sun colour replaces it.
- Lamp streaks have no occlusion, and indoor lamps are left out because their mirror images would need a visibility test through the glass.

Sources: [Pope and Fry, Applied Optics 36, 8710 (1997)](https://doi.org/10.1364/AO.36.008710), tabulated by [OMLC](https://omlc.org/spectra/water/data/pope97.dat); [Lee, Carder, Mobley, Steward and Patch, Applied Optics 37, 6329 (1998)](https://doi.org/10.1364/AO.37.006329); [Lee et al., Applied Optics 38, 3831 (1999)](https://doi.org/10.1364/AO.38.003831); [Watt, Computer Graphics 24(4), 377 (1990)](https://doi.org/10.1145/97880.97920); Cox and Munk (1954) as above; [Kasten and Young, Applied Optics 28, 4735 (1989)](https://doi.org/10.1364/AO.28.004735), the formula as [pvlib](https://github.com/pvlib/pvlib-python/blob/main/pvlib/atmosphere.py) implements it; [Hansen and Travis, Space Science Reviews 16, 527 (1974)](https://doi.org/10.1007/BF00168069).

## One wind for the coast

Sirui asked on October 15, 2026 that the grass and leaves move in the same wind that moves the ocean, and that the technical details be recorded. Since October 16 one state in `wind-field.mjs`, `coastWind`, drives the sea's wind waves, ripples and whitecaps, the clifftop planting, the room plants, the curtains, the bath steam, and the dust and spray. Shaders include one GLSL chunk (`coastWindGLSL`) and bind its shared uniform objects; JavaScript reads the same functions. The six-mode curl field above stays, as the small eddies of the air inside the house. The controller updates the state once per moving frame (`stepWind`), before anything samples it. A paused or reduced-motion scene holds it still; an explicit change of time, activity or motion recomposes it.

### The daily breeze

The mean wind follows the October averages at Scripps Pier, La Jolla (NDBC station LJPC1, hourly records for 2023–2025). Speeds are the averages of single readings; directions are those of the mean wind vector:

| Pacific time | 00:00 | 03:00 | 06:00 | 08:00 | 09:00 | 10:00 | 12:00 | 14:00 | 15:00 | 16:00 | 18:00 | 20:00 | 22:00 | 23:00 |
| ------------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| Speed (m/s)  | 1.35  | 1.6   | 1.5   | 1.55  | 0.7   | 1.65  | 2.15  | 2.7   | 2.75  | 2.65  | 2.0   | 1.65  | 1.4   | 1.4   |
| From (°)     | 66    | 86    | 88    | 78    | 6     | 288   | 287   | 300   | 305   | 306   | 313   | 329   | 338   | 12    |

At night a light land breeze blows off the mesas, from the east. Near 09:00 the wind turns through north, and the station's mean vector nearly vanishes (0.11 m/s), though single readings still average 1.5 m/s. The knot there takes 0.7 m/s, a lull: the calm morning. The sea breeze sets in from the west-north-west by 10:00, peaks at 2.75 m/s at 15:00 while veering north-west, and dies in the evening, backing through north into the night breeze. Between knots a periodic cubic Hermite with Catmull–Rom tangents runs through the velocity vectors, so speed and direction stay smooth through midnight and a turn passes through a lull rather than a jump. The hourly station means are within 0.25 m/s and 15° of the curve (a test checks this). Live, the minute follows the clock to the second, so the breeze never steps when the minute changes; a preview uses the previewed minute.

### Gust fronts

Every gust quantity is a function of the retarded time and the crosswind coordinate:

```text
ψ = t − (x·d)/c        ξ = x·d⊥        c = max(1.2 m/s, U)
v(x, t) = U g(ψ, ξ) R(φ(ψ)) d
g(ψ, ξ) = g₀ + a Σ_{j=0,1} s_n l_n(ξ) h(ψ − τ_n),    n = ⌊ψ/T⌋ − j
h(u) = S(0, 1.2 s, u) · e^{−max(0, u − 1.2 s)/3.5 s} · (1 − S(7.2 s, 9.6 s, u))
```

Here U and d are the breeze's speed and direction and S is smoothstep. Whatever passes one point reaches a point s metres downwind s/c seconds later, so gusts move as fronts at the mean wind's speed (Taylor's frozen turbulence). Retarded time is cut into slots of T = 8 s. A slot's strength s_n is 0 for a fifth of the slots and otherwise 0.35 to 1; its arrival τ_n lies within the first 80 % of the slot; its patchiness across the wind is l_n = 0.65 + 0.35 cos(2πξ/70 m + phase). All three come from Wellons's lowbias32 integer hash, which is exact 32-bit arithmetic in JavaScript (`Math.imul`) and in GLSL ES 3.00 (`uint`), so the GPU and the CPU agree on every gust instead of disagreeing on a sine hash's rounding. A gust rises over 1.2 s, decays with an e-folding time of 3.5 s, and ends within 1.2 slots, so only two slots can overlap. With a = 0.8, the base g₀ = 0.872 sets the long-run mean of g to 1. The envelope's standard deviation is 0.15 (the turbulence intensity), and its median ten-minute peak is 1.67 times the mean; at the pier, October's 5-second gusts run 1.4–1.8 times the 8-minute means. The direction swings slowly, φ = 0.14 rad × (0.6 sin(2πψ/37 s + 1.3) + 0.4 sin(2πψ/13 s + 4.1)), and the swing travels with the fronts.

Inside the house the breeze leaks through the glass front: 1.2 % of it with the doors shut and 6 % with them open, plus the six eddy modes at 0.6 of that share. Each gust is felt indoors when its front meets the glass (z = −4.48 m) at the same x. The terrace under the cave lip gets 12 %.

### Who reads it

- **The sea** (`ocean-spectrum.mjs`, bound in `environment.mjs`). The three longest components stand in for swell and keep their heading and height all day. The shorter ones are the local wind sea. They turn with the breeze's heading, and their heights scale by `max(0.08, min(1, √(U/3)) · S(0.4, 2.2, U) · e^{−5/4 (k_p/k)²})`, the Pierson–Moskowitz low-frequency cut with k_p = 0.855² g/U². The factor never exceeds 1, so the steepness bound and the foldover test above still hold. An ordinary October afternoon (3 m/s) shows the authored sea. The pixel-stage ripples follow the wind under each pixel, gusts included (u = U g at the pixel's world point, 0.4 s late), scaled by the Cox–Munk slope law `√((0.003 + 0.00512 u)/(0.003 + 0.00512 · 3))` and faded toward a third of that below 1.8 m/s. So a gust crosses the water as a rougher, darker cat's paw, and the 09:00 lull goes glassy. Whitecaps cover a fraction 3.84 × 10⁻⁶ u^3.41 of the sea in the same local wind (Monahan and O'Muircheartaigh), exaggerated tenfold for this small, stylized sea: about 1 % in a 5 m/s gust. A rational approximation of the normal quantile (Abramowitz and Stegun 26.2.22) turns that fraction into a threshold on a drifting noise field whose tail is close to Gaussian (σ ≈ 0.116), weighted toward compressed, raised water.
- **The clifftop planting** (`patchFloraSway` in `plant-motion.mjs`, applied in `realism.mjs`). Each leaf, needle and blade bends by w b, with w = uv.x² from the Blender sway weight. Its lean is reach · (U g)^1.4, with g read 2/ω seconds late, the delay of a damped stem with natural angular frequency ω. Drag on a leaf that streamlines grows like U^(2+V), with Vogel exponent V ≈ −0.6. A sway at the plant's own frequency, 0.3 sin(ωψ + 1.3 sin(0.23x − 0.41z)), is phased by retarded time, so it rolls across the bluff downwind like wind waves over a field of grain. Flutter grows in with speed, and the tip drops by |lean|²/2h, so stems keep about their length. Normals use the inverse transpose of the bend's Jacobian, with ∇w = (2 uv.x/h) ŷ. The same hook runs on each planting mesh's depth and distance materials, so shadows sway with the leaves. Per species: grass and wild oats reach 0.012 at 1.2 Hz; sage and sagebrush 0.0075 at 0.9 Hz; lemonade berry 0.004 at 0.7 Hz; Torrey pine needles 0.011 at 0.35 Hz; palm fronds 0.014 at 0.8 Hz. In the October afternoon breeze a grass tip leans about 5 cm, and twice that in a gust.
- **The room plants and the terrace olive** (`plant-motion.mjs`, `coastal-wind.mjs`). Their mean wind is the breeze times the gust envelope (at the glass front for plants inside, at the plant outside, 0.57 s late), at the indoor or terrace share, plus the critically damped eddy modes. Bends saturate softly toward 15 mm, as leaves streamline. With the doors shut at night they barely move.
- **The curtains** (`createFacadeDraft({ coast })`). The room air is the coast's indoor air. Each open doorway's jet is 0.55 × softplus of the onshore component of the outdoor breeze 0.8 m outside the door, gusts included, scaled down for a door part way open: about 1.2 m/s in an October afternoon's 2.3 m/s onshore flow, and nothing when the breeze blows off the land. It carries the room field's divergence-free modes through the doorway at 0.8 m/s, so a puff lifts one fold and then the next.
- **The laundry** (`createTerraceDraft`). The line on the parapet's edge takes 42 % of the open coast's wind, gusts and veer included, plus the room field's modes at a towel's scale (0.27–1.6 m), advected onshore.
- **The spray, dust and steam**. Spray samples the open coast's wind (`coastWind.outdoor`) and dust the house's air (`coastWind.indoor`). Each moving frame the bath steam takes `coastWind.indoorDrift` at the pool, sheltered by half by the alcove's screens, through `steam-density.mjs`'s `setWind`.

### For a wind sock or a flag

```js
import { coastWind } from "./wind-field.mjs";
const vane = coastWind.vane(x, z); // { yaw, fromDegrees, speed, meanSpeed, gust, extension }
sock.rotation.y = vane.yaw; // turns an object whose local +Z points downwind
sock.scale.z = 0.2 + 0.8 * vane.extension; // a standard wind cone stands straight out at 15 knots
coastWind.sample(x, y, z, t, out); // the outdoor wind, m/s; coastWind.sampleIndoor for the house's air
coastWind.gust(x, z, t, lag); // the envelope alone, mean 1
coastWind.state; // { seconds, minute, meanSpeed, direction, yaw, fromDegrees, frontSpeed, doors, indoorLeak }
```

`t` defaults to the current frame's time. In a shader, include `coastWindGLSL`, bind `coastWind.uniforms` (shared objects, so nothing else needs updating) and call `coastWindGust(xz, lag)` or `coastWindVelocity(p, lag)`.

### Evidence and limits

`test/coast-wind.test.mjs` checks:

- the cycle against the station's means, and its smoothness;
- the envelope's mean, spread and gust factor;
- that a front reaches a point s metres downwind exactly s/c later, and that cross-correlation measures the same lag;
- a float32 replay of the GLSL envelope against the CPU (under 2 × 10⁻⁴);
- that the sea, the planting and the room plants bind one set of uniforms, and that the sea and the grass read the same gust timeline;
- the wind sea's bounds, turning and Gerstner tangents;
- the indoor share, the vane, and the spray, dust and steam drift.

The native fixture in `test/coastal-transport-rendering.test.mjs` renders the GLSL envelope and velocity on the GPU. Against the CPU, it differs by at most 3.3 × 10⁻⁵ in g and 8 × 10⁻⁵ m/s over 30 samples out to t = 3600 s. In the live scene at 15:30 (`.jekyll-cache/visual-qa/wind-curtains-2026-10-15/sync-live-1530.json`):

- The sea's, the planting's (beauty and shadow) and the room plants' materials bind the very uniform objects `coastWind` owns, checked by running each live material's own shader hook.
- The wind, ocean and plant clocks read the same second.
- The live envelope 30 m downwind on the bluff trails the sea's by 10.3 s, against 11.0 s expected at a 2.73 m/s front speed.
- The kitchen doorway jet follows the outdoor onshore flow at the door (r = 0.64–0.69 over two runs; the rest is the draft's own flutter).

Under Pause every clock, the cloth and the frame hold to the pixel, and a previewed hour composes its drape without stepping. Under reduced motion the curtains are a settled static drape and the room plants rest. Clips and stills from both lighting conditions are in the same folder.

Cost, measured on October 16 in headless Chromium (ANGLE D3D11, integrated GPU) at 1440 × 1000 while three other agents worked on the same host, so treat these as upper bounds:

- **CPU:** the wind's per-frame update, the sea's sync and the steam's drift take under 5 µs.
- **GPU:** the gust envelope adds two hashed slots per sea pixel and per swaying vertex. That is about 218,000 planting vertices across eight leaf materials, now in the shadow pass too, plus the room plants. An interleaved A/B against the base commit, three rounds each, could not resolve a difference outside. The medians were 61.6 ms of GPU for the base and 50.6 ms for this change, with submit time 68.5 against 66.4 ms and 1,878 against 1,912 draw calls, but this shared GPU varied by ±20 ms between rounds.

Limits:

- The fronts are frozen turbulence over flat ground. There is no shelter or speed-up from the bluff, the house or the cliff, and the wind does not change with height.
- The outdoor field is not divergence-free: a gust front compresses the flow, where real gusts exchange air vertically. Only the indoor eddies keep the curl field's guarantee.
- The house's air is a share of the breeze, not a ventilation solution.
- The cycle is October's and does not change with the season; summer afternoons at the pier average 3.5 m/s.
- The swell components are authored, not generated by distant storms.
- Whitecap coverage is exaggerated tenfold.
- The planting uses a nominal height per species for its tip drop and normals.

Sources:

- [NOAA National Data Buoy Center, station LJPC1, La Jolla, CA](https://www.ndbc.noaa.gov/station_page.php?station=ljpc1). Its hourly standard meteorological records for 2023–2025 were averaged by Pacific hour for October.
- [Taylor, The Spectrum of Turbulence, Proc. R. Soc. A 164 (1938)](https://doi.org/10.1098/rspa.1938.0032), for frozen turbulence carried by the mean flow.
- [Pierson and Moskowitz, A proposed spectral form for fully developed wind seas, JGR 69 (1964)](https://doi.org/10.1029/JZ069i024p05181).
- [Cox and Munk, Measurement of the roughness of the sea surface from photographs of the sun's glitter, JOSA 44 (1954)](https://doi.org/10.1364/JOSA.44.000838).
- [Monahan and O'Muircheartaigh, Optimal power-law description of oceanic whitecap coverage dependence on wind speed, J. Phys. Oceanogr. 10 (1980)](https://doi.org/10.1175/1520-0485%281980%29010%3C2094:OPLDOO%3E2.0.CO;2).
- [de Langre, Effects of Wind on Plants, Annu. Rev. Fluid Mech. 40 (2008)](https://doi.org/10.1146/annurev.fluid.40.111406.102135), and [Vogel, Drag and reconfiguration of broad leaves in high winds, J. Exp. Bot. 40 (1989)](https://doi.org/10.1093/jxb/40.8.941), for reconfiguration and the Vogel exponent.
- [Py, de Langre and Moulia, A frequency lock-in mechanism in the interaction between wind and crop canopies, JFM 568 (2006)](https://doi.org/10.1017/S0022112006002667), for wind waves rolling over a canopy.
- [Wellons, Prospecting for Hash Functions (2018)](https://nullprogram.com/blog/2018/07/31/), for the lowbias32 hash.
- [Windsock](https://en.wikipedia.org/wiki/Windsock), which cites FAA AC 150/5345-27D for a cone that stands straight out at 15 knots.

## Curtain cloth

On October 15, 2026, `curtain-cloth.mjs` and `sheer-fabric.mjs` added sheer curtains on rails inside the glass front, and on October 16 they joined the scene in the coast's one wind. On October 18 Sirui found them "a bit weird", and they were rebuilt: the panels now hang in sheer linen from rings on two bronze rods, simulated by `cloth-solver.mjs`, which also moves the laundry on the terrace (see "Laundry on the terrace" below). They are a real-time approximation for a browser scene, not a validated textile, airflow or measured-BSDF model.

### What read as weird

Captured at 15:30, 16:45, dusk and 21:00 from the kitchen and lounge cameras, inside and outside (`.jekyll-cache/visual-qa/cloth-2026-10-18/before/`):

- By day all four panels were gathered into 13 cm stacks: 2.2 m of fabric on seven kinematic carriers 22 mm apart. Every horizontal rest length followed the heading's chord at every row, so the stack was the same fluted column from the rail to the floor, with no flare and no hem. From outside the four stacks read as white poles, and in the doorway jet the windward stack lifted and twisted like a paper ribbon.
- Drawn, the same corrugation ran from top to bottom, so the panels read as a vertical blind by day and a wall of organ pipes at night, and they slid closed as one rigid sheet, like a motorized track.
- Nothing held them up: no rod, rings or brackets, and a hard straight top edge 7 cm under the door head.
- Alpha-to-coverage with an interleaved-gradient dither left a grainy screen-door stipple at the scene's canvas size, worst from outside and in motion, and the axis-aligned value noise of the warp streaks and weft bars aliased into rectangular blotches.
- The draft's flutter ran on three fixed sinusoids.

### The solver

`cloth-solver.mjs` builds a triangle mesh of particles from flat patterns (a curtain panel, a towel, the halves of a shirt) whose seams are welded, plus chains (a clothes line), and steps it with small-step extended position-based dynamics: a few substeps per fixed step, one constraint pass each, compliance α/h², multipliers reset every substep. For a distance constraint `C = |x_i - x_j| - l`:

```text
α̃ = α / h²        Δλ = -C / (w_i + w_j + α̃)        x_i += w_i Δλ ∇C,  x_j -= w_j Δλ ∇C        v = (x - x_prev) / h
```

- **Stretch and shear.** Mesh edges along the warp or weft are stretch constraints (α = 0); diagonal edges and the quads' crossing diagonals are shear constraints, soft enough for linen to drape by shearing (α = 0.012 m/N for the sheer). Rest lengths are the fabric's own.
- **Bending.** Every interior edge carries the isometric quadratic bending energy of Bergou, Wardetzky, Harmon, Zorin and Grinspun (2006). For the hinge (x₀, x₁) with opposite corners x₂ and x₃, and rest angles α at x₀ and β at x₁ in each triangle:

  ```text
  K = (cot β₀ + cot β₁,  cot α₀ + cot α₁,  -(cot α₀ + cot β₀),  -(cot α₁ + cot β₁))
  C = Σᵢ Kᵢ xᵢ   (a vector, zero on any flat or rigidly moved hinge)      E = 3B |C|² / 2(A₀ + A₁)
  ```

  Projected as one linear vector constraint with α = (A₀ + A₁)/3B, each corner moves by `-wᵢ Kᵢ C / (Σ wⱼ Kⱼ² + α̃)`: a few multiplies, because the gradient is constant. |C| ≈ |e| θ for a small dihedral angle θ, so E is the usual discrete shell energy. Bender, Koschier, Charrier and Weber (2014) put strain and bending energies into position-based solvers this way. The rigidity B sets the bending length (B/ρ_A g)^(1/3), Peirce's (1930) measure of how a cloth resists folding: 2.9 cm for the sheer linen (B = 2.4 × 10⁻⁵ N·m at 105 g/m²), 3.0 cm for the towels and 3.5 cm for the shirting. An earlier trial at a 10 cm bending length flattened a gathered stack's folds and fanned its hem 1.6 m wide.

- **Long-range attachments.** Each particle stays within the fabric distance of its pin or peg (Kim, Chentanez and Müller 2012), one-sided, so a 3 m drop does not sag with a handful of passes; each line node stays within its arc length of both posts.
- **Ordering and separation.** One-sided constraints keep the same phase of neighbouring bays at least 0.6 ring pitches apart along the rod (a gathered stack's layers cannot pass through each other) and a shirt's front and back at least 16 mm apart: cheap stand-ins for self-collision where this scene needs it.
- **Contacts.** Half-spaces, boxes and capsules (the glass front and door pulls, the door head beam, the rods, the posts, the cap rail and balustrade, the floor), each widened by the fabric's thickness, with position-based friction that removes most of a substep's sliding. A capsule's bounding box rejects distant particles first.
- **Air.** Per triangle, from the wind relative to the triangle's mean velocity `u = w - v̄`: `F = ½ ρ A |u| [C_N (u·n) n + C_F (u - (u·n) n)] / (1 + k Δt)` with `k = ½ ρ C_N |u| / ρ_A`, a third to each corner (after Keckeisen and colleagues 2004). The divisor applies the drag semi-implicitly, so a gust cannot drive the cloth past the air's own speed. C_N is 0.75 for the open sheer, 1.05 for a towel. Wind is sampled on a lattice of particles and interpolated.

Constraints run in colour batches, bending then shear then stretch, so the stiff weave has the last word. A constraint takes its compliance from the pattern that made it (a pegged towel corner is welded to a line node, which belongs to the line). After construction a step allocates nothing. Steps are fixed (30 Hz), deterministic for a seed and a sequence of deltas, and sample the wind at the scene's own clock. An island sleeps when its wind stays under a threshold (0.18 m/s for a curtain, a lean of about 0.015 rad; 0.18 m/s for the laundry) and every particle has stayed under 1.2 cm/s for a second, and wakes for wind above 1.3 times that or a moving pin, so the panels by fixed glass rest in the lulls and stir in the gusts. Settling relaxes the drape without wind under heavy damping, then holds it: under reduced motion, and for each panel's starting drape, which settles on a background task while the page loads, so a panel never visibly relaxes from straight columns when first seen.

### The curtains

Each panel is 33 × 21 particles of sheer linen (105 g/m²) at a fullness of 2: 2.24 m of fabric for a 1.12 m half-rail in the kitchen, 1.84 m in the lounge, over a 3.07 m drop. Seven rings, 25 rows and eight substeps cost three times as much a step in the live scene (3-5 ms a frame for a room view's two panels); six rings and 21 rows halve the particles, and with six substeps the doorway jet stretches the weave about 6 % (5.5 % at the median, 6.3 % at worst).

- **Hardware.** A 25 mm bronze rod 25 cm in front of each door head's room face, on return brackets just outside the end rings, with turned finials. Six 34 mm rings ride each panel's rod, and each ring's clip holds the fabric's top edge 5 cm under the rod's centre. Rings touch at 41 mm, which sets a stack at 20.5 cm. `createCurtainHardware` draws the rods, brackets and finials as one static mesh and the 24 rings with their clips as one instanced mesh.
- **Heading.** The top row is the stiff heading tape, kinematic: each clip pinches three columns within ±7 mm (a small W, outer columns toward the room), and the tape between two pinches bows as a half sine whose arc length is its fabric, alternately toward the room and the glass. The bow is solved from a tabulated inverse of `L/s = (1/π)∫₀^π √(1 + m² cos²u) du`. Opening slides the lead ring at no more than 0.45 m/s and spaces the others evenly; the bays deepen into loops and the fabric below follows dynamically. A free tape was tried first and could not carry the columns' weight once a stack folded it into a deep U.
- **Drape.** Below the heading the rest lengths are the fabric's own, so the folds made by the pinches soften downward under gravity and bending, and a stack flares toward the hem (about 0.2 m wide at the rod, 0.5 m at the hem). The tape's lower edge bends 8 times stiffer, and the doubled hem 6 times stiffer with 45 g/m of weight, so the hem hangs level and swings with weight.
- **Contacts.** The room side of the door pulls (z ≥ -4.331 m plus the fabric's 6 mm), the door head beam, the rod, the floor, and keep-outs at the kitchen's dining table and the lounge's potted plant.
- **Drawn smooth.** A gathered bay is four 7 cm cells, which drawn as is reads as a brick pattern of flat facets, so `createCurtainMeshes` draws each row through a uniform Catmull-Rom spline (Catmull and Rom 1974) across its columns at three times the resolution, with central-difference normals: simulated coarse, drawn smooth. Its triangles run column by column: the blended linen writes no depth, so where a stack's layers overlap the layer drawn last shows most, and drawn row by row the order between layers flipped at every row, which drew a light line across a sunlit stack at each row.

### The draft

The facade draft is the coast's indoor air everywhere, plus a jet in each open doorway and a convective layer on closed glass. In the scene (`createFacadeDraft({ coast: coastWind })`) a jet is `0.55 · softplus₀.₁₂(u_out,z) · (0.4 + 0.6 · opening)`, where `u_out` is the coast's outdoor wind 0.8 m outside the door, gusts included, and `opening` the open gap over 0.9 m: about 1.2 m/s in an October afternoon's 2.3 m/s onshore flow, and nothing when the breeze blows off the land. Smoothstep shoulders 0.25 m wide bound the open gap, and the jet decays as `1/(1 + d/1.8 m)` into the room. The jet carries eddies through the doorway: the room field's six divergence-free modes at 3.2 times their wavenumber (wavelengths 0.4–2.2 m), at half the local jet, advected at 0.8 m/s (`x - 0.8 t ẑ`), so a puff that lifts one fold reaches the next a moment later. Where the jet is uniform the eddies keep the curl field's zero divergence; the jet's own profile is not divergence-free. A gust front lifts the doorway panels over its 1.2 s rise and lets them settle over its 3.5 s decay: at 15:30 a gathered doorway stack's hem stands 0.26 m into the room at the 10th percentile, 0.36 m at the median, 0.39 m at the 90th, and 0.48 m at a gust's peak.

### The fabric

`sheer-fabric.mjs` draws the linen. Openness follows a plain weave of round yarns. Each thread direction is a row of cylinders, with yarn-to-spacing ratio r, seen at angle α across the row:

```text
O(ω) = max(0, 1 - r_warp / cos α_t) · max(0, 1 - r_weft / cos α_b),   cos α_t = |ω·n| / √((ω·n)² + (ω·t)²)
```

Head-on, a sheer linen is 27 % open (r = 0.48); the gaps close where cos α = r. These endpoints match the crossed-cylinder screen geometry of Kotey, Wright and Collins (2009). The covered fraction `c = 1 - O(view)` is the fragment's alpha, blended in the transparent pass with both faces in one draw and no depth write, so folds show through folds (a uniform sheer blends nearly independently of order); the linen is drawn before the glass when the camera is outside and after it inside. `?sheer=coverage` restores the October 16 alpha-to-coverage path. Linen's yarns are uneven: a smooth two-dimensional noise stretched along the warp (slubs 3–9 cm long, a couple of millimetres across) and a coarser cloudiness modulate the density by ±16 %, faded before either is finer than about two pixels. The heading tape and the doubled hem are two layers, so their open fraction is squared.

Light from behind the sheet, relative to the viewer, is transmitted where it meets yarn:

```text
L = E cos θ_i (1 - O(ω_i)) / max(c, 0.25) · T · tint · [ (1 - φ)/π + 2 φ p_HG(cos θ_s; g) ],   T = 0.46,  φ = 0.45,  g = 0.6
```

The diffuse part is the thin-walled Lambertian BTDF of glTF's diffuse-transmission extension; the forward lobe is Henyey–Greenstein about the light's travel direction, so linen glows hardest around the sun. The tint is the cloth's own colour, so light through an indigo towel is indigo. Indirect light uses the hemisphere, ambient and environment irradiance on the far side, plus the blurred environment along the view ray. Reflection is Three's physical BRDF with Charlie sheen. In the sun's shadow map the fabric is a dithered occluder: a fragment is discarded where an ordered 3 × 3 threshold falls below `O(ω_l) + (1 - O)·T̄·φ·0.7`, which `PCFSoftShadowMap`'s three-texel box reads back as a partial shadow. The fabric's own lookup offsets toward each light, so a back-lit sheet is not shadowed by itself while its other folds, frames and rock still shadow it: folds shade the folds behind them softly. Towels and the shirt use the same shader opaque (`coverage: "opaque"`), with 2.5–5 % openness for the transmission and the shadow, and woven stripes in fabric metres softened to the pixel footprint.

Each curtain panel carries its own depth and distance materials (the dithered sheer shadow), so the shadow cache (`shadow-cache.mjs`) draws it every frame and its shadow never freezes. The towels, the shirt and the line are moved on the CPU, so the cache sees each upload as a moved caster and keeps their ordinary shadows once they have slept for 30 frames. The rods are static and join the cache; the instanced rings and pegs always redraw.

### Laundry on the terrace

Sirui asked for "cloth simulation, etc." alongside the curtains, with three linen towels pegged on a sunny Mediterranean terrace as the reference. `laundry-line.mjs` hangs a cotton line between the first two festoon posts on the parapet (3.1 m, tied at 1.94 m, sagging 6 cm under the load) with an indigo flat-woven linen towel with natural warp stripes, Sirui's white linen shirt, a natural towel with an ochre band and a terracotta towel. The line is a chain of particles in the same island as the cloth; each wooden peg (8 g) welds the cloth to a line node, so the towels' weight pulls the line into a V at every peg, and a gust that lifts the towels shakes the line. Towels are pegged with slack, their pegs 72 % of the fabric apart, so each top edge scallops and soft folds run down from the pegs. The shirt's front and back are welded at the shoulders (outside the neck) and the side seams, with rolled sleeves as tubes welded to the armholes, an interfaced collar and yoke, a placket down the front, and pegs at the shoulder points.

The line stands at the parapet's edge beyond the cave lip, so it takes 42 % of the open coast's wind, an authored exposure against 12 % for the olive tucked under the lip, gusts and veer included. The room field's modes at 4.5 times their wavenumber (0.27–1.6 m, the size of a towel's ripples) add eddies at 34 % of the local speed, advected onshore at a steady 1 m/s. The afternoon sea breeze blows onshore, so the laundry lifts toward the house with the sea behind it. Contacts are the posts, the bronze cap rail and the glass balustrade (capsules along the parapet's curve, from `bin/coastal_facade.py`'s superellipse) and the paving. The laundry is out while the house is open (the facade doors' rule: daylight and Sirui up) and in at dusk. `laundry-rig.mjs` draws one mesh per item, sharing one position buffer, a tube through the line's nodes and the pegs as one instanced mesh. It steps while any item's box is on screen and the laundry is at least about 40 px tall, at 30 Hz with six substeps; it holds under Pause and composes a settled drape under reduced motion. Dense linen casts an ordinary shadow, which the shadow cache keeps while the laundry sleeps, and each item is culled by the sphere around its own cloth.

### Curtains in the scene

`createCurtainRig` hangs the four panels and their hardware before the first view compiles, binds the static light field and the light installations to every material, creates the laundry, and each frame:

1. passes the facade doors' slide offsets to the draft;
2. sets the glass draft rising by day and falling at night;
3. marks each panel active when the box around its cloth as it hangs now (padded 15 cm) is on screen and the panel is about 90 px tall or more (so within about 25 m), and culls its mesh against the sphere around that box (a fixed sphere around a tall, thin panel held cameras standing in front of it and stepped cloth behind them);
4. applies the schedule: drawn by the rings on screen, settled off screen or in a still;
5. steps the active panels at the scene's own clock, 30 Hz with six substeps (h = 1/180 s), at most two steps a frame;
6. uploads and refines only the panels whose solver moved, and moves the rings when a panel is drawn or gathered;
7. steps the laundry.

Off screen, asleep, paused or in reduced motion the cloth costs nothing. Pause holds every particle and the frame; reduced motion composes settled drapes.

`curtainSchedule` (pure, in `curtain-cloth.mjs`) sets each panel's open fraction (0 drawn closed, 1 gathered):

| When                                                                                 | Panels                                                                                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sirui asleep                                                                         | All drawn                                                                                                                                        |
| Night: daylight ≤ 0.3, the threshold that also shuts the doors                       | All drawn, except the panel across the camera's sightline in the room Sirui occupies (dinner in the kitchen, Watching the Pacific in the lounge) |
| Day                                                                                  | All gathered: the doorway panels' stacks billow in the jets, and the panels over fixed glass sway in the indoor air                              |
| Low western sun: glare g rises as the sun drops from 32° to 16°, standing out to sea | Each panel draws to 1 − g × depth: kitchen-south 0.55, kitchen-north 0.8, lounge-south 0.75, lounge-north 0.5                                    |
| By day, the occupied or visited room                                                 | Its view panel stays at least 0.8 open                                                                                                           |

The doorway panels draw least, which keeps the breeze coming in. Fractions are quantized to 0.05. On October 15 the panels start drawing at 15:35, are fully drawn from 16:50 to 18:00, reopen for the sunset from 18:05 to 18:25, and close with the doors at 18:30.

### Sources

- [Müller, Heidelberger, Hennix and Ratcliff, Position Based Dynamics, 2007](https://matthias-research.github.io/pages/publications/posBasedDyn.pdf).
- [Macklin, Müller and Chentanez, XPBD: Position-Based Simulation of Compliant Constrained Dynamics, 2016](https://matthias-research.github.io/pages/publications/XPBD.pdf), and [Macklin et al., Small Steps in Physics Simulation, 2019](https://matthias-research.github.io/pages/publications/smallsteps.pdf).
- [Bergou, Wardetzky, Harmon, Zorin and Grinspun, A Quadratic Bending Model for Inextensible Surfaces, Symposium on Geometry Processing 2006](https://doi.org/10.2312/SGP/SGP06/227-230).
- [Bender, Koschier, Charrier and Weber, Position-based simulation of continuous materials, Computers & Graphics 44, 2014](https://doi.org/10.1016/j.cag.2014.07.004).
- [Kim, Chentanez and Müller, Long Range Attachments, SCA 2012](https://matthias-research.github.io/pages/publications/sca2012cloth.pdf).
- [Peirce, The "handle" of cloth as a measurable quantity, Journal of the Textile Institute Transactions 21(9), 1930](https://doi.org/10.1080/19447023008661529), for the bending length.
- [Keckeisen, Kimmerle, Thomaszewski and Wacker, Modelling Effects of Wind Fields in Cloth Animations, WSCG 2004](http://wscg.zcu.cz/wscg2004/Papers_2004_Full/C73.pdf) for per-face forces from the relative air velocity; this module uses one flat-plate normal coefficient plus skin friction instead of their separate drag and lift coefficients.
- [Catmull and Rom, A Class of Local Interpolating Splines, Computer Aided Geometric Design, 1974](https://doi.org/10.1016/B978-0-12-079050-0.50020-5).
- [Kotey, Wright and Collins, Determining Off-Normal Solar Optical Properties of Insect Screens, ASHRAE Transactions 115(1), 2009](https://uwspace.uwaterloo.ca/handle/10012/11550).
- [Estevez and Kulla, Production Friendly Microfacet Sheen BRDF, SIGGRAPH 2017 course](https://blog.selfshadow.com/publications/s2017-shading-course/imageworks/s2017_pbs_imageworks_sheen.pdf), which Three's sheen implements.
- [Khronos, KHR_materials_diffuse_transmission](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_diffuse_transmission/README.md).
- [Henyey and Greenstein, Diffuse radiation in the Galaxy, ApJ 93:70, 1941](https://doi.org/10.1086/144246); the form used follows [pbrt's phase functions](https://pbr-book.org/4ed/Volume_Scattering/Phase_Functions).
- [Jimenez, Next Generation Post Processing in Call of Duty: Advanced Warfare, 2014](https://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare/) for the interleaved gradient noise of the coverage path.

### Cost, evidence and limits

Cost was measured on October 18 in headless Chromium on the shared laptop's integrated GPU, at 1440 × 1000 and DPR 1 (a 545 × 461 canvas), Friday 15:30 with both doors open, interleaved against ec8cdb5ac with `bin/measure_coastal_views.cjs` (base, work, work, base; medians, ranges in brackets). In the kitchen room view, where the doorway stack and its neighbour step, the curtains' own step takes 3.4 ms a frame: 3.0 ms solving, 0.3 ms writing the refined meshes, against 0.9 ms for the October 16 panels. The frame's submit time went from 15.9 to 14.4 ms (14.6–15.9, 13.9–14.4), within noise, and draws rose by 4 (302 to 307, 2 of them in the shadow map). The living room camera stands on the terrace looking in and steps two panels: 3.8 ms against 3.2 ms before, submit 17.6 to 20.7 ms (14.5–17.6, 16.6–20.7), 6 more draws. At the terrace the laundry steps for 1.4 ms a frame (p95 2.7 ms) and adds 13 draws with its shadows. Outside at 48 m nothing steps, and the cloth adds 19 draws to about 1,280, where submit and GPU time swung by more than that between runs on this shared GPU. Off screen, asleep, paused or in reduced motion the cloth costs nothing. Before the panels went to six rings, 21 rows and six substeps, and before visibility used boxes, the step had cost 3.4–5.1 ms in the kitchen and 9.1 ms in the living room view, where fixed spheres around the tall panels stepped cloth behind the camera. Alone in Node, all four panels step in about 1.6 ms per 60 Hz frame (30 Hz steps), and the laundry in 0.8 ms per step. The rig builds in 80–200 ms (warm–cold) while the page loads; the starting drapes then settle on background tasks before the first frame (the startup's longest task, 208–278 ms against 216–354 ms, did not grow). In the doorway jet the panels stretch 5.5 % at the median and 6.3 % at worst; in still air 3 %. Measurements are in `.jekyll-cache/visual-qa/cloth-2026-10-18/perf/`.

`test/cloth-solver.test.mjs` checks that the bending weights vanish on flat and rigidly moved hinges and give |C| = |e| θ; bounded stretch in still air and a gale; that the energy decays after a gale and the island sleeps; that a sheet driven at 9 m/s into a wall never passes it; bitwise determinism; welds and per-pattern compliance; no allocation per step; and the bending lengths. `test/curtain-cloth.test.mjs` checks stretch in still air (under 6 %), the doorway draft (under 8 %) and an indoor gale (under 45 %); energy decay and sleep; rings on the rod in order and clips within their jaw; gathering no faster than a hand; no crossing in a gathered stack; determinism and frame partitioning; sleep and wake by wind and doors; reduced motion; no allocation; the draft's door contrast, its agreement with the shared field and its eddies' zero divergence; clearances against the furniture and hardware; that a land breeze never presses the cloth through the glass front; normals, tangents and winding; the drawn spline through every simulated column, drawn column by column; the openness model and linen slubs; and the shader patches. `test/curtain-schedule.test.mjs` keeps the schedule's contracts and checks the rig's hardware, materials and visibility budget. `test/laundry-line.test.mjs` checks the line between the posts, the lift in the sea breeze against the 09:00 lull, no passage through the posts or the cap rail, the line's length, the shirt's separated layers, the schedule, determinism, allocation, and the rig's pause, reduced motion and visibility. The browser case "facade cloth" in `test/visual/desk-scene.spec.js` finds every starting drape settled when the kitchen first steps, steps the curtains in the kitchen and the laundry on the terrace in a live scene, sees the laundry's pixels move, holds them under Pause and composes them under reduced motion. Captures are in `.jekyll-cache/visual-qa/cloth-2026-10-18/`.

Limits: there is no general self-collision; ordering and separation constraints stand in for it, so a violent gust can still fold a bay through its neighbour's far side, and a towel can pass through itself. One pass per substep leaves a few percent of local stretch near the clips and the pegs (the towels at most about 8 %, but a few edges at the shirt's shoulder pegs and armholes up to about 20 %), and an indoor gale stretches the panels like sails. The air model has no shielding, wake or feedback on the flow, and the flat-plate force cannot produce flutter from vortex shedding; the advected eddies stand in for it. The heading tape is kinematic, so the very top row does not sway. Depth shadow maps cannot colour the light the yarn transmits, and the dither resolves cleanly only under `PCFSoftShadowMap`. The fabric is authored, not measured: neither yarn-level specular nor a microcylinder cloth model is implemented, and the laundry's exposure and the doorway jet are authored, not ventilation or CFD.

## Dynamic sleeper duvet: October 23 checkpoint

`duvet-solver.mjs` advances a bounded compliant-distance cloth around each
avatar's authored contact drape. Source vertices are welded into coarse groups
using a 0.15 m grid, widened until there are at most 480 particles. Native mesh
edges provide stretch links; two-edge neighbours provide a distance-based bending
approximation. The solver uses 120 Hz steps, two projection/contact passes per
step, gravity, velocity damping and an authored breathing lift of at most 7 mm
within a 0.3 m chest radius. Frame deltas are capped at 1/15 s. Contact normals
come from the fitted rest drape, and displacement is bounded to 25 mm around that
envelope. Pillows remain static.

The rendered quilt keeps its original high-resolution vertices, thickness and
folds. Each vertex receives its coarse group's displacement; these details have
no independent physical degrees of freedom. `bedding-breath.mjs` writes the
positions and recomputes normals only while the visible sleeper is active. Pause
holds the current geometry. Reduced motion restores the authored arrays exactly;
returning from 2D resumes active simulation.

The integrated controller also holds the quilt while another room or the exterior is being visited;
the solver runs in bedroom/whole-home views. This visibility gate was added after the retained
Lizard benchmark and does not change its visible-view particle settings.

The [retained Lizard retest](../../../artwork/coastal-home/reviews/duvet/lizard-optimized.json)
records the inspected working-source hashes, solver parameters, frame samples,
bounds and state checks. The solver SHA-256 was
`40adfe36ae2b6de8c79f2e26ee68c9ae1fe6dee467d8e4f8a549c82f0a3731c0`;
wrapper and controller-function fingerprints are in the same JSON. This records
observed working sources rather than assigning a final integrated commit.

On the shared Windows headless Chromium run at 1440 x 1000, DPR 1, with a
545 x 462 canvas, the Lizard duvet retained 4,934 rendered vertices and simulated
281 particles with 3,237 constraints. After three seconds of activity and 30 more
warmup frames, 120 rendered frames measured total duvet update/write/normal cost
at **3.6 ms p50, 6.7 ms p95 and 7.6 ms maximum**. These are CPU update timings,
not total-frame or GPU timings. The observed pose displaced vertices by at most
3.89 mm, with 0.66 mm RMS displacement; its largest bounding-box coordinate change
was about 1.30 mm. Native triangle edges initially at least 8 mm long had length
ratios of 0.9487 to 1.0451 in that pose. This is a geometric snapshot, not a global
strain bound.

The [authored view](../../../artwork/coastal-home/reviews/duvet/lizard-authored.png),
[dynamic view](../../../artwork/coastal-home/reviews/duvet/lizard-dynamic.png) and
[reduced-motion view](../../../artwork/coastal-home/reviews/duvet/lizard-reduced.png)
were inspected together: coverage and the native folds remain readable, with no
new visible holes or body-through-cover in this view. Pause preserves hashes and
step counts; reduced restoration has zero coordinate error; 2D-to-3D recovery
resumes stepping. The run recorded no console errors and no nonfinite positions.

Limits: contact follows a fixed avatar-specific envelope rather than solving
against a live animated body or arbitrary scene objects. There is no general
self-collision. Bending is a compliant distance approximation, and neither cloth
properties nor breathing forces are calibrated measurements. This optimized
benchmark covers Lizard only; previous five-avatar visual checks are separate.
The small observed deformation and one camera do not establish correctness for
all poses or all hardware.
