---
layout: page
title: The IKEA Card Experiment
description: An in-place project preview that keeps the surrounding evidence grid visible while one artifact opens.
img: assets/img/project_pics/site-experiments/ikea-card-expanded.png
image_aspect: 24 / 13
card_image_fit: contain
card_avoid_scaling: true
importance: -26
category: fun
site_experiment: true
debut_date: 2026-05-27T19:20:51-07:00
year: 2026
role: Interaction designer, builder
status: Site experiment
hide_title: true
---

<section class="project-case-hero site-experiment-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">Site experiment · first seen May 27, 2026</p>
    <h1>The IKEA Card Experiment</h1>
    <p class="project-case-lede">
      Open one project without leaving the collection. The selected card expands in place, surrounding cards preserve orientation, and the motion exists only to explain where the added evidence came from.
    </p>
    <div class="project-case-facts">
      <span>In-place preview</span>
      <span>FLIP object constancy</span>
      <span>Focus recovery</span>
      <span>Instant reduced motion</span>
    </div>
    <div class="project-case-actions">
      <a href="{{ '/projects/' | relative_url }}">Try the project cards</a>
      <a href="{{ '/assets/downloads/site-experiments/ikea-project-cards-reproduction.md' | relative_url }}" download>Download reproduction MD</a>
    </div>
  </div>
  <figure
    class="project-case-media site-experiment-evidence-figure"
    data-artifact-checkpoint="b51609f0d"
    data-capture-date="2026-07-16"
    data-capture-viewport="not-retained"
    data-capture-theme="light"
    data-capture-state="paper-constellation-expanded"
    data-artifact-size="1200x650"
  >
    <img src="{{ '/assets/img/project_pics/site-experiments/ikea-card-expanded.png' | relative_url }}" alt="Projects index with Paper Constellation expanded beside Build Rhythm while other project cards remain visible">
    <figcaption>
      One preview opens in place; the surrounding collection remains readable.
      <span class="project-story-provenance">Runtime crop · asset checkpoint <code>b51609f0d</code> · captured Jul 16, 2026 · 1200×650 · light theme · expanded state · source viewport not retained</span>
    </figcaption>
  </figure>
</section>

<section class="project-case-summary" aria-label="IKEA card experiment summary">
  <div><span>Question</span><p>How can visitors inspect one artifact without losing the shape of the project collection?</p></div>
  <div><span>Motion</span><p>One cancelable FLIP clock translates cards to their new positions while the active surface reveals inside a clip.</p></div>
  <div><span>Recovery</span><p>Escape, outside dismissal, close, focus restoration, polite status, and reduced motion all end in the same valid state.</p></div>
</section>

## Why opening in place mattered

