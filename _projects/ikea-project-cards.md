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
  <figure class="project-case-media site-experiment-evidence-figure">
    <img src="{{ '/assets/img/project_pics/site-experiments/ikea-card-expanded.png' | relative_url }}" alt="Projects index with Paper Constellation expanded beside Build Rhythm while other project cards remain visible">
    <figcaption>One preview opens in place; the surrounding collection remains readable.</figcaption>
  </figure>
</section>

<section class="project-case-summary" aria-label="IKEA card experiment summary">
  <div><span>Question</span><p>How can visitors inspect one artifact without losing the shape of the project collection?</p></div>
  <div><span>Motion</span><p>One cancelable FLIP clock translates cards to their new positions while the active surface reveals inside a clip.</p></div>
  <div><span>Recovery</span><p>Escape, outside dismissal, close, focus restoration, polite status, and reduced motion all end in the same valid state.</p></div>
</section>

## Origin

The [IKEA PS 2026 collection story](https://www.ikea.com/global/en/stories/design/ikea-ps-2026-collection/) suggested a useful reading pattern: let one object open where it already lives, while the rest of the collection remains context. For an academic portfolio, that means the animation should preserve card identity and reveal evidence—not perform a product-launch flourish.

<ol class="site-experiment-ledger" aria-label="Project card iteration record">
  <li><time datetime="2026-05-27">May 27</time><code>15d94c048</code><span>Introduced the in-place card preview and first FLIP layout transition.</span></li>
  <li><time datetime="2026-05-27">May 27</time><code>ee95cc681</code><span>Added keyboard focus movement and recovery when a preview closes.</span></li>
  <li><time datetime="2026-05-27">May 27</time><code>fc5b8a444</code><span>Added project-specific accents and short takeaways, but also layered several competing motions.</span></li>
  <li><time datetime="2026-07-13">Jul 13</time><code>c363fda85</code><span>Made announcements and hidden-control focus recovery deterministic.</span></li>
  <li><time datetime="2026-07-15">Jul 15</time><code>192bcc00c</code><span>Replaced scale-based FLIP with a cancelable, translation-only layout pass and added interruption, focus, and reduced-motion checks.</span></li>
  <li><time datetime="2026-07-16">Jul 16</time><code>9fa9403e4</code><span>Put the opening clip on the same clock, removed competing content keyframes and image zoom, cleaned up finished WebKit animations, and verified 44-pixel actions across the responsive matrix.</span></li>
</ol>

The accepted refinement removes nonuniform content scaling, sibling shrink, expanded-image zoom, staggered content keyframes, and the double scroll correction. One 430 ms clock now translates cards and clips only the newly opening surface, cancels stale work when a visitor retargets, and performs one visibility check after settlement. Closing changes the semantic state immediately; reduced motion applies the same final layout without animation. The ordinary collapsed-card hover lift remains.

<aside class="site-experiment-reproduce" aria-labelledby="ikea-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="ikea-reproduce-title">Keep one source of motion truth.</h2>
  <p>The guide includes the state machine, translation-only FLIP loop, clipped reveal, interruption behavior, focus contract, and responsive checks.</p>
  <a href="{{ '/assets/downloads/site-experiments/ikea-project-cards-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>
