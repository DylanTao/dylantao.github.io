---
layout: page
permalink: /publications/
title: publications
description: Papers and workshop pieces, kept chronological.
nav: true
nav_order: 1
panel_wide: true
wall_of_rejection: true
publication_lens: true
---

<!-- _pages/publications.md -->

<!-- Bibsearch Feature -->

{% include publications/wall_of_rejection.liquid %}

<div class="publication-workbench" data-publication-workbench>
  <div class="publication-lens-column">
    {% include publications/scholar_lens.liquid %}
  </div>

  <div class="publication-list-column">
    {% include bib_search.liquid %}

    <div class="publications">

    {% bibliography %}

    </div>

  </div>
</div>

<section class="publication-spooder-cta" aria-label="Join the HCI Spooder-Man movement">
  <figure>
    <img src="{{ '/assets/img/project_pics/hci-spooder-man/hci-spooder-man-teaser.png' | relative_url }}" alt="HCI Spooder-Man group teaser" loading="lazy">
  </figure>
  <div>
    <p class="publication-spooder-cta-kicker">Spooder-Verse</p>
    <h2>Join the Spooder-Verse.</h2>
    <p>
      Bring your own playful academic website remix.
    </p>
    <div class="publication-spooder-cta-actions">
      <a href="{{ '/projects/hci-spooder-man/' | relative_url }}">
        <span>Join the Spooder-Verse</span>
        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
      </a>
    </div>
  </div>
</section>
