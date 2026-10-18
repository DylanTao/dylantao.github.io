---
layout: page
title: Light Paths in the Onsen
description: "Sunlight through the onsen's light well, rendered twice in your browser: path tracing against Metropolis light transport, with the same minute each."
img: assets/img/project_pics/light-paths/teaser.png
image_aspect: 4 / 3
importance: -32
category: fun
year: 2026
role: Designer and renderer
status: Site experiment
site_experiment: true
# A child of the Graphics Lab: it keeps its page but leaves the projects index to the lab.
parent: graphics-lab
debut_date: 2026-10-14T21:00:00-07:00
hide_title: true
light_lab: true
---

<section class="project-case-hero site-experiment-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker"><a href="{{ '/projects/graphics-lab/' | relative_url }}">Graphics Lab</a> · Light transport</p>
    <h1>Light Paths in the Onsen</h1>
    <p class="project-case-lede">
      Around midday in the 3D home, a light well drilled from the clifftop throws a beam of sun into the onsen, and the ripples bend it onto the pool floor. Here two renderers draw that light in your browser with the same minute each: path tracing and Metropolis light transport.
    </p>
    <div class="project-case-actions">
      <a href="#light-lab">Run the race</a>
      <a href="{{ '/assets/downloads/site-experiments/light-paths-reproduction.md' | relative_url }}" download>Download the reproduction guide</a>
    </div>
  </div>
</section>

<section class="project-case-summary" aria-label="Light Paths summary">
  <div>
    <span>Why</span>
    <p>Sunlight on the pool floor is the hardest light in the house to render. It arrives only by bending through rippled water, so a renderer cannot aim at it.</p>
  </div>
  <div>
    <span>What</span>
    <p>A small renderer in plain JavaScript draws the same scene with path tracing and with Kelemen's Metropolis light transport, next to a reference that took 24 minutes on 18 threads.</p>
  </div>
  <div>
    <span>How</span>
    <p>Both methods share one path sampler. Only the source of its random numbers differs, so the chart compares two ways of spending the same time.</p>
  </div>
</section>

<section class="light-lab" id="light-lab" data-light-lab aria-labelledby="light-lab-title">
  <h2 id="light-lab-title">Race the two renderers</h2>
  <p>Press Run. Each renderer gets its own thread, and the race pauses after a minute. It also pauses when you scroll away or switch tabs. Until then, the panels show still frames from the same renderer after a minute on my laptop.</p>
  <div class="light-lab-panels">
    <figure class="light-lab-panel">
      <div class="light-lab-frame">
        <img src="{{ '/assets/img/project_pics/light-paths/pt-60s.png' | relative_url }}" alt="Path tracing after one minute: a dark grotto scattered with isolated white specks, and a loose cluster of dots where sunlight should gather on the pool floor" width="240" height="180" loading="lazy">
        <canvas data-light-lab-canvas="pt" width="240" height="180" aria-hidden="true"></canvas>
      </div>
      <figcaption><strong>Path tracing</strong><span data-light-lab-stats="pt">Still frame after one minute · error 626%</span></figcaption>
    </figure>
    <figure class="light-lab-panel">
      <div class="light-lab-frame">
        <img src="{{ '/assets/img/project_pics/light-paths/mlt-60s.png' | relative_url }}" alt="Metropolis light transport after one minute: a bright patch of sunlight on the pool floor, a glowing teal pool, and grainy, blotchy walls" width="240" height="180" loading="lazy">
        <canvas data-light-lab-canvas="mlt" width="240" height="180" aria-hidden="true"></canvas>
        <svg class="light-lab-path" data-light-lab-path-layer viewBox="0 0 240 180" preserveAspectRatio="none" aria-hidden="true"></svg>
      </div>
      <figcaption><strong>Metropolis light transport</strong><span data-light-lab-stats="mlt">Still frame after one minute · error 158%</span></figcaption>
    </figure>
    <figure class="light-lab-panel light-lab-panel--reference">
      <div class="light-lab-frame">
        <img src="{{ '/assets/img/project_pics/light-paths/reference.png' | relative_url }}" alt="Reference render: a dim grotto, a faint patch of reflected sunlight on the back wall, and a teal pool with a bright patch of refracted sunlight on its floor" width="240" height="180" loading="lazy">
      </div>
      <figcaption><strong>Reference</strong><span>24 minutes on 18 threads</span></figcaption>
    </figure>
  </div>
  <div class="light-lab-tools" data-light-lab-controls hidden>
    <div class="light-lab-controls" role="group" aria-label="Race controls">
      <button type="button" class="light-lab-run" data-light-lab-run aria-pressed="false">Run the race</button>
      <button type="button" data-light-lab-restart disabled>Start over</button>
      <label
        >Sun
        <select data-light-lab-sun>
          <option value="0.27">Real size, 0.27° radius</option>
          <option value="0.8" selected>Enlarged, 0.8° radius</option>
          <option value="2">2° radius</option>
          <option value="4">4° radius</option>
        </select>
      </label>
      <label
        >Metropolis brightness
        <select data-light-lab-normalization>
          <option value="bootstrap" selected>Independent samples (Kelemen)</option>
          <option value="ratio">Sky ratio (my addition)</option>
        </select>
      </label>
      <label><input type="checkbox" data-light-lab-path> Show one chain's path</label>
    </div>
    <figure class="light-lab-chart-figure">
      <svg class="light-lab-chart" data-light-lab-chart viewBox="0 0 600 220" role="img" aria-label="Each renderer's error against the reference over time, on a log scale"></svg>
      <figcaption>
        <span class="light-lab-key light-lab-key--pt">Path tracing</span><span class="light-lab-key light-lab-key--mlt">Metropolis</span><span>Solid lines are your run; dashed lines are a run recorded on my laptop. Path tracing starts low only because its first image is almost black.</span>
      </figcaption>
    </figure>
  </div>
  <p class="light-lab-status" data-light-lab-status aria-live="polite"></p>
