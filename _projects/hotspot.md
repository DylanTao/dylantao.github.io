---
layout: page
title: HotSpot
description: A neural SDF optimization framework with a screened Poisson objective for more stable surface reconstruction.
img: assets/img/publication_preview/hotspot.png
image_aspect: 21 / 9
importance: -3
category: research
venue: CVPR 2025 Highlight
year: 2025
role: Co-author
status: Published
github: https://github.com/Galaxeaaa/HotSpot
related_publications: true
hide_title: true
---

<section class="project-case-hero hotspot-case">
  <div class="project-case-copy">
    <p class="project-case-kicker">CVPR 2025 Highlight · Co-author</p>
    <h1>HotSpot</h1>
    <p class="project-case-lede">
      A way to optimize neural signed distance functions so that the loss itself, not an extra regularizer, pushes the network toward a true distance field.
    </p>
    <div class="project-case-facts">
      <span>Neural SDF optimization</span>
      <span>Screened Poisson objective</span>
      <span>Surface reconstruction</span>
    </div>
    <div class="project-case-actions">
      <a href="https://openaccess.thecvf.com/content/CVPR2025/papers/Wang_HotSpot_Signed_Distance_Function_Optimization_with_an_Asymptotically_Sufficient_Condition_CVPR_2025_paper.pdf" target="_blank" rel="noopener noreferrer">Paper</a>
      <a href="https://zeamoxwang.github.io/HotSpot-CVPR25/" target="_blank" rel="noopener noreferrer">Project page</a>
      <a href="https://github.com/Galaxeaaa/HotSpot" target="_blank" rel="noopener noreferrer">Code</a>
      <a href="https://www.youtube.com/watch?v=v-OeGOxgqRM" target="_blank" rel="noopener noreferrer">Video</a>
    </div>
  </div>
  <div class="project-case-media">
    {% include figure.liquid loading="eager" path="assets/img/publication_preview/hotspot.png" width="1373" height="308" title="HotSpot teaser" alt="Reconstructed surfaces and their signed distance fields side by side, comparing an eikonal baseline with HotSpot" class="img-fluid" %}
  </div>
</section>

<section class="project-case-summary" aria-label="HotSpot research summary">
  <div>
    <span>Question</span>
    <p>Why do neural SDF fits drift away from true distance functions under the eikonal loss, and what objective makes a distance function the guaranteed minimizer?</p>
  </div>
  <div>
    <span>Contribution</span>
    <p>HotSpot optimizes a loss derived from the screened Poisson equation whose minimizer is asymptotically a signed distance function, so training stays stable without stacking heuristics.</p>
  </div>
  <div>
    <span>Evidence</span>
    <p>On standard surface reconstruction benchmarks the recovered distances and surfaces are more accurate than eikonal-based baselines, and CVPR 2025 selected the paper as a highlight.</p>
  </div>
</section>

<p>My part was on the experiments and evaluation side of a project led by Zimo Wang in Tzu-Mao Li's group at UC San Diego. Full citation: {% cite wang2025hotspot %}.</p>
