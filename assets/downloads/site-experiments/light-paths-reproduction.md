# Light Paths Reproduction Brief

Use this brief to build your own equal-time race between path tracing and Metropolis light transport, or to rerun Sirui Tao's. Keep the fairness rules and the evidence; the onsen scene is only one example of light that is hard to reach.

## Visitor problem

"Metropolis light transport handles difficult light better" is easy to say and hard to see. Let a visitor watch two renderers spend the same time on the same light, with an honest error measure, and read where each one fails.

## Pick light that is hard to reach

- Choose a path that next-event estimation cannot connect: light that reaches a diffuse surface only through a specular one. Sun through rippled water onto a pool floor is the classic case (eye, floor, water, sun).
- Keep the rest of the scene easy (skylit walls), so both renderers show their strengths somewhere.
- Make the light source small enough that random paths rarely hit it, but large enough that a minute shows progress. Here the sun's angular radius is 0.8°, three times the real 0.27°, with the real size offered as an option.
- Hold the sun's irradiance fixed as its size changes (radiance 1 / (π sin² θ)), so size changes how hard the paths are to find, not how bright the scene is.

## One path sampler, two sources of random numbers

1. Write one function that turns a vector of numbers in [0, 1) into a complete path and its contribution, reading every random decision from a fixed coordinate: two for the image position, then a fixed block per vertex.
2. Path tracing feeds it an independent generator (here xoshiro128\*\*) with stratified pixel jitter.
3. Primary-sample-space Metropolis (Kelemen et al. 2002) feeds it a mutated vector: small steps of size s2 · exp(−ln(s2/s1) · U) with s1 = 1/1024 and s2 = 1/64, random sign and wrap-around, and an independent large step with probability 0.3.
4. Accept with min(1, f(new) / f(old)), where f is the luminance of the path's contribution, and splat both the proposal (weight a) and the current state (weight 1 − a).
5. Use next-event estimation with multiple importance sampling (power heuristic) in both, so neither renderer gets a better path sampler than the other.

## Fairness rules

- Give each method its own worker thread and the same wall-clock time; report samples, rays per second and acceptance beside the error.
- Use the same seed and resolution for both, and say which machine produced any recorded numbers.
- Measure error as the luminance RMSE on a coarse grid (here 80 × 60), divided by the reference's mean. Above 100%, the typical error exceeds the average brightness.
- Never start a run automatically. Pause after each minute, when the lab scrolls away, and when the tab is hidden. Show still frames from the same renderer before a run and when module workers are unavailable.

## Build the reference with different tools

- Split path space by what the camera ray meets first. Dry diffuse surfaces converge fast with light tracing from the opening, connected to the eye. Paths that see the water get Metropolis restricted to them, after a burn-in per chain.
- Scale the restricted Metropolis image by a normalization pooled from every independent sample, then correct slow brightness drift against unbiased restricted path tracing on coarse blocks.
- Record the run (here 24 minutes on 18 threads) and the remaining uncertainty (a few percent in the pool's scale).

## Tests worth writing first

- Fresnel reflectance at normal incidence and total internal reflection exactly past the critical angle; Snell's law over random directions from both sides.
- Analytic surface normals against finite differences; every reported water hit on the surface and inside the pool, from air and from water.
- A white furnace: a closed box with known emission and albedo, where both renderers must return the exact value.
- Agreement between the two renderers on skylight only, and on an enlarged sun where sun paths are common.
- Determinism: the same seed gives the same image.

## Pitfalls this build hit

- The normalization is a rare-event estimate. If independent samples rarely find the sun, Metropolis's total brightness is as noisy as path tracing's mean. Say so, and offer any fix (here an optional sky ratio) as an addition, not as Kelemen's method.
- Chains start where the bootstrap found light, usually in skylight, and need tens of thousands of mutations to settle into sunlit paths. Fewer, longer chains reach them sooner in wall time.
- Replaying missed small steps lazily left a few-percent bias in this build; redrawing coordinates the current path did not read removed it.
- A slab shortcut that assumed every ray near the surface crosses it created ghost hits. Test rays that start inside the ripple slab.

## Commands in this repository

```bash
node --test test/light-lab.test.mjs
node bin/make_light_lab_reference.mjs --minutes 24 --threads 18
node bin/capture_light_lab_frames.mjs
node bin/capture_light_lab_frames.mjs --teaser
```

## Sources

- Eric Veach and Leonidas J. Guibas, "Metropolis Light Transport," SIGGRAPH 1997.
- Csaba Kelemen, László Szirmay-Kalos, György Antal and Ferenc Csonka, "A Simple and Robust Mutation Strategy for the Metropolis Light Transport Algorithm," Computer Graphics Forum 21(3), 2002.
- Eric Veach, "Robust Monte Carlo Methods for Light Transport Simulation," PhD thesis, Stanford University, 1997.
- Matt Pharr, Wenzel Jakob and Greg Humphreys, "Physically Based Rendering," 3rd edition, section 16.4.
