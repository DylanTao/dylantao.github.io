---
layout: page
title: Dogtor's Hidden Portal
description: Find the dog by the blog title, choose a fruit, and see whether it lets you through—without exposing what waits behind it.
img: assets/img/meme_dog.png
image_aspect: 1 / 1
card_image_fit: cover
card_image_position: center
importance: -25
category: fun
site_experiment: true
debut_date: 2026-05-13T19:41:53-07:00
year: 2026
role: Puzzle maker, builder
status: Hidden journey
hide_title: true
---

<section class="project-case-hero site-experiment-hero dogtor-project-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">Site experiment · first seen May 13, 2026</p>
    <h1>Dogtor’s Hidden Portal</h1>
    <p class="project-case-lede">
      There is a small dog next to the blog title. Click it, choose a fruit, and it may let you through. The joke also works with a keyboard, recovers cleanly after refresh, and asks before using precise location.
    </p>
    <div class="project-case-facts">
      <span>Dog-shaped clue</span>
      <span>Four fruit choices</span>
      <span>Refresh recovery</span>
      <span>Location consent</span>
    </div>
    <div class="project-case-actions">
      <a href="{{ '/blog/' | relative_url }}">Look for the dog</a>
      <a href="{{ '/assets/downloads/site-experiments/dogtor-portal-reproduction.md' | relative_url }}" download>Download reproduction MD</a>
    </div>
  </div>
  <figure
    class="project-case-media site-experiment-evidence-figure dogtor-project-portrait"
    data-artifact-type="public-clue-art"
    data-artifact-first-published="2026-05-13"
    data-artifact-sha256="11b59deb8de4fa08fe8b0485d6703813adeeef032c13f25ab741cbee55e11741"
    data-artifact-size="1024x1024"
    data-capture-viewport="not-applicable"
    data-capture-theme="not-applicable"
    data-capture-state="static-source-image"
  >
    <img src="{{ '/assets/img/meme_dog.png' | relative_url }}" alt="Illustrated corgi giving a playful sideways glance">
    <figcaption>
      The visible clue. The destination remains part of the discovery.
      <span class="project-story-provenance">Public source image · first published May 13, 2026 · 1024×1024 · viewport and theme not applicable</span>
    </figcaption>
  </figure>
</section>

<section class="project-case-summary" aria-label="Dogtor portal summary">
  <div><span>Why</span><p>I wanted to reward curious readers without making the blog depend on solving a puzzle.</p></div>
  <div><span>What</span><p>A dog-shaped clue opens a four-fruit gate, with truthful feedback for every choice.</p></div>
  <div><span>What changed</span><p>A brittle passphrase became visible fruit choices, then gained reliable recovery and explicit location consent.</p></div>
</section>

## Why hide a door at all?

The first version was a tiny dog-triggered passphrase dialog beside the blog title. I replaced the brittle answer with four visible fruits, made every response truthful, and kept the whole joke optional. Anyone who ignores the dog still gets the complete blog.

## What the visitor experiences

<ol class="project-storyboard dogtor-storyboard" aria-label="Privacy-safe Dogtor portal journey">
  <li class="project-storyboard-step">
    <svg class="dogtor-story-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.8 12s3.3-5.2 9.2-5.2 9.2 5.2 9.2 5.2-3.3 5.2-9.2 5.2S2.8 12 2.8 12Z"></path>
      <circle cx="12" cy="12" r="2.2"></circle>
    </svg>
    <h3>Notice the clue</h3>
    <p>The dog beside the blog title looks just out of place enough to invite a click. Readers who pass it by lose nothing.</p>
  </li>
  <li class="project-storyboard-step">
    <svg class="dogtor-story-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 7.2c4.2-2 7.4.6 7.4 5.1 0 5.1-3.6 8.5-7.4 8.5s-7.4-3.4-7.4-8.5C4.6 7.8 7.8 5.2 12 7.2Z"></path>
      <path d="M12 7.2c0-2.5 1.4-4 3.8-4.3M12.5 5.2c-1.6-1.3-3.1-1.4-4.6-.4"></path>
    </svg>
    <h3>Choose a fruit</h3>
    <p>The clue opens a keyboard-accessible dialog with four visible fruits. Every choice gets an honest response.</p>
  </li>
  <li class="project-storyboard-step">
    <svg class="dogtor-story-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 8.5A8 8 0 1 1 4.5 15"></path>
      <path d="M5 3.8v4.7h4.7"></path>
      <path d="M9 12.2h6"></path>
    </svg>
    <h3>Recover cleanly</h3>
    <p>Escape and Close return focus to the dog. A successful choice survives refresh and back navigation in the same tab.</p>
  </li>
  <li class="project-storyboard-step">
    <svg class="dogtor-story-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.8 19 5.6v5.3c0 4.4-2.8 7.9-7 10.3-4.2-2.4-7-5.9-7-10.3V5.6L12 2.8Z"></path>
      <path d="m8.8 11.8 2.1 2.1 4.4-4.5"></path>
    </svg>
    <h3>Ask before precision</h3>
    <p>The experience starts with approximate information. Precise location needs an explicit yes, and saying no still leaves the journey usable.</p>
  </li>
</ol>

<aside class="project-story-note project-story-note--privacy" aria-labelledby="dogtor-privacy-title">
  <p class="project-case-kicker">Public boundary</p>
  <h3 id="dogtor-privacy-title">Where the public story stops</h3>
  <p>The case study uses the dog clue and behavior visible before entry. Destination, access details, private writing, visitor records, and precise location remain outside the page.</p>
</aside>

<details class="project-story-disclosure">
  <summary>Full technical revision record</summary>
  <div class="project-story-disclosure-body">
    <ol class="site-experiment-ledger" aria-label="Dogtor portal iteration record">
      <li><time datetime="2026-05-13">May 13</time><code>Clue</code><span>Added the dog trigger, access dialog, private page shell, and illustrated clue.</span></li>
      <li><time datetime="2026-05-14">May 14</time><code>Globe</code><span>Added the globe and image-gallery experience behind the gate.</span></li>
      <li><time datetime="2026-07-03">Jul 3</time><code>Fruit</code><span>Replaced the brittle passphrase with four visible fruit choices and truthful confirmation.</span></li>
      <li><time datetime="2026-07-10">Jul 10</time><code>Recovery</code><span>Improved focus recovery, session persistence, direct-entry guidance, and precise-location consent.</span></li>
    </ol>
    <p>Exact source-commit links stay out of this public case study because those diffs also name the private route. The dated, visitor-visible behavior is enough to explain the evolution without weakening the discovery boundary.</p>
  </div>
</details>

<aside class="site-experiment-reproduce" aria-labelledby="dogtor-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="dogtor-reproduce-title">Keep the surprise hidden and the exit obvious.</h2>
  <p>The public guide covers the clue, dialog focus, same-tab recovery, locked direct-entry fallback, and privacy boundaries using placeholder content only.</p>
  <div class="project-case-actions">
    <a href="{{ '/assets/downloads/site-experiments/dogtor-portal-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
  </div>
</aside>

## Credit

The visible dog art is the clue. The globe’s public Earth texture is credited to NASA Earth Observatory inside the experience.
