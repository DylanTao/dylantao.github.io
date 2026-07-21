---
layout: page
title: Not A Good Driver
description: "A VRChat social-play experiment organized around three ways into the same joke: driver, passenger, and spectator."
img: assets/img/project_pics/not-a-good-driver/not-a-good-driver-teaser.png
image_aspect: 3 / 2
card_image_fit: contain
card_avoid_scaling: true
importance: 0
category: fun
year: 2024
role: World builder
status: VRChat world
hide_title: true
---

<section class="project-case-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">VRChat world - social play experiment</p>
    <h1>Not A Good Driver</h1>
    <p class="project-case-lede">
      I built a small VRChat world around three ways into one joke: drive the road, share the ride, or watch the chaos unfold.
    </p>
    <div class="project-case-facts">
      <span>Driver</span>
      <span>Passenger</span>
      <span>Spectator</span>
      <span>AI-assisted prototyping</span>
    </div>
    <div class="project-case-actions">
      <a href="https://vrchat.com/home/launch?worldId=wrld_ef581bd6-9d93-457e-b6a3-7d7f297f1cab" target="_blank" rel="noopener noreferrer">Try it in VRChat</a>
      <a href="{{ '/assets/downloads/site-experiments/not-a-good-driver-reproduction.md' | relative_url }}" download>Download the role-map brief</a>
    </div>
  </div>
  <div class="project-case-media">
    {% include figure.liquid loading="eager" path="assets/img/project_pics/not-a-good-driver/not-a-good-driver-teaser.png" title="Not A Good Driver concept artwork" alt="Illustrative low-poly concept artwork with drivers on a winding suspended road and spectators watching from a cliff" class="img-fluid" %}
  </div>
</section>

<section class="project-case-summary" aria-label="Not A Good Driver summary">
  <div>
    <span>Why</span>
    <p>I wanted to learn how a lightweight virtual place can make a shared activity legible without explaining away the joke.</p>
  </div>
  <div>
    <span>What</span>
    <p>A winding social driving world with three participation roles: take the wheel, ride along, or watch the action unfold.</p>
  </div>
  <div>
    <span>How</span>
    <p>Use paths and sightlines to put moving action and social reaction in the same readable scene.</p>
  </div>
</section>

## One road, three ways into the joke

The world is easiest to understand as a small cast. Each role gets a different relationship to the same road and a real way to participate.

<div class="project-storyboard" data-driver-role-story role="list" aria-label="Driver passenger spectator story">
  <article class="project-storyboard-step" role="listitem">
    <h3>Driver · create the action</h3>
    <p>The driver commits to the route and gives everyone else something to follow. The road has to read quickly enough that steering, surprise, and recovery can become part of the social moment.</p>
  </article>
  <article class="project-storyboard-step" role="listitem">
    <h3>Passenger · share the ride</h3>
    <p>The passenger participates without owning the route. Riding close to the action creates room for reaction, conversation, and the pleasure of watching someone else's decisions arrive.</p>
  </article>
  <article class="project-storyboard-step" role="listitem">
    <h3>Spectator · make it a show</h3>
    <p>The spectator turns motion into a public event. A useful view lets someone understand the setup, anticipate trouble, and join the laugh without entering the vehicle.</p>
  </article>
</div>

<figure class="driver-role-map" data-evidence-kind="conceptual-role-and-sightline-anatomy">
  <svg viewBox="0 0 800 300" role="img" aria-labelledby="driver-role-map-title driver-role-map-description">
    <title id="driver-role-map-title">Driver, passenger, and spectator relationship map</title>
    <desc id="driver-role-map-description">A winding road carries a driver and passenger through the scene while a spectator lookout keeps the action visible.</desc>
    <path class="driver-role-map-road" d="M52 228C168 116 266 252 384 160S612 58 748 132"></path>
    <path class="driver-role-map-sightline" d="M651 92 452 157M651 92 542 118"></path>
    <g class="driver-role-map-stop driver-role-map-stop--driver" transform="translate(245 198)">
      <circle r="31"></circle>
      <path d="M-15 4h30l-5-13H-8L-15 4Zm4 0v8m22-8v8M-18 12h36"></path>
      <text x="0" y="53">DRIVER</text>
    </g>
    <g class="driver-role-map-stop driver-role-map-stop--passenger" transform="translate(390 151)">
      <circle r="31"></circle>
      <path d="M-12-7h24v17h-24zM-7-7v-7h14v7"></path>
      <text x="0" y="53">PASSENGER</text>
    </g>
    <g class="driver-role-map-stop driver-role-map-stop--spectator" transform="translate(651 92)">
      <circle r="31"></circle>
      <path d="M-17 4s6-11 17-11S17 4 17 4 11 15 0 15-17 4-17 4Z"></path>
      <circle cy="4" r="4"></circle>
      <text x="0" y="53">SPECTATOR</text>
    </g>
  </svg>
  <figcaption><strong>Design anatomy.</strong> The road creates action, the shared cab carries reaction, and the lookout turns both into a public scene.</figcaption>
</figure>

## World design at room scale

The design question was whether a newcomer could find the action, choose a role, and make a moment with other people. That is the same judgment I care about in research tools: make the situation legible, then leave room for people to act.

AI tools supported rough production; I shaped participation, paths, sightlines, and what remained unscripted.

<aside
  class="project-story-note"
  data-driver-teaser-kind="illustrative-concept-art"
  data-driver-runtime-capture="not-preserved"
  data-driver-historical-comparison="not-supported"
  aria-labelledby="driver-evidence-boundary-title"
>
  <p class="project-case-kicker">Evidence boundary</p>
  <h2 id="driver-evidence-boundary-title">What the surviving evidence supports</h2>
  <p>The teaser is illustrative concept art, and the linked VRChat world is the current artifact. Because no historical runtime capture survives, the role story describes design intent rather than observed player behavior.</p>
</aside>

<details class="project-story-disclosure">
  <summary id="driver-technical-summary">Artifact and provenance notes</summary>
  <div class="project-story-disclosure-body" aria-labelledby="driver-technical-summary">
    <ul>
      <li><strong>Live artifact:</strong> the page links to VRChat world <code>wrld_ef581bd6-9d93-457e-b6a3-7d7f297f1cab</code>.</li>
      <li><strong>Teaser:</strong> <code>not-a-good-driver-teaser.png</code> is 1536 × 1024 illustrative concept artwork, added to this repository at <code>9dcac07f0</code> on May 25, 2026.</li>
      <li><strong>Missing history:</strong> no exact historical world commit, runtime capture state, viewport, theme, or comparable earlier version is preserved in this repository.</li>
      <li><strong>AI scope:</strong> “AI-assisted prototyping” records the author's workflow description. No retained model, prompt, or controlled comparison supports a stronger causal claim.</li>
    </ul>
  </div>
</details>

<aside class="site-experiment-reproduce" aria-labelledby="driver-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="driver-reproduce-title">Design the view around the roles.</h2>
  <p>The reusable brief starts with control, co-presence, and spectating before it asks for scenery. It keeps the role map conceptual, requires live-world validation, and leaves unsupported history out.</p>
  <div class="project-case-actions">
    <a href="{{ '/assets/downloads/site-experiments/not-a-good-driver-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
  </div>
</aside>
