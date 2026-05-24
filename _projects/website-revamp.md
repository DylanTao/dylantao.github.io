---
layout: page
title: Vibe-Coding a Research Portfolio
description: A reflective redesign of this website into a warmer, clearer research portfolio and a reusable design-heuristics guide for students.
img: assets/img/website-revamp/current-home-desktop.png
image_aspect: 16 / 9
importance: -1
category: fun
year: 2026
role: Designer, writer, reviewer
status: Living case study
hide_title: true
---

<section class="project-case-hero website-revamp-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">Personal site redesign - COGS 125 teaching artifact</p>
    <h1>Vibe-Coding a Research Portfolio</h1>
    <p class="project-case-lede">
      I redesigned this portfolio as a small reflective-practice experiment: use an AI coding agent for speed, then use design judgment to decide what deserved to stay.
    </p>
    <div class="project-case-facts">
      <span>Plan-first prompting</span>
      <span>Screenshot critique</span>
      <span>Design heuristics</span>
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
    <p>How can a personal academic website quickly teach visitors who I am, what I study, and where to go next?</p>
  </div>
  <div>
    <span>Process</span>
    <p>Work in loops: plan, implement, screenshot, critique, remove what feels decorative, and record the durable rule.</p>
  </div>
  <div>
    <span>Outcome</span>
    <p>A warmer research-first portfolio, a four-theme system, and a reusable heuristics file students can adapt.</p>
  </div>
</section>

## Before, after, and why it changed

The old site did its job, but it asked visitors to assemble the story themselves. The redesign tries to make the first glance more generous: research thesis first, proof close to the claim, and fewer visual elements that exist only because they look cool.

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

The most useful part of working with Codex was not that it could generate code quickly. It was that speed created more chances to practice judgment. I used high-reasoning, plan-first implementation loops: make a plan, implement a small pass, inspect screenshots, critique the page from several visitor roles, then simplify.

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

## Use the heuristics

The reusable part is the markdown file. My hope is that students in COGS 125, or anyone redesigning a portfolio, can give it to their own agent and ask for a critique pass grounded in the same design values.

<p class="website-revamp-cta">
  <a href="{{ '/WEBSITE_DESIGN_HEURISTICS.md' | relative_url }}" download>Download WEBSITE_DESIGN_HEURISTICS.md</a>
  <a href="{{ '/WEBSITE_DESIGN_HEURISTICS.md' | relative_url }}">Open the source file</a>
</p>

## Credits

This redesign borrows ideas, not assets, from work I admire: the AI in Design 2026 report, Katie Dill's writing and talks on craft, Stripe's interaction design, and Donald Schon's reflective-practice framing. The point of credit is not formality. It is a design habit: know where your taste came from.

<ul class="website-revamp-sources">
  <li><a href="https://stateofaidesign.com/" target="_blank" rel="noopener noreferrer">AI in Design 2026</a></li>
  <li><a href="https://stateofaidesign.com/chapters/craft" target="_blank" rel="noopener noreferrer">AI in Design 2026, Craft chapter</a></li>
  <li><a href="https://stripe.com/" target="_blank" rel="noopener noreferrer">Stripe homepage</a></li>
  <li><a href="https://stripe.com/at/sessions/2024/craft-and-beauty-the-business-value-of-form-in-function" target="_blank" rel="noopener noreferrer">Katie Dill at Stripe Sessions</a></li>
  <li><a href="https://web.archive.org/web/20260209013429/https://dylantao.github.io/" target="_blank" rel="noopener noreferrer">Wayback snapshot of the older site</a></li>
</ul>
