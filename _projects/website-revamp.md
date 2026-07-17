---
layout: page
title: Vibe-Coding a Research Portfolio
description: How an academic archive became a research-first portfolio, then a living system of inspectable site experiments and teaching artifacts.
img: assets/img/website-revamp/current-home-desktop.png
image_aspect: 1440 / 1100
card_image_fit: contain
card_image_position: top center
card_avoid_scaling: true
importance: -1
category: fun
site_experiment: true
debut_date: 2026-05-23T18:37:36-07:00
year: 2026
role: Designer, writer, reviewer
status: Living artifact system
hide_title: true
heuristics_preview: true
research_motion:
  eyebrow: Interactive artifact
  title: Play with the motion system.
  intro: "This is the same small research sketch from the homepage: change the research lens, then change the time-of-day theme to see how motion, color, and hierarchy stay connected."
  credit:
    text: Inspired by motion craft from
    stripe_label: Stripe's design team
    stripe_url: https://stripe.com/
    katie_label: Katie Dill at Stripe Sessions
    katie_url: https://stripe.com/at/sessions/2024/craft-and-beauty-the-business-value-of-form-in-function
  modes:
    - id: design
      label: Design
      title: Compare options
      text: Turn possible directions into a comparison people can reason with.
      detail_title: Human-AI for design and taste
      detail_text: >-
        This lens treats interface design as scaffolding for judgment: make the space
        of options legible enough that students can see what changed and why it matters.
      detail_points:
        - Turn vague vibes into inspectable variables.
        - Keep alternatives comparable before critique.
        - Use motion to show gathering, comparison, and reopening.
      detail_points_label: Moves
    - id: evaluate
      label: Evaluate
      title: Build -> measure
      text: Turn messy traces into evidence for the next design move.
      detail_title: Evidence before iteration
      detail_text: >-
        This lens asks what the artifact taught us after use: which traces, failures,
        and reactions should change the next version.
      detail_points:
        - Show probes and measures without making the page feel like a dashboard.
        - Connect speed with critique and reflection.
        - Keep evaluation close to the thing being evaluated.
      detail_points_label: Evidence loop
    - id: situated
      label: Situated
      title: Assist in context
      text: Let assistance change shape around people, tasks, tools, and physical context.
      detail_title: Context changes the shape of help
      detail_text: This lens keeps the interface grounded in the actual situation where people act, not only in a clean abstract workflow.
      detail_points:
        - Draw anchors for people, tasks, tools, and spaces.
        - Let pointer motion suggest context without snapping.
        - Keep assistance calm enough to stay usable.
      detail_points_label: Situations
---

<section class="project-case-hero website-revamp-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">Personal site redesign · teaching artifact · living system</p>
    <h1>Vibe-Coding a Research Portfolio</h1>
    <p class="project-case-lede">
      This site did not move from “bad” to “done.” It moved from an archive that made visitors assemble the story, through a research-first redesign, into a living system where each playful experiment has to explain why it exists and show the evidence it can actually support.
    </p>
    <div class="project-case-facts">
      <span>Archive evidence</span>
      <span>Research-first hierarchy</span>
      <span>Screenshot critique</span>
      <span>Living design heuristics</span>
    </div>
    <div class="project-case-actions">
      <a href="{{ '/' | relative_url }}">Open the live homepage</a>
      <a href="{{ '/WEBSITE_DESIGN_HEURISTICS.md' | relative_url }}" download>Download heuristics MD</a>
      <a href="{{ '/blog/2026/website-redesign-ai-agent/' | relative_url }}">Read the reflection</a>
      <a href="https://web.archive.org/web/20260209013429/https://dylantao.github.io/" target="_blank" rel="noopener noreferrer">Open the archive</a>
    </div>
  </div>
</section>

<section class="project-case-summary" aria-label="Website redesign summary">
  <div>
    <span>Why</span>
    <p>The archive contained the work, but a rushed visitor still had to infer the research thesis and decide what mattered.</p>
  </div>
  <div>
    <span>What</span>
    <p>A research-first portfolio whose homepage, case studies, and child experiments keep claims close to inspectable proof.</p>
  </div>
  <div>
    <span>How</span>
    <p>Plan, implement, inspect screenshots, critique from several visitor roles, remove weak decoration, and record the rule that survived.</p>
  </div>
