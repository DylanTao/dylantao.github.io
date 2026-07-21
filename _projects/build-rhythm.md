---
layout: page
title: Build Rhythm
description: "A visual story of three building scales: a rounded lifetime snapshot, weekly GitHub change, and daily retained-token deltas."
img: assets/img/project_pics/site-experiments/build-rhythm-stage.png
image_aspect: 351 / 254
card_avoid_scaling: true
importance: -30
category: fun
site_experiment: true
debut_date: 2026-07-11T14:46:58-07:00
year: 2026
role: Designer, builder, reviewer
status: Site experiment
hide_title: true
---

<section class="project-case-hero site-experiment-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">Site experiment · first seen July 11, 2026</p>
    <h1>Build Rhythm</h1>
    <p class="project-case-lede">
      I wanted a quick way to see when work clustered, how this website compared with all retained Codex work, and where lifetime usage fits. Build Rhythm gives each signal its own clock, then lets a reader inspect the days and weeks that shaped it.
    </p>
    <div class="project-case-facts">
      <span>Weekly GitHub cadence</span>
      <span>Daily all-work / website deltas</span>
      <span>Rounded lifetime snapshot</span>
      <span>Accessible source tables</span>
    </div>
    <div class="project-case-actions">
      <a href="{{ '/github-activity/' | relative_url }}">Open Build Rhythm</a>
      <a href="{{ '/assets/downloads/site-experiments/build-rhythm-reproduction.md' | relative_url }}" download>Download reproduction MD</a>
    </div>
  </div>
  <figure
    class="project-case-media site-experiment-evidence-figure"
    data-evidence-kind="interface-anatomy-not-live-data"
    data-asset-revision-commit="c613c7b0f3ef96e51e63321ad0b914dbef9add5d"
    data-asset-revision-committed-at="2026-07-16T11:41:43-07:00"
    data-capture-date="not-retained"
    data-capture-viewport="not-retained"
    data-capture-theme="not-retained"
    data-capture-interaction-state="not-retained"
  >
    <img src="{{ '/assets/img/project_pics/site-experiments/build-rhythm-stage.png' | relative_url }}" alt="Earlier Build Rhythm token panel with a cumulative site estimate above a daily increase chart" loading="eager" width="702" height="508">
    <figcaption>Earlier single-scope anatomy, before the repeated cumulative figure became two endpoint summaries and one dual daily-delta chart. Asset revision <a href="https://github.com/DylanTao/dylantao.github.io/commit/c613c7b0f3ef96e51e63321ad0b914dbef9add5d"><code>c613c7b0f</code></a>; full provenance below.</figcaption>
  </figure>
</section>

<section class="project-case-summary" aria-label="Build Rhythm summary">
  <div><span>Why</span><p>Long logs hide the tempo of making: bursts, pauses, and shifts in scale.</p></div>
  <div><span>What</span><p>A concise scope guide, weekly GitHub explorer, and one daily comparison of all retained Codex work with this website.</p></div>
  <div><span>How</span><p>Explicit Y-axis transforms, hover and tap pinning, keyboard inspection, endpoint summaries, and native disclosure tables.</p></div>
</section>

## Why the page changed

The first public version was a GitHub workbench. Adding token evidence beside it muddied the scopes, so I separated the clocks. A later scroll story taught the same shapes that the explorer repeated below; the current version keeps its useful explanation as a short three-scope guide and reserves one figure for each distinct question.

<ol class="project-story-beats" aria-label="Build Rhythm turning points">
  <li class="project-story-beat">
    <p class="project-case-kicker">Spark</p>
    <h3>Make ordinary weeks readable.</h3>
    <p>The GitHub-only workbench at <a href="https://github.com/DylanTao/dylantao.github.io/commit/b4203f3eab8361f45ccf14bbe6f307b3f5a7f191"><code>b4203f3ea</code></a> began by making ordinary weeks visible. <a href="https://github.com/DylanTao/dylantao.github.io/commit/71b8f4c890f6d27b6c8da4b6f019af352c4882bd"><code>71b8f4c89</code></a> added Codex evidence beside it; that proximity exposed the need for a clearer story.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Turn</p>
    <h3>Separate the clocks.</h3>
    <p><a href="https://github.com/DylanTao/dylantao.github.io/commit/ed0d3ba40f2ed773c3242fabb8e6fc040a289742"><code>ed0d3ba40</code></a> split the GitHub and Codex horizons. At <a href="https://github.com/DylanTao/dylantao.github.io/commit/7e224db12c03c854924a282d66a91a6acafc9607"><code>7e224db12</code></a>, the lifetime view became one rounded, identity-free checkpoint.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Now</p>
    <h3>Compare daily work without repeating cumulative shapes.</h3>
    <p><a href="https://github.com/DylanTao/dylantao.github.io/commit/6edea07f4c81efe60f7b6efaa6652fc153de19ae"><code>6edea07f4</code></a> restored a rounded, repo-scoped token rhythm. The current pass adds a separately generated all-retained-work series, plots both as daily deltas, and keeps their cumulative endpoints in text.</p>
  </li>
