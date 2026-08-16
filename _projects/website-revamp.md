---
layout: page
title: Vibe-Coding a Research Portfolio
description: How I rebuilt an academic archive so visitors can find the research question, inspect the work, and reuse the design lessons.
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
status: Living portfolio
hide_title: true
design_story_class: sirui-editorial-story website-revamp-story
heuristics_preview: false
ai_context:
  question: How can an academic portfolio reveal the research question, design judgment, and evidence behind the work without making visitors read a development log?
  evidence:
    - A Wayback artifact preserves the public homepage served on February 9, 2026; its producing Git commit and capture environment are unknown.
    - A 1440 by 1100 repository artifact records the June paper-and-desk direction but not its capture date, viewport, theme, or interaction state.
    - The current route and child experiment pages are the live evidence; static screenshots are historical checkpoints.
  boundary: The before/after artifacts document design history, not an A/B test or usability result.
  reproduction:
    - Use the living WEBSITE_DESIGN_HEURISTICS.md as the review rubric.
    - Compare the same route, viewport, theme, and interaction state before and after a change.
  source_urls:
    - https://web.archive.org/web/20260209013429/https://dylantao.github.io/
    - https://github.com/DylanTao/dylantao.github.io
    - https://shaders.paper.design/
research_motion:
  eyebrow: Research sketch
  title: Try the research sketch.
  intro: "Change the research lens, then the time-of-day theme. The semantic drawing keeps explaining the idea while a quiet shader changes the field underneath it."
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
      text: Put several design options side by side so people can name what changed and choose what to test.
      detail_title: Human-AI for design and taste
      detail_text: >-
        This lens makes design options visible enough for students to compare what
        changed and decide why it matters.
      detail_points:
        - Name the variable behind a vague vibe.
        - Keep alternatives comparable before critique.
        - Use motion to show how options gather, compare, and reopen.
      detail_points_label: Moves
    - id: evaluate
      label: Evaluate
      title: Build -> measure
      text: Group traces, failures, and reactions so the next test starts from evidence.
      detail_title: Evidence before iteration
      detail_text: >-
        After someone uses the artifact, this lens asks which traces, failures, and
        reactions should change the next version.
      detail_points:
        - Show probes and measures in a readable editorial flow.
        - Connect speed with critique and reflection.
        - Keep evaluation close to the thing being evaluated.
      detail_points_label: Evidence loop
    - id: situated
      label: Situated
      title: Assist in context
      text: Move help toward the current person, task, tool, and place.
      detail_title: Context changes the shape of help
      detail_text: This lens designs help around the people, tasks, tools, and spaces where the work actually happens.
      detail_points:
        - Draw anchors for people, tasks, tools, and spaces.
        - Let pointer motion suggest context through gentle anchors.
        - Keep assistance calm enough to stay usable.
      detail_points_label: Situations
---

<section class="project-case-hero website-revamp-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">A website that learned to ask a better question</p>
    <h1>Vibe-Coding a Research Portfolio</h1>
    <p class="project-case-lede">
      My old site listed projects and papers, but it did not tell visitors what I was actually studying. I wanted the redesign to feel like me—curious, a little playful, and serious about evidence—while making the research question easier to find than the interface tricks.
    </p>
    <p class="project-design-question"><span>Design question</span> How can the site show both the work and the judgment that shaped it without asking people to read a development log?</p>
    <div class="project-case-actions">
      <a href="{{ '/' | relative_url }}">Open the live homepage</a>
      <a href="{{ '/WEBSITE_DESIGN_HEURISTICS.md' | relative_url }}" download>Download the heuristics</a>
      <a href="https://web.archive.org/web/20260209013429/https://dylantao.github.io/" target="_blank" rel="noopener noreferrer">Open the old site</a>
    </div>
  </div>
</section>

## Archive, redesign, ongoing experiments

The redesign did not arrive as one reveal. These are the three turns that changed what the site was for.

