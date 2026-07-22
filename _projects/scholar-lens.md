---
layout: page
title: Scholar Lens
description: A site-native citation highlighter that connects authorship, paper format, annual citation context, and the accepted-paper list.
img: assets/img/project_pics/scholar-lens/scholar-lens-designweaver-497b22266-1440-light.png
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

{% assign scholar_lens_data = site.data.publication_lens %}
{% assign scholar_designweaver = scholar_lens_data.papers.tao2024designweaver %}

<section class="project-case-hero site-experiment-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">Site experiment · first seen May 30, 2026</p>
    <h1>Scholar Lens</h1>
    <p class="project-case-lede">
      I wanted citation context to help someone find a paper. Scholar Lens keeps the bibliography primary, then lets one paper light up across its publication row, lifetime citation chip, and dated annual bars.
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
    data-evidence-kind="responsive-runtime-crop"
    data-evidence-capture-date="2026-07-22"
    data-evidence-data-sync="2026-07-21"
    data-evidence-desktop-artifact-size="1440x900"
    data-evidence-mobile-artifact-size="360x270"
    data-evidence-theme="light"
    data-evidence-theme-mode="noon"
    data-evidence-interaction="keyboard-focus-on-designweaver-title-link"
    data-evidence-desktop-state="linked-row-citation-chip-and-annual-bars"
    data-evidence-mobile-state="focused-bibliography-row"
    data-evidence-source-commit="497b222662fa198ad5e6a43d2727cdb06ec3babf"
    data-evidence-desktop-source-viewport="1440x1000"
    data-evidence-mobile-source-viewport="390x1000"
    data-evidence-browser="Chromium 145.0.7632.6"
  >
    <picture>
      <source media="(max-width: 767px)" srcset="{{ '/assets/img/project_pics/scholar-lens/scholar-lens-designweaver-497b22266-390-light.png' | relative_url }}" type="image/png">
      <img src="{{ '/assets/img/project_pics/scholar-lens/scholar-lens-designweaver-497b22266-1440-light.png' | relative_url }}" alt="DesignWeaver highlighted in Scholar Lens's responsive publication and citation view" loading="eager" width="1440" height="900">
    </picture>
    <figcaption>DesignWeaver in focus at the July 22 source checkpoint. Desktop shows the linked row, citation chip, and dated annual bars; mobile keeps the honest row-first view.</figcaption>
  </figure>
</section>

<section class="project-case-summary" aria-label="Scholar Lens summary">
  <div><span>Why</span><p>Readers need a fast path from a paper to its authorship, format, and dated citation context.</p></div>
  <div><span>What</span><p>A public, dated overlay for filtering papers and seeing how one paper contributes to annual citation bars.</p></div>
  <div><span>How</span><p>Focus and selection synchronize the canonical row, its lifetime citation chip, and the older annual snapshot.</p></div>
</section>

## Why it began

The publication list already held the core facts: title, authors, venue, year, and links. Scholar Lens adds a fast way to follow one author role, paper format, or paper's place in the citation history.

