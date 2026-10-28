---
layout: page
title: Making the 3D home fast
description: "Where each frame of the 3D coastal home went, the five changes that cut it, each measured on its own, and what I would try next."
img: assets/img/project_pics/graphics-performance/teaser.jpg
image_aspect: 1090 / 820
importance: -34
category: fun
year: 2026
# Sirui: confirm the role.
role: Designer and reviewer
status: Site experiment
site_experiment: true
# A child of the Graphics Lab: the lab's record keeps the performance system, and this page tells its story.
parent: graphics-lab
debut_date: 2026-10-19T13:00:00-07:00
hide_title: true
og_image_alt: The 3D coastal home from outside in the early afternoon, the glass-fronted house in a sandstone cliff above the beach, the view whose frame I measured
og_image_width: 1090
og_image_height: 820
---

<section class="project-case-hero site-experiment-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker"><a href="{{ '/projects/graphics-lab/' | relative_url }}">Graphics Lab</a> · Performance</p>
    <h1>Making the 3D home fast</h1>
    <p class="project-case-lede">
      Seen from outside, the 3D coastal home on my homepage ran at about ten frames a second on my laptop. I measured where each frame went, cut what it actually spent, and checked that the picture stayed the same. This page shows what was slow, what each change saved, what I tried and dropped, and what I would do next.
    </p>
    <div class="project-case-actions">
      <a href="{{ '/projects/graphics-lab/record/' | relative_url }}#performance">Read the performance record</a>
      <a href="{{ '/assets/downloads/site-experiments/graphics-performance-reproduction.md' | relative_url }}" download>Download the measuring brief</a>
    </div>
  </div>
</section>

<section class="project-case-summary" aria-label="Making the 3D home fast summary">
  <div>
    <span>Why</span>
    <p>Outside, each frame spent about 90 ms of script just handing draws to the GPU, and full screen asked for an 8.3-megapixel buffer.</p>
  </div>
  <div>
    <span>What</span>
    <p>Five changes, each measured against the same code without it. Outside, script per frame fell from 89.8 to 56.9 ms.</p>
  </div>
  <div>
    <span>How</span>
    <p>Every draw counted by render pass, runs that alternate before and after, and still frames compared pixel by pixel.</p>
  </div>
</section>

## Where the frame went

Before cutting anything, I counted. A script opens the home in a fresh headless browser, fixes its clock at 1:20 on a Friday afternoon, and samples three views for six seconds each: the occupied study, the authored view from outside, and the coast from 160 m. It assigns every WebGL draw to a render pass by the size of the image it draws into, and times the script inside each frame.

Outside, one frame made 1,554 draws. About 800 drew the view itself and a full copy of it: the onsen's water and the coffee hopper's glass refract, so three.js first redraws every opaque object into a second full-size image. About 400 went to the sea's mirror, and 353 to the sun's shadow map. Every mesh here owns its material, so nearly every draw switched shaders and uploaded its uniforms again.

A CPU profile then found the largest single cost where the draw counts did not point. Thirteen uniforms were arrays of vectors, for the light installations and the traced light field, and three.js flattened each of them again on every material switch: about 100,000 calls per outside frame, with 19.9% of the main thread in `Vector3.toArray` and 7.9% in three's `flatten`.

## Five changes, each measured

This section records the October 18–19 laptop experiments. Each change ran against the same code without it, base and change alternating, so a busy laptop slowed both sides alike. Taking one change back out at a time shows what each one carries. The later PC quality settings are described below.

<figure class="performance-chart" aria-labelledby="performance-chart-title">
  <p class="performance-chart-title" id="performance-chart-title">Script per frame from outside, in milliseconds (two runs each)</p>
  <ol class="performance-chart-rows">
    <li style="--low: 76; --high: 82">
      <span class="performance-chart-label">Before the changes</span>
      <span class="performance-chart-track" aria-hidden="true"><span class="performance-chart-bar"></span></span>
      <span class="performance-chart-value">76–82</span>
    </li>
    <li class="is-result" style="--low: 42; --high: 47">
      <span class="performance-chart-label">All five changes</span>
      <span class="performance-chart-track" aria-hidden="true"><span class="performance-chart-bar"></span></span>
      <span class="performance-chart-value">42–47</span>
    </li>
    <li style="--low: 80; --high: 80">
      <span class="performance-chart-label">All but the flat uniform arrays</span>
      <span class="performance-chart-track" aria-hidden="true"><span class="performance-chart-bar"></span></span>
      <span class="performance-chart-value">80</span>
    </li>
    <li style="--low: 59; --high: 59">
      <span class="performance-chart-label">All but the draw grouping</span>
      <span class="performance-chart-track" aria-hidden="true"><span class="performance-chart-bar"></span></span>
      <span class="performance-chart-value">59</span>
    </li>
    <li style="--low: 45; --high: 50">
      <span class="performance-chart-label">All but the cached shadow</span>
      <span class="performance-chart-track" aria-hidden="true"><span class="performance-chart-bar"></span></span>
      <span class="performance-chart-value">45–50</span>
    </li>
  </ol>
  <figcaption>Without the flat arrays, the frame is back where it started: every material switch flattened them again. With them in, the draw grouping and the cached shadow add their savings on top. The other two changes act elsewhere, the decoder pool while the house loads and the pixel budget in full screen.</figcaption>