<ol
  class="project-story-beats website-revamp-turns"
  aria-label="Three turning points in the website redesign"
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
>
  <li class="project-story-beat website-revamp-turn">
    <div>
      <p class="project-case-kicker">1 · The archive made the problem visible</p>
      <h3>I could see the work, but not the thread.</h3>
      <p>The February archive is competent and crowded. Papers, projects, biography, and navigation all ask for attention at once. Saving that page gave me something concrete to critique instead of redesigning from memory.</p>
    </div>
    <figure class="project-case-media site-experiment-evidence-figure">
      <img src="{{ '/assets/img/website-revamp/old-home-wayback.png' | relative_url }}" alt="Wayback Machine capture of Sirui Tao's older homepage with a text-led introduction, portrait, and research cards" loading="lazy" width="1440" height="1000">
      <figcaption><strong>Archive · February 9, 2026.</strong> Wayback served this 1440 × 1000 artifact at 01:34:29 UTC. The source viewport, theme, interaction state, and producing commit were not retained.</figcaption>
    </figure>
  </li>
  <li class="project-story-beat website-revamp-turn">
    <div>
      <p class="project-case-kicker">2 · The research question became the front door</p>
      <h3>I made the thesis louder and the interface quieter.</h3>
      <p>The next direction brought my research claim, affiliation, proof routes, and a small number of actions into one reading order. Paper, desk objects, and motion stayed only when they helped a visitor understand how I design, evaluate, and situate AI tools.</p>
    </div>
    <figure class="project-case-media site-experiment-evidence-figure">
      <img src="{{ '/assets/img/website-revamp/current-home-desktop.png' | relative_url }}" alt="Historical homepage checkpoint with a research-first introduction, portrait, paper slips, and desk-like proof artifacts" loading="lazy" width="1440" height="1100">
      <figcaption><strong>Artifact stage · repository change June 16.</strong> This file records the warmer paper-and-desk direction, not today's live page. Its original capture conditions were not recorded.</figcaption>
    </figure>
  </li>
  <li class="project-story-beat website-revamp-turn">
    <div>
      <p class="project-case-kicker">3 · The experiments started telling their own stories</p>
      <h3>I stopped hiding the design thinking behind a history icon.</h3>
      <p>The live site now uses a quiet thread glint to point from an interaction back to its origin. If someone follows it, the project page explains the question, change, evidence, and limit—not merely the commits.</p>
      <nav data-website-child-experiments aria-label="Website experiments with their own stories">
        <a href="{{ '/projects/homepage-desk-scene/' | relative_url }}">Desk</a>,
        <a href="{{ '/projects/build-rhythm/' | relative_url }}">Build Rhythm</a>,
        <a href="{{ '/projects/paper-constellation/' | relative_url }}">Paper Constellation</a>,
        <a href="{{ '/projects/scholar-lens/' | relative_url }}">Scholar Lens</a>,
        <a href="{{ '/projects/ikea-project-cards/' | relative_url }}">project cards</a>,
        <a href="{{ '/projects/wall-of-rejection/' | relative_url }}">Wall of Rejection</a>,
        <a href="{{ '/projects/hci-spooder-man/' | relative_url }}">HCI Spooder-Man</a>, and
        <a href="{{ '/projects/dogtor-portal/' | relative_url }}">Dogtor's portal</a>.
      </nav>
    </div>
  </li>
</ol>

<aside class="project-story-note" aria-labelledby="website-evidence-boundary-title">
  <p class="project-case-kicker">What the comparison can say</p>
  <h2 id="website-evidence-boundary-title">It is design history, not an A/B test.</h2>
  <p>The frames document a shift toward a clearer research claim and closer proof routes. Missing viewport, theme, interaction, browser, and DPR metadata mean they cannot establish better usability on their own.</p>
</aside>

## Five principles I kept

The full heuristics file is a living teaching artifact, not a wall of rules to embed in every story. These five principles do most of the work:

<ol class="website-revamp-principles">
  <li><strong>Lead with the question.</strong> A visitor should understand what I study before decoding my biography or interface.</li>
  <li><strong>Spend attention once.</strong> Fewer type levels, containers, actions, and repeated explanations make the remaining choices feel intentional.</li>
  <li><strong>Make motion mean something.</strong> Movement should reveal a state, comparison, or path—and settle into an equally legible still frame.</li>
  <li><strong>Keep proof close.</strong> Put the paper, project, image, data, or limitation beside the claim it supports.</li>
  <li><strong>Render, notice, reframe.</strong> Compare fixed screenshots as a research peer, student, non-specialist, and collaborator; keep the change only if the story becomes clearer.</li>
</ol>