The [IKEA PS 2026 collection story](https://www.ikea.com/global/en/stories/design/ikea-ps-2026-collection/) suggested a useful reading pattern: let one object open where it already lives, while the rest of the collection remains context. For an academic portfolio, that means the animation should preserve card identity and reveal evidence—not perform a product-launch flourish.

## Three states, one spatial promise

The interaction is easiest to understand as a short sentence: **this card was here, it is opening here, and it is still here when the motion ends.** The live project browser owns the interaction; this page names the three states without turning a transition into a decorative demo.

<figure
  class="ikea-state-anatomy"
  data-evidence-kind="annotated-current-state-anatomy"
  data-runtime-contract="9fa9403e4"
  data-motion-clock="430ms"
>
  <div class="ikea-state-anatomy-grid">
    <div class="ikea-state-frame">
      <p class="project-case-kicker">01 · Collapsed</p>
      <div class="ikea-state-diagram" aria-hidden="true">
        <span class="ikea-state-card is-selected"></span>
        <span class="ikea-state-card"></span>
        <span class="ikea-state-card"></span>
        <span class="ikea-state-card"></span>
      </div>
      <h3>Same footprint</h3>
      <p>Each card returns to the same compact footprint within its group. The preview names the artifact; a quiet plus signals that more evidence is available.</p>
    </div>
    <div class="ikea-state-frame">
      <p class="project-case-kicker">02 · Moving</p>
      <div class="ikea-state-diagram ikea-state-diagram--moving" aria-hidden="true">
        <span class="ikea-state-origin-outline"></span>
        <span class="ikea-state-card is-selected is-moving"></span>
        <span class="ikea-state-card"></span>
        <span class="ikea-state-card"></span>
        <span class="ikea-state-card"></span>
        <span class="ikea-state-motion-vector">430 ms</span>
      </div>
      <h3>Translate, then reveal</h3>
      <p>The semantic open state changes first. One 430 ms clock moves cards without scaling while a clip reveals only the newly opened surface.</p>
    </div>
    <div class="ikea-state-frame">
      <p class="project-case-kicker">03 · Open</p>
      <div class="ikea-state-diagram ikea-state-diagram--open" aria-hidden="true">
        <span class="ikea-state-card is-selected is-open"></span>
        <span class="ikea-state-card"></span>
        <span class="ikea-state-card"></span>
      </div>
      <h3>Wider, still in place</h3>
      <p>The selected story gains room while its neighbors preserve the collection. Close, Escape, and focus return all resolve to one stable state.</p>
    </div>
  </div>
  <figcaption>A static, reduced-motion-safe anatomy of the accepted <code>9fa9403e4</code> interaction contract.</figcaption>
</figure>

## What changed

<ol class="project-story-beats" aria-label="Project card motion evolution">
  <li class="project-story-beat">
    <p class="project-case-kicker">Spark · <code>15d94c048</code></p>
    <h3>The first FLIP</h3>
    <p>The first pass measured each card before and after opening, then translated and scaled the whole card back toward its old rectangle. It established object constancy, but scaling also squeezed text and imagery during motion.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Turn · <code>fc5b8a444</code> → <code>192bcc00c</code></p>
    <h3>More signals, then less motion</h3>
    <p>Accents, takeaways, image zoom, content keyframes, and smooth scrolling began competing for attention. The July pass removed nonuniform FLIP scaling and introduced a cancelable translation-only clock.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Now · <code>9fa9403e4</code></p>
    <h3>One cancelable clock</h3>
    <p>The opening clip joined the same clock; descendant keyframes and image zoom left. Retargeting cancels stale work, reduced motion reaches the same final layout immediately, and one visibility check happens after settlement.</p>
  </li>
</ol>

<aside class="project-story-note" aria-labelledby="ikea-evidence-boundary-title">
  <p class="project-case-kicker">Evidence boundary</p>
  <h3 id="ikea-evidence-boundary-title">Current anatomy, exact source history</h3>
  <p>The May 27 build could not be replayed faithfully, so this page pairs a reduced-motion anatomy of the accepted interaction with its exact source history.</p>
</aside>

<details class="project-story-disclosure">
  <summary>Full technical revision record</summary>
  <div class="project-story-disclosure-body">
    <ol class="site-experiment-ledger" aria-label="Project card iteration record">
      <li><time datetime="2026-05-27">May 27</time><code>15d94c048</code><span>Introduced the in-place card preview and first FLIP layout transition.</span></li>
      <li><time datetime="2026-05-27">May 27</time><code>ee95cc681</code><span>Added keyboard focus movement and recovery when a preview closes.</span></li>
      <li><time datetime="2026-05-27">May 27</time><code>fc5b8a444</code><span>Added project-specific accents and short takeaways, but also layered several competing motions.</span></li>
      <li><time datetime="2026-07-13">Jul 13</time><code>c363fda85</code><span>Made announcements and hidden-control focus recovery deterministic.</span></li>
      <li><time datetime="2026-07-15">Jul 15</time><code>192bcc00c</code><span>Replaced scale-based FLIP with a cancelable, translation-only layout pass and added interruption, focus, and reduced-motion checks.</span></li>
      <li><time datetime="2026-07-16">Jul 16</time><code>9fa9403e4</code><span>Put the opening clip on the same clock, removed competing content keyframes and image zoom, cleaned up finished WebKit animations, and verified 44-pixel actions across the responsive matrix.</span></li>
    </ol>
    <p>Replay note: I attempted <code>15d94c048</code> in a detached exact-commit worktree on Jul 16, 2026. Its pinned historical Docker/Jekyll environment did not finish a build within a bounded four-minute run, leaving no faithful page to inspect or capture.</p>
    <p>The accepted refinement removes nonuniform content scaling, sibling shrink, expanded-image zoom, staggered content keyframes, and the double scroll correction. Closing changes the semantic state immediately; the ordinary collapsed-card hover lift remains.</p>
  </div>
</details>

<aside class="site-experiment-reproduce" aria-labelledby="ikea-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="ikea-reproduce-title">Keep one source of motion truth.</h2>
  <p>The guide includes the state machine, translation-only FLIP loop, clipped reveal, interruption behavior, focus contract, and responsive checks.</p>
  <div class="project-case-actions">
    <a href="{{ '/assets/downloads/site-experiments/ikea-project-cards-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
  </div>
</aside>