</section>

## Archive, redesign, living system

The useful history is not a victory lap from “before” to “after.” Each state answered a different need, and the static frames can only document the moments they actually preserve.

<ol class="project-story-beats" aria-label="Website revamp story">
  <li class="project-story-beat">
    <p class="project-case-kicker">Archive</p>
    <h3>Keep the old page as evidence, not as a straw person.</h3>
    <p>The <a href="https://web.archive.org/web/20260209013429/https://dylantao.github.io/" target="_blank" rel="noopener noreferrer">Wayback capture from February 9, 2026 at 01:34:29 UTC</a> shows a real older homepage. The 1440 × 1000 PNG entered this repository at <a href="https://github.com/DylanTao/dylantao.github.io/commit/e4f021520f05eba9a21a62366ca52443b801fd97"><code>e4f021520</code></a>; the exact historical site commit that produced the archived page was not preserved.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Research-first redesign</p>
    <h3>Make the thesis easier to find than the decoration.</h3>
    <p>The May redesign moved the research claim, affiliation, proof routes, and next actions closer together. The legacy-named artifact-stage PNG later recorded the warmer paper-and-desk direction; the file last changed in the repository on June 16 at <a href="https://github.com/DylanTao/dylantao.github.io/commit/d5c6365099eb97f72c779cc6dd0e031de44d89ac"><code>d5c636509</code></a>, but its capture date was not recorded.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Living artifact system</p>
    <h3>Let each experiment carry its own story and boundary.</h3>
    <p>The homepage now points into separate experiments for the desk, publication map, project-card motion, build evidence, rejection receipts, and Dogtor journey. The <a href="{{ '/' | relative_url }}">live route</a> is the current state; a dated screenshot is a checkpoint, never a substitute for it.</p>
  </li>
</ol>

<section
  class="project-story-comparison"
  data-archive-wayback-timestamp="20260209013429"
  data-archive-artifact-size="1440x1000"
  data-archive-capture-date="2026-02-09T01:34:29Z"
  data-archive-repository-ingest-date="2026-05-23"
  data-archive-asset-ingest-commit="e4f021520f05eba9a21a62366ca52443b801fd97"
  data-archive-site-commit="not-preserved"
  data-archive-source-viewport="not-recorded"
  data-archive-theme="not-recorded"
  data-archive-interaction-state="not-recorded"
  data-june-artifact-size="1440x1100"
  data-june-artifact-commit="d5c6365099eb97f72c779cc6dd0e031de44d89ac"
  data-june-capture-date="not-recorded"
  data-june-repository-last-change-date="2026-06-16"
  data-june-source-viewport="not-recorded"
  data-june-theme="not-recorded"
  data-june-interaction-state="not-recorded"
  data-june-artifact-status="historical-checkpoint-not-current"
  aria-label="Archived homepage and June artifact-stage checkpoint"
>
  <figure class="project-case-media site-experiment-evidence-figure">
    <img src="{{ '/assets/img/website-revamp/old-home-wayback.png' | relative_url }}" alt="Wayback Machine capture of Sirui Tao's older homepage with a text-led introduction, portrait, and research cards" loading="lazy" width="1440" height="1000">
    <figcaption><strong>Archive · captured February 9.</strong> This 1440 × 1000 file preserves what Wayback served at 01:34:29 UTC. It entered this repository on May 23 at <code>e4f021520</code>; the originating site commit is unknown.</figcaption>
  </figure>
  <figure class="project-case-media site-experiment-evidence-figure">
    <img src="{{ '/assets/img/website-revamp/current-home-desktop.png' | relative_url }}" alt="Historical artifact-stage homepage image with a research-first introduction, portrait, paper cards, and desk-like proof artifacts" loading="lazy" width="1440" height="1100">
    <figcaption><strong>Artifact stage · repository change June 16.</strong> This 1440 × 1100 file last changed at <code>d5c636509</code>; its capture date was not recorded. It documents a historical checkpoint, not the current homepage.</figcaption>
  </figure>
