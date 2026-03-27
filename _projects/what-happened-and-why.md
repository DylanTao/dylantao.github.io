---
layout: page
title: What Happened and Why?
permalink: /projects/what-happened-and-why/
description: A CHI 2026 workshop position paper about trace-guided micro-episodes and in-flow user explanations for product iteration in AI-supported design tools.
img: assets/img/publication_preview/herding_cats_why_what.png
importance: -4
category: research
date: 2026-02-25
hide_title: true
keywords: What Happened and Why, trace-guided micro-episodes, elicited user explanations, product iteration, creative activity traces, CHI 2026 workshop, Herding CATs, generative AI, design tools, Sirui Tao, William P. McCarthy, Steven P. Dow
og_image: https://dylantao.github.io/assets/img/publication_preview/herding_cats_why_what.png
citation_title: "What Happened and Why? Trace-Guided Micro-Episodes with Elicited User Explanations for Product Iteration"
citation_authors:
  - "Tao, Sirui"
  - "McCarthy, William P."
  - "Dow, Steven P."
citation_publication_date: "2026/02/25"
citation_conference_title: "Herding CATs: Making Sense of Creative Activity Traces (CHI 2026 Workshop)"
citation_pdf_url: "https://dylantao.github.io/projects/what-happened-and-why/what-happened-and-why.pdf"
_styles: |
  .trace-paper-page {
    --trace-accent: #9f4f2f;
    --trace-accent-deep: #6f2f1c;
    --trace-accent-soft: rgba(159, 79, 47, 0.1);
    --trace-accent-softer: rgba(159, 79, 47, 0.06);
    --trace-border: rgba(159, 79, 47, 0.18);
    --trace-shadow: 0 24px 60px rgba(22, 21, 18, 0.08);
    color: var(--global-text-color);
  }

  html[data-theme='dark'] .trace-paper-page {
    --trace-accent: #f3a26f;
    --trace-accent-deep: #ffcfad;
    --trace-accent-soft: rgba(243, 162, 111, 0.16);
    --trace-accent-softer: rgba(243, 162, 111, 0.08);
    --trace-border: rgba(243, 162, 111, 0.22);
    --trace-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
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
    padding: 2.25rem;
    margin-bottom: 1.5rem;
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
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .trace-kicker::before {
    content: '';
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: var(--trace-accent);
    box-shadow:
      1.15rem 0 0 rgba(159, 79, 47, 0.32),
      2.3rem 0 0 rgba(159, 79, 47, 0.16);
  }

  .trace-title {
    margin: 1.15rem 0 0.85rem;
    font-family: 'Roboto Slab', serif;
    font-size: clamp(2rem, 4vw, 3.35rem);
    line-height: 1.08;
    letter-spacing: -0.03em;
  }

  .trace-subtitle {
    max-width: 52rem;
    margin: 0;
    font-size: 1.08rem;
    line-height: 1.75;
    color: var(--global-text-color-light);
  }

  .trace-meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.9rem;
    margin: 1.5rem 0 1.75rem;
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
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--trace-accent-deep);
  }

  .trace-meta-value {
    margin: 0;
    font-size: 1rem;
    line-height: 1.5;
  }

  .trace-author-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .trace-author-card {
    padding: 1.15rem 1rem 1.2rem;
    text-align: center;
    background: var(--global-card-bg-color);
    border: 1px solid var(--global-divider-color);
    border-radius: 1.15rem;
  }

  .trace-author-avatar,
  .trace-author-card img {
    width: 108px;
    height: 108px;
    margin: 0 auto 0.9rem;
    border-radius: 50%;
    object-fit: cover;
    display: block;
    border: 3px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 16px 30px rgba(0, 0, 0, 0.12);
  }

  .trace-author-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(circle at 28% 28%, rgba(255, 255, 255, 0.9), transparent 36%),
      linear-gradient(135deg, var(--trace-accent), var(--trace-accent-deep));
    color: #fffaf5;
    font-family: 'Roboto Slab', serif;
    font-size: 2rem;
    letter-spacing: 0.06em;
  }

  .trace-author-name {
    display: inline-block;
    margin-bottom: 0.18rem;
    font-weight: 700;
    color: var(--global-text-color);
  }

  .trace-author-affiliation {
    margin: 0;
    font-size: 0.95rem;
    color: var(--global-text-color-light);
  }

  .trace-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .trace-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.78rem 1.1rem;
    border-radius: 999px;
    background: var(--global-text-color);
    color: var(--global-bg-color);
    font-weight: 700;
    text-decoration: none;
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      background 180ms ease;
  }

  .trace-btn:hover {
    color: var(--global-bg-color);
    transform: translateY(-1px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.16);
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
    padding: 1.55rem 1.45rem;
    margin-bottom: 1.5rem;
    border-color: var(--trace-border);
  }

  .trace-abstract h2,
  .trace-section h2,
  .trace-citation h2 {
    margin-top: 0;
    margin-bottom: 0.8rem;
    font-family: 'Roboto Slab', serif;
    font-size: 1.55rem;
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
    padding: 1.55rem 1.45rem;
    margin-bottom: 1.5rem;
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
    font-size: 0.76rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--trace-accent-deep);
  }

  .trace-bibtex {
    margin: 1rem 0 0;
    padding: 1rem 1.1rem;
    overflow-x: auto;
    border-radius: 1rem;
    background: var(--global-code-bg-color);
    border: 1px solid var(--global-divider-color);
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

  @media (max-width: 992px) {
    .trace-meta,
    .trace-author-grid,
    .trace-why-grid,
    .trace-inline-list,
    .trace-two-column {
      grid-template-columns: 1fr;
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
      font-size: 1.85rem;
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
      What Happened and Why? Trace-Guided Micro-Episodes with Elicited User Explanations for Product Iteration
    </h1>
    <p class="trace-subtitle">
      A paper about making creative-AI telemetry more useful by pairing high-friction interaction traces with lightweight, in-flow user explanations.
    </p>

    <div class="trace-meta">
      <div class="trace-meta-card">
        <span class="trace-meta-label">Venue</span>
        <p class="trace-meta-value">Herding CATs: Making Sense of Creative Activity Traces (CHI 2026 Workshop)</p>
      </div>
      <div class="trace-meta-card">
        <span class="trace-meta-label">Publication Date</span>
        <p class="trace-meta-value">February 25, 2026</p>
      </div>
      <div class="trace-meta-card">
        <span class="trace-meta-label">Focus</span>
        <p class="trace-meta-value">Creative workflows, product iteration, and grounded alignment data</p>
      </div>
    </div>

    <div class="trace-author-grid">
      <div class="trace-author-card">
        <img src="{{ '/assets/img/authors/sirui_tao.jpg' | relative_url }}" alt="Sirui Tao portrait">
        <a class="trace-author-name" href="https://dylantao.github.io/">Sirui Tao</a>
        <p class="trace-author-affiliation">UC San Diego</p>
      </div>
      <div class="trace-author-card">
        <!-- TODO: Replace this placeholder with William P. McCarthy's repo-local headshot when one is added to assets/img/authors/. -->
        <div class="trace-author-avatar" aria-hidden="true">WM</div>
        <a class="trace-author-name" href="https://wpmccarthy.com/">William P. McCarthy</a>
        <p class="trace-author-affiliation">Autodesk AI Lab</p>
      </div>
      <div class="trace-author-card">
        <img src="{{ '/assets/img/authors/steven_dow.png' | relative_url }}" alt="Steven P. Dow portrait">
        <a class="trace-author-name" href="https://spdow.ucsd.edu/">Steven P. Dow</a>
        <p class="trace-author-affiliation">UC San Diego</p>
      </div>
    </div>

    <div class="trace-actions">
      <a class="trace-btn" href="{{ '/projects/what-happened-and-why/what-happened-and-why.pdf' | relative_url }}">PDF</a>
      <a class="trace-btn trace-btn-quiet" href="https://herding-cats-ws.github.io/">Workshop</a>
      <a class="trace-btn trace-btn-quiet" href="#bibtex">BibTeX</a>
    </div>

  </section>

  <section class="trace-abstract" id="abstract">
    <h2>Abstract</h2>
    <p>
      Teams shipping AI workflows in design tools can measure usage yet often struggle to explain why features fail. In creative work, standard metrics are ambiguous: a long session could imply productive exploration or frustrating struggle with stochastic outputs. We argue for trace-guided micro-episodes, a unit of analysis binding interaction logs&mdash;what users did&mdash;to their intent. Rather than relying on disruptive surveys, we propose a &ldquo;utility-for-rationale&rdquo; paradigm: systems offer optional, context-aware controls at likely friction points, capturing user explanations as a byproduct of real-time error recovery. This approach converts ambiguous telemetry into causal evidence without breaking flow. We posit this methodology serves a dual purpose: equipping teams with diagnostic clarity to iterate on vague failure modes (e.g., controllability vs. quality) while generating the grounded alignment data required to train future agents.
    </p>
  </section>

  <section class="trace-section">
    <div class="trace-two-column">
      <div>
        <h2>What is this paper about?</h2>
        <p>
          The paper argues that activity traces alone usually tell teams <em>what</em> happened, but not <em>why</em>. In creative and generative workflows, that gap matters: the same behavioral trace can signal useful exploration, confusion, verification burden, or a mismatch between system output and user intent.
        </p>
        <p>
          To bridge that gap, the paper proposes <strong>trace-guided micro-episodes</strong>: compact records that combine a short interaction trace, the surrounding interface state, and a minimal user explanation collected exactly when friction is high. The core idea is to make clarification useful to the person in the moment, so rationale capture becomes part of recovery rather than an interruption.
        </p>
      </div>
      <div>
        <div class="trace-figure-shell">
          {% include figure.liquid loading="eager" path="assets/img/publication_preview/herding_cats_why_what.png" title="Micro-episode lifecycle diagram" class="img-fluid rounded z-depth-1" %}
        </div>
        <div class="trace-caption">
          The paper frames a micro-episode lifecycle: detect friction, offer a useful clarification affordance, and convert the resulting rationale into actionable product evidence.
        </div>
      </div>
    </div>
  </section>

  <section class="trace-section">
    <h2>Why it matters</h2>
    <div class="trace-why-grid">
      <div class="trace-why-card">
        <h3>Better product diagnosis</h3>
        <p>
          Teams can separate vague failure modes like controllability, quality, and verification burden instead of inferring them from ambiguous aggregate metrics.
        </p>
      </div>
      <div class="trace-why-card">
        <h3>Low-friction evidence capture</h3>
        <p>
          The proposed &ldquo;utility-for-rationale&rdquo; framing keeps the focus on helping users recover in the moment, rather than asking them to stop and fill out a survey.
        </p>
      </div>
      <div class="trace-why-card">
        <h3>Grounded training data</h3>
        <p>
          Micro-episodes can also become alignment data for future agents by pairing action traces with explicit human reasoning about what went wrong.
        </p>
      </div>
    </div>
  </section>

  <section class="trace-citation">
    <h2>PDF, citation, and workshop info</h2>
    <ul class="trace-inline-list">
      <li>
        <strong>Authors</strong>
        Sirui Tao, William P. McCarthy, and Steven P. Dow
      </li>
      <li>
        <strong>Venue</strong>
        Herding CATs: Making Sense of Creative Activity Traces (CHI 2026 Workshop)
      </li>
      <li>
        <strong>Publication Date</strong>
        2026/02/25
      </li>
      <li>
        <strong>PDF URL</strong>
        <a href="{{ '/projects/what-happened-and-why/what-happened-and-why.pdf' | relative_url }}">what-happened-and-why.pdf</a>
      </li>
    </ul>

    <p>
      Suggested citation: Tao, Sirui, William P. McCarthy, and Steven P. Dow. 2026. <em>What Happened and Why? Trace-Guided Micro-Episodes with Elicited User Explanations for Product Iteration.</em> Herding CATs: Making Sense of Creative Activity Traces (CHI 2026 Workshop).
    </p>

    <div class="trace-actions">
      <a class="trace-btn" href="{{ '/projects/what-happened-and-why/what-happened-and-why.pdf' | relative_url }}">Open PDF</a>
      <a class="trace-btn trace-btn-quiet" href="https://herding-cats-ws.github.io/">Workshop Page</a>
    </div>

    <h2 id="bibtex" style="margin-top: 1.5rem;">BibTeX</h2>
    <pre class="trace-bibtex"><code>@inproceedings{tao202whw,

title = {What Happened and Why? Trace-Guided Micro-Episodes with Elicited User Explanations for Product Iteration},
author = {Tao, Sirui and McCarthy, William P. and Dow, Steven P.},
booktitle = {Herding CATs: Making Sense of Creative Activity Traces (CHI 2026 Workshop)},
year = {2026},
month = feb,
url = {https://dylantao.github.io/projects/what-happened-and-why/},
pdf = {https://dylantao.github.io/projects/what-happened-and-why/what-happened-and-why.pdf}
}</code></pre>

  </section>
</div>
