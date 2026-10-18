---
layout: page
title: projects
display_title: Projects.
permalink: /projects/
description: "Research artifacts, prototypes, and studies that make questions concrete. Open a card to inspect the artifact, contribution, and links."
nav: true
nav_order: 2
panel_wide: true
display_categories: [research, fun]
horizontal: false
project_cards_interactive: true
cinematic: true
---

<!-- pages/projects.md -->
<div class="projects">
<p class="sr-only" data-project-card-status aria-live="polite" aria-atomic="true"></p>
{% if site.enable_project_categories and page.display_categories %}
  <!-- Display categorized projects -->
  {% for category in page.display_categories %}
  {% assign category_label = category | capitalize %}
  <div class="project-category-heading">
    <a class="project-category-link" id="{{ category }}" href=".#{{ category }}">
      <h2 class="category">{{ category_label }}</h2>
    </a>
  </div>
  {% comment %} A project with a parent (Light Paths in the Graphics Lab) is listed on its parent's page, not here. {% endcomment %}
  {% assign categorized_projects = site.projects | where: "category", category | where_exp: "project", "project.parent == nil" %}
  {% assign sorted_projects = categorized_projects | sort: "importance" %}
  <!-- Generate cards for each project -->
  {% if category == 'fun' and page.project_cards_interactive %}
  {% assign site_experiments = categorized_projects | where: "site_experiment", true | sort: "debut_date" | reverse %}
  {% assign other_fun_projects = categorized_projects | where_exp: "project", "project.site_experiment != true" | sort: "importance" %}
  {% comment %}
    The experiments nest (2026-10-18): the website revamp holds the 3D home and the other site experiments,
    the 3D home holds the Graphics Lab, and the lab holds its experiments. Each level opens in place as a deck
    (assets/js/project-decks.mjs); the trail and #deck/<slug> say where the reader is.
  {% endcomment %}
  {% assign site_experiment_feature = false %}
  {% if site_experiments.size == 1 %}
    {% assign site_experiment_feature = true %}
  {% endif %}
  <section class="site-experiment-index" aria-labelledby="site-experiments-title" data-project-deck-stage>
    <div class="site-experiment-index-heading">
      <p class="project-case-kicker">A CHRONOLOGICAL DESIGN RECORD</p>
      <h3 id="site-experiments-title">Site experiments</h3>
      <p>
        I keep these site experiments on record so newer models can re-review the last best pass—and I keep only changes that survive screenshots, accessibility checks, and my own judgment.
      </p>
    </div>
    <nav class="project-deck-trail" aria-label="Where you are in the site experiments" data-project-deck-trail hidden>
      <ol></ol>
    </nav>
    <div class="project-card-grid project-deck-root" data-project-card-grid data-site-experiment-grid aria-label="Site experiments, newest first">
      {% for project in site_experiments %}
        {% include projects.liquid heading_level=4 deck_depth=1 deck_feature=site_experiment_feature %}
      {% endfor %}
    </div>
    <script>
      // A shared #deck/<slug> link opens its level before the first paint; project-decks.mjs takes over from here.
      (function () {
        var match = /^#deck\/([a-z0-9-]+)$/.exec(window.location.hash);
        var deck = match && document.querySelector('[data-project-deck="' + match[1] + '"]');
        if (!deck) return;
        var path = [];
        for (var node = deck; node; node = node.parentElement && node.parentElement.closest('[data-project-deck]')) path.unshift(node);
        document.documentElement.setAttribute('data-project-deck-path', path.map(function (item) { return item.getAttribute('data-project-deck'); }).join('/'));
        path.forEach(function (item, index) {
          item.classList.add('is-open');
          if (index === path.length - 1) item.classList.add('is-current');
          var kids = item.querySelector(':scope > [data-project-deck-children]');
          if (kids) kids.removeAttribute('hidden');
          Array.prototype.forEach.call(item.parentElement.children, function (sibling) {
            if (sibling !== item) sibling.classList.add('is-folded');
          });
        });
      })();
    </script>
  </section>
  {% if other_fun_projects.size > 0 %}
  <section class="project-subsection" aria-labelledby="other-fun-projects-title">
    <div class="project-subsection-heading">
      <h3 id="other-fun-projects-title">Other playful builds</h3>
    </div>
    <div class="project-card-grid" data-project-card-grid>
      {% for project in other_fun_projects %}
        {% include projects.liquid heading_level=4 %}
      {% endfor %}
    </div>
  </section>
  {% endif %}
  {% elsif page.horizontal %}
  <div class="container">
    <div class="row row-cols-1 row-cols-md-2">
    {% for project in sorted_projects %}
      {% include projects_horizontal.liquid %}
    {% endfor %}
    </div>
  </div>
  {% else %}
  {% if page.project_cards_interactive %}
  <div class="project-card-grid" data-project-card-grid>
  {% else %}
  <div class="row row-cols-1 row-cols-md-3">
  {% endif %}
    {% for project in sorted_projects %}
      {% include projects.liquid %}
    {% endfor %}
  </div>
  {% endif %}
  {% endfor %}

{% else %}

<!-- Display projects without categories -->

{% assign sorted_projects = site.projects | where_exp: "project", "project.parent == nil" | sort: "importance" %}

  <!-- Generate cards for each project -->

{% if page.horizontal %}

  <div class="container">
    <div class="row row-cols-1 row-cols-md-2">
    {% for project in sorted_projects %}
      {% include projects_horizontal.liquid %}
    {% endfor %}
    </div>
  </div>
  {% else %}
  {% if page.project_cards_interactive %}
  <div class="project-card-grid" data-project-card-grid>
  {% else %}
  <div class="row row-cols-1 row-cols-md-3">
  {% endif %}
    {% for project in sorted_projects %}
      {% include projects.liquid %}
    {% endfor %}
  </div>
  {% endif %}
{% endif %}
<div class="project-browser-origin">
  <a href="{{ '/projects/ikea-project-cards/' | relative_url }}">How this card view began</a>
</div>
<p class="project-inspiration-credit" id="project-index-end">
  Interaction note: card opening pattern inspired by <a href="https://www.ikea.com/global/en/stories/design/ikea-ps-2026-collection/" target="_blank" rel="noopener noreferrer">IKEA's PS 2026 collection story</a>; adapted here for an academic project browser.
</p>
</div>
