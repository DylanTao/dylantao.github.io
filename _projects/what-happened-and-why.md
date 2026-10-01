---
layout: page
title: What Happened and Why?
permalink: /projects/what-happened-and-why/
description: A CHI 2026 workshop position paper about trace-guided micro-episodes and in-flow user explanations for product iteration in AI-supported design tools.
img: assets/img/publication_preview/herding_cats_why_what-transparent.png
image_aspect: 16 / 9
importance: -4
category: research
venue: CHI 2026 Workshop
year: 2026
role: First author
status: Published
date: 2026-04-15
hide_title: true
wide_layout: true
design_story_class: trace-project-page
keywords: What Happened and Why, trace-guided micro-episodes, elicited user explanations, product iteration, creative activity traces, CHI 2026 workshop, Herding CATs, generative AI, design tools, Sirui Tao, William P. McCarthy, Steven P. Dow
og_image: https://dylantao.github.io/assets/img/publication_preview/herding_cats_why_what.png
og_image_width: 1376
og_image_height: 590
citation_title: "What Happened and Why? Trace-Guided Micro-Episodes with Elicited User Explanations for Product Iteration"
citation_authors:
  - "Tao, Sirui"
  - "McCarthy, William P."
  - "Dow, Steven P."
citation_publication_date: "2026/04/15"
citation_conference_title: "Herding CATs: Making Sense of Creative Activity Traces (CHI 2026 Workshop)"
citation_pdf_url: "https://dylantao.github.io/projects/what-happened-and-why/what-happened-and-why.pdf"
---

