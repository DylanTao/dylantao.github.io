---
layout: page
title: The House in the Cliff
description: How the 3D home's house moved from a room on a rock to a two-floor home cut into a sandstone cliff, one review at a time.
img: assets/img/project_pics/homepage-desk-scene/house-in-the-cliff-teaser.webp
image_aspect: 16 / 9
card_avoid_scaling: true
importance: -35
category: fun
year: 2026
role: Designer, reviewer, client
status: Living site experiment
site_experiment: true
# A child of the 3D home: its build diary keeps every entry; this page holds the house's entries in full.
parent: homepage-desk-scene
debut_date: 2026-10-24T21:30:00-07:00
hide_title: true
cinematic: true
og_image: /assets/img/project_pics/homepage-desk-scene/house-in-the-cliff-teaser.jpg
og_image_alt: The 3D home's house cut away under its sandstone overhang, the upper floor's chaises above the double-height living room and its hanging fireplace
og_image_width: 1200
og_image_height: 675
---

<section class="project-case-hero site-experiment-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker"><a href="{{ '/projects/homepage-desk-scene/' | relative_url }}">The 3D home</a> · The house</p>
    <h1>The House in the Cliff</h1>
    <p class="project-case-lede">
      The house in my homepage's 3D world began as a room on a rock. It now sits eight metres inside a sandstone cliff above the Pacific, on two floors, with a library, a pool court and separate ways in. Each change below started with a render that looked wrong, to me or to the agents building it.
    </p>
    <div class="project-case-actions">
      <a href="{{ '/projects/homepage-desk-scene/' | relative_url }}#build-diary">Back to the build diary</a>
      <a href="{{ '/projects/homepage-desk-scene/record/' | relative_url }}#authoring">Read how it is built</a>
    </div>
  </div>
</section>

<section class="project-case-summary" aria-label="The House in the Cliff summary">
  <div><span>Why</span><p>A room on a pedestal reads as a stage set. I wanted a home you could believe was cut into a La Jolla cliff.</p></div>
  <div><span>What</span><p>Two floors carved from one continuous cliff, a glass front, a library and a pool court cut into the rock.</p></div>
  <div><span>How</span><p>The same camera before and after each change, measured contacts for every stair and route, and my review of the result.</p></div>
</section>

## How the house grew

These are the house's entries from the [build diary]({{ '/projects/homepage-desk-scene/' | relative_url }}#build-diary), with the details and extra views that did not fit there. The house is geometry, not a picture: Blender scripts build the cliff, the rooms, the furniture and the planting, and smaller refresh scripts change one part of the house without rebuilding the rest.

{% include build-diary.liquid stream="house" detail=true %}

## What is still open

The notes from my October 24 walk-through are with an agent now. Beside them, three problems from the retreat stay open on purpose, because the honest fixes need new geometry, not a better camera angle:

- **The bedroom is still a long walk from the library**, across a five-metre bridge. A stair beside the library needs its own chamber, new floor openings and fresh checks that people and P can still get through.
- **The excavated sandstone is angular.** Matching its colour to the cliff does not make it look eroded. Softer cliff transitions mean real new geometry that still holds up the pool and the terrace.
- **The laundry line still crosses the pool view.** Moving it means moving its posts, its cloth and the wind that moves it together, and it stays where it is until a matched view shows the move is better.

<details class="project-story-disclosure">
  <summary>How these comparisons were made</summary>
  <div class="project-story-disclosure-body">
    <ul>
      <li><strong>Browser frames.</strong> Most pairs are captures of the real page in Chromium at 1440 × 1000, with motion reduced and randomness seeded, so the two frames differ only by the change. The retreat's overview follows the house: its camera moves eight metres with it, so the coast shifts between the frames.</li>
      <li><strong>Blender previews.</strong> The plants and the bathroom are Eevee previews of the source file in the same room camera, before and after. They show placement and form, not the browser's night lighting.</li>
      <li><strong>Review screenshots.</strong> The September pedestal image is my own screenshot from a review, so it is not the camera of the frame beside it.</li>
      <li><strong>Custody.</strong> Each entry links its review notes and its commit. The original captures, measurements and failed attempts stay in the repository's <code>docs/evidence/</code> and <code>artwork/coastal-home/reviews/</code> folders.</li>
      <!-- Sirui: confirm -->
      <li><strong>Credit.</strong> Sirui Tao, with AI coding agents (Codex and Claude): the reviews, the geometry and their checks. Anthropic's Claude compiled this page from the review records for Sirui to review.</li>
    </ul>
  </div>
</details>

## Sources and credits

- Christopher Alexander and colleagues, _A Pattern Language_ (Oxford University Press, 1977): the Intimacy Gradient, Six-Foot Balcony and Half-Open Wall patterns behind the glass front, the terrace and the screens.
- Jay Appleton, _The Experience of Landscape_ (1975): prospect and refuge, why a cave mouth with a view feels good to sit in.
- Richard Kelly, "Lighting as an Integral Part of Architecture" (1952): the three kinds of light the house's lamps are layered by.

<details class="resource-folder project-story-disclosure">
  <summary>Open the evidence folder</summary>
  <div class="resource-folder__papers">
    <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/docs/design-reviews/2026-10-24/HOUSE_REVISION.md">House revision ↗</a>
    <a href="https://github.com/DylanTao/dylantao.github.io/tree/main/artwork/coastal-home/reviews/retreat-integration-2026-10-24">Retreat evidence ↗</a>
    <a href="https://github.com/DylanTao/dylantao.github.io/tree/main/docs/evidence/coastal-section">Two floors ↗</a>
    <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/bin/build_coastal_home.py">House builder ↗</a>
    <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/bin/build_diary_images.py">Diary images ↗</a>
  </div>
</details>