</section>

<aside class="project-story-note" aria-labelledby="website-evidence-boundary-title">
  <p class="project-case-kicker">Evidence boundary</p>
  <h2 id="website-evidence-boundary-title">Two frames can show hierarchy, not prove causality.</h2>
  <p>The comparison supports a design-history reading: the research claim and proof routes became more prominent. It is not a controlled A/B test, a usability result, or a complete reconstruction of the old site. Source viewport, theme, and interaction state were not recorded for either artifact; the June file's capture date, browser, and device-pixel ratio are also unknown, so this page does not invent them.</p>
</aside>

## Taste as a loop

The most useful part of working with Codex was not that it could generate code quickly. It was that speed created more chances to practice judgment. I used Codex with high-reasoning, plan-first implementation loops: make a plan, implement a small pass, inspect screenshots, critique the page from several visitor roles, then simplify.

That loop is close to Donald Schön's idea in [_The Reflective Practitioner_](https://www.hachettebookgroup.com/titles/donald-a-schon/the-reflective-practitioner/9780465068784/): the designer acts, sees what the situation says back, and reframes the next move. In this project, the website itself became the material talking back.

<div class="project-storyboard" role="list" aria-label="Website critique loop">
  <article class="project-storyboard-step" role="listitem">
    <h3>Make the claim visible.</h3>
    <p>The homepage now says the research thesis before asking visitors to parse a long biography.</p>
  </article>
  <article class="project-storyboard-step" role="listitem">
    <h3>Use motion as explanation.</h3>
    <p>The interactive sketch maps to design, evaluation, and situated assistance instead of acting as decoration.</p>
  </article>
  <article class="project-storyboard-step" role="listitem">
    <h3>Record the rule.</h3>
    <p>Every critique that survived became part of a living heuristics file for future design sessions.</p>
  </article>
</div>

## The motion sketch

Stripe's homepage inspired the restraint: a compact control, a proof-like visual, and a calm relationship between claim and interaction. Katie Dill's craft framing and the AI in Design 2026 report helped sharpen the bigger point: when AI makes output cheap, taste, critique, and judgment become more important.

<div class="home-page website-revamp-motion-demo">
  {% include home/research_motion.liquid section_id='website-revamp-motion' section_key='website-revamp-motion' %}
</div>

## Follow the child experiments

This parent case study keeps the critique loop and archive. The experiments below own their own origin, evolution, evidence, and reproduction notes, so I link to them instead of flattening six different stories into one redesign recap.

<nav class="project-storyboard" data-website-child-experiments aria-label="Website revamp child experiments">
  <article class="project-storyboard-step">
    <h3><a href="{{ '/projects/homepage-desk-scene/' | relative_url }}">Desk</a></h3>
    <p>One identity across a fast 2D collage and an exploratory 3D room.</p>
  </article>
  <article class="project-storyboard-step">
    <h3><a href="{{ '/projects/build-rhythm/' | relative_url }}">Build Rhythm</a></h3>
    <p>Cadence, rounded token evidence, and account health kept on separate clocks.</p>
  </article>
  <article class="project-storyboard-step">
    <h3><a href="{{ '/projects/paper-constellation/' | relative_url }}">Paper Constellation</a></h3>
    <p>The same publication graph becomes a desktop atlas and a mobile trail.</p>
  </article>
  <article class="project-storyboard-step">
    <h3><a href="{{ '/projects/ikea-project-cards/' | relative_url }}">IKEA project cards</a></h3>
    <p>One cancelable motion clock opens a project without losing the collection.</p>
  </article>
  <article class="project-storyboard-step">
    <h3><a href="{{ '/projects/wall-of-rejection/' | relative_url }}">Wall of Rejection</a></h3>
    <p>A lab meme became a rejection-only receipt wall without a productivity score.</p>
  </article>
  <article class="project-storyboard-step">
    <h3><a href="{{ '/projects/dogtor-portal/' | relative_url }}">Dogtor's portal</a></h3>
    <p>A clue, a truthful fruit choice, recovery, and explicit location consent.</p>
  </article>
