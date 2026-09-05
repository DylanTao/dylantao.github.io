---
layout: page
title: Physion
description: A benchmark for testing whether vision models predict physical scene dynamics the way people do.
img: assets/img/publication_preview/physion-card.webp
image_aspect: 16 / 9
importance: -1
category: research
venue: NeurIPS Datasets 2021
year: 2021
role: Co-author
status: Published
github: https://github.com/cogtoolslab/physics-benchmarking-neurips2021
related_publications: true
hide_title: true
---

<section class="project-case-hero physion-case">
  <div class="project-case-copy">
    <p class="project-case-kicker">NeurIPS 2021 Datasets and Benchmarks · Co-author</p>
    <h1>Physion</h1>
    <p class="project-case-lede">
      A benchmark that asks people and vision models the same question about the same simulated scenes: what happens next?
    </p>
    <div class="project-case-facts">
      <span>Eight physical scenarios</span>
      <span>Human and model predictions</span>
      <span>Open dataset and code</span>
    </div>
    <div class="project-case-actions">
      <a href="https://datasets-benchmarks-proceedings.neurips.cc/paper_files/paper/2021/file/d09bf41544a3365a46c9077ebb5e35c3-Paper-round1.pdf" target="_blank" rel="noopener noreferrer">Paper</a>
      <a href="https://physion-benchmark.github.io/" target="_blank" rel="noopener noreferrer">Benchmark site</a>
      <a href="https://github.com/cogtoolslab/physics-benchmarking-neurips2021" target="_blank" rel="noopener noreferrer">Code</a>
      <a href="https://www.youtube.com/watch?v=Jz7ImDazcJI" target="_blank" rel="noopener noreferrer">Video</a>
    </div>
  </div>
  <div class="project-case-media">
    {% include figure.liquid loading="eager" path="assets/img/publication_preview/physion-card.webp" title="Physion scenarios" alt="Grid of simulated Physion scenes with objects about to collide, drop, roll, and drape over one another" class="img-fluid" %}
  </div>
</section>

<section class="project-case-summary" aria-label="Physion research summary">
  <div>
    <span>Question</span>
    <p>Do vision models predict everyday physical outcomes the way people do, and where exactly do the two diverge?</p>
  </div>
  <div>
    <span>Contribution</span>
    <p>Physion pairs eight simulated scenario types with one shared prediction task, so models and human participants are scored on identical videos and identical questions.</p>
  </div>
  <div>
    <span>Evidence</span>
    <p>People outperformed every model tested, and models built on explicit object representations tracked human judgments more closely than pixel-based ones.</p>
  </div>
</section>

<p>I contributed to the benchmark as part of the cogtoolslab team led by Judith Fan and Dan Yamins. Full citation: {% cite bear2021physion %}. The follow-up Physion++ study is {% cite tung2023physion++ %}.</p>
