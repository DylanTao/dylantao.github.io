---
layout: page
title: Build Rhythm
description: "A privacy-safe story of how this site gets built: GitHub changes, rounded site-token rhythm, and lifetime Codex usage kept on honest, separate clocks."
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
      I wanted to make long patterns of building readable without turning busyness into merit. Build Rhythm separates three things that are easy to collapse—long-term GitHub cadence, a rounded daily repo-token estimate, and one rounded lifetime Codex total—then keeps each signal’s clock and evidence visible.
    </p>
    <div class="project-case-facts">
      <span>Cadence, not productivity</span>
      <span>Aggregate data only</span>
      <span>Three signals, never one score</span>
      <span>Exact GitHub + rounded token tables</span>
    </div>
    <div class="project-case-actions">
      <a href="{{ '/github-activity/' | relative_url }}">Open Build Rhythm</a>
      <a href="{{ '/assets/downloads/site-experiments/build-rhythm-reproduction.md' | relative_url }}" download>Download reproduction MD</a>
    </div>
  </div>
  <figure class="project-case-media site-experiment-evidence-figure">
    <img src="{{ '/assets/img/project_pics/site-experiments/build-rhythm-stage.png' | relative_url }}" alt="Build Rhythm token panel showing a rounded cumulative site estimate above a rounded daily increase chart" loading="eager" width="702" height="508">
    <figcaption>The site-token chapter makes its estimate and rounding boundary visible before the full explorer.</figcaption>
  </figure>
</section>

<section class="project-case-summary" aria-label="Build Rhythm summary">
  <div><span>Why</span><p>A long activity record can reveal cadence, but activity alone cannot explain effort, quality, or cause.</p></div>
  <div><span>What</span><p>A guided explorer for weekly GitHub cadence, a rounded daily repo-token rhythm, and one rounded lifetime Codex checkpoint.</p></div>
  <div><span>How</span><p>Each signal keeps its own unit and clock, with exact or explicitly rounded evidence available after the story.</p></div>
</section>

## Why this page had to change

The first public version was a GitHub workbench. When token evidence arrived, placing everything together made proximity look like explanation—even though the measures ran on different clocks. I separated the views, removed cost and causal theater, and kept only the public aggregates each story actually needs.

The current page answers three different questions: when the repository changed, how its retained token trace accumulated, and what the rounded lifetime total is. The signals can share one story without becoming one score.

<ol class="project-story-beats" aria-label="Build Rhythm turning points">
  <li class="project-story-beat">
    <p class="project-case-kicker">Spark</p>
    <h3>Make ordinary weeks readable.</h3>
    <p>The GitHub-only workbench at <a href="https://github.com/DylanTao/dylantao.github.io/commit/b4203f3eab8361f45ccf14bbe6f307b3f5a7f191"><code>b4203f3ea</code></a> began by making ordinary weeks visible. <a href="https://github.com/DylanTao/dylantao.github.io/commit/71b8f4c890f6d27b6c8da4b6f019af352c4882bd"><code>71b8f4c89</code></a> added Codex evidence beside it; that proximity exposed the need for a clearer story.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Turn</p>
    <h3>Separate the clocks, then reset the boundary.</h3>
    <p><a href="https://github.com/DylanTao/dylantao.github.io/commit/ed0d3ba40f2ed773c3242fabb8e6fc040a289742"><code>ed0d3ba40</code></a> split the GitHub and Codex horizons. At <a href="https://github.com/DylanTao/dylantao.github.io/commit/7e224db12c03c854924a282d66a91a6acafc9607"><code>7e224db12</code></a>, the lifetime view became one rounded, identity-free checkpoint.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Now</p>
    <h3>Restore only what the repo evidence supports.</h3>
    <p><a href="https://github.com/DylanTao/dylantao.github.io/commit/6edea07f4c81efe60f7b6efaa6652fc153de19ae"><code>6edea07f4</code></a> restored a rounded, repo-scoped token rhythm while keeping it separate from the lifetime checkpoint.</p>
  </li>
</ol>

The exact-era screen at <a href="https://github.com/DylanTao/dylantao.github.io/commit/71b8f4c890f6d27b6c8da4b6f019af352c4882bd"><code>71b8f4c89</code></a> contains source-level daily history that the current public dataset no longer republishes, so I keep that capture out of the case study. The commit remains the provenance for the structural turn; the current screenshot shows the accepted anatomy without presenting that retired history as live data.