</nav>

## Use the heuristics

The reusable part is the markdown file. My hope is that students in COGS 125, or anyone redesigning a portfolio, can give it to their own agent and ask for a critique pass grounded in the same design values. Preview it here before downloading; it should stay a living document as the site keeps changing.

That file was built gradually during the redesign, distilled from my critiques, screenshot notes, and interface iterations where the site pushed back and made a design rule clearer.

{% include heuristics_preview.liquid %}

<details class="project-story-disclosure site-experiment-technical-details">
  <summary id="website-revamp-technical-summary">Artifact provenance and revision record</summary>
  <div class="project-story-disclosure-body" aria-labelledby="website-revamp-technical-summary">
    <ul>
      <li><strong>Archive artifact:</strong> <code>old-home-wayback.png</code>, 1440 × 1000, captured by Wayback at <code>20260209013429</code>; added to this repository on May 23 at <code>e4f021520</code>. The exact historical site commit, source viewport, theme, and interaction state are not retained.</li>
      <li><strong>Artifact-stage checkpoint:</strong> the legacy-named <code>current-home-desktop.png</code>, 1440 × 1100, last changed in this repository at <code>d5c636509</code> on June 16. Its capture date, source viewport, theme, and interaction state were not recorded. “Current” is a filename, not a status claim.</li>
      <li><strong>Current evidence:</strong> the live homepage and the linked child case studies. No static image on this page is labeled as a current capture.</li>
      <li><strong>Teaching artifact:</strong> <code>WEBSITE_DESIGN_HEURISTICS.md</code> keeps the durable critique rules; the companion reflection explains how the AI-assisted implementation loop was reviewed.</li>
    </ul>
    <ol class="site-experiment-ledger" aria-label="Website revamp evidence record">
      <li><time datetime="2026-02-09">Feb 9</time><code>Wayback</code><span>Archived the older public homepage at 01:34:29 UTC; its producing Git commit is unknown.</span></li>
      <li><time datetime="2026-05-23">May 23</time><code>e4f021520</code><span>Introduced the research-motion redesign checkpoint and ingested the 1440 × 1000 archive artifact.</span></li>
      <li><time datetime="2026-06-16">Jun 16</time><code>d5c636509</code><span>Last changed the 1440 × 1100 paper-and-desk artifact file that this page now labels as historical; its capture date is unknown.</span></li>
    </ol>
  </div>
</details>

## Credits

This redesign borrows ideas, not assets, from work I admire: the AI in Design 2026 report, Katie Dill's writing and talks on craft, Stripe's interaction design, Jackie Hu's portfolio motion craft, and Donald Schön's reflective-practice framing. The point of credit is not formality. It is a design habit: know where your taste came from.

<ul class="website-revamp-sources">
  <li><a href="https://stateofaidesign.com/" target="_blank" rel="noopener noreferrer">AI in Design 2026</a></li>
  <li><a href="https://stateofaidesign.com/chapters/craft" target="_blank" rel="noopener noreferrer">AI in Design 2026, Craft chapter</a></li>
  <li><a href="https://stripe.com/" target="_blank" rel="noopener noreferrer">Stripe homepage</a></li>
  <li><a href="https://jackiehu.design/" target="_blank" rel="noopener noreferrer">Jackie Hu portfolio</a></li>
  <li><a href="https://stripe.com/at/sessions/2024/craft-and-beauty-the-business-value-of-form-in-function" target="_blank" rel="noopener noreferrer">Katie Dill at Stripe Sessions</a></li>
  <li><a href="https://www.hachettebookgroup.com/titles/donald-a-schon/the-reflective-practitioner/9780465068784/" target="_blank" rel="noopener noreferrer">Donald A. Schön, <em>The Reflective Practitioner</em></a></li>
  <li><a href="https://web.archive.org/web/20260209013429/https://dylantao.github.io/" target="_blank" rel="noopener noreferrer">Wayback snapshot of the older site</a></li>
</ul>
