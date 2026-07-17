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
      I built a small VRChat driving world around a social premise, not a solo score: someone drives, someone rides, and someone gets a good view of the chaos.
    </p>
    <div class="project-case-facts">
      <span>Driver</span>
      <span>Passenger</span>
      <span>Spectator</span>
      <span>AI-assisted prototyping</span>
    </div>
    <div class="project-case-actions">
      <a href="https://vrchat.com/home/launch?worldId=wrld_ef581bd6-9d93-457e-b6a3-7d7f297f1cab" target="_blank" rel="noopener noreferrer">Try it in VRChat</a>
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

The world is easier to understand as a small cast than as a feature list. Each role needs a different relationship to the same road, and none of them is merely waiting for the “real” interaction to begin.

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

## World design at room scale

The useful design question was not whether the world looked elaborate. It was whether a newcomer could find the action, choose a relationship to it, and make a moment with other people. That is the same judgment I care about in research tools: make the situation legible, then leave room for people to act.

AI tools helped with rough production, but the experience still depended on human choices about participation, paths, sightlines, and what should remain unscripted. This page does not turn that workflow into a claim that AI designed the world or caused a particular outcome.

<aside
  class="project-story-note"
  data-driver-teaser-kind="illustrative-concept-art"
  data-driver-runtime-capture="not-preserved"
  data-driver-historical-comparison="not-supported"
  aria-labelledby="driver-evidence-boundary-title"
>
  <p class="project-case-kicker">Evidence boundary</p>
  <h2 id="driver-evidence-boundary-title">The teaser is concept art, not a runtime screenshot.</h2>
  <p>The repository does not retain a capture manifest or an older reproducible world state, so there is no honest before-and-after comparison here. The role story describes the intended participation structure; it is not usage data, a playtest result, or evidence that every visitor behaved this way. The linked VRChat world is the current artifact to inspect.</p>
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
