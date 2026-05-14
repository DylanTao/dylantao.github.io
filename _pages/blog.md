---
layout: default
permalink: /blog/
title: blog
nav: true
nav_order: 3
panel_wide: true
pagination:
  enabled: true
  collection: posts
  permalink: /page/:num/
  per_page: 5
  sort_field: date
  sort_reverse: true
  trail:
    before: 1 # The number of links before the current page
    after: 3 # The number of links after the current page
---

<div class="post">

{% assign blog_name_size = site.blog_name | size %}
{% assign blog_description_size = site.blog_description | size %}
{% assign active_posts = site.posts | where_exp: 'post', 'post.published != false and post.date <= site.time' %}
{% assign all_active_tags = '' | split: '' %}
{% assign all_active_categories = '' | split: '' %}

{% for post in active_posts %}
{% if post.tags %}
{% assign all_active_tags = all_active_tags | concat: post.tags %}
{% endif %}
{% if post.categories %}
{% assign all_active_categories = all_active_categories | concat: post.categories %}
{% endif %}
{% endfor %}

{% assign unique_active_tags = all_active_tags | uniq %}
{% assign ranked_tag_entries = '' | split: '' %}

{% for tag in unique_active_tags %}
{% assign tag_count = 0 %}
{% assign latest_tag_date = '00000000' %}

{% for post in active_posts %}
{% if post.tags and post.tags contains tag %}
{% assign tag_count = tag_count | plus: 1 %}
{% assign post_date_key = post.date | date: '%Y%m%d' %}
{% if post_date_key > latest_tag_date %}
{% assign latest_tag_date = post_date_key %}
{% endif %}
{% endif %}
{% endfor %}

{% if tag_count > 0 %}
{% assign inverse_tag_count = 9999 | minus: tag_count %}
{% assign inverse_tag_date = 99999999 | minus: latest_tag_date %}
{% capture padded_inverse_tag_count %}0000{{ inverse_tag_count }}{% endcapture %}
{% capture padded_inverse_tag_date %}00000000{{ inverse_tag_date }}{% endcapture %}
{% capture rank_entry %}{{ padded_inverse_tag_count | slice: -4, 4 }}::{{ padded_inverse_tag_date | slice: -8, 8 }}::{{ tag }}{% endcapture %}
{% assign ranked_tag_entries = ranked_tag_entries | push: rank_entry %}
{% endif %}
{% endfor %}

{% assign ranked_tag_entries = ranked_tag_entries | sort %}
{% assign display_tags_limit = site.display_tags_limit | default: 5 %}
{% assign featured_tags = '' | split: '' %}

{% for rank_entry in ranked_tag_entries limit: display_tags_limit %}
{% assign rank_parts = rank_entry | split: '::' %}
{% assign featured_tags = featured_tags | push: rank_parts[2] %}
{% endfor %}

{% assign unique_active_categories = all_active_categories | uniq %}
{% assign ranked_category_entries = '' | split: '' %}

{% for category in unique_active_categories %}
{% assign category_count = 0 %}
{% assign latest_category_date = '00000000' %}

{% for post in active_posts %}
{% if post.categories and post.categories contains category %}
{% assign category_count = category_count | plus: 1 %}
{% assign post_date_key = post.date | date: '%Y%m%d' %}
{% if post_date_key > latest_category_date %}
{% assign latest_category_date = post_date_key %}
{% endif %}
{% endif %}
{% endfor %}

{% if category_count > 0 %}
{% assign inverse_category_count = 9999 | minus: category_count %}
{% assign inverse_category_date = 99999999 | minus: latest_category_date %}
{% capture padded_inverse_category_count %}0000{{ inverse_category_count }}{% endcapture %}
{% capture padded_inverse_category_date %}00000000{{ inverse_category_date }}{% endcapture %}
{% capture rank_entry %}{{ padded_inverse_category_count | slice: -4, 4 }}::{{ padded_inverse_category_date | slice: -8, 8 }}::{{ category }}{% endcapture %}
{% assign ranked_category_entries = ranked_category_entries | push: rank_entry %}
{% endif %}
{% endfor %}

{% assign ranked_category_entries = ranked_category_entries | sort %}
{% assign display_categories_limit = site.display_categories_limit | default: 2 %}
{% assign featured_categories = '' | split: '' %}

{% for rank_entry in ranked_category_entries limit: display_categories_limit %}
{% assign rank_parts = rank_entry | split: '::' %}
{% assign featured_categories = featured_categories | push: rank_parts[2] %}
{% endfor %}
{% assign deduped_featured_tags = '' | split: '' %}

{% for tag in featured_tags %}
{% unless featured_categories contains tag %}
{% assign deduped_featured_tags = deduped_featured_tags | push: tag %}
{% endunless %}
{% endfor %}

{% assign featured_tags = deduped_featured_tags %}

