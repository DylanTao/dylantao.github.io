---
layout: page
title: Build Rhythm
description: "A privacy-safe story of how this site gets built: GitHub changes, rounded site-token rhythm, and a dated account-health check kept on honest, separate clocks."
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
      I wanted to make long patterns of building readable without turning busyness into merit. Build Rhythm separates three things that are easy to collapse—long-term GitHub cadence, a rounded daily repo-token estimate, and the latest dated anonymous quota-health observation—then keeps each signal’s clock, unit, and evidence visible.
    </p>
    <div class="project-case-facts">
      <span>Cadence, not productivity</span>
      <span>Aggregate data only</span>
      <span>Three sources, never one score</span>
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
  <div><span>What</span><p>A guided explorer for weekly GitHub cadence, a rounded daily repo-token rhythm, and one dated, complete observation of two-account Codex quota health.</p></div>
  <div><span>How</span><p>Each signal keeps its own unit and clock, with exact or explicitly rounded evidence available after the story.</p></div>
</section>

## Why this page had to change

The first public version was a GitHub workbench. As Codex evidence entered the page, keeping measures close together made comparison feel like explanation—even when the text said otherwise. I split the horizons, removed cost and causal theater, and later removed account-linked history altogether.

That privacy reset did not mean every token trace had to disappear. The current page restores only a rounded estimate attributable to retained sessions for this repo. It remains separate from the latest complete dated account-health observation and the longer GitHub record. The result is harder to collapse into one number, which is precisely the point.

<ol class="project-story-beats" aria-label="Build Rhythm turning points">
  <li class="project-story-beat">
    <p class="project-case-kicker">Spark</p>
    <h3>Make ordinary weeks readable.</h3>
    <p>The GitHub-only workbench at <a href="https://github.com/DylanTao/dylantao.github.io/commit/b4203f3eab8361f45ccf14bbe6f307b3f5a7f191"><code>b4203f3ea</code></a> began with cadence. <a href="https://github.com/DylanTao/dylantao.github.io/commit/71b8f4c890f6d27b6c8da4b6f019af352c4882bd"><code>71b8f4c89</code></a> then placed account-linked Codex history beside it, creating the combined view that needed to be untangled.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Turn</p>
    <h3>Separate the clocks, then reset the boundary.</h3>
    <p><a href="https://github.com/DylanTao/dylantao.github.io/commit/ed0d3ba40f2ed773c3242fabb8e6fc040a289742"><code>ed0d3ba40</code></a> split Codex and GitHub horizons. At <a href="https://github.com/DylanTao/dylantao.github.io/commit/7e224db12c03c854924a282d66a91a6acafc9607"><code>7e224db12</code></a>, account-linked history left the public record in favor of one anonymous health observation.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Now</p>
    <h3>Restore only what the repo evidence supports.</h3>
    <p><a href="https://github.com/DylanTao/dylantao.github.io/commit/6edea07f4c81efe60f7b6efaa6652fc153de19ae"><code>6edea07f4</code></a> brought back a rounded, repo-scoped token rhythm without restoring the account history removed earlier that day.</p>
  </li>
</ol>

The combined view can still be reproduced at <a href="https://github.com/DylanTao/dylantao.github.io/commit/71b8f4c890f6d27b6c8da4b6f019af352c4882bd"><code>71b8f4c89</code></a>, but its screen republishes the exact account-linked daily history and account-wide values that the privacy reset deliberately removed. I keep that capture out of the public artifact. Here, the exact source commit documents the structural turn; the current screenshot provides the visual anatomy without reopening the retired data boundary.

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
    <h3>Account observation</h3>
    <p>The latest complete dated observation reports separate anonymous counts for healthy accounts, fresh accounts, and accounts with quota data. The windows stay per-account and non-additive; one rounded personal checkpoint remains separately dated as one-account historical context.</p>
  </div>
</section>

The cards above are an annotated anatomy of the accepted current state. Earlier turns remain inspectable through their exact source commits; a historical screenshot belongs here only when its exact-era runtime and state can be reproduced faithfully and its data still belongs in the public boundary.

<aside class="project-story-note project-story-note--privacy" aria-labelledby="build-rhythm-privacy-title">
  <p class="project-case-kicker">Boundary</p>
  <h2 id="build-rhythm-privacy-title">What stays private</h2>
  <p>Within the Build Rhythm data, repository names; session, turn, model, path, account, and event-level identifiers; account aliases and plans; raw quota percentages; reset times; exact per-account usage; and daily account histories do not enter the public series. None of the visible measures is presented as an explanation of effort, quality, or cause.</p>
</aside>

## A pacing lesson, not a borrowed style

The first version began as a research-grounded activity workbench. John Thompson later shared [The Rhythm of Food](https://rhythm-of-food.net/) during our Autodesk HCI internship Wednesday design session, “Balancing Performance, Interactivity and Effort: SVG, Canvas, and WebGL.” The transferable lesson was pacing: reveal one relationship at a time, then hand the reader the exact record. This site adapts that narrative principle to aggregate build data without copying its visual language or code.

<details class="project-story-disclosure">
  <summary>Full technical revision record</summary>
  <div class="project-story-disclosure-body">
    <ol class="site-experiment-ledger" aria-label="Build Rhythm iteration record">
      <li><time datetime="2026-07-11">Jul 11</time><code>b4203f3ea</code><span>Introduced the activity view with keyboard inspection, an exact table, and a privacy-safe fallback.</span></li>
      <li><time datetime="2026-07-12">Jul 12</time><code>71b8f4c89</code><span>Added account-linked Codex token history beside the GitHub view, creating the combined state that the next revision separated.</span></li>
      <li><time datetime="2026-07-12">Jul 12</time><code>ed0d3ba40</code><span>Separated the Codex and GitHub horizons after one combined overview implied a relationship the data could not support.</span></li>
      <li><time datetime="2026-07-13">Jul 13</time><code>d3f13be35</code><span>Removed causal and cost clutter so the evidence returned to cadence and change.</span></li>
      <li><time datetime="2026-07-14">Jul 14</time><code>1b07cea4c</code><span>Restored additions and deletions with readable and literal scales plus stronger responsive evidence.</span></li>
      <li><time datetime="2026-07-15">Jul 15</time><code>6b4b7bd59</code><span>Added a scroll-led reading that teaches cadence, magnitude, scale, and the separate Codex clock before handing control to the exact explorer.</span></li>
      <li><time datetime="2026-07-16">Jul 16</time><code>7e224db12</code><span>Replaced account-linked token history with anonymous two-account quota-health counts, retaining only a clearly scoped one-account personal checkpoint as historical context.</span></li>
      <li><time datetime="2026-07-16">Jul 16</time><code>6edea07f4</code><span>Restored the token-over-time story as a rounded daily cumulative repo estimate from deduplicated retained logs, without restoring the account-linked history removed earlier that day.</span></li>
    </ol>
  </div>
</details>

<aside class="site-experiment-reproduce" aria-labelledby="build-rhythm-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="build-rhythm-reproduce-title">Use your own aggregate record.</h2>
  <p>The downloadable guide covers the three-source data boundary, narrative chapters, accessible evidence, reduced-motion state, and acceptance checks for another site.</p>
  <a href="{{ '/assets/downloads/site-experiments/build-rhythm-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>

## Credits

[The Rhythm of Food](https://rhythm-of-food.net/) was made by Google News Lab and Truth & Beauty. Thanks to [John Thompson](https://jrthomp.com/) for sharing it during the Autodesk HCI internship Wednesday design session and starting the conversation about storytelling across web rendering systems.
