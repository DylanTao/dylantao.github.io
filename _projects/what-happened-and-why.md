---
layout: page
title: What Happened and Why?
permalink: /projects/what-happened-and-why/
description: A CHI 2026 workshop position paper about trace-guided micro-episodes and in-flow user explanations for product iteration in AI-supported design tools.
img: assets/img/publication_preview/herding_cats_why_what.png
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
_styles: |
  .trace-paper-page {
    --trace-accent: var(--global-primary-color);
    --trace-accent-deep: var(--global-hover-color);
    --trace-accent-soft: rgba(var(--global-accent-rgb), 0.1);
    --trace-accent-softer: rgba(var(--global-accent-rgb), 0.055);
    --trace-border: rgba(var(--global-accent-rgb), 0.2);
    --trace-shadow: 0 24px 60px var(--global-shadow-color);
    max-width: 1380px;
    margin: 0 auto;
    padding-bottom: 1.25rem;
    color: var(--global-text-color);
  }

  html[data-theme='dark'] .trace-paper-page,
  html[data-theme-mode='evening'] .trace-paper-page {
    --trace-accent: var(--global-primary-color);
    --trace-accent-deep: var(--global-primary-hover-color);
    --trace-accent-soft: rgba(var(--global-accent-rgb), 0.16);
    --trace-accent-softer: rgba(var(--global-accent-rgb), 0.08);
    --trace-border: rgba(var(--global-accent-rgb), 0.24);
    --trace-shadow: 0 24px 60px var(--global-shadow-strong-color);
  }

  .trace-paper-page a {
    text-decoration-thickness: 0.08em;
    text-underline-offset: 0.16em;
  }

  .trace-hero,
  .trace-section,
  .trace-abstract,
  .trace-citation {
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(circle at top right, var(--trace-accent-soft), transparent 38%),
      linear-gradient(180deg, var(--trace-accent-softer), transparent 72%);
    border: 1px solid var(--global-divider-color);
    border-radius: 1.5rem;
    box-shadow: var(--trace-shadow);
  }

  .trace-hero {
    padding: clamp(1.6rem, 3vw, 2.9rem);
    margin-bottom: 1.75rem;
    border-color: var(--trace-border);
  }

  .trace-kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.45rem 0.85rem;
    border-radius: 999px;
    background: var(--trace-accent-soft);
    color: var(--trace-accent-deep);
    font-size: var(--type-label);
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .trace-kicker::before {
    content: '';
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: var(--trace-accent);
    box-shadow:
      1.15rem 0 0 rgba(var(--global-accent-rgb), 0.32),
      2.3rem 0 0 rgba(var(--global-accent-rgb), 0.16);
  }

  .trace-title {
    margin: 1.15rem 0 0.95rem;
    font-family: var(--font-display);
    max-width: 60rem;
    line-height: 1;
    letter-spacing: 0;
  }

  .trace-title-lead {
    display: block;
    max-width: none;
    font-size: var(--type-case-title);
    line-height: 1;
    white-space: normal;
  }

  .trace-title-rest {
    display: block;
    max-width: 58rem;
    margin-top: 0.45rem;
    font-size: var(--type-section-title);
    font-weight: 400;
    line-height: 1.12;
    letter-spacing: 0;
  }

  .trace-subtitle {
    max-width: 88rem;
    margin: 0;
    font-size: var(--type-prose);
    line-height: 1.78;
    color: var(--global-text-color-light);
    text-wrap: pretty;
  }

  .trace-hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(330px, 0.58fr);
    grid-template-areas: 'proof evidence';
    gap: 1.35rem;
    align-items: start;
    margin-top: 1.55rem;
  }

  .trace-hero-proof {
    grid-area: proof;
    min-width: 0;
  }

  .trace-hero-evidence {
    grid-area: evidence;
    min-width: 0;
  }

  .trace-hero-evidence .trace-figure-shell {
    background: var(--global-card-bg-color);
  }

  .trace-meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    margin: 0 0 1rem;
  }

  .trace-meta-card {
    padding: 0.95rem 1rem;
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.38);
    border: 1px solid var(--global-divider-color);
  }

  html[data-theme='dark'] .trace-meta-card {
    background: rgba(0, 0, 0, 0.12);
  }

  .trace-meta-label {
    display: block;
    margin-bottom: 0.25rem;
    font-size: var(--type-label);
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
    color: var(--trace-accent-deep);
  }

  .trace-meta-value {
    margin: 0;
    font-size: 1rem;
    line-height: 1.5;
  }

  .trace-author-line {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    align-items: center;
    margin: 0 0 1rem;
  }

  .trace-author-label,
  .trace-author-chip span {
    font-size: var(--type-label);
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .trace-author-label {
    color: var(--trace-accent-deep);
  }

  .trace-author-chip {
    display: inline-flex;
    gap: 0.35rem;
    align-items: baseline;
    padding: 0.35rem 0.65rem;
    border: 1px solid var(--global-divider-color);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.38);
    color: var(--global-text-color);
    text-decoration: none;
  }

  .trace-author-chip:hover {
    color: var(--trace-accent-deep);
    text-decoration: none;
  }

  .trace-author-chip span {
    color: var(--global-text-color-light);
  }

  html[data-theme='dark'] .trace-author-chip {
    background: rgba(0, 0, 0, 0.12);
  }

  .trace-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .trace-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.78rem 1.1rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.72);
    color: var(--trace-accent-deep);
    border: 1px solid var(--trace-border);
    font-weight: 700;
    text-decoration: none;
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      background 180ms ease;
  }

  .trace-btn:hover {
    color: var(--trace-accent-deep);
    background: rgba(255, 255, 255, 0.92);
    transform: translateY(-1px);
    box-shadow: 0 10px 22px var(--global-shadow-color);
  }

  html[data-theme='dark'] .trace-btn {
    background: rgba(0, 0, 0, 0.14);
  }

  html[data-theme='dark'] .trace-btn:hover {
    background: rgba(0, 0, 0, 0.2);
  }

  .trace-btn.trace-btn-primary {
    background: var(--trace-accent-soft);
    color: var(--trace-accent-deep);
  }

  .trace-btn.trace-btn-quiet {
    background: transparent;
    color: var(--trace-accent-deep);
    border: 1px solid var(--trace-border);
  }

  .trace-btn.trace-btn-quiet:hover {
    color: var(--trace-accent-deep);
    background: var(--trace-accent-soft);
  }

  .trace-abstract {
    padding: clamp(1.45rem, 2vw, 1.95rem);
    margin-bottom: 1.75rem;
    border-color: var(--trace-border);
  }

  .trace-abstract h2,
  .trace-section h2,
  .trace-citation h2 {
    margin-top: 0;
    margin-bottom: 0.8rem;
    font-family: var(--font-display);
    font-size: var(--type-card-title);
  }

  .trace-abstract p,
  .trace-section p,
  .trace-citation p,
  .trace-citation li {
    font-size: 1rem;
    line-height: 1.8;
  }

  .trace-section,
  .trace-citation {
    padding: clamp(1.45rem, 2vw, 1.95rem);
    margin-bottom: 1.75rem;
  }

  .trace-two-column {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.95fr);
    gap: 1.4rem;
    align-items: center;
  }

  .trace-why-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .trace-reading-width {
    max-width: 76rem;
  }

  .trace-section .trace-reading-width p:last-child {
    margin-bottom: 0;
  }

  .trace-why-card {
    padding: 1rem;
    border-radius: 1rem;
    border: 1px solid var(--global-divider-color);
    background: rgba(255, 255, 255, 0.35);
  }

  html[data-theme='dark'] .trace-why-card {
    background: rgba(0, 0, 0, 0.12);
  }

  .trace-why-card h3 {
    margin-top: 0;
    margin-bottom: 0.5rem;
    font-size: 1rem;
    color: var(--trace-accent-deep);
  }

  .trace-why-card p {
    margin: 0;
    font-size: 0.97rem;
    line-height: 1.7;
  }

  .trace-figure-shell {
    padding: 0.85rem;
    border-radius: 1.2rem;
    background: var(--global-card-bg-color);
    border: 1px solid var(--global-divider-color);
  }

  .trace-inline-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem 1.25rem;
    padding: 0;
    margin: 1rem 0 1.2rem;
    list-style: none;
  }

  .trace-inline-list li {
    padding: 0.85rem 0.95rem;
    border-radius: 0.95rem;
    background: rgba(255, 255, 255, 0.35);
    border: 1px solid var(--global-divider-color);
  }

  html[data-theme='dark'] .trace-inline-list li {
    background: rgba(0, 0, 0, 0.12);
  }

  .trace-inline-list strong {
    display: block;
    font-size: var(--type-label);
    letter-spacing: 0;
    text-transform: uppercase;
    color: var(--trace-accent-deep);
  }

  .trace-bibtex {
    margin: 1rem 0 0;
    padding: 1rem 1.1rem;
    overflow-x: auto;
    border-radius: 1rem;
    background: var(--trace-accent-softer);
    border: 1px solid var(--trace-border);
  }

  .trace-bibtex code {
    white-space: pre;
    background: transparent;
    padding: 0;
    color: var(--global-text-color);
    font-size: 0.93rem;
    line-height: 1.65;
  }

  .trace-caption {
    margin-top: 0.75rem;
    font-size: 0.92rem;
    color: var(--global-text-color-light);
    text-align: center;
  }

  .trace-abstract p,
  .trace-citation > p {
    max-width: 78rem;
  }

  @media (max-width: 992px) {
    .trace-meta,
    .trace-why-grid,
    .trace-inline-list,
    .trace-two-column {
      grid-template-columns: 1fr;
    }

    .trace-hero-grid {
      grid-template-columns: 1fr;
      grid-template-areas:
        'evidence'
        'proof';
    }
  }

  @media (max-width: 576px) {
    .trace-hero,
    .trace-section,
    .trace-abstract,
    .trace-citation {
      padding: 1.2rem;
      border-radius: 1.2rem;
    }

    .trace-title {
      max-width: none;
    }

    .trace-title-lead {
      max-width: none;
      font-size: 2.15rem;
      white-space: normal;
    }

    .trace-title-rest {
      max-width: none;
      font-size: 1.45rem;
    }

    .trace-actions {
      flex-direction: column;
    }

    .trace-btn {
      width: 100%;
    }
  }
