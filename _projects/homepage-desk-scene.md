---
layout: page
title: The Desk That Learned Depth
description: A model-to-model record of how the homepage's shared-state 2D desk became a reciprocal 3D cliff-room scene.
img: output/home-desk-qa/desktop-3d-room-after-coast.png
image_aspect: 16 / 9
card_image_fit: cover
card_image_position: top center
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
      The homepage keeps one logical desk in two representations: a quick 2D collage and an explorable 3D cliff room. The long-running experiment records what each model pass improved, what it broke, and which changes survived the same responsive and interaction checks.
    </p>
    <div class="project-case-facts">
      <span>Shared 2D/3D state</span>
      <span>Reciprocal room</span>
      <span>Model re-review</span>
      <span>Screenshot QA</span>
    </div>
    <div class="project-case-actions">
      <a href="{{ '/' | relative_url }}">Try the homepage desk</a>
      <a href="{{ '/assets/downloads/site-experiments/homepage-desk-scene-reproduction.md' | relative_url }}" download>Download reproduction MD</a>
    </div>
  </div>
  <figure class="project-case-media site-experiment-evidence-figure">
    <img src="{{ '/output/home-desk-qa/desktop-3d-room-after-coast.png' | relative_url }}" alt="Historical June 2026 homepage capture showing an early 3D desk room before the reciprocal cliff-room rebuild">
    <figcaption>Historical checkpoint, not the current scene: the early room still read as a shallow stage.</figcaption>
  </figure>
</section>

<section class="project-case-summary" aria-label="Homepage desk experiment summary">
  <div><span>Question</span><p>Can the same portrait, papers, records, and discoveries survive a switch from quick collage to small explorable world?</p></div>
  <div><span>Method</span><p>Hold the brief, viewports, interaction states, and recovery paths steady while newer models critique the last best pass.</p></div>
  <div><span>Decision</span><p>Keep only changes that survive screenshots, accessibility checks, telemetry grounded in live geometry, and human review.</p></div>
</section>

## From a switch to one architectural world

The first 3D mode extended the existing paper-and-record desk without replacing the 2D view. Early screenshots made the failures useful: furniture disappeared at ordinary viewports, dropped cards floated, rear yaw fell into blank space, and the exterior looked like a separate dollhouse. Later passes stopped polishing two approximations and reused the actual room under reciprocal cameras.

<ol class="site-experiment-ledger" aria-label="Homepage desk model iteration record">
  <li><time datetime="2026-06-17">Jun 17</time><code>c8ed8e5da</code><span>Added the visible 2D | 3D switch and the first Three.js desk room during the GPT-5.5/xhigh period.</span></li>
  <li><time datetime="2026-06-21">Jun 21</time><code>588e36509</code><span>Checked in comparable 2D, room, outside, zoom, and album-state captures. They preserved evidence of the shallow room and separate miniature.</span></li>
  <li><time datetime="2026-07-12">Jul 12</time><code>840a3e1cb</code><span>Under GPT-5.6 Sol/ultra, rebuilt anchors, rear-orbit clearance, compact framing, raycasts, and grounded card recovery.</span></li>
  <li><time datetime="2026-07-13">Jul 13</time><code>a765c5291</code><span>Replaced the hand-matched exterior miniature with the actual room graph under reciprocal cameras.</span></li>
</ol>

The model label is context, not a causal performance claim. Prompt, retained context, task scope, implementation history, and human critique changed too. The fair comparison is the evidence contract: same routes, same viewports, same important states, and an honest record of both accepted and reverted work.

<aside class="site-experiment-reproduce" aria-labelledby="desk-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="desk-reproduce-title">Start with state continuity, not geometry.</h2>
  <p>The public brief explains the shared-state contract, lightweight scene direction, recovery paths, and screenshot matrix without asking another site to copy this room.</p>
  <a href="{{ '/assets/downloads/site-experiments/homepage-desk-scene-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>

## Credit and provenance

The desk’s playful artifact language adapts an interaction lesson from [Jackie Hu’s portfolio](https://jackiehu.design/): small objects should reveal something real about the person. The room, assets, state model, and implementation are original to this site.
