# Visitor jumps and pool impacts

Walk uses Space, the touch Jump button, or a new standard-controller A press. A held button does not repeat, and an airborne press adds no second impulse. There is no health or fall penalty. The visitor can leave a cliff, reach the actual beach geometry, enter the pool, float, and leave by the original basin steps.

`walk-flight.mjs` integrates gravity at fixed substeps no longer than 1/120 second. Launch speed is 5.1 m/s and gravity is 9.80665 m/s². `colliders.mjs` sweeps the existing 0.24 m-radius, 1.75 m-high body through horizontal and vertical intervals. Crossed floors and ceilings stop motion; empty air no longer invokes the grounded route's fall guard. Ordinary authored character routes keep their previous grounded movement. A long frame is capped at 0.25 seconds rather than tunnelling through the house.

Only the actual `core_infinity_water` triangles become enterable. The pool datum and the shared ocean-height sampler drive a vertical buoyancy/drag proxy; the field's original submerged steps provide the exit. Pool entry records the downward crossing speed once. Resuming Walk retains airborne state, and falling eye height follows the body instead of easing through a roof.

## Surface model

`pool-impact.mjs` superposes 116 non-uniform cosine modes in the reflecting rectangular basin. Each mode uses `ω² = g k tanh(k h)` at an effective uniform depth of 1.35 m, with an exact damped-oscillator step. The relation is described in [MIT Marine Hydrodynamics, lecture 20, section 6.2.4](https://ocw.mit.edu/courses/2-20-marine-hydrodynamics-13-021-spring-2005/5d48a5937971d973fd8ca90c051a83f8_lecture20.pdf). Boundary-normal slopes vanish and the omitted uniform mode keeps mean displacement zero.

An entry excites a localized, zero-mean depression/rim field. Added wave energy is bounded by the smaller of 18 J and 0.2% of the proxy body's entry energy. The sum of modal amplitude bounds stays below 0.12 m, including repeated entries. Height and two slopes upload through a 64×32 floating-point texture to the original native water grid and physical material. Pause holds the state; damping returns it to rest.

`pool-splash.mjs` adds at most 256 instanced spray/fleck elements and one thin attached sheet. Spray follows ballistic gravity; elongated drops retain their equivalent-sphere volume. Launches fit the native basin footprint. Small, irregular entrainment flecks follow the simulated surface and shrink away. The sheet has unequal ballistic rim heights and a procedural breakup mask. These are bounded appearance proxies, not a solved air/water interface, variable-depth flow or breaking-wave simulation. The buoyant body and surface waves are coupled in one direction at entry.

The dynamic materials set `fixedMaterial` so later room/planting finishes retain the actual splash shader. Runtime evidence reports material ownership and whether the sheet shader compiled. The generic finish previously replaced the custom shader; a source-only check missed that failure.

## Verification

Pure tests cover launch/apex, gravity across frame partitions, floors/walls/ceilings, a real exported roof-to-pool journey, buoyant recovery, the original steps, the native beach, modal energy/volume/bounds, damping, repeated entries, spray gravity and the maximum particle count. Browser journeys use ordinary steering after one supported starting fixture. Pixel checks reject uniform canvases as well as transparent/white blanks. New cases are registered in `test/visual/scene-groups.json`.

The independent material witness changes to an observer camera only after a real jump and entry. Its controlled-clock phase captures are appearance evidence, not a second visitor journey or a frame-rate measurement. Physical-iPhone rendering cost and the separate cliff/arrival redesign still need their own acceptance.