<p class="website-revamp-principle-links">
  <a href="{{ '/WEBSITE_DESIGN_HEURISTICS.md' | relative_url }}">Read the living source</a>
  <span aria-hidden="true">·</span>
  <a href="{{ '/WEBSITE_DESIGN_HEURISTICS.md' | relative_url }}" download>Download the Markdown</a>
  <span aria-hidden="true">·</span>
  <a href="{{ '/blog/2026/website-redesign-ai-agent/' | relative_url }}">Read my AI-assisted design reflection</a>
</p>

## A sketch for “Design, Evaluate, Situate.”

The 2D layer below explains three research moves. The new Dot Orbit field stays behind it: each mode changes spread, density, and tempo, but the words and semantic drawing still carry the idea. If WebGL disappears, nothing a visitor needs disappears with it.

<div class="home-page website-revamp-motion-demo">
  {% include home/research_motion.liquid section_id='website-revamp-motion' section_key='website-revamp-motion' %}
</div>

## The site is part of the practice

Codex made implementation passes fast; it did not decide what deserved attention. I used the rendered site as a shared object for reflection: I acted, noticed what the page made easy or awkward, and reframed the next move. That is close to Donald Schön's [_The Reflective Practitioner_](https://www.hachettebookgroup.com/titles/donald-a-schon/the-reflective-practitioner/9780465068784/), and it is also distributed cognition in a very practical sense—the screenshots, heuristics, browser states, code, and critique carried parts of the judgment across sessions. The goal is not a frozen style guide. It is stronger professional vision with each pass.

<details class="project-story-disclosure site-experiment-technical-details">
  <summary id="website-revamp-technical-summary">Receipts: captures, commits, and reproduction notes</summary>
  <div class="project-story-disclosure-body" aria-labelledby="website-revamp-technical-summary">
    <ul>
      <li><strong>Archive artifact:</strong> <code>old-home-wayback.png</code>, 1440 × 1000, captured by Wayback at <code>20260209013429</code>; added to this repository on May 23 at <code>e4f021520</code>. The exact historical site commit, source viewport, theme, and interaction state are not retained.</li>
      <li><strong>Artifact-stage checkpoint:</strong> the legacy-named <code>current-home-desktop.png</code>, 1440 × 1100, last changed at <code>d5c636509</code> on June 16. Its capture date and environment were not recorded. “Current” is a filename, not a status claim.</li>
      <li><strong>Current evidence:</strong> the live homepage and linked case studies. No static image on this page is labeled as a current capture.</li>
      <li><strong>Paper texture:</strong> generated deterministically from Paper Texture in <code>@paper-design/shaders@0.0.80</code>. The seed, parameters, output hash, generator, Apache license, and vendor hashes are stored beside the asset and dependency.</li>
      <li><strong>Review method:</strong> compare the same route, viewport, theme, and interaction state; keep the research meaning and signature phrases fixed; record what became clearer or harder to notice.</li>
    </ul>
    <ol class="site-experiment-ledger" aria-label="Website revamp evidence record">
      <li><time datetime="2026-02-09">Feb 9</time><code>Wayback</code><span>Archived the older public homepage at 01:34:29 UTC; its producing Git commit is unknown.</span></li>
      <li><time datetime="2026-05-23">May 23</time><code>e4f021520</code><span>Introduced the research-motion redesign checkpoint and ingested the archive artifact.</span></li>
      <li><time datetime="2026-06-16">Jun 16</time><code>d5c636509</code><span>Last changed the paper-and-desk artifact now labeled as historical; its capture date is unknown.</span></li>
    </ol>
  </div>
</details>

## Credits

This redesign borrows principles, not visual identities or assets, from work I admire. The static paper surface and quiet research substrate use [Paper Shaders](https://shaders.paper.design/) by [Paper](https://paper.design/); the founder's [design walkthrough](https://youtu.be/P06RgnUKX_I?si=7xfPgwCjDHvjVG46) sharpened the “less, but more intentional” pass.

Other important references are [AI in Design 2026](https://stateofaidesign.com/), its [craft chapter](https://stateofaidesign.com/chapters/craft), [Stripe](https://stripe.com/), [Jackie Hu's portfolio](https://jackiehu.design/), [Katie Dill at Stripe Sessions](https://stripe.com/at/sessions/2024/craft-and-beauty-the-business-value-of-form-in-function), Donald A. Schön's [_The Reflective Practitioner_](https://www.hachettebookgroup.com/titles/donald-a-schon/the-reflective-practitioner/9780465068784/), and the [Wayback snapshot](https://web.archive.org/web/20260209013429/https://dylantao.github.io/) that made the starting point inspectable.
