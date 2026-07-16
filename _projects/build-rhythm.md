---
layout: page
title: Build Rhythm
description: A privacy-safe activity view that keeps anonymous two-account Codex quota health separate from long-term GitHub build rhythm.
img: assets/img/project_pics/site-experiments/build-rhythm-stage.png
image_aspect: 3 / 2
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

<section class="project-case-hero site-experiment-hero site-experiment-hero-text">
  <div class="project-case-copy">
    <p class="project-case-kicker">Site experiment · first seen July 11, 2026</p>
    <h1>Build Rhythm</h1>
    <p class="project-case-lede">
      A public record of building cadence without pretending commits, changed lines, or account health measure productivity. The page keeps GitHub history and a dated, anonymous Codex quota-health observation on visibly different clocks, then lets visitors inspect the exact aggregate evidence.
    </p>
    <div class="project-case-facts">
      <span>Cadence, not productivity</span>
      <span>Aggregate data only</span>
      <span>Two measures, never one score</span>
      <span>Exact GitHub table</span>
    </div>
    <div class="project-case-actions">
      <a href="{{ '/github-activity/' | relative_url }}">Open Build Rhythm</a>
      <a href="{{ '/assets/downloads/site-experiments/build-rhythm-reproduction.md' | relative_url }}" download>Download reproduction MD</a>
    </div>
  </div>
</section>

<section class="project-case-summary" aria-label="Build Rhythm summary">
  <div><span>Question</span><p>How can a public activity page show cadence and change without turning them into a score?</p></div>
  <div><span>Evidence</span><p>Weekly commits, additions, and deletions stay separate from a dated, complete two-account quota-health observation; one rounded personal checkpoint remains labeled as one-account historical context.</p></div>
  <div><span>Boundary</span><p>No repository names, account identifiers, raw quota percentages, reset times, cost theater, causal claims, or productivity ranking.</p></div>
</section>

## Origin

The first version began as a research-grounded activity workbench. John Thompson later shared [The Rhythm of Food](https://rhythm-of-food.net/) during our Autodesk HCI internship Wednesday design session, “Balancing Performance, Interactivity and Effort: SVG, Canvas, and WebGL.” The transferable lesson was pacing: reveal one relationship at a time, then hand the reader the exact record. This site adapts that narrative principle to aggregate build data without copying its visual language or code.

## What the page protects

Commits describe cadence. Additions and deletions describe the magnitude and direction of a change. The direct Codex tracker counts anonymous accounts that were healthy, fresh, and able to report quota windows at one complete observation; those windows remain per-account and non-additive. A rounded personal lifetime checkpoint stays separately dated and scoped to one of two accounts. None of these measures explains quality or cause, so the interface keeps units, coverage, and provenance visible instead of morphing them into one synthetic score.

<ol class="site-experiment-ledger" aria-label="Build Rhythm iteration record">
  <li><time datetime="2026-07-11">Jul 11</time><code>b4203f3ea</code><span>Introduced the activity view with keyboard inspection, an exact table, and a privacy-safe fallback.</span></li>
  <li><time datetime="2026-07-12">Jul 12</time><code>ed0d3ba40</code><span>Separated the Codex and GitHub horizons after one combined overview implied a relationship the data could not support.</span></li>
  <li><time datetime="2026-07-13">Jul 13</time><code>d3f13be35</code><span>Removed causal and cost clutter so the evidence returned to cadence and change.</span></li>
  <li><time datetime="2026-07-14">Jul 14</time><code>1b07cea4c</code><span>Restored additions and deletions with readable and literal scales plus stronger responsive evidence.</span></li>
  <li><time datetime="2026-07-15">Jul 15</time><code>6b4b7bd59</code><span>Added a scroll-led reading that teaches cadence, magnitude, scale, and the separate Codex clock before handing control to the exact explorer.</span></li>
  <li><time datetime="2026-07-16">Jul 16</time><code>7e224db12</code><span>Replaced account-linked token history with anonymous two-account quota-health counts, retaining only a clearly scoped one-account personal checkpoint as historical context.</span></li>
</ol>

<aside class="site-experiment-reproduce" aria-labelledby="build-rhythm-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="build-rhythm-reproduce-title">Use your own aggregate record.</h2>
  <p>The downloadable guide covers the two-measure data boundary, narrative chapters, accessible explorer, reduced-motion state, and acceptance checks for another site.</p>
  <a href="{{ '/assets/downloads/site-experiments/build-rhythm-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>

## Credits

[The Rhythm of Food](https://rhythm-of-food.net/) was made by Google News Lab and Truth & Beauty. Thanks to [John Thompson](https://jrthomp.com/) for sharing it during the Autodesk HCI internship Wednesday design session and starting the conversation about storytelling across web rendering systems.
