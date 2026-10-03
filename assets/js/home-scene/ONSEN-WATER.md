# Closed-basin onsen water

This original October 2, 2026 implementation replaces the onsen's prescribed surface bob and sinusoidal normals with a small evolving height field. Waves transport water between cells, propagate, reflect at the pool and bather boundaries, and dissipate. The Pacific ocean keeps its separate authored spectrum. This is a bounded browser customization, not a full SIGGRAPH-paper reproduction or a claim of current SOTA.

## Research relationship

The primary source is [Chentanez and Müller, _Real-time Simulation of Large Bodies of Water with Small Scale Details_, SCA 2010](https://matthias-research.github.io/pages/publications/hfFluid.pdf), section 2.1. The core adopts staggered center heights and face velocities, conservative upwind depth fluxes, free-surface pressure gradients, and reflecting solid faces:

```text
∂h/∂t = −∇·(h v)
Dv/Dt = −g ∇h − λv             [constant bottom]
F_x = u_face × h_upstream
F_z = v_face × h_upstream
h_new = h − dt × divergence(F)
u_face += −g dt × (h_right − h_left) / dx
v_face += −g dt × (h_front − h_back) / dz
```

The implementation uses first-order semi-Lagrangian velocity backtracing rather than corrected MacCormack advection. Pressure precedes the conservative height step. It uses CFL subdivision instead of depth-adjusting the wave speed. A donor-cell draining limiter replaces negative-height clipping; each limited shared flux still enters and leaves with opposite signs. Exponential drag is an authored dissipative term.

It omits wet/dry terrain, PML open boundaries, overshoot suppression, rigid-body buoyancy/drag/lift coupling, particle transfer, breaking waves, foam and FFT detail. The bather is a one-way prescribed circular obstacle, not the paper's two-way triangle-based solid coupling.

## Local model and limits

The authored water radius is approximately 0.86 m. The coordinator measures the actual loaded mesh's precise world bounds and supplies its center, radius and top height. Five agreeing interior ray hits measure the native flat stone bottom, making the served scene's depth approximately 0.127487 m. Missing/nonflat geometry uses a labeled 0.24 m fallback. The standalone solver default remains 0.24 m for historical probes. A 40 × 40 grid gives 4.3 cm cells and approximately 1,264 initially wet cells. Density of 1,000 kg/m³ is an illustrative freshwater value; these are dimensions of the digital model, not a surveyed La Jolla bath. Gravity is 9.80665 m/s²; drag is 0.55/s.

The solver stores depth and staggered velocities in Float64 arrays. Fixed 1/120 s active ticks are subdivided using `ceil(tick × ((|u|max+c)/dx + (|v|max+c)/dz) / 0.45)`, where `c=sqrt(g h_max)`. Default evidence required two subdivisions per tick. Face speeds have a 2 m/s emergency bound; ordinary probes never reached it. Impulses are resolved over at least two cells, capped at 25 mm, and subtract their wet-cell mean so they add no volume. These bounds target small pool waves; the solver is not validated for violent flow, shocks or arbitrary external array mutation.

Circle and obstacle boundaries use a staircase cell mask with exactly zero normal-face velocity. A 0.17 m bather radius is a torso footprint approximation. Changing that mask transfers excluded volume uniformly to remaining fluid; removing it refills the newly wet cells and preserves total volume. This instant redistribution is a composition approximation, not swept-volume momentum coupling. An arrival at the default perch raises the water by approximately 9.9 mm. Moving solid masks can do external work, so unforced energy-decay tests exclude those transitions. Sub-cell pose noise has a half-cell deadband.

Wave energy is a diagnostic in joules: `0.5 ρ g Σ(h−mean(h))² cellArea + 0.5 ρ Σh |v_center|² cellArea`. Cell-centered velocity is the mean of neighboring faces. It is an approximate discrete energy, not an exact invariant of the integrator. Upwind transport, semi-Lagrangian interpolation and drag dissipate it.

## Prescribed palm coupling

Section 2.3.2 of the source paper adapts fluid face velocities toward sampled solid velocities and attenuates deeply submerged interaction. This implementation keeps that relationship but substitutes a bounded palm proxy for triangle-area sampling and swept-volume displacement. For each open face and palm contact, the rate is `k = 7 min(1,s/.025) exp(-s/.18) exp(-r²/(2σ²))` per second, truncated outside `r=3σ`. Here `s` is effective submerged palm thickness in meters and `σ=.1 m` resolves more than two grid cells. The coefficient and proxy dimensions are authored response parameters, not measured hand hydrodynamics.

Overlapping contacts accumulate positive rates and use their rate-weighted target velocity `v_hand`. Within each CFL substep, `v_new = v_hand + (v_old-v_hand) exp(-Σk dt)`. This convex relaxation cannot overshoot its incoming fluid/hand velocity interval. Both components use their corresponding staggered face locations; blocked faces remain zero. Heights change only through the existing conservative flux divergence. Maximum hand target speeds enter CFL selection before integrating drag.

The initial 1.2-second rest tracks the mixer’s arriving pose while the .45-second walk-to-soak crossfade settles. It injects no force. Later skims retain that stable anchor. Palms below the measured floor, speeds above .4 m/s, stale first samples and frame gaps above .25 seconds are excluded. The contact waterline follows the displaced mean surface rather than local instantaneous ripples. Prescribed motion can perform external work, so unforced energy-decay expectations apply after contacts stop, not during skimming. The animation clock freezes through pause/offscreen/hidden states; the solver’s existing bounded time-drop rule still applies to slow frames.

## Renderer and clock integration

`onsen-water.mjs` exports `createOnsenWater({center:[worldX,worldZ],surfaceY,radius,depth})`:

- `surfaceGeometry()` returns a world-space, upward-facing circular top: 1,921 vertices / 3,744 triangles. Transform it by the inverse native mesh world matrix before assigning it to that mesh. The caller owns and disposes the geometry.
- `bindMaterial(material,mesh)` preserves the existing material and contact-lighting compile hooks, removes the old onsen normal sines, and binds simulated elevation plus finite-difference slopes. Call it after world matrices are current. The pool and its ancestor transforms must then remain static; inverse-world vertical scale is captured once.
- `setBather({x:worldX,z:worldZ,radius:.17}|null)` changes the reflecting mask. `disturb({x,z,amplitude:.003,spread:.12})` remains an explicit zero-volume numerical probe; the public scene no longer calls it on a timer.
- `pool-stroke.mjs` prescribes a smooth 10-second rest/lift/skim/return/lower gesture on the existing arm bones. It restores its additive joint correction before mixer evaluation and measures the actual composed palm center and horizontal velocity afterward. The other arm and fully resting clip retain their authored transforms. Anatomical IK drives the hand; fluid drag does not drive the skeleton.
- `advance(activeDeltaSeconds,{contacts})` maps at most two world-space palm contacts to the solver. A resolved compact footprint relaxes open-face fluid velocities toward the measured hand velocity inside each CFL substep. The update is a convex exponential drag step, edits no heights, and leaves blocked faces exactly zero. First samples, zero-time composition, stalls, activity/avatar transitions and visibility recovery suppress placement kicks. This is original prescribed one-way momentum coupling through the paper's external-acceleration term, not its complete two-way solid simulation. No buoyancy, swept hand volume, vertical splash, surface tension or caustic solver is claimed.
- `advance` evolves and uploads the field only while the scene's existing visible, in-viewport, nonhidden, unpaused, nonreduced clock moves. A paused/reduced render must not repeatedly inject forcing or move an unchanged obstacle. An explicit new still composition can set its initial occupancy.
- `evidence()` reports volume in m³, mass in kg, energy in J, CFL, blocked-face velocity, limiter counts and simulated/retained/dropped time. `dispose()` restores material hooks and releases its texture; it is idempotent.

Remove the former mesh-position sine. Each call accepts at most 0.25 s and retains less than one fixed tick; excess active time is counted as dropped. A single four-second frame integrates 0.25 s and reports 3.75 s dropped. It creates no recovery backlog and does not pretend to solve the whole gap. The existing controller must still reset its RAF timestamp on hidden/offscreen recovery.

The adapter packs elevation, central-difference X/Z slopes and wet weight into a 40² RGBA float texture. Nearest filtering and explicit four-tap bilinear interpolation avoid the float-linear extension; float texture and vertex-sampling support are still required. Renormalized wet weights extend the visual field through solid cells, which the native bather occludes, without permitting numerical flux through them. A fully solid sampling neighborhood falls back to the conserved mean surface elevation with a flat normal. A dense round render boundary overlays the staircase numerical boundary. Normal interpolation and the central derivative stencil are an appearance approximation, especially near solids; they are not an exact derivative of the bilinear height reconstruction. Short waves with wavelengths near the water depth have inaccurate dispersion under the shallow-water assumption; no deep-wave or capillary correction is implemented. The adapter adds no render pass, raster asset or GLB.

## Reproducible CPU evidence

Run `node --test test/onsen-water.test.mjs` and `node test/onsen-water-evidence.mjs .jekyll-cache/visual-qa/onsen-water/numerical-evidence.json` after creating that ignored output directory. The latter records source hashes and runtime metadata. The ten focused tests cover rest, reflecting wave speed, conservation, finite/positive states, unforced energy, obstacle arrival/move/departure, frame partition, zero-time freeze, slow-frame drop, bounded forcing, geometry, world-scale normals, shader/contact-hook composition and disposal.

On October 2, Node v24.13.0 on this shared i7-12700K host measured:

| Probe                          | Result                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 8 mm pulse, 10 seconds         | Maximum relative mass error 2.06 × 10⁻¹⁴; depth 0.23563–0.24795 m; zero blocked-face speed; no limiter activations |
| Unforced pulse energy          | 0.0070983 J initially; 0.000024796 J after 10 s (0.3493%)                                                          |
| Reflecting standing mode       | Quarter/half/full-period height errors 0.634% / 0.00121% / 0.00283% of the initial 0.1 mm amplitude                |
| Torso arrival/move/departure   | Maximum mass difference 8.65 × 10⁻¹² kg; arrival rise 9.885 mm                                                     |
| CPU solver and texture packing | Median 0.655 ms / p95 1.000 ms per 1/60 s frame, 300 samples after 120 warm-up frames                              |
| Allocations                    | 134,800 bytes core arrays; 25,600 bytes texture; 83,936 bytes default geometry                                     |
| Module source / gzip           | 20,972 / 6,725 bytes, compressed separately                                                                        |

Those timings exclude evidence scanning, GPU uploads/execution, WebGL compilation and native actor contacts. They are local observations, not mobile or whole-page guarantees. Shader/geometry tests execute on the CPU; the coordinator owns Docker screenshots, actual GPU compilation and pause/reduced/hidden recovery checks before acceptance. Numerical evidence alone does not establish a successful rendered integration.
