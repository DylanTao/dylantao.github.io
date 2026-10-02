---
layout: default
title: DesignWeaver comparison preview
permalink: /design-lab/case-comparison/
description: An unlisted DesignWeaver case-study preview that places the baseline, scaffolded interface, and study evidence together.
panel_wide: true
nav: false
sitemap: false
search: false
robots: noindex, nofollow
---

<link rel="stylesheet" href="{{ '/assets/css/case-concepts.css' | relative_url }}">

<article class="case-concept case-concept--comparison" aria-labelledby="concept-title">
  <div class="case-concept__review">
    <p>Concept F · Unlisted review</p>
    <nav aria-label="Case-study previews">
      <a href="{{ '/design-lab/case-process/' | relative_url }}"><span aria-hidden="true">←</span> Concept E: process</a>
      <a href="{{ '/projects/designweaver/' | relative_url }}">Current case study</a>
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

  <section class="case-concept__comparison" aria-labelledby="comparison-heading">
    <div class="case-concept__section-intro">
      <p class="case-concept__meta">The interface decision</p>
      <h2 id="comparison-heading">Put the vocabulary next to the image.</h2>
      <p>Novices know what they like when they see it, but a blank prompt box asks them to name it first. The study began from that gap.</p>
    </div>

    <div class="case-concept__conditions">
      <section class="case-concept__condition" aria-labelledby="baseline-heading">
        <p class="case-concept__meta">Baseline</p>
        <h3 id="baseline-heading">A standard text-to-image setup</h3>
        {% include figure.liquid loading="eager" path="assets/img/project_pics/designweaver/user_study_baseline.jpg" width="3784" height="2131" sizes="(min-width: 768px) 550px, 95vw" title="DesignWeaver study baseline" alt="Baseline study interface showing participants creating product design prompts without dimensional scaffolding" class="case-concept__image" caption="Figure 4. The baseline interface mimics a standard text-to-image setup, excluding scaffolding components." %}
        <a class="case-concept__figure-link" href="{{ '/assets/img/project_pics/designweaver/user_study_baseline.jpg' | relative_url }}">Open original baseline interface <span aria-hidden="true">↗</span></a>
      </section>

      <section class="case-concept__condition" aria-labelledby="scaffolding-heading">
        <p class="case-concept__meta">DesignWeaver</p>
        <h3 id="scaffolding-heading">Dimension Palette &amp; Interactive Prompt Box</h3>
        {% include figure.liquid loading="eager" path="assets/img/project_pics/designweaver/DesignWeaver_teaser.jpg" width="15360" height="7732" sizes="(min-width: 768px) 550px, 95vw" title="DesignWeaver scaffolded interface" alt="DesignWeaver interface overview showing a prompt box, dimension palette, image gallery, and favorite folder" class="case-concept__image" caption="Figure 1. The interface brings together (A) a prompt box, (B) a dimension palette, (C) an image gallery, and (D) a favorite folder." %}
        <a class="case-concept__figure-link" href="{{ '/assets/img/project_pics/designweaver/DesignWeaver_teaser.jpg' | relative_url }}">Open original DesignWeaver interface <span aria-hidden="true">↗</span></a>
      </section>
    </div>

  </section>

  <section class="case-concept__evidence" aria-labelledby="evidence-heading">
    <div class="case-concept__section-intro">
      <p class="case-concept__meta">52 novice designers</p>
      <h2 id="evidence-heading">DesignWeaver Research Results</h2>
      <p>A user study involving 52 novice designers revealed that DesignWeaver:</p>
    </div>

    <div class="case-concept__evidence-row">
      <div class="case-concept__evidence-note">
        <h3>Creative Exploration</h3>
        <p>Rated higher on creative exploration and continuous improvement of design ideas.</p>
      </div>
      <div class="case-concept__evidence-figure">
        {% include figure.liquid path="assets/img/project_pics/designweaver/finding_survey_average_ratings_comparison.jpg" width="1993" height="653" sizes="(min-width: 1080px) 850px, 95vw" title="DesignWeaver participant survey ratings" alt="Bar chart comparing average survey ratings between DesignWeaver and baseline conditions" class="case-concept__image" caption="Figure 6, left. Participants rated DesignWeaver higher than the Baseline on ease of idea-to-prompt conversion, design space exploration, prompt generation, concept refinement, and iterative design improvement." %}
        <a class="case-concept__figure-link" href="{{ '/assets/img/project_pics/designweaver/finding_survey_average_ratings_comparison.jpg' | relative_url }}">Open original survey ratings <span aria-hidden="true">↗</span></a>
      </div>
    </div>

    <div class="case-concept__evidence-row case-concept__evidence-row--distribution">
      <div class="case-concept__evidence-note">
        <h3>Design Diversity</h3>
        <p>DesignWeaver participants created semantically more diverse images than the Baseline.</p>
      </div>
      <div class="case-concept__evidence-figure">
        {% include figure.liquid path="assets/img/project_pics/designweaver/finding_image_similarity_scores_distribution.jpg" width="989" height="590" sizes="(min-width: 768px) 550px, 95vw" title="DesignWeaver image similarity distribution" alt="Distribution plot comparing image similarity scores for generated chair concepts" class="case-concept__image" caption="Figure 6, right. DesignWeaver participants created semantically more diverse images than the Baseline." %}
        <a class="case-concept__figure-link" href="{{ '/assets/img/project_pics/designweaver/finding_image_similarity_scores_distribution.jpg' | relative_url }}">Open original image similarity plot <span aria-hidden="true">↗</span></a>
      </div>
    </div>

  </section>

  <aside class="case-concept__review-note" aria-label="Preview intent and references">
    <p><strong>Review question:</strong> Does seeing the baseline beside DesignWeaver make the contribution and study results easier to understand?</p>
    <details>
      <summary>About this preview</summary>
      <p>This is an unlisted layout study. The two interface figures describe the study conditions; the results below are the paper's original figures. Research wording, figure labels, and credit come from the <a href="{{ '/projects/designweaver/' | relative_url }}">DesignWeaver case study</a> and the credited paper above.</p>
      <p>Keeping notes beside the artifact draws on <a href="https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/056-architectural-blueprint.html">056: Casa Lumen</a>. Labeling both sides and placing evidence beside a comparison draws on <a href="https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/071-palette-studio.html">071: Chroma</a>. This preview uses original HTML/CSS and existing research assets.</p>
    </details>
  </aside>
</article>
