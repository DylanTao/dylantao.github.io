---
layout: page
title: Scholar Lens
description: A site-native citation highlighter that connects authorship, paper format, annual citation context, and the accepted-paper list.
importance: -28
category: fun
site_experiment: true
debut_date: 2026-05-30T15:19:54-07:00
year: 2026
role: Designer, builder
status: Site experiment
hide_title: true
---

<section class="project-case-hero site-experiment-hero site-experiment-hero-text">
  <div class="project-case-copy">
    <p class="project-case-kicker">Site experiment · first seen May 30, 2026</p>
    <h1>Scholar Lens</h1>
    <p class="project-case-lede">
      A small evidence panel beside the publication list. It filters papers by authorship and format, connects annual citation bars to the papers behind them, and keeps every count tied to a dated Google Scholar snapshot.
    </p>
    <div class="project-case-facts">
      <span>Dated citation evidence</span>
      <span>Authorship and format</span>
      <span>Bidirectional highlight</span>
      <span>List stays authoritative</span>
    </div>
    <div class="project-case-actions">
      <a href="{{ '/publications/#scholar-lens-title' | relative_url }}">Open the Scholar Lens</a>
      <a href="{{ '/assets/downloads/site-experiments/scholar-lens-reproduction.md' | relative_url }}" download>Download reproduction MD</a>
    </div>
  </div>
</section>

<section class="project-case-summary" aria-label="Scholar Lens summary">
  <div><span>Question</span><p>How can citation context help someone navigate the papers without turning the page into a ranking dashboard?</p></div>
  <div><span>Interaction</span><p>Hover, focus, or filter one view and the corresponding paper, year share, and totals answer together.</p></div>
  <div><span>Boundary</span><p>The bibliography owns publication facts; the lens owns a volatile, dated citation overlay.</p></div>
</section>

## Origin

My friend [Howard](https://howardhan.com/) recommended the [Google Scholar Author Highlighter](https://chromewebstore.google.com/detail/google-scholar-author-hig/ijmngekkpaccbbjimedfkjpigplaikah?hl=en). Its useful lesson was contextual emphasis: make one author’s contribution easier to follow without hiding the surrounding record. The site adapts that principle into its own publication filters and annual citation view.

<ol class="site-experiment-ledger" aria-label="Scholar Lens iteration record">
  <li><time datetime="2026-05-30">May 30</time><code>089b29413</code><span>Added the site-native lens, per-paper citation data, annual bars, filters, and publication-list synchronization.</span></li>
  <li><time datetime="2026-06-01">Jun 1</time><code>c568345d1</code><span>Improved hover and focus so annual contribution, citation chip, and paper entry read as one evidence path.</span></li>
  <li><time datetime="2026-06-17">Jun 17</time><code>beeb11fb2</code><span>Updated citation highlights while preserving the bibliography as the canonical accepted-paper list.</span></li>
</ol>

<aside class="site-experiment-reproduce" aria-labelledby="scholar-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="scholar-reproduce-title">Keep facts and overlays separate.</h2>
  <p>The guide covers canonical keys, dated snapshots, synchronized focus, no-JavaScript fallbacks, and honest freshness labels.</p>
  <a href="{{ '/assets/downloads/site-experiments/scholar-lens-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>
