# Measuring Brief: Making a Browser Scene Fast

Use this brief to find where a WebGL scene's frame goes and to cut it without changing what visitors see, or to rerun the October 18, 2026 pass on Sirui Tao's 3D coastal home. The record at `/projects/graphics-lab/record/#performance` (data in `_data/design_records/graphics-lab.yml`) and `docs/performance-notes.md` hold the measurements and the next steps.

## Visitor problem

A scene that stutters reads as broken, and a fix that quietly changes the picture is worse. Make every saving measurable and every cut provably invisible, or say plainly what it changes.

## Count before you cut

1. Fix everything that varies between runs: seed the page's randomness, fix the clock the scene reads (here Friday 13:20 on the routine), use a fresh browser per run, and keep the window and device pixel ratio constant.
2. Attribute every draw to a render pass. Wrap the WebGL context and assign each draw to a pass by the size of the image it draws into: the shadow map, a reflection target, the main view and its copies all have different sizes.
3. Time the script inside the frame callback, and the GPU with a timer query where the browser allows. Record draws, shader program switches and shadow-map draws per frame beside the times.
4. Profile the CPU once before deciding anything. Here the largest single cost was not a draw at all: three.js r164 re-flattened thirteen `Vector3[]` uniforms on every material switch, about 100,000 `toArray` calls per frame.

## Compare fairly

- Run base and change alternately (base, change, change, base) and report the median of the runs' medians with the range. A shared laptop drifts between batches; an earlier batch-against-batch comparison showed a 3.6 s win that interleaving revealed as drift.
- Prefer draw counts, script time and pixel parity over frame rates when other processes share the machine.
- To learn what each change carries, take one change back out of the full set at a time. With the flat uniforms held back, the same 173 program switches still cost 80 ms per frame against 42 to 47 with them in.

## Prove the picture did not change

- Capture still frames under reduced motion with seeded randomness, in the order base, change, change, base. The base pair is the control: anything it varies by is noise.
- A change meant only to save cost changes 0 pixels. When it cannot (here, grouping draws by shader resolved 39 exact depth ties differently), ring the changed pixels, show them, and keep a switch that restores the old behaviour (`?draw-order=material`).
- Hold back any change that reorders asynchronous loading from the comparison, or an unrelated race shows up as a difference.

## Changes that paid off here

- Store any array-of-vectors uniform as a flat `Float32Array`.
- Group opaque draws by shader program, ranked by the earliest material that uses each program so the old relative order holds.
- Cache static shadow casters in their own map and copy it each frame; draw only moving casters over the copy. Detect movement from matrices, geometry and materials instead of declaring it, and give any caster animated only in its vertex shader its own depth material.
- Share one decoder worker pool across every model loader on the page, and let it forget a failed download or worker.
- Cap the drawing buffer by pixels, not by pixel ratio, and step large buffers down only while frames wait on the GPU, with hysteresis.

## Before you ship

- Time a new shader's cold compile as well as its frame cost; ANGLE's Direct3D compiler unrolls constant-bound loops and inlines every call.
- Compile programs on the driver's worker threads before the first draw, and throttle how many compile at once so the page's own thread is not starved.
- Record the machine, the browser, the load on the host and the commit with every number.

## Commands in this repository

```bash
node bin/measure_coastal_views.cjs
node bin/compare_coastal_stills.cjs
node bin/profile_coastal_startup.cjs
node --test test/coastal-shadow-cache.test.mjs test/coastal-resolution.test.mjs test/coastal-model-loader.test.mjs
```

Run them from PowerShell against a no-watch preview (`bundle exec jekyll serve --port 4136 --baseurl /al-folio --no-watch`), with `COASTAL_VIEWS_URL` and `COASTAL_STILLS_URL` pointing at it.

## Credit

The cached shadow follows Kevin Myers's two-stage cache for Call of Duty: Black Ops Cold War (GDC 2021); the adaptive pixel budget follows Doug Binks's dynamic resolution rendering (Intel, GDC 2011) and the hysteresis of drei's PerformanceMonitor. Borrow methods and cite them.
