---
layout: page
permalink: /publications/
title: publications
description: Papers and workshop pieces, with the current design/HCI thread near the top.
nav: true
nav_order: 1
panel_wide: true
wall_of_rejection: true
---

<!-- _pages/publications.md -->

<!-- Bibsearch Feature -->

<div class="publication-intro">
  <p>
    I publish across HCI, computational design, graphics, and cognitive science. If you are new here, start with the selected papers and project pages; the full list below stays chronological.
  </p>
  <a class="publication-intro-link" href="{{ '/projects/' | relative_url }}">Open project notes</a>
</div>

{% include publications/wall_of_rejection.liquid %}

{% include bib_search.liquid %}

<div class="publications">

{% bibliography %}

</div>
