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
      text: Turn messy traces into evidence for the next design move.
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
      text: Let assistance change shape around people, tasks, tools, and physical context.
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
    <p class="project-case-kicker">Personal site redesign · teaching artifact · living system</p>
    <h1>Vibe-Coding a Research Portfolio</h1>
    <p class="project-case-lede">
      My old site listed projects and papers, but it did not tell visitors what I was actually studying. I rebuilt the homepage around one research question, reviewed each pass in screenshots, and gave the most useful site experiments their own case studies and reusable briefs.
    </p>
    <div class="project-case-facts">
      <span>Old homepage saved</span>
      <span>Research question first</span>
      <span>Screenshot review</span>
      <span>Reusable project notes</span>
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
    <p>The old site had the work, but visitors still had to guess the question connecting it and what to open first.</p>
  </div>
  <div>
    <span>What</span>
    <p>The homepage now leads with my research question, then routes people to papers, projects, writing, and playful experiments.</p>
  </div>
  <div>
    <span>How</span>
    <p>I made small Codex-assisted passes, checked fixed screenshots, kept what clarified the story, and wrote down the rules worth reusing.</p>
  </div>
</section>

## Archive, redesign, living system

The two saved frames show where the redesign started and one later checkpoint. The live homepage shows where it is now.

<ol class="project-story-beats" aria-label="Website revamp story">
  <li class="project-story-beat">
    <p class="project-case-kicker">Archive</p>
    <h3>Save the page I was redesigning.</h3>
    <p>The <a href="https://web.archive.org/web/20260209013429/https://dylantao.github.io/" target="_blank" rel="noopener noreferrer">Wayback capture from February 9, 2026 at 01:34:29 UTC</a> shows the older homepage visitors actually saw. The 1440 × 1000 PNG entered this repository at <a href="https://github.com/DylanTao/dylantao.github.io/commit/e4f021520f05eba9a21a62366ca52443b801fd97"><code>e4f021520</code></a>; the exact historical site commit that produced it was not preserved.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Research-first redesign</p>
    <h3>Put the research question before the decoration.</h3>
    <p>The May redesign brought the research claim, affiliation, proof routes, and next actions together. A later PNG records the warmer paper-and-desk direction; the file last changed on June 16 at <a href="https://github.com/DylanTao/dylantao.github.io/commit/d5c6365099eb97f72c779cc6dd0e031de44d89ac"><code>d5c636509</code></a>, but its capture date was not recorded.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Living artifact system</p>
    <h3>Give each experiment its own page.</h3>
    <p>The homepage now points to separate stories for the desk, publication map, project-card motion, build evidence, rejection receipts, and Dogtor journey. The <a href="{{ '/' | relative_url }}">live route</a> is the current state; each screenshot is only a dated checkpoint.</p>
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
    <figcaption><strong>Artifact stage · repository change June 16.</strong> This 1440 × 1100 file last changed at <code>d5c636509</code>. It documents a historical checkpoint before the current homepage; its capture date was not recorded.</figcaption>
  </figure>
</section>

<aside class="project-story-note" aria-labelledby="website-evidence-boundary-title">
  <p class="project-case-kicker">Evidence boundary</p>
  <h2 id="website-evidence-boundary-title">What the two frames show</h2>
  <p>The comparison documents a shift toward a clearer research claim and closer proof routes. Missing viewport, theme, interaction, browser, and DPR metadata limit it to design history rather than an A/B or usability result.</p>
</aside>

## How I actually worked

Codex made small implementation passes fast. I still decided what the page should say, inspected fixed screenshots as different visitors, and simplified anything that looked impressive but made the story harder to read.

