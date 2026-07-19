---
layout: page
title: Scholar Lens
description: A site-native citation highlighter that connects authorship, paper format, annual citation context, and the accepted-paper list.
img: assets/img/project_pics/site-experiments/scholar-lens.png
image_aspect: 3 / 2
card_image_fit: contain
card_avoid_scaling: true
importance: -28
category: fun
site_experiment: true
debut_date: 2026-05-30T15:19:54-07:00
year: 2026
role: Designer, builder
status: Site experiment
hide_title: true
---

<section class="project-case-hero site-experiment-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">Site experiment · first seen May 30, 2026</p>
    <h1>Scholar Lens</h1>
    <p class="project-case-lede">
      I wanted citation context to help someone find a paper, not rank the work. Scholar Lens keeps the bibliography in charge, then lets one paper light up across its publication row, lifetime citation chip, and dated annual bars.
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
  <figure
    class="project-case-media site-experiment-evidence-figure"
    data-evidence-kind="runtime-crop"
    data-evidence-archive-commit="c23d42e9d52b41d795a8fbb0de962d7fe7466c3f"
    data-evidence-archive-date="2026-07-15"
    data-evidence-capture-date="2026-07-15"
    data-evidence-data-sync="2026-07-15"
    data-evidence-artifact-size="1330x900"
    data-evidence-theme="light"
    data-evidence-state="all-papers-no-filter"
    data-evidence-source-commit="not-recorded"
    data-evidence-source-viewport="not-recorded"
    data-evidence-browser="not-recorded"
  >
    <img src="{{ '/assets/img/project_pics/site-experiments/scholar-lens.png' | relative_url }}" alt="July 15 light-theme Scholar Lens artifact beside the accepted-paper bibliography, with all five papers selected, 227 lifetime citations, and annual citation bars" loading="eager" width="1330" height="900">
    <figcaption>This July 15 artifact shows the all-papers state before the next metadata sync. Its 1330 × 900 crop is exact; the source viewport and browser were not recorded, so they are left unspecified.</figcaption>
  </figure>
</section>

<section class="project-case-summary" aria-label="Scholar Lens summary">
  <div><span>Why</span><p>Citation context can help a reader navigate, but an unlabeled total can easily masquerade as a quality score.</p></div>
  <div><span>What</span><p>A public, dated overlay for filtering papers and seeing how one paper contributes to annual citation bars.</p></div>
  <div><span>How</span><p>Focus and selection synchronize the canonical row, its lifetime citation chip, and the older annual snapshot.</p></div>
</section>

## Why it began

The publication list already held the facts I trust: title, authors, venue, year, and links. What it did not make easy was following one author role, one paper format, or one paper’s place in the citation history without leaving the page.

