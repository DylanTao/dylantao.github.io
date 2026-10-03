---
layout: default
title: How DesignWeaver works
permalink: /design-lab/case-process/
description: Follow DesignWeaver from the design brief through dimensions, prompts, generated images, and iteration.
panel_wide: true
nav: false
sitemap: false
search: false
robots: noindex, nofollow
---

<link rel="stylesheet" href="{{ '/assets/css/case-concepts.css' | relative_url }}">

<article class="case-concept case-concept--process" aria-labelledby="concept-title">
  <div class="case-concept__navigation">
    <a href="{{ '/design-lab/' | relative_url }}"><span aria-hidden="true">←</span> Design notebook</a>
    <nav aria-label="DesignWeaver reading paths">
      <a href="{{ '/design-lab/case-comparison/' | relative_url }}">Study comparison <span aria-hidden="true">→</span></a>
      <a href="{{ '/projects/designweaver/' | relative_url }}">Full case study</a>
    </nav>
  </div>

  <header class="case-concept__opening">
    <p class="case-concept__meta">CHI 2025 · First author · 52-participant study</p>
    <h1 id="concept-title">DesignWeaver</h1>
    <p class="case-concept__lede">A workspace for turning vague product ideas into inspectable design dimensions, richer prompts, and better comparison across generated concepts.</p>
    <p class="case-concept__authors">Sirui Tao, Ivan Liang, Cindy Peng, Zhiqing Wang, Srishti Palani, and Steven P. Dow</p>
    <div class="case-concept__resources" aria-label="DesignWeaver research materials">
      <a href="https://arxiv.org/pdf/2502.09867">Paper <span aria-hidden="true">↗</span></a>
      <a href="https://github.com/slimykat/DesignWeaver">Code <span aria-hidden="true">↗</span></a>
    </div>
  </header>

  <section class="case-concept__process" aria-labelledby="process-heading">
    <div class="case-concept__section-intro">
      <p class="case-concept__meta">The process</p>
      <h2 id="process-heading">How DesignWeaver Works</h2>
      <p>Dimensions come from the brief, from images people upload, and from what the model generates, so the vocabulary grows with the work.</p>
    </div>

    <div class="case-concept__process-board">
      <ol class="case-concept__stages">
        <li id="process-brief">
          <h3>Upload Design Brief</h3>
          <p>Client persona, requirements, and moodboard go in; the system extracts three initial dimensions.</p>
        </li>
        <li id="process-prompt">
          <h3>Build AI Prompt</h3>
          <p>Designers click tags or type text, then the prompt is formatted into a more complete design request.</p>
        </li>
        <li id="process-images">
          <h3>Generate And Inspect Designs</h3>
          <p>Designers compare three rendered images and use Info to surface new tags from the outputs.</p>
        </li>
        <li id="process-iteration">
          <h3>Iterate And Refine</h3>
          <p>Designers add or remove dimensions, regenerate, and collect favorites for side-by-side comparison.</p>
        </li>
      </ol>

      <div class="case-concept__process-proof">
        {% include figure.liquid loading="eager" path="assets/img/project_pics/designweaver/tool_design_system_diagram.jpg" width="7822" height="5801" sizes="(min-width: 1080px) 840px, (min-width: 768px) 90vw, 95vw" title="DesignWeaver iterative design process" alt="System diagram showing how DesignWeaver ingests design documents, recommends dimensions, generates images, and supports iteration" class="case-concept__image" caption="Figure 2: Overview of the iterative design process using DesignWeaver. The process involves four main stages: (1) Ingest the design document to extract initial dimensions and tags, (2) Refine and recommend dimensions to generate prompts, (3) Use prompts to render and refine images, and (4) Iterate based on new dimensions and tags inspired by the generated images." %}
        <a class="case-concept__figure-link" href="{{ '/assets/img/project_pics/designweaver/tool_design_system_diagram.jpg' | relative_url }}">Open original system diagram <span aria-hidden="true">↗</span></a>
      </div>
    </div>

  </section>

  <section class="case-concept__takeaway" aria-labelledby="process-evidence">
    <p class="case-concept__meta">Evidence</p>
    <h2 id="process-evidence">DesignWeaver Research Results</h2>
    <p>In a controlled study, participants wrote richer prompts and produced more diverse, expert-aligned chair concepts.</p>
    <p>52 novice designers took part. With DesignWeaver their prompts were longer and more specific, and experts rated their chairs more novel than the baseline's.</p>
    <a href="{{ '/design-lab/case-comparison/' | relative_url }}">Inspect the study comparison <span aria-hidden="true">→</span></a>
  </section>

</article>
