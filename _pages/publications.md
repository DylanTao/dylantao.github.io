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
random_teasers: true
---

<!-- _pages/publications.md -->

{% assign spooder = site.data.spooder_man %}
{% capture spooder_teaser_paths %}
{% for teaser in spooder.teasers %}
{{ teaser | relative_url }}{% unless forloop.last %}|{% endunless %}
{% endfor %}
{% endcapture %}

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
  <figure data-random-teaser data-random-teasers="{{ spooder_teaser_paths | strip }}">
    <img src="{{ spooder.hero.teaser | relative_url }}" alt="HCI Spooder-Man remix teaser" loading="lazy">
  </figure>
  <div>
    <p class="publication-spooder-cta-kicker">Rejection side quest</p>
    <h2>Got a rejection? Give it a cape.</h2>
    <p>
      Keep the papers readable, then let the messy academic arc become a tiny, remixable website bit.
    </p>
    <div class="publication-spooder-cta-actions">
      <a href="{{ '/projects/hci-spooder-man/' | relative_url }}">
        <span>Open the remix guide</span>
        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
      </a>
    </div>
  </div>
</section>
