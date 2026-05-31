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
  <p>
    <strong>Join me as a Spooder-Man.</strong>
    A tiny, ridiculous invitation to turn rejection, taste, and website craft into something other people can remix.
  </p>
  <a href="{{ '/projects/hci-spooder-man/' | relative_url }}">
    <span>Join the Spooder-Verse</span>
    <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
  </a>
</section>
