---
layout: page
title: Vibe-Coding a Research Portfolio
description: A reflective redesign of this website into a warmer, clearer research portfolio and a reusable design-heuristics guide for students.
img: assets/img/website-revamp/current-home-desktop.png
image_aspect: 16 / 9
card_image_fit: cover
card_image_position: top center
importance: -1
category: fun
year: 2026
role: Designer, writer, reviewer
status: Living case study
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
    <p class="project-case-kicker">Personal site redesign - COGS 125 teaching artifact</p>
    <h1>Vibe-Coding a Research Portfolio</h1>
    <p class="project-case-lede">
      I redesigned this portfolio over two days as a small reflective-practice experiment for COGS 125 students: use an AI coding agent for speed, then use design judgment to decide what deserved to stay.
    </p>
    <div class="project-case-facts">
      <span>Plan-first prompting</span>
      <span>Screenshot critique</span>
      <span>Design heuristics</span>
      <span>COGS 125 Winter 2026</span>
    </div>
    <div class="project-case-actions">
      <a href="{{ '/WEBSITE_DESIGN_HEURISTICS.md' | relative_url }}" download>Download heuristics MD</a>
      <a href="{{ '/blog/2026/website-redesign-ai-agent/' | relative_url }}">Read the reflection</a>
      <a href="https://web.archive.org/web/20260209013429/https://dylantao.github.io/" target="_blank" rel="noopener noreferrer">Old site snapshot</a>
    </div>
  </div>
  <div class="project-case-media">
    {% include figure.liquid loading="eager" path="assets/img/website-revamp/current-home-desktop.png" title="Current homepage after the redesign" alt="Current redesigned Sirui Tao homepage with a warm editorial layout" class="img-fluid" %}
  </div>
</section>

<section class="project-case-summary" aria-label="Website redesign summary">
  <div>
    <span>Question</span>
    <p>How can a personal academic website quickly teach visitors who I am, what I study, and where to go next while becoming useful for students?</p>
  </div>
  <div>
    <span>Process</span>
    <p>Work in loops: plan, implement, screenshot, critique, remove what feels decorative, and record the durable rule.</p>
  </div>
  <div>
    <span>Outcome</span>
    <p>A warmer research-first portfolio, a four-theme system, and a reusable heuristics file design students can adapt for their own AI-built portfolio sites.</p>
  </div>
</section>

## Before, after, and why it changed

The old site did its job, but it asked visitors to assemble the story themselves. The redesign tries to make the first glance more generous: research thesis first, proof close to the claim, and fewer visual elements that exist only because they look cool. I also wanted the process to be useful for my COGS 125: Advanced Interaction Design students in Winter 2026, especially students who are just starting to use AI to build portfolio websites for course projects.

<div class="website-revamp-gallery website-revamp-gallery-two">
  <figure>
    <img src="{{ '/assets/img/website-revamp/old-home-wayback.png' | relative_url }}" alt="Wayback Machine screenshot of the older homepage before the redesign">
    <figcaption>Before: useful information, but weaker first-glance hierarchy.</figcaption>
  </figure>
  <figure>
    <img src="{{ '/assets/img/website-revamp/current-home-desktop.png' | relative_url }}" alt="Screenshot of the redesigned homepage with research-first hierarchy">
    <figcaption>After: thesis, affiliation, actions, and proof live closer together.</figcaption>
  </figure>
</div>

## Taste as a loop

The most useful part of working with Codex was not that it could generate code quickly. It was that speed created more chances to practice judgment. I used Codex with high-reasoning, plan-first implementation loops: make a plan, implement a small pass, inspect screenshots, critique the page from several visitor roles, then simplify.

That loop is close to Donald Schon's idea of the reflective practitioner: the designer acts, sees what the situation says back, and reframes the next move. In this project, the website itself became the material talking back.

<div class="website-revamp-process">
  <div>
    <span>01</span>
    <strong>Make the claim visible.</strong>
    <p>The homepage now says the research thesis before asking visitors to parse a long biography.</p>
  </div>
  <div>
    <span>02</span>
    <strong>Use motion as explanation.</strong>
    <p>The interactive sketch maps to design, evaluation, and situated assistance instead of acting as decoration.</p>
  </div>
  <div>
    <span>03</span>
    <strong>Record the rule.</strong>
    <p>Every critique that survived became part of a living heuristics file for future design sessions.</p>
  </div>