My friend [Howard](https://howardhan.com/) recommended the [Google Scholar Author Highlighter](https://chromewebstore.google.com/detail/google-scholar-author-hig/ijmngekkpaccbbjimedfkjpigplaikah?hl=en). Its useful lesson was contextual emphasis: help someone follow a person through a dense record without erasing everything around them. Scholar Lens adapts that principle to this bibliography rather than copying the extension’s interface.

## What changed

<ol class="project-story-beats" aria-label="Scholar Lens turning points">
  <li class="project-story-beat">
    <p class="project-case-kicker">Spark</p>
    <h3>The record was complete but hard to trace</h3>
    <p>The bibliography could answer “what did Sirui publish?” It could not quickly answer “which full papers are first-authored?” or “which paper contributed to this year?”</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Turn</p>
    <h3>Filtering became coordinated focus</h3>
    <p>Authorship and format filters narrow the same accepted-paper list. Hovering or focusing a row then links its title, citation chip, and annual contributions instead of opening a second record.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Now</p>
    <h3>Two clocks stay visibly separate</h3>
    <p>Lifetime totals can refresh without rewriting the annual history. A freshness note makes that asymmetry part of the interface rather than hiding it in implementation detail.</p>
  </li>
</ol>

## Follow DesignWeaver through the lens

DesignWeaver makes the synchronization concrete. The three cues below refer to the same bibliography key, but they do different jobs and do not share one timestamp. [Paper Constellation]({{ '/projects/paper-constellation/' | relative_url }}) uses that same key to send focus into the lens without creating a second publication record.

<ol class="project-storyboard" aria-label="DesignWeaver evidence path">
  <li class="project-storyboard-step">
    <h3>Bibliography row</h3>
    <p>The CHI 2025 row remains the source for the paper’s title, authors, venue, format, and links. The lens can emphasize or filter that row; it cannot replace it.</p>
  </li>
  <li class="project-storyboard-step">
    <h3>Lifetime citation chip</h3>
    <p>The chip reads <strong>38 citations</strong> in the Google Scholar totals synchronized on <time datetime="2026-07-16">July 16, 2026</time>. Focusing the row highlights this chip as the paper’s current aggregate.</p>
  </li>
  <li class="project-storyboard-step">
    <h3>Annual bars</h3>
    <p>The older <time datetime="2026-06-17">June 17, 2026</time> snapshot attributes 7 citations to 2025 and 28 to 2026. Those 35 dated contributions are not presented as a reconstruction of the later lifetime total.</p>
  </li>
</ol>

<aside class="project-story-note project-story-note--privacy" aria-labelledby="scholar-boundary-title">
  <p class="project-case-kicker">Freshness and boundary</p>
  <h2 id="scholar-boundary-title">Navigation evidence, not an impact score</h2>
  <p>The lens data contains public aggregate citation counts, bibliography keys, authorship roles, paper formats, and explicit snapshot dates. It does not infer paper quality, author contribution, causality, or reader interest. Filtering runs against the visible publication record; it does not change which work is accepted or collect a private Scholar history.</p>
</aside>

<details class="project-story-disclosure site-experiment-technical-details">
  <summary id="scholar-technical-summary">Technical provenance and exact ledger</summary>
  <div class="project-story-disclosure-body" aria-labelledby="scholar-technical-summary">
    <ul>
      <li><strong>Canonical paper record:</strong> <code>_bibliography/papers.bib</code>; the lens joins through stable publication keys rather than duplicating titles or venue facts.</li>
      <li><strong>Lifetime totals:</strong> <code>_data/citations.yml</code> and <code>_data/publication_lens.yml</code>, synchronized <time datetime="2026-07-16">July 16, 2026</time>. DesignWeaver records 38 citations; all five listed papers total 227.</li>
      <li><strong>Annual snapshot:</strong> <code>_data/publication_lens.yml</code>, explicitly frozen as of <time datetime="2026-06-17">June 17, 2026</time>. DesignWeaver contributes 7 in 2025 and 28 in 2026 in that snapshot.</li>
      <li><strong>Static artifact:</strong> 1330 × 900 light-theme, all-papers crop with July 15 data, SHA-256 <code>70ece335cce4eb25ff342dba57e8842e4296521090c9a5b9a53469fdfd29bbc6</code>. It entered the repository in <code>c23d42e9d</code> on July 15. The exact runtime source commit, browser, and source viewport were not recorded.</li>
      <li><strong>Progressive enhancement:</strong> without JavaScript, the accepted-paper bibliography remains complete and authoritative; the filters and linked focus states are optional navigation aids.</li>
    </ul>
    <ol class="site-experiment-ledger" aria-label="Scholar Lens iteration record">
      <li><time datetime="2026-05-30">May 30</time><code>089b29413</code><span>Added the site-native lens, per-paper citation data, annual bars, filters, and publication-list synchronization.</span></li>
      <li><time datetime="2026-06-01">Jun 1</time><code>c568345d1</code><span>Connected hover and keyboard focus so annual contribution, citation chip, and paper entry read as one evidence path.</span></li>
      <li><time datetime="2026-06-17">Jun 17</time><code>beeb11fb2</code><span>Recorded the annual per-paper snapshot while preserving the bibliography as the canonical accepted-paper list.</span></li>
      <li><time datetime="2026-07-15">Jul 15</time><code>eeb0a5764</code><span>Made the lifetime-total sync clock explicit while preserving the separately dated June 17 annual snapshot.</span></li>
      <li><time datetime="2026-07-15">Jul 15</time><code>c23d42e9d</code><span>Archived the current 1330 × 900 Scholar Lens artifact for the project card and case-study hero.</span></li>
      <li><time datetime="2026-07-16">Jul 16</time><code>fa19d29d5</code><span>Advanced the lifetime-total freshness date to July 16 while the 38 DesignWeaver citations, 227 five-paper total, and older annual snapshot stayed unchanged.</span></li>
    </ol>
  </div>
</details>

<aside class="site-experiment-reproduce" aria-labelledby="scholar-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="scholar-reproduce-title">Keep facts and overlays separate.</h2>
  <p>The guide covers canonical keys, independently dated snapshots, synchronized focus, no-JavaScript fallbacks, and honest freshness labels.</p>
  <a href="{{ '/assets/downloads/site-experiments/scholar-lens-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>
