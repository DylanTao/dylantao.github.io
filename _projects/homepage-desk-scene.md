---
layout: page
title: The Desk That Learned Depth
description: An evidence-backed record of how the homepage's shared-state 2D desk became a reciprocal 3D cliff-room scene.
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
      The homepage keeps one logical desk in two representations: a quick 2D collage and an explorable 3D cliff room. This record follows what successive design passes changed, what they broke, and which decisions survived responsive, interaction, and human review.
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
  <figure class="project-case-media site-experiment-evidence-figure">
    <img src="{{ '/output/home-desk-qa/desktop-3d-room-after-coast.png' | relative_url }}" alt="June 21 artifact and evidence checkpoint showing an early 3D desk room before the reciprocal cliff-room rebuild" width="1440" height="1000">
    <figcaption>June artifact/evidence checkpoint: the early room still read as a shallow stage.</figcaption>
  </figure>
</section>

<section class="project-case-summary" aria-label="Homepage desk experiment summary">
  <div><span>Question</span><p>Can the same portrait, papers, records, and discoveries survive a switch from quick collage to small explorable world?</p></div>
  <div><span>Method</span><p>Compare dated evidence under one narrow rubric, then record stronger state and renderer metadata only where it actually exists.</p></div>
  <div><span>Decision</span><p>Keep only changes that survive screenshots, accessibility checks, telemetry grounded in live geometry, and human review.</p></div>
</section>

## From a switch to one architectural world

The first 3D mode extended the existing paper-and-record desk without replacing the 2D view. Early screenshots made the failures useful: furniture disappeared at ordinary viewports, dropped cards floated, rear yaw fell into blank space, and the exterior looked like a separate dollhouse. Later passes stopped polishing two approximations and reused the actual room under reciprocal cameras.

## Two eras, four frames

These are repository evidence frames, not a controlled model benchmark. Across the two eras, the route, 1440 × 1000 viewport, light theme, stopped Yellow Submarine, zero discoveries, and capture sequence are held in common. Each pair came from one fresh browser context: 2D first, then 3D after changing only the representation. The June pair is a fresh replay of its exact source commit; the July pair is the accepted current checkpoint.

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
    <h3 id="desk-comparison-june-title">June 21 exact-commit replay</h3>
    <p class="project-story-provenance">Source <code>588e36509</code> · captured July 16</p>
    <p>Both frames come from one fresh replay with Yellow Submarine stopped and the discovery pile empty. The model label records provenance; it does not explain the outcome.</p>
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
    <h3 id="desk-comparison-july-title">July 16 accepted scene</h3>
    <p class="project-story-provenance">Runtime source <code>8fc9bf7d3</code> · accepted scene <code>1b07cea4c</code></p>
    <p>These two frames came from one fresh homepage context. Yellow Submarine remained queued, playback stayed stopped, and the discovery pile stayed empty while only the representation changed.</p>
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

The labels identify provenance, not cause. Prompt, retained context, task scope, implementation history, and human critique changed too. The visual record supports a design-history comparison; it does not isolate model performance. The playful “Codex 5.5 tried its best” sentence visible inside the old 3D frame belongs to that historical interface; this page does not treat it as benchmark evidence.

## What survived the re-review

<section class="project-case-summary desk-scene-outcomes" aria-label="Desk scene decisions after re-review">
  <div><span>Kept</span><p>The visible 2D | 3D choice, shared record and discovery state, paper-and-record identity, and deliberate window and return controls.</p></div>
  <div><span>Did not survive</span><p>The shallow stage, a separately hand-matched exterior miniature, floating-card recovery, and framing that hid furniture at ordinary viewports.</p></div>
  <div><span>Still open</span><p>Material realism, warmer low-contrast stone variation, and real-device confidence remain headroom. The accepted topology does not need another rewrite.</p></div>
</section>

<details class="project-story-disclosure site-experiment-technical-details">
  <summary id="desk-technical-summary">Technical provenance and checkpoint ledger</summary>
  <div class="project-story-disclosure-body" aria-labelledby="desk-technical-summary">
    <p>The interaction-state contract is shared. Renderer metadata remains intentionally asymmetric because only the July checkpoint recorded the higher-DPR buffer policy.</p>
    <ul>
      <li><strong>Common rubric:</strong> homepage route, 1440 × 1000 viewport, light theme, and default 2D or 3D view.</li>
      <li><strong>June replay:</strong> exact source <code>588e36509</code>, one fresh Chromium 145 context, Yellow Submarine stopped, zero discoveries, 2D then mode switch only, device-pixel ratio 1, no console or page errors.</li>
      <li><strong>July detail:</strong> runtime source <code>8fc9bf7d3</code> carried Yellow Submarine stopped, zero discoveries, a simulated device-pixel ratio of 3, and a WebGL buffer capped near 2×. The reciprocal architecture was accepted in <code>1b07cea4c</code>.</li>
      <li><strong>Interpretation:</strong> GPT-5.5/xhigh and GPT-5.6 Sol/ultra are provenance labels. They are not causal performance claims.</li>
    </ul>
    <ol class="site-experiment-ledger" aria-label="Homepage desk model iteration record">
      <li><time datetime="2026-06-17">Jun 17</time><code>c8ed8e5da</code><span>Added the visible 2D | 3D switch and the first Three.js desk room during the GPT-5.5/xhigh provenance period.</span></li>
      <li><time datetime="2026-06-21">Jun 21</time><code>588e36509</code><span>Created an artifact/evidence checkpoint with 2D, room, outside, zoom, and album-state captures. It records what existed; it is not a controlled model benchmark.</span></li>
      <li><time datetime="2026-07-12">Jul 12</time><code>840a3e1cb</code><span>During the GPT-5.6 Sol/ultra provenance period, rebuilt anchors, rear-orbit clearance, compact framing, raycasts, and grounded card recovery.</span></li>
      <li><time datetime="2026-07-13">Jul 13</time><code>a765c5291</code><span>Replaced the hand-matched exterior miniature with the actual room graph under reciprocal cameras.</span></li>
      <li><time datetime="2026-07-14">Jul 14</time><code>1b07cea4c</code><span>Accepted the organic room shell, high cliff aperture, welcome and window cues, and live-geometry/raycast evidence across the full matrix. Material realism remains open headroom; the topology does not need another rewrite.</span></li>
      <li><time datetime="2026-07-14">Jul 14</time><code>2ffd379af</code><span>Constrained window-hit bounds, canvas click suppression, and deterministic reset tests without claiming another visual-model advance.</span></li>
    </ol>
  </div>
</details>

<aside class="site-experiment-reproduce" aria-labelledby="desk-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="desk-reproduce-title">Start with state continuity, not geometry.</h2>
  <p>The public brief explains the shared-state contract, lightweight scene direction, recovery paths, and screenshot matrix without asking another site to copy this room.</p>
  <a href="{{ '/assets/downloads/site-experiments/homepage-desk-scene-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>

## Credit and provenance

The desk’s playful artifact language adapts an interaction lesson from [Jackie Hu’s portfolio](https://jackiehu.design/): small objects should reveal something real about the person. The room, assets, state model, and implementation are original to this site.