{% if blog_name_size > 0 or blog_description_size > 0 %}

  <div class="header-bar">
    <h1 class="blog-secret-title">
      {{ site.blog_name }}
      <button id="sirui-secret-dog" class="sirui-secret-dog" type="button" aria-label="unlock sirui research thoughts">
        <img src="{{ '/assets/img/meme_dog.png' | relative_url }}" alt="">
      </button>
    </h1>
    <h2>{{ site.blog_description }}</h2>
  </div>

  <div id="sirui-secret-dialog" class="sirui-secret-dialog" hidden>
    <div class="sirui-secret-panel" role="dialog" aria-modal="true" aria-labelledby="sirui-secret-title">
      <button id="sirui-secret-close" class="sirui-secret-close" type="button" aria-label="close">&times;</button>
      <h3 id="sirui-secret-title">secret checkpoint</h3>
      <form id="sirui-secret-form">
        <label for="sirui-secret-password">password</label>
        <div class="sirui-secret-row">
          <input id="sirui-secret-password" type="password" autocomplete="current-password" required>
          <button type="submit">enter</button>
        </div>
      </form>
    </div>
  </div>

  <style>
    .blog-secret-title {
      align-items: center;
      display: inline-flex;
      gap: 0.25em;
      justify-content: center;
    }

    .sirui-secret-dog {
      background: transparent;
      border: 0;
      cursor: pointer;
      line-height: 1;
      padding: 0;
      transform: translateY(0.04em);
    }

    .sirui-secret-dog img {
      border-radius: 50%;
      height: 0.68em;
      object-fit: cover;
      transition:
        transform 160ms ease,
        filter 160ms ease;
      vertical-align: middle;
      width: 0.68em;
    }

    .sirui-secret-dog:hover img,
    .sirui-secret-dog:focus-visible img {
      filter: saturate(1.1);
      transform: rotate(-8deg) scale(1.12);
    }

    .sirui-secret-dialog[hidden] {
      display: none;
    }

    .sirui-secret-dialog {
      align-items: center;
      background: rgba(0, 0, 0, 0.42);
      display: flex;
      inset: 0;
      justify-content: center;
      padding: 1rem;
      position: fixed;
      z-index: 2000;
    }

    .sirui-secret-panel {
      background: var(--global-bg-color);
      border: 1px solid var(--global-divider-color);
      border-radius: 0.5rem;
      box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.2);
      max-width: 22rem;
      padding: 1.2rem;
      position: relative;
      text-align: left;
      width: 100%;
    }

    .sirui-secret-panel h3 {
      font-size: 1.15rem;
      margin: 0 1.5rem 1rem 0;
    }

    .sirui-secret-close {
      background: transparent;
      border: 0;
      color: var(--global-text-color);
      cursor: pointer;
      font-size: 1.5rem;
      line-height: 1;
      position: absolute;
      right: 0.7rem;
      top: 0.55rem;
    }

    .sirui-secret-panel label {
      display: block;
      font-size: 0.9rem;
      margin-bottom: 0.35rem;
    }

    .sirui-secret-row {
      display: flex;
      gap: 0.5rem;
    }

    .sirui-secret-row input {
      flex: 1;
      min-width: 0;
    }

    .sirui-secret-row input,
    .sirui-secret-row button {
      border: 1px solid var(--global-divider-color);
      border-radius: 0.25rem;
      padding: 0.45rem 0.65rem;
    }

    .sirui-secret-row button {
      background: var(--global-theme-color);
      color: var(--global-bg-color);
      cursor: pointer;
    }
  </style>

  <script>
    (() => {
      const dog = document.getElementById("sirui-secret-dog");
      const dialog = document.getElementById("sirui-secret-dialog");
      const closeButton = document.getElementById("sirui-secret-close");
      const form = document.getElementById("sirui-secret-form");
      const password = document.getElementById("sirui-secret-password");
      const secretUrl = "{{ '/blog/2026/sirui-research-thoughts/' | relative_url }}";

      if (!dog || !dialog || !closeButton || !form || !password) return;

      const openDialog = () => {
        dialog.hidden = false;
        password.value = "";
        window.setTimeout(() => password.focus(), 0);
      };

      const closeDialog = () => {
        dialog.hidden = true;
      };

      dog.addEventListener("click", openDialog);
      closeButton.addEventListener("click", closeDialog);
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialog();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !dialog.hidden) closeDialog();
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        sessionStorage.setItem("siruiResearchThoughtsPassword", password.value);
        window.location.href = secretUrl;
      });
    })();
  </script>

{% endif %}

{% if featured_tags.size > 0 or featured_categories.size > 0 %}

  <div class="tag-category-list">
    <ul class="p-0 m-0">
      {% for tag in featured_tags %}
        <li>
          <i class="fa-solid fa-hashtag fa-sm"></i> <a href="{{ tag | slugify | prepend: '/blog/tag/' | relative_url }}">{{ tag }}</a>
        </li>
        {% unless forloop.last %}
          <p>&bull;</p>
        {% endunless %}
      {% endfor %}
      {% if featured_categories.size > 0 and featured_tags.size > 0 %}
        <p>&bull;</p>
      {% endif %}
      {% for category in featured_categories %}
        <li>
          <i class="fa-solid fa-tag fa-sm"></i> <a href="{{ category | slugify | prepend: '/blog/category/' | relative_url }}">{{ category }}</a>
        </li>
        {% unless forloop.last %}
          <p>&bull;</p>
        {% endunless %}
      {% endfor %}
    </ul>
  </div>
  {% endif %}

