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