My friend [Howard](https://howardhan.com/) recommended the [Google Scholar Author Highlighter](https://chromewebstore.google.com/detail/google-scholar-author-hig/ijmngekkpaccbbjimedfkjpigplaikah?hl=en). Its useful lesson was contextual emphasis: help someone follow a person through a dense record while keeping the surrounding record visible. Scholar Lens brings that principle into this bibliography.

## What changed

<ol class="project-story-beats" aria-label="Scholar Lens turning points">
  <li class="project-story-beat">
    <p class="project-case-kicker">Spark</p>
    <h3>The record was complete but hard to trace</h3>
    <p>The bibliography answered “what did Sirui publish?” The lens adds two quick paths: “which full papers are first-authored?” and “which paper contributed to this year?”</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Turn</p>
    <h3>Filtering became coordinated focus</h3>
    <p>Authorship and format filters narrow the same accepted-paper list. Hovering or focusing a row then links its title, citation chip, and annual contributions instead of opening a second record.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Now</p>
    <h3>Lifetime totals and annual bars keep separate dates</h3>
    <p>Lifetime totals can refresh while the annual snapshot stays fixed. Freshness labels make both dates visible.</p>
  </li>
</ol>

## Follow DesignWeaver through the lens

DesignWeaver makes the synchronization concrete. Three cues share one bibliography key while carrying distinct jobs and dates. [Paper Constellation]({{ '/projects/paper-constellation/' | relative_url }}) uses that key to send focus into the lens.

{% include scholar_story_trace.liquid %}

<aside class="project-story-note project-story-note--privacy" aria-labelledby="scholar-boundary-title">
  <p class="project-case-kicker">Freshness and scope</p>
  <h2 id="scholar-boundary-title">Navigation context, not an impact score</h2>
  <p>The lens uses public aggregate citation counts, bibliography keys, authorship roles, paper formats, and explicit snapshot dates. It does not infer paper quality, author contribution, causality, or reader interest. Only the dated public aggregates shown here enter the overlay; the lens does not collect private Scholar history.</p>
</aside>

<details class="project-story-disclosure site-experiment-technical-details">
  <summary id="scholar-technical-summary">Technical provenance and exact ledger</summary>
  <div class="project-story-disclosure-body" aria-labelledby="scholar-technical-summary">
    <ul>
      <li><strong>Canonical paper record:</strong> <code>_bibliography/papers.bib</code>; the lens joins through stable publication keys rather than duplicating titles or venue facts.</li>
      <li><strong>Lifetime totals:</strong> <code>_data/citations.yml</code> and <code>_data/publication_lens.yml</code>, synchronized <time datetime="{{ scholar_lens_data.metadata.totals_last_synced }}">{{ scholar_lens_data.metadata.totals_last_synced | date: '%B %-d, %Y' }}</time>. DesignWeaver records {{ scholar_designweaver.citation_total }} citations; all five listed papers total {{ scholar_lens_data.metadata.total_citations }}.</li>
      <li><strong>Annual snapshot:</strong> <code>_data/publication_lens.yml</code>, explicitly frozen as of <time datetime="2026-06-17">June 17, 2026</time>. DesignWeaver contributes 7 in 2025 and 28 in 2026 in that snapshot.</li>
      <li><strong>Responsive runtime evidence:</strong> captured from <code>/publications/</code> at source commit <code>497b22266</code> on July 22 in Chromium 145.0.7632.6, Noon light theme, with keyboard focus on DesignWeaver. The 1440 × 1000 source viewport yielded a 1440 × 900 desktop crop showing the linked row, 39-citation chip, and 2025–2026 contribution bars (SHA-256 <code>064d8496d66fb0b7b362d99cc80c60fe57b2f7c750fc1ba064eac4ea8519ed73</code>). The 390 × 1000 source viewport yielded a 360 × 270 mobile row crop (SHA-256 <code>6cd988e461b996886e7a90cad758abc1ebb378ddcaec6d7192bdcec7505c59ae</code>); it does not pretend the desktop-only chart is present.</li>
      <li><strong>Progressive enhancement:</strong> the accepted-paper bibliography is complete in server-rendered HTML; JavaScript adds filters and linked focus states.</li>
    </ul>
    <ol class="site-experiment-ledger" aria-label="Scholar Lens iteration record">
      <li><time datetime="2026-05-30">May 30</time><code>089b29413</code><span>Added the site-native lens, per-paper citation data, annual bars, filters, and publication-list synchronization.</span></li>
      <li><time datetime="2026-06-01">Jun 1</time><code>c568345d1</code><span>Connected hover and keyboard focus so annual contribution, citation chip, and paper entry read as one evidence path.</span></li>
      <li><time datetime="2026-06-17">Jun 17</time><code>beeb11fb2</code><span>Recorded the annual per-paper snapshot while preserving the bibliography as the canonical accepted-paper list.</span></li>
      <li><time datetime="2026-07-15">Jul 15</time><code>eeb0a5764</code><span>Made the lifetime-total sync clock explicit while preserving the separately dated June 17 annual snapshot.</span></li>
      <li><time datetime="2026-07-15">Jul 15</time><code>c23d42e9d</code><span>Archived the current 1330 × 900 Scholar Lens artifact for the project card and case-study hero.</span></li>
      <li><time datetime="2026-07-16">Jul 16</time><code>fa19d29d5</code><span>Advanced the lifetime-total freshness date at that checkpoint; later syncs continue to update the current totals independently from the annual snapshot.</span></li>
      <li><time datetime="2026-07-22">Jul 22</time><code>497b22266</code><span>Used this deployed source checkpoint to capture the DesignWeaver focus state at exact desktop and mobile viewports, replacing the generic all-papers artifact with story-specific evidence.</span></li>
    </ol>
  </div>
</details>

<aside class="site-experiment-reproduce" aria-labelledby="scholar-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="scholar-reproduce-title">Keep facts and overlays separate.</h2>
  <p>The guide covers canonical keys, independently dated snapshots, synchronized focus, no-JavaScript fallbacks, and honest freshness labels.</p>
  <a href="{{ '/assets/downloads/site-experiments/scholar-lens-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>
