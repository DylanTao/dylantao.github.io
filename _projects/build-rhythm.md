---
layout: page
title: Build Rhythm
description: "A page for seeing when I build: daily code activity by source, completed personal agent usage, and this site's separate daily token estimate."
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
design_story_class: sirui-editorial-story build-rhythm-story-page
ai_context:
  question: What can daily code and agent traces reveal about the cadence of making without turning activity into a productivity score?
  evidence:
    - Code history reports daily commits by named source and separates total commits from authored commits, merges, and deploys.
    - This site's rounded daily token rhythm comes from deduplicated retained logs attributed to this repo.
    - Completed personal agent days use a separate family-conserving Codex and Claude record with an independent date domain.
  boundary: The rhythms show bunching, scale, and quiet stretches; they do not establish productivity, quality, effort, or causality between code and agent use.
  reproduction:
    - Keep the three clocks separate and expose the exact source tables behind every chart.
    - Validate each source calendar and provenance tuple before rendering a history.
  source_urls:
    - https://dylantao.github.io/github-activity/
    - https://github.com/DylanTao/dylantao.github.io
    - https://rhythm-of-food.net/
---

<section class="project-case-hero site-experiment-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">Three rhythms, never one score</p>
    <h1>Build Rhythm</h1>
    <p class="project-case-lede">
      Build Rhythm reveals when my making bunches up and when it goes quiet. It cannot tell me whether a busy day was productive, whether a large change was good, or whether agent use caused code activity. Those limits are the reason the page keeps three clocks—and their exact tables—separate.
    </p>
    <p class="project-design-question"><span>Reading question</span> What can an activity trace help me notice without pretending to measure the quality of the work?</p>
    <div class="project-case-actions">
      <a href="{{ '/github-activity/' | relative_url }}">Open the live rhythms and tables</a>
      <a href="{{ '/assets/downloads/site-experiments/build-rhythm-reproduction.md' | relative_url }}" download>Download the reproduction guide</a>
    </div>
  </div>
  <figure
    class="project-case-media site-experiment-evidence-figure"
    data-paper-static-accent="waves"
    data-evidence-kind="interface-anatomy-not-live-data"
    data-asset-revision-commit="c613c7b0f3ef96e51e63321ad0b914dbef9add5d"
    data-asset-revision-committed-at="2026-07-16T11:41:43-07:00"
    data-capture-date="not-retained"
    data-capture-viewport="not-retained"
    data-capture-theme="not-retained"
    data-capture-interaction-state="not-retained"
  >
    <img src="{{ '/assets/img/project_pics/site-experiments/build-rhythm-stage.png' | relative_url }}" alt="Build Rhythm token panel showing a rounded cumulative site estimate above a rounded daily increase chart" loading="eager" width="702" height="508">
    <figcaption><strong>Annotated site-token chapter; interface anatomy, not live data.</strong> The image shows the cumulative site estimate above rounded daily growth. Its original viewport, theme, and interaction state were not retained. <span class="project-visual-credit">Visual field: <a href="https://shaders.paper.design/waves" target="_blank" rel="noopener noreferrer">Paper Shaders' Waves</a> by <a href="https://paper.design/" target="_blank" rel="noopener noreferrer">Paper</a>.</span></figcaption>
  </figure>
</section>

<section class="build-rhythm-conclusion" aria-labelledby="build-rhythm-conclusion-title">
  <p class="project-case-kicker">The conclusion</p>
  <h2 id="build-rhythm-conclusion-title">The shape is useful; the score would be fiction.</h2>
  <p>Bursts can help me remember a release, a deadline, or a long iteration loop. Quiet stretches can prompt a question. Neither one ranks the work. I use the charts to find a moment worth inspecting, then use the tables and source record to see what was actually counted.</p>
</section>

## Three questions, three clocks

Each chart answers one question at the reading speed its evidence can support. The live explorer keeps the exact, keyboard-readable table immediately behind the visual summary.

<ol class="build-rhythm-questions" aria-label="Questions answered by the three Build Rhythm charts">
  <li>
    <p class="project-case-kicker">Code cadence</p>
    <h3>When did the code work bunch up?</h3>
    <p>Reported commits mark active calendar labels. The quiet outer line is the reported total across visible sources. The crisp inner line is authored commits, and the soft band between them is merges and deploys. Added and deleted repository-text lines use only that authored subset's first-parent diffs.</p>
    <p class="build-rhythm-limit"><strong>It cannot establish:</strong> time spent, difficulty, quality, or whether a large diff mattered more.</p>
  </li>
  <li>
    <p class="project-case-kicker">Site-token rhythm</p>
    <h3>How did this website's retained build record grow?</h3>
    <p>Deduplicated retained logs attributed to this repo become rounded daily cumulative points. Differences between adjacent rounded points are estimates of rounded growth, not exact daily token use, and the history can change when the retained record changes.</p>
    <p class="build-rhythm-limit"><strong>It cannot establish:</strong> account lifetime, a bill, causal impact on code, or tokens that are no longer retained.</p>
  </li>
  <li>
    <p class="project-case-kicker">Personal agent days</p>
    <h3>What does the widest completed-day agent record show?</h3>
    <p>The tracker stacks Codex and Claude family totals on its own date domain. The shared exact family window begins July 29, while earlier Codex usage remains in the Codex baseline. This completed personal agent usage stays separate from the site estimate.</p>
    <p class="build-rhythm-limit"><strong>It cannot establish:</strong> per-account activity, the content of a session, or a relationship to any particular commit.</p>
  </li>
</ol>

<aside class="project-story-note project-story-note--privacy" aria-labelledby="build-rhythm-privacy-title">
  <p class="project-case-kicker">Privacy boundary</p>
  <h2 id="build-rhythm-privacy-title">The public view stops at agent family.</h2>
  <p>Account identities and per-account readings stay private. The agent plot exposes only sanitized Codex-versus-Claude family totals; this site's retained-log estimate remains a different series and is never added to it.</p>