</ol>

The exact-era screen at <a href="https://github.com/DylanTao/dylantao.github.io/commit/71b8f4c890f6d27b6c8da4b6f019af352c4882bd"><code>71b8f4c89</code></a> contains source-level daily history retired from the public dataset, so I keep that capture out of the case study. The commit records the structural turn; the current screenshot is an annotated anatomy of the accepted current state.

## How to read the rhythm

Three scopes, never one score. Each answers a different question and keeps its own unit, scope, and clock.

<section class="project-case-summary project-story-signal-grid" aria-label="How to read the three Build Rhythm signals">
  <div>
    <h3>GitHub cadence</h3>
    <p>Commits show when work clustered. Additions and deletions show the scale and direction of change.</p>
  </div>
  <div>
    <h3>Daily token rhythm</h3>
    <p>Two strict endpoints publish rounded cumulative points: all retained Codex work since June 19 and this website since May 22. The chart derives adjacent daily deltas and labels its Y-axis as LOG1P; retained evidence can revise either series.</p>
  </div>
  <div>
    <h3>Lifetime checkpoint</h3>
    <p>The direct tracker publishes a rounded lifetime Codex snapshot with its own observation date. It is never added to the repo-scoped estimate.</p>
  </div>
</section>

Earlier turns remain inspectable through source commits; a historical screenshot belongs here only when its runtime can be reproduced faithfully and its data still belongs in the public boundary.

<aside class="project-story-note project-story-note--privacy" aria-labelledby="build-rhythm-privacy-title">
  <p class="project-case-kicker">Privacy boundary</p>
  <h2 id="build-rhythm-privacy-title">What stays private</h2>
  <p>The page publishes rounded aggregates and two strict cumulative series. Source identities, paths, sessions, turns, models, raw events, and per-source history stay private.</p>
</aside>

## What _The Rhythm of Food_ changed

The first version began as a research-grounded activity workbench. John Thompson later shared [The Rhythm of Food](https://rhythm-of-food.net/) during our Autodesk HCI internship Wednesday design session, “Balancing Performance, Interactivity and Effort: SVG, Canvas, and WebGL.” The lesson I carried over was pacing: reveal one relationship at a time, then hand the reader the inspectable record. The current refinement also records the inverse lesson: when a teaching figure repeats the explorer below, concise prose can do the handoff with less ink. The visual language and implementation remain this site's own.

<details class="project-story-disclosure">
  <summary>Full technical revision record</summary>
  <div class="project-story-disclosure-body">
    <p><strong>Hero evidence:</strong> the current screenshot asset was committed July 16 at <code>c613c7b0f</code>. Its original viewport, theme, and interaction state were not retained, so it documents interface anatomy.</p>
    <ol class="site-experiment-ledger" aria-label="Build Rhythm iteration record">
      <li><time datetime="2026-07-11">Jul 11</time><code>b4203f3ea</code><span>Introduced the activity view with keyboard inspection, an exact table, and a privacy-safe fallback.</span></li>
      <li><time datetime="2026-07-12">Jul 12</time><code>71b8f4c89</code><span>Added Codex token history beside the GitHub view, creating the combined state that the next revision separated.</span></li>
      <li><time datetime="2026-07-12">Jul 12</time><code>ed0d3ba40</code><span>Separated the Codex and GitHub horizons after one combined overview implied a relationship the data could not support.</span></li>
      <li><time datetime="2026-07-13">Jul 13</time><code>d3f13be35</code><span>Removed causal and cost clutter so the evidence returned to cadence and change.</span></li>
      <li><time datetime="2026-07-14">Jul 14</time><code>1b07cea4c</code><span>Restored additions and deletions with readable and literal scales plus stronger responsive evidence.</span></li>
      <li><time datetime="2026-07-15">Jul 15</time><code>6b4b7bd59</code><span>Added a scroll-led reading that teaches cadence, magnitude, scale, and the separate Codex clock before handing control to the exact explorer.</span></li>
      <li><time datetime="2026-07-16">Jul 16</time><code>7e224db12</code><span>Replaced source-level lifetime history with one identity-free direct checkpoint.</span></li>
      <li><time datetime="2026-07-16">Jul 16</time><code>6edea07f4</code><span>Restored the rounded repo-scoped token rhythm within the current public boundary.</span></li>
    </ol>
  </div>
</details>

<aside class="site-experiment-reproduce" aria-labelledby="build-rhythm-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="build-rhythm-reproduce-title">Use your own aggregate record.</h2>
  <p>The downloadable guide covers the three-scope data boundary, explicit transforms, a dual daily inspector, accessible disclosures, reduced-motion state, and acceptance checks for another site.</p>
  <a href="{{ '/assets/downloads/site-experiments/build-rhythm-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>

## Credits

[The Rhythm of Food](https://rhythm-of-food.net/) was made by Google News Lab and Truth & Beauty. Thanks to [John Thompson](https://jrthomp.com/) for sharing it during the Autodesk HCI internship Wednesday design session and starting the conversation about storytelling across web rendering systems.
