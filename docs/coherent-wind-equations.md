# Coherent coastal wind and attached leaves

These original kernels use the curl-potential idea discussed by [Bridson, Hourihan and Nordenstam, _Curl-Noise for Procedural Fluid Flow_ (SIGGRAPH 2007)](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf). Our small analytic Fourier basis substitutes for their Perlin potentials. This is a bounded procedural field informed by graphics research; it does not establish isotropic turbulence, a Kolmogorov spectrum, obstacle boundary conditions, Navier–Stokes fluid simulation or a cloth/forest solve. In particular, multiplying velocity by a spatial mask would invalidate its divergence guarantee. No such mask or pointwise speed clamp is used here.

## Field, units and bound

For positions in meters and active time in seconds:

\[
A(x,t)=\tfrac12\bar v\times x+\sum_j a_j\cos(k_j\cdot x+\phi_j(t)),\qquad
v=\nabla\times A=\bar v-\sum_j(k_j\times a_j)\sin(k_j\cdot x+\phi_j(t)).
\]

Each potential coefficient has units m²/s. Wave-vector length is \(2\pi/\lambda_j\), with six wavelengths from 1.2 to 7 meters. Coefficients are transverse and normalized so \(\sum_j|k_j\times a_j|=1\). Default gust multiplier is 0.45 m/s and the constant mean is `[.18, 0, -.08]` m/s. The triangle inequality gives a global speed cap of **0.647 m/s**, while the smooth curl gives analytic zero divergence. Neither assertion depends on sampled extrema. The basis, phase rates and coefficients are locally authored choices, not measured La Jolla meteorology.

`wind-field.mjs` exports `sampleWind(point, seconds, out, options)`, `sampleWindPotential`, `createWindUniforms`, `updateWindUniforms`, `windFieldGLSL` and the immutable `WIND_MODES`. Options contain `mean`, `gust` and `rate`. GPU function `coastalWind(vec3 p)` uses `coastalWindMean`, `coastalWindGust` and six `coastalWindPhase` values. CPU-wrap phases to `[0, 2π)` once per update; keep shader coordinates near this local scene. JavaScript doubles and GPU trigonometry need tolerances, not bitwise agreement. The unit test's float32 arithmetic reference is CPU evidence; native shader compilation remains the integration coordinator's check.

## Inertia, actual attachments and normals

Leaves use the steady periodic response of the critically damped equation

\[
q''+2\omega_0q'+\omega_0^2q=\omega_0^2f(t),\qquad
H(\omega)=\frac{\omega_0^2}{\omega_0^2-\omega^2+2i\omega_0\omega}.
\]

`createPlantUniforms(seconds,{compliance:.018,response:3.5,rate:1})` and `updatePlantUniforms` provide per-mode attenuation and phase lag. Compliance is seconds, converting wind velocity to displacement. Default horizontal deflection is bounded by **11.7 mm** before the vertex weight. This is an authored damped response, not calibrated leaf elasticity. There is no per-frame CPU vertex deformation or connected-component scan. GPU cost is at most six sine evaluations per moving leaf vertex, shared by its position and normal. Rigid/fully pinned vertices and disabled reduced-motion deformation return before sampling.

The native GLBs batch disconnected leaves by material. `buildPlantAttributes(positionArray,indexArray,{attachmentIndex,resolveRoot,...})` welds repeated seam positions and finds connected components once. `createPlantAttachmentIndex(stemPositions,.025)` searches only nearby actual support vertices. `resolveRoot` may instead provide an authored component attachment. Components without support, longer than 1.2 meters, or with a bend span below .04 meter stay rigid. A .018-meter neighborhood around each attachment is pinned. Do not infer attachments from a whole mesh's lowest point.