</figure>

<div class="performance-table-wrap" role="region" aria-labelledby="performance-changes-caption" tabindex="0">
  <table class="performance-table performance-table--changes">
    <caption id="performance-changes-caption">What each change does, and what it saved</caption>
    <thead>
      <tr>
        <th scope="col">Change</th>
        <th scope="col">What it does</th>
        <th scope="col">What it saved</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">Flat uniform arrays</th>
        <td>Stores the thirteen vector arrays as flat typed arrays (<code>Float32Array</code>), so three.js passes them through untouched. The GPU gets the same float32 values.</td>
        <td>The largest single cost of an outside frame: held back, script stays at 80 ms.</td>
      </tr>
      <tr>
        <th scope="row">Draws grouped by shader</th>
        <td>Opaque draws that share a shader program run together, ranked so the sea still draws before the beach.</td>
        <td>Shader switches per outside frame, 579 to 173; script outside, 59 to 44 ms.</td>
      </tr>
      <tr>
        <th scope="row">A cached sun shadow</th>
        <td>Casters that never move go into the 2,048-pixel shadow map once. Each frame copies that map and draws only the moving casters over it.</td>
        <td>Shadow-map draws per frame, 353 to 91 outside and 268 to 38 in the study.</td>
      </tr>
      <tr>
        <th scope="row">One decoder pool</th>
        <td>Every model on the page decodes through one shared pool of up to four Draco workers.</td>
        <td>The house shell decodes in 118 ms instead of 323, the avatar in 130 instead of 315.</td>
      </tr>
      <tr>
        <th scope="row">A pixel budget</th>
        <td>Caps the drawing buffer at 2.1 megapixels; a large buffer steps down only while frames wait on the GPU.</td>
        <td>Full screen at 2560 × 1440 and a pixel ratio of 1.5: 4.4 to 11.9 frames a second in the study, 2.7 to 6.1 outside.</td>
      </tr>
    </tbody>
  </table>
</div>

All five together, in three alternating pairs:

<div class="performance-table-wrap" role="region" aria-labelledby="performance-views-caption" tabindex="0">
  <table class="performance-table performance-table--views">
    <caption id="performance-views-caption">Each view before and after, per frame (median of the runs' medians)</caption>
    <thead>
      <tr>
        <th scope="col">View</th>
        <th scope="col">Script</th>
        <th scope="col">Draws</th>
        <th scope="col">Shadow-map draws</th>
        <th scope="col">Shader switches</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">The occupied study</th>
        <td>20.2 → 15.3 ms</td>
        <td>541 → 311</td>
        <td>268 → 38</td>
        <td>96 → 52</td>
      </tr>
      <tr>
        <th scope="row">Outside, from 48 m</th>
        <td>89.8 → 56.9 ms</td>
        <td>1,554 → 1,292</td>
        <td>353 → 91</td>
        <td>579 → 173</td>
      </tr>
      <tr>
        <th scope="row">The coast from 160 m</th>
        <td>86.9 → 50.7 ms</td>
        <td>1,694 → 1,371</td>
        <td>404 → 91</td>
        <td>605 → 176</td>
      </tr>
    </tbody>
  </table>
</div>

Two more pairs on a later scene, after the oak-and-marble kitchen, gave the same picture: outside 69.3 to 48.8 ms, the coast 101.8 to 49.1 ms.

## The picture stayed the same

A change meant only to save time should not change a pixel. A second script captures still frames, with motion reduced and randomness seeded, in the order base, change, change, base, so the two base frames show how much the capture itself varies. With every change but the draw grouping, the study and the outside view stayed identical in all 251,790 pixels. At 160 m, 1,261 pixels moved by at most 2 levels of 255, within the base pair's own noise of up to 1,532.

The draw grouping does change 39 pixels outside, by up to 40 levels, and a handful elsewhere (6 in the study, 4 at 160 m). Where two surfaces with different shaders sit at exactly the same depth, the new order draws the other one on top. They sit on the clifftop planting and the edges of the glass front. Adding `?draw-order=material` to the page's address brings back three.js's own order if any of them matters.

<div class="performance-evidence">
  <figure>
    <img src="{{ '/assets/img/project_pics/graphics-performance/draw-order-outside-after.png' | relative_url }}" alt="The authored view from outside with every change in place: the house in its sandstone cliff, the beach and the sea" width="545" height="462" loading="lazy">
    <figcaption>The authored view from outside, with every change in place.</figcaption>
  </figure>
  <figure>
    <img src="{{ '/assets/img/project_pics/graphics-performance/draw-order-outside-diff.png' | relative_url }}" alt="The same frame in gray with small red rings on the clifftop planting and the edges of the glass front, marking the 39 pixels the draw grouping changed" width="545" height="462" loading="lazy">
    <figcaption>The same frame in gray, with the 39 changed pixels ringed in red.</figcaption>
  </figure>
</div>

The cached shadow map matched a full redraw to the texel in 7 of 8 checks. In the eighth, 1 of 4,194,304 texels differed, an exact tie between a caster that stands still and one that moves.

## Opening without freezing the page

The slow frame was the second problem. The first was opening the house at all. Three.js compiles a shader the first time it draws a material, and that draw waits for the driver. The first view needed 22 programs, and on a desktop with an RTX 3080 Ti, opening 3D froze the page for 13.5 seconds. Since October 12, every program the first view needs is created ahead of time and compiled on the driver's worker threads, so the page keeps scrolling while the house compiles: the longest frame during startup fell to 0.2 s.

Even then, the page stuttered in steps of up to 0.7 s on my laptop. The code was not slow. The graphics process was running up to 21 shader compiles at once on 22 cores, and the page's own thread waited for a turn. Starting a new batch only while no more than half the cores are compiling cut the longest task from 658 to 209 ms and the time lost to long tasks from 2.45 to 0.78 s. The view now takes about half a second longer to be ready, 5.17 s instead of 4.66.

The coastal footer and its miniature now compile the same way before their first frame. At sunset the footer draws its first frame in 2.3 s instead of 2.7, and its longest task is 0.74 s instead of 1.33.

## The 2D pages too

In Lighthouse's desktop test on October 18 (median of three runs), the homepage scored 61, with 903 ms of total blocking time. Of that, 826 ms was the Research Focus field, a WebGL sketch about 1.7 screens down, which mounted at load whether anyone scrolled to it or not. It now waits until the reader is within 600 px of it, and then for an idle moment.

On the DesignWeaver page, the whole article shifted once when Inter replaced the fallback font, a layout shift of 0.167. An "Inter Fallback" face now scales Arial to Inter's measured widths and heights (size 107.32%, ascent 90.26%, descent 22.48%), which brought that shift to 0.014 and the homepage's phone layout from 0.049 to 0.033. [Web Vitals](https://web.dev/articles/vitals) counts a shift under 0.1 as good.

The portrait is the homepage's largest paint (1.85 s), so it now loads with `fetchpriority="high"`, as [web.dev's guide](https://web.dev/articles/fetch-priority) recommends for the image a page leads with.

## Tried and set aside

- **A gate for three.js's refraction copy.** It asked the GPU whether the onsen water or the hopper glass could be seen and skipped the copy when neither could. It was correct but never engaged: the padded test boxes always showed through the cedar slats, over the pool rim or through the glass, so all 13 queries in a 12-angle sweep said visible. I removed it.
- **Hiding the onsen water from the coast.** In a sweep of 108 coast cameras the water showed from 21, at 3 to 143 pixels, so it could not simply go.
- **A sea mirror without the interiors.** 13 of 108 coast stills changed, by a median of 126 pixels. That is a look change, so it waits for my call.
- **Fewer pixels on the ordinary canvas.** Outside frames are bound by handing draws to the GPU, not by pixels, so a lower resolution only blurred them.
- **Merging static meshes.** Only 12 of the 390 drawn meshes are static, opaque and share a material, which would save 3 draws. Everything else can be clicked, moves, sways in the wind or is skinned.
- **Temporal antialiasing.** Every character, animal, plant and wave moves, and without motion vectors for each object it would trade a little shimmer for ghosting. 4× multisampling already holds the edges; 8× looked the same and cost about 3 ms of GPU time.

## What changed on the PC

The October 26–28 follow-up puts visual quality back into the full-screen budget. The high tier allows up to 8.3 megapixels at a density of 2; the moving desktop view has a 0.8 resolution floor, and a still restores its full profile within the pixel and memory budget. The phone has its own smaller profile. These are fidelity settings, not a claim that the outside view reaches 60 frames a second.

Production ES modules are now minified with identifier and whitespace changes, without compression rewrites. The source-bound [delivery receipt](https://github.com/DylanTao/dylantao.github.io/blob/main/artwork/coastal-home/reviews/module-delivery-2026-10-26/delivery-size.json) records the byte comparison. Smaller downloads do not, on their own, prove faster shader compilation. The [PC performance review](https://github.com/DylanTao/dylantao.github.io/blob/main/artwork/coastal-home/reviews/startup-and-frame-2026-10-26/README.md) keeps the measured starts, flicker recordings and rejected attempts separate. Sirui's physical iPhone baseline took 16.673 seconds to become ready, with 35/44 ms frame p50/p95; a comparable finished-build device visit is still needed.

## The WebGPU decision

Rechecked October 28: the home still uses the pinned three.js r164 WebGL renderer. Current three.js documentation describes [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html) as an alternative that selects WebGPU when available and otherwise falls back to WebGL 2. The older description here calling it experimental was not a sound reason to postpone a comparison.

There is a concrete porting boundary. The home uses GLSL materials and shader patches; the current [ShaderMaterial documentation](https://threejs.org/docs/pages/ShaderMaterial.html) restricts that material to WebGLRenderer, and the [Material documentation](https://threejs.org/docs/pages/Material.html#onBeforeCompile) restricts `onBeforeCompile` to it too, recommending node materials and TSL for the newer renderer. Preserving the lighting, water, moving skins and output therefore needs a tested material/pass port before a renderer comparison is meaningful.

The reports in [three.js issue 30560](https://github.com/mrdoob/three.js/issues/30560) concern other scenes and releases. They do not predict this home's speed. A switch needs matched pictures and paired measurements of the complete home on WebGPU, its WebGL 2 fallback and a real phone. No WebGPU speedup has been demonstrated here.

## What I would try next

The list below preserves the October 19 hypotheses and estimates, not measured wins. Module minification has since shipped. The PC follow-up rejected several material-sharing, shader-loop and mirror-update attempts when they changed the picture or failed to save time; their retained evidence takes precedence over an older estimate. The [technical record]({{ '/projects/graphics-lab/record/' | relative_url }}#problem-next-performance) keeps the original reasoning.

1. **Share identical materials between meshes**, so grouped draws skip three.js's material refresh: a further 20 to 40% of outside script time, in half a day. It touches the renovation's materials, so it needs my decision.
2. **Stand in for distant refraction.** A non-refracting material for the hopper glass and the onsen water seen from outside removes three's opaque copy, about a quarter of the frame's draws, in hours. A look change of a few dozen pixels.
3. **A lighter sea mirror**, without the interiors or redrawn every other frame while the camera rests: up to half of its 400 draws, in hours.
4. **Batch the static scenery** with three's `BatchedMesh` and multi-draw: the hinterland's 156 static pieces and the planting's 23, for 100 to 150 fewer draws per pass outside, in a day.
5. **Meshopt instead of Draco.** It decoded 3.4 to 7.5 times faster here, about 0.3 to 0.5 s less on a first visit, for about 0.9 MB more; half a day.
6. **Minify the ES modules**: the 3D modules from 330 to 201 KB gzipped, and the site's other 31 from 110 to 72 KB, in hours.
7. **A content-hashed Service Worker cache**, because GitHub Pages sends about 10 MB of unchanged models again after each deploy; a day.
8. **Occlusion culling from the coast.** The rooms behind the cliff still draw about 130 meshes per pass; two to three days, and pop-in while moving needs a decision.
9. **Level of detail for distant planting**, then impostors: a large cut in triangles at a distance, in one to two days, and three to five for impostors.
10. **Faster shader compiles at startup.** About 70 programs take 12 to 19 s to the first frame on my laptop; measure each one before choosing what to cut.
11. **Temporal antialiasing** in place of the multisampled buffers, only with correct motion vectors, most easily under WebGPU.
12. **A 60 fps cap** on high-refresh screens while nobody is dragging: an hour, and a smoothness decision.

<details class="project-story-disclosure">
  <summary>How the numbers were measured</summary>
  <div class="project-story-disclosure-body">
    <ul>
      <li><strong>Machine.</strong> One shared Windows laptop, an Intel Core Ultra 7 155H with 22 logical cores and Arc integrated graphics, running headless Chromium on ANGLE and Direct3D 11 in a 1440 × 1000 window at a device pixel ratio of 1, which gives the scene a 545 × 461 canvas. Other processes used about half the CPU, so draw counts, script time and pixel parity carry the results; frame rates only illustrate them. The 13.5-second freeze was measured on a desktop with an RTX 3080 Ti.</li>
      <li><strong>Frames.</strong> <code>bin/measure_coastal_views.cjs</code> runs each variant in a fresh browser with seeded randomness and the routine's clock at Friday 13:20, samples each view for 6 s and reports the median of the runs' medians with their range. Three alternating pairs ran on main <code>94755609f</code>, and two more on <code>049dba240</code>.</li>
      <li><strong>Stills.</strong> <code>bin/compare_coastal_stills.cjs</code> captures reduced-motion stills base, change, change, base. The decoder pool was held out of that comparison, because changing the load order exposes an older race in how the wildlife pose under reduced motion.</li>
      <li><strong>Decoding.</strong> Eight alternating rounds in one page with warmed decoders, median per model.</li>
      <li><strong>Pages.</strong> Lighthouse 12.8.2 on the live site, desktop preset, median of three runs.</li>
      <li><strong>Comparison flags.</strong> <code>?shadow-cache=0</code>, <code>?draw-order=material</code> and <code>?resolution=fixed</code> turn each change off for comparison.</li>
      <!-- Sirui: confirm -->
      <li><strong>Credit.</strong> Sirui Tao, with AI coding agents: the measurements, the changes and their tests. Anthropic's Claude compiled this page from the Graphics Lab's record and the performance notes for Sirui to review.</li>
    </ul>
  </div>
</details>

## Sources and credits

- Kevin Myers, [Shadows of Cold War: A Scalable Approach to Shadowing](https://research.activision.com/publications/2021/10/shadows-of-cold-war--a-scalable-approach-to-shadowing), GDC 2021: the two-stage shadow cache, the same split as [Unity HDRP's cached shadows](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@14.0/manual/Shadows-in-HDRP.html) and [Unreal Engine's virtual shadow map cache](https://dev.epicgames.com/documentation/en-us/unreal-engine/virtual-shadow-maps-in-unreal-engine).
- Doug Binks, [Dynamic Resolution Rendering](https://www.intel.com/content/dam/develop/external/us/en/documents/dynamicresolutionrendering-183334.pdf), Intel, GDC 2011, and the hysteresis of drei's [PerformanceMonitor](https://drei.docs.pmnd.rs/performances/performance-monitor): the pixel budget's adaptive step.
- Khronos, [KHR_parallel_shader_compile](https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/): compiling on the driver's threads. Brendan Gregg's off-CPU analysis in _Systems Performance_ (2nd edition, 2020) explained the stutter: a starved thread, not slow code.
- Three.js's [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html), [ShaderMaterial](https://threejs.org/docs/pages/ShaderMaterial.html), [Material](https://threejs.org/docs/pages/Material.html#onBeforeCompile) and [issue 30560](https://github.com/mrdoob/three.js/issues/30560): the WebGPU porting boundary and limits of outside benchmarks.
- Philip Walton, [Web Vitals](https://web.dev/articles/vitals), and Addy Osmani and colleagues, [Optimize resource loading with the Fetch Priority API](https://web.dev/articles/fetch-priority), on web.dev.

<details class="resource-folder project-story-disclosure">
  <summary>Open the code folder</summary>
  <div class="resource-folder__papers">
    <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/bin/measure_coastal_views.cjs">Frame attribution ↗</a>
    <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/bin/compare_coastal_stills.cjs">Still parity ↗</a>
    <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/assets/js/home-scene/shadow-cache.mjs">Shadow cache ↗</a>
    <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/assets/js/home-scene/draw-order.mjs">Draw grouping ↗</a>
    <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/assets/js/home-scene/resolution.mjs">Pixel budget ↗</a>
    <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/assets/js/home-scene/model-loader.mjs">Decoder pool ↗</a>
    <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/docs/performance-notes.md">Performance notes ↗</a>
    <a href="{{ '/assets/downloads/site-experiments/graphics-performance-reproduction.md' | relative_url }}" download>Measuring brief ↓</a>
  </div>
</details>