</div>

## The motion sketch

Stripe's homepage inspired the restraint: a compact control, a proof-like visual, and a calm relationship between claim and interaction. Katie Dill's craft framing and the AI in Design 2026 report helped sharpen the bigger point: when AI makes output cheap, taste, critique, and judgment become more important.

<div class="home-page website-revamp-motion-demo">
  {% include home/research_motion.liquid section_id='website-revamp-motion' section_key='website-revamp-motion' %}
</div>

<div class="website-revamp-gallery">
  <figure>
    <img src="{{ '/assets/img/website-revamp/focus-section.png' | relative_url }}" alt="Research motion section showing mode controls, canvas animation, and detail panel">
    <figcaption>The motion section is a diagram first and an animation second.</figcaption>
  </figure>
  <figure>
    <img src="{{ '/assets/img/website-revamp/blog-polish.png' | relative_url }}" alt="Blog index screenshot with pinned card and cleaner reading layout">
    <figcaption>The blog became a clearer field-notes index, not a pile of posts.</figcaption>
  </figure>
</div>

## Follow-up: play with receipts

A later pass made two quieter pages more alive. The projects page borrowed the opening-card rhythm from IKEA's PS 2026 story: click a project, let it expand in place, keep the surrounding grid as context. It felt right for an academic project browser because the visitor can inspect one artifact without losing the rest of the collection.

The publications page went in a stranger direction: a small **Wall of Rejection** above the bibliography. It is rejection-only: short Steam-ish badges, click-to-open receipts, and a nerdy Spooder-Man XP joke from my post-UIST 2026 mood. The goal is not to track review productivity. It is to celebrate failure as part of research life without making the page feel like a leaderboard.

This is one of the moments where GenAI felt most creative to me. I could describe a half-formed joke, then use screenshots and the heuristics file to keep the joke native to the site: evidence close to the claim, restrained motion, theme-aware color, and no generic gaming skin.

Note to future me: not sure if this is taste, but I had great fun.

## Use the heuristics

The reusable part is the markdown file. My hope is that students in COGS 125, or anyone redesigning a portfolio, can give it to their own agent and ask for a critique pass grounded in the same design values. Preview it here before downloading; it should stay a living document as the site keeps changing.

That file was built gradually during the redesign, distilled from my critiques, screenshot notes, and interface iterations where the site pushed back and made a design rule clearer.

{% include heuristics_preview.liquid %}

## Credits

This redesign borrows ideas, not assets, from work I admire: the AI in Design 2026 report, Katie Dill's writing and talks on craft, Stripe's interaction design, and Donald Schon's reflective-practice framing. The point of credit is not formality. It is a design habit: know where your taste came from.

<ul class="website-revamp-sources">
  <li><a href="https://stateofaidesign.com/" target="_blank" rel="noopener noreferrer">AI in Design 2026</a></li>
  <li><a href="https://stateofaidesign.com/chapters/craft" target="_blank" rel="noopener noreferrer">AI in Design 2026, Craft chapter</a></li>
  <li><a href="https://stripe.com/" target="_blank" rel="noopener noreferrer">Stripe homepage</a></li>
  <li><a href="https://stripe.com/at/sessions/2024/craft-and-beauty-the-business-value-of-form-in-function" target="_blank" rel="noopener noreferrer">Katie Dill at Stripe Sessions</a></li>
  <li><a href="https://www.ikea.com/global/en/stories/design/ikea-ps-2026-collection/" target="_blank" rel="noopener noreferrer">IKEA PS 2026 collection story</a></li>
  <li><a href="{{ '/assets/img/website-revamp/wall-of-rejection-steam-reference.png' | relative_url }}">Local Wall of Rejection mockup</a></li>
  <li><a href="https://youtu.be/f_Pcu6wTzoA?si=2FKEbhC8hkqildqC" target="_blank" rel="noopener noreferrer">Spooder-Man trailer reference</a></li>
  <li><a href="https://web.archive.org/web/20260209013429/https://dylantao.github.io/" target="_blank" rel="noopener noreferrer">Wayback snapshot of the older site</a></li>
</ul>