For root `r`, pinned radius `d₀`, and component outer radius `R`, weight is \(w=[\max(0,(|p-r|-d_0)/(R-d_0))]^2\). Its gradient is emitted with the root and weight. Deformation is \(p'=p+w b\); its Jacobian is \(I+b\otimes\nabla w\). Apply the inverse transpose to normals:

\[
n'\propto n-\nabla w\frac{b\cdot n}{1+\nabla w\cdot b}.
\]

The default displacement and minimum span keep this denominator above .4. Roots and their local tangents remain fixed. Bind attributes `coastalPlantRoot` (vec3), `coastalPlantWeight` (float), `coastalPlantGradient` (vec3) to a runtime geometry clone; retain source GLBs. **Construct weights in world meters.** Convert roots back with inverse `matrixWorld`, and gradient covectors with transpose `mat3(matrixWorld)` before binding to the local geometry. This matters for the study leaf node's .52 scale. The shader's inverse-vector conversion supports orthogonal TRS transforms, including nonuniform scale; arbitrary shear, skinning and instancing are outside this adapter.

Use `patchPlantShader(shader,windUniforms,plantUniforms)` for beauty, custom depth, custom distance and normal materials. It replaces `<begin_vertex>` and, when present, adjusts `<beginnormal_vertex>`, sharing a single bend evaluation. Compose existing material hooks and use a new program-cache key. Applying only beauty leaves shadow/contact positions stale by up to the displacement bound; report that mismatch if an override pass cannot run the identical hook. Hook construction tests are not native shader/render evidence.

Read-only decoding of the current native GLBs with the pinned Draco WASM found **110 supported olive-leaf components out of 132**: core22/22, study22/44, sleep11/11, kitchen22/22, onsen11/11, lounge22/22. The study's remaining22 hanging ellipsoid/vine components stay rigid. These are geometric proximity candidates, not semantic botanical IDs. One agave component happened to approach wood; therefore **restrict this automatic wood resolver to olive-leaf material**. Agave needs a separate explicit ground/base resolver. The ignored native proof and reproducible CPU decoder are `.jekyll-cache/visual-qa/coherent-wind-october/native-plants.json` and `inspect-native-plants.mjs`.

## Bounded particle integration and lifecycle

`createWindParticles({kind,emitters,bounds,wind,seed,timeOffset,step,maxSteps,maxFrame,...physicalOverrides})` accepts `steam`, `dust` or `spray`, world-meter emitter positions and at most256 particles per population. It exposes reusable `positions` and `opacity` Float32 arrays, `advance`, `evidence` and `snapshot`. Bind with `THREE.BufferAttribute(array,itemSize)`; `Float32BufferAttribute` copies its input. Upload both attributes only when `advance` returns true.

Steam and dust integrate `dx/dt = gain*v(x,t) + drift` with midpoint RK2, evaluating both midpoint position and midpoint time. Spray integrates position and ballistic velocity with gravity `[0,-9.81,0]`, finite air drag, seeded launch, lifetime and a simple emitter-floor landing test. Lifetimes, buoyancy, drag and opacity are authored approximations. Particle bounds respawn particles; they do not enforce a fluid's solid-boundary condition, preserve exact volume, or model collision against the actual house.

Call `advance(delta,{active:moving,reduced,fieldTime:elapsed})` for all three populations on every moving scene frame, including hidden steam. Their field samples then share the plant's global active-time clock. Fixed 1/60-second ticks give equal ordinary histories under different render cadences. An inactive/hidden/paused or reduced-motion call adds no time, moves no particle, and schedules nothing. The kernels own no RAF, timer, visibility listener or wall clock. Plant time is likewise supplied by the owning active scene clock; freeze it on pause/absence. Reduced mode can explicitly compose zero plant deflection through its enabled uniform.

Accepted particle time per frame is capped at `min(delta,.25,maxSteps*step)`. `droppedTime` records excess after a stall; `fieldTime` still places samples in the most recent accepted global interval. `backlogSeconds` stays below one fixed tick, so there is no catch-up queue. Default budget is30 ticks, though the .25-second cap permits at most15 at1/60. A stall intentionally does not reproduce an uninterrupted particle trajectory. For a mature still composition, optionally prewarm deterministically in1/60 ticks from a negative `timeOffset` to global time zero (steam9s, dust18s, spray1s), then resume normal owned updates.

`node --test test/coastal-wind.test.mjs` covers analytic curl, coefficient orthogonality, finite-difference divergence, the speed bound, float32-reference agreement, attachment/pinning and seams, deformation normals, material hooks, midpoint convergence, ordinary cadence determinism, pause/reduced behavior, bounds and stall handling. A representative Node run measured **about .2–.3 ms per combined 200-particle fixed tick** (18 steam,42 dust,140 spray), after creation, with no GPU/browser running. This is a CPU kernel observation on this host, not a browser-frame, energy or cross-device guarantee. Per-frame cost and actual visual quality still require the coordinator's native integration captures.
