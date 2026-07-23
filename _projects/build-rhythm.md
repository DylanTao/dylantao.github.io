---
layout: page
title: Build Rhythm
description: "A page for seeing when I build: weekly GitHub bursts, this site's daily token estimate, and one dated lifetime Codex total."
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
      Build Rhythm is where I go to see when the work bunches up. It shows five years of GitHub activity by week, this site's rounded token estimate by day, and one dated lifetime Codex total. The charts give me the shape; the tables keep the exact values close by.
    </p>
    <div class="project-case-facts">
      <span>Weekly GitHub cadence</span>
      <span>Daily repo-token estimate</span>
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
    <img src="{{ '/assets/img/project_pics/site-experiments/build-rhythm-stage.png' | relative_url }}" alt="Build Rhythm token panel showing a rounded cumulative site estimate above a rounded daily increase chart" loading="eager" width="702" height="508">
    <figcaption>Annotated site-token chapter: cumulative estimate above rounded daily growth. Asset revision <a href="https://github.com/DylanTao/dylantao.github.io/commit/c613c7b0f3ef96e51e63321ad0b914dbef9add5d"><code>c613c7b0f</code></a>; full provenance below.</figcaption>
  </figure>
</section>

<section class="project-case-summary" aria-label="Build Rhythm summary">
  <div><span>Why</span><p>I had plenty of logs, but no quick way to see the bursts and quiet stretches.</p></div>
  <div><span>What</span><p>Three separate views: GitHub weeks, this site's token days, and one lifetime checkpoint.</p></div>
  <div><span>How</span><p>Read the guided charts first, then open the keyboard-readable values behind them.</p></div>
</section>

## Why I rebuilt it

The first combined version put GitHub activity and token history in one workbench. They looked like one story even though they used different units and clocks. I split them: weeks for GitHub, days for this site, and one dated point for lifetime use.

<ol class="project-story-beats" aria-label="Build Rhythm turning points">
  <li class="project-story-beat">
    <p class="project-case-kicker">First version</p>
    <h3>I started with GitHub weeks.</h3>
    <p>The GitHub-only workbench at <a href="https://github.com/DylanTao/dylantao.github.io/commit/b4203f3eab8361f45ccf14bbe6f307b3f5a7f191"><code>b4203f3ea</code></a> made ordinary weeks visible: commits for cadence, line changes for scale. <a href="https://github.com/DylanTao/dylantao.github.io/commit/71b8f4c890f6d27b6c8da4b6f019af352c4882bd"><code>71b8f4c89</code></a> then placed Codex history beside it.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">What went wrong</p>
    <h3>The side-by-side view blurred two different clocks.</h3>
    <p><a href="https://github.com/DylanTao/dylantao.github.io/commit/ed0d3ba40f2ed773c3242fabb8e6fc040a289742"><code>ed0d3ba40</code></a> pulled the GitHub and Codex views apart. At <a href="https://github.com/DylanTao/dylantao.github.io/commit/7e224db12c03c854924a282d66a91a6acafc9607"><code>7e224db12</code></a>, the lifetime view became one rounded checkpoint instead of a history that could expose its sources.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Current version</p>
    <h3>Each signal gets its own view.</h3>
    <p><a href="https://github.com/DylanTao/dylantao.github.io/commit/6edea07f4c81efe60f7b6efaa6652fc153de19ae"><code>6edea07f4</code></a> brought back this site's rounded daily rhythm without folding it into the lifetime total. A visitor can now follow one clock at a time.</p>
  </li>
</ol>

## How to read the rhythm

Start with the question you have. Each chart uses the unit and clock that fit it.

<section class="project-case-summary project-story-signal-grid" aria-label="How to read the three Build Rhythm signals">
  <div>
    <h3>GitHub cadence</h3>
    <p><strong>When did the work bunch up?</strong> Commits mark active weeks. Added and deleted lines show how large each change was.</p>
  </div>
  <div>
    <h3>Site-token rhythm</h3>
    <p><strong>How did this website build grow?</strong> Retained logs attributed to this repo become rounded daily cumulative points. Day-to-day differences are estimates and can change when the retained record changes.</p>
  </div>
  <div>
    <h3>Lifetime checkpoint</h3>
    <p><strong>What is the widest view?</strong> The tracker publishes one rounded lifetime Codex total with its observation date. It stays separate from the site estimate.</p>
  </div>
</section>

<aside class="project-story-note project-story-note--privacy" aria-labelledby="build-rhythm-privacy-title">
  <p class="project-case-kicker">Privacy boundary</p>
  <h2 id="build-rhythm-privacy-title">What stays private</h2>
  <p>Earlier source-level history stays private; the current chart uses only the public repo-scoped estimate.</p>
</aside>

## What _The Rhythm of Food_ changed

John Thompson shared [The Rhythm of Food](https://rhythm-of-food.net/) during our Autodesk HCI internship Wednesday design session, “Balancing Performance, Interactivity and Effort: SVG, Canvas, and WebGL.” The lesson I carried over was pacing: show one relationship at a time, then let the reader inspect the record. I used that lesson without copying its visual language or implementation.

<details class="project-story-disclosure">
  <summary>Full technical revision record</summary>
  <div class="project-story-disclosure-body">
    <p><strong>Hero evidence:</strong> the current screenshot asset was committed July 16 at <code>c613c7b0f</code>. Its original viewport, theme, and interaction state were not retained, so it documents interface anatomy.</p>
    <p><strong>Data contract:</strong> Three signals, never one score. The lifetime module publishes a rounded lifetime Codex snapshot. Deduplicated retained logs attributed to this repo form the site rhythm. Differences between adjacent points are rounded increases rather than exact per-day usage.</p>
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
  <h2 id="build-rhythm-reproduce-title">Build it from your own aggregate record.</h2>
  <p>The guide covers the three data scopes, chart sequence, accessible tables, reduced-motion state, and checks I used on this page.</p>
  <a href="{{ '/assets/downloads/site-experiments/build-rhythm-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>

## Credits

[The Rhythm of Food](https://rhythm-of-food.net/) was made by Google News Lab and Truth & Beauty. Thanks to [John Thompson](https://jrthomp.com/) for sharing it during the Autodesk HCI internship Wednesday design session and starting the conversation about storytelling across web rendering systems.
