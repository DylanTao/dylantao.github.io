---
layout: page
title: The Desk That Learned Depth
description: How the homepage's paper collage became an explorable cliff room without losing the same desk, records, and discoveries.
img: assets/img/project_pics/site-experiments/homepage-desk-depth.png
image_aspect: 16 / 9
card_image_fit: cover
card_image_position: top center
card_avoid_scaling: true
importance: -29
category: fun
site_experiment: true
debut_date: 2026-06-17T20:55:49-07:00
year: 2026
role: Designer, reviewer, world builder
status: Living site experiment
hide_title: true
---

<section class="project-case-hero site-experiment-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">Site experiment · first seen June 17, 2026</p>
    <h1>The Desk That Learned Depth</h1>
    <p class="project-case-lede">
      The homepage desk is one set of objects in two views. The 2D collage gives you the portrait, papers, and records at a glance; the 3D cliff room lets you step inside them. Switching views keeps the same music and discoveries instead of starting over.
    </p>
    <div class="project-case-facts">
      <span>Shared 2D/3D state</span>
      <span>Reciprocal room</span>
      <span>Model provenance</span>
      <span>Screenshot QA</span>
    </div>
    <div class="project-case-actions">
      <a href="{{ '/' | relative_url }}">Try the homepage desk</a>
      <a href="{{ '/assets/downloads/site-experiments/homepage-desk-scene-reproduction.md' | relative_url }}" download>Download reproduction MD</a>
    </div>
  </div>
</section>

<section class="project-case-summary" aria-label="Homepage desk experiment summary">
  <div><span>Why</span><p>I wanted the paper desk to feel like a place without making the quick 2D homepage slower to read.</p></div>
  <div><span>What</span><p>Two views of the same room, with the same records, papers, music, and discoveries.</p></div>
  <div><span>Try</span><p>Switch views, play a record, find a hidden card, and check that it is still there when you switch back.</p></div>
</section>

## Why the desk has two views

I liked how quickly the 2D collage introduced the papers, portrait, and records, but I also wanted visitors to wander through that little world. The first 3D version copied the desk into a small stage. At ordinary screen sizes, furniture disappeared, dropped cards floated, rear turns exposed blank space, and the outside looked like a separate dollhouse.

The fix was not more decoration. I made inside and outside two camera views of the same room, then shared the record player and discoveries with the 2D desk.

## Two eras, four frames

The four frames hold everything I could keep constant: the same route, 1440 × 1000 viewport, light theme, Yellow Submarine stopped, and an empty discovery pile. Each pair starts in 2D and changes only the view. The June pair is an exact-commit replay; the July pair is the accepted checkpoint.

<div class="project-story-comparison desk-scene-evidence-pair" aria-label="Homepage desk evidence checkpoints">
<section
  class="project-story-comparison-group desk-scene-comparison-era"
  data-desk-comparison-era="june-exact-commit-replay"
  data-source-commit="588e365090e883323d836f5da023f7d40632f096"
  data-source-commit-date="2026-06-21"
  data-capture-date="2026-07-16"
  data-capture-viewport="1440x1000"
  data-capture-theme="light"
  data-capture-rubric="default-representation-view"
  data-capture-state="yellow-submarine-stopped-zero-discoveries"
  data-capture-sequence="2d-then-mode-switch-only"
  data-capture-device-pixel-ratio="1"
  data-capture-browser="Chromium 145.0.7632.6"
  data-model-provenance="GPT-5.5/xhigh"
  aria-labelledby="desk-comparison-june-title"