## How to read the rhythm

<section class="project-case-summary project-story-signal-grid" aria-label="How to read the three Build Rhythm signals">
  <div>
    <h3>GitHub cadence</h3>
    <p>Commits show when work clustered. Additions and deletions show magnitude and direction. They do not measure productivity or quality.</p>
  </div>
  <div>
    <h3>Site-token rhythm</h3>
    <p>Rounded cumulative points come from deduplicated retained logs attributed to this repo. Differences between adjacent points are rounded increases, not exact daily usage, and can revise with retained evidence.</p>
  </div>
  <div>
    <h3>Lifetime checkpoint</h3>
    <p>A rounded total combines the two lifetime readings. It keeps its own observation date and is never added to the repo-scoped estimate.</p>
  </div>
</section>

The cards above are an annotated anatomy of the accepted current state. Earlier turns remain inspectable through their exact source commits; a historical screenshot belongs here only when its exact-era runtime and state can be reproduced faithfully and its data still belongs in the public boundary.

<aside class="project-story-note project-story-note--privacy" aria-labelledby="build-rhythm-privacy-title">
  <p class="project-case-kicker">Boundary</p>
  <h2 id="build-rhythm-privacy-title">What stays private</h2>
  <p>The current page republishes only rounded aggregates and repo-scoped cumulative points. Its dataset omits source identities and source-level histories; session, model, path, and event details; reset times; and cost conversions. None of these measures explains effort, quality, or cause.</p>
</aside>

## A pacing lesson, not a borrowed style

The first version began as a research-grounded activity workbench. John Thompson later shared [The Rhythm of Food](https://rhythm-of-food.net/) during our Autodesk HCI internship Wednesday design session, “Balancing Performance, Interactivity and Effort: SVG, Canvas, and WebGL.” The transferable lesson was pacing: reveal one relationship at a time, then hand the reader the exact record. This site adapts that narrative principle to aggregate build data without copying its visual language or code.

<details class="project-story-disclosure">
  <summary>Full technical revision record</summary>
  <div class="project-story-disclosure-body">
    <ol class="site-experiment-ledger" aria-label="Build Rhythm iteration record">
      <li><time datetime="2026-07-11">Jul 11</time><code>b4203f3ea</code><span>Introduced the activity view with keyboard inspection, an exact table, and a privacy-safe fallback.</span></li>
      <li><time datetime="2026-07-12">Jul 12</time><code>71b8f4c89</code><span>Added Codex token history beside the GitHub view, creating the combined state that the next revision separated.</span></li>
      <li><time datetime="2026-07-12">Jul 12</time><code>ed0d3ba40</code><span>Separated the Codex and GitHub horizons after one combined overview implied a relationship the data could not support.</span></li>
      <li><time datetime="2026-07-13">Jul 13</time><code>d3f13be35</code><span>Removed causal and cost clutter so the evidence returned to cadence and change.</span></li>
      <li><time datetime="2026-07-14">Jul 14</time><code>1b07cea4c</code><span>Restored additions and deletions with readable and literal scales plus stronger responsive evidence.</span></li>
      <li><time datetime="2026-07-15">Jul 15</time><code>6b4b7bd59</code><span>Added a scroll-led reading that teaches cadence, magnitude, scale, and the separate Codex clock before handing control to the exact explorer.</span></li>
      <li><time datetime="2026-07-16">Jul 16</time><code>7e224db12</code><span>Replaced source-level lifetime history with one identity-free direct checkpoint.</span></li>
      <li><time datetime="2026-07-16">Jul 16</time><code>6edea07f4</code><span>Restored the rounded repo-scoped token rhythm without reopening the retired source-level history.</span></li>
    </ol>
  </div>
</details>

<aside class="site-experiment-reproduce" aria-labelledby="build-rhythm-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="build-rhythm-reproduce-title">Use your own aggregate record.</h2>
  <p>The downloadable guide covers the three-signal data boundary, narrative chapters, accessible evidence, reduced-motion state, and acceptance checks for another site.</p>
  <a href="{{ '/assets/downloads/site-experiments/build-rhythm-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>

## Credits

[The Rhythm of Food](https://rhythm-of-food.net/) was made by Google News Lab and Truth & Beauty. Thanks to [John Thompson](https://jrthomp.com/) for sharing it during the Autodesk HCI internship Wednesday design session and starting the conversation about storytelling across web rendering systems.
