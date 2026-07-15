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
publication_constellation: true
publication_collection: true
random_teasers: true
---

<!-- _pages/publications.md -->

{% assign spooder = site.data.spooder_man %}
{% assign spooder_teaser_separator = '' %}
{% capture spooder_teaser_paths %}
{% for teaser in spooder.teasers limit: 7 %}
{{ spooder_teaser_separator }}{{ teaser | relative_url }}{% assign spooder_teaser_separator = '|' %}
{% endfor %}
{% endcapture %}

<!-- Bibsearch Feature -->

{% include publications/wall_of_rejection.liquid %}

<div class="publication-view-switcher" data-publication-view-switcher hidden>
  <div role="group" aria-label="Choose publication view">
    <button
      class="publication-view-button publication-view-button-active"
      type="button"
      data-publication-view-button="list"
      aria-controls="publication-list-view"
      aria-pressed="true"
    >
      <i class="fa-solid fa-list" aria-hidden="true"></i>
      <span>Paper List</span>
    </button>
    <button
      class="publication-view-button"
      type="button"
      data-publication-view-button="constellation"
      aria-controls="paper-constellation-view"
      aria-pressed="false"
    >
      <i class="fa-solid fa-circle-nodes" aria-hidden="true"></i>
      <span>Paper Constellation</span>
    </button>
  </div>
  <p class="sr-only" data-publication-view-status aria-live="polite">Paper List shown.</p>
</div>

<div class="publication-workbench" data-publication-workbench data-publication-view="list">
  <div class="publication-lens-column">
    {% include publications/scholar_lens.liquid %}
  </div>

  <div class="publication-list-column">
    <div id="publication-list-view" data-publication-view-panel="list">
      {% include bib_search.liquid %}

      <div class="publications">

      {% bibliography %}

      </div>
    </div>

    <div id="paper-constellation-view" data-publication-view-panel="constellation" hidden>
      {% include publications/paper_constellation.liquid %}
    </div>

  </div>
</div>

<section class="publication-spooder-cta" aria-label="Join the HCI Spooder-Verse">
  <figure data-random-teaser data-random-teasers="{{ spooder_teaser_paths | strip }}">
    <img src="{{ spooder.hero.teaser | relative_url }}" alt="HCI Spooder-Man remix teaser" loading="lazy">
  </figure>
  <div>
    <p class="publication-spooder-cta-kicker">Spooder-Verse</p>
    <h2>Join the nerdy Spooder-Verse.</h2>
    <p>Bring one real academic no; use the prompt and assets to make your own remix.</p>
    <div class="publication-spooder-cta-actions">
      <a href="{{ '/projects/hci-spooder-man/' | relative_url }}">
        <span>Get the spoody-suits</span>
        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
      </a>
    </div>
  </div>
</section>