</section>

## Why this light is hard

A renderer estimates each pixel by following paths of light backward from the camera. Most light in this room is easy to find. A path lands on a wall, and the renderer checks whether the sun or the sky is visible from that point with a straight shadow ray.

The light on the pool floor is different. A point on the floor sees the sun only through the water, and the water bends every ray that crosses it. A straight shadow ray toward the sun hits the surface and turns, so it cannot be aimed. The only way to reach the sun from the floor is to pick a random direction, bend it through the ripples, and hope it lands inside the sun's disc. In this scene about one random path in a million does, and each one carries about a thousand times the brightness of an average pixel.

Path tracing averages those rare, huge values with everything else. They show up as isolated white specks, called fireflies, and they fade only with the square root of the time spent.

## Two ways to spend a minute

**Path tracing** draws every path independently. It is simple and unbiased, and a path that finds nothing costs as much as one that finds the sun.

**Metropolis light transport** ([Veach and Guibas, 1997](https://graphics.stanford.edu/papers/metro/)) treats the image as a distribution over paths and explores it with a Markov chain. Once a chain finds a bright path, it proposes small changes to it, and a path through the same ripple tends to be bright too. Each proposal is accepted with probability min(1, new brightness / old brightness), the Metropolis–Hastings rule, so a chain spends time on each path in proportion to its brightness. Every proposal still adds to the image, weighted by its chance of acceptance, so rejected work is not wasted.

I used the version by [Kelemen and colleagues (2002)](https://doi.org/10.1111/1467-8659.t01-1-00703), which changes the random numbers a path tracer would read instead of the path itself. That keeps the comparison fair: one function turns numbers into a path in both renderers. Path tracing feeds it fresh numbers. Metropolis feeds it small changes to the numbers behind the last accepted path, and a completely fresh set on 30% of its steps, so a chain does not stay in one place.

## What the first five seconds show

<div class="light-lab-stills">
  <figure class="light-lab-panel">
    <div class="light-lab-frame">
      <img src="{{ '/assets/img/project_pics/light-paths/pt-05s.png' | relative_url }}" alt="Path tracing after five seconds: fine white specks across the walls and the pool, and no visible sunlight" width="240" height="180" loading="lazy">
    </div>
    <figcaption><strong>Path tracing, 5 seconds</strong><span>Error 2,783%</span></figcaption>
  </figure>
  <figure class="light-lab-panel">
    <div class="light-lab-frame">
      <img src="{{ '/assets/img/project_pics/light-paths/mlt-05s.png' | relative_url }}" alt="Metropolis after five seconds: the sunlit patch on the pool floor is already visible, with orange blotches on the walls where chains linger" width="240" height="180" loading="lazy">
    </div>
    <figcaption><strong>Metropolis, 5 seconds</strong><span>Error 295%</span></figcaption>
  </figure>
</div>

After five seconds, path tracing has not found the sunlit patch on the pool floor; the bright specks are single paths that happened to reach the sun. Metropolis already shows the patch, because a chain that finds it stays nearby. The orange blotches on its walls are chains lingering on rare paths that reflect off the water.

Error here is the root-mean-square difference in brightness from the reference on an 80 × 60 grid, divided by the reference's average. Above 100%, the typical error is larger than the average brightness itself. In the browser run behind the dashed lines, path tracing fell from 3,097% at five seconds to 984% at a minute, and Metropolis from 288% to 180%. Across three seeds, Metropolis finished the minute 4 to 15 times closer to the reference.

<figure class="light-lab-longer">
  {% include figure.liquid path="assets/img/project_pics/light-paths/teaser.png" alt="The onsen rendered twice and split down the middle: scattered path-traced specks on the left, and on the right a network of refracted sunlight on the pool floor from Metropolis" class="img-fluid" zoomable=true %}
  <figcaption>Given eleven minutes each at 800 × 600, about the same time per pixel as a minute in the lab: path tracing on the left, Metropolis on the right. On the same 80 × 60 grid, their errors were 212% and 23%.</figcaption>
</figure>

## Where Metropolis struggles

**It knows where the light is, but not how much.** A chain visits paths in proportion to their brightness, so it learns the image's shape but not its total. The total comes from independent samples, which face the same rare event that makes path tracing noisy. Here the first 100,000 samples usually contain no path to the sun, so Metropolis starts at about a quarter of the right brightness and jumps whenever a fresh sample finds the sun. I added an optional fix that takes the total from the skylight, which is easy to find, and from the share of time the chains spend in skylight. It removes most of that luck, but it is my addition, not part of Kelemen's method.

**It starts in the wrong place.** Chains start from those first samples, so they begin on skylit paths and need about 20,000 changes each to settle into sunlit ones. Early frames show blotches where a chain lingers, and they fade as the chains move on.

**It does more work per path.** Here Metropolis completes about half as many paths per second as path tracing, and its paths are correlated. Where light is easy to reach, that overhead buys nothing.

## How I checked it

Thirteen automated tests cover the parts that are easy to get subtly wrong: reflection and refraction at the water against Fresnel's equations and Snell's law, the ripple normals against finite differences, water hits within 10 nanometers of the surface, and a closed white box where the exact answer is known. The two renderers agree within 0.6% on skylight alone and within 6% on an enlarged 20° sun, and the same seed always gives the same image.

The reference needed its own care. For pixels where the camera first sees a dry surface, it traces 748 million particles forward from the light well. For pixels that see the water, it runs Metropolis restricted to those paths for 1.63 billion steps, then corrects slow drifts in brightness against plain path tracing. Its brightness in the pool is uncertain by a few percent; the walls are much tighter.

## The scene, simplified

This is a simplified onsen: a box grotto, a round pool two meters across, and a round opening in the ceiling instead of the house's tilted shaft. The sun stands 62° high. Its disc is three times wider than the real sun, so a minute is enough to see the difference; pick the real size to watch both renderers struggle. The ripples are frozen, and there is no steam.

## What I would try next

Two methods are built for exactly this light. [Manifold exploration](https://www.cs.cornell.edu/projects/manifolds-sg12/) (Jakob and Marschner, 2012) moves a chain along the paths that stay connected through the water, instead of hoping a random change does. [Specular manifold sampling](https://rgl.epfl.ch/publications/Zeltner2020Specular) (Zeltner, Georgiev and Jakob, 2020) solves for the path through the water directly, so even a path tracer can aim at the sun through ripples.

## Sources and credits

- Eric Veach and Leonidas J. Guibas, [Metropolis Light Transport](https://graphics.stanford.edu/papers/metro/), SIGGRAPH 1997.
- Csaba Kelemen, László Szirmay-Kalos, György Antal and Ferenc Csonka, [A Simple and Robust Mutation Strategy for the Metropolis Light Transport Algorithm](https://doi.org/10.1111/1467-8659.t01-1-00703), Computer Graphics Forum 21(3), 2002.
- Eric Veach, [Robust Monte Carlo Methods for Light Transport Simulation](https://graphics.stanford.edu/papers/veach_thesis/), PhD thesis, Stanford University, 1997: multiple importance sampling, which both renderers use for the sun and sky.
- Matt Pharr, Wenzel Jakob and Greg Humphreys, [Physically Based Rendering, 3rd edition, section 16.4](https://pbr-book.org/3ed-2018/Light_Transport_III_Bidirectional_Methods/Metropolis_Light_Transport): the bookkeeping for primary-sample Metropolis.
- Smaller pieces: Krzysztof Narkowicz's fit of the ACES tone curve, fdlibm's sine and cosine polynomials, Blackman and Vigna's xoshiro128\*\* generator, and the orthonormal basis of Duff and colleagues (JCGT, 2017).
- **Sirui Tao, with Anthropic's Claude:** scene, renderer, tests, reference, and this page.

<details class="resource-folder project-story-disclosure">
  <summary>Open the source folder</summary>
  <div class="resource-folder__papers">
    <a href="https://github.com/DylanTao/dylantao.github.io/tree/main/assets/js/light-lab">Browser renderer ↗</a>
    <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/bin/make_light_lab_reference.mjs">Reference renderer ↗</a>
    <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/test/light-lab.test.mjs">Tests ↗</a>
    <a href="{{ '/assets/js/light-lab/onsen-reference.json' | relative_url }}">Reference data ↓</a>
    <a href="{{ '/assets/downloads/site-experiments/light-paths-reproduction.md' | relative_url }}" download>Reproduction guide ↓</a>
  </div>
</details>