>
  <header class="project-story-comparison-header">
    <p class="project-case-kicker">GPT-5.5 / xhigh provenance</p>
    <h3 id="desk-comparison-june-title">June 21: the first room</h3>
    <p class="project-story-provenance">Source <code>588e36509</code> · captured July 16</p>
    <p>The collage already read well. The 3D view was a small stage sitting inside a black field.</p>
  </header>
  <div class="project-case-evidence-pair">
    <figure class="project-case-media site-experiment-evidence-figure" data-desk-evidence-mode="2d">
      <img src="{{ '/assets/img/project_pics/site-experiments/homepage-desk-588e36509-2d-2026-07-16.png' | relative_url }}" alt="Exact replay of commit 588e36509 in the light-theme 2D homepage view, with Sirui's portrait, research slips, and a coffee-stain desk cue" loading="lazy" width="1440" height="1000">
      <figcaption>2D — the collage already held a clear portrait, research thesis, slips, and desk cue.</figcaption>
    </figure>
    <figure class="project-case-media site-experiment-evidence-figure" data-desk-evidence-mode="3d">
      <img src="{{ '/assets/img/project_pics/site-experiments/homepage-desk-588e36509-3d-2026-07-16.png' | relative_url }}" alt="Exact replay of commit 588e36509 in the light-theme 3D homepage view, where a small desk-room stage occupies the right half while a black backdrop obscures much of the page" loading="lazy" width="1440" height="1000">
      <figcaption>3D — the room was still a small stage, and its black backdrop overwhelmed the page around it.</figcaption>
    </figure>
  </div>
</section>

<section
  class="project-story-comparison-group desk-scene-comparison-era"
  data-desk-comparison-era="july-current"
  data-capture-date="2026-07-16"
  data-capture-source="8fc9bf7d3"
  data-scene-checkpoint="1b07cea4c"
  data-capture-viewport="1440x1000"
  data-capture-theme="light"
  data-capture-rubric="default-representation-view"
  data-capture-state="yellow-submarine-stopped-zero-discoveries"
  data-capture-device-pixel-ratio="3"
  data-webgl-buffer-cap="near-2x"
  data-model-provenance="GPT-5.6 Sol/ultra"
  aria-labelledby="desk-comparison-july-title"
>
  <header class="project-story-comparison-header">
    <p class="project-case-kicker">GPT-5.6 Sol/ultra provenance</p>
    <h3 id="desk-comparison-july-title">July 16: one room, viewed from both sides</h3>
    <p class="project-story-provenance">Runtime source <code>8fc9bf7d3</code> · accepted scene <code>1b07cea4c</code></p>
    <p>The 2D state now carries into the same room viewed from inside or outside. Yellow Submarine remains queued and the discovery pile remains empty in both frames.</p>
  </header>
  <div class="project-case-evidence-pair">
    <figure class="project-case-media site-experiment-evidence-figure" data-desk-evidence-mode="2d">
      <img src="{{ '/assets/img/project_pics/site-experiments/homepage-desk-2d-2026-07-16.png' | relative_url }}" alt="July 16 homepage capture in the light-theme 2D desk representation with Sirui's portrait, paper research slips, Yellow Submarine queued and stopped, and no discovered record cards" loading="lazy" width="1440" height="1000">
      <figcaption>2D default view — Yellow Submarine stopped, with zero discoveries.</figcaption>
    </figure>
    <figure class="project-case-media site-experiment-evidence-figure" data-desk-evidence-mode="3d">
      <img src="{{ '/assets/img/project_pics/site-experiments/homepage-desk-3d-2026-07-16.png' | relative_url }}" alt="July 16 homepage capture in the light-theme 3D desk representation showing the reciprocal cliff room, onsen, lounge chair, record player, welcome note, and ocean window, with Yellow Submarine stopped and no discoveries" loading="lazy" width="1440" height="1000">
      <figcaption>3D default view — the same stopped record and empty discovery state inside the reciprocal room.</figcaption>
    </figure>
  </div>
</section>
</div>

The labels record the model context for each era; this is a comparison of design history rather than isolated model performance. The prompt, retained context, task, implementation history, and my critique all changed too. “Codex 5.5 tried its best” remains visible because it belonged to the June interface.

## What I kept, cut, and still want to improve