<div class="trace-paper-page">
  <section class="trace-hero">
    <p class="trace-kicker">CHI 2026 Workshop Position Paper</p>
    <h1 class="trace-title">
      <span class="trace-title-lead">What Happened and Why?</span>
      <span class="trace-title-rest">Trace-Guided Micro-Episodes with Elicited User Explanations for Product&nbsp;Iteration</span>
    </h1>
    <p class="trace-subtitle">
      A workshop position paper about how interaction traces and short, in-context user explanations can work together to support product iteration in creative AI tools.
    </p>
    <div class="trace-actions">
      <a class="trace-btn trace-btn-primary" href="{{ '/projects/what-happened-and-why/what-happened-and-why.pdf' | relative_url }}">Read the PDF</a>
      <a class="trace-btn trace-btn-quiet" href="https://herding-cats-ws.github.io/">Workshop</a>
      <a class="trace-btn trace-btn-quiet" href="#bibtex">BibTeX</a>
    </div>

    <div class="trace-hero-grid">
      <aside class="trace-hero-evidence" aria-label="Micro-episode lifecycle diagram">
        <div class="trace-figure-shell">
          {% include figure.liquid loading="eager" path="assets/img/publication_preview/herding_cats_why_what-transparent.png" width="1376" height="590" title="Micro-episode lifecycle diagram" alt="Diagram showing a trace-guided micro-episode lifecycle: detect friction, offer a context-aware control, collect user rationale, and diagnose product iteration" class="img-fluid research-cutout" %}
          <a class="research-lens__open" href="{{ '/assets/img/publication_preview/herding_cats_why_what.png' | relative_url }}">Open original figure ↗</a>
        </div>
        <div class="trace-caption">
          <p>Trace-guided micro-episodes pair what users did with a lightweight explanation of why the moment mattered.</p>
          <ol class="trace-mechanism-steps" aria-label="Three parts of the proposed micro-episode">
            <li><strong>Detect friction.</strong> Identify a short window of activity where a user may need help.</li>
            <li><strong>Offer a useful control.</strong> Let recovery within the tool elicit an explanation of intent.</li>
            <li><strong>Use the rationale.</strong> The proposal links that explanation to diagnostic and alignment uses.</li>
          </ol>
        </div>
      </aside>

      <div class="trace-hero-proof">
        <p class="trace-author-line" aria-label="Authors">
          <span class="trace-author-label">Authors</span>
          <a class="trace-author-chip" href="https://dylantao.github.io/">Sirui Tao <span>UCSD</span></a>,
          <a class="trace-author-chip" href="https://wpmccarthy.com/">William P. McCarthy <span>Autodesk AI Lab</span></a>,
          <a class="trace-author-chip" href="https://spdow.ucsd.edu/">Steven P. Dow <span>UCSD</span></a>
        </p>
        <dl class="trace-meta">
          <div class="trace-meta-card">
            <dt class="trace-meta-label">Venue</dt>
            <dd class="trace-meta-value">Herding CATs: Making Sense of Creative Activity Traces (CHI 2026 Workshop)</dd>
          </div>
          <div class="trace-meta-card">
            <dt class="trace-meta-label">Published</dt>
            <dd class="trace-meta-value"><time datetime="2026-04-15">April 15, 2026</time></dd>
          </div>
          <div class="trace-meta-card">
            <dt class="trace-meta-label">Focus</dt>
            <dd class="trace-meta-value">Creative workflows, product iteration, and grounded alignment data</dd>
          </div>
        </dl>
      </div>
    </div>

  </section>

  <details class="trace-abstract" id="abstract">
    <summary>Read the paper abstract</summary>
    <p>
      Teams shipping AI workflows in design tools can measure usage yet often struggle to explain why features fail. In creative work, standard metrics are ambiguous: a long session could imply productive exploration or frustrating struggle with stochastic outputs. We argue for trace-guided micro-episodes, a unit of analysis binding interaction logs&mdash;what users did&mdash;to their intent. Rather than relying on disruptive surveys, we propose a &ldquo;utility-for-rationale&rdquo; paradigm: systems offer optional, context-aware controls at likely friction points, capturing user explanations as a byproduct of real-time error recovery. This approach converts ambiguous telemetry into causal evidence without breaking flow. We posit this methodology serves a dual purpose: equipping teams with diagnostic clarity to iterate on vague failure modes (e.g., controllability vs. quality) while generating the grounded alignment data required to train future agents.
    </p>
  </details>

  <section class="trace-section">
    <div class="trace-reading-width">
      <h2>Overview</h2>
      <p>
        Creative systems produce detailed logs, but those logs are often hard to interpret on their own. A long interaction sequence might reflect productive exploration, repeated verification, or a user struggling to recover from an unsatisfying result. This paper starts from a simple observation: traces are good at showing <em>what</em> happened, but they are often poor at revealing <em>why</em>.
      </p>
      <p>
        To make those traces more informative, the paper proposes <strong>trace-guided micro-episodes</strong>: short windows of interaction paired with the local interface context and a lightweight explanation from the user at a moment of friction. Rather than treating explanation as a separate survey task, the proposal is to gather it through useful recovery-oriented interactions inside the tool itself.
      </p>
    </div>
  </section>

  <section class="trace-section">
    <h2>Why it matters</h2>
    <div class="trace-reading-width">
      <p>
        This position paper argues that telemetry alone is not enough for understanding creative AI workflows, because the same trace can reflect productive exploration, careful verification, or real friction. It proposes trace-guided micro-episodes as a way to look more locally at moments where users are trying to recover, clarify intent, or repair an output, and pairs those traces with lightweight in-context explanations from the user. The value of that framing is not that it solves the problem outright, but that it gives teams a more concrete way to interpret ambiguous behavior and reason about what kind of support or product change is actually needed.
      </p>
    </div>
  </section>

  <section class="trace-citation">
    <h2>Cite this paper</h2>
    <ul class="trace-inline-list">
      <li>
        <strong>Venue</strong>
        Herding CATs: Making Sense of Creative Activity Traces (CHI 2026 Workshop)
      </li>
      <li>
        <strong>Publication Date</strong>
        April 15, 2026
      </li>
      <li>
        <strong>PDF</strong>
        <a href="{{ '/projects/what-happened-and-why/what-happened-and-why.pdf' | relative_url }}">what-happened-and-why.pdf</a>
      </li>
    </ul>

    <p>
      Use the BibTeX below if you want to cite the paper or add it to a reference manager.
    </p>

    <div class="trace-actions">
      <a class="trace-btn trace-btn-primary" href="{{ '/projects/what-happened-and-why/what-happened-and-why.pdf' | relative_url }}">Open PDF</a>
      <a class="trace-btn trace-btn-quiet" href="https://herding-cats-ws.github.io/">Workshop Page</a>
    </div>

    <h2 id="bibtex">BibTeX</h2>
    {% assign whw_publication = site.data.publication_catalog.by_key['tao2026whw'] %}
    <pre class="trace-bibtex"><code>{{ whw_publication.citation.bibtex | escape }}</code></pre>

  </section>
</div>
