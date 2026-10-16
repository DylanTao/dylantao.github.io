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
- **The curtains** (`createFacadeDraft({ coast })`). The room air is the coast's indoor air. Each open doorway's jet is 0.45 × softplus of the onshore component of the outdoor breeze 0.8 m outside the door, times the draft's own flutter: about 1 m/s in an October afternoon's 2.3 m/s onshore flow, and nothing when the breeze blows off the land.
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

On October 15, 2026, `curtain-cloth.mjs` and `sheer-fabric.mjs` were added for sheer curtains on rails inside the glass front: a cloth solver driven by the shared breeze, and a thin-sheet fabric whose see-through weave, glow and partial shadow depend on angle. Since October 16 they hang in the scene, in the coast's one wind and on a schedule (see "Curtains in the scene" below). They are a real-time approximation for a browser scene, not a validated textile, airflow or measured-BSDF model.

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

The facade draft is the six-mode room field at 25 % everywhere, plus a jet in each open doorway. The jet speed is `2.4 · softplus₀.₁₂(0.6 + u_out,z) · (1 + 0.32 flutter(rate·t))`, where `u_out` is the shared field 0.8 m outside. Smoothstep shoulders 0.25 m wide bound the open gap, and the jet decays as `1/(1 + d/1.8 m)` into the room, with travelling ±35 % gust cells. Closed glass carries a 0.05 m/s convective layer that decays as `e^{-d/0.18 m}`. In the doorway the median speed is 1.0 m/s (p90 1.4, peak about 1.9 m/s); beside closed glass it is 0.06 m/s. The draft is an authored sketch, not ventilation CFD. In the scene the draft runs in coast mode (`createFacadeDraft({ coast: coastWind })`). The room field is then the coast's indoor air, and the jet is `0.45 · softplus₀.₁₂(u_out,z) · (1 + 0.32 flutter)`, with `u_out` the coast's outdoor wind, gusts included (see "One wind for the coast").

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

### Curtains in the scene

The controller hangs the four panels before the first view compiles, binds the static light field and the light installations to the sheer, and each frame:

1. passes the facade doors' slide offsets to the draft;
2. sets the glass draft rising by day and falling at night;
3. applies the schedule;
4. steps the cloth at the scene's own clock (`update(dt, elapsed)`, so the steps sample the wind at the instants the sea and the bluff show);
5. uploads the positions only when they have changed.

A panel steps only while it is on screen and about 90 px tall or more, so within about 25 m; off screen it holds its pose. In the scene the cloth steps at 30 Hz, five substeps each: half the work of the solver's 60 Hz default. In an October afternoon's doorway breeze it then strains 9–11 % instead of 8 %, and its hem swings about a quarter less (0.5–0.6 m instead of 0.6–0.9 m). It takes at most two steps a frame, so it keeps real time down to 15 fps and runs a little slow below that instead of spending the frame catching up. A panel at rest in still air sleeps. A paused or reduced-motion still composes the settled drape at once; reduced motion keeps the static drape.

Cost was measured within one page: the kitchen view at 16:45, with the curtains shown and hidden in alternating 3.5 s windows on the same host as the wind's measurements. Stepping at 30 Hz with two panels on screen, the cloth and its upload took a 2 ms median of CPU a frame, against 4 ms at 60 Hz. GPU time was 38.2 against 36.8 ms, within noise, for 10 more draw calls. With all four panels on screen (the facade from the terrace, at 60 Hz) they cost about 4 ms of GPU and 8 ms of CPU. In an interleaved A/B at 60 Hz, the kitchen view's submit time rose from 22 to 32 ms, tipping two of three runs from 33 to 50 ms frames on that loaded host; that is why the scene's cloth now steps at 30 Hz. Off screen, asleep, paused or in reduced motion it costs nothing.

`curtainSchedule` (pure, in `curtain-cloth.mjs`) sets each panel's open fraction (0 drawn closed, 1 gathered):

| When                                                                                 | Panels                                                                                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sirui asleep                                                                         | All drawn                                                                                                                                        |
| Night: daylight ≤ 0.3, the threshold that also shuts the doors                       | All drawn, except the panel across the camera's sightline in the room Sirui occupies (dinner in the kitchen, Watching the Pacific in the lounge) |
| Day                                                                                  | All gathered: the doorway panels' stacks billow in the jets, and the panels over fixed glass sway in the indoor air                              |
| Low western sun: glare g rises as the sun drops from 32° to 16°, standing out to sea | Each panel draws to 1 − g × depth: kitchen-south 0.55, kitchen-north 0.8, lounge-south 0.75, lounge-north 0.5                                    |
| By day, the occupied or visited room                                                 | Its view panel stays at least 0.8 open                                                                                                           |

The doorway panels draw least, which keeps the breeze coming in. The gaps between panels let the sun fall through onto the floor beside the sheers' dithered shadows. Fractions are quantized to 0.05. On October 15 the panels start drawing at 15:35, are fully drawn from 16:50 to 18:00, reopen for the sunset from 18:05 to 18:25, and close with the doors at 18:30. `test/curtain-schedule.test.mjs` checks:

- the states at La Jolla hours;
- the glare geometry;
- the size of each step;
- that the curtains change with the doors at every minute of the day;
- that in a 15:30 breeze a doorway panel billows (hem swing over 12 cm), while a panel behind glass sways under half as much but stays awake;
- that once the doors shut, every panel sleeps within about 20 s and then uploads nothing;
- that a breeze off the land feeds no jet;
- time sync, composed stills, and a coast-driven frame with no array allocation.

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

Limits: there is no self-collision, so gathered stacks and violent gusts can interpenetrate, and after a 3–7 m/s gale folds can stay crossed. Structural strain stays at 1–7 % in the doorway draft and reaches about 20 % in such gales. The air model has no shielding, wake or feedback on the flow, so the inner folds of a stack feel the full wind. Depth shadow maps cannot colour the light the yarn transmits, and the dither resolves cleanly only under `PCFSoftShadowMap`, where shadow coverage is quantised to ninths. The fabric is authored, not measured: neither yarn-level specular nor a microcylinder cloth model is implemented.
