---
layout: page
title: projects
permalink: /projects/
description: "Research artifacts, prototypes, and studies that make questions concrete. Open a card to inspect the artifact, contribution, and links."
nav: true
nav_order: 2
panel_wide: true
display_categories: [research, fun]
horizontal: false
project_cards_interactive: true
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
  {% assign categorized_projects = site.projects | where: "category", category %}
  {% assign sorted_projects = categorized_projects | sort: "importance" %}
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
  {% endfor %}

{% else %}

<!-- Display projects without categories -->

{% assign sorted_projects = site.projects | sort: "importance" %}

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
<p class="project-inspiration-credit">
  Interaction note: card opening pattern inspired by <a href="https://www.ikea.com/global/en/stories/design/ikea-ps-2026-collection/" target="_blank" rel="noopener noreferrer">IKEA's PS 2026 collection story</a>; adapted here for an academic project browser.
</p>
</div>