Donald Schön describes a similar loop in [_The Reflective Practitioner_](https://www.hachettebookgroup.com/titles/donald-a-schon/the-reflective-practitioner/9780465068784/): a designer acts, notices what the situation says back, and reframes the next move. Here, the rendered website was what talked back.

<div class="project-storyboard" role="list" aria-label="Website critique loop">
  <article class="project-storyboard-step" role="listitem">
    <h3>Put the research question first.</h3>
    <p>The homepage states what I study before asking anyone to parse a long biography.</p>
  </article>
  <article class="project-storyboard-step" role="listitem">
    <h3>Make motion explain a change.</h3>
    <p>The interactive sketch shows design, evaluation, and situated assistance as different lenses instead of moving only for decoration.</p>
  </article>
  <article class="project-storyboard-step" role="listitem">
    <h3>Keep the useful critique.</h3>
    <p>When a critique kept helping across pages, I added it to the living heuristics file for the next design session.</p>
  </article>
</div>

## The motion sketch

Stripe's homepage showed me how a small control and a calm visual could support a claim without taking over the page. Katie Dill's writing on craft and the AI in Design 2026 report sharpened why I cared: when AI makes many versions cheap, choosing and critiquing them matters more.

<div class="home-page website-revamp-motion-demo">
  {% include home/research_motion.liquid section_id='website-revamp-motion' section_key='website-revamp-motion' %}
</div>

## Follow the child experiments

This page tells the overall redesign. Each experiment below has its own origin, changes, evidence, and reproduction notes, so I link to those stories instead of repeating them here.

<nav class="project-storyboard" data-website-child-experiments aria-label="Website revamp child experiments">
  <article class="project-storyboard-step">
    <h3><a href="{{ '/projects/homepage-desk-scene/' | relative_url }}">Desk</a></h3>
    <p>One identity across a fast 2D collage and an exploratory 3D room.</p>
  </article>
  <article class="project-storyboard-step">
    <h3><a href="{{ '/projects/build-rhythm/' | relative_url }}">Build Rhythm</a></h3>
    <p>Cadence, the repo token rhythm, and one rounded lifetime checkpoint kept on separate clocks.</p>
  </article>
  <article class="project-storyboard-step">
    <h3><a href="{{ '/projects/paper-constellation/' | relative_url }}">Paper Constellation</a></h3>
    <p>The same publication graph becomes a desktop atlas and a mobile trail.</p>
  </article>
  <article class="project-storyboard-step">
    <h3><a href="{{ '/projects/scholar-lens/' | relative_url }}">Scholar Lens</a></h3>
    <p>One paper key coordinates its bibliography row, lifetime citation chip, and dated annual bars.</p>
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
    <h3><a href="{{ '/projects/hci-spooder-man/' | relative_url }}">HCI Spooder-Man</a></h3>
    <p>A double-rejection meme became a small remix kit, with the serious receipt wall one link away.</p>
  </article>
  <article class="project-storyboard-step">
    <h3><a href="{{ '/projects/dogtor-portal/' | relative_url }}">Dogtor's portal</a></h3>
    <p>A clue, a truthful fruit choice, recovery, and explicit location consent.</p>
  </article>
</nav>

## Use the heuristics

The reusable artifact is a Markdown checklist. A COGS 125 student—or anyone redesigning a portfolio—can give it to an agent, ask for a critique using the same design values, and then decide which advice actually helps.

I built the file from screenshot notes and critiques that kept proving useful across iterations. It stays editable because the site and my judgment will keep changing.

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

This redesign borrows ideas, not assets, from work I admire: the AI in Design 2026 report, Katie Dill's writing and talks on craft, Stripe's interaction design, Jackie Hu's portfolio motion craft, and Donald Schön's reflective-practice framing. These links show where the design references came from.

<ul class="website-revamp-sources">
  <li><a href="https://stateofaidesign.com/" target="_blank" rel="noopener noreferrer">AI in Design 2026</a></li>
  <li><a href="https://stateofaidesign.com/chapters/craft" target="_blank" rel="noopener noreferrer">AI in Design 2026, Craft chapter</a></li>
  <li><a href="https://stripe.com/" target="_blank" rel="noopener noreferrer">Stripe homepage</a></li>
  <li><a href="https://jackiehu.design/" target="_blank" rel="noopener noreferrer">Jackie Hu portfolio</a></li>
  <li><a href="https://stripe.com/at/sessions/2024/craft-and-beauty-the-business-value-of-form-in-function" target="_blank" rel="noopener noreferrer">Katie Dill at Stripe Sessions</a></li>
  <li><a href="https://www.hachettebookgroup.com/titles/donald-a-schon/the-reflective-practitioner/9780465068784/" target="_blank" rel="noopener noreferrer">Donald A. Schön, <em>The Reflective Practitioner</em></a></li>
  <li><a href="https://web.archive.org/web/20260209013429/https://dylantao.github.io/" target="_blank" rel="noopener noreferrer">Wayback snapshot of the older site</a></li>
</ul>
