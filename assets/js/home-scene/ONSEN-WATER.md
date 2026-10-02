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

The authored water radius is approximately 0.86 m. The coordinator measures the actual loaded mesh's world bounds and supplies its center, radius and top height. A 40 × 40 grid gives 4.3 cm cells and 1,264 initially wet cells at that radius. The 0.24 m uniform depth and freshwater density of 1,000 kg/m³ are illustrative parameters, not a measurement of an actual La Jolla bath. Gravity is 9.80665 m/s²; drag is 0.55/s.

The solver stores depth and staggered velocities in Float64 arrays. Fixed 1/120 s active ticks are subdivided using `ceil(tick × ((|u|max+c)/dx + (|v|max+c)/dz) / 0.45)`, where `c=sqrt(g h_max)`. Default evidence required two subdivisions per tick. Face speeds have a 2 m/s emergency bound; ordinary probes never reached it. Impulses are resolved over at least two cells, capped at 25 mm, and subtract their wet-cell mean so they add no volume. These bounds target small pool waves; the solver is not validated for violent flow, shocks or arbitrary external array mutation.

Circle and obstacle boundaries use a staircase cell mask with exactly zero normal-face velocity. A 0.17 m bather radius is a torso footprint approximation. Changing that mask transfers excluded volume uniformly to remaining fluid; removing it refills the newly wet cells and preserves total volume. This instant redistribution is a composition approximation, not swept-volume momentum coupling. An arrival at the default perch raises the water by approximately 9.9 mm. Moving solid masks can do external work, so unforced energy-decay tests exclude those transitions. Sub-cell pose noise has a half-cell deadband.

Wave energy is a diagnostic in joules: `0.5 ρ g Σ(h−mean(h))² cellArea + 0.5 ρ Σh |v_center|² cellArea`. Cell-centered velocity is the mean of neighboring faces. It is an approximate discrete energy, not an exact invariant of the integrator. Upwind transport, semi-Lagrangian interpolation and drag dissipate it.

## Renderer and clock integration

`onsen-water.mjs` exports `createOnsenWater({center:[worldX,worldZ],surfaceY,radius,depth})`:

- `surfaceGeometry()` returns a world-space, upward-facing circular top: 1,921 vertices / 3,744 triangles. Transform it by the inverse native mesh world matrix before assigning it to that mesh. The caller owns and disposes the geometry.
- `bindMaterial(material,mesh)` preserves the existing material and contact-lighting compile hooks, removes the old onsen normal sines, and binds simulated elevation plus finite-difference slopes. Call it after world matrices are current. The pool and its ancestor transforms must then remain static; inverse-world vertical scale is captured once.
- `setBather({x:worldX,z:worldZ,radius:.17}|null)` changes the reflecting mask. `disturb({x,z,amplitude:.003,spread:.12})` supplies explicit zero-volume forcing. Neither method owns an animation clock. A prescribed active-time stroke is authored forcing, not sensed hand-water contact.
- `advance(activeDeltaSeconds)` evolves and uploads the field. Call it only while the scene's existing visible, in-viewport, nonhidden, unpaused, nonreduced clock moves. A paused/reduced render must not repeatedly inject forcing or move an unchanged obstacle. An explicit new still composition can set its initial occupancy.
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