{% assign featured_posts = site.posts | where: "featured", "true" %}
{% if featured_posts.size > 0 %}
<br>

<div class="featured-posts">
{% assign is_even = featured_posts.size | modulo: 2 %}
<div class="row row-cols-{% if featured_posts.size <= 2 or is_even == 0 %}2{% else %}3{% endif %}">
{% for post in featured_posts %}
<div class="col mb-4">
<a href="{{ post.url | relative_url }}">
<div class="card hoverable">
<div class="row g-0">
<div class="col-md-12">
<div class="card-body">
<div class="float-right">
<i class="fa-solid fa-thumbtack fa-xs"></i>
</div>
<h3 class="card-title text-lowercase">{{ post.title }}</h3>
<p class="card-text">{{ post.description }}</p>

                    {% if post.external_source == blank %}
                      {% assign read_time = post.content | number_of_words | divided_by: 180 | plus: 1 %}
                    {% else %}
                      {% assign read_time = post.feed_content | strip_html | number_of_words | divided_by: 180 | plus: 1 %}
                    {% endif %}
                    {% assign year = post.date | date: "%Y" %}

                    <p class="post-meta">
                      {{ read_time }} min read &nbsp; &middot; &nbsp;
                      <a href="{{ year | prepend: '/blog/' | relative_url }}">
                        <i class="fa-solid fa-calendar fa-sm"></i> {{ year }} </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </a>
        </div>
      {% endfor %}
      </div>
    </div>
    <hr>

{% endif %}

  <ul class="post-list">

    {% if page.pagination.enabled %}
      {% assign postlist = paginator.posts %}
    {% else %}
      {% assign postlist = site.posts %}
    {% endif %}

    {% for post in postlist %}

    {% if post.external_source == blank %}
      {% assign read_time = post.content | number_of_words | divided_by: 180 | plus: 1 %}
    {% else %}
      {% assign read_time = post.feed_content | strip_html | number_of_words | divided_by: 180 | plus: 1 %}
    {% endif %}
    {% assign year = post.date | date: "%Y" %}
    {% assign display_tags = '' | split: '' %}
    {% if post.tags %}
      {% for tag in post.tags %}
        {% unless post.categories and post.categories contains tag %}
          {% assign display_tags = display_tags | push: tag %}
        {% endunless %}
      {% endfor %}
    {% endif %}
    {% assign tags = display_tags | join: "" %}
    {% assign categories = post.categories | join: "" %}

    <li>

{% if post.thumbnail %}

<div class="row">
          <div class="col-sm-9">
{% endif %}
        <h3>
        {% if post.redirect == blank %}
          <a class="post-title" href="{{ post.url | relative_url }}">{{ post.title }}</a>
        {% elsif post.redirect contains '://' %}
          <a class="post-title" href="{{ post.redirect }}" target="_blank">{{ post.title }}</a>
          <svg width="2rem" height="2rem" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 13.5v6H5v-12h6m3-3h6v6m0-6-9 9" class="icon_svg-stroke" stroke="#999" stroke-width="1.5" fill="none" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        {% else %}
          <a class="post-title" href="{{ post.redirect | relative_url }}">{{ post.title }}</a>
        {% endif %}
      </h3>
      <p>{{ post.description }}</p>
      <p class="post-meta">
        {{ read_time }} min read &nbsp; &middot; &nbsp;
        {{ post.date | date: '%B %d, %Y' }}
        {% if post.external_source %}
        &nbsp; &middot; &nbsp; {{ post.external_source }}
        {% endif %}
      </p>
      <p class="post-tags">
        <a href="{{ year | prepend: '/blog/' | relative_url }}">
          <i class="fa-solid fa-calendar fa-sm"></i> {{ year }} </a>

          {% if tags != "" %}
          &nbsp; &middot; &nbsp;
            {% for tag in display_tags %}
            <a href="{{ tag | slugify | prepend: '/blog/tag/' | relative_url }}">
              <i class="fa-solid fa-hashtag fa-sm"></i> {{ tag }}</a>
              {% unless forloop.last %}
                &nbsp;
              {% endunless %}
              {% endfor %}
          {% endif %}

          {% if categories != "" %}
          &nbsp; &middot; &nbsp;
            {% for category in post.categories %}
            <a href="{{ category | slugify | prepend: '/blog/category/' | relative_url }}">
              <i class="fa-solid fa-tag fa-sm"></i> {{ category }}</a>
              {% unless forloop.last %}
                &nbsp;
              {% endunless %}
              {% endfor %}
          {% endif %}
    </p>

{% if post.thumbnail %}

</div>

  <div class="col-sm-3">
    <img class="card-img" src="{{ post.thumbnail | relative_url }}" style="object-fit: cover; height: 90%" alt="image">
  </div>
</div>
{% endif %}
    </li>

    {% endfor %}

  </ul>

{% if page.pagination.enabled %}
{% include pagination.liquid %}
{% endif %}

</div>
