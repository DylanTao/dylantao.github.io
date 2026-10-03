# Bounded bath mist transport

`steam-density.mjs` evolves two three-dimensional cell-centered scalar fields:
an optical droplet-concentration proxy `rho` and temperature above ambient `T`
in kelvin. `steam-volume.mjs` integrates their density with local, emission-free
single scattering. All code is original to this site.

The primary references are [Stam's Stable Fluids (1999)](https://www.dgp.toronto.edu/public_user/stam/reality/Research/pdf/ns.pdf),
[Fedkiw, Stam and Jensen's Visual Simulation of Smoke (2001)](https://graphics.stanford.edu/papers/smoke/smoke.pdf),
and [Wronski's Volumetric Fog presentation (2014)](https://bartwronski.com/wp-content/uploads/2014/08/bwronski_volumetric_fog_siggraph2014.pdf).
Stam supplies the characteristic-backtrace idea; Fedkiw et al. separately
transport smoke concentration and temperature and relate hot gas to buoyancy;
Wronski explains exponential extinction and accumulated scattering, including
the need to account for transparent surfaces. This implementation is a small
local adaptation rather than a reproduction of any complete paper system.

## Scalar evolution

The illustrative model is

```text
v(x,t) = windScale * curlWind(x,t) + [0, baseRise + thermalRise*T(x,t), 0]
d rho/dt + v dot grad(rho) = D*laplacian(rho) - (dissipation+escape(x))*rho + source
d T/dt   + v dot grad(T)   = D*laplacian(T)   - (cooling+escape(x))*T + heatSource
```

The same six-mode curl field drives the site's leaves and other particles.
Its modal sines are evaluated using separable axis coefficients at grid centers,
avoiding six transcendental calls per voxel. Wind inside the sheltered bath is
scaled to 0.16 of the exterior field. The temperature term prescribes terminal
rise speed; it does not integrate momentum or solve a pressure equation. Adding
temperature-dependent rise also means that the combined velocity need not be
divergence-free.

At each fixed 1/30-second tick, midpoint backtracing follows the previous
temperature-dependent velocity, and positive trilinear interpolation samples
the old concentration/temperature. A six-neighbor explicit diffusion update is
a convex combination when `2*D*dt*(1/dx²+1/dy²+1/dz²) <= 1`; invalid parameter
combinations are rejected. Outside-domain samples are zero, and a side/top
escape sponge releases the small local field. Cooling and dissipation use exact
exponential factors. Wet-surface sources relax toward bounded target values
with `1-exp(-sourceRate*emitter*dt)`, keeping `0 <= rho <= 1` and
`0 <= T <= 14 K` for the defaults. A fixed source patch introduces spatial
variation; there is no scrolling opacity-noise animation.

The default domain extends 0.72 meters above the measured pool surface. Most
concentration remains in its first 0.3 meters; a static upper taper keeps the
face readable. These are authored visual/thermal parameters, without measured
humidity, a condensation/evaporation law, obstacle-pressure coupling, physical
mass conservation, or resolved turbulence. Semi-Lagrangian concentration
transport adds numerical diffusion and does not conserve scalar mass exactly.

## Light integration and glass

At each of at most 40 midpoint ray samples, the shader evaluates

```text
sigma = extinction * rho
segmentT = exp(-sigma * stepLength)
L += accumulatedT * (1-segmentT) * albedo * incidentLight
accumulatedT *= segmentT
```

The directional incident term uses a normalized Henyey–Greenstein phase
function and two short density samples for approximate local attenuation.
`direction` points from the sample toward the light; the camera-to-scene ray
therefore has cosine 1 when looking toward the source. Ambient light is an
external, low-frequency illumination approximation. There is no emission,
multiple scattering, or opaque-geometry shadowing along light paths.

Root integration supplies matching-camera native-resolution opaque depth and
nearest-transmissive depth, excluding the mist itself. Two draws partition
the ray exactly once at that nearest interface:

- An explicitly blended opaque-list box integrates gas behind the interface.
  It participates in Three r164's opaque transmission-background capture.
- A transparent-list box integrates gas in front of that interface, after
  water/glass have shaded. Without an interface the opaque-list draw integrates
  the complete solid-clipped interval and the other draw discards.

Back-face rasterization covers a camera inside or outside the bounds; the
ray's near-plane origin supports perspective and orthographic cameras. Both
draws stop at opaque depth and output linear premultiplied scattering and
opacity using `One, OneMinusSrcAlpha` blending. The scene's OutputPass owns
tone mapping/display conversion. Per-draw viewport/camera uniforms also cover
the renderer's transmission capture. A different camera must bind its own
depth or hide the volume, as the coordinator does for sea reflections.

This represents one nearest interface plus Three's approximate screen-space
refracted background. It is not exact multi-interface transparent transport or
a refracted ray traced through the density grid. Ordinary alpha-blended
particles are drawn later; arbitrary particle interleaving is not solved.

## API, lifecycle and cost

```js
const field = createSteamDensity({ bounds, center: [poolX, poolZ], radius, surfaceY, grid: [18, 18, 18] });
await field.prewarmAsync(6, { yieldTask, shouldContinue }); // caller owns scheduling/disposal
const volume = createSteamVolume(field, { steps: 40, extinction: 0.7 });
scene.add(volume.object);
finish.setVolume(volume); // coordinator-owned dedicated depth integration
volume.setDepth(opaqueDepthTexture, nearestTransmissionDepthTexture, camera);
volume.setLighting({ ambient: [0.46, 0.48, 0.48], directional: [1.8, 1.45, 1.1], direction: [0.3, 0.8, 0.2] });
field.advance(delta, { fieldTime: elapsed, sourceEnabled: true });
volume.sync();
```

`prewarmAsync` does one tick before each caller-supplied task yield, checks the
caller abort guard each slice, and returns true on completion or false on abort.
Its negative-time modal phases exactly match synchronous `prewarm(6)` and end
at scene field time zero without advancing active `simulationTime`. Active
stepping is suppressed while warmup owns the field. A caller aborts/disposes
that partial field rather than restarting warmup.

Pause, hiding, leaving the onsen and reduced motion preserve the last mature
composition without scalar ticks/uploads. The coordinator owns those policies;
neither module starts a frame loop, timer or listener. `advance` rejects invalid
delta, accepts at most 0.25 seconds, reports `droppedTime`, and samples the most
recent accepted interval of the shared active clock. It retains less than one
fixed tick of remainder. `field.revision` makes skipped uploads constant-time.

RGBA8 density/temperature tiles require ordinary byte-texture bilinear filtering
in XY and explicit interpolation between two Z slices. They do not require
floating-point linear filtering. Quantization error is at most 0.5/255 of the
configured scalar range at grid centers. The 18³ field occupies about 242 KB
including CPU scratch and a 90×72 atlas; the 24³ alternative about 563 KB with
a 120×120 atlas. There are six density texture taps per ray step, up to two
segment draws plus Three's background recapture. Depth-pass cost and rendered
GPU behavior require native scene acceptance by the coordinator.

One local Node measurement under concurrent CPU test load found median/p95
ticks of 2.83/4.07 ms for 18³ and 7.61/9.87 ms for 24³. Six-second prewarm totals
were 608/1786 ms respectively, spread across caller-owned slices in production.
These measurements are CPU evidence rather than browser frame-time promises.

`node --test test/steam-transport.test.mjs` checks empty/passive controls,
translation speed, thermal rise, positive diffusion/cooling, source escape,
30/60/144 Hz agreement, pause/reduced/stall behavior, deterministic yielded
warmup and abort, atlas quantization, interval partitioning, analytic
Beer–Lambert composition, phase normalization and adapter resource ownership.
Source/CPU checks do not confirm that a WebGL shader compiled or looked correct.