</aside>

## Why the pacing changed

John Thompson shared [The Rhythm of Food](https://rhythm-of-food.net/) during a design session on balancing performance, interactivity, and effort across SVG, Canvas, and WebGL. The lesson I carried over was pacing: make one relationship legible, then let the reader inspect the record. I used that principle without copying its visual language or implementation.

<details class="project-story-disclosure">
  <summary>Receipts: why I separated the clocks</summary>
  <div class="project-story-disclosure-body">
    <p>An earlier version put GitHub activity and source-linked token history in one workbench. They looked like one story even though they used different evidence and clocks. The current version admits code history only after every declared source window validates, keeps the combined personal agent series on its own evidence boundary, and leaves this site's retained-log estimate separate.</p>
    <ol class="project-story-beats" aria-label="Build Rhythm turning points">
      <li class="project-story-beat">
        <p class="project-case-kicker">First version</p>
        <h3>I started with GitHub weeks.</h3>
        <p>The GitHub-only workbench at <a href="https://github.com/DylanTao/dylantao.github.io/commit/b4203f3eab8361f45ccf14bbe6f307b3f5a7f191"><code>b4203f3ea</code></a> made ordinary weeks visible: commits for cadence, line changes for scale. <a href="https://github.com/DylanTao/dylantao.github.io/commit/71b8f4c890f6d27b6c8da4b6f019af352c4882bd"><code>71b8f4c89</code></a> then placed Codex history beside it.</p>
      </li>
      <li class="project-story-beat">
        <p class="project-case-kicker">What went wrong</p>
        <h3>The side-by-side view blurred two different clocks.</h3>
        <p><a href="https://github.com/DylanTao/dylantao.github.io/commit/ed0d3ba40f2ed773c3242fabb8e6fc040a289742"><code>ed0d3ba40</code></a> pulled the GitHub and Codex views apart. At <a href="https://github.com/DylanTao/dylantao.github.io/commit/7e224db12c03c854924a282d66a91a6acafc9607"><code>7e224db12</code></a>, the public account view became one rounded checkpoint instead of a history that could expose its sources.</p>
      </li>
      <li class="project-story-beat">
        <p class="project-case-kicker">Current version</p>
        <h3>Each clock now carries only observations.</h3>
        <p><a href="https://github.com/DylanTao/dylantao.github.io/commit/6edea07f4c81efe60f7b6efaa6652fc153de19ae"><code>6edea07f4</code></a> brought back this site's rounded daily rhythm without folding it into account usage. The explorer keeps completed personal agent days in an independently dated inset that begins with its first observed day instead of stretching that shorter record across the lifetime code domain.</p>
      </li>
    </ol>
  </div>
</details>

<details class="project-story-disclosure">
  <summary>Receipts: full data and revision record</summary>
  <div class="project-story-disclosure-body">
    <p><strong>Hero evidence:</strong> the current screenshot asset was committed July 16 at <code>c613c7b0f</code>. Its original viewport, theme, and interaction state were not retained, so it documents interface anatomy.</p>
    <p><strong>Data contract:</strong> Three signals, never one score. Code history appears only after exact schema-5 source-calendar coverage validates for every named source. Personal uses GitHub profile author-date labels completed in <code>America/Los_Angeles</code>; contributed feeds use UTC labels, so matching labels do not pretend to be one shared 24-hour window. The personal agent layer accepts only sanitized family-conserving completed-day totals with a valid provenance tuple, and deduplicated retained logs attributed to this repo form the separate site rhythm.</p>
    <ol class="site-experiment-ledger" aria-label="Build Rhythm iteration record">
      <li><time datetime="2026-07-11">Jul 11</time><code>b4203f3ea</code><span>Introduced the activity view with keyboard inspection, an exact table, and a privacy-safe fallback.</span></li>
      <li><time datetime="2026-07-12">Jul 12</time><code>71b8f4c89</code><span>Added Codex token history beside the GitHub view, creating the crowded state that the next revision separated.</span></li>
      <li><time datetime="2026-07-12">Jul 12</time><code>ed0d3ba40</code><span>Separated the Codex and GitHub horizons after one overview implied a relationship the data could not support.</span></li>
      <li><time datetime="2026-07-13">Jul 13</time><code>d3f13be35</code><span>Removed causal and cost clutter so the evidence returned to cadence and change.</span></li>
      <li><time datetime="2026-07-14">Jul 14</time><code>1b07cea4c</code><span>Restored additions and deletions with readable and literal scales plus stronger responsive evidence.</span></li>
      <li><time datetime="2026-07-15">Jul 15</time><code>6b4b7bd59</code><span>Added a scroll-led reading that teaches cadence, magnitude, scale, and the separate Codex clock before handing control to the exact explorer.</span></li>
      <li><time datetime="2026-07-16">Jul 16</time><code>7e224db12</code><span>Replaced source-level account history with one identity-free direct checkpoint.</span></li>
      <li><time datetime="2026-07-16">Jul 16</time><code>6edea07f4</code><span>Restored the rounded repo-scoped token rhythm within the current public boundary.</span></li>
      <li><time datetime="2026-09-05">Sep 5</time><code>90e9f613b</code><span>Moved the encoding key into an HTML strip with the profile SVG's words, plainer panel headings, an olive intern band with a seam, and per-source readout cells.</span></li>
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

[The Rhythm of Food](https://rhythm-of-food.net/) was made by Google News Lab and Truth & Beauty. Thanks to [John Thompson](https://jrthomp.com/) for sharing it and starting the conversation about storytelling across web rendering systems.