<section class="project-case-summary desk-scene-outcomes" aria-label="Desk scene decisions after re-review">
  <div><span>Kept</span><p>The visible 2D | 3D switch, shared music and discoveries, paper-and-record identity, and clear ways to look outside and return.</p></div>
  <div><span>Cut</span><p>The shallow stage, hand-matched exterior miniature, floating-card recovery, and camera framing that hid the furniture.</p></div>
  <div><span>Next</span><p>Keep the room shape, then test the stone, lighting, materials, and controls on more phones and high-DPI laptops.</p></div>
</section>

<details class="project-story-disclosure site-experiment-technical-details">
  <summary id="desk-technical-summary">Technical provenance and checkpoint ledger</summary>
  <div class="project-story-disclosure-body" aria-labelledby="desk-technical-summary">
    <p>The interaction-state contract is shared. Renderer metadata remains intentionally asymmetric because only the July checkpoint recorded the higher-DPR buffer policy.</p>
    <ul>
      <li><strong>Common rubric:</strong> homepage route, 1440 × 1000 viewport, light theme, and default 2D or 3D view.</li>
      <li><strong>June replay:</strong> exact source <code>588e36509</code>, one fresh Chromium 145 context, Yellow Submarine stopped, zero discoveries, 2D then mode switch only, device-pixel ratio 1, no console or page errors.</li>
      <li><strong>July detail:</strong> runtime source <code>8fc9bf7d3</code> carried Yellow Submarine stopped, zero discoveries, a simulated device-pixel ratio of 3, and a WebGL buffer capped near 2×. The reciprocal architecture was accepted in <code>1b07cea4c</code>.</li>
      <li><strong>Interpretation:</strong> GPT-5.5/xhigh and GPT-5.6 Sol/ultra record the model context for each era; the comparison evaluates the resulting design history.</li>
    </ul>
    <ol class="site-experiment-ledger" aria-label="Homepage desk model iteration record">
      <li><time datetime="2026-06-17">Jun 17</time><code>c8ed8e5da</code><span>Added the visible 2D | 3D switch and the first Three.js desk room during the GPT-5.5/xhigh provenance period.</span></li>
      <li><time datetime="2026-06-21">Jun 21</time><code>588e36509</code><span>Created an artifact/evidence checkpoint with 2D, room, outside, zoom, and album-state captures.</span></li>
      <li><time datetime="2026-07-12">Jul 12</time><code>840a3e1cb</code><span>During the GPT-5.6 Sol/ultra provenance period, rebuilt anchors, rear-orbit clearance, compact framing, raycasts, and grounded card recovery.</span></li>
      <li><time datetime="2026-07-13">Jul 13</time><code>a765c5291</code><span>Replaced the hand-matched exterior miniature with the actual room graph under reciprocal cameras.</span></li>
      <li><time datetime="2026-07-14">Jul 14</time><code>1b07cea4c</code><span>Accepted the organic room shell, high cliff aperture, welcome and window cues, and live-geometry/raycast evidence across the full matrix. Material realism remains open headroom.</span></li>
      <li><time datetime="2026-07-14">Jul 14</time><code>2ffd379af</code><span>Stabilized window-hit bounds, canvas click suppression, and deterministic reset tests after visual acceptance.</span></li>
    </ol>
  </div>
</details>

<aside class="site-experiment-reproduce" aria-labelledby="desk-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="desk-reproduce-title">Make the two views share a memory first.</h2>
  <p>The brief covers shared state, scene direction, recovery paths, and the screenshot matrix I used before spending time on more geometry.</p>
  <a href="{{ '/assets/downloads/site-experiments/homepage-desk-scene-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>

## Credit and provenance

The desk’s playful artifact language adapts an interaction lesson from [Jackie Hu’s portfolio](https://jackiehu.design/): small objects should reveal something real about the person. The room, assets, state model, and implementation are original to this site.