---

<div class="trace-paper-page">
  <section class="trace-hero">
    <span class="trace-kicker">CHI 2026 Workshop Position Paper</span>
    <h1 class="trace-title">
      <span class="trace-title-lead">What Happened and Why?</span>
      <span class="trace-title-rest">Trace-Guided Micro-Episodes with Elicited User Explanations for Product&nbsp;Iteration</span>
    </h1>
    <p class="trace-subtitle">
      A workshop position paper about how interaction traces and short, in-context user explanations can work together to support product iteration in creative AI tools.
    </p>

    <div class="trace-hero-grid">
      <div class="trace-hero-proof">
        <div class="trace-meta">
          <div class="trace-meta-card">
            <span class="trace-meta-label">Venue</span>
            <p class="trace-meta-value">Herding CATs: Making Sense of Creative Activity Traces (CHI 2026 Workshop)</p>
          </div>
          <div class="trace-meta-card">
            <span class="trace-meta-label">Publication Date</span>
            <p class="trace-meta-value">April 15, 2026</p>
          </div>
          <div class="trace-meta-card">
            <span class="trace-meta-label">Focus</span>
            <p class="trace-meta-value">Creative workflows, product iteration, and grounded alignment data</p>
          </div>
        </div>

        <div class="trace-author-line" aria-label="Authors">
          <span class="trace-author-label">Authors</span>
          <a class="trace-author-chip" href="https://dylantao.github.io/">Sirui Tao <span>UCSD</span></a>
          <a class="trace-author-chip" href="https://wpmccarthy.com/">William P. McCarthy <span>Autodesk AI Lab</span></a>
          <a class="trace-author-chip" href="https://spdow.ucsd.edu/">Steven P. Dow <span>UCSD</span></a>
        </div>

        <div class="trace-actions">
          <a class="trace-btn trace-btn-primary" href="{{ '/projects/what-happened-and-why/what-happened-and-why.pdf' | relative_url }}">PDF</a>
          <a class="trace-btn trace-btn-quiet" href="https://herding-cats-ws.github.io/">Workshop</a>
          <a class="trace-btn trace-btn-quiet" href="#bibtex">BibTeX</a>
        </div>
      </div>

      <aside class="trace-hero-evidence" aria-label="Micro-episode lifecycle diagram">
        <div class="trace-figure-shell">
          {% include figure.liquid loading="eager" path="assets/img/publication_preview/herding_cats_why_what.png" title="Micro-episode lifecycle diagram" alt="Diagram showing a trace-guided micro-episode lifecycle: detect friction, offer a context-aware control, collect user rationale, and diagnose product iteration" class="img-fluid rounded z-depth-1" %}
        </div>
        <div class="trace-caption">
          Trace-guided micro-episodes pair what users did with a lightweight explanation of why the moment mattered.
        </div>
      </aside>
    </div>

  </section>

  <section class="trace-abstract" id="abstract">
    <h2>Abstract</h2>
    <p>
      Teams shipping AI workflows in design tools can measure usage yet often struggle to explain why features fail. In creative work, standard metrics are ambiguous: a long session could imply productive exploration or frustrating struggle with stochastic outputs. We argue for trace-guided micro-episodes, a unit of analysis binding interaction logs&mdash;what users did&mdash;to their intent. Rather than relying on disruptive surveys, we propose a &ldquo;utility-for-rationale&rdquo; paradigm: systems offer optional, context-aware controls at likely friction points, capturing user explanations as a byproduct of real-time error recovery. This approach converts ambiguous telemetry into causal evidence without breaking flow. We posit this methodology serves a dual purpose: equipping teams with diagnostic clarity to iterate on vague failure modes (e.g., controllability vs. quality) while generating the grounded alignment data required to train future agents.
    </p>
  </section>

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

    <h2 id="bibtex" style="margin-top: 1.5rem;">BibTeX</h2>
    {% assign whw_publication = site.data.publication_catalog.by_key['tao2026whw'] %}
    <pre class="trace-bibtex"><code>{{ whw_publication.citation.bibtex | escape }}</code></pre>

  </section>
</div>
